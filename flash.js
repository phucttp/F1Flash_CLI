/*
 * flash.js — nạp firmware cho board F1Flash ngay trong trình duyệt.
 *
 * Khách nhận 3 file .bin qua email rồi chọn ở đây. ĐỊA CHỈ NẠP KHÔNG PHẢI VIỆC
 * CỦA HỌ: nó nằm cứng bên dưới, vì đó là thứ hỏng thường xuyên nhất. Mọi hướng
 * dẫn ESP32 trên mạng đều ghi bootloader ở 0x1000, còn ESP32-C3 thì ở 0x0 —
 * nạp sai chỗ đó là board không boot, không có gì trên màn hình hay serial giải
 * thích tại sao. Các trang nạp phổ thông bắt người dùng tự gõ từng offset;
 * trang này không cho cơ hội gõ sai.
 */
import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.5.4/bundle.js";

/* Cố định bởi partitions.csv. Không được biến thành ô nhập. */
const PARTS = [
  { key: "bootloader", label: "bootloader.bin",      address: 0x0     },
  { key: "partition",  label: "partition-table.bin", address: 0x8000  },
  { key: "app",        label: "F1Flash.bin",         address: 0x10000 },
];

const $ = (id) => document.getElementById(id);
let transport = null;

function log(line, cls) {
  const el = $("log");
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = line;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

/* esptool-js ghi tiến trình qua một object giống terminal. */
const terminal = {
  clean() { $("log").textContent = ""; },
  writeLine(d) { log(String(d)); },
  write(d) {
    const s = String(d).replace(/\r/g, "");
    if (s.trim()) log(s.trimEnd());
  },
};

/* esptool-js nhận từng file dưới dạng chuỗi nhị phân, không phải ArrayBuffer. */
function readAsBinaryString(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const bytes = new Uint8Array(r.result);
      let s = "";
      /* Cắt khúc: gọi String.fromCharCode.apply trên mảng 2 MB sẽ tràn stack. */
      for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      resolve(s);
    };
    r.onerror = () => reject(new Error("không đọc được " + file.name));
    r.readAsArrayBuffer(file);
  });
}

function chosen() {
  const out = [];
  for (const p of PARTS) {
    const f = $("f-" + p.key).files[0];
    if (!f) return { error: "chưa chọn " + p.label };
    out.push({ part: p, file: f });
  }
  return { out };
}

/*
 * Kiểm tra sơ bộ file được chọn. Không đọc được nội dung, nhưng bắt được lỗi
 * hiển nhiên: bỏ nhầm file firmware 2 MB vào ô bảng phân vùng 3 KB. Nếu lọt,
 * nó sẽ được ghi vào 0x8000 và tạo ra một board hỏng theo kiểu không ai lần
 * ngược lại được tới trang này.
 */
function suspicious(sel) {
  const bad = [];
  for (const { part, file } of sel) {
    const kb = (n) => n.toLocaleString() + " byte";
    if (part.key === "partition" && file.size > 64 * 1024)
      bad.push(file.name + " quá lớn cho bảng phân vùng (" + kb(file.size) + ")");
    if (part.key === "bootloader" && file.size > 128 * 1024)
      bad.push(file.name + " quá lớn cho bootloader (" + kb(file.size) + ")");
    if (part.key === "app" && file.size < 256 * 1024)
      bad.push(file.name + " quá nhỏ cho firmware chính (" + kb(file.size) + ")");
  }
  return bad;
}

async function run() {
  const { out: sel, error } = chosen();
  if (error) { log("!! " + error, "err"); return; }

  const warn = suspicious(sel);
  if (warn.length) {
    warn.forEach((w) => log("!! " + w, "err"));
    log("Kiểm tra lại xem có chọn nhầm file vào ô nào không.", "err");
    return;
  }

  $("go").disabled = true;
  $("progress").hidden = false;

  try {
    log("Chọn cổng COM của board trong hộp thoại vừa hiện ra...");
    const device = await navigator.serial.requestPort({});
    transport = new Transport(device, true);

    const esploader = new ESPLoader({
      transport,
      baudrate: 460800,
      romBaudrate: 115200,
      terminal,
    });

    const chip = await esploader.main();
    log("Kết nối được: " + chip, "ok");

    if (!/C3/i.test(String(chip))) {
      log("!! Đây là " + chip + ", không phải ESP32-C3. Dừng lại.", "err");
      return;
    }

    const fileArray = [];
    for (const { part, file } of sel) {
      log("Đọc " + file.name + " → 0x" + part.address.toString(16));
      fileArray.push({
        data: await readAsBinaryString(file),
        address: part.address,
      });
    }

    log("Đang nạp — đừng rút cáp.");
    await esploader.writeFlash({
      fileArray,
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      /* Không xoá toàn chip: partition `storage` giữ ảnh STM32 mà máy đang
       * mang, và cập nhật firmware host không được làm mất nó. */
      eraseAll: false,
      compress: true,
      reportProgress: (i, written, total) => {
        const pct = Math.round((written / total) * 100);
        $("bar").style.width = pct + "%";
        $("pct").textContent = sel[i].part.label + " — " + pct + "%";
      },
    });

    await esploader.after();
    log("XONG. Board đã khởi động lại.", "ok");
    log("Kiểm tra đèn: nháy chậm = chưa có firmware STM32; sáng liên tục = sẵn sàng.");
  } catch (e) {
    log("!! " + (e && e.message ? e.message : e), "err");
  } finally {
    try { if (transport) await transport.disconnect(); } catch (_) {}
    $("go").disabled = false;
  }
}

if (!("serial" in navigator)) {
  $("unsupported").hidden = false;
  $("flasher").hidden = true;
} else {
  $("go").addEventListener("click", run);
  for (const p of PARTS) {
    $("f-" + p.key).addEventListener("change", (e) => {
      const f = e.target.files[0];
      $("n-" + p.key).textContent = f
        ? f.name + " — " + f.size.toLocaleString() + " byte"
        : "";
    });
  }
}

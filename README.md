# F1Flash — hướng dẫn sử dụng

Trang hướng dẫn và công cụ nạp firmware cho máy nạp STM32F1 **F1Flash**.

👉 **https://phucttp.github.io/F1Flash_CLI/**

Repo này chỉ chứa trang hướng dẫn. Mã nguồn của firmware và của phần mềm PC
nằm ở nơi khác; file firmware `.bin` được gửi trực tiếp cho từng khách hàng.

## Nội dung

| | |
|---|---|
| `index.html` | hướng dẫn đấu dây, ý nghĩa đèn báo, cách dùng, xử lý sự cố |
| `flash.js` | nạp firmware cho board qua WebSerial, ngay trong trình duyệt |

Trang nạp yêu cầu **Chrome** hoặc **Edge** trên máy tính. Khách chọn ba file
`.bin` được gửi; địa chỉ nạp đã cố định sẵn trong trang nên không có chỗ nhập
sai — trên ESP32-C3 bootloader nằm ở `0x0`, khác với `0x1000` mà hầu hết hướng
dẫn ESP32 ghi.

## Bật GitHub Pages

Settings → Pages → Source: `Deploy from a branch` → Branch `main`, thư mục `/`
(root).

---

MIT — TTP27

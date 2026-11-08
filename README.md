# Sổ tiết kiệm

Web ghi sổ tiết kiệm cá nhân: gửi / rút / cho mượn / được trả, thống kê, biểu đồ, phân loại tự động,
vàng quy ra tiền theo giá thị trường (vang.today → PNJ → SJC). Giao diện theo style **Air** (nền trời đêm, thẻ sáng).

- Mở link, gõ mật khẩu là xem — không cần tài khoản. Số liệu chỉ nằm trong `du-lieu.enc.json` dưới dạng **đã mã hoá**
  AES-256-GCM, khoá dẫn từ mật khẩu bằng Argon2id (64 MB, 4 vòng). Không có mật khẩu thì file chỉ là chuỗi ngẫu nhiên.
- Máy nào muốn đăng thay đổi lên web thì dán token fine-grained (Contents: Read and write, chỉ repo này) một lần.
- Nhập được file Excel sổ cũ (cột Ngày · Ghi chú · Nhập · Rút · Cho bạn mượn · Vàng), xuất Excel / JSON.
- 63 hiệu ứng, bật / tắt từng cái trong Cài đặt → Hiệu ứng. Tắt hết vẫn đọc đủ nội dung.
- Chạy tĩnh, không cần máy chủ: Chart.js 4.4.6 + SheetJS 0.20.3 (để sẵn trong `lib/`).

# Sổ tiết kiệm

Web ghi sổ tiết kiệm cá nhân: gửi / rút / cho mượn / được trả, thống kê, biểu đồ, phân loại tự động,
vàng quy ra tiền theo giá thị trường (vang.today → PNJ → SJC). Giao diện theo style **Air** (nền trời đêm, thẻ sáng).

- **Không có số liệu nào trong repo này.** Dữ liệu mã hoá AES-256-GCM (khoá dẫn từ mật khẩu bằng PBKDF2-SHA256,
  310.000 vòng) và chỉ nằm trong trình duyệt. Đồng bộ nhiều máy (tuỳ chọn): bản đã mã hoá được đẩy vào một repo
  **riêng tư** khác bằng token fine-grained của chính người dùng.
- Nhập được file Excel sổ cũ (cột Ngày · Ghi chú · Nhập · Rút · Cho bạn mượn · Vàng), xuất Excel / JSON.
- 63 hiệu ứng, bật / tắt từng cái trong Cài đặt → Hiệu ứng. Tắt hết vẫn đọc đủ nội dung.
- Chạy tĩnh, không cần máy chủ: Chart.js 4.4.6 + SheetJS 0.20.3 (để sẵn trong `lib/`).

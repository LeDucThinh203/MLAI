# HƯỚNG DẪN THỰC HIỆN KIỂM CHỨNG NGƯỜI DÙNG THỰC TẾ (USER VALIDATION SPRINT 2)

Tài liệu này đóng vai trò hướng dẫn quy chuẩn cho Team 1 trong quá trình triển khai kiểm thử người dùng thực tế (**User Validation**) đối với hệ thống **EDUASSISTANT** (Track VNG – Option A: Escalation Referee).

---

## ⚠️ NGUYÊN TẮC CỐT LÕI (STRICT POLICY)

1. **TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT (ZERO FABRICATION):**
   - Không được phép tạo tên giả, lời nhận xét giả mạo, hoặc tự tưởng tượng dữ liệu phản hồi.
   - Toàn bộ nội dung trong hồ sơ phản hồi phải bắt nguồn từ các buổi thử nghiệm thực tế với người dùng thật.

2. **SỐ LƯỢNG NGƯỜI DÙNG TỐI THIỂU:**
   - Phải thực hiện kiểm thử với **ít nhất 3 người dùng thực tế** (>= 3 người).
   - Cơ cấu khuyến nghị:
     - Ít nhất 1 Sinh viên (Role: `STUDENT`).
     - Ít nhất 1 Cán bộ / Chuyên viên Thẩm định (Role: `REVIEWER`).
     - Ít nhất 1 Giảng viên / Quản trị viên (Role: `ADMIN`).

3. **VÒNG LẶP SẢN PHẨM KHÉP KÍN (CLOSED-LOOP ITERATION):**
   - Sau khi thu thập phản hồi, nhóm phải:
     1. Tổng hợp các điểm nghẽn (**Pain points**).
     2. Lựa chọn ít nhất **1 phản hồi xác đáng nhất** để cải tiến code/sản phẩm.
     3. Ghi nhận **Commit Before/After** thể hiện sự thay đổi đó vào `summary-template.md`.

---

## CẤU TRÚC THƯ MỤC

```text
docs/user-validation/
├── README.md               # Tài liệu quy chuẩn này
├── feedback-template.md    # Biểu mẫu ghi chép cho từng cá nhân kiểm thử
├── summary-template.md     # Biểu mẫu tổng hợp kết quả & commit cải tiến sản phẩm
└── sessions/               # Lưu trữ biên bản các buổi test thực tế (Nhóm tự điền)
```

---

## QUY TRÌNH TIẾN HÀNH

### Bước 1: Chuẩn bị Môi trường Kiểm thử
- Khởi động backend và frontend EDUASSISTANT tại môi trường cục bộ (`localhost:5173` và `localhost:3001`).
- Cung cấp tài khoản mẫu tương ứng cho từng vai trò (`student1`, `reviewer1`, `admin1`) hoặc hướng dẫn người dùng tự đăng ký.

### Bước 2: Hướng dẫn Người dùng Thực hiện Workflow
- **Sinh viên:** Tải minh chứng ảnh/PDF -> xem OCR nhận diện -> nộp đơn -> theo dõi trạng thái -> tra cứu QR quyết định.
- **Thẩm định viên:** Xem hàng đợi phân loại -> kiểm tra lý do leo thang AI (5 nguyên nhân) -> thực hiện Duyệt / Yêu cầu bổ sung / Từ chối / Ghi đè (Override) / Dừng tiến trình (Stop) -> gửi phản hồi Feedback (Correct / Missed / Unnecessary).
- **Quản trị viên / Giám khảo:** Truy cập `/judge` -> kiểm tra System status -> chạy Verify Harness một chạm -> xem Audit Trail & Benchmark accuracy.

### Bước 3: Phỏng vấn & Ghi chép
- Sử dụng [feedback-template.md](./feedback-template.md) để ghi nhận nguyên văn lời nhận xét (**Verbatim feedback**).

### Bước 4: Thực thi Cải tiến Sản phẩm
- Chọn ít nhất 1 thay đổi được người dùng yêu cầu, sửa đổi source code, commit lên git và cập nhật [summary-template.md](./summary-template.md).

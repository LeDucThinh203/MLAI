# QUY CHẾ ĐIỀU PHỐI VÀ GIẢI QUYẾT HỒ SƠ DỊCH VỤ SINH VIÊN
## (SYNTHETIC HACKATHON POLICY DATA - NOT AN OFFICIAL UNIVERSITY POLICY)

> [!WARNING]
> **DỮ LIỆU GIẢ ĐỊNH CHO HACKATHON MLAI 2026**
> Toàn bộ nội dung trong văn bản này là tài liệu giả định phục vụ huấn luyện và kiểm thử hệ thống CaseFlow AI. Đây không phải quy chế chính thức của bất kỳ trường đại học nào.

---

### 1. Phạm vi áp dụng & Mục tiêu
Quy chế này quy định ranh giới tự động hóa giữa trí tuệ nhân tạo (AI/VLM) và thẩm quyền con người trong việc tiếp nhận, điều phối và xử lý hồ sơ sinh viên bị mắc kẹt giữa các phòng ban:
- **Phòng Kế hoạch Tài chính (FINANCE)**
- **Phòng Đào tạo (ACADEMIC_AFFAIRS)**
- **Phòng Công tác Sinh viên (STUDENT_SERVICES)**
- **Phòng Công nghệ Thông tin (IT_SUPPORT)**

---

### 2. Quy định theo từng phân hệ (Domain Rules)

#### 2.1. Xác nhận tình trạng học phí (Tuition Status - POL-TUITION)
- **RULE-TUIT-001-AUTO (Tự động cập nhật):**
  - Điều kiện: Sinh viên nộp minh chứng chuyển khoản rõ ràng (CLEAR), có đầy đủ mã sinh viên, mã giao dịch hợp lệ từ ngân hàng, số tiền trên biên lai khớp 100% với số tiền phải thu trên hệ thống SIS.
  - Hành động: `AUTO_RESOLVE` (Tự động chuyển trạng thái học phí sang PAID).
- **RULE-TUIT-002-CONFLICT (Xung đột số tiền):**
  - Điều kiện: Số tiền hiển thị trên biên lai khác với số nợ trên hệ thống SIS.
  - Hành động: `ESCALATE` sang **Phòng Kế hoạch Tài chính** với phân loại `DATA_CONFLICT`. AI không được tự ý quyết định nguồn nào đúng.

#### 2.2. Khóa đăng ký tín chỉ (Registration Block - POL-ACAD)
- **RULE-ACAD-001 (Mở khóa do trễ học phí đã giải quyết):**
  - Điều kiện: Đã có biên lai hợp lệ được đối soát thành công bởi Tài chính.
  - Hành động: Chuyển thông tin cho Phòng Đào tạo mở khóa học vụ.
- **RULE-ACAD-002 (Khóa học vụ do vi phạm điều kiện tiên quyết / kỷ luật):**
  - Hành động: `ESCALATE` sang Cán bộ Đào tạo; AI tuyệt đối không tự ý gỡ chặn.

#### 2.3. Cấp giấy xác nhận sinh viên (Confirmation Letter SLA - POL-STUSRV)
- **SLA chuẩn:** 3 ngày làm việc kể từ lúc tiếp nhận hồ sơ hợp lệ.
- **Yêu cầu khẩn cấp (Trước SLA):** Bắt buộc phải có chữ ký phê duyệt từ Trưởng phòng CTSV (`AUTHORITY_REQUIRED`). AI không có thẩm quyền tự động xuất giấy trước hạn.

---

### 3. Nguyên tắc thẩm quyền & Giới hạn tự động hóa (Authority & Safeguards)
1. **Giới hạn số tiền tự động:** Mọi giao dịch hoặc đề xuất hoàn/hủy có giá trị trên **50.000.000 VNĐ** bắt buộc phải leo thang lên Kế toán trưởng (`AUTHORITY_REQUIRED`).
2. **Minh chứng không đạt chuẩn:** Nếu ảnh chụp mờ, thiếu mã sinh viên hoặc thiếu số tiền, hệ thống phải dừng lại và yêu cầu thông tin bổ sung (`FACT_UNKNOWN`), tuyệt đối không được suy diễn hoặc đoán mò.
3. **Trường hợp ngoài quy chế:** Nếu hồ sơ có nội dung chưa từng được định nghĩa trong quy chế, hệ thống gán nhãn `POLICY_OUT_OF_SCOPE` và bàn giao cho cấp quản lý.

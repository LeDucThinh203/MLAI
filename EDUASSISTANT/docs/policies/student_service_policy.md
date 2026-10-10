# QUY CHẾ CẤP GIẤY XÁC NHẬN SINH VIÊN PHỤC VỤ TẠM HOÃN NGHĨA VỤ QUÂN SỰ
## (MILITARY SERVICE CONFIRMATION POLICY - DOMAIN NVQS 2026)

> [!IMPORTANT]
> **VĂN BẢN NGHIỆP VỤ CHUYÊN SÂU — MLAI HACKATHON 2026 (TEAM 1)**
> Use Case: Cấp Giấy xác nhận sinh viên phục vụ tạm hoãn Nghĩa vụ quân sự (`MILITARY_SERVICE_CONFIRMATION`).
> Cơ sở pháp lý tham chiếu:
> - Luật Nghĩa vụ Quân sự 2015 (Khoản 1 Điều 41 về tạm hoãn gọi nhập ngũ đối với sinh viên).
> - Nghị định số 13/2016/NĐ-CP của Chính phủ quy định trình tự, thủ tục đăng ký nghĩa vụ quân sự.
> - Thông tư số 148/2018/TT-BQP của Bộ Quốc phòng hướng dẫn tuyển chọn và gọi công dân nhập ngũ.

---

### 1. Phạm Vi Áp Dụng & Mục Tiêu

Quy chế này xác định ranh giới tự động hóa và cơ chế phân xử leo thang (**The Escalation Referee**) giữa hệ thống AI và Cán bộ thẩm định Phòng Quản lý Đào tạo trong quy trình cấp Giấy xác nhận sinh viên nộp cho Ban Chỉ huy Quân sự cấp xã/phường phục vụ tạm hoãn nghĩa vụ quân sự:
- **Chuyên môn thụ lý chính:** Phòng Quản lý Đào tạo (Academic Affairs Office).
- **Phối hợp liên ngành:** Phòng Công tác Sinh viên, Ban Chỉ huy Quân sự địa phương.
- **Tiêu chuẩn an toàn:** Tuyệt đối không tự ý suy diễn hoặc bổ sung dữ kiện pháp lý khi thiếu căn cứ xác thực từ hồ sơ gốc của Nhà trường.

---

### 2. Tiêu Chuẩn Hồ Sơ Đủ Điều Kiện Tự Động Phê Duyệt (`AUTO_APPROVE`)

Hệ thống chỉ được phép tự động phê duyệt cấp Giấy xác nhận điện tử khi đồng thời thỏa mãn **toàn bộ 5 điều kiện tiên quyết**:
1. **Định danh chủ quyền hợp lệ:** Mã số sinh viên (MSSV) và họ tên khai báo trên đơn trùng khớp tuyệt đối với tài khoản sinh viên đã xác thực đang đăng nhập.
2. **Trạng thái đào tạo chính khóa:** Hồ sơ sinh viên trong Cơ sở dữ liệu trường có `academicStatus = 'ACTIVE'`, học kỳ hiện tại đang kích hoạt (`currentTermActive = true`) và có lịch học/thời khóa biểu hợp lệ (`hasCurrentSchedule = true`).
3. **Loại địa chỉ đúng quy định:** Sinh viên chọn loại địa chỉ **Thường trú (`PERMANENT`)**. Mẫu Giấy xác nhận NVQS pháp định gửi về Ban Chỉ huy Quân sự địa phương nơi đăng ký thường trú; kê khai tạm trú không hợp lệ.
4. **Địa chỉ thường trú đầy đủ & đồng nhất:** 
   - Khai báo đầy đủ tối thiểu 4 cấp đơn vị hành chính: Số nhà/Đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố.
   - Không có mâu thuẫn trọng yếu (material conflict) với địa chỉ thường trú gốc được lưu trữ trong CSDL Nhà trường.
   - Độ tin cậy bóc tách cú pháp đạt từ ngưỡng thích ứng hiện tại trở lên (`confidence >= currentThreshold`).
5. **AI Provenance Live:** Động cơ AI chạy ở chế độ trực tiếp (`AI_MODE = 'live'`), không xảy ra lỗi suy thoái (`isFallback = false`) và không phải dữ liệu giả lập (`isSynthetic = false`).

---

### 3. Năm (5) Nhóm Nguyên Nhân Leo Thang Lên Cán Bộ Thẩm Định (`ESCALATE_TO_HUMAN`)

Khi bất kỳ điều kiện tiên quyết nào không thỏa mãn, hệ thống phải dừng tự động hóa và leo thang hồ sơ lên Cán bộ thẩm định với mã nguyên nhân cụ thể:

| Mã Nguyên Nhân | Nhãn Hiển Thị | Tiêu Chí Kích Hoạt Nghiệp Vụ | Hành Động Khuyến Nghị Cán Bộ |
| :--- | :--- | :--- | :--- |
| `OWNERSHIP_UNCLEAR` | Nghi vấn chủ quyền hồ sơ / Lệch MSSV | MSSV hoặc họ tên trên đơn/minh chứng lệch với tài khoản sinh viên đang nộp đơn. | Yêu cầu xuất trình CCCD gắn chip đối chiếu trực tiếp. |
| `FACT_UNKNOWN` | Thiếu dữ kiện xác thực / Địa chỉ chưa đủ thành phần | Địa chỉ khai báo thiếu số nhà/đường, thiếu phường/xã hoặc tỉnh/thành phố; hoặc CSDL trường chưa có địa chỉ thường trú gốc; hoặc AI chạy chế độ giả lập / dự phòng (Mock/Cache/Fallback). | Hướng dẫn sinh viên bổ sung sổ hộ khẩu / thông tin cư trú VNeID. |
| `DATA_CONFLICT` | Mâu thuẫn dữ liệu kê khai & lưu trữ | Sinh viên khai báo địa chỉ tạm trú (quy định bắt buộc thường trú) hoặc địa chỉ thường trú mâu thuẫn quận/huyện, tỉnh/thành phố với CSDL trường. | Liên hệ sinh viên xác minh cập nhật thay đổi nơi cư trú. |
| `AUTHORITY_REQUIRED` | Cần thẩm quyền xem xét (Trạng thái đào tạo) | Sinh viên đang trong trạng thái tạm đình chỉ (`SUSPENDED`), đã thôi học (`WITHDRAWN`), xin gia hạn (`EXTENSION`), bảo lưu (`LEAVE_OF_ABSENCE`), hoặc chưa đăng ký học kỳ mới. | Chuyển Hội đồng Đào tạo xem xét điều kiện hoãn theo luật. |
| `POLICY_OUT_OF_SCOPE` | Ngoại lệ chính sách ngoài thẩm quyền | Đơn có yêu cầu đặc cách, cứu xét, vượt khung thời gian đào tạo chuẩn hoặc yêu cầu nội dung ngoài quy chuẩn hoãn NVQS thông thường. | Trình Ban Giám hiệu quyết định văn bản đặc biệt. |

---

### 4. Cơ Chế Giám Sát Con Người Trong Vòng Lặp (Human-in-the-Loop)

1. **Ghi đè thẩm quyền (Reviewer Override):**
   - Cán bộ thẩm định có quyền ghi đè quyết định của Rule Engine (ví dụ: chuyển từ `ESCALATE_TO_HUMAN` sang `APPROVED` sau khi đã kiểm tra hồ sơ giấy).
   - **Bắt buộc:** Phải cung cấp lý do ghi đè minh bạch (`overrideReason`), lưu vết vĩnh viễn vào Audit Trail toàn trường.
2. **Dừng khẩn cấp tiến trình (`STOP`):**
   - Cho phép đóng băng ngay lập tức các hồ sơ phát hiện dấu hiệu gian lận hoặc tranh chấp pháp lý.
3. **Phản hồi thích ứng ngưỡng (`Reviewer Feedback`):**
   - `MISSED_ESCALATION` (Sót leo thang): Hệ thống tự duyệt sai -> Ngưỡng tin cậy tăng `+0.02` (tối đa `0.90`).
   - `UNNECESSARY_ESCALATION` (Leo thang thừa): Hệ thống leo thang không cần thiết -> Ngưỡng tin cậy giảm `-0.02` (tối thiểu `0.65`).
   - `CORRECT` (Đúng chuẩn): Quyết định chính xác, không thay đổi ngưỡng.
4. **Chứng thực điện tử & Chữ ký số:**
   - Mọi Giấy xác nhận sinh viên điện tử được cấp đều được đóng dấu chữ ký số HMAC-SHA256, đính kèm mã QR tra cứu công khai độc lập, chống làm giả.

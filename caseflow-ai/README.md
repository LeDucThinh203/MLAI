# CASEFLOW AI – THE ESCALATION REFEREE

> **Tagline:** *Automate the routine. Escalate the uncertain. Keep humans accountable.*  
> **Challenge:** Challenge A – The Escalation Referee (MLAI Hackathon 2026)  
> **Tên tiếng Việt:** Hệ thống AI điều phối và xử lý các hồ sơ sinh viên bị mắc kẹt giữa nhiều bộ phận.

---

## 1. Project Overview & Problem Statement
Trong môi trường đại học, sinh viên thường xuyên gặp tình trạng hồ sơ bị mắc kẹt hoặc chuyển vòng quanh giữa các phòng ban (Kế hoạch Tài chính, Đào tạo, Công tác Sinh viên, CNTT):
- Sinh viên đã nộp tiền nhưng cổng thông tin vẫn báo nợ học phí (`UNPAID`).
- Biên lai thanh toán khác với số tiền hệ thống ghi nhận.
- Bị khóa đăng ký môn hoặc cần giấy xác nhận trước thời hạn SLA.

Hầu hết các giải pháp hiện nay hoặc dùng Chatbot trả lời chung chung ("Vui lòng liên hệ phòng X"), hoặc cố gắng tự động hóa quá đà gây ra sai sót tài chính và học vụ nghiêm trọng.

## 2. Why This is NOT Just a Chatbot
CaseFlow AI **không phải là chatbot hội thoại**:
- **Deterministic Safeguards:** Gemini/VLM chỉ được dùng để trích xuất dữ kiện có cấu trúc (`Structured Facts`). Quyết định cuối cùng bắt buộc phải đi qua 4 tầng engine xác định: `PolicyEngine` → `UncertaintyEngine` → `AuthorityEngine` → `DecisionEngine`.
- **Zero Hallucination:** Nếu ảnh chụp mờ, thiếu thông tin hoặc phát hiện mâu thuẫn dữ liệu (`DATA_CONFLICT`), hệ thống lập tức dừng lại (`HALT`) và leo thang có trách nhiệm (`ESCALATE`) đến đúng cán bộ phụ trách.
- **Explainable & Accountable:** Thay vì câu lệnh mơ hồ "Please review", CaseFlow AI sinh ra câu hỏi cụ thể kèm số liệu đối chiếu rõ ràng để con người ra quyết định nhanh chóng.

## 3. Multimodal VLM Architecture & Pipeline
```
UPLOAD FILE → VALIDATE FILE → CHECK MIME/SIZE → SHA-256 HASH
→ GEMINI VLM EXTRACTION → PYDANTIC VALIDATION → EVIDENCE COMPARISON
→ DETERMINISTIC POLICY / UNCERTAINTY / AUTHORITY / DECISION ENGINES
→ AUTO_RESOLVE / ESCALATE / HUMAN REVIEW → IMMUTABLE AUDIT LOG
```

## 4. Human-in-the-Loop & Escalation Types
- `FACT_UNKNOWN`: Ảnh biên lai mờ, thiếu số tiền hoặc mã giao dịch.
- `DATA_CONFLICT`: Số tiền trên biên lai khác số tiền trên hệ thống SIS.
- `POLICY_OUT_OF_SCOPE`: Tình huống ngoại lệ chưa có quy chế.
- `AUTHORITY_REQUIRED`: Hồ sơ vượt quá hạn mức AI được phép giải quyết (ví dụ > 50 triệu VNĐ hoặc cần chữ ký Trưởng phòng).
- `OWNERSHIP_UNCLEAR`: Chưa rõ đơn vị chịu trách nhiệm thụ lý.

## 5. Technology Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, pyodbc, Pydantic v2, google-genai SDK, pytest.
- **Database:** Microsoft SQL Server 2022 (Docker / local) qua ODBC Driver 18 for SQL Server.
- **AI/VLM:** Google Gemini 2.5 Flash (Multimodal VLM + Text).
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Axios, Lucide Icons.

## 6. Project Directory Structure
```
caseflow-ai/
├── backend/            # FastAPI REST API, SQLAlchemy models, AI providers, Deterministic Engines
├── frontend/           # React + TypeScript + Vite + Tailwind UI
├── docs/               # Architecture, Synthetic Policies, Measurements, Runbook
├── test-data/sprint1/  # Synthetic test cases for Verification Harness
├── scripts/            # Utility scripts
├── storage/evidence/   # Secure local evidence file storage
├── docker-compose.yml  # Microsoft SQL Server 2022 container
└── README.md
```

## 7. Quick Start Guide
Xem hướng dẫn chi tiết từng lệnh tại [RUNBOOK.md](file:///e:/NamHoc_2023-2024/MLAI/Team1/caseflow-ai/docs/runbook/RUNBOOK.md).

1. Khởi động SQL Server 2022:
   ```bash
   docker compose up -d
   ```
2. Khởi tạo Backend:
   ```bash
   cd backend
   pip install -e .
   alembic upgrade head
   python -m app.db.seed
   uvicorn app.main:app --reload
   ```
3. Khởi tạo Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 8. Verification Harness
Truy cập `/verify` trên giao diện web hoặc gọi endpoint `POST /api/verify/run` để chạy toàn bộ các bộ test case mẫu qua engine thực tế.

## 9. Synthetic Data Disclaimer
> [!NOTE]
> Toàn bộ quy chế, dữ liệu sinh viên, số tiền và biên lai trong dự án này là dữ liệu giả lập (`SYNTHETIC HACKATHON DATA`) phục vụ Hackathon 2026.

## 10. Known Limitations & Phase 2 Roadmap
- Phase 1 tập trung vào xây dựng bộ khung chuẩn xác (`Skeleton Architecture`), hệ thống models/schemas, bộ quy tắc xác định và Verify harness.
- Phase 2 sẽ tích hợp trọn vẹn kết nối live với cơ sở dữ liệu trường thực tế và hoàn thiện các prompt chuyên sâu.

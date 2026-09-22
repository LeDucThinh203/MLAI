from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.case import CaseCreate, CaseResponse, CaseDetailResponse
from app.schemas.audit_log import AuditLogResponse
from app.services.case_service import CaseService
from app.services.case_analysis_service import CaseAnalysisService
from app.services.audit_log_service import AuditLogService

router = APIRouter(prefix="/cases", tags=["Cases"])

@router.post("", response_model=CaseResponse)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    service = CaseService(db)
    return service.create_case(payload)

@router.get("", response_model=List[CaseResponse])
def list_cases(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = CaseService(db)
    return service.list_cases(skip, limit, status)

@router.get("/{id}", response_model=CaseDetailResponse)
def get_case(id: str, db: Session = Depends(get_db)):
    service = CaseService(db)
    case_detail = service.get_case_detail(id)
    if not case_detail:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_detail

@router.post("/{id}/analyze")
async def analyze_case(id: str, db: Session = Depends(get_db)):
    service = CaseAnalysisService(db)
    try:
        result = await service.analyze_case(id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{id}/stop")
def stop_case(id: str, reason: str = "Hồ sơ tạm dừng bởi nhân viên quản trị", db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        service.stop_workflow(id, reason=reason)
        return {"status": "STOPPED", "case_id": id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{id}/resume")
def resume_case(id: str, reason: str = "Tiếp tục luồng xử lý hồ sơ", db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        service.resume_workflow(id, reason=reason)
        return {"status": "ANALYZING", "case_id": id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{id}/timeline")
def get_case_timeline(id: str, db: Session = Depends(get_db)):
    audit_service = AuditLogService(db)
    logs = audit_service.list_by_case(id)
    return logs

@router.get("/{id}/audit", response_model=List[AuditLogResponse])
def get_case_audit(id: str, db: Session = Depends(get_db)):
    audit_service = AuditLogService(db)
    return audit_service.list_by_case(id)

@router.post("/seed-5-escalations")
async def seed_5_escalations(db: Session = Depends(get_db)):
    """Automatically seeds and analyzes the 5 standard safeguard escalation cases."""
    import os
    from app.services.evidence_service import EvidenceService
    from app.schemas.case import CaseCreate

    case_service = CaseService(db)
    ev_service = EvidenceService(db)
    analysis_service = CaseAnalysisService(db)

    from app.core.paths import EVIDENCE_DIR
    storage_ev_dir = str(EVIDENCE_DIR)

    test_definitions = [
        {
            "title": "Minh chứng biên lai thanh toán bị mờ thông tin (FACT_UNKNOWN)",
            "description": "Sinh viên gửi ảnh chụp màn hình chuyển khoản qua app ngân hàng bị mờ số tiền và mã giao dịch.",
            "student_identifier": "SV2026-001",
            "case_type": "TUITION_STATUS",
            "sis_amount": 10_500_000,
            "sis_status": "UNPAID",
            "file": "receipt_blurry.png",
            "evidence_type": "RECEIPT"
        },
        {
            "title": "Mâu thuẫn số tiền nộp 12.500.000 VNĐ vs Hệ thống SIS 10.500.000 VNĐ (DATA_CONFLICT)",
            "description": "Biên lai ngân hàng thể hiện số tiền 12.500.000 VNĐ nhưng hệ thống SIS chỉ ghi nhận nợ 10.500.000 VNĐ (lệch 2.000.000 VNĐ).",
            "student_identifier": "SV2026-001",
            "case_type": "TUITION_STATUS",
            "sis_amount": 10_500_000,
            "sis_status": "UNPAID",
            "file": "receipt_conflict.png",
            "evidence_type": "RECEIPT"
        },
        {
            "title": "Đơn xin mở khóa đăng ký tín chỉ học vụ ngoài quy chế (POLICY_OUT_OF_SCOPE)",
            "description": "Sinh viên nộp đơn xin đặc cách mở khóa đăng ký tín chỉ khi chưa thỏa mãn điều kiện tiên quyết theo quy chế hiện hành.",
            "student_identifier": "SV2026-001",
            "case_type": "REGISTRATION_BLOCK",
            "file": "sis_screenshot.png",
            "evidence_type": "SCREENSHOT"
        },
        {
            "title": "Hồ sơ mắc kẹt tranh chấp giữa Phòng Đào tạo và Phòng Kế toán (OWNERSHIP_UNCLEAR)",
            "description": "Sinh viên nộp đơn xin miễn giảm môn học và hoàn phí nhưng hai phòng ban đùn đẩy trách nhiệm giải quyết.",
            "student_identifier": "SV2026-001",
            "case_type": "CROSS_DEPARTMENT_DISPUTE",
            "file": "dispute_letter.png",
            "evidence_type": "DOCUMENT"
        },
        {
            "title": "Giao dịch đóng học phí 85.000.000 VNĐ vượt hạn mức AI 50 triệu (AUTHORITY_REQUIRED)",
            "description": "Sinh viên nộp học phí toàn khóa 85.000.000 VNĐ. Số tiền vượt quá hạn mức AI được phép tự động phê duyệt (tối đa 50 triệu).",
            "student_identifier": "SV2026-001",
            "case_type": "TUITION_STATUS",
            "sis_amount": 85_000_000,
            "sis_status": "UNPAID",
            "file": "receipt_high_value.png",
            "evidence_type": "RECEIPT"
        }
    ]

    created_cases = []
    for td in test_definitions:
        case = case_service.create_case(CaseCreate(
            title=td["title"],
            description=td["description"],
            student_identifier=td["student_identifier"],
            case_type=td["case_type"],
            sis_amount=td.get("sis_amount"),
            sis_status=td.get("sis_status"),
        ))

        file_path = os.path.join(storage_ev_dir, td["file"])
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                f_bytes = f.read()
            await ev_service.upload_evidence(
                case_id=case.id,
                original_filename=td["file"],
                content_type="image/png",
                file_bytes=f_bytes,
                evidence_type=td["evidence_type"],
                source_description="Minh chứng tệp kiểm thử tự động"
            )

        res = await analysis_service.analyze_case(case.id)
        created_cases.append({
            "case_id": case.id,
            "title": case.title,
            "decision": res.get("decision"),
            "escalation_type": res.get("escalation_type"),
            "question": res.get("question")
        })

    return {
        "status": "SUCCESS",
        "message": "Đã khởi tạo và phân tích thành công 5 ca kiểm thử chuẩn hóa.",
        "cases": created_cases
    }

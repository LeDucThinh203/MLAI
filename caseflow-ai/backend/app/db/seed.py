"""
SYNTHETIC HACKATHON SEED DATA
NOT AN OFFICIAL UNIVERSITY RECORD
"""
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.department import Department
from app.models.policy import Policy
from app.models.policy_rule import PolicyRule
from app.core.logging import logger

def seed_database(db: Optional[Session] = None):
    auto_close = False
    if db is None:
        db = SessionLocal()
        auto_close = True

    try:
        # 1. Seed Departments
        departments_data = [
            ("FINANCE", "Phòng Kế hoạch Tài chính", "Xử lý học phí, biên lai, hoàn trả và đối soát ngân hàng."),
            ("ACADEMIC_AFFAIRS", "Phòng Đào tạo", "Quản lý đăng ký tín chỉ, xét tốt nghiệp, thời khóa biểu và xử lý học vụ."),
            ("STUDENT_SERVICES", "Phòng Công tác Sinh viên", "Tiếp nhận hồ sơ tổng hợp, giấy xác nhận sinh viên, chế độ chính sách."),
            ("IT_SUPPORT", "Phòng Công nghệ Thông tin", "Hỗ trợ tài khoản SIS, hệ thống portal và các lỗi kỹ thuật."),
        ]

        for code, name, desc in departments_data:
            existing = db.query(Department).filter(Department.code == code).first()
            if not existing:
                dept = Department(
                    id=str(uuid.uuid4()),
                    code=code,
                    name=name,
                    description=desc,
                    is_active=True
                )
                db.add(dept)
                logger.info(f"Seeded department: {code}")

        # 2. Seed Synthetic Hackathon Policies
        tuition_policy = db.query(Policy).filter(Policy.code == "POL-TUITION").first()
        if not tuition_policy:
            tuition_policy = Policy(
                id=str(uuid.uuid4()),
                code="POL-TUITION",
                name="Quy chế Xác nhận và Đối soát Học phí Sinh viên (SYNTHETIC HACKATHON DATA)",
                description="Quy định xử lý tự động và leo thang khi sinh viên đóng học phí nhưng hệ thống chưa cập nhật.",
                version="1.0",
                is_active=True
            )
            db.add(tuition_policy)
            db.flush()

            rules = [
                PolicyRule(
                    id=str(uuid.uuid4()),
                    policy_id=tuition_policy.id,
                    rule_code="RULE-TUIT-001-AUTO",
                    name="Tự động cập nhật học phí khớp",
                    description="Nếu biên lai rõ ràng, ngân hàng hợp lệ, số tiền và mã SV khớp hoàn toàn với hệ thống, tự động cập nhật trạng thái PAID.",
                    condition_type="MATCH",
                    condition_value="amount_match == true AND student_match == true",
                    action="AUTO_RESOLVE",
                    priority=10
                ),
                PolicyRule(
                    id=str(uuid.uuid4()),
                    policy_id=tuition_policy.id,
                    rule_code="RULE-TUIT-002-CONFLICT",
                    name="Leo thang mâu thuẫn số tiền",
                    description="Nếu số tiền trên biên lai khác số tiền trên hệ thống SIS, dừng tự động hóa và chuyển cán bộ Tài chính xác nhận.",
                    condition_type="MISMATCH",
                    condition_value="amount_receipt != amount_system",
                    action="ESCALATE",
                    priority=5
                ),
            ]
            for r in rules:
                db.add(r)
            logger.info("Seeded Tuition Policy and Rules.")

        db.commit()
        logger.info("Seed data completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}")
        raise
    finally:
        if auto_close:
            db.close()

if __name__ == "__main__":
    seed_database()

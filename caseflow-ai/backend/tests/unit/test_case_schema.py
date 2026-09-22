import pytest
from pydantic import ValidationError

from app.schemas.case import CaseCreate


def test_tuition_case_requires_sis_snapshot():
    with pytest.raises(ValidationError):
        CaseCreate(
            title="Xác nhận học phí",
            description="Biên lai 8.200.000 VNĐ",
            student_identifier="SV123",
            case_type="TUITION_STATUS",
        )


def test_tuition_case_accepts_new_matching_sis_amount():
    case = CaseCreate(
        title="Xác nhận học phí",
        description="Biên lai 8.200.000 VNĐ",
        student_identifier="SV123",
        case_type="TUITION_STATUS",
        sis_amount=8_200_000,
        sis_status="UNPAID",
    )

    assert case.sis_amount == 8_200_000

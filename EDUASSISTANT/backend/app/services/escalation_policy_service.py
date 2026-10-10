"""
============================================================================
EDUASSISTANT - ADAPTIVE ESCALATION THRESHOLD & POLICY SERVICE
============================================================================
Quản lý ngưỡng tin cậy leo thang (Confidence Threshold) thích ứng theo
phản hồi của Chuyên viên thẩm định (Human-in-the-Loop Feedback):
  - Ngưỡng mặc định: 0.75
  - Giới hạn an toàn: [0.65, 0.90]
  - Bước nhảy thích ứng (Step size): 0.02
      * MISSED_ESCALATION: +0.02 (Thắt chặt tự động hóa, chuyển người duyệt)
      * UNNECESSARY_ESCALATION: -0.02 (Nới lỏng tự động hóa, giảm leo thang thừa)
      * CORRECT: Giữ nguyên
  - Bền vững (Persistence): Lưu trữ vào bảng escalation_policy_state và
    escalation_threshold_history trên PostgreSQL.
  - An toàn multi-worker & fail-safe khi mất kết nối CSDL tạm thời.
============================================================================
"""

import os
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

try:
    from app.db.database import get_db_connection, run_query, get_one, get_all
except ImportError:
    get_db_connection = None
    run_query = None
    get_one = None
    get_all = None

DEFAULT_THRESHOLD = 0.75
MIN_THRESHOLD = 0.65
MAX_THRESHOLD = 0.90
STEP_SIZE = 0.02
POLICY_ID = 'GLOBAL_NVQS_POLICY'

# In-memory fail-safe cache khi CSDL offline hoặc trong unit test mock
_fallback_threshold: float = DEFAULT_THRESHOLD
_fallback_history: List[Dict[str, Any]] = [
    {
        'id': 'INIT_DEFAULT',
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'oldThreshold': DEFAULT_THRESHOLD,
        'newThreshold': DEFAULT_THRESHOLD,
        'caseId': 'SYSTEM_INIT',
        'feedbackType': 'INITIALIZATION',
        'reviewerName': 'SYSTEM',
        'note': 'Khởi tạo ngưỡng tin cậy mặc định cho EDUASSISTANT Escalation Referee.'
    }
]


def get_confidence_threshold() -> float:
    """Lấy ngưỡng tin cậy leo thang hiện tại từ PostgreSQL (có cache fail-safe)."""
    global _fallback_threshold
    try:
        if get_one:
            row = get_one(
                "SELECT currentThreshold FROM escalation_policy_state WHERE id = %s",
                (POLICY_ID,)
            )
            if row and row.get('currentThreshold') is not None:
                val = float(row['currentThreshold'])
                _fallback_threshold = val
                return round(val, 4)
    except Exception:
        pass
    return round(_fallback_threshold, 4)


def set_confidence_threshold(
    value: float,
    actor: str = 'ADMIN',
    reason: str = 'Manual update',
    reviewer_id: Optional[str] = None
) -> float:
    """Cập nhật trực tiếp ngưỡng tin cậy (kẹp trong bounds [0.65, 0.90])."""
    global _fallback_threshold, _fallback_history
    old = get_confidence_threshold()
    clamped = max(MIN_THRESHOLD, min(MAX_THRESHOLD, float(value)))
    now_iso = datetime.now(timezone.utc).isoformat()
    record_id = 'HIST-' + secrets.token_hex(8)

    try:
        if run_query:
            run_query("""
                INSERT INTO escalation_policy_state (
                    id, currentThreshold, minThreshold, maxThreshold, stepSize, updatedAt, updatedBy
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    currentThreshold = EXCLUDED.currentThreshold,
                    updatedAt = EXCLUDED.updatedAt,
                    updatedBy = EXCLUDED.updatedBy
            """, (POLICY_ID, clamped, MIN_THRESHOLD, MAX_THRESHOLD, STEP_SIZE, now_iso, actor))

            run_query("""
                INSERT INTO escalation_threshold_history (
                    id, caseId, feedbackType, oldThreshold, newThreshold, reviewerId, reviewerName, note, createdAt
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (record_id, 'MANUAL_SET', 'MANUAL_OVERRIDE', old, clamped, reviewer_id or 'ADMIN', actor, reason, now_iso))
    except Exception:
        pass

    _fallback_threshold = clamped
    _fallback_history.append({
        'id': record_id,
        'createdAt': now_iso,
        'oldThreshold': round(old, 4),
        'newThreshold': round(clamped, 4),
        'caseId': 'MANUAL_OVERRIDE',
        'feedbackType': 'MANUAL_SET',
        'reviewerName': actor,
        'note': reason
    })
    return round(clamped, 4)


def get_threshold_history(limit: int = 50) -> List[Dict[str, Any]]:
    """Lấy toàn bộ lịch sử biến động ngưỡng leo thang từ PostgreSQL."""
    try:
        if get_all:
            rows = get_all(
                "SELECT * FROM escalation_threshold_history ORDER BY createdAt DESC LIMIT %s",
                (limit,)
            )
            if rows:
                return rows
    except Exception:
        pass
    return list(reversed(_fallback_history[-limit:]))


def _record_feedback_transaction(case_id: str, feedback_type: str, reviewer: str,
                                 reviewer_id: Optional[str], note: Optional[str]) -> Dict[str, Any]:
    """Persist one feedback decision and its history row in one PostgreSQL transaction.

    The row lock serializes competing reviewers; a failed history insert rolls the
    threshold update back with the transaction.
    """
    if not get_db_connection:
        raise RuntimeError('PostgreSQL connection is unavailable')
    now_iso = datetime.now(timezone.utc).isoformat()
    record_id = 'HIST-' + secrets.token_hex(8)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO escalation_policy_state
                    (id, currentThreshold, minThreshold, maxThreshold, stepSize, updatedAt, updatedBy)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (POLICY_ID, DEFAULT_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD, STEP_SIZE, now_iso, 'SYSTEM_INIT'))
            cur.execute("SELECT currentThreshold FROM escalation_policy_state WHERE id = %s FOR UPDATE", (POLICY_ID,))
            row = cur.fetchone()
            old = float(row['currentThreshold'])
            delta = STEP_SIZE if feedback_type == 'MISSED_ESCALATION' else (-STEP_SIZE if feedback_type == 'UNNECESSARY_ESCALATION' else 0)
            new = max(MIN_THRESHOLD, min(MAX_THRESHOLD, round(old + delta, 4)))
            reason = note or {
                'MISSED_ESCALATION': 'Missed escalation: tightened routing threshold by 0.02.',
                'UNNECESSARY_ESCALATION': 'Unnecessary escalation: relaxed routing threshold by 0.02.',
                'CORRECT': 'Correct system routing: threshold unchanged.'
            }[feedback_type]
            cur.execute("""
                UPDATE escalation_policy_state
                SET currentThreshold = %s, updatedAt = %s, updatedBy = %s
                WHERE id = %s
            """, (new, now_iso, reviewer, POLICY_ID))
            cur.execute("""
                INSERT INTO escalation_threshold_history
                    (id, caseId, feedbackType, oldThreshold, newThreshold, reviewerId, reviewerName, note, createdAt)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (record_id, case_id, feedback_type, old, new, reviewer_id, reviewer, reason, now_iso))
    return {'id': record_id, 'createdAt': now_iso, 'oldThreshold': round(old, 4),
            'newThreshold': round(new, 4), 'caseId': case_id,
            'feedbackType': feedback_type, 'reviewerName': reviewer, 'note': reason}


def record_reviewer_feedback(
    case_id: str,
    feedback_type: str,
    reviewer: str,
    note: Optional[str] = None,
    reviewer_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Tiếp nhận phản hồi từ thẩm định viên và cập nhật ngưỡng thích ứng:
      - MISSED_ESCALATION: Tăng 0.02 (tối đa 0.90)
      - UNNECESSARY_ESCALATION: Giảm 0.02 (tối thiểu 0.65)
      - CORRECT: Giữ nguyên
    """
    global _fallback_threshold, _fallback_history
    ft = (feedback_type or '').strip().upper()
    if ft not in ('CORRECT', 'MISSED_ESCALATION', 'UNNECESSARY_ESCALATION'):
        raise ValueError(f"Loại feedback không hợp lệ: {feedback_type}. Chỉ chấp nhận CORRECT, MISSED_ESCALATION, UNNECESSARY_ESCALATION.")

    # In production, do not degrade a failed transaction into an in-memory
    # success: callers must see the failure and no partial state is committed.
    if os.environ.get('DATABASE_URL', '').strip():
        record = _record_feedback_transaction(case_id, ft, reviewer, reviewer_id, note)
        _fallback_threshold = record['newThreshold']
        _fallback_history.append(record)
        return {
            'oldThreshold': record['oldThreshold'], 'newThreshold': record['newThreshold'],
            'feedback': ft, 'caseId': case_id, 'record': record
        }

    old_threshold = get_confidence_threshold()
    reason = note or ''

    if ft == 'MISSED_ESCALATION':
        new_threshold = min(MAX_THRESHOLD, round(old_threshold + STEP_SIZE, 4))
        if not reason:
            reason = 'Phát hiện bỏ sót leo thang (Missed Escalation) -> Nâng ngưỡng kiểm định an toàn +0.02'
    elif ft == 'UNNECESSARY_ESCALATION':
        new_threshold = max(MIN_THRESHOLD, round(old_threshold - STEP_SIZE, 4))
        if not reason:
            reason = 'Leo thang không cần thiết (Unnecessary Escalation) -> Hạ ngưỡng kiểm định -0.02'
    else:  # CORRECT
        new_threshold = old_threshold
        if not reason:
            reason = 'Phán quyết hệ thống chính xác -> Giữ nguyên ngưỡng kiểm định'

    now_iso = datetime.now(timezone.utc).isoformat()
    record_id = 'HIST-' + secrets.token_hex(8)

    try:
        if run_query:
            # Atomic update policy state
            run_query("""
                INSERT INTO escalation_policy_state (
                    id, currentThreshold, minThreshold, maxThreshold, stepSize, updatedAt, updatedBy
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    currentThreshold = EXCLUDED.currentThreshold,
                    updatedAt = EXCLUDED.updatedAt,
                    updatedBy = EXCLUDED.updatedBy
            """, (POLICY_ID, new_threshold, MIN_THRESHOLD, MAX_THRESHOLD, STEP_SIZE, now_iso, reviewer))

            # Insert threshold history log
            run_query("""
                INSERT INTO escalation_threshold_history (
                    id, caseId, feedbackType, oldThreshold, newThreshold, reviewerId, reviewerName, note, createdAt
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (record_id, case_id, ft, old_threshold, new_threshold, reviewer_id, reviewer, reason, now_iso))
    except Exception:
        pass

    _fallback_threshold = new_threshold
    record = {
        'id': record_id,
        'createdAt': now_iso,
        'oldThreshold': round(old_threshold, 4),
        'newThreshold': round(new_threshold, 4),
        'caseId': case_id,
        'feedbackType': ft,
        'reviewerName': reviewer,
        'note': reason
    }
    _fallback_history.append(record)

    return {
        'oldThreshold': round(old_threshold, 4),
        'newThreshold': round(new_threshold, 4),
        'feedback': ft,
        'caseId': case_id,
        'record': record
    }


def reset_threshold():
    """Khôi phục ngưỡng mặc định (dùng cho test suite / benchmark)."""
    global _fallback_threshold, _fallback_history
    _fallback_threshold = DEFAULT_THRESHOLD
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        if run_query:
            run_query("""
                UPDATE escalation_policy_state
                SET currentThreshold = %s, updatedAt = %s, updatedBy = 'TEST_RESET'
                WHERE id = %s
            """, (DEFAULT_THRESHOLD, now_iso, POLICY_ID))
    except Exception:
        pass

"""
============================================================================
EDUASSISTANT - SPRINT 2 & COMPETITION FEATURES TEST SUITE
============================================================================
Kiểm thử toàn diện 15 tiêu chí cho cuộc thi MLAI Hackathon:
 1. Valid evidence nhưng AI mock -> KHÔNG auto approve (ESCALATE_TO_HUMAN, FACT_UNKNOWN)
 2. Valid evidence nhưng AI cache -> KHÔNG auto approve
 3. Live fallback -> KHÔNG auto approve
 4. Unknown review action -> HTTP 400 INVALID_REVIEW_ACTION
 5. Override không reason -> HTTP 400 OVERRIDE_REASON_REQUIRED
 6. Override có reason -> status cập nhật, log audit HUMAN_OVERRIDE
 7. Invalid workflow transition -> bị chặn HTTP 400 INVALID_STATUS_TRANSITION
 8. Audit trail input và result được persist vào database và trả về qua API
 9. Verify Harness (/api/verify/run) -> deterministic PASS 100%
10. Adaptive threshold tăng khi MISSED_ESCALATION (+0.02)
11. Adaptive threshold giảm khi UNNECESSARY_ESCALATION (-0.02)
12. Threshold không vượt min/max ([0.65, 0.90])
13. Student không được submit reviewer feedback (HTTP 403)
14. Reviewer được submit reviewer feedback (HTTP 200)
15. Benchmark formulas tính toán chính xác
============================================================================
"""

import os
import sys
import time
import socket
import tempfile
import shutil
import secrets
import subprocess
import requests
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
backend_path = os.path.join(project_root, 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

passed_count = 0
failed_count = 0

def record_assertion(desc: str, passed: bool, extra_info: str = ""):
    global passed_count, failed_count
    if passed:
        passed_count += 1
        print(f"  ✅ PASS: {desc}", flush=True)
    else:
        failed_count += 1
        print(f"  ❌ FAIL: {desc} -> {extra_info}", flush=True)

def find_available_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def wait_for_server(base_url: str, timeout: float = 30.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{base_url}/api/health", timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    raise RuntimeError("Máy chủ Backend Python không sẵn sàng sau 30 giây.")


def require_isolated_test_environment():
    """Refuse to run unless the target is a disposable local PostgreSQL database."""
    required_environment = {
        'APP_ENV': 'test',
        'NODE_ENV': 'test',
        'AI_MODE': 'mock',
        'SEED_DEMO_DATA': 'true',
        'ALLOW_ADMIN_VERIFIED_DEMO_SIS': 'false',
    }
    for key, expected in required_environment.items():
        if os.environ.get(key, '').strip().lower() != expected:
            raise RuntimeError(f'{key} must be set to {expected} for competition integration tests.')
    if os.environ.get('GEMINI_API_KEY', '').strip() or os.environ.get('OPENROUTER_API_KEY', '').strip():
        raise RuntimeError('Live AI keys must be empty for competition integration tests.')

    database_url = os.environ.get('DATABASE_URL', '').strip()
    parsed = urlsplit(database_url)
    database_name = parsed.path.lstrip('/').lower()
    local_hosts = {'localhost', '127.0.0.1', '::1', 'postgres'}
    isolated_database = database_name == 'eduassistant_test' or database_name.endswith(('_test', '_test_db'))
    if parsed.scheme not in {'postgres', 'postgresql'} or parsed.hostname not in local_hosts or not isolated_database:
        raise RuntimeError('DATABASE_URL must point to a local, disposable PostgreSQL database ending in _test.')

def run_tests():
    require_isolated_test_environment()
    data_dir = tempfile.mkdtemp(prefix="eduassistant-competition-test-")
    port = find_available_port()
    base_url = f"http://127.0.0.1:{port}"

    os.environ['APP_ENV'] = 'test'
    os.environ['NODE_ENV'] = 'test'
    os.environ['PORT'] = str(port)
    os.environ['DATA_DIR'] = data_dir
    os.environ['AI_MODE'] = 'mock'
    os.environ['SEED_DEMO_DATA'] = 'true'
    os.environ['ALLOW_ADMIN_VERIFIED_DEMO_SIS'] = 'false'
    os.environ['GEMINI_API_KEY'] = ''
    os.environ['OPENROUTER_API_KEY'] = ''
    os.environ['JWT_SECRET'] = secrets.token_hex(32)
    os.environ['REFRESH_SECRET'] = secrets.token_hex(32)
    os.environ['SIGNATURE_KEY'] = secrets.token_hex(32)

    server_log_file = open(os.path.join(data_dir, 'server.log'), 'w', encoding='utf-8', errors='replace')
    server_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.server:app", "--port", str(port), "--host", "127.0.0.1"],
        cwd=project_root,
        env=os.environ.copy(),
        stdout=server_log_file,
        stderr=server_log_file
    )

    try:
        wait_for_server(base_url)
        print("=" * 70, flush=True)
        print("🏆 BẮT ĐẦU KIỂM THỬ TÍNH NĂNG COMPETITION-READY (EDUASSISTANT)", flush=True)
        print("=" * 70, flush=True)

        def login_user(username, password):
            s = requests.Session()
            r = s.post(f"{base_url}/api/login", json={"username": username, "password": password})
            res_data = (r.json().get("data") or {}) if r.status_code == 200 else {}
            csrf = res_data.get("csrfToken") or s.cookies.get("edu_csrf")
            if csrf:
                s.headers["X-CSRF-Token"] = csrf
            return s

        session_rev = login_user("reviewer1", "password123")
        session_adm = login_user("admin1", "password123")
        session_stu = login_user("student1", "password123")

        # ----------------------------------------------------
        # TEST 1, 2, 3: Rule engine fail-safe non-live AI
        # ----------------------------------------------------
        print("\n[TEST 1-3] Kiểm tra Fail-Safe: Mock / Cache / Fallback KHÔNG ĐƯỢC Auto-Approve", flush=True)
        from app.services.rule_engine import evaluate_case

        stu_user_dict = {
            "id": "SV001",
            "studentCode": "SV001",
            "fullName": "Nguyen Van A"
        }
        deterministic_test_context = {
            "evaluationMode": "DETERMINISTIC_TEST",
            "allowSyntheticVerifiedInstitutionalFacts": True,
            "allowSyntheticAIAnalysis": True,
        }

        valid_case_dict = {
            "title": "Đơn đề nghị cấp Giấy xác nhận tạm hoãn NVQS",
            "category": "MILITARY_SERVICE_CONFIRMATION",
            "studentId": "SV001",
            "studentName": "Nguyen Van A",
            "studentCode": "SV001",
            "priority": "MEDIUM",
            "description": "Kính đề nghị nhà trường cấp giấy xác nhận tạm hoãn NVQS",
            "studentClaim": {
                "declaredAddress": "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                "addressType": "PERMANENT"
            },
            "institutionalFacts": {
                "sourceType": "SYNTHETIC_TEST_SIS",
                "verificationStatus": "TEST_VERIFIED",
                "academicStatus": "ACTIVE",
                "courseStartDate": "2022-09-05",
                "courseEndDate": "2027-06-30",
                "currentTermActive": True,
                "hasCurrentSchedule": True,
                "studentCode": "SV001",
                "fullName": "Nguyen Van A",
                "registeredPermanentAddress": "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
            },
            "addressAnalysis": {
                "rawAddress": "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                "parsed": {
                    "houseNumber": "123",
                    "street": "Đường Lê Lợi",
                    "ward": "Phường Bến Nghé",
                    "district": "Quận 1",
                    "province": "TP. Hồ Chí Minh"
                },
                "normalized": "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                "missingFields": [],
                "isComplete": True,
                "confidence": 0.95
            },
            "evidenceFiles": [{
                "filename": "giay_xac_nhan.pdf",
                "ocrData": {
                    "studentId": "SV001",
                    "studentName": "Nguyen Van A",
                    "studentCode": "SV001",
                    "suggestedCategory": "MILITARY_SERVICE_CONFIRMATION",
                    "issuingAuthority": "ỦY BAN NHÂN DÂN QUẬN 1",
                    "certificateNumber": "UBND/2026/123",
                    "confidence": 0.95,
                    "confidenceScore": 0.95,
                    "tamperRisk": "LOW"
                },
                "ocrProvider": "Gemini-OCR",
                "ocrIsLive": False,
                "isFallback": False,
                "isSynthetic": True,
                "confidence": 0.95
            }]
        }

        # 1. Explicit mock provenance (no mutation of global AI mode)
        res_mock = evaluate_case(valid_case_dict, student_user=stu_user_dict, ai_context={
            "modeUsed": "mock", "isLive": False, "isFallback": False, "isSynthetic": True
        }, evaluation_context=deterministic_test_context)
        record_assertion(
            "Valid evidence nhưng AI mode=mock -> ESCALATE_TO_HUMAN & FACT_UNKNOWN",
            res_mock["decision"] == "ESCALATE_TO_HUMAN" and res_mock["escalationReason"] == "FACT_UNKNOWN" and "mock" in res_mock["explanation"].lower()
        )

        # 2. Explicit cache provenance
        res_cache = evaluate_case(valid_case_dict, student_user=stu_user_dict, ai_context={
            "modeUsed": "cache", "isLive": False, "isFallback": False, "isSynthetic": False
        }, evaluation_context=deterministic_test_context)
        record_assertion(
            "Valid evidence nhưng AI mode=cache -> ESCALATE_TO_HUMAN & FACT_UNKNOWN",
            res_cache["decision"] == "ESCALATE_TO_HUMAN" and res_cache["escalationReason"] == "FACT_UNKNOWN" and "cache" in res_cache["explanation"].lower()
        )

        # 3. Live mode but fallback occurred
        case_fallback = dict(valid_case_dict)
        case_fallback["aiMetadata"] = {"fallbackOccurred": True}
        res_fallback = evaluate_case(case_fallback, student_user=stu_user_dict, ai_context={
            "modeUsed": "live", "isLive": True, "isFallback": True, "isSynthetic": False
        }, evaluation_context=deterministic_test_context)
        record_assertion(
            "AI mode=live nhưng fallbackOccurred -> ESCALATE_TO_HUMAN & FACT_UNKNOWN",
            res_fallback["decision"] == "ESCALATE_TO_HUMAN" and res_fallback["escalationReason"] == "FACT_UNKNOWN"
        )

        # ----------------------------------------------------
        # TEST 4-6: Human Review actions, Override, Stop
        # ----------------------------------------------------
        print("\n[TEST 4-6] Kiểm tra Human Review Actions (OVERRIDE, STOP, Unknown Action)", flush=True)
        # Sinh viên 1 tạo một hồ sơ
        case_payload = {
            "title": "Đơn xin cấp Giấy xác nhận tạm hoãn NVQS",
            "category": "MILITARY_SERVICE_CONFIRMATION",
            "description": "Em làm đơn này xin nhà trường cấp giấy xác nhận tạm hoãn nghĩa vụ quân sự",
            "declaredAddress": "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
            "addressType": "PERMANENT",
            "priority": "MEDIUM",
            "evidenceFiles": []
        }
        res_create = session_stu.post(f"{base_url}/api/cases", json=case_payload)
        create_succeeded = res_create.status_code in (200, 201)
        created_resp = res_create.json() if create_succeeded else {}
        created_data = (created_resp.get("data") or {}) if isinstance(created_resp, dict) else {}
        cid = created_data.get("id") or (created_data.get("case", {}) or {}).get("id")
        record_assertion(
            "Student case creation returns HTTP 201 and persists against isolated PostgreSQL",
            res_create.status_code == 201 and bool(cid)
        )

        if cid:
            # 4. Unknown action -> HTTP 400
            bad_act = session_rev.post(f"{base_url}/api/cases/{cid}/review", json={"action": "MAGIC_APPROVE", "note": "demo"})
            record_assertion("Unknown review action bị từ chối 400 INVALID_REVIEW_ACTION", bad_act.status_code == 400 and "INVALID_REVIEW_ACTION" in bad_act.text)

            # 5. OVERRIDE không có overrideReason -> HTTP 400
            ov_no_reason = session_rev.post(f"{base_url}/api/cases/{cid}/review", json={"action": "OVERRIDE", "note": "Duyệt luôn"})
            record_assertion("OVERRIDE thiếu overrideReason bị từ chối 400 OVERRIDE_REASON_REQUIRED", ov_no_reason.status_code == 400 and "OVERRIDE_REASON_REQUIRED" in ov_no_reason.text)

            # 6. OVERRIDE hợp lệ có overrideReason -> Phê duyệt thành công và audit HUMAN_OVERRIDE
            override_reason = "Hội đồng khoa đã họp xem xét và đồng ý đặc cách"
            ov_valid = session_rev.post(f"{base_url}/api/cases/{cid}/review", json={
                "action": "OVERRIDE",
                "overrideDecision": "APPROVED",
                "overrideReason": override_reason,
                "note": "Phê duyệt đặc cách"
            })
            record_assertion("OVERRIDE có overrideReason được chấp thuận 200 OK", ov_valid.status_code == 200)

            # Kiểm tra audit log có HUMAN_OVERRIDE
            res_audits_raw = session_rev.get(f"{base_url}/api/audits").json()
            res_audits = (res_audits_raw.get("data") or {}).get("audits", []) if isinstance(res_audits_raw, dict) else []
            override_audit = next((a for a in res_audits if a.get("action") == "HUMAN_OVERRIDE" and a.get("caseId") == cid), None)
            override_input = (override_audit or {}).get("input") or {}
            override_actor = (override_audit or {}).get("actor") or {}
            record_assertion(
                "HUMAN_OVERRIDE audit contains reviewer identity, case, input, result, timestamp, and reason",
                bool(override_audit
                     and override_actor.get("id")
                     and override_actor.get("role") == "REVIEWER"
                     and override_audit.get("caseId") == cid
                     and override_audit.get("timestamp")
                     and override_input.get("humanAction") == "OVERRIDE"
                     and override_input.get("targetStatus") == "APPROVED"
                     and override_audit.get("result") == "OVERRIDDEN_TO_APPROVED"
                     and override_audit.get("reason") == override_reason)
            )

            # ----------------------------------------------------
            # TEST 7: Workflow Transition Guard
            # ----------------------------------------------------
            print("\n[TEST 7] Kiểm tra Bảo Vệ Trạng Thái Luồng Công Việc (Workflow Guard)", flush=True)
            bad_trans = session_rev.post(f"{base_url}/api/cases/{cid}/review", json={"action": "REJECT", "note": "Hủy duyệt"})
            record_assertion("Cố tình chuyển trạng thái từ terminal APPROVED bị chặn 400 INVALID_STATUS_TRANSITION", bad_trans.status_code == 400 and "INVALID_STATUS_TRANSITION" in bad_trans.text)

            # ----------------------------------------------------
            # TEST 8: Persist Audit input and result
            # ----------------------------------------------------
            print("\n[TEST 8] Kiểm tra Lưu Trữ & Trả Về Dữ Liệu Input + Result trong Audit Trail", flush=True)
            c2_response = session_stu.post(f"{base_url}/api/cases", json=case_payload)
            c2_succeeded = c2_response.status_code in (200, 201)
            c2_raw = c2_response.json() if c2_succeeded else {}
            c2_data = (c2_raw.get("data") or {}) if isinstance(c2_raw, dict) else {}
            c2_id = c2_data.get("id") or (c2_data.get("case", {}) or {}).get("id")
            record_assertion(
                "Second case creation returns HTTP 201 and persists for audit/feedback checks",
                c2_response.status_code == 201 and bool(c2_id)
            )
            if c2_id:
                stop_response = session_rev.post(f"{base_url}/api/cases/{c2_id}/review", json={"action": "STOP", "note": "Tạm dừng xử lý do phát hiện nghi vấn"})
                record_assertion("Reviewer STOP action succeeds", stop_response.status_code == 200)

                if stop_response.status_code == 200:
                    audits_list_raw = session_rev.get(f"{base_url}/api/audits").json()
                    audits_list = (audits_list_raw.get("data") or {}).get("audits", []) if isinstance(audits_list_raw, dict) else []
                    stop_audit = next((a for a in audits_list if a.get("caseId") == c2_id and a.get("action") == "CASE_STATUS_STOPPED"), None)
                    stop_input = (stop_audit or {}).get("input") or {}
                    stop_actor = (stop_audit or {}).get("actor") or {}
                    has_stop_audit_fields = bool(
                        stop_audit
                        and stop_actor.get("id")
                        and stop_actor.get("role") == "REVIEWER"
                        and stop_audit.get("caseId") == c2_id
                        and stop_audit.get("timestamp")
                        and stop_input.get("newStatus") == "STOPPED"
                        and stop_audit.get("result") == "SUCCESS"
                        and stop_audit.get("reason")
                    )
                    record_assertion(
                        "STOP audit contains reviewer identity, case, input, result, timestamp, and reason",
                        has_stop_audit_fields
                    )

        # ----------------------------------------------------
        # TEST 9: Verify Harness
        # ----------------------------------------------------
        print("\n[TEST 9] Kiểm tra Verify Harness Tự Động Cho Giám Khảo (/api/verify/run)", flush=True)
        r_ver = requests.post(f"{base_url}/api/verify/run")
        record_assertion("Endpoint /api/verify/run trả về HTTP 200 OK", r_ver.status_code == 200)
        v_res = r_ver.json()
        v_data = v_res.get("data", {}) if isinstance(v_res, dict) else {}
        total_v = v_data.get("total", 0)
        passed_v = v_data.get("passed", 0)
        failed_v = v_data.get("failed", 0)
        record_assertion(f"Verify Harness returns all 9 deterministic cases ({passed_v}/{total_v})", total_v == 9 and failed_v == 0 and passed_v == total_v)

        # ----------------------------------------------------
        # TEST 10-12: Adaptive Escalation Threshold
        # ----------------------------------------------------
        print("\n[TEST 10-12] Kiểm tra Adaptive Escalation Threshold Service", flush=True)
        from app.services.escalation_policy_service import (
            get_confidence_threshold,
            record_reviewer_feedback,
            reset_threshold,
            MIN_THRESHOLD,
            MAX_THRESHOLD
        )
        reset_threshold()
        init_t = get_confidence_threshold()
        record_assertion("Ngưỡng tin cậy ban đầu là 0.75", abs(init_t - 0.75) < 1e-4)

        # 10. MISSED_ESCALATION -> +0.02
        record_reviewer_feedback(case_id="CASE-TEST-1", feedback_type="MISSED_ESCALATION", reviewer="rev1", note="Hệ thống đã tự duyệt sai")
        t_missed = get_confidence_threshold()
        record_assertion("Ngưỡng tăng +0.02 sau MISSED_ESCALATION (0.75 -> 0.77)", abs(t_missed - 0.77) < 1e-4)

        # 11. UNNECESSARY_ESCALATION -> -0.02
        record_reviewer_feedback(case_id="CASE-TEST-2", feedback_type="UNNECESSARY_ESCALATION", reviewer="rev1", note="Ca này đơn giản đáng lẽ duyệt tự động")
        t_unnec = get_confidence_threshold()
        record_assertion("Ngưỡng giảm -0.02 sau UNNECESSARY_ESCALATION (0.77 -> 0.75)", abs(t_unnec - 0.75) < 1e-4)

        # 12. Clamp bounds [0.65, 0.90]
        for _ in range(20):
            record_reviewer_feedback(case_id="CASE-TEST-CLAMP", feedback_type="MISSED_ESCALATION", reviewer="rev1")
        t_max = get_confidence_threshold()
        record_assertion(f"Ngưỡng không vượt quá MAX ({MAX_THRESHOLD}) khi tăng liên tục (Giá trị: {t_max})", abs(t_max - MAX_THRESHOLD) < 1e-4)

        for _ in range(30):
            record_reviewer_feedback(case_id="CASE-TEST-CLAMP", feedback_type="UNNECESSARY_ESCALATION", reviewer="rev1")
        t_min = get_confidence_threshold()
        record_assertion(f"Ngưỡng không thấp hơn MIN ({MIN_THRESHOLD}) khi giảm liên tục (Giá trị: {t_min})", abs(t_min - MIN_THRESHOLD) < 1e-4)

        # Reset về mặc định
        reset_threshold()

        # ----------------------------------------------------
        # TEST 13-14: Reviewer Feedback Endpoint RBAC
        # ----------------------------------------------------
        print("\n[TEST 13-14] Kiểm tra Reviewer Feedback Endpoint & Phân Quyền RBAC", flush=True)
        from app.db.database import get_all, get_one
        if cid and c2_id:
            # Sinh viên gọi feedback -> 403
            fb_stu = session_stu.post(f"{base_url}/api/cases/{c2_id}/feedback", json={
                "type": "CORRECT",
                "note": "Sinh viên cố tình đánh giá quyết định của mình"
            })
            record_assertion("Sinh viên (STUDENT) bị từ chối 403 khi gửi reviewer feedback", fb_stu.status_code == 403)

            # Reviewer gọi feedback -> 200
            fb_rev = session_rev.post(f"{base_url}/api/cases/{c2_id}/feedback", json={
                "type": "CORRECT",
                "note": "Quyết định chuyển trạng thái của hệ thống rất chuẩn xác"
            })
            record_assertion("Cán bộ (REVIEWER) gửi feedback thành công 200 OK", fb_rev.status_code == 200)

            if fb_rev.status_code == 200:
                reviewer_record = get_one("SELECT * FROM users WHERE username = %s", ("reviewer1",)) or {}
                persisted_feedback = get_one(
                    "SELECT * FROM escalation_threshold_history WHERE caseId = %s AND feedbackType = %s ORDER BY createdAt DESC LIMIT 1",
                    (c2_id, 'CORRECT')
                )
                record_assertion(
                    "Feedback history persists case, type, threshold values, reviewer, note, and timestamp",
                    bool(persisted_feedback
                         and persisted_feedback.get('caseId') == c2_id
                         and persisted_feedback.get('feedbackType') == 'CORRECT'
                         and persisted_feedback.get('reviewerId') == reviewer_record.get('id')
                         and persisted_feedback.get('reviewerName') == reviewer_record.get('fullName')
                         and persisted_feedback.get('note')
                         and persisted_feedback.get('createdAt')
                         and persisted_feedback.get('oldThreshold') == persisted_feedback.get('newThreshold'))
                )
                audit_response = session_rev.get(f"{base_url}/api/audits")
                feedback_audits = (audit_response.json().get('data') or {}).get('audits', []) if audit_response.ok else []
                feedback_audit = next((item for item in feedback_audits
                                       if item.get('caseId') == c2_id
                                       and item.get('action') == 'REVIEWER_FEEDBACK_SUBMITTED'), None)
                feedback_input = (feedback_audit or {}).get('input') or {}
                feedback_actor = (feedback_audit or {}).get('actor') or {}
                record_assertion(
                    "Reviewer feedback audit persists actor ID/role, case, feedback input, result, and timestamp",
                    bool(feedback_audit
                         and feedback_actor.get('id') == reviewer_record.get('id')
                         and feedback_actor.get('role') == 'REVIEWER'
                         and feedback_audit.get('caseId') == c2_id
                         and feedback_audit.get('timestamp')
                         and feedback_input.get('feedbackType') == 'CORRECT'
                         and feedback_input.get('note') == "Quyết định chuyển trạng thái của hệ thống rất chuẩn xác"
                         and feedback_input.get('oldThreshold') == feedback_input.get('newThreshold')
                         and feedback_audit.get('result') == 'SUCCESS')
                )

                policy_response = session_adm.get(f"{base_url}/api/admin/policies")
                policy_data = (policy_response.json().get('data') or {}) if policy_response.ok else {}
                threshold_history = policy_data.get('thresholdHistory') or []
                record_assertion(
                    "Admin policy endpoint exposes the persisted feedback threshold history",
                    any(item.get('caseId') == c2_id and item.get('feedbackType') == 'CORRECT'
                        and item.get('reviewerId') for item in threshold_history)
                )
        else:
            # Do not turn a failed/missing case creation into a cascade of
            # unrelated downstream API assertion failures.
            print("  SKIP: feedback API checks need both created case IDs.", flush=True)

        reset_threshold()
        concurrent_count = 8
        concurrent_prefix = f'CASE-CONCURRENT-{secrets.token_hex(4)}-'
        def concurrent_missed_feedback(index):
            return record_reviewer_feedback(
                case_id=f'{concurrent_prefix}{index}',
                feedback_type='MISSED_ESCALATION',
                reviewer='competition-test-reviewer',
                reviewer_id='competition-test-reviewer-id',
            )
        with ThreadPoolExecutor(max_workers=concurrent_count) as executor:
            concurrent_results = list(executor.map(concurrent_missed_feedback, range(concurrent_count)))
        final_threshold = get_confidence_threshold()
        concurrent_history = get_all(
            "SELECT * FROM escalation_threshold_history WHERE caseId LIKE %s AND feedbackType = %s",
            (f'{concurrent_prefix}%', 'MISSED_ESCALATION')
        )
        expected_old_thresholds = [0.75, 0.77, 0.79, 0.81, 0.83, 0.85, 0.87, 0.89]
        expected_new_thresholds = [0.77, 0.79, 0.81, 0.83, 0.85, 0.87, 0.89, 0.90]
        actual_old_thresholds = sorted(round(float(item['oldThreshold']), 2) for item in concurrent_history)
        actual_new_thresholds = sorted(round(float(item['newThreshold']), 2) for item in concurrent_history)
        record_assertion(
            "Concurrent reviewer feedback preserves every bounded, valid threshold transition",
            len(concurrent_results) == concurrent_count
            and abs(final_threshold - MAX_THRESHOLD) < 1e-4
            and len(concurrent_history) == concurrent_count
            and len({item.get('caseId') for item in concurrent_history}) == concurrent_count
            and actual_old_thresholds == expected_old_thresholds
            and actual_new_thresholds == expected_new_thresholds
            and all(
                MIN_THRESHOLD <= item['oldThreshold'] <= MAX_THRESHOLD
                and MIN_THRESHOLD <= item['newThreshold'] <= MAX_THRESHOLD
                and 0 < item['newThreshold'] - item['oldThreshold'] <= 0.02
                and item.get('reviewerId') == 'competition-test-reviewer-id'
                and item.get('reviewerName') == 'competition-test-reviewer'
                and item.get('note')
                and item.get('createdAt')
                for item in concurrent_history
            )
        )
        reset_threshold()

        # ----------------------------------------------------
        # TEST 15: Benchmark Formulas Correctness
        # ----------------------------------------------------
        print("\n[TEST 15] Kiểm tra Tính Toán Chỉ Số Fixed Synthetic Benchmark", flush=True)
        from benchmark.run_benchmark import run_benchmark
        bench_result = run_benchmark()
        m = bench_result["metrics"]
        
        # Verify formula rules
        total = m["totalCases"]
        correct = m["correctCases"]
        expected_accuracy = (correct / total) * 100 if total > 0 else 0
        formula_acc_ok = abs(m["decisionAccuracy"] - expected_accuracy) < 0.01

        expected_escalations = sum(item['expectedDecision'] == 'ESCALATE_TO_HUMAN' for item in bench_result['results'])
        expected_auto_approvals = sum(item['expectedDecision'] == 'AUTO_APPROVE' for item in bench_result['results'])
        raw_counts_ok = (
            m['expectedEscalations'] == expected_escalations
            and m['expectedAutoApprovals'] == expected_auto_approvals
            and m['missedEscalationCount'] == sum(
                item['expectedDecision'] == 'ESCALATE_TO_HUMAN' and item['actualDecision'] == 'AUTO_APPROVE'
                for item in bench_result['results'])
            and m['unnecessaryEscalationCount'] == sum(
                item['expectedDecision'] == 'AUTO_APPROVE' and item['actualDecision'] == 'ESCALATE_TO_HUMAN'
                for item in bench_result['results'])
        )
        record_assertion("Benchmark runner evaluates the fixed 18-case dataset without AI", total == 18 and bench_result['aiCallsPerformed'] is False)
        record_assertion("Công thức Decision Accuracy chính xác theo tỷ lệ trường hợp đúng", formula_acc_ok)
        missed_rate = (m['missedEscalationCount'] / m['expectedEscalations'] * 100) if m['expectedEscalations'] else 0.0
        unnecessary_rate = (m['unnecessaryEscalationCount'] / m['expectedAutoApprovals'] * 100) if m['expectedAutoApprovals'] else 0.0
        formulas_ok = abs(m['missedEscalationRate'] - missed_rate) < 0.01 and abs(m['unnecessaryEscalationRate'] - unnecessary_rate) < 0.01
        record_assertion("Missed and unnecessary escalation counts retain the correct denominators and rates", raw_counts_ok and formulas_ok)

    finally:
        if server_process.poll() is None:
            server_process.terminate()
            try:
                server_process.wait(timeout=5)
            except Exception:
                server_process.kill()
        server_log_file.close()
        try:
            with open(os.path.join(data_dir, 'server.log'), 'r', encoding='utf-8', errors='replace') as lf:
                log_content = lf.read()
                print("\n[SERVER LOG EXCERPT]:\n" + log_content[-2500:], flush=True)
        except Exception:
            pass
        shutil.rmtree(data_dir, ignore_errors=True)

    print("\n" + "=" * 70, flush=True)
    print(f"🎉 TỔNG KẾT TEST COMPETITION: {passed_count} PASSED | {failed_count} FAILED", flush=True)
    print("=" * 70, flush=True)
    if failed_count > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()

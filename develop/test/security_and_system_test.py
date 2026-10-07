"""
============================================================================
CASEFLOW AI - SECURITY & SYSTEM TEST SUITE (PYTHON MODULE)
============================================================================
Bộ kiểm thử bảo mật tự động 40 tiêu chí:
  - Xác thực JWT, mật khẩu băm Bcrypt, Rate Limiting
  - Chống lỗ hổng Broken Access Control (IDOR Guard)
  - Bảo vệ quyền riêng tư & cô lập nhật ký kiểm toán (Audit Trail)
  - Xác thực 2 bước (2FA TOTP No-Backdoor)
  - Xoay vòng & thu hồi Refresh Token (Token Rotation)
  - Chặn tự động duyệt khi chạy Mock / thiếu minh chứng
  - Chống tệp giả mạo Magic Bytes & quét mã độc PDF
  - Chặn thao tác khi chưa đổi mật khẩu bắt buộc (mustChangePassword)
============================================================================
"""

import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import time
import json
import io
import secrets
import requests
import pyotp
import bcrypt
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.database import run_query, DB_PATH
from shared.upload_service import validate_file_buffer
from shared.db import db_service

def get_base_url():
    return f"{os.environ.get('TEST_BASE_URL', 'http://localhost:3001')}/api"

passed = 0
failed = 0


def assert_test(condition: bool, message: str):
    global passed, failed
    if condition:
        print(f"  ✅ PASS: {message}")
        passed += 1
    else:
        print(f"  ❌ FAIL: {message}")
        failed += 1


def api_req(path: str, method: str = 'GET', headers: dict = None, data: dict = None, files: dict = None):
    url = f"{get_base_url()}{path}"
    h = headers.copy() if headers else {}
    if data is not None and not files:
        h['Content-Type'] = 'application/json'
        payload = json.dumps(data)
    else:
        payload = data

    if method == 'GET':
        res = requests.get(url, headers=h)
    elif method == 'POST':
        if files:
            res = requests.post(url, headers=h, files=files, data=payload)
        else:
            res = requests.post(url, headers=h, data=payload)
    elif method == 'PUT':
        res = requests.put(url, headers=h, data=payload)
    elif method == 'DELETE':
        res = requests.delete(url, headers=h, data=payload)
    else:
        raise ValueError(f"Unsupported method {method}")

    try:
        json_data = res.json()
    except Exception:
        json_data = res.text

    return {'status': res.status_code, 'headers': res.headers, 'data': json_data}


def upload_test_evidence(token: str):
    img = Image.new('RGB', (2, 2), color=(40, 120, 200))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    files = {'evidence': ('private-evidence.png', buf, 'image/png')}
    headers = {'Authorization': f"Bearer {token}"}
    return api_req('/upload/evidence', method='POST', headers=headers, files=files)


def run_security_test_suite():
    global passed, failed
    passed = 0
    failed = 0

    print("═══════════════════════════════════════════════════════════════")
    print("🛡️ CASEFLOW AI ENTERPRISE SECURITY & ASSERTION TEST SUITE (PYTHON)")
    print("═══════════════════════════════════════════════════════════════\n")

    # 1. Test Authentication & Bcrypt Verification
    print("[TEST 1] Xác thực tài khoản & Băm mật khẩu Bcrypt:")
    student1_login = api_req('/login', 'POST', data={'username': 'student1', 'password': 'password123'})
    assert_test(student1_login['status'] == 200, "Đăng nhập student1 với mật khẩu đúng thành công (200 OK)")
    token_obj = student1_login['data'].get('data', {}) if isinstance(student1_login['data'], dict) else {}
    assert_test(bool(token_obj.get('token') or token_obj.get('accessToken')), "Nhận JWT Access Token hợp lệ")
    assert_test(bool(token_obj.get('refreshToken')), "Nhận Refresh Token hợp lệ")
    student1_token = token_obj.get('token') or token_obj.get('accessToken')
    student1_refresh_token = token_obj.get('refreshToken')
    student1_id = token_obj.get('user', {}).get('id')

    wrong_login = api_req('/login', 'POST', data={'username': 'student1', 'password': 'wrongPassword123'})
    assert_test(wrong_login['status'] == 401, "Mật khẩu sai bị từ chối 401 Unauthorized")

    reviewer_login = api_req('/login', 'POST', data={'username': 'reviewer1', 'password': 'password123'})
    assert_test(reviewer_login['status'] == 200, "Đăng nhập reviewer1 thành công")
    reviewer_token = reviewer_login['data']['data']['token']

    # 2. Register Student 2
    print("\n[TEST 2] Tạo tài khoản Student 2 phục vụ kiểm thử IDOR:")
    rand_user = f"test_student_{int(time.time())}_{secrets.token_hex(2)}"
    student2_reg = api_req('/register', 'POST', data={
        'username': rand_user,
        'password': 'password123',
        'fullName': 'Sinh Viên Test 2',
        'studentCode': 'SV2026-7777',
        'department': 'Khoa Mạng Máy Tính'
    })
    assert_test(student2_reg['status'] == 201, "Đăng ký tài khoản Sinh viên 2 thành công")
    student2_token = student2_reg['data']['data']['token']
    student2_id = student2_reg['data']['data']['user']['id']

    uploaded_evidence = upload_test_evidence(student2_token)
    assert_test(uploaded_evidence['status'] == 201, "Sinh viên tải lên minh chứng thật thành công")

    case2_creation = api_req('/cases', 'POST', headers={'Authorization': f"Bearer {student2_token}"}, data={
        'title': 'Đơn xin miễn giảm học phí của Sinh Viên 2',
        'category': 'TUITION_DISCOUNT',
        'priority': 'MEDIUM',
        'description': 'Đơn cá nhân của sinh viên 2 cần bảo mật tuyệt đối.',
        'evidenceFiles': [uploaded_evidence['data']['data']]
    })
    assert_test(case2_creation['status'] == 201, f"Sinh viên 2 tạo hồ sơ bảo mật thành công (Status: {case2_creation['status']})")
    case2_id = case2_creation['data']['data']['id']

    # 3. IDOR Protection Tests
    print("\n[TEST 3] Kiểm tra Chống Lỗ Hổng Phân Quyền IDOR (Broken Access Control):")
    student1_cases = api_req('/cases', 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    assert_test(student1_cases['status'] == 200, "Student 1 lấy danh sách hồ sơ (200 OK)")
    c_list = student1_cases['data'].get('data', {}).get('cases', []) if isinstance(student1_cases['data'].get('data'), dict) else (student1_cases['data'].get('data') or [])
    contains_case2 = any(c.get('id') == case2_id for c in c_list)
    assert_test(not contains_case2, "Sinh viên 1 KHÔNG THỂ nhìn thấy hồ sơ của Sinh viên 2 trong GET /api/cases")

    student1_tamper_cases = api_req(f"/cases?studentId={student2_id}", 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    tamper_list = student1_tamper_cases['data'].get('data', {}).get('cases', []) if isinstance(student1_tamper_cases['data'].get('data'), dict) else (student1_tamper_cases['data'].get('data') or [])
    tamper_contains_case2 = any(c.get('id') == case2_id for c in tamper_list)
    assert_test(not tamper_contains_case2, "Hệ thống bỏ qua query studentId do client truyền và ép buộc chỉ trả về đơn của chính mình")

    direct_case_access = api_req(f"/cases/{case2_id}", 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    assert_test(direct_case_access['status'] == 403, f"Sinh viên 1 truy cập trực tiếp #{case2_id} bị chặn 403 FORBIDDEN")

    export_decision_access = api_req(f"/cases/{case2_id}/export-decision", 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    assert_test(export_decision_access['status'] == 403, "Sinh viên 1 tải quyết định của Sinh viên 2 bị chặn 403 FORBIDDEN")

    comments_access = api_req(f"/cases/{case2_id}/comments", 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    assert_test(comments_access['status'] == 403, "Sinh viên 1 đọc bình luận trên hồ sơ của Sinh viên 2 bị chặn 403 FORBIDDEN")

    file_name = uploaded_evidence['data']['data']['fileName']
    file_access = api_req(f"/evidence/{file_name}", 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    assert_test(file_access['status'] == 403, "Sinh viên 1 tải tệp minh chứng của Sinh viên 2 bị chặn 403 FORBIDDEN")

    reviewer_access = api_req(f"/cases/{case2_id}", 'GET', headers={'Authorization': f"Bearer {reviewer_token}"})
    assert_test(reviewer_access['status'] == 200, "Cán bộ thẩm định (REVIEWER) có quyền truy cập hồ sơ để xử lý")

    # 4. Audit Trail Isolation
    print("\n[TEST 4] Kiểm tra Phân Quyền & Cô Lập Nhật Ký Audit Trail:")
    student1_audits = api_req('/audits', 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    a_list = student1_audits['data'].get('data', {}).get('audits', []) if isinstance(student1_audits['data'].get('data'), dict) else (student1_audits['data'].get('data') or [])
    has_student2_audits = any(
        (bool(case2_id) and a.get('caseId') == case2_id) or 
        (bool(student2_id) and a.get('actor', {}).get('id') and a.get('actor', {}).get('id') == student2_id)
        for a in a_list
    )
    assert_test(not has_student2_audits, "Sinh viên 1 KHÔNG THỂ nhìn thấy nhật ký hành động hoặc hồ sơ của Sinh viên 2")

    reviewer_audits = api_req('/audits', 'GET', headers={'Authorization': f"Bearer {reviewer_token}"})
    assert_test(reviewer_audits['status'] == 200, "Cán bộ thẩm định xem được toàn bộ Audit Trail toàn trường")

    # 5. 2FA Security & Backdoor Removal
    print("\n[TEST 5] Kiểm tra Cơ Chế Xác Thực 2 Bước (2FA - Xóa Bỏ Hoàn Toàn Backdoor):")
    gen_2fa = api_req('/auth/2fa/generate', 'POST', headers={'Authorization': f"Bearer {student2_token}"})
    assert_test(gen_2fa['status'] == 200, "Tạo mã bí mật 2FA TOTP thành công")
    secret_2fa = gen_2fa['data']['data']['secret']

    backdoor_enable = api_req('/auth/2fa/enable', 'POST', headers={'Authorization': f"Bearer {student2_token}"}, data={'otpCode': '123456'})
    assert_test(backdoor_enable['status'] == 400, "Mã backdoor 123456 bị từ chối 400 Bad Request")

    backdoor_enable2 = api_req('/auth/2fa/enable', 'POST', headers={'Authorization': f"Bearer {student2_token}"}, data={'otpCode': '888888'})
    assert_test(backdoor_enable2['status'] == 400, "Mã backdoor 888888 bị từ chối 400 Bad Request")

    real_otp = pyotp.TOTP(secret_2fa).now()
    real_enable = api_req('/auth/2fa/enable', 'POST', headers={'Authorization': f"Bearer {student2_token}"}, data={'otpCode': real_otp})
    assert_test(real_enable['status'] == 200, "Kích hoạt 2FA thành công bằng mã TOTP thực tế")

    # 6. Refresh Token Rotation
    print("\n[TEST 6] Kiểm tra Xoay Vòng & Thu Hồi Refresh Token (Rotation & Revocation):")
    refresh_result = api_req('/auth/refresh', 'POST', data={'refreshToken': student1_refresh_token})
    assert_test(refresh_result['status'] == 200, "Làm mới Access Token & cấp Refresh Token mới thành công")
    assert_test(bool(refresh_result['data']['data'].get('refreshToken')), "Nhận Refresh Token mới xoay vòng")

    reuse_result = api_req('/auth/refresh', 'POST', data={'refreshToken': student1_refresh_token})
    assert_test(reuse_result['status'] == 401, "Refresh Token cũ đã bị hủy và không thể tái sử dụng (Token Reuse Prevention)")

    # 7. AI Auto-Approve Safety Guard
    print("\n[TEST 7] Kiểm tra Chặn Tự Động Duyệt Khi Chạy Mock / Thiếu Minh Chứng:")
    mock_case = api_req('/cases', 'POST', headers={'Authorization': f"Bearer {student1_token}"}, data={
        'title': 'Đơn xin miễn giảm học phí chưa qua AI live',
        'category': 'TUITION_DISCOUNT',
        'description': 'Đơn thử nghiệm kiểm tra tính an toàn của Rule Engine',
        'evidenceFiles': []
    })
    assert_test(mock_case['status'] == 201, "Tạo đơn thành công")
    m_case_obj = mock_case['data']['data']
    assert_test(m_case_obj.get('status') == 'UNDER_REVIEW', "Đơn thiếu minh chứng KHÔNG được tự động duyệt, chuyển vào UNDER_REVIEW")
    assert_test(m_case_obj.get('escalation', {}).get('reason') == 'FACT_UNKNOWN', "Gán chính xác lý do leo thang FACT_UNKNOWN")

    unapproved_verification = api_req(f"/cases/verify/{m_case_obj['id']}", 'GET')
    assert_test(unapproved_verification['status'] == 200 and unapproved_verification['data']['data']['verified'] is False,
                "Tra cứu QR không xác nhận hồ sơ chưa được duyệt")

    approve_for_signature = api_req(f"/cases/{m_case_obj['id']}/review", 'POST', headers={'Authorization': f"Bearer {reviewer_token}"}, data={
        'action': 'APPROVE', 'reason': 'Đã kiểm tra hồ sơ trong test'
    })
    assert_test(approve_for_signature['status'] == 200, "Reviewer phê duyệt hồ sơ kiểm thử để ký số")

    approved_verification = api_req(f"/cases/verify/{m_case_obj['id']}", 'GET')
    assert_test(approved_verification['status'] == 200 and approved_verification['data']['data']['verified'] is True,
                "Tra cứu QR xác minh chữ ký đúng của hồ sơ đã duyệt")

    run_query("UPDATE cases SET digitalSignature = ? WHERE id = ?", ('0' * 64, m_case_obj['id']))
    tampered_verification = api_req(f"/cases/verify/{m_case_obj['id']}", 'GET')
    assert_test(tampered_verification['status'] == 200 and tampered_verification['data']['data']['verified'] is False,
                "Tra cứu QR từ chối chữ ký số bị sửa")

    student_ai_status = api_req('/ai/status', 'GET', headers={'Authorization': f"Bearer {student1_token}"})
    assert_test(student_ai_status['status'] == 403, "Trạng thái cấu hình AI chỉ dành cho ADMIN")

    admin_login = api_req('/login', 'POST', data={'username': 'admin1', 'password': 'password123'})
    admin_ai_status = api_req('/ai/status', 'GET', headers={'Authorization': f"Bearer {admin_login['data']['data']['token']}"})
    assert_test(admin_ai_status['status'] == 200 and 'maskedKey' not in admin_ai_status['data']['data'],
                "Endpoint AI không tiết lộ một phần API key")

    # 8. Deep File & PDF Validation Security Tests
    print("\n[TEST 8] Kiểm tra Chống Tệp Giả Mạo & Quét Mã Độc PDF:")
    fake_buf = b"This is a plain text file disguised as pdf"
    fake_check = validate_file_buffer(fake_buf)
    assert_test(not fake_check['valid'], "Tệp giả mạo phần mở rộng bị từ chối")

    broken_pdf_buf = b"%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj"
    broken_check = validate_file_buffer(broken_pdf_buf)
    assert_test(not broken_check['valid'] and '%%EOF' in str(broken_check.get('error')), "Tệp PDF bị hỏng hoặc thiếu %%EOF bị từ chối")

    malicious_pdf_buf = b"%PDF-1.4\n1 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert(1)) >>\nendobj\n%%EOF"
    mal_check = validate_file_buffer(malicious_pdf_buf)
    assert_test(not mal_check['valid'] and '/JavaScript' in str(mal_check.get('error')), "Tệp PDF chứa mã lệnh /JavaScript bị chặn")

    # 9. mustChangePassword Enforcement Test
    print("\n[TEST 9] Kiểm tra Chặn Thao Tác Khi Chưa Đổi Mật Khẩu Bắt Buộc (mustChangePassword):")
    temp_user_req = api_req('/register', 'POST', data={
        'username': f"must_change_{int(time.time())}",
        'password': 'password123',
        'fullName': 'Test Must Change',
        'role': 'STUDENT',
        'mustChangePassword': True
    })
    assert_test(temp_user_req['status'] == 201, "Đăng ký người dùng với cờ mustChangePassword thành công")
    must_change_user = temp_user_req['data']['data']['user']
    assert_test(must_change_user['mustChangePassword'] is True, "Cờ mustChangePassword được trả về chính xác")
    must_change_token = temp_user_req['data']['data']['token']

    blocked_action = api_req('/cases', 'POST', headers={'Authorization': f"Bearer {must_change_token}"}, data={
        'title': 'Đơn bị chặn do chưa đổi mật khẩu',
        'category': 'TUITION_DISCOUNT',
        'description': 'Hành động này phải bị chặn bởi middleware bảo vệ.'
    })
    assert_test(blocked_action['status'] == 403 and blocked_action['data'].get('error') == 'PASSWORD_CHANGE_REQUIRED',
                "Hành động tạo đơn bị chặn 403 FORBIDDEN (PASSWORD_CHANGE_REQUIRED)")

    print("\n═══════════════════════════════════════════════════════════════")
    print(f"🎉 KẾT QUẢ KIỂM THỬ: {passed} PASSED | {failed} FAILED")
    print("═══════════════════════════════════════════════════════════════")

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    run_security_test_suite()

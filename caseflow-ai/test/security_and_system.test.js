const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

const BASE_URL = `${process.env.TEST_BASE_URL || 'http://localhost:3001'}/api`;

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    const res = await fetch(url, {
        ...options,
        headers
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return { status: res.status, headers: res.headers, data };
}

async function uploadEvidence(token) {
    const png = await sharp({
        create: { width: 2, height: 2, channels: 3, background: { r: 40, g: 120, b: 200 } }
    }).png().toBuffer();
    const form = new FormData();
    form.append('evidence', new Blob([png], { type: 'image/png' }), 'private-evidence.png');
    const res = await fetch(`${BASE_URL}/upload/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
    });
    const text = await res.text();
    return { status: res.status, data: JSON.parse(text) };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

async function runSecurityTestSuite() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🛡️ CASEFLOW AI ENTERPRISE SECURITY & ASSERTION TEST SUITE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Test Authentication & Bcrypt Verification
    console.log('[TEST 1] Xác thực tài khoản & Băm mật khẩu Bcrypt:');
    const student1Login = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'student1', password: 'password123' })
    });
    assert(student1Login.status === 200, 'Đăng nhập student1 với mật khẩu đúng thành công (200 OK)');
    assert(!!student1Login.data.data?.token, 'Nhận JWT Access Token hợp lệ');
    assert(!!student1Login.data.data?.refreshToken, 'Nhận Refresh Token hợp lệ');
    const student1Token = student1Login.data.data.token;
    const student1RefreshToken = student1Login.data.data.refreshToken;
    const student1Id = student1Login.data.data.user.id;

    const wrongLogin = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'student1', password: 'wrongPassword123' })
    });
    assert(wrongLogin.status === 401, 'Mật khẩu sai bị từ chối 401 Unauthorized');

    // Reviewer Login
    const reviewerLogin = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'reviewer1', password: 'password123' })
    });
    assert(reviewerLogin.status === 200, 'Đăng nhập reviewer1 thành công');
    const reviewerToken = reviewerLogin.data.data.token;

    // Register a second student for cross-user IDOR testing
    console.log('\n[TEST 2] Tạo tài khoản Student 2 phục vụ kiểm thử IDOR:');
    const randUser = `test_student_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const student2Reg = await request('/register', {
        method: 'POST',
        body: JSON.stringify({
            username: randUser,
            password: 'password123',
            fullName: 'Sinh Viên Test 2',
            studentCode: 'SV2026-7777',
            department: 'Khoa Mạng Máy Tính'
        })
    });
    assert(student2Reg.status === 201, 'Đăng ký tài khoản Sinh viên 2 thành công');
    const student2Token = student2Reg.data.data.token;
    const student2Id = student2Reg.data.data.user.id;

    // Upload a real file so the case uses a server-owned evidence record.
    const uploadedEvidence = await uploadEvidence(student2Token);
    assert(uploadedEvidence.status === 201, 'Sinh viên tải lên minh chứng thật thành công');
    if (uploadedEvidence.status !== 201) {
        throw new Error(`Evidence upload failed: ${JSON.stringify(uploadedEvidence.data)}`);
    }

    // Student 2 creates a private case
    const case2Creation = await request('/cases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student2Token}` },
        body: JSON.stringify({
            title: 'Đơn xin miễn giảm học phí của Sinh Viên 2',
            category: 'TUITION_DISCOUNT',
            priority: 'MEDIUM',
            description: 'Đơn cá nhân của sinh viên 2 cần bảo mật tuyệt đối.',
            evidenceFiles: [uploadedEvidence.data.data]
        })
    });
    assert(case2Creation.status === 201, `Sinh viên 2 tạo hồ sơ bảo mật thành công (Status: ${case2Creation.status})`);
    if (!case2Creation.data?.data?.case) {
        console.error('DEBUG case2Creation payload:', case2Creation);
    }
    const case2Id = case2Creation.data?.data?.case?.id;

    // 3. IDOR Protection Tests
    console.log('\n[TEST 3] Kiểm tra Chống Lỗ Hổng Phân Quyền IDOR (Broken Access Control):');
    
    // Test 3.1: Student 1 queries all cases -> must NOT see Student 2's case
    const student1Cases = await request('/cases', {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert(student1Cases.status === 200, 'Student 1 lấy danh sách hồ sơ (200 OK)');
    const containsStudent2Case = (student1Cases.data.data.cases || []).some(c => c.id === case2Id);
    assert(!containsStudent2Case, 'Sinh viên 1 KHÔNG THỂ nhìn thấy hồ sơ của Sinh viên 2 trong GET /api/cases');

    // Test 3.2: Student 1 attempts to query with parameter ?studentId=student2Id
    const student1TamperCases = await request(`/cases?studentId=${student2Id}`, {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    const tamperedListContainsStudent2 = (student1TamperCases.data.data.cases || []).some(c => c.id === case2Id);
    assert(!tamperedListContainsStudent2, 'Hệ thống bỏ qua query studentId do client truyền và ép buộc chỉ trả về đơn của chính mình');

    // Test 3.3: Student 1 tries direct access to Student 2's case (GET /api/cases/:id)
    const directCaseAccess = await request(`/cases/${case2Id}`, {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert(directCaseAccess.status === 403, `Sinh viên 1 truy cập trực tiếp #${case2Id} bị chặn 403 FORBIDDEN`);

    // Test 3.4: Student 1 tries to export decision of Student 2
    const exportDecisionAccess = await request(`/cases/${case2Id}/export-decision`, {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert(exportDecisionAccess.status === 403, 'Sinh viên 1 tải quyết định của Sinh viên 2 bị chặn 403 FORBIDDEN');

    // Test 3.5: Student 1 tries to read comments on Student 2's case
    const commentsAccess = await request(`/cases/${case2Id}/comments`, {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert(commentsAccess.status === 403, 'Sinh viên 1 đọc bình luận trên hồ sơ của Sinh viên 2 bị chặn 403 FORBIDDEN');

    // Test 3.6: Student 1 tries to download evidence file of Student 2
    const fileName = uploadedEvidence.data.data.fileName;
    const fileAccess = await request(`/evidence/${fileName}`, {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert(fileAccess.status === 403, 'Sinh viên 1 tải tệp minh chứng của Sinh viên 2 bị chặn 403 FORBIDDEN');

    // Test 3.7: Reviewer CAN access Student 2's case
    const reviewerAccess = await request(`/cases/${case2Id}`, {
        headers: { Authorization: `Bearer ${reviewerToken}` }
    });
    assert(reviewerAccess.status === 200, 'Cán bộ thẩm định (REVIEWER) có quyền truy cập hồ sơ để xử lý');

    // 4. Audit Trail Isolation
    console.log('\n[TEST 4] Kiểm tra Phân Quyền & Cô Lập Nhật Ký Audit Trail:');
    const student1Audits = await request('/audits', {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    const hasStudent2CaseAudits = (student1Audits.data.data.audits || []).some(a => a.caseId === case2Id || (a.actor?.id && a.actor.id === student2Id));
    assert(!hasStudent2CaseAudits, 'Sinh viên 1 KHÔNG THỂ nhìn thấy nhật ký hành động hoặc hồ sơ của Sinh viên 2');

    const reviewerAudits = await request('/audits', {
        headers: { Authorization: `Bearer ${reviewerToken}` }
    });
    assert(reviewerAudits.status === 200, 'Cán bộ thẩm định xem được toàn bộ Audit Trail toàn trường');

    // 5. 2FA Security & Backdoor Removal
    console.log('\n[TEST 5] Kiểm tra Cơ Chế Xác Thực 2 Bước (2FA - Xóa Bỏ Hoàn Toàn Backdoor):');
    const gen2FA = await request('/auth/2fa/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student2Token}` }
    });
    assert(gen2FA.status === 200, 'Tạo mã bí mật 2FA TOTP thành công');
    const secret2FA = gen2FA.data.data.secret;

    // Try backdoor 123456 -> MUST FAIL
    const backdoorEnable = await request('/auth/2fa/enable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student2Token}` },
        body: JSON.stringify({ otpCode: '123456' })
    });
    assert(backdoorEnable.status === 400, 'Mã backdoor 123456 bị từ chối 400 Bad Request');

    // Try backdoor 888888 -> MUST FAIL
    const backdoorEnable2 = await request('/auth/2fa/enable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student2Token}` },
        body: JSON.stringify({ otpCode: '888888' })
    });
    assert(backdoorEnable2.status === 400, 'Mã backdoor 888888 bị từ chối 400 Bad Request');

    // Real TOTP generation & verification
    const realOtp = speakeasy.totp({ secret: secret2FA, encoding: 'base32' });
    const realEnable = await request('/auth/2fa/enable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student2Token}` },
        body: JSON.stringify({ otpCode: realOtp })
    });
    assert(realEnable.status === 200, 'Kích hoạt 2FA thành công bằng mã TOTP thực tế');

    // 6. Refresh Token Rotation
    console.log('\n[TEST 6] Kiểm tra Xoay Vòng & Thu Hồi Refresh Token (Rotation & Revocation):');
    const refreshResult = await request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: student1RefreshToken })
    });
    assert(refreshResult.status === 200, 'Làm mới Access Token & cấp Refresh Token mới thành công');
    assert(!!refreshResult.data.data?.refreshToken, 'Nhận Refresh Token mới xoay vòng');
    const newRefreshToken = refreshResult.data.data.refreshToken;

    // Using old refresh token again -> MUST FAIL (Revoked)
    const reuseResult = await request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: student1RefreshToken })
    });
    assert(reuseResult.status === 401, 'Refresh Token cũ đã bị hủy và không thể tái sử dụng (Token Reuse Prevention)');

    // 7. AI Auto-Approve Safety Guard
    console.log('\n[TEST 7] Kiểm tra Chặn Tự Động Duyệt Khi Chạy Mock / Thiếu Minh Chứng:');
    const mockCase = await request('/cases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${student1Token}` },
        body: JSON.stringify({
            title: 'Đơn xin miễn giảm học phí chưa qua AI live',
            category: 'TUITION_DISCOUNT',
            description: 'Đơn thử nghiệm kiểm tra tính an toàn của Rule Engine',
            evidenceFiles: [] // No files
        })
    });
    assert(mockCase.status === 201, 'Tạo đơn thành công');
    assert(mockCase.data.data.case.status === 'UNDER_REVIEW', 'Đơn thiếu minh chứng KHÔNG được tự động duyệt, chuyển vào UNDER_REVIEW');
    assert(mockCase.data.data.case.escalation?.reason === 'FACT_UNKNOWN', 'Gán chính xác lý do leo thang FACT_UNKNOWN');

    const unapprovedVerification = await request(`/cases/verify/${mockCase.data.data.case.id}`);
    assert(unapprovedVerification.status === 200 && unapprovedVerification.data.data.verified === false,
        'Tra cứu QR không xác nhận hồ sơ chưa được duyệt');

    const approveForSignature = await request(`/cases/${mockCase.data.data.case.id}/review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: JSON.stringify({ action: 'APPROVE', reason: 'Đã kiểm tra hồ sơ trong test' })
    });
    assert(approveForSignature.status === 200, 'Reviewer phê duyệt hồ sơ kiểm thử để ký số');
    const approvedVerification = await request(`/cases/verify/${mockCase.data.data.case.id}`);
    assert(approvedVerification.status === 200 && approvedVerification.data.data.verified === true,
        'Tra cứu QR xác minh chữ ký đúng của hồ sơ đã duyệt');

    const sqlite = require('../shared/database');
    await sqlite.runAsync('UPDATE cases SET digitalSignature = ? WHERE id = ?', [
        '0'.repeat(64), mockCase.data.data.case.id
    ]);
    const tamperedVerification = await request(`/cases/verify/${mockCase.data.data.case.id}`);
    assert(tamperedVerification.status === 200 && tamperedVerification.data.data.verified === false,
        'Tra cứu QR từ chối chữ ký số bị sửa');

    const studentAiStatus = await request('/ai/status', {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    assert(studentAiStatus.status === 403, 'Trạng thái cấu hình AI chỉ dành cho ADMIN');
    const adminLoginForAi = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin1', password: 'password123' })
    });
    const adminAiStatus = await request('/ai/status', {
        headers: { Authorization: `Bearer ${adminLoginForAi.data.data.token}` }
    });
    assert(adminAiStatus.status === 200 && !Object.hasOwn(adminAiStatus.data.data, 'maskedKey'),
        'Endpoint AI không tiết lộ một phần API key');

    // 8. Deep File & PDF Validation Security Tests
    console.log('\n[TEST 8] Kiểm tra Chống Tệp Giả Mạo & Quét Mã Độc PDF:');
    const { validateFileBuffer } = require('../shared/uploadService');
    
    // Fake extension buffer (text claiming to be PDF)
    const fakeBuffer = Buffer.from('This is a plain text file disguised as pdf');
    const fakeCheck = validateFileBuffer(fakeBuffer);
    assert(!fakeCheck.valid, 'Tệp giả mạo phần mở rộng bị từ chối');

    // Incomplete PDF without %%EOF
    const brokenPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj');
    const brokenCheck = validateFileBuffer(brokenPdfBuffer);
    assert(!brokenCheck.valid && brokenCheck.error?.includes('%%EOF'), 'Tệp PDF bị hỏng hoặc thiếu %%EOF bị từ chối');

    // Malicious PDF with /JavaScript payload
    const maliciousPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert(1)) >>\nendobj\n%%EOF');
    const malCheck = validateFileBuffer(maliciousPdfBuffer);
    assert(!malCheck.valid && malCheck.error?.includes('/JavaScript'), 'Tệp PDF chứa mã lệnh /JavaScript bị chặn');

    // 9. mustChangePassword Enforcement Test
    console.log('\n[TEST 9] Kiểm tra Chặn Thao Tác Khi Chưa Đổi Mật Khẩu Bắt Buộc (mustChangePassword):');
    const dbService = require('../shared/db');
    const tempUser = await dbService.createUser({
        username: `must_change_${Date.now()}`,
        password: 'password123',
        fullName: 'Test Must Change',
        role: 'STUDENT',
        mustChangePassword: true
    });
    const mustChangeLogin = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ username: tempUser.username, password: 'password123' })
    });
    assert(mustChangeLogin.status === 200, 'Đăng nhập thành công với cờ mustChangePassword');
    assert(mustChangeLogin.data.data.user.mustChangePassword === true, 'Cờ mustChangePassword được trả về chính xác');
    const mustChangeToken = mustChangeLogin.data.data.token;

    // Cố gắng tạo hồ sơ khi chưa đổi mật khẩu -> BẮT BUỘC BỊ CHẶN 403
    const blockedAction = await request('/cases', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mustChangeToken}` },
        body: JSON.stringify({
            title: 'Đơn bị chặn do chưa đổi mật khẩu',
            category: 'TUITION_DISCOUNT',
            description: 'Hành động này phải bị chặn bởi middleware bảo vệ.'
        })
    });
    assert(blockedAction.status === 403 && blockedAction.data.error === 'PASSWORD_CHANGE_REQUIRED', 'Hành động tạo đơn bị chặn 403 FORBIDDEN (PASSWORD_CHANGE_REQUIRED)');

    // Dọn dẹp tài khoản test tạm
    await dbService.deleteUser(tempUser.id, { id: 'SYSTEM', username: 'test_runner', role: 'ADMIN' });
    await dbService.deleteUser(student2Id, { id: 'SYSTEM', username: 'test_runner', role: 'ADMIN' });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════');

    if (failed > 0) {
        process.exit(1);
    }
}

runSecurityTestSuite().catch(err => {
    console.error('Lỗi khi chạy kiểm thử:', err);
    process.exit(1);
});

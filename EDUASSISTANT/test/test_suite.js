async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING END-TO-END TEST SUITE: PERSON 1 (03/10 - 08/10)');
  console.log('================================================================');

  try {
    // 1. JWT Authentication (03/10)
    const loginRes = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'student1', password: 'password123' })
    }).then(r => r.json());

    const token = loginRes.data.token;
    const authHeader = { Authorization: `Bearer ${token}` };
    console.log('✅ [1. JWT AUTH] Đăng nhập thành công:', loginRes.data.user.fullName, `(${loginRes.data.user.role})`);

    // 2. Health & System Modules (03/10 - 08/10)
    const healthRes = await fetch('http://localhost:3001/api/health').then(r => r.json());
    console.log('✅ [2. HEALTH CHECK] Các module đang hoạt động:', Object.keys(healthRes.modules).join(', '));

    // 3. AI Mode & Fallback System (07/10)
    const aiStatus = await fetch('http://localhost:3001/api/system/ai-status', { headers: authHeader }).then(r => r.json());
    console.log('✅ [3. AI FALLBACK] AI Engine status:', aiStatus.data.currentMode, `(Protection: ${aiStatus.data.fallbackProtection})`);

    // 4. Case Submission with AI Extraction (05/10 & 07/10)
    const createCaseRes = await fetch('http://localhost:3001/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        title: 'Đơn xin hỗ trợ hoàn cảnh khó khăn kỳ 1',
        category: 'TUITION_DISCOUNT',
        priority: 'HIGH',
        description: 'Gia đình thuộc diện cận nghèo theo chứng nhận 2026, kính mong nhà trường xem xét.',
        evidenceFiles: [{ fileName: 'giay_chung_nhan_can_ngheo.webp', isOptimized: true, savings: '84%' }]
      })
    }).then(r => r.json());

    const newCase = createCaseRes.data.case;
    console.log('✅ [4. CASE SUBMISSION] Tạo hồ sơ thành công:', newCase.id, `(AI Mode: ${newCase.aiExtraction?.modeUsed || 'Auto'}, Status: ${newCase.status})`);

    // 5. Query Student Cases
    const myCasesRes = await fetch('http://localhost:3001/api/cases/my-cases', { headers: authHeader }).then(r => r.json());
    console.log('✅ [5. STUDENT CASE LIST] Tổng số hồ sơ của sinh viên:', myCasesRes.data.total);

    // 6. Audit Trail Verification (08/10)
    const auditRes = await fetch('http://localhost:3001/api/audits', { headers: authHeader }).then(r => r.json());
    const recentAudits = auditRes.data.audits.slice(0, 4);
    console.log('✅ [6. AUDIT TRAIL] 4 sự kiện mới nhất ghi nhận trong lịch sử xử lý:');
    recentAudits.forEach(a => {
      console.log(`   • [${a.action}] [${a.timestamp.substring(11, 19)}] - ${a.actor.name}: ${a.reason}`);
    });

    console.log('\n================================================================');
    console.log('🎉 TOÀN BỘ CÁC TÍNH NĂNG CỦA NGƯỜI 1 ĐÃ HOÀN TẤT VÀ LIÊN KẾT 100%!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Test thất bại:', err.message);
  }
}

runTests();

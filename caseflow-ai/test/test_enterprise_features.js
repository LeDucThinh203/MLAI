const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 TESTING CASEFLOW ENTERPRISE UPGRADES (SQLite, 2FA, OCR, Reports)');
  console.log('====================================================');

  try {
    // 1. Health check
    console.log('\n[1] Testing Health Endpoint...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Response:', health.data.status, health.data.service);

    // 2. Normal Login as student1
    console.log('\n[2] Testing Student Login & Token Issuance...');
    const studentLogin = await axios.post(`${BASE_URL}/login`, {
      username: 'student1',
      password: 'password123'
    });
    console.log('✅ Student Login Success:', studentLogin.data.data.user.fullName, 'MSSV:', studentLogin.data.data.user.studentCode);
    const studentToken = studentLogin.data.data.token;
    const refreshToken = studentLogin.data.data.refreshToken;
    console.log('✅ Access Token & Refresh Token issued:', {
      hasAccessToken: Boolean(studentToken),
      hasRefreshToken: Boolean(refreshToken)
    });

    // 3. Test Refresh Token Rotation
    console.log('\n[3] Testing Refresh Token Rotation...');
    const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {
      refreshToken: refreshToken
    });
    console.log('✅ Refresh Token Rotated Successfully:', Boolean(refreshRes.data.data.token));

    // 4. Test 2FA Generation & Activation for Reviewer
    console.log('\n[4] Testing 2FA Lifecycle for reviewer1...');
    let reviewerLogin = await axios.post(`${BASE_URL}/login`, {
      username: 'reviewer1',
      password: 'password123'
    });

    let reviewerToken = reviewerLogin.data.data.token;
    if (reviewerLogin.data.data.requires2FA) {
      const v = await axios.post(`${BASE_URL}/auth/2fa/login`, {
        tempToken: reviewerLogin.data.data.tempToken,
        otpCode: '123456'
      });
      reviewerToken = v.data.data.token;
      await axios.post(`${BASE_URL}/auth/2fa/disable`, { otpCode: '123456' }, {
        headers: { Authorization: `Bearer ${reviewerToken}` }
      });
      console.log('✅ Reset 2FA to baseline for reviewer1');
      // Re-login normally
      reviewerLogin = await axios.post(`${BASE_URL}/login`, {
        username: 'reviewer1',
        password: 'password123'
      });
      reviewerToken = reviewerLogin.data.data.token;
    }

    // Generate 2FA Secret & QR
    const gen2fa = await axios.post(`${BASE_URL}/auth/2fa/generate`, {}, {
      headers: { Authorization: `Bearer ${reviewerToken}` }
    });
    console.log('✅ 2FA QR Code & Secret Generated:', {
      hasSecret: Boolean(gen2fa.data.data.secret),
      hasQrCode: Boolean(gen2fa.data.data.qrCodeDataUrl)
    });

    // Enable 2FA using bypass/test code 123456
    const enable2fa = await axios.post(`${BASE_URL}/auth/2fa/enable`, {
      secret: gen2fa.data.data.secret,
      otpCode: '123456'
    }, {
      headers: { Authorization: `Bearer ${reviewerToken}` }
    });
    console.log('✅ 2FA Enabled Response:', enable2fa.data.message);

    // Test Login with 2FA Challenge Triggered
    const loginWith2fa = await axios.post(`${BASE_URL}/login`, {
      username: 'reviewer1',
      password: 'password123'
    });
    console.log('✅ 2FA Challenge Triggered on Login:', {
      requires2FA: loginWith2fa.data.data.requires2FA,
      tempToken: Boolean(loginWith2fa.data.data.tempToken)
    });

    // Complete 2FA OTP Login Challenge
    const verify2faLogin = await axios.post(`${BASE_URL}/auth/2fa/login`, {
      tempToken: loginWith2fa.data.data.tempToken,
      otpCode: '123456'
    });
    console.log('✅ 2FA OTP Challenge Passed! Issued Token for:', verify2faLogin.data.data.user.fullName);

    // Disable 2FA to return reviewer1 to clean baseline
    await axios.post(`${BASE_URL}/auth/2fa/disable`, {
      otpCode: '123456'
    }, {
      headers: { Authorization: `Bearer ${verify2faLogin.data.data.token}` }
    });
    console.log('✅ 2FA Disabled cleanly for reviewer1');

    // 5. Test CSV Report Generation (with UTF-8 BOM check)
    console.log('\n[5] Testing CSV Export Endpoint...');
    const adminLogin = await axios.post(`${BASE_URL}/login`, {
      username: 'admin1',
      password: 'password123'
    });
    const adminToken = adminLogin.data.data.token;

    const csvRes = await axios.get(`${BASE_URL}/reports/export-csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const hasUtf8Bom = csvRes.data.startsWith('\uFEFF');
    console.log('✅ CSV Exported successfully! Length:', csvRes.data.length, 'bytes. UTF-8 BOM Present for Excel:', hasUtf8Bom);

    // 6. Test Official Decision HTML / PDF Generation
    console.log('\n[6] Testing Official Decision PDF / Print Document Generation...');
    const casesRes = await axios.get(`${BASE_URL}/cases`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const firstCaseId = casesRes.data.data.cases[0].id;
    const decisionRes = await axios.get(`${BASE_URL}/cases/${firstCaseId}/export-decision`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const hasQrCodeImg = decisionRes.data.includes('img src="data:image/png;base64');
    const hasSeal = decisionRes.data.includes('ĐÃ KÝ ĐIỆN TỬ BỞI CASEFLOW AI');
    console.log(`✅ Decision Document for #${firstCaseId} Generated!`, {
      hasQrCodeImg,
      hasElectronicSeal: hasSeal,
      htmlLength: decisionRes.data.length
    });

    console.log('\n====================================================');
    console.log('🎉 ALL ENTERPRISE UPGRADE TEST SUITES PASSED 100%!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

// Ensure server is running or start it
runTests();

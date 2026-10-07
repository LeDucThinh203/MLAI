const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Generate realistic SVG image and convert to WebP using Sharp
async function createDemoEvidenceImage(fileName, title, subTitle, badgeColor) {
  const filePath = path.join(UPLOADS_DIR, fileName);
  const svgBuffer = Buffer.from(`
    <svg width="800" height="1100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#f8fafc"/>
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.1"/>
        </filter>
      </defs>
      
      <!-- Background page -->
      <rect width="800" height="1100" fill="url(#bg)"/>
      <rect x="25" y="25" width="750" height="1050" fill="none" stroke="#cbd5e1" stroke-width="2" rx="8"/>
      <rect x="35" y="35" width="730" height="1030" fill="none" stroke="#e2e8f0" stroke-width="1" rx="4"/>
      
      <!-- Header / Quốc hiệu -->
      <text x="400" y="80" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#0f172a">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</text>
      <text x="400" y="102" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#0f172a">Độc lập - Tự do - Hạnh phúc</text>
      <line x1="330" y1="112" x2="470" y2="112" stroke="#0f172a" stroke-width="1"/>
      
      <text x="80" y="150" font-family="Arial, sans-serif" font-size="12" fill="#64748b">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ &amp; ĐÀO TẠO</text>
      <text x="80" y="170" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#0284c7">HỆ THỐNG XÁC THỰC VĂN BẢN ĐIỆN TỬ</text>
      
      <!-- Status Badge -->
      <rect x="580" y="140" width="140" height="34" rx="17" fill="${badgeColor}" filter="url(#shadow)"/>
      <text x="650" y="162" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#ffffff">ĐÃ XÁC THỰC</text>
      
      <!-- Main Title -->
      <text x="400" y="260" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="#0f172a">${title}</text>
      <text x="400" y="295" font-family="Arial, sans-serif" font-size="15" text-anchor="middle" fill="#475569">${subTitle}</text>
      
      <!-- Document Content Body Mock -->
      <rect x="80" y="340" width="640" height="420" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
      
      <!-- Table Rows Mock -->
      <line x1="80" y1="390" x2="720" y2="390" stroke="#cbd5e1" stroke-width="1"/>
      <text x="100" y="375" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#334155">HẠNG MỤC THẨM ĐỊNH</text>
      <text x="450" y="375" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#334155">KẾT QUẢ / CHI TIẾT</text>
      
      <text x="100" y="430" font-family="Arial, sans-serif" font-size="13" fill="#475569">Mã tra cứu văn bản:</text>
      <text x="450" y="430" font-family="Courier, monospace" font-size="13" font-weight="bold" fill="#4f46e5">VB-2026-XN-${Math.floor(100000 + Math.random() * 900000)}</text>
      
      <text x="100" y="475" font-family="Arial, sans-serif" font-size="13" fill="#475569">Thời hạn hiệu lực:</text>
      <text x="450" y="475" font-family="Arial, sans-serif" font-size="13" fill="#059669">Năm học 2026 - 2027 (Hợp lệ)</text>
      
      <text x="100" y="520" font-family="Arial, sans-serif" font-size="13" fill="#475569">Cơ quan cấp chứng nhận:</text>
      <text x="450" y="520" font-family="Arial, sans-serif" font-size="13" fill="#1e293b">Hội đồng Khảo thí &amp; Đào tạo</text>
      
      <text x="100" y="565" font-family="Arial, sans-serif" font-size="13" fill="#475569">Chữ ký số &amp; Mã hóa:</text>
      <text x="450" y="565" font-family="Courier, monospace" font-size="11" fill="#64748b">SHA-256: e83b1a9f...9c2e01</text>
      
      <text x="100" y="610" font-family="Arial, sans-serif" font-size="13" fill="#475569">Đánh giá tiêu chí xét duyệt:</text>
      <text x="450" y="610" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#059669">ĐẠT YÊU CẦU 100%</text>
      
      <text x="100" y="660" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Ghi chú xác minh:</text>
      <text x="100" y="685" font-family="Arial, sans-serif" font-size="12" fill="#334155">Tài liệu đã được đối chiếu trực tiếp với cổng dữ liệu liên trường đại học.</text>
      <text x="100" y="710" font-family="Arial, sans-serif" font-size="12" fill="#334155">Minh chứng đủ điều kiện trình Hội đồng xét duyệt hồ sơ.</text>
      
      <!-- Con dấu mộc tròn đỏ -->
      <circle cx="600" cy="890" r="65" fill="none" stroke="#dc2626" stroke-width="3.5" opacity="0.85"/>
      <circle cx="600" cy="890" r="58" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.85"/>
      <text x="600" y="870" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">TRƯỜNG ĐẠI HỌC</text>
      <text x="600" y="895" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">★ ĐÃ DUYỆT ★</text>
      <text x="600" y="918" font-family="Arial, sans-serif" font-size="9" text-anchor="middle" fill="#dc2626" opacity="0.9">BAN QUẢN LÝ ĐÀO TẠO</text>
      
      <!-- Footer barcode -->
      <rect x="80" y="980" width="280" height="36" fill="#1e293b"/>
      <text x="90" y="1003" font-family="Courier, monospace" font-size="12" fill="#38bdf8">|||| ||||| |||| |||| ||| ||||||</text>
      <text x="400" y="1040" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#94a3b8">CaseFlow AI Verified Evidence • Optimized with Sharp WebP Engine</text>
    </svg>
  `);

  await sharp(svgBuffer)
    .webp({ quality: 85 })
    .toFile(filePath);
}

async function seed() {
  console.log('--- 1. Creating Real Sharp WebP Evidence Images ---');
  
  const images = [
    { file: 'giay_xac_nhan_can_ngheo_2026.webp', title: 'GIẤY XÁC NHẬN HỘ CẬN NGHÈO', sub: 'Ủy ban Nhân dân Phường Linh Trung - Năm 2026', color: '#0284c7' },
    { file: 'bang_diem_hoc_bong_xuat_sac.webp', title: 'BẢNG ĐIỂM TÍCH LŨY GPA 3.92', sub: 'Khoa Công Nghệ Thông Tin - Học kỳ 1 2025-2026', color: '#059669' },
    { file: 'giay_khen_mua_he_xanh_2026.webp', title: 'GIẤY KHEN CHIẾN DỊCH TÌNH NGUYỆN', sub: 'Đoàn Thanh Niên &amp; Hội Sinh Viên Thành Phố', color: '#d97706' },
    { file: 'giay_khen_olympic_tin_hoc_2026.webp', title: 'GIẢI NHẤT OLYMPIC TIN HỌC SINH VIÊN', sub: 'Hội Tin học Việt Nam &amp; Bộ GD&amp;ĐT', color: '#4f46e5' },
    { file: 'chung_chi_ielts_80_quoc_te.webp', title: 'BẢNG ĐIỂM IELTS ACADEMIC OVERALL 8.0', sub: 'IDP Education / British Council Verification', color: '#059669' },
    { file: 'giay_xac_nhan_benh_vien_2026.webp', title: 'GIẤY XÁC NHẬN BỆNH ÁN ĐIỀU TRỊ', sub: 'Bệnh viện Đa Khoa Khu Vực Thủ Đức', color: '#e11d48' },
    { file: 'don_xin_ho_tro_lu_lut_mien_trung.webp', title: 'XÁC NHẬN THIỆT HẠI DO THIÊN TAI LŨ LỤT', sub: 'UBND Huyện Lệ Thủy, Tỉnh Quảng Bình', color: '#d97706' },
    { file: 'giay_chung_nhan_nghien_cuu_khoa_hoc.webp', title: 'GIẢI THƯỞNG SINH VIÊN NGHIÊN CỨU KHOA HỌC', sub: 'Giải thưởng Eureka - Thành Đoàn TP.HCM', color: '#0284c7' },
    { file: 'giay_xac_nhan_khuyet_tat_2026.webp', title: 'GIẤY XÁC NHẬN MỨC ĐỘ KHUYẾT TẬT', sub: 'Hội đồng Giám định Y khoa Tỉnh', color: '#059669' },
    { file: 'bang_diem_phuc_khao_mon_ctdl.webp', title: 'PHIẾU ĐỀ NGHỊ PHÚC KHẢO ĐIỂM THI', sub: 'Phòng Khảo thí &amp; Đảm bảo chất lượng', color: '#4f46e5' }
  ];

  for (const img of images) {
    await createDemoEvidenceImage(img.file, img.title, img.sub, img.color);
    console.log(`Generated: uploads/${img.file}`);
  }

  console.log('--- 2. Building Clean User Database ---');
  
  // 3 Sample Accounts (Kept Intact)
  const sampleUsers = [
    {
      id: 'usr_student_01',
      username: 'student1',
      fullName: 'Nguyễn Văn An',
      studentCode: 'SV2026-9921',
      email: 'student1@caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Công Nghệ Thông Tin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr_reviewer_01',
      username: 'reviewer1',
      fullName: 'Trần Thị Mai Phương',
      studentCode: null,
      email: 'reviewer1@caseflow.ai',
      role: 'REVIEWER',
      password: 'password123',
      department: 'Ban Giám Sát & Xét Duyệt Học Bổng',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr_admin_01',
      username: 'admin1',
      fullName: 'Lê Hoàng Long',
      studentCode: null,
      email: 'admin1@caseflow.ai',
      role: 'ADMIN',
      password: 'password123',
      department: 'Ban Quản Trị Hệ Thống (DevOps/Admin)',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
    }
  ];

  // 10 New Students
  const newStudents = [
    {
      id: 'usr_student_02',
      username: 'student2',
      fullName: 'Phạm Minh Tuấn',
      studentCode: 'SV2026-1002',
      email: 'student2@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Công Nghệ Thông Tin',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'
    },
    {
      id: 'usr_student_03',
      username: 'student3',
      fullName: 'Lê Hoàng Yến',
      studentCode: 'SV2026-1003',
      email: 'student3@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Kinh Tế & Quản Trị',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'
    },
    {
      id: 'usr_student_04',
      username: 'student4',
      fullName: 'Vũ Đức Anh',
      studentCode: 'SV2026-1004',
      email: 'student4@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Cơ Khí & Tự Động Hóa',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'
    },
    {
      id: 'usr_student_05',
      username: 'student5',
      fullName: 'Đặng Thu Thảo',
      studentCode: 'SV2026-1005',
      email: 'student5@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Ngoại Ngữ',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150'
    },
    {
      id: 'usr_student_06',
      username: 'student6',
      fullName: 'Bùi Gia Bảo',
      studentCode: 'SV2026-1006',
      email: 'student6@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Điện - Điện Tử',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
    },
    {
      id: 'usr_student_07',
      username: 'student7',
      fullName: 'Đỗ Ngọc Ánh',
      studentCode: 'SV2026-1007',
      email: 'student7@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Luật & Khoa Học Xã Hội',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
    },
    {
      id: 'usr_student_08',
      username: 'student8',
      fullName: 'Hoàng Quốc Việt',
      studentCode: 'SV2026-1008',
      email: 'student8@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Y Dược',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'
    },
    {
      id: 'usr_student_09',
      username: 'student9',
      fullName: 'Ngô Thanh Hằng',
      studentCode: 'SV2026-1009',
      email: 'student9@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Kiến Trúc & Xây Dựng',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    },
    {
      id: 'usr_student_10',
      username: 'student10',
      fullName: 'Dương Văn Nam',
      studentCode: 'SV2026-1010',
      email: 'student10@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Khoa Học Dữ Liệu',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
    },
    {
      id: 'usr_student_11',
      username: 'student11',
      fullName: 'Phan Thùy Linh',
      studentCode: 'SV2026-1011',
      email: 'student11@student.caseflow.ai',
      role: 'STUDENT',
      password: 'password123',
      department: 'Khoa Tài Chính Ngân Hàng',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
    }
  ];

  // 4 New Reviewers
  const newReviewers = [
    {
      id: 'usr_reviewer_02',
      username: 'reviewer2',
      fullName: 'PGS.TS Nguyễn Thành Đồng',
      studentCode: null,
      email: 'reviewer2@caseflow.ai',
      role: 'REVIEWER',
      password: 'password123',
      department: 'Ban Xét Duyệt Học Bổng & Nghiên Cứu',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
    },
    {
      id: 'usr_reviewer_03',
      username: 'reviewer3',
      fullName: 'ThS. Lê Thị Cẩm Tú',
      studentCode: null,
      email: 'reviewer3@caseflow.ai',
      role: 'REVIEWER',
      password: 'password123',
      department: 'Phòng Công Tác Sinh Viên & Hỗ Trợ Khó Khăn',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'
    },
    {
      id: 'usr_reviewer_04',
      username: 'reviewer4',
      fullName: 'TS. Vũ Hoàng Hải',
      studentCode: null,
      email: 'reviewer4@caseflow.ai',
      role: 'REVIEWER',
      password: 'password123',
      department: 'Ban Quản Lý & Khảo Thí Đào Tạo',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
    },
    {
      id: 'usr_reviewer_05',
      username: 'reviewer5',
      fullName: 'ThS. Phạm Ngọc Bích',
      studentCode: null,
      email: 'reviewer5@caseflow.ai',
      role: 'REVIEWER',
      password: 'password123',
      department: 'Hội Đồng Đánh Giá Rèn Luyện & Ngoại Khóa',
      avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150'
    }
  ];

  const allUsers = [...sampleUsers, ...newStudents, ...newReviewers];

  console.log('--- 3. Generating 20 Diverse Pending Review Cases ---');

  const casesData = [
    {
      id: 'CASE-2026-001',
      studentId: 'usr_student_01',
      studentName: 'Nguyễn Văn An',
      studentCode: 'SV2026-9921',
      title: 'Đơn xin miễn giảm học phí học kỳ 1 năm học 2026-2027',
      category: 'TUITION_DISCOUNT',
      priority: 'HIGH',
      description: 'Gia đình em thuộc diện hộ cận nghèo có hoàn cảnh kinh tế khó khăn. Bố mẹ làm nông nghiệp thu nhập không ổn định, kính mong nhà trường xem xét miễn giảm học phí 50% theo quy định.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_xac_nhan_can_ngheo_2026.webp',
          fileUrl: '/uploads/giay_xac_nhan_can_ngheo_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giay_Chung_Nhan_Can_Ngheo_2026.png',
            originalSize: '3.12 MB',
            compressedSize: '142.4 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Cache (VLM Optimized)',
        policyRuleMatch: 'RULE_SEC_4A_PASSED (Hộ cận nghèo chuẩn tỉnh)',
        confidence: 0.96,
        suggestedAction: 'HỢP LỆ - KHUYẾN NGHỊ DUYỆT GIẢM 50%'
      },
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 48).toISOString()
    },
    {
      id: 'CASE-2026-002',
      studentId: 'usr_student_02',
      studentName: 'Phạm Minh Tuấn',
      studentCode: 'SV2026-1002',
      title: 'Đơn đăng ký xét Học bổng khuyến khích tài năng loại Xuất sắc',
      category: 'ACADEMIC_SCHOLARSHIP',
      priority: 'HIGH',
      description: 'Em đạt điểm GPA học kỳ vừa qua là 3.92/4.00, xếp hạng top 1% toàn khoa Công nghệ Thông tin, đồng thời có bài báo khoa học được công bố tại hội nghị sinh viên.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'bang_diem_hoc_bong_xuat_sac.webp',
          fileUrl: '/uploads/bang_diem_hoc_bong_xuat_sac.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Bang_Diem_Tich_Luy_GPA_392.png',
            originalSize: '2.84 MB',
            compressedSize: '138.2 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        },
        {
          fileName: 'giay_khen_olympic_tin_hoc_2026.webp',
          fileUrl: '/uploads/giay_khen_olympic_tin_hoc_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Chung_Nhan_Olympic_Tin_Hoc.jpg',
            originalSize: '4.15 MB',
            compressedSize: '165.8 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_SCHOLARSHIP_EXCELLENCE (GPA >= 3.8 + NCKH)',
        confidence: 0.98,
        suggestedAction: 'ĐẠT TIÊU CHUẨN XUẤT SẮC TOÀN KHÓA'
      },
      createdAt: new Date(Date.now() - 3600000 * 42).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 42).toISOString()
    },
    {
      id: 'CASE-2026-003',
      studentId: 'usr_student_03',
      studentName: 'Lê Hoàng Yến',
      studentCode: 'SV2026-1003',
      title: 'Đề nghị cộng 25 điểm rèn luyện Chiến dịch Mùa hè xanh 2026',
      category: 'COMMUNITY_SERVICE',
      priority: 'MEDIUM',
      description: 'Em đã tham gia trọn vẹn chiến dịch tình nguyện Mùa hè xanh tại mặt trận Huyện Cần Giờ với vai trò đội phó và được Thành Đoàn cấp giấy khen hoàn thành xuất sắc nhiệm vụ.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_khen_mua_he_xanh_2026.webp',
          fileUrl: '/uploads/giay_khen_mua_he_xanh_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giay_Khen_Mua_He_Xanh_Can_Gio.png',
            originalSize: '3.45 MB',
            compressedSize: '148.9 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_DRL_VOLUNTEER_TIER1 (Cộng tối đa 25đ)',
        confidence: 0.95,
        suggestedAction: 'HỢP LỆ - CỘNG 25 ĐIỂM TIÊU CHÍ 4'
      },
      createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 36).toISOString()
    },
    {
      id: 'CASE-2026-004',
      studentId: 'usr_student_04',
      studentName: 'Vũ Đức Anh',
      studentCode: 'SV2026-1004',
      title: 'Đơn xin trợ cấp khó khăn đột xuất do thiên tai bão lũ',
      category: 'EMERGENCY_AID',
      priority: 'URGENT',
      description: 'Nhà em tại Quảng Bình bị ngập lụt hư hỏng tài sản nặng nề trong đợt mưa bão vừa qua. Kính đề nghị Quỹ Tương Trợ Sinh Viên hỗ trợ chi phí sinh hoạt khẩn cấp.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'don_xin_ho_tro_lu_lut_mien_trung.webp',
          fileUrl: '/uploads/don_xin_ho_tro_lu_lut_mien_trung.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Xac_Nhan_Thiet_Hai_UBND_Le_Thuy.pdf.png',
            originalSize: '4.20 MB',
            compressedSize: '158.0 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_EMERGENCY_AID_TIER_A (Thiên tai cấp bách)',
        confidence: 0.97,
        suggestedAction: 'ƯU TIÊN PHÊ DUYỆT KHẨN CẤP 5.000.000 VNĐ'
      },
      createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 30).toISOString()
    },
    {
      id: 'CASE-2026-005',
      studentId: 'usr_student_05',
      studentName: 'Đặng Thu Thảo',
      studentCode: 'SV2026-1005',
      title: 'Đơn phúc khảo điểm thi cuối kỳ môn Cấu trúc Dữ liệu & Giải thuật',
      category: 'GRADE_APPEAL',
      priority: 'MEDIUM',
      description: 'Em làm bài tự luận câu 4 thuật toán Dijkstra và câu 5 cây nhị phân đầy đủ các bước nhưng điểm tổng kết bị lệch so với barem đáp án công bố, kính mong quý thầy cô chấm lại.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'bang_diem_phuc_khao_mon_ctdl.webp',
          fileUrl: '/uploads/bang_diem_phuc_khao_mon_ctdl.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Don_Phuc_Khao_Va_Bai_Lam.png',
            originalSize: '2.90 MB',
            compressedSize: '135.6 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_APPEAL_TIMEFRAME_VALID (Trong hạn 7 ngày)',
        confidence: 0.92,
        suggestedAction: 'HỢP LỆ - CHUYỂN BỘ MÔN CHẤM LẠI'
      },
      createdAt: new Date(Date.now() - 3600000 * 25).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 25).toISOString()
    },
    {
      id: 'CASE-2026-006',
      studentId: 'usr_student_06',
      studentName: 'Bùi Gia Bảo',
      studentCode: 'SV2026-1006',
      title: 'Đơn xin miễn giảm học phí diện sinh viên khuyết tật nặng',
      category: 'TUITION_DISCOUNT',
      priority: 'HIGH',
      description: 'Em có giấy xác nhận khuyết tật vận động mức độ nặng theo kết luận y khoa của Hội đồng giám định. Em xin miễn 100% học phí theo Nghị định 81/2021/NĐ-CP.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_xac_nhan_khuyet_tat_2026.webp',
          fileUrl: '/uploads/giay_xac_nhan_khuyet_tat_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giay_Chung_Nhan_Khuyet_Tat.png',
            originalSize: '3.60 MB',
            compressedSize: '152.3 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_ND81_ARTICLE15 (Miễn 100% học phí theo luật)',
        confidence: 0.99,
        suggestedAction: 'ĐẠT ĐIỀU KIỆN MIỄN 100% TOÀN KHÓA HỌC'
      },
      createdAt: new Date(Date.now() - 3600000 * 22).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 22).toISOString()
    },
    {
      id: 'CASE-2026-007',
      studentId: 'usr_student_07',
      studentName: 'Đỗ Ngọc Ánh',
      studentCode: 'SV2026-1007',
      title: 'Đăng ký xét Học bổng Doanh nghiệp liên kết tài trợ 2026',
      category: 'ACADEMIC_SCHOLARSHIP',
      priority: 'MEDIUM',
      description: 'Em nộp hồ sơ xin xét học bổng doanh nghiệp công nghệ VNG/FPT với thành tích IELTS 8.0 và giải Nhất nghiên cứu khoa học cấp trường.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'chung_chi_ielts_80_quoc_te.webp',
          fileUrl: '/uploads/chung_chi_ielts_80_quoc_te.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'IELTS_Official_Test_Report.png',
            originalSize: '3.20 MB',
            compressedSize: '141.5 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        },
        {
          fileName: 'giay_chung_nhan_nghien_cuu_khoa_hoc.webp',
          fileUrl: '/uploads/giay_chung_nhan_nghien_cuu_khoa_hoc.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giai_Nhat_NCKH_Eureka.jpg',
            originalSize: '4.80 MB',
            compressedSize: '172.0 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Cache (VLM Optimized)',
        policyRuleMatch: 'RULE_CORP_SCHOLARSHIP_TIER1 (IELTS >= 7.5 + NCKH)',
        confidence: 0.97,
        suggestedAction: 'ĐỦ ĐIỀU KIỆN NHẬN HỌC BỔNG DOANH NGHIỆP'
      },
      createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 20).toISOString()
    },
    {
      id: 'CASE-2026-008',
      studentId: 'usr_student_08',
      studentName: 'Hoàng Quốc Việt',
      studentCode: 'SV2026-1008',
      title: 'Đơn xin hỗ trợ chi phí điều trị bệnh hiểm nghèo nội trú',
      category: 'EMERGENCY_AID',
      priority: 'URGENT',
      description: 'Em phải phẫu thuật và điều trị nội trú tại Bệnh viện Chợ Rẫy trong 3 tuần, chi phí vượt quá khả năng tài chính của gia đình, kính xin nhà trường hỗ trợ chi phí.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_xac_nhan_benh_vien_2026.webp',
          fileUrl: '/uploads/giay_xac_nhan_benh_vien_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giay_Ra_Vien_Va_Hoa_Don_Vien_Phi.png',
            originalSize: '4.50 MB',
            compressedSize: '168.4 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_MEDICAL_AID_APPROVED (Viện phí > 15 triệu)',
        confidence: 0.96,
        suggestedAction: 'DUYỆT CHI TRỢ CẤP Y TẾ KHẨN CẤP'
      },
      createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 18).toISOString()
    },
    {
      id: 'CASE-2026-009',
      studentId: 'usr_student_09',
      studentName: 'Ngô Thanh Hằng',
      studentCode: 'SV2026-1009',
      title: 'Đơn đề nghị công nhận điểm rèn luyện tham gia hiến máu tình nguyện',
      category: 'COMMUNITY_SERVICE',
      priority: 'LOW',
      description: 'Em đã tham gia 2 đợt Ngày hội Giọt Hồng Tình Nguyện trong năm học 2025-2026 và có giấy chứng nhận của Viện Huyết học Truyền máu.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_khen_mua_he_xanh_2026.webp',
          fileUrl: '/uploads/giay_khen_mua_he_xanh_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giay_Chung_Nhan_Hien_Mau_2026.png',
            originalSize: '2.75 MB',
            compressedSize: '132.0 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_DRL_BLOOD_DONATION (+10đ mỗi đợt)',
        confidence: 0.94,
        suggestedAction: 'CỘNG 20 ĐIỂM RÈN LUYỆN'
      },
      createdAt: new Date(Date.now() - 3600000 * 16).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 16).toISOString()
    },
    {
      id: 'CASE-2026-010',
      studentId: 'usr_student_10',
      studentName: 'Dương Văn Nam',
      studentCode: 'SV2026-1010',
      title: 'Đơn xin miễn giảm học phí con thương binh hạng 2/4',
      category: 'TUITION_DISCOUNT',
      priority: 'HIGH',
      description: 'Bố em là thương binh hạng 2/4 có thẻ thương binh và giấy xác nhận chi trả trợ cấp ưu đãi người có công hàng tháng của Sở LĐ-TB&XH.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_xac_nhan_can_ngheo_2026.webp',
          fileUrl: '/uploads/giay_xac_nhan_can_ngheo_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'The_Thuong_Binh_Va_Giay_Xac_Nhan.png',
            originalSize: '3.80 MB',
            compressedSize: '155.0 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Cache (VLM Optimized)',
        policyRuleMatch: 'RULE_PREFERENTIAL_POLICY_PASSED (Con thương binh)',
        confidence: 0.99,
        suggestedAction: 'MIỄN 100% HỌC PHÍ THEO QUY ĐỊNH'
      },
      createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 14).toISOString()
    },
    // Case 11 - Đã bổ sung đang chờ duyệt lại (RESUBMITTED)
    {
      id: 'CASE-2026-011',
      studentId: 'usr_student_11',
      studentName: 'Phan Thùy Linh',
      studentCode: 'SV2026-1011',
      title: 'Đơn xin cấp học bổng khuyến học Nữ sinh ngành Công nghệ',
      category: 'ACADEMIC_SCHOLARSHIP',
      priority: 'MEDIUM',
      description: 'Em nộp đơn xin học bổng khuyến khích nữ sinh xuất sắc theo chương trình phát triển tài năng trẻ của Viện Khoa học.',
      status: 'RESUBMITTED',
      evidenceFiles: [
        {
          fileName: 'bang_diem_hoc_bong_xuat_sac.webp',
          fileUrl: '/uploads/bang_diem_hoc_bong_xuat_sac.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Bang_Diem_Chinh_Thuc_Co_Dau_Moc.png',
            originalSize: '3.10 MB',
            compressedSize: '144.0 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      supplementHistory: [
        {
          note: 'Đã bổ sung bản scan có dấu mộc đỏ của Phòng Đào tạo theo yêu cầu của Thẩm định viên.',
          submittedAt: new Date(Date.now() - 3600000 * 2).toISOString()
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_FEMALE_TECH_SCHOLARSHIP (GPA >= 3.6)',
        confidence: 0.95,
        suggestedAction: 'ĐỦ ĐIỀU KIỆN XÉT HỌC BỔNG NỮ SINH'
      },
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    // Case 12
    {
      id: 'CASE-2026-012',
      studentId: 'usr_student_01',
      studentName: 'Nguyễn Văn An',
      studentCode: 'SV2026-9921',
      title: 'Đơn xin hỗ trợ chi phí mua máy tính phục vụ đồ án tốt nghiệp',
      category: 'EMERGENCY_AID',
      priority: 'HIGH',
      description: 'Máy tính xách tay của em bị hỏng bo mạch chủ không thể sửa chữa trong khi đang làm đồ án tốt nghiệp cuối khóa, kính xin quỹ trường hỗ trợ mượn máy hoặc trợ cấp.',
      status: 'RESUBMITTED',
      evidenceFiles: [
        {
          fileName: 'don_xin_ho_tro_lu_lut_mien_trung.webp',
          fileUrl: '/uploads/don_xin_ho_tro_lu_lut_mien_trung.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Phieu_Bao_Hong_Trung_Tam_Bao_Hanh.png',
            originalSize: '2.60 MB',
            compressedSize: '128.0 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      supplementHistory: [
        {
          note: 'Đã đính kèm xác nhận của giảng viên hướng dẫn đồ án tốt nghiệp.',
          submittedAt: new Date(Date.now() - 3600000 * 4).toISOString()
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_LAB_EQUIPMENT_SUPPORT',
        confidence: 0.91,
        suggestedAction: 'CHO MƯỢN LAPTOP TRƯỜNG TRONG 3 THÁNG'
      },
      createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    // Case 13
    {
      id: 'CASE-2026-013',
      studentId: 'usr_student_02',
      studentName: 'Phạm Minh Tuấn',
      studentCode: 'SV2026-1002',
      title: 'Đơn phúc khảo điểm thi môn Mạng Máy Tính & An Toàn Thông Tin',
      category: 'GRADE_APPEAL',
      priority: 'LOW',
      description: 'Phần bài tập thực hành Packet Tracer em cấu hình OSPF đầy đủ định tuyến nhưng hệ thống tự động ghi nhận 0 điểm, kính đề nghị chấm kiểm tra lại log server.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'bang_diem_phuc_khao_mon_ctdl.webp',
          fileUrl: '/uploads/bang_diem_phuc_khao_mon_ctdl.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Log_Packet_Tracer_Submission.png',
            originalSize: '3.40 MB',
            compressedSize: '146.0 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_EXAM_LOG_VERIFICATION',
        confidence: 0.93,
        suggestedAction: 'CHUYỂN KHOA CNTT XÁC MINH LOG NỘP BÀI'
      },
      createdAt: new Date(Date.now() - 3600000 * 9).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 9).toISOString()
    },
    // Case 14
    {
      id: 'CASE-2026-014',
      studentId: 'usr_student_03',
      studentName: 'Lê Hoàng Yến',
      studentCode: 'SV2026-1003',
      title: 'Đơn xin miễn giảm học phí cho sinh viên người dân tộc thiểu số',
      category: 'TUITION_DISCOUNT',
      priority: 'HIGH',
      description: 'Em là người dân tộc Mường có hộ khẩu thường trú tại vùng có điều kiện kinh tế - xã hội đặc biệt khó khăn theo quyết định của Thủ tướng Chính phủ.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_xac_nhan_can_ngheo_2026.webp',
          fileUrl: '/uploads/giay_xac_nhan_can_ngheo_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giay_Khai_Sinh_Va_Ho_Khau_Vung_135.png',
            originalSize: '3.95 MB',
            compressedSize: '160.0 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_ETHNIC_MINORITY_SUPPORT_PASSED',
        confidence: 0.98,
        suggestedAction: 'MIỄN 100% HỌC PHÍ THEO DIỆN CHÍNH SÁCH 135'
      },
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 8).toISOString()
    },
    // Case 15
    {
      id: 'CASE-2026-015',
      studentId: 'usr_student_04',
      studentName: 'Vũ Đức Anh',
      studentCode: 'SV2026-1004',
      title: 'Đơn đề nghị cộng điểm rèn luyện đạt giải Cuộc thi Sáng tạo Robot',
      category: 'COMMUNITY_SERVICE',
      priority: 'MEDIUM',
      description: 'Đội thi của em đạt Giải Nhì cuộc thi Robocon cấp trường và tham gia hỗ trợ kỹ thuật ngày hội Open Day hướng nghiệp tuyển sinh.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_chung_nhan_nghien_cuu_khoa_hoc.webp',
          fileUrl: '/uploads/giay_chung_nhan_nghien_cuu_khoa_hoc.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Giay_Chung_Nhan_Robocon_2026.png',
            originalSize: '4.10 MB',
            compressedSize: '162.0 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_DRL_INNOVATION_COMPETITION (+15đ)',
        confidence: 0.96,
        suggestedAction: 'HỢP LỆ - CỘNG 15 ĐIỂM TIÊU CHÍ 3'
      },
      createdAt: new Date(Date.now() - 3600000 * 7).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 7).toISOString()
    },
    // Case 16
    {
      id: 'CASE-2026-016',
      studentId: 'usr_student_05',
      studentName: 'Đặng Thu Thảo',
      studentCode: 'SV2026-1005',
      title: 'Đơn xin gia hạn nộp học phí học kỳ do gia đình gặp sự cố kinh tế',
      category: 'TUITION_DISCOUNT',
      priority: 'MEDIUM',
      description: 'Gia đình em chưa kịp thu hoạch nông sản để đóng học phí đúng hạn, kính xin nhà trường cho phép gia hạn nộp học phí đến hết ngày 30/11/2026.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'don_xin_ho_tro_lu_lut_mien_trung.webp',
          fileUrl: '/uploads/don_xin_ho_tro_lu_lut_mien_trung.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Don_Cam_Ket_Gia_Han_Hoc_Phi.pdf.png',
            originalSize: '2.50 MB',
            compressedSize: '124.0 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_TUITION_EXTENSION_ALLOWED (Tối đa 60 ngày)',
        confidence: 0.95,
        suggestedAction: 'ĐỒNG Ý GIA HẠN ĐẾN 30/11/2026'
      },
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 6).toISOString()
    },
    // Case 17
    {
      id: 'CASE-2026-017',
      studentId: 'usr_student_06',
      studentName: 'Bùi Gia Bảo',
      studentCode: 'SV2026-1006',
      title: 'Đăng ký nhận Học bổng Tài trợ Quốc tế trao đổi sinh viên',
      category: 'ACADEMIC_SCHOLARSHIP',
      priority: 'HIGH',
      description: 'Em đủ điều kiện tham gia chương trình trao đổi sinh viên 1 học kỳ tại Đại học Quốc gia Singapore (NUS) và xin xét trợ cấp vé máy bay và sinh hoạt phí.',
      status: 'RESUBMITTED',
      evidenceFiles: [
        {
          fileName: 'chung_chi_ielts_80_quoc_te.webp',
          fileUrl: '/uploads/chung_chi_ielts_80_quoc_te.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Letter_Of_Acceptance_NUS_Exchange.png',
            originalSize: '3.70 MB',
            compressedSize: '150.0 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      supplementHistory: [
        {
          note: 'Đã bổ sung Thư chấp thuận chính thức từ phòng Hợp tác Quốc tế NUS.',
          submittedAt: new Date(Date.now() - 3600000 * 1).toISOString()
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_INTERNATIONAL_EXCHANGE_GRANT',
        confidence: 0.98,
        suggestedAction: 'DUYỆT TÀI TRỢ 25.000.000 VNĐ TRAO ĐỔI'
      },
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 1).toISOString()
    },
    // Case 18
    {
      id: 'CASE-2026-018',
      studentId: 'usr_student_07',
      studentName: 'Đỗ Ngọc Ánh',
      studentCode: 'SV2026-1007',
      title: 'Đơn xin hỗ trợ chi phí thuê ký túc xá cho sinh viên nghèo vượt khó',
      category: 'EMERGENCY_AID',
      priority: 'MEDIUM',
      description: 'Em ở vùng sâu vùng xa lên thành phố trọ học, điều kiện kinh tế eo hẹp, kính mong ban quản lý xét duyệt cho em vào ở Ký túc xá khu B với mức phí hỗ trợ.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_xac_nhan_can_ngheo_2026.webp',
          fileUrl: '/uploads/giay_xac_nhan_can_ngheo_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Xac_Nhan_Hoan_Canh_Gia_Dinh_Kho_Khan.png',
            originalSize: '2.90 MB',
            compressedSize: '136.0 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_DORMITORY_AID_PRIORITY',
        confidence: 0.94,
        suggestedAction: 'BỐ TRÍ PHÒNG KÝ TÚC XÁ MIỄN PHÍ'
      },
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    // Case 19
    {
      id: 'CASE-2026-019',
      studentId: 'usr_student_08',
      studentName: 'Hoàng Quốc Việt',
      studentCode: 'SV2026-1008',
      title: 'Đơn xin nghỉ học tạm thời bảo lưu kết quả học tập vì lý do sức khỏe',
      category: 'TUITION_DISCOUNT',
      priority: 'MEDIUM',
      description: 'Em cần thời gian điều trị phục hồi chức năng sau tai nạn giao thông, kính đề nghị Ban Đào tạo cho phép bảo lưu kết quả học tập trong 01 học kỳ.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_xac_nhan_benh_vien_2026.webp',
          fileUrl: '/uploads/giay_xac_nhan_benh_vien_2026.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Chi_Dinh_Nghi_Duong_Benh_Vien.png',
            originalSize: '3.30 MB',
            compressedSize: '145.0 KB',
            savedRatio: '95%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Mock AI Rules',
        policyRuleMatch: 'RULE_ACADEMIC_SUSPENSION_HEALTH',
        confidence: 0.97,
        suggestedAction: 'DUYỆT BẢO LƯU 01 HỌC KỲ HỢP LỆ'
      },
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    // Case 20
    {
      id: 'CASE-2026-020',
      studentId: 'usr_student_09',
      studentName: 'Ngô Thanh Hằng',
      studentCode: 'SV2026-1009',
      title: 'Đăng ký xét Học bổng Tinh hoa Khởi nghiệp Sinh viên 2026',
      category: 'ACADEMIC_SCHOLARSHIP',
      priority: 'HIGH',
      description: 'Dự án "Ứng dụng AI phát hiện sâu bệnh trên cây sầu riêng" của nhóm em lọt vào Top 5 cuộc thi Khởi nghiệp Đổi mới Sáng tạo Quốc gia.',
      status: 'SUBMITTED',
      evidenceFiles: [
        {
          fileName: 'giay_chung_nhan_nghien_cuu_khoa_hoc.webp',
          fileUrl: '/uploads/giay_chung_nhan_nghien_cuu_khoa_hoc.webp',
          mimeType: 'image/webp',
          isOptimized: true,
          metadata: {
            originalName: 'Chung_Nhan_Top5_Techfest_2026.png',
            originalSize: '4.60 MB',
            compressedSize: '170.0 KB',
            savedRatio: '96%',
            dimensions: '800 x 1100 px'
          }
        }
      ],
      aiExtraction: {
        modeUsed: 'Live Gemini 1.5 Flash',
        policyRuleMatch: 'RULE_STARTUP_INNOVATION_GRANT',
        confidence: 0.98,
        suggestedAction: 'ĐẠT HỌC BỔNG KHỞI NGHIỆP 15.000.000 VNĐ'
      },
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 1).toISOString()
    }
  ];

  console.log('--- 4. Building Clean Audits Log ---');
  const auditsData = casesData.map((c, i) => ({
    id: `aud_init_${100 + i}`,
    action: 'CASE_SUBMITTED',
    caseId: c.id,
    actor: {
      id: c.studentId,
      username: allUsers.find(u => u.id === c.studentId)?.username || 'student',
      name: c.studentName,
      role: 'STUDENT'
    },
    reason: `Sinh viên nộp hồ sơ "${c.title}" lên hệ thống xét duyệt`,
    timestamp: c.createdAt
  }));

  const finalDbData = {
    users: allUsers,
    cases: casesData,
    audits: auditsData
  };

  const dbPath = path.join(__dirname, '..', 'shared', 'data.json');
  fs.writeFileSync(dbPath, JSON.stringify(finalDbData, null, 2), 'utf-8');
  console.log(`Successfully wrote ${allUsers.length} users and ${casesData.length} pending cases to ${dbPath}`);
}

seed().catch(err => {
  console.error('Seed Error:', err);
  process.exit(1);
});

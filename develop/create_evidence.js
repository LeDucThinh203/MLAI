const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function createEvidenceImages() {
  // 1. Giấy Xác Nhận Hộ Cận Nghèo
  const svg1 = `
  <svg width="800" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#fffdfa"/>
    <rect x="30" y="30" width="740" height="1020" fill="none" stroke="#b45309" stroke-width="4" stroke-dasharray="10,5"/>
    <rect x="40" y="40" width="720" height="1000" fill="none" stroke="#b45309" stroke-width="1.5"/>
    
    <!-- Header -->
    <text x="400" y="80" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#1e293b">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</text>
    <text x="400" y="105" font-family="sans-serif" font-size="13" font-style="italic" text-anchor="middle" fill="#334155">Độc lập - Tự do - Hạnh phúc</text>
    <line x1="300" y1="115" x2="500" y2="115" stroke="#334155" stroke-width="1"/>
    
    <text x="80" y="150" font-family="sans-serif" font-size="13" font-weight="bold" fill="#1e293b">ỦY BAN NHÂN DÂN PHƯỜNG LINH TRUNG</text>
    <text x="80" y="170" font-family="sans-serif" font-size="11" fill="#64748b">Số: 142/GCN-UBND</text>
    <text x="720" y="170" font-family="sans-serif" font-size="11" font-style="italic" text-anchor="end" fill="#64748b">TP. Thủ Đức, ngày 15 tháng 01 năm 2026</text>
    
    <!-- Title -->
    <text x="400" y="240" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#b45309">GIẤY XÁC NHẬN HỘ CẬN NGHÈO</text>
    <text x="400" y="265" font-family="sans-serif" font-size="13" font-style="italic" text-anchor="middle" fill="#64748b">(Phục vụ xét miễn giảm học phí &amp; hỗ trợ chi phí học tập năm 2026)</text>
    
    <!-- Body -->
    <text x="80" y="325" font-family="sans-serif" font-size="15" font-weight="bold" fill="#1e293b">ỦY BAN NHÂN DÂN PHƯỜNG LINH TRUNG CHỨNG NHẬN:</text>
    
    <text x="80" y="375" font-family="sans-serif" font-size="14" fill="#334155">Họ và tên sinh viên: <tspan font-weight="bold" fill="#0f172a">NGUYỄN VĂN AN</tspan></text>
    <text x="80" y="415" font-family="sans-serif" font-size="14" fill="#334155">Ngày sinh: <tspan font-weight="bold" fill="#0f172a">12/08/2004</tspan>      Mã số SV: <tspan font-weight="bold" fill="#0f172a">SV2026-9921</tspan></text>
    <text x="80" y="455" font-family="sans-serif" font-size="14" fill="#334155">Hiện đang là sinh viên Khoa: <tspan font-weight="bold" fill="#0f172a">Công Nghệ Thông Tin</tspan></text>
    <text x="80" y="495" font-family="sans-serif" font-size="14" fill="#334155">Hộ khẩu thường trú: <tspan font-weight="bold" fill="#0f172a">Số 45/12 Đường Số 6, Phường Linh Trung, TP. Thủ Đức</tspan></text>
    
    <text x="80" y="555" font-family="sans-serif" font-size="14" fill="#334155">Họ tên chủ hộ: <tspan font-weight="bold" fill="#0f172a">Nguyễn Văn Bình</tspan> (Quan hệ: Bố đẻ)</text>
    <text x="80" y="595" font-family="sans-serif" font-size="14" fill="#334155">Mã số quản lý sổ hộ cận nghèo: <tspan font-weight="bold" fill="#b45309">HN-2026-8812-LT</tspan></text>
    <text x="80" y="635" font-family="sans-serif" font-size="14" fill="#334155">Tình trạng: <tspan font-weight="bold" fill="#059669">Thuộc diện HỘ CẬN NGHÈO theo chuẩn nghèo đa chiều 2026</tspan></text>
    
    <text x="80" y="695" font-family="sans-serif" font-size="13" font-style="italic" fill="#475569">Giấy xác nhận có giá trị sử dụng trong học kỳ 1 và học kỳ 2 năm học 2026 - 2027.</text>
    
    <!-- Stamp & Signature -->
    <text x="560" y="780" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#1e293b">TM. ỦY BAN NHÂN DÂN</text>
    <text x="560" y="800" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#1e293b">CHỦ TỊCH</text>
    
    <!-- Red Seal Circle -->
    <circle cx="560" cy="880" r="55" fill="none" stroke="#dc2626" stroke-width="4" opacity="0.85"/>
    <circle cx="560" cy="880" r="42" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.85"/>
    <text x="560" y="865" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">UBND PHƯỜNG LINH TRUNG</text>
    <text x="560" y="885" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">★ ĐÃ XÁC THỰC ★</text>
    <text x="560" y="900" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">TP. THỦ ĐỨC - TP.HCM</text>
    
    <text x="560" y="980" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#1e293b">Trần Đình Dũng</text>
  </svg>`;

  // 2. Giấy Khen Mùa Hè Xanh
  const svg2 = `
  <svg width="900" height="650" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#fefce8"/>
    <rect x="25" y="25" width="850" height="600" fill="none" stroke="#ca8a04" stroke-width="6"/>
    <rect x="35" y="35" width="830" height="580" fill="none" stroke="#0284c7" stroke-width="2" stroke-dasharray="8,4"/>
    
    <text x="450" y="80" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#0369a1">ĐOÀN TNCS HỒ CHÍ MINH - HỘI SINH VIÊN VIỆT NAM</text>
    <text x="450" y="105" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#64748b">BAN CHỈ HỦY CHIẾN DỊCH TÌNH NGUYỆN MÙA HÈ XANH 2026</text>
    <line x1="320" y1="115" x2="580" y2="115" stroke="#0369a1" stroke-width="1.5"/>
    
    <text x="450" y="180" font-family="sans-serif" font-size="32" font-weight="900" text-anchor="middle" fill="#dc2626">GIẤY CHỨNG NHẬN</text>
    <text x="450" y="215" font-family="sans-serif" font-size="15" font-style="italic" text-anchor="middle" fill="#0284c7">HOÀN THÀNH XUẤT SẮC CHIẾN DỊCH TÌNH NGUYỆN MÙA HÈ XANH</text>
    
    <text x="450" y="270" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#334155">Ban Chỉ Huy Chiến Dịch Trân Trọng Chứng Nhận:</text>
    <text x="450" y="315" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle" fill="#0f172a">NGUYỄN VĂN AN</text>
    
    <text x="450" y="355" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#334155">Chiến sĩ Đội hình Chuyển đổi số &amp; Phổ cập Tin học cộng đồng</text>
    <text x="450" y="385" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#334155">Địa bàn công tác: Xã Long Hòa, Huyện Cần Giờ (01/07/2026 - 31/07/2026)</text>
    
    <text x="450" y="430" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#059669">ĐƯỢC CỘNG 15 ĐIỂM RÈN LUYỆN (TIÊU CHÍ HOẠT ĐỘNG TÌNH NGUYỆN KỲ 1)</text>
    
    <!-- Stamp & Sign -->
    <text x="680" y="490" font-family="sans-serif" font-size="12" font-style="italic" text-anchor="middle" fill="#64748b">TP. Hồ Chí Minh, ngày 05 tháng 08 năm 2026</text>
    <text x="680" y="515" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#1e293b">CHỈ HUY TRƯỞNG CHIẾN DỊCH</text>
    
    <circle cx="680" cy="555" r="42" fill="none" stroke="#dc2626" stroke-width="3" opacity="0.8"/>
    <text x="680" y="550" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">BCH ĐOÀN TRƯỜNG ĐẠI HỌC</text>
    <text x="680" y="565" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">★ ĐÃ CHỨNG NHẬN ★</text>
    <text x="680" y="605" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#1e293b">Nguyễn Lê Bảo Nam</text>
  </svg>`;

  // 3. Bảng Điểm Học Bổng
  const svg3 = `
  <svg width="800" height="980" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <rect x="30" y="30" width="740" height="920" fill="none" stroke="#334155" stroke-width="2"/>
    
    <text x="400" y="70" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="#1e293b">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ &amp; KỸ THUẬT</text>
    <text x="400" y="95" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#0284c7">PHÒNG ĐÀO TẠO &amp; CÔNG TÁC SINH VIÊN</text>
    <line x1="250" y1="105" x2="550" y2="105" stroke="#0284c7" stroke-width="1.5"/>
    
    <text x="400" y="160" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#1e293b">BẢNG ĐIỂM TỔNG KẾT &amp; XÉT HỌC BỔNG</text>
    <text x="400" y="185" font-family="sans-serif" font-size="13" font-style="italic" text-anchor="middle" fill="#64748b">Năm học: 2025 - 2026 | Học kỳ: 2</text>
    
    <text x="60" y="240" font-family="sans-serif" font-size="13" fill="#1e293b">Sinh viên: <tspan font-weight="bold">NGUYỄN VĂN AN</tspan></text>
    <text x="450" y="240" font-family="sans-serif" font-size="13" fill="#1e293b">Mã số sinh viên: <tspan font-weight="bold">SV2026-9921</tspan></text>
    <text x="60" y="270" font-family="sans-serif" font-size="13" fill="#1e293b">Lớp: <tspan font-weight="bold">22DTH03</tspan></text>
    <text x="450" y="270" font-family="sans-serif" font-size="13" fill="#1e293b">Ngành: <tspan font-weight="bold">Kỹ Thuật Phần Mềm</tspan></text>
    
    <!-- Table Header -->
    <rect x="60" y="310" width="680" height="35" fill="#0f172a"/>
    <text x="80" y="333" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">STT</text>
    <text x="130" y="333" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">TÊN HỌC PHẦN</text>
    <text x="450" y="333" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">TÍN CHỈ</text>
    <text x="540" y="333" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">ĐIỂM (10)</text>
    <text x="640" y="333" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">ĐIỂM CHỮ</text>
    
    <rect x="60" y="345" width="680" height="30" fill="#f8fafc"/>
    <text x="80" y="365" font-family="sans-serif" font-size="12" fill="#1e293b">1</text>
    <text x="130" y="365" font-family="sans-serif" font-size="12" fill="#1e293b">Kiến trúc Phần mềm Nâng cao</text>
    <text x="460" y="365" font-family="sans-serif" font-size="12" fill="#1e293b">4</text>
    <text x="560" y="365" font-family="sans-serif" font-size="12" font-weight="bold" fill="#059669">9.2</text>
    <text x="660" y="365" font-family="sans-serif" font-size="12" font-weight="bold" fill="#059669">A+</text>
    
    <rect x="60" y="375" width="680" height="30" fill="#ffffff"/>
    <text x="80" y="395" font-family="sans-serif" font-size="12" fill="#1e293b">2</text>
    <text x="130" y="395" font-family="sans-serif" font-size="12" fill="#1e293b">Hệ thống Phân tán &amp; Cloud</text>
    <text x="460" y="395" font-family="sans-serif" font-size="12" fill="#1e293b">3</text>
    <text x="560" y="395" font-family="sans-serif" font-size="12" font-weight="bold" fill="#059669">8.8</text>
    <text x="660" y="395" font-family="sans-serif" font-size="12" font-weight="bold" fill="#059669">A</text>
    
    <rect x="60" y="405" width="680" height="30" fill="#f8fafc"/>
    <text x="80" y="425" font-family="sans-serif" font-size="12" fill="#1e293b">3</text>
    <text x="130" y="425" font-family="sans-serif" font-size="12" fill="#1e293b">Học máy &amp; Khai phá Dữ liệu</text>
    <text x="460" y="425" font-family="sans-serif" font-size="12" fill="#1e293b">4</text>
    <text x="560" y="425" font-family="sans-serif" font-size="12" font-weight="bold" fill="#059669">9.5</text>
    <text x="660" y="425" font-family="sans-serif" font-size="12" font-weight="bold" fill="#059669">A+</text>

    <!-- Total Result -->
    <rect x="60" y="460" width="680" height="75" fill="#ecfdf5" stroke="#059669" stroke-width="1.5" rx="6"/>
    <text x="80" y="490" font-family="sans-serif" font-size="14" font-weight="bold" fill="#065f46">ĐIỂM TRUNG BÌNH HỌC KỲ (GPA): 3.86 / 4.0  (9.18 / 10)</text>
    <text x="80" y="515" font-family="sans-serif" font-size="13" font-weight="bold" fill="#059669">XẾP LOẠI: XUẤT SẮC ★ ĐỦ ĐIỀU KIỆN NHẬN HỌC BỔNG LOẠI A</text>
    
    <text x="550" y="600" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#1e293b">TRƯỞNG PHÒNG ĐÀO TẠO</text>
    <circle cx="550" cy="650" r="40" fill="none" stroke="#dc2626" stroke-width="3" opacity="0.8"/>
    <text x="550" y="655" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#dc2626" opacity="0.9">★ PHÒNG ĐÀO TẠO ★</text>
  </svg>`;

  await sharp(Buffer.from(svg1)).webp({ quality: 90 }).toFile(path.join(uploadsDir, 'giay_xac_nhan_can_ngheo_2026.webp'));
  await sharp(Buffer.from(svg2)).webp({ quality: 90 }).toFile(path.join(uploadsDir, 'giay_khen_mua_he_xanh_2026.webp'));
  await sharp(Buffer.from(svg3)).webp({ quality: 90 }).toFile(path.join(uploadsDir, 'bang_diem_hoc_bong_xuat_sac.webp'));

  console.log('✅ Generated 3 high quality demo evidence WebP certificates successfully!');
}

createEvidenceImages().catch(console.error);

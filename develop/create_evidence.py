"""
============================================================================
CASEFLOW AI - CREATE EVIDENCE SCRIPT (PYTHON MODULE)
============================================================================
Tạo các tệp ảnh minh chứng thực tế phục vụ kiểm thử và trình diễn hệ thống.
============================================================================
"""

import os
import io
from PIL import Image, ImageDraw, ImageFont

uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)


def create_evidence_image(filename: str, title: str, subtitle: str, badge_text: str = "ĐÃ XÁC THỰC", primary_color=(180, 83, 9)):
    """Tạo tệp ảnh minh chứng WebP chất lượng cao."""
    filepath = os.path.join(uploads_dir, filename)
    width, height = 800, 1080

    img = Image.new('RGB', (width, height), color=(255, 253, 250))
    draw = ImageDraw.Draw(img)

    # Khung viền đôi
    draw.rectangle([30, 30, width - 30, height - 30], outline=primary_color, width=4)
    draw.rectangle([40, 40, width - 40, height - 40], outline=primary_color, width=1)

    # Quốc hiệu
    draw.text((width // 2, 70), "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", fill=(30, 41, 59), anchor="mm")
    draw.text((width // 2, 95), "Độc lập - Tự do - Hạnh phúc", fill=(51, 65, 85), anchor="mm")
    draw.line([(width // 2 - 100, 108), (width // 2 + 100, 108)], fill=(51, 65, 85), width=2)

    # Cơ quan ban hành
    draw.text((60, 150), "ỦY BAN NHÂN DÂN / BAN CHỈ HUY", fill=(30, 41, 59))
    draw.text((60, 175), "Số: 142/GCN-XN-2026", fill=(100, 116, 139))
    draw.text((width - 60, 175), "TP. Hồ Chí Minh, ngày 15/01/2026", fill=(100, 116, 139), anchor="ra")

    # Tiêu đề chính
    draw.text((width // 2, 240), title, fill=primary_color, anchor="mm")
    draw.text((width // 2, 275), subtitle, fill=(100, 116, 139), anchor="mm")

    # Khung nội dung
    draw.rectangle([60, 320, width - 60, 750], fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    
    # Nội dung chi tiết
    y = 350
    lines = [
        "Họ và tên sinh viên: NGUYỄN VĂN AN",
        "Mã số SV: SV2026-9921        Khoa: Công Nghệ Thông Tin",
        "Mã định danh văn bản: VB-2026-XN-8812",
        "Đơn vị chứng thực: Hội đồng Thẩm định & Cơ quan ban hành",
        "Tình trạng xác thực: Hợp lệ 100% theo chuẩn quy chế 2026",
        "Thời hạn sử dụng: Năm học 2025 - 2026",
        "Chữ ký số điện tử: SHA-256 Verified (e83b1a9f...9c2e01)"
    ]
    for line in lines:
        draw.text((85, y), line, fill=(51, 65, 85))
        y += 50

    # Dấu mộc đỏ giả lập
    seal_center = (width - 200, height - 200)
    draw.ellipse([seal_center[0] - 65, seal_center[1] - 65, seal_center[0] + 65, seal_center[1] + 65], outline=(220, 38, 38), width=4)
    draw.ellipse([seal_center[0] - 52, seal_center[1] - 52, seal_center[0] + 52, seal_center[1] + 52], outline=(220, 38, 38), width=1)
    draw.text(seal_center, badge_text, fill=(220, 38, 38), anchor="mm")

    # Lưu sang WebP
    img.save(filepath, format='WEBP', quality=85)
    print(f"✅ Đã tạo minh chứng: {filename}")


def main():
    print("--- 1. Tạo các tệp ảnh minh chứng WebP chất lượng cao ---")
    evidences = [
        ("giay_xac_nhan_can_ngheo_2026.webp", "GIẤY XÁC NHẬN HỘ CẬN NGHÈO", "UBND Phường Linh Trung - Năm 2026", "★ ĐÃ XÁC THỰC ★", (180, 83, 9)),
        ("bang_diem_hoc_bong_xuat_sac.webp", "BẢNG ĐIỂM TÍCH LŨY GPA 3.92", "Khoa Công Nghệ Thông Tin - HK1 2025-2026", "★ ĐÃ CHỨNG NHẬN ★", (5, 150, 105)),
        ("giay_khen_mua_he_xanh_2026.webp", "GIẤY KHEN CHIẾN DỊCH TÌNH NGUYỆN", "Đoàn Thanh Niên & Hội Sinh Viên Thành Phố", "★ KHEN THƯỞNG ★", (217, 119, 6)),
        ("giay_khen_olympic_tin_hoc_2026.webp", "GIẢI NHẤT OLYMPIC TIN HỌC SINH VIÊN", "Hội Tin học Việt Nam & Bộ GD&ĐT", "★ GIẢI NHẤT ★", (79, 70, 229)),
        ("chung_chi_ielts_80_quoc_te.webp", "BẢNG ĐIỂM IELTS ACADEMIC 8.0", "IDP Education / British Council", "★ BAND 8.0 ★", (5, 150, 105)),
        ("giay_xac_nhan_benh_vien_2026.webp", "GIẤY RA VIỆN & CHẨN ĐOÁN Y KHOA", "Bệnh viện Đa khoa Khu vực Thủ Đức", "★ BỆNH VIỆN ★", (220, 38, 38)),
        ("bang_diem_phuc_khao_mon_ctdl.webp", "ĐƠN PHÚC KHẢO ĐIỂM THI HỌC PHẦN", "Phòng Khảo thí & Đảm bảo Chất lượng Giáo dục", "★ PHÚC KHẢO ★", (139, 92, 246)),
        ("don_xin_ho_tro_lu_lut_mien_trung.webp", "XÁC NHẬN THIỆT HẠI THIÊN TAI", "UBND Xã Hải Lăng, Tỉnh Quảng Trị", "★ XÁC NHẬN ★", (2, 132, 199)),
        ("giay_xac_nhan_khuyet_tat_2026.webp", "GIẤY XÁC NHẬN MỨC ĐỘ KHUYẾT TẬT", "Hội đồng Giám định Y khoa Tỉnh Bình Dương", "★ CHỨNG NHẬN ★", (14, 165, 233)),
        ("giay_chung_nhan_nghien_cuu_khoa_hoc.webp", "GIẤY CHỨNG NHẬN ĐỀ TÀI NCKH CẤP TRƯỜNG", "Phòng Khoa học Công nghệ & Hợp tác Quốc tế", "★ GIẢI XUẤT SẮC ★", (79, 70, 229)),
        ("test_evidence.png", "MINH CHỨNG KIỂM THỬ HỆ THỐNG", "CaseFlow AI Automated Testing Framework", "★ TEST VERIFIED ★", (5, 150, 105))
    ]
    for fn, t, sub, b, c in evidences:
        create_evidence_image(fn, t, sub, b, c)


if __name__ == '__main__':
    main()

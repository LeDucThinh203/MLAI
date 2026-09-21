import os
from PIL import Image, ImageDraw, ImageFilter

output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test-data", "evidence"))
os.makedirs(output_dir, exist_ok=True)

def create_receipt(filename, title, tx_id, student_id, amount, status, is_blurry=False):
    width, height = 600, 400
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Border
    draw.rectangle([10, 10, width - 10, height - 10], outline=(40, 40, 40), width=2)
    draw.rectangle([15, 15, width - 15, 70], fill=(240, 245, 250))

    # Header
    draw.text((30, 25), title, fill=(10, 30, 80))
    draw.text((30, 45), "BIEN LAI GIAO DICH CHUYEN KHOAN HOC PHI", fill=(80, 80, 80))

    # Details
    y = 90
    draw.text((30, y), f"Ma giao dich (TxID): {tx_id}", fill=(0, 0, 0))
    draw.text((30, y + 35), f"Ma so sinh vien (MSSV): {student_id}", fill=(0, 0, 0))
    draw.text((30, y + 70), f"So tien thanh toan: {amount} VND", fill=(0, 100, 0) if not is_blurry else (180, 180, 180))
    draw.text((30, y + 105), f"Ngay thanh toan: 2026-09-20", fill=(0, 0, 0))
    draw.text((30, y + 140), f"Noi dung: Nop hoc phi HK1 nam hoc 2026-2027", fill=(0, 0, 0))
    draw.text((30, y + 175), f"Trang thai: {status}", fill=(0, 128, 0))

    # Footer
    draw.line([(30, 330), (width - 30, 330)], fill=(200, 200, 200), width=1)
    draw.text((30, 345), "Ngan hang xac nhan giao dich dien tu hop le", fill=(100, 100, 100))

    if is_blurry:
        # Apply heavy blur to simulate unreadable / damaged receipt
        img = img.filter(ImageFilter.GaussianBlur(radius=8))

    path = os.path.join(output_dir, filename)
    img.save(path)
    print(f"Generated {path}")

# 1. Clear Receipt (Matches 10.5M)
create_receipt("receipt_clear.png", "NGAN HANG TMCP TECHCOMBANK", "FT-2026-001", "SV2026-001", "10,500,000", "SUCCESS")

# 2. Conflict Receipt (Shows 12.5M, conflicts with 10.5M)
create_receipt("receipt_conflict.png", "NGAN HANG TMCP VIETCOMBANK", "FT-2026-002", "SV2026-002", "12,500,000", "SUCCESS")

# 3. Blurry Receipt (Unreadable amount and ID)
create_receipt("receipt_blurry.png", "NGAN HANG TMCP QUAN DOI", "FT-XXXX", "SV-XXXX", "???,???,???", "UNKNOWN", is_blurry=True)

# 4. High-Value Receipt (>50M VND -> 85,000,000 VND)
create_receipt("receipt_high_value.png", "NGAN HANG TMCP BIDV", "FT-2026-005", "SV2026-005", "85,000,000", "SUCCESS")

# 5. SIS Portal Screenshot
def create_sis_screenshot(filename):
    width, height = 650, 420
    img = Image.new("RGB", (width, height), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Top Navbar
    draw.rectangle([0, 0, width, 50], fill=(30, 41, 59))
    draw.text((20, 18), "STUDENT INFORMATION SYSTEM (SIS) - PORTAL HOC VU", fill=(255, 255, 255))

    # Content Box
    draw.rectangle([20, 70, width - 20, height - 20], fill=(255, 255, 255), outline=(226, 232, 240))
    draw.text((40, 90), "THONG TIN HOC PHI SINH VIEN (TRA CUU DONG TIEN)", fill=(15, 23, 42))
    draw.text((40, 130), "Ma sinh vien: SV2026-001", fill=(71, 85, 105))
    draw.text((40, 160), "Hoc phi phai dong: 10,500,000 VND", fill=(71, 85, 105))
    draw.text((40, 190), "So tien da ghi nhan: 0 VND", fill=(220, 38, 38))
    draw.text((40, 220), "Trang thai: UNPAID (CHUA HOAN THANH)", fill=(220, 38, 38))
    draw.text((40, 260), "Ghi chu: Sinh vien bi tam khoa dang ky tin chi do chua dong hoc phi.", fill=(100, 116, 139))

    path = os.path.join(output_dir, filename)
    img.save(path)
    print(f"Generated {path}")

create_sis_screenshot("sis_screenshot.png")

# 6. Inter-Department Dispute Petition Letter
def create_dispute_letter(filename):
    width, height = 650, 420
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, width - 10, height - 10], outline=(100, 100, 100), width=2)
    draw.text((30, 30), "DON DE NGHI GIAI QUYET TRANH CHAP HO SO HOC VU", fill=(10, 30, 80))
    draw.text((30, 70), "Kinh gui: Phong Cong tac Sinh vien (Ban Trong tai)", fill=(0, 0, 0))
    draw.text((30, 110), "Sinh vien: Tran Thi D - MSSV: SV2026-004", fill=(0, 0, 0))
    draw.text((30, 150), "Van de: Ho so mac ket giua Phong Dao tao va Phong Ke hoach Tai chinh", fill=(180, 0, 0))
    draw.text((30, 190), "- Phong Dao tao yeu cau sang Phong Tai chinh xac nhan da dong tien.", fill=(50, 50, 50))
    draw.text((30, 220), "- Phong Tai chinh xac nhan da thu nhung bao he thong do Phong Dao tao quan ly.", fill=(50, 50, 50))
    draw.text((30, 260), "- Hien ca 2 phong ban chua ben nao chiu chu tri mo khoa dang ky mon.", fill=(50, 50, 50))
    draw.text((30, 310), "De nghi Truong phong Cong tac Sinh vien phan xu va chi dinh don vi giai quyet.", fill=(0, 100, 0))

    path = os.path.join(output_dir, filename)
    img.save(path)
    print(f"Generated {path}")

create_dispute_letter("dispute_letter.png")

"""
============================================================================
CASEFLOW AI - UPLOAD SERVICE (PYTHON MODULE)
============================================================================
Module xử lý tải lên minh chứng, kiểm tra Magic Bytes chống giả mạo đuôi tệp,
quét mã độc PDF và tối ưu hóa hình ảnh sang định dạng WebP bằng Pillow.
============================================================================
"""

import os
import io
import secrets
from datetime import datetime
from PIL import Image

BASE_DATA_DIR = os.environ.get('DATA_DIR', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DATA_DIR, 'uploads')
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def validate_file_buffer(buffer: bytes) -> dict:
    """
    Kiểm tra Magic Bytes & Kiểm tra cấu trúc nội dung file chuyên sâu.
    """
    if not buffer or len(buffer) < 8:
        return {'valid': False, 'detectedType': None, 'error': 'Tệp rỗng hoặc kích thước quá nhỏ.'}

    # PNG: 89 50 4E 47 0D 0A 1A 0A
    if buffer[0:8] == b'\x89PNG\r\n\x1a\n':
        return {'valid': True, 'detectedType': 'image/png', 'isImage': True}

    # JPEG: FF D8 FF
    if buffer[0:3] == b'\xff\xd8\xff':
        return {'valid': True, 'detectedType': 'image/jpeg', 'isImage': True}

    # WebP: RIFF .... WEBP
    if len(buffer) >= 12 and buffer[0:4] == b'RIFF' and buffer[8:12] == b'WEBP':
        return {'valid': True, 'detectedType': 'image/webp', 'isImage': True}

    # PDF: %PDF-
    if buffer[0:5] == b'%PDF-':
        # Kiểm tra cấu trúc PDF: Phải có %%EOF ở 1024 bytes cuối tệp
        tail_chunk = buffer[max(0, len(buffer) - 1024):].decode('ascii', errors='ignore')
        if '%%EOF' not in tail_chunk:
            return {'valid': False, 'detectedType': 'application/pdf', 'error': 'Tệp PDF bị hỏng hoặc thiếu thẻ kết thúc %%EOF.'}

        # Quét phát hiện mã thực thi độc hại nhúng trong PDF
        full_ascii = buffer.decode('ascii', errors='ignore')
        if '/JavaScript' in full_ascii or '/Launch' in full_ascii or '<script' in full_ascii:
            return {'valid': False, 'detectedType': 'application/pdf', 'error': 'Tệp PDF chứa mã lệnh không an toàn (/JavaScript hoặc /Launch).'}

        return {'valid': True, 'detectedType': 'application/pdf', 'isImage': False}

    return {'valid': False, 'detectedType': None, 'error': 'Chữ ký nhị phân không khớp với định dạng tài liệu được hỗ trợ.'}


async def process_and_save_file(file_bytes: bytes, original_name: str, actor: dict, db_service=None) -> dict:
    """
    Xử lý lưu file minh chứng & kiểm tra Magic Bytes chặt chẽ.
    """
    magic_check = validate_file_buffer(file_bytes)
    if not magic_check['valid']:
        raise ValueError(magic_check.get('error') or 'Nội dung file bị hỏng hoặc không đúng định dạng chuẩn (Giả mạo phần mở rộng).')

    random_hash = secrets.token_hex(16)
    is_image = magic_check['isImage']
    file_size = len(file_bytes)

    metadata = {
        'originalName': original_name,
        'originalSize': file_size,
        'compressedSize': file_size,
        'mimeType': magic_check['detectedType'],
        'isOptimized': False,
        'dimensions': None
    }

    if is_image:
        final_file_name = f"evidence-{random_hash}.webp"
        final_file_path = os.path.join(UPLOAD_DIR, final_file_name)

        # Sử dụng Pillow để mở, resize và chuyển sang WebP
        img = Image.open(io.BytesIO(file_bytes))
        img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        
        output_io = io.BytesIO()
        img.save(output_io, format='WEBP', quality=82)
        compressed_bytes = output_io.getvalue()

        with open(final_file_path, 'wb') as f:
            f.write(compressed_bytes)

        metadata['compressedSize'] = len(compressed_bytes)
        metadata['mimeType'] = 'image/webp'
        metadata['isOptimized'] = True
        metadata['dimensions'] = {'width': img.width, 'height': img.height}
        savings_pct = round((1 - len(compressed_bytes) / file_size) * 100) if file_size > 0 else 0
        metadata['savings'] = f"{savings_pct}%"
    else:
        final_file_name = f"doc-{random_hash}.pdf"
        final_file_path = os.path.join(UPLOAD_DIR, final_file_name)
        with open(final_file_path, 'wb') as f:
            f.write(file_bytes)

    result_data = {
        'fileName': final_file_name,
        'fileUrl': f"/api/evidence/{final_file_name}",
        'metadata': metadata
    }

    if db_service:
        await db_service.log_audit({
            'action': 'EVIDENCE_UPLOADED',
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName') or actor.get('username')},
            'input': {'originalName': original_name, 'originalSize': file_size},
            'result': 'SUCCESS',
            'reason': f"Tải lên minh chứng {original_name} thành công (Magic bytes: {magic_check['detectedType']})"
        })

    return result_data


async def process_and_save_avatar(file_bytes: bytes, original_name: str, actor: dict, db_service=None) -> dict:
    """
    Xử lý lưu avatar & chuyển đổi tối ưu sang WebP hình vuông.
    """
    magic_check = validate_file_buffer(file_bytes)
    if not magic_check['valid'] or not magic_check.get('isImage'):
        raise ValueError('Ảnh đại diện không hợp lệ.')

    random_hash = secrets.token_hex(16)
    final_file_name = f"avatar-{random_hash}.webp"
    final_file_path = os.path.join(UPLOAD_DIR, final_file_name)

    img = Image.open(io.BytesIO(file_bytes))
    
    # Cắt vuông ở giữa (Center Crop) 300x300
    width, height = img.size
    min_dim = min(width, height)
    left = (width - min_dim) / 2
    top = (height - min_dim) / 2
    right = (width + min_dim) / 2
    bottom = (height + min_dim) / 2

    img_cropped = img.crop((left, top, right, bottom))
    img_resized = img_cropped.resize((300, 300), Image.Resampling.LANCZOS)

    output_io = io.BytesIO()
    img_resized.save(output_io, format='WEBP', quality=85)
    compressed_bytes = output_io.getvalue()

    with open(final_file_path, 'wb') as f:
        f.write(compressed_bytes)

    file_url = f"/api/avatar/{final_file_name}"

    if db_service:
        await db_service.log_audit({
            'action': 'AVATAR_UPLOADED',
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName') or actor.get('username')},
            'input': {'originalName': original_name, 'originalSize': len(file_bytes), 'compressedSize': len(compressed_bytes)},
            'result': 'SUCCESS',
            'reason': f"Tải lên và tối ưu hóa ảnh đại diện ({original_name}) thành công"
        })

    return {
        'fileName': final_file_name,
        'fileUrl': file_url
    }

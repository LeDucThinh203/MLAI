import os
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse

from app.db.db import db_service
from app.services.upload_service import (
    UPLOAD_DIR,
    process_and_save_file,
    process_and_save_avatar
)
from app.services.ocr_service import extract_document_entities
from app.core.responses import api_response
from app.core.dependencies import get_current_user

router = APIRouter(tags=["Evidence & Uploads"])


@router.post("/api/upload/evidence-ocr")
async def upload_evidence_ocr_endpoint(
    evidence: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    file_bytes = await evidence.read()
    try:
        saved_file = await process_and_save_file(file_bytes, evidence.filename or 'evidence_file', user, db_service)
    except Exception as e:
        return api_response(400, False, str(e), None, 'UPLOAD_ERROR')

    user_db = await db_service.get_user_by_id(user['id'])
    ocr_res = await extract_document_entities(file_bytes, evidence.filename or 'evidence_file', user_db or {})

    ocr_is_live = bool(ocr_res.get('isLive'))
    await db_service.save_evidence_upload({
        'fileName': saved_file['fileName'],
        'ownerId': user['id'],
        'metadata': saved_file['metadata'],
        'ocrData': ocr_res.get('data'),
        'ocrProvider': ocr_res.get('provider'),
        'ocrIsLive': 1 if ocr_is_live else 0
    })

    saved_file['ocrData'] = ocr_res.get('data')
    saved_file['ocrProvider'] = ocr_res.get('provider')
    saved_file['ocrIsLive'] = ocr_is_live
    saved_file['modeUsed'] = ocr_res.get('modeUsed', 'mock')
    saved_file['isFallback'] = ocr_res.get('isFallback', True)
    saved_file['isSynthetic'] = ocr_res.get('isSynthetic', True)

    return api_response(201, True, 'Tải lên và phân tích OCR minh chứng thành công.', {
        'file': saved_file,
        'ocr': ocr_res,
        **saved_file
    })


@router.post("/api/upload/evidence")
async def upload_evidence_endpoint(
    evidence: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    file_bytes = await evidence.read()
    try:
        saved_file = await process_and_save_file(file_bytes, evidence.filename or 'evidence_file', user, db_service)
    except Exception as e:
        return api_response(400, False, str(e), None, 'UPLOAD_ERROR')

    user_db = await db_service.get_user_by_id(user['id'])
    ocr_res = await extract_document_entities(file_bytes, evidence.filename or 'evidence_file', user_db or {})

    ocr_is_live = bool(ocr_res.get('isLive'))
    await db_service.save_evidence_upload({
        'fileName': saved_file['fileName'],
        'ownerId': user['id'],
        'metadata': saved_file['metadata'],
        'ocrData': ocr_res.get('data'),
        'ocrProvider': ocr_res.get('provider'),
        'ocrIsLive': 1 if ocr_is_live else 0
    })

    saved_file['ocrData'] = ocr_res.get('data')
    saved_file['ocrProvider'] = ocr_res.get('provider')
    saved_file['ocrIsLive'] = ocr_is_live
    saved_file['modeUsed'] = ocr_res.get('modeUsed', 'mock')
    saved_file['isFallback'] = ocr_res.get('isFallback', True)
    saved_file['isSynthetic'] = ocr_res.get('isSynthetic', True)

    return api_response(201, True, 'Tải lên và phân tích OCR minh chứng thành công.', {
        'file': saved_file,
        'ocr': ocr_res,
        **saved_file
    })


@router.post("/api/auth/avatar")
@router.post("/api/upload/avatar")
async def upload_avatar_endpoint(
    avatar: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    file_bytes = await avatar.read()
    try:
        saved_avatar = await process_and_save_avatar(file_bytes, avatar.filename or 'avatar.png', user, db_service)
        await db_service.update_user_profile(user['id'], {'avatar': saved_avatar['fileUrl']}, user)
    except Exception as e:
        return api_response(400, False, str(e), None, 'AVATAR_ERROR')

    return api_response(200, True, 'Cập nhật ảnh đại diện thành công.', {
        'avatar': saved_avatar['fileUrl'],
        'user': {**user, 'avatar': saved_avatar['fileUrl']},
        **saved_avatar
    })


@router.get("/api/evidence/{filename}")
async def serve_evidence(filename: str, user: dict = Depends(get_current_user)):
    sanitized_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, sanitized_filename)

    if user['role'] == 'STUDENT':
        owned_upload = await db_service.get_evidence_upload(sanitized_filename, user['id'])
        student_cases = await db_service.get_cases({'studentId': user['id']})
        attached_to_owned_case = any(
            any(f.get('fileName') == sanitized_filename or (f.get('fileUrl') and sanitized_filename in f.get('fileUrl'))
                for f in c.get('evidenceFiles', []))
            for c in student_cases
        )

        if not owned_upload and not attached_to_owned_case:
            await db_service.log_audit({
                'action': 'UNAUTHORIZED_FILE_ACCESS_ATTEMPT',
                'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
                'input': {'requestedFile': sanitized_filename},
                'result': 'BLOCKED',
                'reason': f"Sinh viên {user['username']} cố gắng truy cập trái phép tệp minh chứng {sanitized_filename}"
            })
            return api_response(403, False, 'Bạn không có quyền truy cập tệp minh chứng này.', None, 'FORBIDDEN')

    if not os.path.exists(file_path):
        return api_response(404, False, 'Không tìm thấy tệp minh chứng.', None, 'NOT_FOUND')

    media_type = 'image/webp' if sanitized_filename.endswith('.webp') else 'application/pdf'
    return FileResponse(file_path, media_type=media_type)


@router.get("/api/avatar/{filename}")
async def serve_avatar(filename: str):
    sanitized_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, sanitized_filename)
    if not os.path.exists(file_path):
        return api_response(404, False, 'Không tìm thấy ảnh đại diện.', None, 'NOT_FOUND')
    return FileResponse(file_path, media_type='image/webp')

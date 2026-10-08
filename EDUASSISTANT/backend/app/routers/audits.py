from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Response, Query

from app.db.db import db_service, DEFAULT_AUDIT_PAGE_SIZE, MIN_AUDIT_PAGE_SIZE, MAX_AUDIT_PAGE_SIZE
from app.services.report_service import generate_audits_csv
from app.core.responses import api_response
from app.core.dependencies import get_current_user, require_roles

router = APIRouter(tags=["Audits"])


@router.get("/api/audits")
async def get_audits(
    action: Optional[str] = None,
    caseId: Optional[str] = None,
    actorRole: Optional[str] = None,
    date: Optional[str] = None,
    dateFrom: Optional[str] = None,
    search: Optional[str] = Query(None, max_length=120),
    page: int = Query(1, ge=1),
    pageSize: int = Query(DEFAULT_AUDIT_PAGE_SIZE, ge=MIN_AUDIT_PAGE_SIZE, le=MAX_AUDIT_PAGE_SIZE),
    user: dict = Depends(get_current_user)
):
    filter_dict = {}

    if (user.get('role') or '').upper() == 'STUDENT':
        student_cases = await db_service.get_cases({'studentId': user['id']})
        owned_case_ids = [c['id'] for c in student_cases]
        filter_dict['studentVisibleFor'] = {
            'studentId': user['id'],
            'caseIds': owned_case_ids
        }
    else:
        if action and action != 'ALL':
            filter_dict['action'] = action
        if caseId:
            filter_dict['caseId'] = caseId
        if actorRole and actorRole != 'ALL':
            filter_dict['actorRole'] = actorRole

    if date:
        filter_dict['date'] = date
    if dateFrom:
        filter_dict['dateFrom'] = dateFrom
    if search and search.strip():
        filter_dict['search'] = search

    result = await db_service.get_audits_page(filter_dict, page, pageSize)
    return api_response(200, True, 'Lấy danh sách nhật ký kiểm toán thành công.', result)


@router.get("/api/audits/export-csv")
@router.get("/api/audits/export")
async def export_audits_csv(user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))):
    audits = await db_service.get_audits({})
    csv_str = generate_audits_csv(audits)
    filename = f"EDUASSISTANT_Audit_Trail_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_str.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

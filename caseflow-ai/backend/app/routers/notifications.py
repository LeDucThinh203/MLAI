from fastapi import APIRouter, Depends

from app.db.db import db_service
from app.core.responses import api_response
from app.core.dependencies import get_current_user

router = APIRouter(tags=["Notifications"])


@router.get("/api/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    notifs = await db_service.get_notifications(user['id'])
    return api_response(200, True, 'Lấy thông báo thành công.', notifs)


@router.post("/api/notifications/{notif_id}/read")
@router.put("/api/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db_service.mark_notification_as_read(notif_id, user['id'])
    return api_response(200, True, 'Đã đánh dấu thông báo là đã đọc.')


@router.post("/api/notifications/read-all")
@router.put("/api/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db_service.mark_all_notifications_as_read(user['id'])
    return api_response(200, True, 'Đã đánh dấu tất cả thông báo là đã đọc.')

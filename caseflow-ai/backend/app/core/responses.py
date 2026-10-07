from datetime import datetime
from typing import Any
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse


def api_response(status_code: int, success: bool, message: str, data: Any = None, error: Any = None):
    return JSONResponse(
        status_code=status_code,
        content={
            'success': success,
            'statusCode': status_code,
            'message': message,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'data': data,
            'error': error
        }
    )


async def custom_http_exception_handler(request: Request, exc: Any) -> JSONResponse:
    err_code = 'ERROR'
    status_code = getattr(exc, 'status_code', 500)
    detail = getattr(exc, 'detail', str(exc))
    msg = str(detail)
    if isinstance(detail, dict):
        msg = detail.get('message', str(detail))
        err_code = detail.get('error', 'ERROR')
    elif status_code == 401:
        err_code = 'UNAUTHORIZED'
    elif status_code == 403:
        err_code = 'FORBIDDEN'
    elif status_code == 404:
        err_code = 'NOT_FOUND'

    return JSONResponse(
        status_code=status_code,
        content={
            'success': False,
            'statusCode': status_code,
            'message': msg,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'data': None,
            'error': err_code
        }
    )

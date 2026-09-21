from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter(tags=["Health"])

@router.get("/health")
def check_health(db: Session = Depends(get_db)):
    """Health check validating API and SQL Server database availability."""
    db_status = "healthy"
    overall_status = "healthy"

    try:
        # Check database connectivity safely
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unavailable"
        overall_status = "degraded"

    content = {
        "status": overall_status,
        "services": {
            "api": "healthy",
            "database": db_status
        }
    }

    status_code = status.HTTP_200_OK if overall_status == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=status_code, content=content)

from fastapi import APIRouter
from app.api.routes import (
    cases,
    evidence,
    human_review,
    audit_logs,
    policies,
    departments,
    verify,
    health,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(cases.router)
api_router.include_router(evidence.router)
api_router.include_router(human_review.router)
api_router.include_router(audit_logs.router)
api_router.include_router(policies.router)
api_router.include_router(departments.router)
api_router.include_router(verify.router)

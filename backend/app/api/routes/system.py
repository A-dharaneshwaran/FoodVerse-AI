from fastapi import APIRouter
from app.core.config import settings
from app.schemas.system import SystemStatusResponse, AIConfigStatus
from app.services.ai_service import get_ai_service_status

router = APIRouter(tags=["System"])


@router.get("/system/status", response_model=SystemStatusResponse)
async def system_status():
    """
    Returns actual system configuration status without falsifying database or AI health.
    """
    ai_status_data = get_ai_service_status()

    return SystemStatusResponse(
        backend_status="operational",
        environment=settings.APP_ENV,
        database_status="not_configured",
        ai_status=AIConfigStatus(**ai_status_data),
        planned_modules=[
            "Overview Dashboard",
            "Food Recognition",
            "Freshness Detector",
            "Hygiene & Safety Monitor",
            "Smart Kitchen",
            "Personalized Meal Planner"
        ]
    )

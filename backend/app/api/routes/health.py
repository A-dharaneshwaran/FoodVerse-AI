from fastapi import APIRouter
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.system import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Confirms that the FastAPI backend server is alive and responding."""
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

"""
Smart Kitchen API endpoints.
Provides POST /api/smart-kitchen/assist for AI-powered zero-waste recipe crafting and storage guidance.
"""
import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.schemas.system import (
    SmartKitchenAssistRequest,
    SmartKitchenAssistResponse,
    ErrorResponse
)
from app.services.ai_service import assist_smart_kitchen_nvidia, AIInferenceError

logger = logging.getLogger("foodverse.smart_kitchen")

router = APIRouter(tags=["Smart Kitchen"])


@router.post(
    "/smart-kitchen/assist",
    response_model=SmartKitchenAssistResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input parameters or empty ingredients list"},
        429: {"model": ErrorResponse, "description": "NVIDIA API rate limit or quota exceeded"},
        502: {"model": ErrorResponse, "description": "Upstream AI provider error"},
        503: {"model": ErrorResponse, "description": "AI provider unconfigured or unavailable"},
        504: {"model": ErrorResponse, "description": "AI inference timeout"}
    }
)
async def assist_kitchen(request: SmartKitchenAssistRequest):
    """
    Accepts real selected inventory ingredients and generates grounded storage guidance
    or zero-waste recipe utilization ideas using Meta LLaMA 3.2 Vision.
    """
    if not request.ingredients or len(request.ingredients) == 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": "EMPTY_INGREDIENTS",
                "message": "At least one ingredient must be selected from inventory.",
                "guidance": "Please select one or more items from your kitchen inventory list."
            }
        )

    try:
        result = await assist_smart_kitchen_nvidia(request)
        return result
    except AIInferenceError as aie:
        return JSONResponse(
            status_code=aie.status_code,
            content={
                "error_code": aie.error_code,
                "message": aie.message,
                "guidance": aie.guidance
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in smart kitchen assist endpoint: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": "INTERNAL_ERROR",
                "message": "An internal error occurred while generating kitchen guidance.",
                "guidance": "Please try again later or check server logs."
            }
        )

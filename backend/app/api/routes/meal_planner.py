"""
Personalized Meal Planner API endpoints.
Provides POST /api/meal-planner/generate for structured multi-day personalized meal planning via NVIDIA Meta LLaMA 3.2.
"""
import logging
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.schemas.system import (
    MealPlannerGenerateRequest,
    MealPlannerGenerateResponse,
    ErrorResponse
)
from app.services.ai_service import generate_meal_plan_nvidia, AIInferenceError

logger = logging.getLogger("foodverse.meal_planner")

router = APIRouter(tags=["Meal Planner"])


@router.post(
    "/meal-planner/generate",
    response_model=MealPlannerGenerateResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid preference parameters or payload"},
        429: {"model": ErrorResponse, "description": "NVIDIA API rate limit or quota exceeded"},
        502: {"model": ErrorResponse, "description": "Upstream AI provider error"},
        503: {"model": ErrorResponse, "description": "AI provider unconfigured or unavailable"},
        504: {"model": ErrorResponse, "description": "AI inference timeout"}
    }
)
async def generate_plan(request: MealPlannerGenerateRequest):
    """
    Accepts customized dietary preferences, duration, allergies, and available inventory,
    generating a multi-day structured meal plan with recipe steps, nutrition estimates,
    and a consolidated shopping list.
    """
    if request.duration_days < 1 or request.duration_days > 7:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": "INVALID_DURATION",
                "message": "Meal plan duration must be between 1 and 7 days.",
                "guidance": "Please choose a duration from 1 to 7 days."
            }
        )

    try:
        result = await generate_meal_plan_nvidia(request)
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
        logger.error(f"Unexpected error in meal planner generate endpoint: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": "INTERNAL_ERROR",
                "message": "An internal error occurred while generating your personalized meal plan.",
                "guidance": "Please try again later or check server logs."
            }
        )

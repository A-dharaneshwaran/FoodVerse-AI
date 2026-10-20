"""
Food Recognition API endpoints.
Provides POST /api/food-recognition/analyze for image analysis with NVIDIA Vision.
"""
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse

from app.schemas.system import FoodRecognitionResponse, ErrorResponse
from app.services.image_service import validate_and_process_image, ImageValidationError
from app.services.ai_service import analyze_food_image_nvidia, AIInferenceError

logger = logging.getLogger("foodverse.food_recognition")

router = APIRouter(tags=["Food Recognition"])


@router.post(
    "/food-recognition/analyze",
    response_model=FoodRecognitionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image or payload"},
        429: {"model": ErrorResponse, "description": "NVIDIA API rate limit or quota exceeded"},
        502: {"model": ErrorResponse, "description": "Upstream AI provider error"},
        503: {"model": ErrorResponse, "description": "AI provider unconfigured or unavailable"},
        504: {"model": ErrorResponse, "description": "AI inference timeout"}
    }
)
async def analyze_food_recognition(
    image: UploadFile = File(..., description="Food image file (JPEG, PNG, WebP up to 8MB)")
):
    """
    Accepts multipart food image upload, validates binary contents,
    normalizes dimensions, and prompts NVIDIA Meta LLaMA 3.2 Vision for structured analysis.
    """
    if not image.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "EMPTY_FILENAME", "message": "No image file provided."}
        )

    try:
        # Read uploaded image bytes into memory temporarily
        raw_bytes = await image.read()
    except Exception as e:
        logger.error(f"Error reading uploaded file: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error_code": "FILE_READ_ERROR", "message": "Failed to read uploaded image data."}
        )
    finally:
        await image.close()

    # Image validation & preprocessing
    try:
        data_url, mime_type = validate_and_process_image(raw_bytes)
    except ImageValidationError as ive:
        logger.warning(f"Image validation failed: {ive.error_code} - {ive.message}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": ive.error_code,
                "message": ive.message,
                "guidance": "Please upload a valid JPEG, PNG, or WebP photo under 8 MB."
            }
        )

    # Release raw_bytes from memory
    del raw_bytes

    # Real AI Inference via NVIDIA
    try:
        result = await analyze_food_image_nvidia(data_url)
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
        logger.error(f"Unexpected error in food recognition endpoint: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": "INTERNAL_ERROR",
                "message": "An internal error occurred during food recognition.",
                "guidance": "Please try again later or check server logs."
            }
        )

"""
Hygiene & Kitchen Safety Monitoring API endpoints.
Provides POST /api/hygiene/analyze for visible cross-contamination and sanitary risk inspection via NVIDIA Meta LLaMA 3.2 Vision.
"""
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse

from app.schemas.system import HygieneAnalysisResponse, ErrorResponse
from app.services.image_service import validate_and_process_image, ImageValidationError
from app.services.ai_service import analyze_hygiene_image_nvidia, AIInferenceError

logger = logging.getLogger("foodverse.hygiene")

router = APIRouter(tags=["Hygiene & Safety Monitor"])


@router.post(
    "/hygiene/analyze",
    response_model=HygieneAnalysisResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image or payload"},
        429: {"model": ErrorResponse, "description": "NVIDIA API rate limit or quota exceeded"},
        502: {"model": ErrorResponse, "description": "Upstream AI provider error"},
        503: {"model": ErrorResponse, "description": "AI provider unconfigured or unavailable"},
        504: {"model": ErrorResponse, "description": "AI inference timeout"}
    }
)
async def analyze_hygiene(
    image: UploadFile = File(..., description="Kitchen or food preparation area image file (JPEG, PNG, WebP up to 8MB)")
):
    """
    Accepts multipart food prep area photo upload, validates image contents with Pillow safeguards,
    normalizes dimensions, and prompts NVIDIA Meta LLaMA 3.2 Vision for visual hygiene & safety assessment.
    """
    if not image.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "EMPTY_FILENAME", "message": "No image file provided."}
        )

    try:
        raw_bytes = await image.read()
    except Exception as e:
        logger.error(f"Error reading uploaded file: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error_code": "FILE_READ_ERROR", "message": "Failed to read uploaded image data."}
        )
    finally:
        await image.close()

    try:
        data_url, mime_type = validate_and_process_image(raw_bytes, max_dimension=1024)
    except ImageValidationError as ive:
        logger.warning(f"Hygiene image validation failed: {ive.error_code} - {ive.message}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": ive.error_code,
                "message": ive.message,
                "guidance": "Please upload a valid JPEG, PNG, or WebP photo under 8 MB."
            }
        )

    del raw_bytes

    try:
        result = await analyze_hygiene_image_nvidia(data_url)
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
        logger.error(f"Unexpected error in hygiene endpoint: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": "INTERNAL_ERROR",
                "message": "An internal error occurred during hygiene assessment.",
                "guidance": "Please try again later or check server logs."
            }
        )

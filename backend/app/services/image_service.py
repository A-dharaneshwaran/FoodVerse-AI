"""
Image validation and preprocessing safeguards.
Applies Pillow safeguards against decompression bombs, dimension attacks,
corrupt bytes, and normalizes orientation and scaling for vision models.
"""
import io
import base64
from typing import Tuple
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

# Prevent decompression bomb attacks
Image.MAX_IMAGE_PIXELS = 25_000_000  # Cap at 25 megapixels

ALLOWED_FORMATS = {"JPEG", "JPG", "PNG", "WEBP"}


class ImageValidationError(Exception):
    def __init__(self, message: str, error_code: str = "INVALID_IMAGE"):
        super().__init__(message)
        self.message = message
        self.error_code = error_code


def validate_and_process_image(raw_bytes: bytes, max_dimension: int = None) -> Tuple[str, str]:
    """
    Validates image bytes, enforces size and dimension limits,
    normalizes EXIF orientation, converts RGBA/P to RGB, resizes if oversized,
    and returns (data_url, mime_type).
    """
    if not raw_bytes or len(raw_bytes) == 0:
        raise ImageValidationError("Uploaded image file is empty.", "EMPTY_FILE")

    if len(raw_bytes) > settings.MAX_IMAGE_SIZE_BYTES:
        mb = settings.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
        raise ImageValidationError(f"Image exceeds the maximum allowed size of {mb:.0f}MB.", "IMAGE_TOO_LARGE")

    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image.verify()  # Verifies integrity without loading full raster
    except (UnidentifiedImageError, SyntaxError, ValueError, Exception) as e:
        raise ImageValidationError("The uploaded file is not a valid or readable image.", "INVALID_IMAGE_FORMAT")

    # Re-open for actual processing since verify() closes/invalidates the image object
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        img_format = (image.format or "").upper()
        if img_format == "JPG":
            img_format = "JPEG"

        if img_format not in ALLOWED_FORMATS:
            raise ImageValidationError(
                f"Unsupported image format: {img_format}. Supported formats: JPEG, PNG, WebP.",
                "UNSUPPORTED_FORMAT"
            )

        # Correct orientation based on EXIF tags
        image = ImageOps.exif_transpose(image)

        # Convert to RGB if needed (handling alpha channels, paletted images, CMYK)
        if image.mode in ("RGBA", "LA", "P"):
            rgb_image = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            rgb_image.paste(image, mask=image.split()[-1] if "A" in image.mode else None)
            image = rgb_image
        elif image.mode != "RGB":
            image = image.convert("RGB")

        # Downscale if dimensions exceed limit while maintaining aspect ratio
        max_dim = max_dimension if (max_dimension and max_dimension > 0) else settings.MAX_IMAGE_DIMENSION
        width, height = image.size
        if width > max_dim or height > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        # Save to buffer as optimized JPEG
        out_buf = io.BytesIO()
        image.save(out_buf, format="JPEG", quality=85, optimize=True)
        processed_bytes = out_buf.getvalue()

        # Build data URL
        b64_str = base64.b64encode(processed_bytes).decode("utf-8")
        mime_type = "image/jpeg"
        data_url = f"data:{mime_type};base64,{b64_str}"

        return data_url, mime_type

    except ImageValidationError:
        raise
    except Exception as e:
        raise ImageValidationError("Error occurred while normalizing image data.", "IMAGE_PROCESSING_FAILED")

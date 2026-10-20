import io
import pytest
from PIL import Image
from app.services.image_service import validate_and_process_image, ImageValidationError


def create_test_image(format="JPEG", size=(200, 200), color=(255, 0, 0)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def test_valid_jpeg():
    raw = create_test_image("JPEG")
    data_url, mime = validate_and_process_image(raw)
    assert mime == "image/jpeg"
    assert data_url.startswith("data:image/jpeg;base64,")


def test_valid_png():
    raw = create_test_image("PNG")
    data_url, mime = validate_and_process_image(raw)
    assert mime == "image/jpeg"  # Normalized to JPEG
    assert data_url.startswith("data:image/jpeg;base64,")


def test_empty_bytes():
    with pytest.raises(ImageValidationError) as exc:
        validate_and_process_image(b"")
    assert exc.value.error_code == "EMPTY_FILE"


def test_corrupt_bytes():
    with pytest.raises(ImageValidationError) as exc:
        validate_and_process_image(b"This is not a real image at all!")
    assert exc.value.error_code == "INVALID_IMAGE_FORMAT"


def test_unsupported_format():
    img = Image.new("RGB", (50, 50), color=(0, 255, 0))
    buf = io.BytesIO()
    img.save(buf, format="GIF")
    with pytest.raises(ImageValidationError) as exc:
        validate_and_process_image(buf.getvalue())
    assert exc.value.error_code == "UNSUPPORTED_FORMAT"


def test_oversized_downscaling():
    # 2000x1200 image should be downscaled below MAX_IMAGE_DIMENSION (1536)
    raw = create_test_image("JPEG", size=(2000, 1200))
    data_url, mime = validate_and_process_image(raw)
    assert data_url.startswith("data:image/jpeg;base64,")

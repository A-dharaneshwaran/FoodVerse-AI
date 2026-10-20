import io
import json
import pytest
import httpx
from unittest.mock import patch, AsyncMock
from PIL import Image

from app.main import app
from app.core.config import settings


def create_jpeg(size=(100, 100)) -> io.BytesIO:
    img = Image.new("RGB", size, color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_system_status_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/system/status")
        assert res.status_code == 200
        data = res.json()
        assert "ai_status" in data
        assert "planned_modules" in data


@pytest.mark.asyncio
async def test_missing_api_key_rejection():
    # Ensure AI_API_KEY is unset for this test
    with patch.object(settings, "AI_API_KEY", ""):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            img_buf = create_jpeg()
            files = {"image": ("food.jpg", img_buf, "image/jpeg")}
            res = await client.post("/api/food-recognition/analyze", files=files)
            assert res.status_code == 503
            data = res.json()
            assert data["error_code"] == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_invalid_image_upload():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"image": ("not_an_image.txt", io.BytesIO(b"Hello world"), "image/jpeg")}
        res = await client.post("/api/food-recognition/analyze", files=files)
        assert res.status_code == 400
        data = res.json()
        assert data["error_code"] == "INVALID_IMAGE_FORMAT"


@pytest.mark.asyncio
async def test_successful_analysis_with_mocked_provider():
    mock_model_response = {
        "dish_name": "Mediterranean Quinoa Bowl",
        "confidence_or_certainty_note": "High visual clarity; visible chickpeas, avocado, and spinach.",
        "description": "Vibrant salad bowl with roasted chickpeas and greens.",
        "visible_food_items": ["Cooked quinoa", "Sliced avocado", "Roasted chickpeas", "Baby spinach"],
        "visible_ingredients": ["Quinoa", "Avocado", "Chickpeas", "Spinach", "Cherry tomatoes"],
        "inferred_ingredients": ["Extra virgin olive oil", "Lemon juice dressing", "Sea salt"],
        "estimated_serving_size": "1 bowl (~380g)",
        "estimated_nutrition": {
            "calories_kcal": 460,
            "protein_g": 16.5,
            "carbohydrates_g": 52.0,
            "fat_g": 22.0,
            "fiber_g": 11.0,
            "sodium_mg": 320.0,
            "confidence_note": "Approximate estimate based on visual portion cues only."
        },
        "limitations": ["Dressing oil quantity indeterminate from photograph."],
        "warnings": ["Estimated nutrition only. Not a medical guarantee. Check allergens independently."]
    }

    mock_nvidia_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps(mock_model_response)
                }
            }
        ]
    }

    mock_resp = httpx.Response(200, json=mock_nvidia_payload, request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions"))

    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-key-mock"):
        with patch.object(httpx.AsyncClient, "post", mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("salad.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/food-recognition/analyze", files=files)
                assert res.status_code == 200
                data = res.json()
                assert data["dish_name"] == "Mediterranean Quinoa Bowl"
                assert data["estimated_nutrition"]["calories_kcal"] == 460
                assert data["model_used"] == settings.model_name


@pytest.mark.asyncio
async def test_provider_401_auth_error():
    mock_resp = httpx.Response(401, text="Unauthorized", request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions"))
    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-invalid-key"):
        with patch.object(httpx.AsyncClient, "post", mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("dish.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/food-recognition/analyze", files=files)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_provider_429_rate_limit():
    mock_resp = httpx.Response(429, text="Rate limit exceeded", request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions"))
    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-key"):
        with patch.object(httpx.AsyncClient, "post", mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("dish.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/food-recognition/analyze", files=files)
                assert res.status_code == 429
                assert res.json()["error_code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_provider_timeout_handling():
    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            raise httpx.TimeoutException("Read timed out")
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-key"):
        with patch.object(httpx.AsyncClient, "post", mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("dish.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/food-recognition/analyze", files=files)
                assert res.status_code == 504
                assert res.json()["error_code"] == "PROVIDER_TIMEOUT"


@pytest.mark.asyncio
async def test_malformed_model_output():
    mock_nvidia_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Sorry, I cannot output JSON today!"
                }
            }
        ]
    }
    mock_resp = httpx.Response(200, json=mock_nvidia_payload, request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions"))
    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-key"):
        with patch.object(httpx.AsyncClient, "post", mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("dish.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/food-recognition/analyze", files=files)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_MODEL_OUTPUT"


import io
import json
import pytest
import httpx
from unittest.mock import patch, AsyncMock
from PIL import Image

from app.main import app
from app.core.config import settings


def create_jpeg(size=(100, 100), color=(100, 150, 200)) -> io.BytesIO:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


@pytest.mark.asyncio
async def test_freshness_missing_api_key():
    with patch.object(settings, "AI_API_KEY", ""):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            img_buf = create_jpeg()
            files = {"image": ("apple.jpg", img_buf, "image/jpeg")}
            res = await client.post("/api/freshness/analyze", files=files)
            assert res.status_code == 503
            assert res.json()["error_code"] == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_freshness_invalid_image():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"image": ("corrupt.txt", io.BytesIO(b"Not an image"), "image/jpeg")}
        res = await client.post("/api/freshness/analyze", files=files)
        assert res.status_code == 400
        assert res.json()["error_code"] == "INVALID_IMAGE_FORMAT"


@pytest.mark.asyncio
async def test_freshness_successful_analysis():
    mock_model_response = {
        "food_name": "Honeycrisp Apple",
        "food_category": "fruit",
        "freshness_status": "appears_fresh",
        "visual_condition_score": 92,
        "visible_indicators": ["smooth, taut skin", "vibrant red and yellow pigmentation", "intact stem"],
        "positive_indicators": ["firm surface appearance", "no browning or skin wrinkling"],
        "concerns": [],
        "explanation": "The apple displays healthy skin coloration, taut texture, and absence of visible mold, bruises, or lesions.",
        "recommended_action": "Optimal visual quality; store refrigerated to maintain crispness.",
        "limitations": ["Visual inspection cannot detect internal core rot or microscopic bacterial residues."],
        "safety_warning": "Visual analysis cannot establish whether food is microbiologically safe to eat. Odor, temperature history, pathogens, and storage conditions cannot be verified from a photograph."
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
                files = {"image": ("apple.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/freshness/analyze", files=files)
                assert res.status_code == 200
                data = res.json()
                assert data["food_name"] == "Honeycrisp Apple"
                assert data["food_category"] == "fruit"
                assert data["freshness_status"] == "appears_fresh"
                assert data["visual_condition_score"] == 92
                assert len(data["positive_indicators"]) > 0
                assert "safety_warning" in data
                assert "microbiologically safe" in data["safety_warning"]


@pytest.mark.asyncio
async def test_freshness_cannot_assess_uncertain_food():
    mock_model_response = {
        "food_name": "Unidentified Object",
        "food_category": "unknown",
        "freshness_status": "cannot_assess",
        "visual_condition_score": None,
        "visible_indicators": ["blurry contours", "glare obscuring texture"],
        "positive_indicators": [],
        "concerns": ["insufficient resolution to determine condition"],
        "explanation": "Image is too out of focus or obstructed to evaluate food quality.",
        "recommended_action": "Retake photograph under steady, bright lighting.",
        "limitations": ["Visual characteristics cannot be verified."],
        "safety_warning": "Visual analysis cannot establish whether food is microbiologically safe to eat. Odor, temperature history, pathogens, and storage conditions cannot be verified from a photograph."
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
                files = {"image": ("blurry.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/freshness/analyze", files=files)
                assert res.status_code == 200
                data = res.json()
                assert data["freshness_status"] == "cannot_assess"
                assert data["visual_condition_score"] is None


@pytest.mark.asyncio
async def test_freshness_provider_401_auth_error():
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
                files = {"image": ("food.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/freshness/analyze", files=files)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_freshness_provider_429_rate_limit():
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
                files = {"image": ("food.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/freshness/analyze", files=files)
                assert res.status_code == 429
                assert res.json()["error_code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_freshness_provider_timeout():
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
                files = {"image": ("food.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/freshness/analyze", files=files)
                assert res.status_code == 504
                assert res.json()["error_code"] == "PROVIDER_TIMEOUT"


@pytest.mark.asyncio
async def test_freshness_malformed_model_output():
    mock_nvidia_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Not JSON at all"
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
                files = {"image": ("food.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/freshness/analyze", files=files)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_MODEL_OUTPUT"


@pytest.mark.asyncio
async def test_freshness_markdown_fence_and_preamble_parsing():
    model_json = {
        "food_name": "Strawberries",
        "food_category": "fruit",
        "freshness_status": "appears_fresh",
        "visual_condition_score": 90,
        "visible_indicators": ["bright red color", "green calyx"],
        "positive_indicators": ["firm surface"],
        "concerns": [],
        "explanation": "Fruit exhibits bright natural color without visible decay.",
        "recommended_action": "Refrigerate and consume within 2-3 days.",
        "limitations": ["Internal mold cannot be detected from exterior photo."],
        "safety_warning": "Visual analysis cannot establish whether food is microbiologically safe to eat."
    }
    # Surrounding conversational preamble, markdown code fence, and postscript text
    conversational_content = (
        "Here is my visual freshness evaluation of the strawberry sample:\n\n"
        f"```json\n{json.dumps(model_json, indent=2)}\n```\n\n"
        "Hope this helps with your kitchen inventory management!"
    )

    mock_nvidia_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": conversational_content
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
                files = {"image": ("strawberry.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/freshness/analyze", files=files)
                assert res.status_code == 200
                data = res.json()
                assert data["food_name"] == "Strawberries"
                assert data["freshness_status"] == "appears_fresh"
                assert data["visual_condition_score"] == 90


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
async def test_hygiene_missing_api_key():
    with patch.object(settings, "AI_API_KEY", ""):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            img_buf = create_jpeg()
            files = {"image": ("kitchen.jpg", img_buf, "image/jpeg")}
            res = await client.post("/api/hygiene/analyze", files=files)
            assert res.status_code == 503
            assert res.json()["error_code"] == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_hygiene_invalid_image():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"image": ("corrupt.txt", io.BytesIO(b"Not an image data stream"), "image/jpeg")}
        res = await client.post("/api/hygiene/analyze", files=files)
        assert res.status_code == 400
        assert res.json()["error_code"] == "INVALID_IMAGE_FORMAT"


@pytest.mark.asyncio
async def test_hygiene_successful_analysis():
    mock_model_response = {
        "environment_summary": "Stainless steel commercial preparation station with two poly cutting boards and prep bowls.",
        "overall_assessment": "no_obvious_visible_concerns",
        "confidence": "High",
        "observations": [
            "Countertop surface appears clean and free of visible standing liquid",
            "Cutting boards are segregated with dry knives resting in knife block",
            "No raw meats or uncovered rubbish adjacent to food prep areas"
        ],
        "cleanliness_indicators": [
            "Stainless steel table has reflective, wiped surface",
            "Orderly arrangement of prep equipment"
        ],
        "potential_concerns": [],
        "recommended_actions": [
            "Continue standard chemical sanitization between food prep shifts."
        ],
        "limitations": [
            "Photographic assessment cannot verify microbial sterility or chemical sanitizer concentrations."
        ],
        "safety_disclaimer": "An image-only AI assessment cannot certify hygiene or food safety. Photographic inspection cannot verify microbial sterility, chemical residues, viral contamination, or safe handling practices."
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

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_nvidia_payload,
        request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions")
    )

    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-token"):
        with patch.object(httpx.AsyncClient, "post", new=mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("kitchen_station.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/hygiene/analyze", files=files)

                assert res.status_code == 200
                data = res.json()
                assert data["overall_assessment"] == "no_obvious_visible_concerns"
                assert "Stainless steel" in data["environment_summary"]
                assert data["confidence"] == "High"
                assert len(data["cleanliness_indicators"]) >= 1
                assert len(data["limitations"]) >= 1
                assert "safety_disclaimer" in data
                assert "cannot certify hygiene" in data["safety_disclaimer"]


@pytest.mark.asyncio
async def test_hygiene_cannot_assess_ambiguous_image():
    mock_model_response = {
        "environment_summary": "Extremely dark and blurry scene without discernable kitchen items.",
        "overall_assessment": "cannot_assess",
        "confidence": "Low",
        "observations": ["Image lighting is insufficient to identify kitchen counters or utensils."],
        "cleanliness_indicators": [],
        "potential_concerns": ["Unable to determine if food contact surfaces are clean or contaminated."],
        "recommended_actions": ["Upload a clear, well-lit photograph of the kitchen preparation station."],
        "limitations": ["Visual evidence is insufficient to evaluate kitchen sanitary conditions."],
        "safety_disclaimer": "An image-only AI assessment cannot certify hygiene or food safety."
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

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_nvidia_payload,
        request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions")
    )

    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-token"):
        with patch.object(httpx.AsyncClient, "post", new=mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("blurry.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/hygiene/analyze", files=files)

                assert res.status_code == 200
                data = res.json()
                assert data["overall_assessment"] == "cannot_assess"


@pytest.mark.asyncio
async def test_hygiene_visible_concerns_detected():
    mock_model_response = {
        "environment_summary": "Home kitchen food prep counter with raw chicken breast on a wooden cutting board.",
        "overall_assessment": "visible_concerns",
        "confidence": "High",
        "observations": [
            "Raw poultry pieces resting on porous wood board",
            "Unwashed paring knife touching lettuce leaves next to raw chicken juice"
        ],
        "cleanliness_indicators": [],
        "potential_concerns": [
            "Possible cross-contact between raw poultry fluids and ready-to-eat salad greens",
            "Porous wooden board used for raw meat prep"
        ],
        "recommended_actions": [
            "Immediately segregate ready-to-eat greens from poultry contact",
            "Wash and sanitize all contact surfaces and cutlery with approved disinfectant"
        ],
        "limitations": ["Photographic inspection cannot measure bacterial count or pathogen cross-transfer."],
        "safety_disclaimer": "An image-only AI assessment cannot certify hygiene or food safety."
    }

    mock_nvidia_payload = {
        "choices": [
            {"message": {"role": "assistant", "content": json.dumps(mock_model_response)}}
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_nvidia_payload,
        request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions")
    )

    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-token"):
        with patch.object(httpx.AsyncClient, "post", new=mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("cross_contact.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/hygiene/analyze", files=files)

                assert res.status_code == 200
                data = res.json()
                assert data["overall_assessment"] == "visible_concerns"
                assert len(data["potential_concerns"]) >= 1


@pytest.mark.asyncio
async def test_hygiene_provider_401_auth_error():
    mock_resp = httpx.Response(
        status_code=401,
        text="Unauthorized - invalid api key",
        request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions")
    )

    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-bad-key"):
        with patch.object(httpx.AsyncClient, "post", new=mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("kitchen.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/hygiene/analyze", files=files)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_hygiene_provider_429_rate_limit():
    mock_resp = httpx.Response(
        status_code=429,
        text="Rate limit exceeded",
        request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions")
    )
    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-token"):
        with patch.object(httpx.AsyncClient, "post", new=mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("kitchen.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/hygiene/analyze", files=files)
                assert res.status_code == 429
                assert res.json()["error_code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_hygiene_provider_timeout():
    orig_post = httpx.AsyncClient.post

    async def mock_timeout_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            raise httpx.TimeoutException("Connection timed out")
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-token"):
        with patch.object(httpx.AsyncClient, "post", new=mock_timeout_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("kitchen.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/hygiene/analyze", files=files)
                assert res.status_code == 504
                assert res.json()["error_code"] == "PROVIDER_TIMEOUT"


@pytest.mark.asyncio
async def test_hygiene_malformed_model_output():
    mock_nvidia_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Not a JSON document, I cannot fulfill this request."
                }
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_nvidia_payload,
        request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions")
    )
    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "nvapi-test-token"):
        with patch.object(httpx.AsyncClient, "post", new=mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                img_buf = create_jpeg()
                files = {"image": ("kitchen.jpg", img_buf, "image/jpeg")}
                res = await client.post("/api/hygiene/analyze", files=files)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_MODEL_OUTPUT"

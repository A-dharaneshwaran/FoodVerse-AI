import pytest
import json
import httpx
from unittest.mock import patch

from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_smart_kitchen_missing_api_key():
    with patch.object(settings, "AI_API_KEY", ""):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "mode": "utilization",
                "ingredients": ["Tomatoes", "Eggs", "Spinach"]
            }
            res = await client.post("/api/smart-kitchen/assist", json=payload)
            assert res.status_code == 503
            assert res.json()["error_code"] == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_smart_kitchen_empty_ingredients():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "mode": "utilization",
            "ingredients": []
        }
        res = await client.post("/api/smart-kitchen/assist", json=payload)
        # Validation error from Pydantic min_length or custom validator
        assert res.status_code in [400, 422]


@pytest.mark.asyncio
async def test_smart_kitchen_successful_utilization_mock():
    mock_model_response = {
        "mode": "utilization",
        "summary": "Mediterranean Tomato & Spinach Frittata designed to utilize approaching fresh eggs and greens.",
        "storage_guidance": [],
        "recipe_suggestions": [
            {
                "dish_name": "Pan-Seared Tomato & Spinach Scramble",
                "matched_ingredients": ["Tomatoes", "Eggs", "Spinach"],
                "optional_ingredients": ["Feta cheese", "Red pepper flakes"],
                "additional_needed": ["Olive oil", "Salt and black pepper"],
                "preparation_steps": [
                    "Whisk eggs in a bowl with a pinch of salt.",
                    "Sauté diced tomatoes and spinach in olive oil for 2 minutes until wilted.",
                    "Pour eggs over vegetables and cook gently until curds set."
                ],
                "estimated_prep_time": "12 minutes"
            }
        ],
        "practical_tips": [
            "Use soft tomatoes first as their moisture content leads to rapid breakdown."
        ],
        "safety_advisory": "Storage guidance and date calculations are estimates. They do not certify food safety or microbiological freshness. Always inspect food condition, odor, and texture before consumption."
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
                payload = {
                    "mode": "utilization",
                    "ingredients": ["Tomatoes", "Eggs", "Spinach"],
                    "dietary_preferences": "Vegetarian"
                }
                res = await client.post("/api/smart-kitchen/assist", json=payload)
                assert res.status_code == 200
                data = res.json()
                assert data["mode"] == "utilization"
                assert len(data["recipe_suggestions"]) >= 1
                assert "Tomato" in data["recipe_suggestions"][0]["dish_name"]
                assert "safety_advisory" in data


@pytest.mark.asyncio
async def test_smart_kitchen_successful_storage_mock():
    mock_model_response = {
        "mode": "storage",
        "summary": "Preservation protocols for fresh produce and dairy items.",
        "storage_guidance": [
            {
                "ingredient": "Spinach",
                "recommended_location": "Refrigerator (crisper drawer with paper towel)",
                "best_practices": ["Keep dry; excess moisture causes rapid bacterial slime", "Seal loosely in container"],
                "separation_notes": "Store away from ethylene producers like apples and bananas.",
                "preservation_limitations": "Tender greens naturally wilt within 5-7 days of harvest."
            }
        ],
        "recipe_suggestions": [],
        "practical_tips": [
            "Line the crisper drawer with clean paper towels to regulate humidity."
        ],
        "safety_advisory": "Storage guidance and date calculations are estimates. They do not certify food safety or microbiological freshness. Always inspect food condition, odor, and texture before consumption."
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
                payload = {
                    "mode": "storage",
                    "ingredients": ["Spinach"]
                }
                res = await client.post("/api/smart-kitchen/assist", json=payload)
                assert res.status_code == 200
                data = res.json()
                assert data["mode"] == "storage"
                assert len(data["storage_guidance"]) == 1
                assert data["storage_guidance"][0]["ingredient"] == "Spinach"


@pytest.mark.asyncio
async def test_smart_kitchen_provider_401():
    mock_resp = httpx.Response(
        status_code=401,
        text="Unauthorized",
        request=httpx.Request("POST", "https://integrate.api.nvidia.com/v1/chat/completions")
    )
    orig_post = httpx.AsyncClient.post

    async def mock_selective_post(self, url, *args, **kwargs):
        if "chat/completions" in str(url):
            return mock_resp
        if isinstance(getattr(self, "_transport", None), httpx.ASGITransport):
            return await orig_post(self, url, *args, **kwargs)
        raise RuntimeError(f"Unexpected outbound network call blocked: POST {url}")

    with patch.object(settings, "AI_API_KEY", "bad-key"):
        with patch.object(httpx.AsyncClient, "post", new=mock_selective_post):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                payload = {"mode": "utilization", "ingredients": ["Apples"]}
                res = await client.post("/api/smart-kitchen/assist", json=payload)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_smart_kitchen_malformed_output():
    mock_nvidia_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Not JSON at all, sorry!"
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
                payload = {"mode": "utilization", "ingredients": ["Apples"]}
                res = await client.post("/api/smart-kitchen/assist", json=payload)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_MODEL_OUTPUT"

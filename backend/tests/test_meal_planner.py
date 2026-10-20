import pytest
import json
import httpx
from unittest.mock import patch

from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_meal_planner_missing_api_key():
    with patch.object(settings, "AI_API_KEY", ""):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "duration_days": 3,
                "dietary_preference": "vegetarian"
            }
            res = await client.post("/api/meal-planner/generate", json=payload)
            assert res.status_code == 503
            assert res.json()["error_code"] == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_meal_planner_invalid_duration():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Duration over 7 days is clamped or rejected by Pydantic
        payload = {
            "duration_days": 10,
            "dietary_preference": "vegetarian"
        }
        res = await client.post("/api/meal-planner/generate", json=payload)
        # Should return 422 Unprocessable Entity
        assert res.status_code in [400, 422]


@pytest.mark.asyncio
async def test_meal_planner_successful_mock():
    mock_model_response = {
        "planning_period": "3-Day Personalized Meal Plan",
        "dietary_preference_applied": "Vegetarian",
        "allergies_respected": ["peanuts", "shellfish"],
        "daily_plans": [
            {
                "day_number": 1,
                "day_label": "Day 1 (Monday)",
                "daily_theme": "Mediterranean Plant Power",
                "daily_estimated_calories": "~1,850 kcal (estimate)",
                "meals": [
                    {
                        "meal_type": "breakfast",
                        "meal_name": "Greek Yogurt & Chia Berry Bowl",
                        "short_description": "Creamy yogurt with antioxidant berries and crunchy seeds.",
                        "ingredients": ["1 cup Greek yogurt", "1/2 cup fresh berries", "1 tbsp chia seeds"],
                        "preparation_steps": ["Place yogurt into a bowl.", "Top with fresh berries and chia seeds."],
                        "estimated_prep_and_cook_time": "5 mins",
                        "estimated_nutrition": {
                            "calories": "~320 kcal",
                            "protein": "~18g",
                            "carbs": "~35g",
                            "fats": "~8g"
                        },
                        "uses_inventory": ["Greek yogurt"],
                        "additional_needed": ["Fresh berries", "Chia seeds"]
                    },
                    {
                        "meal_type": "lunch",
                        "meal_name": "Mediterranean Chickpea & Tomato Salad",
                        "short_description": "Crisp cucumber, tomatoes, and seasoned chickpeas in olive oil.",
                        "ingredients": ["1 can chickpeas", "1 diced tomato", "1/2 cucumber", "1 tbsp olive oil"],
                        "preparation_steps": ["Rinse chickpeas.", "Toss with chopped vegetables and olive oil."],
                        "estimated_prep_and_cook_time": "10 mins",
                        "estimated_nutrition": {
                            "calories": "~480 kcal",
                            "protein": "~15g",
                            "carbs": "~60g",
                            "fats": "~14g"
                        },
                        "uses_inventory": ["Roma Tomatoes"],
                        "additional_needed": ["Chickpeas", "Cucumber", "Olive oil"]
                    },
                    {
                        "meal_type": "dinner",
                        "meal_name": "Pan-Seared Tofu & Steamed Broccoli",
                        "short_description": "Crisp tofu cubes tossed in ginger-soy glaze with greens.",
                        "ingredients": ["200g firm tofu", "2 cups broccoli florets", "1 tbsp soy sauce"],
                        "preparation_steps": ["Press and dice tofu.", "Sear until golden and steam broccoli."],
                        "estimated_prep_and_cook_time": "20 mins",
                        "estimated_nutrition": {
                            "calories": "~520 kcal",
                            "protein": "~28g",
                            "carbs": "~30g",
                            "fats": "~18g"
                        },
                        "uses_inventory": [],
                        "additional_needed": ["Firm tofu", "Broccoli", "Soy sauce"]
                    }
                ]
            }
        ],
        "consolidated_shopping_list": [
            "Fresh berries",
            "Chia seeds",
            "Chickpeas",
            "Cucumber",
            "Firm tofu",
            "Broccoli"
        ],
        "preparation_notes": [
            "Rinse and press tofu earlier in the day for crispier texture."
        ],
        "allergy_and_health_warning": "Nutritional figures and portions are model estimates and not laboratory measurements or clinical advice. Always inspect ingredient packaging for cross-contamination and allergens before consuming."
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
                    "duration_days": 1,
                    "dietary_preference": "vegetarian",
                    "allergies_and_exclusions": ["peanuts", "shellfish"],
                    "inventory_ingredients": ["Greek yogurt", "Roma Tomatoes"]
                }
                res = await client.post("/api/meal-planner/generate", json=payload)
                assert res.status_code == 200
                data = res.json()
                assert data["planning_period"] == "3-Day Personalized Meal Plan"
                assert len(data["daily_plans"]) == 1
                assert "peanuts" in data["allergies_respected"]
                assert len(data["consolidated_shopping_list"]) >= 1
                assert "allergy_and_health_warning" in data
                assert "not laboratory measurements" in data["allergy_and_health_warning"]


@pytest.mark.asyncio
async def test_meal_planner_provider_401():
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
                payload = {"duration_days": 1}
                res = await client.post("/api/meal-planner/generate", json=payload)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_meal_planner_malformed_output():
    mock_nvidia_payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Here is a meal plan: not json!"
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
                payload = {"duration_days": 1}
                res = await client.post("/api/meal-planner/generate", json=payload)
                assert res.status_code == 502
                assert res.json()["error_code"] == "INVALID_MODEL_OUTPUT"

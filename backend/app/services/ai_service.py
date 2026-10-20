"""
AI Service & NVIDIA Inference Provider.
Handles multimodal requests to NVIDIA API Catalog (Meta LLaMA 3.2 Vision),
strictly parses JSON structured responses, manages timeouts, and provides
robust error translation without leaking keys or raw stack traces.
Supports Food Recognition and Freshness Detection with food safety safeguards.
"""
import time
import json
import re
import logging
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings
from app.schemas.system import (
    FoodRecognitionResponse,
    EstimatedNutrition,
    FreshnessAnalysisResponse,
    HygieneAnalysisResponse,
    SmartKitchenAssistRequest,
    SmartKitchenAssistResponse,
    StorageGuidanceItem,
    RecipeSuggestion,
    MealPlannerGenerateRequest,
    MealPlannerGenerateResponse,
    MealItem,
    DayMealPlan
)

logger = logging.getLogger("foodverse.ai_service")


class AIInferenceError(Exception):
    def __init__(self, message: str, error_code: str = "INFERENCE_ERROR", status_code: int = 500, guidance: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.guidance = guidance


FOOD_RECOGNITION_SYSTEM_PROMPT = """You are a professional culinary intelligence and dietary analysis assistant.
Analyze the provided food image and return a strictly valid JSON object matching the following structure:
{
  "dish_name": "Primary name of dish or dominant food item",
  "confidence_or_certainty_note": "Clear qualitative statement of identification certainty and visual clarity",
  "description": "Visual summary of the plating, texture, colors, and components",
  "visible_food_items": ["item 1", "item 2"],
  "visible_ingredients": ["ingredient 1", "ingredient 2"],
  "inferred_ingredients": ["probable cooking oil, seasoning, or binder not directly visible"],
  "estimated_serving_size": "Portion size estimate based on visual cues (or null if indeterminate)",
  "estimated_nutrition": {
    "calories_kcal": 450,
    "protein_g": 25.0,
    "carbohydrates_g": 35.0,
    "fat_g": 18.0,
    "fiber_g": 4.0,
    "sodium_mg": 480.0,
    "confidence_note": "Approximate estimate based on visual portion cues only."
  },
  "limitations": ["Hidden fats/sugars, density variation, exact portion depth indeterminate from 2D image"],
  "warnings": ["Estimated nutrition only. Not a medical guarantee. Check allergens independently."]
}

Rules:
1. Return ONLY the JSON object. Do not wrap in markdown or backticks.
2. If nutrition cannot be meaningfully estimated, set estimated_nutrition to null.
3. Keep descriptions concise, factual, and based strictly on observable visual evidence."""


FRESHNESS_DETECTION_SYSTEM_PROMPT = """You are a food quality and freshness evaluation assistant.
Assess the visual condition of the provided food photograph.
CRITICAL SAFETY RULE: You are evaluating VISUAL indicators only (color, texture, wilting, bruising, browning, mold). Visual analysis CANNOT determine microbiological safety, bacterial pathogens, toxins, pesticide residues, or chemical contamination. Never tell the user food is safe to eat or free of pathogens. Never recommend tasting food to check freshness.

Analyze the image and return a strictly valid JSON object matching this schema:
{
  "food_name": "Identified food item (e.g., Honeycrisp Apple, Fresh Salmon Fillet, Mixed Greens)",
  "food_category": "produce | fruit | vegetable | meat | seafood | dairy | prepared food | unknown",
  "freshness_status": "appears_fresh | possible_deterioration | cannot_assess",
  "visual_condition_score": 85,
  "visible_indicators": ["vibrant green leaves", "crisp stem structure", "no discoloration"],
  "positive_indicators": ["natural color tone", "firm surface appearance"],
  "concerns": ["minor browning on outer leaf tip"],
  "explanation": "Concise factual description of observable visual traits on this item.",
  "recommended_action": "Cautious, practical guidance (e.g., consume promptly, inspect tactile firmness, trim outer layer, discard if odor/mold is present)",
  "limitations": [
    "Visual assessment cannot evaluate odor, internal moisture, microbial pathogens, or storage temperature history."
  ],
  "safety_warning": "Visual analysis cannot establish whether food is microbiologically safe to eat. Odor, temperature history, pathogens, and storage conditions cannot be verified from a photograph."
}

Rules:
1. Return ONLY the JSON object. Do not wrap in markdown or backticks.
2. If the food item cannot be identified, the image is blurry, or visual condition cannot be determined, set freshness_status to 'cannot_assess' and visual_condition_score to null.
3. visual_condition_score must be an integer between 0 and 100, or null if uncertain.
4. If mold-like growth, extensive discoloration, or rot is visible, set freshness_status to 'possible_deterioration' and recommend proper disposal.
5. For meat, seafood, dairy, or prepared foods, explicitly note that visual inspection has severe limitations and cannot detect invisible bacterial growth."""


HYGIENE_ASSESSMENT_SYSTEM_PROMPT = """You are FoodVerse AI's Hygiene & Kitchen Safety inspection assistant.
Analyze the provided photograph of a kitchen, food prep area, dining surface, or food handling environment for visible sanitary conditions.

CRITICAL HYGIENE & SAFETY BOUNDARIES:
- This is an IMAGE-ONLY assessment. You can ONLY observe visible exterior traits.
- NEVER claim that bacteria, viruses, microbial pathogens, toxins, or invisible contamination are present or absent.
- NEVER certify an environment, kitchen, food, person, or surface as hygienically safe, sterile, or compliant.
- Do NOT infer handwashing occurred or did not occur unless directly visible.
- Do NOT infer gloves are clean or safe merely because gloves are visible.
- Do NOT label an entire kitchen or facility unsafe based on weak, incomplete, or ambiguous evidence.
- If the image is blurry, ambiguous, or lacks context to evaluate kitchen safety, return overall_assessment as 'cannot_assess'.
- Recommendations must be cautious, practical, and proportional to what is actually visible.
- Distinguish direct observations from potential concerns.

Respond ONLY with valid JSON conforming to this structure:
{
  "environment_summary": "Concise summary of the visible environment (e.g. stainless steel prep counter with cutting boards, home kitchen cooktop, dining table).",
  "overall_assessment": "visible_concerns | no_obvious_visible_concerns | cannot_assess",
  "confidence": "High | Moderate | Low (model estimate, not calibrated probability)",
  "observations": [
    "Specific visible observation 1",
    "Specific visible observation 2"
  ],
  "cleanliness_indicators": [
    "Visually supported positive cleanliness indicator (e.g. wiped stainless steel surface, clear prep zone)"
  ],
  "potential_concerns": [
    "Grounded visible concern (e.g. raw poultry knife placed adjacent to washed greens, uncovered food near waste bin, visible grease buildup)"
  ],
  "recommended_actions": [
    "Practical action step (e.g. sanitize cutting board between proteins and produce, clear clutter from prep station)"
  ],
  "limitations": [
    "Photographic assessment cannot detect microbial pathogens, biofilms, surface viral loads, or past handwashing compliance.",
    "Storage history, ambient temperature duration, and chemical sanitizer concentration cannot be verified from a photograph."
  ],
  "safety_disclaimer": "An image-only AI assessment cannot certify hygiene or food safety. Photographic inspection cannot verify microbial sterility, chemical residues, viral contamination, or safe handling practices."
}

Rules:
1. Return ONLY the JSON object. Do not include markdown preamble.
2. overall_assessment must strictly be one of: 'visible_concerns', 'no_obvious_visible_concerns', or 'cannot_assess'.
3. If no obvious hazards are visible, set overall_assessment to 'no_obvious_visible_concerns', but do NOT declare the area 'sterile' or 'safe'.
4. If food safety hazards (cross-contact, raw meat juices on ready-to-eat items, open trash near prep) are visible, set overall_assessment to 'visible_concerns'.
5. If the photo does not clearly show a food environment or is too blurry/dark, set overall_assessment to 'cannot_assess'."""


SMART_KITCHEN_SYSTEM_PROMPT = """You are FoodVerse AI's Smart Kitchen & Pantry Culinary Assistant.
Your task is to provide practical, grounded food storage guidance or zero-waste ingredient utilization recipes based STRICTLY on real ingredients selected by the user from their kitchen inventory.

CRITICAL PRINCIPLES:
1. INGREDIENT GROUNDING: Focus recommendations primarily around the ingredients the user provided.
2. DISTINGUISH PANTRY FROM ADDITIONS: If a recipe is suggested, clearly list which of the user's selected ingredients are matched, which are optional, and which additional common staples (e.g. olive oil, salt, garlic) might be needed. Do NOT claim the user has ingredients they did not specify.
3. ZERO-WASTE PHILOSOPHY: Provide sensible pairing ideas to help utilize ingredients before quality declines.
4. HONEST BOUNDARIES: You do not know the user's exact fridge temperature, humidity, microbial status, or true expiration date. State practical culinary guidelines rather than certifying food safety.
5. NO HALLUCINATED NUMBERS: Do not fabricate artificial percentage stats or guarantee shelf-life durations.

Format output STRICTLY as valid JSON matching this schema:
{
  "mode": "utilization | storage",
  "summary": "Brief summary of culinary advice or recipe strategy.",
  "storage_guidance": [
    {
      "ingredient": "Name of ingredient",
      "recommended_location": "Refrigerator (crisper drawer) | Cool dark pantry | Freezer",
      "best_practices": ["Practical tip 1", "Practical tip 2"],
      "separation_notes": "e.g. Keep away from ethylene-producing apples",
      "preservation_limitations": "e.g. High moisture produce deteriorates quickly once cut"
    }
  ],
  "recipe_suggestions": [
    {
      "dish_name": "Name of dish",
      "matched_ingredients": ["User ingredient 1", "User ingredient 2"],
      "optional_ingredients": ["Optional item"],
      "additional_needed": ["Staple seasoning or extra item needed"],
      "preparation_steps": ["Step 1", "Step 2", "Step 3"],
      "estimated_prep_time": "20 minutes"
    }
  ],
  "practical_tips": [
    "Practical food-waste reduction or storage tip"
  ],
  "safety_advisory": "Storage guidance and date calculations are estimates. They do not certify food safety or microbiological freshness. Always inspect food condition, odor, and texture before consumption."
}

Rules:
1. Return ONLY the JSON object.
2. If mode is 'utilization': provide 1 concise recipe in 'recipe_suggestions', and keep 'storage_guidance' as an empty list [].
3. If mode is 'storage': provide itemized storage advice in 'storage_guidance', and keep 'recipe_suggestions' as an empty list [].
4. Keep preparation steps concise (3-4 short steps max).
5. Respect any stated dietary preferences (e.g. vegetarian, dairy-free)."""


MEAL_PLANNER_SYSTEM_PROMPT = """You are FoodVerse AI's Personalized Dietary & Meal Planning Assistant.
Generate structured, hyper-individualized daily meal schedules based strictly on user preferences, dietary restrictions, explicit allergies, and available Smart Kitchen inventory.

CRITICAL HEALTH & NUTRITION BOUNDARIES:
1. NUTRITION ESTIMATES ONLY: Nutritional calories and macronutrients are model approximations, NOT laboratory or clinical measurements. Never claim medical outcomes, therapeutic cures, or guaranteed weight loss.
2. STRICT ALLERGEN ENFORCEMENT: Never include ingredients listed in the user's allergies or exclusions. Clearly warn users to check manufacturer ingredient labels for allergen warnings and facility cross-contact.
3. INVENTORY MATCHING: Prioritize available Smart Kitchen inventory ingredients in recipes where appropriate, noting which items match the user's pantry versus additional needed shopping items.
4. HONEST PORTIONS & TIME: Provide realistic, practical recipes adhering to the user's cooking time preference.

Format output STRICTLY as valid JSON matching this schema:
{
  "planning_period": "3-Day Personalized Meal Plan",
  "dietary_preference_applied": "Vegetarian | Vegan | Non-Vegetarian | None",
  "allergies_respected": ["peanuts", "dairy"],
  "daily_plans": [
    {
      "day_number": 1,
      "day_label": "Day 1",
      "daily_theme": "Mediterranean Balance",
      "daily_estimated_calories": "~1,850 kcal (estimate)",
      "meals": [
        {
          "meal_type": "breakfast | lunch | dinner | snack",
          "meal_name": "Dish Name",
          "short_description": "Brief description of the meal.",
          "ingredients": ["1 cup rolled oats", "1/2 cup almond milk", "1 tbsp chia seeds"],
          "preparation_steps": ["Step 1", "Step 2", "Step 3"],
          "estimated_prep_and_cook_time": "15 mins",
          "estimated_nutrition": {
            "calories": "~380 kcal",
            "protein": "~12g",
            "carbs": "~55g",
            "fats": "~10g"
          },
          "uses_inventory": ["Rolled oats"],
          "additional_needed": ["Almond milk", "Chia seeds"]
        }
      ]
    }
  ],
  "consolidated_shopping_list": [
    "Item 1",
    "Item 2"
  ],
  "preparation_notes": [
    "Batch cook grains on Day 1 to save prep time on subsequent days."
  ],
  "allergy_and_health_warning": "Nutritional figures and portions are model estimates and not laboratory measurements or clinical advice. Always inspect ingredient packaging for cross-contamination and allergens before consuming."
}

Rules:
1. Return ONLY the JSON object. Do not include markdown preamble.
2. Provide daily plans strictly matching the requested duration (1 to 7 days).
3. Include requested meal types per day.
4. Completely exclude all specified allergens from every meal.
5. Keep descriptions, ingredient lists (2-4 items max), and preparation steps (2 short steps max per meal) very concise to avoid truncation."""



def extract_and_parse_json(content: str) -> Dict[str, Any]:
    """
    Robustly extracts and parses a JSON object from raw LLM output.
    Handles:
    - Raw valid JSON objects
    - Markdown code fences (```json ... ``` or ``` ... ```)
    - Preamble or conversational postscript surrounding JSON
    - Common trailing commas before closing braces/brackets
    - Model refusal / empty content / genuinely malformed output (raises ValueError)
    """
    if not content or not content.strip():
        raise ValueError("Content is empty")

    raw_stripped = content.strip()

    # Strategy 1: Direct JSON parsing
    try:
        parsed = json.loads(raw_stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Strategy 2: Markdown code fence extraction
    fence_pattern = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
    match = fence_pattern.search(raw_stripped)
    if match:
        fence_content = match.group(1).strip()
        try:
            parsed = json.loads(fence_content)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    # Strategy 3: Find outermost enclosing curly braces { ... }
    first_brace = raw_stripped.find("{")
    last_brace = raw_stripped.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        substring = raw_stripped[first_brace:last_brace + 1].strip()
        try:
            parsed = json.loads(substring)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            # Strategy 4: Clean common trailing commas before } or ]
            cleaned_trailing = re.sub(r",\s*([\]}])", r"\1", substring)
            try:
                parsed = json.loads(cleaned_trailing)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

    raise ValueError(f"Could not extract valid JSON object from model response: {raw_stripped[:200]}")


async def _execute_nvidia_chat_completion(messages: list, max_tokens: int = 450) -> Dict[str, Any]:
    """
    Internal helper to submit payload to NVIDIA Chat Completions with unified error translation.
    """
    api_key = settings.AI_API_KEY
    if not api_key or not api_key.strip():
        raise AIInferenceError(
            message="NVIDIA AI API key is not configured in backend environment.",
            error_code="MISSING_API_KEY",
            status_code=503,
            guidance="Please supply a valid AI_API_KEY in backend/.env to enable NVIDIA Vision inference."
        )

    invoke_url = f"{settings.api_base_url.rstrip('/')}/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    payload = {
        "model": settings.model_name,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": settings.AI_TEMPERATURE,
        "top_p": 0.9,
        "stream": False
    }

    # Explicit granular HTTP timeout configuration ensuring connect/read/write/pool do not choke
    request_timeout = httpx.Timeout(
        timeout=settings.AI_TIMEOUT_SECONDS,
        connect=15.0,
        read=settings.AI_TIMEOUT_SECONDS,
        write=30.0,
        pool=15.0
    )

    start_time = time.time()
    logger.info(
        f"Initiating NVIDIA inference call: model={settings.model_name}, "
        f"timeout={settings.AI_TIMEOUT_SECONDS}s, endpoint={invoke_url}"
    )

    try:
        async with httpx.AsyncClient(timeout=request_timeout) as client:
            response = await client.post(invoke_url, headers=headers, json=payload)
    except httpx.ConnectTimeout:
        elapsed = round(time.time() - start_time, 2)
        logger.warning(f"Connection timeout contacting inference endpoint after {elapsed}s (connect limit: 15s)")
        raise AIInferenceError(
            message="Connection timed out while contacting the analysis service.",
            error_code="PROVIDER_TIMEOUT",
            status_code=504,
            guidance="The analysis service connection timed out. Check your network connection and retry."
        )
    except httpx.ReadTimeout:
        elapsed = round(time.time() - start_time, 2)
        logger.warning(f"Read timeout waiting for model response after {elapsed}s (read limit: {settings.AI_TIMEOUT_SECONDS}s)")
        raise AIInferenceError(
            message="The analysis is taking longer than expected. Please try again shortly.",
            error_code="PROVIDER_TIMEOUT",
            status_code=504,
            guidance="High processing volume detected. Please try again in a few moments."
        )
    except httpx.TimeoutException as te:
        elapsed = round(time.time() - start_time, 2)
        logger.warning(f"Timeout ({type(te).__name__}) contacting inference endpoint after {elapsed}s")
        raise AIInferenceError(
            message="The analysis is taking longer than expected. Please try again shortly.",
            error_code="PROVIDER_TIMEOUT",
            status_code=504,
            guidance="Please retry with a clear photo or try again in a moment."
        )
    except httpx.RequestError as e:
        elapsed = round(time.time() - start_time, 2)
        logger.error(f"Network error ({type(e).__name__}) connecting to AI service after {elapsed}s: {str(e)}")
        raise AIInferenceError(
            message="We couldn't connect to the analysis service. Check your connection and try again.",
            error_code="PROVIDER_NETWORK_ERROR",
            status_code=502,
            guidance="Verify your internet connectivity and check that the server is online."
        )

    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(f"Inference completed with status {response.status_code} in {elapsed_ms}ms")

    # Handle HTTP error statuses from upstream
    if response.status_code == 401 or response.status_code == 403:
        logger.error(f"Upstream Authentication failure: HTTP {response.status_code}")
        raise AIInferenceError(
            message="Analysis service authentication failed. Please verify credentials.",
            error_code="INVALID_CREDENTIALS",
            status_code=502,
            guidance="Check backend configuration to ensure valid credentials are configured."
        )
    elif response.status_code == 429:
        logger.warning("Upstream Rate Limit exceeded: HTTP 429")
        raise AIInferenceError(
            message="Analysis service request rate limit reached. Please wait a moment.",
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            guidance="Request quota reached. Please pause for a few seconds before retrying."
        )
    elif response.status_code >= 500:
        logger.error(f"Upstream Server Error: HTTP {response.status_code} - {response.text[:200]}")
        raise AIInferenceError(
            message="Analysis is temporarily unavailable. Please try again in a moment.",
            error_code="PROVIDER_SERVER_ERROR",
            status_code=502,
            guidance="Upstream servers may be temporarily busy. Please retry shortly."
        )
    elif response.status_code != 200:
        logger.error(f"Upstream returned HTTP {response.status_code}: {response.text[:200]}")
        raise AIInferenceError(
            message="We couldn't complete the analysis. Please try again with another image.",
            error_code="UPSTREAM_REQUEST_ERROR",
            status_code=502,
            guidance="Please verify that the uploaded image is a clear, standard photo."
        )

    try:
        raw_json = response.json()
    except Exception:
        logger.error("Failed to parse upstream response as JSON")
        raise AIInferenceError(
            message="We couldn't process the response format. Please try again.",
            error_code="MALFORMED_PROVIDER_RESPONSE",
            status_code=502
        )

    choices = raw_json.get("choices")
    if not choices or not isinstance(choices, list) or len(choices) == 0:
        logger.error(f"NVIDIA response has no choices: {raw_json}")
        raise AIInferenceError(
            message="AI model produced an empty response choices payload.",
            error_code="EMPTY_MODEL_CHOICES",
            status_code=502
        )

    message = choices[0].get("message", {})
    content = message.get("content", "")
    if not content or not content.strip():
        logger.error("NVIDIA assistant message content is empty")
        raise AIInferenceError(
            message="AI model returned empty assistant content.",
            error_code="EMPTY_ASSISTANT_CONTENT",
            status_code=502
        )

    try:
        parsed_data = extract_and_parse_json(content)
    except ValueError as ve:
        logger.error(f"Failed to decode model JSON: {str(ve)} | Raw content: {content[:300]}")
        raise AIInferenceError(
            message="AI model response could not be parsed into structured food data.",
            error_code="INVALID_MODEL_OUTPUT",
            status_code=502,
            guidance="The vision model did not format its output correctly. Try with a clearer angle or single dish."
        )

    return parsed_data, elapsed_ms


async def analyze_food_image_nvidia(image_data_url: str) -> FoodRecognitionResponse:
    """
    Submits image to NVIDIA Chat Completions with Meta LLaMA 3.2 Vision for food recognition.
    """
    messages = [
        {
            "role": "system",
            "content": FOOD_RECOGNITION_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url
                    }
                },
                {
                    "type": "text",
                    "text": "Identify this food item and return the output strictly as a JSON object."
                }
            ]
        }
    ]

    parsed_data, elapsed_ms = await _execute_nvidia_chat_completion(messages, max_tokens=settings.AI_MAX_TOKENS)

    nutrition_obj = None
    raw_nutrition = parsed_data.get("estimated_nutrition")
    if isinstance(raw_nutrition, dict):
        nutrition_obj = EstimatedNutrition(
            calories_kcal=raw_nutrition.get("calories_kcal"),
            protein_g=raw_nutrition.get("protein_g"),
            carbohydrates_g=raw_nutrition.get("carbohydrates_g"),
            fat_g=raw_nutrition.get("fat_g"),
            fiber_g=raw_nutrition.get("fiber_g"),
            sodium_mg=raw_nutrition.get("sodium_mg"),
            confidence_note=raw_nutrition.get("confidence_note", "Approximate estimate based on visual portion cues only.")
        )

    try:
        return FoodRecognitionResponse(
            dish_name=parsed_data.get("dish_name", "Identified Food Item"),
            confidence_or_certainty_note=parsed_data.get("confidence_or_certainty_note", "Identification based on visible plating."),
            description=parsed_data.get("description", "Food item observed in image."),
            visible_food_items=parsed_data.get("visible_food_items", []),
            visible_ingredients=parsed_data.get("visible_ingredients", []),
            inferred_ingredients=parsed_data.get("inferred_ingredients", []),
            estimated_serving_size=parsed_data.get("estimated_serving_size"),
            estimated_nutrition=nutrition_obj,
            limitations=parsed_data.get("limitations", ["Portion density and unseen ingredients indeterminate."]),
            warnings=parsed_data.get("warnings", ["Nutrition values are computational estimates. Verify allergens."]),
            model_used=settings.model_name,
            inference_time_ms=elapsed_ms
        )
    except Exception as e:
        logger.error(f"Error constructing FoodRecognitionResponse: {str(e)}")
        raise AIInferenceError(
            message="Failed to validate model output against food intelligence schema.",
            error_code="SCHEMA_VALIDATION_ERROR",
            status_code=502
        )


async def analyze_freshness_image_nvidia(image_data_url: str) -> FreshnessAnalysisResponse:
    """
    Submits image to NVIDIA Chat Completions with Meta LLaMA 3.2 Vision for visual freshness assessment.
    Enforces non-alarmist tone, safety disclaimers, and structured validation.
    """
    messages = [
        {
            "role": "system",
            "content": FRESHNESS_DETECTION_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url
                    }
                },
                {
                    "type": "text",
                    "text": "Assess the visual freshness indicators of this food item and return the output strictly as a JSON object."
                }
            ]
        }
    ]

    # Bounded tokens for comprehensive freshness inspection
    token_budget = max(settings.AI_MAX_TOKENS, 650)
    parsed_data, elapsed_ms = await _execute_nvidia_chat_completion(messages, max_tokens=token_budget)

    try:
        # Enforce safety disclaimer presence
        safety_warning = parsed_data.get("safety_warning")
        if not safety_warning or not isinstance(safety_warning, str) or len(safety_warning.strip()) < 10:
            safety_warning = "Visual analysis cannot establish whether food is microbiologically safe to eat. Odor, temperature history, pathogens, and storage conditions cannot be verified from a photograph."

        # Helper to ensure lists of strings
        def _ensure_str_list(val, default=None):
            if isinstance(val, list):
                return [str(item).strip() for item in val if item is not None and str(item).strip()]
            elif isinstance(val, str) and val.strip():
                return [val.strip()]
            return default if default is not None else []

        return FreshnessAnalysisResponse(
            food_name=str(parsed_data.get("food_name") or "Unidentified Item").strip(),
            food_category=str(parsed_data.get("food_category") or "unknown").strip(),
            freshness_status=str(parsed_data.get("freshness_status") or "cannot_assess").strip(),
            visual_condition_score=parsed_data.get("visual_condition_score"),
            visible_indicators=_ensure_str_list(parsed_data.get("visible_indicators")),
            positive_indicators=_ensure_str_list(parsed_data.get("positive_indicators")),
            concerns=_ensure_str_list(parsed_data.get("concerns")),
            explanation=str(parsed_data.get("explanation") or "Visual assessment of observable surface features.").strip(),
            recommended_action=str(parsed_data.get("recommended_action") or "Inspect carefully for odor, texture, and proper storage before use.").strip(),
            limitations=_ensure_str_list(parsed_data.get("limitations"), [
                "Visual analysis cannot detect microbiological pathogens, toxins, or internal degradation."
            ]),
            safety_warning=safety_warning,
            model_used=settings.model_name,
            inference_time_ms=elapsed_ms
        )
    except Exception as e:
        logger.error(f"Error constructing FreshnessAnalysisResponse: {str(e)}")
        raise AIInferenceError(
            message="Failed to validate model output against freshness assessment schema.",
            error_code="SCHEMA_VALIDATION_ERROR",
            status_code=502
        )


async def analyze_hygiene_image_nvidia(image_data_url: str) -> HygieneAnalysisResponse:
    """
    Submits image to NVIDIA Chat Completions with Meta LLaMA 3.2 Vision for kitchen hygiene assessment.
    Enforces non-alarmist tone, safety disclaimers, and structured validation.
    """
    messages = [
        {
            "role": "system",
            "content": HYGIENE_ASSESSMENT_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url
                    }
                },
                {
                    "type": "text",
                    "text": "Inspect the visible food safety and sanitary conditions in this image and return the assessment strictly as a JSON object."
                }
            ]
        }
    ]

    parsed_data, elapsed_ms = await _execute_nvidia_chat_completion(messages, max_tokens=settings.AI_MAX_TOKENS)

    try:
        # Enforce safety disclaimer presence
        safety_disclaimer = parsed_data.get("safety_disclaimer")
        if not safety_disclaimer or len(safety_disclaimer.strip()) < 10:
            safety_disclaimer = (
                "An image-only AI assessment cannot certify hygiene or food safety. "
                "Photographic inspection cannot verify microbial sterility, chemical residues, viral contamination, or safe handling practices."
            )

        return HygieneAnalysisResponse(
            environment_summary=parsed_data.get("environment_summary", "Visible kitchen / food handling environment"),
            overall_assessment=parsed_data.get("overall_assessment", "cannot_assess"),
            confidence=parsed_data.get("confidence", "Moderate"),
            observations=parsed_data.get("observations", []),
            cleanliness_indicators=parsed_data.get("cleanliness_indicators", []),
            potential_concerns=parsed_data.get("potential_concerns", []),
            recommended_actions=parsed_data.get("recommended_actions", [
                "Inspect surfaces, sanitize food contact zones, and follow standard food-safety handling procedures."
            ]),
            limitations=parsed_data.get("limitations", [
                "Visual inspection cannot detect microbial pathogens, biofilms, surface viral loads, or chemical residues."
            ]),
            safety_disclaimer=safety_disclaimer,
            model_used=settings.model_name,
            inference_time_ms=elapsed_ms
        )
    except Exception as e:
        logger.error(f"Error constructing HygieneAnalysisResponse: {str(e)}")
        raise AIInferenceError(
            message="Failed to validate model output against hygiene assessment schema.",
            error_code="SCHEMA_VALIDATION_ERROR",
            status_code=502
        )


async def assist_smart_kitchen_nvidia(request: SmartKitchenAssistRequest) -> SmartKitchenAssistResponse:
    """
    Submits selected inventory ingredients and parameters to Meta LLaMA 3.2 Vision (in multimodal text chat mode)
    for zero-waste recipe crafting or storage guidance.
    """
    mode_instruction = (
        f"Mode: {request.mode}. "
        f"Selected Inventory Ingredients: {', '.join(request.ingredients)}. "
        f"{'Dietary Preferences/Exclusions: ' + request.dietary_preferences if request.dietary_preferences else 'No specific dietary exclusions.'}"
    )

    messages = [
        {
            "role": "system",
            "content": SMART_KITCHEN_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": mode_instruction
        }
    ]

    # Bounded tokens for concise, structured recipes or storage items
    parsed_data, elapsed_ms = await _execute_nvidia_chat_completion(messages, max_tokens=700)

    try:
        raw_storage = parsed_data.get("storage_guidance", [])
        storage_items = []
        for s in raw_storage:
            if isinstance(s, dict) and s.get("ingredient"):
                storage_items.append(StorageGuidanceItem(
                    ingredient=str(s.get("ingredient", "")),
                    recommended_location=str(s.get("recommended_location", "Pantry or Refrigerator")),
                    best_practices=s.get("best_practices", []),
                    separation_notes=s.get("separation_notes"),
                    preservation_limitations=s.get("preservation_limitations")
                ))

        raw_recipes = parsed_data.get("recipe_suggestions", [])
        recipe_items = []
        for r in raw_recipes:
            if isinstance(r, dict) and r.get("dish_name"):
                recipe_items.append(RecipeSuggestion(
                    dish_name=str(r.get("dish_name", "Pantry Recipe")),
                    matched_ingredients=r.get("matched_ingredients", []),
                    optional_ingredients=r.get("optional_ingredients", []),
                    additional_needed=r.get("additional_needed", []),
                    preparation_steps=r.get("preparation_steps", []),
                    estimated_prep_time=r.get("estimated_prep_time", "15-25 mins")
                ))

        safety_advisory = parsed_data.get("safety_advisory")
        if not safety_advisory or len(safety_advisory.strip()) < 10:
            safety_advisory = (
                "Storage guidance and date calculations are estimates. They do not certify food safety or microbiological freshness. "
                "Always inspect food condition, odor, and texture before consumption."
            )

        return SmartKitchenAssistResponse(
            mode=request.mode,
            summary=parsed_data.get("summary", "Smart Kitchen assistance based on your recorded ingredients."),
            storage_guidance=storage_items,
            recipe_suggestions=recipe_items,
            practical_tips=parsed_data.get("practical_tips", [
                "Prioritize items with approaching dates to eliminate kitchen food waste."
            ]),
            safety_advisory=safety_advisory,
            model_used=settings.model_name,
            inference_time_ms=elapsed_ms
        )
    except Exception as e:
        logger.error(f"Error constructing SmartKitchenAssistResponse: {str(e)}")
        raise AIInferenceError(
            message="Failed to validate model output against smart kitchen assistant schema.",
            error_code="SCHEMA_VALIDATION_ERROR",
            status_code=502
        )


async def generate_meal_plan_nvidia(request: MealPlannerGenerateRequest) -> MealPlannerGenerateResponse:
    """
    Submits user preferences, duration, allergies, and available pantry items to Meta LLaMA 3.2
    for structured personalized meal planning.
    """
    meals_requested = ", ".join(request.meals_per_day)
    allergies_list = ", ".join(request.allergies_and_exclusions) if request.allergies_and_exclusions else "None"
    inventory_list = ", ".join(request.inventory_ingredients) if request.inventory_ingredients else "None provided"
    preferred_list = ", ".join(request.preferred_ingredients) if request.preferred_ingredients else "None"

    user_prompt = (
        f"Plan Duration: {request.duration_days} day(s). "
        f"Daily Meals: {meals_requested}. "
        f"Dietary Preference: {request.dietary_preference}. "
        f"MANDATORY ALLERGIES & EXCLUSIONS TO AVOID: {allergies_list}. "
        f"Available Smart Kitchen Inventory to Prioritize: {inventory_list}. "
        f"User Preferred Ingredients: {preferred_list}. "
        f"Cuisine Preference: {request.cuisine_preference or 'Flexible'}. "
        f"Cooking Time Preference: {request.cooking_time_preference or 'Standard'}. "
        f"{'Target Daily Calories (Estimate Only): ' + str(request.calorie_target_daily) + ' kcal' if request.calorie_target_daily else ''}"
    )

    messages = [
        {
            "role": "system",
            "content": MEAL_PLANNER_SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": user_prompt
        }
    ]

    # Bounded tokens scaled to duration
    token_budget = min(1500, 750 + (request.duration_days * 180))
    parsed_data, elapsed_ms = await _execute_nvidia_chat_completion(messages, max_tokens=token_budget)

    try:
        raw_daily = parsed_data.get("daily_plans", [])
        daily_plans = []
        for d in raw_daily:
            if isinstance(d, dict):
                meals_list = []
                for m in d.get("meals", []):
                    if isinstance(m, dict):
                        meals_list.append(MealItem(
                            meal_type=str(m.get("meal_type", "meal")),
                            meal_name=str(m.get("meal_name", "Curated Dish")),
                            short_description=str(m.get("short_description", "")),
                            ingredients=m.get("ingredients", []),
                            preparation_steps=m.get("preparation_steps", []),
                            estimated_prep_and_cook_time=str(m.get("estimated_prep_and_cook_time", "20 mins")),
                            estimated_nutrition=m.get("estimated_nutrition") if isinstance(m.get("estimated_nutrition"), dict) else None,
                            uses_inventory=m.get("uses_inventory", []),
                            additional_needed=m.get("additional_needed", [])
                        ))

                daily_plans.append(DayMealPlan(
                    day_number=int(d.get("day_number", len(daily_plans) + 1)),
                    day_label=str(d.get("day_label", f"Day {len(daily_plans) + 1}")),
                    daily_theme=d.get("daily_theme"),
                    meals=meals_list,
                    daily_estimated_calories=d.get("daily_estimated_calories")
                ))

        safety_warning = parsed_data.get("allergy_and_health_warning")
        if not safety_warning or len(safety_warning.strip()) < 10:
            safety_warning = (
                "Nutritional figures and portions are model estimates and not laboratory measurements or clinical advice. "
                "Always inspect ingredient packaging for cross-contamination and allergens before consuming."
            )

        return MealPlannerGenerateResponse(
            planning_period=parsed_data.get("planning_period", f"{request.duration_days}-Day Personalized Meal Plan"),
            dietary_preference_applied=parsed_data.get("dietary_preference_applied", request.dietary_preference),
            allergies_respected=parsed_data.get("allergies_respected", request.allergies_and_exclusions),
            daily_plans=daily_plans,
            consolidated_shopping_list=parsed_data.get("consolidated_shopping_list", []),
            preparation_notes=parsed_data.get("preparation_notes", [
                "Review shopping items and prep produce ahead of time."
            ]),
            allergy_and_health_warning=safety_warning,
            model_used=settings.model_name,
            inference_time_ms=elapsed_ms
        )
    except Exception as e:
        logger.error(f"Error constructing MealPlannerGenerateResponse: {str(e)}")
        raise AIInferenceError(
            message="Failed to validate model output against meal planner response schema.",
            error_code="SCHEMA_VALIDATION_ERROR",
            status_code=502
        )


def get_ai_service_status() -> Dict[str, Any]:
    """
    Evaluates current configuration presence without exposing internal secrets or provider details.
    """
    provider = settings.AI_PROVIDER.lower().strip() if settings.AI_PROVIDER else "none"
    has_key = bool(settings.AI_API_KEY and len(settings.AI_API_KEY.strip()) > 0)

    if provider in ("", "none") or not has_key:
        return {
            "provider": "standard",
            "is_provider_configured": False,
            "has_api_key": False,
            "model_identifier": "Multimodal Vision & Reasoning",
            "is_connected": False,
            "connection_notes": "Analysis key not configured in environment."
        }

    return {
        "provider": "standard",
        "is_provider_configured": True,
        "has_api_key": True,
        "model_identifier": "Multimodal Vision & Reasoning",
        "is_connected": True,
        "connection_notes": "Multimodal vision & reasoning pipeline ready."
    }

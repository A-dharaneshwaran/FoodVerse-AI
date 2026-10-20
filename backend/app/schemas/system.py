from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Overall health status")
    app: str = Field(description="Application name")
    version: str = Field(description="Application release version")
    timestamp: str = Field(description="ISO format UTC timestamp")


class AIConfigStatus(BaseModel):
    provider: str = Field(description="Configured provider name, or 'none'")
    is_provider_configured: bool = Field(description="True if an AI provider has been set")
    has_api_key: bool = Field(description="True if an API key is present in environment (never exposes the key itself)")
    model_identifier: Optional[str] = Field(default=None, description="Configured model identifier")
    is_connected: bool = Field(default=False, description="Whether live connectivity was verified")
    connection_notes: str = Field(description="Honest explanation of AI integration readiness")


class SystemStatusResponse(BaseModel):
    backend_status: str = Field(default="operational", description="Backend server status")
    environment: str = Field(description="Runtime environment")
    database_status: str = Field(
        default="not_configured",
        description="Database status"
    )
    ai_status: AIConfigStatus = Field(description="AI configuration details")
    planned_modules: List[str] = Field(description="List of core modules planned across project phases")


class EstimatedNutrition(BaseModel):
    calories_kcal: Optional[float] = Field(default=None, description="Estimated calories in kcal")
    protein_g: Optional[float] = Field(default=None, description="Estimated protein in grams")
    carbohydrates_g: Optional[float] = Field(default=None, description="Estimated carbohydrates in grams")
    fat_g: Optional[float] = Field(default=None, description="Estimated fat in grams")
    fiber_g: Optional[float] = Field(default=None, description="Estimated dietary fiber in grams")
    sodium_mg: Optional[float] = Field(default=None, description="Estimated sodium in milligrams")
    confidence_note: str = Field(default="Approximate estimate based on visual portion cues only.")


class FoodRecognitionResponse(BaseModel):
    dish_name: str = Field(description="Identified primary dish or food item name")
    confidence_or_certainty_note: str = Field(description="Qualitative certainty note regarding visual identification")
    description: str = Field(description="Observable visual description of the plate/item")
    visible_food_items: List[str] = Field(default_factory=list, description="List of distinctly visible food items")
    visible_ingredients: List[str] = Field(default_factory=list, description="Ingredients visible directly on plate")
    inferred_ingredients: List[str] = Field(default_factory=list, description="Probable preparation ingredients not directly visible (oils, seasonings)")
    estimated_serving_size: Optional[str] = Field(default=None, description="Estimated portion size or serving description")
    estimated_nutrition: Optional[EstimatedNutrition] = Field(default=None, description="Estimated macronutrients if determinable")
    limitations: List[str] = Field(default_factory=list, description="Important uncertainties from hidden ingredients, portion density, or image quality")
    warnings: List[str] = Field(default_factory=list, description="Health, allergen, and medical disclaimers")
    model_used: str = Field(description="Identified model used for inference")
    inference_time_ms: Optional[float] = Field(default=None, description="Inference latency in milliseconds")


class FreshnessAnalysisResponse(BaseModel):
    food_name: str = Field(description="Likely food identification")
    food_category: str = Field(
        default="unknown",
        description="produce, fruit, vegetable, meat, seafood, dairy, prepared food, or unknown"
    )
    freshness_status: str = Field(
        description="Freshness assessment status: appears_fresh, possible_deterioration, or cannot_assess"
    )
    visual_condition_score: Optional[int] = Field(
        default=None,
        description="Optional visual condition score from 0-100, only if meaningful visual assessment is possible"
    )
    visible_indicators: List[str] = Field(default_factory=list, description="List of observed visual characteristics")
    positive_indicators: List[str] = Field(default_factory=list, description="List of visible characteristics consistent with freshness")
    concerns: List[str] = Field(default_factory=list, description="List of visible characteristics that may indicate deterioration")
    explanation: str = Field(description="Concise explanation grounded in the uploaded image")
    recommended_action: str = Field(description="Cautious, practical next step")
    limitations: List[str] = Field(default_factory=list, description="List of relevant limitations of visual inspection")
    safety_warning: str = Field(
        default="Visual analysis cannot establish whether food is microbiologically safe to eat. Odor, temperature history, pathogens, and storage conditions cannot be verified from a photograph.",
        description="Explicit food safety limitation disclaimer"
    )
    model_used: str = Field(description="Configured model identifier")
    inference_time_ms: Optional[float] = Field(default=None, description="Measured inference latency in milliseconds")

    @field_validator("freshness_status")
    @classmethod
    def validate_freshness_status(cls, v: str) -> str:
        valid_statuses = {"appears_fresh", "possible_deterioration", "cannot_assess"}
        normalized = v.lower().strip()
        if normalized not in valid_statuses:
            return "cannot_assess"
        return normalized

    @field_validator("visual_condition_score")
    @classmethod
    def validate_score(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        try:
            val = int(v)
            if 0 <= val <= 100:
                return val
            return None
        except (ValueError, TypeError):
            return None



class HygieneAnalysisResponse(BaseModel):
    """
    Validated response schema for hygiene and safety visual environment assessment.
    """
    environment_summary: str = Field(description="Concise summary of the visible environment")
    overall_assessment: str = Field(
        description="Overall assessment: visible_concerns, no_obvious_visible_concerns, or cannot_assess"
    )
    confidence: Optional[str] = Field(
        default=None,
        description="Optional confidence estimate (e.g. 'High', 'Moderate', 'Low' model estimate, not calibrated probability)"
    )
    observations: List[str] = Field(default_factory=list, description="List of specific visible observations")
    cleanliness_indicators: List[str] = Field(default_factory=list, description="List of visually supported positive cleanliness indicators")
    potential_concerns: List[str] = Field(default_factory=list, description="List of visible or plausible concerns grounded in observable evidence")
    recommended_actions: List[str] = Field(default_factory=list, description="Practical actions relevant to the observed concerns")
    limitations: List[str] = Field(default_factory=list, description="Explanation of what cannot be determined from the image")
    safety_disclaimer: str = Field(
        default="An image-only AI assessment cannot certify hygiene or food safety. Photographic inspection cannot verify microbial sterility, chemical residues, viral contamination, or safe handling practices.",
        description="Explicit statement that an image-only AI assessment cannot certify hygiene or food safety"
    )
    model_used: str = Field(description="Configured model identifier")
    inference_time_ms: Optional[float] = Field(default=None, description="Measured inference duration in milliseconds")

    @field_validator("overall_assessment")
    @classmethod
    def validate_overall_assessment(cls, v: str) -> str:
        valid_assessments = {"visible_concerns", "no_obvious_visible_concerns", "cannot_assess"}
        normalized = v.lower().strip()
        if normalized not in valid_assessments:
            return "cannot_assess"
        return normalized



class SmartKitchenAssistRequest(BaseModel):
    """
    Request payload for AI-powered Smart Kitchen storage guidance & ingredient utilization.
    """
    mode: str = Field(
        default="utilization",
        description="Assistance mode: 'utilization' (recipes/cooking suggestions) or 'storage' (preservation guidance)"
    )
    ingredients: List[str] = Field(
        ...,
        min_length=1,
        description="List of selected real ingredients from inventory"
    )
    dietary_preferences: Optional[str] = Field(
        default=None,
        description="Optional dietary guidelines or exclusions (e.g. 'vegetarian', 'gluten-free')"
    )

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        mode_clean = v.lower().strip()
        if mode_clean not in {"utilization", "storage"}:
            return "utilization"
        return mode_clean

    @field_validator("ingredients")
    @classmethod
    def validate_ingredients(cls, v: List[str]) -> List[str]:
        cleaned = [item.strip() for item in v if item and item.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty ingredient must be provided.")
        return cleaned[:15]  # Limit to 15 items to respect token boundaries


class StorageGuidanceItem(BaseModel):
    ingredient: str
    recommended_location: str
    best_practices: List[str] = Field(default_factory=list)
    separation_notes: Optional[str] = None
    preservation_limitations: Optional[str] = None


class RecipeSuggestion(BaseModel):
    dish_name: str
    matched_ingredients: List[str] = Field(default_factory=list)
    optional_ingredients: List[str] = Field(default_factory=list)
    additional_needed: List[str] = Field(default_factory=list)
    preparation_steps: List[str] = Field(default_factory=list)
    estimated_prep_time: Optional[str] = None


class SmartKitchenAssistResponse(BaseModel):
    """
    Structured response for storage guidance or ingredient utilization.
    """
    mode: str
    summary: str
    storage_guidance: List[StorageGuidanceItem] = Field(default_factory=list)
    recipe_suggestions: List[RecipeSuggestion] = Field(default_factory=list)
    practical_tips: List[str] = Field(default_factory=list)
    safety_advisory: str = Field(
        default="Storage guidance and date calculations are estimates. They do not certify food safety or microbiological freshness. Always inspect food condition, odor, and texture before consumption."
    )
    model_used: str
    inference_time_ms: Optional[float] = None



class MealPlannerGenerateRequest(BaseModel):
    """
    Request parameters for generating a personalized structured meal plan.
    """
    duration_days: int = Field(default=3, ge=1, le=7, description="Number of days to plan (1 to 7)")
    meals_per_day: List[str] = Field(
        default=["breakfast", "lunch", "dinner"],
        description="Meal types to include (breakfast, lunch, dinner, snack)"
    )
    dietary_preference: str = Field(
        default="none",
        description="Dietary preference: vegetarian, vegan, non-vegetarian, pescatarian, keto, or none"
    )
    allergies_and_exclusions: List[str] = Field(
        default_factory=list,
        description="Explicit allergies or excluded ingredients (e.g. peanuts, dairy, shellfish, gluten)"
    )
    preferred_ingredients: List[str] = Field(
        default_factory=list,
        description="User's preferred flavors, proteins, or produce"
    )
    inventory_ingredients: List[str] = Field(
        default_factory=list,
        description="Available ingredients prioritized from local Smart Kitchen inventory"
    )
    cuisine_preference: Optional[str] = Field(
        default=None,
        description="Cuisine style (e.g. Mediterranean, Asian, Mexican, Any)"
    )
    cooking_time_preference: Optional[str] = Field(
        default="under 30 minutes",
        description="Time constraint (e.g. quick under 20 mins, under 30 mins, standard)"
    )
    calorie_target_daily: Optional[int] = Field(
        default=None,
        ge=800,
        le=5000,
        description="Optional target daily caloric preference (estimate only)"
    )

    @field_validator("duration_days")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v < 1:
            return 1
        if v > 7:
            return 7
        return v

    @field_validator("meals_per_day")
    @classmethod
    def validate_meals(cls, v: List[str]) -> List[str]:
        valid_meals = {"breakfast", "lunch", "dinner", "snack"}
        cleaned = [m.lower().strip() for m in v if m.lower().strip() in valid_meals]
        return cleaned if cleaned else ["breakfast", "lunch", "dinner"]


class MealItem(BaseModel):
    meal_type: str = Field(description="breakfast, lunch, dinner, or snack")
    meal_name: str = Field(description="Name of the dish")
    short_description: str = Field(description="Brief culinary description")
    ingredients: List[str] = Field(default_factory=list, description="Ingredients with approximate portions")
    preparation_steps: List[str] = Field(default_factory=list, description="Step-by-step cooking steps")
    estimated_prep_and_cook_time: str = Field(default="20 mins", description="Estimated cooking time")
    estimated_nutrition: Optional[Dict[str, str]] = Field(
        default=None,
        description="Estimated non-clinical nutritional figures (e.g. calories: ~450 kcal, protein: ~25g)"
    )
    uses_inventory: List[str] = Field(default_factory=list, description="Ingredients matched from Smart Kitchen inventory")
    additional_needed: List[str] = Field(default_factory=list, description="Ingredients not in user's inventory")


class DayMealPlan(BaseModel):
    day_number: int = Field(ge=1, le=7)
    day_label: str = Field(description="e.g. Day 1 (Monday)")
    daily_theme: Optional[str] = None
    meals: List[MealItem] = Field(default_factory=list)
    daily_estimated_calories: Optional[str] = None


class MealPlannerGenerateResponse(BaseModel):
    """
    Structured response payload for generated personalized meal plan.
    """
    planning_period: str = Field(description="e.g. 3-Day Personalized Meal Plan")
    dietary_preference_applied: str
    allergies_respected: List[str] = Field(default_factory=list)
    daily_plans: List[DayMealPlan] = Field(default_factory=list)
    consolidated_shopping_list: List[str] = Field(
        default_factory=list,
        description="Consolidated list of additional ingredients needed across all days"
    )
    preparation_notes: List[str] = Field(default_factory=list)
    allergy_and_health_warning: str = Field(
        default="Nutritional figures and portions are model estimates and not laboratory measurements or clinical advice. Always inspect ingredient packaging for cross-contamination and allergens before consuming.",
        description="Mandatory health, allergen, and safety disclaimer"
    )
    model_used: str
    inference_time_ms: Optional[float] = None


class ErrorResponse(BaseModel):
    error_code: str = Field(description="Machine-readable error code")
    message: str = Field(description="Human-readable safe explanation")
    guidance: Optional[str] = Field(default=None, description="Actionable suggestion for resolution")




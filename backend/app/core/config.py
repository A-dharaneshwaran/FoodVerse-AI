"""
Application configuration using pydantic-settings.
Safely manages environment variables without leaking credentials.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "FoodVerse AI"
    APP_ENV: str = "development"
    APP_VERSION: str = "1.1.0-phase2"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # CORS Origin configuration
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    
    # AI Provider settings
    AI_PROVIDER: str = "nvidia"
    AI_API_KEY: Optional[str] = None
    AI_API_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    AI_MODEL: str = "meta/llama-3.2-11b-vision-instruct"

    @property
    def api_base_url(self) -> str:
        if self.AI_API_BASE_URL and self.AI_API_BASE_URL.strip():
            return self.AI_API_BASE_URL.strip()
        return "https://integrate.api.nvidia.com/v1"

    @property
    def model_name(self) -> str:
        if self.AI_MODEL and self.AI_MODEL.strip():
            return self.AI_MODEL.strip()
        return "meta/llama-3.2-11b-vision-instruct"
    
    # Inference parameters & token quota protection
    AI_MAX_TOKENS: int = 450
    AI_TEMPERATURE: float = 0.2
    AI_TIMEOUT_SECONDS: float = 120.0
    
    # Image upload limits
    MAX_IMAGE_SIZE_BYTES: int = 8 * 1024 * 1024  # 8 MB
    MAX_IMAGE_DIMENSION: int = 1536  # Max dimension for preprocessing
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        default_dev_origins = ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"]
        if not self.FRONTEND_ORIGIN:
            return default_dev_origins
        configured = [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]
        # Merge configured origins with default local dev origins while preserving order and uniqueness
        seen = set()
        merged = []
        for origin in configured + default_dev_origins:
            if origin not in seen:
                seen.add(origin)
                merged.append(origin)
        return merged


settings = Settings()

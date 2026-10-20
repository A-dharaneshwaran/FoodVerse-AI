"""
FastAPI application entrypoint for FoodVerse AI.
Sets up structured logging, CORS middleware, centralized exception handling, and API routes.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.api.routes import health, system, food_recognition, freshness, hygiene, smart_kitchen, meal_planner

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("foodverse.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} [Environment: {settings.APP_ENV}]")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=settings.APP_NAME,
    description="FoodVerse AI — Backend API Foundation for food intelligence, safety, and meal planning.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Centralized error handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "message": "Invalid request parameters or payload.",
            "details": [{"loc": err["loc"], "msg": err["msg"], "type": err["type"]} for err in exc.errors()]
        }
    )

# Centralized generic exception handler to avoid leaking stack traces
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception during {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later."
        }
    )

# Mount API routers
app.include_router(health.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(food_recognition.router, prefix="/api")
app.include_router(freshness.router, prefix="/api")
app.include_router(hygiene.router, prefix="/api")
app.include_router(smart_kitchen.router, prefix="/api")
app.include_router(meal_planner.router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tagline": "Intelligent Food. Safer Choices.",
        "documentation": "/docs",
        "health": "/api/health",
        "system_status": "/api/system/status"
    }

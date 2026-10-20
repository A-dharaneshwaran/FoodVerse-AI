# FoodVerse AI — Intelligent Food. Safer Choices.

Production-grade multimodal food intelligence, nutrition estimation, visual freshness detection, kitchen safety inspection, pantry inventory tracking, and personalized meal planning platform.

Powered by **React 18**, **FastAPI**, and **NVIDIA API Catalog** utilizing the multimodal pretrained foundation model `meta/llama-3.2-11b-vision-instruct`.

---

## 1. Architecture Overview

FoodVerse AI is built with a decoupled frontend and backend architecture:

- **Frontend (`frontend/`)**: React 18, Vite, Lucide Icons, and an editorial dark Vanilla CSS design system. ES modules only, zero TypeScript/TSX.
- **Backend (`backend/`)**: Python 3.10+ with FastAPI, Pydantic v2 schemas and validation, `pydantic-settings`, Pillow image security safeguards, and Uvicorn ASGI server.
- **AI Multimodal Inference (`backend/app/services/ai_service.py`)**: Real pretrained vision and structured reasoning inference via **NVIDIA API Catalog** (`meta/llama-3.2-11b-vision-instruct`). Pretrained inference only; zero local model training or fine-tuning pipelines.

---

## 2. Directory Structure

```text
foodverse-ai/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx                 # Top bar with status & drawer toggle
│   │   │   └── Sidebar.jsx                # Module navigation & active module indicators
│   │   ├── pages/
│   │   │   ├── OverviewPage.jsx           # Live telemetry, system health, and module launcher
│   │   │   ├── FoodRecognitionPage.jsx    # Visual dish detection & macronutrient breakdown
│   │   │   ├── FreshnessDetectorPage.jsx  # Produce & perishables visual condition evaluation
│   │   │   ├── HygieneMonitorPage.jsx     # Food prep & kitchen sanitary risk assessment
│   │   │   ├── SmartKitchenPage.jsx       # Local pantry inventory CRUD & zero-waste assistant
│   │   │   └── MealPlannerPage.jsx        # Multi-day personalized meal plan & grocery list
│   │   ├── services/
│   │   │   └── api.js                     # Centralized API client with timeout & error mappings
│   │   ├── App.jsx                        # Layout router & telemetry polling
│   │   ├── main.jsx                       # React 18 DOM root
│   │   └── styles.css                     # Editorial dark theme design system & responsive rules
│   ├── .env.example                       # Frontend environment template
│   ├── .env                               # Local frontend environment config (git-ignored)
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py              # GET /api/health
│   │   │       ├── system.py              # GET /api/system/status
│   │   │       ├── food_recognition.py   # POST /api/food-recognition/analyze
│   │   │       ├── freshness.py           # POST /api/freshness/analyze
│   │   │       ├── hygiene.py             # POST /api/hygiene/analyze
│   │   │       ├── smart_kitchen.py       # POST /api/smart-kitchen/assist
│   │   │       └── meal_planner.py        # POST /api/meal-planner/generate
│   │   ├── core/
│   │   │   └── config.py                  # Pydantic settings with NVIDIA endpoints & quotas
│   │   ├── schemas/
│   │   │   └── system.py                  # Pydantic v2 request/response models & error schemas
│   │   ├── services/
│   │   │   ├── ai_service.py              # NVIDIA LLaMA 3.2 Vision chat completion provider
│   │   │   └── image_service.py           # Pillow validation, decompression bomb protection
│   │   └── main.py                        # FastAPI entrypoint, CORS & router registration
│   ├── tests/
│   │   ├── conftest.py                    # Pytest test configuration and fixtures
│   │   ├── test_food_recognition.py       # Food recognition integration & error tests
│   │   ├── test_freshness.py              # Freshness detector integration & score tests
│   │   ├── test_hygiene.py                # Hygiene assessment & observation tests
│   │   ├── test_image_service.py          # Image format, size, and EXIF processing tests
│   │   ├── test_smart_kitchen.py          # Pantry serialization & prompt construction tests
│   │   └── test_meal_planner.py           # Meal planner dietary & multi-day scheduling tests
│   ├── .env.example                       # Backend environment template
│   ├── .env                               # Local backend environment config (git-ignored)
│   └── requirements.txt                   # Backend Python dependencies
├── FOODVERSE_REQUIREMENTS_AUDIT.md        # Architecture audit report
├── .gitignore                             # Root git ignore rules
└── README.md
```

---

## 3. Core Modules Overview

FoodVerse AI provides six distinct functional modules:

### 1. Overview Dashboard
- **Purpose**: Real-time telemetry dashboard providing operational health status for the FastAPI backend and NVIDIA API Catalog connectivity.
- **Capabilities**: Displays live connection status badges, quick telemetry metrics, and primary navigation cards into each functional AI module.

### 2. Food Recognition & Composition
- **Purpose**: Visual plate analysis for instant dish identification, component ingredient breakdown, and portion-based macronutrient estimation.
- **Capabilities**: Identifies primary dish names, observable ingredients, inferred culinary components (seasonings, oils), portion estimates, and caloric/macronutrient values (calories, protein, carbs, fat, fiber, sodium).

### 3. Freshness Detector
- **Purpose**: Visual condition and spoilage evaluation of raw produce, perishables, fruits, vegetables, and meats.
- **Capabilities**: Assigns a visual condition score (0–100), classifies state (`appears_fresh`, `possible_deterioration`, or `cannot_assess`), lists positive visual indicators vs. spoilage concerns (browning, wilting, bruising), and recommends cautious storage or handling steps.

### 4. Hygiene & Kitchen Safety Monitor
- **Purpose**: Photographic kitchen environment and food preparation area cleanliness and cross-contamination inspection.
- **Capabilities**: Classifies visible safety (`no_obvious_visible_concerns`, `visible_concerns`, or `cannot_assess`), details observable cleanliness indicators, identifies cross-contamination risks (e.g. unwashed contact surfaces, raw/ready-to-eat juxtaposition), and outlines corrective actions.

### 5. Smart Kitchen Assistant
- **Purpose**: Local pantry and refrigerator inventory tracker paired with an AI culinary utilization advisor.
- **Capabilities**: Tracks inventory items with days-left countdowns, generates zero-waste utilization recipes tailored to items nearing expiry, or provides ingredient-specific storage guidelines.

### 6. Personalized Meal Planner
- **Purpose**: Multi-day bespoke culinary and dietary schedule generator.
- **Capabilities**: Accepts duration (1–7 days), daily caloric target, and strict dietary preferences (vegan, vegetarian, keto, gluten-free, etc.). Produces complete breakfast, lunch, and dinner schedules with per-meal macros, prep steps, and an aggregated shopping list.

---

## 4. Important Food Safety & Medical Disclaimer

> [!WARNING]
> **Safety Notice:** AI-generated dish recognitions, macronutrient and caloric estimates, visual freshness observations, and kitchen hygiene assessments are automated probabilistic estimations based on photographic evidence alone. They are **not** substitutes for laboratory microbiology, chemical analysis, professional medical advice, clinical dietary diagnosis, or regulatory food safety testing. Optical inspection cannot verify internal core temperatures, bacterial or viral sterility, odorless toxins, or allergen purity. Always exercise caution, adhere to certified food handling procedures, and consult licensed dietary and health professionals when in doubt.

---

## 5. Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 18, Vite | Single-page application bundled with Vite |
| **Icons & UI** | Lucide React, Vanilla CSS | Bespoke dark editorial theme with zero CSS framework bloat |
| **Backend** | Python 3.10+, FastAPI | High-throughput asynchronous REST API |
| **Data Validation** | Pydantic v2, `pydantic-settings` | Strict request/response typing and environment parsing |
| **Image Safeguards**| Pillow (PIL) | Decompression bomb protection, EXIF auto-rotation, downscaling |
| **HTTP Client** | HTTPX | Async HTTP client with granular timeout controls |
| **AI Vision Provider** | NVIDIA API Catalog | `meta/llama-3.2-11b-vision-instruct` multimodal model |
| **Testing** | Pytest, `pytest-asyncio` | Automated backend route, schema, and edge-case unit test suite |

---

## 6. Environment Variables Configuration

### Backend Configuration (`backend/.env`)

Copy the template:
```powershell
Copy-Item backend\.env.example backend\.env
```

Configurable parameters (using placeholders):
```ini
# Application Environment
APP_ENV=development
APP_NAME="FoodVerse AI"
HOST=127.0.0.1
PORT=8000

# CORS Origins (comma-separated for local dev)
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5174

# AI Inference Service Provider Configuration (NVIDIA API Catalog)
AI_PROVIDER=nvidia
# Supply your personal NVIDIA API key from build.nvidia.com (e.g. nvapi-...)
AI_API_KEY=your_nvidia_api_key_here
AI_API_BASE_URL=https://integrate.api.nvidia.com/v1
AI_MODEL=meta/llama-3.2-11b-vision-instruct

# Inference parameters & token quota protection
AI_MAX_TOKENS=450
AI_TEMPERATURE=0.2
AI_TIMEOUT_SECONDS=120.0
```

> **Security Note:** Never commit `backend/.env` or any real API keys to version control. The root `.gitignore` excludes `.env` and all `.env.*` variants while keeping safe `.env.example` templates tracked.

### Frontend Configuration (`frontend/.env`)

Copy the template:
```powershell
Copy-Item frontend\.env.example frontend\.env
```

Configurable parameters:
```ini
VITE_API_BASE_URL=http://localhost:8000
```

---

## 7. Installation & Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **NVIDIA Developer API Key**: An active API key with access to `meta/llama-3.2-11b-vision-instruct` via [NVIDIA API Catalog](https://build.nvidia.com/)

---

### Windows (PowerShell) Setup

#### Step 1: Backend Setup
Open a PowerShell terminal:
```powershell
# Navigate to the backend directory
cd backend

# If script execution is restricted, permit for the current session:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Upgrade pip and install backend dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Configure your environment variables
Copy-Item .env.example .env
# Edit .env and insert your real NVIDIA API key in AI_API_KEY=your_key_here

# Start the FastAPI backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Backend API: `http://127.0.0.1:8000`
- Swagger Interactive Documentation: `http://127.0.0.1:8000/docs`

#### Step 2: Frontend Setup
Open a second PowerShell terminal:
```powershell
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Configure frontend environment variables
Copy-Item .env.example .env

# Start the Vite development server
npm run dev
```
- Frontend application: `http://localhost:5173`

---

## 8. Running the Automated Tests

All automated tests are located under `backend/tests/` and can be executed via Pytest.

In PowerShell (with the backend virtual environment active):
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest -v tests/
```

To run individual module test suites:
```powershell
pytest tests/test_hygiene.py
pytest tests/test_food_recognition.py
pytest tests/test_freshness.py
pytest tests/test_smart_kitchen.py
pytest tests/test_meal_planner.py
pytest tests/test_image_service.py
```

To validate the frontend production build:
```powershell
cd frontend
npm run build
```

---

## 9. Troubleshooting

### Port Conflicts (Port 8000 or 5173 in use)
- **Backend**: If port `8000` is already in use by another service, launch Uvicorn on another port (e.g., `8001`):
  ```powershell
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
  ```
  Then update `frontend/.env`:
  ```ini
  VITE_API_BASE_URL=http://localhost:8001
  ```
- **Frontend**: Vite automatically falls back to port `5174` if `5173` is busy. The backend CORS configuration in [backend/app/core/config.py](backend/app/core/config.py) automatically permits origins `http://localhost:5173`, `http://localhost:5174`, `http://127.0.0.1:5173`, and `http://127.0.0.1:5174`.

### AI Vision Inference Timeouts (`PROVIDER_TIMEOUT` / `504`)
- Multimodal vision models such as `meta/llama-3.2-11b-vision-instruct` perform deep visual tokenization and structured JSON generation. During periods of high provider demand, responses can take 60–95 seconds.
- Ensure `AI_TIMEOUT_SECONDS=120.0` in `backend/.env`.
- The frontend client timeout is configured to `135000ms` (135 seconds) to prevent premature client-side aborts.

### CORS or Network Error
- Verify the backend is running and healthy: visit `http://127.0.0.1:8000/api/health` in your browser.
- Ensure `FRONTEND_ORIGIN` in `backend/.env` includes your frontend URL.

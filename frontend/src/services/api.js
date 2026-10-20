/**
 * FoodVerse AI API Client
 * Centralizes all calls to the FastAPI backend with timeout, error handling,
 * loading states, and connectivity verification.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Custom error wrapper for descriptive client handling
 */
export class ApiError extends Error {
  constructor(message, status, details = null, errorCode = null, guidance = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.errorCode = errorCode;
    this.guidance = guidance;
  }
}

/**
 * Fetch wrapper with timeout and standard JSON parsing
 */
async function apiRequest(endpoint, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(id);

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (e) {
        // Response was not JSON
      }
      throw new ApiError(
        errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData,
        errorData?.error_code,
        errorData?.guidance
      );
    }

    return await response.json();
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out connecting to backend server.', 408);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    // Network errors (backend not running, CORS issues, unreachable host)
    throw new ApiError(
      'Unable to connect to FoodVerse AI backend service. Verify that the FastAPI server is running.',
      0,
      { originalError: err.message }
    );
  }
}

/**
 * Health check endpoint
 * @returns {Promise<{status: string, app: string, version: string, timestamp: string}>}
 */
export async function getHealth() {
  return await apiRequest('/api/health');
}

/**
 * System status endpoint
 * @returns {Promise<{backend_status: string, environment: string, database_status: string, ai_status: object, planned_modules: string[]}>}
 */
export async function getSystemStatus() {
  return await apiRequest('/api/system/status');
}

/**
 * Helper to upload image and call vision analysis endpoints.
 */
async function uploadAndAnalyzeImage(endpoint, imageFile) {
  if (!imageFile) {
    throw new ApiError('Please select or capture a food photo to analyze.', 400);
  }

  const formData = new FormData();
  formData.append('image', imageFile);

  const controller = new AbortController();
  // Allow 135s for remote vision model processing (backend AI_TIMEOUT_SECONDS=120s + network overhead)
  const timeoutMs = 135000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
        // Do NOT set 'Content-Type': browser automatically appends multipart/form-data; boundary=...
      }
    });

    clearTimeout(timeoutId);

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      // Non-JSON response
    }

    if (!response.ok) {
      throw new ApiError(
        data?.message || `Analysis failed with HTTP ${response.status}`,
        response.status,
        data,
        data?.error_code,
        data?.guidance
      );
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(
        'The analysis is taking longer than expected. Please try again shortly.',
        504,
        null,
        'TIMEOUT',
        'Please try again with a clearer or smaller photo.'
      );
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      'Unable to reach FoodVerse AI backend service. Verify that the server is active.',
      0,
      { originalError: err.message }
    );
  }
}

/**
 * Analyzes a food image for dish recognition and nutritional estimation.
 *
 * @param {File} imageFile - The image File object from file picker or drop zone
 * @returns {Promise<object>} - Validated FoodRecognitionResponse
 */
export async function analyzeFoodImage(imageFile) {
  return await uploadAndAnalyzeImage('/api/food-recognition/analyze', imageFile);
}

/**
 * Analyzes visual freshness and decay indicators.
 *
 * @param {File} imageFile - The image File object from file picker or drop zone
 * @returns {Promise<object>} - Validated FreshnessAnalysisResponse
 */
export async function analyzeFreshnessImage(imageFile) {
  return await uploadAndAnalyzeImage('/api/freshness/analyze', imageFile);
}

/**
 * Analyzes visual kitchen sanitation and cross-contamination risks.
 *
 * @param {File} imageFile - The image File object from file picker or drop zone
 * @returns {Promise<object>} - Validated HygieneAnalysisResponse
 */
export async function analyzeHygieneImage(imageFile) {
  return await uploadAndAnalyzeImage('/api/hygiene/analyze', imageFile);
}

/**
 * Requests Smart Kitchen storage guidance or zero-waste recipes.
 *
 * @param {object} payload - { mode: 'utilization'|'storage', ingredients: string[], dietary_preferences?: string }
 * @returns {Promise<object>} - Validated SmartKitchenAssistResponse
 */
export async function assistSmartKitchen(payload) {
  return await apiRequest('/api/smart-kitchen/assist', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, 45000);
}

/**
 * Generates a structured personalized multi-day meal plan.
 *
 * @param {object} payload - MealPlannerGenerateRequest
 * @returns {Promise<object>} - Validated MealPlannerGenerateResponse
 */
export async function generateMealPlan(payload) {
  return await apiRequest('/api/meal-planner/generate', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, 45000);
}

export { API_BASE_URL };




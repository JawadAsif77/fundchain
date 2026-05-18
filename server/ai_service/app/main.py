"""
FundChain AI Service - Scam Detection & Risk Analysis API
This FastAPI service provides ML-powered project analysis for detecting scams,
plagiarism, and assessing wallet risk scores.

Security: all /analyze-* endpoints require the x-ai-service-secret header
matching the AI_SERVICE_SECRET environment variable.  Requests without a
valid secret receive HTTP 403 and the model output is never returned.
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import joblib
import os
import re
import secrets
from difflib import SequenceMatcher

# ============================================================================
# 0. Secret verification helper
# ============================================================================
_AI_SERVICE_SECRET = os.environ.get("AI_SERVICE_SECRET", "")

def verify_service_secret(x_ai_service_secret: Optional[str]) -> None:
    """Raise HTTP 403 if the shared secret header is missing or wrong."""
    if not _AI_SERVICE_SECRET:
        # Secret not configured on server — block all calls to prevent accidental exposure
        raise HTTPException(status_code=500, detail="AI service secret is not configured.")
    if not x_ai_service_secret or not secrets.compare_digest(
        x_ai_service_secret, _AI_SERVICE_SECRET
    ):
        raise HTTPException(status_code=403, detail="Forbidden: invalid service secret.")

# ============================================================================
# 1. Load the trained ML model
# ============================================================================
MODEL_PATH = os.path.join("ml", "models", "scam_model.joblib")

try:
    model = joblib.load(MODEL_PATH)
    print(f"✓ Model loaded successfully from: {MODEL_PATH}")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None

# ============================================================================
# 2. Initialize FastAPI app
# ============================================================================
app = FastAPI(
    title="FundChain AI Service",
    description="ML-powered scam detection, plagiarism checking, and risk analysis for investment projects",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS: only Supabase Edge Functions call this service, not the browser directly.
# Restrict to the Supabase project origin; update if your project URL changes.
_ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://*.supabase.co,https://*.supabase.net"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["content-type", "x-ai-service-secret"],
)

# ============================================================================
# 3. Define Pydantic request model
# ============================================================================
class ProjectAnalysisRequest(BaseModel):
    description: str = Field(..., description="Project description text to analyze")
    existing_descriptions: List[str] = Field(
        default=[],
        description="List of existing project descriptions to check for plagiarism"
    )
    wallet_age_days: int = Field(..., ge=0, description="Age of creator's wallet in days")
    past_investments: int = Field(..., ge=0, description="Number of past investments by creator")

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Revolutionary AI-powered trading bot guarantees 500% returns monthly!",
                "existing_descriptions": [
                    "AI trading platform with machine learning algorithms",
                    "Automated trading system for cryptocurrency markets"
                ],
                "wallet_age_days": 5,
                "past_investments": 0
            }
        }

class ProjectAnalysisResponse(BaseModel):
    ml_scam_score: float = Field(..., description="ML model scam probability (0-1)")
    plagiarism_score: float = Field(..., description="Plagiarism similarity score (0-1)")
    wallet_risk_score: float = Field(..., description="Wallet-based risk score (0-1)")
    final_risk_score: float = Field(..., description="Combined weighted risk score (0-1)")

# ============================================================================
# 4. Implement plagiarism detection function
# ============================================================================
def compute_plagiarism_score(description: str, existing_descriptions: List[str]) -> float:
    """
    Compute plagiarism score using difflib.SequenceMatcher.
    Returns the highest similarity ratio between description and existing descriptions.
    
    Args:
        description: The project description to check
        existing_descriptions: List of existing project descriptions
        
    Returns:
        float: Highest similarity score (0.0 to 1.0)
    """
    if not existing_descriptions:
        return 0.0
    
    max_similarity = 0.0
    
    for existing_desc in existing_descriptions:
        # Use SequenceMatcher to compute similarity ratio
        similarity = SequenceMatcher(None, description.lower(), existing_desc.lower()).ratio()
        max_similarity = max(max_similarity, similarity)
    
    return round(max_similarity, 4)


def compute_text_risk_signal(description: str) -> float:
    """
    Compute a heuristic text-risk signal from scam-like language patterns.

    Signal components include:
    - unrealistic return promises
    - urgency language
    - excessive hype formatting
    - external contact pressure
    """
    text = (description or "").strip()
    if not text:
        return 0.0

    normalized = text.lower()
    signal = 0.0

    high_risk_patterns = [
        r"guaranteed\s+(profits?|returns?)",
        r"\b(100|200|300|500|1000)%\b",
        r"\bdouble\s+your\s+money\b",
        r"\brisk[-\s]?free\b",
        r"\bno\s+risk\b",
    ]
    medium_risk_patterns = [
        r"\b(act now|limited time|urgent|last chance)\b",
        r"\bsecret\s+strategy\b",
        r"\binsider\s+tips?\b",
        r"\bguaranteed\b",
        r"\bmoon\b",
        r"\bget rich quick\b",
    ]

    for pattern in high_risk_patterns:
        if re.search(pattern, normalized):
            signal += 0.14

    for pattern in medium_risk_patterns:
        if re.search(pattern, normalized):
            signal += 0.07

    uppercase_chars = sum(1 for char in text if char.isupper())
    alpha_chars = sum(1 for char in text if char.isalpha())
    caps_ratio = (uppercase_chars / alpha_chars) if alpha_chars > 0 else 0
    if caps_ratio > 0.35:
        signal += 0.08
    elif caps_ratio > 0.22:
        signal += 0.04

    exclamation_count = text.count("!")
    if exclamation_count >= 5:
        signal += 0.07
    elif exclamation_count >= 2:
        signal += 0.03

    if any(token in normalized for token in ["dm me", "telegram", "whatsapp", "signal me"]):
        signal += 0.07

    return round(min(signal, 1.0), 4)

# ============================================================================
# 5. Implement wallet risk scoring function
# ============================================================================
def compute_wallet_risk_score(wallet_age_days: int, past_investments: int) -> float:
    """
    Compute wallet risk score based on wallet age and past investment history.
    
    Rules:
        - Wallet age < 7 days: +0.4 risk
        - No past investments: +0.3 risk
        - Risk capped at 1.0
    
    Args:
        wallet_age_days: Age of wallet in days
        past_investments: Number of past investments
        
    Returns:
        float: Wallet risk score (0.0 to 1.0)
    """
    risk_score = 0.0
    
    # New wallet penalty
    if wallet_age_days < 7:
        risk_score += 0.4
    
    # No investment history penalty
    if past_investments == 0:
        risk_score += 0.3
    
    # Ensure risk doesn't exceed 1.0
    return min(risk_score, 1.0)

# ============================================================================
# Health check endpoint
# ============================================================================
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "FundChain AI Service",
        "version": "1.1.0",
        "model_loaded": model is not None
    }

# ============================================================================
# 6. Main analysis endpoint
# ============================================================================
@app.post("/analyze-project", response_model=ProjectAnalysisResponse)
async def analyze_project(
    request: ProjectAnalysisRequest,
    x_ai_service_secret: Optional[str] = Header(default=None),
):
    """
    Analyze a project for scam probability, plagiarism, and wallet risk.
    Requires x-ai-service-secret header matching AI_SERVICE_SECRET env var.
    """
    verify_service_secret(x_ai_service_secret)

    # Check if model is loaded
    if model is None:
        raise HTTPException(
            status_code=500,
            detail=f"ML model not loaded. Please ensure {MODEL_PATH} exists."
        )
    
    try:
        # Step 1: Compute model probability + heuristic text-risk signal
        # predict_proba returns probabilities for [legitimate, scam]
        # We take the scam probability (index 1)
        ml_scam_prob = float(model.predict_proba([request.description])[0][1])
        text_risk_signal = compute_text_risk_signal(request.description)
        ml_scam_score = round(min((0.8 * ml_scam_prob) + (0.2 * text_risk_signal), 1.0), 4)
        
        # Step 2: Compute plagiarism score
        plagiarism_score = compute_plagiarism_score(
            request.description,
            request.existing_descriptions
        )
        
        # Step 3: Compute wallet risk score
        wallet_risk_score = compute_wallet_risk_score(
            request.wallet_age_days,
            request.past_investments
        )
        
        # Step 4: Compute final weighted risk score
        # Weights: 60% ML, 25% plagiarism, 15% wallet
        final_risk_score = (
            0.6 * ml_scam_score +
            0.25 * plagiarism_score +
            0.15 * wallet_risk_score
        )
        final_risk_score = round(final_risk_score, 4)
        
        # Return analysis results
        return ProjectAnalysisResponse(
            ml_scam_score=ml_scam_score,
            plagiarism_score=plagiarism_score,
            wallet_risk_score=wallet_risk_score,
            final_risk_score=final_risk_score
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during analysis: {str(e)}"
        )

# ============================================================================
# Additional utility endpoint for batch analysis
# ============================================================================
@app.post("/analyze-batch")
async def analyze_batch(
    requests: List[ProjectAnalysisRequest],
    x_ai_service_secret: Optional[str] = Header(default=None),
):
    """Analyze multiple projects. Requires x-ai-service-secret header."""
    verify_service_secret(x_ai_service_secret)

    results = []
    for req in requests:
        try:
            result = await analyze_project(req, x_ai_service_secret=x_ai_service_secret)
            results.append(result)
        except HTTPException as e:
            if e.status_code == 403:
                raise  # Re-raise auth errors
            results.append({"error": "Analysis failed"})

    return {"results": results, "total": len(results)}

# ============================================================================
# Model info endpoint
# ============================================================================
@app.get("/model-info")
async def model_info():
    """Get information about the loaded ML model"""
    if model is None:
        return {
            "loaded": False,
            "error": "Model not loaded"
        }
    
    return {
        "loaded": True,
        "model_path": MODEL_PATH,
        "model_type": str(type(model)),
        "pipeline_steps": [step[0] for step in model.steps] if hasattr(model, 'steps') else None
    }

if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 70)
    print("Starting FundChain AI Service")
    print("=" * 70)
    print(f"Model loaded: {model is not None}")
    print("API Documentation: http://localhost:8001/docs")
    print("=" * 70 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)

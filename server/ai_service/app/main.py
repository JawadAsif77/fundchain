"""
FundChain AI Service - Scam Detection & Risk Analysis API
This FastAPI service provides ML-powered project analysis for detecting scams,
plagiarism, and assessing wallet risk scores.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
import joblib
import os
from difflib import SequenceMatcher

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
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        "version": "1.0.0",
        "model_loaded": model is not None
    }

# ============================================================================
# 6. Main analysis endpoint
# ============================================================================
@app.post("/analyze-project", response_model=ProjectAnalysisResponse)
async def analyze_project(request: ProjectAnalysisRequest):
    """
    Analyze a project for scam probability, plagiarism, and wallet risk.
    
    This endpoint combines multiple analysis methods:
    1. ML-based scam detection using trained model
    2. Plagiarism detection via text similarity
    3. Wallet risk assessment based on age and history
    
    Final risk score is weighted combination:
        - 60% ML scam score
        - 25% plagiarism score
        - 15% wallet risk score
    """
    
    # Check if model is loaded
    if model is None:
        raise HTTPException(
            status_code=500,
            detail=f"ML model not loaded. Please ensure {MODEL_PATH} exists."
        )
    
    try:
        # Step 1: Compute ML scam score using predict_proba
        # predict_proba returns probabilities for [legitimate, scam]
        # We take the scam probability (index 1)
        ml_scam_prob = model.predict_proba([request.description])[0][1]
        ml_scam_score = round(float(ml_scam_prob), 4)
        
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
async def analyze_batch(requests: List[ProjectAnalysisRequest]):
    """
    Analyze multiple projects in a single request.
    Returns a list of analysis results.
    """
    results = []
    
    for req in requests:
        try:
            result = await analyze_project(req)
            results.append(result)
        except Exception as e:
            results.append({
                "error": str(e),
                "description": req.description[:50] + "..."
            })
    
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

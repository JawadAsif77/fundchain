# FundChain AI Service (Module 7)
This microservice handles:
- Scam detection
- Similarity detection
- Wallet risk scoring
- Final risk aggregation

Tech Stack:
- Python 3.14
- FastAPI
- scikit-learn
- joblib

How to run:
1. python -m venv venv
2. source venv/bin/activate
3. pip install -r requirements.txt
4. uvicorn app.main:app --reload --port 8001

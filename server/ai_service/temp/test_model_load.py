import joblib

model = joblib.load("ml/models/scam_model.joblib")
print("Model loaded successfully!")

sample = ["This investment guarantees daily profits."]
pred = model.predict_proba(sample)
print("Prediction:", pred)

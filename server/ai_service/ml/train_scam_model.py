"""
Training script for FundChain Scam Detection Model.
This script loads scam_dataset.csv, trains a TF-IDF + Logistic Regression classifier,
evaluates accuracy, and saves the trained pipeline to ml/models/scam_model.joblib.
"""

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

def main():
    print("=" * 70)
    print("FundChain Scam Detection Model Training")
    print("=" * 70)
    
    # 1. Load dataset
    print("\n[Step 1/6] Loading dataset from ml/data/scam_dataset.csv...")
    data_path = os.path.join("ml", "data", "scam_dataset.csv")
    
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at: {data_path}")
    
    df = pd.read_csv(data_path)
    print(f"✓ Dataset loaded successfully!")
    print(f"  - Total samples: {len(df)}")
    print(f"  - Columns: {list(df.columns)}")
    print(f"  - Label distribution:")
    print(df["label"].value_counts())
    
    # 2. Split data into train and test (80/20 split)
    print("\n[Step 2/6] Splitting dataset into training and testing sets (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
    )
    print(f"✓ Data split completed!")
    print(f"  - Training samples: {len(X_train)}")
    print(f"  - Testing samples: {len(X_test)}")
    
    # 3. Build Pipeline: TF-IDF + Logistic Regression
    print("\n[Step 3/6] Building scikit-learn Pipeline...")
    print("  - TfidfVectorizer(stop_words='english')")
    print("  - LogisticRegression(max_iter=200)")
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(stop_words="english")),
        ("clf", LogisticRegression(max_iter=200, random_state=42))
    ])
    print("✓ Pipeline created successfully!")
    
    # 4. Train the model
    print("\n[Step 4/6] Training the model on training set...")
    pipeline.fit(X_train, y_train)
    print("✓ Model training completed!")
    
    # 5. Evaluate on test data
    print("\n[Step 5/6] Evaluating model performance on test set...")
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    
    print("\n" + "=" * 70)
    print("MODEL PERFORMANCE METRICS")
    print("=" * 70)
    print(f"\n📊 Accuracy Score: {acc:.4f} ({acc*100:.2f}%)")
    print("\n📋 Classification Report:")
    print("-" * 70)
    print(classification_report(y_test, y_pred, target_names=["Legitimate", "Scam"]))
    
    # 6. Save trained model
    print("\n[Step 6/6] Saving trained model...")
    models_dir = os.path.join("ml", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    output_path = os.path.join(models_dir, "scam_model.joblib")
    joblib.dump(pipeline, output_path)
    print(f"✓ Model saved successfully to: {output_path}")
    
    print("\n" + "=" * 70)
    print("✅ Training completed successfully!")
    print("=" * 70)
    print(f"\nYou can now use the model for predictions by loading:")
    print(f"  pipeline = joblib.load('{output_path}')")
    print(f"  prediction = pipeline.predict(['your text here'])")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()

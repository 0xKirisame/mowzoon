"""
Mowzoon - End-to-End Execution Script (Berka Dataset)
"""

from data_ingestor import load_data
from features import extract_features
from model import MowzoonModel
from engine import PredictiveEngine
import config
from datetime import datetime
import warnings

# Suppress warnings for clean output
warnings.filterwarnings('ignore')

def main():
    print("="*50)
    print("MOWZOON - AI Financial Coaching PoC (Real-World Data)")
    print("="*50)
    
    # 1. Ingest Data
    print("\n[1] Downloading and Ingesting PKDD99 Berka Dataset...")
    transactions_df = load_data()
    print(f"Loaded {len(transactions_df)} real historical transactions.")
    
    # 2. Extract Metrics
    print("\n[2] Running Feature Engineering Pipeline...")
    features_df = extract_features(transactions_df)
    print(f"Successfully extracted metrics for {len(features_df)} unique bank accounts.")
    
    # 3 & 4. Unsupervised Clustering & Training
    print("\n[3 & 4] Bootstrapping Archetype Labels via K-Means and Training XGBoost...")
    mowzoon_model = MowzoonModel()
    split_data, features_df = mowzoon_model.prepare_data(features_df)
    X_train, X_test, y_train, y_test = split_data
    
    mowzoon_model.train(X_train, y_train)
    acc, report = mowzoon_model.evaluate(X_test, y_test)
    print(f"\nModel Accuracy on predicting K-Means labels: {acc:.4f}")
    
    # 5. Run Inference and Output Persona Report
    print("\n[5] Running Inference on a Test User Persona...")
    engine = PredictiveEngine()
    
    # Pick a random test user from the test set
    test_idx = X_test.index[0]
    test_user_features = X_test.loc[[test_idx]]
    test_user_id = features_df.loc[test_idx, 'user_id']
    
    # Extract scores
    eff = test_user_features['spending_efficiency'].values[0]
    res = test_user_features['proactive_resilience'].values[0]
    eq = test_user_features['financial_eq'].values[0]
    
    metrics = {
        'spending_efficiency': eff,
        'proactive_resilience': res,
        'financial_eq': eq
    }
    
    # Predict Archetype
    predicted_archetype_id = mowzoon_model.predict(test_user_features)
    predicted_archetype = config.ARCHETYPES[predicted_archetype_id]
    
    # Predict Spikes
    predicted_spike = engine.forecast_seasonal_spikes(current_date=datetime.now(), lookahead_days=60)
    
    # Generate Micro-Nudge
    micro_nudge = engine.generate_micro_nudge(predicted_archetype_id, metrics, predicted_spike)
    
    # Output Persona Report
    print("\n" + "="*50)
    print("MOWZOON USER PERSONA REPORT")
    print("="*50)
    print(f"Account ID: {test_user_id}")
    print(f"Identified Archetype: {predicted_archetype['name']}")
    print(f"Description: {predicted_archetype['description']}")
    print("-" * 50)
    print("Proprietary Behavioral Metrics:")
    print(f" - Spending Efficiency Score: {eff:.2f}/100")
    print(f" - Proactive Resilience Score: {res:.2f}/100")
    print(f" - Financial EQ Score:         {eq:.2f}/100")
    print("-" * 50)
    
    if predicted_spike:
        print(f"Next Predicted Seasonal Spike: {predicted_spike[0]} (in {predicted_spike[1]} days)")
    else:
        print("Next Predicted Seasonal Spike: None detected within 60 days.")
        
    print("-" * 50)
    print("Generated Daily Micro-Nudge:")
    print(f"> \"{micro_nudge}\"")
    print("="*50)

if __name__ == "__main__":
    main()

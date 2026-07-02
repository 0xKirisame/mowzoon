"""
Mowzoon - Feature Engineering (Berka Dataset)
"""

import pandas as pd
import numpy as np

def calculate_metrics(user_tx):
    """
    Computes metrics from the Berka dataset transaction schema.
    - 'PRIJEM' = Credit
    - 'VYDAJ' = Withdrawal
    - 'POJISTNE' = Insurance payment (Fixed)
    - 'SIPO' = Household (Fixed)
    - 'LEASING' = Leasing (Fixed)
    - 'UVER' = Loan payment (Fixed)
    """
    
    # 1. Separate credits and debits
    debits = user_tx[user_tx['type'] == 'VYDAJ']
    credits = user_tx[user_tx['type'] == 'PRIJEM']
    
    total_spend = debits['amount'].sum()
    total_income = credits['amount'].sum()
    
    if total_spend == 0:
        return 50.0, 50.0, 50.0
        
    # Categorize debits
    fixed_symbols = ['POJISTNE', 'SIPO', 'LEASING', 'UVER']
    fixed_spend_df = debits[debits['k_symbol'].isin(fixed_symbols)]
    fixed_spend = fixed_spend_df['amount'].sum()
    
    # We treat non-fixed withdrawals as discretionary proxy for Berka
    discretionary_spend_df = debits[~debits['k_symbol'].isin(fixed_symbols)]
    discretionary_spend = discretionary_spend_df['amount'].sum()
    
    # Savings Proxy: In Berka, keeping balance high is savings
    avg_balance = user_tx['balance'].mean()
    savings_rate = (total_income - total_spend) / total_income if total_income > 0 else 0
    
    # --- 1. Spending Efficiency Score (0-100) ---
    # High fixed costs vs income reduces efficiency if discretionary is very high.
    # We will score based on how much is saved vs blown on discretionary.
    efficiency = 100 - ((discretionary_spend / total_spend) * 100)
    efficiency = max(0.0, min(100.0, efficiency))
    
    # --- 2. Proactive Resilience Score (0-100) ---
    # Capacity to absorb shocks -> relies on average balance and savings rate
    resilience = 50 + (savings_rate * 100)
    if avg_balance < 10000: # Below 10k CZK is low resilience
        resilience -= 20
    resilience = max(0.0, min(100.0, resilience))
    
    # --- 3. Financial EQ Score (0-100) ---
    # Emotional spending. For Berka, we don't have timestamps (hours), only dates.
    # We can proxy this by looking at variance in discretionary spend. Highly erratic spend = lower EQ.
    monthly_disc = discretionary_spend_df.groupby(discretionary_spend_df['date'].astype(str).str[:4])['amount'].sum()
    if len(monthly_disc) > 1 and monthly_disc.mean() > 0:
        cv = monthly_disc.std() / monthly_disc.mean()
        eq_score = 100 - (cv * 30) # High variance lowers EQ
    else:
        eq_score = 50.0
    
    eq_score = max(0.0, min(100.0, eq_score))
    
    return round(efficiency, 2), round(resilience, 2), round(eq_score, 2)

def extract_features(df):
    """
    Runs the feature engineering pipeline mapping raw time-series 
    transactions into the 3 core metrics per user.
    """
    features = []
    # Berka connects trans to account_id. We'll treat account_id as user_id.
    grouped = df.groupby('account_id')
    
    for account_id, user_tx in grouped:
        eff, res, eq = calculate_metrics(user_tx)
        
        features.append({
            'user_id': account_id,
            'spending_efficiency': eff,
            'proactive_resilience': res,
            'financial_eq': eq
        })
        
    return pd.DataFrame(features)

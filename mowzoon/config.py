"""
Mowzoon - Configuration and Definitions
"""

# Archetypes definition
ARCHETYPES = {
    0: {
        'name': 'The Impulse Liver',
        'description': 'High emotion-driven spending, high weekend spikes, low efficiency'
    },
    1: {
        'name': 'The Anxious Planner',
        'description': 'High savings rate, low discretionary spend, low quality of life/spending efficiency score'
    },
    2: {
        'name': 'The Blind Investor',
        'description': 'High investment allocation, critical lack of cash buffer, vulnerable to liquidity shocks'
    },
    3: {
        'name': 'The Survivalist',
        'description': 'Income tightly consumed by fixed costs, highly vulnerable to predictable periodic spikes'
    }
}

# General Hyperparameters
NUM_USERS = 1000
DAYS_OF_HISTORY = 365

# Transaction Categories
CATEGORIES = [
    'Fixed_Housing', 
    'Fixed_Utilities', 
    'Fixed_Insurance', 
    'Discretionary_Dining', 
    'Discretionary_Shopping', 
    'Discretionary_Entertainment',
    'Savings',
    'Investments'
]

# Seasonal Spikes
SEASONAL_SPIKES = [
    {'name': 'Eid', 'month': 4, 'day': 10},
    {'name': 'Back to School', 'month': 8, 'day': 25},
    {'name': 'Car Insurance Renewal', 'month': 11, 'day': 15}
]

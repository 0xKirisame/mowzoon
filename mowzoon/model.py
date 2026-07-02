"""
Mowzoon - Model Architecture (Berka Dataset)
"""

import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score
import pickle
import config

class MowzoonModel:
    def __init__(self):
        self.scaler = StandardScaler()
        self.kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        self.classifier = XGBClassifier(
            objective='multi:softprob',
            num_class=4,
            eval_metric='mlogloss',
            random_state=42
        )
        
        # Mapping from cluster IDs to Mowzoon Archetype IDs
        self.cluster_to_archetype = {}

    def bootstrap_labels(self, features_df):
        """
        Uses K-Means to discover 4 clusters in the Berka data, then maps 
        them to our 4 archetypes based on centroid heuristics.
        """
        X = features_df[['spending_efficiency', 'proactive_resilience', 'financial_eq']]
        
        # Scale for K-Means
        X_scaled = self.scaler.fit_transform(X)
        clusters = self.kmeans.fit_predict(X_scaled)
        
        features_df['cluster'] = clusters
        
        # Analyze centroids to map clusters to archetypes
        # Archetype 0 (Impulse Liver): Lowest EQ
        # Archetype 1 (Anxious Planner): Highest Resilience, High Efficiency
        # Archetype 2 (Blind Investor): (In Berka, high spend, low balance -> low resilience)
        # Archetype 3 (Survivalist): Low Efficiency, Low Resilience
        
        centroids = pd.DataFrame(
            self.scaler.inverse_transform(self.kmeans.cluster_centers_),
            columns=['spending_efficiency', 'proactive_resilience', 'financial_eq']
        )
        
        # Sort centroids to map them logically
        # 0: Impulse Liver (Lowest EQ)
        impulse_cluster = centroids['financial_eq'].idxmin()
        
        # 1: Anxious Planner (Highest Resilience among remaining)
        remaining = centroids.drop(impulse_cluster)
        anxious_cluster = remaining['proactive_resilience'].idxmax()
        
        # 2: Blind Investor (Lowest Resilience among remaining)
        remaining = remaining.drop(anxious_cluster)
        blind_cluster = remaining['proactive_resilience'].idxmin()
        
        # 3: Survivalist (The last remaining cluster)
        survivalist_cluster = remaining.drop(blind_cluster).index[0]
        
        self.cluster_to_archetype = {
            impulse_cluster: 0,
            anxious_cluster: 1,
            blind_cluster: 2,
            survivalist_cluster: 3
        }
        
        # Assign true labels based on this mapping
        features_df['true_archetype'] = features_df['cluster'].map(self.cluster_to_archetype)
        return features_df

    def prepare_data(self, features_df):
        df = self.bootstrap_labels(features_df)
        X = df[['spending_efficiency', 'proactive_resilience', 'financial_eq']]
        y = df['true_archetype']
        return train_test_split(X, y, test_size=0.2, random_state=42), df
        
    def train(self, X_train, y_train):
        print("Training XGBoost Classifier on Bootstrapped K-Means Labels...")
        # Since X is already scaled during K-Means but XGBoost doesn't strictly need scaling,
        # we still scale it for consistency
        X_train_scaled = self.scaler.transform(X_train)
        self.classifier.fit(X_train_scaled, y_train)
        print("Training complete.")
        
    def evaluate(self, X_test, y_test):
        X_test_scaled = self.scaler.transform(X_test)
        predictions = self.classifier.predict(X_test_scaled)
        acc = accuracy_score(y_test, predictions)
        report = classification_report(y_test, predictions)
        return acc, report
        
    def predict(self, user_features):
        """
        Predicts archetype for a single user given their 3 metrics.
        """
        X = user_features[['spending_efficiency', 'proactive_resilience', 'financial_eq']]
        X_scaled = self.scaler.transform(X)
        prediction = self.classifier.predict(X_scaled)[0]
        return int(prediction)

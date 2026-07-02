"""
Mowzoon - Data Ingestor (Berka Dataset)
"""

import os
import urllib.request
import pandas as pd

BASE_URL = "https://raw.githubusercontent.com/jlacko/berka-dataset/master/"
FILES = ["trans.asc", "account.asc", "client.asc"]
DATA_DIR = "data"

def download_files():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    for f in FILES:
        path = os.path.join(DATA_DIR, f)
        if not os.path.exists(path):
            print(f"Downloading {f} from {BASE_URL+f}...")
            urllib.request.urlretrieve(BASE_URL + f, path)
            print(f"{f} download complete.")

def load_data():
    download_files()
    trans_path = os.path.join(DATA_DIR, "trans.asc")
    # Low memory to handle 69MB effectively
    df = pd.read_csv(trans_path, sep=';', low_memory=False)
    return df

if __name__ == "__main__":
    df = load_data()
    print("Columns:", df.columns.tolist())
    print(df.head())

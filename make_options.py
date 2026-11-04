import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

CSV_PATH = Path("data/uae_real_estate_2024.csv")   # adapte si ton CSV est ailleurs
OUT_PATH = Path("models/options.json")

BINS = [0, 1_500_000, 2_600_000, 6_000_000, float("inf")]
LABELS = ["Économique", "Intermédiaire", "Haut de gamme", "Luxe"]

df = pd.read_csv(CSV_PATH)
df["price_class"] = pd.cut(df["price"], bins=BINS, labels=LABELS)

# Même split que l'entraînement : on compte les quartiers sur le train uniquement
train, _ = train_test_split(
    df, test_size=0.2, stratify=df["price_class"], random_state=42
)

counts = train["displayAddress"].str.split(",").str[-2].str.strip().value_counts()
communities = sorted(counts[counts >= 30].index.tolist())   # même seuil que le OneHotEncoder

OUT_PATH.parent.mkdir(exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump({"communities": communities}, f, ensure_ascii=False, indent=2)

print(len(communities), "quartiers écrits dans", OUT_PATH)
print(communities)
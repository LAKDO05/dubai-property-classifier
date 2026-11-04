import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

# Chargés une seule fois, au démarrage
model = joblib.load(MODELS_DIR / "model.joblib")
with open(MODELS_DIR / "options.json", encoding="utf-8") as f:
    COMMUNITIES = json.load(f)["communities"]

BEDROOMS = ["studio", "1", "2", "3", "4", "5", "6", "7+"]
BATHROOMS = ["1", "2", "3", "4", "5", "6", "7+"]

app = FastAPI(title="Dubai Property Price Class API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # OK en local ; à restreindre au déploiement
    allow_methods=["*"],
    allow_headers=["*"],
)


class Listing(BaseModel):
    community: str = Field(..., examples=["Business Bay"])
    bedrooms: str = Field(..., examples=["2"], description="'studio', '1', ..., '7+'")
    bathrooms: str = Field(..., examples=["2"])
    size_sqft: float = Field(..., gt=0, examples=[1323])
    furnished: bool = False
    verified: bool = False
    title: str = ""
    description: str = ""


class Prediction(BaseModel):
    predicted_class: str
    confidence: float
    probabilities: dict[str, float]


def to_model_input(item: Listing) -> pd.DataFrame:
    """Convertit l'entrée API vers les colonnes brutes attendues par le pipeline."""
    return pd.DataFrame([{
        "title": item.title,
        "displayAddress": f"{item.community.strip()}, Dubai",
        "bathrooms": item.bathrooms,
        "bedrooms": item.bedrooms,
        "addedOn": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "type": "Residential for Sale",
        "verified": item.verified,
        "priceDuration": "sell",
        "sizeMin": f"{item.size_sqft:g} sqft",
        "furnishing": "YES" if item.furnished else "NO",
        "description": item.description,
    }])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/options")
def options():
    return {"communities": COMMUNITIES, "bedrooms": BEDROOMS, "bathrooms": BATHROOMS}


@app.post("/predict", response_model=Prediction)
def predict(item: Listing):
    if item.community not in COMMUNITIES:
        raise HTTPException(status_code=422, detail="community inconnue, voir /options")
    if item.bedrooms not in BEDROOMS or item.bathrooms not in BATHROOMS:
        raise HTTPException(status_code=422, detail="bedrooms ou bathrooms invalide")

    X = to_model_input(item)
    proba = model.predict_proba(X)[0]
    probs = {str(c): round(float(p), 4) for c, p in zip(model.classes_, proba)}
    best = max(probs, key=probs.get)
    return Prediction(predicted_class=best, confidence=probs[best], probabilities=probs)
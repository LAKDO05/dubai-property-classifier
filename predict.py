import joblib
import pandas as pd

model = joblib.load("models/model.joblib")

example = pd.DataFrame([{
    "title": "Great ROI | High Floor | Canal View",
    "displayAddress": "Binghatti Canal, Business Bay, Dubai",
    "bathrooms": "2",
    "bedrooms": "2",
    "addedOn": "2024-08-14T12:02:53Z",
    "type": "Residential for Sale",
    "verified": True,
    "priceDuration": "sell",
    "sizeMin": "1323 sqft",
    "furnishing": "NO",
    "description": "Spacious apartment with canal view and private pool.",
}])

print("Classe prédite :", model.predict(example)[0])

proba = model.predict_proba(example)[0]
for classe, p in zip(model.classes_, proba):
    print(f"  {classe}: {p:.1%}")
# 🏙️ Dubai Property Price Classifier

Classifieur de **gamme de prix** pour des annonces immobilières à Dubaï (4 classes), avec une **API FastAPI conteneurisée (Docker)** et une **application mobile React Native (Expo)**.

À partir de caractéristiques d'un bien (quartier, chambres, salles de bain, surface, meublé, texte de l'annonce...), le modèle prédit s'il appartient à la gamme **Économique**, **Intermédiaire**, **Haut de gamme** ou **Luxe**, et renvoie les **probabilités** de chaque classe.


## Sommaire

- [Données et cible](#données-et-cible)
- [Approche](#approche)
- [Résultats](#résultats)
- [Architecture](#architecture)
- [Structure du dépôt](#structure-du-dépôt)
- [Lancer le projet](#lancer-le-projet)
- [API](#api)
- [Limites](#limites)
- [Pistes d'amélioration](#pistes-damélioration)

## Données et cible

- **Source** : annonces immobilières des Émirats (fichier `uae_real_estate_2024.csv`, 5 058 annonces de vente à Dubaï).
  <!-- TODO : ajouter le lien Kaggle du dataset -->
- Le fichier n'est **pas inclus** dans le dépôt (licence) : place-le dans `data/` si tu veux réentraîner.
- **Cible** : la variable `price` est découpée en 4 classes avec des seuils fixes.

| Classe | Prix (AED) |
|---|---|
| Économique | jusqu'à 1,5 M |
| Intermédiaire | 1,5 M à 2,6 M |
| Haut de gamme | 2,6 M à 6 M |
| Luxe | plus de 6 M |

- **Découpage** : 80 % entraînement / 20 % test (1 012 annonces), stratifié sur la classe, `random_state=42`.

## Approche

Tout le prétraitement est dans **un seul pipeline scikit-learn**, de la donnée brute jusqu'au modèle. Le même objet est utilisé à l'entraînement et par l'API.

Étapes de feature engineering (dans `src/features.py`) :

- **Adresse** : découpée en immeuble, quartier et ville, puis encodée en one-hot (catégories rares regroupées, `min_frequency=30`).
- **Chambres / salles de bain** : nettoyage (`studio` = 0, `7+` = 7), conversion numérique.
- **Surface** : extraite du texte (`"1,323 sqft"` → 1323).
- **Variables binaires** : meublé, annonce vérifiée.
- **Texte de l'annonce** : longueur, nombre de mots, présence de mots-clés (piscine, vue, salle de sport, parking, vocabulaire de luxe).
- **Valeurs manquantes** : imputation par la médiane, puis standardisation des variables numériques.

Modèles comparés avec la **même validation croisée stratifiée** et la même métrique (**macro-F1**, adaptée à des classes de tailles différentes) :

- HistGradientBoosting (classification directe)
- XGBoost en **régression sur log(prix)**, puis conversion en classe avec les mêmes seuils
- Random Forest

## Résultats

Validation croisée sur le jeu d'entraînement :

| Modèle | Approche | macro-F1 (CV) |
|---|---|---|
| Baseline (`DummyClassifier`) | classe la plus fréquente | _à compléter_ |
| Random Forest | classification | 0.76 |
| XGBoost | régression + seuils | 0.78 |
| **HistGradientBoosting** | classification | **0.78** |

> Les écarts entre les trois modèles sont faibles (2 à 3 points). Ils sont du même ordre que la variabilité entre les folds, donc ils ne permettent pas de conclure à une vraie différence. HistGradientBoosting est retenu pour sa simplicité et ses bons scores.

L'ajustement des hyperparamètres (recherche aléatoire) n'a pas apporté de gain net : la limite vient surtout des variables disponibles plus que du réglage du modèle.

**Évaluation finale sur le jeu de test** (utilisé une seule fois, sur le modèle retenu) :

| Classe | Précision | Rappel | F1 | Support |
|---|---|---|---|---|
| Économique | 0.91 | 0.89 | 0.90 | 346 |
| Intermédiaire | 0.69 | 0.69 | 0.69 | 211 |
| Haut de gamme | 0.76 | 0.76 | 0.76 | 273 |
| Luxe | 0.82 | 0.85 | 0.83 | 182 |
| **macro-F1** | | | **0.80** | 1 012 |

- **Accuracy : 0.81**
- Les erreurs se produisent presque toutes entre **classes voisines** (Économique ↔ Intermédiaire, Haut de gamme ↔ Luxe) : le modèle respecte l'ordre des prix.
- La classe **Intermédiaire** est la plus difficile, car elle est située entre deux seuils : une annonce à 2,55 M et une autre à 2,65 M sont très proches mais tombent dans deux classes différentes.

<!-- TODO : ajouter les chiffres de ton analyse d'erreurs
- Part d'annonces classées dans la bonne gamme : 81 %
- Part d'annonces à une gamme près : XX %
- Erreurs à deux gammes ou plus d'écart : N sur 1 012
-->

## Architecture

```
┌────────────────────┐   HTTP/JSON   ┌───────────────────────┐   ┌────────────────────────┐
│  App Expo (mobile) │ ────────────▶ │  API FastAPI (Docker) │──▶│  Pipeline scikit-learn │
│  formulaire +      │ ◀──────────── │  validation Pydantic  │   │  (model.joblib)        │
│  résultat coloré   │  classe +     │  /options  /predict   │   │                        │
└────────────────────┘  probabilités └───────────────────────┘   └────────────────────────┘
```

- L'application ne contient aucune logique de prédiction : elle collecte les champs, les envoie, puis affiche la classe et les probabilités.
- Les listes déroulantes (quartiers, chambres, salles de bain) viennent de l'endpoint `/options`. Les quartiers proposés sont ceux que le modèle connaît (au moins 30 annonces dans le jeu d'entraînement).
- Le front sépare l'écran (`src/app/index.tsx`) du service réseau (`src/services/api.ts`).

## Structure du dépôt

```
.
├── api/                  # API FastAPI (main.py)
├── src/                  # Fonctions de prétraitement et pipeline (features.py)
├── models/               # model.joblib et options.json
├── notebooks/            # Exploration, comparaison des modèles, évaluation
├── frontend/             # Application Expo / React Native
├── make_options.py       # Génère models/options.json (liste des quartiers)
├── predict.py            # Test rapide du modèle sauvegardé
├── Dockerfile
├── requirements.txt
└── README.md
```

Les fonctions de prétraitement sont dans un module Python (`src/features.py`) et non dans le notebook : c'est nécessaire pour pouvoir recharger le modèle sauvegardé ailleurs (API, conteneur).

## Lancer le projet

### Prérequis

- Docker (pour l'API) ou Python 3.12
- Node.js 18+ et l'application **Expo Go** sur ton téléphone (pour le front)

### 1. API avec Docker

```bash
docker build -t dubai-api .
docker run -d -p 8000:8000 --name dubai dubai-api
```

Documentation interactive : <http://localhost:8000/docs>

### 1 bis. API sans Docker

```bash
pip install -r requirements.txt
uvicorn api.main:app --reload --reload-dir api --reload-dir src --host 0.0.0.0 --port 8000
```

### 2. Application mobile

```bash
cd frontend
npm install
cp .env.example .env     # puis remplace l'IP par celle de la machine qui héberge l'API
npx expo start
```

Contenu de `frontend/.env` :

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000
```

Scanne ensuite le QR code avec Expo Go. Le téléphone et la machine qui héberge l'API doivent être sur le **même réseau local**. Sur le téléphone, `localhost` désigne le téléphone lui-même : il faut donc utiliser l'adresse IP de la machine. Après toute modification de `.env`, relance avec `npx expo start -c`.

> Si tu lances l'API sans Docker, garde bien `--host 0.0.0.0` : par défaut, l'API n'écoute que sur la machine locale et le téléphone ne peut pas la joindre.

### 3. Réentraîner le modèle

L'entraînement se fait dans les notebooks de `notebooks/` (Python 3.12.7, scikit-learn 1.5.1).

1. Place `uae_real_estate_2024.csv` dans `data/`.
2. Exécute le notebook en entier (Restart & Run All).
3. Sauvegarde le pipeline : `joblib.dump(model, "models/model.joblib")`.
4. Régénère la liste des quartiers : `python make_options.py`.

Utilise la **même version de scikit-learn** que celle du `requirements.txt` : un modèle sauvegardé avec une autre version peut mal se charger.

## API

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/health` | Vérifie que l'API répond |
| `GET` | `/options` | Quartiers, nombres de chambres et de salles de bain acceptés |
| `POST` | `/predict` | Prédit la gamme de prix et les probabilités |

Exemple :

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"community": "Business Bay", "bedrooms": "2", "bathrooms": "2", "size_sqft": 1323}'
```

Réponse :

```json
{
  "predicted_class": "Haut de gamme",
  "confidence": 0.529,
  "probabilities": {
    "Haut de gamme": 0.529,
    "Intermédiaire": 0.417,
    "Luxe": 0.002,
    "Économique": 0.051
  }
}
```

Champs obligatoires : `community`, `bedrooms`, `bathrooms`, `size_sqft`. Facultatifs : `furnished`, `verified`, `title`, `description`. Les entrées invalides (surface négative, quartier inconnu) renvoient une erreur 422 avec un message explicite.

## Limites

- **Données de 2024** : les prix du marché ont évolué depuis. Ce sont aussi des **prix demandés dans des annonces**, pas des prix de vente réels.
- **Entrée incomplète** : le modèle a été entraîné avec des titres et des descriptions d'annonces. Quand ces champs sont laissés vides (ou la date d'annonce, fixée par l'API), les variables correspondantes prennent des valeurs rarement vues à l'entraînement, ce qui peut dégrader la prédiction.
- **Classes définies par des seuils arbitraires** : une partie des erreurs vient de la définition de la cible, pas du modèle.
- **Classe « Intermédiaire »** : la moins bien prédite (F1 ≈ 0.69).
- **Couverture géographique** : seuls les quartiers bien représentés dans les données (au moins 30 annonces) sont proposés. L'information d'immeuble n'est pas exploitée par l'application.
- **Jeu de test** : utilisé une seule fois pour l'évaluation du modèle final.
- Le projet n'est **pas déployé** : l'API et l'application tournent en local ou dans un conteneur Docker.

## Pistes d'amélioration

- Entraîner un modèle sur **uniquement** les champs que l'utilisateur peut renseigner, pour supprimer l'écart entre entraînement et service.
- Prédire directement le **prix** (régression) avec un intervalle de confiance, en plus de la gamme.
- Ajouter une baseline et des tests automatisés (`pytest`) avec une intégration continue (GitHub Actions).
- Surveiller la dérive des données et réentraîner régulièrement avec des annonces récentes.
- Déployer l'API sur un hébergeur et publier la version web de l'application.

## Stack

Python 3.12 · pandas · scikit-learn (HistGradientBoosting) · XGBoost · FastAPI · Pydantic · Docker · React Native · Expo (expo-router) · TypeScript
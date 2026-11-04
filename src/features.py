import pandas as pd
from sklearn.pipeline import make_pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

CATEGORIES = ["building", "community", "city"]
NUMERICS = ["bathrooms", "bedrooms", "addedOn", "sizeMin"]


def split_address(X):
    X = X.copy()
    parts = X["displayAddress"].str.split(",")
    X["building"] = parts.str[0].str.strip().str.lower()
    X["community"] = parts.str[-2].str.strip().str.lower()
    X["city"] = parts.str[-1].str.strip().str.lower()
    return X.drop("displayAddress", axis=1)


def clean_rooms(X):
    X = X.copy()
    for col in ["bedrooms", "bathrooms"]:
        s = X[col].astype(str).str.lower().str.strip()
        s = s.replace({"studio": "0"})
        s = s.str.replace("+", "", regex=False)
        X[col] = pd.to_numeric(s, errors="coerce")
    return X


def extract_year_size_min(X):
    X = X.copy()
    X["addedOn"] = pd.to_datetime(X["addedOn"], errors="coerce").dt.year
    X["sizeMin"] = pd.to_numeric(
        X["sizeMin"].astype(str).str.replace(",", "").str.split(" ").str[0],
        errors="coerce",
    )
    return X.drop("title", axis=1)


def binary_value(X):
    X = X.copy()
    X["verified"] = X["verified"].fillna(False).astype(bool).astype(int)
    X["furnishing"] = (
        X["furnishing"].astype(str).str.strip().str.upper()
        .map({"YES": 1, "NO": 0})
        .fillna(0)
        .astype(int)
    )
    return X


def description_features(X):
    X = X.copy()
    d = X["description"].fillna("").str.lower()
    X["desc_len"] = d.str.len()
    X["desc_words"] = d.str.split().str.len()
    X["desc_has_pool"] = d.str.contains("pool").astype(int)
    X["desc_has_view"] = d.str.contains("view").astype(int)
    X["desc_has_gym"] = d.str.contains("gym|fitness").astype(int)
    X["desc_has_parking"] = d.str.contains("parking").astype(int)
    X["desc_luxury_words"] = d.str.count("luxury|exclusive|premium|prime|branded")
    return X.drop(columns=["description"])


def type_price_duration_en_0_1(X):
    X = X.copy()
    X["is_for_sale"] = (X["type"] == "Residential for Sale").astype(int)
    X["priceDuration"] = (X["priceDuration"] == "sell").astype(int)
    return X.drop(columns=["type"])


def build_preprocessing():
    num_pipe = make_pipeline(SimpleImputer(strategy="median"), StandardScaler())
    return make_pipeline(
        FunctionTransformer(split_address),
        FunctionTransformer(clean_rooms),
        FunctionTransformer(extract_year_size_min),
        FunctionTransformer(binary_value),
        FunctionTransformer(description_features),
        FunctionTransformer(type_price_duration_en_0_1),
        ColumnTransformer(
            [
                ("cat", OneHotEncoder(handle_unknown="infrequent_if_exist",
                                      min_frequency=30, sparse_output=False), CATEGORIES),
                ("num", num_pipe, NUMERICS),
            ],
            remainder="passthrough",
        ),
    )
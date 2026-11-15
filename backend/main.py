import io
import os
import re
import tempfile
from pathlib import Path

import joblib
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

supabase = create_client(supabase_url, supabase_key)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionRequest(BaseModel):
    features: list[float]


def validate_canteen_id(canteen_id: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", canteen_id):
        raise HTTPException(
            status_code=400,
            detail="canteen_id may contain only letters, numbers, underscores, and hyphens",
        )


@app.post("/train/{canteen_id}")
def train_model(canteen_id: str, file: UploadFile = File(...)):
    validate_canteen_id(canteen_id)

    try:
        dataset = pd.read_csv(file.file)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as error:
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid CSV") from error
    finally:
        file.file.close()

    if dataset.shape[1] < 2:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain at least one feature column and one target column",
        )
    if dataset.empty:
        raise HTTPException(status_code=400, detail="CSV must contain training rows")

    features = dataset.iloc[:, :-1]
    target = dataset.iloc[:, -1]
    model = LinearRegression()
    try:
        model.fit(features, target)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail="CSV feature and target columns must contain valid numeric values",
        ) from error

    model.training_columns_ = dataset.columns.tolist()
    model.feature_columns_ = features.columns.tolist()
    model.target_column_ = target.name

    model_path = f"{canteen_id}.joblib"
    with tempfile.TemporaryDirectory() as temporary_directory:
        local_model_path = Path(temporary_directory) / model_path
        joblib.dump(model, local_model_path)
        with local_model_path.open("rb") as model_file:
            supabase.storage.from_("models").upload(
                model_path,
                model_file,
                file_options={
                    "upsert": "true",
                    "content-type": "application/octet-stream",
                },
            )

    supabase.table("canteen_models").upsert(
        {"canteen_id": canteen_id, "model_path": model_path}
    ).execute()

    return {"message": "Model trained and uploaded successfully", "model_path": model_path}


@app.get("/models/{canteen_id}")
def get_model_status(canteen_id: str):
    validate_canteen_id(canteen_id)
    model_rows = (
        supabase.table("canteen_models")
        .select("model_path")
        .eq("canteen_id", canteen_id)
        .limit(1)
        .execute()
        .data
    )
    if not model_rows:
        return {
            "ready": False,
            "columns": [],
            "feature_columns": [],
            "target_column": None,
        }

    model_path = model_rows[0].get("model_path")
    if not model_path:
        raise HTTPException(status_code=500, detail="Saved model metadata is missing its model path")

    model_bytes = supabase.storage.from_("models").download(model_path)
    model = joblib.load(io.BytesIO(model_bytes))
    feature_columns = list(
        getattr(model, "feature_columns_", getattr(model, "feature_names_in_", []))
    )
    columns = list(getattr(model, "training_columns_", feature_columns))

    return {
        "ready": True,
        "columns": columns,
        "feature_columns": feature_columns,
        "target_column": getattr(model, "target_column_", None),
    }


@app.post("/predict/{canteen_id}")
def predict(canteen_id: str, request: PredictionRequest):
    validate_canteen_id(canteen_id)
    model_path = f"{canteen_id}.joblib"
    model_bytes = supabase.storage.from_("models").download(model_path)
    model = joblib.load(io.BytesIO(model_bytes))

    if len(request.features) != model.n_features_in_:
        raise HTTPException(
            status_code=422,
            detail=f"Expected {model.n_features_in_} features, received {len(request.features)}",
        )

    prediction_features = [request.features]
    if hasattr(model, "feature_names_in_"):
        prediction_features = pd.DataFrame(
            [request.features], columns=model.feature_names_in_
        )

    prediction = model.predict(prediction_features)
    return {"predicted_quantity": float(prediction[0])}

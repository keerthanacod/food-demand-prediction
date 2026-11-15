# Platewise – Food Demand & Wastage Prediction

A React + Vite frontend prototype for a multi-canteen food demand and wastage prediction platform.

## Current frontend flow

1. Landing page
2. Animated `Get started` loading button (0–100%)
3. Login / Create account choice
4. Login or canteen registration form
5. Empty canteen administrator dashboard

## Dashboard sections

- Overview
- Food items
- Historical data upload and preview (CSV / XLSX / XLS)
- Predict demand (checks for a saved model and uses its feature columns for predictions)
- Actual records
- Reports and analytics
- Settings

## Run locally

Use Node.js (recommended: current LTS) and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173/`.

## Run the FastAPI model API

The backend is in `backend/`. Set `SUPABASE_URL` and `SUPABASE_KEY` in
`backend/.env`, and create a Supabase Storage bucket named `models`.

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

The API provides `POST /train/{canteen_id}` for CSV model training,
`GET /models/{canteen_id}` for model readiness and saved columns, and
`POST /predict/{canteen_id}` for predictions. Training uses the final CSV
column as the target and stores the trained model and its column metadata.
The React prediction page checks `test_canteen_1` when opened and unlocks its
prediction form when a saved model is available.

## Important prototype notes

- The application starts with **no preloaded food items, canteen profile, records, chart values, or prediction results**.
- Login and registration are frontend previews only. They do not create accounts, authenticate users, or store passwords.
- Menu items and actual records entered in the dashboard remain in React memory for the current browser session only. Refreshing or signing out clears them.
- Uploading a CSV or Excel file reads it for a temporary preview only. It is not imported into a database.
- Demand prediction requires the FastAPI backend and a trained model in Supabase. No mock prediction is generated.
- The API trains a Linear Regression model; it does not provide authentication or MySQL integration.

## Technologies

- React 18
- Vite 6
- CSS
- Recharts
- PapaParse
- SheetJS (`xlsx`)
- Lucide React

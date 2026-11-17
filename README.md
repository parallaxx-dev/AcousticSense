# AcousticSense

Unsupervised acoustic anomaly detection (MIMII fan) with a 2D convolutional autoencoder.
**React + Vite** frontend, **FastAPI** backend, **TensorFlow/Keras** model.

```
backend/   FastAPI app (app/), train.py, artifacts/ (model, norm, eval), tests/
frontend/  React + TypeScript UI
```

## Run
```bash
# 1. train once (healthy clips only) -> backend/artifacts/   (~3 min on GPU)
PYTHONPATH=backend .venv/bin/python backend/train.py --data fan/id_02

# 2. API  (http://127.0.0.1:8000/docs)
cd backend && ../.venv/bin/uvicorn app.main:app --port 8000

# 3. UI   (http://localhost:5173, proxies /api -> :8000)
cd frontend && npm install && npm run dev
```
Tests: `PYTHONPATH=backend .venv/bin/python -m pytest backend/tests`

## API
| Route | Purpose |
|---|---|
| `POST /api/analyze` | upload `.wav` -> score, verdict, waveform, Log-Mel, per-window input/reconstruction/error maps, latent, band errors |
| `GET /api/model` | ROC, score histograms, confusion matrix, loss curves, config |
| `GET /api/samples`, `POST /api/analyze/sample/{id}` | held-out test clips for one-click demos |
| `GET /api/health` | liveness + model status |

## UI
Verdict gauge with live sensitivity slider · playable waveform with window bands · full-clip Log-Mel ·
per-window score timeline vs. healthy score distributions · window inspector (input / reconstruction / |error|
heatmaps, per-band error vs. healthy baseline, latent code) · model-performance tab (AUC, pAUC, F1, ROC,
confusion matrix, loss) · session history · JSON report export.

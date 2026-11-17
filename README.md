# AcousticSense

Unsupervised acoustic anomaly detection (MIMII fan) with a 2D convolutional autoencoder.
**React + Vite** frontend, **FastAPI** backend, **TensorFlow/Keras** model.

```
backend/   FastAPI app (app/), train.py, artifacts/ (model, norm, eval), tests/
frontend/  React + TypeScript UI
```

## Models
Sixteen convolutional autoencoders, one per MIMII machine and unit (fan, pump, slider, valve x id 00/02/04/06),
trained on Kaggle on healthy 6 dB audio only. The UI lets you pick any of them, and a local fan id_02 model
trained by `backend/train.py` is available as an extra. Weights are not committed (16 MB each).

## Run
```bash
# 1. models: unzip the Kaggle export, then build the registry from the notebooks' CSV exports
unzip dense_models.zip -d backend/artifacts/cae          # <machine>_<id>/model.keras + norm.npz
.venv/bin/python backend/scripts/build_registry.py --exports .   # needs export_cae/, export_dense/, export_sup/

# optional: train the local fan id_02 model -> backend/artifacts/   (~3 min on GPU)
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
| `POST /api/analyze?model=ID` | upload `.wav` -> score, verdict, waveform, Log-Mel, per-window input/reconstruction/error maps, latent, band errors |
| `GET /api/models`, `GET /api/models/{id}` | model list with headline AUC; ROC, score histograms, confusion matrix, loss curves, config for one model |
| `GET /api/samples?model=ID`, `POST /api/analyze/sample/{id}?model=ID` | held-out local fan clips for one-click demos |
| `GET /api/health` | liveness + model status |

## UI
Verdict gauge with live sensitivity slider · playable waveform with window bands · full-clip Log-Mel ·
per-window score timeline vs. healthy score distributions · window inspector (input / reconstruction / |error|
heatmaps, per-band error vs. healthy baseline, latent code) · model-performance tab (AUC, pAUC, F1, ROC,
confusion matrix, loss) · session history · JSON report export.

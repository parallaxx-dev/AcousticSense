"""FastAPI service: upload a WAV, get anomaly score + all intermediate visualisation data."""
from __future__ import annotations

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from . import audio, config as C
from .detector import ArtifactsMissing
from .registry import Registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.registry = Registry()
        app.state.load_error = None
    except ArtifactsMissing as e:
        app.state.registry, app.state.load_error = None, str(e)
    yield


app = FastAPI(title="AcousticSense API", version="1.0.0",
              description="Unsupervised acoustic anomaly detection with a 2D convolutional autoencoder.",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware,
                   allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
                   allow_methods=["*"], allow_headers=["*"])


def reg() -> Registry:
    r = app.state.registry
    if r is None:
        raise HTTPException(503, app.state.load_error)
    return r


def detector(model_id: str | None):
    try:
        return reg().detector(model_id)
    except KeyError:
        raise HTTPException(404, f"Unknown model '{model_id}'.") from None


def _analyze_path(path: Path, name: str, model_id: str | None) -> dict:
    det = detector(model_id)                                  # fail fast on an unknown model
    try:
        y = audio.load_audio(path)
    except Exception as e:                                   # undecodable / not a real wav
        raise HTTPException(400, f"Could not decode audio: {e}") from e
    if len(y) / C.SR < C.MIN_DURATION_S:
        raise HTTPException(400, f"Clip is too short (< {C.MIN_DURATION_S}s).")
    if len(y) / C.SR > C.MAX_DURATION_S:
        raise HTTPException(413, f"Clip is longer than {C.MAX_DURATION_S:.0f}s.")
    return det.analyze(y, name)


@app.get("/api/health")
def health():
    r = app.state.registry
    return {"status": "ok" if r else "model_missing", "detail": app.state.load_error,
            "models": len(r.entries) if r else 0, "default_model": r.default_id if r else None}


@app.get("/api/models")
def models():
    """All available models with headline metrics."""
    return {"default": reg().default_id, "models": reg().summaries()}


@app.get("/api/models/{model_id}")
def model_info(model_id: str):
    """Evaluation for one model: ROC, score distributions, confusion matrix, loss curves."""
    try:
        return reg().entry(model_id)
    except KeyError:
        raise HTTPException(404, f"Unknown model '{model_id}'.") from None


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...), model: str | None = None):
    if not (file.filename or "").lower().endswith((".wav", ".wave")):
        raise HTTPException(400, "Only .wav files are supported.")
    detector(model)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        size = 0
        while chunk := await file.read(1 << 20):
            size += len(chunk)
            if size > C.MAX_UPLOAD_BYTES:
                tmp.close(); Path(tmp.name).unlink(missing_ok=True)
                raise HTTPException(413, f"File exceeds {C.MAX_UPLOAD_BYTES // 2**20} MB limit.")
            tmp.write(chunk)
    try:
        return await run_in_threadpool(_analyze_path, Path(tmp.name), file.filename, model)
    finally:
        Path(tmp.name).unlink(missing_ok=True)


@app.get("/api/samples")
def samples(model: str | None = None):
    """Held-out test clips (never seen in training) for the selected machine, for one-click demos."""
    try:
        return [{k: s[k] for k in ("id", "label", "name", "machine", "unit")} for s in reg().samples_for(model)]
    except KeyError:
        raise HTTPException(404, f"Unknown model '{model}'.") from None


def _sample(i: int) -> dict:
    for s in reg().samples:
        if s["id"] == i:
            return s
    raise HTTPException(404, "Unknown sample.")


@app.post("/api/analyze/sample/{sample_id}")
def analyze_sample(sample_id: int, model: str | None = None):
    s = _sample(sample_id)
    return _analyze_path(s["path"], f"{s['machine']}_{s['unit']}/{s['label']}/{s['name']}", model)


@app.get("/api/samples/{sample_id}/audio")
def sample_audio(sample_id: int):
    return FileResponse(_sample(sample_id)["path"], media_type="audio/wav")

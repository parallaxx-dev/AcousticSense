"""FastAPI service: upload a WAV, get anomaly score + all intermediate visualisation data."""
from __future__ import annotations

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import audio, config as C
from .detector import ArtifactsMissing, Detector


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.detector = Detector()
        app.state.load_error = None
    except ArtifactsMissing as e:
        app.state.detector, app.state.load_error = None, str(e)
    yield


app = FastAPI(title="AcousticSense API", version="1.0.0",
              description="Unsupervised acoustic anomaly detection with a 2D convolutional autoencoder.",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware,
                   allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
                   allow_methods=["*"], allow_headers=["*"])


def det() -> Detector:
    d = app.state.detector
    if d is None:
        raise HTTPException(503, app.state.load_error)
    return d


def _analyze_path(path: Path, name: str) -> dict:
    try:
        y = audio.load_audio(path)
    except Exception as e:                                   # undecodable / not a real wav
        raise HTTPException(400, f"Could not decode audio: {e}") from e
    if len(y) / C.SR < C.MIN_DURATION_S:
        raise HTTPException(400, f"Clip is too short (< {C.MIN_DURATION_S}s).")
    if len(y) / C.SR > C.MAX_DURATION_S:
        raise HTTPException(413, f"Clip is longer than {C.MAX_DURATION_S:.0f}s.")
    return det().analyze(y, name)


@app.get("/api/health")
def health():
    d = app.state.detector
    return {"status": "ok" if d else "model_missing", "detail": app.state.load_error,
            "threshold": d.threshold if d else None, "machine": d.eval["machine"] if d else None}


@app.get("/api/model")
def model_info():
    """Training-time evaluation: ROC, score distributions, confusion matrix, loss curves."""
    return det().model_info()


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".wav", ".wave")):
        raise HTTPException(400, "Only .wav files are supported.")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        size = 0
        while chunk := await file.read(1 << 20):
            size += len(chunk)
            if size > C.MAX_UPLOAD_BYTES:
                tmp.close(); Path(tmp.name).unlink(missing_ok=True)
                raise HTTPException(413, f"File exceeds {C.MAX_UPLOAD_BYTES // 2**20} MB limit.")
            tmp.write(chunk)
    try:
        return _analyze_path(Path(tmp.name), file.filename)
    finally:
        Path(tmp.name).unlink(missing_ok=True)


@app.get("/api/samples")
def samples():
    """Held-out test clips (never seen in training) for one-click demos."""
    return [{k: s[k] for k in ("id", "label", "name", "group")} for s in det().samples]


def _sample(i: int) -> dict:
    for s in det().samples:
        if s["id"] == i:
            return s
    raise HTTPException(404, "Unknown sample.")


@app.post("/api/analyze/sample/{sample_id}")
def analyze_sample(sample_id: int):
    s = _sample(sample_id)
    return _analyze_path(s["path"], f"{s['group']}/{s['label']}/{s['name']}")


@app.get("/api/samples/{sample_id}/audio")
def sample_audio(sample_id: int):
    return FileResponse(_sample(sample_id)["path"], media_type="audio/wav")

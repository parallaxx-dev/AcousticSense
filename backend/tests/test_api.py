"""API smoke tests - require trained artifacts (python backend/train.py)."""
import io
import numpy as np
import soundfile as sf
import pytest
from fastapi.testclient import TestClient

from app.main import app

with TestClient(app) as _probe:
    MISSING = _probe.get("/api/health").json()["status"] != "ok"
pytestmark = pytest.mark.skipif(MISSING, reason="no trained artifacts")


def wav_bytes(seconds=4.0, sr=16000, freq=120.0, noise=0.02):
    t = np.arange(int(seconds * sr)) / sr
    y = 0.3 * np.sin(2 * np.pi * freq * t) + noise * np.random.default_rng(0).standard_normal(t.size)
    buf = io.BytesIO()
    sf.write(buf, y.astype(np.float32), sr, format="WAV")
    return buf.getvalue()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_analyze_contract(client):
    r = client.post("/api/analyze", files={"file": ("tone.wav", wav_bytes(), "audio/wav")})
    assert r.status_code == 200, r.text
    d = r.json()
    n = d["metadata"]["n_windows"]
    assert n == len(d["windows"]) >= 1
    assert d["verdict"]["score"] == pytest.approx(np.mean([w["score"] for w in d["windows"]]), rel=1e-6)
    assert len(d["windows"][0]["input"]) > 0 and len(d["band_error_mean"]) == 128
    assert d["full_mel"]["n_mels"] == 128


def test_short_clip_is_padded(client):
    r = client.post("/api/analyze", files={"file": ("s.wav", wav_bytes(1.0), "audio/wav")})
    assert r.status_code == 200 and r.json()["metadata"]["n_windows"] == 1 and r.json()["warnings"]


def test_rejects_non_wav_and_garbage(client):
    assert client.post("/api/analyze", files={"file": ("a.mp3", b"x", "audio/mpeg")}).status_code == 400
    assert client.post("/api/analyze", files={"file": ("a.wav", b"not audio", "audio/wav")}).status_code == 400


def test_model_info_and_samples(client):
    m = client.get("/api/model").json()
    assert 0 <= m["metrics"]["auc"] <= 1 and m["threshold"] > 0
    s = client.get("/api/samples").json()
    if s:
        assert client.post(f"/api/analyze/sample/{s[0]['id']}").status_code == 200
        assert client.get(f"/api/samples/{s[0]['id']}/audio").headers["content-type"] == "audio/wav"
    assert client.post("/api/analyze/sample/9999").status_code == 404

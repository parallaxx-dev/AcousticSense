"""API smoke tests - require model artifacts (see README)."""
import io
import numpy as np
import soundfile as sf
import pytest
from fastapi.testclient import TestClient

from app.main import app

with TestClient(app) as _probe:
    MISSING = _probe.get("/api/health").json()["status"] != "ok"
pytestmark = pytest.mark.skipif(MISSING, reason="no model artifacts")


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


def test_model_listing(client):
    d = client.get("/api/models").json()
    ids = [m["id"] for m in d["models"]]
    assert d["default"] in ids and len(ids) >= 1
    info = client.get(f"/api/models/{d['default']}").json()
    assert 0 <= info["metrics"]["auc"] <= 1 and info["threshold"] > 0 and len(info["scores"]["val"]) > 10
    assert client.get("/api/models/nope").status_code == 404


def test_analyze_contract_for_every_model_family(client):
    d = client.get("/api/models").json()
    for mid in {d["default"], d["models"][-1]["id"]}:       # default + last entry (a different model)
        r = client.post(f"/api/analyze?model={mid}", files={"file": ("tone.wav", wav_bytes(), "audio/wav")})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["model"]["id"] == mid
        assert j["verdict"]["score"] == pytest.approx(np.mean([w["score"] for w in j["windows"]]), rel=1e-6)
        assert j["verdict"]["threshold"] == client.get(f"/api/models/{mid}").json()["threshold"]
        assert len(j["band_error_mean"]) == 128 and j["full_mel"]["n_mels"] == 128


def test_short_clip_is_padded(client):
    r = client.post("/api/analyze", files={"file": ("s.wav", wav_bytes(1.0), "audio/wav")})
    assert r.status_code == 200 and r.json()["metadata"]["n_windows"] == 1 and r.json()["warnings"]


def test_rejects_bad_input(client):
    assert client.post("/api/analyze", files={"file": ("a.mp3", b"x", "audio/mpeg")}).status_code == 400
    assert client.post("/api/analyze", files={"file": ("a.wav", b"not audio", "audio/wav")}).status_code == 400
    assert client.post("/api/analyze?model=nope", files={"file": ("a.wav", wav_bytes(), "audio/wav")}).status_code == 404


def test_samples_follow_the_selected_machine(client):
    d = client.get("/api/models").json()
    s = client.get(f"/api/samples?model={d['default']}").json()
    assert s and {x["machine"] for x in s} == {"fan"} and {x["unit"] for x in s} == {"id_02"}
    assert client.post(f"/api/analyze/sample/{s[0]['id']}?model={d['default']}").status_code == 200
    assert client.get(f"/api/samples/{s[0]['id']}/audio").headers["content-type"] == "audio/wav"
    other = next((m["id"] for m in d["models"] if m["machine"] == "pump" and m["unit"] == "id_04"), None)
    if other:                                               # downloaded clips exist for every machine unit
        ps = client.get(f"/api/samples?model={other}").json()
        if ps:
            assert {x["machine"] for x in ps} == {"pump"} and {x["unit"] for x in ps} == {"id_04"}
            assert {x["label"] for x in ps} == {"normal", "abnormal"}
            r = client.post(f"/api/analyze/sample/{ps[0]['id']}?model={other}").json()
            assert r["model"]["id"] == other and r["verdict"]["threshold"] > 0
    assert client.post("/api/analyze/sample/9999").status_code == 404

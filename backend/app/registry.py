"""Model registry: the 16 per-machine Kaggle CAEs plus the locally trained fan model.

Weights are loaded lazily (16 MB each) and only a few stay in memory.
"""
from __future__ import annotations

import json
import threading
from collections import OrderedDict
from pathlib import Path

from . import config as C
from .detector import ArtifactsMissing, Detector

CAE_DIR = C.ARTIFACTS_DIR / "cae"
LOCAL_DIR = C.ARTIFACTS_DIR / "local"
KAGGLE_CONFIG = dict(sr=C.SR, n_fft=C.N_FFT, hop=C.HOP, n_mels=C.N_MELS, window_samples=C.WINDOW_SAMPLES, overlap=C.OVERLAP,
                     T=C.T, latent_dim=C.LATENT_DIM, percentile=C.THRESHOLD_PERCENTILE, params=1315297)
DEFAULT_ID = "fan_id_02"
MAX_LOADED = 3


def _local_entry() -> tuple[dict, Path] | None:
    """The model produced by backend/train.py (fan id_02 on the local, un-noised-matched clips)."""
    d = LOCAL_DIR
    if not all((d / f).exists() for f in ("model.keras", "norm.json", "eval.json")):
        return None
    ev, norm = json.loads((d / "eval.json").read_text()), json.loads((d / "norm.json").read_text())
    e = {k: ev[k] for k in ("counts", "metrics", "threshold", "val_percentiles", "roc", "confusion", "scores", "history")}
    e.update(id="local_fan_id_02", machine=ev["machine"], unit=ev["machine_id"], source="local", snr=None,
             label=f"{ev['machine']} {ev['machine_id'].replace('_', ' ')} (local)", norm={"lo": norm["train_min"], "hi": norm["train_max"]},
             published_auc=None, compare={"dense_auc": None, "supervised_auc": None}, epochs=len(ev["history"]["loss"]), minutes=None,
             band_error=ev.get("band_error"), config=ev["config"], trained_at=ev["trained_at"])
    return e, d / "model.keras"


class Registry:
    def __init__(self):
        self.entries: OrderedDict[str, dict] = OrderedDict()
        self.paths: dict[str, Path] = {}
        self.samples: list[dict] = []
        self._cache: OrderedDict[str, Detector] = OrderedDict()
        self._lock = threading.Lock()

        reg = CAE_DIR / "registry.json"
        if reg.exists():
            for e in json.loads(reg.read_text())["models"]:
                p = CAE_DIR / e["id"] / "model.keras"
                if p.exists():
                    e.setdefault("band_error", None)
                    e.setdefault("config", KAGGLE_CONFIG)
                    e.setdefault("trained_at", None)
                    self.entries[e["id"]], self.paths[e["id"]] = e, p
        local = _local_entry()
        if local:
            self.entries[local[0]["id"]], self.paths[local[0]["id"]] = local
        if not self.entries:
            raise ArtifactsMissing(
                "No models found. Unzip the Kaggle models into models/cae and run "
                "backend/scripts/build_registry.py, or train one with backend/train.py.")
        self.default_id = DEFAULT_ID if DEFAULT_ID in self.entries else next(iter(self.entries))
        self.samples = self._load_samples()

    def _load_samples(self) -> list[dict]:
        out = []
        for name in (CAE_DIR / "samples.json", C.ARTIFACTS_DIR / "samples.json"):
            if not name.exists():
                continue
            for s in json.loads(name.read_text()):
                path = (C.PROJECT_DIR / s["path"]).resolve()
                if path.is_file():
                    out.append({"id": len(out), "label": s["label"], "name": path.name, "machine": s.get("machine", "fan"),
                                "unit": s.get("unit", path.parent.parent.name), "snr": s.get("snr"), "path": path})
            break
        return out

    # ------------------------------------------------------------------ access
    def summaries(self) -> list[dict]:
        return [{"id": e["id"], "label": e["label"], "machine": e["machine"], "unit": e["unit"], "source": e["source"],
                 "snr": e["snr"], "auc": e["metrics"]["auc"], "pauc": e["metrics"]["pauc"], "f1": e["metrics"]["f1"],
                 "published_auc": e["published_auc"], "dense_auc": e["compare"]["dense_auc"],
                 "supervised_auc": e["compare"]["supervised_auc"]} for e in self.entries.values()]

    def entry(self, model_id: str | None) -> dict:
        mid = model_id or self.default_id
        if mid not in self.entries:
            raise KeyError(mid)
        return self.entries[mid]

    def detector(self, model_id: str | None) -> Detector:
        mid = self.entry(model_id)["id"]
        with self._lock:
            if mid in self._cache:
                self._cache.move_to_end(mid)
                return self._cache[mid]
            det = Detector(self.paths[mid], self.entries[mid])
            self._cache[mid] = det
            while len(self._cache) > MAX_LOADED:
                self._cache.popitem(last=False)
            return det

    def samples_for(self, model_id: str | None) -> list[dict]:
        e = self.entry(model_id)
        return [s for s in self.samples if s["machine"] == e["machine"] and s["unit"] == e["unit"]]

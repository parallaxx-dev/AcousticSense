"""Inference: waveform -> windows -> Log-Mel -> CAE -> scores + visualisation payload."""
from __future__ import annotations

import base64
import json
import threading
from pathlib import Path

import numpy as np
import tensorflow as tf

from . import audio, config as C


def _b64_u8(a: np.ndarray, lo: float, hi: float) -> str:
    """Quantise a 2-D float array to uint8 (row-major) and base64 it."""
    q = np.clip((a - lo) / max(hi - lo, 1e-12), 0, 1) * 255
    return base64.b64encode(np.round(q).astype(np.uint8).tobytes()).decode("ascii")


def _round(a, n=5):
    return np.round(np.asarray(a, dtype=np.float64), n).tolist()


class ArtifactsMissing(RuntimeError):
    pass


class Detector:
    """One trained conv-autoencoder + its normalisation range, threshold and reference statistics."""

    def __init__(self, model_path: Path, entry: dict):
        self.entry = entry
        self.model = tf.keras.models.load_model(model_path, compile=False)     # safe_mode stays on
        self.encoder = tf.keras.Model(self.model.input, self.model.get_layer("bottleneck").output)
        self.train_min, self.train_max = entry["norm"]["lo"], entry["norm"]["hi"]
        self.threshold: float = entry["threshold"]
        self._val = np.sort(np.asarray(entry["scores"]["val"]))
        self._lock = threading.Lock()          # keras predict is not re-entrant-safe

    # ----------------------------------------------------------------- analysis
    def analyze(self, y: np.ndarray, filename: str) -> dict:
        duration = len(y) / C.SR
        wins, starts = audio.slice_windows(y)
        X_db = audio.window_log_mels(wins)                                   # (n,128,T) dB
        X = audio.normalize(X_db, self.train_min, self.train_max)            # (n,128,T,1)
        with self._lock:
            rec = self.model.predict(X, batch_size=32, verbose=0)
            lat = self.encoder.predict(X, batch_size=32, verbose=0)
        sq = np.square(X - rec)
        seg = sq.mean(axis=(1, 2, 3))                                         # per-window MSE
        band = sq.mean(axis=(2, 3))                                           # (n,128)
        err = np.abs(X - rec)[..., 0]                                         # (n,128,T)
        err_max = float(max(err.max(), 1e-6))
        score = float(seg.mean())                                             # clip = mean of windows

        full_db = audio.log_mel(y)                                            # whole clip, (128, F)
        lo, hi = float(full_db.min()), float(full_db.max())
        n_buckets = int(min(1600, max(200, len(y) // 100)))
        edges = np.linspace(0, len(y), n_buckets + 1).astype(int)
        wmin = np.array([y[a:b].min() if b > a else 0 for a, b in zip(edges[:-1], edges[1:])])
        wmax = np.array([y[a:b].max() if b > a else 0 for a, b in zip(edges[:-1], edges[1:])])

        rank = float(np.searchsorted(self._val, score, side="right") / len(self._val))
        ratio = score / self.threshold
        severity = ("healthy" if ratio < 0.8 else "borderline" if ratio < 1.0
                    else "anomalous" if ratio < 1.5 else "severe")

        windows = []
        for i, s in enumerate(starts):
            windows.append({
                "index": i, "start_s": round(s / C.SR, 3), "end_s": round((s + C.WINDOW_SAMPLES) / C.SR, 3),
                "score": float(seg[i]), "anomalous": bool(seg[i] > self.threshold),
                "input": _b64_u8(X[i, ..., 0], 0, 1),
                "reconstruction": _b64_u8(rec[i, ..., 0], 0, 1),
                "error": _b64_u8(err[i], 0, err_max),
                "latent": _round(lat[i], 4),
                "band_error": _round(band[i], 6),
            })
        peak = float(np.abs(y).max()) if len(y) else 0.0
        warnings = []
        if duration < C.WINDOW_SAMPLES / C.SR:
            warnings.append(f"Clip is shorter than one {C.WINDOW_SAMPLES / C.SR:.2f}s window - it was zero-padded.")
        if peak >= 0.999:
            warnings.append("Signal reaches full scale - possible clipping.")
        if peak < 1e-3:
            warnings.append("Signal is almost silent; the score may be unreliable.")

        return {
            "filename": filename,
            "model": {"id": self.entry["id"], "label": self.entry["label"]},
            "metadata": {
                "duration_s": round(duration, 3), "sample_rate": C.SR, "n_samples": int(len(y)),
                "peak": round(peak, 4), "rms": round(float(np.sqrt(np.mean(y ** 2))) if len(y) else 0.0, 5),
                "n_windows": len(windows), "window_s": C.WINDOW_SAMPLES / C.SR, "hop_s": C.STEP_SAMPLES / C.SR,
            },
            "verdict": {
                "score": score, "threshold": self.threshold, "is_anomaly": bool(score > self.threshold),
                "ratio": round(ratio, 4), "severity": severity, "healthy_percentile": round(rank * 100, 1),
                "max_window_score": float(seg.max()), "worst_window": int(seg.argmax()),
                "n_anomalous_windows": int((seg > self.threshold).sum()),
            },
            "warnings": warnings,
            "waveform": {"min": _round(wmin, 4), "max": _round(wmax, 4), "duration_s": round(duration, 3)},
            "full_mel": {"n_mels": int(full_db.shape[0]), "n_frames": int(full_db.shape[1]),
                         "hop_s": C.HOP / C.SR, "db_min": lo, "db_max": hi, "data": _b64_u8(full_db, lo, hi)},
            "windows": windows,
            "shape": {"n_mels": C.N_MELS, "T": C.T},
            "err_max": err_max,
            "band_error_mean": _round(band.mean(axis=0), 6),
            "norm": {"train_min": self.train_min, "train_max": self.train_max},
        }

    def model_info(self) -> dict:
        return self.entry

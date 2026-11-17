"""Audio loading and Log-Mel feature extraction (identical to the notebook)."""
from __future__ import annotations

import numpy as np
import librosa

from . import config as C


def load_audio(path, sr: int = C.SR) -> np.ndarray:
    """Load a WAV as the mono float32 signal the model sees (channel 0)."""
    y, _ = librosa.load(path, sr=sr, mono=False)
    y = np.atleast_2d(y)
    return np.ascontiguousarray(y[min(C.CHANNEL, y.shape[0] - 1)], dtype=np.float32)


def slice_windows(y: np.ndarray, win: int = C.WINDOW_SAMPLES, step: int = C.STEP_SAMPLES):
    """-> (windows (n, win), start_samples list). Short clips are zero-padded."""
    if len(y) < win:
        y = np.pad(y, (0, win - len(y)))
    starts = list(range(0, len(y) - win + 1, step))
    return np.stack([y[s:s + win] for s in starts]), starts


def pad_crop_time(S: np.ndarray, T: int = C.T) -> np.ndarray:
    frames = S.shape[1]
    if frames >= T:
        return S[:, :T]
    return np.pad(S, ((0, 0), (0, T - frames)), constant_values=S.min())


def log_mel(y: np.ndarray) -> np.ndarray:
    """1-D waveform -> (n_mels, frames) in dB, fixed reference (ref=1.0)."""
    M = librosa.feature.melspectrogram(
        y=y, sr=C.SR, n_fft=C.N_FFT, hop_length=C.HOP, n_mels=C.N_MELS)
    return librosa.power_to_db(M, ref=1.0)


def window_log_mels(windows: np.ndarray) -> np.ndarray:
    """(n, win) -> (n, 128, T) dB."""
    return np.stack([pad_crop_time(log_mel(w)) for w in windows]).astype(np.float32)


def normalize(X_db: np.ndarray, train_min: float, train_max: float) -> np.ndarray:
    """Min-max with *train-set* statistics -> (N, 128, T, 1) in [0, 1]."""
    X = (X_db - train_min) / (train_max - train_min)
    return np.clip(X, 0.0, 1.0)[..., np.newaxis].astype(np.float32)

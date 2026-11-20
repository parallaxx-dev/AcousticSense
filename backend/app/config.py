"""Single source of truth for the audio / model constants.

These mirror `notebooks/kaggle_2_conv_autoencoder_CAE.ipynb` exactly so the served model sees
the same features it was trained on.
"""
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
ARTIFACTS_DIR = PROJECT_DIR / "models"          # trained weights and the registry, see models/README.md

# --- audio / spectrogram ---
SR = 16_000
N_FFT = 1024
HOP = 512
N_MELS = 128
WINDOW_SAMPLES = 32_768          # ~2.05 s
OVERLAP = 0.5
STEP_SAMPLES = int(WINDOW_SAMPLES * (1 - OVERLAP))
T = 64                           # time frames per window (power of 2)
CHANNEL = 0                      # MIMII is 8-channel; mic 0 only

# --- model ---
LATENT_DIM = 32
THRESHOLD_PERCENTILE = 95

# --- API limits ---
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_DURATION_S = 60.0
MIN_DURATION_S = 0.5

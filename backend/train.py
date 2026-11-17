"""Train the CAE on healthy clips only and export everything the API/UI needs.

    python backend/train.py --data fan/id_02 --epochs 100

Outputs (backend/artifacts/):
    model.keras   trained autoencoder          norm.json    train_min / train_max (dB)
    eval.json     ROC, histograms, confusion matrix, loss curves, threshold, band errors
    samples.json  held-out test clips offered in the UI's "try a sample" picker
Same split (seed 42, 70/10/20 of healthy) and cache signature as the notebook,
so spectrograms cached by the notebook are reused when paths match.
"""
from __future__ import annotations

import argparse, glob, hashlib, json, os, random, time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import tensorflow as tf
from joblib import Parallel, delayed
from sklearn.metrics import (confusion_matrix, f1_score, roc_auc_score, roc_curve)

from app import audio, config as C
from app.model import build_conv_autoencoder

SEED = 42
GAIN_DB = 2.0
BATCH = 32


def clip_to_segments(path):
    wins, _ = audio.slice_windows(audio.load_audio(path))
    return audio.window_log_mels(wins)


def build_split(files, name, cache_dir: Path):
    cache_dir.mkdir(parents=True, exist_ok=True)
    sig = "|".join(files) + (f"|ch{C.CHANNEL}|w{C.WINDOW_SAMPLES}|o{C.OVERLAP}|T{C.T}"
                             f"|m{C.N_MELS}|h{C.HOP}|f{C.N_FFT}")
    cache = cache_dir / f"{name}_{hashlib.md5(sig.encode()).hexdigest()[:12]}.npz"
    if cache.exists():
        d = np.load(cache)
        print(f"[cache] {name}: {cache.name}")
        return d["X"], d["ids"]
    segs = Parallel(n_jobs=-1)(delayed(clip_to_segments)(f) for f in files)
    X = np.concatenate(segs)
    ids = np.concatenate([np.full(len(s), i) for i, s in enumerate(segs)])
    np.savez(cache, X=X, ids=ids)
    return X, ids


def aggregate(scores, ids, how="mean"):
    fn = np.mean if how == "mean" else np.max
    return np.array([fn(scores[ids == c]) for c in np.unique(ids)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="fan/id_02", help="folder with normal/ and abnormal/ (relative to cwd)")
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--cache", default="data/cache")
    ap.add_argument("--out", default=str(C.ARTIFACTS_DIR))
    args = ap.parse_args()

    random.seed(SEED); np.random.seed(SEED); tf.keras.utils.set_random_seed(SEED)
    for g in tf.config.list_physical_devices("GPU"):
        tf.config.experimental.set_memory_growth(g, True)

    data = Path(args.data)
    normal = sorted(glob.glob(str(data / "normal" / "*.wav")))
    abnormal = sorted(glob.glob(str(data / "abnormal" / "*.wav")))
    assert normal and abnormal, f"need normal/ and abnormal/ clips under {data}"

    perm = np.random.default_rng(SEED).permutation(len(normal))
    n_tr, n_va = int(0.7 * len(perm)), int(0.1 * len(perm))
    train_f = [normal[i] for i in perm[:n_tr]]
    val_f = [normal[i] for i in perm[n_tr:n_tr + n_va]]
    test_normal = [normal[i] for i in perm[n_tr + n_va:]]
    test_f = test_normal + abnormal
    y_test = np.array([0] * len(test_normal) + [1] * len(abnormal))
    assert not (set(train_f) & set(val_f)) and not (set(train_f) & set(test_f)) and not (set(val_f) & set(test_f))
    print(f"train {len(train_f)} | val {len(val_f)} | test {len(test_normal)} healthy + {len(abnormal)} faulty")

    cache = Path(args.cache)
    Xtr_db, _ = build_split(train_f, "train", cache)
    Xva_db, ids_va = build_split(val_f, "val", cache)
    Xte_db, ids_te = build_split(test_f, "test", cache)

    tmin, tmax = float(Xtr_db.min()), float(Xtr_db.max())      # healthy TRAIN only
    Xtr, Xva, Xte = (audio.normalize(x, tmin, tmax) for x in (Xtr_db, Xva_db, Xte_db))
    print(f"train_min={tmin:.2f} dB  train_max={tmax:.2f} dB  input={Xtr.shape[1:]}")

    gain = GAIN_DB / (tmax - tmin)
    def rand_gain(x):
        return tf.clip_by_value(x + tf.random.uniform([], -gain, gain), 0.0, 1.0)
    def mk(X, training):
        ds = tf.data.Dataset.from_tensor_slices(X)
        if training:
            ds = ds.cache().shuffle(len(X), seed=SEED).map(rand_gain, num_parallel_calls=tf.data.AUTOTUNE)
        else:
            ds = ds.cache()
        return ds.map(lambda x: (x, x)).batch(BATCH).prefetch(tf.data.AUTOTUNE)

    model = build_conv_autoencoder(Xtr.shape[1:], latent_dim=C.LATENT_DIM)
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="mse")
    cbs = [tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True),
           tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=4, min_lr=1e-6)]
    t0 = time.time()
    hist = model.fit(mk(Xtr, True), validation_data=mk(Xva, False), epochs=args.epochs,
                     callbacks=cbs, verbose=2).history
    print(f"trained {len(hist['loss'])} epochs in {(time.time() - t0) / 60:.1f} min")

    def seg_scores(X):
        rec = model.predict(X, batch_size=64, verbose=0)
        return np.mean(np.square(X - rec), axis=(1, 2, 3)), rec

    sva, _ = seg_scores(Xva)
    ste, rec_te = seg_scores(Xte)
    val_clip, test_clip = aggregate(sva, ids_va), aggregate(ste, ids_te)

    thr = float(np.percentile(val_clip, C.THRESHOLD_PERCENTILE))
    pred = (test_clip > thr).astype(int)
    fpr, tpr, _ = roc_curve(y_test, test_clip)
    cm = confusion_matrix(y_test, pred)
    metrics = dict(auc=float(roc_auc_score(y_test, test_clip)),
                   pauc=float(roc_auc_score(y_test, test_clip, max_fpr=0.1)),
                   f1=float(f1_score(y_test, pred)), threshold=thr)
    print({k: round(v, 5) for k, v in metrics.items()}, "\nconfusion:\n", cm)

    # per-mel-band mean squared error, healthy vs faulty test segments
    seg_lab = y_test[ids_te]
    band = np.mean(np.square(Xte - rec_te), axis=(2, 3))            # (N, 128)
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    model.save(out / "model.keras")
    (out / "norm.json").write_text(json.dumps({"train_min": tmin, "train_max": tmax}))

    r = lambda a, n=6: np.round(np.asarray(a, dtype=np.float64), n).tolist()
    # downsample ROC to <=200 points
    sel = np.unique(np.linspace(0, len(fpr) - 1, min(200, len(fpr))).astype(int))
    (out / "eval.json").write_text(json.dumps({
        "machine": data.parent.name, "machine_id": data.name,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config": dict(sr=C.SR, n_fft=C.N_FFT, hop=C.HOP, n_mels=C.N_MELS, window_samples=C.WINDOW_SAMPLES,
                       overlap=C.OVERLAP, T=C.T, latent_dim=C.LATENT_DIM, percentile=C.THRESHOLD_PERCENTILE,
                       params=int(model.count_params())),
        "counts": dict(train=len(train_f), val=len(val_f), test_healthy=len(test_normal), test_faulty=len(abnormal)),
        "metrics": metrics,
        "threshold": thr,
        "val_percentiles": {str(p): float(np.percentile(val_clip, p)) for p in (50, 80, 90, 95, 99)},
        "roc": {"fpr": r(fpr[sel]), "tpr": r(tpr[sel])},
        "confusion": cm.tolist(),
        "scores": {"val": r(val_clip, 7), "test_healthy": r(test_clip[y_test == 0], 7),
                   "test_faulty": r(test_clip[y_test == 1], 7)},
        "history": {"loss": r(hist["loss"], 7), "val_loss": r(hist["val_loss"], 7)},
        "band_error": {"healthy": r(band[seg_lab == 0].mean(0)), "faulty": r(band[seg_lab == 1].mean(0))},
    }))
    rng = np.random.default_rng(SEED)
    pick = lambda fs, k: [str(fs[i]) for i in sorted(rng.choice(len(fs), min(k, len(fs)), replace=False))]
    (out / "samples.json").write_text(json.dumps(
        [{"path": p, "label": "normal"} for p in pick(test_normal, 6)] +
        [{"path": p, "label": "abnormal"} for p in pick(abnormal, 6)], indent=1))
    print("saved ->", out)


if __name__ == "__main__":
    main()

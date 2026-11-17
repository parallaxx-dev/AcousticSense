"""Build artifacts/cae/registry.json (+ samples.json) from the Kaggle exports.

Run from the project root after unzipping the 16 per-machine models:

    unzip dense_models.zip -d backend/artifacts/cae          # model.keras + norm.npz per <machine>_<id>/
    python backend/scripts/build_registry.py --exports .      # reads export_cae/, export_dense/, export_sup/

Thresholds, ROC curves, score distributions, confusion matrices and loss curves all come from the
notebooks' CSV exports, so nothing has to be retrained. Despite the zip's name, the weights are the
convolutional autoencoder (128x64x1 input, min-max normalisation a=lo, b=hi).
"""
from __future__ import annotations

import argparse, glob, json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve

SEED = 42
HERE = Path(__file__).resolve().parents[1]


def r(a, n=6):
    return np.round(np.asarray(a, dtype=np.float64), n).tolist()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exports", default=".", help="folder holding export_cae/, export_dense/, export_sup/")
    ap.add_argument("--models", default=str(HERE / "artifacts" / "cae"))
    ap.add_argument("--fan-audio", default="fan", help="local MIMII fan folder used for sample clips")
    args = ap.parse_args()
    ex, models = Path(args.exports), Path(args.models)

    res = pd.read_csv(ex / "export_cae" / "results_cae.csv")
    scores = pd.read_csv(ex / "export_cae" / "all_clip_scores_cae.csv")
    hist = pd.read_csv(ex / "export_cae" / "history_cae.csv")
    dense = pd.read_csv(ex / "export_dense" / "results_dense.csv").set_index(["machine", "id"])["auc"]
    sup_path = ex / "export_sup" / "results_sup.csv"
    sup = None
    if sup_path.exists():
        s = pd.read_csv(sup_path)
        if "augment" in s:                        # keep the best variant per machine/id
            s = s.sort_values("auc", ascending=False).drop_duplicates(["machine", "id"])
        sup = s.set_index(["machine", "id"])["auc"]

    out = []
    for _, row in res.iterrows():
        m, u = row["machine"], row["id"]
        key = f"{m}_{u}"
        folder = models / key
        if not (folder / "model.keras").exists() or not (folder / "norm.npz").exists():
            print("skip (no weights):", key)
            continue
        norm = np.load(folder / "norm.npz")                       # allow_pickle stays False
        a, b = float(norm["a"]), float(norm["b"])
        sc = scores[(scores.machine == m) & (scores.id == u)]
        val = sc[sc.split == "val"].score.values
        test = sc[sc.split == "test"]
        y, s_te = test.label.values, test.score.values
        fpr, tpr, _ = roc_curve(y, s_te)
        sel = np.unique(np.linspace(0, len(fpr) - 1, min(200, len(fpr))).astype(int))
        h = hist[hist.run == key]
        out.append({
            "id": key, "machine": m, "unit": u, "source": "kaggle", "snr": int(row["snr"]),
            "label": f"{m} {u.replace('_', ' ')}",
            "norm": {"lo": a, "hi": b},
            "threshold": float(row["threshold"]),
            "metrics": {k: float(row[k]) for k in ("auc", "pauc", "f1", "bal_acc", "recall", "false_alarm", "recall_at_5pct_fa", "threshold")},
            "published_auc": float(row["published_auc"]),
            "compare": {"dense_auc": float(dense.get((m, u), np.nan)),
                        "supervised_auc": float(sup.get((m, u), np.nan)) if sup is not None else None},
            "epochs": int(row["epochs"]), "minutes": float(row["minutes"]) if "minutes" in row and pd.notna(row["minutes"]) else None,
            "confusion": [[int(row.tn), int(row.fp)], [int(row.fn), int(row.tp)]],
            "counts": {"train": None, "val": int(len(val)), "test_healthy": int((y == 0).sum()), "test_faulty": int((y == 1).sum())},
            "roc": {"fpr": r(fpr[sel]), "tpr": r(tpr[sel])},
            "scores": {"val": r(val, 7), "test_healthy": r(s_te[y == 0], 7), "test_faulty": r(s_te[y == 1], 7)},
            "val_percentiles": {str(p): float(np.percentile(val, p)) for p in (50, 80, 90, 95, 99)},
            "history": {"loss": r(h.loss.values, 7), "val_loss": r(h.val_loss.values, 7)},
        })
    (models / "registry.json").write_text(json.dumps({"models": out}, separators=(",", ":")))
    print(f"registry.json: {len(out)} models")

    # Held-out sample clips for each local fan unit: same split rule as the notebooks (seed 42, 70/10/20).
    samples, rng = [], np.random.default_rng(SEED)
    for unit_dir in sorted(glob.glob(str(Path(args.fan_audio) / "id_*"))):
        normal = sorted(glob.glob(f"{unit_dir}/normal/*.wav"))
        abnormal = sorted(glob.glob(f"{unit_dir}/abnormal/*.wav"))
        if not normal or not abnormal:
            continue
        perm = np.random.default_rng(SEED).permutation(len(normal))
        test_normal = [normal[i] for i in perm[int(0.8 * len(perm)):]]
        for lab, files in (("normal", test_normal), ("abnormal", abnormal)):
            for i in sorted(rng.choice(len(files), 3, replace=False)):
                samples.append({"path": files[i], "label": lab, "machine": "fan", "unit": Path(unit_dir).name})
    (models / "samples.json").write_text(json.dumps(samples, indent=1))
    print("samples.json:", len(samples))


if __name__ == "__main__":
    main()

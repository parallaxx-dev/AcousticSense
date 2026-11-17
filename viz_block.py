# ============================ Visualization toolkit ============================
# Paste into a cell AFTER the notebook's helper cells (it reuses build_split, ctx_vectors,
# build_dense_autoencoder, dense_ds, dense_scores, aggregate, make_callbacks, plan, ...).
import gc
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, roc_auc_score, confusion_matrix, ConfusionMatrixDisplay

plt.rcParams.update({"figure.dpi": 110, "axes.grid": True, "grid.alpha": 0.3,
                     "axes.spines.top": False, "axes.spines.right": False})
C_OK, C_BAD, C_DARK = "#2a9d8f", "#e76f51", "#264653"


# ---------- A. Whole-sweep plots (uses the `results` list or results.csv) ----------
def sweep_plots(res, agg="mean"):
    r = res[res["agg"] == agg].copy()
    r["snr"] = r["snr"].fillna("n/a")          # read_csv turns "n/a" into NaN, which pivot_table would drop
    r["row"] = r["machine"] + " @ " + r["snr"].astype(str) + " dB"

    # heatmaps: machine x ID for AUC / pAUC / F1
    fig, axs = plt.subplots(1, 3, figsize=(17, 0.6 * r["row"].nunique() + 2.8))
    for ax, (col, title, lo) in zip(axs, [("auc", "AUC-ROC", 0.5), ("pauc", "pAUC (FPR<=0.1)", 0.5), ("f1", "F1 @ P95 threshold", 0.0)]):
        piv = r.pivot_table(index="row", columns="id", values=col)
        im = ax.imshow(piv.values, vmin=lo, vmax=1, cmap="RdYlGn", aspect="auto")
        ax.set_xticks(range(piv.shape[1])); ax.set_xticklabels(piv.columns)
        ax.set_yticks(range(piv.shape[0])); ax.set_yticklabels(piv.index)
        ax.grid(False)
        for (i, j), v in np.ndenumerate(piv.values):
            if not np.isnan(v):
                ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=9)
        ax.set_title(f"{title}  ({agg} aggregation)")
        fig.colorbar(im, ax=ax, fraction=0.046)
    plt.tight_layout(); plt.show()

    # ours vs the published MIMII benchmark, per machine/ID
    keys = ["machine", "id", "snr"]
    piv = r.pivot_table(index=keys, columns="model", values="auc")
    bench = r.groupby(keys)["bench_auc"].first().reindex(piv.index)
    ax = piv.plot.bar(figsize=(max(9, 0.6 * len(piv) + 3), 4.8), width=0.8, color=[C_OK, C_BAD][:piv.shape[1]])
    ax.scatter(range(len(piv)), bench.values, marker="D", c="k", zorder=5, label="MIMII benchmark")
    ax.axhline(0.5, color="gray", ls="--", lw=1)
    ax.set_xticks(range(len(piv)))
    ax.set_xticklabels([f"{m}\n{i}" for m, i, s in piv.index], rotation=0, fontsize=8)
    ax.set(ylabel="AUC-ROC", ylim=(0, 1.05), xlabel="", title="AUC per run vs. published benchmark")
    ax.legend(loc="lower right"); plt.tight_layout(); plt.show()


# ---------- B. Full diagnostics for ONE run ----------
def plot_diagnostics(history, val_scores, test_scores, y_test, title="", pct=95):
    """history: Keras history dict (or None). *_scores: clip-level anomaly scores. y_test: 1 = faulty."""
    y_test = np.asarray(y_test).astype(int)
    thr = np.percentile(val_scores, pct)
    pred = (test_scores > thr).astype(int)
    auc = roc_auc_score(y_test, test_scores)
    pauc = roc_auc_score(y_test, test_scores, max_fpr=0.1)
    fpr, tpr, _ = roc_curve(y_test, test_scores)
    cm = confusion_matrix(y_test, pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    healthy, faulty = test_scores[y_test == 0], test_scores[y_test == 1]

    fig, axs = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle(title, fontsize=14, fontweight="bold")

    # 1) training / validation loss
    ax = axs[0, 0]
    if history:
        ax.plot(range(1, len(history["loss"]) + 1), history["loss"], color=C_OK, lw=2, label="train")
        ax.plot(range(1, len(history["val_loss"]) + 1), history["val_loss"], color=C_BAD, lw=2, label="validation")
        best = int(np.argmin(history["val_loss"]))
        ax.axvline(best + 1, ls="--", color="gray", label=f"best epoch {best + 1}")
        ax.set_yscale("log")
    ax.set(title="Training / validation loss (MSE)", xlabel="epoch", ylabel="loss"); ax.legend()

    # 2) ROC with the pAUC region
    ax = axs[0, 1]
    ax.plot(fpr, tpr, color=C_DARK, lw=2, label=f"AUC = {auc:.3f}   pAUC = {pauc:.3f}")
    ax.plot([0, 1], [0, 1], "k--", alpha=0.4)
    ax.axvspan(0, 0.1, color="orange", alpha=0.15, label="pAUC region (FPR <= 0.1)")
    ax.scatter([fp / max(fp + tn, 1)], [tp / max(tp + fn, 1)], color=C_BAD, zorder=5, label=f"P{pct} threshold")
    ax.set(title="ROC curve", xlabel="false positive rate", ylabel="true positive rate"); ax.legend(loc="lower right")

    # 3) anomaly-score distributions
    ax = axs[0, 2]
    bins = np.histogram_bin_edges(np.concatenate([val_scores, test_scores]), bins=40)
    ax.hist(val_scores, bins=bins, alpha=0.45, density=True, color="gray", label="healthy (val)")
    ax.hist(healthy, bins=bins, alpha=0.55, density=True, color=C_OK, label="healthy (test)")
    ax.hist(faulty, bins=bins, alpha=0.55, density=True, color=C_BAD, label="faulty (test)")
    ax.axvline(thr, color="k", ls="--", label=f"P{pct} of healthy val")
    ax.set(title="Anomaly-score distribution", xlabel="clip reconstruction MSE", ylabel="density"); ax.legend()

    # 4) confusion matrix at the validation-derived threshold
    ax = axs[1, 0]
    ConfusionMatrixDisplay(cm, display_labels=["healthy", "faulty"]).plot(ax=ax, colorbar=False, values_format="d", cmap="Blues")
    ax.grid(False)
    ax.set_title(f"Confusion matrix @ P{pct} threshold\nrecall {tp / max(tp + fn, 1):.2f} | false-alarm rate {fp / max(fp + tn, 1):.2f}")

    # 5) "accuracy" vs threshold (autoencoders have no training accuracy; it only exists after thresholding)
    ax = axs[1, 1]
    grid = np.quantile(np.concatenate([val_scores, test_scores]), np.linspace(0, 1, 300))
    P = test_scores[None, :] > grid[:, None]
    yb = y_test.astype(bool)
    TP, FP = (P & yb).sum(1), (P & ~yb).sum(1)
    FN, TN = (~P & yb).sum(1), (~P & ~yb).sum(1)
    rec, spec = TP / np.maximum(TP + FN, 1), TN / np.maximum(TN + FP, 1)
    prec = np.where(TP + FP > 0, TP / np.maximum(TP + FP, 1), 1.0)
    f1 = 2 * prec * rec / np.maximum(prec + rec, 1e-12)
    for y_, name, kw in [((TP + TN) / len(yb), "accuracy", {}), ((rec + spec) / 2, "balanced accuracy", {}),
                         (prec, "precision", {"ls": ":"}), (rec, "recall", {"ls": ":"}), (f1, "F1", {"lw": 2.5})]:
        ax.plot(grid, y_, label=name, **kw)
    ax.axvline(thr, color="k", ls="--", label=f"P{pct} threshold")
    ax.set(title="Metrics vs. decision threshold", xlabel="threshold on clip score", ylabel="score", ylim=(0, 1.02))
    ax.legend(fontsize=8, ncol=2)

    # 6) box + strip plot of clip scores per group
    ax = axs[1, 2]
    groups = [val_scores, healthy, faulty]
    ax.boxplot(groups, showfliers=False, widths=0.5)
    rng = np.random.default_rng(0)
    for k, (g, c) in enumerate(zip(groups, ["gray", C_OK, C_BAD]), start=1):
        ax.scatter(k + rng.uniform(-0.15, 0.15, len(g)), g, s=8, alpha=0.5, color=c, zorder=3)
    ax.axhline(thr, color="k", ls="--")
    ax.set_xticks([1, 2, 3]); ax.set_xticklabels(["healthy\n(val)", "healthy\n(test)", "faulty\n(test)"])
    ax.set(title="Clip scores by group", ylabel="clip reconstruction MSE"); ax.set_yscale("log")

    plt.tight_layout(rect=(0, 0, 1, 0.96)); plt.show()
    print(f"AUC {auc:.4f} | pAUC {pauc:.4f} | accuracy {(tp + tn) / len(y_test):.3f} | "
          f"F1 {2 * tp / max(2 * tp + fp + fn, 1):.3f} | confusion [[TN {tn}, FP {fp}], [FN {fn}, TP {tp}]]")


def diagnose(machine, mid, snr=None, agg="mean", epochs=None):
    """Re-trains the dense AE for ONE machine/ID/SNR (same split & seed as the sweep, ~4 min on GPU)
    and draws the full diagnostic figure. Returns the loss history, scores and the model."""
    snr = SNRS[0] if snr is None else snr
    hit = [p for p in plan if p[0] == machine and p[1] == mid and p[2] in (snr, None)]
    assert hit, f"{machine}/{mid}/{snr} is not in `plan`"
    normal_files, abnormal_files = hit[0][3], hit[0][4]

    tf.keras.backend.clear_session(); gc.collect(); tf.keras.utils.set_random_seed(SEED)
    perm = np.random.default_rng(SEED).permutation(len(normal_files))
    n_tr, n_va = int(0.7 * len(perm)), int(0.1 * len(perm))
    train_f = [normal_files[i] for i in perm[:n_tr]]
    val_f   = [normal_files[i] for i in perm[n_tr:n_tr + n_va]]
    test_n  = [normal_files[i] for i in perm[n_tr + n_va:]]
    test_f  = test_n + list(abnormal_files)
    y_test  = np.array([0] * len(test_n) + [1] * len(abnormal_files))

    Xtr, _ = build_split(train_f); Xva, ids_va = build_split(val_f); Xte, ids_te = build_split(test_f)
    mu = Xtr.mean(axis=(0, 2), keepdims=True); sd = Xtr.std(axis=(0, 2), keepdims=True) + 1e-6
    Vtr = ctx_vectors(Xtr, mu, sd, DENSE_TRAIN_STRIDE).reshape(-1, D_IN)
    Vva = ctx_vectors(Xva, mu, sd, DENSE_TRAIN_STRIDE).reshape(-1, D_IN)

    model = build_dense_autoencoder()
    model.compile(optimizer=tf.keras.optimizers.Adam(LR), loss="mse")
    h = model.fit(dense_ds(Vtr, True), validation_data=dense_ds(Vva, False),
                  epochs=epochs or EPOCHS, callbacks=make_callbacks(), verbose=0)
    v = aggregate(dense_scores(model, Xva, mu, sd), ids_va, agg)
    t = aggregate(dense_scores(model, Xte, mu, sd), ids_te, agg)
    plot_diagnostics(h.history, v, t, y_test, title=f"Dense 5-frame AE | {machine} {mid} @ {snr} dB | {agg} aggregation")
    return dict(history=h.history, val_scores=v, test_scores=t, y_test=y_test, model=model)


# ---------------------------------- usage ----------------------------------
# sweep_plots(pd.DataFrame(results))            # or: pd.read_csv(WORK_DIR / "results.csv")
# art = diagnose("valve", "id_00", 6)           # best/worst cases are the most informative:
# art = diagnose("pump",  "id_02", 6)           #   valve id_00, pump id_02, fan id_00, slider id_06

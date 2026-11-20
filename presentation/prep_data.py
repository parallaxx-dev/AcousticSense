"""Turn a notebook's export CSVs into presentation/data/<tag>.json.
Usage: python prep_data.py <tag: dense|cae|sup|ast> <export_folder> --split <blocked|random|blocked*|random-quick>
For 'sup' the main numbers are the augment=True runs (decided before running); the no-augmentation runs go into 'ablation'."""
import sys, json
import numpy as np, pandas as pd
from sklearn.metrics import roc_curve

tag, folder = sys.argv[1], sys.argv[2]
split = sys.argv[sys.argv.index("--split") + 1] if "--split" in sys.argv else "unknown"
MACH = ["fan", "pump", "slider", "valve"]
sup = tag == "sup"
ast = tag == "ast"
if ast:   # quick-run AST export: headline variant = pool + mahalanobis (decided before running)
    allres = pd.read_csv(f"{folder}/results_embed.csv")
    res = allres[(allres.feature == "pool") & (allres.scorer == "mahalanobis")].copy()
    clips = pd.read_csv(f"{folder}/clip_scores_embed.csv"); clips = clips[(clips.feature == "pool") & (clips.scorer == "mahalanobis")]
    hist = None; res["epochs"] = 0; res["minutes"] = 0.0
elif sup:
    allres = pd.read_csv(f"{folder}/results_sup.csv")
    res = allres[allres.augment == True].copy()
    clips = pd.read_csv(f"{folder}/clip_scores_sup.csv"); clips = clips[(clips.augment == True) & (clips.split == "test")]
    hist = pd.read_csv(f"{folder}/history_sup.csv"); hist = hist[hist.augment == True].copy()
    hist["run"] = hist.machine + "_" + hist["id"]
    res["minutes"] = 0.0
else:
    res = pd.read_csv(f"{folder}/results_{tag}.csv")
    clips = pd.read_csv(f"{folder}/all_clip_scores_{tag}.csv"); clips = clips[clips.split == "test"]
    hist = pd.read_csv(f"{folder}/history_{tag}.csv")

mcols = ["auc", "pauc", "accuracy", "bal_acc", "recall", "false_alarm", "recall_at_5pct_fa", "published_auc"]
out = {"tag": tag, "protocol": {"split": split}, "n_runs": len(res), "total_minutes": float(res.minutes.sum()),
       "kpi": {k: float(res[k].mean()) for k in mcols}}
out["per_machine"] = {m: {k: float(res[res.machine == m][k].mean()) for k in mcols} for m in MACH}
out["runs"] = [{k: (float(r[k]) if k not in ("machine", "id") else r[k]) for k in
                ["machine", "id", "auc", "pauc", "bal_acc", "recall", "false_alarm", "published_auc", "epochs", "minutes"]}
               for _, r in res.iterrows()]
out["confusion"] = {m: {k: int(res[res.machine == m][k].sum()) for k in ["tn", "fp", "fn", "tp"]} for m in MACH}
out["confusion"]["all"] = {k: int(res[k].sum()) for k in ["tn", "fp", "fn", "tp"]}
out["mistakes"] = {m: {"missed_pct": 100 * c["fn"] / (c["fn"] + c["tp"]), "false_alarm_pct": 100 * c["fp"] / (c["fp"] + c["tn"])}
                   for m, c in out["confusion"].items() if m != "all"}

grid = np.linspace(0, 1, 51); roc = {}
for m in MACH:
    curves = []
    for (mm, mid), g in clips[clips.machine == m].groupby(["machine", "id"]):
        f, t, _ = roc_curve(g.label, g.score); curves.append(np.interp(grid, f, t))
    roc[m] = [float(v) for v in np.mean(curves, axis=0)]
out["roc"] = {"fpr": [float(v) for v in grid], **roc}

if hist is not None:
    g = hist.groupby("epoch").agg(loss=("loss", "mean"), val=("val_loss", "mean"), n=("run", "count")); g = g[g.n >= 4]
    out["loss"] = {"epoch": [int(e) + 1 for e in g.index], "train": [float(v) for v in g.loss], "val": [float(v) for v in g.val]}
    last = hist.sort_values("epoch").groupby("run").tail(1)
    out["loss_gap_final_mean"] = float((last.val_loss - last.loss).mean())
else:   # no training: show the score distribution instead (score divided by each run's threshold)
    thr = res.set_index(["machine", "id"]).threshold
    r = clips.score.values / clips.set_index(["machine", "id"]).index.map(thr).values.astype(float)
    edges = np.arange(0, 4.01, 0.25); inter = np.clip(r, 0, 3.999)
    hh, _ = np.histogram(inter[clips.label.values == 0], bins=edges); ff, _ = np.histogram(inter[clips.label.values == 1], bins=edges)
    out["scorehist"] = {"labels": [f"{a:g}" for a in edges[:-1]], "healthy": [float(v) for v in hh / hh.sum()], "faulty": [float(v) for v in ff / ff.sum()]}

OFFICIAL = {"valve": {"id_00": (991, 119), "id_02": (708, 120), "id_04": (1000, 120), "id_06": (992, 120)},
            "pump": {"id_00": (1006, 143), "id_02": (1005, 111), "id_04": (702, 100), "id_06": (1036, 102)},
            "fan": {"id_00": (1011, 407), "id_02": (1016, 359), "id_04": (1033, 348), "id_06": (1015, 361)},
            "slider": {"id_00": (1068, 356), "id_02": (1068, 267), "id_04": (534, 178), "id_06": (534, 89)}}
out["dataset"] = {m: {"healthy": sum(v[0] for v in d.values()), "faulty": sum(v[1] for v in d.values())} for m, d in OFFICIAL.items()}
if not sup and not ast:   # all faulty clips are in the test set here, so the counts must match the official table
    chk = {m: int(res[res.machine == m][["fn", "tp"]].sum().sum()) for m in MACH}
    assert all(chk[m] == out["dataset"][m]["faulty"] for m in MACH), (chk, out["dataset"])
elif sup:
    ab = allres.groupby(["machine", "augment"])[["auc", "bal_acc"]].mean()
    out["ablation"] = {m: {"auc_no": float(ab.loc[(m, False), "auc"]), "auc_aug": float(ab.loc[(m, True), "auc"]),
                           "bal_no": float(ab.loc[(m, False), "bal_acc"]), "bal_aug": float(ab.loc[(m, True), "bal_acc"])} for m in MACH}
    o = allres.groupby("augment")[["auc", "bal_acc"]].mean()
    out["ablation"]["all"] = {"auc_no": float(o.loc[False, "auc"]), "auc_aug": float(o.loc[True, "auc"]), "bal_no": float(o.loc[False, "bal_acc"]), "bal_aug": float(o.loc[True, "bal_acc"])}
if not sup and "scorehist" not in out:   # score distribution (score / threshold) for the scoring slide
    thr = res.set_index(["machine", "id"]).threshold
    r = clips.score.values / clips.set_index(["machine", "id"]).index.map(thr).values.astype(float)
    edges = np.arange(0, 4.01, 0.25); inter = np.clip(r, 0, 3.999)
    hh, _ = np.histogram(inter[clips.label.values == 0], bins=edges); ff, _ = np.histogram(inter[clips.label.values == 1], bins=edges)
    out["scorehist"] = {"labels": [f"{a:g}" for a in edges[:-1]], "healthy": [float(v) for v in hh / hh.sum()], "faulty": [float(v) for v in ff / ff.sum()]}
if ast:
    out["protocol"]["ids"] = "IDs 00 and 02 only"
    v = allres.groupby(["feature", "scorer"]).auc.mean().round(3)
    out["variants"] = {f"{a}+{b}": float(x) for (a, b), x in v.items()}
json.dump(out, open(f"presentation/data/{tag}.json", "w"), indent=1)
print(tag, "| split:", split, "| runs", out["n_runs"], "| mean AUC", round(out["kpi"]["auc"], 3), "| bal_acc", round(out["kpi"]["bal_acc"], 3), "| recall", round(out["kpi"]["recall"], 3), "| FA", round(out["kpi"]["false_alarm"], 3))
for m in MACH: print("   ", m, {k: round(v, 3) for k, v in out["per_machine"][m].items() if k in ("auc", "bal_acc", "recall", "false_alarm")}, "missed%", round(out["mistakes"][m]["missed_pct"], 1), "FA%", round(out["mistakes"][m]["false_alarm_pct"], 1))

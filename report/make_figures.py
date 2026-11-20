"""Original figures for the report (no external images). Run from the project root with .venv/bin/python."""
import json, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
plt.rcParams.update({"font.family": "Liberation Serif", "font.size": 8, "axes.linewidth": 0.6, "pdf.fonttype": 42})
C = dict(io="#9CC9F0", hid="#1F6FB5", lat="#F2A33A", ink="#1B2B3A", mute="#5C6B7A", dense="#1F6FB5", cae="#F2A33A", ast="#6B7C8F", line="#D5DDE6")
D = {k: json.load(open(f"presentation/data/{k}.json")) for k in ("dense", "cae", "ast")}
P = json.load(open("presentation/data/params.json"))

# ------------------------------------------------------------- Fig. 1: architectures (full width)
def arch_row(ax, title, bars, groups):
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    ax.text(0.0, 0.97, title, fontsize=8.5, fontweight="bold", color=C["ink"], va="top")
    n = len(bars); lg = np.log10([b[1] for b in bars]); lo, hi = lg.min(), lg.max()
    pitch = 1.0 / n; bw = min(0.045, pitch * 0.5)
    base, top = 0.30, 0.74                       # vertical band for the bars (centre line = middle)
    mid = (base + top) / 2
    for i, (lab, size, kind) in enumerate(bars):
        h = 0.10 + 0.34 * ((np.log10(size) - lo) / (hi - lo or 1))
        cx = pitch * (i + 0.5)
        ax.add_patch(Rectangle((cx - bw / 2, mid - h / 2), bw, h, fc=C[kind], ec=C[kind], lw=0.4))
        ax.text(cx, mid + h / 2 + 0.02, lab, ha="center", va="bottom", fontsize=6.1, color=C["ink"], fontweight="bold" if kind == "lat" else "normal")
    for name, a, b, cap in groups:
        cx = pitch * ((a + b + 1) / 2)
        ax.text(cx, 0.19, name, ha="center", va="top", fontsize=7, fontweight="bold", color=C["ink"])
        if cap: ax.text(cx, 0.07, cap, ha="center", va="top", fontsize=6.2, color=C["mute"])

fig, axs = plt.subplots(3, 1, figsize=(7.2, 2.9), gridspec_kw={"height_ratios": [1, 1.05, 0.95]})
arch_row(axs[0], f"(a) Dense autoencoder, {P['dense'][0]/1e6:.2f} M parameters: 5 frames x 128 mel bands flattened to 640 inputs",
         [(str(v), v, "io" if i in (0, 10) else "lat" if i == 5 else "hid") for i, v in enumerate([640, 1024, 512, 256, 128, 16, 128, 256, 512, 1024, 640])],
         [("Input", 0, 0, ""), ("Encoder", 1, 4, "Dense + BatchNorm + ReLU"), ("Latent", 5, 5, ""), ("Decoder", 6, 9, "Dense + BatchNorm + ReLU"), ("Output", 10, 10, "")])
cs = [(128, 64, 1), (64, 32, 32), (32, 16, 64), (16, 8, 128), (8, 4, 256), 32, (8, 4, 256), (16, 8, 128), (32, 16, 64), (64, 32, 32), (128, 64, 16), (128, 64, 1)]
bars = [("(" + ",".join(map(str, v)) + ")" if isinstance(v, tuple) else str(v), int(np.prod(v)) if isinstance(v, tuple) else v, "io" if i in (0, 11) else "lat" if i == 5 else "hid") for i, v in enumerate(cs)]
arch_row(axs[1], f"(b) Convolutional autoencoder (CAE), {P['cae'][0]/1e6:.2f} M parameters: 128 x 64 log-Mel picture, 32-number bottleneck, no skip connections",
         bars, [("Input", 0, 0, ""), ("Encoder", 1, 4, "Conv 3x3 stride 2 + BN + LeakyReLU"), ("Latent", 5, 5, ""), ("Decoder", 6, 10, "Transposed conv 3x3 stride 2 + BN + LeakyReLU"), ("Output", 11, 11, "")])
arch_row(axs[2], f"(c) AST embeddings, {P['ast'][0]/1e6:.1f} M frozen parameters (not trained): distance to healthy clips replaces reconstruction",
         [("(1024,128)", 131072, "io"), ("(1212,768)", 930816, "hid"), ("12 attention blocks", 930816, "hid"), ("768", 768, "lat"), ("score", 4, "io")],
         [("Spectrogram", 0, 0, "1024 frames x 128 mel"), ("Patch embedding", 1, 1, "1212 patches"), ("Frozen transformer", 2, 2, "pretrained on AudioSet"), ("Embedding", 3, 3, "768 numbers per clip"), ("Score", 4, 4, "Mahalanobis distance")])
plt.subplots_adjust(left=0.01, right=0.99, top=0.995, bottom=0.005, hspace=0.12)
plt.savefig("report/figures/fig1_architectures.png", dpi=300); plt.close()

# ------------------------------------------------------------- Fig. 2: per-machine AUC
MACH = ["fan", "pump", "slider", "valve"]; w = 0.26
fig, ax = plt.subplots(figsize=(3.45, 1.85))
for i, (k, name, col) in enumerate([("dense", "Dense (blocked)", C["dense"]), ("cae", "CAE (random)", C["cae"]), ("ast", "AST (quick run)", C["ast"])]):
    vals = [D[k]["per_machine"][m]["auc"] for m in MACH]
    b = ax.bar(np.arange(4) + (i - 1) * w, vals, w, label=name, color=col)
    for r, v in zip(b, vals): ax.text(r.get_x() + r.get_width() / 2, v + 0.008, f"{v:.2f}", ha="center", va="bottom", fontsize=5.2, rotation=90)
ax.axhline(0.5, color=C["mute"], ls=":", lw=0.7)
ax.set_xticks(range(4)); ax.set_xticklabels([m.capitalize() for m in MACH]); ax.set_ylim(0.4, 1.12); ax.set_ylabel("Mean AUC")
ax.legend(fontsize=6, ncol=3, loc="upper center", frameon=False, bbox_to_anchor=(0.5, 1.12), handlelength=1.2, columnspacing=0.8)
for s in ("top", "right"): ax.spines[s].set_visible(False)
ax.tick_params(length=2, labelsize=7); plt.tight_layout(pad=0.3); plt.savefig("report/figures/fig2_auc_per_machine.png", dpi=300); plt.close()

# ------------------------------------------------------------- Fig. 3: ROC 2x2
fig, axs = plt.subplots(2, 2, figsize=(3.45, 2.3), sharex=True, sharey=True)
x = np.array(D["dense"]["roc"]["fpr"])
for ax, m in zip(axs.ravel(), MACH):
    for k, col in (("dense", C["dense"]), ("cae", C["cae"]), ("ast", C["ast"])): ax.plot(x, D[k]["roc"][m], color=col, lw=1.2)
    ax.plot([0, 1], [0, 1], color=C["line"], lw=0.8, ls=":"); ax.axvline(0.1, color=C["lat"], lw=0.5, alpha=0.6)
    ax.set_title(m.capitalize(), fontsize=7, pad=2); ax.grid(color="#E9EDF2", lw=0.4)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.tick_params(length=2, labelsize=6); ax.set_xlim(0, 1); ax.set_ylim(0, 1.02); ax.set_xticks([0, 0.5, 1]); ax.set_yticks([0, 0.5, 1])
fig.text(0.54, 0.01, "false alarm rate", ha="center", fontsize=7); fig.text(0.012, 0.5, "faults caught", va="center", rotation=90, fontsize=7)
plt.tight_layout(rect=(0.06, 0.05, 1, 1), pad=0.3, h_pad=0.7, w_pad=0.6); plt.savefig("report/figures/fig3_roc.png", dpi=300); plt.close()
print("figures ok")

# Results

The exported results of the Kaggle runs. Each folder holds what one notebook wrote to `/kaggle/working`, unzipped.

| Folder | Notebook | Split used | Contents |
|---|---|---|---|
| `dense/` | `notebooks/kaggle_1_dense_autoencoder.ipynb` | blocked (strict) | `results_dense.csv` (one row per run), `all_clip_scores_dense.csv`, `history_dense.csv`, `figures_dense/` |
| `cae/` | `notebooks/kaggle_2_conv_autoencoder_CAE.ipynb` | random | `results_cae.csv`, `all_clip_scores_cae.csv`, `history_cae.csv`, `figures_cae/` |
| `sup/` | `notebooks/kaggle_4_supervised_cnn.ipynb` | not recorded (notebook default: blocked) | `results_sup.csv`, `clip_scores_sup.csv`, `history_sup.csv`, `figures/` |

Each run is one machine and one ID, at 6 dB. The metrics are AUC, pAUC, F1, accuracy, balanced accuracy, recall, false-alarm rate and the confusion counts at the 95th-percentile threshold.

**The AST export is not in the repository.** Only a quick run exists (IDs 00 and 02, at most 150 clips per class, random split), kept outside the repo. See `presentation/README.md` for how it is used.

**These folders are the input for** `backend/scripts/build_registry.py` (the app's model registry), `presentation/prep_data.py` (the deck) and, through it, `report/make_figures.py`.

`archive/` holds the original zip files (gitignored).

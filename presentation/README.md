# Presentation

`AcousticSense_Anomaly_Detection.pptx` is generated, not hand-made.

- `prep_data.py <tag> <export_folder>` turns a notebook's `results_<tag>.csv`, `all_clip_scores_<tag>.csv`, `history_<tag>.csv` into `data/<tag>.json`.
- `build.js` builds the deck. Models without `data/<tag>.json` become blank slides ("RESULTS PENDING").
- `qa.py` checks that text fits and nothing leaves the slide (no renderer needed).

Rebuild after adding results (for the CAE, same CSV layout as the dense notebook):

```bash
cd /home/parallax/projects/AcousticSense
.venv/bin/python presentation/prep_data.py cae export_cae --split random
cd presentation && NODE_PATH=$PWD/node_modules node build.js
.venv/bin/python qa.py AcousticSense_Anomaly_Detection.pptx
```

`prep_data.py` already handles `dense`, `cae` and `sup` (for `sup` the main numbers are the augment=True runs). Pass `--split blocked|random|blocked*` so every slide shows the right split tag. The AST notebook writes a different CSV layout, so `prep_data.py` needs a small adapter for it.

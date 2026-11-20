# Report

A two-page, two-column paper in IEEE style: `AcousticSense_Report.pdf`.

- `report.html` is the source. Print it to PDF with headless Chrome (A4/Letter, no header or footer).
- `make_figures.py` draws the figures from the project's own results (`presentation/data/*.json`, see `presentation/README.md`). The t-SNE figure is `figures/fig4_tsne_fan02.png`, made from AST embeddings of local fan ID 02 clips.
- No external images are used. Every figure is original or comes from our own runs.

```bash
# from the project root, after the presentation data has been generated
.venv/bin/python report/make_figures.py
cd report && google-chrome --headless=new --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=AcousticSense_Report.pdf "file://$PWD/report.html"
```

The comparison in the paper is not like for like (dense: blocked split; CAE: random split; AST: quick run on two IDs). The paper says so.

// Builds AcousticSense_Anomaly_Detection_34slides.pptx
// Real data: data/dense.json (made by prep_data.py). Models without data (cae, ast, sup) become blank templates.
// When results arrive for a model, drop them in data/<tag>.json (same schema) and rebuild: node build.js
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { applyTheme } = require("/home/parallax/.claude/skills/synced/e1dda4d5-ca71-4f67-b7a4-670843eafdb9_cdb28aae-9d88-4792-8ba7-177777f44e36/pptx/scripts/apply_theme.js");

// ---------------------------------------------------------------- theme
const P = {
  navy: "0B2239", ink: "1B2B3A", blue: "1F6FB5", sky: "6FB1E6", amber: "F2A33A",
  red: "D9534F", green: "2E9E6B", slate: "6B7C8F", light: "F4F7FA", white: "FFFFFF",
  line: "D5DDE6", mute: "5C6B7A",
};
const THEME = {
  name: "AcousticSense", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: P.ink, lt1: P.white, dk2: P.navy, lt2: P.light, accent1: P.blue, accent2: P.sky,
            accent3: P.amber, accent4: P.red, accent5: P.green, accent6: P.slate, hlink: P.blue, folHlink: P.slate },
};
const MACH = ["fan", "pump", "slider", "valve"];
const MCOLOR = { fan: P.blue, pump: P.sky, slider: P.slate, valve: P.amber };
const FONT = "+mn-lt";

const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
const DATA = { dense: read("data/dense.json"), cae: read("data/cae.json"), ast: read("data/ast.json"), sup: read("data/sup.json") };
const PARAMS = read("data/params.json");
const fmt = (n) => n.toLocaleString("en-US");
const f3 = (v) => v.toFixed(3);
const pc = (v) => (100 * v).toFixed(1) + "%";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "Acoustic anomaly detection on MIMII";
pres.subject = "Unsupervised fault detection from machine sound";

// ---------------------------------------------------------------- layouts
pres.defineSlideMaster({
  title: "TITLE", background: { color: P.navy },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.35, w: 7.2, h: 1.9, fontSize: 52, bold: true, color: P.white, valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.45, w: 6.6, h: 1.2, fontSize: 22, color: "BFD6EA", valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: P.white },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 12.1, h: 0.8, fontSize: 32, bold: true, color: P.navy, valign: "top", margin: 0 }, text: "" } },
    { text: { text: "AcousticSense  |  MIMII acoustic anomaly detection", options: { x: 0.6, y: 7.05, w: 8, h: 0.3, fontSize: 10, color: P.mute, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.05, w: 0.63, h: 0.3, fontSize: 10, color: P.mute, align: "right" },
});

// ---------------------------------------------------------------- helpers
const SEC = {};
function newSlide(section, title, chipText, notes) {
  if (!SEC[section]) { pres.addSection({ title: section }); SEC[section] = true; }
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  if (chipText) chip(s, chipText);
  if (notes) s.addNotes(notes);
  return s;
}
function chip(s, text, color) {
  const w = 0.13 * text.length + 0.35;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.24, w, h: 0.3, fill: { color: color || P.blue }, rectRadius: 0.08, objectName: "Section chip" });
  s.addText(text, { x: 0.6, y: 0.24, w, h: 0.3, fontSize: 11, bold: true, color: P.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
}
function pending(s) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.55, y: 0.24, w: 2.18, h: 0.3, fill: { color: "FDEBD0" }, rectRadius: 0.08, objectName: "Pending tag" });
  s.addText("RESULTS PENDING", { x: 10.55, y: 0.24, w: 2.18, h: 0.3, fontSize: 11, bold: true, color: "7A4B00", align: "center", valign: "middle", margin: 0, isTextBox: true });
}
function protoTag(s, D) {
  const sp = D.protocol.split, strict = sp === "blocked";
  const label = sp === "blocked" ? "SPLIT: BLOCKED (strict)" : sp === "random" ? "SPLIT: RANDOM (not strict)" : sp === "random-quick" ? "QUICK RUN: RANDOM SPLIT" : "SPLIT: BLOCKED* (unverified)";
  const w = 2.95, x = 12.73 - w;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 0.24, w, h: 0.3, fill: { color: strict ? "D5F0E3" : "FDEBD0" }, rectRadius: 0.08, objectName: "Split tag" });
  s.addText(label, { x, y: 0.24, w, h: 0.3, fontSize: 11, bold: true, color: strict ? "1D6B47" : "7A4B00", align: "center", valign: "middle", margin: 0, isTextBox: true });
}
const splitText = (D) => (D.protocol.split === "blocked" ? "strict blocked split" : D.protocol.split === "random" ? "random split (not strict)" : D.protocol.split === "random-quick" ? "random split, quick run (up to 150 clips per class)" : "blocked split*");
const starNote = (D) => (D.protocol.split.endsWith("*") ? " *Notebook default; the export does not record the split." : "");
const sup4 = (D) => (D.tag === "sup" ? " Trained with faulty labels; test = 30% of each class." : "");
function autoText(D) {
  const cap = (m) => m[0].toUpperCase() + m.slice(1);
  const pm = D.per_machine, mis = D.mistakes;
  const ms = MACH.slice().sort((a, b) => pm[b].auc - pm[a].auc);
  const byMissed = MACH.slice().sort((a, b) => mis[b].missed_pct - mis[a].missed_pct)[0];
  const byFA = MACH.slice().sort((a, b) => mis[b].false_alarm_pct - mis[a].false_alarm_pct)[0];
  const faHigh = mis[byFA].false_alarm_pct >= 10;
  const runs = D.runs.slice().sort((a, b) => a.auc - b.auc), worst = runs[0];
  const easy = D.runs.filter((r) => r.auc >= 0.99).length;
  const idn = (r) => cap(r.machine) + " " + r.id.replace("id_", "ID ");
  return {
    headMetrics: `Best on ${cap(ms[0])}, weakest on ${cap(ms[3])}`,
    headRuns: "Every run: where it works and where it fails",
    headConf: faHigh && byFA !== byMissed ? `${cap(byMissed)} misses faults, ${cap(byFA)} raises alarms` : `${cap(byMissed)} misses the most faults`,
    headCurves: D.loss ? "Training curves and ranking quality" : "Ranking quality and score distribution",
    headMist: "Mistakes and comparison with the paper",
    runsNote: (D.protocol.ids ? "Quick run: " + D.protocol.ids + " were tested, so the other columns are empty. " : "") + `Hardest run: ${idn(worst)} (AUC ${worst.auc.toFixed(2)}, recall ${worst.recall.toFixed(2)}). ` + (easy ? `${easy} of ${D.runs.length} runs ${easy === 1 ? "reaches" : "reach"} AUC 0.99 or more.` : "No run reaches AUC 0.99."),
    confNote: faHigh && byFA === byMissed ? `${cap(byMissed)}: ${mis[byMissed].missed_pct.toFixed(0)}% of faults are missed and ${mis[byFA].false_alarm_pct.toFixed(0)}% of healthy clips raise a false alarm.`
      : `${cap(byMissed)}: ${mis[byMissed].missed_pct.toFixed(0)}% of faults are missed. ` + (faHigh ? `${cap(byFA)}: ${mis[byFA].false_alarm_pct.toFixed(0)}% of healthy clips raise a false alarm.` : "False alarms stay below 10% on every machine."),
    notesMetrics: `Mean over ${D.n_runs} runs. AUC ${f3(D.kpi.auc)}, balanced accuracy ${f3(D.kpi.bal_acc)}, recall ${f3(D.kpi.recall)}, false alarms ${pc(D.kpi.false_alarm)}. Split: ${D.protocol.split}.` + (D.variants ? ` Headline variant (chosen before running): pool + Mahalanobis. Other variants, e.g. l6 + Mahalanobis (${D.variants["l6+mahalanobis"]}), were found after seeing test results, so they are not used as the headline.` : ""),
    notesRuns: "Each cell is one run (one machine ID).", notesConf: "Rows are the true class. Counts below the percent.",
    notesCurves: "ROC per machine (curves of the runs, averaged) and average training/validation loss.",
    notesMist: "Missed faults and false alarms per machine from the pooled confusion matrices; right chart: ours vs the published dense autoencoder at 6 dB.",
  };
}

function txt(s, text, x, y, w, h, o = {}) {
  s.addText(text, Object.assign({ x, y, w, h, fontSize: 16, color: P.ink, margin: 0, valign: "top", isTextBox: true }, o));
}
function source(s, text) { txt(s, text, 0.6, 6.68, 12.1, 0.36, { fontSize: 10, color: P.mute }); }
function card(s, x, y, w, h, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill || P.light }, line: { color: P.line, width: 0.75 }, rectRadius: 0.1, objectName: "Card" });
}
function kpi(s, x, y, w, h, value, label, color, vsize) {
  card(s, x, y, w, h);
  txt(s, value, x + 0.2, y + 0.15, w - 0.4, h * 0.55, { fontSize: vsize || 38, bold: true, color: color || P.navy, valign: "middle" });
  txt(s, label, x + 0.2, y + h * 0.62, w - 0.4, h * 0.34, { fontSize: 14, color: P.mute });
}
function blend(a, b, t) {
  const ca = [0, 2, 4].map((i) => parseInt(a.substr(i, 2), 16)), cb = [0, 2, 4].map((i) => parseInt(b.substr(i, 2), 16));
  return ca.map((v, i) => Math.round(v + (cb[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
function dashed(s, x, y, w, h, label, sub) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: P.light }, line: { color: P.slate, width: 1.25, dashType: "dash" }, rectRadius: 0.1, objectName: "Placeholder: " + label });
  txt(s, label, x + 0.2, y + h / 2 - 0.45, w - 0.4, 0.5, { fontSize: 20, bold: true, color: P.slate, align: "center", valign: "middle" });
  txt(s, sub || "Add results to fill this panel", x + 0.2, y + h / 2 + 0.1, w - 0.4, 0.4, { fontSize: 14, color: P.mute, align: "center" });
}
async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
function chartBase(o = {}) {
  return Object.assign({
    catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, dataLabelFontFace: FONT, legendFontFace: FONT,
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, dataLabelFontSize: 11, legendFontSize: 12,
    catAxisLabelColor: P.ink, valAxisLabelColor: P.mute, dataLabelColor: P.ink, legendColor: P.ink,
    valGridLine: { color: "E3E8EE", size: 0.75 }, catGridLine: { style: "none" },
    showTitle: false,
  }, o);
}

// ---------------------------------------------------------------- architecture picture (horizontal bars)
function drawArch(s, bars, groups, box) {
  const { x, y, w, h } = box;
  const n = bars.length, pitch = w / n, bw = Math.min(0.72, pitch * 0.45);
  const lg = bars.map((b) => Math.log10(b.size));
  const lo = Math.min(...lg), hi = Math.max(...lg);
  const hmin = h * 0.2, hmax = h * 0.86, mid = y + h / 2;
  const col = { io: P.sky, hid: P.blue, lat: P.amber };
  bars.forEach((b, i) => {
    const hh = hmin + ((lg[i] - lo) / (hi - lo || 1)) * (hmax - hmin);
    const cx = x + pitch * (i + 0.5);
    s.addShape(pres.shapes.RECTANGLE, { x: cx - bw / 2, y: mid - hh / 2, w: bw, h: hh, fill: { color: col[b.kind] }, line: { color: col[b.kind], width: 0.5 }, objectName: "Layer " + (i + 1) });
    txt(s, b.label, cx - pitch / 2, mid - hh / 2 - 0.34, pitch, 0.3, { fontSize: 11, bold: b.kind === "lat", color: P.ink, align: "center", valign: "bottom" });
  });
  groups.forEach((g) => {
    const gx0 = x + pitch * g.from, gw0 = pitch * (g.to - g.from + 1);
    const gw = Math.max(gw0, 1.75), cx = gx0 + gw0 / 2;
    const gx = Math.min(Math.max(cx - gw / 2, 0.6), 12.75 - gw);
    txt(s, g.name, gx, y + h + 0.08, gw, 0.32, { fontSize: 15, bold: true, color: P.navy, align: "center" });
    if (g.cap) txt(s, g.cap, gx + 0.05, y + h + 0.4, gw - 0.1, 0.5, { fontSize: 11, color: P.mute, align: "center" });
  });
}
function archSlide(model, o) {
  const s = newSlide(model.section, o.title, model.chip, o.notes);
  drawArch(s, o.bars, o.groups, { x: 0.6, y: 1.75, w: 12.1, h: 2.85 });
  const stats = o.stats, cw = (12.1 - 0.3 * (stats.length - 1)) / stats.length;
  stats.forEach((st, i) => {
    const cx = 0.6 + i * (cw + 0.3);
    card(s, cx, 5.55, cw, 1.1);
    txt(s, st[0], cx + 0.15, 5.62, cw - 0.3, 0.45, { fontSize: 20, bold: true, color: P.navy, valign: "middle" });
    txt(s, st[1], cx + 0.15, 6.08, cw - 0.3, 0.5, { fontSize: 12, color: P.mute });
  });
  return s;
}

// ================================================================= 13-SLIDE DECK
const IMG = (f) => path.join(__dirname, "assets", f);
const Dn = DATA.dense, Cn = DATA.cae, An = DATA.ast, Sp = DATA.sup;
const cap1 = (m) => m[0].toUpperCase() + m.slice(1);
const f2 = (v) => v.toFixed(2);
function sub(s, text) { txt(s, text, 0.6, 1.4, 12.1, 0.35, { fontSize: 16, color: P.mute }); }
function dot(s, x, y, n, color, size) {
  const d = size || 0.55;
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: color || P.blue }, line: { color: P.white, width: 1.5 }, objectName: "Number " + n });
  s.addText(String(n), { x, y, w: d, h: d, fontSize: 18, bold: true, color: P.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
}
function sameIds(D) {
  const r = D.runs.filter((x) => ["id_00", "id_02"].includes(x.id));
  const m = (k) => r.reduce((a, x) => a + x[k], 0) / r.length;
  return { auc: m("auc"), pauc: m("pauc"), bal: m("bal_acc"), pub: m("published_auc"), n: r.length };
}
const sameD = sameIds(Dn), sameC = sameIds(Cn), sameA = sameIds(An);
const ds = Dn.dataset;
const nH = MACH.reduce((a, m) => a + ds[m].healthy, 0), nF = MACH.reduce((a, m) => a + ds[m].faulty, 0), nAll = nH + nF;
const SERIES = [["Dense (blocked)", Dn, P.blue], ["CAE (random)", Cn, P.amber], ["AST (quick run)", An, P.slate]];

function modelSlide(o) {
  const s = newSlide(o.section, o.title, null, o.notes);
  sub(s, o.sub);
  protoTag(s, o.D);
  drawArch(s, o.bars, o.groups, { x: 0.6, y: 1.95, w: 12.1, h: 2.4 });
  const y = 5.3, h = 1.3;
  card(s, 0.6, y, 2.9, h);
  txt(s, o.paramValue, 0.8, y + 0.1, 2.5, 0.55, { fontSize: 30, bold: true, color: P.navy, valign: "middle" });
  txt(s, o.paramLabel, 0.8, y + 0.72, 2.5, 0.5, { fontSize: 13, color: P.mute });
  card(s, 3.75, y, 4.45, h);
  txt(s, "Hypothesis", 3.95, y + 0.1, 4.05, 0.3, { fontSize: 14, bold: true, color: P.blue });
  txt(s, o.hypo, 3.95, y + 0.42, 4.05, 0.85, { fontSize: 14 });
  card(s, 8.45, y, 4.25, h);
  txt(s, "Observed", 8.65, y + 0.1, 3.85, 0.3, { fontSize: 14, bold: true, color: "B26A00" });
  txt(s, o.observed, 8.65, y + 0.42, 3.85, 0.85, { fontSize: 14 });
  source(s, o.src);
  return s;
}

(async () => {
  // ---------- 1 title
  pres.addSection({ title: "Introduction" }); SEC["Introduction"] = true;
  {
    const s = pres.addSlide({ masterName: "TITLE", sectionTitle: "Introduction" });
    s.addText("Listening for faults", { placeholder: "title" });
    s.addText("Dense autoencoder, convolutional autoencoder and pretrained embeddings on MIMII", { placeholder: "body" });
    const n = 34, x0 = 8.2, bw = 0.09, pitch = 0.145;
    for (let i = 0; i < n; i++) {
      const env = Math.sin((i / (n - 1)) * Math.PI);
      const hh = 0.25 + 3.2 * env * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
      s.addShape(pres.shapes.RECTANGLE, { x: x0 + i * pitch, y: 3.75 - hh / 2, w: bw, h: hh, fill: { color: i === 22 ? P.amber : (i % 3 === 0 ? P.sky : P.blue) }, line: { color: P.navy, width: 0 }, objectName: "Waveform bar " + (i + 1) });
    }
    const au = (rows, x) => s.addText(rows.flatMap((r, i) => [
      { text: r[0] + "  ", options: { bold: true, color: "EAF2FA", fontSize: 15 } },
      { text: r[1], options: { color: "8FB3D3", fontSize: 13, breakLine: i < rows.length - 1 } }]), { x, y: 5.6, w: 3.7, h: 0.7, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 });
    au([["Aaditya Pyarla", "24BCS003"], ["Nirmal Kattady", "24BCS174"]], 0.8);
    au([["Raja Kumar", "24BSM050"], ["Deepak Choudhary", "24BSM018"]], 4.6);
    s.addText("Indian Institute of Information Technology, Design and Manufacturing, Jabalpur", { x: 0.8, y: 6.4, w: 7.2, h: 0.5, fontSize: 13, color: "BFD6EA", margin: 0, valign: "top", isTextBox: true });
    s.addText("17 November 2026", { x: 0.8, y: 6.9, w: 4, h: 0.3, fontSize: 13, color: "8FB3D3", margin: 0, isTextBox: true });
    s.addNotes("This project asks whether a machine's sound alone can tell us it is about to fail, using only recordings of healthy operation. I compare three ways to model 'normal': a dense autoencoder, a convolutional autoencoder, and frozen pretrained embeddings. I'll show what each assumes, what we measured, and, importantly, where our results did not match what theory predicts. Evaluation honesty is a theme throughout.");
  }

  // ---------- 2 problem
  {
    const s = newSlide("Introduction", "Faults are rare: train on healthy sound only", null,
      `In a real plant you cannot collect many labelled failures, and the next failure may sound different from the last. So we frame this as one-class learning: learn what healthy sounds like and flag deviations. Our data shows why: only ${Math.round((100 * nF) / nAll)}% of the clips we used are faulty, and for pump and valve there are roughly eight healthy clips for every faulty one.`);
    sub(s, "Problem statement and motivation");
    const rows = [["Failures are rare, and labels are scarcer", "A plant rarely has many labelled failures."], ["The next fault may not sound like the last", "A classifier only knows the faults it has seen."], ["So we learn 'normal' and flag deviations", "One-class learning: no faulty clips in training."]];
    rows.forEach((r, i) => {
      const y = 2.0 + i * 1.5;
      card(s, 0.6, y, 6.1, 1.3);
      dot(s, 0.85, y + 0.37, i + 1);
      txt(s, r[0], 1.65, y + 0.1, 4.9, 0.66, { fontSize: 18, bold: true, color: P.navy, valign: "middle" });
      txt(s, r[1], 1.65, y + 0.82, 4.9, 0.4, { fontSize: 14, color: P.mute });
    });
    kpi(s, 7.0, 2.0, 5.7, 1.2, (nH / nF).toFixed(1) + " : 1", "healthy to faulty clips in our data");
    txt(s, "Healthy clips for every faulty clip", 7.0, 3.4, 5.7, 0.35, { fontSize: 18, bold: true, color: P.navy });
    s.addChart(pres.charts.BAR, [{ name: "Ratio", labels: MACH.map(cap1), values: MACH.map((m) => +(ds[m].healthy / ds[m].faulty).toFixed(1)) }],
      chartBase({ x: 6.9, y: 3.75, w: 5.9, h: 2.9, barDir: "col", chartColors: [P.blue, P.blue, P.blue, P.amber], showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 0, valAxisMaxVal: 10, barGapWidthPct: 55 }));
    source(s, "Counts from the MIMII paper (Table 1) for the IDs we used: " + fmt(nH) + " healthy and " + fmt(nF) + " faulty clips.");
  }

  // ---------- 3 dataset
  pres.addSection({ title: "Method" }); SEC["Method"] = true;
  {
    const s = newSlide("Method", `MIMII: 4 machines, ${fmt(nAll)} clips used`, null,
      "MIMII records four machine types, seven units of each, with factory noise mixed in at three levels. We used four IDs per machine at the 6 dB level, one microphone, so 18,019 clips. On the spectrograms, a steady fan hum looks nearly identical when faulty. That is the core difficulty: the difference is subtle and sits on top of background noise.");
    sub(s, "Dataset and exploratory view");
    s.addImage({ path: IMG("example_spectrograms_fan_id00.png"), x: 0.6, y: 1.95, w: 7.4, h: (7.4 * 426) / 1308, altText: "Log-mel spectrograms of a healthy and a faulty fan clip (fan ID 00)" });
    txt(s, "Fan ID 00, same colour scale: healthy (left) and faulty (right). The difference is subtle.", 0.6, 4.45, 7.4, 0.3, { fontSize: 12, color: P.mute });
    const kw = (7.4 - 0.4) / 3;
    [[fmt(nAll), "clips (56% of 32,157)"], ["10 s, 16 kHz", "per clip, microphone 1 of 8"], ["6 dB", "noise level; IDs 00, 02, 04, 06"]].forEach((k, i) => kpi(s, 0.6 + i * (kw + 0.2), 4.9, kw, 1.7, k[0], k[1], undefined, 26));
    txt(s, "Clips used, by machine", 8.4, 1.95, 4.3, 0.35, { fontSize: 18, bold: true, color: P.navy });
    s.addChart(pres.charts.BAR, [
      { name: "Healthy", labels: MACH.map(cap1), values: MACH.map((m) => ds[m].healthy) },
      { name: "Faulty", labels: MACH.map(cap1), values: MACH.map((m) => ds[m].faulty) },
    ], chartBase({ x: 8.3, y: 2.3, w: 4.5, h: 4.3, barDir: "bar", barGrouping: "stacked", chartColors: [P.green, P.red], showLegend: true, legendPos: "b", showValue: true, dataLabelPosition: "ctr", dataLabelColor: P.white, dataLabelFormatCode: "#,##0", valAxisLabelFormatCode: "#,##0", barGapWidthPct: 45, catAxisOrientation: "maxMin" }));
    source(s, "Machine types: fan, pump, slide rail (slider), valve; 7 IDs each, 4 used. Source: MIMII paper (Purohit et al., 2019), Table 1.");
  }

  // ---------- 4 preprocessing
  {
    const s = newSlide("Method", "From waveform to model input", null,
      "Every model sees the same sound but a different view. The dense network sees five neighbouring time frames flattened into a vector. The CAE sees the whole 2-second picture. AST uses its own spectrogram front end. One detail matters for honesty: we split by whole clip before cutting windows, so no clip appears in both training and test.");
    sub(s, "Audio preprocessing pipeline");
    const steps = [["10 s clip", "microphone 1 of 8"], ["2 s windows", "1 s step"], ["Log-mel", "128 bands, FFT 1024, hop 512"], ["Picture", "128 mel x 64 frames"]];
    const pw = 2.55, pg = (12.1 - 4 * pw) / 3;
    steps.forEach((t, i) => {
      const x = 0.6 + i * (pw + pg);
      card(s, x, 1.95, pw, 1.15, P.light);
      txt(s, t[0], x + 0.15, 2.05, pw - 0.3, 0.45, { fontSize: 18, bold: true, color: P.navy, align: "center", valign: "middle" });
      txt(s, t[1], x + 0.15, 2.52, pw - 0.3, 0.5, { fontSize: 13, color: P.mute, align: "center" });
      if (i < 3) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + pw + pg * 0.1, y: 2.4, w: pg * 0.8, h: 0.3, fill: { color: P.slate }, line: { color: P.slate, width: 0 }, objectName: "Arrow " + (i + 1) });
    });
    txt(s, "What each model receives", 0.6, 3.35, 12.1, 0.35, { fontSize: 18, bold: true, color: P.navy });
    const cards = [["Dense AE", "640 numbers", "5 neighbouring frames, flattened. Each mel band is standardised with the train mean and spread.", P.blue], ["CAE", "128 x 64 x 1", "The whole picture. Min-max scaled to 0 to 1, with numbers from the train set only.", P.amber], ["AST embeddings", "1024 x 128", "The model's own spectrogram front end. The network is frozen: it only reads.", P.slate]];
    const cw = (12.1 - 0.6) / 3;
    cards.forEach((c, i) => {
      const x = 0.6 + i * (cw + 0.3);
      card(s, x, 3.8, cw, 2.1);
      s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 3.98, w: 0.22, h: 0.22, fill: { color: c[3] }, line: { color: c[3], width: 0 }, objectName: "Model colour " + (i + 1) });
      txt(s, c[0], x + 0.55, 3.92, cw - 0.75, 0.35, { fontSize: 16, bold: true, color: P.navy, valign: "middle" });
      txt(s, c[1], x + 0.2, 4.35, cw - 0.4, 0.6, { fontSize: 28, bold: true, color: P.navy, valign: "middle" });
      txt(s, c[2], x + 0.2, 5.0, cw - 0.4, 0.85, { fontSize: 14 });
    });
    card(s, 0.6, 6.05, 12.1, 0.55, "EAF2FA");
    txt(s, "We split by whole clip before cutting windows: no clip is ever in two sets.", 0.85, 6.05, 11.6, 0.55, { fontSize: 16, bold: true, color: P.navy, valign: "middle" });
  }

  // ---------- 5 scoring paradigm
  {
    const s = newSlide("Method", "Score = how far from healthy", null,
      "A model trained only on healthy sound should reproduce it well and reproduce faults badly. We turn that into a score per window and average per clip. The threshold comes only from healthy validation clips, so about 5% of healthy clips raise a false alarm by design. Faulty clips are used only for testing.");
    sub(s, "Unsupervised anomaly scoring");
    txt(s, "Test scores, divided by each run's threshold", 0.6, 1.95, 7.0, 0.35, { fontSize: 18, bold: true, color: P.navy });
    const H = Dn.scorehist;
    s.addChart(pres.charts.BAR, [
      { name: "Healthy clips", labels: H.labels, values: H.healthy.map((v) => +(100 * v).toFixed(1)) },
      { name: "Faulty clips", labels: H.labels, values: H.faulty.map((v) => +(100 * v).toFixed(1)) },
    ], chartBase({ x: 0.5, y: 2.3, w: 7.2, h: 4.3, barDir: "col", chartColors: [P.green, P.red], showLegend: true, legendPos: "b", catAxisLabelFontSize: 10, catAxisLabelFrequency: 2, valAxisMinVal: 0,
      showCatAxisTitle: true, catAxisTitle: "Score / threshold (1.0 = alarm line)", showValAxisTitle: true, valAxisTitle: "Share of clips (%)", catAxisTitleFontSize: 12, valAxisTitleFontSize: 12,
      catAxisTitleColor: P.mute, valAxisTitleColor: P.mute, catAxisTitleFontFace: FONT, valAxisTitleFontFace: FONT, barGapWidthPct: 15 }));
    const steps = ["Train on healthy clips only", "Score each window: copy error (autoencoders) or distance to healthy (embeddings)", "Clip score = average of its windows", "Alarm if above the 95th percentile of healthy validation scores"];
    steps.forEach((t, i) => {
      const y = 2.0 + i * 0.95;
      dot(s, 8.1, y + 0.1, i + 1, P.blue, 0.5);
      txt(s, t, 8.8, y, 3.9, 0.75, { fontSize: 15, valign: "middle" });
    });
    card(s, 8.1, 5.85, 4.6, 0.75, "EAF2FA");
    txt(s, "About 5% of healthy clips alarm by design. Faulty clips only test the model.", 8.25, 5.85, 4.3, 0.75, { fontSize: 13, color: P.navy, valign: "middle" });
    source(s, "Dense autoencoder, 16 runs, strict blocked split. The last bin holds scores of 3.75 and above.");
  }

  // ---------- 6-8 models
  pres.addSection({ title: "Models" }); SEC["Models"] = true;
  modelSlide({
    section: "Models", D: Dn, title: "Dense autoencoder: the baseline", sub: "Architecture 1: 5 frames flattened to 640 numbers",
    notes: "This is the benchmark family from the MIMII paper. Flattening turns a small time-frequency patch into a vector, so the network has no notion that neighbouring bands or frames are related, and it sees only about 0.2 seconds at a time. In theory that is a weakness. In practice it scored 0.913 AUC under our strictest split, above the published baseline of 0.816. Theory and data disagree here, and that is worth discussing.",
    bars: [640, 1024, 512, 256, 128, 16, 128, 256, 512, 1024, 640].map((v, i) => ({ label: String(v), size: v, kind: i === 0 || i === 10 ? "io" : i === 5 ? "lat" : "hid" })),
    groups: [{ name: "Input", from: 0, to: 0 }, { name: "Encoder", from: 1, to: 4, cap: "Dense + BatchNorm + ReLU" }, { name: "Latent space", from: 5, to: 5 }, { name: "Decoder", from: 6, to: 9, cap: "Dense + BatchNorm + ReLU" }, { name: "Reconstruction", from: 10, to: 10 }],
    paramValue: (PARAMS.dense[0] / 1e6).toFixed(1) + "M", paramLabel: "parameters (" + (PARAMS.dense[1] / 1e6).toFixed(2) + "M trainable)",
    hypo: "Flattening discards the 2-D layout: neighbouring bands and frames become unrelated inputs.",
    observed: `AUC ${f3(Dn.kpi.auc)}, pAUC ${f3(Dn.kpi.pauc)} on the strict blocked split. Above the published baseline (0.816).`,
    src: "16 runs, 6 dB, IDs 00, 02, 04, 06. Published baseline: MIMII paper dense autoencoder, all IDs.",
  });
  const cs = [[128, 64, 1], [64, 32, 32], [32, 16, 64], [16, 8, 128], [8, 4, 256], 32, [8, 4, 256], [16, 8, 128], [32, 16, 64], [64, 32, 32], [128, 64, 16], [128, 64, 1]];
  modelSlide({
    section: "Models", D: Cn, title: "Convolutional autoencoder", sub: "Architecture 2: shared filters over time and frequency",
    notes: "Convolution shares filters across the picture, so a pattern is learned once and detected anywhere, and it needs fewer parameters than the dense network. We expected it to beat dense. It did not: 0.889 on a random split, and 0.836 versus 0.887 for dense on the same two IDs. Two caveats: it never converged within the 60-epoch cap, and its normalisation differs from the dense model. We did not test which factor matters.",
    bars: cs.map((v, i) => ({ label: Array.isArray(v) ? "(" + v.join(",") + ")" : String(v), size: Array.isArray(v) ? v[0] * v[1] * v[2] : v, kind: i === 0 || i === 11 ? "io" : i === 5 ? "lat" : "hid" })),
    groups: [{ name: "Input", from: 0, to: 0 }, { name: "Encoder", from: 1, to: 4, cap: "Conv 3x3, stride 2 + BatchNorm + LeakyReLU" }, { name: "Latent", from: 5, to: 5 }, { name: "Decoder", from: 6, to: 10, cap: "Transposed conv 3x3, stride 2 + BatchNorm + LeakyReLU" }, { name: "Output", from: 11, to: 11 }],
    paramValue: (PARAMS.cae[0] / 1e6).toFixed(1) + "M", paramLabel: "parameters (" + (PARAMS.cae[1] / 1e6).toFixed(2) + "M trainable)",
    hypo: "Shared filters capture local time-frequency patterns anywhere in the picture, with fewer parameters.",
    observed: `AUC ${f3(Cn.kpi.auc)} (random split). IDs 00 + 02: ${f3(sameC.auc)} vs dense ${f3(sameD.auc)}. Ran to the 60-epoch cap in all runs.`,
    src: "16 runs, 6 dB. Random split: not strict. No skip connections; sigmoid output; 32-number bottleneck.",
  });
  modelSlide({
    section: "Models", D: An, title: "Pretrained AST embeddings", sub: "Architecture 3: no reconstruction, only distance to healthy",
    notes: "An autoencoder can over-generalise and reconstruct faults almost as well as healthy sound. A pretrained embedding sidesteps that: we never reconstruct, we only measure distance to healthy clips. It did well on slider and pump, 0.99 and 0.96 AUC, but failed on fan ID 00 at 0.56, and valve recall stayed at 0.20. This was a quick run on two IDs, so treat it as indicative.",
    bars: [{ label: "(1024,128)", size: 131072, kind: "io" }, { label: "(1212,768)", size: 930816, kind: "hid" }, { label: "12 blocks", size: 930816, kind: "hid" }, { label: "768", size: 768, kind: "lat" }, { label: "1 score", size: 4, kind: "io" }],
    groups: [{ name: "Spectrogram", from: 0, to: 0, cap: "1024 frames x 128 mel" }, { name: "Patch embedding", from: 1, to: 1, cap: "1212 patches" }, { name: "Frozen transformer", from: 2, to: 2, cap: "12 attention blocks" }, { name: "Embedding", from: 3, to: 3, cap: "768 numbers per clip" }, { name: "Score", from: 4, to: 4, cap: "Mahalanobis distance to healthy" }],
    paramValue: (PARAMS.ast[0] / 1e6).toFixed(1) + "M", paramLabel: "parameters, all frozen (no training)",
    hypo: "No reconstruction, so no over-generalisation: a clip is judged by its distance to healthy clips.",
    observed: `AUC ${f3(An.kpi.auc)} (quick run, IDs 00 + 02). Slider ${f2(An.per_machine.slider.auc)}, pump ${f2(An.per_machine.pump.auc)}; fan ID 00 only 0.56.`,
    src: "Quick run: 8 runs, up to 150 clips per class, random split. Headline: pooled embedding + Mahalanobis (chosen before running).",
  });

  // ---------- 9 setup and metrics
  pres.addSection({ title: "Evaluation" }); SEC["Evaluation"] = true;
  {
    const s = newSlide("Evaluation", "16 runs, one model each, two kinds of split", null,
      "AUC measures ranking over all thresholds. pAUC restricts to low false-alarm rates, which is what a plant would tolerate. The split matters enormously: clips from one recording session share noise, so a random split can leak that session into training. A blocked split, cutting by file order, is stricter. My guess is that file order follows recording time, but I have not verified that.");
    sub(s, "Experimental setup and evaluation metrics");
    s.addImage({ path: IMG("roc_pauc.png"), x: 0.6, y: 1.95, w: 5.3, h: (5.3 * 3.3) / 5.6, altText: "ROC curve with the region of false alarms up to 10% shaded" });
    card(s, 0.6, 5.2, 5.3, 1.4);
    txt(s, [
      { text: "16 runs: 4 machines x 4 IDs, one model per run", options: { bullet: true, breakLine: true } },
      { text: "Healthy clips: 70% train, 10% validation, 20% test", options: { bullet: true, breakLine: true } },
      { text: "All faulty clips are in the test set", options: { bullet: true } },
    ], 0.8, 5.28, 5.0, 1.25, { fontSize: 14, valign: "middle", paraSpaceAfter: 2 });
    const mx = 6.4;
    [["AUC", "ranking quality over all thresholds. 0.5 = guess, 1.0 = perfect."], ["pAUC", "the same, but only for false alarms up to 10% (the shaded strip). 0.5 = guess."], ["Also", "recall, false-alarm rate and balanced accuracy at the 95th-percentile threshold."]].forEach((m, i) => {
      const y = 1.95 + i * 0.62;
      txt(s, [{ text: m[0] + ": ", options: { bold: true, color: P.navy } }, { text: m[1], options: {} }], mx, y, 6.3, 0.58, { fontSize: 14, valign: "middle" });
    });
    txt(s, "How the healthy clips are split", mx, 3.9, 6.3, 0.35, { fontSize: 18, bold: true, color: P.navy });
    const N = 24, cx0 = 7.8, cw = 4.9 / N;
    const randTest = [3, 8, 13, 18, 22], randVal = [6, 15];
    const colorOf = (kind) => ({ T: P.blue, V: P.amber, E: P.green }[kind]);
    const rowFor = (y, label, kindAt) => {
      txt(s, label, mx, y, 1.3, 0.4, { fontSize: 14, bold: true, valign: "middle" });
      for (let i = 0; i < N; i++) s.addShape(pres.shapes.RECTANGLE, { x: cx0 + i * cw, y, w: cw - 0.025, h: 0.4, fill: { color: colorOf(kindAt(i)) }, line: { color: P.white, width: 0 }, objectName: label + " clip " + (i + 1) });
    };
    rowFor(4.35, "Random", (i) => (randTest.includes(i) ? "E" : randVal.includes(i) ? "V" : "T"));
    rowFor(4.9, "Blocked", (i) => (i < 17 ? "T" : i < 19 ? "V" : "E"));
    [["Train", P.blue], ["Validation", P.amber], ["Test", P.green]].forEach((l, i) => {
      s.addShape(pres.shapes.RECTANGLE, { x: cx0 + i * 1.6, y: 5.5, w: 0.2, h: 0.2, fill: { color: l[1] }, line: { color: l[1], width: 0 }, objectName: "Legend " + l[0] });
      txt(s, l[0], cx0 + i * 1.6 + 0.3, 5.45, 1.2, 0.3, { fontSize: 12, valign: "middle" });
    });
    txt(s, "Random: test clips sit between training clips of the same recording session, which can leak it. Blocked: test clips come from a later stretch of files.", mx, 5.85, 6.3, 0.75, { fontSize: 13, color: P.mute });
    source(s, "Threshold = 95th percentile of healthy validation scores; faulty clips never set it. Blocked split: first 70% of files train, next 10% validation, last 20% test.");
  }

  // ---------- 10 comparison
  {
    const s = newSlide("Evaluation", "No clean winner: the protocol matters", null,
      "Here are the numbers, with the caveat on the slide. Dense used the strict split and still led. CAE and AST used easier splits and did not beat it. On identical IDs the gap narrows to 0.012 between dense and AST. So I will not claim a winner. What I can say: none of the sophisticated alternatives clearly beat the simple baseline, and all models beat the published reference.");
    sub(s, "Quantitative comparison");
    const hdr = ["Model", "Split", "Runs", "Parameters", "AUC", "pAUC", "Bal. acc.", "Recall", "False alarm"].map((t, i) => ({ text: t, options: { bold: true, color: P.white, fill: { color: P.navy }, align: i < 2 ? "left" : "center", fontSize: 14 } }));
    const rows = [hdr];
    [["Dense autoencoder", Dn, PARAMS.dense[0], "Blocked (strict)"], ["Convolutional AE (CAE)", Cn, PARAMS.cae[0], "Random"], ["AST embeddings", An, PARAMS.ast[0], "Random, quick run"]].forEach((d) => {
      const k = d[1].kpi, warn = d[1].protocol.split !== "blocked", c = (v) => ({ text: v, options: { align: "center", fontSize: 14, color: P.ink, bold: true } });
      rows.push([{ text: d[0], options: { bold: true, fontSize: 14, color: P.ink } }, { text: d[3], options: { fontSize: 14, bold: true, color: warn ? "7A4B00" : P.ink, fill: warn ? { color: "FDEBD0" } : undefined } },
        c(String(d[1].n_runs)), c(fmt(d[2])), c(f3(k.auc)), c(f3(k.pauc)), c(f3(k.bal_acc)), c(f3(k.recall)), c(pc(k.false_alarm))]);
    });
    const g = (v) => ({ text: v, options: { align: "center", fontSize: 14, color: P.mute } });
    rows.push([{ text: "Published dense AE (MIMII paper)", options: { fontSize: 14, color: P.mute, italic: true } }, { text: "Paper protocol", options: { fontSize: 14, color: P.mute } }, g("all IDs"), g("—"), g("0.816"), g("—"), g("—"), g("—"), g("—")]);
    s.addTable(rows, { x: 0.6, y: 1.9, w: 12.1, colW: [2.9, 2.0, 0.8, 1.5, 0.9, 0.9, 1.0, 0.9, 1.2], rowH: 0.45, border: { type: "solid", color: P.line, pt: 0.75 }, valign: "middle", margin: [0, 0.1, 0, 0.1] });
    txt(s, "Mean AUC per machine", 0.6, 4.3, 6.2, 0.35, { fontSize: 16, bold: true, color: P.navy });
    s.addChart(pres.charts.BAR, SERIES.map((h) => ({ name: h[0], labels: MACH.map(cap1), values: MACH.map((m) => +h[1].per_machine[m].auc.toFixed(3)) })),
      chartBase({ x: 0.5, y: 4.6, w: 6.5, h: 2.05, barDir: "col", chartColors: SERIES.map((h) => h[2]), showLegend: true, legendPos: "r", legendFontSize: 11, showValue: false, valAxisMinVal: 0.4, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.2, catAxisLabelFontSize: 11, barGapWidthPct: 40 }));
    card(s, 7.3, 4.3, 5.4, 2.3);
    txt(s, "Same 8 runs only (IDs 00 + 02)", 7.5, 4.36, 5.0, 0.35, { fontSize: 16, bold: true, color: P.navy });
    const mh = ["Model", "AUC", "pAUC", "Bal. acc."].map((t, i) => ({ text: t, options: { bold: true, color: P.white, fill: { color: P.navy }, align: i ? "center" : "left", fontSize: 12 } }));
    const mc = (v, b) => ({ text: v, options: { align: "center", fontSize: 12, bold: !!b, color: P.ink } });
    s.addTable([mh,
      [{ text: "Dense (blocked)", options: { fontSize: 12, bold: true } }, mc(f3(sameD.auc), 1), mc(f3(sameD.pauc)), mc(f3(sameD.bal))],
      [{ text: "CAE (random)", options: { fontSize: 12, bold: true } }, mc(f3(sameC.auc), 1), mc(f3(sameC.pauc)), mc(f3(sameC.bal))],
      [{ text: "AST (quick run)", options: { fontSize: 12, bold: true } }, mc(f3(sameA.auc), 1), mc(f3(sameA.pauc)), mc(f3(sameA.bal))],
      [{ text: "Published (paper)", options: { fontSize: 12, italic: true, color: P.mute } }, mc(f3(sameD.pub)), mc("—"), mc("—")],
    ], { x: 7.5, y: 4.75, w: 5.0, colW: [2.2, 0.9, 0.9, 1.0], rowH: 0.31, border: { type: "solid", color: P.line, pt: 0.75 }, valign: "middle", margin: [0, 0.08, 0, 0.08] });
    txt(s, "Different splits: not strictly comparable.", 7.5, 6.35, 5.0, 0.25, { fontSize: 12, bold: true, color: "7A4B00" });
    source(s, "Dense, CAE: 16 runs. AST: quick run, 8 runs. Amber split cells = not the strict protocol. Published: MIMII paper, 6 dB average over 7 IDs.");
  }

  // ---------- 11 visual error analysis
  {
    const s = newSlide("Evaluation", "Where the models disagree", null,
      "Overlaying the ROC curves shows the pattern: on slider and pump the models are close, on valve all three sit near the diagonal at low false-alarm rates. The t-SNE shows whether faulty clips form their own region or sit inside the healthy cloud. For fan, they sit inside it. I would stress that t-SNE is illustrative only; distances in it are not evidence of separability.");
    sub(s, "ROC per machine and latent space");
    txt(s, [{ text: "● ", options: { color: P.blue, bold: true } }, { text: "Dense (blocked)    ", options: {} }, { text: "● ", options: { color: P.amber, bold: true } }, { text: "CAE (random)    ", options: {} }, { text: "● ", options: { color: P.slate, bold: true } }, { text: "AST (quick run)", options: {} }], 6.2, 1.4, 6.5, 0.35, { fontSize: 13, align: "right" });
    const pos = [[0.5, 1.95], [4.5, 1.95], [0.5, 4.25], [4.5, 4.25]];
    MACH.forEach((m, i) => {
      const [x, y] = pos[i];
      txt(s, cap1(m), x + 0.1, y, 3.8, 0.3, { fontSize: 15, bold: true, color: P.navy });
      const xs = Dn.roc.fpr;
      s.addChart(pres.charts.SCATTER, [{ name: "fpr", values: xs }, { name: "Dense", values: Dn.roc[m] }, { name: "CAE", values: Cn.roc[m] }, { name: "AST", values: An.roc[m] }, { name: "Chance", values: xs }],
        chartBase({ x, y: y + 0.28, w: 4.0, h: 1.9, chartColors: [P.blue, P.amber, P.slate, P.line], lineSize: 2, lineDataSymbol: "none", showLegend: false,
          valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.5, catAxisMinVal: 0, catAxisMaxVal: 1, catAxisMajorUnit: 0.5, valAxisLabelFormatCode: "0.0", catAxisLabelFormatCode: "0.0",
          catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, valGridLine: { color: "E3E8EE", size: 0.75 }, catGridLine: { color: "E3E8EE", size: 0.75 } }));
    });
    s.addImage({ path: IMG("tsne_fan02.png"), x: 8.95, y: 1.95, w: 3.75, h: (3.75 * 3.9) / 4.0, altText: "t-SNE of AST embeddings for fan ID 02: faulty clips lie among healthy clips" });
    txt(s, "t-SNE of AST embeddings, fan ID 02 (local recordings, 1,375 clips). Faulty clips sit inside the healthy cloud. Illustrative only.", 8.95, 5.7, 3.75, 0.9, { fontSize: 12, color: P.mute });
    source(s, "ROC: x = false alarm rate, y = faults caught; averaged over each machine's runs. The t-SNE uses local fan recordings, not the Kaggle run.");
  }

  // ---------- 12 trade-offs and failure cases
  {
    const s = newSlide("Evaluation", "Accuracy versus cost, and where it fails", null,
      "The cheapest model, dense, was also the strongest, which is an engineering argument for the baseline. AST costs 86 million parameters but needs no training. The failure cases are consistent: valve faults are short events, and my hypothesis, untested, is that averaging over a window hides them. Fan ID 00 ranks well yet catches only 28% of faults at our threshold. Latency per clip I have not measured, so I will not claim it.");
    sub(s, "Engineering trade-offs and failure cases");
    const mins = (D) => (D.total_minutes / D.n_runs).toFixed(1);
    const ep = (D) => { const e = D.runs.map((r) => r.epochs); return Math.min(...e) === Math.max(...e) ? `${Math.min(...e)} epochs` : `${Math.min(...e)} to ${Math.max(...e)} epochs`; };
    const th = (t) => ({ text: t, options: { bold: true, color: P.white, fill: { color: P.navy }, align: t === "Model" ? "left" : "center", fontSize: 13 } });
    const tc = (t, o) => ({ text: t, options: Object.assign({ align: "center", fontSize: 13, color: P.ink }, o || {}) });
    s.addTable([
      [th("Model"), th("Parameters"), th("Training per run"), th("Latency per clip")],
      [{ text: "Dense AE", options: { bold: true, fontSize: 13 } }, tc((PARAMS.dense[0] / 1e6).toFixed(1) + "M"), tc(mins(Dn) + " min (" + ep(Dn) + ")"), tc("not measured", { color: P.mute })],
      [{ text: "CAE", options: { bold: true, fontSize: 13 } }, tc((PARAMS.cae[0] / 1e6).toFixed(1) + "M"), tc(mins(Cn) + " min (" + ep(Cn) + ", the cap)"), tc("not measured", { color: P.mute })],
      [{ text: "AST", options: { bold: true, fontSize: 13 } }, tc((PARAMS.ast[0] / 1e6).toFixed(1) + "M, frozen"), tc("none (embedding pass only)"), tc("not measured", { color: P.mute })],
    ], { x: 0.6, y: 1.95, w: 6.1, colW: [1.1, 1.5, 2.4, 1.1], rowH: [0.45, 0.62, 0.62, 0.62], border: { type: "solid", color: P.line, pt: 0.75 }, valign: "middle", margin: [0, 0.08, 0, 0.08] });
    card(s, 0.6, 4.6, 6.1, 2.0, "EAF2FA");
    txt(s, [
      { text: "The cheapest model was also the strongest.", options: { bold: true, color: P.navy, breakLine: true } },
      { text: `AST is ${Math.round(PARAMS.ast[0] / PARAMS.dense[0])} times larger than dense and needs no training, but did not score higher. The CAE never stopped early: it may be undertrained.`, options: {} },
    ], 0.8, 4.6, 5.7, 2.0, { fontSize: 15, valign: "middle" });
    const fan0 = (D) => D.runs.find((r) => r.machine === "fan" && r.id === "id_00");
    const cards = [
      ["Valve", `Recall ${f2(Dn.per_machine.valve.recall)} (dense), ${f2(Cn.per_machine.valve.recall)} (CAE), ${f2(An.per_machine.valve.recall)} (AST). Hypothesis, untested: short events are averaged away.`],
      ["Fan ID 00", `Dense AUC ${f2(fan0(Dn).auc)} but recall ${f2(fan0(Dn).recall)}. AST AUC ${f2(fan0(An).auc)}.`],
      ["Pump false alarms", `Dense: ${Dn.mistakes.pump.false_alarm_pct.toFixed(0)}% of healthy pump clips raise an alarm.`],
      ["Split and noise", `Supervised quick runs: balanced accuracy 0.86 random vs 0.71 blocked. Published AUC falls 0.82 to 0.64 from 6 to -6 dB; we ran 6 dB only.`],
    ];
    cards.forEach((c, i) => {
      const x = 7.0 + (i % 2) * 2.95, y = 1.95 + Math.floor(i / 2) * 2.35;
      card(s, x, y, 2.75, 2.2);
      txt(s, c[0], x + 0.15, y + 0.12, 2.45, 0.35, { fontSize: 16, bold: true, color: P.navy });
      txt(s, c[1], x + 0.15, y + 0.52, 2.45, 1.6, { fontSize: 13 });
    });
    source(s, "Latency was not measured. Training time: dense 26 to 66 epochs with early stopping; CAE always reached the 60-epoch cap.");
  }

  // ---------- 13 conclusion
  pres.addSection({ title: "Conclusion" }); SEC["Conclusion"] = true;
  {
    const s = newSlide("Conclusion", "Strong baseline, honest evaluation", null,
      "Three takeaways. A simple dense autoencoder is a strong baseline. The architectural improvements we expected did not appear in our measurements, and two of our three runs used easier splits, so the honest next step is to re-run them under the strict protocol on all IDs. And evaluation design, random versus blocked splitting, changed results as much as architecture did. Next I would test temporal models, attention, and fine-tuning pretrained audio models, especially for valve.");
    sub(s, "Conclusion and future work");
    const finds = [`Dense AE: ${f3(Dn.kpi.auc)} AUC under the strictest split`, "No clear gain from convolution or embeddings (yet)", `Valve unsolved: recall at most ${f2(Cn.per_machine.valve.recall)}`, "Evaluation design changed results as much as architecture"];
    txt(s, "What we found", 0.6, 1.9, 5.8, 0.35, { fontSize: 18, bold: true, color: P.navy });
    finds.forEach((t, i) => {
      const y = 2.35 + i * 1.0;
      card(s, 0.6, y, 5.8, 0.88);
      dot(s, 0.8, y + 0.17, i + 1, P.blue, 0.5);
      txt(s, t, 1.5, y, 4.75, 0.88, { fontSize: 15, valign: "middle" });
    });
    txt(s, "Next steps", 6.8, 1.9, 5.9, 0.35, { fontSize: 18, bold: true, color: P.navy });
    const fa = require("react-icons/fa");
    const nexts = [["Re-run CAE and AST with blocked splits on all IDs", "FaRedo"], ["LSTM and GRU: remember what came before", "FaStream"], ["Attention and transformers: focus on short events", "FaBullseye"], ["Fine-tune pretrained audio and image models", "FaSlidersH"], ["Outlier exposure (used by the best published systems)", "FaClone"], ["Score by the worst windows, not the average", "FaBalanceScale"]];
    for (let i = 0; i < nexts.length; i++) {
      const y = 2.35 + i * 0.66;
      s.addShape(pres.shapes.OVAL, { x: 6.8, y, w: 0.5, h: 0.5, fill: { color: P.blue }, line: { color: P.blue, width: 0 }, objectName: "Icon circle " + (i + 1) });
      s.addImage({ data: await icon(fa[nexts[i][1]] || fa.FaCircle, P.white), x: 6.92, y: y + 0.12, w: 0.26, h: 0.26, altText: nexts[i][0] });
      txt(s, nexts[i][0], 7.5, y, 5.2, 0.5, { fontSize: 14, valign: "middle" });
    }
    card(s, 0.6, 6.45, 12.1, 0.5, P.light);
    txt(s, `Also tried: a supervised CNN (uses faulty labels), mean AUC ${f2(Sp.kpi.auc)}; some IDs fall far below chance (valve ID 04: AUC 0.02).`, 0.8, 6.45, 11.7, 0.5, { fontSize: 13, color: P.mute, valign: "middle" });
  }

  await pres.writeFile({ fileName: "AcousticSense_Anomaly_Detection.pptx" });
  if (!process.env.NO_THEME) await applyTheme("AcousticSense_Anomaly_Detection.pptx", THEME);
  console.log("written");
})().catch((e) => { console.error(e); process.exit(1); });

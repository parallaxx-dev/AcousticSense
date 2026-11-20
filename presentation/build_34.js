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

// ---------------------------------------------------------------- data-or-blank sections
function metricsSlide(model, D) {
  const s = newSlide(model.section, D ? model.headMetrics : "Metrics at a glance", model.chip, model.notesMetrics);
  if (!D) pending(s); else protoTag(s, D);
  const vals = D ? [f3(D.kpi.auc), f3(D.kpi.bal_acc), f3(D.kpi.recall), pc(D.kpi.false_alarm)] : ["—", "—", "—", "—"];
  const labs = ["Mean AUC", "Balanced accuracy", "Recall (faults caught)", "False alarms"];
  const kw = (12.1 - 0.3 * 3) / 4;
  vals.forEach((v, i) => kpi(s, 0.6 + i * (kw + 0.3), 1.6, kw, 1.35, v, labs[i], D ? undefined : P.slate));
  const hdr = ["Machine", "AUC", "pAUC", "Bal. acc.", "Recall", "False alarm", "Published AUC"].map((t) => ({ text: t, options: { bold: true, color: P.white, fill: { color: P.navy }, align: t === "Machine" ? "left" : "center", fontSize: 14 } }));
  const rows = [hdr];
  MACH.forEach((m) => {
    const d = D ? D.per_machine[m] : null;
    const cell = (v, o = {}) => ({ text: v, options: Object.assign({ align: "center", fontSize: 14, color: P.ink }, o) });
    const recallBad = d && d.recall < 0.4;
    rows.push([
      { text: m[0].toUpperCase() + m.slice(1), options: { bold: true, fontSize: 14, color: P.ink } },
      cell(d ? f3(d.auc) : "—"), cell(d ? f3(d.pauc) : "—"), cell(d ? f3(d.bal_acc) : "—"),
      cell(d ? f3(d.recall) : "—", recallBad ? { fill: { color: "F8D7D5" }, bold: true } : {}),
      cell(d ? pc(d.false_alarm) : "—", d && d.false_alarm > 0.2 ? { fill: { color: "FDEBD0" }, bold: true } : {}),
      cell(D ? f3(d.published_auc) : "—", { color: P.mute }),
    ]);
  });
  s.addTable(rows, { x: 0.6, y: 3.3, w: 12.1, colW: [2.6, 1.5, 1.5, 1.6, 1.5, 1.7, 1.7], rowH: 0.52, border: { type: "solid", color: P.line, pt: 0.75 }, valign: "middle", margin: [0, 0.1, 0, 0.1] });
  txt(s, D ? "Red = most faults missed. Orange = many false alarms." : "Fill in when the results of this model are available.", 0.6, 6.05, 12.1, 0.4, { fontSize: 14, color: P.mute });
  source(s, D ? "6 dB, " + (D.protocol.ids || "IDs 00, 02, 04, 06") + ", " + splitText(D) + ". Published AUC = MIMII paper dense AE, same IDs. Means of each machine's runs." + sup4(D) + starNote(D) : "Same test protocol as the other models, so the numbers can be compared.");
  return s;
}

function runsSlide(model, D) {
  const s = newSlide(model.section, D ? model.headRuns : "Every run", model.chip, model.notesRuns);
  if (!D) pending(s); else protoTag(s, D);
  const ids = ["id_00", "id_02", "id_04", "id_06"];
  const get = (m, id, k) => (D ? (D.runs.find((r) => r.machine === m && r.id === id) || {})[k] : null);
  const make = (title, key, x, lowV, highV) => {
    txt(s, title, x, 1.55, 5.9, 0.4, { fontSize: 18, bold: true, color: P.navy });
    const hdr = [{ text: "", options: { fill: { color: P.navy } } }].concat(ids.map((id) => ({ text: id.replace("id_", "ID "), options: { bold: true, color: P.white, fill: { color: P.navy }, align: "center", fontSize: 14 } })));
    const rows = [hdr];
    MACH.forEach((m) => {
      const r = [{ text: m[0].toUpperCase() + m.slice(1), options: { bold: true, fontSize: 14, color: P.ink } }];
      ids.forEach((id) => {
        const v = get(m, id, key);
        if (v == null) { r.push({ text: "—", options: { align: "center", fontSize: 14, color: P.slate } }); return; }
        const t = (v - lowV) / (highV - lowV);
        r.push({ text: v.toFixed(2), options: { align: "center", fontSize: 14, bold: true, fill: { color: blend("EAF2FA", P.blue, t) }, color: t > 0.55 ? P.white : P.ink } });
      });
      rows.push(r);
    });
    s.addTable(rows, { x, y: 2.05, w: 5.9, colW: [1.5, 1.1, 1.1, 1.1, 1.1], rowH: 0.62, border: { type: "solid", color: P.white, pt: 1.5 }, valign: "middle", margin: [0, 0.08, 0, 0.08] });
  };
  make("AUC (ranking quality)", "auc", 0.6, 0.5, 1.0);
  make("Recall (faults caught)", "recall", 6.8, 0.0, 1.0);
  const note = D ? model.runsNote : "Darker = better. Shows which machine IDs are easy or hard.";
  txt(s, note, 0.6, 5.35, 12.1, 1.2, { fontSize: 16, color: P.ink });
  source(s, D ? "Each cell is one run (one machine ID). Source: " + (D.tag === "ast" ? "results_embed" : "results_" + D.tag) + ".csv" : "Each cell is one run (one machine ID).");
  return s;
}

function confusionSlide(model, D) {
  const s = newSlide(model.section, D ? model.headConf : "Confusion matrices", model.chip, model.notesConf);
  if (!D) pending(s); else protoTag(s, D);
  const keys = ["all"].concat(MACH), w = 2.2, gap = 0.275;
  keys.forEach((k, i) => {
    const x = 0.6 + i * (w + gap);
    txt(s, k === "all" ? "All machines" : k[0].toUpperCase() + k.slice(1), x, 1.6, w, 0.4, { fontSize: 18, bold: true, color: P.navy, align: "center" });
    const c = D ? D.confusion[k] : null;
    const nh = c ? c.tn + c.fp : 0, nf = c ? c.fn + c.tp : 0;
    const cellT = (cnt, frac, good) => {
      if (!c) return { text: "—", options: { align: "center", fontSize: 14, color: P.slate, fill: { color: P.light } } };
      const fill = good ? blend("EAF2FA", P.blue, frac) : blend("FFFFFF", P.red, frac * 1.1);
      return { text: [{ text: Math.round(frac * 100) + "%", options: { bold: true, fontSize: 20, breakLine: true } }, { text: fmt(cnt), options: { fontSize: 12 } }], options: { align: "center", fill: { color: fill }, color: good && frac > 0.55 ? P.white : P.ink } };
    };
    const hdr = (t) => ({ text: t, options: { bold: true, fontSize: 11, color: P.mute, align: "center" } });
    const rows = [
      [{ text: "", options: {} }, hdr("Said healthy"), hdr("Said faulty")],
      [{ text: "Healthy", options: { bold: true, fontSize: 12, color: P.ink, align: "center" } }, cellT(c ? c.tn : 0, c ? c.tn / nh : 0, true), cellT(c ? c.fp : 0, c ? c.fp / nh : 0, false)],
      [{ text: "Faulty", options: { bold: true, fontSize: 12, color: P.ink, align: "center" } }, cellT(c ? c.fn : 0, c ? c.fn / nf : 0, false), cellT(c ? c.tp : 0, c ? c.tp / nf : 0, true)],
    ];
    s.addTable(rows, { x, y: 2.1, w, colW: [0.7, 0.75, 0.75], rowH: [0.4, 1.15, 1.15], border: { type: "solid", color: P.white, pt: 2 }, valign: "middle", margin: 0.02 });
  });
  const note = D ? model.confNote : "Each row adds to 100% of the true class. Blue = correct, red = mistake.";
  txt(s, note, 0.6, 5.1, 12.1, 1.4, { fontSize: 16, color: P.ink });
  source(s, D ? "Rows = true class (percent), counts below. " + (D.tag === "sup" ? "Threshold = best balanced accuracy on validation. " : "Threshold = 95th percentile of healthy validation scores. ") + "Pooled over all runs of a machine." + starNote(D) : "Rows = true class (percent), counts below.");
  return s;
}

function curvesSlide(model, D) {
  const s = newSlide(model.section, D ? model.headCurves : model.curvesTitle, model.chip, model.notesCurves);
  if (!D) {
    pending(s);
    dashed(s, 0.6, 1.65, 5.9, 4.8, "ROC curves", "Faults caught vs false alarms");
    dashed(s, 6.8, 1.65, 5.9, 4.8, model.curveBlank || "Loss curves", "Train and validation");
    source(s, "ROC: closer to the top-left corner is better.");
    return s;
  }
  protoTag(s, D);
  txt(s, "ROC curve per machine", 0.6, 1.55, 5.9, 0.35, { fontSize: 18, bold: true, color: P.navy });
  const xs = D.roc.fpr;
  const data = [{ name: "False alarm rate", values: xs }].concat(MACH.map((m) => ({ name: m[0].toUpperCase() + m.slice(1), values: D.roc[m] }))).concat([{ name: "Chance", values: xs }]);
  s.addChart(pres.charts.SCATTER, data, chartBase({
    x: 0.5, y: 1.95, w: 6.1, h: 4.65, chartColors: MACH.map((m) => MCOLOR[m]).concat([P.line]), lineSize: 2.5, lineDataSymbol: "none",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.2, catAxisMinVal: 0, catAxisMaxVal: 1, catAxisMajorUnit: 0.2,
    showLegend: true, legendPos: "b", showCatAxisTitle: true, catAxisTitle: "False alarm rate", showValAxisTitle: true, valAxisTitle: "Faults caught",
    catAxisTitleFontSize: 12, valAxisTitleFontSize: 12, catAxisTitleColor: P.mute, valAxisTitleColor: P.mute, catAxisTitleFontFace: FONT, valAxisTitleFontFace: FONT,
    valAxisLabelFormatCode: "0.0", catAxisLabelFormatCode: "0.0", valGridLine: { color: "E3E8EE", size: 0.75 }, catGridLine: { color: "E3E8EE", size: 0.75 },
  }));
  if (D.loss) {
  txt(s, "Training loss (average of all runs)", 6.8, 1.55, 5.9, 0.35, { fontSize: 18, bold: true, color: P.navy });
  s.addChart(pres.charts.LINE, [{ name: "Train", labels: D.loss.epoch.map(String), values: D.loss.train }, { name: "Validation", labels: D.loss.epoch.map(String), values: D.loss.val }], chartBase({
    x: 6.7, y: 1.95, w: 6.1, h: 4.65, chartColors: [P.blue, P.amber], lineSize: 2.5, lineDataSymbol: "none",
    showLegend: true, legendPos: "b", valAxisMinVal: 0, valAxisLabelFormatCode: "0.0", catAxisLabelFontSize: 11, catAxisLabelFrequency: 8,
    showCatAxisTitle: true, catAxisTitle: "Epoch", showValAxisTitle: true, valAxisTitle: "Loss (MSE)", catAxisTitleFontSize: 12, valAxisTitleFontSize: 12,
    catAxisTitleColor: P.mute, valAxisTitleColor: P.mute, catAxisTitleFontFace: FONT, valAxisTitleFontFace: FONT,
  }));
  source(s, "ROC: curves of the runs of each machine, averaged. Loss: mean over runs still training at that epoch (at least 4 runs). Chance = diagonal.");
  } else {
    txt(s, "Scores divided by threshold", 6.8, 1.55, 5.9, 0.35, { fontSize: 18, bold: true, color: P.navy });
    s.addChart(pres.charts.BAR, [
      { name: "Healthy", labels: D.scorehist.labels, values: D.scorehist.healthy.map((v) => +(100 * v).toFixed(1)) },
      { name: "Faulty", labels: D.scorehist.labels, values: D.scorehist.faulty.map((v) => +(100 * v).toFixed(1)) },
    ], chartBase({ x: 6.7, y: 1.95, w: 6.1, h: 4.65, barDir: "col", chartColors: [P.green, P.red], showLegend: true, legendPos: "b", catAxisLabelFontSize: 10, catAxisLabelFrequency: 2, valAxisMinVal: 0,
      showCatAxisTitle: true, catAxisTitle: "Score / threshold (1.0 = alarm line)", showValAxisTitle: true, valAxisTitle: "Share of clips (%)", catAxisTitleFontSize: 12, valAxisTitleFontSize: 12,
      catAxisTitleColor: P.mute, valAxisTitleColor: P.mute, catAxisTitleFontFace: FONT, valAxisTitleFontFace: FONT, barGapWidthPct: 15 }));
    source(s, "ROC: curves of the runs of each machine, averaged. Right: scores divided by each run's threshold; the last bin holds 3.75 and above." + starNote(D));
  }
  return s;
}

function mistakesSlide(model, D) {
  const s = newSlide(model.section, D ? model.headMist : "Mistakes and comparison with the paper", model.chip, model.notesMist);
  if (!D) {
    pending(s);
    dashed(s, 0.6, 1.65, 5.9, 4.8, "Missed faults vs false alarms", "Per machine");
    dashed(s, 6.8, 1.65, 5.9, 4.8, "AUC vs published baseline", "Per machine");
    source(s, "Published = MIMII paper dense autoencoder, 6 dB.");
    return s;
  }
  protoTag(s, D);
  const cap = (m) => m[0].toUpperCase() + m.slice(1);
  txt(s, "Mistakes per machine (percent)", 0.6, 1.55, 5.9, 0.35, { fontSize: 18, bold: true, color: P.navy });
  s.addChart(pres.charts.BAR, [
    { name: "Missed faults", labels: MACH.map(cap), values: MACH.map((m) => +D.mistakes[m].missed_pct.toFixed(1)) },
    { name: "False alarms", labels: MACH.map(cap), values: MACH.map((m) => +D.mistakes[m].false_alarm_pct.toFixed(1)) },
  ], chartBase({ x: 0.5, y: 1.95, w: 6.1, h: 4.65, barDir: "col", chartColors: [P.red, P.amber], showLegend: true, legendPos: "b", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 0, valAxisMaxVal: 100, barGapWidthPct: 60 }));
  txt(s, "Mean AUC: ours vs published baseline", 6.8, 1.55, 5.9, 0.35, { fontSize: 18, bold: true, color: P.navy });
  s.addChart(pres.charts.BAR, [
    { name: "Ours", labels: MACH.map(cap), values: MACH.map((m) => +D.per_machine[m].auc.toFixed(3)) },
    { name: "Published (MIMII paper)", labels: MACH.map(cap), values: MACH.map((m) => +D.per_machine[m].published_auc.toFixed(3)) },
  ], chartBase({ x: 6.7, y: 1.95, w: 6.1, h: 4.65, barDir: "col", chartColors: [P.blue, P.slate], showLegend: true, legendPos: "b", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0.4, valAxisMaxVal: 1.0, barGapWidthPct: 60 }));
  source(s, "Mistakes are pooled counts over all test clips. AUC: not an exact match with the paper (it averages 7 IDs and uses a different split).");
  return s;
}

// ================================================================= BUILD
(async () => {
  const D = DATA;
  const ds = D.dense.dataset;
  const nH = MACH.reduce((a, m) => a + ds[m].healthy, 0), nF = MACH.reduce((a, m) => a + ds[m].faulty, 0), nAll = nH + nF;
  const OFFICIAL_TOTAL = 26092 + 6065;

  // ---------- 1 title
  pres.addSection({ title: "Introduction" }); SEC["Introduction"] = true;
  {
    const s = pres.addSlide({ masterName: "TITLE", sectionTitle: "Introduction" });
    s.addText("Listening for faults", { placeholder: "title" });
    s.addText("Unsupervised acoustic anomaly detection on industrial machines (MIMII dataset)", { placeholder: "body" });
    // waveform motif: rounded bars, one amber
    const n = 34, x0 = 8.2, bw = 0.09, pitch = 0.145;
    for (let i = 0; i < n; i++) {
      const env = Math.sin((i / (n - 1)) * Math.PI);
      const hh = 0.25 + 3.2 * env * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
      s.addShape(pres.shapes.RECTANGLE, { x: x0 + i * pitch, y: 3.75 - hh / 2, w: bw, h: hh, fill: { color: i === 22 ? P.amber : (i % 3 === 0 ? P.sky : P.blue) }, line: { color: P.navy, width: 0 }, objectName: "Waveform bar " + (i + 1) });
    }
    s.addText("Project review  |  November 2026", { x: 0.8, y: 6.5, w: 6, h: 0.35, fontSize: 14, color: "8FB3D3", margin: 0, isTextBox: true });
    s.addNotes("Opening. One sentence: we listen to machine sound and flag the ones that sound abnormal, training only on healthy sound.");
  }

  // ---------- 2 journey
  {
    const s = newSlide("Introduction", "Our journey: from raw audio to a benchmark", null,
      "Walk left to right. Numbers: local fan-only runs (id_00 AUC about 0.53-0.55, id_02 0.70-0.81), Kaggle dense autoencoder on a random split (mean AUC 0.939, 16 runs), strict blocked split (mean AUC 0.913).");
    const steps = [
      ["Understand the task", "Healthy-only fault detection. Log-mel pictures, autoencoder, AUC / pAUC / F1."],
      ["First tests: fan only", "Local GPU. id_00 is hard (AUC about 0.55). id_02 is better (0.70 to 0.81)."],
      ["Read the literature", "MIMII baseline and DCASE results. Fan id_00 and valve are known to be hard."],
      ["Scale to all machines", "Kaggle GPU. 4 machines, 4 IDs each, 6 dB. Random split: mean AUC 0.94."],
      ["Check for leaks", "Random splits can leak recording sessions. Strict blocked split: mean AUC 0.91."],
      ["Try more models", "CAE and supervised CNN are done. AST embeddings: quick run only."],
    ];
    const cw = 12.1 / 6;
    s.addShape(pres.shapes.LINE, { x: 0.6 + cw / 2, y: 2.35, w: 12.1 - cw, h: 0, line: { color: P.line, width: 2 } });
    steps.forEach((st, i) => {
      const cx = 0.6 + i * cw;
      const last = i === 5;
      s.addShape(pres.shapes.OVAL, { x: cx + cw / 2 - 0.35, y: 2.0, w: 0.7, h: 0.7, fill: { color: last ? P.amber : P.blue }, line: { color: P.white, width: 2 }, objectName: "Step " + (i + 1) });
      s.addText(String(i + 1), { x: cx + cw / 2 - 0.35, y: 2.0, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: P.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
      txt(s, st[0], cx + 0.08, 3.0, cw - 0.16, 0.7, { fontSize: 17, bold: true, color: P.navy, align: "center" });
      txt(s, st[1], cx + 0.08, 3.75, cw - 0.16, 1.9, { fontSize: 14, color: P.ink, align: "center" });
    });
    card(s, 0.6, 5.85, 12.1, 0.8, P.light);
    txt(s, "Lesson: a strict test matters as much as the model. A clean split lowered our score, and made it honest.", 0.85, 5.85, 11.6, 0.8, { fontSize: 18, italic: true, color: P.navy, valign: "middle" });
  }

  // ---------- 3 dataset
  {
    const s = newSlide("Introduction", `MIMII: 4 machine types, ${fmt(nAll)} clips used`, null,
      "Counts are the official per-machine-ID counts from the MIMII paper (Table 1), and they match our runs exactly. We used IDs 00, 02, 04 and 06 of 7, one noise level (6 dB) of 3, and microphone 1 of 8. Official totals per noise level: 26,092 healthy and 6,065 faulty.");
    txt(s, "Clips used, by machine", 0.6, 1.55, 6.4, 0.35, { fontSize: 18, bold: true, color: P.navy });
    s.addChart(pres.charts.BAR, [
      { name: "Healthy", labels: MACH.map((m) => m[0].toUpperCase() + m.slice(1)), values: MACH.map((m) => ds[m].healthy) },
      { name: "Faulty", labels: MACH.map((m) => m[0].toUpperCase() + m.slice(1)), values: MACH.map((m) => ds[m].faulty) },
    ], chartBase({ x: 0.5, y: 1.95, w: 6.6, h: 3.6, barDir: "bar", barGrouping: "stacked", chartColors: [P.green, P.red], showLegend: true, legendPos: "b", showValue: true, dataLabelPosition: "ctr", dataLabelColor: P.white, dataLabelFormatCode: "#,##0", valAxisLabelFormatCode: "#,##0", barGapWidthPct: 45, catAxisOrientation: "maxMin" }));
    const kx = 7.5, kw = 5.2;
    kpi(s, kx, 1.6, kw, 1.2, fmt(nAll), `clips used (${Math.round((100 * nAll) / OFFICIAL_TOTAL)}% of ${fmt(OFFICIAL_TOTAL)} at one noise level)`);
    kpi(s, kx, 2.95, kw, 1.2, "16 runs", "4 machines x 4 IDs, one model per run");
    kpi(s, kx, 4.3, kw, 1.2, "10 s, 16 kHz", "one clip; microphone 1 of 8; 6 dB factory noise");
    card(s, 0.6, 5.7, 12.1, 0.95, P.light);
    txt(s, [{ text: "Not covered yet: ", options: { bold: true, color: P.navy } }, { text: "IDs 01, 03, 05  |  noise levels 0 dB and -6 dB  |  the other 7 microphones. The 4 machines are fan, pump, slide rail (slider) and valve.", options: {} }], 0.85, 5.7, 11.6, 0.95, { fontSize: 16, valign: "middle" });
    source(s, "Source: Purohit et al., MIMII Dataset (2019), Table 1. Counts checked against our run results.");
  }

  // ---------- 4 research: MIMII baselines
  {
    const s = newSlide("Research", "A small dense autoencoder scores 0.82 AUC", null,
      "Source: Table I of arXiv 2412.10792 (average AUC over 3 runs on MIMII, 6 dB): baseline dense AE valve 0.670, pump 0.805, fan 0.913, slide rail 0.878, all 0.816; one-class deep SVDD (subspace dim 2) valve 0.772, pump 0.802, fan 0.936, slide rail 0.867, all 0.844. Baseline architecture from the MIMII paper: 5 log-mel frames (64 mel bands = 320 inputs), 64-64-8 dense autoencoder. AUC drops with more noise: baseline average 0.816 at 6 dB, 0.723 at 0 dB, 0.644 at -6 dB.");
    txt(s, "AUC at 6 dB noise, by machine", 0.6, 1.55, 7.3, 0.35, { fontSize: 18, bold: true, color: P.navy });
    const labs = ["Valve", "Pump", "Fan", "Slider", "All"];
    s.addChart(pres.charts.BAR, [
      { name: "Dense autoencoder (MIMII baseline)", labels: labs, values: [0.670, 0.805, 0.913, 0.878, 0.816] },
      { name: "One-class Deep SVDD (convolutional)", labels: labs, values: [0.772, 0.802, 0.936, 0.867, 0.844] },
    ], chartBase({ x: 0.5, y: 1.95, w: 7.5, h: 4.6, barDir: "col", chartColors: [P.slate, P.blue], showLegend: true, legendPos: "b", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0.4, valAxisMaxVal: 1.0, barGapWidthPct: 50 }));
    const bx = 8.4, bw = 4.3;
    [["Baseline = 5 frames, 64-64-8 dense network", P.slate], ["Valve is hardest, fan easiest", P.amber], ["More noise, lower AUC: 0.82 at 6 dB, 0.64 at -6 dB", P.blue], ["Convolutional Deep SVDD adds only about 0.03", P.green]].forEach((b, i) => {
      s.addShape(pres.shapes.OVAL, { x: bx, y: 1.95 + i * 1.12, w: 0.5, h: 0.5, fill: { color: b[1] }, line: { color: b[1], width: 0 }, objectName: "Bullet " + (i + 1) });
      txt(s, b[0], bx + 0.7, 1.9 + i * 1.12, bw - 0.7, 0.9, { fontSize: 16, valign: "middle" });
    });
    source(s, "Average AUC over machine IDs 00-06. Sources: MIMII paper (arXiv 1909.09347), Table I of arXiv 2412.10792.");
  }

  // ---------- 5 research: DCASE
  {
    const s = newSlide("Research", "Top systems go beyond reconstruction", null,
      "Source: arXiv 2309.07500, Table 2 (AUC %, MIMII part of the DCASE 2020 development set): Official baseline 72.44, IDNN 78.00, IDCAE 81.83, GroupMADE 82.19, Glow_Aff 86.08, proposed 94.86. Table 3 (evaluation set): baseline 75.49 (269K parameters), GroupMADE 88.00, IDCAE 89.84, DDCSAD 95.24, proposed 95.54 (2M), fused systems 95.49 and 95.84 (179M). The proposed method uses outlier exposure with inlier modeling. These use a different protocol from ours.");
    txt(s, "Average AUC (%), DCASE 2020 development set", 0.6, 1.55, 7.3, 0.35, { fontSize: 18, bold: true, color: P.navy });
    const names = ["Official baseline", "IDNN", "IDCAE", "GroupMADE", "Glow_Aff", "Outlier-aware (best)"];
    const vals = [72.44, 78.00, 81.83, 82.19, 86.08, 94.86];
    s.addChart(pres.charts.BAR, [{ name: "Average AUC (%)", labels: names, values: vals }], chartBase({ x: 0.5, y: 1.95, w: 7.5, h: 4.6, barDir: "bar", chartColors: [P.slate, P.slate, P.slate, P.slate, P.slate, P.blue], showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 50, valAxisMaxVal: 100, barGapWidthPct: 45, catAxisOrientation: "maxMin" }));
    const bx = 8.4, bw = 4.3;
    kpi(s, bx, 1.95, bw, 1.3, "66 to 100", "valve AUC %: baseline to best (dev)");
    kpi(s, bx, 3.4, bw, 1.3, "57 to 97", "valve AUC %: baseline to best (eval)");
    card(s, bx, 4.85, bw, 1.7);
    txt(s, "The best method adds extra training signal (outlier exposure). It is not a plain reconstruction model.", bx + 0.2, 4.85, bw - 0.4, 1.7, { fontSize: 15, valign: "middle" });
    source(s, "AUC %, MIMII part of DCASE 2020 Task 2. Source: arXiv 2309.07500, Tables 2 and 3. Different protocol from ours.");
  }

  // ---------- 6 imbalance -> healthy-only autoencoder
  {
    const s = newSlide("Approach", "Faults are rare: train on healthy sound only", null,
      `Healthy:faulty ratios from the clips we used: fan ${(ds.fan.healthy / ds.fan.faulty).toFixed(1)}, pump ${(ds.pump.healthy / ds.pump.faulty).toFixed(1)}, slider ${(ds.slider.healthy / ds.slider.faulty).toFixed(1)}, valve ${(ds.valve.healthy / ds.valve.faulty).toFixed(1)}; overall ${(nH / nF).toFixed(1)}. Only ${Math.round((100 * nF) / nAll)}% of clips are faulty. A classifier needs many labelled faults; an autoencoder needs none.`);
    txt(s, "Healthy clips for every faulty clip", 0.6, 1.55, 5.6, 0.35, { fontSize: 18, bold: true, color: P.navy });
    s.addChart(pres.charts.BAR, [{ name: "Ratio", labels: MACH.map((m) => m[0].toUpperCase() + m.slice(1)), values: MACH.map((m) => +(ds[m].healthy / ds[m].faulty).toFixed(1)) }],
      chartBase({ x: 0.5, y: 1.9, w: 5.8, h: 2.9, barDir: "col", chartColors: [P.blue, P.blue, P.blue, P.amber], showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 0, valAxisMaxVal: 10, barGapWidthPct: 55 }));
    const bx = 6.8;
    [[`${Math.round((100 * nF) / nAll)}% of clips are faulty`, `${fmt(nF)} faulty vs ${fmt(nH)} healthy. In real plants, labelled faults are usually even rarer.`],
     ["A classifier needs many faults", "An autoencoder needs none: it learns what healthy sound looks like."],
     ["A faulty sound is copied badly", "The copy error is the anomaly score. No faulty clip is used in training."]].forEach((b, i) => {
      txt(s, b[0], bx, 1.6 + i * 1.07, 5.9, 0.4, { fontSize: 18, bold: true, color: P.navy });
      txt(s, b[1], bx, 2.02 + i * 1.07, 5.9, 0.6, { fontSize: 15, color: P.ink });
    });
    // pipeline
    const steps = ["Sound clip (10 s)", "Log-mel picture", "Autoencoder (healthy only)", "Copy error = score", "Above 95th percentile = alarm"];
    const pw = 2.2, pg = (12.1 - 5 * pw) / 4;
    steps.forEach((t, i) => {
      const x = 0.6 + i * (pw + pg);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.15, w: pw, h: 1.15, fill: { color: i === 2 ? P.blue : P.light }, line: { color: i === 2 ? P.blue : P.line, width: 1 }, rectRadius: 0.1, objectName: "Pipeline " + (i + 1) });
      s.addText(t, { x: x + 0.1, y: 5.15, w: pw - 0.2, h: 1.15, fontSize: 15, bold: i === 2, color: i === 2 ? P.white : P.ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
      if (i < 4) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + pw + pg * 0.1, y: 5.6, w: pg * 0.8, h: 0.3, fill: { color: P.slate }, line: { color: P.slate, width: 0 }, objectName: "Arrow " + (i + 1) });
    });
    source(s, "Counts from the MIMII paper, Table 1, for the IDs we used.");
  }

  // ================================================================= MODELS
  const MODELS = {
    dense: {
      section: "Model 1: Dense autoencoder", chip: "MODEL 1  |  DENSE AUTOENCODER",
      headMetrics: "Good on three machines, weak on valve", headRuns: "Every run: where it works and where it fails",
      headConf: "Valve misses faults, pump raises alarms", headCurves: "Clean training, good ranking on 3 of 4",
      headMist: "Above the paper, but valve still misses 80%",
      runsNote: "Hardest: valve (all four IDs). Fan id_00 ranks well (AUC 0.86) but catches only 28% of faults at our threshold. Easiest: fan id_02, fan id_06, pump id_04, slider id_00 (AUC above 0.99).",
      confNote: "Valve: 80% of faults are missed. Pump: 24% of healthy clips raise a false alarm. Fan, slider: fewer than 10% false alarms.",
      notesMetrics: "Mean over 16 runs. AUC 0.913 vs published 0.816 (not an exact match). Balanced accuracy 0.769, recall 0.644, false alarms 10.6%. Valve recall is only 0.196.",
      notesRuns: "Each cell is one run. Source results_dense.csv.", notesConf: "Rows are true class. Counts below the percent.",
      notesCurves: "Average train loss falls from 0.55 to 0.24; validation loss ends about 0.06 higher than train. ROC: fan, pump, slider curves bow towards top-left; valve is closest to the diagonal.",
      notesMist: "Missed faults / false alarms per machine from the confusion matrices. Right chart: ours vs the published dense autoencoder at 6 dB for the same IDs.",
    },
    cae: { section: "Model 2: Convolutional autoencoder", chip: "MODEL 2  |  CONVOLUTIONAL AUTOENCODER (CAE)", curveBlank: "Loss curves" },
    ast: { section: "Model 3: AST embeddings", chip: "MODEL 3  |  PRETRAINED AST EMBEDDINGS", curveBlank: "Score distributions" },
    sup: { section: "Model 4: Supervised CNN", chip: "MODEL 4  |  SUPERVISED CNN", curveBlank: "Loss and accuracy curves" },
  };
  const blank = (m) => Object.assign({ notesMetrics: "Blank until results arrive.", notesRuns: "Blank until results arrive.", notesConf: "Blank until results arrive.", notesCurves: "Blank until results arrive.", notesMist: "Blank until results arrive.", curvesTitle: "Curves" }, m);
  ["cae", "ast", "sup"].forEach((k) => (MODELS[k] = blank(MODELS[k])));
  ["cae", "ast", "sup"].forEach((k) => { if (D[k]) Object.assign(MODELS[k], autoText(D[k])); });

  // ---------- Model 1 architecture
  archSlide(MODELS.dense, {
    title: "Dense autoencoder: 2.7 million parameters",
    notes: "Fully connected network, no convolution. It takes 5 neighbouring log-mel columns (5 x 128 = 640 numbers), squeezes them to 16 numbers and rebuilds them. 2,710,992 parameters in total.",
    bars: [640, 1024, 512, 256, 128, 16, 128, 256, 512, 1024, 640].map((v, i) => ({ label: String(v), size: v, kind: i === 0 || i === 10 ? "io" : i === 5 ? "lat" : "hid" })),
    groups: [{ name: "Input", from: 0, to: 0 }, { name: "Encoder", from: 1, to: 4, cap: "Dense + BatchNorm + ReLU" }, { name: "Latent space", from: 5, to: 5 }, { name: "Decoder", from: 6, to: 9, cap: "Dense + BatchNorm + ReLU" }, { name: "Reconstruction", from: 10, to: 10 }],
    stats: [[fmt(PARAMS.dense[0]), "parameters (" + fmt(PARAMS.dense[1]) + " trainable)"], ["640 numbers", "input: 5 columns x 128 mel bands"], ["16 numbers", "latent space (the bottleneck)"], ["Healthy only", "Adam 1e-3, early stopping"]],
  });
  metricsSlide(MODELS.dense, D.dense);
  runsSlide(MODELS.dense, D.dense);
  confusionSlide(MODELS.dense, D.dense);
  curvesSlide(MODELS.dense, D.dense);
  mistakesSlide(MODELS.dense, D.dense);

  // ---------- transition
  {
    const k = D.dense.kpi, pm = D.dense.per_machine;
    const s = newSlide("Model 1: Dense autoencoder", "Satisfactory, not strong: three more models", null,
      "Why move on: valve recall is only 0.196, pump has 22% false alarms, balanced accuracy is 0.77. The three new models test different ideas: convolution (CAE), pretrained knowledge (AST), and labelled faults (supervised).");
    const kw = (12.1 - 0.6) / 3;
    kpi(s, 0.6, 1.6, kw, 1.3, (100 - D.dense.mistakes.valve.missed_pct).toFixed(1) + "%", "of valve faults caught", P.red);
    kpi(s, 0.6 + kw + 0.3, 1.6, kw, 1.3, (D.dense.mistakes.pump.false_alarm_pct).toFixed(1) + "%", "of healthy pump clips flagged", P.amber);
    kpi(s, 0.6 + 2 * (kw + 0.3), 1.6, kw, 1.3, f3(k.bal_acc), "balanced accuracy (16 runs)", P.navy);
    const cards = [
      ["2", "Convolutional autoencoder", "Looks at the whole picture with filters. The architecture our project specification asks for."],
      ["3", "Pretrained AST embeddings", "A transformer pretrained on AudioSet. No training here: we measure distance to healthy."],
      ["4", "Supervised CNN", "Learns from healthy and faulty clips, with augmentation. Not healthy-only: a separate experiment."],
    ];
    cards.forEach((c, i) => {
      const x = 0.6 + i * (kw + 0.3);
      card(s, x, 3.3, kw, 3.25);
      s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 3.55, w: 0.62, h: 0.62, fill: { color: P.blue }, line: { color: P.blue, width: 0 }, objectName: "Model number " + c[0] });
      s.addText(c[0], { x: x + 0.25, y: 3.55, w: 0.62, h: 0.62, fontSize: 22, bold: true, color: P.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
      txt(s, c[1], x + 1.0, 3.55, kw - 1.2, 0.62, { fontSize: 18, bold: true, color: P.navy, valign: "middle" });
      txt(s, c[2], x + 0.25, 4.4, kw - 0.5, 1.4, { fontSize: 15 });
      const dd = D[["cae", "ast", "sup"][i]], have = !!dd, quick = have && dd.protocol.split === "random-quick";
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.25, y: 5.85, w: 1.85, h: 0.34, fill: { color: have && !quick ? "D5F0E3" : "FDEBD0" }, rectRadius: 0.08, objectName: "Status tag" });
      s.addText(quick ? "QUICK RUN ONLY" : have ? "RESULTS IN" : "RESULTS PENDING", { x: x + 0.25, y: 5.85, w: 1.85, h: 0.34, fontSize: 11, bold: true, color: have && !quick ? "1D6B47" : "7A4B00", align: "center", valign: "middle", margin: 0, isTextBox: true });
    });
    source(s, "Dense autoencoder: 6 dB, strict blocked split. Valve and pump figures are pooled over all test clips.");
  }

  // ---------- Model 2 CAE
  const cs = [[128, 64, 1], [64, 32, 32], [32, 16, 64], [16, 8, 128], [8, 4, 256], 32, [8, 4, 256], [16, 8, 128], [32, 16, 64], [64, 32, 32], [128, 64, 16], [128, 64, 1]];
  archSlide(MODELS.cae, {
    title: "CAE: 1.3 million parameters",
    notes: "Follows the project specification: 4 strided conv blocks (32, 64, 128, 256 filters) with BatchNorm and LeakyReLU(0.2), flatten, Dense(32) bottleneck, mirrored transposed conv blocks (128, 64, 32, 16), sigmoid output. No skip connections. 1,315,297 parameters; fewer than the dense model because convolution filters are shared.",
    bars: cs.map((v, i) => ({ label: Array.isArray(v) ? "(" + v.join(",") + ")" : String(v), size: Array.isArray(v) ? v[0] * v[1] * v[2] : v, kind: i === 0 || i === 11 ? "io" : i === 5 ? "lat" : "hid" })),
    groups: [{ name: "Input", from: 0, to: 0 }, { name: "Encoder", from: 1, to: 4, cap: "Conv 3x3, stride 2 + BatchNorm + LeakyReLU" }, { name: "Latent", from: 5, to: 5 }, { name: "Decoder", from: 6, to: 10, cap: "Transposed conv 3x3, stride 2 + BatchNorm + LeakyReLU" }, { name: "Output", from: 11, to: 11 }],
    stats: [[fmt(PARAMS.cae[0]), "parameters (" + fmt(PARAMS.cae[1]) + " trainable)"], ["128 x 64 picture", "input: mel bands x time frames"], ["32 numbers", "latent space (the bottleneck)"], ["No skip links", "sigmoid output, healthy only"]],
  });
  metricsSlide(MODELS.cae, D.cae); runsSlide(MODELS.cae, D.cae); confusionSlide(MODELS.cae, D.cae); curvesSlide(MODELS.cae, D.cae); mistakesSlide(MODELS.cae, D.cae);

  // ---------- Model 3 AST
  archSlide(MODELS.ast, {
    title: "AST embeddings: 86 million frozen parameters",
    notes: "Audio Spectrogram Transformer pretrained on AudioSet (MIT/ast-finetuned-audioset-10-10-0.4593). We do not train it. Each clip becomes a 768-number embedding; the anomaly score is the Mahalanobis distance (shrinkage covariance) to the healthy training embeddings. 86,187,264 parameters.",
    bars: [{ label: "(1024,128)", size: 131072, kind: "io" }, { label: "(1212,768)", size: 930816, kind: "hid" }, { label: "12 blocks (1212,768)", size: 930816, kind: "hid" }, { label: "768", size: 768, kind: "lat" }, { label: "1 score", size: 4, kind: "io" }],
    groups: [{ name: "Log-mel input", from: 0, to: 0, cap: "1024 frames x 128 mel" }, { name: "Patch embedding", from: 1, to: 1, cap: "1212 patches" }, { name: "Frozen transformer", from: 2, to: 2, cap: "12 attention blocks" }, { name: "Embedding", from: 3, to: 3, cap: "pooled, 768 numbers" }, { name: "Score", from: 4, to: 4, cap: "Mahalanobis distance to healthy" }],
    stats: [["86.2 million", "parameters, all frozen"], ["768 numbers", "embedding per clip"], ["Mahalanobis", "distance to healthy embeddings"], ["Healthy only", "no training, no faulty clips"]],
  });
  metricsSlide(MODELS.ast, D.ast); runsSlide(MODELS.ast, D.ast); confusionSlide(MODELS.ast, D.ast); curvesSlide(MODELS.ast, D.ast); mistakesSlide(MODELS.ast, D.ast);

  // ---------- Model 4 supervised
  archSlide(MODELS.sup, {
    title: "Supervised CNN: 24 thousand parameters",
    notes: "Small CNN: three Conv + BatchNorm + ReLU + MaxPool blocks (16, 32, 64 filters), global average pooling, dropout 0.3, one sigmoid output (chance of faulty). 23,809 parameters. Trained on healthy AND faulty clips: a different experiment from the other three. Augmentation: volume +/- 2 dB, light noise, small time shift.",
    bars: [{ label: "(128,64,1)", size: 8192, kind: "io" }, { label: "(64,32,16)", size: 32768, kind: "hid" }, { label: "(32,16,32)", size: 16384, kind: "hid" }, { label: "(16,8,64)", size: 8192, kind: "hid" }, { label: "64", size: 64, kind: "lat" }, { label: "1", size: 2, kind: "io" }],
    groups: [{ name: "Input", from: 0, to: 0 }, { name: "Conv blocks", from: 1, to: 3, cap: "Conv 3x3 + BatchNorm + ReLU + MaxPool" }, { name: "Pooled", from: 4, to: 4, cap: "global average" }, { name: "Output", from: 5, to: 5, cap: "chance of faulty" }],
    stats: [[fmt(PARAMS.sup[0]), "parameters (" + fmt(PARAMS.sup[1]) + " trainable)"], ["Healthy + faulty", "trained with labels"], ["Augmentation", "volume, noise, time shift"], ["Dropout 0.3", "sigmoid output"]],
  });
  metricsSlide(MODELS.sup, D.sup); runsSlide(MODELS.sup, D.sup); confusionSlide(MODELS.sup, D.sup); curvesSlide(MODELS.sup, D.sup); mistakesSlide(MODELS.sup, D.sup);
  if (D.sup && D.sup.ablation) {
    const A = D.sup.ablation, cap = (m) => m[0].toUpperCase() + m.slice(1);
    const lower = MACH.filter((m) => A[m].auc_aug < A[m].auc_no).length;
    const s = newSlide(MODELS.sup.section, "Augmentation made no clear difference", MODELS.sup.chip,
      "Same split and seed; only augmentation changes. Augmentation: volume +/- 2 dB, light noise, small time shift on training data only. Main numbers in this section are the augmented runs (decided before running).");
    protoTag(s, D.sup);
    txt(s, "Mean AUC: without vs with augmentation", 0.6, 1.55, 7.4, 0.35, { fontSize: 18, bold: true, color: P.navy });
    s.addChart(pres.charts.BAR, [
      { name: "No augmentation", labels: MACH.map(cap), values: MACH.map((m) => +A[m].auc_no.toFixed(3)) },
      { name: "Augmentation", labels: MACH.map(cap), values: MACH.map((m) => +A[m].auc_aug.toFixed(3)) },
    ], chartBase({ x: 0.5, y: 1.95, w: 7.6, h: 4.6, barDir: "col", chartColors: [P.slate, P.blue], showLegend: true, legendPos: "b", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0.4, valAxisMaxVal: 1.05, barGapWidthPct: 55 }));
    kpi(s, 8.5, 1.65, 4.2, 1.3, `${A.all.auc_no.toFixed(3)} to ${A.all.auc_aug.toFixed(3)}`, "mean AUC, without to with", undefined, 30);
    kpi(s, 8.5, 3.1, 4.2, 1.3, `${A.all.bal_no.toFixed(3)} to ${A.all.bal_aug.toFixed(3)}`, "balanced accuracy, without to with", undefined, 30);
    card(s, 8.5, 4.55, 4.2, 2.0);
    txt(s, `Slightly lower with augmentation on ${lower} of 4 machines. The differences are small, and with one seed they could be chance.`, 8.7, 4.55, 3.8, 2.0, { fontSize: 15, valign: "middle" });
    source(s, "16 runs per setting, same split and seed. Source: results_sup.csv." + starNote(D.sup));
  }

  // ---------- comparison
  {
    const s = newSlide("Comparison", "Comparison of all four models", null,
      "Dense, CAE and supervised: 16 runs (4 machines x 4 IDs, 6 dB). AST: quick run, 8 runs (IDs 00 and 02, up to 150 clips per class, random split). Dense: blocked split (strict). CAE: random split (not strict, can leak recording sessions). Supervised: uses faulty labels; split marked blocked* because the export does not record it. So the table is NOT like for like until the CAE and AST are re-run with a blocked split on all IDs.");
    const hdr = ["Model", "Type", "Split", "Parameters", "Mean AUC", "pAUC", "Bal. acc.", "Recall", "False alarm"].map((t, i) => ({ text: t, options: { bold: true, color: P.white, fill: { color: P.navy }, align: i < 3 ? "left" : "center", fontSize: 14 } }));
    const sp = (d) => (d ? (d.protocol.split === "blocked" ? "Blocked" : d.protocol.split === "random" ? "Random" : d.protocol.split === "random-quick" ? "Random (quick)" : "Blocked*") : "—");
    const defs = [["1  Dense autoencoder", "Healthy only", PARAMS.dense[0], D.dense], ["2  Convolutional AE (CAE)", "Healthy only", PARAMS.cae[0], D.cae], ["3  AST embeddings", "Healthy only, frozen", PARAMS.ast[0], D.ast], ["4  Supervised CNN", "Uses faulty labels", PARAMS.sup[0], D.sup]];
    const rows = [hdr];
    defs.forEach((d) => {
      const k = d[3] ? d[3].kpi : null;
      const c = (v) => ({ text: v, options: { align: "center", fontSize: 14, color: k ? P.ink : P.slate, bold: !!k } });
      const warn = d[3] && d[3].protocol.split !== "blocked";
      rows.push([{ text: d[0], options: { bold: true, fontSize: 14, color: P.ink } }, { text: d[1], options: { fontSize: 14, color: P.mute } },
        { text: sp(d[3]), options: { fontSize: 14, bold: !!d[3], color: warn ? "7A4B00" : P.ink, fill: warn ? { color: "FDEBD0" } : undefined } }, c(fmt(d[2])),
        c(k ? f3(k.auc) : "—"), c(k ? f3(k.pauc) : "—"), c(k ? f3(k.bal_acc) : "—"), c(k ? f3(k.recall) : "—"), c(k ? pc(k.false_alarm) : "—")]);
    });
    s.addTable(rows, { x: 0.6, y: 1.55, w: 12.1, colW: [2.7, 1.9, 1.3, 1.4, 1.1, 0.9, 1.0, 0.9, 0.9], rowH: 0.5, border: { type: "solid", color: P.line, pt: 0.75 }, valign: "middle", margin: [0, 0.1, 0, 0.1] });
    txt(s, "Mean AUC per machine", 0.6, 4.2, 6.0, 0.35, { fontSize: 16, bold: true, color: P.navy });
    const have = [["Dense (blocked)", D.dense, P.blue], ["CAE (random)", D.cae, P.sky], ["AST (quick run)", D.ast, P.slate], ["Supervised (blocked*)", D.sup, P.amber]].filter((h) => h[1]);
    const cap = (m) => m[0].toUpperCase() + m.slice(1);
    s.addChart(pres.charts.BAR, have.map((h) => ({ name: h[0], labels: MACH.map(cap), values: MACH.map((m) => +h[1].per_machine[m].auc.toFixed(3)) })),
      chartBase({ x: 0.5, y: 4.5, w: 6.4, h: 2.15, barDir: "col", chartColors: have.map((h) => h[2]), showLegend: true, legendPos: "r", legendFontSize: 11, showValue: false, valAxisMinVal: 0.4, valAxisMaxVal: 1.0, valAxisMajorUnit: 0.2, catAxisLabelFontSize: 11, barGapWidthPct: 40 }));
    card(s, 7.2, 4.2, 5.5, 2.4);
    txt(s, "Not like for like yet", 7.4, 4.3, 5.1, 0.4, { fontSize: 18, bold: true, color: P.navy });
    const mins = D.cae ? Math.round(D.cae.total_minutes) : 0;
    txt(s, `Dense used a strict blocked split. The CAE used a random split, and the AST is a quick run (IDs 00 and 02, up to 150 clips per class, random split). Random splits can leak recording sessions and flatter the score. For a fair comparison, re-run the CAE with SPLIT_MODE = "blocked" (about ${mins} minutes on Kaggle) and the AST on all IDs.`, 7.4, 4.75, 5.1, 1.8, { fontSize: 14 });
    source(s, "AST: quick run, 8 runs (IDs 00 and 02 only). *Supervised split is the notebook default; the export does not record it. Supervised uses faulty clips in training.");
  }

  // ---------- next steps (with icons)
  {
    const s = newSlide("Next steps", "Next steps: time, attention, pretraining", null,
      "These follow from the results: valve faults are short events, so temporal and attention models and pretrained knowledge are the natural next experiments. Outlier exposure is what the best published systems add.");
    const fa = require("react-icons/fa");
    const items = [
      ["LSTM and GRU", "Read the sound column by column and remember what came before. Good for short events.", "FaStream"],
      ["Attention and transformers", "Let the model focus on the few moments that matter, such as a valve click.", "FaBullseye"],
      ["Pretrained image models", "Transfer learning: reuse networks trained on millions of pictures, on spectrograms.", "FaImage"],
      ["Fine-tuning", "Adapt a pretrained audio model (AST, BEATs) to each machine with a little training.", "FaSlidersH"],
      ["Outlier exposure", "The best published systems add extra training signal, such as other machines' sound.", "FaClone"],
      ["Smarter scoring", "Score by the worst windows, not the average, and tune thresholds per machine.", "FaBalanceScale"],
    ];
    const cw = (12.1 - 0.6) / 3, ch = 2.35;
    for (let i = 0; i < items.length; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.6 + col * (cw + 0.3), y = 1.65 + row * (ch + 0.3);
      card(s, x, y, cw, ch);
      s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.75, h: 0.75, fill: { color: P.blue }, line: { color: P.blue, width: 0 }, objectName: "Icon circle " + (i + 1) });
      const Comp = fa[items[i][2]] || fa.FaCircle;
      s.addImage({ data: await icon(Comp, P.white), x: x + 0.42, y: y + 0.42, w: 0.41, h: 0.41, altText: items[i][0] + " icon" });
      txt(s, items[i][0], x + 1.2, y + 0.25, cw - 1.4, 0.75, { fontSize: 18, bold: true, color: P.navy, valign: "middle" });
      txt(s, items[i][1], x + 0.25, y + 1.15, cw - 0.5, 1.1, { fontSize: 14 });
    }
    source(s, "Each experiment can reuse the same data, split and metrics, so results stay comparable.");
  }

  await pres.writeFile({ fileName: "AcousticSense_Anomaly_Detection_34slides.pptx" });
  if (!process.env.NO_THEME) await applyTheme("AcousticSense_Anomaly_Detection_34slides.pptx", THEME);
  console.log("written");
})().catch((e) => { console.error(e); process.exit(1); });

import { useEffect, useState } from 'react'
import type { Analysis, ModelInfo } from '../api'
import { fmtScore } from '../lib/decode'
import Icon from './Icons'

type Sev = Analysis['verdict']['severity']
const HEAD: Record<Sev, string> = {
  healthy: 'Sounds like a healthy machine.',
  borderline: 'Close to the alarm limit.',
  anomalous: "This doesn't sound healthy.",
  severe: 'This sounds clearly abnormal.',
}
export const severityOf = (ratio: number): Sev => (ratio < 0.8 ? 'healthy' : ratio < 1 ? 'borderline' : ratio < 1.5 ? 'anomalous' : 'severe')

/** The clip's error score placed among reference recordings the model has never trained on. */
function Ruler({ model, score, threshold }: { model: ModelInfo; score: number; threshold: number }) {
  const W = 900, H = 142, ml = 76, mr = 14, top = 34
  const faulty = [...model.scores.test_faulty].sort((a, b) => a - b)
  const hi = Math.max(score * 1.1, threshold * 2, faulty[Math.floor(faulty.length * 0.9)] ?? 0)
  const X = (v: number) => ml + (Math.min(v, hi) / hi) * (W - ml - mr)
  const [shown, setShown] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setShown(score)); return () => cancelAnimationFrame(id) }, [score])
  const rows: [string, number[], string, number][] = [
    ['healthy', [...model.scores.val, ...model.scores.test_healthy], 'var(--ok)', top + 8],
    ['faulty', model.scores.test_faulty, 'var(--bad)', top + 52]]
  const needleColor = score > threshold ? 'var(--bad)' : 'var(--ok)'
  return (
    <div className="screen ruler">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
        aria-label={`Error score ${fmtScore(score)} against an alarm limit of ${fmtScore(threshold)}`}>
        {rows.map(([name, vals, color, y]) => (
          <g key={name}>
            <text x={ml - 10} y={y + 17} className="tick" textAnchor="end">{name}</text>
            <line x1={ml} x2={W - mr} y1={y + 17} y2={y + 17} className="grid" />
            {vals.map((v, i) => <line key={i} x1={X(v)} x2={X(v)} y1={y + 3} y2={y + 31} stroke={color} strokeWidth={2} opacity={0.4} />)}
          </g>))}
        <line x1={X(threshold)} x2={X(threshold)} y1={top - 6} y2={H - 14} className="thr" />
        <text x={X(threshold) + 6} y={H - 2} className="tick" fill="var(--warn)">alarm limit {fmtScore(threshold)}</text>
        <g style={{ transform: `translateX(${X(shown)}px)`, transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }}>
          <line y1={top - 8} y2={H - 14} stroke={needleColor} strokeWidth={3} />
          <path d={`M-6,${top - 8} L6,${top - 8} L0,${top} Z`} fill={needleColor} />
          <text y={top - 14} className="tick" textAnchor={X(score) > W - 130 ? 'end' : 'start'} dx={X(score) > W - 130 ? -8 : 8}
            fill="var(--text)" style={{ fontSize: 13, fontWeight: 650 }}>this clip {fmtScore(score)}</text>
        </g>
      </svg>
    </div>
  )
}

export default function Verdict({ a, model, threshold, pct, minPct, defaultPct, onPct, onExport }: {
  a: Analysis; model: ModelInfo; threshold: number; pct: number; minPct: number; defaultPct: number
  onPct: (p: number) => void; onExport: () => void
}) {
  const score = a.verdict.score, ratio = score / threshold, sev = severityOf(ratio)
  const bad = a.windows.filter(w => w.score > threshold)
  const worst = a.windows[a.verdict.worst_window]
  const sub = bad.length === 0
    ? `None of the ${a.windows.length} windows crossed the alarm limit.`
    : `${bad.length} of ${a.windows.length} windows crossed the alarm limit. The biggest mismatch is at ${worst.start_s.toFixed(1)}–${worst.end_s.toFixed(1)} seconds.`
  return (
    <section id="verdict" className={`verdict ${sev}`} aria-labelledby="verdict-h">
      <div className="v-head">
        <div>
          <p className="v-file">{a.filename}</p>
          <h2 id="verdict-h" className="v-title">{HEAD[sev]}</h2>
          <p className="v-sub">{sub}</p>
        </div>
        <div className="v-num" aria-label={`${ratio.toFixed(2)} times the alarm limit`}>
          <b>{ratio.toFixed(2)}×</b>
          <span>the alarm limit · score {fmtScore(score)}</span>
        </div>
      </div>
      <Ruler model={model} score={score} threshold={threshold} />
      <dl className="facts">
        <div><dt>Error score</dt><dd>{fmtScore(score)}</dd></div>
        <div><dt>Higher than healthy clips</dt><dd>{a.verdict.healthy_percentile}%</dd></div>
        <div><dt>Windows over the limit</dt><dd>{bad.length} / {a.windows.length}</dd></div>
        <div><dt>Clip length</dt><dd>{a.metadata.duration_s.toFixed(1)} s</dd></div>
      </dl>
      <div className="v-foot">
        <label className="sens">
          <span>Alarm limit at the <b>{pct.toFixed(1)}th percentile</b> of healthy clips. About {(100 - pct).toFixed(1)}% of healthy recordings would raise a false alarm.
            {pct !== defaultPct && <button className="link" onClick={() => onPct(defaultPct)}>Reset to {defaultPct}th</button>}</span>
          <input type="range" min={minPct} max={100} step={0.5} value={pct} onChange={e => onPct(+e.target.value)} aria-label="Alarm limit percentile" />
          <small><span>More alarms</span><span>Fewer false alarms</span></small>
        </label>
        <button className="btn line" onClick={onExport}><Icon name="down" size={16} />Download report</button>
      </div>
    </section>
  )
}

import type { Analysis } from '../api'
import { fmtScore } from '../lib/decode'

const LABEL = { healthy: 'Healthy', borderline: 'Borderline', anomalous: 'Anomaly detected', severe: 'Severe anomaly' } as const

export function severityOf(ratio: number): keyof typeof LABEL {
  return ratio < 0.8 ? 'healthy' : ratio < 1 ? 'borderline' : ratio < 1.5 ? 'anomalous' : 'severe'
}

export default function Verdict({ a, threshold, pct, minPct, onPct, defaultPct, onExport }: {
  a: Analysis; threshold: number; pct: number; minPct: number; defaultPct: number
  onPct: (p: number) => void; onExport: () => void
}) {
  const score = a.verdict.score, ratio = score / threshold, sev = severityOf(ratio)
  const nBad = a.windows.filter(w => w.score > threshold).length
  const fill = Math.min(ratio / 2, 1) * 100          // gauge: centre mark = threshold
  return (
    <section className={`card verdict ${sev}`}>
      <div className="v-main">
        <div className="badge">{score > threshold ? '⚠' : '✓'}</div>
        <div>
          <div className="v-title">{LABEL[sev]}</div>
          <div className="v-sub">{a.filename}</div>
        </div>
        <button className="ghost" onClick={onExport}>Export report</button>
      </div>
      <div className="gauge" aria-label={`Score is ${ratio.toFixed(2)}× the threshold`}>
        <div className="g-fill" style={{ width: `${fill}%` }} />
        <div className="g-mark" style={{ left: '50%' }}><span>threshold</span></div>
      </div>
      <dl className="stats">
        <div><dt>Clip score (MSE)</dt><dd>{fmtScore(score)}</dd></div>
        <div><dt>vs. threshold</dt><dd>{ratio.toFixed(2)}×</dd></div>
        <div><dt>Healthier than</dt><dd title="Share of healthy validation clips that scored lower">{a.verdict.healthy_percentile}%</dd></div>
        <div><dt>Anomalous windows</dt><dd>{nBad} / {a.windows.length}</dd></div>
        <div><dt>Worst window</dt><dd>#{a.verdict.worst_window} · {a.windows[a.verdict.worst_window].start_s.toFixed(1)}s</dd></div>
      </dl>
      <label className="sens">
        <span>Sensitivity — threshold at <b>P{pct.toFixed(1)}</b> of healthy validation scores
          {pct !== defaultPct && <button className="link" onClick={() => onPct(defaultPct)}>reset to P{defaultPct}</button>}</span>
        <input type="range" min={minPct} max={100} step={0.5} value={pct} onChange={e => onPct(+e.target.value)} />
        <small>← more sensitive (more alarms) · fewer false alarms →</small>
      </label>
    </section>
  )
}

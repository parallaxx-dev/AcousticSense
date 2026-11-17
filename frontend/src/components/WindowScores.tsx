import type { Analysis } from '../api'
import { fmtScore } from '../lib/decode'

/** Per-window reconstruction error vs. decision threshold. Click a bar to inspect that window. */
export default function WindowScores({ a, selected, threshold, onSelect }: {
  a: Analysis; selected: number; threshold: number; onSelect: (i: number) => void
}) {
  const W = 520, H = 170, ml = 44, mb = 24, mt = 10, mr = 8
  const ws = a.windows
  const max = Math.max(threshold * 1.25, ...ws.map(w => w.score)) * 1.05
  const bw = (W - ml - mr) / ws.length
  const y = (v: number) => mt + (1 - v / max) * (H - mt - mb)
  const ticks = [0, 0.5, 1].map(f => f * max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Anomaly score per window">
      {ticks.map(t => (
        <g key={t}>
          <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} className="grid" />
          <text x={ml - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{fmtScore(t)}</text>
        </g>
      ))}
      {ws.map(w => {
        const bad = w.score > threshold
        return (
          <g key={w.index} onClick={() => onSelect(w.index)} style={{ cursor: 'pointer' }}>
            <rect x={ml + w.index * bw + 3} y={y(w.score)} width={Math.max(bw - 6, 2)} height={y(0) - y(w.score)}
              className={bad ? 'bar bad' : 'bar ok'} opacity={w.index === selected ? 1 : 0.55}
              stroke={w.index === selected ? 'var(--text)' : 'none'} rx={2}>
              <title>{`${w.start_s.toFixed(2)}–${w.end_s.toFixed(2)}s  score ${fmtScore(w.score)}`}</title>
            </rect>
            <text x={ml + w.index * bw + bw / 2} y={H - 8} className="tick" textAnchor="middle">{w.start_s.toFixed(1)}s</text>
          </g>
        )
      })}
      <line x1={ml} x2={W - mr} y1={y(threshold)} y2={y(threshold)} className="thr" />
      <text x={W - mr} y={y(threshold) - 4} className="tick" textAnchor="end" fill="var(--warn)">alarm limit {fmtScore(threshold)}</text>
    </svg>
  )
}

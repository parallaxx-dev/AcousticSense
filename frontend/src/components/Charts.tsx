import { fmtHz, fmtScore, melRowForHz } from '../lib/decode'

const line = (xs: number[], ys: number[], X: (v: number) => number, Y: (v: number) => number) =>
  xs.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ')

/** Mean reconstruction error per mel band; optional healthy baseline from the training evaluation. */
export function BandProfile({ values, baseline, label = 'this clip' }: { values: number[]; baseline?: number[]; label?: string }) {
  const W = 640, H = 190, ml = 48, mb = 26, mt = 8, mr = 8
  const all = [...values, ...(baseline ?? [])].filter(v => v > 0)
  const lo = Math.log10(Math.min(...all)), hi = Math.log10(Math.max(...all))
  const X = (i: number) => ml + (i / (values.length - 1)) * (W - ml - mr)
  const Y = (v: number) => mt + (1 - (Math.log10(Math.max(v, 1e-12)) - lo) / (hi - lo || 1)) * (H - mt - mb)
  const idx = values.map((_, i) => i)
  const ticks = [lo, (lo + hi) / 2, hi].map(l => 10 ** l)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Reconstruction error per mel band">
      {ticks.map(t => (<g key={t}><line x1={ml} x2={W - mr} y1={Y(t)} y2={Y(t)} className="grid" />
        <text x={ml - 6} y={Y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{fmtScore(t)}</text></g>))}
      {[100, 500, 1000, 2000, 4000, 8000].map(hz => {
        const x = X(Math.min(values.length - 1, melRowForHz(hz, values.length)))
        return <text key={hz} x={x} y={H - 8} className="tick" textAnchor="middle">{fmtHz(hz)}Hz</text>
      })}
      {baseline && <path d={line(idx, baseline, X, Y)} className="ln base" />}
      <path d={line(idx, values, X, Y)} className="ln main" />
      <g className="legend" transform={`translate(${ml + 8},${mt + 6})`}>
        <circle r={4} fill="var(--accent)" /><text x={9} dominantBaseline="middle">{label}</text>
        {baseline && <><circle cx={86} r={4} fill="var(--muted)" /><text x={95} dominantBaseline="middle">healthy baseline</text></>}
      </g>
    </svg>
  )
}

export function Latent({ values }: { values: number[] }) {
  const W = 320, H = 90, n = values.length, max = Math.max(...values.map(Math.abs), 1e-6)
  const bw = W / n
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Latent code">
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="grid" />
      {values.map((v, i) => {
        const h = (Math.abs(v) / max) * (H / 2 - 4)
        return <rect key={i} x={i * bw + 1} width={bw - 2} y={v >= 0 ? H / 2 - h : H / 2} height={Math.max(h, 1)} rx={1}
          fill={v >= 0 ? 'var(--accent)' : 'var(--warn)'} opacity={0.85}><title>z{i} = {v.toFixed(3)}</title></rect>
      })}
    </svg>
  )
}

export function Roc({ fpr, tpr, auc, pauc }: { fpr: number[]; tpr: number[]; auc: number; pauc: number }) {
  const S = 320, m = 34, X = (v: number) => m + v * (S - m - 10), Y = (v: number) => S - m - v * (S - m - 10)
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="chart square" role="img" aria-label="ROC curve">
      <rect x={X(0)} y={Y(1)} width={X(0.1) - X(0)} height={Y(0) - Y(1)} fill="var(--warn)" opacity={0.14} />
      {[0, 0.5, 1].map(t => (<g key={t}><line x1={X(0)} x2={X(1)} y1={Y(t)} y2={Y(t)} className="grid" />
        <text x={X(0) - 6} y={Y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{t}</text>
        <text x={X(t)} y={S - m + 14} className="tick" textAnchor="middle">{t}</text></g>))}
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} className="thr" />
      <path d={`${line(fpr, tpr, X, Y)} L${X(1)},${Y(0)} L${X(0)},${Y(0)} Z`} fill="var(--accent)" opacity={0.1} />
      <path d={line(fpr, tpr, X, Y)} className="ln main" />
      <text x={X(1) - 6} y={Y(0) - 28} className="tick" textAnchor="end" fill="var(--text)">AUC {auc.toFixed(3)}</text>
      <text x={X(1) - 6} y={Y(0) - 12} className="tick" textAnchor="end" fill="var(--warn)">pAUC@0.1 {pauc.toFixed(3)}</text>
      <text x={S / 2} y={S - 4} className="tick" textAnchor="middle">false positive rate</text>
      <text x={10} y={S / 2} className="tick" textAnchor="middle" transform={`rotate(-90 10 ${S / 2})`}>true positive rate</text>
    </svg>
  )
}

export function Histogram({ groups, threshold, marker }: {
  groups: { name: string; values: number[]; color: string }[]; threshold: number; marker?: number
}) {
  const W = 640, H = 220, ml = 12, mb = 26, mt = 10, mr = 12, nb = 40
  const all = groups.flatMap(g => g.values).concat(threshold, marker ?? threshold)
  const lo = Math.min(...all), hi = Math.max(...all), bw = (hi - lo) / nb || 1
  const dens = groups.map(g => {
    const c = new Array(nb).fill(0)
    g.values.forEach(v => { c[Math.min(nb - 1, Math.floor((v - lo) / bw))]++ })
    return c.map(x => x / (g.values.length || 1) / bw)
  })
  const ymax = Math.max(...dens.flat(), 1e-9)
  const X = (v: number) => ml + ((v - lo) / (hi - lo || 1)) * (W - ml - mr)
  const Y = (v: number) => mt + (1 - v / ymax) * (H - mt - mb)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Score distributions">
      <line x1={ml} x2={W - mr} y1={Y(0)} y2={Y(0)} className="grid" />
      {groups.map((g, gi) => dens[gi].map((d, i) => (
        <rect key={`${gi}-${i}`} x={X(lo + i * bw)} y={Y(d)} width={Math.max(X(lo + bw) - X(lo) - 1, 1)} height={Y(0) - Y(d)}
          fill={g.color} opacity={0.5} />)))}
      <line x1={X(threshold)} x2={X(threshold)} y1={mt} y2={Y(0)} className="thr" />
      <text x={X(threshold) + 5} y={mt + 10} className="tick" fill="var(--warn)">threshold</text>
      {marker !== undefined && <>
        <line x1={X(marker)} x2={X(marker)} y1={mt} y2={Y(0)} stroke="var(--text)" strokeWidth={2} />
        <text x={X(marker) - 5} y={mt + 24} className="tick" textAnchor="end" fill="var(--text)">this clip</text></>}
      {[lo, (lo + hi) / 2, hi].map(t => <text key={t} x={X(t)} y={H - 8} className="tick" textAnchor={t === lo ? 'start' : t === hi ? 'end' : 'middle'}>{fmtScore(t)}</text>)}
      <g className="legend" transform={`translate(${W - mr - 150},${mt + 4})`}>
        {groups.map((g, i) => <g key={g.name} transform={`translate(0,${i * 16})`}><rect width={10} height={10} y={-5} fill={g.color} opacity={0.7} rx={2} /><text x={15} dominantBaseline="middle">{g.name}</text></g>)}
      </g>
    </svg>
  )
}

export function LossCurve({ loss, val }: { loss: number[]; val: number[] }) {
  const W = 640, H = 200, ml = 54, mb = 26, mt = 8, mr = 8
  const all = [...loss, ...val], lo = Math.log10(Math.min(...all)), hi = Math.log10(Math.max(...all))
  const n = loss.length
  const X = (i: number) => ml + (i / Math.max(n - 1, 1)) * (W - ml - mr)
  const Y = (v: number) => mt + (1 - (Math.log10(v) - lo) / (hi - lo || 1)) * (H - mt - mb)
  const idx = loss.map((_, i) => i)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Training loss">
      {[lo, (lo + hi) / 2, hi].map(l => <g key={l}><line x1={ml} x2={W - mr} y1={Y(10 ** l)} y2={Y(10 ** l)} className="grid" />
        <text x={ml - 6} y={Y(10 ** l)} className="tick" textAnchor="end" dominantBaseline="middle">{fmtScore(10 ** l)}</text></g>)}
      <path d={line(idx, loss, X, Y)} className="ln main" />
      <path d={line(idx, val, X, Y)} className="ln warn" />
      <text x={W / 2} y={H - 6} className="tick" textAnchor="middle">epoch (MSE, log scale)</text>
      <g className="legend" transform={`translate(${W - 120},${mt + 8})`}>
        <circle r={4} fill="var(--accent)" /><text x={9} dominantBaseline="middle">train</text>
        <circle cx={56} r={4} fill="var(--warn)" /><text x={65} dominantBaseline="middle">val</text></g>
    </svg>
  )
}

export function Confusion({ m }: { m: number[][] }) {
  const lab = ['healthy', 'faulty'], max = Math.max(...m.flat())
  return (
    <div className="cm">
      <span /><span className="cl">pred healthy</span><span className="cl">pred faulty</span>
      {m.map((row, i) => [<span key={`l${i}`} className="cl">{lab[i]}</span>,
        ...row.map((v, j) => <span key={`${i}${j}`} className={`cc ${i === j ? 'good' : 'wrong'}`}
          style={{ ['--a' as string]: 0.15 + 0.7 * (v / max) }}>{v}</span>)])}
    </div>
  )
}

import type { ModelSummary } from '../api'

const MACHINES = ['fan', 'pump', 'slider', 'valve']
const f3 = (v: number | null) => (v === null || Number.isNaN(v) ? '–' : v.toFixed(3))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

export default function Compare({ models, onPick }: { models: ModelSummary[]; onPick: (id: string) => void }) {
  const k = models.filter(m => m.source === 'kaggle')
  const units = [...new Set(k.map(m => m.unit))].sort()
  const overall = mean(k.map(m => m.auc))
  const beat = k.filter(m => m.published_auc !== null && m.auc > m.published_auc).length
  return (
    <div className="stack">
      <section aria-labelledby="cmp-h">
        <h1 id="cmp-h">Which machines does it hear well?</h1>
        <p className="lead" style={{ marginTop: '1.4rem' }}>One convolutional autoencoder per machine unit, each trained on healthy 6 dB recordings only.
          Across all {k.length} units the average AUC is <b>{overall.toFixed(3)}</b>, and the model beats the published MIMII baseline on <b>{beat} of {k.length}</b>.
          Choose a cell to analyse a recording with that model.</p>
      </section>

      <section className="block" aria-labelledby="grid-h">
        <header><div><h2 id="grid-h">AUC by machine and unit</h2>
          <p>Green means faults rank clearly above healthy sound. Red means the model barely separates them.</p></div></header>
        <div className="grid-auc">
          <span />{units.map(u => <span key={u} className="hd">Unit {u.replace('id_', '')}</span>)}
          {MACHINES.filter(mc => k.some(m => m.machine === mc)).map(mc => {
            const row = k.filter(m => m.machine === mc)
            return [
              <div key={mc} className="rowh">{mc}<br /><small>mean {mean(row.map(m => m.auc)).toFixed(2)}</small></div>,
              ...units.map(u => {
                const m = row.find(x => x.unit === u)
                if (!m) return <span key={u} />
                return (
                  <button key={u} className="cell" style={{ ['--q' as string]: Math.max(0, Math.min(1, (m.auc - 0.5) / 0.5)) }}
                    onClick={() => onPick(m.id)} aria-label={`${m.label}: AUC ${m.auc.toFixed(3)}. Analyse with this model`}>
                    <b>{m.auc.toFixed(2)}</b>
                    <small>{m.published_auc !== null && <>baseline {m.published_auc.toFixed(2)}</>}</small>
                  </button>)
              })]
          })}
        </div>
      </section>

      <section className="block" aria-labelledby="tbl-h">
        <header><div><h2 id="tbl-h">Against the other approaches</h2>
          <p>The dense autoencoder is a healthy-only model like this one. The supervised CNN also saw faulty examples while training, so it isn't a like-for-like comparison.</p></div></header>
        <table className="tbl">
          <thead><tr><th>Model</th><th className="num">Conv autoencoder</th><th className="num">Dense autoencoder</th><th className="num">Supervised CNN</th><th className="num">MIMII baseline</th><th className="num">Conv vs baseline</th></tr></thead>
          <tbody>{k.map(m => {
            const d = m.published_auc === null ? null : m.auc - m.published_auc
            return (
              <tr key={m.id}><td><button className="link" style={{ margin: 0 }} onClick={() => onPick(m.id)}>{m.label}</button></td>
                <td className="num">{f3(m.auc)}</td><td className="num">{f3(m.dense_auc)}</td><td className="num">{f3(m.supervised_auc)}</td>
                <td className="num">{f3(m.published_auc)}</td>
                <td className={`num ${d === null ? '' : d >= 0 ? 'up' : 'down'}`}>{d === null ? '–' : `${d >= 0 ? '+' : ''}${d.toFixed(3)}`}</td></tr>)
          })}</tbody>
        </table>
        <p className="cap">The columns come from separate Kaggle runs. Check that they used the same train/test split before reading small gaps as real.</p>
      </section>
    </div>
  )
}

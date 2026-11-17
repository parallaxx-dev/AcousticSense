import type { ModelSummary } from '../api'

const MACHINES = ['fan', 'pump', 'slider', 'valve']

/** Choose which trained model analyses the clip: a machine type and one of its four units. */
export default function ModelPicker({ models, value, onChange }: {
  models: ModelSummary[]; value: string; onChange: (id: string) => void
}) {
  const cur = models.find(m => m.id === value)
  if (!cur) return null
  const kaggle = models.filter(m => m.source === 'kaggle')
  const units = kaggle.filter(m => m.machine === cur.machine)
  const local = models.filter(m => m.source === 'local')
  const pick = (machine: string) => onChange((kaggle.find(m => m.machine === machine && m.unit === cur.unit) ?? kaggle.find(m => m.machine === machine))!.id)
  return (
    <div className="picker">
      <div className="pick">
        <span id="pm">Machine</span>
        <div className="seg" role="group" aria-labelledby="pm">
          {MACHINES.filter(mc => kaggle.some(m => m.machine === mc)).map(mc => (
            <button key={mc} aria-pressed={cur.machine === mc && cur.source === 'kaggle'} onClick={() => pick(mc)}>{mc}</button>))}
        </div>
      </div>
      <div className="pick">
        <span id="pu">Unit</span>
        <div className="seg" role="group" aria-labelledby="pu">
          {units.map(m => <button key={m.id} aria-pressed={cur.id === m.id} onClick={() => onChange(m.id)}>{m.unit.replace('id_', '')}</button>)}
        </div>
      </div>
      {local.map(m => (
        <div className="pick" key={m.id}>
          <span>Also available</span>
          <div className="seg"><button aria-pressed={cur.id === m.id} onClick={() => onChange(m.id)}>Local {m.machine} {m.unit.replace('id_', '')}</button></div>
        </div>))}
      <p className="pick-note">
        <b>{cur.label}</b>: AUC {cur.auc.toFixed(3)}{cur.snr !== null ? ` on ${cur.snr} dB recordings` : ' on local recordings'}
        {cur.published_auc !== null && <>, MIMII paper baseline {cur.published_auc.toFixed(2)}</>}.
      </p>
    </div>
  )
}

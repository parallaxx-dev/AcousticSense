import { useCallback, useEffect, useState } from 'react'
import { getModel, getSamples, type Analysis, type ModelInfo, type Sample } from './api'
import Analyze from './views/Analyze'
import Performance from './views/Performance'
import { fmtScore } from './lib/decode'

type Tab = 'analyze' | 'model'
interface HistoryItem { id: number; name: string; score: number; threshold: number }
const KEY = 'acousticsense.history'

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('analyze')
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory)

  useEffect(() => {
    Promise.all([getModel(), getSamples().catch(() => [])])
      .then(([m, s]) => { setModel(m); setSamples(s) })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const onResult = useCallback((a: Analysis) => {
    setHistory(h => {
      const next = [{ id: Date.now(), name: a.filename.split('/').pop() ?? a.filename, score: a.verdict.score, threshold: a.verdict.threshold }, ...h].slice(0, 8)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }, [])

  return (
    <>
      <aside className="rail">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><path d="M2 16h4l3-9 5 18 5-22 4 18 2-5h5" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Acoustic<span>Sense</span></span>
        </div>
        <nav aria-label="Sections">
          <button className={tab === 'analyze' ? 'on' : ''} onClick={() => setTab('analyze')}>Analyse a recording</button>
          <button className={tab === 'model' ? 'on' : ''} onClick={() => setTab('model')} disabled={!model}>Model performance</button>
        </nav>
        {history.length > 0 && (
          <div className="hist-wrap">
            <h2>This session</h2>
            <ul className="hist">
              {history.map(h => (
                <li key={h.id} title={`${h.name}: ${fmtScore(h.score)}`}>
                  <i className={h.score > h.threshold ? 'bad' : ''} />
                  <span className="nm">{h.name}</span>
                  <span className="x">{(h.score / h.threshold).toFixed(2)}×</span>
                </li>))}
            </ul>
          </div>
        )}
        <div className={`status ${model ? 'ok' : error ? 'bad' : ''}`} role="status">
          <i />{model ? `Model ready: ${model.machine} ${model.machine_id.replace('_', ' ')}` : error ? 'Model API offline' : 'Connecting to the model…'}
        </div>
      </aside>
      <main className="content">
        {error && (
          <div className="alert bad" role="alert">
            <b>Can't reach the model API.</b> {error}
            <p className="cap">Start it with <code>uvicorn app.main:app --port 8000</code> from <code>backend/</code>. If the model is missing, run <code>python backend/train.py</code> first.</p>
          </div>
        )}
        {model && (tab === 'analyze'
          ? <Analyze model={model} samples={samples} onResult={onResult} />
          : <Performance m={model} />)}
        <footer>An unsupervised 2D convolutional autoencoder, trained on healthy audio only.</footer>
      </main>
    </>
  )
}

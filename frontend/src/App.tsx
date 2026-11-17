import { useCallback, useEffect, useState } from 'react'
import { getModel, getSamples, type Analysis, type ModelInfo, type Sample } from './api'
import Analyze, { type HistoryItem } from './views/Analyze'
import Performance from './views/Performance'

type Tab = 'analyze' | 'model'
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
      const next = [{ id: Date.now(), name: a.filename, score: a.verdict.score, threshold: a.verdict.threshold,
        at: new Date().toLocaleTimeString() }, ...h].slice(0, 12)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }, [])

  return (
    <>
      <header className="top">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 32 32"><path d="M2 16h4l3-9 5 18 5-22 4 18 2-5h5" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Acoustic<b>Sense</b></span>
        </div>
        <nav>
          <button className={tab === 'analyze' ? 'on' : ''} onClick={() => setTab('analyze')}>Analyse</button>
          <button className={tab === 'model' ? 'on' : ''} onClick={() => setTab('model')} disabled={!model}>Model performance</button>
        </nav>
        <div className={`status ${model ? 'ok' : error ? 'bad' : ''}`}>
          <i />{model ? `${model.machine} ${model.machine_id.replace('_', ' ')} · CAE` : error ? 'API offline' : 'connecting…'}
        </div>
      </header>
      <main>
        {error && (
          <div className="alert bad" role="alert">
            <b>Can't reach the model API.</b> {error}
            <div className="cap">Start it with <code>uvicorn app.main:app --port 8000</code> from <code>backend/</code>, and make sure artifacts exist (<code>python backend/train.py</code>).</div>
          </div>
        )}
        {model && (tab === 'analyze'
          ? <Analyze model={model} samples={samples} onResult={onResult} history={history} />
          : <Performance m={model} />)}
      </main>
      <footer>Unsupervised anomaly detection · 2D convolutional autoencoder · trained on healthy audio only</footer>
    </>
  )
}

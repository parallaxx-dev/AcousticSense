import { useCallback, useEffect, useState } from 'react'
import { getModel, getModels, getSamples, type Analysis, type ModelInfo, type ModelSummary, type Sample } from './api'
import Analyze from './views/Analyze'
import Performance from './views/Performance'
import Compare from './views/Compare'
import Icon from './components/Icons'
import { fmtScore } from './lib/decode'

type Tab = 'analyze' | 'model' | 'compare'
type Theme = 'system' | 'light' | 'dark'
interface HistoryItem { id: number; name: string; score: number; threshold: number }
const HKEY = 'acousticsense.history', TKEY = 'acousticsense.theme', MKEY = 'acousticsense.model'
const SECTIONS: [string, string][] = [['verdict', 'Verdict'], ['s1', 'Signal'], ['s2', 'Spectrogram'], ['s3', 'Error over time'], ['s4', 'Window inspector']]

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage unavailable */ } }

export default function App() {
  const [tab, setTab] = useState<Tab>('analyze')
  const [models, setModels] = useState<ModelSummary[]>([])
  const [modelId, setModelId] = useState<string | null>(null)
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(() => { try { return JSON.parse(read(HKEY) ?? '[]') } catch { return [] } })
  const [hasResult, setHasResult] = useState(false)
  const [active, setActive] = useState('verdict')
  const [theme, setTheme] = useState<Theme>(() => (read(TKEY) as Theme) || 'system')

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', theme)
    write(TKEY, theme)
  }, [theme])

  useEffect(() => {
    getModels().then(({ default: d, models: ms }) => {
      setModels(ms)
      const saved = read(MKEY)
      setModelId(ms.some(m => m.id === saved) ? saved! : d)
    }).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    if (!modelId) return
    let live = true
    write(MKEY, modelId)
    Promise.all([getModel(modelId), getSamples(modelId).catch(() => [])])
      .then(([m, s]) => { if (live) { setModel(m); setSamples(s); setError(null) } })
      .catch(e => live && setError(e instanceof Error ? e.message : String(e)))
    return () => { live = false }
  }, [modelId])

  const selectModel = useCallback((id: string, go?: Tab) => {
    setModelId(id); setHasResult(false)
    if (go) setTab(go)
  }, [])

  // Scroll-spy for the "On this page" list.
  useEffect(() => {
    if (!hasResult || tab !== 'analyze') return
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActive(vis.target.id)
    }, { rootMargin: '-15% 0px -70% 0px' })
    SECTIONS.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n) })
    return () => io.disconnect()
  }, [hasResult, tab, history.length])

  const onResult = useCallback((a: Analysis) => {
    setHasResult(true)
    setHistory(h => {
      const next = [{ id: Date.now(), name: a.filename.split('/').pop() ?? a.filename, score: a.verdict.score, threshold: a.verdict.threshold }, ...h].slice(0, 8)
      write(HKEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <>
      <aside className="rail">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)" /><path d="M5 16h4l2.5-7 4 14 3-10 2 3h6" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Acoustic<b>Sense</b></span>
        </div>
        <nav aria-label="Pages">
          <button className={`nav-btn ${tab === 'analyze' ? 'on' : ''}`} onClick={() => setTab('analyze')}><Icon name="wave" />Analyse</button>
          <button className={`nav-btn ${tab === 'model' ? 'on' : ''}`} onClick={() => setTab('model')} disabled={!model}><Icon name="chart" />Model performance</button>
          <button className={`nav-btn ${tab === 'compare' ? 'on' : ''}`} onClick={() => setTab('compare')} disabled={!models.length}><Icon name="grid" />Compare models</button>
        </nav>
        {hasResult && tab === 'analyze' && (
          <div className="group">
            <h2>On this page</h2>
            <ul className="toc">
              {SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} className={active === id ? 'on' : ''} onClick={() => setActive(id)}>{label}</a></li>)}
            </ul>
          </div>
        )}
        {history.length > 0 && (
          <div className="group">
            <h2>This session</h2>
            <ul className="hist">
              {history.map(h => (
                <li key={h.id} title={`${h.name}: score ${fmtScore(h.score)}`}>
                  <i className={h.score > h.threshold ? 'bad' : ''} /><span className="nm">{h.name}</span><span className="x">{(h.score / h.threshold).toFixed(2)}×</span>
                </li>))}
            </ul>
          </div>
        )}
        <div className="rail-foot">
          <div className="theme" role="group" aria-label="Colour theme">
            {([['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'auto', 'Match system']] as [Theme, 'sun', string][]).map(([t, icon, label]) => (
              <button key={t} aria-pressed={theme === t} aria-label={label} title={label} onClick={() => setTheme(t)}><Icon name={icon} size={16} /></button>))}
          </div>
          <div className={`status ${model ? 'ok' : error ? 'bad' : ''}`} role="status">
            <i />{model ? `Model ready · ${model.label}` : error ? 'Model API offline' : 'Connecting to the model…'}
          </div>
        </div>
      </aside>
      <main className="content">
        {error && (
          <div className="alert bad" role="alert">
            <b>Can't reach the model API.</b> {error}
            <p className="cap">Start it with <code>uvicorn app.main:app --port 8000</code> from <code>backend/</code>. If the model is missing, run <code>python backend/train.py</code> first.</p>
          </div>
        )}
        {tab === 'compare' && models.length > 0 && <Compare models={models} onPick={id => selectModel(id, 'analyze')} />}
        {model && tab === 'analyze' && <Analyze key={model.id} model={model} models={models} samples={samples} onResult={onResult} onSelect={id => selectModel(id)} />}
        {model && tab === 'model' && <Performance m={model} />}
        <footer>An unsupervised 2D convolutional autoencoder, trained on healthy audio only.</footer>
      </main>
    </>
  )
}

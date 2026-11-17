import { useCallback, useEffect, useState } from 'react'
import { getModel, getSamples, type Analysis, type ModelInfo, type Sample } from './api'
import Analyze from './views/Analyze'
import Performance from './views/Performance'
import Icon from './components/Icons'
import { fmtScore } from './lib/decode'

type Tab = 'analyze' | 'model'
type Theme = 'system' | 'light' | 'dark'
interface HistoryItem { id: number; name: string; score: number; threshold: number }
const HKEY = 'acousticsense.history', TKEY = 'acousticsense.theme'
const SECTIONS: [string, string][] = [['verdict', 'Verdict'], ['s1', 'Signal'], ['s2', 'Spectrogram'], ['s3', 'Error over time'], ['s4', 'Window inspector']]

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage unavailable */ } }

export default function App() {
  const [tab, setTab] = useState<Tab>('analyze')
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
    Promise.all([getModel(), getSamples().catch(() => [])])
      .then(([m, s]) => { setModel(m); setSamples(s) })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
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
            <i />{model ? `Model ready · ${model.machine} ${model.machine_id.replace('_', ' ')}` : error ? 'Model API offline' : 'Connecting to the model…'}
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
        {model && (tab === 'analyze' ? <Analyze model={model} samples={samples} onResult={onResult} /> : <Performance m={model} />)}
        <footer>An unsupervised 2D convolutional autoencoder, trained on healthy audio only.</footer>
      </main>
    </>
  )
}

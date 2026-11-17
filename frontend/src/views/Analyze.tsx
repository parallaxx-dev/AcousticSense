import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyzeFile, analyzeSample, sampleAudioUrl, type Analysis, type ModelInfo, type Sample } from '../api'
import { b64ToU8, fmtScore } from '../lib/decode'
import { cssGradient } from '../lib/colormap'
import { useAudio } from '../lib/useAudio'
import { css } from '../lib/useCanvas'
import Heatmap from '../components/Heatmap'
import Waveform from '../components/Waveform'
import WindowScores from '../components/WindowScores'
import { BandProfile, Histogram, Latent } from '../components/Charts'
import { Dropzone, SamplePicker } from '../components/Input'
import Verdict from '../components/Verdict'
import Pipeline from '../components/Pipeline'

export interface HistoryItem { id: number; name: string; score: number; threshold: number; at: string }

function quantile(sorted: number[], q: number) {        // numpy "linear" interpolation
  const p = q * (sorted.length - 1), lo = Math.floor(p), hi = Math.ceil(p)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo)
}

export default function Analyze({ model, samples, onResult, history }: {
  model: ModelInfo; samples: Sample[]; onResult: (a: Analysis) => void; history: HistoryItem[]
}) {
  const [a, setA] = useState<Analysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [sampleId, setSampleId] = useState<number | undefined>()
  const [sel, setSel] = useState(0)
  const [pct, setPct] = useState(model.config.percentile)
  const player = useAudio(audioUrl)

  const valSorted = useMemo(() => [...model.scores.val].sort((x, y) => x - y), [model])
  const minPct = 50
  const threshold = pct === model.config.percentile ? model.threshold : quantile(valSorted, pct / 100)

  useEffect(() => () => { if (audioUrl?.startsWith('blob:')) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  const run = useCallback(async (job: () => Promise<Analysis>, url: string, sid?: number) => {
    setBusy(true); setErr(null)
    try {
      const res = await job()
      setA(res); setSel(res.verdict.worst_window); setSampleId(sid); setAudioUrl(url); setPct(model.config.percentile)
      onResult(res)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [model.config.percentile, onResult])

  const onFile = (f: File) => run(() => analyzeFile(f), URL.createObjectURL(f))
  const onSample = (s: Sample) => run(() => analyzeSample(s.id), sampleAudioUrl(s.id), s.id)

  const win = a?.windows[sel]
  const decoded = useMemo(() => a && ({
    full: b64ToU8(a.full_mel.data),
    wins: a.windows.map(w => ({ input: b64ToU8(w.input), rec: b64ToU8(w.reconstruction), err: b64ToU8(w.error) })),
  }), [a])

  const melOverlay = useCallback((ctx: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }) => {
    if (!a) return
    const dur = a.waveform.duration_s
    a.windows.forEach(w => {
      const x0 = p.x + (w.start_s / dur) * p.w, x1 = p.x + (Math.min(w.end_s, dur) / dur) * p.w
      if (w.index === sel) {
        ctx.strokeStyle = w.score > threshold ? css('--bad') : css('--accent'); ctx.lineWidth = 2
        ctx.strokeRect(x0 + 1, p.y + 1, x1 - x0 - 2, p.h - 2)
      }
    })
    if (player.time > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(p.x + (player.time / dur) * p.w, p.y, 1.5, p.h) }
  }, [a, sel, threshold, player.time])

  const exportReport = () => {
    if (!a) return
    const { windows, waveform, full_mel, ...rest } = a
    const body = { ...rest, threshold_used: threshold, percentile_used: pct,
      windows: windows.map(({ index, start_s, end_s, score }) => ({ index, start_s, end_s, score, anomalous: score > threshold })) }
    const l = document.createElement('a')
    l.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }))
    l.download = `${a.filename.replace(/[^\w.-]+/g, '_')}.report.json`; l.click(); URL.revokeObjectURL(l.href)
  }

  const T = a?.shape.T ?? 64, Nm = a?.shape.n_mels ?? 128
  const winSec = a ? a.metadata.window_s * (T / 65) : 0     // 64 of 65 frames are kept

  return (
    <div className="stack">
      <section className="card intro">
        <div className="intro-l">
          <h2>Analyse a machine recording</h2>
          <p>The autoencoder was trained only on healthy <b>{model.machine} {model.machine_id.replace('_', ' ')}</b> sound.
            It reconstructs what it has learned; anything it can't reproduce — a bearing rattle, a rub, a new tone — shows up as error.</p>
          <SamplePicker samples={samples} onPick={onSample} busy={busy} active={sampleId} />
        </div>
        <Dropzone onFile={onFile} busy={busy} />
      </section>
      {err && <div className="alert bad" role="alert">{err}</div>}

      {a && win && decoded && (<>
        <Verdict a={a} threshold={threshold} pct={pct} minPct={minPct} defaultPct={model.config.percentile}
          onPct={setPct} onExport={exportReport} />
        {a.warnings.map(w => <div key={w} className="alert warn">{w}</div>)}

        <section className="card">
          <header className="c-head">
            <div><h3>1 · Audio signal</h3>
              <p>{a.metadata.duration_s.toFixed(2)} s at {a.metadata.sample_rate / 1000} kHz · peak {a.metadata.peak} · RMS {a.metadata.rms}.
                Shaded bands are the {a.metadata.n_windows} overlapping analysis windows (red = above threshold). Click to select.</p></div>
            <button className="primary" onClick={player.toggle} disabled={!player.ready}>{player.playing ? '❚❚ Pause' : '▶ Play'}</button>
          </header>
          <Waveform a={a} selected={sel} time={player.time} threshold={threshold} onSelect={setSel} onSeek={player.seek} />
        </section>

        <section className="card">
          <header className="c-head"><div><h3>2 · Log-Mel spectrogram</h3>
            <p>Waveform → STFT (1024-pt, hop 512) → 128 Mel filters → dB. Full clip, before windowing and normalisation.</p></div>
            <div className="cbar"><span>{a.full_mel.db_min.toFixed(0)} dB</span><i style={{ background: cssGradient('magma') }} /><span>{a.full_mel.db_max.toFixed(0)} dB</span></div>
          </header>
          <Heatmap data={decoded.full} rows={a.full_mel.n_mels} cols={a.full_mel.n_frames} seconds={a.waveform.duration_s}
            height={240} overlay={melOverlay} onClickTime={t => { player.seek(t); setSel(Math.min(a.windows.length - 1, Math.max(0, Math.floor(t / a.metadata.hop_s)))) }}
            readout={v => `${(a.full_mel.db_min + (v / 255) * (a.full_mel.db_max - a.full_mel.db_min)).toFixed(1)} dB`} />
        </section>

        <section className="card">
          <header className="c-head"><div><h3>3 · Reconstruction error over time</h3>
            <p>Clip score = mean of window scores. The decision is <code>score &gt; threshold</code>, with the threshold set from healthy validation clips.</p></div></header>
          <div className="two">
            <WindowScores a={a} selected={sel} threshold={threshold} onSelect={setSel} />
            <div>
              <Histogram threshold={threshold} marker={a.verdict.score} groups={[
                { name: 'healthy (val)', values: model.scores.val, color: css('--muted') || '#888' },
                { name: 'healthy (test)', values: model.scores.test_healthy, color: css('--ok') || '#3b8' },
                { name: 'faulty (test)', values: model.scores.test_faulty, color: css('--bad') || '#e55' }]} />
              <p className="cap">Where this clip falls among the reference score distributions.</p>
            </div>
          </div>
        </section>

        <section className="card">
          <header className="c-head">
            <div><h3>4 · Window inspector — #{win.index} <small>{win.start_s.toFixed(2)}–{win.end_s.toFixed(2)} s</small></h3>
              <p>What the network actually sees (normalised {Nm}×{T}), what it reconstructs through the {model.config.latent_dim}-d bottleneck, and where they disagree.
                Window score <b className={win.score > threshold ? 'txt-bad' : 'txt-ok'}>{fmtScore(win.score)}</b>.</p></div>
            <div className="nav">
              <button className="ghost" disabled={sel === 0} onClick={() => setSel(sel - 1)}>‹ prev</button>
              <button className="ghost" disabled={sel === a.windows.length - 1} onClick={() => setSel(sel + 1)}>next ›</button>
            </div>
          </header>
          <div className="triptych">
            <figure><figcaption>Input <small>X (normalised)</small></figcaption>
              <Heatmap data={decoded.wins[sel].input} rows={Nm} cols={T} seconds={winSec} xOffset={win.start_s} height={230} smooth={false}
                readout={v => (v / 255).toFixed(3)} /></figure>
            <figure><figcaption>Reconstruction <small>X̂</small></figcaption>
              <Heatmap data={decoded.wins[sel].rec} rows={Nm} cols={T} seconds={winSec} xOffset={win.start_s} height={230} smooth={false}
                readout={v => (v / 255).toFixed(3)} /></figure>
            <figure><figcaption>Absolute error <small>|X − X̂|, scale 0–{a.err_max.toFixed(2)}</small></figcaption>
              <Heatmap data={decoded.wins[sel].err} rows={Nm} cols={T} seconds={winSec} xOffset={win.start_s} height={230} smooth={false} cmap="inferno"
                readout={v => ((v / 255) * a.err_max).toFixed(3)} /></figure>
          </div>
          <div className="two lower">
            <div><h4>Error by frequency band</h4>
              <BandProfile values={win.band_error} baseline={model.band_error.healthy} label={`window #${win.index}`} />
              <p className="cap">Squared error per Mel band for this window vs. the average healthy test window — a band that sits far above the baseline points to the frequency range of the fault.</p></div>
            <div><h4>Latent code <small>z ∈ ℝ{model.config.latent_dim}</small></h4>
              <Latent values={win.latent} />
              <p className="cap">The whole window is squeezed into these {model.config.latent_dim} numbers. Healthy sound compresses well; unfamiliar sound can't, which is why the error rises.</p></div>
          </div>
        </section>

        <section className="card"><h3>How the clip was processed</h3><Pipeline />
          <p className="cap">Normalisation used train min/max = {a.norm.train_min.toFixed(1)} / {a.norm.train_max.toFixed(1)} dB (healthy training set only), values clipped to [0, 1].</p></section>
      </>)}

      {history.length > 0 && (
        <section className="card"><h3>Session history</h3>
          <table className="tbl"><thead><tr><th>Clip</th><th>Score</th><th>× threshold</th><th>Result</th><th>Time</th></tr></thead>
            <tbody>{history.map(h => (
              <tr key={h.id}><td>{h.name}</td><td className="mono">{fmtScore(h.score)}</td><td className="mono">{(h.score / h.threshold).toFixed(2)}×</td>
                <td><span className={`pill ${h.score > h.threshold ? 'bad' : 'ok'}`}>{h.score > h.threshold ? 'anomaly' : 'healthy'}</span></td>
                <td className="mono">{h.at}</td></tr>))}</tbody></table>
        </section>
      )}
    </div>
  )
}

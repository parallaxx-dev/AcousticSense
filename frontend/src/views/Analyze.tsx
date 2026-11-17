import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyzeFile, analyzeSample, sampleAudioUrl, type Analysis, type ModelInfo, type ModelSummary, type Sample } from '../api'
import { b64ToU8, fmtScore } from '../lib/decode'
import { cssGradient } from '../lib/colormap'
import { useAudio } from '../lib/useAudio'
import Heatmap from '../components/Heatmap'
import Waveform from '../components/Waveform'
import WindowScores from '../components/WindowScores'
import { BandProfile, Histogram, Latent } from '../components/Charts'
import { Dropzone, SamplePicker } from '../components/Input'
import Verdict from '../components/Verdict'
import Pipeline from '../components/Pipeline'
import HeroWave from '../components/HeroWave'
import Icon from '../components/Icons'
import ModelPicker from '../components/ModelPicker'

function quantile(sorted: number[], q: number) {        // numpy "linear" interpolation
  const p = q * (sorted.length - 1), lo = Math.floor(p), hi = Math.ceil(p)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo)
}

export default function Analyze({ model, models, samples, onResult, onSelect }: {
  model: ModelInfo; models: ModelSummary[]; samples: Sample[]; onResult: (a: Analysis) => void; onSelect: (id: string) => void
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

  const onFile = (f: File) => run(() => analyzeFile(f, model.id), URL.createObjectURL(f))
  const onSample = (s: Sample) => run(() => analyzeSample(s.id, model.id), sampleAudioUrl(s.id), s.id)

  const win = a?.windows[sel]
  const decoded = useMemo(() => a && ({
    full: b64ToU8(a.full_mel.data),
    wins: a.windows.map(w => ({ input: b64ToU8(w.input), rec: b64ToU8(w.reconstruction), err: b64ToU8(w.error) })),
  }), [a])

  const melOverlay = useCallback((ctx: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }, v: (n: string) => string) => {
    if (!a) return
    const dur = a.waveform.duration_s
    a.windows.forEach(w => {
      const x0 = p.x + (w.start_s / dur) * p.w, x1 = p.x + (Math.min(w.end_s, dur) / dur) * p.w
      if (w.index === sel) {
        ctx.strokeStyle = w.score > threshold ? v('--bad') : v('--accent'); ctx.lineWidth = 2
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
      <section className="hero" aria-labelledby="intake-h">
        <h1 id="intake-h">Hear what the model can't explain.</h1>
        <p className="lead">The model learned only from healthy {model.label} recordings. It rebuilds each sound
          from a {model.config.latent_dim}-number summary. A rattle, a rub or a new tone doesn't fit that summary, so it comes back wrong, and the mismatch is the warning.</p>
        <ModelPicker models={models} value={model.id} onChange={onSelect} />
        <div className="hero-grid">
          <Dropzone onFile={onFile} busy={busy} />
          <SamplePicker samples={samples} onPick={onSample} busy={busy} active={sampleId} note={model.snr !== null && samples.some(x => x.snr !== model.snr) ? `These clips may have a different noise level than the ${model.snr} dB recordings this model learned from, so their scores can shift.` : undefined} />
        </div>
        {!a && <HeroWave />}
      </section>
      {err && <div className="alert bad" role="alert">{err}</div>}

      {a && win && decoded && (<>
        <Verdict a={a} model={model} threshold={threshold} pct={pct} minPct={minPct} defaultPct={model.config.percentile}
          onPct={setPct} onExport={exportReport} />
        {a.warnings.map(w => <div key={w} className="alert warn">{w}</div>)}

        <section className="block" id="s1" aria-labelledby="s1h">
          <header>
            <div><h2 id="s1h">Signal</h2>
              <p>{a.metadata.duration_s.toFixed(2)} seconds at {a.metadata.sample_rate / 1000} kHz. The clip is cut into {a.metadata.n_windows} overlapping windows of {a.metadata.window_s.toFixed(1)} seconds.
                Red windows are over the alarm limit. Click one to inspect it.</p></div>
            <button className="btn" onClick={player.toggle} disabled={!player.ready}><Icon name={player.playing ? 'pause' : 'play'} size={15} />{player.playing ? 'Pause' : 'Play recording'}</button>
          </header>
          <div className="screen"><Waveform a={a} selected={sel} time={player.time} threshold={threshold} onSelect={setSel} onSeek={player.seek} /></div>
        </section>

        <section className="block" id="s2" aria-labelledby="s2h">
          <header>
            <div><h2 id="s2h">Mel spectrogram</h2>
              <p>Loudness at each frequency over time, on the perceptual mel scale. This is the picture the model actually reads.</p></div>
            <div className="cbar"><span>{a.full_mel.db_min.toFixed(0)} dB</span><i style={{ background: cssGradient('magma') }} /><span>{a.full_mel.db_max.toFixed(0)} dB</span></div>
          </header>
          <div className="screen"><Heatmap data={decoded.full} rows={a.full_mel.n_mels} cols={a.full_mel.n_frames} seconds={a.waveform.duration_s}
            height={240} overlay={melOverlay} onClickTime={t => { player.seek(t); setSel(Math.min(a.windows.length - 1, Math.max(0, Math.floor(t / a.metadata.hop_s)))) }}
            readout={v => `${(a.full_mel.db_min + (v / 255) * (a.full_mel.db_max - a.full_mel.db_min)).toFixed(1)} dB`} /></div>
        </section>

        <section className="block" id="s3" aria-labelledby="s3h">
          <header><div><h2 id="s3h">Error over time</h2>
            <p>Each bar is how badly one window was rebuilt. The clip's score is the average of the bars.</p></div></header>
          <div className="two">
            <div className="screen"><WindowScores a={a} selected={sel} threshold={threshold} onSelect={setSel} /></div>
            <div className="screen"><Histogram threshold={threshold} marker={a.verdict.score} groups={[
              { name: 'healthy (validation)', values: model.scores.val, color: 'var(--muted)' },
              { name: 'healthy (test)', values: model.scores.test_healthy, color: 'var(--ok)' },
              { name: 'faulty (test)', values: model.scores.test_faulty, color: 'var(--bad)' }]} /></div>
          </div>
        </section>

        <section className="block" id="s4" aria-labelledby="s4h">
          <header>
            <div><h2 id="s4h">Inspect window {win.index + 1} <small>{win.start_s.toFixed(2)}–{win.end_s.toFixed(2)} s</small></h2>
              <p>What went in, what the model rebuilt, and where they differ. Error score for this window:{' '}
                <b className={win.score > threshold ? 'txt-bad' : 'txt-ok'}>{fmtScore(win.score)}</b>.</p></div>
            <div className="btn-row">
              <button className="btn line" disabled={sel === 0} onClick={() => setSel(sel - 1)}>Previous</button>
              <button className="btn line" disabled={sel === a.windows.length - 1} onClick={() => setSel(sel + 1)}>Next</button>
            </div>
          </header>
          <div className="triptych">
            <figure><figcaption>Input</figcaption><div className="screen">
              <Heatmap data={decoded.wins[sel].input} rows={Nm} cols={T} seconds={winSec} xOffset={win.start_s} height={230} smooth={false} readout={v => (v / 255).toFixed(3)} /></div></figure>
            <figure><figcaption>Rebuilt by the model</figcaption><div className="screen">
              <Heatmap data={decoded.wins[sel].rec} rows={Nm} cols={T} seconds={winSec} xOffset={win.start_s} height={230} smooth={false} readout={v => (v / 255).toFixed(3)} /></div></figure>
            <figure><figcaption>Difference <small>scale 0 to {a.err_max.toFixed(2)}</small></figcaption><div className="screen">
              <Heatmap data={decoded.wins[sel].err} rows={Nm} cols={T} seconds={winSec} xOffset={win.start_s} height={230} smooth={false} cmap="inferno"
                readout={v => ((v / 255) * a.err_max).toFixed(3)} /></div></figure>
          </div>
          <div className="two sub">
            <div><h3>Which frequencies disagree</h3>
              <div className="screen"><BandProfile values={win.band_error} baseline={model.band_error?.healthy} label={`window ${win.index + 1}`} /></div>
              <p className="cap">{model.band_error ? 'Error per frequency band, against the average healthy window. A band far above the dashed line shows where the fault lives.' : 'Error per frequency band for this window. Peaks show which frequencies the model could not rebuild.'}</p></div>
            <div><h3>The {model.config.latent_dim}-number summary</h3>
              <div className="screen"><Latent values={win.latent} /></div>
              <p className="cap">The whole window squeezed through this bottleneck. Healthy sound compresses well. Unfamiliar sound doesn't, so the rebuild drifts.</p></div>
          </div>
        </section>

        <section className="block"><header><div><h2>How the clip was processed</h2></div></header>
          <Pipeline />
          <p className="cap">Scaled with the healthy training range of {a.norm.train_min.toFixed(1)} to {a.norm.train_max.toFixed(1)} dB, then clipped to 0–1.</p></section>
      </>)}
    </div>
  )
}

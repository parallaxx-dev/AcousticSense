import type { ModelInfo } from '../api'
import { fmtScore } from '../lib/decode'
import { BandProfile, Confusion, Histogram, LossCurve, Roc } from '../components/Charts'

export default function Performance({ m }: { m: ModelInfo }) {
  const c = m.config, n = m.counts
  return (
    <div className="stack">
      <section aria-labelledby="perf-h">
        <h1 id="perf-h">How well does it catch faults?</h1>
        <p className="lead" style={{ margin: '.9rem 0 1.6rem' }}>Trained on {n.train} healthy {m.machine} {m.machine_id.replace('_', ' ')} recordings ({n.val} held back for validation) and trained {new Date(m.trained_at).toLocaleDateString()}.
          Tested on {n.test_healthy} healthy and {n.test_faulty} faulty recordings it had never heard.</p>
        <div className="kpis">
          <div className="kpi"><span>AUC (ranking quality)</span><b>{m.metrics.auc.toFixed(3)}</b></div>
          <div className="kpi"><span>pAUC at 10% false alarms</span><b>{m.metrics.pauc.toFixed(3)}</b></div>
          <div className="kpi"><span>F1 at the {c.percentile}th percentile limit</span><b>{m.metrics.f1.toFixed(3)}</b></div>
          <div className="kpi"><span>Alarm limit (error score)</span><b className="sm">{fmtScore(m.threshold)}</b></div>
          <div className="kpi"><span>Model size</span><b className="sm">{(c.params / 1e3).toFixed(0)}k parameters</b></div>
        </div>
      </section>
      <div className="two">
        <section className="block"><header><div><h2>ROC curve</h2><p>Faults caught against false alarms at every possible limit. The shaded strip is the low-false-alarm range that pAUC measures.</p></div></header>
          <div className="screen"><Roc fpr={m.roc.fpr} tpr={m.roc.tpr} auc={m.metrics.auc} pauc={m.metrics.pauc} /></div></section>
        <section className="block"><header><div><h2>Confusion matrix</h2><p>Rows are the truth and columns are the model's call, using the {c.percentile}th percentile limit.</p></div></header>
          <Confusion m={m.confusion} /></section>
      </div>
      <section className="block"><header><div><h2>Score distributions</h2><p>Healthy and faulty recordings should separate. The overlap is where mistakes happen.</p></div></header>
        <div className="screen"><Histogram threshold={m.threshold} groups={[
          { name: 'healthy (validation)', values: m.scores.val, color: 'var(--muted)' },
          { name: 'healthy (test)', values: m.scores.test_healthy, color: 'var(--ok)' },
          { name: 'faulty (test)', values: m.scores.test_faulty, color: 'var(--bad)' }]} /></div></section>
      <div className="two">
        <section className="block"><header><div><h2>Training loss</h2><p>{m.history.loss.length} epochs. Training stopped early once validation loss stopped improving.</p></div></header>
          <div className="screen"><LossCurve loss={m.history.loss} val={m.history.val_loss} /></div></section>
        <section className="block"><header><div><h2>Where faults show up</h2><p>Average error per frequency band, faulty against healthy recordings.</p></div></header>
          <div className="screen"><BandProfile values={m.band_error.faulty} baseline={m.band_error.healthy} label="faulty recordings" /></div></section>
      </div>
      <section className="block"><header><div><h2>Configuration</h2></div></header>
        <dl className="cfg">
          {([['Sample rate', `${c.sr} Hz`], ['Spectrogram', `${c.n_fft}-point FFT, hop ${c.hop}`], ['Mel bands', c.n_mels],
            ['Window', `${(c.window_samples / c.sr).toFixed(2)} s, ${c.overlap * 100}% overlap`], ['Time frames per window', c.T],
            ['Bottleneck size', c.latent_dim], ['Clip score', 'mean of window scores'], ['Encoder filters', '32, 64, 128, 256']] as [string, string | number][])
            .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl></section>
    </div>
  )
}

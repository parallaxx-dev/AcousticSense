import type { ModelInfo } from '../api'
import { fmtScore } from '../lib/decode'
import { css } from '../lib/useCanvas'
import { BandProfile, Confusion, Histogram, LossCurve, Roc } from '../components/Charts'

export default function Performance({ m }: { m: ModelInfo }) {
  const c = m.config, n = m.counts
  return (
    <div className="stack">
      <section className="card intro single">
        <div>
          <h2>Model performance</h2>
          <p>Trained {new Date(m.trained_at).toLocaleString()} on <b>{n.train}</b> healthy {m.machine} {m.machine_id.replace('_', ' ')} clips (validation {n.val}).
            Evaluated on <b>{n.test_healthy}</b> held-out healthy and <b>{n.test_faulty}</b> faulty clips the model never saw.</p>
        </div>
      </section>
      <div className="kpis">
        <div className="card kpi"><span>AUC-ROC</span><b>{m.metrics.auc.toFixed(3)}</b></div>
        <div className="card kpi"><span>pAUC (FPR ≤ 0.1)</span><b>{m.metrics.pauc.toFixed(3)}</b></div>
        <div className="card kpi"><span>F1 @ P{c.percentile}</span><b>{m.metrics.f1.toFixed(3)}</b></div>
        <div className="card kpi"><span>Threshold</span><b className="sm">{fmtScore(m.threshold)}</b></div>
        <div className="card kpi"><span>Parameters</span><b>{(c.params / 1e3).toFixed(0)}k</b></div>
      </div>
      <div className="two">
        <section className="card"><h3>ROC curve</h3><Roc fpr={m.roc.fpr} tpr={m.roc.tpr} auc={m.metrics.auc} pauc={m.metrics.pauc} />
          <p className="cap">Shaded strip: the FPR ≤ 0.1 region used for pAUC — the operating range that matters when false alarms are costly.</p></section>
        <section className="card"><h3>Confusion matrix <small>at P{c.percentile} threshold</small></h3><Confusion m={m.confusion} />
          <p className="cap">Rows are the truth, columns the prediction; the threshold is the {c.percentile}th percentile of healthy validation clip scores.</p></section>
      </div>
      <section className="card"><h3>Clip score distributions</h3>
        <Histogram threshold={m.threshold} groups={[
          { name: 'healthy (val)', values: m.scores.val, color: css('--muted') || '#888' },
          { name: 'healthy (test)', values: m.scores.test_healthy, color: css('--ok') || '#3b8' },
          { name: 'faulty (test)', values: m.scores.test_faulty, color: css('--bad') || '#e55' }]} /></section>
      <div className="two">
        <section className="card"><h3>Training / validation loss</h3><LossCurve loss={m.history.loss} val={m.history.val_loss} />
          <p className="cap">Adam 1e-3 · EarlyStopping(10) · ReduceLROnPlateau(0.5, 4) · {m.history.loss.length} epochs.</p></section>
        <section className="card"><h3>Where faults show up <small>mean error per Mel band</small></h3>
          <BandProfile values={m.band_error.faulty} baseline={m.band_error.healthy} label="faulty test" />
          <p className="cap">Frequency regions where faulty machines are reconstructed worst, relative to healthy ones.</p></section>
      </div>
      <section className="card"><h3>Configuration</h3>
        <dl className="cfg">
          {([['Sample rate', `${c.sr} Hz`], ['STFT', `n_fft ${c.n_fft} · hop ${c.hop}`], ['Mel bins', c.n_mels],
            ['Window', `${(c.window_samples / c.sr).toFixed(2)} s · ${c.overlap * 100}% overlap`], ['Time frames', c.T],
            ['Latent dim', c.latent_dim], ['Clip aggregation', 'mean of windows'], ['Encoder', 'Conv 32→64→128→256']] as [string, string | number][])
            .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl></section>
    </div>
  )
}

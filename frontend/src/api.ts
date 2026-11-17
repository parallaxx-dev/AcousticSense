export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export interface Window {
  index: number; start_s: number; end_s: number; score: number; anomalous: boolean
  input: string; reconstruction: string; error: string
  latent: number[]; band_error: number[]
}
export interface Analysis {
  filename: string
  model: { id: string; label: string }
  metadata: { duration_s: number; sample_rate: number; n_samples: number; peak: number; rms: number
    n_windows: number; window_s: number; hop_s: number }
  verdict: { score: number; threshold: number; is_anomaly: boolean; ratio: number
    severity: 'healthy' | 'borderline' | 'anomalous' | 'severe'; healthy_percentile: number
    max_window_score: number; worst_window: number; n_anomalous_windows: number }
  warnings: string[]
  waveform: { min: number[]; max: number[]; duration_s: number }
  full_mel: { n_mels: number; n_frames: number; hop_s: number; db_min: number; db_max: number; data: string }
  windows: Window[]
  shape: { n_mels: number; T: number }
  err_max: number
  band_error_mean: number[]
  norm: { train_min: number; train_max: number }
}
export interface ModelSummary {
  id: string; label: string; machine: string; unit: string; source: 'kaggle' | 'local'; snr: number | null
  auc: number; pauc: number; f1: number
  published_auc: number | null; dense_auc: number | null; supervised_auc: number | null
}
export interface ModelInfo {
  id: string; label: string; machine: string; unit: string; source: 'kaggle' | 'local'; snr: number | null
  trained_at: string | null
  config: { sr: number; n_fft: number; hop: number; n_mels: number; window_samples: number; overlap: number
    T: number; latent_dim: number; percentile: number; params: number }
  counts: { train: number | null; val: number; test_healthy: number; test_faulty: number }
  metrics: { auc: number; pauc: number; f1: number; threshold: number
    bal_acc?: number; recall?: number; false_alarm?: number; recall_at_5pct_fa?: number }
  threshold: number
  val_percentiles: Record<string, number>
  roc: { fpr: number[]; tpr: number[] }
  confusion: number[][]
  scores: { val: number[]; test_healthy: number[]; test_faulty: number[] }
  history: { loss: number[]; val_loss: number[] }
  band_error: { healthy: number[]; faulty: number[] } | null
  published_auc: number | null
  compare: { dense_auc: number | null; supervised_auc: number | null }
  epochs: number; minutes: number | null
}
export interface Sample { id: number; label: 'normal' | 'abnormal'; name: string; machine: string; unit: string; snr: number | null }

async function parse<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try { msg = (await r.json()).detail ?? msg } catch { /* not json */ }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return r.json()
}

const q = (model: string) => `model=${encodeURIComponent(model)}`
export const getModels = () => fetch(`${API}/models`).then(r => parse<{ default: string; models: ModelSummary[] }>(r))
export const getModel = (id: string) => fetch(`${API}/models/${encodeURIComponent(id)}`).then(r => parse<ModelInfo>(r))
export const getSamples = (model: string) => fetch(`${API}/samples?${q(model)}`).then(r => parse<Sample[]>(r))
export const sampleAudioUrl = (id: number) => `${API}/samples/${id}/audio`
export const analyzeSample = (id: number, model: string) =>
  fetch(`${API}/analyze/sample/${id}?${q(model)}`, { method: 'POST' }).then(r => parse<Analysis>(r))
export const analyzeFile = (file: File, model: string) => {
  const body = new FormData()
  body.append('file', file)
  return fetch(`${API}/analyze?${q(model)}`, { method: 'POST', body }).then(r => parse<Analysis>(r))
}

/** base64 -> Uint8Array (row-major, row 0 = lowest mel bin). */
export function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Slaney mel scale (librosa default) so axis labels match the real filterbank. */
const F_SP = 200 / 3, MIN_LOG_HZ = 1000, MIN_LOG_MEL = MIN_LOG_HZ / F_SP, LOGSTEP = Math.log(6.4) / 27
export const hzToMel = (hz: number) =>
  hz < MIN_LOG_HZ ? hz / F_SP : MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOGSTEP
export const melRowForHz = (hz: number, nMels: number, fmax = 8000) => (hzToMel(hz) / hzToMel(fmax)) * nMels

export const fmtHz = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`)
export const fmtScore = (v: number) => (v === 0 ? '0' : v < 0.001 ? v.toExponential(2) : v.toFixed(5))

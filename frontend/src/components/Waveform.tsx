import { useCallback } from 'react'
import { useCanvas } from '../lib/useCanvas'
import type { Analysis } from '../api'

interface Props {
  a: Analysis
  selected: number
  time: number
  threshold: number
  onSelect: (i: number) => void
  onSeek: (t: number) => void
}

/** Min/max envelope of the raw signal; each analysis window is a clickable band, red if anomalous. */
export default function Waveform({ a, selected, time, threshold, onSelect, onSeek }: Props) {
  const dur = a.waveform.duration_s
  const ref = useCanvas((ctx, w, h, v) => {
    const ml = 4, mb = 20, pw = w - ml - 4, ph = h - mb - 4, mid = 4 + ph / 2
    const peak = Math.max(...a.waveform.max.map(Math.abs), ...a.waveform.min.map(Math.abs), 1e-6)
    const n = a.waveform.min.length
    // windows
    a.windows.forEach(win => {
      const x0 = ml + (win.start_s / dur) * pw, x1 = ml + (Math.min(win.end_s, dur) / dur) * pw
      const bad = win.score > threshold
      ctx.fillStyle = bad ? v('--bad-soft') : v('--ok-soft')
      if (win.index === selected) ctx.fillStyle = bad ? v('--bad-mid') : v('--accent-mid')
      ctx.fillRect(x0, 4, Math.max(x1 - x0, 1), ph)
      if (win.index === selected) {
        ctx.strokeStyle = bad ? v('--bad') : v('--accent'); ctx.lineWidth = 1.5
        ctx.strokeRect(x0 + .5, 4.5, Math.max(x1 - x0 - 1, 1), ph - 1)
      }
    })
    ctx.strokeStyle = v('--border'); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(ml, mid + .5); ctx.lineTo(ml + pw, mid + .5); ctx.stroke()
    // envelope
    ctx.fillStyle = v('--wave')
    const colW = pw / n
    for (let i = 0; i < n; i++) {
      const y0 = mid - (a.waveform.max[i] / peak) * (ph / 2), y1 = mid - (a.waveform.min[i] / peak) * (ph / 2)
      ctx.fillRect(ml + i * colW, y0, Math.max(colW, 1), Math.max(y1 - y0, 1))
    }
    // time axis
    ctx.font = `11px ${v('--font')}`
    ctx.fillStyle = v('--muted'); ctx.textBaseline = 'top'
    const step = dur > 20 ? 5 : dur > 8 ? 2 : dur > 3 ? 1 : 0.5
    for (let t = 0; t <= dur + 1e-6; t += step) {
      const x = ml + (t / dur) * pw
      ctx.textAlign = t === 0 ? 'left' : t + step > dur + 1e-6 ? 'right' : 'center'
      ctx.fillText(`${+t.toFixed(2)}s`, x, h - mb + 5)
    }
    // playhead
    if (time > 0) {
      const x = ml + (time / dur) * pw
      ctx.fillStyle = v('--text'); ctx.fillRect(x, 4, 1.5, ph)
    }
  }, [a, selected, time, threshold])

  const pick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const t = Math.max(0, Math.min(dur, ((e.clientX - b.left - 4) / (b.width - 8)) * dur))
    // choose the window whose centre is closest to the click
    let best = 0, bd = Infinity
    a.windows.forEach(w => { const d = Math.abs((w.start_s + w.end_s) / 2 - t); if (d < bd) { bd = d; best = w.index } })
    onSelect(best); onSeek(t)
  }, [a, dur, onSelect, onSeek])

  return <div className="plot" style={{ height: 150 }}><canvas ref={ref} onClick={pick} style={{ cursor: 'pointer' }} /></div>
}

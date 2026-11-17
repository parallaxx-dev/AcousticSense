import { useMemo, useRef, useState } from 'react'
import { useCanvas } from '../lib/useCanvas'
import { lut, type CmapName } from '../lib/colormap'
import { fmtHz, melRowForHz } from '../lib/decode'

interface Props {
  data: Uint8Array          // row-major, row 0 = lowest mel bin
  rows: number
  cols: number
  seconds: number           // x extent
  cmap?: CmapName
  smooth?: boolean
  height?: number
  /** Convert a 0..255 cell value to a readable string for the hover tooltip. */
  readout?: (v: number) => string
  /** Draw extra things (window boxes, playhead) in plot-area pixel coordinates. */
  overlay?: (ctx: CanvasRenderingContext2D, plot: { x: number; y: number; w: number; h: number }, v: (name: string) => string) => void
  onClickTime?: (t: number) => void
  compact?: boolean         // hide axis labels (small multiples)
  yTicks?: boolean
  xOffset?: number          // seconds added to x labels (window start)
}

const HZ_TICKS = [100, 500, 1000, 2000, 4000, 8000]

export default function Heatmap({ data, rows, cols, seconds, cmap = 'magma', smooth = true, height = 220,
  readout, overlay, onClickTime, compact, yTicks = true, xOffset = 0 }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; r: number; c: number } | null>(null)
  const plotRef = useRef({ x: 0, y: 0, w: 1, h: 1 })

  const bitmap = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cols; cv.height = rows
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(cols, rows)
    const L = lut(cmap)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = data[r * cols + c]
        const o = ((rows - 1 - r) * cols + c) * 4         // flip: low frequencies at the bottom
        img.data[o] = L[v * 3]; img.data[o + 1] = L[v * 3 + 1]; img.data[o + 2] = L[v * 3 + 2]; img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return cv
  }, [data, rows, cols, cmap])

  const ref = useCanvas((ctx, w, h, v) => {
    const ml = compact || !yTicks ? 4 : 38, mb = compact ? 4 : 20
    const p = { x: ml, y: 4, w: w - ml - 4, h: h - 4 - mb }
    plotRef.current = p
    ctx.imageSmoothingEnabled = smooth
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, p.x, p.y, p.w, p.h)
    ctx.font = `11px ${v('--font')}`
    ctx.fillStyle = v('--muted'); ctx.strokeStyle = v('--muted')
    if (!compact) {
      if (yTicks) {
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        for (const hz of HZ_TICKS) {
          const y = p.y + p.h - (melRowForHz(hz, rows) / rows) * p.h
          ctx.fillText(fmtHz(hz), p.x - 5, y)
          ctx.fillRect(p.x - 3, y, 3, 1)
        }
      }
      ctx.textBaseline = 'top'
      const step = seconds > 20 ? 5 : seconds > 8 ? 2 : seconds > 3 ? 1 : 0.5
      for (let t = 0; t <= seconds + 1e-6; t += step) {
        const x = p.x + (t / seconds) * p.w
        ctx.textAlign = t === 0 ? 'left' : t + step > seconds + 1e-6 ? 'right' : 'center'
        ctx.fillText(`${+(t + xOffset).toFixed(2)}s`, x, p.y + p.h + 5)
        ctx.fillRect(x, p.y + p.h, 1, 3)
      }
    }
    overlay?.(ctx, p, v)
    if (hover) {
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(hover.x + .5, p.y); ctx.lineTo(hover.x + .5, p.y + p.h)
      ctx.moveTo(p.x, hover.y + .5); ctx.lineTo(p.x + p.w, hover.y + .5); ctx.stroke()
    }
  }, [bitmap, smooth, seconds, overlay, hover, compact, yTicks, xOffset, rows])

  const locate = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - b.left, y = e.clientY - b.top, p = plotRef.current
    const fx = (x - p.x) / p.w, fy = (y - p.y) / p.h
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null
    return { x, y, fx, r: Math.min(rows - 1, Math.floor((1 - fy) * rows)), c: Math.min(cols - 1, Math.floor(fx * cols)) }
  }

  return (
    <div className="plot" style={{ height }}>
      <canvas ref={ref} style={{ cursor: onClickTime ? 'pointer' : 'crosshair' }}
        onMouseMove={e => { const l = locate(e); setHover(l && { x: l.x, y: l.y, r: l.r, c: l.c }) }}
        onMouseLeave={() => setHover(null)}
        onClick={e => { const l = locate(e); if (l && onClickTime) onClickTime(l.fx * seconds + xOffset) }} />
      {hover && readout && (
        <div className="tip" style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12 }}>
          {((hover.c / cols) * seconds + xOffset).toFixed(2)}s · mel {hover.r} · {readout(data[hover.r * cols + hover.c])}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

/** Reads a CSS variable as seen by `el` (so plots pick up the dark-screen palette). */
export const cssVar = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim()

/**
 * Hi-DPI canvas that re-renders when its container resizes or the theme changes.
 * `draw` receives a context already scaled to CSS pixels.
 */
export function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, v: (name: string) => string) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [theme, setTheme] = useState(0)

  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onTheme = () => setTheme(t => t + 1)
    mq.addEventListener('change', onTheme)
    return () => { ro.disconnect(); mq.removeEventListener('change', onTheme) }
  }, [])

  useEffect(() => {
    const c = ref.current
    if (!c || !size.w || !size.h) return
    const dpr = window.devicePixelRatio || 1
    c.width = size.w * dpr
    c.height = size.h * dpr
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    draw(ctx, size.w, size.h, name => cssVar(c, name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, theme, ...deps])

  return ref
}

import { useCallback, useEffect, useRef, useState } from 'react'

/** Minimal audio player that exposes a smooth `time` for playhead overlays. */
export function useAudio(url: string | null) {
  const el = useRef<HTMLAudioElement | null>(null)
  const raf = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)

  useEffect(() => {
    setPlaying(false); setTime(0)
    if (!url) { el.current = null; return }
    const a = new Audio(url)
    el.current = a
    const tick = () => { setTime(a.currentTime); raf.current = requestAnimationFrame(tick) }
    const onPlay = () => { setPlaying(true); raf.current = requestAnimationFrame(tick) }
    const onStop = () => { setPlaying(false); cancelAnimationFrame(raf.current); setTime(a.ended ? 0 : a.currentTime) }
    a.addEventListener('play', onPlay); a.addEventListener('pause', onStop); a.addEventListener('ended', onStop)
    return () => {
      cancelAnimationFrame(raf.current)
      a.pause(); a.removeEventListener('play', onPlay); a.removeEventListener('pause', onStop); a.removeEventListener('ended', onStop)
    }
  }, [url])

  const toggle = useCallback(() => {
    const a = el.current
    if (a) void (a.paused ? a.play() : a.pause())
  }, [])
  const seek = useCallback((t: number) => { if (el.current) { el.current.currentTime = t; setTime(t) } }, [])
  return { playing, time, toggle, seek, ready: !!url }
}

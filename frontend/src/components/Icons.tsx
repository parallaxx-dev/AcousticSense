const P: Record<string, string> = {
  wave: 'M3 12h3l2.5-7 4 14 3-10 2 3h3.5',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  sun: 'M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  auto: 'M4 5h16v11H4zM9 20h6m-3-4v4',
  upload: 'M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14m8-14v14',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  down: 'M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M4 20h16',
}
export default function Icon({ name, size = 18 }: { name: keyof typeof P; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>
}

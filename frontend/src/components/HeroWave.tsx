/** One-off signature moment: a signal line draws itself across the hero. */
function trace(seed: number, amp: number) {
  const pts: string[] = []
  for (let i = 0; i <= 240; i++) {
    const x = i / 240, env = Math.sin(Math.PI * x) ** 1.4
    const y = 45 - env * amp * (Math.sin(x * 38 + seed) * .55 + Math.sin(x * 97 + seed * 2) * .3 + Math.sin(x * 211 + seed * 3) * .15)
    pts.push(`${i ? 'L' : 'M'}${(x * 1200).toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}
export default function HeroWave() {
  return (
    <svg className="hero-wave" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden="true">
      <path className="ghost" pathLength={1} d={trace(2.1, 36)} />
      <path pathLength={1} d={trace(0.4, 40)} />
    </svg>
  )
}

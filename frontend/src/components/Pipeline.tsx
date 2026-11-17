const STEPS = [
  ['Waveform', '16 kHz mono'],
  ['Slice', '2.05 s · 50 % overlap'],
  ['Log-Mel', '1024 FFT · 128 mels'],
  ['Min-Max', 'healthy train stats'],
  ['Conv encoder', '4× stride-2 → 32-d'],
  ['Conv decoder', '4× transposed'],
  ['|X − X̂|²', 'MSE → score'],
]
export default function Pipeline({ step }: { step?: number }) {
  return (
    <ol className="pipe">
      {STEPS.map(([t, s], i) => (
        <li key={t} className={step === i ? 'on' : ''}><b>{t}</b><span>{s}</span></li>
      ))}
    </ol>
  )
}

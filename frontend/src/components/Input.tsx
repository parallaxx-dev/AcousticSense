import { useRef, useState } from 'react'
import type { Sample } from '../api'

export function Dropzone({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const inp = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const take = (f?: File) => { if (f) onFile(f) }
  return (
    <div className={`drop ${over ? 'over' : ''} ${busy ? 'busy' : ''}`} role="button" tabIndex={0}
      onClick={() => inp.current?.click()} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inp.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]) }}>
      <input ref={inp} type="file" accept=".wav,audio/wav,audio/x-wav" hidden
        onChange={e => { take(e.target.files?.[0]); e.target.value = '' }} />
      <strong>{busy ? 'Analysing the recording…' : 'Drop a .wav recording'}</strong>
      <span>or click to choose a file. Up to 60 seconds.</span>
    </div>
  )
}

export function SamplePicker({ samples, onPick, busy, active }: {
  samples: Sample[]; onPick: (s: Sample) => void; busy: boolean; active?: number
}) {
  if (!samples.length) return null
  return (
    <div className="samples">
      <h3>No recording handy? Try one the model never saw in training.</h3>
      <div className="chips">
        {samples.map(s => (
          <button key={s.id} className={`chip ${s.id === active ? 'on' : ''}`} disabled={busy} onClick={() => onPick(s)}
            title={`${s.group}/${s.label}/${s.name}`}>
            <i className={s.label === 'normal' ? 'dot ok' : 'dot bad'} />{s.label === 'normal' ? 'Healthy' : 'Faulty'} {s.name.replace('.wav', '').replace(/^0+/, '#')}
          </button>
        ))}
      </div>
    </div>
  )
}

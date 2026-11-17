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
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></svg>
      <strong>{busy ? 'Analysing…' : 'Drop a .wav clip here'}</strong>
      <span>or click to browse · mono/multichannel · up to 60 s</span>
    </div>
  )
}

export function SamplePicker({ samples, onPick, busy, active }: {
  samples: Sample[]; onPick: (s: Sample) => void; busy: boolean; active?: number
}) {
  if (!samples.length) return null
  return (
    <div className="samples">
      <h3>Or try a held-out test clip <small>(never seen during training)</small></h3>
      <div className="chips">
        {samples.map(s => (
          <button key={s.id} className={`chip ${s.id === active ? 'on' : ''}`} disabled={busy} onClick={() => onPick(s)}
            title={`${s.group}/${s.label}/${s.name}`}>
            <i className={s.label === 'normal' ? 'dot ok' : 'dot bad'} />{s.label === 'normal' ? 'healthy' : 'faulty'} · {s.name.replace('.wav', '')}
          </button>
        ))}
      </div>
    </div>
  )
}

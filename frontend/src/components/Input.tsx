import { useRef, useState } from 'react'
import type { Sample } from '../api'
import Icon from './Icons'

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
      <Icon name="upload" size={30} />
      <strong>{busy ? 'Analysing the recording…' : 'Drop a .wav recording here'}</strong>
      <span>or click to choose a file. Up to 60 seconds.</span>
    </div>
  )
}

export function SamplePicker({ samples, onPick, busy, active }: {
  samples: Sample[]; onPick: (s: Sample) => void; busy: boolean; active?: number
}) {
  if (!samples.length) return null
  const groups: [string, Sample['label'], string][] = [['Healthy recordings', 'normal', 'ok'], ['Faulty recordings', 'abnormal', 'bad']]
  return (
    <div>
      {groups.map(([title, label, tone]) => (
        <div className="samples" key={label}>
          <h3>{title}</h3>
          <div className="chips">
            {samples.filter(s => s.label === label).map(s => (
              <button key={s.id} className={`chip ${s.id === active ? 'on' : ''}`} disabled={busy} onClick={() => onPick(s)} title={`${s.group}/${s.label}/${s.name}`}>
                <i className={`dot ${tone}`} />{s.name.replace('.wav', '')}
              </button>))}
          </div>
        </div>))}
      <p className="cap">All of these are held-out clips the model never saw during training.</p>
    </div>
  )
}

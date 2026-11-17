export type CmapName = 'magma' | 'inferno' | 'viridis'

const STOPS: Record<CmapName, number[][]> = {
  magma: [[0,0,4],[28,16,68],[79,18,123],[129,37,129],[181,54,122],[229,80,100],[251,135,97],[254,194,135],[252,253,191]],
  inferno: [[0,0,4],[31,12,72],[85,15,109],[136,34,106],[186,54,85],[227,89,51],[249,140,10],[249,201,50],[252,255,164]],
  viridis: [[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[253,231,37]],
}

const cache = new Map<CmapName, Uint8ClampedArray>()

/** 256-entry RGB lookup table, linearly interpolated between 9 anchor colours. */
export function lut(name: CmapName): Uint8ClampedArray {
  const hit = cache.get(name)
  if (hit) return hit
  const stops = STOPS[name]
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const p = (i / 255) * (stops.length - 1)
    const k = Math.min(Math.floor(p), stops.length - 2)
    const f = p - k
    for (let c = 0; c < 3; c++) out[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f
  }
  cache.set(name, out)
  return out
}

export const cssGradient = (name: CmapName) => {
  const s = STOPS[name].map(([r, g, b], i, a) => `rgb(${r},${g},${b}) ${(i / (a.length - 1)) * 100}%`)
  return `linear-gradient(90deg, ${s.join(',')})`
}

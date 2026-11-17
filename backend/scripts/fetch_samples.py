"""Download a few MIMII clips per machine unit for local testing (no full-dataset download).

Pulls individual WAVs out of the 6 dB zips on Zenodo (record 3384388, CC BY-SA 4.0) with HTTP range
requests, so only the selected files are transferred. Healthy clips come from each unit's held-out
test split (same rule as the notebooks: sorted files, seed-42 permutation, 70/10/20), so the models
never trained on them. Writes <out>/<machine>/<id>/<label>/*.wav and <out>/manifest.json.

    python -I backend/scripts/fetch_samples.py --out data/samples --per-class 3
"""
from __future__ import annotations

import argparse, io, json, re, time, urllib.request, zipfile, zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import soundfile as sf

RECORD = "https://zenodo.org/records/3384388/files/{snr}_dB_{machine}.zip"
SEED = 42
MACHINES = ["fan", "pump", "slider", "valve"]
UNITS = ["id_00", "id_02", "id_04", "id_06"]


class RemoteFile(io.RawIOBase):
    """Read-only, seekable file object backed by HTTP Range requests (what zipfile needs)."""

    def __init__(self, url: str, block: int = 1 << 20):
        self.url, self.pos, self.block = url, 0, block
        self._cache: dict[int, bytes] = {}
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def _block(self, i: int) -> bytes:
        if i not in self._cache:
            a = i * self.block
            b = min(a + self.block, self.size) - 1
            for attempt in range(4):
                try:
                    req = urllib.request.Request(self.url, headers={"Range": f"bytes={a}-{b}"})
                    with urllib.request.urlopen(req, timeout=60) as r:
                        data = r.read()
                    break
                except Exception:
                    if attempt == 3:
                        raise
                    time.sleep(2 * (attempt + 1))
            self._cache[i] = data
            if len(self._cache) > 64:                       # keep memory bounded
                self._cache.pop(next(iter(self._cache)))
        return self._cache[i]

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        end = min(self.pos + n, self.size)
        out = bytearray()
        while self.pos < end:
            i, off = divmod(self.pos, self.block)
            chunk = self._block(i)[off:off + (end - self.pos)]
            out += chunk
            self.pos += len(chunk)
        return bytes(out)

    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)


def fetch_machine(machine: str, args, out: Path) -> list[dict]:
    url = RECORD.format(snr=args.snr, machine=machine)
    rf = RemoteFile(url)
    zf = zipfile.ZipFile(rf)
    names = [n for n in zf.namelist() if n.lower().endswith(".wav")]
    print(f"{machine}: {len(names)} wavs listed ({rf.size / 1e9:.1f} GB zip, not downloaded)", flush=True)
    manifest = []
    for unit in UNITS:
        normal = sorted(n for n in names if re.search(rf"(^|/){unit}/normal/[^/]+\.wav$", n))
        abnormal = sorted(n for n in names if re.search(rf"(^|/){unit}/abnormal/[^/]+\.wav$", n))
        if not normal or not abnormal:
            print(f"  {machine} {unit}: skipped (no clips)", flush=True); continue
        n = len(normal)
        perm = np.random.default_rng(SEED).permutation(n)
        held_out = [normal[i] for i in perm[int(0.7 * n) + int(0.1 * n):]]          # the notebooks' test split
        for label, pool in (("normal", held_out), ("abnormal", abnormal)):
            rng = np.random.default_rng([SEED, zlib.crc32(f"{machine}/{unit}/{label}".encode())])   # deterministic per class
            for i in sorted(rng.choice(len(pool), min(args.per_class, len(pool)), replace=False)):
                name = pool[i]
                dest = out / machine / unit / label / Path(name).name
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    dest.write_bytes(zf.read(name))
                info = sf.info(dest)                                               # reject anything that is not a real WAV
                assert info.samplerate == 16000 and info.frames > 16000 * 5, f"unexpected audio: {dest}"
                manifest.append({"path": str(dest), "label": label, "machine": machine, "unit": unit,
                                 "snr": int(args.snr), "source": name})
                print(f"  {machine} {unit}/{label}/{dest.name}  {dest.stat().st_size / 1e6:.1f} MB", flush=True)
    return manifest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/samples")
    ap.add_argument("--per-class", type=int, default=3)
    ap.add_argument("--snr", default="6")
    ap.add_argument("--machines", nargs="*", default=MACHINES)
    args = ap.parse_args()
    out = Path(args.out)
    with ThreadPoolExecutor(max_workers=len(args.machines)) as ex:          # one zip per machine, fetched in parallel
        parts = list(ex.map(lambda m: fetch_machine(m, args, out), args.machines))
    manifest = [m for part in parts for m in part]
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print("clips:", len(manifest))


if __name__ == "__main__":
    main()

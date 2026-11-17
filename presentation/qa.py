"""Geometric QA for the deck (no renderer available). DejaVu Sans is WIDER than Calibri, so 'fits' here => fits in PowerPoint."""
import sys
from pptx import Presentation
from pptx.util import Emu
from PIL import ImageFont
SW, SH = 13.333, 7.5
FR = "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf"; FB = "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf"
_c = {}
def font(sz, bold):
    k = (round(sz * 4), bold)
    if k not in _c: _c[k] = ImageFont.truetype(FB if bold else FR, int(round(sz * 4)))  # 4x for precision
    return _c[k]
CAL = 0.88   # Calibri is about 12% narrower than DejaVu Sans
def width_pt(t, sz, bold, f=1.0): return font(sz, bold).getlength(t) / 4 * f
def lines_needed(par_runs, box_w_pt, f):
    words = []
    for t, sz, b in par_runs:
        for w in t.replace("\n", " ").split(" "):
            if w: words.append((w, sz, b))
    if not words: return 1, 12
    mx = max(sz for _, sz, _ in words); n = 1; cur = 0
    for w, sz, b in words:
        ww = width_pt(w, sz, b, f); sp = width_pt(" ", sz, b, f)
        if cur and cur + sp + ww > box_w_pt: n += 1; cur = ww
        else: cur += (sp if cur else 0) + ww
    return n, mx
issues = []
prs = Presentation(sys.argv[1])
def inch(v): return Emu(v).inches
for si, slide in enumerate(prs.slides, 1):
    boxes = []
    for sh in slide.shapes:
        if sh.left is None: continue
        x, y, w, h = inch(sh.left), inch(sh.top), inch(sh.width), inch(sh.height)
        if x < -0.01 or y < -0.01 or x + w > SW + 0.01 or y + h > SH + 0.01:
            issues.append((si, "OUT OF SLIDE", sh.name, f"x={x:.2f} y={y:.2f} w={w:.2f} h={h:.2f}"))
        if sh.has_text_frame and sh.text_frame.text.strip():
            tf = sh.text_frame
            inset_l = inch(tf.margin_left) if tf.margin_left is not None else 0.1
            inset_r = inch(tf.margin_right) if tf.margin_right is not None else 0.1
            inset_t = inch(tf.margin_top) if tf.margin_top is not None else 0.05
            inset_b = inch(tf.margin_bottom) if tf.margin_bottom is not None else 0.05
            bw = (w - inset_l - inset_r) * 72
            total = 0
            for p in tf.paragraphs:
                runs = [(r.text, (r.font.size.pt if r.font.size else 18), bool(r.font.bold)) for r in p.runs if r.text]
                if not runs: total += 12 * 1.2; continue
                n, mx = lines_needed(runs, bw, CAL)
                total += n * mx * 1.2
            need = total / 72 + inset_t + inset_b
            if need > h + 0.02:
                n_d = 0
                issues.append((si, "TEXT TOO TALL", sh.name, f"need {need:.2f}in > box {h:.2f}in :: {tf.text[:48]!r}"))
            # single words wider than the box
            for p in tf.paragraphs:
                for r in p.runs:
                    for wd in r.text.split():
                        if width_pt(wd, r.font.size.pt if r.font.size else 18, bool(r.font.bold), CAL) > bw + 1:
                            issues.append((si, "WORD WIDER THAN BOX", sh.name, wd))
            maxw = 0
            for p in tf.paragraphs:
                runs = [(r.text, (r.font.size.pt if r.font.size else 18), bool(r.font.bold)) for r in p.runs if r.text]
                if runs: maxw = max(maxw, min(bw, sum(width_pt(t, sz, b, CAL) for t, sz, b in runs)))
            tw = maxw / 72
            al = tf.paragraphs[0].alignment
            ax = x + inset_l + ((w - inset_l - inset_r - tw) / 2 if al is not None and "CENTER" in str(al) else 0)
            boxes.append((sh.name, ax, y + inset_t, tw, max(0.05, min(h, need)) - inset_t - inset_b, tf.text[:30]))
        if sh.has_table:
            tb = sh.table; tot = 0
            for ri, row in enumerate(tb.rows):
                rh = inch(row.height); need_row = rh
                for ci, cell in enumerate(row.cells):
                    cw = inch(tb.columns[ci].width)
                    ml = inch(cell.margin_left) if cell.margin_left is not None else 0.1
                    mr = inch(cell.margin_right) if cell.margin_right is not None else 0.1
                    mt = inch(cell.margin_top) if cell.margin_top is not None else 0.05
                    mb = inch(cell.margin_bottom) if cell.margin_bottom is not None else 0.05
                    tot_h = 0
                    for p in cell.text_frame.paragraphs:
                        runs = [(r.text, (r.font.size.pt if r.font.size else 18), bool(r.font.bold)) for r in p.runs if r.text]
                        if not runs: continue
                        n, mx = lines_needed(runs, (cw - ml - mr) * 72, CAL); tot_h += n * mx * 1.2
                    need_row = max(need_row, tot_h / 72 + mt + mb)
                if need_row > rh + 0.02: issues.append((si, "TABLE ROW GROWS", sh.name, f"row {ri}: need {need_row:.2f} > {rh:.2f}"))
                tot += max(need_row, rh)
            if y + tot > 6.68 and si not in (): issues.append((si, "TABLE BOTTOM", sh.name, f"ends at {y + tot:.2f}in"))
    # text-box overlaps (text vs text only)
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            ox = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]); oy = min(a[2] + a[4], b[2] + b[4]) - max(a[2], b[2])
            if ox > 0.05 and oy > 0.05: issues.append((si, "TEXT OVERLAP", a[0] + " / " + b[0], f"{a[5]!r} x {b[5]!r}  ({ox:.2f}x{oy:.2f}in)"))
print(f"{len(prs.slides)} slides checked")
for i in issues: print(i)
print("TOTAL issues:", len(issues))

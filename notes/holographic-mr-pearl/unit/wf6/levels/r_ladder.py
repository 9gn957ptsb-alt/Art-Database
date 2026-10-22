"""Renders of the Fibonacci ladder: the drawing view of 1, 2, 3 nested levels (corners + openings), plain and with
a translucent film per level (Middling: the film over a face is the mean of the face and the film)."""
import math, time, json, numpy as np
from PIL import Image, ImageDraw, ImageFont
import nest as N, ladder as LD, unit as U
H9 = 1 / 9
UW = N.unit(H9, 'woven', 12)
def font(sz):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', sz)
    except Exception: return ImageFont.load_default()
F14 = font(14)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); lines = txt.split('\n'); wd = max(d.textlength(l, font=F14) for l in lines)
    d.rectangle((0, 0, wd + 10, 18 * len(lines) + 6), fill=(255, 255, 255)); d.text((5, 3), txt, fill=(0, 0, 0), font=F14); return np.array(im)
def prims_of(frames, u=UW):
    out = []
    for i, fr in enumerate(frames):
        cp = fr.copy(i)
        for nm, tb, cs in u:
            for C in cs: out.append(U.Prim(cp.map(C), (0, 1, 2), nm, i))
    return out
FILM = {2: (205, 92, 60), 3: (70, 110, 200), 4: (225, 175, 40), 1: (120, 170, 90), 0: (150, 90, 170), -1: (60, 160, 160)}
def film(img, tone, idx, frames, key):
    out = img.astype(float)
    for i, fr in enumerate(frames):
        m = (idx == i) & (tone >= 0)
        col = np.array(FILM.get(key(fr), (128, 128, 128)), float)
        out[m] = np.round((out[m] + col) / 2)        # Color Middling: the mean of the face and the film
    return np.clip(out, 0, 255).astype(np.uint8)
def view(frames, m_top, w=640):
    ext = LD.F(m_top + 4) / 8 * 1.32
    O, D = N.lv.drawing_rays(-ext, ext, -ext * 0.75, ext * 1.08, w)
    t0 = time.time(); tone, idx, dep = N.lv.cast(prims_of(frames), O, D, want_level=True, want_depth=True)
    return tone, idx, time.time() - t0
if __name__ == '__main__':
    row1, row2, meta = [], [], {}
    for m_top in (2, 3, 4, 5):
        fr = LD.nest_frames(m_top, 2, openings=True)
        tone, idx, dt = view(fr, m_top)
        img = N.picture(tone, idx)
        nl = sum(f.kind == 'leaf' for f in fr); no = len(fr) - nl
        txt = 'level %d: %d leaves (the drawing)%s' % (m_top, nl, '' if not no else ',\n%d in openings (level m-4)' % no)
        row1.append(label(img, txt))
        # film: the level of the frame each piece sits in as a corner (top-level split = level m_top - 1 ...)
        key = lambda f, mt=m_top: (mt - len(f.path.rstrip('G'))) if f.kind == 'leaf' else -1
        lev_of_branch = lambda f, mt=m_top: ('ABC'.index(f.path[0]) if f.path and f.path[0] in 'ABC' else 3)
        fimg = film(img, tone, idx, fr, lambda f: {0: 2, 1: 3, 2: 4, 3: -1}[lev_of_branch(f)])
        row2.append(label(fimg, 'level %d: films by the corner of the top frame\n(A red, B blue, C yellow, opening teal)' % m_top))
        meta[m_top] = dict(leaves=nl, openings=no, cast_s=round(dt, 1), outline_u=LD.F(m_top + 4), scale_of_leaf=1.0)
        print(m_top, meta[m_top], flush=True)
        np.save('ladder_tone_%d.npy' % m_top, tone); np.save('ladder_idx_%d.npy' % m_top, idx)
    Image.fromarray(np.concatenate([np.concatenate(row1, 1), np.concatenate(row2, 1)], 0)).save('ladder_drawing.png')
    json.dump(meta, open('r_ladder.json', 'w'), indent=1)

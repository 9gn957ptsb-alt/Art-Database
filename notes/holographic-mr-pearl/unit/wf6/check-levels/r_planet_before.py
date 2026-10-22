"""The artist's whole planet by rule D (museums of the 31 city places -> works -> 4 details, each node's record),
drawing view. Every leaf is the drawing (woven unit, H = 1/9) at F(m+4)/8; rendered at 2x and averaged 2x2 (a figure
too small to resolve closes into its mean, as the game's facades do). Films: one hue per city, by the golden angle
in the order the rule placed them (heaviest first)."""
import json, time, colorsys, numpy as np, sys
from PIL import Image, ImageDraw
import nest as N, ladder as LD, q_rules as Q, r_ladder as R, unit as U
LD.RECORDS = True
t = Q.planet(True)
lay = LD.layout(t); K = lay['K']; leaves = lay['leaves']
kind = sys.argv[1] if len(sys.argv) > 1 else 'woven'
u = N.unit(1 / 9, 'woven', 6) if kind == 'woven' else N.unit(1 / 9, 'lattice')
prm = R.prims_of(leaves, u)
print(len(leaves), 'leaves', len(prm), 'prims', flush=True)
cities = sorted([f for f in lay['frames'] if f.kind == 'city'], key=lambda f: (-f.m, f.path))
hue = {f.path: (i * 0.381966) % 1 for i, f in enumerate(cities)}
def city_of(path):
    best = None
    for f in cities:
        if path.startswith(f.path) and (best is None or len(f.path) > len(best.path)): best = f
    return best
W = 1400 * 2
ext = LD.F(K + 4) / 8 * 1.18
O, D = N.lv.drawing_rays(-ext, ext, -ext * 0.72, ext * 1.02, W)
t0 = time.time(); tone, idx = N.lv.cast(prm, O, D, want_level=True); print('cast %.0fs' % (time.time() - t0), flush=True)
img = N.picture(tone, idx, outline=False).astype(float)
for i, fr in enumerate(leaves):
    m = (idx == i) & (tone >= 0)
    if not m.any(): continue
    c = city_of(fr.path)
    col = np.array((40, 150, 140), float) if c is None else np.array(colorsys.hsv_to_rgb(hue[c.path], 0.62, 0.86)) * 255
    img[m] = np.round((img[m] + col) / 2)
h = img.shape[0] // 2 * 2
small = img[:h].reshape(h // 2, 2, W // 2, 2, 3).mean((1, 3))
im = Image.fromarray(np.clip(small, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
def px(ab): return ((ab[0] + ext) / (2 * ext) * W / 2, (ext * 1.02 - ab[1]) / (ext * 1.74) * h / 2)
F14 = R.font(14)
for f in cities[:12]:
    x, y = px(f.ab); d.text((x - 30, y - 8), f.info['key'], fill=(0, 0, 0), font=F14)
d.text((10, h // 2 - 50), 'the planet by rule D: %d cities, %d places, %d works, %d details + records = %d leaves; level %d, %d drawings across' % (
    len(cities), sum(1 for f in lay['frames'] if f.kind == 'place'), sum(1 for f in lay['frames'] if f.kind == 'work'),
    sum(1 for f in leaves if f.kind == 'detail'), len(leaves), K, LD.F(K + 4) // 8), fill=(0, 0, 0), font=R.font(16))
d.text((10, h // 2 - 26), 'every leaf the drawing at F(m+4)/8 of one block; films by city (Middling mean); 12 largest cities named', fill=(0, 0, 0), font=R.font(16))
im.save('planet_%s.png' % kind)

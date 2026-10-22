import json, numpy as np
from PIL import Image, ImageDraw, ImageFont
import nest as N, info as I
H = N.HG
u = N.unit(H, 'woven', 24)
def font(sz):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', sz)
    except Exception: return ImageFont.load_default()
F14 = font(14)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); lines = txt.split('\n'); wd = max(d.textlength(l, font=F14) for l in lines)
    d.rectangle((0, 0, wd + 10, 18 * len(lines) + 6), fill=(255, 255, 255)); d.text((5, 3), txt, fill=(0, 0, 0), font=F14); return np.array(im)
tree = I.toy(3)
for c in tree['parts']:
    for p in c['parts']:
        for w in p['parts']: w['parts'] = []
res = N.place_huffman(tree, N.Frame(1.0, N.CENTRE.copy()), H)
prm = N.prims(res['leaves'], u)
tiles = []
# joints at three levels: the planet's left-middle (cities), a city's (places), a place's (works)
lm = N._lm
cities = [f for f in res['frames'] if f.info.get('kind') == 'city']
places = [f for f in res['frames'] if f.info.get('kind') == 'place']
def abof(f): return np.array([(f.c - N.CENTRE) @ N.RV, (f.c - N.CENTRE) @ N.UPV])
NY = next(f for f in cities if f.info['key'] == 'New York'); MET = places[0]
for name, f, s in (('planet: New York over Amsterdam? (left-middle)', None, 1.0), ('a city: New York\'s left-middle', NY, NY.s), ('a place: the Met\'s left-middle', MET, MET.s)):
    c = (lm * s + (abof(f) if f is not None else 0))
    sp = 0.9 * s
    ext = (c[0] - sp, c[0] + sp, c[1] - sp * 0.8, c[1] + sp * 0.8)
    tone, lev, dep = N.drawing_view(prm, w=520, extent=ext)
    tiles.append(label(N.picture(tone, lev), name))
Image.fromarray(np.concatenate(tiles, 1)).save('r_joints3.png')

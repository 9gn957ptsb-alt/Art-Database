import json, math, numpy as np, time, pickle
from PIL import Image, ImageDraw, ImageFont
import nest as N, info as I
import unit as U
H = N.HG
def font(sz):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', sz)
    except Exception: return ImageFont.load_default()
F14 = font(14)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im)
    lines = txt.split('\n'); wd = max(d.textlength(l, font=F14) for l in lines)
    d.rectangle((0, 0, wd + 10, 18 * len(lines) + 6), fill=(255, 255, 255)); d.text((5, 3), txt, fill=(0, 0, 0), font=F14); return np.array(im)
tree = I.toy(3)
t = json.loads(json.dumps(tree))
for c in t['parts']:
    for p in c['parts']:
        for w in p['parts']: w['parts'] = []
res = N.place_huffman(t, N.Frame(1.0, N.CENTRE.copy()), H)
leaves = res['leaves']
rows = []
for kind in ('woven', 'lattice'):
    u = N.unit(H, kind, 12)
    prm = N.prims(leaves, u)
    P = np.concatenate([p.P for p in prm]); c = (P.min(0) + P.max(0)) / 2
    tiles = []
    for az, el in ((0, 0), (20, 0), (45, 10), (90, 15)):
        t0 = time.time()
        tone, lev, dep = N.turned_view(prm, az, el, c, 3.4, w=460)
        tiles.append(label(N.picture(tone, lev), '%s unit, turned %d deg about z, tilt %d' % (kind, az, el)))
        print(kind, az, el, '%.1fs' % (time.time() - t0), flush=True)
    rows.append(np.concatenate(tiles, 1))
Image.fromarray(np.concatenate(rows, 0)).save('tree_turned.png')

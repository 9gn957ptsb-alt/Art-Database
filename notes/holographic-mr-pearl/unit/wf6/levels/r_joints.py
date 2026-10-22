import numpy as np
from PIL import Image, ImageDraw
import nest as N
H = N.HG
root = N.Copy(level=0)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 6 * max(len(l) for l in txt.split('\n')), 13 * (txt.count('\n') + 1) + 4), fill=(255, 255, 255)); d.text((4, 2), txt, fill=(0, 0, 0)); return np.array(im)
rows = []
for kind in ('woven', 'lattice'):
    u = N.unit(H, kind)
    tiles = []
    for mode, kap in (('flat', 0), ('strict', 0), ('cyclic', 1.5), ('cyclic', 4.0)):
        sibs = N.order_siblings(N.corners(root, H, t=0.0), mode, kappa=kap, step=1.5 if kind == 'woven' else 3.0)
        tone, lev, dep = N.drawing_view(N.prims(sibs, u), w=470)
        tiles.append(label(N.picture(tone, lev), '%s unit, siblings %s%s' % (kind, mode, (' kappa %.1f' % kap) if mode == 'cyclic' else '')))
    rows.append(np.concatenate(tiles, 1))
Image.fromarray(np.concatenate(rows, 0)).save('r_joints.png')

import numpy as np
from PIL import Image, ImageDraw
import nest as N
H = N.HG
root = N.Copy(level=0)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 6 * max(len(l) for l in txt.split('\n')), 13 * (txt.count('\n') + 1) + 4), fill=(255, 255, 255)); d.text((4, 2), txt, fill=(0, 0, 0)); return np.array(im)
u = N.unit(H, 'woven', 24)
tiles = []
lm = N._lm * 1.0
for mode, kap in (('flat', 0), ('strict', 0), ('cyclic', 4.0)):
    sibs = N.order_siblings(N.corners(root, H, t=0.0), mode, kappa=kap, step=1.5)
    ext = (lm[0] - 0.55, lm[0] + 0.75, lm[1] - 0.6, lm[1] + 0.55)
    tone, lev, dep = N.drawing_view(N.prims(sibs, u), w=560, extent=ext)
    tiles.append(label(N.picture(tone, lev), 'left-middle joint, siblings %s' % mode))
# and the original figure's own joint at the same place, at the same scale relative to the copies (for comparison)
tone, lev, dep = N.drawing_view(N.prims([root], u), w=560, extent=(lm[0] - 0.55, lm[0] + 0.75, lm[1] - 0.6, lm[1] + 0.55))
tiles.append(label(N.picture(tone, lev), "the figure's own left-middle joint (tribars)"))
Image.fromarray(np.concatenate(tiles, 1)).save('r_joints2.png')

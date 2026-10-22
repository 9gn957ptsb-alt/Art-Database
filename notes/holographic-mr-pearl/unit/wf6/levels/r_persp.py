import json, math, numpy as np, time
from PIL import Image, ImageDraw, ImageFont
import nest as N, info as I
import unit as U
H = N.HG
def font(sz):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', sz)
    except Exception: return ImageFont.load_default()
F14 = font(14)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); lines = txt.split('\n'); wd = max(d.textlength(l, font=F14) for l in lines)
    d.rectangle((0, 0, wd + 10, 18 * len(lines) + 6), fill=(255, 255, 255)); d.text((5, 3), txt, fill=(0, 0, 0), font=F14); return np.array(im)
tree = I.toy(3)
res = N.place_huffman(tree, N.Frame(1.0, N.CENTRE.copy()), H)
u = N.unit(H, 'woven', 12)
prm = N.prims(res['leaves'], u)
P = np.concatenate([p.P for p in prm]); c = (P.min(0) + P.max(0)) / 2
print('depth range of the tree (along the line of sight): %.3f .. %.3f' % (((P - N.CENTRE) @ N.NH).min(), ((P - N.CENTRE) @ N.NH).max()))
tiles = []
W = 520
for az, el in ((0, 0), (25, 0), (60, 10), (90, 20)):
    tone, lev, dep = N.turned_view(prm, az, el, c, 3.3, w=W)
    tiles.append(label(N.picture(tone, lev), 'turned %d deg about z, tilted %d' % (az, el)))
row1 = np.concatenate(tiles, 1)
f = 8.0
din, E = N.drawn_in_prims(prm, eye_dist=f)
def rot(axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis); K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
fov = 2 * math.degrees(math.atan(1.55 / f))
tiles = []
for name, pr, eye in (('perspective from one eye: the whole tree drawn in toward it', din, E),
                      ('the same eye, the tree not drawn in', prm, E),
                      ('drawn in, the eye moved 8 deg round', din, N.CENTRE + rot((0, 0, 1), math.radians(8)) @ (E - N.CENTRE)),
                      ('drawn in, the eye moved 30 deg round', din, N.CENTRE + rot((0, 0, 1), math.radians(30)) @ (E - N.CENTRE))):
    O, Dv = U.persp_rays(eye, N.CENTRE, N.UPV, fov, W, W)
    t0 = time.time()
    tone, lev = N.lv.cast(pr, O, Dv, want_level=True)
    tiles.append(label(N.picture(tone, lev), name))
    print(name, '%.1fs' % (time.time() - t0), flush=True)
row2 = np.concatenate(tiles, 1)
Image.fromarray(np.concatenate([row1, row2], 0)).save('tree_views.png')

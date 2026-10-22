"""(a) test B and renders: voxel spheres of F_k units across, far off, against the smooth sphere under each rule."""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from vox import walk
from tone_rule import rule, RULES, C
EYES = [("the drawing's eye", np.ones(3) / math.sqrt(3), np.array([0, -1.0, 1])),
        ('az 20 el 15', az_el(20, 15), np.array([0, 0, 1.0])),
        ('az 200 el 50', az_el(200, 50), np.array([0, 0, 1.0]))]
SIZE, FAR = 960, 24


def ortho(v, up, span, size, centre):
    d = -v
    return ortho_rays(d, up, centre, span, (size, size), back=200)


def voxel_sphere(Nd):
    g = Nd + 4
    c = np.full(3, g / 2.0)
    idx = np.indices((g, g, g)).reshape(3, -1).T + 0.5
    occ = (((idx - c) ** 2).sum(1) <= (Nd / 2.0) ** 2).reshape(g, g, g)
    return occ, c


def render_vox(occ, c, Nd, v, up):
    O, D = ortho(v, up, Nd * 1.15, SIZE, c)
    t, ax, sg = walk(occ, O.reshape(-1, 3), D.reshape(-1, 3))
    img = np.full((SIZE * SIZE,), np.nan)
    ok = ax >= 0
    img[ok] = C[ax[ok]]
    return img.reshape(SIZE, SIZE)


def render_smooth(rn, Nd, v, up):
    c = np.zeros(3)
    O, D = ortho(v, up, Nd * 1.15, SIZE, c)
    r = Nd / 2.0
    oc = O; b = (oc * D).sum(-1); cq = (oc * oc).sum(-1) - r * r
    disc = b * b - cq
    t = -b - np.sqrt(np.maximum(disc, 0))
    P = O + D * t[..., None]
    n = P / r
    img = np.where(disc > 0, rule(rn, n, np.broadcast_to(v, n.shape)), np.nan)
    return img


def far(img):
    m = np.isfinite(img)
    a = down(np.nan_to_num(img), FAR); w = down(m.astype(float), FAR)
    return np.where(w > 0.999, a / np.maximum(w, 1e-9), np.nan)


if __name__ == '__main__':
    res = {}
    tiles = []
    for ename, v, up in EYES:
        res[ename] = {}
        for Nd in (8, 13, 21, 34, 55):
            occ, c = voxel_sphere(Nd)
            vimg = render_vox(occ, c, Nd, v, up)
            fv = far(vimg)
            res[ename][Nd] = {}
            for rn in RULES:
                fs_ = far(render_smooth(rn, Nd, v, up))
                m = np.isfinite(fv) & np.isfinite(fs_)
                dL = np.abs(Lstar(np.repeat(fv[m][:, None], 3, 1)) - Lstar(np.repeat(fs_[m][:, None], 3, 1)))
                d8 = np.abs(fv[m] - fs_[m]) * 255
                res[ename][Nd][rn] = dict(dL=float(dL.mean()), d8=float(d8.mean()))
            print(ename, Nd, ' '.join('%s %.2f' % (rn, res[ename][Nd][rn]['d8']) for rn in RULES), flush=True)
            if Nd == 55:
                bg = np.array([0.93, 0.94, 0.95])
                def show(a):
                    a3 = np.repeat(np.nan_to_num(a, nan=-1)[..., None], 3, -1)
                    a3[np.isnan(a)] = bg
                    return a3
                from PIL import Image
                def sm(a): return to_img(show(a)).resize((360, 360), Image.LANCZOS)
                def bl(a): return to_img(show(np.kron(a, np.ones((9, 9)))))
                t = sm(vimg); label(t, '%s\nvoxel sphere, 55 units across' % ename, sz=13); tiles.append(t)
                t = bl(fv); label(t, 'the same far off\n(%.1f units per pixel)' % (FAR / (SIZE / (Nd * 1.15))), sz=13); tiles.append(t)
                for rn in ('VS', 'SQ', 'L1'):
                    t = bl(far(render_smooth(rn, Nd, v, up))); label(t, 'one smooth sphere, rule %s\nvs far off: |d| %.1f/255' % (rn, res[ename][Nd][rn]['d8']), sz=13); tiles.append(t)
    json.dump(res, open(OUT + 'tone_spheres.json', 'w'), indent=1)
    g = grid(tiles, 5, pad=6)
    g.save(OUT + 'A1_tone_rule_spheres.png'); print(g.size)

"""(c) the three film designs on the figure (six bars, recursive Average of films) from the drawing's eye and turned,
and their hologram strength / value stability over a sphere of eyes. Facet angle: cos_i = |v_i| (an axis face)."""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from obb import layers as obb_layers
from films import unit_boxes, mix, compose, outline
from pearl_film import R, d_for, cD, solve_index, OPD_X

TONE_LIN = np.array([float(lin(128 / 255)), 0.0, 1.0])
MP = (1.1638, 1.3539)                  # Mr Pearl's film (wf5 fit, seed 101): n_f on n_s


def tab(fn, n=2001):
    """tabulate a family's film colour against cos (0..1) for fast lookup"""
    c = np.linspace(0, 1, n)
    return c, fn(c)


class Design:
    def __init__(self, name):
        self.name = name
        c = np.linspace(1e-4, 1, 2001)
        self.c = c
        if name == 'P-A':
            Rc = R(c, *MP); RD = R(np.array([cD]), *MP)[0]
            T, TD = 1 - Rc, 1 - RD
            self.F = [TONE_LIN[i] * (T * T) / (TD * TD) + (Rc - RD) for i in range(3)]
        elif name == 'P-B':
            nz = 2.4
            RZ = R(np.array([cD]), nz, 1.0)[0] @ LUMA
            nx = solve_index(TONE_LIN[0] * RZ, 1.0)
            self.idx = (nx, 1.0, nz)
            self.F = [R(c, nx, 1.0) / RZ, np.zeros((len(c), 3)), R(c, nz, 1.0) / RZ]
        elif name == 'P-E':
            Rc = R(c, *MP)
            chrom = Rc / np.maximum(Rc @ LUMA, 1e-9)[:, None]
            self.F = [TONE_LIN[i] * chrom for i in range(3)]
        self.F = [np.asarray(f) for f in self.F]

    def facet(self, i, cosang):
        k = np.clip(np.round((np.asarray(cosang) - 1e-4) / (1 - 1e-4) * 2000), 0, 2000).astype(int)
        return self.F[i][k]


def face_colour(design, n, v):
    """sRGB colour of a face with normal n seen from v: the VS-weighted mix of its axis facets' film colours
    (linear light inside a facet, mixed by area in sRGB values as the tone rule mixes)."""
    w = np.maximum(n * v, 0)
    s = w.sum(-1, keepdims=True)
    w = w / np.maximum(s, 1e-12)
    out = np.zeros(n.shape)
    for i in range(3):
        col = enc(np.clip(design.facet(i, np.abs(v[..., i])), 0, 1))
        out += w[..., i:i + 1] * col
    return out


def render(design, d, up, centre, span, size=300, ss=2, ground=np.array([0.93, 0.94, 0.95])):
    O, D = ortho_rays(d, up, centre, span, (size * ss, size * ss))
    L = obb_layers(unit_boxes(), O, D, K=4)
    v = -D
    K = L['nin'].shape[0]
    cols = np.full(L['nin'].shape, np.nan)
    for k in range(K):
        cols[k] = np.where((L['n'] > k)[..., None], face_colour(design, L['nin'][k], v), np.nan)
    m = mix(cols, L['n'], 'recursive')
    img = compose(m, ground)
    img = outline(img, L['n'] >= 1, ss, col=(0.35, 0.35, 0.35))
    return down(img, ss)


def strength(design, neyes=400):
    """over a sphere of eyes: per family, the OKLab chroma of its facet colour and its lightness change vs the crux"""
    i = np.arange(neyes) + 0.5
    z = 1 - 2 * i / neyes; r = np.sqrt(1 - z * z); a = i * math.pi * (3 - math.sqrt(5))
    V = np.stack([r * np.cos(a), r * np.sin(a), z], -1)
    out = {}
    for fam in range(3):
        col = enc(np.clip(design.facet(fam, np.abs(V[:, fam])), 0, 1))
        ok = oklab(col)
        crux = enc(np.clip(design.facet(fam, np.array([cD])), 0, 1))[0]
        okc = oklab(crux)
        out['xyz'[fam]] = dict(chroma_mean=float(np.hypot(ok[:, 1], ok[:, 2]).mean()), chroma_p90=float(np.percentile(np.hypot(ok[:, 1], ok[:, 2]), 90)),
                               dL_mean=float(np.abs(ok[:, 0] - okc[0]).mean()), crux=hx(crux))
    return out


if __name__ == '__main__':
    import itertools
    res = {}
    tiles = []
    allc = np.array([b['c'] for b in unit_boxes()]); C0 = (allc.min(0) + allc.max(0)) / 2
    views = [("the drawing's eye", -np.ones(3), np.array([0, -1.0, 1]), CENTRE, 3.0), ('az 15 el 35', -az_el(15, 35), np.array([0, 0, 1.0]), C0, 3.6),
             ('az 75 el 35', -az_el(75, 35), np.array([0, 0, 1.0]), C0, 3.6), ('az 45 el 70', -az_el(45, 70), np.array([0, 0, 1.0]), C0, 3.6),
             ('az 45 el 10', -az_el(45, 10), np.array([0, 0, 1.0]), C0, 3.6), ('az 200 el -25', -az_el(200, -25), np.array([0, 0, 1.0]), C0, 3.6)]
    for dn in ('P-A', 'P-B', 'P-E'):
        des = Design(dn)
        res[dn] = strength(des)
        if dn == 'P-B':
            res[dn]['indices'] = dict(n_x=des.idx[0], n_y=1.0, n_z=des.idx[2], d_x=float(d_for(des.idx[0])), d_z=float(d_for(des.idx[2])))
        print(dn, json.dumps(res[dn]))
        for vi, (title, d, up, centre, span) in enumerate(views):
            img = render(des, d, up, centre, span)
            t = to_img(img); label(t, ('%s: %s' % (dn, title)), sz=12); tiles.append(t)
    g = grid(tiles, 6, pad=5); g.save(OUT + 'C2_film_designs.png'); print(g.size)
    json.dump(res, open(OUT + 'film_designs.json', 'w'), indent=1)

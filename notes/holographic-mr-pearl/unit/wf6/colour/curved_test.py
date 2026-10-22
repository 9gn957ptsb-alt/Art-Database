"""(a) test C: faces that turn because the unit's loose ends are curved along the line of sight (wf1/design-nesting
unit.py: the end beams' slices moved back along (1,1,1) by 2/phi x smoothstep). From the drawing's eye, the tone by
the face's own family (identity) vs by its turned normal (VS), against the original. And the same tails curved
TOWARDS the eye (the sign of the shear decides whether VS keeps the tone: n' ~ e_a - s'/(1+s') e_b)."""
import math, sys
import numpy as np
sys.path.insert(0, '.'); sys.path.insert(0, '/home/user/site/scripts')
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf1/design-nesting')
from common import *
from tone_rule import rule
import unit as U
import figure_studies as fs

C = np.array([128 / 255, 0, 1.0])


def cast_normals(prims, O, D):
    """nearest hit per ray: t, face normal (entry), identity tone (the face pair's own family)"""
    shp = O.shape[:-1]
    Of, Df = O.reshape(-1, 3), D.reshape(-1, 3)
    best = np.full(Of.shape[0], np.inf); nrm = np.zeros(Of.shape); idt = np.full(Of.shape[0], -1)
    for p in prims:
        N, w, pair = p.halfspaces()
        num, den = w - Of @ N.T, Df @ N.T
        with np.errstate(divide='ignore', invalid='ignore'):
            t = num / den
        enter = np.where(den < 0, t, -np.inf); leave = np.where(den > 0, t, np.inf)
        tn, tf, ax = enter.max(-1), leave.min(-1), enter.argmax(-1)
        ok = ((den != 0) | (num >= 0)).all(-1)
        hit = ok & (tn <= tf) & (tf > 0) & (tn < best)
        best[hit] = tn[hit]
        nrm[hit] = N[ax[hit]]
        idt[hit] = np.array(p.tone)[np.array(pair)[ax[hit]]]
    return best.reshape(shp), nrm.reshape(shp + (3,)), idt.reshape(shp)


def render(H, D_tail, sign=+1, ss=1):
    prims = U.place(U.unit(H=H, curved=True, D=sign * D_tail))
    O, Dd = drawing_rays()
    t, n, idt = cast_normals(prims, O, Dd)
    has = np.isfinite(t)
    v = -Dd
    vs = np.where(has, rule('VS', n, v), np.nan)
    ident = np.where(has, C[np.clip(idt, 0, 2)], np.nan)
    cosang = np.where(has, np.abs((n * v).sum(-1)), np.nan)
    return has, vs, ident, cosang, idt


if __name__ == '__main__':
    import json
    cls = np.load(S + 'wf3/colour-albers/cls_clean.npy')
    orig = raster_drawn()
    otone = np.where(orig >= 0, np.array([128, 0, 255])[np.clip(orig, 0, 2)], 255) / 255.0
    res = {}
    tiles = []
    for name, H_, Dt, sg in [('golden unit, tails curved back (unit.py)', U.HG, U.TAIL_D, 1), ('the drawing\'s bar, tails curved back', 1 / 9, U.TAIL_D, 1),
                            ('the drawing\'s bar, tails curved towards the eye', 1 / 9, U.TAIL_D, -1)]:
        has, vs, ident, cosang, idt = render(H_, Dt, sg)
        fig = has | (orig >= 0)
        g_vs = np.where(has, vs, 1.0); g_id = np.where(has, ident, 1.0)
        d_vs = float((np.abs(g_vs - otone)[fig]).mean() * 255); d_id = float((np.abs(g_id - otone)[fig]).mean() * 255)
        turned = has & (np.abs(cosang - 1 / math.sqrt(3)) > 1e-3)
        dif = has & (np.abs(vs - ident) > 1.5 / 255)
        res[name] = dict(mae_identity=d_id, mae_VS=d_vs, px_turned=int(turned.sum()), px_VS_differs=int(dif.sum()),
                         cos_range=[float(np.nanmin(cosang)), float(np.nanmax(cosang))])
        print(name, res[name])
        crop = (slice(64, 566), slice(326, 874))
        for lab, g in [('identity tone', g_id), ('VS tone (turned normal)', g_vs)]:
            t = to_img(np.repeat(g[crop][..., None], 3, -1)); label(t, '%s\n%s: |d| %.1f/255 vs the original' % (name, lab, d_id if lab.startswith('id') else d_vs), sz=12); tiles.append(t)
        m = np.where(dif, 1.0, np.where(has, 0.85, 1.0))
        a = np.repeat(m[crop][..., None], 3, -1); a[dif[crop]] = (0.85, 0.2, 0.2)
        t = to_img(a); label(t, 'where VS differs (%d px), faces off the crux angle: %d px' % (dif.sum(), turned.sum()), sz=12); tiles.append(t)
    g = grid(tiles, 3, pad=6); g.save(OUT + 'A2_curved_tails.png'); print(g.size)
    json.dump(res, open(OUT + 'tone_curved.json', 'w'), indent=1)

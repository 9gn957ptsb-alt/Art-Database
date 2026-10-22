"""(a) THE TONE RULE. The drawing gives three tones by the axis a face looks along (x grey 128, y black 0, z white 255).
A face that turns needs a continuous rule. Candidates (n the unit normal, v the unit vector to the eye):
  SQ   w_i = n_i^2                       (the suggested convex mix: the squares sum to one)
  L1   w_i = |n_i|                       (two-sided L1: a staircase seen from the drawing's eye, earlier study)
  VS   w_i = max(0, n_i v_i)             (a staircase of axis faces as the eye v sees it: the visible faces'
                                          projected areas; = L1 from the drawing's eye, = SQ head-on)
  ONE  t = clamp(1/2 + (n_z - n_y)/2)    (one light along the drawing's up)
  LAM  t = clamp(n . (1/2, 0, 1))        (Lambert from one light (1,0,2)/sqrt5 of strength sqrt5/2)
  tone = sum w_i c_i / sum w_i, c = (G, K, W) by axis (two-sided: -x grey, -y black, -z white).
Test A: a voxel staircase of each plane seen from each eye: the average tone of what is seen (in sRGB values, as
Colour Middling and the canvas average) against each rule. Test B: voxel spheres of 8..55 units across, far off.
"""
import json
import math
import sys
import time

import numpy as np

sys.path.insert(0, '.')
from common import *          # noqa
from vox import walk

C = np.array([128 / 255, 0.0, 1.0])


def rule(name, n, v):
    n = np.asarray(n, float); v = np.asarray(v, float)
    if name == 'SQ':
        w = n * n
    elif name == 'L1':
        w = np.abs(n)
    elif name == 'VS':
        w = np.maximum(n * v, 0)
    elif name == 'ONE':
        return np.clip(0.5 + 0.5 * (n[..., 2] - n[..., 1]), 0, 1)
    elif name == 'LAM':
        return np.clip(n @ np.array([0.5, 0, 1.0]), 0, 1)
    s = w.sum(-1)
    return (w @ C) / np.maximum(s, 1e-12)


RULES = ['SQ', 'L1', 'VS', 'ONE', 'LAM']


def fib_sphere(n, seed=0.5):
    i = np.arange(n) + seed
    z = 1 - 2 * i / n
    r = np.sqrt(1 - z * z)
    a = i * math.pi * (3 - math.sqrt(5))
    return np.stack([r * np.cos(a), r * np.sin(a), z], -1)


def staircase_measure(n, v, G=72, R=18.0, nray=3000, rng=None):
    """Average tone (sRGB values and linear) of a voxel staircase of the plane through the grid centre with normal
    n, seen along -v; rays uniformly over a disc of radius R (voxels) on the plane."""
    rng = rng or np.random.default_rng(1)
    c0 = np.full(3, G / 2.0)
    idx = np.indices((G, G, G)).reshape(3, -1).T + 0.5
    occ = (((idx - c0) @ n) < 0).reshape(G, G, G)
    # points on the plane's disc
    a = np.cross(n, [1, 0, 0] if abs(n[0]) < 0.9 else [0, 1, 0]); a /= np.linalg.norm(a)
    b = np.cross(n, a)
    rr = R * np.sqrt(rng.random(nray)); th = 2 * math.pi * rng.random(nray)
    P = c0 + rr[:, None] * (np.cos(th)[:, None] * a + np.sin(th)[:, None] * b)
    O = P + v * (G * 1.5)
    D = np.broadcast_to(-v, O.shape).copy()
    t, ax, sg = walk(occ, O, D)
    ok = ax >= 0
    tone = C[ax[ok]]
    frac = np.bincount(ax[ok], minlength=3) / max(ok.sum(), 1)
    return float(tone.mean()), float(enc(lin(tone).mean())), frac, float(ok.mean())


def test_planes():
    DRAW = np.ones(3) / math.sqrt(3)
    normals = fib_sphere(160)
    eyes = np.vstack([DRAW[None], fib_sphere(23, 0.3)])
    rows = []
    t0 = time.time()
    rng = np.random.default_rng(7)
    for ei, v in enumerate(eyes):
        v = v / np.linalg.norm(v)
        for n in normals:
            if n @ v < 0.25:
                continue
            m, m_lin, frac, okf = staircase_measure(n, v, rng=rng)
            if okf < 0.98:
                continue
            row = dict(eye=ei, n=n.tolist(), v=v.tolist(), cos=float(n @ v), meas=m, meas_lin=m_lin, frac=frac.tolist())
            for r in RULES:
                row[r] = float(rule(r, n, v))
            rows.append(row)
        print('eye %d done, %d rows, %.0fs' % (ei, len(rows), time.time() - t0), flush=True)
    return rows


def summarise(rows):
    out = {}
    for sel_name, sel in [('all eyes', lambda r: True), ("the drawing's eye", lambda r: r['eye'] == 0),
                          ('other eyes', lambda r: r['eye'] != 0)]:
        rs = [r for r in rows if sel(r)]
        d = {'pairs': len(rs)}
        for R in RULES:
            e = np.array([r[R] - r['meas'] for r in rs]) * 255
            d[R] = dict(mae_8bit=float(np.abs(e).mean()), max_8bit=float(np.abs(e).max()), rms_8bit=float(np.sqrt((e ** 2).mean())))
        out[sel_name] = d
    return out


if __name__ == '__main__':
    rows = test_planes()
    json.dump(rows, open(OUT + 'tone_planes.json', 'w'))
    s = summarise(rows)
    json.dump(s, open(OUT + 'tone_planes_summary.json', 'w'), indent=1)
    for k, d in s.items():
        print(k, d['pairs'], '  '.join('%s mae %.2f max %.1f' % (R, d[R]['mae_8bit'], d[R]['max_8bit']) for R in RULES))

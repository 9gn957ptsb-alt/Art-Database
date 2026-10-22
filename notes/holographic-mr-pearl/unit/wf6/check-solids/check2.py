#!/usr/bin/env python3
"""check-solids 2: (a) the 21 cube's texture level depends on where it stands (cells anchored at world multiples);
(b) fullness fetches per pixel under the full-cell rule; (c) F(j) | F(k) iff j | k; (d) sphere volumes exact;
(e) per-layer exposed area of the voxel sphere (is it 'equal area'?); (f) golden lengths."""
import sys, json, math
import numpy as np
SOL = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/solids'
sys.path.insert(0, SOL)
import os; os.chdir(SOL)
from common import *
import common as C
OUT = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-solids/'
out = {}

# (c)
F = [0, 1, 1]
while len(F) < 40: F.append(F[-1] + F[-2])
bad = [(j, k) for j in range(3, 30) for k in range(3, 30) if (F[k] % F[j] == 0) != (k % j == 0)]
out['fib_divisibility_counterexamples_j_ge_3'] = bad
out['fib_note'] = 'F(2) = 1 divides every F(k) although 2 need not divide k; for j >= 3 the iff holds (gcd(F_j,F_k) = F_gcd(j,k))'

# (a) + (b)
def levels(occ, origin, O, D, s_ask):
    r = walk_face(occ, O, D, origin=origin, tex=s_ask)
    cov = np.isfinite(r['val'])
    u, c = np.unique(r['s'][cov], return_counts=True)
    return {str(int(a)): round(float(b) / cov.sum(), 3) for a, b in zip(u, c)}, r

N = 21
res_a = {}
for off in (0, 1, 5):
    G = N + off + 2
    occ = np.zeros((G, G, G), bool); occ[off:off + N, off:off + N, off:off + N] = True
    c = np.full(3, off + N / 2)
    O, D, shape, px = drawing_view(c, 1.9 * N, 300, 300)
    lv, r = levels(occ, (0, 0, 0), O, D, 13.0)
    res_a['offset %d, crux eye, asked 13' % off] = lv
    O2, D2, _, _ = ortho(c, EYE_D, UP_D, 1.9 * N, 300, 300)      # the opposite eye (sees the x=off, y=off, z=off faces)
    lv2, r2 = levels(occ, (0, 0, 0), O2, D2, 13.0)
    res_a['offset %d, opposite eye, asked 13' % off] = lv2
    if off == 1:
        v = r['val']; img = np.where(np.isfinite(v), v, 240).reshape(300, 300)
        save(np.repeat(img[..., None], 3, 2).astype(np.uint8), OUT + 'K2_cube21_offset1_crux_asked13.png', 2)
    if off == 0:
        v = r2['val']; img = np.where(np.isfinite(v), v, 240).reshape(300, 300)
        save(np.repeat(img[..., None], 3, 2).astype(np.uint8), OUT + 'K2_cube21_offset0_opposite_asked13.png', 2)
out['cube21_levels_by_position'] = res_a
print(res_a, flush=True)

# (b) fetch count: replicate the full-cell loop, counting levels tried, on the S4 sphere 21 drawing and gameblock wall30
import solids_grid as SG
def fetches(occ, O, D, origin, tex):
    r = walk(occ, O, D, origin=origin, film='face', K=2, stop_after=1)
    hit = r['n'] > 0
    t = r['t'][hit, 0]
    s = tex(t) if callable(tex) else np.full(len(t), float(tex))
    p = (O[hit] - np.asarray(origin, float)) + D[hit] * (t + 1e-6)[:, None]
    SVT = C._svt(occ)
    n = np.where(s > 1, 1, 0)
    for _ in range(len(FIBS_M)):
        big = s > 1
        if not big.any(): break
        c0 = (np.floor(p / s[:, None]) * s[:, None]).astype(int); c1 = c0 + s[:, None].astype(int)
        full = big & C._full(SVT, c0, c1, s.astype(int))
        drop = big & ~full
        if not drop.any(): break
        j = np.searchsorted(FIBS_M, s[drop]); s[drop] = FIBS_M[np.maximum(j - 1, 0)]
        n[drop & (s > 1)] += 1
    u, c = np.unique(n, return_counts=True)
    return {str(int(a)): round(float(b) / len(n), 4) for a, b in zip(u, c)}, int(n.max())
fb = {}
for R in (21,):
    occ, _ = SG.sphere(R)
    for dist in (30,):
        (O, D, shape), eye = player(None, np.zeros(3), np.array(occ.shape, float), dist, 420, 315)
        fb['sphere21 p30'] = fetches(occ, O, D, (0, 0, 0), lambda t: tex_level(t, FOCAL))
    O, D, shape, px = drawing_view(np.full(3, R), 1.25 * np.sqrt(3) * 2 * R * .82, 420, 315)
    fb['sphere21 drawing asked 21'] = fetches(occ, O, D, (0, 0, 0), 21.0)
import gameblock as GB
for view in ('wall30', 'slope30'):
    v = GB.VIEWS[view]; O, D, shape = persp(v['eye'], v['tgt'], 480, 360, f=FOCAL)
    fb[view] = fetches(GB.occ, O, D, (0, 0, 0), lambda t: tex_level(t, FOCAL))
# a far view: the cube 21 seen from 150 m (asked 13 -> 21 by distance)
occ = np.ones((21, 21, 21), bool)
(O, D, shape), eye = player(None, np.zeros(3), np.full(3, 21.0), 150, 420, 315)
fb['cube21 p150'] = fetches(occ, O, D, (0, 0, 0), lambda t: tex_level(t, FOCAL))
out['fullness_fetches_levels_tried_frac_and_max'] = fb
print(fb, flush=True)

# (d) sphere volumes, exact ideal
sph = {}
for R in (3, 8, 21):
    occ, _ = SG.sphere(R)
    ideal = 4 / 3 * math.pi * R ** 3
    # sym diff by fine random sampling
    rng = np.random.default_rng(1)
    P = rng.uniform(-R - 1, R + 1, (4_000_000, 3))
    inb = np.all(np.abs(P) < R, 1)
    cidx = np.floor(P + R).astype(int)
    built = np.zeros(len(P), bool)
    built[inb] = occ[cidx[inb, 0], cidx[inb, 1], cidx[inb, 2]]
    ide = (P ** 2).sum(1) <= R * R
    vol = (2 * R + 2) ** 3
    sym = (built ^ ide).mean() * vol
    sph[R] = dict(blocks=int(occ.sum()), built_over_ideal=occ.sum() / ideal, sym_diff_over_ideal=sym / ideal)
    # (e) exposed area per layer (top+bottom+side faces of that layer's blocks)
    p = np.pad(occ, 1)
    areas = []
    for z in range(2 * R):
        L = p[1:-1, 1:-1, z + 1]
        up = L & ~p[1:-1, 1:-1, z + 2]; dn = L & ~p[1:-1, 1:-1, z]
        sx = (L & ~p[2:, 1:-1, z + 1]).sum() + (L & ~p[:-2, 1:-1, z + 1]).sum()
        sy = (L & ~p[1:-1, 2:, z + 1]).sum() + (L & ~p[1:-1, :-2, z + 1]).sum()
        areas.append(int(up.sum() + dn.sum() + sx + sy))
    a = np.array(areas, float)
    sph[R]['layer_exposed_area'] = areas
    sph[R]['layer_area_rel_range'] = float((a.max() - a.min()) / a.mean())
    sph[R]['layer_area_band_ideal'] = 2 * math.pi * R
    sph[R]['layer_blocks'] = [int(occ[:, :, z].sum()) for z in range(2 * R)]
out['spheres'] = sph
print(sph, flush=True)

# (f) golden lengths
g = {}
for H in (1 / 9, 1 / (6 * PHI)):
    L = [1 - 6 * H, 6 * H, 1, 1 + 6 * H, 2 + 6 * H]
    g['H=%.6f' % H] = dict(lengths=L, sums=[L[i] + L[i + 1] - L[i + 2] for i in range(3)],
                           ratios=[L[i + 1] / L[i] for i in range(4)], thirds=[x * 3 for x in L],
                           figure_over_hole=L[4] / L[0])
g['phi^4'] = PHI ** 4
out['golden'] = g
print(g)
dump(out, OUT + 'check2.json')

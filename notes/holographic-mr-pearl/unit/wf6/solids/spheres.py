#!/usr/bin/env python3
"""Built spheres OFF the block grid, of the 3D game unit (rocket.js FIGURE, 6 bars in its block) each closed by its
block cube under the surface-film rule, against the voxel sphere (on the grid) and the one perfect sphere (the head).

Unit placement (every relation stated):
  orientation  the unit's crux axis (1,1,1) along the sphere's outward normal at its place, its drawing-up (0,-1,1)
               along the meridian (north); so each unit, seen along the normal, is the drawing (the cube corner-on,
               a hexagon of three rhombi with the figure inside).
  depth        the cube's outer corner on the holding sphere of radius R (everything built lies inside it).
  BANDS        (Arnell p26) B = F(k) latitude bands of equal height 2R/B (equal area, Archimedes). In band j (arc ds)
               a ring of cubes of side s = ds/(1.5 sqrt2) (a zig-zag row of hexagons 1.5 hexagon-heights tall),
               alternately raised and lowered by ds/6 (the ladder's alternation), pitch <= 1.5 rho (rho = s sqrt(2/3),
               the hexagon's circumradius) so the row closes: n = 2 ceil(2 pi R_c cos(lat) / (2 * 1.5 rho)).
               B = the largest Fibonacci number with the equator's s >= 0.94 m (one block, as the rule s = 2R/B/2.12
               allows): B = R for R = 3, 8, 21.
  SPIRAL       N = F(k) units on the golden-angle spiral (z_i = 1 - (2i+1)/N, lon_i = i * 360/phi^2), each of the
               side that gives equal area: N * (3 sqrt3/2) rho^2 = 4 pi R^2.
  SHELLS       the spiral's shells at R, R/phi, R/phi^2 (each with N scaled by phi^-2): what passes one is met by the
               next (the golden-scale nesting in 3D).
Colour: face film = VS of the cube face's world normal; behind it the unit's first bar (VS of its world normal) else
the bulk m(v) (world); pixel = round((F + B)/2). The head: VS of the exact normal (no film, no unit).
"""
import sys, math, time
import numpy as np
sys.path.insert(0, '.')
from common import *

FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765]
RHO = math.sqrt(2 / 3)          # hexagon circumradius per unit side (cube corner-on)
BAR_C = (UNIT_LO + UNIT_HI) / 2 - 0.5
BAR_E = (UNIT_HI - UNIT_LO) / 2
BASIS = np.array([EYE_D, UP_D, RIGHT_D]).T      # model frame columns


def frame(nrm, north):
    nrm = nrm / np.linalg.norm(nrm)
    north = north - nrm * (north @ nrm); north /= np.linalg.norm(north)
    right = np.cross(-nrm, north)
    W = np.array([nrm, north, right]).T
    return W @ BASIS.T          # M: model -> world, M @ EYE_D = nrm


def place(nrm, s, R, north_ref=np.array([0, 0, 1.0])):
    n = nrm / np.linalg.norm(nrm)
    nb = north_ref if abs(n @ north_ref) < 0.999 else np.array([0, 1.0, 0])
    M = frame(n, nb)
    C = n * (R - s * math.sqrt(3) / 2)      # outer corner on the holding sphere
    return C, M, s


def bands(R, B):
    out, info = [], []
    h = 2 * R / B
    for j in range(B):
        z0, z1 = -R + j * h, -R + (j + 1) * h
        la0, la1 = math.asin(max(-1, z0 / R)), math.asin(min(1, z1 / R))
        lac = (la0 + la1) / 2
        ds = R * (la1 - la0)
        s = ds / (1.5 * math.sqrt(2))
        pitch = 1.5 * RHO * s
        n = 2 * max(1, math.ceil(2 * math.pi * R * math.cos(lac) / (2 * pitch)))
        info.append(dict(band=j, lat_deg=math.degrees(lac), arc=ds, side=s, units=n))
        for i in range(n):
            lo = 2 * math.pi * i / n
            la = lac + (1 if i % 2 == 0 else -1) * (ds / 6) / R
            nr = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
            out.append(place(nr, s, R))
    return out, info


def spiral(R, N):
    s = math.sqrt(4 * math.pi * R * R / (N * 1.5 * math.sqrt(3))) / RHO
    ga = 2 * math.pi / PHI ** 2
    out = []
    for i in range(N):
        z = 1 - (2 * i + 1) / N
        rr = math.sqrt(1 - z * z)
        nr = np.array([rr * math.cos(i * ga), rr * math.sin(i * ga), z])
        out.append(place(nr, s, R))
    return out, s


def cast_units(units, O, D, shape):
    """Surface-film rule for off-grid units. Returns vals (P,), tcube (P,), cover (P,), tests (P,)."""
    P = len(O); h, w = shape
    best = np.full(P, np.inf); val = np.full(P, np.nan); tests = np.zeros(P, int)
    v = -D[0] if np.allclose(D[0], D[-1]) else None
    ortho_ = v is not None
    if ortho_:
        o00 = O[0]; ex = O[1] - O[0]; ey = O[w] - O[0]
        Gi = np.linalg.inv(np.array([ex, ey, D[0]]).T)
    else:
        eye = O[0]; dc = D.reshape(h, w, 3); f3 = dc[h // 2, w // 2]
        r_ = dc[h // 2, -1] / (dc[h // 2, -1] @ f3) - dc[h // 2, 0] / (dc[h // 2, 0] @ f3)
        u_ = dc[0, w // 2] / (dc[0, w // 2] @ f3) - dc[-1, w // 2] / (dc[-1, w // 2] @ f3)
        fx = (w - 1) / np.linalg.norm(r_); fy = (h - 1) / np.linalg.norm(u_)
        rr = r_ / np.linalg.norm(r_); uu = u_ / np.linalg.norm(u_)
    mv_all = np.floor(mean_tone(-D) + 0.5)
    for (C, M, s) in units:
        rad = s * math.sqrt(3) / 2
        if ortho_:
            q = Gi @ (C - o00)
            j0, j1 = int(q[0] - rad / np.linalg.norm(ex)) - 1, int(q[0] + rad / np.linalg.norm(ex)) + 2
            i0, i1 = int(q[1] - rad / np.linalg.norm(ey)) - 1, int(q[1] + rad / np.linalg.norm(ey)) + 2
        else:
            rel = C - eye; z = rel @ f3
            if z <= rad:
                continue
            xs = (rel @ rr) / z * fx + (w - 1) / 2; ys = -(rel @ uu) / z * fy + (h - 1) / 2
            rp = rad / (z - rad) * max(fx, fy)
            j0, j1 = int(xs - rp) - 1, int(xs + rp) + 2; i0, i1 = int(ys - rp) - 1, int(ys + rp) + 2
        i0, j0 = max(i0, 0), max(j0, 0); i1, j1 = min(i1, h - 1), min(j1, w - 1)
        if i0 > i1 or j0 > j1:
            continue
        idx = (np.arange(i0, i1 + 1)[:, None] * w + np.arange(j0, j1 + 1)[None, :]).reshape(-1)
        Mi = M.T
        o = (O[idx] - C) @ Mi.T / s + 0.5          # in the unit's block frame [0,1]^3
        d = D[idx] @ Mi.T / s
        d = np.where(np.abs(d) < 1e-12, 1e-12, d)
        iv = 1 / d
        a = (0 - o) * iv; b = (1 - o) * iv
        lo3 = np.minimum(a, b); hi3 = np.maximum(a, b)
        tn, tf, ax = lo3.max(1), hi3.min(1), lo3.argmax(1)
        hit = (tn <= tf) & (tn > 0)
        sel = np.nonzero(hit & (tn * s < best[idx]))[0]
        tests[idx[hit]] += 7
        if len(sel) == 0:
            continue
        rows = idx[sel]
        dd = d[sel]; oo = o[sel]; ivs = iv[sel]
        # face film: the entered face's world normal
        nloc = np.zeros((len(sel), 3)); nloc[np.arange(len(sel)), ax[sel]] = -np.sign(dd[np.arange(len(sel)), ax[sel]])
        nw = nloc @ M.T
        F = np.floor(vs_tone(nw, -D[rows]) + 0.5)
        # bars inside
        A = (UNIT_LO[None] - oo[:, None]) * ivs[:, None]; Bq = (UNIT_HI[None] - oo[:, None]) * ivs[:, None]
        l3 = np.minimum(A, Bq); h3 = np.maximum(A, Bq)
        bn, bf, bax = l3.max(2), h3.min(2), l3.argmax(2)
        bh = (bn <= bf) & (bn >= tn[sel, None] - 1e-9)
        bt = np.where(bh, bn, np.inf)
        k = bt.argmin(1); tb = bt[np.arange(len(sel)), k]
        has = np.isfinite(tb)
        axb = bax[np.arange(len(sel)), k]
        nl2 = np.zeros((len(sel), 3)); nl2[np.arange(len(sel)), axb] = -np.sign(dd[np.arange(len(sel)), axb])
        Bc = np.where(has, np.floor(vs_tone(nl2 @ M.T, -D[rows]) + 0.5), mv_all[rows])
        best[rows] = tn[sel] * s
        val[rows] = np.floor((F + Bc) / 2 + 0.5)
    return val, best, np.isfinite(best), tests


def head(c, R, O, D):
    oc = O - c; bq = (oc * D).sum(1); cq = (oc * oc).sum(1) - R * R
    disc = bq * bq - cq; ok = disc >= 0
    t = -bq - np.sqrt(np.where(ok, disc, 0))
    n = (O + D * t[:, None] - c) / R
    val = np.where(ok, vs_tone(n, -D), np.nan)
    return val, ok


def voxel_sphere(R):
    n = 2 * R; g = np.arange(n) + 0.5 - R
    X, Y, Z = np.meshgrid(g, g, g, indexing='ij')
    return X ** 2 + Y ** 2 + Z ** 2 <= R * R


def sil_stats(cover):
    ys, xs = np.nonzero(cover)
    cy, cx = ys.mean(), xs.mean()
    ang = np.arctan2(ys - cy, xs - cx); rr = np.hypot(ys - cy, xs - cx)
    b = ((ang + np.pi) / (2 * np.pi) * 360).astype(int).clip(0, 359)
    rmax = np.full(360, np.nan)
    np.maximum.at(rmax, b, rr) if False else None
    rmax = np.array([rr[b == i].max() if (b == i).any() else np.nan for i in range(360)])
    rmax = rmax[np.isfinite(rmax)]
    m = rmax.mean()
    return dict(sil_rel_range=float((rmax.max() - rmax.min()) / m), sil_rel_std=float(rmax.std() / m),
                fill_of_disc=float(cover.sum() / (math.pi * m * m)))


W0 = 300; SS = 2


def views(R):
    c = np.zeros(3)
    vw = {}
    vw['drawing'] = drawing_view(c, 2.5 * R, W0 * SS, W0 * SS)[:3]
    for dist in (5, 30):
        a = math.radians(35)
        eye = np.array([math.cos(a), math.sin(a), 0]) * (R + dist); eye[2] = -R + 1.7
        vw['p%d' % dist] = persp(eye, c, W0 * SS, W0 * SS, f=FOCAL * SS * W0 / PHONE_H * 2.2 if dist == 5 else FOCAL * SS * W0 / PHONE_H * 2.2)
    return vw


def img_of(vals, cover, shape, bgc=(240, 236, 228)):
    im = np.tile(np.array(bgc, float), (len(vals), 1))
    im[cover] = np.clip(vals[cover], 0, 255)[:, None]
    h, w = shape
    return im.reshape(h // SS, SS, w // SS, SS, 3).mean((1, 3)).astype(np.uint8)


if __name__ == '__main__':
    out = {}
    for R in [int(a) for a in sys.argv[1:]] or [3, 8, 21]:
        k = FIB.index(R)
        B = R
        bu, binfo = bands(R, B)
        Nsp = max(f for f in FIB if f <= 4 * math.pi * R * R / (1.5 * math.sqrt(3) * RHO ** 2))
        su, s_sp = spiral(R, Nsp)
        sh = list(su)
        for j in (1, 2):
            Rj = R / PHI ** j
            Nj = max(f for f in FIB if f <= Nsp / PHI ** (2 * j) + 0.5)
            sh += spiral(Rj, Nj)[0]
        occ = voxel_sphere(R)
        forms = {'voxel': None, 'bands': bu, 'spiral': su, 'shells3': sh, 'head': None}
        if R > 3:
            forms.pop('shells3')
        st = dict(R=R, B=B, band_units=len(bu), bands=binfo, spiral_N=Nsp, spiral_side=s_sp, shells_units=len(sh),
                  voxel_blocks=int(occ.sum()))
        rows, labs = [], []
        for vn, (O, D, shape) in views(R).items():
            r, l = [], []
            for fn, U in forms.items():
                t0 = time.time()
                if fn == 'voxel':
                    res = walk_chunked(occ, O, D, origin=(-R, -R, -R), film='face', K=4, stop_after=2)
                    vals = colour(res, 'face', np.full(len(O), np.nan)); cov = np.isfinite(vals); tests = res['tests']
                elif fn == 'head':
                    vals, cov = head(np.zeros(3), R, O, D); tests = np.ones(len(O), int)
                else:
                    vals, _, cov, tests = cast_units(U, O, D, shape)
                im = img_of(vals, cov, shape)
                r.append(im); l.append('R%d %s %s' % (R, fn, vn))
                save(im, 'SPH_R%d_%s_%s.png' % (R, fn, vn))
                if vn == 'drawing':
                    hv, hc = head(np.zeros(3), R, O, D)
                    s2 = sil_stats(cov.reshape(shape))
                    s2['cover_of_head_disc'] = float((cov & hc).sum() / hc.sum())
                    s2['outside_head_disc'] = float((cov & ~hc).sum() / hc.sum())
                    s2['value_std'] = float(np.nanstd(vals[cov]))
                    s2['tests_mean_on_cover'] = float(tests[cov].mean())
                    st[fn] = s2
                print(R, fn, vn, '%.0fs' % (time.time() - t0), st.get(fn, ''), flush=True)
            rows.append(r); labs.append(l)
        sheet(rows, 'SPH_R%d_sheet.png' % R, labs)
        out['R%d' % R] = st
        prev = {}
        try:
            prev = json.load(open('spheres.json'))
        except Exception:
            pass
        prev.update(out)
        dump(prev, 'spheres.json')

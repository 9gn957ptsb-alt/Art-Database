"""(d) SOLIDITY. The land as the game builds it: 1 m blocks, each the unit (the six bars of the vector study scaled by
0.45 so it fills its block: bar 0.1 m, as rocket.js FIGURE), walked block to block along each ray (a DDA, as the
game's shader walks uVox). Every solid interval a ray passes through is a film (entry face toned by VS); films are
mixed by the recursive Average (Colour Middling's Average film by film from the back), so what lies behind k films
weighs 2^-k: Beer-Lambert in the count, per-film transmittance 1/2 (absorbance ln 2 per film).
Measures: films per ray, the share of rays that see through the land (geometric Beer-Lambert in the count of
blocks), and the change of the image when the land behind is made deeper (what still shows of the hidden)."""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from tone_rule import rule

SC = 0.45
LO0 = np.array([-1.111111, -0.111111, -1.111111])
UNIT = [((lo - LO0) * SC, (hi - LO0) * SC) for _, lo, hi in bars('model')]
UNIT_LO = np.array([u[0] for u in UNIT]); UNIT_HI = np.array([u[1] for u in UNIT])


def walk(O, D, filled, K=40, eps=1e-6, bulk=False):
    """O, D [R,3]; filled: bool [NX,NY,NZ] (block (i,j,k) occupies [i,i+1]x[j,j+1]x[k,k+1]).
    Returns per ray: n films (merged solid intervals, nearest first), entry normals [K,R,3], tin [K,R], block depth
    index [K,R] (how many filled blocks the ray had entered when the film began)."""
    R = O.shape[0]
    dims = np.array(filled.shape)
    with np.errstate(divide='ignore', invalid='ignore'):
        inv = 1.0 / D
        ta = (0 - O) * inv; tb = (dims - O) * inv
    t_enter = np.maximum(np.minimum(ta, tb).max(-1), 0)
    t_exit = np.maximum(ta, tb).min(-1)
    alive = t_enter < t_exit
    p = O + D * (t_enter + eps)[:, None]
    cell = np.clip(np.floor(p).astype(int), 0, dims - 1)
    step = np.where(D > 0, 1, -1)
    with np.errstate(divide='ignore', invalid='ignore'):
        nxt = cell + (step > 0)
        tmax = np.where(D != 0, (nxt - O) * inv, np.inf)
        tdel = np.where(D != 0, np.abs(inv), np.inf)
    n = np.zeros(R, int); cur_end = np.full(R, -np.inf)
    NIN = np.zeros((K, R, 3)); TIN = np.full((K, R), np.inf); BLK = np.full((K, R), -1); BUL = np.zeros((K, R), bool)
    nblk = np.zeros(R, int)
    tcur = t_enter.copy()
    for it in range(int(dims.sum()) + 3):
        if not alive.any():
            break
        ok = alive & filled[cell[:, 0].clip(0, dims[0] - 1), cell[:, 1].clip(0, dims[1] - 1), cell[:, 2].clip(0, dims[2] - 1)]
        if ok.any():
            idx = np.where(ok)[0]
            o, d = O[idx], D[idx]
            lo = cell[idx][:, None, :] + UNIT_LO[None]; hi = cell[idx][:, None, :] + UNIT_HI[None]
            with np.errstate(divide='ignore', invalid='ignore'):
                iv = 1.0 / d[:, None, :]
                t0 = (lo - o[:, None, :]) * iv; t1 = (hi - o[:, None, :]) * iv
            tmn = np.nan_to_num(np.minimum(t0, t1), nan=-np.inf); tmx = np.nan_to_num(np.maximum(t0, t1), nan=np.inf)
            tn = tmn.max(-1); tf = tmx.min(-1); ax = tmn.argmax(-1)
            hit = (tn <= tf) & (tf > 0)
            tn = np.where(hit, tn, np.inf)
            order = np.argsort(tn, 1)
            for j in range(6):
                b = order[:, j]
                tnj = tn[np.arange(len(idx)), b]; tfj = tf[np.arange(len(idx)), b]; axj = ax[np.arange(len(idx)), b]
                v = np.isfinite(tnj)
                join = v & (tnj <= cur_end[idx] + 1e-6)
                ext = join & (tfj > cur_end[idx])
                cur_end[idx[ext]] = tfj[ext]
                new = v & ~join
                put = new & (n[idx] < K)
                ii = idx[put]
                kk = n[ii]
                nv = np.zeros((len(ii), 3)); nv[np.arange(len(ii)), axj[put]] = -np.sign(d[put, axj[put]])
                NIN[kk, ii] = nv; TIN[kk, ii] = tnj[put]; BLK[kk, ii] = nblk[ii]
                n[idx[new]] += 1
                cur_end[idx[new]] = tfj[new]
            nblk[idx] += 1
        # step to the next cell
        a = tmax.argmin(-1)
        r = np.arange(R)
        tcur = tmax[r, a]
        was = alive & filled[cell[:, 0].clip(0, dims[0] - 1), cell[:, 1].clip(0, dims[1] - 1), cell[:, 2].clip(0, dims[2] - 1)]
        cell[r, a] += step[r, a]
        tmax[r, a] += tdel[r, a]
        alive &= (tcur < t_exit) & (cell >= 0).all(-1) & (cell < dims).all(-1)
        if bulk:
            now = alive & filled[cell[:, 0].clip(0, dims[0] - 1), cell[:, 1].clip(0, dims[1] - 1), cell[:, 2].clip(0, dims[2] - 1)]
            put = was & now & (tcur > cur_end + 1e-6) & (n < K)
            ii = np.where(put)[0]; kk = n[ii]
            nv = np.zeros((len(ii), 3)); nv[np.arange(len(ii)), a[ii]] = -step[ii, a[ii]]
            NIN[kk, ii] = nv; TIN[kk, ii] = tcur[ii]; BLK[kk, ii] = nblk[ii]; BUL[kk, ii] = True
            n[ii] += 1
    walk.BUL = BUL
    return np.minimum(n, K), n, NIN, TIN, BLK


def recursive_average(c8, n):
    """c8 [K,R,3] 8-bit colours nearest first, n [R]: C_last = c_last, C_k = round((c_k + C_{k+1})/2)."""
    K = c8.shape[0]
    acc = np.zeros(c8.shape[1:])
    for k in range(K - 1, -1, -1):
        last = (n == k + 1)[:, None]; deeper = (n > k + 1)[:, None]
        acc = np.where(last, c8[k], np.where(deeper, np.floor((c8[k] + acc) / 2 + 0.5), acc))
    return acc


PAL_GREY = np.array([[128, 128, 128], [0, 0, 0], [255, 255, 255]])          # x, y, z
PAL_PAIR = np.array([[128, 128, 128], [3, 26, 81], [252, 229, 174]])          # Cezanne pair: navy / sun glow, grey their Average


def colours(NIN, n, v, pal):
    K, R, _ = NIN.shape
    fam = np.abs(NIN).argmax(-1)
    c8 = pal[fam].astype(float)
    return c8


def view_rays(d, up, centre, span, size):
    O, D = ortho_rays(d, up, centre, span, size, back=80.0)
    return O.reshape(-1, 3), D.reshape(-1, 3)


if __name__ == '__main__':
    res = {}
    SZ = 260
    eyes = [("the drawing's eye", -np.ones(3), np.array([0, -1.0, 1])), ('az 30 el 35', -az_el(30, 35), np.array([0, 0, 1.0])),
            ('az 60 el 60', -az_el(60, 60), np.array([0, 0, 1.0]))]
    # 1. geometric Beer-Lambert: share of rays seeing through a slab of m blocks (wide, so edges do not matter)
    W = 24
    bl = {}
    for name, d, up in eyes:
        row = []
        for m in (1, 2, 3, 4, 6, 8):
            filled = np.zeros((W, W, m), bool); filled[:] = True
            centre = np.array([W / 2, W / 2, m / 2])
            O, D = view_rays(d, up, centre, 4.0, (120, 120))
            nK, nall, NIN, TIN, BLK = walk(O, D, filled, K=48)
            row.append(dict(m=m, through=float((nall == 0).mean()), films_mean=float(nall.mean()), films_p10=float(np.percentile(nall, 10)),
                            ge8=float((nall >= 8).mean())))
        bl[name] = row
        print(name, [(r['m'], round(r['through'], 4), round(r['films_mean'], 2), round(r['ge8'], 3)) for r in row])
    res['slab'] = bl
    # 2. renders: one unit / a wall one block thick / the land 6x6x4 / the land 6x6x8 (deeper: what still shows?)
    scenes = {}
    one = np.zeros((1, 1, 1), bool); one[:] = True
    wall = np.zeros((6, 1, 4), bool); wall[:] = True
    land4 = np.zeros((6, 6, 4), bool); land4[:] = True
    land8 = np.zeros((6, 6, 8), bool); land8[:] = True
    tiles = []
    imgs = {}
    for name, d, up in eyes:
        for sname, f, centre_off in [('one unit (a film)', one, 0), ('a wall 1 block deep', wall, 0), ('land 6x6x4 blocks', land4, 0), ('land 6x6x8 blocks', land8, 4)]:
            dims = np.array(f.shape, float)
            centre = dims / 2 + np.array([0, 0, centre_off])
            span = 1.9 if f.size == 1 else 10.5
            if f.size > 1 and centre_off:
                centre = np.array([3, 3, 6.0])
            if f.size > 1 and not centre_off:
                centre = np.array([3, 3 if f.shape[1] > 1 else 0.5, 2.0])
            O, D = view_rays(d, up, centre, span, (SZ, SZ))
            nK, nall, NIN, TIN, BLK = walk(O, D, f, K=48)
            v = -D
            for pn, pal in (('grey', PAL_GREY), ('pair', PAL_PAIR)):
                c8 = colours(NIN, nK, v, pal)
                out = recursive_average(c8, nK)
                img = np.where((nK > 0)[:, None], out / 255, np.array([0.93, 0.94, 0.95])).reshape(SZ, SZ, 3)
                imgs[(name, sname, pn)] = img
            imgs[(name, sname, 'n')] = nall.reshape(SZ, SZ)
            imgs[(name, sname, 'blk')] = BLK.reshape(-1, SZ, SZ)
            front = nK > 0
            wdeep = np.zeros(nK.shape)       # weight of films that begin beyond the first block the ray entered
            for k in range(48):
                wk = np.where(nK > k + 1, 0.5 ** (k + 1), np.where(nK == k + 1, 0.5 ** k, 0))
                wdeep += np.where(BLK[k] >= 1, wk, 0)
            scenes['%s / %s' % (name, sname)] = dict(films_mean=float(nall[front].mean()) if front.any() else 0, films_max=int(nall.max()),
                                                     ge8=float((nall[front] >= 8).mean()) if front.any() else 0,
                                                     weight_beyond_first_block=float(wdeep[front].mean()) if front.any() else 0,
                                                     greys=int(len(np.unique(imgs[(name, sname, 'grey')][front.reshape(SZ, SZ)][:, 0]))))
            print(name, sname, scenes['%s / %s' % (name, sname)])
    # deeper land: the 6x6x4 vs 6x6x8 land seen from above-ish: only the top 4 layers shared. Compare on the same rays
    cmp = {}
    for name, d, up in eyes:
        centre = np.array([3, 3, 2.0])
        O, D = view_rays(d, up, centre, 10.5, (SZ, SZ))
        a = walk(O, D, land4, K=48);
        f8 = np.zeros((6, 6, 8), bool); f8[:] = True
        O2 = O + np.array([0, 0, 4.0])                     # the same land, 4 more blocks of it beneath
        b = walk(O2, D, f8, K=48)
        ca = recursive_average(colours(a[2], a[0], -D, PAL_GREY), a[0])
        cb = recursive_average(colours(b[2], b[0], -D, PAL_GREY), b[0])
        both = (a[0] > 0) & (b[0] > 0)
        diff = np.abs(ca - cb).max(-1)[both]
        cmp[name] = dict(px=int(both.sum()), changed=float((diff > 0).mean()), changed_gt1=float((diff > 1).mean()), max=float(diff.max()),
                         mean=float(diff.mean()))
        print('deeper land', name, cmp[name])
    res['scenes'] = scenes
    res['deeper_land_changes'] = cmp
    # 3. the 8-bit depth: after k films, how much can what lies behind still change the pixel (exhaustive on random stacks)
    rng = np.random.default_rng(1)
    depth = []
    for k in range(1, 12):
        fronts = rng.choice([0, 128, 255], size=(20000, k))
        lo = np.zeros(20000); hi = np.full(20000, 255.0)
        for j in range(k - 1, -1, -1):
            lo = np.floor((fronts[:, j] + lo) / 2 + 0.5); hi = np.floor((fronts[:, j] + hi) / 2 + 0.5)
        fl = 255 * 0.5 ** k
        depth.append(dict(k=k, behind_weight=0.5 ** k, max_change_8bit_rounded=int((hi - lo).max()), change_float=fl))
    res['depth'] = depth
    print(depth)
    json.dump(res, open(OUT + 'land.json', 'w'), indent=1)
    np.save(OUT + 'land_imgs.npy', np.array([0]))
    # sheet
    cols = []
    for name, d, up in eyes:
        for sname in ('one unit (a film)', 'a wall 1 block deep', 'land 6x6x4 blocks'):
            s = scenes['%s / %s' % (name, sname)]
            for pn in ('grey', 'pair'):
                t = to_img(imgs[(name, sname, pn)]); label(t, '%s\n%s%s' % (sname, name, '' if pn == 'grey' else ', Cezanne pair'), sz=11); tiles.append(t)
            nn = imgs[(name, sname, 'n')].astype(float)
            heat = np.stack([np.clip(nn / 8, 0, 1), np.clip(nn / 8, 0, 1) * 0.5 + 0.2 * (nn >= 8), 1 - np.clip(nn / 8, 0, 1)], -1)
            heat[nn == 0] = (0.93, 0.94, 0.95)
            t = to_img(heat); label(t, 'films per ray (blue 1 .. orange 8+)\nmean %.1f, >=8: %.0f%%, behind 1st block %.3f' % (s['films_mean'], 100 * s['ge8'], s['weight_beyond_first_block']), sz=11); tiles.append(t)
    g = grid(tiles, 6, pad=5); g.save(OUT + 'D1_land_solid.png'); print(g.size)

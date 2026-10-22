"""Oriented boxes (centre, three half-axis vectors) and an all-crossings caster for them: needed for copies turned
off the lattice (the half turn about the line of sight), whose faces no longer look along the axes."""
import numpy as np


def aabb(name, lo, hi, level=0):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    return dict(name=name, c=(lo + hi) / 2, E=np.diag((hi - lo) / 2), level=level)


def moved(b, M=np.eye(3), scale=1.0, t=np.zeros(3), about=np.zeros(3), level=None, tag=''):
    M = np.asarray(M, float)
    return dict(name=tag + b['name'], c=M @ (scale * (b['c'] - about)) + about + t, E=(M @ (scale * b['E']).T).T,
                level=b['level'] if level is None else level)


def hits(b, O, D):
    E = b['E']
    w = np.linalg.norm(E, axis=1)
    N = E / w[:, None]
    o = (O - b['c']) @ N.T
    dd = D @ N.T
    with np.errstate(divide='ignore', invalid='ignore'):
        t0 = (-w - o) / dd
        t1 = (w - o) / dd
    lo = np.nan_to_num(np.minimum(t0, t1), nan=-np.inf)
    hi = np.nan_to_num(np.maximum(t0, t1), nan=np.inf)
    tn, tf = lo.max(-1), hi.min(-1)
    ai, ao = lo.argmax(-1), hi.argmin(-1)
    di = np.take_along_axis(dd, ai[..., None], -1)[..., 0]
    do = np.take_along_axis(dd, ao[..., None], -1)[..., 0]
    ni = -np.sign(di)[..., None] * N[ai]
    no = np.sign(do)[..., None] * N[ao]
    ok = (tn <= tf) & (tf > 0)
    return np.where(ok, tn, np.inf), np.where(ok, tf, np.inf), ni, no


def layers(boxes, O, D, K=6, owner=None, eps=1e-7):
    """Per ray up to K layers, nearest first: maximal intervals inside the union of boxes of one owner.
    Returns tin, tout [K,...], nin, nout [K,...,3] (entry / exit normals), box [K,...] (entry box), lev, n."""
    shp = O.shape[:-1]
    B = len(boxes)
    TN = np.full((B,) + shp, np.inf); TF = np.full((B,) + shp, np.inf)
    NI = np.zeros((B,) + shp + (3,)); NO = np.zeros((B,) + shp + (3,))
    for i, b in enumerate(boxes):
        TN[i], TF[i], NI[i], NO[i] = hits(b, O, D)
    own = np.zeros(B, int) if owner is None else np.asarray(owner)
    levs = np.array([b.get('level', 0) for b in boxes])
    order = np.argsort(TN, 0)
    out = dict(tin=np.full((K,) + shp, np.inf), tout=np.full((K,) + shp, np.inf), nin=np.zeros((K,) + shp + (3,)),
               nout=np.zeros((K,) + shp + (3,)), box=np.full((K,) + shp, -1, int), lev=np.full((K,) + shp, -1, int))
    cnt = np.zeros(shp, int); cur_end = np.full(shp, -np.inf); cur_own = np.full(shp, -1); cur_k = np.full(shp, -1)
    for j in range(B):
        idx = order[j]
        tn = np.take_along_axis(TN, idx[None], 0)[0]
        tf = np.take_along_axis(TF, idx[None], 0)[0]
        ni = np.take_along_axis(NI, idx[None, ..., None], 0)[0]
        no = np.take_along_axis(NO, idx[None, ..., None], 0)[0]
        valid = np.isfinite(tn)
        ow = own[idx]
        join = valid & (tn <= cur_end + eps) & (ow == cur_own)
        ext = join & (tf > cur_end)
        for kk in range(K):
            m = ext & (cur_k == kk)
            if m.any():
                out['tout'][kk][m] = tf[m]; out['nout'][kk][m] = no[m]
        cur_end = np.where(ext, tf, cur_end)
        new = valid & ~join
        put = new & (cnt < K)
        for kk in range(K):
            m = put & (cnt == kk)
            if m.any():
                out['tin'][kk][m] = tn[m]; out['tout'][kk][m] = tf[m]
                out['nin'][kk][m] = ni[m]; out['nout'][kk][m] = no[m]
                out['box'][kk][m] = idx[m]; out['lev'][kk][m] = levs[idx[m]]
        cur_k = np.where(put, cnt, cur_k)
        cnt = cnt + new
        cur_end = np.where(new, tf, cur_end)
        cur_own = np.where(new, ow, cur_own)
    out['n'] = np.minimum(cnt, K)
    out['n_all'] = cnt
    return out

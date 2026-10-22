"""Voxel staircase tests of the tone rule: a numpy Amanatides-Woo walk through an occupancy grid."""
import numpy as np


def walk(occ, O, D, max_steps=None):
    """occ [X,Y,Z] bool; O, D [N,3] in voxel units (voxel (i,j,k) = [i,i+1]x[j,j+1]x[k,k+1]).
    Returns t of the first solid voxel entered, its entry axis and sign (the face looks along sign*axis)."""
    N = O.shape[0]
    dims = np.array(occ.shape)
    # start on the grid's bounding box
    with np.errstate(divide='ignore', invalid='ignore'):
        inv = 1.0 / D
        t0 = (0 - O) * inv; t1 = (dims - O) * inv
    tmin = np.nan_to_num(np.minimum(t0, t1), nan=-np.inf).max(1)
    tmax = np.nan_to_num(np.maximum(t0, t1), nan=np.inf).min(1)
    start = np.maximum(tmin, 0) + 1e-9
    alive = tmax > start
    P = O + D * start[:, None]
    c = np.clip(np.floor(P).astype(int), 0, dims - 1)
    step = np.where(D > 0, 1, -1)
    with np.errstate(divide='ignore', invalid='ignore'):
        nextb = c + (step > 0)
        tM = np.where(D != 0, (nextb - O) * inv, np.inf)
        tD = np.where(D != 0, np.abs(inv), np.inf)
    # the axis by which the ray entered the start voxel: the box face it came through
    ent_ax = np.nan_to_num(np.minimum(t0, t1), nan=-np.inf).argmax(1)
    t_hit = np.full(N, np.inf); ax_hit = np.full(N, -1); sg_hit = np.zeros(N, int)
    cur_ax = ent_ax.copy(); cur_t = start.copy()
    active = alive.copy()
    max_steps = max_steps or int(dims.sum() + 4)
    for _ in range(max_steps):
        idx = np.nonzero(active)[0]
        if idx.size == 0:
            break
        cc = c[idx]
        inside = ((cc >= 0) & (cc < dims)).all(1)
        solid = np.zeros(idx.size, bool)
        solid[inside] = occ[cc[inside, 0], cc[inside, 1], cc[inside, 2]]
        hit = idx[solid]
        t_hit[hit] = cur_t[hit]; ax_hit[hit] = cur_ax[hit]
        sg_hit[hit] = -step[hit, cur_ax[hit]]
        active[hit] = False
        gone = idx[~inside]
        active[gone] = False
        mov = idx[inside & ~solid]
        if mov.size == 0:
            continue
        tm = tM[mov]
        a = tm.argmin(1)
        cur_t[mov] = tm[np.arange(mov.size), a]
        cur_ax[mov] = a
        c[mov, a] += step[mov, a]
        tM[mov, a] += tD[mov, a]
        out = cur_t[mov] > tmax[mov]
        active[mov[out]] = False
    return t_hit, ax_hit, sg_hit

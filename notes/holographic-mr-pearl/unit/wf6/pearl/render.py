"""render.py - numpy sphere tracer for pearl primitives (prims.py), flat study shading or the pearl material
(numpy twin of pearl.glsl), the eyes painted on the head sphere, outlines from depth / part breaks.

Cameras are orthographic: dict(f, r, u, scale [px per unit], W, H, aw [world anchor], ap [pixel anchor])."""
import sys, math
import numpy as np
from prims import sdf, bound, unit

GROUP_COLOURS = {
    'pearl': (0.93, 0.92, 0.96), 'eye': (0.05, 0.05, 0.07), 'hat': (0.95, 0.86, 0.66),
    'band': (0.72, 0.62, 0.78), 'jacket': (0.80, 0.84, 0.97), 'trousers': (0.78, 0.93, 0.95),
    'glove': (0.99, 0.99, 0.99), 'shoe': (0.97, 0.80, 0.86), 'guitar': (0.93, 0.70, 0.42),
    'fretboard': (0.33, 0.22, 0.16), 'dark': (0.12, 0.10, 0.10), 'tuner': (0.85, 0.80, 0.55),
    'strap': (0.10, 0.10, 0.12), 'neck': (0.25, 0.22, 0.25), 'ghost': (0.55, 0.75, 1.0),
}


def ortho_camera(view_dir, up, scale, W, H, anchor_world, anchor_px):
    f = unit(view_dir)
    r = unit(np.cross(f, up))
    u = np.cross(r, f)
    return dict(f=f, r=r, u=u, scale=float(scale), W=int(W), H=int(H),
                aw=np.asarray(anchor_world, float), ap=np.asarray(anchor_px, float))


def cam_rays(cam, back=60.0):
    W, H = cam['W'], cam['H']
    jj, ii = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
    a = (jj - cam['ap'][0]) / cam['scale']
    b = -(ii - cam['ap'][1]) / cam['scale']
    o = cam['aw'][None, :] + a.reshape(-1, 1) * cam['r'] + b.reshape(-1, 1) * cam['u'] - back * cam['f']
    return o, cam['f']


def project(cam, pts):
    pts = np.atleast_2d(pts) - cam['aw']
    return np.c_[pts @ cam['r'] * cam['scale'] + cam['ap'][0], -(pts @ cam['u']) * cam['scale'] + cam['ap'][1]]


def march_prim(pr, o, d, steps=200, eps=None):
    c, rb = bound(pr)
    rb = rb * 1.02 + 1e-3 * (1 + rb)
    oc = c - o
    tc = oc @ d
    dist2 = np.einsum('ij,ij->i', oc, oc) - tc * tc
    sel = np.nonzero(dist2 < rb * rb)[0]
    if len(sel) == 0:
        return sel, np.zeros(0)
    half = np.sqrt(np.maximum(rb * rb - dist2[sel], 0))
    t = tc[sel] - half
    t1 = tc[sel] + half
    k = 0.7 if pr['kind'] in ('ellipsoid', 'dome') else 0.97
    eps = eps if eps is not None else 2e-4 * rb + 1e-6
    active = np.ones(len(sel), bool)
    hit = np.zeros(len(sel), bool)
    O = o[sel]
    for _ in range(steps):
        ai = np.nonzero(active)[0]
        if len(ai) == 0:
            break
        s = sdf(pr, O[ai] + t[ai, None] * d)
        h = s < eps
        hit[ai[h]] = True
        active[ai[h]] = False
        t[ai[~h]] += np.maximum(s[~h] * k, eps * 0.5)
        active &= ~(t > t1)
    return sel[hit], t[hit]


def normal_at(pr, pw, e=None):
    _, rb = bound(pr)
    e = e or 1e-4 * max(rb, 1e-3)
    g = np.zeros_like(pw)
    for a in range(3):
        dv = np.zeros(3); dv[a] = e
        g[:, a] = sdf(pr, pw + dv) - sdf(pr, pw - dv)
    return g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-12)


def trace(prims, cam):
    o, d = cam_rays(cam)
    N = cam['W'] * cam['H']
    depth = np.full(N, np.inf)
    pid = np.full(N, -1, int)
    for i, pr in enumerate(prims):
        idx, t = march_prim(pr, o, d)
        if len(idx) == 0:
            continue
        closer = t < depth[idx]
        depth[idx[closer]] = t[closer]
        pid[idx[closer]] = i
    nrm = np.zeros((N, 3))
    for i, pr in enumerate(prims):
        m = np.nonzero(pid == i)[0]
        if len(m):
            n = normal_at(pr, o[m] + depth[m, None] * d)
            n[(n @ d) > 0] *= -1
            nrm[m] = n
    return o, d, depth, pid, nrm


def eye_mask(head, pts):
    """pts on the head sphere -> bool, inside a painted eye. head: dict(c, r, eyes=[dir], up, hw, hh)"""
    c = np.asarray(head['c'], float); r = head['r']
    q = (pts - c) / r
    inside = np.zeros(len(pts), bool)
    for e in head['eyes']:
        e = unit(e)
        upv = np.array([0, 0, 1.0]) - e * e[2]; upv = unit(upv)
        side = np.cross(upv, e)
        x, y = q @ side, q @ upv
        inside |= ((q @ e) > 0) & ((x / head['hw']) ** 2 + (y / head['hh']) ** 2 <= 1.0)
    return inside


def edge_mask(pid, depth, thr):
    H, W = pid.shape
    dep = np.where(np.isfinite(depth), depth, 1e9)
    e = np.zeros((H, W), bool)
    for ax in (0, 1):
        a = np.take(pid, range(1, pid.shape[ax]), axis=ax); b = np.take(pid, range(0, pid.shape[ax] - 1), axis=ax)
        da = np.take(dep, range(1, pid.shape[ax]), axis=ax); db = np.take(dep, range(0, pid.shape[ax] - 1), axis=ax)
        diff = (a != b) & ((np.abs(da - db) > thr) | (a < 0) | (b < 0))
        if ax == 0:
            e[1:, :] |= diff; e[:-1, :] |= diff
        else:
            e[:, 1:] |= diff; e[:, :-1] |= diff
    return e


def render_flat(prims, cam, head=None, light=(-0.45, -0.75, 0.55), bg=(0.965, 0.962, 0.955), outline=True,
                colours=GROUP_COLOURS, edge_thr=None):
    o, d, depth, pid, nrm = trace(prims, cam)
    N = len(pid)
    L = unit(light); L2 = unit([0.6, -0.3, 0.2])
    img = np.ones((N, 3)) * np.asarray(bg, float)
    hitm = pid >= 0
    lam = 0.30 + 0.62 * np.clip(nrm @ L, 0, 1) + 0.18 * np.clip(nrm @ L2, 0, 1)
    base = np.array([colours.get(prims[i]['group'], (0.7, 0.7, 0.7)) if i >= 0 else (0, 0, 0) for i in pid])
    img[hitm] = np.clip(base[hitm] * lam[hitm, None], 0, 1)
    if head is not None:
        hp = np.nonzero(hitm & (np.array([prims[i]['part'] == 'head' if i >= 0 else False for i in pid])))[0]
        if len(hp):
            em = eye_mask(head, o[hp] + depth[hp, None] * d)
            img[hp[em]] = np.array([0.05, 0.05, 0.07]) * (0.6 + 0.6 * lam[hp[em], None])
            # thin dark rim around the paint
            if 'rim' in head:
                pass
    img = img.reshape(cam['H'], cam['W'], 3)
    pid2 = pid.reshape(cam['H'], cam['W']); dep2 = depth.reshape(cam['H'], cam['W'])
    if outline:
        thr = edge_thr if edge_thr is not None else 12.0 / cam['scale']
        img[edge_mask(pid2, dep2, thr)] *= 0.25
        if head is not None:
            # outline the eyes too
            em2 = np.zeros(N, bool)
            hp = np.nonzero(np.array([prims[i]['part'] == 'head' if i >= 0 else False for i in pid]))[0]
            if len(hp):
                em2[hp] = eye_mask(head, o[hp] + depth[hp, None] * d)
            em2 = em2.reshape(cam['H'], cam['W'])
            b = np.zeros_like(em2)
            b[1:, :] |= em2[1:, :] != em2[:-1, :]; b[:, 1:] |= em2[:, 1:] != em2[:, :-1]
            img[b & (pid2 >= 0)] *= 0.3
    return (np.clip(img, 0, 1) * 255).astype(np.uint8), pid2, dep2


# ---------------------------------------------------------------- the pearl material (numpy twin of pearl.glsl)
sys.path.append('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py')
import json as _json
import model5 as _M5
from colour import lin_to_srgb as _l2s, srgb_to_lin as _s2l
_WF5 = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py'
sys.path[:] = [x for x in sys.path if x != _WF5] + [_WF5]     # model5 puts wf5 first; keep ours first
_M5.FIX['freq'] = 3.0; _M5.FIX['freq2'] = 3.0
PEARL_P = _json.load(open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/fit5c.json'))[0]['p']
PEARL_BASE = np.array([PEARL_P['bR'], PEARL_P['bG'], PEARL_P['bB']])
PEARL_EYE = _s2l(np.array([0x28, 0x1c, 0x16]) / 255.0)
DARK_GROUPS = ('dark', 'strap', 'neck', 'fretboard', 'tuner')


def pearl_shade(n_view, p_obj, base):
    """numpy twin of pearlCovers(): n in view space (x right, y up, z to the eye), pattern at p_obj"""
    P = dict(PEARL_P); P['bR'], P['bG'], P['bB'] = base
    v = np.tile([0, 0, 1.0], (len(n_view), 1))
    z1, z2 = _M5.noise_fields(p_obj, _M5.FIX, real=0)
    return _M5.shade(P, n_view, v, z1, z2)


def render_pearl(prims, cam, head, bases, bg=None, trace_out=None, body_c=None):
    """the covers' look: every pearly part in the film, head pattern on its own normal; returns sRGB uint8"""
    o, d, depth, pid, nrm = trace_out if trace_out is not None else trace(prims, cam)
    N = len(pid)
    img = np.zeros((N, 3))
    if bg is None:
        # sky gradient by screen height (the covers' navy to the sunset band)
        H, W = cam['H'], cam['W']
        yy = np.repeat(np.linspace(1, 0, H), W)
        zen = np.array([0.0018, 0.0123, 0.0561]); lo = np.array([0.0160, 0.0467, 0.1651]); band = np.array([0.9779, 0.7280, 0.3328])
        c = lo[None] * (1 - yy[:, None]) + zen[None] * yy[:, None]
        c = c + (band - c) * np.exp(-np.maximum(yy - 0.12, 0) * 9.0)[:, None] * 0.6
        img[:] = c
    else:
        img[:] = bg
    V = np.stack([cam['r'], cam['u'], -cam['f']])        # world -> view
    hc = np.asarray(head['c'], float); hr = head['r']
    bc = np.asarray(body_c if body_c is not None else head['c'], float)
    for i, pr in enumerate(prims):
        m = np.nonzero(pid == i)[0]
        if len(m) == 0:
            continue
        pw = o[m] + depth[m, None] * d
        nv = nrm[m] @ V.T
        g = pr['group']
        if pr['part'] == 'head':
            q = (pw - hc) / hr
            q /= np.linalg.norm(q, axis=1, keepdims=True)
            col = pearl_shade(nv, q, PEARL_BASE)
            em = eye_mask(head, pw)
            if em.any():
                key = np.array([-0.91561, -0.34202, 0.21138])
                ndv = np.clip(nv[em, 2], 1e-4, 1)
                F = 0.04 + 0.96 * (1 - ndv) ** 5
                h = key + np.array([0, 0, 1.0]); h /= np.linalg.norm(h)
                nh = np.clip(nv[em] @ h, 0, 1); a2 = 0.08 ** 2
                spec = 0.6 * a2 / (np.pi * (nh * nh * (a2 - 1) + 1) ** 2) * np.clip(nv[em] @ key, 0, None)
                col[em] = PEARL_EYE + F[:, None] * np.array([8.195, 3.052, 0.309]) * 0.06 + spec[:, None]
        elif g in DARK_GROUPS:
            b = np.asarray(bases.get(g, (0.02, 0.02, 0.02)), float)
            key = np.array([-0.91561, -0.34202, 0.21138]); sun = np.array([0.95616, 0.01745, 0.29233])
            lam = 0.3 + 0.9 * np.clip(nv @ key, 0, None) + 0.6 * np.clip(nv @ sun, 0, None)
            ndv = np.clip(nv[:, 2], 1e-4, 1); F = 0.04 + 0.96 * (1 - ndv) ** 5
            col = b[None] * lam[:, None] + F[:, None] * np.array([8.195, 3.052, 0.309]) * 0.04
        else:
            b = np.asarray(bases.get(g, PEARL_BASE), float)
            col = pearl_shade(nv, (pw - bc) / hr, b)
        img[m] = col
    srgb = _l2s(np.clip(img, 0, 1)).reshape(cam['H'], cam['W'], 3)
    return (np.clip(srgb, 0, 1) * 255).astype(np.uint8), pid.reshape(cam['H'], cam['W']), depth.reshape(cam['H'], cam['W'])

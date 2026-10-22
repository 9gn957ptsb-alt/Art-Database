#!/usr/bin/env python3
"""Shared geometry, casters and colour for wf6/solids.

FRAME: the drawing's model frame, z up; faces looking along x are grey (128), along y black (0), along z white (255)
(the drawing's tones; unit_colour.json "tones_sRGB8"). The game is y up, x east, z south; its block maps here by
    model = (gx, 1 - gz, gy)        (a quarter turn about x; game up -> model z, east-west -> x, north-south -> y)
so that the game block's own closing eye (blockMark: from east, above, north) is the drawing's eye (1,1,1)/sqrt3.

Two casters:
  walk()  - the game's own walk (rocket.js fragment shader, mirrored): a ray from where it enters a grid of filled
            blocks, block to block (DDA), the unit's six bars tested in every filled block, the films collected in
            order: every bar it enters, and the block films by a rule (see FILM_RULES).
  boxes() - any set of parallelepipeds (oriented boxes), culled to their screen box, first hit or the K nearest
            entries; for forms that are not on the block grid (banded spheres, golden stacks, the drawing's figure).
Colours by stack: bare (first bar, today's game), closed (first film opaque), avg (Colour Middling's Average film by
film front to back, the shader's UnitStack: what lies behind k films weighs 2^-k, the ground never mixes in).
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
S = "/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/"
PHI = (1 + 5 ** 0.5) / 2
TONE = np.array([128.0, 0.0, 255.0])            # x grey, y black, z white
EYE_D = np.ones(3) / math.sqrt(3)              # the drawing's eye direction (towards the eye)
UP_D = np.array([0, -1.0, 1]) / math.sqrt(2)
RIGHT_D = np.array([-2.0, 1, 1]) / math.sqrt(6)

# ---- the game's unit (rocket.js FIGURE), in the model frame ------------------------------------------------
FIGURE_GAME = [[0.45, 0.45, 0, 0.55, 0.55, 1], [0, 0, 0.45, 1, 0.1, 0.55], [0.9, 0.1, 0.45, 1, 1, 0.55],
               [0.55, 0.45, 0.45, 0.9, 0.55, 0.55], [0.45, 0.1, 0.45, 0.55, 0.45, 0.55], [0.9, 0.45, 0, 1, 0.55, 0.45]]


def game_to_model_box(b):
    x0, y0, z0, x1, y1, z1 = b
    return [x0, 1 - z1, y0], [x1, 1 - z0, y1]


def unit_boxes(bar=None):
    """The game unit's six bars in the model frame, block [0,1]^3. bar=None keeps FIGURE's 0.1; a number rescales
    every bar's thickness about its own centre line (the dial), keeping each bar's length and centre."""
    lo, hi = [], []
    for b in FIGURE_GAME:
        l, h = game_to_model_box(b)
        lo.append(l); hi.append(h)
    lo, hi = np.array(lo), np.array(hi)
    if bar is not None:
        ext = hi - lo
        thin = ext < 0.2                     # the two short axes of each bar
        c = (lo + hi) / 2
        lo = np.where(thin, c - bar / 2, lo)
        hi = np.where(thin, c + bar / 2, hi)
    return lo, hi


UNIT_LO, UNIT_HI = unit_boxes()


def unit_volume(lo=UNIT_LO, hi=UNIT_HI, n=64):
    """Volume of the union of the bars in the block (voxel count at n^3)."""
    g = (np.arange(n) + 0.5) / n
    X, Y, Z = np.meshgrid(g, g, g, indexing="ij")
    inside = np.zeros(X.shape, bool)
    for l, h in zip(lo, hi):
        inside |= (X >= l[0]) & (X <= h[0]) & (Y >= l[1]) & (Y <= h[1]) & (Z >= l[2]) & (Z <= h[2])
    return inside.mean()


# ---- colour ----------------------------------------------------------------------------------------------
def vs_tone(n, v):
    """VS: sum max(0, n_i v_i) tone_i / sum max(0, n_i v_i); back-facing |n_i v_i| (unit.glsl unitWeights)."""
    n = np.asarray(n, float); v = np.asarray(v, float)
    w = np.maximum(n * v, 0)
    s = w.sum(-1, keepdims=True)
    wb = np.abs(n * v)
    w = np.where(s > 1e-6, w, wb)
    s = w.sum(-1, keepdims=True)
    return (w * TONE).sum(-1) / np.maximum(s[..., 0], 1e-9)


def mean_tone(v):
    """The block film's colour: a cube's three faces by projected area, sum|v_i| tone_i / sum|v_i|."""
    a = np.abs(v)
    return (a * TONE).sum(-1) / a.sum(-1)


def stack_avg(cols, count):
    """unit.glsl UnitStack: C = round(sum_k c_k 2^-(k+1) + c_last 2^-(n-1)), the films (P, K) front to back."""
    P, K = cols.shape
    out = np.full(P, np.nan)
    for n in range(1, K + 1):
        m = count == n
        if not m.any():
            continue
        c = cols[m, :n]
        w = np.array([2.0 ** -(k + 1) for k in range(n)])
        w[-1] = 2.0 ** -(n - 1)
        out[m] = np.floor((c * w).sum(1) + 0.5)
    return out


# ---- cameras ---------------------------------------------------------------------------------------------
def ortho(centre, d, up, span, w, h):
    """Parallel rays looking along d (towards the scene), image w x h, span = height in world units."""
    d = np.asarray(d, float); d = d / np.linalg.norm(d)
    u = np.asarray(up, float); u = u - d * (u @ d); u /= np.linalg.norm(u)
    r = np.cross(d, u)
    px = span / h
    ys, xs = np.mgrid[0:h, 0:w]
    a = (xs + 0.5 - w / 2) * px
    b = -(ys + 0.5 - h / 2) * px
    O = np.asarray(centre, float) + a[..., None] * r + b[..., None] * u - d * 400
    D = np.broadcast_to(d, O.shape).copy()
    return O.reshape(-1, 3), D.reshape(-1, 3), (h, w), px


def drawing_view(centre, span, w, h):
    return ortho(centre, -EYE_D, UP_D, span, w, h)


# the game's camera: 70 deg vertical over 844 px (a phone), so a pixel is 2 tan(35 deg)/844 m at 1 m (rocket.js uPx)
PHONE_H = 844
FOCAL = (PHONE_H / 2) / math.tan(math.radians(35))
UPX = 1 / FOCAL


def persp(eye, target, w, h, f=FOCAL, up=(0, 0, 1)):
    eye = np.asarray(eye, float); f3 = np.asarray(target, float) - eye; f3 /= np.linalg.norm(f3)
    u = np.asarray(up, float); u = u - f3 * (u @ f3); u /= np.linalg.norm(u)
    r = np.cross(f3, u)
    ys, xs = np.mgrid[0:h, 0:w]
    a = (xs + 0.5 - w / 2) / f
    b = -(ys + 0.5 - h / 2) / f
    D = f3 + a[..., None] * r + b[..., None] * u
    D /= np.linalg.norm(D, axis=-1, keepdims=True)
    O = np.broadcast_to(eye, D.shape).copy()
    return O.reshape(-1, 3), D.reshape(-1, 3), (h, w)


def player(target_xy, solid_lo, solid_hi, dist, w, h, eye_h=1.7, azimuth_deg=35.0, f=FOCAL):
    """A player standing `dist` m (horizontally) from the solid's footprint, eyes 1.7 m up, looking at its middle.
    Azimuth 35 deg: the player stands off the faces' normals (a general view; 45 would be the diagonal)."""
    lo, hi = np.asarray(solid_lo, float), np.asarray(solid_hi, float)
    c = (lo + hi) / 2
    a = math.radians(azimuth_deg)
    dirh = np.array([math.cos(a), math.sin(a), 0.0])
    # distance from the footprint's boundary along dirh (box footprint): ray from centre outwards
    half = (hi - lo) / 2
    tb = min(half[0] / max(abs(dirh[0]), 1e-9), half[1] / max(abs(dirh[1]), 1e-9))
    eye = c + dirh * (tb + dist)
    eye[2] = lo[2] + eye_h
    tgt = c.copy()
    tgt[2] = min(c[2], lo[2] + (hi[2] - lo[2]) * 0.5)
    return persp(eye, tgt, w, h, f=f), eye


# ---- the walk ----------------------------------------------------------------------------------------------
FILM_RULES = ("none", "crossing", "exit", "face")
# face:     run 3 - the SURFACE film: entering a filled block from air, a film toned by the axis of the face entered
#           (x grey, y black, z white: the drawing's rule); then the block's bars; leaving the block, m(v) (bulk)
# none:     no block films (today's game: bars only, the walk sees between them)
# crossing: a film where the ray crosses from a filled block into a filled block (wf6/colour land2: 'block films')
# exit:     a film where the ray leaves any filled block (every block is the cube its unit approaches)


def walk(occ, O, D, lo=UNIT_LO, hi=UNIT_HI, origin=(0, 0, 0), K=10, film="crossing", film_colour="mean",
         max_steps=400, stop_after=9, sub=None, tex_lod=None):
    """Walk rays through a grid of blocks (occ[x, y, z] bool, block size 1, grid corner at `origin`).
    Returns films sorted front to back: t (P, K), colour (P, K), kind (P, K) 1 bar / 2 block film, count (P,),
    and tests (P,): the number of bar tests made (6 per filled block visited), steps (P,).
    film_colour: 'mean' = sum|v_i| tone_i/sum|v_i| (unit.glsl unitBulk); 'face' = the tone of the face the film is on.
    sub: optional (s, occ_sub) not used here."""
    O = np.asarray(O, float) - np.asarray(origin, float)
    D = np.asarray(D, float).copy()
    D[D == 0] = 1e-9
    P = len(O)
    X, Y, Z = occ.shape
    inv = 1 / D
    t0 = (0 - O) * inv
    t1 = (np.array([X, Y, Z]) - O) * inv
    tn = np.minimum(t0, t1).max(1)
    tf = np.maximum(t0, t1).min(1)
    tn = np.maximum(tn, 0)
    act = tn < tf
    Ft = np.full((P, K), np.inf); Fc = np.zeros((P, K)); Fk = np.zeros((P, K), int)
    cnt = np.zeros(P, int); tests = np.zeros(P, int); steps = np.zeros(P, int)
    fb = np.zeros(P, int)        # filled blocks entered before the first bar (the shader stops after 8: STEPS)
    v = -D  # towards the eye
    vmean = np.floor(mean_tone(v) + 0.5)        # films are 8-bit colours (Colour Middling; unit.glsl v2)
    idx = np.nonzero(act)[0]
    p = O[idx] + D[idx] * (tn[idx] + 1e-7)[:, None]
    c = np.floor(p).astype(int)
    c = np.clip(c, 0, np.array([X, Y, Z]) - 1)
    sg = np.sign(D[idx]).astype(int)
    tmax = ((c + (sg > 0)) - O[idx]) * inv[idx]
    tdel = np.abs(inv[idx])
    tin = tn[idx].copy()
    prev = np.zeros(len(idx), bool)           # was the block before this one filled (inside the grid)?
    prevax = np.minimum(t0, t1)[idx].argmax(1)  # the axis of the face crossed into the current block
    lo_ = np.asarray(lo); hi_ = np.asarray(hi)
    entry_tone = np.zeros(P)                  # face rule: the tone of the face the ray entered the solid by
    tex_s = np.ones(P)                        # the texture's level: the unit of side F(j) m whose bars are tested
    FIBS = np.array([1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987], float)

    def add(rows, t, col, kind):
        # append (t, col, kind) for rays `rows` (indices into P), keeping order (callers add in t order per step)
        k = cnt[rows]
        ok = k < K
        rows, t, col, k = rows[ok], t[ok], col[ok], k[ok]
        Ft[rows, k] = t; Fc[rows, k] = col; Fk[rows, k] = kind
        cnt[rows] += 1

    for it in range(max_steps):
        if len(idx) == 0:
            break
        inside = (c >= 0).all(1) & (c < np.array([X, Y, Z])).all(1)
        filled = np.zeros(len(idx), bool)
        filled[inside] = occ[c[inside, 0], c[inside, 1], c[inside, 2]]
        tout = tmax.min(1)
        ax_out = tmax.argmin(1)
        steps[idx] += 1
        nobar = filled & ((Fk[idx] == 1).sum(1) == 0)
        fb[idx[nobar]] += 1
        # film on entering a filled block from a filled block (crossing rule)
        if film == "crossing":
            m = filled & prev
            if m.any():
                if film_colour == "mean":
                    col = vmean[idx[m]]
                else:
                    col = TONE[prevax[m]]
                add(idx[m], tin[m], col, 2)
        if film == "face":
            m = filled & ~prev
            if m.any():
                add(idx[m], tin[m], TONE[prevax[m]], 2)
                entry_tone[idx[m]] = TONE[prevax[m]]
                if isinstance(tex_lod, (int, float)):
                    tex_s[idx[m]] = float(tex_lod)
                elif tex_lod is not None:
                    fpx, minpx, bar = tex_lod     # smallest F(j) with bar * F(j) * fpx / t >= minpx
                    need = minpx * np.maximum(tin[m], 1e-3) / (bar * fpx)
                    j = np.searchsorted(FIBS, need)
                    tex_s[idx[m]] = FIBS[np.minimum(j, len(FIBS) - 1)]
        # the bars of a filled block
        if filled.any():
            fi = np.nonzero(filled)[0]
            rows = idx[fi]
            sr = tex_s[rows]
            tmid = (tin[fi] + tout[fi]) / 2
            cs = np.floor((O[rows] + D[rows] * tmid[:, None]) / sr[:, None])   # the texture unit's cell
            q = (O[rows] - cs * sr[:, None]) / sr[:, None]     # ray origin in that unit's frame [0,1]^3
            ivr = inv[rows] * sr[:, None]
            a = (lo_[None] - q[:, None]) * ivr[:, None]       # (n, 6, 3)
            e = (hi_[None] - q[:, None]) * ivr[:, None]
            lo3 = np.minimum(a, e); hi3 = np.maximum(a, e)
            tn6 = lo3.max(2); tf6 = hi3.min(2); ax6 = lo3.argmax(2)
            tests[rows] += len(lo_)
            # an entry inside this block (a bar running on from the block before was entered there already)
            hit = (tn6 <= tf6) & (tn6 >= tin[fi, None] - 1e-7) & (tn6 < tout[fi, None])
            ax_e = ax6
            tent = np.where(hit, tn6, np.inf)
            if film == "face":
                # a texture bar cut by the block face: the ray starts inside it, on its section (the face's tone)
                cut = (tn6 < tin[fi, None] - 1e-7) & (tf6 > tin[fi, None]) & (tn6 <= tf6) & (prev[fi] == 0)[:, None]
                ax_e = np.where(cut, prevax[fi, None], ax6)
                tent = np.where(cut, tin[fi, None], tent)
            order = np.argsort(tent, 1)
            for j in range(len(lo_)):
                oj = order[:, j]
                tj = tent[np.arange(len(fi)), oj]
                ok = np.isfinite(tj)
                if not ok.any():
                    break
                add(rows[ok], tj[ok], TONE[ax_e[np.arange(len(fi)), oj][ok]], 1)
        # film on leaving a filled block (exit rule): at tout, by the face it leaves through
        if film in ("exit", "face") and filled.any():
            fi = np.nonzero(filled)[0]
            if film == "face" and film_colour == "self":
                col = entry_tone[idx[fi]]
            elif film_colour == "mean":
                col = vmean[idx[fi]]
            else:
                col = TONE[ax_out[fi]]
            add(idx[fi], tout[fi], col, 2)
        prev = filled
        prevax = ax_out.copy()
        # step
        r = np.arange(len(idx))
        c[r, ax_out] += sg[r, ax_out]
        tin = tout
        tmax[r, ax_out] += tdel[r, ax_out]
        keep = (tin < tf[idx]) & (cnt[idx] < stop_after)
        idx, c, sg, tmax, tdel, tin, prev, prevax = (idx[keep], c[keep], sg[keep], tmax[keep], tdel[keep], tin[keep],
                                                     prev[keep], prevax[keep])
    # films are appended in t order block by block, bars sorted within a block, crossing film at block entry
    return dict(t=Ft, c=Fc, k=Fk, n=cnt, tests=tests, steps=steps, fb=fb)


def walk_chunked(occ, O, D, chunk=120000, **kw):
    parts = [walk(occ, O[i:i + chunk], D[i:i + chunk], **kw) for i in range(0, len(O), chunk)]
    return {k: np.concatenate([p[k] for p in parts]) for k in parts[0]}


def colour(res, mode, bg):
    """Pixel values from a walk/caster result. bg: (P,) background values. mode: bare | closed | avg | avgbars."""
    Ft, Fc, Fk, n = res["t"], res["c"], res["k"], res["n"]
    P = len(n)
    out = bg.astype(float).copy()
    if mode == "today":
        # rocket.js: the first bar; after 8 filled blocks with none, the block's dark (0.16 of its colour)
        isbar = (Fk == 1)
        first = np.where(isbar.any(1), isbar.argmax(1), -1)
        m = first >= 0
        out[m] = Fc[np.nonzero(m)[0], first[m]]
        dk = (~m) & (res["fb"] >= 8)
        out[dk] = 0.16 * 128
    elif mode == "bare":
        isbar = (Fk == 1)
        first = np.where(isbar.any(1), isbar.argmax(1), -1)
        m = first >= 0
        out[m] = Fc[np.nonzero(m)[0], first[m]]
    elif mode == "closed":
        m = n > 0
        out[m] = Fc[m, 0]
    elif mode == "face":
        # Average of the first two films: the face film and what lies behind it (bar or bulk)
        m = n > 0
        two = n >= 2
        out[m] = Fc[m, 0]
        out[two] = np.floor((Fc[two, 0] + Fc[two, 1]) / 2 + 0.5)
    elif mode in ("avg", "avgbars"):
        if mode == "avgbars":
            # drop block films, recompact
            keep = Fk == 1
            cols = np.zeros_like(Fc); cnt = keep.sum(1)
            for i in range(Fc.shape[1]):
                pass
            order = np.argsort(~keep, 1, kind="stable")
            cols = np.take_along_axis(Fc, order, 1)
            cnt2 = cnt
        else:
            cols, cnt2 = Fc, n
        v = stack_avg(cols, cnt2)
        m = cnt2 > 0
        out[m] = v[m]
    return out


def background(D, ground=(90, 80, 72), sky_lo=(206, 214, 222), sky_hi=(150, 170, 196), ground_z=0.0, O=None):
    """RGB background: a plain ground plane at z = ground_z, a sky above."""
    D = np.asarray(D)
    P = len(D)
    out = np.zeros((P, 3))
    up = np.clip(D[:, 2], 0, 1) ** 0.5
    sky = np.array(sky_lo)[None] * (1 - up[:, None]) + np.array(sky_hi)[None] * up[:, None]
    out[:] = sky
    if O is not None:
        down = D[:, 2] < -1e-6
        out[down] = ground
    return out


def to_rgb(vals, bg_rgb, shape, cover=None):
    """Grey values where `cover` (rays that met the form), the background RGB elsewhere."""
    img = bg_rgb.copy()
    if cover is None:
        cover = np.isfinite(vals)
    g = np.clip(vals, 0, 255)
    img[cover] = g[cover, None]
    return img.reshape(shape + (3,)).astype(np.uint8)


def save(img, path, scale=1):
    im = Image.fromarray(img)
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)
    return path


def sheet(rows, path, labels=None, pad=6, bgc=(250, 248, 244)):
    """rows: list of lists of uint8 RGB arrays; writes one PNG with optional row/col labels (list of lists)."""
    from PIL import ImageDraw
    hs = [max(im.shape[0] for im in r) for r in rows]
    ws = [sum(im.shape[1] for im in r) + pad * (len(r) - 1) for r in rows]
    lab = 14 if labels else 0
    H = sum(hs) + (pad + lab) * len(rows) + pad
    W = max(ws) + 2 * pad
    canvas = Image.new("RGB", (W, H), bgc)
    dr = ImageDraw.Draw(canvas)
    y = pad
    for i, r in enumerate(rows):
        x = pad
        for j, im in enumerate(r):
            if labels:
                dr.text((x + 2, y), labels[i][j], fill=(20, 20, 20))
            canvas.paste(Image.fromarray(im), (x, y + lab))
            x += im.shape[1] + pad
        y += hs[i] + lab + pad
    canvas.save(path)
    return path


# ---- an oriented-box caster with culling (for forms off the block grid) -----------------------------------
def box_planes(C, E):
    """Parallelepiped centre C (3,), half-edges E (3,3) rows -> slab normals N (3,3) and half-widths w (3,)."""
    N = np.array([np.cross(E[(k + 1) % 3], E[(k + 2) % 3]) for k in range(3)])
    N /= np.linalg.norm(N, axis=1, keepdims=True)
    w = np.abs(np.einsum("ij,ij->i", E, N))
    return N, w


def cast_obb(boxes, O, D, shape, K=1, ortho_rays=None, tone_mode="vs"):
    """boxes: list of (C, E, tones(3,) or None). First hit (K=1) or the K nearest entries per ray.
    Tone of a hit face: tones[k] given per slab pair, or VS of the face's normal (tone_mode 'vs') when None.
    Culling by projecting each box's 8 corners into the image (perspective from a common origin, or ortho)."""
    P = len(O)
    h, w = shape
    Ft = np.full((P, K), np.inf); Fc = np.zeros((P, K)); cnt = np.zeros(P, int)
    O = np.asarray(O); D = np.asarray(D)
    ortho_ = np.allclose(D[0], D[-1]) and np.allclose(D[0], D[P // 2])
    if ortho_:
        d0 = D[0]
        o00 = O[0]; ex = O[1] - O[0]; ey = O[w] - O[0]
        G = np.array([ex, ey, d0]).T; Gi = np.linalg.inv(G)
    else:
        eye = O[0]
        # image frame from three rays
        f3 = D[(h // 2) * w + w // 2]
        # build camera basis from the corner rays
        dc = D.reshape(h, w, 3)
        r_ = dc[h // 2, -1] / (dc[h // 2, -1] @ f3) - dc[h // 2, 0] / (dc[h // 2, 0] @ f3)
        u_ = dc[0, w // 2] / (dc[0, w // 2] @ f3) - dc[-1, w // 2] / (dc[-1, w // 2] @ f3)
        fx = (w - 1) / np.linalg.norm(r_); fy = (h - 1) / np.linalg.norm(u_)
        rr = r_ / np.linalg.norm(r_); uu = u_ / np.linalg.norm(u_)
    sgn = np.array([[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)], float)
    for (C, E, tones) in boxes:
        C = np.asarray(C, float); E = np.asarray(E, float)
        corners = C + sgn @ E
        if ortho_:
            q = (Gi @ (corners - o00).T).T
            j0, j1 = int(math.floor(q[:, 0].min())) - 1, int(math.ceil(q[:, 0].max())) + 1
            i0, i1 = int(math.floor(q[:, 1].min())) - 1, int(math.ceil(q[:, 1].max())) + 1
        else:
            rel = corners - eye
            z = rel @ f3
            if (z <= 1e-3).any():
                i0, i1, j0, j1 = 0, h - 1, 0, w - 1
            else:
                xs = (rel @ rr) / z * fx + (w - 1) / 2
                ys = -(rel @ uu) / z * fy + (h - 1) / 2
                j0, j1 = int(math.floor(xs.min())) - 1, int(math.ceil(xs.max())) + 1
                i0, i1 = int(math.floor(ys.min())) - 1, int(math.ceil(ys.max())) + 1
        i0, j0 = max(i0, 0), max(j0, 0); i1, j1 = min(i1, h - 1), min(j1, w - 1)
        if i0 > i1 or j0 > j1:
            continue
        idx = (np.arange(i0, i1 + 1)[:, None] * w + np.arange(j0, j1 + 1)[None, :]).reshape(-1)
        N, wd = box_planes(C, E)
        o = (O[idx] - C) @ N.T; dd = D[idx] @ N.T
        with np.errstate(divide="ignore", invalid="ignore"):
            ta, tb = (-wd - o) / dd, (wd - o) / dd
        lo = np.nan_to_num(np.minimum(ta, tb), nan=-np.inf); hi = np.nan_to_num(np.maximum(ta, tb), nan=np.inf)
        tn, tf, ax = lo.max(1), hi.min(1), lo.argmax(1)
        hit = (tn <= tf) & (tf > 0) & (tn > 0)
        if not hit.any():
            continue
        sel = idx[hit]; tns = tn[hit]; axs = ax[hit]
        if tones is not None:
            col = np.asarray(tones, float)[axs]
        else:
            # the face's outward normal: -sign(dd) N
            nrm = -np.sign(dd[hit, axs])[:, None] * N[axs]
            col = vs_tone(nrm, -D[sel])
        if K == 1:
            better = tns < Ft[sel, 0]
            s2 = sel[better]
            Ft[s2, 0] = tns[better]; Fc[s2, 0] = col[better]; cnt[s2] = 1
        else:
            # insert into sorted K list
            T = np.concatenate([Ft[sel], tns[:, None]], 1)
            Cc = np.concatenate([Fc[sel], col[:, None]], 1)
            o2 = np.argsort(T, 1)[:, :K]
            Ft[sel] = np.take_along_axis(T, o2, 1); Fc[sel] = np.take_along_axis(Cc, o2, 1)
            cnt[sel] = np.isfinite(Ft[sel]).sum(1)
    return dict(t=Ft, c=Fc, k=np.ones_like(cnt)[:, None].repeat(K, 1), n=cnt)


def unit_obbs(M=np.eye(3), t=np.zeros(3), scale=1.0, lo=UNIT_LO, hi=UNIT_HI, about=(0.5, 0.5, 0.5), tones="axis"):
    """The unit's six bars as oriented boxes: p -> M (scale (p - about)) + t. tones 'axis' keeps the bar's own face
    tones (x grey, y black, z white in the unit's frame: 'tones stay with their faces'); None = VS of the turned face."""
    out = []
    about = np.asarray(about, float)
    for l, h in zip(lo, hi):
        c = (l + h) / 2 - about
        e = np.diag((h - l) / 2)
        C = M @ (scale * c) + t
        E = (M @ (scale * e).T).T
        out.append((C, E, TONE.copy() if tones == "axis" else None))
    return out


def dump(obj, path):
    with open(path, "w") as f:
        json.dump(obj, f, indent=1, default=lambda o: o.tolist() if hasattr(o, "tolist") else float(o))
    return path


# ---- run 3: the surface-film rule with the texture unit at a Fibonacci level ------------------------------
FIBS_M = np.array([1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987], float)


def tex_level(t, fpx, minpx=8.0, bar=0.1):
    """The texture unit's side: the smallest F(j) m whose bars (bar * F(j) m) are >= minpx px at distance t."""
    need = minpx * np.maximum(t, 1e-3) / (bar * fpx)
    return FIBS_M[np.minimum(np.searchsorted(FIBS_M, need), len(FIBS_M) - 1)]


def _svt(occ):
    S = np.zeros(tuple(n + 1 for n in occ.shape), np.int64)
    S[1:, 1:, 1:] = occ.astype(np.int64).cumsum(0).cumsum(1).cumsum(2)
    return S


def _full(S, c0, c1, side):
    X, Y, Z = (n - 1 for n in S.shape)
    ok = (c0 >= 0).all(1) & (c1[:, 0] <= X) & (c1[:, 1] <= Y) & (c1[:, 2] <= Z)
    a = np.clip(c0, 0, [X, Y, Z]); b = np.clip(c1, 0, [X, Y, Z])
    v = (S[b[:, 0], b[:, 1], b[:, 2]] - S[a[:, 0], b[:, 1], b[:, 2]] - S[b[:, 0], a[:, 1], b[:, 2]] - S[b[:, 0], b[:, 1], a[:, 2]]
         + S[a[:, 0], a[:, 1], b[:, 2]] + S[a[:, 0], b[:, 1], a[:, 2]] + S[b[:, 0], a[:, 1], a[:, 2]] - S[a[:, 0], a[:, 1], a[:, 2]])
    return ok & (v == side ** 3)


def walk_face(occ, O, D, origin=(0, 0, 0), tex=1.0, lo=UNIT_LO, hi=UNIT_HI, chunk=150000, full_cells=True):
    """Face film where the ray first enters a filled block (DDA, the shader's walk), then the texture unit's six bars
    tested ONCE in the unit's own cell (side s = tex, a number, or a function of the face's distance t), the first bar
    entered counting only if it lies in a filled block (one occupancy fetch); else the bulk m(v).
    Returns dict(t, face, behind, val, s, tests) with val = round((face + behind)/2)."""
    outs = []
    for i in range(0, len(O), chunk):
        Oi, Di = np.asarray(O[i:i + chunk], float), np.asarray(D[i:i + chunk], float)
        r = walk(occ, Oi, Di, origin=origin, film='face', K=2, stop_after=1)
        P = len(Oi)
        hitf = r['n'] > 0
        t = np.where(hitf, r['t'][:, 0], np.inf)
        face = r['c'][:, 0]
        Ol = Oi - np.asarray(origin, float)
        Dd = Di.copy(); Dd[Dd == 0] = 1e-9
        s = np.full(P, float(tex)) if not callable(tex) else tex(t)
        behind = np.floor(mean_tone(-Di) + 0.5)
        tests = np.zeros(P, int)
        ii = np.nonzero(hitf)[0]
        if len(ii) and full_cells:
            # FULL-CELL RULE: step the level down until the cell at the entry point is wholly filled
            p = Ol[ii] + Dd[ii] * (t[ii] + 1e-6)[:, None]
            SVT = _svt(occ)
            for _ in range(len(FIBS_M)):
                si = s[ii]
                big = si > 1
                if not big.any():
                    break
                c0 = (np.floor(p / si[:, None]) * si[:, None]).astype(int)
                c1 = c0 + si[:, None].astype(int)
                full = big & _full(SVT, c0, c1, si.astype(int))
                drop = big & ~full
                if not drop.any():
                    break
                j = np.searchsorted(FIBS_M, si[drop])
                s[ii[drop]] = FIBS_M[np.maximum(j - 1, 0)]
        if len(ii):
            p = Ol[ii] + Dd[ii] * (t[ii] + 1e-6)[:, None]
            sr = s[ii][:, None]
            cs = np.floor(p / sr)
            q = (Ol[ii] - cs * sr) / sr
            iv = 1 / Dd[ii] * sr
            # the cell's exit
            ce = np.maximum((0 - q) * iv, (1 - q) * iv).min(1)
            A = (lo[None] - q[:, None]) * iv[:, None]; B = (hi[None] - q[:, None]) * iv[:, None]
            l3, h3 = np.minimum(A, B), np.maximum(A, B)
            bn, bf, bax = l3.max(2), h3.min(2), l3.argmax(2)
            tin = t[ii][:, None]
            ok = (bn <= bf) & (bf > tin) & (bn < ce[:, None])
            te = np.where(ok, np.maximum(bn, tin), np.inf)
            k = te.argmin(1); tb = te[np.arange(len(ii)), k]
            has = np.isfinite(tb)
            cut = has & (bn[np.arange(len(ii)), k] < t[ii])
            axb = bax[np.arange(len(ii)), k]
            col = np.where(cut, face[ii], TONE[axb])
            # the bar point must lie in a filled block
            hp = Ol[ii] + Dd[ii] * (np.where(has, tb, 0) + 1e-6)[:, None]
            c = np.floor(hp).astype(int)
            X, Y, Z = occ.shape
            inside = (c >= 0).all(1) & (c < np.array([X, Y, Z])).all(1)
            fill = np.zeros(len(ii), bool)
            fill[inside] = occ[c[inside, 0], c[inside, 1], c[inside, 2]]
            use = has & fill
            behind[ii] = np.where(use, col, behind[ii])
            tests[ii] = 6
        val = np.where(hitf, np.floor((face + behind) / 2 + 0.5), np.nan)
        outs.append(dict(t=t, face=np.where(hitf, face, np.nan), behind=behind, val=val, s=s, tests=tests,
                         steps=r['steps']))
    return {k: np.concatenate([o[k] for o in outs]) for k in outs[0]}

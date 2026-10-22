"""wf6/colour: shared pieces of the colour study.

Geometry: the finished vector study (wf1/vectorize/vector.json): six straight square bars, half-width H = 1/9, on the
cube lattice (x, y, z; z up). The drawing looks along d = -(1,1,1)/sqrt3, image up u = (0,-1,1)/sqrt2, right
r = (-2,1,1)/sqrt6, CENTRE = (1/3, 1, -1/3); pixel (px, py) of the original -> a = (px-cx)/s, b = -(py-cy)/(s k).
Two extents per bar: 'model' (the straight 3D model, every bar whole) and 'drawn' (cut where the original cuts the
nearer end behind the other bar).

Colour: sRGB 8-bit values are the drawing's own (grey #808080, black, white). Colour Middling's rule (its default
'Average' blend mode, read from the artifact's source): M = round(sum(colours)/n) per 8-bit channel.
"""
import json
import math
import os

import numpy as np

S = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/'
OUT = S + 'wf6/colour/'
UNIT = S + 'unit/'
PHI = (1 + 5 ** 0.5) / 2
H = 1 / 9
VEC = json.load(open(S + 'wf1/vectorize/vector.json'))
FIT = VEC['fit']                                  # s, cx, cy, k
D_VIEW = -np.ones(3) / math.sqrt(3)               # the drawing's line of sight (towards the scene)
U_VIEW = np.array([0, -1.0, 1]) / math.sqrt(2)
R_VIEW = np.array([-2.0, 1, 1]) / math.sqrt(6)
CENTRE = np.array([1 / 3, 1, -1 / 3])
DRAW_ANGLE = math.degrees(math.acos(1 / math.sqrt(3)))   # 54.7356: every axis face seen at this angle

# ---- colour maths -----------------------------------------------------------------------------------------
def lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def enc(l):
    l = np.clip(np.asarray(l, float), 0, 1)
    return np.where(l <= 0.0031308, 12.92 * l, 1.055 * l ** (1 / 2.4) - 0.055)


LUMA = np.array([0.2126, 0.7152, 0.0722])


def Y(c):                       # relative luminance of sRGB values in [0,1]
    return lin(c) @ LUMA


def Lstar_Y(y):
    y = np.asarray(y, float)
    return np.where(y > 216 / 24389, 116 * np.cbrt(y) - 16, y * 24389 / 27)


def Lstar(c):
    return Lstar_Y(Y(c))


M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
               [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099],
               [0.0259040371, 0.7827717662, -0.8086757660]])


def oklab_lin(l):
    return np.cbrt(np.asarray(l, float) @ M1.T) @ M2.T


def oklab(c):
    return oklab_lin(lin(c))


def oklab_to_lin(L):
    lms = np.asarray(L, float) @ np.linalg.inv(M2).T
    return (lms ** 3) @ np.linalg.inv(M1).T


def hx(c):
    c = np.clip(np.round(np.asarray(c, float) * 255), 0, 255).astype(int)
    return '#%02X%02X%02X' % tuple(c)


def unhx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0


def cm_average(cols8):
    """Colour Middling's Average, exactly: M = round(sum / n) per 8-bit channel (JS Math.round: half up)."""
    a = np.asarray(cols8, float)
    return np.floor(a.mean(0) + 0.5).astype(int)


def cm_offset(A8, B8):
    """Colour Middling's offset vector d = round((B - A)/2): A + d = M, M + d = B."""
    return np.floor((np.asarray(B8, float) - np.asarray(A8, float)) / 2 + 0.5).astype(int)


# the drawing's three tones, by the axis a face looks along (sRGB values in [0,1])
TONE = np.array([128 / 255, 0.0, 1.0])            # x grey, y black, z white
TONE8 = np.array([128, 0, 255])

# ---- the six bars ---------------------------------------------------------------------------------------------
AX = {'x': 0, 'y': 1, 'z': 2}


def bars(kind='model', Hh=H):
    """[(name, lo(3), hi(3))] axis-aligned boxes. kind 'model' (straight) or 'drawn' (cut as the original)."""
    out = []
    for b in VEC['bars']:
        a = AX[b['axis']]
        ext = b['model_extent'] if kind == 'model' else b['extent']
        lo, hi = np.zeros(3), np.zeros(3)
        for k, v in b['fixed'].items():
            lo[AX[k]] = v - Hh
            hi[AX[k]] = v + Hh
        lo[a], hi[a] = ext
        out.append((b['name'], lo, hi))
    return out


def boxes_moved(bx, M=np.eye(3), scale=1.0, t=np.zeros(3), about=CENTRE, tag=''):
    """Bars moved p -> M scale (p - about) + about + t (M a signed permutation, so boxes stay axis-aligned)."""
    out = []
    for name, lo, hi in bx:
        c = (lo + hi) / 2
        e = (hi - lo) / 2
        c2 = M @ (scale * (c - about)) + about + t
        e2 = np.abs(M) @ (scale * e)
        out.append((tag + name, c2 - e2, c2 + e2))
    return out


# ---- rays ------------------------------------------------------------------------------------------------------
def drawing_rays(shape=(630, 1200), step=1.0, x0=0.0, y0=0.0, back=40.0, fit=FIT):
    """The original's pixels as rays of the drawing view (pixel centres at integer px, py)."""
    hh, ww = shape
    ys, xs = np.mgrid[0:hh, 0:ww].astype(float)
    px = x0 + xs * step
    py = y0 + ys * step
    a = (px - fit['cx']) / fit['s']
    b = -(py - fit['cy']) / (fit['s'] * fit['k'])
    O = CENTRE + a[..., None] * R_VIEW + b[..., None] * U_VIEW - D_VIEW * back
    return O, np.broadcast_to(D_VIEW, O.shape).copy()


def basis(d, up):
    d = np.array(d, float); d /= np.linalg.norm(d)
    u = np.array(up, float); u -= d * (u @ d); u /= np.linalg.norm(u)
    return d, u, np.cross(d, u)


def ortho_rays(d, up, centre, span, size, back=40.0):
    d, u, r = basis(d, up)
    hh, ww = size
    ys, xs = np.mgrid[0:hh, 0:ww].astype(float)
    sx = ((xs + 0.5) / ww - 0.5) * span
    sy = (0.5 - (ys + 0.5) / hh) * span * hh / ww
    O = np.array(centre, float) + sx[..., None] * r + sy[..., None] * u - d * back
    return O, np.broadcast_to(d, O.shape).copy()


def persp_rays(eye, target, up, fov, size):
    eye = np.array(eye, float)
    f, u, r = basis(np.array(target, float) - eye, up)
    hh, ww = size
    th = math.tan(math.radians(fov) / 2)
    ys, xs = np.mgrid[0:hh, 0:ww].astype(float)
    sx = ((xs + 0.5) / ww * 2 - 1) * th
    sy = (1 - (ys + 0.5) / hh * 2) * th * hh / ww
    D = f + sx[..., None] * r + sy[..., None] * u
    D /= np.linalg.norm(D, axis=-1, keepdims=True)
    return np.broadcast_to(eye, D.shape).copy(), D


def az_el(az, el):
    a, e = math.radians(az), math.radians(el)
    return np.array([math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)])


# ---- every crossing ---------------------------------------------------------------------------------------------
def box_hits(lo, hi, O, D):
    """slab test for one AABB: t_in, t_out, entry axis, entry sign (+1: the face looking along +axis)"""
    with np.errstate(divide='ignore', invalid='ignore'):
        inv = 1.0 / D
        t0 = (lo - O) * inv
        t1 = (hi - O) * inv
    tmin = np.minimum(t0, t1)
    tmax = np.maximum(t0, t1)
    tmin = np.nan_to_num(tmin, nan=-np.inf)
    tmax = np.nan_to_num(tmax, nan=np.inf)
    tn = tmin.max(-1)
    tf = tmax.min(-1)
    ax = tmin.argmax(-1)
    axo = tmax.argmin(-1)
    dax = np.take_along_axis(D, ax[..., None], -1)[..., 0]
    daxo = np.take_along_axis(D, axo[..., None], -1)[..., 0]
    sg = -np.sign(dax)              # entry face looks back at the ray
    sgo = np.sign(daxo)             # exit face looks along the ray
    hit = (tn <= tf) & (tf > 0)
    return np.where(hit, tn, np.inf), np.where(hit, tf, np.inf), ax, sg, axo, sgo


def layers(bx, O, D, K=6, merge=True, owner=None, eps=1e-7):
    """Per ray, up to K layers nearest first. A layer = a maximal interval inside the union of boxes of one owner
    (boxes of one solid that overlap or touch along the ray merge; owner None: all boxes are one solid).
    Returns dict: tin [K,...], tout, ax (entry axis), sg (entry sign), exax, exsg, box (entry box index), n (count)."""
    shp = O.shape[:-1]
    B = len(bx)
    TN = np.full((B,) + shp, np.inf); TF = np.full((B,) + shp, np.inf)
    AXe = np.zeros((B,) + shp, np.int8); SGe = np.zeros((B,) + shp, np.int8)
    AXo = np.zeros((B,) + shp, np.int8); SGo = np.zeros((B,) + shp, np.int8)
    for i, (_, lo, hi) in enumerate(bx):
        tn, tf, ax, sg, axo, sgo = box_hits(lo, hi, O, D)
        TN[i], TF[i], AXe[i], SGe[i], AXo[i], SGo[i] = tn, tf, ax, sg, axo, sgo
    own = np.zeros(B, int) if owner is None else np.asarray(owner)
    order = np.argsort(TN, 0)
    out = {k: np.full((K,) + shp, np.inf) for k in ('tin', 'tout')}
    for k in ('ax', 'sg', 'exax', 'exsg', 'box'):
        out[k] = np.full((K,) + shp, -1, np.int16)
    cnt = np.zeros(shp, int)
    cur_end = np.full(shp, -np.inf)
    cur_own = np.full(shp, -1)
    cur_k = np.full(shp, -1)
    for j in range(B):
        idx = order[j]
        tn = np.take_along_axis(TN, idx[None], 0)[0]
        tf = np.take_along_axis(TF, idx[None], 0)[0]
        valid = np.isfinite(tn)
        ow = own[idx]
        join = valid & merge & (tn <= cur_end + eps) & (ow == cur_own)
        new = valid & ~join
        # extend the current layer where joined
        ext = join & (tf > cur_end)
        if ext.any():
            for kk in range(K):
                m = ext & (cur_k == kk)
                if m.any():
                    out['tout'][kk][m] = tf[m]
                    out['exax'][kk][m] = np.take_along_axis(AXo, idx[None], 0)[0][m]
                    out['exsg'][kk][m] = np.take_along_axis(SGo, idx[None], 0)[0][m]
        cur_end = np.where(ext, tf, cur_end)
        put = new & (cnt < K)
        for kk in range(K):
            m = put & (cnt == kk)
            if m.any():
                out['tin'][kk][m] = tn[m]; out['tout'][kk][m] = tf[m]
                out['ax'][kk][m] = np.take_along_axis(AXe, idx[None], 0)[0][m]
                out['sg'][kk][m] = np.take_along_axis(SGe, idx[None], 0)[0][m]
                out['exax'][kk][m] = np.take_along_axis(AXo, idx[None], 0)[0][m]
                out['exsg'][kk][m] = np.take_along_axis(SGo, idx[None], 0)[0][m]
                out['box'][kk][m] = idx[m]
        cur_k = np.where(put, cnt, cur_k)
        cnt = cnt + new
        cur_end = np.where(new, tf, cur_end)
        cur_own = np.where(new, ow, cur_own)
    out['n'] = np.minimum(cnt, K)
    out['n_all'] = cnt
    return out


def normals_of(L):
    """entry normals [K,...,3] of a layers() result (zeros where no layer)"""
    K = L['ax'].shape[0]
    N = np.zeros(L['ax'].shape + (3,))
    for a in range(3):
        m = L['ax'] == a
        N[..., a] = np.where(m, L['sg'], 0)
    return N


# ---- the original, as drawn polygons (exact, vector) ----------------------------------------------------------------
def raster_drawn(shape=(630, 1200), ss=1, fit=FIT):
    """The 13 drawn polygons of vector.json rasterised: tone per pixel (-1 ground). ss: supersampling per axis
    (returns the ss-times larger class map)."""
    from PIL import Image, ImageDraw
    hh, ww = shape
    im = Image.new('L', (ww * ss, hh * ss), 0)          # value = tone + 1 (0 = ground or hole)
    dr = ImageDraw.Draw(im)
    for reg in VEC['drawn']:
        pts = []
        for a, b in reg['polygon']:
            px = a * fit['s'] + fit['cx']
            py = -b * fit['s'] * fit['k'] + fit['cy']
            pts.append(((px + 0.5) * ss - 0.5, (py + 0.5) * ss - 0.5))
        dr.polygon(pts, fill=int(reg['tone']) + 1)
    return np.array(im).astype(int) - 1


# ---- images ------------------------------------------------------------------------------------------------------
def font(sz=14, bold=False):
    from PIL import ImageFont
    for p in (['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'] if bold else []) + [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


def to_img(a):
    from PIL import Image
    a = np.asarray(a)
    if a.dtype != np.uint8:
        a = np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    return Image.fromarray(a)


def label(img, text, xy=(8, 6), sz=14, fill=(20, 20, 20), bg=(255, 255, 255), bold=False):
    from PIL import ImageDraw
    if not text:
        return img
    d = ImageDraw.Draw(img)
    f = font(sz, bold)
    if bg is not None:
        x0, y0, x1, y1 = d.multiline_textbbox(xy, text, font=f)
        d.rectangle((x0 - 3, y0 - 2, x1 + 3, y1 + 2), fill=bg)
    d.multiline_text(xy, text, fill=fill, font=f, spacing=3)
    return img


def grid(imgs, cols, pad=8, bg=(255, 255, 255)):
    from PIL import Image
    w = max(i.width for i in imgs); h = max(i.height for i in imgs)
    rows = (len(imgs) + cols - 1) // cols
    out = Image.new('RGB', (cols * w + (cols + 1) * pad, rows * h + (rows + 1) * pad), bg)
    for k, im in enumerate(imgs):
        r, c = divmod(k, cols)
        out.paste(im, (pad + c * (w + pad), pad + r * (h + pad)))
    return out


def swatches(cols, names, w=118, h=54, sz=11, title=None, bg=(255, 255, 255)):
    from PIL import Image, ImageDraw
    n = len(cols); th = 22 if title else 0
    img = Image.new('RGB', (w * n, h + 44 + th), bg)
    d = ImageDraw.Draw(img); f = font(sz)
    if title:
        d.text((4, 2), title, fill=(20, 20, 20), font=font(sz + 2, True))
    for k, (c, nm) in enumerate(zip(cols, names)):
        c8 = tuple(int(round(v * 255)) for v in np.clip(c, 0, 1))
        d.rectangle((k * w + 2, th, (k + 1) * w - 3, th + h), fill=c8, outline=(150, 150, 150))
        d.multiline_text((k * w + 4, th + h + 3), nm, fill=(20, 20, 20), font=f, spacing=1)
    return img


def down(a, f):
    h, w = a.shape[0] // f, a.shape[1] // f
    return a[:h * f, :w * f].reshape(h, f, w, f, *a.shape[2:]).mean((1, 3))


def note(line):
    with open(OUT + 'NOTES.md', 'a') as fh:
        fh.write(line.rstrip() + '\n')

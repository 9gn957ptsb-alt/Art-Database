"""(b) TRANSPARENCY FORMING OTHER COLOURS. The unit's bars as films: every solid a ray passes through is a layer,
coloured by the face it is entered by (the tone rule VS); where layers overlap, a mixing rule makes the colour.
Rules (layers c_0 nearest .. c_{n-1}, sRGB values; the ground never mixes in, as the drawing's paper never shows
through a face):
  opaque        c_0                                         (the drawing as an object: the nearest face)
  average       round(sum c_k / n) per 8-bit channel        (Colour Middling's Average = Albers' middle mixture;
                                                             order-free)
  middle-stack  c_0/2 + c_1/4 + ... , the last the rest      (each film the middle of itself and what is behind;
                                                             = average for two layers)
  multiply      prod c_k (sRGB values)                      (films filtering: Colour Middling's Multiply / its inks)
  multiply-lin  enc(prod lin c_k)                           (physical filters in linear light)
  add           enc(min(sum lin c_k, 1))                    (additive light)
  screen        1 - prod(1 - c_k)                           (Colour Middling's Screen)
  golden        c_0/phi + c_1/phi^3 + ..., the last the rest (front-weighted lean, 1/phi on top)
"""
import json
import math
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, '.')
from common import *                 # noqa
from obb import aabb, moved, layers as obb_layers
from tone_rule import rule

C8 = np.array([128, 0, 255])
MIX = ['opaque', 'average', 'recursive', 'middle-stack', 'multiply', 'multiply-lin', 'add', 'screen', 'golden']


def unit_boxes(Hh=H, kind='model', level=0, tag=''):
    return [aabb(tag + nm, lo, hi, level) for nm, lo, hi in bars(kind, Hh)]


def face_tone(n, v):
    """VS tone (sRGB value 0..1) of a face with normal n seen from v (unit vector to the eye)."""
    return rule('VS', n, v)


def mix(cols, n, how):
    """cols [K, ..., 3] sRGB 0..1 front to back, n [...] count of layers. Returns [..., 3] (nan where n == 0)."""
    K = cols.shape[0]
    out = np.full(cols.shape[1:], np.nan)
    has = n >= 1
    live = (np.arange(K)[:, None] < n.reshape(1, -1)).reshape((K,) + n.shape)[..., None]
    if how == 'opaque':
        out = cols[0].copy()
    elif how == 'average':
        s = np.where(live, np.round(cols * 255), 0).sum(0)
        out = np.floor(s / np.maximum(n, 1)[..., None] + 0.5) / 255
    elif how in ('middle-stack', 'golden'):
        a = 0.5 if how == 'middle-stack' else 1 / PHI
        acc = np.zeros(cols.shape[1:]); rem = np.ones(n.shape)
        for k in range(K):
            last = (n == k + 1)
            wk = np.where(last, rem, np.where(n > k + 1, rem * a, 0))
            acc += wk[..., None] * np.nan_to_num(cols[k])
            rem = rem - wk
        out = acc
    elif how == 'recursive':
        # Colour Middling's Average film by film from the back: C_last = c_last, C_k = round((c_k + C_{k+1}) / 2)
        c8 = np.round(np.nan_to_num(cols) * 255)
        acc = np.zeros(cols.shape[1:])
        for k in range(K - 1, -1, -1):
            last = (n == k + 1)[..., None]
            deeper = (n > k + 1)[..., None]
            acc = np.where(last, c8[k], np.where(deeper, np.floor((c8[k] + acc) / 2 + 0.5), acc))
        out = acc / 255
    elif how == 'multiply':
        out = np.where(live, cols, 1).prod(0)
    elif how == 'multiply-lin':
        out = enc(np.where(live, lin(np.nan_to_num(cols)), 1).prod(0))
    elif how == 'add':
        out = enc(np.minimum(np.where(live, lin(np.nan_to_num(cols)), 0).sum(0), 1))
    elif how == 'screen':
        out = 1 - np.where(live, 1 - cols, 1).prod(0)
    out = np.where(has[..., None], out, np.nan)
    return out


def layer_colours(L, D, palette=None):
    """[K, ..., 3] sRGB colour of each layer by the tone rule (grey) or a palette function of the tone."""
    v = -D
    K = L['n'].shape and L['nin'].shape[0]
    cols = np.full(L['nin'].shape, np.nan)
    for k in range(K):
        t = face_tone(L['nin'][k], v)
        if palette is None:
            c = np.repeat(t[..., None], 3, -1)
        else:
            c = palette(t)
        cols[k] = np.where((L['n'] > k)[..., None], c, np.nan)
    return cols


def compose(img_mix, ground):
    out = np.where(np.isnan(img_mix), ground, img_mix)
    return out


CROP = (slice(64, 566), slice(326, 874))          # the figure in the original's frame


def drawing_layers(ss=2, boxes=None, K=3, owner=None):
    y0, x0 = CROP[0].start, CROP[1].start
    hh, ww = (CROP[0].stop - y0) * ss, (CROP[1].stop - x0) * ss
    O, D = drawing_rays((hh, ww), step=1.0 / ss, x0=x0 - 0.5 + 0.5 / ss, y0=y0 - 0.5 + 0.5 / ss)
    L = obb_layers(unit_boxes() if boxes is None else boxes, O, D, K=K, owner=owner)
    return L, O, D


def vector_original(ss=2):
    big = raster_drawn((630, 1200), ss)
    return big[CROP[0].start * ss:CROP[0].stop * ss, CROP[1].start * ss:CROP[1].stop * ss]


def outline(img, has, ss, col=(0.25, 0.25, 0.25), width=1):
    """a thin line where a figure pixel meets the ground (the drawing's outline: white on white needs it)"""
    e = np.zeros(has.shape, bool)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        e |= has & ~np.roll(np.roll(has, dy, 0), dx, 1)
    out = img.copy()
    out[e] = col
    return out


if __name__ == '__main__':
    ss = 2
    L, O, D = drawing_layers(ss)
    v = -D
    cols = layer_colours(L, D)
    orig = vector_original(ss)
    has = L['n'] >= 1
    fig = has | (orig >= 0)
    otone = np.where(orig >= 0, C8[np.clip(orig, 0, 2)], 255) / 255.0
    res = {}
    imgs = {}
    for how in MIX:
        m = mix(cols, L['n'], how)
        g = compose(m, np.ones(3))[..., 0]
        imgs[how] = g
        d8 = np.abs(g - otone)[fig] * 255
        two = (L['n'] >= 2)
        near = np.abs(g[..., None] * 255 - C8[None, None, :]).argmin(-1)
        cls_ok = np.where(orig >= 0, near == np.clip(orig, 0, 2), ~has)
        res[how] = dict(mae_8bit_figure=float(d8.mean()), mae_8bit_crossings=float((np.abs(g - otone)[two] * 255).mean()),
                        class_err_pct=float(100 * (~cls_ok[fig]).mean()))
        print('%-13s |d| figure %.2f  crossings %.2f  class err %.2f%%' % (how, res[how]['mae_8bit_figure'], res[how]['mae_8bit_crossings'], res[how]['class_err_pct']))
    # the crossings: two layers, grouped by front face, back face and bars
    two = L['n'] >= 2
    names = [b['name'] for b in unit_boxes()]
    FN = {(0, 1): '+x', (0, -1): '-x', (1, 1): '+y', (1, -1): '-y', (2, 1): '+z', (2, -1): '-z'}
    def fcode(nv):
        a = int(np.abs(nv).argmax()); return FN[(a, int(np.sign(nv[a])))]
    keys = Counter()
    groups = {}
    idx = np.argwhere(two)
    for (i, j) in idx[::1]:
        k = (names[L['box'][0][i, j]], fcode(L['nin'][0][i, j]), names[L['box'][1][i, j]], fcode(L['nin'][1][i, j]))
        keys[k] += 1
        groups.setdefault(k, []).append((i, j))
    TN = {0: 'grey', 1: 'black', 2: 'white', -1: 'paper'}
    rows = []
    for k, cnt in keys.most_common():
        pts = np.array(groups[k])
        ov = Counter(orig[pts[:, 0], pts[:, 1]].tolist()).most_common(1)[0][0]
        f, b = cols[0][pts[0, 0], pts[0, 1], 0], cols[1][pts[0, 0], pts[0, 1], 0]
        row = dict(px=int(cnt) // (ss * ss), front='%s %s' % (k[0], k[1]), back='%s %s' % (k[2], k[3]),
                   front_tone=hx([f] * 3), back_tone=hx([b] * 3), original_shows=TN[ov])
        for how in MIX:
            row[how] = hx([imgs[how][pts[0, 0], pts[0, 1]]] * 3)
        rows.append(row)
    for r in rows:
        print('%5d px  %-16s over %-16s %s/%s  original %-5s | ' % (r['px'], r['front'], r['back'], r['front_tone'], r['back_tone'], r['original_shows']) +
              ' '.join('%s %s' % (h[:5], r[h]) for h in MIX[1:]))
    json.dump(dict(measures=res, crossings=rows), open(OUT + 'films_drawing.json', 'w'), indent=1)
    np.save(OUT + 'films_imgs.npy', np.stack([imgs[h] for h in MIX]).astype(np.float32))

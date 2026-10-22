"""Measure the two black oval eyes on both covers, as patches on the head sphere (orthographic view).
For each cover: head circle (from wf5 head.json), dark pixels inside 0.9 r, two biggest components,
each mapped to unit vectors on the sphere; centre direction = normalised mean; size from second moments
in the tangent plane at the centre (uniform ellipse: var = a^2/4)."""
import json, numpy as np
from PIL import Image
U = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/'
HJ = json.load(open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/head.json'))
OUT = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl/meas/'

def label(mask):
    H, W = mask.shape
    lab = np.zeros((H, W), int); n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1; st = [(y0, x0)]; lab[y0, x0] = n
        while st:
            y, x = st.pop()
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                yy, xx = y+dy, x+dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; st.append((yy, xx))
    return lab, n

res = {}
for k in ('1', '2'):
    im = np.asarray(Image.open(U + 'pearl-%s.png' % k).convert('RGB')).astype(float) / 255
    cx, cy, r = HJ[k]['cx'], HJ[k]['cy'], HJ[k]['r']
    L = 0.299*im[...,0] + 0.587*im[...,1] + 0.114*im[...,2]
    yy, xx = np.mgrid[0:im.shape[0], 0:im.shape[1]]
    inside = ((xx - cx)**2 + (yy - cy)**2 < (0.95 * r)**2) & (np.abs(yy - cy) < 0.45 * r) & (xx > cx)
    out = {}
    for thr in (0.18, 0.25, 0.32):
        dark = inside & (L < thr)
        lab, n = label(dark)
        sizes = np.bincount(lab.ravel())[1:]
        big = np.argsort(sizes)[::-1][:2] + 1
        eyes = []
        for c in big:
            ys, xs = np.nonzero(lab == c)
            x = (xs + 0.5 - cx) / r; y = -(ys + 0.5 - cy) / r
            z = np.sqrt(np.clip(1 - x*x - y*y, 0, 1))
            P = np.c_[x, y, z]
            e = P.mean(0); e /= np.linalg.norm(e)
            up = np.array([0, 1.0, 0]); up = up - e * (up @ e); up /= np.linalg.norm(up)
            side = np.cross(up, e)
            q = P - np.outer(P @ e, e)
            qx, qy = q @ side, q @ up
            C = np.cov(np.c_[qx, qy].T)
            w, V = np.linalg.eigh(C)
            a, b = 2*np.sqrt(w[0]), 2*np.sqrt(w[1])
            tilt = np.degrees(np.arctan2(V[0,1], V[1,1]))   # major axis from the tangent 'up', + toward side
            az = np.degrees(np.arctan2(e[0], e[2])); el = np.degrees(np.arcsin(e[1]))
            # area-based check: pixel count on the sphere (each pixel covers 1/(r^2 z) of sphere area)
            area = (1.0 / (r*r) / np.maximum(z, 0.05)).sum()
            eyes.append(dict(n=int(len(xs)), u=float(xs.mean()), v=float(ys.mean()), az=float(az), el=float(el),
                             half_w=float(a), half_h=float(b), tilt=float(tilt), area_sphere=float(area),
                             ellipse_area=float(np.pi*a*b),
                             px_w=int(xs.max()-xs.min()+1), px_h=int(ys.max()-ys.min()+1)))
        eyes.sort(key=lambda d: d['az'])
        out['thr%.2f' % thr] = eyes
        print('cover', k, 'thr', thr)
        for e in eyes:
            print('   n %4d  centre px (%.1f, %.1f)  az %6.2f el %5.2f  half-w %.4f half-h %.4f (R) tilt %5.1f  px %dx%d  area %.4f vs ellipse %.4f'
                  % (e['n'], e['u'], e['v'], e['az'], e['el'], e['half_w'], e['half_h'], e['tilt'], e['px_w'], e['px_h'], e['area_sphere'], e['ellipse_area']))
        if len(eyes) == 2:
            d = np.degrees(np.arccos(np.clip(np.dot(*[np.array([np.sin(np.radians(e['az']))*np.cos(np.radians(e['el'])), np.sin(np.radians(e['el'])), np.cos(np.radians(e['az']))*np.cos(np.radians(e['el']))]) for e in eyes]), -1, 1)))
            print('   angular separation %.2f deg, mid az %.2f' % (d, (eyes[0]['az'] + eyes[1]['az'])/2))
    res[k] = out
json.dump(res, open(OUT + 'eyes.json', 'w'), indent=1)

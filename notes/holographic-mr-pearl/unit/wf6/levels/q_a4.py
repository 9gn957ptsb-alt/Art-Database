import json, math, numpy as np
import drawing2d as D
res = json.load(open('q_a3.json'))
# 1) per-edge offsets between the golden and thirds drawings, each at its own fit, in pixels
def line_px(kind, c, fit):
    """A lattice line kind in {0: z-y, 1: x-z, 2: y-x} = c, as a pixel-space line n . (px, py) = d (unit n)."""
    s, cx, cy, k = fit
    # points on the line in (a,b): parametrise lattice coords with the constraint sum = 0
    # z-y = c is b = (c + 4/3)/sqrt2, any a. x-z = c and y-x = c by the 3-fold turn of the drawing about CENTRE.
    b0 = (c + 4 / 3) / math.sqrt(2)
    # the line z-y=c in (a, b): b = b0. Turned by -120 deg (x-z) and +120 deg (y-x) about the drawing centre (0,0)?
    # Derive directly: a point with lattice (l0, l1, l2) has a = (l2 - l1)/sqrt6, b = (l0 + 4/3)/sqrt2.
    pts = []
    for t in (-1.0, 1.0):
        if kind == 0:
            l0, l1 = c, t; l2 = -l0 - l1
        elif kind == 1:
            l1, l0 = c, t; l2 = -l0 - l1
        else:
            l2, l0 = c, t; l1 = -l0 - l2
        a = (l2 - l1) / math.sqrt(6); b = (l0 + 4 / 3) / math.sqrt(2)
        pts.append((cx + s * a, cy - s * k * b))
    (x0, y0), (x1, y1) = pts
    n = np.array([y1 - y0, -(x1 - x0)]); n /= np.linalg.norm(n)
    return n, n @ np.array([x0, y0])
lines = set()
for tone, L in D.POLYS:
    for q in L:
        for kind in range(3):
            lines.add((kind, q[kind][0], q[kind][1]))
fg, f9 = res['golden']['fit'], res['thirds']['fit']
offs = []
for kind, c0, cH in sorted(lines):
    n9, d9 = line_px(kind, c0 + cH * D.H9, f9)
    ng, dg = line_px(kind, c0 + cH * D.HG, fg)
    if n9 @ ng < 0: ng, dg = -ng, -dg
    # offset measured at the figure's centre region: distance between the parallel lines near the drawing centre
    offs.append(((kind, c0, cH), dg - d9))
offs_abs = np.abs([o for _, o in offs])
print('distinct drawn lines: %d; offset golden - thirds (own fits), px: max %.2f, mean %.2f, median %.2f' % (len(offs), offs_abs.max(), offs_abs.mean(), np.median(offs_abs)))
for (key, o) in sorted(offs, key=lambda r: -abs(r[1]))[:6]:
    print('   line', ['z-y', 'x-z', 'y-x'][key[0]], '= %g %+gH' % (key[1], key[2]), ' offset %.2f px' % o)
# bar width in px at each
for name, H, fit in [('thirds', D.H9, f9), ('golden', D.HG, fg)]:
    s = fit[0]
    print(name, 'bar across %.2f px, hole side %.2f px, figure side %.2f px' % (2 * math.sqrt(2) * H * s, (1 - 6 * H) * math.sqrt(2 / 3) * s, (2 + 6 * H) * math.sqrt(2 / 3) * s))
# 2) against cls_clean (strokes relabelled)
CC = D.target('clean')
for name, H in [('thirds', D.H9), ('golden', D.HG)]:
    R = D.raster(H, res[name]['fit'])
    w = int(((R != CC)).sum()); n = int((CC >= 0).sum())
    print(name, 'vs cls_clean (holes paper): wrong %d of %d = %.3f%%' % (w, n, 100 * w / n))
    res[name]['vs_cls_clean'] = dict(wrong=w, of=n, pct=round(100 * w / n, 3))
res['edge_offsets_px'] = dict(max=round(float(offs_abs.max()), 2), mean=round(float(offs_abs.mean()), 2), lines=len(offs))
json.dump(res, open('q_a3.json', 'w'), indent=1)

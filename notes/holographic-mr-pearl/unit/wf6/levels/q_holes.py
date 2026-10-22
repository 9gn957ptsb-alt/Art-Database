import json, math, numpy as np
import drawing2d as D
C = D.target('cls'); Ch = D.target('holes')
holes = (C == 2) & (Ch == -1)          # the four enclosed openings
# connected components (4-neighbour flood fill)
lab = np.full(C.shape, -1, int); n = 0
for y0, x0 in zip(*np.nonzero(holes)):
    if lab[y0, x0] >= 0: continue
    st = [(y0, x0)]; lab[y0, x0] = n
    while st:
        y, x = st.pop()
        for yy, xx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
            if 0 <= yy < 630 and 0 <= xx < 1200 and holes[yy, xx] and lab[yy, xx] < 0:
                lab[yy, xx] = n; st.append((yy, xx))
    n += 1
fits = json.load(open('q_a3.json'))
k = 1.0393
out = {'holes': []}
for i in range(n):
    m = lab == i
    A = int(m.sum()); ys, xs = np.nonzero(m)
    # side of an equilateral triangle stretched by k with this area; plus the width across in x at its widest row
    side = math.sqrt(4 * A / (math.sqrt(3) * k))
    rows = [xs[ys == y] for y in np.unique(ys)]
    widest = max(r.max() - r.min() + 1 for r in rows)
    out['holes'].append(dict(area_px=A, side_from_area_px=round(side, 2), widest_row_px=int(widest), centre=(round(xs.mean(), 1), round(ys.mean(), 1))))
    print('hole %d: area %d px, side from area %.2f px, widest row %d px, centre (%.1f, %.1f)' % (i, A, side, widest, xs.mean(), ys.mean()))
# what each model predicts for the same measurement (rasterise its holes the same way, then shrink by the stroke: compare like with like
for name, H in [('thirds', D.H9), ('golden', D.HG)]:
    fit = fits[name]['fit']; s = fit[0]
    R = D.raster(H, fit)
    # the model's holes as pixels: ground pixels enclosed by the figure (inside the hole polygons)
    ys, xs = np.mgrid[0:630, 0:1200].astype(float)
    a = (xs - fit[1]) / s; b = -(ys - fit[2]) / (s * fit[3])
    areas = []
    for tone, P in D.polygons(H):
        if tone < 0: areas.append(int(D.inside(P, a, b).sum()))
    side_model = (1 - 6 * H) * math.sqrt(2 / 3) * s
    print(name, 'model hole areas', areas, 'side %.2f px' % side_model)
    out[name] = dict(model_hole_areas=areas, model_hole_side_px=round(side_model, 2))
# the original's stroke eats about half a pixel of each hole edge: the measured area vs each model's area minus a half-pixel band
meas = np.mean([h['area_px'] for h in out['holes']])
for name in ('thirds', 'golden'):
    a_ = out[name]['model_hole_side_px']; band = 0.5
    # area of the triangle with each side moved in by `band` px (inradius shrinks by band)
    a2 = a_ - 2 * math.sqrt(3) * band
    pred = math.sqrt(3) / 4 * a2 ** 2 * k
    out[name]['predicted_area_with_half_px_stroke'] = round(pred, 1)
    print(name, 'predicted hole area with a half-pixel stroke on each edge: %.0f px (measured mean %.0f)' % (pred, meas))
out['measured_mean_area'] = meas
json.dump(out, open('q_holes.json', 'w'), indent=1)

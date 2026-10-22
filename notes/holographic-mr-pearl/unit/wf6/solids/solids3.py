#!/usr/bin/env python3
"""Run 3: the CUBE, the PYRAMID (1:1 steps) and the SPHERE (blocks whose centre lies within R) built of game blocks,
each block the unit under the surface-film rule ('face'), at the levels F(4), F(6), F(8) = 3, 8, 21 blocks
(side / height / radius; successive levels phi^2 apart). Renders: the drawing's eye (today vs face) and a player's
eyes (1.7 m) 5 m and 30 m off the footprint (face). Numbers: blocks, shell blocks (the only ones ever seen), bars
fraction of the volume, built volume / ideal, symmetric difference / ideal, silhouette IoU against the ideal from
the drawing's eye, see-through today vs face, tests per pixel."""
import sys, time, json
import numpy as np
sys.path.insert(0, '.')
from common import *
import solids_grid as SG

W, Hh, SS = 420, 315, 2


def render(occ, mode, film, fcol, O, D, shape, stop, paper):
    res = walk_chunked(occ, O, D, film=film, film_colour=fcol, K=4, stop_after=stop)
    bgrgb = np.tile(np.array([240.0, 236, 228]), (len(D), 1)) if paper else background(D, O=O)
    vals = colour(res, mode, np.full(len(O), np.nan))
    cover = np.isfinite(vals)
    img = to_rgb(vals, bgrgb, shape, cover).astype(float)
    h, w = shape
    img = img.reshape(h // SS, SS, w // SS, SS, 3).mean((1, 3)).astype(np.uint8)
    entered = (res['steps'] > 0) & ((res['fb'] > 0) | (res['k'] == 1).any(1) | (res['k'] == 2).any(1))
    return img, dict(see_through=float(((~cover) & entered).sum() / max(entered.sum(), 1)),
                     tests_mean=float(res['tests'][cover].mean()) if cover.any() else 0.0,
                     value_std=float(np.nanstd(vals[cover])) if cover.any() else 0.0), cover, res


if __name__ == '__main__':
    which = sys.argv[1:] or ['cube', 'pyramid', 'sphere']
    MAKE = {'cube': SG.cube, 'pyramid': SG.pyramid, 'sphere': SG.sphere}
    for name in which:
        rows, labels, allst = [], [], {}
        for n in (3, 8, 21):
            occ, ideal = MAKE[name](n)
            SG.IDEAL_BOX = occ.shape
            p = np.pad(occ, 1)
            interior = (p[2:, 1:-1, 1:-1] & p[:-2, 1:-1, 1:-1] & p[1:-1, 2:, 1:-1] & p[1:-1, :-2, 1:-1]
                        & p[1:-1, 1:-1, 2:] & p[1:-1, 1:-1, :-2])
            st = dict(level=n, blocks=int(occ.sum()), units=int(occ.sum()), bars=int(6 * occ.sum()),
                      shell_blocks=int((occ & ~interior).sum()))
            st.update(SG.volume_numbers(occ, ideal))
            st['bar_material_of_ideal'] = st['built_over_ideal'] * unit_volume()
            lo, hi = np.zeros(3), np.array(occ.shape, float)
            c = (lo + hi) / 2
            span = 1.25 * np.linalg.norm(hi - lo) * 0.82
            O, D, shape, px = drawing_view(c, span, W * SS, Hh * SS)
            t0 = time.time()
            img_f, s1, cover, res = render(occ, 'face', 'face', 'mean', O, D, shape, 2, True)
            idh = SG.ideal_hit(ideal, O, D)
            st['drawing_silhouette_iou'] = float((idh & cover).sum() / (idh | cover).sum())
            img_t, s0, cov0, _ = render(occ, 'today', 'none', 'mean', O, D, shape, 1, True)
            st['drawing_see_through_today'] = s0['see_through']
            st['drawing_ideal_covered_today'] = float((cov0 & idh).sum() / idh.sum())
            st['drawing_see_through_face'] = s1['see_through']; st['drawing_tests_face'] = s1['tests_mean']
            st['drawing_value_std_face'] = s1['value_std']
            r = [img_t, img_f]; l = ['%s %d drawing today' % (name, n), '%s %d drawing face' % (name, n)]
            for dist in (5, 30):
                (O, D, shape), eye = player(None, lo, hi, dist, W * SS, Hh * SS, f=FOCAL * SS)
                img, s2, cover, res = render(occ, 'face', 'face', 'mean', O, D, shape, 2, False)
                st['p%d_see_through' % dist] = s2['see_through']; st['p%d_tests' % dist] = s2['tests_mean']
                st['p%d_value_std' % dist] = s2['value_std']
                r.append(img); l.append('%s %d player %dm face' % (name, n, dist))
            print(name, n, {k: (round(v, 4) if isinstance(v, float) else v) for k, v in st.items()},
                  '%.0fs' % (time.time() - t0), flush=True)
            for im, lab in zip(r, l):
                save(im, 'S3_' + lab.replace(' ', '_') + '.png')
            rows.append(r); labels.append(l)
            allst['%s %d' % (name, n)] = st
        sheet(rows, 'S3_%s_sheet.png' % name, labels)
        prev = {}
        try:
            prev = json.load(open('solids3.json'))
        except Exception:
            pass
        prev.update(allst)
        dump(prev, 'solids3.json')

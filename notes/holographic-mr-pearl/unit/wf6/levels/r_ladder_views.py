"""The level-5 nest (three levels of corners + openings) turned, and from one eye in perspective, drawn in.
Also: the closure gap of every leaf (each tribar's start vs the end that closes on it), relative to its own size."""
import math, json, time, numpy as np
from PIL import Image
import nest as N, ladder as LD, r_ladder as R, unit as U
fr = LD.nest_frames(5, 2, openings=True)
prm = R.prims_of(fr)
P = np.concatenate([p.P for p in prm]); c = (P.min(0) + P.max(0)) / 2
dep = (P - N.CENTRE) @ N.NH
span = LD.F(9) / 8 * 2.6
W = 500
tiles = []
for az, el in ((0, 0), (20, 0), (45, 10), (90, 20)):
    tone, idx, d = N.turned_view(prm, az, el, c, span, w=W)
    img = R.film(N.picture(tone, idx), tone, idx, fr, lambda f: {'A': 2, 'B': 3, 'C': 4}.get(f.path[:1], -1))
    tiles.append(R.label(img, 'turned %d deg about z, tilted %d' % (az, el)))
row1 = np.concatenate(tiles, 1)
def rot(axis, ang):
    axis = np.asarray(axis, float) / np.linalg.norm(axis); K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
f = 4.0 * LD.F(9) / 8
din, E = N.drawn_in_prims(prm, eye_dist=f)
fov = 2 * math.degrees(math.atan(span / 2 / f))
tiles = []
for name, pr, eye in (('one eye: the whole nest drawn in toward it', din, E), ('the same eye, not drawn in', prm, E),
                      ('drawn in, the eye moved 8 deg round', din, N.CENTRE + rot((0, 0, 1), math.radians(8)) @ (E - N.CENTRE)),
                      ('drawn in, the eye moved 30 deg round', din, N.CENTRE + rot((0, 0, 1), math.radians(30)) @ (E - N.CENTRE))):
    O, Dv = U.persp_rays(eye, N.CENTRE, N.UPV, fov, W, W)
    tone, idx = N.lv.cast(pr, O, Dv, want_level=True)
    img = R.film(N.picture(tone, idx), tone, idx, fr, lambda f: {'A': 2, 'B': 3, 'C': 4}.get(f.path[:1], -1))
    tiles.append(R.label(img, name))
Image.fromarray(np.concatenate([row1, np.concatenate(tiles, 1)], 0)).save('ladder_views.png')
# closure: ortho views turned, relative gap per leaf level
copies = [x.copy(i) for i, x in enumerate(fr)]
res = {}
def proj_ortho(d, up):
    d = d / np.linalg.norm(d); rr = np.cross(d, up); rr /= np.linalg.norm(rr); uu = np.cross(rr, d)
    return lambda Q: np.stack([Q @ rr, Q @ uu], -1)
for az in (0, 5, 20, 45):
    d = rot((0, 0, 1), math.radians(az)) @ (-N.NH)
    pj = proj_ortho(d, np.array([0, 0, 1.0]) if az else N.UPV)
    g = N.closure_gaps(copies, pj, lambda cp: cp.s * N.LL)
    byk = {}
    for (lev, gap), x in zip(g, fr):
        k = 'level %d (%s)' % (x.m, x.kind); byk.setdefault(k, []).append(gap)
    res['ortho turned %d deg' % az] = {k: dict(n=len(v), max=round(max(v), 5), min=round(min(v), 5)) for k, v in byk.items()}
json.dump(dict(depth_range=[float(dep.min()), float(dep.max())], outline_drawn=LD.F(9) / 3 * N.LL, closure=res), open('q_ladder_closure.json', 'w'), indent=1)
print(json.dumps(res, indent=1)); print('depth range', dep.min(), dep.max(), 'outline', LD.F(9) / 3 * N.LL)

"""(d) continued. The bare units leave the land a lattice: from the drawing's eye 36% of rays run through any depth of
it (the holes line up along (1,1,1)), so bar films alone can never make it solid. The block itself must be a film:
where a ray crosses from one filled block into the next, it crosses a film of the block (the cube the unit approaches).
Two colourings of that film:
  'mean'  the cube's mean from the eye: m(v) = sum |v_i| tone_i / sum |v_i| (a cube's three faces by projected area;
          from the drawing's eye round((128+0+255)/3) = 128, the drawing's grey: Colour Middling's 3-way Average)
  'axis'  the crossed face's own tone by its axis (the drawing's rule applied to the block's faces)
An exposed block face (block to air) carries no film: near, the facades open and you see in; a lone unit stays a film.
"""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from land import walk, recursive_average, PAL_GREY, PAL_PAIR, view_rays


def cube_mean(v, pal):
    w = np.abs(v)
    return (w @ pal) / w.sum(-1, keepdims=True)


def shade(res, v, pal, mode):
    nK, nall, NIN, TIN, BLK = res
    BUL = walk.BUL
    fam = np.abs(NIN).argmax(-1)
    c8 = pal[fam].astype(float)
    if mode == 'mean':
        m = np.floor(cube_mean(v, pal) + 0.5)
        c8 = np.where(BUL[..., None], m[None], c8)
    out = recursive_average(c8, nK)
    return out, BUL.copy()


if __name__ == '__main__':
    SZ = 300
    eyes = [("the drawing's eye", -np.ones(3), np.array([0, -1.0, 1])), ('az 30 el 35', -az_el(30, 35), np.array([0, 0, 1.0])),
            ('az 60 el 60', -az_el(60, 60), np.array([0, 0, 1.0])), ('az 10 el 12 (low, along the ground)', -az_el(10, 12), np.array([0, 0, 1.0]))]
    land4 = np.ones((8, 8, 4), bool)
    land8 = np.ones((8, 8, 8), bool)
    res = {}
    tiles = []
    for name, d, up in eyes:
        centre = np.array([4, 4, 2.0])
        O, D = view_rays(d, up, centre, 6.0, (SZ, SZ))
        v = -D
        for mode in ('none', 'mean', 'axis'):
            a = walk(O, D, land4, K=64, bulk=(mode != 'none')); ca, bul_a = shade(a, v, PAL_GREY, mode)
            b = walk(O + np.array([0, 0, 4.0]), D, land8, K=64, bulk=(mode != 'none')); cb, _ = shade(b, v, PAL_GREY, mode)
            both = (a[0] > 0) & (b[0] > 0)
            diff = np.abs(ca - cb).max(-1)
            through = float((a[0] == 0)[both | (a[0] == 0)].mean()) if True else 0
            nfront = a[1][a[0] > 0]
            r = dict(films_mean=float(nfront.mean()), ge8=float((nfront >= 8).mean()),
                     deeper_changed=float((diff[both] > 0).mean()), deeper_changed_gt1=float((diff[both] > 1).mean()),
                     deeper_mean_change=float(diff[both].mean()), deeper_max=float(diff[both].max()),
                     through_holes=float((a[0] == 0).mean()))
            res['%s / %s' % (name, mode)] = r
            print('%-38s %-5s' % (name, mode), {k: round(x, 4) for k, x in r.items()})
            img = np.where((a[0] > 0)[:, None], ca / 255, np.array([0.93, 0.94, 0.95])).reshape(SZ, SZ, 3)
            t = to_img(img); label(t, '%s\nblock film: %s\nfilms %.1f, deeper land changes %.1f%% of px' % (name, mode, r['films_mean'], 100 * r['deeper_changed_gt1']), sz=11)
            tiles.append(t)
        # the Cezanne pair with the mean block film
        a = walk(O, D, land4, K=64, bulk=True); cp, _ = shade(a, v, PAL_PAIR, 'mean')
        img = np.where((a[0] > 0)[:, None], cp / 255, np.array([0.93, 0.94, 0.95])).reshape(SZ, SZ, 3)
        t = to_img(img); label(t, '%s\nblock film: mean, Cezanne pair' % name, sz=11); tiles.append(t)
    res['cube_mean_drawing_eye_grey'] = [float(x) for x in cube_mean(np.ones(3) / math.sqrt(3), PAL_GREY)]
    res['cube_mean_drawing_eye_pair'] = [float(x) for x in cube_mean(np.ones(3) / math.sqrt(3), PAL_PAIR)]
    print(res['cube_mean_drawing_eye_grey'], res['cube_mean_drawing_eye_pair'])
    json.dump(res, open(OUT + 'land2.json', 'w'), indent=1)
    g = grid(tiles, 4, pad=5); g.save(OUT + 'D2_block_films.png'); print(g.size)

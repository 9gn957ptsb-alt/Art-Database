"""Rule 6 check: Cezanne's modelling is warm in the lights, cool in the shades. Measure it in the two paintings the
artist sent (local: in each 24 px window, the OKLab (a, b) direction that light minus shade takes, i.e. the slope of
(a, b) on L), and compare with what the unit's film (P-F, d 253.2 nm) does between a facet turned toward the eye and
one turned away (the film's own warm/cool), and with the drawing's light (z lit white, y unlit black)."""
import json, math, sys
import numpy as np
from PIL import Image
sys.path.insert(0, '.')
from common import *
from pearl_final import DesignF
U = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/'
res = {}
for nm in ['cezanne-1.jpg', 'cezanne-2.png']:
    im = np.asarray(Image.open(U + nm).convert('RGB')).astype(float) / 255
    lab = oklab(im)
    W = 24
    h, w = lab.shape[0] // W, lab.shape[1] // W
    L = lab[:h * W, :w * W].reshape(h, W, w, W, 3).transpose(0, 2, 1, 3, 4).reshape(h, w, W * W, 3)
    d = L - L.mean(2, keepdims=True)
    var = (d[..., 0] ** 2).sum(-1)
    ok = var > (0.03 ** 2) * W * W                                 # windows with real light and shade
    sa = (d[..., 0] * d[..., 1]).sum(-1)[ok] / var[ok]            # da/dL
    sb = (d[..., 0] * d[..., 2]).sum(-1)[ok] / var[ok]            # db/dL
    ang = np.degrees(np.arctan2(sb, sa))
    # hue direction of 'light minus shade': weighted mean of the slope vectors
    A, B = sa.mean(), sb.mean()
    res[nm] = dict(windows=int(ok.sum()), share_lights_warmer_db_pos=round(float((sb > 0).mean()), 3),
                   mean_slope_a=round(float(A), 4), mean_slope_b=round(float(B), 4),
                   light_minus_shade_hue_deg=round(math.degrees(math.atan2(B, A)), 1),
                   median_slope_b=round(float(np.median(sb)), 4))
    # mean colours of the lightest and darkest fifth of each window, averaged
    srt = np.argsort(L[..., 0], -1)
    k = W * W // 5
    lo = np.take_along_axis(L, srt[..., :k, None], 2).mean(2)[ok].mean(0)
    hi = np.take_along_axis(L, srt[..., -k:, None], 2).mean(2)[ok].mean(0)
    res[nm]['local_light'] = hx(enc(np.clip(oklab_to_lin(hi[None]), 0, 1))[0])
    res[nm]['local_shade'] = hx(enc(np.clip(oklab_to_lin(lo[None]), 0, 1))[0])
des = DesignF(d=253.2)
film = {}
for fam in range(3):
    rows = {}
    for a1, a2 in [(40, 65), (30, 70), (20, 75)]:
        c1, c2 = math.cos(math.radians(a1)), math.cos(math.radians(a2))
        f1 = oklab_lin(np.clip(des.facet(fam, np.array([c1])), 0, 1))[0]; f2 = oklab_lin(np.clip(des.facet(fam, np.array([c2])), 0, 1))[0]
        dd = f1 - f2
        rows['%d_vs_%d' % (a1, a2)] = dict(toward=hx(enc(np.clip(des.facet(fam, np.array([c1])), 0, 1))[0]), away=hx(enc(np.clip(des.facet(fam, np.array([c2])), 0, 1))[0]),
                                           toward_minus_away_hue_deg=round(math.degrees(math.atan2(dd[2], dd[1])), 1), db=round(float(dd[2]), 4), da=round(float(dd[1]), 4))
    film['xyz'[fam]] = rows
res['film_P-F_253'] = film
# the game's usual eye (third person, above): elevation 35..60, the lit family (z, white) is turned toward the eye
# (|v_z| = sin el > crux for el > 35.26), the unlit sides (x grey, y black) away: lights warm, shades cool, as Cezanne
el_c = math.degrees(math.asin(UNIT := 1 / math.sqrt(3)))
res['eye_elevation_where_top_faces_pass_the_crux_deg'] = round(el_c, 2)
json.dump(res, open('cezanne_check.json', 'w'), indent=1)
print(json.dumps(res, indent=1))

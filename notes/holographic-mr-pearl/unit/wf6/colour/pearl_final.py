"""(c) final film design P-F = P-E + P-A's glint, on every unit facet (an axis facet seen at cos_i = |v_i|):
   F_i(c) = tone_i_lin * [R(c) / Y(R(c))] / [R_D / Y(R_D)]  +  max(R(c) - R_D, 0)
   R: Mr Pearl's film (wf5 fit: n_f 1.1638 on n_s 1.3539). [check-colour: the first draft set d = 1188 nm (OPD_X 1971);
   the FINAL is d = 253.2 nm (OPD at the crux 420 nm), passed as argv[1]; R_D = R at the crux, balanced to neutral.]
At the crux (every facet from the drawing's eye) R/Y(R) = (1,1,1) and R - R_D = 0: the drawing's tones exactly.
Elsewhere: the facet keeps the drawing's luminance and takes the film's hue (P-E), and beyond the crux angle (grazing)
it adds the film's extra reflection (P-A), which is what lets the black family shimmer at all."""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from film_designs import Design, render, strength, MP, TONE_LIN
from pearl_film import R, cD, d_for


class DesignF(Design):
    def __init__(self, glint=1.0, d=None):
        self.name = 'P-F'
        c = np.linspace(1e-4, 1, 2001)
        self.c = c
        Rc = R(c, *MP, d=d); RD = R(np.array([cD]), *MP, d=d)[0]
        chrom = Rc / np.maximum(Rc @ LUMA, 1e-9)[:, None]
        chrom = chrom / (RD / (RD @ LUMA))         # balanced on the film's own crux colour: exactly neutral there
        self.F = [TONE_LIN[i] * chrom + glint * np.maximum(Rc - RD, 0) for i in range(3)]
        self.RD = RD


if __name__ == '__main__':
    D_NM = float(sys.argv[1]) if len(sys.argv) > 1 else 342.14          # Mr Pearl's own film thickness (wf6/pearl, covers' fit)
    TAG = sys.argv[2] if len(sys.argv) > 2 else ''
    des = DesignF(d=D_NM)
    res = dict(film=dict(n_f=MP[0], n_s=MP[1], d_nm=D_NM, OPD_crux=float(2 * MP[0] * D_NM * math.sqrt(1 - (2 / 3) / MP[0] ** 2)), R_D=[float(x) for x in des.RD]))
    res['strength'] = strength(des)
    print(json.dumps(res, indent=1))
    # facet colours by angle, named
    tab = {}
    for ang in (0, 20, 40, 54.7356, 65, 75, 85):
        c = math.cos(math.radians(ang))
        tab['%g' % ang] = {'xyz'[i]: hx(enc(np.clip(des.facet(i, np.array([c])), 0, 1))[0]) for i in range(3)}
    res['facet_by_angle'] = tab
    print(tab)
    allc = None
    from films import unit_boxes
    allc = np.array([b['c'] for b in unit_boxes()]); C0 = (allc.min(0) + allc.max(0)) / 2
    views = [("the drawing's eye", -np.ones(3), np.array([0, -1.0, 1]), CENTRE, 3.0), ('az 15 el 35', -az_el(15, 35), np.array([0, 0, 1.0]), C0, 3.6),
             ('az 75 el 35', -az_el(75, 35), np.array([0, 0, 1.0]), C0, 3.6), ('az 45 el 70', -az_el(45, 70), np.array([0, 0, 1.0]), C0, 3.6),
             ('az 45 el 10', -az_el(45, 10), np.array([0, 0, 1.0]), C0, 3.6), ('az 200 el -25', -az_el(200, -25), np.array([0, 0, 1.0]), C0, 3.6)]
    tiles = []
    for title, d, up, centre, span in views:
        img = render(des, d, up, centre, span)
        t = to_img(img); label(t, 'P-F (d %.0f nm): %s' % (D_NM, title), sz=12); tiles.append(t)
    # strips by angle
    from PIL import Image, ImageDraw
    W = 300 * 6 + 25
    ang = np.linspace(0, 88, 600); c = np.cos(np.radians(ang))
    strip = Image.new('RGB', (W, 150), (250, 250, 250)); d = ImageDraw.Draw(strip)
    for k, i in enumerate((2, 0, 1)):
        s8 = enc(np.clip(des.facet(i, c), 0, 1))
        im = to_img(np.repeat(s8[None], 30, 0)).resize((W - 200, 30))
        strip.paste(im, (190, 10 + k * 38)); d.text((6, 18 + k * 38), 'facet %s (%s)' % ('xyz'[i], ['grey', 'black', 'white'][i]), fill=(20, 20, 20), font=font(13))
    xD = 190 + int((W - 200) * 54.7356 / 88)
    d.line((xD, 4, xD, 128), fill=(220, 30, 30), width=2); d.text((xD + 4, 128), 'the crux 54.74 deg', fill=(200, 20, 20), font=font(12))
    for a in (0, 20, 40, 60, 80):
        d.text((190 + int((W - 200) * a / 88), 128), '%d' % a, fill=(60, 60, 60), font=font(11))
    g = grid(tiles, 6, pad=5)
    out = Image.new('RGB', (g.width, g.height + strip.height), (255, 255, 255)); out.paste(g, (0, 0)); out.paste(strip, (0, g.height))
    out.save(OUT + 'C3_pearl_final%s.png' % TAG); print(out.size)
    json.dump(res, open(OUT + 'pearl_final%s.json' % TAG, 'w'), indent=1)

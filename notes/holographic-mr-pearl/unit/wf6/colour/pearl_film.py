"""(c) THE PEARL: a thin film on every face whose colours resolve to the drawing's greys at the crux angle.
OPD at the crux = 2 n_f d cos(theta_t) = OPD_X = 1971 nm, the achromatic point of thin-film interference (film_scan).
Two designs:
  P-A  one film on every face (n_f, n_s of Mr Pearl's own material), the tone from the body beneath:
       out = rho T(c)^2 / T_D^2 + (R(c) - R_D)        (c = |n.v|; T = 1 - R; _D at c = 1/sqrt3)
       exact at the crux for every rho, per channel; elsewhere the body is tinted by the film's transmission and
       the film's reflection beyond its crux value is added (glints on black, a complementary veil on white).
  P-B  the film alone on a black body, its INDEX per face family so that its neutral reflectance at the crux is the
       family's tone: R_D(n_k) = tone_k R_D(n_z); black = no film (n = 1); out = R_k(c) / R_D(n_z).
"""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from film import film_shader, film_spectral

cD = 1 / math.sqrt(3)
OPD_X = 1971.0


def cos_t(c, nf):
    return np.sqrt(np.maximum(1 - (1 - c * c) / (nf * nf), 0))


def d_for(nf, opd=OPD_X):
    return opd / (2 * nf * cos_t(cD, nf))


def R(c, nf, ns, d=None, model='shader'):
    d = d_for(nf) if d is None else d
    fn = film_shader if model == 'shader' else film_spectral
    c = np.asarray(c, float)
    return fn(c, np.full(c.shape, d), nf, ns)


def design_A(c, rho_lin, nf=1.1638, ns=1.3539, model='shader'):
    Rc = R(c, nf, ns, model=model)
    RD = R(np.array([cD]), nf, ns, model=model)[0]
    T, TD = 1 - Rc, 1 - RD
    return rho_lin[..., None] * (T * T) / (TD * TD) + (Rc - RD)


def solve_index(target, ns=1.0, lo=1.0001, hi=3.0):
    """index whose neutral crux reflectance is target"""
    for _ in range(60):
        m = (lo + hi) / 2
        y = R(np.array([cD]), m, ns)[0] @ LUMA
        if y < target: lo = m
        else: hi = m
    return (lo + hi) / 2


def design_B(c, fam, n_z=2.4, ns=1.0):
    RZ = R(np.array([cD]), n_z, ns)[0] @ LUMA
    n_x = solve_index(float(lin(128 / 255)) * RZ, ns)
    nk = {0: n_x, 1: None, 2: n_z}[fam]
    if nk is None:
        return np.zeros(np.shape(c) + (3,)), dict(n_x=n_x, n_z=n_z, RZ=RZ)
    return R(c, nk, ns) / RZ, dict(n_x=n_x, n_z=n_z, RZ=RZ)


if __name__ == '__main__':
    ang = np.linspace(0, 88, 400)
    c = np.cos(np.radians(ang))
    out = {}
    from PIL import Image, ImageDraw
    rows = []
    tone_lin = {0: float(lin(128 / 255)), 1: 0.0, 2: 1.0}
    names = {0: 'x grey', 1: 'y black', 2: 'z white'}
    for dname, fnc in [('P-A (Mr Pearl film n 1.164 on 1.354, body = tone)', lambda fam: design_A(c, np.full(c.shape, tone_lin[fam]))),
                       ('P-A (soap film n 1.33 in air, body = tone)', lambda fam: design_A(c, np.full(c.shape, tone_lin[fam]), 1.33, 1.0)),
                       ('P-B (film alone, index per family)', lambda fam: design_B(c, fam)[0])]:
        for fam in (2, 0, 1):
            rgb = fnc(fam)
            s8 = enc(np.clip(rgb, 0, 1))
            strip = np.repeat(s8[None], 40, 0)
            rows.append((dname, names[fam], strip))
            iD = np.argmin(np.abs(ang - DRAW_ANGLE))
            ok = oklab(np.clip(s8, 0, 1)); Cc = np.hypot(ok[:, 1], ok[:, 2])
            out['%s / %s' % (dname, names[fam])] = dict(at_crux=hx(s8[iD]), chroma_max=float(Cc.max()), chroma_mean=float(Cc.mean()),
                                                         at_0deg=hx(s8[0]), at_30=hx(s8[np.argmin(np.abs(ang - 30))]), at_70=hx(s8[np.argmin(np.abs(ang - 70))]), at_85=hx(s8[np.argmin(np.abs(ang - 85))]))
            print('%-52s %-8s crux %s  0deg %s 30 %s 70 %s 85 %s  chroma max %.3f mean %.3f' % (dname, names[fam], out['%s / %s' % (dname, names[fam])]['at_crux'], hx(s8[0]),
                  hx(s8[np.argmin(np.abs(ang - 30))]), hx(s8[np.argmin(np.abs(ang - 70))]), hx(s8[np.argmin(np.abs(ang - 85))]), Cc.max(), Cc.mean()))
    _, info = design_B(c, 0)
    out['P-B indices'] = dict(n_x=info['n_x'], n_z=info['n_z'], R_D_white=float(info['RZ']), d_x=float(d_for(info['n_x'])), d_z=float(d_for(info['n_z'])))
    out['P-A thickness'] = dict(mr_pearl_film_d=float(d_for(1.1638)), soap_film_d=float(d_for(1.33)))
    print(out['P-B indices'], out['P-A thickness'])
    json.dump(out, open(OUT + 'pearl_film.json', 'w'), indent=1)
    # strips
    W = 800
    img = Image.new('RGB', (W + 330, len(rows) * 52 + 40), (250, 250, 250))
    d = ImageDraw.Draw(img)
    for k, (dn, fn_, strip) in enumerate(rows):
        im = to_img(strip).resize((W, 40))
        img.paste(im, (320, 30 + k * 52))
        d.text((6, 38 + k * 52), (dn if k % 3 == 0 else '') , fill=(30, 30, 30), font=font(11))
        d.text((6, 52 + k * 52), '   face ' + fn_, fill=(30, 30, 30), font=font(12))
    xD = 320 + int(W * DRAW_ANGLE / 88)
    d.line((xD, 20, xD, img.height - 5), fill=(220, 30, 30), width=2)
    d.text((xD + 4, 4), 'the crux 54.74 deg: the drawing', fill=(200, 20, 20), font=font(12))
    for a in (0, 20, 40, 60, 80):
        x = 320 + int(W * a / 88); d.text((x, img.height - 16), '%d deg' % a, fill=(60, 60, 60), font=font(11))
    img.save(OUT + 'C1_film_angle_strips.png'); print(img.size)

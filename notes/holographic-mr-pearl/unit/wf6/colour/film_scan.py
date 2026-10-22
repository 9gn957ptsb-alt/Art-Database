"""Achromatic points of a thin film at the crux angle (54.7356 deg): the OPD at which its reflected colour has no hue.
Chroma measured as OKLab chroma of the colour scaled to a fixed luminance (hue only)."""
import json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import oklab_lin, LUMA, enc, hx
from film import film_spectral, film_shader

cD = 1 / math.sqrt(3)


def hue_chroma(rgb):
    Yv = rgb @ LUMA
    q = np.clip(rgb, 1e-12, None) / np.maximum(Yv, 1e-12)[..., None] * 0.2
    ok = oklab_lin(q)
    return np.hypot(ok[..., 1], ok[..., 2]), Yv


def cos_t(c1, nf):
    return np.sqrt(1 - (1 - c1 ** 2) / nf ** 2)


def scan(nf, ns, model, opd_max=3200, step=1.0):
    ct = cos_t(cD, nf)
    opd = np.arange(1.0, opd_max, step)
    d = opd / (2 * nf * ct)
    fn = film_shader if model == 'shader' else film_spectral
    rgb = fn(np.full(d.shape, cD), d, nf, ns)
    C, Yv = hue_chroma(rgb)
    mins = [i for i in range(1, len(d) - 1) if C[i] <= C[i - 1] and C[i] <= C[i + 1]]
    return opd, d, C, Yv, rgb, mins


if __name__ == '__main__':
    rows = []
    for ns in (1.0, 1.35, 1.5, 2.0):
        for nf in (1.16, 1.25, 1.33, 1.45, 1.6, 1.8, 2.0, 2.4):
            if abs(nf - ns) < 0.05:
                continue
            opd, d, C, Yv, rgb, mins = scan(nf, ns, 'shader')
            best = sorted([(C[i], i) for i in mins if opd[i] > 30])[:4]
            for c, i in sorted(best, key=lambda x: x[1]):
                rows.append(dict(nf=nf, ns=ns, opd=float(opd[i]), d=float(d[i]), chroma=float(c), Y=float(Yv[i])))
    rows.sort(key=lambda r: r['chroma'])
    for r in rows[:40]:
        print('nf %.2f ns %.2f  OPD %6.0f  d %6.1f nm  chroma %.4f  Y %.4f' % (r['nf'], r['ns'], r['opd'], r['d'], r['chroma'], r['Y']))
    json.dump(rows, open('film_scan.json', 'w'), indent=1)

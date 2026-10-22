"""Thin-film colour: the spectral reference (Airy summation, s+p averaged, CIE 1931 by the Wyman-Sloan-Shirley fit,
D65; copied from wf5/material/py/film.py) and a numpy port of the shader's film (wf5 pearl.glsl pearlFilm:
Belcour & Barla 2017, two orders), so that what the shader computes can be checked and its neutral points found.
Colours are linear sRGB, white-balanced so a perfect reflector is (1, 1, 1)."""
import math

import numpy as np

lam = np.arange(380.0, 781.0, 5.0)


def _g(x, mu, s1, s2):
    s = np.where(x < mu, s1, s2)
    return np.exp(-0.5 * ((x - mu) / s) ** 2)


xbar = 1.056 * _g(lam, 599.8, 37.9, 31.0) + 0.362 * _g(lam, 442.0, 16.0, 26.7) - 0.065 * _g(lam, 501.1, 20.4, 26.2)
ybar = 0.821 * _g(lam, 568.8, 46.9, 40.5) + 0.286 * _g(lam, 530.9, 16.3, 31.1)
zbar = 1.217 * _g(lam, 437.0, 11.8, 36.0) + 0.681 * _g(lam, 459.0, 26.0, 13.8)
D65 = np.array([49.98, 52.31, 54.65, 68.70, 82.75, 87.12, 91.49, 92.46, 93.43, 90.06, 86.68, 95.77, 104.86, 110.94, 117.01,
                117.41, 117.81, 116.34, 114.86, 115.39, 115.92, 112.37, 108.81, 109.08, 109.35, 108.58, 107.80, 106.30, 104.79,
                106.24, 107.69, 106.05, 104.41, 104.23, 104.05, 102.02, 100.00, 98.17, 96.33, 96.06, 95.79, 92.24, 88.69, 89.35,
                90.01, 89.80, 89.60, 88.65, 87.70, 85.49, 83.29, 83.49, 83.70, 81.86, 80.03, 80.12, 80.21, 81.25, 82.28, 80.28,
                78.28, 74.00, 69.72, 70.67, 71.61, 72.98, 74.35, 67.98, 61.60, 65.74, 69.89, 72.49, 75.09, 69.34, 63.59, 55.01,
                46.42, 56.61, 66.81, 65.09, 63.38])
CMF = np.stack([xbar, ybar, zbar], 1) * D65[:, None]
XYZ2RGB = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]])
WHITE = XYZ2RGB @ CMF.sum(0)


def spec_to_rgb(R):
    return (np.asarray(R) @ CMF) @ XYZ2RGB.T / WHITE


def airy(cos1, d_nm, n1=1.0, n2=1.33, n3=1.0):
    """Reflectance spectrum (..., nlam) of a film n2, thickness d (nm), between n1 and substrate n3."""
    cos1 = np.asarray(cos1, dtype=np.float64)[..., None]
    d_nm = np.asarray(d_nm, dtype=np.float64)[..., None]
    sin1 = np.sqrt(np.clip(1 - cos1 ** 2, 0, 1))
    sin2 = n1 * sin1 / n2
    cos2 = np.sqrt(np.clip(1 - sin2 ** 2, 0, 1))
    sin3 = n1 * sin1 / n3
    cos3 = np.sqrt((1 - sin3 ** 2).astype(complex))
    R = 0
    for pol in ('s', 'p'):
        if pol == 's':
            r12 = (n1 * cos1 - n2 * cos2) / (n1 * cos1 + n2 * cos2)
            r23 = (n2 * cos2 - n3 * cos3) / (n2 * cos2 + n3 * cos3)
        else:
            r12 = (n2 * cos1 - n1 * cos2) / (n2 * cos1 + n1 * cos2)
            r23 = (n3 * cos2 - n2 * cos3) / (n3 * cos2 + n2 * cos3)
        delta = 2 * np.pi * n2 * d_nm * cos2 / lam
        e = np.exp(2j * delta)
        r = (r12 + r23 * e) / (1 + r12 * r23 * e)
        R = R + 0.5 * np.abs(r) ** 2
    return R


def film_spectral(cos1, d_nm, nf=1.33, ns=1.0):
    return spec_to_rgb(airy(cos1, d_nm, 1.0, nf, ns))


# ---- the shader's film (pearl.glsl), in numpy ------------------------------------------------------------------------
def fresnel(ci, n1, n2):
    ci = np.asarray(ci, float)
    st2 = (n1 / n2) ** 2 * np.maximum(1 - ci * ci, 0)
    tir = st2 >= 1
    ct = np.sqrt(np.maximum(1 - st2, 0))
    rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)
    rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct)
    return np.where(tir, 1.0, 0.5 * (rs * rs + rp * rp))


def sensitivity(opd, shift):
    """Belcour & Barla 2017: the XYZ response to a cosine of optical path difference opd (nm), as linear sRGB."""
    opd = np.asarray(opd, float)[..., None]
    shift = np.asarray(shift, float)
    if shift.ndim == 0 or shift.shape[-1] != 3:
        shift = np.asarray(shift, float)[..., None] * np.ones(3)
    phase = 2 * math.pi * opd * 1e-9
    val = np.array([5.4856e-13, 4.4201e-13, 5.2481e-13])
    pos = np.array([1.6810e+06, 1.7953e+06, 2.2084e+06])
    var = np.array([4.3278e+09, 9.3046e+09, 6.6121e+09])
    xyz = val * np.sqrt(2 * math.pi * var) * np.cos(pos * phase + shift) * np.exp(-phase * phase * var)
    xyz[..., 0] = xyz[..., 0] + 9.7470e-14 * math.sqrt(2 * math.pi * 4.5282e+09) * np.cos(2.2399e+06 * phase[..., 0] + shift[..., 0]) * np.exp(-4.5282e+09 * phase[..., 0] ** 2)
    xyz = xyz / 1.0685e-7
    M = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]])
    rgb = xyz @ M.T
    return rgb / np.array([1.2049, 0.9483, 0.9088])


def film_shader(cos1, d, nf=1.33, n3=1.0):
    """numpy port of pearl.glsl pearlFilm(cos1, d) with PEARL_NF = nf, PEARL_N3 = n3."""
    cos1 = np.asarray(cos1, float)
    d = np.asarray(d, float)
    cos2 = np.sqrt(np.maximum(1 - (1 - cos1 * cos1) / (nf * nf), 0))
    R12 = fresnel(cos1, 1.0, nf)
    R23 = fresnel(cos2, nf, n3)
    T121 = 1 - R12
    phi = math.pi + (math.pi if n3 < nf else 0.0)
    opd = 2 * nf * d * cos2
    R123 = np.clip(R12 * R23, 1e-5, 0.9999)
    r123 = np.sqrt(R123)
    Rs = T121 * T121 * R23 / (1 - R123)
    I = (R12 + Rs)[..., None] * np.ones(3)
    Cm = Rs - T121
    Cm = Cm * r123
    I = I + (Cm * 2)[..., None] * sensitivity(opd, phi)
    Cm = Cm * r123
    I = I + (Cm * 2)[..., None] * sensitivity(2 * opd, 2 * phi)
    return np.maximum(I, 0)

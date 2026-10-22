"""Check pearl.glsl's pearlFilm (read back from WebGL2) against an exact Airy thin-film reflectance (s and p
amplitudes, complex sum), integrated over the visible with the Wyman-Sloan-Shirley 2013 fit of the CIE 1931
CMFs (equal-energy light, white-balanced so a flat reflectance is neutral, like the GLSL)."""
import json, numpy as np
C = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-pearl/'
R = json.load(open(C + 'gl/film.json')); N = 64
gl = np.array(R['film'], float).reshape(N, N, 4)[..., :3]   # [row=d, col=cos]
cosg = np.linspace(0.02, 1.0, N); dg = np.linspace(100, 700, N)
def g(l, m, s1, s2): s = np.where(l < m, s1, s2); return np.exp(-0.5 * ((l - m) / s) ** 2)
lam = np.arange(360, 831, 1.0)
xb = 1.056 * g(lam, 599.8, 37.9, 31.0) + 0.362 * g(lam, 442.0, 16.0, 26.7) - 0.065 * g(lam, 501.1, 20.4, 26.2)
yb = 0.821 * g(lam, 568.8, 46.9, 40.5) + 0.286 * g(lam, 530.9, 16.3, 31.1)
zb = 1.217 * g(lam, 437.0, 11.8, 36.0) + 0.681 * g(lam, 459.0, 26.0, 13.8)
CMF = np.stack([xb, yb, zb])
M = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]])
WB = M @ CMF.sum(1)
n1, n2, n3 = 1.0, 1.1638, 1.3539
def airy(c1, d):
    s1 = np.sqrt(1 - c1 ** 2); c2 = np.sqrt(1 - (s1 / n2) ** 2); c3 = np.sqrt(1 - (s1 * n1 / n3) ** 2)
    rs12 = (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2); rs23 = (n2 * c2 - n3 * c3) / (n2 * c2 + n3 * c3)
    rp12 = (n2 * c1 - n1 * c2) / (n2 * c1 + n1 * c2); rp23 = (n3 * c2 - n2 * c3) / (n3 * c2 + n2 * c3)
    delta = 4 * np.pi * n2 * d * c2 / lam
    e = np.exp(1j * delta)
    rs = (rs12 + rs23 * e) / (1 + rs12 * rs23 * e); rp = (rp12 + rp23 * e) / (1 + rp12 * rp23 * e)
    Rl = 0.5 * (abs(rs) ** 2 + abs(rp) ** 2)
    return (M @ (CMF * Rl).sum(1)) / WB
ex = np.array([[airy(c, d) for c in cosg] for d in dg])
def oklab(rgb):
    rgb = np.maximum(rgb, 0)
    l = 0.4122214708 * rgb[..., 0] + 0.5363325363 * rgb[..., 1] + 0.0514459929 * rgb[..., 2]
    m = 0.2119034982 * rgb[..., 0] + 0.6806995451 * rgb[..., 1] + 0.1073969566 * rgb[..., 2]
    s = 0.0883024619 * rgb[..., 0] + 0.2817188376 * rgb[..., 1] + 0.6299787005 * rgb[..., 2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)
# compare reflectance colours scaled so the mean reflectance is mid-grey (film colours, not magnitudes)
def norm(a): return a / a.mean(-1, keepdims=True).clip(1e-6) * 0.18
dE = np.linalg.norm(oklab(norm(gl)) - oklab(norm(ex)), axis=-1)
lum = lambda a: a @ [0.2126, 0.7152, 0.0722]
relY = np.abs(lum(gl) - lum(ex)) / lum(ex)
out = {}
for name, sel in (('all', np.ones((N, N), bool)), ('d 270-415 nm (d0 +-21%)', (dg[:, None] > 270) & (dg[:, None] < 415) & np.ones(N, bool)),
                  ('same, cos > 0.5', ((dg[:, None] > 270) & (dg[:, None] < 415)) & (cosg[None] > 0.5)),
                  ('same, cos < 0.3', ((dg[:, None] > 270) & (dg[:, None] < 415)) & (cosg[None] < 0.3))):
    out[name] = dict(chroma_dE_mean=round(float(dE[sel].mean()), 4), chroma_dE_p95=round(float(np.percentile(dE[sel], 95)), 4), relY_mean=round(float(relY[sel].mean()), 4))
i = np.argmin(abs(dg - 342)); j = -1
out['d0 at normal: glsl'] = np.round(gl[i, j], 4).tolist(); out['d0 at normal: exact'] = np.round(ex[i, j], 4).tolist()
print(json.dumps(out, indent=1)); json.dump(out, open(C + 'film_check.json', 'w'), indent=1)
# picture: GLSL vs exact, colours normalised
from PIL import Image
def show(a):
    s = norm(a) / 0.18 * 0.5; s = np.clip(s, 0, 1) ** (1 / 2.2); return (s[::-1] * 255).astype(np.uint8)
img = np.concatenate([show(gl), np.full((N, 4, 3), 255, np.uint8), show(ex)], 1)
Image.fromarray(img).resize((img.shape[1] * 6, N * 6), Image.NEAREST).save(C + 'film_glsl_vs_exact.png')

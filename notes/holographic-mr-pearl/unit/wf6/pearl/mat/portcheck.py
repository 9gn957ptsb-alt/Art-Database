"""pearl.glsl (WebGL2, swiftshader) against its numpy twin (wf5 model5 with F = 3) on the same head pixels."""
import sys, json, numpy as np
from PIL import Image
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py')
import model5 as M
from colour import lin_to_srgb
M.FIX['freq'] = 3.0; M.FIX['freq2'] = 3.0
P = json.load(open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/fit5c.json'))[0]['p']
sc = json.load(open('gl/scene_portcheck.json'))
cam = sc['cam']; head = sc['head']
W = H = 400
gl = np.asarray(Image.open('gl/portcheck.png').convert('RGB')).astype(float)
f = np.array(cam['dir'], float); up = np.array(cam['up'], float); r = np.cross(f, up); r /= np.linalg.norm(r); u = np.cross(r, f)
jj, ii = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
uvx = (jj - 0.5 * W) / H; uvy = ((H - ii) - 0.5 * H) / H          # gl_FragCoord y up
ro = np.array(cam['pos']) + (uvx[..., None] * r + uvy[..., None] * u) * cam['ortho_h']
c = np.array(head['c']); R = head['r']
oc = ro - c; b = (oc * f).sum(-1); cc = (oc * oc).sum(-1) - R * R; disc = b * b - cc
hit = disc > 0
t = -b - np.sqrt(np.where(hit, disc, 0))
p = ro + t[..., None] * f
n = (p - c) / R
sel = hit & ((n * -f).sum(-1) > 0.08)      # leave out the grazing limb (antialiasing / normal precision)
nw = n[sel]
nv = np.c_[nw @ r, nw @ u, nw @ -f]
v = np.tile([0, 0, 1.0], (len(nv), 1))
z1, z2 = M.noise_fields(nw, M.FIX, real=0)
lin = M.shade(P, nv, v, z1, z2)
# the painted eyes, as in the page
q = nw
eye = np.zeros(len(q))
for e in head['eyes']:
    e = np.array(e, float); e /= np.linalg.norm(e)
    upv = np.array([0, 0, 1.0]) - e * e[2]; upv /= np.linalg.norm(upv); side = np.cross(upv, e)
    x = (q @ side) / head['hw']; y = (q @ upv) / head['hh']; k = x * x + y * y
    m = np.where((q @ e) > 0, 1 - np.clip((k - 0.92) / 0.08, 0, 1) ** 2 * (3 - 2 * np.clip((k - 0.92) / 0.08, 0, 1)), 0)
    eye = np.maximum(eye, m)
srgb = np.clip(lin_to_srgb(np.clip(lin, 0, 1)), 0, 1) * 255
g = gl[sel]
ok = eye < 0.01
d = np.abs(srgb[ok] - g[ok])
print('pixels compared %d (eyes excluded)  mean |d| %.2f /255  p99 %.1f  max %.1f' % (ok.sum(), d.mean(), np.percentile(d, 99), d.max()))
json.dump(dict(n=int(ok.sum()), mean=float(d.mean()), p99=float(np.percentile(d, 99)), max=float(d.max())), open('mat/portcheck.json', 'w'))
img = np.zeros((H, W, 3)); img[sel] = srgb
diff = np.zeros((H, W)); dd = np.zeros(len(g)); dd[ok] = np.abs(srgb[ok] - g[ok]).max(1); diff[sel] = dd
Image.fromarray(np.concatenate([gl.astype(np.uint8), img.astype(np.uint8), np.repeat(np.clip(diff * 8, 0, 255).astype(np.uint8)[..., None], 3, 2)], 1)).save('mat/portcheck.png')

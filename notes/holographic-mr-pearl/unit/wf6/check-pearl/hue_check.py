"""His head's hues: the numpy twin of pearlCovers() (render.render_pearl) at each cover's head scale and face yaw,
against the cover's head pixels (inside the fitted circle, not hat, not eye). OKLab statistics + hue histogram."""
import sys, os, json, numpy as np
P = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl'
C = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-pearl/'
U = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/'
sys.path.insert(0, P); os.chdir(P)
import pmodel as M, views
from render import ortho_camera, trace, render_pearl
from fit import load_params
from PIL import Image
def s2l(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def oklab(rgb):
    l = 0.4122214708 * rgb[..., 0] + 0.5363325363 * rgb[..., 1] + 0.0514459929 * rgb[..., 2]
    m = 0.2119034982 * rgb[..., 0] + 0.6806995451 * rgb[..., 1] + 0.1073969566 * rgb[..., 2]
    s = 0.0883024619 * rgb[..., 0] + 0.2817188376 * rgb[..., 1] + 0.6299787005 * rgb[..., 2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)
def stats(lab):
    L, a, b = lab.T; Cc = np.hypot(a, b); h = np.degrees(np.arctan2(b, a)) % 360
    hist = np.histogram(h, bins=12, range=(0, 360), weights=Cc)[0]; hist = hist / hist.sum()
    return dict(L_mean=round(float(L.mean()), 3), L_sd=round(float(L.std()), 3), C_mean=round(float(Cc.mean()), 4),
                C_p90=round(float(np.percentile(Cc, 90)), 4), a_mean=round(float(a.mean()), 4), b_mean=round(float(b.mean()), 4)), hist
bases = json.load(open(os.path.join(P, 'bases.json')))
bases = bases.get('bases_linear', bases)
out = {}
p = load_params()
for name, yaw, (cx, cy, r) in (('pearl-1', 50.0, (581.2, 486.6, 120.5)), ('pearl-2', 45.0, (596.4, 466.3, 139.4))):
    q = dict(p); q['FACE_YAW'] = yaw
    pm, head, info = views.model_m(q)
    keep = [x for x in pm if x['group'] in ('pearl', 'hat', 'band')]
    S = r / head['r']
    u0, v0, u1, v1 = int(cx - 1.7 * r), int(cy - 1.5 * r), int(cx + 1.7 * r), int(cy + 1.2 * r)
    hc = np.array(head['c'])
    cam = ortho_camera((0, 1, 0), (0, 0, 1), S, u1 - u0, v1 - v0, hc, (cx - u0, cy - v0))
    tr = trace(keep, cam)
    img, pid, dep = render_pearl(keep, cam, head, bases, trace_out=tr)
    hid = [i for i, x in enumerate(keep) if x['part'] == 'head'][0]
    ref = np.asarray(Image.open(U + name + '.png').convert('RGB')).astype(float)[v0:v1, u0:u1] / 255
    jj, ii = np.meshgrid(np.arange(u1 - u0) + u0 + 0.5, np.arange(v1 - v0) + v0 + 0.5)
    inc = np.hypot(jj - cx, ii - cy) < r - 4
    mod = img.astype(float) / 255
    Lr = oklab(s2l(ref))[..., 0]; Lm = oklab(s2l(mod))[..., 0]
    mask = inc & (pid == hid) & (Lr > 0.45) & (Lm > 0.45)
    sr, hr_ = stats(oklab(s2l(ref[mask]))); sm, hm = stats(oklab(s2l(mod[mask])))
    corr = float(np.corrcoef(hr_, hm)[0, 1])
    out[name] = dict(pixels=int(mask.sum()), cover=sr, model=sm, hue_hist_corr=round(corr, 3),
                     hue_hist_cover=np.round(hr_, 3).tolist(), hue_hist_model=np.round(hm, 3).tolist(),
                     mean_dE=round(float(np.linalg.norm(np.median(oklab(s2l(ref[mask])), 0) - np.median(oklab(s2l(mod[mask])), 0))), 4))
    pair = np.concatenate([(ref * 255).astype(np.uint8), np.full((v1 - v0, 6, 3), 255, np.uint8), img], 1)
    Image.fromarray(pair).save(C + 'hue_pair_%s.png' % name)
print(json.dumps(out, indent=1)); json.dump(out, open(C + 'hue_check.json', 'w'), indent=1)

"""Test (a) on the finished curved reconstruction (wf6/reconstruct V3, smootherstep): tone each pixel by the normal
it sees under identity (its bar face's family), SQ (n_i^2), L1 (|n_i|), VS (max(0, n_i v_i)), from the drawing's eye
and turned; compare with the vector original (drawing view) and, turned, report how much each rule re-tones."""
import sys, json, math
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/reconstruct')
import numpy as np
from caster import *
from PIL import Image, ImageDraw
ME = SCR + 'wf6/check-colour/v3_'
LEV = np.array([128.0, 0.0, 255.0])           # x grey, y black, z white
TLEV = {-1: np.nan, 0: 128.0, 1: 0.0, 2: 255.0}

def rule(name, n, v, tone):
    if name == 'identity':
        return np.vectorize(lambda t: TLEV.get(int(t), np.nan))(tone)
    if name == 'SQ': w = n ** 2
    elif name == 'L1': w = np.abs(n)
    elif name == 'VS':
        w = np.maximum(n * v, 0)
    s = w.sum(-1, keepdims=True)
    out = (w / np.maximum(s, 1e-12)) @ LEV
    return np.where(tone >= 0, out, np.nan)

prims = build('V3', kind='smootherstep')[0]
res = {}
R = drawing_view(prims)
vec = np.load(OUT + 'vec_tone.npy')
vecL = np.vectorize(lambda t: TLEV.get(int(t), np.nan))(vec)
v = -D
imgs = {}
for nm in ['identity', 'SQ', 'L1', 'VS']:
    L = rule(nm, R['n'], v, R['tone'])
    both = ~np.isnan(L) & ~np.isnan(vecL)
    d = np.abs(L - vecL)[both]
    res['drawing/' + nm] = dict(mae=round(float(d.mean()), 3), px_off_gt8=int((d > 8).sum()), px=int(both.sum()),
                                px_off_vs_identity=int((np.abs(L - rule('identity', R['n'], v, R['tone']))[both] > 0.5).sum()))
    imgs['drawing/' + nm] = L
# off-axis normals seen from the drawing's eye: how many pixels, and which side of the eye they turn
off = (R['tone'] >= 0) & (np.abs(R['n']).max(-1) < 0.999)
res['drawing/off_axis_px'] = int(off.sum())
nv = R['n'][off] * v
res['drawing/off_axis_gain_toward_eye_px'] = int(((nv > 1e-9).sum(-1) > 1).sum())
for deg in [20, 45, 90, 180]:
    Rt, (dd, uu, rr) = turned(prims, deg, size=520, span=3.6)
    vv = -dd
    base = rule('identity', Rt['n'], vv, Rt['tone'])
    m = ~np.isnan(base)
    for nm in ['SQ', 'L1', 'VS']:
        L = rule(nm, Rt['n'], vv, Rt['tone'])
        dl = np.abs(L - base)[m]
        res['turned%d/%s' % (deg, nm)] = dict(mean_change=round(float(dl.mean()), 2), px_changed_gt8=int((dl > 8).sum()), px=int(m.sum()))
        imgs['turned%d/%s' % (deg, nm)] = L
    imgs['turned%d/identity' % deg] = base
json.dump(res, open(ME + 'tone_V3.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
# sheet: rows drawing / turned 45 / turned 180; columns identity SQ VS
def tile(L, title, size=None):
    a = np.where(np.isnan(L), 255, L).astype(np.uint8)
    im = Image.fromarray(np.stack([a] * 3, -1))
    if np.isnan(L).any():
        g = np.isnan(L); arr = np.array(im); arr[g] = (236, 239, 242); im = Image.fromarray(arr)
    if size: im = im.resize(size, Image.LANCZOS)
    dr = ImageDraw.Draw(im); dr.rectangle([4, 4, 8 + 7 * len(title), 22], fill='white'); dr.text((8, 7), title, fill='black')
    return im
rows = []
for key, sz in [('drawing', (600, 315)), ('turned45', (315, 315)), ('turned180', (315, 315))]:
    rows.append([tile(imgs['%s/%s' % (key, nm)], '%s: %s' % (key, nm), sz) for nm in ['identity', 'SQ', 'VS']])
W = max(sum(t.width for t in r) for r in rows); Hh = sum(r[0].height for r in rows)
sheet = Image.new('RGB', (W, Hh), 'white'); y = 0
for r in rows:
    x = 0
    for t in r: sheet.paste(t, (x, y)); x += t.width
    y += r[0].height
sheet.save(ME + 'A3_tone_rule_on_V3.png')

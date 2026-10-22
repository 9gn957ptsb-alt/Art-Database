"""alternative: V3 with the bend on sigma in [2H, 1-2H] (outside the node cubes) and a 90-degree arc profile rho=H"""
import sys; sys.path.insert(0, S_REC := '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/reconstruct/')
import geom
from render import *
ME = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-reconstruct/'
SPAN = 1 - 4 * H; TH = math.pi / 2; RH = H; LS = math.sqrt(2) / 3 - 2 * H
def path(npt=30001):
    n1 = npt // 3; ph = np.linspace(0, TH, n1)
    a1 = RH * np.sin(ph); l1 = RH * (1 - np.cos(ph)); tt = np.linspace(0, 1, n1)[1:]
    a2 = a1[-1] + LS * math.cos(TH) * tt; l2 = l1[-1] + LS * math.sin(TH) * tt
    a3 = 2 * H - a1[::-1][1:]; l3 = math.sqrt(2) / 3 - l1[::-1][1:]
    a = np.concatenate([a1, a2, a3]); l = np.concatenate([l1, l2, l3]); Y = l / math.sqrt(2); X = a + Y
    return X, Y, a, l
PX, PY, Pa, Pl = path()
print('end', PX[-1], PY[-1], 'monotone', (np.diff(PX) > 0).all(), 'min dX/ds', (np.diff(PX) / np.hypot(np.diff(Pa), np.diff(Pl))).min())
_old = geom.smooth
def smooth(t, kind='smoothstep'):
    if kind == 'arcs90':
        return np.interp(np.clip(t, 0, 1), PX / SPAN, PY * 3)
    return _old(t, kind)
geom.smooth = smooth
SP = (2 * H, 1 - 2 * H)
prims = build('V3', kind='arcs90', n=96, span=SP)[0]
vt = np.load(S_REC + 'vec_tone.npy')
R = drawing_view(prims); out = {}
out['px_differing_from_vector_reading'] = int((R['tone'] != vt).sum())
out['mismatch'] = mismatch(R['tone'])[0]
print(out, flush=True)
f = dict(FIT); f['s'] *= 3; f['cx'] = f['cx'] * 3 + 1; f['cy'] = f['cy'] * 3 + 1
Ta = drawing_view(prims, (1890, 3600), f)['tone']; Tc = drawing_view(build_cut(), (1890, 3600), f)['tone']
out['supersampled_3x3_vs_cut_differing'] = int((Ta != Tc).sum()); out['samples'] = int(Ta.size)
d3 = np.argwhere(Ta != Tc); out['ss_diff_where_first'] = d3[:10].tolist()
print(out, flush=True)
# collisions
by = {}
for p in prims: by.setdefault(NAMES[p.beam], []).append(p)
rng = np.random.default_rng(1); hits = 0
for b, ps in by.items():
    pts = np.concatenate([np.concatenate([rng.dirichlet(np.ones(8), 60) @ p.corners, p.corners]) for p in ps[1:-1]])
    for qq in prims:
        if NAMES[qq.beam] == b: continue
        dep = (pts @ qq.N.T - qq.w[None]).max(1); hits += int((dep < -1e-6).sum())
out['collision_samples'] = hits
tang = np.degrees(np.arctan2(np.gradient(Pl), np.gradient(Pa)))
out['max_bend_deg'] = float(tang.max()); out['min_radius'] = RH; out['straight_run'] = LS
out['thickness_ratio_min'] = float(min(math.cos(x) + math.sin(x) / math.sqrt(2) for x in np.linspace(0, TH, 1000)))
json.dump(out, open(ME + 'alt90.json', 'w'), indent=1); print(out)
views = [('turned_20', 20, False), ('turned_45', 45, False), ('turned_90', 90, False), ('from_below', 75, True)]
SZ = 440; base = build('V3', kind='arcs', n=96)[0]
sheet = Image.new('RGB', (SZ * len(views), SZ * 2), 'white')
for i, (vn, pr) in enumerate([('their V3 arcs, span [3H,1-3H], 109.5 deg', base), ('alt: span [2H,1-2H], 90 deg arcs rho=H', prims)]):
    for j, (title, deg, below) in enumerate(views):
        RR, _ = turned(pr, deg, size=SZ, span=3.6, below=below)
        sheet.paste(label(picture(RR, 'identity'), '%s | %s' % (title, vn), 12), (j * SZ, i * SZ))
sheet.save(ME + 'alt90_vs_arcs_sheet.png')

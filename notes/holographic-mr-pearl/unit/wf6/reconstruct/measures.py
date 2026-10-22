from render import *
KIND = 'smootherstep'
L = 1 - 6 * H
out = {}
def curve_metrics(s, kind=KIND, n=40001):
    t = np.linspace(0, 1, n); sg = 3 * H + L * t
    f = s * smooth(t, kind)
    X = sg - f; Y = -math.sqrt(2) * f
    dX = np.gradient(X, sg); dY = np.gradient(Y, sg); ddX = np.gradient(dX, sg); ddY = np.gradient(dY, sg)
    kap = np.abs(dX * ddY - dY * ddX) / (dX ** 2 + dY ** 2) ** 1.5
    ang = np.degrees(np.arctan2(-dY, dX))
    arc = float(np.sum(np.hypot(np.diff(X), np.diff(Y))))
    depth = (sg - 3 * f) / math.sqrt(3)       # centreline depth change from the start node, towards the eye
    return dict(max_bend_deg=round(float(ang.max()), 2), max_fprime=round(float(s * dsmooth(t, kind).max() / L), 4),
                min_radius=round(float(1 / kap[100:-100].max()), 4), bend_arc=round(arc, 4),
                beam_centreline_node_to_node=round(arc + 6 * H, 4), curved_fraction_of_centreline=round(arc / (arc + 6 * H), 4),
                curved_fraction_of_drawn_length=round(L, 4), chord=round(float(math.hypot(X[-1] - X[0], Y[-1] - Y[0])), 4),
                chord_angle_to_axis_deg=round(float(np.degrees(np.arctan2(-(Y[-1] - Y[0]), X[-1] - X[0]))), 2),
                depth_peak_above_nodes=round(float(depth.max()), 4), depth_min=round(float(depth.min()), 4))
out['V3_each_of_9_beams'] = curve_metrics(1 / 3)
out['V1_each_of_Az_By_Cy'] = curve_metrics(1.0)
# whole-form fractions (node-to-node centreline length over the 9 beams)
v3 = out['V3_each_of_9_beams']; v1 = out['V1_each_of_Az_By_Cy']
out['V3_curved_fraction_of_all_centreline'] = v3['curved_fraction_of_centreline']
tot1 = 3 * v1['beam_centreline_node_to_node'] + 6 * 1.0
out['V1_curved_fraction_of_all_centreline'] = round(3 * v1['bend_arc'] / tot1, 4)
# gaps between ends that should meet: centreline end points at the three drawn meetings
_, nodes = nodes_V3()
gaps = {}
def endpt(P, k, s): return np.array(P, float) + E[k] - s * M3
st3, _ = nodes_V3()
for var, st, S in [('V3', st3, {n: 1 / 3 for n in NAMES}), ('V1', {n: np.array(P, float) for n, k, P, b in BEAMS}, {n: (1.0 if n in ('Az', 'By', 'Cy') else 0) for n in NAMES})]:
    K = {n: k for n, k, P, b in BEAMS}
    pairs = [('Az', 'Ay', 'top corner'), ('By', 'Bx', 'bottom-right corner'), ('Cy', 'Bz', 'bottom-middle'), ('Cx', 'Cz', 'bottom-left corner'),
             ('Ax', 'Cy', 'left-middle'), ('Bz', 'By', 'right-middle')]
    gaps[var] = {w: float(np.linalg.norm(endpt(st[a], K[a], S[a]) - st[b])) for a, b, w in pairs}
# drawn reading: centreline ends of the cut beams vs the partner's start
cutend = {'Az': np.array([1, 1, 1 - 2 * H]), 'By': np.array([0, 2 - 2 * H, 0]), 'Cy': np.array([1, 2 - 2 * H, 0])}
part = {'Az': np.zeros(3), 'By': np.array([-1, 1, -1.0]), 'Cy': np.array([0, 1, -1.0])}
gaps['cut'] = {nm: float(np.linalg.norm(cutend[nm] - part[nm])) for nm in cutend}
gaps['cut_note'] = 'centreline end of the cut beam (where the cut plane crosses its centreline) to the start of the bar it should meet; the straight ends themselves are sqrt3 = 1.732 apart along the line of sight'
out['gaps'] = gaps
out['max_gap_V3'] = max(gaps['V3'].values()); out['max_gap_V1'] = max(gaps['V1'].values()); out['max_gap_cut'] = max(gaps['cut'].values())
# tone rules in the drawing view
prims = build('V3', kind=KIND)[0]
R = drawing_view(prims)
fig = R['tone'] >= 0
snap = snap_tone(R['n'], R['tone'])
mix = mix_tone(R['n'], R['tone'])
ident = np.vectorize(TONE_RGB.get)(R['tone']).astype(float)
cls_of = lambda v: np.array([0, 128, 255])[np.abs(v[..., None] - np.array([0, 128, 255])).argmin(-1)]
tone_val = {0: 128, 1: 0, 2: 255}
out['tone_rules_drawing_view'] = dict(
    identity_px_changed=0,
    nearest_axis_px_changed=int((snap != R['tone'])[fig].sum()),
    nearest_axis_pct_of_figure=round(100 * float((snap != R['tone'])[fig].mean()), 2),
    middle_mix_mean_abs_change_on_figure=round(float(np.abs(mix - ident)[fig].mean()), 2),
    middle_mix_px_whose_nearest_tone_changes=int((cls_of(mix) != cls_of(ident))[fig].sum()),
    middle_mix_pct=round(100 * float((cls_of(mix) != cls_of(ident))[fig].mean()), 2))
# depth extent of the whole form along the line of sight
P = np.concatenate([p.corners for p in prims])
dd = (P - C) @ NH
out['V3_depth_extent_along_sight'] = [round(float(dd.min()), 4), round(float(dd.max()), 4)]
Pst = np.concatenate([p.corners for p in build('straight')[0]]); d0 = (Pst - C) @ NH
out['straight_depth_extent_along_sight'] = [round(float(d0.min()), 4), round(float(d0.max()), 4)]
out['V3_bbox'] = [P.min(0).round(4).tolist(), P.max(0).round(4).tolist()]
for kk, vv in json.load(open(OUT + 'mismatch_first.json')).items(): out['mismatch_' + kk] = vv
out['supersampled_3x3'] = json.load(open(OUT + 'ss_check.json'))
out['symmetry'] = json.load(open(OUT + 'symcheck.json'))
json.dump(out, open(OUT + 'numbers.json', 'w'), indent=1, default=float)
print(json.dumps(out, indent=1, default=float))

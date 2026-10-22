"""form.json: the closed curved form (V3, arc-straight-arc bends) with every property stated as its relation"""
import sys; sys.path.insert(0, '.')
from geom import *
r6 = lambda v: [round(float(x), 10) for x in v]
st, nodes = nodes_V3()
X, Y, a_, l_ = arc_path(3001)
idx = np.linspace(0, len(X) - 1, 97).round().astype(int)
beams = []
prims, recs = build('V3', kind='arcs', n=96)
by = {}
for p in prims: by.setdefault(NAMES[p.beam], []).append(p)
for nm, k, P0, bar in BEAMS:
    i, j = others(k); P = st[nm]; S0 = P + 3 * H * E[k]
    wl = -(E[i] + E[j]) / math.sqrt(2)
    bend = [S0 + a_[q] * E[k] + l_[q] * wl for q in idx]
    S1 = P + (1 - 3 * H) * E[k] - M3 / 3
    end = P + E[k] - M3 / 3
    cl = [P - H * E[k], P] + bend + [end, end + H * E[k]]
    beams.append(dict(
        name=nm, bar=bar, axis=AX[k], start_node=r6(P), end_node=r6(end),
        centreline=[r6(c) for c in cl],
        centreline_note='P-H e_k, P (node), 97 points of the bend from P+3H e_k to P+(1-3H)e_k-m/3, the end node, end+H e_k; straight between',
        section=dict(kind='the constant-sigma slice, swept by TRANSLATION (frame never turns)',
                     corner_rule='corner(a,b) = c + a*(e_%s + e_%s/2) + b*(e_%s + e_%s/2), a,b in {-H,+H}, c the centreline point' % (AX[i], AX[k], AX[j], AX[k]),
                     edge_a=r6(E[i] + E[k] / 2), edge_b=r6(E[j] + E[k] / 2),
                     face_tones={'faces swept from the edges a=+-H': '%s -> %s' % (AX[i], ['grey', 'black', 'white'][i]),
                                 'faces swept from the edges b=+-H': '%s -> %s' % (AX[j], ['grey', 'black', 'white'][j]),
                                 'end caps (t=-H, t=1+H, inside the node cubes, never seen)': '%s -> %s' % (AX[k], ['grey', 'black', 'white'][k])}),
        bend=dict(span_start=r6(S0), span_end=r6(S1), chord=r6(S1 - S0),
                  arc1=dict(centre=r6(S0 - (E[i] + E[j]) / 24), radius=RHO, turn_deg=math.degrees(THETA), plane_normal=r6((E[i] - E[j]) / math.sqrt(2))),
                  straight=dict(start=r6(S0 + RHO * math.sin(THETA) * E[k] + RHO * (1 - math.cos(THETA)) * wl), direction=r6(-(E[k] + 2 * E[i] + 2 * E[j]) / 3), length=LSTR),
                  arc2=dict(centre=r6(S0 - 7 * (E[i] + E[j]) / 24), radius=RHO, turn_deg=math.degrees(THETA), sense='back to +e_%s' % AX[k])),
        hexes=[[r6(c) for c in p.corners] for p in by[nm]]))
form = dict(
    name='The figure, closed and curved (V3, arc-straight-arc bends)',
    units='model units: one tribar side = one lattice edge = 1; H = 1/9 half-width',
    view=dict(d=r6(D), u=r6(U), r=r6(RV), centre=r6(C), fit_px=FIT, note='orthographic; a=(p-C).r, b=(p-C).u; the original is stretched by k along u'),
    H=H, m='(1,1,1): the sight line (towards the eye); every slide is along -m',
    nodes={k: r6(v) for k, v in nodes.items()},
    bars={'right': ['Ay', 'By'], 'bottom': ['Bx', 'Cx'], 'left': ['Cz', 'Az'], 'middle': ['Ax'], 'inner_left': ['Cy'], 'inner_right': ['Bz']},
    relations=[
        'every beam = e_axis - m/3 (lies in the picture plane): every loop of the graph has one beam per axis per 3, so it closes; all 6 nodes at depth -1/sqrt3 from C',
        'slide field is a function of sigma = q_k - (q_i+q_j)/2 only (drawing-invariant), so each sight line through a beam moves rigidly: the drawing never changes, only what hides what',
        'the bend lives on sigma in [3H, 1-3H] (length 1-6H = 1/3 = the hole side), the only span where no other beam overlaps in the drawing',
        'bend = arc rho=sqrt2/24 turning arccos(-1/3), straight 1/3 along -(e_k+2e_i+2e_j)/3, arc back: chord sqrt2/3 perpendicular to the axis, straight = free span => tan(theta/2) = sqrt2; in sigma each piece covers exactly H',
        'R3: p -> M(p-C)+C with x->z->y->x maps the form onto itself (grey->white->black->grey)',
        'tone: each swept face keeps the tone of the section edge it is swept from (colour study unit.glsl rule); straight faces face their axis'],
    alternative_profile=dict(name='quintic (smootherstep), C2', slide_sigma='s(sigma) = (1/3) * smootherstep((sigma-3H)/(1-6H)), centreline = node + sigma e_k - s m', max_bend_deg=108.26, min_radius=0.026),
    beams=beams)
json.dump(form, open(OUT + 'form.json', 'w'), indent=None, separators=(',', ':'))
# self-check: rebuild hex corners from centreline+section rule at the bend points and compare
err = 0
for b in form['beams']:
    k = AX.index(b['axis']); i, j = others(k)
    cl = np.array(b['centreline'])
    for c in cl[2:-2]:
        for aa in (-H, H):
            for bb in (-H, H):
                pt = c + aa * (E[i] + E[k] / 2) + bb * (E[j] + E[k] / 2)
                hx = np.array(b['hexes']).reshape(-1, 3)
                err = max(err, np.abs(hx - pt).sum(1).min())
print('max corner rebuilt-vs-hex (bend samples vs 96-slice hexes, sampling only):', err)
import os; print(os.path.getsize(OUT + 'form.json'))

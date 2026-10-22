"""Writes levels.json: the rule and the geometry another agent can build from."""
import json, math, collections, numpy as np
import nest as N, ladder as LD, q_rules as Q
PHI = LD.PHI; L = N.LL
LD.RECORDS = True
def lv(m):
    d = LD.lengths(m); d.update(level=m, corner_ratio=LD.F(m + 3) / LD.F(m + 4), corner_ratio_minus_inv_phi_pct=round(100 * (LD.F(m + 3) / LD.F(m + 4) * PHI - 1), 4),
                                hole_over_outline=LD.F(m) / LD.F(m + 4), leaf_scale_of_drawing=LD.F(m + 4) / 8, outline_blocks_drawn=LD.F(m + 4) / 8)
    return d
qa = json.load(open('q_a3.json')); qh = json.load(open('q_holes.json')); sweep = json.load(open('q_a5_sweep.json'))
ql = json.load(open('q_ladder.json')); qc = json.load(open('q_ladder_closure.json')); qr = json.load(open('q_rules3.json'))
tree = json.load(open('r_tree3.json'))
planet = {}
for det in (False, True):
    lay = LD.layout(Q.planet(det)); c = collections.defaultdict(collections.Counter)
    for f in lay['frames']: c[f.kind][f.m] += 1
    planet['with_details' if det else 'works_only'] = dict(K=lay['K'], outline_u=LD.F(lay['K'] + 4), outline_blocks=round(LD.F(lay['K'] + 4) / 8, 2),
        leaves=len(lay['leaves']), joins=lay['joins'], openings_used=lay['openings_used'],
        levels_by_kind={k: {str(m): n for m, n in sorted(v.items(), reverse=True)} for k, v in c.items()},
        cities=[dict(key=f.info['key'], level=f.m, path=f.path, ab=[round(float(x), 4) for x in f.ab]) for f in sorted([f for f in lay['frames'] if f.kind == 'city'], key=lambda f: (-f.m, f.path))])
out = {
 'name': 'levels: the Fibonacci ladder of the figure of figures (wf6/levels, run 2, 16 Oct 2026)',
 'conventions': dict(view='orthographic along d = -(1,1,1)/sqrt3, up u = (0,-1,1)/sqrt2, right r = (-2,1,1)/sqrt6',
     CENTRE=[1/3, 1, -1/3], drawing_coords='a = (p-CENTRE).r, b = (p-CENTRE).u (block units)', L=L, u='L/3 (a third of a block edge as drawn) = %.6f' % (L / 3),
     tones='a face is toned by the axis its normal is along: x grey #808080, y black, z white', fibonacci='F(1)=F(2)=1, F(n)=F(n-1)+F(n-2)'),
 'leaf': dict(what='the original drawing exactly: H = 1/9 (bar half-width, blocks), lengths hole 1, growth 2, side 3, tribar 5, outline 8 (in u)',
     is_level=2, size='one block (the game block, 1 m); the smallest leaf of a world is level 2',
     verified=dict(holes_side_u=[h['side_u'] for h in ql['drawing_in_u']['holes']], tribar_centre_separation_u=ql['drawing_in_u']['tribar_separation_u'],
                   outline_envelope_u=8, outline_horizontal_extent_u=ql['drawing_in_u']['outline_side'],
                   note='the outline triangle (8 u) has its corners cut by the bar ends; horizontal extent 22/3 u'),
     render_unit='woven unit at H=1/9 (wf1/design-nesting/weave_test.woven(1/9, slices)); 2.333% wrong vs cls (lattice floor 2.098%)'),
 'ladder': dict(
     level_m_lengths_u='hole F(m), growth F(m+1), side F(m+2), tribar F(m+3), outline F(m+4)',
     levels=[lv(m) for m in range(-1, 17)],
     corner_relation='a level-m frame holds three level-(m-1) frames centred at ab + sigma*(F(m+2)/3)*TRI_k, k = A, B, C (sigma = -1 in an inverted frame); their outlines are its tribar outlines, they overlap pairwise in triangles of side F(m+1), their common opening is its hole F(m)',
     opening_relation='a level-m frame hole (side F(m)) is exactly the outline of a level-(m-4) frame, point-reflected (M = -I: on the lattice, tones by axis kept)',
     TRI={k: [float(x) for x in N.TRI[k]] for k in 'ABC'}, TRI_note='in block units for a level-2 frame (centroids of the corner tribars; |TRI_A - TRI_B| = L)',
     JOINTS={'AB': [float(x) for x in N._rm], 'BC': [float(x) for x in N._bm], 'CA': [float(x) for x in N._lm]},
     leaf_in_frame='a leaf in a level-m frame is the drawing scaled by s = F(m+4)/8, about CENTRE: p -> s M (p - CENTRE) + c + depth(1,1,1), c = CENTRE + a r + b u',
     depth_tilt=dict(kappa=1 / (3 * L), rule='each corner step adds a tilt about the parent centre c_j: depth += kappa * ((a,b) - ab(c_j)) . v_k along (1,1,1) (never changes the drawing); v_k = unit vector from the joint where sibling k lies under to the joint where it lies over (A over B at AB, B over C at BC, C over A at CA: the drawing\'s own cyclic order)',
                     v={k: [float(x) for x in N.tilt_dir(k)] for k in 'ABC'}, inverted_frames='v unchanged (the true point reflection of the order)'),
     limit='F(m+3)/F(m+4) -> 1/phi (5/8, 8/13, 13/21, 21/34: 1.127%, -0.429%, 0.164%, -0.063% off); hole/outline -> phi^-4'),
 'rule_D': dict(
     weight='how many details a thing holds (a leaf weighs 1; a record weighs 1)',
     record='every node with two or more parts has its own record, a leaf standing for the thing itself (its name, its picture)',
     steps=['1. One part: it fills its parent\'s frame (one frame answers for both).',
            '2. Odd count of parts: the node\'s record goes into its frame\'s opening (level m-4, inverted): the figure\'s centre is the thing itself.',
            '3. Even count: the record is one more part, so the corners always take an odd count.',
            '4. The (odd) parts are joined three at a time, the three lightest first (ties: the node\'s own order); each join is a figure of three, heaviest at A (top), then B (bottom-right), C (bottom-left); the last join fills the frame. A join\'s own opening stays open.',
            '5. Corner = one level down (F(m+3)/F(m+4) ~ 1/phi in length); opening = four levels down.',
            '6. The root\'s level K is the least that makes the smallest leaf level 2 (every leaf at least one block, drawn as the drawing).',
            '7. Same information -> same world: the result depends only on the parts, their weights and their order in the files.'],
     code='ladder.py: layout(root) with RECORDS = True; Fr.corner, Fr.opening, Fr.copy (3D placement)'),
 'answers': {
  'a_thirds_vs_golden': dict(fibonacci_check='lengths hole 1-6H, growth 6H, side 1, tribar 1+6H, figure 2+6H (L): each the sum of the two before for any H; geometric in phi iff 36H^2+6H-1=0 iff 6H=1/phi; at H=1/9 = 1,2,3,5,8 thirds. 6H=2/3 is the 3rd convergent of 1/phi.',
     wrong_vs_cls_pct=dict(thirds=qa['thirds']['pct'], golden=qa['golden']['pct']), wrong_vs_cls_clean_pct=dict(thirds=qa['thirds']['vs_cls_clean']['pct'], golden=qa['golden']['vs_cls_clean']['pct']),
     lines_moved_px=qa['edge_offsets_px'], hole_area_px=dict(original_mean=qh['measured_mean_area'], thirds_predicted=qh['thirds']['predicted_area_with_half_px_stroke'], golden_predicted=qh['golden']['predicted_area_with_half_px_stroke']),
     sweep_pct={str(round(s['H'], 4)): s['pct'] for s in sweep},
     choice='the drawing\'s own thirds at the leaf, Fibonacci between levels (the golden ratio in integers, exact in every relation; converging to phi). Rejected: the golden bar 6H=1/phi (3.9 points further from the original, holes 15% wider in side, irrational lengths off the block grid); the drawing with exactly phi between scales (phi^-4 copies overflow its holes by 16.7%, phi^-1 corner copies fall 1.1% short of its tribar outlines).'),
  'b_holding_copies': dict(corners='three level-(m-1) copies at the corners: outlines = the tribars; joints layered cyclically (A over B over C over A) by the tilt kappa = 1/(3L)',
     openings=ql['openings'], openings_summary='opening copies: 0 px outside the hole, 0 px over any corner leaf, the hole covered but its three corners (2.1%: the copy\'s own cut corners)',
     composite=ql['composite'], along_bars='no copy fits a bar: a copy\'s height over the bar width is 2.43, 1.5, 0.93 at phi^-2..-4 (q_b ALONG): copies go at corners and in openings, not along bars',
     closure=qc['closure'], closure_summary='drawing view 0 at every level; turned ortho gap/own size identical at every level (0.151 at 5 deg, 0.595 at 20, 1.259 at 45); the whole nest drawn in toward one eye (one projective map) closes exactly at every level, and opens together when the eye moves'),
  'c_how_many': dict(per_frame='3 corners + 1 opening (the record); by joins any count: n odd parts take (n-1)/2 joins, depth ~ log3 n', comparison_of_rules=qr,
     closing='the game closes a facade into its mean between bar 8 px and 4 px (a factor 2 = phi^1.44): about 1.44 levels are in transition at any distance; moving phi nearer reveals one level'),
  'd_level_units': dict(every_level_unit='the same figure: a leaf is the drawing; a node is a figure of three (its parts\' figures) round its opening (its own record)',
     scale='set by weight, not by kind: a thing holding w of its parent\'s W details sits ~log_phi(W/w)/2 levels below it',
     toy_uniform='planet 8 (outline F12=144 u = 18 blocks), city 7, place 6, work 5, details 3-4, records 2-4',
     artist_planet=planet)},
 'toy_tree_frames': tree,
 'files': dict(code=['ladder.py', 'nest.py', 'lv.py', 'drawing2d.py', 'info.py'], checks=['q_ladder.json', 'q_ladder_closure.json', 'q_rules3.json', 'q_a3.json', 'q_holes.json', 'q_on.json'],
     renders=['ladder_drawing.png', 'ladder_joints.png', 'ladder_views.png', 'tree3_details_levels.png', 'tree3_works_levels.png', 'planet_lattice.png'])}
json.dump(out, open('levels.json', 'w'), indent=1, default=float)
print('ok', len(json.dumps(out, default=float)))

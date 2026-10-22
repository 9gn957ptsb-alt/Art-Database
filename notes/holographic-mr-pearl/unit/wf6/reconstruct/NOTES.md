# reconstruct — NOTES (running)

Previous run left this folder EMPTY (nothing to continue); started fresh 16 Oct.

## Reading (step 0, done)
- Straight model (fs.figure, H=1/9): 9 unit beams, nodes. Bars: left=Cz+Az (x=1,y=1), right=Ay+By (x=0,z=0),
  bottom=Bx+Cx (y=1,z=-1), middle=Ax, inner_left=Cy, inner_right=Bz. Real joints at (1,1,-1) BL, (1,1,0) LM, (0,1,0) RM,
  (0,1,-1) BM-start. Fake (drawing-only) meetings: top (Az end (1,1,1) vs Ay start (0,0,0)), BR (By end (0,2,0) vs Bx start
  (-1,1,-1)), BM (Cy end (1,2,0) vs (0,1,-1)); each nearer by m=(1,1,1).
- KEY 1: slide field must be a function of DRAWING position per bar, f_bar(sigma), sigma = along-axis coord minus half the
  other two (drawing-invariant). Then a bar never shows its own back faces (sightline order inside a bar preserved,
  Jacobian det 1). A slide by f(z) (z-sections moved rigidly) would invert the bar where f'>1.
- KEY 2: the 6 drawn meeting points form 2 orbits under the drawing's 1/3 turn (outer corners top/BR/BL; inner
  LM/RM/BM). The straight model has fakes at 2 outer + 1 inner, so "bend n at the 3 points" (V1) is NOT 3D-symmetric.
- KEY 3 (V3): bend EVERY one of the 9 beams back by m/3: beam vector = e_axis - m/3, which lies in the picture plane.
  Every cycle of the figure's graph has equal numbers of x,y,z beams, so every loop closes; all 6 nodes at one depth;
  the 3D form is exactly 3-fold symmetric (R3 p = M(p-C)+C maps it to itself). Gentlest possible: shift 1/3 vs 1.
- Mismatch convention (vectorize final_metrics.py): compare vs cls, holes (cls==2 & cls_holes==-1) where render is
  paper count as 2; valid = cls != -2; fig = (cls>=0 | render>=0) & valid. Floor 2.103%.

## Left
- compute free span (sigma range with no drawing overlap) per beam; build V3 (primary), V1 (literal), straight-cut.

## Step 1 (done): free span — overlap.py, overlap.json
- Every one of the 9 beams overlaps other beams in the drawing exactly for sigma < 3H and sigma > 1-3H (its full
  range is [-2H, 1+2H]). So the free span, where a slide changes nothing the drawing shows, is sigma in [3H, 1-3H],
  length 1-6H = 1/3 = THE HOLE SIDE. The bend must live there (anything else changes an occlusion at zero margin).
- Minimax: every 3-cycle of the graph (one beam per axis) needs total slide 1 (in m units), so max|s_b| >= 1/3, equality
  only for V3 (all s_b = 1/3). Slope s/L = (1/3)/(1-6H) = 1 exactly at H = 1/9: the bend's chord is perpendicular to the
  axis (X = sigma - f returns to its start value). Smooth profile must exceed 90 deg somewhere (smoothstep: 103.6 deg).
- Section = the constant-sigma slice (corner (a,b) at a(e_i+e_k/2)+b(e_j+e_k/2), plane contains m: edge-on in the
  drawing); the bar is a TRANSLATIONAL sweep of that one slice along the curved centreline P + sigma e_k - s f(sigma) m.

## Step 2 (done): drawing view — measure.py, ss_check.py, mismatch_first.json, ss_check.json
- geom.py builds beams as Convex hexes (rigid end parts + 64 sweep slices); caster.py is an ortho caster w/ normals.
- Hole convention that reproduces 2.103% exactly: holes = vectorize's drawn hole polygons (vec_rid.npy >= 9) count as
  2. (cls_holes.npy misses 662 hole-edge px -> 2.342%; vs cls_holes with holes as paper: 2.491%.)
- V3 (closed symmetric), V1 (literal: Az, By, Cy slid by m), cut (straight, near ends cut by sight-containing planes):
  all three = 2744 wrong = 2.103% = the floor; 0 px differ from the vectorize raster; 0 of 6,804,000 samples differ
  at 3x3 supersampling between V3/V1 and cut. Straight model 10.17%.

## Step 3 (done): checks — collide.py (no bent part enters another beam, V3 and V1), symcheck.py (R3 maps V3 onto
itself to 9e-16; all 6 nodes at one depth -1/sqrt3 from C; node gap 4e-16). Profile chosen: smootherstep (quintic,
C2 join with the straight parts): max f' 1.875 -> max bend 108.3 deg, min radius 0.026 (< H: unavoidable, see below).
Renders: closed_view_beside_original.png, diff_vs_cls.png (2744 px, all on edges) — looked at, good.
- Why tight: chord of each bend is perpendicular to the axis (s = L); any smooth joggle with that chord turns >90 deg;
  min-curvature radius stays < 0.09 for every profile. Could be eased only by warping the joints (common slide field
  in overlaps) which tilts straight parts off their axes: rejected (straight faces must face an axis).

## Run 2 (16 Oct, after the usage-limit stop) — continuing
- Found everything above finished (numbers.json, renders V3_*.png, turned_sheet_all.png, closed_view_beside_original.png,
  diff_vs_cls.png) EXCEPT form.json and the Arnell arc option. Looked at the renders: good.
## Step 4 (done): Arnell arcs (arnell/unit/UNIT.md sec 2b) — geom.py kind='arcs', arcs_run.py, arcs_check.json
- Bend = arc (rho = sqrt2/24, turn arccos(-1/3) = 109.47 deg), straight 1/3, arc back. Relation: chord sqrt2/3 _|_ axis
  and straight part = free span (1/3) give tan(theta/2) = sqrt2. NEW: in the drawing the three pieces each take exactly
  H = 1/9 of sigma (arc, straight, arc each cover a third of the hole side); slide 1/18, 2/9, 1/18.
- V3 arcs: 2744 px = 2.103% (floor), 0 px differ from quintic V3 and from the vector raster; 0 of 6.8M supersamples
  differ from the cut reading; R3 maps it onto itself to 9e-16; no collisions.
## Left: curve metrics for arcs, renders for arcs (closed view, diff, turned 20/45/90/180/below), form.json, return.
## Step 5 (done): arcs_metrics.json, renders arcs_*.png, compare_sheet.png (arcs/quintic/V1/cut x 6 views), form.json
  (write_form.py: nodes, per-beam centreline polyline + translational section frame + arc centres + 98 hexes each),
  numbers_final.json. NEW weak point found: the sight-containing slice swept by translation thins the bar in the bend
  plane to cos(th)+sin(th)/sqrt2 of 2H: 1/3 on the arcs' straight third (th=109.47), 0.358 at the quintic's steepest.
  Forced: th>90 is needed for a perpendicular chord; at 90 it would be 0.707.
  DONE. Primary = V3 arcs (every curve a stated circle); quintic kept as alternative.

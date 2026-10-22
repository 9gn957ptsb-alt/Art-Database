# arnell/unit — running notes
Task: apply Arnell's method to the BASE UNIT: (1) tangent circles at the crux vs the ladder's levels; (2) circles falling
by phi / ladder frames, and arcs of stated circles for the reconstruct bends; (3) sphere by rotation / by bands; cube, pyramid.
## step 0 (read) done: ARNELL.md, levels NOTES + levels.json, reconstruct NOTES (V3 bend: chord sqrt2/3 perpendicular to
axis, smootherstep, max bend 108.26, min radius 0.026), PURPOSE, design-rules. Pages seen: p6, p20, p24, p26 redraws.
## plan
- u1: A-chain circumcircles (r_m = F(m+4)u/sqrt3) through the envelope apex -> tangent pencil (p6). Check apex = drawn?
- u2: Fibonacci squares hold the circles exactly; bend as arc(rho=sqrt2/24, 109.47=arccos(-1/3)) + straight 1/3 along
  -(1,2,2)/3 + arc  (check: axial 0, lateral sqrt2/3; all on the H/2 grid).
- u3: figure turned about its median -> cone (N=2 -> square pyramid); banded sphere B=F(k) bands; head = true sphere.
## u1 DONE (py/u1_crux.py -> u1_crux.json, img/u1_crux_tangent.png, looked at)
- A-chain circumcircles R_m = F(m+4)u/sqrt3 all pass the outline's apex, centres on the median: tangent, err 0..4e-16.
  Exact by F(m+2)+F(m+3)=F(m+4). Radii ratios 1.6,1.625,1.615,1.619,1.618. B/C children tangent to parent at their corner (err 0).
- apex = envelope apex, u/sqrt3 = 0.5774u above the drawn tip (top cut 2/3 u wide). 3D: left outer edge point
  (1+H,1-H,1+3H), right outer edge point (-H,-3H,H): differ by (1+2H)(1,1,1), |.|=2.117, along the sight. Drawing-only point.
- opening copy concentric: never tangent. Head = circle of the same pencil above the tangent; radius free.
- render is flat painter order (no cyclic tilt): seams visible at a few joints; fine for the circles.
## u2 DONE (py/u2_arcs.py -> u2_arcs.json, img/u2_squares_arcs.png, looked at)
- Fibonacci tiling, squares F(k)*2u/sqrt3: inscribed circle = holding circle of level k-4 exactly; vs golden squares
  off +0.82% (5), -0.30 (8), +0.13 (13), -0.04 (21), +0.02 (34).
- bend as arc-straight-arc: theta=arccos(-1/3)=109.47, rho=sqrt2/24=chord/8=0.0589, straight 1/3 along -(1,2,2)/3;
  axial 0, lateral sqrt2/3 exact. Drawing wrong px 2744 = quintic (unchanged). min radius 0.0589 vs 0.0260 (x2.27);
  max bend 109.47 vs 108.26; nearest the sight line 15.79 vs 17.00 deg; G1 not C2. Turned views ~identical.
## u3 DONE (py/u3_sphere.py -> u3_sphere.json, img/u3_sphere_bands.png, looked at)
- figure turned about its median (N=2,3,5,8 copies over 180): sweeps a CONE (apex 60 deg, in the holding sphere,
  touching only pole + latitude -30; volume 28% of the sphere); N=2 hull = square pyramid (slant/half-base sqrt7).
- banded sphere B=13 equal-height bands (Archimedes), alternating upright/point-reflected figures, 602 figures;
  silhouette radius range 5.5% (std 1.41%); golden spiral N=144: 2.9% (0.62%); head 0.4% (0.10%, pixel limit).
  facet sagitta pole 3.9% R, equator 0.30% R. Count rule B = largest F <= 2R/1.886 (leaf height): R=10 ->8, 20->21, 100->89.
- cube: each tribar = 3 cube edges from a vertex to the opposite; ends a diagonal apart = the sight line.
- flat decals (the drawing, not the 3D unit) in the sphere renders; pole band figures 3.6x the equator's (equal-height rule).
NEXT: UNIT.md, wf6/solids/ARNELL-NOTE.md
## ALL DONE: UNIT.md and wf6/solids/ARNELL-NOTE.md written

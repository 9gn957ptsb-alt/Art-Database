# UNIT: Arnell's method applied to the base unit

Source of the method: `arnell/read/ARNELL.md` (pages 6, 20, 24 and 26 of *BREATHTAKING*). Source of the unit:
`wf6/levels` (the Fibonacci ladder, levels.json) and `wf6/reconstruct` (V3, the closed curved form).
Scripts are in `unit/py/` (`common.py`, `u1_crux.py`, `u2_arcs.py`, `u3_sphere.py`). Each one runs as
`python3 -I <script> <arnell dir>`. Numbers are in `u1_crux.json`, `u2_arcs.json` and `u3_sphere.json`. Each image puts
the document's page on the left and the unit by the same method on the right.

Units: u = L/3 is a third of a block edge as drawn (L = sqrt(2/3)). F is Fibonacci (F1 = F2 = 1). A level-m frame has
outline side F(m+4) u. Level 2 is the drawing.

---

## 1. Tangent circles at one point (p6) and the levels closing from one eye. HOLDS, for one line of frames
Image: `img/u1_crux_tangent.png`

**Rule.** The circle that holds a level-m frame is its outline's circumcircle, with R_m = F(m+4) u / sqrt3. A frame's
A-corner child shares the frame's apex. Its centre sits F(m+2) u/sqrt3 above the parent's, so its apex lies at
(F(m+2) + F(m+3)) u/sqrt3 = F(m+4) u/sqrt3 = R_m. That is the parent's apex.

**Checks.**
- The A-chain of levels 6 to 1 (outlines 55, 34, 21, 13, 8 and 5 u) has every centre on the median and every circle
  through one point. The tangency error is at most 4e-16 and the apex spread is 0.
- The radii fall by 55/34, 34/21, 21/13, 13/8 and 8/5 (1.618, 1.619, 1.615, 1.625, 1.600), tending to phi. p6's chart
  has no ratio; this one is Fibonacci.
- The B and C corner children are each tangent to their parent at their own corner (error 0).
- The opening copy (level m-4, inverted) is concentric with its parent and never touches it.

**What the point is in the drawing.** It is the outline's apex, which is **not drawn**. It sits u/sqrt3 = 0.5774 u
above the drawn tip, because the bar ends cut the corner to a flat 2/3 u wide.
- It is where the outer edge of the left bar (grey) and the outer edge of the right bar (white) meet, and they meet only
  in the picture.
- In the straight lattice model their points at the apex are (1+H, 1-H, 1+3H) and (-H, -3H, H). These differ by
  (1+2H)(1,1,1), a length of 2.117, exactly along the line of sight.
- So the point where every level touches is the top corner's closure: a meeting that exists only from the one eye. It is
  the crux, in the drawing.

**What does not hold.** One frame per level touches there, not every frame. In a tree only the all-A path does; under
rule D that path is the heaviest part at each level, which is the information's main line. Every other frame touches
its own parent at its own corner, like the p6 circles that join other pairs of dates.

**For Mr Pearl.** The circles through the crux form a tangent pencil: they share the point and the tangent line, and
the radius is free. A circle of the same pencil on the other side of that tangent touches every level at the crux from
outside. That is a place for his head that the relations determine (it sits on the crux and touches every level), while
its size stays undetermined. This fits "the one thing not determined by the information, standing where all its
relations cross". This is a proposal; the artist has not stated it.

## 2. Scales and dynamic relationships (p20). HOLDS (exactly, in Fibonacci integers); the arcs HOLD with a cost
Image: `img/u2_squares_arcs.png`

**(a) Squares and circles.** Take squares of side F(k) * 2u/sqrt3: the Fibonacci tiling, which is the golden rectangle
in integers. Each square's inscribed circle is exactly the holding circle of a level k-4 frame, and that frame is
inscribed in it.
- Squares 55, 34, 21, 13 and 8 hold levels 6 to 2. Square 5 holds the drawing's tribar (level 1). Squares 3, 2 and 1
  hold levels 0, -1 and -2.
- Against p20's true golden squares (falling by phi) the tiling is off by exactly the ladder's own error, measured from
  the top square down: 34 +0.02%, 21 -0.04%, 13 +0.13%, 8 -0.30%, 5 +0.82%, 3 -2.1%, 2 +5.6%, 1 -14.6%.
- So the ladder's frames inscribe in p20's circles to 0.3% at the leaf and better above it. In the Fibonacci tiling
  they inscribe exactly.
- A row on one ground line (p20's row of falling circles) becomes frames of falling level standing on the ground. A
  frame's base is on the ground exactly when its incircle (R/2) touches the ground.

**(b) The curves: arcs of stated circles in place of the free quintic.** In `wf6/reconstruct`, V3 bends every one of the
9 beams back by m/3 over its free span (sigma in [3H, 1-3H], length 1/3). Each bend is a joggle whose chord, sqrt2/3,
is perpendicular to the beam's axis; there it is a smootherstep (quintic), which is a free curve. Replace it with
**arc, straight, arc**:
- The arcs have radius **rho = sqrt2/24 = chord/8 = 0.0589** and each turns by **arccos(-1/3) = 109.47 deg** (the
  tetrahedral angle).
- The straight part has length **1/3**, which is the free span and the hole side. It runs along **-(e_k + 2e_i + 2e_j)/3**
  (displacement (1,2,2)/9, which lies on the H grid).
- Arc 1 ends at (H/2)(1,-1,-1) in the beam's frame. The arc centres are at -(e_i+e_j)/24 and -(7/24)(e_i+e_j) from the
  span start.
- Every quantity is exact: axial advance 0 and lateral sqrt2/3. The relation that sets them is that the chord stays
  perpendicular to the axis, and with cos theta = -1/3 the straight part comes out to exactly 1/3.

**Checks** (the whole V3 unit rebuilt with this profile, using reconstruct's own geometry and caster):
- In the drawing view the wrong pixels against the original are **2744 for both** profiles (2.103%, the floor). The
  drawing is unchanged, as it must be: every slice still moves along its own sight line.
- The minimum radius is 0.0589 against the quintic's 0.0260, 2.27 times larger. The maximum bend is 109.47 deg against
  108.26 deg.
- Turned 30, 60 and 90 degrees, the two units are almost indistinguishable.
- In a level-m frame every bend scales by F(m+4)/8. The bends' circles therefore form the same Fibonacci ladder of
  circles as p20.

**Cost.**
- The curve is G1, not C2: the curvature jumps from 0 to 1/rho at the four joins, where it would show as a highlight
  break.
- The straight third runs 15.8 deg off the line of sight, against 17.0 deg at the quintic's steepest. Since the beam is
  swept from slices that contain the sight line, it is about 7% thinner there, over a longer stretch.
- The closest the arc version can come to its theoretical limit is a radius of 0.0863 (sqrt2 / (6(1+sqrt3))), with the
  straight part along the sight line itself. That limit degenerates the beam into a plate, so it is rejected.

## 3. Motion transforms 2D into 3D (p24), and the aisle spheres of bands (p26)
Image: `img/u3_sphere_bands.png` (the unit is drawn as a flat decal of the drawing; these are not the 3D V3 unit)

**(a) Sweep. The rule holds; it gives the CONE, never the sphere.** Turn the figure about its vertical median, N copies
over 180 deg (p24: 180 is enough).
- The swept outline is a cone with a 60 deg apex. It sits inside the holding sphere (R = 8u/sqrt3 = 1.2571) and touches
  it only at the pole and along latitude -30. Its volume is 28.1% of the sphere's.
- **N = 2** (90 deg apart) already hulls a **square pyramid**: base diagonal S, height S sqrt3/2, face slant /
  half-base = sqrt7 = 2.646 (not phi). N = 3 hulls a hexagonal pyramid, and N tending to infinity gives the cone.
- From an eye at one copy's azimuth only that copy closes. A copy turned by t opens by 0.151 (5 deg), 0.596 (20 deg) or
  1.259 (45 deg) of its own size (wf6/levels).
- So the unit cannot become a sphere by rotation, while the circle can: that is exactly what separates it from his
  head.

**(b) Bands. Holds as a rule; the band count is set by the leaf.** B = F(k) latitude bands of **equal height 2R/B**.
- By Archimedes, equal-height bands have equal area. Each band is a ring of figures alternating upright and
  point-reflected (the ladder's own opening rule), each as tall as its band's arc, with 2 round(2 pi R cos(lat)/S) per
  band.
- With B = 13 there are 602 figures: 70 per band at the equator and 6 at the poles. The polar figures are 3.6 times the
  size of the equator's, because equal height means a longer arc near the poles.
- **Count rule:** B is the largest Fibonacci number with 2R/B >= the leaf's height (1.886 blocks), so the bands never
  get finer than the drawing. This gives R = 5 -> 5 bands, 10 -> 8, 20 -> 21, 50 -> 34, 100 -> 89, 500 -> 377.
- The facets therefore never vanish at any size. The bands' sagitta is 3.9% of R at the poles and 0.30% at the equator.

**(c) Golden spiral (alternative).** N = F(k) figures at heights z_i = 1-(2i+1)/N, with each next one turned by the
golden angle (137.51 deg). Every figure gets an equal area, and the visible spirals come in consecutive Fibonacci
counts. N = 144 is shown.

**Never mistaken for his head (measured on the renders, at the same R):**

| Form | Silhouette radius range | Std |
|---|---|---|
| Bands B = 13 | 5.5% | 1.41% |
| Golden spiral N = 144 | 2.9% | 0.62% |
| The head (ray-cast true sphere) | 0.4% | 0.10% (the pixel limit) |

The built spheres also carry the drawing's three tones as texture; the head has none.

**(d) The cube. The document gives nothing; the drawing does.** Each tribar is three edges of a unit cube running from
one vertex to the opposite one:
- A: Ay, Ax, Az from (0,0,0) to (1,1,1).
- B and C: the same kind of path, ends differing by (1,1,1).

The impossible joint is that cube's main diagonal seen end on. The cube is the hidden solid under each tribar, and a
cube is the 6 such paths (the 6 orders of x, y and z), which together use all 12 edges.

---

## Summary
- **Holds, exact:** the levels' circles touch at one point, the outline's undrawn apex, which is the top corner's
  drawing-only closure. The Fibonacci squares hold the ladder's circles and frames exactly. The bend can be built from
  arcs of stated circles (sqrt2/24, arccos(-1/3), straight 1/3) without changing one pixel of the drawing. Rotation
  gives the cone and the square pyramid. Equal-height Fibonacci bands give a sphere that is visibly built.
- **Does not hold:** all frames tangent at the crux (only one per level is). The unit swept into a sphere (it gives a
  cone). The arcs as smooth as the quintic (G1, not C2). Phi exactly anywhere (Fibonacci everywhere, 0.3% at the leaf).
  The square pyramid golden (it is sqrt7).
- **Caveat:** the sphere and sweep renders use the flat drawing as a decal, not the 3D unit, and the u1 nest is drawn
  flat in painter's order with no cyclic tilt, so a few joints show seams.

# ARNELL-NOTE: what the BREATHTAKING method gives the solids study

From `arnell/unit/UNIT.md`. Its images are `arnell/unit/img/u1_crux_tangent.png`, `u2_squares_arcs.png` and
`u3_sphere_bands.png`. The numbers are in `arnell/unit/u*.json`.

## Sphere
**Rotation gives the cone, not the sphere.** Arnell p24 says "a sphere is a circle rotated about a diameter". That is
true for his head only.
- The figure turned about its median sweeps a cone with a 60 deg apex, inscribed in the holding sphere
  (R = 8u/sqrt3 = 1.2571 at the leaf). The cone touches the sphere only at the pole and along latitude -30, and fills
  28.1% of its volume.

**Bands (p26, the aisle).** Use B = F(k) latitude bands of equal height 2R/B. They have equal area (Archimedes).
- Each band is a ring of figures alternating upright and point-reflected (the ladder's opening rule), each as tall as
  its band's arc.
- Band count: B is the largest Fibonacci number with 2R/B >= the leaf's height (1.886 blocks). This gives
  R = 10 -> 8, 20 -> 21, 50 -> 34, 100 -> 89.
- The texture (the bands) can therefore never get finer than the drawing.

**Alternative: the golden spiral.** N = F(k) figures, with each next one turned by the golden angle (137.51 deg), at
equal area.

**Telling the built spheres from the head.** Measured silhouette radius range at the same R:

| Form | Radius range |
|---|---|
| Bands B = 13 | 5.5% |
| Golden spiral N = 144 | 2.9% |
| True sphere (the head) | 0.4% (pixel limit) |

Facet sagitta for the bands: 3.9% of R at the poles, 0.30% at the equator.

**Weak spot.** Equal-height bands make the polar figures 3.6 times the size of the equatorial ones (6 figures against
70 per band at B = 13). An alternative is to cap the poles with a single figure or a level-down frame.

## Pyramid
**N = 2 copies at 90 deg about the median hull a square pyramid.** Base diagonal is S (the outline side), height is
S sqrt3/2, and face slant / half-base is sqrt7 = 2.646. It is not golden; the Great Pyramid's phi is the same myth.
- N = 3 hulls a hexagonal pyramid, and N tending to infinity gives the cone.
- The tetrahedron is still the figure's own outline as 4 faces (not tested here).

## Cube
**The method gives nothing; the drawing does.** Each tribar is three edges of a unit cube from one vertex to the
opposite one:
- A: (0,0,0) -> (0,1,0) -> (1,1,0) -> (1,1,1).
- B and C: the same kind of path, ends differing by (1,1,1).

The impossible joint is the cube's main diagonal seen end on. A cube is 6 such paths (the 6 orders of x, y and z),
which together use all 12 edges.

## Curves (for the solids' surfaces)
V3's quintic bend can be replaced by **arc (radius sqrt2/24 = chord/8, turning arccos(-1/3) = 109.47 deg), straight
1/3 along -(1,2,2)/3, arc**. Every value is exact and stated.
- The drawing view is unchanged (2744 wrong pixels, as with the quintic).
- The minimum radius is 2.27 times larger (0.0589 against 0.0260).
- Cost: G1, not C2, and the straight third is 7% thinner because it runs 15.8 deg off the sight line, against 17.0 deg
  for the quintic.
- At level m every bend scales by F(m+4)/8.

## Scale
- Every level's holding circle (R_m = F(m+4) u/sqrt3) along the A-line touches at one point: the outline's undrawn
  apex, u/sqrt3 above the drawn tip.
- That point is the top corner's drawing-only closure: the two outer edges' points there are (1+2H)(1,1,1) apart, along
  the sight.
- In the Fibonacci squares (side F(k) * 2u/sqrt3) every circle holds a level exactly. Against true golden squares the
  error is 0.3% at the leaf.

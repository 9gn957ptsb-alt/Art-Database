# CHECK of wf6/reconstruct (V3, arc-straight-arc bends) — by check-reconstruct, 16 and 20 Oct

Scripts and outputs are in wf6/check-reconstruct/ (check1..check8 .py/.json, alt90.json, alt90_vs_arcs_sheet.png, NOTES.md).

## Verdict: the geometry is sound and the drawing match holds; three "forced" claims are refuted

### Confirmed (rerun independently)
- **The match against cls.** form.json's 882 hexes were cast with `figure_studies.cast`, not their own caster. Result: 0 px differ from my own point-in-polygon raster of vector.json, and 2744 wrong px = 2.103% against cls, which is the floor (check1). Against cls_holes with holes as paper it is 3056 px = 2.491%.
- **Supersampling.** For the primary arcs form, 0 of 6,804,000 3x3 supersamples differ from the straight-cut reading (check8).
- **Closure.** All nodes are at depth -1/sqrt3, the node degrees are 2 and 4, and every beam satisfies beam.m = 0 (check2). The largest node gap in the stored file is 1.2e-10, which is rounding in form.json; analytically it is 4e-16.
- **R3 symmetry, measured on form.json itself.** The stored centrelines and hex corners map onto themselves under x->z->y->x about C to 1.2e-10 (check7).
- **sigma is constant on a sight line.** Proved by hand: moving along m adds t to q_k and t to (q_i+q_j)/2.
- **The arc relations, re-derived by hand:**
  - 2 rho sin(th) + L cos(th) = 0 and 2 rho (1-cos th) + L sin th = sqrt2/3 with L = 1/3 give tan(th/2) = sqrt2 and rho = sqrt2/24.
  - The sigma pieces are H:H:H and the slide splits 1/18 : 2/9 : 1/18 (check2).
  - The arcs lie on their stated circles to 1e-10.
- **The thickness formula** cos th + sin th/sqrt2 was re-derived. It gives 1/3 on the 109.47 deg straight run.
- **The straight run is 15.79 deg off the line of sight:** (1,2,2).(1,1,1)/(3 sqrt3) = 5/(3 sqrt3).
- **The cut reading's centreline gap** is sqrt(2 + (7/9)^2) = 1.614.
- **The golden sequence (check5):**
  - hole, growth, side, tribar and figure obey the sum rule for any H;
  - at H = 1/9 they are 1:2:3:5:8 in thirds;
  - at 6H = 1/phi they are a geometric sequence in phi, and figure x phi^-4 equals the hole exactly.
  - "Radii F(m+4)/8 tending to phi across levels" is only Fibonacci arithmetic. It is not a property of this form.

### Refuted
1. **"The bend's span is set by where the beam overlaps nothing; zero margin."**
   - overlap.json is right that every beam overlaps others for sigma < 3H. But a span of [2H, 1-2H] (just outside the node cubes) also gives 0 px from the vector reading at 1x, 0 of 6.8M supersamples different from the cut reading, and 0 collisions (check3, check4).
   - Margin by span: [1.5H, 1-1.5H] changes 7 px, [H, 1-H] 96 px, [0, 1] 1568 px.
   - So the span [3H, 1-3H] is a choice, and there is about H of margin at each end.
2. **"The bend angle is forced above 90 deg."** This is true only for the [3H, 1-3H] span.
   - With [2H, 1-2H] the chord is no longer perpendicular to the axis: it advances 2/9 and sits at 64.8 deg.
   - A 90 deg arc-straight-arc with rho = H exactly and a straight run of sqrt2/3 - 2H is then possible. It is also every-curve-a-stated-circle (alt90.json, alt90_vs_arcs_sheet.png).
3. **"The pinch to 1/3 is forced."** Under the 90 deg alternative the minimum in-plane thickness is 0.707, against 1/3. The minimum radius is 0.111, against 0.059. Weak points 2 and 4 of the report fall with this.
4. **The tone numbers quoted for the primary arcs form** (nearest axis changes 25.6%, Middling changes 26.4%) were measured on the quintic (measures.py).
   - For the arcs form they are 20.48% and 22.14% (check6).
   - FIXED in numbers_final.json. The quintic values are kept as `*_quintic`, with a `tone_note`.

### Not claimed, but worth knowing
- **Cost.** The form is 882 hex prisms (98 per beam), against 9 boxes for the straight or cut reading. The numpy cast of the drawing view takes 4.9 s against 0.9 s.
  - Nothing was shown about a phone shader.
  - Analytically, each beam is 2 straight boxes plus 2 arc sweeps plus 1 oblique straight prism. The arc sweeps are translational sweeps of a slanted square, so their faces are oblique cylinders, which need quadratic ray tests.
- **Solidity.** This is a closed but thin loop form. Off the one eye it reads as a zigzag (turned 90, from below), not as an impossible triangle or a solid. It answers request 1 and does not yet address "solid" in request 2.
- **Shading.** Under shading by the normal, the bends flash black and white bands (the mix renders). The section-edge tone rule hides this only by bookkeeping, as the report says.

## Suggested change
Use the span [2H, 1-2H] with the 90 deg rho = H profile. It keeps every claimed drawing property, and it removes the >90 deg fold and two thirds of the pinch.

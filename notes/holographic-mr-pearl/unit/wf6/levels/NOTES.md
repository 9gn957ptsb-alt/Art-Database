# levels — running notes (wf6/levels)

Task: the unit's modularity with itself across scales, golden, levels = planet -> cities -> places -> works -> details.
Rules over everything: /home/user/site/CLAUDE.md "Holographic Mr Pearl — what the game is for", unit/PURPOSE.txt,
unit/design-rules.txt. Do NOT edit /home/user/site.

## Read so far (step 0)
- wf1/design-nesting/unit.py: golden half-bar HG = 1/(6 phi); lengths hole 1-6H, growth 6H, side 1, tribar 1+6H,
  figure 2+6H (each sum of the two before, any H); geometric in phi iff 6H = 1/phi; at H=1/9 they are 1:2:3:5:8 thirds.
- Earlier nestings tried: copies at phi^-4 in the 4 holes (inverted one turned by R180 = 2nn^T - I: NOT a lattice
  rotation, so its faces are not on the axes -> breaks "tone by the axis the face looks along"); copies at 1/phi laid on
  each tribar (colour-albers A8: overlaps make mixtures).
- figure_studies.level(k): Sierpinski doubling with a FIXED bar (scale 2 per level), not golden.
- vectorize: the original = straight lattice model at H=1/9 with 4 of 12 overlaps swapped; 2.103% vs cls (floor).

## (a) thirds vs golden — DONE (step 1)
Scripts: drawing2d.py (vector.json polygons at any H, rasterised at pixel centres; reproduces vectorize's 2744 px exactly),
q_a3.py/q_a4.py (refits), q_a5.py (sweep), q_holes.py (the original's holes measured). Results in q_a3.json, q_a5_sweep.json,
q_holes.json. Scoring as vectorize: holes drawn as 2, -2 ignored, % of cls's 130462 figure px.
- thirds H=1/9: 2737 px = 2.098% (the floor). golden 6H=1/phi (H=0.10301): 7853 px = 6.019% (refit s 251.65).
  vs cls_clean (holes as paper): 1.758% vs 6.428%.
- sweep: min at H 0.111-0.1125 (2.10%); 0.110 2.27, 0.108 2.77, 0.106 4.05, golden 6.02, 0.100 7.81, 0.098 9.75.
- in pixels: bar across 78.8 (thirds) vs 73.3 (golden); hole side 68.2 vs 78.5 (+15%); figure side 545.8 vs 537.9;
  33 drawn lines move mean 3.3 px, max 7.1 px (the 4H lines).
- the original's own holes: mean area 1944 px; thirds predicts 1990 (half-px stroke), golden 2651. Original = thirds.
- Fibonacci check: lengths hole 1-6H, growth 6H, side 1, tribar 1+6H, figure 2+6H (L units) - sums hold for any H;
  geometric iff 36H^2+6H-1=0 iff 6H=1/phi; at H=1/9: 1,2,3,5,8 thirds. VERIFIED. 6H=2/3 is the 3rd convergent of 1/phi
  (1/1,1/2,2/3,3/5,5/8,...); each convergent 6H=F_k/F_{k+1} gives a figure whose 5 lengths are 5 consecutive Fibonacci numbers.
- KEY RELATION (any H): corner ratio r=(1+6H)/(2+6H) (a tribar's outline / the figure's), gap ratio g=(1-6H)/(2+6H)=2-3r.
  Three copies at r in the corners leave exactly the inverted gap g. g = r^4 ONLY at 6H=1/phi (r=1/phi, g=phi^-4).
  At thirds r=5/8, g=1/8 (5/8^4=0.153 != 0.125): two incommensurable ladders. r is insensitive to H (0.618..0.625),
  g is not (0.146 vs 0.125): the hole is where phi bites. Thirds unit + phi^-4 children overflow the hole by 16.7% (3.3 px at
  the original's size); thirds + phi^-1 corner children are 1.1% small (1.1 px).

## 3D unit for renders
- straight lattice: 10.17% (thirds) - wrong only at the 4 swapped overlaps. unit.py curved tail: 27.9% (bad: the whole-beam
  smoothstep moves the closing beam back at its joint, where it shares a point with its neighbour).
- my lv.unit (closing beam bent back only over the stretch bordering the hole): 16.9% - FAILS: a shear back along the line of
  sight steeper than 1 step per unit length folds the beam and exposes slice ends. A closure must spread its return over
  the tribar (slope < 1). The woven unit (wf1 weave_test: each tribar flattened into the drawing plane, slope 1/3 per beam,
  plus a sine weave) does: 2.333% thirds / 6.209% golden. USE WOVEN for drawing-exact renders (it is flat: depth -1/sqrt3).
  The real curved unit is the reconstruct study's; the level rules below take any unit that closes along (1,1,1).

## (b) first renders (step 2): r_in.png, r_of.png, r_joints.png, r_joints2.png (nest.py)
- IN: 4 copies at phi^-4 fill the openings edge to edge (no overlap with the parent's faces). Gap copy: point reflection
  (-I, lattice, tones by axis) or R180 (tones carried; not a lattice map). Children are small (14.6%).
- OF: 3 copies at phi^-1 at the corners; their outer bars join into one frame (collinear, flush with the outline); they
  overlap pairwise in triangles of side phi^-3 S at the side midpoints (A's corner tribar's corner over B's apex corner).
- Sibling depth: 'flat' (one depth) -> the woven unit's sine decides -> curved boundaries (bad). 'strict' (A>B>C) and
  'cyclic' (each tilted along (1,1,1) by a plane rising towards the joint where it lies over the next: A over B at the
  right-middle, B over C at bottom-middle, C over A at left-middle) both clean. The original's own joints are cyclic
  (C's Cy over A's Ax at the left-middle etc., vectorize occlusions) -> ADOPT CYCLIC. A tilt that depends only on the
  drawing position (a,b) is a shear along the line of sight: always invertible (never folds), drawing unchanged.

## (c) the n-rule — golden Huffman (step 3; nest.py huffman/place_huffman; r_split.png, r_rule.png, r_rule.json)
- golden split by count alone (largest slot first, reading order): structurally fine but even n leaves a visible
  missing piece, and sizes ignore weight -> replaced.
- GOLDEN HUFFMAN: weight = how much a thing holds (its leaves). Join the three lightest into a figure of three
  (heaviest at A top, B bottom-right, C bottom-left); repeat. If n is even the first join takes four, the lightest
  going into the opening between the other three (point reflection at phi^-4 of the join). n=2: the heavier is the
  frame, the lighter in its opening. Ties: the parts' own order. Sizes phi^-depth; area ~ weight^0.876.
  Any n, at most one opening used, never a missing piece, the figure's own form at every join.
- examples: 12 equal -> phi^-2 x8, phi^-3 x3, phi^-5 x1 (gap); 40 equal -> phi^-3 x21, phi^-4 x18, phi^-6 x1;
  London's 9 museums by works [26,2,2,1,...] -> National Gallery phi^-1, others phi^-2..-3.
- sibling tilt kappa = 1/(3L) (the composite rises one step round its 3 joints, as the woven tribar round its 3
  corners): joints clean at planet, city and place level (r_joints3.png). The earlier kappa = r/L tilted too much.
  Cyclic layering needs a unit thin along the line of sight (woven); the lattice unit (depth extent ~0.8 s) needs
  more separation than 1/3 step -> some lattice joints wrong. Strict layering works for any unit but is 'possible'.

## (b) closure — DONE (q_closure2.py, q_closure2.json; lattice unit's tribar ends one (1,1,1) step apart)
- drawing view: gap 0 at every level (IN nest levels 0-2; OF tree leaves).
- turned ortho: relative gap (gap / own drawn cell) IDENTICAL at every level: 0.151 (5 deg), 0.596 (20), 1.259 (45).
- plain perspective from an eye at 8 sizes: 0.10-0.32, set by direction, not level.
- the whole nest drawn in toward that eye (one projective map, figure_studies.drawn_in, beta=g/f): 0 at every level.
- drawn in, eye moved 5 deg: 0.151-0.153 at every level: all levels open together.

## toy tree (info.py toy): fixed rule -> New York (Met, MoMA, Guggenheim), Paris (Pompidou, Orsay, Picasso),
## Amsterdam (Van Gogh, Rijks, Stedelijk); 3 works each (museum's own order); details t, a, y, m.
- works as leaves: 27 at phi^-3. With details: 81 at phi^-4 (artist A, year B, medium C) + 27 titles in the
  works' openings at phi^-7 (n=4 even: the first join takes four, the title -- first by order -- in the gap).
- renders: tree_works_drawing.png, tree_details_drawing.png, tree_details_levels.png (films per city/place).

## RESUMED 16 Oct (run 2) — state found
- Also finished by run 1 (not noted): tree_turned.png (r_views.py: woven and lattice units, the 27-work tree turned
  0/20/45/90 deg), tree_views.png (r_persp.py: turned ortho row; perspective from one eye drawn in / not / eye moved
  8 and 30 deg). Looked at: turned views open into slabs spread along the old line of sight (the cyclic tilt + the
  woven unit's flatness), as expected; drawn-in perspective is the drawing exactly.
- NOT done by run 1: levels.json; (d) the level units; the decision for (a); q_b ON ratio 0.452 (expected 1/phi) unexplained.
- Plan run 2: (1) check ON; (2) the FIBONACCI LADDER idea (below) with numbers; (3) re-render 3 nested levels + the
  toy tree with the chosen rule (thirds leaf); (4) the full planet by the rule (depth/sizes); (5) levels.json.

## run 2, step 1: ON re-check + THE FIBONACCI LADDER (ladder.py, q_on.py/q_on.json, q_ladder.py/q_ladder.json)
- ON: q_b's 0.452 was an artefact: the silhouette union merges the outer bar with the faces abutting it, so 'bar
  width' is not measurable from a silhouette (q_on.json: runs hit the whole interior). By similarity a copy at r has
  every length r times: its outer bar is r times the parent's. Drop the 0.452.
- IDEA (holds): level m = lengths (hole, growth, side, tribar, outline) = F(m)..F(m+4) in u = L/3. Level 2 = the
  drawing (1,2,3,5,8). Corners: level-m frame holds 3 level-(m-1) at (F(m+2)/3) TRI_k (outline = its tribars'),
  their opening = F(m) = its hole. OPENING: hole of level m = outline of level m-4 EXACTLY in integers (phi^-4 made
  exact). Ratios 5/8, 8/13, 13/21 -> 1/phi (1.13%, 0.43%, 0.16%, 0.06% off); hole/outline 1/8, 2/13, 3/21, 5/34 -> phi^-4.
- Verified on the drawing's polygons: holes 1.000 u, tribar centres 3.000 u apart, outline envelope 8 u (its corners
  are truncated: horizontal extent 7.333 u). Pixels (level-5 nest, 44 px/u): opening copies never outside their hole
  (0 px), never over a corner leaf's face (0 px), hole covered but its 3 corners (2.1%, the copy's cut corners);
  corner outlines never outside the parent outline (0 px).
- RULE changed from run 1: an even count sends its lightest part to the FRAME's OWN opening (not the first join's);
  a single remaining part fills the frame itself; an opening asked for by several holds them all by the same rule
  (fixes run 1's 'pair' collision: a pair's heavier part with 2 or 4 parts wanted the same opening). Root level K =
  least making the smallest leaf level 2 (every detail >= one block, drawn as the drawing).

## run 2, step 2: renders of the ladder (r_ladder.py, r_ladder_joints.py, r_ladder_views.py)
- ladder_drawing.png: levels 2,3,4,5 (1, 3+1, 9+4, 27+13 leaves), the woven unit at H=1/9, plain and with films
  (Middling mean of face and film) by the top frame's corner. Reads as one figure of figures at every level.
- ladder_joints.png: level-3 joints A over B (right-mid), B over C (bottom-mid), C over A (left-mid) all clean with
  kappa = 1/(3L); the inverted level -1 copy sits in the opening clean.
- ladder_views.png + q_ladder_closure.json: closure gap/own size identical at every level and kind: 0 (drawing),
  0.151 (5 deg), 0.595 (20), 1.259 (45). Drawn in toward one eye: the drawing exactly; eye moved 8 deg: all open
  together. Depth spread of the level-5 nest 4.76 vs drawn outline 9.25 (the cyclic tilt): turned views fan out.

## run 2, step 3: THE RULE, compared on numbers (q_rules.py -> q_rules.json, q_rules2/3 -> q_rules3.json)
Metric: for every node and each part, (actual level offset) - (ideal offset log_phi(share)/2, i.e. ink ~ weight);
mean |err| in levels; plus the planet's size K (its smallest leaf = one block = level 2).
- A (bottom-up golden Huffman; even -> lightest to the frame's opening; pair = heavier fills, lighter in opening):
  planet with details K=24 = 39,726 leaf outlines across(!), mean err 0.93, max 10.6 (nested pairs: opening in
  opening in opening, -12 levels).
- B (top-down best split among fixed candidates): worse everywhere (planet mean 1.23). Dropped.
- C (A, but a pair + the node's own record make a figure of three): K=15 (523 across), mean 0.86, max 4.6.
- D ADOPTED: every node has its own record (a leaf: the thing itself). ODD count of parts -> the record goes into
  the frame's opening (the figure's centre is the thing itself); EVEN count -> the record is one more part, so the
  corners always take an odd count (golden Huffman of 3s, no 4-joins). ONE part -> it fills the frame (one frame
  answers for both). Openings then hold only records, at most one opening on any path (no cascades).
  planet with details: K=12 (123 leaf outlines across), mean err 0.51 levels, max 3.6; works only K=12, mean 0.45.
  toy 3x3x3x4: K=8; 12 equal: mean 0.50; 40 equal: 0.48; London 0.47.

## run 2, step 4: renders by rule D + the whole planet + levels.json — DONE
- tree3_works_levels.png / tree3_details_levels.png (r_tree3.py, r_tree3.json): toy planet level 8 (18 drawings
  across), cities 7, places 6, works 5, details 3-4, records (teal, in openings) 2-4.
- planet_lattice.png (r_planet.py lattice): the artist's planet from cityplaces+museums: 31 cities, 71 places,
  602 works, 2408 details + 668 records = 3076 leaves, level 12 = 123 drawings across. Weak spot visible: a join of
  three gives equal corners whatever their weights (Washington: NGA 177 works beside two 1-work places drawn as big
  single figures); max size error 3.6 levels.
- levels.json written (build_levels_json.py): conventions, leaf, ladder table m=-1..16, relations, rule D steps,
  answers (a)-(d) with numbers, toy tree frames (ab, level, inverted, path), planet levels by kind and cities.
LEFT: places are museums only (studios/buildings not yet read in); the 3D form of a level (it is a flat triangular
slab, depth spread ~half its drawn width) is not solid - the cube/sphere/pyramid modulation is another study.

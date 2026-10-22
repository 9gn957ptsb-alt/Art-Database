# wf6/solids — running NOTES (next agent: read this first)

Task: how the unit, modulated across scales, approaches the CUBE, the SPHERE and the PYRAMID; land and buildings
read SOLID with the consequential texture visible; the game block (shader cost, LOD, far face); solids.json.
Rules over everything: site CLAUDE.md "Holographic Mr Pearl", unit/PURPOSE.txt, unit/design-rules.txt. Never edit /home/user/site.

## State at start (16 Oct, this run)
- No previous NOTES here (the earlier run left only ARNELL-NOTE.md). wf1/design-cube: analyze1.py + holes.py only
  (they made cls2.npy = cls with the 4 holes as paper, and a wrong-pixel analysis); nothing on solids yet.
- Read: colour study (unit.glsl, unit_colour.json, CHECK.md: VS tone rule, recursive Average films, block films,
  2^-k), arnell/ADOPT.md + unit/UNIT.md (banded sphere B=F(k), N=2 sweep -> square pyramid sqrt7 slant, cube = 6
  monotone paths), wf6/levels (Fibonacci ladder: level m lengths F(m)..F(m+4) u; opening child = level m-4 exactly),
  rocket.js FIGURE + fragment shader (8-step block walk, 6 box tests a block, lod smoothstep(.0125,.0275,uPx*dist)).

## Plan
1. common.py: game unit in the drawing frame, voxel DDA (shader mirror, bars + block films + K-hit stack), OBB caster.
2. Cube: thickness dial (drawing view vs the hexagon of 3 rhombi); 4 tribars on the 4 body diagonals; block cube N.
3. Pyramid: block ziggurat; unit-swept pyramid; golden stack.  4. Sphere: block sphere; banded (Arnell); shells.
5. Game block: wall + slope patch, designs compared (bare / Average+films / closed), cost, LOD, far table.
6. solids.json + StructuredOutput.

## Step log
- [common.py] game unit (rocket.js FIGURE) mapped to the drawing frame by model = (gx, 1-gz, gy): from (1,1,1) it
  closes into the drawing (t_unit_drawing.png). Its 6 bars fill 3.58% of the block's volume. walk() = the shader's
  block walk in numpy (bars + block films by rule none/crossing/exit, K films, tests counted); cast_obb() for forms
  off the grid; colour(): bare / closed / avg (UnitStack) / avgbars.
- [dial.py -> dial.json, C1_dial.png] THE DIAL. The figure (fs.figure, straight lattice model) never reads as the
  cube's hexagon: tone IoU vs the best hexagon of 3 rhombi 0.279 (H 1/9) .. 0.333 (6H=1) .. 0.471 (H 1/2); its
  outline stays a truncated triangle (cut 2H against side 2+6H: cut/side -> 1/3 only as H -> inf). The CUBE FRAME
  (the cube's 12 edges as bars, half-width H per edge 1) does: silhouette IoU 0.924 (H 1/9), 0.998 at 6H = 1 (the
  same point where the figure's holes close), tone IoU 0.59 / 0.75 / 0.89 (H 1/4) / 0.958 (H 1/3) / 1.000 (H 1/2);
  volume 0.30 / 0.48 / 0.74 / 0.91 / 1.00 of its cube (1+2H)^3. Best fit always the CONVEX corner.
- [tribars4.py -> tribars4.json] the 12 edges = 4 monotone paths (tribars), one per body diagonal: 18 ways; with
  the main diagonal's tribar the drawing's A (order y,x,z) there are 3; exactly one gives the other three one
  common order (z,x,y): solution 7. (No decomposition is 3-fold symmetric: the turn relabels the orders.)
- [gameblock.py run 1 -> run1/] head-on views were poor (5 m head-on fills the frame; slope5 looked down a corridor).
  Seen: today = lattice (36% of solid rays see through at 5 m, 17% at 30 m); avg = solid but washed (std 22-32);
  closed (opaque bars + opaque mean film) = solid, bars readable on the face's mean (std 42); 'face' film colour
  (the tone of the face the film lies on) = DROPPED: rays leaving through a block's top paint white bands across
  every block (std 102, reads as stripes, not the unit). Tests there counted to 10 films (not the cost): redone.
- [nest2d.py -> nest2d.json, C2_nest2d.png] HOLES FILLED BY THE FIGURE (drawing's eye only). r = (1-6H)/(2+6H) =
  1/8 (thirds) / phi^-4 (golden). Area of the figure's own outline filled: thirds 0.936 -> 0.9947 (4 copies) ->
  0.9983 (20) -> 0.99857 (84) -> limit 0.99858; golden 0.913 -> 0.991 -> 0.9976 -> 0.9982 -> 0.99824. What never
  fills: each copy's three cut corners inside its parent's opening (side 2H r). For the game's 1-block unit (L =
  0.408 m drawn cell): opening 16.4 px at 5 m, 2.7 px at 30 m (phone pixel 2tan35/844 m per m) -> depth 2 (20
  copies) at 5 m, depth 1 (4) at 30 m, 3 (84) at 1 m; the cut corners stay 1.37 px at 5 m, 6.8 px at 1 m.
  The limit is the figure's own outline (truncated triangle), solid ONLY from the crux; it is the hologram's solid.

## Run 3 (20 Oct 2026) — resumed here
- Reviewed run-2 renders. FAULT in the chosen 'closed+exit' rule: its film colour m(v) is the SAME for every face of a
  solid (a cube's three faces all read one grey: no face toning, so the cube does not read as the drawing's hexagon
  of three rhombi; the bars on it read as stickers). 'avg+crossing' (the colour study's land rule) = solid but washed
  (std 26-28, faces again all m(v) grey, exposed faces carry no film so near walls open into lattices behind).
- NEW RULE to test, 'face': the SURFACE FILM. Where a ray enters a filled block from air it crosses a film toned by
  the axis of the face it enters (the drawing's own rule: x grey 128, y black 0, z white 255 = the cube's faces at
  the dial's end H = 1/2); behind it the block's own six bars (first bar's tone) or, if none before the ray leaves
  the block, the block film m(v); pixel = Average(face, behind) = round((F+B)/2) (Colour Middling). Two films, one
  block: 6 bar tests. Palette on faces = the drawing's 5 film colours 0/64/128/192/255.
- Plan: walk(film='face') -> gameblock (wall/stair/slope/ground at 5, 30 m) -> solids_grid (cube 3/8/21,
  pyramid 2/5/13, sphere 3/8/21; drawing, 5 m, 30 m) -> banded sphere of 3D units (cast_obb) vs block sphere vs
  head -> far-face table M_a(v) -> solids.json.
- note: gameblock3 run 1 counted today's tests to 9 films (41 mean); the shader stops at the first bar: use run 2's 19.8 mean / 48 p95 (fixed in script: stop 1).
- [common.py run 3] walk(film='face', film_colour='mean'|'self') + colour(mode='face') = Average of the first two
  films; m(v) quantised to 8 bits (round half up). t_face.py: a 1- and a 3-cube from the drawing's eye: tests 6.0
  per pixel; colours only 0/64/128/192/255 (the drawing's film colours). t_face_cube3.png = the hexagon of three
  rhombi (faces 128 / 64 / 192) with the figure showing on every face at half contrast. 'self' (bulk = the entered
  face's tone) keeps full face tones 0/128/255 but loses the texture on the top face (white bars on white) -> DROPPED.
- [farface.py -> farface.json] FAR FACE (bars under a pixel): mean over a face = round((T_a + m(v))/2) to within
  0.7-3.1 levels mean (all 6 faces, 108 view directions each): a closed form, no table, 0 bar tests.
  By angle off the normal: x face 128 -> 121; y face 9 (head-on) -> 88 (grazing); z face 247 -> 167.
- [spheres.py R3 -> SPH_R3_*.png, spheres.json] OFF-GRID SPHERES of turned units (bands per Arnell B = F(k) = R;
  golden-angle spiral N = F(k); 3 golden shells): DROPPED for the world. Turned cubes' faces are along no world
  axis, so VS blends them to mid greys (value std 32-34 vs voxel 59, head 62): they read as a heap of crystals,
  not the drawing; cost 24-43 tests/pixel (7 per unit met) vs 6; silhouette range 24% (bands), 18% (spiral) vs
  voxel 12.7%, head 0.26%. Shells add tests (43) and nothing visible (outer shell covers 99.8% of its disc).
  The VOXEL sphere keeps the drawing's rule exactly (faces along axes) and IS Arnell's banded sphere on the grid:
  2R layers of 1 m = equal-height bands = equal area (Archimedes), each a ring of units.
- running: gameblock3.py (log), solids3.py cube/pyramid/sphere (s3_*.log), spheres.py 8 21 (spheres.log).
- [common.py walk_face(), tex_level(); t_texlevels.py -> C3_cube21_texture_levels.png] TEXTURE AT A FIBONACCI
  LEVEL: behind the face film, the six bars of the texture unit of side s = F(j) m tested ONCE in its own cell
  (anchored at multiples of s from the world origin), the bar counting only if its point lies in a filled block
  (1 occupancy fetch), else m(v). s = 1 reproduces walk(film='face') exactly (0 px of 81,442 differ). On the cube of
  F(8) = 21 m: s = 1, 3 (7 per edge), 8 (does not tile), 21 -> ONE figure in the hexagon of three rhombi: the
  drawing closed in its own cube. LOD RULE: s = the smallest F(j) whose bars (0.1 s) are >= 8 px at the face's
  distance (FOCAL 602.7 px): s = 1 m to 7.5 m, 2 m to 15, 3 to 22.6, 5 to 37.7, 8 to 60, 13 to 98, 21 to 158 ...;
  bars stay 8-16 px, so the texture never closes (the far mean is needed only past the largest level).
- [gameblock3.py -> gameblock3.json, G3_*.png, G3_gameblock_sheet.png] SEEN: 'face' is the one rule where the wall,
  stair, slope and ground read SOLID and keep the drawing's three faces apart (ground z ~192, wall y-face ~43-64,
  end x-face ~102-128) with the unit's bars visible on each face at half contrast; see-through 0, tests 6.0 (p95 6).
  today = lattice (see-through 8.6-9% of solid rays, tests 19.8 mean / 48 p95 per run 2), avg+crossing = washed
  glass (std 26-28), closed+exit = solid but all faces one grey, face-self = full tones but black walls swallow the
  texture. CHOSEN: 'face' (bulk m(v)).
- [gameblock4.py v1 -> G4_gameblock_sheet_v1_noFullCell.png, gameblock4_face1_faceLOD_far.json] SEEN: face1
  (1 m texture) reads clean at 5/30/110 m; its face means equal the far closed form within 1 level (wall30 x 98.2 vs
  97.1, y 31.1 vs 31.4, z 163.9 vs 163.6). The distance-only Fibonacci LOD FAILED on thin features (2 m wall, 1 m
  steps, 2 m ground): the coarse unit's bars mostly fall in air, leaving scattered fragments and seams at switches.
  FIX: FULL-CELL RULE: a face is textured at level F(j) only where the F(j) cell at its entry point is wholly
  filled (summed-volume table = one fetch per level tried); else the next level down. Thin things keep the 1 m
  unit (and close into the far mean by the existing lod); big masses carry the figure at their own scale.
  (steps_mean in gameblock4 counts the DDA from the eye; the game starts the ray at the meshed face: 1 step.)
- [gameblock4.py faceLOD (full-cell) -> G4_gameblock_sheet_faceLOD.png] clean: wall at 30 m wears 2 m figures,
  ground 2 m; thin parts keep 1 m. [solids4.py -> S4_*_sheet.png, solids4.json] cube/pyramid/sphere 3/8/21 with
  texture levels (cube 21 from the crux takes 3 m: only F(j) with j | k tile F(k); 13 asked, 3 given).
- [build_json.py -> solids.json] DONE: every rule + numbers. Left (for later, not done): blending between texture
  levels (renders switch hard), a WebGL check of the face rule, the Cezanne colour layer on these renders.

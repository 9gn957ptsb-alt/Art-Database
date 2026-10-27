# Holographic Mr Pearl: the basic unit, finished (27 Oct 2026)

Paths: `U/` is `notes/holographic-mr-pearl/unit/`, `R/` is `docs/worlds/rocket/`, `H/` is
`notes/holographic-mr-pearl/harness/`. Every number is from a file named beside it. "Computed here" marks a number
worked out for this page from those files (copies of the studies' scripts, rerun for it). "Inferred" marks a reading
that no file measures. Revised the same day against three independent checks of it, and again against four.

## The unit, in one paragraph

The unit is the artist's drawing made into a thing. On its own it is V3, the closed curve: nine square bars on the
three axes of a lattice, each a ninth of a cell in half-width (H = 1/9), each bent back a third of the way along the
line of sight by a 90° arc, a straight run and a 90° arc, every arc a circle as wide as the bar. It closes for real,
and from its one eye, looking down (1, 1, 1), it is the drawing to the measuring floor. That lone form stands in the
row by the tree, today still with older, sharper bends. What is built is the straight lattice that every block of the
game already is: six square bars with no curves, 10.17% off the drawing from its eye, at three crossings. Where blocks touch,
its long bars run on into their neighbours'; whether a tiled mass closes from the eye has not been tested. The unit is
made of itself at Fibonacci sizes. Its lengths are 1, 2, 3, 5 and 8 thirds. A frame holds three of itself one size
down at its corners, and one, four sizes down and upside down, in its hole. Its faces take their tone from the way
they look: up white, east-west grey, north-south black. The grey is the Average of the white and the black, as two
films overlapping make it. Every face is a film over what lies behind it in its own block, mixed by Colour Middling's
Average, so a mass is solid. Masses of it are cubes of side F(k), stepped pyramids of height F(k) and voxel spheres of
radius F(k). It never makes a true sphere. Mr Pearl's body is built of it, seven levels below the block. His head
alone is a true sphere, made of nothing, left unpainted, and the one thing of the scene this page asks the game's
Glyph Light to leave unglyphed (a reading he can overrule).

## Its properties

### 1. Form and curves (rule 1: "Use curves ... as close as possible to the original")

- **Rule.** The lone unit is V3, the closed curve. Each of its 9 beams is an axis step less m/3, with m = (1, 1, 1)
  the line of sight. Each bend lies on the span [2H, 1 − 2H] of its beam: a 90° arc of radius H, a straight run of
  √2/3 − 2H, and a 90° arc of radius H.
- **Relation.** Each slice of a beam moves only along the line of sight, so its own outline in the drawing cannot
  change. Which beam is in front could change, near the ends of a beam (under 3H), where beams overlap in the drawing;
  it is measured not to. Every curve is an arc of a stated circle, and its radius is the bar's own half-width.
- **Numbers.** 2,744 wrong pixels, 2.103% of the drawing's 130,462: the floor. 0 pixels differ from the vector
  reading; 0 of 6,804,000 supersamples differ from the cut reading; 0 collisions. The span's margin is about H/2:
  [1.5H, 1 − 1.5H] changes 7 pixels (measured on the smootherstep profile). The third-of-a-turn symmetry holds to
  9e-16 and the node gap is 4e-16: measured on the 109.47° form, and again on the 90° form (computed here, a copy of
  `geom.py` with `check4.py`'s profile). Straight run 0.2492. Thinnest section 0.707 of the bar (the 109.47° profile
  pinched to 1/3). Tightest radius 0.111 (it was 0.059).
- **The built unit.** Where units stand side by side (the world's blocks, his cells) the unit is the straight lattice:
  six bars 0.1 thick on centrelines 0.05, 0.5 and 0.95, so the cell is 0.45 and H = 1/9. It is not V3 tiled: they are
  two forms. It has no curves: rule 1's curves are V3's alone. From its eye it is 10.17% off the drawing (13,270
  pixels), every extra pixel at the three crossings where
  the near ends of Az, By and Cy draw over. An independent raster of the game's figure against V3 from the eye gives
  9.2%, at the same three crossings. `U/wf6/solids/CHECK.md` gives 1.60% for the same figure (fitted, against
  cls_clean); it disagrees with both and is to be corrected. Its long bars run on into the next block's (blocks repeat
  every 2.22 lattice cells). No study tiles either form, so tiled closure is untested.
- **In the game.** The block and his cells are the straight lattice (`R/rocket.js` FIGURE). V3 stands only as "The
  closed curve" in the row by the tree, still with the old 109.47° arcs.
- **Source.** `U/wf6/reconstruct/NOTES.md`, `CHECK.md`, `numbers_final.json`; `U/wf6/check-reconstruct/NOTES.md` (step
  3), `alt90.json`, `check4.py`; `U/wf6/solids/CHECK.md`; `U/arnell/unit/UNIT.md` §2(b).

### 2. Scales and the golden ratio (rule 2: "modularity with itself", "the golden ratio"; rule 7)

- **Rule.** The leaf is the drawing at H = 1/9. In u = L/3 (L = √(2/3)) its hole, growth, side, tribar and outline are
  1, 2, 3, 5 and 8. Each is the sum of the two before.
- **The ladder.** A level-m frame has lengths F(m) to F(m+4). Level 2 is the drawing. A frame holds three level-(m−1)
  frames at its corners and the level-(m−4) frame, point-reflected, in its hole. Siblings are layered in turn, as the
  drawing's own joints are (A over B over C over A), by a tilt along the sight line of κ = 1/(3L) = 0.408.
- **One ladder to an anchor.** A ladder is anchored where its leaf is. In the world the leaf is the 1 m block (level
  2), so a size in the world is F(n)/8 m. On his body the leaf is his cell (level 2) and the 1 m block is a level-9
  frame, so a size on him is F(n)/233 m. What is painted on him takes his ladder's sizes; the world's blocks keep
  theirs (property 3, the washes).
- **Relation.** Between levels the ratio is a ratio of Fibonacci numbers: φ approximated in integers, within 1.2% and
  nearer at each level. Exact φ belongs to the head's family alone.
- **Numbers.**
  - Thirds are 2.098% off the drawing. The exact golden bar (6H = 1/φ) is 6.019%. The drawing's holes measure 1,944
    px; thirds predict 1,990, golden 2,651.
  - Child to parent 5/8, 8/13, 13/21, 21/34: off 1/φ by +1.127%, −0.429%, +0.164%, −0.063%.
  - The opening copy is 0 px outside its hole and 0 px over the corners' faces. Thirds with exact φ between sizes
    fail: a φ⁻⁴ copy overflows the hole by 16.7%.
  - Every level closes from the one eye, and turned, the gap over its size is the same at every level: 0.151 at 5°,
    0.595 at 20°, 1.259 at 45°. Both are true by construction: the two closing points share (a, b), so every placement
    moves them alike. They show that the placements agree, not that the nest reads as one form from any other eye. In
    raw perspective it does not close (gaps 0.08–1.06).
- **The crux.** A level-m frame's holding circle has radius F(m+4)u/√3. Along the A corners every circle passes
  through one point, the outline's undrawn apex, where the two outer bars meet only from the eye (error at most
  4e-16). A square of side F(k)·2u/√3 holds a level-(k−4) frame exactly.
- **Information into levels (rule D).** Every node has its own record. An odd count of parts puts the record in the
  frame's hole; an even count makes it one more part. Parts join three at a time, lightest first, heaviest at A. As
  read on 16 Oct 2026 his planet (31 cities, 71 places, 602 works, 3,076 leaves) is level K = 12, 123.4 drawings
  across, mean size error 0.513 levels, worst 3.575. The site's files have changed since (`docs/v2/cityplaces.json`
  lists 34 places on the game's branch and 37 on the site's; `museums.json` took the 23 Oct intake);
  `U/wf6/check-levels/c4_ruleD.py` reruns it.
- **In the game.** The ladder and the crux stand in the row by the tree. The sight's holding circles are levels 2–4 (F
  = 8, 13, 21). The world is not built by the ladder yet.
- **Source.** `U/wf6/levels/NOTES.md`, `levels.json`, `CHECK.md` (the closure caveat); `U/wf6/check-levels/`;
  `U/arnell/unit/UNIT.md` §1, §2(a).

### 3. Colour and transparency (rule 3: "transparency between colors to form other colors")

- **Rule.** A face's tone is set by the way it looks. In the drawing: x grey 128, y black 0, z white 255. In the game:
  up white, east-west grey, north-south black.
- **Relation.** The grey is the Average of the white and the black: round(255/2) = 128. Two films crossing make new
  colours: grey over white #C0C0C0, grey over black #404040, black over white #808080.
- **The face film.** A ray that enters a solid crosses a film in its face's tone T_a. Behind it, in the same block, is
  the first bar of the unit; if the ray leaves that block without meeting one, the bulk m(v) = Σ|v_i|T_i / Σ|v_i|,
  each family as seen from the eye's side. The pixel is round((T_a + B)/2). The ray never leaves its first block: 6
  bar tests a pixel, no walk to the blocks behind. Far off, a face is round((T_a + m(v))/2).
- **Numbers.** See-through 0. The far form is within 0.66–3.1 levels of the walk it replaces. From the crux the faces
  show only 0, 64, 128, 192 and 255; from a player's view 14–28% of face pixels do (61–109 distinct values). All
  measured on the one-block rule.
- **In a material.** Lit L = 0.75c + 0.25 and shaded D = 0.42c stay as they are. The grey face becomes M = (L + D)/2 =
  0.585c + 0.125. Today's M = c agrees with that only at c ≈ 0.301 (computed here). For a white material the side
  faces fall from 1.00 to 0.71. That is every style of his palette (all style 0) and most of the world's. Two of the
  world's styles shade otherwise, and the rule gives them other numbers: leaves (style 3, D = 0.55c) M = 0.65c + 0.125;
  a gallery's plaster (style 11, L = c, D = 0.78c) M = 0.89c, against today's 0.9c.
- **Stacks.** Behind k films a colour weighs 2⁻ᵏ; at 8 films a mass is solid.
- **Swept and stepped surfaces.** A swept surface (V3) keeps its section edge's tone: exact from the eye, 0 px. A
  surface made of units takes VS = Σ max(0, n_i v_i)T_i / Σ max(0, n_i v_i): mean error 1.94 levels, against 41.98 for
  squared normals (SQ). SQ is wrong for both.
- **Warm and cool (rule 6).** The pair is the album covers' sun glow #FCE5AE and its complement #031A51: the covers'
  (rule 4), not a colour measured from the Cézanne paintings. Those files are lost, and the shades measured from them
  (#747361, #565750) are olive greys. The pair's Average is #808080, the drawing's grey. Each face family is tinted by
  the Average of no tint and its pair colour over that grey, kept at luminance 1 (Rec. 709 on display values; computed
  here):
  - lit faces × (1.062, 0.997, 0.844): today's hand tint is (1.06, 0.97, 0.84);
  - shaded faces × (0.856, 1.006, 1.365): today's is (0.86, 0.89, 1.12);
  - grey faces × 1: today's is (0.99, 0.96, 1.00).
  The lit faces change by 0.03 at most. The shades change four ways at once (OKLab on mid grey; computed here): they
  get lighter (luminance 0.90 to 1.00, about 11%), stronger (chroma 0.046 to 0.074), bluer and less violet (hue 279°
  to 267°, out of the 270–300° that `U/wf6/pearl/CHECK.md` calls blue-violet). Rule 6's "blue-violet shades" describes
  the painting he sent and stays true; what would no longer hold is the game's own wording: the README's "cooled toward
  blue-violet" and the same words in the comment above `tone()` in `rocket.js` (reworded in steps 3.3 and 3.6). It is
  a choice, shown to him.
- **The washes, on his body.** Three washes of diamonds at his own ladder's sizes, 144/233, 1 and 610/233 m (his
  levels 8, 9 and 11): today's φ⁻¹, 1 and φ² to five figures, so the sizes do not change. The second is turned 60°,
  the drawing's own angle (today 36°, a pentagon's). Each diamond takes the pair's light or dark tint above by the
  parity of its cell, (i + j) mod 2, at its edge coverage times 0.675 (today's mean opacity). Each wash is a film over
  the face's own colour, a glaze: it multiplies that colour by its tint, at its coverage. The washes are laid one
  after another, each over the colour the last left, so where they overlap their glazes multiply. The tints' own
  products (the glaze at full strength, k·alpha = 1) are light over dark × (0.909, 1.003, 1.152), light over light ×
  (1.127, 0.995, 0.712) and dark over dark × (0.732, 1.012, 1.864). At the stated amounts k·alpha is at most 0.31, and
  where the first two washes cross at their diamonds' middles light over dark gives × (0.981, 1.001, 1.041), light over
  light × (1.035, 0.999, 0.913) and dark over dark × (0.920, 1.003, 1.218) (computed here). So a crossing only
  strengthens or weakens the warm or the cool: the pair are complements about the drawing's grey, and every product of
  them lies on the one warm–cool line (OKLab hue 85–88° or 259–269°). Light over dark nearly cancels (chroma 0.004–0.008,
  under either diamond alone). Today's crossings do make a third hue: its warm over its cool is a rose-violet (hue 351°
  at mean opacity, 321° at full; computed here), since today's two tints are not complements. A third hue needs two
  tints that are not complements; the pair scaled to a top channel of 1 gives none (hue 264°, computed here). Rule 3's
  "transparency between colors to form other colors in relation to the shading of the shape" is met by the faces'
  films (the relation above), not by the washes. What the washes lose is today's third hue, against the words CLAUDE.md
  and rule 6's Applied use for them ("translucent washes mixing into new colours where they overlap"; "translucent
  washes that mix into new colours where they overlap — the artist's transparency"): a loss shown to him as one, and
  those two texts reworded only on his yes (step 3.6). Today's × 1.22 goes, since tints at luminance 1 do not
  darken. The dabs run at 1220/233 and 754/233 a metre (2F(15)/F(13) and 2F(14)/F(13): today's
  2φ² and 2φ to the shader's three decimals) in cells of 55/233 m (233/55 a metre, today's φ³). A cell's strokes are
  shifted half a stroke where (i + j) is odd.
- **The washes, in the world** (after approval). The world's ladder: 5/8, 1 and 21/8 m, dabs at 21/4 and 13/4 a metre
  in cells of 1/4 m (F(3)/8 m, three levels below the block as his 55/233 m is below his). It is the world ladder's
  size nearest today's φ⁻³ = 0.236 m, but 5.9% larger: the world's ladder is coarse there, and only the dabs' strokes
  shift at its cells.
- **Interference colour is the head's.** No built thing takes a film whose colour turns with the eye. His cloth's
  eight tints are the head's film read once, at normal incidence, so they stay put. Which tint a cell takes is the
  head's own thickness noise (pearl.js's copy of pearl.glsl's, pinned to the cell's centre over the head's radius): a
  hash, the same every time, set by no relation in the information. It is read here as the head's, lent to his cloth,
  and kept (a reading he can overrule).
- **Source.** `U/wf6/colour/NOTES.md`, `CHECK.md`, `unit_colour.json`, `cezanne_check.json`;
  `U/wf6/solids/solids.json` (SURFACE_FILM_RULE, GAME_BLOCK, FAR_FACE); `U/wf6/pearl/CHECK.md`; `R/rocket.js` (bar(),
  tone(), wash(), paint()); `R/pearl.js` (palette(), build()).

### 4. Texture: what "consequential" means (rule 5)

- **Rule.** The texture is what follows from the unit at the screen's limit. Near, the unit's bars, each face a film
  over the bar behind it in its block. Further off, the face film's closed form. On large masses past that, the unit
  again at F(j) blocks: the smallest F(j) whose bars are 8 px or more, stepped down until its cell is wholly filled.
  Cells are anchored to each form's own corner. Cézanne's paint lies over all of it, and the game's Glyph Light, as its
  session describes it, would read all of it (below; inferred until its build is seen).
- **Relation.** A bar closes between 8 and 3.64 pixels wide (smoothstep(0.0125, 0.0275, uPx·dist)). That is a factor
  of 2.2 = φ^1.64, so about 1.64 levels are in transition at any distance. `levels.json`'s 1.44 takes the band's end
  as 4 px (8 to 4 is φ^1.44); the code's ends at 3.64 px.
- **Numbers.** A unit of F m shows its bars (8 px or more) out to these distances (computed here). On the game's phone
  (390 × 844 at density 2 and quality 0.75: 1,266 rows, focal 904.0 px): 1 m to 11.3 m, 2 m to 22.6, 3 m to 33.9, 5 m
  to 56.5, 8 m to 90.4, 13 m to 146.9 and 21 m to 237.3. On a computer (720 rows, focal 514.1 px): 6.4, 12.9, 19.3,
  32.1, 51.4, 83.5 and 135.0 m. The study's table (focal 602.7 px) was an 844-row phone, which the game never draws.
- **On Mr Pearl.** From the third-person camera (3.456 m, `thirdDistance()`) a pixel is 6.7 mm on a 720-row computer
  and 3.8 mm on the game's 1,266-row phone (computed here). Bars of 8 px need a filled cube of 21 of his cells on a
  computer and 13 on a phone. His largest filled cube is 6 cells, in the torso, so the largest Fibonacci cell that
  fits him is 5 (computed here, at both cell sizes). So in play the unit shows on him as his cells' steps and his
  faces' three films. His bars are fully open within 0.22 m of the camera on a computer and 0.39 m on a phone, and
  closed beyond 0.49 m and 0.85 m, at 8/233 m (0.86 m on the phone at today's φ⁻⁷; the rest the same to 0.01 m).
- **Source.** `U/wf6/solids/solids.json` (TEXTURE_LEVEL_RULE), `U/wf6/solids/CHECK.md`; `R/rocket.js` (lod,
  `thirdDistance()`, `resize()`, `init()`'s quality); `R/pearl-body.json` (draw.closing).

### 5. Solids: cube, sphere, pyramid (rule 2: "approach the form of a cube or sphere or pyramid")

- **Cube.** A cube of side F(k) blocks, every block the unit under the face film. At 3, 8 and 21 it has 27, 512 and
  9,261 units. Seen from the crux its outline matches the ideal cube's at 0.998, 0.999 and 0.9997.
- **Pyramid.** Stepped, of height F(k), layer j from the top a square of side 2j − 1 (its base 2F(k) − 1). 35, 680 and
  12,341 units. Built over ideal 0.972, 0.996 and 0.9994.
- **Sphere.** The voxel sphere of radius F(k) (2F(k) across): a block is in it if its centre lies within F(k). 136,
  2,176 and 39,024 units. Built over ideal 1.2025, 1.0146 and 1.0060. Its 2R layers are not equal in area (they range
  25%, 56% and 60% of their mean). Its outline varies 12.7% at R = 3; the head's varies 0.26%. A built sphere always
  reads as built.
- **Relation.** Every size is Fibonacci. With its cells anchored at its own corner, a cube of F(k) is tiled by units
  of F(j) exactly where j divides k (F(j) divides F(k) then, checked for j and k from 3 to 29).
- **What the unit cannot make.** Turned about its median it sweeps a 60° cone. Two copies at 90° hull a square pyramid
  whose face slant over half-base is √7. It never sweeps a sphere. That is what sets it apart from his head.
- **The cube in the drawing.** Each tribar is three edges of a cube from one corner to the opposite one. A cube's 12
  edges are 4 such paths. The cube's hexagon of three rhombi appears only at the dial's end (H = 1/2); the face film
  is that end made a film.
- **In the game.** The R = 3 voxel sphere is the row's sphere and the pearl he throws.
- **Source.** `U/wf6/solids/NOTES.md`, `solids.json`, `CHECK.md`; `U/arnell/unit/UNIT.md` §3.

### 6. Mr Pearl, built of it (rule 4: "use the center character as the form to experiment on")

- **Rule.** Everything of him but his head is cells of the unit at one level.
- **Relation.** His cell is the leaf, ladder level 2, and the 1 m block is a level-9 frame of his cells, matched
  outline to outline: the outline of a level-2 leaf (F(6) = 8 thirds) is to the outline of a level-9 frame (F(13) =
  233 thirds) as his cell is to the block. The outline is the measure because it is what each level's holding circle
  holds (radius F(m+4)u/√3: the circles that meet at the crux, and that the sight draws). Side to side would give 3/89
  m (1.8% smaller), hole to hole 1/34 m. So a cell is F(6)/F(13) = 8/233 m, and a metre is 29.125 cells: seven ladder
  levels down. The level is set by his narrowest solid part, the glove's finger (0.0301 m). Of his ladder's sizes,
  8/233 m is the nearest to it.
- **Numbers.**
  - The cell is 0.034335 m. It is φ⁻⁷ = 0.034442 m now, 0.31% larger.
  - A cell is his if its centre lies inside him, after parts thinner than √2 cells (0.0486 m) are thickened to it.
  - Rebuilt at 8/233 he is 3,613 cells (3,595 now), 94 gold rib cells (96 now), rows 0–48 as now (computed here).
- **His form.** It is fitted to cover 1: outline match 0.9417. The top of his head stands at φ m, and that sets his
  whole scale (`scale.form_relation`): exact φ, in the head's family. Brim to head is 0.39787/0.24565 = 1.6197, and
  head top to shoulders 1.618/0.99988 = 1.6182: measured on cover 1, +0.10% and +0.01% off φ (within 0.11%), not set
  (computed here). CLAUDE.md and
  design-rules.txt (rule 7, Applied) write them "= φ"; that is read as these measurements. His leg is 0.6256 m, 1.2%
  over 1/φ, not set.
- **His colour.** Each part takes its cover-1 median, solved so that it shows on screen as on the cover. The pearl
  cloth (suit, hat, shoes, the guitar's body) is in 8 tints of the head's film, spread 0.047 in OKLab. The hat and its
  band would take the jacket's cloth (#b7a8a0, from #b29d8a), as cover 2 shows one cloth: shown to him.
- **His walk.** Stride 2L. Thigh 30°, knee φ·30° = 48.54°, hip drop 0.0838 m, twist 7.08°.
- **What he throws.** The R = F(4) = 3 voxel sphere of his cells: 136 units, radius 0.1030 m at 8/233 (0.1033 now),
  2.38 times smaller than his head. It takes the finished unit with him, as does the pearl in his raised glove. The
  coins and the guards are the world's and keep today's toning and colour (the coins bound to today's palette). The
  coins keep today's cell too (φ⁻⁷ m, `coinH()`), so nothing of them changes; the guards, built of his parts, take
  his cells.
- **Source.** `R/pearl-body.json`, `R/pearl.js`; `U/wf6/pearl/NOTES.md`, `CHECK.md`; `U/wf6/check-pearl/NOTES.md`.

### 7. The head (rule 5: "the only perfect Sphere in the game")

- **Rule.** One exact sphere, solved per pixel. It is never built of units, never tessellated and never painted.
  This page asks that it stay out of the game's glyphs too (a reading he can overrule: rule 5 and CLAUDE.md's "left
  unpainted" speak of the unit's texture and Cézanne's paint, and his ask of 27 Oct names no exception).
- **Relation.** It is the one outline the same from every point of view. The figure closes only from one eye; the head
  is that eye. Holographic mode is the head leaving the body.
- **Numbers.**
  - Radius 0.24565 m, centre 1.37239 m, top at φ m.
  - Eyes: vertical ovals of half-width 0.080 R and half-height 0.220 R (0.16 R by 0.44 R), 29.3° apart on the equator.
  - Film: thickness 342.14 nm, spread 0.2092, indices 1.1638 on 1.3539 (optical path 796 nm). Lit by the covers' own
    two lights held to the view (uRig 1).
  - The fit's error is about 2 px (the check), not the rms 1.0 px the file states.
  - As the hologram it lifts one diameter, 0.4913 m. The hat falls 0.432 m onto the bare neck.
- **Source.** `R/pearl.js` (HEAD_FS), `R/pearl-body.json` (head, holographic_mode); `U/wf6/pearl/CHECK.md`.

## The texture the player sees: Glyph Light

The artist, 27 Oct 2026, sending the Glyph Light artifact: "Implement this as the aesthetic for the artist website,
DRIFT, DRIFT Poetry, Holographic Mr Pearl and morphology. The content should remain the same for each, what changes is
how the aesthetic texture of what is being displayed is achieved."

- **The game's own.** The game's session, which owns the game's code, is building Glyph Light into the game itself.
  Its words to the artist, 27 Oct 2026: "That's what I'm building into the game: the same ramp and additive glow, and
  each glyph coloured by what it covers. The part that's yours is size by distance: near, a thing breaks into a couple
  of big characters; far, the glyphs shrink below a pixel and it reads as itself. That includes the monarch." Its ramp
  is Glyph Light's own, ' .:-=+*#%@'. It was neither pushed nor published at 19:55 UTC, and is not on
  `claude/holographic-pearl-sight-wip` as read at 20:53 UTC (head d9d563bd). This page describes it and prescribes
  none of it. What the unit and his rules would ask of any Glyph Light in the game are the five asks below. The game's
  session has not been held to them and has not said whether its build meets them; it can hold its build to them, or
  not.
- **The asks.**
  1. **No glyph on his head's own pixels**, the one thing seen as it is (a reading he can overrule: "Readings he can
     overrule"). Rule 5: "His head/Holographic mode will be the only perfect Sphere in the game"; CLAUDE.md: "the head
     alone is left unpainted". Neither speaks of glyphs, and his ask of 27 Oct names no exception. The ask is his head's
     own pixels. A circle round it (the site's `keep`) would meet it, and would also leave unglyphed whatever crosses in
     front of the head (the hat's brim seen from behind him, an arm, the guitar); whether what crosses in front is
     glyphed, and whether the additive glow crosses onto the head, are the session's to weigh, shown to him. With the
     sight up his head is the glass and is not drawn, so the ask has nothing there to hold; if its build glyphs the
     canvas there, the world through the window is glyphs (inferred; what of `#hud` lies over it, ask 3).
  2. **Each glyph follows what it covers.** Its character follows the lightness of what it covers, and its colour that
     thing's hue: the faces' tones (up white, east-west grey, north-south black, and their films' Averages) and the
     paint over them. The additive glow brightens what is over its threshold; it is measured and reported, not required
     to be nothing. So glyphs that meet this ask take their lightness and colour from the unit's tones, and their forms
     from Glyph Light's ramp, not from the unit: near, where a glyph is wider than a bar or a face, the unit's bars and
     its solid faces would give way to characters (on black if its build draws them as the site's engine does: inferred)
     (weak list). *Consequential*: Etymonline gives it "from consequent (Latin consequentia) + -al"; *consequent* is
     from Latin *consequi*, "to follow after" (*com-*, "with, together", + *sequi*, "to follow"); Lewis and Short's
     first sense of *consequor* is "to follow, follow up, press upon, go after, attend, accompany, pursue". In English,
     "following as an effect or result" is the sense of the 1650s; the word's first, of the 1620s, was "not direct or
     immediate" (Etymonline, "consequential"). In lightness and colour, glyphs that meet this ask are consequential in
     both senses: they follow from the unit's tones, at one remove. In their shapes they are not. His head, which no
     relation determines, gives them nothing to follow. (Corrected 27 Oct 2026: this page had glossed *consequi* "to
     follow closely" and called the result sense the word's first.)
  3. **Every word and control that is a page element stays above them**, as drawn: the start and end cards, the
     labels, the buttons, the bearing line. `#hud` is one canvas (`overlay()`): the smoke, the flame, the stick's water,
     the crosshair, the sight's window and its ring of figures, and the wake-up's lines. Which of it the glyphs read is
     the session's choice (readings, the HUD).
  4. **Far off, a thing reads as itself**: the ask is that there be a distance beyond which it does, as the session says
     its size by distance (the artist's part of the session's build, as it put it) makes it. The unit also closes with
     distance: its bars are open near and give way to the face film's closed form further off (property 4). Where the
     glyphs' size crosses property 4's distances (a 1 m block's bars open within 11.3 m on the game's phone and 6.4 m on
     a computer, his within 0.39 m and 0.22 m) is measured and told him, as information, not passed or failed. The cells
     this page had borrowed from the site (5 and 6 CSS px), and the distances at which a bar or a dab filled one, no
     longer apply.
  5. **A tapped work's label shows its picture as it is.** Whether the works on the walls are glyphed is the session's
     choice; the label, a page element, is asked to show its picture unglyphed, so a work is never only glyphs.
- **With the paint (rule 6).** The paint is what the glyphs would read, and, as the session describes them (each glyph
  coloured by what it covers), its colours would carry in theirs (ask 2): the warm lights, the cool shades, the washes'
  diamonds. A dab's stroke (about 5 cm across) would survive only where a glyph is no wider than a stroke, which the
  glyphs' size at that distance decides. His head, left unpainted, is asked to be left
  unglyphed too. Precedent cuts both ways. Knowlton and Harmon's *Studies in Perception I* (Bell Labs, 1966) carried a
  whole figure in small symbols, read from a distance. Harmon and Julesz ("Masking in visual recognition", *Science*,
  1973) showed that the sharp edges of coarse cells mask the picture they carry. Under size by distance as the session
  describes it, the masking would fall near, where a thing is a couple of big characters, and lift far, where the
  glyphs shrink below a pixel.
- **The site's engine.** The [Artist Website](https://9gn957ptsb-alt.github.io/Art-Database/v2/), DRIFT, DRIFT Poetry
  and Morphology Web took Glyph Light today from a separate engine, `docs/v2/glyphlight.js` (commit 9f900326 on
  `claude/artist-website-dev-s92irf`: a post-process over a page's canvases, with a `keep` option for circles left as
  drawn, and the works' photographs kept as drawn), there if the game's session wants it.
- **Not waiting.** He asked for it directly, so it does not wait on the unit: it changes how the game is seen, not the
  unit's form, tones or paint. The unit's step 2 waits for it instead, since both edit `rocket.js` (step 1).

## Decided, and why

1. **The form.** V3 with 90° bends is the lone unit, shown in the row. The built unit is the straight six-bar lattice
   that every block and his cells already are, with no curves and 10.17% off the drawing from its eye. Only V3 closes
   on its own and has rule 1's curves (2.1% off, the floor); the lattice is what is built, and V3 has never been tried
   tiled or in a shader. Whether a tiled mass closes is untested; it is not claimed. The trade is named in the
   question (step 2.12).
2. **The bend.** 90° arcs of radius H on [2H, 1 − 2H], with a straight run of 0.2492. The drawing is the same as
   measured (0 px; margin about H/2), and every curve is still a stated circle. The bar stays twice as thick (0.707
   against 1/3) and the bend twice as gentle. The check showed the 109.47° profile was a choice, not forced.
3. **H.** 1/9 for the unit. It is the only value that gives exact thirds. The homage and The Figure in 3D keep their
   0.11: they came before the unit, the difference is about 1%, and changing them would touch the SketchUp twin for no
   visible gain. The row's ladder takes 1/9 when the row is next rebuilt.
4. **His cell.** 8/233 m, not φ⁻⁷: rule 7 makes everything built Fibonacci, and his ladder puts his cell at level 2.
   The change is 0.31%. It waits behind the switch until he approves.
5. **One ladder to an anchor.** What is painted on him takes his ladder's sizes (144/233, 1 and 610/233 m; dabs at
   1220/233 and 754/233 a metre in cells of 55/233 m), which are today's φ values to five figures, now stated as
   Fibonacci. The world's blocks keep theirs: today's until approval, then the world's ladder (5/8, 1 and 21/8 m; 21/4
   and 13/4 a metre; cells of 1/4 m, 5.9% over today's φ⁻³, the coarse ladder's nearest). In built forms exact φ goes,
   approximated in integers within 1.2%. The 36° turn (a pentagon's, so φ's) becomes the drawing's 60°.
6. **Exact φ that stays, by reading.** Rule 7 is read as covering built forms and their sizes, not motions, speeds,
   times, camera distances or sizes on the screen. So exact φ stays in his walk's knee (φ·30°) and twist; HOLO_D = φ;
   HOLO_V and HOLO_V_IN; the guards' speeds (`var GUARD = {`); the fire (`IGNITE = {`); space (`var SPACE = {`,
   `spaceTurn()`, `markDrop()`); and the stick's water (`function Water()`). The head top at φ m, and the two
   proportions measured at φ within 0.11%, are the head's family.
7. **Built spheres.** The voxel sphere, R = F(k). Bands of figures stay only for flat rings, such as the sight's
   frame. It keeps the axis tones at 6 tests a pixel, where turned figures blur to mid grey at 18–28. This changes
   CLAUDE.md's "built spheres are bands of figures", so it is his to approve: put to him with the question (2.12),
   and written in only with the words of step 3.6.
8. **Transparency on built things.** The face film, in the entry block only, tried on Mr Pearl first. It is the only
   rule found that is solid, keeps the three faces apart and makes new tones by overlap (the films' Averages), at 6
   tests a pixel. It is visible, so he is shown it.
9. **The grey face.** The Average of the lit face and the shaded face, the drawing's own shading. Shown with item 8.
10. **Warm and cool.** Set by the covers' pair, not by hand. The lit faces change by 0.03 at most. The shades get
    lighter, stronger, bluer and less violet: a choice, shown to him as one.
11. **The washes.** No hash. A diamond is light or dark by its cell's parity, at its coverage times 0.675. A wash is a
    film over the face's own colour (a glaze), and the washes are laid in turn, so their overlaps multiply. The pair
    are complements, so a crossing only strengthens or weakens the warm or the cool, where today's crossings make a
    rose-violet (property 3): a loss against today and against CLAUDE.md's and rule 6 Applied's "new colours where
    they overlap", not against rule 3, which the faces' films meet; named in the question as one, and those words
    reworded only on his yes (3.6). PURPOSE says
    nothing is random. The × 1.22 goes.
12. **The unit's thin film (253.2 nm).** Not used. Colour that turns with the eye stays the head's. Its thickness
    rested on cuts no one stated, and its shader was lost. Not using it keeps what he sees.
13. **Consequential texture.** Defined as in property 4. The game's Glyph Light, as its session describes it, would take
    its lightness and colour from it (ask 2), and its forms from its own ramp.
14. **The unit on him in play.** One level. Whether his bars show is set by the screen's limit, not chosen: from 3.456
    m his bars need a filled cube of 13 cells on a phone and 21 on a computer, and his largest is 6. He is shown both
    views.
15. **Texture levels in the world.** After approval, a hybrid. Inside the opening (round the camera, and round him at
    his 1/4 and 1/32 of 21 Oct) the holes stay as today, so he still sees into the blocks near him; past it come the
    face film and the Fibonacci levels, anchored to each form's own corner (not the world's origin, which the check
    refuted). Levels cross-fade over the lod band. Fullness is read from per-level bit textures, capped at the largest
    full cell the place has. Sizes come from uPx·dist. He sees one world picture before the world takes it.
16. **Information into levels.** Rule D stays: it is the best of four measured (mean error 0.513 levels). Unequal
    joins wait until the planet is built.
17. **A leaf above level 2 in a 1 m world.** The scaled drawing, filled in level-2 blocks. Built with the world.
18. **The ladder's thin slabs in 3D.** Accepted. Like every figure here, a level reads as one only from its eye. The
    solids give solidity.
19. **The hat.** The jacket's pearl cloth, behind the switch, named in the question.
20. **The head's light.** The covers' rig (uRig 1), as now. pearl-body.json's text is corrected to say so.
21. **The head on the crux's circles.** Not adopted. It sets no size, and his head is placed by the covers' fit.
22. **The smile as the viewer's ring.** Offered once after approval, off by default.
23. **The homage's second and third figures.** They take the section-edge tone rule (SQ is wrong) when the world is
    next built, asked of him on its own with before and after pictures (step 3.4). Until then they stay as he saw them.
24. **The page's marks** drawn by `figure()` (the blocks to place, the pieces, the title's mark, the crosshair and the
    sight's ring of figures). Drawn as the cut reading after approval, asked of him on its own with before and after
    (step 3.4). From the eye it is the drawing exactly, and it costs three planes.
25. **Planets.** Held until the worlds are defined, then voxel spheres of R = F(k) with texture levels.
26. **Lost sources.** Regenerated by the scripts where they can be. The vector reading cannot be committed: it can
    only be rebuilt analytically from the model (the straight model with 4 of its 12 overlaps swapped), and checked
    against the original only if he sends the drawing again.
27. **The switch.** UNIT ships 0, and nothing of the unit goes live before his yes: the new cell, hat and lift sit in
    pearl-body.json's `proposed`, laid on only while UNIT is 1. Every "before" picture comes from the commit step 2 is
    applied to, by one recipe, never from the switch or the published Artifact; `unit(0)` is checked against them,
    pixel for pixel as 2.0 compares, none off by more than 1 level.
28. **What is his.** The pearl he throws and the one in his glove take the unit with him. The coins are the world's
    and do not change: today's cell (`coinH()`, φ⁻⁷ m, whatever UNIT is), toning and colour (bound to today's palette,
    `me3.palToday`, since their colour is his rib's); whether a coin is built of his cells again is asked with the
    world (3.3). The guards keep today's toning and their grey, but are built of his parts, so they take his cells.
29. **The head's measures from the file.** Those that pearl-body.json holds become the head shader's uniforms, set
    every draw. Nothing seen changes.
30. **Glyph Light.** The game's session builds it now, its own way. This page only asks five things of it, which the
    session has not yet been held to, and asks it for an off switch. It does not wait on the unit; the unit's step 2
    waits for its push, since both edit `rocket.js`.
31. **Approval.** One question to him, with pictures: is this the unit? It is his gate ("We do not move forward until
    we figure out the basic unit"). The yes covers him and the row. The world's changes (decisions 15, 23 and 24, and
    the words of step 3.6) are each asked of him on its own later; the readings he can overrule and decision 7 are put
    to him with the question. Once he approves, the held Snøhetta idea is proposed again, once.

## Readings he can overrule

Put to him with the question, one line each (step 2.12).

- **His head out of the glyphs.** Rule 5 and CLAUDE.md's "left unpainted" speak of the unit's texture and Cézanne's
  paint; his ask of 27 Oct names no exception. Keeping his head out of the glyphs is read from them (the site's engine
  made its `keep` for it), not said by him (ask 1).
- **The works on the walls.** Rule 5 has no exceptions. The works are read here as pictures because they are the
  information itself, and they stay as they are under the unit. Whether the game's Glyph Light reads them is its
  session's choice (the site's engine keeps the works' photographs as drawn); a tapped work's label shows its picture
  unglyphed (ask 5).
- **What the unit does not reach.** Water and notes are surfaces in the shader (its `if (st == 6 || st == 10)` branch,
  which no step touches), and the flame and space's stars are drawn in 2D on `#hud`. They stay as they are, so rule 5
  is unmet for them.
- **His cloth's tints.** Chosen cell by cell by the head's own film noise, a hash: kept as the head's, lent to him.
- **Exact φ in motions** (decision 6).
- **The sight's window.** If the game's Glyph Light reads the canvas there (inferred), the world seen through his head
  (the glass) is glyphs; only a drawn head is asked to be left unglyphed (ask 1).
- **The HUD.** `#hud` is one canvas (`overlay()`): the smoke, the flame, the stick's water, the crosshair, the sight's
  window and its ring of figures, and the wake-up's lines. Whether the game's Glyph Light reads it is its session's
  choice. Rule 5 would have the smoke and the stars read, and the crosshair and the sight's ring too, since they are
  figures of the unit; the wake-up's lines are words (ask 3). Glyphing some of it and not the rest means splitting it.
- **Built spheres** (decision 7): voxel spheres, where CLAUDE.md says bands of figures; his to approve.

## Not yet in the game

Anchors are text as it stands on `claude/holographic-pearl-sight-wip` (d9d563bd,
read 20:53 UTC), never line numbers: another session is editing `rocket.js`, and every anchor is checked again on the
commit step 2 is applied to. Harness runs take `NODE_PATH=/opt/node22/lib/node_modules`; "a computer" is the
harness's 1280 × 720 at density 1, "a phone" its 390 × 844 at density 2 with touch, opened at the game's own quality
0.75 (1,266 rows). `H/game.js`'s `open()` holds a phone at 0.5 unless told, so every phone run passes `quality: 0.75`
and asserts `debug().quality()` and the canvas's height. The same steps stand alone in
`apply_steps.md`.

Who, and when:
- Step 1 is the game's session's: it owns the game's code and is building Glyph Light into it now. It does not wait on
  his answer, since he asked for it directly.
- Step 2 edits `rocket.js` and `pearl.js`, the files that session is changing for Glyph Light. It waits for that
  session's Glyph Light push (or its word that step 2 may go first), and is handed to that session to apply, or applied
  with its agreement on top of its pushed head. Everything step 2 changes that can be seen stays behind a switch that
  ships off; the rest (2.2(a)'s corrections of fact, 2.6's head uniforms, 2.11's README paragraph, the FS's uUnit
  branches run at 0, the coins' own cell) ships as it lands and is checked to draw as before (2.6, 2.9).
- Step 3 waits on his yes, and each of its changes to the world is asked of him on its own (2.12).

### 1. Glyph Light: the game's session builds it

Glyph Light: the game's session builds it (its own approach, above).
Nothing of it is written here. Where an ask below is not met, the game's session is sent the picture and the ask, and
its code stays its own.

1.1 Asked of the game's session: a switch in `Rocket.debug()` that turns its Glyph Light off, whose off state draws the
canvas exactly as the commit before it did. It has not promised one. Until there is one, step 2's comparisons are
made as 2.0 says (on the frame under the glyphs where it can be read, else reported rather than held to 1 level), and
s and w are measured as 2.7 says.

1.2 Its build, once pushed, beside the same frames with the glyphs off where 1.1's switch allows, on a computer and a
phone, in third person, as the hologram and with the sight up, against the five asks above: (1) no glyph drawn on his
head's own pixels; whether the glow crosses onto the head, and whether what crosses in front of it is glyphed, are the
session's to weigh, shown to him; (2) each glyph's character follows the lightness of what it covers and its colour that
thing's hue; the glow is measured and reported, not required to be zero; (3) every word and control that is a page
element as without the glyphs; what is drawn on `#hud` is the session's to read or leave; (4) some distance beyond which
a thing reads as itself; where the glyphs' size crosses property 4's distances is measured and told him as information,
not passed or failed; (5) a tapped work's label shows its picture as it is.

### 2. The finished unit, on Mr Pearl first (rule 4), behind a switch that ships off

UNIT is 0 by default. With it 0 the game draws as before (checked in 2.9). Nothing visible in the world, the homage or
the row changes either way, but for what is built or sized by his cell: the guards, the sight's ring and space's guns
(2.5).

2.0 **The "before" pictures**, before any edit step 2 makes, on the exact commit step 2 is applied to (its hash
recorded; shot again if that commit changes before step 2 lands). Never from the published Artifact (a different
bundle: `scripts/build_rocket_artifact.js` inlines the game with base `data/` and only the forms and buildings), which
serves only to show him the game as he plays it; never through a switch. The list is in 2.10 (third person on a
computer and a phone, the close-ups, the headless body, the row's stones, the closed curve), with the third person and
the hologram out added on both, and a coin framed with him out of it. Each keeps its frame's state
(`Rocket.debug().cam()`, `.P`). One recipe for before and after, in `H/game.js`: virtual 25, its clock pinned within a
frame (`performance.now` returning the frame's virtual time; today it runs on in real time for up to 0.8 of a frame),
`flush()`, `holdView`. Each frame is taken two ways (only the comparisons hide the page's elements; the pictures shown
him hide only its controls, its labels, buttons and cards, never a canvas the glyphs are drawn on):
- **To compare**, the GL canvas read with `readPixels` right after the frame's callback in game.js's
  `requestAnimationFrame` wrapper (a new `window.__grab`; `getContext("webgl2")` returns the canvas's own context),
  not `P.screenshot`, so no page element, toast or compositing enters; and only with no glyphs in it: off by 1.1's
  switch, or drawn by the session's build on a canvas of their own, when the GL canvas holds the frame under them.
  Compared pixel by pixel: none off by more than 1 level, the count within 1 level reported. Where the glyphs are
  drawn into the GL canvas and nothing turns them off, the comparison is made on the frame under them if its build
  keeps one readable; else it is reported (the count within 1 level, and where the larger differences fall) and not
  held to 1 level, since a change of a level under a glyph at a ramp step changes a whole character; such differences
  alone do not call for compiling FS twice (2.9).
- **To show him**, the page as composited, `P.screenshot` with the page's controls hidden, so the glyphs are in it
  wherever its build draws them: as its build has them, and again with them off where 1.1's switch exists.

2.1 The switch. `R/rocket.js`, after the anchor `var PAINT = 1;`:
`var UNIT = 0, MASK = 0, pearlSpec = null;   // the finished unit on Mr Pearl (U/FINAL.md): 0 until the artist approves it`
- Keep the fetched form: before the anchor `try { pearlFrom(res[2]); } catch (err) { me3 = null; }`, `pearlSpec = res[2];`.
- `pearlFrom(spec)`: when UNIT is 1 and `spec.proposed` exists, build from a deep copy of the spec with
  `spec.proposed` laid over it recursively (objects merged key by key, arrays and scalars replaced, so
  `proposed.palette.groups.hat` replaces the hat alone and the other groups, `palette.film` and `palette.K` stay);
  never change the fetched object. Keep `me3.palToday`, today's palette, for the coins (2.5): pearl.js exports no
  `palette`, so take it as pearlFrom takes its own, `PB.build(specToday, { skip: [B.WATER, B.NOTE] }).palette` (the spec
  without `proposed`, the same skip), packed into a `Float32Array(64 * 4)` as pearlFrom packs `pal`
  (`body.palette.forEach(function (c, i) { pal.set(c, i * 4); })`), so a coin's rib id indexes the same entry.
- `Rocket.debug()`: `unit: function (v) { if (v != null && v !== UNIT) { UNIT = v; try { pearlFrom(pearlSpec); } catch (e) { me3 = null; } } return UNIT; },`
  so `unit(1)` rebuilds his body with the new cell, hat and lift, and `unit(0)` puts him back as he was. Its `pearl()`
  also gives `paletteIds: me3.body.paletteIds` (2.7).

2.2 `R/pearl-body.json`.
(a) Corrections of fact, in place (nothing reads them; nothing seen changes):
- `head.relation`: the fit's error is about 2 px (`U/wf6/pearl/CHECK.md`), not the rms 1.0 px it states;
- `head.material.lights`: the covers' own two lights held to the view (uRig 1), as `rocket.js` draws the head;
- `camera`: not read; `rocket.js` `thirdDistance()` solves the distance (3.456 m);
- `scale.leg_relation`: his leg is 0.6256 m (`leg_m`), 1.2% over 1/φ, not set;
- `draw.closing`: at today's cell (φ⁻⁷ m), from the third-person camera (3.456 m, not 3.6); on the game's phone
  (quality 0.75, 1,266 rows) his facades are closed beyond 0.86 m and fully open within 0.39 m; on a 720-row computer
  0.49 m and 0.22 m;
- `draw.fade`: `apply_body_shader.py` is not in the repository; while UNIT is 1 his parts are not drawn in the veil
  pass (he has no holes).
(b) A new block `proposed`, its relation "the finished unit (`U/FINAL.md`, 27 Oct 2026), laid over the fields above
by `rocket.js` only while UNIT is 1; on the artist's yes it is merged into them and removed":
- `unit`: `cell_m` 0.0343347639 (8/233); `thicken_m` 0.0485566888 (√2 × cell); `level` "the leaf, ladder level 2;
  the 1 m block is a level-9 frame"; `relation` "the outline of a level-2 leaf (F(6) = 8 thirds) is to the outline
  of a level-9 frame (F(13) = 233 thirds) as his cell is to the 1 m block; the outline, because it is what each
  level's holding circle holds (side to side would give 3/89 m, hole to hole 1/34 m)"; `consequences`
  { `units_tall_to_hat_top` 49.4, `bar_mm` 3.43 }; `occupancy` as now, with 0.0486 m for 0.0487 m;
- `draw.closing`: at 8/233 m, closed beyond 0.85 m and fully open within 0.39 m on the game's phone, 0.49 m and
  0.22 m on a 720-row computer;
- `palette.groups.hat` and `.band`: `srgb` "#b7a8a0", `film` true, relation "cover 2 shows hat, suit and shoes as one
  cloth; cover 1's hat median carries reflected sky and sunset";
- `palette.relation`: "each group's colour is solved so that, drawn as the finished unit draws a face (a film in its
  tone over its first bar or the bulk, Averaged, tinted by the Cézanne pair and washed), it shows on screen as the
  covers show that group" (for the line that calls c the mid tone of east and west faces);
- `palette.tones`: `s` and `w`, empty until 2.7 measures them, and `palette.tones.relation` "s, the shares of his
  pixels by entry face (up, down, east-west, north-south), and w, the means of the ray's shares by the same four, per
  palette group, measured by `H/unit.js` from the third-person camera" (for the line on FAR_SLANT and FAR_ON);
- `palette.lift_relation` (the path the file uses, beside `palette.tones`): "each group's colour c is solved, a
  channel at a time, from shown(c) = W_paint × ½ [Σ_f s_f t_f T_f(c) + Σ_i w_i t_i T_i(c)] (`U/FINAL.md`, step 2.8);
  where a channel asks for more than 1, the median's own hue at the game's white; for less than 0, the median's own hue
  at the t that gives its luminance" (for the FAR-table formula).

2.3 `R/rocket.js`, the pair, after the anchor `var PAINT = 1;`:

```js
  // The Cezanne pair: the covers' sun glow #FCE5AE and its complement #031A51, which Average to the drawing's grey.
  // Each face family's tint is the Average of no tint and its pair colour over that grey, at luminance 1 (Rec. 709).
  function pairTint(rgb) {
    var t = rgb.map(function (v) { return (1 + v / 128) / 2; }), y = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
    return t.map(function (v) { return v / y; });
  }
  var TINT_LIT = pairTint([252, 229, 174]), TINT_SHADE = pairTint([3, 26, 81]);   // (1.062, 0.997, 0.844), (0.856, 1.006, 1.365)
```

2.4 `R/rocket.js` FS (anchor `var FS = [`): `uniform float uUnit;` beside the anchor
`uniform int uSteps; uniform int uVeil; uniform float uPaint;`. Under `uUnit > 0.5` only (his pass; every other draw
keeps 0):
- (a) `bar()` (anchor `vec3 L = min(vec3(1.0), c * 0.75 + 0.25), M = c,`): M = (L + D) / 2. His palette is all style
  0 (`pal.push([…, 0])` in `pearl.js`), so on him M = 0.585c + 0.125.
- (b) `tone()` (anchor `vec3 tone(int ax, float s) {`): lit TINT_LIT, shaded TINT_SHADE, grey vec3(1.0), written
  into the string from the two arrays.
- (c) The face film, in `main()`'s solid branch (anchor `if (lod >= 1.0) { col = far; } else {`). No walk beyond the
  entry block: test the six bars of `c = ivec3(floor(p0 - n * 0.5))` from tin = 0 to its exit, 6 tests, no DDA step.
  T_a = the entry face's tone, `bar(vB, vF >> 1, s)` times `mix(vec3(1.0), tone(vF >> 1, s), uPaint)` with s the sign
  of N[vF] on its axis (scaled by uPaint as `paint()` and today's `far` scale it, so `debug().paint(0)` still shows the
  drawing alone). B = the first bar met there, toned the same way; if none, B = m(v) =
  (|d.x| T_ew + |d.y| T_y + |d.z| T_ns) / (|d.x| + |d.y| + |d.z|), T_y the up face's where d.y < 0 and the down
  face's where d.y > 0, each toned the same way, d in the grid's frame. Nothing is discarded: res 2 does not discard
  under uUnit. near = (T_a + B) / 2.
- (d) far = (T_a + m(v)) / 2, toned the same way, in place of the FAR_SLANT and FAR_ON mix (anchors
  `vec4 fw = mix(FAR_SLANT[vF], FAR_ON[vF],` and `vec3 far = fw.x * bar(vB, 1, 1.0)`).
- (e) col = mix(near, far, lod), then washed once at the entry face's uv for near and far alike:
  `paint(col, the entry point, vF >> 1, 1.0, mpp, false)`, `shaded` false since every film is toned already. The
  (1 − 0.07k) depth darkening does not arise: k is always 0.
- (f) The washes and dabs under uUnit, in `wash()` and `paint()` (anchors `vec4 wash(vec2 q)` and
  `vec3 paint(vec3 c, vec3 p, int ax, float s, float mpp, bool shaded) {`): sizes 144.0 / 233.0, 1.0 and
  610.0 / 233.0; the second turned 60°, `mat2(0.5, 0.8660254, -0.8660254, 0.5)` for the 36° `T`; a diamond's tint
  TINT_LIT where `mod(cell.x + cell.y, 2.0) < 0.5`, else TINT_SHADE; its alpha its edge coverage `e` times 0.675; laid
  as `c = mix(c, c * tint, k * alpha)`, the three in turn, without the × 1.22; the dabs
  `fract(dot(uv, vec2(1220.0 / 233.0, 754.0 / 233.0)) + 0.5 * mod(q.x + q.y, 2.0))` with `q = floor(uv * 233.0 / 55.0)`.
  No `h21` under uUnit.
- (g) Debug values, for 2.7 only, returned before the haze with alpha 1: uUnit 2 writes red the entry face's family
  and sign as a code over 255 (up 1, down 2, east-west 3, north-south 4) and green the palette id `vB` over 255; uUnit
  3 writes red |d.x| / Σ, green 0.5 + 0.5 d.y / Σ (its sign kept), blue |d.z| / Σ, with Σ = |d.x| + |d.y| + |d.z| in
  the part's frame. They are read only from 2.7's own framebuffer, where no pixel is an average.
- (h) The uniform list (anchor `"uAxA", "uAxB", "uHeadC", "uHeadE", "uNear", "uPaint"].forEach`) gains "uUnit".
- (i) `gl.uniform1f(U.uUnit, 0);` after `gl.uniform1f(U.uPaint, PAINT);`, in both places that line stands (the frame
  and space's frame).

2.5 `R/rocket.js`, `drawPearl()` and its neighbours:
- `drawPearl(now, veil, mask)` (a third argument, 0 but in 2.7's mask pass, where it also changes the order: 2.7):
  `gl.uniform1f(U.uUnit, mask || (UNIT ? 1 : 0));` before his parts (anchor `gl.uniform4fv(U.uPal, me3.pal);` inside
  `drawPearl`) and `gl.uniform1f(U.uUnit, 0);` after them (anchor
  `// The place's own again, for whatever walks the place's grid after him.`).
- The veil pass skips his parts while UNIT is 1: `if (drawMe.body && !(veil && UNIT)) {`.
- `drawPearls()` (the pearls he throws and the one in his raised glove; anchor `function drawPearls(now) {`): the same
  uUnit after its `gl.useProgram(prog);`, and 0 before the anchor
  `// the place's own again, as drawPearl leaves them`. They are his.
- The coins are the world's, so under either UNIT they keep today's size, toning and colour. `drawCoins3()` keeps
  uUnit 0 and binds `me3.palToday` in place of `me3.pal` (anchor `gl.uniform4fv(U.uPal, me3.pal);` inside
  `drawCoins3`): its coins are coloured by his rib's id (`coinGrid()`), whose colour the new lift moves. Their cell is
  today's whatever UNIT is: after the anchor `function pearlR() { return THROW.RU * unitH(); }`,
  `function coinH() { return Math.pow(PHI, -7); }   // the coins' cell: today's, whatever UNIT is (they are the world's)`,
  and `unitH()` becomes `coinH()` in `coinRO()` (anchor `function coinRO() { return round(PEARL.headR / unitH()); }`),
  in `coinR()` (anchor `function coinR() { return coinRO() * unitH(); }`) and in `drawCoins3()` (anchor
  `var PB = window.PearlBody, h = unitH(), n = coinCh.n / 2,`), whose `PB.S(h)` and `pxW / h` then draw a coin at
  today's size. So a coin is 7 cells of φ⁻⁷ m (radius 0.2411 m) under either UNIT, taken (`coinsStep()`) and tapped
  (`coinAt()`) at today's reach through `coinR()`; under UNIT 1 its cells are no longer his (φ⁻⁷ m against 8/233 m),
  and its hole (3 cells, 0.1033 m) is 0.32 mm wider than his pearl (0.1030 m), which still passes it (computed here).
- `drawGuards()` keeps uUnit 0 and its own palette (`guardPal`: every colour 128, which no lift reaches). The guards are
  built of his parts (`me3.parts`, posed by `PB.pose(body, …)`) and their heads of `coinRO()`'s 7 cells at its
  `h = unitH()`, so under UNIT 1 they take his new cells (8/233 m, 0.31% smaller), their toning and grey as today.
- `unitH()` (anchor `function unitH() { return me3 ? me3.body.cell : Math.pow(PHI, -7); }`): its fallback follows the
  switch, `UNIT ? 8 / 233 : Math.pow(PHI, -7)`. The rest that reads it follows his cell, 0.31% smaller under UNIT 1:
  the pearls (`pearlR()`, `stepPearl()`, `drawPearls()`), the sight's ring of figures ("one of his cells tall",
  `drawSight()` on `#hud`) and space's two guns (three of his cells wide, `spaceFrame()`).

2.6 The head's measures from the file (nothing seen changes). `R/pearl.js` `HEAD_FS`: the constants
`pearl-body.json` holds become uniforms: PEARL_D0, PEARL_SIG, PEARL_NF, PEARL_N3, PEARL_FREQ, PEARL_KA, PEARL_FACET and
PEARL_ENV (`palette.film`), PEARL_BASE (`head.material.base_linear`), and EYE_OFF, EYE_HW and EYE_HH (`head.eyes`:
`each_off_face_deg` in radians, `half_width_R`, `half_height_R`). Each equals today's constant to its last digit but
EYE_OFF: radians(14.65) is 0.2556907, the shader's literal 0.25569 (7e-7 apart).
TAU, KD, WRAP, KS, ALPHA, the sun and the covers' two lights stay constants: the file does not hold them. So does
PEARL_EYE: the file's `paint_srgb` #281c16 made linear is (0.0212, 0.0116, 0.0080), not the shader's 0.0118 in
green, so passing it would change his eyes by a hair.
`rocket.js` `initPearl()`: the name list (anchor
`["uVP", "uEye", "uC", "uSun", "uHaze", "uR", "uExpo", "uHolo", "uHead", "uV", "uRig"].forEach`) gains them.
`pearlFrom()` keeps `me3.headSpec = { film, base, eyes }` from the spec it built from, and `drawPearl()` sets them
every draw, right after `gl.useProgram(headProg);`. Never in `initPearl()`: it runs before `pearl-body.json` is
fetched, and a uniform no one sets is 0 (EYE_HW 0 divides by nothing; a D0 of 0 takes the film off). Check: a close
view of the head, before and after, by 2.0's recipe: none off by more than 1 level.

2.7 Measure s and w, before any lift uses them. `Rocket.debug().unitMask(m)` (new): m 2 or 3 turns UNIT to 1 (by
`unit(1)`, keeping the UNIT it found) and sets MASK to m; `unitMask(0)` sets MASK to 0 and puts UNIT back. While MASK
is set, after each frame has drawn as usual, the frame is drawn again into a framebuffer of the mask's own, of the
canvas's size (RGBA8 with depth, no multisampling, so each pixel is one fragment's value, never an average across his
3.4 mm cells: the canvas's own is multisampled, `antialias: true`), cleared to 0 with alpha 0, in three passes, colour
writes off (`gl.colorMask(false, false, false, false)`) for the first two. First the place's depth: the frame's
`drawn` chunks and the rocket, drawn again by `prog` with the frame's own uniforms, so the same discards leave the
same holes and a pixel a tree or a wall hides from the camera is not counted (and `drawGuards` and `drawShards`, so a guard or a
shard between the camera and him hides his pixels as in the frame; the views `H/unit.js` takes keep the homage's and
the studies' figures, the paintings, the coins and the guards out of the line to him). Then `drawPearl(now, false,
MASK)`, which with `mask` set draws in its own order: his head first, by `headProg`, so pixels it hides are not
counted; then `gl.useProgram(prog)` again (today `drawPearl` draws his body first, on the program the frame left
bound, and his head after it) and his body with colour writes on and uUnit MASK; and no `swooshAt` (today called
whenever `veil` is false). Then `gl.readPixels` into `debug().mask()`, and the canvas's framebuffer is bound again.
A new harness script, `H/unit.js`, at the third-person camera, at rest, at 8 yaws, on a computer and a phone: s = the
shares of his pixels (alpha 1) by entry face (up, down, east-west, north-south); w = the means of the ray's shares by
the same four; each per palette group (the id in green mapped to its group by
`debug().pearl().paletteIds`). Write them into `proposed.palette.tones` with the views and the date. If the game's
Glyph Light is a pass over the canvas it does not reach this framebuffer; if it is in the shader and reaches the mask
with no switch to turn it off, a Node computation from the posed meshBlocks faces with a software z-buffer does
instead.

2.8 `R/pearl.js` `palette()` (anchor `var W = P.tones, lift = function (m) {`). When the tones hold s and w (the
proposed block's), solve each group's colour c (as `palette()` lifts each group, `Object.keys(P.groups).forEach`), a
channel at a time, with that group's s and w, from

shown(c) = W_paint × ½ [Σ_f s_f t_f T_f(c) + Σ_i w_i t_i T_i(c)],

with T_up = 0.75c + 0.25 (t TINT_LIT), T_down = 0.8 (0.75c + 0.25) (t 1), T_ew = 0.585c + 0.125 (t 1),
T_ns = 0.42c (t TINT_SHADE). The tints come from `rocket.js`: `PB.build(spec, { skip: …, tints: { lit: TINT_LIT,
shade: TINT_SHADE } })` in `pearlFrom()`, so the lift and the shader read the same numbers. W_paint is the washes'
mean factor, (0.980, 1.001, 1.053) (computed for opacity 0.675 and the three amounts, the grids taken as
independent; the dabs' mean, × 1.0035, left out). Where a channel asks for more than 1, the median's own hue at the
game's white, as today. Where one asks for less than 0, the median's own hue (c = t × m / 255, its channels in
proportion) at the t that gives the median's luminance on screen, clipped to [0, 1 / max(m / 255)]. Without s and
w (UNIT 0), today's lift, unchanged.

2.9 Checks, with `unit(1)` and `unit(0)`. `H/game.js`'s `open()` gains an option `unit` that, once the page has loaded
and `debug().pearl()` answers, calls `debug().unit(v)` and `flush()` (its `init` runs before `rocket.js` and cannot).
- `PearlBody.build` on the spec as laid over (Node, as this page's check ran it; `debug().pearl()` gives the cells):
  3,613 cells, 94 rib cells, rows 0–48 and a largest filled cube of 6 under UNIT 1; 3,595 and 96 under UNIT 0;
- `coinRO()` round(0.24565 / 0.034442) = 7 under either UNIT (`coinH()`), and the coin's hole (THROW.RU 3 of φ⁻⁷ m,
  0.1033 m) still passes his pearl (0.1030 m under UNIT 1);
- UNIT 0 is today's: each before picture of 2.0 shot again with `unit(0)` by 2.0's recipe (the same place, seed, view
  and clock): none off by more than 1 level, the count within 1 level reported. If any is off by more, compile FS
  twice (a `#define UNIT` variant for his passes, the per-frame uniforms set on both), so the world's shader is byte
  for byte as today;
- the coins under `unit(1)` against their before picture (a coin framed with him out of it), by the same tolerance:
  today's cell (`coinH()`), today's palette (`me3.palToday`) and uUnit 0, so nothing of them changes;
- each group's median on screen (the normal frame, read as 2.0 reads a comparison, masked by group from 2.7) against
  the colour the lift aims at, the group's `srgb` in the spec as laid over (the covers' medians, as
  `U/wf6/pearl/bases.json` measured them; the hat and its band #b7a8a0 under UNIT 1, not bases.json's #b29d8a), at least
  as close as today's lift gets in the before pictures;
- `H/smoke.js`, `landing.js`, `smash.js`, `coins.js`, `space.js`, `guards.js`, `sight/sight.js`, `sight/hat.js`: no
  page errors, on a computer and a phone, UNIT 0 and 1;
- frame time on the phone at quality 0.75, UNIT 0 and 1: `smash.js`'s frame times taken with a sync point (a one-pixel
  `readPixels` at the end of the timed callback; today `__ft` times only the callback's submission on SwiftShader,
  where a heavier shader cannot show), and on a real phone, which only he has: whoever applies step 2 sends him,
  before the question (2.12) and apart from it, two private scratch Artifacts built by
  `scripts/build_rocket_artifact.js` into the scratchpad (never the game's own Artifact), one with `var UNIT = 0` and
  one with `var UNIT = 1` written into its bundle, each with a corner readout of `Rocket.debug().quality()` and
  `.walk()` added to the scratch copy only; he plays each for a minute and says whether its readout fell (quality from
  0.75 to 0.5, or the walk from 8 steps: the game's own rule, `if (slow > 45 && quality > 0.5)`). A third scratch
  Artifact, built from the commit step 2 is applied to (timed in the harness too), is the baseline he plays first. A
  fall at UNIT 0 that the baseline does not have calls for compiling FS twice, as above; a fall only at UNIT 1 comes
  from his own pass (the face film), which that does not cure, and is reported to him with the question (2.12) as the
  unit's cost on his phone.

2.10 Pictures after (`unit(1)`), by 2.0's recipe: each compared as 2.0 compares, and shot for him as 2.0 shoots for
him (composited, the glyphs as its build has them, and off where 1.1's switch exists), as he would play it:
- third person on a computer and a phone;
- close up where his bars open: the camera 0.20 m from his nearest surface on a computer (fully open within 0.22 m),
  0.35 m on a phone (within 0.39 m), both outside NEAR (0.08 m). The third-person camera never comes that near by
  itself. As the hologram (`debug().toggle()`) the camera stands HOLO_D (φ m) behind the head along
  d = lookDir(yaw, pitch − AIM), the look lowered by AIM (19.3°) (`holoCam()`), so for a camera at the chosen point P
  the head goes at P + HOLO_D · d (`debug().head()`: its x, y and z). P is more than HAT_REACH + R_C from his head's
  seat, where his body is still drawn, and at least 1 + R_C high (holoCam's floor). Wait until `debug().cam().camD`
  has reached HOLO_D (it grows at HOLO_V, and `clearTo` shortens it where blocks stand behind the head), then check
  `cam().eye` against P and `cam().drawMe.body` before shooting;
- the headless body seen from the hologram;
- the row's four stones, unchanged;
- the closed curve with 90° bends beside today's 109.47° one, from its stone and from 20° and 45° round it: a scratch
  copy of `scripts/unit_studies.py` with three edits: `arcs()` returns `(X / (1 − 4H), 3Y)` from the first two values
  of `U/wf6/check-reconstruct/check4.py`'s `path()` (90° arcs of radius H, a straight run √2/3 − 2H; its X ends at
  1 − 4H, as check4 itself normalises it); `curve()`'s `s0, s1` become `2H, 1 − 2H`; and it writes its `studies.json`
  to the scratchpad, never `docs/`. Checked first from its stone as the row is (`scripts/check_homage.js --studies` on
  a scratch copy of `R/` holding it): 0 px off the drawing, as `alt90.json`. The harness serves it in place of the
  row's (`page.route`). Nothing committed;
- the hat named: the pearl cloth of his suit (#b7a8a0, from #b29d8a);
- with the glyphs on (the composited picture), where a glyph is smaller than one of his faces: whether his three face
  families fall on three different steps of the ramp. Reported, not a check of the session's build. At the branch head
  they cannot: on his near-white cloth today's M = c puts the up and east-west faces at luminance 0.92 and 0.89, a third
  of a step apart; M = (L + D) / 2 puts the east-west face at 0.66 (on the jacket's mean colour today, its grey faces
  untinted as the pair leaves them; computed here).

2.11 `R/README.md`, `## Mr Pearl, and the two views`: a short paragraph on the finished unit (behind UNIT, off), its
cells of 8/233 m, the face film and the Cézanne pair, pointing at `U/FINAL.md`. This page goes to `U/FINAL.md`.

2.12 Bring him the pictures and one question: is this the unit? The yes covers him and the row. Name what it covers:
- everything built stays the straight lattice: the block and his cells have no curves and are 10.17% off the drawing
  from its eye; the curved, closed form (2.1% off, the measuring floor) stands only in the row, and has never been
  tried tiled or in a shader;
- his suit in three planes (tops light, sides halfway, fronts and backs dark) with nothing seen through, the cloth still
  flecked with the pearl's tints;
- shades lighter, stronger, bluer and less violet;
- washes quieter: diamonds in a regular checker of two tints, warm and cool of one brightness, at one strength, the
  second wash turned 60° (from 36°); where they cross they only strengthen or weaken the warm and the cool, where
  today's crossings make a rose-violet, so CLAUDE.md's "translucent washes mixing into new colours where they overlap"
  (and rule 6's Applied) would no longer describe his washes until reworded (3.6); the dabs in a regular brick of
  half-strokes;
- the hat in the suit's cloth; the pearl in his glove and the pearls he throws change with him; the guards, built of
  his parts, take his new cells in their own grey, and the sight's ring and space's guns are 0.31% smaller; the coins
  stay as they are;
- in the row, the closed curve's gentler bends, no longer pinched thin at them (its thinnest section 0.707 of the bar,
  from 1/3), and the ladder study at the unit's H (1/9 for 0.11, 1%).
Nothing in the world, the homage or the row changes until he answers. What would follow in the world is asked of him
later, each on its own with its own before and after: the face film on a place (3.2, 3.3), the homage's second and
third figures and the page's marks (3.4), and the words of CLAUDE.md and the rules (3.6). In the same message: the
readings he can overrule, one line each ("Readings he can overrule"), decision 7's change to CLAUDE.md
("voxel sphere" for "bands of figures"), his to approve with them (written in with 3.6's words, not asked again), and
one line on Glyph Light: near, where in the session's words a thing breaks into a couple of big characters, the
unit's bars and its solid faces would give way to characters (on black if its build draws them as the site's engine
does: inferred, its build not yet seen), against rule 2's "appear solid" and rule 5's texture, his to weigh.

### 3. After he approves (the world), each asked of him on its own

3.1 `R/pearl-body.json`: merge `proposed` into its fields and remove it; UNIT = 1, or the switch folded away. The
comments that say φ⁻⁷ say 8/233 m and 0.0343: anchors `(phi^-7 m, the level of his narrowest part, the glove's
finger)` (`pearl.js`), `at his own level (phi^-7 m, the cells he is built of)`,
`one of his cells tall (phi^-7 m at the head's distance)` and
`His body is the game's own figure seven golden steps down` (`rocket.js`), and the README's
`His body is the game's own block seven golden steps`, whose "3,595 of them" becomes "3,613 of them" (49 cells from his
shoes to the top of his hat stands). The coins' comment (anchor `A coin is his head's outline built of his cells`)
keeps its `round(0.2457 / 0.0344) = 7`, and its "built of his cells" and "in his unit" become "of today's cell
(φ⁻⁷ m, `coinH()`)", until 3.3 asks. Rebuild and republish the Artifact.

3.2 One world picture first: a place under the face film beside the same place today, shown to him and asked before
the world takes it.

3.3 The world's blocks take the face film past the opening. Inside it (round the camera, and round him at his 1/4 and
1/32 of 21 Oct) the holes stay, res 2 discarding as today, so he still sees into the blocks near him. With it,
M = (L + D) / 2 on every style (on leaves, style 3, D = 0.55c, so M = 0.65c + 0.125; on a gallery's plaster, style 11,
L = c and D = 0.78c, so M = 0.89c, against today's 0.9c), the pair, the washes on the world's ladder (5/8, 1 and
21/8 m; dabs at 21/4 and 13/4 a metre in cells of 1/4 m) and the hybrid texture levels (decision 15). The
FS comment above `vec3 tone(int ax, float s)` is reworded with it (its `those it makes black cooled toward
blue-violet` and `each diamond its own tint between the warm and the cool, mixing into new colours where they
overlap`), for the covers' pair, the parity, the ladder's sizes, the 60° turn, and crossings that strengthen or weaken
the warm and the cool. Asked with it: whether the coins (`coinH()`, today's φ⁻⁷ m: an exact φ in a built thing, which
rule 7 as read here would not keep) are built of his cells again.

3.4 Asked on its own, with before and after of the homage's third figure from its stone and of the marks: the page's
marks drawn by `figure()` (the blocks to place, the pieces, the title's mark, the crosshair and the sight's ring of
figures) as the cut reading; the homage's second and third figures toned by the section-edge rule.

3.5 The row (in the yes of 2.12): the closed curve on 90° arcs and its ladder at H = 1/9. Their signs, each file by
its own text. `R/studies.json`: the ladder's "lengths of 1, 2, 3, 5, 8 thirds of a block" becomes "… thirds of the
study's figure"; the closed curve's "in the third of its length that nothing else in the drawing covers, on arcs of
stated circles" becomes "in the middle of its length, from two ninths to seven ninths, on arcs as wide as the bar".
The README's `## The unit's studies, in a row beside your tree`: the ladder's "lengths of 1, 2, 3, 5, 8 thirds of a
block" likewise; the closed curve's "stated circles, in the third of its length nothing in the drawing covers" becomes
"circles as wide as the bar, in the middle of its length, from two ninths to seven ninths".

3.6 Words, each asked of him on its own, but for decision 7's, put to him with the question (2.12) and only written in
here once he has said yes to it. `U/unit/design-rules.txt` (rule 7, Applied) and CLAUDE.md: "voxel sphere" for a
built sphere (for "bands of figures", decision 7); the 90° arcs; brim : head and head top : shoulders "measured at φ,
within 0.11% (brim : head +0.10%, head top : shoulders +0.01%)"; exact φ "the head's family, and by reading the
motions, speeds and camera distances". CLAUDE.md's "translucent washes mixing into new colours where they overlap"
(its Cézanne line) and rule 6's Applied "translucent washes that mix into new colours where they overlap — the
artist's transparency": reworded with the README's split, for his body on his yes and for the world only with 3.3 (until
then the world's washes still cross into rose-violet and it has no face films): on him, the washes' crossings strengthen
or weaken the warm and the cool, and the transparency that forms other colours is the faces' films (rule 3). The README's Cézanne paragraph: its "cooled toward blue-violet" and
"each diamond its own tint between the warm and the cool, mixing into new colours where they overlap" reworded as the
FS comment is in 3.3 (on his yes for him, his ladder's sizes, the covers' pair; with 3.3 for the world).
`U/wf6/levels/levels.json`: 1.44 levels in transition becomes 1.64. `U/wf6/solids/CHECK.md`: its 1.60% for the game's
figure corrected (9.2% by an independent raster, 10.17% by the reconstruction).

3.7 Then the planet by rule D, when the worlds are defined. The smile as the viewer's ring offered once, off by
default. The held Snøhetta idea proposed again, once: its condition is the unit's approval.

## What is weak

- **The form.** V3 has never run in a shader. Its arcs are oblique cylinders (quadratic ray tests). Off its eye it is
  a thin zigzag, not a solid. The built unit is the straight lattice, still 10.17% off the drawing at three crossings
  from its eye, and no study has tiled either form, so tiled closure is unknown. The record contradicts itself on the
  lattice (1.60% in `U/wf6/solids/CHECK.md`) until that file is corrected.
- **The bend's margin** is about H/2, measured on another profile (smootherstep), not on the 90° one.
- **The face film** has only been run in numpy. It halves contrast toward the bulk. The five clean values hold only
  from the crux. Half-up rounding at the .5 middles has never been tested on a phone's GPU.
- **The Average** is the closest rule by mean error but the worst by matched pixels: 83.9% within 2 levels, against
  89.9% for opaque. The films read as the drawing plus 22.6% crossing bands.
- **The pair** is the covers', not the paintings'. Its tints were computed with Rec. 709 weights on display values.
  The shades leave blue-violet. The paintings agree with the pair in direction only. Being complements, the pair's
  washes make no third hue where they cross, where today's make a rose-violet (property 3), so CLAUDE.md's and rule 6
  Applied's "new colours where they overlap" no longer hold for them until he says yes to rewording them (3.6).
- **Hand-set numbers left in the paint:** the wash amounts (0.46, 0.38, 0.30), the opacity 0.675 (today's mean), the
  dab strength (0.07). The 60° turn is the drawing's angle, but nothing measured asks for a turn at all. The washes
  come out quieter than today's: at a diamond's middle the first wash now makes the shade 11% bluer, where today's
  cool, at its mean opacity, darkens by 12% (computed here).
- **The lift** waits on s and w, not yet measured. Its low-end rule is untested, and the washes' mean factor assumes
  their three grids are independent. The mask that measures them (step 2.7) and the frame times on SwiftShader
  (step 2.9) are not a phone's GPU; only the minute on a real phone is.
- **His cloth's tints** are still chosen by a hash, kept as the head's.
- **The ladder.** A level is a thin slab that fans into blades off its eye. Closure at every level is true by
  construction, not evidence that the nest reads as one form elsewhere; in raw perspective it does not close. Rule D
  gives equal corners whatever their weights (worst 3.6 levels). Its places are museums only, and its counts are of 16
  Oct. Nothing yet ties an information level to a solid's texture level.
- **Texture levels** cost 1–6 fullness fetches a pixel. Per-form anchoring and the per-level bit textures are
  untested.
- **The voxel sphere's** layers are unequal in area, and at R = 3 it is 1.20 times the ideal.
- **On Mr Pearl in play** his bars can never show; only the films and his cells' steps do.
- **His film** reads as mottled foil, a little yellow-green and short of blue-violet (hue match 0.73 and 0.81). The
  head fit's error is about 2 px, and cover 2 has the head 10% larger.
- **His walk** keeps exact φ in two angles, by reading.
- **The coins** keep today's φ⁻⁷ m cell under UNIT 1 and after his yes, an exact φ in a built thing, until 3.3 asks;
  meanwhile a coin is not built of his cells (3.1 rewords the game's comment that says it is).
- **Lost sources.** The drawing, its classified pixels, the vector reading, the covers, the two paintings, form.json,
  unit.glsl, pearl.glsl and every render stayed in old containers. No match against the original can be rerun from the
  repo; the drawing checks rerun only against the cut reading.
- **Glyph Light.**
  - It is not on the branch yet (d9d563bd at 20:53 UTC), so none of the five asks has been tried; the game's session
    has not been held to them, nor has it promised the off switch step 1.1 asks for. Without one, where the glyphs are
    drawn into the game's canvas, step 2's comparisons are made on the frame under them if it can be read, else
    reported rather than held to 1 level (2.0).
  - Where size by distance makes a thing a couple of big characters (the session's "near"), the glyphs, not the bars,
    are what is seen; whether that reaches property 4's distances (a 1 m block's bars open within 11.3 m on the game's
    phone, his within 0.39 m) is not known (ask 4: to be measured and told him). Where it does, the unit's texture and
    its solidity (rule 2's "appear solid") would give way to characters (on black if its build draws them as the site's
    engine does: inferred), and Harmon and Julesz's masking would fall there too: a tension between his ask of 27 Oct
    and rules 2 and 5 that only he can settle, put to him (2.12).
  - The ramp has ten steps and the drawing three tones: which steps the tones fall on is set by the game's levels, not
    measured here. At the branch head his up and east-west faces are a third of a step apart (luminance 0.92 and 0.89,
    M = c on his near-white cloth; computed here), so they cannot fall on three steps whatever the glyphs do; under
    the unit's M = (L + D) / 2 the east-west face is at 0.66 (2.10 reports it).
  - The additive glow brightens what it covers and may cross onto his head: the session's choice.
  - A circle round his head (the site's `keep`) would meet ask 1 and also leave unglyphed whatever crosses in front of
    the head (the hat's brim, an arm, the guitar): the session's to weigh.
  - If the glyphs' grid is fixed to the screen, what moves shimmers cell to cell, as on the site (not known for the
    game's).
  - Its cost on a phone is the game's session's to measure; step 2.9's frame times are taken with the glyphs on.

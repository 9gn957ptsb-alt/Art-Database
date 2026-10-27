# Holographic Mr Pearl: the steps, in order (27 Oct 2026)

Paths: `R/` is `docs/worlds/rocket/`, `H/` is `notes/holographic-mr-pearl/harness/`, `U/` is
`notes/holographic-mr-pearl/unit/`. Anchors are text as it stands on `claude/holographic-pearl-sight-wip` (d9d563bd,
read 20:53 UTC), never line numbers: another session is editing `rocket.js`, and every anchor is checked again on the
commit step 2 is applied to. Harness runs take `NODE_PATH=/opt/node22/lib/node_modules`; "a computer" is the
harness's 1280 × 720 at density 1, "a phone" its 390 × 844 at density 2 with touch, opened at the game's own quality
0.75 (1,266 rows). `H/game.js`'s `open()` holds a phone at 0.5 unless told, so every phone run passes `quality: 0.75`
and asserts `debug().quality()` and the canvas's height.

Who, and when:
- Step 1 is the game's session's: it owns the game's code and is building Glyph Light into it now. It does not wait on
  his answer, since he asked for it directly.
- Step 2 edits `rocket.js` and `pearl.js`, the files that session is changing for Glyph Light. It waits for that
  session's Glyph Light push (or its word that step 2 may go first), and is handed to that session to apply, or applied
  with its agreement on top of its pushed head. Everything step 2 changes that can be seen stays behind a switch that
  ships off; the rest (2.2(a)'s corrections of fact, 2.6's head uniforms, 2.11's README paragraph, the FS's uUnit
  branches run at 0, the coins' own cell) ships as it lands and is checked to draw as before (2.6, 2.9).
- Step 3 waits on his yes, and each of its changes to the world is asked of him on its own (2.12).

## 1. Glyph Light: the game's session builds it

Glyph Light: the game's session builds it (its own approach: FINAL.md, "The texture the player sees: Glyph Light").
Nothing of it is written here. Where an ask below is not met, the game's session is sent the picture and the ask, and
its code stays its own.

1.1 Asked of the game's session: a switch in `Rocket.debug()` that turns its Glyph Light off, whose off state draws the
canvas exactly as the commit before it did. It has not promised one. Until there is one, step 2's comparisons are
made as 2.0 says (on the frame under the glyphs where it can be read, else reported rather than held to 1 level), and
s and w are measured as 2.7 says.

1.2 Its build, once pushed, beside the same frames with the glyphs off where 1.1's switch allows, on a computer and a
phone, in third person, as the hologram and with the sight up, against the five asks of FINAL.md: (1) no glyph drawn on
his head's own pixels; whether the glow crosses onto the head, and whether what crosses in front of it is glyphed, are
the session's to weigh, shown to him; (2) each glyph's character follows the lightness of what it covers and its colour
that thing's hue; the glow is measured and reported, not required to be zero; (3) every word and control that is a page
element as without the glyphs; what is drawn on `#hud` is the session's to read or leave; (4) some distance beyond which
a thing reads as itself; where the glyphs' size crosses property 4's distances is measured and told him as information,
not passed or failed; (5) a tapped work's label shows its picture as it is.

## 2. The finished unit, on Mr Pearl first (rule 4), behind a switch that ships off

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
readings he can overrule, one line each (FINAL.md, "Readings he can overrule"), decision 7's change to CLAUDE.md
("voxel sphere" for "bands of figures"), his to approve with them (written in with 3.6's words, not asked again), and
one line on Glyph Light: near, where in the session's words a thing breaks into a couple of big characters, the
unit's bars and its solid faces would give way to characters (on black if its build draws them as the site's engine
does: inferred, its build not yet seen), against rule 2's "appear solid" and rule 5's texture, his to weigh.

## 3. After he approves (the world), each asked of him on its own

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
21/8 m; dabs at 21/4 and 13/4 a metre in cells of 1/4 m) and the hybrid texture levels (FINAL.md, decision 15). The
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

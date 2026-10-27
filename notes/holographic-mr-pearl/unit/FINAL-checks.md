# What each check changed (27 Oct 2026)

The three checks in `checks.json`, in its order: A = fidelity to his verbatim rules, B = numbers, C = buildability.
One line each. Where two checks gave different fixes for one thing, the line says which was taken.

- **A1** (blocking; before pictures not today's, and cell, hat and lift going live): fixed by both of its fixes. Every before picture comes from the current build before any edit (steps 1.1, 2.9's 0 px check); the new cell, hat and lift sit in pearl-body.json's `proposed`, laid on only while UNIT is 1, and `unit(v)` rebuilds him (2.1). The hat is named in the question (2.10, 2.12; decision 19).
- **A2** (blocking; overlapping washes Average to no colour): fixed. Each wash is a glaze multiplying the colour under it by its tint, laid in turn, so an overlap gives a colour (light over dark × (0.909, 1.003, 1.152)). Of its two fixes (the Average of the colour through each wash, or multiplied glazes) the glazes were taken: the code already mixes its washes so, and every overlap differs from both diamonds by construction. The cloth's hash is said exempt as the head's own noise (a reading he can overrule); the wash amounts are listed as hand-set.
- **A3** (blocking; the unit in no picture, the close-up too far): fixed. The pictures add the closed curve with 90° bends beside the 109.47° one, from its stone and 20° and 45° round it; the close-ups are at 0.20 m on a computer and 0.35 m on a phone, reached as the hologram (2.10).
- **A4** (blocking; the lattice called V3's tiled reading): fixed. The paragraph, property 1 and decision 1 say the built unit is the straight lattice (10.17%) and V3 the lone unit's form, shown in the row; tiled closure is said untested.
- **A5** (two ladders): fixed. One ladder to an anchor: on him 144/233, 1 and 610/233 m, dabs at 1220/233 and 754/233 a metre in cells of 55/233 m (today's φ values to five figures); 5/8, 1 and 21/8 m only on the world's blocks (property 2, 3; decision 5).
- **A6** (shade change undersold; the pair is the covers'): fixed. The shade change is told in full (luminance 0.90 to 1.00, chroma 0.046 to 0.074, hue 279° to 267°, out of blue-violet), the pair is labelled the covers', and the move is shown to him as a choice. Taking the paintings' own shade was not possible: their files are lost, and the shades measured from them are olive greys.
- **A7** ("exact" φ; CLAUDE.md's φ proportions; φ elsewhere): fixed. "Approximated in integers, within 1.2% and nearer at each level"; the proportions "measured at φ within 0.1%", with CLAUDE.md and design-rules.txt edits after approval (3.6); exact φ in motions, speeds, camera distances and screen sizes kept by reading and listed by anchor (decision 6).
- **A8** (phone numbers at quality 1): fixed. 1,266 rows: 3.8 mm a pixel, 13 cells, open within 0.39 m, closed beyond 0.85 m; the 602.7 px table re-derived for the game's phone and a 720-row computer (property 4).
- **A9** (holes near him against solid films): fixed. Inside the opening the holes stay (res 2 discards as today) and the face film starts past it; one world picture is shown to him first (decision 15; 3.2, 3.3).
- **A10** (decision 17 against CLAUDE.md): dropped; it is not the unit's.
- **A11** (the works as an exception to rule 5): fixed. Recorded as a reading he can overrule, not a decision.
- **A12** (the span's margin; symmetry numbers from another form; the studies' sign): fixed. "Measured: 0 px, margin about H/2"; symmetry and node gap rerun here on the 90° form (9e-16, 4e-16); the closed curve's sign in studies.json and the README is on the rewording list (3.5).
- **A13** (the thrown pearl and the coins): fixed. The thrown pearl and the pearl in his glove take uUnit with him; the coins and the guards keep 0, said; "nothing visible in the world changes" (2.5; decision 28).
- **B1** (blocking; the walk steps up to 8 blocks): fixed. Under uUnit only the entry block is tested, 6 tests and no DDA, B its first bar or else m(v) (property 3; 2.4(c)).
- **B2** (phone at 1,688 rows; the 602.7 table): fixed as A8; the old table is named the study's 844-row phone.
- **B3** (largest cube 5): fixed. 6 cells, the torso (rerun here at both cell sizes), so the largest Fibonacci cell is 5.
- **B4** (1.60% against 10.17%): fixed. 10.17% kept; the contradiction stated with the independent raster's 9.2%; the correction of solids/CHECK.md listed (3.6).
- **B5** (tiled closure unmeasured): fixed. The bars "run on into the next block's"; tiled closure untested (property 1, weak).
- **B6** (two ladders): fixed as A5.
- **B7** (the dab's and the wash's hashes; a too-strong glaze; "cells of 34/8"): fixed. The dab's phase by parity (half a stroke where (i + j) is odd); the wash's alpha its coverage times 0.675; the glaze uses the faces' own tints at luminance 1, so no doubled blue; cells of 8/34 m in the world and 55/233 m on him. Of the alpha's rules offered (parity or coverage only here; the hash's mean, 0.675, in C8) coverage times 0.675 was taken: it keeps today's mean strength.
- **B8** (closure at every level is true by construction): fixed. The caveat and the raw-perspective gaps (0.08–1.06) are in property 2 and the weak list.
- **B9** (4e-16 and 9e-16 not measured on the 90° form): fixed. Rerun here on the 90° form (a copy of geom.py with check4.py's profile): 9e-16 and 4e-16.
- **B10** (the desk close-up at 0.4 m): fixed as A3.
- **B11** (masses "F(k) across"; "slant √7"): fixed. Cubes of side F(k), pyramids of height F(k) (base 2F(k) − 1), voxel spheres of radius F(k); "face slant over half-base is √7".
- **B12** (eye ovals): fixed. Half-width 0.080 R, half-height 0.220 R (0.16 R by 0.44 R).
- **B13** (planet counts undated): fixed. "As read 16 Oct 2026", with the files' changes since (34 places, 37 on the site branch; the 23 Oct intake). Not rerun.
- **B14** (line numbers): fixed. Text anchors throughout.
- **B15** (the vector reading cannot be committed): fixed. It can only be rebuilt analytically from the model, and checked against the original only if he sends the drawing again (decision 26).
- **C1** (blocking; `unit(0)` a false before): fixed as A1. Both of its fixes taken: the before from the current build, and `unit(v)` rebuilding him from today's spec or the proposed one.
- **C2** (blocking; the lift before s and w exist): fixed. The order is the shader's debug output (uUnit 2 and 3, `debug().unitMask`), then `H/unit.js` measuring s and w into `proposed.palette.tones`, then the lift; today's lift stays the fallback until then (2.4(g), 2.7, 2.8). The debug output was taken over the Node z-buffer, which is named as the alternative: the shader is what draws.
- **C3** (blocking; the wash glaze at luminance 1 too strong; the 1.22): fixed. One construction, the faces' tints, for both faces and washes; the × 1.22 goes, said. Its overlap rule (the Average, giving (1, 1, 1)) was not taken, for A2's.
- **C4** (blocking; the head's uniforms never set): fixed. The name list extended; the uniforms set every draw in `drawPearl()` after `useProgram`, never in `initPearl()`; every constant the file holds is passed (the film's eight, the base, the eyes' three), and the rest are said to stay because the file does not hold them. PEARL_EYE also stays: the file's paint differs from it in the fourth decimal (2.6).
- **C5** (the lift without the tints, the down faces, a low end): fixed. The solve takes each family's tint, the 0.8 of down faces and the washes' mean factor (0.980, 1.001, 1.053); a low-end rule mirrors the white one (2.8).
- **C6** (drawPearls and the others): fixed as A13; uUnit back to 0 at the end of each draw.
- **C7** (where the washes go in the film; the 0.07k): fixed. Each film toned, Averaged, then washed once at the entry face's uv for near and far alike, `shaded` false; the 0.07k darkening does not arise, as k is always 0 (2.4(e)).
- **C8** (the dab's phase and the wash's opacity): fixed as B7.
- **C9** (anchors; the "seven golden steps" comment; stale texts): fixed. Anchors; that comment added to 3.1; palette.relation, tones' relation, lift_relation and unit.occupancy rewritten in `proposed`; draw.fade and draw.closing corrected in place (2.2).
- **C10** (close-ups and phone numbers; how the camera gets there): fixed as A3 and A8; the camera gets there as the hologram (2.10).
- **C11** (dependants unchecked; frame time): fixed. guards.js, sight/sight.js and sight/hat.js added; the phone's frame time compared; FS compiled twice only if the world slows (2.9).
- **C12** (UNIT on by default): fixed. UNIT ships 0; he sees the unit through the pictures and `debug().unit(1)`; the Artifact is not republished with it until he says yes. Taken over its other fix (publishing it on and telling him), as the safer.
- **C13** (the level's relation unstated): fixed. "Outline to outline", with the reason (the holding circles) and the other readings' sizes (3/89 m, 1/34 m); `body.level` is read by nothing, so a string is safe (property 6; 2.2(b)).

## Aligned with the game session's Glyph Light (27 Oct 2026)

The game's own session owns the game's code and is building Glyph Light into the game itself ("the same ramp and
additive glow, and each glyph coloured by what it covers ... size by distance", to the artist, 27 Oct 2026; not on the
branch at d9d563bd, read 20:17 UTC). This page had prescribed the site's post-process engine for it instead.

- **The section** ("The texture the player sees: Glyph Light") now describes the game's session's approach in its own
  words, and keeps only five checks its build can be held to: his head alone unglyphed (its own pixels, not a circle
  round it); each glyph's lightness and colour from what it covers (the unit's tones and the paint); every word and
  control above; far off, a thing reads as itself (which agrees with the unit's own closing, property 4); the works'
  labels show their pictures whole. Dropped as prescriptions: the set ' 01', the site's settings, the keep circle, and
  the fixed-cell numbers (where a bar or a dab fills a 5 or 6 px cell), which size by distance makes moot. The site's
  engine keeps one sentence.
- **Step 1** (FINAL.md and apply_steps.md) is no code: the game's session builds it; before the unit's steps, check it
  against the five and shoot the before pictures at the branch head. The old 1.2 to 1.12 (bringing the engine over,
  its wiring, the harness hook, the Artifact build, the words, telling him) are the game's session's or gone. Step
  2.7's `debug().glyphs(false)`, a hook only the old step 1 made, is now the switch the game's session gives.
- **Followed:** decisions 13 and 30, the readings (works, the sight's window, the HUD) and the weak list. New weak
  point: near, where the unit's bars open, size by distance shows a couple of big characters, so whether the bars are
  seen at any distance depends on where the glyphs' size crosses property 4's distances.
- **Etymology corrected.** *Consequi* is "to follow after" (*com-*, "with, together", + *sequi*, "to follow":
  Etymonline, "consequent" and "consequence"; Lewis and Short, *consequor*, I: "to follow, follow up, press upon, go
  after, attend, accompany, pursue"), not "to follow closely" (etymologist.ai's gloss, "to follow together, to follow
  closely", not the dictionaries'). And "following as an effect or result" (1650s) is not the English word's first
  sense, which was "not direct or immediate" (1620s; Etymonline, "consequential"). The two dictionaries agree, so it
  is not marked contested. Their own pages are refused to the session; they were read through search results.
- **visible.md**'s first line: the glyphs as the game's session draws them.

## Second verification (27 Oct 2026, 20:53 UTC)

Four checks (fidelity F, numbers N, buildability B, coverage C), 47 problems, each verified against the files first:
the branch still at d9d563bd with no glyph code; `rocket.js`, `pearl.js`, `pearl-body.json`, `studies.json`, `README.md`,
`scripts/unit_studies.py`, `U/wf6/check-reconstruct/check4.py`, `U/wf6/pearl/bases.json`, the harness's `game.js` and
`smash.js`; numbers rerun in `verify/second/calc/` and `verify/second/lum.js`. One line each, in the checks' order.

- **F1** (blocking; visible.md credits the session with the head and the words, and "Now"): fixed. Line 1 says only
  what the session said it is building, that it is not live, and that this page asks for the head and the words, its
  build's answer not known.
- **F2** (blocking; check 4 ties pass or fail to property 4's distances): fixed. Ask 4 asks only for some distance
  beyond which a thing reads as itself; where the glyphs' size crosses property 4's distances is measured and told him
  as information (FINAL ask 4, step 1.2).
- **F3** (blocking; "unchanged" and "as light as" fail the announced glow; three steps impossible near): fixed. Ask 1:
  no glyph on his head's own pixels, the glow's crossing the session's choice, shown to him. Ask 2: character from the
  covered lightness, colour from its hue, the glow measured and reported. The three steps moved to 2.10's pictures, as
  a report.
- **F4** (blocking; the yes commits him to the homage, the marks, the row's ladder and CLAUDE.md, unshown): fixed.
  The yes covers him and the row (both named in 2.12 and visible.md, the ladder's 1% included); the world's film, the
  homage's figures, the page's marks (the crosshair among them) and the words are each asked on their own later with
  before and after (3.2, 3.4, 3.6); the readings and decision 7 go with the question.
- **F5** (blocking; the lattice's lack of curves and its 10.17% not put to him; "built of it"): fixed. 2.12's first
  item, visible.md line 2 and decision 1 name the trade (straight, no curves, 10.17%; the curved form 2.1%, only in the
  row, untried tiled or in a shader); "What is built is"; property 1 says the lattice has no curves.
- **F6** (head unglyphed stated as rule and fact): fixed. "Asks ... to leave unglyphed (a reading he can overrule)" in
  the paragraph, property 7, ask 1, "With the paint"; a reading of its own in the list.
- **F7** (glyphs called the unit's own texture): fixed. Ask 2: lightness and colour from the unit's tones, forms from
  the ramp; near, the bars and solid faces give way to characters on black. In the weak list and the question (2.12).
- **F8** (checks 1 and 3 against the HUD reading; `#hud` one canvas): fixed. Ask 1 is the head's own pixels only; ask
  3 is page elements, `#hud` (`overlay()`: smoke, flame, the stick's water, crosshair, sight's window and ring, the
  wake-up's lines) the session's choice; the HUD reading says splitting it is what half-glyphing would take and that
  the crosshair and the sight's ring are figures of the unit.
- **F9** (the works' glyphing stated as fact; water, notes, flame and stars said to take the unit): fixed. The works'
  glyphing is the session's choice (the site's engine keeps works' photographs); a new reading says water and notes
  (the `st == 6 || st == 10` branch) and the flame and stars (on `#hud`) stay as they are, rule 5 unmet for them.
- **F10** (the off switch never promised): fixed. Step 1.1 asks the session for one whose off state draws as the
  commit before; until then comparisons are taken with the glyphs on, and 2.7's mask does not depend on it (or falls
  back to the Node z-buffer).
- **F11** (step 1 cannot precede step 2 that "waits on nothing"; who edits rocket.js): fixed. "Who, and when": step 2
  waits for the session's Glyph Light push (or its word), and is handed to it or applied with its agreement on its
  pushed head; anchors checked again there.
- **F12** (unit(1) changes more than named): fixed. 2.12 and visible.md name the regular checker of two tints at one
  strength, the 60° turn, the brick of dabs, and the pearls he holds and throws.
- **F13** (visible.md describes the look with the glyphs off; "clean"): fixed. Line 2 says so and that in play these
  show only as glyph colours, unknown until the build lands; "clean" gone, the cloth "still flecked with the pearl's
  tints".
- **F14** (size by distance misattributed): fixed. "The artist's part of the session's build, as it put it".
- **F15** (etymology route): rejected, wording tightened. Etymonline's own entry (read through a search result; its
  page is refused) gives "1620s, 'not direct or immediate,' from consequent (Latin consequentia) + -al (1)", so the
  route through *consequent* is Etymonline's; ask 2 now quotes it exactly, with *consequent* from *consequi*.
- **N1** (draw.closing in place 0.85 m is 8/233's): fixed. In place 0.86 m (φ⁻⁷: 0.8562 m; 8/233: 0.8536 m, rerun);
  the 8/233 values in `proposed.draw.closing`; property 4 says which cell.
- **N2** (brim : head 0.1006% over φ): fixed. "+0.10% and +0.01% off φ (within 0.11%)" in property 6, decision 6
  and 3.6 (1.619662 / φ − 1 = +0.1006%; 1.618194, +0.0099%).
- **N3** (overlap numbers are bare products; third decimals): fixed. Labelled the tints' own products (k·alpha = 1),
  corrected to (1.127, 0.995, 0.712) and (0.732, 1.012, 1.864); the realised crossings at the stated amounts given
  beside them ((0.981, 1.001, 1.041), (1.035, 0.999, 0.913), (0.920, 1.003, 1.218)).
- **N4** (8/34 m off the world's ladder): fixed by the ladder. The world's dab cell is 1/4 m (F(3)/8, three levels
  below the block as 55/233 is below his), said 5.9% over today's φ⁻³ (8/34 was 0.33% off but no world ladder size);
  property 3, decision 5, 3.3.
- **N5** (head placed behind the camera point): fixed. `holoCam()` puts the camera at the head minus HOLO_D · d, d =
  lookDir(yaw, pitch − AIM); the head goes at P + HOLO_D · d, wait for camD, check `cam().eye` (2.10).
- **N6** (arcs() swap scaling): fixed. Three edits stated: `arcs()` returns (X / (1 − 4H), 3Y) from `path()`;
  `curve()`'s s0, s1 = 2H, 1 − 2H; output to the scratchpad; checked from its stone first.
- **N7** (M = (L + D)/2 on leaves and plaster): fixed. Property 3 and 3.3 name leaves M = 0.65c + 0.125 and plaster
  M = 0.89c (against 0.9c); his palette all style 0.
- **N8** (README "3,595 of them" stale): fixed. Added to 3.1 (3,613; 49 cells stands).
- **B1** (blocking; before pictures from another bundle, a moving head, a harness not reproducible to 0 px): fixed.
  2.0: before on the exact commit step 2 is applied to (hash recorded), never the Artifact; one recipe (clock pinned
  within a frame, GL canvas read by `readPixels` after the frame's callback, no `P.screenshot`); none off by more than
  1 level, counts reported; FS compiled twice if any is off by more.
- **B2** (blocking; step 2 edits the session's files; no switch asked for): fixed as F10 and F11.
- **B3** (blocking; MSAA averages ordinal codes; silhouettes; the head left out): fixed. 2.7's mask draws into its own
  non-multisampled framebuffer (alpha 0 clear, alpha 1 written), the head first into depth only, read by `readPixels`,
  so no pixel is an average. Taken over the linear encoding: one fragment a pixel is exact and simpler.
- **B4** (blocking; per part against per group; bases.json's hat): fixed. `uPart` dropped; the mask writes the palette
  id, mapped to its group by `debug().pearl().paletteIds`; s and w, the solve and the check per group, against each
  group's own srgb (hat and band #b7a8a0 under UNIT 1, not #b29d8a).
- **B5** (blocking; smash.js at quality 0.5 and callback time only): fixed. Every phone run at 0.75, asserted; frame
  times with a sync point; a minute on a real phone at UNIT 0 and 1 against the game's own quality rule.
- **B6** (coins bind his palette; the rib's colour moves): fixed. `me3.palToday` kept in `pearlFrom` and bound in
  `drawCoins3`; guards safe (`guardPal` all 128); the coins checked in 2.9.
- **B7** (face tones nearly coincide at the head; three steps impossible): fixed as F3. Rerun here: up 0.92, east-west
  0.89 at the branch head (jacket's mean), 0.66 east-west under M = (L + D)/2; in 2.10 and the weak list.
- **B8** (close-ups: head direction; hip distances): fixed as N5; the camera point is chosen by its distance to his
  nearest surface, outside NEAR, and `drawMe.body` asserted.
- **B9** (arcs() swap): fixed as N6.
- **B10** (draw.closing): fixed as N1.
- **B11** (scripts cannot turn the unit on): fixed. `open()` gains `unit`, calling `debug().unit(v)` and `flush()`
  once `debug().pearl()` answers (2.9).
- **B12** (3.5 anchors): fixed. Each file by its own text, the ladder by "lengths of 1, 2, 3, 5, 8 thirds of a block".
- **C1** (blocking; overlaps land on the warm–cool line, no new colour): fixed by saying so. Of its two fixes the
  rewording was taken: the other (tints scaled to a top channel of 1) was rerun here and also gives no third hue (L × D
  hue 264°), since the pair are complements. Property 3, decision 11, 2.12, visible.md and the weak list now say
  crossings only strengthen or weaken the warm or the cool, that today's make a rose-violet (hue 351° at mean opacity,
  rerun), and that this is a loss against rule 3, named to him.
- **C2** (close-ups direction): fixed as N5.
- **C3** (closed curve span; "no longer pinched"): fixed as N6; "no longer pinched thin" in 2.12 and visible.md.
- **C4** (overlay not said recursive; 2.6 against 2.9 tolerance; EYE_OFF; the Artifact): fixed. The overlay is
  recursive (2.1); one tolerance, none off by more than 1 level, in 2.0, 2.6 and 2.9; EYE_OFF's 7e-7 named; the
  Artifact never a before.
- **C5** (8/34 off the ladder): fixed as N4.
- **C6** (0.1%): fixed as N2.
- **C7** ("blue-violet shades" said to stop holding; the game's own lines unnamed): fixed. Rule 6's words stay true;
  the README's and the FS comment's lines are named by anchor in 3.3 and 3.6.
- **C8** (README anchor for the closed curve): fixed as B12.
- **C9** (palette.tones.relation and palette.lift_relation): fixed. Both listed at the file's own paths, with wording.
- **C10** (films toned outside uPaint): fixed. Each film toned by mix(vec3(1.0), tone(...), uPaint), so `paint(0)`
  shows the drawing alone.
- **C11** (unitMask under UNIT 0): fixed. `unitMask(m)` turns UNIT to 1 and puts it back; `UNIT_MODE` replaced by a
  mask argument.
- **C12** (the readings never put to him): fixed as F4: the readings, one line each, and decision 7 go with the
  question.

## Third round (27 Oct 2026, after the second recheck)

Nine problems in `recheck2.json`, each verified against the files first: the branch still at d9d563bd with no glyph
code; `rocket.js` (`unitH()`, `coinRO()`, `coinR()`, `coinGrid()`, `drawCoins3()`, `drawGuards()`, `drawPearl()`, the
frame's draw order, `drawSight()`, `spaceFrame()`, the quality rule), `pearl.js`, `pearl-body.json`, design-rules.txt
rules 3 and 6, CLAUDE.md's Cézanne line; numbers in `verify/round3/`. One line each, in the recheck's order.

- **R1** (blocking; the coins' check could not pass): fixed by keeping the coins at today's size, as preferred. A new
  `coinH()` (φ⁻⁷ m, whatever UNIT is) takes the place of `unitH()` in `coinRO()`, `coinR()` and `drawCoins3()`, so a
  coin is 7 cells of φ⁻⁷ m (0.2411 m), drawn, taken and tapped as today, its hole still 0.32 mm wider than his pearl
  under UNIT 1; 2.5 and 2.9 say so, and 2.9's coin check (palette, cell, uUnit 0 all today's, him out of the frame) can
  now hold to 1 level. As the steps stood, the coins would have been drawn 0.31% smaller under UNIT 1, not larger as
  the recheck put it; the conflict it found is real either way.
- **Found while fixing R1:** 2.5's "Their size follows his cell" had also covered the guards. They are built of his
  parts, so under UNIT 1 they take his new cells (their grey as today); `unitH()` also sizes the sight's ring and
  space's guns. The step 2 header, 2.5, 2.12, property 6, decision 28 and visible.md now say so. Under UNIT 1 a coin is
  no longer built of his cells and keeps an exact φ in a built thing: 3.1 rewords the coins' comment, 3.3 asks whether
  they take his cell again, and the weak list names it.
- **R2** (readPixels for every picture): fixed. 2.0 takes each frame two ways. To compare, it reads the GL canvas with
  readPixels, only with no glyphs in it (switched off, or drawn on a canvas of their own); with glyphs in the GL canvas
  and no switch, it compares on the frame under them if readable, or else reports without the 1-level hold and without
  by itself calling for FS compiled twice. To show him, it takes the composited `P.screenshot`. 1.1, 2.10, 2.9's
  medians, decision 27 and the weak list follow it.
- **R3** (weak list states "near" covers property 4's distances): fixed. The bullet is conditional: where size by
  distance makes a couple of big characters the glyphs are seen; whether that reaches property 4's distances is not
  known (ask 4); the consequences are "would".
- **R4** (ask 1 requires occluders glyphed; build behaviour stated as fact): fixed. Ask 1 and 1.2 ask only for his
  head's own pixels; what crosses in front, like the glow, is the session's to weigh, and the keep circle is said to
  meet the ask. "Reads all of it", "the world through the window is glyphs", "on black" and the paint, masking, decision
  13 and asks 2, 4 and 5 are now "would", "if its build", "as the session describes it" or "inferred".
- **R5** (visible.md "every word"; "glyphs off" unconditional; "only as the glyphs' colours"): fixed with the recheck's
  wording, "every word and button on the page"; "where the game allows it"; near through the glyphs' colours and
  characters, far off as themselves as the session puts it.
- **R6** (decision 7 routed two ways): fixed by one route. Decision 7 goes with the question, among the readings; 2.12
  says it is written in with 3.6's words, not asked again; 3.6 only writes it in; visible.md says it comes with the
  question.
- **R7** (rule 3 met and "a loss against rule 3"; CLAUDE.md and rule 6 Applied unlisted): fixed. Said once: rule 3 ("...
  in relation to the shading of the shape") is met by the faces' films. The washes lose today's third hue against
  CLAUDE.md's "translucent washes mixing into new colours where they overlap" and rule 6 Applied's "translucent washes
  that mix into new colours where they overlap". Both texts are added to 3.6's words and named in 2.12 and visible.md
  (property 3, decision 11, weak list).
- **R8** (mask without the world's depth; drawPearl's order and swooshAt; the real phone): fixed. 2.7's mask first draws
  the place's chunks and the rocket depth only, so what the place hides is not counted. With `mask` set, drawPearl draws
  the head first by headProg, binds prog again for the body and skips `swooshAt`. The real-phone check is his to run:
  two private scratch Artifacts (UNIT 0 and UNIT 1 written into the bundle), each with a corner readout of `quality()`
  and `walk()`, sent before the question.
- **R9** ("everything step 2 changes stays behind a switch"): fixed with the recheck's wording, listing what ships
  regardless (2.2(a), 2.6, 2.11, the FS's uUnit branches at 0, the coins' own cell), checked to draw as before.

## Fourth round (27 Oct 2026, 22:00 UTC)

The third round's recheck found no blocking problem and five minor ones, each fixed in both FINAL.md and apply_steps.md:
- `PearlBody.palette()` does not exist (pearl.js exports no `palette`): today's palette for the coins is now taken as pearlFrom takes its own, `PB.build(specToday, { skip: [B.WATER, B.NOTE] }).palette`, packed into a `Float32Array(64 * 4)` the same way.
- The recipe hid "the page's elements" for both ways of taking a frame; now only the comparisons hide them, and the pictures shown him hide only the controls, never a canvas the glyphs are drawn on.
- The phone timing had no baseline: a third scratch Artifact from the commit step 2 is applied to is played first; a fall at UNIT 0 alone calls for compiling FS twice, a fall only at UNIT 1 is the face film's cost, reported to him with the question.
- The mask's depth pass now draws `drawGuards` and `drawShards` too, and the views keep the guards out of the line to him.
- 3.6's rewording of CLAUDE.md's Cézanne line and rule 6's Applied takes the README's split: for his body on his yes, for the world only with 3.3.

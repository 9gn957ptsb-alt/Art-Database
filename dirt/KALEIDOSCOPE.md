# Kaleidoscopes in DRIFT, after φ

Aries, 9 Oct 2026: "don't forget the relationship between the golden ratio and kaleidoscopes" (the golden
kaleidoscope of v80). 23 Oct 2026: "The kaleidoscopes are too obvious in DRIFT. make them much more subtle, remember
to implement the golden ratio and perhaps give me showers of kaleidoscopes but each one is like a star in the sky and
shows a very small but brilliant change" (the stars, 27 Oct). And 27 Oct 2026: "Slowly, have tie into the
kaleidoscope routine, but specifically for DRIFT."

So DRIFT has the Artist Website's kaleidoscope routine of its own, slower: one new way every fifth day (the site's
comes every other day), each a kaleidoscope whose geometry is the golden ratio's, each behind its own flag, until
Aries says it is too much. It ties into the site's: each pass reads the site's ledger
(`docs/v2/KALEIDOSCOPE.md` on `claude/artist-website-dev-s92irf`) and may take up the newest idea there that DRIFT has
not answered, in DRIFT's own terms, so the two grow together, the plane a few steps behind. This file is DRIFT's
ledger (what has come, what may come next) and the pass's authority: the routine "DRIFT — kaleidoscope (every fifth
day, here)", which fires into Aries's own conversation and hands the pass to a helper.

**When Aries says it is too much**, in any session and in any words, that session disables the routine
(`update_trigger`, enabled false; `list_triggers` finds it by its name), writes **Stopped** at the head of this file
with the date and their words, and asks them once whether to take back the latest ones (each is a flag in
`KALEIDOSCOPES` in `engine/ground-gl.js`; false takes it back, nothing else changes).

## The geometry

The site's ledger has it in full. In short: two mirrors at 36° make ten images, and 2 cos 36° = φ, the pentagon's
diagonal over its side. At 72° they make five. Mirrors opening by φ a step give 10/φᵏ images, and the circle stops
coming round whole. Three mirrors in a golden triangle (36°, 72°, 72°) never close, so their image never repeats.
Penrose's rhombs come at 36° and 72°. And rings or echoes can scale by φ. DRIFT adds its own:

- **Magnitudes.** The stars come in three classes (13, 8 and 5 cells), their shares φ⁻⁴, φ⁻³ and φ⁻¹, their
  strengths φ⁻¹, φ⁻² and φ⁻³ (φ times more at the plane's night); with their areas, one class to the next is about
  φ³ in light, so the classes step as magnitudes do (Pogson's 2.512 a magnitude), a little more steeply.
- **Fibonacci into Fibonacci.** A star gathers φ² as far as it reaches: 34 cells into 13, 21 into 8, 13 into 5.
- **Showers.** Stars stand on a 55-cell lattice and are thinned by a field 610 cells across.

## The rules

- **One new way a pass, never two.** Each subtle, as the faces were made (φ⁻³ of their strength, rarer by powers of
  φ): "a face you notice only if you look". An earlier one is never made louder.
- **In DRIFT's own hand.** It is still when no one swipes. A change comes only as a rare event: a dissolve over about
  φ seconds, its moment seeded by where it is, since the clock starts at 0 every visit and each visit opens somewhere
  different. It never twinkles, sways, pulses or turns on and on. Watercolour, frameless, a gradient and never a line;
  colours only from the ground under it; numbers from φ and Fibonacci. The calm country stays calm.
- **Only in `engine/ground-gl.js`**, behind its own flag in `KALEIDOSCOPES` with its date and one line. It compiles
  with WORDS 0 and 1 (DRIFT Poetry builds the same engine with its letters), and holds still under reduced motion
  (`uHold`).
- **Never lag.** It costs nothing where it is not: lattice tests and early returns, no new full-screen pass. It
  costs nothing on a phone at tier 0 if it can't be cheap there. The governor drops a tier at a 34 ms median frame;
  never make it.
- **Checked**: `node engine/check_kaleidoscope.js compile` (ten programs, both builds), then `shoot` at 390×844 and
  1440×900, with and without its flag (`#nokal=name`), at places a finder chooses where it shows, with no page errors.
  Look at every frame. Since 27 Oct DRIFT is seen through Glyph Light (`engine/glyphlight.js`, glyphs about 6 CSS px
  a cell, glowing over a threshold), so judge it as glyphs too.
- **Published** by putting the engine into DRIFT's page as published (`engine/splice.py`), never by a full rebuild,
  then DRIFT Poetry brought into step (`poetry/UPDATE.md`).

## So far

| Date | Where | What | Flag | From the site |
| --- | --- | --- | --- | --- |
| 9 Oct 2026 | The calm regions, φ⁻⁴ of them | The golden kaleidoscope: five mirrors at 36° round a region's middle, each ring φ times nearer holding the ring outside it, laid on at φ⁻¹. A bullseye 520 cells across, wider than a phone; taken back on 27 Oct | none (gone) | the pulse's fold, 9 Oct |
| 27 Oct 2026 | The calm country, in showers | Kaleidoscopes as small as stars: on a 55-cell lattice, φ⁻¹ kept and thinned into showers by a 610-cell field; three magnitudes (13, 8, 5 cells; 5, 3, 2 mirrors); each gathers the ground φ² as far as it reaches, every image dimmer and greener for the mirrors it came through, lifted toward light most on dark ground, and coming out at the plane's night. Each holds still and, once in about 987 s at its own moment, turns φ⁻² of an image over φ seconds as its light swells a little (`STARS_GLSL`). The singularities' mirror glint down to φ⁻⁵ | `stars` | the pulse's 36° fold (9 Oct); the sunflower's seeds (14 Oct) |

## Still to come

Roughly from quietest to most present. Take the next that still fits (or the site's newest that DRIFT has not
answered, or a better one), and strike it here when it is done.

1. **Opening by φ, where a swipe comes to rest** (the site's arrival, 10 Oct). DRIFT's one act is the swipe, so
   only there: when the view comes to rest, the brilliant star nearest the middle opens its mirrors by φ a step
   (10, 6.2, 3.8, 2.4, 1.5 images) over φ seconds, and closes again. Once a rest, never while moving.
2. **A photograph's arrival through the mirrors** (the site's arrival and its telescope, 10 and 20 Oct). A photograph
   put in (PHOTO, "put a thing in", and DRIFT Poetry's photographs) lands in the collage seen through two mirrors at
   72° (five images, the pentagon), which open by φ a step until it is the photograph.
3. **The one pixel's event** (the pulse's fold, 9 Oct). A void's supernova sends its debris out in five, at 72°, for
   its first held moment, then as it always has.
4. **The golden triangle** (the site's idea 9). One star in φ⁵ is seen through three mirrors in a golden triangle,
   which never close, so its image never repeats.
5. **Scale by φ.** A brilliant star's heart holds the star again, φ² smaller: one echo, never more.
6. **Penrose's rhombs** (the site's idea 10). One calm painting in φ⁷ of the regions is laid as a Penrose tiling of
   36° and 72° rhombs, still, in its own colours.
7. **The swimmers** (DRIFT's own). Where a swimmer passes under a star, the star's object turns after it a little,
   as water turns a tube, settling in φ seconds.
8. **Glyph Light's stars.** The brilliant stars' glyphs drawn from a set of stars (✶ ✷ ✸ ✹) rather than the fine
   set. That lives in `glyphlight.js`, which is shared with the site, so it is a decision for Aries: ask once.

## Weak

- On pale washes a star shows as a faint cool rosette, not as light: paper is near white and leaves no room above
  it. Its brilliance shows on dark and coloured ground.
- Through Glyph Light a brilliant star, 13 CSS px across its radius, is about four glyphs across, so its ten images
  are lost in the glyphs. It reads as a small glowing cluster.
- Never measured on a real GPU: the stars' cost is estimated (about 4 to 6% of the pixel pass), not timed.

# Kaleidoscopes after φ

The artist, 9 Oct 2026: kaleidoscopes "in a very, very subtle way", then "Fold the pulse". And
10 Oct 2026: "Keep introducing kaleidoscopes in relation to the golden ratio on the website until I
tell you, it's too much. Be gradual about it, maybe introduce it in a new way once a day."

So: one new way a day, each a kaleidoscope whose geometry is the golden ratio's, each behind its own
flag, until he says it is too much. This file is the ledger — what has come, what may come next —
and the daily pass's authority (the routine "Artist Website — kaleidoscope (daily, here)", which
since 14 Oct 2026 fires into the artist's own conversation and hands the pass to a helper).

**When he says it is too much** — in any session, in any words — that session disables the routine
(`update_trigger`, enabled false; `list_triggers` finds it by its name), writes **Stopped** at the
head of this file with the date and his words, and asks him once whether to take back the latest
ones (each is a flag in `KALEIDOSCOPES` in `land.js`; false takes it back, nothing else changes).

## The geometry

Two mirrors at 36° (π/5) make ten images round their meeting, five pairs. 2 cos 36° = φ: the
pentagon's diagonal over its side, the number every timing on the page already runs on. What else
the mirrors can be, all φ's:

- **36°** — ten images, a decagon; the pulse's fold.
- **72°** — five, a pentagon; its diagonals cut each other in φ.
- **Opening by φ** — 36° × φᵏ gives 10/φᵏ images (10, 6.2, 3.8, 2.4, 1.5): the circle stops coming
  round whole, a broken image where it fails, until one is left.
- **The golden triangle** (36°, 72°, 72°) and its gnomon (108°, 36°, 36°): three mirrors in a golden
  triangle never close (2π/5 is not π/n), so the image never repeats — quasi-periodic, Penrose's order.
- **Penrose's rhombs** (36° and 72°), whose counts in a tiling go as φ.
- **Scale by φ**: echoes, rings and steps that grow or shrink by φ, as the pulse's echoes do.

## The rules

- **One new way a day, never two.** Each subtle at first: dealt among others, brief, or only where
  someone already acts (a press, an arrival, a hold). An earlier one is never made louder.
- **In the page's own hand**: held frames at 24 a second, the 13 px grid where it is light, the
  lavender `LIGHT`, colours only from what is already there (the picture's own, the city's own).
- **Its flag** in `KALEIDOSCOPES` (`land.js`, by the pulse's `FOLD`) with its date and one line, and
  its row below.
- **Never** under reduced motion (`still`); never a flash (WCAG 2.3.1: three a second at most); never
  over a wall label, a column, the dial's readout or the walk; never hiding a picture for more than
  a second and a half; never on the globe's names.
- **Checked** at 390×844 and 1440×900 in headless Chromium, the page's clock slowed so every held
  frame can be seen (`scripts/check_kaleidoscope.js`), with no page errors; the frames looked at.
  For one that needs a press held (`--ring`), the clock is stopped and stepped a held frame at a
  time, a mouse on the desktop and a touch through the DevTools protocol on the phone, and the
  most times any one tile lights in a second is counted (three at most). For one that lands in the far
  views (`--scope`), NASA's real answer and thumbnails are fetched with curl and served to the page, the
  world is brought far off (`Land.globeAt`), the clock stopped and stepped, `Land.shot` drops one through
  the mirrors and the CSS fall and fade is held to the same time; then the pointer crosses the sky at real
  speed and the shots that came through the mirrors are counted against the plain.

## So far

| Date | Where | What | Flag |
| --- | --- | --- | --- |
| 9 Oct 2026 | The pulse — every press's pixel light | Folded through two mirrors at 36°: the square with its corners knocked off comes out a soft pentagon, its ragged edge ten times, mirrored; the mirrors turned and the pieces shaken anew each press (`folded`, `jag`) | none (asked for) |
| 10 Oct 2026 | A photograph's arrival — a work's first look, a collage dealt at its site | One arrival of fourteen, dealt: the 36° rosette of the picture's middle grows out in four held steps of φ, turns a little as a kaleidoscope turned in the hand, then the mirrors open by φ a step — 10, 6.2, 3.8, 2.4, 1.5 images — until there is one, and it is the picture. Where two images meet, the mirror's edge catches the lavender light. About 1.4 s (`kaleidoscopeIn`, `kaleidoscopeOf`) | `arrive` |
| 13 Oct 2026 | A photograph pointed at (a mouse), or a door pressed — the thumbnail's answer | One pointed effect of the others, dealt: the 36° mirrors stand over the point the pointer is on and the picture is seen through them as they close and open by φ — 1.5, 3.8, 10 images, then 10, 3.8, 1.5 — seven held steps, about 0.9 s; the picture shows through where an image is broken, the mirrors' edges a short lavender line at the point (`kaleidoscopeAt`) | `pointed` |
| 14 Oct 2026 | The held ring — a press held on a city's map | The first with pieces in the glass (the others fold a picture or a pulse), in pixel light. Inside the ring that opens under a held finger the pulse's two mirrors (36°) stand over the point and a sunflower's seeds turn in front of them: Vogel's, the golden angle (2π/φ² = 137.5°) apart on a radius that goes as √n, each seen ten times, five turned and five reflected. One seed as the ring opens, then one every φ²/12 s, the thirteenth at φ² s; the Fibonacci ones (1, 2, 3, 5, 8, 13) lilac: they fall alternately either side of one ray, each a golden step nearer it (−85°, +53°, −32°, +20°, −12°), so the mirrors string them out along ten spokes and the first thing drawn is a star. They turn once in φ⁸ s after a flick (2π/φ⁴ rad/s) that settles in φ s, as a kaleidoscope turned and let go: pairs of tiles slide together at a mirror and part, never the same twice. A tile a seed has left stays lit eight held frames, stepping down as the pointer's trail does, so none lights more than 24/(8+2) = 2.4 times a second. Let go, and the pulse goes out on the same mirrors (`rosetteRuns`, `squash`'s `turn`) | `ring` |
| 20 Oct 2026 | The telescope's photographs — dropped behind the pointer in the far views | One in φ³ of the photographs the pointer drops across the sky when the world is far off (`dropHubble`, deep space only) lands through the telescope's own two mirrors — a telescope is a pair of mirrors, as a kaleidoscope is. The mirrors stand over its middle 72° apart, so five images come round it (the pentagon; five is odd, so the circle cannot close and the seam shows), then open by φ a step, 72°, 116°, 188°, 305° — 5, 3.1, 1.9, 1.2 images — and it is the photograph, which goes on as the others do, the same fall and fade. Four held steps at 24 a second (the first four frames, waiting out the fade-in, then two each: 0.4 s of the shot's 1.1 s), drawn at half its pixels and blown up unsmoothed, the mirrors' edges in the lilac. A canvas in the plain photograph's place (`scopeShot`); the others stay the `<img>` they were (`drawArt`'s `bare`: no card behind a photograph on the dark) | `scope` |

## Still to come

Ideas, roughly from quietest to most present; take the next that still fits, or a better one, and
strike it here when it is done.

1. ~~**A door pressed** (a thread's door, a collage pointed at with a mouse): the picture folds about
   the point pressed into ten for a beat and opens again (`POINTED`, dealt among the others).~~ Done 13 Oct.
2. **The aim of the dive** (`drawAim`): its ring of pixel light folded as the pulse is — ten ragged
   arcs, mirrored, turning as the fingers carry it. *Parked: the dive is off since 14 Oct 2026
   (`DIVE = false`; its code is kept), so there is no aim to fold until it comes back.*
3. ~~**The squash's held ring** (`ringNow`, a city held): a rosette that turns while the finger holds.~~
   Done 14 Oct, as a sunflower's seeds in the mirrors.
4. **The sweep of cells** going down, coming up, opening and closing (`sweepCells`): its cells laid
   out by the 36° mirrors about where it began, a rosette curtain instead of a front.
5. ~~**The telescope's photographs** dropped in the far views (`dropHubble`): deep space seen through
   the mirrors for a moment as it lands, five images at 72°.~~ Done 20 Oct, one in φ³.
6. **The dial's two geared rings**, which already turn against each other at φ: drawn, once in a
   while at rest, as a kaleidoscope wheel of the year's colours.
7. **The loader** (`#primordial`, Gray-Scott): grown in one tenth and folded round, the first thing a
   visitor sees.
8. **The rocket's burst** (`#burst`): its ring folded at 72°, five-fold.
9. **The theatre's entr'acte** (after Fischinger): now and then seen through three mirrors in a
   golden triangle — never closing, never repeating.
10. **The calm ground** under a chimera presented: a Penrose tiling of 36° and 72° rhombs in its soil.
11. **A collage turned** at its site (each quarter-turn re-deals the composition): the swing seen
   through the mirrors for its first held frames.
12. **The skylines' held press** (from the held ring, 14 Oct): the 28 skyline cities take the press
   themselves (`skyline.js` calls `Land.city.squash` on release, its radius capped at 233 against the
   map's 300) and open no ring, so the rosette does not reach the cities he sees most. The pixel
   light is drawn over the skyline already, so a `Land.city` hook that begins and cancels a hold
   (`squashing`) would give them the ring and the rosette; the radius then has to be one number.
   A decision for him, not a kaleidoscope: ask once.

## Weak

- Nothing on the page says φ, nor should it: the relation is in the angles and the steps, which a
  viewer feels as balance rather than reads.
- A kaleidoscope is a strong figure; at one a day it accumulates. The flags are there so the last
  few can be taken back without touching the rest.
- The held ring (14 Oct) shows only where the stage takes the press: a city that is a map (about
  600 of the 629, every one without a skyline). The 28 cities with a skyline take the press
  themselves and give only the wave on release, and a collage's own city is covered by its reading
  (`.read` takes every press), so no ring opens in either and no rosette; giving them a held ring
  is a decision of its own, not a kaleidoscope's.
- The telescope's photographs (20 Oct) are 72–128 px across and live 1.1 s, so the five images are
  small and quick, and few see one: it needs the far views, the pointer (or a finger) moving across the
  sky, and one photograph in four. It is seen at its best on a mouse. The mirrors stand over the
  photograph's middle, and a thumbnail whose subject is off-centre (a galaxy in a corner) is shown
  twice or thrice rather than five times round a point; the NASA thumbnails are mostly centred.
- Its seeds are one tile each, and a thumb covers the middle of it on a phone. The figure is best
  seen with a mouse, or on a phone by pressing the upper part of a map, clear of its column.

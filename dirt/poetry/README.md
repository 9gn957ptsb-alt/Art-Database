# DRIFT Poetry

DRIFT with the pages of *Picture Poetry* lying on it. Aries, 14 Oct 2026: "There should be two separate artifacts, DRIFT
and DRIFT Poetry. The latter should be a combination of the Picture Poetry artifact and DRIFT. Make sure that it
updates anytime either of the other artifacts are updated."

So DRIFT Poetry is DRIFT's own page, exactly as published (its ground, its artists, its garden and creatures, its
watercolour, its buttons), with the six pages of Picture Poetry laid over its ground, each whole: its photograph, its
poem, its buildings (which turn under a swipe, as in the book) and its characters; and between the pages, some of
DRIFT's own lines are written out in the poems. It is built from the two artifacts as they stand and built again whenever
either is republished: [UPDATE.md](UPDATE.md) says how, and who does it. DRIFT stays a separate artifact, without
the pages.

It began on 10 October 2026 as *DIRT Poetry*, the pages on a plane of its own painted after four stills of DRIFT
(v80), first five pages and then each page whole; renamed *DRIFT Poetry* on 14 October, and that day made of DRIFT
itself, when Picture Poetry had grown a sixth page (*Discourse to the Athenians*) and redesigned its fourth.

Published as its own artifact (private to its owner), https://claude.ai/artifact/SkC8TxFP9ayxPk7DGyugdp. The pages,
the photographs and the poems are not in this repository: they come from Picture Poetry's published files and
`dirt/private/poetry/` (ignored), and are published only with the artifact.

    NODE_PATH=$(npm root -g) node dirt/poetry/capture_pages.js PICTURE_POETRY_FILES dirt/private/poetry
    python3 dirt/poetry/build_poetry.py --drift DRIFT.html --out OUT --sources SOURCES.json

## How the pages lie on DRIFT

- **On DRIFT, in step with it.** `layer.js` runs inside DRIFT's page: just after DRIFT draws its ground, on the same
  frame, it draws the pages on a canvas of its own over DRIFT's ground and its living things, clear everywhere else,
  so the pages move with the ground exactly. Stills and recordings made with DRIFT's buttons include them.
- **Where.** One page to each square 2584 pixels wide, scattered a little and turned within a degree and a half, as
  if laid by hand, with DRIFT between them. They are dealt along the rows two apart, so no two neighbours hold the
  same page. The squares are anchored where the visit begins, on a page chosen at random (on a narrow screen, on its
  poem); `#pageN` begins on page N, `#nopoetry` shows DRIFT alone. A label in DRIFT's caption type names the page
  underfoot.
- **How big.** A page pixel is φ⁻¹ of a CSS pixel on every screen, a little larger than the book shows them, so the
  poems read at their own size.
- **Four ways of painting a page,** after the four stills of DRIFT the first version was made from. Each page leans
  to one and visits the other three: its photograph printed in halftone over a pale wash of itself, a soft dark disc
  just beyond its far edge with fine rainbow arcs round it; whole in its middle and coming apart cell by cell toward
  its edge, a few upright brushstrokes in its accent beside it; held in a white cloud, with golden kaleidoscopes round
  it (two strokes in the wedge between five mirrors at 36°, so ten images make a star, cos 36° = φ/2); torn and laid
  again, its torn edges white with fibre, and the poem on its own torn sheet of the page's paper. *Boiling* leans to
  coming apart, the sun in the trees to the kaleidoscopes, *For What* and *Neither Where Nor When* to the torn, the
  lighthouse and *Discourse to the Athenians* (the disc among its globes and stars) to the halftone and the disc.
- **The paper dissolves into DRIFT; the poem stays.** A page's paper thins into DRIFT's ground at a wash's wandering
  edge, and the poem keeps a calm paper under it so it can be read, dark where the page is dark (pages 4 and 6). A
  watercolour softens the paint, and last the page's own type, rules, buildings and characters are printed on it,
  sharp: the page with its paper taken away, each pixel's own colour kept, so a coloured rule keeps its colour.
  The buildings are not in that ink: they are drawn live over it (below).
- **Measured, not transcribed.** Each page is measured from its image when it is built: its paper (its commonest
  colour), its photograph (where Picture Poetry's data sets it, or else the largest patch unlike the paper), its ink
  (the far end of its colours from the paper, darker on a light page, lighter on a dark one) and its poem (the run
  of lines with the most ink, outside the photograph and the figures), so a new page needs only its poem read: the
  poems exist only in the page images, and are transcribed into `poems.json` for screen readers and the label.
- **Still, and never behind.** Nothing moves unless DRIFT's view moves; the pages are drawn again only then, more
  coarsely if moving frames come slowly (a frame over 24 ms, eight times), and once more at their finest at rest.

## The buildings turn

Aries, 14 Oct 2026: "Make sure I can still rotate architecture buildings in DRIFT Poetry like I can in Picture
Poetry." Each page's buildings (Turner Contemporary, Ordrupgaard, the Menil Collection, Cherry Hill Park, the
Phillips Collection, Spring Point Ledge light, the Parthenon) are drawn live by Picture Poetry's own model code, on
each place's DIRT soil, on a canvas over the pages. Dragged sideways, a building turns as in the book (0.022 radians a
pixel) and the plane holds still under it; let go, it settles on the nearest of its four diagonals over 700 ms, with
the book's easing; a tap names it in the label. Each copy of a page on the plane keeps its own buildings' turns.
`capture_pages.js` takes the model code (`models.js`) and the buildings (`buildings.json`) from the book, and leaves
them out of the captured ink.

## The poems written along DRIFT's lines

Aries, 14 Oct 2026: "You have to integrate the text into DRIFT Poetry more. Analyze places in the graphics of DRIFT
where lines can be subtly transformed into linguistic characters." Some of DRIFT's lines are written out in the poems'
letters, small enough to read as the line a little way off and as the poems close to: micrography, as the Hebrew
scribes drew figures in minute letters, except that here the figures were there first and the poems are written into
them.

- **Where.** Most of the plane is the calm country, one minimal painting a region, and there: Kandinsky's lines (*Point
  and Line to Plane*), Miró's constellation, Kline's strokes (lines of letters along each), Giacometti's figure and
  Newman's zip (a line of letters down each), Agnes Martin's grid (each row a line of writing), and of the roster's
  compositions the stripes and broad strokes wide enough to hold a line, Diebenkorn's and Marden's charcoal lines,
  the printed sheet among the torn ones (Rauschenberg, Bradford: a page of the poems, a line of verse a row) and the
  rows of strokes after Basquiat and Mathieu (the strokes become capitals, the crossed-out row still crossed). In the
  busier worlds, the gesture, the one line that runs through every world, becomes one line of the poems running on.
  Lines too fine or too close to hold letters (LeWitt's, Riley's, Stella's pinstripes, Mondrian's) are left as lines.
- **How.** DRIFT's watercolour softens everything its cells hold, so the letters cannot be painted there. DRIFT's
  engine (`dirt/engine/ground-gl.js`, WORDS) has a hook that only DRIFT Poetry turns on, before the engine begins
  (`window.DRIFT_WORDS`): the first pass notes, cell by cell, which line runs there; every pass after it fades the note
  where it covers the cell; and the pixel pass, last, finds the line again at the pixel's own size and prints its
  letters on the wash in the line's own ink, while the line itself stays, fainter, under them. DRIFT never sets the
  flag, so its shaders compile without any of it. `layer.js` draws the glyphs once their fonts are in, in DRIFT's
  italic (Newsreader) and Picture Poetry's capitals (Poppins), and hands them over with the poems' text: each poem's
  lines a verse line apart, a prose poem run together.
- **Still.** The letters come in over phi seconds once their fonts arrive and then hold still with the lines; they go
  in an anomaly and come back after it. `#nowords` leaves DRIFT's lines as they are.

# DRIFT Poetry

DRIFT with *Picture Poetry* taken into it. Aries, 14 Oct 2026: "There should be two separate artifacts, DRIFT and
DRIFT Poetry. The latter should be a combination of the Picture Poetry artifact and DRIFT. Make sure that it updates
anytime either of the other artifacts are updated." And on 15 Oct: "You can break up the poems by line, keeping them
all together squares the aesthetic too much. I want a more synthesized integration between DRIFT and Picture Poetry,
just as you are distorting artist works to form drift you are now taking Picture Poetry and implementing them into
those distortions. Figuring out the integration of the language is especially important. I don't mind having the
language the most animated aspect of DRIFT Poetry, just as long as it's aesthetically pleasing."

So DRIFT Poetry is DRIFT's own page, exactly as published (its ground, its artists, its garden and creatures, its
watercolour, its buttons), with Picture Poetry taken into it in pieces, as DRIFT takes in the paintings it is made of:
the poems a line at a time into DRIFT's moving parts, the photographs into its collage, the buildings onto its ground,
each plot a book that opens.
It is built from the two artifacts as they stand and built again whenever either is republished:
[UPDATE.md](UPDATE.md) says how, and who does it. DRIFT stays a separate artifact, without any of it.

It began on 10 October 2026 as *DIRT Poetry*, the pages on a plane of their own painted after four stills of DRIFT
(v80); renamed *DRIFT Poetry* on 14 October and made of DRIFT itself, the six pages laid on it whole, their buildings
turning and some of DRIFT's lines written in the poems' letters; and on 15 October the pages came apart into DRIFT.

Published as its own artifact (private to its owner), https://claude.ai/artifact/SkC8TxFP9ayxPk7DGyugdp. The poems,
the photographs and the creatures are not in this repository: they come from Picture Poetry's published files and
`dirt/private/poetry/` (ignored), and are published only with the artifact.

    NODE_PATH=$(npm root -g) node dirt/poetry/capture_pages.js PICTURE_POETRY_FILES dirt/private/poetry
    python3 dirt/poetry/build_poetry.py --drift DRIFT.html --out OUT --sources SOURCES.json

## The poems, a line at a time

No poem lies whole anywhere. Each is broken into its lines (a prose poem at its sentences and clauses, none longer than
55 characters), and the lines go into the parts of DRIFT that already move, each moving as that part does. Barbara
Brownie's terms for type in time (*Transforming Type: New Directions in Kinetic Typography*, 2015) fit what each does:
the swimmers' lines are a *construction* (written on, letter by letter, where the eye is), the calm country's a
*metamorphosis* (a line becoming letters and letters becoming a line, Brownie's fluid typography), the gesture's a
*scrolling* line.

- **The swimmers write.** The five swimmers under DRIFT's surface (seen only as the wash thinning over them) each
  write a line of a poem in their wake, as a finger writes in water: a letter is set down on the water where the
  swimmer has just passed, along the way it swims, and comes up out of the blur; it rides the water, rocking a
  little, and about 21 seconds later sinks again, blurring and spreading as ink does in water. A swimmer keeps to one
  poem, line after line, resting a few seconds between them; heading left, it writes its line from the end, so every
  line reads left to right; it writes only while it swims within 50° of level, and a steeper turn ends the line there.
  The letters are DRIFT's italic, an em of 17 CSS pixels on any screen, in the ground's own ink: a glaze of the colour
  under each letter, its pigment denser and leaning to sepia, with a little of the paint pushed back round it (on dark
  ground, the paper showing through instead), the paper's grain in it, thinning toward the frame's margins as
  everything does. Precedents: Utterback and Achituv's *Text Rain* (1999), where a poem's letters fall on the viewers
  a line at a time; Jenny Holzer's words projected onto rivers, the Arno in 1996 and the Tiber since. When a swimmer
  begins a line near the middle of the view, the label names its poem.
- **The calm country's lines breathe.** Where DRIFT's minimal paintings draw lines, each line, on a cycle of its own
  about 34 seconds long (times φ^±½), opens into one line of a poem: the line wears away into letters, written on
  along it over 2.6 seconds; the letters hold; then they swell back into the line over 3 seconds, bleeding into one
  another as wet ink does, and the line is a line alone for 5 seconds before the next line of the poems. The line
  itself fades as its letters come and returns as they go. Each verse line is centred on the line that holds it (from
  the torn edge, on a printed sheet) and thins out where the mark ends. The lines written: Kandinsky's (*Point and Line
  to Plane*), Miró's constellation, Kline's strokes (a verse line a row along each), Giacometti's figure and Newman's
  zip (a verse line down each), each row of Agnes Martin's grid on its own breath, and of the roster's compositions the
  stripes and broad strokes wide enough to hold a line, Diebenkorn's and Marden's charcoal lines (each of the three on
  its own breath), the printed sheet among the torn ones (Rauschenberg, Bradford: a verse line a row) and the rows of
  strokes after Basquiat and Mathieu (the strokes become capitals, each a whole stroke's place). Lines too fine or too
  close to hold letters (LeWitt's, Riley's, Stella's pinstripes, Mondrian's) are left as lines. Precedents: Hebrew
  micrography, figures drawn in minute script, and Glenn Ligon's stencilled sentences that thicken into coal dust and
  illegibility; Tom Phillips's *A Humument* (1966–2016), its verse found in rivers through painted pages.
- **The gesture carries lines.** The one line that runs through every busy world carries the poems along it, a line
  every 40 em, drifting by at φ⁻¹ em a second, the way the eye reads: smooth scrolling reads as well as words flashed in
  one place (Kang and Muter, "Reading dynamically displayed text", 1989).
- **How.** DRIFT's watercolour softens everything its cells hold, so the letters cannot be painted there. DRIFT's
  engine (`dirt/engine/ground-gl.js`, WORDS) has a hook that only DRIFT Poetry turns on, before the engine begins
  (`window.DRIFT_WORDS`): the first pass notes, cell by cell, which line runs there; the minimal areas' pass fades each
  line as its letters come (the cycle, `wCycle`, worked out alike in both passes); every pass after fades the note
  where it covers the cell; the pixel pass, last, finds the line again at the pixel's own size and prints its verse
  line on the wash in the line's own ink; and the swimmers' letters are quads drawn over the finished frame. The glyphs
  are distance fields (Green, "Improved Alpha-Tested Magnification for Vector Textures and Special Effects", SIGGRAPH
  2007), so a letter can wear thin, swell and blur as well as be drawn; `layer.js` makes them once the fonts are in, in
  DRIFT's italic (Newsreader) and Picture Poetry's capitals (Poppins), with Felzenszwalb and Huttenlocher's exact
  distance transform (2012). DRIFT never sets the flag, so its shaders compile without any of it. `#nowords` leaves
  DRIFT's lines and swimmers as they are.

## The photographs, into the collage

Each page's photograph goes into DRIFT as a photo the viewer puts in does (`GLG.putIn`, drift.js): it arrives torn out
where it is put in, and DRIFT's collage melts it (the datamosh) and carries it off in torn pieces across the plane. The
first arrives where the visit begins, once DRIFT's ground is painted; every 144 seconds the next goes in quietly (no
arrival: only a share of the collage's pieces turn to it); and for 377 seconds after the viewer puts in a photo or a
name of their own, theirs is left to drift.

## The buildings, on the ground

Aries, 14 Oct 2026: "Make sure I can still rotate architecture buildings in DRIFT Poetry like I can in Picture
Poetry." The buildings (Turner Contemporary, Ordrupgaard, the Menil Collection, Cherry Hill Park, the Phillips
Collection, Spring Point Ledge light, the Parthenon) stand on DRIFT's ground on their own, a building to each square of
a lattice 1597 CSS pixels wide, dealt so that no two neighbours are alike, scattered within φ⁻¹ of their squares; the
visit begins beside one (`#pageN` beside page N's). Each is drawn live by Picture Poetry's own model code on its
place's DIRT soil, as large as the book has it, with the creatures that stood by it on its page, each where it stood.
Dragged sideways, a building turns as in the book (0.022 radians a pixel) and the plane holds still under it; let go,
it settles on the nearest of its four diagonals over 700 ms, with the book's easing; a tap opens it (below). Each
copy keeps its own turn. `capture_pages.js` takes the model code (`models.js`) and the buildings (`buildings.json`)
from the book, and the creatures as it draws them (its overlays); `build_poetry.py` cuts the creatures onto one sheet.
Stills and recordings made with DRIFT's buttons include the buildings.

## The plots, opened like books

Aries, 21 Oct 2026: "Plots should be able to open like a book when clicked on." A building's plot lies on the ground
like a closed book, its soil the edge of its pages. Tapped, it lifts off the ground (610 ms) and becomes the drawing on a
cover in its page's colours, under its poem's title; the cover swings open on its spine (987 ms); and the leaves are its
page of Picture Poetry, a thing to a page, as the book's own viewer steps through a page's things:

- the building, drawn large and turned by a swipe (0.009 radians a pixel, settling on a diagonal, as in the viewer),
  with the book's note on it: its name, the line under it, what it is and why it is in the book;
- the poem, as its page sets it: on its paper, in its ink, its title in Poppins capitals over a rule, its lines in
  Poppins light italic, each where the page has it (page 4's cascade, page 2's wander; `build_poetry.py` reads the
  places from the page image, as bands of rows holding ink), a prose poem justified, a long poem over two pages, broken
  at a stanza's end;
- the photograph, and the book's note on where it was taken;
- the creatures that stood by the building, drawn large as pixel art is (square), with their notes; and any other
  building on the page.

A swipe across a page, the arrow keys or the names under the book turn a leaf (610 ms), the leaf darkening as it turns
from the light and its shadow passing over the page beneath. A tap beside the book, Close or Escape closes it: the cover
comes back over, and the book lies down again where it was, its building turned as it was left in the book. On a wide
screen the book lies open on a spread (its title page and contents opposite the first leaf); on a narrow one it is a
page wide, and a turned leaf goes over out of sight. While it lies open DRIFT's ground rests under it (its last frame
kept, dimmed), so the leaves turn with the whole of the screen's drawing to themselves, and DRIFT's keys wait.
`capture_pages.js` takes the book's notes (`buildings.json`); `layer.js` makes the books.

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
each plot a book that opens. Since 27 October the pieces lie on the plane as a storyboard, side by side in reading
order, a frame to each line (below).
It is built from the two artifacts as they stand and built again whenever either is republished:
[UPDATE.md](UPDATE.md) says how, and who does it. DRIFT stays a separate artifact, without any of it.

It began on 10 October 2026 as *DIRT Poetry*, the pages on a plane of their own painted after four stills of DRIFT
(v80); renamed *DRIFT Poetry* on 14 October and made of DRIFT itself, the six pages laid on it whole, their buildings
turning and some of DRIFT's lines written in the poems' letters; and on 15 October the pages came apart into DRIFT.

Published as its own artifact, https://claude.ai/artifact/SkC8TxFP9ayxPk7DGyugdp (who can open it is set by its owner, from its Share menu). The poems,
the photographs and the creatures are not in this repository: they come from Picture Poetry's published files and
`dirt/private/poetry/` (ignored), and are published only with the artifact.

    NODE_PATH=$(npm root -g) node dirt/poetry/capture_pages.js PICTURE_POETRY_FILES dirt/private/poetry
    python3 dirt/poetry/build_poetry.py --drift DRIFT.html --out OUT --sources SOURCES.json --morpholex MORPHOLEX.xlsx

## The storyboard

Aries, 27 Oct 2026: "Keep in mind that the infinite texture that you are displaying is a storyboard and someone's
thumb is the direction of how the story plays out. Have this inform the juxtapositions that you generate to create that
infinite texture in what is next to what in a progression sense almost like a flip book but instead of each sticky
note being behind the other, they are placed side-by-side. This especially holds true for DRIFT Poetry."

So the plane is a strip of frames, each 610 CSS pixels wide, in the book's reading order (`layer.js`, "the
storyboard"): each page's plot (a frame to each of its buildings: page 3 has two), then a frame to each line of its
poem; between one poem and the next a **kin frame**, holding the line of the next poem whose words share roots with the
last, the rarer the root the better (Morphology Web's link, the root two words share, standing in the gutter between
them: *drift* from page 3 to page 4, *belief* from page 5 to page 6; the poems' own words stay in the artifact);
after page 8 the walled garden, the loop's hinge (*pairi-daēza*, a wall around the story); and round again. With the
eight pages that is 10 plot frames, 150 line frames and 7 kin frames: 167 frames, about 102,000 pixels a loop. Forward
is the view moving right, the thumb dragging right to left as a leaf turns, so a swipe plays the frames as a thumb
flips a flip book, each frame the next moment (McCloud's moment-to-moment transition, *Understanding Comics*, 1993;
Muybridge laid *The Horse in Motion* out side by side in 1878 before it moved in his zoopraxiscope). The rows lie 1597
pixels apart, each the same story a golden share of it further on (103 frames), so moving down skips ahead. Each
building stands in the middle of its plot's frame, the foot of its plot on its row's one baseline. The visit begins at
a plot (any, or page N's with `#pageN`, or the garden with `#paradise`) on any of 120 rows, at φ⁻² of the view's width
(the middle on a phone), so the story it opens runs off to its right.

A frame's line is what everything in it writes: its swimmers, its calm country's marks and its gesture (below), and
Glyph Light's glyphs over it. The motion comes from the thumb: the swimmers begin lines only while the view moves (a
line begun is finished), the gesture holds still, and the photographs come in by page, not on a clock.

**Glyph Light, frame by frame.** DRIFT's page lays Glyph Light over everything (its glyphs loader, in
`build_soil_viewer.py`), its glyphs here the poems' letters. `layer.js` hands the loader the storyboard
(`window.DRIFT_GLYPHS_OPTIONS`, merged into its own options at the page's load): the glyphs pinned to the plane, cut
into the story's frames, each frame drawn in its poem's own letters (a kin frame in the next poem's, the garden in the
last poem's), and each frame a point in the artifact's slider space, the gutter between two a blend or a dissolve φ⁻⁴
of a frame each side of their boundary (`dirt/engine/glyphlight.js`). The style is ASCII alone (Aries, 28 Oct 2026:
"Make sure you are just using the ASCII style from GLYPH Light and none of the other styles"), its glyph sets the
poems' letters, one set a poem, sorted by ink as Glyph Light sorts a custom set: no longer the text style, which wrote
them in reading order (the poems are still written in reading order by the swimmers, marks and gesture);
colour is by page, from its paper (page 6's black page mono, the warm pages gold, the cool ones blue, the rest full);
density (`glyphlight.js`'s levels, its cells once and twice as large) is the poems' size on a line and twice it on a
plot, and each poem is pushed in over its last three lines (the artifact's push in, laid out as density), so its last
two lines are written twice as large; tone and glow step along each poem's lines, each on a Fibonacci period of its own,
every poem setting out from the artifact's own settings at its first line (exposure 0 ± 0.236 EV over 13 lines,
contrast 1.2 ± 0.146 over 8, midtones φ^±0.236 over 21, detail 0 to 0.618 and back over 34, the glow between φ⁻² and
φ⁻¹ with the pulse along each stanza, glow-starts-at 0.72 to 0.85 over 21 and never below 0.45 + 0.6 × the glow); the
image under the glyphs is half there at a plot (its building seen through its letters), φ⁻³ at a kin frame and none on
a line; levels are Glyph Light's auto levels, held once the thumb has rested φ³ seconds (frozen, they left the pale paper a
wall of the heaviest letters). After a headless review on 28 October the reveal stops at −φ⁻² EV, the glow keeps between
φ⁻² and φ⁻¹ with its threshold rising with it, the push in goes only to cells twice the size, and an inverted turn
holds its exposure down, so no frame goes black or blown out. The
artifact's video motions are laid out as places, not times: pulse along each stanza (its glow swelling twice in it),
reveal over each poem's plot (half lit) to its first line (whole), shimmer seeded by the frame, and invert at each
poem's turn (the stanza begun nearest the golden section of its lines, or the line there). `DRIFT_POETRY.frame()` gives
the frame at the view's middle (`{ f, q, page, line, kind, row, glyphs }`), `DRIFT_POETRY.story()` every frame, and
`DRIFT_POETRY.glyphs(f)` frame f's point.

**How a rebuild keeps it.** Nothing about the storyboard is stored: `layer.js` lays it out on each visit from what the
build gives it (the pages in their order, their poems cut into lines, their buildings, the books, and the poems' roots
from `--morpholex`, which the kin frames need), so a page added to Picture Poetry adds its plot and its lines' frames
in its place and a book adds its plot after the last page. It leans on three things in DRIFT's page, which
`build_poetry.py` names when one is missing: DRIFT's engine with the storyboard in it (WORDS in
`engine/ground-gl.js`: without it the calm country's lines and the gesture write as before, a line by hash, and only
the swimmers keep to the frames); DRIFT's glyphs loader taking `DRIFT_GLYPHS_OPTIONS`, with a `glyphlight.js` that has
its frames (`field`, `region`, `origin`, `GlyphLight.motions`: without them Glyph Light stays one point of its slider
space, its text pinned to the screen); and the engine's line where the swimmers choose their lines (`ENGINE_TURN`).

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
  little, and about 21 seconds later sinks again, blurring and spreading as ink does in water. A swimmer writes the
  line of the storyboard's frame it swims in (in a plot's frame, its poem's first line), so a still frame is one line
  written over and over and a moving thumb flips through them; it begins a line only while the view moves or has
  just moved (φ³ seconds), and rests while it is still, finishing the line it began; heading left, it writes its line
  from the end, so every line reads left to right; it writes only while it swims within 50° of level, and a steeper
  turn ends the line there.
  The letters are DRIFT's italic, an em of 17 CSS pixels on any screen, in the ground's own ink: a glaze of the colour
  under each letter, its pigment denser and leaning to sepia, with a little of the paint pushed back round it (on dark
  ground, the paper showing through instead), the paper's grain in it, thinning toward the frame's margins as
  everything does. Precedents: Utterback and Achituv's *Text Rain* (1999), where a poem's letters fall on the viewers
  a line at a time; Jenny Holzer's words projected onto rivers, the Arno in 1996 and the Tiber since. When a swimmer
  begins a line near the middle of the view, the label names its poem.
- **The calm country's lines breathe.** Where DRIFT's minimal paintings draw lines, each line, on a cycle of its own
  about 34 seconds long (times φ^±½), opens into its frame's line of a poem (the frame in which its painting's middle
  lies, so one painting writes one line; in the garden, a line of the poems by its own hash): the line wears away
  into letters, written on along it over 2.6 seconds; the letters hold; then they swell back into the line over 3
  seconds, bleeding into one another as wet ink does, and the line is a line alone for 5 seconds before it opens again.
  The line
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
- **The gesture carries lines.** The one line that runs through every busy world carries each frame's line along it,
  once in the middle of the frame (a line longer than its frame runs on into the next); it holds still, and the thumb
  carries the story past. (Until 27 Oct 2026 it carried a line every 40 em, drifting by at φ⁻¹ em a second; smooth
  scrolling reads as well as words flashed in one place, Kang and Muter, "Reading dynamically displayed text", 1989, but
  the motion is the thumb's now.)
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

## The spirit's postures

Aries, 23 Oct 2026: "We need to now understand how our morphology findings can come to posture the changes that happen
in DRIFT Poetry. Once again, thinking of DRIFT Poetry as the body and Morphology as the Spirit." The spirit is
Morphology Web's (https://claude.ai/artifact/9CYzDaxb6YYSDxm5y2G9zx): a word cut by the law ponytail and caveman share,
one affix at a time, the outermost suffix first, else the first prefix, never a root and never a not, until it stands
still at its roots. `build_poetry.py --morpholex` cuts each of the poems' words so, from MorphoLex-en's segments
(Sánchez-Gutiérrez et al., 2018, about 68,000 English words; an inflection it leaves unmarked is the outermost suffix,
and since it cannot tell *in-* "not" from *in-* "into", every *in-* is kept), and `layer.js` hands each letter's step
and each line's roots to the engine. It postures the breath of the calm country's lines two ways (WORDS in
`engine/ground-gl.js`; DRIFT never compiles it):

- **The breath sheds.** Over the 2 seconds before a line swells back into its mark, each word sheds its affixes in the
  law's order, the letters of each step wearing away in turn, and its roots are what bleed back into the line. A
  word's steps are its own (a word that sheds four and one that sheds one take the same 2 seconds). A line holding a
  not, a number or an "only" stands as said and closes whole, as Morphology Web's sentences do. Shedding runs only on
  the way out, so a root reads as where the word stops, never where it begins ("Perception is rootless", the Manifesto).
- **Shared roots breathe together.** A φ⁻³ share of the marks breathe on one beat, 34 seconds long: on each beat they
  all open at the same moment, each with a line whose words share that beat's root (*day*, *thing*, *light*, *pose* in
  "opposing" and "exposing"...), wherever on the plane they lie: "Space is the only thing capable of maintaining a
  quality simultaneously in different points of itself" (the Manifesto). The other marks keep their own breath. In the
  storyboard, each writes the root's next line from its frame's on, so the spirit's simultaneity keeps the story's
  order, a counter-voice to the frames' sequence.

The ground, its passages and their colours are the body's own and are left as they were.

## Morphology's order (a beta)

Aries, 23 Oct 2026: "I want the words, the character, the spirit of the Morphology artifact to inform everything that
is in DRIFT Poetry. Think of it as if the relevancy of the Morphology artifact to DRIFT Poetry is that it is guiding it
as if its philosophy ... I want the Morphology artifact to now inform how DRIFT and Picture Poetry are organized when
they come together", neither artifact itself touched; and of this first step, "give me a beta version ... keep it very
small". Morphology Web orders words by what they share: a root makes a family, and a link between two words is the root
they share. Its tastes of that order, in `layer.js` ("Morphology's order"), now laid on the storyboard:

- **A page is a family round its root, the plot.** Its frames follow its plot's, and the swimmers in each write that
  frame's line, so the family recites its poem in order as the thumb goes on (until 27 Oct 2026, the swimmers within
  610 CSS pixels of a plot took its poem's lines in turn).
- **Between two poems, the kin frame**: the line of the next poem whose words share roots with the last, the rarer the
  root the better (the storyboard, above).
- **In the walled garden, which has no poem, DRIFT's paintings and the poems are linked by their roots.** A swimmer
  writes a line whose words share a root with the title of the painting it swims over: *Phenomena Rain Palace* (Paul
  Jenkins) opens to a line of page 1's on *rain*, *Composition for two Sunflowers* to one of page 3's on *pose* (the
  root MorphoLex gives both). `build_poetry.py --morpholex` roots DRIFT's 2,226 titles as it
  roots the poems (`kin`: 577 share a root). Elsewhere in the garden a swimmer writes as DRIFT has it, and the label
  under the view says which order chose a line (the line's place in its poem, its plot, its kin root or its painting).
- **The link is named.** When DRIFT names a painting, the root its title shares with the poems is written beside its
  name, with the line it opens to.

The swimmers ask the page for their next line through the one line `build_poetry.py` turns in DRIFT Poetry's copy of
DRIFT's engine (`organize`, `ENGINE_TURN`: the page answers with a line, with -1 for the engine's own choice, or with
-2, rest); DRIFT's own page and source are untouched, and if DRIFT's engine changes there, the build says so and the
swimmers keep DRIFT's own choice. `window.DRIFT_POETRY.order()` lists the lines begun lately, the frame each was begun
in and which order chose it. Not yet ordered: DRIFT's own placing of its paintings.

## The photographs, into the collage

Each page's photograph goes into DRIFT as a photo the viewer puts in does (`GLG.putIn`, drift.js): it arrives torn out
where it is put in, and DRIFT's collage melts it (the datamosh) and carries it off in torn pieces across the plane. They
come in by page, as the storyboard has them: when a page's plot comes into view (the visit begins at one, once DRIFT's
ground is painted), its photograph arrives at the plot's frame, over its building, unless it was the last to arrive; at
most one in 13 seconds, so a flick through the pages does not bury the plane in them; and for 377 seconds after the
viewer puts in a photo or a name of their own, theirs is left to drift. (Until 27 Oct 2026 the next went in quietly
every 144 seconds.)

## The buildings, on the ground

Aries, 14 Oct 2026: "Make sure I can still rotate architecture buildings in DRIFT Poetry like I can in Picture
Poetry." The buildings of the eight pages (Turner Contemporary, Ordrupgaard, the Menil Collection and Cherry Hill's
farmhouse and barn on page 3, the Phillips Collection, Spring Point Ledge Light, the Parthenon, the Guggenheim and the
National Gallery of Art's West Building) and the walled garden, ten plots, stand on DRIFT's ground on their own, each
in the middle of its plot's frame in the storyboard (above), the foot of its plot on its row's one baseline; the visit
begins at one (`#pageN` at page N's). (Until 27 Oct 2026 they were dealt on a lattice of 1597-pixel squares, scattered
within φ⁻¹ of their squares.) Each is drawn live by Picture Poetry's own model code on its
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

## The books written for it

Aries, 23 Oct 2026: "Imagine you are Shakespeare now and just as he used historical narratives to write his books, use
all that you know of history to write books with the skills/power I have given you", and of the first: "paradise:
Persian walled gardens to Eden, Dante and your "return to the garden"; Just make this one for now". A book written for
DRIFT Poetry is a file in `books/` (committed: it is written here, not taken from Picture Poetry), and `build_poetry.py`
adds each to the ground as one more plot, after the last page in the storyboard, that opens as they do (`#paradise`
begins at it). Its plot is a model in the site's own format (`models.js`), built of its place's DIRT soil; its outline at rest is
measured as `capture_pages.js` measures the book's (drawn at heading π/4 on a 900 by 675 canvas) and kept in the file.

**Paradise** (`books/paradise.json`): the plot is a walled garden after Pasargadae (Cyrus II, from about 546 BCE),
of Pasargadae's soil, with a crepe myrtle at its middle; its leaves are a chronicle in eleven scenes, from Sardis in
407 BCE to Aries's backyard on 24 Sep 2026, printed as a play is, each with its sources under it. Its Chorus is the
Gardener of *Richard II*, whose law is the skill's: each scene is pruned to the power at which it stands still,
keeping only its names, places, dates and nots (Morphology Web's HELD), and what stands is its brick; the last leaf
lays the bricks as a wall round the words the book never cuts, Aries's own, as the word says: *pairi-daēza*, a wall
around. One scene is an invented history, marked so, and stands in the wall as its gate.

# Rocket

A simpler game in the way of Minecraft's phone app, about one mission: you come down hard, come
to under a tree beside your wrecked capsule, and find the four pieces of your rocket, to build it
at the wreck and launch. Served at `/worlds/rocket/`.

## The tribar, not the pixel

The game is not drawn in Minecraft's pixels. Its unit is the impossible triangle the artist chose
(14 Oct 2026: "Instead of using cube pixels as the common unit to build out the design I want you
to use the shape in the image"): a tribar, three bars on a triangular lattice, and in the artist's
drawing three tribars round an inverted gap. What was read from that drawing:

- **Three tones, each one ribbon.** Every bar shows two faces: the left bar grey outside and black
  inside, the bottom bar black outside and white inside, the right bar white outside and grey
  inside. So each tone is the inner face of one bar turning the corner into the outer face of the
  next, and each bar owns the corner it comes to first — that rotation is what makes it impossible.
- **The white is the ground.** The white faces are the page itself, told from it only by a hairline;
  the figure is drawn by its grey and black.
- **It is self-similar, and it runs on.** The drawing is three tribars round a gap; where two touch,
  the grey of one runs straight on into the next.

So every face of every block is a field of tribars, one to a block, in rows a block high, every
other row half a block along — three round every gap, the artist's figure everywhere. The white is
the surface's own colour (limestone, brick, lawn, plaster), so the figures rise out of it and sink
back into it; grey and black are that colour deepened; a hairline draws the white faces. Across
blocks of one material the ribbons run on unbroken, and a lawn's side is green ground with figures
of earth. Water's three tones turn slowly round its figures, and the rocket's pieces turn theirs
quickly, so their ribbons seem to flow; glass is leaded in figures; a gallery's plaster carries
quieter ones, so the works on it are what is seen; a note has the figure pressed into its paper.
Far off, where a figure would be a few pixels, a face is its figures' mean, so nothing shimmers.

The view is at the screen's own density, smooth, with no grain, dithering or shaded corners (and
softens while you come to, under your tree); the works are their pictures from Artsy at a finer
size, in frames of the same three tones (lit along the top and left, shadowed along the bottom and
right, turned the other way where they meet the picture). The crosshair, the pieces, the blocks to
place and the title's mark are the figure too; the smoke is triangles.

## Escapes made from what the site holds

Every adventure is generated, by a seed, from the art database the site has put together on
Artsy (`../../v2/museums.json`, each work's history in `../../v2/histories/`, the works hung in
`../../v2/interiors/<slug>.json`) and from the buildings it has modelled (`../../v2/models/`,
with their surroundings in `../../v2/grounds/`). The start screen offers three kinds, a place of
that kind, and an adventure number; the same place by another number is another adventure.
`#museum/<slug>/<seed>`, `#building/<slug>/<seed>` and `#city/<key>/<seed>` open on one (an old
`#<city key>` link still opens its city).

- **A museum** (46 of them: those with a model, a plan, a ground and six or more saved works hung
  in it). Its model is filled in at a metre to the block and stood on its neighbourhood; its rooms
  are carved from its plan, turned so the main walls lie along the blocks: every floor, room,
  doorway and stair the file draws, a stair laid where two floors have none between them, the
  door cut where the file says, the walls plastered and the floors boarded. The saved works hang
  on the walls as their Artsy pictures, framed (gilt for those before 1900), at a third again their
  real size; a room short of wall has walls stood in it, and a work its room has no room for hangs
  in the nearest room that has (sixty works at most, chosen by the seed). Four pieces are behind
  four of the works.
- **A building** (36: the Architectural Authority's houses, studios and halls with a model). It is
  hollowed out, its floor boarded and a door cut toward where you came down (a model drawn as a
  cutaway, an interior with its ceiling left off, is the room its walls close round), and a dozen
  saved works, chosen by the seed, hang inside. Two pieces are behind works; one is on the roof,
  one in the pool or buried in the garden.
- **A city** (the site's 28, from `grounds/city-*.json`): the hunt as it was, a piece on a roof
  (stack blocks to climb), one buried in a park (dig the loose earth), one in the water (swim
  down; under a square's paving where there is none) and one in the top of a tree.

## Clue

A piece behind a work is found by deduction, as in Clue. The clues are made from what the works
really are, the fewest that leave only the one: its size, its colour, its medium, when it was
made (century, decade, before or after a year), the floor and the room it hangs in, and last, if
nothing else will do, who made it or a word of its title. The first is in the wreck's log, known
from the start; the rest lie about the rooms as notes (most in rooms with works in them), each in
a voice of its own: a night guard's note, a torn ticket, a visitor's diary. Tap a work to read its
label (title, artist and date, medium and size, room and floor) and look behind it. A wrong look
sets off an alarm; at the third the guards walk you out, and you come to under your tree again,
keeping what you found.

The arrow at the top points to the nearest note still to read, then to a piece still lying about,
then to the wreck once all four are found; from outside, to the way in. Break a block by tapping
it; switch to Place, or pick a block from the bar, to set one (a wall a work hangs on stays).

On a phone: the stick on the left, drag to look, tap, the jump button (single steps are climbed by
themselves). On a computer: W A S D, drag to look, click; space jumps, 1–5 picks a block, E
switches break and place, N opens the notes, F looks behind the work whose label is open.

## Files

- `adventure.js` — the generator, no DOM: what a work is (`facts`), the clues that single one out
  (`clueSet`), the adventure for a place and a seed (`make`).
- `place.js` — the place in blocks, no DOM: the ground, the model, the rooms carved or hollowed,
  the crash site, the works hung (`hang`), the pieces hidden and the notes left (`hide`). Both run
  in Node, so a test can build every place without a page.
- `rocket.js` — the game: the mesh (16 × 16 columns a chunk, the nearest first and the rest a few
  each frame), the tribar drawn on every face (the fragment shader `FS`, and `figure()` for the
  page's marks), the works' pictures, the hand, the opening, the labels and the notes, the rocket,
  the start screen.
- `catalogue.json` — what each adventure can be made from, written by
  `python3 scripts/build_adventures.py`.

Where you had got to in an adventure (the pieces found, the notes read, the works looked behind,
the alarms) is kept in the browser, and comes back when you open the same adventure again.

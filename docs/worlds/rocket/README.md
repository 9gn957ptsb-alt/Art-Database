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
with their surroundings in `../../v2/grounds/`). The start screen offers four kinds, a place of
that kind, and an adventure number; the same place by another number is another adventure.
`#museum/<slug>/<seed>`, `#building/<slug>/<seed>`, `#form/<number>/<seed>` and
`#city/<key>/<seed>` open on one (an old `#<city key>` link still opens its city).

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
- **A new form** (any number; the start screen lists the first two dozen): a building no one
  drew, made of the sections of the modelled buildings (below), stood on the ground round the
  project its first volume came from. Hollowed and hung as a building is, two pieces behind
  works, one on its roof, one in its pool or garden; its rooms are called after the sections
  they are in ("the space under the white cantilevered box of Casa Berman"), and the notes say
  what it is made of.
- **A city** (the site's 28, from `grounds/city-*.json`): the hunt as it was, a piece on a roof
  (stack blocks to climb), one buried in a park (dig the loose earth), one in the water (swim
  down; under a square's paving where there is none) and one in the top of a tree.

## A world built of the modelled buildings, taken apart

The architecture of the world is the Architectural Authority's projects, broken into the sections
they are made of and put together again (14 Oct 2026: use the projects to generate the
architecture and forms of the world; break each into sections by space type and architectural
feature, and juxtapose them into new forms).

- **Taken apart** (`scripts/build_sections.js` → `sections.json`). The models carry no names for
  their parts, so the sections are read from the parts themselves: the big parts are masses,
  masses of one footprint stacked or one inside another are a volume, every smaller part
  belongs to the volume it lies half within, a roof to the volume it sits on, the rest stand
  free and are grouped by material and touch. A volume is named by the space it is, from where
  and how it stands: the ground floor, a wing, the long wing, the block, the glass pavilion, the
  hall, the tower, the upper box, the cantilevered box (run out two metres or more past what
  holds it), the box on columns, the lookout, a berm or a plinth, the room of an interior drawn
  as a cutaway; a roof by its shape (gabled, hipped, sloping, a slab, a dome); a feature by its
  parts (a screen, slats, fins, a colonnade, a pergola, the edges of floors, a frame, a canopy, a
  wall, a stair, a plinth, columns, a corten panel, a glass or curtain wall); the ground's pools,
  ponds and lakes, terraces, decks and courts; the garden's trees. 549 sections from the 36. Each
  is filled in at a metre to the block, cropped and run-length coded, with where it stood; a bay
  repeated along a building is kept once, with its count.
- **Put together** (`forms.js`). `form(seed)`: one project's volume on the ground, another's wings
  against it (along a side or running out from it, flush, centred or past its end), a third's
  upper box on top, run out past one end as far as it ran out in its own building and over open
  ground, a fourth's roof drawn again over the highest at its own pitch, or a lookout; a fifth's
  screen across a face, or its pergola off a side; a pool slid under the overhang, a terrace,
  and one garden's trees round it all. `tower(seed, w, d, h)`: for a lot, one project's ground
  floor over the whole of it, another's storeys over that to the lot's height, set back when it
  is tall, a crown (a roof, a lookout, or the flat top its storeys end in), now and then fins up
  a face; a section with no glass of its own is given windows. A section stretches as a
  nine-slice does, its ends kept and its middle repeated, so a wing grows by its own bays and a
  block by its own storeys; it turns by quarter turns. Each comes with its recipe ("The white
  cantilevered box of Casa CM on the limestone wing of Las Casuarinas, …") and a name from the two
  it is most made of ("Casa CM × Las Casuarinas").
- **The world** (`place.js`). Every built cell of a place's ground is a lot now: cells of a like
  height gathered row by row into lots of one to three a side, each a tower of the sections as
  tall as its storeys; the cells round the place's own building and round a city's crash are
  left open, so no building is cut in two. Every block of a lot or a new form remembers which
  project's section it came from: the crosshair names it ("The dark wing of the Minnesota
  Residence · Casa en el Dragon × Minnesota") and the line at the top names the lot you stand by.
  A modelled building's rooms are called after its own volumes ("the long concrete wing").
- **The breakdown** (`forms.html`): every project taken apart (tap it to put it together), each
  of its sections in isometric, every block three faces in three tones of its colour as the
  tribar has them, coloured by what it is made of or by what each section is; and six new forms
  at a time, each with its recipe and a way into its escape.

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
- `place.js` — the place in blocks, no DOM: the ground and its lots, the model, the rooms carved
  or hollowed and named, the crash site, the works hung (`hang`), the pieces hidden and the notes
  left (`hide`), which section a block came from (`partAt`). Both run in Node, so a test can
  build every place without a page.
- `forms.js` — the new forms, no DOM: the sections sorted by what each can be (`load`), a
  section's blocks (`stampOf`), a roof drawn again at a new size (`roofOver`), a house of new
  parts (`form`), a building for a lot (`tower`).
- `sections.json` — the 36 projects taken apart, written by `node scripts/build_sections.js`
  (`--list` prints every project's sections).
- `forms.html` — the breakdown: the projects taken apart and the new forms made of them.
- `rocket.js` — the game: the mesh (16 × 16 columns a chunk, the nearest first and the rest a few
  each frame), the tribar drawn on every face (the fragment shader `FS`, and `figure()` for the
  page's marks), the works' pictures, the hand, the opening, the labels and the notes, the rocket,
  the start screen.
- `catalogue.json` — what each adventure can be made from, written by
  `python3 scripts/build_adventures.py`.

Where you had got to in an adventure (the pieces found, the notes read, the works looked behind,
the alarms) is kept in the browser, and comes back when you open the same adventure again.

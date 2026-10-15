# Rocket

A simpler game in the way of Minecraft's phone app, about one mission: you come down hard, come
to under a tree beside your wrecked capsule, and find the four pieces of your rocket, to build it
at the wreck and launch. Served at `/worlds/rocket/`.

## The figure, not the cube

The game is not drawn in Minecraft's cubes. Its unit is the impossible triangle the artist chose
(14 Oct 2026: "Instead of using cube pixels as the common unit to build out the design I want you
to use the shape in the image"): a tribar, three bars round a triangle, and in the artist's
drawing three tribars round an inverted gap. At first it was drawn on the faces of the blocks; then
the artist asked for it as a thing (15 Oct 2026: "Make this a 3D model first and then integrate
that into this artifact as the building block. Right now it's just planted on the surface of the
cubes").

**The model.** An impossible figure is a real object seen from the one place where its cuts line
up. The drawing was read as square bars on the edges of a lattice of cubes, along paths whose ends
meet only when seen down the (1, 1, 1) diagonal in parallel projection, and the bars' paths and
thickness fitted to it (the outer frame exactly, the pinwheel inside very nearly). It comes to six
bars, a tenth of a block thick: three long ones, one along each axis, running the block's whole
width (the outer frame: the grey post on the left, the black base, the white-topped beam on the
right), and three short ones inside (the pinwheel). It is built in SketchUp at 40 in across,
`scripts/sketchup/impossible_triangle.py`, saved as `sketchup/impossible-triangle.skp`, with two
scenes: the drawing (down the diagonal, rolled so that the triangle stands on its base) and turned
(where the bars are seen not to meet). Each bar's faces take the drawing's tones by the axis they
face: X grey, Y black, Z white.

**The block.** Every block of the game is that model, a metre across, its post upright (x east,
y up, z south, so that a block seen from the north-east and above, down its diagonal, is the
drawing). Its three tones are its material's, by the way a bar's face looks: up white, east and
west grey, north and south black, the material lit, itself and deepened. A lawn's bars are earth
with green tops, a log's ends are paler, leaves keep their green in the dark, glass takes the sky,
a gallery's plaster is quieter so that the works on it are what is seen, and the rocket's pieces
breathe. The long bars of blocks side by side run on into each other, so a wall is a lattice and
a field a deep one; between the bars you see into the blocks behind, and through a wall a block
thick to what is beyond it. You still stand on a block and are stopped by one: the bars are what
you see, the block what you touch.

**How it is drawn.** The place's grid goes to the graphics card as a texture of block ids, a layer
to each height. The faces where a block meets the open are meshed as before, but a face only
starts a ray: the fragment shader (`FS` in `rocket.js`) walks it on from the face, block to block,
testing the six bars in each, and shows the first it meets, a little deeper for each block it has
gone in. A ray that comes out into the open again lets the faces behind show; one still among bars
after eight blocks shows the dark between them. A face keeps its own depth, which is right because
every face along a ray between it and what it meets is one the walk has passed through; chunks are
drawn nearest first, so what is hidden is turned away before its walk. Breaking or placing a block
sends its column again; the rocket walks a little grid of its own, which rises with it. Far off,
where a bar would be narrower than a pixel or two, a face shows what its blocks average to
(`scripts/rocket_far.py` runs the same walk over many rays, at a slant and from nearer straight
on), so nothing shimmers. If the frames come slowly, the view coarsens, and then the walk is kept
nearer. Water and the notes are surfaces, not blocks: water its colour with the sky in it at a
slant, a note paper that catches the eye.

The view is at the screen's own density, smooth, with no grain or dithering (and softens while you
come to, under your tree); the works are their pictures from Artsy at a finer size, in frames of
the same three tones (lit along the top and left, shadowed along the bottom and right, turned the
other way where they meet the picture). The blocks to place, the pieces and the title's mark are
the model seen down its diagonal, which is the drawing; the crosshair is a tribar; the smoke is
triangles.

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
  each frame), the block (`FIGURE`, the model's six bars), the walk through the blocks from their
  faces (the fragment shader `FS`, over the grid as a texture, `voxTexture` and `refresh`), the
  page's marks (`blockMark()`, the model seen down its diagonal), the works' pictures, the hand,
  the opening, the labels and the notes, the rocket, the start screen.
- `catalogue.json` — what each adventure can be made from, written by
  `python3 scripts/build_adventures.py`.

Where you had got to in an adventure (the pieces found, the notes read, the works looked behind,
the alarms) is kept in the browser, and comes back when you open the same adventure again.

## Straight in: Rocket as an Artifact

The game also runs as an Artifact (a page hosted on claude.ai), built by
`node scripts/build_rocket_artifact.js <out dir>` (artist, 15 Oct 2026: "Give me a first person
Minecraft like game. As soon as I open the artifact, the entire screen should be a fade into a
first person view of the character waking up under a tree after crash landing"). There is no
start card: the page sets `window.ROCKET = { play: true, … }`, the screen is black while the
place is built, and the eyes open on it under your tree, on the wreck's side of its trunk; the
notes are a tap away rather than open over the view. Its escapes are the new forms (most often
one of fifteen with an upper box, a crown and a pool) and the modelled buildings; the escape you
were in comes back if it is not over, and "Another adventure here" or "Somewhere else" picks the
next. An Artifact loads nothing from other sites, so the bundle carries the scripts and style
inlined, the sections, the 36 buildings' models and grounds, and 150 of the saved works with
their pictures (fetched once from Artsy's image server; the bundle is written outside the
repository). `window.ROCKET` can also set `base` (where the data is), `art(id)` (a work's
picture), `kinds` and `forms` (what an escape may be).

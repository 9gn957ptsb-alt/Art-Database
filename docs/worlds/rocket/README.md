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
sends its column again; the rocket walks a little grid of its own, which rises with it. Further
off, a face shows what its blocks average to (`scripts/rocket_far.py` runs the same walk over many
rays, at a slant and from nearer straight on): it closes into that mean from where a bar is eight
pixels wide to where it is under four, a quarter of the distance it once did (artist, 15 Oct 2026:
"Have the distance in which the facades of objects disappear be 1/4 of what it is now"). The
pixels are the screen's at the quality the view starts at (while you come to, the view's own
coarse ones), so the distance holds on every screen and whatever the frames do. That closing,
measured from the camera, is the screen's limit: past it no bar opens, too fine for the pixels.
Short of it a face opens by **Mr Pearl's nearness** (artist, 21 Oct 2026: "The distance in which
facades become transparent due to Mr Pearls proximity should be cut down to 1/4 what it is now and
it should be 1/32 what it is now for horizontal surfaces exclusively that way the ground isn't
constantly exposed, only when you are looking down"): the same closing over his distance taken
four times for an upright face, so at a quarter of the distance, and thirty-two times for a level
one (a floor, a roof, a ceiling), a thirty-second (`NEAR_F`); his distance is the nearer of the
line up through him, from his feet to the top of his hat, and his head's centre, on him or out as
the hologram. A face is the more closed of the two. On a computer's screen (1280 × 720) an upright
face is open within 1.6 m of him and closed by 3.5 m, a level one open within 20 cm and closed by
44 cm (the camera's limit: 6.4 and 14.1 m); on a phone (390 × 844, the view at the density and
quality it starts at there) 2.8 and 6.2 m, 35 and 78 cm (11.3 and 24.9 m). So a wall he walks up
to opens round him, a couple of metres off, and the ground stays shut but for a small ring round
his shoes, which shows as you look down at him at a slant; from straight over him his hat's brim,
40 cm out from him, hides the ground to about 60 cm, so on a phone only the ring's fading edge
shows past it and on a computer none of it. Further off the land reads solid. The closing is a
fade, holes and all: every pixel of a face is (1 - lod) of the open face and lod of its mean, lod
going from 0 where a bar is eight pixels wide to 1 where it is four. A bar is mixed toward the mean
where it is drawn; where a hole lets the faces behind show, a second pass over the same faces
(blended, depth test LESS against what was drawn, no depth written: it passes only in the holes)
paints the mean over them at lod, the furthest faces first. So nothing snaps shut: what you see
through a hole dims as the bars around it do; the second pass goes over only the chunks near him
or his head, since nowhere else is a face short of closed. If the frames come slowly, the view
coarsens, and then the walk is shortened (eight blocks, then six, then four); neither moves the
fade. Water and the notes are surfaces, not blocks: water its colour with the sky in it at a slant,
a note paper that catches the eye.

The view is at the screen's own density, smooth, with no grain or dithering (and softens while you
come to, under your tree); the works are their pictures from Artsy at a finer size, in frames of
the same three tones (lit along the top and left, shadowed along the bottom and right, turned the
other way where they meet the picture). The blocks to place, the pieces and the title's mark are
the model seen down its diagonal, which is the drawing; the crosshair is a tribar; the smoke is
triangles.

## The figure in 3D

Then the artist asked for more of it (15 Oct 2026: "Use the shape with itself to actually realize
its 3D potential, I understand it's an impossible triangle that can only visually exist like that
in 2D. It's okay if all doesn't connect to itself. Explore different ways it can exist 3D"). The
drawing fixes only what is seen down one line of sight. Every point of an object can slide along
that line, or be moved with all the others on its line (sheared, stretched along it, drawn in
towards an eye), and the drawing does not change: one drawing is a whole family of objects. Ten of
them, most made of the figure with itself:

- **The figure** — the drawing as one object, nine beams on a lattice (the block's model).
- **Apart** — its three tribars slid two cells along the line of sight either way; none touches.
- **Closed** — its three cuts joined by struts that run straight down the line of sight, hidden
  behind the nearer end: one closed object, impossible only from the diagonal.
- **Figure of figures** — the figure's own rule (each tribar the first turned a third about the
  diagonal and moved) applied to the figure: three of it round a gap, nine tribars.
- **Three turns** — the figure with two copies turned a third and two thirds about its own line of
  sight: the frames fall on each other, the middles cross through one another.
- **Tower** — four of it, each turned a quarter about an upright and set a storey higher; from each
  corner a different one closes. The upright stands in the middle of a cell, not on a beam, or the
  uprights of the storey below would line up with the closing one's and draw its legs on.
- **Drawn out** — stretched four times along the line of sight.
- **Bent** — every point moved along the line of sight by a bow across the drawing.
- **One point** — for one eye, in perspective, as the large outdoor ones are made: every point
  moved along its line from the eye, the near parts drawn in small and the far ones out large (a
  projective map, so a beam's faces stay planes), so that from there it is the drawing exactly.
- **Siblings** — three different objects (other turns and depths of the tribars) that draw it.

`python3 scripts/figure_studies.py` writes them to `figures.json` (`--sheet out.png` draws a check
sheet: each closed, then turned twice), and `scripts/sketchup/impossible_triangle_studies.py`
builds the same ten in SketchUp by the same rules (`sketchup/impossible-triangle-studies.skp`: a
group a study, a solid a beam, a scene where each closes and the tower's four). `figure.html`
shows them: each turned by hand or left to turn, and swung round to where it closes, the lens
drawing back to parallel for the nine that close in parallel projection; the white faces are
drawn round with a hairline, as in the drawing. `#tower` (or any study's key) opens on one. As an
Artifact it is built by `node scripts/build_figure_artifact.js <out.html>`, the studies inlined.

**In the game.** Over the wreck hangs the figure of figures, drawn in towards the eye of one
standing where you woke (`underTree()`): every line of sight of the drawing onto one ray from that
eye, the nearer parts nearer, a hundred metres off and more. So it is the drawing as you sit up
and turn to the wreck, and from anywhere else its beams come apart across the sky, long and
tapering away from the tree; walk off and come back to stand where you woke and the view is his own
eyes, as on a stone of the homage, and you are told once that it has closed again.
It is placed as near straight over the wreck and as low as the place leaves it clear from that
eye, in the drawing's own grey, black and white under a lighter haze, and nothing to walk on. You
watch the rocket go from the same place.

## Mr Pearl, and the two views

You are Holographic Mr Pearl, and now you see him (artist, 16 Oct 2026: "Make it third person above Mr Pearls
head so we can see him with an option to switch to first person or Holographic view"; then, 21 Oct 2026: "Get rid
of first person view as an option, just have one button that toggles between holographic view and third person
view").

**Him.** His head is "the only perfect Sphere in the game, everything else will receive the consequential texture
of the base unit" (the artist), so the two are drawn two ways. His body is the game's own block seven golden steps
down: cells of φ⁻⁷ m (3.4 cm), the level whose unit is his narrowest part, a glove's finger, each cell the figure's
six bars a tenth of it thick, 3,595 of them, 49 cells from his shoes to the top of his hat. A cell is his where its
centre lies inside the form (`pearl-body.json`, the primitives of the form fitted to the album covers), coloured by
the part it lies deepest in: the suit, the hat and the shoes in eight tints of the pearl's own film, the guitar
with its gold edge. The cells are split into ten small grids, one to each part that moves (the pelvis, the torso,
each arm, the guitar and its strap, the hat, each thigh, each shin with its trouser and shoe), and each is walked
by the blocks' own shader, exactly as the place's grid is, under a model transform that turns it and scales it to
his unit, the pixel's width measured in his unit; so near to he is open bars, as a wall is, and further off he
closes into his colours, fading shut as the facades do but by the camera's distance alone (the facades' opening
round him is not his; his faces are in the veil's second pass with the place's): from the third-person camera he
is always closed, and he opens only within about half a metre on a computer's screen, a metre on a phone's. His
head is not
built at all: a program of its own solves a ray for each pixel against the sphere, so it is exactly round at any
distance and any size on the screen, in the pearl's thin film, the two black oval eyes painted on it. He walks by
the ground he covers, not by the clock, so his feet never slide: a stride every two leg lengths, each thigh
swinging 30° (a step a leg long), the knee folding as its leg comes forward, the hips dipping as a leg straightens,
the guitar turning a little against the legs. He turns to the way he walks, half round in the time he walks his
own height, and to what you reach for. A better form is dropped in by replacing `pearl-body.json`; every distance
below follows from his measures in it.

**Third person**, the view you come to in, is over his head. The camera stands far enough back that his whole
figure is a third of the screen's height at the game's 70° view (3.46 m along the look), looking down so that the
horizon lies on the upper third line, his middle at the middle of the screen's lower half; that puts the camera a
metre, one block, over the top of his hat. It comes round behind him as he walks, in the time he walks its
distance from his head, but not while you are turning the view or walking him back toward it, so you can walk him
round to see his face. A block between it and his head pulls it in along the line from his head at once, so his
head stays where it is on the screen and the view never enters a block; it lets out again no faster than he
walks. You look up only as far as keeps the camera over his hat (with the sight up, as far as from his eyes). The
crosshair, a tap, breaking and placing go from the camera through the screen, but begin where the ray passes him
and are measured from him, so his reach is what it was: a work within nine blocks of him, a block or a note within
six. As you come to under your tree it is
still through his eyes, as the artist asked of the opening; then, as he sits up, the view rises out over his head
to the nearest side where nothing stands between it and him. On a stone of the homage the view is his own
eyes, as the stone is the one point its figure closes from (from over his head he would stand in front of it);
so too where you woke, the one point the figure in the sky closes from, once you have walked off and come back to
stand there (within 45 cm of it, at its height: not as you come to, nor as you come to again when the guards have
put you out); stepping off, it rises out over his head again, in the time a switch of view takes. From his eyes
you may look up and down as far as they go, as the third figure is looked up at.

**Breaking is a smash with his guitar** (artist, 21 Oct 2026: "He should be using his guitar to smash things when
using the break function"; and the same day: "The break animation by Mr Pearl has to be twice as fast and there
should be 3 baseline variations of the animation that are randomly used. Give the animations more style, look at
different hand combat styles of fighting (check out the game Mortal Combat)"). A tap or a click to break turns him to
the block and starts a swing whose strike falls half a beat later (an eighth note of the theme song, 0.24 s). His
hands hold the guitar, so both arms and it turn as one about the line through his shoulders (as high as 78°: no cell
of his arms or the guitar ever enters the head's sphere), and his upper body turns about his spine as the walk turns
it, made large. Each swing takes one of three styles at random, as Mortal Kombat: Deadly Alliance gave each fighter
three: **the sweep** (Kitana's fan swipe): he coils a quarter turn to his right with the guitar raised and cuts across
onto the block at an even pull, his shoulders turning at two turns a beat at the strike, then follows through up to
his left; **the slam** (Jax's ground pound): he springs up as the guitar goes up and comes down on the block as he
lands, the leap's flight the swing's half beat under the game's own gravity (0.18 m high), the guitar driven on down
through it; **the spin** (Kung Lao's spin): the guitar out at the block's height, his whole body turns a full turn
and strikes as it comes round, his head staying on the block as a dancer's does, his shoulders carrying on a quarter
turn past it. In each the tail of the guitar's body comes onto the line from his feet to the block at the strike, at
the block's height as seen from his shoulders, and the swing is back at rest a beat after the tap; while the guitar
goes faster than he walks its path leaves a swoosh in the gold of its rib, fading over half its step (none under
reduced motion). The block breaks at the strike, within his reach as before (six blocks from his eye: the guitar
itself meets a block a step ahead at his waist or his head, and the blow breaks the ground ahead or a block further
off at the same strike), and its six bars fly out of the face he struck at half the guitar's speed and fall, lying
where they land, gone a beat after the strike. A tap during a swing is kept, the latest, and struck half a beat
after, swung on from where the last one's follow-through ends (the sweep's other side; under the slam, an uppercut):
two blocks a beat. Walking, his legs walk on under the swing; in water it goes at his speed there over his walk. If
the block is gone or changed by the strike, or he has gone out of reach, nothing breaks; going out as the hologram
lets the swing go.

**The sight, and the pearls he throws** (artist, 20 Oct 2026: "I want you to be able to aim at a target with a
reflex sight that I can control with my right finger while my left finger allows me to move around the area", and
"And when I click with the reflex sight up, I am able to throw something"). A reflex sight is a window of partly
reflecting curved glass with a lit mark at its focus, seen at infinity, so the mark lies on the target wherever the
eye is behind the window. His head is the one thing in the game that can be that glass, the only perfect sphere, its
film partly reflecting: so the head is the glass, and the figure is the mark. Sight (over Holo; `R`; the right mouse
button, held, or clicked to leave it up) raises it in the time a switch of view takes: the camera comes down from
over his hat to φ behind his head's centre on the line of the look (the hologram's own distance, the height of the
head's top), so his head is the middle of the view and its outline the window, 8.7° across its half (93 px on a
phone held upright, 79 on a computer), clear in the middle and bright at its edge as the film is seen aslant; the
head itself clears into the glass over the raise's second half. He doffs his hat into his left glove (its brim would
cover the glass), lifted clear of his head, out to his left and down, so it never passes through his head or his
body, raises his right arm, the upper arm level out to his right and the forearm as upright as its bend lets it, a
pearl in the glove, and faces the mark; the stick walks him as before, sideways too, and the camera no longer swings
round behind him. The mark is the figure, the block's own seen down its diagonal, white and grey as light over a
keyline of black, its aim point the crux, the figure's undrawn apex, at the middle of the screen; from the crux hang
its holding circles, 8, 13 and 21, and their feet are the holdover marks, each labelled with the range at which the
throw comes down through it, worked out from the arc as you aim. The figure closes into the drawing when the aim is
still and opens into its bars as it turns; still, a ring on the ground says where the pearl comes down; under the
glass, in words, what the mark is on, how far, what it came from and the relation that put it there (a work says how
big it hangs against its real size). The right thumb's drag aims, a pixel of the finger moving the mark a pixel over
the far world (a reflex sight magnifies nothing); a point held still for a beat comes to the mark (the way that does
not drag); the arrow keys turn it its window's breadth a beat. A tap or a click anywhere, `T` or `Enter`, throws.

**What he throws** is a pearl built of the unit, three of his cells round (136 of them, in six bands of his
jacket's tints), never the perfect sphere; he carries five, one for each finger of his throwing glove ("Pearls 4 of
5" under the alarms). It leaves the glove at 29.2 m/s, the speed whose farthest throw on level ground is F(9) = 34 m
(35 m from his hand's height, aimed 39.5° up), on the arc that comes level with the sight's line at his reach, six
metres out, heading for what the mark is on, so that it comes down on the mark's upright (his glove is 0.39 m right of
the line); it takes his walk with it, spins backward a turn a beat and trails the last beat of its path. One a beat:
his arm flings forward and comes back up, the next pearl in the fingers from the half beat, and a tap before the arm
is up is kept, the latest. It bounces with half its speed, comes to rest, sinks in water as he does, and where it
first touches says what it struck: a work's title and who made it (never a look behind it, never a wrong look), a
piece of the rocket (it rings: the arrow points to that piece first), a block's section and project, the water. It
takes, breaks and looks behind nothing. It comes back when he walks into it, or when it is tapped with the sight
lowered within his reach; he comes to again with all five. The tap with the sight down smashes, as before; with it
up, it throws; raising it lets a swing go. As the hologram there is no sight and no throw. Under reduced motion the
sight comes up at once, the figure stays closed and the ring is always shown, and the arm does not fling.

**One button**, Holo (or `H`), between the two: it sends the head out as the hologram, and pressed again the body
follows it and the view is third person again. It is pressed while the head is out, and the ring round it is the
hologram's time. First person is no longer a choice: his own eyes are the films' (the wake-up, the launch), a stone's
and where you woke; a first person the game kept from before comes back as third.

**Holographic.** "Holographic mode disengages the head of Mr Pearl" (the artist): the head lifts off its seat by
its own diameter, in the time a jump takes to rise, and is free, in three dimensions and through anything, but not
below the world or out of the place. It flies at twice φ² times his walk out of doors and twice φ in a room
(artist, 21 Oct 2026: "The movement speed in holographic view should be double what it is now"), 22.5 and 13.9 m/s;
its speed comes and goes over the time the head takes to lift, so let go it comes to rest within its speed times
that time, 7.4 m out of doors and 4.6 m in a room, inside the nine metres a work is read from: it can still be
stopped at a work to read it. With the head gone nothing holds his hat: it falls straight down onto the bare neck,
as the form has it, and the head coming home picks it up. The body stays where it was, headless, "completely
vulnerable to getting destroyed"; nothing threatens it yet (`harmBody()` is where whatever does will call). The
time is one play of the theme song, two and a half minutes, shown as a ring round the Holo button; it fills again
in the body at the rate it was spent. **The body follows the head** (artist, 21 Oct 2026: "Wherever you move in the
holographic view should be where you land when you switch back to any other view", and then: "The body follows the
head, not the other way around"): every way out — Holo again, `H`, the time running out — sends the body from where
it stands to the spot under the head, fixed as it sets out (or, if he does not fit there, to the nearest place he
does), in one bar of the theme song, 1.92 s, the time the head took to fly home before: the same motion with the
roles turned round. It goes straight, eased in and out, through anything as the hologram goes, standing, facing
the way the head faced as it set out ("Your body follows your head."; "The time is up: your body follows your
head."; where he does not fit there, "…, to the nearest place it fits."). The head holds where it is and the view
stays with it: you may look round, not move, and the time stands; a second press does nothing. Come, the body
stops, and in the air it falls, unhurt ("There is no fall damage"), no faster than a block a frame so it never
passes through a roof; the head settles onto it in the time a switch of view takes (where it came exactly under
the head, without a visible move), and the view is third person. A head still lifting has not moved, and settles
back. Put out by the guards while it is on its way, its way ends with the head back on him, and you come to
under your tree. As the hologram you can look and read, a work's label or a
note (the paper stays where it lies), but not take, build, launch, break and place blocks, or raise the sight and
throw: "you cannot complete the missions like going to space by merely going into holographic mode".

## The homage: three figures where you wake

The artist asked for a third figure (15 Oct 2026: "it is not quite possible without the introduction
of a curve in three dimensional space ... consider the perspective points in which the Impossible
Triangle would make sense in relation to the forms of architecture that you build ... when you get
close to an aspect of architecture, a transparency, awakens, and as you progress further from the
structure, it closes back up ... I want one more version of a figure of the impossible triangle"),
then for the three side by side (15 Oct 2026: "Presents 3 structures at the beginning of the first
world that presents the three figurations of the impossible triangle They should be lined up next to
each other and be very simple objects, almost like an homage site").

**The three.** The first is the block's own figure, six square bars whose ends meet only down the
diagonal, closing from above, as the site draws its buildings. The second is being made in the game's
own session; its plinth stands empty until `homage.json` gives it. The third (`scripts/figure_three.py`)
is the first's six bars made one closed thing by a curve: every point of a figure may slide along the
line of sight without changing the drawing, so each tribar gives up its rise round its own loop, a
third a beam, in the beams' middles, its joints held square, until each cut's two ends lie EPS (0.3 of
a cell) apart, the near cube just in front of the far one; then the whole drawing is lifted by one
paraboloid, springing at its outer corners and rising the side over φ² at its middle, so the bars bow
into the ribs of a vault (a slide of whole sightlines never changes what is in front). Turned over, it
closes from below, as a person looks up at a building. Its tones are the drawing's, blended where its
faces turn: a vertex's weights are the squares of its normal along the figure's own axes. `--check`
rasterises it from its eye against the first and finds no pixel off the edges different; `--sheet`
draws it closed, turned, near and far.

**The site** (`homage.js`, no DOM). In the first world of a visit, not one escaped to (an escape marks
the next with `rocket-escaped` in the session's storage, and the world keeps `escaped` in its save, so
it has none when come back to), a row of three stands across the turn you make on waking, its middle
about half a radian into the turn, so the opening shot passes the first, the second and the third
before it comes to the wreck. It is set square to the blocks on open, level ground (a block either way
is levelled; road, paving and a model's laid gravel will do, never its footprint, water or the
crater), about nine metres off, never toward the wreck, on a strip of limestone in the ground that
makes it one site. Each figure is its drawing from one white stone, drawn in towards that eye as the
figure in the sky is drawn in towards the eye under your tree: every point moved along its line of
sight, near the middle at its own size (a projective map, so faces stay flat). Off the stone its cuts
come apart; back on it, it closes. Looked down on and up at along the diagonal's slope (35.26°):

- **the first**, on a pin in a limestone square sunk a block, looked down on from a white step;
- **the second**, a limestone plinth, empty, a white stone three blocks before it;
- **the third**, on a thread under the lintel of a limestone gate five blocks high, looked up at from
  a white stone.

On a stone you are told once which figure it is and how it closes; the crosshair names the blocks.
`node scripts/check_homage.js` plans it in every place an escape can be made of (fifteen new forms, 36
buildings: all but Naman Pure Spa, ringed by water, have room) and checks each figure against its
drawing from its stone; `--page PORT [shots]` plays it in headless Chromium.

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

On a phone: the stick on the left, drag to look, tap, the jump button (single steps are climbed by themselves), over
it the Holo button, and over that Sight. The stick is a touch on water, not a tool (artist, 21 Oct 2026:
"Revolutionize the way the joist stick shows up on the screen when using it, it's too distracting, have it be a lot
more subtle and feel like a natural force of nature rather than an analog tool"): where the left thumb lands the
surface answers once with a ring never quite round (the head is the one perfect sphere), the push draws it out the
way he goes, its front running ahead of the thumb as far as the push is strong, and let go it smooths over in two
beats of the theme song. It is a hairline of warm light with a blue-violet shade beside it, no disc and no knob,
drawn into the canvas the game redraws each frame anyway; under reduced motion it stands at one size and only fades.
The buttons of play (Sight, Holo, Break or Place, the blocks, Notes, Build, Launch) take a touch as it lands, as the
jump button does, so one thumb can press them while the other is on the stick (artist, 21 Oct 2026: "I want to be
able to switch between holographic view and third person view while I'm moving Mr Pearl"): a phone makes no click of
a tap while another finger is down. On a computer: W A S D, drag to look, click; space jumps, 1–5 picks a block, E
switches break and place, N opens the notes, F looks behind the work whose label is open, H sends the head out as
the hologram and, again, brings the body after it (as the button does); as the hologram, space rises and Shift or C
sinks. R raises the sight (or the right button, held or clicked) and a click, T or Enter then throws, the arrows
aiming; Escape lowers it.

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
- `figure.html` — the figure in 3D: the ten studies, turned and closed; `figures.json` is them,
  written by `python3 scripts/figure_studies.py`.
- `rocket.js` — the game: the mesh (16 × 16 columns a chunk, the nearest first and the rest a few
  each frame), the block (`FIGURE`, the model's six bars), the walk through the blocks from their
  faces (the fragment shader `FS`, over the grid as a texture, `voxTexture` and `refresh`: sent once
  the pieces are hidden and the homage set, since a block set after it is not seen up close — the
  pieces had been invisible within a few metres until 20 Oct 2026), the
  page's marks (`blockMark()`, the model seen down its diagonal), the figure in the sky
  (`figureBeams`, `drawnIn`, `placeSky`), the homage's figures (`HOM_VS`, `homageUpload`), the works'
  pictures, the hand, the opening, the labels and the notes, the sight (`raiseSight`, `sightCam`, `drawSight`) and
  the pearls he throws (`launchFrom`, `stepPearl`, `struck`), the rocket, the start screen.
- `pearl.js` — Mr Pearl, no DOM: his body built of the unit from his form (`build`), the walk (`pose`, with the
  throwing arm, `act.right`, `act.fling`, and `build`'s `throwArm`; `phaseStep`), his place in the world (`place`),
  and his head's own program (`HEAD_FS`, the true sphere). `rocket.js` draws them (`drawPearl`) and holds the views
  (`camera`, `thirdCam`, `holoCam`, `toggleHolo`, `holo`, `bringBody`).
- `pearl-body.json` — his form as data: the primitives of the form fitted to the album covers, his
  unit, his parts and joints, his walk and his palette, each with the relation that sets it.
- `homage.js` — the homage where you wake, no DOM: the three planned in the place (`plan`), each
  figure drawn in towards its stone (`drawIn`), the stone you stand on (`standing`), what a block of
  it is (`label`); `homage.json` is the figures, written by `python3 scripts/figure_three.py`.
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
place is built, and the eyes open on it under your tree, on the wreck's side of its trunk (his eyes:
then the view rises out over his head into the third person); the
notes are a tap away rather than open over the view. Its escapes are the new forms (most often
one of fifteen with an upper box, a crown and a pool) and the modelled buildings; the escape you
were in comes back if it is not over, and "Another adventure here" or "Somewhere else" picks the
next. The Artifact is called **Holographic Mr Pearl**, the name the game is becoming (artist, 15 Oct
2026: "Rename the artifact to holographic Mr Pearl"): its title, and `name` in `window.ROCKET`,
which the tab shows after the escape's own name. An Artifact loads nothing from other sites, so the bundle carries the scripts and style
inlined, the sections, the homage's figures, the 36 buildings' models and grounds, and 150 of the saved works with
their pictures (fetched once from Artsy's image server; the bundle is written outside the
repository). `window.ROCKET` can also set `base` (where the data is), `art(id)` (a work's
picture), `kinds` and `forms` (what an escape may be), and `name` (what the tab calls the game;
Rocket when unset).

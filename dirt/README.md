# Dirt

Procedural dirt for the artist website. It stacks layers, and each layer comes from a different
digital function. The layers are composited with CSS-style blend modes into one RGBA image,
usually a seamless tile.

| Layer | Function underneath | Looks like |
| --- | --- | --- |
| `wash` | fBm Perlin noise, domain-warped by more fBm | the base film of soil or grime |
| `clumps` | Worley (cellular) noise → domes, gathered by an fBm mask | crumbly soil aggregates |
| `cracks` | Worley F2 − F1 edge distance, two generations | dried, curling mud |
| `grit` | stamped specks with power-law sizes and harmonic-wobbled outlines | crumbs, sand, pebbles |
| `stains` | rings with noise-perturbed radius, Gaussian rim and tide lines | coffee and water rings |
| `smudges` | warped concentric cosine ridges in a ragged oval | greasy fingerprints |
| `scratches` | random walks with drifting curvature | hairline scratches |
| `dust` | fBm haze, hashed specks and curly random-walk fibres | settled dust |
| `mold` | Gray–Scott reaction–diffusion, fed only inside an fBm patch mask | mould and lichen colonies |
| `edges` | exponential edge distance × fBm (framed images only, not tiles) | grime in corners |

Any layer takes `relief` (0–2). It treats the layer as a bump map, lit from the upper left, so
grit, clumps and cracks read as physical matter rather than flat marks.

## Files

- `dirt.js`: the engine. A plain ES module with no DOM and no dependencies, so it runs in browsers and Node.
- `bake.mjs`: writes PNGs from presets or a JSON config (its flags are listed at the top of the file).
- `png.mjs`: minimal PNG encoder used by the baker.
- `build_soil_viewer.py`, `engine/ground-gl.js`: DIRT's page (below), and its ground painted on the GPU.
- `engine/wanderers.js`: the procession, migrations, walking city and primitives.
- `artists/`: the artists DIRT is drawn after, measured from their saved works (`measure.py`, `twombly.json`), the roster
  (`roster.py`), and the quilts of their works (`quilt.py`).
- `playground.html`: the interactive Dirt Lab. Serve the folder (`npx serve dirt`) and open it; opening it as a `file://` URL
  won't work because ES modules need a server.
- `out/`: sample 512px tiles of every preset, seed 1, transparent background.

## Using it on the website

**Static tiles (simplest, no JS).** Bake a tile, then lay it over anything:

```bash
node dirt/bake.mjs --preset gallery-dust --size 512 --seed 7
```

```css
.artwork { position: relative; }
.artwork::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: url(/img/dirt/gallery-dust.png) repeat;
  background-size: 256px;          /* half the pixel size = sharp on retina */
  mix-blend-mode: multiply;        /* or normal / screen / soft-light */
}
```

**Live in the browser.** Import the module and let it add a click-through overlay:

```js
import { dirtOverlay } from './dirt/dirt.js';
dirtOverlay(document.querySelector('.hero'), { preset: 'potting-soil', seed: 3, blend: 'multiply', opacity: 0.8 });
```

A 512px tile takes roughly 0.3–2 s to render on the main thread (`mold` is the slow one), so
bake tiles ahead of time for anything above the fold.

**Your own mix.** Tune it in Dirt Lab, press **Copy config**, save the JSON, then run
`node dirt/bake.mjs --config my-dirt.json --name my-dirt`.

## Options

`generateDirt({ width, height, seed, tile, base, amount, grain, layers })`

- `seed`: the same seed and settings always produce the same dirt.
- `tile` (default `true`): seamless wrap-around. The `edges` layer only draws when this is `false`.
- `amount`: a master "how dirty" multiplier on every layer's opacity. Animate it or tie it to
  scroll to let a page get dirtier over time.
- `base`: an optional opaque backdrop colour. Leave it out for a transparent overlay.
- per layer: `type`, `blend` (`normal`, `multiply`, `screen`, `overlay`, `hard-light`, `soft-light`,
  `darken`, `lighten`), `opacity`, `relief`, `bump`, `enabled`, `colors`, plus the layer's own
  numbers (`scale`, `size`, `density`, `count`, `coverage`…). Sizes are in pixels. Counts are
  per 512×512 area, so larger tiles get proportionally more marks.

## Collection soil

`collection_soil.py` makes dirt out of the saved paintings themselves. It reads `artworks.db` (from the
Artsy import branch), keeps paintings only, and weaves a chocolate-brown tile in the same dot hand as the
globe on the artist website: square dots of 1–3px on a 3px grid, in two crossing families of warped strands,
with dark blocks dropped out and cracks at the clod edges.

- Every clod is one painting, wearing one of its three dominant colours from the chocolate range
  (hue 16–36°, lightness 0.12–0.5). No painting is used twice.
- The pale glints in a clod are the same painting's lightest warm colour.
- The blacks, meaning the dark between the dots, are one near-black swatch from one more painting. They
  are also written out as their own layer (`collection-soil-blacks.png`, with `collection-soil-dots.png`
  as the dots alone), so something else can take their place later, such as words.
- `out/collection-soil.json` records the painting behind every clod, plus a per-cell label map.

```bash
python3 dirt/collection_soil.py --db path/to/artworks.db --seed 7       # colour version + cutout version
python3 dirt/build_soil_viewer.py                                       # hover-to-identify viewer
```

The **cutout version** uses the same clods, but each one is a pixelated window into its painting,
centred where that painting is most like the colour it gave. It fetches the paintings' images and
reproduces fragments of other artists' work, so it and the viewer are written to `dirt/private/`,
which is gitignored. This repository is public, and the site's rule is that Artsy works appear only
as their three-colour token.

## DIRT: an endless plane

DIRT is an endless plane of collection soil to move through by swiping, with a trackpad, or with the arrow keys.
A swipe glides on for a moment after you let go. New ground is grown as it comes into view, and returning to a
place finds the same ground. Every number chosen for it comes from the golden ratio φ: a Fibonacci number or a
power of φ.

**How the plane is built.** `soil_tiles.py` makes the plane's ingredients, and the page assembles tiles from
them wherever the viewer goes, in background workers (two, where the device has the cores) so moving stays
smooth.

- **Joins decided by position.** Every vertical join on the plane takes one of five colours, and so does every
  horizontal join. The colour comes from the join's own position, so the two tiles that share a join always
  agree, and any tile can be built anywhere. Each colour is a whole object from a painting that straddles the join.
  The vertical joins carry faces split down the middle: Dürer, the Mona Lisa, Velázquez's Juan de Pareja, Corot's
  young woman, and Delacroix. The horizontal joins carry Courbet's boats, Van Gogh's bridge at Arles, Monet's
  Doge's Palace, Poussin's angel, and Monet's Japanese footbridge.
- **Tiles vary by position.** Each tile takes one of 34 middle soils, sometimes mirrored, and each shape
  surfacing in one appears in no other. Each grid point takes one of 3 corner soils, which the four tiles meeting
  there share.
- **Joins vary by position.** At each join, a share of the object's shards sinks back into the dirt, darkened to
  φ⁻² of its light. The share runs from φ⁻³ near calm ground to φ⁻¹ far out, and the join's own seed decides
  which shards sink.
- **Checked.** A test that assembled 300 random tile pairs up to a thousand tiles out found every one of 153,600
  edge cells taking the same soil on both sides.

**Calm islands and strange outskirts.** Calm ground lies in islands, one in each 1,597-cell square of the plane,
each reaching about 610 cells (varied by φ^±½). The farther a place is from its nearest island, the more digital
processes take hold of it:

| From | What sets in |
| --- | --- |
| the start | more of each object's shards sink at its join, from φ⁻³ up to φ⁻¹ |
| φ⁻³ | colours turn, by up to the golden angle (137.5°) |
| φ⁻² | dots fuse into pixel blocks of 2, 3, 5, then 8 cells, as far as the forest over them allows (below) |
| φ⁻² + φ⁻⁴ | rows tear sideways in bands 5 rows tall and 233 cells long |
| φ⁻¹ | columns pixel-sort by lightness into drips, within 21-cell segments fixed on the plane |
| φ^-½ | the ground folds into a five-fold kaleidoscope about its island |
| φ⁻² onward | **data pigment**: some of the dots on the canopy come loose and fly as flocks, leaving dark pores behind |

Everything is a function of position on the plane, so no seams show between tiles or between grown pieces of
ground.

**Passages.** So that any window onto the plane is a composition, with big shapes of light and dark, a palette,
and changes of texture, the ground also falls into passages, the way an abstract painting falls into passages.
They sit on a jittered lattice 233 cells apart. Each passage takes the palette of the painting at its middle: that
painting's three colours, turned as the ground there is turned and made φ times as saturated. The palette is
laid over the ground as a gradient map, so it gives the hue while the ground keeps its own lights and darks.
Calm ground takes φ⁻³ of the palette; the outskirts take φ⁻¹ of it. Each passage also has one character:

| Character | Share | What it does |
| --- | --- | --- |
| mosaic | φ⁻² | Dots fuse into blocks as far as their depth allows, whatever stands over them, lit φ^½ as brightly. |
| nocturne | φ⁻³ | All but the brightest dots sink nearly to black, and those shine out like stars. The canopy here takes flight φ times as readily. |
| spray | φ⁻⁴ | Each cell takes its soil from a spot up to 8 cells away, in dots of mixed sizes with gaps between: an airbrushed speckle, lit φ^½ as brightly. |
| weave | φ⁻⁴ | Dots never fuse: a fine textile. |
| drip | φ⁻⁵ | Columns pixel-sort into drips from depth φ⁻³ out, not φ⁻¹. |

The passages' edges wander up to 55 cells, smooth over 144. Where two passages meet, each cell belongs to one or
the other by chance, the likelier the nearer it lies, across a band 55 cells deep: an overspray, as where two
sprayed colours meet. Clearings are sunlit, up to φ times as brightly at the heart of a calm island.

**After Cy Twombly.** DIRT's ground is drawn after the artists saved in the art database, starting with Cy Twombly.
[artists/measure.py](artists/measure.py) looks at each of his saved works (80 of the 95 are drawings, paintings and
prints; the photographs are left out) and writes [artists/twombly.json](artists/twombly.json): each work's paper, up
to five ink colours with their shares of the sheet, the share of the sheet it marks, and which grammar it belongs to.
Only these numbers are kept; the images stay in a private cache. His marks cover a median 23% of the sheet (quartiles
11% and 33%), so DIRT, which once covered its ground edge to edge in dots, is now mostly paper.

Where the ground is painted on the GPU, the plane is one endless sheet. Its paper drifts slowly among his papers
(bone, cream, a grey-white, a faint rose). Each passage is marked in one of his grammars, in the inks of one of his
works of that grammar:

| Character | Grammar | After |
| --- | --- | --- |
| weave | writing: in rows, a pen that loops as it goes, leaning right, pointed at the turns, two lines to a row in two inks, lifting between phrases | Roman Notes, Sarajevo, Three Notes from Salalah |
| nocturne | a blackboard: slate brushed over the paper, and chalk writing, dense and fast | On the Bowery, the 1967 and 1970 blackboards |
| spray | blooms in two rows through the passage: heads massed from thick dabs streaked like brush hair, over a dark heart, stems flung out, drips, splatter | Summer Madness, Pan, the Roses, Sets |
| drip | a wash that runs down in streaks, with blooms dripping into it | Lepanto, Camino Real, Nine Discourses on Commodus |
| mosaic | collage: the collection's soil printed pale as plates pasted on the sheet, a red box drawn beside some, pencil hatching under them and notes scrawled about | Natural History (the Mushrooms and Some Trees of Italy) |

The collection is still the matter of it: a stroke catches only where the soil has a dot, as crayon catches on the
tooth of paper (its heart is solid), the soil's colour works a little into every stroke, and the soil is rubbed
faintly into the paper, more out in the outskirts. Calm ground is nearly clean paper. The page round the sheet is a
graphite wall, and picking a painting out fades the rest into the paper.

A sheet changes as he changed one, about every 55 seconds (times φ^±½): white gesso is brushed over the old marks in
long translucent strokes, then the new marks are drawn in, sweeping across as a hand writes, in the inks of another of
his works of the same grammar. Add `#noart` to the address for the golden-angle colours below, and `#g0` to `#g4` to
see one grammar everywhere.

**Relations: the seams.** What DIRT makes that nothing else can is meaningful connection: every cell knows the saved
painting it came from, so where two passages meet, the meeting can say what the two paintings are to each other. They
are kin when by one artist, near in years (closer than 34 years or so), or sharing a colour; strangers otherwise.

- Kin sheets run into each other across a band up to 34 cells wide, the kinder the wider, dithered in clumps, and
  each one's marks carry on over the edge in the other sheet's hand.
- Strangers meet at a torn edge, the upper sheet casting a thin shadow on the lower.
- A strong colour the two paintings share (within 21 of each other, and not grey) is stitched along the seam.
- Where paper meets a digital territory, the marks are the passage between worlds: near the seam a crayon stroke
  becomes a window onto the territory, and on the other side the stroke carries on in the territory's own light.

The cells carry both passages at every edge, and the GPU paints both there, in one loop, so the shader holds one copy.

**After the digital animations.** A survey of the most remarkable digital animation (Ikeda, Universal Everything,
Anadol, GMUNK, Fischinger, OReilly, Radiohead's PolyFauna, Quayola, the Austin Museum of Digital Art's archive) runs
from painting given time, to images made by systems, to data. DIRT's geography already runs that way, from calm
paper out to strange outskirts, so the survey lives there. Out from depth φ⁻³, a share of passages (up to φ⁻¹ of them
at the farthest) leave the paper for a digital territory, drawn on the GPU in their painting's colours turned by the
golden angle:

| Depth of the passage's middle | Territory | After |
| --- | --- | --- |
| to φ⁻¹ | painting in time: on each beat of 1.618 seconds a ring, spiral, bar or disc is painted in stroke by stroke, 21 of them gather, then the ground is painted over them | Oskar Fischinger, *Motion Painting No. 1* |
| to 1 − φ⁻³ | the collection's paintings faceted: the soil cut into facets 34 cells across, each the colour of the painting at its middle and lit as a carved face; facets split into 13-cell ones and join again, each on its own time | Quayola, *Iconographies* |
| from φ⁻¹ | living tissue: cells 21 cells apart drifting, each with a membrane, a pulsing nucleus and granules of soil, a φ⁻² share of them dividing | Universal Everything, *Primordial* |
| from φ⁻¹ | the soil lifted into relief: rows of lines 5 cells apart, each lifted by the soil's lightness (smoothed over 8 cells) and rippling, nearer rows hiding those behind, light on black | GMUNK, *Synapse Code* |
| from 1 − φ⁻³ | data: black, with barcodes, grids of dots and columns of numerals drawn from the collection's own numbers, changing on beats of 1/φ of a second, a scanline, and now and then the whole field thrown white | Ryoji Ikeda, *datamatics* |

Two more territories stand nearest the islands, beside Fischinger and Quayola, after artists saved in the database:
**light and space**, after James Turrell (a field of coloured light floating in another, no source, its edge
dissolving into the one round it in a halo, the colours passing slowly, each into the next, as a Skyspace's sky does),
and **analytic cubism**, after Georges Braque (the ground seen from several viewpoints at once, as three layers of
overlapping translucent planes, each showing the soil from a view of its own, in ochre, olive, grey and umber, sliding
slowly into one another, each with a shadowed or lit edge).

**A wheel of worlds.** Drawn after the artists, every passage has a world of its own, and neighbours are far apart:
twenty worlds sit on a wheel ordered so that each is followed by its opposite (light, writing, data, cubism, life),
and a passage takes its place on the wheel from its lattice square, a step east moving 4 round it and a step south 7,
so every edge crosses into a distant world and one screen holds many. Each change in time moves a passage 9 further
round. Beside the worlds above, each artist's other work has its own:

| World | After |
| --- | --- |
| Bacchus: raw cream canvas, huge looping strokes of alizarin, dripping | Twombly, *Bacchus* (2005) |
| Ganzfeld: the whole field one colour of light, no edge, shifting slowly | Turrell, the Ganzfelds |
| Skyspace: a knife-edged opening onto the sky, in a ceiling lit by a hidden, changing light | Turrell, the Skyspaces |
| papier collé: faux-bois paper, black paper, newsprint, and a guitar's sound hole and strings in charcoal | Braque, the papiers collés (1912) |
| Birds: great simplified black birds, outlined in white, gliding over a flat field | Braque, *L'Oiseau et son nid* and the late Birds |
| a tunnel of squares pulsing inward to a disc | Fischinger, *Radio Dynamics* (1942) |
| brushstrokes laid by an algorithm along a flow, each in the colour of the soil under it | Quayola, *Pleasant Places* |
| test pattern: full-field bars of a binary code, scrolling, now and then negative | Ikeda, *test pattern* |

The wheel also holds the five artists with the most works saved after those already in DIRT, each in their own
language and colours, guided by high-quality generated studies:

| World | After |
| --- | --- |
| flat planes of synthetic cubism, and heads seen from the front and in profile at once, split cobalt and rose, in bold black line | Pablo Picasso (184 works saved) |
| broad strokes laid wet into wet, sliding on the diagonal, pink, yellow, cerulean and white, streaked and knife-scraped | Willem de Kooning (92) |
| the land built of small parallel strokes leaning one way, ochre, viridian and violet-blue, blue on the heights, canvas between | Paul Cézanne (75) |
| thick strokes along a turbulent flow swirling round glowing orbs, cobalt and ultramarine against chrome yellow | Vincent van Gogh (65) |
| the pond at Giverny from above: lavender and turquoise water in soft dabs, willow reflections, lily pads and flowers | Claude Monet (62) |

**Singularities.** The plane is not an even quilt: one in each 987-cell square (φ⁻¹ of them kept), reaching 233 to
377 cells, is a singularity, where the image itself collapses and is born again. Across its axis it has two halves.
On one, whatever world lies there breaks into blocks of 2, 3, 5, 8, 13, 21, 34, 55 and 89 cells, each the colour of its
middle, converging on the core, until at the core there is a single pixel: one colour, pulsing, with a corona and two
turning beams, like a neutron star. On the other half a world found nowhere else on the plane builds up out of that
pixel, coarse at the core and finer outward, in colours born of the core's own colour made pure and turned by the
golden angle: a galaxy of seeds set by the golden angle, stained glass subdividing deeper outward, two sources of
rings interfering, or a crystal of hexagons whose faces turn with the light.

**As much as the device can draw.** DRIFT shows as much as the device it runs on can draw smoothly, at four levels:
3, everything (the meta forms' light, the singularities, the seams between worlds, every edge a grey gradient); 2, all
but the grey-gradient edges; 1, all but the meta forms' light too; 0, the worlds, the ladder of complexity, the life
and the weather. It starts from a guess (cores, memory, phone or not), then watches the frame rate: slower than about 42
frames a second it draws less, comfortably faster than 75 for eight seconds it tries more, and it does not retry a level
it had to leave for a minute, so it never flickers between two. `#tier0` to `#tier3` holds a level.

**The drift.** Put a thing into the plane: name it in the bar, or give it a photo (picked, pasted, or dropped on the
plane). Claude reads it for its qualities (colour, surface, shape, motion, sound, scale, material, place, time, use,
meaning) and finds seven real, specific things, each joined to the one before by one quality they share, never of the
same kind, farther out with every step. The plane carries you to each in a long glide (987 to 1,597 cells on, turning
a little each time, so each station lands somewhere new on the ladder), names where you have come to and what carried
you there, and gives a site to visit and search links; ‹ › (or [ ]) move between stations and Drift from here goes on.
It asks Claude through the page's `sample` capability, on the viewer's own Claude account (`engine/drift.js`).

**The ladder of complexity.** The plane is DIRT at the full reach of its language, and that reach runs from nothing to
everything. Over the plane lies a field of complexity, 0 to 1, rising and falling across two or three screens, so a few
swipes cross the whole ladder:

| rung | complexity | what is there |
|---|---|---|
| void | 0 | a field of Reinhardt's black or Ryman's white, bigger than a screen (233 to 610 cells across its heart, one in each 1,597-cell square, φ⁻¹ of them kept), no life at all, and at its middle one pixel |
| point and line | to 0.16 | Reinhardt's cross of blacks, Ryman's white on white, Sugimoto's horizon, McCall's line of light drawing a circle, Giacometti's one figure, Newman's zip |
| plane | to 0.28 | Rothko's stacked fields, Kelly's one shape, Irwin's disc, Larry Bell's cube, Kline's strokes, Kandinsky's point, line and triangle |
| structure | to 0.40 | Albers's squares, Agnes Martin's grid, LeWitt's four directions, Mondrian, Miró's constellation, Morandi's bottles |
| repetition | to 0.50 | Gerstner's rings, Riley's waves, Kusama's dots, Judd's stack |
| simplified | to 0.75 | the worlds, drawn from the middles of blocks (13 cells down to 2) and in few tones (2 up to 16) |
| full | 1 | the worlds as they were, with the meta forms' light, the singularities and all their life |

Each minimal area is one painting after one of the saved artists, in the colours of that artist's own saved works
(the dark, middle and light thirds of their works' colours, and the most vivid, measured from the collection), and at
each change it becomes another of the same rung, wiped across. Life over the ground thins with the ladder: none on the
minimal rungs, all once the worlds are full.

The one pixel is one device pixel. Most of the time it only breathes, its colour turning through the artists'. Every
89 seconds or so it does something astronomical, each void in its own order: a line of light draws a circle out of it,
as McCall's; planets go round it on Kepler's orbits, the far ones slower; a supernova throws out a shell and its
debris and leaves a nebula; a constellation appears star by star, joined, as Miró's; a pulsar's two beams turn; an
accretion ring turns round a black point with light bent round it; or a big bang: the whole plane at its most complex
opens out of the pixel across the void, and closes back into it.

**New artists, every week.** Beyond the 22 drawn by hand, artists join the ladder from the roster
(`dirt/artists/roster.json`), with no new code: `dirt/artists/roster.py` reads an artist's saved works, measures what
they share (how densely they mark, whether their marks share a direction, how much ground they leave bare, how
saturated they are), and gives them one of ten compositions (a field and a band, stripes, dots, a grid, strokes, rings,
stacked fields, scattered marks, poured stains, cut shapes) with its parameters, the rung their marks earn, and the
colours of their own saved works. A coworker (a scheduled Claude session, `dirt/artists/COWORKER.md`) brings in the
next three most-saved artists every week and republishes DIRT. The first eight: Dalí (a horizon), Matisse (cut shapes),
Frankenthaler (stacked fields), Cartier-Bresson and Warhol (grids), Pollock (scattered marks), Elaine de Kooning
(strokes), Caponigro (dots).

**Anomalies.** Now and then, unannounced (the first a minute or two in, then one to two and a half minutes after the last ends),
the whole plane in view collapses to its middle as a star does: it spirals in, reddens and dims as its light is
stretched, and an event horizon opens from the middle, ringed by a grey gradient, and swallows everything until not even
light gets out. In the dark is deep space: stars at three depths drifting past, the nearer faster, and faint
nebulae in a colour pair. Then the infinite plane comes back as one thing, seen whole in the
dark, and the flip: it comes nearer until it is all there is, and the object is the world again:

| | the plane becomes | and is fallen back into through |
|---|---|---|
| the eye | an eye whose iris is the plane (its white, the plane farther off and paled; its pupil, what is left of the horizon) | the iris |
| the toys | (a third of the time; 55 seconds) a lamp comes on over floorboards and toys come to life while nobody is looking: a spinning top wobbles in, a wind-up robot walks across with its key turning and its eyes lit, blocks drop and stack, a ball rolls in; the lamp flickers, someone is coming, and everything freezes where it stands, the top toppling. Every toy is made of the plane, showing through it, lit by the lamp | the ball, which rolls to the middle and grows until it is all there is |
| the planet | a planet wrapped in the plane, turning, lit from one side | its surface, flattening into the plane |
| the painting | (no collapse) the plane shrinks to a painting in a frame on a gallery wall, casting its shadow | the painting |
| the voyage | (a third of the time; 89 seconds) a quick collapse, then a long night in deep space: a wind-up tin rocket (red nose, red fins, brass porthole, its key on its back) passes far off, left to right, trailing sparks; later a space ranger flies by near and large, right to left (an original toy: orange suit, cream chest plate with a teal emblem, teal boots and gloves, a teal jetpack with two swept fins and a flame, a bubble helmet), one arm reaching ahead; through the rocket's porthole and the ranger's helmet glass, the plane | one star, out of which the plane opens again, ringed by a grey gradient |

`#anomaly=N` starts kind N (0 the eye, 1 the toys, 2 the painting, 3 the planet, 4 the voyage) five seconds in. The
**Elsewhere** button (or the E key) starts the next one at once, the toys and the voyage in turn, now and then another.
Deep space and the voyage are drawn by a sixth small shader over the rest.

**Keeping what is seen.** **Still** keeps the view as it is (a PNG); **Record** keeps it moving (a video, MP4 or
WebM as the browser can, up to 89 seconds, until Stop). Both are the ground and the life drawn together at up to 1920
pixels across, named for where on the plane they were made, and offered through the viewer's own save prompt (the
artifact's `downloads` capability), so the buttons show only where saving can be done. The life over the
ground goes with the light while one lasts.

**Formality: the paintings themselves.** The plane can show what it is made of at every degree of formality, as the
ladder shows every degree of complexity. At the free end is the soil: the saved paintings' colours and marks in the
artists' grammars. Past it, the paintings themselves, quilted (`artists/quilt.py`, after Efros and Freeman's image
quilting, 2001). A quilt is one artist's saved works laid together patch by patch, each patch taken from another
painting than its neighbours because the strip where they overlap agrees best, and joined along the path through
that strip where they differ least; so a quilt shows no patchwork, only the places where a sky in one painting goes on
as a sky in another, a contour in one as a contour in another. Every quilt is a torus (its right edge carries on into
its left, its bottom into its top), so it repeats with no seam and no mirror. A kin quilt does the same across two
artists, one painter becoming the other and back. They come in three degrees:

| degree | what it is |
|---|---|
| the join | a passage filled with its artist's quilt (or its kin quilt), at 1.6 or 2.6 texels a cell; where two quilts meet they run into each other over 21 cells, and where a quilt meets the soil its edge is torn |
| the kin flow | the same with a two-artist quilt |
| the hang | the most formal: a gallery wall (its edge torn into the plane), lit from above, and on it a quilt in a frame 110 to 178 cells wide whose moulding runs dark to light as every edge here does, casting its shadow; life keeps off the wall |

Where each lies is a field over the plane, 1597 cells across, so formal country and wild country each run for a
while; a hang is one in each 987-cell square where the field is high, and all of them only where the plane is full
(the lower rungs, the voids and the singularities keep their own). The pixel pass lays no grey gradient over a
painting shown as itself. It is drawn by a third, small shader over the first pass's cells, blending, so the first
need not grow, from quilts published beside the page (`quilts/`, 37 of them, 440 pixels square, 2.3 MB); until they
arrive, and on devices at the lowest tier, the plane is as it was. The quilts are made from the private image cache
and are never committed:

    python3 dirt/artists/quilt.py --db artworks.db --cache dirt/private/briefs --out dirt/private/quilts

`#formal` puts the formal end everywhere, for looking at it.

**Depth without distance.** DRIFT has no zoom and wants none: nothing on it is understood by coming nearer or going
farther (the Artist Website's globe is where distance means something). So every scale is on the screen at once.
Here and there a window opens, one in each 233-cell square where the plane is deep enough, 34 to 144 cells across,
torn at its edge and turned by a multiple of the golden angle. It holds the whole view as it was a frame ago, shrunk,
and that view held its own windows, holding the view before, so after a few frames each window holds the plane at
every scale down to a pixel. Several windows of different sizes, each holding all of them, are an iterated function
system (Hutchinson 1981; Barnsley, *Fractals Everywhere*, 1988): what they converge on has structure at every scale,
and no scale comes first. How deep the plane goes is a field 987 cells across drifting through it at 8 cells a second,
from flat to as deep as the device draws (full at tier 3, φ⁻¹ at tier 2, none below); anomalies and the Earth keep out
of it. It is a fourth small shader, fed the last frame's cells, mipmapped.

**Light and space.** After James Turrell (the Ganzfelds, the Skyspaces, *Aten Reign* at the Guggenheim, 2013), most
of the plane is given over to coloured light with no edge and no object. The light comes in pairs of colour, as his
rooms do: vermilion and lilac, magenta and blue, amber and rose, red and blue (*Breathing Light*, LACMA, 2013), cyan
and violet, coral and plum. Across each view runs one horizon, 987 cells to a band: a warm field, a pale band where it
turns, a dark core, and the warm field again, curving slowly and breathing, the pairs changing over the plane with no
boundary. Through the light the paintings are seen blurred, as through a haze (the last frame at a coarse level of its
detail), and here and there it opens in soft apertures, their edges dithered, where they show clear; a painting shown
as itself (the quilts, the hangs) has the light stand back from it. Over the first field lies a second, finer one in
another pair at another angle (610 cells to a band), and soft orbs of colour, 21 to 55 cells across, drift through
both, so several pairs are in view at once, even on a phone's narrow screen. A fifth small shader, drawn at every
tier: when a device can draw little, everything else goes first and the light stays.

**Countries, not replacements.** Everything DRIFT has made stays in it; what comes later is added, not swapped in. A
field 2584 cells across, warped off the lattice, drifts over the plane at a few cells a second and sorts it into
countries, each handing over to the next across a soft border, so whatever is in view becomes, in time, the next: where
the field is low, the plane as it is, with no light over it (its soil and grammars, the ladder and its voids, the
paintings quilted and hung, the tree lines); then Turrell's light and its drifting orbs; then the silk and glass. Weil's
shards keep to the light's countries; the raindrops, the depth windows, the tree lines and the anomalies go everywhere.

**The phones' backgrounds: silk and glass.** Behind the light lies what Apple's standard iPhone backgrounds are made
of, not their shapes: from the colour-in-water images of the iPhone X years to the Liquid Glass of the iPhone 17 Pro,
what they share is material and optics, folds of colour with no edge, depth, a sheen along a crest, glass that bends
what is behind it. So the light is silk: a field of colour warped by a field warped by another (domain warping, after
Inigo Quilez), 610 cells to a fold, in phone colours (cosmic orange and deep blue, silver and lilac, pink and
ultramarine, green and teal, gold and deep purple, ember and sky, changing over 2584 cells), its folds in shadow and
their crests catching an iridescent sheen, as a film of oil does. And it is glass: the paintings under it are seen
through it, bent by its folds up to 27 cells, their red, green and blue each bent a little differently, as a prism
parts them, softer where the glass is thick. It lies deeper than the plane, moving 0.18 less when dragged, and is
finished as a photograph is: a filmic curve (Narkowicz's fit to ACES, 2015) so its highlights roll off instead of
clipping, and a fine grain. Turrell's bands come and go over it.

**The history of Greece and Rome, in a raindrop and behind the leaves.** Sixteen saved works, in the order of the
time they show rather than when they were made (`artists/antiquity.py`): a Cypriot Bichrome jar (1200 to 800 BCE);
Troy (Hayter's *Head of Zeus*, from *The Death of Hektor*); Ingres's *Ulysses*; the Minotaur (Picasso, *La Suite
Vollard*); an Attic red-figured column krater attributed to the Boreas Painter (460 to 430 BCE); an Apulian amphora
(400 to 300 BCE); Poussin's *Votary of Bacchus*; Abbott's *Roman Temple at Baia*; Turner's *Ancient Rome; Agrippina
Landing with the Ashes of Germanicus*; Twombly's *Nine Discourses on Commodus*; Poelenburgh's *Arch of Septimius
Severus*; Cartier-Bresson's *Roman Amphitheater*; Guardi's and Sonntag's ruins; and Twombly's *Roman Notes I* and
*Interior (Rome)*. They are kept small. On the light's glass lie raindrops, 5 to 34 cells across, a few sliding down,
each never quite round and heavier below; in each is the history, upside down and drawn in to its edge as a drop holds
the world behind it, what is behind the drop showing through too, its rim a grey gradient from its shadowed side to
its lit side, a highlight on its crown that glimmers; each drop is at its own place in the history and moves on through
it, one age dissolving into the next every 13 seconds. On the tips of the tree lines' outermost leaves hang smaller
drops, 2.5 to 5.5 cells, with the same history in them. And through the gaps in the leaves, far off behind them, the
history is seen large (377 cells to a picture), drifting as in a wind, each tree line with its own age, moving on
every 21 seconds. The images come from the collection's own links into `dirt/private/antiquity/` (never committed)
and are published beside the page in `antiquity/`.

**Weil's fragments.** After Susan Weil, who breaks a figure or a tree into pieces and sets them a little out of step,
so the whole appears between them (a cyclist in *Bicircle*, 2007; a tree in *Baroque Tree*, 2006), and who cracks
glass and mirror on purpose and fills the cracks with white grout (*Quarter Past Four*). In stretches of the plane
(where a field 1597 cells across, turned off the lattice and warped, is high, so their edges wander) the light is broken
into shards about 144 cells across: cells round scattered seeds, their edges warped, with fissures between them that
wander in course and width, each a grey gradient across it, dark on one shard's side to light on the other's, never
a line. Every shard shows the same large
composition out of step by up to 17 cells and a few seconds, and across them lies one great circle, 144 to 254 cells
across, through which the light is seen magnified, as through a lens, its rim a grey gradient from dark outside to
light within, so the circle breaks at every crack and is still one circle. A few shards are paintings instead (a quilt,
tinted by the light it stands in for), and a few are clear: the plane itself. There is no grid: straight lines and
right angles are kept for when the plane turns to architecture.

**The seams as tree lines.** Where two regions meet, the edge is a wood's top against the sky, seen from below: the
darker painting is the canopy and the lighter the sky, and the line between them breaks into crowns (lobes 55 and 13
cells across), then clumps, then single leaves or needles, the sky showing through gaps just inside the canopy's edge,
the canopy darkening toward its edge as a canopy does against the light, and the outermost leaves lit yellow from
behind. The trees change along every seam, a stretch of each (a field 144 cells across): white pine (tufts of eleven
needles), broadleaf (poplar, maple), magnolia (large pointed leaves), oak (lobed), spruce (spires, finely serrated),
willow (hanging strands), palm (fronds with leaflets), aspen and birch (small leaves that quiver), cypress (flames),
and a tree in winter (bare twigs). All of them sway a little in the wind. The leaves carry the canopy's own texture and
the gaps the sky's, taken from the last frame well inside each region. A seventh small shader, over the rest; not on
the lowest rungs or in the voids, and only from tier 2.

**Meta forms: the artists as shades.** The areas are not portraits of their artists. Each artist is one value,
a shade on a scale from dark to light, as a painter's palette runs from its darkest colour to its lightest: Ikeda's
black, Fischinger's night, the Primordial, Turrell's dark rooms, Van Gogh, Monet, GMUNK, Quayola, Braque, Cézanne,
Picasso, de Kooning, and Twombly's paper, the lightest (thirteen shades, evenly spaced). Over the plane lie forms far
larger than any area, one to each 610-cell square and overlapping into their neighbours, 144 to 377 cells across:

| meta form | drawn as |
|---|---|
| an orb | a sphere lit from the turning light, casting a shadow |
| a vessel | tall and rounded, as Morandi's bottles, lit from one side, casting a shadow |
| a vortex | a swept spiral with no edge, as Turner's, lying under the others |
| a head of planes | five lines through off-centre points, as in the Picasso study, each facet its own value |
| a lit field | a rectangle glowing toward its rim, as a Turrell room |

Each area takes the artist whose shade the forms have where it lies, so the forms are drawn in artists as a
painting is drawn in values: an orb's lit side is Twombly and de Kooning, its turning edge Cézanne and Braque, its
shadow Turrell and Ikeda. Inside every area its colours are set to its artist's shade with the form's light
running on through them, across the seams, so one light falls across many worlds. Nothing steps: each form gives way
to the ground and to the forms under it over 21 cells, a head's planes turn into each other over 26, and across a
seam the two artists' shades blend, meeting halfway at the seam itself. The light goes round once in 377
seconds; as it turns, the shading slides across the areas, and at each change an area passes to the artist whose
shade now falls there. `#g99` shows the meta forms alone, each area in its shade.

**Every edge a grey gradient.** No edge is a hard line. Across every edge of every shape, in every world, lies a grey
gradient running the whole scale from dark to light: the same scale the artists make over the whole plane, held in
a few pixels. The very small and the very large are one law here, where physics still has two. The last pass finds
it from the cells around each pixel (five by five, weighted by nearness to the pixel, so the gradient runs smoothly at
the pixel's own size): where they span a wide range of light, the pixel takes the grey of where it stands between
their darkest and lightest, strongest halfway across the edge and fading into the colours on either side. The meta
forms' own edges are the same gradient, 13 cells wide, and a head's planes 8.

**The gesture.** Across the plane run long lines, one in every 610-cell band, that belong to no passage: each is one
unbroken gesture taking the form of whatever world it passes through. It is crayon on paper, chalk on slate, a painted
stem hung with drips among the blooms, and in the territories a string of rings, a cut, a chain of cells, a glowing
relief line, a barcode, a band of light, the edge of a plane. Following it, the eye crosses from world to world without
a break.

A φ⁻⁴ share of them are **the archive**, after the Austin Museum of Digital Art's collection of hundreds of works:
a passage that turns through all five territories, one every 6.9 seconds. Over the plane an **artificial day and night**
turns every 233 seconds, the ground dimming and cooling to φ⁻² at night, after Universal Everything's *Migrations*.

Four kinds of **wanderers** cross the plane over everything, a pixel a cell, in the artist's inks, each naming a
painting when pointed at ([engine/wanderers.js](engine/wanderers.js)):

| Wanderers | After |
| --- | --- |
| the procession: 8 to 21 walkers, one every second or so, each generated anew (height 21 to 34 cells, head, legs, arms, gait, a hat now and then), whose material changes as they walk through bands 144 cells wide: paint, chalk, soil, bubbles that rise, smoke that drifts, flowers that drop petals, flickering data, drips | Universal Everything, *Infinity* and *Transfiguration* |
| herds of 3 to 8 invented creatures, bodies of 2 to 4 blobs, moving with real animals' gaits: a kangaroo's hop, an elephant's stomp, an ostrich's run with a bobbing neck, a caterpillar's crawl, a bird's swoop | Universal Everything, *Migrations* |
| the walking city: a tower of 3 to 6 pasted plates with window grids and a red flag, on six stepping legs | Universal Everything, *Walking City* |
| primitives: up to five crude flat-shaded polyhedral organisms with dot eyes and stick legs, twitching, turning abruptly, a vertex jumping now and then | Radiohead and Universal Everything, *PolyFauna*; David OReilly, *The External World* |

The survey's other points were already DIRT's: a world one moves through (PolyFauna), a system that makes images
rather than a sequence of them (the survey's closing thought), and Anadol's data pigment (the flocks). Anadol's
central move, a latent walk that morphs one painting into the next, is left out: DIRT keeps every colour traceable to
its painting, and the latent walk was ruled out for DIRT. `#g5` to `#g9` show one territory everywhere.

**Colours that change** (with `#noart`). Nearly every saved painting is brown, gold or rust, so a plane that wore their colours only
as they are would stay chocolate brown. Where the browser has WebGL2, the page paints the ground itself on the GPU
([engine/ground-gl.js](engine/ground-gl.js)), every frame, from what each cell is made of. The workers send each
cell's soil colour, dot, passage, crown, depth and light instead of finished pixels, so the colours can change as
they are watched. About every 55 seconds (times φ^±½), each passage moves on to another way of wearing its painting:

| Share | The passage's colours |
| --- | --- |
| φ⁻³ | as grown (never twice running) |
| the rest: φ⁻¹ of it | the painting's colours turned about the grey axis by the golden angle once, twice, three or four times, toward teal, violet, green, blue or rose, and laid on fully: the soil's lightness chooses where in the palette each dot falls, as on the Earth |
| the rest: φ⁻³ of it | two of those colours only, darkest to lightest |
| the rest: φ⁻⁴ of it | lights and darks swapped |

A φ⁻² share of the time the painting is not the passage's own but one of the 85 saved paintings with the most colour
(a colour of chroma 89 or more), turned the same way. A change always changes something. Left as grown, the GPU
paints what the workers would have: checked pixel for pixel, 86% match exactly and the rest lie within 2 levels
of 255.

A change sweeps across its passage from a point near its middle, 34 cells a second, and takes 8 seconds at each
place. Where it passes, shapes in the new colours build up over the old ground, each shape on its own time, in the
passage's character:

| Character | Shapes |
| --- | --- |
| mosaic | square tiles on a 13-cell grid, each growing out from its middle until it fills its square but a one-cell seam |
| nocturne | four-pointed stars with round cores, 8 to 21 cells from point to middle, from the palette's lights |
| spray | round spots 10 to 20 cells across, airbrushed at the edge, each laid over those before it |
| weave | strips three cells wide along every eighth row and down every eighth column, each 34-cell length growing out from its middle, crossing over and under by turns |
| drip | runs down one column in three, 34 to 55 cells long |

Shapes are born over the first φ⁻² of the change and are full grown by φ⁻¹ of it. Then they break down: pieces of 8
cells go first, then of 5, 3 and 2, then single cells (a spray's shapes go straight to dust), and the new ground
shows through. On the Earth, a place moves only among the five paintings nearest its look, a change about every
89 seconds, so it stays itself; and when a month turns, the new month sweeps over the ground in the same shapes, out
from the middle of the view at 233 cells a second. With reduced motion set, the colours stay as grown. Without
WebGL2, or with `#nogl` in the address, the page paints as before, from the workers' pixels.

**The rainforest.** A forest stands over the ground, seen from above. Its crowns grow at three heights, each on a
jittered lattice of its own, and each crown swells in five lobes and eight smaller ones:

| Stratum | Lattice | Crown reach | Height (0 floor, 1 tallest) | Where it grows |
| --- | --- | --- | --- | --- |
| shrubs and understory trees | 21 cells | about 13 | φ⁻³ to φ⁻² | everywhere but the heart of a calm island |
| the canopy | 55 cells | about 34 | φ⁻¹ ± φ⁻⁴ | thickening from depth φ⁻³ out |
| emergents, standing above it | 233 cells | about 55 | 1 − φ⁻⁴ to 1 | from depth φ⁻² out |

So the calm islands are clearings, and the forest closes over and rises toward the outskirts. The forest shapes the
ground in four ways:

- **Light.** Sunlight comes from the upper left, high enough that a crown's shadow is 1/φ of its height long.
  Crowns are lit on their upper left and shaded on their lower right. Taller crowns cast shadows. A place lower
  than the forest within 13 cells of it sees less sky and lies darker. The rim of each crown, where it stands over
  lower ground, is drawn dark, like the gaps between crowns.
- **Colour.** Each crown leans its dots toward a colour of its own: the most colourful of the three colours of the
  painting at its middle. Shrubs lean by φ⁻³, the canopy by φ⁻², and emergents by φ⁻¹, like the few trees in
  flower that stand out in a canopy seen from the air.
- **Pixel size.** Nearer the eye, coarser the pixel. Dots fuse into blocks only as far as the forest there stands
  tall: the floor keeps its fine dots, shrubs fuse into blocks of 3 cells at most, the canopy 5, emergents 8.
- **Niches.** Each kind of life settles in the strata it lives in, and a creature is seen only where nothing
  taller stands over it, so ants go under a shrub and come out the other side.

Every creature wears the colours of a painting from the ground where it lives, found within 34 cells, the most
colourful one there. Its colours are all three of that painting's colours, turned as the ground there is turned,
made φ² times as saturated so they stand out from the soil. The homes of life are decided by position too, so going
back finds the same nests, swarms and flowers.

| Niche | Life | What it does |
| --- | --- | --- |
| the floor | leaf-cutter ants | Columns run from each nest out to where the plants begin. The ants go out bare and come home each holding up a piece of a painting cut from where the trail ends. |
| the floor | poison frogs | They sit, hop, and call in rings, each holding its call back when a neighbour is about to call, so they take turns. |
| the floor | ferns | Fronds coil as spirals that tighten toward the tip and unroll from the base over about 16 seconds, opening leaflets as they go. They stand, wither, and grow again. |
| the floor and shrubs, from depth φ⁻² | slime mould | 987 cells pour out of the brightest dots in a gap, each following the scent the others leave (Physarum, after Jeff Jones's model), in thick, soft, luminous forms that keep joining up and reshaping. They are drawn solid where the scent is strong and as a speckle of overspray where it thins, like sprayed paint. |
| the floor and shrubs, from depth φ⁻³ | coral snakes | Ringed three of the painting's brightest colour, one pale, three near black, one pale. They wind as they go. |
| the understory, from depth φ⁻³ | fireflies | 144 to a swarm, each flashing by its own clock. A flash nudges those near it toward their own (pulse-coupled oscillators, after Mirollo and Strogatz), so flashes gather into waves and the swarm falls into flashing as one. |
| the understory | blue morphos | An erratic, bobbing flight, flashing the painting's bluest colour as the wings open and dark undersides as they close. |
| on crowns | flowers | Florets set by the golden angle, as a sunflower's are, in the painting's three colours from a dark heart to a bright rim. They open, stand, drop their florets from the rim in, rest, and open again. |
| on crowns | hummingbirds | They hover at open flowers in a small figure of eight and dart between them. |
| the canopy, from depth φ⁻³ | monkeys | Troops of 5, 8 or 13 follow a leader across the crowns, feeding on each, then leaping the gaps one after another, each seen apart from its shadow for the leap. |
| the canopy | wind | Gusts cross the treetops in bands 233 cells apart, turning leaves up pale where they pass, the way Cecropia leaves flash silver. |
| above the emergents | macaws | Now and then a pair crosses from one emergent to another, long tails streaming, their shadows racing over the crowns. |
| above the emergents | a harpy eagle | It circles an emergent near the viewer and is never seen, only its shadow crossing the forest. The flocks scatter from it. |

**The flocks.** Each loose dot is a bird: up to 10,946 of them live around the view at any time, launched from the
canopy as it comes near and grounded again as it falls far behind. Each bird follows three rules toward the
neighbours it can see within 8 cells, heeding at most 13 of them:

- **Alignment:** fly as the others fly.
- **Cohesion:** drift toward the middle of the flock.
- **Separation:** keep a wingspan apart.

Birds from the same painting are kin and pull φ times harder. Three hawks hunt wherever the viewer is. They are
never drawn: a bird within 21 cells of one bolts at up to φ times its top speed, and the flock turns with it. The
harpy eagle frightens them from 34 cells. A slow current runs underneath as a thermal: five travelling waves,
and an eddy in each 377-cell square, 89 cells across times φ^±½, turning one way or the other as it drifts, so
the flocks wheel. Over calm ground the birds
turn back outward, harder the deeper they stray. Trails fade by φ⁻⁶ a frame. With reduced motion set, nothing
takes flight or moves: only the plants show, full grown and still. New ground appears at once, and swipes do not
glide.

**Naming and picking out.** Every cell remembers which painting it came from, however it was moved, so pointing
anywhere names the saved painting underneath, or the painting a creature there wears. A click or tap that does not move picks a painting out, darkening
everything else. Clicking it again, pressing Escape, or pressing **Show all** brings the whole plane back.

```bash
python3 dirt/soil_tiles.py --db path/to/artworks.db          # → dirt/private/plane/ (needs opencv-python-headless<4.13)
python3 dirt/build_soil_viewer.py                            # → dirt/private/collection-soil.html, the DIRT page
```

`objects.json` records every object, its box in the painting, and the face detections rejected by eye. All
output is written to `dirt/private/`, because the cutouts reproduce other artists' images.

A similarity map of the paintings (laying clods out by how alike their paintings are, as Refik Anadol does with
his archives) is the plan for bigger globe terrains, not for DIRT.

## DIRT Earth: the plane becomes the Earth

DIRT's plane can become the Earth, with every place grown from its own shapes as the rainforest is. "Earth" opens
a globe woven of dots, each place in the saved paintings nearest its own colours for the month. Clicking a place goes
down into the plane, which is now the Earth there. The place grows the crowns and ground of its biome and the life
of its realm. It turns through its year. The month's clouds, rain or snow pass over it, and a haze lies as thick as
its view is short. Pointing tells everything the atlas knows about it, from realm and biome down to the month's rain
and how far one sees, and names the creature or plant underneath.

[earth/README.md](earth/README.md) has the whole of it: the quarter-degree atlas of the Earth's conditions, the
grammar of places ([earth/GRAMMAR.md](earth/GRAMMAR.md)), and the month-by-month textures for the Artist Website's
globe.

```bash
python3 dirt/build_soil_viewer.py --earth dirt/earth/out     # DIRT with the Earth in it; its files go beside the page
```

Without `--earth` the page is the plane alone, and with it the plane is unchanged until "Earth" is pressed: its chunks
hash exactly as before.

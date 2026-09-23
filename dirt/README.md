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

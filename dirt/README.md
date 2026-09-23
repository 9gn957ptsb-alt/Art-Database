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
them wherever the viewer goes, in a background worker so moving stays smooth.

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
| φ⁻² | dots fuse into pixel blocks of 2, 3, 5, then 8 cells |
| φ⁻² + φ⁻⁴ | rows tear sideways in bands 5 rows tall and 233 cells long |
| φ⁻¹ | columns pixel-sort by lightness into drips, within 21-cell segments fixed on the plane |
| φ^-½ | the ground folds into a five-fold kaleidoscope about its island |
| φ⁻² onward | **data pigment**: some of the dots come loose and fly as flocks, leaving dark pores behind |

Everything is a function of position on the plane, so no seams show between tiles or between grown pieces of
ground.

**The flocks.** Each loose dot is a bird: up to 17,711 of them live around the view at any time, launched from the
ground as it comes near and grounded again as it falls far behind. Each bird follows three rules toward the
neighbours it can see within 8 cells, heeding at most 13 of them:

- **Alignment:** fly as the others fly.
- **Cohesion:** drift toward the middle of the flock.
- **Separation:** keep a wingspan apart.

Birds from the same painting are kin and pull φ times harder. Three hawks hunt wherever the viewer is. They are
never drawn: a bird within 21 cells of one bolts at up to φ times its top speed, and the flock turns with it. A
slow current runs underneath as a thermal. Over calm ground the birds turn back outward, harder the deeper they
stray. Trails fade by φ⁻⁶ a frame. With reduced motion set, nothing takes flight, new ground appears at once, and
swipes do not glide.

**Naming and picking out.** Every cell remembers which painting it came from, however it was moved, so pointing
anywhere names the saved painting underneath. A click or tap that does not move picks a painting out, darkening
everything else. Clicking it again, pressing Escape, or pressing **Show all** brings the whole plane back.

```bash
python3 dirt/soil_tiles.py --db path/to/artworks.db          # → dirt/private/plane/ (needs opencv-python-headless<4.13)
python3 dirt/build_soil_viewer.py                            # → dirt/private/collection-soil.html, the DIRT page
```

`objects.json` records every object, its box in the painting, and the face detections rejected by eye. All
output is written to `dirt/private/`, because the cutouts reproduce other artists' images.

A similarity map of the paintings (laying clods out by how alike their paintings are, as Refik Anadol does with
his archives) is the plan for bigger globe terrains, not for DIRT.

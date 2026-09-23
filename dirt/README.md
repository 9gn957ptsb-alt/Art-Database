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

## DIRT tiles

`soil_tiles.py` makes the tile view in DIRT. It is a set of 25 different collection-soil squares whose edges all
line up (an edge-matched, or Wang, tile set), and no two meetings look the same. Every number chosen for it comes
from the golden ratio φ: a Fibonacci number or a power of φ.

- **Five objects on each kind of join.** Each vertical edge has one of five colours, and so does each horizontal
  edge. Each colour is a whole object from a painting that straddles the join. The vertical joins carry faces
  split down the middle: Dürer, the Mona Lisa, Velázquez's Juan de Pareja, Corot's young woman, and Delacroix.
  The horizontal joins carry Courbet's boats, Van Gogh's bridge at Arles, Monet's Doge's Palace, Poussin's angel,
  and Monet's Japanese footbridge. A grid laid left to right and top to bottom takes, at each place, the tile
  whose west and north edges match, so any arrangement is continuous across every join.
- **New shapes inside the tiles.** Every tile has one shape of its own coming up through its middle, or, with
  a chance of 1/φ, two at the golden-section points. They are drawn from the hand-found shapes in
  `objects.json` (`within`) and every checked face that is not on a join. Each is used once, so shapes keep
  appearing that appear nowhere else.
- **A different join every time.** Each time a grid is dealt, every join gets its own seed. At that join a
  share φ⁻³ of the object's shards sinks back into the dirt, darkened to φ⁻² of its light. Both tiles
  agree on which ones, so the object stays continuous, but it is never quite the same twice.
- **Small corners.** The corners, the one soil every tile shares, are 21 cells, so the patch that repeats at
  every grid point stays small.

The tiles are made in the same hand as the Cutouts view: 233 clods per source, the same weave, and the same
windows onto each painting. An object is not pasted on. It lies under the clods, and the clods over it become
shards carrying their piece of the picture. The shards have the same cracks and light as the other clods, and a
share φ⁻⁴ stays plain soil, so the object comes up through the dirt in pieces. A share φ⁻⁵ of ordinary clods is
centred on a face that OpenCV's Haar detector found and that was then checked by eye. It is shown with φ² of its
size in context, so it stays a fragment. `objects.json` records every object, its box in the painting, and the
detections that were rejected.

```bash
python3 dirt/soil_tiles.py --db path/to/artworks.db          # → dirt/private/tiles/ (needs opencv-python-headless<4.13)
python3 dirt/build_soil_viewer.py                            # rebuild DIRT with the tiles in it
```

DIRT is now only a field of these tiles and a Shuffle button (`build_soil_viewer.py`). Each Shuffle deals five
by three tiles, picks a random origin and lays the tiles out from it in a spiral. The farther a place is from the
origin, the more digital processes take hold of it, each switching on at a golden-ratio distance:

| From | What sets in |
| --- | --- |
| the start | more of each object's shards sink at its join, from φ⁻³ up to φ⁻¹ |
| φ⁻³ | colours turn, by up to the golden angle (137.5°) |
| φ⁻² | dots fuse into pixel blocks of 2, 3, 5, then 8 cells |
| φ⁻² + φ⁻⁴ | rows tear sideways, like torn scanlines |
| φ⁻¹ | columns pixel-sort by lightness into drips up to 21 cells long |
| φ^-½ | the field folds into a five-fold kaleidoscope about the origin |

The processes run over the whole field, never over single tiles, so no joins show. Every cell remembers which
painting it came from, so pointing anywhere still names the saved painting underneath. The generator still writes
a colour version of each tile, which the viewer does not use.
All tile output is written to `dirt/private/`, because the cutouts reproduce other artists' images.

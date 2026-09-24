# Building models

One JSON file per building from the Architectural Authority list, named
`<slug>.json` after its entry in `docs/v2/architecture.json`. Each is written
by hand from the article's photographs and drawn by `docs/v2/models.js` as
DIRT dots: the building standing on a plate of its own ground. Check a model
with

    node scripts/preview_model.js docs/v2/models/<slug>.json /tmp/<slug>.png

which renders it from four sides, the way the site does.

The photographs are the reference only. They are never copied into the
repository or the site, which is public.

## Coordinates

Metres. **x runs east, y runs south, z up.** The middle of the site is 0,0 and
the ground is z = 0. Where the photographs don't show which way is north, pick
the most telling front and face it south (+y), toward where the view first
looks from.

## The file

```json
{
  "slug": "roots-of-the-mountain-casa-ll-by-ra-arquitectura",
  "name": "Casa LL",
  "voxel": 0.5,
  "site": [44, 36],
  "ground": "grass",
  "parts": [ ... ],
  "notes": "what the photographs show, and what was guessed"
}
```

- `voxel`: metres to one voxel. Keep `max(site) / voxel` at about 100. Fine enough for the building's smallest
  telling feature (a mullion rhythm, a stair, a parapet). Keep
  `max(site) / voxel` at 120 or under, and the whole model under ~60,000 dots
  (the preview prints the count). 0.25 for a small pavilion, 0.5 for a house,
  1–2 for a big building.
- `site`: [east-west, north-south] metres of ground shown round the building:
  the building plus its immediate setting (terrace, pool, garden, a few trees).
- `ground`: what the plate is — any material; usually `soil` (the place's
  DIRT), `grass`, `drygrass`, `sand`, `gravel` or `paving`.
- `parts`: applied **in order**; a `cut` removes whatever earlier parts put
  there. Every part has an `"m"` material except `cut`, `pool` and `tree`
  (a tree's `m` is its crown, default `plant`).

| part | array | what it is |
| --- | --- | --- |
| `box` | `[x, y, z, w, d, h]` | a block; x, y, z is its north-west bottom corner |
| `cut` | `[x, y, z, w, d, h]` | takes out a block: courtyards, openings, a void under an overhang, a recessed glass band (cut, then box the glass back in further in) |
| `gable` | `[x, y, z, w, d, h]` + `"axis": "x"\|"y"` | a pitched roof in that box, its ridge along the axis, eaves at z |
| `shed` | `[x, y, z, w, d, h]` + `"rise": "+x"\|"-x"\|"+y"\|"-y"` (+ optional `"thick"`) | a mono-pitch, full height on the side it rises toward; with `thick` (metres) only a tilted slab of that thickness, not a wedge |
| `cyl` | `[cx, cy, z, r, h]` | an upright cylinder |
| `dome` | `[cx, cy, z, r]` | a half sphere standing on z |
| `blob` | `[cx, cy, cz, rx, ry, rz]` | an ellipsoid, for anything that swells or curves |
| `hip` | `[x, y, z, w, d, h]` | a hipped roof, rising from all four eaves at z to a ridge h above |
| `pool` | `[x, y, w, d]` (+ `z`) | water at ground level, or at z for a raised pool |
| `tree` | `[cx, cy, h, r]` (+ base `z`) + optional `"shape"` | a trunk and a crown, h tall, crown radius r; `shape`: `round` (default), `poplar`, `umbrella` (flat, wide), `palm` (bare trunk, frond crown), `bare` (winter: limbs and an open crown of twigs) |
| `mesh` | `{"v": [x, y, z, …], "f": [a, b, c, …]}` | a closed triangle mesh in the same metres and axes — built in SketchUp (see below) for curves the other parts can't shape |

Materials: `concrete`, `render` (painted plaster), `white`, `stone`, `marble`,
`rubble` (grey-brown field stone), `brick`, `palebrick` (grey-beige), `paintbrick` (painted a cool pale grey-green), `sandstone` (red, rusticated), `tile` (terracotta roof), `yellow` (Izamal lime paint), `rose` (dusty-rose render), `earth` (rammed earth, adobe), `ochre`
(concrete or plaster tinted to the ground), `wood`
(light), `timber` (dark), `thatch`, `glass` (drawn open, every other dot),
`mesh` (expanded metal, perforated screen — drawn open), `metal`, `steel`, `dark`, `corten`, `water`, `plant`, `grass`, `drygrass`, `sand`,
`gravel`, `paving`, `soil` (the place's own DIRT).

The renderer casts shadow from a sun up to the north-west, so overhangs,
courtyards and the ground east of walls fall into shade by themselves.

Anything thinner than one voxel does not show: a gravel roof or a lawn is at
least one voxel thick.

Glass or shade set back under an overhang reads about √2 times deeper in the
diagonal views, so a recess meant to be seen is modelled shallower than the
real one.

## Getting it right

- Work out the massing from the photographs first: how many volumes, their
  proportions against a door (2.1 m) or a storey (~3 m), which one is on top,
  what cantilevers.
- Then what makes it *that* building rather than a box: the overhang, the
  slit window, the pitched roofs in a row, the courtyard, the stair, the
  material change, the pool's edge, the tree it is built round.
- Glass is where the photographs show glass. Solid walls are what they are
  made of. Don't make it more regular or more glazed than it is.
- The setting: the terrace, pool, planting and trees nearest it. Not the
  wider landscape — the town view carries that.
- `notes`: say which views informed what, and what could not be seen and was
  guessed.

## Curved and sculpted buildings: SketchUp

When a building's form can't be made from the parts above (sails, shells,
carved or twisted volumes), it is modelled in SketchUp through the Trimble
SketchUp connector, and its geometry read back as triangles into a `mesh`
part (one per material). Convert SketchUp's inches and axes on the way out:
metres = inches × 0.0254, x = SketchUp X, **y = −SketchUp Y** (SketchUp's Y
runs north), z = SketchUp Z. The mesh must be closed (watertight) to fill
properly. The `.skp` file is kept for the artist.

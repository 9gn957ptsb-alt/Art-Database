# Project format (`residential-db/1`)

One JSON file per project in `residential/projects/<slug>.json`, where `<slug>` is the
Architectural Authority article slug. Units are metres. Plan coordinates are `[x, y]` with
`+y` up the page of the plan the project was traced from (not necessarily north).

```json
{
  "schema": "residential-db/1",
  "slug": "architectural-purity-neuendorf-house-by-john-pawson-and-claudio-silvestrin",
  "name": "Neuendorf House",
  "architect": "John Pawson and Claudio Silvestrin",
  "location": "Palma, Mallorca, Spain",
  "year": 1989,
  "scope": "house",
  "aa": {"url": "https://www.thearchitecturalauthority.com/article/...", "category": "Residential"},
  "sources": [
    {"id": "S1", "kind": "plan", "level": "L0", "url": "https://...", "what": "Ground floor plan, scale bar 0-5 m"}
  ],
  "calibration": {
    "S1": {"level": "L0", "px_per_m": 41.2, "origin_px": [312, 1180], "rot_deg": 0}
  },
  "accuracy": {"level": "B", "basis": "Ground and first floor plans with scale bars; heights from section S3",
               "notes": "Stair geometry estimated from photos"},
  "north_deg": 0,
  "defaults": {"ext_t": 0.35, "int_t": 0.12, "slab": 0.30, "roof_t": 0.40},
  "materials": {"ochre_render": [196, 140, 90]},
  "levels": [
    {"id": "L0", "name": "Ground floor", "elevation": 0.0, "height": 3.4},
    {"id": "L1", "name": "First floor", "elevation": 3.4, "height": 3.2}
  ],
  "rooms": [
    {"id": "L0-living", "name": "Living room", "type": "living", "level": "L0",
     "outline": [[0, 0], [8.4, 0], [8.4, 6.0], [0, 6.0]],
     "walls": [{"kind": "ext", "openings": [{"type": "window", "at": 1.2, "w": 2.4, "sill": 0.45, "h": 2.1}]},
               {"kind": "open"}, null, null],
     "height": 3.0,
     "floor": "travertine", "finish": "plaster", "ext_finish": "ochre_render",
     "sources": ["S1"], "confidence": "high", "notes": ""}
  ],
  "elements": [
    {"id": "stair", "kind": "stair", "room": "L0-hall", "level": "L0",
     "flights": [{"start": [1.0, 5.2], "dir_deg": 90, "width": 1.0, "steps": 18, "rise": 3.4, "going": 0.27}]}
  ]
}
```

## Rooms

A room is any space someone would pull out on its own: living, dining, kitchen, bedroom,
bathroom, closet, hall, stair, garage, terrace, patio, balcony, courtyard. Open-plan spaces
are split into their functional zones with `"open"` edges between them.

- **`outline`**: the room traced along the **centrelines** of its walls, counter-clockwise or
  clockwise (both work). Neighbouring rooms share the same centreline points, so shared walls
  line up exactly. Put a vertex wherever a neighbour's wall meets yours; the compiler adds
  them where you forget.
- **`walls`**: one entry per outline edge (edge *i* runs from point *i* to point *i+1*). `null`
  lets the compiler decide: an edge shared with an indoor neighbour is an interior wall split
  down its centreline (each room owns half); an unshared edge is an exterior wall (indoor rooms)
  or open (outdoor rooms). Otherwise:
  - `"ext"`: exterior wall, full thickness `t` (default `defaults.ext_t`), owned by this room.
  - `"int"`: interior wall shared with a neighbour (each owns `t/2`).
  - `"open"`: no wall (open plan, or a terrace edge).
  - `"glass"`: full-height glazing with frames and mullions (`"mullions": 1.5` bay width).
  - `"low"`: low wall or parapet, height `h` (default 1.0).
  - `"rail"`: glass balustrade, height `h` (default 1.05).
  A wall between an indoor and an outdoor room belongs entirely to the indoor room; the
  outdoor room just meets it. A glass, low or rail partition between two rooms is built once.
- **openings** on a wall: `type` `door` | `opening` | `glass_door` | `window`; `at` = distance
  along the edge from its start point to the near side of the opening, `w` width, `sill`
  height above the room's floor (doors 0), `h` height of the opening. `"glass": true` puts
  glass in it (windows and glass doors do by default). Enter a door once, on either room;
  the compiler mirrors it into the neighbour's half of the wall.
- **`height`**: clear floor-to-ceiling height. Default: up to the underside of the next level's
  slab, or the level height minus the roof for the top level.
- **`ceiling`**: sloped ceilings as planes `{"planes": [[a, b, c], ...]}` with
  `z = a*x + b*y + c` (height above this room's floor); the lowest plane wins at each point, so
  one plane is a mono-pitch, two meeting at a ridge are a gable, four are a hip.
- **`roof`**: `true`/`false` to force whether a roof slab is drawn over the room. By default
  indoor rooms get a roof over whatever part no higher room covers; outdoor rooms get none.
- **`ffl_offset`**: floor level relative to its level (split levels, sunken living rooms).
- **`slab`**, **`roof_t`**: thicknesses for this room.
- **`floor`**, **`finish`** (inside faces), **`ext_finish`** (outside faces), **`roof_finish`**:
  material names (see below).
- **`fixtures`**: boxes inside the room, e.g. a kitchen island
  `{"name": "Island", "at": [x, y], "size": [w, d, h], "rot": 0, "mat": "stone"}` (`z` relative
  to the room's floor). Use for built-in items that identify the room (islands, counters,
  baths, built-in beds), not loose furniture.
- **`type`**: `living`, `dining`, `kitchen`, `bedroom`, `master_bedroom`, `bathroom`, `ensuite`,
  `wc`, `closet`, `dressing`, `study`, `office`, `library`, `family`, `media`, `gym`, `laundry`,
  `utility`, `storage`, `pantry`, `garage`, `entry`, `hall`, `corridor`, `stair`, `guest`,
  `service`, `staff`, `cellar`, `technical`, `terrace`, `patio`, `courtyard`, `balcony`, `deck`,
  `porch`, `roof_terrace`, `pool_area`, `garden`, `other`. Outdoor types: terrace, patio,
  courtyard, balcony, deck, pool_area, garden, porch, roof_terrace.
- **`confidence`**: `high` (measured from a scaled plan), `medium` (plan without scale or partly
  obscured), `low` (estimated from photos or text).

## Elements

Things that are not rooms. With `"room": "<id>"` they go into that room's group; otherwise into
the level's `Exterior` group (or `Site` without a level). `z` is relative to the level.

- `slab`, `terrace`, `deck`, `landing`: `outline`, optional `holes`, thickness `t`, top at `z`.
- `roof`, `canopy`: same, for overhangs and eaves beyond the rooms.
- `prism`: `outline` extruded from `z` up by `h` (any odd mass).
- `pool`: `outline`, `depth` (water surface 5 cm below `z`).
- `column`: `at`, `h`, and `d` (round) or `size` `[w, d]`.
- `box`: `at`, `size` `[w, d, h]`, `rot` degrees.
- `wall`: freestanding wall along `path` with `t` and `h` (garden walls, fins).
- `stair`: `flights` (each `start` = middle of the bottom edge, `dir_deg`, `width`, `steps`,
  `rise` total, `going`) and `landings` (`outline`, top `z`, `t`); `"style": "treads"` for
  floating treads.

## Materials

Solid colours (SketchUp's material library is not available through the connector):
`plaster render white concrete concrete_dark brick stone travertine marble limestone oak walnut
timber timber_dark wood_floor tile terracotta adobe glass metal_dark metal steel zinc slate
roof_tile thatch water grass gravel earth black carpet`. Add your own under `materials` as
`[r, g, b]` or `[r, g, b, alpha]`.

## Sources, calibration and accuracy

- List every source used under `sources`, with the level a plan shows.
- `calibration` maps each traced plan image to plan coordinates: `px_per_m` (from the scale bar
  or a printed dimension), `origin_px` (the pixel where plan `[0, 0]` falls), `rot_deg`, and the
  `level`. `preview.py overlay` draws the model back onto the image with it; walls should sit on
  the drawn walls.
- `accuracy.level`: **A** dimensioned drawings; **B** plans with a scale bar or known dimensions;
  **C** plans scaled from a stated area or standard elements (doors, stairs); **D** estimated from
  photos and text only. Say what was estimated in `accuracy.notes` and in each room's `notes`.

# Museum interiors

One JSON file per museum on the globe, named `<slug>.json` after its entry in
`docs/v2/museums.json` and its model in `docs/v2/models/<slug>.json`. It says
what is known of the inside — which rooms, their outlines, what connects
them, how high they are and what they are made of — each with its source,
and where the saved works hang, as the museum's own records put them. The
walk (`docs/v2/walk.js`) and the checker both compile it with
`docs/v2/walk-plan.js`, so what is checked is what is walked. Check a file
with

    node scripts/check_interior.js docs/v2/interiors/<slug>.json [--png dir]

Only what a source gives is drawn. What is not known stays earth: inside the
model's walls, bare DIRT; a museum nobody has researched yet is its model's
outer walls round bare earth (a shell), entered by a door the rule finds.

Plans, drawings and photographs are the reference only. They are read,
never copied or traced, and never enter the repository or the site, which is
public: they are fetched only into `data/plans/<slug>/` (gitignored, like
`data/photos/`). Only facts are redrawn — the arrangement of rooms, their
numbers, which rooms connect, where the doors and stairs are — as rects and
polygons in metres.

## Coordinates

Metres, in the frame of the museum's own model, so the plan registers with
the model and its ground: **x runs east, y runs south, z up** from the
model's ground, and 0,0 is the model's site centre (the museum's point).
Angles are **degrees clockwise from true north** (0 is −y, 90 is +x). Work
sizes are in centimetres, colours are hex.

`grid` sets the cells the plan is walked on: `cell` is 0.5 m, 0.25 for a
small building (a site of 40 m or less), 1 past 300 m; `turn` is the degrees
the grid's axes are turned from the model's x axis (toward +y), so the
building's main walls lie on the grid — 0 for the National Gallery, about 29
for a building on Manhattan's grid. A `rect` is written with its first
corner in the model's frame and its sides along the grid's axes; points and
polygons are in the model's frame as they are.

## The file

```json
{"slug": "museum-national-gallery-of-art-washington-dc", "v": 1, "building": "West Building",
 "grid": {"cell": 0.5, "turn": 0},
 "sources": [{"id": "nga-rooms", "t": "the National Gallery of Art's open data: each public room's outline on its floor maps",
              "u": "https://github.com/NationalGalleryOfArt/opendata", "licence": "CC0-1.0", "read": "2026-09-30"}, …],
 "from": {"nga-rooms": {"px": [279, 106], "m": 0.44385, "turn": 0, "why": "…"}},
 "enter": {"floor": "ground", "at": [0, -54], "face": 180, "door": [0, -42], "out": [[-3, -56, 6, 6]],
           "sure": "reconstructed", "src": ["wikidata-wb", "nga-rooms", "model"], "note": "…"},
 "floors": [{"id": "main", "name": "Main Floor", "z": 3.4, "sure": "reconstructed", "src": ["nga-rooms", "model"],
             "rooms": […], "open": […], "things": [], "stairs": [], "lifts": []}, …],
 "pins": {},
 "notes": "what was drawn from what, and what is still unknown",
 "works": […], "asof": "2026-09-30", "tier": "documented"}
```

- `v`: 1.
- `building`: which building of the museum, where it has several.
- `sources`: `{id, t, u, licence, read}`. `t` is plain words — the only thing
  the page shows; `u` is kept in the file and never linked; `read` is the
  day it was read, or null while it is still to be read. Every `src`,
  `hsrc` and `msrc` below is a list of these ids, and a source may be cited
  only once it has been read.
- `from`: how outlines read in a source's own units (a map's pixels) were
  put into metres — see *Georeferencing*.
- `enter`: the public door. `floor` the floor you enter on; `at` where you
  stand, outside the door; `face` the way you face; `door` the doorway's
  middle; `out` the walkable ground outside it, `[[x, y, w, d], …]`. For a
  shell (`floors` null) it may still be given once the entrance has been
  researched, with `z`, the level of the floor it opens on. Null: the rule
  finds the door (see *The shell*).
- `floors`: the floors drawn, or null for a shell.
- `pins`: `{<work id>: {wall, at, z, sure, src}}`, only where a record or a
  published photograph fixes a work's spot: `at` 0–1 from the left as you
  face the wall, `z` its centre's height.
- `notes`: what was drawn from what, and what is still unknown.
- `works`, `asof`, `tier`: written by the scripts (*Generated*).

`scripts/build_interiors.py` rewrites the file in one layout — one source,
room, opening or work to a line — keeping everything written by hand.

## A floor

`{id, name, z, sure, src, note, rooms, open, things, stairs, lifts}` — `z`
is its level in metres, `name` only as a source gives it.

## Rooms

```json
{"id": "M-085", "ref": ["M-085", "West Main Floor Gallery 85"], "name": "Gallery 85",
 "said": "West Building, Main Floor - Gallery 85", "kind": "gallery", "rect": [45.72, -15.09, 10.21, 9.32],
 "h": null, "ceil": "auto", "floor": null, "walls": null, "top": null,
 "sure": "documented", "src": ["nga-rooms", "length"], "tol": 1.0}
```

- `id`: the museum's own key where it has one; `ref`: every key a source
  uses for it (placements are matched to rooms by these).
- `name`: only as a source gives it, else null. `said`: the source's words
  for it, verbatim.
- `kind`: `gallery`, `hall`, `court`, `rotunda`, `lobby`, `stair`, `shop`,
  `cafe`, `void` or `closed`. A void (an atrium open to below) and a closed
  room (staff only, not open) are drawn and never walked.
- One shape, its clear floor: `rect` `[x, y, w, d]`, `poly` `[[x, y], …]`
  (at least three points, not crossing itself) or `circle` `[cx, cy, r]`.
- `fz`: its floor above the floor's `z` (default 0).
- `h`: its clear height in metres, with `hsure` and `hsrc`; null takes it
  from the model.
- `ceil`: `flat` (the room's `top` material at its height), `skylight`
  (panes toned by the museum's sky now), `sky` (an open court), `dome`
  (rising toward the middle in rings from its spring at `h`; with `h` null,
  the model's own dome, and where the model has glass on top, its oculus),
  `vault` (round over the long axis), `dark` (not known: the walls rise into
  the dark) or `auto`, the default: the model's roof over each cell less a
  voxel — a skylight where the model has glass on top, else dark. `oculus`:
  the radius of a dome's open eye, in metres, where a source gives it.
- `floor`, `walls`, `top`: materials from `docs/v2/models.js`, or null — not
  known, drawn as the place's DIRT. Any material needs `msrc` (and `msure`).
- `sure`: `documented` or `reconstructed`, for its existence and outline.
  There is no third value: what is not known is not drawn.
- `tol`: ± metres of the outline. `built`: the year it opened, where
  documented. `note`.

Where two rooms touch with no cell between them, one wall cell is put in.
Rooms may not overlap by more than 5% of the smaller.

## Openings

```json
{"a": "M-089", "b": "M-085", "at": [45.72, -10.43], "w": 2.4, "h": 3.0, "kind": "door",
 "sure": "reconstructed", "src": ["nga-map"], "note": "the middle of the shared wall, 2.4 by 3.0 m: the rule"}
```

- `a`, `b`: the rooms it joins; `b` may be `"outside"`.
- `at`: a point in the wall between them. The wall found is the nearest
  within 1.5 m of it, looking along the grid's axes and diagonals, and at
  most 2.5 m thick; the doorway is cut through it `w` wide (default 2.4 m).
- For a passage through a thicker gap, `cut` `[x, y, w, d]` in place of
  `at`: carved as given, and it must reach both rooms.
- `h`: its head in metres over room a's floor, or null: the lower of the
  two rooms' ceilings. `kind`: `door` or `arch`.
- `src`: **a source that says the two rooms connect** — a plan, a visitor
  map read for its layout, a description, a photograph through the doorway,
  OpenStreetMap's indoor mapping. The place and size may be reconstructed by
  a stated rule (the middle of the shared wall, 2.4 m wide, head 3.0 m), and
  the note says so; that the rooms connect may not be reconstructed. Rooms
  with no opening share a solid wall, and a room no opening reaches shows as
  having no way in known yet.

## Things, stairs and lifts

- A thing: `{box: [x, y, w, d, h], m, solid, sure, src, note}` — only what a
  source names (the Rotunda's fountain), never made-up furniture. It raises
  the floor by `h` over its box; a solid one is walked round.
- A stair: `{id, name, rect: [x, y, w, d], rise: "+x"|"-x"|"+y"|"-y", from,
  to, sure, src}`, listed once, on either of its floors. It is laid into both
  floors' grids as treads of equal risers of at most 0.2 m, rising the way
  `rise` says, its top flush with the upper floor; each tread must be at
  least a grid cell deep. The walker changes floor at its middle.
- A lift: `{id, name, rect, floors: [ids], sure, src}`.

## Generated

`scripts/build_interiors.py` owns only these, and (with `--nga`) the
National Gallery's room outlines:

- `works`: every saved work the museum holds — museums.json's, those its
  history says it held or listed, and those its own records match — each
  `{id, how, room, wall, said, src, asof, ref, …}`:
  - `how`: `museum` (the record names a room drawn here, and sometimes the
    wall), `elsewhere` (a room not drawn here: another building, a room not
    drawn yet — listed, never hung), `off` (the record says in so many words
    that it is not on view) or `none` (nothing says; the empty field is
    reported as what it is, never read as "in storage").
  - `said`: the record's own words; `src` its source; `asof` the day read;
    `ref` `{museum, object}`, the museum's record.
  - `wall`: `n`, `e`, `s`, `w`, `centre` or null.
  - for `museum` and `elsewhere`, also `t`, `a`, `y`, `m` (title, artist,
    date, medium), `i` (the picture's key on Artsy's image store), `c` (its
    three colours), `cm` `[w, h, d?]` or null and `cmsrc` (the museum's own
    measure where it has one, never the framed one, else Artsy's); `free`
    for a sculpture; `same`, a work that is another saved work's very
    object, which hangs once, as that one.
- `asof`: the day the works were placed.
- `tier`, written by the checker: `documented` (at least 80% of the
  walkable floor in documented rooms), `reconstructed` (any rooms drawn) or
  `shell`.

## How works hang

A work hangs only where its `how` is `museum` and its room is drawn —
never in a shell, never in a guessed room. On the wall the record gives: the
room's edge whose outward normal is nearest that way (for a round room, its
arc within 45° of it), or freestanding at the room's middle for `centre`.
Along it, in the museum's order (its record numbers), then by date, spaced
evenly over the wall's longest run between doorways, 0.3 m clear of an
opening and 0.4 m of a corner, at least 0.6 m apart; what does not fit goes
to the next run of that wall, then to a second tier above. Centres hang at
1.45 m (57 in); a work taller than 2.3 m stands 0.3 m off the floor. A work
whose depth is at least a fifth of its width, or whose medium is bronze,
marble, stone, wood, clay, plaster or ceramic, stands free 1 m out from its
wall. The place along the wall and the height are ours, and the label says
so, unless a pin gives them. No frames, plinths, benches, lights or wall
texts are drawn: none is known.

## Rasterising

The same code in the page and the checker (`WalkPlan.compile`): a cell
belongs to a room if its centre is inside the room's shape (a rect holds its
first sides, not its last, so two rooms sharing a side never both hold a
cell on it). Everything inside the model's footprint at the floor's eye
height (its z + 1.6 m) that is in no room is solid earth; the model's own
outer wall is its edge; outside the footprint is the ground. Then the
openings are carved, the stairs laid, the things set and the ceilings
filled. A documented room outside the model is drawn, walled round, and
filed against the model (below).

## The shell

A museum with no floors is walked as its model: the footprint at the
entrance floor's eye height, eroded a voxel — the ring is the model's outer
wall in its own material, glass left as glass, and inside is bare earth
under the model's roof. Where the entrance has not been researched, the door
is found by rule: on the outer wall of the museum itself (of the parts of
the footprint that hold together and are of a size — a tenth of the largest,
100 m² at least — the one nearest the museum's own point, as a model often
holds its neighbours too), the middle of the longest straight stretch of
wall facing south (within 60° of it, at whatever angle the building stands),
with open ground before it for the few metres a visitor stands in; east,
west or north where no wall facing south has that. You stand 2 m out, facing
in. The banner says nothing is known yet; no work hangs; the column lists
the works and why each is not hung.

## The certainty policy

- **documented**: the geometry comes from the museum's own data or
  survey-grade drawings; a placement comes from the museum's own dated
  record.
- **reconstructed**: redrawn from a plan or a description, or derived by a
  stated rule — a doorway at the middle of a shared wall once a source says
  the rooms connect; a height from the model; the 1.45 m hanging line.
  Surfaces that are reconstructed show a quarter more of the soil through
  them.
- **not known**: not drawn. It stays earth.
- **Never**: a room name that is not in a source (use null); a room drawn so
  that a work can hang in it; a doorway between rooms no source connects; a
  staff or closed area made walkable (use `closed`); a placement or a size
  made up; a `said` that is not verbatim.

## The sources, most sure first

1. The museum's own open data (documented): the National Gallery of Art's
   room outlines for every public room (`preferred_locations.csv`, CC0) and
   each object's room and wall; the Art Institute's galleries and each
   work's gallery; the Met's, Cleveland's and SMK's gallery for each object.
2. OpenStreetMap's indoor mapping (`indoor=room|area|corridor`, `level`,
   `ref`, `door`; ODbL), read on GitHub's runners as the construction dates
   are. Reconstructed unless it matches a documented plan.
3. Measured drawings in the public domain (HABS/HAER at the Library of
   Congress for the American buildings that have them): documented, to their
   dimensions.
4. Published visitor plans and architects' plans: read, never copied or
   traced; redrawn in metres to a published dimension or to the model. A
   visitor map is schematic, so what is redrawn from one is reconstructed.
5. Published descriptions (the museum's building history, SAH Archipedia,
   monographs, Wikipedia and Wikidata) for heights, finishes, skylights, the
   entrance and floor levels: reconstructed unless they state a figure.
6. The exterior model: the shell, `auto` ceilings, the outer walls.
   Reconstructed.

Where a museum's own page for a work says where it hangs ("On view in Room
32"), it goes in `HANGS` in `scripts/build_interiors.py` with the page's
address and the day it was read.

## Georeferencing

`from` records how a source's own units were put into metres: `px` is the
source point placed on the model's 0,0, `m` the metres to one unit, `turn`
the degrees it was turned, `why` how that was decided. The National
Gallery's outlines are in the pixels of its floor maps, north up; 537 px of
outlines (x 11–548) over the West Building's published length of 782 ft
(238.35 m) makes 0.44385 m a pixel, and the Rotunda's centre (279, 106) is
put on the model's dome. That scale and placing are reconstructed unless a
source states them.

## Checking

    node scripts/check_interior.js docs/v2/interiors/<slug>.json [--png dir]
    node scripts/check_interior.js --all [--png dir]
    python3 scripts/build_interiors.py [--only slug] [--stubs] [--nga] [--refresh]

The checker loads the page's own `models.js` and `walk-plan.js`, compiles
the file against its model and ground, and refuses it (exit 1) for: the
schema (types, `v`, unique ids, a rect's w and d over 0, a polygon of three
points or more not crossing itself, a circle's r over 0); a `src`, `hsrc`
or `msrc` not in `sources`, or citing one not yet read; a `sure` other than
documented or reconstructed; a material not in `models.js`, or one without
`msrc`; an opening missing a room, finding no wall between its rooms within
1.5 m of `at` and 2.5 m thick, or without a source; a stair whose ends do not
meet its floors or whose treads are shorter than a cell; an entrance not on
a floor, or no room reached from it; rooms overlapping by more than 5% of
the smaller; a reconstructed room more than 10% outside the model at its
floor's eye height (a voxel's slack); a placed work whose room or wall does
not resolve; a file over 96 KB, a floor over 400,000 cells or 400 rooms.

It warns of a documented room outside the model, rooms with no way in known
yet, a ceiling above the model's roof, works overflowing into a second tier,
works placed in rooms not drawn, a model whose footprint stands less than
80% on its ground's buildings, a source read more than 180 days ago and
works placed more than 30 days ago. Findings against the model go into its
log in `docs/v2/models/ledger.json` for its next refinement, one line a
kind, rewritten as they change. It writes the tier back into the file and
the museum's `interior` into the ledger.

`--png` draws, through Playwright, each floor from above (rooms tinted by
how they are known, their ids, the openings, the stairs as arrows, the hung
works as ticks of their colours, rooms past the model in red), the cut-away
plan level from two diagonals as the page draws it, and first-person frames
from the door and before up to six hung works once `walk.js` offers them.

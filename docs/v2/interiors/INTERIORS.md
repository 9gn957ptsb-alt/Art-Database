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
- `anchor`: the id of a read source whose own coordinates fix where the room
  is — the museum's own map of its galleries (the Met's map points, the Art
  Institute's gallery points) or OpenStreetMap's survey. A reconstructed room
  is held to the model (at most 10% outside it); an anchored one, like a
  documented one, stands where its anchor says, and where the model stands
  off it the room is drawn, walled round, and filed against the model.

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
  most 2.5 m thick; the doorway is cut through it `w` wide (default 2.4 m),
  and never fewer cells across than a walker needs (two at 0.5 m, three at
  0.25 m: a 0.9 m door whose middle falls on a cell's centre is taken half
  a cell to one side, not made wider). A door narrower than a walker (0.5 m)
  is warned of.
- For a passage through a thicker gap, `cut` `[x, y, w, d]` in place of
  `at`: carved as given, and it must reach both rooms. A cut longer than a
  wall's 2.5 m goes through what no source shows: it needs a `note` saying
  why, and the checker reports its length.
- `h`: its head in metres over room a's floor, or null: the lower of the
  two rooms' ceilings. `kind`: `door`, `arch` or `part`.
- `part`: the two are parts of one space a source names as one (the NGA's
  three "North Lobby" outlines): no wall is drawn between them at all, and no
  doorway is made up. `at` still names a point on the seam.
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
  least a grid cell deep. The walker changes floor at its middle. It must lie
  inside one room on each floor, over no wall, earth or closed room: laid
  across a wall it would join rooms no source connects, and the checker
  refuses it.
- A lift: `{id, name, rect, floors: [ids], sure, src}`, held to the same.

## Generated

`scripts/build_interiors.py` owns only these, and (with `--nga`) the
National Gallery's rooms: of each, the outline, `id`, `ref`, `said`, `sure`
and `tol`, rewritten; and its `name`, `kind` and `src`, except that a room a
hand has closed (or made a void) stays so, a name a hand has set to null
stays null, and sources a hand has added to `src` are kept after the NGA's.
Every other key on a room is the hand's:

- `works`: every saved work the museum holds — museums.json's, those its
  history says it held or listed, and those its own records match — each
  `{id, how, room, wall, said, src, asof, ref, …}`:
  - `how`: `museum` (the record names a room drawn here, and sometimes the
    wall), `elsewhere` (a room not drawn here: another building, a room not
    drawn yet — listed, never hung), `off` (the record says in so many words
    that it is not on view) or `none` (nothing says; the empty field is
    reported as what it is, never read as "in storage").
  - `said`: the record's own words (a bare field in plain words: the Met's
    `GalleryNumber` 625 is "Gallery 625, in the Met's record", the field as
    it came kept in `ref.field`); `src` its source; `asof` the day read;
    `ref` `{museum, object}`, the museum's record. Where nothing has been
    read, `said` is "where it hangs has not been read yet" and `src` null.
  - `at`: a work another museum's own record places (the NGA, the Met …),
    listed here because this museum listed it on Artsy: `how` stays `none`,
    `said` says where it is ("at National Gallery of Art, Washington, D.C.:
    West Main Floor Gallery 91 · S") and `src` is that museum's record.
  - `wall`: `n`, `e`, `s`, `w`, `centre` or null.
  - for `museum` and `elsewhere`, also `t`, `a`, `y`, `m` (title, artist,
    date, medium), `i` (the picture's key on Artsy's image store), `c` (its
    three colours), `cm` `[w, h, d?]` or null and `cmsrc` (the museum's own
    measure where it has one, never the framed one, else Artsy's; one measure
    alone is read too: a diameter as `[d, d]`, a greatest extension or a
    height as `[null, h]`, the width then the picture's, with `cmk` saying
    which); `free` for a sculpture; `same`, a work that is another saved
    work's very object, whatever its record says of it, which hangs once and
    is counted once, as that one.
- **The museum's own collection** (`kind: "collection"`), after the saved
  works: see *The collection on the walls*.
- `asof`: the day the works were placed.
- `tier`, written by the checker: `documented` (at least 80% of the
  walkable floor in documented rooms), `arranged` (more than half of it in
  rooms the site arranged: "Arranged", below), `reconstructed` (any rooms
  drawn) or `shell`.

## The collection on the walls

A museum whose own open data says where its works hang carries, beside the
saved works, a few hundred of its own collection on view, so its rooms are a
museum to walk: `python3 scripts/build_interiors.py --collection` reads them
(into `data/collections/<museum>.json`, never committed) and every run hangs
them from that copy. Chosen by the museum's own flags, in its own order:

| museum | what is read | room from | label |
| --- | --- | --- | --- |
| the Met | its highlights on view (`isHighlight`, `isOnView`, collection API v1.1 search, then each object) | `GalleryNumber` | none published |
| the Art Institute | its works on view (`is_on_view`), the boosted ("essentials", `is_boosted`) first | `gallery_id` / `gallery_title` | `description` (CC BY 4.0) |
| Cleveland | its highlights on view (`highlight`, `currently_on_view`) | `current_location` | `wall_description`, else `description` |
| the NGA | its paintings, then sculpture, on view in the West Building (its open data has no highlight flag), by object id | `locationid` → `locations.csv` (room and wall) | none published |

Only works whose gallery is drawn in the file are hung, in rounds: each room
its first six, then two more a round, the rooms in the order of their best
work, at most 300 a museum; never a saved work's own object (that is listed
once, as the saved work); never in a closed room. Each is a work entry:

```json
{"id": "met:436535", "kind": "collection", "how": "museum", "room": "G-822", "wall": null,
 "said": "Gallery 822, in the Met's record", "src": "met-collection", "asof": "2026-10-08",
 "ref": {"museum": "met", "object": "436535", "url": "https://www.metmuseum.org/art/collection/search/436535",
         "field": "GalleryNumber: 822"},
 "t": "Wheat Field with Cypresses", "a": "Vincent van Gogh", "y": "1889", "m": "Oil on canvas",
 "cm": [93.4, 73.2], "cmsrc": "met",
 "img": "https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg", "c": null,
 "desc": null, "descsrc": null, "credit": "Purchase, The Annenberg Foundation Gift, 1993"}
```

- `id`: `<museum>:<object>` — `met`, `aic`, `cma` or `nga` and the museum's
  own object number; never an Artsy id.
- `kind`: `collection`. A collection work always hangs (`how` `museum`);
  one whose gallery is not drawn is not listed at all.
- `room`, `wall`, `said`, `src`, `asof`: as for a saved work. `said` is the
  record's words (the Met's bare `GalleryNumber` in plain words, the field
  in `ref.field`); `src` is the museum's `-collection` source.
- `ref`: `{museum, object, url, field?}` — `url` the museum's own page for
  the work (the page may link to it; it is the museum's, not ours).
- `t`, `a`, `y`, `m`: title, artist (or culture), date and medium as the
  museum gives them.
- `cm`, `cmsrc`: its size, as for a saved work (the museum's own measure,
  never the framed one; the Met's "Overall" element; the NGA's first
  dimension line; the Art Institute's dimensions text, else its unframed
  detail).
- `img`: the museum's own image address, **only where the museum says the
  image is open access** — the Met's `primaryImageSmall` where
  `isPublicDomain`; the Art Institute's IIIF
  `https://www.artic.edu/iiif/2/<image_id>/full/843,/0/default.jpg` where
  `is_public_domain`; Cleveland's `images.web.url` where
  `share_license_status` is CC0; the NGA's IIIF
  `<iiifurl>/full/!843,843/0/default.jpg` where `published_images.csv` says
  `openaccess` 1 — else null, and the page shows its colours, or a quiet
  frame, with its label. Shown live in the visitor's browser, never copied.
- `c`: its colours where the museum measured them cheaply (the Art
  Institute's dominant colour, one hex), else null.
- `desc`, `descsrc`: the museum's own label for it, verbatim (its markup
  taken out, its paragraphs kept), and whose label it is ("the Art
  Institute of Chicago's label", "the Cleveland Museum of Art's wall text");
  both null where the museum publishes none (the Met, the NGA).
- `credit`: the museum's credit line, verbatim, or null.
- `free`: true for a sculpture, as for a saved work.

The checker refuses a collection work that does not hang, has no
`ref {museum, object, url}`, an `img` that is not https, `c` that is not a
list of hex colours, or `desc` without `descsrc` (or the other way).

## How works hang

A work hangs only where its `how` is `museum` and its room is drawn —
never in a shell, never in a guessed room — or where its `how` is
`arranged` and its room is one the site arranged ("Arranged", below; in the
file's order, the rule's, one to every 2.5 m of a run, no second tier). On the wall the record gives: the
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
in. That way in is ours, not the museum's door, and is said so: the plan
names it "A way in (ours)" (the banner said "Inside · nothing is known yet ·
the walls are the model's, the way in ours" until 7 Oct 2026, when the artist
asked for it gone: `QUIET_LINE` in walk.js; the banner now says only the floor
and the room), and no lit tile marks it on the
building (the tile marks only an entrance a source gives; the gesture still
goes in). No work hangs; the column lists the works and why each is not hung.

## The certainty policy

- **documented**: the geometry comes from the museum's own data or
  survey-grade drawings; a placement comes from the museum's own dated
  record.
- **reconstructed**: redrawn from a plan or a description, or derived by a
  stated rule — a doorway at the middle of a shared wall once a source says
  the rooms connect; a height from the model; the 1.45 m hanging line.
  Surfaces that are reconstructed show a quarter more of the soil through
  them.
- **arranged** (7 Oct 2026, below): rooms the site lays out by a stated
  rule inside the model's real walls, where no plan of the museum has been
  read, so that its saved works can be walked up to. Never the museum's.
- **not known**: not drawn. It stays earth.
- **Never**: a room name that is not in a source (use null; an arranged
  room is `Room <n>`, `Hall` or `Entrance`, never a gallery name of the
  museum's); a room drawn so that a work can hang in it — except in the
  arranged tier, which says so on every room and work; a doorway between
  rooms no source connects (arranged doorways are the rule's, said so); a
  staff or closed area made walkable (use `closed`); a placement or a size
  made up; a `said` that is not verbatim (an arranged `said` is the site's
  own sentence, and says it is the site's).

### Arranged

The artist, 7 Oct 2026, of MoMA's shell walk: "Focus on building the
walkable models for all major museums in major cities. I want to be able to
walk up to an artwork inside the museum and click on it and learn about it."
That request supersedes, for this tier only, "never a room drawn so that a
work can hang in it". Written by `scripts/build_interiors_arranged.js` (the
page's own `models.js` and `walk-plan.js` in a vm; the rule in full in its
head comment), only for a museum whose rooms no source gives — never one the
museum's own data draws (the NGA, the Met, the Art Institute, Cleveland) or
one whose rooms OpenStreetMap's indoor mapping draws (`build_interiors.py
--osm` took its plan: every floor's `src` has `osm-indoor`). In such a museum
the script lays out nothing; it only hangs the works no record places, by the
rule below, in OpenStreetMap's galleries (rooms of kind `gallery` anchored on
`osm-indoor`, reached from the way in), `how: "arranged"`, `src: "arranged"`
(its source's `t` says the site hangs them in rooms OpenStreetMap draws), the
rooms keeping their mapped names. An arranged room is never put on a floor
OpenStreetMap draws:

- **floors**: the museum's own count where a source read gives it (`FLOORS`
  in the script, each with its source); else 5 m storeys as far as the model
  stands over at least 40% of its ground floor (200 m² or more), three at
  most. `sure: "arranged"`.
- **rooms**: on a grid turned to the building's main walls, a hall down the
  long axis (6–10 m wide) where the building is 26 m deep or more, bays
  either side about 12 m deep and 10–14 m along (larger in a large museum, to
  keep about 140 rooms), each the largest rectangle of its bay inside the
  model's walls; only rooms the doorways reach are drawn. Named `Room 1`,
  `Room 2` … in walking order from the door; the hall is `Hall`. Every room's
  `said`: "Where the museum hangs these is not known: the rooms are arranged
  by the site inside its walls". No `ref`, no `h` or material of its own.
- **doorways**: 2.4 m at the middle of every shared wall the rule names (bay
  onto hall, neighbours along a rank, outer rank into inner); **stairs** a
  straight flight down the hall, else a lift in a room both floors share.
- **the way in**: of the ground floor's room sides that meet open ground
  through a wall of 2.5 m at most (a voxel and a half on a coarse model), the
  one facing south, the longest, nearest the shell's door; cut through the
  wall, said so in its `note`.
- **works** (`how: "arranged"`, `src: "arranged"`): every saved work the
  museum holds that its own record does not place in a room drawn (never one
  its record says is off view, nor one another museum's record places), then
  the works the museum showed and does not hold ("Also here",
  `places/<city>.json` at its venue; `also: {k, y, q}` keeps what the history
  says happened there), each group by period, then artist, then date, filling
  the rooms in walking order, one work to every 2.5 m of a run of wall
  (`ARR_SPACE` in walk-plan.js; no second tier), a new room at a new period
  once a room holds three. `said` says the site hung it; what the museum's
  record said, if anything, is kept in `rec` with its source. The facts
  (`t a y m i c cm cmsrc`) are copied from the work's history.
- **said where**: the column ("Where it hangs · Room 3", then "Hung there by
  the site: where the museum hangs it is not known") and the look's label;
  never over the walk (the banner reads only "Level 1 · Room 3").
- **tier**: `arranged` when more than half the walkable floor is in arranged
  rooms. The daily pass grows an arranged museum to reconstructed or
  documented as soon as a plan, OSM indoor mapping or the museum's own data
  is read: its rooms are then drawn from the source and the script leaves it
  (`REFINE.md`, "Interiors").

The checker refuses an arranged room named otherwise, without that `said`,
or with a `ref`; an arranged work in a room neither arranged nor anchored on
`osm-indoor`, or a record's (`museum`) work in an arranged room; and
`arranged` on a height, a material, a thing or a pin.

## Which tier draws a museum

One source draws a museum's rooms, never two mixed on a floor, in this order:

1. **The museum's own data** (the NGA's outlines, the Met's plans and points,
   the Art Institute's points): their own passes own the rooms. OpenStreetMap
   only adds what joins them (its doors, its lifts, the rule inside a wing it
   maps as one room), each said so; the arranged tier never touches them.
2. **OpenStreetMap's indoor mapping**, where it is usable (below): it
   replaces the arranged rooms or the shell whole.
3. **Arranged**, by the site's rule, where neither has been read or
   OpenStreetMap's is not usable.
4. **The shell.**

A plan, a description or a hand's redrawing (sources 3–5 below) is written
by hand and keeps its floors; `--osm` adds only OpenStreetMap's doors to such
a museum when it is in `OSM_OWN`, and otherwise leaves it.

## The sources, most sure first

1. The museum's own open data (documented): the National Gallery of Art's
   room outlines for every public room (`preferred_locations.csv`, CC0) and
   each object's room and wall; the Art Institute's galleries and each
   work's gallery; the Met's, Cleveland's and SMK's gallery for each object.
2. OpenStreetMap's indoor mapping (`indoor=room|area|corridor`, `level`,
   `ref`, `door`; ODbL), read on GitHub's runners as the construction dates
   are: `.github/workflows/osm-indoor.yml` runs `scripts/fetch_osm_indoor.py`
   for the 45 major museums in its `MAJORS` (a push touching either, or
   `osm/INDOOR_REQUEST`) and commits `osm/indoor/<slug>.json` (each feature's
   OSM id, its indoor, door, entrance, room, level, ref and name tags, and
   its geometry in degrees; credited). The extract is a square round the
   museum, so it holds its neighbours too (the Transit Center by SFMOMA, the
   Neues Museum by the Alte Nationalgalerie, the Archives nationales by the
   Musée Picasso, the Underground under Trafalgar Square). How
   `build_interiors.py --osm` reads it, with `scripts/osm_interiors.js` (the
   page's own compiler in a vm) to fit it to the model:
   - **levels**: `level`, else `repeat_on` (`2`, `0;1`, `1-2`); untagged is
     level 0. Each whole level at or above 0 is a floor `L<n>` named
     "Level <n>" (OpenStreetMap's number); a level between two (the Louvre's
     0.25, an entresol) and the levels below ground are not drawn, and the
     notes count them. Each level's height is ours: the storey (3.5–7 m)
     that gives the most of the mapped upper rooms 2.4 m of headroom under
     the model's roof, a level that height over the one below.
   - **rooms**: every `indoor=room|area|corridor` outline (a stair space
     too), clipped to the model's site; a lift shaft (`highway=elevator`) is
     a way between floors, not a room. Where outlines overlap, a room keeps
     the floor, then a stair, a corridor, an area; a room holding two others
     or more is a wing (not drawn: its name and `ref` are kept for the
     museum's own rooms, below); an outline left with a hole round a room
     drawn inside it is split through the hole, its pieces joined as `part`;
     outlines simplified to 0.2 m, under 4 m² dropped. Kept only where half
     the room stands on a building of the model (a part of its footprint of
     a size, 3 m round it): what stands off is a neighbour's. `kind` from
     `room=` (gallery by default; corridor and area a hall; offices, stores,
     toilets and `access=private` closed). `name` the mapped `name:en` or
     `name` or `ref`, `ref` every key a record might use for it ("229",
     "Gallery 229", "Sal 229" …), `said` its tags verbatim, `anchor`
     `osm-indoor`, `sure` reconstructed, `tol` 1 m.
   - **doors**: a `door=*` or `entrance=*` node within 1.5 m of two rooms of
     its level is an opening there (`w` its `width`, else 1.6 m, ours);
     dropped where the compiler finds no wall to cut. Where OpenStreetMap
     draws two rooms side by side and no door, and one of them has no other
     way in, a doorway is put at the middle of the wall they share (3 m of
     it or more, at most 2.5 m thick), 2.4 m wide, a corridor or hall first,
     then the longest wall, until no more can be reached: `src`
     `["osm-indoor", "osm-rule"]`, its note saying so. That two rooms side
     by side connect is then the rule's, not a source's: the one place the
     rule may say rooms connect, and only to give a room a way in.
   - **between floors**: a lift where it maps a lift or a stair space across
     levels, a 2 m square (1.5 for a stair) set where it lands inside one
     walkable room on two floors or more; a floor no mapped one reaches gets
     one lift by the rule in a room both floors have, nearest the way in
     (`osm-rule`). No flight is drawn: none is mapped with its run.
   - **the way in**: of its entrance nodes by a room of the lowest floor
     (entrance=main first, then nearest the museum's point), the one that
     reaches the most; else a way in by the rule, from a mapped room
     straight out through the thinnest wall to open ground, cut, said so.
   - **usable**: at least 6 rooms, two thirds of their floor reached from the
     way in, and a floor whose mapped rooms cover half the model's floor
     there (the parts of the model they stand in) — then it replaces the
     arranged rooms whole; a shell takes any plan that is reached so. Not
     usable: the rooms stay as they were and the notes begin with what
     OpenStreetMap gave and why it was not walked.
   - **the museums' own** (`OSM_OWN`: the NGA, the Met, the Art Institute):
     only OpenStreetMap's doors between two of their rooms, its lifts where
     they land in one of their rooms on two floors or more (its levels mapped
     to their floors), inside a wing it maps as one room by a range of
     numbers ("Alsdorf Galleries", `ref` 140-143) doorways by the rule
     between its galleries that share a wall, enough to join them, and its
     entrance where it reaches at least twice the rooms the file's does.
   What it writes has `osm-indoor` (and `osm-rule`) in `src` and a note
   beginning "OpenStreetMap's indoor mapping", and is rewritten each run;
   `--osm-report <file>` writes the fit museum by museum.
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

## The museums read from their own maps (8 Oct 2026)

- **The National Gallery of Art** (`--nga`, then `scripts/nga_map_doors.py`):
  its own outlines for the rooms (documented); the doorways read off its
  visitor map (English, June 2025, fetched from nga.gov into
  `data/plans/`): the map's pages registered to the outlines once (by how
  many outline points fall on the map's drawn separators; `REG` in the
  script, recorded in `from.nga-map`), then for each two rooms facing each
  other a probe across the shared wall every 0.1 m reads the map's paint —
  the rooms' own (pinks, the halls' white) or a wall (greys; between two
  galleries the white line); each open run of 1 m or more is a doorway there,
  at its middle, its width the run's (1.2–4 m). A run of 0.6–1 m counts
  only where it is a room's only way to the rest; rooms left apart are read
  again loosely (the map's light screens and hatching not taken for walls).
  A room the map paints grey is closed. Reconstructed (`src` nga-map), and
  its note says so.
- **The Met** (`scripts/met_plan_rooms.py`): its visitor floor plans (Floor
  1, Floor 2), where each gallery's number is printed on them (as the
  met-tour-project read them) and the points the Met's own map opens on for
  85 galleries (the ARtifact project's list of maps.metmuseum.org links).
  Each floor's plan is laid into the model's frame by the affine that puts
  the printed numbers on the Met's points (Floor 1 to 0.2 m median, Floor 2
  to 1.4 m); the plan's walls (its thin blue-grey lines, letters set aside)
  stop a walk; each room is the floor nearest its number by walking, never
  through a wall, at most 30 m (so it follows the plan's walls where it
  draws them and crosses open floor midway), as the 1 m cells of the grid
  (turned 29.3°, Fifth Avenue's) whose middles are in it; an opening where
  two rooms meet on open floor. The insets (mezzanines, Floor 3, the Roof
  Garden) are not drawn: they are not in place on the plans. Rooms are
  anchored on the Met's points: the model stands off them. The floors are
  joined by the lift the plans draw by the Great Hall; the entrance is the
  plans' 82nd Street door. All reconstructed.
- **The Art Institute** (`scripts/aic_rooms.py`): its API's point for each
  gallery; each room the floor nearer its point than any other gallery's of
  that floor (Voronoi), within 9 m of it, on the 0.5 m grid; one gallery
  given two points is one room round both; doorways only between galleries
  numbered one after the other (201 and 202; 127A and 127B) that share a
  wall 2 m long or more, at its middle; the entrance its own point for the
  Michigan Avenue entrance. No plan of the building can be read from a
  session, so most rooms have no way in known and no stairs join the floors.
  Anchored on its points. All reconstructed.
- **Cleveland**: its records name each work's gallery, but no geometry for
  the galleries has been found (no plan, no points); it stays a shell, its
  works listed, until OpenStreetMap's indoor mapping or a plan gives rooms.

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
documented or reconstructed (or arranged, on a floor, room, opening, stair, lift or entrance); a material not in `models.js`, or one without
`msrc`; an opening missing a room, finding no wall between its rooms within
1.5 m of `at` and 2.5 m thick, or without a source; a cut longer than 2.5 m
with no note; a stair whose ends do not meet its floors or whose treads are
shorter than a cell; a stair or lift laid over a wall, earth or a closed
room, or reaching into two rooms on a floor; an entrance not on
a floor, or no room reached from it; rooms overlapping by more than 5% of
the smaller; a reconstructed room more than 10% outside the model at its
floor's eye height (a voxel's slack); a placed work whose room or wall does
not resolve; a file over 640 KB, a floor over 400,000 cells or 400 rooms.

It warns of a documented room outside the model, rooms with no way in known
yet (in the walk, a room of those that holds saved works is come into by a
cut, no doorway drawn, and the banner says "no way in is known yet · placed
here"), a cut's length, a door narrower than a walker, a ceiling above the model's roof, works overflowing into a second tier,
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

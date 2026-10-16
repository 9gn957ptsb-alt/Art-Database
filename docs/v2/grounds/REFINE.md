# Refining the cities — the standing pass

The artist's standing ask (8 Oct 2026): "Right now when I click on a city on
the Artist Website it's rather pixelated, I want to make sure that over time
this is getting refined to be as up-to-date with the current status as
possible." A city pressed on the globe opens as its skyline
(`docs/v2/skyline.js`): its ground, `grounds/city-<key>.json`, a square of
3–8 km cut into cells — land, water, street, green or building, each building
cell its storeys and its year — drawn in dots of DIRT, in true isometric,
rising with the city's dial. The first cut was about 40 m a cell (a block of
Manhattan was two or three dots); the cities' pass cuts each city finer, reads
it again from the newest open data, and dates it, a few cities a day. A
scheduled session follows this page each time it runs. It works on the branch
`claude/artist-website-dev-s92irf` — pushing there publishes the Artist
Website.

## What makes a city better

| | how the pass moves it |
| --- | --- |
| **its grain** | Tiers of cell size (`GRAINS` in `scripts/build_city_places.py`): 0 is the first cut (~40 m, 96–144 cells a side), then **28 m, 20 m, 14 m**, never more than **576 cells a side** (finer than that is under a device pixel on a phone at rest). A cut costs about the same at any grain, so a first cut is raised straight to 20 m, then to 14 m; 28 m is where a city goes when 20 m is over the budget. Each run raises a few cities, the coarsest first, then the most important (cities.json's order: the most museums and works first). |
| **its currency** | Every ground says which Overture Maps release it was read from (`release`) and when (`read`). Overture publishes about monthly; a city read from an older release than the newest is read again, the oldest read first. New buildings, demolitions, heights and parks come with it. |
| **its years** | Each cut is dated by `scripts/build_built_years.py` (the cities' own records, the runners' records, Wikidata, EUBUCCO, OpenStreetMap, then the satellites). Where a source that dated the last cut does not answer this time, the last cut's years are carried over cell by cell and the ground says so (`builtCarried`); the next runs date it again (three tries at most before its next cut), so a source that failed one day is not lost to the city's grain. Where a city's records were read on GitHub's runners for the old grid (`records/years/`, `records/census/`), the pass asks them again (`records/REQUEST`) and dates the city again once they are in (`--redate`). |
| **its green** | Parks, gardens, lawns, pitches, cemeteries and woods (Overture's land use and land) are cells of their own (`"g"`), drawn as the soil grown over, so Central Park, the Tuileries and Hyde Park read. |
| **its coverage** | A city without a skyline still opens on the globe's own cells (~39 km each), the most pixelated of all: the next cities in order without one (cities with museums, then cities of galleries busy enough to be named on the globe; 111 in all, 16 read by 8 Oct 2026) are read each run, at 20 m. |
| **its towers** | A cell says up to 260 storeys (832 m, `MAX_STOREYS`). It stopped at 74 (237 m) until 14 Oct 2026, when every tower above that — the Empire State Building, the Willis Tower, the Eiffel Tower, the CN Tower — was found standing at one height (11 of the 25 skylines then). And Overture's heights are mostly missing (Brussels: 93% of 100,000 buildings; a cell then stands at two storeys) or a landmark's own is a podium's or a machine's (the Willis Tower 31 m, Trump Tower 60 m, the Tour du Midi 19 m): so a landmark takes the height Wikidata gives it (`scripts/wikidata_heights.py`, CC0: `P2048` normalised to metres, the preferred statement, never a deprecated one; `P1101` floors only for a skyscraper) — the cells of the building its point stands in, within 22 m (or 1.5 cells) of the point, where the building's own height is missing or at most two thirds of it and 12 m lower. In Spain and France a cell that stands at the default two storeys takes its building's height from EUBUCCO's register (`scripts/eubucco_heights.py`, ODbL: Spain's Catastro floors, France's BD TOPO; the files are the ones the years are read from, `data/eubucco/`) where that is a storey higher or more — Madrid's cells at two storeys went from 64% to 17%, Paris's from 34% to 10%; EUBUCCO's heights for Brussels are not a register's (their median is 6 m, r = 0.35 with Overture's), so they are not used there or anywhere else — nor in Basel, which EUBUCCO's rough box for France takes in (its heights: median 7.5 m against Overture's 12.8, r = 0.37, 32% within 3 m): a place's slug must end -es or -fr (`eubucco_storeys`). `build_grounds.py --heights` does it for the grounds cut before (the taller of the old and new height; a ground cut or repaired so says it: `heights`, and from what: `heightsFrom`). |
| **its bridges** | A road was drawn over land only, so a river ran unbroken from bank to bank (the Han, the Seine, the Thames, the Rhine under the Hohenzollern Bridge). Overture flags a bridge on its segment (`road_flags` or, for a railway, `rail_flags`: `is_bridge`, the whole segment or the stretch between two fractions of its length): the road and main-line rail bridges of a city's square are drawn over its water, at the water's height (`bridge_mask`; footbridges, paths, trams and subways are left out, as their streets are). `build_grounds.py --bridges` does it for the grounds cut before (`bridges`). **Water that is dry:** a reservoir of half a square kilometre or more that Overture's land cover (ESA WorldCover, which has no water in it) covers four fifths of is land (`dry_basins`; Dallas's Trinity River Floodway, 1.9 km² of its square, had been a lake). |
| **its parts** | A building mapped in parts (Overture's `building_part`, OpenStreetMap's building:part: tiers, towers, legs, spires, each with its top and, where it floats, its `min_height`) is drawn as them. Each cell takes the tallest part over it, not the whole footprint the building's top height: the Empire State Building was 37 cells at 138 storeys and the Eiffel Tower 27 at 103, one slab each; now the eleven tiers, and four legs, two platforms and a needle. A part off the ground (an arch, a skybridge) adds height to the building's own cells, never new ones; a tower or a mast thinner than a cell stands in the building's cell nearest it (a part under a twenty-fifth of a cell says nothing a cell holds); where no part reaches, the building's own height stands, unless that is the whole building's top (mapped on the outline for renderers that draw no parts: then its lowest part on the ground, its podium), and where the parts stop short of it (the Campanile's pyramid and angel) their tallest stands at it. Where a building's parts are mapped and its own height is missing, the parts are the height (Stockholm's Hötorget towers had stood at two storeys). `build_grounds.py --heights` brings it to the grounds cut before — up or down for the cells of a building with parts (`parts`), as a cut does. A low, wide landmark (under 60 m, over 10,000 m²: the Colosseum, a hall) takes Wikidata's height over its whole footprint, not within 22 m of its point. |
| **its tunnels** | A road in a tunnel is not on the ground: Overture flags it on its segment (`road_flags`: `is_tunnel`, the whole segment or the stretch of it between two fractions of its length) and the stretch is left out of the road cells (`surface`), so the park, the square or the river over it shows (Madrid Río over the M-30, Boston's Greenway, Stockholm's motorway tunnels, the quais of Paris). `--heights` cannot bring it to a ground cut before (what lay under the road was not kept in it): a city has it from its next cut (`tunnels` in the ground), 15 Oct 2026 on; a `--tunnels` repair is the weakest list's to do. |

The page draws a city on the GPU (WebGL 2): every dot a square of the device's
own pixels, depth-tested, a building cell's storeys one strip, so a city of
half a million cells turns at 24 frames a second; without WebGL 2 the city is
drawn as it was, from its ground made no finer than 160 cells a side. The
clod's edge goes down into the soil from the ground it holds, to the base
(until 14 Oct 2026 it hung from the plain, so a hill — Los Angeles's 272 m,
drawn four times higher — stood over a black gap), and a step in the ground
inside it (a bluff over the water, a steep hill) is skirted down to its lowest
neighbour (`skirt`; Seattle's shore had a black seam): look at a hilly or
shored city's walls and shores from each heading when the drawing changes.
Water is drawn in the sea's own soil (DIRT's, woven from the saved paintings'
blues), a third of whose swatch is hole: where a water cell has no dot it is
the sea's deep tone at the width of its commonest dot (`SEA_DEEP`, 15 Oct 2026),
not black, so a lagoon (Venice's, half its square) or a bay reads as water, not
as black voids between patches of blue; land keeps its black pores.

## Each run

1. **Start clean.** `git fetch origin claude/artist-website-dev-s92irf` and
   merge it (never rebase; other sessions push here too). What the scripts
   import is installed where it is missing by `scripts/needs.py`, which
   `refine_cities.py` runs first (pyarrow, shapely, numpy, pillow, tifffile,
   imagecodecs, pyproj, pyshp, h3 — `h3` finds EUBUCCO's files, France's and
   Spain's years: without it they "do not answer").
2. **Date again** what the runners have read since the last run, and the
   cities whose years were carried because a source did not answer:
   `python3 scripts/refine_cities.py --redate`.
3. **The plan:** `python3 scripts/refine_cities.py` prints it — new cities,
   cities raised a tier, cities read again from a newer release — and stops.
4. **The run:** `python3 scripts/refine_cities.py --run` (by default 3 new,
   3 raised, 1 read again — a read-again turn goes to one more raise until a
   city is at the finest grain; `--new`, `--raise`, `--refresh` change it; a
   run takes about 4–8 minutes a city, longer where a city's records are
   read). A run first reads again, for their heights and bridges alone, the
   grounds that lack them (`build_grounds.py --heights`, `--bridges`: a ground
   cut with them, or repaired, says so and is passed over at once; one cut
   while Wikidata or EUBUCCO did not answer is tried again; `--heights` reads
   the grounds a few at a time, one pass over Overture's index for six cities,
   and brings the building parts to the ones cut before — a city's tunnels
   only a new cut can). Commit after each city if the run is long.
   For each city it rewrites `cityplaces.json` at the city's new grain, reads
   its ground (`build_grounds.py --only city-<key> --force --release latest`),
   dates it, keeps the cut only within the budget (`BUDGET`: 2.6 MB a file,
   420 KB as GitHub Pages sends it) and writes `docs/v2/grounds/ledger.json`.
   A city over the budget is tried a grain coarser, else held at its grain
   (`held` in the ledger, with why) and not raised again. Its report ends with
   the keys it changed. If a merge conflicts on a city's ground, take the
   remote's file: the next run puts the ledger right by the grounds as they
   stand (`reconcile`).
5. **Check in a browser:** serve `docs/` (`python3 -m http.server 8911
   --directory docs`), then `NODE_PATH=$(npm root -g) node
   scripts/check_skyline.js --port 8911 --shots /tmp/cities <changed keys>`
   (Playwright is installed; do not run `playwright install`). It opens each
   city at a phone's size and a desktop's: drawn on the GPU at the screen's
   density, made in time, its museums named, the dial's first years standing
   less of it, a museum pressed going in and back. Then
   `node scripts/check_skyline.js --2d --sizes 1440x900x2 <one key>` for the
   fallback. Look at every screenshot. A check that fails is fixed, or said in
   the report with what failed and why — never reported as passed.
6. **Look, and fix the biggest mismatches.** For every changed city, the new
   ones too, against
   what is known of it now (Overture, OpenStreetMap, the city's own maps and
   photographs where they can be reached), write down the five biggest
   mismatches, most important first — water where there is land, a park
   missing, a district flattened, towers too low or too tall, a landmark
   missing, a museum off its building — and fix what can be fixed in the data
   or the drawing, generally (in `build_grounds.py`, `skyline.js`), never by
   hand for one cell. Say in the ledger's log what is still wrong.
7. **If the drawing lacks something** (a kind of ground, a material), add it
   to `skyline.js` small and general, in the file's own voice, and run the
   check on every city with a skyline (`check_skyline.js` with no keys).
8. **Record and publish.** Commit `docs/v2/grounds/city-*.json`,
   `docs/v2/grounds/ledger.json`, `docs/v2/cityplaces.json`,
   `docs/v2/cityartists.json` and `records/REQUEST` if it was written ("Cities:
   <names> finer; <names> read again"), and push. If the push is refused,
   fetch, merge and push again. A push touching `records/REQUEST` runs the
   city-records workflow on GitHub's runners; the next run dates those cities
   again.

## Keep

- Nothing private: Overture Maps (ODbL, largely OpenStreetMap), the Terrain
  Tiles on AWS, and the open records `build_built_years.py` reads. `data/` is
  never committed.
- The ground is the city as it is now; the years are when it went up. A cut
  never loses years a source gave: what did not answer is carried and said.
- The same rules as the buildings' pass: efficient and quiet — nothing redraws
  at rest; a file grows only to show more of its city.
- The buildings' pass (`docs/v2/models/REFINE.md`) no longer grows the
  skylines; this pass does.

## Where the grounds are weakest (15 Oct 2026)

What a source or a change in the drawing would improve most, from the grounds
as they stand (counted from each ground's `tall` and `built` by
`python3 scripts/ground_stats.py`). Look here first when choosing what to fix.

- **Heights.** Over half of the building cells stand at the default two storeys
  in Shanghai (96%: Overture gives a height for few of its buildings), Antwerp
  (86%), Brussels (83%), Tokyo (77%), New Haven and Seoul (74%), Basel (67%),
  Toronto (66%), Cologne (55%), Milan and Rome (51%): Overture has a height for
  few of their buildings and no register of them is read (Wikidata's landmarks
  and the buildings' parts are; EUBUCCO's registers only for Spain and France).
  Copenhagen's building register (BBR) and Basel's (GWR) date their cells and
  probably hold floors too: not read for heights yet. No open register of
  China's building heights is read (a candidate for `NETWORK.md`).
- **Parts.** Read since 15 Oct 2026, so a building mapped in parts has its
  tiers, legs and spires. About a tenth of New York's and Toronto's building
  cells took their parts' heights (10,916 and 3,281), 4-7% of Berlin's, Boston's,
  Chicago's and Madrid's, 1% of Tokyo's and Basel's, under 1% of Seoul's,
  Shanghai's and New Haven's (29,702 cells in the 24 grounds repaired in place,
  16,801 taller and 12,901 lower): where OpenStreetMap maps no parts a tower is still one slab of
  its footprint at its top height. A part thinner than a twenty-fifth of a cell
  is not drawn (a mast or a spire a cell wide stands only where Wikidata or the
  building's own height gives its top), and a tower's footprint is a cell at
  least: Torrespaña (231 m) is a column 20 m wide.
- **Years.** Under a tenth of the building cells are dated in Seoul (7%),
  Dallas (8%), Venice (6%), Shanghai (6%), Munich (5%), Antwerp (5%), Cologne
  (4%), Tokyo (4%), Toronto (3%) and New Haven (2%): only Wikidata's landmarks,
  OpenStreetMap's dates and the satellites' (1975 on) reach them. OpenStreetMap's
  dates (`osm/dates/`) have been read for only 16 of the 31 skylines, the first
  16 cut: Antwerp, Basel, Cologne, Dallas, Munich, New Haven, Philadelphia, Rome,
  Seoul, Shanghai, Stockholm, Tokyo, Toronto, Venice and Vienna have none. Ask
  the osm-dates workflow again with `osm/REQUEST` (write the day in it): it reads
  every place on the globe again from Geofabrik and commits `osm/dates/` (72 MB,
  read twice so far, 27 Sep and 8 Oct), so ask when several places wait, as
  these 15 do. This pass does not make that run. `--redate` then dates a city
  again once its `osm/dates/` file was read on or after the day it was last
  dated (since 14 Oct 2026). Brussels is 47% dated: 12% by the satellites'
  "between 1930 and 1975" year (1952), the rest by its heritage inventory,
  OpenStreetMap, Wikidata and the satellites' later years; the other 53% have no
  year and stand from the dial's first. Stockholm (21%) has no Swedish register
  read, Washington (82%) none for the federal and exempt buildings the
  assessor's AYB leaves out.
- **Tunnels, bridges and streets.** A tunnel is left off the surface from a
  city's next cut (`tunnels` in its ground: Stockholm, Venice, Shanghai, London,
  Paris, Washington and Los Angeles have it); the other 24 skylines still draw
  theirs on the surface, over parks and squares (Overture flags 70 motorway
  segments in a box round Madrid Río, 36 round Boston's Greenway, 15 under
  downtown Seattle), until they are raised to 14 m or read again from a newer
  release. To fix them without a cut: a `--tunnels` repair that reads the
  water, the green and the road segments again, six cities to a pass, and sets
  the cells that were road and are not now to what lies there (green where the
  green polygons hold them, else land) — what lay under the road is the same
  polygons' answer, so it would be a new cut's, without the buildings, the
  terrain and the years (about 90 s a city). Bridge decks,
  flyovers, elevated rail and the subway are drawn at ground or water height,
  with no piers, arches or cable stays. A street is a whole cell wide wherever
  it is kept (a 6-10 m lane at 20 m reads twice as wide).
- **Water.** A water cell with no dot in the sea's soil is its deep tone now, so
  a lagoon or a bay reads as water; but Overture's water has no minor canals
  (Venice's rii and Amsterdam's grachten under 20 m are gaps between buildings,
  not water cells: a canal is a one-cell ribbon the blocks hide from most
  headings), and a river's width is the cell's at best.
- **A city's square** is chosen to frame its museums (build_city_places.py), not
  its skyline: Shanghai's (7.1 km round the Yuz Museum) stops at 31.226 N, short
  of the Bund and Lujiazui; London's at 0.088 W, short of the Shard and the
  City's towers.
- A source for any of these is looked for by the network research
  (`NETWORK.md`) and, where it is on a host the session cannot reach, read on
  GitHub's runners (`scripts/fetch_city_records.py`).

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

The page draws a city on the GPU (WebGL 2): every dot a square of the device's
own pixels, depth-tested, a building cell's storeys one strip, so a city of
half a million cells turns at 24 frames a second; without WebGL 2 the city is
drawn as it was, from its ground made no finer than 160 cells a side.

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
   read). Commit after each city if the run is long.
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

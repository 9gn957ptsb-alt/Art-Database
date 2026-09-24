# DIRT Earth

DIRT's rainforest was built from the shapes of a rainforest: crowns at three heights, and the ants on the floor, the
snakes and butterflies of the understory, the monkeys in the crowns and the eagle's shadow above, each at its own
height. DIRT Earth does the same for every place on Earth. Every place is built from its own shapes: its plants and
animals, the months of its year, its clouds and rain, how far one sees there, and every other way an environment is
sorted into its hierarchies. Its colours are still the saved paintings'.

There are four parts:

| part | what it is | where |
|---|---|---|
| the atlas | what is known of every quarter degree of the Earth, month by month | `build_atlas.py` → `out/` |
| the grammar | for every kind of place, the shapes DIRT builds it from | `grammar.py` → `out/grammar.json`, [GRAMMAR.md](GRAMMAR.md) |
| DIRT Earth | DIRT's plane, become the Earth, each place grown from the atlas and the grammar | `engine/`, built into DIRT by `../build_soil_viewer.py --earth` |
| the globe's dress | every place's paintings, month by month, for the Artist Website's globe | `site_textures.py` → `site/` |

## The atlas

On the Artist Website's own grid: 1440 by 720 cells, a quarter degree each, column 0 at 180 W and row 0 at 90 N
(the grid `scripts/build_earth.py` rasterises the coastlines on). Every layer is a PNG whose channels
`out/atlas.json` explains, with its lists of names and its sources.

| hierarchy | layers | from |
|---|---|---|
| life | realm › biome › ecoregion (848 ecoregions, 15 biomes, 8 realms) | RESOLVE Ecoregions 2017 |
| climate | Köppen-Geiger class (29 present), Holdridge life zone (36 present) | derived from the monthly means |
| the year | twelve months of mean temperature, rain, snow cover or sea ice; the annual and daily temperature ranges; rain's seasonality | NASA POWER climatology (MERRA-2) |
| sky | twelve months of cloud amount and cloud regime (eleven: deep convection, trade cumulus, stratocumulus deck, coastal fog, storm track, polar stratus, orographic, cirrus, fair cumulus, broken, clear); cloud optical depth; clear days; aerosol haze | NASA POWER (CERES SYN1deg), regimes derived |
| view | how far one sees (Koschmieder, from the haze), openness, and a big-sky index | derived |
| ground | elevation, relief within the cell; canopy height; aridity (rain over Thornthwaite's potential evaporation); soil order and its colour | AWS terrain tiles; MERRA-2; derived |
| water | lakes, rivers, glaciers and ice shelves, salt flats, reefs, wetlands | Natural Earth |
| sea | depth zone (shelf, slope, abyss, trench), sea ice, reefs, upwelling, gyres; warmth | derived |
| names | named regions (deserts, ranges, basins, plains) and seas | Natural Earth |

`python3 where.py 47 -108` reads a place out of it. It gives, for example, Montana's Northern Shortgrass prairie as
BSk cold steppe on mollisol, its months from -4 to 24 °C, 435 mm of rain a year, and a 69 km view. Its big-sky index
of 0.45 is higher than 65% of the world's land; DIRT Earth calls a sky big above 0.4.
`python3 preview.py` draws each layer as a map (`out/preview-sheet.png`).

## The grammar

[GRAMMAR.md](GRAMMAR.md) is the research, written out from `grammar.py`. For each of the 15 biomes it gives:

- the strata of its plants and the shape of their crowns from above;
- its ground, and how it turns through the year;
- the look it wears in each season;
- its life at each height, as a kind of behaviour DIRT animates, with species realm by realm.

The sea's eight zones get the same treatment. There are 752 plants and animals in all. They are the examples that
characterise each biome, as WWF/RESOLVE and the standard ecology references describe it: what DIRT draws and names,
not a checklist.

## DIRT Earth

In [DIRT](https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k), "Earth" opens a globe woven of dots, like the Artist
Website's, each place's dots in the paintings nearest its own colours for the month. Pointing at it tells what the
atlas knows about the place; clicking goes down into it.

Down there the plane is the Earth. A quarter degree is 233 cells, a passage's width, so a degree is 932 cells.
Swiping east goes east, and going on round the Earth comes back to the same places with other trees. Every cell
belongs to a place of the atlas. Where one place gives way to another, the edge wanders by up to 144 cells and is
dithered across 13, so two places meet as two sprayed colours do.

- **Plants.** Every biome's strata grow on the lattices of their spacing, from grass tussocks every 3 cells to
  emergents every 233. Their crowns seen from above come in these shapes:
  - broadleaf domes lobed in fives and eights;
  - conifer points, eight-branched, lit on the sunward side;
  - flat umbrella acacias standing high, so their shadows lie far off;
  - palms, cactus columns, tussocks, cushions, rosettes of thirteen leaves, reeds leaning with the wind, and
    mangroves.

  Trees thin where the atlas's canopy is low, so farmland thins the forest it stands in. Grass and shrubs thin with
  aridity.
- **Ground.** Leaf litter and moss. Dunes across the wind, gentle up and sheer down, their crests streaming sand.
  Desert pavement, salt polygons, ice-wedge polygons, scree and boulders. Crevasses and sastrugi on the ice. Tidal
  mud laced with channels, coral heads, and swell running with the wind. Lakes, and rivers winding between the
  atlas's river cells. Mountains are ridged as far as their relief runs and shaded by their elevation.
- **The year.** Each biome's year sets the phase of every place for the month. Broadleaves are fresh in spring and
  turn and fall in autumn. The savanna goes gold in the dry season, and the Mediterranean green in the wet winter.
  The desert flowers after rain. Snow lies in drifts as far as the month's snow cover goes, and sea ice breaks into
  floes with leads between. Shadows are as long as the month's noon sun at that latitude makes them. Where the sun
  does not rise it is night, and above 60 degrees an aurora hangs over it.
- **Colour.** Each place wears the saved paintings nearest its look for the month. The paintings are ranked by how
  near their three colours come once DIRT has turned them toward the look (by at most the golden angle, as DIRT's
  outskirts turn colours) and brought their colourfulness toward it (by 1/phi to phi). Each passage wears one of the
  five nearest. The sea wears the blue out of a painting, as the website's sea does. No colour is painted that the
  collection does not have.
- **Life.** The rainforest's fourteen kinds, and sixteen more:

  | kind | what it does |
  |---|---|
  | herds | graze, then move on in files |
  | hunters | shadow them and at times run at them |
  | colonies | termite mounds, burrows popping, penguin crowds |
  | swarms | insects dancing, locusts sweeping |
  | waders | stab in the shallows |
  | vees | geese in spring and autumn |
  | soarers | vultures on thermals, with their shadows |
  | schools | fish flash as they turn |
  | whales | come up, blow and dive |
  | floes | drift, as ice or sargassum |
  | grass waves, blowing sand, dust devils | moved by the wind |
  | falling leaves | in autumn |
  | grass fire | creeps through the dry season and leaves a scar |
  | bioluminescence | lights the sea in the polar night |

  Each creature is a species of its place, named when pointed at, and stands out from its ground as the rainforest's
  do.
- **Weather.** The month's clouds pass over in their regime, sprayed in dots, with their shadows below:
  - towers in deep convection;
  - streets of trade cumulus;
  - the closed honeycomb of stratocumulus decks;
  - fog lying smooth, polar stratus, frontal bands, wave clouds and cirrus strands.

  Rain or snow falls as hard as the month's rain. A haze lies over the ground, as thick as the view is short.
- **Pointing** tells the ecoregion and everything above it:
  - realm › biome, Köppen and Holdridge, the soil;
  - canopy height and elevation, and where the year stands;
  - the month's temperature against the whole year's range, and its rain against the year's;
  - cloud and its regime, clear days, how far one sees, and whether the sky is big;
  - what is under the pointer: the creature, the plant, or the ground.
- **The months** turn by hand or by themselves ("Year"). Each chunk of ground grows again in the new month. Where the
  ground is painted on the GPU, the new month sweeps over the old from the middle of the view, in shapes of each
  passage's character that build up and break down; otherwise it fades in over the old.
- **Colours that change.** Where the ground is painted on the GPU, each place also moves among the five paintings
  nearest its look, a change about every 89 seconds, in the same shapes (see the DIRT README). It never leaves them,
  so a place always shows its own conditions.

The default plane is unchanged. With every Earth script loaded in the same workers, its chunks hash as they did
before (the fingerprint test). Earth chunks are identical whichever worker grows them, in whatever order.

## For the Artist Website's globe

The globe on the Artist Website is woven of DIRT's dots. Each land dot reads `dirt-land.png` and each sea dot
`dirt-sea.png`, a 256-cell tile going round the world twice. `site/` holds the same dots dressed for every place
and month, in two forms (`MM` is 01 to 12):

- **`earth-dirt-MM.png`**: 720 by 360 RGBA, half a degree a cell, column 0 at 180 W and row 0 at 90 N. It is DIRT's
  own dots (`dirt/out/collection-soil-dots.png`, read exactly as `weave()` reads it now) coloured in each place's
  paintings for the month. The colour is the dot's colour and the alpha its size (0, 85, 170, 255), as in the site's
  tiles. It covers land and sea, so it can stand in for both tiles on the globe:

  ```js
  var E = dirt.earth[month];                               // { w: 720, h: 360, px }
  var u = Math.floor((lon[k] / TAU + 0.5) * E.w) % E.w;
  var v = Math.min(E.h - 1, Math.floor((0.5 - lat[k] / Math.PI) * E.h));
  var o = (v * E.w + u) * 4, size = Math.round(E.px[o + 3] / 85);
  ```

- **`earth-palette-MM.png`**: 720 by 1080, the same grid three times over. The top band holds each place's dark
  colour, the middle band its middle colour and the bottom band its light colour. This is for a city's own weave,
  closer than half a degree. Keep reading the fine dots from the square tile, and dress each dot in its place's
  palette as DIRT Earth does:
  - take its lightness `l` (0.3 R + 0.59 G + 0.11 B);
  - `t = clamp((l - 34) / 144, 0, 1)`, and on even ground (sea, lakes, ice, snow, salt, sand seas)
    `t = 0.42 + (t - 0.42) / phi`;
  - read the colour at `t` from the stops `[dark / phi², dark, middle, light, light + (255 - light) / phi]`, placed
    at `[0, phi⁻⁴, 0.42, 1 - phi⁻⁴, 1]`.

Only colours are in these files: no titles, no artists, and nothing of which painting went where, the same line the
site's own tiles keep to. `site/preview-year.png` shows the twelve months. For naming places on the globe,
`out/place.png` with `out/atlas.json` gives the ecoregion, biome and realm of any cell (see `where.py`).

## Closer: the streets

Below DIRT Earth's ground (a cell is about 120 metres) the Earth goes on down to its streets (`engine/earth-city.js`).
Closer, a pinch, ctrl and scroll, or `+` goes down at the middle of the view; scrolling, pinching or `+` and `-`
go nearer or further, dragging moves, and going further out than the ground's own scale (or Up, or Escape) comes
back up to the ground, wherever the streets were left.

The streets are OpenStreetMap, as vector tiles from OpenFreeMap (no key; the page fetches the tiles it needs,
at most z14, magnified beyond that), drawn in DIRT's own language rather than as a map:

| from the tiles | drawn as |
|---|---|
| the ground | the place's own palette this month (DIRT Earth's), laid as dots |
| parks, woods, grass, sand, ice | the palette's body or its light, over the dots |
| water, rivers | the lake palette, each edge a grey gradient |
| roads, paths, rail | the paper's light (rail in the dark), edged in the gradient; paths dashed |
| buildings | raised by `render_height` (a metre up is half a metre on the screen), each in one artist's shade from dark to light, its faces lit by the light that turns once in 377 seconds, casting its shadow, every edge a grey gradient |
| attractions, monuments, memorials, museums | named in italic, when near enough |

So in Washington the Monument stands 169 metres, the Capitol's dome over it, the Lincoln and Jefferson Memorials
and the White House each at their height, all named. Near the ground's own scale the ground of DIRT Earth shows
through, magnified to the streets' scale and to true proportions, and the streets' own ground comes up over it as
they come nearer. The credit (© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors) is always shown.

A page that may not fetch from elsewhere (a claude.ai artifact) says the streets could not be reached. Set
`window.DIRT_CITY_TILES` to a template (`…/{z}/{x}/{y}.pbf`) to take them from somewhere else.

## The Artist Website's edition

The website's globe is DIRT Earth's globe (see above), and going down into a city goes on into DIRT Earth there
and on to its streets. The website carries its own edition of the page, built with `--site`:

- its one soil is the site's own dot tile (`docs/v2/dirt-land.png`, which the globe is woven of), not the cutouts,
  so no painting is in it but as its three colours (`works` keeps only `colors`; titles, artists, links and the
  joins' sources are left out, and nothing is named on pointing);
- it opens at `#earth=lat,lon,month`, hides the plane, and its Globe button goes back up to the website
  (`postMessage({dirt: "up"})`), as does going further out than the ground;
- the website moves it with `postMessage({dirt: "goto", lat, lon, month, streets})`.

```sh
python3 dirt/build_soil_viewer.py --earth dirt/earth/out --site <website>/docs/v2/dirt --dots <website>/docs/v2/dirt-land.png
# or, for a change to the engine alone (no private plane needed):
python3 scripts/splice_dirt_engine.py
cp dirt/earth/site/earth-dirt-*.png dirt/earth/site/earth-palette-*.png <website>/docs/v2/earth-dirt/
```

## Building

```sh
python3 dirt/earth/build_atlas.py --cache <somewhere> --out dirt/earth/out   # 3 to 5 minutes; downloads about 470 MB to the cache
python3 dirt/earth/grammar.py --out dirt/earth/out --markdown dirt/earth/GRAMMAR.md
python3 dirt/build_soil_viewer.py --earth dirt/earth/out                     # DIRT with the Earth; its files go to dirt/private/earth/
python3 dirt/earth/site_textures.py --plane dirt/private/plane/plane.json    # the globe's dress, into dirt/earth/site/
```

The page reads its Earth from the files beside it (`earth/*.png`, `earth/meta.json`, written by `page_files.py`).
They must be published with it: served from the same place, not from `file://`.

## Sources

| data | from | licence |
|---|---|---|
| realms, biomes, ecoregions | Dinerstein et al. 2017, An Ecoregion-Based Approach to Protecting Half the Terrestrial Realm (RESOLVE Ecoregions 2017) | CC BY 4.0 |
| monthly climate: temperature, rain, snow, sea ice, wind, canopy displacement height, soil wetness | NASA POWER climatology, from MERRA-2 (NASA GMAO) | public |
| monthly cloud amount, optical depth, clear days, aerosols | NASA POWER, from CERES SYN1deg (NASA LaRC) | public |
| elevation and bathymetry | Terrain Tiles on AWS (Mapzen; SRTM, GMTED2010, ETOPO1 and others) | see their attribution |
| land, lakes, rivers, glaciers, salt flats, reefs, named regions and seas | Natural Earth | public domain |

## What the data cannot say

- **Google Earth** could not be used. The session that built this cannot reach google.com, because its network
  policy refuses it, and Google Earth's imagery may not be mined in any case. Everything here is open data instead.
  It describes each place's conditions rather than photographing it.
- **Under the Greenland and Antarctic ice sheets** the terrain tiles give the rock, not the ice. The readout says so
  there ("the rock under the ice lies at -62 m").
- **The climate** is MERRA-2's half degree by five eighths, and CERES's one degree, eased onto the quarter-degree
  grid. Mountains and coasts finer than that are smoothed.
- **Soils** are worked out by rule from climate, biome and terrain, since SoilGrids could not be reached. The view
  distance is a model built from haze and clear days. Canopy height comes from MERRA-2's displacement height, which
  is coarse and near nought over grassland; that is why trees outside forest biomes thin with aridity instead.
- **The species** are what characterises each place, not everything that lives there.

### The website's places on the ground

The site's edition carries the Artist Website's own places. The site sends `{dirt: "places", list: [{id, lat,
lon, name, kind}]}` (its collages and the layer its globe's filter shows); DIRT Earth draws each as a mark at its
spot, and points to the nearest ones off the screen from the top of the view, with their distances; pressing one
glides (or, far off, flies) there, and pressing a mark posts `{dirt: "open", id}` back. `{dirt: "chrome", on:
false}` hides the bar and the marks, for when the site lays the ground behind one of its buildings.

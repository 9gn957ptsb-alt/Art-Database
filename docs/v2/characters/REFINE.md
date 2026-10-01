# The characters — the daily pass

The artist, 1 Oct 2026: "Just like there is a daily update through the
architecture (daily) session in which a certain number of buildings get
updated every day, I want the same rules to apply to a daily update of
characters." A scheduled session follows this page each time it runs, on the
branch `claude/artist-website-dev-s92irf` — pushing there publishes the
Artist Website.

What a character is: one animal from DIRT's grammar of places
(`dirt/earth/out/grammar.json`, `dirt/earth/GRAMMAR.md`: each biome's life by
height, with species per realm and a kind of behaviour), drawn after one of
DIRT's artists (`dirt/artists/` — `twombly.json` here, the roster on the DIRT
branch: `git show origin/claude/digital-dirt-layers-paiial:dirt/artists/roster.json`),
in DIRT dots that take the soil of wherever it stands. It comes out of the
wave of pixel light in a city, and two plantings rise with it: the city's
own plants (`plants.json`, worked with the city's soil) and, among them, the
plants of its artist's home (in the artist's inks, outlined in chalk).

**The correspondence** (the artist, 1 Oct 2026: "Establish a correspondence
between the Artist associated with animals and plants and where their
artwork is located throughout the world … When an animal comes up that is
associated with an artist, I want you to be able to use that animal as an
additional way to navigate through the globe"). Each artist has a map in
`artists.json`: every city where the artist's saved works are held or have
been, in route order from home, and the home itself (Wikidata, `homes.json`).
A character comes to the cities on its artist's map (the first wave there
brings it); elsewhere only now and then (1/φ³), as a guide toward the
nearest. Pressed, it offers **Follow**: the city's column becomes the
artist's map, every press on one of the artist's cities is a journey with
the animal running ahead and the artist's works riding first, and it waits
by the museum or gallery that holds the work.

## Files

| | |
| --- | --- |
| `characters.json` | the cast (id, name, species, kind, where in the grammar it is from, the artist and why, inks, added, refined, passes, notes, log) and the backlog |
| `scripts/characters/<id>.py` | the drawing: its parts as distance fields, its poses (`draw.py` is the small flat renderer: ramps, light from the upper left, Bayer dither, selective outline) |
| `<id>.json` | its poses, a letter a cell, written by `python3 scripts/build_characters.py` |
| `plants.json` | every city's (and every artist's birthplace's) biome, realm, ecoregion, soil and plants, by stratum with crown shapes, written by the same script |
| `homes.json` | where each artist (cast and backlog) was born, worked and lived, from Wikidata (CC0), with the source; written by `python3 scripts/fetch_artist_homes.py` (network; the artist's item is the one `fetch_history_wikidata.py` matched, in `data/wikidata/matches.json`) |
| `artists.json` | each artist's map — works, cities in route order, the museums holding the works, where the animal waits, and home with its plants — written by `build_characters.py` from public files |
| `docs/v2/characters.js` | the page: when one comes, how it moves, how it is drawn |
| `scripts/preview_character.js` | draws a character large, every pose, on the soil of six cities with their plants |

## Each run

1. **Start clean.** `git fetch origin claude/artist-website-dev-s92irf` and
   merge it (never rebase; other sessions push here too).
2. **One new character** from the top of `backlog` in `characters.json`.
   - The backlog pairs each roster artist not yet drawn with a species from
     the grammar, of a biome and realm where the site's cities are (count them
     in `plants.json`: Palearctic and Nearctic temperate forest, the
     Mediterranean, the prairie, the conifers, the deserts …). When it runs
     short, add pairs so that the cast spreads across realms and kinds of
     behaviour (a hunter, a herd, a flock, a troop, a hoverer, a slow
     crawler …) — no two of the same kind in a row — and say in `why` what
     ties the animal to the artist's hand: a work, a series, a way of marking.
     The roster grows every week on the DIRT branch; read it each run.
   - Draw it in `scripts/characters/<id>.py` the way `fox.py` is drawn: side
     on (or from above, for what DIRT sees from above — a flock, an eagle's
     shadow), at most 40 by 26 cells, two CSS pixels a cell. Poses: its own
     real gait in four frames, a stop, a look (at you), and one rest of its
     own (sitting, perching, coiling). Inks from the artist's measured works
     (`twombly.json` for Twombly, the roster's `palette` for the others); the
     artist's grammar where it can show (Twombly's looping writing, Matisse's
     cut edge, Pollock's flung dots …) — in the drawing or in what it leaves
     behind, never as decoration.
   - Add it to `cast` with `added` and `refined` today, `passes: 1`, its
     notes and a first log line; take it off `backlog`; run
     `python3 scripts/build_characters.py`.
   - **Its artist's map and home plants, the same day.** A new backlog
     artist (one not yet in `homes.json`): run
     `python3 scripts/fetch_artist_homes.py` (Wikidata must be reachable),
     then `build_characters.py` again. Check `artists.json` for the artist:
     the works count against the artist's thread in `finding.json`, the
     cities in a route that reads (nearest first from home), the museums
     holding works against `museums.json`, and `home` — its `where` and its
     plants (`plants.json` set: biome, realm) — against the artist's
     Wikidata item. A home Wikidata does not give stays empty; say so in the
     character's `notes`, never fill it by hand. Where the grammar gives
     the home's biome wrong plants (Cody, Wyoming reads as desert, with
     saguaro), say so to the DIRT session.
   - Optionally `inks.home` (three colours, dark to light) for the plants of
     home; without it they take the drawing's black and its writing inks.
3. **Refine three.** Take the **three** characters refined longest ago
   (never the one added today; all of them while there are fewer). For each,
   at least three rounds:
   - render: `NODE_PATH=/opt/node22/lib/node_modules node scripts/preview_character.js <id> /tmp/<id>.png`;
   - write down the five biggest mismatches, most important first, against
     the real animal (proportion, silhouette, the gait — which feet are down
     in which frame, the head's carriage, the markings) and against the
     artist's hand (inks, mark, grammar);
   - fix them in its `.py` (or, for how it moves or is coloured on the page,
     in `characters.js`), rebuild, re-render, compare. Refine rather than
     restart.
4. **Record.** Set each refined character's `refined` to today, add one to
   `passes`, add a line to its `log`, and update its `notes` (what changed,
   what is still guessed).
5. **Check in the page.** `python3 -m http.server --directory docs`, open
   `/v2/` at 390×844 and 1440×900, go down into a city on the new
   character's artist's map (Find on the Museums layer; its first city in
   `artists.json` with a museum), press and hold on the ground and let go:
   the wave, then the character steps out of it and both plantings rise
   round the ring (the city's own, and home's in the artist's inks); press it
   and the line says what it is, whose hand, from where, and the two
   plantings. **Check following works for it**: press Follow — the column
   opens on the artist's map and the banner reads "following <artist>";
   press another of the artist's cities: the journey, the animal running
   ahead along the way, the artist's works among the riders; arrived, it
   waits by the museum or gallery holding the work and the plantings rise
   round it; into the museum and back up keeps following; pressing the
   animal lets it go; up to the world ends it. Also a city off the map
   (force the guide: `Math.random = () => 0.1` just before the wave): its
   line names the nearest city of the artist and which way. No page errors.
   Then commit ("Characters: <new>; refine <names>") and push; if refused,
   fetch, merge and push again.

## How the cast comes onto the page

- **One at a time, never two.** A wave in a city on artists' maps brings the
  character of one of those artists; in a city on no map, now and then
  (1/φ³) one from the whole cast, as a guide. While one is out (or being
  followed) no other comes.
- **At most once a visit to a city**: the first wave there. After one has
  gone, none comes anywhere for φ⁸–φ⁹ s (47–76 s).
- **Only in a city** — a collage's city with the collage put away, or a city
  on the Museums layer — never while a collage is being read, a flight is
  on, or in a museum or building.
- **Nothing under reduced motion.**
- A new character changes none of this: the cast grows, the rhythm stays.
  The artist's standing steer is "go a little bit easier … it still
  gimmicky" (23 Sep 2026), and what brings people back is finding things, not
  decoration — so a character is found, not shown: it is not named until it
  is pressed, and then it says what it is, whose hand it is in, and what
  plants it came up among.

## Keep

- Public files only; nothing from `data/`, no network in the build, the same
  bytes every run.
- Nothing links off the site.
- The plants are the place's own, and among them the artist's home's, both
  from DIRT's grammar; never invent a plant or an animal that is not in it,
  and never a home that is not sourced. Where the grammar is thin for a place
  (Sydney's temperate forest is given tree ferns, southern beech, kahikatea
  and rimu — no eucalypts), say so to the DIRT session rather than patching
  it here.
- Timings follow the site's golden ratio and its held frames (24 fps light,
  8 fps gaits).

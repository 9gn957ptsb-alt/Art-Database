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
wave of pixel light in a city and the plants that rise with it are always
that city's own (`plants.json`), never the character's.

## Files

| | |
| --- | --- |
| `characters.json` | the cast (id, name, species, kind, where in the grammar it is from, the artist and why, inks, added, refined, passes, notes, log) and the backlog |
| `scripts/characters/<id>.py` | the drawing: its parts as distance fields, its poses (`draw.py` is the small flat renderer: ramps, light from the upper left, Bayer dither, selective outline) |
| `<id>.json` | its poses, a letter a cell, written by `python3 scripts/build_characters.py` |
| `plants.json` | every city's biome, realm, ecoregion, soil and plants, by stratum with crown shapes, written by the same script |
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
   `/v2/` at 390×844 and 1440×900, go down into a city (Find on the Museums
   layer: London), press and hold on the ground and let go: the wave, then a
   character steps out of it and its plants rise round the ring; press it and
   the line says what it is. No page errors. Then commit ("Characters: <new>;
   refine <names>") and push; if refused, fetch, merge and push again.

## How the cast comes onto the page

- **One at a time, never two.** A wave brings one character, dealt at random
  from the whole cast; while it is out no other comes.
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
- The plants are always the place's own, from DIRT's grammar; never invent a
  plant or an animal that is not in it. Where the grammar is thin for a place
  (Sydney's temperate forest is given tree ferns, southern beech, kahikatea
  and rimu — no eucalypts), say so to the DIRT session rather than patching
  it here.
- Timings follow the site's golden ratio and its held frames (24 fps light,
  8 fps gaits).

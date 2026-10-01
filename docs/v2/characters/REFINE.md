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
| `walks.json` | the walks published for everyone, two per character from its artist's map (`python3 scripts/build_walks.py`) and any the artist publishes; played by `docs/v2/walks.js` |
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
     behind, never as decoration. The roster's `grammar` number names the
     hand (0 a field, 1 stripes, 2 dots, 3 a net, 4 strokes, 5 rings, 6
     stacked fields, 7 scattered marks, 8 poured stains, 9 cut shapes);
     `draw.py` has the paints already made for some: `strokes` (de Kooning's
     bison), `flat` and `offset_line` (Warhol's eagle, printed out of
     register), `unline` with `raster(..., deep=".")` (Matisse's squirrel,
     cut paper with the ground between the pieces); the deer's `net`
     (Hockney) and the slug's `bands` (Kapoor's stacked fields) are in their
     own files. The pose names are roles the page reads: `trot` is its gait
     (four frames, whatever the gait is: a walk, a bound, a wingbeat, a
     crawl), `stand`, `back` its pause (a look back, grazing, sitting up),
     `look` (at you), `sit` its rest. Put the inks in the drawing's `INKS`
     too, so the quick preview works before it is in the cast.
   - Give it `moves` in `characters.json`: `speed` (× the fox's trot: the
     bison 0.62, the squirrel 1.7, the eagle 2.6, the slug 0.16), `fps` of
     its gait, `pause` (`"back"` or `null`), `leave` (`"edge"`, off along
     the ground; `"rise"`, up and away, with `lift` its flying height in
     CSS px; `"sink"`, back into the soil after φ⁶ s, for a slow one), and
     `trail` (`"writing"`, Twombly's; `"slime"`, Kapoor's trace; or none).
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

## The walks

The artist, 1 Oct 2026, on "a trail you follow is an essay without words.
Save a following as a route someone else can walk: 'Twombly by fox, 32
cities'": "fantastic, really great stuff, implement that". `docs/v2/walks.js`
plays them; `walks.json` here holds the ones published for everyone.

- **A new character gets its published walks the same day.** After its
  artist's map is in `artists.json`, run `python3 scripts/build_walks.py`: it
  writes, for every character of the cast, its artist's route
  (nearest-first from home, "Twombly by fox") and the same cities as the
  work travelled (by the year the artist's works first came there),
  three works a stop at most, earliest first. Check one in the page: a walk
  played from the animal's column flies to its first city, the animal
  waits by the work, and the work comes up with its first lines said.
- **A walk code the artist sends** (as `fox·8GD2-0MSN-J9CT`: the animal, then
  the walk) **becomes a published walk**: open the page, and in the console
  `Walks.decode("<code>").then(w => console.log(JSON.stringify(w)))`; if it
  says `stale: true` the map has changed since it was kept — ask him to walk
  it again. Otherwise add it to `walks` in `walks.json` as `{id, title, artist,
  animal, by, stops}` with **his** title (ask if he gave none), `by` as he
  wants it named (never "the route", which the build rewrites), and the
  stops as decoded (`key`, `works`, `s`). `build_walks.py` keeps it on every
  run. Never put a code or a walk in a URL: the site has one link.
- The walks follow the reading's clock and never hurry: change the timings
  only in `walks.js` and say why.
- **A walk is a sentence** (the artist, 1 Oct 2026: "A walk as a sentence
  is a great idea. Seeking the poetic aspect from the very forms defining a
  path of travel is directly applicable to continuing to find new ways to
  make interesting connections"). Each stop is a word, its city; lingering
  is the punctuation (nothing opened: a dash; under 34 s, two median looks:
  a comma; more: a full stop; the last word a full stop); a line ends at a
  full stop and holds five words; three stops are a tercet; a city said
  again is a refrain, in italics. `walks.js` writes it (as the walk is
  walked, in the strip; finished, kept, and in the column) and
  `build_walks.py` writes the same into each published walk's `sentence` —
  keep the two in step. Two walks ending on the same city rhyme; failing
  that, two sharing a word: each is offered as the other's rhyme. A new
  character's walks get their sentences when `build_walks.py` runs.

## How the cast comes onto the page

The artist, 1 Oct 2026: "I want there to be other animals besides the fox
as well. Perhaps attributing artists to their hometown is a good way to
introduce new animals to scenes when on route of an artwork. It's okay to
have more than one animal present at a time, but too many can be
overwhelming and distracting."

- **The wave.** A wave in a city brings, first, the animal whose artist was
  born there; else one whose artist's map the city is on; in a city on no
  map, now and then (1/φ³), one from the whole cast, as a guide. The first
  wave of a visit only; after a wave's animal has gone, no wave brings one
  for φ⁸–φ⁹ s (47–76 s).
- **Hometowns.** An artist's home town is the city of the site within 25 km
  of the birthplace (`artists.json` `home.key`, by `build_characters.py`:
  Brooklyn → New York for Elaine de Kooning, Pittsburgh for Warhol,
  Bradford → Leeds for Hockney, Mumbai for Kapoor; Twombly's Lexington and
  Matisse's Le Cateau have none). The animal lives there:
  - a **journey arriving** there (a door, Near here, a history's stop, a
    walk, following) is met by it — it comes in from the side the journey
    came from (a slow one comes up out of the soil there), stands by the
    city's middle, looks, sits, and after φ⁶ s goes on;
  - a **journey passing over** it (a town the way names as it passes)
    shows it there, small (one screen pixel a cell), far below, looking up,
    for as long as the town is named (3.2 s);
  - a **work's history** that has been there shows it, small, sitting at
    that stop, after the work's first look (9 s), until the history is
    left;
  - **going down into it any other way**, it is there at rest, sitting, one
    visit in φ² (38 %), until pressed or the visit ends.
- **A crowd, never.** At most two on a phone and three on a desktop on the
  screen at once, the followed one counted; a second never comes within
  φ³ s (4.2 s) of the last; each animal once a visit to a city. Each keeps
  its own place: none stands within 120 px across and 44 px up or down of
  another, nor under the city's column, the dial of years, the banner, the
  walk's strip, or a museum's diamond and name (`seat` in characters.js).
  The nearer (lower) is drawn over the farther. A walk's animal is asked
  for, so it is always let in: the one out longest makes way.
- **Two that meet.** One that comes while another stands still goes to it
  and stands beside it, facing, a little lower. If their artists' saved
  works share a thread (`artists.json` `pairs`: a show, else an owner, a
  writing, a sale, a museum, the rarest first), a line between them, under
  them or over them where there is room, says it — "American bison and
  bald eagle · de Kooning and Warhol: both offered in Heritage: Modern &
  Contemporary Art (November 29, 2018)" — the thing itself a door to its
  thread (`Land.thread`). Once a visit a pair; nothing is said where
  nothing is shared.
- **Only in a city** for the wave and the home ones (a collage's city with
  the collage put away, or a city on the Museums layer); the far ones only
  from a journey or a history. Never while a collage is being read.
- **Nothing under reduced motion.**
- A new character changes none of this: the cast grows, the rhythm stays.
  The artist's standing steer is "go a little bit easier … it still
  gimmicky" (23 Sep 2026), and what brings people back is finding things, not
  decoration — so a character is found, not shown: it is not named until it
  is pressed, and then it says what it is, whose hand it is in, and what
  plants it came up among.

## The chimera

The artist, 1 Oct 2026, of the exquisite-corpse relay: "really work on the
three Artist Chimera, it should be the most refined and well portrayed
character on the entire site. It's gotta be good, like really good"; and:
"Yeah build it that way, I like the idea of ritual and using the animals to
generate games".

Any three of the cast make a chimera: the head of one, the body of another,
the hindquarters of a third (`scripts/characters/chimera.py`; the page lays
them together, `Characters.chimera`). So **every new character is drawn in
three parts the day it is drawn**:

- In its `<id>.py`, besides `poses()`, give `rig(pose, k, slot="body")`: the
  whole figure, as parts, in each of the chimera's poses — `walk` (k 0–5, a
  walk's phases: near hind 0, near fore ¼, far hind ½, far fore ¾), `stand`
  (k 0 still, 1 and 2 its idles: a breath, a blink, an ear, a tail), `back`
  (its pause), `look` (at you), `rest`, `present` (proud, for the unfolding),
  `act` (k 0–3, its instinct from the ethogram) and `ritual` (k 0–1) — and
  how far it is lowered at rest. `slot` lets a part be drawn again for its
  place in a chimera (the bison's finer head, the eagle's walking body).
- `SEAMS`: the x of its neck's fold (the head and neck forward of it) and its
  hip's (the hindquarters behind it), each with a height inside the body
  there. Put the neck's fold at the base of the neck so the whole head goes
  with it; the hip's just forward of the hip joint. `CHIMERA_SCALE` makes a
  small animal (the squirrel, 1.45) the size of the rest.
- Mark legs with `limb(parts, "body" | "hind")` so they are drawn whole when
  they step past a fold. A raster finish (`finish`, or `finish_chimera`)
  runs on each part as on the whole.
- A character that is not one body (a murmuration) gives one of the flock
  for its parts.
- Write its `ethogram` and its `chimera` words in `characters.json` (below).
- Check: the whole animal's poses unchanged where they were (compare the
  rows), then `NODE_PATH=/opt/node22/lib/node_modules node
  scripts/preview_character.js <new>,eagle,slug /tmp/c1.png`, and the new
  one as body and as hindquarters (`bison,<new>,fox`, `fox,deer,<new>`):
  each must read as one creature, the masses running on across the folds.
  Fix the part's drawing or its `SEAMS`, never the agreed marks — changing
  `NECK`/`HIP` redraws every chimera. A part may be drawn differently for
  its slot (`rig(..., slot)`): the stag's head and neck are grown (`HEAD_K`
  1.3, `NECK_K` 1.75) with a dark eye and pale muzzle, so a stag's head does
  not read thin on a bison's body; the squirrel's head carries its own marks
  (the ear's long tuft, a cream eye-ring, the chin, the nose), its body two
  papers (a darker back over the coat), and its tail as hindquarters is
  scaled down (`CHIMERA_SLOT_K`); the fox's pounce, cut at the folds, is a
  smaller lift and a short tip, not the whole fox's arc.

**The ethogram** (each character's row in `characters.json`): its documented
behaviours, never invented — `name`, `what`, `source` (a published study or
a standard natural history; a widely told observation is said to be one),
`role` (`instinct`, the game's rule for that animal's leg; `play`, an idle;
`ritual`, when two meet), `pose` (which pose shows it) and `said`, one plain
line ("the squirrel buried something here"). Its `chimera` words name it in
a chimera: `head` an adjective ("Bowed"), `body` a noun ("Mantle"), `hind` a
clause ("That Leaves a Trace") — "The Bowed Mantle That Leaves a Trace" —
and `gaze`, `carriage`, `pace`.

**The canonical chimera, drawn fine** (`scripts/characters/canonical.py`,
`docs/v2/characters/parts/canonical/bison-eagle-slug.json`). The bison, eagle,
slug chimera is not cut from the parts: it is a drawing of its own, traced
from references made with OpenAI's gpt-image-2.5 (one design, then every pose
an *edit* of it, so all of them stay in register: stand, present (the wing
raised), mantle, wind (the head into the wind, a breath of vapour), walkA,
passB, walkB, passA, look, rest, settle) and kept outside the repository.
The tracer takes each reference down to two grids — large, 8 source px a
cell, about 190 cells long, for the unfolding (≤ 3 CSS px a cell); small, 21
px a cell, about 73 long, for the city and the globe (4/3 CSS px) — and to a
restrained palette of the three artists' inks (`INKS`: de Kooning's cave
dark, umbers, burnt and pale ochre, warm grey; Warhol's plum plates, his
yellow key, the feet; Kapoor's four pigment bands, the violet foot, the
trace). Each cell first takes an artist (whose inks most of its pixels are
nearest, the dark ones abstaining; nothing right of `hip` is the slug's),
then one of that artist's inks. Then by hand, in code: orphans folded into
their neighbours, stray hairs and pinholes cleaned; Warhol's line found where
the reference draws it thin, kept as `key` (round the plates, not round the
feet, not where the head meets them) and `inner` (the feathers' edges,
printed fainter), and printed a cell off register on the page; the eye found
by its light (a dark round it, its light at the upper left; small, one dark
cell and its light before it); talons hooked at each toe's end; the belly
behind the slug's cut filled with the deepest plate; the folds where the
stand puts them (`largeFolds`, `smallFolds`), every pose shifted (`dx`) so its
slug meets the hip's fold there. Rows are run-length coded, so no ink is a
digit. The page lays over the poses what lives: a blink, a breath (the back
up a cell), the slug's ripple (a crest a cell high running back, the foot
paled under it) and its trace drying in steps behind it.

To redraw it: generate or edit references (the edit endpoint keeps the
register; at most five reference images a minute), add a pose to `POSES`,
`python3 scripts/characters/canonical.py REF_DIR`, and check with
`preview_character.js bison,eagle,slug out.png --fine`. A new pose the page
should use goes into `fineNow` in characters.js. Another triple drawn fine is
another file and one more key in `FINE`.

**Refining the chimera.** Each day, after the three characters, take the
canonical chimera (bison, eagle, slug) and one other triple at random, and
refine as the characters are refined: render them
(`preview_character.js bison,eagle,slug --fine` for the canonical one, its
references beside it), list the five biggest flaws
against the references (the artist's own works; the generated design
references are kept outside the repository) and against the three artists'
hands (de Kooning's leaning strokes, Warhol's flat plates and off-register
line, Kapoor's stacked bands), fix them in the parts' drawings, at least
three rounds. Log it under the three characters whose parts changed.

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

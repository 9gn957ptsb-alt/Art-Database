# The exquisite corpse

`corpse.js`, `corpse.css`, `corpses.json`; `scripts/corpse_code.py`,
`scripts/build_corpses.py`, `scripts/corpses_sent.json`.

The artist, 1 Oct 2026, approved "the exquisite corpse" relay and its
refinement: "Go ahead and build it", and "Yeah build it that way, I like the
idea of ritual and using the animals to generate games".

## The game

- **The fold.** Handed a corpse, you see only its edge: the last stop of the
  leg before — one work, one city, one year — under a crease ("one leg folded
  under"). You walk your leg on from there.
- **Three legs** (head, body, hindquarters). A leg is two or three stops, each
  a work in a city in a year the record has it there (`places/<key>.json`).
  The next stops are offered three at a time: where the work went next, where
  it came from, the cities next door, a squirrel's cache, a slug's trail.
- **The animal.** Each leg is carried by an animal: the one followed, else the
  animals of artists whose works have been in the edge's city (marked), else
  any not yet in this corpse. It is chosen for the player, never asked: the
  animal followed, else the one whose artist the leg has met most (counted
  over its edge and its stops); "carried by the bison · change" under the
  fold is the quiet way to choose another before folding.
- **The instincts** (one rule each, said in one line):
  - fox — mousing pounces face north-east (Červený et al. 2011): offers lean
    north-east.
  - red squirrel — scatter-hoarding: at the fold the leg buries one of its
    works; it is hidden from this corpse and surfaces, as an offer, in someone
    else's game near there ("a squirrel buried this here in October").
  - banana slug — trail-following: it prefers others' slug trails and leaves
    one, drawn faint on the globe while a corpse is being made; a corpse with a
    slug leg unfolds at φ² the tempo.
  - bald eagle — mantling: the next player sees only the year; its stops are
    few (two) and far (1,500 km or more where it can).
  - American bison — faces into the blizzard: stops are offered from later to
    earlier years (it walks back along where works came from); each stop
    leaves a wallow, a small depression in the ground, drawn in that city.
  - red deer — the antler cycle by the real month: in rut (Sep–Nov) it goes
    where the crowds are; hard antlers (Dec–Mar) near ground; cast (Apr) a
    short leg; velvet (May–Aug) each stop a little further. Its picture in the
    panel freezes when the pointer comes near, and its head in the chimera is
    the month's (`head@cast`, `head@velvet` in `characters/parts/deer.json`).
- **The sentence.** Leg one's first city, the rarest verb in leg two's record
  (sold, offered, made, held, kept, showed, listed), leg three's last title:
  "Sarajevo showed *Clouds, Sun and Sea*." No article before a title (a title
  is a name: "London sold *The Battle of Love*", "held *Under a Palm Tree*");
  `build_corpses.py` keeps the same rule. True in parts, never whole.
- **The unfolding.** The whole route at once on the globe, each leg its tone,
  the world first turned, rolled and drawn back until all three legs are in
  view (`Land.frame(points)`, held still while the corpse is out; `Land.unframe`
  when it is put away), and only after 3.4 s of that the chimera, presented
  large at the middle over a calm ground (the world dimmed behind it, a band
  of its soil under its feet); it holds its settled rest 4.2 s before it walks;
  the chimera (`Characters.chimera([head, body, hind], {seed, month})`, else
  drawn here from `characters/parts/`) is presented large, each part acting
  out its parent's instinct in turn, then walks the route; the sentence comes
  word by word at 4, 9 and 16 s. Keep (it joins the viewer's explorations as
  a three-stanza relay), Share (the code), Put it away.
- **Rituals.** Two completed chimeras whose routes share a city — one of them
  the viewer's — meet when the viewer is in that city: `Characters.meet(a, b)`
  where it exists, else they approach, bow and stand facing; the line names
  what their works share (the rarest common thread: a show, a sale, an owner, a
  writing, a museum; else a city), a door.
- **Playing alone.** Find, "corpse": *Start a corpse* (the edge of a published
  hunt or walk, matched to the city you are in; that exploration is leg one),
  *Begin one here* (you walk the head), *Go on with yours*. Between legs:
  *Walk the next leg*, *Let the site walk it* (a published exploration through
  the edge, else the animal walks it by its own instinct), or pass the code.

## Codes

`corpse·` + Crockford base 32 in fours: version 3 bits, check 5, legs 2; each
leg its animal 4 (cast index), site-walked 1, stops 3, buried 1 (+ the buried
stop); each stop its work 13 (finding.json), city 10 (cities.json), year 11
(from 1000). One leg of three stops is 25 characters; two legs 47; a complete
corpse 70, 77 with a squirrel's buried work (+7 for `corpse·`, + dashes).
Pasted into Find on any device: an incomplete one shows only its edge and is
continued; a complete one unfolds. A stale check is said, not played.

## Publishing a corpse a visitor sends

1. `python3 scripts/corpse_code.py CODE` — check it decodes, three legs, and
   the check holds.
2. `python3 scripts/build_corpses.py --add CODE --by "Name"` (credit "a
   visitor" unless a name is given; `--month` sets a squirrel's burial month).
   This appends the decoded corpse to `scripts/corpses_sent.json` (ids, so
   later index moves never change it) and rewrites `docs/v2/corpses.json`:
   `made` (listed in Find, its chimera living on its route's cities), `caches`
   (its squirrel's buried work, surfacing in others' games), `trails` (its
   slug's), `wallows` (its bison's).
3. Commit both files.

## Weak

- The chimera's metamorphosis is the characters' module's; until
  `Characters.chimera` lands this module lays out the cut parts itself.
- A published leg one is its exploration's last two or three stops before the
  edge, not a player's choices.
- Offers depend on recorded movement (`places/` rows' came-from and went-next);
  a city with few recorded journeys offers mostly its neighbours.

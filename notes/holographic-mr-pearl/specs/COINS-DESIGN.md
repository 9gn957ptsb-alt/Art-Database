# Coins, guards and half the space: the design (22 Oct 2026, a design workflow of three proposals judged and merged; not built yet)


# Coins, guards and half the space: the design to build

**Base: Design 2.** It has the most literal size rule ("the *surrounding* space down in half"), which all 51 places pass. Its coin is a Sonic ring built of the unit at the head's size. Its guard count comes from the place (one per room the works hang in), and its grab feeds the existing alarms.

**Grafted:**
- From Design 1: the cityPark fix (measured: without it only 11 of 28 cities crash in a park at 192); the two way-in coins at thirds (Sonic's line of rings); the gold arc to the next coin; `#near` used for coins and guards; a grab's tell.
- From Design 3: coins laid before the homage, so they do not depend on whether a homage is there; the field search stopping early.

**Dropped:**
- Design 1's rule that the head only *holds* coins until the body follows. It works against "collect the coins in either the holographic mode or 3rd person mode".
- Design 1's flat 128 m and Design 3's 128 m with a retry. At 128 the plot fills the world, the neighbourhood lots are gone in 41 of 51 places, and the Walt Disney Concert Hall fails.
- Design 3's stacked-figure guards (they would not read as people) and its six-box shader change (it puts the shards at risk).
- Edge-of-screen marks for guards. The `#near` text line does the same job and is accessible.

Checked by reading the code (place.js, rocket.js, homage.js, pearl.js) and Design 2's Node run (`/tmp/claude-0/-home-user-Art-Database/bb1e51d3-b72c-5e27-a28b-1a19c049dcee/scratchpad/relations-agent-7f3/rsur.txt`). No repo file was touched.

---

## 1. Half the space (place.js)

**Rule:** halve the surround and keep the model whole: `size = min(S0, ceil16((S0 + span) / 2))`.
- `S0` is today's size: 256, or for a museum `max(320, min(512, ceil16(span + 200)))`.
- `span = max(spanX, spanZ)`, the model's site turned.
- This is one line in `makePlace`. The `min(S0, …)` keeps the three museums already cut at 512 from growing.

**Measured on all 51 escapes in the Artifact:**
- Sizes: 144 m in 4 places, 160 in 43, 176 in 3, 192 in 1 (Disney).
- Every model whole.
- A real crash site in every place: 14–53 m from the door, 37–71 m from the world's edge.
- The homage and the studies' row (4 stones) planned in all 51.
- Building all 51 takes 3.4 s instead of 6.0 s. The block texture at 160 is 3.3 MB instead of 8.4 MB; chunks drop from 256 to 100.
- holoTop rises from 379 to 404 m (`sqrt(FAR² − S²/2)`).

**Unchanged:** the plot ring (14 m: 3 level, 11 eased), keepOut (site/2 + 15), findCrash (22 m from the edge, 16 m clear of the footprint, about 24 m from the door), crashSite (14/11), the homage and studies searches.

**Cities** (not in the Artifact): `makeCity` goes to `World(192, 192)`.
- `cityPark`: scale its `blds >= 40` and `min(140, blds)` by `share = ((2R − 3) / (2R0 − 3))²`, where `R0 = floor(192 / G.c)` is the window it had at 384. This is Design 1's fix, with the window per city instead of a fixed 529.
- `hideBlock`, cities only: outer limits × SX/384 (park 130 → 65, square 120 → 60, tree 140 → 70). Inner limits stay, because they belong to the crash site, which stays whole.

## 2. The ten coins

### What a coin is
The head's outline, built of the unit: a flat ring of his cells (`unitH()` = φ⁻⁷ = 3.44 cm), the same kind of grid as the thrown pearl.

| measure | value | relation |
|---|---|---|
| outer radius `RO` | 7 cells = 0.241 m | `round(headR / cell)`; the head's radius 0.2457 to within 2%. The head meets a coin of its own size |
| hole `RI` | 3 cells | `THROW.RU`: a pearl passes through it |
| thickness | 2 cells | the step below 3 on the ladder 1, 2, 3, 5, 8 |
| cells | 248 in one 14 × 14 × 2 grid | the check prints it |
| colour | `#daa06c` | `paletteIds.rib`, the guitar rib's gold, in the shader's three tones |
| spin | a turn per 2·BEAT (0.96 s) about the vertical, all ten on one clock | edge-on twice a turn = 2.08/s, under WCAG 2.3.1's 3 at any size (a turn a beat would be 4.2) |
| reduced motion (`stillMotion`) | still, face turned to the camera | DISPLAY.md 2.3.3 |
| height | centre at standing floor + 1 + `headY` (1.372 m) | his head passes through its middle |

**Contrast:** gold against plaster is about 1.8:1. The dark faces (0.42 × gold) are about 7:1 against plaster and 3.7:1 against the sky, so the coin passes 1.4.11 through its dark faces. The tally and the Notes list are the text alternative.

### Where the ten go: `Pl.coins(place, paintings, {wake})`
New in place.js, no DOM, no random draw. The same place and seed always give the same ten. The seed matters only through which works hang. It runs in `start()` after `Pl.hide` and before `Homage.plan`. Each coin is `{id, kind, x, y, z, text}`, with `id = kind + "@" + x + "," + z`.

**Inside, five:** before the five largest works hung (`sz` area).
- The coin goes at the reading spot: the column one block out from the work's wall, at the work's middle.
- No two within REACH (6 m, his reach); a work too close is skipped for the next.
- If fewer than five fit, the rest go on the room floor farthest from every coin laid so far, largest rooms first.
- If there are no rooms, they go to the garden rule below.
- Design 2's prototype: 30 of 51 places get five before works; 20 need one to four room coins.

**Outside, five:**
1. and 2. **The way in:** at one third and two thirds of the line from `wake` (`underTree()`) to `place.door`, on the nearest standing column along that line. This is Sonic's line of rings leading you in, and the first coin comes 5–18 m from waking.
3. **The highest roof** over `M.foot`: not glass, air over it (hideBlock's roof test), ties go to the one nearest the crash. Stack blocks to reach it, or go as the hologram.
4. **The pool's middle** (`M.pool`, the cell nearest its centroid), at head height over the water. With no pool, the open grass of the plot (not footprint, at least 8 m from the crash) farthest from the coins laid so far.
5. **The crown of your tree** (`place.tree.top + 1 + headY`).

**Words, for example:**
- "before Roses (Vincent van Gogh, 1890), the largest work hung here, 71 × 90 cm"
- "a third of the way in, from your tree to the door"
- "on the highest roof of Casa CM, 14 m up"
- "over the middle of the pool"
- "on the crown of the tree you woke under"

**`seatCoins()` (rocket.js, after the homage and studies set their blocks):** a coin whose standing cells are now solid is raised onto the top.

### Taking one: `coinsStep(dt)`
Called in `frame` after `physics`/`holo`.
- **Body** (no head out, or the head still lifting): the coin's centre within 0.3 + 0.241 = 0.54 m of his axis (0.3 is boxHits' half-width), from P.y − 0.24 to P.y + `PEARL.top` + 0.24.
- **Head** (phase `free`): the segment from last frame's centre to this one within headR + 0.241 = 0.487 m. It has to be a segment: at HOLO_V (22.5 m/s) the head moves 1.1 m in a 0.05 s frame.
- **Nothing is taken** during `follow` (the body carried to the head), the films, or the launch.
- A coin taken as the head counts at once: "he can collect these coins". `barred()` stays for everything else.
- **`takeCoin(i)`:** push the id to `got`, `store()`, `say(...)`, `drawPieces()`. It then draws the gold arc to the nearest coin not yet taken: `y = lerp(yA, yB, s) + d·s(1 − s)`, the 45° throw's arc (apex d/4), 32 segments in `trailProg`, fading over a BAR (1.92 s). Under reduced motion it is static and then cleared.

### Tally, words, save
- **Header:** `<p class="coins" id="coins">Coins 3 of 10</p>` after `#pearls`, styled as `.pearls`. No aria-live: the toast (`role=status`) speaks each coin, so nothing is said twice. Hidden in cities, as the alarms are.
- **Notes:** a "Coins" list in `drawPieces`, each coin's words, ticked when taken. This is the text alternative for something seen only in 3D.
- **`#near`:** a coin shows when it is nearer than the current target: "↗ A coin · 14 m up".
- **`awake()` the first time,** after the pieces' line on a `setTimeout` as `collect` does: "Ten coins lie in and round {name}: five before its largest works, five outside — on the way in, the highest roof, the {pool|garden}, your tree's crown. Ten build the rocket, as the four pieces do."
- **When taken:** "A coin, 3 of 10: {words}." The ninth: "One coin left: {words}."
- **Tapped** (`coinAt(dir)`, a ray–sphere test within LOOK, before `pick` in `act` and in the crosshair tag): "{words}. A ring of the unit as wide as your head, its hole a pearl's. {n} of 10 taken." Tapping does not take it.
- **Save:** `store()` adds `coins: got` (ids, so the save survives reordering). `start()` restores `(s.coins || [])`, keeping only ids that exist. Coins are kept when you are put out.

## 3. The people trying to grab him: the guards

**Who:** the guards the alarms already bring, now seen.

**How many:** `Pl.guards(place, paintings)`: one per room the works hang in, on the ground floor (`rm.floor === 0`), at most 3 (one per alarm). `hangable` deals works over the 3 largest walled rooms. Design 2's count was 3 guards in 38 places, 2 in 9 and 1 in 4; the check reprints it with the floor rule. No guards in cities.

**Drawn cheaply:**
- His own part grids, already on the card, minus `guitar` and `hat`: 8 parts.
- Palette: every id → the drawing's grey 0.5, so their faces take the drawing's white, grey and black.
- Posed by `PB.pose(body, phase, amount, {arms})` with each guard's own walked distance.
- Their head is a built sphere of his cells, radius 7 (1,472 cells in one 14³ grid, `headGrid()` as `pearlGrid`). The perfect sphere stays his alone.
- At most 27 draws, culled beyond 90 m (as the paintings are), no veil pass.
- `drawPearl`'s part loop is pulled out into `drawParts(M, x, y, z, face, pal, skip)` and used by both.

**Constants (`GUARD`):**

| | value | relation |
|---|---|---|
| round speed | 1.64 m/s | WALK/φ² |
| chase speed | 2.66 m/s | WALK/φ: he outwalks them by φ, the hologram outflies them |
| sight | 9 m, across 70° | LOOK (a label's distance), FOV (the game's own view) |
| eye | 1.62 m | EYE |
| reach | 1.22 m between centres, \|Δy\| ≤ PEARL.top | boxHits 0.3 + a step (leg 0.618) + 0.3 |
| tell | 0.48 s | BEAT |
| hold after a grab, grace | 1.92 s each | BAR (Sonic's 120 frames ≈ 2 s) |

**How they move:** `Pl.field(place, x, z, stop)`, no DOM, gives an Int16 step count over `M.plot` columns.
- A column's stand is its lowest cell with solid under it and two clear above. The stand is cached and cleared for a column when `remeshAt` changes it.
- A neighbour is walkable if it is 8-way (corners only when both sides are open) and within one block up or down. Never water, never off the plot.
- The search stops once every chasing guard's column is reached.
- A guard steps to its least neighbour, kinematic (no boxHits), easing y over a step (STEP_T), and keeps one step from the other guards.
- **Round:** the reading spots of its room's works in hanging order, a beat's pause at each. One field per leg.

**How they find him (`sees(g)`):** within 9 m and 35° of the guard's facing, on a clear line from its eye to his head's centre. The line passes air, water and `w.SEE` blocks (glass, leaves), sampled every 0.25 m. Checked on the existing 250 ms `slowAt` tick.
- **Seen:** toast "A guard has seen you." The field is computed from his column, again only when his column changes.
- **Unseen for a BAR:** the guard finishes the last field (to where he was seen), then goes back to its round.
- **He stands where they cannot walk** (water, two blocks up, off the plot): they stop and face him. These are safe places he can see.
- **A wrong look behind a work** (`lookBehind`) sends every guard to that work.
- **`#near`, top line while any guard chases:** "↙ A guard · 6 m". It covers the camera's blind back.
- **Tapping a guard:** "A guard of {room}: it sees 9 m across 70°, walks at your walk over φ, cannot climb two blocks, swim, or hold your head."

**A grab (`grab(g)`):** in reach, its arms rise over a BEAT. If he is still in reach at the end of the beat:
- an alarm sounds (●);
- his last coin taken goes back to its place along the arc (Sonic's ring loss, one ring);
- that guard holds still for a BAR (he walks 8.3 m in that time), and no guard grabs again within a BAR;
- toast: "A guard has hold of you: an alarm, and your last coin goes back {words}. {n} more and the guards walk you out."
- the third alarm is `putOut()` as now: alarms quiet, under the tree, everything found kept, guards back on their rounds (in `lieDown`).

**The hologram:**
- The head is never seen or grabbed: it is light.
- While the head is out they watch and chase the **body** (its seat point as the target).
- Once, when a guard comes within LOOK of the body: "A guard is nearing your body: Holo, and it follows your head."
- A grab of the headless body calls `harmBody("guard")`, which gets the rule its comment already states: the head is pulled home and he comes to under his tree (`lieDown(["The guards have your body.", "You come to under your tree again.", title])`), alarms quiet, his last coin back.
- No grab during `follow`, the films, the launch, or the grace.

## 4. Ten coins = the rocket built
- New `ready() = found.length === 4 || got.length === COIN.N`.
- `buildRocket`: `found.length < 4` becomes `!ready()`.
- In `takeCoin`, at the tenth: `if (!built) buildRocket(true)` (the quiet path, so it works as the hologram), then: "The tenth coin: the rocket stands on the wreck's ground. Launch when you are clear." As the head, add: "Leave the hologram to launch: your body rides it." If it was already built: "Ten coins: the rocket already stands."
- `start()` restore: `if (s.built && ready()) buildRocket(true)`, after coins are restored.
- `launch()` unchanged. It already refuses the hologram, so the body must go: leaving as the hologram does not count.
- The Build button stays the pieces' own.
- `finish()`: with `found.length < 4` the lede says "The rocket your ten coins built is climbing out of the air over …".
- The space game is left out.

## Functions

| file | add / change |
|---|---|
| place.js | change `makePlace` (size line), `makeCity` (192), `cityPark` (share), `hideBlock` (city outer limits). Add `coins`, `guards`, `field`, and export them |
| rocket.js constants | `COIN = {N: 10, RO: round(PEARL.headR / unitH()), RI: THROW.RU, T: 2, SPIN: 2*BEAT}`; `GUARD` as tabled |
| rocket.js coins | add `coinGrid`, `seatCoins`, `coinsStep`, `takeCoin`, `coinAt`, `drawCoins` (as `drawPearls`), `drawArcs` (beside `drawTrails`), `ready` |
| rocket.js guards | add `headGrid`, `initGuards`, `guardsStep` (frame's `!launched && !flying` branch), `sees`, `grab`, `drawGuards`, `drawParts` (pulled out of `drawPearl`) |
| rocket.js changed | `start`, `store`, `awake`, `lieDown`, `lookBehind`, `harmBody`, `act`, `overlay` (`#near`, the crosshair tag), `drawPieces`, `buildRocket`, `finish`, `frame`, `Rocket.debug` (coins, take, guards, field ms) |
| index.html / rocket.css | `#coins`, `.coins` |
| README.md, CLAUDE.md Rocket row | sizes, Coins, Guards (now seen) |
| scripts/check_coins.js | new (below) |

## Tests
1. `node scripts/check_homage.js --all --studies` at the new sizes: all 51 ok, the drawing check included.
2. `node scripts/check_coins.js`, seeds 7 and 41, all 51 escapes, then museums:
   - size = the rule; model whole; crash not the (24, 24) fallback;
   - ten unique ids, each in open air over a stand (or water for the pool coin);
   - the inside ones in a room (`roomAt`) wherever there are rooms;
   - least spacing printed;
   - the same ten on a second build;
   - guards: count by the rule, each round reachable by `field`;
   - `field` ms per place, worst printed (target ≤ 4 ms; else spread over frames).
   - cities: 28 build at 192, the crash by `cityPark` (not the middle fallback), four pieces in the world.
3. Browser, through `Rocket.debug`, on desktop and phone viewports:
   - **body:** a coin taken by the body updates the tally, toast and Notes;
   - **head:** the head flown through one at 22.5 m/s takes it; nothing is taken during `follow`;
   - **save:** reload keeps the coins; an old save without coins still loads;
   - **rocket:** ten as the body builds it; ten as the head builds it, with Launch hidden until the head is home; the finish lede names the coins;
   - **sight:** a guard sees in front within 9 m, not behind, not through a wall, through glass;
   - **grab:** it lands only after a beat in reach; an alarm sounds and the last coin goes back; the third grab puts you out with coins kept; a grab of the body while the head is out sends you under the tree; water and a two-block stack are safe;
   - **reduced motion:** coins still, the arc static;
   - **frame time** with three guards in view on the phone profile.

## Ask the artist (one line each)
1. Half the surround across (160 m usually, about 40% of today's ground), or half the ground (about 192 m)?
2. Should a grab cost your last coin (Sonic's ring loss, one ring), or only an alarm?
3. May the hologram alone gather all ten (the body still has to launch), or must the body follow to keep them?
4. Guards as his own body in the drawing's grey with built heads, or other people (the giants, the saved artists)?
5. Guards on their rounds from waking (chase on sight), or only after the first alarm?
6. The coin as the head's outline in his cells (a Sonic ring), or the block's figure in gold?

## Weak
- Ten coins and the five-and-five split are the artist's numbers and the scoping note's; only where the coins go is derived.
- The hologram makes the ten easy: 150 s at 22.5 m/s crosses 160 m many times. The only cost is the body left to the guards.
- At WALK/φ the guards catch him only when he stops (reading, stacking, aiming). Pac-Man's ghosts run at 75% to Pac-Man's 80% (Pittman, *The Pac-Man Dossier*, 2009), a ratio of 1.07 against our 1.62. If the chase has no teeth, the next stated step is WALK.
- The guards' map is flat and ground-floor only, and they keep to the plot: no one chases beyond it, and museums' floors are wrong.
- The inside coins move with the seed's works; about 20 of 51 places fill with room coins.
- A way-in coin that meets the homage is raised onto it, so it stands a stone higher in the first world than in the same world escaped to.
- Guards in his body may read as copies of him.
- Not measured: phone frame time, and the `field` search's cost on a phone. Design 3's prototype took 1–20 ms in Node.
- Cities and museums are less tested; cities get no coins or guards yet.

## Precedents
- **For:**
  - Super Mario 64 (Nintendo, 1996): eight red coins in a course make a Power Star appear, a few special coins as a second way to the goal.
  - Sonic the Hedgehog (Sega, 1991): rings laid in lines and arcs. Sonic Retro's *Sonic Physics Guide*, "Ring Loss": 120 frames of safety after a hit.
  - Metal Gear Solid (Konami, 1998): guards' sight drawn as cones on the radar, a stated rule the player can learn.
- **Against:**
  - The Pac-Man ratio above.
  - Rowling, *Philosopher's Stone* (1997): catching the Snitch ends the match. Here a grab only rings an alarm.

## Morphology (to log; this step was read-only)
- **coin**: Old French *coin*, "wedge; die for stamping", from Latin *cuneus*, "wedge". Named for the die that strikes it; here the head's outline struck in the unit.
- **guard**: Old French *garder*, from Frankish \**wardōn*, "to watch"; a doublet of *ward*. So they find him by sight, not by knowing where he is.
- **tally**: Anglo-French *tallie*, from Latin *talea*, "a cut stick". The Exchequer's notched tallies were used until 1826.

None of the three is in the scratch copy of Morphology.md; the main session should add them.

Skipped: edge-of-screen guard marks, coins in cities, the space game. Not run: a browser, a phone, the city or museum checks.

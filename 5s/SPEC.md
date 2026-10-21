# 5s — build spec (v1 prototype, published as one Artifact, later an app)

Read `CONCEPT.md` first: it is the artist's own words and outranks anything here.

**Its job, in the system's one line** (see the site's CLAUDE.md, "What we are making"):
*5s — how a person brings their own information in: quick judgments of what they like become their
aesthetic database, the seed of their world.* With the information it **manipulates: sorts**, and
gives the person their information back (their seed). Holographic Mr Pearl's rules say "a player's
own information is the seed of their world … how others bring theirs comes later". 5s is that later.

## The name, made into the product

- **5 seconds** a judgment: a soft ring fills over five seconds. It never forces a choice
  (WCAG 2.2.1); the time taken is recorded as a signal (gut / considered / slow).
- **5 cards** a round, called **a five**: one of each kind (Image, Object, Space, Surface, Colour)
  in shuffled order. The habit is **today's five**; after it, "Another five".
- **5 steps**, the five tabs, each a verb: **Sort → Split → Set → See → Seed**. The linear version
  of the artist's collaging: sort the things, split them into parts, set the parts together, see the
  positive and negative space of your taste, and seed a world with it.

## The five kinds of card

| Kind | What it is | Shown on the card | Becomes in Set |
| --- | --- | --- | --- |
| **Image** | a picture: painting, print, photograph, drawing, collage, poster | the work | the Picture on the wall |
| **Object** | a thing: design, furniture, sculpture, ceramic, textile, jewellery, fashion | the work | the Object on the floor |
| **Space** | a place: architecture, installation, interiors, cities, landscapes | the work | the Window's view |
| **Surface** | a detail of a work at its own scale (a 1:1 crop of the large image) | the crop, full bleed | the Floor |
| **Colour** | a work's three dominant colours, as a chord | three bands, no picture | the Wall (wall, trim, accent) |

Surface and Colour cards strip subject matter away, so a person judges an element alone. Every card
comes from a real saved work, so nothing is made up; after judging, the work behind it is revealed.

**Judge first, names after.** Before a judgment a card shows no title, artist, price or place, so the
judgment is aesthetic and uninfluenced. The reveal (title, artist, date, medium) comes right after.
For screen readers, the card's accessible description before judging is kind + colour names +
material words (never the title or artist).

## The tabs

### Sort (the swipe)
- A card stack, one card at a time, image contained (never cropped) on the work's own first dominant
  colour; Surface fills the card; Colour shows its three colours as bands (proportions 3:2:1).
- Drag right = **Keep**, drag left = **Pass**. Buttons **Pass** and **Keep** always visible (the one-tap
  way); keys ← Pass, → Keep, U or Ctrl+Z Undo, Enter or Space "Look closer".
- While dragging, the card tilts slightly and a word + icon appears ("Keep" warm on the right edge,
  "Pass" cool on the left), never colour alone.
- Top bar: "Today's five" (or "Another five"), counter "2 of 5" with the five-second ring around it,
  the streak ("3 days").
- After a judgment: a reveal strip for ~2.5 s (it stays while focused or hovered): "Kept: <title>, <artist>,
  <date>" with **Undo** and **Look closer**. If the engine flags a **turn**, the strip says so in violet:
  "A turn. You kept this though you pass most <feature> works." (or "…though you keep most…").
  A Keep also shows the card's parts (colour chips, material words, two qualities) flying toward the
  Split tab; under reduced motion they just appear in the strip.
- After the fifth card: **Five sorted** summary: the five as a row of small tiles marked Kept/Passed
  (glyph + word), total time, turns, parts gained, and two buttons: "Another five", "Set what you kept".
- First visit: an intro card on top of the stack (dismissable, remembered): what 5s is in one sentence,
  how to judge, "Names come after you decide", "No account details. Only your judgments." and **Start**.
- A small "i" in Sort's header reopens that intro.

### Split (your aesthetic database)
- Heading "Split", sentence: "Everything you kept, broken into its parts."
- Sections, each a row of chips or tiles ranked by how strongly you keep it, with counts
  (e.g. "Biomorphic · kept 5 of 6"):
  Colours (kept colours as swatches, sorted by hue, hex in mono on press), Surfaces (crop tiles),
  Materials, Qualities (Visual Qualities + Design Concepts genes), Movements (Styles and Movements),
  Subjects (Subject Matter), Eras, Places, Kinds, and Things (all kept works as thumbnails, each
  opening its detail sheet with a link out to Artsy).
- Empty state: a designed placeholder per section naming what will fill it.

### Set (compose: the mood board as a room)
- Heading "Set", sentence: "Put your parts together. Every place in the room offers three; choose one."
- An elevation of a room built from five slots, drawn with plain elements, as a collage:
  - **Wall**: a kept Colour card's chord: colour 1 the wall, colour 2 the cornice/trim band, colour 3 the
    skirting/accent. (Fallback before any Colour is kept: the colours of kept works.)
  - **Window**: a kept Space, cover-fitted inside a window frame (a view out).
  - **Picture**: a kept Image, contained in a frame hung on the wall.
  - **Floor**: a kept Surface tiled on a floor plane shown in perspective (CSS 3D rotateX).
  - **Object**: a kept Object standing on the floor line, `mix-blend-mode: multiply` so a white studio
    background drops into the wall.
- Each slot is a button; pressing it opens a chooser with **three** candidates (Irwin's three ways) and
  "Three more". An empty slot says "Keep a <kind> to fill this" and links to Sort.
- **Pin this set** saves the composition; pinned sets show below as small elevations; each can be
  reopened or removed (with an in-page confirm, never `confirm()`).

### See (your taste: positive and negative space)
- Heading "See", one sentence summary: "You kept 38 of 75. You decide in 1.8 seconds. 3 turns."
- **Positive space**: the features you keep most (lift over your overall keep rate), as filled chips.
- **Negative space**: the features you pass most, as hollow (outlined) chips. Copy: "What you pass shapes
  you as much as what you keep."
- **Colour field**: kept colours as a solid mosaic; passed colours as a hollow one beside it.
- **Turns**: every turn, newest first: thumbnail, "You kept <title> though you pass most <feature> works",
  date. Copy: "A turn is where you went against your own pattern. That's where taste changes."
- **Drift** (from 30 judgments): top features in your first third of judgments → your last third.
- **Your philosophy**: 4–6 short lines in the second person from `engine.philosophy()` (deterministic),
  and a button **Ask Claude to write it** (the `sample` capability; hidden if unavailable) that streams a
  short piece from the profile JSON. Its output replaces nothing; it appears below, marked "Written by
  Claude from your judgments".

### Seed (your world)
- Heading "Seed", sentence: "Your ground, grown from your judgments."
- The **seed code** (`5S-XXXX-XXXX`, mono, copy button): the same judgments always give the same code
  and the same ground (nothing random: every random choice is drawn from a PRNG seeded by the code).
- **Your ground**: a true-isometric island drawn on canvas (edges at 30°, all axes equal): land tiles
  whose tops carry your kept Surfaces (as canvas patterns, transformed onto the rhombus), tinted toward
  your kept colours; water tiles in your passed colours (negative space becomes the sea); a coast line;
  your most recent pinned set standing on the highest tile as a small house: walls in its wall colour,
  a window, roof in its trim colour. Heights from seeded value noise. No animation except an optional
  one-time grow (skipped under reduced motion).
- Under it, in words: "Land: 12 surfaces you kept. Water: the colours you passed. The house: your
  latest set." (every drawn thing named in text: WCAG 1.1.1).
- **Save your seed**: the `downloads` capability saves `5s-seed-<code>.json` (format below); hidden if
  unavailable, with "Copy seed" (clipboard, falling back to a selectable textarea) always offered.
- Privacy line: "Your seed holds no name, no email, no card. Only what you kept, passed and set."
- Link out: "Holographic Mr Pearl builds worlds from a person's information. This seed is yours, ready for
  it." (no claim that the game reads it yet).

### Example mode
- Every tab except Sort can show **an example taste** (built by `engine.exampleState(deck)`), behind a
  clearly marked banner "Example taste. Not yours." with "Back to mine". It is never saved. On a first
  visit with no judgments, Split/Set/See/Seed show their empty state plus a button "See an example".

## Files

```
5s/
  CONCEPT.md            the artist's words (authority)
  SPEC.md               this file
  README.md             how to build, test and publish
  build_deck.py         data: artworks.db + Artsy genes + images  ->  dist/deck.json, dist/img/
  build_page.py         copies src/ into dist/, inlines app.css into index.html, writes dist/dev.html
  src/index.html        the page (no doctype/html/head/body: the Artifact wraps it)
  src/app.css           styles (inlined into index.html at build)
  src/app.js            UI
  src/engine.js         pure logic (no DOM); also loads in Node for tests
  test/fixture/deck.json + test/fixture/img/*   synthetic 50-card deck for tests
  test/engine.test.mjs  node --test
  test/ui.smoke.mjs     Playwright smoke test against a served dist/ (or the fixture)
  dist/                 built output (gitignored: holds Artsy-derived data)
```
`data/` and `5s/dist/` are never committed: the repository is public and they hold the saves.

## deck.json (written by build_deck.py, read by the app)

```jsonc
{
  "version": 1,
  "built": "2026-10-21",
  "source": "The art database: Artsy saves",
  "atlas": {"src": "img/atlas.webp", "cell": 128, "cols": 20},   // thumbnails of every card's work
  "genes": {                                     // only genes some card uses
    "biomorphic": {"name": "Biomorphic", "family": "Visual Qualities"}
  },
  "cards": [{
    "id": "o017",                // kind letter (i o s u c) + number; stable within a build
    "kind": "object",            // image | object | space | surface | colour
    "work": "joris-laarman-bone-armchair-1",   // Artsy artwork slug
    "url": "https://www.artsy.net/artwork/joris-laarman-bone-armchair-1",
    "title": "\"Bone\" Armchair",
    "artist": "Joris Laarman",
    "date": "2007",
    "year": 2007,                // int or null
    "era": "2000s",              // one of the ERA buckets below, or null
    "category": "Design/Decorative Art",
    "medium": "Carrara marble powder and casting resin",
    "materials": ["marble", "resin"],          // MATERIAL families below
    "place": "Netherlands",      // country from nationality, or null
    "colours": ["#c0c2c1", "#a7a6a1", "#bbbbbb"],   // Artsy dominant colours, in Artsy's order
    "genes": ["biomorphic", "irregular-curvilinear-forms", "furniture"], // artist genes, aesthetic families only
    "img": "img/o017.webp",      // image/object/space: the work; surface: the crop; colour: null
    "w": 720, "h": 698,          // pixel size of img (null for colour)
    "thumb": 17,                 // index of this work's cell in the atlas
    "crop": [0.41, 0.22, 0.25, 0.25],   // surface only: x, y, w, h as fractions of the source image
    "texture": 0.58              // surface only: 0..1 edge density of the crop (fine..coarse)
  }]
}
```
- ERA buckets: "Before 1800", "1800s", "1900–45", "1945–69", "1970–99", "2000s", "2010s–now".
- MATERIAL families (lowercase): oil, acrylic, watercolour, gouache, ink, graphite, charcoal, pastel,
  tempera, paper, canvas, linen, panel, wood, bronze, steel, iron, aluminium, brass, copper, silver,
  gold, glass, ceramic, porcelain, stone, marble, concrete, plaster, resin, plastic, textile, wool,
  silk, cotton, felt, leather, photograph, screenprint, lithograph, etching, woodcut, neon, video,
  found objects, mixed media.
- Gene families kept: "Visual Qualities", "Design Concepts and Techniques" (UI section Qualities),
  "Styles and Movements" (Movements), "Subject Matter" (Subjects). Others are dropped.
- Targets: 80 per kind (Space may come in lower; report the number). At most 2 cards per artist across
  the deck, 1 per kind. Spread across colour chords, eras and places.

## engine.js — the API (pure; `window.FiveS` in the browser, `module.exports` in Node)

```js
FiveS.ERAS, FiveS.KINDS            // constants; KINDS = ["image","object","space","surface","colour"]
FiveS.hexToHsl(hex) -> {h, s, l}   // h 0..360, s and l 0..1
FiveS.colourName(hex) -> "deep teal" | "pale grey" | …   // plain words, ≤ 3 words
FiveS.chord(hexes) -> "monochrome"|"neutral"|"accent"|"complementary"|"analogous"|"split"
FiveS.features(card) -> {[feature]: weight}
   // feature keys: "kind:object", "cat:Sculpture", "mat:wood", "era:1970–99", "place:Japan",
   // "gene:biomorphic", "hue:orange" (12 hue names + "hue:neutral"), "value:light|mid|dark",
   // "chroma:muted|vivid", "chord:analogous", "texture:fine|coarse" (surface only)
   // Colour cards carry colour features only; Surface cards: colour + material + texture + kind.
FiveS.featureLabel(key, deck) -> "Biomorphic" | "Wood" | "1970–99" | "Orange" …   // for UI copy
FiveS.featureGroup(key, deck) -> "Qualities"|"Movements"|"Subjects"|"Materials"|"Eras"|"Places"|"Kinds"|"Colours"|"Textures"
FiveS.newState() -> State
FiveS.judge(state, deck, cardId, keep, ms, now) -> {state, turn}   // pure: returns a new state
FiveS.undo(state) -> State                                          // removes the last judgment
FiveS.model(state, deck) -> Model                                   // Beta counts per feature
FiveS.predict(model, card) -> {p, confidence, because: [{key, keptRate, n, delta}]}
FiveS.nextFive(state, deck, now) -> [cardId × 5]   // one per kind, shuffled; deterministic for (state, day)
FiveS.profile(state, deck) -> Profile
FiveS.philosophy(profile, deck) -> [string]          // 4–6 lines, plain, second person
FiveS.setCandidates(state, deck, slot, page) -> [cardId × ≤3]   // slot: wall|window|picture|floor|object
FiveS.seedCode(state) -> "5S-XXXX-XXXX"
FiveS.prng(code) -> () => number in [0,1)          // mulberry32 seeded by a hash of the code
FiveS.exportSeed(state, deck, now) -> object       // the 5s-seed JSON below
FiveS.exampleState(deck, now) -> State             // a believable example taste, ~60 judgments, 2 pinned sets, ≥2 turns
FiveS.dayOf(now) -> "2026-10-21"                   // local date
FiveS.startFive(state, deck, now) -> State         // state.five = {ids: nextFive(...), day, n, i: 0}
FiveS.currentCard(state) -> cardId | null          // state.five.ids[state.five.i], null when the five is done
FiveS.fiveDone(state) -> boolean
FiveS.streak(state, now) -> number                 // consecutive days in state.days ending today or yesterday
FiveS.pinSet(state, set, now) / FiveS.unpinSet(state, index) -> State
```
- `now` is always a millisecond timestamp passed in (never read inside the engine), so everything is
  deterministic and testable. State stores unix **seconds**.
- `judge()` computes the prediction **before** counting the judgment, appends it, advances `five.i` when
  the card is the current one, and when `five.i` reaches 5 adds today to `days` (once). `undo()` removes
  the last judgment and steps `five.i` back if that judgment belonged to the current five.
- Every function returns a new state object (no mutation of its input), so Undo and Example mode are cheap.

### State (what is persisted; plain JSON, small)
```jsonc
{
  "v": 1,
  "j": [["o017", 1, 1840, 1761050000, 0]],   // [cardId, keep 1|0, ms to decide, unix seconds, turn 0|1|-1]
                                             // turn: 1 = kept against a predicted pass, -1 = passed against a predicted keep
  "five": {"ids": ["…×5"], "day": "2026-10-21", "n": 1, "i": 0},   // the five in progress (n = which five today, i = how many judged)
  "sets": [{"at": 1761050000, "wall": "c004", "window": "s011", "picture": "i020", "floor": "u007", "object": "o017"}],
  "days": ["2026-10-20", "2026-10-21"],     // local dates on which today's five was finished
  "seen": {"intro": 1},
  "opts": {"ring": true}
}
```

### The taste model
- Each feature keeps Beta counts (kept, passed). A card's prediction is naive-Bayes style: start from the
  log-odds of the overall keep rate (prior Beta(2,2)), add for each feature with n ≥ 2 the shrunk
  log-odds difference `w · (logit((k+1)/(n+2)) − logit(base))`, scaled by the feature weight and by
  1/√(number of features in its group) so genes don't swamp colour; p = sigmoid. Confidence = how far p
  is from 0.5 weighted by evidence.
- **A turn** is a judgment against a confident prediction: total judgments ≥ 12, and p ≥ 0.70 but
  passed, or p ≤ 0.30 but kept. `because` names the one or two features that moved p most, with their
  kept rate ("you pass most Geometric works": kept 1 of 6). The judgment is stored with turn ±1 and
  the prediction is made **before** the judgment is counted.
- **nextFive**: for each kind, choose from unseen cards (fall back to the least recently seen) by mode:
  three slots "match" (high p, with exploration noise), one "explore" (p near 0.5, under-seen features),
  one "dare" (low p: a chance to turn). Modes are assigned to kinds by the day's PRNG. With fewer than
  10 judgments every slot is "explore" (spread across chords, eras and places). Deterministic for the
  same state and day.

### Profile (for Split, See, Seed)
```jsonc
{
  "judged": 75, "kept": 38, "passed": 37, "keepRate": 0.51,
  "medianMs": 1800, "speed": "gut|considered|slow",
  "turns": [{"card": "o017", "dir": 1, "at": 1761050000, "because": [{"key": "gene:geometric", "kept": 1, "n": 6}]}],
  "groups": {"Qualities": [{"key": "gene:biomorphic", "label": "Biomorphic", "kept": 5, "n": 6, "lift": 0.31}], "…": []},
  "positive": [/* top features by lift, n ≥ 3, across groups, ≤ 10 */],
  "negative": [/* bottom features by lift, n ≥ 3, ≤ 10 */],
  "keptColours": ["#…"], "passedColours": ["#…"],
  "keptByKind": {"image": ["i020"], "object": [], "space": [], "surface": [], "colour": []},
  "drift": {"then": [/* top 3 features of the first third */], "now": [/* of the last third */]} | null,
  "streak": 3, "todayDone": true
}
```

### The 5s seed (exportSeed)
```jsonc
{
  "format": "5s-seed", "version": 1, "code": "5S-4F2A-9C1E", "made": "2026-10-21",
  "counts": {"judged": 75, "kept": 38, "passed": 37, "turns": 3},
  "kept":   [{"work": "joris-laarman-bone-armchair-1", "kind": "object", "ms": 1840}],
  "passed": [{"work": "…", "kind": "colour"}],
  "palette": {"kept": ["#…"], "passed": ["#…"]},
  "surfaces": [{"work": "…", "crop": [0.41, 0.22, 0.25, 0.25]}],
  "leanings": {"positive": [["gene:biomorphic", 0.31]], "negative": [["gene:geometric", -0.4]]},
  "turns": [{"work": "…", "dir": 1, "because": ["gene:geometric"]}],
  "sets": [{"wall": "…work slug…", "window": "…", "picture": "…", "floor": "…", "object": "…"}],
  "speed": {"medianMs": 1800}
}
```
Works are named by their Artsy slug, the id the art database and the game already use. No name, email
or account id ever goes in.

## Persistence (app.js)
- Declared capabilities: `{db: {}, user: {}, sample: {}, downloads: true}`.
- The state is one document: `data/users/<await user.id()>/state` (4 segments), private to the viewer
  (even from the owner). Load: subscribe once; if absent and localStorage has a state, migrate it. Save:
  debounce ~800 ms, one write in flight at a time, only when changed. Mirror every save into
  localStorage (key `5s.state.v1`, try/catch) so a view without `db` (signed out, preview, a Viewer who
  cannot write) still works; a rejected write switches that visit to local only and says so once in the
  footer: "Saved in this browser only."
- The page renders immediately from localStorage (or a fresh state) and lights up when `db` resolves.
- Optional: `window.claude?.hot?.snapshot(() => state)` and boot through `hot.ready` if present.

## Look and feel
- From the logo: **Ember** orange → **Flare** red (the "5s"), **Iris** violet and **Cobalt** blue (the ribbon
  and the frame). Keep is warm (Ember/Flare); Pass is cool (Cobalt); a **turn is Iris**, the ribbon that
  runs through the 5 and the s. Neutrals lean violet: paper near #FAF9FC, ink near #16131F; dark mode
  ground near #100E18. Every text colour measured ≥ 4.5:1, controls and marks ≥ 3:1, in both themes.
- Type: **Unbounded** (display: wide, rounded, chunky like the logo's 5s; headings and the counter only),
  **Figtree** (body), **Martian Mono** (hex codes, seed code, times). Google Fonts, real fallback stacks.
- Shapes: the card's corner radius echoes the logo's rounded square (~28 px); buttons round. The
  five-second ring is a gradient stroke Ember → Flare → Iris (the logo's ribbon).
- Phone-first: one column, a bottom tab bar (Sort Split Set See Seed, icon + word, 5 × ≥ 56 px),
  respecting safe-area insets. On wide screens the column centres (max ~480 px for Sort; up to ~960 px
  for Split/See grids).
- Use the artifact page contract: no doctype/html/head/body in index.html; `<title>5s</title>` first,
  `<meta name="claude:viewport-fit-sides" content="cover">` with the two max() side paddings; tokens on
  bare `:root` with both dark blocks; body background from a token; `height: 100%` app shell.

## Accessibility (the site's DISPLAY.md checklist, WCAG 2.2 A/AA)
1. One heading and one sentence per view; `document.title` says the view ("Sort · 5s"); views are
   bare-token anchors `#sort #split #set #see #seed`, opened from `location.hash` on load.
2. Meaning in text as well as drawing; never colour alone (Keep/Pass have words and glyphs; hollow vs
   filled chips also say "kept"/"passed" in text; the ground is described in words).
3. Contrast measured (4.5:1 text, 3:1 marks and controls).
4. Every gesture has a one-tap way; every target ≥ 24 px (main buttons ≥ 56 px).
5. Reduced motion: no flying, tilting or growing; the ring becomes a static "5 s" label.
6. Keyboard throughout; tabs are a tablist (arrow keys); visible focus ring (2 px Iris, 2 px offset),
   never hidden under the tab bar; sheets trap focus while open and Escape closes them.
7. Status changes (kept/passed, a turn, five done, saved) go to one polite live region.
8. Timing: nothing forces a decision; the ring can be turned off ("Five-second ring" switch in the
   intro/about sheet).

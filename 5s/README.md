# 5s

5s puts a newcomer through the month the artist spent organizing a digital aesthetic, small enough
for a few minutes a day. That month had five moves: gather saved things into one database, catalog
them into their parts, make new things from the parts, name and reflect on each one, and keep at
it. In 5s they become five tabs and a habit: **Sort** five cards a day (an Image, an Object, a Space,
a Surface and a Colour, all from the artist's database of Artsy saves and the artist's Architectural
Authority bookmarks of buildings, plus things you bring in from your own photos and pins), **Split** what you kept into its parts, **Set** them on a mood board, played like Candy Crush Saga against the clock, each level won building your kingdom (with the room one tap away),
**See** the positive and negative space of your taste, and grow it into a **Seed**: a ground drawn
from your judgments and a file you can take with you. Its job, in the system's one line: *how a
person brings their own information in: quick judgments of what they like become their aesthetic
database, the seed of their world.*

Read [CONCEPT.md](CONCEPT.md) (the artist's own words, the authority) and [SPEC.md](SPEC.md) (the
build contract) before changing anything.

## Files

| Path | What it is |
| --- | --- |
| `build_deck.py` | the deck: `data/5s/artworks.db` + Artsy genes + images → `dist/deck.json`, `dist/img/`, `dist/logo.webp`; then the bookmarks from `buildings.json` + `data/aa/`; then what each card is in a room (`role`, `what`) from git-ignored `data/5s/roles.json`, and each interior's marked `room` from `data/5s/planes.json`, only in the git-ignored deck |
| `buildings.json` | the artist's Architectural Authority bookmarks as chosen for the deck: each building's hero photo, surface crop, materials and genes (cards b001…, m001…) |
| `roles.py` | what each deck card is and its relation to setting up a space ("a pendant lamp", lighting the room; an interior is the room): keeps git-ignored `data/5s/roles.json` whole against the built deck, adds what a rule judges (images, colours, Artsy pictures of places, painted surfaces), checks every entry and lists the cards to judge by eye; `build_deck.py` ships it on the cards |
| `build_page.py` | the page: `src/` → `dist/index.html` (with `app.css` inlined, and `play.css` as `<style data-fives="play">`), the fifteen scripts in the order the page loads them (`hub.js`, `hubpage.js`, `connect.js`, `match.js`, `relate.js`, `board.js`, `play.js`, `kingdom.js`, `room.js`, `links.js` and `motion.js` before `app.js`; `motion.js` is built from `motion/marks.js`, the family of the pick it uses, `src/motion-picks.json` and `src/motion.js`), and `dist/dev.html` |
| `src/index.html` | the page itself, with no doctype, html, head or body (the Artifact adds them) |
| `src/app.css`, `src/app.js` | styles and UI (including Your hub: Seed's last section and the Hub sheet, through GitHub's own pages) |
| `src/engine.js` | pure logic: judgments, the taste model, turns, the five, profile, Path, seed (no DOM, clock or randomness) |
| `src/bring.js` | turns a person's own images into 5s things in the browser and keeps the images private |
| `src/connect.js` | Connect your apps (`FiveSConnect`): an app's "download your data" file read on the device (JSON, web pages, spreadsheets, text, .zip), and the one client of the 5s connector through the `mcp` capability (server `"5s"`) |
| `src/ground.js` | draws Seed's isometric island on a canvas (and the kingdom's islands, with their plots and buildings) |
| `src/match.js` | Set's game, pure (`FiveSMatch`): Candy Crush Saga's rules with the person's own things, the 30 levels, the suits (the person's threads), pairings, the saga |
| `src/relate.js` | Set, inside out, pure (`FiveSRelate`): boards dealt from the person's kept pictures, relations (alike or unlike, in what) and the answers, what a win builds and how tall, the kingdom's ties and mist, Sort's one card from Set |
| `src/board.js` | Set's mood board (`FiveSBoard`): what you keep, in masonry, grouped by what you put together |
| `src/play.js`, `src/play.css` | Set's game in the page (`FiveSPlay`): the list of levels, a level (with its clock), its sound, motion and gestures; the game's, the board's and the kingdom's styles |
| `src/kingdom.js` | Set's kingdom map (`FiveSKingdom`): an island for every five levels, each level won one of your things built on its plot, the next area under cloud; you pan and zoom it |
| `src/room.js` | See it as a room (`FiveSRoom`): a kept interior's own photograph as the room, with the person's other kept things placed in it in its perspective |
| `src/motion.js`, `src/motion-picks.json` | The logo (`FiveSMotion.logo`): the artist's opening Motion Lab pick drawn at rest, the 5, the s and the glass in their colours on nothing, playing once every 30 seconds in the top left (never under Reduce Motion or while hidden); the intro's logo at rest. `motion-picks.json` is the lab's db (`motion/picks`, read 28 Oct 2026; copy it again when the picks change); the app uses only `launch` (`MOTION_USED` in `build_page.py`) |
| `src/hub.js` | Your hub: GitHub's naming rules, the filled-in GitHub links, the api.github.com driver and the device-flow sign-in (`FiveSHub`) |
| `src/hubpage.js` | Your hub: the standalone hub page built from the seed, for github.io (`FiveSHubPage`) |
| `test/` | engine, match, bring, ground, play, kingdom, room and UI tests; `test/play.html` and `test/kingdom.html` are the game's and the kingdom's harnesses, `test/sim.mjs` its playtest; `test/fixture/` is a synthetic 50-card deck (no real data), with synthetic `roles.json` and `planes.json` (two marked interiors) that `make_fixture.py` puts on its cards through the deck build's own `add_roles` |
| `gameplan/reflect.mjs` | the Game Plan as code: reads Claude Code transcripts, places each session on the plan's seven stages, finds the traps it met, and judges its turns against the laws ponytail and caveman share (each only while that skill is on). `node 5s/gameplan/reflect.mjs <transcripts or folders>` prints the reflection; `--hook` runs after each turn (Stop) and when the person next writes (UserPromptSubmit), where it passes Claude one line on the turns since their last message that met a trap or broke a law, for Claude to tell them. `gameplan/REFRESH.md` is how a routine redoes the reflection every other day. Transcripts stay out of the repository |
| `test/deck.test.py` | checks a built deck: the Artsy cards and the bookmarks' b and m cards (source, url, kinds, images), and with roles, every card's roles and the marked rooms (planes in front of the camera, spots on planes, polygons in the photo, a picture and view hung at their spots inside the photo and on their own wall, a pendant big enough to see) |
| `dist/` | built output; gitignored |

## Build

Requires Python 3 with Pillow and numpy.

```sh
python3 5s/build_deck.py      # the deck (slow the first time; cached under data/5s/ after that)
python3 5s/test/deck.test.py  # the deck's check: builds it again into a temporary folder (about two minutes) and compares
python3 5s/roles.py           # after a deck gains cards: fills and checks data/5s/roles.json (then build the deck again)
python3 5s/test/roles.test.py # roles.py's check, on the fixture
python3 5s/test/deck_roles.test.py # the build's roles and marked rooms (add_roles), on the fixture's roles.json and planes.json
python3 5s/build_page.py      # the page, into 5s/dist next to the deck
```

- `build_deck.py` reads `data/5s/artworks.db` and fetches artist genes, gene families and images
  from Artsy (through the session's proxy; no token in code). Every network result is cached under
  `data/5s/`, so a re-run is resumable and gives the same deck. Flags: `--fetch-only` (cache genes,
  then stop) and `--no-logo` (leave `dist/logo.webp` alone).
- `build_page.py [--deck DIR] [--out DIR]` copies `DECK/deck.json`, `DECK/img/` and
  `DECK/logo.webp` into `OUT` when they differ. Both default to `5s/dist`. For a build with no real
  data, use `python3 5s/build_page.py --deck 5s/test/fixture --out <scratch dir>`.
- Rebuild the page after every change to `src/`.

## Test

Node 22 and Playwright with Chromium are required for the browser suites; each one starts and stops
its own `python3 -m http.server`.

```sh
node --test 5s/test/                    # engine, hub, connect, links, reflect, match and relate (pure logic; runs through test/index.js)
node --test 5s/test/match.test.mjs      # Set's game engine alone
node --test 5s/test/play.smoke.cjs      # Set's game and board in their harness (serves 5s/ itself)
node --test 5s/test/kingdom.smoke.cjs   # Set's kingdom map in its harness (serves 5s/ itself)
node 5s/test/sim.mjs 200                # the playtest: 200 boards a level, the hint and smart bots
node --test 5s/test/hub.test.mjs        # the hub drivers and page, against a fake GitHub
node --test 5s/test/bring.test.cjs      # bring-in: images, colours, crop, texture, stores
node --test 5s/test/ground.test.cjs     # the ground renderer
node --test 5s/test/room.test.cjs       # the photo room: perspective, words and drawing, on the fixture's rooms
node --test 5s/test/ui.smoke.cjs        # the whole page, against a build (default 5s/dist)
```

Environment variables:

| Suite | Variables |
| --- | --- |
| bring | `BRING_PORT` (default 8750); `BRING_SCRATCH` for generated fixtures |
| ground | `GROUND_PORT` (default 8761); `GROUND_SHOTS` for screenshots |
| play, kingdom | `PORT` (default: any free port); `SHOTS` for screenshots |
| room | `ROOM_SHOTS` for screenshots (no server: Playwright answers the files) |
| UI smoke | `SITE_DIR` (default `5s/dist`) or `BASE_URL` (a served `dev.html`); `UI_PORT` (default 8731); `SHOTS`; `UI_SIZES` (e.g. `390-light`) |

The UI smoke test runs at 390×844 and 1280×800, in light and dark. It covers a fake `db`, `user`,
`sample` and `downloads`, including a store that answers slowly and a write that is rejected, and
Your hub's four steps in links mode (with GitHub's pages answered by a stand-in, so no network), and
Set: the board, Play opening level 1, a planned swap (touch at 390, the mouse at 1280) whose pairs are
saved and cluster the board, the tab bar hiding during a level, the room and back, Example mode and
nothing kept; Your kingdom and the list of levels from it; level 5 won against the clock building on
its plot and finding the next area, Another way, the clock off, and a reload; an old saga's levels replayed,
whose old height stays only under the building it was given to.

## Publish

Publish `dist/index.html` as the page. `dist/dev.html` is only for local testing and is never
published. The supporting files go with it at the same relative paths:

- `engine.js`, `bring.js`, `ground.js`, `hub.js`, `hubpage.js`, `connect.js`, `match.js`, `relate.js`, `board.js`, `play.js`, `kingdom.js`, `room.js`, `links.js`, `motion.js`, `app.js`
- `deck.json`, `logo.webp`, `img/atlas.webp`
- the 451 card images `img/{i,o,s,u,b,m}NNN.webp` (Colour cards have no image; `b` and `m` are the
  artist's Architectural Authority bookmarks, a building's Space or Object and its Surface)

Declare these capabilities: `{db: {}, user: {}, sample: {}, downloads: true}`.

- **db and user:** the state document is `data/users/<id>/state`, and each brought-in image is its
  own document `data/users/<id>/own-<itemId>`. Both are private to each viewer.
- **sample:** Ask Claude to write your philosophy.
- **downloads:** Save your seed, and Save my hub file (Your hub's `index.html`). Without it, the hub
  file's text is shown to copy, with GitHub's own editor opened to paste it in.

The page works without any of them: state is kept in the browser and brought-in images in
IndexedDB, and it says so.

**Not declared yet: `mcp`.** Connect your apps' Paste a link (and the pictures of things brought in
from data files) go through the 5s connector. Once it is deployed (`connector/README.md`), add
`mcp: {servers: [{server: "5s", tools: ["read_link", "bring_in", "item_image", "get_state"]}]}` (with
the tools the hub will use) to the capabilities; until then the page says what opens those doors,
and the data file door works without it. Paste a link itself works without it too (the address's own
words, Define through `sample`, or a pasted picture); the connector adds the page's own picture and
facts, and whole boards and channels (SPEC.md, "As built, 22 Oct 2026").

**Two publishes, because of the file count.** The page plus 469 supporting files is 470 files (about
18 MB). One publish sends at most 255 files; a version holds up to 511.

1. Publish the page with the fifteen scripts, `deck.json`, `logo.webp`, `img/atlas.webp`, the Image and
   Object card images (`img/i*.webp`, `img/o*.webp`) and the bookmarks' 66 Spaces and Objects (`img/b*.webp`):
   245 files.
2. Publish again to the same URL with the 80 Space card images (`img/s*.webp`), the 80 Surface crops
   (`img/u*.webp`) and the bookmarks' 65 Surfaces (`img/m*.webp`): 225 files. Files left out of a
   publish are kept.

Between the two publishes, Space and Surface cards (the bookmarks' Surfaces too) have no image. Publish
the second batch right away.

Size limits are not a concern: the page is about 90 KB, the largest file is the atlas at about
1 MB, and the whole set is about 18 MB.

## Not committed

`data/` and `5s/dist/` are gitignored and never committed. The repository is public, and both hold
Artsy-derived material: the saves database, the cached images and genes, the deck and its card
images. `dist/` also holds the built page and the rendered logo; rebuild them, don't commit them.
Screenshots of the real deck stay in scratch space for the same reason. The repository holds only
code, the spec, the logo source and the synthetic test fixture.

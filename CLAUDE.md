# Matthew Livingston — artist website

## Standing instruction

**Surface the later tasks when they become relevant.** `WIX.md` ends with a
numbered "Still to do" list. Whenever something in a conversation touches one of
those items — the topic comes up, the blocker clears, the artist supplies the
missing piece, or work is being done that would naturally carry it — say so and
offer to do it. Once, briefly, as an offer rather than a prompt to act.

Examples of the trigger: real photography arrives (items 2 and 6 become
possible); dimensions arrive (item 3); the artist mentions the Wix editor or
being at a computer (item 1); paintings are mentioned (item 5); the artist
describes what the token object is (item 7).

Don't recite the list unprompted, and don't re-raise an item the artist has
already declined or deferred in the same conversation.

## Where things are

| | |
| --- | --- |
| `docs/` | **Umbrella Portfolio 2026** — served at `/`, deployed by `.github/workflows/pages.yml`. |
| `docs/v2/` | **Artist Website** — the ongoing site, served at `/v2/`. Its front page is the land. Hand-edited; the generator does not write it. Shares `docs/images/`. |
| `docs/works.json` | The works, as data. Edit this, not `index.html`. |
| `scripts/build_page.py` | Renders `docs/index.html` from `works.json`. |
| `scripts/build_artifact.py` | Flattens the page for publishing as an Artifact. |
| `WIX.md` | The live Wix site: CMS schema, current rows, and the to-do list. |
| `docs/v2/index.html` | **The land**, and the front page of the Artist Website — two heights. The globe is the view of the site: the Earth, the words, and the places the collages are in, each at its real coordinates (Sydney, Washington ×2, New York, San Francisco, Boston, Blacksburg) plus the Folger Shakespeare Library, which is a real building and where the plays are. Drag sideways to turn the world, up and down to roll it north or south. Pressing a city flies you down into it, and the creature, the company and the scenes are all down there, with that city's collage laid out beside them. **The Artist Website is one page with one link**: a word opens its collages over the globe (the all-collages view survives only for old `works.html` links; the Collages button was removed at the artist's request — nothing floats in the sky), and pressing a collage flies to its city. Nothing links to another page, and the address never changes as you move around it — the artist wants one link to everything, so never hand out deep links. Every collage is dealt as separate pieces — photograph, title, place, details, price, notes, writings — to new random, non-overlapping positions on every press; the artist wants nothing shown the same way twice. `land.css`, `land.js`, `land.json`. |
| `docs/v2/works.html` | Where the works page used to be. Forwards into the one page, opening the collages, so links to it that were shared before still work; the address is then put back to the plain link. |
| `docs/v2/land.html` | Where the land used to be. Forwards to `./`, so links to it that were shared before still work. |
| `scripts/build_land.py` | Writes `docs/v2/land.json` from the private Artsy dump. |
| `scripts/fetch_artsy_saves.py` | Fetches that dump into `data/`, which is gitignored and stays that way — the repo is public. |
| `scripts/build_earth.py` | Writes `docs/v2/earth.json` — the land mask the weave is shaped by. Natural Earth **50m**, public domain, 1440×720 (¼°); the download goes to `data/`. Column 0 is **180°W** — land.js reads longitude from there (it once read from Greenwich, which put every continent half a world off). City marks sit exactly on their coordinates; coincident places stack their names, never move their dots. |
| `scripts/build_dirt.py` | Writes `docs/v2/dirt-land.png` and `docs/v2/dirt-sea.png` — one pixel a cell, colour and dot size only. The land is **DIRT** (the collection soil from the DIRT session, branch `claude/digital-dirt-layers-paiial`); the sea is the same soil woven again from the saved paintings' blues. The globe's threads show the soil through them, and the globe's body and each family of threads fade between 0.382 and 0.618 on golden-ratio periods. Over that, every word on the globe is the centre of a patch (sized and paced by the word's mass) that fades between 0.382 and 1 on periods of φ³–φ⁶ s — the word placement dictates the transparency, and a fade band runs pole to pole every φ⁵ s; the weave has φ× the threads to make up for it. Grit (baked into the globe's body) and blur (a small copy on its own canvas, `#world-soft`, stretched back up) grow from 1/φ² at orbit to full / 1/φ in a city; opening a word blurs the stage behind its collages, and the world stops painting while collages are open. The sky is the stage's CSS background. A clear coat (hot spot, softbox strips, rim) is drawn on `#world-gloss` only when the globe moves on screen, and hidden in cities. Resolution starts at the screen's full density (up to 3×) and `sharpen()` steps it down half a step at a time if it can't hold ~45 fps. The globe's distance is dealt log-uniformly from φ⁻⁴ (a small world far off) to √φ on every visit, and it swings to a new distance every φ⁵–φ⁷ s when nobody has touched anything for φ⁴ s (`swing`, with a CSS perspective lean on the stage); pressing a world small enough to be seen whole fires it in round the point pressed (a "rocket": wind-back, burst with speed lines/flash/ring on `#burst`, motion blur, perspective kick, shake, spring); tapping the sky bounces to a new framing; pinch (stage is `touch-action: none`), wheel and dragging the sky move the view by hand; `keepHold()` never lets the world be stranded off-screen. Names hide when the world is far; words scale with its distance. No coastline is drawn — the land is its own edge. Coming up from a city restores the exact view. No titles or artists are written — the saved list stays private. |
| `scripts/build_tones.py` | Writes `docs/v2/tones.json` — the colours measured off each collage's own photograph, which is what the continents wear. |

`docs/` and the Wix site are separate. Changes to one do not reach the other.

The GitHub Pages site is the real one: <https://9gn957ptsb-alt.github.io/Art-Database/>.

**The repository was renamed** from `Color-Middling` to `Art-Database`. Git
pushes to the old name still work, because GitHub redirects them — which is
exactly why it went unnoticed — but Pages serves from the current name, so
any link built from the old one is a 404. The working copy may still sit in a
directory called `Color-Middling`; that means nothing. Build links from
`Art-Database`, or better, read the URL out of the deploy: the pages workflow
logs `Evaluated environment url:` on every run.
The two versions have names:

- **Umbrella Portfolio 2026** (`docs/`, served at `/`) — the link submitted to an
  open call. **Frozen**; change it only when asked.
- **Artist Website** (`docs/v2/`, served at `/v2/`) — the site that carries on
  from here, and where work happens now.

The two were forked on 16 Sep 2026. `scripts/build_page.py` writes only `/`; do
not point it at v2 again without saying so, as it would overwrite the redesign.
A change to `works.json` no longer reaches v2 — make it in both places if it
belongs in both.

The live site's design is the one the Wix assistant built, not `docs/`. `docs/`
is a reference for the works and their captions; it is not a target the Wix site
is matched to. See "Matching the reference design — SUPERSEDED" in `WIX.md`.

## Working preferences

- **Whenever the words "Artist Website" appear in a reply, write them as a
  link to the site: [Artist Website](https://9gn957ptsb-alt.github.io/Art-Database/v2/).**
  Every time, the way the DIRT session always links the word DIRT to its
  artifact (artist's request, 23 Sep 2026). That link is the one link to
  everything — never a deep link into the page.
- Don't paste a bare URL on every update — say it's done; the linked words
  carry the link. Keep publishing the updated artifact each time.
- The work photographs are placeholders until shot properly. Don't crop or
  retouch them. They are wanted on the live site as they are — but images cannot
  be uploaded to Wix from a session (see `WIX.md`), so the artist uploads them by
  hand and a session then matches them to rows.
- Writings about a collage — the artist's or anyone's — go in `writings` on that
  work in `docs/works.json`, as `[{"text": "...", "by": "..."}]`. The Artist
  Website deals them with the collage. There are none yet; never write them.
- Don't invent artwork metadata. Titles and years come from the artist;
  dimensions are blank until given.
- `data/` never gets committed. It is the artist's whole Artsy saved-works list
  and this repository is public. Only `docs/v2/land.json` — the distilled
  fraction `scripts/build_land.py` writes — belongs in git.
- The land's words come from `terms` in `docs/works.json` and link to **his**
  works. No Artsy work is ever what a word stands on.
- The token objects the creature turns up — three colours to throw — are the
  **Hubble Space Telescope's photographs** (artist's request, 23 Sep 2026),
  read live in the visitor's browser from NASA's image library
  (`images-api.nasa.gov`), colours measured off each thumbnail, each linking to
  its `images.nasa.gov/details/<id>` page. The Artsy saves in `land.json` are
  only the fallback while those load or if NASA can't be reached. NASA's hosts
  are blocked from the session sandbox, so this can only be tested there
  against a stand-in (`page.route`). A Hubble telescope orbits the globe in the
  far views (`placeHubble`); pressing it opens one of its photographs.

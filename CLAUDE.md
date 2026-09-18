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
| `docs/v2/` | **Artist Website** — the ongoing site, served at `/v2/`. Hand-edited; the generator does not write it. Shares `docs/images/`. |
| `docs/works.json` | The works, as data. Edit this, not `index.html`. |
| `scripts/build_page.py` | Renders `docs/index.html` from `works.json`. |
| `scripts/build_artifact.py` | Flattens the page for publishing as an Artifact. |
| `WIX.md` | The live Wix site: CMS schema, current rows, and the to-do list. |
| `docs/v2/land.html` | **The land** — a turnable world made of the works' own words, and what grazes on it. `land.css`, `land.js`, `land.json`. |
| `scripts/build_land.py` | Writes `docs/v2/land.json` from the private Artsy dump. |
| `scripts/fetch_artsy_saves.py` | Fetches that dump into `data/`, which is gitignored and stays that way — the repo is public. |
| `scripts/build_earth.py` | Writes `docs/v2/earth.json` — the land mask the weave is shaped by. Natural Earth 110m, public domain; the download it works from goes to `data/`. |

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

- Don't paste the artifact or site link on every update — say it's done. Keep
  publishing the updated artifact each time, just without the link.
- The work photographs are placeholders until shot properly. Don't crop or
  retouch them. They are wanted on the live site as they are — but images cannot
  be uploaded to Wix from a session (see `WIX.md`), so the artist uploads them by
  hand and a session then matches them to rows.
- Don't invent artwork metadata. Titles and years come from the artist;
  dimensions are blank until given.
- `data/` never gets committed. It is the artist's whole Artsy saved-works list
  and this repository is public. Only `docs/v2/land.json` — the distilled
  fraction `scripts/build_land.py` writes — belongs in git.
- The land's words come from `terms` in `docs/works.json` and link to **his**
  works. Artsy saves are only the token objects the creature turns up — three
  colours to throw. No Artsy work is ever what a word stands on.

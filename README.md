# Art database

A searchable database of artworks, seeded from ~4,000 saved works on
[Artsy](https://www.artsy.net) and designed to grow over time. Museum-visit photos
(an artwork shot followed by its label shot) are a planned second source.

## Status

The Artsy import has run: `data/artsy_saves_raw.json` holds 4,969 raw saved-artwork
records fetched via `scripts/fetch_artsy_saves.py`. That raw data has been normalized
into `data/artworks.db`, a searchable SQLite database, via
`scripts/normalize_artsy_saves.py`. Museum-visit photos and a real UI on top of the
database are still to come.

## Why the setup is fiddly

Artsy saves are private to an account, and `artsy.net` is not on the default **Trusted**
network allowlist for Claude Code cloud sessions, so a session cannot reach it at all. The
import therefore needs an environment that both allows the domain and holds an Artsy token.

The token is stored as an **environment API credential**, not in this repo and not in the chat.
Anthropic's agent proxy attaches it to requests *after they leave the session*, so the token
never enters Claude's context. `scripts/fetch_artsy_saves.py` sends no token of its own.

`data/*.json` is tracked with **Git LFS** (GitHub warns above ~50MB for a plain git blob, and
the raw saves file is ~57MB). Pushing an LFS-tracked file needs `lfs.github.com` reachable in
addition to `github.com` — see step 4 below.

## Setup

### 1. Get an Artsy user access token

The token must be user-scoped; an app-only (`X-XAPP-TOKEN`) token cannot read personal saves.
Either register an application at `developers.artsy.net/client_applications` and follow the
OAuth flow in Artsy's live documentation, or read the token from an already-logged-in browser
session on artsy.net (DevTools → Application → cookies / local storage).

The token carries broad account privileges, not just read-saves. Revoke it once the import
is done.

### 2. Create the cloud environment

At [claude.ai/code](https://claude.ai/code), select the cloud icon showing the environment
name in the row above the message box. There is no settings page or direct URL.

1. **Add cloud environment** → name it `Artsy` → **Network access: Custom** → **Allowed
   domains**: `api.artsy.net`, `artsy.net`, `github.com`, and `lfs.github.com` → check **Also
   include default list of common package managers** → **Create environment**. `github.com`
   and `lfs.github.com` are needed to push commits and the LFS-tracked data file (step 4) —
   easy to miss since plain `git push`/`pull` can work without them but an LFS object upload
   cannot.
2. Reopen it for editing (hover → gear icon). API credentials can only be added when editing
   an environment that already exists, not in the creation dialog.
3. **API credentials** → **Add credential**:
   - **Name**: `Artsy`
   - **Allowed websites**: `api.artsy.net`
   - **Custom headers**: name `X-ACCESS-TOKEN`, **prefix cleared** (the header takes the bare
     token, not a `Bearer` prefix), value = the token from step 1
   - **Connect**

Requires a Pro or Max plan; API credentials are not available on Team or Enterprise. Without
them, run the fetch script locally with the token in the environment instead.

### 3. Run the import

Start a **new** session in the `Artsy` environment — environment config is read at session
startup, so an already-running session cannot pick up the change.

```bash
python3 scripts/fetch_artsy_saves.py --probe   # inspect one record's shape first
python3 scripts/fetch_artsy_saves.py           # full run, ~40 pages
```

`--probe` is worth running first: it prints one record's real field names so normalisation is
based on the actual payload rather than assumptions. Output lands in
`data/artsy_saves_raw.json`.

### 4. Push the result (Git LFS)

`data/*.json` is tracked via Git LFS (see `.gitattributes`), so `git add`/`git commit` produce
a small pointer file locally but `git push` also needs to upload the real object to
`lfs.github.com`. That call goes through the environment's general egress proxy — unlike a
plain `git push`/`pull` to `github.com`, which Anthropic's proxy handles separately via
credential injection and can succeed even when `github.com` isn't on the environment's allowed
list. If `lfs.github.com` isn't allowed, the push fails partway with something like:

```
Post "https://lfs.github.com/<owner>/<repo>/objects/<oid>/verify": Forbidden
```

Fix: add `lfs.github.com` (and `github.com`, to be safe) to the environment's allowed domains
per step 2, then start a **new** session — environment config is only read at session startup,
so a session already running when the domain list changes can't pick it up.

## The database

`data/artworks.db` is a plain SQLite file, generated from the raw dump by
`scripts/normalize_artsy_saves.py`. Rebuild it (e.g. after a fresh fetch) with:

```bash
python3 scripts/normalize_artsy_saves.py
```

It's an ordinary SQLite database — open it with any SQLite client (`sqlite3
data/artworks.db`, DB Browser for SQLite, a Python `sqlite3` connection, etc.) — with:

- **`artworks`** — one row per saved piece: title, primary artist/partner, category,
  medium, date, dimensions, price/availability, a representative image URL, the Artsy
  URL, and save/publish timestamps. Indexed on artist name, category, for-sale, and
  save date.
- **`artwork_artists`** — one row per (artwork, artist), for pieces with more than one
  artist/maker.
- **`artwork_colors`** — one row per (artwork, dominant color), hex plus decoded RGB, so
  the collection can be browsed or filtered by color.
- **`artworks_fts`** — an FTS5 full-text index over title, artist names, medium,
  category, partner, and blurb.

`scripts/search_artworks.py` is a small CLI over the database, mainly to prove it
works — a real UI is still to come:

```bash
python3 scripts/search_artworks.py "heart"                  # full-text search
python3 scripts/search_artworks.py --artist "Rudy Autio"
python3 scripts/search_artworks.py --category Painting --forsale
python3 scripts/search_artworks.py --color "#3a6ea5" --color-tolerance 40
```

## Shapes

The three dominant colors per work carry more than a hue ranking, so the page offers
five arrangements of the same 4,969 records. Each is a layout function returning one
rect per work; a shared renderer draws them and a shared pick buffer (the work's index
encoded as an RGB value on an offscreen canvas) resolves what the cursor is over, so a
new arrangement costs a layout function and nothing else.

| Shape | Arrangement |
| --- | --- |
| Spectrum | every work as a strip, ordered neutral then around the hue wheel |
| Wheel | hue as angle, chroma as radius; neutrals fill the inner disc |
| Value / chroma | lightness against saturation — the plane painters mix on |
| Chords | grouped by how the palette is built, not by which hue leads |
| Artists | one contiguous band per artist, artists ordered by mean hue |

**Chords** classify the *relationship* between a work's three colors rather than their
positions, which turns out to be a second axis independent of the hue facets:

| Chord | Test | Works |
| --- | --- | --- |
| Monochrome | chromatic hues within 25° | 1,747 |
| Neutral | no color reaches 0.15 saturation | 1,173 |
| Accent | exactly one color carries chroma | 1,144 |
| Complementary | hues 140° or more apart | 378 |
| Analogous | hues within 70° | 364 |
| Split | the 70–140° middle ground | 163 |

## Thumbnails

`scripts/fetch_thumbnails.py` downloads each work's image, resizes it and writes
`data/thumbs.json` as WebP data URIs, which `build_artifact.py` inlines. The page falls
back to rendering a work from its three colors wherever a thumbnail is missing, so it
builds with or without them.

```bash
python3 scripts/fetch_thumbnails.py --probe   # 40 works, projects the full page size
python3 scripts/fetch_thumbnails.py           # all of them
```

Two constraints drive the settings:

- **The images must ship inside the HTML.** Artifacts block external images under CSP,
  so the CDN cannot be fetched at runtime. With a 16MB page limit, ~1.4MB of metadata
  already spent, and base64 inflating every byte by 4/3, the budget is roughly 2KB per
  work across 4,968 works — hence WebP at a small edge. Run `--probe` before a full
  run; it projects the finished page size from a 40-work sample.
- **The image CDN needs allowing.** Every image is on
  `d32dm0rphc51dk.cloudfront.net`, which is not `artsy.net`. Without it on the
  environment's allowed domains the fetch fails with a refused proxy connection.

## One artifact

Everything generated from the collection's colours lives in a **single published
artifact**, and new objects are added to it rather than published separately —
otherwise the artifacts gallery fills up with near-duplicates and stops being useful.

```bash
python3 scripts/build_theme.py        # themed objects  -> data/theme_ancient.json
python3 scripts/build_waterfall.py    # abstract object -> data/waterfall.json
python3 scripts/build_objects.py      # merge both      -> data/objects.json
```

`artifact/objects.template.html` + `data/objects.json` build `artifact/objects.html`,
which is republished to the same artifact URL every time. Two object kinds share one
renderer: `shimmer` (a still sprite whose palette breathes) and `frames` (a precomputed
animation). Adding a theme means adding its objects to the merge, not a new page.

### Feedback is the memory between objects

The page declares the `db` capability, so aesthetic feedback is stored **with the
artifact** rather than in a browser — which is the only reason it can be read back
later. Each submission is a document in `feedback`:

| Field | Meaning |
| --- | --- |
| `object`, `objectName`, `theme` | which object is being judged |
| `rating` | 1–5, how much it lands |
| `verdicts` | per-axis `up`/`down` over palette, silhouette, shading, detail, chunkiness, motion, colour drift, subject |
| `note` | free text |
| `at` | ISO timestamp |

Read it back before designing the next object:

```
Artifact  action: read_db  url: <artifact url>  db_op: list  collection: feedback
```

Each object also ships a `built` record — its grid, its ramp, how many real colours
backed each step, and what making it taught — shown on the page and carried in
`data/objects.json`. Between that and the feedback rows, the next object starts from
what the last ones established rather than from nothing.

## Pixel art rules these sprites follow

Rewritten after the first objects came out gritty. Three faults, all structural, and
all confirmed against pixel-art fundamentals rather than guessed at:

- **Per-cell colour variation is grit.** Every cell used to pick its own
  near-identical colour, so a region that should read as one flat shape was really
  hundreds of slightly different ones. Cycling now happens at the **slot** level: a
  whole region holds one colour and changes as one, the way sprite art animated water
  and fire for decades.
- **A ramp that only changes value reads as flat clip art.** Hue shifting — shadows
  drifting cooler, highlights warmer — is most of what makes a ramp read as light on a
  form. Every ramp here shifts hue as well as value.
- **Procedural shapes produce gradients and orphan pixels.** Pixel art wants deliberate
  clusters where every pixel belongs to a shape. Silhouettes are now authored as
  explicit spans and the contour is traced from the silhouette boundary — computing an
  outline per row stacks a dark band down every diagonal and buries the object.

Also load-bearing: nothing is one pixel thick (a one-pixel leg reads as a speck), legs
and handles run unbroken from the body, and **there are no backgrounds** — a hole is
transparent, so only the object and its contour are drawn and only they are clickable.

Sizes are small on purpose: 21 × 23, 19 × 20, 17 × 26. Every pixel is a decision, and
repeated pixels referencing the same artwork are fine — flatness beats variety.

```bash
python3 scripts/build_sprites.py --preview   # PNGs of each sprite
python3 scripts/build_sprites.py             # -> data/sprites.json
```

## Themes

`scripts/build_theme.py` builds pixel objects out of the collection's own colours.
The theme is chosen **by the data, not by taste** — counted before anything is drawn:

| Ramp target | Colours available within tolerance |
| --- | --- |
| Limestone light | 778 |
| Papyrus ground | 563 |
| Black-figure black | 485 |
| Terracotta mid | 49 |
| Christmas bright red | 5 |
| Christmas holly green | 2 |
| Christmas pine | 1 |

There is no pine green in this collection. An **Ancient** object can be built honestly
from it — amphora, scarab, Doric column — where a Christmas one could only be faked.
That is the rule for every future theme: count the palette first, and build what the
collection can actually render.

```bash
python3 scripts/build_theme.py
python3 scripts/build_theme.py --preview   # PNGs of each object, no JSON
```

Each object is authored as a designed ramp of slots, and **every slot is backed by
dozens of near-identical real colours**. That keeps sprite-art flatness and hard edges
while preserving identity per block: a flat-looking area is really dozens of separate
artworks. Each cell walks its slot's cycle at its own phase, and neighbouring cells hold
neighbouring phases, so the shimmer travels across a surface like firelight instead of
sparkling at random. Ordering the cycle matters as much as choosing it — walked at
random the same set strobes, walked smoothly it breathes.

Three things had to be found by looking at the render:

- **The ground has to silhouette.** The column's first background sat at the same value
  as the stone, so it read as vertical stripes rather than a column.
- **Flutes need hard steps.** A soft cylinder gradient at this resolution is a blurred
  stripe, not carved stone.
- **A narrow shading falloff crushes the shadow side into one slot**, splitting every
  round form into a light half and a dark half with a seam down the middle.

## The waterfall

Kept as the theme-less, abstract object — the one to reach for when a theme wants
something that is a motion rather than a thing.



`scripts/build_waterfall.py` renders the collection's colours as a looping waterfall.
It writes `data/waterfall.json` — grid, palette and a small inlined preview image per
work — which `artifact/waterfall.html` replays on a canvas. Press and hold any block
and the work that colour came from pops out beside the fall, **while the water keeps
running**: the block's identity is captured at the moment of the press, because the
water under the cursor moves on and a live preview would just flicker. `--gif` also writes a
non-interactive `artifact/waterfall.gif`; the canvas is the real deliverable, since a
GIF cannot carry links.

```bash
python3 scripts/build_waterfall.py
python3 scripts/build_waterfall.py --preview 8   # PNG frames, no JSON
python3 scripts/build_waterfall.py --gif
```

It is **palette-constrained rendering**: the waterfall is designed first — plunging
sheet, rock banks, crest, whitewater streaks, churning plunge pool — as a field of
target lightness, and then each block is filled with the closest real colour from
`artwork_colors`. Colours and works repeat, which is what makes the match possible.
**No colour is ever altered**, so every block still maps back to a work you can open.

The composition follows reference photographs of real falls rather than an
invented one: a narrow lip, a body that flares as it drops and breaks into discrete
filaments, a luminous bloom where it lands, mist thickening toward the foot, and rock
massing at the ledges — the fall as a silhouette against an atmosphere, not a
full-bleed panel.

Currently in **blue mode** (`--palette blue`, the default): blues, cyans, teals and
every neutral — what a waterfall is actually made of. The hue anchor drifts gently
through the blues across the loop rather than walking the full journey, because that
journey is 83% neutral in this collection and walking it drags the whole scene
grey-tan. `--palette full` opens it back to the whole wheel.

The grid is deliberately coarse (32 × 44) and slow (130ms a frame, falling two rows
at a time). The blocks are the interface — they have to be big enough to press, and a
fast fall reads as noise rather than water.

**The water is white and the environment carries the hue.** That is what lets the loop
travel the whole database while still reading as one waterfall: it looks like the same
fall lit by changing light, rather than water that turns orange.

Three pools feed it, because a waterfall is not one material:

| Pool | Source | Behaviour |
| --- | --- | --- |
| Foam | lightest colours (L ≥ 0.72) | ignores the hue phase — real whitewater is white in any light, which is what keeps the fall legible once the water reaches the oranges |
| Rock | darkest colours (L ≤ 0.25) | static in screen space; banks do not fall |
| Water | the current hue band | walks the whole journey over one loop |

Two things had to be found by looking at the render rather than reasoned about first:

- **The band has to widen itself.** The journey is sorted by hue *then* lightness, so a
  narrow window is narrow in both — ask it for a dark block and it hands back another
  pale one, and the sheet washes out to a flat panel. The band now grows until it spans
  0.46 of lightness range, from 363 colours up to ~3,343 in the palest stretches.
- **Matching on lightness alone speckles.** A wide band holds many hues at one
  lightness, so neighbouring blocks landed on unrelated colours and the mist turned to
  confetti. Selection now prefers the band's hue, with neutrals carrying a discounted
  distance because grey haze belongs in any light.
- **Filaments are not noise.** Per-column noise reads as static however it is tuned.
  Water breaks into threads that hold together down the drop and spread apart as they
  go, so each of the 30 strands keeps its own lip position, drift, width, gain and
  scrolling intensity.
- **An earlier ribbon-scrolling design failed outright.** Columns need different fall
  rates or the sheet reads as rigid, but unbounded drift put one column in the whites and
  its neighbour in the oranges — television static. Designing the image and then matching
  colours to it replaced that approach entirely.
- **Hue penalty scales with saturation.** A true grey belongs in any light, but a warm
  grey still reads warm, and enough of them turn a blue fall tan. The penalty is now
  weighted by each colour's own saturation.
- **Hard boundaries show.** The rock ledge originally stopped at a fixed `ny`, drawing a
  seam straight across the frame that no colour choice could hide; it now fades out.

Everything time-varying is periodic over the frame count, so the loop closes exactly.

## Keeping it in sync

Artsy publishes no webhook for saves, so this polls:

```bash
python3 scripts/sync_artsy_saves.py           # incremental
python3 scripts/sync_artsy_saves.py --check   # report new saves, change nothing
python3 scripts/sync_artsy_saves.py --full    # re-fetch everything (catches un-saves)
```

A run walks the collection newest-first, stops once it has seen 60 works it already
holds (normally one page), then appends any new ones to the raw dump, re-normalizes,
fetches thumbnails for only the new works, and rebuilds the page.

A daily Routine runs this at 07:23 UTC in the `Artsy` cloud environment, commits and
pushes anything new, and republishes the artifact. It stays silent on the usual "no new
saves" outcome. Manage it in the claude.ai Routines UI.

### Two ordering traps

Both were found the hard way; the incremental logic depends on getting them right.

- **`last_saved_at` is not this account's save time.** It records when *anyone* last
  saved the work — every work with 30+ global saves reads as saved today, while works
  nobody else saves average 2024. It cannot be used to find new saves, to sort by
  recency, or to chart saving activity over time. The `save_rank` column carries the
  real order instead (0 = most recent).
- **The saves endpoint returns the collection oldest-first by default**, not
  `POSITION_DESC` as Artsy's schema suggests. That is why the raw dump is in true save
  order and `save_rank` can be derived from its position. `sort=-created_at` reverses it
  for the incremental walk; `sort=-position` behaves the same. Anything else
  (`saved_at`, `last_saved_at`) is rejected as an invalid parameter.

## API reference

Endpoint and header names were read from Artsy's open-source GraphQL API,
[artsy/metaphysics](https://github.com/artsy/metaphysics), rather than guessed:

| Detail | Value | Source file |
| --- | --- | --- |
| REST endpoint | `collection/saved-artwork/artworks` (base `api.artsy.net/api/v1`) | `src/lib/loaders/loaders_with_authentication/gravity.ts` |
| User auth header | `X-ACCESS-TOKEN` | `src/lib/apis/gravity.ts` |
| App auth header | `X-XAPP-TOKEN` | `src/lib/apis/gravity.ts` |
| GraphQL equivalent | `me { savedArtworksConnection }` — args `size`, `page`, `sort` (default `POSITION_DESC`), `private` | `src/schema/v2/me/savedArtworks.ts` |

## The browser page

`artifact/color-middling.html` is a single self-contained page: a search engine over the
whole collection, plus hue/category/for-sale facets and a hue-ordered spectrum of every
work that doubles as a filter control. Rebuild it after a fresh normalize with:

```bash
python3 scripts/build_artifact.py
```

The build injects a compact JSON payload from `data/artworks.db` into
`artifact/index.template.html`. Edit the template, never the built file — a rebuild
overwrites it. At ~5,000 works the page is about 1.4MB.

### Search

The page builds an in-memory inverted index over title, artist and co-artists,
nationality, artist life dates, medium, category, gallery and date, and ranks with
weighted TF-IDF (artist outweighs title outweighs medium). Queries are ANDed, the last
word is prefix-matched as you type, and searches land in 1–3ms.

```
cezanne                     accent-folded; finds Cézanne
spanish                     nationality is indexed, so this finds Picasso, Dalí, Miró
artist:twombly              scope with artist: title: medium: category: gallery:
                            nationality: or year:
year:1960-1970              range or single year, matched against the work's date
"blue nude"                 quoted phrases must appear intact
lithograph title:untitled   scoped and unscoped terms combine
```

Two things worth knowing if you touch the ranking:

- **Accent folding is not optional here.** 87 of the 1,231 artists carry diacritics
  (Cézanne, Miró, Dürer, Kertész) and nobody types them, so `fold()` strips combining
  marks before both indexing and querying.
- **Spelling correction weighs frequency against edit distance**, rather than letting
  the nearest ring win outright. `picaso` sits one edit from both Picasso (217 works)
  and the one-off José Picayo; `turel` sits *two* edits from Turrell (35 works) but one
  from a junk token. Candidates are ranked by `df / distance²`, which gets both right —
  ranking by edit distance alone gets both wrong.

### Why it draws colors instead of thumbnails

Published artifacts block external images under CSP, so Artsy's thumbnails cannot render
inline, and embedding ~5,000 images as data URIs would exceed the 16MB page limit. Rather
than settle for a text table, the page draws each work from its three `dominant_colors` at
the true aspect ratio implied by `width_cm`/`height_cm`, and links out to Artsy per work.
A plain HTML file opened locally has no such CSP restriction if inline thumbnails ever
matter more than a shareable link.

One thing worth knowing if you extend the hue filtering: this collection is heavily
earth-toned, and binning strictly by hue angle files ~47% of it under "orange". The page
splits low-saturation warm tones (saturation < 0.38, hue 15–70°) into a separate **Earth**
bin to keep the filters meaningful.

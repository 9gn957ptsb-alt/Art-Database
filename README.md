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
artifact**, and new objects are added to it rather than published separately.

```bash
python3 scripts/build_iso.py      # every object as a voxel model -> data/iso.json
python3 scripts/build_objects.py  # merge -> data/objects.json + artifact/objects.html
```

## One artwork per colour region

Every contiguous patch of one ramp step is found by connected-component labelling and
given **its own artwork, permanently**.

That is a change of unit. Colour used to be carried per ramp step, so every patch at the
same step anywhere in the picture was the same work, and a whole object only ever held
as many works as its ramp had steps — eleven. A patch is the thing the eye reads as a
shape, so a patch is what should carry an identity. The waterfall now holds 1,884
regions instead of 11 tones, and pressing one reaches the work behind *that shape*
rather than behind that tone.

Regions are 4-connected, not 8: patches meeting only at a corner are two shapes to the
eye, and one artwork across that join would link something nobody reads as joined.

Each region draws from the colours nearest its own step, so the picture looks the same,
with a little more variation between neighbouring patches — which is what real pigment
does anyway. The link is **fixed**: one region, one work, no cycling. Colour no longer
drifts over time, because a link that moves is not a link.

## Everything is isometric

Objects are **voxel models**, projected by `scripts/iso.py`. A flat grid cannot survive
the change: a thing seen from a corner has three visible faces, and which face a pixel
belongs to decides its colour.

The projection is **true isometry**, not the 2:1 dimetric that pixel art normally uses.
All three axes foreshorten equally and edges run at exactly 30 degrees — verified, not
assumed: the unit axes project to equal lengths and sit 120 degrees apart. It costs
something real, because sqrt(3):1 lands on no integer step, so edges stair-step
irregularly where 2:1 would be even. It buys a drawing that can be measured: a length
along x, y or z is the same length on the page. 2:1 stretches the vertical about 15%
against the other two, which is why every object came out subtly squat before.

Objects stand on a **ruled ground plane**, which overrides the no-backgrounds rule for
isometric work only. An axonometric projection has no horizon and no convergence, so an
object drawn alone has no height, no size and nowhere to be. The plane is voxels one
layer below the floor, so it sorts in the painter's order with everything else, and its
tiles double as a ruler. The cast shadow darkens the plane's own tiles rather than
floating a dark shape above them.

How each family converted — nothing was redrawn in isometric:

| Family | Conversion |
| --- | --- |
| Amphora, Column | Solids of revolution. They already *were* profiles — a half-width per row — so `revolve` lifts them at no cost. |
| Scarab | Extruded under a dome from the flat sprite's own slot grid, so the wing-case seam, legs and lapis inlay come up with it. |
| The five panels | Set into the floor as mosaics. They were always modular grids; standing them upright would foreshorten the composition into illegibility. |
| Waterfall | A sheet shaped by height — narrow lip, flaring as it drops — landing in a spreading pool. |
| Falling Leaves | Bodies at real (x, y, z), yawing as they fall. |
| Bounce | New. A ball, filling the family the motion axis declared and left empty. |

Five things this took to get right, each a real failure first:

- **The projection's scale must be even, or the geometry must be float.** At an odd
  half-width the rhombus half-height truncates, faces stop tiling, and every gap is a
  hole through to the back of the model. Invisible on a cube, obvious on a sphere.
- **Cull faces in exactly one place.** A shell pass before rendering deletes the interior
  voxels the renderer needs as *occluders*, opening every back face through the front.
- **Shade per voxel from the surface normal, not per face.** Face shading is right for a
  cube and wrong for a curve: it combs a sphere into corduroy. Primitives that know their
  analytic normal pass it in, because a neighbour-derived normal has only 26 directions
  and bands a smooth body into patches.
- **The light vector is world-space, not screen-space.** -x projects up-left and -y
  up-right, so a light at (-1,-1,1) is straight overhead on screen and stripes the form
  horizontally.
- **A material must leave room for its own lighting.** A flat top face shades +2, so a
  ground material set too high runs off the end of its band and renders in the next
  one — which is how the stone platform first came out navy.

Quarter-turn rotation is free: a turn is a permutation of x and y, exact, with normals
rotating along. A still object's four stored frames are its four facings. Hand-drawn
isometric sprites have to author every facing separately; this is the one thing the
engine gets that the games it is imitating had to pay for.

## Objects are organised by how much they move

Every object sits on one axis, declared once in `scripts/motion.py`: how much it moves,
which tracks how much it is *for*. A painting barely moves because it has almost no
utility beyond being looked at; a hammer moves a great deal because the swing is the
whole point. Objects near each other on that axis need the same machinery.

| Motion | Family | Members | Shares |
| --- | --- | --- | --- |
| 0.04 | Panel | Colour Sound | grid + per-slot colour cycles |
| 0.18 | Vessel | Amphora, Scarab, Column | grid + per-slot colour cycles |
| 0.62 | Descent | Waterfall, Falling Leaves | lightness pools, wrapping noise, gravity, drift |
| 0.78 | Bounce | *(empty)* | the descent engine, plus a restitution arc |
| 0.94 | Strike | *(empty)* | the descent engine, plus a pivot |

Identity comes first. A painting used as a hammer is a clever thought, but for image
generation what the object *is* governs how it is drawn, so the axis records the motion
an object actually has, not the motion it could be put to.

**This is how storage stays small.** Kin share build code, so a new object in an
existing family is a spec rather than a second engine — and, more importantly, they
share *stored form*:

| | as stored | as the other family member is stored |
| --- | --- | --- |
| Falling Leaves | ~40 KB (34 tracks + 4 sprites) | ~2 MB as one grid per frame |
| Waterfall | 231 KB (9 slot indices per block) | 2.06 MB as palette indices |

Three renderer kinds carry all of it, and all three store *slots*, not colours,
resolving them through the same per-slot cycles:

- `sprite` — a still grid whose palette breathes. Panels and vessels.
- `field` — one grid of slot indices per frame, for a continuous body with no parts.
- `descent` — a program: sprites, a static part, one track per falling body.

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

`scripts/build_sprites.py` builds pixel objects out of the collection's own colours.
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
python3 scripts/build_sprites.py
python3 scripts/build_sprites.py --preview   # PNGs of each object, no JSON
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

Rebuilt against a cerulean reference, and the priority was inverted on request: the
**picture comes first**, the census second. Nine slots are quantised straight off the
reference — `#011432` through `#0057b3` and `#1da6f5` to white — and each is backed by
the closest real colours in the collection, however few. Seventy-nine works stand in
for the whole fall, where the earlier version put 1,609 on screen and let the palette
drift with them.

```bash
python3 scripts/build_falls.py
python3 scripts/build_falls.py --preview 4   # PNG frames, no JSON
```

The composition is read off the reference: a sheet whose right edge runs diagonally
from a high lip down to the foot, filaments running the length of the drop and
diverging as they fall, a white detonation where it lands, and a banded pool across
the bottom. No sky — the object and its contour are the whole of what exists and the
whole of what is clickable.

What the rebuild settled:

- **Matching every block to its own nearest real colour is what made it grit.** Nine
  fixed slots, cycled as whole regions, is what reads as pixel art — and it is also
  ten times smaller on disk.
- **The image hangs on one diagonal.** White just inside the falling edge with a hard
  navy contour on it is what makes that edge read as drawn rather than as the place
  the picture stops. The contour is traced from the silhouette; testing a threshold
  per block leaves it broken into specks wherever the diagonal steps sideways.
- **Draw the sheet between two ramps, not as one gradient the filaments brighten.**
  Brightening a mid-blue base only ever produces mid-blue; the reference's whole
  character is white threads against deep navy.
- **The pool is horizontal lines, not a gradient.** A soft pool under a hard-edged
  fall reads as a mistake.

## Falling leaves

The descent family's second member — the same motion with a different payload. Water
is a sheet, so it is stored as pictures; leaves are bodies, so they are stored as a
program and rebuilt on the fly. Autumn because the collection is 33.8% earth tones:
rust and amber are the deepest colour it has.

```bash
python3 scripts/build_leaves.py
python3 scripts/build_leaves.py --preview 4
```

- **A leaf holds one tint for the whole fall.** Letting the colour drift mid-air, the
  way the sheet's hue band drifts, reads as a glitch rather than as a leaf.
- **Every period has to divide the loop** — whole falls, whole sway cycles, whole
  yaws. One leaf out of phase and the seam is the only thing you can see.
- **Stratify the leaves across the columns.** Random x piles them on one side and
  leaves the other empty, which reads as a spill rather than a fall.
- **Draw the bough as a slope that tapers off-frame.** A horizontal limb with vertical
  stubs reads as a table, which is exactly what the first attempt looked like.
- Edge-on, a leaf is still two pixels deep. At one pixel it reads as dust.

## Abstract: five panels in Karl Gerstner's grammar

`scripts/build_abstract.py` builds one panel per composition. The grammar, read off
the works: flat colour only — no shading, no gradient, no outline; a modular grid
subdivided systematically; nested concentric bands; self-similarity; few hues in even
steps; order by permutation rather than by eye.

| Panel | Construction |
| --- | --- |
| Colour Sound | Nested square rings in a 9 × 9 module of 2-pixel cells, arch carved out of the amber core |
| St. Jaques | A lobed fan of nested bands on a stem — lobes are the radius modulated by angle, so the nesting stays exact |
| Colour Fractal | True recursion: a disc holds four discs, each holding four discs, each holding four squares |
| Spannungsbild | A violet field lit from four edge points, inside a black surround, around a near-black square |
| Chromorphose | Stacked bars — black, a stepped grey ramp, cream — with a red block banded across the join |

Palettes come from the works and are matched to the nearest real colours **however few
there are**: the picture first, the census second. Some of it is out of reach, and the
gap is worth stating plainly.

| Reference colour | Near matches in 14,542 dominant colours (tol 16) |
| --- | --- |
| St. Jaques orange `#ff7901` | 0 |
| Colour Fractal pink `#e692c8` | 2 |
| Spannungsbild violet `#3d337e` | 2 |
| Colour Sound amber `#dba553` | 28 |
| St. Jaques dark frame `#522f18` | 166 |
| Chromorphose cream `#e7dcb0` | 240 |

His saturated work is out of reach here — 1.2% of these colours are violet or magenta
against 33.8% earth — so the oranges and violets come out earthier than the originals.

What the panels settled:

- **This grammar forbids the shading the sprites depend on**, so contrast has to come
  from the ramp step alone. Rings step by two, not one: adjacent steps read as one
  colour at this size.
- **Pull a ramp wider than the work's own when the collection cannot separate it.**
  `#d3a0d5` and `#e692c8` both resolve to the same real mauves, so Colour Fractal's
  middle rank of discs vanished into the disc holding it until the steps were spread.
- **Leave room between a shape and its offset.** At radius 2.6 on a 2.9 offset the four
  discs touch and the cluster reads as one square, which destroys the recursion the
  whole panel is about.
- **Let the ground show through the module's gutter.** Filling a modular grid solid
  loses the grid and leaves a plain square.
- **Draw a seam only where there is something to split** — drawn unconditionally, the
  fan's seam shoots a spike out of the top of the composition.

## Two categories

**Formal** is anything with a recognisable form doing a recognisable thing — the
amphora, scarab and column, plus the waterfall and the falling leaves. **Abstract** is
the five panels, which are only themselves.

The page carries no text beyond the category names, the object names and the aesthetic
feedback. Everything that used to explain an object — its note, its build record, the
motion axis, the colophon — lives here in the README and in `scripts/motion.py`
instead. Press-and-hold still opens the work a block came from; that is the point of
the pixels, not chrome.

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

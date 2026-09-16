# Color Middling

Two things that will eventually meet:

1. **The site** — `docs/`. A single-page artist portfolio: plain HTML and CSS, no build
   step. See [`docs/README.md`](docs/README.md) for how to edit and publish it.
2. **The art database** — a searchable database of artworks, seeded from ~4,000 saved works
   on [Artsy](https://www.artsy.net) and designed to grow over time. Museum-visit photos
   (an artwork shot followed by its label shot) are a planned second source.

The two stay separate: **no work from the Artsy database is exhibited on the site.** Every
artwork the site shows as an artwork is Matthew's.

The land (`docs/v2/land.html`) keeps that line. Its words are Matthew's, taken from the
`terms` on his own works, and a word links to **his** works that share it. The Artsy saves
are used for one thing only: the **token objects** — a saved work condensed into the three
colours it reduces to, which the creature turns up and the visitor throws at it to repaint
it. Artsy works are that token and nothing more. They are never what a word stands on.

The rest of this file covers the database half.

## Status

The site stands up but is placeholder-filled — name, email, statement and all eight
captions still need replacing.

Database import tooling is ready. It cannot run until the Artsy API is reachable — see
setup below.

## Why the setup is fiddly

Artsy saves are private to an account, and `artsy.net` is not on the default **Trusted**
network allowlist for Claude Code cloud sessions, so a session cannot reach it at all. The
import therefore needs an environment that both allows the domain and holds an Artsy token.

The token is stored as an **environment API credential**, not in this repo and not in the chat.
Anthropic's agent proxy attaches it to requests *after they leave the session*, so the token
never enters Claude's context. `scripts/fetch_artsy_saves.py` sends no token of its own.

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
   domains**: `api.artsy.net` and `artsy.net` → check **Also include default list of common
   package managers** → **Create environment**.
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

## The dump stays out of git

`data/` is gitignored and must stay that way. The dump is Matthew's complete saved-works
list — 5,018 records, 58MB — and **this repository is public**, so committing it would
publish his entire collecting history. Nothing derived from it should carry more than a
page needs.

`scripts/build_land.py` is the only thing that reads it. It writes `docs/v2/land.json`,
the token supply: a couple of hundred saved works with title, artist, year, three dominant
colours and a thumbnail key, indexed by the handful of Matthew's words an Artsy medium also
says — paper, photograph, tape, watercolour — so the creature can turn up something that
shares the ground it is standing on. It is a small fraction of the dump, and the only part
that is committed.

The land's words are not built here. They come from `terms` in `docs/works.json`, which is
Matthew's own data; `build_land.py` reads them only to decide what to index.

```bash
python3 scripts/build_land.py
```

Run it wherever `data/artsy_saves_raw.json` is, then commit the regenerated
`docs/v2/land.json`.

## API reference

Endpoint and header names were read from Artsy's open-source GraphQL API,
[artsy/metaphysics](https://github.com/artsy/metaphysics), rather than guessed:

| Detail | Value | Source file |
| --- | --- | --- |
| REST endpoint | `collection/saved-artwork/artworks` (base `api.artsy.net/api/v1`) | `src/lib/loaders/loaders_with_authentication/gravity.ts` |
| User auth header | `X-ACCESS-TOKEN` | `src/lib/apis/gravity.ts` |
| App auth header | `X-XAPP-TOKEN` | `src/lib/apis/gravity.ts` |
| GraphQL equivalent | `me { savedArtworksConnection }` — args `size`, `page`, `sort` (default `POSITION_DESC`), `private` | `src/schema/v2/me/savedArtworks.ts` |

## Known constraint on the published artifact

Published artifacts block external images under CSP, so Artsy's thumbnails cannot render
inline, and embedding 4,000 images as data URIs would exceed the 16MB page limit. The
database will be metadata plus a link out to Artsy per work. A plain HTML file in this repo
has no such restriction if inline images matter more than a shareable link.

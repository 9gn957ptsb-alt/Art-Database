# Art database

A searchable database of artworks, seeded from ~4,000 saved works on
[Artsy](https://www.artsy.net) and designed to grow over time. Museum-visit photos
(an artwork shot followed by its label shot) are a planned second source.

## Status

The Artsy import has run: `data/artsy_saves_raw.json` holds 4,969 raw saved-artwork
records fetched via `scripts/fetch_artsy_saves.py`. Normalising that raw data into the
searchable database is the next step.

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

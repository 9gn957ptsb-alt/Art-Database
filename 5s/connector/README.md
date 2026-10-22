# 5s as a Claude connector

The artist, 22 Oct 2026: *"I also need you to develop 5s in a way where it can be a connector for
Claude. GitHub doesn't come up as an available connector."* 5s is *"a judgment app … you're
building an aesthetic database for people"*, *"a habit for people to digitally collectivize and
utilize their personal information, and their personal aesthetics"*; as a connector it goes
wherever Claude goes, so a person's taste can be *"put … before an object, or in a space or some
sort of experience"* (a sofa, a website, a gift, a trip), and the GitHub that Claude lacks comes
folded into 5s: connecting signs in on GitHub's own page, and from then on one button makes and
saves the person's hub.

What it is, technically: a remote MCP server on Cloudflare Workers (this folder), built the way
Cloudflare's own example for exactly this is built ([cloudflare/ai
`demos/remote-mcp-github-oauth`](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-github-oauth)):
`@cloudflare/workers-oauth-provider` is the OAuth server Claude talks to, GitHub is the sign-in,
and the `agents` package's `McpAgent` serves the tools at `/mcp`. Read [`../SPEC.md`](../SPEC.md)
"5s as a Claude connector" for the contract.

## The tools

Every tool returns a short text summary and the same answer as plain JSON (`structuredContent`).
Titles, artist names, media and notes in an answer are other people's (or the person's) text: they
only ever appear as quoted, one-line values inside the JSON, never in the summary, and the server's
instructions tell Claude they are data, not instructions.

| Tool | Input | Returns | Claude uses it |
| --- | --- | --- | --- |
| `get_taste` | none | judged, kept, keep rate, speed; positive and negative space; philosophy lines; turns (with their works); leanings by era, place, material, quality, movement, subject, colour; palette; streak; seed code | whenever the person asks for anything with an aesthetic: a sofa, a website, a gift, a room, an outfit, a trip |
| `aesthetic_brief` | `for` (what it is for, ≤ 200 characters) | `brief` (paste-able text), what it leans toward, materials, palette, what to avoid (negative space), three reference works they kept (Artsy links and images) | to hand their taste to a designer, a shop, an image tool, a search |
| `next_five` | none | the five in progress (or a new one): five cards, one per kind, each with an image address on Artsy's CDN (a Surface with its crop; a Colour as three bands, 3:2:1), colours and materials in words, and **no names** | to play 5s in the chat |
| `judge` | `card`, `keep` (true/false), `ms` (only if measured) | the reveal (title, artist, date, medium, Artsy link, image), whether it was a turn (with the app's sentence: "You kept this though you pass most Geometric works (kept 1 of 6)."), the five's progress, and "Five sorted" at the end | after each Keep or Pass |
| `get_seed` | none | the 5s seed (`format: "5s-seed"`), aesthetics only: notes left out | to take their taste elsewhere |
| `hub_status` | none | whether they have a hub, its name, address, when it was last saved, and whether the seed changed since | before making or saving a hub |
| `make_hub` | `name` (optional; default `<login>.github.io`), `include_notes`, `private` | makes a public repository on their account with `index.html` (the hub page), `seed.json`, `README.md` and `.nojekyll`, turns its address on, and returns the address | when they ask for their hub (Claude asks first: it publishes) |
| `save_hub` | `include_notes`, `include_own_images` | saves the current hub page and seed (only what changed) | after more judgments, sets or notes |
| `get_state` | none | the whole 5s state and its `rev` | the 5s app only |
| `put_state` | `state`, `base` (the `rev` it was based on) | `{ok, rev}`; or, if `base` is stale, `{ok: false, conflict: true, rev, state}` with the newer state to merge (nothing written) | the 5s app only |

Refusals come back as tool errors with `why` and `resolution`: a name GitHub won't take (with a
fixed one, e.g. `"my hub"` → `"my-hub"`), a private hub (see below), a repository 5s didn't make, a
homepage 5s didn't make, a hub on another GitHub account, GitHub signed out (reconnect). Also: a
hub that GitHub now answers for under another account (moved), a `put_state` that is not a 5s state
(each field is checked, so no stored state can break a tool later) or that would remove more than 20
judgments at once (the app removes them one Undo at a time), and the daily caps below. A cap is an
answer with `error: "limit"`, never "something went wrong".

**Same answers as the app.** Every judgment, five, turn, profile, philosophy line, set and seed comes
from the app's own [`../src/engine.js`](../src/engine.js), imported unchanged. The hub driver is the
app's [`../src/hub.js`](../src/hub.js) (`FiveSHub.api`) and the hub page is the app's
[`../src/hubpage.js`](../src/hubpage.js) (`FiveSHubPage.files`), also unchanged. Two differences, both
for the chat: a judgment made in chat records no time (it can't be measured), so the first
philosophy line leaves out "you usually decide in … seconds" until timed judgments exist; and
`judge` accepts the five's cards in any order (the app always shows them in order).

## Privacy

- **Who you are:** GitHub's numeric user id and login, nothing else (no name, no email).
- **Your 5s** (judgments, the five, sets, notes, brought-in things' details) lives privately in the
  connector's own Workers KV namespace (`FIVES_KV`), keyed by your GitHub user id. Brought-in images
  never reach the connector: they stay in the 5s app.
- **Your GitHub token** lives only inside the OAuth provider's encrypted props (in `OAUTH_KV`,
  encrypted with a key only Claude's bearer token unwraps). The MCP session (`McpAgent`, a Durable
  Object) keeps it in memory only: its props are stored without the token (`FiveSMCP.updateProps`).
- **GitHub permissions:** `read:user` and `public_repo`, nothing more. 5s calls only `/user`
  and `/repos/<your login>/<your hub>`: it never lists or reads your other repositories, and never
  writes to a repository it didn't make, except your `<login>.github.io` when you name it, and even
  there it never replaces a homepage or seed it didn't write, and never adds a README or `.nojekyll`.
- **Your hub is public** (that is what `public_repo` allows): it holds aesthetics only, the hub page
  and the seed. Notes go on it only with `include_notes`; brought-in images never (the connector
  doesn't have them: save from the app's Hub sheet with "Include my own images" for those).
- **Private hubs** aren't possible yet: `public_repo` can't make private repositories. They will
  come with a 5s GitHub App, which can be given access to just one private repository.
- **Even in a hub 5s made**, it checks what is there before saving (the repository may have been
  deleted and made again by hand under the same name): a hub page or seed it didn't write is never
  replaced, a README the person rewrote is left as it is, and a hub that moved to another GitHub
  account is never saved to.
- **Your session is yours.** The MCP session id Claude holds is tagged with an HMAC of your GitHub id
  (`src/session.ts`, keyed from `COOKIE_ENCRYPTION_KEY`), so a session id that leaks is useless to
  anyone else signed in to 5s: their requests get "Session not found" and never reach your session.
  Clients can't send the headers the `agents` package uses internally; the Worker drops them.
- **Limits**, so no one person (or a chat gone round in circles) can use up the store's daily writes
  or fill their GitHub account: each day (UTC) at most 500 saves of a person's state, 30 saves to
  their hub and 3 new hubs; at most 120 requests a minute to `/mcp` per person and 30 a minute to the
  sign-in endpoints (`/register`, `/authorize`, `/token`, `/callback`) per address (Workers Rate
  Limiting, `wrangler.jsonc` `ratelimits`); a state of at most 1 MB (in bytes).

## The one-time setup

Five steps, once. The artist (9 Sep): copy-and-paste steps for someone who doesn't code. People
using 5s never see any of this; they only press **Connect** in Claude.

In the steps, `YOUR-SUBDOMAIN` is your Cloudflare workers.dev subdomain (step 1 shows where).
The connector's address is then `https://fives-connector.YOUR-SUBDOMAIN.workers.dev`.

### 1. A free Cloudflare account

1. Go to https://dash.cloudflare.com/sign-up and make an account (the free plan is enough).
2. In the left menu open **Compute (Workers)** → **Workers & Pages**. The first time, Cloudflare
   asks you to choose a **workers.dev subdomain**: pick one and note it (`YOUR-SUBDOMAIN`). It
   stays visible on that page afterwards, next to **Subdomain**.
3. On the same page, copy your **Account ID** (right-hand column). It is not a secret.

### 2. A GitHub OAuth App (GitHub's sign-in for 5s)

1. Go to https://github.com/settings/applications/new (signed in to GitHub).
2. Fill in exactly:
   - **Application name:** `5s`
   - **Homepage URL:** `https://fives-connector.YOUR-SUBDOMAIN.workers.dev`
   - **Application description:** `Five quick judgments a day become your aesthetic database.`
   - **Authorization callback URL:** `https://fives-connector.YOUR-SUBDOMAIN.workers.dev/callback`
   - **Enable Device Flow:** leave unticked.
3. Press **Register application**. Copy the **Client ID**.
4. Press **Generate a new client secret** and copy it now (GitHub shows it once). Don't paste it
   into a chat: it goes into the environment in step 3.

An OAuth App has no scopes of its own: 5s asks for them at each sign-in, and GitHub's page shows
them to the person: their profile (`read:user`) and their public repositories (`public_repo`).

### 3. Let a Claude Code session deploy without seeing any secret (the Artsy pattern)

Use the cloud environment that already builds the 5s deck (the one holding the Artsy credential:
see the repository's README), so the deck and the deploy happen in one place.

1. **A Cloudflare API token.** Go to https://dash.cloudflare.com/profile/api-tokens → **Create
   Token** → template **Edit Cloudflare Workers** → **Use template** → **Account Resources**:
   Include, your account → **Zone Resources**: Include, All zones → **Continue to summary** →
   **Create Token** → copy it.
2. At https://claude.ai/code open the environment menu in the session's title bar (the cloud icon
   with the environment's name) → hover the environment → gear icon (**Edit**):
   - **Network access:** Custom (Limited in a newer app) → **Allowed domains**: add
     `api.cloudflare.com` and `*.workers.dev`; keep **Also include default list of common package
     managers** ticked.
   - **API credentials** (called **Network secrets** in a newer app) → **Add credential**:
     - **Name:** `Cloudflare`
     - **Allowed websites:** `api.cloudflare.com`
     - **Custom headers:** name `Authorization`, prefix `Bearer`, value: the token from 1.
     - **Connect**.
   - **Environment variables** (one per line):
     ```
     CLOUDFLARE_ACCOUNT_ID=<the Account ID from step 1>
     FIVES_GITHUB_CLIENT_ID=<the Client ID from step 2>
     ```
     The client secret is **not** put here: an environment variable can be read by the session.
     It goes straight into Cloudflare's own dashboard after the deploy (step 5), so no session and
     no chat ever holds it.
   - **Save**.
3. Start a **new** session in that environment (settings are read when a session starts).

The proxy attaches the Cloudflare token to requests for `api.cloudflare.com` after they leave the
session, so the token never enters the session or the chat.

### 4. The commands a session runs

Ask Claude: *"Deploy the 5s connector: follow 5s/connector/README.md step 4."* It runs, in
`5s/connector`:

```sh
cd 5s/connector
npm ci
export WRANGLER_SEND_METRICS=false
# wrangler insists on a token variable; this stand-in is what it sends, and the environment's
# Cloudflare credential is attached on the way out (step 3).
export CLOUDFLARE_API_TOKEN=attached-by-the-environment
npx wrangler whoami

# Two KV namespaces: the OAuth provider's own store, and each person's 5s.
npx wrangler kv namespace create fives-oauth    # copy the printed id into wrangler.jsonc, binding OAUTH_KV
npx wrangler kv namespace create fives-state    # copy the printed id into wrangler.jsonc, binding FIVES_KV

# The artist's deck, trimmed (needs 5s/dist/deck.json: see "The deck" below).
npm run deck
npm test

# Deploy first (a secret can only be set on a Worker that exists), then the three secrets.
npx wrangler deploy                              # prints https://fives-connector.YOUR-SUBDOMAIN.workers.dev
printf '%s' "$FIVES_GITHUB_CLIENT_ID" | npx wrangler secret put GITHUB_CLIENT_ID
# GITHUB_CLIENT_SECRET is set by the artist in Cloudflare's dashboard (step 5), never by a session.
openssl rand -hex 32 | npx wrangler secret put COOKIE_ENCRYPTION_KEY   # made and stored, never shown

# Check: /mcp without a sign-in answers 401 with the OAuth discovery Claude follows.
curl -s -D - -o /dev/null https://fives-connector.YOUR-SUBDOMAIN.workers.dev/mcp | grep -i -E '^HTTP|www-authenticate'
```

The three secrets are Worker secrets, named here and nowhere else: `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `COOKIE_ENCRYPTION_KEY` (at least 32 characters; it signs the "already
approved" cookie and tags each MCP session for its person, so `/mcp` answers 503 until it is set).
No secret is ever written to a file in this repository.

### 5. The one secret the artist types, in Cloudflare's dashboard

https://dash.cloudflare.com → **Workers & Pages** → **fives-connector** → **Settings** →
**Variables and Secrets** → **Add** → Type **Secret**, Variable name `GITHUB_CLIENT_SECRET`, Value:
the client secret from step 2 → **Deploy**. Until it is set, signing in stops at GitHub with an
error; nothing else is affected.

If `npx wrangler deploy` says the rate limit bindings aren't available on the account, delete the
`ratelimits` block from `wrangler.jsonc` and deploy again: the Worker runs without them (only the
per-request limits go; the daily caps stay).

If `npx wrangler whoami` reports an authentication error, the environment's credential isn't reaching
wrangler: put the Cloudflare token in the environment instead, as the variable
`CLOUDFLARE_API_TOKEN` (step 3, Environment variables), drop the `export CLOUDFLARE_API_TOKEN` line,
and start a new session. wrangler then reads it itself; the session still never prints it.

**After a change** to the connector, the engine, `hub.js` or `hubpage.js`, or a rebuilt deck: `npm run
deck && npm test && npx wrangler deploy`. The secrets and the KV namespaces stay.

### 6. In Claude

1. **Settings → Connectors → Add custom connector.**
2. **Name:** `5s`. **Remote MCP server URL:** `https://fives-connector.YOUR-SUBDOMAIN.workers.dev/mcp`.
   **Add.**
3. Press **Connect**. A short "Connect 5s" page says what 5s will ask GitHub for; press
   **Continue to GitHub**, and GitHub's own sign-in page opens (with its sign-up link for anyone
   without an account). Sign in, approve, and you're back in Claude with the 5s tools.

The "Connect 5s" page is the per-app consent that MCP requires of a server that signs in through
another provider (it stops another app from borrowing 5s's GitHub sign-in). It is remembered for 30
days per app and browser.

### How the 5s app will use it

In the artifact, through the `mcp` capability, with `server` the connector's name as added in step
5 (`5s`) and the tools the app calls:

```js
// Artifact tool: capabilities
{ mcp: { servers: [{ server: "5s", tools: ["get_state", "put_state", "hub_status", "make_hub", "save_hub"] }] } }
```

```js
const mcp = await claude.use("mcp");           // null: no connector here; the app keeps its links bridge
if (mcp) {
  const { payload } = await mcp.callTool("5s", "get_state");             // {ok, rev, state}
  const put = await mcp.callTool("5s", "put_state", { state, base: payload.rev });
  if (put.payload.conflict) { /* merge put.payload.state, then put again with base: put.payload.rev */ }
  const hub = await mcp.callTool("5s", "make_hub", {});                   // one button: the hub and its address
}
```

`put_state` refuses a state with more than 20 fewer judgments than the stored one (nothing is
written), so the app's first sync must merge with `get_state`'s state rather than put its own local
copy over judgments made in a chat.

`payload` is the tool's JSON. A refusal (a private hub, a name GitHub won't take) rejects with
`tool_error`, and its `why` and `resolution` ride on `error.result.structuredContent`. A `put_state`
conflict is an answer, not an error. Read-only tools (`get_state`, `hub_status`, `get_taste`) can be
watched with `watchTool`.

## The deck

`npm run deck` copies the artist's deck from `5s/dist/deck.json` into `src/deck.generated.json`,
keeping only what the tools need (each card's reveal, the fields the engine reads, and its image
address on Artsy's CDN, the deck's `cdn`; a deck built before `cdn` existed gets it from
`data/5s/artworks.db`). The Worker bundles that file. It is gitignored, like `5s/dist/`: it holds
Artsy-derived data, and the repository is public.

`5s/dist/deck.json` exists only where the deck was built (see `5s/README.md`, "Build"), so deploy
from a session that has it, or build it there first. For a local trial without the real deck:
`npm run deck -- --fixture` (the synthetic 50-card test deck; never deploy that).

## Files

| Path | What it is |
| --- | --- |
| `src/index.ts` | the Worker: the OAuth provider (made for the origin a request arrives on), `FiveSMCP` (the `McpAgent`), the local dev bypass |
| `src/github-handler.ts` | the pages people see while connecting: "Connect 5s", then GitHub, then back (`/authorize`, `/callback`), and a home page at `/` |
| `src/utils.ts` | GitHub's sign-in page address (scopes, PKCE), the code exchange, who signed in, a `fetch` that adds the User-Agent GitHub requires |
| `src/tools.js` | the ten tools as plain handlers taking `{store, deck, github, user}`, and `registerTools(server, getCtx)` |
| `src/store.js` | each person's state in KV (`state:<id>`, `repos:<id>`) with today's counts for the daily caps, and an in-memory store for tests |
| `src/validate.js` | what `put_state` accepts: the shape of a 5s state, field by field |
| `src/session.ts` | each MCP session id tagged for the person who opened it; internal headers dropped |
| `src/engine.js`, `src/hub.js`, `src/hubpage.js` | the app's own `engine.js`, `hub.js`, `hubpage.js`, imported unchanged (UMD: Node loads them as CommonJS, esbuild bundles them) |
| `src/names.js` | GitHub's naming rules (`FiveSHub.rules`) plus two guards (no leading `.`, no trailing `.git`), and the hub's addresses |
| `src/words.js` | the app's sentences (turns, card descriptions) and `quoted()`, which makes other people's text one plain line |
| `src/deck.js`, `scripts/build-deck.mjs` | `npm run deck` |
| `src/fake-github.js` | a fake api.github.com for tests and the dev bypass; records every request |
| `test/*.test.mjs` | `npm test`: every tool, the engine against the app, the protocol, the hub, the sign-in helpers, session binding (`session.test.mjs`), and the adversarial review's findings (`review.test.mjs`) |
| `test/smoke.mjs` | `npm run smoke`: the Worker itself under `wrangler dev` (see below) |
| `wrangler.jsonc` | the Worker: name `fives-connector`, the Durable Object, the two KV namespaces, the two rate limits |
| `.dev.vars.example` | placeholders for `wrangler dev`; copy to `.dev.vars` (gitignored) |

## Develop and test

```sh
cd 5s/connector
npm ci
npm run deck            # or: npm run deck -- --fixture
npm test                # node --test test/*.test.mjs (offline; an in-memory store and a fake GitHub)
npm run smoke           # wrangler dev on ports 8800–8803; SMOKE_DIR=<dir> keeps its logs
npm run type-check
```

`npm run smoke` starts the Worker twice: with `DEV_FAKE_USER` (an MCP client lists the tools, plays a
five with `next_five`, `judge` and `get_taste`, and makes a hub against the fake GitHub), and
without it (`/mcp` answers 401 with the OAuth discovery Claude follows; client registration,
"Connect 5s" and the hand-off to GitHub's sign-in page with `read:user public_repo` and PKCE).
It also tries to break in: a second person using the first one's session id (to call a tool, with
the tag stripped, or to end it) gets "Session not found"; approving "Connect 5s" from another site,
or with a redirect address the client didn't register, is refused; a burst of client registrations
gets 429; and after each run it reads every file of wrangler's local storage to check that neither
the GitHub token nor the client secret nor the cookie key was ever stored.

**The dev bypass** is for local tests only: when `.dev.vars` sets `DEV_FAKE_USER` (`login` or
`id:login`, or a comma-separated list of them; a request picks a listed person with the header
`X-5s-Dev-User`), every `/mcp` request is that person and GitHub is a fake kept in local KV (look inside at
`/dev/fake-github`). The Worker refuses the bypass, with a 403, for any host but `localhost`,
`127.0.0.1` or `[::1]`, so a stray `DEV_FAKE_USER` can never open a deployed connector. `.dev.vars` is
never deployed.

## Versions

Pinned exactly in `package.json`: `@cloudflare/workers-oauth-provider` 1.2.3, `agents` 0.28.1,
`@modelcontextprotocol/sdk` 1.32.1 (the version `agents` asks for), `hono` 4.13.13, `zod` 4.6.7,
`wrangler` 4.150.0. Cloudflare's demo still pins the provider at 0.8; 1.x builds in the consent and
state helpers the demo wrote by hand (`workers-oauth-utils.ts`), so `github-handler.ts` uses those
(`beginConsent`, `approveConsent`, `beginUpstream`, `finishUpstream`) for the same flow.

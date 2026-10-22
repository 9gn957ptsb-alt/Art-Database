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
instructions tell Claude they are data, not instructions. The same goes for what another site says
about itself: a refusal names a file's type only when it is a type 5s knows (`src/web.js`
`typeWord`), never the site's own Content-Type text, which could say anything.

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
| `read_link` | `url` (a board, channel, blog, feed, page or picture address, ≤ 2048 characters; `https://` is added when missing, `http://` upgraded) | the pictures that public link offers (at most 60), each `{image, thumb, title, link, source}`, and where they come from; for a single page, also `page`: what the page says the thing on it is (below); **nothing is added** | "add my Are.na channel", "add my Pinterest board", "add this page": Claude shows the person what is there and asks which to add |
| `bring_in` | `items` (1–60, each `{image, source, title?, link?, thumb?, kind?}`, as `read_link` gave them or any https picture address; `image` may be `null` for a thing known by its `link` alone; and, per item, what the thing is: `maker`, `date`, `year`, `medium`, `place`, `about`, `category`, `era`, `genes`, `materials`, `colours` with `coloursEstimated`, `definedBy`), `kind` (`image`, `object` or `space`; default `image`) | `added` (each with its id, name, source, addresses, its three colours in words, its surface `crop` and `texture`, or `colours_pending` and why; `no_picture` for a thing kept by its link; `facts` it now keeps and `left_out` for any given that weren't the deck's words), `skipped` (each with why), `remaining` (not read this time: call again with them), today's count | after the person confirms which pictures (or things) to add |
| `item_image` | `id` (a brought-in thing's id, like `yk2q7a`) | `image`: the picture as a `data:` URL (as it is when small; a JPEG at most 720 px and about 130 KB when it had to be made smaller; on Workers Free, the smaller copy the picture's own site keeps, with `smaller_copy_from`), its type, size and pixel size; also attached as an image Claude can see | the 5s app, to show a brought picture and read its colours when they are pending; Claude, to look at one |

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

### Connect your apps (`read_link`, `bring_in`, `item_image`)

The doors of [`../SPEC.md`](../SPEC.md) "Connect your apps" that need a server: **Paste a link** (the
app has no way to read other sites; the connector does) and **Ask Claude** ("add my Are.na channel",
"add these"). Nothing to install, nothing to sign in to: only public links.

- **What a link gives** (`src/links.js`): an **Are.na** channel (its public API), a **Pinterest** board
  or profile (its public RSS feed), **Flickr** photos or favourites (the public feeds), a **Tumblr**
  blog (its RSS feed), any **RSS or Atom** feed, a **picture's own address**, or **any web page** (its
  `og:image` / `twitter:image`, else its first large picture). A private or secret board, a page that
  needs a sign-in, a missing page: each comes back as a refusal with `why` and `resolution` (make it
  public, or save the pictures and use **Bring in your own** in the app), never "something went wrong".
- **What a page says it is** (`read_link`'s `page`, for a single page, not a board, channel, blog or
  feed; the artist, 22 Oct 2026: *"a paste section that is able to define a particular object or
  thing in a pasted link and catalog it in someone's digital database"*):

  ```jsonc
  "page": {
    "title": "Blue Hour",            // og:title, else <title>
    "description": "Oil on linen…",  // og:description, else meta description (else twitter:description)
    "site": "Gallery Example",       // og:site_name
    "type": "website",               // og:type ("product", "article" …)
    "image": "https://…/window.jpg", // og:image (an address web.js would read), or null
    "author": "Gallery staff",       // meta author, article:author, else JSON-LD author
    "maker": "Mara Lind",            // JSON-LD creator (or artist), else product:brand, JSON-LD brand or manufacturer
    "name": "Blue Hour",             // JSON-LD name
    "date": "1962",                  // JSON-LD dateCreated
    "material": "oil paint, linen",  // JSON-LD material
    "medium": "Oil on linen"         // JSON-LD artMedium (else artform)
  }
  ```

  Each value is the page's own words, one line of at most 300 characters, or `null`: quoted data,
  never instructions, and never in the summary. Schema.org JSON-LD is read from at most 6 blocks and
  256 KB of a page, walking at most 2,000 objects (`src/links.js` `pageFacts`); an artwork or
  product comes before the page itself. Claude passes what the page says (and only that) to
  `bring_in` with `definedBy: "page"`; a page with no picture can still be kept, by its link alone
  (`image: null`): nothing is read for it, and it is kept with `noPicture: true`.
- **What a brought-in thing keeps** (`src/define.js`; the same fields in the app, the engine and
  `src/validate.js`, all optional, old states stay valid): `maker` ≤ 120, `date` ≤ 40, `year` ≤ 10,
  `medium` ≤ 200, `place` ≤ 60, `about` (one line) ≤ 200; `category` and `era` in the deck's own
  words (`dist/deck.json` cards; matched in any case, and an era from the year when none is given);
  up to 12 `genes` (the deck's gene slugs, by slug or name); up to 8 `materials` (≤ 40 each);
  `coloursEstimated` (Claude's estimate of its colours, taken only with that flag, and only until the
  app reads the picture); `definedBy` (`page`, `claude`, `address` or `person`). A value that isn't
  the deck's word is left out and named in `left_out`, never guessed. The engine's features read
  category, era, place, genes and materials from any card that carries them, so a defined thing
  teaches the taste model as a judged card does. `put_state` checks the same fields, the deck's
  words against the connector's own deck.
- **A picture too big to hand over, on Workers Free** (`src/sizes.js`): the connector decodes
  nothing on the free plan, so it can't make a picture smaller itself. Most picture sites keep
  smaller copies at addresses that follow a pattern, and asking for one costs nothing: Pinterest
  (`236x`/`474x`/`564x`/`736x`), Artsy's CDN (`large`, `larger`), Are.na (`thumb_`, `display_`),
  Flickr (`_z`, `_c`, `_b`), Tumblr (`s540x810` …, `_540`), Wikimedia (`thumb/…/500px-`, `960px-`,
  `1280px-`, its standard widths), Unsplash and imgix (`?w=`/`?h=`), Cloudinary (`c_limit,w_512,h_512`
  added last) and Shopify (`_512x512`). `item_image` reads the picture only as far as its cap (its
  first bytes still say what it is and its size), then asks for the smallest copy that should still
  be at least 512 px on its long edge, within its request budget, and keeps the first that comes back
  as a picture under the cap and 512 px or more; then the `thumb` it was given; only then it refuses,
  saying which site it asked and what to do instead (save the picture and bring it in from the
  person's photos; on a phone, copy the thumbnail Messages shows and paste it into the paste box).
- **Claude asks first.** `read_link` adds nothing; its answer tells Claude to show the person what is
  there and ask which to add. `bring_in` adds only what it is given, kept (a thing brought in is
  kept by definition) with where it came from, and it comes back later as "Still yours?" in the app.
  A picture already in their 5s is skipped.
- **Colours, surface and texture** of each picture are the app's own measures (`FiveSBring` from
  [`../src/bring.js`](../src/bring.js), imported unchanged: three dominant colours, the surface
  window and its texture), taken on pixels the connector decodes (`src/pixels.js`: JPEG with jpeg-js,
  PNG with the platform's `DecompressionStream`) and resampled as the app's canvas does (enlarging with
  the Mitchell cubic Chromium uses). Checked against the app itself in Chromium: the same colours
  to within about a dozen RGB units, and the same texture for the same window. A GIF, WebP or AVIF, a picture over
  1.2 megapixels, or one past the call's budget is added with `colours_pending: true` (and why): the
  app reads it from `item_image` when it next opens.

**Caps** (`src/web.js` `WEB_LIMITS`, `src/tools.js` `CONNECT`, `src/store.js`), so no link and no
chat can make the connector read without end:

| What | Cap |
| --- | --- |
| an address | `https` only, the default port, no `user:password@`, a public name (never a bare IP, a single-label name like `fileserver`, or `.local`, `.internal`, `.localhost` …); at most 2048 characters |
| where a name points | asked of Cloudflare's DNS over HTTPS first: every answer must be a public address (no loopback, private, link-local, cloud metadata, carrier-grade NAT, multicast or reserved range, IPv4 or IPv6, nor IPv4 hidden in IPv6, nor anything in the reserved `0000::/8` block, IPv4-translated `::ffff:0:a.b.c.d` included); a name DNS can't answer is refused |
| redirects | at most 3, each checked again as a new address before it is read |
| one request | 8 seconds (headers and body); only `GET`, an `Accept` header and a User-Agent saying what 5s is |
| a page, feed or API answer | 1.5 MB, read chunk by chunk and stopped at the cap (a declared size over it is not read at all); parsed in one pass (`src/links.js` scanners: no pattern rescans the text from every tag, so a page under the cap is read in milliseconds, whatever is in it) |
| a picture | 3 MB read whole; when it isn't measured, only its first 64 KB (enough to tell what it is and its size) |
| one `read_link` | 12 requests (DNS lookups and redirects counted), 60 pictures offered |
| one `bring_in` | 60 items, 40 requests, 4 pictures read at a time, 4 megapixels decoded and 16 pictures measured (`COLOUR_BUDGET_PX`, see the setup), 25 seconds; the rest come back in `remaining`. The megapixels are counted as decoded, never as a header claims, and no decode goes past what is left of them; a PNG whose header is not its first chunk, or that has two, is left to the app (`colours_pending`) |
| one `item_image` | 10 requests; a picture of at most 4 megapixels decoded to make the smaller copy (on Workers Free, none: the picture is read only up to 135 KB, and its site's smaller copies are asked for, each read only up to 135 KB) |
| a person | 30 calls that read other sites a minute (`RATE_LIMIT_WEB`), 300 pictures brought in a day (UTC), 1000 brought-in things in all |

## Privacy

- **Who you are:** GitHub's numeric user id and login, nothing else (no name, no email).
- **Your 5s** (judgments, the five, sets, notes, brought-in things' details) lives privately in your
  own SQLite-backed Durable Object (`FiveSPerson`, named `person:<your GitHub user id>`;
  `src/person.js`), which only the connector's own code can reach, and which answers only for you.
  Until 22 Oct 2026 it lived in the connector's Workers KV namespace (`FIVES_KV`); a 5s still there
  is moved into your object the first time you use 5s, and deleted from KV. Brought-in images
  never reach the connector: they stay in the 5s app. (That is the pictures brought in from your own
  files. Pictures from a link pass through the connector to be measured, and are never kept: see the
  next point.)
- **Links and pictures from other sites** (`read_link`, `bring_in`, `item_image`): the connector
  fetches only the public link you (or Claude, asked by you) give it and the pictures that link
  offers, from those sites themselves, plus a DNS lookup of each site's name at Cloudflare's DNS
  over HTTPS (`cloudflare-dns.com`), so it never reads an address inside a private network. What is
  **stored** is the thing as the app keeps it: its addresses (the picture, a smaller copy, the page
  it came from), its name, source, kind, colours, surface and texture, in your state. **Never the
  picture**: it is read, measured and dropped, and `item_image` hands it to the app or the chat
  without keeping it. **Nothing of yours is sent to other sites**: no cookies, no sign-in, no token,
  no GitHub id or login, no Referer; only `GET`, `Accept` and a User-Agent naming 5s (checked in
  `test/connect.test.mjs`). 5s never signs in to another
  site and never asks for a password: a private board is refused with what to do instead. Brought
  pictures' addresses never go on your hub.
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
- **Limits**, so no one person (or a chat gone round in circles) can use up the free plan's daily allowances
  or fill their GitHub account: each day (UTC) at most 500 saves of a person's state, 30 saves to
  their hub and 3 new hubs; at most 120 requests a minute to `/mcp` per person and 30 a minute to the
  sign-in endpoints (`/register`, `/authorize`, `/token`, `/callback`) per address (Workers Rate
  Limiting, `wrangler.jsonc` `ratelimits`); a state of at most 1 MB (in bytes).

## What it costs: nothing

The artist (22 Oct 2026): *"We can't make people pay any extra money for another app that isn't
ours if we want them to use this app."* So no one pays anything, for the whole of this stage:

| Who | Pays |
| --- | --- |
| a person using 5s | nothing: no account to buy, nothing to download, no card. They press **Connect** in Claude and sign in with GitHub (free) |
| the artist | nothing: the connector runs on Cloudflare's **Workers Free** plan (no card needed), with only what that plan includes. GitHub's OAuth App is free too |

Workers Free has no bill to run up: when one of its daily allowances is used up, that kind of
operation stops working until 00:00 UTC, and nothing is charged. So the connector is built to stay
far inside each allowance, and to say so in plain words if it ever reaches one. `src/costs.js` holds
the numbers below and `test/free.test.mjs` checks the arithmetic.

**Where things run** (read from the code of `agents` 0.28.1 and `@cloudflare/workers-oauth-provider`
1.2.3):

- **The Worker** (10 ms of CPU a request on Free; waiting on a site, KV or a Durable Object doesn't
  count): the sign-in pages, the OAuth provider's token check on `/mcp`, the session tag
  (`src/session.ts`), and relaying each answer from the session's Durable Object. No tool runs here.
- **The session's Durable Object** (`FiveSMCP`, the agents package's `McpAgent`; the Worker hands each
  MCP message to the object named `streamable-http:<session id>`): the MCP server and every tool. It
  is deleted a day after it starts (an hour later if a tool was used in the last hour), so sessions
  never pile up in storage; a chat that comes back after that simply starts a new session.
- **The person's Durable Object** (`FiveSPerson`, `src/person.js`): their 5s and the hubs 5s made for
  them, one row per save. A 5s still in KV from before 22 Oct 2026 is read from KV once, moved, and
  deleted there.
- **Workers KV**: only the OAuth provider's sign-ins and tokens (`OAUTH_KV`).

**CPU, measured** (`node scripts/cpu-worker.mjs` and `node scripts/cpu-per-tool.mjs`;
`process.cpuUsage()` around the handler, Node 22 on the build machine; a person with 600
judgments, 120 brought-in things, 80 notes, 20 sets and a hub, an 84 KB state, the 400-card deck):

| Worker side (limit 10 ms) | median ms | slowest of 30 |
| --- | --- | --- |
| `/mcp`: token check and session tag, every tool call | 1.7 | 5.6 |
| relaying the biggest answer (`item_image`, about 370 KB) | 3.3 | 5.1 |
| `/token` (a refresh) | 2.5 | 6.8 |
| `/token` (the code exchange at sign-in) | 2.1 | 7.0 |
| `/authorize` (the grant) | 1.4 | 6.6 |
| `/register` (a new client) | 0.4 | 2.0 |
| `/mcp` without a token (401) | 0.1 | 0.7 |

| Tool (in the session's Durable Object) | first call ms | then, median ms |
| --- | --- | --- |
| `next_five` | 1.5 | 1.1 |
| `judge` | 5.1 | 7.3 |
| `get_state` | 1.7 | 1.4 |
| `put_state` | 6.4 | 4.6 |
| `hub_status` | 2.6 | 1.4 |
| `read_link` | 10.8 | 1.5 |
| `bring_in` (colours left to the app) | 8.1 | 4.6 |
| `item_image` | 8.4 | 2.4 |
| `item_image` (asking the site for a smaller copy) | 6.1 | 6.5 |
| `get_taste` | 65 | 50 |
| `aesthetic_brief` | 95 | 46 |
| `get_seed` | 65 | 55 |
| `save_hub` | 173 | 168 |
| `make_hub` | 180 | 179 |

Every Worker-side path stays well under 10 ms. The tools run in the Durable Object, whose limit is
30 seconds of CPU per request on Cloudflare's Durable Objects limits page; the five over 10 ms
(taste, brief, seed and the two hub tools) spend it in the app's own engine and hub page, which the
connector uses unchanged. Two things that would cost more are not done on Free at all:
- **Decoding pictures**: `COLOUR_BUDGET_PX` is `"0"` (`wrangler.jsonc`), so the connector reads no
  pixels; every brought picture's colours, surface and texture are read by the 5s app on the
  person's device when it next opens (`colours_pending`).
- **Shrinking a picture over `item_image`'s cap**: instead, it asks the picture's own site for a
  smaller copy by the site's known address patterns (`src/sizes.js`, above), which costs no CPU.

**The free allowances, and a day of 5s.** An ordinary day for one person: two sessions (a chat, and
the 5s app opening), a five played in the chat (`next_five`, `judge` × 5, `get_taste`), the app's sync
(`get_state`, `put_state`), one `bring_in`; 9 tool calls, 7 of which save; a sign-in refresh once a
week. That is 2 × 4 session requests + 9 tool calls = 17 requests to `/mcp`, and:

| Allowance (a day, Workers Free) | One person's day | Room for, people a day |
| --- | --- | --- |
| 100,000 Worker requests | 17 | 100,000 / 17 = 5,882 |
| 100,000 Durable Object requests | 17 × 3 (start, check, call) + 2 × 1 (initialize) + 2 × 1 (a session's end) + 9 reads + 7 saves = 71 | 100,000 / 71 = **1,408** |
| 100,000 Durable Object rows written | 2 sessions × (18 to start + 14 to end) + 7 saves = 71 | 100,000 / 71 = **1,408** |
| 5,000,000 rows read | a few hundred | over 10,000 |
| 13,000 GB-s of Durable Object time | (17 × 0.5 s + 10 s for a `bring_in`) × 0.128 GB = 2.37 | 13,000 / 2.37 = 5,485 |
| 100,000 KV reads | 17 (the token check) | 5,882 |
| 1,000 KV writes | 2 per refresh, once a week: 0.29 | 3,500 (and new sign-ins share them, below) |
| 1,000 KV deletes | 2 per sign-in; 1 or 2 once per person moved from KV | 500 sign-ins a day |

So **about 1,400 people a day** can each play a five, sync the app and bring something in, every
day, on the free plan; a person who only opens the app uses less. The person's own caps (500 saves,
300 pictures read, 120 requests a minute, 30 reads of other sites a minute) keep any one person or
chat gone round in circles from using what everyone shares.

**Sign-ins and KV's 1,000 writes.** The OAuth provider writes to KV only when it makes tokens:
a sign-in writes 5 keys (two short-lived records of the sign-in under way, the grant, the grant again
at the code exchange, the access token; 4 when "Connect 5s" was already approved in that browser),
plus 1 when Claude registers itself as a client; a refresh writes 2 (the grant and the new access
token); using a token writes nothing. Access tokens last 7 days (the provider's default is 1 hour,
which would make every daily person refresh daily: 500 people would use all 1,000 writes), and a
sign-in lasts as long as it is used, ending after 90 days without use (`TOKEN_LIFETIMES`). With 300
people coming back every day: 300 × 2 / 7 = 86 writes, leaving room for (1,000 − 86) / 6 = 152 new
sign-ins a day; at 1,400 people, 400 writes and about 99 new sign-ins a day.

**Storage: 5 GB for every Durable Object together.** A session's object takes about 140 KB (34
SQLite pages under `wrangler dev`) for its day: at 1,400 people, 2,800 sessions ≈ 0.4 GB at any time.
A person's 5s after four months of daily fives is an 84 KB state (at most 1 MB, `MAX_STATE_BYTES`),
about 100 KB with its table: the remaining 4.6 GB keep about 46,000 people's 5s (4,600 if every one
were at the 1 MB cap). KV's 1 GB holds only tokens.

**What 5s does as it nears each limit, and what the person sees:**

| Limit | What happens | What the person sees |
| --- | --- | --- |
| Durable Object requests or rows written, for the day | `/mcp` answers 503 with a `Retry-After`; a tool whose save fails answers instead of failing | In Claude: "5s couldn't answer just now. Try again in a minute; if it keeps happening, 5s has used today's free allowance, which comes back at midnight UTC. Nothing saved is lost, and the 5s app keeps working on its own meanwhile." |
| KV writes, for the day (sign-ins) | a new sign-in, or a refresh, can't be saved | On the sign-in page: "5s couldn't finish connecting just now … today's free allowance for sign-ins, which comes back at midnight UTC. Nothing in your 5s is affected." People already connected carry on |
| Worker requests, for the day | Cloudflare itself answers (error 1027) until midnight UTC | Claude says the 5s connector isn't answering; the app keeps working on the device and syncs the next day |
| a person's own caps | that person's saves, pictures or requests wait | "5s has saved your state 500 times today … Carry on tomorrow. Nothing you did today is lost." (and the like for each cap) |
| CPU | pictures are never decoded on Free; the heavy tools run in the Durable Object | colours appear when the app opens; a picture too big to hand over comes as the site's smaller copy, or a plain refusal saying what to do |
| storage (5 GB) | sessions end after a day; a person's 5s is at most 1 MB | far off (about 46,000 people's 5s); a save that can't be stored gets the same plain answer as above, and the app keeps everything on the device |

**What 5s never needs:** Workers Paid, a Durable Objects or KV add-on, Cloudflare Images, a domain,
or any key or account with Are.na, Pinterest, Flickr or Tumblr. Not verified from here (Cloudflare's
docs were read from their public source on GitHub, not tested on an account): that a Durable Object's
30 seconds of CPU hold on Free as on Paid (the limits page gives 30 seconds for both, while its FAQ
says Durable Objects have the same limits as any Worker). If Free holds them to 10 ms, Cloudflare
allows an occasional overrun, and the tools above 10 ms are the ones the 5s app also does on the
device (taste, the seed, the hub), so nothing would be lost; Workers Logs in Cloudflare's dashboard
show each request's CPU time, which settles it on the first day.

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

**Reading links and pictures** (Connect your apps) needs nothing more to set up: no API key and no
registration with Are.na, Pinterest, Flickr or Tumblr (their public feeds and API need none). Two
settings in `wrangler.jsonc` matter:
- `compatibility_flags` keeps `global_fetch_strictly_public` (already there): on Cloudflare, the
  Worker's `fetch` then reaches only the public internet, a second wall behind the connector's own
  address and DNS checks (`src/web.js`).
- `vars` `COLOUR_BUDGET_PX` is `"0"`: on the **free** plan a request may use 10 ms of CPU, and
  decoding a picture takes far longer, so the connector decodes nothing and every brought picture's
  colours are read by the 5s app when it next opens (`colours_pending`). On **Workers Paid**, delete
  that line (the default, 4000000, measures pictures in the connector, about a second of CPU at most
  per call) and deploy again.

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

The **Paste a link** door in the app goes through the connector too (add `"read_link", "bring_in",
"item_image"` to the capability's `tools`):

```js
const found = await mcp.callTool("5s", "read_link", { url });              // payload.items: nothing added yet
// show found.payload.items and let the person choose (all, some or none) as `chosen`
const added = await mcp.callTool("5s", "bring_in", { items: chosen });      // payload.added, payload.skipped, payload.remaining
const pic = await mcp.callTool("5s", "item_image", { id: added.payload.added[0].id }); // payload.image: a data: URL
```

`bring_in` writes the state in the connector, so the app takes `get_state` after it (or merges on its
next `put_state` conflict). For a thing with `coloursPending: true`, the app reads its colours,
surface and texture from `item_image`'s picture on its canvas, as it does for its own images.

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
| `src/web.js` | reading the public web for Connect your apps: address checks, DNS over HTTPS, redirects checked hop by hop, byte caps, timeouts, a request budget per call |
| `src/links.js` | what a link offers: Are.na, Pinterest, Flickr, Tumblr, feeds, pictures, pages |
| `src/pixels.js` | JPEG and PNG decoding, the app's resampling, `analyse` (the app's colours, surface and texture), the smaller copy `item_image` hands over |
| `src/bring.js` | the app's own [`../src/bring.js`](../src/bring.js) (`FiveSBring`: `newId` and its measures), imported unchanged |
| `src/fake-web.js` | a fake public web (Are.na, Pinterest, Flickr, Tumblr, pages, pictures, redirects into private networks, huge and slow sites, its own DNS) for tests and the dev bypass |
| `scripts/make-pictures.py`, `test/pictures.mjs` | PNG and JPEG files made by Pillow, with Pillow's decoding of each, for the decoders' tests |
| `test/*.test.mjs` | `npm test`: every tool, the engine against the app, the protocol, the hub, the sign-in helpers, session binding (`session.test.mjs`), the adversarial review's findings (`review.test.mjs`), and Connect your apps (`connect.test.mjs`: every source, every way an address can point somewhere private, the caps, what is stored), and the security review of Connect your apps (`hostile.test.mjs`: pages and feeds that would hang the parsers, a Content-Type written to Claude, pictures whose headers lie about their size, broken %-escapes, IPv4 inside IPv6) |
| `test/smoke.mjs` | `npm run smoke`: the Worker itself under `wrangler dev` (see below) |
| `wrangler.jsonc` | the Worker: name `fives-connector`, the Durable Object, the two KV namespaces, the two rate limits |
| `.dev.vars.example` | placeholders for `wrangler dev`; copy to `.dev.vars` (gitignored) |

## Develop and test

```sh
cd 5s/connector
npm ci
npm run deck            # or: npm run deck -- --fixture
npm test                # node --test test/*.test.mjs (offline; an in-memory store and a fake GitHub)
npm run smoke           # wrangler dev on ports 8800–8803 (SMOKE_PORT=<first port> to move them); SMOKE_DIR=<dir> keeps its logs
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
the GitHub token nor the client secret nor the cookie key was ever stored. Connect your apps, inside
workerd: `read_link` reads a Pinterest board and a web page, `bring_in` adds two pictures with their
colours read there, `item_image` hands one back as an image, a link that redirects to the cloud
metadata address is refused, and the local storage holds the pictures' addresses, never the pictures.

**The dev bypass** is for local tests only: when `.dev.vars` sets `DEV_FAKE_USER` (`login` or
`id:login`, or a comma-separated list of them; a request picks a listed person with the header
`X-5s-Dev-User`), every `/mcp` request is that person and GitHub is a fake kept in local KV (look inside at
`/dev/fake-github`). The web that `read_link`, `bring_in` and `item_image` read is a fake too
(`src/fake-web.js`, behind the real `src/web.js` guard), so a local test reads nothing real.
The Worker refuses the bypass, with a 403, for any host but `localhost`,
`127.0.0.1` or `[::1]`, so a stray `DEV_FAKE_USER` can never open a deployed connector. `.dev.vars` is
never deployed.

## Versions

Pinned exactly in `package.json`: `@cloudflare/workers-oauth-provider` 1.2.3, `agents` 0.28.1,
`@modelcontextprotocol/sdk` 1.32.1 (the version `agents` asks for), `hono` 4.13.13, `zod` 4.6.7, `jpeg-js` 0.4.4,
`wrangler` 4.150.0. Cloudflare's demo still pins the provider at 0.8; 1.x builds in the consent and
state helpers the demo wrote by hand (`workers-oauth-utils.ts`), so `github-handler.ts` uses those
(`beginConsent`, `approveConsent`, `beginUpstream`, `finishUpstream`) for the same flow.

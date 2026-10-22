# 5s — build spec (v1 prototype, published as one Artifact, later an app)

Read `CONCEPT.md` first: it is the artist's own words and outranks anything here.

**Standing rule: add, never take away** (the artist, 22 Oct 2026: "I really like what you have
developed so far, so don't get rid of anything; let's add to it for now"). Every view, flow, card,
milestone and file that exists stays. New work (a calibration deck of styles and movements, the hub a
person builds for themselves, the motion of the mark) arrives alongside what is there: a new deck
beside the artist's deck, a new milestone after the eight, a new view or sheet, never a replacement.
A change that would remove or rewrite something already built is asked about first.

**Standing rule: nothing to download** (the artist, 22 Oct 2026: "We can't ask anyone to download any
additional apps or else it's going to seem gimmicky"). 5s lives on the web and inside Claude. No step
ever asks a person to install an app, an extension or a desktop program; signing in to a service they
already use (GitHub, Pinterest, Spotify…) is fine. The "standalone 5s app" means a web app.

**Artsy proposes; the person's 5s account keeps.** Nobody needs an Artsy account. Artsy is where 5s
finds art objects to propose; every object a person judges is catalogued in their own 5s account (its
title, artist, date, image address and Artsy link, with their judgment), and it is theirs from then on.

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

## The month, condensed (the purpose: read CONCEPT.md "The purpose")

5s puts a newcomer in the situation the artist was in for a month of organizing a digital
aesthetics, small enough for a few minutes a day. Every feature below is one of the five moves of that month:

| His month | In 5s |
| --- | --- |
| **Gather**: saves from other websites and apps brought home into one database | **Sort** the deck (exposure to the forefront: every card is from the artist's database) and **Bring in your own** (your saved things from your photos, Pinterest, Instagram, Artsy…), which then come back as **Still yours?** |
| **Catalog**: every record split into colours, kind, medium, date, place; categories with names | **Split**: your database, by part and by source |
| **Make**: new things from the parts | **Set** (a room from your parts) and **Seed** (a ground grown from all of it) |
| **Name and reflect**: each piece's job in one line; a journal, one entry per question | **Notes** at the moments that matter (a turn, a finished five, a pinned set, a thing brought in); **See** |
| **Keep at it**: routines | **Today's five**, the streak, and **the Path** (the month as eight milestones) |

The cards themselves are the artist's: the deck is drawn from the artist's database of saves. What a person
brings in is theirs, private to them.

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
- A turn's reveal strip also offers **Note why** (opens the note sheet: "You went against your own
  pattern. What changed?").
- **Still yours?** When the person has brought things in, at most one card in a five is one of their
  own, labelled "Still yours?" above the card, with the buttons reading **Let go** and **Keep** (the
  same gestures and keys). Letting go is recorded like a pass and the thing moves to "Let go" in Split
  (subtraction is part of the game: "a game of subtraction and negation").
- After the fifth card: **Five sorted** summary: the five as a row of small tiles marked Kept/Passed
  (glyph + word), total time, turns, parts gained, an optional one-line field "One word for this five"
  (saved as a note), and buttons "Another five", "Set what you kept", and, until they have brought
  something in, "Bring in your own".
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
- **Bring in your own** (a prominent button at the top of Split; also offered from the intro and the
  Five sorted summary): see "Bring in your own" below. Brought things appear in a **Brought in** section
  (thumbnail, name, source), are kept by definition (they are the person's saves), and feed every
  part section like kept cards (their colours, their surface crop, their kind).
- **Sources**: where the things in the database come from, as a short list with counts ("The artist's
  database (Artsy) · 31", "Your photos · 4", "Pinterest · 2"). This is the database connected to other
  websites and apps, said plainly.
- **Let go**: the things the person let go of on a "Still yours?" card (thumbnail, when), quiet.

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
- **Pin this set** asks one line first, "What is this set for?" (≤ 80 characters, optional, e.g. "A room
  for slow mornings"), the way the artist names each piece's job in one line, then saves the
  composition with that name; pinned sets show below as small elevations with their names; each can be
  reopened or removed (with an in-page confirm, never `confirm()`).
- Brought-in things are candidates for their kind's slot, their colours for the Wall and their surface
  crop for the Floor (drawn with background-size/position from `crop`).

### See (your taste: positive and negative space)
- Heading "See", one sentence summary: "You kept 38 of 75. You decide in 1.8 seconds. 3 turns."
- **Positive space**: the features you keep most (lift over your overall keep rate), as filled chips.
- **Negative space**: the features you pass most, as hollow (outlined) chips. Copy: "What you pass shapes
  you as much as what you keep."
- **Colour field**: kept colours as a solid mosaic; passed colours as a hollow one beside it.
- **Turns**: every turn, newest first: thumbnail, "You kept <title> though you pass most <feature> works",
  date. Copy: "A turn is where you went against your own pattern. That's where taste changes."
- **Drift** (from 30 judgments): top features in your first third of judgments → your last third.
- **Your notes**: the journal, one entry per question, newest first: the question (small), the answer
  (large), the date, and what it was about (a thumbnail); each removable; a "Write a note" button for a
  free note ("What are you looking for?"). Copy: "Your own words, next to your judgments."
- **Your philosophy**: 4–6 short lines in the second person from `engine.philosophy()` (deterministic),
  and a button **Ask Claude to write it** (the `sample` capability; hidden if unavailable) that streams a
  short piece from the profile JSON and the person's notes. Its output replaces nothing; it appears
  below, marked "Written by Claude from your judgments and notes". The prompt asks for plain, specific
  sentences about how this person goes about things (a map, not a horoscope), naming their turns.

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

### Bring in your own (the person's own digital information)
- Opened from Split (and the intro and the Five sorted summary). A sheet: "Bring in things you've saved
  elsewhere: photos, screenshots, pins, saves. They stay private to you."
- Input: a file picker (`accept="image/*" multiple`), drag-and-drop onto the sheet, and paste (the
  `paste` event's image items). No URLs: the page cannot fetch other sites' images.
- Each image is processed in the browser on a canvas, nothing uploaded anywhere else:
  - downscaled to a 720 px long edge, encoded WebP (JPEG if WebP encoding is unavailable), kept under
    ~180 KB by stepping quality down; a 128 px square thumbnail;
  - **colours**: its three dominant colours (k-means, k = 5, on a 96 px downsample; merge clusters closer
    than ~12 in RGB; order by share);
  - **surface**: the square window (side a quarter of the shorter edge) with the most gradient energy,
    avoiding near-uniform areas and the outer 4 %, as `crop` fractions, and `texture` 0..1;
  - a guessed kind (Image by default).
- For each, the person confirms: **kind** (Image / Object / Space, a segmented control), **from**
  (Your photos, Pinterest, Instagram, Artsy, Are.na, The web, Somewhere else), an optional **name**
  (≤ 60 characters) and an optional "Why did you save it?" (saved as a note). Then **Add to my database**.
- Removing a brought thing: its detail sheet, "Remove from my database", with an in-page confirm. It is
  removed with its image and its judgments.

### The Path (the month as milestones)
- A chip in every view's top bar, "Path 3/8", opens the Path sheet: eight milestones in order, each
  with a word state ("Done", "Next", "Not yet": never colour alone) and one line saying how the artist
  did the same thing in that month (the "why"), e.g. "Bring in something of your own: the artist brought
  5,021 saved works home from Artsy into one database."
  1. Sort your first five (Sort) 2. Bring in something of your own (Split) 3. Keep one of each kind
  (Split) 4. Pin a set and say what it's for (Set) 5. Find a turn (See) 6. Write a note (See)
  7. Take your seed (Seed: saved or copied) 8. Five days in a row (Sort).
- Finishing a milestone announces it once, politely ("Path: Pin a set. Done.") and never interrupts.

### About (from the "i" in Sort's header)
- No personal information about the artist: no name, no biography, no account details (the artist,
  21 Oct 2026: "Don't worry about my info for About"). Just what 5s is, in a sentence or two: five
  quick judgments a day build your own aesthetic database, which you split, set into rooms, see, and
  grow into a world; the cards come from an artist's database of saved works, and what you bring in is
  yours. Then the how-to lines, the privacy line, and the "Five-second ring" switch.

### Your hub: the person's own GitHub repository and site, made from inside 5s (Path milestones 9–12)

The artist, 22 Oct 2026: "We need to make making a repository on GitHub much more simple and keep the
user-interface for it on 5s … the button to create and name a repository on GitHub should all be done on
the 5s app … 5s … a dumbed down user interface for GitHub … for every challenge you come up against, I
need you to provide me a resolution as well."

**Words.** 5s never shows GitHub's vocabulary except the one button label the person must press on
GitHub's own page. A repository is **your hub**; a commit is **save**; GitHub Pages is **your hub's
address**; branches, pull requests and settings are never mentioned.

**Where.** A final section of Seed, **Your hub** (a card with the four steps as a stepper, each with
its state: Done / Next / Not yet, in words), opening the **Hub sheet**. The Path gains four milestones
after the eight (additive; the eight are unchanged):
 9. `github` · Seed · "Have a GitHub account" · "The artist kept everything in one GitHub repository from the first evening."
10. `hub` · Seed · "Make your hub" · "The artist's repository was made in four minutes, before the first session."
11. `saved` · Seed · "Save your seed to your hub" · "The artist's database grew by saving to it, every day."
12. `opened` · Seed · "Open your hub's address" · "The artist's site went live on GitHub Pages on 14 Sep."

**The four steps (the links bridge: works in the claude.ai artifact, for every viewer).** An artifact
cannot call GitHub (its frame blocks other sites), so 5s does everything except two button presses on
GitHub's own pages, which it opens already filled in.
1. **GitHub account.** "Make a GitHub account" opens github.com/signup in a new tab beside a three-line
   guide ("Pick a username you like: it becomes your hub's address, username.github.io"); "I have one"
   skips. Then **Your GitHub username** (public information; checked against GitHub's username rules).
2. **Make your hub.** Name prefilled `<username>.github.io` (labelled "becomes a website by itself";
   GitHub publishes a repository with that name automatically) or another name (then step 4 adds one
   tap). Public / Private ("Private: only you can see it; it won't be a website"). **Make my hub on
   GitHub** opens `https://github.com/new?name=…&description=…&visibility=…` and says: "Press the green
   Create repository button, then come back." A Copy name button covers a page that doesn't prefill.
   **I made it** moves on.
3. **Save your seed to your hub.** **Save my hub file** saves one self-contained `index.html` (the hub
   page, below) through the downloads capability (fallback: the file's text to copy). **Open the upload
   page** opens `https://github.com/<user>/<hub>/upload/main`: "Drag the file in and press Commit
   changes." **I saved it.**
4. **Your hub's address.** `https://<user>.github.io/` (or `/<hub>/`), "Open my hub", "It can take a
   minute to appear." For a hub not named `<user>.github.io`, one more tap: Settings → Pages opened
   directly, with the one choice to make spelled out.
Later: **Save to my hub again** whenever the seed has changed (the card says when it was last saved).

**The hub page** (`src/hubpage.js`, global `FiveSHubPage.build(...)`): a complete standalone HTML
document (its own doctype and head: it lives on github.io, not in an artifact, so it may show images
from Artsy's CDN) built from the person's seed: the seed code, their philosophy lines, positive and
negative space, their kept works as a grid (Artsy CDN images, each linking to its Artsy page, credited),
their colours, their pinned sets as rooms, their ground (rendered in 5s and embedded as a PNG), and,
only if they tick "Include my notes", their notes. Brought-in images are never included unless they
tick "Include my own images". The seed itself rides in `<script type="application/json" id="seed">`.

**The drivers** (`src/hub.js`, global `FiveSHub`): `rules` (GitHub's username and repository-name
rules, with a fix-up), `suggest(user)`, `links` (signup, login, newRepo, upload, site, pagesSettings),
and `api(token, fetch)`: the one-button driver for the standalone 5s app (create the hub, save files,
turn on the address, read the hub back, through api.github.com), tested against a fake GitHub, unused in
the artifact. Sign-in for the standalone app is GitHub's device flow (a code shown in 5s, approved at
github.com/login/device): no secret in the app.

**State** (additive): `state.hub = {user, name, private, mode: "links" | "api", madeAt, savedAt,
savedCode}` and `FiveS.setHub(state, patch, now)`; `path()` returns twelve milestones.

### 5s as a Claude connector (and the one-button GitHub that comes with it)

The artist, 22 Oct 2026: "I also need you to develop 5s in a way where it can be a connector for
Claude. GitHub doesn't come up as an available connector."

**What it is.** A remote MCP server, `5s/connector/` (a Cloudflare Worker), that anyone adds to Claude
as a custom connector (Settings → Connectors → Add custom connector → its URL). Connecting it shows
**GitHub's own sign-in and sign-up page**: the 5s connector signs people in with GitHub (OAuth, scopes
`read:user` and `public_repo`), so the GitHub connector Claude lacks is folded into 5s itself. From then
on, the 5s app (through the artifact's `mcp` capability) and any Claude chat can make and save the
person's hub with one button, and Claude can read and apply their taste.

**Tools** (names as Claude sees them; every input validated; every output plain JSON plus a short text
summary):
- `get_taste` → the profile: positive and negative space, philosophy lines, turns, leanings by era,
  place, material and quality, keep rate, speed. "Use this whenever the person asks for anything with
  an aesthetic: a sofa, a website, a gift, a room, an outfit, a trip."
- `aesthetic_brief({for})` → a short, paste-able brief of the person's taste aimed at one purpose
  ("a living room", "my portfolio site"), with three reference works (Artsy links and images) and
  what to avoid (their negative space).
- `next_five` → the next five cards (one per kind, from the deck), each with an image address, kind,
  and no names (names come after judging), so Claude can run a five in the chat.
- `judge({card, keep, ms?})` → records it with the same engine as the app; returns the reveal (title,
  artist, date) and whether it was a turn.
- `get_seed` → the 5s seed (aesthetics only).
- `hub_status` → whether they have a hub, its name and address, when it was last saved.
- `make_hub({name?, include_notes?})` → creates `<login>.github.io` (or the given name) on their GitHub
  account with the hub page, the seed and a README, and returns the address. One call; no GitHub page.
- `save_hub({include_notes?, include_own_images?})` → writes the current hub page and seed.
- `get_state` / `put_state({state, base})` → for the 5s app itself, so the app and the connector share
  one state (last writer wins unless `base` is stale, then it returns the newer state to merge).

**Storage and privacy.** The person's full state (judgments, notes, sets) lives privately in the
connector's own store (Workers KV, keyed by GitHub user id). Only what they choose reaches their
public hub: the seed and the hub page, never notes or brought-in images unless they say so. The
connector never reads any of their other repositories; with `public_repo` it can only write public ones,
which is why hubs are public by default (aesthetics only). Private hubs come with a GitHub App later.

**Reuse.** The connector imports the same `src/engine.js` (judgments, profile, philosophy, seed),
`src/hub.js` (the GitHub API driver) and `src/hubpage.js` (the hub page) as the app, and serves the
artist's deck (`dist/deck.json`, with Artsy image addresses) bundled at deploy time; the deck is never
committed.

**One-time setup on the artist's side** (copy-and-paste steps in `5s/connector/README.md`): a free
Cloudflare account; a GitHub OAuth App (homepage and callback URLs given); `wrangler deploy` (runnable
from a session once a Cloudflare API token is stored as an environment credential, the way the Artsy
token was); then **Add custom connector** in Claude with the Worker's `/mcp` URL. People using 5s never
see any of it.

### Connect your apps (the taste people already have, brought into 5s)

People's aesthetic preferences already live in other apps: pins, saves, likes, favourites, album
covers. 5s brings them in to form the person's database, without any download, through five doors,
simplest first. Whatever comes in becomes 5s things (kind, colours, surface, source), kept by
definition, and comes back as "Still yours?" (the existing mechanic).

| Door | How | Works for | Obstacle → resolution |
| --- | --- | --- | --- |
| **Paste a link** | A public board, channel or page: 5s reads its pictures | Pinterest boards (their public RSS feed), Are.na channels (public API), Flickr favourites, Tumblr, any web page (its preview image) | The artifact can't fetch other sites → the 5s connector fetches them server-side; in the artifact without the connector, this door waits |
| **Sign in to the app** | OAuth, read-only, saves only | Pinterest (boards and pins, once its developer access is approved), Are.na, Spotify (saved albums: their covers are a strong aesthetic signal), Flickr | Each app needs a developer registration on the artist's side, once → registrations are listed in the connector's README; apps that refuse use another door |
| **Your data file** | The app's own "download your data" file, dropped into 5s and read on the device; nothing uploaded | Instagram (saved posts), Pinterest, Google Takeout, TikTok favourites, X bookmarks | Instagram and others offer no API for saves → their export does; 5s knows each format and shows what it found before adding |
| **Bring in images** | Photos, screenshots, pins as images (built) | Everything | Already built: colours, surface and kind read on the device |
| **Ask Claude** | In any chat with the 5s connector: "add my Are.na channel" or "add these" | Anything Claude can reach: web pages, other connectors | → a connector tool `bring_in({items: [{image, title, link, source}]})` that Claude calls; 5s splits each item as usual |

Never: a password typed into 5s, a scraped login, or a browser extension.

**As built in the app (22 Oct 2026; where it differs from or adds to the plan above).**
- **Where.** The **Connect your apps** sheet opens from Split (a button beside "Bring in your own") and,
  as a second button beside "Bring in your own", from the intro and the Five sorted summary. It lists
  the five doors in the table's order, each a row with what it does in one line, "Works for …", and its
  state in words: **Open**, **Needs 5s in Claude**, **Not yet** (Sign in to the app) or, while the page
  is still asking, **Checking**. A door opens inside the same sheet (the sheet's title becomes the
  door's name; "All five doors" goes back). Bring in images opens the existing sheet, unchanged.
- **The connector, through the artifact's `mcp` capability** (`src/connect.js`, `FiveSConnect.connector`;
  the server name is the one constant `SERVER = "5s"`; tools `read_link`, `bring_in`, `item_image`, and
  `get_state` only to find things it already holds). `mcp` is **not** declared in the published
  capabilities until the connector is deployed; the code lights up when it is. A page that declares
  `db` can get a non-null `mcp` namespace for Claude's own artifact servers, so "connected" means
  `use("mcp")` resolved **and** `listTools("5s")` lists the server with tools; anything else (no
  namespace, no server, `server_not_connected` on a call) reads as not connected, and Paste a link,
  Sign in to the app and Ask Claude say: "Connect 5s to Claude (Settings → Connectors → Add custom
  connector) to open this door." (`needs_reauth`: "Reconnect 5s in Claude …"). A refusal shows the
  connector's own `why` and `resolution`.
- **Paste a link** (needs the connector): the address (with or without `https://`), **Read link**, the
  pictures listed with checkboxes (all chosen; the page can't show other sites' pictures, so each
  shows its source's letter), one Kind for all of them, **Add to my database (n)** → `bring_in` (its
  `remaining` sent again until done), each added thing kept here under the connector's id (`cid`),
  then its picture fetched with `item_image`, measured on the canvas (`FiveSBring.process`, so colours
  pending in the connector are read here) and kept like a person's own image.
- **Sign in to the app**: not built; its row says what opens it (the connector, and each app's approval).
- **Your data file** (works now, no connector): one reader for every app instead of one per format.
  It reads JSON (also X's script-wrapped archive files), web pages, spreadsheets, plain text, and a
  .zip holding them (zip64 too; unpacked by the browser's own `DecompressionStream`, no library), on
  the device. **Saves first**: when an export names its saves (keys, folders or files called saved,
  liked, favourites, bookmarks, pins, boards, collections), only those are read, so an Instagram
  download's messages are never opened. It walks JSON values, links and pictures in pages (a picture
  inside a link goes with it) and spreadsheet cells; groups what belongs to one post; drops help,
  policy and front pages; de-duplicates by link and picture address; says "214 links found, 37 with
  pictures."; and names the source from the file's name, then its contents, then where most links
  point (Instagram, Pinterest, Google Takeout, X, TikTok, Are.na, Flickr, Tumblr, else **Your file**;
  the person can change it). **Cap:** one file adds at most 200 things at a time and the saved state
  stays under 200 KiB (the store's document limit is 256 KiB); the sheet says so and the same file
  added again brings the next ones (what is in already is shown as such). Fifty rows show at a time.
- **What a brought-in thing from another app keeps** (state `own[]`, additive, the connector's field
  names): `image` (a picture address, when there is one), `link` (the post, pin or page), `thumb?`,
  `coloursPending: true` until its picture is read, `cid` (its id in the connector), `noPicture` when
  the picture couldn't be brought over. Kind is Image unless the person chooses otherwise; a thing with
  no name is called by what it is ("Instagram post", "Pinterest pin") or "Untitled". Links without a
  picture never get one, and the page says so plainly.
- **Pictures for things from files**, once 5s is connected: the ones with picture addresses go to the
  connector (`bring_in`) when they are added, or later with **Bring the pictures over**; then their
  pictures come back through `item_image`, 24 a visit without asking (the connector reads 30 a minute),
  then **Bring the rest of the pictures**.
- **The placeholder**: a thing with no picture here shows its source's letter (Instagram "I", Your file
  "F") on its colour, or on hatched paper, everywhere a brought thing appears: Split (Brought in, whose
  rows also say "Link only" or "Picture to come"), the "Still yours?" card (with why there is no
  picture), the Set chooser and room, the detail sheet (with **Open where it came from**) and the Five
  sorted tiles. "Still yours?" works for them as for any brought thing. Brought in folds to the newest
  24 with "Show all".
- **Ask Claude**: the sentence to say, with a **Copy** button and an optional link field that goes
  into it: "Show me the pictures at this link, then add the ones I pick to my 5s: [your link]".
- **Never on the public hub**: pictures brought in from other sites (by link or data file) are someone
  else's, so the hub page and its ground leave them out even with "Include my own images".
- **Obstacle → resolution**: the connector's `bring_in` refuses a `null` title or link, which its own
  `read_link` returns for untitled pictures → the app leaves empty fields out (`FiveSConnect.bringItem`);
  the connector could also accept `null` there.

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
    "cdn": "https://d32dm0rphc51dk.cloudfront.net/WA3Bfn0gtjXKvX_E_iVdTQ/large.jpg",   // the work's image on Artsy's CDN as artworks.db stores it ('large'), on every card whose work has one; the hub page shows it
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
FiveS.pinSet(state, set, now) / FiveS.unpinSet(state, index) -> State   // set may carry `name`
FiveS.card(state, deck, id) -> Card | null         // a deck card, or a brought-in thing as a card:
   // {id:"y…", kind, own:true, source, title: name || "Untitled", artist: "You", colours, crop, texture,
   //  w, h, materials:[], genes:[], era:null, place:null, img:null}  (the app supplies own images)
FiveS.bring(state, item, now) -> State             // item: {id, kind, name, source, colours, crop, texture, w, h}
FiveS.removeOwn(state, id) -> State                // drops the item, its judgments and notes about it
FiveS.addNote(state, {q, text, ref}, now) -> State // q: "turn" | "five" | "set" | "bring" | "free"
FiveS.removeNote(state, at) -> State
FiveS.markSeen(state, key) -> State                // e.g. "intro", "seed" (seed taken)
FiveS.path(state, deck, now) -> [{key, step, label, why, done, next}]   // the eight milestones, in order
```
- Brought things count as kept (weight 1) in the model and the profile until let go. Every function that
  takes `(state, deck)` sees them through `card()`; ids starting "y" are brought things.
- nextFive: if there are brought things that were brought before this five started and were not
  revisited in the last 2 days, one of them (the least recently revisited) replaces the card in the
  "dare" slot of its kind, flagged by `FiveS.isRevisit(state, id)`. Passing it sets `let` on the item.
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
  "own": [{"id": "y7k2q", "kind": "object", "name": "Grandmother's bowl", "source": "Your photos",
           "colours": ["#…", "#…", "#…"], "crop": [0.4, 0.3, 0.25, 0.25], "texture": 0.4,
           "w": 720, "h": 540, "at": 1761050000, "let": null, "seenAt": null}],   // metadata only, no images
  "notes": [{"at": 1761050000, "q": "turn", "ref": "o017", "text": "I didn't expect to like steel."}],
  "seen": {"intro": 1, "seed": 1, "path": ["sort", "bring"]},   // path = milestones already announced
  "opts": {"ring": true}
}
```
(`sets[]` entries may also carry `"name": "A room for slow mornings"`.)

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
  "streak": 3, "todayDone": true,
  "brought": 6, "letGo": 1,
  "sources": [{"source": "The artist's database (Artsy)", "n": 31}, {"source": "Your photos", "n": 4}],
  "notes": 5
}
```

### The 5s seed (exportSeed)
```jsonc
{
  "format": "5s-seed", "version": 1, "code": "5S-4F2A-9C1E", "made": "2026-10-21",
  "counts": {"judged": 75, "kept": 38, "passed": 37, "turns": 3},
  "kept":   [{"work": "joris-laarman-bone-armchair-1", "kind": "object", "ms": 1840}],
            // each kept work also carries "image" (its deck "cdn", or null) and "url" (its Artsy page): public addresses for the hub page
  "passed": [{"work": "…", "kind": "colour"}],
  "palette": {"kept": ["#…"], "passed": ["#…"]},
  "surfaces": [{"work": "…", "crop": [0.41, 0.22, 0.25, 0.25]}],
  "leanings": {"positive": [["gene:biomorphic", 0.31]], "negative": [["gene:geometric", -0.4]]},
  "turns": [{"work": "…", "dir": 1, "because": ["gene:geometric"]}],
  "sets": [{"name": "A room for slow mornings", "wall": "…work slug…", "window": "…", "picture": "…", "floor": "…", "object": "…"}],
  "own": [{"name": "Grandmother's bowl", "kind": "object", "source": "Your photos", "colours": ["#…"], "let": false}],
  "notes": [{"q": "turn", "text": "I didn't expect to like steel.", "about": "…work slug or own name…", "at": "2026-10-21"}],
  "speed": {"medianMs": 1800}
}
```
Works are named by their Artsy slug, the id the art database and the game already use; brought things
by the name the person gave them (no images). No account name, email or id ever goes in.

## Persistence (app.js)
- Declared capabilities: `{db: {}, user: {}, sample: {}, downloads: true}`.
- The state is one document: `data/users/<await user.id()>/state` (4 segments), private to the viewer
  (even from the owner). Load: subscribe once; if absent and localStorage has a state, migrate it. Save:
  debounce ~800 ms, one write in flight at a time, only when changed. Mirror every save into
  localStorage (key `5s.state.v1`, try/catch) so a view without `db` (signed out, preview, a Viewer who
  cannot write) still works; a rejected write switches that visit to local only and says so once in the
  footer: "Saved in this browser only."
- The page renders immediately from localStorage (or a fresh state) and lights up when `db` resolves.
- Brought-in images are NOT in the state document. Each is its own private document
  `data/users/<uid>/own-<itemId>` = `{img: dataURL, thumb: dataURL, at}` (keep it under ~200 KB). Without
  `db`, they go to IndexedDB (database "5s", store "own"); without either, they live for this visit only
  and the sheet says so. Load them lazily (thumbnails first).
- Example mode's brought things carry `imgFrom: <deck card id>` so the app can show a stand-in image.
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

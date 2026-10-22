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
The artist's Architectural Authority bookmarks propose alongside (the artist, 22 Oct 2026: "work in the
Architectural Authority bookmarks as objects to like and dislike along with the artworks"): buildings,
judged like any card, each linking to its article on The Architectural Authority and naming its architect.

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

| The artist's month | In 5s |
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
comes from a real saved work (an Artsy save, or a building the artist bookmarked on The Architectural
Authority: its Space and a Surface crop of its materials), so nothing is made up; after judging, the
work behind it is revealed.

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
  opening its detail sheet with a link out to Artsy, or for a bookmark "View on The Architectural
  Authority", its maker labelled Architect).
- Empty state: a designed placeholder per section naming what will fill it.
- **Bring in your own** (a prominent button at the top of Split; also offered from the intro and the
  Five sorted summary): see "Bring in your own" below. Brought things appear in a **Brought in** section
  (thumbnail, name, source), are kept by definition (they are the person's saves), and feed every
  part section like kept cards (their colours, their surface crop, their kind).
- **Sources**: where the things in the database come from, as a short list with counts ("The artist's
  database (Artsy) · 31", "The artist's bookmarks (Architectural Authority) · 3", "Your photos · 4",
  "Pinterest · 2"; deck cards counted by their `source`, none meaning Artsy). This is the database connected to other
  websites and apps, said plainly.
- **Let go**: the things the person let go of on a "Still yours?" card (thumbnail, when), quiet.

### Set (compose: the mood board as a room)
- **22 Oct 2026: Set becomes a mood board and a game** (see "Set: the board and the game" below). The
  board is Set's presentation; the room below stays exactly as it is, one tap away ("See it as a room").
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
  grow into a world; the cards come from an artist's database of saved works and bookmarked
  architecture, and what you bring in is yours. Then the how-to lines, the privacy line, and the "Five-second ring" switch.

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
negative space, their kept works as a grid (Artsy CDN images, each linking to its Artsy page, credited;
a kept bookmark shows its photo, a kept Surface its crop, and links to its Architectural Authority page,
the credits then naming both sites),
their colours, their pinned sets as rooms (a set in the seed names a work by its slug, which a bookmark's
Space and Surface share: each place in the room takes the card of its own kind, so a bookmark's crop is
the floor), their ground (rendered in 5s and embedded as a PNG), and,
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
  ("a living room", "my portfolio site"), with three reference works (their pages on Artsy or The
  Architectural Authority, and images) and
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
artist's deck (`dist/deck.json`, with its image addresses: Artsy's CDN, a bookmark's own photo) bundled at deploy time; the deck is never
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
- **As built, 22 Oct 2026 (CONCEPT.md: copy a link out, paste one in to define and catalogue it).** Paste
  a link no longer waits for the connector; it is also a button at the top of Split. The box takes a
  link (or text with one in it) and a picture (pasted, dropped or chosen; its colours read on the
  device). `FiveSLinks.recognise` cleans the address (tracking, referral and affiliate tags, and
  anything of the person's: emails, tokens, sessions, subscriber ids), then: a deck card → **Already in
  5s** (Keep this card); a link already brought in → its detail; else **Is this it?** with the
  address's own words (with the connector, the page's own facts and picture): name, maker and date
  editable, its other facts and words removable, colours marked *estimated* until a picture is read. **Define** (only with `sample`, only
  when pressed) sends `definePrompt` (the address and page fenced as data) and reads the answer with
  `parseDefinition` (the deck's words only; an unrecognised thing keeps the address's name and facts).
  **Add to my database** → `FiveS.bring` with the defined fields; refused, with what to do, when the
  state would pass 200 KiB. Every detail sheet has **Where it lives** (`FiveSLinks.whereItLives`: its own
  page, its styles, its maker on Artsy (not for a bookmark's architect), searches elsewhere), each with Open and Copy, and Copy all.
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
  "source": "The art database: Artsy saves and Architectural Authority bookmarks",
  "atlas": {"src": "img/atlas.webp", "cell": 128, "cols": 20},   // thumbnails of every card's work
  "genes": {                                     // only genes some card uses
    "biomorphic": {"name": "Biomorphic", "family": "Visual Qualities"}
  },
  "cards": [{
    "id": "o017",                // kind letter (i o s u c) + number; stable within a build. A bookmark: b + number
                                 // (its Space, or Object where buildings.json says "kind": "object") and m + number (its Surface)
    "kind": "object",            // image | object | space | surface | colour
    "work": "joris-laarman-bone-armchair-1",   // Artsy artwork slug; a bookmark: its Architectural Authority slug, the same on its b and m cards
    "url": "https://www.artsy.net/artwork/joris-laarman-bone-armchair-1",
    "cdn": "https://d32dm0rphc51dk.cloudfront.net/WA3Bfn0gtjXKvX_E_iVdTQ/large.jpg",   // the work's image on Artsy's CDN as artworks.db stores it ('large'), on every card whose work has one; the hub page shows it. A bookmark: its original photo's address
    "title": "\"Bone\" Armchair",
    "artist": "Joris Laarman",
    "date": "2007",
    "year": 2007,                // int or null
    "era": "2000s",              // one of the ERA buckets below, or null
    "category": "Design/Decorative Art",
    "medium": "Carrara marble powder and casting resin",
    "materials": ["marble", "resin"],          // MATERIAL families below (a bookmark's, from buildings.json, may be other words)
    "place": "Netherlands",      // country from nationality, or null
    "colours": ["#c0c2c1", "#a7a6a1", "#bbbbbb"],   // Artsy dominant colours, in Artsy's order; a bookmark: the app's own k-means (src/bring.js)
    "genes": ["biomorphic", "irregular-curvilinear-forms", "furniture"], // artist genes, aesthetic families only
    "img": "img/o017.webp",      // image/object/space: the work; surface: the crop; colour: null
    "w": 720, "h": 698,          // pixel size of img (null for colour)
    "thumb": 17,                 // index of this work's cell in the atlas
    "source": "Artsy",           // "Artsy" | "Architectural Authority"; a card without one is from Artsy (older decks, the fixture)
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
- The artist's Architectural Authority bookmarks (`buildings.json` + `data/aa/`) come after the Artsy
  cards: b001… and m001…, `source` "Architectural Authority", `url` the article on
  thearchitecturalauthority.com, `artist` the architect (null for a few), `category` "Architecture"
  (one is "Design/Decorative Art"); most have no date, year or era, and none has a Colour card.
  The app takes its words from `source` in one place per file: engine.js `DECK_SOURCES` and
  `deckSource(card)` (the site, "View on …"; the maker's label, Artist or Architect; the Sources line),
  links.js (The Architectural Authority is a known site; Artsy's search for a maker is not offered for
  a card from elsewhere), hubpage.js `SITES` (the credits; a kept work is found by its work and kind).

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
            // each kept work also carries "image" (its deck "cdn", or null) and "url" (its Artsy page, or a bookmark's Architectural Authority page): public addresses for the hub page
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
Works are named by their Artsy slug, the id the art database and the game already use (a bookmark by its
Architectural Authority slug, with its kind telling its Space from its Surface); brought things
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

## Set: the board and the game (22 Oct 2026)

The artist, over a screenshot of Set's room (CONCEPT.md, "Set as a game"): the liked objects should
appear "more like a mood board that you would find on Pinterest"; "you are able to reinforce
juxtapositions of aesthetics by associating compliments [complements] that you like between liked
objects", drawn with "the same gestures you find in Candy Crush Saga"; and this part "should be the
most game-like and should be able to be played just like Candy Crush Saga".

So Set gains two things and keeps the room:
- **The board** is Set's presentation: a Pinterest-style masonry board of everything the person keeps,
  at its own proportions, grouped by what they have put together in the game.
- **The game** is Candy Crush Saga's rules played with the person's own things. Three in a line is a
  juxtaposition: three different things (a rug, a painting, a building) that share one of the
  person's own threads (a colour family, a material, a movement), put together by the person's own
  swap. The pairings made this way organise the board and, later, teach the taste model what goes
  together.
- **The room** stays as it is, one tap away ("See it as a room"): its slots, its three candidates,
  Pin this set, the pinned sets and the Path's milestone 4 are unchanged.

The standing rules, applied: nothing to download (web only; every sound is synthesised, no files);
no one pays (no lives, no waiting, nothing bought, no ads, no timers, nothing that nags); aesthetics
only (threads are colours, materials, qualities, movements and textures, never price, fame or
place); add, never take away. Irwin's rule becomes a game rule: the board always offers at least
three ways to go.

### Set's view (wired in by the integration team)
- `#set` shows the board. Heading "Set", sentence: "Your board: what you kept, grouped by what you put
  together." Then two buttons: **Play level 7** (Ember, ≥ 56 px; the next level's number) and **See it
  as a room** (quiet). The room view carries **See it as a board** in the same place. The board is
  always what `#set` opens.
- Play opens the game over Set at full height (the tab bar hides while a level is on; the map's Back
  returns to the board). It is part of Set, not a new tab. Leaving a level costs nothing; the app
  keeps the running level in memory while the page is open, and it is not saved.
- Example mode: the board shows the example taste; the game plays, and nothing is saved.
- Nothing kept yet: "Your board fills with what you keep. Sort a five and it starts." with **Sort** and
  **See an example**; Play is still offered (the tiles are colour swatches until things are kept).

### The board (FiveSBoard)
- **What is on it**: kept things (deck cards whose latest judgment is a keep, and brought things not
  let go: `profile.keptByKind`, across every kind and source) and the paintings kept from paint levels.
- **Each tile at its own proportions**: a picture at its image's w:h; a Colour card as its three bands
  (3:2:1, top to bottom) at 3:4; a painting as its grid at cols:rows. Corner radius 16 px, no border,
  no caption (the name is the button's label); while an image loads, the tile is its first colour.
- **Masonry**: columns = clamp(floor((width + 8) / 176), 2, 5) (two on a 390 px phone), 8 px gaps;
  each tile goes into the shortest column so far (ties: the leftmost), in order. Images
  `loading="lazy" decoding="async"` with width and height set (no layout shift). Relayout on resize
  (ResizeObserver, at most once per frame).
- **Sections**, each a small heading (Figtree 600) and a meta line, each its own masonry:
  1. **Clusters** (once there are associations), from `FiveSMatch.clusters`: heading = the one or two
     threads most of its members share ("Paper · Orange"; none shared by two: "Put together"); meta =
     "5 things · put together 9 times" (+ " · 2 kept" for hearted pairings). Strongest first; inside a
     cluster, the most connected thing first.
  2. **Paintings you made** (when there are any). A painting tile opens a small sheet: the painting
     large, "Level 7 · 22 Oct", and Remove (in-page confirm).
  3. **The rest**. Before any associations, by kind: "Images", "Objects", "Spaces", "Surfaces",
     "Colours" (brought things sit in their kind). After: one section, "Not put together yet", in kind
     order, newest first.
- Each thing's tile is a button (`aria-haspopup="dialog"`, label = kind + the app's name line) that
  opens the detail sheet, which already says where the thing lives.
- Tiles fade in once (150 ms) when first shown; nothing moves under reduced motion.

### Suits: your threads
In Candy Crush a suit is a candy colour. In 5s a suit is **one of the person's threads**, and every
tile shows the thing's own picture (or a Colour card's bands) inside its suit's frame. The frame is
what reads at a glance, by colour and by shape, so no one needs colour to play:

| # | Token | Frame colour | Shape (clip-path in the tile's box) | Plain word |
| --- | --- | --- | --- | --- |
| 0 | flare | `#FF6B4D` | circle: `circle(50%)` | Red |
| 1 | ember | `#FF9B55` | petal: `inset(0 round 50% 6% 50% 6%)` | Orange |
| 2 | sun | `#FFD54A` | arch: `inset(0 round 50% 50% 8% 8%)` | Yellow |
| 3 | fern | `#4FD18B` | hexagon: `polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)` | Green |
| 4 | cobalt | `#6C9DFF` | square: `inset(4% round 18%)` | Blue |
| 5 | iris | `#A78BFF` | diamond: `polygon(50% 0,100% 50%,50% 100%,0 50%)` | Violet |

A tile is the shape filled with its frame colour, and the picture inset 14 % in the same shape (a ring
of about 5 px at 40 px). The board sits on a dark **table** in both themes (`#1B1726`): every frame
colour is ≥ 6.2:1 against it.

**Choosing the threads**: `FiveSMatch.pieces(state, deck, n)`, deterministic:
1. Things = the kept things above, as cards (`FiveS.card`).
2. Thread candidates: every feature key a thing carries with weight ≥ 0.3 (`FiveS.features`) whose
   group is Materials, Qualities, Movements or Textures, or that is a `hue:` key (13 hue families,
   neutral included). Never kinds, categories, eras, places, subjects, value, chroma or chord.
   Eligible: ≥ 3 members, of ≥ 2 kinds (so a line can juxtapose kinds).
3. Score = min(members, 12) × (1 + max(0, lift)), lift = the key's lift in `profile.groups` (n ≥ 3;
   else 0). Sort by score, then key.
4. Pick in that order, skipping a thread whose members overlap a picked one by Jaccard ≥ 0.6, and a
   third thread from one group; if fewer than n are picked, a second pass without the group limit.
5. Assign each thing to the picked thread where weight × (1 + lift) is largest (≥ 0.3; ties: the
   earlier pick). A thread left with fewer than 2 things takes back its own candidates from threads
   holding ≥ 4 (highest weight first) until it has 2.
6. Still fewer than n: hue families in order of members (any count, any kinds), taking only things not
   yet in a suit; then **swatch suits**.
7. Swatches (for any suit left with no things): the person's kept colours (`profile.keptColours`) of
   the suit's hue family for a hue thread, otherwise all of them, three at a time as chords; with no
   kept colours at all, the suit's frame colour at 100 %, 70 % and 40 % toward paper.
8. Tokens: suits keep their score order (suit 0 is the strongest thread). A hue thread takes its
   family's token (red, rose → flare; orange → ember; yellow, lime → sun; green, teal → fern; cyan,
   blue, indigo → cobalt; violet, magenta → iris), first come first served; every other suit takes the
   free tokens in table order.
9. Labels: `FiveS.featureLabel(key)` ("Orange", "Paper", "Abstract Art", "Fine texture"); a swatch
   suit without a thread uses its token's plain word.
10. Also returned: `passed` (deck cards whose latest judgment is a pass, then let-go brought things,
    newest first: the pictures on pass blockers) and `out` (things in no suit; they sit this level out
    and stay on the board).

On the example taste (37 things) this gives Orange, Neutral, Paper, Acrylic and Fine texture.
**Why threads, not hue alone**: a match then says something about the person ("these three share
Paper") and joins different kinds of things; one suit per thing keeps matching as unambiguous as
candy; suit 0 is always the person's strongest thread, so a collect goal asks for their own taste;
hue families still win when they are the strongest threads, and are the fallback when there is
little data. Hue-only suits would only ever say "these are orange".

**The legend**, under the board: each suit's token, its label and how many things are in it
("Paper · 5"); a swatch suit says "Blue · your colours". Tiles of a suit cycle through its things in
a ring (kinds interleaved: image, object, space, surface, colour, again; shuffled within a kind by
the game's seed), so all of them appear and neighbours tend to be different kinds.

### The game: the rules (Candy Crush Saga's)
**The grid.** cols × rows (7×7 to 9×9; cell i = row × cols + col, row 0 at the top), optionally
shaped by a mask. A playable cell can be a paint cell (1 or 2 coats), hold a pass blocker, or hold a
tile. A tile has a suit (0..5, or none for the mark), a thing (or a swatch), and maybe a special.

**Swapping** (the gesture). Press a tile and drag toward a neighbour: past 0.3 of a cell (at least
10 px) along the dominant axis, the two swap at once. Or tap one (it lifts and gets an Iris ring:
"Selected") and tap a neighbour; tapping it again, or Escape, puts it down; tapping a non-neighbour
selects that one instead. Keyboard: one tab stop on the board; arrow keys move focus; Enter or Space
picks up the focused tile, and while it is up an arrow swaps it that way; Shift+arrow swaps directly;
H shows a hint; M toggles sound. Input waits while the board is resolving. `touch-action: none` on
the board only.

**A swap counts** when neither tile is held or blocked, and: a line of 3+ of one suit passes through
either tile after the swap, or both tiles are specials, or either is the mark. Otherwise the tiles
slide back (bounce) and no move is spent. A counted swap spends one move.

**Matching and specials.** Every horizontal and vertical run of 3+ tiles of one suit is a run (held
tiles count; the mark never does); runs sharing a tile form one group. A group makes at most one
special, by priority:

| Group | Makes | Name in 5s | It does, when cleared |
| --- | --- | --- | --- |
| a run of 5+ in a line | the colour bomb | **the mark** (the 5s logo tile: no suit, no picture) | swapped with a tile: clears every tile of that tile's suit. Hit by a blast: clears every tile of the most common suit (ties: lowest suit) |
| a horizontal and a vertical run (L, T, +) | wrapped | **a burst** | clears the 3×3 around it, stays, falls with the board, clears the 3×3 again, then goes |
| a run of exactly 4 | striped | **a stripe** | a horizontal run makes a column stripe (clears its column); a vertical run makes a row stripe (clears its row) |
| a run of 3 | nothing | | |

The special appears in the cell the person dragged the tile into if that cell is in the group, else
in the other swapped cell if it is; otherwise (cascades) a burst at the runs' crossing, other
specials in the middle cell of the longest run (the lower/left middle when even). It keeps that
tile's suit and thing; the mark takes neither.

**Two specials swapped** (as in Candy Crush; centred on the cell the tile was dragged into):

| Swap | Result |
| --- | --- |
| stripe + stripe | its row and its column clear |
| stripe + burst | three rows and three columns clear |
| burst + burst | the 5×5 clears, the burst falls, the 5×5 clears again |
| the mark + a plain tile | every tile of that suit clears |
| the mark + a stripe | every plain tile of the stripe's suit becomes a stripe (row or column, by the seed), then all fire |
| the mark + a burst | every plain tile of the burst's suit becomes a burst, then all fire (twice each) |
| the mark + the mark | **"Clean slate."** every tile clears, every pass loses a layer, every held tile is freed |

**Resolving, in waves** (deterministic; `steps` record each event for the animation):
1. Wave 1 is the swap's own (by the person). A combo or the mark resolves as above; otherwise find the
   groups and decide their specials.
2. The clear set = every group's cells, minus the cells where a special is being made. Specials in the
   clear set fire, first in, first out, each adding its cells (cells in row-major order); any special
   they hit fires in turn. A burst that fires for the first time stays, armed.
3. Apply, in row-major order: a held tile in the clear set is freed and stays; any other tile leaves.
   A paint cell whose tile leaves takes a coat (below). Each pass next to a matched cell (orthogonally)
   or inside a blast loses one layer, at most one per wave; at 0 its cell becomes empty. Collect goals
   count the tiles that leave. Score is added.
4. In wave 1, each group with 2+ different things is a juxtaposition the person made: it is recorded
   (`onAssociate`). Waves 2+ (cascades), blasts, combos and the mark record nothing.
5. **Gravity**: tiles fall straight down into empty cells until a hole, a pass, a held tile, the edge or
   another tile stops them. A **source** is a playable cell with a hole, a pass, a held tile or the
   edge above it; an empty source takes a new tile, which falls on. Repeat until no playable cell is
   empty. A new tile's suit is uniform over the level's suits (the game's PRNG, no bias, so lucky
   cascades happen); its thing is the suit ring's next.
6. Armed bursts fire again, then the next wave (by cascade) finds groups. Repeat until nothing moves.
7. **Three ways, always**: when the settled board offers fewer than 3 counted swaps, it reshuffles
   (the movable tiles permuted by the PRNG until no run exists and ≥ 3 swaps do; after 100 tries,
   their suits are drawn afresh): "Shuffled: always three ways to go." No move is spent.
8. End check (below).

**Paint** (Candy Crush's jelly). A paint cell is painted when its tile leaves, in that thing's first
colour (a swatch's first colour; the frame colour for a thing without colours; Iris `#7350EE` when
the mark itself leaves). A one-coat cell is done in one; a two-coat cell shows the first coat as a
wash and, on the second, takes the middle of the two colours (each RGB channel averaged and rounded): Color Middling, on a board. A painted cell keeps
its colour: later clears do not repaint it, so the finale cannot spoil the picture. Painting every
paint cell is the goal; the finished board is a composition the person can keep.

**Blockers** (later levels):
- **A pass**: a cell held by a thing the person passed (from `pieces.passed`, in order; none passed: an
  empty outline). Shown hollow: the picture greyed at 45 % inside a dashed outline (two outlines for
  two layers). It cannot be swapped or moved, takes no tile, and loses a layer to a match beside it or
  a blast over it. Clearing passes is negative space opening up.
- **Held**: a tile under two straps (an X). It cannot be swapped and does not fall; a match through it
  or a blast frees it (it stays, free) and it does not count as collected until it leaves later.
Paint cells never lie under a pass or a held tile.

**Moves, goals, the end.** Each level has a move budget and one or two goals: **score** (reach n),
**collect** (n tiles of one suit, or of one kind of thing), **paint** (every paint cell), **clear** (every
pass, every layer). A level whose only goal is a score plays out all its moves and is won if the score
reached the first star. Any other level is won the moment its goals are met once the board settles,
then **the finale**: "All set." Each move left turns a random plain tile into a stripe (+100 each), and
every special on the board fires in turn, in waves (nothing recorded, nothing repainted). Out of moves
without the goals: **"Out of moves."** with what is left ("3 cells left to paint"), **Five more** if the
person has one and has not used it this level, **Try again** and **Map**. Nothing is ever lost.

A kind goal ("Collect 12 Images") is scaled to the person's things: with share = the expected share of
tiles of that kind (the average over the suits of that kind's share of the suit's things), n becomes
max(4, round(n × min(1, share / 0.25))); with share 0 it becomes "collect n of suit 0".

**Stars.** Score-only levels: one star per threshold reached (s1 to win). Other levels: winning gives
1, and 2 and 3 at s2 and s3, counted after the finale. Best scores are kept.

**Score.** Each tile that leaves: 20 × min(wave, 5). Making a stripe +60, a burst +100, the mark +200.
Each coat +50, each pass layer +50, each held tile freed +50. The finale: +100 per move left, plus
what its stripes clear (at wave 1). A "+120" rises from each group.

**Hint.** After 5 s without input (when hints are on), the best swap nudges twice (the swap whose wave 1
clears the most; combos and the mark count 10; ties: lowest cells), and again every 5 s. On a coach
level the first hint is the swap that makes the taught special.

**Boosters**, earned, never bought (each held 0..9; first play starts with one of each):

| Booster | Candy Crush's | It does | Spends a move |
| --- | --- | --- | --- |
| **Pass** | lollipop hammer | press a tile: it leaves (a special fires; a held tile is freed; a pass loses a layer) | no |
| **Turn** | free switch | swap any two movable neighbours, no line needed; lines it makes count as yours | no |
| **Five more** | +5 moves | +5 moves, once a level, during play or on "Out of moves" (play resumes) | no |

Earned by: the first time a level reaches 3 stars, one booster (Pass, Turn, Five more in turn by level
number: (n − 1) mod 3); the first win of each fifth level (5, 10 … 30), one of each; and (by the
integration team) finishing today's five in Sort, one Pass, once a day.

**No lives.** Play any unlocked level as often as you like; every attempt that ends (won, out of
moves, or left) counts in `saga.plays`, so the next attempt is a new board (the seed is
`'5s:' + n + ':' + saga.plays`). Levels unlock one after another; nothing else gates them.

### Associations: what you put together
- A juxtaposition is a wave-1 group with 2+ different things. Every pair in it is recorded:
  `state.assoc` entries `[a, b, n, heart, at]`. Cascades, blasts, combos, the mark and the finale
  record nothing: only the person's own swap (or Turn) is a judgment.
- **The level end** shows "What you put together": up to 6 groups made in the level (most things first,
  then newest), each its thumbnails, the thread and the short names ("Paper: Bone Armchair, Untitled,
  Casa Malaparte"), and a heart button **Keep** (`aria-pressed`) that keeps those pairings explicitly
  (tap again to unkeep). Groups made in a level that ran out of moves are shown too: they still count.
- **The board** clusters by them: edges weigh n + 2 × heart; strongest edges first (ties: hearted,
  newest, ids), two clusters merge only while the result has ≤ 8 things; clusters of 2+ are shown.
- **The taste model** (the integration team's additive engine change, later; the intent): pairings say
  which features go together for this person. Proposed: `FiveS.together(state, deck)` = feature pairs
  (thread keys of the two things, weight ≥ 0.3) weighted by n + 2 × heart, with lift over chance; See
  gains "What you put together" (pair chips, "Paper + Steel · 9"), the philosophy and Claude's prompt
  name the top pairings, nextFive's match slots may favour a card that carries one side of a strong
  pairing whose other side the person keeps, and exportSeed gains `pairs` (works by slug, brought
  things by name) and `paintings`. `removeOwn` drops pairs that name the removed thing.

### The saga
- Six episodes of five levels, named for the five steps and the habit, on a map that climbs (level 1
  at the bottom, DOM order 1..30 so Tab follows the path upward), scrolled to the next level:
  1 **Sort** (1–5) "Line things up." · 2 **Split** (6–10) "Paint with their colours." · 3 **Set** (11–15)
  "Clear what you passed." · 4 **See** (16–20) "Free what's held." · 5 **Seed** (21–25) "Boards in new
  shapes." · 6 **Another five** (26–30) "All of it, together." Level 25 is Seed's house; level 30 is
  the 5 itself, to paint in your own colours.
- Nodes are 56 px rounded squares (the logo's corner) with the number in Unbounded, on a path drawn as
  the logo's ribbon (violet and blue bands). Done: Ember to Flare fill, its stars as glyphs and "2 of 3
  stars" in text. Next: an Iris ring and "Next". Not yet: hollow, "Not yet" in its label. Never colour
  alone.
- A level node opens **the level card**: "Level 7", the goals in words ("Paint every cell", "Collect 20
  · Orange"), moves, the suits' legend, the boosters held, **Play**. Coach levels add one line.
- Levels past 30 come from `FiveSMatch.level(n)` (the 26–30 recipes in turn, each with 2 more moves
  and its thresholds × 1.1 per lap), so the saga never stops.

### Levels 1–30 (initial; the playtest tunes them)
Moves come from a rough simulation (a player taking the swap that paints most, 200 boards each):
about the 80th percentile early and the 65th later. Paint-everything levels use 4 suits, because 5
suits on 8×8 took 32 moves at the median. s1 = "win" means any finish earns the first star.

| n | Episode | Board (cells) | Suits | Moves | Goals | Blockers | Stars s1 / s2 / s3 | Coach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sort | 7×7 (49) | 4 | 15 | score 3,000 | — | 3,000 / 6,000 / 9,000 | swap |
| 2 | Sort | 7×7 | 4 | 15 | collect 20 of suit 0 | — | win / 5,000 / 8,000 | |
| 3 | Sort | 7×7 | 4 | 18 | score 5,000 | — | 5,000 / 8,000 / 11,000 | stripe |
| 4 | Sort | 7×7 | 5 | 20 | collect 12 of suit 0 + 12 of suit 1 | — | win / 4,500 / 6,500 | |
| 5 | Sort | 8×8 (64) | 5 | 20 | score 3,000 | — | 3,000 / 4,500 / 6,500 | burst |
| 6 | Split | 7×7 | 4 | 14 | paint centre 5×5 (25) | — | win / 6,000 / 9,000 | paint |
| 7 | Split | 7×7 | 4 | 24 | paint all (49) | — | win / 9,000 / 13,000 | |
| 8 | Split | 8×8 | 5 | 22 | collect 12 Images | — | win / 5,500 / 7,500 | mark |
| 9 | Split | 8×8 | 5 | 22 | paint centre 6×6 (36) | — | win / 6,000 / 8,500 | |
| 10 | Split | 8×8 | 4 | 30 | paint all (64), centre 4×4 two coats | — | win / 12,000 / 16,000 | |
| 11 | Set | 8×8 | 5 | 20 | clear | 8 passes, bottom | win / 5,000 / 7,000 | pass |
| 12 | Set | 8×8 | 5 | 24 | clear + score 4,000 | 12 passes, bottom | 4,000 / 6,000 / 8,000 | |
| 13 | Set | 8×8 | 4 | 26 | paint all (52) + clear | 12 passes, bottom | win / 11,000 / 15,000 | |
| 14 | Set | 8×8 | 5 | 26 | clear | 8 two-layer then 8 passes, bottom | win / 6,500 / 9,000 | |
| 15 | Set | 9×9 (81) | 4 | 28 | paint all (69) + clear | 12 two-layer passes, scatter | win / 12,000 / 17,000 | |
| 16 | See | 8×8 | 5 | 22 | collect 15 of suit 0 | 8 held, scatter | win / 5,500 / 7,500 | held |
| 17 | See | 9×9 | 4 | 28 | paint all (71) | 10 held, scatter | win / 12,000 / 16,000 | |
| 18 | See | 9×9 | 5 | 25 | score 5,000 | 9 held, centre 3×3 | 5,000 / 7,500 / 10,000 | |
| 19 | See | 9×9 | 5 | 28 | clear | 18 passes, bottom; 9 held, scatter | win / 7,500 / 10,500 | |
| 20 | See | 9×9 | 4 | 32 | paint all (73), centre 3×3 two coats | 8 held, scatter | win / 14,000 / 19,000 | |
| 21 | Seed | diamond (41) | 4 | 24 | paint all (41) | — | win / 7,000 / 10,000 | |
| 22 | Seed | ring (72) | 6 | 30 | collect 12 each of suits 0, 1, 2 | — | win / 5,000 / 7,000 | |
| 23 | Seed | island (69) | 5 | 28 | paint centre 5×5 (25) + clear | 10 passes, sides | win / 8,000 / 11,000 | |
| 24 | Seed | halves (72) | 4 | 32 | paint all (72) | — | win / 12,000 / 16,000 | |
| 25 | Seed | house (53) | 4 | 30 | paint all (53), walls (rows 5–8) two coats | — | win / 12,000 / 16,000 | |
| 26 | Another five | 9×9 | 6 | 32 | collect 10 Spaces + 10 Objects | — | win / 6,000 / 8,500 | |
| 27 | Another five | 9×9 | 4 | 34 | paint all (81), centre 5×5 two coats | — | win / 15,000 / 20,000 | |
| 28 | Another five | cross (45) | 4 | 28 | clear | 12 two-layer passes, bottom; 6 held, scatter | win / 7,000 / 10,000 | |
| 29 | Another five | 9×9 | 5 | 32 | paint centre 5×5 (25) + clear | 18 passes, bottom; 6 held, scatter | win / 10,000 / 14,000 | |
| 30 | Another five | the 5 (61) | 4 | 30 | paint all (61) | — | win / 10,000 / 14,000 | |

**Masks** (9×9, `#` playable, `.` a hole):
```
diamond    ring       island     halves     house      cross      five
....#....  #########  ..#####..  ####.####  ....#....  ...###...  #########
...###...  #########  .#######.  ####.####  ...###...  ...###...  #########
..#####..  #########  #########  ####.####  ..#####..  ...###...  ###......
.#######.  ###...###  #########  ####.####  .#######.  #########  ###......
#########  ###...###  #########  ####.####  #########  #########  ########.
.#######.  ###...###  #########  ####.####  .#######.  #########  #########
..#####..  #########  #########  ####.####  .#######.  ...###...  ......###
...###...  #########  .#######.  ####.####  .#######.  ...###...  #########
....#....  #########  ..#####..  ####.####  .#######.  ...###...  ########.
```
**Placing** (in this order: mask, passes, held, paint; paint takes only cells still plain):
- *bottom*: the lowest row first, each row from the board's centre column (floor((cols − 1) / 2))
  outward (centre, left of it, right of it, …, skipping holes), upward until n are placed (several
  entries continue where the last stopped).
- *sides*: each row's leftmost then rightmost playable cell, bottom row first.
- *scatter*: random playable cells (PRNG `'layout:' + n`), never in the top row, never orthogonally
  next to another pass or held tile, never inside the level's centre paint or two-coat square.
- *centre K×K*: the cells of the centred square (first row and column = floor((N − K) / 2)).
- *all*: every playable cell still plain.

`FiveSMatch.level(n)` expands a recipe into grid strings (`.` hole, `#` plain, `o` one coat, `O` two
coats, `p` pass, `P` two-layer pass, `h` held), the canonical layout; the cell counts in the table are
its tests.

**Coach lines** (once, over the board, with a ghost hand on the hinted swap; under reduced motion an
arrow): swap "Swap two neighbours to line up three in the same frame. Drag, or tap one then the other." ·
stripe "Line up four for a stripe. It clears its whole row or column." · burst "Make an L or a T for a
burst. It bursts twice." · paint "A match paints the cells under it in your things' colours. Paint
them all." · mark "Line up five for the mark. Swap it with any tile to clear every tile in that frame." ·
pass "These are things you passed. Match beside them to clear them away." · held "Held tiles can't
move. Match through them to free them."

The playtest's bar (a bot playing the hint): each level won in ≥ 60 % of 50 boards for 1–10, ≥ 45 %
for 11–20, ≥ 35 % for 21–30, and 3 stars in 10–25 %.

### Feel
**Words** (5s's voice: plain, short, a full stop). Cascades, shown once per swap for its deepest wave:
wave 2 "Good eye." · 3 "Together." · 4 "In tune." · 5 "Composed." · 6+ "Sublime." Making the mark: "The
mark." Mark + mark: "Clean slate." The finale: "All set." A win: "Level 7 done." Three stars: "Three
stars." Out: "Out of moves." Reshuffle: "Shuffled: always three ways to go." Words pop in Unbounded
(28–36 px, paper with the Ember to Flare gradient underline) over the board.

**Motion** (transform and opacity only):

| Moment | What moves | ms |
| --- | --- | --- |
| press | the tile lifts (scale 1.08) | 80 |
| swap | both tiles slide | 160, out-cubic |
| bounce | there and back with a 4 px overshoot | 160 + 160 |
| clear | scale 1 → 1.15 → 0 and fade; 6–8 particles in the frame colour; the cell's paint floods from the centre | 180 (paint 200) |
| fall | gravity, landing with a small bounce (outBack) | 90 + 45 per cell |
| next wave | after the falls land | +40 |
| special made | pops 1.25 → 1 with a white flash | 220 |
| stripe | a beam along the row or column; tiles clear from the stripe outward | 200, 25 per cell |
| burst | a ring wave over the 3×3; again after the fall | 220 |
| the mark | the logo's ribbon (violet, blue, lilac bands) arcs to each target, which lifts and clears | 30 stagger, ≤ 900 |
| word | 0.6 → 1.05 → 1, hold, fade | 260 + 500 + 200 |
| score | "+120" rises from the group | 500 |
| finale | a stripe made every 80 ms, fired every 120 ms; stars fill one by one | 300 a star |
| win | the tiles lift away and leave the painting (paint levels) | 600 |
| hint | the two tiles nudge 3 px toward each other, twice | 2 × 300 |

**Reduced motion**: nothing slides, falls, pops or flies. Swaps and falls place at once; clears and new
tiles fade (≤ 150 ms); each wave still waits ~150 ms so it can be followed; blasts show their cells
highlighted for 150 ms; words sit in the status line for 1.2 s; the hint is a static dashed Iris
outline; the ghost hand is an arrow. Fully playable.

**Sound** (WebAudio, synthesised, no files). One AudioContext made on the first press or key in the
game (autoplay rules) and suspended when the page is hidden; master gain 0.35 into a compressor; at
most 12 voices (extras dropped). Notes from the C major pentatonic (five notes): C5 D5 E5 G5 A5 C6
D6 E6.

| Event | Voice |
| --- | --- |
| swap | sine glide 600 → 900 Hz, 60 ms, quiet |
| bounce | triangle 300 → 200 Hz, 120 ms |
| match | a pluck (triangle + a sine an octave up, 5 ms attack, 220 ms decay) on pentatonic note min(wave − 1, 7): cascades climb, as in Candy Crush |
| special made | three quick plucks up |
| stripe | band-passed noise swept 400 → 4,000 Hz, 250 ms |
| burst | sine thump 120 → 60 Hz, 200 ms, with a noise burst |
| the mark | a pentatonic glissando up, with two detuned saws through a low-pass |
| paint | low-passed noise (1,200 Hz), 80 ms, at most one every 60 ms |
| win | five notes up, then a bell per star (sine with partials ×2 and ×3), each higher |
| out of moves | a soft falling minor third |

**Sound on/off**: a visible button in the game's top bar (speaker glyph and "Sound", `aria-pressed`),
remembered in `opts.sound`; M toggles it. **Haptics**: `navigator.vibrate` where it exists (swap 6 ms,
bounce 4, match 10, special 18, the mark [12, 40, 12], win [20, 60, 20, 60, 40]); off when sound is off,
so "off" means quiet.

**Performance** (60 fps on a mid phone): tiles are absolutely placed elements moved only by
`translate3d` and opacity, with `will-change` only while moving; one requestAnimationFrame loop drives
every animation and stops when nothing moves; particles, beams and the ribbon on one overlay canvas
(device pixel ratio ≤ 2); images decoded before the level starts (`img.decode()`); no layout reads
inside the loop; paint floods are a scaled layer, never an animated background colour. The smoke test
throttles the CPU 4× (CDP) and requires a p95 frame ≤ 20 ms through a cascade.

### Look and layout (390 px first)
- Top bar (56 px): Back ("Map"), "Level 7", Sound. Status (64 px): **Moves** large (Unbounded), the
  goals with progress in words ("12 of 20", "Paint 31 of 49"), the score with a three-star meter.
- The board: full width less 16 px gutters (9 columns ≈ 40 px cells on a phone; at most 480 px wide),
  on the table (`#1B1726`, both themes) with 12 px padding and the card radius (28 px); cells `#2A2438`
  with 3 px gaps; holes show the table. Under it the legend (one or two rows of chips), then the
  boosters (Pass, Turn, Five more: ≥ 48 px, glyph + word + count; at 0 disabled and "0").
- Unpainted paint cells are hatched (45°, `#77708C`, 2 px every 6 px; ≥ 3.2:1 on cell and table); two-coat
  cells cross-hatched; after one of two coats, the colour at 45 % over a single hatch; painted cells
  solid. Passes: hollow and dashed (`#B9B2CC`). Held: two straps in table ink at 80 %. Stripes: three
  white bands across the tile in their direction plus an arrow glyph; bursts: a second, dashed outer
  ring; the mark: the 5s logo tile (Cobalt to Iris frame, "5s" in the Ember to Flare gradient).
- Text on the table `#EEEBF5` (14.9:1). The level card and level end are sheets in the app's style.
- **The level end**: "Level 7 done." · the stars (glyphs and "2 of 3 stars") · "Score 8,240 · Best 9,100"
  · What you put together (hearts) · the painting, with **Keep this painting** (paint levels; when the
  board already holds 24: "Your board holds 24 paintings. Remove one to keep this.") · any booster
  earned ("You earned a Pass.") · **Next level**, **Play again**, **Your board**.

### Accessibility
- The board is a `role="grid"` labelled "Level 7 board, 8 by 8" with rows of `gridcell`s and a roving
  tabindex. Each cell's label: thread, the thing's short name, special, state, place: "Paper, Bone
  Armchair, stripe: clears its column. Row 3, column 4." / "A pass, 2 layers." / "Held: Orange,
  Untitled." / "Unpainted." Holes are not cells.
- One polite live region, one message per move once it settles: "Matched 3 Paper. Painted 3. Good eye.
  14 moves left." Also selection, hint, reshuffle and the end.
- Every gesture has a tap way and a key way; targets ≥ 24 px (cells ≈ 40 px; buttons ≥ 48 px).
- Never colour alone: suits by shape and legend, specials by pattern and glyph, paint by hatching,
  stars and map states in words.
- No timing: no clock, no countdown; the hint is optional (`opts.hints`, a switch in the level card).
- Focus ring 2 px Iris (`#A78BFF` on the table), 2 px offset; sheets trap focus and Escape closes them;
  the game's Back is always reachable.

### Data (additive state fields; `norm()` fills the defaults)
```jsonc
{
  "assoc": [["i020", "o017", 3, 1, 1761100000]],   // [a, b (a < b), n 1..99 (times put together by your swap), heart 0|1, last unix s]
  "saga": {"stars": [3, 2, 1], "best": [8240, 5120, 4410],   // index n−1, levels won in order (length = levels won)
           "boost": {"pass": 1, "turn": 1, "more": 1},       // held, 0..9 each
           "plays": 14,                                        // level attempts finished (seeds the next board)
           "day": "2026-10-22"},                               // last day Sort's five gave a Pass
  "paintings": [{"at": 1761100000, "n": 7, "cols": 7, "rows": 7, "c": "f28a3c…"}],   // 6 hex per cell row-major, "------" outside the painting
  "opts": {"ring": true, "sound": true, "hints": true}
}
```
Limits: `assoc` ≤ 400 entries: past it, the unhearted entry with the lowest n, then the oldest, goes;
hearted entries never go. `paintings` ≤ 24 (refused past it, never dropped). `saga.stars`/`best` ≤ 999.
About 15 KB at the caps. The running level is not saved. In example mode nothing is written.

### FiveSMatch (`src/match.js`: pure, no DOM, no clock; `window.FiveSMatch` / `module.exports`)
Uses FiveS (`window.FiveS`, or `require('./engine.js')` in Node). Nothing mutates its input; every
random draw comes from the game's own PRNG state, so the same inputs give the same board and steps.
```js
FiveSMatch.version = 1
FiveSMatch.TOKENS     // the six suit tokens: [{name:'flare', hex:'#FF6B4D', shape:'circle', word:'Red'}, …]
FiveSMatch.LEVELS     // the 30 recipes: {n, size:[cols,rows]|mask:'diamond', suits, moves, goals:[…],
                      //   paint:'all'|'centre:5'|null, coats2:'centre:4'|'rows:5-8'|'all'|null,
                      //   passes:[{n, layers, at:'bottom'|'sides'|'scatter'}], held:{n, at:'scatter'|'centre:3'}|null,
                      //   stars:[s1|0, s2, s3], coach:'swap'|'stripe'|'burst'|'paint'|'mark'|'pass'|'held'|null}
FiveSMatch.EPISODES   // [{name:'Sort', line:'Line things up.', from:1, to:5}, …]
FiveSMatch.MASKS      // {diamond:[9 strings], ring, island, halves, house, cross, five}
FiveSMatch.WORDS      // {2:'Good eye.', 3:'Together.', 4:'In tune.', 5:'Composed.', 6:'Sublime.', mark:'The mark.', slate:'Clean slate.', finale:'All set.', shuffle:'Shuffled: always three ways to go.'}
FiveSMatch.prng(seed) -> () => [0,1)            // mulberry32 over the same string hash as FiveS.prng
FiveSMatch.level(n) -> Level   // {n, episode, cols, rows, grid:[strings], suits, moves, goals, stars, coach}; n > 30 generated
FiveSMatch.pieces(state, deck, n) -> {suits:[Suit × n], passed:[id], out:[id]}
   // Suit = {key:'mat:paper'|'hue:orange'|null, label:'Paper', token:'ember', hex, shape, ids:[id], swatches:[[hex,hex,hex]]}
FiveSMatch.newGame(level, pieces, seed) -> Game  // no runs; ≥ 3 counted swaps; a coach level has a swap making its special (≤ 200 tries)
FiveSMatch.canSwap(game, a, b) -> boolean
FiveSMatch.swap(game, a, b) -> {game, valid, steps}   // invalid: valid false, steps [bounce], game unchanged
FiveSMatch.moves(game) -> [[a, b]]                     // every counted swap, a < b
FiveSMatch.hint(game, prefer?) -> [a, b] | null        // prefer: 'stripe'|'burst'|'mark'
FiveSMatch.boost(game, 'pass', cell) | (game, 'turn', [a, b]) | (game, 'more') -> {game, ok, steps}
FiveSMatch.finale(game) -> {game, steps}               // once, when game.state is 'won'; then 'done'
FiveSMatch.result(game) -> Result
FiveSMatch.addAssociations(assoc, ids, nowSec) -> assoc   // every pair of distinct ids: n + 1 (≤ 99), at; then the cap
FiveSMatch.heart(assoc, ids, on) -> assoc                 // every pair among ids: heart 1|0 (a missing pair is added with n 1)
FiveSMatch.recordLevel(saga, result, nowSec) -> {saga, earned:{pass, turn, more}}
FiveSMatch.useBoost(saga, kind) -> saga | null            // null when none is held
FiveSMatch.keepPainting(paintings, result, nowSec) -> paintings | null   // null at 24
FiveSMatch.clusters(state, deck, max = 8) -> {clusters:[{ids, keys, label, times, hearts}], rest:[id]}
```
```jsonc
// Game (plain JSON)
{"v": 1, "n": 7, "cols": 7, "rows": 7, "r": 123456789,          // r: the PRNG state (uint32)
 "suits": [/* Suit, plus "at": the ring's next index */],
 "cells": [{"hole": false, "coats": 1, "first": null, "colour": null, "pass": 0, "pid": null,
            "t": {"k": 41, "s": 2, "o": "o017", "sw": null, "sp": null, "held": false, "armed": false}}],
            // sp: null | "row" | "col" | "burst" | "mark"; s: -1 for the mark; o or sw (swatch index)
 "moves": 12, "score": 4210, "k": 120,                          // k: the next tile id
 "goals": [{"type": "paint", "n": 49, "have": 31}],             // type: score | collect (+ suit | kind) | paint | clear
 "groups": [{"ids": ["i020", "o017", "s004"], "suit": 2}],      // this level's juxtapositions, in order
 "made": {"stripe": 2, "burst": 1, "mark": 0}, "more": false,   // more: Five more used
 "state": "play"}                                               // play | won | out | done
```
```jsonc
// steps: [{e, …}] in order; FiveSPlay animates them
{"e": "swap", "a": 10, "b": 11}     {"e": "bounce", "a": 10, "b": 11}     {"e": "wave", "n": 2}
{"e": "match", "cells": [..], "suit": 2, "ids": [..], "by": "you"|"cascade"}
{"e": "make", "cell": 11, "tile": {..}}   {"e": "fire", "cell": 11, "sp": "col", "cells": [..]}
{"e": "clear", "cell": 3, "k": 41}        {"e": "paint", "cell": 3, "colour": "#c0c2c1", "left": 0}
{"e": "block", "cell": 40, "left": 1, "id": "s011"}   {"e": "free", "cell": 22}
{"e": "fall", "k": 41, "from": 3, "to": 17}          {"e": "drop", "cell": 3, "tile": {..}}
{"e": "word", "text": "Good eye."}        {"e": "score", "add": 120, "total": 4330, "cell": 11}
{"e": "goal", "i": 0, "have": 32}         {"e": "shuffle", "moves": [[41, 17], ..]}
{"e": "boost", "kind": "pass"}            {"e": "end", "state": "won"|"out"}
```
```jsonc
// Result
{"n": 7, "won": true, "stars": 2, "score": 8240, "movesLeft": 0, "used": 19,
 "goals": [{"type": "paint", "n": 49, "have": 49}],
 "groups": [{"ids": [..], "key": "mat:paper", "label": "Paper"}],   // distinct, newest first, ≤ 12
 "painting": {"cols": 7, "rows": 7, "c": "…"} | null, "made": {"stripe": 3, "burst": 1, "mark": 1}}
```

### FiveSPlay (`src/play.js`: the game in an element; `window.FiveSPlay`)
```js
FiveSPlay.mountMap(el, {saga, onLevel(n), onBack()}) -> {update({saga}), destroy()}
FiveSPlay.mount(el, {
  n, pieces, seed,                         // pieces = FiveSMatch.pieces(state, deck, FiveSMatch.level(n).suits)
  boost: {pass, turn, more},               // held
  thumb(id) -> {src, cols, index} | {src} | {colours},   // atlas cell, one image, or a Colour card's bands
  name(id) -> string,                      // a short name for the level end ("Bone Armchair")
  opts: {sound, hints, reduce},            // reduce: prefers-reduced-motion (it also listens for changes)
  onAssociate({ids, key, label}),          // each juxtaposition, as it happens: the app calls addAssociations and saves
  onHeart({ids, on}),                      // a heart at the level end: the app calls heart
  onBoost(kind),                           // a booster spent: the app calls useBoost
  onEnd(result),                           // every end: won (after the finale), out of moves, or left unfinished (won false): recordLevel
  onKeepPainting(painting) -> boolean,     // the app calls keepPainting; false: the board is full
  onOpts(opts),                            // Sound or Hints changed
  onNext(n), onMap(), onBoard()            // leaving
}) -> {destroy(), pause(), resume()}       // pause on page hide: the loop and audio stop
```
It draws the level card, the level, the out-of-moves sheet and the level end; owns its sound,
haptics, motion and hint timer; injects its CSS once (`<style data-fives="play">`, the app's tokens
with fallbacks); and never writes state itself: the callbacks do.

### FiveSBoard (`src/board.js`: the mood board in an element; `window.FiveSBoard`)
```js
FiveSBoard.mount(el, {
  state, deck,                       // the app's state (assoc and paintings may be absent) and deck
  image(card) -> url | null,         // the tile's picture (deck img or a brought thing's image); null: draw bands or the first colour
  name(card) -> string,              // the app's name line, for labels
  onOpen(id, tileEl),                // a thing pressed: the app opens the detail sheet
  onPainting(index, tileEl),         // a painting pressed
}) -> {update({state, deck}), destroy()}
```
Sections from `FiveSMatch.clusters`, masonry as above, its CSS injected once (`data-fives="board"`).
The view's heading, sentence and the Play / See it as a room buttons stay the app's.

### Files and tests
`src/match.js`, `src/play.js`, `src/board.js`; `test/match.test.cjs` (node --test: determinism; no
starting runs and ≥ 3 swaps; bounce changes nothing; 4 → the right stripe; L and T → burst at the
crossing; 5 → the mark; every combo; gravity and sources around holes, passes and held tiles; the
reshuffle; coats and the middle colour; goals, finale, stars; pieces on the example taste and on
nothing kept; addAssociations' cap and hearts; clusters' cap and the by-kind start; all 30 levels
expand to the table's cell counts); `test/game.html` (a harness loading engine.js, match.js,
play.js and board.js with the fixture deck); `test/play.smoke.cjs` and `test/board.smoke.cjs`
(Playwright at 390 × 844: drag, tap-tap and keyboard swaps, a bounce, a cascade, reduced motion, the
mute button, the level end, the frame-time budget; the masonry's columns and proportions). The
integration team adds the three scripts to `build_page.py`'s list and `src/index.html` (after
engine.js, before app.js) and wires Set.

### Decisions, obstacles and their resolutions
- *Pictures cannot be candy colours.* Each suit is a frame colour and a shape around the thing's own
  picture, plus a legend in words.
- *A newcomer has little or nothing kept.* Threads fall back to hue families, then to swatches of the
  person's own colours, then to the frame colours; level 1 plays with nothing kept.
- *Candy colours on light paper fall under 3:1* (Ember 2.0:1). The board sits on a dark table in both
  themes (every frame ≥ 6.2:1).
- *A broad thread swallows the rest* (Neutral contains most things, so a containment test dropped
  Paper). Redundancy is Jaccard ≥ 0.6 between threads, with at most two threads a group on the first
  pass; on the example taste this gives five distinct threads.
- *Paint levels are slow with 5 suits* (8×8 paint-all: 32 moves at the median, 46 at the 80th). Paint
  everything with 4 suits; with 5, paint a centre square. Moves set from the simulation.
- *Candy Crush's diagonal refill around blockers is fiddly to get deterministic.* Straight gravity only,
  with a source under every hole, pass and held tile.
- *The finale's stripes would repaint the picture.* A painted cell keeps its first finished colour.
- *Saving a level mid-way.* Not saved: with no lives and no cost, leaving is free; the app keeps it in
  memory while the page is open.
- *Cascades are luck, not taste.* Only the swap's own wave records a juxtaposition.
- *Another workflow adds Architectural Authority buildings (a `source` field).* Nothing here assumes a
  card is from Artsy: pictures and names come from the app's callbacks, and a tile opens the detail
  sheet, which says where the thing lives.

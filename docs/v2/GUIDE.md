# The city guide

The artist, 7 Oct 2026, with a screenshot of the Artsy app's home — a "London City Guide" pill at the top,
beside "Discover Daily" and "Auctions": "Artsy is starting to do this thing where at the top it shows a
suggested guide for a city. Explore that function on artsy and implement a version of that. It's more like
what I had in mind with the explore function." (The site's "+" explore dock, `explorations.js`, was hidden at
his request that week, "keep the function in mind going forward". The city guide is what he meant by explore.)

Files: `guide.js`, `guide.css`, `guides.json` (the index), `guides/<city key>.json` (one a city);
`scripts/fetch_city_guides.py` writes them.

## What Artsy's guide is

Artsy's City Guide (the app's, for London, New York, Paris, Los Angeles, Berlin, Hong Kong and more) is a
city's art week on one screen: a map of the city with a pin for every show on, and lists over it —

| Artsy's guide | Does the public v1 API give it? |
| --- | --- |
| a map, a pin a show | yes: every show has `coordinates` (and its `location`: address, postcode, time zone) |
| **Saved** shows (the viewer's bookmarks) | no: that is the viewer's account; never read (the site has the artist's *saved artists* instead) |
| **Opening this week** / soon | yes: `status=upcoming`, and `start_at` |
| **Closing this week** / soon | yes: `status=closing_soon` exists; the guide works it out from `end_at` |
| **Featured** / best shows | partly: a `featured` flag on a show, Artsy's editorial choice; not used (the site's own ranking is the saved artists) |
| **Galleries**, **Museums & institutions** | yes: `partner_type` (Gallery, Institution, Institutional Seller) and `partner.partner_categories` |
| **Fairs** | yes: `fairs?near=…&status=running|upcoming` (`fair/<id>` for its place and counts), and each stand is a show with `fair` set |
| **Events**, opening receptions with times | yes: a show's `events` (`event_type` "Opening Reception", "Artist Talk"…, `start_at`/`end_at`, `time_zone`) and `opening_reception_text` — few galleries fill them (7 of 104 in London) |
| filters by kind | yes, by the fields above |
| a show's partner, dates, address, hours | yes: `partner.name`, `start_at`/`end_at`, `location.address`, `location.day_schedules` (per weekday, seconds from midnight) or `day_schedule_text` |
| a show's artists, its works, its cover | yes: `artists` (names, slugs), `partner/<p>/show/<s>/artworks`, `image_url` on Artsy's CDN |
| the "suggested" city at the top of the home | no: that is the app's choice for the viewer (by location or follows); the site suggests the city nearest the middle of the globe |
| BMW Art Guide's pick, Artsy editorial, ticketing | no |

What was read: `GET https://api.artsy.net/api/v1/shows?near=<lat>,<lon>&max_distance=<km>&status=running|upcoming&size=100&page=n`
(the session's proxy supplies the key; `near` sorts by end date; `max_distance` in km; pages of 100), `fairs?near=…`,
`fair/<id>`, `partner/<p>/show/<s>/artworks`. Artsy's GraphQL (metaphysics), which the app itself uses for the
guide, is blocked from the session. `status=running_and_upcoming`, `closing_soon` and `current` all answer;
`partner_type=` as a query does not filter.

## What the site makes of it

Not a copy of Artsy's. What the site has that Artsy's guide cannot: the artist's saved artists and saved works,
the lives, the museums he saved from. So the guide leads with **Your artists**.

- **The way in**, as Artsy's pill: in a city of the Museums layer, a quiet pill at the head of the column, under the
  categories' header — "▢ London Guide · 59 shows on · 19 soon". On the world, a pill beside Search names the
  guided city nearest the middle of the globe ("Guide · London"); pressing it flies there and opens the guide.
  A city with nothing listed has no pill. A guide read more than 21 days ago says so on its pill ("read 3 weeks ago").
- **The guide** replaces the city's directory while open (the categories' header stays: the spectrum is always
  navigable), "‹ London" back, Escape out a level. Its head: "London Guide", "What's on · read today". Then
  **Walk the guide**, and the sections: **Your artists** (shows with a saved artist, named in lilac), **Closing
  soon** (≤ 7 days), **Opening soon** (within 30 days; the reception's time in the show's own time zone when
  given), **Museums**, **Galleries**, **Fairs** (each fair, its dates and place, its stands under it). Six rows a
  section, then "All N". A row: the cover square, the title in the serif, partner · dates in mono, the saved
  artists in lilac. Shows already closed by the visitor's own date are dropped in the browser.
- **A show** opens in place: the cover large, "▢ Gallery · Soho Revue", the dates, today's hours (in the show's
  time zone), the address, its events, "Into <museum> ›" when the partner is one of the site's museums, its
  artists (a saved artist's life is a door, `Lives.open`), the saved works in the show (each a door to its
  history). The city eases to the venue (`Land.look`) and it is ringed in pixel light (three φ echoes, held frames).
- **On the city**, while the guide is open and only then (at rest only a layer's own marks): every show a faint
  sea-green tile at its point, a saved artist's lilac, the one pointed at in the list lit.
- **Walk the guide** — the explore function: up to 12 shows on now (the saved artists' first, then the museums,
  then what closes soon, then by closing), ordered as a walk, nearest next, from the show open (else the city's
  middle). Played through the dial (`Dial.path`, kind `guide`): each stop eased to and opened in the column, said
  in the dial's readout on the reading's slow clock — title at 4 s, partner and dates at 11 s, its artists at
  20 s — 17 s × φ a stop, the clock moving only while the pointer is still. The face pauses and plays, the ring
  scrubs, × ends; under reduced motion nothing moves by itself and a tap on the face is the next show. At the end:
  "walked, 12 shows" and **Again**.

Category: a show is **Galleries & shows ▢** (KINDS.md), the guide's row in "The three from each" is
`guide | gallery | shows | artists | places`. On the dial: DIAL.md, "guide". No VOICE.md row: the guide is read
in a city's view, which has no lens.

## The data

`scripts/fetch_city_guides.py` reads every city of `cities.json` with a museum (59, leaving out the 17 towns that
are only their museum, which open straight into it) and each town within 30 km of a collage (Sydney), 25 km
round its point; a show within reach of two is the nearer one's. It keeps only a show's
public listing facts — id, title, partner and kind (`g` gallery, `m` museum or institution, `f` fair stand),
start and end, address, point, hours (`h`: [weekday from Monday 0, open s, close s]; else `ht`, the gallery's
text), time zone, the cover's key on Artsy's CDN (`i`: shown live, never copied), events (type, start, end, UTC),
the reception's text, artists (`ar`: [name] or [name, life id or 0, 1 if saved]) — and the joins: `m` a site
museum (museums.json), `w` the saved works in it (read from the show's artworks only where a saved artist
shows). Never a price, never the artist's account. Raw answers are cached in `data/guides/<date>/` (gitignored):
`--build` rebuilds from the newest cache with no network, the same bytes every time.

7 Oct 2026: 60 cities, 978 shows (New York 218, Seoul 94, Paris 88, London 78, Los Angeles 66, Berlin 38);
111 with a saved artist; 11 with a saved work in them; 3 at a site museum; 2 fairs (Frieze London, Minor
Attractions); 15 cities with nothing listed (no pill). 560 KB in all.

## Fresh

A guide is a reading of a week; it goes stale in days. It needs a session to run
`python3 scripts/fetch_city_guides.py` and commit `docs/v2/guides*` — best as a step of the daily buildings
routine (09:00 UTC, REFINE.md), about 10 minutes. The page drops closed shows by itself and says the read date.

## Weak

- Artsy's coverage, not the city's: Washington has 9 shows on, Linz none; museums list few of their exhibitions on
  Artsy (London's one museum show is the Ben Uri's) — the guide is the galleries' city far more than the museums'.
- No "featured": Artsy's editorial pick is not read; the site's order is the saved artists, then closing.
- Receptions are rare in the data (7 of 104 London shows had an event).
- The world pill is the guided city nearest the middle of the screen (a busier city from a little farther off), not the viewer's own city (no location is asked).
- The dial has no days: a guide's openings and closings fall within one year, so its stops are in order, not at dates.
- A one-museum town (Otterlo, Williamstown …) goes straight into its museum, where the pill is not shown.
- Show tiles on the city cannot be pressed yet; the list is the way in.

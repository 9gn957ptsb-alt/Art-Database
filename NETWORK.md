# Network access — the hosts that would make the globe truer

The artist, 10 Oct 2026: "I want you to continuously do research on finding domains to add to the
environment network access that would help you develop a better image of the globe and all of its
contents. Focusing specifically on how things look, I want to make sure that we are accurate in our
depiction of the globe and it's content."

This is the ledger of that research: open sources of how things on the Earth really look — the ground
from orbit, a city's roofs and walls, a museum's rooms and the works on them, a plant or an animal in
the field, a street a century ago — each with the hosts it needs, whether this environment can reach
them, and what it would make truer on the [Artist Website](https://9gn957ptsb-alt.github.io/Art-Database/v2/).
`scripts/sources.json` holds the rows; `scripts/probe_sources.py` asks every host from the session and
rewrites the parts of this file between the markers. Anything else here is written by hand.

## To ask for

Probed <!-- probed -->2026-10-10 22:07 UTC<!-- /probed -->. The domains the network policy refuses, of the sources worth
having (priority 1 and 2), most needed first — the block to copy:

<!-- ask:begin -->
```
api.openverse.org
live.staticflickr.com
www.flickr.com
images.metmuseum.org
api.wikimedia.org
```
<!-- ask:end -->

Where they go: the cloud environment's menu in the session's title bar → **Edit** → **Network access**
→ **Allowed domains** (the Limited level; keep "Allow package managers" ticked). A session started
after the change reaches them; one already running may need to be started again.

## How a source is judged

- **How things look, first.** A source counts for what it shows of the real appearance of something
  the site draws: the colour of the ground and the sea, a roof, a façade, a gallery's walls, a work's
  surface, a plant, an animal, a street as it was. Data that only places things is the other passes'.
- **Free, open, never billed** (the artist, 24 Sep 2026: nothing that can ever be billed). A key only
  where it is free and can be kept as one of the environment's secrets; a row says so (`key`).
- **The licence on every row.** Terms that forbid redistribution or derived works drop a source, with
  the reason (as Maricopa and the City of Austin were). Photographs and plans are reference only and
  never enter the repository (CLAUDE.md); what is read off them — a colour, a height, a year, a
  material — may, with its credit.
- **Robots and owners' wishes are kept.** A host whose robots.txt refuses robots is not read;
  Bloomberg Connects' own sites never are.
- **Runtime hosts are a different question.** What the visitor's browser reads (NASA's images,
  Artsy's CDN, the museums' open APIs) needs no allowing here; it is tested with `page.route`
  stand-ins. This ledger is for what a session must read to build the site.
- **A host that lets the tunnel through and then says nothing** ("stalls": Overpass, Geofabrik) is
  read on GitHub's runners instead (`.github/workflows/`), as OpenStreetMap's dates and Italy's census
  blocks are.

## The daily pass

A routine keeps this true: "Artist Website — network research (daily)", at 13:41 UTC in its own session
("Artist Website — network research", the repository attached, as the buildings' and cities' passes are:
a routine that starts a fresh session each time starts it with no repository, and could never push).

1. Merge the site branch; `python3 scripts/probe_sources.py`. A host newly **open** is one the artist
   has added: fetch a sample from it, write in its row's `plan` how it would be used, and use it where
   a pass already reads that kind of thing (a new source of photographs for
   `scripts/fetch_interior_photos.py` or `scripts/fetch_reference_photos.py`, of building years for
   `scripts/build_built_years.py`, of imagery for the globe's colours). Anything larger is proposed in
   the report, not built.
2. Research one facet, in turn by the day: the Earth from above; cities and buildings; museums and
   works; plants and animals; places as they were. Search for open sources of how they look; read each
   one's licence and terms; add rows to `sources.json` (name, what, what it would make truer, hosts and
   a probe address for each, licence, key, format, priority 1–3, notes); drop with the reason any whose
   terms forbid the site's use.
3. `python3 scripts/probe_sources.py` again, which rewrites the block above and the table below.
4. Commit `scripts/sources.json` and `NETWORK.md` and push.
5. Report in a few lines: what was found and what it would make truer, any host newly open and what
   was done with it, and — only when the block changed — the block to copy, whole.

## Every source

<!-- table:begin -->
### Museums and works

| Source | Hosts | Would make truer | Licence | State |
| --- | --- | --- | --- | --- |
| **Openverse** (P1) WordPress's search over 800 million openly licensed images (Flickr, Wikimedia, museums), with each image's licence and author. | `api.openverse.org` to ask | Photographs of gallery rooms, buildings, plants and animals where Commons has none: more museums' walls read for their real paint, more buildings modelled from photographs. | Each image's own CC licence or public domain; the API's data CC0. | candidate |
| **Wikimedia Commons files** (P1) upload.wikimedia.org: Commons' files and their thumbnails. | `upload.wikimedia.org` open (429) | Reading a photograph's pixels directly (a gallery's paint measured in Lab, a building's materials) instead of through a vision model. | Each file's own licence. | allowed |
| **Flickr (openly licensed photographs)** (P2) Photographs and their licences; the image files themselves on Flickr's CDN. | `live.staticflickr.com` to ask, `www.flickr.com` to ask | The pictures Openverse and Commons point to: reading a gallery's or a building's colours off the photograph itself. | Each photograph's own licence; only CC and public-domain ones used. | candidate |
| **The Met's open-access images** (P2) The Metropolitan Museum's image server: every public-domain work's photograph, full size. | `images.metmuseum.org` to ask | The colours measured off a Met work's own photograph, and the works hung in the Met's walk drawn from the museum's own picture. | CC0 for open-access works. | candidate |
| **Wikimedia API gateway** (P2) api.wikimedia.org: Commons' and the wikis' REST endpoints, rate-limited per address. | `api.wikimedia.org` to ask | Commons' files' metadata and thumbnails without the action API's 429s from the session's shared address. | Each file's own licence. | candidate |
<!-- table:end -->

## History

- **10 Oct 2026** — the first sweep: four researchers, one each for the Earth from above, cities and
  buildings, museums and works, and plants, animals and places as they were.

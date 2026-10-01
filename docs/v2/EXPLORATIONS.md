# The explorations — how they are made, shared and published

The artist, 1 Oct 2026, on "the catalogue writers are their own kind of
explorer. Wildenstein spent decades finding every Monet. Following him is
following the hunt itself, a map of where Monets were found": "Implement your
idea, that is a great example of a pre-established exploration adventure for
viewers to take. Branching off of that idea, there should be a way for a
viewer to create their own explorations and save them and share them with
others." And on the relay: "that's great to connect one exploration with
another, building a relay system as one ends and another begins relative to a
time, place, artwork, character, etc…"

The page is `explorations.js` (and `explorations.css`); the data is
`explorations.json`, written by `scripts/build_explorations.py` (public files
only, the same bytes every run, under a second).

## Kinds

| kind | where it comes from | where it is kept |
| --- | --- | --- |
| **hunt** | a cataloguer among the voices (below) | `explorations.json` → `hunts` |
| **walk** | an animal's route (`build_walks.py`) or a following kept | `characters/walks.json`; kept walks in the viewer's browser |
| **a voice's route** | a followable voice's places, in time | `voices/<id>.json` (`places`) |
| **made** | a viewer, with "+" | the viewer's browser (`explorations.kept`, `explorations.draft`) |
| **sent** | a viewer's code the artist chose to publish | `scripts/explorations_sent.json` → `explorations.json` → `made` |
| **relay** | a chain of any of these, joined by handoffs | the viewer's browser; or sent, like any made one |

## The hunts

A cataloguer is a voice (`voices.json`) who wrote on 8 works or more, three
quarters of them by one artist, at least half of them in a catalogue (its title
says catalogue, raisonné, Werkverzeichnis, œuvre, complete, graphic work …, or
it is cited by a number: "Bloch 145", "no. 223"). Two cataloguers whose works
are nearly the same (Jaccard ≥ 0.8) made one catalogue and are one hunt under
the one with most works ("by John Rewald with Walter Feilchenfeldt, David Nash
and Jayne Warman"). A hunt needs five stops. Collection catalogues (John Walker's
*National Gallery of Art*, Diane Kelder, John Oliver Hand) fail the one-artist
rule and are not hunts.

Each stop is one of the artist's works among theirs, in catalogue-number order
when three fifths have numbers (else by date), at the city where the work was
when the catalogue was made: the last owner or holder its history names at or
before the catalogue's year, else a show within three years of it. When that is
not recorded the line says so ("Where it was in 1968 is not recorded") and the
stop is where the work is now. Lines are built only from the record's own words
(who, where, the catalogue's title, its number, the years):

    No. 223 · Claude Monet: biographie et catalogue raisonné, 1974
    In 1974 Wildenstein found it with National Gallery of Art, Washington · there since 1970
    It is there still

## Codes

`ex·` and Crockford base 32 in fours. Bits: version (2), check (5), titled (1;
then length 5 and each letter 5, in ` abcdefghijklmnopqrstuvwxyz'-.&·`), the
number of stops (6), each stop a kind (3: w work, t town, m museum, v voice,
h thread, a animal, r a published exploration, | a handoff) and its index
into the public list (finding.json's works 13 bits, cities.json's towns 10,
museums 7, voices 11, finding.json's threads 12, the cast 3, the relay's rows
9); a published exploration also the stop it was joined at (6). Untitled:

| stops | example | characters |
| --- | --- | --- |
| 3 works | `ex·…` | 13 (+3 for `ex·`, +3 dashes) |
| 6 works | | 22 |
| 12 works | | 42 |
| a relay of a made exploration and a hunt | | 4 + 18 bits a published leg |

A written title costs one character a letter. `scripts/explorations_code.py`
reads codes as the page does (keep the two in step). Walk codes (`fox·…`) are
unchanged and still read by `walks.js`.

## The relay: matching

When an exploration ends (done, or ended by the viewer), the page reads where it
ended — the last stop reached: its work, its city (a museum's city), its year
(a hunt's catalogue year, a work's date, a voice's year there, a thread's
year), its artist, its animal, its voice — and scores every published
exploration (`explorations.json` → `relay`) and every one the viewer kept:

| match | score |
| --- | --- |
| the same work | 100 |
| the same city (a museum counts as its city) | 60, +10 if within 5 years |
| the same time, at its start (within 5 years) | 30 |
| joining mid-way (any of these at a later stop, not the last) | × 0.6 |
| the same animal | 28 |
| the same artist | 25 |
| the same voice | 22 |

A hunt +5, a walk +4, a kept or sent one +3 break ties toward the stronger
kinds; then the shorter. Two or three are offered, at most two of a kind and
one voice's route; each with its reason in one line, then the door:

    Paris, 1974 → Mourlot’s hunt · 9 Picassos begins here
    Washington → joins Rewald’s hunt at stop 12 of 37
    The fox’s artist → Twombly by fox

Nothing is chained silently: taken, the chain is the exploration so far, a
handoff (`|`), and the new leg (a published one by reference and the stop it
was joined at; a viewer's own inline). Its sentence is the legs' sentences, a
stanza each; it can be kept, shared as one code, and is drawn on the globe in
pixel light, each leg in its tone (lilac, cream, sea-green, amber, rose).

The `relay` rows: `[kind (h hunt, w walk, v a voice's route, x sent), id,
title, artist, animal, voice, number of stops, [[city, year or 0, work index
into finding.json or -1]]]`; a voice's route by its first and last stops only.

## Publishing a visitor's exploration

There is no server: a viewer who wants their exploration on the Artist Website
for everyone sends the artist its code (any way they like). When the artist
gives a session a code to publish:

1. `python3 scripts/explorations_code.py "ex·…"` — read it. If it says *stale*,
   it was made against an earlier map (the lists moved since); ask the artist
   for the stops in words, or rebuild it by hand from them.
2. `python3 scripts/build_explorations.py --add "ex·…" --title "…" --by "…"` —
   with the title the visitor gave (or the code's own) and the credit: a name
   only if the visitor gave one to be credited, else "a visitor". It is decoded
   into `scripts/explorations_sent.json` as ids and keys (so later rebuilds of
   the lists cannot move it), and published in `explorations.json` → `made`.
3. Check it in the page: Find "explorations" lists it ("Exploration: … · by a
   visitor"); it plays; it joins the relay's index, so it is offered when
   another ends where it begins.
4. Commit `scripts/explorations_sent.json` and `docs/v2/explorations.json`.

To take one down, delete its entry from `explorations_sent.json` and rebuild.

## Rebuilding

`python3 scripts/build_explorations.py` after `build_voices.py`,
`build_walks.py` or a full `build_artwork_histories.py` (hunts and the relay
index read their outputs). Codes index the public lists, so a rebuild that
moves a list makes older codes stale; the check catches it and Find says so.

# The categories — what each thing is, and the three ways on from it

The artist, 2 Oct 2026: "We need to still understand the interrelations between all of the different
paths of exploration we are making. Right now all the information is somewhere, but it just starts
going and understanding what is what is hard because it lacks explicit categorizations that make the
interrelationships. For instance, the museums have to do with the historical aspect of art, whereas the
contemporary galleries in cities have to do with contemporary art. Writings on art [fill] the spectrum
from the museums of art history to the contemporary galleries of what is going on artistically in cities
and around the globe … They all can be sub categories of one another, depending upon your position
relative to your path of travel. I may start by finding something through an artist, which I want to
then instead of diving right into all the information on the Artist be given a subheading titles for
different objects of the artist that I can search for … so I really want you to categorize each type of
path of exploration … and for each category made the spectrum that connects all of them has to be
navigable at all times … if I click on Artist, I should also be able to … click somewhere on museum and
when I click on museum, I am able to click on art show. The distinguishment being when I initially
clicked on Artist, art show was not showing up until I clicked on museum. So use three sub categories
for now that are available when you are in any category."

**This file is read by the page.** `kinds.js` fetches it and reads the four tables below. A new kind of
thing, or a new path, declares its category here (a row in **The categories**), and the three
subcategories offered from it (a row in **The three from each**); nothing else in the page names a
category or a tab. A new list a tab can show is a row in **The subcategories** and a function of that
name in `kinds.js`'s `LISTS`.

## The header

Every view — a work's history, a life (an artist), a museum, a city, a movement, a thread (a show, a
sale, a writing, an owner), a building — and every thing opened in place (a gallery, a show, a writer,
an animal) has, at the head of its column, four quiet lines:

1. **The way you came** — the path taken as a breadcrumb (*Picasso › Musée Picasso › Shows*), each step a
   way back to it; the last five.
2. **What this is** — the category's glyph and name in its tone, then the thing's name.
3. **The spectrum** — a hairline from *history* (the museums) to *now* (the galleries), *writing* marked at
   its middle, and this thing on it: a dot at its year, or a span over its years (below).
4. **Three subcategories** — one line of three tabs, each a different category chosen from here. A tab
   opens, in place, a list with a search field at its head (instant, over what is already loaded); each
   row is a door into that thing, which opens with its own header and its own three. So Shows is not
   offered from an Artist (Showing is: where the artist is shown), but is from a Museum.

An artist's life is folded under its three ("Read the life ›"), so finding an artist is first a choice of
what to look for, not all of the life at once. A thing that has no view of its own (a gallery, a show not
shared by two saved works, a writer, an animal) is opened in place: the header alone, its first tab open,
the column under it set aside until you go back.

## The spectrum

The backbone that orders the categories: **Museums** (art history: holdings, collections, the shows of
the past) at one end, **Galleries & shows** (the contemporary: galleries, fairs, sale rooms, exhibitions
now) at the other, **Writings** across the middle, since writing runs the whole way between them.
Everything else sits on it by its dates: time is laid out so the last decades are given as much room as
the centuries before them (a log of the years before now: 2026 is the right end, about 1950 a third of the
way, 1500 the left end). A thing's mark: a work at its date; an artist over their working years (or born
to now when living); a movement over its years; a show at its date; a museum, gallery or writer over the
years of what the record has of them; a city over the years its works were there. Where a thing has no
dates, its category's own place (`spectrum` below) is marked, hollow.

## The categories

`spectrum` is where the category stands on the backbone when a thing of it has no dates (0 history, 1
now). `glyph` and `tone` are used wherever the category is named: the header, Find's groups, the rows of
every list.

| kind | name | glyph | tone | spectrum | holds |
|---|---|---|---|---|---|
| museum | Museums | ◆ | #d6b05c | 0.08 | art history: museums, their holdings, their collections and past exhibitions; collections and owners |
| movement | Movements | ◇ | #d9a55b | 0.25 | periods and circles in time: the movements found where lives overlap, and Wikidata's named movements |
| work | Works | ■ | #eadfcd | 0.45 | an artwork: its history, where it was painted, where it hangs |
| artist | Artists | ○ | #c98fb5 | 0.55 | an artist: a life, studios, a birthplace, an animal |
| writing | Writings | ¶ | #9d95e6 | 0.5 | writers, critics, curators, and the writings themselves: the spectrum that runs from museums to galleries |
| place | Places | ◎ | #8fa7c7 | 0.6 | cities, and the sites on the globe: painted here, studios as places, a place in a life (the town or studio a period of a life is entered at, as it stood then) |
| building | Architecture | △ | #b8a48a | 0.65 | buildings, and the buildings that house art |
| gallery | Galleries & shows | ▢ | #8fc7bd | 0.92 | the contemporary: galleries, fairs, sale rooms, exhibitions now and recent |
| animal | Animals | ∴ | #a3b87a | 0.7 | the companions that carry paths, and the chimera |
| path | Paths | → | #a8927a | 0.5 | explorations — hunts, walks, relays, corpses, a life played: paths *through* the categories, not one of them |

## The three from each

`from` is what is open (a category, or a kind of thing within one: a show and a sale are both Galleries &
shows, a collection is Museums, a publication is Writings). `why` says how the three were chosen.

| from | kind | first | second | third | why |
|---|---|---|---|---|---|
| artist | artist | works | showing | movements | the pieces to search; where the artist is shown, newest first, by city; the movements (or, for a living artist with none, the circle shown beside them) |
| work | work | artist | where | writings | who made it; where it is and has been (the museum or gallery holding it, its shows and sales); what has been written on it |
| museum | museum | held | shows | artists | the saved works it holds; the shows there, past and present; the artists in it |
| collection | museum | held | artists | places | an owner or a collection: what it held, by whom, and where |
| gallery | gallery | shows | artists | works | a gallery, fair or sale room: its shows and listings, the artists shown, the works |
| show | gallery | artists | works | writings | an exhibition: the artists shown, the works, the curators and the writing on its works |
| sale | gallery | artists | works | places | a sale: the artists offered, the lots, where the works came from and went |
| writer | writing | works | artists | curated | a writer, critic or curator: the works they wrote on, the artists, the shows they curated |
| publication | writing | works | artists | places | a writing (a book, a catalogue): the works it names, their artists, where they are |
| movement | movement | artists | works | places | who was there; their works of those years; the city and where its artists came from |
| place | place | museums | galleries | artists | a city: its museums (history), its galleries, fairs and sale rooms (now), the artists born, working and shown there |
| lifeplace | place | made | herethen | nowat | a place in a life, entered from it ("The place, then"): the works made there in those years; who else was there then; where those works are now |
| building | building | places | museums | buildings | a building: its town, the museums near it, the other buildings near it |
| animal | animal | artist | walks | places | an animal: the artist it is drawn after, its walks, the cities on its artist's map |

## The subcategories

Each tab: its label, the category its rows are, and what it lists. The label is said with the count.

| tab | label | kind | lists |
|---|---|---|---|
| works | Works | work | the artist's (or the writer's, the movement's, the show's) saved works; search by title or year |
| showing | Showing | gallery | where the artist's works are shown, listed and offered: exhibitions, fairs, galleries, museums, sales, newest first (open now marked); search by city, venue or title |
| movements | Movements | movement | the movements found where the artist's life overlapped others', and Wikidata's movements (P135) with their years; for a living artist with none, "Circle": the artists shown beside them in the same shows since 2016 |
| artist | Artist | artist | the work's artist (each of a co-credit), and their other saved works |
| where | Where it is | museum | the museum holding it, then every show, listing and sale its record names, newest first; each venue a door |
| writings | Writings | writing | the writers, critics and curators on it (voices), then the writings its record cites |
| held | Works held | work | the saved works it holds (or held); search by title, artist or year |
| shows | Shows | gallery | the exhibitions (and listings and sales) there, newest first; search |
| artists | Artists | artist | the artists in its holdings, shows or rows, most works first; search |
| curated | Curated | gallery | the shows the voice curated, as the record credits them |
| places | Places | place | the cities: a movement's city and its artists' birthplaces; an animal's artist's map; a sale's or a collection's works' cities |
| museums | Museums | museum | the museums in the city (or near the building) |
| galleries | Galleries & shows | gallery | the galleries, fairs and sale rooms in the city, and the shows there, newest first |
| buildings | Architecture | building | the other buildings, nearest first |
| walks | Walks | path | the animal's published walks |
| made | Made here | work | a place in a life: the saved works its period places there — made, printed, painted at a documented site — each with how it is known |
| herethen | Here then | artist | a place in a life: the other saved artists placed there in the same years (lives that cross, the movements' presences), each with the evidence |
| nowat | Where they are now | museum | a place in a life: the museums holding the works made there then, most first; the rest said |

## Find

Find's groups are named by category, with the glyph, in the spectrum's order. `head` is the start of a
group's own heading (as land.js and the modules write it); the group goes under its category.

| head | kind |
|---|---|
| Museums | museum |
| Owners and museums | museum |
| Movements | movement |
| Works | work |
| Dealt from the longest journeys | work |
| Artists | artist |
| A life | artist |
| Studios | place |
| Voices | writing |
| Writings | writing |
| Cities | place |
| Painted here | place |
| Shows and sales | gallery |
| Walks | path |
| Hunts | path |
| Explorations | path |
| Exploration | path |
| Walk | path |
| The exquisite corpse | path |

## What is weak

- **"Now" is thin.** The histories are as of their last read (1 Oct 2026); 31 shows were open on that day.
  Most of what "Showing" can say is recent rather than current: Artsy's listings by galleries (2,078, most
  2021–2026), fair stands (814) and exhibitions, newest first. Nothing reads a gallery's programme ahead.
- **Venue types are read from names.** A venue is a museum when it is a site museum or its name says so,
  a sale room by the auction houses' names, a fair stand by the show's title; the rest are galleries.
  Some institutions that are not museums (a Kunsthalle, a foundation) sit with the galleries.
- **Movements** are Wikidata's P135 for 400 of the 1,237 artists, and the found movements (41, in four
  cities); living artists rarely have either, so they get their circle (who was shown beside them).
- **Places from a building** are only its town and the museums near it: no source joins a building to the
  artists or works it has housed, except the museums' own.

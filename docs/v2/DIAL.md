# The dial as the hub

The artist, 2 Oct 2026: "Maximizing the utility of the dial is pertinent to enabling the inherent
complexity of modalities of connecting information to be accessible and easily utilized by viewers.
So when we find new ways of defining explorations I want you to really develop an efficient and
dynamic way it can be incorporated into the functionality of the dial."

The dial is time. Every way of exploring has years, so every way of exploring has a place on it.
The rule for a new kind: say what its years are, what its mark is, what turning does to it, and
what pressing it starts. `dialhub.js` holds the kinds; `land.js` ("the dial") only draws the ring
and asks the hub for its layer.

## The rings, outside in

| Radius | What | Drawn |
| --- | --- | --- |
| outside the ring | the chronograph's 120 marks | still, always |
| the ring | the view's span; the way come, its comet's tail; the handle | always |
| just inside | the view's own events (a work's stops, a city's venues' first years, a life's places) | always |
| **the band** | the mode's marks: arcs for what lasts (a movement, an artist's years here, a life's periods), glyphs for what begins (a hand-off) | by mode |
| the face | the year, the span, and over the year **the mode's word** | always |

The two geared rings rest when the band is in use: it takes their place, so the dial never gains
a ring. While it is in use the face's carrying circle (drag the year to move the dial) shrinks
from 30 % of the dial to 22 %, so the band's two lanes can be pressed.

## The face is the selector

A small word over the year names what the dial is about: **Place · Work · Life · Movement** (the
view's own, as before) and then **Movements**, **Artists** (in a city: whose years were here; in a
work: its artist's places), **Explore**. Pressing the word, or Enter on it, or `M` on the dial's
range, turns to the next; only the modes that have something are offered. The view's own mode
draws nothing more than the dial always did. The choice holds while the view is open; a new view
starts on its own.

## The marks by kind (one glyph and one tone each)

| Kind | Mark | Tone |
| --- | --- | --- |
| movement | an arc over its years, a tile at its start | lilac |
| an artist's years here | an arc, packed into two lanes; past eight artists, a density instead — a stroke a year, as long as the lives there that year (the thickening is where a movement is) | cream |
| hunt (a catalogue's year) | a square | amber |
| walk | a dot | lilac |
| voice's route | a short tick | rose |
| painted here (a site's date) | a hollow square | sea-green |
| studios | a square in a square (the atelier) | cream |
| movement (as an exploration) | a diamond | lilac |
| life | an arc's end, a round | cream |

The legend is the line under the word while the dial has focus or the pointer rests on it.

## Turning

Turning reads the band at the year: the arcs under the handle glow, and the **readout** — one
line beside the dial, two doors at most — says them ("Movement · Paris, 1887 · van Gogh,
Matisse, Hale", "Begins here · Wildenstein's hunt"). In a city, the artists who were there
that year are lit on the globe at their studios or schools (an atelier, the lives' mark) — in
Artists or Movements, the mode the viewer turned to, with their Painted here sites of that year;
in Explore only those who came in the year, faint, and the sites painted in it. A city at rest
draws none of them: its own marks are its museums and galleries. Nothing moves the year but the
hand; the readout follows it.

## Pressing

A mark on the band (a tap that is not a turn) or a door in the readout opens it: a movement opens
**the movement** (its city and its artists' birthplaces lit on the globe, their routes to it, the
column its members with their years and evidence, the contact between them, doors to each life at
that year); an artist's arc opens their life at that year where there is one, else their studios;
a hand-off starts that exploration through `Explorations.play`.

## Hand-offs

In **Explore** the band holds what begins here: every published exploration (the relay index, the
lives, the studios, the movements) whose first stop is this city — or, in a work, that passes
through this work — at the year it begins there. Undated ones are listed in the readout, not drawn.

## Movements as an exploration

Kind `m` in the relay (`movements.json` `relay`, matched by `explorations.js` beside the index,
not in it: a code's 9 bits are spent). Played: the city at the movement's first year, where its
artists came from, where else they were during it, the city at its last year — each stop the
movement's view with the dial at that year. In Find: "movements", a city, a decade ("1950s"), a
movement's name, an artist.

## Rules kept

- The dial draws only when something on it changed: the hub's layer gives a key.
- Nothing is computed while turning that could be computed once: `movements.json` carries each
  city's movements and presences; the hub indexes the explorations by city once.
- Reduced motion: no glow pulse; the readout and the word work by keyboard alone.
- A new kind of exploration is a row in the table above and an entry in `KINDS` in `dialhub.js`.

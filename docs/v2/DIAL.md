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

**A place in a life** ("The place, then", `placethen.js`; 2 Oct 2026): entered from a life, a city's dial
is spanned over that period (a year either side), its ticks the years of the works made there; the
works come up one at a time and the dial turns to each one's year, the clod of the place standing as
it stood then; turned by hand, the clod follows. Its band's mode **Made here** marks each of those
works at its year, and a press on one brings it up.

A small word over the year names what the dial is about: **Place · Work · Life · Movement** (the
view's own, as before) and then **Movements**, **Artists** (in a city: whose years were here; in a
work: its artist's places), **Explore**. Pressing the word, or Enter on it, or `M` on the dial's
range, turns to the next; only the modes that have something are offered. The view's own mode
draws nothing more than the dial always did. The choice holds while the view is open; a new view
starts on its own.

## The marks by kind (one glyph and one tone each)

The last column is what the kind's stops are on the ring while it is played (see **The transport**).

| Kind | Mark | Tone | Played: its stops on the ring |
| --- | --- | --- | --- |
| movement | an arc over its years, a tile at its start | lilac | — |
| an artist's years here | an arc, packed into two lanes; past eight artists, a density instead — a stroke a year, as long as the lives there that year (the thickening is where a movement is) | cream | — |
| hunt (a catalogue's year) | a square | amber | each work in catalogue order; in order, evenly (a catalogue's finds share its one year) |
| walk | a dot | lilac | each city of the walk; in order (a walk has no years) |
| voice's route | a short tick | rose | each place in time, at its year (in order where two fall together); the voice taken up before them is not a stop |
| a voice's words in a city (following a writer) | — | rose | each of their words there; in order (words carry no year of their own here). While a route or a walk is played they are not a path of their own: said under its count, its pause holding their clock |
| painted here (a site's date) | a hollow square | sea-green | each point, at the painting's year where every point has one, else in order |
| studios | a square in a square (the atelier) | cream | each studio, at its first year, else in order |
| movement (as an exploration) | a diamond | lilac | where its artists came from, the city at its first year, elsewhere during it, the city at its last: at their years |
| life | an arc's end, a round | cream | each place at its first year, on the life's own years (Picasso's 18 places and After), else in order |
| a viewer's own exploration, a relay | — | each leg's tone | every stop but the hand-offs; at their years where all have one, else in order |
| a hand-off where a path ended (the relay) | the glyph of the kind it hands to | its kind's | — (marks on the band in Explore, at the year of the stop it joins; see **The transport**) |
| the corpse's unfolding | — | lilac, cream, sea-green | head, body, hindquarters, the route; in order (no pause: it is a performance; × puts it away) |
| born here (a town of birthplaces: its artists' saved works) | the view's own ticks: each artist's birth, each death white | lilac | each work, the most saved artist's first, each artist's by date; in order, evenly. Registered paused when the view opens (artist, 7 Oct 2026: "The dial has completely disappeared, bring it back"): the dial's years are the born artists' lives, earliest birth to now; a tap on the face plays them (a work every φ⁵ s) or pauses; the ring scrubs; a swipe on the picture or a stop turns the dial to the work's year, the dial turned by hand (the range's keys) brings the work of that year; the picture's artist is lit on the globe; × ends the path, the dial stays |
| made here (a place in a life, "The place, then") | a square at the work's year (a painting at a documented site: painted here's hollow square) | cream | — |
| guide (a city's shows now, guide.js) | — (its years are now: every show of a guide is in this year or the next, so it marks nothing on a dial of years) | sea-green | each show of the walk, nearest next from the one open (else the city's middle); in order, evenly. Each stop eased to on the city and said on the reading's slow clock (title 4 s, partner and dates 11 s, its artists 20 s; 17 s × φ a stop, moving only while the pointer is still); a tap on the face pauses, the ring scrubs, × ends; under reduced motion a tap on the face is the next show. Its days (openings, closings) would need a dial of days, not years: see GUIDE.md |

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

## The transport

The artist, 3 Oct 2026, of the box a played life left over its picture: "There's a small box that
shows up sometimes like this, I don't quite find it useful at all and it's just annoying and hard to
get rid of. Incorporate the resume and pause function into the dial. The dial isn't quite as
functional as I want it to be. It should be the instrument of the website and used to navigate
paths of explorations by effectively putting time at the viewers fingertips."

A path being played makes the dial its transport (`transport.js`, `transport.css`). Every way of
playing registers itself — `Dial.path({ kind, title, stops: [{ y, label }], at, paused, read,
onSeek(i, play), onToggle(), onEnd(), onNext() })`, which returns `{ set({ at, paused, stops, title }),
close(), alive() }` — hands its lines to the readout (`read`, or `Dial.read(el)`), and at its end its
hand-offs to the band (`Dial.offers([{ kind, y, label, open }])`); the dial does the rest:

| Where | What |
| --- | --- |
| outside the ring | the path's stops, where the chronograph's scale was: passed ones lit, the one being read a tile of pixel light with four sparks round it. **At their years** where every stop has one and no two fall together — on the view's own years when they fall within them (a life's places line up with its years), else on the path's own span — **else in order, evenly**, and the legend says which ("by their years" / "in order — no years to place them") |
| the face | where the span was, the glyph of what a tap does in the dial's engraved tiles: ❚❚ playing, ▶ and the word "paused" when it is, › and "next" (or "end" at the last stop) under reduced motion |
| a tap on the face | pause or resume, at once while the dial is home; while it stands away from home the tap waits out the double tap's window (330 ms), because two taps there send it home. Dragging the face still carries it, and on a touch screen holding the ring still for 350 ms still lifts it |
| holding the face still | a ring of light closes round the face over 1.1 s ("Hold to end · …" in the readout); full, the path ends. Moving off it lets go |
| turning the ring | scrubs: a lilac box glides from stop to stop under the hand and the readout names it ("→ 7 of 19 · Céret · 1911"); letting go goes there — playing on if it was playing, held there if it was paused (a tap on the face then plays on from it); a tap on a stop's mark is a turn to it; a wheel or trackpad over it steps stop to stop. The band inside the ring stays the hub's on a view's dial |
| playing | the comet's tail behind the handle runs with light, in held frames at 12 fps; paused it stills, and the way come, the tail and the handle dim a step |
| the dial's range | Space plays or pauses (the next stop under reduced motion); ←/→ (and ↑/↓) step stop to stop while a path plays, and turn the years when none does; Shift+arrows still move the dial. Played from the keys, the focus goes with the instrument when another dial takes over |
| × at the rim | out past the stops, so a turn begun near it is not taken for it: ends the path (going up to the world still does) |
| the readout | what the strips said, beside the dial where the hub's readout lives — on a phone at its side, else under it (where the hub's lives in the reading layout), on a desktop under it, else beside or above; each side tried at the width it allows, a cramped one costing as much as what it covers: never over the picture (hidden rather than over it), the lens and its rim, the picture's sentence, the banner or off the screen. The count and the place ("1 of 2 · Dakar · 1965", "Paused · …") in the dial's mono, the line being said in the serif (two lines), the newest line of the sentence (none on a phone; a press on the count opens the whole); a voice's words, while a route or a walk is played, said under its count instead of the line. At the end the doors — the relay's hand-offs ("Where this ends, others begin"), Again, Keep, Share, the rhyme, × — and the ended path's stops stay on the ring, all lit, while they are up; there the lens weighs less, the doors more |
| the band at the end | the same hand-offs as marks: a view's dial turns to **Explore** (once in each view; a mode turned to after is the viewer's), each hand-off at the year of the stop it joins, a press on it taking it; the path's own dial stands them at the end of its ring, one under another toward the face |

Where no view's dial shows (a journey between places, the world, a museum without years) the path
has a dial of its own where the view's last stood, after 0.9 s, so a flight between two views does
not flicker; it goes as soon as a view's dial shows again, but never from under a hand turning or
holding it. It stands where the view's last stood, else in its corner, never on the picture (nowhere
clear, it waits unseen and the path plays on). While the picture stands alone — a work's first look,
or filling the screen — nothing of the path shows; it comes back with the view's dial. A walk played
inside an exploration is on top of it; when it ends the exploration's stops come back. A played step
never leaves the picture full screen: the next stop, a work a walk or an exploration opens, or a
life's next beat with a work, lets it down into its place. A life's, a studio's or a site's stop is
said by its own name (Dakar, not Saint-Louis, the nearest city of the record), on the ring, in the
count and in the sentence.

Nothing of the path floats over the picture any more: walks.js's, explorations.js's and voices.js's
strips are only the readout's lines now (their pause, resume, end and "Next stop →" buttons are
the dial's). The corpse's panel (the game's choices between legs) is not a strip and stays; its
unfolding is on the dial as above.

## Movements as an exploration

Kind `m` in the relay (`movements.json` `relay`, matched by `explorations.js` beside the index,
not in it: a code's 9 bits are spent). Played: the city at the movement's first year, where its
artists came from, where else they were during it, the city at its last year — each stop the
movement's view with the dial at that year. In Find: "movements", a city, a decade ("1950s"), a
movement's name, an artist.

## The dial unrolled

The artist, 7 Oct 2026: "Change the shape of the dial to adapt to the rectangular form in some way."
When the dial is put in the reading's big place (the three parts, land.js), it is a band of years,
the same instrument laid flat: one drawing, through a projection (`bandCtx` in land.js), not a second
implementation.

| On the ring | Unrolled |
| --- | --- |
| the angle from the top | x, left to right over the dial's span |
| the gap where now meets the beginning | the two ends of the line, each a lilac point |
| the distance from the ring | the height over or under the line (`ky` px a ring px) |
| the chronograph's scale outside | the decades above the line, named |
| the event ticks inside | ticks under the line, lit once passed |
| the way come and the comet's tail | a line of light to the handle, the tail behind it |
| the handle (the museums' diamond) | the same diamond on the line, dragged along it |
| the hub's band (dialhub.js) | lanes under the line: spans named under their starts (`g.unrolled`), strokes, glyphs |
| the transport's stops outside the ring | marks above the line, the current a tile of pixel light |
| the face: ❚❚ / ▶ | the band's left end, a tap plays or pauses |
| the face's word (the mode) | at the band's right end, a tap turns to the next |
| the year in the middle | the year at the top left, its span and its tense beside it |

A press on the band is the press on the ring it stands for (`bandToRing`): a turn, a scrub of a
played path, a press on a span (`DialHub.tap`). The range underneath keeps the keys. In the small
place or its own the dial is a dial. A new kind of mark drawn with the ring's own calls is unrolled
with it; text it wants written only unrolled asks `g.unrolled`.

## Rules kept

- The dial draws only when something on it changed: the hub's layer gives a key.
- Nothing is computed while turning that could be computed once: `movements.json` carries each
  city's movements and presences; the hub indexes the explorations by city once.
- Reduced motion: no glow pulse; the readout and the word work by keyboard alone.
- A new kind of exploration is a row in the table above (with what its stops are on the ring) and an
  entry in `KINDS` in `dialhub.js`; when it is played it registers with `Dial.path` (transport.js)
  and hands its lines to `Dial.read` — never a box of its own over the view.

# The voices — who tells a path, from how far, in what tense

The artist, 2 Oct 2026, with a recording of a work's view on his phone (the work large across the
top, the small globe beside the dial, the text scrolling below): "I really liked the layout in this
perspective with the globe that small next to the dial and a big image above it with scrollable text
below. Find a way to incorporate [this]. Think about the different ways we are defining these paths
and how that relates to the viewers distance from the globe. Example, movements are a big idea and as
they get more modern they are relevant to more areas of the globe, so the perspective should be
farther out. Whereas if we are focusing on a specific artist, our perspective can be much closer and
even potential third person of the artists head, or first person. Think about different tenses and
perspectives novels are written in and how that pertains to the way we are defining these paths of
exploration."

And, the same day, of the idea that a path could change voice as a novel does mid-chapter: "Great
idea, implement that changes in perspective as paths of exploration evolve".

**This file is read by the page.** `voice.js` fetches it and reads the three tables below; a new kind
of path declares its voices by adding rows here, as a new kind of exploration gets its row in
`DIAL.md`. Nothing else in the page names a voice for a step.

## The layout

Every path is read in one layout: the **picture** (the work being read, or the work of that moment)
above on a phone, left on a desktop; the **lens** — the world in a round window — beside the **dial**;
the text below (phone) or right (desktop). A tap on the lens swaps it with the picture (the big place
is the world's, at the same distance); a tap on the picture in the lens's place, or Escape, swaps them
back. Two fingers on the lens (a wheel or a trackpad's pinch over it) move between the voices without
leaving the path — nearer is more personal — and **hold** that voice for the rest of the path; a press
on the voice's name, engraved on the lens's rim, lets it go. Under reduced motion nothing flies: the
lens jumps, the name and the sentence change with each step.

## The voices

The lens's distance is the voice. `rank` orders them for the pinch, far to near (`second` and
`letters` take their distance from the step's frame, below).

| voice | label | held | rank | distance |
|---|---|---|---|---|
| omniscient | from above | from above | 0 | the Earth, or everything the step names: as far out as it takes, so a movement whose artists came from all over is seen whole |
| panoramic | from afar | from afar | 1 | a region: both ends of a way |
| close | following | following | 2 | the city, over the shoulder: the figure a little behind the middle, the way ahead in front |
| first | where {who} stood | where {who} was | 3 | the ground where they stood: DIRT Earth's, in the lens, north up |
| second | you | you | - | as far as what the stop is (its frame) |
| letters | in their words | in their words | - | as far as what the stop is (its frame) |

`held` is the rim's name when the viewer holds that voice on a step that is not its own (held in the
first person on a life's year that is no painted site, the lens is on the ground where the artist was,
not where they stood to paint).

## The tenses

Shown small under the dial's years.

| tense | word |
|---|---|
| past | was |
| present | is |
| future | will be |

A history is past (what happened). A life or a walk, while it is read, is present: the year turning
is now. Past a life's death mark the works go on, in the future-in-the-past: "It will be in New York
in 1980."

## The rules

`frame` is what the lens frames: `route` (every place the path names), `movement` (a movement's city
and where its artists came from), `leg` (both ends of a way), `stop` (one place), `shoulder` (one
place, over the shoulder, from the place before), `two` (two figures in one place), `arrival` (one
artist's arrival), `after` (where the works went after a death), `standing` (where a painter stood).
For `second` and `letters` the frame gives the distance: `stop`, `shoulder`, `two`, `arrival` →
close; `leg`, `after` → panoramic; `route`, `movement` → omniscient; `standing` → first.

The caption is the sentence under the picture: `{…}` are facts the data holds (never invented, never
a pronoun the data cannot give: the artist is named), `*{title}*` is a title in italics, `[…]` is said
only when every fact inside it is known. `label`, where given, is the rim's name for that step instead
of the voice's.

| path | step | voice | tense | frame | label | caption |
|---|---|---|---|---|---|---|
| work | rest | omniscient | past | route |  | It went to {n} places, {years}. |
| work | city | close | past | stop |  | {year}: it was {verb} in {place}. |
| work | journey | panoramic | past | leg |  | {years}: it went from {from} to {to}. |
| work | site | first | past | standing |  | Here {who} stood to paint it, {year}. {facing} |
| work | site-made | first | past | standing | where {who} worked | It was made here, at {what}[, {year}]. |
| work | site-place | first | past | standing | the place painted | It shows {what}[, {year}] — the place painted, not where {who} stood. |
| work | site-street | first | past | standing | on the street | It was painted on {what}[, {year}] — the street is documented, not the spot. |
| hunt | arrive | panoramic | present | leg |  | {cataloguer}’s No. {no}: on to {place}. |
| hunt | finding | close | present | stop |  | {cataloguer} finds it with {holder}, {year}. |
| hunt | unfound | panoramic | present | leg |  | Where {cataloguer} found it is not recorded[; it is in {place} now]. |
| hunt | site | first | past | standing |  | Here {who} stood to paint it, {year}. {facing} |
| hunt | site-made | first | past | standing | where {who} worked | It was made here, at {what}[, {year}]. |
| hunt | site-place | first | past | standing | the place painted | It shows {what}[, {year}] — the place painted, not where {who} stood. |
| hunt | site-street | first | past | standing | on the street | It was painted on {what}[, {year}] — the street is documented, not the spot. |
| life | route | panoramic | present | route |  | {who}, {years}. |
| life | born | close | present | shoulder |  | {who} is born in {place}, {year}. |
| life | place | close | present | shoulder |  | {who} {goes} {place}, {year}[, aged {age}]. |
| life | crossing | close | present | two |  | {who} {goes} {place}, {year}. {other} is here. |
| life | movement | omniscient | present | movement |  | {place}, {year}. {others} are here. |
| life | site | first | present | standing |  | {who} stands here to paint *{title}*, {year}. {facing} |
| life | site-made | first | present | standing | where {who} worked | {who} paints *{title}* here, at {what}, {year}. |
| life | site-place | first | present | standing | the place painted | {who} paints *{title}*, {year}: {what}, the place painted. |
| life | site-street | first | present | standing | on the street | {who} paints *{title}* on {what}, {year}: the street, not the spot. |
| life | work | close | present | shoulder |  | {who} {goes} {place}, {year}: *{title}*. |
| life | died | close | present | shoulder |  | {who} dies in {place}, {year}. |
| life | gap | panoramic | present | route |  | {year}: no record says where {who} is. |
| life | after | panoramic | future | after |  | {year}: {whose} works will be in {cities}. |
| life | after-quiet | panoramic | future | route |  | {year}: {whose} works will go on. |
| movement | overview | omniscient | past | movement |  | {place}, {year}. {others} were here. |
| movement | arrival | close | past | arrival |  | {who} came to {place} in {year}. |
| movement | before | omniscient | past | movement |  | {year}: none of them was in {place} yet. |
| movement | after | omniscient | past | movement |  | {year}: they had gone from {place}. |
| movement | quiet | omniscient | past | movement |  | {year}: none of them is recorded in {place}. |
| thread | rest | omniscient | past | route |  | {n} works, {years}: {name}. |
| walk | work | close | present | stop |  | {animal} waits in {place}: *{title}*. |
| walk | site | first | past | standing |  | Here {who} stood to paint it, {year}. {facing} |
| walk | journey | panoramic | present | leg |  | {animal} goes on to {place}. |
| follow | city | close | present | stop |  | {animal} leads on to {place}. |
| voice | place | letters | past | route |  | {voice} wrote from {place}[, {year}]. |
| voice | work | letters | past | stop |  | {voice}, on *{title}*. |
| sites | site | first | past | standing |  | *{title}*[, {year}]: here {who} stood. {facing} |
| sites | site-made | first | past | standing | where {who} worked | *{title}*[, {year}] was made here, at {what}. |
| sites | site-place | first | past | standing | the place painted | *{title}*[, {year}] shows {what}, the place painted. |
| sites | site-street | first | past | standing | on the street | *{title}*[, {year}] was painted on {what}: the street, not the spot. |
| studios | studio | close | present | stop |  | {who} works in {place}[, {years}]. |
| own | work | second | present | stop |  | You look at *{title}*[, in {place}]. |
| own | site | second | present | standing |  | You stand where {who} stood to paint *{title}*. {facing} |
| own | city | second | present | stop |  | You come to {place}. |
| own | museum | second | present | stop |  | You go into {museum}. |
| own | voice | second | present | route |  | You follow {voice}. |
| own | thread | second | present | route |  | You follow {name}. |
| own | animal | second | present | stop |  | You follow {animal}. |
| corpse | edge | second | present | stop |  | You see only the edge: {place}[, {year}]. You walk on. |
| corpse | stop | second | present | stop |  | You walk on to {place}[, {year}]. |
| building | room | first | present | standing | where you stand | You stand in {room}. |

## How a step is known

`voice.js` reads what is being read (`Land.reading()`) and what plays it:

- **A work's history** (hand): at rest, `rest`; a place read (its head pressed, scrolled to, or its
  lit place pressed on the globe), `city`; the dial turned by hand and left between two places,
  `journey`; its Painted here head pressed, `site` (where the painter stood: Wikidata's point of view),
  `site-made` (the building it was made in), `site-street` (the street) or `site-place` (only the
  place painted). While the journey plays the first time nothing moves the lens.
- **A life** (the dial's year, once it has rested a second; first play and fast turning keep the
  route): past the death, `after`; on a documented site's year, once rested 2.4 s, `site`; in a
  movement of the artist's in that city, `movement`; a life crossing it, `crossing`; born, died;
  else `place`, `arrives in` on a place's first year, `is in` after. Played ("Play the life"), each
  place is a stop said in beats — arriving, the crossing, the movement, a site, then the works in
  turn (`work`, the picture the work said) — and the lens moves at each beat.
- **A movement**: before, during (`overview`), after; a member's first year there, once rested,
  `arrival`, the lens leaning in to them for a while, then out again.
- **Played** (`explorations.js` tells `voice.js` each line it says): a hunt's stop `arrive`, then
  `finding` (or `unfound`), then a site if it has one; a viewer's own or a relay `own` (second
  person, the lens as far as what each stop is); a sites exploration `sites`; a studios one
  `studios`; a walk's works `walk`; a voice's places `voice`.
- Where a path passes through a view with no lens (a city, a museum, the building walked), its name
  and sentence are said beside the dial (`.voice-chip`).

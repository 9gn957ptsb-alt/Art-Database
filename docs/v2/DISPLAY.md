# How information is categorized and shown — after WCAG 2.2

The artist, 7 Oct 2026, sending the WCAG 2.2 Quick Reference (w3.org/WAI/WCAG22/quickref):
"Read through this website and use it as a reference on how to best categorize and display
information". This file is that reference, read from WCAG's own source (github.com/w3c/wcag and
github.com/w3c/wai-wcag-quickref; www.w3.org is blocked from the sessions). Every new view, path
or kind of mark is designed against it, as it is against KINDS.md (its category), DIAL.md (its
place on the dial) and VOICE.md (how it is told). The target is Level A and AA throughout, and the
AAA criteria named below where they fit the site.

## What the Quick Reference itself teaches about categorizing

- **A few stable principles over many specific things.** Four principles (Perceivable, Operable,
  Understandable, Robust) hold thirteen guidelines, which hold 86 success criteria. Nothing is
  filed twice; every criterion has one home and one number. The site's categories work the same
  way (KINDS.md): nine categories, each thing in one, with one glyph and one name.
- **A level on every item.** A, AA, AAA say how much each criterion matters. The site's equivalent
  is what shows at rest and what waits for a press: a layer's own marks at rest, everything
  per-artist or per-work only for a selection ("The filter").
- **One sentence first, the rest on request.** Each criterion is stated in one sentence; the
  understanding, techniques and failures open behind it. A view on the site says one sentence
  and one picture first; evidence, sources and lists are a press away.
- **Facets, not more pages.** The Quick Reference is one page filtered by tags, levels,
  technologies and kinds of technique, and the same tags are seen from four roles (developing,
  interaction design, visual design, content). The site is one page with one link, filtered by its
  pills, its three tabs from each thing, and the dial's modes. A "view" is shared in the
  Quick Reference by a link with its filters; on the site, which keeps one address, by a code
  (`ex·`, `fox·`, `corpse·`).

## The rules, criterion by criterion

### Perceivable
- **1.1.1 Non-text content, 4.1.2 Name, role, value (A).** The globe, the clods, the dial's ticks
  are canvas: everything they mean also exists as text — the names written, the column, Find,
  and for a screen reader a list of what is on screen. Every custom control has a name, a role
  and a value: the dial is a slider whose value says the year and what it holds ("1961 · Rome ·
  Twombly"); the pills are a radio group; the three tabs are tabs; the swipe picture says "2 of 7".
- **1.3.1 Info and relationships (A), 2.4.6 Headings and labels (AA), 2.4.10 Section headings
  (AAA).** Each view has one heading saying what it is ("Twombly in Rome, 1961"), its sections
  headed in plain words, lists marked as lists. What looks grouped is grouped in the markup.
- **1.3.2 Meaningful sequence (A).** The reading order is the looking order: picture, sentence,
  then the column.
- **1.3.3 Sensory characteristics (A).** No instruction says only "the lilac one" or "on the
  right".
- **1.4.1 Use of colour (A).** Colour never carries a meaning alone: a category is glyph + word +
  tone; a lit tick is also longer; the place being read is also marked by weight or a sign, not
  only by lilac.
- **1.4.3 Contrast (AA).** Text at least 4.5:1 against what is behind it (3:1 at 24 px, or 19 px
  bold). Quiet is done by size, weight, spacing and position — not by greys that fall under the
  line. **1.4.11 Non-text contrast (AA):** the parts needed to read or use a thing (the dial's
  ring and ticks, a pill's edge, a mark on the globe) at least 3:1 against their surroundings.
- **1.4.4 Resize text, 1.4.10 Reflow, 1.4.12 Text spacing (AA).** 200 % text, a 320 px width and
  wider letter, word and line spacing lose nothing.
- **1.4.13 Content on hover or focus (AA).** A name that appears on pointing (a door label, a
  globe name) can be dismissed (Escape), can itself be pointed at, and stays until it is.

### Operable
- **2.1.1 Keyboard (A), 2.1.2 No keyboard trap (A).** Everything a finger does, a key does: turning
  the globe (arrows), nearer and farther (+ / −), moving between what is shown (Tab), the dial
  (its range: arrows, Page Up/Down, Home/End), the picture (← / →), the walk (WASD), out (Escape).
- **2.2.2 Pause, stop, hide (A).** Anything that moves or changes by itself for more than five
  seconds next to other content can be paused: the reading's slow clock, a life or a walk played,
  a place's works coming one by one, the first-visit play of the dial, the globe's swing, the
  company. The dial's face is that pause (the transport, DIAL.md). **2.3.3 Animation from
  interactions (AAA):** reduced motion turns off every animation that is not the information.
- **2.3.1 Three flashes (A).** No pulse of pixel light, lightning or flash brightens and dims a
  large area more than three times in a second.
- **2.4.2 Page titled (A).** The document's title says the view ("Twombly in Rome, 1961 — Artist
  Website") while the address never changes.
- **2.4.3 Focus order (A), 2.4.7 Focus visible (AA), 2.4.11 Focus not obscured (AA).** Focus moves
  in the reading order, is always visible (a lavender ring), and is never hidden under the moved
  dial, the grown globe or the banner.
- **2.4.8 Location (AAA).** One quiet line says where you are — artist · place · year, or city,
  or museum — instead of a strip of crumbs; the way back is the banner's.
- **2.5.1 Pointer gestures (A), 2.5.7 Dragging movements (AA).** Every pinch, swipe and drag has a
  one-tap way that does not drag: + / − for nearer and farther, ‹ › beside a swipeable picture on
  every device, a tap on a tick or a point of the dial's ring to go there, the home tile to bring
  the dial or the globe back, buttons for the plan's floors, ↑ / ↓ in the tray.
- **2.5.8 Target size (AA), 2.5.5 (AAA where it fits).** Every target is at least 24 × 24 CSS px
  to press, even when it is drawn as a 13 px tile (the tile is the look; the target is larger and
  centred on it); 44 px where there is room.

### Understandable
- **3.1.1 Language of page, 3.1.2 Language of parts (A/AA).** The page says English; a name in its
  own script says its language (李青 in Chinese).
- **3.2.1 On focus, 3.2.2 On input (A), 3.2.5 Change on request (AAA).** Focusing or turning
  something never carries you somewhere else by itself; flights and journeys start from a press.
- **3.2.3 Consistent navigation, 3.2.4 Consistent identification (AA), 3.2.6 Consistent help (A).**
  The same thing has the same name, glyph and place everywhere: "← The world", "Enter ›", the
  dial's place, the pills' order, the three tabs' order.

### Robust
- **4.1.3 Status messages (AA).** What changes without moving focus — the dial's readout, the
  voice's sentence, a count — is announced politely (a live region), never by stealing focus.

## A checklist for every new view, path or mark

1. Its category (KINDS.md), its place on the dial (DIAL.md), its voice (VOICE.md).
2. One heading, one sentence, one picture first; the rest a press away.
3. Its meaning in text as well as in the drawing; never colour alone.
4. Contrast measured: 4.5:1 text, 3:1 marks and controls.
5. Every gesture with a one-tap way; every target 24 px or more.
6. Anything that moves by itself can be paused from the dial; reduced motion respected.
7. Keyboard all the way through, focus visible and never hidden.
8. The title says the view; the address stays one link.

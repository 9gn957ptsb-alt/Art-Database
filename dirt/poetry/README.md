# DIRT Poetry

The five pages of *Picture Poetry* (Aries's book of photographs and poems: *Boiling*, a page signed *Innocence as an
Act*, *For What*, *Neither Where Nor When*, and an untitled prose poem beside the Spring Point Ledge lighthouse), each
laid whole on an endless plane painted in DIRT's language, that you drag through. Made on 10 October 2026 from four
stills of DRIFT (v80) and the pages themselves, and nothing else: "make a new artifact that applies each page to these
graphic aesthetics in a 2D plane ... strictly working off of these images and the pages in the Picture Poetry
artifact", and then "each page from the Picture Poetry pages".

Published as its own artifact (private to its owner). The pages, the photographs and the poems are not in this
repository: `build_poetry.py` reads them from `dirt/private/poetry/` (ignored): the page images saved from the Picture
Poetry artifact, `overlays/` (each page's buildings and characters as that artifact draws them over the page, captured
on a transparent ground at the page image's size) and `poems.json` (the poems as transcribed from the page images).

    python3 dirt/poetry/build_poetry.py OUT.html

## The plane

- **Territories.** One to each 1597-pixel square, scattered a little, their edges wandering widely (a swing of 377
  pixels over 987, and DRIFT's own 144 and 34). Two neighbours melt into each other, devices and all, over a band 466
  pixels wide, so there is no edge to see.
- **A page in each, whole.** In the middle of each territory lies one page as Picture Poetry sets it: its photograph,
  its poem (title, rule, lines and signature), its buildings and its characters, at φ⁻¹ of a plane pixel to a page
  pixel (a little larger than the book shows them, so the poems read at their own size). Pages are dealt along the rows
  two apart, so no two neighbours are the same page, and all five are always near. Each lies as laid by hand, within a
  degree and a half of square.
- **Four ways of painting a page,** one after each still. Each page leans to one (*Boiling* to the field and its
  vapour, the sun in the trees to the kaleidoscope, *For What* and the lawn to the collage, the lighthouse to the arcs
  and the disc) and visits the other three:
  - *after the first still:* a pale wash with white clouds; the photograph printed in halftone over a pale wash of
    itself, dots where it is dark in its own colours leaning to the page's accent; a soft dark disc just beyond its far
    edge (the afterimage the sun leaves) with fine rainbow arcs round it; stipple;
  - *after the second:* a white ground with one large field of the page's deep colour behind the photograph, grey
    vapour and upright strokes; the photograph whole in its middle, coming apart toward its edge in crumbs that drift
    out into the white; now and then a short woven band of chevrons, bowed as cloth lies;
  - *after the third:* a cream ground and a deep band behind the photograph; the photograph held in a white cloud;
    white clouds round it holding golden kaleidoscopes (two brush strokes in the wedge between five mirrors at 36°, so
    ten images make a star, the pentagon's symmetry, cos 36° = φ/2, and the same star φ² smaller in its middle);
  - *after the fourth:* a collage of torn pastel pieces in the page's colours; the photograph torn and laid again, each
    piece a little moved and turned, its torn edges white with fibre; the poem on its own torn sheet of the page's paper.
- **The paper dissolves; the poem stays.** The page's paper fades into the ground at a wash's wandering edge, and the
  poem keeps a calm paper under it so it can be read. Page 4's sage block is a wash. The type, rules, buildings and
  characters are printed last, sharp, over DIRT's watercolour (the page with its paper taken away, kept at three
  quarters of the page image's size).
- **The paint is the page.** Every colour is the page's: its photograph (wash, halftone, crumbs, cloud, torn pieces and
  the kaleidoscopes' strokes), and a palette measured from it (k-means in RGB, ranked by chroma and share): Boiling's
  sunset deepened to burnt orange, the second page's sky to deep blue with its lens flare's rose, For What's sky to teal
  with its cloud light, the lawn's shade to a living green with the sunlit lawn's olive gold, the lighthouse's caisson
  to the slate of the sea with its lantern's red.
- **The watercolour** is DRIFT's own (as of v80): the paint is drawn at half the screen's resolution, then its colours
  bleed through nine filtered looks, the pigment is denser and thinner over the paper's grain and in slow pools and
  gathers at the rim of each wash, the paper shows through, and the margins of the view thin to paper and cool air.
- **Still, and never behind.** Nothing moves unless it is dragged; the plane is drawn only when it is. If moving frames
  come slowly (a frame over 24 ms, eight times, while the plane is dragged or coasting), it paints more coarsely while it
  moves (a paint texel to three or four screen pixels, at a lower pixel ratio), and at rest it draws once more at its
  finest. Each visit begins on a different page (on a narrow screen, on its poem); `#at<x>_<y>` (for example
  `#at806_787`) begins at a given place instead. Drag, swipe, scroll or use the arrow keys (Shift for longer steps); the
  label names the page underfoot.

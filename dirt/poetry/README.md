# DIRT Poetry

The four pages of *Picture Poetry* (Aries's book of photographs and poems: *Boiling*, a page signed *Innocence as an
Act*, *For What*, and *Neither Where Nor When*), painted in DIRT's language on an endless plane you drag through.
Made on 10 October 2026 from four stills of DRIFT (v80) and the pages themselves, and nothing else: "make a new
artifact that applies each page to these graphic aesthetics in a 2D plane ... strictly working off of these images
and the pages in the Picture Poetry artifact."

Published as its own artifact (private to its owner). The pages, the photographs and the poems are not in this
repository: `build_poetry.py` reads them from `dirt/private/poetry/` (ignored), where the page and photo images were
saved from the Picture Poetry artifact and `poems.json` holds the poems as transcribed from its page images.

    python3 dirt/poetry/build_poetry.py OUT.html

## The plane

- **Territories.** One in each 610-pixel square, scattered, their edges wandering (a warp of 144 and 34 pixels), as
  DRIFT's regions are. Each is one page, chosen by its hash, so the four recur across the plane, never in a grid.
- **Four ways of laying a page,** one after each still. Each page leans to one and visits the others:
  - *after the first still:* a pale wash with white clouds, a soft patch of the photograph screened into dots of the
    page's accent, fine arcs in the colours of the second page's lens flare, a soft dark disc (the afterimage the sun
    leaves), and small clusters of pen stipple;
  - *after the second:* a white ground, one large field of the page's deep colour with a gently curved rim, grey
    vapour, a knot of photograph torn small whose edge dissolves cell by cell, upright brush strokes, now and then a
    woven band of chevrons;
  - *after the third:* a cream ground, a deep band between two curves, and white clouds each holding a golden
    kaleidoscope: two brush strokes in the wedge between five mirrors standing at 36°, so ten images make a star (the
    pentagon's symmetry, cos 36° = φ/2), and the same star φ² smaller in its middle where the mirrors face each other;
  - *after the fourth:* a collage of pieces torn from the photograph and laid over one another, most of them pastels of
    the page's colours, a few holding a fragment of the photograph, each upper piece's torn edge white with the paper's
    fibre and the piece beneath in its shadow, the whole catching a few soft streaks of light.
- **The paint is the page.** Every colour is the page's: the photograph itself (as wash, fragment, halftone and
  kaleidoscope), and a palette measured from it (k-means in RGB, ranked by chroma and share): Boiling's sunset deepened
  to burnt orange, the second page's sky to deep blue with its lens flare's rose, For What's sky to teal with its cloud
  light, the lawn's shade to a living green with the sunlit lawn's olive gold.
- **The poems** are strips torn from the page images themselves, so each keeps its face, size, indents, title and rule
  as set on the page. φ⁻² of the territories carry one: two to five whole lines, the title with its first lines, or
  (φ⁻³ of the time) the whole poem; its paper thin enough to show the paint faintly through, its torn rim white, its
  shadow soft.
- **The watercolour** is DRIFT's own (as of v80): the paint is drawn at half the screen's resolution, then its colours
  bleed through nine filtered looks, the pigment is denser and thinner over the paper's grain and in slow pools and
  gathers at the rim of each wash, the paper shows through, and the margins of the view thin to paper and cool air.
- **Still.** Nothing moves unless it is dragged; the plane is drawn only when it is. Each visit begins in the middle of
  a different territory; `#at<x>_<y>` (for example `#at-1597_1597`) begins at a given place instead. Drag, swipe, scroll
  or use the arrow keys (Shift for longer steps); the label names the page underfoot.

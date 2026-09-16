# Wix site

The live site is Wix-hosted: <https://mattlivs3.wixsite.com/matthew-livingston-a>
(site ID `f2325e6f-4b00-45a1-8d4a-15e0b34cb98e`, Harmony editor, free plan).

`docs/` is not this site. It is the design reference the Wix site is fitted to;
edits in one do not reach the other.

## The Works collection

Works are CMS rows, not hand-placed page elements, so adding or changing a piece
is a data edit rather than a redesign. The Wix CMS app was installed to make this
possible — the site was generated without it.

Collection `Works`, read `ANYONE`, write `ADMIN`:

| Field | Key | Type |
| --- | --- | --- |
| Title | `title` | TEXT |
| Year | `year` | NUMBER |
| Medium | `medium` | TEXT |
| Dimensions | `dimensions` | TEXT |
| Availability | `availability` | TEXT |
| Image | `image` | MEDIA_IMAGE |
| Order | `sortOrder` | NUMBER |
| Category | `category` | TEXT |
| Note | `note` | TEXT |

`MEDIA_IMAGE`, not `IMAGE` — Harmony sites reject `IMAGE`.

`category` separates bodies of work. All six current rows are `Collage`; paintings
are coming and will be `Painting`. It exists so the page can later show the two as
separate sections, or filter between them, without the rows being restructured once
there are dozens of them.

The caption order matches the reference page: artist, *title* and year, medium and
dimensions, availability, then `note`.

### Writing text fields

Patch text with a **plain** value:

```json
{"fieldPath": "medium", "action": "SET_FIELD", "setFieldOptions": {"value": "Collage"}}
```

The docs also show `{"value": {"stringValue": "Collage"}}`. That form stores the
wrapper *literally* — the field comes back as an object, and a repeater bound to
it renders nothing useful. All six rows were written that way once and had to be
rewritten.

`note` carries the orientation line on every collage. It is the same string on all
six rows rather than logic keyed off `category`, because a Wix repeater binds a
field far more easily than it evaluates a condition.

### Current rows

| Order | Title | Year | Category | Dimensions | Image |
| --- | --- | --- | --- | --- | --- |
| 1 | Amadeus | 2025 | Collage | — | — |
| 2 | i | 2024 | Collage | — | — |
| 3 | Collage with Portraits | 2024 | Collage | — | — |
| 4 | NYNY | 2025 | Collage | — | — |
| 5 | HEY AMATEUR: COLLAGE | 2026 | Collage | — | — |
| 6 | Boston Spring | 2026 | Collage | — | — |

Dimensions and images are deliberately empty. The photographs in `docs/images/`
are placeholders, so nothing was uploaded to Wix Media yet — that happens once,
with the real documentation.

## Uploading images

Not possible from a Claude Code session. All three routes are closed:

- **Signed upload URL** (`site-media/v1/files/generate-upload-url`, then PUT the
  bytes) — generating the URL works, but `upload.wixmp.com` is unreachable through
  the session's proxy.
- **Base64** via the upload tool — a 620px JPEG is ~50k tokens of base64 and gets
  truncated before it can be sent. Six of them is neither reliable nor cheap.
- **Public URL** for Wix to fetch — this repo is private and artifacts are private.

So images go in by hand: drag the files into the Media Manager in the Wix
dashboard. After that the rows can be filled from a session — list the media
files, match them by filename, and patch each row's `image`.

## The land's shape — the table is SUPERSEDED

The land on `/v2/` was first built as the editorial table below, used as flat
terrain. On 16 Sep 2026 the artist replaced that reference: the land is now a
globe you turn, after the stage Ye and Aus Taylor built for the Ye Live opening
at SoFi Stadium on 1 Apr 2026 — a sphere rising out of the floor, one figure on
top in a single beam, haze, a pale ring, the room's lights past its edge. The
site's version is an interpretation of that idea, not a copy of the production:
the sphere is made of the artist's own words and the figure on it is the
grazing creature.

Worked from five stills the artist supplied. No session has seen the video.

## Matching the reference design — SUPERSEDED

**The live site is no longer being matched to `docs/`.** On 14 Sep 2026 the
artist chose the layout the Wix assistant built — the editorial table with large
display headings, columns for medium, year, availability and collection status —
as the design for the site. `docs/` is now a reference page that records the
works and their captions, not a target the live site is steered toward.

The spec below is kept because the palette and type values are still the source
of truth for anything that *should* match, and because it is the only written
record of the earlier direction. Do not work through it as a task list.

### Colour

| Role | Hex |
| --- | --- |
| Page background | `#f0f1ef` |
| Text | `#16181a` |
| Secondary text — title, medium, note | `#6b7075` |
| Hairline rules | `#d5d8d4` |
| Links | `#41665f` |
| Empty image box | `#e4e6e3` |

A cool off-white, not cream. If Wix offers a "white" preset, it is the wrong white.

### Type

Two faces: **Archivo** (400 and 500) for everything structural, **Newsreader**
(400 and 400 italic) for artwork titles and the statement.

| Element | Face | Size | Other |
| --- | --- | --- | --- |
| Masthead name | Archivo 500 | 34px | letter-spacing −0.5px |
| Lede | Newsreader 400 | 19px | line-height 1.45, `#6b7075`, max ~42 characters |
| Section label (WORKS) | Archivo 500 | 12px | uppercase, letter-spacing 1.44px, `#6b7075` |
| Artist line | Archivo 500 | 14px | `#16181a` |
| Title line | Newsreader 400 *italic* | 15px | `#6b7075`; the year after the comma is NOT italic |
| Medium line | Archivo 400 | 14px | `#6b7075` |
| Price line | Archivo 400 | 14px | `#16181a`, 6px above it |
| Note | Archivo 400 | 12px | line-height 1.4, `#6b7075`, max ~34 characters |
| Colophon headings | Archivo 500 | 12px | uppercase, letter-spacing 1.44px, `#6b7075` |
| Statement | Newsreader 400 | 16px | line-height 1.55, `#16181a` |

Caption lines sit at line-height 1.45 — tight, stacked, no gaps between them
except the 6px above the price and 8px above the note.

If Wix's font list has neither face: substitute a neo-grotesque for Archivo
(not Inter), and for Newsreader a serif with a true italic — Lora or EB Garamond
are closest. Don't substitute a display serif; the titles are small text.

### Layout

- Content column max **1248px**, centred, **24px** side padding.
- Masthead: **44px** above the name, **40px** below the lede; lede **10px** under
  the name.
- Section label: the word, then a **1px** `#d5d8d4` rule running to the right edge,
  vertically centred on the text, **16px** gap. **32px** below it to the grid.
- Grid: **4 columns** on desktop, **32px** between columns, **44px** between rows,
  items aligned to the top (not stretched).
- **Each image sits in a square box**, centred inside at its own proportions and
  never cropped. This is the detail Wix will fight: its galleries crop to fill by
  default. Use a repeater with an image element set to *fit*, not *fill*, on a
  square container.
- Caption starts **14px** under the image.
- Colophon: **3 columns**, **48px** gap, a **1px** `#d5d8d4` rule above,
  **32px** above the content and **64px** below.

No rounded corners, no shadows, no gradients, anywhere.

### Prompt for the Wix AI helper

> Restyle the works page. Page background #f0f1ef, body text #16181a, secondary
> text #6b7075, all rules 1px #d5d8d4, links #41665f. Use Archivo for headings and
> caption text and Newsreader for artwork titles and the statement. The site name
> is Archivo Medium 34px. Each work's image sits in a square container, fit not
> fill, never cropped, four per row, 32px between columns and 44px between rows.
> Under each image: artist name Archivo Medium 14px; then the title in Newsreader
> italic 15px in #6b7075 with the year after a comma not italicised; then the
> medium in Archivo 14px #6b7075; then the price line in Archivo 14px #16181a; then
> the note in Archivo 12px #6b7075. No rounded corners, no shadows, no gradients.

Run it once, then correct by hand against the table above — the helper gets the
broad strokes and misses the small numbers.

## Still to do

0. **Fabricated content is live on the site.** *(Now the main blocker: the
   chosen layout is the assistant's, so the only thing wrong with the live site
   is what it says.)* The published page lists four
   artworks that are not the artist's — *Still Life*, *Horizon Line*,
   *Mixed Media*, *Geometric Form* — with invented media, years, collection
   statuses and exhibition history ("Featured in the Autumn Salon group
   exhibition", "Acquired during the hallmark New York Solo Exhibition at
   Metanoia"). The footer carries an invented artist statement describing the
   practice as painting, and an invented address, `hello@mlivingston-art.com`.

   None of it is in the CMS — `Works` holds only the six real collages. Aria
   typed it into the page as static text, so the fix is in the editor: delete
   those rows and the statement, and bind every element to the `Works` fields.
   The connected dataset is also limited to 5 items where there are 6.

   Deferred by the artist on 14 Sep 2026, knowing it is public.

1. Connect the collection to a repeater on the home page. This is editor work:
   the Harmony page structure is not writable through the REST API.
2. Upload the real photographs to Wix Media and set each row's `image`.
3. Fill in `dimensions`, the statement, and a real contact email.
4. Remove **Wix Hotels**, which the site generator installed for no reason.
5. When paintings arrive: set their `category` to `Painting`, leave `note` empty,
   and change the masthead line — it currently says the practice is collage,
   which will stop being true.
6. Image rotation is on the reference page only. Wix repeaters have no rotate
   control, so on the live site it needs Velo enabled and custom code.
7. Rotation on the live site is off the table for now — it needs Velo and custom
   code, and the design is being matched by hand instead.
8. Front page peels away on rotation — *"I want the front page to peel away upon
   rotating the token object like your ducking into the shadows of a tree,
   patterned in blues, upon escaping the beating light of day"*. Kept in the
   artist's words; the image is the brief. Rotation stops being a per-work
   control and becomes the page's own gesture: the front page gives way to
   something cooler and dappled behind it, carried by light and shadow rather
   than a slide or fade. Blocked until one thing is settled — **what the token
   object is**. Today's rotate control is a small button per collage; this reads
   as something singular and central that the visitor turns.

   *A candidate arrived on 16 Sep 2026.* The land (`docs/v2/land.html`) makes
   one: an artwork held down until it condenses into the three colours it
   reduces to, a single round thing the visitor already picks up and throws.
   Turning it instead of throwing it is the same gesture. Not decided — the
   artist has not said this is the token object.

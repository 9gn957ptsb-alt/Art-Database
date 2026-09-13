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

## Still to do

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
7. Front page peels away on rotation — *"I want the front page to peel away upon
   rotating the token object like your ducking into the shadows of a tree,
   patterned in blues, upon escaping the beating light of day"*. Kept in the
   artist's words; the image is the brief. Rotation stops being a per-work
   control and becomes the page's own gesture: the front page gives way to
   something cooler and dappled behind it, carried by light and shadow rather
   than a slide or fade. Blocked until one thing is settled — **what the token
   object is**. Today's rotate control is a small button per collage; this reads
   as something singular and central that the visitor turns.

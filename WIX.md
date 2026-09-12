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

`MEDIA_IMAGE`, not `IMAGE` — Harmony sites reject `IMAGE`.

The caption order matches the reference page: artist, *title* and year, medium and
dimensions, availability.

### Current rows

| Order | Title | Year | Dimensions | Image |
| --- | --- | --- | --- | --- |
| 1 | Amadeus | 2025 | — | — |
| 2 | i | 2024 | — | — |
| 3 | Collage with Portraits | 2024 | — | — |
| 4 | NYNY | 2025 | — | — |
| 5 | HEY AMATEUR: COLLAGE | 2026 | — | — |

Dimensions and images are deliberately empty. The photographs in `docs/images/`
are placeholders, so nothing was uploaded to Wix Media yet — that happens once,
with the real documentation.

## Still to do

1. Connect the collection to a repeater on the home page. This is editor work:
   the Harmony page structure is not writable through the REST API.
2. Upload the real photographs to Wix Media and set each row's `image`.
3. Fill in `dimensions`, the statement, and a real contact email.
4. Add the sixth work.
5. Remove **Wix Hotels**, which the site generator installed for no reason.

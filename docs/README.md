# Site

One page. No build step, no dependencies, no JavaScript — open `index.html` in a
browser and it works. GitHub Pages serves this folder as-is.

```
docs/
  index.html    the live portfolio — served at /
  styles.css
  works.json    the works, as data
  images/       shared by both copies
  v2/
    index.html  a working copy — served at /v2/
    styles.css
  .nojekyll     stop Pages from running Jekyll over the folder
```

## Two copies

`/` is the portfolio in use. `/v2/` is a duplicate to experiment in, so the live
one stays stable while a redesign is in progress. Both deploy on every push.

They share `docs/images/` — v2 reaches it as `../images/`. Same photographs, no
reason to carry a second copy. Give v2 its own folder if the two ever need
different pictures.

**They are forked.** `scripts/build_page.py` renders only `/`. `docs/v2/` is
hand-edited from here on — it is where the site is being redesigned, while `/`
stays as it was submitted to an open call.

That means a change to `works.json` (a new work, a corrected year) now reaches
`/` only. Until the redesign lands, anything that should appear on both has to be
made in both places.

## The work grid

Works are data. `docs/works.json` holds them; `scripts/build_page.py` renders
`docs/index.html` from it. Edit the JSON, re-run the script — don't hand-edit the
HTML, it gets overwritten.

```bash
python3 scripts/build_page.py
```

The JSON mirrors the Wix `Works` collection (see the root `WIX.md`) so the two
stay comparable. A work's `slug` is also its image filename: `docs/images/<slug>.jpg`.

Cards follow Artsy's format, in Artsy's order:

```
Matthew Livingston          artist
Boston Spring, 2026         title (italic), year
Collage                     medium, dimensions
Contact for price           availability
Collages are wired ...      note (collages only)
```

## Dimensions

**The longest side is stated first**, not height then width. The collages hang in
any of four orientations, so they have no fixed way up and "height" and "width"
would describe only how the work happened to be photographed.

`scripts/build_page.py` enforces this: it parses the two measurements and refuses
to build if the shorter one comes first, because a reversed pair is invisible on
the page — it just quietly misdescribes the work.

Whole numbers are bound to their fractions with a non-breaking space so `30 1/4`
cannot split across a line.

## Rotation

Each collage carries a rotate button that turns its image a quarter turn per
click, because the works are wired to hang in any of four orientations.

Two things make it work. The frame is square, so a portrait image sized to fit
inside it still fits when turned ninety degrees — the grid never reflows and
neighbouring cards don't move. And the image is absolutely positioned inside that
frame: in normal flow it would stretch the frame to its own height, leaving the
height indefinite, and a percentage `max-height` against an indefinite height
resolves to `none` — the image then sizes to full width and rotating it spills
into the next column.

Rotation is per-image and resets on reload. Only works whose `category` is
`Collage` get the control.

## Orientation voting

Each collage opens at a random one of its four orientations. A viewer turns it to
the one they prefer and confirms; the choice posts to a Google Form.

**Orientations are numbered 1-4 against the photograph**, not against what the
viewer happened to open on:

| Number | Meaning |
| --- | --- |
| 1 | the image file as shot |
| 2 | a quarter turn clockwise |
| 3 | a half turn |
| 4 | three quarters clockwise |

So orientation 3 of *Amadeus* is the same picture for everyone, whichever
orientation their page opened on. The randomness moves where a viewer starts, not
what the number means.

Two consequences worth remembering:

- The numbers are meaningful only relative to the current photograph. **Re-shooting
  a work in a different framing invalidates its existing votes**, because the same
  number would then point at a different side.
- A vote is remembered per browser, so one person can vote again from another
  device. Read the totals as a feel, not a tally.

Adding `?reset` to the page's address clears **this browser's** record of what it
has voted on, so the same person can vote again. It touches nothing else —
responses already sent to the form are untouched, and other visitors are
unaffected. The parameter removes itself from the address bar afterwards.

Set `vote.formId` in `works.json` to empty to remove the control entirely.

The voting JavaScript is emitted from a **raw** Python string in
`scripts/build_page.py`. It has to be: in a plain string Python eats the
backslash escapes meant for JavaScript, and `\b` silently became a backspace
byte that broke the reset regex without any error.

## Preview locally

```bash
python3 -m http.server -d docs 8000   # then open http://localhost:8000
```

## Preview as an Artifact

The Artifact tool supplies its own `<head>`/`<body>` and can't fetch `styles.css`
alongside the page, so it needs a flattened copy. `docs/` stays the source of truth:

```bash
python3 scripts/build_artifact.py      # writes build/artifact.html
```

Re-run it and re-publish after any edit.

## Publishing

Deployed by `.github/workflows/pages.yml`, which uploads this folder to GitHub
Pages on every push to the working branch.

**Pages has to be switched on once by hand.** The workflow tries
(`configure-pages` with `enablement: true`) and is refused —
`Create Pages site failed. Error: Resource not accessible by integration` —
because creating a Pages site is a repo-admin action the Actions token can't
perform. Turn it on at **Settings → Pages → Source: GitHub Actions**, then re-run
the workflow; every push deploys after that.

The site then serves at `https://9gn957ptsb-alt.github.io/Color-Middling/`.

For a custom domain, add a `CNAME` file in this folder containing only the domain,
and point DNS at GitHub:

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` |
| `CNAME` | `www` | `<user>.github.io` |

## Next

The Artsy saves database (see the root `README.md`) is not exhibited on this page —
none of those works are shown here. It stays a separate reference project.

# Site

One page. No build step, no dependencies, no JavaScript — open `index.html` in a
browser and it works. GitHub Pages serves this folder as-is.

```
docs/
  index.html    masthead, work grid, colophon
  styles.css    all styling (palette and type scale in the :root block)
  images/       artwork images go here
  .nojekyll     stop Pages from running Jekyll over the folder
```

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

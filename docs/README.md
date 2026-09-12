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

Cards follow Artsy's format, in Artsy's order:

```
Color Middling              artist
Half Light, 2024            title (italic), year
Oil on linen, 40 × 30 in    medium, dimensions
Contact for price           availability
```

The grid is CSS masonry (`columns`), so images keep their own aspect ratio instead
of being cropped to a uniform box. All eight works are placeholders; each plate is
labelled with the filename it expects.

**To fill one in:** drop the image in `images/`, then replace the placeholder

```html
<div class="plate plate--empty" style="--ar: 4 / 5;">…</div>
```

with

```html
<img class="plate" src="images/01.jpg" alt="Half Light, 2024">
```

A real image needs no `--ar` — it takes its own shape.

**When adding or removing works,** note that CSS columns fill sequentially, so each
adjacent pair of entries lands in the same column. Alternating tall and short keeps
the columns ending at roughly the same height; a run of tall works leaves a void
under the short columns. Update the count in the `Works` heading too.

## Still placeholder

`Color Middling` (title, masthead, every card), `you@example.com`, `Studio in City`,
the statement, and all eight captions. `grep -rn "example.com\|Color Middling" docs/`
finds the first two.

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

Repo **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder
`/docs`. For a custom domain, add a `CNAME` file here containing only the domain
(e.g. `example.com`), then point DNS at GitHub:

| Record | Name | Value |
| --- | --- | --- |
| `A` | `@` | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` |
| `CNAME` | `www` | `<user>.github.io` |

Enable **Enforce HTTPS** once the certificate is issued (can take up to an hour).

## Next

The Artsy saves database (see the root `README.md`) is not exhibited on this page —
none of those works are shown here. It stays a separate reference project.

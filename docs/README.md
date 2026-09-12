# Site

A static site. Four files, no build step, no dependencies — open `index.html` in a
browser and it works. GitHub Pages serves this folder as-is.

```
docs/
  index.html    home + selected work
  about.html    statement + contact
  styles.css    all styling (CSS variables at the top)
  images/       artwork images go here
  .nojekyll     stop Pages from running Jekyll over the folder
```

## Make it yours

Three things to change before anything else:

1. **Name** — `Artist Name` appears in the `<title>`, masthead and footer of both pages.
   `grep -rn "Artist Name" docs/` finds every instance.
2. **Email** — `you@example.com`, same two files.
3. **Works** — replace the three placeholder `<li class="work">` entries in
   `index.html`. Drop an image in `docs/images/` and swap the placeholder
   `<div class="plate"></div>` for:

   ```html
   <img class="plate" src="images/your-file.jpg" alt="Description of the work">
   ```

Colours, fonts and measure are CSS variables in the first block of `styles.css`.

## Preview locally

```bash
python3 -m http.server -d docs 8000   # then open http://localhost:8000
```

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

The plan is to fold in the Artsy saves database (see the root `README.md`) as a
second section once it has data — an *influences* or *collection* page sitting
behind the portfolio, generated into static HTML rather than fetched at runtime.

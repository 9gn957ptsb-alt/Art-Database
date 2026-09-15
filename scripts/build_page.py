#!/usr/bin/env python3
"""Render docs/index.html from docs/works.json.

The page was hand-edited once too often. Works now live as data, mirroring the
Wix Works collection, and this renders them. Edit works.json, re-run this.

Usage:
    python3 scripts/build_page.py
"""

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "works.json"
OUT = ROOT / "docs" / "index.html"

# v2 is a working copy of the same page, served at /v2/. While the two are meant
# to stay identical, both are generated from here so a change lands in both. When
# v2 starts to diverge, drop it from TARGETS and hand-edit it from then on.
V2 = ROOT / "docs" / "v2"


def e(s):
    return html.escape(str(s), quote=True)


def card(w, artist, notes):
    """One work. Collages carry a rotate control because they are hung in any
    of four orientations; the note says so."""
    rotatable = w["category"] == "Collage"

    details = ", ".join(p for p in (w["medium"], w["dimensions"]) if p)

    control = ""
    if rotatable:
        control = (
            f'\n          <button class="rotate" type="button"'
            f' data-title="{e(w["title"])}"'
            f' aria-label="Rotate {e(w["title"])} a quarter turn clockwise">'
            f'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            f'<path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>'
            f'</svg></button>'
        )

    note_line = "".join(
        f'\n            <span class="note">{e(n)}</span>' for n in (notes if rotatable else [])
    )

    return f"""      <li class="work">
        <figure>
          <div class="frame">
          <img class="plate" src="images/{e(w["slug"])}.jpg" alt="{e(w["alt"])}." loading="lazy">{control}
          </div>
          <figcaption>
            <span class="artist">{e(artist)}</span>
            <span class="title"><em>{e(w["title"])}</em>, {e(w["year"])}</span>
            <span class="details">{e(details)}</span>
            <span class="price">{e(w["availability"])}</span>{note_line}
          </figcaption>
        </figure>
      </li>"""


def build():
    d = json.loads(DATA.read_text())
    artist, works = d["artist"], d["works"]
    notes = d.get("notes", {})

    cards = "\n".join(card(w, artist, notes.get(w["category"], [])) for w in works)
    rotatable = any(w["category"] == "Collage" for w in works)

    script = ""
    if rotatable:
        script = """
<script>
// Each collage hangs in any of four orientations, so the page opens each one at a
// random quarter turn and the button steps through the rest. The first turn is
// applied with the transition suppressed, otherwise every image visibly spins
// once on load.
document.querySelectorAll(".work").forEach(function (work) {
  var image = work.querySelector(".plate");
  var button = work.querySelector(".rotate");
  if (!image || !button) return;

  var turns = Math.floor(Math.random() * 4);

  function apply() {
    image.style.transform = "rotate(" + turns * 90 + "deg)";
    button.setAttribute("aria-label",
      "Rotate " + button.dataset.title + " a quarter turn clockwise (currently " +
      turns * 90 + " degrees)");
  }

  image.style.transition = "none";
  apply();
  requestAnimationFrame(function () { image.style.transition = ""; });

  button.addEventListener("click", function () {
    turns = (turns + 1) % 4;
    apply();
  });
});
</script>"""

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(artist)}</title>
<meta name="description" content="{e(d["lede"])}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500&family=Newsreader:ital,wght@0,400;1,400&display=swap">
<link rel="stylesheet" href="styles.css">
</head>
<body>

<div class="page">

  <header class="masthead">
    <h1>{e(artist)}</h1>
  </header>

  <main>
    <h2 class="label">Works <span class="count">{len(works)}</span></h2>
    <ul class="grid">
{cards}
    </ul>
  </main>

  <section class="statement-block">
    <h2 class="label">Statement</h2>
    <p>{e(d["statement"])}</p>
  </section>

  <footer class="colophon">
    <div>
      <h2>Contact</h2>
      <p><a href="mailto:{e(d["email"])}">{e(d["email"])}</a></p>
    </div>
  </footer>

</div>
{script}
</body>
</html>
"""


def write_all():
    html = build()
    OUT.write_text(html)
    written = [OUT]

    if V2.is_dir():
        # v2 sits one level down, so it reaches the shared images by going up.
        (V2 / "index.html").write_text(html.replace('src="images/', 'src="../images/'))
        (V2 / "styles.css").write_text((ROOT / "docs" / "styles.css").read_text())
        written += [V2 / "index.html", V2 / "styles.css"]

    return written


if __name__ == "__main__":
    for f in write_all():
        print(f"{f.relative_to(ROOT)} ({f.stat().st_size:,} bytes)")

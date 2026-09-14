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


def e(s):
    return html.escape(str(s), quote=True)


def card(w, artist, note):
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

    note_line = ""
    if rotatable and note:
        note_line = f'\n            <span class="note">{e(note)}</span>'

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

    cards = "\n".join(card(w, artist, notes.get(w["category"])) for w in works)
    rotatable = any(w["category"] == "Collage" for w in works)

    script = ""
    if rotatable:
        script = """
<script>
// Collages hang in any of four orientations. Each rotate button turns its own
// image a quarter turn; the square frame means every orientation fits without
// the grid reflowing.
document.querySelectorAll(".rotate").forEach(function (button) {
  var image = button.parentElement.querySelector(".plate");
  var turns = 0;
  button.addEventListener("click", function () {
    turns = (turns + 1) % 4;
    image.style.transform = "rotate(" + turns * 90 + "deg)";
    button.setAttribute("aria-label",
      "Rotate " + button.dataset.title + " a quarter turn clockwise" +
      (turns ? " (currently turned " + turns * 90 + " degrees)" : ""));
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
    <p>{e(d["lede"])}</p>
  </header>

  <main>
    <h2 class="label">Works <span class="count">{len(works)}</span></h2>
    <ul class="grid">
{cards}
    </ul>
  </main>

  <footer class="colophon">
    <div>
      <h2>Statement</h2>
      <p class="statement">{e(d["statement"])}</p>
    </div>
    <div>
      <h2>Contact</h2>
      <p><a href="mailto:{e(d["email"])}">{e(d["email"])}</a></p>
      <p>Studio visits by appointment.</p>
    </div>
    <div>
      <h2>Colophon</h2>
      <p>Works are documented in the studio. Dimensions available on request.</p>
    </div>
  </footer>

</div>
{script}
</body>
</html>
"""


if __name__ == "__main__":
    OUT.write_text(build())
    print(f"{OUT} ({OUT.stat().st_size:,} bytes)")

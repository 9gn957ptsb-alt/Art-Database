#!/usr/bin/env python3
"""Render the page as ONE self-contained HTML file, images inlined.

Wix's design import wants a single file it can fetch over HTTPS with everything
embedded — no relative image paths, no separate stylesheet. This produces that.

Images are re-encoded smaller on the way in: the inlined base64 is ~1.37x the
file size, and the whole document has to travel as one request.

Usage:
    python3 scripts/build_standalone.py [outfile] [--max-px 1000] [--quality 80]
"""

import argparse
import base64
import io
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "index.html"
CSS = ROOT / "docs" / "styles.css"
IMAGES = ROOT / "docs" / "images"


def data_uri(path, max_px, quality):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_px / max(w, h))
    if scale < 1.0:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def build(max_px, quality):
    html = SRC.read_text()
    css = CSS.read_text()

    # Inline the stylesheet in place of its <link>.
    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        f"<style>\n{css}\n</style>",
    )

    # Inline every image referenced from images/.
    def swap(m):
        name = m.group(1)
        return f'src="{data_uri(IMAGES / name, max_px, quality)}"'

    html = re.sub(r'src="images/([^"]+)"', swap, html)

    # The live-site bar points at Wix; inside a Wix site it would link to itself.
    html = re.sub(r'\s*<p class="live">.*?</p>', "", html, flags=re.S)

    return html


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", default=str(ROOT / "build" / "standalone.html"))
    ap.add_argument("--max-px", type=int, default=1000)
    ap.add_argument("--quality", type=int, default=80)
    a = ap.parse_args()

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build(a.max_px, a.quality))
    print(f"{out}  {out.stat().st_size/1024/1024:.2f} MB")

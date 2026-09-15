#!/usr/bin/env python3
"""Turn docs/index.html into a page the Artifact tool can publish.

The Artifact tool wraps what it is given in its own <!doctype>/<head>/<body>,
so it wants body content only, and it cannot fetch styles.css alongside the
page. This inlines the stylesheet and strips the skeleton, leaving docs/ as the
single source of truth for the site.

Usage:
    python3 scripts/build_artifact.py [outfile]
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "index.html"
CSS = ROOT / "docs" / "styles.css"


def build():
    html = SRC.read_text()

    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
    fonts = re.findall(r'<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>', html)
    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1).strip()

    # Artifacts block outbound fetch under their content-security policy, so a
    # vote posted from here is swallowed with no error — and since the response
    # was never readable, the button would still report success. Strip the
    # control rather than ship one that silently records nothing. Voting belongs
    # to the deployed site.
    body = re.sub(r'\s*<button class="vote"[^>]*>.*?</button>', "", body, flags=re.S)
    body = re.sub(r'\s*<script>\s*\(function \(\)[^<]*?var FORM =.*?</script>', "", body, flags=re.S)

    parts = [f"<title>{title}</title>"]
    parts += fonts
    parts.append(f"<style>\n{CSS.read_text().strip()}\n</style>")
    parts.append(body)
    return "\n".join(parts) + "\n"


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "build" / "artifact.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build())
    print(f"{out} ({out.stat().st_size:,} bytes)")

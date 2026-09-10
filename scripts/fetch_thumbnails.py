#!/usr/bin/env python3
"""Download every work's image and inline it as a WebP data URI.

Published artifacts block external images under CSP, so the browser page cannot
load Artsy's CDN at runtime — the thumbnails have to ship inside the HTML. That
puts them on a hard budget: the page must stay under 16MB including the ~1.4MB of
metadata, and base64 inflates every byte by 4/3. Hence WebP, and hence small.

Needs `d32dm0rphc51dk.cloudfront.net` on the environment's allowed domains.

Usage:
    python3 scripts/fetch_thumbnails.py --probe     # 40 works, to size the budget
    python3 scripts/fetch_thumbnails.py             # all of them
    python3 scripts/fetch_thumbnails.py --edge 72 --quality 50
"""

import argparse
import base64
import io
import json
import sqlite3
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT = ROOT / "data" / "thumbs.json"

WORKERS = 16
TIMEOUT = 30


def source_urls(image_url):
    """Prefer a small source version; the stored URL is the fallback."""
    urls = []
    for version in ("small", "medium"):
        for stored in ("large", "normalized", "medium", "large_rectangle", "square"):
            if "/" + stored + ".jpg" in image_url:
                urls.append(image_url.replace("/" + stored + ".jpg", "/" + version + ".jpg"))
                break
    urls.append(image_url)
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def fetch_one(session, artwork_id, image_url, edge, quality):
    for url in source_urls(image_url):
        try:
            response = session.get(url, timeout=TIMEOUT)
        except requests.exceptions.ProxyError as exc:
            return artwork_id, None, f"proxy refused {url}: {exc}"
        except requests.RequestException:
            continue
        if not response.ok:
            continue
        try:
            img = Image.open(io.BytesIO(response.content))
            img = img.convert("RGB")
            img.thumbnail((edge, edge), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=quality, method=6)
            encoded = base64.b64encode(buf.getvalue()).decode("ascii")
            return artwork_id, "data:image/webp;base64," + encoded, None
        except Exception as exc:  # a corrupt or unsupported payload, not a fatal run
            return artwork_id, None, f"decode failed {url}: {exc}"
    return artwork_id, None, "no version fetched"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true", help="only 40 works, then report sizing")
    parser.add_argument("--edge", type=int, default=88, help="longest edge in px (default 88)")
    parser.add_argument("--quality", type=int, default=58, help="WebP quality (default 58)")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found. Run scripts/normalize_artsy_saves.py first.")

    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT id, image_url FROM artworks WHERE image_url IS NOT NULL ORDER BY id"
    ).fetchall()
    conn.close()

    if args.probe:
        rows = rows[::max(1, len(rows) // 40)][:40]

    thumbs, failures = {}, []
    with requests.Session() as session:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [
                pool.submit(fetch_one, session, rid, url, args.edge, args.quality)
                for rid, url in rows
            ]
            for i, future in enumerate(futures, 1):
                artwork_id, data_uri, err = future.result()
                if data_uri:
                    thumbs[artwork_id] = data_uri
                else:
                    failures.append((artwork_id, err))
                if i % 250 == 0 or i == len(futures):
                    print(f"  {i}/{len(futures)} ({len(failures)} failed)", flush=True)

    if not thumbs:
        sys.exit(
            "Nothing downloaded. If this reports a refused proxy connection, add\n"
            "d32dm0rphc51dk.cloudfront.net to the environment's allowed domains.\n"
            + (f"First error: {failures[0][1]}" if failures else "")
        )

    total = sum(len(v) for v in thumbs.values())
    avg = total / len(thumbs)
    print(f"\n{len(thumbs)} thumbnails at edge={args.edge} quality={args.quality}")
    print(f"average {avg:,.0f} bytes  ·  total {total / 1_000_000:.2f} MB of base64")
    print(f"projected page: {(total + 1_400_000) / 1_000_000:.2f} MB against a 16 MB limit")
    if failures:
        print(f"{len(failures)} failed; first: {failures[0]}")

    if args.probe:
        projected = avg * 4968
        print(f"\nPROBE — full run projects {projected / 1_000_000:.2f} MB of images, "
              f"{(projected + 1_400_000) / 1_000_000:.2f} MB page")
        return

    OUT.write_text(json.dumps(thumbs, separators=(",", ":")))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Fetch each building's photographs from its public article, for modelling.

For every building in docs/v2/architecture.json this downloads the article's
photographs (the magazine's public image server) into
data/photos/<slug>/NN.jpg, at most 1000 px, with contact sheets of six
(sheetN.jpg) and the article's text (article.txt). data/ is gitignored: the
photographs are reference for the models only and never enter the repository
or the site.

    python3 scripts/fetch_reference_photos.py [--only slug]
"""

import argparse
import html
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BUILDINGS = ROOT / "docs" / "v2" / "architecture.json"
OUT = ROOT / "data" / "photos"
IMAGES = r"https://s3\.amazonaws\.com/api\.thelocalproject/public/Articles/[^\"'\s\\]+?\.(?:jpe?g|png|webp)"


def one(session, b):
    d = OUT / b["slug"]
    d.mkdir(parents=True, exist_ok=True)
    page = session.get(b["url"], timeout=60).text
    urls = []
    for u in re.findall(IMAGES, page, re.I):
        if u not in urls and "ogimage" not in u:
            urls.append(u)
    photos = []
    for i, u in enumerate(urls[:24]):
        path = d / f"{i:02d}.jpg"
        if not path.exists():
            try:
                im = Image.open(io.BytesIO(session.get(u, timeout=60).content)).convert("RGB")
            except (requests.RequestException, OSError):
                continue
            im.thumbnail((1000, 1000))
            im.save(path, quality=82)
        photos.append(path)

    paras = [html.unescape(re.sub("<[^>]+>", "", p)).strip()
             for p in re.findall(r"<p[^>]*>(.*?)</p>", page, re.S)]
    (d / "article.txt").write_text(
        b["title"] + "\n" + b.get("where", "") + "\n\n" +
        "\n\n".join(p for p in paras if len(p) > 80), encoding="utf-8")

    for s in range(0, len(photos), 6):
        chunk = photos[s:s + 6]
        sheet = Image.new("RGB", (1500, 375 * ((len(chunk) + 2) // 3)), "white")
        for k, path in enumerate(chunk):
            im = Image.open(path)
            im.thumbnail((500, 375))
            sheet.paste(im, ((k % 3) * 500, (k // 3) * 375))
        sheet.save(d / f"sheet{s // 6}.jpg", quality=80)
    return f"  {b.get('name', b['slug'])}: {len(photos)} photos"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only")
    args = parser.parse_args()
    buildings = json.loads(BUILDINGS.read_text(encoding="utf-8"))["buildings"]
    if args.only:
        buildings = [b for b in buildings if b["slug"] == args.only]
    session = requests.Session()
    with ThreadPoolExecutor(6) as pool:
        for line in pool.map(lambda b: one(session, b), buildings):
            print(line)


if __name__ == "__main__":
    main()

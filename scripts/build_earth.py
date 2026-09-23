"""Turn the world's coastlines into a mask the land can be woven from.

The globe is the Earth now. Its shape comes from Natural Earth's 50m land
outlines, which are public domain; its colour still comes from the artist's
works, as everything else here does.

A hundred and thirty thousand dots cannot each be tested against a hundred
coastline polygons in a browser, so the outlines are rasterised here, once,
into a bitmap of land and sea — 1440 by 720, a quarter of a degree a cell,
finer than the dots the globe is woven from, so every coastline is where it
is. Packed to bits and base64'd it is about 170 kilobytes.

Column 0 is 180 W and row 0 is 90 N; land.js reads it from there.

    python3 scripts/build_earth.py

Reads data/ne_50m_land.geojson, downloading it if it is not there, and
writes docs/v2/earth.json. The download is gitignored like everything else in
data/; only the mask is committed.
"""

import base64
import json
import pathlib
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent.parent
SOURCE = HERE / "data" / "ne_50m_land.geojson"
OUT = HERE / "docs" / "v2" / "earth.json"
URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
       "master/geojson/ne_50m_land.geojson")

W, H = 1440, 720



def rings(geo):
    """Every outer and inner ring in the file, as lists of (lon, lat)."""
    for feature in geo["features"]:
        shape = feature["geometry"]
        parts = ([shape["coordinates"]] if shape["type"] == "Polygon"
                 else shape["coordinates"])
        for polygon in parts:
            for ring in polygon:
                yield ring


def raster():
    """Scanline fill, even-odd: for each row of the mask, find where the
    coastline crosses it and fill between the crossings."""
    if not SOURCE.exists():
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        print("fetching", URL)
        urllib.request.urlretrieve(URL, SOURCE)

    geo = json.loads(SOURCE.read_text())
    edges = []
    for ring in rings(geo):
        for i in range(len(ring) - 1):
            lon0, lat0 = ring[i][0], ring[i][1]
            lon1, lat1 = ring[i + 1][0], ring[i + 1][1]
            x0 = (lon0 + 180.0) / 360.0 * W
            y0 = (90.0 - lat0) / 180.0 * H
            x1 = (lon1 + 180.0) / 360.0 * W
            y1 = (90.0 - lat1) / 180.0 * H
            if y0 != y1:
                edges.append((x0, y0, x1, y1))

    # Each edge is dropped into the rows it crosses, so a row only looks at
    # the edges that actually cross it.
    rows = [[] for _ in range(H)]
    for x0, y0, x1, y1 in edges:
        lo, hi = min(y0, y1), max(y0, y1)
        for row in range(max(0, int(lo - 0.5)), min(H, int(hi + 0.5) + 1)):
            y = row + 0.5
            if (y0 <= y < y1) or (y1 <= y < y0):
                rows[row].append(x0 + (y - y0) / (y1 - y0) * (x1 - x0))

    grid = bytearray(W * H)
    for row in range(H):
        cuts = sorted(rows[row])
        for i in range(0, len(cuts) - 1, 2):
            a = max(0, int(cuts[i] + 0.5))
            b = min(W, int(cuts[i + 1] + 0.5))
            grid[row * W + a:row * W + b] = b"\x01" * max(0, b - a)
    return grid


def main():
    grid = raster()
    packed = bytearray((W * H + 7) // 8)
    land = 0
    for i, v in enumerate(grid):
        if v:
            land += 1
            packed[i >> 3] |= 1 << (i & 7)

    OUT.write_text(json.dumps({
        "note": "Land and sea, from Natural Earth 50m (public domain). "
                "Rasterised by scripts/build_earth.py. One bit a cell, "
                "row-major from 180W 90N, packed little-endian and base64'd.",
        "w": W, "h": H,
        "bits": base64.b64encode(bytes(packed)).decode("ascii"),
    }))
    print("%d of %d cells are land (%.1f%%)" % (land, W * H, 100.0 * land / (W * H)))
    print("wrote %s, %d bytes" % (OUT, OUT.stat().st_size))


if __name__ == "__main__":
    main()

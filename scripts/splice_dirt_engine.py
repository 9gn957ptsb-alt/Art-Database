#!/usr/bin/env python3
"""Put DIRT Earth's engine (dirt/earth/engine/*.js) into the site's edition of
DIRT (docs/v2/dirt/index.html), exactly as `dirt/build_soil_viewer.py --site`
would, without rebuilding the rest of the page.

The full build needs DIRT's private plane (dirt/private/, not in this
repository), so a change to the engine alone is carried over by replacing
each engine script's body in place. After it, the page's scripts equal the
engine files byte for byte (with "</script" escaped, as the build does).

    python3 scripts/splice_dirt_engine.py [earth-main earth-city ...]
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "docs" / "v2" / "dirt" / "index.html"
ENGINE = ROOT / "dirt" / "earth" / "engine"
ALL = ("earth-common", "earth-city", "earth-main")


def main():
    names = sys.argv[1:] or ALL
    page = PAGE.read_text(encoding="utf-8")
    for name in names:
        tag = '<script id="%s">' % name
        a = page.index(tag) + len(tag)
        b = page.index("</script>", a)
        src = (ENGINE / (name + ".js")).read_text(encoding="utf-8").replace("</script", "<\\/script")
        changed = page[a:b] != src
        page = page[:a] + src + page[b:]
        print(f"{name}: {'spliced' if changed else 'already the same'}")
    PAGE.write_text(page, encoding="utf-8")


if __name__ == "__main__":
    main()

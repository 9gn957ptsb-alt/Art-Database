"""DRIFT's page with another engine: the published page, its ground-gl.js swapped for this repository's.

    python3 dirt/engine/splice.py PAGE ENGINE OUT [QUILTS]

PAGE is DRIFT's index.html as read back from the artifact (the Artifact tool's read saves it, wrapped in the skeleton
the artifact serves it in, which is taken off here, as build_poetry.py does: publishing adds it again). Everything but
the engine stays as published (the plane, the page's own scripts), so a change to ground-gl.js alone reaches DRIFT
without the full rebuild (dirt/artists/COWORKER.md step 4). OUT is published to DRIFT's url with no files.
QUILTS, a quilts.json, also puts the quilts' list into the page (QUILTS, which the full build takes from
dirt/private/quilts/quilts.json): then publish its quilt files with it, under quilts/.

The Glyph Light goes in with the engine (since 27 Oct 2026, when DRIFT's plane became a storyboard and its glyphs
came to change frame by frame along it): this repository's glyphlight.js into <script id="glyphlight">, and the
glyphs' loader, as build_soil_viewer.py's PAGE has it, into <script id="glyphs">, so a change to either needs no full
rebuild either. A page without those scripts keeps what it has.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from build_soil_viewer import PAGE  # noqa: E402  (the page's template: only its glyphs loader is taken)


def swap(page, name, body, need=True):
    """The page with the body of its one <script id=name> replaced by body (slices, not re.sub: the engine has
    backslashes)."""
    tag = f'<script id="{name}">'
    if page.count(tag) != 1:
        if need or page.count(tag):
            raise SystemExit(f"not DRIFT's page: no single {name} script")
        print(f"{name}: none in the page, left as it is")
        return page
    i = page.index(tag) + len(tag)
    j = page.index("</script>", i)
    print(f"{name} {j - i} -> {len(body)} characters")
    return page[:i] + body + page[j:]


page_path, engine_path, out_path = sys.argv[1:4]
page = open(page_path, encoding="utf-8").read()
if page.lstrip().lower().startswith("<!doctype html>") and "<body>" in page:
    page = page[page.index("<body>") + len("<body>"):].rstrip()
    if page.endswith("</body></html>"):
        page = page[:-len("</body></html>")]
    page = page.strip() + "\n"
if page.count('<script id="ground-gl">') != 1 or page.count("<title>DRIFT</title>") != 1:
    raise SystemExit("not DRIFT's page: no single engine script or title")
page = swap(page, "ground-gl", open(engine_path, encoding="utf-8").read().replace("</script", "<\\/script"))
page = swap(page, "glyphlight", (HERE / "glyphlight.js").read_text(encoding="utf-8").replace("</script", "<\\/script"), need=False)
tag = '<script id="glyphs">'
loader = PAGE[PAGE.index(tag) + len(tag):PAGE.index("</script>", PAGE.index(tag))]
page = swap(page, "glyphs", loader, need=False)
if len(sys.argv) > 4:
    at = page.index("const QUILTS = ") + len("const QUILTS = ")
    old, end = json.JSONDecoder().raw_decode(page, at)
    new = json.loads(open(sys.argv[4], encoding="utf-8").read())
    page = page[:at] + json.dumps(new, indent=1, ensure_ascii=False).replace("</", "<\\/") + page[end:]
    print(f"quilts {len(old or [])} -> {len(new)}")
open(out_path, "w", encoding="utf-8").write(page)

"""DRIFT's page with another engine: the published page, its ground-gl.js swapped for this repository's.

    python3 dirt/engine/splice.py PAGE ENGINE OUT [QUILTS]

PAGE is DRIFT's index.html as read back from the artifact (the Artifact tool's read saves it, wrapped in the skeleton
the artifact serves it in, which is taken off here, as build_poetry.py does: publishing adds it again). Everything but
the engine stays as published (the plane, the Glyph Light, the page's own scripts), so a change to ground-gl.js alone
reaches DRIFT without the full rebuild (dirt/artists/COWORKER.md step 4). OUT is published to DRIFT's url with no files.
QUILTS, a quilts.json, also puts the quilts' list into the page (QUILTS, which the full build takes from
dirt/private/quilts/quilts.json): then publish its quilt files with it, under quilts/.
"""
import json
import sys

page_path, engine_path, out_path = sys.argv[1:4]
page = open(page_path, encoding="utf-8").read()
if page.lstrip().lower().startswith("<!doctype html>") and "<body>" in page:
    page = page[page.index("<body>") + len("<body>"):].rstrip()
    if page.endswith("</body></html>"):
        page = page[:-len("</body></html>")]
    page = page.strip() + "\n"
tag = '<script id="ground-gl">'
if page.count(tag) != 1 or page.count("<title>DRIFT</title>") != 1:
    raise SystemExit("not DRIFT's page: no single engine script or title")
i = page.index(tag) + len(tag)
j = page.index("</script>", i)
engine = open(engine_path, encoding="utf-8").read().replace("</script", "<\\/script")
page = page[:i] + engine + page[j:]                                  # slices, not re.sub: the engine has backslashes
print(f"engine {j - i} -> {len(engine)} characters")
if len(sys.argv) > 4:
    at = page.index("const QUILTS = ") + len("const QUILTS = ")
    old, end = json.JSONDecoder().raw_decode(page, at)
    new = json.loads(open(sys.argv[4], encoding="utf-8").read())
    page = page[:at] + json.dumps(new, indent=1, ensure_ascii=False).replace("</", "<\\/") + page[end:]
    print(f"quilts {len(old or [])} -> {len(new)}")
open(out_path, "w", encoding="utf-8").write(page)

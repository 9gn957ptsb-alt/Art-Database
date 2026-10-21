#!/usr/bin/env python3
"""Keep residential/bookmarks.json in step with the artist's Architectural Authority bookmarks,
and list the residential ones that have no project file yet.

The bookmarks reach the repo through the hourly buildings intake on the site branch, which
writes them to docs/v2/architecture.json there. Each new one's category is read from its
public AA page (the label before "SERIES" on the page, e.g. "Residential").

    git fetch origin claude/artist-website-dev-s92irf
    python3 residential/tools/sync_bookmarks.py [--ref REF] [--max N] [--claim WHO]

Prints one JSON line per residential bookmark still waiting for a model (slug, name, url,
where), which is what the research workflow takes. A bookmark someone is already working on
carries "claimed" (a date) and is left out for three days; --claim WHO marks the ones printed,
so two sessions never research the same project, and a claim that is never finished lapses.
"""
import datetime
import html
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
BOOKMARKS = ROOT / "bookmarks.json"


def aa_category(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    s = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    txt = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S)
    txt = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", txt)))
    m = re.search(r"Sign Up\s+(?:\d+\s+)*([A-Za-z&/ ,\-]+?)\s+SERIES", txt)
    return m.group(1).strip() if m else None


CLAIM_DAYS = 3


def main(*argv):
    ref = argv[argv.index("--ref") + 1] if "--ref" in argv else "origin/claude/artist-website-dev-s92irf"
    limit = int(argv[argv.index("--max") + 1]) if "--max" in argv else None
    who = argv[argv.index("--claim") + 1] if "--claim" in argv else None
    feed = json.loads(subprocess.check_output(["git", "-C", str(REPO), "show", f"{ref}:docs/v2/architecture.json"]))
    known = {b["slug"]: b for b in json.loads(BOOKMARKS.read_text())} if BOOKMARKS.exists() else {}
    today = datetime.date.today().isoformat()
    added = 0
    for b in feed["buildings"]:
        if b.get("hand") or b["slug"] in known:
            continue
        try:
            cat = aa_category(b["url"])
        except Exception as e:                       # leave it unknown; the next run retries
            print(f"warning: {b['slug']}: {e}", file=sys.stderr)
            continue
        known[b["slug"]] = {"slug": b["slug"], "name": b["name"], "url": b["url"], "where": b.get("where", ""),
                            "category": cat, "first_seen": today}
        added += 1
        time.sleep(0.8)
    feed_slugs = {b["slug"] for b in feed["buildings"]}
    for b in known.values():
        b["in_feed"] = b["slug"] in feed_slugs      # a bookmark the artist removed stays, marked
    residential = [b for b in known.values() if b["category"] == "Residential" and b["in_feed"]]
    waiting = [b for b in residential if not (ROOT / "projects" / f"{b['slug']}.json").exists()]
    lapse = (datetime.date.today() - datetime.timedelta(days=CLAIM_DAYS)).isoformat()
    pending = [b for b in waiting if not b.get("claimed") or b["claimed"] < lapse][:limit]
    if who:
        for b in pending:
            b["claimed"], b["claimed_by"] = today, who
    for b in known.values():
        if (ROOT / "projects" / f"{b['slug']}.json").exists():
            b.pop("claimed", None)
            b.pop("claimed_by", None)
    BOOKMARKS.write_text(json.dumps(sorted(known.values(), key=lambda b: (b["first_seen"], b["slug"])),
                                    indent=1, ensure_ascii=False) + "\n")
    print(f"{len(known)} bookmarks ({added} new), {len(residential)} residential, {len(waiting)} without a model, "
          f"{len(waiting) - len([b for b in waiting if not b.get('claimed') or b['claimed'] < lapse])} of them claimed",
          file=sys.stderr)
    for b in pending:
        print(json.dumps({k: b[k] for k in ("slug", "name", "url", "where")}, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:])

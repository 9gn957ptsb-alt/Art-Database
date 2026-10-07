#!/usr/bin/env python3
"""Bloomberg Connects: each museum's own guide, and the address of it.

The artist, 7 Oct 2026, of Bloomberg Connects (Bloomberg Philanthropies' free app of digital
guides made by museums, galleries, gardens and historic sites themselves): "It is a great example
of how I want to set up connections with museums and galleries regarding historical narratives or
contemporary talks on art", and of whether its stops should link out or stay on the site: "Link
them for now to the Bloomberg site". A guide's web version is
https://guides.bloombergconnects.org/en-US/guide/<guideId>.

Bloomberg's own sites are never read: guides.bloombergconnects.org's robots.txt forbids every
robot, and www.bloombergconnects.org (its directory of guides, /guides/) sits behind bot
protection. So the address of a guide is only ever taken verbatim from where an institution
publishes it:

  scripts/bloomberg_hand.json   the searches, by hand: for each museum of the site (museums.json,
                                and the Folger) and some of the cities' venues, whether a guide is
                                evidenced, the evidence, the address where one was seen (and where),
                                and the institution's own pages that may give it ("pages").
  data/bloomberg/               this script's cache (gitignored): every institution page read,
                                raw, and seen.json, what each gave.

Each run reads the institutions' own pages listed in the hand table (robots.txt checked first,
host by host; paced, never more than one request every PACE seconds to a host, longer where the
site asks), and takes the Bloomberg Connects links found there verbatim — a
guides.bloombergconnects.org link first (a link into the guide is taken to the guide's root:
the same locale and the same id, cut after them), else Bloomberg's app link. A page that
redirects to its guide gives the address too (taken from the redirect, never followed); a redirect
to another site is not followed. An address found on the institution's own page replaces one seen
elsewhere; a page that gives none changes nothing.
A guide id is never made up or guessed: an entry with no address seen stays without one, and the
page shows nothing for it.

Then it writes docs/v2/bloomberg.json, public and small:

  {note, read, guides: {<museum slug | "folger" | "venue:<city key>:<venue name>">:
                          {name, url, seen[, holds]}}}

for every entry whose guide is evidenced (status "guide", or "unconfirmed" made sure by an
address on its own page): url the address (or null), seen where it (or, with none, the
evidence) was seen, holds what the guide holds in the institution's own description where that
was seen. The same hand table and cache give the same bytes.

  python3 scripts/fetch_bloomberg_guides.py              # read the institutions' pages, then build
  python3 scripts/fetch_bloomberg_guides.py --build      # build from the hand table and the cache, no network
  python3 scripts/fetch_bloomberg_guides.py --only museum-the-museum-of-modern-art

Weekly is enough (docs/v2/models/REFINE.md). A host the session refuses is said so and skipped;
nothing changes for it.
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "docs" / "v2"
HAND = ROOT / "scripts" / "bloomberg_hand.json"
OUT = V2 / "bloomberg.json"
CACHE = ROOT / "data" / "bloomberg"
SEEN = CACHE / "seen.json"
UA = "ArtistWebsiteGuides/1.0 (+https://9gn957ptsb-alt.github.io/Art-Database/v2/; reads a museum's own guide page once a week)"
PACE = 3.0                 # seconds between two requests to one host, at least
MAX_DELAY = 30.0           # a crawl-delay longer than this: the host is left for another week
TIMEOUT = 40

# Bloomberg's own hosts: never read (robots.txt, bot protection). Their links are only taken from others' pages.
BLOOMBERG = re.compile(r"(^|\.)bloombergconnects\.org$", re.I)
# A link to a guide, as an institution publishes it.
LINK = re.compile(r"https?://(?:guides|app|links)\.bloombergconnects\.org/[^\s\"'<>\\)\]}]+", re.I)
GUIDE = re.compile(r"^https?://guides\.bloombergconnects\.org/([A-Za-z]{2}(?:-[A-Za-z]{2,4})?)/guide/([A-Za-z0-9_-]+)", re.I)


def log(*a):
    print(*a, flush=True)


# ---- reading, politely ----------------------------------------------------------------------------

class Refused(Exception):
    """The session's proxy (or the network) would not reach the host."""


class Redirected(Exception):
    """A page that sends you on: to its guide on Bloomberg Connects (an address given by the
    museum itself: taken, never followed), or to another site (not followed: its robots.txt unread)."""
    def __init__(self, code, url):
        super().__init__(url)
        self.code, self.url = code, url


class _Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = (urllib.parse.urlsplit(newurl).hostname or "").lower()
        old = (urllib.parse.urlsplit(req.full_url).hostname or "").lower()
        if BLOOMBERG.search(new) or new.removeprefix("www.") != old.removeprefix("www."):
            raise Redirected(code, newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_open = urllib.request.build_opener(_Redirects).open
_last = {}
_robots = {}


def _wait(host, delay):
    gap = max(PACE, delay) - (time.time() - _last.get(host, 0.0))
    if gap > 0:
        time.sleep(gap)
    _last[host] = time.time()


def _get(url, host, delay=0.0):
    _wait(host, delay)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.5"})
    try:
        with _open(req, timeout=TIMEOUT) as r:
            body = r.read(4_000_000)
            charset = r.headers.get_content_charset() or "utf-8"
            return r.status, r.geturl(), body.decode(charset, "replace")
    except Redirected as e:
        return e.code, e.url, ""
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except urllib.error.URLError as e:
        raise Refused(str(e.reason))      # the session's proxy refused the host, or the network failed
    except (TimeoutError, OSError) as e:
        raise Refused(str(e))


def robots_for(scheme, netloc, host):
    """The host's robots.txt, read once a run; None when the host is refused."""
    key = scheme + "://" + netloc
    if key in _robots:
        return _robots[key]
    rp = urllib.robotparser.RobotFileParser()
    try:
        status, _, text = _get(key + "/robots.txt", host)
    except Refused as e:
        _robots[key] = None
        log("  host refused; nothing changed:", host, "(" + e.args[0][:80] + ")")
        return None
    if status in (401, 403) or status == 429 or status >= 500:
        rp.disallow_all = True              # a refusal, or the host unreachable: read as "not now" (RFC 9309)
    elif status >= 400:
        rp.allow_all = True                 # no robots.txt: nothing is asked of a robot
    else:
        rp.parse(text.splitlines())
    _robots[key] = rp
    return rp


def read_page(url):
    """One institution page: (status, final url, html) or None; never one of Bloomberg's own."""
    p = urllib.parse.urlsplit(url)
    host = p.hostname or ""
    if BLOOMBERG.search(host):
        log("  not read (Bloomberg's own site: robots.txt forbids it, or bot protection):", url)
        return None
    rp = robots_for(p.scheme or "https", p.netloc, host)
    if rp is None:
        return None
    if not rp.can_fetch(UA, url):
        log("  not read (its robots.txt asks robots not to):", url)
        return None
    delay = rp.crawl_delay(UA) or 0.0
    if delay > MAX_DELAY:
        log("  not read (its robots.txt asks for %ss between requests): %s" % (delay, url))
        return None
    try:
        return _get(url, host, float(delay))
    except Refused as e:
        log("  host refused; nothing changed:", url, "(" + e.args[0][:80] + ")")
        return None


def links_in(text):
    """Bloomberg Connects links in a page, verbatim and in order (entities undone, as a browser would)."""
    out = []
    for m in LINK.finditer(html.unescape(text).replace("\\/", "/")):
        u = m.group(0).rstrip(".,;:")
        if u not in out:
            out.append(u)
    return out


def guide_root(u):
    """A link into a guide, cut to the guide itself: the same locale and id, nothing after them."""
    m = GUIDE.match(u)
    return "https://guides.bloombergconnects.org/%s/guide/%s" % (m.group(1), m.group(2)) if m else None


def best_link(found):
    """From [(page, [links])]: the guide most linked (a guides.* address, counted by its id whatever
    the locale; ties, the first; its root as first linked), else an app link."""
    count, first = {}, {}
    for page, links in found:
        for u in links:
            m = GUIDE.match(u)
            if m:
                gid = m.group(2)
                count[gid] = count.get(gid, 0) + 1
                first.setdefault(gid, (len(first), page, u, guide_root(u)))
    if count:
        gid = sorted(count, key=lambda k: (-count[k], first[k][0]))[0]
        return first[gid][3], first[gid][1], first[gid][2]
    for page, links in found:
        for u in links:
            if "://app.bloombergconnects.org/" in u or "://links.bloombergconnects.org/" in u:
                return u, page, u
    return None


def fetch(hand, only):
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "pages").mkdir(exist_ok=True)
    seen = json.loads(SEEN.read_text()) if SEEN.exists() else {}
    today = dt.date.today().isoformat()
    entries = list(hand["museums"].items()) + list(hand["venues"].items())
    read_any = 0
    for key, e in entries:
        if only and key not in only:
            continue
        if e.get("status") not in ("guide", "unconfirmed") or not e.get("pages"):
            continue
        log(key)
        for url in e["pages"]:
            got = read_page(url)
            if not got:
                continue
            status, final, text = got
            name = hashlib.sha1(url.encode()).hexdigest()[:16] + ".html"
            if status == 200 and text:
                (CACHE / "pages" / name).write_text(text)
            links = links_in(text) if status == 200 else []
            if 300 <= status < 400 and LINK.match(final or ""):
                links = [final]                  # it sends you to its guide: the address as it gives it
            seen[url] = {"read": today, "status": status, "final": final, "file": name if status == 200 else None, "links": links}
            read_any += 1
            log("  %s %s · %d Bloomberg Connects link%s" % (status, url, len(links), "" if len(links) == 1 else "s"))
    SEEN.write_text(json.dumps(seen, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    if not read_any:
        log("No institution page could be read (their hosts are refused from this session): nothing changed.")
    return read_any


# ---- building --------------------------------------------------------------------------------------

def good(r):
    """A page read whole, or one that sent you on to its guide."""
    return r.get("status") == 200 or (300 <= (r.get("status") or 0) < 400 and bool(r.get("links")))


def build(hand):
    seen = json.loads(SEEN.read_text()) if SEEN.exists() else {}
    names = {m["slug"]: m["name"] for m in json.loads((V2 / "museums.json").read_text())["museums"]}
    names["folger"] = "Folger Shakespeare Library"     # land.js's LANDMARKS: it stands in Washington
    guides, read = {}, [hand.get("read", "")]
    for key, e in list(hand["museums"].items()) + list(hand["venues"].items()):
        if key.startswith("venue:"):
            town, vname = key[len("venue:"):].split(":", 1)
            place = V2 / "places" / (town + ".json")
            have = place.exists() and any(v[0] == vname for v in json.loads(place.read_text())["venues"])
            if not have:
                log("  warning: no venue %r in places/%s.json" % (vname, town))
        elif key not in names:
            log("  warning: %s is not a museum of the site" % key)
            continue
        found = [(u, seen[u]["links"]) for u in e.get("pages", []) if u in seen and good(seen[u])]
        for u in e.get("pages", []):
            if u in seen and good(seen[u]):
                read.append(seen[u]["read"])
        pick = best_link(found)
        status = e.get("status")
        if pick:
            url, where, _ = pick
            status = "guide"                     # its own page links it: made sure
        else:
            url, where = e.get("url"), e.get("seen")
        if status != "guide":
            continue
        row = {"name": names.get(key, e.get("name")), "url": url, "seen": where}
        if e.get("holds"):
            row["holds"] = e["holds"]
        guides[key] = row
    out = {
        "note": ("Bloomberg Connects (artist, 7 Oct 2026: “Link them for now to the Bloomberg site”): the museums and venues "
                 "of the site with a guide of their own on Bloomberg Connects, by scripts/fetch_bloomberg_guides.py from "
                 "scripts/bloomberg_hand.json and the institutions' own pages. url is the guide's address as it was seen, verbatim "
                 "(a link into a guide cut to the guide), never made up; null where a guide is evidenced but its address has not "
                 "been seen, and then the page shows nothing. seen: where the address (or, with none, the evidence) was seen. "
                 "holds: what the guide holds, as the institution describes it, where that was seen. Keys: a museum's slug "
                 "(museums.json), folger, or venue:<city key>:<venue name as in places/<city key>.json>."),
        "read": max(read),
        "guides": guides,
    }
    text = json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    old = OUT.read_text() if OUT.exists() else ""
    n, linked = len(guides), sum(1 for g in guides.values() if g["url"])
    if text == old:
        log("bloomberg.json: nothing changed (%d guides, %d with an address)" % (n, linked))
        return
    OUT.write_text(text)
    log("bloomberg.json: written (%d guides, %d with an address, %d bytes)" % (n, linked, len(text.encode())))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--build", action="store_true", help="build from the hand table and the cache only (no network)")
    ap.add_argument("--only", nargs="*", help="read only these keys' pages (museum slugs, folger, venue:...)")
    a = ap.parse_args()
    hand = json.loads(HAND.read_text())
    if not a.build:
        fetch(hand, set(a.only or []))
    build(hand)


if __name__ == "__main__":
    sys.exit(main())

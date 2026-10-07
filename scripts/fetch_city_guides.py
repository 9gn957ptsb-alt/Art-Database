#!/usr/bin/env python3
"""The city guides: what is on now, and soon, in each of the site's cities.

The artist, 7 Oct 2026, of the Artsy app's "London City Guide" pill: "Artsy is
starting to do this thing where at the top it shows a suggested guide for a
city. Explore that function on artsy and implement a version of that. It's
more like what I had in mind with the explore function". The design and what
Artsy's guide has that its API gives: docs/v2/GUIDE.md.

For each city of the Museums layer with a museum (cities.json; not a town that
is only its museum, which opens straight into the museum), and each
cities.json town within 30 km of a collage, this reads Artsy's public v1 API
(api.artsy.net; the session's proxy supplies the key):

  shows?near=<lat>,<lon>&max_distance=25&status=running     (paged)
  shows?near=<lat>,<lon>&max_distance=25&status=upcoming    (paged; kept if they open within 30 days)
  fairs?near=<lat>,<lon>&status=running|upcoming            (fair/<id> for its place)
  partner/<p>/show/<s>/artworks                              (only for a show with a saved artist)

A show within reach of two of the cities is the nearer one's. Written, public
and small: docs/v2/guides/<city key>.json and docs/v2/guides.json (the index).
Only a show's public listing facts are kept — its id, title, partner and kind,
dates, address and point, opening hours, its artists' names, the cover's key
on Artsy's CDN (shown live in the visitor's browser, never copied), the
opening reception's time — and the joins to the site's public files: a site
museum (museums.json), the saved artists (finding.json; a life in lives.json),
the saved works in the show (finding.json). Never a price, never anything of
the artist's account.

The raw answers are cached in data/guides/<date>/ (gitignored). Run:

  python3 scripts/fetch_city_guides.py              # read today, then build
  python3 scripts/fetch_city_guides.py --build      # build again from the newest cache, no network
  python3 scripts/fetch_city_guides.py --only london-gb   # one city (keys of cities.json)

The same cache gives the same bytes. Paced (0.3 s a call) and retried on 429/5xx.
"""
import argparse
import datetime as dt
import json
import math
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "docs" / "v2"
OUT = V2 / "guides"
CACHE = ROOT / "data" / "guides"
API = "https://api.artsy.net/api/v1/"
CDN = "https://d32dm0rphc51dk.cloudfront.net/"
RADIUS_KM = 25           # Artsy's max_distance, in km
COLLAGE_KM = 30          # a cities.json town this near a collage has a guide too
SOON_DAYS = 30           # upcoming shows kept if they open within this
PACE = 0.3

# The collages' places (land.js, the collages' sites).
COLLAGES = [("Sydney", -33.8688, 151.2093), ("Washington", 38.8899, -77.0091), ("New York", 40.7128, -74.0060),
            ("San Francisco", 37.7749, -122.4194), ("Boston", 42.3601, -71.0589), ("Blacksburg", 37.2296, -80.4139)]


def km(a, b):
    r = math.radians
    la1, lo1, la2, lo2 = r(a[0]), r(a[1]), r(b[0]), r(b[1])
    c = math.sin(la1) * math.sin(la2) + math.cos(la1) * math.cos(la2) * math.cos(lo2 - lo1)
    return 6371 * math.acos(max(-1.0, min(1.0, c)))


def fold(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


_last = [0.0]


def get(q, tries=5):
    wait = PACE - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    for k in range(tries):
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(API + q, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 500, 502, 503, 504) and k < tries - 1:
                time.sleep(2 * (k + 1) ** 2)
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if k < tries - 1:
                time.sleep(2 * (k + 1) ** 2)
                continue
            raise


def cities():
    """The towns with a guide: [key, name, cc, lat, lon]."""
    towns = json.loads((V2 / "cities.json").read_text())["towns"]
    out = {}
    for t in towns:
        if t[6] and not t[8]:        # a town that is only its museum opens the museum: no city view to hold a guide
            out[t[0]] = t
    for name, la, lo in COLLAGES:
        best = min(towns, key=lambda t: km((la, lo), (t[3], t[4])))
        if km((la, lo), (best[3], best[4])) <= COLLAGE_KM and not best[8]:
            out.setdefault(best[0], best)
    return [out[k] for k in sorted(out, key=lambda k: [t[0] for t in towns].index(k))]


# ---- reading ------------------------------------------------------------------------------------

def paged(q, cap=6):
    rows = []
    for page in range(1, cap + 1):
        d = get(f"{q}&size=100&page={page}") or []
        rows += d
        if len(d) < 100:
            break
    return rows


def read_city(t, day_dir, saved_names):
    p = day_dir / f"{t[0]}.json"
    if p.exists():
        return json.loads(p.read_text())
    near = f"near={t[3]},{t[4]}&max_distance={RADIUS_KM}"
    running = paged(f"shows?{near}&status=running")
    upcoming = paged(f"shows?{near}&status=upcoming", cap=3)
    fairs = []
    for st in ("running", "upcoming"):
        for f in get(f"fairs?near={t[3]},{t[4]}&status={st}&size=20") or []:
            full = get("fair/" + urllib.parse.quote(f["id"])) or f
            loc = (full.get("location") or {}).get("coordinates")
            if loc and km((t[3], t[4]), (loc["lat"], loc["lng"])) <= RADIUS_KM:
                fairs.append(full)
    # The saved works in a show: read only where a saved artist shows.
    works = {}
    for s in running + upcoming:
        if not any(fold(a.get("name")) in saved_names for a in s.get("artists") or []):
            continue
        pid = (s.get("partner") or {}).get("id")
        if not pid:
            continue
        ids = []
        for page in (1, 2, 3):
            d = get(f"partner/{urllib.parse.quote(pid)}/show/{urllib.parse.quote(s['id'])}/artworks?size=100&page={page}") or []
            ids += [w.get("_id") for w in d if w.get("_id")]
            if len(d) < 100:
                break
        works[s["id"]] = ids
    raw = {"running": running, "upcoming": upcoming, "fairs": fairs, "works": works}
    p.write_text(json.dumps(raw))
    return raw


# ---- distilling ---------------------------------------------------------------------------------

def ymd(s):
    return (s or "")[:10]


def img_key(x):
    u = x.get("image_url") or ""
    m = re.match(re.escape(CDN) + r"([^/]+)/", u)
    return m.group(1) if m else ""


DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def hours(loc):
    out = []
    for d in loc.get("day_schedules") or []:
        if d.get("day_of_week") in DAYS and d.get("start_time") is not None and d.get("end_time") is not None:
            out.append([DAYS.index(d["day_of_week"]), int(d["start_time"]), int(d["end_time"])])
    return sorted(out)


def address(loc):
    parts = [loc.get("address"), loc.get("address_2"), loc.get("city")]
    return ", ".join(p.strip() for p in parts if p and p.strip())


def show_row(s, joins, read_day):
    loc = s.get("location") or {}
    fl = s.get("fair_location") or {}
    c = s.get("coordinates") or loc.get("coordinates") or (fl.get("coordinates") if isinstance(fl, dict) else None)
    partner = s.get("partner") or {}
    fair = s.get("fair") or None
    kind = "f" if fair else ("m" if (s.get("partner_type") or partner.get("type")) in ("Institution", "Institutional Seller") else "g")
    row = {"id": s["id"], "t": (s.get("name") or "").strip(), "p": (partner.get("name") or "").strip(), "k": kind,
           "s": ymd(s.get("start_at")), "e": ymd(s.get("end_at"))}
    m = joins["museum"](partner)
    if m:
        row["m"] = m
        row["k"] = "m"
    if fair:
        row["f"] = fair.get("id")
        row["fn"] = (fair.get("name") or "").strip()
    a = address(loc) if loc else ""
    if a:
        row["a"] = a
    if c and c.get("lat") is not None:
        row["ll"] = [round(c["lat"], 5), round(c["lng"], 5)]
    h = hours(loc) if loc else []
    if h:
        row["h"] = h
    elif loc.get("day_schedule_text"):
        row["ht"] = re.sub(r"\s*\r?\n\s*", " · ", loc["day_schedule_text"].strip())
    if loc.get("timezone"):
        row["tz"] = loc["timezone"]
    k = img_key(s)
    if k:
        row["i"] = k
    ar = []
    for x in s.get("artists") or []:
        name = (x.get("name") or "").strip()
        if not name or any(r[0] == name for r in ar):
            continue
        life = joins["life"](name, x.get("id"))
        saved = 1 if fold(name) in joins["saved"] else 0
        ar.append([name, life or 0, saved] if (life or saved) else [name])
    if ar:
        row["ar"] = ar
    ev = []
    for e in s.get("events") or []:
        if e.get("event_type") in ("Opening Reception", "Artist Talk", "Special Event") and e.get("start_at"):
            ev.append([e["event_type"], e["start_at"][:16], (e.get("end_at") or "")[:16]])
    if ev:
        row["ev"] = sorted(ev, key=lambda x: x[1])
    rec = (s.get("opening_reception_text") or "").strip()
    if rec:
        row["rec"] = rec[:160]
    w = [i for i in joins["works"].get(s["id"], []) if i in joins["work_ids"]]
    if w:
        row["w"] = sorted(set(w))
    return row


def fair_row(f):
    loc = f.get("location") or {}
    c = loc.get("coordinates") or {}
    r = {"id": f["id"], "t": (f.get("name") or "").strip(), "s": ymd(f.get("start_at")), "e": ymd(f.get("end_at"))}
    if loc.get("raw") or loc.get("display"):
        r["a"] = (loc.get("raw") or loc.get("display")).strip()
    if c.get("lat") is not None:
        r["ll"] = [round(c["lat"], 5), round(c["lng"], 5)]
    k = img_key(f)
    if k:
        r["i"] = k
    if f.get("partners_count"):
        r["n"] = f["partners_count"]
    return r


def build(day, only=None):
    day_dir = CACHE / day
    finding = json.loads((V2 / "finding.json").read_text())
    work_ids = {w[0] for w in finding["w"]}
    saved = {fold(w[2]) for w in finding["w"] if w[2]}
    lives = json.loads((V2 / "lives.json").read_text())["lives"]
    life_by_name = {fold(r[1]): r[0] for r in lives}
    life_ids = {r[0] for r in lives}
    mus = json.loads((V2 / "museums.json").read_text())["museums"]
    mus_slugs = {m["slug"] for m in mus}
    mus_by_name = {fold(m["name"]): m["slug"] for m in mus}

    def museum(partner):
        pid = partner.get("id") or ""
        if "museum-" + pid in mus_slugs:
            return "museum-" + pid
        return mus_by_name.get(fold(partner.get("name")))

    def life(name, aid):
        return life_by_name.get(fold(name)) or (aid if aid in life_ids else None)

    towns = cities()
    raws = {}
    for t in towns:
        p = day_dir / f"{t[0]}.json"
        if p.exists():
            raws[t[0]] = json.loads(p.read_text())
    soon = (dt.date.fromisoformat(day) + dt.timedelta(days=SOON_DAYS)).isoformat()
    # Each show to the nearest guide city that read it.
    home = {}
    for t in towns:
        raw = raws.get(t[0])
        if not raw:
            continue
        for s in raw["running"] + raw["upcoming"]:
            c = s.get("coordinates") or (s.get("location") or {}).get("coordinates")
            d = km((t[3], t[4]), (c["lat"], c["lng"])) if c else RADIUS_KM
            if s["id"] not in home or (d, t[0]) < home[s["id"]][0]:
                home[s["id"]] = ((d, t[0]), t[0])
    fair_home = {}
    for t in towns:
        for f in (raws.get(t[0]) or {}).get("fairs", []):
            c = (f.get("location") or {}).get("coordinates")
            d = km((t[3], t[4]), (c["lat"], c["lng"])) if c else RADIUS_KM
            if f["id"] not in fair_home or (d, t[0]) < fair_home[f["id"]][0]:
                fair_home[f["id"]] = ((d, t[0]), t[0])
    OUT.mkdir(parents=True, exist_ok=True)
    index = {}
    for t in towns:
        raw = raws.get(t[0])
        if not raw:
            continue
        joins = {"museum": museum, "life": life, "saved": saved, "works": raw.get("works", {}), "work_ids": work_ids}
        rows, seen = [], set()
        for s in raw["running"] + raw["upcoming"]:
            if s["id"] in seen or home.get(s["id"], (0, None))[1] != t[0]:
                continue
            if not s.get("displayable", True) or not (s.get("name") or "").strip():
                continue
            if ymd(s.get("end_at")) and ymd(s.get("end_at")) < day:
                continue
            if ymd(s.get("start_at")) > soon:
                continue
            seen.add(s["id"])
            rows.append(show_row(s, joins, day))
        rows.sort(key=lambda r: (r["e"] or "9999", r["s"], r["id"]))
        fairs, fseen = [], set()
        for f in raw.get("fairs", []):
            if f["id"] in fseen or fair_home.get(f["id"], (0, None))[1] != t[0] or ymd(f.get("end_at")) < day:
                continue
            fseen.add(f["id"])
            fairs.append(fair_row(f))
        fairs.sort(key=lambda r: (r["s"], r["id"]))
        doc = {"read": day, "key": t[0], "name": t[1], "ll": [t[3], t[4]], "km": RADIUS_KM, "cdn": CDN,
               "note": "Written by scripts/fetch_city_guides.py from Artsy's public listings (api.artsy.net), read on "
                       + day + ". Shows' listing facts only; the covers stay on Artsy's CDN.",
               "shows": rows, "fairs": fairs}
        (OUT / f"{t[0]}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
        running = sum(1 for r in rows if r["s"] <= day)
        mine = sum(1 for r in rows if any(len(a) > 2 and a[2] for a in r.get("ar", [])))
        index[t[0]] = [t[1], len(rows), running, len(rows) - running, mine, len(fairs), t[3], t[4]]
    if only:
        old = json.loads((V2 / "guides.json").read_text()).get("cities", {}) if (V2 / "guides.json").exists() else {}
        old.update(index)
        index = old
    doc = {"read": day, "note": "The city guides' index: key → [name, shows, on now, opening within 30 days, "
                                "with a saved artist, fairs, lat, lon]. scripts/fetch_city_guides.py.",
           "cities": {k: index[k] for k in sorted(index)}}
    (V2 / "guides.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
    return index


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", action="store_true", help="build again from the newest cache, no network")
    ap.add_argument("--only", nargs="*", help="cities.json keys")
    ap.add_argument("--day", help="the read date (YYYY-MM-DD); default today, or the newest cache with --build")
    args = ap.parse_args()
    if args.build:
        days = sorted(p.name for p in CACHE.glob("20*") if p.is_dir())
        if not days:
            sys.exit("no cache in data/guides/")
        day = args.day or days[-1]
    else:
        day = args.day or dt.date.today().isoformat()
        day_dir = CACHE / day
        day_dir.mkdir(parents=True, exist_ok=True)
        finding = json.loads((V2 / "finding.json").read_text())
        saved = {fold(w[2]) for w in finding["w"] if w[2]}
        towns = [t for t in cities() if not args.only or t[0] in args.only]
        for i, t in enumerate(towns):
            raw = read_city(t, day_dir, saved)
            print(f"{i + 1}/{len(towns)} {t[1]}: {len(raw['running'])} running, {len(raw['upcoming'])} upcoming, "
                  f"{len(raw['fairs'])} fairs, {len(raw['works'])} read for saved works", flush=True)
    index = build(day, args.only)
    n = sum(v[1] for v in index.values())
    print(f"{len(index)} cities, {n} shows, {sum(v[4] for v in index.values())} with a saved artist, "
          f"{sum(v[5] for v in index.values())} fairs — read {day}")


if __name__ == "__main__":
    main()

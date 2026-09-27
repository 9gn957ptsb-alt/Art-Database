#!/usr/bin/env python3
"""Everything Artsy knows about where each saved artwork has been — the first layer of the
artworks' histories.

For every work in the private saves dump (data/artsy_saves_raw.json, from fetch_artsy_saves.py) this
reads Artsy's full record (provenance, exhibition history and literature as the listing partner wrote
them, the collecting institution, the work's location), every Artsy show it was in (name, dates,
partner, place; a fair's own name and dates) and every sale it was offered in (name, dates, auction
house), into data/histories/artsy/ — private, like the saves, and never committed. Nothing about
price or availability is kept.

The proxy adds Artsy's token. Resumable: what is already read is not read again (--refresh reads
it again).

    python3 scripts/fetch_artwork_histories.py [--only artwork-id] [--refresh] [--threads 4]
"""

import argparse
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
SAVES = ROOT / "data" / "artsy_saves_raw.json"
OUT = ROOT / "data" / "histories" / "artsy"
API = "https://api.artsy.net/api/v1/"

WORK_KEYS = ["id", "_id", "title", "date", "medium", "category", "dimensions", "series", "signature",
             "collecting_institution", "provenance", "exhibition_history", "literature",
             "additional_information", "blurb", "show_ids", "sale_ids", "artwork_location",
             "public_location", "image_rights", "unique"]

_local = threading.local()


def filename(key):
    """A file name for an Artsy id: some slugs run past what a file system allows."""
    import hashlib
    return (key if len(key) <= 120 else key[:80] + "-" + hashlib.sha1(key.encode()).hexdigest()[:16]) + ".json"


def session():
    if not hasattr(_local, "s"):
        _local.s = requests.Session()
        _local.s.headers.update({"Accept": "application/json"})
    return _local.s


def get(path):
    for attempt in range(6):
        try:
            r = session().get(API + path, timeout=60)
            if r.status_code == 404:
                return None
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(5 * 2 ** attempt)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            time.sleep(5 * 2 ** attempt)
    raise RuntimeError(f"Artsy would not answer {path}")


def slim_partner(p):
    if not isinstance(p, dict):
        return None
    return {"id": p.get("id"), "name": p.get("name"), "type": p.get("type"),
            "categories": [c.get("name") for c in p.get("partner_categories") or []]}


def slim_location(loc):
    if not isinstance(loc, dict):
        return None
    keep = ("city", "state", "country", "address", "address_2", "postal_code", "coordinates", "display")
    return {k: loc.get(k) for k in keep if loc.get(k)} or None


def work(saved, refresh):
    path = OUT / "works" / filename(saved["id"])
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    j = get("artwork/" + saved["id"]) or {}
    rec = {k: j.get(k, saved.get(k)) for k in WORK_KEYS}
    rec["artists"] = [{"id": a.get("id"), "name": a.get("name"), "birthday": a.get("birthday"),
                       "deathday": a.get("deathday"), "nationality": a.get("nationality"),
                       "hometown": a.get("hometown")}
                      for a in (j.get("artists") or saved.get("artists") or []) if isinstance(a, dict)]
    rec["partner"] = slim_partner(j.get("partner") or saved.get("partner"))
    rec["image"] = next((i.get("image_url") for i in (j.get("images") or saved.get("images") or [])
                         if isinstance(i, dict) and i.get("image_url")), None)
    rec["found"] = bool(j)
    path.write_text(json.dumps(rec, ensure_ascii=False))
    return rec


def show(sid, refresh):
    path = OUT / "shows" / filename(sid)
    if path.exists() and not refresh:
        return
    j = get("show/" + sid) or {}
    fair = j.get("fair") if isinstance(j.get("fair"), dict) else None
    rec = {"id": sid, "name": j.get("name"), "start_at": j.get("start_at"), "end_at": j.get("end_at"),
           "status": j.get("status"), "type": j.get("type"), "description": j.get("description"),
           "press_release": j.get("press_release"), "partner": slim_partner(j.get("partner")),
           "location": slim_location(j.get("location")),
           "fair": {"id": fair.get("id"), "name": fair.get("name"), "start_at": fair.get("start_at"),
                    "end_at": fair.get("end_at")} if fair else None,
           "found": bool(j)}
    path.write_text(json.dumps(rec, ensure_ascii=False))


def sale(sid, refresh):
    path = OUT / "sales" / filename(sid)
    if path.exists() and not refresh:
        return
    j = get("sale/" + sid) or {}
    rec = {"id": sid, "name": j.get("name"), "start_at": j.get("start_at"), "end_at": j.get("end_at"),
           "is_auction": j.get("is_auction"), "sale_type": j.get("sale_type"),
           "auction_state": j.get("auction_state"), "partner": slim_partner(j.get("partner")),
           "location": slim_location(j.get("location")), "description": j.get("description"),
           "found": bool(j)}
    path.write_text(json.dumps(rec, ensure_ascii=False))


def places(refresh):
    """Where each show and sale took place: its own location, else its fair's, else its partner's
    (every location a partner lists, the first one first). Written into the show and sale files as
    "place" (city, country, coordinates, and what it came from)."""
    fairs, partners = {}, {}

    def fair(fid):
        if fid not in fairs:
            path = OUT / "fairs" / filename(fid)
            if path.exists() and not refresh:
                fairs[fid] = json.loads(path.read_text())
            else:
                j = get("fair/" + fid) or {}
                fairs[fid] = {"id": fid, "name": j.get("name"), "location": slim_location(j.get("location")),
                              "start_at": j.get("start_at"), "end_at": j.get("end_at")}
                path.write_text(json.dumps(fairs[fid], ensure_ascii=False))
        return fairs[fid]

    def partner(pid):
        if pid not in partners:
            path = OUT / "partners" / filename(pid)
            if path.exists() and not refresh:
                partners[pid] = json.loads(path.read_text())
            else:
                locs = get(f"partner/{pid}/locations?size=20") or []
                partners[pid] = {"id": pid, "locations": [slim_location(l) for l in locs if isinstance(l, dict)]}
                path.write_text(json.dumps(partners[pid], ensure_ascii=False))
        return partners[pid]

    for d in ("fairs", "partners"):
        (OUT / d).mkdir(parents=True, exist_ok=True)
    for kind in ("shows", "sales"):
        for path in sorted((OUT / kind).glob("*.json")):
            rec = json.loads(path.read_text())
            if rec.get("place") and not refresh:
                continue
            place, came = rec.get("location"), "own"
            if not (place and (place.get("coordinates") or place.get("city"))) and rec.get("fair"):
                place, came = fair(rec["fair"]["id"]).get("location"), "fair"
            if not (place and (place.get("coordinates") or place.get("city"))) and (rec.get("partner") or {}).get("id"):
                locs = [l for l in partner(rec["partner"]["id"])["locations"] if l]
                place, came = (locs[0] if locs else None), "partner"
            rec["place"] = dict(place, source=came) if place else None
            path.write_text(json.dumps(rec, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only")
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--threads", type=int, default=4)
    args = ap.parse_args()
    saves = [s for s in json.loads(SAVES.read_text()) if s.get("id")]
    if args.only:
        saves = [s for s in saves if s["id"] == args.only]
    for d in ("works", "shows", "sales"):
        (OUT / d).mkdir(parents=True, exist_ok=True)
    t = time.time()
    with ThreadPoolExecutor(args.threads) as pool:
        works = list(pool.map(lambda s: work(s, args.refresh), saves))
        print(f"{len(works)} works read in {time.time() - t:.0f} s", flush=True)
        shows = sorted({i for w in works for i in (w.get("show_ids") or [])})
        list(pool.map(lambda i: show(i, args.refresh), shows))
        print(f"{len(shows)} shows read", flush=True)
        sales = sorted({i for w in works for i in (w.get("sale_ids") or [])})
        list(pool.map(lambda i: sale(i, args.refresh), sales))
        print(f"{len(sales)} sales read in {time.time() - t:.0f} s", flush=True)
        places(args.refresh)
        print(f"places found in {time.time() - t:.0f} s", flush=True)
    filled = {k: sum(1 for w in works if (w.get(k) or "").strip()) for k in
              ("provenance", "exhibition_history", "literature", "collecting_institution")}
    print("filled:", filled)


if __name__ == "__main__":
    sys.exit(main())

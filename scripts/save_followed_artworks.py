#!/usr/bin/env python3
"""Save, on Artsy, every artwork by every artist the artist follows — skipping editions
and prints that are not the artist's own work or not part of their history.

The artist's request (3 Oct 2026): "In Artsy can you favorite all of the artworks by all of
the artists I follow that way all their works are available to you through artsy", and,
told it was 875 artists and ~180,000 works: "Skip editions and prints that were not done by
the artist or are not relevant to the artists historical narrative. Besides that go ahead
and save all artworks for all the artists I follow".

Authentication is the environment's: the agent proxy adds Artsy's X-ACCESS-TOKEN to requests
to api.artsy.net. This script sends no token of its own.

Kept: everything unique (paintings, drawings, sculpture, photographs …), and prints and
editions the artist made in their lifetime. Skipped (each counted by its reason):
  - category Reproduction, Posters, Ephemera or Merchandise
  - an open edition
  - a work dated after the artist's death (posthumous editions, casts, restrikes)
  - words that say it is not the artist's hand: "after <artist>", "d'après", "posthumous",
    "restrike", "facsimile", "reproduction", "offset", "poster", "estate stamp",
    "stamped signature", "signed in the plate", "printed signature", "authorized by the estate"
Already saved works are left alone. Progress is kept in data/follow_saves/ (private, never
committed), so a run that is stopped resumes where it was.

    python3 scripts/save_followed_artworks.py --dry      # count only, save nothing
    python3 scripts/save_followed_artworks.py            # save
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

BASE = "https://api.artsy.net/api/v1"
USER = "5a296eb67622dd4a817fccf9"
DIR = Path(__file__).resolve().parent.parent / "data" / "follow_saves"
STATE = DIR / "state.json"
# The saved set, kept between runs: listing it again (100 a page) took longer than the container lived.
HAVE = DIR / "have.json"
LOG = DIR / "log.jsonl"
DELAY = 0.35

SKIP_CATEGORIES = {"Reproduction", "Posters", "Ephemera or Merchandise"}
NOT_HIS = re.compile(
    r"d['’]apr[eè]s|posthum|re-?strike|facsimile|reproduction|\boffset\b|\bposter\b|"
    r"estate[- ]stamp|stamped signature|signed in the plate|plate[- ]signed|printed signature|"
    r"authori[sz]ed by the (estate|foundation)|\bestate edition\b",
    re.I,
)

S = requests.Session()
S.verify = "/root/.ccr/ca-bundle.crt"


def call(method, path, params=None, tries=6):
    wait = 2.0
    for _ in range(tries):
        try:
            r = S.request(method, f"{BASE}/{path}", params=params, timeout=60)
        except requests.RequestException:
            time.sleep(wait); wait *= 2; continue
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(wait); wait = min(wait * 2, 120); continue
        return r
    raise SystemExit(f"Artsy kept refusing {method} {path}")


def year_of(date):
    m = re.search(r"(1[0-9]{3}|20[0-9]{2})", date or "")
    return int(m.group(1)) if m else None


def reason_to_skip(a, artist):
    if a.get("category") in SKIP_CATEGORIES:
        return "category:" + a["category"]
    if a.get("attribution_class") == "open edition":
        return "open edition"
    death = year_of(artist.get("deathday") or "")
    y = year_of(a.get("date"))
    if death and y and y > death:
        return "after the artist's death"
    text = " ".join(str(a.get(k) or "") for k in ("title", "medium", "blurb", "manufacturer"))
    if NOT_HIS.search(text):
        return "not the artist's hand"
    surname = (artist.get("name") or "").split()[-1:] or [""]
    if surname[0] and re.search(r"\(?\bafter\s+(\w+\s+){0,2}" + re.escape(surname[0]) + r"\b", text, re.I):
        return "not the artist's hand"
    return None


def followed():
    out, page = [], 1
    while True:
        d = call("GET", "me/follow/artists", {"size": 100, "page": page}).json()
        if not d:
            return out
        out += [f.get("artist", f) for f in d]
        page += 1
        time.sleep(DELAY)


def saved_ids():
    ids, page = set(), 1
    while True:
        d = call("GET", "collection/saved-artwork/artworks",
                 {"user_id": USER, "private": "true", "size": 100, "page": page}).json()
        if not d:
            return ids
        ids |= {a["_id"] for a in d}
        page += 1
        time.sleep(DELAY)


def artworks(artist):
    """Every published work of the artist; other sorts fill in if the default order is capped."""
    seen, want = {}, artist.get("published_artworks_count") or 0
    for sort in (None, "-date", "date", "-published_at", "published_at"):
        page = 1
        while True:
            p = {"size": 100, "page": page, "published": "true"}
            if sort:
                p["sort"] = sort
            r = call("GET", f"artist/{artist['id']}/artworks", p)
            if r.status_code != 200:
                break
            d = r.json()
            if not d:
                break
            for a in d:
                seen[a["_id"]] = a
            page += 1
            time.sleep(DELAY)
        if len(seen) >= want:
            break
    return list(seen.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    DIR.mkdir(parents=True, exist_ok=True)
    state = json.loads(STATE.read_text()) if STATE.exists() else {"done": [], "counts": {}}
    done = set(state["done"])
    arts = followed()
    print(f"{len(arts)} artists followed", flush=True)
    have = set(json.loads(HAVE.read_text())) if HAVE.exists() else saved_ids()
    HAVE.write_text(json.dumps(sorted(have)))
    print(f"{len(have)} already saved", flush=True)
    log = LOG.open("a")
    for i, artist in enumerate(arts, 1):
        if artist["id"] in done:
            continue
        works = artworks(artist)
        c = {"works": len(works), "saved": 0, "had": 0}
        for a in works:
            why = reason_to_skip(a, artist)
            if why:
                c[why] = c.get(why, 0) + 1
                continue
            if a["_id"] in have:
                c["had"] += 1
                continue
            if not args.dry:
                r = call("POST", f"collection/saved-artwork/artwork/{a['id']}", {"user_id": USER})
                if r.status_code not in (200, 201):
                    c["failed"] = c.get("failed", 0) + 1
                    log.write(json.dumps({"artist": artist["id"], "work": a["id"], "status": r.status_code}) + "\n")
                    continue
                have.add(a["_id"])
                time.sleep(DELAY)
                # A big artist (Robert Indiana: 1,650 to save) outlasts the container; what is saved is kept
                # every 25, so a restart goes on from there instead of saving the same works again.
                if c["saved"] % 25 == 24:
                    HAVE.write_text(json.dumps(sorted(have)))
            c["saved"] += 1
        state["counts"][artist["id"]] = c
        print(f"[{i}/{len(arts)}] {artist.get('name')}: {c}", flush=True)
        if not args.dry:
            done.add(artist["id"])
            state["done"] = sorted(done)
            STATE.write_text(json.dumps(state))
            HAVE.write_text(json.dumps(sorted(have)))
    tot = {}
    for c in state["counts"].values():
        for k, v in c.items():
            tot[k] = tot.get(k, 0) + v
    print("total", tot, flush=True)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""The cities' pass: each skyline cut finer and read again from the newest open data, a few a day.

The artist, 8 Oct 2026: "Right now when I click on a city on the Artist website. It's rather pixelated,
I want to make sure that overtime this is getting refined to be as up-to-date with the current status as
possible." A city's skyline (docs/v2/skyline.js) is its ground, grounds/city-<key>.json: a square of
3-8 km cut into cells, each land, water, street, green or building, drawn in dots of DIRT. It was first
cut ~40 m a cell, so a block of Manhattan was two or three dots. The daily cities' pass
(docs/v2/grounds/REFINE.md) runs this, which:

  * lists the next cities (build_city_places.py's order: the cities with museums, then the busiest
    cities of galleries) and reads each at the first fine grain;
  * raises the cities still coarsest a grain, the most important first (GRAINS in build_city_places.py:
    ~40, then 28, 20, 14 m a cell, never more than 576 cells a side);
  * reads again, oldest first, the cities read from an older Overture release than the newest;
  * dates each ground it cut (build_built_years.py); where a source of the last cut's years did not
    answer this time, the last cut's years are carried over cell by cell for the buildings it left
    undated, and the ground says so (builtCarried);
  * asks GitHub's runners to read a city's records again where they were read for another grid
    (records/REQUEST, .github/workflows/city-records.yml), and dates the city again once they are in;
  * keeps a cut only within BUDGET (else the city stays as it was, and its log says why);
  * keeps docs/v2/grounds/ledger.json: each city's tier, grid, Overture release, when read and dated,
    what was dated, its sizes, and a line a run.

Nothing private is read: Overture Maps (ODbL, largely OpenStreetMap), the Terrain Tiles on AWS, and the
cities' own open records through build_built_years.py.

    python3 scripts/refine_cities.py                      # the plan, and stop
    python3 scripts/refine_cities.py --run [--new 2] [--raise 3] [--refresh 2] [--years-timeout 2400]
    python3 scripts/refine_cities.py --run --only new-york-us [--tier 2]
    python3 scripts/refine_cities.py --redate             # date again the cities whose runners' records came

The run ends with a report (plain lines) and the keys it changed, for scripts/check_skyline.js.
"""

import argparse
import datetime
import gzip
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_city_places as BCP  # noqa: E402

V2 = ROOT / "docs" / "v2"
GROUNDS = V2 / "grounds"
LEDGER = BCP.LEDGER
CITYPLACES = V2 / "cityplaces.json"
RECORDS = [ROOT / "records" / "years", ROOT / "records" / "census"]
REQUEST = ROOT / "records" / "REQUEST"
TOP = len(BCP.GRAINS) - 1                 # the finest tier
FIRST = 2                                 # the tier a new city is read at, and a first cut raised to (20 m)
BUDGET = {"kb": 2600, "gz": 420}          # a ground's file, raw and as GitHub Pages sends it (gzip)
SATELLITES = ("World Settlement Footprint", "GHSL")
TODAY = datetime.date.today().isoformat()


def py(*args, timeout=None):
    print("  $ python3 " + " ".join(args), flush=True)
    try:
        return subprocess.run([sys.executable] + list(args), cwd=ROOT, timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        print(f"  ! timed out after {timeout} s", flush=True)
        return 124


def read(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def ledger():
    d = read(LEDGER) or {}
    d.setdefault("note", "The cities' pass (docs/v2/grounds/REFINE.md, scripts/refine_cities.py): each skyline's "
                         "grain, the Overture release it was read from, when it was read and dated, and a line a run.")
    d.setdefault("cities", {})
    return d


def save(d):
    d["cities"] = dict(sorted(d["cities"].items(), key=lambda kv: kv[0]))
    LEDGER.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ground_path(key):
    return GROUNDS / f"city-{key}.json"


def listed():
    return (read(CITYPLACES) or {"places": []})["places"]


def write_places(top):
    """cityplaces.json for the first `top` cities, each at its tier's grain (build_city_places.py)."""
    return py("scripts/build_city_places.py", "--top", str(top))


def latest_release():
    try:
        import build_grounds
        return build_grounds.latest_release()
    except Exception as exc:                # the bucket out of reach: the pass says so and reads nothing new
        print(f"  ! Overture's releases could not be listed: {type(exc).__name__}: {exc}")
        return None


def order_key(r):
    return tuple(int(x) for x in r.replace("-", ".").split(".")) if r else (0,)


def records_for(slug):
    """The runners' records of a ground, and whether they were read for its present grid."""
    out = []
    for folder in RECORDS:
        r = read(folder / f"{slug}.json")
        if r:
            out.append((folder.name, r.get("n"), r.get("read", "")))
    return out


def dated_share(g):
    b = g.get("built") or []
    return sum(1 for y in b if y) / len(b) if b else 0.0


def sizes(path):
    raw = path.read_bytes()
    return round(len(raw) / 1000), round(len(gzip.compress(raw, 6)) / 1000)


# ---- the years, carried from the last cut where a source did not answer --------------------------

def centre(place):
    return place["lat"], place["lon"]


def carry(old, old_place, new, new_place):
    """For each of the new cut's building cells, the old cut's year at its middle: the old building cell
    it falls in, else the nearest old building cell within one old cell (0 where none)."""
    n0, s0 = old["n"], old["side"]
    c0, h0 = s0 / n0, s0 / 2
    built0, year0, k = old.get("built") or [], {}, 0
    for q, w in enumerate(old["kind"]):
        if w == "b":
            year0[q] = built0[k] if k < len(built0) else 0
            k += 1
    n1, s1 = new["n"], new["side"]
    c1, h1 = s1 / n1, s1 / 2
    lat0, lon0 = centre(old_place)
    lat1, lon1 = centre(new_place)
    kx = 111320 * math.cos(math.radians(lat0))
    dx, dy = (lon1 - lon0) * kx, (lat1 - lat0) * 111320          # the new centre, east and north of the old
    out = []
    for q, w in enumerate(new["kind"]):
        if w != "b":
            continue
        i, j = divmod(q, n1)
        x = (j + 0.5) * c1 - h1 + dx
        y = h1 - (i + 0.5) * c1 + dy
        oi, oj = int((h0 - y) // c0), int((x + h0) // c0)
        best = 0
        if 0 <= oi < n0 and 0 <= oj < n0 and (oi * n0 + oj) in year0:
            best = year0[oi * n0 + oj]
        else:
            bd = 9
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    ii, jj = oi + di, oj + dj
                    qq = ii * n0 + jj
                    if 0 <= ii < n0 and 0 <= jj < n0 and qq in year0 and di * di + dj * dj < bd:
                        bd, best = di * di + dj * dj, year0[qq]
        out.append(best)
    return out


def own_sources(g):
    """The sources a ground's years came from, but the satellites (which answer every time)."""
    return [s for s in (g.get("builtFrom") or []) if not any(t in s for t in SATELLITES)]


def keep_years(key, old, old_place, place, years_rc):
    """After build_built_years.py: where the last cut had a source this one did not get, its years stand in
    for the buildings this cut leaves undated or dates only by the satellites. Returns a line for the log."""
    path = ground_path(key)
    new = read(path)
    if not old or not old.get("built"):
        return f"{round(100 * dated_share(new))}% of its building cells dated" if new.get("built") else "not dated"
    lost = [s for s in own_sources(old) if s not in (new.get("builtFrom") or [])]
    if years_rc == 0 and not lost and new.get("built"):
        return f"{round(100 * dated_share(new))}% of its building cells dated ({dated_share(old):.0%} at the last cut)"
    carried = carry(old, old_place, new, place)
    fresh = new.get("built") or [0] * len(carried)
    # A source that answered last time and not now: its years, carried, before the satellites' guess.
    merged, took = [], 0
    for f, c in zip(fresh, carried):
        if c and (not f or lost):
            merged.append(c)
            took += 1
        else:
            merged.append(f)
    new["built"] = merged
    new["builtFrom"] = list(dict.fromkeys((new.get("builtFrom") or []) + (old.get("builtFrom") or [])))
    if old.get("builtOld") and not new.get("builtOld"):
        new["builtOld"] = old["builtOld"]
    why = ", ".join(lost) if lost else "the years were not read again"
    new["builtCarried"] = (f"{took} building cells' years carried from the cut of {old.get('read') or 'before'} "
                           f"({old['n']} cells a side): {why}")
    path.write_text(json.dumps(new, separators=(",", ":")), encoding="utf-8")
    return (f"{round(100 * dated_share(new))}% dated, {took} cells' years carried from the last cut "
            f"({why} did not answer)")


# ---- the plan ----------------------------------------------------------------------------------

def reconcile(led):
    """Each city's tier as its ground stands (a run cut off between writing the ledger and the ground
    leaves them apart): the tier whose grid is the ground's, else 0. Returns the keys it put right."""
    fixed = []
    sides = {p["key"]: p["side"] for p in listed()}
    for key, e in led["cities"].items():
        g = read(ground_path(key))
        if not g or key not in sides:
            continue
        want = BCP.cells_for(sides[key], e.get("tier", 0))
        if g["n"] != want:
            t = next((t for t in range(TOP + 1) if BCP.cells_for(sides[key], t) == g["n"]), 0)
            e["tier"] = t
            fixed.append(key)
    return fixed


def plan(args, led, release):
    places = listed()
    have = [p for p in places if ground_path(p["key"]).exists()]
    keys = {p["key"] for p in have}
    order = {p["key"]: k for k, p in enumerate(BCP.squares(10 ** 6))}
    todo = []
    if args.only:
        tier = args.tier if args.tier is not None else min(TOP, max(FIRST, led["cities"].get(args.only, {}).get("tier", 0) + 1))
        return [("only", args.only, tier)]
    # New cities: the next in order without a ground, at 20 m a cell (a cut costs about the same at any grain).
    nxt = [p for p in BCP.squares(len(places) + args.new, {}) if p["key"] not in keys][:args.new]
    todo += [("new", p["key"], FIRST) for p in nxt]
    # Raise: the coarsest first, then the most important; never past the finest, never past the budget's log.
    def tier(k):
        return led["cities"].get(k, {}).get("tier", 0)
    stuck = {k for k, v in led["cities"].items() if v.get("held")}
    up = sorted((p["key"] for p in have if tier(p["key"]) < TOP and p["key"] not in stuck),
                key=lambda k: (tier(k), order.get(k, 1e9)))
    # Refresh: read again from the newest release, oldest read first — the cities that are not raised any
    # more (at the finest grain, or held at theirs); a raise reads the newest release anyway, so until
    # there are such cities a refresh's turn goes to one more raise.
    stale = []
    if release:
        stale = [p["key"] for p in have if (tier(p["key"]) >= TOP or p["key"] in stuck) and
                 order_key(led["cities"].get(p["key"], {}).get("release")) < order_key(release)]
        stale.sort(key=lambda k: (led["cities"].get(k, {}).get("read", ""), order.get(k, 1e9)))
    stale = stale[:args.refresh]
    todo += [("raise", k, max(FIRST, tier(k) + 1)) for k in up[:args.raise_ + args.refresh - len(stale)]]
    todo += [("refresh", k, tier(k)) for k in stale]
    return todo


def redate_list(led):
    """Cities whose runners' records are now for their grid: asked for by a cut (the ledger's "records"),
    or read after the city was last dated. The records carry only their day, so a city asked for today is
    dated again whenever its records are for its grid."""
    out = []
    for p in listed():
        g = read(ground_path(p["key"]))
        if not g:
            continue
        e = led["cities"].get(p["key"], {})
        for name, n, when in records_for(p["slug"]):
            if n == g["n"] and (e.get("records") or when[:10] > e.get("dated", "")):
                out.append(p["key"])
                break
    return out


# ---- a cut -------------------------------------------------------------------------------------

def cut(key, tier, why, led, release, args):
    """Cut a city at a tier, date it, keep it within the budget. Returns (kept, line)."""
    entry = led["cities"].setdefault(key, {"tier": 0, "log": []})
    path = ground_path(key)
    old = read(path)
    old_bytes = path.read_bytes() if path.exists() else None
    old_places = {p["key"]: p for p in listed()}
    old_place = old_places.get(key)
    was_tier = entry.get("tier", 0)
    top = max(len(old_places) + (0 if key in old_places else 1), 1)
    entry["tier"] = tier
    save(led)
    write_places(top)
    place = {p["key"]: p for p in listed()}.get(key)
    if not place:
        entry["tier"] = was_tier
        save(led)
        write_places(top)
        return False, f"{key}: not among the cities a skyline is cut for"
    rel = ["--release", release] if release else []
    rc = py("scripts/build_grounds.py", "--only", place["slug"], "--force", *rel, timeout=args.ground_timeout)
    new = read(path)
    if rc != 0 or not new or new.get("n") != place["n"]:
        restore(key, old_bytes, was_tier, top, led)
        return False, f"its ground could not be read ({'timed out' if rc == 124 else 'failed'}): kept as it was"
    kb, gz = sizes(path)
    if kb > BUDGET["kb"] or gz > BUDGET["gz"]:
        restore(key, old_bytes, was_tier, top, led)
        over = f"{place['n']} cells a side is {kb} KB ({gz} KB sent): over the budget"
        if tier - 1 > was_tier:
            kept, line = cut(key, tier - 1, why + " (one grain coarser: " + over + ")", led, release, args)
            return kept, line
        entry["held"] = over
        return False, over + "; kept at " + str(old["n"] if old else 0) + " cells"
    years_rc = py("scripts/build_built_years.py", "--only", place["slug"], "--force", timeout=args.years_timeout)
    said = keep_years(key, old, old_place, place, years_rc)
    new = read(path)
    kb, gz = sizes(path)
    cell = place["side"] / place["n"]
    entry.update({"name": place["name"], "tier": tier, "n": place["n"], "cell": round(cell, 1),
                  "side": place["side"], "lat": place["lat"], "lon": place["lon"],
                  "release": new.get("release"), "read": new.get("read") or TODAY, "dated": TODAY,
                  "buildings": new.get("buildings"), "green": new["kind"].count("g"),
                  "dated_share": round(dated_share(new), 3), "kb": kb, "gz": gz})
    entry.pop("held", None)
    stale = [r for r in records_for(place["slug"]) if r[1] != place["n"]]
    if stale:
        entry["records"] = "asked " + TODAY + " for " + ", ".join(r[0] for r in stale)
    line = (f"{TODAY} · {why} · {place['n']} cells a side ({cell:.1f} m) from Overture {new.get('release')} · "
            f"{new.get('buildings')} buildings, {new['kind'].count('g')} green cells · {said} · {kb} KB ({gz} KB sent)")
    entry.setdefault("log", []).append(line)
    save(led)
    return True, line


def restore(key, old_bytes, was_tier, top, led):
    path = ground_path(key)
    if old_bytes:
        path.write_bytes(old_bytes)
    elif path.exists():
        path.unlink()
    led["cities"].setdefault(key, {})["tier"] = was_tier
    save(led)
    write_places(top)


def ask_runners(slugs):
    """Write the date and the grounds into records/REQUEST: pushed, it runs the city-records workflow."""
    if not slugs:
        return
    REQUEST.parent.mkdir(parents=True, exist_ok=True)
    REQUEST.write_text(f"{datetime.datetime.utcnow().isoformat(timespec='minutes')}Z the cities' pass cut "
                       f"{', '.join(sorted(slugs))} finer: their records are for the old grid\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", action="store_true", help="cut, date and record (else print the plan)")
    ap.add_argument("--new", type=int, default=3, help="new cities a run")
    ap.add_argument("--raise", dest="raise_", type=int, default=3, help="cities raised a grain a run")
    ap.add_argument("--refresh", type=int, default=1, help="cities read again from a newer release a run")
    ap.add_argument("--only", help="one city (its town key), raised a grain or to --tier")
    ap.add_argument("--tier", type=int, help="with --only: the tier to cut it at")
    ap.add_argument("--redate", action="store_true", help="date again the cities whose runners' records came")
    ap.add_argument("--ground-timeout", type=int, default=1500)
    ap.add_argument("--years-timeout", type=int, default=2400)
    args = ap.parse_args()

    led = ledger()
    fixed = reconcile(led)
    if fixed:
        print("The ledger put right, by the grounds as they stand: " + ", ".join(fixed))
        save(led)
        write_places(len(listed()))
    release = latest_release()
    print(f"Overture's newest release: {release or 'not reachable'}")
    if args.redate:
        changed = []
        for key in redate_list(led):
            slug = "city-" + key
            if py("scripts/build_built_years.py", "--only", slug, "--force", timeout=args.years_timeout) == 0:
                g = read(ground_path(key))
                e = led["cities"].setdefault(key, {"log": []})
                e["dated"] = TODAY
                e["dated_share"] = round(dated_share(g), 3)
                e.pop("records", None)
                e.setdefault("log", []).append(f"{TODAY} · dated again with its runners' records · "
                                               f"{round(100 * dated_share(g))}% of its building cells dated")
                changed.append(key)
        save(led)
        print("Changed: " + " ".join(changed) if changed else "Nothing to date again.")
        return
    todo = plan(args, led, release)
    if not todo:
        print("Nothing to do: every city is at the finest grain and read from the newest release.")
        return
    print("The plan:")
    for why, key, tier in todo:
        g = read(ground_path(key))
        print(f"  {why:8} {key}: {g['n'] if g else 0} → {BCP.cells_for((listed_side(key) or 8000), tier)} cells a side (tier {tier})")
    if not args.run:
        return
    changed, report, asked = [], [], set()
    for why, key, tier in todo:
        print(f"\n== {key} ({why}, tier {tier})", flush=True)
        kept, line = cut(key, tier, {"new": "first cut", "raise": f"raised to tier {tier}", "refresh": "read again",
                                     "only": f"cut at tier {tier}"}[why], led, release, args)
        report.append(f"{key}: {line}")
        if kept:
            changed.append(key)
            if led["cities"][key].get("records"):
                asked.add("city-" + key)
    if any(w == "new" for w, _, _ in todo):
        py("scripts/build_city_artists.py")
    ask_runners(asked)
    print("\nThe report:")
    for line in report:
        print("  " + line)
    if asked:
        print("  Asked GitHub's runners to read the records again for " + ", ".join(sorted(asked)) +
              " (records/REQUEST: push it); the next run dates them again (--redate).")
    print("Changed: " + " ".join(changed))


def listed_side(key):
    for p in BCP.squares(10 ** 6, {}):
        if p["key"] == key:
            return p["side"]
    return None


if __name__ == "__main__":
    main()

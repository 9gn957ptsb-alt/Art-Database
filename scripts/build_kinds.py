#!/usr/bin/env python3
"""The categories: an index of the kinds of things the site holds, so each can be reached from the others.

The artist, 2 Oct 2026: "so I really want you to categorize each type of path of exploration. We are
creating and create categorical names for them … and for each category made the spectrum that connects
all of them has to be navigable at all times … So use three sub categories for now that are available
when you are in any category." The categories, their glyphs, the spectrum and the three subcategories
offered from each are in docs/v2/KINDS.md, which the page reads (kinds.js). This writes the one index
the page cannot put together from the files it already reads: the shows, the venues and the artists.

  shows    every exhibition, gallery listing and sale a saved work's public history names, one row per
           show (its works gathered): [title, venue, start, end, type, thread, [works], [curators]]
           type x exhibited, f shown at a fair (a gallery's stand), l listed by a gallery (Artsy),
           o offered at a sale; start and end as the
           record gives them ("2026-06-12", "1969"); thread the threads/ id when two saved works or more
           were in it; works index finding.json's `w`; curators the voices (voices.json ids) whose acts
           credit them with curating a show of that title and year.
  venues   [name, town, type, museum, y0, y1]: type m museum (a site museum when `museum` is its slug,
           or a name that says museum), f fair, s sale room, g gallery; town the places/ key ("" when
           the record gives no place).
  artists  {name: [life, born, died, [[movement, y0, y1, qid]], [shows]]}: name as finding.json gives
           it, a co-credit split ("Pablo Picasso, Madoura" is Picasso's); life the lives/ id; born and
           died from Wikidata (via lives.json or data/studios/artists.json); movements Wikidata's P135
           (CC0, read by fetch_movements.py into data/movements/wd.json), with the movement's own years
           where Wikidata gives them; shows the rows above that include the artist's works, newest first.
  asof     the histories' date: "now" is a show whose end is on or after it.

Reads public files in docs/v2/ (histories/, finding.json, museums.json, lives.json, voices/) and, for
P135 only, data/studios/artists.json and data/movements/wd.json (when absent, the last kinds.json's
movements are kept). Never anything private: no owner, no price, no address. Same bytes every run.

    python3 scripts/build_kinds.py
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs" / "v2"
DATA = ROOT / "data"
OUT = SITE / "kinds.json"

FAIR = re.compile(r"\b(fair|frieze|art basel|armory show|fiac|expo chicago|tefaf|arco|masterpiece|miart|"
                  r"artissima|untitled art|nada|volta|scope|art cologne|paris photo|photo london|aipad|"
                  r"the photography show|zona maco|art dubai|art brussels|art paris|independent)\b", re.I)
SALEROOM = re.compile(r"\b(christie|sotheby|phillips|bonhams|heritage|dorotheum|drouot|doyle|swann|"
                      r"rago|wright|freeman|hindman|lempertz|ketterer|tajan|artcurial|koller|grisebach|"
                      r"bukowskis|bruun|forum auctions|auction|auktion|enchères|subastas|aste)\b", re.I)
# A gallery's stand: "<gallery> at <fair> 2026", or a fair named in the title.
STAND = re.compile(r"(\bat\b.+\b(19|20)\d\d\s*$|\b(abu dhabi art|art gstaad|art week|art fair|"
                   r"tefaf|frieze|art basel|fiac|armory show)\b)", re.I)
MUSEUM = re.compile(r"\b(museum|musée|musee|museo|museu|muzeum|kunsthalle|kunstmuseum|national gallery|"
                    r"gallery of art|art institute|institute of art|kunsthaus|pinakothek|tate|moma|"
                    r"whitney|guggenheim|biennale|biennial|documenta|smithsonian|academy|akademie)\b", re.I)


def fold(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def artist_names(credit, known):
    """A credit's artists: the first name always, a co-credit only when it is an artist elsewhere."""
    parts = [re.sub(r"\s*\([^)]*\)\s*$", "", p).strip() for p in str(credit or "").split(", ")]
    out = []
    for i, p in enumerate(parts):
        if p and (i == 0 or p in known) and p not in out:
            out.append(p)
    return out


def year(s):
    m = re.match(r"(\d{4})", str(s or ""))
    return int(m.group(1)) if m else 0


def main():
    finding = json.loads((SITE / "finding.json").read_text())
    widx = {w[0]: i for i, w in enumerate(finding["w"])}
    bare = set(re.sub(r"\s*\([^)]*\)\s*$", "", w[2] or "").strip() for w in finding["w"] if ", " not in (w[2] or ""))
    museums = json.loads((SITE / "museums.json").read_text())["museums"]
    mus_name = {fold(m["name"]): m["slug"] for m in museums}

    venues, vkey = [], {}
    shows, skey = [], {}
    asof = ""

    def venue(name, town, kind, slug):
        name = (name or "").strip()
        k = (fold(name), town or "")
        if k not in vkey:
            if not slug:
                slug = mus_name.get(fold(name), "")
            if slug:
                kind = "m"
            elif kind == "g":
                kind = "f" if FAIR.search(name) else "s" if SALEROOM.search(name) else "m" if MUSEUM.search(name) else "g"
            vkey[k] = len(venues)
            venues.append([name, town or "", kind, slug or "", 0, 0])
        return vkey[k]

    for path in sorted((SITE / "histories").glob("*.json")):
        h = json.loads(path.read_text())
        asof = max(asof, h.get("asof", ""))
        wi = widx.get(h["id"])
        if wi is None:
            continue
        threads = h.get("threads") or []
        for e in h["events"]:
            k = e["k"]
            if k == "exhibited":
                name = e.get("v") or e.get("who") or ""
                if not name and not e.get("t"):
                    continue
                vi = venue(name, e.get("p"), "g", e.get("m", ""))
                title = e.get("t") or ""
                # A gallery's stand at a fair is the gallery's, shown at the fair.
                typ = "f" if (FAIR.search(title) or STAND.search(title)) and venues[vi][2] != "m" else "x"
            elif k == "listed":
                if not e.get("who"):
                    continue
                vi = venue(e["who"], e.get("p"), "g", e.get("m", ""))
                title, typ = "", "l"
            elif k in ("offered", "sold"):
                name = e.get("who") or e.get("v") or ""
                if not name or not (e.get("t") or k == "offered"):
                    continue
                vi = venue(name, e.get("p"), "s", "")
                if venues[vi][2] == "g":
                    venues[vi][2] = "s"
                title, typ = e.get("t") or "", "o"
            else:
                continue
            start, end = str(e.get("y") or ""), str(e.get("e") or "")
            y = year(start)
            # A listing is one row a gallery and year; a show or a sale one row a title, venue and year.
            key = (typ, vi, fold(title), y)
            thr = ""
            for x in e.get("x") or []:
                if x < len(threads) and threads[x].get("k") in ("show", "sale"):
                    thr = threads[x]["id"]
            if key not in skey:
                skey[key] = len(shows)
                shows.append([title, vi, start, end, typ, thr, [], []])
            row = shows[skey[key]]
            if wi not in row[6]:
                row[6].append(wi)
            if thr and not row[5]:
                row[5] = thr
            if start and (not row[2] or start < row[2]):
                row[2] = start
            if end > row[3]:
                row[3] = end
            v = venues[vi]
            if y:
                v[4] = y if not v[4] else min(v[4], y)
                v[5] = max(v[5], year(end) or y)

    # Curators: a voice's act of curating, matched to the show of that title (and year, when both say).
    byname = {}
    for i, s in enumerate(shows):
        if s[4] in "xf" and s[0]:
            byname.setdefault(fold(s[0]), []).append(i)
    for path in sorted((SITE / "voices").glob("*.json")):
        if path.name == "credits.json":
            continue
        d = json.loads(path.read_text())
        for a in d.get("acts", []):
            if a.get("r") != "c" or not a.get("t"):
                continue
            for i in byname.get(fold(a["t"]), []):
                if a.get("y") and year(shows[i][2]) and abs(year(shows[i][2]) - a["y"]) > 1:
                    continue
                if d["id"] not in shows[i][7]:
                    shows[i][7].append(d["id"])

    # Newest first, then by title: the order every list of shows starts from.
    order = sorted(range(len(shows)), key=lambda i: (shows[i][2] or "0000", shows[i][3]), reverse=True)
    shows = [shows[i] for i in order]
    for s in shows:
        s[6].sort()
        s[7].sort()

    # The artists.
    lives = json.loads((SITE / "lives.json").read_text())["lives"]
    life = {r[1]: r for r in lives}
    wd_life = {}
    moves = None
    if (DATA / "studios" / "artists.json").exists() and (DATA / "movements" / "wd.json").exists():
        qa = json.loads((DATA / "studios" / "artists.json").read_text())
        wd = json.loads((DATA / "movements" / "wd.json").read_text())
        name_q = {}
        for q, a in qa.items():
            name_q.setdefault(a["name"], q)
            wd_life[a["name"]] = (a.get("birth") or 0, a.get("death") or 0)
        det = {d["m"]: d for d in wd["details"]}
        by_q = {}
        for mv in wd["moves"]:
            d = det.get(mv["m"])
            if not d or not d.get("label") or re.match(r"^Q\d+$", d["label"]):
                continue
            y0 = year(d.get("start") or d.get("inception"))
            y1 = year(d.get("end") or d.get("dissolved"))
            by_q.setdefault(mv["a"], []).append([d["label"], y0, y1, mv["m"]])
        moves = {n: sorted(by_q.get(q, []), key=lambda r: (r[1] or 9999, r[0])) for n, q in name_q.items()}
    elif OUT.exists():
        old = json.loads(OUT.read_text()).get("artists", {})
        moves = {n: r[3] for n, r in old.items()}
        wd_life = {n: (r[1], r[2]) for n, r in old.items()}
    moves = moves or {}

    artists = {}
    for i, w in enumerate(finding["w"]):
        for n in artist_names(w[2], bare):
            artists.setdefault(n, set())
    shows_of = {n: [] for n in artists}
    for si, s in enumerate(shows):
        names = set()
        for wi in s[6]:
            names.update(artist_names(finding["w"][wi][2], bare))
        for n in names:
            if n in shows_of:
                shows_of[n].append(si)
    out_art = {}
    for n in sorted(artists):
        L = life.get(n)
        born, died = (L[2], L[3] or 0) if L else wd_life.get(n, (0, 0))
        out_art[n] = [L[0] if L else "", born or 0, died or 0, moves.get(n, []), shows_of[n]]

    out = {
        "note": ("The categories' index (scripts/build_kinds.py): every show, gallery listing and sale a saved "
                 "work's public history names, the venues, and each artist's life, Wikidata P135 movements "
                 "(CC0) and shows. Works index finding.json's w; curators are voices/ ids. KINDS.md says how "
                 "the page uses it."),
        "asof": asof,
        "venues": venues,
        "shows": shows,
        "artists": out_art,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    now = sum(1 for s in shows if s[3] and s[3] >= asof)
    kinds = {t: sum(1 for s in shows if s[4] == t) for t in "xflo"}
    vk = {t: sum(1 for v in venues if v[2] == t) for t in "mgfs"}
    print(f"kinds.json: {len(shows)} shows ({kinds['x']} exhibitions, {kinds['f']} at fairs, {kinds['l']} listings, {kinds['o']} sales; "
          f"{now} open on {asof}), {len(venues)} venues ({vk}), {len(out_art)} artists "
          f"({sum(1 for r in out_art.values() if r[3])} with Wikidata movements), {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()

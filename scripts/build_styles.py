"""The styles and movements: every saved work in each, as a thread you can open from Search.

Artist, 8 Oct 2026 (searching "Impressionism" and finding only writings and shows): "I should be able
to look up an art movement or style and it have an option that takes me to all of the works in that
art movement or style."

Sources:
  - Artsy's own genes on each saved work (data/genes/<id>.json, fetched by fetch_work_genes.py; private
    cache) — the tag is Artsy's, on that very work. Artsy tags only about a quarter of the saved works, so
  - second, by the artist: Artsy's genes on the work's artist (data/genes/artists/), for a work whose own genes
    name no style, dated within the style's years (Wikidata's start and end; else the directly tagged works' span; else
    40 years from the start), ±5 years.
    Each such row ends "a"; the page says "by its artist's tag".
  - Which genes are movements or styles: a gene whose name (or display name) is the English label or alias
    of a Wikidata item that is an art movement (Q968159) or an art style (Q1792644), or a subclass of one
    (data/styles/wd_genes.json, CC0, asked once with --wikidata), plus Artsy's own names for schools and
    movements Wikidata labels otherwise (HAND, each said so). Subject, medium, colour and period genes are
    never styles.

Writes (public files only):
  docs/v2/styles.json            {note, styles: [[id, name, n works, first year, last year, qid or "", artists]]}
  docs/v2/threads/style-<id>.json   a thread of kind "style" (the thread view lists its works by date):
                                    rows [id, title, artist, image, year made, where made, where now]
Same bytes every run. Run after build_artwork_histories.py (which keeps style-* threads when it rewrites
threads/, and calls this at its end).
"""
import json, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs" / "v2"
GENES = ROOT / "data" / "genes"
WD = ROOT / "data" / "styles" / "wd_genes.json"

# Artsy's names for movements and schools, kept where Wikidata's label differs or the item is a school.
HAND = {
    "New York School": "a school, by Artsy's gene",
    "Pre-World War II School of Paris": "Artsy's name for the School of Paris before 1940",
    "Post-War School of Paris": "Artsy's name for the School of Paris after 1945",
    "American Impressionism": "Artsy's gene",
    "Light and Space Movement": "Artsy's name for Light and Space",
    "Contemporary Conceptualism": "Artsy's gene",
    "Black Mountain College": "a school and its circle, by Artsy's gene",
    "Hudson River School": "a school, by Artsy's gene",
    "Old Masters": "Artsy's gene for European painting before about 1800",
    "Bauhaus": "a school, by Artsy's gene",
    "Pictorialism": "Artsy's gene",
    "Neo-Expressionism": "Artsy's gene",
    "Neo-Impressionism": "Artsy's gene",
    "Pop Art": "Artsy's gene",
    "Contemporary Pop": "Artsy's gene",
    "Op Art": "Artsy's gene",
    "Color Field Painting": "Artsy's gene",
    "Hard-Edge Painting": "Artsy's gene",
    "Post-Painterly Abstraction": "Artsy's gene",
    "Lyrical Abstraction": "Artsy's gene",
    "Arte Povera": "Artsy's gene",
    "Fluxus": "Artsy's gene",
    "Gutai": "Artsy's gene",
    "Mono-ha": "Artsy's gene",
    "Pictures Generation": "Artsy's gene",
    "Young British Artists": "Artsy's gene",
    "Nabis": "Artsy's gene",
    "Barbizon School": "a school, by Artsy's gene",
    "Ashcan School": "a school, by Artsy's gene",
    "Düsseldorf School of Photography": "a school, by Artsy's gene",
    "Bay Area Figurative Movement": "Artsy's gene",
    "Chicago Imagists": "Artsy's gene",
    "Harlem Renaissance": "Artsy's gene",
    "Fauvism": "Artsy's gene",
    "Pointillism": "Artsy's gene",
    "Post-Impressionism": "Artsy's gene",
    "Realism": "Artsy's gene",
    "Rococo": "Artsy's gene",
    "Academic Art": "Artsy's gene",
    "Social Realism": "Artsy's gene",
    "Regionalism": "Artsy's gene",
    "Precisionism": "Artsy's gene",
    "Photorealism": "Artsy's gene",
    "Neo-Pop": "Artsy's gene",
    "Street Art": "Artsy's gene",
    "Land Art": "Artsy's gene",
    "Kinetic Art": "Artsy's gene",
    "Zero Group": "Artsy's gene",
    "CoBrA": "Artsy's gene",
    "Tonalism": "Artsy's gene",
    "Orphism": "Artsy's gene",
    "Vorticism": "Artsy's gene",
    "Suprematism": "Artsy's gene",
    "Art Deco": "Artsy's gene",
}
# Genes that are never a style, though some share a label with a Wikidata movement item.
NOT = {"Painting", "Drawing", "Sculpture", "Photography", "Prints", "Collage", "Installation", "Study",
       "Portrait", "Still Life", "Abstract Art", "Figurative Art", "Abstract Painting", "Figurative Painting",
       "Work on Paper", "Movement", "Text", "Nude", "Landscapes", "Modern Photography", "Documentary Photography",
       "Color Photography", "Black-and-White Photography", "Street Photography", "Mixed-Media", "Watercolor",
       "Lithograph", "Etching/Engraving", "Screen Printing", "Woodcut", "Political", "Narrative", "Geometric",
       "Patterns", "Repetition", "Iconic Works of Art History", "Abstract Landscape", "Self-Portrait",
       "Cityscapes", "Interiors", "Animals", "Flora", "Nature", "Water", "Food", "Time", "Decay", "Celebrity",
       "Americana", "Psychoanalysis", "Primary Abstraction", "Christian Art and Architecture",
       "Mythology and Religion", "Collective History", "Personal Histories", "Visual Perception",
       "Light as Subject", "Color Theory", "En plein air", "Chiaroscuro", "Automatism", "Impasto", "Gestural",
       "Black and White", "Glamour", "Grotesque", "Humor"}
CLASSES = ["Q968159", "Q1792644"]       # art movement, art style


def fold(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def slug(s):
    return fold(s).replace(" ", "-")


def genes():
    out = {}
    for f in sorted(GENES.glob("*.json")):
        out[f.stem] = json.loads(f.read_text())
    return out


def artist_genes():
    """{work id: genes of its artists} — Artsy's genes on the artist (fetch_work_genes.py)."""
    of = ROOT / "data" / "genes_artists_of.json"
    if not of.exists():
        return {}
    by_work = json.loads(of.read_text())
    cache = {}
    out = {}
    for wid, arts in by_work.items():
        gl = []
        for a in arts:
            if a not in cache:
                f = GENES / "artists" / (a + ".json")
                cache[a] = json.loads(f.read_text()) if f.exists() else []
            gl += cache[a]
        out[wid] = gl
    return out


def ask_wikidata(names):
    """Which of these names are an art movement's or style's English label or alias."""
    found = {}
    # Wikidata writes most movements in lower case ("abstract expressionism"): both are asked, matched folded.
    names = sorted(set(names) | {n.lower() for n in names})
    for i in range(0, len(names), 60):
        vals = " ".join(json.dumps(n) + "@en" for n in names[i:i + 60])
        q = ("SELECT DISTINCT ?l ?m ?s ?e WHERE { VALUES ?l { %s } { ?m rdfs:label ?l } UNION { ?m skos:altLabel ?l } "
             "?m wdt:P31 ?c . ?c wdt:P279* ?k . VALUES ?k { wd:%s } "
             "OPTIONAL { ?m wdt:P580|wdt:P571 ?s } OPTIONAL { ?m wdt:P582|wdt:P576 ?e } }") % (vals, " wd:".join(CLASSES))
        url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"})
        for attempt in range(5):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "ArtistWebsite/1.0 (build_styles)"})
                with urllib.request.urlopen(req, timeout=90) as r:
                    d = json.load(r)
                break
            except Exception as e:
                print("retry", i, e, file=sys.stderr)
                time.sleep(5 * (attempt + 1))
        else:
            raise SystemExit("Wikidata did not answer")
        for b in d["results"]["bindings"]:
            l = b["l"]["value"].lower()
            qid = b["m"]["value"].rsplit("/", 1)[1]
            y0 = year(b.get("s", {}).get("value", "")) or None
            y1 = year(b.get("e", {}).get("value", "")) or None
            prev = found.get(l)
            # The lowest Q number is the main item, as a rule; its earliest start and latest end.
            if not prev or int(qid[1:]) < int(prev[0][1:]):
                found[l] = [qid, y0, y1]
            elif prev[0] == qid:
                prev[1] = min(x for x in (prev[1], y0) if x) if (prev[1] or y0) else None
                prev[2] = max(x for x in (prev[2], y1) if x) if (prev[2] or y1) else None
        time.sleep(1)
    return found


def year(d):
    m = re.search(r"\b(1[0-9]{3}|20[0-9]{2})\b", d or "")
    return int(m.group(1)) if m else 0


def main():
    g = genes()
    ga = artist_genes()
    names = set()
    for gl in list(g.values()) + list(ga.values()):
        for x in gl:
            names.add(x["name"])
            if x.get("display_name"):
                names.add(x["display_name"])
    if "--wikidata" in sys.argv or not WD.exists():
        WD.parent.mkdir(parents=True, exist_ok=True)
        WD.write_text(json.dumps(ask_wikidata(names), indent=1, sort_keys=True))
    wd = {k: (v if isinstance(v, list) else [v, None, None]) for k, v in json.loads(WD.read_text()).items()}

    def style_of(x):
        n = x["name"]
        if n in NOT:
            return None
        if n in HAND:
            return n, (wd.get(n.lower()) or [""])[0]
        # A period ("1860–1969"), never a style; nor an item made lately to mirror Artsy's genes (Q13…, 2025–26).
        if re.search(r"[0-9]", n):
            return None
        for cand in (n, x.get("display_name") or ""):
            q = (wd.get(cand.lower()) or [None])[0] if cand else None
            if q and int(q[1:]) < 130000000:
                return n, q
        return None

    finding = json.loads((SITE / "finding.json").read_text())
    rows = {w[0]: w for w in finding["w"]}
    styles = {}
    for wid, gl in sorted(g.items()):
        if wid not in rows:
            continue
        for x in gl:
            s = style_of(x)
            if s:
                styles.setdefault(s, set()).add(wid)
    # The second tier, by the artist: a work whose own genes do not say, whose artist Artsy tags with the style,
    # dated within the style's years — Wikidata's (start to end, or to now), else those of the works tagged
    # directly — five years either side. Never a work Artsy tagged itself with other styles only.
    by_artist = {}
    qyears = {v[0]: (v[1], v[2]) for v in wd.values()}
    for wid, gl in sorted(ga.items()):
        if wid not in rows or any(style_of(x) for x in g.get(wid, [])):
            continue
        y = year(rows[wid][3])
        if not y:
            continue
        for x in gl:
            st = style_of(x)
            if not st:
                continue
            y0, y1 = qyears.get(st[1], (None, None)) if st[1] else (None, None)
            own = [year(rows[w][3]) for w in styles.get(st, ()) if year(rows[w][3])]
            # Where Wikidata gives no end (or no start), the works Artsy tagged directly say it, else 40 years.
            if not y0:
                if len(own) < 3:
                    continue
                y0 = min(own)
            if not y1:
                y1 = max(own) if len(own) >= 3 else y0 + 40
            if y0 - 5 <= y <= y1 + 5:
                by_artist.setdefault(st, set()).add(wid)
    for st, ids in by_artist.items():
        styles.setdefault(st, set())

    out = []
    total = lambda st: len(styles[st] | by_artist.get(st, set()))
    for (name, qid) in sorted(styles, key=lambda st: (-total(st), st[0])):
        ids = styles[(name, qid)]
        more = by_artist.get((name, qid), set()) - ids
        if len(ids) + len(more) < 2:
            continue
        sid = "style-" + slug(name)
        works = []
        for wid in sorted(ids) + sorted(more):
            h = json.loads((SITE / "histories" / (wid + ".json")).read_text())
            r = rows[wid]
            made = next((e.get("p") for e in h.get("events", []) if e.get("k") == "made" and e.get("p")), 0) or 0
            now = next((e.get("p") for e in reversed(h.get("events", [])) if e.get("p") and e.get("k") != "written"), 0) or 0
            row = [wid, r[1], r[2], r[4], year(r[3]), made, now]
            if wid in more:
                row.append("a")                         # by its artist: Artsy tags the artist, not this work
            works.append((year(r[3]) or 9999, r[1], row))
        works.sort(key=lambda w: (w[0], w[1]))
        ys = [w[0] for w in works if w[0] != 9999]
        artists = len({w[2][2] for w in works})
        thread = {"id": sid, "k": "style", "name": name, "at": "", "y": min(ys) if ys else 0, "ll": None,
                  "qid": qid, "said": HAND.get(name) or "Artsy's gene on each work; a movement or style on Wikidata",
                  "works": [w[2] for w in works]}
        (SITE / "threads" / (sid + ".json")).write_text(json.dumps(thread, ensure_ascii=False, separators=(",", ":")))
        out.append([sid, name, len(works), min(ys) if ys else 0, max(ys) if ys else 0, qid, artists, len(more)])
    keep = {r[0] for r in out}
    for f in (SITE / "threads").glob("style-*.json"):
        if f.stem not in keep:
            f.unlink()
    note = ("Styles and movements: Artsy's own genes on each saved work, kept where the gene is an art movement or "
            "style on Wikidata (CC0) or one of Artsy's school names. Written by scripts/build_styles.py.")
    (SITE / "styles.json").write_text(json.dumps({"note": note, "styles": out}, ensure_ascii=False, separators=(",", ":")))
    print(len(out), "styles;", sum(r[2] for r in out), "placings;",
          len({w for ids in styles.values() for w in ids} | {w for ids in by_artist.values() for w in ids}), "works;",
          sum(r[7] for r in out), "by the artist")
    for r in out[:40]:
        print(r)


if __name__ == "__main__":
    main()

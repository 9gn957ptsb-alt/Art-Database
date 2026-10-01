#!/usr/bin/env python3
"""The voices: the writers, critics and curators of the saved works, as a way round the globe.

The artist, 1 Oct 2026, on the idea "the quotes are a network of their own … writers could become a
fourth layer you follow, like the animals: follow Roberta Smith through every work she wrote about":
"Implement your idea about using writers and curators as other ways of navigating the globe".

Who is a voice. A person the public record names in one of three published roles:
  said     a writer, critic or curator quoted on a work (`said` with k "writer" in its history);
  wrote    the author of a writing about a work (a `written` event's `who`: catalogues, articles,
           catalogues raisonnés), split into its authors and turned the right way round
           ("Walker, John" is John Walker; "Cairns, Huntington, and John Walker, eds" is two people);
  curated  the curator a show's own words name — "curated by …" in an `exhibited` event's source
           words, or in the show's press release (voices/credits.json, distil_show_credits.py).
Never: the work's own artist (their words belong to the artist's map), an owner or collector, a
dealer, gallery, auction house, museum or publisher (an `owned` or `sold` event never makes a voice,
and a name that is an institution's is not a person's), anyone OWNER_STOP turns away. One person under
two spellings is one voice ("Varnedoe, Kirk" and "Kirk Varnedoe", "J.-B. de la Faille" and "Jacob
Baart de la Faille") only when nothing else could be meant: same surname, given names that agree
(initials and words), and, for a surname alone ("Bloch"), exactly one fuller name of it among the
writers of the same artist. Two people are never merged: "J. Walker" next to John and James Walker
stays apart. A source's own slip is put right only in ALIASES, each with its reason.

A voice with two connections or more (two works, or two acts on one) can be followed; one with a
single connection stays plain text, found by Find and leading to its one work.

Places. A show's place is the history's own (its `p`); a writing's is the city it was published in
when the citation says (its `w`; a town named in a quotation's citation, "Zurich Kunsthaus"; a town said
as an imprint in a writing's, "(Houston: Museum of Fine Arts, 1976)", "New York, 1994"), else the
museum's town that holds the work, else where the work was at that time (the latest placed event no
later than the writing's year); each marked so (`pr`: pub, said, held, work, show). Each voice's places come in time order — a career is a route.

Reads only public files in docs/v2/ — histories/, cities.json and voices/credits.json — and writes:

  docs/v2/voices.json         the index: {note, voices: [[id, name, roles, works, places, line, f]],
                              w: {work id: [[voice row, [spellings]], …]}, a: {artist: [voice row, …]}}
                              roles "c", "w", "s" (curated, wrote, was quoted); f 1 when followable,
                              else the one work's id; a: the followable voices on each artist, most
                              connected first (eight at most)
  docs/v2/voices/<id>.json    a followable voice: {id, name, who, said, acts, works, places, path}

Same bytes every run. Run by build_artwork_histories.py at the end, after build_cities.

    python3 scripts/build_voices.py [--show NAME]
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs" / "v2"
OUT = SITE / "voices.json"
DIR = SITE / "voices"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_artwork_histories import OWNER_STOP, city_name  # noqa: E402

NOTE = ("The writers, critics and curators of the saved works, from their histories' published words. "
        "Written by scripts/build_voices.py — public files only.")

# A source's slip, put right: (as written) -> (the person), with the reason.
ALIASES = {
    # Cy Twombly: A Retrospective (The Museum of Modern Art, New York, 1994) is Kirk Varnedoe's catalogue.
    "Kurt Varnedoe": "Kirk Varnedoe",
    # The critic writes his name with its hyphen; one catalogue dropped it.
    "Edward Lucie Smith": "Edward Lucie-Smith",
}

PARTICLES = {"van", "von", "de", "der", "den", "la", "le", "di", "da", "del", "della", "dos", "du", "ten", "ter",
             "des", "d'", "zu"}
SUFFIX = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}
NOT_A_PERSON = re.compile(
    r"\b(gallery|galleries|galerie|galleria|museum|museo|musée|musee|foundation|fondazione|fondation|stiftung|"
    r"collection|center|centre|institute|institut|council|fair|studio|staff|team|committee|program|society|"
    r"association|university|universit|college|library|kunsthalle|kunsthaus|biennale|biennial|arts?|inc|ltd|llc|"
    r"co\.|company|corporation|projects?|advisory|heritage|department|school|academy|trust|archives?|archivio|"
    r"press|books|publishing|publishers?|editions?|edizioni|éditions|verlag|hudson|abrams|phaidon|rizzoli|skira|"
    r"taschen|magazine|times|journal|review|news|gazette|herald|tribune|post|bulletin|quarterly|monthly|weekly|"
    r"sotheby|christie|phillips|bonhams|dorotheum|auction|auctions|catalogue|catalog|exhibition|anonymous|unknown|"
    r"various|unsigned|editors?|staff|national|nga|cma|moma|the|hollstein|cantz|hatje|dumont|prestel|"
    r"yale|harvard|princeton|chicago|oxford|cambridge|flammarion|gallimard|hazan|electa|mondadori|einaudi|"
    r"lund|humphries|scala|wiley|norton|knopf|random|penguin|viking|braziller|hirmer|kehrer|steidl|aperture|"
    r"ludion|snoeck|wienand|könig|koenig|kerber|bijutsu|shuppan|shinbun|shimbun)\b", re.I)


def fold(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def slug(t):
    return fold(t).replace(" ", "-")


def year_of(v):
    m = re.search(r"\b(1[5-9]\d\d|20[0-2]\d)\b", str(v or ""))
    return int(m.group(1)) if m else 0


# ---- names -----------------------------------------------------------------------------------------

def clean_name(n):
    n = re.sub(r"\s+", " ", n.replace(" ", " ")).strip(" ,.;:*_")
    n = re.sub(r"^(by|and|with|ed\.?|eds\.?|edited by|introduction by|text by|essay by|foreword by)\s+", "", n, flags=re.I)
    n = re.sub(r"\s*\((eds?|comp|trans|dir)\.?\)$", "", n, flags=re.I)
    n = re.sub(r",?\s+(eds?|comp|trans|et al|et alii|dir)\.?$", "", n, flags=re.I)
    return n.strip(" ,.;:")


def name_like(n, bare_ok=False):
    toks = n.split()
    if not toks or len(toks) > 5 or re.search(r"\d|[\"“”«»()\[\]/]", n) or NOT_A_PERSON.search(n):
        return False
    if len(toks) == 1 and not bare_ok:
        return False
    for t in toks:
        if t.lower().strip(".") in PARTICLES or t.lower() in SUFFIX:
            continue
        if not re.match(r"[A-ZÀ-ÖØ-Þ]", t):
            return False
    if toks[-1].lower() in PARTICLES or (len(toks[-1]) <= 2 and toks[-1].endswith(".")):
        return False
    if OWNER_STOP.search(fold(n)):
        return False
    return True


SURNAME_RE = r"((?:(?:%s)\s+)*[A-ZÀ-ÖØ-Þ][\w'’\-]+)" % "|".join(sorted((p for p in PARTICLES if p.isalpha()), key=len, reverse=True))


def authors(who):
    """The people a `who` names, each as First Last: "Walker, John" → John Walker."""
    s = clean_name(who or "")
    s = s.replace(" & ", " and ")
    out = []
    for part in s.split(";"):
        part = clean_name(part)
        if not part:
            continue
        # Inverted first author: "Surname, Given[ particles][, rest]"
        m = re.match(SURNAME_RE + r",\s*([A-ZÀ-ÖØ-Þ][\w'’.\-]*(?:\s+(?:[A-ZÀ-ÖØ-Þ][\w'’.\-]*|"
                     + "|".join(p for p in PARTICLES if p.isalpha()) + r")){0,3})(?:,\s*(?:and\s+)?(.+))?$", part)
        names = []
        if m and not re.search(r"\s", m.group(2).split(" ")[0]) and len(m.group(2).split()) <= 4:
            given = m.group(2).split()
            sur = m.group(1)
            while given and given[-1].lower() in PARTICLES:          # "Faille, J.-B. de la"
                sur = given.pop() + " " + sur
            # "Walter Feilchenfeldt, Jayne Warman" is a list, not "Feilchenfeldt, Walter": the inverted
            # reading needs the surname alone before the comma (checked by SURNAME_RE taking one word).
            if given:
                names.append(" ".join(given) + " " + sur)
                rest = m.group(3) or ""
                names += [clean_name(x) for x in re.split(r",\s*(?:and\s+)?|\s+and\s+|\s+with\s+", rest) if x.strip()]
            else:
                names = [clean_name(x) for x in re.split(r",\s*(?:and\s+)?|\s+and\s+|\s+with\s+", part)]
        else:
            names = [clean_name(x) for x in re.split(r",\s*(?:and\s+)?|\s+and\s+|\s+with\s+", part)]
        out += [n for n in names if n]
    seen, res = set(), []
    for n in out:
        n = ALIASES.get(n, n)
        if fold(n) not in seen:
            seen.add(fold(n))
            res.append(n)
    return res


def split_name(n):
    """(given tokens, surname) of a First Last name; the surname keeps its particles."""
    toks = [t for t in n.split() if t.lower() not in SUFFIX]
    if not toks:
        return [], ""
    k = len(toks) - 1
    while k > 0 and toks[k - 1].lower() in PARTICLES:
        k -= 1
    return toks[:k], " ".join(toks[k:])


def given_parts(given):
    """[(initial, word or None)]: "J.-B." → [(j, None), (b, None)]; "Kirk" → [(k, kirk)]."""
    out = []
    for g in given:
        for piece in re.split(r"[-‐]", g):
            p = fold(piece)
            if not p:
                continue
            word = p if len(p) > 1 and not piece.endswith(".") else None
            out.append((p[0], word))
    return out


def compatible(a, b):
    ga, gb = given_parts(a), given_parts(b)
    if not ga or not gb:
        return False
    wa = {w for _, w in ga if w}
    wb = {w for _, w in gb if w}
    if wa and wb and not (wa & wb):
        return False
    short, long_ = (ga, gb) if len(ga) <= len(gb) else (gb, ga)
    it = iter([i for i, _ in long_])
    if not all(any(i == j for j in it) for i, _ in short):
        return False
    # A word against a word in the same place must agree ("John" is not "James").
    for (i1, w1), (i2, w2) in zip(ga, gb):
        if w1 and w2 and w1 != w2 and not (wa & wb):
            return False
    return True


# ---- places ----------------------------------------------------------------------------------------

class Towns:
    def __init__(self, rows):
        self.rows = {r[0]: r for r in rows}
        self.by_name = defaultdict(list)
        for r in rows:
            self.by_name[fold(r[1])].append(r)
        for v in self.by_name.values():
            v.sort(key=lambda r: -r[5])
        # Town names a citation may say, longest first, for the ones with some weight.
        self.sayable = sorted({r[1] for r in rows if r[5] >= 3 and len(r[1]) >= 4},
                              key=lambda n: (-len(n), n))

    def named(self, where):
        """ "Milan, IT" or "Napoli" → the town row, or None."""
        if not where:
            return None
        bits = [b.strip() for b in str(where).split(",")]
        name = city_name(bits[0])
        cc = bits[-1].upper() if len(bits) > 1 and len(bits[-1]) == 2 else ""
        rows = self.by_name.get(fold(name), [])
        if cc:
            rows = [r for r in rows if r[2] == cc] or []
        return rows[0] if rows else None

    def said_in(self, text, strict=False):
        """The town a citation says it was published in, its titles left out ("Paris Street" is a title).
        Strict (a writing's citation, whose untagged titles may name towns): only where a town is said
        as an imprint is — "(Houston: Museum of Fine Arts, 1976)", "Milan 1993", "New York, 1994"."""
        text = re.sub(r"“[^”]*”|\"[^\"]*\"|\*[^*]*\*|_[^_]*_", " ", text or "")
        for n in self.sayable:
            e = re.escape(n)
            pat = (r"(?:\(\s*|[,;.]\s+)" + e + r"(?:\s*:|(?:,\s*[A-Z][A-Za-z.]{0,5})?,?\s+(?:\d{1,2}\s+\w+\s+)?(?:1[5-9]|20)\d\d\b)") if strict \
                else r"(?<![\w])" + e + r"(?![\w])"
            if re.search(pat, text):
                return self.by_name[fold(n)][0]
        return None


def holder(h):
    """Where the museum that holds the work now is (a `held` event with a place), or None."""
    for e in h["events"]:
        if e["k"] == "held" and e.get("p"):
            return e["p"]
    return None


def where_then(h, year):
    """Where the work was at that year: the latest placed event no later than it, else its first place."""
    placed = [(year_of(e.get("y")), i, e["p"]) for i, e in enumerate(h["events"]) if e.get("p")]
    if not placed:
        return None
    if year:
        before = [p for p in placed if p[0] and p[0] <= year]
        if before:
            return max(before)[2]
    return placed[0][2]


# ---- the build -------------------------------------------------------------------------------------

def main():
    show = sys.argv[sys.argv.index("--show") + 1] if "--show" in sys.argv else None
    towns = Towns(json.loads((SITE / "cities.json").read_text())["towns"])
    credits = json.loads((DIR / "credits.json").read_text())["shows"] if (DIR / "credits.json").exists() else []
    hist = {}
    for f in sorted((SITE / "histories").glob("*.json")):
        h = json.loads(f.read_text())
        hist[h["id"]] = h

    raw = []          # (spelling, work id, connection)

    def artist_words(h):
        out = set()
        for a in h.get("artists") or []:
            a = re.sub(r"\s*\(.*?\)", "", a)
            out.add(fold(a))
            if a.split():
                out.add(fold(a.split()[-1]))
        return out

    def is_artist(name, h):
        f = fold(name)
        arts = artist_words(h)
        return f in arts or (f.split() and f.split()[-1] in arts and len(f.split()) <= 3 and
                             any(fold(a).split()[0][:1] == f[:1] for a in h.get("artists") or [] if fold(a)))

    for wid, h in hist.items():
        # Quoted.
        for s in h.get("said") or []:
            if s.get("k") != "writer" or not s.get("by"):
                continue
            n = ALIASES.get(clean_name(s["by"]), clean_name(s["by"]))
            if not name_like(n) or is_artist(n, h):
                continue
            y = year_of(s.get("in"))
            t = towns.said_in(s.get("in", ""))
            key, pr = (t[0], "said") if t else (where_then(h, y), "work")
            raw.append((n, s["by"], wid, {"r": "s", "q": s["q"], "in": s.get("in", ""), "via": s.get("via", ""),
                                          "y": y, "p": key, "pr": pr}))
        for ev in h["events"]:
            if ev["k"] == "written" and ev.get("who") and not ev.get("v"):
                y = year_of(ev.get("y"))
                # Where it was published, as the citation says; else where the work is held; else where
                # it was at the time (the histories' exhibitions are the least sure of these).
                t = towns.named(ev.get("w")) or towns.said_in(ev.get("q"), strict=True)
                key, pr = (t[0], "pub") if t else (holder(h), "held") if holder(h) else (where_then(h, y), "work")
                for n in authors(ev["who"]):
                    if not name_like(n, bare_ok=True) or is_artist(n, h):
                        continue
                    raw.append((n, ev["who"], wid, {"r": "w", "t": ev.get("t") or ev.get("pub") or "",
                                                    "pub": ev.get("pub") if ev.get("pub") != ev.get("t") else "",
                                                    "y": y, "cite": ev.get("q", ""), "p": key, "pr": pr}))
            if ev["k"] == "exhibited":
                text = " ".join(str(ev.get(k) or "") for k in ("q", "n"))
                m = re.search(r"\b(?:co-|guest )?curated by\s+((?:[A-ZÀ-ÖØ-Þ][\w'’\-]*\.?\s*){2,4})", text)
                if m and "catalogue curated" not in text[max(0, m.start() - 12):m.end()]:
                    n = clean_name(m.group(1))
                    if name_like(n) and not is_artist(n, h):
                        raw.append((n, m.group(1).strip(), wid, {"r": "c", "t": ev.get("t") or "", "at": ev.get("v") or "",
                                                                 "y": year_of(ev.get("y")), "p": ev.get("p"), "pr": "show"}))
    # The shows' own credits.
    for c in credits:
        for wid in c["works"]:
            h = hist.get(wid)
            if not h:
                continue
            ev = next((e for e in h["events"] if e["k"] == "exhibited" and fold(e.get("t")) == fold(c["show"])), None)
            key = ev.get("p") if ev else None
            if not key:
                t = towns.named(c.get("city"))
                key = t[0] if t else None
            y = year_of(ev.get("y")) if ev else year_of(c.get("y"))
            for n in c["by"]:
                n = ALIASES.get(n, n)
                if not name_like(n) or is_artist(n, h):
                    continue
                raw.append((n, n, wid, {"r": "c", "t": c["show"], "at": c.get("at", ""), "y": y or year_of(c.get("y")),
                                        "q": c.get("q", ""), "p": key, "pr": "show"}))

    # ---- one person under several spellings ----
    spell = Counter(n for n, _, _, _ in raw)
    arts_of = defaultdict(set)
    for n, _, wid, _ in raw:
        arts_of[n] |= {fold(a) for a in hist[wid].get("artists") or []}
    by_sur = defaultdict(list)
    for n in spell:
        g, s = split_name(n)
        by_sur[fold(s).replace(" ", "")].append(n)
    person_of = {}
    for sur, names in sorted(by_sur.items()):
        full = sorted([n for n in names if split_name(n)[0]],
                      key=lambda n: (-sum(1 for _, w in given_parts(split_name(n)[0]) if w),
                                     -len(given_parts(split_name(n)[0])), -spell[n], n))
        clusters = []
        for n in full:
            g = split_name(n)[0]
            fits = [c for c in clusters if all(compatible(g, split_name(m)[0]) for m in c)]
            if len(fits) == 1:
                fits[0].append(n)
            else:
                clusters.append([n])
        for n in names:
            if split_name(n)[0]:
                continue
            # A surname alone: the one fuller name of it among the same artists' writers.
            fits = [c for c in clusters if any(arts_of[n] & arts_of[m] for m in c)]
            if len(fits) == 1 and len(clusters) == 1:
                fits[0].append(n)
        for c in clusters:
            # Its name: the spelling written most, with a given name in words where there is one.
            best = sorted(c, key=lambda m: (-bool(split_name(m)[0]), -any(w for _, w in given_parts(split_name(m)[0])),
                                            -spell[m], -len(m), m))[0]
            for m in c:
                person_of[m] = best

    people = defaultdict(lambda: {"conn": [], "spell": defaultdict(set)})
    for n, spelled, wid, c in raw:
        p = person_of.get(n)
        if not p:
            continue                   # a surname alone that could be anyone
        people[p]["conn"].append((wid, c))
        people[p]["spell"][wid].add(spelled)
        if fold(n) != fold(spelled):
            people[p]["spell"][wid].add(n)

    # ---- per person ----
    rows, details = [], {}
    for name in sorted(people, key=fold):
        P = people[name]
        seen, conns = set(), []
        for wid, c in P["conn"]:
            k = (wid, c["r"], fold(c.get("t") or c.get("q", "")[:60]))
            if k in seen:
                continue
            seen.add(k)
            conns.append((wid, c))
        works = sorted({w for w, _ in conns}, key=lambda w: (hist[w].get("title") or "", w))
        roles = "".join(r for r in "cws" if any(c["r"] == r for _, c in conns))
        follow = len(conns) >= 2 and any(c.get("p") in towns.rows for _, c in conns)
        # Places in time order (a connection with no year keeps its work's order, after the dated).
        timed = sorted(conns, key=lambda wc: (wc[1]["y"] or 9999, hist[wc[0]].get("title") or "", wc[0]))
        order = []
        for _, c in timed:
            if c.get("p") and c["p"] in towns.rows and c["p"] not in order:
                order.append(c["p"])
        what = []
        nc = sum(1 for _, c in conns if c["r"] == "c")
        nw = len({w for w, c in conns if c["r"] in "ws"})
        if nc:
            shows = len({fold(c["t"]) for _, c in conns if c["r"] == "c"})
            what.append(f"curated {shows} show" + ("s" if shows != 1 else ""))
        if nw:
            what.append(f"wrote on {nw} work" + ("s" if nw != 1 else ""))
        line = ", ".join(what)
        vid = slug(name) or "voice"
        rows.append([vid, name, roles, len(works), len(order), line, 1 if follow else works[0]])
        if not follow:
            continue
        widx = {w: i for i, w in enumerate(works)}
        places = []
        for key in order:
            t = towns.rows[key]
            here = sorted({widx[w] for w, c in conns if c.get("p") == key})
            yrs = [c["y"] for _, c in conns if c.get("p") == key and c["y"]]
            places.append([key, t[1], t[2], t[3], t[4], here, [], None, min(yrs) if yrs else 0])
        path = []
        for _, c in timed:
            if c.get("p") in towns.rows:
                t = towns.rows[c["p"]]
                if not path or path[-1][0] != c["p"]:
                    path.append([c["p"], t[3], t[4], c["y"]])
        said, acts = [], []
        for wid, c in timed:
            i = widx[wid]
            if c["r"] == "s":
                said.append({"w": i, "q": c["q"], "in": c["in"], "via": c["via"], "y": c["y"], "p": c["p"] or "",
                             "pr": c["pr"]})
            else:
                a = {"r": c["r"], "w": i, "t": c.get("t", ""), "y": c["y"], "p": c["p"] or "", "pr": c["pr"]}
                for k in ("at", "pub", "cite", "q"):
                    if c.get(k):
                        a[k] = c[k][:400]
                acts.append(a)
        role = ("curator and writer" if "c" in roles and ("w" in roles or "s" in roles)
                else "curator" if "c" in roles else "writer")
        names = [towns.rows[k][1] for k in order]
        who = role + (" · " + ", ".join(names[:4]) + (" …" if len(names) > 4 else "") if names else "")
        details[vid] = {"id": vid, "name": name, "who": who, "line": line, "said": said, "acts": acts,
                        "works": [[w, hist[w].get("title") or "Untitled", (hist[w].get("artists") or [""])[0],
                                   hist[w].get("image") or "", year_of(hist[w].get("date"))] for w in works],
                        "places": places, "path": path}
    # ids unique
    used = Counter()
    for r in rows:
        used[r[0]] += 1
        if used[r[0]] > 1:
            old = r[0]
            r[0] = f"{old}-{used[old]}"
            if old in details and details[old]["name"] == r[1]:
                details[r[0]] = details.pop(old)
                details[r[0]]["id"] = r[0]
    index = {r[1]: i for i, r in enumerate(rows)}
    wmap = defaultdict(list)
    amap = defaultdict(list)
    for name in sorted(people, key=fold):
        i = index[name]
        for wid, sp in sorted(people[name]["spell"].items()):
            wmap[wid].append([i, sorted(sp)])
        if rows[i][6] == 1:
            for a in sorted({(hist[w].get("artists") or [""])[0] for w, _ in people[name]["conn"]}):
                if a:
                    amap[a].append(i)
    for a in amap:
        amap[a] = sorted(amap[a], key=lambda i: (-rows[i][3], fold(rows[i][1])))[:8]
    DIR.mkdir(parents=True, exist_ok=True)
    keep = {"credits.json"} | {f"{v}.json" for v in details}
    for f in DIR.glob("*.json"):
        if f.name not in keep:
            f.unlink()
    for vid, d in details.items():
        (DIR / f"{vid}.json").write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n")
    OUT.write_text(json.dumps({"note": NOTE, "voices": rows, "w": dict(sorted(wmap.items())),
                               "a": dict(sorted(amap.items()))},
                              ensure_ascii=False, separators=(",", ":")) + "\n")
    fol = [r for r in rows if r[6] == 1]
    print(f"{len(rows)} voices, {len(fol)} followable "
          f"({sum(1 for r in fol if 'c' in r[2])} curators, {sum(1 for r in fol if 'w' in r[2] or 's' in r[2])} writers); "
          f"{len(wmap)} works have a voice")
    for r in sorted(fol, key=lambda r: (-r[3], r[1]))[:15]:
        print(f"  {r[1]} · {r[5]} · {r[4]} places")
    if show:
        for r in rows:
            if fold(show) in fold(r[1]):
                print(json.dumps(r, ensure_ascii=False))
                if r[0] in details:
                    print(json.dumps(details[r[0]], ensure_ascii=False, indent=1)[:4000])


if __name__ == "__main__":
    main()

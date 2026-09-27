#!/usr/bin/env python3
"""What the National Gallery of Art, Washington, says about the saved works it holds — one layer of
the artworks' histories: who owned each work (provenance), where it was shown (exhibition history)
and what has been written about it (bibliography).

Reads the NGA's open data (github.com/NationalGalleryOfArt/opendata, CC0; the data dictionary is
documentation/Data Dictionary.txt there), downloaded once from raw.githubusercontent.com into
data/nga/ (private; --refresh downloads it again):

  objects.csv                   title, date, medium, dimensions, attribution, credit line,
                                accession number and provenanceText
  objects_text_entries.csv      bibliography, exhibition_history (and its footnotes),
                                lifetime_exhibition, documentary_labels_inscriptions
  constituents.csv, constituents_altnames.csv, objects_constituents.csv
                                the artists (names, other names, life dates) and the owners
  objects_historical_data.csv   previous titles
  objects_terms.csv             where a work was made ("Place Executed")
  object_associations.csv       parts of one physical object (a sheet's recto and verso)

Matching. Every saved work (data/artsy_saves_raw.json, with Artsy's fuller record from
data/histories/artsy/works/) is looked up among the NGA's objects by title (normalised: case,
accents, punctuation; the NGA's previous titles count). A candidate must have the same artist
(name, and life dates where both give them) and a compatible date, and must not measure
differently. Then:

  exact     the NGA's accession number is in Artsy's record;
  strong    Artsy names the NGA as the holder (it listed the work, or its collecting institution or
            credit line says so) or credits it in an NGA exhibition, and the dimensions or the NGA's
            credit line agree too;
  probable  Artsy names the NGA as the holder, and the NGA has just one object by that artist
            under that title, but there is nothing to measure it against.

A work Artsy does not place at the NGA is matched only if it is one of a kind (a painting, drawing
or sculpture), carries the NGA's own title, date and dimensions, and names no other holder. Prints
and photographs exist in many impressions, and one is matched only when Artsy says it is the NGA's
impression. Several NGA objects fitting equally well, a title matching only in part, or another
holder named, and the work is not matched; every such doubt is written to data/nga/matches.json
with the reason.

Events, all in the NGA's own words ("text" is always verbatim):
  provenance      split into one event per owner (semicolons, sentences, and "by whom sold ... to"
                  clauses), in order: "owned", "sold" for a sale (a parenthesised auction), "held"
                  for the gift, bequest or purchase to the NGA. Footnotes go in "note". Dates only
                  as the text gives them; "who" is the NGA's own name for the owner when its owner
                  records (objects_constituents) line up with the text, else the name as written.
  exhibitions     one "exhibited" event per entry: title, venue and city as the entry lays them
                  out, dates from the entry (else its year).
  bibliography    one "written" event per entry: author, title, publication, pages, year.
  also            "made" (the date as displayed, where it was made), "held" from the credit line
                  when the provenance does not say how the NGA acquired it, and the labels on the
                  back ("other").

Output (private — data/ is never committed): data/histories/nga/<file>.json, one per matched work,
<file> as filename() in fetch_artwork_histories.py; and data/nga/matches.json, the matches and the
rejected doubts. Re-running rebuilds both from the cached CSVs (the matching is all local).

    python3 scripts/fetch_history_nga.py [--refresh] [--only artwork-id] [--dry-run]
"""

import argparse
import csv
import json
import re
import sys
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from fetch_artwork_histories import filename  # noqa: E402

SAVES = ROOT / "data" / "artsy_saves_raw.json"
ARTSY = ROOT / "data" / "histories" / "artsy" / "works"
CACHE = ROOT / "data" / "nga"
OUT = ROOT / "data" / "histories" / "nga"
BASE = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/"
FILES = ["objects", "objects_text_entries", "constituents", "constituents_altnames", "objects_constituents",
         "objects_historical_data", "objects_terms", "object_associations"]
UA = "Art-Database artwork histories (github.com/9gn957ptsb-alt/Art-Database; NGA open data reader)"

SOURCE = {"name": "National Gallery of Art, Washington - collection data (CC0)",
          "licence": "CC0 1.0 Universal (public domain dedication), NGA Open Data Program: "
                     "https://github.com/NationalGalleryOfArt/opendata"}
PAGE = "https://www.nga.gov/collection/art-object-page.{}.html"

NGA_PARTNER = "national-gallery-of-art-washington-dc"
UNIQUE = {"Painting", "Drawing, Collage or other Work on Paper", "Sculpture"}
# Roles that are not the maker of the work itself.
NOT_MAKER = {"printer", "publisher", "author", "editor", "translator", "edition production", "workshop printer",
             "technical collaborator", "processing and proofing", "processor", "compiler", "typesetter",
             "bookbinder", "dedicatee", "founder", "caster", "manufacturer", "artist after", "related artist"}
# An attribution to someone near the artist, not the artist.
NOT_HAND = re.compile(r"^(follower|imitator|style|circle|workshop|studio|school|manner|copy|after|assistant|"
                      r"formerly|and studio|and workshop)\b", re.I)
MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                      "september", "october", "november", "december"], 1)}
MONTH = r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
ABBR = {"mrs", "mme", "mlle", "inc", "ltd", "bros", "nos", "ste", "cie", "rev", "esq", "hon", "gal", "ave", "vol",
        "vols", "fig", "figs", "sgt", "capt", "prof", "messrs", "dept", "repro", "cat", "nr", "jan", "feb", "mar",
        "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "etc", "univ", "dott", "sig", "sra", "sta",
        "mons", "fils", "succ", "comm", "gen", "col", "lieut", "ibid", "approx", "illus", "pls", "est", "wm",
        "chas", "thos", "geo", "jas", "jno", "robt", "saml", "benj", "edw", "hy", "mass", "penn", "conn", "calif"}
CORP = {"inc", "inc.", "ltd", "ltd.", "co", "co.", "llc", "gmbh", "ag", "s.a.", "sa", "jr", "jr.", "sr", "sr.",
        "esq.", "esq", "s.a.r.l.", "b.v.", "n.v.", "plc", "ii", "iii", "iv"}
PARTICLES = {"de", "du", "des", "la", "le", "les", "sur", "en", "am", "an", "der", "di", "del", "della", "upon", "on",
             "of", "im", "bei", "near", "sous", "lès", "les", "y", "da", "do", "dos", "das", "van", "von", "aan"}
INSTITUTION = re.compile(r"\b(museum|musee|musée|museo|muzeum|gallery|galleries|galerie|galleria|academy|academie|"
                         r"académie|institute|institution|society|club|palais|palazzo|kunsthalle|kunsthaus|library|"
                         r"center|centre|foundation|fondation|hall|university|college|league|association|exposition|"
                         r"salon|rooms|pinacoteca|collection|nga|school|studio|biennale|biennial|exhibition|fair|"
                         r"corcoran|smithsonian|hirshhorn|guggenheim|whitney|metropolitan|louvre|tate|rijksmuseum|"
                         r"hermitage|orangerie|grand palais|petit palais|arts|art)\b", re.I)
COUNTRIES = {
    "france": "FR", "england": "GB", "scotland": "GB", "wales": "GB", "united kingdom": "GB", "great britain": "GB",
    "ireland": "IE", "germany": "DE", "italy": "IT", "spain": "ES", "portugal": "PT", "netherlands": "NL",
    "the netherlands": "NL", "holland": "NL", "belgium": "BE", "switzerland": "CH", "austria": "AT",
    "sweden": "SE", "norway": "NO", "denmark": "DK", "finland": "FI", "russia": "RU", "poland": "PL",
    "hungary": "HU", "czech republic": "CZ", "czechoslovakia": "CZ", "greece": "GR", "turkey": "TR",
    "canada": "CA", "mexico": "MX", "japan": "JP", "china": "CN", "australia": "AU", "argentina": "AR",
    "brazil": "BR", "south africa": "ZA", "israel": "IL", "egypt": "EG", "india": "IN", "liechtenstein": "LI",
    "monaco": "MC", "luxembourg": "LU", "usa": "US", "u.s.a.": "US", "united states": "US", "d.c.": "US",
    "dc": "US", "puerto rico": "PR", "cuba": "CU", "chile": "CL", "peru": "PE", "venezuela": "VE",
    "colombia": "CO", "new zealand": "NZ", "korea": "KR", "south korea": "KR", "romania": "RO",
    "yugoslavia": "", "croatia": "HR", "slovenia": "SI", "iceland": "IS", "estonia": "EE", "latvia": "LV",
    "lithuania": "LT", "ukraine": "UA", "bohemia": "CZ", "bavaria": "DE", "prussia": "", "tuscany": "IT",
}
US_STATES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida",
    "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
    "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska",
    "nevada", "new hampshire", "new jersey", "new mexico", "new york state", "north carolina", "north dakota",
    "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee",
    "texas", "utah", "vermont", "virginia", "west virginia", "wisconsin", "wyoming", "massachusettes",
    "calif.", "conn.", "mass.", "penn.", "pa", "ny", "n.y.", "va", "md", "ma", "ct", "nj", "n.j.", "ca", "il",
    "ohio.", "d. c.", "washington, d.c.",
}


# ---------------------------------------------------------------- the data

def download(refresh):
    CACHE.mkdir(parents=True, exist_ok=True)
    s = requests.Session()
    s.headers["User-Agent"] = UA
    for name in FILES:
        path = CACHE / f"{name}.csv"
        if path.exists() and path.stat().st_size and not refresh:
            continue
        for attempt in range(6):
            try:
                with s.get(BASE + f"{name}.csv", stream=True, timeout=120) as r:
                    if r.status_code == 429 or r.status_code >= 500:
                        raise requests.RequestException(f"HTTP {r.status_code}")
                    r.raise_for_status()
                    part = path.with_suffix(".part")
                    with open(part, "wb") as fh:
                        for chunk in r.iter_content(1 << 20):
                            fh.write(chunk)
                    part.replace(path)
                print(f"downloaded {name}.csv ({path.stat().st_size >> 20} MB)", flush=True)
                break
            except requests.RequestException as e:
                wait = 5 * 2 ** attempt
                print(f"{name}.csv: {e}; again in {wait} s", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError(f"could not download {name}.csv")


def rows(name):
    csv.field_size_limit(sys.maxsize)
    with open(CACHE / f"{name}.csv", newline="", encoding="utf-8") as fh:
        yield from csv.DictReader(fh)


def load():
    """The NGA's tables, keyed for matching and for writing the events."""
    t = time.time()
    objects = {r["objectid"]: r for r in rows("objects")}
    people = {r["constituentid"]: r for r in rows("constituents")}
    alt = defaultdict(set)
    for r in rows("constituents_altnames"):
        for k in ("forwarddisplayname", "displayname"):
            if r[k]:
                alt[r["constituentid"]].add(r[k])
    makers, owners = defaultdict(list), defaultdict(list)
    for r in rows("objects_constituents"):
        if r["roletype"] == "artist" and r["role"] not in NOT_MAKER:
            makers[r["objectid"]].append(r)
        elif r["roletype"] == "owner":
            owners[r["objectid"]].append(r)
    for v in owners.values():
        v.sort(key=lambda r: int(r["displayorder"] or 0))
    texts = defaultdict(list)
    for r in rows("objects_text_entries"):
        texts[r["objectid"]].append(r)
    previous = defaultdict(list)
    for r in rows("objects_historical_data"):
        if r["datatype"] == "previous_title" and r["forwardtext"]:
            previous[r["objectid"]].append(r["forwardtext"])
    made_at = defaultdict(list)
    for r in rows("objects_terms"):
        if r["termtype"] == "Place Executed" and r["term"]:
            made_at[r["objectid"]].append(r["term"])
    parent = {}
    for r in rows("object_associations"):
        if r["relationship"] == "inseparable":
            parent[r["childobjectid"]] = r["parentobjectid"]
    print(f"NGA data: {len(objects)} objects, {len(people)} people, read in {time.time() - t:.0f} s", flush=True)
    return {"objects": objects, "people": people, "alt": alt, "makers": makers, "owners": owners,
            "texts": texts, "previous": previous, "made_at": made_at, "parent": parent}


# ---------------------------------------------------------------- matching

def fold(t):
    t = unicodedata.normalize("NFKD", t or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    for a, b in (("ß", "ss"), ("æ", "ae"), ("œ", "oe"), ("ø", "o"), ("ł", "l"), ("đ", "d"), ("Æ", "AE"),
                 ("Œ", "OE"), ("Ø", "O")):
        t = t.replace(a, b)
    return t.lower()


def norm(t):
    t = fold(t).replace("&", " and ").replace("_", "")
    t = re.sub(r"['’‘`´]", "", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def title_keys(t):
    """The whole title, and its parts: before a bracket, inside one, without a leading article."""
    full = norm(t)
    parts = {full}
    main = re.split(r"\s*[(\[]", t or "", maxsplit=1)[0]
    parts.add(norm(main))
    for inner in re.findall(r"[(\[]([^)\]]*)[)\]]", t or ""):
        if not re.fullmatch(r"\s*(recto|verso|obverse|reverse)\s*", inner, re.I):
            parts.add(norm(inner))
    for p in list(parts):
        parts.add(re.sub(r"^(the|a|an|la|le|les|l|el|il|lo|die|der|das|de|het)\s+", "", p))
    return full, {p for p in parts if len(p) >= 3}


def person_name(n):
    return norm(re.sub(r"\s*\([^)]*\)", "", (n or "").replace("-", " ")))


def names_agree(a, b):
    if not a or not b:
        return False
    if a == b:
        return True
    ta, tb = a.split(), b.split()
    if ta[-1] != tb[-1] or len(ta) == 1 or len(tb) == 1:
        return False
    short, long_ = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    it = iter(long_)
    if all(tok in it for tok in short):  # "auguste renoir" in "pierre auguste renoir"
        return True
    return ta[0][0] == tb[0][0] and (len(ta[0]) == 1 or len(tb[0]) == 1)  # "j m w turner"


def year_of(v):
    m = re.search(r"(1[0-9]\d\d|20[0-2]\d)", str(v or ""))
    return int(m.group(1)) if m else None


def artist_agrees(a, maker, nga):
    """An Artsy artist and one of the NGA's makers of an object: same name, same life dates."""
    person = nga["people"].get(maker["constituentid"]) or {}
    names = {person_name(person.get("forwarddisplayname")), person_name(person.get("preferreddisplayname"))}
    pref = person.get("preferreddisplayname") or ""
    if "," in pref:  # "Monet, Claude" -> "claude monet"
        last, first = pref.split(",", 1)
        names.add(person_name(f"{first} {last}"))
    names |= {person_name(n) for n in nga["alt"].get(maker["constituentid"], ())}
    names |= {person_name(" ".join(reversed(n.split(",", 1)))) for n in nga["alt"].get(maker["constituentid"], ())
              if "," in n}
    mine = person_name(a.get("name"))
    if not any(names_agree(mine, n) for n in names if n):
        return False
    for mine_y, theirs in ((year_of(a.get("birthday")), person.get("beginyear")),
                           (year_of(a.get("deathday")), person.get("endyear"))):
        theirs = year_of(theirs)
        if mine_y and theirs and abs(mine_y - theirs) > 2:
            return False
    return True


def span(s):
    s = s or ""
    ys = [int(y) for y in re.findall(r"(?<!\d)(1[0-9]\d\d|20[0-2]\d)(?!\d)", s)]
    for a, b in re.findall(r"(?<!\d)(1[0-9]\d\d)\s*[-–/]\s*(\d{1,2})(?!\d)", s):
        ys.append(int(a[:4 - len(b)] + b))
    if not ys:
        return None
    lo, hi = min(ys), max(ys)
    for d in re.findall(r"(?<!\d)(1[0-9]\d0)s", s):
        hi = max(hi, int(d) + 9)
    approx = bool(re.search(r"\b(c|ca|circa|about|probably|possibly|before|after|or|begun|completed)\b|\?|s\b",
                            s.lower()))
    return lo, hi, approx


def dates_agree(a, b):
    sa, sb = span(a), span(b)
    if not sa or not sb:
        return "unknown"
    tol = 2 + (5 if sa[2] or sb[2] else 0)
    return "agree" if sa[0] - tol <= sb[1] and sb[0] - tol <= sa[1] else "conflict"


def measures(s):
    out = []
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*cm", s or ""):
        out.append(tuple(float(x) for x in m.groups() if x))
    rest = re.sub(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*cm", " ", s or "")
    out += [(float(x),) for x in re.findall(r"(\d+(?:\.\d+)?)\s*cm", rest)]
    return out


def close(a, b):
    return abs(a - b) <= max(0.6, 0.02 * max(a, b))


def dims_agree(mine, theirs):
    if not mine or not theirs:
        return "none"
    for p in mine:
        for q in theirs:
            if len(p) == 1 or len(q) == 1:
                if len(p) == len(q) == 1 and close(p[0], q[0]):
                    return "agree"
                continue
            if (close(p[0], q[0]) and close(p[1], q[1])) or (close(p[0], q[1]) and close(p[1], q[0])):
                return "agree"
    return "conflict"


ACCESSION = re.compile(r"(?<![\d.])((?:1[89]|20)\d\d\.\d+\.\d+(?:\.[a-z0-9]+)*)(?![\d])", re.I)


def accession_agrees(found, theirs):
    theirs = (theirs or "").lower()
    for a in found:
        a = a.lower().rstrip(".")
        if a == theirs or theirs.startswith(a + ".") or a.startswith(theirs + "."):
            return a
    return None


def nga_named(saved, rec):
    """Does Artsy say the NGA holds this work? And does it say so only in passing (a show's credit)?"""
    partner = saved.get("partner") or {}
    if partner.get("id") == NGA_PARTNER:
        return "listed by the NGA on Artsy", None
    ci = (rec.get("collecting_institution") or saved.get("collecting_institution") or "").strip()
    ai = (rec.get("additional_information") or "").strip()
    if re.search(r"National Gallery of Art,?\s*Washington", ci) and '" at ' not in ci:
        return "collecting institution: " + ci, None
    if re.match(r"\W*(?:Collection(?: of)?:?\s*)?(?:[^.\n]{0,90}?,\s*)?National Gallery of Art,?\s*Washington",
                ai, re.I):
        return "credited on Artsy: " + ai[:120].replace("\n", " "), None
    if re.search(r"from (the )?National Gallery of Art", ci, re.I):
        return None, "shown on Artsy in an exhibition of the NGA's works: " + ci
    return None, None


def other_holder(saved, rec):
    """Another holder named in Artsy's record, or None."""
    ci = (rec.get("collecting_institution") or saved.get("collecting_institution") or "").strip()
    ai = (rec.get("additional_information") or "").strip()
    for text in (ci, ai):
        if re.search(r"private collection", text, re.I) and "National Gallery of Art" not in text:
            return text[:160]
    if ci and "National Gallery of Art" not in ci and '" at ' not in ci and not ci.startswith('"'):
        return ci[:160]
    first = ai.split("\n", 1)[0]
    if first and "National Gallery of Art" not in ai and re.search(
            r"\b(Mus[eé]e|Museum|Museo|Collection|Institute|Kunsthalle|Palais|Fund|Gift|Bequest|Purchase|"
            r"Acquired|Lent|on loan)\b", first):
        return first[:160]
    return None


def candidates(saved, rec, nga, index):
    """The NGA objects that agree with a saved work on title, artist and date, each with its evidence."""
    full, parts = title_keys(saved.get("title"))
    if not full:
        return []
    ids = set()
    for k in parts:
        ids |= index.get(k, set())
    artists = saved.get("artists") or rec.get("artists") or []
    art_text = " \n ".join(str(rec.get(k) or saved.get(k) or "") for k in
                           ("additional_information", "collecting_institution", "image_rights"))
    found_acc = ACCESSION.findall(art_text)
    my_dims = measures(((saved.get("dimensions") or {}).get("cm") or "")) + measures(art_text)
    out = []
    for oid in ids:
        o = nga["objects"][oid]
        o_full, o_parts = title_keys(o["title"])
        prev = [title_keys(p) for p in nga["previous"].get(oid, [])]
        if full == o_full or any(full == p[0] for p in prev):
            level = "title"
        elif parts & (o_parts | {k for p in prev for k in p[1]}):
            level = "part of the title"
        else:
            continue
        hands = [m for m in nga["makers"].get(oid, []) if any(artist_agrees(a, m, nga) for a in artists)]
        if not hands:
            continue
        qualified = all(NOT_HAND.match((m.get("prefix") or "").strip()) for m in hands)
        date = dates_agree(saved.get("date") or rec.get("date"), o["displaydate"])
        if date == "conflict":
            continue
        acc = accession_agrees(found_acc, o["accessionnum"])
        credit = bool(o["creditline"]) and len(norm(o["creditline"])) >= 12 and norm(o["creditline"]) in norm(art_text)
        dims = dims_agree(my_dims, measures(o["dimensions"]))
        out.append({"oid": oid, "level": level, "date": date, "acc": acc, "credit": credit, "dims": dims,
                    "qualified": qualified, "attribution": o["attribution"], "accession": o["accessionnum"],
                    "title": o["title"], "displaydate": o["displaydate"]})
    return out


def decide(saved, rec, cands):
    """(the candidate, confidence, how) or (None, reason) for a doubtful one, or None when nothing fits."""
    if not cands:
        return None
    named, hint = nga_named(saved, rec)
    exact = [c for c in cands if c["acc"]]
    if len({c["oid"] for c in exact}) == 1:
        c = exact[0]
        return c, "exact", f"accession number {c['accession']} in Artsy's record; artist and {c['level']} agree"
    if len(exact) > 1:
        return None, "the accession number fits several NGA objects: " + ", ".join(c["accession"] for c in exact)
    fits = [c for c in cands if c["dims"] != "conflict"]
    if not fits:
        c = cands[0]
        return None, (f"artist, {c['level']} and date agree with NGA {c['accession']} ({c['title']}), "
                      f"but the dimensions do not")
    whole = [c for c in fits if c["level"] == "title"] or fits
    if len(whole) > 1:
        best = [c for c in whole if c["dims"] == "agree"] or whole
        if len(best) > 1:
            best = [c for c in best if c["credit"]] or best
        if len(best) > 1:
            return None, ("several NGA objects fit equally well: " +
                          "; ".join(f"{c['accession']} {c['title']} ({c['displaydate']})" for c in best[:6]))
        whole = best
    c = whole[0]
    ident = f"NGA {c['accession']} ({c['title']}, {c['displaydate'] or 'no date'}, {c['attribution']})"
    measured = c["dims"] == "agree"
    if c["level"] != "title" and not (measured and (named or hint)):
        return None, f"only part of the title agrees with {ident}"
    if c["qualified"] and not named:
        return None, f"the NGA gives {ident} to another hand than Artsy's artist"
    held = other_holder(saved, rec)
    if held and not (named or c["credit"]):
        return None, f"Artsy names another holder ({held}) for a work like {ident}"
    what = f"artist, {c['level']} and date ({c['date']})"
    extra = [w for w, ok in (("dimensions", measured), ("NGA credit line", c["credit"])) if ok]
    if named:
        if extra:
            return c, "strong", f"{what}, {' and '.join(extra)} agree; {named}"
        if len(cands) == 1 and c["level"] == "title":
            return c, "probable", f"{what} agree, and it is the NGA's only such object; {named}; nothing to measure"
        return None, f"{named}, but nothing tells {ident} from the NGA's other candidates"
    if hint:
        if extra and c["level"] == "title":
            return c, "strong", f"{what}, {' and '.join(extra)} agree; {hint}"
        return None, f"{hint}, but neither dimensions nor credit line confirm {ident}"
    category = saved.get("category") or rec.get("category") or ""
    if category not in UNIQUE:
        return None, f"{category or 'an uncategorised work'} not placed at the NGA on Artsy, like {ident}: " \
                     f"another impression or copy"
    if c["credit"] and measured and c["level"] == "title" and c["date"] == "agree":
        return c, "strong", f"{what}, dimensions and NGA credit line agree (Artsy does not name the holder)"
    if measured and c["level"] == "title" and c["date"] == "agree":
        return None, (f"artist, title, date and dimensions agree with {ident}, but Artsy does not place the work "
                      f"at the NGA ({(saved.get('partner') or {}).get('name')})")
    return None, f"artist and {c['level']} agree with {ident}, but nothing else confirms it"


# ---------------------------------------------------------------- the events

def top_split(text, sep, start=0, end=None):
    """Spans of text[start:end] split at `sep` characters outside brackets and parentheses."""
    end = len(text) if end is None else end
    spans, depth, s = [], 0, start
    for i in range(start, end):
        ch = text[i]
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        elif ch == sep and depth == 0:
            spans.append((s, i))
            s = i + 1
    spans.append((s, end))
    return spans


def strip_span(text, a, b, chars=" \t\r\n;,"):
    while a < b and text[a] in chars:
        a += 1
    while b > a and text[b - 1] in chars:
        b -= 1
    return a, b


def depth_map(text):
    d, out = 0, []
    for ch in text:
        if ch in "([":
            d += 1
        out.append(d)
        if ch in ")]":
            d = max(0, d - 1)
    return out


def sentence_breaks(text, a, b, depth):
    """Positions in text[a:b] after which a new sentence starts (a full stop that is not an abbreviation)."""
    out = []
    for m in re.finditer(r"\.(?=\s+[\"“(A-Za-z])", text[a:b]):
        i = a + m.start()
        if depth[i]:
            continue
        before = re.search(r"(\S+)$", text[a:i])
        tok = before.group(1) if before else ""
        word = re.sub(r"^[\[(\"“']+", "", tok)
        if re.fullmatch(r"\d{4}", word) or tok.endswith((")", "]", '"', "”")):
            out.append(i + 1)
        elif re.fullmatch(r"[A-Za-zÀ-ÿ'’]+", word) and len(word) >= 3 and word.lower() not in ABBR \
                and not word.isupper():
            out.append(i + 1)
    return out


FOOTMARK = re.compile(r"\[(\d{1,2})\]")


def provenance_pieces(text):
    """The provenance's owners, as (start, end) spans of the text, and its footnotes by number."""
    notes = {}
    m = re.search(r"\n\s*\[1\]\s", text)
    main_end = m.start() if m else len(text)
    if m:
        for n in re.finditer(r"\[(\d{1,2})\]\s*(.*?)(?=\n\s*\[\d{1,2}\]\s|\Z)", text[m.start():], re.S):
            notes[n.group(1)] = re.sub(r"\s+", " ", n.group(2)).strip()
    depth = depth_map(text)
    pieces = []
    for a, b in top_split(text, ";", 0, main_end):
        cuts = [a] + sentence_breaks(text, a, b, depth)
        # "(Dealer, City), by whom sold 1952 to X" is two owners.
        for w in re.finditer(r",\s+(?=(?:by|from|to|through) whom\b|who (?:sold|gave|bequeathed|lent|exchanged)\b)",
                             text[a:b]):
            if not depth[a + w.start()]:
                cuts.append(a + w.start() + 1)
        cuts = sorted(set(cuts)) + [b]
        for s, e in zip(cuts, cuts[1:]):
            s, e = strip_span(text, s, e)
            if s < e:
                pieces.append([s, e])
    # A footnote mark that follows the semicolon belongs to the owner before it.
    out = []
    for s, e in pieces:
        marks = []
        while True:
            lead = FOOTMARK.match(text, s)
            if not lead:
                break
            if out:
                out[-1][2].append(lead.group(1))
            s, e = strip_span(text, lead.end(), e)
        if s >= e:
            continue
        seg = text[s:e]
        marks += FOOTMARK.findall(seg)
        tail = re.search(r"(?:\s*\[\d{1,2}\])+\s*[.;,]?\s*$", seg)
        if tail and tail.start() > 0:
            e = s + tail.start()
            s, e = strip_span(text, s, e, " \t\r\n;,")
        out.append([s, e, marks])
    return [(s, e, marks) for s, e, marks in out if re.search(r"[A-Za-z]", text[s:e])], notes


def outside_brackets(seg):
    return re.sub(r"\[[^\]]*\]", lambda m: " " * len(m.group(0)), seg)


def dates_in(seg):
    """Dates written in a piece of text, in order, as YYYY, YYYY-MM or YYYY-MM-DD, with a range's end."""
    found = []
    pats = [
        (rf"(?<![\d.])(\d{{1,2}})(?:\s*[-–]\s*(\d{{1,2}}))?\s+({MONTH})\s+(\d{{4}})(?![\d.])", "dmy"),
        (rf"({MONTH})\s+(\d{{1,2}}),?\s+(\d{{4}})(?![\d.])", "mdy"),
        (rf"({MONTH})\s+(\d{{4}})(?![\d.])", "my"),
        (r"(?<![\d.])(\d{4})(?:\s*[-–/]\s*(\d{4}|\d{2}))?(?![\d.])", "y"),
    ]
    taken = [False] * len(seg)
    for pat, kind in pats:
        for m in re.finditer(pat, seg):
            if any(taken[m.start():m.end()]):
                continue
            before = seg[max(0, m.start() - 6):m.start()].lower()
            if kind == "y" and re.search(r"(no|nos|lot|inv|pp|p)\.\s*$|#\s*$", before):
                continue
            g = m.groups()
            if kind == "dmy":
                y, mo = int(g[3]), MONTHS[g[2].lower()]
                vals = [f"{y:04d}-{mo:02d}-{int(g[0]):02d}"] + ([f"{y:04d}-{mo:02d}-{int(g[1]):02d}"] if g[1] else [])
            elif kind == "mdy":
                y, mo = int(g[2]), MONTHS[g[0].lower()]
                vals = [f"{y:04d}-{mo:02d}-{int(g[1]):02d}"]
            elif kind == "my":
                vals = [f"{int(g[1]):04d}-{MONTHS[g[0].lower()]:02d}"]
            else:
                y = int(g[0])
                vals = [f"{y:04d}"]
                if g[1]:
                    y2 = int(g[1]) if len(g[1]) == 4 else int(g[0][:2] + g[1])
                    if y2 > y:
                        vals.append(f"{y2:04d}")
            if not all(1000 <= int(v[:4]) <= 2030 for v in vals):
                continue
            for i in range(m.start(), m.end()):
                taken[i] = True
            found.append((m.start(), vals))
    found.sort()
    return [v for _, vals in found for v in vals]


def start_end(seg):
    ds = dates_in(seg)
    if not ds:
        return "", "", False
    circa = bool(re.search(rf"\b(by|c\.|ca\.|circa|about|around|before|after|probably|possibly|perhaps|"
                           rf"reportedly|until|not later than)\s+(?:the\s+)?(?:\d|{MONTH})", seg, re.I))
    return ds[0], (ds[-1] if len(ds) > 1 and ds[-1] != ds[0] else ""), circa


def components(seg):
    return [seg[a:b].strip() for a, b in top_split(seg, ",") if seg[a:b].strip()]


def placeish(c):
    c = c.strip().rstrip(".")
    if not c or re.search(r"\d", c) or INSTITUTION.search(c) or c.lower() in CORP:
        return False
    words = c.replace("-", " ").split()
    if len(words) > 4 or not words[0][:1].isupper() or c.isupper() and len(c) <= 4 and c.lower() not in COUNTRIES:
        return False
    return all(w[:1].isupper() or w.lower() in PARTICLES or w.lower().startswith(("l'", "d'"))
               for w in words)


def country_of(c):
    c = (c or "").strip().rstrip(".").lower()
    if c in COUNTRIES:
        return COUNTRIES[c]
    if c in US_STATES or c + "." in US_STATES:
        return "US"
    return None


def place_after(comps):
    """City and country from the components that follow a name: "New York", "Upperville, Virginia"."""
    comps = [c for c in comps if c.lower().rstrip(".") not in CORP and c.lower() not in CORP]
    places = []
    for c in comps:
        if placeish(c) or country_of(c) is not None:
            places.append(c)
        else:
            break
    if not places:
        return "", ""
    city, country = "", ""
    first = places[0].rstrip(".")
    if country_of(first) is not None and not (len(places) > 1 and country_of(places[1]) is not None):
        return "", country_of(first) or ""
    city = first
    if len(places) > 1:
        nxt = country_of(places[1])
        if nxt is not None:
            country = nxt
        else:
            return "", ""  # several places: which one is not said
    if city.lower().startswith("and "):
        return "", ""
    return city, country


def owner_names(rec, nga):
    person = nga["people"].get(rec["constituentid"]) or {}
    name = person.get("forwarddisplayname") or ""
    if not name or re.match(r"(unknown|anonymous|private collection)", name, re.I):
        return None
    last = norm(person.get("lastname") or name.split()[-1])
    stop = {"mr", "mrs", "and", "the", "of", "de", "van", "von", "der", "la", "le", "du", "co", "inc", "ltd", "sir",
            "lady", "lord", "dr", "family", "estate", "collection", "gallery", "galleries", "galerie", "company",
            "brothers", "bros", "art", "arts", "museum", "trust", "foundation", "sons", "son", "fils", "et", "cie",
            "jr", "sr", "fine", "ii", "iii", "baron", "baroness", "count", "countess", "comte", "comtesse", "duke",
            "duchess", "prince", "princess", "marquis", "earl", "miss", "madame", "monsieur"}
    toks = [t for t in norm(name).split() if t not in stop and len(t) >= 3 and t not in last.split()]
    return {"name": name, "last": last, "others": toks,
            "corporate": person.get("constituenttype") in ("corporate", "purchase_fund")}


def align_owners(pieces, text, owners, nga):
    """The NGA's owner records, in their order, laid against the pieces of the provenance text."""
    names = [n for n in (owner_names(r, nga) for r in owners) if n]
    normed = [" " + norm(text[s:e]) + " " for s, e, _ in pieces]
    got = defaultdict(list)
    p = 0
    for n in names:
        if not n["last"] or len(n["last"]) < 3:
            continue
        for j in range(p, len(pieces)):
            seg = normed[j]
            if f" {n['last']} " not in seg:
                continue
            if not n["corporate"] and n["others"] and not any(f" {t} " in seg for t in n["others"]):
                continue
            got[j].append(n["name"])
            p = j
            break
    return got


def name_in_text(seg):
    """The owner as the text names them, when the NGA's records don't say."""
    flat = outside_brackets(seg)
    lead = re.match(r"^\s*(?:[a-z][^()]*?\b(?:by|to|from|with|for)\s+)?\(([^()]*)\)", flat)
    if lead:  # "(Duveen Brothers, Inc., Paris)" or "purchased 1919 by (Duveen Brothers, Inc.)"
        comps = components(seg[lead.start(1):lead.end(1)])
        if comps:
            who = comps[0]
            if len(comps) > 1 and comps[1].lower() in CORP:
                who += ", " + comps[1]
            return who, comps[1:]
    head_end = len(flat)
    for ch in ("[", ","):
        i = flat.find(ch)
        if i > 0:
            head_end = min(head_end, i)
    head = seg[:head_end]
    parts = re.split(r"\b(?:by|to|from|for|From|By|To)\s+(?=[A-Z(\"“])", head)
    who = parts[-1].strip().strip('"“”').strip()
    who = re.sub(r"^(?:his|her|their|the)\s+(?=[A-Z])", "", who)
    rest = components(flat[head_end:].replace("  ", " "))
    rest = [r for r in rest if not re.search(r"\[|\]", r)]
    if not who or not who[:1].isupper() or re.match(r"(?:The artist|The sitter|NGA)\b", who):
        return "", rest
    if re.search(r"\d", who) or len(who.split()) > 9:
        return "", rest
    return who, rest


def provenance_events(o, nga):
    text = (o["provenancetext"] or "").replace("\r\n", "\n")
    if not text.strip():
        return []
    pieces, notes = provenance_pieces(text)
    aligned = align_owners(pieces, text, nga["owners"].get(o["objectid"], []), nga)
    events = []
    for i, (s, e, marks) in enumerate(pieces):
        seg = text[s:e]
        flat = outside_brackets(seg)
        start, end, circa = start_end(flat)
        group = re.search(r"\(([^()]*\b(?:sale|auction|vente)\b[^()]*)\)", flat, re.I)
        to_nga = re.search(r"\b(NGA|National Gallery of Art)\b", seg) and not re.search(r"\b(lent|loan|deposit)",
                                                                                        seg, re.I)
        who, city, country, venue = "", "", "", ""
        if to_nga:
            kind, who, venue, city, country = "held", "National Gallery of Art", "National Gallery of Art", \
                "Washington", "US"
        elif group:
            kind = "sold"
            comps = components(seg[group.start(1):group.end(1)])
            k = next((j for j, c in enumerate(comps) if re.search(r"\b(sale|auction|vente)\b", c, re.I)), 0)
            after = comps[k + 1:]
            if aligned.get(i):
                who = "; ".join(aligned[i])
                if after and norm(after[0]) and norm(after[0]).split()[-1:] == norm(who).split()[-1:]:
                    after = after[1:]
            elif after and not placeish(after[0]) and not dates_in(after[0]):
                who, after = after[0], after[1:]
            after = [c for c in after if not dates_in(c) and not re.match(r"(no|nos|lot)\b", c, re.I)]
            city, country = place_after(after)
        else:
            kind = "owned"
            text_who, rest = name_in_text(seg)
            who = "; ".join(aligned[i]) if aligned.get(i) else text_who
            if re.match(r"\s*(?:From\s+)?the artist\b", seg, re.I) and not who:
                who = o["attribution"]
            city, country = place_after([r for r in rest if not dates_in(r)])
        note = " ".join(f"[{n}] {notes[n]}" for n in marks if n in notes)
        events.append({"kind": kind, "text": seg, "field": "provenance", "start": start, "end": end,
                       "circa": circa, "who": who, "title": "", "venue": venue, "city": city, "country": country,
                       "publication": "", "pages": "", "note": note, "url": "", "order": i + 1})
    return events


def exhibition_event(r, order, field, footnotes):
    text = r["text"].strip()
    comps_spans = [(a, b) for a, b in top_split(text, ",")]
    first_venue_end = top_split(text, ";")[0][1]
    comps = [(a, b, text[a:b].strip()) for a, b in comps_spans if text[a:b].strip()]
    single = first_venue_end == len(text)
    # Where the dates begin (single venue), or where the first venue ends (several).
    d = len(comps)
    for j, (a, b, c) in enumerate(comps):
        if single and (dates_in(c) or re.match(r"(no|nos|cat|unnumbered)\b", c, re.I)) and j > 0:
            d = j
            break
        if not single and b >= first_venue_end:
            d = j + 1 if a < first_venue_end else j
            break
    head = [c for c in comps[:d]]
    if head and not single:
        a, b, c = head[-1]
        head[-1] = (a, first_venue_end, text[a:first_venue_end].strip())
    title, venue, city, country = "", "", "", ""
    k = len(head)
    if k and country_of(head[k - 1][2]) is not None:
        country = country_of(head[k - 1][2]) or ""
        k -= 1
    if k >= 2 and placeish(head[k - 1][2]):
        city = head[k - 1][2].rstrip(".")
        k -= 1
    if k >= 2:
        j = k - 1
        while j > 1 and head[j][2].lower() in CORP:
            j -= 1
        venue = text[head[j][0]:head[k - 1][1]].strip()
        title = text[head[0][0]:head[j - 1][1]].strip()
    elif k == 1:
        title = head[0][2]
    if venue.upper() == "NGA":
        venue = "National Gallery of Art"
        if not city:
            city, country = "Washington", "US"
    if city and country_of(city) is not None:
        country, city = country_of(city) or country, ""
    if city.lower() == "washington" and not country and re.search(r"Washington,?\s*D\.?\s*C\.?", text):
        country = "US"
    tail = text[comps[d][0]:] if d < len(comps) else ""
    start, end, circa = start_end(tail if single else text[first_venue_end:])
    if not start and r.get("year"):
        start = r["year"]
    note = " ".join(f"[{n}] {footnotes[n]}" for n in FOOTMARK.findall(text) if n in footnotes)
    return {"kind": "exhibited", "text": text, "field": field, "start": start, "end": end, "circa": circa,
            "who": "", "title": title.strip('" '), "venue": venue, "city": city, "country": country,
            "publication": "", "pages": "", "note": note, "url": "", "order": order}


def written_event(r, order):
    text = r["text"].strip()
    who = ""
    m = re.match(r"^(?P<who>[^_\"“]+?)\.\s+(?=[_\"“])", text)
    if m:
        who = m.group("who").strip()
    title, publication = "", ""
    q = re.search(r"[\"“]([^\"”]+?)[,.]?[\"”]", text)
    books = re.findall(r"_([^_]+)_", text)
    if q and (not books or q.start() < text.find("_" + books[0] + "_")):
        title = q.group(1).strip().rstrip(".,")
        publication = next((b for b in books if text.find("_" + b + "_") > q.end()), "")
    elif books:
        title = books[0].strip()
    pages = ""
    p = re.search(r"(?:1[5-9]\d\d|20\d\d)\)?[^:]{0,12}:\s*([^:]+?)\s*$", text)
    if p:
        pages = re.sub(r"[,.]?\s*(?:(?:color|colour|black and white)\s+)?(?:repro|illus|fig)\b.*$", "", p.group(1))
        pages = pages.strip(" .,")
    city, country = "", ""
    if books and not q:
        after = text[text.find("_" + books[0] + "_") + len(books[0]) + 2:]
        pl = re.match(r"\.\s+([^,:;_]+?)\s*[,:]", after)
        if pl and placeish(pl.group(1)) and " and " not in pl.group(1):
            city = pl.group(1).strip()
            country = country_of(city) or ""
            if country:
                city = ""
    start = r.get("year") or ""
    if not start:
        ds = dates_in(text)
        start = ds[0][:4] if ds else ""
    return {"kind": "written", "text": text, "field": "bibliography", "start": start, "end": "",
            "circa": False, "who": who, "title": title, "venue": "", "city": city, "country": country,
            "publication": publication, "pages": pages, "note": "", "url": "", "order": order}


def other_events(o, nga):
    events = []
    shown = o["displaydate"].strip()
    if shown:
        start, end, circa = start_end(shown)
        if re.search(r"\b(c\.|ca\.|circa|about|probably|possibly)\s|\?|s\b", shown):
            circa = True
        where = nga["made_at"].get(o["objectid"], [])
        events.append({"kind": "made", "text": shown, "field": "displaydate", "start": start, "end": end,
                       "circa": circa, "who": o["attribution"], "title": o["title"], "venue": "", "city": "",
                       "country": "", "publication": "", "pages": "",
                       "note": ("Place executed: " + "; ".join(where)) if where else "", "url": "", "order": 1})
    return events


def events_for(o, nga):
    events = other_events(o, nga)
    prov = provenance_events(o, nga)
    events += prov
    if o["creditline"] and not any(e["kind"] == "held" for e in prov):
        y = re.match(r"((?:1[89]|20)\d\d)\.", o["accessionnum"] or "")
        events.append({"kind": "held", "text": o["creditline"].strip(), "field": "creditline",
                       "start": y.group(1) if y else "", "end": "", "circa": False,
                       "who": "National Gallery of Art", "title": "", "venue": "National Gallery of Art",
                       "city": "Washington", "country": "US", "publication": "", "pages": "",
                       "note": f"accession number {o['accessionnum']}" if o["accessionnum"] else "", "url": "",
                       "order": 1})
    entries = nga["texts"].get(o["objectid"], [])
    footnotes = {}
    for r in entries:
        if r["texttype"] == "exhibition_history_footnote" and r["text"].lstrip().startswith("["):
            for n in re.finditer(r"\[(\d{1,2})\]\s*(.*?)(?=\s*\[\d{1,2}\]\s|\Z)", r["text"], re.S):
                footnotes[n.group(1)] = re.sub(r"\s+", " ", n.group(2)).strip()
    counts = defaultdict(int)
    for r in entries:
        tt = r["texttype"]
        if not r["text"].strip():
            continue
        if tt == "exhibition_history" or (tt == "exhibition_history_footnote" and not r["text"].lstrip().startswith("[")):
            counts[tt] += 1
            events.append(exhibition_event(r, counts[tt], tt, footnotes))
        elif tt == "lifetime_exhibition":
            counts[tt] += 1
            events.append({"kind": "exhibited", "text": r["text"].strip(), "field": tt, "start": r["year"] or "",
                           "end": "", "circa": False, "who": "", "title": "", "venue": "", "city": "",
                           "country": "", "publication": "", "pages": "", "note": "", "url": "",
                           "order": counts[tt]})
        elif tt == "bibliography":
            counts[tt] += 1
            events.append(written_event(r, counts[tt]))
        elif tt == "documentary_labels_inscriptions":
            counts[tt] += 1
            events.append({"kind": "other", "text": r["text"].strip(), "field": tt, "start": "", "end": "",
                           "circa": False, "who": "", "title": "", "venue": "", "city": "", "country": "",
                           "publication": "", "pages": "", "note": "", "url": "", "order": counts[tt]})
    return events


# ---------------------------------------------------------------- main

def title_index(nga):
    index = defaultdict(set)
    for oid, o in nga["objects"].items():
        keys = set(title_keys(o["title"])[1])
        for p in nga["previous"].get(oid, []):
            keys |= title_keys(p)[1]
        for k in keys:
            index[k].add(oid)
    return index


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="download the NGA's CSVs again")
    ap.add_argument("--only", help="one saved work (Artsy id)")
    ap.add_argument("--dry-run", action="store_true", help="match and report, write nothing")
    args = ap.parse_args()
    download(args.refresh)
    nga = load()
    index = title_index(nga)
    saves = [s for s in json.loads(SAVES.read_text()) if s.get("id")]
    if args.only:
        saves = [s for s in saves if s["id"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    matched, rejected, events_n, kinds = [], [], 0, defaultdict(int)
    for saved in saves:
        path = ARTSY / filename(saved["id"])
        rec = json.loads(path.read_text()) if path.exists() else {}
        verdict = decide(saved, rec, candidates(saved, rec, nga, index))
        if verdict is None:
            continue
        who = {"id": saved["id"], "title": saved.get("title"), "date": saved.get("date"),
               "artists": [a.get("name") for a in saved.get("artists") or []],
               "partner": (saved.get("partner") or {}).get("name"),
               "collecting_institution": saved.get("collecting_institution")}
        if verdict[0] is None:
            rejected.append(dict(who, reason=verdict[1]))
            continue
        c, confidence, how = verdict
        o = nga["objects"][c["oid"]]
        events = events_for(o, nga)
        part_of = nga["parent"].get(c["oid"])
        if part_of and not any(e["field"] in ("provenance", "exhibition_history", "bibliography") for e in events):
            how += (f"; the NGA's provenance, exhibitions and literature for this sheet are kept on its other side, "
                    f"{nga['objects'][part_of]['title']} ({nga['objects'][part_of]['accessionnum']}), not repeated")
        out = {"id": saved["id"],
               "source": dict(SOURCE, url=PAGE.format(c["oid"])),
               "match": {"record": c["oid"], "how": f"NGA objectID {c['oid']}, accession {c['accession']}: {how}",
                         "confidence": confidence},
               "events": events}
        matched.append(dict(who, record=c["oid"], accession=c["accession"], nga_title=c["title"],
                            confidence=confidence, how=how, events=len(events)))
        events_n += len(events)
        for e in events:
            kinds[e["kind"]] += 1
        if not args.dry_run:
            (OUT / filename(saved["id"])).write_text(json.dumps(out, ensure_ascii=False, indent=1))
    if not args.dry_run and not args.only:
        keep = {filename(m["id"]) for m in matched}
        for stale in OUT.glob("*.json"):
            if stale.name not in keep:
                stale.unlink()
        (CACHE / "matches.json").write_text(json.dumps({"matched": matched, "rejected": rejected},
                                                        ensure_ascii=False, indent=1))
    by_conf = defaultdict(int)
    for m in matched:
        by_conf[m["confidence"]] += 1
    print(f"{len(matched)} works matched ({dict(by_conf)}), {len(rejected)} doubtful matches rejected; "
          f"{events_n} events: {dict(sorted(kinds.items(), key=lambda kv: -kv[1]))}")


if __name__ == "__main__":
    sys.exit(main())

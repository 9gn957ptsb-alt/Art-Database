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
(name, and life dates where both give them: the birth year where both have one, else the death
year) and a compatible date, and must not measure differently. Then:

  exact     the NGA's accession number is in Artsy's record;
  strong    Artsy names the NGA as the holder (it listed the work, or its collecting institution or
            credit line says so) or credits it in an NGA exhibition, and the dimensions or the NGA's
            credit line agree too;
  probable  Artsy names the NGA as the holder, and the NGA has just one object by that artist
            under that title, but there is nothing to measure it against; or it has several (a
            print's impressions) and only one carries Artsy's date and medium word for word; or
            Artsy's artist is the one the NGA says the print is after, and the size is the same.

Where the NGA holds several impressions under one title, Artsy's listing tells one from the others
only by its measurements (the NGA's statement of size word for word on every part both state -
image, sheet, mount - before any single measurement; a part the NGA has added since, like a sheet
size, tells nothing) or by the date as written; otherwise the work is not matched. A work Artsy does not
place at the NGA is matched only if it is one of a kind (a painting, drawing or sculpture), carries
the NGA's own title, date, dimensions and credit line, and names no other holder. Prints and
photographs exist in many impressions, and one is matched only when Artsy says it is the NGA's
impression. Several NGA objects fitting equally well, a title matching only in part, or another
holder named, and the work is not matched; every such doubt is written to data/nga/matches.json
with the reason. So are the works Artsy places at the NGA that no NGA object under their title
fits: where an object by the same artist has Artsy's statement of size word for word under another
title (retitled, perhaps), it is named among the doubts; the rest are listed as not found.

Events, all in the NGA's own words ("text" is always verbatim):
  provenance      split into one event per owner (semicolons, sentences, "by whom sold ... to"
                  clauses, and an owner's own sale in parentheses after the name), in order:
                  "owned", "sold" for a sale (a parenthesised auction: "sale", or an auctioneer with
                  a day and a lot), "held" for the gift, bequest or purchase to the NGA. Footnotes go
                  in "note"; one the text never points to is kept as a note to the whole ("other").
                  Dates only as the text gives them, less life dates ("(1895-1993)", "(d. 1883)");
                  a lone "until at least 1949" is the end. "who" is the NGA's own name for the owner
                  when one of its owner records (objects_constituents) is the name written: the same
                  surname, the same given names or their initials and no others, a "Mrs." or "Mme"
                  on both sides or neither, the same "Jr." or "2nd marquess"; else the name as written.
  exhibitions     one "exhibited" event per entry: title, venue and city as the entry lays them
                  out (the venue it was "shown only in", where the entry says so), dates from the
                  entry where they reach the NGA's own year for it (a range in a show's title is
                  not its date), else that year.
  bibliography    one "written" event per entry: author, title, publication, pages, year.
  also            "made" (the date as displayed, where it was made), "held" from the credit line
                  when the provenance does not say how the NGA acquired it (its year from the NGA's
                  record of itself as owner), and the labels on the back ("other").

Output (private — data/ is never committed): data/histories/nga/<file>.json, one per matched work,
<file> as filename() in fetch_artwork_histories.py; and data/nga/matches.json, the matches, the
rejected doubts and the works not found. Re-running rebuilds both from the cached CSVs (the
matching is all local; a history no longer matched is removed).

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
MONTH3 = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov",
                                      "dec"], 1)}
MONTH = (r"(?:Jan(?:uary|\.)?|Feb(?:ruary|\.)?|Mar(?:ch|\.)?|Apr(?:il|\.)?|May|June?|July?|Aug(?:ust|\.)?|"
         r"Sep(?:tember|t\.|\.)?|Oct(?:ober|\.)?|Nov(?:ember|\.)?|Dec(?:ember|\.)?)(?![A-Za-z])")
ABBR = {"mrs", "mme", "mlle", "inc", "ltd", "bros", "nos", "ste", "cie", "rev", "esq", "hon", "gal", "ave", "vol",
        "vols", "fig", "figs", "sgt", "capt", "prof", "messrs", "dept", "repro", "cat", "nr", "jan", "feb", "mar",
        "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "etc", "univ", "dott", "sig", "sra", "sta",
        "mons", "fils", "succ", "comm", "gen", "col", "lieut", "ibid", "approx", "illus", "pls", "est", "wm",
        "chas", "thos", "geo", "jas", "jno", "robt", "saml", "benj", "edw", "hy", "mass", "penn", "conn", "calif",
        "inv", "eds", "repr", "esp", "viz", "cit", "exh", "coll", "mss", "fol", "fols", "bart", "knt", "sen", "jun",
        "blvd", "gov", "pres", "adm", "maj", "brig", "cdr", "cmdr", "ven", "assoc", "corp", "mfg", "dist", "twp",
        "marq", "vte", "cte", "mgr", "msgr", "card", "abb", "dott", "avv", "ing", "arch", "sac", "rag", "cav",
        "comm", "dep", "suppl", "ser", "trans", "ult", "illus", "pag", "fasc", "ann"}
CORP = {"inc", "inc.", "ltd", "ltd.", "co", "co.", "llc", "gmbh", "ag", "s.a.", "sa", "jr", "jr.", "sr", "sr.",
        "esq.", "esq", "s.a.r.l.", "b.v.", "n.v.", "plc", "ii", "iii", "iv"}
PARTICLES = {"de", "du", "des", "la", "le", "les", "sur", "en", "am", "an", "der", "di", "del", "della", "upon", "on",
             "of", "im", "bei", "near", "sous", "lès", "les", "y", "da", "do", "dos", "das", "van", "von", "aan"}
INSTITUTION = re.compile(r"\b(museum|musee|musée|museo|muzeum|gallery|galleries|galerie|galleria|academy|academie|"
                         r"académie|institute|institution|society|club|palais|palazzo|kunsthalle|kunsthaus|library|"
                         r"center|centre|foundation|fondation|hall|university|college|league|association|exposition|"
                         r"salon|rooms|pinacoteca|collection|nga|school|studio|biennale|biennial|exhibition|fair|"
                         r"corcoran|smithsonian|hirshhorn|guggenheim|whitney|metropolitan|louvre|tate|rijksmuseum|"
                         r"hermitage|orangerie|grand palais|petit palais|arts|art|kunstmuseum|staatsgalerie|museu|pinakothek|"
                         r"kunstverein|glyptothek|sammlung|stiftung|ateneum|atheneum|athenaeum|kunstsammlung|istituto|"
                         r"fondazione|castello|landesmuseum|nationalmuseum|nationalgalerie|national|kunsthistorisches|"
                         r"museet|museum|galleria|palace|trust|church|chiesa|abbey|cathedral|convent|house)\b", re.I)
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
    makers, after, owners = defaultdict(list), defaultdict(list), defaultdict(list)
    for r in rows("objects_constituents"):
        if r["roletype"] == "artist" and r["role"] not in NOT_MAKER:
            makers[r["objectid"]].append(r)
        elif r["roletype"] == "artist" and r["role"] == "artist after":
            after[r["objectid"]].append(r)
        elif r["roletype"] == "owner":
            owners[r["objectid"]].append(r)
    for v in owners.values():
        v.sort(key=lambda r: int(r["displayorder"] or 0))
    texts = defaultdict(list)
    for r in rows("objects_text_entries"):
        r["text"] = r["text"].replace("\r\n", "\n")
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
    return {"objects": objects, "people": people, "alt": alt, "makers": makers, "after": after, "owners": owners,
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


_NAMES = {}


def maker_names(cid, nga):
    """Every form of an NGA constituent's name, normalised (cached)."""
    if cid not in _NAMES:
        person = nga["people"].get(cid) or {}
        names = {person_name(person.get("forwarddisplayname")), person_name(person.get("preferreddisplayname"))}
        for n in [person.get("preferreddisplayname") or ""] + list(nga["alt"].get(cid, ())):
            names.add(person_name(n))
            if "," in n:  # "Monet, Claude" -> "claude monet"
                last, first = n.split(",", 1)
                names.add(person_name(f"{first} {last}"))
        _NAMES[cid] = ({n for n in names if n}, year_of(person.get("beginyear")), year_of(person.get("endyear")))
    return _NAMES[cid]


def artist_agrees(a, maker, nga):
    """An Artsy artist and one of the NGA's makers of an object: same name, same life dates."""
    names, born, died = maker_names(maker["constituentid"], nga)
    mine = person_name(a.get("name"))
    if not any(names_agree(mine, n) for n in names):
        return False
    b = year_of(a.get("birthday"))
    if b and born:
        return abs(b - born) <= 2  # born the same year: the same person, even if a death year disagrees
    d = year_of(a.get("deathday"))
    return not (d and died and abs(d - died) > 2)


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


def same_measure(p, q):
    if len(p) == 1 or len(q) == 1:
        return len(p) == len(q) == 1 and close(p[0], q[0])
    return (close(p[0], q[0]) and close(p[1], q[1])) or (close(p[0], q[1]) and close(p[1], q[0]))


def dims_agree(mine, theirs):
    """"agree" (and how many of Artsy's measurements the NGA's share), "half" (one side of a sheet
    agrees, the other not), "conflict", or "none" when one of them gives no measurements."""
    if not mine or not theirs:
        return "none", 0
    score = sum(1 for p in set(mine) if any(same_measure(p, q) for q in theirs))
    if score:
        return "agree", score
    half = any(len(p) > 1 and len(q) > 1 and any(close(a, b) for a in p[:2] for b in q[:2])
               for p in mine for q in theirs)
    return ("half" if half else "conflict"), 0


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
    if re.match(r"\W*(?:Collection(?: of)?:?\s*)?(?:[^\n]{0,90}?,\s*)?National Gallery of Art,?\s*Washington",
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


def flat_dims(t):
    return re.sub(r"\s+", " ", (t or "").replace("×", "x")).strip().lower()


def dim_parts(t):
    """A statement of size by its parts: {"image": "32.8 x 24.6 cm (12 15/16 x 9 11/16 in.)", "sheet": ...}."""
    t = flat_dims(t)
    marks = list(re.finditer(r"(?:^|(?<=\s))([a-z][a-z ]*?(?:\s*\([^)]*\))?):\s", t))
    parts = {}
    for m, n in zip(marks, marks[1:] + [None]):
        parts.setdefault(m.group(1).strip(), t[m.end():n.start() if n else len(t)].strip())
    return parts


def dim_lines(mine, theirs):
    """Artsy's statement of size and the NGA's agree part by part, word for word, on every part both state.
    A part only one of them states (a sheet size the NGA has added since Artsy copied its record) tells
    nothing either way."""
    shared = set(mine) & set(theirs)
    return bool(shared) and all(mine[k] == theirs[k] for k in shared)


def date_words(t):
    """A date as written, with "c.", "ca." and "circa" alike."""
    return re.sub(r"\b(?:circa|ca|c)\b", "c", norm(t))


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
        fulls, o_parts = nga["tkeys"][oid]
        if full in fulls:
            level = "title"
        elif parts & o_parts:
            level = "part of the title"
        else:
            continue
        hands = [m for m in nga["makers"].get(oid, []) if any(artist_agrees(a, m, nga) for a in artists)]
        after = not hands  # Artsy's artist is the one the NGA says the work is after (a print after a design)
        if after:
            hands = [m for m in nga["after"].get(oid, []) if any(artist_agrees(a, m, nga) for a in artists)]
        if not hands:
            continue
        qualified = all(NOT_HAND.match((m.get("prefix") or "").strip()) for m in hands)
        date = dates_agree(saved.get("date") or rec.get("date"), o["displaydate"])
        if date == "conflict":
            continue
        acc = accession_agrees(found_acc, o["accessionnum"])
        credit = bool(o["creditline"]) and len(norm(o["creditline"])) >= 12 and norm(o["creditline"]) in norm(art_text)
        dims, dim_score = dims_agree(my_dims, measures(o["dimensions"]))
        first_line = flat_dims(o["dimensions"].split("\n")[0])
        dim_text = len(first_line) > 8 and first_line in flat_dims(art_text)
        # Artsy's listing repeats the NGA's statement of size, part by part (image, sheet, mount ...), where it has
        # one. Not the whole statement: the NGA adds parts to its records (a sheet size measured since), so an
        # impression whose record has grown since Artsy copied its sister's is not told apart by that.
        dim_whole = dim_lines(dim_parts(rec.get("additional_information")), dim_parts(o["dimensions"]))
        same_date = bool(date_words(o["displaydate"])) and \
            date_words(o["displaydate"]) == date_words(saved.get("date") or rec.get("date"))
        same_medium = bool(norm(o["medium"])) and norm(o["medium"]) == norm(rec.get("medium") or saved.get("medium"))
        out.append({"oid": oid, "level": level, "date": date, "acc": acc, "credit": credit, "dims": dims,
                    "dim_score": dim_score + (2 if dim_text else 0), "dim_whole": dim_whole,
                    "same_date": same_date, "same_medium": same_medium, "after": after,
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
    if all(c["after"] for c in cands):
        # Artsy names the artist the NGA's print is after, not its maker: only the NGA's own listing, with
        # the whole title and the same measurements, makes it this object.
        c = cands[0]
        ident = f"NGA {c['accession']} ({c['title']}, {c['displaydate'] or 'no date'}, {c['attribution']})"
        if len(cands) == 1 and named and c["level"] == "title" and c["dims"] == "agree":
            return c, "probable", (f"title and dimensions agree, and it is the NGA's only such object; {named}; "
                                   f"Artsy's artist is the one the NGA says it is after ({c['attribution']})")
        return None, f"Artsy's artist is only the one the NGA says {ident} is after, and nothing else confirms it"
    cands = [c for c in cands if not c["after"]]
    fits = [c for c in cands if c["dims"] not in ("conflict", "half")]
    halves = [c for c in cands if c["dims"] == "half"]
    if not fits and len(halves) == 1 and len(cands) == 1 and named and halves[0]["level"] == "title" \
            and halves[0]["date"] == "agree" and not halves[0]["qualified"]:
        c = halves[0]
        return c, "probable", (f"artist, title and date agree, and it is the NGA's only such object; {named}; "
                               f"one side of the sheet measures the same, the other not (NGA: {c['accession']})")
    if not fits:
        c = cands[0]
        return None, (f"artist, {c['level']} and date agree with NGA {c['accession']} ({c['title']}), "
                      f"but the dimensions do not")
    whole = [c for c in fits if c["level"] == "title"] or fits
    told = ""  # what told one of several NGA objects (impressions, versions) from the others
    if len(whole) > 1:
        best = [c for c in whole if c["dims"] == "agree"] or whole
        if len(best) < len(whole):
            told = "measurements"
        for why, better in (("measurements", lambda c: (c["dim_whole"], c["dim_score"])),
                            ("date as written", lambda c: c["same_date"]),
                            ("credit line", lambda c: c["credit"])):
            if len(best) > 1:
                top = max(better(c) for c in best)
                best = [c for c in best if better(c) == top]
                if len(best) == 1:
                    told = why
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
    others = f"; of {len(cands)} NGA objects under this title, the {told} tell this one" if told else ""
    if named:
        if extra:
            return c, "strong", f"{what}, {' and '.join(extra)} agree; {named}{others}"
        if len(cands) == 1 and c["level"] == "title":
            return c, "probable", f"{what} agree, and it is the NGA's only such object; {named}; nothing to measure"
        if told == "date as written" and c["same_medium"] and c["level"] == "title":
            return c, "probable", (f"{what} agree; {named}; nothing to measure, but of {len(cands)} NGA objects "
                                   f"under this title only this one has Artsy's date and medium as written "
                                   f"({c['displaydate']}; {c['accession']})")
        return None, f"{named}, but nothing tells {ident} from the NGA's other candidates"
    if hint:
        if extra and c["level"] == "title":
            return c, "strong", f"{what}, {' and '.join(extra)} agree; {hint}{others}"
        return None, f"{hint}, but neither dimensions nor credit line confirm {ident}"
    category = saved.get("category") or rec.get("category") or ""
    if category not in UNIQUE:
        return None, f"{category or 'an uncategorised work'} not placed at the NGA on Artsy, like {ident}: " \
                     f"another impression or copy"
    if c["credit"] and measured and c["level"] == "title" and c["date"] == "agree":
        return c, "strong", f"{what}, dimensions and NGA credit line agree (Artsy does not name the holder){others}"
    if measured and c["level"] == "title" and c["date"] == "agree":
        return None, (f"artist, title, date and dimensions agree with {ident}, but Artsy does not place the work "
                      f"at the NGA ({(saved.get('partner') or {}).get('name')})")
    return None, f"artist and {c['level']} agree with {ident}, but nothing else confirms it"


def elsewhere(saved, rec, nga):
    """For a work Artsy places at the NGA that matched nothing: the NGA's objects by the same artist whose
    statement of size is word for word Artsy's (a work the NGA has retitled, perhaps), and those that
    merely measure the same (canvases come in standard sizes). Reported, never matched."""
    artists = saved.get("artists") or rec.get("artists") or []
    art_text = " \n ".join(str(rec.get(k) or "") for k in ("additional_information", "collecting_institution"))
    mine = measures(((saved.get("dimensions") or {}).get("cm") or "")) + measures(art_text)
    if not mine or not artists:
        return [], []
    if "objects_of" not in nga:
        objects_of, by_last = defaultdict(set), defaultdict(set)
        for oid, ms in nga["makers"].items():
            for m in ms:
                objects_of[m["constituentid"]].add(oid)
        for cid in objects_of:
            for n in maker_names(cid, nga)[0]:
                by_last[n.split()[-1]].add(cid)
        nga["objects_of"], nga["by_last"] = objects_of, by_last
    oids = set()
    for a in artists:
        last = (person_name(a.get("name")).split() or [""])[-1]
        for cid in nga["by_last"].get(last, ()):
            if artist_agrees(a, {"constituentid": cid}, nga):
                oids |= nga["objects_of"][cid]
    word_for_word, same_size = [], []
    for oid in sorted(oids, key=int):
        o = nga["objects"][oid]
        ident = f"NGA {o['accessionnum']} ({o['title']}, {o['displaydate'] or 'no date'}, {o['attribution']})"
        theirs = flat_dims(o["dimensions"])
        if len(theirs) > 8 and theirs == flat_dims(rec.get("additional_information")):
            word_for_word.append(ident)
        elif dims_agree(mine, measures(o["dimensions"]))[0] == "agree":
            same_size.append(ident)
    return word_for_word, same_size


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
    for m in re.finditer(r"\.((?:\[\d{1,2}\])*)(?=\s+[\"“(A-Za-z])", text[a:b]):
        i = a + m.start()
        if depth[i]:
            continue
        before = re.search(r"(\S+)$", text[a:i])
        tok = before.group(1) if before else ""
        word = re.sub(r"^[\[(\"“']+", "", tok)
        if re.fullmatch(r"\d{4}", word) or tok.endswith((")", "]", '"', "”")):
            out.append(a + m.end())
        elif re.fullmatch(r"[A-Za-zÀ-ÿ'’]+(?:-[A-Za-zÀ-ÿ'’]+)*", word) and len(word) >= 3 and word.lower() not in ABBR \
                and not word.isupper():
            out.append(a + m.end())
    return out


FOOTMARK = re.compile(r"\[(\d{1,2})\]")
KIN = (r"(?:wife|husband|widow|widower|sons?|daughters?|nephew|niece|brother|sister|father|mother|cousin|heirs?|"
       r"grandson|granddaughter|grandnephew|grandniece|children|child|stepson|stepdaughter|son-in-law|"
       r"daughter-in-law|executors?|executrix|legatee|trustees?|descendants?|partner|friend)")
AUCTION = re.compile(r"(drouot|christie|sotheby|parke|bernet|american art|georges petit|galliera|charpentier|lepke|"
                     r"helbing|cassirer|dorotheum|kornfeld|bonhams|phillips|m[uü]ller|lempertz|weinm[uü]ller|hampel|"
                     r"koller|tajan|artcurial|swann|doyle|freeman|bukowski|mak van waay|puttick|anderson|h[oô]tel|"
                     r"salle|rooms|galerie|galleries|gallery|atelier|auction|kunst|&|manson|association|ltd|inc)", re.I)


SOLD = re.compile(r"\b(?:sale|auction|vente|sold)\b", re.I)
# Houses that only auction (Georges Petit, Charpentier and the like were dealers too).
AUCTIONEER = re.compile(r"christie|sotheby|drouot|parke[- ]bernet|american art association|galliera|lepke|dorotheum|"
                        r"lempertz|weinm[uü]ller|bonhams|bukowski", re.I)


def auction(inner):
    """Is a parenthesis an auction? "(his sale, ...)", or an auctioneer with a day and a lot:
    "(Christie, Manson & Woods, London, 21 June 1912, no. 140)", "(sold Geneva, Christie's, Nov 6, 1969, no. 154)"."""
    if re.search(r"\b(?:sale|auction|vente|lots?\s+\d+)\b", inner, re.I):
        return True
    return bool(AUCTIONEER.search(inner) and re.search(r"\b(?:no|nos|lot|lots)\.?\s*\d|\bbought in\b", inner, re.I)
                and any(len(d) == 10 for d in dates_in(inner)))
LINK = {"by", "to", "at", "in", "from", "through", "via", "with", "for", "and", "of", "the", "his", "her", "their",
        "its", "sold", "bought", "purchased", "acquired", "consigned", "offered", "lent"}


def sale_cuts(text, a, b, depth):
    """An owner's own sale is its own event: "Jerome Stonborough (sale, Parke-Bernet ...)" is cut before
    the parenthesis, and "(sale, 1989), Mr. and Mrs. Paul Mellon" after it."""
    cuts, i = [], a
    while i < b:
        if text[i] == "(" and depth[i] == 1 and (i == 0 or depth[i - 1] == 0):
            j = i
            while j < b and not (text[j] == ")" and depth[j] == 1):
                j += 1
            if j < b and auction(text[i + 1:j]):
                before = re.sub(r"[\s,;]+$", "", text[a:i])
                last = (re.findall(r"[^\s]+$", before) or [""])[0]
                if re.search(r"[A-Za-z]", before) and last.lower().strip(".,") not in LINK and not re.fullmatch(
                        r"\W*(?:possibly|probably|presumably|perhaps|reportedly|apparently|said to have been)\W*",
                        before, re.I):
                    cuts.append(i)
                after = re.match(r",\s+(?=[A-Z])", text[j + 1:b])
                if after:
                    cuts.append(j + 1 + after.end())
            i = j + 1
        else:
            i += 1
    return cuts


def provenance_pieces(text):
    """The provenance's owners, as (start, end, footnote marks) spans of the text; its numbered footnotes;
    and its other notes (whatever follows the first blank line)."""
    notes, loose, raw = {}, [], {}
    m = re.search(r"\n[ \t]*\n\s*\S", text)
    main_end = m.start() if m else len(text)
    if m:
        block = text[main_end:]
        starts = [n.start() for n in re.finditer(r"(?:(?<=\s)|^)\[\d{1,2}\.?\]", block)]
        if not starts or block[:starts[0]].strip():
            head = block[:starts[0]] if starts else block
            loose += [q.strip() for q in re.split(r"\n[ \t]*\n", head) if q.strip()]
        for x, y in zip(starts, starts[1:] + [len(block)]):
            n = re.match(r"\[(\d{1,2})\.?\]\s*(.*)", block[x:y], re.S)
            notes.setdefault(n.group(1), re.sub(r"\s+", " ", n.group(2)).strip())
            raw.setdefault(n.group(1), block[x:y].strip())
    depth = depth_map(text)
    pieces = []
    for a, b in top_split(text, ";", 0, main_end):
        cuts = [a] + sentence_breaks(text, a, b, depth)
        # "(Dealer, City), by whom sold 1952 to X" and "(sale, ...), bought by X" are two owners.
        for w in re.finditer(r",\s+(?=(?:by|from|to|through) whom\b|who (?:sold|gave|bequeathed|lent|exchanged|left)\b"
                             r"|whose\b)|(?<=\)),\s+(?=(?:bought|purchased|acquired|sold|given|bequeathed|inherited|"
                             r"returned|transferred|exchanged)\b)", text[a:b]):
            if not depth[a + w.start()]:
                cuts.append(a + w.start() + 1)
        cuts += sale_cuts(text, a, b, depth)
        cuts = sorted(set(cuts)) + [b]
        for s, e in zip(cuts, cuts[1:]):
            s, e = strip_span(text, s, e)
            if s < e:
                pieces.append([s, e])
    # A footnote mark that follows the semicolon belongs to the owner before it.
    out = []
    for s, e in pieces:
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
        marks = FOOTMARK.findall(seg)
        tail = re.search(r"(?:\s*\[\d{1,2}\])+\s*[.;,]?\s*$", seg)
        if tail and tail.start() > 0:
            s, e = strip_span(text, s, s + tail.start())
        out.append([s, e, marks])
    out = [(s, e, marks) for s, e, marks in out if re.search(r"[A-Za-z]", text[s:e])]
    # A footnote the text never points to (a mark misnumbered, or none) is kept as a note to the whole.
    pointed = {n for _, _, marks in out for n in marks}
    loose += [raw[n] for n in sorted(raw, key=int) if n not in pointed]
    return out, notes, loose


def outside_brackets(seg):
    return re.sub(r"\[[^\]]*\]", lambda m: " " * len(m.group(0)), seg)


def month_of(name):
    return MONTH3[name[:3].lower()]


LIFE = re.compile(r"\(\s*(?:(?:b|d|born|died)\.?\s*)?(?:c\.\s*)?(\d{4})\s*(?:[-–]\s*(\d{4}))?\s*\)")


def without_life_dates(seg):
    """ "Bernhard Funck (1895-1993), Munich", "Sir Gilbert Lewis (d. 1883)": life dates, not the owner's."""
    def blank(m):
        life = re.match(r"\(\s*(?:b|d|born|died)\b", m.group(0)) or (m.group(2) and int(m.group(2)) - int(m.group(1)) >= 30)
        return " " * len(m.group(0)) if life else m.group(0)
    return LIFE.sub(blank, seg)


NOT_NUM = r"(?!\d|\.\d)"  # a year ends a number: "gift to NGA, 2009." has one, "1943.3.9129" does not


def dates_in(seg):
    """Dates written in a piece of text, in order, as YYYY, YYYY-MM or YYYY-MM-DD, with a range's end."""
    found = []
    pats = [
        (rf"(?<![\d.])(\d{{1,2}})\s+({MONTH})\s*[-–]\s*(\d{{1,2}})\s+({MONTH})\s+(\d{{4}}){NOT_NUM}", "dmdmy"),
        (rf"\b({MONTH})\s+(\d{{1,2}})\s*[-–]\s*({MONTH})\s+(\d{{1,2}}),?\s+(\d{{4}}){NOT_NUM}", "mdmdy"),
        (rf"\b({MONTH})\s+(\d{{1,2}})\s*[-–]\s*(\d{{1,2}}),?\s+(\d{{4}}){NOT_NUM}", "mddy"),
        (rf"\b({MONTH})\s*[-–/]\s*({MONTH})\s+(\d{{4}}){NOT_NUM}", "mmy"),
        (rf"(?<![\d.])(\d{{1,2}})(?:\s*[-–]\s*(\d{{1,2}}))?\s+({MONTH})\s+(\d{{4}}){NOT_NUM}", "dmy"),
        (rf"\b({MONTH})\s+(\d{{1,2}}),?\s+(\d{{4}}){NOT_NUM}", "mdy"),
        (rf"\b({MONTH})\s+(\d{{4}}){NOT_NUM}", "my"),
        (rf"(?<!\d)(?<!\d\.)(\d{{4}})(?:\s*[-–/]\s*(\d{{4}}|\d{{2}}))?{NOT_NUM}", "y"),
    ]
    taken = [False] * len(seg)
    for pat, kind in pats:
        for m in re.finditer(pat, seg):
            if any(taken[m.start():m.end()]):
                continue
            before = seg[max(0, m.start() - 12):m.start()].lower()
            if kind == "y" and re.search(r"\b(no|nos|lot|inv|pp|p|l|nr|cat)\.?\s*$|#\s*$|lugt\s*(supp\.?\s*)?$", before):
                continue
            g = m.groups()
            if kind == "dmdmy":  # 7 July-28 Aug. 1966
                y = int(g[4])
                vals = [f"{y:04d}-{month_of(g[1]):02d}-{int(g[0]):02d}", f"{y:04d}-{month_of(g[3]):02d}-{int(g[2]):02d}"]
            elif kind == "mdmdy":  # March 26-April 30, 1982
                y = int(g[4])
                vals = [f"{y:04d}-{month_of(g[0]):02d}-{int(g[1]):02d}", f"{y:04d}-{month_of(g[2]):02d}-{int(g[3]):02d}"]
            elif kind == "mddy":  # March 3-15, 1990
                y, mo = int(g[3]), month_of(g[0])
                vals = [f"{y:04d}-{mo:02d}-{int(g[1]):02d}", f"{y:04d}-{mo:02d}-{int(g[2]):02d}"]
            elif kind == "mmy":
                y = int(g[2])
                vals = [f"{y:04d}-{month_of(g[0]):02d}", f"{y:04d}-{month_of(g[1]):02d}"]
            elif kind == "dmy":
                y, mo = int(g[3]), month_of(g[2])
                vals = [f"{y:04d}-{mo:02d}-{int(g[0]):02d}"] + ([f"{y:04d}-{mo:02d}-{int(g[1]):02d}"] if g[1] else [])
            elif kind == "mdy":
                vals = [f"{int(g[2]):04d}-{month_of(g[0]):02d}-{int(g[1]):02d}"]
            elif kind == "my":
                vals = [f"{int(g[1]):04d}-{month_of(g[0]):02d}"]
            else:
                y = int(g[0])
                vals = [f"{y:04d}"]
                if g[1]:
                    y2 = int(g[1]) if len(g[1]) == 4 else int(g[0][:2] + g[1])
                    if y2 > y:
                        vals.append(f"{y2:04d}")
            if not all(1000 <= int(v[:4]) <= 2030 and int(v[8:10] or 1) <= 31 for v in vals):
                continue
            for i in range(m.start(), m.end()):
                taken[i] = True
            found.append((m.start(), vals))
    found.sort()
    return [v for _, vals in found for v in vals]


CIRCA = re.compile(rf"\b(by|c\.|ca\.|circa|about|around|before|after|probably|possibly|perhaps|reportedly|until|"
                   rf"not later than)\s+(?:the\s+)?(?:\d|{MONTH})", re.I)


def start_end(seg):
    ds = dates_in(seg)
    if not ds:
        return "", "", False
    circa = bool(CIRCA.search(seg) or re.search(r"\d{3}0s\b", seg))  # "early 1930s"
    if len(set(ds)) == 1 and re.search(r"\buntil(?:\s+at\s+least)?\s+(?:c\.\s*)?[^\d]{0,12}" + ds[0][:4], seg):
        return "", ds[0], circa  # "..., until at least 1949": when it was still theirs, not when it came
    return ds[0], (ds[-1] if len(ds) > 1 and ds[-1] != ds[0] else ""), circa


def components(seg):
    return [seg[a:b].strip() for a, b in top_split(seg, ",") if seg[a:b].strip()]


def placeish(c):
    c = re.sub(r"\s+", " ", c).strip().rstrip(".")
    if not c or re.search(r"[\d?()\[\]]|\.\s", c) or INSTITUTION.search(c) or c.lower() in CORP:
        return False
    if re.fullmatch(MONTH, c) or re.match(r"(?:The|A|An)\s", c) and c not in ("The Hague", "The Bronx"):
        return False
    words = c.replace("-", " ").split()
    if len(words) > 4 or not words[0][:1].isupper() or c.isupper() and len(c) <= 4 and c.lower() not in COUNTRIES:
        return False
    return all(w[:1].isupper() or w.lower() in PARTICLES or w.lower().startswith(("l'", "d'"))
               for w in words)


POSTAL = {"AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
          "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
          "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"}


def country_of(c):
    if re.sub(r"\s+", "", (c or "").strip().rstrip(".")) in POSTAL and (c or "").strip().rstrip(".").isupper():
        return "US"
    c = re.sub(r"\s+", " ", (c or "").strip().lower())
    for k in (c, c.rstrip("."), c.rstrip(".") + "."):
        if k in COUNTRIES:
            return COUNTRIES[k]
        if k in US_STATES:
            return "US"
    return None


def place_after(comps):
    """City and country from the components that follow a name: "New York", "Upperville, Virginia"."""
    comps = [re.sub(r"\s+", " ", c).strip() for c in comps]
    comps = [c for c in comps if c and c.lower().rstrip(".") not in CORP and c.lower() not in CORP]
    places = []
    for c in comps:
        if placeish(c) or country_of(c) is not None:
            places.append(c)
        elif c[:1].isupper() or re.search(r"[\[(\d]", c[:1]):
            return "", ""  # a title or another name follows: which part is the place is not clear
        else:
            break  # "and later ...", "by 1920"
    if not places:
        return "", ""
    first = places[0].rstrip(".").strip()
    if country_of(first) is not None and not (len(places) > 1 and country_of(places[1]) is not None):
        return "", country_of(first) or ""
    country = ""
    if len(places) > 1:
        nxt = country_of(places[1])
        if nxt is None:
            return "", ""  # several places: which one is not said
        country = nxt
    if first.lower().startswith("and "):
        return "", ""
    return first, country


OWNER_STOP = {"mr", "mrs", "and", "the", "of", "de", "del", "della", "van", "von", "der", "la", "le", "du", "y", "sir",
              "lady", "lord", "dr", "miss", "madame", "monsieur", "mme", "don", "dona", "baron", "baroness", "count",
              "countess", "comte", "comtesse", "duke", "duchess", "prince", "princess", "marquis", "earl", "czar",
              "tsar", "king", "queen", "emperor", "empress", "pope", "cardinal", "bishop", "rev", "reverend", "jr",
              "sr", "und", "zu", "graf", "grafin", "furst", "herzog", "conte", "contessa", "marchese", "duca"}
FIRM_SUFFIX = {"co", "company", "inc", "ltd", "limited", "and", "llc", "gmbh", "sa", "ag", "cie", "et"}


TITLES = {"mr", "mrs", "ms", "miss", "mme", "mlle", "madame", "monsieur", "dr", "sir", "lady", "lord", "rev",
          "reverend", "prof", "professor", "capt", "captain", "major", "admiral", "general", "col", "colonel", "lieut",
          "senator", "judge", "hon", "count", "countess", "comte", "comtesse", "baron", "baroness", "duke", "duchess",
          "prince", "princess", "marquis", "marquise", "marquess", "earl", "don", "dona", "herr", "frau", "graf",
          "grafin", "furst", "furstin", "herzog", "conte", "contessa", "marchese", "marchesa", "duca", "duchessa",
          "king", "queen", "emperor", "empress", "czar", "tsar", "pope", "cardinal", "bishop"}
FEMALE = {"mrs", "ms", "miss", "mme", "mlle", "madame", "lady", "countess", "comtesse", "baroness", "duchess",
          "princess", "marquise", "dona", "frau", "grafin", "furstin", "contessa", "marchesa", "duchessa", "queen",
          "empress"}
MALE = {"mr", "monsieur", "sir", "lord", "count", "comte", "baron", "duke", "prince", "marquis", "marquess", "earl",
        "don", "herr", "graf", "furst", "herzog", "conte", "marchese", "duca", "king", "emperor", "czar", "tsar"}
# What tells two people of one name apart: "Jr.", "Sr.", "2nd marquess", "Johann II".
MARK = re.compile(r"(?:\d+(?:st|nd|rd|th)|jr|sr|ii|iii|iv|vi|vii|viii|ix|xi|xii|xiii|xiv|xv)")


def owner_names(rec, nga):
    """An NGA owner record, ready to be looked for in the text."""
    person = nga["people"].get(rec["constituentid"]) or {}
    name = squash(person.get("forwarddisplayname") or "")
    if not name or re.match(r"(unknown|anonymous|private collection)", name, re.I) or rec.get("role") == "current owner":
        return None
    if person.get("constituenttype") in ("corporate", "purchase_fund") or not person.get("lastname"):
        toks = norm(name).split()
        while toks and toks[0] == "the":
            toks = toks[1:]
        while toks and toks[-1] in FIRM_SUFFIX:
            toks = toks[:-1]
        return {"name": name, "firm": toks} if len(" ".join(toks)) >= 4 else None
    toks = norm(name).split()
    head = norm(name.split(",")[0]).split()
    last = norm(person["lastname"]).split()
    if not find_all(head, last) and head:
        last = head[-1:]  # a peer, "Brownlow Cecil, 2nd marquess of Exeter", filed under the title
    titles = {t for t in head if t in TITLES}
    couple = person.get("constituenttype") == "couple" or "and" in head
    sex = "couple" if couple else "f" if titles & FEMALE else "m" if titles & MALE else ""
    given = [t for t in head if t not in OWNER_STOP and t not in TITLES and t not in PARTICLES and t not in last
             and not MARK.fullmatch(t)]
    return {"name": name, "last": last, "given": given, "marks": [t for t in toks if MARK.fullmatch(t)], "sex": sex}


def find_all(toks, seq):
    n = len(seq)
    return [i for i in range(len(toks) - n + 1) if seq and toks[i:i + n] == seq]


# Capitalised at the head of a sentence, but not part of a name.
NOT_NAME = {"possibly", "probably", "presumably", "perhaps", "reportedly", "supposedly", "apparently", "purchased",
            "sold", "acquired", "gift", "given", "from", "by", "to", "bequest", "bequeathed", "inherited",
            "inheritance", "commissioned", "consigned", "deeded", "transferred", "exchanged", "the", "his", "her",
            "their", "its", "with", "for", "through", "in", "at", "on", "or", "estate", "heirs", "sale", "lent",
            "returned", "bought", "owned", "according", "see", "purchase", "confiscated", "restituted", "seized",
            "recovered", "collection", "private", "artist", "sitter", "after", "before", "until", "since", "then",
            "later", "also", "which", "who", "whose", "when", "where", "this", "that", "one", "all", "mother",
            "father", "son", "daughter", "wife", "husband", "widow", "brother", "sister", "nephew", "niece", "family"}


def words_of(seg):
    """The words of a piece of provenance, each as (token, the word as written, start, end, where): the words
    outside brackets first (where 0), then those in each bracket (1, 2 ...), as the NGA puts other names
    ("[Mrs. Rudolf J. Heinemann]") and life dates there. A word of several tokens gives each of them."""
    out = []
    parts = [(outside_brackets(seg), 0, 0)] + [(m.group(1), m.start(1), n + 1)
                                                for n, m in enumerate(re.finditer(r"\[([^\]]*)\]", seg))]
    for part, offset, where in parts:
        for m in re.finditer(r"&|[^\W_]+(?:['’][^\W_]+)*\.?", part):
            for t in norm(m.group(0)).split():
                out.append((t, m.group(0), offset + m.start(), offset + m.end(), where))
    return out


def name_before(words, i, apart):
    """The name written just before the token at i (a surname), as groups split at "and", each (its titles, its
    given names): capitalised words and initials, back to a lower-case word or a comma, parenthesis or bracket;
    "von", "de la" next to the surname skipped. In "Mr. and Mrs. Paul Mellon", Mr. is Paul Mellon too."""
    def named(k):  # a capitalised word that can be part of a name
        return words[k][1][:1].isupper() and words[k][0] not in NOT_NAME and not ends(k)

    def ends(k):  # "Saint Germain-en-Laye. Auguste Pellerin": a sentence ends at word k
        t, w = words[k][0], words[k][1]
        return w.endswith(".") and len(t) > 1 and t not in TITLES and t not in ABBR and not MARK.fullmatch(t)

    k = i - 1
    while k >= 0 and not apart(k) and words[k][0] in PARTICLES and not words[k][1][:1].isupper():
        k -= 1
    run = []
    while k >= 0 and not apart(k):
        t, w = words[k][0], words[k][1]
        if t in ("and", "et") or (t in PARTICLES and not w[:1].isupper()):  # "Silva y Alvarez de Toledo"
            if not (k > 0 and not apart(k - 1) and named(k - 1)):
                break
        elif not named(k):
            break
        if t not in PARTICLES or t in ("and", "et"):
            run.insert(0, t)
        k -= 1
    groups, cur = [], (set(), [])
    for t in run:
        if t in ("and", "et"):
            groups.append(cur)
            cur = (set(), [])
        elif t in TITLES:
            cur[0].add(t)
        else:
            cur[1].append(t)
    groups.append(cur)
    for n in range(len(groups) - 2, -1, -1):
        if not groups[n][1]:
            groups[n][1].extend(groups[n + 1][1])
    return groups, k + 1


def same_name(a, b):
    return a == b or (len(a) == 1 and b[:1] == a) or (len(b) == 1 and a[:1] == b)


def person_here(n, words, i, apart):
    """Is the NGA's owner record n the person whose surname is at token i? The given names written before it
    are the record's (or their initials), no more and no fewer; a "Mrs." or "Mme" on one side is on the other
    (Mrs. Charles R. Henschel is not Charles R. Henschel); a "Jr.", "2nd" or "II" in the record is in the text."""
    groups, start = name_before(words, i, apart)
    around = {w[0] for w in words[start:i + len(n["last"]) + 6]}
    if not all(m in around for m in n["marks"]):
        return 0

    def mine(t):  # a name the record has, or a middle initial it leaves out ("Fritz A. Molle")
        return any(same_name(t, g) for g in n["given"]) or t in n["last"] or t in n["marks"] or len(t) == 1

    def fits(names):
        return all(mine(t) for t in names) and all(any(same_name(t, g) for t in names) for g in n["given"])

    def score(titles):
        """2: the same (a "Mrs." on both sides, or none); 1: a woman's title in the text and a record without one
        (Empress Catherine II); 0: not the same person. "Mrs." and "Mme" go with a husband's names, so they never
        fit a record without them: Mrs. Charles R. Henschel is not Charles R. Henschel."""
        sex = "f" if titles & FEMALE and not titles & MALE else "m" if titles & MALE else ""
        if sex == n["sex"] or n["sex"] == "couple" or (sex, n["sex"]) in (("m", ""), ("", "m")):
            return 2
        return 1 if (sex, n["sex"]) == ("f", "") and not titles & {"mrs", "mme", "madame"} else 0

    if n["sex"] == "couple":  # "Mr. and Mrs. Julian Ganz" in "Jo Ann and Julian Ganz"
        every = [t for _, names in groups for t in names]
        ok = all(any(same_name(t, g) for t in every) for g in n["given"]) and \
            any(nm and all(mine(t) for t in nm) for _, nm in groups)
        return 2 if ok else 0
    if len(groups) > 1:  # a couple in the text: "Mr. and Mrs. Paul Mellon" is both
        return max((score(titles) for titles, names in groups if fits(names)), default=0)
    return score(groups[0][0]) if fits(groups[0][1]) else 0


def align_owners(pieces, text, owners, nga):
    """The NGA's owner records laid against the pieces of the provenance text: a piece gets every owner
    it spells out — a firm's whole name; a person's surname with the given names written just before it
    (or their initials) — in the order the text names them."""
    names = [n for n in (owner_names(r, nga) for r in owners) if n]
    got = defaultdict(list)
    for j, (s, e, _) in enumerate(pieces):
        seg = text[s:e]
        flat = outside_brackets(seg)
        words = words_of(seg)
        toks = [w[0] for w in words]

        def apart(k, words=words, seg=seg, flat=flat):  # a comma, bracket or the like between word k and the next
            a, b = words[k], words[k + 1]
            return a[4] != b[4] or bool(re.search(r"[,;:()\[\]]", (flat if a[4] == 0 else seg)[a[3]:b[2]]))

        found, firm_spans = [], []
        for n in names:
            if "firm" in n:
                at = find_all(toks, n["firm"])
                if at:
                    found.append((at[0], n["name"], 2))
                    firm_spans += [(i, i + len(n["firm"])) for i in at]
        for n in names:
            if "last" not in n:
                continue
            for i in find_all(toks, n["last"]):
                if any(a <= i < b for a, b in firm_spans):
                    continue  # "The A.W. Mellon ... Trust" is not Andrew W. Mellon
                score = person_here(n, words, i, apart)
                if score:
                    found.append((i, n["name"], score))
                    break
        # Where two records fit one name, the one whose "Mrs." or "Mme" agrees with the text's.
        best = defaultdict(int)
        for i, _, score in found:
            best[i] = max(best[i], score)
        names_here = [name for i, name, score in sorted(found) if score == best[i]]
        for name in names_here:
            mine = set(norm(name).split()) - OWNER_STOP
            if name not in got[j] and not any(other != name and mine < set(norm(other).split()) - OWNER_STOP
                                              for other in names_here):
                got[j].append(name)  # "Agnes Ernst Meyer" is in "Eugene and Agnes Ernst Meyer"
    return got


LEAD = re.compile(r"^\s*(?:(?:Possibly|Probably|Presumably|Perhaps)\s+)?"
                  r"(?:[A-Za-z0-9][^()]*?\b(?:by|to|from|with|for|through)\s+)?\(([^()]*)\)")


def squash(t):
    return re.sub(r"\s+", " ", t).strip()


def trim(who):
    """A name without the sentence's full stop (but "Jr.", "Inc.", "W." keep theirs)."""
    who = who.strip()
    last = re.search(r"(\S+)\.$", who)
    if last and last.group(1).lower() not in ("jr", "sr", "co", "inc", "ltd", "bros", "cie", "esq", "st") \
            and len(last.group(1)) > 1:
        who = who[:-1]
    return who


def name_in_text(seg):
    """The owner as the text names them (and what follows the name), when the NGA's records don't say."""
    flat = outside_brackets(seg)
    lead = LEAD.match(flat)
    if lead:  # "(Duveen Brothers, Inc., Paris)" or "purchased 1919 by (Duveen Brothers, Inc.)"
        inner = seg[lead.start(1):lead.end(1)]
        firms = []
        for a, b in top_split(inner, ";"):
            comps = components(outside_brackets(inner[a:b]))
            if comps:
                first = re.split(r"\b(?:by|to|from|for|with)\s+(?=[A-Z])", comps[0])[-1]
                first = trim(squash(first) + (", " + comps[1] if len(comps) > 1 and comps[1].lower() in CORP else ""))
                if first[:1].isupper() and not re.search(r"\d", first):
                    firms.append(first)
        if firms:
            comps = components(outside_brackets(inner))
            return "; ".join(firms), (comps[1:] if len(firms) == 1 else [])
    head_end = len(flat)
    # "Sir Gilbert Lewis (d. 1883)", "Susan Nichols Pulsifer (Mrs. Harold Trowbridge Pulsifer)": the name ends there
    alias = re.search(r"\s\((?=\s*(?:Mrs\.?|Mme\.?|Mr\.?|née|born|b\.|d\.|died|\d))", flat)
    for i in (seg.find("["), flat.find(","), alias.start() if alias else -1):
        if i > 0:
            head_end = min(head_end, i)
    head = squash(flat[:head_end])
    rest = [r for r in components(flat[head_end:]) if r]
    if re.search(rf"\b{KIN}\s*$", head.strip(), re.I) and rest:  # "by inheritance to his wife, Emma S. Bellows"
        who, rest = squash(rest[0]), rest[1:]
    else:
        parts = re.split(r"\b(?:by|to|from|for|From|By|To)\s+(?=(?:the\s+)?[A-Z(\"“])", head)
        who = parts[-1].strip().strip('"“”').strip()
        who = re.sub(r"^(?:his|her|their|the)\s+(?=[A-Z])", "", who)
    who = re.sub(r"^(?:Possibly|Probably|Presumably|Perhaps|Reportedly|Supposedly)\s+", "", who)
    who = trim(who)
    if re.search(r"[()]", who) or not who or not who[:1].isupper() or re.match(r"(?:The artist|The sitter|NGA)\b", who) \
            or re.search(r"\d", who) or len(who.split()) > 9:
        return "", rest
    return who, rest


def sale_house(comps):
    """Auction house and city from the components after "sale": "Christie, Manson & Woods, London", or
    "Paris, Hôtel Drouot"."""
    after = [squash(c) for c in comps if not re.match(r"(no|nos|lot|lots)\b", c, re.I)]
    who, city, i = "", "", 0
    if after and not dates_in(after[0]):
        a0, a1 = after[0], (after[1] if len(after) > 1 and not dates_in(after[1]) else "")
        if AUCTION.search(a0) or INSTITUTION.search(a0) or not placeish(a0):
            who, i = a0, 1
        elif a1 and (AUCTION.search(a1) or INSTITUTION.search(a1)):
            city, who, i = a0, a1, 2
        elif a1 and (placeish(a1) or country_of(a1) is not None):
            who, i = a0, 1
        else:
            city, i = a0, 1
        while who and i < len(after) and not re.search(r"\d", after[i]) and not placeish(after[i]) \
                and country_of(after[i]) is None:
            who, i = who + ", " + after[i], i + 1  # "Christie, Manson & Woods"
        if not city and i < len(after) and not dates_in(after[i]):
            city = after[i] if placeish(after[i]) or country_of(after[i]) is not None else ""
    country = ""
    if city and country_of(city) is not None:
        city, country = "", country_of(city) or ""
    return who, city, country


def provenance_events(o, nga):
    text = (o["provenancetext"] or "").replace("\r\n", "\n")
    if not text.strip():
        return []
    pieces, notes, loose = provenance_pieces(text)
    aligned = align_owners(pieces, text, nga["owners"].get(o["objectid"], []), nga)
    events = []
    for i, (s, e, marks) in enumerate(pieces):
        seg = text[s:e]
        flat = outside_brackets(seg)
        start, end, circa = start_end(without_life_dates(flat))
        group = next((m for m in re.finditer(r"\(([^()]*)\)", flat) if auction(m.group(1))), None)
        to_nga = re.search(r"\b(NGA|National Gallery of Art)\b", seg) and not re.search(r"\b(lent|loan|deposit)",
                                                                                        seg, re.I)
        after_nga = events and events[-1]["kind"] == "held" and re.match(
            r"(?:partial |fractional )?(?:gift|life interest|bequest|remainder|transfer)", seg, re.I)
        who, city, country, venue = "", "", "", ""
        if to_nga or after_nga:
            kind, who, venue, city, country = "held", "National Gallery of Art", "National Gallery of Art", \
                "Washington", "US"
        elif group:
            kind = "sold"
            comps = components(seg[group.start(1):group.end(1)])
            k = next((j for j, c in enumerate(comps) if SOLD.search(c)), -1)
            head = SOLD.split(comps[k], 1)[1].strip(" ,.") if k >= 0 else ""
            if head and not dates_in(head) and not re.match(r"(no|nos|lot|lots|number)\b", head, re.I):
                who, city, country = sale_house([head] + comps[k + 1:])  # "sale Christie, Manson & Woods"
            else:
                who, city, country = sale_house(comps[k + 1:])
            if not who and k > 0:
                who = next((squash(c) for c in comps[:k] if AUCTION.search(c) and not dates_in(c)), "")
            if not who and aligned.get(i):
                who = "; ".join(aligned[i])
        else:
            kind = "owned"
            text_who, rest = name_in_text(seg)
            if LEAD.match(flat) and text_who:  # dealers as the text names them, then anyone else it names
                have = set(norm(text_who).split())
                more = [n for n in aligned.get(i, []) if not set(norm(n).split()) - OWNER_STOP - FIRM_SUFFIX <= have
                        and not (set(norm(n).split()) & have - OWNER_STOP - FIRM_SUFFIX - {"gallery", "galleries"})]
                who = "; ".join([text_who] + more)
            else:
                who = "; ".join(aligned[i]) if aligned.get(i) else text_who
                if text_who and len(aligned.get(i, [])) == 1 and re.search(
                        r"\b(Foundation|Trust|Collection|Gallery|Galleries|Company|Museum|Institute)\b", text_who) \
                        and set(norm(who).split()) - OWNER_STOP <= set(norm(text_who).split()):
                    who = text_who  # a body named after the owner the NGA records, as the text names it
                if who and ";" not in who and "," in who and who in flat:
                    rest = components(flat[flat.find(who) + len(who):])
            if re.match(r"\s*(?:From\s+)?the artist\b", seg, re.I) and not who:
                who = o["attribution"]
            city, country = place_after([r for r in rest if not dates_in(r)])
        note = " ".join(f"[{n}] {notes[n]}" for n in marks if n in notes)
        events.append({"kind": kind, "text": seg, "field": "provenance", "start": start, "end": end,
                       "circa": circa, "who": who, "title": "", "venue": venue, "city": city, "country": country,
                       "publication": "", "pages": "", "note": note, "url": "", "order": i + 1})
    for q in loose:  # a note to the provenance as a whole
        events.append({"kind": "other", "text": q, "field": "provenance", "start": "", "end": "", "circa": False,
                       "who": "", "title": "", "venue": "", "city": "", "country": "", "publication": "",
                       "pages": "", "note": "a note to the provenance", "url": "", "order": len(events) + 1})
    return events


def bare(c):
    """A component without its remarks in parentheses: "Rome (exhibition title in this venue: ...)" is Rome."""
    return re.sub(r"\s*\([^()]*\)", "", c).strip()


def date_only(c):
    """ "16 Oct.-7 Nov. 1915", "1980-1981": a date and nothing else."""
    return bool(re.search(r"\d", c)) and not re.search(r"[A-Za-z]{2,}", re.sub(MONTH, " ", re.sub(r"\bc\.", " ", c)))


def later_venue(seg):
    """Venue, city and country of one of a show's later venues ("National Gallery, London, 2015-2016, no. 20")."""
    comps = components(seg)
    cut = next((j for j, c in enumerate(comps) if dates_in(bare(c)) or date_only(c) or
                re.match(r"(no|nos|cat|unnumbered|repro|possibly|not in)\b", c, re.I)), len(comps))
    comps = [bare(c) for c in comps[:cut] if bare(c)]
    country, city = "", ""
    if comps and country_of(comps[-1]) is not None:
        country = country_of(comps.pop()) or ""
    if len(comps) >= 2 and placeish(comps[-1]):
        city = squash(comps.pop()).rstrip(".")
    if city and country_of(city) is not None:
        country, city = country_of(city) or country, ""
    return ", ".join(comps), city, country


def exhibition_event(r, order, field, footnotes):
    text = r["text"].strip()
    year = int(r["year"]) if re.fullmatch(r"\d{4}", r.get("year") or "") else None

    def when(ds):
        """Dates that can be the show's: they reach the NGA's own year for the entry, where it gives one
        ("Impression: Painting Quickly in France, 1860-1890" is a title, the show was in 2000)."""
        ys = [int(x[:4]) for x in ds]
        return bool(ys) and (year is None or min(ys) - 1 <= year <= max(ys) + 1)

    first_venue_end = top_split(text, ";")[0][1]
    comps = [(a, b, text[a:b].strip()) for a, b in top_split(text, ",") if text[a:b].strip()]
    single = first_venue_end == len(text)
    # Where the dates begin (single venue), or where the first venue ends (several).
    d = len(comps)
    for j, (a, b, c) in enumerate(comps):
        if single and j > 0 and (when(dates_in(c)) or re.fullmatch(MONTH, c.strip(" .")) or
                                 re.match(r"(no|nos|cat|unnumbered|possibly)\b", c, re.I)):
            d = j
            break
        if not single and b >= first_venue_end:
            d = j + 1 if a < first_venue_end else j
            break
    head = list(comps[:d])
    dated = False  # the first venue's own dates stood at its end
    if head and not single:
        a, b, c = head[-1]
        head[-1] = (a, first_venue_end, text[a:first_venue_end].strip())
        while len(head) > 1 and date_only(head[-1][2]):  # "..., The Museum of the Brooklyn Institute, 16 Oct.-7 Nov. 1915;"
            head.pop()
            dated = True
    title, venue, city, country, title_end = "", "", "", "", 0
    k = len(head)
    if k and country_of(bare(head[k - 1][2])) is not None:
        country = country_of(bare(head[k - 1][2])) or ""
        k -= 1
    if k >= 2 and placeish(bare(head[k - 1][2])):
        city = squash(bare(head[k - 1][2])).rstrip(".")
        k -= 1
    if k >= 2:
        j = k - 1
        while j > 1 and head[j][2].lower() in CORP:
            j -= 1
        venue = text[head[j][0]:head[k - 1][1]].strip()
        title, title_end = text[head[0][0]:head[j - 1][1]].strip(), head[j - 1][1]
    elif k == 1:
        if INSTITUTION.search(head[0][2]) and not re.search(r"\b(exhibition|exposition|salon|fair)\b", head[0][2], re.I) \
                and not (dated and len(head) == 1):  # "Winslow Homer in the 1870s: ... Collection, 10 Feb.-11 March 1990;"
            venue = head[0][2]
        else:
            title, title_end = head[0][2], head[0][1]
    venue = re.sub(r"^(?:starting with|beginning (?:with|at))\s+", "", venue)
    if venue.upper() == "NGA":
        venue = "National Gallery of Art"
        if not city:
            city, country = "Washington", "US"
    if city and country_of(city) is not None:
        country, city = country_of(city) or country, ""
    if city.lower() == "washington" and not country and re.search(r"Washington,?\s*D\.?\s*C\.?", text):
        country = "US"
    # "(shown only in London)": the venue is the one in London, not the first.
    only = re.search(r"\((?:shown|exhibited) only (?:in|at) ([^()]+?)\)", text)
    if only and not single:
        segs = [text[a:b] for a, b in top_split(text, ";")]
        at = [n for n, sg in enumerate(segs) if only.group(1).strip().lower() in re.sub(r"\([^()]*\)", "", sg).lower()]
        if not at:
            venue, city, country = "", "", ""
        elif at[0] > 0:
            venue, city, country = later_venue(segs[at[0]])
    # The dates: everything after the title, less titles in italics and remarks in parentheses.
    rest = text[title_end:]
    rest = re.sub(r"_[^_]*_|\([^()]*\)|\bas\s+[\"“][^\"”]*[\"”]", " ", rest)
    ds = sorted(dates_in(rest))
    start, end = (ds[0], ds[-1] if ds[-1] != ds[0] else "") if ds else ("", "")
    circa = bool(ds) and bool(CIRCA.search(rest))
    if year and not when(ds):  # none of the dates written is the show's: the NGA's year for the entry
        start, end, circa = str(year), "", False
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
        if re.search(r"(?:^|[\s.])[A-Z]$", who):
            who += "."  # "Coman, Florence E."
    title, publication = "", ""
    q = re.search(r"[\"“]([^\"”]+?)[,.]?[\"”]", text)
    books = re.findall(r"_([^_]+)_", text)
    if q and (not books or q.start() < text.find("_" + books[0] + "_")):
        title = q.group(1).strip().rstrip(".,")
        publication = next((b for b in books if text.find("_" + b + "_") > q.end()), "")
    elif books:
        title = books[0].strip()
    pages, printed = "", ""
    p = re.search(r"((?:1[5-9]\d\d|20\d\d))\)?[^:]{0,12}:\s*(.+?)\s*$", text)
    if p:
        printed = p.group(1)
        pages = re.sub(r"[,.]?\s*(?:(?:color|colour|black and white)\s+)?(?:repro|illus|fig)\b.*$", "", p.group(2))
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
    # The NGA's own year for the entry; where the text prints another year before the pages, that one.
    start = r.get("year") or ""
    if printed and start not in text:
        start = printed
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
        # The year is the NGA's own, from its record of itself as the owner ("current owner", "1971 -").
        now = [r for r in nga["owners"].get(o["objectid"], []) if r["role"] == "current owner"]
        year = now[0]["beginyear"] if len(now) == 1 and re.fullmatch(r"\d{4}", now[0]["beginyear"] or "") else ""
        note = [f"accession number {o['accessionnum']}"] if o["accessionnum"] else []
        if year:
            note.append(f"year from the NGA's record of itself as owner ({squash(now[0]['displaydate'])})")
        events.append({"kind": "held", "text": o["creditline"].strip(), "field": "creditline",
                       "start": year, "end": "", "circa": False,
                       "who": "National Gallery of Art", "title": "", "venue": "National Gallery of Art",
                       "city": "Washington", "country": "US", "publication": "", "pages": "",
                       "note": "; ".join(note), "url": "", "order": 1})
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
    """Title key -> NGA objects; and each object's whole titles (current and previous) and title parts."""
    index, nga["tkeys"] = defaultdict(set), {}
    for oid, o in nga["objects"].items():
        full, keys = title_keys(o["title"])
        fulls = {full}
        for p in nga["previous"].get(oid, []):
            f, k = title_keys(p)
            fulls.add(f)
            keys |= k
        nga["tkeys"][oid] = (fulls, keys)
        for k in keys:
            index[k].add(oid)
    return index


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="download the NGA's CSVs again")
    ap.add_argument("--only", help="one saved work (Artsy id)")
    ap.add_argument("--dry-run", action="store_true", help="match and report (data/nga/matches.json), write no histories")
    args = ap.parse_args()
    download(args.refresh)
    nga = load()
    index = title_index(nga)
    saves = [s for s in json.loads(SAVES.read_text()) if s.get("id")]
    if args.only:
        saves = [s for s in saves if s["id"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    matched, rejected, unfound, events_n, kinds = [], [], [], 0, defaultdict(int)
    for saved in saves:
        path = ARTSY / filename(saved["id"])
        rec = json.loads(path.read_text()) if path.exists() else {}
        verdict = decide(saved, rec, candidates(saved, rec, nga, index))
        who = {"id": saved["id"], "title": saved.get("title"), "date": saved.get("date"),
               "artists": [a.get("name") for a in saved.get("artists") or []],
               "partner": (saved.get("partner") or {}).get("name"),
               "collecting_institution": saved.get("collecting_institution")}
        if verdict is None:
            named = nga_named(saved, rec)[0]
            if named:  # Artsy places it at the NGA, but no NGA object has its artist and title
                word_for_word, same_size = elsewhere(saved, rec, nga)
                why = f"{named}, but no NGA object by the artist has its title"
                if word_for_word:
                    rejected.append(dict(who, reason=f"{why}; under another title, with Artsy's statement of size "
                                                     f"word for word (retitled?): " + "; ".join(word_for_word)))
                else:
                    unfound.append(dict(who, reason=why + (f" (by the artist and of the same size, under other "
                                                           f"titles: {'; '.join(same_size[:4])})" if same_size else "")))
            continue
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
    if not args.only:
        (CACHE / "matches.json").write_text(json.dumps({"matched": matched, "rejected": rejected,
                                                         "not_found": unfound}, ensure_ascii=False, indent=1))
    by_conf = defaultdict(int)
    for m in matched:
        by_conf[m["confidence"]] += 1
    print(f"{len(matched)} works matched ({dict(by_conf)}), {len(rejected)} doubtful matches rejected, "
          f"{len(unfound)} placed at the NGA by Artsy but not in its open data; "
          f"{events_n} events: {dict(sorted(kinds.items(), key=lambda kv: -kv[1]))}")


if __name__ == "__main__":
    sys.exit(main())

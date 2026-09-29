#!/usr/bin/env python3
"""What Wikidata says about the saved works it has an item for — the Wikidata layer of the artworks'
histories: who owned each work, which collections have held it and where, the exhibitions it was in,
what has been written about it, and where and when it was made.

Reads Wikidata (CC0) through its query service (query.wikidata.org, SPARQL) and its API
(www.wikidata.org, wbgetentities), for every work in the private saves dump
(data/artsy_saves_raw.json, with Artsy's fuller record from fetch_artwork_histories.py in
data/histories/artsy/works/).

The artists first. Each saved artist is found on Wikidata by Artsy's own artist id (P2042, "Artsy
artist ID", on the item), checked against Artsy's birth year where both give one; failing that, by
name (the item's label or alias, in English or another common language) among people and groups
who are artists (an occupation under artist, painter, photographer, designer or architect) or
creators of works on Wikidata, with the same birth year as Artsy's (a year either way only when the
death years agree too), and the death years within one where both give them. An artist Artsy gives
no dates for is taken only when exactly one artist on Wikidata has the name, and then any work of
theirs is matched no higher than "probable". Several people fitting equally well, and the artist is
left out.

Then the works. For each artist found, every item whose creator (P170) is that artist is read with
its labels, aliases and titles (P1476), and the saved work's title (normalised: case, accents,
punctuation, a leading article, "No."/"Number"/"#") is looked for among them: the whole title, or
every part of a two-language title ("Tete de femme (Head of a Woman)"), is a "full" match; a part
only (before a bracket, inside one, either side of a slash) is a "part" match. Where Artsy's record
links to the museum's page for the work (the Met's object ID, P3634; SFMOMA's accession number, P217),
the item with that id is a candidate too, whatever its title, if its creator is the saved work's
artist and its title is the saved one in the same words or fewer ("Mt. Katahdin (Maine), Autumn #2"
and "Mt. Katahdin, Maine, No. 2"). The candidates are then read whole (wbgetentities) and judged:

  exact     Artsy's own artwork id is on the item (P11005, "Artsy artwork ID"); or the item's
            inventory number (P217), or a museum's id for it (an external identifier), is in
            Artsy's record (its collecting institution, provenance, notes, or a link to the
            museum's page anywhere in it; a number that is a size, '51.7 x 36 cm', is not one) and
            a collection it gives is named there too;
  strong    Artsy names the holder (the museum that listed it on Artsy, its collecting
            institution, its provenance, notes or image credit — but of a dealer's or an auction
            house's listing only the provenance and collecting institution, as their essays name
            museums for comparison; and never a sentence about other objects: "four other prints of
            this image are at …", "another version …") and the item's collection (P195), location
            (P276) or owner (P127) is that holder — or part of it, or what it is part of — and the
            whole title matches, the dates agree (within a year, or two for "circa"), and the sizes
            do not differ; and no other item by the artist in that holder has the title unless the
            sizes or a catalogue number tell them apart; or, for a one-of-a-kind work, the item's
            catalogue number (P528: "F146", "JH551", or its number on a line naming the catalogue's
            author or title) is in Artsy's literature, exhibition history or notes, with the whole
            title and the dates agreeing (not when the work is for sale and Wikidata has it in a
            museum);
  probable  the holder named and agreeing, with the whole title but no date on one side, or with
            only part of the title (not a common one, unless a catalogue number agrees) and the
            dates agreeing; or part of the title with a catalogue number and the dates; or — for a
            one-of-a-kind work (painting, drawing, sculpture not in an edition) where Artsy names no
            holder — the whole title, not a common one and the artist's only item under it, the
            dates agreeing, the sizes agreeing (both must give them), and no public collection
            holding it on Wikidata that Artsy does not name.

Sizes are compared in centimetres, within 3% (or a centimetre). Where Wikidata's numbers are Artsy's
size in another unit than the one it names (the Phillips Collection's items give inches under
millimetres; some of Artsy's sizes are centimetres taken for inches), the sizes are taken as neither
agreeing nor differing, and the match says so. Artsy's
category gives way to its medium where the two disagree plainly ("Oil on canvas" filed under Print).

Never matched: the dates or sizes disagreeing; a different kind of object (a painting is not a print,
a photograph or a sculpture); an attribution ("attributed to", "workshop of", "circle of" …) on the
creator statement; a print, photograph, poster, cast or other edition (on either side) whose holder
Artsy does not name — an impression in another collection is another object — or which is for sale
(a museum named in its provenance still has its own impression, which is Wikidata's); a
one-of-a-kind work Wikidata places in a public collection Artsy does not name (a museum's work is not
on the market), unless its catalogue number agrees and it is not for sale; a common title
("Untitled", "Still Life", "Head of a Woman") without a holder or number to go by; an impression or
a common title told from the holder's others by its size alone, when another of the holder's items
under the title has no size on Wikidata (it may be the one); a series of works (but a diptych or a
triptych that Wikidata also calls a painting is one work); and two items fitting equally well. Every
such doubt is listed in data/wikidata/matches.json with the reason, next to the matches and the artists found and not found. "Exhibition credit" collecting
institutions ('"Show" at Museum') and the museum that listed a work from one are a venue, not a
holder, and are not taken as naming it.

Events, from the matched item (deprecated statements left out), each in Wikidata's own words — "text"
is the label of the statement's value (or its "stated as", P1932), or the value itself; dates,
places and names only from Wikidata's own data:
  made       P1071 location of creation (city and country from the place's own P131/P17), dated by
             P571 inception (with P1319/P1326 earliest/latest or P580/P582 start/end, "circa" from
             P1480); or P571 alone; every other P571 Wikidata gives is a "made" event of its own;
  held       P195 collection (start P580, end P582, or P585; inventory number P217, a role P3831
             ("private collection"), an owner P127, a cause P828 in the note; city and country from
             the collection's own location) and P276 location (not repeated when it is one of the
             collections and says no more);
  owned      P127 owned by (P580/P582/P585; P1932 stated as; order by P1545 series ordinal where
             given; P1642 acquisition transaction, P1534 end cause, P1480 "possibly", P1319/P8555
             date bounds and P1810 named as in the note), P1028 donated by;
  exhibited  P608 exhibition history — the exhibition item's own title, dates (P580/P582, or the
             statement's own P580/P582/P585), location (P276: one event a venue, with that venue's
             dates where the exhibition gives them), and country (P17, the statement's own first;
             its number P1545 and any "possibly" in the note; a date before the work was made, a
             slip such as '0021' for 2021, goes to the note instead); where Wikidata gives a
             museum or gallery itself as the exhibition, it is the venue, with no title and none of
             its own dates (they are its founding, not the show's);
  written    P1343 described by source (the source's title, authors P50/P2093, journal P1433,
             publication date P577, DOI P356 or full-text link P953; page P304, chapter P792 and
             section P958, plate P12275 and — where the source has none — a date P577/P585 from the
             statement), P528 catalogue code (in the P972 catalogue), and
             P973 described at URL;
  sold/other P793 significant event (a sale, an auction or a purchase, or a named sale that is one,
             is "sold"; the auction house P12995 or participants P710 as "who"; beforehand and
             afterward owned by P11811/P11812, lot number P4775, issue P433 in the note), P88
             commissioned by, and P6216 copyright status ("other").
A statement's reference URL (P854) and "stated in" (P248) go in the event's note, the URL in "url"
when the event has none of its own.

Everything read is cached under data/wikidata/ (sparql/, entities/, facts.json), so a second run
reads nothing again (--refresh reads it all again), and the histories are rebuilt from the cache.
Writes one file per matched work, private like the saves (data/ is never committed):
data/histories/wikidata/<file>.json, <file> as filename() in fetch_artwork_histories.py; a history
no longer matched is removed. The query service is asked at most three things at a time, with
backoff on 429 and 5xx.

    python3 scripts/fetch_history_wikidata.py [--only artsy-id ...] [--threads 3] [--refresh] [--dry-run]
"""

import argparse
import hashlib
import json
import re
import sys
import threading
import time
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from fetch_artwork_histories import filename  # noqa: E402

SAVES = ROOT / "data" / "artsy_saves_raw.json"
ARTSY = ROOT / "data" / "histories" / "artsy" / "works"
CACHE = ROOT / "data" / "wikidata"
OUT = ROOT / "data" / "histories" / "wikidata"
REPORT = CACHE / "matches.json"
SPARQL = "https://query.wikidata.org/sparql"
API = "https://www.wikidata.org/w/api.php"
UA = ("Art-Database artwork histories (+https://github.com/9gn957ptsb-alt/Art-Database; Wikidata reader; "
      "art-database@users.noreply.github.com) python-requests")
SOURCE = {"name": "Wikidata - structured data (CC0)",
          "licence": "CC0 1.0 Universal (public domain dedication); Wikidata's structured data: "
                     "https://www.wikidata.org/wiki/Wikidata:Licensing"}
PAGE = "https://www.wikidata.org/wiki/{}"

# Languages whose labels are read: titles on Artsy are in these, and so are museums' names.
LANGS = ["en", "mul", "en-gb", "en-us", "en-ca", "fr", "de", "es", "it", "nl", "pt", "ca", "da", "sv", "nb", "nn",
         "fi", "pl", "cs", "hu", "ro", "la", "de-ch", "de-at", "gl", "eu", "sl", "hr", "sk", "et", "lv", "lt",
         "ga", "cy", "is", "tr", "id", "vi", "af", "sq", "eo", "oc", "br", "lb", "fy", "sco", "ast", "no"]
NAME_LANGS = ["en", "mul", "fr", "de", "es", "it", "nl", "pt"]
PEOPLE = {"Q5", "Q16334295", "Q10648343", "Q1141470", "Q16979650", "Q219160", "Q1400264",
          "Q4502119"}  # human, group of humans, duo, double act, siblings, couple, artist collective, art group
ART_ROOTS = ["Q483501", "Q3391743", "Q1028181", "Q33231", "Q5322166", "Q42973", "Q1281618", "Q11569986",
             "Q644687"]  # artist, visual artist, painter, photographer, designer, architect, sculptor ...
KIND_ROOTS = {"Q3305213": "painting", "Q11060274": "print", "Q125191": "photograph", "Q860861": "sculpture",
              "Q179700": "sculpture", "Q93184": "drawing", "Q429785": "print", "Q18761202": "painting",
              "Q7725310": "series", "Q20937557": "series", "Q15709879": "series"}
PLACES = {"Q6256", "Q3624078", "Q515", "Q5119", "Q1549591", "Q1637706", "Q486972", "Q484170", "Q747074", "Q262166",
          "Q2039348", "Q1093829", "Q200250", "Q7275", "Q35657", "Q107390", "Q10864048", "Q15284", "Q3957",
          "Q532", "Q6465", "Q36784", "Q1221156"}  # countries, states, cities, towns, regions: not holders
PRIVATE_COLLECTION = "Q768717"
UNITS = {"Q174728": 1.0, "Q174789": 0.1, "Q11573": 100.0, "Q218593": 2.54, "Q3710": 30.48, "Q200323": 10.0}
CIRCA = "Q5727902"
SALE = {"Q194189", "Q177923", "Q1369832", "Q74570489"}  # sale, auction, purchasing, art auction
EXHIBITION = {"Q464980", "Q667276", "Q29023906"}
# What an exhibition-history (P608) value is: an exhibition (temporary, art, online, a world's fair), or
# — as Wikidata sometimes has it — the museum, gallery or archive where the work was shown.
EXHIBITION_CLASSES = {"Q464980", "Q667276", "Q59861107", "Q29023906", "Q172754", "Q3062261", "Q170584"}
VENUE_CLASSES = {"Q33506", "Q207694", "Q1007870", "Q3844310", "Q17431399", "Q166118", "Q2668072", "Q1030034"}
FACT_PROPS = ["P31", "P17", "P131", "P159", "P276", "P297", "P361", "P749", "P527", "P355", "P50", "P2093",
              "P1433", "P577", "P1476", "P356", "P953", "P123", "P580", "P582", "P585", "P571"]
MULTIPLE_CATEGORIES = {"Print", "Photography", "Posters", "Books and Portfolios", "Reproduction",
                       "Ephemera or Merchandise", "Video/Film/Animation"}
MULTIPLE_MEDIUM = re.compile(r"\b(lithograph|etching|engraving|screen ?print|silkscreen|serigraph|woodcut|"
                             r"wood engraving|linocut|linoleum|aquatint|drypoint|mezzotint|gelatin silver|"
                             r"chromogenic|c-print|pigment print|inkjet|archival pigment|offset|albumen|"
                             r"platinum print|palladium print|photogravure|dye transfer|giclee|giclée|"
                             r"bronze|cast)\b", re.I)
# A painting's medium: 'Oil on canvas', 'Tempera on panel', 'Acrylic on linen' (one medium, on a support).
PAINT_MEDIUM = re.compile(r"^\s*(oil|oils|oil paint|tempera|egg tempera|acrylic|encaustic|distemper)\b[^,;]{0,30}?"
                          r"\bon\s+(canvas|panel|wood|oak|poplar|board|linen|copper|fabric|cardboard|paper|"
                          r"paperboard|masonite|hardboard|plywood)", re.I)
# Paint first, on a canvas or a panel, whatever else is in it: one of a kind, not an impression.
PAINTED = re.compile(r"^\s*(oil|oils|oil paint|tempera|egg tempera|acrylic|encaustic|distemper)\b[^;]{0,80}?"
                     r"\bon\s+(canvas|panel|wood|oak|poplar|board|linen|copper)", re.I)
REPRODUCED = re.compile(r"gicl[eé]e|edition|reproduc|print|lithograph|serigraph|facsimile|poster|multiple", re.I)
# Dealers, auction houses and fairs that Artsy files as institutions.
MARKET_NAME = re.compile(r"christie|sotheby|bonhams|\bphillips\b(?! collection)|auction|photofairs|art fair", re.I)
# A sentence about other objects than the one listed.
ELSEWHERE = re.compile(r"\b(other|others|another|similar|comparable|compare|cf|related|version|versions|replica|"
                       r"replicas|variant|variants|pendant|companion|impressions|examples|counterpart|"
                       r"also in|likewise)\b", re.I)
NOT_HAND = re.compile(r"attribut|possib|probabl|presum|workshop|atelier|circle|follower|school|manner|after|"
                      r"copy|studio|disputed|uncertain|imitat|style of|formerly|workshop|assistant|doubt", re.I)
GENERIC = set("""
untitled sans titre senza titolo ohne titel sin titulo sem zonder composition komposition composizione
composicion compositie compositio landscape landscapes paysage paysages paesaggio landschaft paisaje landschap
still life lifes nature morte natura naturaleza muerta stilleben stilleven portrait portraits ritratto bildnis
retrato portret self selfportrait autoportrait autoritratto selbstbildnis selbstportrat autorretrato zelfportret
head heads tete tetes testa kopf cabeza hoofd woman women femme femmes donna donne frau frauen mujer vrouw
man men homme hommes uomo mann manner hombre girl girls boy boys child children enfant jeune fille figure
figures figura figur figuur nude nudes nu nus nudo akt desnudo naakt study studies etude etudes studio studie
estudio sketch sketches esquisse abstraction abstractions abstract abstrakt astratto astrazione flowers flower
fleurs fiori blumen flores bloemen bouquet vase seascape marine interior interieur sea mer beach plage trees
tree arbre arbres garden jardin seated standing reclining lying sitting assise couchee debout sitzende
liegende bust buste torso profile profil face visage mother mere mutter bather bathers baigneuse baigneuses
dancer dancers danseuse danseuses horse horses cheval chevaux bird birds oiseau oiseaux city street rue view
vue veduta ansicht scene painting paintings drawing drawings print prints dessin peinture work works oeuvre
object objects form forms shape shapes black white red blue green yellow grey gray orange brown pink purple
violet gold silver noir blanc rouge bleu vert jaune gris nero bianco rosso blu schwarz weiss rot blau
color colour colors colours couleur line lines circle square grid series serie suite variation variations no
opus op part detail fragment page plate sheet image picture photograph photo pour of with and in on at the a
an de du des la le les en et avec con mit und e y di del della im am un une au aux to from for by after
""".split())
ARTICLES = {"the", "a", "an", "le", "la", "les", "l", "el", "los", "las", "il", "lo", "gli", "der", "die", "das",
            "de", "het", "een", "un", "une", "ein", "eine", "uno", "una"}
OK_BEFORE = {"the", "collection", "collections", "courtesy", "image", "photo", "photograph", "provided", "gift",
             "purchase", "purchased", "bequest", "property", "acquired", "lent", "loan", "copyright", "credit",
             "c", "via", "from", "by", "in", "at", "of"}
CONTINUE = {"of", "for", "de", "des", "du", "di", "del", "della", "der", "van", "von", "und", "and", "y", "e",
            "zu", "fur", "voor", "d"}
NOT_NAMES = {"museum", "gallery", "collection", "private collection", "art museum", "museum of art",
             "art gallery", "collections", "the collection", "archive", "library", "foundation", "estate",
             "private", "art", "national", "fine arts", "arts", "contemporary", "modern", "public",
             "unknown", "museum of fine arts", "museum of modern art and design"}

_local = threading.local()
_gate = threading.BoundedSemaphore(3)  # the query service takes five queries at once from one address
_lock = threading.Lock()
ENT, FACTS = {}, {}
REFRESH = False


# ---------------------------------------------------------------- reading Wikidata

def session():
    if not hasattr(_local, "s"):
        _local.s = requests.Session()
        _local.s.headers.update({"User-Agent": UA, "Accept": "application/json"})
    return _local.s


def request(method, url, **kw):
    last = None
    for attempt in range(8):
        try:
            r = session().request(method, url, timeout=180, **kw)
            if r.status_code == 400:
                raise RuntimeError(f"{url}: HTTP 400 {r.text[:300]}")
            if r.status_code == 429 or r.status_code >= 500:
                retry = r.headers.get("Retry-After", "")
                wait = float(retry) if retry.isdigit() else 5 * 2 ** min(attempt, 5)
                last = f"HTTP {r.status_code}"
                if r.status_code >= 500 and attempt >= 3:
                    break  # a query that times out will time out again
                time.sleep(min(wait, 300))
                continue
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            last = e
            time.sleep(5 * 2 ** min(attempt, 5))
    raise RuntimeError(f"{url}: {last}")


def simple(v):
    val = v.get("value", "")
    if v.get("type") == "uri":
        m = re.match(r"http://www\.wikidata\.org/(?:entity|prop/direct)/([PQL]\d+)$", val)
        return m.group(1) if m else val
    return val


def sparql(query):
    """Rows of a SPARQL answer, each {variable: value} (items as Q-ids; a literal's language as
    <variable>_lang). Cached by the query's hash."""
    h = hashlib.sha1(query.encode()).hexdigest()
    path = CACHE / "sparql" / h[:2] / f"{h}.json"
    if path.exists() and not REFRESH:
        return json.loads(path.read_text())
    with _gate:
        j = request("POST", SPARQL, data={"query": query}, headers={"Accept": "application/sparql-results+json"})
    rows = []
    for b in j["results"]["bindings"]:
        row = {}
        for k, v in b.items():
            row[k] = simple(v)
            if v.get("xml:lang"):
                row[k + "_lang"] = v["xml:lang"]
        rows.append(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False))
    return rows


def lit(s):
    return json.dumps(s, ensure_ascii=False)


def items(qs):
    return " ".join(f"wd:{q}" for q in qs)


def chunks(xs, n):
    xs = list(xs)
    return [xs[i:i + n] for i in range(0, len(xs), n)]


def pmap(fn, xs, threads):
    with ThreadPoolExecutor(threads) as ex:
        return list(ex.map(fn, xs))


def entities(ids, threads=3):
    """Whole items (claims with qualifiers and references, labels and aliases), cached one a file."""
    need = []
    for q in dict.fromkeys(ids):
        if q in ENT or not re.fullmatch(r"Q\d+", q or ""):
            continue
        path = CACHE / "entities" / f"{q}.json"
        if path.exists() and not REFRESH:
            ENT[q] = json.loads(path.read_text())
        else:
            need.append(q)

    def one(batch):
        j = request("GET", API, params={"action": "wbgetentities", "ids": "|".join(batch), "format": "json",
                                         "props": "labels|aliases|claims", "languages": "|".join(LANGS)})
        got = {}
        for k, e in (j.get("entities") or {}).items():
            got[k] = e
            if e.get("redirects"):
                got[e["redirects"]["from"]] = e
        for q in batch:
            e = got.get(q) or {"id": q, "missing": ""}
            if "missing" in e:
                e = {"id": q, "missing": True}
            (CACHE / "entities").mkdir(parents=True, exist_ok=True)
            (CACHE / "entities" / f"{q}.json").write_text(json.dumps(e, ensure_ascii=False))
            with _lock:
                ENT[q] = e

    if need:
        print(f"  reading {len(need)} items", flush=True)
        pmap(one, chunks(need, 50), threads)
    return [ENT.get(q) for q in ids]


def facts(ids):
    """A few properties, the labels and the aliases of lesser items (places, museums, owners, books),
    by SPARQL — countries and cities are too large to read whole."""
    need = [q for q in dict.fromkeys(ids) if q and re.fullmatch(r"Q\d+", q) and q not in FACTS]
    if not need:
        return
    props = " ".join(f"wdt:{p}" for p in FACT_PROPS)
    langs = ",".join(lit(x) for x in LANGS)

    def one(batch):
        got = {q: {"labels": {}, "aliases": defaultdict(list), "p": defaultdict(list)} for q in batch}
        for r in sparql(f"SELECT ?x ?p ?v WHERE {{ VALUES ?x {{ {items(batch)} }} VALUES ?p {{ {props} }} "
                        f"?x ?p ?v . }}"):
            if r["v"] not in got[r["x"]]["p"][r["p"]]:
                got[r["x"]]["p"][r["p"]].append(r["v"])
        for r in sparql(f"SELECT ?x ?k ?l WHERE {{ VALUES ?x {{ {items(batch)} }} "
                        f"{{ ?x rdfs:label ?l . BIND(\"l\" AS ?k) }} UNION {{ ?x skos:altLabel ?l . BIND(\"a\" AS ?k) }} "
                        f"FILTER(LANG(?l) IN ({langs})) }}"):
            if r["k"] == "l":
                got[r["x"]]["labels"][r.get("l_lang", "")] = r["l"]
            else:
                got[r["x"]]["aliases"][r.get("l_lang", "")].append(r["l"])
        bare = [q for q in batch if not got[q]["labels"]]
        if bare:
            for r in sparql(f"SELECT ?x (SAMPLE(?l) AS ?any) WHERE {{ VALUES ?x {{ {items(bare)} }} "
                            f"?x rdfs:label ?l . }} GROUP BY ?x"):
                got[r["x"]]["labels"]["*"] = r["any"]
        with _lock:
            for q, f in got.items():
                FACTS[q] = {"labels": f["labels"], "aliases": dict(f["aliases"]), "p": dict(f["p"])}

    pmap(one, chunks(need, 120), 3)


def save_facts():
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "facts.json").write_text(json.dumps(FACTS, ensure_ascii=False))


def load_facts():
    path = CACHE / "facts.json"
    if path.exists() and not REFRESH:
        FACTS.update(json.loads(path.read_text()))


def label(q):
    """An item's name: English first, then the other languages in LANGS' order."""
    if not q:
        return ""
    e = ENT.get(q)
    labels = {k: v["value"] for k, v in (e.get("labels") or {}).items()} if e and not e.get("missing") else {}
    if not labels and q in FACTS:
        labels = FACTS[q]["labels"]
    for lang in LANGS + ["*"]:
        if labels.get(lang):
            return labels[lang]
    return next(iter(labels.values()), "")


def names(q):
    """All of an item's labels and aliases."""
    out = set()
    e = ENT.get(q)
    if e and not e.get("missing"):
        out |= {v["value"] for v in (e.get("labels") or {}).values()}
        out |= {a["value"] for v in (e.get("aliases") or {}).values() for a in v}
    f = FACTS.get(q)
    if f:
        out |= set(f["labels"].values())
        out |= {a for v in f["aliases"].values() for a in v}
    return out


def fact(q, p):
    """The values of a property of an item: from its whole record if read, else from its facts."""
    e = ENT.get(q)
    if e and not e.get("missing") and "claims" in e:
        return [v for _, v in (snak(s["mainsnak"]) for s in statements(e, p)) if v is not None]
    return (FACTS.get(q) or {}).get("p", {}).get(p, [])


# ---------------------------------------------------------------- statements

def statements(e, p):
    """An item's statements for a property, best first, deprecated ones left out."""
    st = [s for s in (e.get("claims") or {}).get(p, []) if s.get("rank") != "deprecated"]
    return sorted(st, key=lambda s: s.get("rank") != "preferred")


def snak(sn):
    """(type, value) of a snak: ('item', 'Q1'), ('time', {...}), ('quantity', (amount, unit)),
    ('string', s), ('mono', (text, lang)), ('somevalue', None), ('novalue', None)."""
    if sn.get("snaktype") != "value":
        return sn.get("snaktype"), None
    dv = sn["datavalue"]
    v, t = dv["value"], dv["type"]
    if t == "wikibase-entityid":
        return "item", v.get("id") or f"Q{v.get('numeric-id')}"
    if t == "time":
        return "time", v
    if t == "quantity":
        unit = v.get("unit", "").rsplit("/", 1)[-1]
        return "quantity", (float(v["amount"]), unit)
    if t == "monolingualtext":
        return "mono", (v["text"], v["language"])
    if t == "string":
        return "string", v
    return t, v


def quals(s, p):
    return [snak(q) for q in (s.get("qualifiers") or {}).get(p, [])]


def qual_items(s, p):
    return [v for t, v in quals(s, p) if t == "item"]


def qual_strings(s, p):
    out = []
    for t, v in quals(s, p):
        if t == "string":
            out.append(v)
        elif t == "mono":
            out.append(v[0])
    return out


def qual_time(s, p):
    for t, v in quals(s, p):
        if t == "time":
            return v
    return None


def ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def wd_time(v):
    """Wikidata's date as (text, start, end, lo, hi, note), to the precision it gives."""
    if not v:
        return None
    m = re.match(r"([+-])(\d+)-(\d\d)-(\d\d)", v["time"])
    if not m:
        return None
    sign, y, mo, d = m.group(1), int(m.group(2)), m.group(3), m.group(4)
    p = v.get("precision", 9)
    note = "Julian calendar" if v.get("calendarmodel", "").endswith("Q1985786") else ""
    if sign == "-":
        return f"{y} BCE", "", "", -y, -y, "before the common era"
    if p >= 11:
        s = f"{y:04d}-{mo}-{d}"
        return s, s, "", y, y, note
    if p == 10:
        s = f"{y:04d}-{mo}"
        return s, s, "", y, y, note
    if p == 9:
        return f"{y:04d}", f"{y:04d}", "", y, y, note
    if p == 8:
        d0 = y // 10 * 10
        return f"{d0}s", f"{d0:04d}", f"{d0 + 9:04d}", d0, d0 + 9, note or "decade precision"
    if p == 7:
        c = (y - 1) // 100 + 1
        return (f"{ordinal(c)} century", f"{(c - 1) * 100 + 1:04d}", f"{c * 100:04d}", (c - 1) * 100 + 1, c * 100,
                note or "century precision")
    if p == 6:
        k = (y - 1) // 1000 + 1
        return (f"{ordinal(k)} millennium", f"{(k - 1) * 1000 + 1:04d}", f"{k * 1000:04d}", (k - 1) * 1000 + 1,
                k * 1000, note)
    return None


def fact_time(values):
    """A date from a fact (SPARQL gives only the timestamp, not the precision): the year."""
    for v in values:
        m = re.match(r"(-?)(\d{4})-(\d\d)-(\d\d)", v or "")
        if m and not m.group(1):
            return m.group(2)
    return ""


def year_of(v):
    m = re.search(r"(?<!\d)(1[0-9]\d\d|20[0-2]\d)(?!\d)", str(v or ""))
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------- words

def fold(t, lower=True):
    t = unicodedata.normalize("NFKD", t or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    for a, b in (("ß", "ss"), ("æ", "ae"), ("œ", "oe"), ("ø", "o"), ("ł", "l"), ("đ", "d"), ("Æ", "AE"),
                 ("Œ", "OE"), ("Ø", "O"), ("ı", "i")):
        t = t.replace(a, b)
    return t.lower() if lower else t


def ntitle(t):
    t = fold(t).replace("&", " and ")
    t = re.sub(r"\bn[°º]\s*", "no ", t)
    t = re.sub(r"#\s*", " no ", t)
    t = re.sub(r"['’‘`´]", "", t)
    t = re.sub(r"[^a-z0-9]+", " ", t)
    t = re.sub(r"\b(number|nr|nummer|numero|num|nos)\b", "no", t)
    w = t.split()
    if len(w) > 1 and w[0] in ARTICLES:
        w = w[1:]
    return " ".join(w)


def title_forms(t):
    """(the whole title, its parts): a two-language title's halves, before and inside a bracket,
    either side of a slash."""
    t = t or ""
    full = ntitle(t)
    segs = []
    base = re.sub(r"\s*[(\[][^)\]]*[)\]]", " ", t).strip()
    inner = [x for x in re.findall(r"[(\[]([^)\]]*)[)\]]", t)
             if not re.fullmatch(r"\s*(recto|verso|obverse|reverse|detail|\d+)\s*", x, re.I)]
    if inner:
        segs = [base] + inner
    for sep in (" / ", " | ", " — ", " – ", " - "):
        if sep in t and not inner:
            segs = t.split(sep)
            break
    segs = [ntitle(s) for s in segs]
    segs = [s for s in segs if s and s != full]
    parts = set(segs)
    m = re.split(r",?\s+(?:from|de|aus|dalla|da)\s+(?:the\s+|la\s+|der\s+)?(?:series|portfolio|suite|serie|"
                 r"série|folge)\b", t, flags=re.I)
    if len(m) > 1 and ntitle(m[0]):
        parts.add(ntitle(m[0]))
    parts.discard(full)
    return full, segs, parts


def generic(t):
    w = t.split()
    return not w or all(x in GENERIC or x.isdigit() or re.fullmatch(r"[ivxlc]+", x) or len(x) == 1 for x in w)


def ntok(t):
    """Tokens of a name, each (as written, normalised): accents gone, oe/ue/ae folded."""
    t = fold(t, lower=False).replace("&", " and ")
    t = re.sub(r"['’‘`´]", "", t)
    out = []
    for w in re.sub(r"[^A-Za-z0-9]+", " ", t).split():
        n = w.lower()
        n = n.replace("oe", "o").replace("ue", "u").replace("ae", "a")
        out.append((w, n))
    return out


def segments(text):
    """A text's clauses, each as tokens, with no clause starts inside (a comma ends a clause); then the
    same text split everywhere but at commas, each with the tokens that begin a comma's clause, so
    that a name written across a comma ('Museum of Fine Arts, Boston') is found too."""
    parts = re.split(r"[,;:()\[\]\"“”/|\n•©]+|(?<=[A-Za-z]{3})\.\s+", text or "")
    out = [(ntok(p), None) for p in parts if p.strip()]
    for p in re.split(r"[;:()\[\]\"“”/|\n•©]+|(?<=[A-Za-z]{3})\.\s+", text or ""):
        if "," not in p:
            continue
        toks, starts = [], set()
        for k, clause in enumerate(p.split(",")):
            if k and toks:
                starts.add(len(toks))
            toks += ntok(clause)
        if starts:
            out.append((toks, starts))
    return out


# ---------------------------------------------------------------- the saves

def artsy_span(s):
    """The years a date on Artsy covers, and whether it is 'circa'."""
    s = (s or "").lower()
    circa = bool(re.search(r"\b(c\.|ca\.?|circa|about|around|approx)|^c\s?\d", s))
    ys = []
    m = re.search(r"(\d{1,2})(?:st|nd|rd|th)\s+century", s)
    if m:
        c = int(m.group(1))
        ys += [(c - 1) * 100 + 1, c * 100]
    for a, dec, b in re.findall(r"(?<!\d)(1[0-9]\d\d|20[0-2]\d)(s)?(?:\s*[-–—/]\s*(\d{2,4})(?!\d))?", s):
        y = int(a)
        ys.append(y)
        if dec:
            ys.append(y + 9)
        if b:
            y2 = int(b) if len(b) == 4 else int(a[:4 - len(b)] + b)
            if y2 < y and len(b) == 2:
                y2 += 100
            if y <= y2 <= y + 100:
                ys.append(y2)
    if not ys:
        return None
    return min(ys), max(ys), circa


def artsy_dims(saved, rec):
    """Every (height, width[, depth]) Artsy gives in cm: its fields, its statement of size, its notes."""
    out = []
    h, w = saved.get("height_cm"), saved.get("width_cm")
    if h or w or saved.get("diameter_cm"):
        out.append((h or saved.get("diameter_cm"), w or saved.get("diameter_cm")))
    for text in [((saved.get("dimensions") or {}).get("cm") or ""), ((rec.get("dimensions") or {}).get("cm") or ""),
                 rec.get("additional_information") or ""]:
        for a, b in re.findall(r"(\d+(?:[.,]\d+)?)\s*(?:cm\s*)?[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:[x×]\s*\d+(?:[.,]\d+)?\s*)?cm",
                               text):
            out.append((float(a.replace(",", ".")), float(b.replace(",", "."))))
    return [d for d in dict.fromkeys(out) if d[0]]


def is_credit(ci):
    """An exhibition credit ('"Show" at Museum', a show with its dates), not a holder."""
    ci = (ci or "").strip()
    return bool(ci) and bool(ci[:1] in "\"“”'‘" or re.search(r"[\"”]\s+at\s", ci) or re.search(r"(?<!\d)(1[89]|20)\d\d(?!\d)", ci)
                or re.search(r"\b(january|february|march|april|may|june|july|august|september|october|november|"
                             r"december)\b", ci, re.I))


def is_market(saved):
    """Listed by a dealer, an auction house or a fair: the work is for sale, and what the listing's
    essay says about museums is about other works."""
    p = saved.get("partner") or {}
    return p.get("type") in ("Gallery", "Auction") or bool(MARKET_NAME.search(p.get("name") or ""))


def own_sentences(text):
    """A text without its sentences about other objects ('four other prints of this image are at …',
    'another version is in …', 'compare …')."""
    keep = [x.strip() for x in re.split(r"(?<=[A-Za-z]{3}[.!?])\s+(?=[A-Z\"“(])|(?<=\d[.!?])\s+(?=[A-Z])|[\r\n]+",
                                        text or "")
            if x.strip() and not ELSEWHERE.search(x)]
    return "\n".join(keep)


def holder_texts(saved, rec):
    """What on Artsy can name the work's holder: the museum that listed it (unless it listed it from
    an exhibition), its collecting institution (unless that is an exhibition credit), its provenance,
    and — when a museum or an archive listed it — its notes (not their sentences about other objects)
    and image credit. A dealer's or an auction house's essay names museums for comparison; only its
    provenance and collecting institution are taken."""
    p = saved.get("partner") or {}
    ci = rec.get("collecting_institution") or saved.get("collecting_institution") or ""
    market = is_market(saved)
    out = []
    if p.get("type") in ("Institution", "Institutional Seller") and not is_credit(ci) and not market:
        out.append(p.get("name") or "")
    if ci and not is_credit(ci):
        out.append(ci)
    out.append(rec.get("provenance") or "")
    if not market:
        out += [own_sentences(rec.get("additional_information")), rec.get("image_rights") or ""]
    return [t for t in out if t]


def id_texts(saved, rec):
    """Where an inventory number or a museum's id for the work can be: the holder texts, and the notes
    and image credit of any listing (not their sentences about other objects)."""
    out = holder_texts(saved, rec)
    for t in (own_sentences(rec.get("additional_information")), rec.get("image_rights") or ""):
        if t and t not in out:
            out.append(t)
    return out


def link_texts(rec):
    """Other parts of Artsy's record where a link to the museum's page for the work can be (SFMOMA
    lists it under literature): read for links only, and not a line about other objects."""
    return [own_sentences(rec.get(f)) for f in ("literature", "exhibition_history")]


def category(saved):
    """Artsy's category, unless its medium plainly says it is a painting ('Oil on canvas' filed under
    Print). Not a sculpture: a painted one is 'Acrylic on wood'."""
    c = saved.get("category") or ""
    m = saved.get("medium") or ""
    if c in ("Print", "Photography", "Posters", "") and PAINT_MEDIUM.search(m) and not REPRODUCED.search(m):
        return "Painting"
    return c


def is_multiple(saved, rec):
    if saved.get("attribution_class") in ("limited edition", "unknown edition", "open edition"):
        return True
    if category(saved) in MULTIPLE_CATEGORIES or saved.get("edition_sets"):
        return True
    if PAINTED.search(saved.get("medium") or "") and not REPRODUCED.search(saved.get("medium") or ""):
        return False  # 'Oil, emulsion, woodcut, and straw on canvas' is a painting, not an impression
    return bool(MULTIPLE_MEDIUM.search(saved.get("medium") or "")) and saved.get("attribution_class") != "unique"


# ---------------------------------------------------------------- the artists

def resolve_artists(arts, threads):
    """Artsy artist id -> {qid, how, confidence} or {qid: None, why}."""
    out = {}
    slugs = sorted(arts)
    rows = []
    for batch in chunks(slugs, 200):
        rows += sparql(f"SELECT ?v ?item ?b ?d WHERE {{ VALUES ?v {{ {' '.join(lit(s) for s in batch)} }} "
                       f"?item wdt:P2042 ?v . OPTIONAL {{ ?item wdt:P569 ?b }} OPTIONAL {{ ?item wdt:P570 ?d }} }}")
    by_slug = defaultdict(dict)
    for r in rows:
        c = by_slug[r["v"]].setdefault(r["item"], {"b": set(), "d": set()})
        if year_of(r.get("b")):
            c["b"].add(year_of(r.get("b")))
        if year_of(r.get("d")):
            c["d"].add(year_of(r.get("d")))
    for slug, cands in by_slug.items():
        a = arts[slug]
        fit = [q for q, c in cands.items() if not (a["birth"] and c["b"] and all(abs(a["birth"] - b) > 1 for b in c["b"]))]
        if len(fit) == 1:
            out[slug] = {"qid": fit[0], "how": "Artsy artist ID (P2042) on the item" +
                         (f"; born {a['birth']} on both" if a["birth"] in cands[fit[0]]["b"] else ""),
                         "confidence": "exact"}
        elif len(fit) > 1:
            out[slug] = {"qid": None, "why": f"Artsy artist ID on several items: {', '.join(fit)}"}
        else:
            out[slug] = {"qid": None, "why": f"Artsy artist ID on {', '.join(cands)}, but the birth years differ"}
    rest = [s for s in slugs if s not in out or out[s]["qid"] is None and "several" not in out[s]["why"]]
    found = defaultdict(dict)
    by_name = defaultdict(list)
    for s in rest:
        if NOT_ARTIST.search(arts[s]["name"]):
            out[s] = {"qid": None, "why": "not the artist's own hand ('after', 'circle of' ...)"}
            continue
        by_name[arts[s]["name"]].append(s)
    variants = {n: name_variants(n) for n in by_name}
    for batch in chunks(sorted({v for vs in variants.values() for v in vs}), 20):
        vals = " ".join(f"{lit(n)}@{lg}" for n in batch for lg in NAME_LANGS)
        for r in sparql(f"SELECT ?name ?item ?t ?b ?d ?o (EXISTS {{ ?w wdt:P170 ?item }} AS ?creates) WHERE {{ "
                        f"VALUES ?name {{ {vals} }} {{ ?item rdfs:label ?name }} UNION {{ ?item skos:altLabel ?name }} "
                        f"OPTIONAL {{ ?item wdt:P31 ?t }} OPTIONAL {{ ?item wdt:P569 ?b }} "
                        f"OPTIONAL {{ ?item wdt:P570 ?d }} OPTIONAL {{ ?item wdt:P106 ?o }} }}"):
            c = found[r["name"]].setdefault(r["item"], {"t": set(), "b": set(), "d": set(), "o": set(), "creates": False})
            for k in ("t", "o"):
                if r.get(k):
                    c[k].add(r[k])
            for k in ("b", "d"):
                if year_of(r.get(k)):
                    c[k].add(year_of(r.get(k)))
            c["creates"] = c["creates"] or r.get("creates") in ("true", "1")
    occs = {o for cands in found.values() for c in cands.values() for o in c["o"]}
    art_occ = set()
    for batch in chunks(sorted(occs), 150):
        art_occ |= {r["o"] for r in sparql(f"SELECT DISTINCT ?o WHERE {{ VALUES ?o {{ {items(batch)} }} "
                                           f"VALUES ?root {{ {items(ART_ROOTS)} }} ?o wdt:P279* ?root . }}")}
    for name, slugs_ in by_name.items():
        cands = {}
        for v in variants[name]:
            cands.update(found.get(v, {}))
        artists = {q: c for q, c in cands.items()
                   if (c["t"] & PEOPLE or c["creates"]) and (c["o"] & art_occ or c["creates"])}
        for s in slugs_:
            a = arts[s]
            if a["birth"]:
                # born the same year: the same person, even if a death year disagrees; a year apart,
                # only when the death years agree
                fit = [q for q, c in artists.items()
                       if a["birth"] in c["b"] or (any(abs(a["birth"] - b) <= 1 for b in c["b"])
                                                   and a["death"] and a["death"] in c["d"])]
                if len(fit) == 1:
                    c = artists[fit[0]]
                    died = ""
                    if a["death"] and a["death"] in c["d"]:
                        died = f", died {a['death']}"
                    elif a["death"] and c["d"]:
                        died = f" (the death years differ: Artsy {a['death']}, Wikidata {min(c['d'])})"
                    out[s] = {"qid": fit[0], "how": f"name, an artist, born {a['birth']}{died}",
                              "confidence": "strong"}
                elif len(fit) > 1:
                    out[s] = {"qid": None, "why": f"several artists named so, born {a['birth']}: {', '.join(fit)}"}
                else:
                    out[s] = {"qid": None, "why": (f"artists named so ({', '.join(artists)}), but none born {a['birth']}"
                                                   if artists else "no artist of that name")}
            else:
                fit = [q for q, c in artists.items()
                       if not (a["death"] and c["d"] and all(abs(a["death"] - d) > 1 for d in c["d"]))]
                if len(fit) == 1:
                    out[s] = {"qid": fit[0], "how": "name, the one artist so named (Artsy gives no birth year)",
                              "confidence": "probable"}
                else:
                    out[s] = {"qid": None, "why": ("no birth year on Artsy, and several artists so named: " +
                                                   ", ".join(fit)) if fit else "no artist of that name"}
    return out


NOT_ARTIST = re.compile(r"\((after|attributed|circle|school|workshop|follower|studio|manner|copy)\b|"
                        r"^(after|attributed to|circle of|school of|workshop of|follower of|studio of|manner of)\s",
                        re.I)


def name_variants(name):
    """An Artsy artist's name as Wikidata may label it: without life dates in brackets, without the
    name in another script after it, with 'and' for '&', a surname in capitals written as a name."""
    out = [name]
    n = re.sub(r"\s*\((?:b\.?\s*|born\s*)?\d{4}(?:\s*[-–]\s*\d{4})?\)\s*$", "", name).strip()
    n = re.sub(r"\s*\([^)]*\)\s*$", "", n).strip() or n
    latin = re.sub(r"[\u2E80-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]+", " ", n)
    latin = re.sub(r"\s+", " ", latin).strip()
    for v in (n, latin, latin.replace("&", "and"), " ".join(w.capitalize() if w.isupper() and len(w) > 1 else w
                                                           for w in latin.split())):
        if v and v not in out:
            out.append(v)
    return out


def artist_works(qid):
    """Every item whose creator is the artist, with its labels, aliases and titles."""
    langs = ",".join(lit(x) for x in LANGS)
    works = defaultdict(set)
    for r in sparql(f"SELECT ?work ?label WHERE {{ ?work wdt:P170 wd:{qid} . "
                    f"{{ ?work rdfs:label ?label }} UNION {{ ?work skos:altLabel ?label }} UNION "
                    f"{{ ?work wdt:P1476 ?label }} FILTER(LANG(?label) IN ({langs})) }}"):
        works[r["work"]].add(r["label"])
    return works


# ---------------------------------------------------------------- the items

def item_kinds(e, kind_of):
    return {kind_of[c] for c in fact(e["id"], "P31") if c in kind_of}


def kind_conflict(category, kinds):
    if not kinds:
        return None
    allowed = {"Painting": {"painting", "drawing"}, "Drawing, Collage or other Work on Paper": {"drawing", "painting"},
               "Print": {"print", "drawing"}, "Photography": {"photograph"}, "Posters": {"print"},
               "Sculpture": {"sculpture"}}.get(category)
    if allowed is None or kinds & allowed:
        return None
    return f"Artsy's {category.lower()}, Wikidata's {', '.join(sorted(kinds))}"


def wd_dates(e):
    out = []
    for s in statements(e, "P571"):
        t, v = snak(s["mainsnak"])
        w = wd_time(v) if t == "time" else None
        if not w:
            continue
        lo, hi = w[3], w[4]
        for p, f in (("P1319", min), ("P580", min), ("P1326", max), ("P582", max)):
            q = wd_time(qual_time(s, p))
            if q:
                lo, hi = (f(lo, q[3]), hi) if p in ("P1319", "P580") else (lo, f(hi, q[4]))
        out.append((lo, hi, CIRCA in qual_items(s, "P1480")))
    return out


def dates_agree(saved, e):
    a = artsy_span(saved.get("date"))
    w = wd_dates(e)
    if not a or not w:
        return "unknown", ""
    for lo, hi, circa in w:
        tol = 1 + (2 if a[2] or circa else 0)
        if lo - tol <= a[1] and a[0] <= hi + tol:
            return "agree", ""
    return "differ", f"Artsy {saved.get('date')!r}, Wikidata {', '.join(f'{lo}-{hi}' if lo != hi else str(lo) for lo, hi, _ in w)}"


def wd_dims(e):
    def amounts(p):
        out = []
        for s in statements(e, p):
            t, v = snak(s["mainsnak"])
            if t == "quantity" and v[1] in UNITS:
                if any("frame" in label(q).lower() for q in qual_items(s, "P518")):
                    continue
                out.append(v[0] * UNITS[v[1]])
        return out
    hs, ws = amounts("P2048"), amounts("P2049")
    ds = amounts("P2386")
    if not hs and ds:
        hs = ds
    if not ws and ds:
        ws = ds
    return [(h, w) for h in hs for w in (ws or [None])]


def close(a, b):
    return abs(a - b) <= max(1.0, 0.03 * max(a, b))


UNIT_NAMES = {"Q174728": "centimetres", "Q174789": "millimetres", "Q11573": "metres", "Q218593": "inches",
              "Q3710": "feet", "Q200323": "decimetres"}


def wd_raw_dims(e):
    """Height and width as Wikidata states them: (height, its unit, width, its unit)."""
    def amounts(p):
        out = []
        for s in statements(e, p):
            t, v = snak(s["mainsnak"])
            if t == "quantity" and v[1] in UNITS:
                if any("frame" in label(q).lower() for q in qual_items(s, "P518")):
                    continue
                out.append(v)
        return out
    return [(h, hu, w, wu) for h, hu in amounts("P2048") for w, wu in amounts("P2049")]


def unit_slip(saved, rec, e):
    """Wikidata's numbers are Artsy's size in another unit than the one Wikidata names — inches entered
    under millimetres on Wikidata, or centimetres taken for inches on Artsy. Returns the words for it,
    or ''."""
    mine = artsy_dims(saved, rec)
    for h, hu, w, wu in wd_raw_dims(e):
        if hu != wu:
            continue
        for u, f in UNITS.items():
            if u == hu:
                continue
            for h1, w1 in mine:
                if w1 and ((close(h1, h * f) and close(w1, w * f)) or (close(h1, w * f) and close(w1, h * f))):
                    return (f"Wikidata's {h:g} x {w:g} {UNIT_NAMES.get(hu, hu)} are Artsy's {h1:g} x {w1:g} cm "
                            f"only if read as {UNIT_NAMES.get(u, u)} (a unit slip on one side)")
    return ""


def dims_agree(saved, rec, e):
    """'agree', 'differ', 'unknown' (a side gives none), or 'slip' (Wikidata's numbers are Artsy's
    size in another unit than it names: no size to go by, but none against)."""
    mine, theirs = artsy_dims(saved, rec), wd_dims(e)
    if not mine or not theirs:
        return "unknown"
    for h1, w1 in mine:
        for h2, w2 in theirs:
            if w1 and w2:
                if (close(h1, h2) and close(w1, w2)) or (close(h1, w2) and close(w1, h2)):
                    return "agree"
            elif close(h1, h2):
                return "agree"
    return "slip" if unit_slip(saved, rec, e) else "differ"


def holders(e, artist=None):
    """The item's holders: its collections and owners (a place, the artist, and 'private collection'
    are no holders to go by)."""
    out = []
    for p in ("P195", "P127"):
        for s in statements(e, p):
            t, v = snak(s["mainsnak"])
            if t == "item" and v not in (PRIVATE_COLLECTION, artist) and not set(fact(v, "P31")) & PLACES:
                out.append((p, v, bool(quals(s, "P582"))))
    return out


def current_public(e):
    """Collections Wikidata says hold it now (no end date), a private collection aside."""
    out = []
    for s in statements(e, "P195"):
        t, v = snak(s["mainsnak"])
        if t == "item" and v != PRIVATE_COLLECTION and not quals(s, "P582"):
            out.append(v)
    return out


class Namer:
    """Finds the holders an Artsy text names: the longest institution name at each place, a name not
    run on into a longer one ('National Gallery' in 'National Gallery of Art')."""

    def __init__(self):
        self.first = defaultdict(list)
        self.seen = set()

    def add(self, q, names_):
        for n in names_:
            toks = ntok(n)
            key = (q, tuple(t[1] for t in toks))
            if not toks or key in self.seen or " ".join(t[1] for t in toks) in NOT_NAMES:
                continue
            if len(toks) == 1 and (len(toks[0][0]) < 3 or not toks[0][0][0].isupper()):
                continue
            self.seen.add(key)
            self.first[toks[0][1]].append((q, toks))

    def named(self, texts):
        found = set()
        for text in texts:
            for seg, starts in segments(text):
                spans = []
                for i, (orig, n) in enumerate(seg):
                    for q, toks in self.first.get(n, ()):
                        j = i + len(toks)
                        if j > len(seg) or any(seg[i + k][1] != toks[k][1] for k in range(len(toks))):
                            continue
                        if starts is not None and not any(i < x < j for x in starts):
                            continue  # across commas, only the names written across one
                        if len(toks) == 1 and seg[i][0] != toks[0][0]:
                            continue  # one word, as written: 'Tate', 'MoMA'
                        if i > 0 and (starts is None or i not in starts) and seg[i - 1][0][:1].isupper() \
                                and seg[i - 1][1] not in OK_BEFORE:
                            continue
                        if j < len(seg) and (starts is None or j not in starts) and seg[j][1] in CONTINUE:
                            continue
                        spans.append((i, j, q))
                for i, j, q in spans:
                    if not any(a <= i and j <= b and (b - a) > (j - i) and q2 != q for a, b, q2 in spans):
                        found.add(q)
        return found


# Links to a museum's page for a work, and where Wikidata keeps the id in them: a property, or an
# inventory number (P217) in the museum's collection.
MUSEUM_LINKS = [(r"metmuseum\.org/art/collection/search/(\d+)", "P3634", None),         # the Met's object ID
                (r"sfmoma\.org/artwork/([0-9][\w.\-]*?)/?(?=[\s\"'<>)\]]|$)", "P217", "Q913672")]  # SFMOMA


def same_words(title, item_names):
    """The title of an item found by a museum's id, if it is the saved work's title: the same once
    normalised, or the same words but for some more on one side ('Mt. Katahdin (Maine), Autumn #2' and
    'Mt. Katahdin, Maine, No. 2'), at least two of them and not only common ones. '' if none is."""
    f, segs, parts = title_forms(title)
    mine = [x for x in [f] + segs if x]
    for n in item_names:
        g, gsegs, gparts = title_forms(n)
        if f and (f == g or f in gsegs or f in gparts):
            return f
    for n in item_names:
        g = title_forms(n)[0]
        b = set(g.split()) - ARTICLES
        for x in mine:
            a = set(x.split()) - ARTICLES
            small = a if len(a) <= len(b) else b
            if len(small) >= 2 and (a <= b or b <= a) and not generic(" ".join(sorted(small))):
                return g
    return ""


def ids_in(e, texts, links=()):
    """The item's inventory numbers and external identifiers that Artsy's record gives: an inventory
    number written in the holder texts (not a size: '51.7 x 36 cm'), or either one as part of a link
    to the museum's page for the work, wherever in the record the link is (links too)."""
    blob = "\n".join(texts)
    urls = re.findall(r"https?://[^\s\"'<>]+", "\n".join(list(texts) + [t for t in links if t]))
    segs = {s for u in urls for s in re.split(r"[/?=&#]+", u) if s}
    hits = []
    for s in statements(e, "P217"):
        t, v = snak(s["mainsnak"])
        if t == "string" and re.search(r"\d", v) and len(v) >= 3 and not re.fullmatch(r"\d{1,3}", v):
            written = any(not re.match(r"\s*(?:[x×](?![A-Za-z])|cm\b|mm\b|in(?:\.|ches\b|\s*[)\]]))", blob[m.end():], re.I)
                          and not re.search(r"(?<![A-Za-z])[x×]\s*$", blob[:m.start()], re.I)
                          for m in re.finditer(rf"(?<![\w.]){re.escape(v)}(?![\w]|\.\d)", blob))
            if written or v in segs:
                hits.append(("P217", v, qual_items(s, "P195")))
    for p, sts in (e.get("claims") or {}).items():
        for s in sts:
            if s["mainsnak"].get("datatype") == "external-id":
                t, v = snak(s["mainsnak"])
                if t == "string" and len(v) >= 5 and re.search(r"\d", v) and v in segs:
                    hits.append((p, v, []))
    return hits


def cat_agree(rec, e, artist):
    """The item's catalogue numbers (P528, a catalogue raisonné's or an exhibition catalogue's) that
    Artsy's literature, exhibition history or notes give for it: the code as Wikidata writes it
    ('F146', 'JH 551'), or its number ('no. 146') on a line naming the catalogue's author or title."""
    lines = [x for f in ("literature", "exhibition_history") for x in re.split(r"[\r\n|]+", rec.get(f) or "")]
    lines += own_sentences(rec.get("additional_information")).split("\n")
    lines = [x for x in lines if x.strip() and not ELSEWHERE.search(x)]
    if not lines:
        return []
    mine = {w for n in names(artist) for w in re.findall(r"[a-z]{4,}", fold(n))} if artist else set()
    found = []
    for s in statements(e, "P528"):
        t, v = snak(s["mainsnak"])
        if t != "string" or not re.search(r"\d", v):
            continue
        num = re.findall(r"\d+", v)[-1]
        words = set()
        for c in qual_items(s, "P972"):
            for a in fact(c, "P50"):
                words |= {w for n in names(a) for w in re.findall(r"[a-z]{4,}", fold(n))}
            words |= {w for n in names(c) for w in re.findall(r"[a-z]{5,}", fold(n))}
        words -= mine | CAT_COMMON
        code = None
        m = re.fullmatch(r"([A-Za-z]{1,4})[\s.]*(\d+)", v.strip())
        if m and m.group(1).lower() not in NOT_CODES:
            code = re.compile(rf"(?<![A-Za-z0-9]){re.escape(m.group(1))}[\s.]{{0,2}}{m.group(2)}(?![\d.])")
        numbered = re.compile(rf"\b(?:no|nos|nr|n°|cat|number|num)\.?\s*(?:\d+[a-z]?\s*,\s*)*{num}(?![\d.])", re.I)
        for x in lines:
            if (code and code.search(x)) or (words and numbered.search(x) and set(re.findall(r"[a-z]{4,}", fold(x))) & words):
                found.append(v)
                break
    return found


# Letters before a number that are words, not a catalogue's siglum ('No. 5' is in titles).
NOT_CODES = {"no", "nr", "nos", "op", "cat", "p", "pp", "pl", "fig", "vol", "n", "s", "ca", "c", "nb", "num", "inv"}
CAT_COMMON = set("""catalogue catalog raisonne raisonnee oeuvre complete works paintings painting drawings prints
werkverzeichnis catalogo ragionato generale general volume edition revised enlarged fully illustrated collection
museum gallery exhibition works with from their life among""".split())


def attribution(e, artist):
    """Words on the creator statement saying it is not simply the artist's hand."""
    for s in statements(e, "P170"):
        t, v = snak(s["mainsnak"])
        if v != artist:
            continue
        for p in ("P5102", "P1480", "P3831", "P1774"):
            for q in qual_items(s, p):
                if q != CIRCA and NOT_HAND.search(label(q) or ""):
                    return label(q)
    return None


# ---------------------------------------------------------------- matching

def judge(saved, rec, e, level, key, artist_q, artist_conf, ctx):
    """(confidence or None, how or why) for one saved work and one item."""
    q = e["id"]
    kinds = item_kinds(e, ctx["kind_of"])
    if "series" in kinds and not kinds - {"series"}:
        # a series; but a diptych or a triptych that is also a painting is one work in parts
        return None, "a series of works on Wikidata, not one work"
    why_kind = kind_conflict(category(saved), kinds)
    if why_kind:
        return None, f"a different kind of object: {why_kind}"
    hand = attribution(e, artist_q)
    if hand:
        return None, f"Wikidata's creator statement says '{hand}'"
    texts = holder_texts(saved, rec)
    ids = ids_in(e, id_texts(saved, rec), link_texts(rec))
    dates, dnote = dates_agree(saved, e)
    dims = dims_agree(saved, rec, e)
    hs = holders(e, artist_q)
    named = ctx["namer"].named(texts)
    related = {}
    for p, h, ended in hs:
        for r in [h] + [x for rp in ("P361", "P749", "P527", "P355") for x in fact(h, rp)]:
            related.setdefault(r, (p, h))
    agree = sorted({related[r][1] for r in named if r in related})
    agree_names = "; ".join(f"{label(h)} ({h})" for h in agree)
    multiple = is_multiple(saved, rec) or bool(kinds & {"print", "photograph"})
    market = is_market(saved)
    # a catalogue number identifies a one-of-a-kind work; a print's or a cast's names the edition
    cats = [] if multiple else cat_agree(rec, e, artist_q)
    cat_how = f"the catalogue number ({', '.join(cats)}) in Artsy's record" if cats else ""
    title_how = ("the whole title" if level == "full" else
                 f"the title, in fewer words on one side ('{key}')" if level == "idtitle" else
                 f"part of the title ('{key}')")
    if level == "idtitle" and not ids:
        return None, f"found by the museum's id, but the id is not in Artsy's record where it can be read, and only {title_how}"
    cap = (lambda c: "probable" if artist_conf == "probable" and c in ("exact", "strong") else c)
    size_how = ("; the sizes agree" if dims == "agree" else
                f"; {unit_slip(saved, rec, e)}" if dims == "slip" else "")
    if dates == "differ" and not ids:
        return None, f"the dates differ ({dnote})"
    if dims == "differ" and not ids:
        return None, "the sizes differ (Artsy " + "; ".join(f"{h}x{w}" for h, w in artsy_dims(saved, rec)) + " cm, Wikidata " + \
            "; ".join(f"{h:g}x{w:g}" if w else f"{h:g}" for h, w in wd_dims(e)) + " cm)"
    if ids and (agree or level == "full"):
        return cap("exact"), (f"{', '.join(f'{p} {v}' for p, v, _ in ids)} in Artsy's record; {title_how}" +
                              (f"; held by {agree_names}, which Artsy names" if agree else ""))
    if agree:
        if multiple and market:
            return None, (f"held by {agree_names}, which the provenance names, but an edition or impression on the "
                          f"market: Wikidata's is the holder's own, not the one for sale")
        if (generic(key) or multiple) and dims != "agree" and not cats:
            return None, (f"held by {agree_names}, which Artsy names, but " +
                          ("an edition or impression" if multiple else f"a common title ('{key}')") +
                          (" with no size to compare" if dims in ("unknown", "slip") else "") +
                          " — nothing to tell it from the holder's others")
        if multiple and level == "full" and dates == "agree":
            return "probable", (f"{title_how}, the date, the size and the holder ({agree_names}, which Artsy "
                                f"names): the same institution's impression")
        extra = (f"; {cat_how}" if cats else "") + size_how
        if level == "full" and dates == "agree":
            return cap("strong"), f"{title_how}, the date, and the holder: {agree_names}, which Artsy names{extra}"
        if level == "full" and dates == "unknown" and (not generic(key) or cats):
            return "probable", (f"{title_how} and the holder ({agree_names}, which Artsy names); "
                                f"no date on {'Artsy' if not artsy_span(saved.get('date')) else 'Wikidata'} to compare"
                                + extra)
        if level == "part" and dates == "agree" and (not generic(key) or cats):
            return "probable", f"{title_how}, the date and the holder ({agree_names}, which Artsy names){extra}"
        return None, (f"held by {agree_names}, which Artsy names, but only {title_how}" if level == "part" else
                      f"held by {agree_names}, which Artsy names, but the title is a common one and there is no date")
    held = [label(h) or h for h in current_public(e)]
    if multiple:
        return None, ("an edition or impression (a print, photograph, cast …): " +
                      (f"Wikidata's is held by {', '.join(held)}, which Artsy does not name" if held else
                       "Artsy does not say it is the same institution's impression"))
    if cats and dates == "agree" and not (held and market):
        # the same catalogue raisonné number, title and date: the same work, wherever Wikidata puts it
        # (a museum's loan to another's exhibition names neither) — unless it is for sale and Wikidata
        # has it in a museum
        if level == "full":
            return cap("strong"), f"{title_how}, the date and {cat_how}" + size_how
        return "probable", f"{title_how}, the date and {cat_how}" + size_how
    if held:
        return None, f"Wikidata places it in {', '.join(held)}, which Artsy does not name"
    if level != "full":
        return None, f"only {title_how}, and no holder named on both sides"
    if generic(key):
        return None, f"a common title ('{key}'), and no holder named on both sides"
    if ctx["same_title"] > 1:
        return None, f"the artist has {ctx['same_title']} items under this title on Wikidata, and no holder to go by"
    if dates != "agree":
        return None, "no date on one side to compare, and no holder named on both sides"
    if dims != "agree":
        return None, ("no sizes on one side to compare, and no holder named on both sides" if dims != "slip" else
                      "the sizes agree only in another unit than Wikidata names, and no holder named on both sides")
    return "probable", "the whole title (the artist's only item under it), the date and the size agree; no holder named"


RANK = {"exact": 3, "strong": 2, "probable": 1}


def match_all(saves, recs, artists, threads):
    """The Wikidata item for each saved work, and the doubts."""
    # Artsy's own artwork id on an item
    by_artsy = {}
    for batch in chunks([s["id"] for s in saves], 300):
        for r in sparql(f"SELECT ?v ?item WHERE {{ VALUES ?v {{ {' '.join(lit(x) for x in batch)} }} "
                        f"?item wdt:P11005 ?v . }}"):
            by_artsy.setdefault(r["v"], []).append(r["item"])
    # the museum's own id for the work, where Artsy's record links to the museum's page for it: the
    # item is a candidate whatever its title, and is judged like the others (the title must still
    # be the same, in the same or fewer words)
    by_link = defaultdict(set)
    wanted = defaultdict(set)  # (property, collection) -> ids
    for s in saves:
        blob = "\n".join(str(v) for v in (recs.get(s["id"]) or {}).values() if isinstance(v, str))
        for pat, prop, coll in MUSEUM_LINKS:
            for v in re.findall(pat, blob):
                wanted[(prop, coll)].add(v)
                by_link[(prop, coll, v)].add(s["id"])
    by_id = defaultdict(set)  # saved id -> items
    for (prop, coll), vs in wanted.items():
        for batch in chunks(sorted(vs), 200):
            where = (f"?item wdt:{prop} ?v ." if not coll else
                     f"?item p:{prop} ?st . ?st ps:{prop} ?v . ?item wdt:P195 wd:{coll} .")
            for r in sparql(f"SELECT ?v ?item WHERE {{ VALUES ?v {{ {' '.join(lit(x) for x in batch)} }} {where} }}"):
                for sid in by_link[(prop, coll, r["v"])]:
                    by_id[sid].add(r["item"])
    # the artists' works
    qids = sorted({a["qid"] for a in artists.values() if a.get("qid")})
    print(f"reading the works of {len(qids)} artists", flush=True)
    done = [0]

    def works_of(q):
        try:
            w = artist_works(q)
        except RuntimeError as err:
            print(f"  {q}: {err}", flush=True)
            w = {}
        with _lock:
            done[0] += 1
            if done[0] % 100 == 0:
                print(f"  {done[0]}/{len(qids)} artists", flush=True)
        return q, w

    works = dict(pmap(works_of, qids, threads))
    index = {}
    for q, ws in works.items():
        full, part = defaultdict(set), defaultdict(set)
        for w, labels in ws.items():
            for lb in labels:
                f, segs, parts = title_forms(lb)
                full[f].add(w)
                for p in set(segs) | parts:
                    part[p].add(w)
        index[q] = (full, part)
    # candidates
    cands = defaultdict(dict)  # saved id -> {item: (level, key, artist)}
    for s in saves:
        f, segs, parts = title_forms(s.get("title"))
        for a in s.get("artists") or []:
            aq = (artists.get(a.get("id")) or {}).get("qid")
            if not aq or aq not in index:
                continue
            full, part = index[aq]
            got = {}
            if not f:
                continue
            for w in set(full.get(f, ())) | set(part.get(f, ())):
                got[w] = ("full", f)
            if len(segs) >= 2:
                hit = [set(full.get(x, ())) | set(part.get(x, ())) for x in segs]
                for w in set.intersection(*hit):
                    got.setdefault(w, ("full", f))
            for x in segs + sorted(parts):
                for w in set(full.get(x, ())) | set(part.get(x, ())):
                    got.setdefault(w, ("part", x))
            for w, (lv, key) in got.items():
                cands[s["id"]].setdefault(w, (lv, key, aq))
        for w in by_artsy.get(s["id"], ()):
            cands[s["id"]][w] = ("artsy", s["id"], None)
    everything = sorted({w for c in cands.values() for w in c} | {w for ws in by_id.values() for w in ws})
    print(f"{len(everything)} candidate items for {len(cands)} saved works", flush=True)
    entities(everything, threads)
    # the items found by a museum's id alone: by the saved work's artist, and under the same title
    linked_out = []
    for s in saves:
        for w in sorted(by_id.get(s["id"], ())):
            if w in cands[s["id"]] or not ENT.get(w) or ENT[w].get("missing"):
                continue
            mine = [q for q in ((artists.get(a.get("id")) or {}).get("qid") for a in s.get("artists") or []) if q]
            aq = next((q for q in mine if q in fact(w, "P170")), None)
            who = {"id": s["id"], "title": s.get("title"), "date": s.get("date"),
                   "artists": [a.get("name") for a in s.get("artists") or []],
                   "partner": (s.get("partner") or {}).get("name"), "category": s.get("category"),
                   "item": w, "item_label": label(w)}
            if not aq:
                linked_out.append(dict(who, reason="the museum's id for it is on the item, but its creator is not "
                                                   "the saved work's artist on Wikidata"))
                continue
            key = same_words(s.get("title"), names(w))
            if not key:
                linked_out.append(dict(who, reason="the museum's id for it is on the item, but the titles differ"))
                continue
            f = title_forms(s.get("title"))[0]
            cands[s["id"]][w] = ("full", f, aq) if key == f else ("idtitle", key, aq)
    # what the candidates are, and who holds them
    classes = sorted({c for w in everything for c in fact(w, "P31")})
    kind_of = {}
    for batch in chunks(classes, 100):
        for r in sparql(f"SELECT ?c ?root WHERE {{ VALUES ?c {{ {items(batch)} }} "
                        f"VALUES ?root {{ {items(KIND_ROOTS)} }} ?c wdt:P279* ?root . }}"):
            kind_of.setdefault(r["c"], KIND_ROOTS[r["root"]])
    raw = sorted({v for w in everything if not ENT[w].get("missing") for p in ("P195", "P127")
                  for s in statements(ENT[w], p) for t, v in [snak(s["mainsnak"])] if t == "item"})
    facts(raw)
    hold = sorted({h for w in everything if not ENT[w].get("missing") for _, h, _ in holders(ENT[w])})
    relatives = sorted({x for h in hold for p in ("P361", "P749", "P527", "P355") for x in fact(h, p)})
    facts(relatives)
    # the institutions Artsy's partners are, so a shorter name inside theirs is not taken for them
    inst = sorted({(s.get("partner") or {}).get("name") for s in saves
                   if (s.get("partner") or {}).get("type") in ("Institution", "Institutional Seller")} - {None, ""})
    partner_items = set()
    for batch in chunks(inst, 25):
        vals = " ".join(f"{lit(n)}@{lg}" for n in batch for lg in ("en", "mul"))
        partner_items |= {r["item"] for r in sparql(f"SELECT DISTINCT ?item WHERE {{ VALUES ?n {{ {vals} }} "
                                                    f"{{ ?item rdfs:label ?n }} UNION {{ ?item skos:altLabel ?n }} }}")}
    facts(sorted(partner_items))
    # the catalogues the candidates' catalogue numbers are in, and their authors
    catalogues = sorted({c for w in everything if not ENT[w].get("missing") for s in statements(ENT[w], "P528")
                         for c in qual_items(s, "P972")})
    facts(catalogues)
    facts(sorted({a for c in catalogues for a in fact(c, "P50")}))
    save_facts()
    namer = Namer()
    for q in set(hold) | set(relatives) | partner_items:
        namer.add(q, names(q))
    # the judging
    matched, rejected = {}, []
    for s in saves:
        c = cands.get(s["id"])
        if not c:
            continue
        rec = recs.get(s["id"], {})
        verdicts = []
        for w, (lv, key, aq) in c.items():
            e = ENT.get(w)
            if not e or e.get("missing"):
                continue
            if lv == "artsy":
                verdicts.append((w, "exact", f"Artsy's artwork id {s['id']} is on the item (P11005)", "full"))
                continue
            aconf = (artists.get(next((a["id"] for a in s.get("artists") or []
                                       if (artists.get(a["id"]) or {}).get("qid") == aq), ""), {}) or {}).get("confidence")
            full, part = index.get(aq, ({}, {}))
            same = len(full.get(key, ())) if lv == "full" else len(set(part.get(key, ())) | set(full.get(key, ())))
            conf, how = judge(s, rec, e, lv, key, aq, aconf, {"kind_of": kind_of, "namer": namer, "same_title": same})
            verdicts.append((w, conf, how, lv))
        ok = [v for v in verdicts if v[1]]
        who = {"id": s["id"], "title": s.get("title"), "date": s.get("date"),
               "artists": [a.get("name") for a in s.get("artists") or []],
               "partner": (s.get("partner") or {}).get("name"), "category": s.get("category")}
        for w, conf, how, lv in verdicts:
            if not conf and lv in ("full", "part", "idtitle"):
                rejected.append(dict(who, item=w, item_label=label(w), reason=how))
        if not ok:
            continue
        best = max(RANK[v[1]] for v in ok)
        top = [v for v in ok if RANK[v[1]] == best]
        if len(top) > 1:
            sized = [v for v in top if dims_agree(s, rec, ENT[v[0]]) == "agree"]
            numbered = [v for v in top if "the catalogue number (" in v[2]]
            if len(numbered) == 1:
                top = [(numbered[0][0], numbered[0][1], numbered[0][2] + "; of the items under this title, the only "
                                                                         "one whose catalogue number agrees",
                        numbered[0][3])]
            elif len(sized) == 1:
                top = [(sized[0][0], sized[0][1], sized[0][2] + "; of the items under this title, the only one "
                                                                  "whose size agrees", sized[0][3])]
            else:
                rejected.append(dict(who, item=", ".join(v[0] for v in top),
                                     item_label="; ".join(label(v[0]) for v in top),
                                     reason="several items fit equally well: " + " | ".join(v[2] for v in top)))
                continue
        w, conf, how, _ = top[0]
        # an impression or a common title told from the holder's others by its size: not when another
        # of the holder's items under the title has no size to tell it by (it may be this one)
        held_by = set(re.findall(r"\((Q\d+)\)", how))
        unsized = [v for v in verdicts if not v[1] and v[0] != w and "no size to compare" in v[2]
                   and "nothing to tell it from the holder's others" in v[2]
                   and held_by & set(re.findall(r"\((Q\d+)\)", v[2]))]
        if unsized and conf != "exact":
            rejected.append(dict(who, item=w, item_label=label(w),
                                 reason=f"{how}; but the holder has {len(unsized)} other item(s) under this title "
                                        f"with no size on Wikidata ({', '.join(v[0] for v in unsized)}), which could "
                                        f"be this one"))
            continue
        matched[s["id"]] = (w, conf, how)
    rejected += linked_out
    return matched, rejected


# ---------------------------------------------------------------- the events

def refs(s):
    """A statement's references: (note, first reference URL)."""
    notes, url = [], ""
    for r in s.get("references") or []:
        sn = r.get("snaks") or {}
        stated = [label(v) for t, v in (snak(x) for x in sn.get("P248", [])) if t == "item"]
        urls = [v for t, v in (snak(x) for x in sn.get("P854", [])) if t == "string"]
        if stated:
            notes.append("stated in " + "; ".join(x for x in stated if x))
        if urls:
            url = url or urls[0]
            notes.append("reference URL " + urls[0])
    return "; ".join(dict.fromkeys(notes)), url


def place(q):
    """(city, country) from Wikidata's own data about a place, museum or venue, up its 'located in'
    chain: the highest city in it (Paris, not the Quartier Saint-Merri; Tokyo, not Roppongi; never a
    borough, an arrondissement or a ward), else the first municipality (Saint-Rémy-de-Provence, not the
    monastery in it; Princeton, not Mercer County), else the first settlement; and the country's ISO
    code."""
    if not q:
        return "", ""
    chain, x = [], q
    for _ in range(8):
        if not x or x in chain:
            break
        chain.append(x)
        x = (fact(x, "P131") or fact(x, "P159") or fact(x, "P276") or [None])[0]
    chain = [x for x in chain if not set(fact(x, "P31")) & PART_OF_TOWN]
    cities = [x for x in chain if x in CITIES]
    cities = [x for x in cities if not set(fact(x, "P31")) & REGIONS] or cities  # Basel, not its canton
    munis = [x for x in chain if x in MUNIS]
    settled = [x for x in chain if x in TOWNS]
    top = cities[-1] if cities else munis[0] if munis else settled[0] if settled else None
    city = label(top) if top else ""
    country = ""
    for x in chain:
        for c in fact(x, "P17"):
            iso = fact(c, "P297")
            if iso:
                country = iso[0]
                break
        if country:
            break
    return city, country


# Places by kind: a city, a municipality, or any settlement (these include the other two). Wikidata's
# class tree, climbed without end, makes a monastery a city; it is climbed three steps at most.
CITIES, MUNIS, TOWNS = set(), set(), set()
# Parts of a town, whatever else they are: neighbourhood, quarter, district, metropolitan area, borough of
# New York City, London borough, municipal arrondissement, special ward of Tokyo.
PART_OF_TOWN = {"Q123705", "Q2983893", "Q149621", "Q1907114", "Q408804", "Q211690", "Q702842", "Q5327704"}
# Countries, states, cantons, prefectures, regions, departments: a city-state is one, and a city only if
# nothing below it is.
REGIONS = {"Q6256", "Q3624078", "Q7275", "Q35657", "Q107390", "Q10864048", "Q1221156", "Q6465", "Q36784",
           "Q23058", "Q50337"}
PLACE_ROOTS = {"Q515": CITIES, "Q15284": MUNIS, "Q486972": TOWNS}


def gather_places(qs):
    """Read what places need: their chain up 'located in', their countries, which are cities,
    municipalities and settlements."""
    frontier = set(qs)
    seen = set()
    for _ in range(8):
        frontier = {q for q in frontier if q and q not in seen}
        if not frontier:
            break
        facts(sorted(frontier))
        seen |= frontier
        nxt = set()
        for q in frontier:
            for p in ("P131", "P159", "P276", "P17"):
                nxt |= set(fact(q, p)[:3])
        frontier = nxt
    facts(sorted({c for q in seen for c in fact(q, "P17")}))
    for root, found in PLACE_ROOTS.items():
        for batch in chunks(sorted(seen), 100):
            for r in sparql(f"SELECT DISTINCT ?x WHERE {{ VALUES ?x {{ {items(batch)} }} ?x wdt:P31 ?c . "
                            f"?c wdt:P279? ?c1 . ?c1 wdt:P279? ?c2 . ?c2 wdt:P279? wd:{root} . }}"):
                found.add(r["x"])
    TOWNS.update(CITIES | MUNIS)


def event(kind, text, field, order, **kw):
    e = {"kind": kind, "text": text or "", "field": field, "start": "", "end": "", "circa": False, "who": "",
         "title": "", "venue": "", "city": "", "country": "", "publication": "", "pages": "", "note": "", "url": "",
         "order": order}
    e.update({k: v for k, v in kw.items() if v is not None})
    e["note"] = "; ".join(x for x in dict.fromkeys(str(e["note"]).split("; ")) if x)
    return e


def dated(s, *props):
    """start, end from a statement's qualifiers (P580/P582/P585 ...)."""
    start = end = ""
    notes = []
    for p in props:
        w = wd_time(qual_time(s, p))
        if not w:
            continue
        if p in ("P580", "P585") and not start:
            start = w[1]
            if w[2] and p == "P585":
                end = end or w[2]
        elif p == "P582" and not end:
            end = w[2] or w[1]
        if w[5]:
            notes.append(w[5])
    return start, end, "; ".join(notes)


def item_text(s):
    """The words of a statement: its 'stated as', else its value's label."""
    stated = qual_strings(s, "P1932")
    t, v = snak(s["mainsnak"])
    if stated:
        return stated[0], (v if t == "item" else "")
    if t == "item":
        return label(v), v
    if t == "somevalue":
        return "unknown value", ""
    if t in ("string",):
        return v, ""
    if t == "mono":
        return v[0], ""
    return "", ""


def related_ids(e):
    """Items the events will need to name or place."""
    main, qual = set(), set()
    for p in ("P1071", "P195", "P276", "P127", "P1028", "P88", "P793", "P608", "P1343", "P6216", "P528", "P571",
              "P973"):
        for s in statements(e, p):
            t, v = snak(s["mainsnak"])
            if t == "item":
                main.add(v)
            for qp in ("P972", "P1642", "P1534", "P1001", "P459", "P276", "P710", "P407", "P123", "P518", "P1480",
                       "P17", "P11811", "P11812", "P12995", "P3831", "P127", "P828", "P5102", "P4241"):
                qual |= set(qual_items(s, qp))
            for r in s.get("references") or []:
                qual |= {v2 for t2, v2 in (snak(x) for x in (r.get("snaks") or {}).get("P248", [])) if t2 == "item"}
    for s in statements(e, "P217"):
        qual |= set(qual_items(s, "P195"))
    return main, qual


def inception_of(s):
    """A P571 statement as {text, start, end, circa, note, refs}: its date to the precision given,
    narrowed by the earliest and latest dates (P1319, P1326) or the start and end of the making
    (P580, P582) where Wikidata gives them."""
    t, v = snak(s["mainsnak"])
    w = wd_time(v) if t == "time" else None
    if not w:
        return None
    start, end, notes = w[1], w[2], [w[5]]
    for p, key in (("P1319", "earliest date"), ("P580", "start time"), ("P1326", "latest date"), ("P582", "end time")):
        q = wd_time(qual_time(s, p))
        if q:
            notes.append(f"{key} {q[0]} ({p})")
            if p in ("P1319", "P580"):
                start = q[1]
            else:
                end = q[2] or q[1]
    for p, what in (("P4241", "refine date"), ("P1480", "sourcing circumstances"), ("P5102", "nature of statement")):
        vs = [label(x) for x in qual_items(s, p) if x != CIRCA]
        if vs:
            notes.append(f"{what}: {', '.join(vs)}")
    return {"text": w[0], "start": start, "end": end, "circa": CIRCA in qual_items(s, "P1480"),
            "note": "; ".join(x for x in notes if x), "refs": refs(s)}


def qual_notes(s, spec):
    """Words for a statement's qualifiers: spec is [(property, what)], items by their labels, strings
    and dates as written."""
    out = []
    for p, what in spec:
        vs = []
        for t, v in quals(s, p):
            if t == "item":
                vs.append(label(v) or v)
            elif t in ("string",):
                vs.append(v)
            elif t == "mono":
                vs.append(v[0])
            elif t == "time" and wd_time(v):
                vs.append(wd_time(v)[0])
            elif t == "quantity":
                vs.append(f"{v[0]:g}")
        if vs:
            out.append(f"{what} {', '.join(vs)}")
    return out


def believable(d, made_from):
    """A date for something that happened to the work: not before it was made (nor before 1000)."""
    y = int(d[:4]) if d and d[:4].isdigit() else None
    return y is None or (y >= 1000 and (made_from is None or y >= made_from - 1))


def events_for(e):
    ev = []
    inceptions = [x for x in (inception_of(s) for s in statements(e, "P571")) if x]
    inception = inceptions[0] if inceptions else None
    made_from = min((int(x["start"][:4]) for x in inceptions if x["start"][:4].isdigit()), default=None)
    n = 0
    for s in statements(e, "P1071"):
        text, q = item_text(s)
        city, country = place(q)
        n += 1
        note, url = refs(s)
        kw = {}
        if inception:
            kw = {"start": inception["start"], "end": inception["end"], "circa": inception["circa"]}
            note = "; ".join(x for x in [f"date from P571 inception: {inception['text']}", inception["note"], note] if x)
        ev.append(event("made", text, "P1071", n, city=city or (label(q) if q in TOWNS else ""), country=country,
                        venue="" if q in TOWNS or city == label(q) else label(q) if city else "", note=note,
                        url=url, **kw))
    # the inception itself, unless it went with the place above; and every other date Wikidata gives
    for i, inc in enumerate(inceptions[1:] if n else inceptions, 1):
        note, url = inc["refs"]
        other = "another date Wikidata gives for its making" if (n or i > 1) else ""
        ev.append(event("made", inc["text"], "P571", i, start=inc["start"], end=inc["end"], circa=inc["circa"],
                        note="; ".join(x for x in (other, inc["note"], note) if x), url=url))
    inventory = defaultdict(list)
    for s in statements(e, "P217"):
        t, v = snak(s["mainsnak"])
        if t == "string":
            for c in qual_items(s, "P195") or [None]:
                inventory[c].append(v)
    collections = []
    for i, s in enumerate(statements(e, "P195"), 1):
        text, q = item_text(s)
        start, end, dnote = dated(s, "P580", "P582", "P585")
        city, country = place(q)
        note, url = refs(s)
        extra = []
        if inventory.get(q):
            extra.append("inventory number " + ", ".join(inventory[q]))
        for qp, what in (("P1642", "acquisition"), ("P1534", "end cause")):
            if qual_items(s, qp):
                extra.append(f"{what}: " + ", ".join(label(x) for x in qual_items(s, qp)))
        extra += qual_notes(s, [("P3831", "object has role:"), ("P127", "owned by"), ("P828", "has cause:"),
                                ("P1480", "sourcing circumstances:"), ("P5102", "nature of statement:")])
        collections.append((q, bool(start or end)))
        ev.append(event("held", text, "P195", i, who=label(q) if q else "", venue=label(q) if q else "", city=city,
                        country=country, start=start, end=end, note="; ".join(x for x in extra + [dnote, note] if x),
                        url=url))
    n = 0
    for s in statements(e, "P276"):
        text, q = item_text(s)
        start, end, dnote = dated(s, "P580", "P582", "P585")
        if q and any(q == c for c, _ in collections) and not (start or end):
            continue
        city, country = place(q)
        note, url = refs(s)
        n += 1
        ev.append(event("held", text, "P276", n, venue="" if q in TOWNS else label(q),
                        city=city or (label(q) if q in TOWNS else ""), country=country, start=start, end=end,
                        note="; ".join(x for x in (dnote, note) if x), url=url))
    owners = []
    for i, s in enumerate(statements(e, "P127"), 1):
        text, q = item_text(s)
        start, end, dnote = dated(s, "P580", "P582", "P585")
        serial = qual_strings(s, "P1545")
        extra = []
        if serial:
            extra.append(f"series ordinal {serial[0]} (P1545)")
        for qp, what in (("P1642", "acquisition"), ("P1534", "end cause")):
            if qual_items(s, qp):
                extra.append(f"{what}: " + ", ".join(label(x) for x in qual_items(s, qp)))
        stated = qual_strings(s, "P1932")
        if stated and q:
            extra.append(f"Wikidata's item for the owner: {label(q)} ({q})")
        extra += qual_notes(s, [("P1480", "sourcing circumstances:"), ("P5102", "nature of statement:"),
                                ("P1319", "earliest date"), ("P8555", "latest start date"), ("P1326", "latest date"),
                                ("P828", "has cause:"), ("P1810", "named as:")])
        note, url = refs(s)
        key = (int(serial[0]) if serial and serial[0].isdigit() else 10 ** 6, i)
        owners.append((key, dict(text=text, who=label(q) if q else "", start=start, end=end,
                                 note="; ".join(x for x in extra + [dnote, note] if x), url=url)))
    for n, (_, o) in enumerate(sorted(owners, key=lambda x: x[0]), 1):
        ev.append(event("owned", o.pop("text"), "P127", n, **o))
    for i, s in enumerate(statements(e, "P1028"), 1):
        text, q = item_text(s)
        start, end, dnote = dated(s, "P580", "P582", "P585")
        note, url = refs(s)
        ev.append(event("owned", text, "P1028", i, who=label(q) if q else "", start=start, end=end,
                        note="; ".join(x for x in ("donated by", dnote, note) if x), url=url))
    for i, s in enumerate(statements(e, "P88"), 1):
        text, q = item_text(s)
        start, end, dnote = dated(s, "P580", "P582", "P585")
        note, url = refs(s)
        ev.append(event("other", text, "P88", i, who=label(q) if q else "", start=start, end=end,
                        note="; ".join(x for x in ("commissioned by", dnote, note) if x), url=url))
    n = 0
    for s in statements(e, "P793"):
        text, q = item_text(s)
        start, end, dnote = dated(s, "P580", "P582", "P585")
        where = (qual_items(s, "P276") or [None])[0]
        city, country = place(where) if where else ("", "")
        who = ", ".join(label(x) or x for x in qual_items(s, "P12995") + qual_items(s, "P710"))
        kinds_ = {q} | set(fact(q, "P31")) if q else set()  # a named sale ('Degas Collection Sale I') is an auction
        kind = "sold" if kinds_ & SALE else "exhibited" if kinds_ & EXHIBITION else "other"
        extra = qual_notes(s, [("P11811", "beforehand owned by"), ("P11812", "afterward owned by"),
                               ("P12995", "agent of action:"), ("P710", "participant:"), ("P4775", "lot number"),
                               ("P433", "issue"), ("P528", "catalogue number"), ("P1480", "sourcing circumstances:"),
                               ("P5102", "nature of statement:")])
        note, url = refs(s)
        n += 1
        ev.append(event(kind, text, "P793", n, who=who, venue=label(where) if where and where not in TOWNS else "",
                        city=city or (label(where) if where in TOWNS else ""), country=country, start=start, end=end,
                        note="; ".join(x for x in ["significant event"] + extra + [dnote, note] if x), url=url))
    n = 0
    for s in statements(e, "P608"):
        text, q = item_text(s)
        x = ENT.get(q) if q else None
        qstart, qend, dnote = dated(s, "P580", "P582", "P585")
        title = ""
        venues = []
        estart = eend = ""
        country = ""
        classes = {v for t, v in (snak(st["mainsnak"]) for st in statements(x, "P31"))} if x and not x.get("missing") \
            else set()
        if x and not classes & EXHIBITION_CLASSES and (classes & VENUE_CLASSES or statements(x, "P131")
                                                       or statements(x, "P159")):
            # Wikidata gives the museum or gallery itself as the exhibition: it is the venue, and its
            # own dates (its founding) are not the show's
            title = ""
            venues = [(q, "", "")]
        elif x and not x.get("missing"):
            titles = [v[0] for t, v in (snak(st["mainsnak"]) for st in statements(x, "P1476")) if t == "mono"]
            title = titles[0] if titles else label(q)
            for t, v in (snak(st["mainsnak"]) for st in statements(x, "P580")):
                if t == "time" and wd_time(v):
                    estart = wd_time(v)[1]
                    break
            for t, v in (snak(st["mainsnak"]) for st in statements(x, "P582")):
                if t == "time" and wd_time(v):
                    eend = wd_time(v)[2] or wd_time(v)[1]
                    break
            if not estart:
                for t, v in (snak(st["mainsnak"]) for st in statements(x, "P585")):
                    if t == "time" and wd_time(v):
                        estart = wd_time(v)[1]
                        break
            for st in statements(x, "P276"):
                t, v = snak(st["mainsnak"])
                if t == "item":
                    vs, ve, _ = dated(st, "P580", "P582")
                    venues.append((v, vs, ve))
            for t, v in (snak(st["mainsnak"]) for st in statements(x, "P17")):
                if t == "item" and fact(v, "P297"):
                    country = fact(v, "P297")[0]
                    break
        else:
            title = text
        where = qual_items(s, "P276")
        if where:
            venues = [(v, "", "") for v in where]
        own_country = [fact(c, "P297")[0] for c in qual_items(s, "P17") if fact(c, "P297")]
        if own_country:
            country = own_country[0]
        note, url = refs(s)
        extra = []
        cat = qual_strings(s, "P528")
        if cat:
            extra.append(f"catalogue number {cat[0]}")
        extra += qual_notes(s, [("P1545", "number"), ("P1480", "sourcing circumstances:"),
                                ("P5102", "nature of statement:")])
        if len(own_country) < len(qual_items(s, "P17")) or len(own_country) > 1:
            extra += qual_notes(s, [("P17", "country:")])
        pages = ", ".join(qual_strings(s, "P304"))
        for k, (v, vs, ve) in enumerate(venues or [(None, "", "")], 1):
            city, vcountry = place(v) if v else ("", "")
            vnote = f"venue {k} of {len(venues)}" if len(venues) > 1 else ""
            # a date before the work was made is a slip on Wikidata ('0021' for 2021): it is left in the
            # note, and the exhibition's own dates stand in only where there is one venue
            slips = [x for x in (qstart, qend, vs, ve) if x and not believable(x, made_from)]
            q0, q1 = (x if believable(x, made_from) else "" for x in (qstart, qend))
            v0, v1 = (x if believable(x, made_from) else "" for x in (vs, ve))
            e0, e1 = (x if believable(x, made_from) and not (slips and len(venues) > 1) else "" for x in (estart, eend))
            snote = (f"Wikidata gives {' to '.join(slips)} here, before the work was made" if slips else "")
            n += 1
            ev.append(event("exhibited", text, "P608", n, title=title,
                            venue=label(v) if v and v not in TOWNS else "",
                            city=city or (label(v) if v in TOWNS else ""), country=vcountry or country,
                            start=q0 or v0 or e0, end=q1 or v1 or e1, pages=pages,
                            note="; ".join(y for y in [vnote] + extra + [snote, dnote, note] if y), url=url))
    n = 0
    for s in statements(e, "P1343"):
        text, q = item_text(s)
        x = ENT.get(q) if q else None
        who = title = publication = start = link = ""
        if q:
            ts = []
            if x and not x.get("missing"):
                ts = [v[0] for t, v in (snak(st["mainsnak"]) for st in statements(x, "P1476")) if t == "mono"]
            title = ts[0] if ts else label(q)
            authors = [label(a) for a in fact(q, "P50")] + list(fact(q, "P2093"))
            who = "; ".join(a for a in authors if a)
            publication = "; ".join(label(p) for p in fact(q, "P1433"))
            if x and not x.get("missing"):
                for t, v in (snak(st["mainsnak"]) for st in statements(x, "P577")):
                    if t == "time" and wd_time(v):
                        start = wd_time(v)[1]
                        break
            else:
                start = fact_time(fact(q, "P577"))
            doi = fact(q, "P356")
            link = f"https://doi.org/{doi[0]}" if doi else (fact(q, "P953") or [""])[0]
        extra = []
        for qp, what in (("P792", "chapter"), ("P958", "section"), ("P1545", "number"), ("P1810", "named as"),
                         ("P528", "catalogue number"), ("P12275", "plate")):
            if qual_strings(s, qp):
                extra.append(f"{what} {', '.join(qual_strings(s, qp))}")
        if not start:  # the statement's own date for the source, where the source has none
            for qp in ("P577", "P585"):
                w = wd_time(qual_time(s, qp))
                if w:
                    start = w[1]
                    break
        qurl = (qual_strings(s, "P2699") + qual_strings(s, "P854") + qual_strings(s, "P973") +
                qual_strings(s, "P953"))
        note, rurl = refs(s)
        n += 1
        ev.append(event("written", text, "P1343", n, who=who, title=title, publication=publication, start=start,
                        pages=", ".join(qual_strings(s, "P304")), note="; ".join(y for y in extra + [note] if y),
                        url=(qurl[0] if qurl else link or rurl)))
    i = 0
    for s in statements(e, "P528"):
        t, v = snak(s["mainsnak"])
        if t != "string":
            continue
        i += 1
        cats = qual_items(s, "P972")
        c = cats[0] if cats else None
        start = ""
        if c:
            x = ENT.get(c)
            if x and not x.get("missing"):
                for t2, v2 in (snak(st["mainsnak"]) for st in statements(x, "P577")):
                    if t2 == "time" and wd_time(v2):
                        start = wd_time(v2)[1]
                        break
            else:
                start = fact_time(fact(c, "P577"))
        authors = [label(a) for a in fact(c, "P50")] + list(fact(c, "P2093")) if c else []
        note, url = refs(s)
        ev.append(event("written", v, "P528", i, title=label(c) if c else "", who="; ".join(a for a in authors if a),
                        start=start, note="; ".join(y for y in ("catalogue number", note) if y), url=url))
    i = 0
    for s in statements(e, "P973"):
        t, v = snak(s["mainsnak"])
        if t != "string":
            continue
        i += 1
        extra = []
        if qual_items(s, "P407"):
            extra.append("language " + ", ".join(label(x) or x for x in qual_items(s, "P407")))
        if qual_items(s, "P123"):
            extra.append("publisher " + ", ".join(label(x) or x for x in qual_items(s, "P123")))
        extra += qual_notes(s, [("P1476", "title"), ("P1810", "named as"), ("P1545", "number"),
                                ("P577", "publication date"), ("P50", "author"), ("P2093", "author")])
        note, _ = refs(s)
        ev.append(event("written", v, "P973", i, who=", ".join(label(x) or x for x in qual_items(s, "P123")),
                        note="; ".join(y for y in ["described at URL"] + extra + [note] if y), url=v))
    for i, s in enumerate(statements(e, "P6216"), 1):
        text, q = item_text(s)
        start, end, dnote = dated(s, "P580", "P582")
        extra = []
        if qual_items(s, "P1001"):
            extra.append("applies to " + ", ".join(label(x) for x in qual_items(s, "P1001")))
        if qual_items(s, "P459"):
            extra.append("determined by " + ", ".join(label(x) for x in qual_items(s, "P459")))
        note, url = refs(s)
        ev.append(event("other", text, "P6216", i, start=start, end=end,
                        note="; ".join(y for y in ["copyright status"] + extra + [dnote, note] if y), url=url))
    return ev


# ---------------------------------------------------------------- run

def main():
    global REFRESH
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", help="saved works (Artsy ids)")
    ap.add_argument("--threads", type=int, default=3)
    ap.add_argument("--refresh", action="store_true", help="read everything from Wikidata again")
    ap.add_argument("--dry-run", action="store_true", help="match and report (data/wikidata/matches.json), "
                                                          "write no histories")
    args = ap.parse_args()
    REFRESH = args.refresh
    threads = max(1, min(args.threads, 3))
    CACHE.mkdir(parents=True, exist_ok=True)
    load_facts()
    saves = [s for s in json.loads(SAVES.read_text()) if s.get("id")]
    if args.only:
        saves = [s for s in saves if s["id"] in set(args.only)]
    recs = {}
    for s in saves:
        path = ARTSY / filename(s["id"])
        recs[s["id"]] = json.loads(path.read_text()) if path.exists() else {}
    arts = {}
    for s in saves:
        for a in (s.get("artists") or []) + (recs[s["id"]].get("artists") or []):
            if a.get("id") and a["id"] not in arts:
                arts[a["id"]] = {"id": a["id"], "name": (a.get("name") or "").strip(),
                                 "birth": year_of(a.get("birthday")), "death": year_of(a.get("deathday"))}
    print(f"{len(saves)} saved works, {len(arts)} artists", flush=True)
    artists = resolve_artists(arts, threads)
    print(f"artists on Wikidata: {sum(1 for a in artists.values() if a.get('qid'))} of {len(arts)}", flush=True)
    matched, rejected = match_all(saves, recs, artists, threads)
    print(f"matched {len(matched)}; doubts rejected {len(rejected)}", flush=True)
    # read what the events need
    items_ = sorted({w for w, _, _ in matched.values()})
    main_ids, qual_ids = set(), set()
    for w in items_:
        m, q = related_ids(ENT[w])
        main_ids |= m
        qual_ids |= q
    readable = sorted({q for w in items_ for p in ("P608", "P1343") for s in statements(ENT[w], p)
                       for t, q in [snak(s["mainsnak"])] if t == "item"} |
                      {c for w in items_ for s in statements(ENT[w], "P528") for c in qual_items(s, "P972")})
    entities(readable, threads)
    lesser = set(main_ids | qual_ids) - set(readable)
    for q in readable:
        x = ENT.get(q)
        if x and not x.get("missing"):
            for p in ("P276", "P17", "P50", "P1433", "P123"):
                lesser |= {v for t, v in (snak(st["mainsnak"]) for st in statements(x, p)) if t == "item"}
    facts(sorted(lesser))
    places = set(main_ids) | {v for q in readable if ENT.get(q) and not ENT[q].get("missing")
                              for t, v in (snak(st["mainsnak"]) for st in statements(ENT[q], "P276")) if t == "item"}
    places |= {q for w in items_ for s in statements(ENT[w], "P793") for q in qual_items(s, "P276")}
    places |= {q for w in items_ for s in statements(ENT[w], "P608") for q in qual_items(s, "P276")}
    gather_places(sorted(places))
    facts(sorted({a for q in lesser | set(readable) for a in fact(q, "P50") + fact(q, "P1433")}))
    save_facts()
    OUT.mkdir(parents=True, exist_ok=True)
    report_matched, events_n, kinds = [], 0, Counter()
    for s in saves:
        if s["id"] not in matched:
            continue
        w, conf, how = matched[s["id"]]
        e = ENT[w]
        ev = events_for(e)
        artist = next((artists[a["id"]] for a in s.get("artists") or [] if (artists.get(a["id"]) or {}).get("qid")), None)
        how_full = f"Wikidata item {w} ({label(w)}): {how}"
        if artist:
            how_full += f"; artist {artist['qid']} by {artist['how']}"
        out = {"id": s["id"], "source": dict(SOURCE, url=PAGE.format(w)),
               "match": {"record": w, "how": how_full, "confidence": conf}, "events": ev}
        events_n += len(ev)
        kinds.update(x["kind"] for x in ev)
        report_matched.append({"id": s["id"], "title": s.get("title"), "date": s.get("date"),
                               "artists": [a.get("name") for a in s.get("artists") or []],
                               "partner": (s.get("partner") or {}).get("name"), "item": w, "item_label": label(w),
                               "confidence": conf, "how": how, "events": len(ev)})
        if not args.dry_run:
            (OUT / filename(s["id"])).write_text(json.dumps(out, ensure_ascii=False, indent=1))
    if not args.dry_run and not args.only:
        keep = {filename(i) for i in matched}
        for stale in OUT.glob("*.json"):
            if stale.name not in keep:
                stale.unlink()
    if args.only:
        for m in report_matched:
            print(f"  MATCH {m['id']} -> {m['item']} {m['item_label']!r} [{m['confidence']}] {m['how']}")
        for r in rejected:
            print(f"  DOUBT {r['id']} -> {r['item']} {r['item_label']!r}: {r['reason']}")
    else:
        REPORT.write_text(json.dumps({
            "matched": report_matched, "rejected": rejected,
            "artists": {k: dict(v, name=arts[k]["name"], birth=arts[k]["birth"], death=arts[k]["death"])
                        for k, v in sorted(artists.items())},
            "counts": {"saved": len(saves), "artists": len(arts),
                       "artists_found": sum(1 for a in artists.values() if a.get("qid")),
                       "matched": len(matched), "by_confidence": Counter(m[1] for m in matched.values()),
                       "rejected": len(rejected), "events": events_n, "by_kind": kinds}}, ensure_ascii=False, indent=1))
    print(f"{len(matched)} histories, {events_n} events: " + ", ".join(f"{k} {v}" for k, v in kinds.most_common()),
          flush=True)
    print("by confidence: " + ", ".join(f"{k} {v}" for k, v in Counter(m[1] for m in matched.values()).most_common()))


if __name__ == "__main__":
    main()

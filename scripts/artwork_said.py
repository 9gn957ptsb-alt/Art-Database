#!/usr/bin/env python3
"""What has been said about a saved work, in the words of whoever said it — for the art view's
"The artist's words" and "Said of it" (artist's request, 1 Oct 2026: "feature key points from
prominent writers on the works or even notes from the artists themselves … enabling viewers to do
research and find meaningful information they are not going to find elsewhere").

Every entry is a quotation: the source's own words, cut only at sentence ends, never paraphrased,
never joined from two places. Each names who said it and where it was published, as the text gives
it. Nothing about price, condition, framing, shipping or editions is ever kept.

Sources, read by build_artwork_histories.py:
  - Artsy's record of the work (private in data/histories/artsy/works/): the partner's
    "additional information" and Artsy's blurb. From these only (a) passages in quotation marks
    whose speaker the text names — the artist, or a named writer, critic or curator, with the
    citation the text gives — and (b) a sentence or two the partner wrote about this very work
    ("the present work", its title), credited to the partner. Never the record itself.
  - Museum label texts fetched by fetch_artwork_said.py into data/said/ (the Art
    Institute of Chicago's description, the Cleveland Museum of Art's wall text), credited to the
    museum, and the opening of the work's English Wikipedia article (CC BY-SA), credited to it.

Each entry, compact: {"k": "artist"|"writer"|"museum"|"note"|"wiki", "q": the words,
"by": who, "in": where it was published (as cited), "via": whose text quoted it}.

    python3 scripts/artwork_said.py [--sample N]    # prints what it finds, for checking
"""

import html
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "histories"
SAID = ROOT / "data" / "said"

# Words that mark a sentence as trade, not thought: never kept.
TRADE = re.compile(
    r"\b(price|priced|\$|€|£|usd|eur|gbp|vat|buyer'?s premium|estimate|condition|framed|frame|unframed|"
    r"shipping|ship|delivery|certificate|coa|authenticity|signed|numbered|edition of|ed\.|hand[- ]signed|"
    r"plate[- ]signed|inquire|enquire|contact us|please|available|purchase|invoice|crated|matted|mat\b|"
    r"glazed|plexi|acid[- ]free|archival|museum[- ]quality|excellent|mint|pristine|immaculate|nicest|"
    r"craftsmanship|measuring approximately|sheet size|image size|paper size|dimensions|inches|\bcm\b|"
    r"resale right|conditions of sale|lot\b|artsy specialist|we have ever|in person|retail|archivio|archive number|"
    r"registered|authenticated|authenticity|catalogued|stamped|verso|recto|reference|inventory|"
    r"high quality print|lithographie|sur papier|accompanied by|provenance|literature|exhibited:)\b", re.I)

# Speech verbs that name a speaker before or after a quotation.
SAYS = (r"(?:has\s+|had\s+|once\s+|later\s+|famously\s+|herself\s+|himself\s+)?"
        r"(?:said|says|stated|states|wrote|writes|remarked|remarks|recalled|recalls|explained|explains|"
        r"noted|notes|observed|observes|declared|declares|commented|comments|described|describes|"
        r"reflected|reflects|told|tells|put it|puts it|insisted|insists|added|adds|espoused|asserted|"
        r"asserts|argued|argues|wondered|confessed|claimed|claims|mused|suggested|suggests)")
NAME = r"((?:[A-Z][\w'’.-]+|de|van|von|der|da|di|du|le|la)(?: (?:[A-Z][\w'’.-]+|de|van|von|der|da|di|du|le|la)){0,4})"
NOT_PEOPLE = re.compile(r"\b(Museum|Gallery|Galerie|Galleria|Foundation|Fondation|Institute|Collection|"
                        r"Catalogue|Catalog|Christie|Sotheby|Phillips|Bonhams|Press|Times|Magazine|Review|"
                        r"University|Library|Center|Centre|Kunsthalle|Studio|Estate|Artforum|The|This|It|"
                        r"In|As|He|She|They|His|Her|Its|One|When|While|Here|There)\b")

QUOTES = re.compile(r"[“\"]([^”\"]{40,700}?)[”\"]")


def clean(text):
    """Markdown links to their words, emphasis marks gone, doubled quotes mended, spaces single."""
    t = html.unescape(text or "")
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"\*+", "", t)
    t = t.replace("''", "'").replace(" ", " ")
    t = re.sub(r"(?<=\w)_|_(?=\w)", "", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t


def flat(t):
    return re.sub(r"\s+", " ", t).strip()


def surnames(names):
    out = set()
    for n in names:
        n = re.sub(r"\s*\(.*?\)", "", n or "").strip()
        if not n:
            continue
        out.add(n.lower())
        parts = n.split()
        if parts:
            out.add(parts[-1].lower())
    return out


PARTICLE = {"de", "van", "von", "der", "den", "da", "di", "du", "le", "la", "del", "della", "y"}


def is_person(name):
    """Two to five words, each a capitalised name or a particle: "Robert Storr", "Willem de Kooning"."""
    if not name or NOT_PEOPLE.search(name) or re.search(r"\b(Ibid|Exh|Cat|Vol|No)\b|\d|[’']s$|[a-z]{2}\. [A-Z]", name):
        return False
    words = name.split()
    if not 2 <= len(words) <= 5:
        return False
    return all(w in PARTICLE or re.fullmatch(r"[A-Z][\w'’-]*\.?|[A-Z]\.(?:[A-Z]\.)?", w) for w in words) and \
        not all(w.isupper() for w in words if len(w) > 2)


def sentences(text):
    """Sentences, cut at a full stop, question or exclamation followed by a capital."""
    text = flat(text)
    out, start = [], 0
    for m in re.finditer(r"[.!?][”\"’)]?\s+(?=[“\"A-Z])", text):
        word = re.search(r"(\S+)$", text[start:m.start()])
        w = word.group(1) if word else ""
        # Not after an initial, an abbreviation or a page reference: "J. Smith", "p. 25", "Mr. ", "St. ".
        if re.fullmatch(r"(?:[A-Z]|[A-Z][a-z]{0,2}|p|pp|no|nos|vol|ed|eds|cat|exh|fig|ill|c|ca|cf|vs|etc|[A-Z]\.[A-Z])", w):
            continue
        out.append(text[start:m.end()].strip())
        start = m.end()
    out.append(text[start:].strip())
    return [p for p in out if p]


def speaker_of(text, m, artists):
    """Who the text says spoke the quotation at m, and the citation it gives: (name, citation) or None."""
    after = text[m.end():m.end() + 400]
    before = text[max(0, m.start() - 220):m.start()]
    # The citation in brackets after it: (Bruce Nauman, quoted in Christopher Cordes, …, p. 25), or
    # (Chris Burden: A Twenty-Year Survey, exh. cat., …) — a title, when a colon follows the name.
    who_cite, cite = None, ""
    pm = re.match(r"\s*[.,]?\s*\(([^()]{6,300}(?:\([^()]*\)[^()]*)*)\)", after)
    if pm:
        cite = flat(pm.group(1))
        nm = re.match(r"([A-Z][^,;:]{2,60}?)(,|\s+quoted\b|\s+in\s)", cite)
        if nm and is_person(nm.group(1).strip()) and not re.fullmatch(r"[\s,]*pp?\.\s*[\d-]+\.?", cite[nm.end(1):]):
            who_cite = nm.group(1).strip()
            cite_rest = cite[len(who_cite):].lstrip(" ,:")
    # As Robert Storr espoused …, "…"   /   Giacometti said: "…"   /   Erizku noted, "…"
    tail = before[-180:]
    bm = None
    for bm in re.finditer(NAME + r"(?:,[^,“\"]{0,80},)?\s+" + SAYS + r"\b[^“\".]{0,80}$", tail):
        pass
    if bm and is_person(bm.group(1)):
        return bm.group(1).strip(), cite if not who_cite else cite_rest if who_cite == bm.group(1).strip() else cite
    if who_cite:
        return who_cite, cite_rest
    if re.search(r"\b(the artist|the painter|the sculptor|the photographer)\s+" + SAYS + r"\b[^“\".]{0,80}$", tail, re.I):
        return "the artist", cite
    am = re.search(r"\b(?:he|she|He|She)\s+" + SAYS + r"\b[^“\".]{0,80}$", tail)
    if am and artists:
        # "he said" is the artist only when the words just before name the artist and nobody else.
        prior = tail[:am.start()][-200:]
        names = [n for n in re.findall(r"\b([A-Z][\w'’-]+)\b", prior) if n not in ("He", "She", "The", "In", "As")]
        arts = surnames(artists)
        if names and all(n.lower() in arts for n in names[-3:]):
            return "the artist", cite
    # "…" — Antony Gormley   /   "…" -Brice Marden
    dm = re.match(r"[ ]*[,.]?[ ]*[—–-]{1,2}[ ]*([A-Z][\w'’.-]+(?: [A-Z][\w'’.-]+){0,3})", after)
    if dm and is_person(dm.group(1)) and not re.match(r"Courtesy|Photo|Image|Source", dm.group(1)):
        return dm.group(1).strip(), ""
    # "…," Kapoor said.   /   "…," said Kapoor.
    sm = re.match(r"\s*,?\s*" + NAME + r"\s+" + SAYS + r"\b", after)
    if sm and is_person(sm.group(1)):
        return sm.group(1).strip(), ""
    sm = re.match(r"\s*,?\s*" + SAYS + r"\s+" + NAME + r"\b", after)
    if sm and is_person(sm.group(1)):
        return sm.group(1).strip(), ""
    return None


def words_ok(q):
    q = flat(q)
    if len(q.split()) < 8 or TRADE.search(q):
        return False
    letters = [c for c in q if c.isalpha()]
    if not letters or sum(1 for c in letters if c.isupper()) > 0.4 * len(letters):
        return False
    return True


def quotes_in(text, artists, via):
    """The quotations whose speaker the text names."""
    text = clean(text)
    out, seen = [], set()
    arts = surnames(artists)
    for m in QUOTES.finditer(text):
        q = flat(m.group(1)).strip(" ,")
        if not words_ok(q):
            continue
        sp = speaker_of(text, m, artists)
        if not sp:
            continue
        who, cite = sp
        who = re.sub(r"(?<=[a-z]{2})\.$", "", who.strip())
        low = who.lower()
        artist = low == "the artist" or low in arts or any(p in arts for p in low.split() if len(p) > 3)
        if artist:
            who = artists[0] if artists else who
        elif low in ("he", "she"):
            continue
        key = norm(q)[:80]
        if key in seen:
            continue
        seen.add(key)
        cite = re.sub(r"^quoted\s+in\s+", "quoted in ", cite.strip(" ,.;"))
        if TRADE.search(cite):
            cite = ""
        out.append({"k": "artist" if artist else "writer", "q": q.rstrip(" ,;:"), "by": who,
                    "in": cite[:220], "via": via})
    return out


def norm(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


ABOUT = re.compile(r"\b(the present work|the present painting|the present example|this work|this painting|"
                   r"this drawing|this print|this photograph|this sculpture|this piece|this canvas|"
                   r"the work|in this|here,)\b", re.I)


def note_in(text, title, via):
    """A sentence or two the partner wrote about this very work: one that names it, and the next."""
    text = clean(text)
    t = norm(title)
    ss = sentences(text)
    for i, s in enumerate(ss):
        names = t and len(t) > 3 and t not in ("untitled",) and t in norm(s)
        if not (names or ABOUT.search(s)):
            continue
        if not (60 <= len(s) <= 420) or TRADE.search(s) or "“" in s[:1] or '"' in s[:1]:
            continue
        if re.search(r"\b(is a|is an)\b.{0,40}\b(print|lithograph|poster|screenprint|etching)\b", s, re.I):
            continue
        s = re.sub(r"^From the Catalogue:?\s*", "", s, flags=re.I)
        if "|" in s or len(s.split()) < 12:
            continue
        q = s
        nxt = ss[i + 1] if i + 1 < len(ss) else ""
        if nxt and 40 <= len(nxt) <= 360 and not TRADE.search(nxt) and len(q) + len(nxt) < 520:
            q = q + " " + nxt
        if not words_ok(q):
            continue
        return {"k": "note", "q": q, "by": via, "in": "", "via": ""}
    return None


def generic(texts):
    """Texts a partner gives to many works (a series' standard paragraph) say nothing about this one."""
    count = {}
    for t in texts:
        k = norm(t)[:160]
        if k:
            count[k] = count.get(k, 0) + 1
    return {k for k, n in count.items() if n >= 3}


def from_artsy(w, common=frozenset()):
    """What the partner's own texts on Artsy hold: quotations with speakers, and its note on this work."""
    artists = [a.get("name") for a in w.get("artists") or [] if a.get("name")]
    partner = (w.get("partner") or {}).get("name") or ""
    via = (partner + ", on Artsy") if partner else "Artsy"
    out = []
    for field, by in (("additional_information", via), ("blurb", "Artsy")):
        t = w.get(field) or ""
        if not t.strip() or norm(clean(t))[:160] in common:
            continue
        out.extend(quotes_in(t, artists, by))
    note = None
    t = w.get("additional_information") or ""
    if t.strip() and norm(clean(t))[:160] not in common:
        note = note_in(t, w.get("title") or "", via)
    if note and not any(note["q"].find(x["q"][:40]) >= 0 for x in out):
        out.append(note)
    return out


def from_fetched(slug):
    """The museum labels and Wikipedia's opening, fetched by fetch_artwork_said.py."""
    from fetch_artwork_histories import filename
    p = SAID / filename(slug)
    if not p.exists():
        return []
    rec = json.loads(p.read_text())
    out = []
    for e in rec.get("said") or []:
        q = flat(e.get("q") or "")
        if q and not TRADE.search(q) or e.get("k") == "museum":
            out.append({"k": e["k"], "q": q, "by": e.get("by", ""), "in": e.get("in", ""), "via": ""})
    return [e for e in out if e["q"]]


ORDER = {"artist": 0, "writer": 1, "museum": 2, "note": 3, "wiki": 4}


def said_of(w, common=frozenset()):
    out = from_artsy(w, common) + from_fetched(w["id"])
    out.sort(key=lambda e: ORDER[e["k"]])
    for e in out:
        for k in ("in", "via"):
            if not e.get(k):
                e.pop(k, None)
    return out[:8]


def main():
    import random
    files = sorted((DATA / "artsy" / "works").glob("*.json"))
    works = [json.loads(f.read_text()) for f in files]
    common = generic([w.get("additional_information") or "" for w in works] + [w.get("blurb") or "" for w in works])
    n = {"artist": 0, "writer": 0, "museum": 0, "note": 0, "wiki": 0}
    hit = []
    for w in works:
        s = said_of(w, common)
        for k in {e["k"] for e in s}:
            n[k] += 1
        if s:
            hit.append((w["id"], s))
    print(len(works), "works;", len(hit), "with something said;", n)
    sample = int(sys.argv[sys.argv.index("--sample") + 1]) if "--sample" in sys.argv else 0
    random.seed(7)
    for wid, s in random.sample(hit, min(sample, len(hit))):
        print("\n==", wid)
        for e in s:
            print(" ", e["k"], "|", e["by"], "|", e.get("in", ""), "|", e["q"][:300])


if __name__ == "__main__":
    main()

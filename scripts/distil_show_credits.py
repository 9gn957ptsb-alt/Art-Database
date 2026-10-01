#!/usr/bin/env python3
"""Who curated the shows the saved works were in, in the shows' own published words.

For the voices (build_voices.py): Artsy's record of each show a saved work was in carries the
gallery's or museum's press release, and many name the curator — "Isa Genzken: Mach Dich hübsch! is
curated by Beatrix Ruf and Martijn van Nieuwenhuyzen." Those credits are public (the press release
is), but the record they are read from is the private dump in data/, so this script distils only the
credit: the show, the curators' names and the one sentence that names them, and the saved works that
were in it. Writes docs/v2/voices/credits.json, which build_voices.py reads with the public histories.

Careful, never generous: a sentence counts only when it is about this show (it names the show, or
says "the exhibition", "this show" …, or opens "Curated by"), not when it lists the artist's past
shows ("Pittura italiana oggi, curated by …, Triennale Milano (2023)"), names another exhibition, or
speaks in the past ("was curated by"). A name is two to five words in capitals; a museum, a gallery,
a fair or "the gallery staff" is not a curator. Same bytes every run.

    python3 scripts/distil_show_credits.py
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "histories" / "artsy"
OUT = ROOT / "docs" / "v2" / "voices" / "credits.json"

PARTICLE = r"(?:van|von|de|der|den|la|le|di|da|del|della|dos|du|ten|ter)"
TOKEN = r"(?:[A-ZÀ-ÖØ-Þ][\w'’\-]*\.?|" + PARTICLE + r")"
NAME = r"([A-ZÀ-ÖØ-Þ][\w'’\-]*\.?(?:[  ]+" + TOKEN + r"){1,4})"
# What may stand between "curated by" and the name: "the independent art historian Dr", "famed …".
LEAD = (r"(?:(?:the|our|independent|renowned|famed|guest|veteran|art|historian|curator|critic|expert|writer|"
        r"novelist|artist|scholar|professor|Professor|Prof\.?|Dr\.?|director|of|Surrealism|from|America|"
        r"Brâncuși|Irish|two|artists;?|[A-Z][a-zé]+ese),?\s+)*")
NOT_A_PERSON = re.compile(
    r"\b(gallery|galerie|galleria|museum|museo|musée|foundation|fondazione|fondation|collection|center|centre|"
    r"institute|council|fair|studio|staff|team|committee|program|programme|society|association|university|"
    r"library|kunsthalle|biennale|biennial|arts?|moca|dam|inc|ltd|llc|projects?|advisory|heritage|"
    r"department|school|academy|trust|unit|archive|archivio)\b", re.I)
# Before "curated by": another show being spoken of. ("Carl Andre … as well as in the exhibition When
# Attitudes Become Form …, curated by Germano Celant": Celant did not curate the Carl Andre show.)
OTHER_SHOW = re.compile(r"\b(previously|past|earlier|recent exhibitions|among (his|her|their) |as well as|"
                        r"also|other exhibitions|an exhibition of|film series|reading list|biennal|biennale|"
                        r"exhibitions? [\"“'(])", re.I)
PAST = re.compile(r"\b(was|were|had been) (co-|guest )?curated by", re.I)
THIS_SHOW = re.compile(r"\b(the|this|our|her|his|their) (exhibition|show|retrospective|presentation|project|"
                       r"solo show|group show|solo exhibition|group exhibition)\b", re.I)


def fold(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def sentences(text):
    text = re.sub(r"[ \t ]+", " ", text.replace("\r", ""))
    out = []
    for para in re.split(r"\n+|•|•", text):
        # Split at a sentence's end, but not after an initial or a title ("Dr.", "F.").
        out += re.split(r"(?<!\b[A-Z]\.)(?<!\bDr\.)(?<!\bSt\.)(?<!\bMr\.)(?<!\bMs\.)(?<!\bMrs\.)(?<=[.!?])\s+(?=[A-Z“\"])", para)
    return [s.strip().strip("-–—").strip() for s in out if s.strip()]


def is_person(name):
    toks = name.split()
    if not 2 <= len(toks) <= 5 or NOT_A_PERSON.search(name):
        return False
    if any(t.isupper() and len(t) > 2 for t in toks):        # INTHEGALLERY, MOCA
        return False
    if not re.match(r"[A-ZÀ-ÖØ-Þ]", toks[-1]) or toks[-1].endswith("."):
        return False
    return True


def tidy(name):
    name = re.sub(r"(?<=\w)- (?=[A-Z])", "-", name)          # "Cecilia Fajardo- Hill"
    name = re.sub(r"^(Dr|Prof|Professor)\.?\s+", "", name.strip())
    name = re.sub(r"\s+(himself|herself|themselves)$", "", name)
    return re.sub(r"[\s.,;:]+$", "", name)


def curators_in(sentence):
    """The names the sentence gives after "curated by", in order."""
    m = re.search(r"\b[Cc]urated by\s+", sentence)
    if not m:
        return []
    rest = sentence[m.end():]
    names = []
    while True:
        lm = re.match(LEAD + NAME, rest)
        if not lm:
            break
        n = tidy(lm.group(1))
        # "Gwen F. Chanzit" and "Sjraar van Heugten" are names; "Connie Butler, chief curator" stops at the comma.
        if is_person(n):
            names.append(n)
        rest = rest[lm.end():]
        # An apposition (", chief curator, with"), then the next name after "and", "&" or "with".
        ap = re.match(r"(?:,\s*[^,;]{0,90}?)?,?\s*(?:and|&|with)\s+", rest)
        if not ap:
            break
        rest = rest[ap.end():]
    return names


def about_this_show(sentence, show):
    if len(re.findall(r"[Cc]urated by", sentence)) != 1 or PAST.search(sentence):
        return False
    if OTHER_SHOW.search(sentence[:re.search(r"[Cc]urated by", sentence).start()]):
        return False
    if re.search(r"\((19|20)\d\d\)", sentence):
        return False
    head = fold(show.get("name"))
    words = [w for w in head.split() if len(w) > 2][:3]
    if words and all(w in fold(sentence) for w in words):
        return True
    if re.match(r"(?:(?:Exhibition|Co-|Guest|The exhibition is)\s*)?[Cc]urated by", sentence):
        return True
    if re.search(r"\b(is|are|will be) (co-|guest )?curated by", sentence):
        return True
    return bool(THIS_SHOW.search(sentence))


def main():
    works_of = {}
    for f in sorted((DATA / "works").glob("*.json")):
        w = json.loads(f.read_text())
        for sid in w.get("show_ids") or []:
            works_of.setdefault(sid, []).append(w["_id"])
    out = []
    for f in sorted((DATA / "shows").glob("*.json")):
        s = json.loads(f.read_text())
        if not works_of.get(s.get("id")):
            continue
        text = "\n".join(t for t in (s.get("press_release"), s.get("description")) if t)
        found, said = [], ""
        for sent in sentences(text):
            if not about_this_show(sent, s):
                continue
            names = [n for n in curators_in(sent) if n not in found]
            if names:
                found += names
                said = said or sent
        if not found:
            continue
        loc = s.get("place") or s.get("location") or {}
        out.append({"show": s["name"].strip(), "at": (s.get("partner") or {}).get("name", ""),
                    "city": (loc.get("city") or "").strip(), "y": (s.get("start_at") or "")[:4],
                    "by": found, "q": said[:400], "works": sorted(set(works_of[s["id"]]))})
    out.sort(key=lambda r: (r["y"], fold(r["show"]), r["works"][0]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    note = ("Curators of the shows the saved works were in, as the shows' own press releases on Artsy credit "
            "them: the names and the sentence that gives them. Written by scripts/distil_show_credits.py.")
    OUT.write_text(json.dumps({"note": note, "shows": out}, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(out)} shows credit {len({n for r in out for n in r['by']})} curators")
    for r in out:
        print(" ", r["y"], r["show"][:40], "|", "; ".join(r["by"]), "|", len(r["works"]))


if __name__ == "__main__":
    main()

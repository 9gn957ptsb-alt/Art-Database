#!/usr/bin/env python3
"""The Philosophers layer: notable philosophers at their birthplaces, each a character of their place.

The artist, 15 Oct 2026: "Add Character as a category filter and Philosophers category as well.
Introduce notable philosophers as character relative to their native country or city."

Reads data/philosophers/ (Wikidata, fetched by fetch_philosophers.py), scripts/philosophers_hand.json,
DIRT Earth's atlas and grammar (dirt/earth/out/: the soil and the plants at each birthplace) and
docs/v2/cities.json; writes docs/v2/philosophers.json, the same bytes every run:

  {"note": ..., "people": [[q, name, short, born, died, place, lat, lon, desc, n, town, look, said, soil, plants], ...]}

  q, name   the Wikidata item and its name
  short     the name the globe writes (a surname, or the name they go by)
  born      the year of birth (astronomical: 0 is 1 BCE, -383 is 384 BCE); died, the same, or null
  place     the birthplace as Wikidata names it, at lat, lon
  desc      Wikidata's English description (CC0)
  n         the Wikipedia articles about them (sitelinks): how notable, for the naming
  town      the Museums layer's city within 40 km of the birthplace (cities.json key), else ""
  look      how the figure is drawn (philosophers.js): {d: dress, h: hair, b: beard, hd: headwear,
            e: emblem, g: glasses, bare, sk: skin, hc: hair colour, c1: cloth, c2: second cloth}
  said      the emblem's sentence, its source in it ("" with no emblem)
  soil      DIRT's soil at the birthplace, its name and colour [name, "#rrggbb"]: the ground the figure
            stands on, and a third of its cloth's colour — so each is made of where it was born
  plants    two of the plants DIRT's grammar gives the birthplace's biome there

How each is dressed is a rule of the time and place of their birth (DRESS below: a chiton in Greece
before 400, a toga in Rome, a hanfu with a scholar's cap in China, a robe and turban in the medieval
Islamic world, a habit for a monk, a doublet in the Renaissance, a periwig and a long coat in the
seventeenth century, a powdered wig in the eighteenth, a frock coat in the nineteenth, a suit in the
twentieth), over which the hand table gives the best known their emblem and what their portraits show.
A living philosopher is drawn only in their time's dress, never with a look of their own.

    python3 scripts/build_philosophers.py
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from build_characters import Atlas, EARTH  # noqa: E402

DATA = ROOT / "data" / "philosophers"
HAND = ROOT / "scripts" / "philosophers_hand.json"
SITE = ROOT / "docs" / "v2"
OUT = SITE / "philosophers.json"
NOW = 2026
TOWN_KM = 40

NOTE = ("The Philosophers layer (land.js; philosophers.js draws them): notable philosophers (Wikidata, CC0: "
        "occupation philosopher, described as one, 70 Wikipedia articles or more) at their birthplaces, each a "
        "figure dressed by the rule of the time and place of their birth, a third of its cloth and the ground it "
        "stands on the DIRT soil of its birthplace, the best known with an emblem of their own life or work "
        "(scripts/philosophers_hand.json, each with its source). Rows [q, name, short, born, died, place, lat, lon, "
        "desc, n, town, look, said, soil, plants]. Written by scripts/build_philosophers.py.")

# The name the globe writes, where the last word of the name would be wrong.
SHORT = {
    "Q9441": "The Buddha", "Q47739": "Zhuangzi", "Q9397": "Zhu Xi", "Q46420": "Ibn Arabi", "Q127398": "Maimonides",
    "Q183074": "Sor Juana", "Q182128": "Pico", "Q189564": "Teilhard", "Q153020": "Ortega y Gasset",
    "Q314975": "La Bruyère", "Q309854": "de Maistre", "Q193344": "Musashi", "Q132157": "Zeno of Elea",
    "Q171303": "Zeno of Citium", "Q154751": "Nicholas of Cusa", "Q123867": "Sade", "Q201477": "Condorcet",
    "Q190089": "Duns Scotus", "Q4604": "Confucius", "Q9333": "Laozi", "Q232505": "Enheduanna",
    "Q160460": "al-Farabi", "Q179759": "al-Kindi", "Q169234": "al-Razi", "Q8011": "Avicenna", "Q39837": "Averroes",
    # Where a surname alone is another thing on a globe (a city, a god) or another philosopher's.
    "Q1067": "Dante", "Q1430": "Marcus Aurelius", "Q37388": "Francis Bacon", "Q171677": "Roger Bacon",
    "Q9381": "Adam Smith", "Q125249": "William James", "Q42544": "Thomas More", "Q205162": "Isaiah Berlin",
    "Q235451": "Vandana Shiva", "Q296047": "Sam Harris", "Q76749": "Edith Stein", "Q157309": "Simone Weil",
    "Q132524": "Ayn Rand", "Q43977": "Jan Hus", "Q132489": "Amartya Sen",
}

SKIN = {"europe": "#e6c4a6", "med": "#d4a983", "northafrica": "#c39570", "westasia": "#c4976e",
        "southasia": "#9a6844", "eastasia": "#e1bf98", "americas": "#e6c4a6", "other": "#c39570"}


def region(lat, lon):
    if 95 <= lon <= 150 and 15 <= lat <= 50:
        return "eastasia"
    if 60 <= lon < 95 and 5 <= lat <= 37:
        return "southasia"
    if 35 <= lon < 75 and 22 <= lat <= 46 or (43 <= lon < 60 and 30 <= lat < 46):
        return "westasia"
    if -18 <= lon <= 35 and 10 <= lat < 37.3:
        return "northafrica"
    if -10 <= lon <= 45 and 34 <= lat < 45.6:
        return "med"
    if -30 <= lon <= 60 and lat >= 45.6:
        return "europe"
    if lon < -30:
        return "americas"
    return "other"


def mix(a, b, k):
    a = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join("%02x" % round(a[i] + (b[i] - a[i]) * k) for i in range(3))


# What each dress is made of before the soil: [cloth, second cloth].
DYES = {
    "tunic": ["#e4dccb", "#3a5a8a"], "chiton": ["#ddd2bf", "#8a6a4a"], "toga": ["#ece4d4", "#8a5a3a"],
    "hanfu": ["#4a5a6a", "#c8a86a"], "kimono": ["#2a2420", "#5a4a3a"], "kesa": ["#c47a2a", "#c47a2a"],
    "robe": ["#ece6da", "#8a7a64"], "thobe": ["#e8dcc6", "#5a4a3a"], "gown": ["#3a2c22", "#3a2c22"],
    "habit": ["#6e5440", "#6e5440"], "doublet": ["#2a2420", "#ece6da"], "justaucorps": ["#4a3a2a", "#ece6da"],
    "frock18": ["#5a4a62", "#ece6da"], "frock": ["#2a2622", "#ece6da"], "suit": ["#3a3836", "#ece6da"],
    "dress": ["#3a3040", "#ece6da"], "jacket": ["#4a4a52", "#d8d0c4"], "sari": ["#9a2a3a", "#d4a03a"],
    "caftan": ["#7a5a3a", "#3a2c22"], "coat": ["#8a7a5a", "#3a3836"], "turtleneck": ["#ece6da", "#3a3836"],
}


def dress(born, reg, female, lat, lon):
    """The rule: what someone born then and there is drawn wearing, and their hair, beard and head."""
    y = born
    if y < -1200:
        return {"d": "tunic", "h": "long", "b": "none" if female else "full"}
    if reg == "eastasia":
        if lon > 128.5:   # Japan
            return {"d": "kimono", "h": "topknot", "b": "none"} if y < 1850 else {"d": "suit", "h": "short", "b": "none"}
        if y < 1880:
            return {"d": "hanfu", "h": "topknot", "b": "long", "hd": "guan"}
        return {"d": "dress" if female else "suit", "h": "short", "b": "none"}
    if reg == "southasia":
        if y < 1800:
            return {"d": "kesa", "h": "short", "b": "none", "bare": True}
        if female:
            return {"d": "sari", "h": "bun", "b": "none"}
        return {"d": "robe", "h": "short", "b": "short"} if y < 1890 else {"d": "suit", "h": "short", "b": "none"}
    if y < 450 and reg in ("med", "northafrica", "westasia", "other"):
        roman = (36 <= lat <= 47 and 6 <= lon <= 19 and y > -300) or (36 <= lat <= 43.5 and -10 <= lon <= 3.5 and y > -200)
        if female:
            return {"d": "chiton", "h": "bun", "b": "none"}
        if roman:
            return {"d": "toga", "h": "short", "b": "short" if y > 76 else "none"}
        return {"d": "chiton", "h": "curly", "b": "full"}
    andalus = 36 <= lat <= 41 and -9.5 <= lon <= 1 and 711 <= y < 1492
    if 600 <= y < 1500 and (reg in ("westasia", "northafrica") or andalus):
        return {"d": "thobe", "h": "short", "b": "full", "hd": "turban"}
    if y < 600:
        return {"d": "chiton", "h": "short", "b": "full"}
    if y < 1450:
        return {"d": "gown", "h": "short", "b": "none", "hd": "cap"}
    if female and y < 1880:
        return {"d": "dress", "h": "bun", "b": "none"}
    if y < 1500:
        return {"d": "gown", "h": "long", "b": "none", "hd": "cap"}
    if y < 1600:
        return {"d": "doublet", "h": "short", "b": "short", "hd": "cap"}
    if y < 1680:
        return {"d": "justaucorps", "h": "wig" if y >= 1640 else "long", "b": "moustache" if y < 1640 else "none"}
    if y < 1770:
        return {"d": "frock18", "h": "wig", "b": "none"}
    if y < 1830:
        return {"d": "frock", "h": "short", "b": "none"}
    if y < 1875:
        return {"d": "frock", "h": "short", "b": "short"}
    if y < 1940:
        return {"d": "dress" if female else "suit", "h": "bun" if female and y < 1900 else "short", "b": "none"}
    return {"d": "dress" if female else "jacket", "h": "short", "b": "none"}


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def year(v):
    if not v:
        return None
    s = v["value"]
    neg = s.startswith("-")
    y = int(s[1:].split("-", 1)[0]) if neg else int(s.split("-", 1)[0])
    return -y if neg else y


def main():
    base = json.loads((DATA / "base.json").read_text(encoding="utf-8"))["results"]["bindings"]
    det = json.loads((DATA / "details.json").read_text(encoding="utf-8"))
    labels = json.loads((DATA / "labels.json").read_text(encoding="utf-8")) if (DATA / "labels.json").exists() else {}
    hand = json.loads(HAND.read_text(encoding="utf-8"))["people"]
    towns = json.loads((SITE / "cities.json").read_text(encoding="utf-8"))["towns"]
    grammar = json.loads((EARTH / "grammar.json").read_text(encoding="utf-8"))
    atlas = Atlas()

    def qid(r, k):
        return r[k]["value"].rsplit("/", 1)[1]

    def lab(r, k, idk):
        v = (r.get(k) or {}).get("value", "")
        q = qid(r, idk)
        return labels.get(q, v) if v == q else v

    female = {}
    for r in det:
        if "g" in r:
            female[qid(r, "p")] = female.get(qid(r, "p"), False) or r["gLabel"]["value"] == "female"

    # One row a philosopher: the first birthplace the query gives (sorted, so the same every run), the
    # most precise birth year.
    rows = {}
    for r in sorted(base, key=lambda r: (qid(r, "p"), qid(r, "bp"), (r.get("born") or {}).get("value", ""))):
        q = qid(r, "p")
        if q in rows:
            continue
        pt = r["coord"]["value"].replace("Point(", "").replace(")", "").split()
        rows[q] = {"q": q, "name": lab(r, "pLabel", "p"), "desc": r["desc"]["value"], "n": int(r["n"]["value"]),
                   "born": year(r.get("born")), "died": year(r.get("died")), "place": lab(r, "bpLabel", "bp"),
                   "lat": round(float(pt[1]), 4), "lon": round(float(pt[0]), 4)}
    people = []
    plant_cache = {}
    for q, p in rows.items():
        if p["born"] is None:
            continue
        living = p["died"] is None and p["born"] > NOW - 110
        reg = region(p["lat"], p["lon"])
        look = dress(p["born"], reg, female.get(q, False), p["lat"], p["lon"])
        h = {} if living else dict(hand.get(q, {}))
        for k_from, k_to in (("dress", "d"), ("hair", "h"), ("beard", "b"), ("head", "hd"), ("emblem", "e"),
                             ("glasses", "g"), ("bare", "bare"), ("skin", "sk"), ("hairc", "hc"), ("cloth", "c1"),
                             ("cloth2", "c2")):
            if k_from in h:
                look[k_to] = h[k_from]
        here = atlas.at(p["lat"], p["lon"])
        soil = list(here["soil"]) if here else ["", "#8a7660"]
        dkey = look["d"]
        dyes = DYES.get(dkey, DYES["frock"])
        look.setdefault("c1", mix(dyes[0], soil[1], 0.33))
        look.setdefault("c2", dyes[1])
        look.setdefault("sk", SKIN[reg])
        look.setdefault("hc", "#1e1a18" if reg in ("eastasia", "southasia") else "#3a2c22")
        if dkey == "frock18":
            look["d"] = "frock"
        plants = []
        if here and str(here["biome"]) in grammar["biomes"]:
            key = (here["biome"], here["realm"])
            if key not in plant_cache:
                names = []
                for s in grammar["biomes"][str(here["biome"])].get("strata", []):
                    for nme in (s["plants"].get(here["realm"]) or s["plants"].get("*") or [])[:1]:
                        if nme not in names:
                            names.append(nme)
                plant_cache[key] = names[:2]
            plants = plant_cache[key]
        town = ""
        best = TOWN_KM
        for t in towns:
            d = km((p["lat"], p["lon"]), (t[3], t[4]))
            if d <= best:
                best, town = d, t[0]
        name = p["name"]
        short = SHORT.get(q)
        if not short:
            short = name.split(" of ")[0] if " of " in name else name.split(" ")[-1]
        people.append([q, name, short, p["born"], p["died"], p["place"], p["lat"], p["lon"], p["desc"], p["n"],
                       town, look, h.get("said", "") if not living else "", soil, plants])
    people.sort(key=lambda r: (-r[9], r[1]))
    OUT.write_text(json.dumps({"note": NOTE, "people": people}, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size // 1024} KB  {len(people)} philosophers, "
          f"{sum(1 for r in people if r[12])} with an emblem, {sum(1 for r in people if r[10])} born in a city of the globe")


if __name__ == "__main__":
    main()

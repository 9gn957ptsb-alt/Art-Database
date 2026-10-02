#!/usr/bin/env python3
"""The lives — docs/v2/lives.json and docs/v2/lives/<artist>.json.

The artist, 2 Oct 2026, on "Picasso's 1895–1973 route through his studios is a life drawn on a map.
Played beside the hunts, Bloch's catalogue of his prints and the studios where each print was pulled
would meet, the catalogue and the workshop on the same map": "Implement your idea for Picasso. Find
other similar instances for notable artists alike so that viewers can focus on lives of artists".

A life is one time-ordered sequence joining what the site already knows of an artist:

  born, died  Wikidata (CC0; P19/P569, P20/P570, the places' P625), read by fetch_lives.py.
  places      where the record puts the artist, year by year, from four kinds of evidence, each
              kept with its source:
                range   a dated place of the studios (studios.json: Wikidata's start/end
                        qualifiers, or the studios' hand table) or of this script's hand table
                        (scripts/lives_hand.json), each with its sources;
                said    a whole sentence of the artist's English Wikipedia article (CC BY-SA) that
                        names a year and a town with a verb of being there ("moved to Paris",
                        "settled in Nice", "a studio in Vallauris") — quoted, linked;
                record  a saved work's own history placing its making in a town in a year (never a
                        printer's, publisher's or edition's place: those are the workshops);
                born / died.
              Each year of the life takes the strongest evidence for it (range > said > record), and
              a year with none is carried from the last place named before it — said as such
              ("carried: the last place the record names"). Runs of one town are the periods.
  works       each saved work by the artist (finding.json), placed in the period of its year — how:
              'record' (its history says it was made in that town), 'site' (Painted here,
              sites.json), else 'dated' ("dated within these years"); with its printer or workshop
              where its record names one ("printed by Mourlot, Paris") and its catalogue numbers
              (its hunt's number, and the record's citations such as "Bloch 145", "Baer 2").
              A work dated after the death is the afterlife's (a posthumous edition).
  workshops   the printers and potteries the records name, with their towns and years.
  sites       Painted here (sites.json) for the artist: outings from the period of their year.
  voices      who wrote on the artist's works, at the year they wrote (voices/<id>.json).
  shows       shows a saved work was in during the life (the histories' exhibited events).
  after       the works' journeys after the death: events by year and city.
  hunts       the cataloguers' hunts of the artist (explorations.json).
  cross       lives that cross: both lives place the two artists in the same city in the same
              years by evidence (never by a carried year) — "Picasso and Matisse in Paris, 1906".

Which lives: every artist of the studios with ten saved works or more, or a hunt, whose evidence
places them in three dated towns or more. Public inputs (docs/v2/) and the Wikidata and Wikipedia
caches in data/lives/ and data/studios/ (public sources, cached; never the Artsy dump). Same bytes
every run. No network.

    python3 scripts/build_lives.py
"""
import collections, glob, json, math, os, re, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_studios import REGION  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'docs', 'v2')
DL = os.path.join(ROOT, 'data', 'lives')
DS = os.path.join(ROOT, 'data', 'studios')
HAND = os.path.join(ROOT, 'scripts', 'lives_hand.json')
OUT = os.path.join(V2, 'lives.json')
OUTD = os.path.join(V2, 'lives')
NOW = 2026

NOTE = ("The lives (docs/v2/lives.js): each artist's life as one sequence of places in time — born and died from "
        "Wikidata (CC0); the places year by year from the studios' dated places (studios.json), whole sentences of "
        "the artist's English Wikipedia article (CC BY-SA, quoted and linked), the saved works' own records of where "
        "they were made, and a hand table with its sources (scripts/lives_hand.json); a year with no evidence is "
        "carried from the last place named, and said so. The saved works are placed in the period of their year, with "
        "the printer or workshop their records name and their catalogue numbers; Painted here's sites, the voices who "
        "wrote on the works, the shows during the life and the works' journeys after it. Lives cross only where both "
        "place their artists in one city in the same years by evidence. Written by scripts/build_lives.py.")


def load(path, default=None):
    if not os.path.exists(path):
        return default
    return json.load(open(path))


def fold(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()


def point(v):
    m = re.match(r'Point\(([-\d.eE]+) ([-\d.eE]+)\)', v or '')
    return [round(float(m.group(2)), 5), round(float(m.group(1)), 5)] if m else None


def dist(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def year_of(v):
    m = re.search(r'(?<!\d)(1\d{3}|20[0-2]\d)(?!\d)', str(v or ''))
    return int(m.group(1)) if m else None


def surname(name):
    w = name.split()
    k = len(w) - 1
    while k > 0 and w[k - 1].lower() in ('de', 'van', 'von', 'da', 'di', 'del', 'der', 'le', 'la'):
        k -= 1
    return ' '.join(w[k:])


def sentences(text):
    text = re.sub(r'\n+=+[^=\n]+=+\n*', '\n', text or '')
    out = []
    for para in text.split('\n'):
        out += [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z“"(])', para) if s.strip()]
    return out


# ---- the gazetteer: towns a sentence may name ---------------------------------------------------

# Names that are words or people far more often than the town in an artist's article.
NOT_TOWNS = {'Orange', 'Reading', 'Bath', 'Mobile', 'Victoria', 'Lincoln', 'Florence Nightingale', 'Of', 'Van',
             'Union', 'Independence', 'Concord', 'Paradise', 'Hope', 'Normal', 'Bristol Channel', 'Sale', 'Wells',
             'Eye', 'Ware', 'Deal', 'March', 'Rye', 'Street', 'Wick', 'Holt', 'Banner', 'Ely', 'Gap', 'Vence?',
             'Hollywood', 'Midway', 'Paris Salon', 'Salon', 'Barbizon school', 'Stuart', 'Wilson', 'Clinton',
             'Jackson', 'Franklin', 'Marion', 'Warren', 'Lewis', 'Murray', 'Lawrence', 'Charles', 'Pollock',
             'Moore', 'Morris', 'Douglas', 'Henry', 'Jasper', 'Marfa?', 'Alexandria?', 'Mons?', 'Vienne?'}


def gazetteer(towns, places_cache):
    """name -> [lat, lon]; the cities of the site, and every place an artist's Wikidata item names."""
    g = {}
    for t in towns:
        g.setdefault(t[1], [t[3], t[4]])
    region = {}
    for p in places_cache or []:
        cls = (p.get('clsLabel') or '').lower()
        region.setdefault(p.get('label'), []).append(cls)
    for p in places_cache or []:
        ll = point(p.get('coord'))
        lab = p.get('label') or ''
        # A town, never a country or a region (the studios' list of what is a region).
        if any(c in REGION or 'country' in c or 'state' in c or 'region' in c or 'province' in c for c in region.get(lab, [])):
            continue
        if ll and lab and not re.match(r'^Q\d+$', lab):
            g.setdefault(lab, ll)
    return {k: v for k, v in g.items() if k not in NOT_TOWNS and len(k) >= 3 and k[0].isupper()}


def nearest_town(ll, towns, within=150):
    best, bd = None, 1e9
    for t in towns:
        d = dist(ll, (t[3], t[4]))
        if d < bd:
            best, bd = t, d
    return (best[0], round(bd, 1)) if best and bd <= within else (None, None)


# ---- what a Wikipedia sentence says ---------------------------------------------------------------

MOVE = (r"(?:moved|relocated|returned|went|travell?ed|journeyed|emigrated|fled|arrived|came|retired|withdrew|"
        r"left for|settled|set up (?:a |his |her )?(?:studio|home|house)|took (?:a |up a )?(?:studio|house|flat|apartment)|"
        r"bought (?:a |the )?(?:house|villa|château|chateau|farmhouse|property|estate)|rented (?:a |an )?\w+)")
STAY = (r"(?:lived|living|stayed|staying|resided|residing|settled|studied|studying|spent (?:[^.,;]{0,40}?)|"
        r"(?:his|her|a|the) (?:new )?studio|studios?|worked|working|painted|painting)")
PREP_MOVE = r"\s+(?:back\s+)?(?:to|in|at|into)\s+(?:the\s+)?(?:city\s+of\s+|town\s+of\s+|village\s+of\s+)?"
PREP_STAY = r"(?:\s+[^.;,]{0,30}?)?\s+(?:in|at|near)\s+(?:the\s+)?(?:city\s+of\s+|town\s+of\s+|village\s+of\s+)?"


def said_presences(name, text, url, title, gaz, born, died, others):
    """Every (year, [to], town, sentence) a sentence of the article gives for the artist."""
    if not text:
        return []
    names = sorted(gaz, key=lambda n: (-len(n), n))
    alt = '|'.join(re.escape(n) for n in names)
    rx = re.compile(r'(?:(' + MOVE + r')' + PREP_MOVE + r'|(' + STAY + r')' + PREP_STAY + r')(' + alt + r')(?![\w-])')
    me = surname(name)
    first = name.split()[0]
    out = []
    hi = died or NOW
    for s in sentences(text):
        if len(s) > 600:
            continue
        yrs = [(m.start(), int(m.group(1))) for m in re.finditer(r'(?<![\d,.])(1\d{3}|20[0-2]\d)(?!\d|,\d)(?!\s*(?:km|m|works|paintings))', s)]
        yrs = [(p, y) for p, y in yrs if (born or 0) - 1 <= y <= hi]
        if not yrs:
            continue
        for m in rx.finditer(s):
            town = m.group(3)
            pre = s[:m.start()]
            # Someone else's move, not the artist's: another artist named before the verb, and not the artist.
            other = [o for o in others if o != me and re.search(r'\b' + re.escape(o) + r'\b', pre)]
            mine = re.search(r'\b(' + re.escape(me) + r'|' + re.escape(first) + r'|[Hh]e|[Ss]he|[Tt]hey|[Hh]is|[Hh]er|family|couple)\b', pre)
            if other and not mine:
                continue
            if re.search(r'\b(exhibit\w*|show\w*|retrospective|biennale?|museum|gallery|sold|auction)\b', s[m.start():m.end()], re.I):
                continue
            # The year nearest the words, before them first.
            before = [(abs(m.start() - p), y) for p, y in yrs if p <= m.end()]
            after = [(p - m.end(), y) for p, y in yrs if p > m.end()]
            pick = min(before)[1] if before else min(after)[1]
            y1 = None
            r = re.search(r'(?<!\d)' + str(pick) + r'\s*(?:–|-|—|to|until|and)\s*(1\d{3}|20[0-2]\d)(?!\d)', s)
            if r and pick < int(r.group(1)) <= hi and int(r.group(1)) - pick <= 40:
                y1 = int(r.group(1))
            verb = (m.group(1) or m.group(2) or '').split()[0].lower()
            out.append({'y0': pick, 'y1': y1 or pick, 'place': town, 'll': gaz[town], 'verb': verb,
                        'src': {'name': 'Wikipedia · ' + title, 'url': url, 'q': s}})
    # One sentence, one town, one presence.
    seen, uniq = set(), []
    for p in out:
        k = (p['place'], p['y0'], p['src']['q'])
        if k not in seen:
            seen.add(k)
            uniq.append(p)
    return uniq


# ---- the works' records -------------------------------------------------------------------------

PRINTERISH = re.compile(r'\b(print(?:ed|er|ing)?|pulled|lithograph(?:ed)? by|atelier|imprimerie|workshop|press|'
                        r'pottery|foundry|cast by|fondeur|edition of \d+ produced)\b', re.I)
PUBLISHERISH = re.compile(r'\b(publish\w*|co-publish\w*|editeur|éditeur|edited by|commissioned|organi[sz]ed|'
                          r'produced in conjunction|poster created|tribute)\b', re.I)
CAT_RX = re.compile(r'^([A-Z][A-Za-zÀ-ÿ’\'\-]+(?: [A-Z][A-Za-zÀ-ÿ’\'\-]+)?)\s*(?:no\.?\s*|n\.?\s*|#\s*)?([IVXLC]+[a-z]?|\d+[A-Za-z]?(?:\.\d+)?(?:/[IVXLC\d]+)?)$')


def workshop_name(who, q):
    w = (who or '').strip()
    if not w:
        m = re.search(r'(?:printed|pulled|produced)\s+(?:and published\s+)?by\s+([^,.;(]+)', q or '', re.I)
        w = m.group(1).strip() if m else ''
    w = re.sub(r'^(?:the\s+)?(?:Atelier|Ateliers|Imprimerie|Chromist|Master printer)\s+', '', w, flags=re.I)
    w = re.sub(r'\s+(?:workshop|studio|atelier)$', '', w, flags=re.I)
    return w.strip()


def workshop_key(w):
    f = fold(w)
    for k in ('mourlot', 'lacouriere', 'crommelynck', 'frelaut', 'arnera', 'visat', 'madoura', 'gemini',
              'tamarind', 'universal limited', 'tyler', 'crown point', 'clot', 'salinas', 'rigal', 'hollanders',
              'welden', 'atelier 17', 'hayter', 'jasen smith', 'make-ready', 'tiber', 'matthieu', 'fequet', 'leblanc'):
        if k in f:
            return k
    return f


def read_work(h, born, died):
    """What a history says of the work's making: its own place, its workshop, its catalogue numbers."""
    made, shops, cats = None, [], []
    for e in h.get('events', []):
        k = e.get('k')
        if k == 'made' and e.get('p'):
            n, q, who = e.get('n') or '', e.get('q') or '', e.get('who') or ''
            if PUBLISHERISH.search(n) and not PRINTERISH.search(n):
                continue
            if PRINTERISH.search(n) or PRINTERISH.search(q) and who:
                w = workshop_name(who, q)
                if w and not re.search(r'\b(artist|himself|herself|the artist and)\b', w, re.I):
                    y = year_of(e.get('y'))
                    shops.append({'who': w, 'key': e['p'], 'w': (e.get('w') or '').split(',')[0],
                                  'll': e.get('ll'), 'y': y if y and born and born <= y <= (died or NOW) + 60 else None,
                                  'q': q})
                continue
            if who and not e.get('v'):
                continue                   # someone else's doing (an organiser, a committee)
            y = year_of(e.get('y'))
            if made is None:
                made = {'key': e['p'], 'w': (e.get('w') or '').split(',')[0], 'll': e.get('ll'), 'y': y,
                        'v': e.get('v'), 'q': q, 'n': n}
        elif k == 'written':
            q = (e.get('q') or '').strip()
            m = CAT_RX.match(q)
            if m and len(q) <= 40 and not re.match(r'^(No|Vol|Page|Plate|Fig|Cat|Lot)$', m.group(1)):
                cats.append(m.group(1) + ' ' + m.group(2))
    return made, shops, list(dict.fromkeys(cats))[:4]


# ---- the life, year by year ---------------------------------------------------------------------

RANK = {'died': 5, 'born': 5, 'range': 4, 'said': 3, 'record': 2}
NAMING = ['range', 'said', 'record', 'born', 'died']   # whose name a town goes by: a studio's before a birth record's
CARRY = 2       # a place is carried at most this many years past its evidence; after that the record names none


def build_years(evid, born, end):
    """For each year of the life, the strongest evidence; else carried from the last before it."""
    by = {}
    for i, e in enumerate(evid):
        for y in range(max(e['y0'], born), min(e['y1'], end) + 1):
            by.setdefault(y, []).append(i)
    years, last = {}, None
    for y in range(born, end + 1):
        c = by.get(y)
        if c:
            # The strongest; among equals the latest begun (a move), then the last named.
            i = max(c, key=lambda i: (RANK[evid[i]['how']], evid[i]['y0'], i))
            years[y] = (evid[i]['town'], i, False)
            last = (evid[i]['town'], i, y)
        elif last and y - last[2] <= CARRY and evid[last[1]]['how'] != 'born':
            years[y] = (last[0], last[1], True)
    return years


def main():
    studios = load(os.path.join(V2, 'studios.json'))
    cities = load(os.path.join(V2, 'cities.json'))
    towns = cities['towns']
    town_by = {t[0]: t for t in towns}
    finding = load(os.path.join(V2, 'finding.json'))
    kinds = finding['k']
    ex = load(os.path.join(V2, 'explorations.json'))
    sites = load(os.path.join(V2, 'sites.json'))['sites']
    voices = load(os.path.join(V2, 'voices.json'))
    walks = load(os.path.join(V2, 'characters', 'walks.json'), {})
    hand = load(HAND, {'drop': [], 'add': []})
    wd_rows = load(os.path.join(DL, 'wd.json'), [])
    wiki = dict(load(os.path.join(DS, 'artist_wiki.json'), {}))
    for k, v in load(os.path.join(DL, 'wiki.json'), {}).items():
        if v.get('text'):
            wiki[k] = v
    gaz = gazetteer(towns, load(os.path.join(DS, 'places.json'), []))

    # Birth and death: the first statement with a point (Wikidata's preferred order as read).
    bd = {}
    for r in sorted(wd_rows, key=lambda r: json.dumps(r, sort_keys=True)):
        a = bd.setdefault(r['a'], {})
        if r.get('born') and point(r.get('bll')) and 'born' not in a:
            a['born'] = {'place': r.get('bornLabel'), 'll': point(r['bll']), 'q': r['born']}
        if r.get('died') and point(r.get('dll')) and 'died' not in a:
            a['died'] = {'place': r.get('diedLabel'), 'll': point(r['dll']), 'q': r['died']}
        if r.get('b') and 'b' not in a:
            a['b'] = year_of(r['b'])
        if r.get('d') and 'd' not in a:
            a['d'] = year_of(r['d'])

    hunts_by = collections.defaultdict(list)
    for h in ex['hunts']:
        hunts_by[h['artist']].append(h)
    works_by = collections.defaultdict(list)
    for w in finding['w']:
        works_by[w[2]].append(w)
    sites_by = collections.defaultdict(list)
    for s in sites:
        if s.get('pr') in ('view', 'site', 'street'):
            sites_by[s['a']].append(s)

    # Every saved artist whose Wikidata item is matched: the studios' catalogue first, then the rest.
    hunt_artists = set(hunts_by)
    matched = load(os.path.join(DS, 'artists.json'), {})
    candidates, have = [], set()
    for A in studios['artists']:
        candidates.append(A)
        have.add(A[2])
    for q_ in sorted(matched):
        m = matched[q_]
        if q_ in have or not works_by.get(m['name']):
            continue
        candidates.append([m['slug'], m['name'], q_, m.get('birth'), m.get('death'), len(works_by[m['name']]), [], ''])
    surnames = sorted({surname(A[1]) for A in studios['artists'] if A[5] >= 3})

    # Voices: which voices touched which works.
    voice_rows = {v[0]: v for v in voices['voices']}

    lives = []
    for A in candidates:
        slug, name, q, born_y, died_y = A[0], A[1], A[2], A[3], A[4]
        info = bd.get(q, {})
        born_y = born_y or info.get('b')
        died_y = died_y or info.get('d')
        if not born_y:
            continue
        end = died_y or NOW
        evid = []

        def town_of(place, ll):
            key, km = nearest_town(ll, towns)
            return key, km

        def add(how, y0, y1, place, ll, src, name_=None, extra=None):
            if not ll or y0 is None:
                return
            key, km = town_of(place, ll)
            e = {'how': how, 'y0': y0, 'y1': max(y0, y1 or y0), 'place': place, 'll': ll, 'key': key, 'km': km,
                 'src': src, 'name': name_ or place, 'town': place}
            if extra:
                e.update(extra)
            evid.append(e)

        if info.get('born'):
            add('born', born_y, born_y, info['born']['place'], info['born']['ll'],
                {'name': 'Wikidata ' + q + ' · place of birth', 'url': 'https://www.wikidata.org/wiki/' + q})
        if died_y and info.get('died'):
            add('died', died_y, died_y, info['died']['place'], info['died']['ll'],
                {'name': 'Wikidata ' + q + ' · place of death', 'url': 'https://www.wikidata.org/wiki/' + q})
        undated = []
        for i in A[6]:
            r = studios['studios'][i]
            src = r.get('src', [])[:2]
            town = r.get('place') or r['name']
            if r.get('y0'):
                add('range', r['y0'], r.get('y1') or r['y0'], town, r['ll'], src[0] if src else None,
                    name_=r['name'], extra={'studio': i, 'kind': r['kind'], 'pr': r['pr'], 'srcs': src})
            else:
                undated.append(i)
        for h in hand.get('add', []):
            if h['artist'] == name:
                add('range', h['y0'], h.get('y1') or h['y0'], h['place'], h.get('ll') or gaz.get(h['place']), h['src'][0], name_=h.get('name'),
                    extra={'srcs': h['src'], 'kind': h.get('kind', 'lived and worked'), 'pr': h.get('pr', 'town')})
        art = wiki.get(q) or {}
        drops = [d['q'] for d in hand.get('drop', []) if d['artist'] == name]
        for p in said_presences(name, art.get('text'), art.get('url'), art.get('title') or name, gaz, born_y, died_y, surnames):
            if any(d in p['src']['q'] for d in drops):
                continue
            add('said', p['y0'], p['y1'], p['place'], p['ll'], p['src'], extra={'verb': p['verb']})

        # The works.
        rows = works_by.get(name, [])
        hunt_no = {}
        for h in hunts_by.get(name, []):
            for s in h['stops']:
                if not str(s.get('no') or '').strip():
                    continue
                hunt_no.setdefault(s['w'], []).append(surname(h['by'].split(' with ')[0]) + ' No. ' + str(s['no']))
        work_info = {}
        for w in rows:
            h = load(os.path.join(V2, 'histories', w[0] + '.json'), {})
            made, shops, cats = read_work(h, born_y, died_y)
            y = year_of(w[3])
            work_info[w[0]] = (h, made, shops, cats, y)
            if made and made.get('ll') and made.get('y') and born_y <= made['y'] <= end:
                add('record', made['y'], made['y'], made['w'] or (town_by.get(made['key']) or [0, made['key']])[1],
                    made['ll'], {'name': 'the record of “' + (w[1] or 'Untitled') + '”', 'q': made['q'], 'work': w[0]},
                    extra={'work': w[0], 'v': made.get('v')})
        # One town under one name: a place within 3 km of an earlier one takes its name (Juan-les-Pins is Antibes's).
        named = []
        for e in sorted(evid, key=lambda e: (NAMING.index(e['how']), e['y0'], e['place'])):
            for n in named:
                if dist(n['ll'], e['ll']) <= 3:
                    e['town'], e['tll'] = n['town'], n['ll']
                    break
            else:
                e['tll'] = e['ll']
                named.append(e)
        evid.sort(key=lambda e: (e['y0'], -RANK[e['how']], e['town'], json.dumps(e['src'], sort_keys=True)))
        years = build_years(evid, born_y, end)
        if not years:
            continue
        # Periods: runs of one town.
        periods = []
        for y in range(born_y, end + 1):
            if y not in years:
                continue
            town, i, carried = years[y]
            if periods and periods[-1]['town'] == town and periods[-1]['y1'] == y - 1:
                p = periods[-1]
                p['y1'] = y
                p['ev'].add(i)
                p['carried'] += 1 if carried else 0
            else:
                periods.append({'town': town, 'y0': y, 'y1': y, 'ev': {i}, 'carried': 1 if carried else 0})
        attested_towns = {e['town'] for e in evid if e['how'] not in ('born', 'died')}
        nworks = len(rows)
        # A notable life (Find's "lives", the report): three dated towns or more, and ten saved works or a hunt.
        notable = len(attested_towns | {e['town'] for e in evid}) >= 3 and (nworks >= 10 or name in hunt_artists)

        out_p = []
        for p in periods:
            evs = sorted(p['ev'], key=lambda i: (evid[i]['y0'], -RANK[evid[i]['how']]))
            first = evid[evs[0]]
            srcs, seen = [], set()
            for i in evs:
                e = evid[i]
                for s in (e.get('srcs') or [e['src']]):
                    if not s:
                        continue
                    k = (s.get('name'), s.get('q'))
                    if k in seen:
                        continue
                    seen.add(k)
                    item = {'how': e['how'], 'y': e['y0'] if e['y1'] == e['y0'] else [e['y0'], e['y1']], 'name': s.get('name')}
                    if s.get('url'):
                        item['url'] = s['url']
                    if s.get('q'):
                        item['q'] = s['q']
                    if s.get('work'):
                        item['work'] = s['work']
                    srcs.append(item)
            at = []
            for i in evs:
                e = evid[i]
                if e.get('studio') is not None or (e['how'] == 'range' and e.get('name') and e['name'] != e['town']):
                    at.append({'name': e['name'], 'll': e['ll'], 'kind': e.get('kind'), 'pr': e.get('pr', 'town'),
                               'studio': e.get('studio'), 'y': [e['y0'], e['y1']]})
            ll = first['tll']
            key = first['key'] or nearest_town(ll, towns, 400)[0]
            hows = sorted({evid[i]['how'] for i in evs}, key=lambda h: -RANK[h])
            out_p.append({'y0': p['y0'], 'y1': p['y1'], 'place': p['town'], 'll': ll, 'key': key,
                          'km': first['km'], 'how': hows, 'carried': p['carried'], 'at': at, 'src': srcs[:12],
                          'works': [], 'prints': [], 'sites': [], 'voices': [], 'shows': [], 'cross': []})

        def period_at(y):
            for k, p in enumerate(out_p):
                if p['y0'] <= y <= p['y1']:
                    return k
            return None

        works, shops_all, after = [], collections.OrderedDict(), collections.Counter()
        for w in sorted(rows, key=lambda w: (year_of(w[3]) or 9999, w[0])):
            h, made, shops, cats, y = work_info[w[0]]
            # The hunt's number and the record's citations, each once ("Bloch No. 1340" is "Bloch 1340").
            cats, seen_c = [c for c in hunt_no.get(w[0], []) + cats], set()
            cats = [c for c in cats if not (fold(c).replace('no. ', '') in seen_c or seen_c.add(fold(c).replace('no. ', '')))][:4]
            shop = shops[0] if shops else None
            k = period_at(y) if y else None
            how = None
            rec_town = next((e['town'] for e in evid if e['how'] == 'record' and e.get('work') == w[0]), None)
            if k is not None:
                if rec_town and rec_town == out_p[k]['place']:
                    how = 'record'
                elif rec_town:
                    how = 'record:' + rec_town       # its own record puts its making elsewhere than the year's place
                elif any(s.get('w') == w[0] for s in sites_by.get(name, [])):
                    how = 'site'
                else:
                    how = 'dated'
            row = [w[0], w[1] or 'Untitled', y or 0, w[4] or '', how or ('after' if y and y > end else ''),
                   k if k is not None else -1, kinds[w[7]] if isinstance(w[7], int) and w[7] < len(kinds) else '',
                   cats]
            if shop:
                sk = workshop_key(shop['who'])
                row.append([shop['who'], shop['w'], shop['key']])
                d = shops_all.setdefault(sk, {'who': shop['who'], 'w': shop['w'], 'key': shop['key'], 'll': shop['ll'],
                                              'n': 0, 'y0': None, 'y1': None, 'q': shop['q']})
                d['n'] += 1
                if y:
                    d['y0'] = min(d['y0'] or y, y)
                    d['y1'] = max(d['y1'] or y, y)
            idx = len(works)
            works.append(row)
            if k is not None:
                out_p[k]['works'].append(idx)
                if shop:
                    out_p[k]['prints'].append(idx)
            # The afterlife: what happened to the work after the death.
            for e in h.get('events', []):
                ey = year_of(e.get('y'))
                if died_y and ey and ey > died_y and e.get('p') and e.get('k') != 'written':
                    after[(ey, e['p'])] += 1
        sites_rows = []
        for s in sorted(sites_by.get(name, []), key=lambda s: (s.get('d') or 9999, s['id'])):
            y = s.get('d')
            k = period_at(y) if y else None
            sites_rows.append([s['id'], s.get('t') or 'Untitled', y or 0, s.get('place') or s.get('what') or '',
                               s['ll'], s.get('pr'), s.get('w'), s.get('key'), k if k is not None else -1])
            if k is not None:
                out_p[k]['sites'].append(len(sites_rows) - 1)

        # Voices: who wrote on the artist's works, and when.
        vrows, seen_v = [], set()
        wids = {w[0] for w in rows}
        vids = set()
        for wid in sorted(wids):
            for x in voices['w'].get(wid) or []:
                vid = x[0] if isinstance(x, list) else x
                if isinstance(vid, int):
                    vid = voices['voices'][vid][0]
                vids.add(vid)
        for vid in sorted(vids):
            vf = load(os.path.join(V2, 'voices', vid + '.json'))
            if not vf:
                continue
            vw = vf.get('works') or []
            for part, role in (('said', 'said'), ('acts', None)):
                for a in vf.get(part) or []:
                    wi = a.get('w')
                    if wi is None or wi >= len(vw):
                        continue
                    wid = vw[wi][0] if isinstance(vw[wi], list) else vw[wi]
                    if wid not in wids or not a.get('y'):
                        continue
                    r = role or {'w': 'wrote', 'c': 'curated', 's': 'said'}.get(a.get('r'), 'wrote')
                    key = (vid, a['y'], r)
                    if key in seen_v:
                        continue
                    seen_v.add(key)
                    vr = voice_rows.get(vid)
                    vrows.append([vid, vf.get('name'), a['y'], r, wid, 1 if vr and vr[3] >= 2 else 0])
        vrows.sort(key=lambda v: (v[2], v[1] or '', v[3]))
        for i, v in enumerate(vrows):
            k = period_at(v[2])
            if k is not None:
                out_p[k]['voices'].append(i)

        # Shows during the life.
        shows = collections.OrderedDict()
        for w in rows:
            h = work_info[w[0]][0]
            for e in h.get('events', []):
                if e.get('k') != 'exhibited' or not e.get('t'):
                    continue
                ey = year_of(e.get('y'))
                if not ey or ey > end or ey < born_y:
                    continue
                key = (ey, e['t'])
                d = shows.setdefault(key, [ey, e['t'], e.get('p') or '', (e.get('w') or '').split(',')[0], 0])
                d[4] += 1
        show_rows = sorted(shows.values(), key=lambda s: (s[0], s[1]))
        for i, s in enumerate(show_rows):
            k = period_at(s[0])
            if k is not None:
                out_p[k]['shows'].append(i)

        att = collections.defaultdict(set)    # (town key) -> years attested by evidence
        for e in evid:
            if e['key']:
                for y in range(e['y0'], min(e['y1'], end) + 1):
                    att[e['key']].add(y)
        lives.append({
            'id': slug, 'name': name, 'q': q, 'born': born_y, 'died': died_y, 'notable': 1 if notable else 0,
            'b': [info['born']['place'], info['born']['ll']] if info.get('born') else None,
            'd': [info['died']['place'], info['died']['ll']] if died_y and info.get('died') else None,
            'periods': out_p, 'works': works, 'sites': sites_rows, 'voices': vrows, 'shows': show_rows,
            'workshops': [[v['who'], v['w'], v['key'], v['ll'], v['n'], v['y0'], v['y1']] for v in shops_all.values()],
            'undated': [[studios['studios'][i]['name'], studios['studios'][i].get('place') or '', studios['studios'][i]['ll'],
                         studios['studios'][i].get('key'), i] for i in undated],
            'after': sorted([[y, k, n] for (y, k), n in after.items()]),
            'hunts': [[h['id'], h['title'], len(h['stops'])] for h in hunts_by.get(name, [])],
            'walks': [[w['id'], w['title']] for w in (walks.get('walks') or []) if w.get('artist') == name],
            '_att': att, '_evid': evid,
        })

    # Lives that cross: one city, the same years, by evidence in both.
    for L in lives:
        L['cross'] = []
    crossing = [L for L in lives if L['notable']]
    for i, A_ in enumerate(crossing):
        for B in crossing[i + 1:]:
            for key in sorted(set(A_['_att']) & set(B['_att'])):
                ys = sorted(A_['_att'][key] & B['_att'][key])
                if not ys:
                    continue
                runs = [[ys[0], ys[0]]]
                for y in ys[1:]:
                    if y == runs[-1][1] + 1:
                        runs[-1][1] = y
                    else:
                        runs.append([y, y])
                for r in runs:
                    nm = (town_by.get(key) or [0, key])[1]
                    A_['cross'].append([B['id'], B['name'], key, nm, r[0], r[1]])
                    B['cross'].append([A_['id'], A_['name'], key, nm, r[0], r[1]])
    for L in lives:
        L['cross'].sort(key=lambda c: (c[4], c[1], c[2]))
        for ci, c in enumerate(L['cross']):
            for k, p in enumerate(L['periods']):
                if p['y0'] <= c[5] and c[4] <= p['y1'] and p['key'] == c[2]:
                    p['cross'].append(ci)

    # Where the works are and have been (finding.json's places, places.json's points).
    pl = load(os.path.join(V2, 'places.json'))['places']
    wplaces = {w[0]: w[5] or [] for w in finding['w']}
    for L in lives:
        n = collections.Counter()
        for w in L['works']:
            for i in wplaces.get(w[0], []):
                n[i] += 1
        L['places'] = [[pl[i][0], pl[i][1], pl[i][3], pl[i][4], c] for i, c in sorted(n.items(), key=lambda x: (-x[1], x[0])) if i < len(pl)]

    os.makedirs(OUTD, exist_ok=True)
    for f in glob.glob(os.path.join(OUTD, '*.json')):
        os.remove(f)
    lives.sort(key=lambda L: (-len(L['works']), L['name']))
    # The Artists layer: one mark an artist, at the birthplace; a town where several were born, one mark.
    clusters = collections.OrderedDict()
    for k, L in enumerate(lives):
        if not L['b']:
            continue
        ll = L['b'][1]
        # A birthplace within 40 km of a city of the site is the busiest such city's (Brooklyn is New York's);
        # else within 40 km of another birthplace already marked; else its own.
        near_t = [t for t in towns if dist(ll, (t[3], t[4])) <= 40]
        key = max(near_t, key=lambda t: (t[5], -dist(ll, (t[3], t[4]))))[0] if near_t else None
        if key:
            t = town_by[key]
            ck, cname, cll = 't:' + key, t[1], [t[3], t[4]]
        else:
            near = next((k_ for k_, c_ in clusters.items() if k_.startswith('p:') and dist(c_['ll'], ll) <= 40), None)
            ck = near or 'p:' + L['b'][0] + '@%.1f,%.1f' % (ll[0], ll[1])
            cname, cll = (clusters[near]['name'], clusters[near]['ll']) if near else (L['b'][0], ll)
        c = clusters.setdefault(ck, {'name': cname, 'll': cll, 'lives': [], 'n': 0})
        c['lives'].append(k)
        c['n'] += len(L['works'])
    marks = []
    for ck, c in clusters.items():
        one = len(c['lives']) == 1
        L0 = lives[c['lives'][0]]
        label = surname(L0['name']) if one else c['name'] + ' · ' + str(len(c['lives']))
        aria = (L0['name'] + ', born in ' + L0['b'][0] + ', ' + str(L0['born'])) if one else \
            str(len(c['lives'])) + ' saved artists born in ' + c['name']
        ll = L0['b'][1] if one else c['ll']
        marks.append([ll[0], ll[1], label, aria, c['lives'], 'exact' if one else 'town', c['n'], c['name']])
    marks.sort(key=lambda m: (-m[6], m[2]))
    index, made = [], {}
    for L in lives:
        del L['_att'], L['_evid']
        json.dump(L, open(os.path.join(OUTD, L['id'] + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        n_prints = sum(1 for w in L['works'] if len(w) > 8)
        index.append([L['id'], L['name'], L['born'], L['died'], len(L['periods']), len(L['works']), n_prints,
                      len({c[0] for c in L['cross']}), [h[0] for h in L['hunts']], L['notable'],
                      L['b'][0] if L['b'] else ''])
        for w in L['works']:
            if len(w) > 8 or w[5] >= 0:
                p = L['periods'][w[5]] if w[5] >= 0 else None
                how = w[4]
                at = how.split(':', 1)[1] if how.startswith('record:') else (p['place'] if p else '')
                made[w[0]] = [L['id'], w[8][0] if len(w) > 8 else '', w[8][1] if len(w) > 8 else '', w[2],
                              at, how.split(':', 1)[0]]
    json.dump({'note': NOTE, 'lives': index, 'made': made, 'marks': marks}, open(OUT, 'w'), ensure_ascii=False,
              separators=(',', ':'), sort_keys=True)
    print(f'{len(index)} lives, {sum(r[9] for r in index)} notable; {len(marks)} birthplace marks for '
          f'{sum(len(m[4]) for m in marks)} artists')
    for r in index:
        if not r[9]:
            continue
        print(f'  {r[1]:28} {r[2]}–{r[3] or ""}  periods {r[4]:3}  works {r[5]:4}  printed {r[6]:3}  crosses {r[7]:3}  hunts {len(r[8])}')


if __name__ == '__main__':
    main()

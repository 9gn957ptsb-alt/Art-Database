#!/usr/bin/env python3
"""The movements — docs/v2/movements.json.

The artist, 2 Oct 2026, on "lives that cross are the start of a social graph of art history. The
cities where many lives overlap (Paris in 1906, New York in 1950) are the movements themselves, so a
movement becomes a place and a time on the dial": "Yes great idea about using overlaps of artist
residencies during a time period to define art and social movements. That is certainly another way
to develop connections and move the viewer through the globe. I like the idea I've incorporating it
on the dial given it's specification of time."

A movement here is an overlap, found, never declared: three saved artists or more in one city in
the same years, each by evidence —

  studio   a dated place of the studios (studios.json: Wikidata's P937/P551 with start and end, or
           the studios' hand table), within 30 km of the city;
  life     a year the lives place the artist there by evidence (lives/<id>.json periods' sources:
           a dated place, a sentence of Wikipedia, a work's own record) — never a carried year,
           never born or died;
  school   a dated Wikidata P69 educated at or P108 employer whose institution stands in the city
           (fetch_movements.py; the Académie Julian, the Bauhaus, Black Mountain College).

Only years the artist was fifteen or older and alive. Only a placement that is evidence of presence
defines a movement (2 Oct 2026: long residents had padded the big Paris and New York clusters):
twelve years or fewer, or longer and bounded by its own record (a building's occupancy, a hand
table's sentences, a school's or an employer's start and end, a residence with its own dates) and
overlapping the movement two years or more. An open span — a Wikidata work location naming only the
town, often RKD's whole career (Erwitt's New York 1948–2002, Atget's Paris 1878–1927) — never defines
one; its artist joins one only where another dated source puts them in the city in those years
(within two). The lives keep each year's strongest evidence only, so the sentences a life passes over
under such a span ("In 1886, he moved to Paris") are read again here, by the lives' own reading.

The overlaps are the maximal sets of artists together in a city in some year (the cliques of an
interval graph); sets that share most of their artists a few years apart are one movement. Its
members are in order of how much they are the movement: the years they overlap it × their weight on
the site (saved works and catalogue entries), so Picasso and Matisse lead Paris, 1905. Each is said
by what supports it: "Paris, 1908–1910 · Picasso, Le Corbusier, Braque …"; a movement's name is
added only where most of its artists (half or more, three or more) share a Wikidata P135 movement
whose own years (P580/P582, else P571/P576) overlap the cluster's — "Cubism, by Wikidata's movement
of 3 of 6 artists" — never otherwise.

The evidence of contact among them, from the public files: the shows, sales, owners and writings
two members' saved works shared (threads/), then (within three years of the span) or later (a
show that put them together after); the voices who wrote on two members or more (voices.json);
the members' saved works dated within their years there (finding.json).

Also the dial's index: for every city, the movements there with their years, so the page can light
them as the dial turns without reading anything else; and the relay's rows (kind "m"), each
movement a walk through its members' dated places in those years.

Public inputs (docs/v2/), the Wikidata cache in data/movements/ (CC0, fetch_movements.py) and the
Wikipedia caches the lives read (data/lives/, data/studios/). Same bytes every run. No network.

    python3 scripts/build_movements.py
"""
import collections, glob, json, math, os, re, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_lives as BL               # its reading of a Wikipedia sentence (said_presences)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'docs', 'v2')
WD = os.path.join(ROOT, 'data', 'movements', 'wd.json')
OUT = os.path.join(V2, 'movements.json')
NOW = 2026
MIN_ARTISTS = 3
NEAR_KM = 30
MERGE_GAP = 3          # years between two sets that are one movement
MERGE_SHARE = 0.6      # of the smaller set's artists shared
MOST_SPAN = 12         # a movement is never longer than this; a longer run is two
SEED_SPAN = 12         # a placement longer than this is not, alone, evidence of presence in a given year
SEED_OVERLAP = 2       # one longer, bounded by its own record, seeds only where it overlaps the movement this long
OPEN_KINDS = ('worked', 'lived and worked')   # a Wikidata work location (with or without a residence), the town only

NOTE = ("The movements (docs/v2/movements.js): three saved artists or more in one city in the same years, "
        "each placed there by evidence — a dated place of the studios, a year a life places them by evidence "
        "(never a carried year), or a dated Wikidata 'educated at' or 'employer' whose institution stands in the "
        "city (CC0). Only a placement of twelve years or fewer, or a longer one bounded by its own record, defines "
        "one; a work location spanning a career joins only where another dated source puts the artist there then. "
        "Members most the movement first (years there × saved works and catalogue entries). "
        "Named by the city, the years and the artists; a movement's name only where most of its "
        "artists share a Wikidata P135 movement whose years overlap, with that count. The evidence of contact: "
        "the shows, sales, owners and writings their saved works shared, the voices who wrote on several of them, "
        "the works dated there then. Written by scripts/build_movements.py.")


def load(*p):
    return json.load(open(os.path.join(V2, *p)))


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def year(v):
    m = re.match(r'^-?(\d{3,4})', str(v or ''))
    return int(m.group(1)) if m else None


def point(s):
    m = re.match(r'Point\(([-\d.eE]+) ([-\d.eE]+)\)', s or '')
    return (float(m.group(2)), float(m.group(1))) if m else None


def surname(name):
    w = name.split(' ')
    k = len(w) - 1
    while k > 0 and re.match(r'^(de|van|von|da|di|del|der|le|la)$', w[k - 1], re.I):
        k -= 1
    s = ' '.join(w[k:])
    return re.sub(r'\s*\(.*\)$', '', s)


def clean_name(name):
    return re.sub(r'\s*\((?:\d{4}[-–]\d{4}|[^)]*\d{4}[^)]*)\)$', '', name).strip()


def main():
    towns = load('cities.json')['towns']
    town_by = {t[0]: t for t in towns}
    grid = collections.defaultdict(list)
    for t in towns:
        grid[(round(t[3]), round(t[4]))].append(t)

    def nearest(ll, most=NEAR_KM):
        best, bd = None, most
        for dl in (-1, 0, 1):
            for dn in (-1, 0, 1):
                for t in grid.get((round(ll[0]) + dl, round(ll[1]) + dn), []):
                    d = km(ll, (t[3], t[4]))
                    if d <= bd:
                        best, bd = t, d
        return best

    st = load('studios.json')
    arts = st['artists']                      # [id, name, q, born, died, n, [studios], span]
    by_q = {a[2]: a for a in arts if a[2]}
    by_id = {a[0]: a for a in arts}
    finding = load('finding.json')
    works_by_artist = collections.defaultdict(list)
    for i, w in enumerate(finding['w']):
        for a in str(w[2]).split(', '):
            works_by_artist[a].append(i)

    # The artists the presences can name: the studios' (with their saved works' count), and any other
    # saved artist with a matched item read by fetch_movements.py.
    people = {a[0]: {'id': a[0], 'name': a[1], 'q': a[2], 'b': a[3], 'd': a[4], 'n': a[5]} for a in arts}
    wd = json.load(open(WD)) if os.path.exists(WD) else {'moves': [], 'details': [], 'affil': [], 'orgs': []}
    sa_path = os.path.join(ROOT, 'data', 'studios', 'artists.json')
    sa = json.load(open(sa_path)) if os.path.exists(sa_path) else {}
    q_to_id = {a[2]: a[0] for a in arts if a[2]}
    for q, v in sorted(sa.items()):
        if q in q_to_id:
            continue
        name = v['name']
        pid = v.get('slug') or re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        if pid in people:
            continue
        people[pid] = {'id': pid, 'name': name, 'q': q, 'b': v.get('birth'), 'd': v.get('death'),
                       'n': len(works_by_artist.get(name, []))}
        q_to_id[q] = pid

    def fits(pid, y):
        p = people[pid]
        if p['b'] and y < p['b'] + 15:
            return False
        if p['d'] and y > p['d']:
            return False
        return y <= NOW

    # ---- presences: (artist, city) -> {year: [evidence]}
    pres = collections.defaultdict(lambda: collections.defaultdict(list))

    def put(pid, key, y0, y1, ev):
        if not key or key not in town_by or pid not in people:
            return
        y1 = y1 if y1 and y1 >= y0 else y0
        if y1 - y0 > 60:
            return
        # How long the placement is: short enough to be evidence of presence in each of its years,
        # or long — bounded by its own record (a building's occupancy, a hand table's sentences, a
        # school's or an employer's start and end, a residence with its dates), or open (a Wikidata
        # work location naming only the town, often a career: Erwitt's New York 1948–2002).
        ev['long'] = y1 - y0 + 1 > SEED_SPAN
        ev['open'] = ev['long'] and ev.get('open', False)
        for y in range(y0, y1 + 1):
            if fits(pid, y):
                pres[(pid, key)][y].append(ev)

    def wd_town(s):
        """A studios row whose years are a Wikidata work location's (P937, often RKD's career span), naming
        only the town, not a building. A residence (P551) with its own start and end is bounded."""
        name = (s.get('src') or [{}])[0].get('name', '')
        return (s.get('kind') in OPEN_KINDS and s.get('pr') in ('town', 'district') and
                name.startswith('Wikidata') and 'work location' in name)

    open_spans = set()                   # (artist's item, y0, y1): the same statement, echoed by a life
    for i, s in enumerate(st['studios']):
        if not s.get('y0') or s.get('km', 0) > NEAR_KM:
            continue
        a = arts[s['a']]
        src = (s.get('src') or [{}])[0]
        if wd_town(s):
            open_spans.add((a[2] or a[0], s['y0'], s.get('y1') or s['y0']))
        put(a[0], s.get('key'), s['y0'], s.get('y1') or s['y0'],
            {'how': 'studio', 'y': [s['y0'], s.get('y1') or s['y0']], 'what': s.get('kind', ''), 'place': s.get('name', ''),
             'src': src.get('name', ''), 'url': src.get('url', ''), 'studio': i, 'll': s.get('ll'), 'open': wd_town(s)})

    lives = []
    life_at = collections.defaultdict(list)
    kept_q = set()                       # (artist, sentence): the sentences the lives keep
    if os.path.exists(os.path.join(V2, 'lives.json')):
        for row in load('lives.json')['lives']:
            path = os.path.join(V2, 'lives', row[0] + '.json')
            if not os.path.exists(path):
                continue
            L = json.load(open(path))
            lives.append(L['id'])
            pid = L['id'] if L['id'] in people else q_to_id.get(L.get('q'))
            if not pid:
                pid = L['id']
                people[pid] = {'id': pid, 'name': L['name'], 'q': L.get('q') or '', 'b': L.get('born'), 'd': L.get('died'),
                               'n': len(works_by_artist.get(L['name'], []))}
                if L.get('q'):
                    q_to_id[L['q']] = pid
            # Where the life is, city by city, by evidence: the hub's marks for a life passing through a city.
            for p in L['periods']:
                ev = [s_ for s_ in p.get('src', []) if s_.get('how') not in ('born', 'died')]
                if p.get('key') and ev:
                    ys = [(s_['y'][0] if isinstance(s_.get('y'), list) else s_.get('y')) for s_ in ev]
                    ys = [y for y in ys if y]
                    if ys:
                        life_at[p['key']].append([L['id'], L['name'], min(ys)])
            for p in L['periods']:
                for s in p.get('src', []):
                    if s.get('how') in ('born', 'died'):
                        continue
                    y = s.get('y')
                    y0, y1 = (y[0], y[1]) if isinstance(y, list) else (y, y)
                    if not y0:
                        continue
                    echo = s.get('how') == 'range' and (people[pid]['q'] or pid, y0, y1 or y0) in open_spans
                    if s.get('q'):
                        kept_q.add((pid, s['q']))
                    put(pid, p.get('key'), y0, y1, {'how': 'life', 'y': [y0, y1], 'what': s.get('how', ''),
                                                   'place': p.get('place', ''), 'src': s.get('name', ''),
                                                   'url': s.get('url', ''), 'q': s.get('q', '')[:240], 'll': p.get('ll'),
                                                   'open': echo})

    # The sentences a life passes over. Each year of a life keeps only its strongest evidence, so where a
    # work location spans the year, "In 1886, he moved to Paris" is not in the life's file; and an open span
    # joins a movement only where another dated source puts the artist there. The lives' own reading of the
    # article (build_lives.said_presences, the same cached text and the hand table's drops), for the artists
    # with an open span; a sentence the life already keeps is not read twice.
    with_open = sorted({pid for (pid, _), ys in pres.items() if any(ev['open'] for evs in ys.values() for ev in evs)})
    if with_open:
        wiki = dict(BL.load(os.path.join(BL.DS, 'artist_wiki.json'), {}))
        for k_, v_ in BL.load(os.path.join(BL.DL, 'wiki.json'), {}).items():
            if v_.get('text'):
                wiki[k_] = v_
        gaz = BL.gazetteer(towns, BL.load(os.path.join(BL.DS, 'places.json'), []))
        others = sorted({BL.surname(a[1]) for a in arts if a[5] >= 3})
        drops = BL.load(BL.HAND, {}).get('drop', [])
        for pid in with_open:
            P = people[pid]
            art = wiki.get(P['q']) or {}
            if not art.get('text') or not P['b']:
                continue
            gone = [d['q'] for d in drops if d.get('artist') == P['name']]
            for sp in BL.said_presences(P['name'], art['text'], art.get('url'), art.get('title') or P['name'], gaz,
                                        P['b'], P['d'], others):
                q_ = sp['src']['q']
                t = nearest(sp['ll'])
                if not t or (pid, q_) in kept_q or any(d in q_ for d in gone):
                    continue
                put(pid, t[0], sp['y0'], sp['y1'], {'how': 'life', 'y': [sp['y0'], sp['y1']], 'what': 'said',
                                                    'place': sp['place'], 'src': sp['src']['name'], 'url': sp['src'].get('url') or '',
                                                    'q': q_[:240], 'll': sp['ll']})

    orgs = {}
    for o in wd['orgs']:
        if o['o'] in orgs:
            continue
        ll = point(o.get('coord')) or point(o.get('inCoord')) or point(o.get('hqCoord'))
        orgs[o['o']] = {'label': o.get('label', o['o']), 'll': ll}
    for r in wd['affil']:
        if r['prop'] not in ('P69', 'P108'):          # memberships are honours or groups, not places
            continue
        pid = q_to_id.get(r['a'])
        o = orgs.get(r['org'])
        if not pid or not o or not o['ll']:
            continue
        t = nearest(o['ll'])
        if not t:
            continue
        ys = [year(r.get(k)) for k in ('start', 'end', 'pit')]
        y0 = ys[0] or ys[2] or ys[1]
        y1 = ys[1] or y0
        if not y0:
            continue
        put(pid, t[0], y0, y1, {'how': 'school', 'y': [y0, y1], 'what': 'studied at' if r['prop'] == 'P69' else 'worked for',
                                 'place': o['label'], 'src': 'Wikidata ' + r['a'] + ' · ' + ('educated at' if r['prop'] == 'P69' else 'employer'),
                                 'url': 'https://www.wikidata.org/wiki/' + r['a'], 'll': list(o['ll'])})

    # ---- the overlaps, city by city
    # Only a placement that is evidence of presence seeds one: short (SEED_SPAN years or fewer), or
    # longer but bounded by its own record and overlapping the movement SEED_OVERLAP years or more. An
    # open span — a Wikidata work location naming only the town — never defines a movement; its artist
    # joins one only when another dated source puts them in the city in those years.
    anchor = collections.defaultdict(dict)       # (pid, key) -> {year: 'short' | 'long'}
    opened = collections.defaultdict(set)        # (pid, key) -> {year}: open spans only
    for (pid, key), ys in pres.items():
        for y, evs in ys.items():
            for ev in evs:
                if ev['open']:
                    opened[(pid, key)].add(y)
                elif not ev['long']:
                    anchor[(pid, key)][y] = 'short'
                else:
                    anchor[(pid, key)].setdefault(y, 'long')
    city_years = collections.defaultdict(lambda: collections.defaultdict(set))
    for (pid, key), ys in anchor.items():
        for y in ys:
            city_years[key][y].add(pid)

    # How much an artist weighs on the site: saved works and catalogue entries (the hunts' numbers).
    def fold(t):
        return re.sub(r'[\u0300-\u036f]', '', unicodedata.normalize('NFD', clean_name(t or ''))).lower()
    catalogued = collections.Counter()
    if os.path.exists(os.path.join(V2, 'explorations.json')):
        for h in load('explorations.json').get('hunts', []):
            catalogued[fold(h.get('artist'))] += sum(1 for st_ in h.get('stops', []) if st_.get('no'))

    def weight(pid):
        return people[pid]['n'] + catalogued.get(fold(people[pid]['name']), 0)

    def evidence(pid, key, y0, y1):
        """Their evidence here, what puts them there in the movement's years first, an open span last."""
        evs, seen = [], set()
        for y in sorted(pres[(pid, key)]):
            for ev in pres[(pid, key)][y]:
                k_ = (ev['how'], ev['src'], ev['place'], tuple(ev['y']))
                if k_ not in seen:
                    seen.add(k_)
                    evs.append(ev)
        far = lambda ev: 0 if ev['y'][0] <= y1 + 2 and (ev['y'][1] or ev['y'][0]) >= y0 - 2 else 1
        return sorted(evs, key=lambda ev: (ev['open'], far(ev), ev['y'][0]))

    clusters = []
    for key in sorted(city_years):
        yrs = city_years[key]
        sets = {}
        for y in sorted(yrs):
            s = frozenset(yrs[y])
            if len(s) >= MIN_ARTISTS:
                sets.setdefault(s, []).append(y)
        maximal = [(s, ys) for s, ys in sets.items() if not any(s < o for o in sets)]
        groups = [{'who': set(s), 'years': set(ys)} for s, ys in maximal]
        groups.sort(key=lambda g: min(g['years']))
        merged = True
        while merged:
            merged = False
            for i in range(len(groups)):
                for j in range(i + 1, len(groups)):
                    a, b = groups[i], groups[j]
                    gap = max(min(b['years']) - max(a['years']), min(a['years']) - max(b['years']))
                    share = len(a['who'] & b['who']) / min(len(a['who']), len(b['who']))
                    ys = a['years'] | b['years']
                    if gap <= MERGE_GAP and share >= MERGE_SHARE and max(ys) - min(ys) <= MOST_SPAN:
                        a['who'] |= b['who']
                        a['years'] = ys
                        del groups[j]
                        merged = True
                        break
                if merged:
                    break
        for g in groups:
            # The seeds: a short placement in the movement's years, or a bounded long one overlapping
            # them SEED_OVERLAP years or more; the years are those where three seeds or more were there.
            y0, y1 = min(g['years']), max(g['years'])
            seeds = set()
            for pid in g['who']:
                a_ = anchor[(pid, key)]
                inside = [y for y in a_ if y0 <= y <= y1]
                if any(a_[y] == 'short' for y in inside) or len(inside) >= SEED_OVERLAP:
                    seeds.add(pid)
            years = sorted(y for y in g['years'] if sum(1 for pid in seeds if y in anchor[(pid, key)]) >= MIN_ARTISTS)
            if not years:
                continue
            y0, y1 = years[0], years[-1]
            # Who else joins: an open span over those years, with another dated source in the city then.
            joiners = set()
            for (pid, k_), ys in opened.items():
                if k_ != key or pid in seeds or not any(y0 <= y <= y1 for y in ys):
                    continue
                if any(y0 - 2 <= y <= y1 + 2 for y in anchor.get((pid, key), {})):
                    joiners.add(pid)
            # Each member's own years here, and how much they are the movement: the years they overlap
            # it × their weight on the site (saved works and catalogue entries).
            members = []
            for pid in seeds | joiners:
                # Their years: what puts them there, two years either side; an open span only within the movement's.
                a_ = anchor.get((pid, key), {})
                ys = sorted(y for y in pres[(pid, key)] if y0 <= y <= y1 or (y0 - 2 <= y <= y1 + 2 and y in a_))
                if not ys:
                    continue
                allys = sorted(pres[(pid, key)])
                over = sum(1 for y in ys if y0 <= y <= y1)
                members.append({'id': pid, 'y0': ys[0], 'y1': ys[-1], 'all': [allys[0], allys[-1]], 'ev': evidence(pid, key, y0, y1),
                                'joined': pid in joiners, 'score': over * weight(pid)})
            members.sort(key=lambda m: (-m['score'], m['y0'], m['id']))
            if sum(1 for m in members if not m['joined']) < MIN_ARTISTS:
                continue
            clusters.append({'key': key, 'y0': y0, 'y1': y1, 'members': members})

    # ---- names: a Wikidata movement most of the members share, in the cluster's years
    mv_label, mv_years = {}, {}
    for d in wd['details']:
        m = d['m']
        mv_label.setdefault(m, d.get('label') or m)
        a = year(d.get('start')) or year(d.get('inception'))
        b = year(d.get('end')) or year(d.get('dissolved'))
        if a or b:
            o = mv_years.get(m, [None, None])
            mv_years[m] = [min(x for x in (o[0], a) if x) if (o[0] or a) else None,
                           max(x for x in (o[1], b) if x) if (o[1] or b) else None]
    moves_of = collections.defaultdict(set)
    for r in wd['moves']:
        pid = q_to_id.get(r['a'])
        if pid:
            moves_of[pid].add(r['m'])

    def overlaps(mv, c):
        ys = mv_years.get(mv)
        if not ys:
            return False
        a = ys[0] or ys[1] - 30
        b = ys[1] or ys[0] + 30
        return not (a > c['y1'] + 2 or b < c['y0'] - 2)

    def among(c):
        """Movements three of its artists or more share on Wikidata in its years, short of most of them:
        said with their counts ("among them"), never as the movement's name."""
        ids = [m['id'] for m in c['members']]
        count = collections.Counter(mv for pid in ids for mv in moves_of.get(pid, ()))
        out = []
        for mv, n in sorted(count.items(), key=lambda kv: (-kv[1], kv[0])):
            if n >= 3 and overlaps(mv, c) and not (c['label'] and c['label']['q'] == mv):
                out.append([mv, mv_label[mv][:1].upper() + mv_label[mv][1:], n])
        return out[:3]

    def label(c):
        ids = [m['id'] for m in c['members']]
        count = collections.Counter(mv for pid in ids for mv in moves_of.get(pid, ()))
        best = None
        for mv, n in sorted(count.items(), key=lambda kv: (-kv[1], kv[0])):
            if n < 3 or n * 2 < len(ids):
                continue
            ys = mv_years.get(mv)
            if not ys:
                continue
            a = ys[0] or ys[1] - 30
            b = ys[1] or ys[0] + 30
            if a > c['y1'] + 2 or b < c['y0'] - 2:
                continue
            best = {'q': mv, 'name': mv_label[mv][:1].upper() + mv_label[mv][1:], 'n': n, 'of': len(ids),
                    'years': ys, 'who': sorted(pid for pid in ids if mv in moves_of.get(pid, ())),
                    'url': 'https://www.wikidata.org/wiki/' + mv}
            break
        return best

    # ---- the evidence of contact
    thread_files = sorted(glob.glob(os.path.join(V2, 'threads', '*.json')))
    threads = []
    for f in thread_files:
        t = json.load(open(f))
        if t.get('k') not in ('show', 'sale', 'owner', 'writing'):
            continue
        threads.append(t)
    vo = load('voices.json')
    voice_rows = vo['voices']
    work_ix = {w[0]: i for i, w in enumerate(finding['w'])}

    def contact(c):
        names = {people[m['id']]['name']: m['id'] for m in c['members']}
        then, later = [], []
        for t in threads:
            who = sorted({names[a] for w in t['works'] for a in str(w[2]).split(', ') if a in names})
            if len(who) < 2 or not t.get('y'):
                continue
            row = [t['id'], t['k'], t['name'], t.get('at', ''), t['y'], who]
            if c['y0'] - 3 <= t['y'] <= c['y1'] + 3:
                then.append(row)
            elif t['y'] > c['y1'] + 3:
                later.append(row)
        then.sort(key=lambda r: (-len(r[5]), r[4], r[0]))
        later.sort(key=lambda r: (-len(r[5]), r[4], r[0]))
        voices = collections.defaultdict(set)
        for name, pid in names.items():
            for wi in works_by_artist.get(name, []):
                for v in vo['w'].get(finding['w'][wi][0], []):
                    voices[v[0]].add(pid)
        vs = [[voice_rows[v][0], voice_rows[v][1], sorted(p)] for v, p in voices.items() if len(p) >= 2]
        vs.sort(key=lambda r: (-len(r[2]), r[1]))
        made = []
        for m in c['members']:
            name = people[m['id']]['name']
            for wi in works_by_artist.get(name, []):
                y = year(finding['w'][wi][3])
                if y and m['y0'] <= y <= m['y1']:
                    made.append([finding['w'][wi][0], m['id'], y])
        made.sort(key=lambda r: (r[2], r[0]))
        return then[:8], later[:6], vs[:8], made[:34], len(made)

    # ---- the walk: each member's dated places in those years, in time order
    by_artist_places = collections.defaultdict(list)
    for (pid, key), ys in pres.items():
        for y in ys:
            by_artist_places[pid].append((y, key))

    def walk(c):
        """The city at the movement's first year, where its artists came from before it, where else they
        were during it, and the city again at its last year."""
        first_of = {}
        for m in c['members']:
            for y, key in sorted(by_artist_places[m['id']]):
                if key != c['key'] and c['y0'] - 3 <= y <= c['y1']:
                    first_of.setdefault((key, m['id']), y)
        before = sorted([(y, key, pid) for (key, pid), y in first_of.items() if y < c['y0']])
        during = sorted([(y, key, pid) for (key, pid), y in first_of.items() if y >= c['y0']])
        out = [[key, y, pid] for y, key, pid in before[-4:]] + [[c['key'], c['y0'], '']]
        for y, key, pid in during:
            if out[-1][0] != key:
                out.append([key, y, pid])
        out = out[:12]
        if len(out) > 1 and out[-1][0] != c['key']:
            out.append([c['key'], c['y1'], ''])
        return out

    def place_name(c):
        """The place the evidence names for most of the members (an institution, or a town other than the
        city's own name), else the city."""
        names = collections.Counter()
        for m in c['members']:
            seen = set()
            for e in m['ev']:
                if c['y0'] - 2 <= e['y'][1] and e['y'][0] <= c['y1'] + 2:
                    nm = e['place'] if e['how'] == 'school' else ''
                    if nm and nm not in seen:
                        seen.add(nm)
                        names[nm] += 1
        if names:
            nm, n = sorted(names.items(), key=lambda kv: (-kv[1], kv[0]))[0]
            if n * 2 >= len(c['members']) and n >= MIN_ARTISTS:
                return nm
        return c['city']

    used = collections.Counter()
    rows = []
    for c in clusters:
        t = town_by[c['key']]
        city = t[1].split(',')[0]
        mid = re.sub(r'[^a-z0-9]+', '-', city.lower()).strip('-')
        base = 'mv-%s-%d' % (mid, c['y0'])
        used[base] += 1
        c['id'] = base if used[base] == 1 else base + '-' + str(used[base])
        c['city'] = city
        c['at'] = place_name(c)
        c['label'] = label(c)
        c['among'] = among(c)
        then, later, vs, made, nmade = contact(c)
        c['then'], c['later'], c['voices'], c['made'], c['nmade'] = then, later, vs, made, nmade
        c['walk'] = walk(c)
        c['weight'] = len(c['members']) * 10 + sum(len(r[5]) for r in then) * 3 + len(vs) + min(nmade, 20)
        rows.append(c)
    rows.sort(key=lambda c: (-c['weight'], c['y0'], c['id']))

    # ---- write: the artists, the movements, the cities' index, the relay rows
    born = {}
    for r in sorted(wd.get('born', []), key=lambda r: (r['a'], r['pl'])):
        ll = point(r.get('coord'))
        if ll and r['a'] not in born:
            born[r['a']] = [r.get('label', ''), round(ll[0], 4), round(ll[1], 4)]
    pids = sorted({p for p, _ in pres} | {m['id'] for c in rows for m in c['members']}, key=lambda p: (-people[p]['n'], p))
    pix = {p: i for i, p in enumerate(pids)}
    artists = [[p, clean_name(people[p]['name']), people[p]['q'] or '', people[p]['b'] or 0, people[p]['d'] or 0,
                people[p]['n'], 1 if p in lives else 0, born.get(people[p]['q']) or []] for p in pids]
    # Every presence, city by city: the artist, the years (runs), how, where (a point), what.
    here = collections.defaultdict(list)
    for (pid, key), ys in sorted(pres.items()):
        yl = sorted(ys)
        runs, a0 = [], yl[0]
        for i in range(1, len(yl) + 1):
            if i == len(yl) or yl[i] != yl[i - 1] + 1:
                runs.append((a0, yl[i - 1]))
                if i < len(yl):
                    a0 = yl[i]
        for y0, y1 in runs:
            evs = [e for y in range(y0, y1 + 1) for e in ys[y]]
            e = sorted(evs, key=lambda e: ({'studio': 0, 'school': 1, 'life': 2}[e['how']], e['src']))[0]
            ll = e.get('ll') or [town_by[key][3], town_by[key][4]]
            here[key].append([pix[pid], y0, y1, e['how'], round(ll[0], 4), round(ll[1], 4), e['place'] or '', e['what'] or '',
                              e.get('studio', -1)])
    here = {k: sorted(v, key=lambda r: (r[1], r[0])) for k, v in sorted(here.items())}
    birth = {}
    homes_path = os.path.join(V2, 'characters', 'homes.json')
    out_rows = []
    for c in rows:
        names = [surname(clean_name(people[m['id']]['name'])) for m in c['members']]      # most the movement first
        title = c['at'] + ', ' + (str(c['y0']) if c['y0'] == c['y1'] else '%d–%d' % (c['y0'], c['y1']))
        out_rows.append({
            'id': c['id'], 'key': c['key'], 'city': c['city'], 'at': c['at'] if c['at'] != c['city'] else '', 'y0': c['y0'], 'y1': c['y1'],
            'title': title, 'who': ', '.join(names[:4]) + (' …' if len(names) > 4 else ''),
            'label': c['label'] and {k: c['label'][k] for k in ('q', 'name', 'n', 'of', 'years', 'url')},
            'labelWho': c['label'] and [pix[p] for p in c['label']['who']],
            'among': c['among'],
            'members': [[pix[m['id']], m['y0'], m['y1'], m['all'][0], m['all'][1],
                         [[e['how'], e['y'][0], e['y'][1], e['what'], e['place'], e['src'], e['url']] +
                          ([e['studio']] if 'studio' in e else []) for e in m['ev'][:4]]] for m in c['members']],
            'then': [[r[0], r[1], r[2], r[3], r[4], [pix[names_id] for names_id in r[5]]] for r in c['then']],
            'later': [[r[0], r[1], r[2], r[3], r[4], [pix[x] for x in r[5]]] for r in c['later']],
            'voices': [[v[0], v[1], [pix[x] for x in v[2]]] for v in c['voices']],
            'made': [[w[0], pix[w[1]], w[2], finding['w'][work_ix[w[0]]][1], finding['w'][work_ix[w[0]]][4] or '']
                     for w in c['made']], 'nmade': c['nmade'],
            'walk': [[s[0], s[1], pix[s[2]] if s[2] else -1] for s in c['walk']],
            'w': c['weight'],
        })
    # then/later carry artist ids; fix them to indexes (names_id above is the id)
    by_city = collections.defaultdict(list)
    for i, r in enumerate(out_rows):
        by_city[r['key']].append(i)
    relay = [['m', r['id'], (r['label']['name'] + ' · ' if r['label'] else '') + r['title'], '', '', '', len(r['walk']),
              [[s[0], s[1], -1] for s in r['walk']]] for r in out_rows]
    out = {'note': NOTE, 'artists': artists, 'movements': out_rows,
           'cities': {k: v for k, v in sorted(by_city.items())}, 'here': here, 'relay': relay,
           'lifeAt': {k: sorted(v, key=lambda r: (r[2], r[0])) for k, v in sorted(life_at.items())}}
    with open(OUT, 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        f.write('\n')
    print('presences', len(pres), 'artists placed', len({p for p, _ in pres}), file=sys.stderr)
    print('movements', len(out_rows), 'in', len(by_city), 'cities; named', sum(1 for r in out_rows if r['label']),
          '; bytes', os.path.getsize(OUT), file=sys.stderr)
    for r in out_rows[:15]:
        print('%-26s %-28s %2d artists · %s%s · then %d, later %d, voices %d, made %d' % (
            r['title'], r['who'][:28], len(r['members']), ('[' + r['label']['name'] + ' %d/%d] ' % (r['label']['n'], r['label']['of'])) if r['label'] else '',
            ', '.join(artists[m[0]][1] for m in r['members'])[:120], len(r['then']), len(r['later']), len(r['voices']), r['nmade']))


if __name__ == '__main__':
    main()

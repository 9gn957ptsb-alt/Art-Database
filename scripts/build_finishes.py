#!/usr/bin/env python3
"""Write docs/v2/interiors/finishes.json: the paint of each museum's rooms, for the walk.

The artist, 10 Oct 2026: "I want the interior walls of all the museums to be [what] they are in
real life if you can find photos of the interiors, if not, just make it a [basic] white and make
the ceiling white as well which should actually look gray when considering shadows of interiors".

From scripts/finishes_hand.json alone (scripts/fetch_interior_photos.py: each museum's photographs of
its galleries on Wikimedia Commons as they were read — which show a gallery's walls as they are, their
paint, "white" or its colour, the era of the works on them, the room where a photograph names one — with
each photograph's page, author, licence and date). No network; the same bytes every run.

Per museum: its paints (the photographs' colours, alike ones as one, most seen first, each with how
many photographs show it and the eras of the works seen on it), the rooms a photograph names that its
interior file has, a sentence of how it is known, and the photographs (title, page, author, licence,
date): named in plain words, never copied. A museum with no photograph read is not in the file: the
walk paints it a gallery's white (walk-plan.js, "the paint").
"""
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'docs', 'v2')
HAND = os.path.join(ROOT, 'scripts', 'finishes_hand.json')
OUT = os.path.join(V2, 'interiors', 'finishes.json')
WHITE = '#f2f0eb'      # a gallery's white (walk-plan.js WHITE)
CEILING = '#f6f5f1'    # a ceiling's white (walk-plan.js CEILING)
ERAS = ['old', '19c', 'modern', 'now']
ERA_WORDS = {'old': 'works before 1800', '19c': 'the 1800s', 'modern': 'the 1900s to 1970', 'now': 'works since 1970'}
SAME = 12.0            # ΔE (CIE76) under which two photographs' paints are one paint


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexc(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v))) for v in c)


def lab(c):
    def lin(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in c)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return (116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z)))


def name(c):
    """A paint's name in plain words, from its lightness, chroma and hue."""
    L, a, b = lab(rgb(c))
    C, h = math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360
    if C < 6:
        return 'white' if L > 90 else 'pale grey' if L > 74 else 'grey' if L > 52 else 'dark grey' if L > 28 else 'black'
    if C < 14:
        # A grey with a tint: warm, green, blue or mauve.
        if L > 88:
            return 'off-white'
        tint = ('warm' if 20 <= h < 100 else 'green-' if h < 200 else 'blue-' if h < 300 else 'mauve-')
        grey = tint + ('grey' if tint.endswith('-') else ' grey')
        return ('pale ' if L > 72 else '' if L > 50 else 'dark ' if L > 28 else 'deep ') + grey
    if ((h < 34 or h >= 345) and C >= 28) or (h < 45 and C >= 55):
        return 'deep red' if L < 40 else 'pink' if L > 72 else 'red'
    if h < 52 and C >= 28 and 35 <= L <= 62:
        return 'terracotta'
    if h < 25 or h >= 345:
        return 'mauve' if L > 55 else 'brown'
    if h < 70:
        return 'brown' if L < 42 else 'beige' if C < 22 else 'ochre' if L < 70 else 'peach'
    if h < 105:
        return 'cream' if L > 80 else 'olive' if L < 55 else 'beige' if C < 22 else 'yellow'
    if h < 165:
        return 'dark green' if L < 40 else 'sage' if C < 20 else 'green'
    if h < 230:
        return 'dark teal' if L < 40 else 'blue-green'
    if h < 290:
        return 'navy' if L < 35 else 'blue'
    return 'aubergine' if L < 35 else 'mauve' if C < 22 else 'purple'


NUMBERED = re.compile(r'^(?:(?:west|east|main|ground|upper|lower)\s+)*(?:(?:main\s+)?floor\s+)?'
                      r'(?:gallery|galleries|room|rooms|sal|salle|sala|saal|zaal|hall)?\s*0*(\d+(?:\.\d+)?)[a-z]?$', re.I)


def number(s):
    m = NUMBERED.match(plain_room(s))
    return '#' + m.group(1) if m else None


def rooms_of(slug):
    """An interior file's rooms that a source names (never an arranged room: its "Room 3" is the site's
    own number), by id, name, the source's references and their gallery number."""
    p = os.path.join(V2, 'interiors', slug + '.json')
    if not os.path.exists(p):
        return {}
    d = json.load(open(p))
    out = {}
    for fl in d.get('floors', []):
        for r in fl.get('rooms', []):
            if r.get('sure') == 'arranged':
                continue
            for key in [r['id'], r.get('name')] + [str(x) for x in r.get('ref') or []]:
                if key:
                    out.setdefault(plain_room(key), r['id'])
                    if number(key):
                        out.setdefault(number(key), r['id'])
    return out


def room_id(ids, said):
    if not said:
        return None
    got = ids.get(plain_room(said))
    # "G18": a floor's letter and a gallery's number, as the NGA's ground floor is written (G-018).
    m = re.match(r'^(?:gallery\s+)?([A-Z])-?0*(\d+)$', plain_room(said), re.I)
    if not got and m:
        got = ids.get('%s-%03d' % (m.group(1).upper(), int(m.group(2)))) or ids.get('%s-%s' % (m.group(1).upper(), m.group(2)))
    return got or (ids.get(number(said)) if number(said) else None)


def plain_room(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()


# A photograph of a temporary exhibition shows its show's walls, not the museum's: used only where the
# museum has no other. One from before 2012 shows the walls as they were: used only where none is newer.
SHOWISH = re.compile(r'exhibition|tentoonstelling|ausstellung|exposition|exposici|esposizion|mostra|catwalk|biennale', re.I)
RECENT = 2012


def year_of(d):
    m = re.search(r'\b(19[5-9]\d|20[0-4]\d)\b', d or '')
    return int(m.group(1)) if m else None


def main():
    hand = json.load(open(HAND)) if os.path.exists(HAND) else {'museums': {}}
    museums = json.load(open(os.path.join(V2, 'museums.json')))['museums']
    out = {
        'note': ("The paint of each museum's rooms in the walk (walk-plan.js, \"the paint\"), as its galleries are "
                 "photographed on Wikimedia Commons: each photograph read for the colour its walls are painted (not "
                 "the light's cast), named here with its author and licence, never copied "
                 "(scripts/fetch_interior_photos.py, scripts/finishes_hand.json). A museum not listed has no photograph "
                 "of its galleries read: its walls are a gallery's white. Every ceiling is white. Written by "
                 "scripts/build_finishes.py."),
        'white': WHITE, 'ceiling': CEILING, 'museums': {},
    }
    nocredit = []
    for m in museums:
        slug = m['slug']
        row = hand.get('museums', {}).get(slug)
        if not row:
            continue
        used = []
        for p in row.get('photos', []):
            if not p.get('use') or not p.get('paint'):
                continue
            if not p.get('lic') or not p.get('u'):
                nocredit.append(slug + ': ' + p.get('t', '?'))
                continue
            used.append(p)
        # The walls as they are now, and the museum's own, before a show's.
        if any((year_of(p.get('d')) or RECENT) >= RECENT for p in used):
            used = [p for p in used if (year_of(p.get('d')) or RECENT) >= RECENT]
        own = [p for p in used if not SHOWISH.search((p.get('cat') or '') + ' ' + p.get('t', ''))]
        if own:
            used = own
        if not used:
            continue
        ids = rooms_of(slug)
        clusters, rooms, src = [], {}, []
        for p in used:
            c = WHITE if p['paint'] == 'white' else p['paint'].lower()
            era = p.get('art') if p.get('art') in ERAS else None
            room = room_id(ids, p.get('room'))
            if room:
                rooms.setdefault(room, []).append(c)
            L = lab(rgb(c))
            for k in clusters:
                if math.dist(L, k['lab']) < SAME:
                    k['members'].append(c)
                    if era:
                        k['era'].add(era)
                    break
            else:
                clusters.append({'lab': L, 'members': [c], 'era': {era} if era else set()})
            y = year_of(p.get('d'))
            src.append({'t': p['t'], 'u': p['u'], 'by': p.get('by') or 'not named', 'lic': p['lic'],
                        'd': str(y) if y else '', 'c': c, **({'room': plain_room(p['room'])} if p.get('room') else {})})
        paints = []
        for k in sorted(clusters, key=lambda k: (-len(k['members']),
                                                 0 if all(name(c) in ('white', 'off-white') for c in k['members']) else 1)):
            # The paint of the group: the member nearest the others in Lab; white kept exactly white.
            if all(name(c) in ('white', 'off-white') for c in k['members']):
                c = WHITE
            else:
                labs = [lab(rgb(c)) for c in k['members']]
                c = min(k['members'], key=lambda c: sum(math.dist(lab(rgb(c)), o) for o in labs))
            paints.append({'c': c, 'w': name(c), 'n': len(k['members']), 'era': [e for e in ERAS if e in k['era']]})
        words = []
        for p in paints:
            w = '%s (%d)' % (p['w'], p['n'])
            if len(paints) > 1 and p['era']:
                w = '%s (%d, over %s)' % (p['w'], p['n'], ' and '.join(ERA_WORDS[e] for e in p['era']))
            words.append(w)
        said = ('Its walls as its galleries are photographed: ' + ', '.join(words) + '. Wikimedia Commons, ' +
                ('%d photographs' % len(src) if len(src) != 1 else 'one photograph') + '.')
        entry = {'paints': paints, 'said': said, 'src': src, 'read': row.get('read')}
        if rooms:
            entry['rooms'] = {r: {'c': cs[0], 'w': name(cs[0])} for r, cs in sorted(rooms.items())}
        out['museums'][slug] = entry
    text = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    with open(OUT, 'w') as fh:
        fh.write(text + '\n')
    print('%d museums painted as photographed, %d white; %d rooms by their own photograph; %d KB' % (
        len(out['museums']), len(museums) - len(out['museums']),
        sum(len(e.get('rooms', {})) for e in out['museums'].values()), len(text) // 1024))
    if nocredit:
        print('used but with no credit read (fetch_interior_photos.py --only credit hand):', len(nocredit),
              nocredit[:5], file=sys.stderr)


if __name__ == '__main__':
    main()

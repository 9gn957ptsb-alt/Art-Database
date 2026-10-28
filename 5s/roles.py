#!/usr/bin/env python3
"""What each deck card is, and its relation to setting up a space: data/5s/roles.json.

The artist, 27 Oct 2026 (CONCEPT.md): "identify what the object is in, see its relation to setting up
a space in seeing things as rooms." A kept interior is the room; everything else is hung, laid, stood,
set or lit in it, or seen through its window.

roles.json is git-ignored data judged by eye from the deck's pictures, as composition_tags.json is. It
is keyed by work slug, then kind (a bookmark's space and surface share a slug). Each entry is
{"role": [one or two of ROLES, the first is where it goes], "what": "a pendant lamp"}, and an interior
may carry its marked "room". build_deck.py copies them onto the cards of the git-ignored deck.

A structure is an interior (first role "room": it can be the room) or a building seen from outside
(role "building", alone: it stays the view through the window, as a Space is today).

This script keeps the file whole against a built deck. It adds the cards a rule judges as well as an
eye (images, colours, Artsy pictures of places and painted surfaces, by category), never changes an
entry that is there, checks every entry, and lists the cards still to judge by eye (objects,
bookmarks, and spaces that may be rooms). It writes nothing while any entry fails a check.

Usage:  python3 5s/roles.py [--deck 5s/dist/deck.json] [--roles data/5s/roles.json]
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROLES = ('room', 'building', 'walls', 'floor', 'textile', 'art', 'view', 'opening',
         'furniture', 'thing', 'plant', 'light', 'ceiling')
KIND_ROLES = {'colour': {'walls', 'light'}, 'surface': {'floor', 'walls'}}   # a paint or a light; laid on a floor or a wall
WHAT_MAX = 40
CAT = {'Painting': 'a painting', 'Print': 'a print', 'Photography': 'a photograph', 'Posters': 'a poster',
       'Drawing, Collage or other Work on Paper': 'a work on paper', 'Mixed Media': 'a mixed-media work',
       'Sculpture': 'a sculpture', 'Design/Decorative Art': 'a piece of design', 'Textile Arts': 'a textile',
       'Installation': 'an installation', 'Fashion Design and Wearable Art': 'a piece of fashion',
       'Jewelry': 'a piece of jewellery'}
SURFACE = {'Painting': 'a painted surface', 'Print': 'a printed surface', 'Mixed Media': 'a mixed-media surface',
           'Drawing, Collage or other Work on Paper': 'marks on paper', 'Textile Arts': 'a woven surface'}
VIEW = {'landscapes', 'waterscapes', 'cityscapes', 'atmospheric-landscapes', 'city-scenes'}


def by_rule(c):
    """The entry a rule gives a card, or None when it needs an eye."""
    k, cat = c['kind'], c.get('category')
    if c.get('source', 'Artsy') != 'Artsy' or k == 'object':
        return None
    if k == 'colour':
        return {'role': ['walls', 'light']}            # no what: the page names its colours
    if k == 'image':
        return {'role': ['art'], 'what': CAT.get(cat, 'a picture')}
    if k == 'space':
        if cat in ('Architecture', 'Installation') or 'interiors' in c.get('genes', ()):
            return None                                # it may be a room: by eye
        return {'role': ['art', 'view'] if VIEW & set(c.get('genes', ())) else ['art'], 'what': CAT.get(cat, 'a picture')}
    if k == 'surface' and cat in SURFACE:
        return {'role': ['walls'], 'what': SURFACE[cat]}
    return None


def problems(kind, e):
    """What is wrong with one entry, as short lines (none when it is right)."""
    role, what, out = e.get('role'), e.get('what'), []
    if not (isinstance(role, list) and 1 <= len(role) <= 2 and len(set(role)) == len(role) and all(r in ROLES for r in role)):
        return [f'role {role!r}: one or two of {", ".join(ROLES)}']
    if kind in KIND_ROLES and not set(role) <= KIND_ROLES[kind]:
        out.append(f'a {kind} takes only {" or ".join(sorted(KIND_ROLES[kind]))}')
    if {'room', 'building'} & set(role[1:]) or (role[0] in ('room', 'building') and kind != 'space'):
        out.append('room and building are first roles of a space only')
    if role[0] == 'building' and len(role) > 1:
        out.append('a building seen from outside has one role')
    if what is None and kind != 'colour':
        out.append('no what')
    if what is not None and not (isinstance(what, str) and 0 < len(what) <= WHAT_MAX and what == what.strip()
                                 and '\n' not in what and what[0].islower()):
        out.append(f'what {what!r}: one line, lower case first, at most {WHAT_MAX} characters')
    if 'textile' in role and 'floor' not in role and {'rug', 'carpet', 'mat'} & set(str(what).split()):
        out.append('a rug is laid: add floor')
    if 'room' in e and (role[0] != 'room' or not isinstance(e['room'], dict)):
        out.append('a marked room belongs to an interior')
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--deck', default=str(ROOT / '5s' / 'dist' / 'deck.json'))
    ap.add_argument('--roles', default=str(ROOT / 'data' / '5s' / 'roles.json'))
    a = ap.parse_args()
    cards = json.loads(Path(a.deck).read_text())['cards']
    path = Path(a.roles)
    have = json.loads(path.read_text())['cards'] if path.exists() else {}
    out, added, by_eye, bad = {}, [], [], []
    for c in cards:
        e = have.get(c['work'], {}).get(c['kind'])
        if e is None:
            e = by_rule(c)
            if e is None:
                by_eye.append(c['id'])
                continue
            added.append(c['id'])
        bad += [f"{c['id']} {c['kind']}: {p}" for p in problems(c['kind'], e)]
        out.setdefault(c['work'], {})[c['kind']] = e
    seen = {(c['work'], c['kind']) for c in cards}
    orphans = sorted((w, k) for w, ks in have.items() for k in ks if (w, k) not in seen)
    for w, k in orphans:                               # kept: a card that left the deck may come back
        out.setdefault(w, {})[k] = have[w][k]
    if bad:
        print('roles: not written, fix these first:', *bad, sep='\n  ')
        sys.exit(1)
    path.write_text(json.dumps({'version': 1, 'cards': out}, indent=1, ensure_ascii=False) + '\n')
    first = Counter(out[c['work']][c['kind']]['role'][0] for c in cards if c['kind'] in out.get(c['work'], {}))
    print(f'roles: {len(cards) - len(by_eye)} of {len(cards)} cards in {path}: {first["room"]} interiors (rooms), '
          f'{first["building"]} buildings seen from outside; first roles {dict(first.most_common())}')
    print(f'roles: {len(added)} added by rule' + (f': {" ".join(added)}' if added and len(added) <= 40 else ''))
    if by_eye:
        print(f'roles: {len(by_eye)} to judge by eye (look at the picture, then write its entry): {" ".join(by_eye)}')
    if orphans:
        print(f'roles: {len(orphans)} entries for cards not in this deck, kept: {", ".join(f"{w} {k}" for w, k in orphans)}')


if __name__ == '__main__':
    main()

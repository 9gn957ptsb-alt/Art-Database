"""The artist's whole planet (museums.json via cityplaces.json: cities -> museums -> works -> 4 details) by the rule."""
import json, collections, time, math, pickle
import ladder as LD, info as I
for with_details in (False, True):
    t = I.full_planet()
    if not with_details:
        for c in t['parts']:
            for p in c['parts']:
                for w in p['parts']: w['parts'] = []
    # cities without museums hold nothing: they are not laid in (a node holding nothing has no weight)
    t['parts'] = [c for c in t['parts'] if c['parts'] and any(p['parts'] for p in c['parts'])]
    for c in t['parts']:
        c['parts'] = [p for p in c['parts'] if p['parts']]
    t0 = time.time(); lay = LD.layout(t); dt = time.time() - t0
    K = lay['K']
    kinds = collections.defaultdict(collections.Counter)
    for f in lay['frames']:
        kinds[f.kind][f.m] += 1
    res = dict(K=K, planet_outline_u=LD.F(K + 4), planet_outline_blocks=round(LD.F(K + 4) / 8, 1),
               cities=len(t['parts']), places=sum(len(c['parts']) for c in t['parts']),
               works=sum(len(p['parts']) for c in t['parts'] for p in c['parts']),
               leaves=len(lay['leaves']), joins=lay['joins'], openings_used=lay['openings_used'],
               levels_by_kind={k: dict(sorted(v.items(), reverse=True)) for k, v in kinds.items()}, seconds=round(dt, 1))
    big = sorted([f for f in lay['frames'] if f.kind == 'city'], key=lambda f: -f.m)
    res['cities_by_level'] = [(f.info['key'], f.m, f.path) for f in big]
    print(json.dumps({k: v for k, v in res.items()}, indent=None)[:3000]); print()
    json.dump(res, open('q_planet_%s.json' % ('details' if with_details else 'works'), 'w'), indent=1)
    if not with_details:
        pickle.dump([(f.ab.tolist(), f.m, f.inv, f.path, f.info.get('key'), f.kind) for f in lay['frames']], open('planet_works_frames.pkl', 'wb'))

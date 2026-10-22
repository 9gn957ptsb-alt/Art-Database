import json, ladder as LD, q_rules as Q
out = json.load(open('q_rules2.json'))
for name, mk in Q.cases.items():
    LD.RECORDS = True
    lay = LD.layout(mk())
    s = Q.stats(lay)
    s['openings_hold'] = sorted({str(f.info.get('kind')) for f in lay['frames'] if f.path.endswith('G')})
    s['max_openings_in_a_path'] = max(f.path.count('G') for f in lay['frames'])
    out[name]['D records (odd: record in the opening; even: record as a part)'] = s
    print(name, s)
json.dump(out, open('q_rules3.json', 'w'), indent=1)

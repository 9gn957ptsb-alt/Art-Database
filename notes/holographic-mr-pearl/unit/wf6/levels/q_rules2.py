import json, importlib, ladder as LD, q_rules as Q
out = {}
for name, mk in Q.cases.items():
    out[name] = {}
    for rule, flag in (('A huffman (pair = fill + opening)', False), ('C huffman (pair + its own record)', True)):
        LD.PAIR_RECORD = flag
        out[name][rule] = Q.stats(LD.layout(mk()))
    print(name); [print('   ', r, s) for r, s in out[name].items()]
out['B split (top-down)'] = {k: v['B split'] for k, v in json.load(open('q_rules.json')).items()}
json.dump(out, open('q_rules2.json', 'w'), indent=1)

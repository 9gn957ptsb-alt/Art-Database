"""The toy information tree by rule D (ladder.layout, RECORDS): a planet of 3 cities of 3 places of 3 works of 4
details; each node's own record in its opening (odd counts) or as one more part (even)."""
import json, colorsys, numpy as np
from PIL import Image, ImageDraw
import nest as N, ladder as LD, info as I, r_ladder as R
F16 = R.font(16)
HUE = {'New York': (214, 69, 46), 'Paris': (46, 104, 196), 'Amsterdam': (222, 168, 32)}
REC = (40, 150, 140)
def run(with_details, W=1150):
    tree = I.toy(3)
    if not with_details:
        for c in tree['parts']:
            for p in c['parts']:
                for w in p['parts']: w['parts'] = []
    LD.RECORDS = True
    lay = LD.layout(tree); K = lay['K']; leaves = lay['leaves']
    # each leaf's city and place: walk up its frame path through the frames list
    city_of, place_of = {}, {}
    for f in lay['frames']:
        if f.kind == 'city': city_of[f.path] = f.info['key']
        if f.kind == 'place': place_of[f.path] = f.info['key']
    order = {c['key']: [p['key'] for p in c['parts']] for c in tree['parts']}
    def anc(path, table):
        best = None
        for k, v in table.items():
            if path.startswith(k) and (best is None or len(k) > len(best[0])): best = (k, v)
        return best[1] if best else None
    prm = R.prims_of(leaves)
    ext = LD.F(K + 4) / 8 * 1.32
    O, D = N.lv.drawing_rays(-ext, ext, -ext * 0.75, ext * 1.08, W)
    tone, idx = N.lv.cast(prm, O, D, want_level=True)
    img = N.picture(tone, idx); f = img.astype(float)
    for i, fr in enumerate(leaves):
        m = (idx == i) & (tone >= 0)
        if not m.any(): continue
        c = anc(fr.path, city_of); p = anc(fr.path, place_of)
        if fr.kind == 'record' and fr.path.endswith('G'):
            col = np.array(REC, float)
        elif c is None:
            col = np.array(REC, float)
        else:
            base = np.array(HUE[c], float) / 255; k = order[c].index(p) if p in order[c] else 0
            h, s, v = colorsys.rgb_to_hsv(*base); col = np.array(colorsys.hsv_to_rgb(h, s * (1 - 0.3 * k), min(1, v * (1 + 0.15 * k)))) * 255
        f[m] = np.round((f[m] + col) / 2)
    im = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im); h = tone.shape[0]
    kinds = {}
    for fr in lay['frames']: kinds.setdefault(fr.kind, set()).add(fr.m)
    lines = ['rule D: planet level %d (outline %d u = %.1f drawings across); the smallest leaf is level 2 (the drawing, one block)' % (K, LD.F(K + 4), LD.F(K + 4) / 8),
             'levels: ' + '; '.join('%s %s' % (k, sorted(v, reverse=True)) for k, v in kinds.items() if k),
             'teal = a node\'s own record in its opening (odd counts); films: city hue, place shade (Middling mean of face and film)']
    for j, t in enumerate(lines): d.text((10, h - 22 * (len(lines) - j) - 6), t, fill=(0, 0, 0), font=F16)
    name = 'details' if with_details else 'works'
    im.save('tree3_%s_levels.png' % name); Image.fromarray(img).save('tree3_%s_drawing.png' % name)
    return dict(K=K, leaves=len(leaves), openings_used=lay['openings_used'], joins=lay['joins'], levels_by_kind={k: sorted(v, reverse=True) for k, v in kinds.items()},
                frames=[dict(key=fr.info.get('key'), kind=fr.kind, level=fr.m, path=fr.path, inverted=fr.inv, ab=[round(float(x), 5) for x in fr.ab],
                             scale_of_drawing=LD.F(fr.m + 4) / 8) for fr in lay['frames']])
out = {n: run(w) for n, w in (('works', False), ('details', True))}
for n, v in out.items(): print(n, {k: v[k] for k in ('K', 'leaves', 'openings_used', 'joins', 'levels_by_kind')})
json.dump(out, open('r_tree3.json', 'w'), indent=1)

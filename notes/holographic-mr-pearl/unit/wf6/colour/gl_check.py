"""unit.glsl in Chromium (WebGL2): build a harness that renders the six bars as films with unitColour + UnitStack,
from the drawing's eye and turned, and compare it pixel by pixel with the numpy reference (films.py layers, VS tone
or the P-F film facets, the recursive Average). Usage: python3 gl_check.py build | compare"""
import base64, json, math, sys
import numpy as np
sys.path.insert(0, '.')
from common import *
from obb import layers as obb_layers
from films import unit_boxes, mix
from film_designs import face_colour
from pearl_final import DesignF
from tone_rule import rule

SZ = 240
allc = np.array([b['c'] for b in unit_boxes()]); C0 = (allc.min(0) + allc.max(0)) / 2
VIEWS = [dict(name="drawing's eye, holo 0", d=-np.ones(3), up=[0, -1, 1], c=CENTRE, span=3.0, holo=0.0, pair=0),
         dict(name="drawing's eye, holo 1", d=-np.ones(3), up=[0, -1, 1], c=CENTRE, span=3.0, holo=1.0, pair=0),
         dict(name="drawing's eye, Cezanne pair", d=-np.ones(3), up=[0, -1, 1], c=CENTRE, span=3.0, holo=0.0, pair=1),
         dict(name='az 15 el 35, holo 0', d=-az_el(15, 35), up=[0, 0, 1], c=C0, span=3.6, holo=0.0, pair=0),
         dict(name='az 15 el 35, holo 1', d=-az_el(15, 35), up=[0, 0, 1], c=C0, span=3.6, holo=1.0, pair=0),
         dict(name='az 75 el 35, holo 1', d=-az_el(75, 35), up=[0, 0, 1], c=C0, span=3.6, holo=1.0, pair=0),
         dict(name='az 45 el 70, holo 1', d=-az_el(45, 70), up=[0, 0, 1], c=C0, span=3.6, holo=1.0, pair=0),
         dict(name='az 200 el -25, holo 1', d=-az_el(200, -25), up=[0, 0, 1], c=C0, span=3.6, holo=1.0, pair=0)]
GROUND = np.array([0.93, 0.94, 0.95])
PAIR = (np.array([3, 26, 81]) / 255, np.array([252, 229, 174]) / 255)


def reference(V, des):
    O, D = ortho_rays(V['d'], V['up'], V['c'], V['span'], (SZ, SZ))
    L = obb_layers(unit_boxes(), O, D, K=4)
    v = -D
    cols = np.full(L['nin'].shape, np.nan)
    for k in range(4):
        if V['holo'] > 0:
            c = face_colour(des, L['nin'][k], v)
        else:
            t = rule('VS', L['nin'][k], v)                      # 0 black .. 1 white, grey 128/255
            if V['pair']:
                # tones by family mixed between the pair: x -> Average(dark, light), y -> dark, z -> light
                w = np.maximum(L['nin'][k] * v, 0); w = w / np.maximum(w.sum(-1, keepdims=True), 1e-12)
                fam = np.stack([np.floor((PAIR[0] + PAIR[1]) / 2 * 255 + 0.5) / 255, PAIR[0], PAIR[1]])
                c = w @ fam
            else:
                c = np.repeat(t[..., None], 3, -1)
        cols[k] = np.where((L['n'] > k)[..., None], c, np.nan)
    m = mix(cols, L['n'], 'recursive')
    return np.where(np.isnan(m), GROUND, m), L['n']


def build():
    src = open(OUT + 'unit.glsl').read()
    boxes = [(b['c'] - np.diag(b['E']), b['c'] + np.diag(b['E'])) for b in unit_boxes()]
    lo = ','.join('vec3(%.9f,%.9f,%.9f)' % tuple(b[0]) for b in boxes)
    hi = ','.join('vec3(%.9f,%.9f,%.9f)' % tuple(b[1]) for b in boxes)
    fs = """#version 300 es
precision highp float; precision highp int;
out vec4 o;
uniform vec3 uO, uR, uU, uD; uniform float uSpan, uHolo; uniform int uPair, uMode; uniform vec2 uSize;
""" + src + """
const vec3 BLO[6] = vec3[6](""" + lo + """);
const vec3 BHI[6] = vec3[6](""" + hi + """);
void main() {
    vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);          // pixel centres, row 0 at the top
    float sx = (p.x / uSize.x - 0.5) * uSpan, sy = (0.5 - p.y / uSize.y) * uSpan * uSize.y / uSize.x;
    vec3 O = uO + sx * uR + sy * uU - uD * 40.0, D = uD;
    float tn[6], tf[6]; vec3 nn[6];
    for (int i = 0; i < 6; i++) {
        vec3 inv = 1.0 / D;
        vec3 t0 = (BLO[i] - O) * inv, t1 = (BHI[i] - O) * inv;
        vec3 a = min(t0, t1), b = max(t0, t1);
        float en = max(max(a.x, a.y), a.z), ex = min(min(b.x, b.y), b.z);
        vec3 n = a.x >= a.y && a.x >= a.z ? vec3(-sign(D.x), 0, 0) : (a.y >= a.z ? vec3(0, -sign(D.y), 0) : vec3(0, 0, -sign(D.z)));
        bool hit = en <= ex && ex > 0.0;
        tn[i] = hit ? en : 1e9; tf[i] = hit ? ex : 1e9; nn[i] = n;
    }
    // sort by entry, merge touching or overlapping intervals into one solid: each solid crossed is a film
    for (int i = 0; i < 6; i++) for (int j = 0; j < 5; j++) if (tn[j] > tn[j + 1]) {
        float a = tn[j]; tn[j] = tn[j + 1]; tn[j + 1] = a; a = tf[j]; tf[j] = tf[j + 1]; tf[j + 1] = a;
        vec3 c = nn[j]; nn[j] = nn[j + 1]; nn[j + 1] = c; }
    vec3 v = -D;
    vec3 dark = uPair == 1 ? UNIT_DARK_CEZANNE : UNIT_DARK, light = uPair == 1 ? UNIT_LIGHT_CEZANNE : UNIT_LIGHT;
    UnitStack s = unitStackBegin();
    float end = -1e9;
    for (int i = 0; i < 6; i++) {
        if (tn[i] > 1e8) break;
        if (tn[i] <= end + 1e-7) { end = max(end, tf[i]); continue; }
        vec4 c = unitColourPair(nn[i], v, UNIT_LIGHT_D, s.n, uHolo, 100.0, vec3(0.5), dark, light);
        unitStackAdd(s, c.rgb);
        end = tf[i];
        if (unitStackSolid(s)) break;
    }
    vec3 col = unitStackEnd(s, vec3(0.93, 0.94, 0.95));
    if (uMode == 1) col = unitBulk(normalize(vec3(1.0)), UNIT_LIGHT_D, uHolo, dark, light);
    o = vec4(col, 1.0);
}"""
    views = []
    for V in VIEWS:
        d, u, r = basis(V['d'], V['up'])
        views.append(dict(name=V['name'], O=list(map(float, V['c'])), R=list(map(float, r)), U=list(map(float, u)), D=list(map(float, d)),
                          span=V['span'], holo=V['holo'], pair=V['pair']))
    html = """<!doctype html><html><head><meta charset="utf-8"></head><body><canvas id="c" width="%d" height="%d"></canvas><script>
const FS = %s; const VIEWS = %s;
const VS = "#version 300 es\\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
const cv = document.getElementById('c'); const gl = cv.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false});
const out = {webgl2: !!gl, views: []};
function sh(t, s) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); out.log = (out.log || '') + (gl.getShaderInfoLog(x) || ''); out.compiled = (out.compiled === undefined ? true : out.compiled) && gl.getShaderParameter(x, gl.COMPILE_STATUS); return x; }
if (gl) {
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  out.linked = gl.getProgramParameter(pr, gl.LINK_STATUS); out.linklog = gl.getProgramInfoLog(pr);
  out.renderer = gl.getParameter(gl.RENDERER);
  if (out.linked) {
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const runs = VIEWS.map(v => Object.assign({mode: 0}, v)).concat([Object.assign({}, VIEWS[0], {name: 'bulk grey', mode: 1}), Object.assign({}, VIEWS[2], {name: 'bulk pair', mode: 1}), Object.assign({}, VIEWS[1], {name: 'bulk holo', mode: 1})]);
    for (const v of runs) {
      gl.uniform3fv(U('uO'), v.O); gl.uniform3fv(U('uR'), v.R); gl.uniform3fv(U('uU'), v.U); gl.uniform3fv(U('uD'), v.D);
      gl.uniform1f(U('uSpan'), v.span); gl.uniform1f(U('uHolo'), v.holo); gl.uniform1i(U('uPair'), v.pair); gl.uniform1i(U('uMode'), v.mode);
      gl.uniform2f(U('uSize'), %d, %d);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Uint8Array(%d * %d * 4); gl.readPixels(0, 0, %d, %d, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let s = ''; for (let i = 0; i < px.length; i += 8192) s += String.fromCharCode.apply(null, px.subarray(i, i + 8192));
      out.views.push({name: v.name, px: btoa(s)});
    }
  }
}
window.RESULT = out;
</script></body></html>""" % (SZ, SZ, json.dumps(fs), json.dumps(views), SZ, SZ, SZ, SZ, SZ, SZ)
    open(OUT + 'gl_harness.html', 'w').write(html)
    open(OUT + 'gl_shoot.js', 'w').write("""const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const p = await b.newPage();
  p.on('console', m => console.log('console:', m.text()));
  await p.goto('file://' + process.argv[2]);
  await p.waitForFunction(() => window.RESULT !== undefined, null, {timeout: 120000});
  const r = await p.evaluate(() => window.RESULT);
  require('fs').writeFileSync(process.argv[3], JSON.stringify(r));
  console.log(JSON.stringify({webgl2: r.webgl2, compiled: r.compiled, linked: r.linked, log: r.log, linklog: r.linklog, renderer: r.renderer, n: r.views.length}));
  await b.close();
})();
""")
    print('built')


def compare():
    r = json.load(open(OUT + 'gl_result.json'))
    des = DesignF(d=253.2)
    res = dict(webgl2=r['webgl2'], compiled=r['compiled'], linked=r['linked'], renderer=r.get('renderer'), log=r.get('log'), views={})
    tiles = []
    gl_imgs = {}
    for V, g in zip(VIEWS + [None] * 3, r['views']):
        a = np.frombuffer(base64.b64decode(g['px']), np.uint8).reshape(SZ, SZ, 4)[::-1, :, :3].astype(float)
        gl_imgs[g['name']] = a
        if V is None:
            res['views'][g['name']] = dict(rgb=[int(x) for x in a[SZ // 2, SZ // 2]])
            print(g['name'], a[SZ // 2, SZ // 2])
            continue
        ref, n = reference(V, des)
        ref8 = np.round(ref * 255)
        dif = np.abs(a - ref8).max(-1)
        fig = n > 0
        res['views'][g['name']] = dict(mean=float(dif[fig].mean()), p99=float(np.percentile(dif[fig], 99)), max=float(dif.max()),
                                       share_le2=float((dif[fig] <= 2).mean()), colours=len(np.unique(a[fig].reshape(-1, 3), axis=0)))
        print(g['name'], res['views'][g['name']])
        t = to_img(a / 255); label(t, 'WebGL2 unit.glsl: ' + g['name'], sz=10); tiles.append(t)
        t = to_img(ref); label(t, 'numpy reference', sz=10); tiles.append(t)
    a0, a1 = gl_imgs["drawing's eye, holo 0"], gl_imgs["drawing's eye, holo 1"]
    res['drawing_eye_holo1_vs_holo0_maxdiff'] = float(np.abs(a0 - a1).max())
    res['drawing_eye_holo1_vs_holo0_px_differ'] = int((np.abs(a0 - a1).max(-1) > 0).sum())
    print('holo1 vs holo0 from the drawing eye: max', res['drawing_eye_holo1_vs_holo0_maxdiff'], 'px', res['drawing_eye_holo1_vs_holo0_px_differ'])
    # the colours the GL drawing's eye makes
    fig = (np.abs(a0 - np.round(GROUND * 255)).max(-1) > 0)
    u, cnt = np.unique(a0[fig].reshape(-1, 3), axis=0, return_counts=True)
    res['drawing_eye_colours'] = {hx(c / 255): int(k) for c, k in zip(u, cnt) if k > 20}
    a2 = gl_imgs["drawing's eye, Cezanne pair"]
    u, cnt = np.unique(a2[fig].reshape(-1, 3), axis=0, return_counts=True)
    res['drawing_eye_pair_colours'] = {hx(c / 255): int(k) for c, k in zip(u, cnt) if k > 20}
    print(res['drawing_eye_colours'], res['drawing_eye_pair_colours'])
    json.dump(res, open(OUT + 'gl_check.json', 'w'), indent=1)
    grid(tiles, 4, pad=4).save(OUT + 'E1_webgl_vs_numpy.png')


if __name__ == '__main__':
    build() if sys.argv[1] == 'build' else compare()

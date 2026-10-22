"""Unit tests of unit.glsl functions the study's harness never exercised: the facade close (barPx), unitSweptNormal,
deep stacks (9 films) against the stated per-film rounding rule, unitBulk off the crux, VS on a turned normal.
Usage: python3 gl_unit.py build [glsl] | compare"""
import json, sys, math, numpy as np, subprocess, base64, os
HERE = os.path.dirname(os.path.abspath(__file__)) + '/'
GLSL = sys.argv[2] if len(sys.argv) > 2 else HERE + '../colour/unit.glsl'
rng = np.random.default_rng(3)
STACKS = rng.integers(0, 256, (40, 9, 3))
BARPX = [100, 8, 6, 5, 4.5, 4, 3.64, 2]
CM = np.array([0.2, 0.4, 0.6])
def cases_glsl():
    out = []
    for b in BARPX:
        out.append('unitColour(vec3(1,0,0), normalize(vec3(1)), UNIT_LIGHT_D, 0, 0.0, %.4f, vec3(0.2,0.4,0.6)).rgb' % b)
    for f in range(3):
        out.append('unitSweptNormal(%d, normalize(vec3(-0.3,0.5,-0.8))) * 0.5 + 0.5' % f)
    out.append('unitBulk(normalize(vec3(1,2,3)), UNIT_LIGHT_D, 0.0, UNIT_DARK, UNIT_LIGHT)')
    out.append('unitColour(normalize(vec3(1,1,0)), normalize(vec3(1,0.2,0.5)), UNIT_LIGHT_D, 0, 0.0, 100.0, vec3(0)).rgb')
    out.append('unitColour(normalize(vec3(-1,1,1)), normalize(vec3(1,1,1)), UNIT_LIGHT_D, 0, 0.0, 100.0, vec3(0)).rgb')
    return out
def expected():
    ex = []
    for b in BARPX:
        x = 1 / b; t = min(max((x - 0.125) / 0.15, 0), 1); k = t * t * (3 - 2 * t)
        c = (1 - k) * 128 / 255 + k * CM; ex.append(np.floor(c * 255 + 0.5))
    v = np.array([-0.3, 0.5, -0.8]); v /= np.linalg.norm(v)
    for f in range(3):
        e = np.eye(3)[f] * np.sign(v[f]); ex.append(np.floor((e * 0.5 + 0.5) * 255 + 0.5))
    v = np.array([1, 2, 3.]); v /= np.linalg.norm(v); T = np.array([128, 0, 255.])
    ex.append(np.full(3, np.floor((np.abs(v) @ T) / np.abs(v).sum() + 0.5)))
    n = np.array([1, 1, 0.]) / math.sqrt(2); v = np.array([1, .2, .5]); v /= np.linalg.norm(v); w = np.maximum(n * v, 0)
    ex.append(np.full(3, np.floor((w @ T) / w.sum() + 0.5)))
    n = np.array([-1, 1, 1.]) / math.sqrt(3); v = np.ones(3) / math.sqrt(3); w = np.maximum(n * v, 0)
    ex.append(np.full(3, np.floor((w @ T) / w.sum() + 0.5)))
    stk = []
    for s in STACKS:
        acc = s[-1].astype(float)
        for j in range(7, -1, -1): acc = np.floor((s[j] + acc) / 2 + 0.5)
        stk.append(acc)
    return np.array(ex), np.array(stk)
def build():
    src = open(GLSL).read()
    cs = cases_glsl(); NC = len(cs)
    sel = '\n'.join('    if (i == %d) c = %s;' % (k, e) for k, e in enumerate(cs))
    stk = ','.join('vec3(%d,%d,%d)' % tuple(c) for s in STACKS for c in s)
    fs = """#version 300 es
precision highp float; precision highp int;
out vec4 o;
""" + src + """
const vec3 STK[%d] = vec3[%d](%s);
void main() {
  int i = int(gl_FragCoord.x); int row = int(gl_FragCoord.y);
  vec3 c = vec3(0);
  if (row == 0) {
%s
  } else {
    if (i < %d) {
      UnitStack s = unitStackBegin();
      for (int j = 0; j < 9; j++) unitStackAdd(s, STK[i * 9 + j] / 255.0);
      c = unitStackEnd(s, vec3(0));
    }
  }
  o = vec4(c, 1.0);
}""" % (STACKS.shape[0] * 9, STACKS.shape[0] * 9, stk, sel, STACKS.shape[0])
    W = max(NC, STACKS.shape[0])
    html = """<!doctype html><html><body><canvas id=c width=%d height=2></canvas><script>
const FS=%s; const VS="#version 300 es\\nin vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }";
const gl=document.getElementById('c').getContext('webgl2',{preserveDrawingBuffer:true,antialias:false}); const out={webgl2:!!gl};
function sh(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);out.log=(out.log||'')+(gl.getShaderInfoLog(x)||'');out.compiled=(out.compiled===undefined?true:out.compiled)&&gl.getShaderParameter(x,gl.COMPILE_STATUS);return x;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);out.linked=gl.getProgramParameter(pr,gl.LINK_STATUS);
if(out.linked){gl.useProgram(pr);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const l=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3);
const px=new Uint8Array(%d*2*4);gl.readPixels(0,0,%d,2,gl.RGBA,gl.UNSIGNED_BYTE,px);out.px=Array.from(px);}
window.RESULT=out;</script></body></html>""" % (W, json.dumps(fs), W, W)
    open(HERE + 'gl_unit/harness.html', 'w').write(html)
    json.dump(dict(W=W, NC=NC), open(HERE + 'gl_unit/meta.json', 'w'))
def compare(resfile):
    r = json.load(open(resfile)); m = json.load(open(HERE + 'gl_unit/meta.json'))
    px = np.array(r['px']).reshape(2, m['W'], 4)[..., :3].astype(float)
    ex, stk = expected()
    names = ['close barPx %g' % b for b in BARPX] + ['swept f%d' % f for f in range(3)] + ['bulk (1,2,3)', 'VS turned', 'VS back-ish']
    rep = dict(compiled=r.get('compiled'), linked=r.get('linked'), log=r.get('log'), cases={})
    for k, nm in enumerate(names):
        rep['cases'][nm] = dict(gl=px[0, k].tolist(), want=ex[k].tolist(), diff=float(np.abs(px[0, k] - ex[k]).max()))
    d = np.abs(px[1, :len(stk)] - stk).max(-1)
    rep['stack9_vs_per_film_rounding'] = dict(max=float(d.max()), share_differ=float((d > 0).mean()))
    print(json.dumps(rep, indent=1)); return rep
if __name__ == '__main__':
    if sys.argv[1] == 'build': build()
    else: json.dump(compare(sys.argv[2]), open(sys.argv[3], 'w'), indent=1)

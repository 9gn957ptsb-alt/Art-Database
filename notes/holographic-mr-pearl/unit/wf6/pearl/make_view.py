"""make_view.py - write a WebGL2 page that ray-marches the pearl.json primitives with pearl.glsl.

usage: python3 make_view.py out.html scene.json [W H] [--cam ...json]
scene.json: {"prims": [...metres...], "head": {c, r, eyes, hw, hh} or null, "bases": {group: [r,g,b] linear},
             "cam": {"pos": [..], "dir": [..], "up": [..], "ortho_h": metres or 0, "fov": deg},
             "bg": "sky" | [r,g,b], "ghost_head": bool}
The page draws once, sets window.DONE (or window.ERR with the compile log)."""
import sys, json, os
import numpy as np
from gen_glsl import scene, GROUP_IDS

HERE = os.path.dirname(os.path.abspath(__file__))

PAGE = r"""<!doctype html><html><head><meta charset="utf-8"><title>Pearl View</title>
<style>html,body{margin:0;background:#0b1530}canvas{display:block}</style></head><body>
<canvas id="c"></canvas>
<script>
const W = %(W)d, H = %(H)d;
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const gl = cv.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false});
const vs = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const fs = `#version 300 es
precision highp float;
uniform vec2 uRes;
out vec4 frag;
%(PEARL)s
%(SCENE)s
const vec3 CAM_POS = %(CPOS)s; const vec3 CAM_DIR = %(CDIR)s; const vec3 CAM_UP = %(CUP)s;
const float ORTHO_H = %(ORTHO)s; const float FOV = %(FOV)s;
const vec3 BODY_C = %(BODYC)s;  // the head's seat: the body's pattern is pinned here, not to the head
const int GHOST = %(GHOST)d; const int TONEMAP = %(TONEMAP)d;
vec3 baseOf(int m) {
%(BASES)s
    return vec3(0.5);
}
vec3 skyCol(vec3 d) {             // the covers' sky, z up
    float y = d.z;
    vec3 zen = vec3(0.0018, 0.0123, 0.0561), hi = vec3(0.0080, 0.0252, 0.1170), lo = vec3(0.0160, 0.0467, 0.1651);
    vec3 band = vec3(0.9823, 0.6724, 0.2423), glow = vec3(0.9734, 0.7835, 0.4233), rock = vec3(0.0212, 0.0152, 0.0152);
    vec3 c = mix(lo, hi, smoothstep(0.08, 0.40, y));
    c = mix(c, zen, smoothstep(0.40, 0.95, y));
    c = mix(c, mix(band, glow, 0.5), exp(-max(y, 0.0) * 14.0));
    if (y < 0.0) c = mix(band * 0.55, rock, smoothstep(0.0, 0.18, -y));
    return c;
}
vec3 calcNormal(vec3 p) {
    int m; const vec2 e = vec2(1.0, -1.0) * 0.0004;
    return normalize(e.xyy * mapScene(p + e.xyy, m) + e.yyx * mapScene(p + e.yyx, m) +
                     e.yxy * mapScene(p + e.yxy, m) + e.xxx * mapScene(p + e.xxx, m));
}
vec3 tonemap(vec3 c) { return c / (1.0 + 0.12 * max(max(c.r, c.g), c.b)); }
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec3 f = normalize(CAM_DIR); vec3 r = normalize(cross(f, CAM_UP)); vec3 u = cross(r, f);
    vec3 ro, rd;
    if (ORTHO_H > 0.0) { ro = CAM_POS + (uv.x * r + uv.y * u) * ORTHO_H; rd = f; }
    else { ro = CAM_POS; rd = normalize(f + (uv.x * r + uv.y * u) * 2.0 * tan(radians(FOV) * 0.5)); }
    float t = 0.0; int mat = -1; bool hit = false;
    for (int i = 0; i < 220; ++i) {
        vec3 p = ro + rd * t;
        float d = mapScene(p, mat);
        if (d < 0.0004 * (1.0 + t * 0.2)) { hit = true; break; }
        t += d * 0.9;
        if (t > 40.0) break;
    }
    vec3 bgd = ORTHO_H > 0.0 ? normalize(f + (uv.x * r + uv.y * u) * 1.2) : rd;
    vec3 col = %(BG)s;
    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 v = -rd;
        // view space for the covers' rig
        mat3 V = transpose(mat3(r, u, -f));
        vec3 nv = V * n, vv = V * v;
        vec3 q = (p - HEAD_C) / HEAD_R;
        vec3 qb = (p - BODY_C) / HEAD_R;
        if (mat == 0) {                                   // the head: the one perfect sphere
            vec3 qn = normalize(q);
            float eye = eyePaint(p);
            vec3 pc = pearlCovers(nv, vv, PEARL_BASE, qn);
            vec3 ec = PEARL_EYE + pearlFresnel(clamp(dot(nv, vv), 0.0, 1.0), 1.0, 1.5) * (PEARL_ENV * 0.06)
                    + vec3(0.6 * pearlGGX(clamp(dot(nv, normalize(PEARL_COVER_KEY + vv)), 0.0, 1.0), 0.08));
            col = mix(pc, ec, eye);
            if (GHOST == 1) col = mix(col, vec3(0.55, 0.80, 1.20), 0.15) + vec3(0.05, 0.10, 0.20) * pow(1.0 - clamp(dot(nv, vv), 0.0, 1.0), 2.0);
        } else {
            vec3 b = baseOf(mat);
            if (mat == 10 || mat == 12 || mat == 13) {      // dark: sound hole, bridge, strap, neck: plain dark gloss
                float NoV = clamp(dot(nv, vv), 0.0, 1.0);
                col = b * (0.25 + 0.75 * max(dot(nv, PEARL_COVER_KEY), 0.0)) + pearlFresnel(NoV, 1.0, 1.5) * PEARL_ENV * 0.05;
            } else if (mat == 9) {                          // fretboard and headstock: dark wood
                col = b * (0.3 + 0.9 * max(dot(nv, PEARL_COVER_KEY), 0.0) + 0.6 * max(dot(nv, PEARL_COVER_SUN), 0.0));
            } else {
                col = pearlCovers(nv, vv, b, qb);
            }
        }
    }
    frag = vec4(toSRGB(TONEMAP == 1 ? tonemap(col) : col), 1.0);
}`;
function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { window.ERR = gl.getShaderInfoLog(s); throw new Error(window.ERR); } return s; }
try {
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { window.ERR = gl.getProgramInfoLog(pr); throw new Error(window.ERR); }
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), W, H);
  gl.viewport(0, 0, W, H);
  const t0 = performance.now();
  // draw in horizontal strips so a software GL does not time out
  const STRIPS = 16; gl.enable(gl.SCISSOR_TEST);
  for (let s = 0; s < STRIPS; ++s) { const y0 = Math.floor(H * s / STRIPS), y1 = Math.floor(H * (s + 1) / STRIPS);
    gl.scissor(0, y0, W, y1 - y0); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.finish(); }
  window.MS = performance.now() - t0;
  window.DONE = true;
} catch (e) { window.ERR = window.ERR || String(e); }
</script></body></html>
"""


def v3(a):
    return 'vec3(%.6f, %.6f, %.6f)' % tuple(a)


def write(out, sc, W=800, H=800):
    prims = sc['prims']
    head = sc.get('head')
    if head is None:
        head = dict(c=[0, 0, -100.0], r=0.25, eyes=[[0, -1, 0]], hw=0.08, hh=0.22)
    glsl_scene = scene(prims, head)
    pearl = open(os.path.join(HERE, 'pearl.glsl')).read()
    bases = sc.get('bases', {})
    bl = []
    for g, rgb in bases.items():
        if g in GROUP_IDS:
            bl.append('    if (m == %d) return %s;   // %s' % (GROUP_IDS.index(g), v3(rgb), g))
    cam = sc['cam']
    bg = sc.get('bg', 'sky')
    bgs = 'skyCol(bgd)' if bg == 'sky' else v3(bg)
    html = PAGE % dict(W=W, H=H, PEARL=pearl.replace('`', "'"), SCENE=glsl_scene, CPOS=v3(cam['pos']), CDIR=v3(cam['dir']),
                       CUP=v3(cam.get('up', [0, 0, 1])), ORTHO='%.6f' % cam.get('ortho_h', 0.0), FOV='%.3f' % cam.get('fov', 30.0),
                       BASES='\n'.join(bl), BG=bgs, BODYC=v3(sc.get('body_c', head['c'])), GHOST=1 if sc.get('ghost_head') else 0, TONEMAP=1 if sc.get('tonemap') else 0)
    open(out, 'w').write(html)
    return out


if __name__ == '__main__':
    out, scj = sys.argv[1], sys.argv[2]
    W = int(sys.argv[3]) if len(sys.argv) > 3 else 800
    H = int(sys.argv[4]) if len(sys.argv) > 4 else 800
    write(out, json.load(open(scj)), W, H)
    print('wrote', out)

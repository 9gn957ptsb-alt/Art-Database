"""make_compile_check.py - a WebGL2 page that compiles pearl.glsl as written and shades his head with it:
left half pearl() under one key light, right half pearlCovers() (the covers' rig), eyes painted at face yaw 50."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
glsl = open(os.path.join(HERE, '..', 'pearl.glsl')).read()
MAIN = r"""
uniform vec2 uRes;
out vec4 o;
vec3 tonemap(vec3 c){ c = c / (1.0 + c * 0.25); return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }
void main(){
  vec2 q = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) { o = vec4(0.07, 0.08, 0.12, 1.0); return; }
  vec3 n = vec3(q, sqrt(1.0 - r2));
  vec3 v = vec3(0.0, 0.0, 1.0);
  float yaw = radians(50.0);
  vec3 col;
  if (gl_FragCoord.x < uRes.x * 0.5) col = pearl(n, v, normalize(vec3(-0.6, 0.5, 0.6)), PEARL_BASE);
  else col = pearlCovers(n, v, PEARL_BASE, n);
  float eye = 0.0;
  for (int s = -1; s <= 1; s += 2) {
    float a = yaw + float(s) * radians(14.65);
    eye = max(eye, pearlEyePaint(n, vec3(sin(a), 0.0, cos(a)), vec3(0.0, 1.0, 0.0), 0.06));
  }
  col = mix(col, pearlEye(n, v, PEARL_COVER_KEY), eye);
  o = vec4(tonemap(col), 1.0);
}
"""
FS = "#version 300 es\nprecision highp float;\n" + glsl + MAIN
JS = r"""
const VS = "#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
const res = {};
try {
  const c = document.getElementById('c'); const gl = c.getContext('webgl2');
  res.webgl2 = !!gl;
  function sh(t, s){ const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x);
    return [x, gl.getShaderParameter(x, gl.COMPILE_STATUS), gl.getShaderInfoLog(x)]; }
  const [vs, vok] = sh(gl.VERTEX_SHADER, VS); const [fs, fok, flog] = sh(gl.FRAGMENT_SHADER, FS);
  res.vertex_compiled = vok; res.fragment_compiled = fok; res.fragment_log = flog || '';
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  res.linked = gl.getProgramParameter(pr, gl.LINK_STATUS); res.link_log = gl.getProgramInfoLog(pr) || '';
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), c.width, c.height);
  const t0 = performance.now(); gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  res.draw_ms = performance.now() - t0;
  let s = [0, 0, 0], n = 0, black = 0;
  for (let i = 0; i < px.length; i += 4) {
    const x = (i / 4) % c.width, y = Math.floor(i / 4 / c.width);
    const qx = (x + 0.5) / c.width * 2 - 1, qy = (y + 0.5) / c.height * 2 - 1; if (qx * qx + qy * qy > 0.95) continue;
    n++; s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; if (px[i] + px[i + 1] + px[i + 2] < 6) black++;
  }
  res.sphere_mean_srgb = s.map(v => Math.round(v / n)); res.sphere_px = n; res.near_black_px = black;
  res.gl_error = gl.getError();
  res.renderer = gl.getParameter(gl.RENDERER); res.version = gl.getParameter(gl.VERSION);
  res.fragment_highp_float_bits = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision;
} catch (e) { res.exception = String(e); }
window.RES = res; window.DONE = 1;
"""
html = ('<!doctype html><html><body style="margin:0;background:#111"><canvas id="c" width="384" height="384"></canvas>\n'
        '<script>\nconst FS = ' + json.dumps(FS) + ';\n' + JS + '</script></body></html>')
open(os.path.join(HERE, 'compile_check.html'), 'w').write(html)
print('wrote compile_check.html', len(FS), 'chars of GLSL')

"""WebGL2 page: compiles pearl.glsl as written; renders pearlFilm(cos1, d) on a 64x64 grid into an RGBA32F target,
plus pearl() on a sphere; reads both back."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
glsl = open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl/pearl.glsl').read()
MAIN = r"""
uniform vec2 uRes; uniform int uMode;
out vec4 o;
void main(){
  vec2 f = (gl_FragCoord.xy - 0.5) / (uRes - 1.0);
  if (uMode == 0) { float c = mix(0.02, 1.0, f.x); float d = mix(100.0, 700.0, f.y); o = vec4(pearlFilm(c, d), 1.0); return; }
  vec2 q = f * 2.0 - 1.0; float r2 = dot(q, q);
  if (r2 > 1.0) { o = vec4(-1.0); return; }
  vec3 n = vec3(q, sqrt(1.0 - r2));
  o = vec4(pearl(n, vec3(0, 0, 1), normalize(vec3(-0.6, 0.5, 0.6)), PEARL_BASE), 1.0);
}
"""
FS = "#version 300 es\nprecision highp float;\n" + glsl + MAIN
JS = r"""
const VS = "#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
const res = {};
try {
  const c = document.createElement('canvas'); const gl = c.getContext('webgl2');
  res.ext = !!gl.getExtension('EXT_color_buffer_float');
  function sh(t, s){ const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return [x, gl.getShaderParameter(x, gl.COMPILE_STATUS), gl.getShaderInfoLog(x)]; }
  const [vs, vok] = sh(gl.VERTEX_SHADER, VS); const [fs, fok, flog] = sh(gl.FRAGMENT_SHADER, FS);
  res.vok = vok; res.fok = fok; res.flog = flog || '';
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  res.linked = gl.getProgramParameter(pr, gl.LINK_STATUS); res.llog = gl.getProgramInfoLog(pr) || '';
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const N = 64;
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  res.fb = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.viewport(0, 0, N, N); gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), N, N);
  const out = {};
  for (const m of [0, 1]) {
    gl.uniform1i(gl.getUniformLocation(pr, 'uMode'), m);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Float32Array(N * N * 4); gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, px);
    out[m] = Array.from(px);
  }
  res.film = out[0]; res.sphere = out[1]; res.err = gl.getError();
} catch (e) { res.exception = String(e); }
window.RES = res; window.DONE = 1;
"""
html = '<!doctype html><html><body><script>\nconst FS = ' + json.dumps(FS) + ';\n' + JS + '</script></body></html>'
open(os.path.join(HERE, 'film.html'), 'w').write(html)

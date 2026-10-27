/* Glyph Light: the texture of what is drawn, made of glowing glyphs.
 *
 * Artist, 27 Oct 2026, sending the Glyph Light artifact (an image turned into glowing characters: ASCII, dots, grain
 * or scan lines; glyphs sorted by their ink; colour full, mono, gold or blue; tone; a glow above a threshold; the image
 * under the glyphs): "Implement this as the aesthetic for the artist website, DRIFT, DRIFT Poetry, Holographic Mr Pearl
 * and morphology. The content should remain the same for each, what changes is how the aesthetic texture of what is
 * being displayed is achieved."
 *
 * So nothing here draws content. A piece draws as it always has, into its own canvases; this lays one canvas over
 * them (pointer-events none, so every press still reaches what is under it) and draws, each frame, what they show
 * as glyphs: the picture is read at one sample a cell (its canvases drawn small, in their paint order, with their
 * opacity and blending), each cell's lightness picks a glyph from the set (sorted by how much ink it leaves, as Glyph
 * Light sorts any set), the glyph takes the cell's colour (lifted as Glyph Light lifts it, so a glyph that covers part
 * of its cell still carries the cell's light), and the cells at or over the threshold glow, blurred twice as Glyph
 * Light blurs them (1.6 and 5 cells), and laid on with "lighter". Text and controls stay above, as they were.
 *
 *   const g = GlyphLight.create({
 *     host,                 // the positioned element the glyphs cover (the overlay is its child, inset 0)
 *     sources: () => [...], // the canvases to read, in paint order, each frame
 *     set: " .:-=+*#%@",    // any glyphs, any order: sorted by ink here
 *     style: "ascii",       // "ascii" | "dots" | "grain" | "scan"
 *     mode: "full",         // "full" | "mono" | "gold" | "blue"
 *     cell: 6,              // a cell's width in CSS px (a number, or a function of the host's width)
 *     glow: 0.6, thresh: 0.7, under: 0, exposure: 0, contrast: 1.2, gamma: 1, detail: 0, invert: false, auto: true,
 *     keep: () => [],       // circles {x, y, r} in CSS px of the host where what is under shows as it is
 *     active: () => true,   // false: the overlay steps away and nothing is read
 *     z: 1,                 // the overlay's z-index in its host ("auto" when it is seated by after or before)
 *     after, before,        // an element (or a function giving one) the overlay is kept right after, or right before
 *     fit,                  // an element (or a function) whose box the overlay is fitted to, instead of the host's
 *     boxes: "rect",        // "layout": boxes as laid out, relative to the host, where a transform scales them all
 *     className: "",        // more classes for the overlay
 *   });
 *   g.set({ style: "dots" }); g.destroy();
 *
 * A WebGL canvas can only be read after it is shown if it keeps its drawing buffer, so this file, loaded before the
 * pieces make their contexts, asks every WebGL context for preserveDrawingBuffer (GlyphLight.preserve()).
 */
(function () {
  "use strict";

  const FONT = '"JetBrains Mono","Noto Sans JP","Noto Sans Symbols 2",Menlo,monospace';
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const SETS = {
    ascii: " .:-=+*#%@",
    fine: " .·:;irsXA253hMHGS#9B&@",
    blocks: " ░▒▓█",
    binary: " 01",
    kana: " ･ｰｨｼﾉﾍﾄｦｺﾆﾐﾘﾈﾎﾑﾒﾜﾓﾗﾊﾏﾝｱｶｻﾀﾅ",
    kanji: " 一二人口山日目田白百自血鬼龍",
  };
  const MODES = { full: 0, mono: 1, gold: 2, blue: 3 };
  const STYLES = { ascii: 0, dots: 1, grain: 2, scan: 3, text: 4 };
  const MAXG = 128;                                     // the most glyphs a set or a text can carry
  const BLENDS = { normal: "source-over", lighten: "lighten", darken: "darken", screen: "screen", multiply: "multiply",
    overlay: "overlay", "color-dodge": "color-dodge", "color-burn": "color-burn", "hard-light": "hard-light",
    "soft-light": "soft-light", difference: "difference", exclusion: "exclusion", plus: "lighter", "plus-lighter": "lighter" };

  // ---- the drawing buffers kept, so a WebGL canvas can be read after it is shown -------------------------------
  let preserved = false;
  function preserve() {
    if (preserved || typeof HTMLCanvasElement === "undefined") return;
    preserved = true;
    const own = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (!this.__glyphs && (type === "webgl2" || type === "webgl" || type === "experimental-webgl"))
        attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
      return own.call(this, type, attrs);
    };
  }

  // ---- the shaders ---------------------------------------------------------------------------------------------
  const VS = `#version 300 es
in vec2 p; out vec2 v;
void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

  // What both passes know of a cell: its colour read, toned, and its lightness.
  const TONE = `
uniform sampler2D S;          // the picture, one texel a cell (row 0 at the top)
uniform ivec2 grid;           // cols, rows
uniform vec3 tone;            // exposure (as a factor), contrast, gamma
uniform vec2 lohi;            // auto levels
uniform float detail, invert;
float lumOf(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float toneOf(float x){ x = (x - lohi.x) / max(0.05, lohi.y - lohi.x); x *= tone.x; x = (x - 0.5) * tone.y + 0.5; return pow(clamp(x, 0.0, 1.0), 1.0 / tone.z); }
vec3 cellRGB(ivec2 c){ c = clamp(c, ivec2(0), grid - 1); vec3 s = texelFetch(S, c, 0).rgb; return vec3(toneOf(s.r), toneOf(s.g), toneOf(s.b)); }
// The cell's toned colour (rgb) and lightness (a), sharpened by its neighbours and inverted as asked.
vec4 cellAt(ivec2 c){
  vec3 rgb = cellRGB(c); float l = lumOf(rgb);
  if (detail > 0.0) {
    float s = 0.0, n = 0.0;
    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
      ivec2 q = c + ivec2(dx, dy);
      if (q.x < 0 || q.y < 0 || q.x >= grid.x || q.y >= grid.y) continue;
      s += lumOf(cellRGB(q)); n += 1.0;
    }
    float l2 = clamp(l + detail * (l - s / n), 0.0, 1.0);
    rgb = l > 0.002 ? min(vec3(1.0), rgb * (l2 / l)) : vec3(0.0); l = l2;
  }
  if (invert > 0.5) { rgb = 1.0 - rgb; l = 1.0 - l; }
  return vec4(rgb, l);
}
uniform int mode;
vec3 tint(vec3 c, float l){
  if (mode == 0) return c;
  if (mode == 1) return vec3(l);
  if (mode == 2) return vec3(min(1.0, l * 1.1 + 0.078), l * 0.82, l * 0.35);
  return vec3(l * 0.35, l * 0.75, min(1.0, l * 1.1 + 0.078));
}
float hash(ivec2 c){ uint h = uint(c.x) * 0x27d4eb2du ^ (uint(c.y) * 0x165667b1u + 1337u); h ^= h >> 15; h *= 0x2c1b3c6du; h ^= h >> 12; h *= 0x297a2d39u; h ^= h >> 15; return float(h) / 4294967296.0; }
`;

  // The glow's source, a texel a cell: each glowing cell's colour times the ink its mark leaves.
  const FS_GLOW = `#version 300 es
precision highp float; precision highp int;
${TONE}
uniform int style, N;
uniform float thresh, ink[128], dotArea, bayer[16];
uniform sampler2D I;           // the text style: each cell's glyph, in red
in vec2 v; out vec4 o;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy); c.y = grid.y - 1 - c.y;
  vec4 a = cellAt(c); float l = a.a;
  vec3 col = tint(a.rgb, l);
  o = vec4(0.0);
  if (l < thresh) return;
  float k = 0.0;
  if (style == 0) { int g = min(N - 1, int(floor(l * float(N)))); k = ink[g]; col = mode == 0 ? min(vec3(1.0), col + vec3(0.235, 0.157, 0.0)) : col / (0.55 + 0.45 * l); }
  else if (style == 1) { if (l > bayer[(c.y & 3) * 4 + (c.x & 3)]) k = dotArea; float b = 1.25 / max(0.35, max(col.r, max(col.g, col.b))); col = min(vec3(1.0), col * b); }
  else if (style == 2) { if (l > hash(c)) k = 1.0; col = min(vec3(1.0), col * (0.45 + 0.75 * l) + 0.078 * l); }
  else if (style == 3) { k = (0.12 + 0.6 * l) * 0.82; col = min(vec3(1.0), col * (0.6 + 0.6 * l) + 0.157 * l * l); }
  else { int g = int(texelFetch(I, c, 0).r * 255.0 + 0.5); k = ink[g]; col = mode == 0 ? min(vec3(1.0), col + vec3(0.235, 0.157, 0.0)) : col / (0.55 + 0.45 * l); }
  o = vec4(col * k, 1.0);
}`;

  // A Gaussian along one axis, in cells.
  const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D T; uniform vec2 dir; uniform float sigma; uniform vec2 size;
in vec2 v; out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / size;
  if (sigma < 0.01) { o = texture(T, uv); return; }
  int r = int(ceil(sigma * 3.0)); vec4 s = vec4(0.0); float w = 0.0;
  for (int i = -24; i <= 24; i++) {
    if (i < -r || i > r) continue;
    float g = exp(-0.5 * float(i * i) / (sigma * sigma));
    s += texture(T, uv + dir * float(i) / size) * g; w += g;
  }
  o = s / w;
}`;

  // The glyphs, at the screen's own pixels.
  const FS_DRAW = `#version 300 es
precision highp float; precision highp int;
${TONE}
uniform sampler2D A, G1, G2;   // the glyphs (one cell each, side by side), the two glows
uniform int style, N;
uniform vec2 cellPx, view;     // a cell in device px; the overlay in device px
uniform float glowAmt, thresh, under, ink[128], bayer[16];
uniform sampler2D I;
uniform vec3 bg;
uniform vec4 keep[8]; uniform int keeps;
in vec2 v; out vec4 o;
void main(){
  vec2 px = vec2(gl_FragCoord.x, view.y - gl_FragCoord.y);          // from the top left
  for (int i = 0; i < 8; i++) { if (i >= keeps) break; vec4 k = keep[i]; float d = length(px - k.xy) - k.z; if (d < 0.0) { o = vec4(0.0); return; } }
  ivec2 c = ivec2(floor(px / cellPx));
  vec2 f = px - vec2(c) * cellPx;                                    // where in its cell, device px
  vec4 a = cellAt(c); float l = a.a;
  vec3 col = tint(a.rgb, l);
  float cov = 0.0; vec3 lit = vec3(0.0);
  bool glow = glowAmt > 0.0 && l >= thresh;
  if (style == 0) {
    int g = min(N - 1, int(floor(l * float(N))));
    if (g > 0) {
      cov = texelFetch(A, ivec2(int(float(g) * cellPx.x + min(f.x, cellPx.x - 1.0)), int(min(f.y, cellPx.y - 1.0))), 0).r;
      lit = min(vec3(1.0), col / (0.55 + 0.45 * l));
    }
  } else if (style == 1) {
    float sz = cellPx.x * 0.72, off = (cellPx.x - sz) * 0.5;
    bool inDot = f.x >= off && f.x < off + sz && f.y >= off && f.y < off + sz;
    bool on = l > bayer[(c.y & 3) * 4 + (c.x & 3)];
    if (inDot) {
      if (on) { float b = 1.25 / max(0.35, max(col.r, max(col.g, col.b))); lit = min(vec3(1.0), col * b); cov = 1.0; }
      else if (l > 0.03) { lit = col * 0.35; cov = 1.0; glow = false; }
    }
  } else if (style == 2) {
    if (l > hash(c)) { lit = min(vec3(1.0), col * (0.45 + 0.75 * l) + 0.078 * l); cov = 1.0; }
    else if (l > 0.04) { lit = col * 0.22; cov = 1.0; glow = false; }
  } else if (style == 3) {
    if (l >= 0.04) {
      float h = cellPx.y * (0.12 + 0.6 * l), top = (cellPx.y - h) * 0.5;
      if (f.x < cellPx.x * 0.82 && f.y >= top && f.y < top + h) { lit = min(vec3(1.0), col * (0.6 + 0.6 * l) + 0.157 * l * l); cov = 1.0; }
    }
  } else {
    // a text running through the cells in reading order, each letter in its cell's colour, gone where the picture is dark
    int g = int(texelFetch(I, clamp(c, ivec2(0), grid - 1), 0).r * 255.0 + 0.5);
    if (g > 0) {
      cov = texelFetch(A, ivec2(int(float(g) * cellPx.x + min(f.x, cellPx.x - 1.0)), int(min(f.y, cellPx.y - 1.0))), 0).r;
      lit = min(vec3(1.0), col / (0.55 + 0.45 * l)) * smoothstep(0.03, 0.16, l);
      if (cov * max(lit.r, max(lit.g, lit.b)) <= 0.0) cov = 0.0;
    }
  }
  vec3 glyph = lit * cov;
  if (glow && cov > 0.0) {
    vec3 gc = ((style == 0 || style == 4) && mode == 0) ? min(vec3(1.0), col + vec3(0.235, 0.157, 0.0)) : lit;
    glyph += gc * cov * glowAmt * 0.6;
  }
  vec2 g = (px / cellPx) / vec2(grid); g.y = 1.0 - g.y;
  vec3 halo = (texture(G1, g).rgb + texture(G2, g).rgb * 0.8) * glowAmt;
  vec3 rgb = glyph + halo + bg * (1.0 - under) * (1.0 - cov);
  float alpha = cov + (1.0 - under) * (1.0 - cov);
  alpha = max(alpha, min(1.0, max(rgb.r, max(rgb.g, rgb.b))));
  o = vec4(min(rgb, vec3(alpha)), alpha);
}`;

  function compile(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(t);
      gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("glyphlight: " + gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("glyphlight: " + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ""); u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }

  function texture(gl, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // ---- the glyphs, sorted by ink -------------------------------------------------------------------------------
  const inkOf = {};
  function measureInk(ch) {
    if (ch in inkOf) return inkOf[ch];
    const m = document.createElement("canvas"); m.width = m.height = 48;
    const g = m.getContext("2d", { willReadFrequently: true });
    g.font = `40px ${FONT}`; g.textBaseline = "top"; g.fillStyle = "#fff"; g.fillText(ch, 2, 2);
    const d = g.getImageData(0, 0, 48, 48).data; let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i];
    return (inkOf[ch] = s);
  }
  function sortSet(set) {
    const u = [...new Set([...(set.includes(" ") ? set : " " + set)])].sort((a, b) => measureInk(a) - measureInk(b));
    if (u.length <= 64) return u.join("");
    return Array.from({ length: 64 }, (_, i) => u[Math.round(i * (u.length - 1) / 63)]).join("");   // spread over the ink
  }
  function widthRatio(set) {
    const c = document.createElement("canvas").getContext("2d");
    c.font = `100px ${FONT}`; let w = 0;
    for (const ch of set) w = Math.max(w, c.measureText(ch).width);
    return Math.max(0.45, w / 100);
  }

  function create(opts) {
    preserve();
    const o = Object.assign({ set: SETS.ascii, style: "ascii", mode: "full", cell: 6, glow: 0.6, thresh: 0.7, under: 0,
      exposure: 0, contrast: 1.2, gamma: 1, detail: 0, invert: false, auto: true, bg: [0, 0, 0], z: opts.after || opts.before ? "auto" : 1, text: "",
      keep: () => [], active: () => true, sources: () => [] }, opts);
    const host = o.host;
    const val = (v) => (typeof v === "function" ? v() : v);
    const cv = document.createElement("canvas");
    cv.__glyphs = true;
    cv.className = "glyphlight" + (o.className ? " " + o.className : "");
    cv.setAttribute("aria-hidden", "true");
    Object.assign(cv.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: String(o.z), display: "block" });
    // where it lies: right after `after` in the page (so whatever comes later stays above it), else last in its host
    function seat() {
      const a = val(o.after), b = val(o.before);
      if (a && a.parentNode) { if (a.nextSibling !== cv) a.after(cv); }
      else if (b && b.parentNode) { if (cv.nextSibling !== b) b.before(cv); }
      else if (cv.parentNode !== host) host.appendChild(cv);
    }
    seat();
    const gl = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) { cv.remove(); return null; }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const P = { glow: compile(gl, VS, FS_GLOW), blur: compile(gl, VS, FS_BLUR), draw: compile(gl, VS, FS_DRAW) };
    const tS = texture(gl, gl.NEAREST), tA = texture(gl, gl.NEAREST), tI = texture(gl, gl.NEAREST);
    const fb = [0, 1, 2, 3].map(() => { const t = texture(gl, gl.LINEAR), f = gl.createFramebuffer(); return { t, f }; });

    // the picture, a pixel a cell (on the GPU when the browser can)
    const sample = document.createElement("canvas");
    sample.__glyphs = true;
    const sx = sample.getContext("2d", { alpha: false });
    // a smaller copy read back now and then, for the auto levels
    const probe = document.createElement("canvas"); probe.width = probe.height = 48;
    const px = probe.getContext("2d", { willReadFrequently: true });

    let set = "", N = 1, ink = new Float32Array(MAXG), letters = "", textKey = "", ratio = 0.6, cwD = 0, chD = 0, cols = 0, rows = 0, W = 0, H = 0;
    let atlasKey = "", lo = 0, hi = 1, lastProbe = 0, probed = false, raf = 0, dead = false, fontsTried = false;

    function atlas() {
      const style = o.style;
      const key = [style === "text" ? letters : o.set, style, cwD, chD].join("|");
      if (key === atlasKey) return;
      atlasKey = key;
      if (style !== "ascii" && style !== "text") { N = 1; return; }
      const a = document.createElement("canvas"); a.width = Math.max(1, N * cwD); a.height = Math.max(1, chD);
      const g = a.getContext("2d", { willReadFrequently: true });
      g.fillStyle = "#000"; g.fillRect(0, 0, a.width, a.height);
      g.font = `${chD}px ${FONT}`; g.textBaseline = "top"; g.fillStyle = "#fff";
      const chars = [...set];
      for (let i = 0; i < N; i++) {
        g.save(); g.beginPath(); g.rect(i * cwD, 0, cwD, chD); g.clip();
        g.fillText(chars[i], i * cwD, 0); g.restore();
      }
      const d = g.getImageData(0, 0, a.width, a.height).data;
      for (let i = 0; i < N; i++) {
        let s = 0;
        for (let y = 0; y < chD; y++) for (let x = 0; x < cwD; x++) s += d[(y * a.width + i * cwD + x) * 4];
        ink[i] = s / (255 * cwD * chD);
      }
      gl.bindTexture(gl.TEXTURE_2D, tA);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a);
    }

    // The frame the glyphs fill: the host, or the one element they are fitted over (`fit`). Its box and the sources'
    // are read off the page as drawn (getBoundingClientRect), or, where the host's children are scaled as one (a
    // transform the overlay shares), as laid out (offsetLeft and the rest, relative to the host).
    const boxOf = (el) => o.boxes === "layout"
      ? { left: el === host ? 0 : el.offsetLeft, top: el === host ? 0 : el.offsetTop, width: el === host ? host.clientWidth : el.offsetWidth, height: el === host ? host.clientHeight : el.offsetHeight }
      : el.getBoundingClientRect();
    function layout() {
      seat();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const f = val(o.fit);
      if (f) {
        const st = cv.style, l = f.offsetLeft + "px", t = f.offsetTop + "px", w = f.offsetWidth + "px", h = f.offsetHeight + "px";
        if (st.left !== l || st.top !== t || st.width !== w || st.height !== h) Object.assign(st, { inset: "auto", left: l, top: t, width: w, height: h });
      }
      const r = boxOf(f || host);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      W = w; H = h;
      const style = o.style;
      if (style === "ascii") {
        if (set !== o.__sorted) { set = sortSet(o.set); o.__sorted = set; ratio = widthRatio(set); }
        N = Math.min(64, [...set].length);
      } else if (style === "text") {
        if (o.text !== o.__text) {
          o.__text = o.text;
          const u = [...new Set([...o.text.replace(/\s+/g, "")])].slice(0, MAXG - 1);
          letters = set = " " + u.join(""); ratio = widthRatio(set); textKey = "";
        }
        N = [...set].length;
      } else { ratio = 1; }
      const cssCell = typeof o.cell === "function" ? o.cell(r.width, r.height) : o.cell;
      cwD = Math.max(2, Math.round(cssCell * dpr));
      chD = Math.max(2, Math.round(cwD / ratio));
      cols = Math.ceil(W / cwD); rows = Math.ceil(H / chD);
      if (sample.width !== cols || sample.height !== rows) {
        sample.width = cols; sample.height = rows;
        for (const b of fb) {
          gl.bindTexture(gl.TEXTURE_2D, b.t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.bindFramebuffer(gl.FRAMEBUFFER, b.f);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, b.t, 0);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      atlas();
      if (o.style === "text") {
        const key = cols + "x" + rows + "|" + letters;
        if (key !== textKey) {
          textKey = key;
          const at = new Map([...set].map((ch, i) => [ch, i])), flat = o.text.replace(/\s+/g, " ").trim() + " ";
          const idx = new Uint8Array(cols * rows * 4);
          for (let i = 0; i < cols * rows; i++) idx[i * 4] = at.get(flat[i % flat.length]) || 0;
          gl.bindTexture(gl.TEXTURE_2D, tI);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, idx);
        }
      }
      return r;
    }

    // what each source shows, as the page composites it: its opacity up to the host, its blending, hidden or not
    function seen(el) {
      let a = 1, blend = "source-over";
      for (let e = el; e && !e.contains(host); e = e.parentElement) {
        if (e.hidden) return null;
        const s = getComputedStyle(e);
        if (s.display === "none" || s.visibility === "hidden") return null;
        a *= +s.opacity;
        if (e === el && s.mixBlendMode && s.mixBlendMode !== "normal") blend = BLENDS[s.mixBlendMode] || "source-over";
        if (a <= 0.003) return null;
      }
      return { a, blend };
    }

    function read(hr) {
      const [br, bgG, bb] = o.bg;
      sx.globalAlpha = 1; sx.globalCompositeOperation = "source-over";
      sx.fillStyle = `rgb(${br * 255},${bgG * 255},${bb * 255})`; sx.fillRect(0, 0, cols, rows);
      sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = "high";
      const dpr = W / Math.max(1, hr.width), kx = dpr / cwD, ky = dpr / chD;   // cells a CSS px
      for (const src of o.sources() || []) {
        if (!src || !src.width || !src.height) continue;
        const v = seen(src);
        if (!v) continue;
        const r = boxOf(src);
        if (r.width < 1 || r.height < 1 || r.left + r.width < hr.left || r.top + r.height < hr.top || r.left > hr.left + hr.width || r.top > hr.top + hr.height) continue;
        sx.globalAlpha = v.a; sx.globalCompositeOperation = v.blend;
        try { sx.drawImage(src, (r.left - hr.left) * kx, (r.top - hr.top) * ky, r.width * kx, r.height * ky); } catch (e) { /* a canvas not ready yet */ }
      }
      sx.globalAlpha = 1; sx.globalCompositeOperation = "source-over";
    }

    // auto levels for a moving picture: the 1st and 99th percentiles of its lightness, eased
    function levels(now) {
      if (!o.auto) { lo = 0; hi = 1; return; }
      if (now - lastProbe < 500) return;
      lastProbe = now;
      px.drawImage(sample, 0, 0, 48, 48);
      const d = px.getImageData(0, 0, 48, 48).data, h = new Uint32Array(256), n = 48 * 48;
      for (let i = 0; i < d.length; i += 4) h[Math.min(255, (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0)]++;
      let a = 0, k = 0;
      for (; k < 256; k++) { a += h[k]; if (a > n * 0.01) break; }
      const tl = k / 255;
      a = 0;
      for (k = 255; k >= 0; k--) { a += h[k]; if (a > n * 0.01) break; }
      const th = Math.max(tl + 0.05, k / 255), ease = probed ? 0.3 : 1;
      probed = true;
      lo += (tl - lo) * ease; hi += (th - hi) * ease;
    }

    function uniforms(prog) {
      const u = prog.u;
      gl.uniform1i(u.S, 0);
      gl.uniform2i(u.grid, cols, rows);
      gl.uniform3f(u.tone, Math.pow(2, o.exposure), o.contrast, o.gamma);
      gl.uniform2f(u.lohi, lo, hi);
      gl.uniform1f(u.detail, o.detail);
      gl.uniform1f(u.invert, o.invert ? 1 : 0);
      gl.uniform1i(u.mode, MODES[o.mode] || 0);
      if (u.style) gl.uniform1i(u.style, STYLES[o.style] || 0);
      if (u.N) gl.uniform1i(u.N, N);
      if (u.ink) gl.uniform1fv(u.ink, ink);
      if (u.thresh) gl.uniform1f(u.thresh, o.thresh);
      if (u.bayer) gl.uniform1fv(u.bayer, BAYER);
      if (u.I) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tI); gl.uniform1i(u.I, 4); gl.activeTexture(gl.TEXTURE0); }
    }

    function pass(prog, target, w, h) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog.p);
      return prog;
    }

    function blur(src, tmp, dst, sigma) {
      const pr = P.blur;
      pass(pr, tmp, cols, rows);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t);
      gl.uniform1i(pr.u.T, 0); gl.uniform2f(pr.u.size, cols, rows);
      gl.uniform2f(pr.u.dir, 1, 0); gl.uniform1f(pr.u.sigma, sigma);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      pass(pr, dst, cols, rows);
      gl.bindTexture(gl.TEXTURE_2D, tmp.t);
      gl.uniform2f(pr.u.dir, 0, 1); gl.uniform1f(pr.u.sigma, sigma * cwD / chD);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(now) {
      raf = 0;
      if (dead) return;
      schedule();
      if (document.hidden) return;
      if (!o.active()) { cv.style.display = "none"; return; }
      cv.style.display = "block";
      const hr = layout();
      read(hr);
      levels(now || performance.now());
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tS);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sample);

      const soft = o.style === "grain" ? 1.6 : 1;
      if (o.glow > 0) {
        uniforms(pass(P.glow, fb[0], cols, rows));
        if (P.glow.u.dotArea) gl.uniform1f(P.glow.u.dotArea, 0.72 * 0.72);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        blur(fb[0], fb[1], fb[2], 1.6 * soft);
        blur(fb[0], fb[1], fb[3], 5 * soft);
      } else {
        for (const i of [2, 3]) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb[i].f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      }

      const d = P.draw;
      uniforms(pass(d, null, W, H));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tS);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tA); gl.uniform1i(d.u.A, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fb[2].t); gl.uniform1i(d.u.G1, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, fb[3].t); gl.uniform1i(d.u.G2, 3);
      gl.uniform2f(d.u.cellPx, cwD, chD);
      gl.uniform2f(d.u.view, W, H);
      gl.uniform1f(d.u.glowAmt, o.glow);
      gl.uniform1f(d.u.under, o.under);
      gl.uniform1fv(d.u.bayer, BAYER);
      gl.uniform3f(d.u.bg, o.bg[0], o.bg[1], o.bg[2]);
      const dpr = W / Math.max(1, hr.width), ks = (o.keep() || []).slice(0, 8), kv = new Float32Array(32);
      ks.forEach((k, i) => { kv[i * 4] = k.x * dpr; kv[i * 4 + 1] = k.y * dpr; kv[i * 4 + 2] = k.r * dpr; });
      gl.uniform4fv(d.u.keep, kv); gl.uniform1i(d.u.keeps, ks.length);
      gl.activeTexture(gl.TEXTURE0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function schedule() { if (!raf && !dead) raf = requestAnimationFrame(frame); }

    // the glyphs' font may arrive after the first frame: sort and draw them again once it has
    if (document.fonts && !fontsTried) {
      fontsTried = true;
      document.fonts.load(`40px ${FONT}`, o.style === "text" ? o.text.slice(0, 2000) : o.set).catch(() => {}).then(() => {
        for (const k in inkOf) delete inkOf[k];
        o.__sorted = null; o.__text = null; atlasKey = "";
      });
    }
    schedule();

    return {
      canvas: cv,
      set(p) { Object.assign(o, p); if ("set" in p) { o.__sorted = null; atlasKey = ""; } if ("style" in p || "text" in p) { atlasKey = ""; o.__text = null; o.__sorted = null; } schedule(); },
      get options() { return Object.assign({}, o); },
      frame() { if (raf) cancelAnimationFrame(raf); raf = 0; frame(performance.now()); },
      destroy() { dead = true; if (raf) cancelAnimationFrame(raf); cv.remove(); },
    };
  }

  window.GlyphLight = { create, preserve, SETS };
  // Loaded before the pieces make their WebGL contexts, so each keeps its drawing buffer and can be read after it is shown.
  if (window.GLYPHLIGHT_PRESERVE !== false) preserve();
})();

/* The body of the globe: what every place is made of, each cell a saved work.

   The artist, 1 Oct 2026: "the colors overall in the entire globe need to be
   less pixelated and more reflective of the materials the represent"; then
   "I still want you to be able to select an artwork from any pixel … The
   globe has to feel like an Apple product … I like the pixel aesthetic and
   animations, they just need further refinements".

   Every cell of the globe wears the colour of one saved work, the work whose
   colour is nearest what the place is made of (scripts/build_material.py):
   the sea by its depth, forest, grass, sand, rock, ice, the cities' ground,
   and snow and sea ice by the month. A cell is drawn as a crisp square of
   that colour, antialiased to the device pixel and never smaller than the
   eye can hold: far off, where a cell would be under three device pixels,
   the cells are drawn coarser instead — a square of 2, 4, 8 … cells wearing
   the work at its middle, still crisp — never averaged (the artist, 8 Oct
   2026, of the small globe beside the dial: "The globe is blurry for some
   reason. Make sure the globe is never blurry and consistently the same
   across all places"; only the far limb, foreshortened under a pixel and a
   half, is averaged, under the air); close to, a cell splits into
   cells of 6.5 to 13 pixels, each its cell's work or one of the eight works
   nearest it in colour, so at every height the ground is the same fine
   pixel and every pixel is a door to one work (doorAt, which works out
   exactly what the shader draws).

   Light falls on it as on the Earth: the real sun, the relief, the glint of
   open water, the air thick at the limb. On a journey it carries depth and
   the feel of what you cross (land.js, "the journey").

   Files: earth-doors.webp, earth-season.webp, earth-doors.json, the light's
   earth-props.webp, and DIRT Earth's cloud for the season.

   EarthBody.start(month) loads it; EarthBody.draw(o) renders a frame and
   hands back its canvas, laid under the page's own (null until ready, or
   without WebGL 2, when the globe is as it was); EarthBody.doorAt(lat, lon,
   R) names the work under a point at a radius; EarthBody.light(door, amt)
   lights its cell; EarthBody.kindAt(lat, lon) says what the place is. */
(function () {
  "use strict";

  var GW = 1024, GH = 512;
  var CELL_T = 6.5;                 // the smallest a cell is drawn, in CSS pixels (half a tile of the light)
  var CLASSES = ["sea", "shallow sea", "lake", "forest", "grass", "desert", "rock", "ice", "city", "wetland"];

  var VERT = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "#version 300 es",
    "precision highp float; precision highp int; precision highp usampler2D;",
    "out vec4 outC;",
    "uniform vec3 uView;",      // W, H (css px), device height
    "uniform float uDpr;",
    "uniform vec3 uC;",         // cx, cy, R
    "uniform vec4 uRot;",       // sin spin, cos spin, sin tilt, cos tilt
    "uniform vec3 uSun;",       // the sun, in the world
    "uniform vec4 uK;",         // near, high, journey, time
    "uniform vec4 uDof;",       // focus x, y, amount, radius
    "uniform vec4 uSky;",       // cloud amount, cloud shell (Rs / R), stars, light
    "uniform vec2 uStar;",
    "uniform vec4 uFeel;",      // glass (sea), grain (desert), damp (cloud, mountain), dense (forest)
    "uniform float uCrisp;",    // ice
    "uniform vec3 uLevel;",     // level k, blend toward k + 1, size of a base cell in px
    "uniform vec4 uSel;",       // the lit cell: i, j, level, amount
    "uniform int uMonth;",      // 0..11
    "uniform vec3 uCloudCh;",
    "uniform highp sampler2D uCol, uProps, uCloud;",
    "uniform highp usampler2D uDoors, uSeason, uPal, uSib;",
    "const float PI = 3.14159265, TAU = 6.2831853;",
    "const vec3 HAZE = vec3(165., 185., 209.) / 255.;",
    "const vec3 HAZE_DEEP = vec3(77., 102., 142.) / 255.;",
    "const vec3 GLINT = vec3(240., 229., 216.) / 255.;",
    "const vec3 CLOUD = vec3(246., 244., 239.) / 255.;",
    "const vec3 CLOUD_SHADE = vec3(162., 167., 175.) / 255.;",
    "const vec3 STAR = vec3(247., 236., 228.) / 255.;",
    "const vec3 LIGHT = vec3(157., 149., 230.) / 255.;",

    "uint pcg(uvec3 v) {",
    "  v = v * 1664525u + 1013904223u;",
    "  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;",
    "  v ^= v >> 16u;",
    "  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;",
    "  return v.x ^ v.y ^ v.z;",
    "}",
    "float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }",
    "float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }",
    "float vnoise(vec3 x) {",
    "  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),",
    "             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);",
    "}",
    "float grain(vec3 w, float R, float px) {",
    "  float l = log2(max(1.0, R / px)); float o = floor(l), t = l - o;",
    "  float s0 = exp2(o), s1 = exp2(o + 1.0);",
    "  return mix(vnoise(w * s0), vnoise(w * s1), t);",
    "}",

    // The work a cell wears: its own, or with snow its snow's, or, below a
    // cell, its own or one of its eight nearest in colour.
    "int entryAt(ivec2 s, int k) {",
    // far off: a coarser cell, wearing the work of the cell at its middle
    "  if (k < 0) {",
    "    int m = -k, cx = GWI >> m, cy = GHI >> m;",
    "    s.x = ((s.x % cx) + cx) % cx; s.y = clamp(s.y, 0, cy - 1);",
    "    ivec2 c = s * (1 << m) + ivec2((1 << m) >> 1);",
    "    c.y = min(c.y, GHI - 1);",
    "    uvec4 dc = texelFetch(uDoors, c, 0);",
    "    uvec4 sc0 = texelFetch(uSeason, c, 0);",
    "    uint mc = sc0.r | ((sc0.g & 15u) << 8);",
    "    return ((mc >> uint(uMonth)) & 1u) == 1u ? int((dc.g >> 4) | (dc.b << 4)) : int(dc.r | ((dc.g & 15u) << 8));",
    "  }",
    "  int nx = GWI << k, ny = GHI << k;",
    "  s.x = ((s.x % nx) + nx) % nx; s.y = clamp(s.y, 0, ny - 1);",
    "  ivec2 b = s >> k;",
    "  if (k > 0) {",
    // dithered between this cell and its neighbours, by where in it the small cell lies
    "    uint h = pcg(uvec3(uint(s.x), uint(s.y), uint(k)));",
    "    int sc = 1 << k, q = 32768 >> k;",
    "    int tx = (2 * (s.x & (sc - 1)) + 1 - sc) * q, ty = (2 * (s.y & (sc - 1)) + 1 - sc) * q;",
    "    int r1 = int(h & 65535u), r2 = int(h >> 16);",
    "    b.x += tx >= 0 ? (r1 < tx ? 1 : 0) : (r1 < -tx ? -1 : 0);",
    "    b.y += ty >= 0 ? (r2 < ty ? 1 : 0) : (r2 < -ty ? -1 : 0);",
    "    b.x = ((b.x % GWI) + GWI) % GWI; b.y = clamp(b.y, 0, GHI - 1);",
    "  }",
    "  uvec4 d = texelFetch(uDoors, b, 0);",
    "  uvec4 se = texelFetch(uSeason, b, 0);",
    "  uint months = se.r | ((se.g & 15u) << 8);",
    "  int e = ((months >> uint(uMonth)) & 1u) == 1u ? int((d.g >> 4) | (d.b << 4)) : int(d.r | ((d.g & 15u) << 8));",
    "  if (k > 0) {",
    // one of the eight works nearest it in colour; water mostly keeps its own, and stays calm
    "    uint h2 = pcg(uvec3(uint(s.x), uint(s.y), uint(k + 16)));",
    "    uint keep = (se.g >> 4) <= 2u ? 7u : 3u;",
    "    if ((h2 & 7u) >= keep) {",
    "      int j = e * 8 + int((h2 >> 3) & 7u);",
    "      uvec4 sb = texelFetch(uSib, ivec2(j & 511, j >> 9), 0);",
    "      e = int(sb.r | (sb.g << 8));",
    "    }",
    "  }",
    "  return e;",
    "}",
    "vec3 colourOf(int e) { uvec4 p = texelFetch(uPal, ivec2(e & 63, e >> 6), 0); return vec3(p.rgb) / 255.0; }",
    // A level's cells, crisp to the device pixel (sharp bilinear), and whether this is the lit one.
    "vec4 cells(vec2 uv, int k, vec2 fwBase) {",
    "  float sc = exp2(float(k));",
    "  vec2 c = vec2(uv.x * float(GWI), uv.y * float(GHI)) * sc;",
    "  vec2 fw = max(fwBase * sc, vec2(1e-4));",
    "  vec2 p = c - 0.5; vec2 i0 = floor(p); vec2 f = p - i0;",
    "  vec2 wt = clamp((f - 0.5) / fw + 0.5, 0.0, 1.0);",
    "  ivec2 a = ivec2(i0);",
    "  vec3 c00 = colourOf(entryAt(a, k)), c10 = colourOf(entryAt(a + ivec2(1, 0), k));",
    "  vec3 c01 = colourOf(entryAt(a + ivec2(0, 1), k)), c11 = colourOf(entryAt(a + ivec2(1, 1), k));",
    "  vec3 col = mix(mix(c00, c10, wt.x), mix(c01, c11, wt.x), wt.y);",
    "  float lit = 0.0;",
    "  if (uSel.w > 0.0 && int(uSel.z) == k) {",
    "    vec2 here = floor(c); float nxk = float(GWI) * sc;",
    "    if (here.y == uSel.y && mod(here.x - uSel.x + nxk * 0.5, nxk) == nxk * 0.5) {",
    "      vec2 e = min(fract(c), 1.0 - fract(c)) / fw;",
    "      lit = uSel.w * (min(e.x, e.y) < 1.2 ? 1.0 : 0.55);",
    "    }",
    "  }",
    "  return vec4(col, lit);",
    "}",
    "vec3 toWorld(vec3 n) {",
    "  float wy = n.y * uRot.w + n.z * uRot.z, wz = -n.y * uRot.z + n.z * uRot.w;",
    "  return vec3(n.x * uRot.y + wz * uRot.x, wy, wz * uRot.y - n.x * uRot.x);",
    "}",
    "vec2 uvOf(vec3 w) {",
    "  float lat = asin(clamp(w.y, -1.0, 1.0)), lon = atan(w.x, w.z);",
    "  return vec2(fract(lon / TAU + 0.5), clamp(0.5 - lat / PI, 0.0, 0.99999));",
    "}",

    "void main() {",
    "  vec2 p = vec2(gl_FragCoord.x, uView.z - gl_FragCoord.y) / uDpr;",
    "  float R = uC.z;",
    "  vec2 q = vec2(p.x - uC.x, -(p.y - uC.y)) / R;",
    "  float d2 = dot(q, q);",
    "  float journey = uK.z, high = uK.y, near = uK.x;",
    "  float blur = uDof.z * smoothstep(0.35, 1.25, length(p - uDof.xy) / max(1.0, uDof.w));",
    "  blur = clamp(blur + uFeel.z * 0.2 * journey - uCrisp * 0.3 * journey, 0.0, 1.0);",
    "  if (d2 >= 1.0) {",
    // the rim of the air, and the stars far behind
    "    float r = sqrt(d2);",
    "    float th = clamp(0.03 * R, 1.0, 46.0) / R;",
    "    float a = exp(-(r - 1.0) / th * 2.6) * (0.34 + 0.3 * high);",
    "    vec3 c = mix(HAZE, HAZE_DEEP, 0.4) * a;",
    "    if (uSky.z > 0.002) {",
    "      vec2 s = p + uStar; vec2 cell = floor(s / 9.0); float h = hash2(cell);",
    "      if (h > 0.972) {",
    "        vec2 at = (cell + 0.2 + 0.6 * vec2(hash2(cell + 3.7), hash2(cell + 9.1))) * 9.0;",
    "        float sa = smoothstep(0.95, 0.15, length(s - at)) * (0.35 + 0.65 * fract(h * 37.0)) * uSky.z * (1.0 - a);",
    "        c += STAR * sa; a += sa * (1.0 - a);",
    "      }",
    "    }",
    "    outC = vec4(c, clamp(a, 0.0, 1.0));",
    "    return;",
    "  }",
    "  float nz = sqrt(1.0 - d2);",
    "  vec3 w = toWorld(vec3(q, nz));",
    "  vec2 uv = uvOf(w);",
    // how many cells to a pixel, without the jump where longitude wraps
    "  vec2 fwBase = vec2(fwidth(uv.x), fwidth(uv.y)) * vec2(float(GWI), float(GHI));",
    "  fwBase.x = min(fwBase.x, max(fwBase.y, 1e-4) * 8.0);",
    // crisp at every size: the level's cells are three device pixels or more
    // (levelFor); averaged only at the far limb, where they are foreshortened
    // under a pixel and a half, and on a journey's out-of-focus edges (in flight only)
    "  float cellPx = exp2(-min(uLevel.x, 0.0)) / max(max(fwBase.x, fwBase.y), 1e-6);",
    "  float smoothK = clamp(max(1.0 - smoothstep(0.75, 1.5, cellPx), smoothstep(0.15, 0.7, blur)) + uFeel.x * 0.3 * journey, 0.0, 1.0);",
    "  vec3 col; float lit = 0.0;",
    "  if (smoothK < 0.999) {",
    "    int k = int(uLevel.x);",
    "    vec4 a = cells(uv, k, fwBase);",
    "    if (uLevel.y > 0.001) { vec4 b = cells(uv, k + 1, fwBase); a = mix(a, b, uLevel.y); }",
    "    col = a.rgb; lit = a.a;",
    "  }",
    "  if (smoothK > 0.001) {",
    "    float lod = log2(max(max(fwBase.x, fwBase.y), 1e-6)) + blur * 1.6;",
    "    vec3 sm = textureLod(uCol, uv, max(lod, 0.0)).rgb;",
    "    col = smoothK >= 0.999 ? sm : mix(col, sm, smoothK);",
    "  }",
    // the light, from the land's height, the water and the canopy
    "  float plod = max(log2(max(max(fwBase.x, fwBase.y) * 2.0, 1e-6)) + blur * 3.0, 0.0);",
    "  vec3 pr = textureLod(uProps, uv, plod).rgb;",
    "  float wet = smoothstep(0.3, 0.7, pr.r);",
    "  float canopy = pr.g * (1.0 - wet);",
    "  float dx = 1.0 / 2048.0, dy = 1.0 / 1024.0;",
    "  float he = textureLod(uProps, uv + vec2(dx, 0.0), plod).b, hw = textureLod(uProps, uv - vec2(dx, 0.0), plod).b;",
    "  float hn = textureLod(uProps, uv - vec2(0.0, dy), plod).b, hs = textureLod(uProps, uv + vec2(0.0, dy), plod).b;",
    "  float cl = max(0.05, sqrt(1.0 - w.y * w.y));",
    "  float gx = (he * he - hw * hw) * 8800.0 / (2.0 * 19550.0 * cl), gy = (hn * hn - hs * hs) * 8800.0 / (2.0 * 19550.0);",
    "  float lon = atan(w.x, w.z);",
    "  vec3 east = vec3(cos(lon), 0.0, -sin(lon));",
    "  vec3 north = vec3(-w.y * sin(lon), cl, -w.y * cos(lon));",
    "  float ex = (22.0 + 10.0 * uFeel.w * journey) * (1.0 - wet);",
    "  vec3 nw = normalize(w - ex * (gx * east + gy * north));",
    // the water's surface: still at rest; on a journey over the sea, a slow shimmer
    "  float t = uK.w;",
    "  float sh = journey * uFeel.x * (1.0 - blur);",
    "  vec3 nwater = w;",
    "  if (sh > 0.001) {",
    "    float g1 = grain(w + vec3(t * 0.0009, 0.0, t * 0.0006), R, 28.0) - 0.5;",
    "    float g2 = grain(w * 1.3 - vec3(0.0, t * 0.0007, 0.0), R, 12.0) - 0.5;",
    "    nwater = normalize(w + (east * g1 + north * g2) * 0.05 * sh);",
    "  }",
    // the light: the real sun, softened on the ground of a city so it reads at any hour
    "  float day0 = dot(w, uSun);",
    "  float day = smoothstep(-0.14, 0.32, day0);",
    "  float lam = max(dot(nw, uSun), 0.0);",
    "  float relief = clamp(dot(nw, uSun) - day0, -0.6, 0.6);",
    "  float shade = mix(0.44, 0.74 + 0.36 * lam, day) + relief * (0.9 - 0.5 * wet);",
    "  shade = mix(shade, 0.66 + relief * 1.5, near);",
    "  shade = mix(1.0, shade, uSky.w);",
    "  shade *= 1.0 + 0.06 * uCrisp * journey;",
    "  col *= shade;",
    // the feel of the ground: a desert's fine dry grain, a forest's density
    "  float fg = journey * (uFeel.y * (1.0 - wet) + uFeel.w * canopy) * (1.0 - blur);",
    "  if (fg > 0.001) { col *= 1.0 + (grain(w * 1.9 + 4.2, R, 1.6) - 0.5) * 0.16 * fg; }",
    // the glint: the sun mirrored in open water, a sheen when the crossing is glassy
    "  vec3 V = toWorld(vec3(0.0, 0.0, 1.0));",
    "  vec3 Hh = normalize(uSun + V);",
    "  float glassy = journey * uFeel.x;",
    "  float spec = pow(max(dot(nwater, Hh), 0.0), mix(mix(90.0, 30.0, near), 22.0, glassy)) * day * wet * uSky.w;",
    "  col += GLINT * spec * (0.45 + 0.25 * glassy) * (1.0 - 0.8 * uFeel.y * journey);",
    // the air: thicker toward the limb; when high, over everything; damp and a little cooler in cloud and mountains
    "  float limb = pow(1.0 - nz, 2.2);",
    "  float air = limb * (0.6 - 0.4 * near) + journey * high * 0.08 + journey * uFeel.z * 0.08;",
    "  vec3 hz = mix(HAZE_DEEP, HAZE, 0.35 + 0.45 * day);",
    "  col = mix(col, hz * mix(0.55, 1.0, day), clamp(air, 0.0, 0.85));",
    // the month's cloud on a layer above the ground, swelling past you as you come down
    "  if (uSky.x > 0.002) {",
    "    float Rs = R * uSky.y;",
    "    vec2 qs = vec2(p.x - uC.x, -(p.y - uC.y)) / Rs;",
    "    float ds = dot(qs, qs);",
    "    if (ds < 1.0) {",
    "      vec3 ws = toWorld(vec3(qs, sqrt(1.0 - ds)));",
    "      float amt = dot(texture(uCloud, uvOf(ws)).rgb, uCloudCh);",
    "      float f = grain(ws + vec3(t * 0.0004, 0.0, 0.0), Rs, 70.0) * 0.7 + grain(ws * 2.3, Rs, 24.0) * 0.3;",
    "      float cov = smoothstep(1.02 - amt * 0.5, 1.26 - amt * 0.5, f + 0.2);",
    "      vec3 cc = mix(CLOUD_SHADE, CLOUD, 0.55 + 0.45 * smoothstep(0.45, 0.85, f)) * mix(0.6, 1.0, day);",
    "      col = mix(col, cc, cov * uSky.x * 0.62 * (1.0 - 0.5 * blur));",
    "    }",
    "  }",
    // the cell pointed at, lit
    "  col = mix(col, LIGHT, lit * 0.5);",
    "  outC = vec4(col, 1.0);",
    "}"
  ].join("\n").replace(/GWI/g, "1024").replace(/GHI/g, "512");

  var gl = null, canvas = null, prog = null, loc = {}, ready = false, failed = false;
  var month = 0, last = "";
  var D = null;            // the doors, in this script: door and season pixels, entries, works, siblings
  var sel = { i: 0, j: 0, k: 0, amt: 0 };

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      window.console.warn("earth body:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function setup() {
    canvas = document.createElement("canvas");
    try {
      gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false,
                                         preserveDrawingBuffer: false, depth: false, stencil: false });
    } catch (e) { gl = null; }
    if (!gl) { return false; }
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { return false; }
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ["uView", "uDpr", "uC", "uRot", "uSun", "uK", "uDof", "uSky", "uStar", "uFeel", "uCrisp", "uLevel", "uSel",
     "uMonth", "uCloudCh", "uCol", "uProps", "uCloud", "uDoors", "uSeason", "uPal", "uSib"].forEach(function (n) {
      loc[n] = gl.getUniformLocation(prog, n);
    });
    return true;
  }

  function image(url) {
    return new Promise(function (done, fail) {
      var img = new Image();
      img.onload = function () { done(img); };
      img.onerror = function () { fail(new Error(url)); };
      img.src = url;
    });
  }

  function pixels(img) {
    var c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    var x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, c.width, c.height).data;
  }

  function texture(unit, opts) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (opts.int) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, opts.w, opts.h, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, opts.data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      if (opts.data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, opts.w, opts.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, opts.data);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, opts.img);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (opts.mips) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.int ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /* ---- the doors, in this script ---------------------------------------- */

  // The same hash as the shader's pcg, in 32-bit unsigned arithmetic.
  function pcg(x, y, z) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    y = (Math.imul(y, 1664525) + 1013904223) >>> 0;
    z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
    x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0; y = (y ^ (y >>> 16)) >>> 0; z = (z ^ (z >>> 16)) >>> 0;
    x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
    return (x ^ y ^ z) >>> 0;
  }

  function snowy(b) {
    var o = b * 4, months = D.season[o] | ((D.season[o + 1] & 15) << 8);
    return (months >> month) & 1;
  }

  function entryAt(si, sj, k) {
    if (k < 0) {
      // Far off: a coarser cell, wearing the work of the cell at its middle (as the shader).
      var m = -k, cw = GW >> m, ch = GH >> m;
      si = ((si % cw) + cw) % cw;
      sj = Math.max(0, Math.min(ch - 1, sj));
      var ci = si * (1 << m) + ((1 << m) >> 1), cj = Math.min(GH - 1, sj * (1 << m) + ((1 << m) >> 1));
      var cb = cj * GW + ci, co = cb * 4;
      return snowy(cb) ? (D.doors[co + 1] >> 4) | (D.doors[co + 2] << 4) : D.doors[co] | ((D.doors[co + 1] & 15) << 8);
    }
    var nx = GW << k, ny = GH << k;
    si = ((si % nx) + nx) % nx;
    sj = Math.max(0, Math.min(ny - 1, sj));
    var bi = si >> k, bj = sj >> k;
    if (k > 0) {
      var h = pcg(si, sj, k), sc = 1 << k, q = 32768 >> k;
      var tx = (2 * (si & (sc - 1)) + 1 - sc) * q, ty = (2 * (sj & (sc - 1)) + 1 - sc) * q;
      var r1 = h & 65535, r2 = h >>> 16;
      bi += tx >= 0 ? (r1 < tx ? 1 : 0) : (r1 < -tx ? -1 : 0);
      bj += ty >= 0 ? (r2 < ty ? 1 : 0) : (r2 < -ty ? -1 : 0);
      bi = ((bi % GW) + GW) % GW;
      bj = Math.max(0, Math.min(GH - 1, bj));
    }
    var b = bj * GW + bi, o = b * 4;
    var e = snowy(b) ? (D.doors[o + 1] >> 4) | (D.doors[o + 2] << 4) : D.doors[o] | ((D.doors[o + 1] & 15) << 8);
    if (k > 0) {
      var h2 = pcg(si, sj, k + 16), keep = (D.season[o + 1] >> 4) <= 2 ? 7 : 3;
      if ((h2 & 7) >= keep) { e = D.sib[e * 8 + ((h2 >>> 3) & 7)]; }
    }
    return e;
  }

  /* The level a radius draws its cells at, and how far it has blended into
     the next. Under three device pixels a cell, the level is negative: cells
     of 2, 4, 8 … wearing one work each, so they are never under three pixels
     (CELL_FLOOR) and never averaged. d is the density the body is drawn at
     (device pixels to a CSS pixel; the last frame's when not given). */
  var CELL_FLOOR = 3;
  var drawDpr = Math.min(window.devicePixelRatio || 1, 3);
  function levelFor(R, d) {
    var cellPx = R * Math.PI / GH;
    var dev = cellPx * (d || drawDpr);
    if (dev < CELL_FLOOR) {
      var lc = Math.log(Math.max(1e-6, dev / CELL_FLOOR)) / Math.LN2;
      var kc = Math.max(-6, Math.floor(lc));
      var bc = Math.max(0, Math.min(1, (lc - kc - 0.82) / 0.18));
      if (kc === -6) { bc = 0; }
      return { k: kc, blend: bc * bc * (3 - 2 * bc), cellPx: cellPx, drawn: cellPx * Math.pow(2, -kc) };
    }
    var l = Math.log(Math.max(1e-6, cellPx / CELL_T)) / Math.LN2;
    var k = Math.max(0, Math.min(12, Math.floor(l)));
    var blend = l < 0 ? 0 : Math.max(0, Math.min(1, (l - k - 0.82) / 0.18));
    return { k: k, blend: blend * blend * (3 - 2 * blend), cellPx: cellPx, drawn: cellPx / Math.pow(2, k) };
  }

  /* The work under a point of the Earth, as the shader draws it at radius R:
     { id, e (its entry), colour, i, j, k (its cell) }. */
  function doorAt(lat, lon, R) {
    if (!D) { return null; }
    var L = levelFor(R), k = L.blend > 0.5 ? L.k + 1 : L.k;
    var u = (((lon / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
    var v = Math.max(0, Math.min(0.99999, 0.5 - lat / Math.PI));
    var i = k < 0 ? Math.floor(u * (GW >> -k)) : Math.floor(u * (GW << k));
    var j = k < 0 ? Math.floor(v * (GH >> -k)) : Math.floor(v * (GH << k));
    var e = entryAt(i, j, k);
    return { id: D.works[D.ew[e]], e: e, colour: D.hex[e], i: i, j: j, k: k };
  }

  // What the place is (CLASSES), and whether it is under snow or sea ice this month.
  function kindAt(lat, lon) {
    if (!D) { return null; }
    var u = (((lon / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
    var v = Math.max(0, Math.min(0.99999, 0.5 - lat / Math.PI));
    var b = Math.floor(v * GH) * GW + Math.floor(u * GW);
    return { kind: CLASSES[D.season[b * 4 + 1] >> 4] || "grass", snow: !!snowy(b) };
  }

  function start(m) {
    month = m - 1;
    if (failed || ready) { return Promise.resolve(ready); }
    if (!setup()) { failed = true; return Promise.resolve(false); }
    var season = Math.floor(month / 3);
    return Promise.all([image("earth-doors.webp"), image("earth-season.webp"), image("earth-props.webp"),
                        image("dirt/earth/cloud-" + season + ".webp"),
                        fetch("earth-doors.json").then(function (r) { return r.json(); })])
      .then(function (got) {
        var t = got[4], n = t.e.length;
        D = { doors: pixels(got[0]), season: pixels(got[1]), works: t.w, ew: t.e, sib: t.s,
              hex: [], col: new Uint8Array(n * 3) };
        for (var e = 0; e < n; e += 1) {
          var h = t.c.substr(e * 6, 6);
          D.hex.push("#" + h);
          var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
          D.col[e * 3] = r; D.col[e * 3 + 1] = g; D.col[e * 3 + 2] = b;
        }
        // The entries' colours and siblings, and the doors, as integer textures.
        var rows = Math.ceil(n / 64), pal = new Uint8Array(64 * rows * 4);
        for (e = 0; e < n; e += 1) { pal[e * 4] = D.col[e * 3]; pal[e * 4 + 1] = D.col[e * 3 + 1]; pal[e * 4 + 2] = D.col[e * 3 + 2]; pal[e * 4 + 3] = 255; }
        var srows = Math.ceil(n * 8 / 512), sib = new Uint8Array(512 * srows * 4);
        for (var s = 0; s < n * 8; s += 1) { sib[s * 4] = t.s[s] & 255; sib[s * 4 + 1] = t.s[s] >> 8; }
        // This month's colour of every cell, averaged down for far off and out of focus.
        var colour = new Uint8Array(GW * GH * 4);
        for (var b2 = 0; b2 < GW * GH; b2 += 1) {
          var o = b2 * 4, ee = snowy(b2) ? (D.doors[o + 1] >> 4) | (D.doors[o + 2] << 4) : D.doors[o] | ((D.doors[o + 1] & 15) << 8);
          colour[o] = D.col[ee * 3]; colour[o + 1] = D.col[ee * 3 + 1]; colour[o + 2] = D.col[ee * 3 + 2]; colour[o + 3] = 255;
        }
        texture(0, { w: GW, h: GH, data: colour, mips: true });
        texture(1, { img: got[2], mips: true });
        texture(2, { img: got[3] });
        texture(3, { int: true, w: GW, h: GH, data: new Uint8Array(D.doors.buffer.slice(0)) });
        texture(4, { int: true, w: GW, h: GH, data: new Uint8Array(D.season.buffer.slice(0)) });
        texture(5, { int: true, w: 64, h: rows, data: pal });
        texture(6, { int: true, w: 512, h: srows, data: sib });
        ["uCol", "uProps", "uCloud", "uDoors", "uSeason", "uPal", "uSib"].forEach(function (u, i) { gl.uniform1i(loc[u], i); });
        gl.uniform1i(loc.uMonth, month);
        var ch = month % 3;
        gl.uniform3f(loc.uCloudCh, ch === 0 ? 1 : 0, ch === 1 ? 1 : 0, ch === 2 ? 1 : 0);
        ready = true;
        return true;
      })
      .catch(function (e) { failed = true; window.console.warn("earth body: not loaded", e && e.message); return false; });
  }

  /* One frame. o: W, H, dpr, cx, cy, R, spin, sinT, cosT, sun ([x, y, z] in
     the world), near, high, journey, time, focus {x, y, amt, r}, cloud,
     shell, stars, starX, starY, light, feel [glass, grain, damp, dense],
     crisp. Drawn again only when something in it has changed. */
  function draw(o) {
    if (!ready) { return null; }
    var pw = Math.max(1, Math.round(o.W * o.dpr)), ph = Math.max(1, Math.round(o.H * o.dpr));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; last = ""; }
    var f = o.focus || { x: o.W / 2, y: o.H / 2, amt: 0, r: 1 };
    var feel = o.feel || [0, 0, 0, 0];
    var moving = o.journey && (feel[0] > 0.01 || o.cloud > 0.002);
    var key = [o.cx, o.cy, o.R, o.spin, o.sinT, o.near, o.high, o.journey, f.x, f.y, f.amt, o.cloud, o.shell,
               o.stars, o.starX, o.starY, o.light, o.sun[0].toFixed(4), o.sun[1].toFixed(4), o.sun[2].toFixed(4),
               feel.join(), o.crisp, sel.i, sel.j, sel.k, sel.amt, moving ? o.time : 0, pw, ph].join();
    if (key === last) { return canvas; }
    last = key;
    drawDpr = pw / o.W;
    var L = levelFor(o.R, drawDpr);
    gl.viewport(0, 0, pw, ph);
    gl.uniform3f(loc.uView, o.W, o.H, ph);
    gl.uniform1f(loc.uDpr, pw / o.W);
    gl.uniform3f(loc.uC, o.cx, o.cy, o.R);
    gl.uniform4f(loc.uRot, Math.sin(o.spin), Math.cos(o.spin), o.sinT, o.cosT);
    gl.uniform3f(loc.uSun, o.sun[0], o.sun[1], o.sun[2]);
    gl.uniform4f(loc.uK, o.near, o.high, o.journey, o.time);
    gl.uniform4f(loc.uDof, f.x, f.y, f.amt, f.r);
    gl.uniform4f(loc.uSky, o.cloud, o.shell, o.stars, o.light);
    gl.uniform2f(loc.uStar, o.starX, o.starY);
    gl.uniform4f(loc.uFeel, feel[0], feel[1], feel[2], feel[3]);
    gl.uniform1f(loc.uCrisp, o.crisp || 0);
    gl.uniform3f(loc.uLevel, L.k, L.blend, L.cellPx);
    gl.uniform4f(loc.uSel, sel.i, sel.j, sel.k, sel.amt);
    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Only the globe and its air are shaded (the stars, when there are any, are everywhere):
    // a small globe costs its own area, so it never has to be drawn coarser to keep up.
    if (!(o.stars > 0.002)) {
      var m = o.R + 3 * Math.min(46, Math.max(1, 0.03 * o.R)) + 2, s = pw / o.W;
      var x0 = Math.max(0, Math.floor((o.cx - m) * s)), x1 = Math.min(pw, Math.ceil((o.cx + m) * s));
      var y0 = Math.max(0, Math.floor((o.cy - m) * s)), y1 = Math.min(ph, Math.ceil((o.cy + m) * s));
      if (x1 <= x0 || y1 <= y0) { return canvas; }
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x0, ph - y1, x1 - x0, y1 - y0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    return canvas;
  }

  // The cell pointed at, lit (amt 0 puts it out).
  function light(door, amt) {
    if (!door) { sel.amt = 0; return; }
    sel.i = door.i; sel.j = door.j; sel.k = door.k; sel.amt = amt;
  }

  window.EarthBody = { start: start, draw: draw, doorAt: doorAt, kindAt: kindAt,
                       light: light, levelFor: levelFor, ready: function () { return ready; },
                       density: function () { return drawDpr; },
                       canvas: function () { return canvas; } };
})();

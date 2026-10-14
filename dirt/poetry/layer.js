/* DRIFT Poetry's pages, laid on DRIFT.

   This runs inside DRIFT's own page (build_poetry.py appends it): DRIFT draws its ground as it always does, and just
   after it, on the same frame, this draws the pages of Picture Poetry over it, each whole, on a canvas of its own
   over DRIFT's ground and its living things (which pass under a page's paper, seen through it where it thins).
   Outside the pages the canvas is clear, so everything else is DRIFT as published. The pages lie on a lattice of squares 2584 pixels wide, one to a square, scattered a little and turned
   as if laid by hand, dealt along the rows two apart so that no two neighbours hold the same page; the lattice is
   anchored where the visit begins, on a page chosen at random.

   Each page is painted in one of four ways, after four stills of DRIFT: its photograph printed in halftone with a
   soft dark disc and fine rainbow arcs beyond it; whole in its middle and coming apart cell by cell toward its edge;
   held in a white cloud with golden kaleidoscopes round it; torn and laid again. The page's paper dissolves into
   DRIFT at a wash's wandering edge, the poem keeps a calm paper under it so it can be read, a watercolour softens the
   paint, and last the page's own type, rules, buildings and characters are printed on it, sharp.

   Nothing here moves on its own: the pages are drawn again only when DRIFT's view moves. */
(function () {
  "use strict";
  const SPEC = __POETRY__;
  if (typeof GLG === "undefined" || !GLG || /(?:^|&)nopoetry(?:&|$)/.test(location.hash.slice(1))) return;
  const stage = document.getElementById("stage"), field = document.getElementById("field");
  const lay = document.createElement("canvas");
  lay.setAttribute("aria-hidden", "true");
  lay.style.pointerEvents = "none";
  // (the drawing kept between frames: the pages are drawn only when the view moves, and a still taken in between
  //  must still find them)
  const gl = lay.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  if (!gl) return;
  stage.insertBefore(lay, field.nextSibling);          // over DRIFT's ground and its living things, so a poem stays clear
  new MutationObserver(() => { lay.style.visibility = field.style.visibility; }).observe(field, { attributes: true, attributeFilter: ["style"] });
  const NP = SPEC.pages.length;

  // ---- the shaders -----------------------------------------------------------------------------------------------
  const COMMON = `
precision highp float; precision highp int; precision highp sampler2DArray;
const float PHI = 1.618033988749895, P1 = 0.618033988749895, P2 = 0.381966011250105, P4 = 0.145898033750315;
const float G = ${SPEC.G.toFixed(1)};          // a page to each square this wide (plane pixels)
const float S = P1;                            // plane pixels to a page pixel
const int NP = ${NP};
uniform vec4 uPageA[NP];         // each page: its width and height (page pixels), whether it lies on its side in the
                                 // ink texture, and whether its photograph does in the photo texture
uniform vec4 uPhotoR[NP];        // where each page sets its photograph (page pixels: left, top, right, bottom)
uniform vec4 uTextR[NP];         // where each sets its poem
uniform ivec2 uAnchor;           // the lattice square the visit began in
uniform int uFirst;              // and the page it holds
uniform vec2 uShift;             // the lattice's offset, so that square's page lies where the visit began
uint mixh(uint h) { h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16; return h; }
uint h3(int x, int y, uint s) { return mixh(uint(x) * 0x27d4eb2du ^ mixh(uint(y) * 0x165667b1u + s)); }
float unit(uint h) { return float(h >> 8) * (1.0 / 16777216.0); }
float vnoise(vec2 p, float g, uint s) {
  vec2 f = p / g, i = floor(f), t = f - i; t = t * t * (3.0 - 2.0 * t);
  ivec2 q = ivec2(i);
  return mix(mix(unit(h3(q.x, q.y, s)), unit(h3(q.x + 1, q.y, s)), t.x), mix(unit(h3(q.x, q.y + 1, s)), unit(h3(q.x + 1, q.y + 1, s)), t.x), t.y);
}
float fbm(vec2 p, float g, uint s) { return 0.5 * vnoise(p, g, s) + 0.3 * vnoise(p, g * P1, s + 1u) + 0.2 * vnoise(p, g * P2, s + 2u); }
mat2 turn(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
/** A square's middle, where its page lies: moved a little by its own hash. */
vec2 seedOf(ivec2 c, out uint h) {
  h = h3(c.x, c.y, 53u);
  return (vec2(c) + 0.5 + P4 * (vec2(unit(mixh(h + 1u)), unit(mixh(h + 2u))) - 0.5)) * G + uShift;
}
/** Which page a square holds: dealt along the rows two apart, so no two neighbours hold the same page. */
int pageOf(ivec2 c) { int v = c.x - uAnchor.x + 2 * (c.y - uAnchor.y) + uFirst; return v - NP * int(floor(float(v) / float(NP))); }
float tilt(uint h) { return 0.0557 * (unit(mixh(h + 9u)) - 0.5); }   // as laid by hand: within a degree and a half
vec2 toPage(vec2 p, vec2 C, uint h, int pg) { return turn(-tilt(h)) * (p - C) / S + 0.5 * uPageA[pg].xy; }
struct Pg { vec2 q; int pg; uint h; float e; };
/** The page nearest p: where p falls on it (page pixels), which page, its square's hash, and how far outside its
 *  edge p lies (negative within). */
Pg pageAt(vec2 p) {
  ivec2 g0 = ivec2(floor((p - uShift) / G));
  Pg best = Pg(vec2(0.0), 0, 0u, 1e9);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 c = g0 + ivec2(i, j);
    uint h; vec2 C = seedOf(c, h);
    int pg = pageOf(c);
    vec2 q = toPage(p, C, h, pg), hw = 0.5 * uPageA[pg].xy;
    float e = sdBox(q - hw, hw);
    if (e < best.e) best = Pg(q, pg, h, e);
  }
  return best;
}
`;
  const VS = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  // The paint, premultiplied: what each page lays over DRIFT, and how much of DRIFT it covers.
  const PAINT = `#version 300 es
${COMMON}
uniform sampler2DArray uPhoto;   // the photographs, as the pages hold them, mipmapped
uniform vec3 uPaper[NP];         // each page's own paper
uniform vec3 uAccent[NP];        // each page's accent, for its halftone, brushstrokes and kaleidoscopes
uniform int uLean[NP];           // the still each page leans to
uniform vec2 uOrigin;            // the plane at the paint's top left
uniform float uCell;             // plane pixels a texel
uniform vec2 uSize;              // texels
out vec4 outC;
const vec3 WHITE = vec3(248.0, 246.0, 241.0), FIBRE = vec3(252.0, 251.0, 247.0), BLACK = vec3(0.0);
vec4 acc;                        // premultiplied, 0 to 255: what has been laid so far
/** Lay colour c over what is there, covering t of it. */
void put(vec3 c, float t) { t = clamp(t, 0.0, 1.0); acc = vec4(mix(acc.rgb, c, t), mix(acc.a, 255.0, t)); }
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)) / 255.0; }
/** Which still a page is painted after here: each leans to one and visits the other three. */
int modeOf(int pg, uint h) {
  int lean = uLean[pg];
  float u = unit(mixh(h + 11u));
  if (u < P2) return lean;
  int k = lean + 1 + int(min(2.0, floor((u - P2) / P1 * 3.0)));
  return k > 3 ? k - 4 : k;
}
vec3 photo(int pg, vec2 f, float lod) {
  f = clamp(f, 0.0, 1.0);
  if (uPageA[pg].w > 0.5) f = vec2(1.0 - f.y, f.x);
  return textureLod(uPhoto, vec3(f, float(pg)), lod).rgb * 255.0;
}
vec2 photoF(int pg, vec2 q) { vec4 R = uPhotoR[pg]; return (q - R.xy) / (R.zw - R.xy); }
/** Where the disc sits: just beyond the photograph's far edge, away from the poem, never far off the page. */
vec2 discAt(vec2 rc, vec2 rh, vec2 away, float rd, vec2 hw) {
  float reach = abs(away.x) * rh.x + abs(away.y) * rh.y;
  return clamp(rc + away * (reach + 0.5 * rd), vec2(-89.0), 2.0 * hw + 89.0);
}
/** Fine arcs in rainbow colours round a centre, a rainbow drawn in hairlines (the first still). */
void arcs(vec2 q, vec2 ca, float R, uint h, float amt) {
  float r = length(q - ca);
  float band = smoothstep(R - 340.0, R - 146.0, r) * (1.0 - smoothstep(R + 146.0, R + 372.0, r));
  float s = fract(r / 14.6), line = exp(-pow((s - 0.5) / 0.16, 2.0));
  vec3 hue = 255.0 * (0.66 + 0.3 * cos(6.2832 * (r / 610.0 + unit(h) + vec3(0.0, 0.33, 0.67))));
  put(hue * 0.88, band * line * amt);
}
/** A soft dark disc, as the sun leaves on the eye (the first still). */
void disc(vec2 q, vec2 cd, float rd, uint h) {
  float e = length(q - cd) + 11.0 * (vnoise(q, 34.0, h + 37u) - 0.5);
  put(vec3(62.0, 58.0, 55.0) * (0.86 + 0.28 * vnoise(q, 21.0, h + 38u)), (1.0 - smoothstep(rd - 16.0, rd + 16.0, e)) * 0.94);
}
/** Light caught on the paper: thin soft streaks (the fourth still). */
void glints(vec2 q, vec2 at, uint h) {
  for (int k = 0; k < 4; k++) {
    uint hk = mixh(h + 100u + uint(k) * 3u);
    vec2 c = at + turn(6.2832 * unit(hk)) * vec2(404.0 * unit(mixh(hk + 1u)), 0.0);
    vec2 l = turn(-6.2832 * unit(mixh(hk + 2u))) * (q - c);
    float s = exp(-abs(l.y) / 2.1) * exp(-abs(l.x) / (36.0 + 48.0 * unit(mixh(hk + 3u))));
    s = max(s, 0.6 * exp(-abs(l.x) / 2.1) * exp(-abs(l.y) / 14.6));
    put(vec3(253.0, 252.0, 249.0), s * 0.7);
  }
}
/** A white cloud, and in it the page's photograph seen in five mirrors standing at 36 degrees: the pentagon's
 *  symmetry, where cos 36 degrees is phi / 2. Two brush strokes lie in the wedge between the mirrors, so ten images
 *  make a star, and the same star again phi^2 smaller in its middle (the third still). */
void rosette(vec2 q, vec2 ck, float rb, int pg, uint hk) {
  vec2 d = q - ck;
  float r = length(d);
  float edge = r + rb * 0.42 * (vnoise(q, rb * 0.55, hk + 3u) - 0.5) + 8.0 * (vnoise(q, 5.0, hk + 4u) - 0.5);
  float blob = 1.0 - smoothstep(rb * 1.3, rb * 1.3 + 21.0, edge);
  if (blob <= 0.0) return;
  float w = 3.14159265 / 5.0, a = atan(d.y, d.x) + 6.2832 * unit(mixh(hk + 5u));
  float i = floor(a / w), f = a - i * w;
  if (mod(i, 2.0) > 0.5) f = w - f;
  vec3 star = WHITE;
  for (int lv = 0; lv < 2; lv++) {
    float rr = r * (lv == 0 ? 1.0 : PHI * PHI), fade = lv == 0 ? 1.0 : P1;
    vec2 wq = rr * vec2(cos(f), sin(f));
    for (int sk = 0; sk < 2; sk++) {
      float sa = (sk == 0 ? 0.25 : 0.72) * w + 0.12 * w * (unit(mixh(hk + 20u + uint(sk))) - 0.5);
      vec2 dir = vec2(cos(sa), sin(sa));
      float r0 = rb * (sk == 0 ? 0.22 : 0.48), r1 = rb * (sk == 0 ? 0.78 : 1.02);
      float t = clamp(dot(wq, dir), r0, r1), dist = length(wq - dir * t);
      float wd = (sk == 0 ? 10.5 : 7.3) * (1.0 - 0.45 * smoothstep(r0, r1, t));
      float s = 1.0 - smoothstep(wd - 2.4, wd + 2.4, dist + 3.2 * (vnoise(wq, 5.0, hk + 9u) - 0.5));
      vec3 src = photo(pg, 0.15 + 0.7 * vec2(unit(mixh(hk + 30u + uint(sk))), unit(mixh(hk + 32u + uint(sk)))), 2.0);
      vec3 ink = lum(src) < 0.42 ? vec3(44.0, 41.0, 42.0) : uAccent[pg];
      star = mix(star, ink, s * fade * (0.78 + 0.22 * vnoise(wq, 8.0, hk + 11u)));
    }
  }
  put(star, blob);
}
/** A soft stroke of a loaded brush, thinning dry at its ends (the second still). */
void stroke(vec2 q, vec2 c, float a, float len, float wd, vec3 ink, uint hk) {
  vec2 l = turn(-a) * (q - c);
  float e = length(vec2(max(abs(l.x) - len, 0.0), l.y)) - wd * (1.0 - 0.35 * smoothstep(0.4, 1.0, abs(l.x) / len))
            + 5.0 * (vnoise(q, 6.5, hk + 5u) - 0.5);
  put(ink, (1.0 - smoothstep(-3.2, 4.0, e)) * (0.72 + 0.28 * vnoise(l, 8.0, hk + 7u)));
}

// ---- the page's photograph, after each still (q in page pixels) ------------------------------------------------
/** Printed in halftone over a pale wash of itself: dots where it is dark, in its own colours leaning to the page's
 *  accent, at 45 degrees (the first still). */
void photoHalftone(vec2 q, int pg, uint h, float er) {
  float edge = er + 11.0 * (vnoise(q, 21.0, h + 150u) - 0.5) + 4.0 * (vnoise(q, 5.0, h + 151u) - 0.5);
  float inside = 1.0 - smoothstep(-15.0, 0.0, edge);
  if (inside <= 0.0) return;
  vec3 ph = photo(pg, photoF(pg, q), 1.2);
  vec3 base = mix(mix(ph, vec3(lum(ph) * 255.0), 0.24), uPaper[pg], 0.38);
  mat2 t = turn(0.785398);
  float per = 21.0;
  vec2 g = t * q / per, cell = floor(g) + 0.5, f = g - cell;
  vec3 pc = photo(pg, photoF(pg, transpose(t) * cell * per), 2.4);
  float rr = 0.44 * sqrt(clamp((1.0 - lum(pc) - 0.18) * 1.5, 0.0, 1.0));
  float dt = 1.0 - smoothstep(rr - 0.09, rr + 0.09, length(f));
  put(mix(base, mix(pc * 0.78, uAccent[pg], 0.42), dt * 0.72), inside);
}
/** Whole in its middle, coming apart cell by cell toward its edge, the cells drifting out (the second still). */
void photoKnot(vec2 q, int pg, uint h, float er, vec2 rh) {
  float bw = 0.26 * min(rh.x, rh.y);
  float inset = -er + 0.55 * bw * (fbm(q, 89.0, h + 152u) - 0.5);
  if (inset < -0.62 * bw) return;
  if (inset >= bw) { put(photo(pg, photoF(pg, q), 0.8), 1.0); return; }
  vec2 cell = floor(q / 13.0);
  uint hc = h3(int(cell.x), int(cell.y), h + 153u);
  float keep = smoothstep(-0.62 * bw, bw, inset);
  if (unit(hc) > keep * keep * 1.1) return;
  vec2 cc = (cell + 0.5) * 13.0 + 3.0 * (vec2(unit(mixh(hc + 3u)), unit(mixh(hc + 4u))) - 0.5);
  vec2 crumb = vec2(2.6 + 3.4 * unit(mixh(hc + 5u)), 2.6 + 3.4 * unit(mixh(hc + 6u)));
  vec3 c = photo(pg, photoF(pg, cc + 13.0 * (vec2(unit(mixh(hc + 1u)), unit(mixh(hc + 2u))) - 0.5)), 0.6);
  put(c, 1.0 - smoothstep(-0.5, 1.5, sdBox(q - cc, crumb)));
}
/** Held in a white cloud: its edge a cloud's, thinning to white toward the rim (the third still). */
void photoCloud(vec2 q, int pg, uint h, float er, vec2 rh) {
  float s = min(rh.x, rh.y);
  float e = er + 0.18 * s * (fbm(q, 0.3 * s, h + 154u) - 0.5) + 8.0 * (vnoise(q, 6.5, h + 155u) - 0.5);
  float blob = 1.0 - smoothstep(0.0, 34.0, e);
  if (blob <= 0.0) return;
  float inside = 1.0 - smoothstep(-55.0, -13.0, e);
  put(mix(WHITE, mix(photo(pg, photoF(pg, q), 0.9), WHITE, 0.1), inside), blob);
}
/** Torn into pieces and laid again, each a little moved and turned, the torn edges white with fibre, casting a soft
 *  shadow on what lies under them (the fourth still). */
void photoTorn(vec2 q, int pg, uint h, vec2 rc, vec2 rh) {
  float size = 0.95 * min(rh.x, rh.y);
  vec2 qw = q + 34.0 * (vec2(vnoise(q, 55.0, h + 160u), vnoise(q, 55.0, h + 161u)) - 0.5)
              + 10.0 * (vec2(vnoise(q, 11.0, h + 162u), vnoise(q, 11.0, h + 163u)) - 0.5);
  ivec2 g0 = ivec2(floor(qw / size));
  float d1 = 1e18, d2 = 1e18; uint p1 = 0u, p2 = 0u;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 c = g0 + ivec2(i, j);
    uint hc = h3(c.x, c.y, h + 164u);
    vec2 S2 = (vec2(c) + 0.5 + 0.8 * (vec2(unit(mixh(hc + 1u)), unit(mixh(hc + 2u))) - 0.5)) * size;
    float dd = dot(qw - S2, qw - S2);
    if (dd < d1) { d2 = d1; p2 = p1; d1 = dd; p1 = hc; }
    else if (dd < d2) { d2 = dd; p2 = hc; }
  }
  float e = 0.5 * (sqrt(d2) - sqrt(d1));
  bool firstOnTop = unit(mixh(p1 + 5u)) > unit(mixh(p2 + 5u));
  float se = firstOnTop ? e : -e;
  float ov = 8.0 + 6.0 * vnoise(q, 8.0, h + 165u);
  bool onTop = se > -ov;
  uint pc = onTop == firstOnTop ? p1 : p2;
  vec2 off = 21.0 * (vec2(unit(mixh(pc + 1u)), unit(mixh(pc + 2u))) - 0.5);
  vec2 src = rc + turn(0.035 * (unit(mixh(pc + 3u)) - 0.5)) * (q - rc) - off;
  float tear = sdBox(src - rc, rh) + 11.0 * (vnoise(q, 15.0, h + 166u) - 0.5) + 3.2 * (vnoise(q, 4.0, h + 167u) - 0.5);
  if (tear > 0.0) { put(BLACK, 0.1 * (1.0 - smoothstep(0.0, 15.0, tear))); return; }
  vec3 frag = photo(pg, photoF(pg, src), 0.7);
  frag = mix(frag, WHITE, 0.16 * smoothstep(-rh.x, rh.x, dot(q - rc, vec2(0.7071, -0.7071))));
  float rimP = onTop ? smoothstep(-ov, -ov + 1.6, se) * (1.0 - smoothstep(-ov + 2.6, -ov + 5.8 + 3.2 * vnoise(q, 5.0, h + 168u), se)) : 0.0;
  float rimE = smoothstep(-5.8 - 3.2 * vnoise(q, 5.0, h + 169u), -1.6, tear);
  frag = mix(frag, FIBRE, max(rimP, rimE) * 0.9);
  if (!onTop) frag *= 1.0 - 0.11 * (1.0 - smoothstep(0.0, 13.0, -ov - se));
  put(frag, 1.0);
}

/** A page laid on DRIFT, after the still it is painted in. */
void pageLayer(vec2 q, int pg, uint h) {
  int m = modeOf(pg, h);
  vec2 hw = 0.5 * uPageA[pg].xy;
  vec4 R = uPhotoR[pg], T = uTextR[pg];
  vec2 rc = 0.5 * (R.xy + R.zw), rh = 0.5 * (R.zw - R.xy);
  vec2 tc = 0.5 * (T.xy + T.zw), th = 0.5 * (T.zw - T.xy);
  float wob = 55.0 * (fbm(q, 233.0, h + 140u) - 0.5) + 13.0 * (vnoise(q, 34.0, h + 141u) - 0.5);
  float sheet = 1.0 - smoothstep(-144.0, 0.0, sdBox(q - hw, hw) + wob);   // the page's paper, its edge a wash's
  float tz = 1.0 - smoothstep(-89.0, 0.0, sdBox(q - tc, th + 55.0) + 0.6 * wob);   // the calm under the poem
  if (m == 3) {                                                      // the poem on its own torn sheet
    put(uPaper[pg], sheet * 0.38);
    float te = sdBox(q - tc, th + 55.0) + 13.0 * (vnoise(q, 21.0, h + 170u) - 0.5) + 4.0 * (vnoise(q, 5.5, h + 171u) - 0.5);
    if (te < 0.0) put(mix(uPaper[pg] * (0.985 + 0.03 * vnoise(q, 3.2, h + 172u)), FIBRE,
                          (1.0 - smoothstep(1.0, 5.8 + 2.4 * vnoise(q, 3.2, h + 173u), -te)) * 0.9), 1.0);
    else put(BLACK, 0.12 * (1.0 - smoothstep(0.0, 21.0, sdBox(q - tc - vec2(8.0, 11.0), th + 55.0))));
  } else {
    put(uPaper[pg], max(sheet * (m == 0 ? 0.62 : 0.38), tz * 0.95));
  }
  float er = sdBox(q - rc, rh);
  vec2 away = normalize(rc - tc + vec2(1e-3, 0.0));                  // from the poem toward the photograph
  if (m == 0) {
    photoHalftone(q, pg, h, er);
    float rd = 0.2 * min(rh.x, rh.y) + 34.0 * unit(mixh(h + 36u));
    vec2 cd = discAt(rc, rh, away, rd, hw);
    arcs(q, cd, length(rc - cd) * (0.8 + 0.3 * unit(mixh(h + 31u))), h, 0.45 * (1.0 - tz) * sheet);
    disc(q, cd, rd, h);
  } else if (m == 1) {
    photoKnot(q, pg, h, er, rh);
    for (int k = 0; k < 3; k++) {                                    // upright strokes across its far edge
      uint hk = mixh(h + 110u + uint(k) * 5u);
      vec2 c = vec2(rc.x + sign(away.x) * rh.x * (0.86 + 0.28 * unit(hk)), rc.y + rh.y * (unit(mixh(hk + 1u)) - 0.5) * 1.2);
      stroke(q, c, 1.5708 + 0.15 * (unit(mixh(hk + 2u)) - 0.5), 0.12 * rh.y + 0.14 * rh.y * unit(mixh(hk + 3u)),
             11.0 + 10.0 * unit(mixh(hk + 4u)), unit(mixh(hk + 6u)) < 0.62 ? uAccent[pg] : vec3(50.0, 47.0, 46.0), hk);
    }
  } else if (m == 2) {
    photoCloud(q, pg, h, er, rh);
    for (int k = 0; k < 3; k++) {                                    // kaleidoscopes round it, clear of the poem
      uint hk = mixh(h + 90u + uint(k) * 7u);
      float a = 6.2832 * unit(hk);
      vec2 ck = k == 0 ? rc + sign(away) * rh * 0.8 : rc + vec2(cos(a), sin(a)) * rh * (0.9 + 0.3 * unit(mixh(hk + 1u)));
      ck = clamp(ck, vec2(144.0), 2.0 * hw - 144.0);
      float rb = 74.0 + 68.0 * unit(mixh(hk + 2u));
      if (sdBox(ck - tc, th) > rb * 1.5) rosette(q, ck, rb, pg, hk);
    }
  } else {
    photoTorn(q, pg, h, rc, rh);
    glints(q, rc, h);
  }
}

void main() {
  vec2 p = uOrigin + vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) * uCell;
  acc = vec4(0.0);
  Pg g = pageAt(p);
  if (g.e < 377.0) pageLayer(g.q, g.pg, g.h);
  outC = acc / 255.0;
}`;

  // The screen: a watercolour over the paint, then each page's type, rules, buildings and characters, printed on it.
  const FINAL = `#version 300 es
${COMMON}
uniform sampler2D uPaint;
uniform sampler2DArray uInk;     // each page with its paper taken away, premultiplied
uniform vec2 uOrigin;            // the plane at the screen's top left
uniform float uScale;            // plane pixels a device pixel
uniform vec2 uView;              // device pixels
uniform vec2 uPaintSize;
uniform vec2 uPaintScale;        // paint texels a device pixel
out vec4 outColour;
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  vec2 p = uOrigin + fc * uScale;
  vec2 tp = gl_FragCoord.xy * uPaintScale, ts = 1.0 / uPaintSize;
  // the watercolour: the colours bleed into their neighbours, the pigment is denser and thinner over the paper's
  // grain and in slow pools and gathers at the rim of every wash
  vec4 own = texture(uPaint, tp * ts), soft = vec4(0.0);
  float sw = 0.0; vec2 gr = vec2(0.0);
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 o = vec2(dx, dy) * 1.5;
    vec4 kk = texture(uPaint, (tp + o) * ts);
    float w = exp(-dot(o, o) / 2.618);
    soft += w * kk; sw += w;
    gr += vec2(dx, dy) * lum(kk.rgb);
  }
  soft /= sw;
  vec4 c4 = mix(own, soft, 0.62);
  float grain = vnoise(p, 1.2, 7u) * 0.6 + vnoise(p, 3.0, 8u) * 0.4;
  vec4 outc = vec4(0.0);
  if (c4.a > 0.002) {
    vec3 c = c4.rgb / c4.a;
    float edge = smoothstep(0.06, 0.5, length(gr) / 3.0);
    float pool = vnoise(p, 89.0, 9u) * 0.62 + vnoise(p, 34.0, 10u) * 0.38;
    float dd = 1.0 + 0.34 * (grain - 0.5) + 0.5 * (pool - 0.5) + 0.236 * edge;
    c = clamp(c - (c - c * c) * (dd - 1.0), 0.0, 1.0);
    c = mix(c, c * (0.97 + 0.06 * grain), 0.5);                      // the paper's tooth
    outc = vec4(c * c4.a, c4.a);
  }
  Pg g = pageAt(p);
  if (g.e < 0.0) {
    vec2 wh = uPageA[g.pg].xy;
    vec2 uv = uPageA[g.pg].z > 0.5 ? vec2(1.0 - g.q.y / wh.y, g.q.x / wh.x) : g.q / wh;
    vec4 ink = texture(uInk, vec3(uv, float(g.pg)));
    float k = 0.94 * (0.95 + 0.05 * grain);
    outc = outc * (1.0 - ink.a * k) + ink * k;
  }
  outColour = outc;
}`;

  function compile(src, type) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(VS, gl.VERTEX_SHADER)); gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  let paintProg, finalProg;
  try { paintProg = program(PAINT); finalProg = program(FINAL); }
  catch (err) { console.warn("DRIFT Poetry: the pages could not be drawn:", err.message); lay.remove(); return; }
  gl.bindVertexArray(gl.createVertexArray());

  // ---- the lattice in JavaScript, to begin on a page, to name the page underfoot, and to draw only where pages are --
  const imul = Math.imul, P4 = 0.145898033750315, P1 = 0.618033988749895, G = SPEC.G;
  function mixh(h) { h ^= h >>> 16; h = imul(h, 0x7feb352d); h ^= h >>> 15; h = imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0; }
  function h3(x, y, s) { return mixh((imul(x | 0, 0x27d4eb2d) ^ mixh((imul(y | 0, 0x165667b1) + (s >>> 0)) >>> 0)) >>> 0); }
  const unit = (h) => (h >>> 8) / 16777216;
  let anchor = [0, 0], first = 0, shift = [0, 0];
  function seedOf(cx, cy) {
    const h = h3(cx, cy, 53);
    return { x: (cx + 0.5 + P4 * (unit(mixh((h + 1) >>> 0)) - 0.5)) * G + shift[0], y: (cy + 0.5 + P4 * (unit(mixh((h + 2) >>> 0)) - 0.5)) * G + shift[1], h };
  }
  const pageOf = (cx, cy) => { const v = cx - anchor[0] + 2 * (cy - anchor[1]) + first; return v - NP * Math.floor(v / NP); };
  /** The page whose square holds the plane point (x, y), and how far the point lies outside it (plane pixels). */
  function pageNear(x, y) {
    const gx = Math.floor((x - shift[0]) / G), gy = Math.floor((y - shift[1]) / G);
    let best = null;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const s = seedOf(gx + i, gy + j), pg = pageOf(gx + i, gy + j), P = SPEC.pages[pg];
      const a = -0.0557 * (unit(mixh((s.h + 9) >>> 0)) - 0.5), c = Math.cos(a), sn = Math.sin(a);
      const dx = (x - s.x) / P1, dy = (y - s.y) / P1, qx = c * dx - sn * dy, qy = sn * dx + c * dy;
      const e = Math.max(Math.abs(qx) - P.size[0] / 2, Math.abs(qy) - P.size[1] / 2) * P1;
      if (!best || e < best.e) best = { pg, e, s };
    }
    return best;
  }
  /** Whether any page (with the reach of its paint) touches the plane rectangle x0..x1, y0..y1. */
  function anyPage(x0, y0, x1, y1) {
    const reach = 377 * P1 + 0.62 * 1920 * P1;
    for (let gy = Math.floor((y0 - shift[1] - reach) / G); gy <= Math.floor((y1 - shift[1] + reach) / G); gy++)
      for (let gx = Math.floor((x0 - shift[0] - reach) / G); gx <= Math.floor((x1 - shift[0] + reach) / G); gx++) {
        const s = seedOf(gx, gy);
        if (s.x + reach > x0 && s.x - reach < x1 && s.y + reach > y0 && s.y - reach < y1) return true;
      }
    return false;
  }

  // ---- the textures --------------------------------------------------------------------------------------------
  function loadImage(src) { return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error(src)); im.src = src; }); }
  function layers(unitN, images, w, h, premultiply) {
    gl.activeTexture(gl.TEXTURE0 + unitN);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, w, h, images.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    images.forEach((im, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, im));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  let paintTex = null, fbo = null, FW = 0, FH = 0;
  function paintTarget(fw, fh) {
    if (fw === FW && fh === FH) return;
    FW = fw; FH = fh;
    if (paintTex) gl.deleteTexture(paintTex);
    gl.activeTexture(gl.TEXTURE2);
    paintTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, paintTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, FW, FH);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    if (!fbo) fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, paintTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---- drawing, in step with DRIFT --------------------------------------------------------------------------------
  // How coarsely to paint (screen pixels a paint texel): 2 at rest; while the view moves, coarser if moving frames
  // come slowly, so a swipe is never left behind; at rest it is drawn once more at its finest.
  const STEPS = [2, 3, 4];
  let ready = false, anchored = false, step = 0, moveStep = 0, last = null, movedAt = 0, slow = 0, fast = 0, restAt = 0;
  function view() {
    // DRIFT's view: vx, vy (its top left, in cells), R canvas pixels a cell, and the canvas's device pixels a CSS pixel
    const dpr = field.width / Math.max(1, field.clientWidth);
    return { W: field.width, H: field.height, dpr, x: Math.round(vx * R) / dpr, y: Math.round(vy * R) / dpr };
  }
  function anchorAt(v) {
    // the lattice square the visit begins in, and its page: chosen at random, or #pageN
    const want = location.hash.match(/(?:^|[#&])page(\d+)(?:&|$)/);
    first = want ? Math.max(0, Math.min(NP - 1, +want[1] - 1)) : Math.floor(Math.random() * NP);
    anchor = [Math.floor((Math.random() - 0.5) * 120), Math.floor((Math.random() - 0.5) * 120)];
    shift = [0, 0];
    const s = seedOf(anchor[0], anchor[1]), P = SPEC.pages[first];
    let cx = v.x + v.W / v.dpr / 2, cy = v.y + v.H / v.dpr / 2;
    if (field.clientWidth < 700) {                                    // on a narrow screen, begin on the poem
      const a = 0.0557 * (unit(mixh((s.h + 9) >>> 0)) - 0.5), c = Math.cos(a), sn = Math.sin(a);
      const qx = ((P.textR[0] + P.textR[2]) / 2 - P.size[0] / 2) * P1, qy = ((P.textR[1] + P.textR[3]) / 2 - P.size[1] / 2) * P1;
      cx -= c * qx - sn * qy; cy -= sn * qx + c * qy;
    }
    shift = [cx - s.x, cy - s.y];
    for (const pr of [paintProg, finalProg]) {
      gl.useProgram(pr.p);
      gl.uniform2i(pr.u.uAnchor, anchor[0], anchor[1]);
      gl.uniform1i(pr.u.uFirst, first);
      gl.uniform2f(pr.u.uShift, shift[0], shift[1]);
    }
    anchored = true;
  }
  function clear() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, lay.width, lay.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  }
  function draw(now) {
    if (!ready || typeof placed === "undefined" || !placed) return;
    if (typeof MODE !== "undefined" && MODE !== "plane") { if (last) { clear(); last = null; nameAt(null); } return; }
    const v = view();
    if (!anchored) anchorAt(v);
    const moved = !last || v.x !== last.x || v.y !== last.y || v.W !== last.W || v.H !== last.H || v.dpr !== last.dpr;
    if (moved) {
      if (last && now - movedAt < 100) {                              // moving all the while since the last frame
        const dt = now - movedAt;
        if (dt > 24) { slow++; fast = 0; } else if (dt < 17.5) { fast++; slow = Math.max(0, slow - 1); }
        if (slow >= 8 && moveStep < STEPS.length - 1) { moveStep++; slow = 0; }
        else if (fast >= 144 && moveStep > 0) { moveStep--; fast = 0; }
      }
      movedAt = now; step = last ? moveStep : 0; restAt = now + 233;
    } else if (step !== 0 && now >= restAt) step = 0;                 // at rest, drawn once more at its finest
    else return;                                                      // nothing has changed: the pages stay as drawn
    last = v;
    if (lay.width !== v.W || lay.height !== v.H) { lay.width = v.W; lay.height = v.H; }
    const sc = 1 / v.dpr, x1 = v.x + v.W * sc, y1 = v.y + v.H * sc;
    clear();
    if (!anyPage(v.x, v.y, x1, y1)) { nameAt(null); return; }
    const k = STEPS[step];
    paintTarget(Math.ceil(v.W / k), Math.ceil(v.H / k));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, FW, FH);
    gl.useProgram(paintProg.p);
    gl.uniform2f(paintProg.u.uOrigin, v.x, v.y);
    gl.uniform1f(paintProg.u.uCell, k * sc);
    gl.uniform2f(paintProg.u.uSize, FW, FH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, v.W, v.H);
    gl.useProgram(finalProg.p);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, paintTex);
    gl.uniform2f(finalProg.u.uOrigin, v.x, v.y);
    gl.uniform1f(finalProg.u.uScale, sc);
    gl.uniform2f(finalProg.u.uView, v.W, v.H);
    gl.uniform2f(finalProg.u.uPaintSize, FW, FH);
    gl.uniform2f(finalProg.u.uPaintScale, FW / v.W, FH / v.H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    nameAt(pageNear(v.x + v.W * sc / 2, v.y + v.H * sc / 2));
  }
  const groundDraw = GLG.draw;
  GLG.draw = function (now) { groundDraw(now); try { draw(now); } catch (err) { console.warn("DRIFT Poetry:", err.message); ready = false; } };
  if (typeof composite === "function") {                              // DRIFT's stills and recordings show the pages too
    const groundStill = composite;
    window.composite = function () {
      groundStill();
      const c = SNAP.cv;
      if (ready && lay.width) c.getContext("2d").drawImage(lay, 0, 0, c.width, c.height);
    };
  }

  // ---- the page underfoot, named in DRIFT's own caption type --------------------------------------------------------
  const label = document.createElement("div");
  label.className = "poetry-label";
  label.setAttribute("aria-live", "polite");
  label.innerHTML = '<span class="t"></span><span class="s"></span>';
  const style = document.createElement("style");
  style.textContent = ".poetry-label{position:absolute;left:13px;bottom:13px;max-width:calc(100% - 26px);padding:5px 13px 7px;" +
    "background:rgba(20,14,10,.56);color:var(--ink);pointer-events:none;opacity:0;transition:opacity .9s ease;display:flex;" +
    "gap:13px;align-items:baseline;white-space:nowrap;overflow:hidden}.poetry-label.on{opacity:1}" +
    ".poetry-label .t{font:italic 400 17px/1.25 var(--serif);flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis}" +
    ".poetry-label .s{color:var(--muted);font-size:11px;letter-spacing:.06em;text-transform:uppercase;min-width:0;overflow:hidden;text-overflow:ellipsis}" +
    "@media (prefers-reduced-motion:reduce){.poetry-label{transition:none}}";
  document.head.appendChild(style);
  stage.appendChild(label);
  let named = -1;
  function nameAt(near) {
    const pg = near && near.e < 233 ? near.pg : -1;
    if (pg === named) return;
    named = pg;
    if (pg < 0) { label.classList.remove("on"); return; }
    const P = SPEC.pages[pg];
    label.querySelector(".t").textContent = P.name;
    label.querySelector(".s").textContent = "Picture Poetry, page " + P.n;
    label.classList.add("on");
  }

  // ---- the pages arrive ----------------------------------------------------------------------------------------
  Promise.all([Promise.all(SPEC.pages.map((p) => loadImage(p.photo))), Promise.all(SPEC.pages.map((p) => loadImage(p.ink)))])
    .then(([photos, inks]) => {
      layers(0, photos, SPEC.photoSize[0], SPEC.photoSize[1], false);
      layers(1, inks, SPEC.inkSize[0], SPEC.inkSize[1], true);
      const flat = (f) => new Float32Array(SPEC.pages.flatMap(f));
      for (const pr of [paintProg, finalProg]) {
        gl.useProgram(pr.p);
        gl.uniform4fv(pr.u.uPageA, flat((p) => [p.size[0], p.size[1], p.turned ? 1 : 0, p.photoTurned ? 1 : 0]));
        gl.uniform4fv(pr.u.uPhotoR, flat((p) => p.photoR));
        gl.uniform4fv(pr.u.uTextR, flat((p) => p.textR));
      }
      gl.useProgram(paintProg.p);
      gl.uniform1i(paintProg.u.uPhoto, 0);
      gl.uniform3fv(paintProg.u.uPaper, flat((p) => p.paper));
      gl.uniform3fv(paintProg.u.uAccent, flat((p) => p.accent));
      gl.uniform1iv(paintProg.u.uLean, new Int32Array(SPEC.pages.map((p) => p.lean)));
      gl.useProgram(finalProg.p);
      gl.uniform1i(finalProg.u.uPaint, 2);
      gl.uniform1i(finalProg.u.uInk, 1);
      ready = true;
    })
    .catch((err) => { console.warn("DRIFT Poetry: the pages did not arrive:", err.message); lay.remove(); });
  lay.addEventListener("webglcontextlost", (e) => { e.preventDefault(); ready = false; });
})();

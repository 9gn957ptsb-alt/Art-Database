// ---- DIRT's ground on the GPU ----------------------------------------------------------------------------
// Where the page has WebGL2 it paints the ground itself, every frame, from what each cell is made of (the workers
// send that instead of pixels), so the ground's colours can change as they are watched. Left as grown, it paints
// what the workers would have.
//
// Each passage moves through the colours its painting can take, a change about every 55 seconds (times
// phi^+-1/2): the painting's colours turned by the golden angle once, twice, three or four times and laid on
// fully, the soil's lights and darks choosing where in the palette each dot falls; another painting's colours,
// turned; its lights and darks swapped; two of its colours only; and, a phi^-3 share of the time, its colours as
// grown. Nearly every painting saved is brown, gold or rust, so the turns are what carry the ground out of them:
// to teal, violet, green, blue, rose.
//
// A change sweeps across its passage from a point in it, 34 cells a second, in a front of three lobes and five
// smaller ones. Where it passes, shapes in the new colours build up over the old ground, in the passage's
// character: square tiles for a mosaic, four-pointed stars for a nocturne, round airbrushed spots for a spray,
// strips crossing over and under for a weave, runs down the columns for drips. Then they break down, into pieces
// of 8, 5, 3 and 2 cells and then single cells (a spray's straight to dust), and the new ground shows through. The Earth's places move only among the five paintings nearest their look,
// so they stay themselves, and each new month sweeps over the Earth the same way, out from the view's middle.

const GROUND_VS = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// The second pass: each pixel takes its cell's colour for the top left pixel, or for the other three.
const GROUND_PX = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uA, uB;
uniform ivec2 uOff, uCell0;
uniform int uH, uEdge;
out vec4 outColour;
// Drawn after the artists, no edge is a hard line. Across every edge of every shape, in every world, lies a grey
// gradient running the whole scale from dark to light, the same scale the artists make over the whole plane: the
// smallest thing on the plane holds what the largest does. The gradient is found from the cells around the pixel
// (five by five, weighted by nearness to the pixel itself, so it runs smoothly at the pixel's own size): where they
// span a wide range of light, the pixel takes the grey of where it stands between their darkest and lightest,
// strongest halfway across the edge and fading into the colours on either side.
void main() {
  ivec2 X = ivec2(gl_FragCoord.xy);
  X.y = uH - 1 - X.y;
  ivec2 G = X + uOff, t = (G >> 1) - uCell0;
  vec4 own = (G & 1) == ivec2(0) ? texelFetch(uA, t, 0) : texelFetch(uB, t, 0);
  outColour = own;
  if (uEdge == 0) return;
  ivec2 sz = textureSize(uB, 0) - 1;
  vec2 P = vec2(G) + 0.5;
  float lo = 1.0, hi = 0.0, sw = 0.0, sl = 0.0;
  for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
    ivec2 c = t + ivec2(dx, dy);
    float l = dot(texelFetch(uB, clamp(c, ivec2(0), sz), 0).rgb, vec3(0.3, 0.59, 0.11));
    vec2 d = (vec2(c + uCell0) * 2.0 + 1.0 - P) / 3.0;               // in 3-pixel steps
    float w = exp(-dot(d, d));
    lo = min(lo, l); hi = max(hi, l); sw += w; sl += w * l;
  }
  float e = hi - lo;
  if (e < 0.08) return;
  float g = clamp((sl / sw - lo) / e, 0.0, 1.0);
  float a = smoothstep(0.08, 0.38, e) * 4.0 * g * (1.0 - g) * 0.618;
  float v = 0.04 + 0.92 * g;
  outColour = vec4(mix(own.rgb, vec3(v, v * 0.994, v * 0.985), a), 1.0);
}`;

// The first pass, a fragment a cell: its two colours.
const GROUND_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2DArray;
precision highp sampler2DArray;
precision highp sampler2D;

uniform usampler2DArray uCells;     // three words a cell, 256 by 256 a chunk, a layer a chunk
uniform sampler2DArray uEnts;       // 32 texels a palette entry, 256 entries a chunk
uniform sampler2D uSlots;           // 16 by 16 chunks round the view: layer + 1, the layer it replaces + 1, when it came
uniform sampler2D uVivid;           // the saved paintings with the most colour, three texels each
uniform ivec2 uCell0, uC0;           // the first cell drawn; the first chunk of the 16 by 16
uniform int uEarth, uNV;
uniform float uTime, uHold, uTurnAt;
uniform vec2 uTurnO;
uniform vec3 uGround;
uniform sampler2D uArt;             // the artist's works as measured: paper, five inks darkest first, then roles
uniform int uArtOn, uForce;
uniform sampler2D uWorks;           // the collection: per painting its artist and year, then its three colours
float gCov = 0.0;                   // the marks the last sheet painted here, and in what colour
vec3 gMark = vec3(0);         // uForce: one grammar everywhere, for looking at it (#g0 to #g4)
uniform ivec2 uGram[5];             // each grammar's works: first row, count
vec2 gP;                            // the cell being painted, on the plane
vec2 gMid;                          // the middle of its passage
float gGate = 1.0;                  // how much of a sheet's marks are drawn yet (while it is being drawn)

const float PHI = 1.618033988749895, P1 = 0.618033988749895, P2 = 0.381966011250105, P3 = 0.236067977499790, P4 = 0.145898033750315;
const float GA = 2.399963229728653;                                  // the golden angle
const int MOSAIC = 0, NOCTURNE = 1, SPRAY = 2, WEAVE = 3, DRIP = 4;
const float KIND_KEY[5] = float[5](1.272019649514069, 1.0, 1.272019649514069, 1.0, 1.0);
const float TINT[4] = float[4](0.0, P3, P2, P1);
const float E_AT[5] = float[5](0.0, P4, 0.42, 1.0 - P4, 1.0);
const int FRAG[5] = int[5](8, 5, 3, 2, 1);                           // the pieces they break into
const float DUR = 8.0, SPEED = 34.0;                                 // a change: seconds at a place, cells a second across

uint mixh(uint h) { h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16; return h; }
uint h3(int x, int y, uint s) { return mixh(uint(x) * 0x27d4eb2du ^ mixh(uint(y) * 0x165667b1u + s)); }
float unit(uint h) { return float(h >> 8) * (1.0 / 16777216.0); }
float chroma(vec3 c) { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
float smoothUp(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
int fdiv(int a, int b) { return a >= 0 ? a / b : -((b - 1 - a) / b); }
/** A turn about the grey axis by t radians, as the worker's turnRGB(), as a matrix. */
mat3 turnOf(float t) {
  float co = cos(t), si = sin(t), k = (1.0 - co) / 3.0, q = sqrt(1.0 / 3.0) * si;
  return mat3(co + k, k + q, k - q, k - q, co + k, k + q, k + q, k - q, co + k);
}
vec3 turnRGB(vec3 c, mat3 m) { return clamp(m * c, 0.0, 255.0); }
vec3 satur(vec3 c) { float l = lum(c); return clamp(l + (c - l) * PHI, 0.0, 255.0); }

struct Cell { vec3 soil; int s, L, ti, e, te, en, eb; bool even, over; float d, light, pe; };
Cell cellAt(int layer, ivec2 lc) {
  uvec3 w = texelFetch(uCells, ivec3(lc, layer), 0).xyz;
  Cell c;
  c.soil = vec3(uvec3(w.x, w.x >> 8, w.x >> 16) & 255u);
  uint f = w.x >> 24;
  c.s = int(f & 3u); c.L = int((f >> 2) & 3u); c.ti = int((f >> 4) & 3u); c.even = (f & 64u) != 0u; c.over = (f & 128u) != 0u;
  c.e = int(w.y & 255u); c.te = int((w.y >> 8) & 255u); c.d = float((w.y >> 16) & 255u) / 255.0; c.light = float(w.y >> 24) / 127.5;
  c.en = int(w.z & 255u); c.pe = float((w.z >> 8) & 255u) / 255.0; c.eb = int((w.z >> 16) & 255u);
  return c;
}
vec4 entT(int layer, int e, int t) { return texelFetch(uEnts, ivec3(t, e, layer), 0); }

// A passage's colours for one stretch of time. mode 0: as grown; 1: laid on fully; 2: two colours; 3: lights and
// darks swapped. n: golden-angle turns; w: which vivid painting, or -1 its own; cand: the Earth's palette, onward.
struct State { int mode, n, w, cand; };
int gGram = 0;                                                       // the grammar of the passage being painted
State rawState(uint seed, int k) {
  if (uEarth == 0 && uArtOn == 1) {
    ivec2 g = uGram[min(gGram, 3)];                                  // one of the works of the passage's grammar
    uint h = mixh(seed ^ (uint(max(k, -1) + 1) * 0x9e3779b9u));
    return State(0, 0, g.x + int((uHold > 0.5 ? mixh(seed) : h) % uint(max(1, g.y))), 0);
  }
  if (k < 0 || uHold > 0.5) return State(0, 0, -1, 0);
  uint h = mixh(seed ^ (uint(k) * 0x9e3779b9u));
  float home = uEarth == 1 ? P2 : P3;
  bool back = unit(h) < home, wasBack = k > 0 && unit(mixh(seed ^ (uint(k - 1) * 0x9e3779b9u))) < home;
  if (back && !wasBack) return State(0, 0, -1, 0);                 // as grown again, now and then, never twice running
  if (uEarth == 1) return State(1, 0, -1, 1 + int(mixh(h + 1u) % 4u));
  float b = unit(mixh(h + 2u));
  int w = (uNV == 0 || unit(mixh(h + 3u)) < P1) ? -1 : int(mixh(h + 4u) % uint(uNV));
  return State(b < P1 ? 1 : b < P1 + P3 ? 2 : 3, 1 + int(mixh(h + 5u) % 4u), w, 0);
}
State stateOf(uint seed, int k) {
  State s = rawState(seed, k), p = rawState(seed, k - 1);
  if (uEarth == 0 && uArtOn == 1) {
    ivec2 g = uGram[min(gGram, 3)];
    if (s.w == p.w && g.y > 1) s.w = g.x + (s.w - g.x + 1) % g.y;
    return s;
  }
  if (s == p && s.mode != 0) { s.n = s.n % 4 + 1; s.cand = s.cand % 4 + 1; }   // a change always changes something
  return s;
}

void sort3(inout vec3 a, inout vec3 b, inout vec3 c) {
  vec3 t;
  if (lum(a) > lum(b)) { t = a; a = b; b = t; }
  if (lum(b) > lum(c)) { t = b; b = c; c = t; }
  if (lum(a) > lum(b)) { t = a; a = b; b = t; }
}
/** An entry's gradient map in a state: five stops, and (on the plane as grown) the lightness each stands at. */
void paletteOf(int layer, int e, State S, out vec3 st[5], out float at[5]) {
  if (uEarth == 1) {
    int nc = max(1, int(entT(layer, e, 25).w)), c = (int(entT(layer, e, 26).x) + S.cand) % nc;
    for (int n = 0; n < 5; n++) { st[n] = entT(layer, e, c * 5 + n).rgb; at[n] = E_AT[n]; }
    return;
  }
  if (S.mode == 0) {
    for (int n = 0; n < 5; n++) { vec4 v = entT(layer, e, n); st[n] = v.rgb; at[n] = v.a; }
    return;
  }
  vec3 a, b, c;
  if (S.w < 0) { a = entT(layer, e, 1).rgb; b = entT(layer, e, 2).rgb; c = entT(layer, e, 3).rgb; }
  else {
    mat3 pt = turnOf(entT(layer, e, 26).w);                           // another painting, turned as the passage is
    a = satur(turnRGB(texelFetch(uVivid, ivec2(0, S.w), 0).rgb, pt));
    b = satur(turnRGB(texelFetch(uVivid, ivec2(1, S.w), 0).rgb, pt));
    c = satur(turnRGB(texelFetch(uVivid, ivec2(2, S.w), 0).rgb, pt));
  }
  mat3 m = turnOf(float(S.n) * GA);
  a = turnRGB(a, m); b = turnRGB(b, m); c = turnRGB(c, m);
  sort3(a, b, c);
  st[0] = a * P2; st[1] = a; st[2] = b; st[3] = c; st[4] = c + (255.0 - c) * P1;
  at[0] = 0.0; at[1] = lum(a); at[2] = lum(b); at[3] = lum(c); at[4] = 255.0;
}
/** The colour at lightness l in a gradient map (as the worker's mapped()). */
vec3 byLight(vec3 st[5], float at[5], float l) {
  int n = 0;
  for (int i = 0; i < 3; i++) if (n == i && l > at[i + 1]) n = i + 1;
  return mix(st[n], st[n + 1], clamp((l - at[n]) / max(1.0, at[n + 1] - at[n]), 0.0, 1.0));
}
/** The colour at place t (0 to 1) along a gradient map (as the Earth's mappedPos()). */
vec3 byPlace(vec3 st[5], float t) {
  int n = 0;
  for (int i = 0; i < 3; i++) if (n == i && t > E_AT[i + 1]) n = i + 1;
  return mix(st[n], st[n + 1], clamp((t - E_AT[n]) / (E_AT[n + 1] - E_AT[n]), 0.0, 1.0));
}
/** A cell's light: the forest's, keyed by the passage's character, and a clearing's sun (less on colours laid on fully). */
float lightOf(Cell c, int kind, float sun) { return c.light * pow(KIND_KEY[kind], smoothUp(P3, P1, c.d)) * (1.0 + sun * (1.0 - smoothUp(0.0, P1, c.d))); }
vec3 nocturne(vec3 col, int kind, float st) {
  if (kind != NOCTURNE || st <= 0.0) return col;
  return lum(col) < 144.0 ? col * (1.0 - (1.0 - P4) * st) : col + (255.0 - col) * P2 * st;
}
vec3 groundIn(State S, vec3 st[5]) { return S.mode == 0 ? uGround : st[0] * P1; }
vec3 crownE(int layer, Cell c, State S) {
  int nc = max(1, int(entT(layer, c.te, 25).w)), k = (int(entT(layer, c.te, 26).x) + S.cand) % nc;
  return entT(layer, c.te, k * 5 + 1 + c.ti).rgb;
}


// ---- sheets after the artist ------------------------------------------------------------------------
// With the artist on, the plane is paper, as the artist's works are: each passage a sheet after one of the saved
// works (its paper, its inks, as measured), marked in the grammar of the passage's character, the marks showing
// only where the soil has a dot, so the collection's dirt is the crayon's grain; and the soil rubbed faintly into
// the paper, more out in the outskirts. The grammars, after Twombly: 0 collage (Natural History), 1 chalk on a
// blackboard (On the Bowery), 2 blooms that drip (Summer Madness, the Roses), 3 writing (Roman Notes), 4 a wash that
// runs down in drips over bushes of colour (Lepanto, Camino Real).
float vnoise(vec2 p, float g, uint s) {
  vec2 f = p / g, i = floor(f), t = f - i;
  t = t * t * (3.0 - 2.0 * t);
  ivec2 q = ivec2(i);
  return mix(mix(unit(h3(q.x, q.y, s)), unit(h3(q.x + 1, q.y, s)), t.x), mix(unit(h3(q.x, q.y + 1, s)), unit(h3(q.x + 1, q.y + 1, s)), t.x), t.y);
}
vec3 artPaper(int w) { return texelFetch(uArt, ivec2(0, w), 0).rgb; }
vec3 artInk(int w, int i) { return texelFetch(uArt, ivec2(1 + i, w), 0).rgb; }
vec4 artRoles(int w) { return texelFetch(uArt, ivec2(6, w), 0); }   // most colourful ink, next, count, marked share
vec3 artVivid(int w, int n) { return artInk(w, int(artRoles(w)[n])); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

/** Distance from p to the segment a-b. */
float segd(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; return length(p - a - ab * clamp(dot(p - a, ab) / max(1e-4, dot(ab, ab)), 0.0, 1.0)); }
/**
 * Writing, as in Roman Notes: in each row, a pen moves right while circling, so its line loops over itself, leaning
 * right, pointed at the turns; two lines to a row in two of the work's inks, the second finer; the pen lifts
 * between phrases and presses harder and softer as it goes. Returns coverage; which line in ink.
 */
float writing(vec2 p, uint salt, float dens, float row, out int ink) {
  float best = 0.0;
  ink = 0;
  int r0 = int(floor(p.y / row));
  for (int dr = -1; dr <= 1; dr++) {
    int r = r0 + dr;
    uint hr = h3(r, 7, salt);
    for (int L = 0; L < 2; L++) {
      uint hl = mixh(hr + uint(L) * 977u);
      float A = row * (0.16 + 0.08 * unit(hl)), B = row * (0.26 + 0.1 * unit(mixh(hl + 1u))), v = A * (0.75 + 0.35 * unit(mixh(hl + 2u)));
      float y0 = (float(r) + 0.5) * row + (unit(mixh(hl + 3u)) - 0.5) * row * 0.25, ph = 6.2832 * unit(mixh(hl + 4u));
      float lean = 0.7 + 0.3 * unit(mixh(hl + 5u));
      vec2 q = vec2(p.x - (p.y - y0) * lean, p.y);                   // unlean the point into the pen's frame
      float t0 = (q.x - A * 1.25) / v, t1 = (q.x + A * 1.25) / v, dmin = 1e9, tb = 0.0;
      vec2 prev = vec2(0);
      for (int n = 0; n <= 22; n++) {
        float t = mix(t0, t1, float(n) / 22.0);
        float sz = 0.75 + 0.45 * vnoise(vec2(t, float(r * 2 + L)), 3.0, salt + 8u), ang = t + ph;
        float zig = unit(hl) < 0.3 ? asin(sin(ang)) * 0.6366 : sin(ang);   // some hands zigzag, sharp at the turns
        vec2 pt = vec2(v * t + A * sz * cos(ang), y0 + B * sz * zig + row * 0.1 * sin(t * 0.21 + ph));
        if (n > 0) { float d = segd(q, prev, pt); if (d < dmin) { dmin = d; tb = t; } }
        prev = pt;
      }
      // phrases: the pen is down for some turns and lifted for others
      float phr = tb / 55.0 + 7.0 * unit(mixh(hl + 6u));             // long phrases: the line runs on
      if (unit(h3(int(floor(phr)), r * 2 + L, salt + 5u)) > min(1.0, dens * 1.3)) continue;
      float lift = smoothstep(0.0, 0.03, fract(phr)) * smoothstep(1.0, 0.97, fract(phr));   // the pen comes down, and lifts
      float press = 0.45 + 0.55 * vnoise(vec2(tb * 3.0, float(r * 2 + L)), 5.0, salt + 6u);
      float w = (L == 0 ? 1.3 : 0.8) * (0.6 + 0.6 * press);
      float grain = unit(h3(int(p.x), int(p.y), salt + 12u));          // crayon skipping on the paper's tooth
      float cov = clamp(w + 0.5 - dmin, 0.0, 1.0) * (0.55 + 0.45 * press) * lift * (grain < 0.2 ? 0.35 : 1.0);
      if (cov > best) { best = cov; ink = L; }
    }
  }
  return best;
}
/**
 * Blooms, as in Summer Madness, Pan and the Roses: a head knotted of thick loops laid one over another, in the
 * work's colours, over a dark heart, with stems flung out from the heart; drips running down; splatter.
 * Returns coverage; which ink in ink: 0 the heart, 1 and 2 the colours, 3 the lightest.
 */
float blooms(vec2 p, uint salt, float dens, float drip, out int ink) {
  // they stand in rows 233 cells apart, 89 cells or so from one to the next, as the Roses and Lepanto do
  const float GX = 89.0, GY = 144.0;
  p -= gMid - vec2(0.0, GY);                                          // two rows, either side of the passage's middle
  ivec2 sq = ivec2(floor(p.x / GX), floor(p.y / GY));
  float best = 0.0;
  ink = 0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 q = sq + ivec2(i, j);
    uint h = h3(q.x, q.y, salt);
    if (unit(h) > dens * 1.2 || (q.y != 0 && q.y != 1)) continue;
    float yrow = (float(q.y) + 0.5 + 0.2 * (vnoise(vec2(float(q.x) * GX, 0.0), 377.0, salt + 12u) - 0.5)) * GY;
    vec2 C = vec2((float(q.x) + 0.15 + 0.7 * unit(mixh(h + 1u))) * GX, yrow + 21.0 * (unit(mixh(h + 2u)) - 0.5)), D = p - C;
    float R = 34.0 + 34.0 * unit(mixh(h + 3u)), r = length(D);
    if (r > R * 1.9 && (D.y < 0.0 || abs(D.x) > R)) continue;
    float cov = 0.0;
    int k = 0;
    // the head: a full round mass of paint, rimmed irregularly
    float a = atan(D.y, D.x), rim = R * 0.62 * (1.0 + 0.12 * sin(5.0 * a + 6.2832 * unit(mixh(h + 7u))) + 0.08 * sin(9.0 * a));
    vec2 Dh = D + vec2(0.0, R * 0.3);
    if (length(Dh) < rim) { cov = 1.0; k = vnoise(p, 5.0, h + 3u) < 0.45 ? 2 : 1; }
    // one long drip from its foot, thinning to a bead
    float dl = R * (2.2 + 1.4 * unit(mixh(h + 8u))), dx = D.x - R * 0.05 * sin(D.y * 0.05);
    if (D.y > 0.0 && D.y < dl && abs(dx) < 1.6 - 0.8 * D.y / dl) { cov = 1.0; k = 1; }
    if (abs(D.y - dl) < 1.8 && abs(dx) < 1.8) { cov = 1.0; k = 1; }
    // the heart: a dark knot
    if (r < R * 0.3 * (1.0 + 0.3 * sin(3.0 * a + 6.2832 * unit(mixh(h + 4u))))) { cov = 1.0; k = 0; }
    // stems flung out from the heart, thick at the root
    for (int n = 0; n < 5; n++) {
      uint hn = mixh(h + 20u + uint(n));
      float an = 6.2832 * unit(hn), len = R * (0.8 + 0.8 * unit(mixh(hn + 1u)));
      vec2 dir = vec2(cos(an), sin(an));
      float t = dot(D, dir), dd = abs(dot(D, vec2(-dir.y, dir.x)) + 3.0 * sin(t * 0.15 + 6.0 * unit(hn)));
      if (t > 0.0 && t < len && dd < 3.5 * (1.0 - 0.7 * t / len)) { cov = 1.0; k = 1 + int(hn % 2u); }
    }
    // the head: thick dabs of paint, each over the ones before, and a few loops scrawled through them
    for (int n = 0; n < 55; n++) {
      uint hn = mixh(h + 40u + uint(n));
      float an = 6.2832 * unit(hn), rad = R * 0.7 * sqrt(unit(mixh(hn + 1u)));
      vec2 o = C + rad * vec2(cos(an), sin(an)) - vec2(0.0, R * 0.3);
      vec2 dir = vec2(cos(an + 1.3 * (unit(mixh(hn + 2u)) - 0.5)), sin(an + 1.3 * (unit(mixh(hn + 2u)) - 0.5)));
      float len = R * (0.12 + 0.2 * unit(mixh(hn + 3u))), w = 3.0 + 5.0 * unit(mixh(hn + 4u));
      float d = segd(p, o - dir * len, o + dir * len) + 1.5 * (vnoise(p, 3.0, hn) - 0.5);
      if (d < w) {
        cov = 1.0; k = n % 6 == 5 ? 3 : n % 7 == 6 ? 0 : 1 + int(mixh(hn + 6u) % 2u);
        float hair = fract(dot(p - o, vec2(-dir.y, dir.x)) * 0.6 + vnoise(p, 5.0, hn + 9u) * 2.0);   // the brush's hairs
        if (hair < 0.28) k = k == 1 ? 2 : k == 2 ? 3 : 1;
      }
    }
    for (int n = 0; n < 5; n++) {
      uint hn = mixh(h + 90u + uint(n));
      vec2 e = rot(6.2832 * unit(hn)) * (p - C + vec2(0.0, R * 0.3) - R * 0.3 * (vec2(unit(mixh(hn + 1u)), unit(mixh(hn + 2u))) - 0.5));
      vec2 rr = R * vec2(0.3 + 0.3 * unit(mixh(hn + 3u)), 0.15 + 0.2 * unit(mixh(hn + 4u)));
      if (abs(length(e / rr) - 1.0) * min(rr.x, rr.y) < 1.2) { cov = 1.0; k = int(mixh(hn + 5u) % 3u); }
    }
    // drips: some columns under the head run down, thinning as they go
    if (cov == 0.0 && D.y > 0.0 && abs(D.x) < R * 0.8) {
      uint hd = h3(int(floor(p.x / 2.0)), q.x * 131 + q.y, salt + 11u);
      float len = R * drip * (0.2 + 2.0 * unit(mixh(hd)) * unit(mixh(hd + 1u)));
      if (unit(hd) < 0.38 && D.y < len && fract(p.x / 2.0) < 0.5 + 0.5 * (1.0 - D.y / len)) { cov = 0.9; k = 1 + int(mixh(hd + 2u) % 2u); }
    }
    // splatter
    if (cov == 0.0 && r < R * 1.9 && unit(h3(int(p.x), int(p.y), h)) < 0.045 * (1.9 - r / R)) { cov = 1.0; k = int(h3(int(p.x), int(p.y), h + 1u) % 3u); }
    if (cov > best) { best = cov; ink = k; }
  }
  return best;
}
/** Collage: panels of the soil pasted on as photographs are, with a thin red box beside some, as in Natural History. */
float collage(vec2 p, uint salt, float dens, out int ink, out bool photo) {
  const float G = 144.0;
  ivec2 sq = ivec2(floor(p / G));
  float best = 0.0;
  ink = 0; photo = false;
  for (int j = -1; j <= 0; j++) for (int i = -1; i <= 0; i++) {
    ivec2 q = sq + ivec2(i, j);
    uint h = h3(q.x, q.y, salt);
    if (unit(h) > dens * 0.7) continue;
    vec2 o = (vec2(q) + vec2(unit(mixh(h + 1u)), unit(mixh(h + 2u))) * 0.5) * G;
    vec2 sz = vec2(34.0 + 55.0 * unit(mixh(h + 3u)), 34.0 + 55.0 * unit(mixh(h + 4u)));
    vec2 d = p - o;
    if (all(greaterThanEqual(d, vec2(0))) && all(lessThan(d, sz))) { photo = true; return 1.0; }
    // a red box, drawn by hand beside it
    vec2 bo = o + vec2(sz.x + 8.0, sz.y * unit(mixh(h + 5u))), bs = vec2(21.0, 8.0);
    vec2 e = abs(p - bo - bs * 0.5) - bs * 0.5;
    if (unit(mixh(h + 6u)) < 0.618 && max(e.x, e.y) < 0.6 && max(e.x, e.y) > -0.8) { best = 0.9; ink = 1; }
    // graphite hatching under it, leaning, as a pencil fills a space
    vec2 hd = p - o - vec2(0.0, sz.y + 5.0);
    if (hd.y > 0.0 && hd.y < 21.0 && hd.x > 0.0 && hd.x < sz.x * 0.8 && unit(mixh(h + 8u)) < 0.618) {
      float line = abs(fract((hd.x + hd.y * 0.6) / 3.0) - 0.5);
      if (line < 0.17) { best = max(best, 0.6); ink = 0; }
    }
  }
  return best;
}


// ---- the outskirts: digital territories -------------------------------------------------------------
// Out from the calm islands, where DIRT's digital processes take hold, some passages leave the paper for the moving
// image, after the digital animation that turned painting into time and then into data. Nearest the islands:
// painting in time (Oskar Fischinger's Motion Painting No. 1) and the collection's paintings faceted (Quayola's
// Iconographies); further out, living tissue (Universal Everything's Primordial) and the soil lifted into relief
// lines (GMUNK's Synapse Code); farthest, data (Ryoji Ikeda's datamatics). They wear their passage's painting's
// colours, turned by the golden angle.
bool soilAt(ivec2 cell, out vec3 soil, out int s) {
  ivec2 sl = (cell >> 8) - uC0;
  soil = vec3(0); s = 0;
  if (any(lessThan(sl, ivec2(0))) || any(greaterThanEqual(sl, ivec2(16)))) return false;
  vec4 si = texelFetch(uSlots, sl, 0);
  if (si.x < 0.5) return false;
  uint w = texelFetch(uCells, ivec3(cell & 255, int(si.x) - 1), 0).x;
  soil = vec3(uvec3(w, w >> 8, w >> 16) & 255u); s = int((w >> 24) & 3u);
  return true;
}
uint gSeed = 0u;                                                     // the passage's seed, and its change
int gK = 0;
const int DIGITS[10] = int[10](31599, 11415, 29671, 29647, 23497, 31183, 31215, 29257, 31727, 31695);
/** Is cell (x, y) of a 3 by 5 numeral d lit? */
bool digit(int d, int x, int y) { return x >= 0 && x < 3 && y >= 0 && y < 5 && ((DIGITS[d] >> (14 - (y * 3 + x))) & 1) == 1; }

void digital(int layer, Cell c, int g, out vec3 A, out vec3 B) {
  vec3 st[5]; float at[5];
  uint hp = mixh(gSeed ^ uint(gK + 7) * 0x27d4eb2du);
  paletteOf(layer, c.e, State(1, 1 + int(hp % 4u), -1, 0), st, at);   // the painting's colours, turned
  vec2 p = gP, q = p - gMid;
  float T = uTime;
  if (g == 5) {
    // Painting in time: on each beat a shape is painted in, stroke by stroke; they gather for 21 beats; then the
    // ground is painted over them and it begins again.
    const float BEAT = 1.618;
    float cyc = T / (BEAT * 21.0), b = fract(cyc) * 21.0;
    uint hc = mixh(hp + uint(floor(cyc)));
    vec3 col = st[1] * 0.38;
    for (int n = 0; n < 21; n++) {
      if (float(n) > b) break;
      uint h = mixh(hc + uint(n) * 977u);
      float grow = clamp(b - float(n), 0.0, 1.0);
      vec2 o = (vec2(unit(h), unit(mixh(h + 1u))) - 0.5) * 233.0, d = q - o;
      float r = length(d), a = atan(d.y, d.x) / 6.2832 + 0.5, typ = unit(mixh(h + 2u)), R = 13.0 + 55.0 * unit(mixh(h + 3u));
      bool on = false;
      if (typ < 0.3) on = r < R && abs(fract(r / 5.0) - 0.5) < 0.22 && a < grow;                      // rings
      else if (typ < 0.55) on = r < R * 1.3 && abs(fract(r / 6.0 - a) - 0.5) < 0.2 && r / (R * 1.3) < grow;   // a spiral
      else if (typ < 0.8) { vec2 e = rot(6.2832 * unit(mixh(h + 4u))) * d; on = abs(e.y) < R * 0.08 + 1.0 && e.x > -R && e.x < -R + 2.0 * R * grow; }   // a bar
      else on = r < R * 0.3 * grow;                                  // a disc
      if (on) col = st[2 + int(mixh(h + 5u) % 3u)];
    }
    float wipe = smoothstep(20.3, 21.0, b) * step(fract((p.x + p.y) / 89.0), (b - 20.3) / 0.7);
    col = mix(col, st[1] * 0.38, wipe);
    A = B = col;
  } else if (g == 6) {
    // The collection's paintings faceted: the soil cut into facets, each the colour at its middle, lit as a carved
    // face is; facets split into smaller ones and join again, each on its own time.
    float best = 1e9, second = 1e9;
    ivec2 site = ivec2(0);
    uint bh = 0u;
    for (int lv = 0; lv < 2; lv++) {
      float G = lv == 0 ? 34.0 : 13.0;
      ivec2 sq = ivec2(floor(p / G));
      best = 1e9; second = 1e9;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        ivec2 qq = sq + ivec2(i, j);
        uint h = h3(qq.x, qq.y, hp + uint(lv));
        vec2 sp = (vec2(qq) + vec2(unit(h), unit(mixh(h + 1u)))) * G;
        float d = length(p - sp);
        if (d < best) { second = best; best = d; site = ivec2(sp); bh = h; } else if (d < second) second = d;
      }
      // a big facet splits while the wave of its own time is up
      if (lv == 0 && sin(T * 0.382 + 6.2832 * unit(mixh(bh + 5u))) < 0.3) break;
    }
    vec3 soil; int s;
    if (!soilAt(site, soil, s)) soil = c.soil;
    vec3 nrm = normalize(vec3(unit(mixh(bh + 2u)) - 0.5, unit(mixh(bh + 3u)) - 0.5, 1.2));
    vec3 col = (soil * 1.2 + 24.0) * (0.62 + 0.55 * max(0.0, dot(nrm, normalize(vec3(-0.6, -0.8, 1.0)))));
    if (second - best < 0.9) col = mix(col, vec3(240.0, 236.0, 226.0), 0.7);   // the cut between faces
    A = B = min(col, vec3(255.0));
  } else if (g == 7) {
    // Living tissue: cells drifting, each with its membrane and nucleus, granules of soil in them, and now and then
    // one dividing in two.
    const float G = 21.0;
    ivec2 sq = ivec2(floor(p / G));
    float best = 1e9, second = 1e9, split = 0.0;
    vec2 bs = vec2(0), axis = vec2(1, 0);
    uint bh = 0u;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 qq = sq + ivec2(i, j);
      uint h = h3(qq.x, qq.y, hp);
      vec2 sp = (vec2(qq) + 0.2 + 0.6 * vec2(unit(h), unit(mixh(h + 1u)))) * G + 3.0 * vec2(sin(T * 0.3 + 6.2832 * unit(mixh(h + 2u))), cos(T * 0.23 + 6.2832 * unit(mixh(h + 3u))));
      float d = length(p - sp);
      if (d < best) { second = best; best = d; bs = sp; bh = h; } else if (d < second) second = d;
    }
    // a dividing cell: its nucleus draws apart into two
    float ph = fract(T / 13.0 + unit(mixh(bh + 4u)));
    if (unit(mixh(bh + 5u)) < 0.382) { split = smoothstep(0.3, 0.9, ph) * 5.0; float an = 6.2832 * unit(mixh(bh + 6u)); axis = vec2(cos(an), sin(an)); }
    vec2 dn = p - bs;
    float nuc = min(length(dn - axis * split), length(dn + axis * split));
    vec3 cyto = mix(st[4], vec3(250.0, 236.0, 242.0), 0.5), mem = st[1] * 0.8, nucleus = mix(st[1], st[2], 0.4);
    vec3 col = cyto;
    if (c.s > 0 && unit(h3(int(p.x), int(p.y), bh)) < 0.3) col = mix(cyto, c.soil, 0.55);   // granules
    if (nuc < 3.5 + 0.6 * sin(T + 6.2832 * unit(bh))) col = nucleus;
    if (split > 2.5 && abs(dot(dn, axis)) < 0.7) col = mem;            // the furrow
    if (second - best < 1.4) col = mem;
    A = B = col;
  } else if (g == 8) {
    // The soil lifted into relief: rows of lines, each lifted by the soil's lightness beneath it and rippling, the
    // nearer rows hiding the ones behind, in light on black.
    const int GAP = 5;
    float amp = 34.0 * (0.6 + 0.4 * sin(T * 0.618 + q.x * 0.013));
    vec3 col = vec3(6.0, 6.0, 8.0);
    int y = int(floor(p.y)), y0 = (y / GAP + 1) * GAP;
    for (int n = 0; n < 9; n++) {
      int yr = y0 + n * GAP;
      // the soil's lightness along the row, smoothed over 8 cells so each line is a ridge, not a scratch
      vec3 s0, s1; int s;
      float fx = p.x / 8.0, u = fract(fx);
      int x0 = int(floor(fx)) * 8;
      float l0 = soilAt(ivec2(x0, yr), s0, s) ? lum(s0) : 0.0, l1 = soilAt(ivec2(x0 + 8, yr), s1, s) ? lum(s1) : 0.0;
      float lift = mix(l0, l1, u * u * (3.0 - 2.0 * u)) / 255.0;
      float top = float(yr) - amp * lift * (0.5 + 0.5 * sin(float(yr) * 0.05 + T * 1.3));
      if (top <= p.y + 0.5) {
        float hue = fract(float(yr) / 144.0 + T * 0.05);
        vec3 line = mix(st[3], st[4], hue) * 1.2 + vec3(40.0);
        if (abs(p.y - top) < 0.8) col = min(line, vec3(255.0));
        break;                                                        // nearer rows hide what is behind
      }
    }
    A = B = col;
  } else if (g == 10) {
    // Light and space: a field of coloured light floating in another, no source, its edge dissolving into the one
    // round it, and the colours passing slowly, each field into the next, as a Skyspace's sky does at dusk.
    float ph = T / 34.0 + unit(hp), f = fract(ph);
    int n0 = int(floor(ph));
    mat3 m0 = turnOf(float(n0) * GA), m1 = turnOf(float(n0 + 1) * GA);
    vec3 inner = mix(satur(satur(turnRGB(st[2], m0))), satur(satur(turnRGB(st[2], m1))), smoothstep(0.0, 1.0, f));
    vec3 outer = mix(satur(turnRGB(st[3], m0 * turnOf(2.4))), satur(turnRGB(st[3], m1 * turnOf(2.4))), smoothstep(0.0, 1.0, f));
    vec2 hs = vec2(89.0, 55.0) * (1.0 + 0.05 * sin(T * 0.21));
    vec2 d = abs(q) - hs;
    float e = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    vec3 col = mix(inner, outer, smoothstep(-21.0, 34.0, e)) + vec3(34.0) * exp(-abs(e - 6.0) / 8.0);   // a halo where they meet
    col *= 1.0 + 0.03 * (lum(c.soil) / 128.0 - 1.0);                // the dirt, barely, as the grain of the light
    A = B = min(col, vec3(255.0));
  } else if (g == 11) {
    // Analytic cubism: the ground seen from several viewpoints at once, as overlapping translucent planes, each plane
    // showing the soil from a view of its own (shifted and turned), in ochre, olive, grey and umber, sliding slowly
    // into one another; a dark edge and a lit edge to each plane.
    vec3 earth = mix(vec3(lum(st[2])), st[2], 0.35) * vec3(1.05, 1.0, 0.8);
    vec3 col = earth * 0.8;
    for (int n = 0; n < 3; n++) {
      uint hn = mixh(hp + uint(n) * 7919u);
      float an = 0.6 * (unit(hn) - 0.5) + float(n) * 0.9, Gs = 34.0 + 34.0 * unit(mixh(hn + 1u));
      vec2 r = rot(an) * (q + vec2(T * 0.8 * (unit(mixh(hn + 2u)) - 0.5), T * 0.5 * (unit(mixh(hn + 3u)) - 0.5)));
      vec2 cellq = floor(r / Gs), fr = r / Gs - cellq;
      uint hc = h3(int(cellq.x), int(cellq.y), hn);
      vec2 nrm = vec2(cos(6.2832 * unit(hc)), sin(6.2832 * unit(hc)));
      float side = dot(fr - 0.5, nrm) + 0.2 * (unit(mixh(hc + 1u)) - 0.5);
      if (unit(mixh(hc + 2u)) < 0.6 && side > 0.0) {
        vec3 soil; int s_;
        vec2 view = vec2(21.0 * (unit(mixh(hc + 3u)) - 0.5), 21.0 * (unit(mixh(hc + 4u)) - 0.5));
        if (!soilAt(ivec2(gP + view), soil, s_)) soil = c.soil;
        float l = lum(soil) / 255.0;
        vec3 tone = mix(st[1] * 0.6, st[3], l);
        tone = mix(vec3(lum(tone)), tone, 0.4) * vec3(1.06, 1.0, 0.82) * (0.85 + 0.3 * unit(mixh(hc + 5u)));
        col = mix(col, tone, 0.62);
        float edge = min(abs(side) * Gs, min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y)) * Gs);
        if (edge < 0.9) col *= unit(mixh(hc + 6u)) < 0.5 ? 0.55 : 1.35;   // an edge, in shadow or catching the light
      }
    }
    col *= 0.94 + 0.08 * vnoise(vec2(gP.x + gP.y, gP.x - gP.y), 3.0, hp + 11u);   // brushwork, on the diagonal
    A = B = min(col, vec3(255.0));
  } else if (g == 12) {
    // Bacchus (Twombly, 2005): on raw cream canvas, huge looping strokes of alizarin, round and round, dripping.
    vec3 col = vec3(236.0, 226.0, 204.0) * (0.97 + 0.05 * vnoise(p, 21.0, hp + 3u));
    for (int n = 0; n < 9; n++) {
      uint h = mixh(hp + 300u + uint(n));
      vec2 o = (vec2(unit(h), unit(mixh(h + 1u))) - 0.5) * vec2(233.0, 144.0) + vec2(21.0 * sin(T * 0.1 + float(n)), 0.0);
      vec2 d = rot(0.9 * (unit(mixh(h + 2u)) - 0.5)) * (q - o);
      vec2 rr = vec2(34.0 + 55.0 * unit(mixh(h + 3u)), 21.0 + 34.0 * unit(mixh(h + 4u)));
      float e = abs(length(d / rr) - 1.0) * min(rr.x, rr.y), w = 2.5 + 3.0 * unit(mixh(h + 5u)) * (0.6 + 0.4 * sin(atan(d.y, d.x) * 2.0));
      vec3 red = mix(vec3(150.0, 20.0, 30.0), vec3(200.0, 60.0, 60.0), unit(mixh(h + 6u)));
      if (e < w) col = mix(col, red, e < w - 1.0 ? 1.0 : 0.6);
      // a drip from the bottom of each loop
      vec2 bottom = o + rot(-0.9 * (unit(mixh(h + 2u)) - 0.5)) * vec2(0.0, rr.y);
      float len = 34.0 + 89.0 * unit(mixh(h + 7u));
      if (abs(q.x - bottom.x) < 1.3 && q.y > bottom.y && q.y < bottom.y + len) col = red;
    }
    A = B = col;
  } else if (g == 13) {
    // Ganzfeld (Turrell): the whole field one colour of light, no edge, no object, shifting slowly; a faint brightening
    // at its heart, so the eye loses its depth.
    float ph = T / 55.0 + unit(hp);
    vec3 col = satur(satur(turnRGB(st[3], turnOf(ph * 1.3))));
    col = mix(col, vec3(255.0), 0.12 + 0.1 * exp(-dot(q, q) / 40000.0));
    A = B = min(col, vec3(255.0));
  } else if (g == 14) {
    // Skyspace (Turrell): a sharp-edged opening in a ceiling onto the sky, the ceiling lit around it by a hidden band of
    // light that changes colour, so the sky beside it seems to change too.
    float ph = T / 34.0 + unit(hp);
    vec3 ceiling = satur(turnRGB(st[3], turnOf(ph))) * 0.9 + 20.0;
    vec3 sky = mix(vec3(40.0, 70.0, 150.0), vec3(120.0, 170.0, 220.0), 0.5 + 0.5 * sin(T / 21.0 + unit(hp) * 6.28));
    float r = length(q / vec2(1.0, 0.8));
    vec3 col = ceiling * (0.75 + 0.35 * smoothstep(233.0, 60.0, r));
    if (r < 55.0) col = sky;
    else if (r < 57.0) col = vec3(250.0, 248.0, 240.0);             // the knife edge
    A = B = min(col, vec3(255.0));
  } else if (g == 15) {
    // Papier collé (Braque, 1912): flat pieces of paper pasted on and drawn over in charcoal: faux-bois wallpaper,
    // black paper, newsprint, and a guitar's sound hole and strings in charcoal lines.
    vec3 col = vec3(222.0, 214.0, 196.0);
    for (int n = 0; n < 5; n++) {
      uint h = mixh(hp + 500u + uint(n));
      vec2 o = (vec2(unit(h), unit(mixh(h + 1u))) - 0.5) * vec2(233.0, 144.0);
      vec2 d = rot(0.5 * (unit(mixh(h + 2u)) - 0.5)) * (q - o), hs = vec2(21.0 + 55.0 * unit(mixh(h + 3u)), 21.0 + 55.0 * unit(mixh(h + 4u)));
      if (abs(d.x) < hs.x && abs(d.y) < hs.y) {
        int kind_ = int(mixh(h + 5u) % 3u);
        if (kind_ == 0) col = mix(vec3(150.0, 100.0, 55.0), vec3(185.0, 135.0, 80.0), 0.5 + 0.5 * sin(d.y * 0.9 + 3.0 * sin(d.x * 0.05) + 2.0 * vnoise(d, 13.0, h)));   // faux bois
        else if (kind_ == 1) col = vec3(30.0, 28.0, 26.0);
        else col = mod(floor(d.y / 3.0), 2.0) < 1.0 && unit(h3(int(d.x / 2.0), int(d.y / 3.0), h)) < 0.6 ? vec3(110.0) : vec3(215.0, 212.0, 200.0);   // newsprint
      }
    }
    // charcoal: the sound hole and strings, and a few straight lines
    float rh = length(q - vec2(21.0, -8.0));
    if (abs(rh - 21.0) < 1.2) col = vec3(25.0);
    for (int n = 0; n < 4; n++) { float xs = -8.0 + float(n) * 5.0 + 21.0; if (abs(q.x - xs - q.y * 0.08) < 0.6 && abs(q.y) < 89.0) col = vec3(40.0); }
    for (int n = 0; n < 3; n++) {
      uint h = mixh(hp + 600u + uint(n));
      vec2 dir = vec2(cos(6.2832 * unit(h)), sin(6.2832 * unit(h)));
      if (abs(dot(q - (vec2(unit(mixh(h + 1u)), unit(mixh(h + 2u))) - 0.5) * 144.0, vec2(-dir.y, dir.x))) < 0.7) col = vec3(35.0);
    }
    A = B = col;
  } else if (g == 16) {
    // The Birds (Braque, 1950s): on a flat field of colour, great simplified birds in black, outlined in white, gliding.
    vec3 col = mix(st[2], vec3(lum(st[2])), 0.3) * 0.85;
    for (int n = 0; n < 3; n++) {
      uint h = mixh(hp + 700u + uint(n));
      vec2 o = (vec2(unit(h), unit(mixh(h + 1u))) - 0.5) * vec2(233.0, 144.0);
      o.x = mod(o.x + T * (8.0 + 8.0 * unit(mixh(h + 2u))) + 144.0, 377.0) - 188.0;
      float sz = 21.0 + 21.0 * unit(mixh(h + 3u)), flap = 0.25 * sin(T * 1.3 + float(n));
      vec2 d = (q - o) / sz;
      float body = length(d / vec2(1.0, 0.28)) - 1.0;
      vec2 wl = rot(-0.5 - flap) * (d - vec2(-0.1, 0.0)), wr = rot(0.5 + flap) * (d - vec2(-0.1, 0.0));
      float wing = min(max(abs(wl.y) - 0.15 * (1.0 - wl.x), max(-wl.x, wl.x - 1.3)), max(abs(wr.y) - 0.15 * (1.0 - wr.x), max(-wr.x, wr.x - 1.3)));
      float sd = min(body, wing * 3.0);
      if (sd < 0.0) col = vec3(20.0);
      else if (sd < 0.09) col = vec3(245.0);
    }
    A = B = col;
  } else if (g == 17) {
    // Radio Dynamics (Fischinger, 1942): squares within squares pulsing inward, a tunnel of colour, and a disc at its heart.
    float d = max(abs(q.x), abs(q.y)) + 1.0, b = log(d) * 4.0 - T * 1.618;
    int band = int(floor(b));
    vec3 col = st[1 + int(mod(float(band), 3.0))] * 1.1;
    if (fract(b) < 0.1) col = vec3(12.0);
    if (length(q) < 13.0 + 5.0 * sin(T * 3.0)) col = vec3(245.0, 235.0, 200.0);
    A = B = min(col, vec3(255.0));
  } else if (g == 18) {
    // Pleasant Places (Quayola): a landscape remade as brushstrokes laid by an algorithm, short strokes following a
    // flow, each in the colour of the soil under it, lit.
    vec3 col = mix(st[1], st[2], 0.5);
    for (int L = 0; L < 2; L++) {
      float G = L == 0 ? 8.0 : 5.0;
      ivec2 sq = ivec2(floor(p / G));
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        ivec2 qq = sq + ivec2(i, j);
        uint h = h3(qq.x, qq.y, hp + uint(L) * 13u);
        vec2 o = (vec2(qq) + vec2(unit(h), unit(mixh(h + 1u)))) * G;
        float an = 6.2832 * vnoise(o, 89.0, hp + 5u) + 0.3 * sin(T * 0.3);
        vec2 dir = vec2(cos(an), sin(an)), d = p - o;
        float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
        if (abs(along) < 6.0 && abs(across) < 1.3) {
          vec3 soil; int s_;
          if (!soilAt(ivec2(o), soil, s_)) soil = c.soil;
          col = satur(soil) * (0.85 + 0.35 * (0.5 + 0.5 * dot(dir, vec2(-0.7, -0.7)))) + 15.0;
        }
      }
    }
    A = B = min(col, vec3(255.0));
  } else if (g == 20) {
    // Picasso: flat planes of synthetic cubism in ochre, black, cream and brown, and, in each 144-cell square, a
    // head seen from the front and in profile at once, in a bold black line, split cobalt and rose.
    vec3 PAL[6] = vec3[6](vec3(196.0, 150.0, 70.0), vec3(25.0), vec3(236.0, 224.0, 196.0), vec3(120.0, 80.0, 40.0), vec3(40.0, 90.0, 170.0), vec3(235.0, 180.0, 165.0));
    vec2 gq = floor(q / 21.0);
    uint hc = h3(int(gq.x), int(gq.y), hp);
    vec2 f = fract(q / 21.0);
    vec3 col = PAL[int(hc % 4u)];
    if ((hc & 16u) != 0u && f.x + f.y * (unit(mixh(hc)) * 2.0) > 1.0) col = PAL[int(mixh(hc) % 4u)];   // planes split on a slant
    if (min(f.x, f.y) < 0.05) col = vec3(25.0);
    vec2 cq = floor(q / 144.0), d = q - (cq + 0.5) * 144.0;
    uint hf = h3(int(cq.x), int(cq.y), hp + 9u);
    if (unit(hf) < 0.7) {
      vec2 e = d / vec2(34.0, 46.0);
      float head = length(e);
      if (head < 1.0) col = d.x < 4.0 * sin(d.y * 0.05) ? PAL[4] : PAL[5];   // the face, split
      if (d.x < -30.0 && head < 1.25 && head > 1.0) col = PAL[4];          // hair
      float line = abs(head - 1.0) * 34.0;
      bool ink = line < 1.4;
      ink = ink || (abs(d.x - 2.0 + d.y * 0.1) < 1.2 && d.y > -18.0 && d.y < 10.0);   // the nose, in profile
      ink = ink || (abs(d.y - 22.0) < 1.0 && abs(d.x) < 10.0);                          // the mouth
      for (int n = 0; n < 2; n++) {                                                    // two eyes, both seen from the front
        vec2 eo = d - vec2(n == 0 ? -14.0 : 12.0, n == 0 ? -12.0 : -8.0);
        float el = length(eo / vec2(8.0, 4.0));
        if (abs(el - 1.0) < 0.2) ink = true;
        if (length(eo) < 2.6) ink = true;
      }
      if (ink && head < 1.3) col = vec3(20.0);
    }
    A = B = col * (0.94 + 0.08 * vnoise(p, 3.0, hp + 4u));
  } else if (g == 21) {
    // de Kooning: broad strokes laid wet into wet, sliding on the diagonal, pink, yellow, cerulean and white, each
    // streaked by the brush and scraped by the knife, over one another.
    vec3 PAL[4] = vec3[4](vec3(240.0, 190.0, 170.0), vec3(245.0, 205.0, 60.0), vec3(120.0, 180.0, 210.0), vec3(248.0, 240.0, 225.0));
    vec3 col = PAL[3];
    const float G = 21.0;
    ivec2 sq = ivec2(floor(p / G));
    float late = -1.0;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      ivec2 qq = sq + ivec2(i, j);
      uint h = h3(qq.x, qq.y, hp);
      float b = unit(mixh(h + 2u));
      if (b <= late) continue;
      vec2 o = (vec2(qq) + vec2(unit(h), unit(mixh(h + 1u)))) * G + vec2(8.0 * sin(T * 0.13 + b * 6.0), 0.0);
      float an = -0.7 + 0.9 * (vnoise(o, 144.0, hp + 3u) - 0.5) + 1.2 * step(0.8, unit(mixh(h + 4u)));
      vec2 dir = vec2(cos(an), sin(an)), d = p - o;
      float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x)), len = 21.0 + 21.0 * unit(mixh(h + 5u)), w = 5.0 + 5.0 * unit(mixh(h + 6u));
      if (abs(along) < len && abs(across) < w * (1.0 - 0.3 * abs(along) / len)) {
        late = b;
        vec3 c0 = PAL[int(mixh(h + 7u) % 4u)], c1 = PAL[int(mixh(h + 8u) % 4u)];
        float streak = fract(across * 0.45 + vnoise(vec2(along, across), 6.0, h) * 1.5);   // bristles
        col = mix(c0, c1, smoothstep(0.3, 0.7, along / len * 0.5 + 0.5)) * (streak < 0.2 ? 0.85 : 1.0);
        if (abs(across) > w * 0.85) col = mix(col, vec3(255.0), 0.3);                      // the knife's ridge
      }
    }
    A = B = col;
  } else if (g == 22) {
    // Cézanne: the land built of small parallel strokes, all leaning one way within each patch, in ochre, viridian,
    // green and violet-blue, the blue on the heights, the canvas showing between.
    vec3 canvas = vec3(225.0, 215.0, 185.0), col = canvas;
    vec2 pq = floor(p / vec2(8.0, 5.0));
    vec2 f = fract(p / vec2(8.0, 5.0));
    uint h = h3(int(pq.x), int(pq.y), hp);
    float land = vnoise(p, 55.0, hp + 1u) + 0.4 * (q.y / 144.0);
    vec3 c0 = land > 0.9 ? vec3(110.0, 120.0, 170.0) : land > 0.55 ? vec3(205.0, 170.0, 90.0) : land > 0.35 ? vec3(90.0, 150.0, 70.0) : vec3(50.0, 130.0, 90.0);
    vec3 c1 = mix(c0, vec3(110.0, 120.0, 170.0), 0.35);
    float slant = f.x - f.y * 0.8;                                    // strokes on the diagonal
    if (unit(h) < 0.85 && fract(slant * 2.5) < 0.62) col = mix(c0, c1, unit(mixh(h + 1u))) * (0.9 + 0.2 * unit(mixh(h + 2u)));
    A = B = col;
  } else if (g == 23) {
    // Van Gogh: short thick strokes laid along a turbulent flow that swirls round a few glowing orbs, cobalt and
    // ultramarine against chrome yellow, moving slowly on.
    vec3 col = vec3(25.0, 50.0, 120.0);
    vec2 flowv = vec2(0.0);
    for (int n = 0; n < 3; n++) {
      uint h = mixh(hp + 800u + uint(n));
      vec2 o = (vec2(unit(h), unit(mixh(h + 1u))) - 0.5) * vec2(233.0, 144.0), d = q - o;
      float r = length(d) + 1.0;
      flowv += vec2(-d.y, d.x) / r * exp(-r / 55.0) * 3.0;
      if (r < 13.0) { col = vec3(245.0, 215.0, 80.0); flowv = vec2(0.0); }
      else if (r < 21.0 && fract(r / 3.0 - T * 0.3) < 0.6) col = vec3(240.0, 225.0, 140.0);
    }
    float an = 6.2832 * vnoise(p, 89.0, hp + 5u) + atan(flowv.y, flowv.x + 1e-3) * min(1.0, length(flowv));
    vec2 dir = vec2(cos(an), sin(an));
    float along = dot(p, dir) + T * 3.0, across = dot(p, vec2(-dir.y, dir.x));
    uint hs = h3(int(floor(along / 6.0)), int(floor(across / 2.0)), hp + 7u);
    if (length(flowv) > 0.0 || col.b > 100.0) {
      float k = unit(hs);
      vec3 sc = k < 0.35 ? vec3(30.0, 70.0, 160.0) : k < 0.6 ? vec3(20.0, 40.0, 120.0) : k < 0.8 ? vec3(90.0, 140.0, 200.0) : k < 0.93 ? vec3(240.0, 210.0, 70.0) : vec3(245.0, 235.0, 170.0);
      if (col.r < 200.0) col = sc * (fract(across / 2.0) < 0.25 ? 0.75 : 1.0);   // each stroke a ridge
    }
    A = B = col;
  } else if (g == 24) {
    // Monet: the pond at Giverny from above: lavender and turquoise water broken into soft horizontal dabs, willow
    // reflections falling in green streaks, lily pads and their pink and white flowers, all shimmering.
    vec3 col = mix(vec3(140.0, 140.0, 190.0), vec3(100.0, 160.0, 160.0), vnoise(p, 55.0, hp));
    uint hd = h3(int(floor((p.x + T * 2.0) / 5.0)), int(floor(p.y / 2.0)), hp + 1u);
    col = mix(col, unit(hd) < 0.5 ? vec3(190.0, 180.0, 220.0) : vec3(90.0, 130.0, 110.0), 0.35 * unit(mixh(hd)));
    if (vnoise(vec2(p.x, p.y / 8.0), 13.0, hp + 2u) > 0.72) col = mix(col, vec3(70.0, 110.0, 80.0), 0.5);   // reflected willows
    ivec2 sq = ivec2(floor(p / 34.0));
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 qq = sq + ivec2(i, j);
      uint h = h3(qq.x, qq.y, hp + 3u);
      if (unit(h) > 0.55) continue;
      vec2 o = (vec2(qq) + vec2(unit(mixh(h + 1u)), unit(mixh(h + 2u)))) * 34.0, d = p - o;
      float r = length(d / vec2(1.0, 0.7)), R = 5.0 + 8.0 * unit(mixh(h + 3u)), a = atan(d.y, d.x) - 6.2832 * unit(h);
      if (r < R && abs(sin(a * 0.5)) > 0.12) col = mix(vec3(80.0, 130.0, 70.0), vec3(120.0, 160.0, 90.0), vnoise(p, 3.0, h));
      if (unit(mixh(h + 4u)) < 0.5 && length(d - vec2(1.0)) < 2.8) col = unit(mixh(h + 5u)) < 0.6 ? vec3(235.0, 170.0, 185.0) : vec3(245.0, 240.0, 235.0);
    }
    A = B = col;
  } else if (g == 19) {
    // test pattern (Ikeda): the whole field in vertical bars of black and white whose widths are a binary code,
    // scrolling fast, now and then thrown into its negative.
    float x = p.x + T * 89.0 * (unit(hp) < 0.5 ? 1.0 : -1.0);
    int col8 = int(floor(x / 2.0));
    bool on = unit(h3(col8 / 4, int(floor(T * 3.0)) % 13, hp)) < 0.5 ? (col8 & 1) == 0 : (col8 & 3) == 0;
    if (mod(floor(p.y / 89.0), 3.0) == 1.0) on = unit(h3(col8, int(floor(p.y / 89.0)), hp + 1u)) < 0.5;
    if (unit(h3(int(floor(T * 1.618)), 0, hp + 2u)) < 0.1) on = !on;
    A = B = on ? vec3(250.0) : vec3(4.0);
  } else {
    // Data: black, with barcodes, grids of dots, numerals of the collection's own numbers, a scanline, and now and
    // then the whole field thrown white.
    float beat = floor(T * 1.618);
    int band = int(floor(p.x / 34.0));
    uint hb = h3(band, int(beat), hp);
    int mode = int(hb % 4u);
    bool on = false;
    int x = int(floor(p.x)), yy = int(floor(p.y));
    if (mode == 0) on = unit(h3(x, int(beat), hp + 3u)) < 0.25 + 0.5 * lum(c.soil) / 255.0;                      // barcode
    else if (mode == 1) on = (x % 3 == 0 && yy % 3 == 0 && lum(c.soil) > 60.0 + 120.0 * unit(hb));               // a grid of dots
    else if (mode == 2) {                                                                                          // numerals
      int cx = x - band * 34, col = cx / 4, row = (yy - int(floor(p.y / 7.0)) * 7);
      int v = int(h3(band * 16 + col, int(floor(p.y / 7.0)), uint(beat)) % 10u);
      on = cx < 32 && digit(v, cx - col * 4, row);
    }
    float scan = fract(T * 0.382 + unit(hp));
    if (abs(fract(p.y / 233.0) - scan) < 0.004) on = !on;                                                        // the scanline
    if (unit(h3(int(beat), 0, hp + 9u)) < 0.034) on = !on;                                                       // a flash
    vec3 col = on ? vec3(242.0) : vec3(0.0);
    if (on && unit(h3(x, yy, hp + uint(beat))) < 0.01) col = st[3];
    A = B = col;
  }
}

/** A sheet's colours at a cell: paper, dirt, and the marks of its grammar. */
void sheet(int layer, Cell c, int kind, State S, out vec3 A, out vec3 B) {
  gCov = 0.0;
  if (gGram >= 5) { digital(layer, c, gGram, A, B); return; }
  int w = S.w;
  vec2 p = gP;
  float out_ = smoothUp(P3, 1.0, c.d);                                // how far out: calm ground is nearly clean paper
  // One endless sheet: its paper drifts slowly among the artist's papers, whatever the passages; a blackboard is a
  // field of slate painted over it, brushed out at its edges.
  int nw = uGram[0].y + uGram[2].y + uGram[3].y + uGram[4].y;
  float drift = vnoise(p, 987.0, 61u) * float(nw - 1);
  int w0 = int(floor(drift)), w1 = min(w0 + 1, nw - 1);
  int a0 = w0 < uGram[0].y ? w0 : w0 + uGram[1].y, a1 = w1 < uGram[0].y ? w1 : w1 + uGram[1].y;   // skip the blackboards
  vec3 paper = mix(artPaper(a0), artPaper(a1), smoothstep(0.0, 1.0, fract(drift)));
  if (gGram == 1) {
    paper = artPaper(w) * (0.97 + 0.06 * vnoise(vec2(p.x / 13.0, p.y), 3.0, 67u));   // slate, brushed evenly
  }
  if (gGram != 1) paper = mix(paper, vec3(240.0, 232.0, 212.0), 0.45);   // warm, even cream, as the studies' sheets are
  paper *= 1.0 + 0.015 * (vnoise(p, 55.0, 41u) - 0.5) + 0.02 * (vnoise(vec2(p.x / 21.0, p.y), 1.5, 43u) - 0.5);   // a faint long grain
  // the collection's dirt: soft stains of it, rubbed in, more in the outskirts; its dots show only faintly
  float rub = (0.02 + 0.06 * out_) * smoothstep(0.55, 0.95, vnoise(p, 89.0, 53u)) + 0.02 * out_;
  vec3 stain = mix(paper, paper * mix(vec3(1.0), c.soil / 160.0, 0.6), rub * 3.0);
  paper = mix(paper, stain, 0.5);
  A = c.s > 0 ? mix(paper, paper * c.soil / 255.0, 0.06 + 0.1 * out_) : paper;
  B = paper;
  float dens = 0.5 + 0.4 * out_, cov = 0.0;
  int ink = 0, g = gGram;
  vec3 col = vec3(0);
  uint salt = uint(w) * 7919u + 3u;
  if (g == 3 || g == 1) {
    cov = writing(p, salt, g == 1 ? 1.0 : dens, g == 1 ? 13.0 : 34.0, ink);
    if (g == 1) cov *= 0.8;                                           // chalk: regular rows, a little rubbed
    col = g == 1 ? artInk(w, int(artRoles(w).z) - 1) : ink == 0 ? artInk(w, 0) : artVivid(w, 0);
    if (g == 1) col = max(col, paper + (255.0 - paper) * 0.55);      // chalk
  } else if (g == 2 || g == 4) {
    if (g == 4) {
      // Lepanto's sky: a watery blue over the upper sheet, running down in streaks that end in drips
      vec2 qm = p - gMid;
      float sky = smoothstep(80.0, -60.0, qm.y), col_ = p.x / 3.0, len = 34.0 + 89.0 * unit(h3(int(col_), 0, salt + 21u));
      float streak = step(qm.y, -40.0 + len) * step(0.55, unit(h3(int(col_), 1, salt + 23u)));
      vec3 blue = vec3(150.0, 196.0, 222.0) * (0.95 + 0.1 * vnoise(p, 13.0, salt + 22u));
      paper = mix(paper, blue, max(sky, streak * 0.8) * 0.75 * smoothstep(0.0, 0.3, c.pe));
      // bushes of colour, soft and bleeding, along the middle
      float bush = smoothstep(0.45, 0.75, vnoise(p, 34.0, salt + 24u)) * smoothstep(-40.0, 0.0, qm.y) * smoothstep(90.0, 30.0, qm.y);
      vec3 bc = mix(artVivid(w, 0), artVivid(w, 1), vnoise(p, 55.0, salt + 25u));
      paper = mix(paper, bc, bush * 0.8 * smoothstep(0.0, 0.3, c.pe));
      float bdrip = step(30.0, qm.y) * step(qm.y, 30.0 + 55.0 * unit(h3(int(col_), 2, salt + 26u))) * step(0.5, unit(h3(int(col_), 3, salt + 27u)))
                  * smoothstep(0.4, 0.6, vnoise(vec2(p.x, gMid.y + 20.0), 34.0, salt + 24u));
      paper = mix(paper, bc, bdrip * 0.7 * smoothstep(0.0, 0.3, c.pe));
      A = mix(A, paper, 0.9); B = mix(B, paper, 0.9);
    }
    cov = blooms(p, salt, dens * (g == 4 ? 1.0 : 0.8), g == 4 ? 6.0 : 1.6, ink);
    col = ink == 0 ? artInk(w, 0) : ink == 1 ? artVivid(w, 0) : ink == 2 ? artVivid(w, 1) : artInk(w, int(artRoles(w).z) - 1);
  } else {
    bool photo;
    cov = collage(p, salt, dens * 0.8, ink, photo);
    if (photo) {                                                     // the soil itself, as a pasted photograph
      vec3 st[5]; float at[5];
      paletteOf(layer, c.e, State(0, 0, -1, 0), st, at);
      float l = lum(c.soil);
      vec3 m = byLight(st, at, l), ph = mix(c.soil, m * (l / max(1.0, lum(m))), 0.382);
      ph = paper * (0.5 + 0.5 * min(vec3(1.0), ph / 150.0));           // printed on the sheet, pale, as a plate is
      A = ph; B = c.s == 3 ? ph : mix(ph, paper, 0.5);
      return;
    }
    col = ink == 1 ? vec3(197.0, 60.0, 50.0) : artInk(w, 0);        // red boxes; pencil
    int wi;
    float wc = writing(p, salt + 71u, dens * 0.35, 21.0, wi) * 0.8;   // pencil notes scrawled about the plates
    if (wc > cov) { cov = wc; col = wi == 0 ? artInk(w, 0) : artVivid(w, 0); }
  }
  cov *= gGate;
  gCov = cov;
  if (cov <= 0.0) return;
  // a stroke's heart is solid; its edges catch only on the dirt's dots, as crayon catches on the tooth of paper,
  // and the dirt's own colour works into it
  vec3 m = g == 1 ? col * (0.85 + 0.15 * lum(c.soil) / 128.0) : mix(col, col * c.soil / 128.0, 0.18);
  float core = smoothstep(0.45, 0.75, cov);
  gMark = m;
  A = mix(A, m, max(core, c.s > 0 ? cov : 0.0));
  B = mix(B, m, max(core, c.s == 3 ? cov * 0.8 : 0.0));
}


// ---- the gesture: one line through every world ---------------------------------------------------------
// Across the plane run long lines, one in every 610-cell band, belonging to no passage: each is a single unbroken
// gesture that takes the form of whatever world it is passing through. On paper it is crayon, on a blackboard chalk,
// among the blooms a painted stem hung with drips; in the digital territories a ring of beads, a cut, a chain of
// cells, a glowing relief line, a barcode, a band of light, the edge of a plane. Following it, the eye crosses from
// one world into the next without a break: the relation drawn.
void gesture(Cell c, State S, inout vec3 A, inout vec3 B) {
  vec2 p = gP;
  const float GAPY = 610.0;
  int band = int(floor(p.y / GAPY + 0.5));
  uint h = h3(band, 0, 991u);
  float ph = 6.2832 * unit(h), ph2 = 6.2832 * unit(mixh(h + 1u));
  float y = (float(band) + 0.2 * (unit(mixh(h + 2u)) - 0.5)) * GAPY + 144.0 * sin(p.x / 377.0 + ph) + 55.0 * sin(p.x / 144.0 + ph2) + 13.0 * sin(p.x / 34.0);
  float dy = 144.0 / 377.0 * cos(p.x / 377.0 + ph) + 55.0 / 144.0 * cos(p.x / 144.0 + ph2) + 13.0 / 34.0 * cos(p.x / 34.0);
  float d = abs(p.y - y) / sqrt(1.0 + dy * dy), g = float(gGram);
  if (d > 34.0) return;
  int G = gGram;
  vec3 col = vec3(0);
  float a = 0.0;
  float grain = unit(h3(int(p.x), int(p.y), 997u));
  if (G == 3 || G == 0) { a = step(d, 1.3) * (grain < 0.2 ? 0.4 : 1.0); col = G == 3 ? artInk(S.w, 0) : vec3(90.0); }        // crayon, pencil
  else if (G == 1) { a = step(d, 1.4) * (grain < 0.3 ? 0.3 : 0.9); col = vec3(236.0, 234.0, 228.0); }                           // chalk
  else if (G == 2 || G == 4) {                                                                                              // a painted stem, hung with drips
    col = artVivid(S.w, 0);
    a = step(d, 2.2);
    float xs = floor(p.x / 21.0), below = p.y - y, len = 13.0 + 55.0 * unit(h3(int(xs), band, 993u));
    if (abs(p.x - (xs + 0.5) * 21.0) < 1.2 && below > 0.0 && below < len) a = 1.0;
    if (abs(p.x - (xs + 0.5) * 21.0) < 2.0 && abs(below - len) < 2.0) a = 1.0;
  }
  else if (G == 5) { float bead = abs(fract(p.x / 13.0) - 0.5) * 13.0; a = step(abs(length(vec2(bead, p.y - y)) - 3.0), 0.8) + step(d, 0.6); col = vec3(245.0, 235.0, 215.0); }   // beads and rings
  else if (G == 6) { a = step(d, 0.8); col = vec3(245.0, 242.0, 234.0); }                                                   // a cut through the facets
  else if (G == 7) { float cx = (floor(p.x / 13.0) + 0.5) * 13.0; a = step(abs(length(vec2(p.x - cx, p.y - y)) - 6.0), 0.9); col = vec3(150.0, 40.0, 90.0); }   // a chain of cells
  else if (G == 8) { col = vec3(150.0, 240.0, 255.0); a = step(d, 1.0) + 0.6 * exp(-d / 3.0); }                            // a glowing relief line
  else if (G == 9) { a = step(abs(p.y - y), 6.0) * step(unit(h3(int(p.x), band, 995u)), 0.5); col = vec3(245.0); }          // a barcode
  else if (G == 10) { a = 0.35 * exp(-d / 13.0); col = vec3(255.0, 250.0, 240.0); }                                        // a band of light
  else { a = step(d, 1.0); col = p.y > y ? vec3(60.0, 50.0, 35.0) : vec3(235.0, 220.0, 180.0); }                          // the edge of a plane
  a = clamp(a, 0.0, 1.0);
  A = mix(A, col, a); B = mix(B, col, a * (G == 8 || G == 10 ? 1.0 : 0.7));
}
/**
 * A cell's colours in a state: A for its top left pixel, where a small dot sits, and B for its other three. A dot
 * of size 3 fills the cell; a gap is all ground.
 */
void paint(int layer, Cell c, int kind, State S, out vec3 A, out vec3 B) {
  if (uEarth == 0 && uArtOn == 1) { sheet(layer, c, kind, S, A, B); gesture(c, S, A, B); return; }
  vec3 st[5]; float at[5];
  paletteOf(layer, c.e, S, st, at);
  float stt = smoothUp(P3, P1, c.d);
  vec3 col, gnd;
  if (uEarth == 1) {
    A = B = st[1] * c.light;                                          // a gap shows the place's darkest colour, lit
    if (c.s == 0) return;
    float tl = clamp((lum(c.soil) - 34.0) / 144.0, 0.0, 1.0);
    if (c.even) tl = 0.42 + (tl - 0.42) * P1;
    col = nocturne(mix(c.soil, byPlace(st, tl), (1.0 - P4) + P4 * stt), kind, stt);
    if (c.L > 0) { vec3 tc = crownE(layer, c, S); col = c.over ? tc : mix(col, tc, TINT[c.L]); }
    A = min(col * lightOf(c, kind, P1), vec3(255.0));
    B = c.s == 3 ? A : uGround;
    return;
  }
  gnd = groundIn(S, st) * (S.mode != 0 && kind == NOCTURNE ? 1.0 - (1.0 - P4) * stt : 1.0);   // a nocturne's ground sinks too
  A = B = gnd;
  if (c.s == 0) return;
  float l = lum(c.soil);
  if (S.mode == 0) {
    vec3 m = byLight(st, at, l);
    col = nocturne(mix(c.soil, min(vec3(255.0), m * (l / max(1.0, lum(m)))), P1 * (P2 + (1.0 - P2) * stt)), kind, stt);
    if (c.L > 0) col = mix(col, entT(layer, c.te, 1 + c.ti).rgb, TINT[c.L]);
  } else {
    float t = clamp((l - 34.0) / 144.0, 0.0, 1.0);
    if (S.mode == 3) t = 1.0 - t;
    col = mix(c.soil, S.mode == 2 ? mix(st[1], st[4], smoothstep(0.0, 1.0, t)) : byPlace(st, t), (1.0 - P4) + P4 * stt);
    if (kind == NOCTURNE && stt > 0.0) col = t < 1.0 - P3 ? col * (1.0 - (1.0 - P4) * stt) : col + (255.0 - col) * P2 * stt;
    if (c.L > 0) col = mix(col, st[1 + c.ti], TINT[c.L]);
  }
  A = min(col * lightOf(c, kind, S.mode == 0 ? P1 : P3), vec3(255.0));
  if (c.s == 3) B = A;
}
/** A shape's flat colour, from the body of the palette (a nocturne's stars from its lights), lit by the forest; on a seam, the ground. */
vec3 flatIn(int layer, Cell c, int kind, State S, float tsel, bool seam) {
  if (uEarth == 0 && uArtOn == 1) return seam ? artPaper(S.w) : artInk(S.w, int(tsel * artRoles(S.w).z));
  vec3 st[5]; float at[5];
  paletteOf(layer, c.e, S, st, at);
  if (seam) return uEarth == 1 ? st[1] * c.light : groundIn(S, st);
  float t = kind == NOCTURNE ? 1.0 - P3 * tsel : P4 + (1.0 - P3 - P4) * tsel;
  return min(byPlace(st, t) * c.light * pow(KIND_KEY[kind], smoothUp(P3, P1, c.d)), vec3(255.0));
}

// ---- shapes that build up and break down --------------------------------------------------------------
// A change builds shapes in the new colours, each on its own time: how far the change has come where the shape
// starts (p, 0 to 1), so a shape builds and breaks as one. Each is born in the first phi^-2 of the change and
// full grown by phi^-1 of it; then it breaks down.
struct Shape { bool on, seam; float tsel, p; };
/** How far a change has come at S: it spreads from O in a front of three lobes and five smaller ones, like a crown's. */
float progressAt(vec2 S, float t0, float tb, vec2 O, uint seed, float dur, float speed) {
  vec2 D = S - O;
  float a = atan(D.y, D.x + 1e-3), r = length(D) * (1.0 + P3 * sin(3.0 * a + 6.2832 * unit(seed)) + P4 * sin(5.0 * a + 6.2832 * unit(mixh(seed + 31u))));
  return (uTime - max(tb, t0 + r / speed)) / dur;
}
float grown(float p, uint h) { float b = unit(mixh(h + 2u)) * P2; return clamp((p - b) / (P1 - b), 0.0, 1.0); }
Shape shapeAt(int kind, ivec2 c, float t0, float tb, vec2 O, uint seed, uint salt, float dur, float speed) {
  Shape s = Shape(false, false, 0.0, 0.0);
  vec2 cp = vec2(c) + 0.5;
  if (kind == MOSAIC) {
    // Tiles: 13-cell squares, each growing out from its middle until it fills its square but a one-cell seam.
    const int G = 13;
    ivec2 sq = ivec2(fdiv(c.x, G), fdiv(c.y, G)), loc = c - sq * G;
    uint h = h3(sq.x, sq.y, salt);
    s.p = progressAt((vec2(sq) + 0.5) * float(G), t0, tb, O, seed, dur, speed);
    float g = grown(s.p, h);
    s.tsel = unit(mixh(h + 3u));
    if (loc.x == G - 1 || loc.y == G - 1) { s.on = g >= 1.0; s.seam = true; return s; }
    vec2 d = abs(vec2(loc) + 0.5 - float(G - 1) * 0.5);
    s.on = g > 0.0 && max(d.x, d.y) <= g * float(G - 1) * 0.5;
    return s;
  }
  if (kind == WEAVE) {
    // Strips three cells wide, across every eighth row and down every eighth column, each 34-cell length growing out
    // from its middle; where they cross, over and under by turns.
    const int G = 8, SEG = 34;
    ivec2 sq = ivec2(fdiv(c.x, G), fdiv(c.y, G)), m = c - sq * G;
    bool onH = m.y >= 1 && m.y < 4, onV = m.x >= 5, hTop = ((sq.x + sq.y) & 1) == 0;
    for (int k = 0; k < 2; k++) {
      bool horiz = (k == 0) == hTop;
      if (horiz ? !onH : !onV) continue;
      int along = horiz ? c.x : c.y, seg = fdiv(along, SEG);
      uint h = h3(seg, horiz ? 2 * sq.y : 2 * sq.x + 1, salt);
      float mid = (float(seg) + 0.5) * float(SEG), p = progressAt(horiz ? vec2(mid, cp.y) : vec2(cp.x, mid), t0, tb, O, seed, dur, speed);
      if (abs(float(along) + 0.5 - mid) <= grown(p, h) * float(SEG) * 0.5) return Shape(true, false, unit(mixh(h + 3u)), p);
    }
    return s;
  }
  if (kind == DRIP) {
    // Runs: in one column of every three, runs start every 21 cells or so and run down up to 55.
    const int GX = 3, GY = 21;
    int col = fdiv(c.x, GX);
    uint hc = h3(col, 0, salt + 17u);
    if (c.x - col * GX != int(hc % 3u)) return s;
    int row = fdiv(c.y, GY);
    float late = -1.0;
    for (int j = -2; j <= 0; j++) {
      uint h = h3(col, row + j, salt);
      float y0 = (float(row + j) + unit(h)) * float(GY), b = unit(mixh(h + 2u)), dy = cp.y - y0;
      if (b <= late || dy < 0.0) continue;
      float p = progressAt(vec2(cp.x, y0), t0, tb, O, seed, dur, speed);
      if (dy < grown(p, h) * float(GY) * PHI * PHI * (P1 + P2 * unit(mixh(h + 4u)))) { late = b; s = Shape(true, false, unit(mixh(h + 3u)), p); }
    }
    return s;
  }
  // Spots (a spray: round, airbrushed at the edge) and stars (a nocturne: four points and a round core), each over
  // those born before it.
  int G = kind == SPRAY ? 8 : 21;
  ivec2 sq = ivec2(fdiv(c.x, G), fdiv(c.y, G));
  float late = -1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 q = sq + ivec2(i, j);
    uint h = h3(q.x, q.y, salt);
    float b = unit(mixh(h + 2u));
    if (b <= late) continue;
    vec2 S = (vec2(q) + vec2(unit(h), unit(mixh(h + 1u)))) * float(G), D = cp - S;
    float p = progressAt(S, t0, tb, O, seed, dur, speed), g = grown(p, h);
    if (g <= 0.0) continue;
    bool on;
    if (kind == SPRAY) {
      float r = g * float(G) * (P1 + P1 * unit(mixh(h + 4u))), d = length(D);
      on = d < r - 1.0 || (d < r + 2.0 && unit(h3(c.x, c.y, salt + 7u)) < (r + 2.0 - d) / 3.0 * P1);
    } else {
      float r = g * float(G) * P1 * (P1 + unit(mixh(h + 4u)));
      on = sqrt(abs(D.x)) + sqrt(abs(D.y)) <= sqrt(r) || length(D) < r * P3;
    }
    if (on) { late = b; s = Shape(true, false, unit(mixh(h + 3u)), p); }
  }
  return s;
}
/** When, through a breaking down (0 to 1), cell c goes: in pieces of 8, 5, 3, 2 and 1 cells, or a spray's as dust. */
float brokenAt(int kind, ivec2 c, uint salt) {
  if (kind == SPRAY) return unit(h3(c.x, c.y, salt + 11u));
  for (int l = 0; l < 5; l++) {
    int B = FRAG[l];
    uint h = h3(fdiv(c.x, B), fdiv(c.y, B), salt + 13u + uint(l));
    if (unit(h) < P1 || l == 4) return (float(l) + unit(mixh(h))) / 5.0;
  }
  return 1.0;
}
bool broken(float p, int kind, ivec2 c, uint salt) { return p >= 1.0 || (p > P1 && (p - P1) / P2 > brokenAt(kind, c, salt)); }
/**
 * Where a change stands at cell c: 0 not come yet, 1 in a shape, 2 on a seam, 3 broken down to the new ground. The
 * change set out from O at time t0 (not before tb), speed cells a second, and lasts dur at each place.
 */
int changeAt(int kind, ivec2 c, float t0, float tb, vec2 O, uint seed, uint salt, float dur, float speed, out float tsel) {
  Shape s = shapeAt(kind, c, t0, tb, O, seed, salt, dur, speed);
  tsel = s.tsel;
  if (s.on) return broken(s.p, kind, c, salt) ? 3 : s.seam ? 2 : 1;
  return broken(progressAt(vec2(c) + 0.5, t0, tb, O, seed, dur, speed), kind, c, salt) ? 3 : 0;
}

// The worlds (twenty-five), ordered round a wheel so that neighbours on it are far apart: light, writing, data, cubism, life,
// each followed by its opposite. Passages take their world from their place on a lattice colouring (a step east moves
// 4 along the wheel, a step south 7), so every edge crosses into a distant world, and each change in time moves a
// passage 9 further round.
const int WORLDS[25] = int[25](13, 3, 9, 16, 7, 23, 14, 2, 19, 11, 20, 5, 10, 12, 8, 24, 15, 18, 4, 1, 21, 17, 6, 0, 22);
int worldOf(int i, int j, int k) { return WORLDS[int(mod(float(i * 4 + j * 7 + (max(k, -1) + 1) * 9), 25.0))]; }

// ---- meta forms: the artists as shades --------------------------------------------------------------------------
// Each artist is one value, a shade from dark to light, as a painter's palette runs from its darkest to its lightest
// (Ikeda's black, Fischinger's night, the Primordial, Turrell's dark rooms, Van Gogh, Monet, GMUNK, Quayola, Braque,
// Cezanne, Picasso, de Kooning, and Twombly's paper, lightest). Over the plane lie forms far larger than any passage:
// orbs, vessels, vortices, faceted heads of planes, lit fields. Each passage takes the artist whose shade the form
// has where the passage lies, so the forms are drawn in artists as a painting is drawn in values; and inside every
// passage the form's shading carries on across the seams, so one light falls across all of them. The forms' edges are
// drawn as one line through every world they cross. The light turns slowly, and as it turns, passages change hands.
const int RANK_OF[25] = int[25](12, 12, 12, 12, 12, 1, 7, 2, 6, 0, 3, 8, 12, 3, 3, 8, 8, 1, 7, 0, 10, 11, 9, 4, 5);
const int BY_RANK[25] = int[25](9, 19, 5, 17, 7, 10, 13, 14, 23, 24, 8, 6, 18, 11, 15, 16, 22, 20, 21, 0, 2, 3, 4, 12, 1);
const int RSTART[14] = int[14](0, 2, 4, 5, 8, 9, 10, 11, 13, 16, 17, 18, 19, 25);
// how light each world is as it draws itself, before it is set to its artist's shade
const float NATL[25] = float[25](0.8, 0.2, 0.75, 0.88, 0.8, 0.12, 0.5, 0.3, 0.4, 0.08, 0.3, 0.55, 0.6, 0.65, 0.35, 0.72, 0.45, 0.6, 0.5, 0.9, 0.65, 0.72, 0.68, 0.42, 0.45);
const float MB = 610.0;                                              // a meta form to a square this wide, overlapping its neighbours
float shadeOf(int g) { return (float(RANK_OF[g]) + 0.5) / 13.0; }
float metaLightAngle(float t) { return t * 6.2832 / 377.0; }         // the light goes round once in 377 seconds
/**
 * One meta form, of block b, at p: its value v there, its signed distance sd (its edge where 0), how softly it
 * gives way to what lies round it (soft, cells; a form with a contour has soft under 34), how high it lies, and
 * inside a head of planes the signed distance to its nearest plane's edge.
 */
void metaForm(ivec2 b, vec2 p, float t, out float v, out float sd, out float soft, out float prio, out float edge) {
  uint h = h3(b.x, b.y, 4181u);
  vec2 C = (vec2(b) + 0.5 + (vec2(unit(h), unit(mixh(h + 1u))) - 0.5) * P1) * MB;
  float R = 144.0 + 233.0 * unit(mixh(h + 2u)), th = 6.2832 * unit(mixh(h + 3u)), la = metaLightAngle(t) + th;
  vec2 q = p - C, L = vec2(cos(la), sin(la));
  prio = unit(mixh(h + 4u));
  int k = int(mixh(h + 5u) % 5u);
  edge = 1e9; soft = 21.0;
  float r = length(q);
  if (k == 0) {                                                      // an orb, lit from the turning light
    sd = r - R;
    float z = sqrt(max(0.0, 1.0 - r * r / (R * R)));
    v = clamp(0.5 + 0.48 * dot(vec3(q / R, z), normalize(vec3(L, 0.8))), 0.02, 0.98);
  } else if (k == 1) {                                               // a vessel, as Morandi's: tall, rounded, lit from one side
    mat2 m = mat2(cos(th * 0.1), sin(th * 0.1), -sin(th * 0.1), cos(th * 0.1));
    vec2 u = m * q / vec2(0.5 * R, R);
    float f = pow(pow(abs(u.x), 4.0) + pow(abs(u.y), 4.0), 0.25);
    sd = (f - 1.0) * 0.5 * R;
    float nx = clamp(u.x, -1.0, 1.0);
    v = clamp(0.5 + 0.46 * (nx * L.x + sqrt(1.0 - nx * nx) * 0.6), 0.02, 0.98);
  } else if (k == 2) {                                               // a vortex, as Turner's: a swept spiral, no edge at all
    sd = r - R; soft = R * P2;
    float a = atan(q.y, q.x);
    v = 0.5 + 0.44 * sin(a + log(max(r, 1.0)) * 2.6 - t * 0.21 + th) * (1.0 - smoothstep(R * 0.4, R, r));
    prio *= 0.5;                                                     // lies under the forms with edges
  } else if (k == 3) {                                               // a head of planes, as Picasso's: each plane shaded, turning at its edges
    sd = r - R;
    float s = 0.0, en = 1e9;
    for (int n = 0; n < 5; n++) {
      uint hn = mixh(h + 10u + uint(n));
      float an = 6.2832 * unit(hn);
      vec2 o = (vec2(unit(mixh(hn + 1u)), unit(mixh(hn + 2u))) - 0.5) * R;
      float dl = dot(q - o, vec2(-sin(an), cos(an)));
      if (abs(dl) < abs(en)) en = dl;
      s += (unit(mixh(hn + 3u)) * 2.0 - 1.0) * (smoothstep(-13.0, 13.0, dl) * 2.0 - 1.0);
    }
    edge = en;
    v = clamp(0.5 + 0.2 * s + 0.1 * dot(q / R, L), 0.02, 0.98);
  } else {                                                           // a lit field, as Turrell's: glowing toward its rim
    vec2 e = abs(q) - vec2(R, R * P1);
    sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);
    v = 0.14 + 0.8 * smoothstep(-R * P2, 0.0, sd) * (0.6 + 0.4 * (0.5 + 0.5 * dot(normalize(q + 1e-3), L)));
  }
}
/**
 * The meta forms' value at p at time t (0 dark, 1 light), with no step anywhere: each form gives way to the
 * ground and to the forms under it over its soft width, the higher over the lower. And where a form has an edge,
 * a grey gradient across it (cg, how strongly ca): the whole scale from dark to light in 13 cells, the edge of a
 * form as the plane's whole range of artists in little.
 */
float metaAt(vec2 p, float t, out float cg, out float ca) {
  ivec2 b0 = ivec2(floor(p / MB));
  float M = 0.5 + 0.34 * (vnoise(p, 610.0, 4187u) * 2.0 - 1.0), sw = 1.0, sm = M, top = 0.0, topSd = 1e9, topEdge = 1e9, topSoft = 99.0;
  float shade = 1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    float v, sd, so, pr, ed;
    metaForm(b0 + ivec2(i, j), p, t, v, sd, so, pr, ed);
    float w = (1.0 - smoothstep(-so, so, sd)) * 21.0 * exp(8.0 * pr);
    sw += w; sm += w * v;
    if (w > top) { top = w; topSd = sd; topEdge = ed; topSoft = so; }
    uint h = h3(b0.x + i, b0.y + j, 4181u);
    int k = int(mixh(h + 5u) % 5u);
    if ((k == 0 || k == 1) && sd > 0.0 && sd < 144.0) {             // the shadow a solid form casts, soft-edged
      float la = metaLightAngle(t) + 6.2832 * unit(mixh(h + 3u)), R = 144.0 + 233.0 * unit(mixh(h + 2u));
      float v2, sd2, so2, pr2, ed2;
      metaForm(b0 + ivec2(i, j), p + vec2(cos(la), sin(la)) * R * P3, t, v2, sd2, so2, pr2, ed2);
      shade = min(shade, 1.0 - P2 * (1.0 - smoothstep(-R * P3, 13.0, sd2)));
    }
  }
  M = sm / sw * shade;
  // the gradients: across the top form's edge, and across the edges of a head's planes
  cg = 0.5; ca = 0.0;
  if (topSoft < 34.0) {
    float x = topSd / 13.0;
    if (abs(x) < 1.0) { cg = 0.5 - 0.5 * x; ca = (1.0 - x * x) * P1; }
    float y = topEdge / 8.0;
    if (topSd < 0.0 && abs(y) < 1.0 && (1.0 - y * y) * P2 > ca) { cg = 0.5 + 0.5 * y; ca = (1.0 - y * y) * P2; }
  }
  return M;
}
/** The world a passage takes at its change k: an artist whose shade is near the meta forms' value at its middle. */
int shadedWorld(vec2 mid, int i, int j, int k, float tk) {
  float cg, ca, M = metaAt(mid, tk, cg, ca);
  uint h = h3(i, j, uint(max(k, -1) + 7));
  int r = clamp(int(floor((M + (unit(h) - 0.5) * P2 / 1.3) * 13.0)), 0, 12);
  return BY_RANK[RSTART[r] + int(mixh(h + 1u) % uint(RSTART[r + 1] - RSTART[r]))];
}
/** A colour of world g set to the shade sh (an artist's, or two artists' blended across a seam), the meta forms' light M running on through it. */
vec3 toShade(vec3 col, int g, float sh, float M) {
  float l = lum(col), T = 255.0 * (0.05 + 0.9 * mix(sh, M, P1));
  float nl = clamp(T + (l - 255.0 * NATL[g]) * P1, 0.0, 255.0);
  return clamp(mix(col * (nl / max(l, 1.0)), col + (nl - l), 0.5), 0.0, 255.0);
}

/** A passage's colours at a cell, with its changes: which passage is c.e. */
void passageAt(int layer, Cell c, ivec2 cell, out vec3 A, out vec3 B, out int kind, out State Sd) {
  gCov = 0.0;
  vec4 m25 = entT(layer, c.e, 25), m26 = entT(layer, c.e, 26);
  kind = int(m25.z);
  uint seed = h3(int(m26.y), int(m26.z), 777u);
  gP = vec2(cell) + 0.5; gMid = m25.xy;
  gGram = kind == MOSAIC ? 0 : kind == NOCTURNE ? 1 : kind == SPRAY ? 2 : kind == WEAVE ? 3 : 4;
  // Out in the outskirts, a share of the passages leave the paper for a digital territory: more, the farther out.
  // (Drawn after the artists, every passage has a world of its own instead: below.)
  float dm = entT(layer, c.e, 27).x;
  bool worlds = uEarth == 0 && uArtOn == 1 && uForce < 0;
  if (!worlds && unit(mixh(seed + 77u)) < smoothUp(P3, 1.0, dm) * P1) {
    float r = unit(mixh(seed + 78u));
    gGram = dm < P1 ? (r < 0.25 ? 5 : r < 0.5 ? 6 : r < 0.75 ? 10 : 11) : dm < 1.0 - P3 ? (r < 0.34 ? 6 : r < 0.67 ? 7 : 8) : (r < 0.25 ? 7 : r < 0.5 ? 8 : 9);
    // now and then, the archive: a passage that turns through all the territories, one after another
    if (unit(mixh(seed + 79u)) < P4) { int n = int(mod(floor((uTime + 21.0 * unit(seed)) / 6.854), 7.0)); gGram = n < 5 ? 5 + n : 5 + n; }
  }
  if (uForce >= 0) gGram = uForce;
  gSeed = seed;
  // The passage's changes: this one, when it set out and from where.
  float tau = 55.0 * pow(PHI, unit(mixh(seed + 1u)) - 0.5) * (uEarth == 1 ? PHI : 1.0), first = 3.0 + 21.0 * unit(mixh(seed + 2u));
  int k = uTime < first ? -1 : int(floor((uTime - first) / tau));
  gK = k;
  float t0 = first + float(k) * tau;
  uint hk = mixh(seed ^ (uint(k) * 0x85ebca6bu));
  vec2 O = m25.xy + (vec2(unit(hk), unit(mixh(hk + 1u))) - 0.5) * 144.0, cp = vec2(cell) + 0.5;
  int gW0 = gGram, gW1 = gGram;
  if (worlds) {
    gW0 = shadedWorld(m25.xy, int(m26.y), int(m26.z), k - 1, first + float(k - 1) * tau);
    gW1 = shadedWorld(m25.xy, int(m26.y), int(m26.z), k, first + float(k) * tau);
  }
  gGram = gW1;
  State Sn = stateOf(seed, k);
  gGram = gW0;
  State So = stateOf(seed, k - 1);
  float pc = k < 0 || uHold > 0.5 ? 2.0 : progressAt(cp, t0, -1e9, O, seed, DUR, SPEED);
  Sd = So;                                                           // whichever holds the most of the cell now
  if (pc >= 0.5) Sd = Sn;
  if (uEarth == 0 && uArtOn == 1 && pc > 0.0 && pc < 1.0) {
    // A sheet changes as the artist changes one: white gesso brushed over the old marks in long strokes, then the new
    // marks drawn in, sweeping across as a hand writes.
    float brush = vnoise(vec2(gP.x / 13.0, gP.y), 3.0, hk) * 0.5 + vnoise(gP, 21.0, hk + 1u) * 0.5;
    vec3 gesso = vec3(240.0, 236.0, 226.0);
    gesso *= 0.96 + 0.06 * vnoise(vec2(gP.x / 21.0, gP.y), 2.0, hk + 2u);   // streaky, as a brush leaves it
    if (pc < 0.5) {
      { gGram = gW0; paint(layer, c, kind, So, A, B); }
      float w = 0.8 * smoothstep(brush - 0.15, brush + 0.15, pc * 2.4) * (0.7 + 0.3 * vnoise(vec2(gP.x / 34.0, gP.y), 2.0, hk + 3u));
      A = mix(A, gesso, w); B = mix(B, gesso, w);
    } else {
      float q = (pc - 0.5) * 2.0, sweep = fract((gP.x + gP.y * 0.4) / 233.0);
      gGate = smoothstep(sweep - 0.05, sweep + 0.05, q * 1.2 - 0.1);
      { gGram = gW1; paint(layer, c, kind, Sn, A, B); }
      float w = 0.5 * (1.0 - smoothstep(0.2, 1.0, q)) * (0.7 + 0.3 * vnoise(vec2(gP.x / 34.0, gP.y), 2.0, hk + 3u));
      A = mix(A, gesso, w); B = mix(B, gesso, w);
      gGate = 1.0;
    }
  }
  else if (pc >= 1.5) { gGram = gW1; paint(layer, c, kind, Sn, A, B); }
  else if (pc <= -0.5) { gGram = gW0; paint(layer, c, kind, So, A, B); }
  else {
    float tsel;
    int at = changeAt(kind, cell, t0, -1e9, O, seed, hk, DUR, SPEED, tsel);
    if (at == 0) { gGram = gW0; paint(layer, c, kind, So, A, B); }
    else if (at == 3) { gGram = gW1; paint(layer, c, kind, Sn, A, B); }
    else { gGram = gW1; A = B = flatIn(layer, c, kind, Sn, tsel, at == 2); }
  }
  gGram = pc >= 0.5 ? gW1 : gW0;
}

/** How near two of the collection's paintings are: by the same artist, near in years, or sharing a colour (shared). */
float kinship(int a, int b, out vec3 shared, out float sharedD) {
  vec4 ma = texelFetch(uWorks, ivec2(0, a), 0), mb = texelFetch(uWorks, ivec2(0, b), 0);
  float r = ma.x == mb.x ? 1.0 : ma.y > 0.0 && mb.y > 0.0 ? 0.5 * exp(-abs(ma.y - mb.y) / 34.0) : 0.0;
  sharedD = 1e9; shared = vec3(0);
  for (int i = 1; i <= 3; i++) for (int j = 1; j <= 3; j++) {
    vec3 ca = texelFetch(uWorks, ivec2(i, a), 0).rgb, cb = texelFetch(uWorks, ivec2(j, b), 0).rgb;
    float d = distance(ca, cb);
    if (d < sharedD) { sharedD = d; shared = (ca + cb) * 0.5; }
  }
  return max(r, 0.8 * clamp(1.0 - sharedD / 89.0, 0.0, 1.0));
}


// ---- singularities: where the image collapses to one pixel, and something new is born of it --------------
// One in each 987-cell square, kept at phi^-1 of them, each reaching 233 to 377 cells. Across its axis it has two
// halves. On one, the plane collapses: whatever world is there breaks into blocks of 2, 3, 5, 8 ... 89 cells, every
// block the colour of its middle, the blocks converging on the core, until at the core there is a single pixel: one
// colour, pulsing, with a corona and two turning beams, like a neutron star. On the other half a world found nowhere
// else builds up out of that pixel, coarse at the core and finer outward, in colours born of the core's own colour
// turned by the golden angle: a galaxy of seeds set by the golden angle, stained glass subdividing, rings
// interfering, or a prismatic crystal.
const int FIBS[11] = int[11](1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144);
struct Sing { bool on; vec2 C, axis; float R; uint h; };
Sing singAt(vec2 p) {
  const float G = 987.0;
  ivec2 sq = ivec2(floor(p / G));
  Sing best = Sing(false, vec2(0), vec2(1, 0), 0.0, 0u);
  float bd = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 q = sq + ivec2(i, j);
    uint h = h3(q.x, q.y, 1597u);
    if (unit(h) > P1) continue;
    vec2 C = (vec2(q) + 0.25 + 0.5 * vec2(unit(mixh(h + 1u)), unit(mixh(h + 2u)))) * G;
    float R = 233.0 + 144.0 * unit(mixh(h + 3u)), d = length(p - C);
    if (d < R && d < bd) { bd = d; float a = 6.2832 * unit(mixh(h + 4u)); best = Sing(true, C, vec2(cos(a), sin(a)), R, h); }
  }
  return best;
}
/** How coarse the image is at distance r from a core: one cell out at the rim, the whole core at the centre. */
float blockAt(float r, float R) { float t = clamp(1.0 - (r - 21.0) / (R - 21.0), 0.0, 1.0); return float(FIBS[min(10, int(pow(t, 1.3) * 10.99))]); }
/** The world born of a core of colour cc, at p (relative to the core). */
vec3 newborn(vec2 d, vec3 cc, uint h, float T) {
  int kind = int(mixh(h + 9u) % 4u);
  // the core's colour, made pure: its hue kept (or, if it has none, one of its own), its chroma and light raised
  float l = lum(cc);
  vec3 hue = chroma(cc) > 12.0 ? (cc - l) / chroma(cc) : turnRGB(vec3(1.0, -0.5, -0.5), turnOf(6.2832 * unit(h)));
  vec3 base = clamp(vec3(150.0) + hue * 150.0, 0.0, 255.0);
  #define PAL(k) min(satur(turnRGB(base, turnOf(float(k) * GA))) * 1.1 + 20.0, vec3(255.0))
  float r = length(d);
  if (kind == 0) {
    // a galaxy: seeds set by the golden angle, as a sunflower's are, turning slowly
    float n0 = (r / 3.0) * (r / 3.0);
    vec3 col = PAL(0) * 0.12;
    for (int k = -8; k <= 8; k++) {
      float n = floor(n0) + float(k);
      if (n < 1.0) continue;
      float a = n * GA + T * 0.05, rn = 3.0 * sqrt(n);
      if (length(d - rn * vec2(cos(a), sin(a))) < 1.2 + 0.004 * rn) col = PAL(int(mod(n, 5.0)));
    }
    return col;
  } else if (kind == 1) {
    // stained glass: a square subdividing, deeper the farther out, each piece its colour, lead between them
    vec2 q = d + 400.0, o = vec2(0), sz = vec2(800.0);
    uint hh = h;
    int depth = 2 + int(r / 55.0);
    for (int i = 0; i < 9; i++) {
      if (i >= depth) break;
      hh = mixh(hh + 7u);
      bool vert = (hh & 1u) == 1u;
      float cut = 0.3 + 0.4 * unit(hh);
      if (vert) { float cx = o.x + sz.x * cut; if (q.x < cx) { sz.x = cx - o.x; hh += 11u; } else { sz.x = o.x + sz.x - cx; o.x = cx; hh += 13u; } }
      else { float cy = o.y + sz.y * cut; if (q.y < cy) { sz.y = cy - o.y; hh += 17u; } else { sz.y = o.y + sz.y - cy; o.y = cy; hh += 19u; } }
    }
    vec2 e = min(q - o, o + sz - q);
    if (min(e.x, e.y) < 1.0) return vec3(20.0);
    return PAL(int(hh % 5u)) * (0.85 + 0.25 * sin(T * 0.7 + unit(hh) * 6.28));
  } else if (kind == 2) {
    // rings interfering: two sources, their waves crossing
    vec2 s = 21.0 * vec2(cos(T * 0.2), sin(T * 0.2));
    float w = sin(length(d - s) * 0.55 - T * 2.0) + sin(length(d + s) * 0.55 - T * 2.0);
    return mix(PAL(1), PAL(3), 0.5 + 0.25 * w) * (0.7 + 0.3 * step(0.0, w));
  }
  // a crystal: hexagons, each face lit by its angle to a light that turns
  vec2 hx = vec2(d.x / 11.0, (d.y + d.x * 0.577) / 12.7);
  vec2 cellc = floor(hx), f = fract(hx);
  float an = atan(f.y - 0.5, f.x - 0.5) + T * 0.3;
  vec3 col = mix(PAL(int(mod(cellc.x + cellc.y * 3.0, 5.0))), vec3(255.0), 0.25 + 0.25 * sin(an * 3.0));
  if (min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) < 0.06) col = vec3(250.0);
  return col;
  #undef PAL
}

layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;
void main() {
  ivec2 cell = uCell0 + ivec2(gl_FragCoord.xy), sl = (cell >> 8) - uC0, lc = cell & 255;
  outA = outB = vec4(uGround / 255.0, 1.0);
  if (any(lessThan(sl, ivec2(0))) || any(greaterThanEqual(sl, ivec2(16)))) return;
  vec4 si = texelFetch(uSlots, sl, 0);
  if (si.x < 0.5) return;
  int layer = int(si.x) - 1;
  Cell c = cellAt(layer, lc);
  bool art = uEarth == 0 && uArtOn == 1;
  // A singularity: on its collapsing half the cell takes the colour of its block's middle (the plane gathering to the
  // core); on the other, a new world is born.
  Sing sg = Sing(false, vec2(0), vec2(1, 0), 0.0, 0u);
  bool emerge = false;
  float sr = 0.0, sside = 0.0;
  vec2 cellP = vec2(cell) + 0.5;
  if (art && uHold < 0.5) {
    sg = singAt(cellP);
    if (sg.on) {
      vec2 d = cellP - sg.C;
      sr = length(d);
      sside = dot(d, sg.axis) + 21.0 * (vnoise(cellP, 34.0, sg.h) - 0.5);
      float b = blockAt(sr, sg.R);
      if (sside > 0.0 && (sr < sg.R - 13.0 || unit(h3(cell.x, cell.y, sg.h)) < (sg.R - sr) / 13.0)) emerge = true;
      else if (b > 1.0 || sr < 21.0) {
        ivec2 bc = sr < 21.0 ? ivec2(sg.C) : ivec2(sg.C + (floor(d / b) + 0.5) * b);
        ivec2 sl2 = (bc >> 8) - uC0;
        if (all(greaterThanEqual(sl2, ivec2(0))) && all(lessThan(sl2, ivec2(16)))) {
          vec4 si2 = texelFetch(uSlots, sl2, 0);
          if (si2.x > 0.5) { cell = bc; layer = int(si2.x) - 1; lc = bc & 255; c = cellAt(layer, lc); }
        }
      }
    }
  }
  if (art) c.e = c.en;
  if (art && uForce == 99) {                                         // #g99: the meta forms alone, and each passage's shade
    float cg, ca, M = metaAt(cellP, uTime, cg, ca);
    vec4 m26 = entT(layer, c.e, 26);
    float v = mix(shadeOf(shadedWorld(entT(layer, c.e, 25).xy, int(m26.y), int(m26.z), 0, uTime)), M, P1);
    vec3 g = vec3(255.0 * mix(0.05 + 0.9 * v, 0.04 + 0.92 * cg, ca));
    outA = outB = vec4(g / 255.0, 1.0);
    return;
  }
  // The cell's passage, and where it lies near an edge, the passage beyond: one evaluation in a loop of one or two, so
  // the shader holds a single copy of it.
  bool seam = art && !emerge && c.eb != c.e && c.pe < 0.62;
  vec3 A = vec3(0), B = vec3(0), Ab = vec3(0), Bb = vec3(0), mk0 = vec3(0), mk1 = vec3(0);
  int kind, kb, g0 = 0, g1 = 0;
  float cov0 = 0.0, cov1 = 0.0;
  uint s0 = 0u, s1 = 0u;
  State Sd, Sb;
  int sides = emerge ? 0 : seam ? 2 : 1;
  // the meta forms' value here, and how near their outline
  bool shaded = art && uForce < 0 && !emerge;
  float metaG = 0.5, metaA = 0.0, metaM = shaded ? metaAt(vec2(cell) + 0.5, uTime, metaG, metaA) : 0.5;
  for (int side = 0; side < sides; side++) {
    Cell cc = c;
    if (side == 1) cc.e = c.eb;
    vec3 a, b;
    int kk;
    State ss;
    passageAt(layer, cc, cell, a, b, kk, ss);
    if (side == 0) { A = a; B = b; kind = kk; Sd = ss; g0 = gGram; cov0 = gCov; mk0 = gMark; s0 = gSeed; }
    else { Ab = a; Bb = b; kb = kk; Sb = ss; g1 = gGram; cov1 = gCov; mk1 = gMark; s1 = gSeed; }
  }
  if (shaded) {
    // Each side in its artist's shade, and across a seam the two shades blend, halfway at the seam itself, so the
    // plane's light has no step in it anywhere.
    float w0 = seam ? 0.5 + 0.5 * smoothstep(0.0, 0.62, c.pe) : 1.0, sh = seam ? mix(shadeOf(g1), shadeOf(g0), w0) : shadeOf(g0);
    A = toShade(A, g0, sh, metaM); B = toShade(B, g0, sh, metaM);
    if (seam) { Ab = toShade(Ab, g1, sh, metaM); Bb = toShade(Bb, g1, sh, metaM); }
  }
  if (seam) { gGram = g0; gSeed = s0; gCov = cov0; gMark = mk0; gP = vec2(cell) + 0.5; gMid = entT(layer, c.e, 25).xy; }
  // Ground just grown comes in dot by dot; ground grown again for a new month, as the month sweeps over it.
  int prev = int(si.y) - 1;
  if (prev < 0) {
    float a = (uTime - si.z) / 0.377;
    if (a < 1.0 && unit(h3(cell.x, cell.y, 99u)) > a) A = B = uGround;
  } else {
    float tsel;
    int at = changeAt(kind, cell, uTurnAt, si.z, uTurnO, 0u, mixh(uint(uTurnAt * 1000.0)), 2.0, 233.0, tsel);
    if (at == 0) { Cell o = cellAt(prev, lc); paint(prev, o, int(entT(prev, o.e, 25).z), Sd, A, B); }
    else if (at != 3) A = B = flatIn(layer, c, kind, Sd, tsel, at == 2);
  }
  // ---- the seams: where two passages meet, what they are to each other decides how -------------------------
  // Paintings by one artist, near in years, or sharing a colour are kin, and their sheets run into each other across
  // a wide band, the nearer the kinder, each one's marks carrying on over the edge in the other's hand. Strangers
  // meet at a torn edge, the upper sheet casting a shadow on the lower. A colour the two share is stitched along the
  // seam. And where paper meets a digital territory, the marks are the passage between them: near the seam a crayon
  // stroke is a window onto the other world, and the stroke carries on into it in that world's own light.
  if (seam) {
    vec3 sharedC;
    float sharedD, r = kinship(int(entT(layer, c.e, 25).w), int(entT(layer, c.eb, 25).w), sharedC, sharedD);
    float db = c.pe * 55.0;                                          // cells to the seam
    float x = s0 < s1 ? db : -db;                                  // across the seam, one way for both sides
    float W = mix(1.5, 34.0, r), tear = (vnoise(gP, 3.0, 131u) - 0.5) * 5.0 * (1.0 - r) + (vnoise(gP, 13.0, 137u) - 0.5) * 8.0;
    float xt = x + tear, dith = r * W * (unit(h3(cell.x, cell.y, 139u)) * 2.0 - 1.0) * (0.4 + 0.6 * vnoise(gP, 5.0, 149u));
    bool ownSide = (xt > dith) == (x > 0.0);
    vec3 PA = ownSide ? A : Ab, PB2 = ownSide ? B : Bb;
    float covHere = ownSide ? cov0 : cov1, covThere = ownSide ? cov1 : cov0;
    int gHere = ownSide ? g0 : g1, gThere = ownSide ? g1 : g0;
    State Shere = Sb;
    if (ownSide) Shere = Sd;
    vec3 markThere = ownSide ? mk1 : mk0;
    // strangers: the upper sheet (the one on the positive side) shadows the lower
    if (xt < 0.0 && xt > -1.6 && r < 0.5) { PA *= mix(0.72, 1.0, r * 2.0); PB2 *= mix(0.72, 1.0, r * 2.0); }
    bool dig0 = gHere >= 5, dig1 = gThere >= 5;
    float ax = abs(xt), wc = mix(5.0, 34.0, r);
    if (!dig0 && !dig1) {
      // kin: the other sheet's marks carry on across, in this sheet's hand
      if (covThere > 0.5 && covHere < 0.3 && ax < wc * (0.4 + 0.6 * unit(h3(cell.x >> 2, cell.y >> 2, 151u)))) {
        vec3 hand = artVivid(Shere.w, 0);
        PA = mix(PA, hand, 0.85); PB2 = mix(PB2, hand, 0.6);
      }
    } else if (dig0 != dig1) {
      float paperCov = dig0 ? covThere : covHere;
      vec3 digA = dig0 ? PA : (ownSide ? Ab : A);
      if (paperCov > 0.5 && ax < 21.0 * (0.5 + 0.5 * unit(h3(cell.x >> 1, cell.y >> 1, 157u)))) {
        if (!dig0) { PA = digA; PB2 = digA; }                           // on the paper: the stroke is a window onto the other world
        else { vec3 lit = lum(digA) < 110.0 ? vec3(242.0, 240.0, 232.0) : vec3(18.0); PA = lit; PB2 = mix(PB2, lit, 0.6); }   // in it: the stroke in its light
      }
    }
    // a colour the two share, stitched along the seam
    if (sharedD < 21.0 && chroma(sharedC) > 34.0 && abs(x) < 0.9 && fract((gP.x - gP.y) / 8.0) < 0.38) { PA = sharedC * 0.85; PB2 = sharedC * 0.85; }
    A = PA; B = PB2;
  }
  // the meta forms' edges: one grey gradient, dark to light, through every world they cross
  if (shaded && metaA > 0.0) {
    vec3 grey = vec3(255.0 * (0.04 + 0.92 * metaG)) * vec3(1.0, 0.994, 0.985);
    A = mix(A, grey, metaA); B = mix(B, grey, metaA);
  }
  if (sg.on) {
    vec2 d = cellP - sg.C;
    vec3 soil; int s_;
    vec3 cc = soilAt(ivec2(sg.C), soil, s_) ? soil : vec3(180.0, 120.0, 90.0);
    if (emerge) {
      // the new world, coarse at the core and finer outward, each block the colour at its middle
      float b = blockAt(sr, sg.R);
      vec2 bd = sr < 21.0 ? vec2(0) : (floor(d / b) + 0.5) * b;
      A = B = newborn(bd, cc, sg.h, uTime);
    }
    if (sr < 21.0) {
      // the core: one pixel, pulsing
      vec3 core = sside > 0.0 ? A : A;
      A = B = min(core * (1.1 + 0.3 * sin(uTime * 8.0)) + 30.0, vec3(255.0));
    }
    if (abs(sr - 21.0) < 1.2) A = B = vec3(255.0, 252.0, 240.0);   // the corona
    // two beams turning, as a pulsar's do
    float ang = uTime * 0.8 + 6.2832 * unit(sg.h);
    vec2 bdir = vec2(cos(ang), sin(ang));
    if (sr > 21.0 && abs(dot(d, vec2(-bdir.y, bdir.x))) < 1.5) {
      float f = 0.7 * (1.0 - sr / sg.R);
      A = mix(A, vec3(255.0), f); B = mix(B, vec3(255.0), f);
    }
  }
  // An artificial day and night on the plane, 233 seconds round: the ground dims and cools, then brightens.
  if (uEarth == 0 && uArtOn == 1 && uHold < 0.5) {
    float night = smoothstep(0.55, 0.95, 0.5 - 0.5 * cos(6.2832 * uTime / 233.0)) * P2;
    vec3 tint = mix(vec3(1.0), vec3(0.55, 0.6, 0.8), night);
    A *= tint; B *= tint;
  }
  outA = vec4(A / 255.0, 1.0);
  outB = vec4(B / 255.0, 1.0);
}`;

/**
 * The ground painted on the GPU under the page's canvas, or null where there is no WebGL2 or only a software renderer
 * (which the canvas path outpaces), unless `force`. `hold` keeps every passage in its colours as grown, for comparing
 * with the workers' own pixels.
 */
function groundGL(stage, cv, { tokens, ground, reduced, hold, force, art, works }) {
  const glcv = document.createElement("canvas");
  glcv.setAttribute("aria-hidden", "true");
  glcv.style.pointerEvents = "none";
  const gl = glcv.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) return null;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  if (!force && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)))) return null;
  // Enough chunk slots for the largest view this screen can show, a chunk being 512 pixels square, and a few to spare.
  const dpr = window.devicePixelRatio || 1, side = (v) => Math.ceil((v * dpr) / (N * 2)) + 2;
  const SLOTS = Math.min(64, side(screen.width) * side(screen.height) + 8), ENT_W = 32, ENT_MAX = 256, T0 = performance.now();
  // The paintings with the most colour: those with a colour of chroma 89 or more.
  const vivid = tokens.filter((cols) => Math.max(...cols.map((c) => Math.max(...c) - Math.min(...c))) >= 89)
    .map((cols) => { const c = cols.slice(); while (c.length < 3) c.push(c[c.length - 1]); return c; });
  let cellProg = null, pxProg = null, U = {}, V = {}, edgeOn = false, fbo = null, tA = null, tB = null, FW = 0, FH = 0, lost = false;
  const lut = new Float32Array(16 * 16 * 4), slotRec = new Array(SLOTS).fill(null), used = new Float64Array(SLOTS);
  let frameNo = 0, turnAt = -1e9, turnO = [0, 0];

  // The shaders compile in the background where the browser can (they are long, and a slow driver could stall the
  // page); the ground is plain paper until they are ready.
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  let pending = null;
  function program(fsSrc) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = sh(gl.VERTEX_SHADER, GROUND_VS), fs = sh(gl.FRAGMENT_SHADER, fsSrc), pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    return { pr, vs, fs };
  }
  function finish(p, names) {
    if (!gl.getProgramParameter(p.pr, gl.LINK_STATUS)) {
      console.warn("DIRT ground shader:", gl.getShaderInfoLog(p.fs) || gl.getShaderInfoLog(p.vs) || gl.getProgramInfoLog(p.pr));
      return null;
    }
    const u = {};
    for (const n of names) u[n] = gl.getUniformLocation(p.pr, n);
    return [p.pr, u];
  }
  function tex(target) {
    const t = gl.createTexture();
    gl.bindTexture(target, t);
    for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(target, q, gl.NEAREST);
    for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(target, q, gl.CLAMP_TO_EDGE);
    return t;
  }
  function setup() {
    pending = { a: program(GROUND_FS), b: program(GROUND_PX) };
    gl.activeTexture(gl.TEXTURE0); tex(gl.TEXTURE_2D_ARRAY); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGB32UI, N, N, SLOTS);
    gl.activeTexture(gl.TEXTURE1); tex(gl.TEXTURE_2D_ARRAY); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA32F, ENT_W, ENT_MAX, SLOTS);
    gl.activeTexture(gl.TEXTURE2); tex(gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 16, 16);
    gl.activeTexture(gl.TEXTURE3); tex(gl.TEXTURE_2D);
    const nv = Math.max(1, vivid.length), vd = new Float32Array(3 * nv * 4);
    vivid.forEach((cols, w) => cols.slice(0, 3).forEach((c, n) => vd.set([c[0], c[1], c[2], 255], (w * 3 + n) * 4)));
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 3, nv);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 3, nv, gl.RGBA, gl.FLOAT, vd);
    // The artist's works, grammar by grammar: paper, five inks darkest first, then which are most colourful.
    const ws = art && art.works.length ? art.works.slice().sort((x, y) => x.grammar - y.grammar) : [];
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), lumA = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const ad = new Float32Array(Math.max(1, ws.length) * 8 * 4), gram = new Int32Array(10);
    // Sheets are paper: where a work is covered edge to edge in paint, its sheet takes one of the artist's papers.
    const papers = ws.filter((w) => lumA(rgb(w.paper)) > 200).map((w) => rgb(w.paper));
    ws.forEach((w, n) => {
      const painted = w.grammar !== 1 && lumA(rgb(w.paper)) < 200;       // the paint that covers it becomes an ink
      const inks = w.inks.map(([h]) => rgb(h)).concat(painted ? [rgb(w.paper)] : []).slice(-5).sort((x, y) => lumA(x) - lumA(y));
      if (!inks.length) inks.push(rgb(w.paper).map((v) => v * PHI ** -2));
      const count = Math.min(5, inks.length);
      while (inks.length < 5) inks.push(inks[inks.length - 1]);
      const chroma = inks.slice(0, count).map((c, i) => [Math.max(...c) - Math.min(...c), i]).sort((x, y) => y[0] - x[0]);
      const pp = painted && papers.length ? papers[n % papers.length] : rgb(w.paper);
      ad.set([...pp, w.grammar], n * 32);
      inks.slice(0, 5).forEach((c, i) => ad.set([...c, 1], n * 32 + 4 + i * 4));
      ad.set([chroma[0][1], (chroma[1] || chroma[0])[1], count, w.cover], n * 32 + 24);
      if (!gram[2 * w.grammar + 1]) gram[2 * w.grammar] = n;
      gram[2 * w.grammar + 1]++;
    });
    gl.activeTexture(gl.TEXTURE6); tex(gl.TEXTURE_2D);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 8, Math.max(1, ws.length));
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 8, Math.max(1, ws.length), gl.RGBA, gl.FLOAT, ad);
    // The collection, for the seams: each painting's artist and year, and its three colours.
    const nw = Math.max(1, tokens.length), wd = new Float32Array(4 * nw * 4), artists = new Map();
    tokens.forEach((cols, i) => {
      const wk = (works || [])[i] || {}, who = wk.artist || "", yr = /\d{4}/.exec(wk.date || "");
      if (!artists.has(who)) artists.set(who, who ? artists.size : -1 - i);
      wd.set([artists.get(who), yr ? +yr[0] : 0, 0, 0], i * 16);
      for (let n = 0; n < 3; n++) { const c = cols[Math.min(n, cols.length - 1)]; wd.set([c[0], c[1], c[2], 1], i * 16 + 4 + n * 4); }
    });
    gl.activeTexture(gl.TEXTURE7); tex(gl.TEXTURE_2D);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 4, nw);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, nw, gl.RGBA, gl.FLOAT, wd);
    pending.gram = gram; pending.artOn = ws.length && [0, 1, 2, 3, 4].every((g) => gram[2 * g + 1]) ? 1 : 0;
    fbo = gl.createFramebuffer(); FW = FH = 0;
    slotRec.fill(null);
    return gl.getError() === gl.NO_ERROR;
  }
  /** Once the shaders are compiled: their uniforms. If they failed, the page paints from the workers' pixels instead. */
  function link() {
    if (parallel && !(gl.getProgramParameter(pending.a.pr, parallel.COMPLETION_STATUS_KHR) && gl.getProgramParameter(pending.b.pr, parallel.COMPLETION_STATUS_KHR))) return false;
    const a = finish(pending.a, ["uCells", "uEnts", "uSlots", "uVivid", "uCell0", "uC0", "uEarth", "uNV", "uTime", "uHold", "uTurnAt", "uTurnO", "uGround", "uArt", "uArtOn", "uGram", "uForce", "uWorks"]);
    const b = finish(pending.b, ["uA", "uB", "uOff", "uCell0", "uH", "uEdge"]);
    if (!a || !b) { location.hash = (location.hash ? location.hash + "&" : "#") + "nogl"; location.reload(); return false; }
    [cellProg, U] = a; [pxProg, V] = b;
    gl.useProgram(cellProg);
    gl.uniform1i(U.uCells, 0); gl.uniform1i(U.uEnts, 1); gl.uniform1i(U.uSlots, 2); gl.uniform1i(U.uVivid, 3); gl.uniform1i(U.uArt, 6); gl.uniform1i(U.uWorks, 7);
    gl.uniform1i(U.uNV, vivid.length);
    gl.uniform3f(U.uGround, ground[0], ground[1], ground[2]);
    gl.uniform1f(U.uHold, hold || reduced ? 1 : 0);                  // with reduced motion, the colours stay as grown
    gl.uniform1i(U.uArtOn, pending.artOn);
    gl.uniform2iv(U.uGram, pending.gram);
    const forced = /(?:^|&)g([0-9]+)(?:&|$)/.exec(location.hash.slice(1));
    gl.uniform1i(U.uForce, forced ? +forced[1] : -1);
    edgeOn = pending.artOn === 1 && !forced;                         // edges as grey gradients, drawn after the artists
    gl.useProgram(pxProg);
    gl.uniform1i(V.uA, 4); gl.uniform1i(V.uB, 5);
    pending = null;
    return true;
  }
  /** The cells' two colours, a texel a cell, for as many cells as the canvas shows. */
  function cellTargets(w, h) {
    if (w <= FW && h <= FH) return;
    FW = Math.max(w, FW); FH = Math.max(h, FH);
    if (tA) { gl.deleteTexture(tA); gl.deleteTexture(tB); }
    gl.activeTexture(gl.TEXTURE4); tA = tex(gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, FW, FH);
    gl.activeTexture(gl.TEXTURE5); tB = tex(gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, FW, FH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tA, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tB, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  if (!setup()) return null;
  glcv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  glcv.addEventListener("webglcontextrestored", () => { tA = tB = null; lost = !setup(); });
  stage.insertBefore(glcv, cv);
  // Seen whenever the page's canvas is (the globe hides it).
  new MutationObserver(() => { glcv.style.visibility = cv.style.visibility; }).observe(cv, { attributes: true, attributeFilter: ["style"] });

  const resident = (c) => c.slot !== undefined && slotRec[c.slot] === c;
  function slotFor(need) {
    let best = -1, bu = Infinity;
    for (let s = 0; s < SLOTS; s++) {
      const r = slotRec[s];
      if (!r) return s;
      if (!need.has(r) && used[s] < bu) { bu = used[s]; best = s; }
    }
    return best;
  }
  function upload(c, s) {
    slotRec[s] = c; c.slot = s; used[s] = frameNo;
    gl.activeTexture(gl.TEXTURE0);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, s, N, N, 1, gl.RGB_INTEGER, gl.UNSIGNED_INT, c.cells);
    const nE = c.ents.length / (ENT_W * 4);
    gl.activeTexture(gl.TEXTURE1);
    if (nE) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, s, ENT_W, nE, 1, gl.RGBA, gl.FLOAT, c.ents);
  }
  /** A chunk first seen: when it came, and if it is the same ground grown again for a new month, how it takes over. */
  function arrived(c) {
    const born = (c.born - T0) / 1000;
    if (reduced || hold) { c.glBorn = -1e9; c.was = null; c.glEnd = 0; return; }
    c.glBorn = born;
    if (c.was && c.was.month !== c.month) {
      if (born - turnAt > 1.5) { turnAt = born; turnO = [vx + VW / 2, vy + VH / 2]; }
      const far = Math.hypot(Math.max(Math.abs(c.i * N - turnO[0]), Math.abs((c.i + 1) * N - turnO[0])), Math.max(Math.abs(c.j * N - turnO[1]), Math.abs((c.j + 1) * N - turnO[1])));
      c.glEnd = Math.max(born, turnAt + far / 233 + PHI) + 2 + 0.5;
    } else { c.was = null; c.glEnd = 0; }
  }

  function draw(now) {
    if (lost) return;
    const W = cv.width, H = cv.height, t = (now - T0) / 1000;
    if (glcv.width !== W || glcv.height !== H) { glcv.width = W; glcv.height = H; }
    if (pending && !link()) {
      const g = art ? [236, 232, 222] : ground;
      gl.clearColor(g[0] / 255, g[1] / 255, g[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    frameNo++;
    const i0 = Math.floor(vx / N), j0 = Math.floor(vy / N), i1 = Math.min(i0 + 15, Math.floor((vx + VW) / N)), j1 = Math.min(j0 + 15, Math.floor((vy + VH) / N));
    const seen = [], need = new Set();
    let earth = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = chunks.get(ck(i, j));
      if (!c || !c.cells) continue;
      if (c.glBorn === undefined) arrived(c);
      if (c.was && t > c.glEnd) c.was = null;
      seen.push(c); need.add(c);
      if (c.was && c.was.cells) need.add(c.was);
      if (c.month !== undefined) earth = true;
    }
    let ups = 0;
    for (const c of need) {
      if (resident(c)) { used[c.slot] = frameNo; continue; }
      if (ups >= 8) continue;
      const s = slotFor(need);
      if (s >= 0) { upload(c, s); ups++; }
    }
    lut.fill(0);
    for (const c of seen) {
      if (!resident(c)) continue;
      const o = ((c.j - j0) * 16 + (c.i - i0)) * 4;
      lut[o] = c.slot + 1; lut[o + 1] = c.was && resident(c.was) ? c.was.slot + 1 : 0; lut[o + 2] = c.glBorn;
    }
    gl.activeTexture(gl.TEXTURE2);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 16, 16, gl.RGBA, gl.FLOAT, lut);
    // First the cells in view, then the pixels from them.
    const ox = -Math.round(-vx * R), oy = -Math.round(-vy * R), cx0 = Math.floor(ox / R), cy0 = Math.floor(oy / R);
    const cw = Math.floor((ox + W - 1) / R) - cx0 + 1, ch = Math.floor((oy + H - 1) / R) - cy0 + 1;
    cellTargets(cw, ch);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(cellProg);
    gl.uniform2i(U.uCell0, cx0, cy0);
    gl.uniform2i(U.uC0, i0, j0);
    gl.uniform1i(U.uEarth, earth ? 1 : 0);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uTurnAt, turnAt);
    gl.uniform2f(U.uTurnO, turnO[0], turnO[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(pxProg);
    gl.uniform2i(V.uOff, ox, oy);
    gl.uniform2i(V.uCell0, cx0, cy0);
    gl.uniform1i(V.uH, H);
    gl.uniform1i(V.uEdge, edgeOn && !earth ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { draw, canvas: glcv, time: () => (performance.now() - T0) / 1000 };
}

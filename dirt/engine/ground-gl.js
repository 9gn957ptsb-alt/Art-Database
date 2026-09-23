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
uniform int uH;
out vec4 outColour;
void main() {
  ivec2 X = ivec2(gl_FragCoord.xy);
  X.y = uH - 1 - X.y;
  ivec2 G = X + uOff, t = (G >> 1) - uCell0;
  outColour = (G & 1) == ivec2(0) ? texelFetch(uA, t, 0) : texelFetch(uB, t, 0);
}`;

// The first pass, a fragment a cell: its two colours.
const GROUND_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2DArray;
precision highp sampler2DArray;
precision highp sampler2D;

uniform usampler2DArray uCells;     // two words a cell, 256 by 256 a chunk, a layer a chunk
uniform sampler2DArray uEnts;       // 32 texels a palette entry, 256 entries a chunk
uniform sampler2D uSlots;           // 16 by 16 chunks round the view: layer + 1, the layer it replaces + 1, when it came
uniform sampler2D uVivid;           // the saved paintings with the most colour, three texels each
uniform ivec2 uCell0, uC0;           // the first cell drawn; the first chunk of the 16 by 16
uniform int uEarth, uNV;
uniform float uTime, uHold, uTurnAt;
uniform vec2 uTurnO;
uniform vec3 uGround;

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

struct Cell { vec3 soil; int s, L, ti, e, te; bool even, over; float d, light; };
Cell cellAt(int layer, ivec2 lc) {
  uvec2 w = texelFetch(uCells, ivec3(lc, layer), 0).xy;
  Cell c;
  c.soil = vec3(uvec3(w.x, w.x >> 8, w.x >> 16) & 255u);
  uint f = w.x >> 24;
  c.s = int(f & 3u); c.L = int((f >> 2) & 3u); c.ti = int((f >> 4) & 3u); c.even = (f & 64u) != 0u; c.over = (f & 128u) != 0u;
  c.e = int(w.y & 255u); c.te = int((w.y >> 8) & 255u); c.d = float((w.y >> 16) & 255u) / 255.0; c.light = float(w.y >> 24) / 127.5;
  return c;
}
vec4 entT(int layer, int e, int t) { return texelFetch(uEnts, ivec3(t, e, layer), 0); }

// A passage's colours for one stretch of time. mode 0: as grown; 1: laid on fully; 2: two colours; 3: lights and
// darks swapped. n: golden-angle turns; w: which vivid painting, or -1 its own; cand: the Earth's palette, onward.
struct State { int mode, n, w, cand; };
State rawState(uint seed, int k) {
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

/**
 * A cell's colours in a state: A for its top left pixel, where a small dot sits, and B for its other three. A dot
 * of size 3 fills the cell; a gap is all ground.
 */
void paint(int layer, Cell c, int kind, State S, out vec3 A, out vec3 B) {
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
  vec4 m25 = entT(layer, c.e, 25), m26 = entT(layer, c.e, 26);
  int kind = int(m25.z);
  uint seed = h3(int(m26.y), int(m26.z), 777u);
  // The passage's changes: this one, when it set out and from where.
  float tau = 55.0 * pow(PHI, unit(mixh(seed + 1u)) - 0.5) * (uEarth == 1 ? PHI : 1.0), first = 3.0 + 21.0 * unit(mixh(seed + 2u));
  int k = uTime < first ? -1 : int(floor((uTime - first) / tau));
  float t0 = first + float(k) * tau;
  uint hk = mixh(seed ^ (uint(k) * 0x85ebca6bu));
  vec2 O = m25.xy + (vec2(unit(hk), unit(mixh(hk + 1u))) - 0.5) * 144.0, cp = vec2(cell) + 0.5;
  State Sn = stateOf(seed, k), So = stateOf(seed, k - 1);
  float pc = k < 0 || uHold > 0.5 ? 2.0 : progressAt(cp, t0, -1e9, O, seed, DUR, SPEED);
  State Sd = So;                                                     // whichever holds the most of the cell now
  if (pc >= 0.5) Sd = Sn;
  vec3 A, B;
  if (pc >= 1.5) paint(layer, c, kind, Sn, A, B);
  else if (pc <= -0.5) paint(layer, c, kind, So, A, B);
  else {
    float tsel;
    int at = changeAt(kind, cell, t0, -1e9, O, seed, hk, DUR, SPEED, tsel);
    if (at == 0) paint(layer, c, kind, So, A, B);
    else if (at == 3) paint(layer, c, kind, Sn, A, B);
    else A = B = flatIn(layer, c, kind, Sn, tsel, at == 2);
  }
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
  outA = vec4(A / 255.0, 1.0);
  outB = vec4(B / 255.0, 1.0);
}`;

/**
 * The ground painted on the GPU under the page's canvas, or null where there is no WebGL2 or only a software renderer
 * (which the canvas path outpaces), unless `force`. `hold` keeps every passage in its colours as grown, for comparing
 * with the workers' own pixels.
 */
function groundGL(stage, cv, { tokens, ground, reduced, hold, force }) {
  const glcv = document.createElement("canvas");
  glcv.setAttribute("aria-hidden", "true");
  glcv.style.pointerEvents = "none";
  const gl = glcv.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) return null;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  if (!force && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)))) return null;
  const SLOTS = 64, ENT_W = 32, ENT_MAX = 256, T0 = performance.now();
  // The paintings with the most colour: those with a colour of chroma 89 or more.
  const vivid = tokens.filter((cols) => Math.max(...cols.map((c) => Math.max(...c) - Math.min(...c))) >= 89)
    .map((cols) => { const c = cols.slice(); while (c.length < 3) c.push(c[c.length - 1]); return c; });
  let cellProg = null, pxProg = null, U = {}, V = {}, fbo = null, tA = null, tB = null, FW = 0, FH = 0, lost = false;
  const lut = new Float32Array(16 * 16 * 4), slotRec = new Array(SLOTS).fill(null), used = new Float64Array(SLOTS);
  let frameNo = 0, turnAt = -1e9, turnO = [0, 0];

  function program(fsSrc, names) {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("DIRT ground shader:", gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, GROUND_VS), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn("DIRT ground program:", gl.getProgramInfoLog(pr)); return null; }
    const u = {};
    for (const n of names) u[n] = gl.getUniformLocation(pr, n);
    return [pr, u];
  }
  function tex(target) {
    const t = gl.createTexture();
    gl.bindTexture(target, t);
    for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(target, q, gl.NEAREST);
    for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(target, q, gl.CLAMP_TO_EDGE);
    return t;
  }
  function setup() {
    const a = program(GROUND_FS, ["uCells", "uEnts", "uSlots", "uVivid", "uCell0", "uC0", "uEarth", "uNV", "uTime", "uHold", "uTurnAt", "uTurnO", "uGround"]);
    const b = program(GROUND_PX, ["uA", "uB", "uOff", "uCell0", "uH"]);
    if (!a || !b) return false;
    [cellProg, U] = a; [pxProg, V] = b;
    gl.useProgram(cellProg);
    gl.uniform1i(U.uCells, 0); gl.uniform1i(U.uEnts, 1); gl.uniform1i(U.uSlots, 2); gl.uniform1i(U.uVivid, 3);
    gl.activeTexture(gl.TEXTURE0); tex(gl.TEXTURE_2D_ARRAY); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RG32UI, N, N, SLOTS);
    gl.activeTexture(gl.TEXTURE1); tex(gl.TEXTURE_2D_ARRAY); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA32F, ENT_W, ENT_MAX, SLOTS);
    gl.activeTexture(gl.TEXTURE2); tex(gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 16, 16);
    gl.activeTexture(gl.TEXTURE3); tex(gl.TEXTURE_2D);
    const nv = Math.max(1, vivid.length), vd = new Float32Array(3 * nv * 4);
    vivid.forEach((cols, w) => cols.slice(0, 3).forEach((c, n) => vd.set([c[0], c[1], c[2], 255], (w * 3 + n) * 4)));
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 3, nv);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 3, nv, gl.RGBA, gl.FLOAT, vd);
    gl.uniform1i(U.uNV, vivid.length);
    gl.uniform3f(U.uGround, ground[0], ground[1], ground[2]);
    gl.uniform1f(U.uHold, hold || reduced ? 1 : 0);                  // with reduced motion, the colours stay as grown
    gl.useProgram(pxProg);
    gl.uniform1i(V.uA, 4); gl.uniform1i(V.uB, 5);
    fbo = gl.createFramebuffer(); FW = FH = 0;
    slotRec.fill(null);
    return gl.getError() === gl.NO_ERROR;
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
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, s, N, N, 1, gl.RG_INTEGER, gl.UNSIGNED_INT, c.cells);
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { draw, canvas: glcv, time: () => (performance.now() - T0) / 1000 };
}

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
uniform int uArtOn, uForce;         // uForce: one grammar everywhere, for looking at it (#g0 to #g4)
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

struct Cell { vec3 soil; int s, L, ti, e, te, en; bool even, over; float d, light, pe; };
Cell cellAt(int layer, ivec2 lc) {
  uvec3 w = texelFetch(uCells, ivec3(lc, layer), 0).xyz;
  Cell c;
  c.soil = vec3(uvec3(w.x, w.x >> 8, w.x >> 16) & 255u);
  uint f = w.x >> 24;
  c.s = int(f & 3u); c.L = int((f >> 2) & 3u); c.ti = int((f >> 4) & 3u); c.even = (f & 64u) != 0u; c.over = (f & 128u) != 0u;
  c.e = int(w.y & 255u); c.te = int((w.y >> 8) & 255u); c.d = float((w.y >> 16) & 255u) / 255.0; c.light = float(w.y >> 24) / 127.5;
  c.en = int(w.z & 255u); c.pe = float((w.z >> 8) & 255u) / 255.0;
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
      float A = row * (0.3 + 0.25 * unit(hl)), B = row * (0.45 + 0.3 * unit(mixh(hl + 1u))), v = A * (0.35 + 0.3 * unit(mixh(hl + 2u)));
      float y0 = (float(r) + 0.5) * row + (unit(mixh(hl + 3u)) - 0.5) * row * 0.25, ph = 6.2832 * unit(mixh(hl + 4u));
      float lean = 1.0 + 0.5 * unit(mixh(hl + 5u));
      vec2 q = vec2(p.x - (p.y - y0) * lean, p.y);                   // unlean the point into the pen's frame
      float t0 = (q.x - A * 1.25) / v, t1 = (q.x + A * 1.25) / v, dmin = 1e9, tb = 0.0;
      vec2 prev = vec2(0);
      for (int n = 0; n <= 22; n++) {
        float t = mix(t0, t1, float(n) / 22.0);
        float sz = 0.35 + 1.1 * vnoise(vec2(t, float(r * 2 + L)), 3.0, salt + 8u), ang = t + ph;
        float zig = unit(hl) < 0.3 ? asin(sin(ang)) * 0.6366 : sin(ang);   // some hands zigzag, sharp at the turns
        vec2 pt = vec2(v * t + A * sz * cos(ang), y0 + B * sz * zig + row * 0.1 * sin(t * 0.21 + ph));
        if (n > 0) { float d = segd(q, prev, pt); if (d < dmin) { dmin = d; tb = t; } }
        prev = pt;
      }
      // phrases: the pen is down for some turns and lifted for others
      float phr = tb / 18.85 + 7.0 * unit(mixh(hl + 6u));
      if (unit(h3(int(floor(phr)), r * 2 + L, salt + 5u)) > dens) continue;
      float lift = smoothstep(0.0, 0.08, fract(phr)) * smoothstep(1.0, 0.9, fract(phr));   // the pen comes down, and lifts
      float press = 0.45 + 0.55 * vnoise(vec2(tb * 3.0, float(r * 2 + L)), 5.0, salt + 6u);
      float w = (L == 0 ? 1.3 : 0.8) * (0.6 + 0.6 * press);
      float cov = clamp(w + 0.5 - dmin, 0.0, 1.0) * (0.55 + 0.45 * press) * lift;
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
    // the heart: a dark knot
    float a = atan(D.y, D.x);
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
    float brush = vnoise(vec2(p.x, p.y * 4.0), 21.0, 67u) * 0.03;
    paper = mix(paper, artPaper(w), smoothstep(0.0 + brush, 0.02 + brush, c.pe));
  }
  paper *= 1.0 + 0.05 * (vnoise(p, 55.0, 41u) - 0.5) + 0.03 * (vnoise(p, 8.0, 43u) - 0.5);
  float gesso = smoothstep(0.55, 0.85, vnoise(vec2(p.x / 6.0, p.y), 13.0, 47u));   // white scumbled over, in long strokes
  paper = mix(paper, max(paper, vec3(242.0, 238.0, 228.0)), gesso * 0.35);
  // the collection's dirt: soft stains of it, rubbed in, more in the outskirts; its dots show only faintly
  float rub = (0.03 + 0.12 * out_) * smoothstep(0.45, 0.9, vnoise(p, 89.0, 53u)) + 0.04 * out_;
  vec3 stain = mix(paper, paper * mix(vec3(1.0), c.soil / 160.0, 0.6), rub * 3.0);
  paper = mix(paper, stain, 0.5);
  A = c.s > 0 ? mix(paper, paper * c.soil / 255.0, 0.06 + 0.1 * out_) : paper;
  B = paper;
  float dens = 0.5 + 0.4 * out_, cov = 0.0;
  int ink = 0, g = gGram;
  vec3 col = vec3(0);
  uint salt = uint(w) * 7919u + 3u;
  if (g == 3 || g == 1) {
    cov = writing(p, salt, g == 1 ? min(1.0, dens * 1.4) : dens, g == 1 ? 21.0 : 34.0, ink);
    if (g == 1) { int i2; cov = max(cov, 0.8 * writing(p + vec2(0.0, 10.0), salt + 99u, min(1.0, dens * 1.4), 21.0, i2)); }
    col = g == 1 ? artInk(w, int(artRoles(w).z) - 1) : ink == 0 ? artInk(w, 0) : artVivid(w, 0);
    if (g == 1) col = max(col, paper + (255.0 - paper) * 0.55);      // chalk
  } else if (g == 2 || g == 4) {
    if (g == 4) {
      vec3 wash = mix(paper, artVivid(w, 1), 0.3);
      float run = smoothstep(0.35, 0.7, vnoise(vec2(p.x * 3.0, p.y / 8.0), 3.0, salt + 21u));   // it runs down in streaks
      float fall = smoothstep(0.2, 0.75, vnoise(p, 144.0, salt + 22u));
      paper = mix(paper, mix(wash, wash * 0.9, run), fall * smoothstep(0.0, 0.4, c.pe));
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
  cov *= smoothstep(0.0, 0.35 + 0.2 * vnoise(p, 34.0, 71u), c.pe) * gGate;
  if (cov <= 0.0) return;
  // a stroke's heart is solid; its edges catch only on the dirt's dots, as crayon catches on the tooth of paper,
  // and the dirt's own colour works into it
  vec3 m = g == 1 ? col * (0.85 + 0.15 * lum(c.soil) / 128.0) : mix(col, col * c.soil / 128.0, 0.18);
  float core = smoothstep(0.45, 0.75, cov);
  A = mix(A, m, max(core, c.s > 0 ? cov : 0.0));
  B = mix(B, m, max(core, c.s == 3 ? cov * 0.8 : 0.0));
}

/**
 * A cell's colours in a state: A for its top left pixel, where a small dot sits, and B for its other three. A dot
 * of size 3 fills the cell; a gap is all ground.
 */
void paint(int layer, Cell c, int kind, State S, out vec3 A, out vec3 B) {
  if (uEarth == 0 && uArtOn == 1) { sheet(layer, c, kind, S, A, B); return; }
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
  if (uEarth == 0 && uArtOn == 1) c.e = c.en;
  vec4 m25 = entT(layer, c.e, 25), m26 = entT(layer, c.e, 26);
  int kind = int(m25.z);
  uint seed = h3(int(m26.y), int(m26.z), 777u);
  gP = vec2(cell) + 0.5; gMid = m25.xy;
  gGram = kind == MOSAIC ? 0 : kind == NOCTURNE ? 1 : kind == SPRAY ? 2 : kind == WEAVE ? 3 : 4;
  // Out in the outskirts, a share of the passages leave the paper for a digital territory: more, the farther out.
  float dm = entT(layer, c.e, 27).x;
  if (unit(mixh(seed + 77u)) < smoothUp(P3, 1.0, dm) * P1) {
    float r = unit(mixh(seed + 78u));
    gGram = dm < P1 ? (r < 0.5 ? 5 : 6) : dm < 1.0 - P3 ? (r < 0.34 ? 6 : r < 0.67 ? 7 : 8) : (r < 0.25 ? 7 : r < 0.5 ? 8 : 9);
    // now and then, the archive: a passage that turns through all the territories, one after another
    if (unit(mixh(seed + 79u)) < P4) gGram = 5 + int(mod(floor((uTime + 21.0 * unit(seed)) / 6.854), 5.0));
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
  State Sn = stateOf(seed, k), So = stateOf(seed, k - 1);
  float pc = k < 0 || uHold > 0.5 ? 2.0 : progressAt(cp, t0, -1e9, O, seed, DUR, SPEED);
  State Sd = So;                                                     // whichever holds the most of the cell now
  if (pc >= 0.5) Sd = Sn;
  vec3 A, B;
  if (uEarth == 0 && uArtOn == 1 && pc > 0.0 && pc < 1.0) {
    // A sheet changes as the artist changes one: white gesso brushed over the old marks in long strokes, then the new
    // marks drawn in, sweeping across as a hand writes.
    float brush = vnoise(vec2(gP.x / 13.0, gP.y), 3.0, hk) * 0.5 + vnoise(gP, 21.0, hk + 1u) * 0.5;
    vec3 gesso = vec3(240.0, 236.0, 226.0);
    gesso *= 0.96 + 0.06 * vnoise(vec2(gP.x / 21.0, gP.y), 2.0, hk + 2u);   // streaky, as a brush leaves it
    if (pc < 0.5) {
      paint(layer, c, kind, So, A, B);
      float w = 0.8 * smoothstep(brush - 0.15, brush + 0.15, pc * 2.4) * (0.7 + 0.3 * vnoise(vec2(gP.x / 34.0, gP.y), 2.0, hk + 3u));
      A = mix(A, gesso, w); B = mix(B, gesso, w);
    } else {
      float q = (pc - 0.5) * 2.0, sweep = fract((gP.x + gP.y * 0.4) / 233.0);
      gGate = smoothstep(sweep - 0.05, sweep + 0.05, q * 1.2 - 0.1);
      paint(layer, c, kind, Sn, A, B);
      float w = 0.5 * (1.0 - smoothstep(0.2, 1.0, q)) * (0.7 + 0.3 * vnoise(vec2(gP.x / 34.0, gP.y), 2.0, hk + 3u));
      A = mix(A, gesso, w); B = mix(B, gesso, w);
      gGate = 1.0;
    }
  }
  else if (pc >= 1.5) paint(layer, c, kind, Sn, A, B);
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
function groundGL(stage, cv, { tokens, ground, reduced, hold, force, art }) {
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
  let cellProg = null, pxProg = null, U = {}, V = {}, fbo = null, tA = null, tB = null, FW = 0, FH = 0, lost = false;
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
    pending.gram = gram; pending.artOn = ws.length && [0, 1, 2, 3, 4].every((g) => gram[2 * g + 1]) ? 1 : 0;
    fbo = gl.createFramebuffer(); FW = FH = 0;
    slotRec.fill(null);
    return gl.getError() === gl.NO_ERROR;
  }
  /** Once the shaders are compiled: their uniforms. If they failed, the page paints from the workers' pixels instead. */
  function link() {
    if (parallel && !(gl.getProgramParameter(pending.a.pr, parallel.COMPLETION_STATUS_KHR) && gl.getProgramParameter(pending.b.pr, parallel.COMPLETION_STATUS_KHR))) return false;
    const a = finish(pending.a, ["uCells", "uEnts", "uSlots", "uVivid", "uCell0", "uC0", "uEarth", "uNV", "uTime", "uHold", "uTurnAt", "uTurnO", "uGround", "uArt", "uArtOn", "uGram", "uForce"]);
    const b = finish(pending.b, ["uA", "uB", "uOff", "uCell0", "uH"]);
    if (!a || !b) { location.hash = (location.hash ? location.hash + "&" : "#") + "nogl"; location.reload(); return false; }
    [cellProg, U] = a; [pxProg, V] = b;
    gl.useProgram(cellProg);
    gl.uniform1i(U.uCells, 0); gl.uniform1i(U.uEnts, 1); gl.uniform1i(U.uSlots, 2); gl.uniform1i(U.uVivid, 3); gl.uniform1i(U.uArt, 6);
    gl.uniform1i(U.uNV, vivid.length);
    gl.uniform3f(U.uGround, ground[0], ground[1], ground[2]);
    gl.uniform1f(U.uHold, hold || reduced ? 1 : 0);                  // with reduced motion, the colours stay as grown
    gl.uniform1i(U.uArtOn, pending.artOn);
    gl.uniform2iv(U.uGram, pending.gram);
    const forced = /(?:^|&)g([0-9])(?:&|$)/.exec(location.hash.slice(1));
    gl.uniform1i(U.uForce, forced ? +forced[1] : -1);
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { draw, canvas: glcv, time: () => (performance.now() - T0) / 1000 };
}

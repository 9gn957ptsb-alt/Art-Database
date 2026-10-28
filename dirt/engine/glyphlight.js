/* A copy of docs/v2/glyphlight.js on the Artist Website's branch (claude/artist-website-dev-s92irf): change both together. */
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
 *     style: "ascii",       // "ascii" | "dots" | "grain" | "scan" | "text"
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
 * The storyboard (artist, 27 Oct 2026: "the infinite texture that you are displaying is a storyboard and someone's
 * thumb is the direction of how the story plays out ... like a flip book but instead of each sticky note being behind
 * the other, they are placed side-by-side"). The overlay can lie on a plane, and every control can vary by place on
 * it, a frame (sticky note) at a time or a cell at a time. Every option below is optional; with none of them the
 * output is what it was, pixel for pixel.
 *
 *     origin: () => ({ x, y }),  // the overlay's top-left on the plane, CSS px ({ dx, dy }: the drag offset, so -x, -y).
 *                                // The cells, the dot and grain dithers, the text and the field are pinned to the plane
 *                                // and ride with it pixel for pixel. Default { x: 0, y: 0 }: as before.
 *     region: { w, h },          // a storyboard frame on the plane, CSS px (a number: square). Default: the first view.
 *     seam: 0.236,               // the share of a frame's width (and height) at each of its sides that blends into the
 *                                // next frame: a gutter of 2 × seam frames, centred on the frames' boundary
 *     field: (i, j) => ({...}),  // the settings of frame (i, j), i = floor(planeX / w), j = floor(planeY / h): any of
 *                                // style, set (its glyphs, a name in SETS or an index into sets), mode, level (0, 1, 2:
 *                                // cells of 1, 2 or 4 cells a side) or cell (CSS px, the nearest level), exposure,
 *                                // contrast, gamma, detail, invert, glow, thresh, under, gain (glow ×), ev (exposure +),
 *                                // jitter and seed (shimmer). Called once a frame, when it first comes into view, and
 *                                // kept; g.set({ field }) forgets them. Across a gutter the continuous ones blend
 *                                // (smoothstep), mode blends exactly (each mode's colour weighted), and style, set,
 *                                // invert, level, seed and text dissolve cell by cell (the golden R2 sequence).
 *     text: (i, j) => ({ text, at }),  // style "text": the stretch of text frame (i, j) writes, from letter `at`, in its
 *                                // own reading order (a string, as before: one text, read across the plane).
 *     sets: [ ... ],             // more glyph sets (glyphs or names in SETS), up to 8 with `set` (index 0); one atlas,
 *                                // each its own ink; the cells take the widest set's aspect
 *     ahead: [ ... ],            // sets a field will use, put in the atlas at the start (no rebuild when a frame using
 *                                // one first comes into view), without changing the cells' aspect as `sets` does
 *     letters: " abc…",          // the letters of a page-made letters map (below), in the page's order
 *     maps: { tone, light, more, marks, letters, space: "plane" | "screen", rect: { x, y, w, h } },
 *                                // page-made canvases of settings, read nearest at each cell's middle, uploaded when
 *                                // made and on g.touch(); each one given replaces those settings inside rect (CSS px
 *                                // on the plane, or of the overlay; default one texel a cell from 0, 0). Opaque pixels
 *                                // only, value v = 0..255 (GlyphLight.encode makes them):
 *                                //   tone    R exposure −3 + 6v/255 EV, G contrast 0.5 + 2.5v/255, B gamma 0.3 + 2.7v/255
 *                                //   light   R glow 1.5v/255 (gain included), G thresh v/255, B under v/255
 *                                //   more    R detail 3v/255, G shimmer 0.5v/255, B shimmer seed v (0: none)
 *                                //   marks   R style (0 ascii, 1 dots, 2 grain, 3 scan, 4 text), G set (index), B level
 *                                //           (bits 0-1) + mode × 4 (bits 2-3, 0 full 1 mono 2 gold 3 blue) + 128 invert
 *                                //   letters R + 256 G: an index into `letters` (style text)
 *     level: 0,                  // the whole overlay's density level without a field (0, 1, 2), as a frame's `level`
 *     gain, ev, jitter, seed     // the motion terms for the whole overlay, as in a field (default 1, 0, 0, 0)
 *     levels: "screen" | "frozen",  // auto levels over the screen as before, or fixed (0, 1): "frozen" with a field
 *     still: () => false,        // true: nothing moves, so auto levels hold where they are (nothing here moves by
 *                                // time: the motions are places, and a frame's shimmer seed is its own)
 *     guard: false,              // true: a flash guard (WCAG 2.3.1): a block of 8 × 8 cells whose light swings by 10 %
 *                                // or more, back and forth, more than twice in a second, is held as it was for a second
 *   g.touch()                    // the maps have changed: read them again on the next frame
 *   g.at(x, y)                   // the settings in force under a CSS point of the overlay (for checks)
 *   g.stats()                    // the last frame's time on the CPU (ms) and its average, field calls, the levels in
 *                                // view, the blocks the guard holds and its events (for checks)
 *   GlyphLight.motions           // Glyph Light's video motions laid out as places, s in [0, 1) along the story:
 *                                // pulse(s) → { gain }, shimmer(k) → { jitter, seed }, reveal(s) → { ev, gain },
 *                                // push(s) → { level } (push in as density: glyphs grow frame by frame);
 *                                // GlyphLight.ease is their easing, GlyphLight.encode(settings) the maps' bytes
 *
 * The work is done once a cell (FS_CELL: its tone, its mark and its glow, for each level in view), so the pass at the
 * screen's pixels (FS_DRAW) only finds its cell, draws the mark's shape and lays on the halo.
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
  const STYLE_NAMES = ["ascii", "dots", "grain", "scan", "text"], MODE_NAMES = ["full", "mono", "gold", "blue"];
  const MAXG = 128;                                     // the most glyphs a text could carry (a string text: as before)
  const MAXSETS = 8, MAXLETTERS = 1024, TXW = 4096, FW = 5, MAXFRAMES = 64;
  const BLENDS = { normal: "source-over", lighten: "lighten", darken: "darken", screen: "screen", multiply: "multiply",
    overlay: "overlay", "color-dodge": "color-dodge", "color-burn": "color-burn", "hard-light": "hard-light",
    "soft-light": "soft-light", difference: "difference", exclusion: "exclusion", plus: "lighter", "plus-lighter": "lighter" };
  const MAPS = ["tone", "light", "more", "marks", "letters"];
  // Kana and kanji are drawn in Noto Sans JP, as the artifact draws them: its stylesheet is asked for when a set needs it.
  const JP = /[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
  const JP_CSS = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap";

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

  // ---- the motions of Glyph Light's video panel, laid out as places (t a place in the story, not a time) ----------
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const clamp01 = (s) => Math.max(0, Math.min(1, +s || 0));
  const motions = {
    // the glow breathing, twice along a run: glow × 0.35 .. 1.45
    pulse: (s) => ({ gain: 0.35 + 1.1 * (0.5 - 0.5 * Math.cos(4 * Math.PI * (+s || 0))) }),
    // each frame's own grain of lightness, still while the frame is still
    shimmer: (k) => ({ jitter: 0.16, seed: 1000 + (k | 0) }),
    // from dark (−5 EV, the glow at a fifth) to full by three quarters of the run
    reveal: (s) => { const k = ease(Math.min(1, clamp01(s) / 0.75)); return { ev: -5 * (1 - k), gain: 0.2 + 0.8 * k }; },
    // push in as density: cells of 1, 2 and then 4 cells a side, eased along the run
    push: (s) => ({ level: Math.min(2, Math.floor(ease(clamp01(s)) * 3)) }),
  };

  // ---- the page's maps: settings as bytes ------------------------------------------------------------------------
  const byte = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255);
  function encode(v) {
    v = v || {};
    const n = (k, d) => (v[k] != null && Number.isFinite(+v[k]) ? +v[k] : d);
    const st = typeof v.style === "number" ? v.style : (STYLES[v.style] || 0), md = typeof v.mode === "number" ? v.mode : (MODES[v.mode] || 0);
    return {
      tone: [byte((n("exposure", 0) + n("ev", 0) + 3) / 6), byte((n("contrast", 1.2) - 0.5) / 2.5), byte((n("gamma", 1) - 0.3) / 2.7)],
      light: [byte(n("glow", 0.6) * n("gain", 1) / 1.5), byte(n("thresh", 0.7)), byte(n("under", 0))],
      more: [byte(n("detail", 0) / 3), byte(n("jitter", 0) / 0.5), n("seed", 0) & 255],
      marks: [Math.max(0, Math.min(4, st | 0)), Math.max(0, Math.min(MAXSETS - 1, n("set", 0) | 0)),
        (Math.max(0, Math.min(2, n("level", 0) | 0))) | ((md & 3) << 2) | (v.invert ? 128 : 0)],
    };
  }
  function decode(name, p) {
    if (name === "tone") return { exposure: -3 + 6 * p[0] / 255, contrast: 0.5 + 2.5 * p[1] / 255, gamma: 0.3 + 2.7 * p[2] / 255 };
    if (name === "light") return { glow: 1.5 * p[0] / 255, thresh: p[1] / 255, under: p[2] / 255 };
    if (name === "more") return { detail: 3 * p[0] / 255, jitter: 0.5 * p[1] / 255, seed: p[2] };
    if (name === "marks") return { style: Math.min(4, p[0]), set: p[1], level: Math.min(2, p[2] & 3), mode: (p[2] >> 2) & 3, invert: (p[2] & 128) !== 0 };
    return { letter: p[0] + 256 * p[1] };
  }

  // ---- the shaders ---------------------------------------------------------------------------------------------
  const VS = `#version 300 es
in vec2 p; out vec2 v;
void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

  // A cell's plane index divided by n, rounded down (blocks of n × n cells, pinned to the plane).
  const FDIV = `
ivec2 fdiv(ivec2 a, int n){ return ivec2(a.x >= 0 ? a.x / n : -((n - 1 - a.x) / n), a.y >= 0 ? a.y / n : -((n - 1 - a.y) / n)); }`;

  // Once a cell, for each level in view (level k: blocks of 2^k × 2^k cells, stacked in bands of rows): its settings
  // (the overlay's, the field's blended across gutters, the page's maps), its colour read and toned, its lightness, the
  // mark it makes and the light it glows with. Written as the bits of floats, so the pass at the pixels reads exactly
  // what was worked out here.
  const FS_CELL = `#version 300 es
precision highp float; precision highp int; precision highp usampler2D;
uniform sampler2D S;                 // the picture, a texel a cell (row 0 at the top)
uniform highp sampler2D INK, F;      // each atlas slot's ink, a row a level; the field, five texels a frame
uniform usampler2D TX;               // the texts, as indices into the letters
uniform highp sampler2D M0, M1, M2, M3, M4;   // the page's maps: tone, light, more, marks, letters
uniform sampler2D HM;                // the flash guard: blocks of 8 × 8 cells held as they were
uniform usampler2D PA, PB, PC;       // the cells as they were last frame (for the guard)
uniform ivec4 LA[3];                 // per level: cols, rows, first row of its band, in view
uniform ivec4 LO[3];                 // per level: its first block on the plane (x, y), its row of text (blocks)
uniform ivec4 PV[3]; uniform ivec3 PBand;     // per level last frame: first block, cols, rows; its band
uniform ivec2 P0;                    // the overlay's first cell on the plane
uniform vec2 cellCss, offCss;        // a cell in CSS px; how far the plane's cell P0 begins before the overlay, CSS px
uniform vec2 lohi;
uniform vec3 tone;
uniform float detail, invert, glowAmt, thresh, under, jitter, dotArea, bayer[16];
uniform int mode, style, seed, setBase, setN, level, textBase, textStart, textLen, lettersN, useField, maps, hold;
uniform ivec2 SETB[8];               // each set's first slot and its glyphs
uniform vec2 region, fwo; uniform float seam, gref; uniform ivec2 fwin;
uniform vec4 mapRect; uniform ivec2 MS[5];
uniform ivec4 HG;                    // the guard's first block on the plane and its blocks
layout(location = 0) out uvec4 oA;   // the lit colour, the lightness
layout(location = 1) out uvec4 oB;   // the glow on the mark itself; the mark: slot, shape, drawn, under
layout(location = 2) out uvec4 oC;   // the halo's source; the mark's own light (for the guard)
${FDIV}
float lumOf(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float toneOf(float x, vec3 t){ x = (x - lohi.x) / max(0.05, lohi.y - lohi.x); x *= t.x; x = (x - 0.5) * t.y + 0.5; return pow(clamp(x, 0.0, 1.0), 1.0 / t.z); }
vec3 tint(vec3 c, float l, int m){
  if (m == 0) return c;
  if (m == 1) return vec3(l);
  if (m == 2) return vec3(min(1.0, l * 1.1 + 0.078), l * 0.82, l * 0.35);
  return vec3(l * 0.35, l * 0.75, min(1.0, l * 1.1 + 0.078));
}
float hashU(uvec2 c){ uint h = c.x * 0x27d4eb2du ^ (c.y * 0x165667b1u + 1337u); h ^= h >> 15; h *= 0x2c1b3c6du; h ^= h >> 12; h *= 0x297a2d39u; h ^= h >> 15; return float(h) / 4294967296.0; }
float hashS(ivec2 c, int s){ uvec2 u = uvec2(c); return s == 0 ? hashU(u) : hashU(u ^ (uvec2(uint(s)) * uvec2(0x9e3779b9u, 0x85ebca6bu))); }
// Roberts's R2 sequence (2018), the golden ratio's two-dimensional kin: a threshold for each block that never clumps
float r2(ivec2 b, int k){ uvec2 u = uvec2(b) + uvec2(uint(k)) * uvec2(0x6a09e667u, 0xbb67ae85u); uint h = 0x80000000u + u.x * 3242174889u + u.y * 2447445414u; return float(h >> 8) / 16777216.0; }
int wrapi(int a, int n){ return a >= 0 ? a % n : n - 1 - (-a - 1) % n; }
// the picture over block b of level k: a mip of the sample, the block's cells averaged
vec3 rawAt(ivec2 b, int k){
  if (k == 0) return texelFetch(S, b, 0).rgb;
  int n = 1 << k; ivec2 c0 = (LO[k].xy + b) * n - P0; vec3 s = vec3(0.0); float m = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    if (x >= n || y >= n) continue;
    ivec2 c = c0 + ivec2(x, y);
    if (c.x < 0 || c.y < 0 || c.x >= LA[0].x || c.y >= LA[0].y) continue;
    s += texelFetch(S, c, 0).rgb; m += 1.0;
  }
  return m > 0.0 ? s / m : vec3(0.0);
}
vec3 cellRGB(ivec2 c, int k, vec3 t){ c = clamp(c, ivec2(0), LA[k].xy - 1); vec3 s = rawAt(c, k); return vec3(toneOf(s.r, t), toneOf(s.g, t), toneOf(s.b, t)); }
// what a style makes of a cell's colour in a mode: the lit colour, the colour of the glow on the mark, the halo's colour
void colours(int st, int m, vec3 rgb, float l, bool on, out vec3 lit, out vec3 gc, out vec3 gs){
  vec3 col = tint(rgb, l, m);
  if (st == 0 || st == 4) {
    lit = min(vec3(1.0), col / (0.55 + 0.45 * l));
    if (st == 4) lit *= smoothstep(0.03, 0.16, l);
    vec3 warm = min(vec3(1.0), col + vec3(0.235, 0.157, 0.0));
    gc = m == 0 ? warm : lit;
    gs = m == 0 ? warm : col / (0.55 + 0.45 * l);
  } else if (st == 1) {
    float b = 1.25 / max(0.35, max(col.r, max(col.g, col.b)));
    gs = min(vec3(1.0), col * b);
    lit = on ? gs : col * 0.35; gc = on ? gs : vec3(0.0);
  } else if (st == 2) {
    gs = min(vec3(1.0), col * (0.45 + 0.75 * l) + 0.078 * l);
    lit = on ? gs : col * 0.22; gc = on ? gs : vec3(0.0);
  } else {
    lit = min(vec3(1.0), col * (0.6 + 0.6 * l) + 0.157 * l * l); gc = lit; gs = lit;
  }
}
vec3 mapAt(highp sampler2D m, int i, vec2 u){ ivec2 z = MS[i]; return texelFetch(m, min(ivec2(u * vec2(z)), z - 1), 0).rgb; }
struct Cfg { vec3 tone; float detail, glow, thresh, under, jitter; int style, sb, sn, seed, ts, tl, ti, letter; bool inv, present; vec4 mw; ivec4 md; };
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  int k = 0;
  for (int i = 1; i < 3; i++) if (LA[i].w != 0 && fc.y >= LA[i].z) k = i;
  ivec4 la = LA[k]; ivec2 b = ivec2(fc.x, fc.y - la.z);
  oA = uvec4(0u); oB = uvec4(0u); oC = uvec4(0u);
  if (b.x >= la.x || b.y >= la.y) return;
  int n = 1 << k;
  ivec2 B = LO[k].xy + b;                                   // the block on the plane, in blocks
  ivec2 P = B * n;                                          // its first cell on the plane
  if (hold != 0) {
    ivec2 h = fdiv(P, 8) - HG.xy;
    if (h.x >= 0 && h.y >= 0 && h.x < HG.z && h.y < HG.w && texelFetch(HM, h, 0).r > 0.5) {
      ivec2 q = B - PV[k].xy;
      if (q.x >= 0 && q.y >= 0 && q.x < PV[k].z && q.y < PV[k].w) {
        ivec2 t = ivec2(q.x, q.y + PBand[k]);
        oA = texelFetch(PA, t, 0); oB = texelFetch(PB, t, 0); oC = texelFetch(PC, t, 0); return;
      }
    }
  }
  vec2 rel = (vec2(P - P0) + 0.5 * float(n)) * cellCss - offCss;   // the block's middle, CSS px from the overlay's top-left
  Cfg cf;
  cf.tone = tone; cf.detail = detail; cf.glow = glowAmt; cf.thresh = thresh; cf.under = under; cf.jitter = jitter;
  cf.style = style; cf.sb = setBase; cf.sn = setN; cf.seed = seed; cf.ts = textStart; cf.tl = textLen;
  cf.ti = B.y * LO[k].z + B.x; cf.letter = -1; cf.inv = invert > 0.5; cf.present = k == level || k == 0;
  cf.mw = vec4(1.0, 0.0, 0.0, 0.0); cf.md = ivec4(mode, 0, 0, 0);
  if (useField != 0) {
    // the four frames round this place, weighted across their gutters
    vec2 q = (rel - fwo) / region - 0.5, fq = floor(q), t = q - fq;
    vec2 s = seam > 0.0 ? smoothstep(vec2(0.5 - seam), vec2(0.5 + seam), t) : step(vec2(0.5), t);
    ivec2 f0 = ivec2(fq);
    vec4 w = vec4((1.0 - s.x) * (1.0 - s.y), s.x * (1.0 - s.y), (1.0 - s.x) * s.y, s.x * s.y);
    vec4 a0 = vec4(0.0), a1 = vec4(0.0); vec3 W = vec3(0.0);
    vec4 d2[4]; vec4 d3[4]; vec4 d4[4];
    for (int i = 0; i < 4; i++) {
      d2[i] = vec4(0.0); d3[i] = vec4(0.0); d4[i] = vec4(0.0, 0.0, 0.0, -1.0);
      if (w[i] <= 0.0) continue;
      ivec2 fr = clamp(f0 + ivec2(i & 1, i >> 1), ivec2(0), fwin - 1);
      int x = fr.x * 5;
      a0 += w[i] * texelFetch(F, ivec2(x, fr.y), 0);
      a1 += w[i] * texelFetch(F, ivec2(x + 1, fr.y), 0);
      d2[i] = texelFetch(F, ivec2(x + 2, fr.y), 0);
      d3[i] = texelFetch(F, ivec2(x + 3, fr.y), 0);
      d4[i] = texelFetch(F, ivec2(x + 4, fr.y), 0);
      W[clamp(int(d3[i].y), 0, 2)] += w[i];
    }
    cf.tone = vec3(exp2(a0.x), a0.y, a0.z); cf.detail = a0.w;
    cf.glow = a1.x; cf.thresh = a1.y; cf.under = a1.z; cf.jitter = a1.w;
    cf.mw = w; cf.md = ivec4(int(d3[0].x), int(d3[1].x), int(d3[2].x), int(d3[3].x));
    // which level draws here, and which frame's marks: one threshold a block, so a gutter dissolves without a line
    float d = r2(B, k), Wk = W[k], Wle = k == 0 ? W.x : (k == 1 ? W.x + W.y : 1.0);
    cf.present = k == 0 || (Wk > 0.0 && d * Wle < Wk);
    float dd = (k > 0 && cf.present) ? min(0.999999, d * Wle / Wk) : d;
    int pick = 0, last = -1; float acc = 0.0; bool found = false;
    for (int i = 0; i < 4; i++) {
      if (w[i] <= 0.0 || (Wk > 0.0 && int(d3[i].y) != k)) continue;
      acc += Wk > 0.0 ? w[i] / Wk : w[i]; last = i;
      if (!found && dd < acc) { pick = i; found = true; }
    }
    if (!found) pick = max(last, 0);
    vec4 p2 = d2[pick], p3 = d3[pick], p4 = d4[pick];
    cf.style = int(p2.x); cf.sb = int(p2.y); cf.sn = max(1, int(p2.z)); cf.inv = p2.w > 0.5; cf.seed = int(p3.z);
    if (p4.w > 0.5) {
      // the frame's own text, in its own reading order, a letter a block
      vec2 bc = cellCss * float(n), fl = fwo + vec2(f0 + ivec2(pick & 1, pick >> 1)) * region;
      ivec2 g = ivec2(floor((rel - fl) / bc));
      cf.ts = int(p4.x); cf.tl = int(p4.y); cf.ti = int(p4.z) + g.y * max(1, int(floor(region.x / bc.x))) + g.x;
    } else if (p4.w > -0.5) { cf.ts = int(p4.x); cf.tl = int(p4.y); }
    else cf.tl = 0;
  }
  if (maps != 0) {
    vec2 u = (rel - mapRect.xy) / mapRect.zw;
    if (u.x >= 0.0 && u.y >= 0.0 && u.x < 1.0 && u.y < 1.0) {
      if ((maps & 1) != 0) { vec3 m = mapAt(M0, 0, u); cf.tone = vec3(exp2(m.r * 6.0 - 3.0), 0.5 + m.g * 2.5, 0.3 + m.b * 2.7); }
      if ((maps & 2) != 0) { vec3 m = mapAt(M1, 1, u); cf.glow = m.r * 1.5; cf.thresh = m.g; cf.under = m.b; }
      if ((maps & 4) != 0) { vec3 m = mapAt(M2, 2, u); cf.detail = m.r * 3.0; cf.jitter = m.g * 0.5; cf.seed = int(m.b * 255.0 + 0.5); }
      if ((maps & 8) != 0) {
        ivec3 m = ivec3(mapAt(M3, 3, u) * 255.0 + 0.5);
        int si = clamp(m.g, 0, 7);
        cf.style = min(m.r, 4); cf.sb = SETB[si].x; cf.sn = max(1, SETB[si].y); cf.inv = (m.b & 128) != 0;
        cf.present = k == 0 || (m.b & 3) == k;
        cf.mw = vec4(1.0, 0.0, 0.0, 0.0); cf.md = ivec4((m.b >> 2) & 3, 0, 0, 0);
      }
      if ((maps & 16) != 0) { ivec3 m = ivec3(mapAt(M4, 4, u) * 255.0 + 0.5); cf.letter = min(m.r + 256 * m.g, lettersN - 1); }
    }
  }
  // the picture here, toned, sharpened by its neighbours, inverted as asked, shimmered by its frame's seed
  vec3 rgb = cellRGB(b, k, cf.tone); float l = lumOf(rgb);
  if (cf.detail > 0.0) {
    float sm = 0.0, nm = 0.0;
    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
      ivec2 q = b + ivec2(dx, dy);
      if (q.x < 0 || q.y < 0 || q.x >= la.x || q.y >= la.y) continue;
      sm += lumOf(cellRGB(q, k, cf.tone)); nm += 1.0;
    }
    float l2 = clamp(l + cf.detail * (l - sm / nm), 0.0, 1.0);
    rgb = l > 0.002 ? min(vec3(1.0), rgb * (l2 / l)) : vec3(0.0); l = l2;
  }
  if (cf.inv) { rgb = 1.0 - rgb; l = 1.0 - l; }
  if (cf.jitter > 0.0) l = clamp(l + (hashS(B, cf.seed + 7919) - 0.5) * cf.jitter * (0.3 + l), 0.0, 1.0);
  // the mark
  bool glow = cf.glow > 0.0 && l >= cf.thresh, on = false;
  uint shape = 0u; int slot = 0; float kk = 0.0, vis = 0.0;
  int st = cf.style;
  if (st == 0) {
    int g = min(cf.sn - 1, int(floor(l * float(cf.sn))));
    slot = cf.sb + g; kk = texelFetch(INK, ivec2(slot, k), 0).r;
    if (g > 0) { shape = 1u; vis = kk; }
  } else if (st == 1) {
    on = l > bayer[(B.y & 3) * 4 + (B.x & 3)];
    if (on || l > 0.03) { shape = 2u; vis = dotArea; }
    kk = on ? dotArea : 0.0;
  } else if (st == 2) {
    on = l > hashS(B, cf.seed);
    if (on || l > 0.04) { shape = 3u; vis = 1.0; }
    kk = on ? 1.0 : 0.0;
  } else if (st == 3) {
    kk = (0.12 + 0.6 * l) * 0.82;
    if (l >= 0.04) { shape = 4u; vis = kk; }
  } else {
    int g = 0;
    if (cf.letter >= 0) { slot = textBase + cf.letter; shape = 1u; }
    else {
      if (cf.tl > 0) { int ix = cf.ts + wrapi(cf.ti, cf.tl); g = int(texelFetch(TX, ivec2(ix % ${TXW}, ix / ${TXW}), 0).r); }
      slot = textBase + g; if (g > 0) shape = 1u;
    }
    kk = texelFetch(INK, ivec2(slot, k), 0).r; if (shape == 1u) vis = kk;
  }
  vec3 lit = vec3(0.0), gc = vec3(0.0), gs = vec3(0.0);
  if (useField == 0 && (maps & 8) == 0) colours(st, cf.md.x, rgb, l, on, lit, gc, gs);
  else for (int i = 0; i < 4; i++) {
    if (cf.mw[i] <= 0.0) continue;
    vec3 a, c, e; colours(st, cf.md[i], rgb, l, on, a, c, e);
    lit += cf.mw[i] * a; gc += cf.mw[i] * c; gs += cf.mw[i] * e;
  }
  if (st == 4 && max(lit.r, max(lit.g, lit.b)) <= 0.0) shape = 0u;
  bool own = useField == 0 && maps == 0;                    // the overlay's own settings: as before, to the bit
  float gf = own ? 1.0 : cf.glow / max(gref, 1e-6);
  vec3 gcg = glow ? (own ? gc : gc * gf) : vec3(0.0);
  vec3 src = (l >= cf.thresh && cf.glow > 0.0) ? (own ? gs * kk : gs * kk * gf) : vec3(0.0);
  uint u16 = uint(clamp(cf.under, 0.0, 1.0) * 65535.0 + 0.5);
  oA = floatBitsToUint(vec4(lit, l));
  oB = uvec4(floatBitsToUint(gcg), (uint(slot) & 0xfffu) | (shape << 12) | (cf.present ? 0x8000u : 0u) | (u16 << 16));
  oC = floatBitsToUint(vec4(src, min(1.0, lumOf(lit) * vis)));
}`;

  // The glow's source, a texel a cell of the finest grid, from whichever level's mark is drawn there (rows bottom-up).
  const FS_GLOW = `#version 300 es
precision highp float; precision highp int; precision highp usampler2D;
uniform usampler2D SB, SC;
uniform ivec4 LA[3]; uniform ivec4 LO[3]; uniform ivec2 P0;
out vec4 o;
${FDIV}
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy); c.y = LA[0].y - 1 - c.y;
  ivec2 t = c;
  for (int k = 2; k >= 1; k--) {
    if (LA[k].w == 0) continue;
    ivec2 b = fdiv(P0 + c, 1 << k) - LO[k].xy, tk = ivec2(b.x, b.y + LA[k].z);
    if ((texelFetch(SB, tk, 0).w & 0x8000u) != 0u) { t = tk; break; }
  }
  o = uintBitsToFloat(texelFetch(SC, t, 0));
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

  // The flash guard's light: each block of 8 × 8 cells, the mean of what its marks and halos give (from the glow pass).
  const FS_LUMA = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D G; uniform ivec2 grid, first, P0; uniform float glowAmt;
out vec4 o;
void main(){
  ivec2 q = ivec2(gl_FragCoord.xy); vec2 s = vec2(0.0);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    ivec2 c = (first + q) * 8 + ivec2(x, y) - P0;
    if (c.x < 0 || c.y < 0 || c.x >= grid.x || c.y >= grid.y) continue;
    vec4 g = texelFetch(G, ivec2(c.x, grid.y - 1 - c.y), 0);
    s += vec2(g.a + dot(g.rgb, vec3(0.299, 0.587, 0.114)) * 1.8 * glowAmt, 1.0);
  }
  o = vec4(s.y > 0.0 ? min(1.0, s.x / s.y) : 0.0, 0.0, 0.0, 1.0);
}`;

  // The glyphs, at the screen's own pixels: which level's mark this pixel is in, its shape, its halo.
  const FS_DRAW = `#version 300 es
precision highp float; precision highp int; precision highp usampler2D;
uniform usampler2D SA, SB;     // the cells, worked out
uniform sampler2D A, G1, G2;   // the glyphs (a cell each, side by side, a band a level), the two glows
uniform ivec4 LA[3]; uniform ivec4 LO[3]; uniform ivec4 GA[3];   // levels; the atlas: glyphs a row, first row, own band
uniform ivec2 P0;
uniform vec2 cellPx, view, off;    // a cell in device px; the overlay in device px; where the plane's cell P0 begins
uniform float glowAmt, under;
uniform int perCell;
uniform vec3 bg;
uniform vec4 keep[8]; uniform int keeps;
in vec2 v; out vec4 o;
${FDIV}
void main(){
  vec2 px = vec2(gl_FragCoord.x, view.y - gl_FragCoord.y);          // from the top left
  for (int i = 0; i < 8; i++) { if (i >= keeps) break; vec4 k = keep[i]; float d = length(px - k.xy) - k.z; if (d < 0.0) { o = vec4(0.0); return; } }
  vec2 X = px + off;                                                 // from the corner of the plane's cell P0
  ivec2 c = ivec2(floor(X / cellPx));
  int k = 0; ivec2 t = c; uvec4 bs = uvec4(0u); bool got = false;
  for (int i = 2; i >= 1; i--) {
    if (LA[i].w == 0) continue;
    ivec2 b = fdiv(P0 + c, 1 << i) - LO[i].xy, ti = ivec2(b.x, b.y + LA[i].z);
    uvec4 s = texelFetch(SB, ti, 0);
    if ((s.w & 0x8000u) != 0u) { k = i; t = ti; bs = s; got = true; break; }
  }
  if (!got) bs = texelFetch(SB, c, 0);
  int n = 1 << k;
  vec2 cell = cellPx * float(n);
  vec2 f = X - vec2(fdiv(P0 + c, n) * n - P0) * cellPx;            // where in its mark, device px
  uvec4 a = texelFetch(SA, t, 0);
  vec3 lit = uintBitsToFloat(a.xyz); float l = uintBitsToFloat(a.w);
  uint pk = bs.w, shape = (pk >> 12) & 7u;
  float cov = 0.0;
  if (shape == 1u) {
    int s = int(pk & 0xfffu), pr = GA[k].x;
    vec2 ce = GA[k].z != 0 ? cell : cellPx, fa = GA[k].z != 0 ? f : f / float(n);
    cov = texelFetch(A, ivec2(int(float(s % pr) * ce.x + min(fa.x, ce.x - 1.0)), GA[k].y + (s / pr) * int(ce.y) + int(min(fa.y, ce.y - 1.0))), 0).r;
  } else if (shape == 2u) {
    float sz = cell.x * 0.72, ox = (cell.x - sz) * 0.5, oy = (cell.y - sz) * 0.5;
    if (f.x >= ox && f.x < ox + sz && f.y >= oy && f.y < oy + sz) cov = 1.0;
  } else if (shape == 3u) {
    cov = 1.0;
  } else if (shape == 4u) {
    float h = cell.y * (0.12 + 0.6 * l), top = (cell.y - h) * 0.5;
    if (f.x < cell.x * 0.82 && f.y >= top && f.y < top + h) cov = 1.0;
  }
  vec3 glyph = lit * cov;
  glyph += uintBitsToFloat(bs.xyz) * cov * glowAmt * 0.6;
  vec2 g = (X / cellPx) / vec2(LA[0].xy); g.y = 1.0 - g.y;
  vec3 halo = (texture(G1, g).rgb + texture(G2, g).rgb * 0.8) * glowAmt;
  float un = perCell != 0 ? float(pk >> 16) / 65535.0 : under;
  vec3 rgb = glyph + halo + bg * (1.0 - un) * (1.0 - cov);
  float alpha = cov + (1.0 - un) * (1.0 - cov);
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
  const setChars = (s) => (typeof s === "string" && Object.prototype.hasOwnProperty.call(SETS, s) ? SETS[s] : String(s));

  // Noto Sans JP for kana and kanji: its stylesheet once a page, then the faces the glyphs need
  let jpLink = null;
  function fontsFor(chars, then) {
    if (typeof document === "undefined" || !document.fonts || !chars) return;
    const go = () => {                               // (then only if the faces were not already in: else nothing changed)
      let had = false; try { had = document.fonts.check(`40px ${FONT}`, chars); } catch (e) {}
      document.fonts.load(`40px ${FONT}`, chars).catch(() => {}).then(() => { if (!had) then(); });
    };
    if (!JP.test(chars)) return void go();
    if (!jpLink) {
      jpLink = document.querySelector('link[href*="family=Noto+Sans+JP"]');
      if (jpLink) jpLink.__wait = Promise.resolve();
      else {
        jpLink = document.createElement("link"); jpLink.rel = "stylesheet"; jpLink.href = JP_CSS;
        jpLink.__wait = new Promise((ok) => { jpLink.onload = jpLink.onerror = ok; });
        (document.head || document.documentElement).appendChild(jpLink);
      }
    }
    jpLink.__wait.then(go);
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
    const P = { cell: compile(gl, VS, FS_CELL), glow: compile(gl, VS, FS_GLOW), blur: compile(gl, VS, FS_BLUR), draw: compile(gl, VS, FS_DRAW), luma: null };
    const tS = texture(gl, gl.NEAREST), tA = texture(gl, gl.NEAREST), tInk = texture(gl, gl.NEAREST), tF = texture(gl, gl.NEAREST);
    const tTX = texture(gl, gl.NEAREST), tHM = texture(gl, gl.NEAREST), tNil = texture(gl, gl.NEAREST);
    const tM = MAPS.map(() => texture(gl, gl.NEAREST));
    const fb = [0, 1, 2, 3].map(() => { const t = texture(gl, gl.LINEAR), f = gl.createFramebuffer(); return { t, f }; });
    // what every sampler reads until it has more (each unit needs a texture of its own kind)
    const fill = (t, ifmt, fmt, type, data, w = 1, h = 1) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data); };
    fill(tA, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    fill(tInk, gl.R32F, gl.RED, gl.FLOAT, new Float32Array(3), 1, 3);
    fill(tF, gl.RGBA32F, gl.RGBA, gl.FLOAT, new Float32Array(4));
    fill(tTX, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, new Uint32Array(1));
    fill(tHM, gl.R8, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(1));
    fill(tNil, gl.RGBA32UI, gl.RGBA_INTEGER, gl.UNSIGNED_INT, new Uint32Array(4));
    for (const t of tM) fill(t, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    // the cells worked out, a texel each (lit colour, mark, halo source), each level in its band of rows; a second set
    // of them when the guard needs last frame's
    const makeState = () => ({ f: gl.createFramebuffer(), t: [0, 1, 2].map(() => texture(gl, gl.NEAREST)), w: 0, h: 0 });
    const states = [makeState()];
    let cur = 0;

    // the picture, a pixel a cell (on the GPU when the browser can)
    const sample = document.createElement("canvas");
    sample.__glyphs = true;
    const sx = sample.getContext("2d", { alpha: false });
    // a smaller copy read back now and then, for the auto levels
    const probe = document.createElement("canvas"); probe.width = probe.height = 48;
    const px = probe.getContext("2d", { willReadFrequently: true });

    let set = "", ratio = 0.6, cwD = 0, chD = 0, cols = 0, rows = 0, W = 0, H = 0, dprR = 1, cssCell = 6;
    let atlasKey = "", lo = 0, hi = 1, lastProbe = 0, probed = false, raf = 0, dead = false, fontsTried = false;
    let ox = 0, oy = 0, P0x = 0, P0y = 0, offX = 0, offY = 0, stackH = 0, fieldOn = false, mapsOn = 0, perCell = false;
    const LV = [0, 1, 2].map((k) => ({ n: 1 << k, on: k === 0, B0x: 0, B0y: 0, cols: 0, rows: 0, band: 0, rowW: 0 }));
    const PREV = [0, 1, 2].map(() => ({ B0x: 0, B0y: 0, cols: 0, rows: 0, band: 0 }));
    const GA = [0, 1, 2].map(() => ({ perRow: 1, y: 0, own: 0 }));

    // ---- the sets in use, and the letters ------------------------------------------------------------------------
    const sorted = new Map();                       // a set's glyphs → them sorted by ink, and their widest
    let sortedVer = 0;
    const sortedOf = (chars) => { let e = sorted.get(chars); if (!e) { const s = sortSet(chars); e = { s, ratio: widthRatio(s) }; sorted.set(chars, e); } return e; };
    let setList = [], setSrc = null;                // the overlay's sets: index 0 is `set`, then `sets`, then the field's
    const fontsAsked = new Set();
    function invalidate() {
      for (const k in inkOf) delete inkOf[k];
      o.__sorted = null; o.__text = null; atlasKey = ""; sorted.clear(); sortedVer++; ver++;
    }
    function askFonts(chars) { if (chars && !fontsAsked.has(chars)) { fontsAsked.add(chars); fontsFor(chars, invalidate); } }
    function setsOf() {
      const src = [o.set, o.sets, o.ahead];
      if (setSrc && setSrc[0] === src[0] && setSrc[1] === src[1] && setSrc[2] === src[2]) return;
      setSrc = src; setList = [o.set];
      for (const s of [...(o.sets || []), ...(o.ahead || [])]) { const c = setChars(s); if (setList.length < MAXSETS && !setList.includes(c)) { setList.push(c); askFonts(c); } }
      ver++;
    }
    function setIndex(v) {
      if (v == null || v === "") return 0;
      if (typeof v === "number") return v >= 0 && v < setList.length ? v | 0 : 0;
      const c = setChars(v); let i = setList.indexOf(c);
      if (i < 0 && setList.length < MAXSETS) { setList.push(c); i = setList.length - 1; askFonts(c); ver++; }
      return Math.max(0, i);
    }
    let letterArr = [" "], letterIx = new Map([[" ", 0]]), texts = new Map(), txData = [], txDirty = true, textSrc, lettersSrc, lettersGrow = false;
    let baseText = { start: 0, len: 0 }, lettersRatio = 0.6, lettersRatioKey = "";
    const flatOf = (t) => String(t).replace(/\s+/g, " ").trim() + " ";
    function resetText() {
      textSrc = o.text; lettersSrc = o.letters;
      texts = new Map(); txData = []; txDirty = true; ver++;
      if (o.letters != null) { letterArr = [...String(o.letters)]; lettersGrow = true; }
      else if (typeof o.text === "string") { letterArr = [" ", ...[...new Set([...o.text.replace(/\s+/g, "")])].slice(0, MAXG - 1)]; lettersGrow = false; }
      else { letterArr = [" "]; lettersGrow = true; }
      if (!letterArr.length) letterArr = [" "];
      letterIx = new Map(); letterArr.forEach((ch, i) => { if (!letterIx.has(ch)) letterIx.set(ch, i); });
      baseText = typeof o.text === "string" ? registerText(flatOf(o.text)) : { start: 0, len: 0 };
      if (o.letters != null) askFonts(letterArr.join(""));
    }
    function registerText(flat) {
      let e = texts.get(flat);
      if (e) return e;
      const start = txData.length; let grew = false;
      for (let i = 0; i < flat.length; i++) {
        const ch = flat[i];
        let ix = letterIx.get(ch);
        if (ix == null && lettersGrow && letterArr.length < MAXLETTERS) { ix = letterArr.length; letterArr.push(ch); letterIx.set(ch, ix); grew = true; }
        txData.push(ix || 0);
      }
      if (grew) { askFonts(flat); ver++; }
      e = { start, len: flat.length }; texts.set(flat, e); txDirty = true;
      return e;
    }

    // ---- the frames of the field --------------------------------------------------------------------------------
    const cache = new Map();
    let ver = 0, winKey = "", fieldCalls = 0, frames = [], win = { i: 0, j: 0, nx: 1, ny: 1 }, reg = { w: 1, h: 1 }, regDefault = null;
    let gref = 0, grefMax = 1.5, winGlow = 0, softAll = false, textUsed = false, fdata = new Float32Array(0);
    function frameAt(i, j) {
      const key = i + "," + j;
      let e = cache.get(key);
      if (!e) {
        fieldCalls++;
        let v = null, t = null;
        try { v = o.field ? o.field(i, j) : null; } catch (err) { console.error(err); }
        try { t = typeof o.text === "function" ? o.text(i, j) : null; } catch (err) { console.error(err); }
        if (typeof t === "string") t = { text: t, at: 0 };
        e = { i, j, v: v || {}, t: t && t.text != null ? { flat: flatOf(t.text), at: Math.round(+t.at || 0) } : null };
        cache.set(key, e);
        if (cache.size > 4096) cache.delete(cache.keys().next().value);
      }
      return e;
    }
    function resolveFrame(e) {
      const v = e.v, has = (k) => v[k] != null && v[k] !== "";
      const num = (k, d) => { const x = has(k) ? +v[k] : NaN; return Number.isFinite(x) ? x : d; };
      let level = has("level") ? num("level", 0) : has("cell") ? Math.log2(Math.max(1e-6, num("cell", cssCell)) / Math.max(1e-6, cssCell)) : (+o.level || 0);
      level = Math.max(0, Math.min(2, Math.round(level) || 0));
      return {
        ev: num("exposure", o.exposure) + num("ev", +o.ev || 0), contrast: num("contrast", o.contrast), gamma: num("gamma", o.gamma),
        detail: num("detail", o.detail), glow: num("glow", o.glow) * num("gain", o.gain != null ? +o.gain : 1),
        thresh: num("thresh", o.thresh), under: num("under", o.under), jitter: num("jitter", +o.jitter || 0),
        style: has("style") && typeof v.style === "number" ? Math.max(0, Math.min(4, v.style | 0)) : STYLES[has("style") ? v.style : o.style] || 0,
        si: setIndex(v.set), invert: has("invert") ? !!v.invert : !!o.invert,
        mode: has("mode") && typeof v.mode === "number" ? v.mode & 3 : MODES[has("mode") ? v.mode : o.mode] || 0, level, seed: Math.round(num("seed", +o.seed || 0)), text: e.t,
      };
    }
    function regionOf(r) {
      let g = val(o.region);
      if (typeof g === "number") g = { w: g, h: g };
      if (!g) g = regDefault || (regDefault = { w: r.width, h: r.height });
      return { w: Math.max(1, +g.w || 1), h: Math.max(1, +(g.h != null ? g.h : g.w) || 1) };
    }

    // ---- the atlas: every set in use and the letters, a band of rows a level ------------------------------------
    let atlasLevels = [true, false, false], slotCount = 1, setSlots = [];
    function needAtlas() { return o.style === "ascii" || o.style === "text" || fieldOn || mapsOn || !!o.sets || textUsed; }
    function atlas() {
      const useSets = o.style === "ascii" || fieldOn || (mapsOn & 8) || !!o.sets;
      const useText = o.style === "text" || textUsed || (mapsOn & 16);
      for (let k = 1; k < 3; k++) if (LV[k].on) atlasLevels[k] = true;
      const key = [o.style, useSets ? setList.join("\u0001") : "", useText ? letterArr.length : -1, sortedVer, ratio, cwD, chD, atlasLevels.join()].join("|");
      if (key === atlasKey) return false;
      atlasKey = key;
      const rowsL = [];
      if (useSets) setList.forEach((chars, i) => { const so = sortedOf(chars); rowsL.push({ kind: "set", i, chars: [...so.s].slice(0, 64), ratio: so.ratio, base: i === 0 && o.style === "ascii" }); });
      if (useText) {
        const lk = letterArr.join("");
        if (lk !== lettersRatioKey) { lettersRatioKey = lk; lettersRatio = widthRatio(lk); }
        rowsL.push({ kind: "text", chars: letterArr.slice(), ratio: lettersRatio, base: o.style === "text" });
      }
      rowsL.sort((a, b) => b.base - a.base);
      let slot = 0; for (const r of rowsL) { r.slot = slot; slot += r.chars.length; }
      slotCount = Math.max(1, Math.min(4095, slot));
      setSlots = setList.map((_, i) => { const r = rowsL.find((x) => x.kind === "set" && x.i === i); return r ? [r.slot, r.chars.length] : [0, 1]; });
      const tr = rowsL.find((x) => x.kind === "text"); textSlot = tr ? tr.slot : 0;
      if (!rowsL.length) { ver++; return true; }
      // the bands: level 0 as before (one row of glyphs, each drawn at the cell's height, clipped to it), the coarser
      // levels' glyphs drawn at their own size where the atlas has room, else read from level 0's, magnified
      const maxW = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE)), maxH = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      let aw = 1, ah = 0;
      for (let k = 0; k < 3; k++) {
        GA[k].own = 0; GA[k].perRow = GA[0].perRow; GA[k].y = GA[0].y;
        if (!atlasLevels[k]) continue;
        const cw = cwD << k, ch = chD << k, pr = Math.max(1, Math.min(slotCount, Math.floor(maxW / cw))), bh = Math.ceil(slotCount / pr) * ch;
        if (k > 0 && ah + bh > maxH) continue;
        GA[k].own = 1; GA[k].perRow = pr; GA[k].y = ah; ah += bh; aw = Math.max(aw, pr * cw);
      }
      const a = document.createElement("canvas"); a.width = Math.max(1, aw); a.height = Math.max(1, ah);
      const g = a.getContext("2d", { willReadFrequently: true });
      g.fillStyle = "#000"; g.fillRect(0, 0, a.width, a.height);
      g.textBaseline = "top"; g.fillStyle = "#fff";
      const ink = new Float32Array(slotCount * 3);
      for (let k = 0; k < 3; k++) {
        if (!GA[k].own) continue;
        const cw = cwD << k, ch = chD << k, pr = GA[k].perRow;
        for (const r of rowsL) for (let i = 0; i < r.chars.length; i++) {
          const s = r.slot + i; if (s >= slotCount) break;
          const x = (s % pr) * cw, y = GA[k].y + Math.floor(s / pr) * ch;
          g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip();
          if (r.base) { g.font = `${ch}px ${FONT}`; g.fillText(r.chars[i], x, y); }
          else {
            const fs = ch * Math.min(1, ratio / r.ratio);
            g.font = `${fs}px ${FONT}`; g.fillText(r.chars[i], x + (cw - r.ratio * fs) / 2, y + (ch - fs) / 2);
          }
          g.restore();
        }
      }
      const data = g.getImageData(0, 0, a.width, a.height).data;
      for (let k = 0; k < 3; k++) {
        const src = GA[k].own ? k : 0, cw = cwD << src, ch = chD << src, pr = GA[src].perRow;
        for (let s = 0; s < slotCount; s++) {
          if (k !== src) { ink[k * slotCount + s] = ink[s]; continue; }
          const x0 = (s % pr) * cw, y0 = GA[src].y + Math.floor(s / pr) * ch; let sum = 0;
          for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) sum += data[((y0 + y) * a.width + x0 + x) * 4];
          ink[k * slotCount + s] = sum / (255 * cw * ch);
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, tA);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a);
      fill(tInk, gl.R32F, gl.RED, gl.FLOAT, ink, slotCount, 3);
      ver++; heldClear();
      return true;
    }
    let textSlot = 0;

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
      W = w; H = h; dprR = W / Math.max(1, r.width);
      fieldOn = !!o.field || typeof o.text === "function";
      mapsOn = 0;
      if (o.maps) MAPS.forEach((m, i) => { if (o.maps[m]) mapsOn |= 1 << i; });
      perCell = fieldOn || mapsOn !== 0;
      setsOf();
      if (o.text !== textSrc || o.letters !== lettersSrc) resetText();
      // the cell's aspect: the base set's, or the letters', or square, as before; with more sets, the widest of them
      const style = o.style;
      if (style === "ascii") {
        if (set !== o.__sorted) { const so = sortedOf(o.set); set = so.s; o.__sorted = set; ratio = so.ratio; }
      } else if (style === "text") {
        if (o.text !== o.__text) {
          o.__text = o.text;
          set = letterArr.length > 1 || typeof o.text === "string" ? letterArr.join("") : " " + SETS.ascii;
          ratio = widthRatio(set);
        }
      } else { ratio = 1; }
      if (o.sets && o.__widest !== ratio + "|" + setList.join("\u0001")) {
        let wd = ratio; for (const c of setList) wd = Math.max(wd, sortedOf(c).ratio);
        o.__widest = ratio + "|" + setList.join("\u0001"); o.__ratio = wd;
      }
      const aspect = o.sets ? o.__ratio : ratio;
      cssCell = typeof o.cell === "function" ? o.cell(r.width, r.height) : o.cell;
      cwD = Math.max(2, Math.round(cssCell * dpr));
      chD = Math.max(2, Math.round(cwD / aspect));
      // where the overlay lies on the plane: the cells begin offX, offY device px before its top-left
      const og = val(o.origin);
      ox = og ? (og.x != null ? +og.x : -(+og.dx || 0)) : 0; oy = og ? (og.y != null ? +og.y : -(+og.dy || 0)) : 0;
      if (!Number.isFinite(ox)) ox = 0;
      if (!Number.isFinite(oy)) oy = 0;
      const Ox = ox * dprR, Oy = oy * dprR;
      P0x = Math.floor(Ox / cwD); P0y = Math.floor(Oy / chD); offX = Ox - P0x * cwD; offY = Oy - P0y * chD;
      cols = Math.ceil((W + offX) / cwD); rows = Math.ceil((H + offY) / chD);
      // the field's frames in view (and a little round it), each asked for once
      LV[1].on = LV[2].on = false;
      if (!fieldOn) LV[Math.max(0, Math.min(2, Math.round(+o.level || 0)))].on = true;
      if (mapsOn & 8) LV[1].on = LV[2].on = true;
      if (fieldOn) {
        reg = regionOf(r);
        const big = 4 * cwD / dprR + 1, bigY = 4 * chD / dprR + 1;
        const i0 = Math.floor((ox - big) / reg.w - 0.5), i1 = Math.floor((ox + r.width + big) / reg.w - 0.5) + 1;
        const j0 = Math.floor((oy - bigY) / reg.h - 0.5), j1 = Math.floor((oy + r.height + bigY) / reg.h - 0.5) + 1;
        const nx = Math.max(1, Math.min(MAXFRAMES, i1 - i0 + 1)), ny = Math.max(1, Math.min(MAXFRAMES, j1 - j0 + 1));
        const key = [i0, j0, nx, ny, reg.w, reg.h, ver, cssCell].join();
        if (key !== winKey) {
          winKey = key; win = { i: i0, j: j0, nx, ny };
          frames = []; winGlow = 0; softAll = true; textUsed = o.style === "text"; fdata = null;
          for (let fj = 0; fj < ny; fj++) for (let fi = 0; fi < nx; fi++) {
            const fr = resolveFrame(frameAt(i0 + fi, j0 + fj));
            frames.push(fr);
            winGlow = Math.max(winGlow, fr.glow); if (fr.style !== 2) softAll = false;
            if (fr.style === 4) { textUsed = true; if (fr.text) registerText(fr.text.flat); }
          }
        }
        for (const fr of frames) LV[fr.level].on = true;
      } else textUsed = o.style === "text" || !!(mapsOn & 16);
      // the halo's scale, the same for every frame and every place (so a halo rides with its glyph): glow 1.5 (glow 1
      // and a pulse's 1.45), or the most any frame has asked for
      if (perCell) {
        const most = Math.max(fieldOn ? winGlow : 0, mapsOn & 2 ? 1.5 : 0, fieldOn ? 0 : o.glow * (o.gain != null ? +o.gain : 1));
        grefMax = Math.max(grefMax, most);
        glowAny = most > 0; gref = grefMax;
      }
      // the levels' blocks, pinned to the plane, and their bands of rows
      let band = 0;
      for (const L of LV) {
        L.B0x = Math.floor(P0x / L.n); L.B0y = Math.floor(P0y / L.n);
        L.cols = Math.floor((P0x + cols - 1) / L.n) - L.B0x + 1; L.rows = Math.floor((P0y + rows - 1) / L.n) - L.B0y + 1;
        L.rowW = Math.ceil(W / (cwD * L.n));
        L.band = band; if (L.on) band += L.rows;
      }
      stackH = band;
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
      if (needAtlas() && atlas()) fdata = null;
      if (txDirty && txData.length) {
        txDirty = false;
        const th = Math.max(1, Math.ceil(txData.length / TXW)), d = new Uint32Array(TXW * th); d.set(txData);
        fill(tTX, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, d, TXW, th);
      }
      if (fieldOn && !fdata) packField();
      return r;
    }

    // the frames in view, five texels each: tone; light; marks; mode, level, seed; text
    function packField() {
      const { nx, ny } = win, d = new Float32Array(nx * FW * ny * 4);
      frames.forEach((fr, n) => {
        const ss = setSlots[fr.si] || setSlots[0] || [0, 1];
        let tx = [0, 0, 0, -1];
        if (fr.text) { const e = texts.get(fr.text.flat) || registerText(fr.text.flat); tx = [e.start, e.len, fr.text.at, 1]; }
        else if (typeof o.text === "string") tx = [baseText.start, baseText.len, 0, 0];
        d.set([fr.ev, fr.contrast, fr.gamma, fr.detail, fr.glow, fr.thresh, fr.under, fr.jitter,
          fr.style, ss[0], ss[1], fr.invert ? 1 : 0, fr.mode, fr.level, fr.seed, 0, ...tx], n * FW * 4);
      });
      fdata = d;
      fill(tF, gl.RGBA32F, gl.RGBA, gl.FLOAT, d, nx * FW, ny);
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

    // the sources drawn small, a texel a cell of the plane (shifted by where the plane's cells begin)
    function read(hr) {
      const [br, bgG, bb] = o.bg;
      sx.globalAlpha = 1; sx.globalCompositeOperation = "source-over";
      sx.fillStyle = `rgb(${br * 255},${bgG * 255},${bb * 255})`; sx.fillRect(0, 0, cols, rows);
      sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = "high";
      const dpr = W / Math.max(1, hr.width), kx = dpr / cwD, ky = dpr / chD, dx = offX / cwD, dy = offY / chD;   // cells a CSS px
      for (const src of o.sources() || []) {
        if (!src || !src.width || !src.height) continue;
        const v = seen(src);
        if (!v) continue;
        const r = boxOf(src);
        if (r.width < 1 || r.height < 1 || r.left + r.width < hr.left || r.top + r.height < hr.top || r.left > hr.left + hr.width || r.top > hr.top + hr.height) continue;
        sx.globalAlpha = v.a; sx.globalCompositeOperation = v.blend;
        try { sx.drawImage(src, (r.left - hr.left) * kx + dx, (r.top - hr.top) * ky + dy, r.width * kx, r.height * ky); } catch (e) { /* a canvas not ready yet */ }
      }
      sx.globalAlpha = 1; sx.globalCompositeOperation = "source-over";
    }

    // auto levels for a moving picture: the 1st and 99th percentiles of its lightness, eased; held while still()
    function levels(now) {
      const mode = o.levels || (fieldOn ? "frozen" : "screen");
      if (!o.auto || mode === "frozen") { lo = 0; hi = 1; return; }
      if (o.still && o.still()) return;
      if (now - lastProbe < 500) return;
      lastProbe = now;
      // (pinned to a plane, the first and last rows and columns of cells are partly the background, past the picture:
      // left out, or they hold the levels down)
      const m = offX > 0 || offY > 0 ? 1 : 0;
      px.drawImage(sample, m, m, Math.max(1, cols - 2 * m), Math.max(1, rows - 2 * m), 0, 0, 48, 48);
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

    // ---- the page's maps ---------------------------------------------------------------------------------------
    let mapsDirty = true, mapsRead = null;
    const mapSize = MAPS.map(() => [1, 1]);
    function uploadMaps() {
      mapsDirty = false; mapsRead = null;
      MAPS.forEach((m, i) => {
        const src = o.maps && o.maps[m];
        if (!src) return;
        gl.bindTexture(gl.TEXTURE_2D, tM[i]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        try {
          if (src.data && !(src instanceof ImageData)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(src.data.buffer || src.data));
          else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
          mapSize[i] = [Math.max(1, src.width), Math.max(1, src.height)];
        } catch (e) { /* not ready */ }
      });
    }
    function mapRect() {
      const m = o.maps, rr = val(m.rect), first = MAPS.findIndex((k) => m[k]);
      const z = mapSize[Math.max(0, first)], cw = cwD / dprR, ch = chD / dprR;
      const r = rr || { x: 0, y: 0, w: z[0] * cw, h: z[1] * ch };
      const plane = (m.space || "plane") === "plane";
      return [r.x - (plane ? ox : 0), r.y - (plane ? oy : 0), Math.max(1e-6, r.w), Math.max(1e-6, r.h)];
    }

    // ---- the flash guard (WCAG 2.3.1) ----------------------------------------------------------------------------
    let guardOn = false, guardFb = null, guardTex = null, pbo = [], heldNow = 0, guardEvents = 0, holding = false, gb = { x: 0, y: 0, w: 0, h: 0 };
    const tracks = new Map();
    function heldClear() { tracks.clear(); holding = false; heldNow = 0; }
    function guardPass(now) {
      if (!P.luma) P.luma = compile(gl, VS, FS_LUMA);
      const bx0 = Math.floor(P0x / 8), by0 = Math.floor(P0y / 8), bw = Math.floor((P0x + cols - 1) / 8) - bx0 + 1, bh = Math.floor((P0y + rows - 1) / 8) - by0 + 1;
      if (!guardFb) { guardFb = gl.createFramebuffer(); guardTex = texture(gl, gl.NEAREST); }
      if (guardTex.w !== bw || guardTex.h !== bh) {
        guardTex.w = bw; guardTex.h = bh;
        gl.bindTexture(gl.TEXTURE_2D, guardTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, guardFb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, guardTex, 0);
      }
      const pr = P.luma; gl.bindFramebuffer(gl.FRAMEBUFFER, guardFb); gl.viewport(0, 0, bw, bh); gl.useProgram(pr.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fb[0].t); gl.uniform1i(pr.u.G, 0);
      // the blocks are pinned to the plane: block q's first cell is (bx0 + q) * 8 - P0, in the overlay's cells
      gl.uniform2i(pr.u.grid, cols, rows); gl.uniform2i(pr.u.first, bx0, by0); gl.uniform2i(pr.u.P0, P0x, P0y);
      gl.uniform1f(pr.u.glowAmt, glowU);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // read back without waiting: a buffer and a fence, looked at on later frames
      const buf = { b: gl.createBuffer(), n: bw * bh * 4, bw, bh, bx0, by0, t: now };
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf.b); gl.bufferData(gl.PIXEL_PACK_BUFFER, buf.n, gl.STREAM_READ);
      gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      buf.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
      pbo.push(buf);
      while (pbo.length) {
        const q = pbo[0];
        if (gl.getSyncParameter(q.sync, gl.SYNC_STATUS) !== gl.SIGNALED) {
          if (pbo.length <= 4) break;
          pbo.shift(); gl.deleteSync(q.sync); gl.deleteBuffer(q.b); continue;   // too far behind: let it go unread
        }
        pbo.shift();
        const data = new Uint8Array(q.n);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, q.b); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.deleteSync(q.sync); gl.deleteBuffer(q.b);
        track(q, data);
      }
      // the blocks held now, as a mask over this frame's blocks
      heldNow = 0;
      const mask = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const t = tracks.get((bx0 + x) + "," + (by0 + y));
        if (t && t.until > now) { mask[y * bw + x] = 255; heldNow++; }
      }
      holding = heldNow > 0;
      gb = { x: bx0, y: by0, w: bw, h: bh };
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      fill(tHM, gl.R8, gl.RED, gl.UNSIGNED_BYTE, mask, bw, bh);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    }
    function track(q, data) {
      const now = q.t;
      for (let y = 0; y < q.bh; y++) for (let x = 0; x < q.bw; x++) {
        const key = (q.bx0 + x) + "," + (q.by0 + y), L = Math.pow(data[(y * q.bw + x) * 4] / 255, 2.2);
        let t = tracks.get(key);
        if (!t) { tracks.set(key, { ext: L, dir: 0, swings: [], until: 0, seen: now }); continue; }
        t.seen = now;
        if (t.until > now) continue;                        // held: what it shows is not what is under it
        const up = L - t.ext;
        if (t.dir >= 0 && up > 0) t.ext = L;
        else if (t.dir <= 0 && up < 0) t.ext = L;
        if (Math.abs(up) >= 0.1 && Math.min(L, t.ext) < 0.8 && Math.sign(up) !== t.dir) {
          if (t.dir !== 0) t.swings.push(now);
          t.dir = Math.sign(up); t.ext = L;
        }
        t.swings = t.swings.filter((s) => now - s < 1000);
        if (t.swings.length > 2) { t.until = now + 1000; t.swings = []; t.dir = 0; guardEvents++; }
      }
      if (tracks.size > 20000) for (const [k, t] of tracks) if (now - t.seen > 2000) tracks.delete(k);
    }

    // ---- the passes ------------------------------------------------------------------------------------------------
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
    const levelU = (u) => {
      const la = new Int32Array(12), lo4 = new Int32Array(12);
      LV.forEach((L, k) => { la.set([L.cols, L.rows, L.on ? L.band : 1 << 30, L.on ? 1 : 0], k * 4); lo4.set([L.B0x, L.B0y, L.rowW, 0], k * 4); });
      gl.uniform4iv(u.LA, la); gl.uniform4iv(u.LO, lo4); gl.uniform2i(u.P0, P0x, P0y);
    };
    function stateFor(i) {
      const s = states[i] || (states[i] = makeState());
      if (s.w !== cols || s.h !== stackH) {
        s.w = cols; s.h = stackH;
        gl.bindFramebuffer(gl.FRAMEBUFFER, s.f);
        s.t.forEach((t, n) => {
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, cols, stackH, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, null);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + n, gl.TEXTURE_2D, t, 0);
        });
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
      }
      return s;
    }
    let glowU = 0, glowAny = false;
    function cellPass() {
      const st = stateFor(cur), pv = guardOn && states[1 - cur] && states[1 - cur].w ? states[1 - cur] : null;
      const pr = P.cell, u = pr.u;
      pass(pr, st, cols, stackH);
      const bindT = (unit, t, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); if (u[name]) gl.uniform1i(u[name], unit); };
      bindT(0, tS, "S"); bindT(1, tInk, "INK"); bindT(2, tF, "F"); bindT(3, tTX, "TX");
      tM.forEach((t, i) => bindT(4 + i, t, "M" + i));
      bindT(9, tHM, "HM");
      ["PA", "PB", "PC"].forEach((n, i) => bindT(10 + i, pv ? pv.t[i] : tNil, n));
      levelU(u);
      const pvv = new Int32Array(12);
      PREV.forEach((p, k) => pvv.set([p.B0x, p.B0y, p.cols, p.rows], k * 4));
      gl.uniform4iv(u.PV, pvv); gl.uniform3i(u.PBand, PREV[0].band, PREV[1].band, PREV[2].band);
      gl.uniform1i(u.hold, pv && holding ? 1 : 0);
      gl.uniform4i(u.HG, gb.x, gb.y, gb.w, gb.h);
      gl.uniform2f(u.cellCss, cwD / dprR, chD / dprR); gl.uniform2f(u.offCss, offX / dprR, offY / dprR);
      gl.uniform2f(u.lohi, lo, hi);
      gl.uniform3f(u.tone, Math.pow(2, o.exposure + (+o.ev || 0)), o.contrast, o.gamma);
      gl.uniform1f(u.detail, o.detail);
      gl.uniform1f(u.invert, o.invert ? 1 : 0);
      gl.uniform1f(u.glowAmt, o.glow * (o.gain != null ? +o.gain : 1));
      gl.uniform1f(u.thresh, o.thresh);
      gl.uniform1f(u.under, o.under);
      gl.uniform1f(u.jitter, +o.jitter || 0);
      gl.uniform1f(u.dotArea, 0.72 * 0.72);
      gl.uniform1fv(u.bayer, BAYER);
      gl.uniform1i(u.mode, MODES[o.mode] || 0);
      gl.uniform1i(u.style, STYLES[o.style] || 0);
      gl.uniform1i(u.seed, Math.round(+o.seed || 0));
      const ss = setSlots[0] || [0, 1];
      gl.uniform1i(u.setBase, ss[0]); gl.uniform1i(u.setN, ss[1]);
      gl.uniform1i(u.level, fieldOn ? 0 : Math.max(0, Math.min(2, Math.round(+o.level || 0))));
      gl.uniform1i(u.textBase, textSlot); gl.uniform1i(u.textStart, baseText.start); gl.uniform1i(u.textLen, typeof o.text === "string" ? baseText.len : 0);
      gl.uniform1i(u.lettersN, letterArr.length);
      const sb = new Int32Array(16); setSlots.forEach((s, i) => { if (i < 8) sb.set(s, i * 2); });
      gl.uniform2iv(u.SETB, sb);
      gl.uniform1i(u.useField, fieldOn ? 1 : 0);
      gl.uniform1i(u.maps, mapsOn);
      gl.uniform2f(u.region, reg.w, reg.h); gl.uniform2f(u.fwo, win.i * reg.w - ox, win.j * reg.h - oy);
      gl.uniform1f(u.seam, Math.max(0, Math.min(0.5, o.seam != null ? +o.seam : 0.236)));
      gl.uniform1f(u.gref, gref); gl.uniform2i(u.fwin, win.nx, win.ny);
      if (mapsOn) {
        gl.uniform4fv(u.mapRect, mapRect());
        const ms = new Int32Array(10); mapSize.forEach((z, i) => ms.set(z, i * 2)); gl.uniform2iv(u.MS, ms);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return st;
    }

    let lastMs = 0, avgMs = 0, nFrames = 0;
    function frame(now) {
      raf = 0;
      if (dead) return;
      schedule();
      if (document.hidden) return;
      if (!o.active()) { cv.style.display = "none"; return; }
      cv.style.display = "block";
      const t0 = performance.now();
      const hr = layout();
      read(hr);
      levels(now || performance.now());
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tS);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sample);
      if (mapsOn && mapsDirty) uploadMaps();
      guardOn = !!o.guard;
      glowU = perCell ? (glowAny ? gref : 0) : o.glow * (o.gain != null ? +o.gain : 1);

      const st = cellPass();
      // the halo: each cell's glow source, blurred twice, on the finest grid
      const soft = (perCell ? (fieldOn && softAll && !mapsOn) : o.style === "grain") ? 1.6 : 1;
      if (glowU > 0 || guardOn) {
        const pr = pass(P.glow, fb[0], cols, rows);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.t[1]); gl.uniform1i(pr.u.SB, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, st.t[2]); gl.uniform1i(pr.u.SC, 1);
        levelU(pr.u);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.activeTexture(gl.TEXTURE0);
      }
      if (glowU > 0) {
        blur(fb[0], fb[1], fb[2], 1.6 * soft);
        blur(fb[0], fb[1], fb[3], 5 * soft);
      } else {
        for (const i of [2, 3]) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb[i].f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      }
      if (guardOn) guardPass(now || performance.now());

      const d = P.draw;
      pass(d, null, W, H);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.t[0]); gl.uniform1i(d.u.SA, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, st.t[1]); gl.uniform1i(d.u.SB, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tA); gl.uniform1i(d.u.A, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, fb[2].t); gl.uniform1i(d.u.G1, 3);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, fb[3].t); gl.uniform1i(d.u.G2, 4);
      levelU(d.u);
      const ga = new Int32Array(12); GA.forEach((g, k) => ga.set([g.perRow, g.y, g.own, 0], k * 4)); gl.uniform4iv(d.u.GA, ga);
      gl.uniform2f(d.u.cellPx, cwD, chD);
      gl.uniform2f(d.u.view, W, H);
      gl.uniform2f(d.u.off, offX, offY);
      gl.uniform1f(d.u.glowAmt, glowU);
      gl.uniform1f(d.u.under, o.under);
      gl.uniform1i(d.u.perCell, perCell ? 1 : 0);
      gl.uniform3f(d.u.bg, o.bg[0], o.bg[1], o.bg[2]);
      const dpr = W / Math.max(1, hr.width), ks = (o.keep() || []).slice(0, 8), kv = new Float32Array(32);
      ks.forEach((k, i) => { kv[i * 4] = k.x * dpr; kv[i * 4 + 1] = k.y * dpr; kv[i * 4 + 2] = k.r * dpr; });
      gl.uniform4fv(d.u.keep, kv); gl.uniform1i(d.u.keeps, ks.length);
      gl.activeTexture(gl.TEXTURE0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (guardOn) { LV.forEach((L, k) => Object.assign(PREV[k], L.on ? { B0x: L.B0x, B0y: L.B0y, cols: L.cols, rows: L.rows, band: L.band } : { cols: 0, rows: 0 })); cur = 1 - cur; }
      lastMs = performance.now() - t0; avgMs = nFrames ? avgMs * 0.9 + lastMs * 0.1 : lastMs; nFrames++;
    }

    function schedule() { if (!raf && !dead) raf = requestAnimationFrame(frame); }

    // the glyphs' font may arrive after the first frame: sort and draw them again once it has
    if (document.fonts && !fontsTried) {
      fontsTried = true;
      const chars = o.style === "text" ? (typeof o.text === "string" ? o.text.slice(0, 2000) : "") : o.set;
      if (JP.test(chars)) fontsFor(chars, invalidate);
      else document.fonts.load(`40px ${FONT}`, chars).catch(() => {}).then(invalidate);
      fontsAsked.add(chars);
    }
    schedule();

    // ---- for checks: the settings in force under a point, and how the frames go -----------------------------------
    const mapPixel = (name, u) => {
      const src = o.maps && o.maps[name];
      if (!src) return null;
      if (!mapsRead) mapsRead = {};
      if (!(name in mapsRead)) {
        let data = null;
        try {
          if (src.data) data = src.data;
          else if (src.getContext) { const c = src.getContext("2d"); data = c ? c.getImageData(0, 0, src.width, src.height).data : null; }
        } catch (e) { data = null; }
        mapsRead[name] = data;
      }
      const d = mapsRead[name]; if (!d) return null;
      const x = Math.min(src.width - 1, Math.floor(u[0] * src.width)), y = Math.min(src.height - 1, Math.floor(u[1] * src.height)), i = (y * src.width + x) * 4;
      return [d[i], d[i + 1], d[i + 2]];
    };
    const r2js = (bx, by, k) => {
      const ux = (bx + Math.imul(k, 0x6a09e667)) >>> 0, uy = (by + Math.imul(k, 0xbb67ae85 | 0)) >>> 0;
      const h = (0x80000000 + Math.imul(ux, 3242174889 | 0) + Math.imul(uy, 2447445414 | 0)) >>> 0;
      return (h >>> 8) / 16777216;
    };
    function settingsAt(k, Bx, By) {
      const n = 1 << k, cwC = cwD / dprR, chC = chD / dprR;
      const rel = [((Bx * n - P0x) + 0.5 * n) * cwC - offX / dprR, ((By * n - P0y) + 0.5 * n) * chC - offY / dprR];
      const s = { exposure: o.exposure + (+o.ev || 0), contrast: o.contrast, gamma: o.gamma, detail: o.detail, glow: o.glow * (o.gain != null ? +o.gain : 1),
        thresh: o.thresh, under: o.under, jitter: +o.jitter || 0, seed: Math.round(+o.seed || 0), style: o.style, set: 0, mode: o.mode,
        invert: !!o.invert, present: k === 0 || k === (+o.level || 0), frame: null, weights: null, text: null };
      if (fieldOn && frames.length) {
        const q = [(rel[0] - (win.i * reg.w - ox)) / reg.w - 0.5, (rel[1] - (win.j * reg.h - oy)) / reg.h - 0.5];
        const f0 = q.map(Math.floor), t = [q[0] - f0[0], q[1] - f0[1]], sm = Math.max(0, Math.min(0.5, o.seam != null ? +o.seam : 0.236));
        const ss = (x) => (sm > 0 ? (() => { const e = Math.max(0, Math.min(1, (x - (0.5 - sm)) / (2 * sm))); return e * e * (3 - 2 * e); })() : (x >= 0.5 ? 1 : 0));
        const sx_ = ss(t[0]), sy_ = ss(t[1]), w = [(1 - sx_) * (1 - sy_), sx_ * (1 - sy_), (1 - sx_) * sy_, sx_ * sy_];
        const fr = [0, 1, 2, 3].map((i) => {
          const fx = Math.max(0, Math.min(win.nx - 1, f0[0] + (i & 1))), fy = Math.max(0, Math.min(win.ny - 1, f0[1] + (i >> 1)));
          return frames[fy * win.nx + fx];
        });
        const blend = (key) => fr.reduce((a, f, i) => a + w[i] * f[key], 0);
        s.exposure = blend("ev"); s.contrast = blend("contrast"); s.gamma = blend("gamma"); s.detail = blend("detail");
        s.glow = blend("glow"); s.thresh = blend("thresh"); s.under = blend("under"); s.jitter = blend("jitter");
        const Wl = [0, 0, 0]; fr.forEach((f, i) => { Wl[f.level] += w[i]; });
        const d = r2js(Bx, By, k), Wle = k === 0 ? Wl[0] : k === 1 ? Wl[0] + Wl[1] : 1;
        s.present = k === 0 || (Wl[k] > 0 && d * Wle < Wl[k]);
        const dd = k > 0 && s.present ? Math.min(0.999999, d * Wle / Wl[k]) : d;
        let pick = 0, last = -1, acc = 0, found = false;
        for (let i = 0; i < 4; i++) {
          if (w[i] <= 0 || (Wl[k] > 0 && fr[i].level !== k)) continue;
          acc += Wl[k] > 0 ? w[i] / Wl[k] : w[i]; last = i;
          if (!found && dd < acc) { pick = i; found = true; }
        }
        if (!found) pick = Math.max(last, 0);
        const p = fr[pick];
        s.style = STYLE_NAMES[p.style] || "ascii"; s.set = p.si; s.invert = p.invert; s.seed = p.seed;
        s.modes = fr.map((f, i) => [MODE_NAMES[f.mode], +w[i].toFixed(4)]).filter((m) => m[1] > 0);
        s.mode = s.modes.reduce((a, m) => (m[1] > a[1] ? m : a), ["full", -1])[0];
        s.frame = { i: win.i + Math.max(0, Math.min(win.nx - 1, f0[0] + (pick & 1))), j: win.j + Math.max(0, Math.min(win.ny - 1, f0[1] + (pick >> 1))) };
        s.weights = w.map((x) => +x.toFixed(4)); s.text = p.text ? { at: p.text.at, line: p.text.flat.slice(0, 80) } : null;
      }
      if (mapsOn) {
        const mr = mapRect(), u = [(rel[0] - mr[0]) / mr[2], (rel[1] - mr[1]) / mr[3]];
        if (u[0] >= 0 && u[1] >= 0 && u[0] < 1 && u[1] < 1) for (const m of MAPS) {
          const pxl = mapPixel(m, u); if (!pxl) continue;
          const dv = decode(m, pxl);
          if (m === "marks") { s.style = STYLE_NAMES[dv.style]; s.set = dv.set; s.invert = dv.invert; s.mode = MODE_NAMES[dv.mode]; s.present = k === 0 || dv.level === k; }
          else Object.assign(s, dv);
        }
      }
      s.setGlyphs = setList[s.set] || setList[0];
      return s;
    }

    const api = {
      canvas: cv,
      set(p) {
        Object.assign(o, p);
        if ("set" in p) { o.__sorted = null; atlasKey = ""; }
        if ("style" in p || "text" in p) { atlasKey = ""; o.__text = null; o.__sorted = null; }
        if ("field" in p || "text" in p || "region" in p || "cell" in p) { cache.clear(); regDefault = null; }
        if ("maps" in p) mapsDirty = true;
        ver++; schedule();
      },
      get options() { return Object.assign({}, o); },
      frame() { if (raf) cancelAnimationFrame(raf); raf = 0; frame(performance.now()); },
      destroy() { dead = true; if (raf) cancelAnimationFrame(raf); cv.remove(); const x = gl.isContextLost() ? null : gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); },
      touch() { mapsDirty = true; mapsRead = null; schedule(); },
      at(x, y) {
        if (!W) return null;
        const X = x * dprR + offX, Y = y * dprR + offY, Px = P0x + Math.floor(X / cwD), Py = P0y + Math.floor(Y / chD);
        for (let k = 2; k >= 0; k--) {
          if (!LV[k].on) continue;
          const n = 1 << k, Bx = Math.floor(Px / n), By = Math.floor(Py / n), s = settingsAt(k, Bx, By);
          if (k === 0 || s.present) return Object.assign(s, { level: k, block: { x: Bx, y: By }, plane: { x: ox + x, y: oy + y } });
        }
        return null;
      },
      stats() {
        return { ms: +lastMs.toFixed(3), avg: +avgMs.toFixed(3), frames: nFrames, fieldCalls, cached: cache.size,
          levels: LV.map((L, k) => (L.on ? k : -1)).filter((k) => k >= 0), cells: [cols, rows], sets: setList.length, letters: letterArr.length,
          slots: slotCount, guard: guardOn, guarded: heldNow, guardEvents };
      },
    };
    // a lost context (a GPU reset, a phone's tab put away) kept restorable, and the overlay made again once it is back
    cv.addEventListener("webglcontextlost", (e) => e.preventDefault());
    cv.addEventListener("webglcontextrestored", () => {
      if (dead) return;
      api.destroy();
      const g = create(Object.assign({}, o, { __sorted: null, __text: null, __widest: null }));
      if (g) Object.defineProperties(api, Object.getOwnPropertyDescriptors(g));
    });
    return api;
  }

  window.GlyphLight = { create, preserve, SETS, motions, ease, encode };
  // Loaded before the pieces make their WebGL contexts, so each keeps its drawing buffer and can be read after it is shown.
  if (window.GLYPHLIGHT_PRESERVE !== false) preserve();
})();

/* The walk — inside a museum, from its door, as far as it is known.

   The artist, 27 Sep 2026: to be able to "walk the building", as on the
   page he sent, "with every museum on the website". Spread two fingers on a
   museum's building and its roof comes off in the same true isometric: what
   is left is the plan of the floor you go in on, its rooms as the museum's
   own data or a published plan give them, and the saved works as tiles of
   their colours on the walls their records put them on. Spread again and
   you stand at the door at eye height, and walk: in pixel art made of the
   same DIRT and the same materials as the building, to the works at their
   real sizes, which are read on the reading's slow clock, and whose threads
   are doors on to the next work. Only what a source gives is drawn. What is
   not known is earth, and a museum nobody has researched yet is its model's
   outer walls round bare earth, with no work hung in it.

   Four levels under the globe: the building (land.js), the plan, the walk
   and the look. Each is one gesture from the next through land.js's own
   handlers, which call Walk.down and Walk.up; the address never changes.

   The plan is compiled by walk-plan.js (the same code the checker runs);
   this file draws and moves. The walk is a column-slab raycaster over the
   plan's grid: for each column of dots a ray goes out front to back,
   drawing each cell's floor and ceiling, a riser where the next floor is
   higher, a lintel where the next ceiling is lower, and the wall it ends
   at; every surface its material worn over the place's soil, in the
   models' light, in four stepped brightnesses chosen by a Bayer matrix, and
   going out to the dark with distance. The works are flat on their walls
   at their real sizes, their three colours until their pictures come.
   Frames are held at 24 a second, the pixel light's rate, and none is drawn
   at rest.

   Everything land.js lends it comes in ctx.land (the pixel light, the
   repertoire, the reading's clock, the histories); Walk.snapshot draws one
   frame with none of that, for the checker (scripts/check_interior.js). */

(function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var TAU = Math.PI * 2;

  // The walker: an eye 1.6 m over the floor, half a metre across, a step of
  // 0.35 m at most, 2 m of headroom at least.
  var EYE = 1.6, RADIUS = 0.25, STEP = 0.35, HEAD = 2.0;
  var PACE = 1.4, BRISK = 2.8;                  // m/s: a walk, and brisk
  var TURN = 2.6;                               // rad/s, turning ahead on a glide
  var KEY_TURN = 100 * Math.PI / 180;           // rad/s, by the keys
  var FOV = 66 * Math.PI / 180;                 // across, with the horizon mid-frame
  var DOT_MAX = 6, FPS = 24;
  var FOG_NEAR = 10, FOG_FAR = 44;              // m: dots go out to the dark between
  var NAME_NEAR = 8, DOOR_NEAR = 12;            // m: works' titles; rooms' names at their doorways
  var PICTURE_NEAR = 25, PICTURE_FADE = 13;     // m: pictures drawn within; fading past
  var PICTURE_TALL = 128, KEEP = 24, FLIGHT = 4;// a picture's offscreen copy; how many kept; loading at once
  var CENTRE = 1.45;                            // m: where a work's centre hangs
  var LOOK_NEAR = 4, FACE = 20 * Math.PI / 180; // before a work: within 4 m, facing it within 20°
  var NEAR_LABEL = 2.5;                         // m: a work this near is named with its artist and year
  var CUT = 3.0;                                // m over the floor: where the roof comes off
  var PLAN_DOTS = 40000, PLAN_PIX = 2, PLAN_FPS = 12, PLAN_FIT = 0.92;
  var GLIDE_MIN = 1.4, GLIDE_SPAN = Math.pow(PHI, 4);   // m/s; s, the longest a glide takes
  var STRIDE = 0.7;                             // m: a tick of the step's sound
  var TAP_MS = 250, TAP_PX = 6;
  var WEDGE = 0.012;                            // rad a pixel, turning the plan
  var FLOOR_DRAG = 34;                          // px: a vertical drag on the plan that changes floor
  var STILL_WAIT = 380;                         // ms still before the reading counts you as standing
  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";

  // The ways a picture may come that never read its pixels (Artsy's are
  // not the site's to read): none of their frames calls getImageData.
  var LOOK_ARRIVALS = ["tiles", "mosaic", "cells", "bands", "blocks", "dither", "interlace", "lift"];
  // And the ones for the descent, which need no picture at all.
  var DESCENT_ARRIVALS = ["tiles", "cells", "bands", "blocks", "dither"];

  var WALL_WORDS = { n: "north wall", e: "east wall", s: "south wall", w: "west wall", centre: "the middle of the room" };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function P() { return window.WalkPlan; }
  function M() { return window.Models; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function angleTo(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function isoNearest(h) { return Math.round((h - TAU / 8) / (TAU / 4)) * (TAU / 4) + TAU / 8; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function rgbOf(css, fallback) {
    var m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css || "");
    return m ? [+m[1], +m[2], +m[3]] : fallback;
  }
  function hexRgb(h) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || "");
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function cssOf(c) { return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")"; }
  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? (+m[3]) + " " + MONTHS[+m[2] - 1] + " " + m[1] : "";
  }
  function num(v) { return String(Math.round(v * 10) / 10); }
  // A date as the label says it: "c. 1945" for a "circa", else the record's own.
  function yearWords(y) { return String(y || "").replace(/^\s*(circa|ca\.?)\s*/i, "c. ").trim(); }
  function hash(i, j) {
    var h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ---------------------------------------------------------------- the caster */

  // Four stepped brightnesses, as the pixel light has four, and the 8x8
  // Bayer matrix that chooses between neighbouring steps (land.js's BAYER).
  var STEPS = [0.62, 0.78, 0.92, 1.06];
  var KM = STEPS.map(function (k) { return Math.round(k * 256); });
  var BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
               12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
               3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
               15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  var THR = new Float32Array(64);
  BAYER.forEach(function (b, i) { THR[i] = (b + 0.5) / 64; });
  // A light (0.4 to 1.4) to its step and how far toward the next.
  var LS = new Uint8Array(256), LF = new Float32Array(256);
  (function () {
    for (var i = 0; i < 256; i += 1) {
      var l = 0.4 + i / 256, s = 0;
      while (s < 3 && STEPS[s + 1] <= l) { s += 1; }
      LS[i] = s;
      LF[i] = s < 3 && l > STEPS[s] ? (l - STEPS[s]) / (STEPS[s + 1] - STEPS[s]) : 0;
    }
  }());
  var FOG_K = 1 / (FOG_FAR - FOG_NEAR);

  // What each dot of the frame is, for a tap: kind << 24 | index.
  var GRIT = 40;                                // DIRT's gaps and speckle drawn 2.5 cm each: a dot or so near by
  var PICK_FLOOR = 1, PICK_WALL = 2, PICK_CEIL = 3, PICK_SKY = 4, PICK_WORK = 5;
  var PAT = { grain: 0, flags: 1, "boards-x": 2, "boards-y": 3 };
  var GLASS_SKY = [150, 172, 190], GLASS_DARK = [46, 58, 72];

  function pack(r, g, b) {
    return ((255 << 24) | ((b > 255 ? 255 : b < 0 ? 0 : b) << 16) |
            ((g > 255 ? 255 : g < 0 ? 0 : g) << 8) | (r > 255 ? 255 : r < 0 ? 0 : r)) >>> 0;
  }
  function packRgb(c) { return pack(Math.round(c[0]), Math.round(c[1]), Math.round(c[2])); }

  /* A floor's own extras for the caster, worked out once: each cell's floor
     pattern (flags, boards, the soil's grain), its floor's light (a floor
     under a skylight by day is at its brightest), the model's roof over it
     (walls under the open sky rise to it) and the grain of its walls. */
  function prepFloor(world, fl) {
    if (fl.walk) { return fl.walk; }
    var n = fl.n, gw = fl.gw, vx = world.vox, grain = M().grain;
    var W = P();
    var pat = new Uint8Array(n), litF = new Float32Array(n), roof = new Int16Array(n), grW = new Float32Array(n);
    var day_ = !(world.sky && world.sky.night);
    var c = world.cos, s = world.sin;
    for (var q = 0; q < n; q += 1) {
      var i = q % gw, j = (q - i) / gw;
      var r = fl.room[q], room = r >= 0 ? fl.rooms[r] : null;
      pat[q] = room && !room.pseudo ? (PAT[room.pattern] || 0) : 0;
      var g = grain(fl.i0 + i, fl.j0 + j, 0);
      litF[q] = (fl.ck[q] === W.SKYLIGHT && day_ ? 1.0 : 0.9) * (0.93 + 0.14 * g);
      grW[q] = 0.93 + 0.14 * grain(fl.i0 + i, fl.j0 + j, 7);
      var top = 0;
      if (vx) {
        var gx = fl.x0 + (i + 0.5) * fl.cell, gy = fl.y0 + (j + 0.5) * fl.cell;
        var vi = Math.floor((gx * c - gy * s + vx.site[0] / 2) / vx.v);
        var vj = Math.floor((gx * s + gy * c + vx.site[1] / 2) / vx.v);
        if (vi >= 0 && vj >= 0 && vi < vx.nx && vj < vx.ny) {
          var t = vx.top[vj * vx.nx + vi];
          if (t >= 0) { top = (t + 1) * vx.v; }
        }
      }
      roof[q] = Math.min(32766, Math.round(top * 100));
    }
    // Which way each face of a grid cell looks on the Earth, for its light:
    // west and north 0.94, east and south 0.74, as the models are lit.
    function faceLight(nx, ny) {
      var m = W.toWorld(world, nx, ny);
      return (-m[0] - m[1]) >= 0 ? 0.94 : 0.74;
    }
    // A room's walls of a known make wear it, seen from the room; of no
    // known make, a wall is its own cell's soil, not the floor's before it.
    var known = new Uint8Array(fl.rooms.length);
    fl.rooms.forEach(function (rm, k) { known[k] = rm.pseudo || !rm.mats || !rm.mats.walls ? 0 : 1; });
    fl.walk = {
      pat: pat, litF: litF, roof: roof, grW: grW, known: known, grit: fl.grit || new Uint8Array(n),
      // the face met going +x is a wall's west face, and so on
      face: [faceLight(-1, 0), faceLight(1, 0), faceLight(0, -1), faceLight(0, 1)]
    };
    return fl.walk;
  }

  function Caster(world, dark) {
    this.world = world;
    this.darkRgb = dark;
    this.DARK = packRgb(dark);
    this.si = new Uint32Array(4);
    this.W = 0; this.H = 0;
  }

  Caster.prototype.size = function (W, H, g) {
    if (this.W === W && this.H === H && this.img) { return; }
    this.W = W; this.H = H;
    this.img = (g || document.createElement("canvas").getContext("2d")).createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.pick = new Int32Array(W * H);
    this.depth = new Float32Array(W);
    this.colRx = new Float32Array(W); this.colRy = new Float32Array(W); this.colRl = new Float32Array(W);
    this.hitW = new Int16Array(W); this.hitT = new Float32Array(W); this.hitU = new Float32Array(W);
    this.winT = new Int16Array(W); this.winB = new Int16Array(W);
    this.rowK = new Float32Array(H);
    this.skyRow = new Uint32Array(H * 4);
    this.focal = (W / 2) / Math.tan(FOV / 2);
    this.hz = H / 2;
    for (var y = 0; y < H; y += 1) {
      var dy = y + 0.5 - this.hz;
      this.rowK[y] = Math.abs(dy) < 1e-6 ? 1e6 : this.focal / dy;
    }
  };

  // The four stepped colours of an ink, into this.si.
  Caster.prototype.steps = function (ink) {
    var r = ink & 255, g = (ink >>> 8) & 255, b = (ink >>> 16) & 255, si = this.si;
    for (var s = 0; s < 4; s += 1) {
      var k = KM[s];
      si[s] = pack((r * k) >> 8, (g * k) >> 8, (b * k) >> 8);
    }
    return si;
  };

  /* One frame into this.buf, this.pick and the per-column records. cam:
     {fl (a floor), x, y, a (radians in the grid), z (the floor height under
     the walker, m)}; works: the hung works of this floor, each with an
     index i into the whole list. */
  Caster.prototype.render = function (cam, works) {
    var world = this.world, fl = cam.fl, Wp = P();
    var ex = prepFloor(world, fl);
    var W = this.W, H = this.H, focal = this.focal, hz = this.hz;
    var buf = this.buf, pick = this.pick, rowK = this.rowK, DARK = this.DARK;
    var kind = fl.kind, fh = fl.fh, ch = fl.ch, ck = fl.ck, inkF = fl.inkF, inkW = fl.inkW, inkT = fl.inkT;
    var pat = ex.pat, litF = ex.litF, roof = ex.roof, grW = ex.grW, face = ex.face, known = ex.known, grit = ex.grit;
    var rooms = fl.rooms, room = fl.room;
    var gw = fl.gw, gh = fl.gh, cell = fl.cell, x0 = fl.x0, y0 = fl.y0;
    var WALL = Wp.WALL, GLASS = Wp.GLASS, OPEN = Wp.OPEN;
    var SKY = Wp.SKY, SKYLIGHT = Wp.SKYLIGHT, DARKC = Wp.DARK, DOME = Wp.DOME, VAULT = Wp.VAULT, FLATC = Wp.FLAT;
    var night = world.sky && world.sky.night ? 1 : 0;
    var cx = cam.x, cy = cam.y, dx = Math.cos(cam.a), dy = Math.sin(cam.a);
    var zE = cam.z + EYE;
    var si = this.si;
    var glassA = packRgb(GLASS_SKY), glassB = packRgb(GLASS_DARK);

    // The sky, a gradient from its tone overhead to its pane at the horizon,
    // each row's four steps.
    var tone = world.sky ? world.sky.tone : [206, 220, 232], pane = world.sky ? world.sky.pane : tone;
    for (var sy = 0; sy < H; sy += 1) {
      var t = clamp(sy / Math.max(1, hz), 0, 1);
      var rr = tone[0] + (pane[0] - tone[0]) * t, gg = tone[1] + (pane[1] - tone[1]) * t, bb = tone[2] + (pane[2] - tone[2]) * t;
      for (var ss = 0; ss < 4; ss += 1) {
        var kk = KM[ss] / 256;
        this.skyRow[sy * 4 + ss] = pack(Math.round(rr * kk), Math.round(gg * kk), Math.round(bb * kk));
      }
    }

    // The works that may be seen from here: their segments, relative to the eye.
    var cand = [];
    (works || []).forEach(function (h) {
      var mx = (h.x0 + h.x1) / 2 - cx, my = (h.y0 + h.y1) / 2 - cy;
      if (mx * mx + my * my > (FOG_FAR + h.w) * (FOG_FAR + h.w)) { return; }
      cand.push({ i: h.i, ex: h.x1 - h.x0, ey: h.y1 - h.y0, w0x: h.x0 - cx, w0y: h.y0 - cy, nx: h.nx, ny: h.ny,
                  z0: h.z0, z1: h.z1, c: h.bands });
    });
    var nc = cand.length;
    this.hitW.fill(-1);

    var gx = (cx - x0) / cell, gy = (cy - y0) / cell;
    var ix0 = Math.floor(gx), iy0 = Math.floor(gy);
    var inside0 = ix0 >= 0 && iy0 >= 0 && ix0 < gw && iy0 < gh;
    var y, o, q, nq, d0, d1, top, bot, lt, li, s, thr, xm, dist, yA, yB, k;

    // A vertical face at distance d1 from zLo to zHi, rows clipped to the
    // window: rows [a, b] (inclusive).
    function rowOf(z, d) { return hz + (zE - z) * focal / d; }

    for (var x = 0; x < W; x += 1) {
      var cmx = (x + 0.5 - W / 2) / focal;
      var rx = dx - dy * cmx, ry = dy + dx * cmx, rl = Math.sqrt(rx * rx + ry * ry);
      this.colRx[x] = rx; this.colRy[x] = ry; this.colRl[x] = rl;
      xm = x & 7;
      top = 0; bot = H - 1;
      if (!inside0) {
        for (y = 0; y < H; y += 1) { o = y * W + x; buf[o] = DARK; pick[o] = 0; }
        this.depth[x] = 0;
        continue;
      }
      // The nearest work this column meets, in front of its wall.
      var tW = Infinity, uW = 0, wI = -1, wc = null;
      for (var c = 0; c < nc; c += 1) {
        var e = cand[c];
        if (e.nx * rx + e.ny * ry >= 0) { continue; }
        var den = rx * e.ey - ry * e.ex;
        if (den > -1e-12 && den < 1e-12) { continue; }
        var tt = (e.w0x * e.ey - e.w0y * e.ex) / den;
        if (tt <= 0.05 || tt >= tW) { continue; }
        var uu = (e.w0x * ry - e.w0y * rx) / den;
        if (uu < 0 || uu > 1) { continue; }
        tW = tt; uW = uu; wI = e.i; wc = e;
      }
      var recorded = wI < 0;
      var ix = ix0, iy = iy0;
      var ddx = rx === 0 ? 1e30 : Math.abs(cell / rx), ddy = ry === 0 ? 1e30 : Math.abs(cell / ry);
      var stx = rx < 0 ? -1 : 1, sty = ry < 0 ? -1 : 1;
      var sdx = rx < 0 ? (gx - ix) * ddx : (ix + 1 - gx) * ddx;
      var sdy = ry < 0 ? (gy - iy) * ddy : (iy + 1 - gy) * ddy;
      var tMax = FOG_FAR / rl;
      q = iy * gw + ix; d0 = 1e-3; d1 = 0;
      var side = 0, ended = false;
      while (!ended) {
        if (sdx < sdy) { d1 = sdx; sdx += ddx; ix += stx; side = 0; } else { d1 = sdy; sdy += ddy; iy += sty; side = 1; }
        var far = d1 >= tMax;
        if (far) { d1 = tMax; }
        if (!recorded && tW < d1) { this.winT[x] = top; this.winB[x] = bot; recorded = true; }
        var fz = fh[q] / 100, czc = ch[q], cz = czc / 100;

        // Its floor, from d0 to d1.
        if (zE > fz) {
          yA = Math.floor(rowOf(fz, d1) - 0.5) + 1;
          yB = Math.floor(rowOf(fz, d0) - 0.5);
          if (yA < top) { yA = top; }
          if (yB > bot) { yB = bot; }
          if (yA <= yB) {
            this.steps(inkF[q]);
            var lt0 = litF[q], pt = pat[q], zd = zE - fz, pk = (PICK_FLOOR << 24) | q, gF = grit[q] & 3;
            for (y = yA; y <= yB; y += 1) {
              o = y * W + x;
              var d = zd * rowK[y];
              dist = d * rl;
              thr = THR[((y & 7) << 3) | xm];
              pick[o] = pk;
              if (dist > FOG_NEAR && thr < (dist - FOG_NEAR) * FOG_K) { buf[o] = DARK; continue; }
              lt = lt0;
              if (gF) {
                // DIRT's gaps and speckle, 2.5 cm each (a dot or so near by,
                // fine grit far off), where the soil shows.
                var gh_ = hash(Math.floor((cx + rx * d) * GRIT), Math.floor((cy + ry * d) * GRIT));
                if (gF === 1 && gh_ < 0.25) { buf[o] = DARK; continue; }
                if (gF === 2 && gh_ < 0.3) { lt *= 0.72; }
              }
              if (pt) {
                var wx = cx + rx * d, wy = cy + ry * d;
                if (pt === 1) { lt *= ((Math.floor(wx) + Math.floor(wy)) & 1) ? 1.03 : 0.95; }
                else if (pt === 2) { lt *= 0.94 + 0.1 * hash(Math.floor(wy / 0.19), Math.floor((wx + hash(Math.floor(wy / 0.19), 3) * 2.2) / 2.2)); }
                else { lt *= 0.94 + 0.1 * hash(Math.floor(wx / 0.19), Math.floor((wy + hash(Math.floor(wx / 0.19), 5) * 2.2) / 2.2)); }
              }
              li = ((lt - 0.4) * 256) | 0;
              if (li < 0) { li = 0; } else if (li > 255) { li = 255; }
              s = LS[li] + (thr < LF[li] ? 1 : 0) - night;
              buf[o] = si[s < 0 ? 0 : s];
            }
          }
          var nb = Math.floor(rowOf(fz, d1) - 0.5);
          if (nb < bot) { bot = nb; }
        }
        // Its ceiling, from d0 to d1.
        if (czc < OPEN && cz > zE) {
          yA = Math.ceil(rowOf(cz, d0) - 0.5);
          yB = Math.ceil(rowOf(cz, d1) - 0.5) - 1;
          if (yA < top) { yA = top; }
          if (yB > bot) { yB = bot; }
          var kc = ck[q];
          if (yA <= yB) {
            var zu = cz - zE, pkc = (PICK_CEIL << 24) | q;
            var lc = kc === SKYLIGHT ? 1.0 : kc === DOME || kc === VAULT ? (((czc / 50) | 0) & 1 ? 0.8 : 0.88) : 0.84;
            this.steps(kc === DARKC ? DARK : inkT[q]);
            var gT = kc === FLATC ? (grit[q] >> 4) & 3 : 0;
            for (y = yA; y <= yB; y += 1) {
              o = y * W + x;
              var dc = -zu * rowK[y];
              dist = dc * rl;
              thr = THR[((y & 7) << 3) | xm];
              pick[o] = pkc;
              if (kc === DARKC || (dist > FOG_NEAR && thr < (dist - FOG_NEAR) * FOG_K)) { buf[o] = DARK; continue; }
              lt = lc;
              if (gT) {
                var gc_ = hash(Math.floor((cx + rx * dc) * GRIT), Math.floor((cy + ry * dc) * GRIT));
                if (gT === 1 && gc_ < 0.2) { buf[o] = DARK; continue; }
                if (gT === 2 && gc_ < 0.3) { lt *= 0.72; }
              }
              if (kc === SKYLIGHT) {
                // Panes a metre square, their bars in the room's own top.
                var px_ = cx + rx * dc, py_ = cy + ry * dc;
                var fx = px_ - Math.floor(px_), fy = py_ - Math.floor(py_);
                if (fx < 0.07 || fy < 0.07) { lt = 0.62; }
              }
              li = ((lt - 0.4) * 256) | 0;
              if (li < 0) { li = 0; } else if (li > 255) { li = 255; }
              s = LS[li] + (thr < LF[li] ? 1 : 0) - night;
              buf[o] = si[s < 0 ? 0 : s];
            }
          }
          var nt = Math.ceil(rowOf(cz, d1) - 0.5);
          if (nt > top) { top = nt; }
        }
        if (top > bot) { break; }
        if (far) { this.rest(x, top, bot, q, ck[q] === SKY && czc >= OPEN); break; }
        if (ix < 0 || iy < 0 || ix >= gw || iy >= gh) { this.rest(x, top, bot, q, ck[q] === SKY && czc >= OPEN); break; }
        nq = iy * gw + ix;
        k = kind[nq];
        // The face met: which way it looks decides its light.
        var fl_ = side === 0 ? (stx > 0 ? face[0] : face[1]) : (sty > 0 ? face[2] : face[3]);
        if (k === WALL || k === GLASS) {
          // The wall it ends at: from the floor to the ceiling, or under an
          // open sky to the model's roof over it, the sky or the dark above.
          var mine = room[q] >= 0 && known[room[q]];
          var ink = mine ? inkW[q] : inkW[nq], gW = mine ? 0 : (grit[nq] >> 2) & 3;
          var from = top;
          if (czc >= OPEN) {
            var rz = roof[nq] / 100;
            var yr = rz > zE ? Math.ceil(rowOf(rz, d1) - 0.5) : Math.ceil(rowOf(zE + 0.01, d1) - 0.5);
            if (rz <= fz + 0.01) { yr = top; }
            if (yr > from) { this.above(x, from, Math.min(yr - 1, bot), ck[q] === SKY); from = yr; }
          }
          var yFoot = Math.ceil(rowOf(fz, d1) - 0.5) - 1;
          var pkw = (PICK_WALL << 24) | nq;
          dist = d1 * rl;
          var fogw = dist > FOG_NEAR ? (dist - FOG_NEAR) * FOG_K : 0;
          if (k === GLASS) {
            for (y = from; y <= bot; y += 1) {
              o = y * W + x;
              thr = THR[((y & 7) << 3) | xm];
              pick[o] = pkw;
              if (thr < fogw) { buf[o] = DARK; continue; }
              buf[o] = ((x + y) & 1) ? glassA : glassB;
            }
          } else {
            // A wall nobody knows the make of is its soil, and where the soil
            // has a gap or speckle, dots of it 2.5 cm each, far fewer than on a
            // floor (the model's walls show none): never a stripe from floor
            // to ceiling.
            this.steps(ink);
            var ib = grW[nq] * fl_, dz = d1 / focal;
            li = ((ib - 0.4) * 256) | 0;
            if (li < 0) { li = 0; } else if (li > 255) { li = 255; }
            var along = gW ? Math.floor((side === 0 ? cy + ry * d1 : cx + rx * d1) * GRIT) : 0;
            for (y = from; y <= bot; y += 1) {
              o = y * W + x;
              thr = THR[((y & 7) << 3) | xm];
              pick[o] = pkw;
              if (thr < fogw) { buf[o] = DARK; continue; }
              // A dot's darker skirting at the foot of every wall.
              s = y === yFoot ? 0 : LS[li] + (thr < LF[li] ? 1 : 0) - night;
              if (gW) {
                var gw_ = hash(along, Math.floor((zE - (y + 0.5 - hz) * dz) * GRIT));
                if (gW === 1 && gw_ < 0.12) { buf[o] = DARK; continue; }
                if (gW === 2 && gw_ < 0.2) { s -= 1; }
              }
              buf[o] = si[s < 0 ? 0 : s];
            }
          }
          ended = true;
          break;
        }
        // A step up: its riser.
        var nfz = fh[nq] / 100;
        if (nfz > fz + 0.005) {
          var ya = Math.ceil(rowOf(nfz, d1) - 0.5), yb = Math.ceil(rowOf(fz, d1) - 0.5) - 1;
          if (ya < top) { ya = top; }
          if (yb > bot) { yb = bot; }
          if (ya <= yb) {
            this.steps(inkF[nq]);
            dist = d1 * rl;
            var fogr = dist > FOG_NEAR ? (dist - FOG_NEAR) * FOG_K : 0, pkr = (PICK_FLOOR << 24) | nq;
            li = ((fl_ * litF[nq] / 0.9 - 0.4) * 256) | 0;
            if (li < 0) { li = 0; } else if (li > 255) { li = 255; }
            for (y = ya; y <= yb; y += 1) {
              o = y * W + x;
              thr = THR[((y & 7) << 3) | xm];
              pick[o] = pkr;
              if (thr < fogr) { buf[o] = DARK; continue; }
              s = LS[li] + (thr < LF[li] ? 1 : 0) - night;
              buf[o] = si[s < 0 ? 0 : s];
            }
          }
          var nb2 = Math.ceil(rowOf(nfz, d1) - 0.5) - 1;
          if (nb2 < bot) { bot = nb2; }
        }
        // A lower ceiling: its lintel, the wall over a doorway.
        var nczc = ch[nq];
        if (nczc < czc) {
          var ncz = nczc / 100, from2 = top;
          if (czc >= OPEN) {
            var rz2 = Math.max(roof[nq], roof[q]) / 100;
            var yr2 = rz2 > ncz ? Math.ceil(rowOf(rz2, d1) - 0.5) : Math.ceil(rowOf(ncz, d1) - 0.5);
            if (yr2 > from2) { this.above(x, from2, Math.min(yr2 - 1, bot), ck[q] === SKY); from2 = yr2; }
          } else {
            from2 = Math.max(top, Math.ceil(rowOf(cz, d1) - 0.5));
          }
          var yl = Math.ceil(rowOf(ncz, d1) - 0.5) - 1;
          if (yl > bot) { yl = bot; }
          if (from2 <= yl) {
            var inkl = room[nq] >= 0 && !rooms[room[nq]].pseudo ? inkW[nq] : room[q] >= 0 && !rooms[room[q]].pseudo ? inkW[q] : inkW[nq];
            this.steps(inkl);
            dist = d1 * rl;
            var fogl = dist > FOG_NEAR ? (dist - FOG_NEAR) * FOG_K : 0, pkl = (PICK_WALL << 24) | nq;
            li = ((fl_ - 0.4) * 256) | 0;
            for (y = from2; y <= yl; y += 1) {
              o = y * W + x;
              thr = THR[((y & 7) << 3) | xm];
              pick[o] = pkl;
              if (thr < fogl) { buf[o] = DARK; continue; }
              s = LS[li] + (thr < LF[li] ? 1 : 0) - night;
              buf[o] = si[s < 0 ? 0 : s];
            }
          }
          var nt2 = Math.ceil(rowOf(ncz, d1) - 0.5);
          if (nt2 > top) { top = nt2; }
        }
        if (top > bot) { break; }
        q = nq; d0 = d1;
      }
      if (!recorded) { this.winT[x] = top; this.winB[x] = bot; recorded = true; }
      this.depth[x] = d1;

      // The work this column meets: its three colours in bands, 5:3:2, until
      // its picture is laid over them.
      if (wI >= 0 && tW < d1 + 0.05) {
        this.hitW[x] = wI; this.hitT[x] = tW; this.hitU[x] = uW;
        var wt = Math.ceil(rowOf(wc.z1, tW) - 0.5), wb = Math.ceil(rowOf(wc.z0, tW) - 0.5) - 1;
        var ct = Math.max(wt, this.winT[x]), cb = Math.min(wb, this.winB[x]);
        dist = tW * rl;
        var fogk = dist > FOG_NEAR ? (dist - FOG_NEAR) * FOG_K : 0, pkk = (PICK_WORK << 24) | wI;
        var span = Math.max(1, wb - wt + 1);
        for (y = ct; y <= cb; y += 1) {
          o = y * W + x;
          thr = THR[((y & 7) << 3) | xm];
          pick[o] = pkk;
          if (thr < fogk) { buf[o] = DARK; continue; }
          var v = (y - wt + 0.5) / span;
          var bi = v < 0.5 ? 0 : v < 0.8 ? 1 : 2;
          // One dot of the dark round it.
          if (y === wt || y === wb) { buf[o] = DARK; continue; }
          var col = wc.c[bi];
          li = ((0.92 - 0.4) * 256) | 0;
          s = LS[li] + (thr < LF[li] ? 1 : 0) - night;
          if (s < 0) { s = 0; }
          buf[o] = col[s];
        }
      }
    }
    // The works' left and right edges, a dot of the dark.
    for (x = 0; x < W; x += 1) {
      var h = this.hitW[x];
      if (h < 0) { continue; }
      if ((x > 0 && this.hitW[x - 1] === h) && (x < W - 1 && this.hitW[x + 1] === h)) { continue; }
      var t0 = this.winT[x], t1 = this.winB[x];
      for (y = t0; y <= t1; y += 1) {
        o = y * W + x;
        if ((pick[o] >>> 24) === PICK_WORK && (pick[o] & 0xffffff) === h) { buf[o] = DARK; }
      }
    }
  };

  // What is left of a column where the ray goes out of what is known: the
  // sky over an open court, else the dark.
  Caster.prototype.rest = function (x, top, bot, q, sky) {
    var W = this.W, hz = this.hz, buf = this.buf, pick = this.pick, DARK = this.DARK;
    for (var y = top; y <= bot; y += 1) {
      var o = y * W + x;
      if (sky && y + 0.5 < hz) { buf[o] = this.skyAt(x, y); pick[o] = PICK_SKY << 24; }
      else { buf[o] = DARK; pick[o] = 0; }
    }
  };
  Caster.prototype.above = function (x, a, b, sky) {
    var W = this.W, buf = this.buf, pick = this.pick, DARK = this.DARK;
    for (var y = a; y <= b; y += 1) {
      var o = y * W + x;
      if (sky) { buf[o] = this.skyAt(x, y); pick[o] = PICK_SKY << 24; } else { buf[o] = DARK; pick[o] = 0; }
    }
  };
  Caster.prototype.skyAt = function (x, y) {
    var thr = THR[((y & 7) << 3) | (x & 7)];
    var s = 2 + (thr < 0.5 ? 1 : 0) - (this.world.sky && this.world.sky.night ? 1 : 0);
    return this.skyRow[y * 4 + (s < 0 ? 0 : s > 3 ? 3 : s)];
  };

  // Where a point at height z, at (px, py) in the grid, falls on the frame:
  // {x, y, t (its distance along the view)} in dots, or null behind the eye.
  Caster.prototype.project = function (cam, px, py, z) {
    var dx = Math.cos(cam.a), dy = Math.sin(cam.a);
    var vx = px - cam.x, vy = py - cam.y;
    var t = vx * dx + vy * dy;
    if (t < 0.1) { return null; }
    var side = -vx * dy + vy * dx;
    return { x: this.W / 2 + side / t * this.focal, y: this.hz + (cam.z + EYE - z) * this.focal / t, t: t };
  };

  /* ---------------------------------------------------------------- pictures */

  // Artsy's medium picture of each work in view within 25 m, four at a time,
  // twenty-four kept, the least recently seen let go; each as a small copy,
  // at most 128 dots tall, from which the frame takes one-dot slices. The
  // canvas they are drawn on is never read, so it does not matter that they
  // taint it. No crossOrigin, and no referrer.
  // A work's picture: Artsy's key, else the museum's own image (a collection work's img).
  function picKey(w) { return (w && (w.i || w.img)) || null; }

  function Pictures(cdn) {
    this.cdn = cdn || CDN;
    this.by = {};
    this.flying = 0;
    this.wanted = [];
    this.onready = null;
  }
  Pictures.prototype.get = function (key) {
    var p = this.by[key];
    if (p) { p.seen = performance.now(); }
    return p && p.ready ? p : null;
  };
  Pictures.prototype.want = function (key) {
    if (!key || this.by[key]) { if (this.by[key]) { this.by[key].seen = performance.now(); } return; }
    if (this.wanted.indexOf(key) < 0) { this.wanted.push(key); }
    this.pump();
  };
  Pictures.prototype.pump = function () {
    var self = this;
    while (this.flying < FLIGHT && this.wanted.length) {
      var key = this.wanted.shift();
      if (this.by[key]) { continue; }
      var entry = this.by[key] = { key: key, ready: false, failed: false, seen: performance.now(), at: 0 };
      this.flying += 1;
      (function (entry) {
        var img = new Image();
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        // A museum's own picture (a collection work's img) is its whole address; Artsy's, a key.
        var whole = /^https?:\/\//.test(entry.key);
        var tries = whole ? [] : ["medium", "large", "square"];
        img.onload = function () {
          self.flying -= 1;
          var k = Math.min(1, PICTURE_TALL / Math.max(1, img.naturalHeight));
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          var g = c.getContext("2d");
          g.imageSmoothingEnabled = true;
          g.drawImage(img, 0, 0, c.width, c.height);
          entry.canvas = c; entry.w = c.width; entry.h = c.height; entry.ready = true;
          entry.ar = img.naturalWidth / Math.max(1, img.naturalHeight);
          self.trim();
          self.pump();
          if (self.onready) { self.onready(entry); }
        };
        img.onerror = function () {
          if (tries.length) { img.src = self.cdn + entry.key + "/" + tries.shift() + ".jpg"; return; }
          self.flying -= 1;
          entry.failed = true;
          self.pump();
        };
        img.src = whole ? entry.key : self.cdn + entry.key + "/" + tries.shift() + ".jpg";
      }(entry));
    }
  };
  Pictures.prototype.trim = function () {
    var ready = Object.keys(this.by).map(function (k) { return this.by[k]; }, this).filter(function (p) { return p.ready; });
    if (ready.length <= KEEP) { return; }
    ready.sort(function (a, b) { return a.seen - b.seen; });
    for (var n = 0; n < ready.length - KEEP; n += 1) { delete this.by[ready[n].key]; }
  };

  /* Lay each seen work's picture over its bands, a dot's column at a time,
     clipped to what is in front of it, fitted inside its real size where
     the photograph's proportions are not the work's, and fading past 13 m.
     A picture seen for the first time is uncovered over about 0.6 s. */
  function blitWorks(g, cs, cam, hung, pics, now, dot, still) {
    var W = cs.W, hz = cs.hz, focal = cs.focal, zE = cam.z + EYE, busy = false;
    var dark = cssOf(cs.darkRgb);
    g.imageSmoothingEnabled = false;
    var x = 0;
    while (x < W) {
      var i = cs.hitW[x];
      if (i < 0) { x += 1; continue; }
      var h = hung[i], x1 = x;
      while (x1 < W && cs.hitW[x1] === i) { x1 += 1; }
      var n = x1 - x;
      var key = picKey(h.work);
      var near = cs.hitT[x] * cs.colRl[x] <= PICTURE_NEAR;
      var p = key && near && n >= 4 ? pics.get(key) : null;
      if (p) {
        if (!p.at) { p.at = now; }
        var up = still ? 1 : clamp((Math.floor((now - p.at) / (1000 / FPS)) * (1000 / FPS)) / 600, 0, 1);
        if (up < 1) { busy = true; }
        // The photograph fitted inside the work's real size, never stretched.
        var arW = h.w / Math.max(0.01, h.h), fu0 = 0, fu1 = 1, fv0 = 0, fv1 = 1;
        if (Math.abs(p.ar / arW - 1) > 0.08) {
          if (p.ar > arW) { var hh = arW / p.ar; fv0 = (1 - hh) / 2; fv1 = 1 - fv0; }
          else { var ww = p.ar / arW; fu0 = (1 - ww) / 2; fu1 = 1 - fu0; }
        }
        for (var cx = x; cx < x1; cx += 1) {
          var t = cs.hitT[cx], u = cs.hitU[cx], dist = t * cs.colRl[cx];
          var alpha = clamp(1 - (dist - PICTURE_FADE) / (PICTURE_NEAR - PICTURE_FADE), 0, 1);
          var zTop = h.z1 - fv0 * (h.z1 - h.z0), zBot = h.z1 - fv1 * (h.z1 - h.z0);
          var yT = hz + (zE - zTop) * focal / t, yB = hz + (zE - zBot) * focal / t;
          var wt = cs.winT[cx], wb = cs.winB[cx] + 1;
          var a = Math.max(yT, wt), b = Math.min(yB, wb);
          if (u < fu0 || u > fu1) {
            // Outside the photograph, inside the work: the dark.
            var ya = Math.max(hz + (zE - h.z1) * focal / t, wt), yb = Math.min(hz + (zE - h.z0) * focal / t, wb);
            if (yb > ya) { g.globalAlpha = alpha; g.fillStyle = dark; g.fillRect(cx, Math.round(ya), 1, Math.round(yb) - Math.round(ya)); }
            continue;
          }
          if (b <= a || alpha <= 0) { continue; }
          var sx = Math.min(p.w - 1, Math.floor((u - fu0) / (fu1 - fu0) * p.w));
          var sy0 = (a - yT) / (yB - yT) * p.h, sy1 = (b - yT) / (yB - yT) * p.h;
          g.globalAlpha = alpha;
          if (up >= 1) {
            g.drawImage(p.canvas, sx, sy0, 1, Math.max(0.01, sy1 - sy0), cx, a, 1, b - a);
          } else {
            // Uncovered in blocks of six dots, in held frames.
            for (var by = Math.floor(a); by < b; by += 6) {
              if (hash(cx, (by / 6) | 0) > up) { continue; }
              var bb = Math.min(b, by + 6), aa = Math.max(a, by);
              g.drawImage(p.canvas, sx, (aa - yT) / (yB - yT) * p.h, 1, Math.max(0.01, (bb - aa) / (yB - yT) * p.h), cx, aa, 1, bb - aa);
            }
          }
          // A dot of the dark along its top and its foot.
          g.fillStyle = dark;
          if (yT >= wt && yT < wb) { g.fillRect(cx, Math.floor(yT), 1, 1); }
          if (yB - 1 >= wt && yB - 1 < wb) { g.fillRect(cx, Math.floor(yB) - 1, 1, 1); }
        }
        g.globalAlpha = 1;
      } else if (key && near) {
        pics.want(key);
      }
      x = x1;
    }
    g.globalAlpha = 1;
    return busy;
  }

  /* ---------------------------------------------------------------- the state */

  var S = null;                 // the walk that is open, or null
  var readWas = {};             // what has been read of each work, for the visit
  var cache = {};               // compiled worlds, by slug, while their museum is open

  function hostOf(ctx) {
    var land = ctx.land || {};
    return {
      pulse: land.pulse || function () {},
      sweepCells: land.sweepCells || function () {},
      passage: land.passage || function () {},
      scramble: land.scramble || function () {},
      ARRIVALS: land.ARRIVALS || {},
      oneOf: land.oneOf || function (l) { return l[Math.floor(Math.random() * l.length)]; },
      later: land.later || function (fn, ms, r) { r.timers.push(window.setTimeout(function () { if (r.live) { fn(); } }, ms)); },
      afterStill: land.afterStill || land.later || function (fn, ms, r) { r.timers.push(window.setTimeout(function () { if (r.live) { fn(); } }, ms)); },
      still: !!land.still,
      LIGHT: land.LIGHT || "#5e52c7", LILAC: land.LILAC || "#9d95e6",
      OPEN_AT: land.OPEN_AT || [4000, 9000, 16000, 24000],
      FIRST_WORD_AT: land.FIRST_WORD_AT || 30000,
      WORD_GAP: land.WORD_GAP || 22000, WORD_GAP_GROW: land.WORD_GAP_GROW || 1.35, WORD_GAP_MAX: land.WORD_GAP_MAX || 40000,
      CLOD_RISE: land.CLOD_RISE || PHI * 1000,
      readArt: land.readArt || function (path) { return fetch(path).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); },
      openArt: land.openArt || function () {},
      goMuseum: land.goMuseum || null,
      lightInto: land.lightInto || null,
      cdn: land.cdn || CDN,
      banner: land.banner || {}
    };
  }

  function compileFor(ctx) {
    var slug = ctx.interior && ctx.interior.slug;
    var hit = slug && cache[slug];
    if (hit && hit.interior === ctx.interior && hit.model === ctx.modelSpec) { return hit.world; }
    var dark = rgbOf(ctx.frameInk, [15, 12, 10]);
    var world = P().compile(ctx.interior, ctx.modelSpec, { soil: ctx.soil || null, sky: ctx.sky || null, dark: dark });
    if (slug) { cache = {}; cache[slug] = { interior: ctx.interior, model: ctx.modelSpec, world: world }; }
    return world;
  }

  /* Hang the works the records place in drawn rooms, and give each what the
     frame needs: its index, its bands' stepped colours. */
  function hangAll(world, works, pins) {
    var res = P().hang(world, works || [], pins || {});
    res.hung.forEach(function (h, i) {
      h.i = i;
      var cs = (h.work && h.work.c) || [];
      var three = [0, 1, 2].map(function (k) { return hexRgb(cs[k]) || hexRgb(cs[0]) || [128, 120, 110]; });
      h.bands = three.map(function (c) {
        return new Uint32Array(KM.map(function (k) { return pack((c[0] * k) >> 8, (c[1] * k) >> 8, (c[2] * k) >> 8); }));
      });
      h.tones = (h.work && h.work.c || []).slice(0, 3);
    });
    return res;
  }

  function floorName(fl) { return fl ? (fl.name || (fl.id === "shell" ? "Inside" : fl.id)) : ""; }

  function roomAt(world, fi, x, y) {
    var fl = world.floors[fi];
    if (!fl) { return null; }
    var q = P().cellAt(fl, x, y);
    if (q < 0) { return null; }
    var r = fl.room[q];
    return r >= 0 ? fl.rooms[r] : null;
  }

  function roomWords(room) {
    if (!room) { return ""; }
    if (room.name) { return room.name; }
    if (room.pseudo === "stair") { return "the stairs"; }
    if (room.pseudo === "lift") { return "the lift"; }
    if (room.pseudo === "outside") { return S && S.world && S.world.shell ? "outside, at a way in (ours)" : "outside, at the door"; }
    if (room.pseudo === "shell") { return "inside"; }
    return "a " + (room.kind || "room") + " not named in the sources";
  }

  // The part of a source's words before its colon: "the National Gallery of
  // Art's open data".
  function sourceWords(world, id) {
    var s = world.sources && world.sources[id];
    if (!s || !s.t) { return ""; }
    return String(s.t).split(":")[0];
  }

  /* ---------------------------------------------------------------- building the view */

  function open(ctx) {
    if (S) { close(); }
    var host = hostOf(ctx);
    var root = el("div", "walk");
    root.dataset.level = "plan";
    var box = el("div", "walk-box");
    var view = el("canvas", "walk-view");
    view.tabIndex = 0;
    view.setAttribute("role", "img");
    box.appendChild(view);
    var plan = el("canvas", "walk-plan");
    var light = el("canvas", "walk-light");
    light.setAttribute("aria-hidden", "true");
    var names = el("div", "walk-names");
    var label = el("div", "walk-label");
    label.hidden = true;
    var look = el("div", "walk-look");
    look.hidden = true;
    // The plan's floors by a press (WCAG 2.5.7): the vertical drag that changes floor has buttons too.
    var floorsEl = el("div", "walk-floors");
    floorsEl.setAttribute("role", "group");
    floorsEl.setAttribute("aria-label", "Floors");
    floorsEl.hidden = true;
    [["up", "▲", "The floor above"], ["down", "▼", "The floor below"]].forEach(function (f) {
      var fb = el("button", "walk-floor walk-floor-" + f[0], f[1]);
      fb.type = "button";
      fb.dataset.dir = f[0];
      fb.setAttribute("aria-label", f[2]);
      fb.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      fb.addEventListener("click", function (event) {
        event.stopPropagation();
        var nx = floorNext(f[0] === "up" ? 1 : -1);
        if (nx) { floorTo(nx.index); }
      });
      floorsEl.appendChild(fb);
    });
    [box, plan, light, names, label, look, floorsEl].forEach(function (e) { root.appendChild(e); });
    root.style.visibility = "hidden";
    (ctx.host || document.body).appendChild(root);
    var styled_ = styleOnce();

    var s = S = {
      ctx: ctx, host: host, root: root, box: box, view: view, plan: plan, light: light, names: names,
      label: label, look: look, level: null, world: null, hung: [], spill: [], works: (ctx.interior && ctx.interior.works) || [],
      me: null, keys: {}, drag: null, pointers: {}, glide: null, turnTo: null, raf: 0, last: 0,
      dirty: true, planDirty: true, drawn: 0, planDrawn: 0, planAnim: null, planDots: null, planFloor: 0,
      heading: ctx.heading === undefined ? TAU / 8 : ctx.heading, headAnim: null, frame: null,
      dot: window.innerWidth <= 720 ? 3 : 4, times: [], slow: 0, standing: null, reading: null,
      stillSince: 0, walked: 0, pics: new Pictures(host.cdn), live: true, listeners: [], nameEls: {},
      stats: { frames: 0, total: 0, max: 0, list: [], parts: [0, 0, 0, 0] }, planStats: { frames: 0, total: 0, max: 0 },
      cameFor: {}, lastRoom: null, lastWhere: 0,
      toClose: [], rechecked: false
    };
    s.pics.onready = function (p) {
      if (S !== s) { return; }
      // A work of no known size is 60 cm tall at its picture's proportions.
      var again = false;
      s.works.forEach(function (w) {
        if (picKey(w) === p.key &&!(w.cm && w.cm[0] > 0 && w.cm[1] > 0) && Math.abs((w.ar || 1) - p.ar) > 0.02) { w.ar = p.ar; again = true; }
      });
      if (again && s.world) {
        var res = hangAll(s.world, s.works, s.ctx.interior && s.ctx.interior.pins);
        var was = s.standing && s.standing.id;
        s.hung = res.hung; s.spill = res.spill;
        s.planCache = {};
        s.orderWas = null;
        if (was) { s.hung.forEach(function (h) { if (h.id === was) { s.standing = h; if (s.reading) { s.reading.h = h; } } }); }
      }
      s.dirty = true;
      wake();
    };
    if (ctx.came && ctx.at && ctx.at.work) { s.cameFor[ctx.at.work] = ctx.came; }

    return new Promise(function (done, fail) {
      // Compiled after the page has had a moment to show the press, and
      // sized once walk.css has come.
      Promise.all([styled_, new Promise(function (r) { window.setTimeout(r, 30); })]).then(function () {
        if (S !== s) { done(null); return; }
        try {
          s.world = compileFor(ctx);
          var hung = hangAll(s.world, s.works, ctx.interior && ctx.interior.pins);
          s.hung = hung.hung; s.spill = hung.spill;
        } catch (err) {
          close();
          fail(err);
          return;
        }
        if (!s.world.floors.length || !s.world.enter) { close(); fail(new Error("nothing to walk")); return; }
        s.caster = new Caster(s.world, rgbOf(ctx.frameInk, [15, 12, 10]));
        var e = s.world.enter, was = ctx.at && ctx.at.resume;
        s.me = was && s.world.floors[was.floor] ? { floor: was.floor, x: was.x, y: was.y, a: was.a, z: 0 }
                                                : { floor: e.floor, x: e.x, y: e.y, a: e.a, z: 0 };
        s.me.z = floorZ(s.me.floor, s.me.x, s.me.y);
        s.planFloor = s.me.floor;
        root.style.visibility = "";
        view.setAttribute("aria-label", "Inside " + ((ctx.museum && ctx.museum.name) || "the museum"));
        listen(s);
        if (host.lightInto) { host.lightInto(light); }
        size();
        showPlan("building");
        recheck();
        if (ctx.at && ctx.at.work) {
          var wid = ctx.at.work;
          // Come for a work: while the roof comes off, its room is named first and lit.
          s.hung.forEach(function (h) {
            var w = (s.works || []).filter(function (x) { return x.id === wid; })[0];
            if (h.id === wid || (w && w.same === h.id)) { s.focusRoom = { floor: h.floor, index: h.room }; }
          });
          window.setTimeout(function () { if (S === s && s.level === "plan" && !s.leaving) { goTo(wid, ctx.came); } }, host.still ? 0 : host.CLOD_RISE + 200);
        }
        done(api);
      });
    });
  }

  // walk.css, appended once; resolved when it has come (or failed: the walk
  // still works, only plainer).
  var styled = null;
  function styleOnce() {
    if (styled) { return styled; }
    var had = document.querySelector("link[href$='walk.css']");
    if (had && had.sheet) { styled = Promise.resolve(); return styled; }
    styled = new Promise(function (done) {
      var link = had || document.createElement("link");
      link.addEventListener("load", function () { done(); });
      link.addEventListener("error", function () { done(); });
      if (!had) {
        link.rel = "stylesheet";
        link.href = "walk.css";
        document.head.appendChild(link);
      }
      window.setTimeout(done, 4000);
    });
    return styled;
  }

  function floorZ(fi, x, y) {
    var fl = S.world.floors[fi], q = P().cellAt(fl, x, y);
    return q >= 0 ? fl.fh[q] / 100 : fl.z;
  }

  function close() {
    var s = S;
    if (!s) { return; }
    S = null;
    s.live = false;
    if (s.raf) { cancelAnimationFrame(s.raf); }
    stopReading(s);
    s.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    s.toClose.forEach(function (t) { window.clearTimeout(t); });
    if (s.here && s.here.parentNode) { s.here.parentNode.removeChild(s.here); }
    if (s.host.banner.under) { s.host.banner.under.hidden = false; }   // a shell had emptied it
    if (s.root.parentNode) { s.root.parentNode.removeChild(s.root); }
    if (s.host.lightInto) { s.host.lightInto(null); }
    if (s.level !== null && s.ctx.onLevel) { s.ctx.onLevel(null); }
    s.world = null; s.caster = null; s.hung = [];
    paint.dots = null; paint.orders = []; paint.order = null; paint.img = null; paint.inks = {};
  }

  function listen(s) {
    function on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); s.listeners.push([t, ev, fn, opt]); }
    [s.view, s.plan].forEach(function (c) {
      on(c, "pointerdown", pointerDown);
      on(c, "pointermove", pointerMove);
      on(c, "pointerup", pointerUp);
      on(c, "pointercancel", pointerUp);
      on(c, "lostpointercapture", pointerUp);
    });
    // The names, the label and the look take their own presses; nothing
    // pressed in here may reach the building behind, which would take it
    // for a turn or a tap that swaps it for its ground. (The stage's own
    // listeners for two fingers listen on the way down, and still hear.)
    on(s.root, "pointerdown", function (event) { event.stopPropagation(); });
    on(s.names, "pointerdown", function (event) {
      var b = event.target && event.target.closest ? event.target.closest(".walk-name") : null;
      if (b) { pointerDown(event, s.level === "plan" ? s.plan : s.view, b); }
    });
    // A press that began in the look: on a phone, the tap that opened it
    // is followed by a click on whatever is now under the finger, which must
    // neither put it away nor zoom it.
    on(s.look, "pointerdown", function () { s.lookDown = performance.now(); });
    on(s.look, "click", function (event) {
      if (!pressedInLook()) { return; }
      if (event.target === s.look || event.target.classList.contains("walk-look-in")) { unlook(); }
    });
    // A finger let go anywhere is let go: a second finger's release can land
    // on a name that came up under it, which has no handler of its own.
    function letGo(event) { if (S) { delete S.pointers[event.pointerId]; } }
    on(window, "pointerup", letGo, true);
    on(window, "pointercancel", letGo, true);
    on(document, "keydown", keyDown);
    on(document, "keyup", keyUp);
    on(window, "blur", function () { if (S) { S.keys = {}; } });
    on(window, "resize", function () { if (S) { S.sized = false; S.dirty = S.planDirty = true; wake(); } });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { if (S === s) { s.sized = false; s.dirty = s.planDirty = true; wake(); } });
      ro.observe(s.root);
      if (s.ctx.band) { ro.observe(s.ctx.band); }
      s.listeners.push([{ removeEventListener: function () { ro.disconnect(); } }, "", null, null]);
    }
    on(document, "visibilitychange", function () { if (S && !document.hidden) { S.last = performance.now(); S.dirty = S.planDirty = true; wake(); } });
  }

  /* The band the walk fills, and each canvas cut to it: the walk a dot to
     three or four screen pixels; the plan two, exactly as the building was
     drawn, over the same box, so its roof comes off where it stood. */
  function size() {
    var s = S;
    var r = s.root.getBoundingClientRect();
    // Where the banner has wrapped (a long name on a phone) the walk starts
    // under it, so what it says stays readable over the picture.
    var under = s.host.banner.under, bn = under && under.closest ? under.closest(".banner") : null;
    var drop = 0;
    if (bn) { var bb = bn.getBoundingClientRect(); if (bb.height && bb.bottom + 4 > r.top) { drop = Math.min(r.height * 0.3, Math.ceil(bb.bottom + 4 - r.top)); } }
    s.box.style.top = drop ? drop + "px" : "";
    s.look.style.top = drop ? drop + "px" : "";
    var bh = r.height - drop;
    var W = Math.max(8, Math.ceil(r.width / s.dot)), H = Math.max(8, Math.ceil(bh / s.dot));
    s.view.width = W; s.view.height = H;
    s.view.style.width = W * s.dot + "px";
    s.view.style.height = H * s.dot + "px";
    s.g = s.view.getContext("2d");
    s.caster.size(W, H, s.g);
    var band = s.ctx.band ? s.ctx.band.getBoundingClientRect() : r;
    var pw = Math.max(1, Math.ceil(band.width / PLAN_PIX)), ph = Math.max(1, Math.ceil(band.height / PLAN_PIX));
    if (s.plan.width !== pw || s.plan.height !== ph) { s.plan.width = pw; s.plan.height = ph; }
    s.plan.style.left = (band.left - r.left) + "px";
    s.plan.style.top = (band.top - r.top) + "px";
    s.plan.style.width = band.width + "px";
    s.plan.style.height = band.height + "px";
    s.rootRect = r;
    s.planRect = { left: band.left, top: band.top, width: band.width, height: band.height };
    s.sized = true;
    s.dirty = s.planDirty = true;
  }

  /* ---------------------------------------------------------------- the frame loop */

  function wake() {
    var s = S;
    if (!s || s.raf || document.hidden) { return; }
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }

  // What keeps the frames coming: on the plan only its own lift and turn;
  // in the walk, moving, turning, a picture being uncovered, the eye
  // settling on a stair, and the moment before you count as standing.
  function busy(s, now) {
    if (s.planAnim || s.headAnim) { return true; }
    if (s.level !== "walk" && s.level !== "look") { return false; }
    return !!(s.glide || (s.turnTo !== null && s.turnTo !== undefined) || s.drag && s.drag.walking || anyKey(s) ||
              s.picBusy || (s.me && Math.abs(s.me.zTo - s.me.z) > 0.002) || (s.stillSince && now - s.stillSince < STILL_WAIT + 60));
  }
  function anyKey(s) {
    var k = s.keys;
    return !!(k.f || k.b || k.l || k.r || k.sl || k.sr);
  }

  function tick(now) {
    var s = S;
    if (!s) { return; }
    s.raf = 0;
    if (document.hidden) { return; }
    var dt = Math.min(0.1, Math.max(0, (now - s.last) / 1000));
    s.last = now;
    if (!s.sized) { size(); }
    // A picture being uncovered is drawn on, frame by held frame.
    if (s.picBusy) { s.dirty = true; }
    if (s.level === "walk" || s.level === "look") { step(dt, now); }
    planStep(now);
    // The roof settled back, or the door walked out of: the walk is closed.
    if (S !== s) { return; }
    // Held frames on a fixed clock of 24 a second (the plan 12), as the pixel
    // light's are: a frame when the clock's slot changes, so a 60 Hz screen
    // draws two ticks, then three, and keeps the rate (a minimum gap between
    // frames would round it down to 20).
    if (s.level === "plan" && s.planDirty && Math.floor(now * PLAN_FPS / 1000) !== s.planSlot) {
      s.planSlot = Math.floor(now * PLAN_FPS / 1000);
      planDraw(now);
    }
    if ((s.level === "walk" || s.level === "look") && s.dirty && Math.floor(now * FPS / 1000) !== s.slot) {
      s.slot = Math.floor(now * FPS / 1000);
      draw(now);
    }
    // Still long enough: are you before a work? (No frame is drawn for it.)
    if (s.level === "walk" && !s.dirty && s.stillSince && !s.standChecked && now - s.stillSince >= STILL_WAIT) {
      s.standChecked = true;
      standCheck(now);
    }
    if (busy(s, now) || s.dirty && s.level !== "plan" || s.planDirty && s.level === "plan") {
      s.raf = requestAnimationFrame(tick);
    }
  }

  /* One frame of the walk: cast, put, lay the pictures over, then the names. */
  function draw(now) {
    var s = S;
    var t0 = performance.now();
    var fl = s.world.floors[s.me.floor];
    var cam = { fl: fl, x: s.me.x, y: s.me.y, a: s.me.a, z: s.me.z };
    var works = s.hung.filter(function (h) { return h.floor === s.me.floor; });
    s.caster.render(cam, works);
    var t1 = performance.now();
    s.g.putImageData(s.caster.img, 0, 0);
    var t2 = performance.now();
    var saveData = navigator.connection && navigator.connection.saveData;
    var pics = saveData ? standingOnly(s) : s.pics;
    s.picBusy = blitWorks(s.g, s.caster, cam, s.hung, pics, now, s.dot, s.host.still);
    var t3 = performance.now();
    s.drawn = now;
    s.dirty = false;
    s.cam = cam;
    seen(s);
    // In the look the walk is washed behind the work: no names over it.
    if (s.level === "look") { clearNames("walk"); } else { names(now); }
    standCheck(now);
    // The whole frame, names and all, is what the dot grows by.
    pace(performance.now() - t0, now, [t1 - t0, t2 - t1, t3 - t2, performance.now() - t3]);
  }

  // With saveData, a work stays its three colours until you stand before it.
  function standingOnly(s) {
    var key = s.standing && picKey(s.standing.work);
    return { get: function (k) { return k === key ? s.pics.get(k) : null; },
             want: function (k) { if (k === key) { s.pics.want(k); } } };
  }

  // Frame times: if they average over 30 ms for two seconds, the dot grows
  // (3, 4, 5, 6) and does not shrink back.
  function pace(ms, now, parts) {
    var s = S, st = s.stats;
    st.frames += 1; st.total += ms; st.max = Math.max(st.max, ms);
    st.list.push(ms);
    if (st.list.length > 600) { st.list.shift(); }
    if (parts) { for (var k = 0; k < 4; k += 1) { st.parts[k] += parts[k]; } }
    s.times.push({ at: now, ms: ms });
    while (s.times.length && now - s.times[0].at > 2000) { s.times.shift(); }
    // Two seconds of frames (slow ones are few: a handful is enough to say so).
    if (s.times.length >= 6 && now - s.times[0].at > 1800) {
      var sum = 0;
      s.times.forEach(function (t) { sum += t.ms; });
      if (sum / s.times.length > 30 && s.dot < DOT_MAX) {
        s.dot += 1;
        s.times = [];
        s.sized = false;
        s.dirty = true;
      }
    }
  }

  // Which works were seen this frame, and where: for their names, and for
  // standing before one.
  function seen(s) {
    var cs = s.caster, n = s.hung.length;
    var lo = s.seenLo = new Int16Array(n).fill(-1), hi = s.seenHi = new Int16Array(n).fill(-1);
    var dt = s.seenT = new Float32Array(n).fill(Infinity);
    for (var x = 0; x < cs.W; x += 1) {
      var i = cs.hitW[x];
      if (i < 0) { continue; }
      if (lo[i] < 0) { lo[i] = x; }
      hi[i] = x;
      dt[i] = Math.min(dt[i], cs.hitT[x]);
    }
  }

  /* ---------------------------------------------------------------- the plan */

  // Each floor's dots made once while the walk is open (the works hung on
  // it change them; you do not: your tile is laid over them as they are drawn).
  function planDotsFor(fi) {
    var s = S, fl = s.world.floors[fi];
    s.planCache = s.planCache || {};
    if (s.planCache[fi]) { return s.planCache[fi]; }
    var ext = s.ctx.extDots || null;
    var d = s.planCache[fi] = P().planDots(s.world, fi, ext, null, fl.z + CUT, undefined, null, s.hung);
    return d;
  }

  /* The roof comes off: from the building, the model drawn with shown
     easing from 1 down to the cut over CLOD_RISE, the floor's plan rising
     into the cut in the same frames; from the walk, the plan coming back
     down from where it swelled. It holds still on its diagonal. */
  function showPlan(from) {
    var s = S, now = performance.now(), still = s.host.still;
    s.planDots = planDotsFor(s.planFloor);
    var cut = s.planDots.cut === undefined ? 1 : s.planDots.cut;
    var want = isoNearest(s.heading);
    if (from === "building") {
      s.planAnim = still ? null : { from: 1, to: cut, t0: now, dur: s.host.CLOD_RISE };
      s.shown = still ? cut : 1;
      if (!still && Math.abs(angleTo(want - s.heading)) > 1e-3) {
        s.headAnim = { from: s.heading, to: s.heading + angleTo(want - s.heading), t0: now, dur: s.host.CLOD_RISE };
      } else { s.heading = want; }
    } else {
      s.shown = cut;
      s.heading = want;
    }
    setLevel("plan");
    s.plan.hidden = false;
    s.plan.style.transition = "none";
    if (from === "walk" && !still) {
      var o = youOnPlan();
      s.plan.style.transformOrigin = o ? o.x + "px " + o.y + "px" : "50% 50%";
      s.plan.style.transform = "scale(" + Math.pow(PHI, 3).toFixed(3) + ")";
      s.plan.style.opacity = "0";
      void s.plan.offsetWidth;
      s.plan.style.transition = "transform " + PHI.toFixed(3) + "s cubic-bezier(0.2, 0.7, 0.2, 1), opacity " + PHI.toFixed(3) + "s ease";
      s.plan.style.transform = "";
      s.plan.style.opacity = "";
      s.toClose.push(window.setTimeout(function () {
        if (S === s && s.level === "plan") { s.box.hidden = true; }
      }, PHI * 1000));
    } else {
      s.plan.style.transform = "";
      s.plan.style.opacity = "";
      s.box.hidden = true;
    }
    s.label.hidden = true;
    clearNames("walk");
    clearNames("choose");
    s.planDirty = true;
    planDraw(now);
    underline("plan");
    wake();
  }

  function planStep(now) {
    var s = S;
    if (s.planAnim) {
      var a = s.planAnim, q = clamp((now - a.t0) / a.dur, 0, 1);
      s.shown = a.from + (a.to - a.from) * ease(q);
      s.planDirty = true;
      if (q >= 1) {
        s.shown = a.to;
        s.planAnim = null;
        if (a.then) { a.then(); }
      }
    }
    if (s.headAnim) {
      var h = s.headAnim, k = clamp((now - h.t0) / h.dur, 0, 1);
      s.heading = h.from + (h.to - h.from) * ease(k);
      s.planDirty = true;
      if (k >= 1) { s.heading = h.to; s.headAnim = null; }
    }
  }

  function planDraw(now) {
    var s = S;
    if (!s.planDots) { return; }
    var t0 = performance.now();
    s.frame = planPaint(s.plan, s.planDots, s.heading, s.shown === undefined ? s.planDots.cut : s.shown, PLAN_FIT);
    planOver();
    s.planMs = performance.now() - t0;
    var ps = s.planStats;
    ps.frames += 1; ps.total += s.planMs; ps.max = Math.max(ps.max, s.planMs);
    s.planDrawn = now;
    s.planDirty = false;
    planNames();
  }

  /* The plan level, painted exactly as Models.draw paints it — the same
     frame, the same squares, the same order back to front — but straight
     into the canvas's pixels, and with the order kept while the heading
     holds: the roof coming off is some 40,000 dots twelve times a second,
     and a phone was drawing it at four. Returns the frame, as draw does. */
  var paint = { dots: null, orders: [], order: null, img: null, inks: {} };
  function planPaint(canvas, dots, heading, shown, fit) {
    var f = M().frame(canvas, dots, heading, fit);
    var w = canvas.width, h = canvas.height, g = canvas.getContext("2d");
    var n = dots.count, k;
    // Back to front, sorted once for each of the four diagonals and kept:
    // while a drag turns it between them, the nearest diagonal's order
    // stands (a few dots out of order for a moment, not 40,000 sorted a frame).
    var diag = isoNearest(heading), dk = Math.round((diag - TAU / 8) / (TAU / 4)) & 3;
    if (paint.dots !== dots) { paint.dots = dots; paint.orders = []; }
    paint.order = paint.orders[dk];
    if (!paint.order) {
      // Ties in the dots' own order (a stable sort, as draw's is), so any set of them keeps draw's order.
      var key = new Float32Array(n), order = new Uint32Array(n), dc = Math.cos(diag), ds = Math.sin(diag);
      for (k = 0; k < n; k += 1) {
        key[k] = (dots.x[k] * ds + dots.y[k] * dc) * f.ct + dots.z[k] * f.st;
        order[k] = k;
      }
      order.sort(function (a, b) { return key[a] - key[b]; });
      paint.order = paint.orders[dk] = order;
    }
    if (!paint.img || paint.img.width !== w || paint.img.height !== h) {
      paint.img = g.createImageData(w, h);
      paint.buf = new Uint32Array(paint.img.data.buffer);
    }
    var buf = paint.buf, inks = paint.inks, ord = paint.order;
    buf.fill(0);
    var cos = f.cos, sin = f.sin, st = f.st, ct = f.ct, scale = f.scale, cx0 = f.cx0, cy0 = f.cy0;
    var cover = Math.max(0.5, scale * 0.56);
    for (var t = 0; t < n; t += 1) {
      k = ord[t];
      if (dots.reveal[k] > shown) { continue; }
      var sx = cx0 + (dots.x[k] * cos - dots.y[k] * sin) * scale;
      var sy = cy0 + ((dots.x[k] * sin + dots.y[k] * cos) * st - dots.z[k] * ct) * scale;
      var r = Math.max(1, Math.ceil(dots.size[k] * cover));
      var x0 = Math.round(sx - r / 2), y0 = Math.round(sy - r / 2);
      var x1 = Math.min(w, x0 + r), y1 = Math.min(h, y0 + r);
      if (x0 < 0) { x0 = 0; }
      if (y0 < 0) { y0 = 0; }
      if (x0 >= x1 || y0 >= y1) { continue; }
      var c = dots.ink[k], u = inks[c];
      if (u === undefined) { var m = rgbOf(c, [0, 0, 0]); u = inks[c] = pack(m[0], m[1], m[2]); }
      for (var y = y0; y < y1; y += 1) {
        for (var o = y * w + x0, e = y * w + x1; o < e; o += 1) { buf[o] = u; }
      }
    }
    g.putImageData(paint.img, 0, 0);
    return f;
  }

  // Over the plan's dots: you, a lavender tile with a wedge the way you
  // face; and the room asked for, lit, until the next press.
  function planOver() {
    var s = S, g = s.plan.getContext("2d"), k = s.plan.width / (s.planRect.width || s.plan.width);
    var fl = s.world.floors[s.planFloor];
    function tile(x, y, z, size, ink) {
      var p = planPoint(x, y, z);
      if (!p) { return; }
      var n = Math.max(2, Math.round(size * k));
      g.fillStyle = ink;
      g.fillRect(Math.round(p.x * k - n / 2), Math.round(p.y * k - n / 2), n, n);
    }
    if (s.focusRoom && s.focusRoom.floor === s.planFloor) {
      var r = fl.rooms[s.focusRoom.index];
      if (r) { tile(r.cx, r.cy, fl.z + r.fz + 0.2, 13, s.host.LIGHT); }
    }
    if (s.me && s.me.floor === s.planFloor && s.planDots && s.planDots.plan) {
      var pitch = s.planDots.plan.pitch || 1, sz = Math.max(6, (s.frame ? s.frame.scale : 1) * pitch / (s.world.model ? s.world.model.v : 1) * 1.8 / k);
      tile(s.me.x, s.me.y, fl.z + 0.2, sz, s.host.LIGHT);
      tile(s.me.x + Math.cos(s.me.a) * pitch, s.me.y + Math.sin(s.me.a) * pitch, fl.z + 0.2, sz * 0.62, s.host.LILAC);
    }
  }

  // A point of the grid on the plan's canvas, in the page's own pixels.
  function planPoint(x, y, z) {
    var s = S, w = s.world, vx = w.model;
    if (!s.frame || !vx) { return null; }
    var m = P().toWorld(w, x, y);
    var px = (m[0] + vx.site[0] / 2) / vx.v - vx.nx / 2 - 0.5, py = (m[1] + vx.site[1] / 2) / vx.v - vx.ny / 2 - 0.5;
    var p = M().project(s.frame, px, py, z / vx.v);
    var k = s.planRect.width / s.plan.width;
    return { x: p.x * k, y: p.y * k, cx: s.planRect.left + p.x * k, cy: s.planRect.top + p.y * k };
  }

  function youOnPlan() {
    var s = S;
    if (!s.me) { return null; }
    var fl = s.world.floors[s.me.floor];
    return planPoint(s.me.x, s.me.y, fl.z + 0.2);
  }

  // Names on the plan: the door, the room you are in, and each room holding
  // placed saved works, with their count; waiting rather than overprinting.
  function planNames() {
    var s = S, fl = s.world.floors[s.planFloor], out = [];
    if (s.leaving || s.choosing) { clearNames("plan"); return; }
    var e = s.world.enter;
    if (e && e.floor === s.planFloor) {
      var pd = planPoint(e.door[0], e.door[1], fl.z + CUT);
      // Pressed: down where you stand, and back to the door, facing in.
      if (pd) {
        out.push({ key: "p:door", text: s.world.shell ? "A way in (ours)" : "The door", x: pd.x, y: pd.y, rank: 1, kind: "room", go: function () {
          descend(function () { glideTo({ x: e.x, y: e.y, floor: e.floor, face: e.a, key: "door" }); });
        } });
      }
    }
    var counts = {};
    s.hung.forEach(function (h) {
      if (h.floor !== s.planFloor) { return; }
      counts[h.room] = (counts[h.room] || 0) + 1;
    });
    var mine = s.me && s.me.floor === s.planFloor ? roomAt(s.world, s.me.floor, s.me.x, s.me.y) : null;
    var focus = s.focusRoom && s.focusRoom.floor === s.planFloor ? fl.rooms[s.focusRoom.index] : null;
    fl.rooms.forEach(function (r) {
      if (r.pseudo || !r.poly) { return; }
      var n = counts[r.index] || 0;
      if (!n && r !== mine && r !== focus) { return; }
      if (r === focus && r !== mine) {
        // The room asked for is named before any other.
        var pf = planPoint(r.cx, r.cy, fl.z + r.fz + CUT);
        if (pf) {
          out.push({ key: "p:" + r.id, text: roomWords(r) + (n ? " · " + n : ""), x: pf.x, y: pf.y, rank: -1, kind: "room",
                     room: r, go: function () { planRoom(r); } });
        }
        return;
      }
      var p = planPoint(r.cx, r.cy, fl.z + r.fz + CUT);
      if (!p) { return; }
      var text = roomWords(r) + (n ? " · " + n : "");
      // The room you are in is only said: it would lie over the rooms round
      // you, which are the ones a press would want.
      out.push({ key: "p:" + r.id, text: text, x: p.x, y: p.y, rank: r === mine ? 0 : 2 + 1 / (n + 1), kind: "room",
                 passive: r === mine, room: r === mine ? null : r, go: function () { planRoom(r); } });
    });
    placeNames(out, "plan", s.planRect.left - s.rootRect.left, s.planRect.top - s.rootRect.top);
  }

  /* A press on the plan: your own tile goes down where you stand; a work's
     tile goes down and walks to it; a room goes down and walks in at its
     door, facing along it; a room nobody has found a way into says so. */
  function planTap(cx, cy) {
    var s = S, fl = s.world.floors[s.planFloor];
    if (s.leaving) { return; }
    clearNames("choose");
    if (s.focusRoom) { s.focusRoom = null; s.planDirty = true; wake(); }
    var you = s.me.floor === s.planFloor ? youOnPlan() : null;
    var dYou = you ? Math.hypot(cx - you.cx, cy - you.cy) : Infinity;
    // Under a finger the rooms are a few pixels each: where a press could
    // mean more than one, they are offered as names to choose from.
    if (coarse() && choose(cx, cy, you, dYou)) { return; }
    // On a phone a room is a few pixels (the National Gallery is a pixel a
    // metre), so what is right under the press comes first: your own tile,
    // a work's tile, the room under it; then what is near: you, a work, the
    // nearest room.
    if (dYou <= 6) { descend(); return; }
    var best = null, bd = 16;
    s.hung.forEach(function (h) {
      if (h.floor !== s.planFloor) { return; }
      var p = planPoint(h.cx, h.cy, Math.min(fl.z + CUT, (h.z0 + h.z1) / 2));
      if (!p) { return; }
      var d = Math.hypot(cx - p.cx, cy - p.cy);
      if (d < bd) { bd = d; best = h; }
    });
    if (best && bd <= 8) { goTo(best.id); return; }
    var mine = you ? roomAt(s.world, s.me.floor, s.me.x, s.me.y) : null;
    var hit = null, near = null, nd = 16;
    fl.rooms.forEach(function (r) {
      if (r.pseudo || !r.poly || hit) { return; }
      var poly = r.poly.map(function (p) { var q = planPoint(p[0], p[1], fl.z + r.fz); return q ? [q.cx, q.cy] : [NaN, NaN]; });
      if (inPoly(poly, cx, cy)) { hit = r; return; }
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        var d = segDist(cx, cy, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
        if (d < nd) { nd = d; near = r; }
      }
    });
    if (hit && hit !== mine) { planRoom(hit); return; }
    if (dYou <= 22 || (hit && hit === mine)) { descend(); return; }
    if (best) { goTo(best.id); return; }
    if (near && near !== mine) { planRoom(near); }
  }

  function coarse() {
    return window.innerWidth <= 720 || !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  }

  // The rooms within a finger's reach of a press (and you, if you are),
  // nearest first; offered as a stack of names, 44 px each, when there is
  // more than one. Returns whether it offered them.
  function choose(cx, cy, you, dYou, first) {
    var s = S, fl = s.world.floors[s.planFloor], REACH = 22, list = [];
    var counts = {};
    s.hung.forEach(function (h) { if (h.floor === s.planFloor) { counts[h.room] = (counts[h.room] || 0) + 1; } });
    var mine = you ? roomAt(s.world, s.me.floor, s.me.x, s.me.y) : null;
    fl.rooms.forEach(function (r) {
      if (r.pseudo || !r.poly || r === mine) { return; }
      var poly = r.poly.map(function (pt) { var q = planPoint(pt[0], pt[1], fl.z + r.fz); return q ? [q.cx, q.cy] : [NaN, NaN]; });
      var d = inPoly(poly, cx, cy) ? 0 : Infinity;
      for (var i = 0, j = poly.length - 1; i < poly.length && d > 0; j = i, i += 1) {
        d = Math.min(d, segDist(cx, cy, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
      }
      if (d <= REACH && (r.name || counts[r.index])) { list.push({ r: r, d: d - (counts[r.index] ? 4 : 0) }); }
    });
    if (dYou <= REACH) { list.push({ you: true, d: dYou }); }
    if (first) {
      list = list.filter(function (c) { return c.r !== first; });
      list.unshift({ r: first, d: -Infinity });
    }
    if (list.length < 2) { return false; }
    list.sort(function (a, b) { return a.d - b.d; });
    list = list.slice(0, 5);
    // Stacked round the press, kept within the walk's own band (never over the strip).
    var rr = s.rootRect || s.root.getBoundingClientRect(), STEP_Y = 46, tall = list.length * STEP_Y;
    var x = cx - rr.left, top = clamp(cy - rr.top - tall / 2, 8, Math.max(8, rr.height - tall - 8));
    var out = list.map(function (c, k) {
      var y = top + 22 + k * STEP_Y;
      if (c.you) { return { key: "c:you", text: "Where you are", x: x, y: y, rank: k, kind: "room", go: function () { clearNames("choose"); descend(); } }; }
      var n = counts[c.r.index] || 0;
      return { key: "c:" + c.r.id, text: roomWords(c.r) + (n ? " · " + n : ""), x: x, y: y, rank: k, kind: "room",
               go: function () { clearNames("choose"); planRoom(c.r); } };
    });
    placeNames(out, "choose", 0, 0);
    clearNames("plan");
    s.choosing = true;
    return true;
  }

  function inPoly(p, x, y) {
    var ins = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
      var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) { ins = !ins; }
    }
    return ins;
  }

  // A room pressed on the plan: walked to where a way is known from where
  // you are; else, if it holds saved works, put into; else said so.
  function planRoom(r) {
    var target = roomTarget(r);
    if (target) { descend(function () { glideTo(target); }); return; }
    if (holdsWorks(r)) { placeIn(r); return; }
    noWayIn(r);
  }

  // Just inside a room's door, facing along it: the way there cut where it
  // first comes into the room, a metre and a half on.
  function roomTarget(r) {
    var s = S, W = P();
    var fl = s.world.floors[r.floor];
    var goal = nearestFree(fl, r.cx, r.cy, r.index);
    if (!goal) { return null; }
    var path = W.path(s.world, { x: s.me.x, y: s.me.y, floor: s.me.floor }, { x: goal[0], y: goal[1], floor: r.floor });
    if (!path) { return null; }
    var pts = densify(path), stop = pts[pts.length - 1];
    for (var k = 0; k < pts.length; k += 1) {
      var p = pts[k];
      if (p[2] !== r.floor) { continue; }
      var rm = roomAt(s.world, p[2], p[0], p[1]);
      if (rm === r) { stop = pts[Math.min(pts.length - 1, k + 3)]; break; }
    }
    var long = (r.bbox[2] - r.bbox[0]) >= (r.bbox[3] - r.bbox[1]) ? [1, 0] : [0, 1];
    var into = [r.cx - stop[0], r.cy - stop[1]];
    if (long[0] * into[0] + long[1] * into[1] < 0) { long = [-long[0], -long[1]]; }
    return { x: stop[0], y: stop[1], floor: stop[2], face: Math.atan2(long[1], long[0]), room: r };
  }

  // The path's points every half metre, so where it enters a room is seen.
  function densify(path) {
    var out = [path[0]];
    for (var i = 1; i < path.length; i += 1) {
      var a = path[i - 1], b = path[i];
      if (a[2] !== b[2]) { out.push(b); continue; }
      var L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.5));
      for (var k = 1; k <= n; k += 1) { out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, b[2]]); }
    }
    return out;
  }

  // The walkable cell nearest a point, in a room if one is given.
  function nearestFree(fl, x, y, ri) {
    var W = P(), clear = W.clearance(fl), best = null, bd = Infinity;
    var i0 = Math.floor((x - fl.x0) / fl.cell), j0 = Math.floor((y - fl.y0) / fl.cell), R = Math.ceil(12 / fl.cell);
    for (var r = 0; r <= R && !best; r += 1) {
      for (var dj = -r; dj <= r; dj += 1) {
        for (var di = -r; di <= r; di += 1) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) { continue; }
          var i = i0 + di, j = j0 + dj;
          if (i < 0 || j < 0 || i >= fl.gw || j >= fl.gh) { continue; }
          var q = j * fl.gw + i;
          if (!W.walkable(fl, q) || clear[q] < 0.25 || (ri !== undefined && fl.room[q] !== ri)) { continue; }
          var d = di * di + dj * dj;
          if (d < bd) { bd = d; best = W.centreOf(fl, q); }
        }
      }
    }
    return best;
  }

  // "No way into Gallery 85 is known yet": said on the plan, the room
  // named before any other and lit until the next press, a pulse over it
  // as big as it is on the screen.
  function noWayIn(r) {
    var s = S;
    if (s.level !== "plan") { toPlan(); }
    if (s.planFloor !== r.floor) { floorTo(r.floor); }
    s.focusRoom = { floor: r.floor, index: r.index };
    s.planDirty = true;
    planDraw(performance.now());
    var p = planPoint(r.cx, r.cy, s.world.floors[r.floor].z + r.fz + CUT);
    if (p) { s.host.pulse(p.cx, p.cy, [s.host.LIGHT, s.host.LILAC], 0.8, reachOf(r)); }
    var words = "No way into " + (r.name || "this room") + " is known yet";
    say(words);
  }

  // A room's size on the plan, for a pulse over it: its outline's diagonal.
  function reachOf(r) {
    var fl = S.world.floors[r.floor], x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    (r.poly || []).forEach(function (pt) {
      var q = planPoint(pt[0], pt[1], fl.z + r.fz);
      if (q) { x0 = Math.min(x0, q.cx); y0 = Math.min(y0, q.cy); x1 = Math.max(x1, q.cx); y1 = Math.max(y1, q.cy); }
    });
    return isFinite(x0) ? clamp(Math.hypot(x1 - x0, y1 - y0), 20, 120) : 60;
  }

  /* Into a room nobody has found the way into yet, that holds saved works:
     a cut, as the lift is, with no doorway drawn — you are put there, and
     the banner says so ('no way in is known yet · placed here'). From
     there you walk the room, and whatever joins it. */
  function placeIn(r, t) {
    var s = S, fl = s.world.floors[r.floor];
    var spot = t ? [t.x, t.y] : nearestFree(fl, r.cx, r.cy, r.index);
    if (!spot) { noWayIn(r); return false; }
    if (s.level === "look") { unlook(true); }
    stopGlide();
    stand(null);
    s.turnTo = null;
    s.focusRoom = null;
    clearNames("choose");
    var me = s.me;
    me.floor = r.floor; me.x = spot[0]; me.y = spot[1]; me.z = me.zTo = floorZ(r.floor, me.x, me.y);
    if (t && t.face !== undefined) { me.a = t.face; }
    else {
      var long = (r.bbox[2] - r.bbox[0]) >= (r.bbox[3] - r.bbox[1]) ? [1, 0] : [0, 1];
      me.a = Math.atan2(long[1], long[0]);
    }
    s.planFloor = r.floor;
    s.lastRoom = null;
    s.dirty = true;
    if (s.level === "plan") {
      s.planDirty = true;
      descend();
    } else {
      if (!s.host.still) {
        s.host.sweepCells(s.host.oneOf(["edges", "center", "corner", "rows"]), [cssOf(r.tone || [180, 170, 150]), s.host.LIGHT, s.host.LILAC], 820);
      }
      onRoom(performance.now());
      wake();
    }
    if (t) { arrived(t); } else { settleOut(); where(); }
    return true;
  }
  function holdsWorks(r) {
    return S.hung.some(function (h) { return h.floor === r.floor && h.room === r.index; });
  }

  // A line under the banner's, for a moment: what could not be done.
  function say(words) {
    var s = S, u = s.host.banner.under;
    if (!u) { return; }
    u.hidden = false;
    u.textContent = words;
    s.host.scramble(u, "decode");
    s.sayUntil = performance.now() + 4000;
    s.toClose.push(window.setTimeout(function () {
      if (S === s && performance.now() >= s.sayUntil - 10) { underline(s.level === "plan" ? "plan" : "walk", true); }
    }, 4000));
  }

  // The nearest floor above (dir 1) or below (−1) the plan's, or null.
  function floorNext(dir) {
    var s = S;
    if (!s || !s.world) { return null; }
    var fl = s.world.floors[s.planFloor], next = null;
    s.world.floors.forEach(function (o) {
      if (dir > 0 ? o.z > fl.z : o.z < fl.z) {
        if (!next || Math.abs(o.z - fl.z) < Math.abs(next.z - fl.z)) { next = o; }
      }
    });
    return next;
  }
  function floorButtons() {
    var s = S;
    var box = s && s.root && s.root.querySelector(".walk-floors");
    if (!box) { return; }
    var on = !!(s.world && s.world.floors.length > 1 && s.level === "plan");
    box.hidden = !on;
    if (!on) { return; }
    Array.prototype.forEach.call(box.children, function (b) {
      var nx = floorNext(b.dataset.dir === "up" ? 1 : -1);
      b.disabled = !nx;
      b.setAttribute("aria-label", nx ? (b.dataset.dir === "up" ? "Up to " : "Down to ") + floorName(nx)
        : (b.dataset.dir === "up" ? "No floor above" : "No floor below"));
    });
  }

  function floorTo(fi) {
    var s = S;
    if (s.leaving) { return; }
    if (fi < 0 || fi >= s.world.floors.length || fi === s.planFloor) { return; }
    var was = s.planDots ? s.planDots.cut : 1;
    s.planFloor = fi;
    s.planDots = planDotsFor(fi);
    var cut = s.planDots.cut;
    if (s.host.still) { s.shown = cut; } else { s.planAnim = { from: was, to: cut, t0: performance.now(), dur: 610 }; s.shown = was; }
    s.planDirty = true;
    underline("plan");
    floorButtons();
    wake();
  }

  /* ---------------------------------------------------------------- levels */

  function setLevel(lv) {
    var s = S;
    if (s.level === lv) { return; }
    s.level = lv;
    s.root.dataset.level = lv;
    floorButtons();
    if (s.ctx.onLevel) { s.ctx.onLevel(lv); }
  }

  // Down from the plan: the first frame is drawn beneath, the plan swells
  // about your tile and goes, the walk is uncovered by one of the arrivals
  // that need no picture, and a pulse goes out from where you stand.
  function descend(then) {
    var s = S;
    if (!s || s.leaving) { return; }
    if (s.level === "walk" || s.level === "look") { if (then) { then(); } return; }
    var still = s.host.still;
    if (s.planFloor !== s.me.floor) { s.planFloor = s.me.floor; }
    var o = youOnPlan();
    s.box.hidden = false;
    s.dirty = true;
    s.focusRoom = null;
    clearNames("choose");
    setLevel("walk");
    draw(performance.now());
    clearNames("plan");
    if (!still) {
      s.plan.style.transition = "none";
      s.plan.style.transformOrigin = o ? o.x + "px " + o.y + "px" : "50% 50%";
      void s.plan.offsetWidth;
      s.plan.style.transition = "transform " + PHI.toFixed(3) + "s cubic-bezier(0.4, 0, 0.8, 0.6), opacity " + PHI.toFixed(3) + "s ease";
      s.plan.style.transform = "scale(" + Math.pow(PHI, 3).toFixed(3) + ")";
      s.plan.style.opacity = "0";
      s.toClose.push(window.setTimeout(function () {
        if (S === s && s.level !== "plan") { s.plan.hidden = true; }
      }, PHI * 1000 + 40));
      var how = s.host.oneOf(DESCENT_ARRIVALS);
      if (s.host.ARRIVALS[how]) { s.host.ARRIVALS[how](s.box, 0); }
      if (o) { s.host.pulse(o.cx, o.cy, [s.host.LIGHT, s.host.LILAC], 0.9); }
    } else {
      s.plan.hidden = true;
    }
    s.lastRoom = null;
    onRoom(performance.now());
    wake();
    if (then) { then(); }
  }

  // Up to the plan: you are left as a lit tile where you stood.
  function toPlan() {
    var s = S;
    if (s.level === "look") { unlook(true); }
    stopGlide();
    s.keys = {};
    s.drag = null;
    // Nothing of the walk's may keep the frames coming on the plan.
    s.turnTo = null;
    s.picBusy = false;
    if (s.me && s.me.zTo !== undefined) { s.me.z = s.me.zTo; }
    stand(null);
    s.planFloor = s.me.floor;
    showPlan("walk");
    where();
  }

  // Up from the plan: the roof settles back over φ s, and the building is
  // land.js's again.
  function toBuilding() {
    var s = S;
    // Leaving: while the roof settles back, nothing on the plan answers a
    // press, and its names do not come back.
    s.leaving = true;
    clearNames("plan");
    clearNames("choose");
    if (s.host.still) { finish(); return; }
    s.planAnim = { from: s.shown, to: 1, t0: performance.now(), dur: PHI * 1000, then: finish };
    s.planDirty = true;
    wake();
    function finish() {
      if (S !== s) { return; }
      var out = s.ctx.onOut;
      close();
      if (out) { out("up"); }
    }
  }

  function up() {
    var s = S;
    if (!s || !s.world) { return; }
    if (s.level === "look") { unlook(); return; }
    if (s.level === "walk") { toPlan(); return; }
    if (s.level === "plan" && !s.planAnim) { toBuilding(); }
  }

  function down(x, y) {
    var s = S;
    if (!s || !s.world || s.leaving) { return; }
    if (s.level === "plan") { if (!s.planAnim || s.planAnim.to !== 1) { descend(); } return; }
    if (s.level === "walk") {
      var h = s.standing || facing(x, y);
      if (h) { look(h); }
      return;
    }
    if (s.level === "look") { zoom(); }
  }

  // The work you face, near enough to look at; or the one under a point.
  function facing(x, y) {
    var s = S;
    if (x !== undefined && s.caster && s.cam) {
      var hit = pickAt(x, y);
      if (hit && hit.kind === PICK_WORK) {
        var h = s.hung[hit.i];
        if (Math.hypot(h.cx - s.me.x, h.cy - s.me.y) <= LOOK_NEAR) { return h; }
      }
    }
    return standable(true);
  }

  /* ---------------------------------------------------------------- the banner */

  var QUIET_LINE = true;   // false: the under-line says again how each room is known

  // Under the banner: the floor and how it is known on the plan; the floor,
  // the room and how it is known in the walk; the room part scrambled in.
  function underline(level, quiet) {
    var s = S, u = s.host.banner.under;
    if (!u) { return; }
    var text;
    // Only where you are: the floor and the room by its name (artist, 7 Oct 2026, of MoMA's shell, its line
    // "Inside · nothing is known yet · the walls are the model's, the way in ours": "Get rid of this text when
    // I'm inside"). How each is known — documented, reconstructed, the rule's way in — is kept for the column
    // and the plan's sources, never written over the walk.
    if (QUIET_LINE) {
      if (s.world.shell) { text = ""; }
      else if (level === "plan") { text = floorName(s.world.floors[s.planFloor]); }
      else {
        var rq = roomAt(s.world, s.me.floor, s.me.x, s.me.y), fq = s.world.floors[s.me.floor];
        var nm = rq && !rq.pseudo && rq.name ? rq.name : "";
        text = floorName(fq) + (nm ? " · " + nm : "");
      }
    } else if (s.world.shell) {
      // A shell's way in is ours (the rule's, on the model), not the museum's door.
      text = "Inside · nothing is known yet · the walls are the model's, the way in ours";
    } else if (level === "plan") {
      var fl = s.world.floors[s.planFloor];
      var src = (fl.src || []).filter(function (id) { return id !== "model"; })[0];
      var how = src ? "rooms from " + sourceWords(s.world, src) : "rooms reconstructed from the model";
      text = floorName(fl) + " · " + how;
    } else {
      var r = roomAt(s.world, s.me.floor, s.me.x, s.me.y), f2 = s.world.floors[s.me.floor];
      if (r && r.pseudo === "stair") {
        var st = s.world.stairs[r.stair], other = st ? s.world.floors[st.from === s.me.floor ? st.to : st.from] : null;
        text = floorName(f2) + " · " + (r.name || "Stairs to the " + floorName(other)) + " · " + (st && st.sure || "reconstructed");
      } else if (r && r.pseudo === "lift") {
        text = floorName(f2) + " · by the lift";
      } else if (r && r.pseudo === "outside") {
        text = floorName(f2) + " · outside, at the door · " + (s.world.enter.sure || "reconstructed");
      } else {
        text = floorName(f2) + " · " + roomWords(r) + " · " + ((r && r.sure) || "not known");
        text += heightWords(r);
        // Put in a room nobody has found the way into yet: said, every time.
        if (r && !r.pseudo && !r.reach) { text += " · no way in is known yet · placed here"; }
      }
    }
    u.setAttribute("aria-live", "polite");
    u.hidden = !text;
    if (u.textContent === text) { return; }
    u.textContent = text;
    if (!quiet) { s.host.scramble(u, "decode"); }
  }

  // How a room's height is known, where its file gives none: the model's
  // roof over it (the auto ceiling, a dome, a skylight, a vault), or, where
  // the model has nothing over it, not known at all.
  function heightWords(r) {
    if (!r || r.pseudo || r.h !== null || r.ceil === "sky") { return ""; }
    // On a phone the line is kept to what matters most; the height waits for a wider screen.
    if (window.innerWidth <= 720) { return ""; }
    if (r.ceil === "dark" || r.autoH === null || r.autoH === undefined) { return ", its height not known"; }
    return ", its height the model's";
  }

  /* ---------------------------------------------------------------- moving */

  function step(dt, now) {
    var s = S, me = s.me, k = s.keys;
    if (!s.world) { return; }
    var fwd = 0, side = 0, turn = 0, speed = k.fast ? BRISK : PACE;
    if (k.f) { fwd += 1; }
    if (k.b) { fwd -= 1; }
    if (k.l) { turn -= 1; }
    if (k.r) { turn += 1; }
    if (k.sl) { side -= 1; }
    if (k.sr) { side += 1; }
    var moved = false;
    if (fwd || side || turn) {
      stopGlide(); s.turnTo = null;
      me.a = angleTo(me.a + turn * KEY_TURN * dt);
      if (fwd || side) {
        var dx = (Math.cos(me.a) * fwd - Math.sin(me.a) * side) * speed * dt;
        var dy = (Math.sin(me.a) * fwd + Math.cos(me.a) * side) * speed * dt;
        move(dx, dy);
      }
      moved = true;
    } else if (s.drag && s.drag.walking) {
      var v = s.drag.speed;
      if (v) {
        move(Math.cos(me.a) * v * dt, Math.sin(me.a) * v * dt);
        moved = true;
      }
    } else if (s.glide) {
      glideStep(now, dt);
      moved = true;
    } else if (s.turnTo !== null) {
      var da = angleTo(s.turnTo - me.a), m = TURN * dt;
      me.a = Math.abs(da) <= m ? s.turnTo : me.a + (da > 0 ? m : -m);
      if (me.a === s.turnTo) { s.turnTo = null; }
      moved = true;
    }
    // Up and down stairs, the eye following the treads.
    var zTo = floorZ(me.floor, me.x, me.y);
    me.zTo = zTo;
    if (Math.abs(zTo - me.z) > 0.001) { me.z += (zTo - me.z) * Math.min(1, dt * 14); s.dirty = true; } else { me.z = zTo; }
    if (moved) {
      s.dirty = true;
      s.stillSince = 0;
      s.standChecked = false;
      settleFloor();
      onRoom(now);
    } else if (!s.stillSince) {
      s.stillSince = now;
      where();
    }
  }

  // Walls, glass, voids, what is closed and what a source puts on the floor
  // stop you; a step of more than 0.35 m stops you; a freestanding work keeps
  // you 0.4 m off. Four points round you, sliding along a wall a way at a time.
  // The points tested: four at the corners (a hair inside, so a walker
  // flush with a wall is not in it); and where the grid's cell is smaller
  // than the walker, the middles of its sides too, so a wall one cell thick
  // cannot be straddled.
  var AT4 = [[-1, -1], [1, -1], [-1, 1], [1, 1]], AT8 = AT4.concat([[0, -1], [0, 1], [-1, 0], [1, 0]]);
  function free(fl, x, y, z) {
    var W = P(), r = RADIUS - 0.002, at = fl.cell < 2 * RADIUS ? AT8 : AT4;
    for (var k = 0; k < at.length; k += 1) {
      var q = W.cellAt(fl, x + at[k][0] * r, y + at[k][1] * r);
      if (q < 0 || fl.kind[q] !== W.FLOOR) { return false; }
      if (Math.abs(fl.fh[q] / 100 - z) > STEP) { return false; }
      if (fl.ch[q] - fl.fh[q] < HEAD * 100) { return false; }
    }
    for (var i = 0; i < S.hung.length; i += 1) {
      var h = S.hung[i];
      if (!h.free || h.floor !== fl.index) { continue; }
      if (segDist(x, y, h.x0, h.y0, h.x1, h.y1) < 0.4 + RADIUS * 0.5) { return false; }
    }
    return true;
  }
  // How far a point is from the nearest cell that cannot be walked, up to a metre.
  function gap(fl, x, y) {
    var W = P(), c = fl.cell, best = 1;
    var i0 = Math.floor((x - 1 - fl.x0) / c), i1 = Math.floor((x + 1 - fl.x0) / c);
    var j0 = Math.floor((y - 1 - fl.y0) / c), j1 = Math.floor((y + 1 - fl.y0) / c);
    for (var j = j0; j <= j1; j += 1) {
      for (var i = i0; i <= i1; i += 1) {
        var q = i < 0 || j < 0 || i >= fl.gw || j >= fl.gh ? -1 : j * fl.gw + i;
        if (q >= 0 && W.walkable(fl, q)) { continue; }
        var ax = fl.x0 + i * c, ay = fl.y0 + j * c;
        var ddx = x < ax ? ax - x : x > ax + c ? x - ax - c : 0, ddy = y < ay ? ay - y : y > ay + c ? y - ay - c : 0;
        best = Math.min(best, Math.hypot(ddx, ddy));
      }
    }
    return best;
  }

  // Out of any wall you have come to rest a hair into: the nearest place
  // within 0.4 m where you stand free.
  function settleOut() {
    var s = S, me = s.me, fl = s.world.floors[me.floor], z = floorZ(me.floor, me.x, me.y);
    if (free(fl, me.x, me.y, z)) { return; }
    for (var r = 0.05; r <= 0.4 + 1e-9; r += 0.05) {
      for (var k = 0; k < 16; k += 1) {
        var a = k * TAU / 16, x = me.x + Math.cos(a) * r, y = me.y + Math.sin(a) * r;
        if (free(fl, x, y, floorZ(me.floor, x, y))) { me.x = x; me.y = y; s.dirty = true; return; }
      }
    }
  }

  function segDist(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
    var t = L ? clamp(((px - ax) * vx + (py - ay) * vy) / L, 0, 1) : 0;
    return Math.hypot(px - ax - vx * t, py - ay - vy * t);
  }

  function move(dx, dy) {
    var s = S, me = s.me, fl = s.world.floors[me.floor], z = floorZ(me.floor, me.x, me.y);
    var went = 0, blocked = false;
    // Already against a wall (a glide may end a hair into one): any step
    // that takes you further from it is let through, so you are never stuck.
    var stuck = !free(fl, me.x, me.y, z), was = stuck ? gap(fl, me.x, me.y) : 0;
    function ok(x, y, zz) { return free(fl, x, y, zz) || (stuck && gap(fl, x, y) > was + 1e-6); }
    if (Math.abs(dx) > 1e-9) {
      if (ok(me.x + dx, me.y, z)) { me.x += dx; went += Math.abs(dx); } else { blocked = true; }
    }
    if (Math.abs(dy) > 1e-9) {
      if (ok(me.x, me.y + dy, floorZ(me.floor, me.x, me.y))) { me.y += dy; went += Math.abs(dy); } else { blocked = true; }
    }
    // Stopped at the edge of the ground before the door, going away from it: out.
    if (blocked) { outward(dx, dy); }
    if (went) { stride(went); }
  }

  // Walking back out through the door: out beyond the ground before it,
  // away from the building, is the building again.
  function outward(dx, dy) {
    var s = S, me = s.me, W = P(), fl = s.world.floors[me.floor];
    var r = roomAt(s.world, me.floor, me.x, me.y);
    if (!r || r.pseudo !== "outside") { return; }
    var e = s.world.enter;
    var ax = me.x - e.door[0], ay = me.y - e.door[1];
    if (ax * dx + ay * dy <= 0) { return; }
    var q = W.cellAt(fl, me.x + dx * 4 + Math.sign(dx) * RADIUS, me.y + dy * 4 + Math.sign(dy) * RADIUS);
    if (q >= 0 && (fl.kind[q] === W.WALL || fl.kind[q] === W.GLASS)) { return; }
    leave();
  }

  function leave() {
    var s = S;
    var out = s.ctx.onOut;
    s.toClose.push(window.setTimeout(function () {
      if (S !== s) { return; }
      close();
      if (out) { out("door"); }
    }, 0));
    s.keys = {};
  }

  // A tick at each stride when the sound is on, brighter on stone, lower on wood.
  function stride(d) {
    var s = S, now = performance.now();
    s.walked += d;
    if (s.walked < STRIDE) { return; }
    s.walked = 0;
    // A glide may go at many strides a second: its steps are heard at most two a second.
    if (s.glide && now - (s.tickAt || 0) < 500) { return; }
    s.tickAt = now;
    var snd = window.Systems && window.Systems.sound;
    if (!snd || !snd.on || !snd.step) { return; }
    var r = roomAt(s.world, s.me.floor, s.me.x, s.me.y);
    snd.step(r && r.mats ? r.mats.floor : null);
  }

  // On a stair, past its middle the grid you walk on is the other floor's.
  function settleFloor() {
    var s = S, me = s.me, W = P();
    var fl = s.world.floors[me.floor], q = W.cellAt(fl, me.x, me.y);
    if (q < 0) { return; }
    if (fl.stair[q] >= 0) {
      var st = s.world.stairs[fl.stair[q]], other = st.from === me.floor ? st.to : st.from;
      var of = s.world.floors[other], z = fl.fh[q] / 100, mid = (st.low + st.high) / 2;
      var upper = of.z > fl.z;
      if ((upper && z > mid) || (!upper && z < mid)) {
        var oq = W.cellAt(of, me.x, me.y);
        if (oq >= 0 && of.stair[oq] === st.index) { me.floor = other; s.planFloor = other; s.lastRoom = null; }
      }
    }
  }

  // A lift: its floors' names; pressing one sweeps and puts you there.
  function liftTo(fi) {
    var s = S, me = s.me, W = P();
    var fl = s.world.floors[me.floor], q = W.cellAt(fl, me.x, me.y);
    var li = q >= 0 ? fl.lift[q] : -1;
    if (li < 0) { return; }
    var lf = s.world.lifts[li], to = s.world.floors[fi];
    // In the tones of the room the lift stands in (the lift itself is only its cells).
    var r = s.realRoom;
    s.host.sweepCells(s.host.oneOf(["edges", "center", "corner", "rows"]), [cssOf((r && r.tone) || [180, 170, 150]), s.host.LIGHT, s.host.LILAC], 820);
    me.floor = fi;
    me.x = (lf.rect[0] + lf.rect[2]) / 2; me.y = (lf.rect[1] + lf.rect[3]) / 2;
    me.z = floorZ(fi, me.x, me.y);
    s.planFloor = fi;
    s.lastRoom = null;
    void to;
    s.dirty = true;
    onRoom(performance.now());
    wake();
  }

  // Into another room: the banner says which and how it is known, and a
  // pulse goes out from the doorway in its walls' tone and the light.
  function onRoom(now) {
    var s = S, r = roomAt(s.world, s.me.floor, s.me.x, s.me.y);
    var key = s.me.floor + ":" + (r ? r.index : -1);
    if (key === s.lastRoom) { return; }
    var first = s.lastRoom === null;
    s.lastRoom = key;
    if (r && !r.pseudo) { s.realRoom = r; }
    underline("walk");
    s.view.setAttribute("aria-label", "Inside " + ((s.ctx.museum && s.ctx.museum.name) || "the museum") + ", " + roomWords(r));
    if (!first && r && !r.pseudo && !s.host.still) {
      var b = s.box.getBoundingClientRect();
      s.host.pulse(b.left + b.width / 2, b.top + b.height * 0.86, [cssOf(r.tone || [180, 170, 150]), s.host.LIGHT], 0.7);
    }
    where();
    void now;
  }

  // Where you are, for land.js to keep for the visit (never in the address).
  function where() {
    var s = S;
    if (!s.ctx.onWhere || !s.me) { return; }
    var r = roomAt(s.world, s.me.floor, s.me.x, s.me.y);
    s.ctx.onWhere({ floor: s.me.floor, x: s.me.x, y: s.me.y, a: s.me.a, room: r && !r.pseudo ? r.id : null });
  }

  /* ---------------------------------------------------------------- glides */

  // Walk there: the way over the floors' grids, eased in and out at
  // max(length / φ⁴ s, 1.4) m/s, so never longer than φ⁴ s, turning ahead, and stopping to face
  // the target. Every room passed is named in the banner as it is entered.
  function glideTo(t) {
    var s = S, W = P(), me = s.me;
    var same = s.glide && s.glide.key && s.glide.key === t.key;
    if (same) { arriveNow(); return true; }
    var path = W.path(s.world, { x: me.x, y: me.y, floor: me.floor }, { x: t.x, y: t.y, floor: t.floor });
    if (!path) { return false; }
    var pts = path, segs = [], L = 0;
    for (var i = 1; i < pts.length; i += 1) {
      var a = pts[i - 1], b = pts[i], len = a[2] === b[2] ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
      segs.push({ a: a, b: b, len: len, s0: L });
      L += len;
    }
    stand(null);
    s.turnTo = null;
    if (s.host.still || L < 0.01) {
      var end = pts[pts.length - 1];
      me.x = end[0]; me.y = end[1]; me.floor = end[2]; me.z = floorZ(end[2], me.x, me.y);
      me.a = t.face === undefined ? me.a : t.face;
      s.planFloor = me.floor;
      s.dirty = true;
      s.lastRoom = null;
      onRoom(performance.now());
      arrived(t);
      wake();
      return true;
    }
    // Never longer than φ⁴ s, whatever the distance (timing over a literal
    // pace): at least a walk's pace, faster the further it is.
    var speed = Math.max(L / GLIDE_SPAN, GLIDE_MIN);
    s.glide = { t: t, key: t.key || null, segs: segs, L: L, T: L / speed * 1000, t0: performance.now(), done: false };
    wake();
    return true;
  }

  function glideStep(now, dt) {
    var s = S, g = s.glide, me = s.me;
    var q = clamp((now - g.t0) / g.T, 0, 1), at = ease(q) * g.L;
    if (!g.done) {
      var seg = g.segs[0];
      for (var i = 0; i < g.segs.length; i += 1) { if (g.segs[i].s0 <= at + 1e-9) { seg = g.segs[i]; } }
      var k = seg.len ? clamp((at - seg.s0) / seg.len, 0, 1) : 1;
      var nx = seg.a[0] + (seg.b[0] - seg.a[0]) * k, ny = seg.a[1] + (seg.b[1] - seg.a[1]) * k;
      var wasFloor = me.floor, fromLift = liftAt(me);
      stride(Math.hypot(nx - me.x, ny - me.y));
      me.x = nx; me.y = ny;
      var f = seg.len ? seg.a[2] : seg.b[2];
      if (f !== me.floor) {
        me.floor = f;
        if (fromLift && seg.a[2] !== seg.b[2]) {
          s.host.sweepCells(s.host.oneOf(["edges", "center", "corner"]), [s.host.LIGHT, s.host.LILAC], 820);
        }
      }
      settleFloor();
      if (me.floor !== wasFloor) { s.planFloor = me.floor; }
      // Turning ahead, toward a point a metre and a half on.
      var ahead = pointAt(g, Math.min(g.L, at + 1.5));
      var want = ahead && Math.hypot(ahead[0] - me.x, ahead[1] - me.y) > 0.2 ? Math.atan2(ahead[1] - me.y, ahead[0] - me.x) : null;
      if (g.L - at < 1.2 && g.t.face !== undefined) { want = g.t.face; }
      if (want !== null) { me.a = turnToward(me.a, want, TURN * dt * 1.6); }
      if (q >= 1) { g.done = true; }
    } else {
      var face = g.t.face === undefined ? me.a : g.t.face;
      me.a = turnToward(me.a, face, TURN * dt);
      if (Math.abs(angleTo(face - me.a)) < 0.01) {
        me.a = face;
        s.glide = null;
        arrived(g.t);
      }
    }
    onRoom(now);
  }
  function liftAt(me) {
    var fl = S.world.floors[me.floor], q = P().cellAt(fl, me.x, me.y);
    return q >= 0 && fl.lift[q] >= 0;
  }
  function pointAt(g, at) {
    for (var i = 0; i < g.segs.length; i += 1) {
      var sg = g.segs[i];
      if (at <= sg.s0 + sg.len + 1e-9 && sg.len) {
        var k = clamp((at - sg.s0) / sg.len, 0, 1);
        return [sg.a[0] + (sg.b[0] - sg.a[0]) * k, sg.a[1] + (sg.b[1] - sg.a[1]) * k];
      }
    }
    var last = g.segs[g.segs.length - 1];
    return last ? [last.b[0], last.b[1]] : null;
  }
  function turnToward(a, want, m) {
    var da = angleTo(want - a);
    return Math.abs(da) <= m ? want : a + (da > 0 ? m : -m);
  }

  // A second press on what is being walked to: there at once, under a
  // passage of pixel cells.
  function arriveNow() {
    var s = S, g = s.glide, me = s.me;
    if (!g) { return; }
    var last = g.segs[g.segs.length - 1], end = last ? last.b : [g.t.x, g.t.y, g.t.floor];
    if (!s.host.still) {
      var tones = g.t.work && g.t.work.tones && g.t.work.tones.length ? g.t.work.tones.concat([s.host.LIGHT]) : [s.host.LIGHT, s.host.LILAC];
      s.host.passage(s.host.oneOf(["edges", "center", "corner", "rows"]), tones, 820);
    }
    me.x = end[0]; me.y = end[1]; me.floor = end[2]; me.z = floorZ(me.floor, me.x, me.y);
    if (g.t.face !== undefined) { me.a = g.t.face; }
    s.planFloor = me.floor;
    s.glide = null;
    s.dirty = true;
    onRoom(performance.now());
    arrived(g.t);
    wake();
  }

  function stopGlide() {
    var s = S;
    if (s && s.glide) { s.glide = null; s.dirty = true; }
  }

  function arrived(t) {
    var s = S;
    settleOut();
    s.dirty = true;
    if (t.work) {
      s.standing = null;
      s.stillSince = performance.now() - STILL_WAIT - 1;
      s.forceStand = t.work;
      if (t.then === "look") { s.toClose.push(window.setTimeout(function () { if (S === s) { look(t.work); } }, 60)); }
    }
    where();
    wake();
  }

  /* Go to a hung work: from the plan, down first; from the look, back to
     the walk; then walk to its viewing spot, turn to it, and read it — the
     thread it was come by first. A work in a room no way into is known yet
     is come to by a cut, and the banner says so (placeIn). */
  function goTo(id, came, opts) {
    var s = S;
    if (!s || !s.world) { return false; }
    var h = null;
    s.hung.forEach(function (x) { if (x.id === id) { h = x; } });
    if (!h) {
      (s.works || []).forEach(function (w) { if (w.id === id && w.same) { s.hung.forEach(function (x) { if (x.id === w.same) { h = x; } }); } });
    }
    if (!h) { return false; }
    if (came) { s.cameFor[h.id] = came; }
    var room = s.world.floors[h.floor].rooms[h.room];
    var target = { x: h.spot.x, y: h.spot.y, floor: h.floor, face: h.spot.face, work: h, key: "w:" + h.id,
                   then: opts && opts.then };
    if (s.level === "look") { unlook(true); }
    var W = P();
    var path = W.path(s.world, { x: s.me.x, y: s.me.y, floor: s.me.floor }, { x: target.x, y: target.y, floor: target.floor });
    // No way there known: put before it, the banner saying so.
    if (!path) { return placeIn(room, target); }
    if (s.level === "plan") { descend(function () { glideTo(target); }); } else { glideTo(target); }
    return true;
  }

  /* ---------------------------------------------------------------- pointers and keys */

  // canvas and name: given when the press is on a name, which is the
  // walk's too — dragged, it turns and walks (or turns the plan), and only
  // a press that stays put is the name's.
  function pointerDown(event, canvas, name) {
    var s = S;
    if (!s) { return; }
    // Two fingers change level (land.js's own handlers see them first);
    // the building behind must not take this for a turn.
    event.stopPropagation();
    // A primary pointer is the first of a gesture: none other is down.
    if (event.isPrimary) { s.pointers = {}; }
    s.pointers[event.pointerId] = true;
    if (Object.keys(s.pointers).length >= 2) { s.drag = null; return; }
    var c = canvas || event.currentTarget;
    try { c.setPointerCapture(event.pointerId); } catch (e) {}
    s.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lx: event.clientX, t: performance.now(),
               moved: 0, walking: false, speed: 0, plan: c === s.plan, heading: s.heading, floorDone: false,
               name: name || null };
    if (s.level === "walk" && !s.drag.plan) { stopGlide(); s.turnTo = null; }
  }

  function pointerMove(event) {
    var s = S;
    if (!s || !s.drag || s.drag.id !== event.pointerId) { return; }
    if (Object.keys(s.pointers).length >= 2) { s.drag = null; return; }
    var d = s.drag;
    d.moved = Math.max(d.moved, Math.abs(event.clientX - d.x) + Math.abs(event.clientY - d.y));
    if (d.plan) {
      if (s.level !== "plan" || s.leaving) { return; }
      var ddx = event.clientX - d.x, ddy = event.clientY - d.y;
      if (!d.floorDone && Math.abs(ddy) >= FLOOR_DRAG && Math.abs(ddy) > Math.abs(ddx) * 1.5) {
        d.floorDone = true;
        var fl = s.world.floors[s.planFloor], next = null;
        s.world.floors.forEach(function (o) {
          if (ddy < 0 ? o.z > fl.z : o.z < fl.z) {
            if (!next || Math.abs(o.z - fl.z) < Math.abs(next.z - fl.z)) { next = o; }
          }
        });
        if (next) { floorTo(next.index); }
        return;
      }
      if (!d.floorDone && Math.abs(ddx) > 4) {
        s.headAnim = null;
        s.heading = d.heading + ddx * WEDGE;
        s.planDirty = true;
        wake();
      }
      return;
    }
    if (s.level !== "walk" || d.moved < TAP_PX) { return; }
    // Sideways turns you one to one: the point under the finger stays under it.
    var cs = s.caster, focalCss = cs.focal * s.dot;
    s.me.a = angleTo(s.me.a - (event.clientX - d.lx) / focalCss);
    d.lx = event.clientX;
    // Up walks forward, down back, faster the further from where it pressed.
    var band = s.box.getBoundingClientRect();
    d.speed = clamp(-(event.clientY - d.y) / (band.height * 0.18), -1, 1) * BRISK;
    d.walking = true;
    s.dirty = true;
    s.stillSince = 0;
    s.standChecked = false;
    wake();
  }

  function pointerUp(event) {
    var s = S;
    if (!s) { return; }
    delete s.pointers[event.pointerId];
    var d = s.drag;
    if (!d || d.id !== event.pointerId) { return; }
    s.drag = null;
    var tap = event.type === "pointerup" && d.moved < TAP_PX && performance.now() - d.t < TAP_MS;
    // A name pressed and let go where it was pressed: however long it was held.
    if (d.name && event.type === "pointerup" && d.moved < TAP_PX) {
      if (s.leaving || !d.name.go || d.name.hidden) { return; }
      // On a phone a room's name covers the rooms round it: pressed where
      // other rooms are within a finger's reach, they are offered with it, it first.
      if (s.level === "plan" && d.name.dataset.group === "plan" && d.name.room && coarse()) {
        var you0 = s.me.floor === s.planFloor ? youOnPlan() : null;
        if (choose(event.clientX, event.clientY, you0, you0 ? Math.hypot(event.clientX - you0.cx, event.clientY - you0.cy) : Infinity, d.name.room)) { return; }
      }
      d.name.go();
      return;
    }
    if (s.leaving) { return; }
    if (d.plan && s.level === "plan") {
      if (tap) { planTap(event.clientX, event.clientY); return; }
      if (!d.floorDone && d.moved >= TAP_PX) {
        var now = performance.now();
        s.headAnim = { from: s.heading, to: isoNearest(s.heading), t0: now, dur: 610 };
        wake();
      }
      return;
    }
    if (tap && s.level === "walk") { tapWalk(event.clientX, event.clientY); }
    s.dirty = true;
    wake();
  }

  // A tap on the walk, by what is under it.
  function pickAt(clientX, clientY) {
    var s = S, cs = s.caster;
    if (!cs || !cs.pick) { return null; }
    var r = s.view.getBoundingClientRect();
    var x = Math.floor((clientX - r.left) / s.dot), y = Math.floor((clientY - r.top) / s.dot);
    if (x < 0 || y < 0 || x >= cs.W || y >= cs.H) { return null; }
    var v = cs.pick[y * cs.W + x];
    return { kind: v >>> 24, i: v & 0xffffff, x: x, y: y };
  }

  // To learn about a work: near it (within LOOK_NEAR), the look at once; else
  // walk to stand before it, and the look opens on arriving.
  function learn(h) {
    var s = S;
    if (!s || !h) { return; }
    if (s.standing === h || (h.floor === s.me.floor && Math.hypot(h.cx - s.me.x, h.cy - s.me.y) <= LOOK_NEAR)) { look(h); return; }
    if (!goTo(h.id, null, { then: "look" })) { look(h); }
  }

  // The work most nearly ahead, within NAME_NEAR and 30° of the way you face.
  function ahead() {
    var s = S, me = s.me, best = null, bd = Infinity;
    s.hung.forEach(function (h, i) {
      if (h.floor !== me.floor || !s.seenLo || s.seenLo[i] < 0) { return; }
      var d = Math.hypot(h.cx - me.x, h.cy - me.y);
      if (d > NAME_NEAR) { return; }
      var ang = Math.abs(angleTo(Math.atan2(h.cy - me.y, h.cx - me.x) - me.a));
      if (ang > Math.PI / 6) { return; }
      var score = d + ang * 6;
      if (score < bd) { bd = score; best = h; }
    });
    return best;
  }

  function tapWalk(clientX, clientY) {
    var s = S, hit = pickAt(clientX, clientY);
    if (!hit) { return; }
    if (hit.kind === PICK_WORK) {
      // One tap on a work (artist, 7 Oct 2026: "walk up to an artwork inside the museum and click on
      // it and learn about it"): near, the look opens at once; far, you walk to stand before it and
      // the look opens on arriving.
      var h = s.hung[hit.i];
      learn(h);
      return;
    }
    if (hit.kind === PICK_FLOOR) {
      var fl = s.world.floors[s.me.floor], W = P();
      var cs = s.caster, rx = cs.colRx[hit.x], ry = cs.colRy[hit.x];
      var q = hit.i, fz = fl.fh[q] / 100, c = W.centreOf(fl, q), px = c[0], py = c[1];
      // The point under the finger on the floor; on a riser (a step's face,
      // which may stand above the eye), the step itself.
      if (s.me.z + EYE > fz + 0.01) {
        var d = (s.me.z + EYE - fz) * cs.rowK[hit.y], fx = s.me.x + rx * d, fy = s.me.y + ry * d;
        if (Math.hypot(fx - c[0], fy - c[1]) <= fl.cell * 1.5) { px = fx; py = fy; }
      }
      // Where a walker stands free: the point itself, else the nearest cell
      // clear of the walls (a tap at a wall's foot would end with you in it).
      var goal = free(fl, px, py, fz) ? [px, py] : nearestFree(fl, px, py);
      if (!goal) { return; }
      var t = { x: goal[0], y: goal[1], floor: s.me.floor, key: "f:" + Math.round(goal[0] * 2) + "," + Math.round(goal[1] * 2) };
      if (!glideTo(t)) { s.host.pulse(clientX, clientY, [s.host.LILAC], 0.35, 60); }
      return;
    }
    // A wall, a ceiling or the sky: turn to face it.
    var cs2 = s.caster;
    s.turnTo = Math.atan2(cs2.colRy[hit.x], cs2.colRx[hit.x]);
    stopGlide();
    wake();
  }

  var KEYMAP = { ArrowUp: "f", w: "f", W: "f", ArrowDown: "b", s: "b", S: "b", ArrowLeft: "l", a: "l", A: "l",
                 ArrowRight: "r", d: "r", D: "r", q: "sl", Q: "sl", e: "sr", E: "sr" };

  function typing(event) {
    var t = event.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  function keyDown(event) {
    var s = S;
    if (!s || !s.world || typing(event) || event.ctrlKey || event.metaKey || event.altKey) { return; }
    if (s.level !== "walk" && s.level !== "look") { return; }
    if (event.key === "Shift") { s.keys.fast = true; return; }
    var k = KEYMAP[event.key];
    // A letter (W A S D Q E) is a one-key shortcut (WCAG 2.1.4): only while the walk, or
    // nothing in particular, has the focus. The arrows walk wherever the focus is in it.
    if (k && event.key.length === 1) {
      var fa = document.activeElement;
      if (fa && fa !== document.body && fa !== document.documentElement && !(s.root && s.root.contains(fa)) &&
          !(fa.hasAttribute && (fa.hasAttribute("data-a11y-h1") || fa.classList.contains("a11y-h1")))) { return; }
    }
    if (k && s.level === "walk") {
      s.keys[k] = true;
      s.keys.fast = event.shiftKey;
      if (k !== "l" && k !== "r") { stand(null); }
      event.preventDefault();
      wake();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && s.level === "walk") {
      var t = event.target;
      if (t && t.tagName === "BUTTON") { return; }
      var h = s.standing || standable(true) || ahead();
      if (h) { event.preventDefault(); learn(h); }
    }
  }
  function keyUp(event) {
    var s = S;
    if (!s) { return; }
    if (event.key === "Shift") { s.keys.fast = false; return; }
    var k = KEYMAP[event.key];
    if (k) { s.keys[k] = false; wake(); }
  }

  /* ---------------------------------------------------------------- names over the walk */

  // Works' titles within 8 m (five at most, nearest first); named rooms'
  // names at their doorways within 12 m; the current room's doorways out of
  // view at the edges; the lift's floors. Buttons, placed on a drawn frame,
  // waiting rather than overprinting.
  function names(now) {
    var s = S, cs = s.caster, cam = s.cam, out = [], me = s.me, W = P();
    var fl = s.world.floors[me.floor];
    var br = s.box.getBoundingClientRect(), rr = s.rootRect || s.root.getBoundingClientRect();
    var ox = br.left - rr.left, oy = br.top - rr.top, dot = s.dot;
    // The works.
    var works = [];
    s.hung.forEach(function (h, i) {
      if (h.floor !== me.floor || !s.seenLo || s.seenLo[i] < 0 || h === s.standing) { return; }
      var d = Math.hypot(h.cx - me.x, h.cy - me.y);
      if (d > NAME_NEAR) { return; }
      works.push({ h: h, i: i, d: d });
    });
    works.sort(function (a, b) { return a.d - b.d; });
    works.slice(0, 5).forEach(function (w) {
      var h = w.h, midCol = (s.seenLo[w.i] + s.seenHi[w.i] + 1) / 2;
      var p = cs.project(cam, h.cx, h.cy, h.z1);
      if (!p) { return; }
      var op = w.d <= 4 ? 1 : w.d <= 6 ? 0.66 : 0.4;
      // Close to (within NEAR_LABEL), its small label: title · artist, year — what it is, before a press.
      var who = [String(h.work.a || "").split(",")[0], yearWords(h.work.y)].filter(Boolean).join(", ");
      var text = (h.work.t || "Untitled") + (w.d <= NEAR_LABEL && who ? " · " + who : "");
      out.push({ key: "w:" + h.id, text: text, x: ox + midCol * dot, y: oy + p.y * dot - 6, rank: w.d,
                 kind: "work", opacity: op, go: function () { learn(h); } });
    });
    // Rooms at their doorways.
    var here = roomAt(s.world, me.floor, me.x, me.y);
    fl.doors.forEach(function (d) {
      if (!d.cells) { return; }
      var dist = Math.hypot(d.x - me.x, d.y - me.y);
      var ax = me.x - d.x, ay = me.y - d.y;
      var beyond = (ax * d.ax + ay * d.ay) < 0 ? d.b : d.a;
      if (beyond < 0) { return; }
      var r = fl.rooms[beyond];
      if (!r || !r.name || r === here) { return; }
      var p = cs.project(cam, d.x, d.y, fl.z + 2.4);
      var inView = p && p.x >= 0 && p.x < cs.W && cs.depth[Math.floor(p.x)] >= p.t - 0.6;
      if (inView && dist <= DOOR_NEAR) {
        out.push({ key: "d:" + d.index + ":" + beyond, text: r.name, x: ox + p.x * dot, y: oy + p.y * dot, rank: 10 + dist,
                   kind: "room", go: function () { through(d, beyond); } });
      } else if (here && (d.a === here.index || d.b === here.index) && dist <= DOOR_NEAR * 1.5) {
        // Out of view: at the edge it is off toward, 45% down.
        var ang = angleTo(Math.atan2(d.y - me.y, d.x - me.x) - me.a);
        if (Math.abs(ang) <= FOV / 2) { return; }
        var left = ang < 0;
        out.push({ key: "e:" + d.index + ":" + beyond, text: left ? "← " + r.name : r.name + " →",
                   x: left ? ox + 12 : ox + br.width - 12, y: oy + br.height * 0.45, rank: 30 + dist, kind: "edge",
                   align: left ? "left" : "right", go: function () { through(d, beyond); } });
      }
    });
    // A lift's floors.
    var q = W.cellAt(fl, me.x, me.y);
    if (q >= 0 && fl.lift[q] >= 0) {
      var lf = s.world.lifts[fl.lift[q]];
      lf.floors.forEach(function (fi, k) {
        if (fi === me.floor) { return; }
        out.push({ key: "l:" + fi, text: floorName(s.world.floors[fi]), x: ox + br.width / 2, y: oy + br.height * 0.3 + k * 44,
                   rank: 5, kind: "room", go: function () { liftTo(fi); } });
      });
    }
    placeNames(out, "walk", 0, 0);
    label(now);
  }

  // Through a doorway: a point a metre and a half into the room beyond.
  function through(d, beyond) {
    var s = S, fl = s.world.floors[s.me.floor], r = fl.rooms[beyond];
    var dir = beyond === d.b ? 1 : -1;
    var tx = d.x + d.ax * dir * 1.5, ty = d.y + d.ay * dir * 1.5;
    var goal = nearestFree(fl, tx, ty, beyond) || nearestFree(fl, r.cx, r.cy, beyond);
    if (!goal) { return; }
    glideTo({ x: goal[0], y: goal[1], floor: fl.index, face: Math.atan2(d.ay * dir, d.ax * dir), key: "d:" + d.index + ":" + beyond });
  }

  // Place a set of names: nearest (lowest rank) first, each where it would
  // not lie over one already placed; at most twelve.
  function placeNames(list, group, ox, oy) {
    var s = S, used = {}, rects = [];
    list.sort(function (a, b) { return a.rank - b.rank; });
    var box = s.rootRect || s.root.getBoundingClientRect();
    var n = 0;
    list.forEach(function (it) {
      if (n >= 12) { return; }
      var w = Math.min(it.kind === "work" ? 240 : 12 * 11, 8 + it.text.length * (it.kind === "work" ? 6.2 : 6.6)), h = 22;
      var x = ox + it.x, y = oy + it.y;
      var left = it.align === "left" ? x : it.align === "right" ? x - w : x - w / 2;
      var topY = it.kind === "edge" ? y - h / 2 : y - h;
      if (left < 4) { left = 4; }
      if (left + w > box.width - 4) { left = box.width - 4 - w; }
      if (topY < -40 || topY > box.height) { return; }
      var r = [left, topY, left + w, topY + h];
      for (var k = 0; k < rects.length; k += 1) {
        var o = rects[k];
        if (r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]) { return; }
      }
      rects.push(r);
      n += 1;
      var e = s.nameEls[it.key];
      if (!e) {
        e = s.nameEls[it.key] = el("button", "walk-name");
        e.type = "button";
        e.dataset.group = group;
        // A pointer's press is taken on its way up (pointerUp); a click
        // with no pointer behind it is the keyboard's, or a reader's.
        e.addEventListener("click", function (event) { event.stopPropagation(); if (!event.detail && e.go && S && !S.leaving) { e.go(); } });
        s.names.appendChild(e);
      }
      e.go = it.go;
      e.room = it.room || null;
      e.dataset.kind = it.kind;
      e.classList.toggle("walk-edge", it.kind === "edge");
      if (it.passive) { e.dataset.passive = "true"; e.tabIndex = -1; } else if (e.dataset.passive) { delete e.dataset.passive; e.tabIndex = 0; }
      if (e.textContent !== it.text) { e.textContent = it.text; }
      e.setAttribute("aria-label", it.kind === "work" ? "Look at " + it.text : it.kind === "edge" ? "Through to " + it.text.replace(/[←→]/g, "").trim() : it.text);
      e.style.left = Math.round(left) + "px";
      e.style.top = Math.round(topY) + "px";
      e.style.opacity = it.opacity === undefined ? "" : String(it.opacity);
      e.hidden = false;
      used[it.key] = true;
    });
    Object.keys(s.nameEls).forEach(function (k) {
      var e = s.nameEls[k];
      if (e.dataset.group === group && !used[k]) { e.hidden = true; }
    });
  }

  function clearNames(group) {
    var s = S;
    Object.keys(s.nameEls).forEach(function (k) {
      var e = s.nameEls[k];
      if (!group || e.dataset.group === group) { e.hidden = true; }
    });
    if (group === "walk") { s.label.hidden = true; }
    if (!group || group === "choose") { s.choosing = false; }
  }

  /* ---------------------------------------------------------------- standing before a work */

  // The work you stand before: within 1.5 times its viewing distance,
  // facing it within 20°, seen, and still.
  function standable(anyDistance) {
    var s = S, me = s.me, best = null, bd = Infinity;
    s.hung.forEach(function (h, i) {
      if (h.floor !== me.floor || !s.seenLo || s.seenLo[i] < 0) { return; }
      var d = Math.hypot(h.cx - me.x, h.cy - me.y);
      var reach = anyDistance ? Math.max(LOOK_NEAR, 1.5 * h.spot.d) : 1.5 * h.spot.d;
      if (d > reach) { return; }
      var ang = Math.abs(angleTo(Math.atan2(h.cy - me.y, h.cx - me.x) - me.a));
      if (ang > FACE && d > 0.3) { return; }
      if (d < bd) { bd = d; best = h; }
    });
    return best;
  }

  function standCheck(now) {
    var s = S;
    if (s.level !== "walk" && s.level !== "look") { return; }
    if (s.level === "look") { return; }
    var h = null, k = s.keys;
    var going = !!(s.glide || (s.drag && s.drag.walking && Math.abs(s.drag.speed) > 0.05) || k.f || k.b || k.sl || k.sr);
    if (s.forceStand) { h = s.forceStand; s.forceStand = null; }
    else if (going) { h = null; }
    else if (s.stillSince && now - s.stillSince >= STILL_WAIT) { h = standable(false); }
    else if (s.standing) { h = standable(false) === s.standing ? s.standing : null; }
    if (h !== s.standing) { stand(h); }
  }

  function stand(h) {
    var s = S;
    if (!s || s.standing === h) { return; }
    stopReading(s);
    s.standing = h;
    if (s.ctx.onStand) { s.ctx.onStand(h ? h.id : null); }
    if (!h) { s.label.hidden = true; if (s.here && s.here.parentNode) { s.here.parentNode.removeChild(s.here); } return; }
    // Arriving before a work: a pulse in its colours and the light.
    if (!s.host.still && s.seenLo) {
      var br = s.box.getBoundingClientRect();
      var mid = (s.seenLo[h.i] + s.seenHi[h.i] + 1) / 2 * s.dot;
      s.host.pulse(br.left + mid, br.top + br.height * 0.45, (h.tones || []).concat([s.host.LIGHT]), 0.8);
    }
    startReading(h);
    if (s.cam && s.level === "walk") { names(performance.now()); }
    // One more frame: with saveData, its picture is asked for only now.
    s.dirty = true;
    wake();
  }

  /* ---------------------------------------------------------------- the reading */

  /* At a work, its wall label on the reading's own slow clock, moving only
     while the viewer is still: the title at 4 s, artist and date at 9, the
     medium and real size at 16, where it hangs and how that is known at 24;
     then from 30 s its threads, rarest first and the artist last, one at a
     time with the gaps lengthening, each with its doors; 'Where it has been'
     with the first. The thread it was come by is said first. What has been
     read stays read for the visit; a press never waits on the clock. */
  function startReading(h) {
    var s = S, host = s.host, w = h.work || {};
    var key = (s.world.slug || "") + ":" + h.id;
    var was = readWas[key] || (readWas[key] = { on: {}, said: [], n: 0 });
    var R = s.reading = { h: h, live: true, timers: [], was: was, lines: {}, views: [], hist: null, order: null,
                          gap: host.WORD_GAP, came: s.cameFor[h.id] || null, thread: null };
    delete s.cameFor[h.id];
    var room = s.world.floors[h.floor].rooms[h.room];
    R.lines.t = w.t || "Untitled";
    R.lines.by = [w.a, w.y].filter(Boolean).join(", ");
    R.lines.made = madeLine(h, w.m);
    R.lines.where = whereLine(h, room);
    // Beside the work in the walk, only where it hangs: how that is known is the look's and the column's.
    R.lines.whereShort = (room && room.name ? room.name : floorName(s.world.floors[h.floor])) +(h.wall && WALL_WORDS[h.wall] ? ", " + WALL_WORDS[h.wall] : "");
    var phone = window.innerWidth <= 720;
    R.phone = phone;
    buildView(s.label, R, !phone, true);
    if (phone) {
      s.here = s.here || el("section", "walk-here");
      s.here.setAttribute("aria-live", "polite");
      buildView(s.here, R, true, false);
      if (s.ctx.strip) { s.ctx.strip.insertBefore(s.here, s.ctx.strip.firstChild); try { s.ctx.strip.scrollTop = 0; } catch (e) {} }
    }
    s.label.hidden = false;
    // Its history: the medium where the file has none, and its threads.
    host.readArt("histories/" + h.id + ".json").then(function (hist) {
      if (s.reading !== R || !R.live) { return; }
      R.hist = hist;
      if (hist && !w.m && hist.medium) { R.lines.made = madeLine(h, hist.medium); refreshLine(R, "made"); }
      R.order = threadOrder(hist, R.came);
    });
    var keys = ["t", "by", "made", "where"];
    keys.forEach(function (k, n) {
      // What it is — title, artist and date — at once, so a visitor knows it before a press; the
      // rest of its label on the reading's clock.
      if (was.on[k] || k === "t" || k === "by") { reveal(R, k); return; }
      host.afterStill(function () { reveal(R, k); }, host.OPEN_AT[n], R);
    });
    if (R.came) {
      host.later(function () {
        var t = findThread(R, R.came);
        if (t) { sayThread(R, t); }
      }, host.still ? 0 : 2000, R);
    }
    host.afterStill(function () { procession(R); }, was.on.where ? Math.min(host.FIRST_WORD_AT, 2000) : host.FIRST_WORD_AT, R);
    placeLabel();
  }

  function stopReading(s) {
    var R = s && s.reading;
    if (!R) { return; }
    R.live = false;
    R.timers.forEach(function (t) { window.clearTimeout(t); });
    s.reading = null;
    s.label.hidden = true;
    s.label.textContent = "";
    if (s.here) { s.here.textContent = ""; if (s.here.parentNode) { s.here.parentNode.removeChild(s.here); } }
  }

  function madeLine(h, medium) {
    var w = h.work || {}, parts = [];
    if (medium) { parts.push(medium); }
    if (h.sized && w.cm) {
      var c = w.cm;
      // One measure alone, said as the record says it: a tondo's diameter, a bronze's greatest extension.
      if (!(c[0] > 0)) { parts.push(num(c[1]) + " cm, its " + (w.cmk || "height")); }
      else if (w.cmk === "diameter") { parts.push(num(c[0]) + " cm across, its diameter"); }
      else { parts.push(num(c[1]) + " × " + num(c[0]) + (c[2] ? " × " + num(c[2]) : "") + " cm"); }
    } else { parts.push("size not known"); }
    if (h.free) { parts.push("a photograph of it"); }
    return parts.join(" · ");
  }

  function whereLine(h, room) {
    var s = S, w = h.work || {};
    var place = roomWords(room);
    if (h.wall && WALL_WORDS[h.wall]) { place += ", " + WALL_WORDS[h.wall]; }
    var parts = [place];
    if (w.how === "arranged") {
      // Hung by the site's rule (INTERIORS.md, "Arranged"): said as its file says it, in the look
      // and the column, never over the walk.
      parts.push(String(w.said || "hung here by the site"));
      return parts.join(" · ");
    }
    var how = sourceWords(s.world, w.src);
    if (how) { parts.push(how + (w.asof ? ", read " + day(w.asof) : "")); }
    if (h.ours) {
      parts.push(h.wall === "centre" ? "its place in the room is ours" :
                 h.wallOurs ? "its wall and its place along it are ours" : "its place along the wall is ours");
    }
    return parts.join(" · ");
  }

  // Rarest first (fewest works share it), the artist last; the one come by first.
  function threadOrder(hist, came) {
    var list = ((hist && hist.threads) || []).slice();
    var artist = list.filter(function (t) { return t.k === "artist"; });
    list = list.filter(function (t) { return t.k !== "artist"; });
    list.sort(function (a, b) { return (a.n || 0) - (b.n || 0); });
    list = list.concat(artist);
    if (came) { list = list.filter(function (t) { return t.id !== came; }); }
    return list;
  }
  function findThread(R, id) {
    var list = (R.hist && R.hist.threads) || [];
    for (var i = 0; i < list.length; i += 1) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  // One thread at a time, each waiting longer than the last; once each has
  // had its turn, all of them in a line, as the reading at a collage ends.
  // Under reduced motion it is all there at once: the first said, the line.
  function procession(R) {
    var s = S;
    if (!s || s.reading !== R || !R.live) { return; }
    var host = s.host;
    if (!R.order) {
      // The history has not come yet: a moment more (it may never come).
      if ((R.waited = (R.waited || 0) + 1) <= 13) { host.later(function () { procession(R); }, 610, R); }
      return;
    }
    if (!R.order.length && !R.thread) {
      R.was.onlyHere = true;
      R.views.forEach(function (v) { onlyHere(v); });
      return;
    }
    if (host.still) {
      if (!R.thread && R.order[0]) { sayThread(R, R.order[0]); }
      R.was.n = R.order.length;
    }
    if (R.was.n >= R.order.length) {
      R.was.done = true;
      R.views.forEach(function (v) { lineInto(v, R); });
      placeLabel();
      return;
    }
    var t = R.order[R.was.n];
    R.was.n += 1;
    sayThread(R, t);
    var gap = R.gap;
    R.gap = Math.min(host.WORD_GAP_MAX, R.gap * host.WORD_GAP_GROW);
    host.afterStill(function () { procession(R); }, gap, R);
  }

  // All its threads, small, in a line: each said again when pressed.
  function lineInto(v, R) {
    if (!v.said || v.line) { return; }
    var list = R.came ? [findThread(R, R.came)].filter(Boolean).concat(R.order || []) : (R.order || []);
    if (!list.length) { return; }
    var line = el("div", "read-words walk-words");
    line.setAttribute("aria-label", "What " + (R.lines.t || "this work") + " shares");
    list.forEach(function (t) {
      var b = el("button", "read-w", t.name);
      b.type = "button";
      b.dataset.thread = t.id;
      b.setAttribute("aria-pressed", String(!!R.thread && R.thread.id === t.id));
      b.addEventListener("click", function (event) { event.stopPropagation(); sayThread(R, t); });
      line.appendChild(b);
    });
    v.said.parentNode.insertBefore(line, v.said.nextSibling);
    v.line = line;
    requestAnimationFrame(function () { line.dataset.on = "true"; });
  }

  function reveal(R, k) {
    if (!R.live) { return; }
    R.was.on[k] = true;
    R.views.forEach(function (v) {
      var e = v.lines[k];
      if (e) { e.dataset.on = "true"; v.host.dataset.lit = "true"; }
    });
    placeLabel();
  }
  function refreshLine(R, k) {
    R.views.forEach(function (v) { var e = v.lines[k]; if (e) { e.textContent = R.lines[k]; } });
  }

  // A view of the reading: the label beside the work, the strip's card on a
  // phone, or the look's lines. The look's has 'Where it has been' at once:
  // a press never waits on the clock.
  function buildView(host, R, full, isLabel, inLook) {
    host.textContent = "";
    // Its ground comes up with its first line, not before: the label is
    // nothing until the clock says something.
    if (Object.keys(R.was.on).length) { host.dataset.lit = "true"; } else { delete host.dataset.lit; }
    var v = { host: host, lines: {}, full: full, said: null, line: null, look: !!inLook };
    var t = el("p", "walk-l walk-l-t");
    t.appendChild(el("i", "", R.lines.t));
    v.lines.t = t;
    host.appendChild(t);
    if (full) {
      ["by", "made", "where"].forEach(function (k) {
        var e = el("p", "walk-l walk-l-" + k, k === "where" && isLabel ? R.lines.whereShort : R.lines[k]);
        v.lines[k] = e;
        host.appendChild(e);
      });
      if (inLook) { lookExtras(host, R); }
      v.said = el("div", "walk-said");
      v.said.setAttribute("aria-live", "polite");
      host.appendChild(v.said);
    }
    Object.keys(v.lines).forEach(function (k) { if (R.was.on[k]) { v.lines[k].dataset.on = "true"; } });
    if (isLabel && !full) { v.lines.t.dataset.on = R.was.on.t ? "true" : "false"; }
    R.views.push(v);
    if (R.thread && v.said) { sayInto(v, R, R.thread); }
    if (R.was.onlyHere && !R.thread && v.said) { onlyHere(v); }
    if (R.was.done && v.said) { lineInto(v, R); }
    return v;
  }

  /* The rest of the wall label, in the look only: its credit line; for a work
     shown here and not held, what its history says happened here; the
     museum's own description, quoted, with whose words they are; then the
     doors — 'Where it has been' for a work with a history on the site, the
     museum's own record of a collection work (a link off the site, named). */
  function lookExtras(host, R) {
    var s = S, w = R.h.work || {};
    var museum = (s.ctx.museum && s.ctx.museum.name) || "the museum";
    if (w.credit) { host.appendChild(lineOn(el("p", "walk-l walk-l-credit", String(w.credit)))); }
    if (w.also && w.also.q) {
      var q = el("p", "walk-l walk-l-also");
      q.appendChild(document.createTextNode("Its history: "));
      q.appendChild(el("q", "", String(w.also.q)));
      host.appendChild(lineOn(q));
    }
    if (w.desc) {
      var d = el("div", "walk-desc");
      d.appendChild(el("p", "walk-desc-h", "In " + (w.kind === "collection" ? "the museum's" : "its") + " own words"));
      var bq = el("blockquote", "walk-desc-q", String(w.desc));
      d.appendChild(bq);
      if (w.descsrc) { d.appendChild(el("p", "walk-desc-src", "— " + String(w.descsrc))); }
      host.appendChild(d);
    }
    var doors = el("div", "walk-look-doors");
    if (w.kind !== "collection") { doors.appendChild(historyButton(R)); }
    var url = w.ref && w.ref.url;
    if (url && /^https:\/\//.test(url)) {
      var a = el("a", "walk-record", museum + "'s own record ↗");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", museum + "'s own record of " + (R.lines.t || "this work") + " (opens in a new tab)");
      a.addEventListener("click", function (event) { event.stopPropagation(); });
      doors.appendChild(a);
    }
    if (doors.children.length) { host.appendChild(doors); }
  }
  function lineOn(e) { e.dataset.on = "true"; return e; }

  function historyButton(R) {
    var s = S, b = el("button", "walk-history", "Where it has been");
    b.type = "button";
    b.addEventListener("click", function (event) {
      event.stopPropagation();
      var m = s.ctx.museum || {};
      s.host.openArt({ work: R.h.id }, { museum: { name: m.name, slug: m.slug } });
    });
    return b;
  }

  function onlyHere(v) {
    if (!v.said || v.said.querySelector(".walk-only")) { return; }
    v.said.appendChild(el("p", "read-only walk-only", "only here"));
  }

  function sayThread(R, t) {
    if (!R.live) { return; }
    R.thread = t;
    if (R.was.said.indexOf(t.id) < 0) { R.was.said.push(t.id); }
    R.views.forEach(function (v) {
      if (v.said) { sayInto(v, R, t); }
      if (v.line) {
        Array.prototype.forEach.call(v.line.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.thread === t.id)); });
      }
    });
    var s = S;
    if (!s.host.still && R.views[0]) {
      var b = R.views[0].host.getBoundingClientRect();
      if (b.width) { s.host.pulse(b.left + 20, b.bottom - 20, (R.h.tones || []).slice(0, 1).concat([s.host.LIGHT]), 0.35, 90); }
    }
    placeLabel();
  }

  function sayInto(v, R, t) {
    var s = S;
    Array.prototype.forEach.call(v.said.children, function (old) {
      old.dataset.on = "false";
      window.setTimeout(function () { if (old.parentNode) { old.parentNode.removeChild(old); } }, s.host.still ? 0 : 700);
    });
    var box = el("div", "read-said walk-thread");
    var p = el("p", "art-sentence walk-sentence");
    p.appendChild(sentence(t));
    box.appendChild(p);
    var doors = el("div", "read-doors walk-doors");
    box.appendChild(doors);
    // 'Where it has been' comes with the first thread (the look has its own).
    if (!v.look) { box.appendChild(historyButton(R)); }
    v.said.appendChild(box);
    box.getBoundingClientRect();
    requestAnimationFrame(function () { if (box.dataset.on !== "false") { box.dataset.on = "true"; } });
    s.host.readArt("threads/" + t.id + ".json").then(function (tf) {
      if (!R.live || !box.parentNode) { return; }
      doorsInto(doors, tf, t, R);
      placeLabel();
    });
  }

  // The words a thread is said in: land.js's threadSentence, word for word.
  function sentence(t) {
    var f = document.createDocumentFragment();
    function sw(x) { f.appendChild(document.createTextNode(x)); }
    function it(x) { f.appendChild(el("i", "", x)); }
    var n = t.n || 0, others = n === 1 ? "1 other" : n + " others";
    var town = String(t.at || "").split(", ").pop();
    switch (t.k) {
      case "show": sw("Shown with " + others + " in "); it(t.name); sw([town, t.y].filter(Boolean).length ? ", " + [town, t.y].filter(Boolean).join(", ") : ""); break;
      case "sale": sw("Offered with " + others + " in "); it(t.name); sw(t.y ? ", " + t.y : ""); break;
      case "owner": sw("Owned by "); it(t.name); sw(", as " + others + (n === 1 ? " was" : " were")); break;
      case "museum": sw("Held by " + (/^the\s/i.test(t.name) ? "" : "the ")); it(t.name); sw(", with " + others); break;
      case "writing": sw("In "); it(t.name); sw(" (" + [String(t.at || "").split(" ").pop(), t.y].filter(Boolean).join(", ") + "), with " + others); break;
      case "artist": sw("By "); it(t.name); sw(", like " + others); break;
      default: it(t.name);
    }
    return f;
  }

  // Up to eight of the other saved works that share it, each a small
  // picture and its title; a door to where it hangs here, to its museum,
  // or to its history.
  function doorsInto(box, tf, t, R) {
    var s = S, host = s.host;
    var rows = tf && tf.works ? tf.works.filter(function (w) { return w[0] !== R.h.id; }) : [];
    if (!rows.length) { box.appendChild(el("p", "read-only", "only here")); return; }
    rows.slice(0, 8).forEach(function (w, n) {
      var d = el("button", "read-door art-door walk-door-work");
      d.type = "button";
      var hereH = null;
      s.hung.forEach(function (h) { if (h.id === w[0]) { hereH = h; } });
      d.setAttribute("aria-label", (w[1] || "Untitled") + (w[2] ? ", " + w[2] : "") + " — also " + t.name);
      var pic = el("span", "art-door-pic");
      if (w[3]) {
        var img = el("img");
        img.alt = "";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = host.cdn + w[3] + "/small.jpg";
        pic.appendChild(img);
      }
      d.appendChild(pic);
      d.appendChild(el("span", "read-door-t", w[1] || "Untitled"));
      if (hereH) {
        var rm = s.world.floors[hereH.floor].rooms[hereH.room];
        d.appendChild(el("span", "walk-door-here", roomWords(rm)));
      }
      d.style.transitionDelay = (host.still ? 0 : 520 + n * 140) + "ms";
      d.addEventListener("click", function (event) {
        event.stopPropagation();
        door(w, t, R);
      });
      box.appendChild(d);
    });
    if (rows.length > 8) {
      var more = el("button", "art-and-more", "and " + (rows.length - 8) + " more");
      more.type = "button";
      more.addEventListener("click", function (event) {
        event.stopPropagation();
        host.openArt({ thread: t.id }, { work: R.h.id, from: { id: R.h.id, title: R.lines.t } });
      });
      box.appendChild(more);
    }
  }

  // A thread's door: hung here, you walk to it and the thread is said first
  // on its label; held by another of the site's museums, the page goes there
  // and in; otherwise its history opens.
  function door(w, t, R) {
    var s = S, host = s.host, id = w[0];
    var hereH = null;
    s.hung.forEach(function (h) { if (h.id === id) { hereH = h; } });
    if (hereH) {
      if (s.level === "look") { unlook(true); }
      goTo(id, t.id);
      return;
    }
    var from = { id: R.h.id, title: R.lines.t };
    var by = { id: t.id, k: t.k, name: t.name };
    host.readArt("histories/" + id + ".json").then(function (hist) {
      if (S !== s) { return; }
      var m = null;
      ((hist && hist.events) || []).forEach(function (e) { if ((e.k === "held" || e.k === "listed") && e.m) { m = e.m; } });
      var mine = s.ctx.museum && s.ctx.museum.slug;
      if (m && m !== mine && host.goMuseum) { host.goMuseum(m, id, t.id); return; }
      host.openArt({ work: id }, { thread: by, from: from });
    });
  }

  // The label beside the work on a desktop, at 1.4 m, never narrower than its
  // longest word; on a phone, the title under the work.
  function placeLabel() {
    var s = S;
    if (!s || !s.standing || !s.cam || s.level !== "walk") { if (s) { s.label.hidden = true; } return; }
    var h = s.standing, cs = s.caster, fl = s.world.floors[h.floor];
    var br = s.box.getBoundingClientRect(), rr = s.rootRect || s.root.getBoundingClientRect();
    var ox = br.left - rr.left, oy = br.top - rr.top, dot = s.dot;
    var lab = s.label;
    lab.hidden = false;
    var lw = lab.offsetWidth || 160, lh = lab.offsetHeight || 40;
    var base = fl.z + (s.world.floors[h.floor].rooms[h.room] || { fz: 0 }).fz;
    var x, y;
    if (window.innerWidth <= 720) {
      var pb = cs.project(s.cam, h.cx, h.cy, h.z0);
      var mid = s.seenLo && s.seenLo[h.i] >= 0 ? (s.seenLo[h.i] + s.seenHi[h.i] + 1) / 2 * dot : br.width / 2;
      x = ox + mid - lw / 2;
      y = oy + (pb ? pb.y * dot + 8 : br.height - lh - 8);
    } else {
      // Beside the work, on whichever side has the more room, narrowed to
      // it (never narrower than its longest word, which the sheet keeps).
      var lo = s.seenLo && s.seenLo[h.i] >= 0 ? s.seenLo[h.i] * dot : br.width / 2;
      var hi = s.seenHi && s.seenHi[h.i] >= 0 ? (s.seenHi[h.i] + 1) * dot : br.width / 2;
      var pz = cs.project(s.cam, h.cx, h.cy, base + 1.4);
      var right = br.width - hi - 16, left = lo - 16;
      lab.style.maxWidth = Math.round(clamp(Math.max(right, left), 150, 256)) + "px";
      lw = lab.offsetWidth || lw;
      lh = lab.offsetHeight || lh;
      x = right >= left ? ox + hi + 12 : ox + lo - lw - 12;
      y = pz ? oy + pz.y * dot - lh / 2 : oy + 12;
    }
    x = clamp(x, ox + 8, ox + br.width - lw - 8);
    y = clamp(y, oy + 8, oy + br.height - lh - 8);
    lab.style.left = Math.round(x) + "px";
    lab.style.top = Math.round(y) + "px";
  }

  function label() { placeLabel(); }

  /* ---------------------------------------------------------------- the look */

  // Large over the walk, which is washed behind it: Artsy's large picture
  // (the medium if not), dealt by one of the arrivals that never read its
  // pixels; beside it (above it on a phone) what has been read, at once,
  // the clock carrying on; 'Where it has been'; its threads as doors.
  function look(h) {
    var s = S;
    if (!s || !h) { return; }
    if (s.standing !== h) { stand(h); }
    var host = s.host, w = h.work || {};
    var box = s.look;
    box.textContent = "";
    box.hidden = false;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", w.t || "The work");
    var inner = el("div", "walk-look-in");
    box.appendChild(inner);
    // Back to the walk, where you stood: ×, Escape, a pinch or a press on the dark round it.
    var x = el("button", "walk-look-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Back to the walk");
    x.addEventListener("click", function (event) { event.stopPropagation(); unlook(); });
    box.appendChild(x);
    // A press never waits on the clock: its whole label is there at once.
    if (s.reading && s.reading.h === h) {
      ["t", "by", "made", "where"].forEach(function (k) { s.reading.was.on[k] = true; });
      reveal(s.reading, "t");
    }
    var plate = el("div", "walk-look-plate");
    var go = el("span", "deal-go");
    var img = el("img");
    img.alt = (w.t || "Untitled") + (w.a ? ", " + w.a : "");
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    go.appendChild(img);
    plate.appendChild(go);
    inner.appendChild(plate);
    var lines = el("div", "walk-look-lines");
    inner.appendChild(lines);
    s.zoom = 0;
    var tries = ["medium"];
    var shown = false;
    function fit(ar) {
      var r = inner.getBoundingClientRect(), phone = window.innerWidth <= 720;
      // The label always directly under the picture (artist, 7 Oct 2026: "the info for the artwork
      // should always be below the thumbnail"): the picture takes the top 62% at most, its label the
      // width of the picture (never narrower than 18em), under it.
      // Measured on the look's own window (its inside grows with the label and scrolls), so the
      // label's first lines are in view under the picture.
      var vh = box.getBoundingClientRect().height || r.height;
      var maxW = phone ? r.width - 32 : Math.min(r.width - 64, 980), maxH = vh * (phone ? 0.46 : 0.6);
      var wv = maxW, hv = wv / ar;
      if (hv > maxH) { hv = maxH; wv = hv * ar; }
      plate.style.width = Math.round(wv) + "px";
      plate.style.height = Math.round(hv) + "px";
      lines.style.width = Math.round(clamp(Math.max(wv, 300), 0, r.width - 32)) + "px";
    }
    img.addEventListener("load", function () {
      if (S !== s || s.look !== box || shown) { return; }
      shown = true;
      fit(img.naturalWidth / Math.max(1, img.naturalHeight));
      plate.dataset.on = "true";
      if (!host.still) {
        var how = host.oneOf(LOOK_ARRIVALS);
        s.lookArrival = how;
        if (host.ARRIVALS[how]) { host.ARRIVALS[how](plate, 0); }
      }
    });
    img.addEventListener("error", function () {
      if (tries.length && w.i) { img.src = host.cdn + w.i + "/" + tries.shift() + ".jpg"; return; }
      // No picture: its three colours, as the walk has them.
      shown = true;
      fit(h.w / Math.max(0.01, h.h));
      go.textContent = "";
      (h.tones || []).forEach(function (c, k) {
        var b = el("span", "walk-look-band");
        b.style.background = c;
        b.style.flex = String([5, 3, 2][k] || 1);
        go.appendChild(b);
      });
      go.classList.add("walk-look-bands");
      plate.dataset.on = "true";
    });
    if (w.i) { img.src = host.cdn + w.i + "/large.jpg"; }
    else if (w.img && /^https?:\/\//.test(w.img)) { img.src = w.img; }      // the museum's own picture
    else { img.dispatchEvent(new Event("error")); }
    fit(h.w / Math.max(0.01, h.h));
    plate.addEventListener("click", function (event) { event.stopPropagation(); if (pressedInLook()) { zoom(); } });
    if (s.reading && s.reading.h === h) { buildView(lines, s.reading, true, false, true); }
    setLevel("look");
    s.label.hidden = true;
    clearNames("walk");
    try { x.focus({ preventScroll: true }); } catch (e) {}
    s.dirty = true;
    wake();
  }

  function pressedInLook() {
    var s = S, ok_ = !!(s && s.lookDown && performance.now() - s.lookDown < 1500);
    if (s) { s.lookDown = 0; }
    return ok_;
  }

  function unlook(quiet) {
    var s = S;
    if (!s || s.level !== "look") { return; }
    var R = s.reading;
    if (R) { R.views = R.views.filter(function (v) { return !s.look.contains(v.host); }); }
    s.look.hidden = true;
    s.look.textContent = "";
    setLevel("walk");
    s.dirty = true;
    if (!quiet) { placeLabel(); }
    wake();
  }

  // Spreading again in the look: the picture φ times larger, up to φ³.
  function zoom() {
    var s = S;
    var plate = s.look.querySelector(".walk-look-plate");
    if (!plate) { return; }
    s.zoom = s.zoom >= 3 ? 0 : s.zoom + 1;
    plate.style.transform = s.zoom ? "scale(" + Math.pow(PHI, s.zoom).toFixed(3) + ")" : "";
    plate.dataset.zoom = String(s.zoom);
  }

  /* ---------------------------------------------------------------- still there today */

  /* Once a visit: the museums whose own services answer a browser (the Met,
     the Art Institute, Cleveland, SMK) are asked whether each placed work
     is still where the file says. A work moved to a room drawn here is hung
     there; moved anywhere else, it is elsewhere, in today's words; taken
     off view, it is taken down. Failures are silent: the file stands. */
  function recheck() {
    var s = S;
    if (!s || s.rechecked || !window.Collections || !window.Collections.whereNow) { return; }
    s.rechecked = true;
    var works = s.works.filter(function (w) { return w.ref && w.ref.object && (w.how === "museum" || w.how === "elsewhere" || w.how === "off"); });
    if (!works.length) { return; }
    var p;
    try { p = window.Collections.whereNow(s.ctx.museum || { slug: s.world.slug }, works); } catch (e) { return; }
    if (!p || !p.then) { return; }
    p.then(function (now) {
      if (S !== s || !now) { return; }
      var changed = false, keys = roomKeys(s.world);
      var next = s.works.map(function (w) {
        var n = now[w.id];
        if (!n) { return w; }
        var c = Object.assign({}, w);
        if (n.how === "off" || n.how === "none" || n.on === false) {
          // Off view, or no longer placed by its record: taken down, in its words.
          var how = n.how === "none" ? "none" : "off";
          if (w.how !== how || w.said !== n.said) { c.how = how; c.said = n.said; c.asof = n.asof; delete c.room; changed = true; }
          return c;
        }
        var rid = null;
        (n.keys || [n.room]).forEach(function (k) { if (!rid && k && keys[norm(k)]) { rid = keys[norm(k)]; } });
        if (rid) {
          if (w.how !== "museum" || w.room !== rid) {
            c.how = "museum"; c.room = rid; c.wall = w.room === rid ? w.wall : null; c.said = n.said; c.asof = n.asof;
            changed = true;
          }
        } else if (n.said && (w.how !== "elsewhere" || w.said !== n.said)) {
          c.how = "elsewhere"; c.said = n.said; c.asof = n.asof; delete c.room; changed = true;
        }
        return c;
      });
      if (!changed) { return; }
      s.works = next;
      var res = hangAll(s.world, next, s.ctx.interior && s.ctx.interior.pins);
      stand(null);
      s.hung = res.hung; s.spill = res.spill;
      s.planCache = {};
      s.orderWas = null;
      if (s.level === "plan") { s.planDots = planDotsFor(s.planFloor); s.planDirty = true; }
      s.dirty = true;
      if (s.ctx.onWorks) { s.ctx.onWorks(next); }
      wake();
    }).catch(function () {});
  }
  function norm(k) { return String(k || "").toLowerCase().split(/\s+/).filter(Boolean).join(" "); }
  function roomKeys(world) {
    var out = {};
    world.floors.forEach(function (fl) {
      fl.rooms.forEach(function (r) {
        if (r.pseudo) { return; }
        [r.id].concat(r.ref || []).forEach(function (k) { if (k && !out[norm(k)]) { out[norm(k)] = r.id; } });
      });
    });
    return out;
  }

  /* ---------------------------------------------------------------- for land.js */

  // The door before going in: where the entrance is (or the shell's, from
  // the model), in the model's frame and in its dots' own units, for the
  // lit tile on the building. Compiles once; the walk reuses it.
  function prepare(ctx) {
    var world = compileFor(ctx);
    var e = world.enter;
    if (!e) { return null; }
    var m = P().toWorld(world, e.door[0], e.door[1]);
    var fl = world.floors[e.floor], vx = world.model;
    var z = fl ? fl.z : 0;
    var dots = vx ? [(m[0] + vx.site[0] / 2) / vx.v - vx.nx / 2 - 0.5, (m[1] + vx.site[1] / 2) / vx.v - vx.ny / 2 - 0.5, z / vx.v] : null;
    // The way out of the door, in the model's frame: the tile is shown only
    // while the door faces the one looking (Walk.doorShows).
    var ox = Math.cos(e.a + Math.PI), oy = Math.sin(e.a + Math.PI), o = P().toWorld(world, ox, oy);
    return { door: { x: m[0], y: m[1], z: z }, dots: dots, out: o, shell: world.shell, tier: world.tier };
  }

  // Whether a door's front can be seen at a heading of the building view
  // (Models.draw's): its way out turned toward the one looking. A shell's
  // way in is the rule's, not the museum's door, so it is never lit as if
  // it were: the tile marks only an entrance a source gives (the gesture
  // still goes in, by that way of ours, and the walk says so).
  function doorShows(prep, heading) {
    if (!prep || !prep.out || prep.shell) { return false; }
    return prep.out[0] * Math.sin(heading) + prep.out[1] * Math.cos(heading) > -0.05;
  }

  // The hung works in walking order from where you are: one flood over the
  // floors' grids, each work at the length of the way to its viewing spot,
  // stopping once every work's spot is reached; kept while you stay in the
  // same room (land.js asks on every room you enter).
  function order() {
    var s = S;
    if (!s || !s.world || !s.hung.length) { return []; }
    var W = P(), world = s.world;
    var here = roomAt(world, s.me.floor, s.me.x, s.me.y);
    var okey = s.me.floor + ":" + (here && !here.pseudo ? "r" + here.index : "q" + W.cellAt(world.floors[s.me.floor], s.me.x, s.me.y));
    if (s.orderWas && s.orderWas.key === okey) { return s.orderWas.list.slice(); }
    var offs = [], total = 0;
    world.floors.forEach(function (fl) { offs.push(total); total += fl.n; W.clearance(fl); });
    var want = {}, left = 0;
    s.hung.forEach(function (h) {
      var q = W.cellAt(world.floors[h.floor], h.spot.x, h.spot.y);
      if (q >= 0 && !want[offs[h.floor] + q]) { want[offs[h.floor] + q] = 1; left += 1; }
    });
    // Float64, and each cell settled once: the stairs join the floors at no
    // cost, and a float32 distance rounded up would pass a cell back and
    // forth across them for ever.
    var dist = new Float64Array(total).fill(Infinity), done = new Uint8Array(total);
    var fl0 = world.floors[s.me.floor], q0 = W.cellAt(fl0, s.me.x, s.me.y);
    var heap = [[0, offs[s.me.floor] + q0]];
    if (q0 >= 0) { dist[offs[s.me.floor] + q0] = 0; }
    function floorAt(node) { var f = 0; while (f + 1 < offs.length && node >= offs[f + 1]) { f += 1; } return f; }
    function push(d, n) {
      heap.push([d, n]);
      var i = heap.length - 1;
      while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= d) { break; } var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        var i = 0;
        for (;;) {
          var a = 2 * i + 1, b = a + 1, m = i;
          if (a < heap.length && heap[a][0] < heap[m][0]) { m = a; }
          if (b < heap.length && heap[b][0] < heap[m][0]) { m = b; }
          if (m === i) { break; }
          var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
        }
      }
      return top;
    }
    var N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (q0 >= 0 && heap.length) {
      var it = pop(), d = it[0], node = it[1];
      if (done[node] || d > dist[node]) { continue; }
      done[node] = 1;
      if (want[node]) { left -= 1; if (!left) { break; } }
      var fi = floorAt(node), fl = world.floors[fi], q = node - offs[fi];
      var i = q % fl.gw, j = (q - i) / fl.gw;
      for (var k = 0; k < 8; k += 1) {
        var a = i + N8[k][0], b = j + N8[k][1];
        if (a < 0 || b < 0 || a >= fl.gw || b >= fl.gh) { continue; }
        var p = b * fl.gw + a;
        if (!W.walkable(fl, p) || fl.clear[p] < 0.25 || Math.abs(fl.fh[p] - fl.fh[q]) > STEP * 100) { continue; }
        // No cutting a corner: a wall one cell thick meets another only at a corner.
        if (N8[k][0] && N8[k][1] && (!W.walkable(fl, j * fl.gw + a) || !W.walkable(fl, b * fl.gw + i))) { continue; }
        var nd = d + N8[k][2] * fl.cell;
        if (nd < dist[offs[fi] + p]) { dist[offs[fi] + p] = nd; push(nd, offs[fi] + p); }
      }
      if (fl.stair[q] >= 0) {
        var st = world.stairs[fl.stair[q]], other = st.from === fi ? st.to : st.from;
        var c = W.centreOf(fl, q), of = world.floors[other], oq = W.cellAt(of, c[0], c[1]);
        if (oq >= 0 && of.stair[oq] === st.index && d < dist[offs[other] + oq]) { dist[offs[other] + oq] = d; push(d, offs[other] + oq); }
      }
      if (fl.lift[q] >= 0) {
        var lf = world.lifts[fl.lift[q]];
        lf.floors.forEach(function (fo) {
          var ol = world.floors[fo], mq = W.cellAt(ol, (lf.rect[0] + lf.rect[2]) / 2, (lf.rect[1] + lf.rect[3]) / 2);
          if (mq >= 0 && d + 4 < dist[offs[fo] + mq]) { dist[offs[fo] + mq] = d + 4; push(d + 4, offs[fo] + mq); }
        });
      }
    }
    var list = s.hung.map(function (h) {
      var fl = world.floors[h.floor], q = W.cellAt(fl, h.spot.x, h.spot.y);
      var r = fl.rooms[h.room];
      return { id: h.id, room: r.id, name: r.name, floor: fl.id, d: q >= 0 ? dist[offs[h.floor] + q] : Infinity, reach: !!r.reach };
    }).sort(function (a, b) { return a.d - b.d; });
    s.orderWas = { key: okey, list: list };
    return list.slice();
  }

  function state() {
    var s = S;
    if (!s || !s.me) { return { level: s ? s.level : null }; }
    var r = s.world ? roomAt(s.world, s.me.floor, s.me.x, s.me.y) : null;
    var fl = s.world && s.world.floors[s.me.floor];
    return { level: s.level, floor: s.me.floor, floorId: fl ? fl.id : null, x: s.me.x, y: s.me.y, a: s.me.a,
             room: r && !r.pseudo ? r.id : null, standing: s.standing ? s.standing.id : null,
             gliding: !!s.glide, planFloor: s.planFloor, dot: s.dot, raf: !!s.raf };
  }

  function stats() {
    var s = S;
    if (!s) { return null; }
    var st = s.stats, list = st.list.slice().sort(function (a, b) { return a - b; });
    return { frames: st.frames, mean: st.frames ? st.total / st.frames : 0, max: st.max,
             median: list.length ? list[Math.floor(list.length / 2)] : 0,
             p95: list.length ? list[Math.floor(list.length * 0.95)] : 0,
             // The mean of each part: the cast, putting it, the pictures, the names.
             parts: st.parts.map(function (v) { return st.frames ? v / st.frames : 0; }),
             w: s.caster ? s.caster.W : 0, h: s.caster ? s.caster.H : 0, dot: s.dot, planMs: s.planMs || 0,
             plan: { frames: s.planStats.frames, mean: s.planStats.frames ? s.planStats.total / s.planStats.frames : 0, max: s.planStats.max,
                     dots: s.planDots ? s.planDots.count : 0, shown: s.planDots && s.planDots.plan ? s.planDots.plan.shown : 0 },
             arrival: s.lookArrival || null };
  }

  /* One frame, for the checker: the world and its hung works as walk-plan.js
     gives them, drawn from a spot, with no page round it. The works are
     their three colours unless pictures: true (which taints the canvas). */
  function snapshot(world, hung, o) {
    o = o || {};
    var w = o.w || 130, h = o.h || 148, dot = o.dot || 1;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    var cs = new Caster(world, world.dark || [15, 12, 10]);
    cs.size(w, h, g);
    var list = (hung || []).map(function (x, i) {
      var y = Object.assign({}, x);
      y.i = i;
      var three = [0, 1, 2].map(function (k) { return hexRgb(x.work && x.work.c && x.work.c[k]) || hexRgb(x.work && x.work.c && x.work.c[0]) || [128, 120, 110]; });
      y.bands = three.map(function (cc) { return new Uint32Array(KM.map(function (k) { return pack((cc[0] * k) >> 8, (cc[1] * k) >> 8, (cc[2] * k) >> 8); })); });
      return y;
    });
    var fi = typeof o.floor === "number" ? o.floor : 0, fl = world.floors[fi];
    var q = P().cellAt(fl, o.x, o.y);
    var cam = { fl: fl, x: o.x, y: o.y, a: o.a || 0, z: q >= 0 ? fl.fh[q] / 100 : fl.z };
    var here = list.filter(function (x) { return x.floor === fi; });
    function once(pics) {
      cs.render(cam, here);
      g.putImageData(cs.img, 0, 0);
      if (pics) { blitWorks(g, cs, cam, list, pics, performance.now() + 1e6, 1); }
    }
    function out() {
      if (dot === 1) { return c; }
      var big = document.createElement("canvas");
      big.width = w * dot; big.height = h * dot;
      var bg = big.getContext("2d");
      bg.imageSmoothingEnabled = false;
      bg.drawImage(c, 0, 0, w * dot, h * dot);
      return big;
    }
    if (!o.pictures) { once(null); return Promise.resolve(out()); }
    var pics = new Pictures(o.cdn || CDN);
    once(pics);
    return new Promise(function (done) {
      var until = performance.now() + (o.wait || 2500);
      (function poll() {
        if (!pics.flying && !pics.wanted.length || performance.now() > until) {
          Object.keys(pics.by).forEach(function (k) { pics.by[k].at = 1; });
          once(pics);
          done(out());
          return;
        }
        window.setTimeout(poll, 60);
      }());
    });
  }

  // Leaving the museum's building: what was compiled for it is let go.
  function forget() { if (!S) { cache = {}; } }

  // The 'Here' card on a phone, for land.js to keep first when it regroups
  // the strip; null while you stand before nothing.
  function here() { return S && S.standing && S.here && S.here.firstChild ? S.here : null; }

  var api = {
    open: open, up: up, down: down, goTo: function (id, came) { return goTo(id, came); },
    level: function () { return S ? S.level : null; },
    state: state, close: close, prepare: prepare, doorShows: doorShows, order: order, forget: forget, here: here,
    world: function () { return S ? S.world : null; },
    hung: function () { return S ? S.hung : []; },
    works: function () { return S ? S.works : []; },
    stats: stats, snapshot: snapshot, LOOK_ARRIVALS: LOOK_ARRIVALS,
    // Only for the tests: glide and look by hand.
    _pickAt: function (x, y) { return S ? pickAt(x, y) : null; },
    _roomOnPlan: function (id) {
      if (!S || !S.world) { return null; }
      var r = P().roomById(S.world, id);
      if (!r) { return null; }
      var fl = S.world.floors[r.floor], p = planPoint(r.cx, r.cy, fl.z + r.fz);
      var poly = (r.poly || []).map(function (v) { var q = planPoint(v[0], v[1], fl.z + r.fz); return q ? [q.cx, q.cy] : null; });
      return p ? { x: p.cx, y: p.cy, floor: r.floor, poly: poly } : null;
    },
    _look: function () { if (S && S.standing) { look(S.standing); } },
    _noWayIn: function (id) { var r = S && S.world ? P().roomById(S.world, id) : null; if (r) { noWayIn(r); } },
    _youOnPlan: function () { var p = S && S.level === "plan" && S.me.floor === S.planFloor ? youOnPlan() : null; return p ? { x: p.cx, y: p.cy } : null; },
    _workOnPlan: function (id) {
      var h = null;
      if (S) { S.hung.forEach(function (x) { if (x.id === id) { h = x; } }); }
      if (!h || S.level !== "plan" || h.floor !== S.planFloor) { return null; }
      var fl = S.world.floors[h.floor], p = planPoint(h.cx, h.cy, Math.min(fl.z + CUT, (h.z0 + h.z1) / 2));
      return p ? { x: p.cx, y: p.cy } : null;
    },
    _pointers: function () { return S ? Object.keys(S.pointers) : null; },
    _planPaint: function (c, d, h, sh, fit) { return planPaint(c, d, h, sh, fit); },
    _planDots: function () { return S ? S.planDots : null; },
    _screenOf: function (x, y, z) {
      if (!S || !S.cam || S.level !== "walk") { return null; }
      var p = S.caster.project(S.cam, x, y, z), r = S.view.getBoundingClientRect();
      return p ? { x: r.left + p.x * S.dot, y: r.top + p.y * S.dot, t: p.t } : null;
    },
    // Where a hung work is seen in the walk, in the page's pixels (its seen columns' middle, its
    // middle's height), or null if it is not in view.
    _workOnScreen: function (id) {
      var s = S;
      if (!s || !s.cam || s.level !== "walk" || !s.seenLo) { return null; }
      var h = null;
      s.hung.forEach(function (x) { if (x.id === id) { h = x; } });
      if (!h || h.floor !== s.me.floor || s.seenLo[h.i] < 0) { return null; }
      var p = s.caster.project(s.cam, h.cx, h.cy, (h.z0 + h.z1) / 2), r = s.view.getBoundingClientRect();
      if (!p) { return null; }
      return { x: r.left + (s.seenLo[h.i] + s.seenHi[h.i] + 1) / 2 * s.dot, y: r.top + p.y * s.dot,
               d: Math.hypot(h.cx - s.me.x, h.cy - s.me.y) };
    },
    _resetStats: function () { if (S) { S.stats = { frames: 0, total: 0, max: 0, list: [], parts: [0, 0, 0, 0] }; S.planStats = { frames: 0, total: 0, max: 0 }; } }
  };
  window.Walk = api;
}());

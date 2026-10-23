/* Rocket's places, in one-metre blocks: one of the Artist Website's cities,
   or one of its museums or the buildings it has modelled, or a new form made
   of those buildings' sections, with the neighbourhood round it.

   A city is its ground (docs/v2/grounds/city-*.json): every 20 m cell a
   street, a pavement, a park, water or a building of so many storeys, and
   the buildings new forms (forms.js): its built cells gathered into lots and
   each lot a building made of the Architectural Authority's projects'
   sections, one's ground floor, another's storeys, a third's crown. A
   museum or a building is its model (docs/v2/models/<slug>.json, filled in
   by models.js at a metre to the block) stood on the same kind of ground,
   its plot levelled and eased into the streets round it; a new form is a
   model already in blocks, stood the same way. Into a museum its
   rooms are carved from its interior (docs/v2/interiors/<slug>.json):
   every floor, room, doorway and stair the file draws, the whole turned by
   the file's grid so the main walls lie along the blocks; where two floors
   have no stair between them one is laid, and the door is cut where the
   file says. A building with no plan is hollowed out, its floor boarded,
   and a door cut toward where you came down, its rooms called after the
   sections they are in (a new form's, after the sections it is made of,
   with a wall kept where two of them meet). Then the works are hung on
   the rooms' walls, the pieces of the rocket hidden and the notes left.

   No DOM: window.RocketPlace in the page, module.exports in Node, where a
   test builds a place without a page. It needs models.js (Models), and for
   the lots and the new forms forms.js (Forms) and its sections. */

(function (root) {
  "use strict";

  var SY = 128, GROUND = 34;
  var floor = Math.floor, round = Math.round, ceil = Math.ceil, min = Math.min, max = Math.max, abs = Math.abs, hypot = Math.hypot;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var ORD = ["ground", "first", "second", "third", "fourth", "fifth", "sixth", "seventh"];

  /* ---- the blocks ------------------------------------------------------------ */

  var B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, ROAD: 4, PAVE: 5, WATER: 6, LOG: 7, LEAVES: 8, BRICK: 9, LIME: 10, CONC: 11,
            GLASS: 12, SLATE: 13, SAND: 14, METAL: 15, SCORCH: 16, RENDER: 17, LOOSE: 18, WHITE: 19, RED: 20, BEDROCK: 21,
            ENGINE: 22, TANK: 23, GUIDE: 24, SHIELD: 25, NOTE: 26, FLOOR: 27, PLASTER: 28 };
  var PIECE_IDS = [B.ENGINE, B.TANK, B.GUIDE, B.SHIELD];
  var OWN = 32, ALL = 64;            // a model's own materials take the ids from 32 to 63
  // Each block's colour, and how the shader draws its figures: 0 plain, 1 grass, 2 log, 3 leaves, 4 glass,
  // 5 brick, 6 water, 7 a piece of the rocket, 8 road, 9 boards, 10 paper, 11 a gallery's plaster.
  var PAL = [], STYLE = [];
  function def(id, rgb, style) { PAL[id] = rgb; STYLE[id] = style || 0; }
  def(B.AIR, [0, 0, 0]); def(B.GRASS, [96, 138, 64], 1); def(B.DIRT, [124, 88, 60]); def(B.STONE, [122, 122, 120]);
  def(B.ROAD, [64, 63, 62], 8); def(B.PAVE, [168, 160, 146]); def(B.WATER, [52, 92, 140], 6); def(B.LOG, [104, 80, 52], 2);
  def(B.LEAVES, [62, 104, 48], 3); def(B.BRICK, [150, 78, 56], 5); def(B.LIME, [216, 204, 176]); def(B.CONC, [170, 168, 162]);
  def(B.GLASS, [150, 186, 204], 4); def(B.SLATE, [84, 92, 104]); def(B.SAND, [210, 190, 140]); def(B.METAL, [150, 152, 156]);
  def(B.SCORCH, [52, 44, 38]); def(B.RENDER, [232, 226, 214]); def(B.LOOSE, [96, 66, 44]); def(B.WHITE, [240, 238, 232]);
  def(B.RED, [188, 58, 46]); def(B.BEDROCK, [40, 40, 42]);
  def(B.ENGINE, [255, 168, 64], 7); def(B.TANK, [120, 220, 255], 7); def(B.GUIDE, [150, 255, 140], 7); def(B.SHIELD, [255, 120, 200], 7);
  def(B.NOTE, [246, 238, 214], 10); def(B.FLOOR, [150, 108, 70], 9); def(B.PLASTER, [228, 222, 210], 11);
  for (var b0 = 0; b0 < ALL; b0 += 1) { if (!PAL[b0]) { def(b0, [255, 0, 255]); } }

  // A model's materials as blocks: the ones the city has already, else each its own colour.
  var SAME = { grass: B.GRASS, water: B.WATER, soil: B.DIRT, sand: B.SAND, paving: B.PAVE, glass: B.GLASS, brick: B.BRICK,
               limestone: B.LIME, render: B.RENDER, white: B.WHITE, concrete: B.CONC, slate: B.SLATE, metal: B.METAL, steel: B.METAL };
  var LEAFY = { plant: 1, lavender: 1, sage: 1 }, WOODY = { wood: 1, timber: 1, ebony: 1 };
  var COURSED = { palebrick: 1, paintbrick: 1, tile: 1, bluetile: 1, sandstone: 1 };
  // What a model lays on its ground rather than builds (as models.js has it).
  var GROUNDS = { soil: 1, grass: 1, drygrass: 1, plant: 1, lavender: 1, sage: 1, sand: 1, gravel: 1, paving: 1, water: 1 };

  function World(sx, sz) {
    this.SX = sx; this.SZ = sz; this.SY = SY;
    this.data = new Uint8Array(sx * SY * sz);
    this.top = new Int16Array(sx * sz);        // each column's highest block to stand on
    this.kind = new Uint8Array(sx * sz);       // what the ground says of it: . b = g ~
    this.pal = PAL.slice(); this.style = STYLE.slice(); this.mats = {}; this.next = OWN;
    this.SOLID = new Uint8Array(ALL); this.SEE = new Uint8Array(ALL);
    for (var b = 0; b < ALL; b += 1) { this.tables(b); }
  }
  // Solid: stood on and stopped by. See-through: the faces next to it are drawn.
  World.prototype.tables = function (b) {
    this.SOLID[b] = b !== B.AIR && b !== B.WATER && b !== B.NOTE ? 1 : 0;
    this.SEE[b] = !this.SOLID[b] || b === B.GLASS || this.style[b] === 3 ? 1 : 0;
  };
  World.prototype.get = function (x, y, z) {
    if (x < 0 || z < 0 || x >= this.SX || z >= this.SZ || y >= SY) { return B.AIR; }
    if (y < 0) { return B.BEDROCK; }
    return this.data[(y * this.SZ + z) * this.SX + x];
  };
  World.prototype.set = function (x, y, z, b) {
    if (x >= 0 && z >= 0 && y >= 0 && x < this.SX && z < this.SZ && y < SY) { this.data[(y * this.SZ + z) * this.SX + x] = b; }
  };
  World.prototype.mat = function (name) {
    if (SAME[name]) { return SAME[name]; }
    if (this.mats[name]) { return this.mats[name]; }
    var M = root.Models && root.Models.MATERIALS[name];
    if (!M || !M.c || this.next >= ALL) { return B.CONC; }
    var id = this.next;
    this.next += 1;
    this.pal[id] = M.c.slice();
    this.style[id] = LEAFY[name] ? 3 : WOODY[name] ? 9 : COURSED[name] ? 5 : name === "drygrass" ? 1 : 0;
    this.tables(id);
    this.mats[name] = id;
    return id;
  };
  function groundBlock(w, name) {
    return name === "grass" ? B.GRASS : name === "soil" ? B.DIRT : name === "sand" ? B.SAND : name === "paving" ? B.PAVE :
           name === "water" ? B.WATER : w.mat(name);
  }

  function hash(a, b, c) { var h = Math.sin(a * 127.1 + b * 311.7 + (c || 0) * 74.7) * 43758.5453; return h - floor(h); }
  function rng(seed) {
    var s = (floor(seed) >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function copy(o) { var c = {}; for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { c[k] = o[k]; } } return c; }

  /* The frame: the world's blocks along the grid of the place's plan (turned
     by its interior's grid.turn from the model's x east, y south), the
     place's point in the middle of the world. */
  function frame(w, turn) {
    var a = (turn || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hx = w.SX / 2, hz = w.SZ / 2;
    return {
      turn: turn || 0,
      model: function (x, z) { var gx = x + 0.5 - hx, gy = z + 0.5 - hz; return [gx * c - gy * s, gx * s + gy * c]; },
      grid: function (mx, my) { return [mx * c + my * s, -mx * s + my * c]; },
      gridOf: function (x, z) { return [x + 0.5 - hx, z + 0.5 - hz]; },
      block: function (mx, my) { return [floor(mx * c + my * s + hx), floor(-mx * s + my * c + hz)]; }
    };
  }

  /* ---- the ground ------------------------------------------------------------ */

  function readGround(g) {
    var n = g.n, c = g.side / n, half = g.side / 2, kind = g.kind, tall = g.tall || "", gr = g.ground || [], built = g.built || [];
    var year = new Int16Array(n * n), bi = 0, q, i, j;
    for (q = 0; q < n * n; q += 1) { if (kind[q] === "b") { year[q] = built[bi] || 0; bi += 1; } }
    var raw = function (i2, j2) { i2 = max(0, min(n - 1, i2)); j2 = max(0, min(n - 1, j2)); return (gr[j2 * n + i2] || 0) / 2; };
    var soft = new Float32Array(n * n);
    for (j = 0; j < n; j += 1) {
      for (i = 0; i < n; i += 1) {
        var s = 0;
        for (var dj = -2; dj <= 2; dj += 1) { for (var di = -2; di <= 2; di += 1) { s += raw(i + di, j + dj); } }
        soft[j * n + i] = s / 25;
      }
    }
    var at = function (i2, j2) { return soft[max(0, min(n - 1, j2)) * n + max(0, min(n - 1, i2))]; };
    return {
      n: n, c: c, half: half, soft: soft, year: year,
      K: function (i2, j2) { return i2 < 0 || j2 < 0 || i2 >= n || j2 >= n ? "." : kind[j2 * n + i2]; },
      storeys: function (i2, j2) { return i2 < 0 || j2 < 0 || i2 >= n || j2 >= n ? 0 : (tall.charCodeAt(j2 * n + i2) || 48) - 48; },
      cell: function (mx, my) { return [floor((mx + half) / c), floor((my + half) / c)]; },
      // The ground's height, smoothly between the cells' heights.
      h: function (mx, my) {
        var fx = (mx + half) / c - 0.5, fy = (my + half) / c - 0.5, i0 = floor(fx), j0 = floor(fy), u = fx - i0, v = fy - j0;
        return (at(i0, j0) * (1 - u) + at(i0 + 1, j0) * u) * (1 - v) + (at(i0, j0 + 1) * (1 - u) + at(i0 + 1, j0 + 1) * u) * v;
      }
    };
  }

  /* Every column from the cell its middle falls in: at(x, z) gives the
     column's place in the ground's metres, href the height that is the
     world's GROUND. Streets of asphalt with a pavement where they meet a
     building, parks, water to swim in, and the buildings of their storeys:
     with the sections of the Architectural Authority's projects (opt.forms,
     forms.js) each a new one made of them, on a lot of a cell or a few
     (buildLots); without, a block of lime, brick, render, concrete or glass
     by its age with a grid of windows. opt.keepOut(x, z): ground left open,
     where the place's own building or the crash will be. */
  function fillGround(w, G, at, href, opt) {
    var SX = w.SX, SZ = w.SZ, top = w.top, x, y, z, S = opt && opt.forms, cellAt = S ? new Int32Array(SX * SZ).fill(-1) : null;
    var hAt = function (x2, z2) { var m = at(x2, z2); return max(6, min(SY - 40, round(GROUND + G.h(m[0], m[1]) - href))); };
    for (z = 0; z < SZ; z += 1) {
      for (x = 0; x < SX; x += 1) {
        var m = at(x, z), cl = G.cell(m[0], m[1]), k = G.K(cl[0], cl[1]), y0 = hAt(x, z), c = z * SX + x;
        w.kind[c] = k.charCodeAt(0);
        if (k === "b") { y0 = hAt(floor(x / 4) * 4, floor(z / 4) * 4); }
        if (k === "b" && cellAt) {
          for (y = 0; y < y0; y += 1) { w.set(x, y, z, y === 0 ? B.BEDROCK : y < y0 - 3 ? B.STONE : y < y0 - 1 ? B.DIRT : B.PAVE); }
          top[c] = y0 - 1;
          cellAt[c] = cl[1] * G.n + cl[0];
          if (opt.keepOut && opt.keepOut(x, z)) { w.kind[c] = 46; }
          continue;
        }
        for (y = 0; y < y0 - 3; y += 1) { w.set(x, y, z, y === 0 ? B.BEDROCK : B.STONE); }
        for (y = max(0, y0 - 3); y < y0; y += 1) { w.set(x, y, z, B.DIRT); }
        var surf = B.PAVE;
        if (k === "g") { surf = B.GRASS; }
        else if (k === "=") {
          var lx = m[0] + G.half - cl[0] * G.c, lz = m[1] + G.half - cl[1] * G.c;
          var nearB = (lx < 2.5 && G.K(cl[0] - 1, cl[1]) === "b") || (lx > G.c - 2.5 && G.K(cl[0] + 1, cl[1]) === "b") ||
                      (lz < 2.5 && G.K(cl[0], cl[1] - 1) === "b") || (lz > G.c - 2.5 && G.K(cl[0], cl[1] + 1) === "b");
          surf = nearB ? B.PAVE : B.ROAD;
        } else if (k === "~") {
          for (y = y0 - 4; y < y0 - 1; y += 1) { w.set(x, y, z, y === y0 - 4 ? B.SAND : B.WATER); }
          w.set(x, y0 - 5, z, B.SAND);
          for (y = y0 - 1; y < y0; y += 1) { w.set(x, y, z, B.AIR); }
          top[c] = y0 - 2;
          continue;
        }
        w.set(x, y0 - 1, z, surf);
        top[c] = y0 - 1;
        if (k === "b") {
          var storeys = max(1, G.storeys(cl[0], cl[1])), hb = min(SY - y0 - 2, round(storeys * 3.2));
          var yr = G.year[cl[1] * G.n + cl[0]] || 0, hv = hash(cl[0], cl[1]);
          var wall = storeys >= 20 ? (hv < 0.5 ? B.GLASS : B.CONC) : yr && yr < 1900 ? (hv < 0.55 ? B.LIME : hv < 0.8 ? B.BRICK : B.RENDER) :
                     yr && yr < 1960 ? (hv < 0.5 ? B.BRICK : B.LIME) : yr ? (hv < 0.5 ? B.CONC : B.RENDER) : (hv < 0.5 ? B.RENDER : B.BRICK);
          var roof = yr && yr < 1920 && storeys < 12 ? B.SLATE : B.CONC;
          for (y = y0; y < y0 + hb; y += 1) { w.set(x, y, z, wall); }
          w.set(x, y0 + hb, z, roof);
          top[c] = y0 + hb;
        }
      }
    }
    if (cellAt) { w.lots = buildLots(w, G, cellAt, hAt, S); return hAt; }
    // The windows: a grid of glass in every outside wall, a storey (three blocks) apart.
    for (z = 1; z < SZ - 1; z += 1) {
      for (x = 1; x < SX - 1; x += 1) {
        var t = top[z * SX + x], g0 = hAt(x, z);
        for (y = g0 + 1; y < t - 1; y += 1) {
          var b = w.get(x, y, z);
          if (b !== B.LIME && b !== B.BRICK && b !== B.RENDER && b !== B.CONC) { continue; }
          var ex = !w.SOLID[w.get(x + 1, y, z)] || !w.SOLID[w.get(x - 1, y, z)], ez = !w.SOLID[w.get(x, y, z + 1)] || !w.SOLID[w.get(x, y, z - 1)];
          if (!ex && !ez) { continue; }
          var along = ex ? z : x;
          if ((y - g0) % 3 !== 0 && along % 3 !== 0) { w.set(x, y, z, B.GLASS); }
        }
      }
    }
    return hAt;
  }

  /* The lots: the ground's built cells gathered, row by row, into lots of
     one to three cells a side (cells of a like height), and on each a
     building made of the projects' sections (Forms.tower): one's ground
     floor over the whole lot, another's storeys over it to the cells'
     height, a third's roof or lookout, its bays and storeys repeated to fit.
     A cell any of whose ground is to be kept open is left as paving. Each
     lot keeps which section every block of it came from (partAt). */
  function buildLots(w, G, cellAt, hAt, S) {
    var SX = w.SX, SZ = w.SZ, n = G.n, cells = {}, order = [], lots = [], out = [], taken = {}, c;
    w.lot = new Int16Array(SX * SZ);
    for (c = 0; c < SX * SZ; c += 1) {
      var q = cellAt[c];
      if (q < 0) { continue; }
      if (!cells[q]) { cells[q] = { q: q, i: q % n, j: floor(q / n), cols: [], open: false }; order.push(cells[q]); }
      cells[q].cols.push(c);
      // A cell with ground to keep open is open altogether: no building cut in two.
      if (w.kind[c] === 46) { cells[q].open = true; }
    }
    order.sort(function (a, b) { return a.q - b.q; });
    var free = function (i, j, st) { var f = cells[j * n + i]; return f && !f.open && !taken[f.q] && abs(G.storeys(i, j) - st) <= 2; };
    order.forEach(function (e) {
      if (taken[e.q]) { return; }
      if (e.open) { e.cols.forEach(function (c2) { w.kind[c2] = 46; }); taken[e.q] = 1; return; }
      var st = G.storeys(e.i, e.j), want = [1 + floor(hash(e.i, e.j, 3) * 2.6), 1 + floor(hash(e.j, e.i, 5) * 2.2)], wi = 1, wj = 1, ii, jj, t;
      var col = function (i0) { for (t = 0; t < wj; t += 1) { if (!free(i0, e.j + t, st)) { return false; } } return true; };
      var row = function (j0) { for (t = 0; t < wi; t += 1) { if (!free(e.i + t, j0, st)) { return false; } } return true; };
      while (wi < want[0] && col(e.i + wi)) { wi += 1; }
      while (wj < want[1] && row(e.j + wj)) { wj += 1; }
      var lot = { cols: [], storeys: 1, i: e.i, j: e.j };
      for (jj = 0; jj < wj; jj += 1) {
        for (ii = 0; ii < wi; ii += 1) {
          var f = cells[(e.j + jj) * n + e.i + ii];
          taken[f.q] = 1;
          Array.prototype.push.apply(lot.cols, f.cols);
          lot.storeys = max(lot.storeys, G.storeys(e.i + ii, e.j + jj));
        }
      }
      lots.push(lot);
    });
    lots.forEach(function (lot) {
      var x0 = SX, x1 = -1, z0 = SZ, z1 = -1;
      lot.cols.forEach(function (c2) { var X = c2 % SX, Z = (c2 - X) / SX; x0 = min(x0, X); x1 = max(x1, X); z0 = min(z0, Z); z1 = max(z1, Z); });
      var W = x1 - x0 + 1, D = z1 - z0 + 1;
      // A sliver at the world's edge is left as paving.
      if (W < 5 || D < 5) { lot.cols.forEach(function (c2) { w.kind[c2] = 46; }); return; }
      var y0 = hAt(round((x0 + x1) / 2), round((z0 + z1) / 2)), H = min(SY - y0 - 8, max(3, round(lot.storeys * 3.2)));
      var R = root.Forms.tower(S, floor(hash(lot.i, lot.j, 77) * 1e6) + 1, W, D, H);
      if (!R) { return; }
      var L = { x0: x0 - R.ox, z0: z0 - R.oy, y0: y0, nx: R.nx, ny: R.ny, nz: R.nz, from: R.from, placed: R.placed, name: R.name, recipe: R.recipe };
      out.push(L);
      var id = out.length;
      lot.cols.forEach(function (c2) {
        var X = c2 % SX, Z = (c2 - X) / SX, i = X - L.x0, j = Z - L.z0, y, tp = y0 - 1;
        for (y = 1; y < SY; y += 1) { w.set(X, y, Z, y < y0 - 4 ? B.STONE : y < y0 - 1 ? B.DIRT : y === y0 - 1 ? B.PAVE : B.AIR); }
        if (i >= 0 && j >= 0 && i < R.nx && j < R.ny) {
          for (var k = 0; k < R.nz; k += 1) {
            var v = R.grid[(k * R.ny + j) * R.nx + i];
            if (v) { w.set(X, y0 + k, Z, w.mat(R.names[v - 1])); tp = y0 + k; }
          }
        }
        w.top[c2] = tp;
        w.lot[c2] = id;
      });
    });
    return out;
  }

  /* Which section of which project a block came from: in a lot, in a new
     form, or (by its sections' boxes) in a building the site has modelled. */
  function partAt(place, x, y, z) {
    var w = place.w, c = z * w.SX + x;
    if (x < 0 || z < 0 || x >= w.SX || z >= w.SZ) { return null; }
    if (w.lot && w.lot[c]) {
      var L = w.lots[w.lot[c] - 1], i = x - L.x0, j = z - L.z0, k = y - L.y0;
      var P = k >= 0 && k < L.nz && i >= 0 && j >= 0 && i < L.nx && j < L.ny ? L.placed[L.from[(k * L.ny + j) * L.nx + i] - 1] : null;
      return { name: P && P.sec ? P.sec.name : "", from: P ? P.from : "", lot: L };
    }
    return place.part ? place.part(x, y, z) : null;
  }

  /* Oaks, as the blocky world grows them. */
  function oak(w, x, y, z, h) {
    for (var t = 0; t < h; t += 1) { w.set(x, y + t, z, B.LOG); }
    for (var dy = h - 2; dy <= h + 1; dy += 1) {
      var r = dy >= h ? 1 : 2;
      for (var dz = -r; dz <= r; dz += 1) {
        for (var dx = -r; dx <= r; dx += 1) {
          if (abs(dx) === r && abs(dz) === r && (dy > h - 1 || hash(x + dx, y + dy, z + dz) < 0.5)) { continue; }
          if (w.get(x + dx, y + dy, z + dz) === B.AIR) { w.set(x + dx, y + dy, z + dz, B.LEAVES); }
        }
      }
    }
    return { x: x, z: z, top: y + h + 1 };
  }
  function plantTrees(w, keep) {
    var SX = w.SX, SZ = w.SZ, trees = [], taken = new Uint8Array(SX * SZ);
    for (var z = 4; z < SZ - 4; z += 1) {
      for (var x = 4; x < SX - 4; x += 1) {
        var c = z * SX + x, t = w.top[c];
        if (taken[c] || hash(x, z) > 0.012 || w.get(x, t, z) !== B.GRASS || w.get(x, t + 1, z) !== B.AIR || (keep && !keep(c))) { continue; }
        trees.push(oak(w, x, t + 1, z, 4 + floor(hash(z, x) * 3)));
        for (var dz = -4; dz <= 4; dz += 1) { for (var dx = -4; dx <= 4; dx += 1) { taken[max(0, min(SX * SZ - 1, (z + dz) * SX + x + dx))] = 1; } }
      }
    }
    return trees;
  }

  /* Where you came down: everything over the ground cleared away (what the
     model has built is kept), a lawn, your tree, the capsule broken open in
     a scorched crater on the far side of it from the building. */
  function crashSite(w, cx, cz, opt) {
    var SX = w.SX, SZ = w.SZ, top = w.top, M = opt.keep, R = opt.clear, L = opt.lawn, x, y, z;
    var cy = top[cz * SX + cx] + 1;
    for (z = cz - R; z <= cz + R; z += 1) {
      for (x = cx - R; x <= cx + R; x += 1) {
        if (x < 1 || z < 1 || x >= SX - 1 || z >= SZ - 1) { continue; }
        var c = z * SX + x;
        if (w.lot && w.lot[c]) { continue; }
        for (y = cy; y < SY; y += 1) {
          var b = w.get(x, y, z);
          if (b !== B.AIR && b !== B.WATER && !(M && M.has(x, y, z))) { w.set(x, y, z, B.AIR); }
        }
        if (M && M.foot[c]) { continue; }
        var ty = cy - 1;
        while (ty > 0 && w.get(x, ty, z) === B.AIR) { ty -= 1; }
        var tb = w.get(x, ty, z);
        if ((tb === B.PAVE || tb === B.ROAD) && hypot(x - cx, z - cz) < L) { w.set(x, ty, z, B.GRASS); }
        top[c] = ty;
      }
    }
    var you = oak(w, cx, cy, cz, 6);
    var ax = opt.away ? opt.away[0] : 0.914, az = opt.away ? opt.away[1] : -0.406;
    var wx = cx + round(ax * 9.85), wz = cz + round(az * 9.85);
    for (z = wz - 4; z <= wz + 4; z += 1) {
      for (x = wx - 4; x <= wx + 4; x += 1) {
        if (hypot(x - wx, z - wz) >= 4.5) { continue; }
        var t2 = top[z * SX + x];
        w.set(x, t2, z, B.SCORCH);
        if (hypot(x - wx, z - wz) < 2.5) { w.set(x, t2, z, B.AIR); w.set(x, t2 - 1, z, B.SCORCH); top[z * SX + x] = t2 - 1; }
      }
    }
    var wy = top[wz * SX + wx] + 1;
    [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 1], [0, 1, 1], [2, 0, 0], [-1, 0, 1], [0, 2, 0]].forEach(function (d) {
      w.set(wx + d[0], wy + d[1], wz + d[2], B.METAL);
    });
    w.set(wx + 1, wy + 1, wz, B.SCORCH);
    w.set(wx - 3, top[(wz + 3) * SX + wx - 3] + 1, wz + 3, B.METAL);
    w.set(wx + 4, top[(wz - 2) * SX + wx + 4] + 1, wz - 2, B.METAL);
    return { crash: { x: cx + 1.5, y: cy, z: cz + 1.5 }, wreck: { x: wx, y: wy, z: wz }, tree: you };
  }

  /* ---- a city ------------------------------------------------------------------ */

  // The crash: a park near the middle with water and a tall building within reach, if the city has them. The counts
  // of buildings asked for were set for a city 384 across; in a smaller one, as much fewer as its window is smaller.
  function cityPark(G, SX) {
    var n = G.n, best = -1, bestS = -1e9, R = floor(SX / 2 / G.c), i, j, di, dj;
    var R0 = floor(384 / 2 / G.c), share = Math.pow((2 * R - 3) / (2 * R0 - 3), 2), FEW = 40 * share, MANY = 140 * share;
    for (j = 4; j < n - 4; j += 2) {
      for (i = 4; i < n - 4; i += 2) {
        if (G.K(i, j) !== "g") { continue; }
        // A park in the city, not a forest beside it: buildings all round, water if there is any,
        // and a building of a few storeys near enough to climb.
        var greens = 0, water = 0, blds = 0, mid = 0;
        for (dj = -1; dj <= 1; dj += 1) { for (di = -1; di <= 1; di += 1) { if (G.K(i + di, j + dj) === "g") { greens += 1; } } }
        for (dj = -R + 2; dj <= R - 2; dj += 1) {
          for (di = -R + 2; di <= R - 2; di += 1) {
            var k2 = G.K(i + di, j + dj);
            if (k2 === "~") { water += 1; }
            if (k2 === "b") { blds += 1; var st = G.storeys(i + di, j + dj); if (st >= 4 && st <= 7 && abs(di) + abs(dj) < R) { mid += 1; } }
          }
        }
        var sc = min(MANY, blds) / share + min(10, water) * 5 + min(6, mid) * 4 + greens - hypot(i - n / 2, j - n / 2) * 0.1;
        if (greens >= 5 && blds >= FEW && sc > bestS) { bestS = sc; best = j * n + i; }
      }
    }
    return best < 0 ? floor(n / 2) * n + floor(n / 2) : best;
  }

  /* How far the world reaches round what it is made for (artist, 21 Oct 2026: "cut the surrounding space down in half
     for now to make the development of it more efficient"): a city half its 384, a building's place its model and half
     the ground it had round it, S0 = 256, or a museum's 320 to 512, to the next 16 (a chunk), never more than before. */
  var CITY = 192;
  function halfSurround(S0, span) { return min(S0, ceil((S0 + span) / 2 / 16) * 16); }
  function makeCity(g, forms) {
    var w = new World(CITY, CITY), SX = w.SX, SZ = w.SZ, G = readGround(g);
    var best = cityPark(G, SX), ci = best % G.n, cj = floor(best / G.n);
    var ox = (ci + 0.5) * G.c - G.half - SX / 2, oz = (cj + 0.5) * G.c - G.half - SZ / 2;
    var hAt = fillGround(w, G, function (x, z) { return [x + ox, z + oz]; }, G.soft[best],
                         { forms: forms, keepOut: function (x, z) { return hypot(x - SX / 2, z - SZ / 2) < 24; } });
    var trees = plantTrees(w, null);
    var cx = SX / 2, cz = SZ / 2, site = crashSite(w, cx, cz, { clear: 20, lawn: 17 });
    trees = trees.filter(function (tr) { return abs(tr.x - cx) > 22 || abs(tr.z - cz) > 22; });
    return { kind: "city", w: w, hAt: hAt, trees: trees, crash: site.crash, wreck: site.wreck, tree: site.tree,
             centre: { x: cx, z: cz }, rooms: [], floors: [], roomById: {}, door: null, M: null, lots: w.lots || [] };
  }

  /* ---- a museum or a building ----------------------------------------------------- */

  function partTop(p) {
    var a = p.box || p.gable || p.shed || p.hip, t = 0;
    if (p.mesh) { for (var q = 2; q < p.mesh.v.length; q += 3) { t = max(t, p.mesh.v[q]); } return t; }
    if (p.prism) { return (p.z || 0) + (p.h || 0); }
    if (a) { return a[2] + a[5] + (p.thick || 0); }
    if (p.cyl) { return p.cyl[2] + p.cyl[4]; }
    if (p.dome) { return p.dome[2] + p.dome[3]; }
    if (p.blob) { return p.blob[2] + p.blob[5]; }
    return 0;
  }
  // What is built and stands over a metre: no trees, pools, lawns or paving (as Models.inset has it).
  function builtPart(p) { return p.cut || p.pcut || (!p.tree && !p.pool && !GROUNDS[p.m || "concrete"] && partTop(p) > 1); }

  /* The model at a metre to the block, each column filled from the voxel its
     middle falls in, on a plot levelled to the ground at the model's middle
     (three metres round the site, then eased over eleven into the ground
     round it). What it lays on the ground (paving, lawns, water) is the
     plot's surface; what it builds stands on it. */
  function placeModel(w, spec, F, hAt) {
    var Models = root.Models, SX = w.SX, SZ = w.SZ, x, y, z, c, k, q, vx, bv;
    if (spec.blocks) {
      // A new form (forms.js), in blocks already: all of it, and what of it is built.
      var R = spec.blocks;
      vx = { nx: R.nx, ny: R.ny, nz: R.nz, grid: R.grid, names: R.names, site: [R.nx, R.ny] };
      bv = { nz: R.nz, grid: spec.built };
    } else {
      var s1 = copy(spec);
      s1.voxel = 1;
      vx = Models.voxelize(s1);
      var sb = copy(s1);
      sb.parts = (spec.parts || []).filter(builtPart);
      bv = sb.parts.some(function (p) { return !p.cut; }) ? Models.voxelize(sb) : null;
    }
    var nx = vx.nx, ny = vx.ny, plane = nx * ny, site = vx.site, base = GROUND, hx = site[0] / 2, hy = site[1] / 2;
    var colOf = new Int32Array(SX * SZ), foot = new Uint8Array(SX * SZ), colTop = new Int16Array(SX * SZ), plot = new Uint8Array(SX * SZ);
    var x0 = SX, x1 = -1, z0 = SZ, z1 = -1, pool = [];
    for (z = 0; z < SZ; z += 1) {
      for (x = 0; x < SX; x += 1) {
        c = z * SX + x;
        colOf[c] = -1; colTop[c] = -1;
        var m = F.model(x, z), i = floor(m[0] + hx), j = floor(m[1] + hy);
        // The plot.
        var dx = max(0, abs(m[0]) - hx), dy = max(0, abs(m[1]) - hy), dd = hypot(dx, dy);
        if (dd <= 14) {
          plot[c] = 1;
          var nat = hAt(x, z) - 1, ys = dd <= 3 ? base - 1 : round(base - 1 + (nat - (base - 1)) * (dd - 3) / 11);
          var kc = String.fromCharCode(w.kind[c]), surf = dd <= 0 ? groundBlock(w, spec.ground || "paving") : kc === "g" ? B.GRASS : kc === "=" ? B.ROAD : B.PAVE;
          var wet = dd > 3 && kc === "~";
          for (y = 0; y < SY; y += 1) {
            w.set(x, y, z, y === 0 ? B.BEDROCK : y < ys - 3 ? B.STONE : y < ys ? (wet && y >= ys - 2 ? B.WATER : B.DIRT) : y === ys && !wet ? surf : B.AIR);
          }
          w.top[c] = wet ? ys - 1 : ys;
          if (kc === "b") { w.kind[c] = 46; }
        }
        if (i < 0 || j < 0 || i >= nx || j >= ny) { continue; }
        colOf[c] = j * nx + i;
        x0 = min(x0, x); x1 = max(x1, x); z0 = min(z0, z); z1 = max(z1, z);
        if (bv) {
          for (k = bv.nz - 1; k >= 1; k -= 1) { if (bv.grid[k * plane + colOf[c]]) { foot[c] = 1; colTop[c] = base + k; break; } }
        }
      }
    }
    for (z = z0; z <= z1; z += 1) {
      for (x = x0; x <= x1; x += 1) {
        c = z * SX + x;
        q = colOf[c];
        if (q < 0) { continue; }
        for (k = 0; k < vx.nz; k += 1) {
          var mv = vx.grid[k * plane + q];
          if (!mv) { continue; }
          var name = vx.names[mv - 1];
          if (k === 0 && GROUNDS[name]) {
            if (name === "water") {
              w.set(x, base - 1, z, B.AIR); w.set(x, base - 2, z, B.WATER); w.set(x, base - 3, z, B.WATER); w.set(x, base - 4, z, B.SAND);
              w.top[c] = base - 2;
              pool.push(c);
            } else { w.set(x, base - 1, z, groundBlock(w, name)); }
            continue;
          }
          w.set(x, base + k, z, w.mat(name));
          if (w.top[c] < base + k) { w.top[c] = base + k; }
          if (name === "water") { pool.push(c); }
        }
      }
    }
    return {
      base: base, site: site, nz: max(vx.nz, bv ? bv.nz : 0), foot: foot, colTop: colTop, colOf: colOf, plot: plot, pool: pool,
      x0: x0, x1: x1, z0: z0, z1: z1, mid: F.block(0, 0),
      has: function (x2, y2, z2) {
        if (!bv || x2 < 0 || z2 < 0 || x2 >= SX || z2 >= SZ) { return false; }
        var q2 = colOf[z2 * SX + x2], kk = y2 - base;
        return q2 >= 0 && kk >= 0 && kk < bv.nz && !!bv.grid[kk * plane + q2];
      },
      // In a new form, the blocks where one volume meets another stay when it is hollowed: a wall between.
      keep: spec.blocks ? function (x2, y2, z2) {
        var R2 = spec.blocks, at = function (X, Y, Z) {
          if (X < 0 || Z < 0 || X >= SX || Z >= SZ) { return 0; }
          var q3 = colOf[Z * SX + X], k3 = Y - base, o = q3 >= 0 && k3 >= 0 && k3 < R2.nz ? R2.from[k3 * plane + q3] : 0;
          return o && VOLUME[R2.placed[o - 1].role] ? o : 0;
        };
        var o0 = at(x2, y2, z2);
        if (!o0) { return false; }
        for (var f = 0; f < 6; f += 1) {
          var o1 = at(x2 + (f === 0) - (f === 1), y2 + (f === 2) - (f === 3), z2 + (f === 4) - (f === 5));
          if (o1 && o1 !== o0) { return true; }
        }
        return false;
      } : null
    };
  }
  var VOLUME = { base: 1, wing: 1, upper: 1, lookout: 1 }, GROUNDED = { pool: 1, terrace: 1, tree: 1 };

  // A room's outline in the grid, and whether a point is inside it by a margin.
  function inPoly(p, x, y) {
    var ins = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
      var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) { ins = !ins; }
    }
    return ins;
  }
  function shapeOf(rm, F) {
    if (rm.rect) {
      var g = F.grid(rm.rect[0], rm.rect[1]);
      var r = [min(g[0], g[0] + rm.rect[2]), min(g[1], g[1] + rm.rect[3]), max(g[0], g[0] + rm.rect[2]), max(g[1], g[1] + rm.rect[3])];
      return { bb: r, inside: function (x, y, e) { return x >= r[0] + e && x <= r[2] - e && y >= r[1] + e && y <= r[3] - e; } };
    }
    if (rm.circle) {
      var cc = F.grid(rm.circle[0], rm.circle[1]), rr = rm.circle[2];
      return { bb: [cc[0] - rr, cc[1] - rr, cc[0] + rr, cc[1] + rr], inside: function (x, y, e) { return hypot(x - cc[0], y - cc[1]) <= rr - e; } };
    }
    if (rm.poly && rm.poly.length >= 3) {
      var p = rm.poly.map(function (pt) { return F.grid(pt[0], pt[1]); }), bb = [1e9, 1e9, -1e9, -1e9];
      p.forEach(function (pt) { bb[0] = min(bb[0], pt[0]); bb[1] = min(bb[1], pt[1]); bb[2] = max(bb[2], pt[0]); bb[3] = max(bb[3], pt[1]); });
      return { bb: bb, inside: function (x, y, e) {
        return inPoly(p, x, y) && (!e || (inPoly(p, x + e, y) && inPoly(p, x - e, y) && inPoly(p, x, y + e) && inPoly(p, x, y - e)));
      } };
    }
    return null;
  }
  function blockBox(bb, w) {
    return [max(1, floor(bb[0] + w.SX / 2)), max(1, floor(bb[1] + w.SZ / 2)), min(w.SX - 2, floor(bb[2] + w.SX / 2)), min(w.SZ - 2, floor(bb[3] + w.SZ / 2))];
  }

  /* A museum's rooms, carved into its model from its interior file. Each
     floor is a level of boards a whole number of metres over the ground
     (four at least over the one below); each room every block whose middle
     is 0.6 m inside its outline, as high as the room (five metres where the
     file does not say) under the floor above and the model's roof; the
     doorways three blocks wide where the file puts them (a room drawn in
     parts has no wall between them); the stairs as the file lays them, and
     where two floors have none between them, one of a block's rise to the
     block, two wide, inside rooms on both; the door from outside to the
     nearest room. Walls thick enough, and the ceilings, are plastered. */
  function carveInterior(w, it, M, F) {
    var SX = w.SX, SZ = w.SZ, base = M.base, x, y, z, c;
    var fls = (it.floors || []).slice().sort(function (a, b) { return a.z - b.z; });
    var floors = [], prev = -1e9, g0 = 0, byId = {};
    fls.forEach(function (f, i) {
      var fy = base - 1 + round(f.z);
      if (fy < prev + 4) { fy = prev + 4; }
      prev = fy;
      floors.push({ id: f.id, name: f.name || "", fz: fy, cols: new Int16Array(SX * SZ), rooms: [] });
      byId[f.id] = i;
      if (abs(f.z) < abs(fls[g0].z)) { g0 = i; }
    });
    floors.forEach(function (FL, i) {
      FL.top = i + 1 < floors.length ? floors[i + 1].fz - 1 : FL.fz + 8;
      FL.ord = i - g0;
      FL.label = FL.name || (FL.ord >= 0 ? ORD[FL.ord] || "upper" : FL.ord === -1 ? "lower ground" : "basement");
    });
    var rooms = [], shapes = {}, idxOf = {}, where = {};
    var en = it.enter && it.enter.door ? it.enter : null;
    var aim = en ? F.block(en.door[0], en.door[1]) : M.mid;

    fls.forEach(function (f, fi) {
      var FL = floors[fi], y0 = FL.fz, under = y0 < base - 1;
      (f.rooms || []).forEach(function (rm) {
        if (rm.kind === "void" || rm.kind === "closed") { return; }
        var shp = shapeOf(rm, F);
        if (!shp) { return; }
        shapes[fi + ":" + rm.id] = shp;
        where[rm.id] = { x: (shp.bb[0] + shp.bb[2]) / 2 + SX / 2, z: (shp.bb[1] + shp.bb[3]) / 2 + SZ / 2, floor: fi };
        var H = rm.h ? max(3, round(rm.h)) : 5, idx = rooms.length + 1, bx = blockBox(shp.bb, w);
        var room = { id: rm.id, name: rm.name || "", kind: rm.kind || "gallery", floor: fi, fz: y0, ceil: 1e9, idx: idx, blocks: [], fzs: [], tops: [] };
        for (z = bx[1]; z <= bx[3]; z += 1) {
          for (x = bx[0]; x <= bx[2]; x += 1) {
            var g = F.gridOf(x, z);
            c = z * SX + x;
            if (FL.cols[c] || !shp.inside(g[0], g[1], 0.6)) { continue; }
            var top = min(FL.top, y0 + H);
            if (under) { if (M.colOf[c] < 0) { continue; } }
            else {
              // Inside the model, and a block in from its edge: the outer wall stays.
              if (!M.foot[c] || !M.foot[c - 1] || !M.foot[c + 1] || !M.foot[c - SX] || !M.foot[c + SX]) { continue; }
              top = min(top, M.colTop[c] - 1);
            }
            if (top - y0 < 2) { continue; }
            FL.cols[c] = idx;
            w.set(x, y0, z, B.FLOOR);
            for (y = y0 + 1; y <= top; y += 1) { w.set(x, y, z, B.AIR); }
            room.blocks.push(c); room.fzs.push(y0); room.tops.push(top);
            room.ceil = min(room.ceil, top);
          }
        }
        if (room.blocks.length) { rooms.push(room); FL.rooms.push(room); idxOf[fi + ":" + rm.id] = idx; }
      });
      var cut = function (x2, z2, own) {
        if (x2 < 1 || z2 < 1 || x2 >= SX - 1 || z2 >= SZ - 1) { return; }
        var c2 = z2 * SX + x2, top2 = min(y0 + 3, FL.top);
        if (!under && M.colTop[c2] >= 0) { top2 = min(top2, M.colTop[c2] - 1); }
        if (top2 - y0 < 2) { return; }
        w.set(x2, y0, z2, B.FLOOR);
        for (var y2 = y0 + 1; y2 <= top2; y2 += 1) { w.set(x2, y2, z2, B.AIR); }
        if (own && !FL.cols[c2]) {
          FL.cols[c2] = own;
          var r2 = rooms[own - 1];
          r2.blocks.push(c2); r2.fzs.push(y0); r2.tops.push(top2);
        }
      };
      (f.open || []).forEach(function (o) {
        var A = shapes[fi + ":" + o.a], Bs = shapes[fi + ":" + o.b];
        if (o.kind === "part" && A && Bs && idxOf[fi + ":" + o.a]) {
          // One room in parts: no wall between them at all.
          var bb = blockBox([min(A.bb[0], Bs.bb[0]), min(A.bb[1], Bs.bb[1]), max(A.bb[2], Bs.bb[2]), max(A.bb[3], Bs.bb[3])], w);
          for (var zz = bb[1]; zz <= bb[3]; zz += 1) {
            for (var xx = bb[0]; xx <= bb[2]; xx += 1) {
              var gg = F.gridOf(xx, zz);
              if (!FL.cols[zz * SX + xx] && (A.inside(gg[0], gg[1], -0.05) || Bs.inside(gg[0], gg[1], -0.05))) { cut(xx, zz, idxOf[fi + ":" + o.a]); }
            }
          }
        } else if (o.cut) {
          var s = shapeOf({ rect: o.cut }, F), sb = blockBox(s.bb, w);
          for (var z3 = sb[1]; z3 <= sb[3]; z3 += 1) {
            for (var x3 = sb[0]; x3 <= sb[2]; x3 += 1) { var g3 = F.gridOf(x3, z3); if (s.inside(g3[0], g3[1], 0)) { cut(x3, z3, 0); } }
          }
        } else if (o.at) {
          var d = F.block(o.at[0], o.at[1]);
          for (var dz = -1; dz <= 1; dz += 1) { for (var dx = -1; dx <= 1; dx += 1) { cut(d[0] + dx, d[1] + dz, 0); } }
        }
      });
    });

    // A tread, the stair under it filled, clear over it to the floor above.
    var tread = function (x2, z2, lo, step, cap) {
      for (var y2 = lo + 1; y2 < step; y2 += 1) { w.set(x2, y2, z2, B.PLASTER); }
      w.set(x2, step, z2, B.FLOOR);
      for (y2 = step + 1; y2 <= min(step + 4, cap); y2 += 1) { w.set(x2, y2, z2, B.AIR); }
    };
    var linked = {};
    fls.forEach(function (f) {
      (f.stairs || []).forEach(function (s) {
        var a = byId[s.from], b = byId[s.to];
        if (a === undefined || b === undefined || a === b || !s.rect) { return; }
        if (floors[a].fz > floors[b].fz) { var t = a; a = b; b = t; }
        var lo = floors[a].fz, hi = floors[b].fz, shp = shapeOf({ rect: s.rect }, F), bx = blockBox(shp.bb, w);
        var rise = s.rise || "+x", ax = rise.charAt(1) === "y", neg = rise.charAt(0) === "-";
        for (z = bx[1]; z <= bx[3]; z += 1) {
          for (x = bx[0]; x <= bx[2]; x += 1) {
            var g = F.gridOf(x, z);
            if (!shp.inside(g[0], g[1], 0)) { continue; }
            var u = ax ? (g[1] - shp.bb[1]) / (shp.bb[3] - shp.bb[1]) : (g[0] - shp.bb[0]) / (shp.bb[2] - shp.bb[0]);
            if (neg) { u = 1 - u; }
            tread(x, z, lo, lo + max(1, min(hi - lo, ceil(u * (hi - lo)))), floors[b].top);
          }
        }
        linked[a + ":" + b] = linked[b + ":" + a] = 1;
      });
    });
    var stairs = [];
    for (var i = 0; i + 1 < floors.length; i += 1) {
      if (linked[i + ":" + (i + 1)]) { continue; }
      var A = floors[i], Bf = floors[i + 1], rise = Bf.fz - A.fz, need = rise + 2, best = null;
      for (var wide = 2; wide >= 1 && !best; wide -= 1) {
        for (var ax2 = 0; ax2 < 2; ax2 += 1) {
          var L1 = ax2 ? SX : SZ, L2 = ax2 ? SZ : SX;
          for (var p = 1; p < L1 - 1 - wide; p += 1) {
            var run = 0;
            for (var q = 1; q < L2 - 1; q += 1) {
              var ok = true;
              for (var o2 = 0; o2 < wide && ok; o2 += 1) {
                var X = ax2 ? p + o2 : q, Z = ax2 ? q : p + o2, C = Z * SX + X;
                ok = A.cols[C] > 0 && Bf.cols[C] > 0;
              }
              run = ok ? run + 1 : 0;
              if (run >= need) {
                var q0 = q - need + 1, mx = ax2 ? p : q0 + need / 2, mz = ax2 ? q0 + need / 2 : p, dist = hypot(mx - aim[0], mz - aim[1]);
                if (!best || dist < best.d) { best = { d: dist, ax: ax2, p: p, q0: q0, wide: wide }; }
                run = 0;
              }
            }
          }
        }
      }
      if (!best) { continue; }
      for (var st = 0; st < rise; st += 1) {
        for (var o3 = 0; o3 < best.wide; o3 += 1) {
          var sx = best.ax ? best.p + o3 : best.q0 + 1 + st, sz = best.ax ? best.q0 + 1 + st : best.p + o3;
          tread(sx, sz, A.fz, A.fz + 1 + st, Bf.top);
        }
      }
      stairs.push(best);
    }

    // The door: from where you stand outside, through the wall, to the nearest room.
    var door = null;
    if (en && floors.length) {
      var fi = byId[en.floor] !== undefined ? byId[en.floor] : g0, FL = floors[fi], y0 = FL.fz;
      var db = F.block(en.door[0], en.door[1]), dg = F.grid(en.door[0], en.door[1]);
      var ag = en.at ? F.grid(en.at[0], en.at[1]) : [dg[0] * 1.3, dg[1] * 1.3];
      var vx = dg[0] - ag[0], vz = dg[1] - ag[1], ddx = 0, ddz = 0;
      if (abs(vx) >= abs(vz)) { ddx = vx >= 0 ? 1 : -1; } else { ddz = vz >= 0 ? 1 : -1; }
      var corridor = function (x2, z2, yf, mat) {
        for (var o4 = -1; o4 <= 1; o4 += 1) {
          var X2 = x2 - ddz * o4, Z2 = z2 + ddx * o4;
          if (mat === B.STONE) { for (var y3 = base - 1; y3 < yf; y3 += 1) { w.set(X2, y3, Z2, B.STONE); } }
          if (mat) { w.set(X2, yf, Z2, mat); }
          for (var y4 = yf + 1; y4 <= yf + 3; y4 += 1) { w.set(X2, y4, Z2, B.AIR); }
        }
      };
      var t2, cx2 = db[0], cz2 = db[1];
      for (t2 = 0; t2 < 40; t2 += 1) {
        cx2 = db[0] + ddx * t2; cz2 = db[1] + ddz * t2;
        if (cx2 < 2 || cz2 < 2 || cx2 >= SX - 2 || cz2 >= SZ - 2 || (t2 > 0 && FL.cols[cz2 * SX + cx2])) { break; }
        corridor(cx2, cz2, y0, M.foot[cz2 * SX + cx2] ? B.FLOOR : 0);
      }
      var yf = y0, out = 0;
      for (t2 = 1; t2 < 40; t2 += 1) {
        cx2 = db[0] - ddx * t2; cz2 = db[1] - ddz * t2;
        if (cx2 < 2 || cz2 < 2 || cx2 >= SX - 2 || cz2 >= SZ - 2) { break; }
        var inside = M.foot[cz2 * SX + cx2];
        if (!inside) { out += 1; if (yf > base - 1) { yf -= 1; } }
        corridor(cx2, cz2, yf, inside ? B.FLOOR : yf > base - 1 ? B.STONE : 0);
        if (!inside && out >= 3 && yf <= base - 1) { break; }
      }
      door = { x: cx2 + 0.5, y: yf + 1, z: cz2 + 0.5, dx: -ddx, dz: -ddz };
    }

    // The rooms' walls and ceilings in plaster, where the wall is no outside skin.
    rooms.forEach(function (room) {
      var FL2 = floors[room.floor];
      room.blocks.forEach(function (c2, n) {
        var x2 = c2 % SX, z2 = (c2 - x2) / SX, top2 = room.tops[n], y2;
        DIRS.forEach(function (d) {
          var X3 = x2 + d[0], Z3 = z2 + d[1];
          if (X3 < 1 || Z3 < 1 || X3 >= SX - 1 || Z3 >= SZ - 1 || FL2.cols[Z3 * SX + X3]) { return; }
          for (y2 = room.fz + 1; y2 <= top2; y2 += 1) {
            var b = w.get(X3, y2, Z3);
            if (!w.SOLID[b] || b === B.GLASS || b === B.FLOOR || b === B.PLASTER || w.style[b] === 3) { continue; }
            if (y2 < base || w.SOLID[w.get(X3 + d[0], y2, Z3 + d[1])] || FL2.cols[(Z3 + d[1]) * SX + X3 + d[0]]) { w.set(X3, y2, Z3, B.PLASTER); }
          }
        });
        var cb = w.get(x2, top2 + 1, z2);
        if (w.SOLID[cb] && cb !== B.GLASS && cb !== B.FLOOR && (top2 + 1 < base || w.SOLID[w.get(x2, top2 + 2, z2)])) { w.set(x2, top2 + 1, z2, B.PLASTER); }
      });
    });
    return { floors: floors, rooms: rooms, door: door, stairs: stairs, where: where };
  }

  /* A building with no plan: its built blocks hollowed (each that is solid
     all round is cut away, so its walls and roofs are a block thick), the
     floor of what is under a roof boarded, and a door cut through the wall
     nearest where you came down, with steps up to it if its floor is high. */
  function hollowBuilding(w, M, toward) {
    var SX = w.SX, SZ = w.SZ, base = M.base, y1 = base + M.nz, cut = [], x, y, z, c;
    for (y = base + 1; y < y1; y += 1) {
      for (z = M.z0; z <= M.z1; z += 1) {
        for (x = M.x0; x <= M.x1; x += 1) {
          if (!M.has(x, y, z)) { continue; }
          var all = true;
          for (var dy = -1; dy <= 1 && all; dy += 1) {
            for (var dz = -1; dz <= 1 && all; dz += 1) {
              for (var dx = -1; dx <= 1 && all; dx += 1) { if (!w.SOLID[w.get(x + dx, y + dy, z + dz)]) { all = false; } }
            }
          }
          if (all && !(M.keep && M.keep(x, y, z))) { cut.push(x, y, z); }
        }
      }
    }
    for (var q = 0; q < cut.length; q += 3) { w.set(cut[q], cut[q + 1], cut[q + 2], B.AIR); }
    // What is under a roof: the lowest two clear blocks or more near the ground, something over them.
    var fl = new Int16Array(SX * SZ).fill(-1), ce = new Int16Array(SX * SZ);
    var walled = function (x2, z2) {
      var n = 0;
      DIRS.forEach(function (d) {
        for (var t = 1; t <= 30; t += 1) { var X = x2 + d[0] * t, Z = z2 + d[1] * t; if (X < 0 || Z < 0 || X >= SX || Z >= SZ) { return; } if (M.foot[Z * SX + X]) { n += 1; return; } }
      });
      return n >= 3;
    };
    var scan = function (pass) {
      for (z = M.z0; z <= M.z1; z += 1) {
        for (x = M.x0; x <= M.x1; x += 1) {
          c = z * SX + x;
          if (fl[c] >= 0 || (pass === 0 ? !M.foot[c] : M.foot[c] || M.colOf[c] < 0 || !walled(x, z))) { continue; }
          for (y = base; y <= base + 3; y += 1) {
            if (w.get(x, y, z) !== B.AIR || w.get(x, y + 1, z) !== B.AIR || !w.SOLID[w.get(x, y - 1, z)]) { continue; }
            var e = y + 1;
            while (e + 1 < SY && e < y + 45 && w.get(x, e + 1, z) === B.AIR) { e += 1; }
            if (pass === 1) { fl[c] = y - 1; ce[c] = min(e, y + 4); }
            else if (e + 1 < SY && e <= y1 + 1 && w.SOLID[w.get(x, e + 1, z)]) { fl[c] = y - 1; ce[c] = e; }
            break;
          }
        }
      }
    };
    var FL = { id: "inside", name: "", label: "", fz: base, top: y1, ord: 0, cols: new Int16Array(SX * SZ), rooms: [] };
    var rooms = [], seen = new Uint8Array(SX * SZ);
    var gather = function () {
      rooms = []; FL.rooms = []; FL.cols.fill(0); seen.fill(0);
      var wall = 0;
      for (z = M.z0; z <= M.z1; z += 1) {
        for (x = M.x0; x <= M.x1; x += 1) {
          c = z * SX + x;
          if (fl[c] < 0 || seen[c]) { continue; }
          var comp = [c], head = 0;
          seen[c] = 1;
          while (head < comp.length) {
            var cc = comp[head], xx = cc % SX, zz = (cc - xx) / SX;
            head += 1;
            for (var k = 0; k < 4; k += 1) {
              var X = xx + DIRS[k][0], Z = zz + DIRS[k][1], n2 = Z * SX + X;
              if (X < 0 || X >= SX || Z < 0 || Z >= SZ) { continue; }
              if (!seen[n2] && fl[n2] >= 0 && abs(fl[n2] - fl[cc]) <= 1) { seen[n2] = 1; comp.push(n2); }
            }
          }
          if (comp.length < 6) { continue; }
          var idx = rooms.length + 1, room = { id: "inside-" + idx, name: "", kind: "room", floor: 0, fz: 1e9, ceil: 1e9, idx: idx, blocks: [], fzs: [], tops: [] };
          comp.forEach(function (c2) {
            FL.cols[c2] = idx;
            room.blocks.push(c2); room.fzs.push(fl[c2]); room.tops.push(ce[c2]);
            room.fz = min(room.fz, fl[c2]); room.ceil = min(room.ceil, ce[c2]);
          });
          rooms.push(room); FL.rooms.push(room);
        }
      }
      rooms.forEach(function (rm) { rm.runs = runsOf(w, FL, rm); wall += wallOf(rm); });
      return wall;
    };
    scan(0);
    // A model drawn as a cutaway (an interior with its ceiling left off, to be read from above) has
    // no roof, or only over its furniture: there, what its walls close round on three sides or four.
    if (gather() < 8) { scan(1); gather(); }
    rooms.forEach(function (rm) { rm.blocks.forEach(function (c2, n) { var x2 = c2 % SX; w.set(x2, rm.fzs[n], (c2 - x2) / SX, B.FLOOR); }); });
    // Open to the sky from a height up (a terrace, a deck): outside, though the model is under it.
    var sky = function (x2, y2, z2) { for (var y3 = y2; y3 < min(SY, y2 + 30); y3 += 1) { if (w.SOLID[w.get(x2, y3, z2)]) { return false; } } return true; };
    var door = null, best = null;
    rooms.forEach(function (rm) {
      rm.blocks.forEach(function (c2, n) {
        var x2 = c2 % SX, z2 = (c2 - x2) / SX, f = rm.fzs[n];
        DIRS.forEach(function (d) {
          for (var t = 1; t <= 8; t += 1) {
            var X = x2 + d[0] * t, Z = z2 + d[1] * t, C = Z * SX + X;
            if (X < 2 || Z < 2 || X >= SX - 2 || Z >= SZ - 2) { return; }
            if (t === 1 && FL.cols[C] === rm.idx) { return; }
            if (FL.cols[C]) { return; }
            if ((!M.foot[C] || sky(X, f + 3, Z)) && w.get(X, f + 1, Z) === B.AIR && w.get(X, f + 2, Z) === B.AIR) {
              var dd = hypot(X - toward.x, Z - toward.z) + (t - 1) * 3 - rm.blocks.length * 0.05;
              if (!best || dd < best.d) { best = { d: dd, x: x2, z: z2, dx: d[0], dz: d[1], t: t - 1, f: f, top: rm.tops[n], rm: rm }; }
              return;
            }
          }
        });
      });
    });
    if (best) {
      var px = -best.dz, pz = best.dx, s;
      for (s = 1; s <= best.t; s += 1) {
        for (var o = 0; o <= 1; o += 1) {
          for (y = best.f + 1; y <= min(best.f + 3, max(best.f + 2, best.top)); y += 1) { w.set(best.x + best.dx * s + px * o, y, best.z + best.dz * s + pz * o, B.AIR); }
        }
      }
      // Steps down from a raised floor.
      var stand = best.f + 1, sx = best.x + best.dx * (best.t + 1), sz = best.z + best.dz * (best.t + 1);
      for (s = 0; stand - s - 1 > base; s += 1) {
        for (var o2 = 0; o2 <= 1; o2 += 1) {
          for (y = base; y < stand - s - 1; y += 1) { w.set(sx + best.dx * s + px * o2, y, sz + best.dz * s + pz * o2, B.STONE); }
        }
      }
      var ox = best.x + best.dx * (best.t + 2 + s), oz = best.z + best.dz * (best.t + 2 + s);
      door = { x: ox + 0.5 + px * 0.5, y: base, z: oz + 0.5 + pz * 0.5, dx: best.dx, dz: best.dz };
      // And a way from that room to each of the others, through the wall between.
      var joined = {};
      joined[best.rm.idx] = 1;
      for (var round2 = 0; round2 < rooms.length; round2 += 1) {
        var more = false;
        rooms.forEach(function (rm) {
          if (joined[rm.idx]) { return; }
          var cut2 = null;
          rm.blocks.forEach(function (c2, n) {
            if (cut2) { return; }
            var x2 = c2 % SX, z2 = (c2 - x2) / SX, f = rm.fzs[n];
            DIRS.forEach(function (d) {
              if (cut2) { return; }
              for (var t = 2; t <= 4; t += 1) {
                var C = (z2 + d[1] * t) * SX + x2 + d[0] * t;
                if (FL.cols[(z2 + d[1]) * SX + x2 + d[0]] === rm.idx) { return; }
                if (FL.cols[C] === rm.idx) { return; }
                if (FL.cols[C]) { if (joined[FL.cols[C]]) { cut2 = { x: x2, z: z2, d: d, t: t, f: f }; } return; }
              }
            });
          });
          if (!cut2) { return; }
          for (var s2 = 1; s2 < cut2.t; s2 += 1) {
            for (y = cut2.f + 1; y <= cut2.f + 2; y += 1) { w.set(cut2.x + cut2.d[0] * s2, y, cut2.z + cut2.d[1] * s2, B.AIR); }
          }
          joined[rm.idx] = 1;
          more = true;
        });
        if (!more) { break; }
      }
    }
    return { floors: [FL], rooms: rooms, door: door, stairs: [], where: {} };
  }

  /* Where you came down: open, nearly level ground sixteen blocks or more
     clear of the building, about two dozen from its door, grass if it can be. */
  function findCrash(w, M, near) {
    var SX = w.SX, SZ = w.SZ, top = w.top, W1 = SX + 1, x, z, c;
    var S = new Int32Array(W1 * (SZ + 1)), T = new Int32Array(W1 * (SZ + 1));
    for (z = 0; z < SZ; z += 1) {
      for (x = 0; x < SX; x += 1) {
        c = z * SX + x;
        var o = (z + 1) * W1 + x + 1;
        S[o] = M.foot[c] + S[o - 1] + S[o - W1] - S[o - W1 - 1];
        T[o] = (w.kind[c] === 98 ? 1 : 0) + T[o - 1] + T[o - W1] - T[o - W1 - 1];
      }
    }
    var sum = function (A, xa, za, xb, zb) {
      xa = max(0, xa); za = max(0, za); xb = min(SX - 1, xb); zb = min(SZ - 1, zb);
      return A[(zb + 1) * W1 + xb + 1] - A[za * W1 + xb + 1] - A[(zb + 1) * W1 + xa] + A[za * W1 + xa];
    };
    var best = null;
    for (z = 22; z < SZ - 22; z += 2) {
      for (x = 22; x < SX - 22; x += 2) {
        c = z * SX + x;
        if (w.kind[c] === 98 || w.kind[c] === 126 || sum(S, x - 16, z - 16, x + 16, z + 16)) { continue; }
        var t = top[c], b = w.get(x, t, z);
        if (b === B.WATER || w.get(x, t + 1, z) !== B.AIR) { continue; }
        var lev = 0;
        for (var dz = -6; dz <= 6; dz += 3) { for (var dx = -6; dx <= 6; dx += 3) { lev = max(lev, abs(top[(z + dz) * SX + x + dx] - t)); } }
        if (lev > 3) { continue; }
        var score = abs(hypot(x - near.x, z - near.z) - 24) + (b === B.GRASS ? 0 : 5) + sum(T, x - 12, z - 12, x + 12, z + 12) * 0.05 + lev * 2;
        if (!best || score < best.s) { best = { x: x, z: z, s: score }; }
      }
    }
    return best || { x: 24, z: 24 };
  }

  function makePlace(d) {
    var spec = d.model, it = d.interior && d.interior.floors && d.interior.floors.length ? d.interior : null;
    // A new form (forms.js) is a model already in blocks.
    if (d.kind === "form") { spec = { site: [d.form.nx, d.form.ny], ground: d.form.ground, blocks: d.form, built: root.Forms.built(d.form) }; it = null; }
    var turn = it && it.grid ? it.grid.turn || 0 : 0, s = spec.site || [30, 30], a = turn * Math.PI / 180;
    var spanX = abs(Math.cos(a)) * s[0] + abs(Math.sin(a)) * s[1], spanZ = abs(Math.sin(a)) * s[0] + abs(Math.cos(a)) * s[1];
    var span = max(spanX, spanZ), size = halfSurround(d.kind === "museum" ? max(320, min(512, ceil((span + 200) / 16) * 16)) : 256, span);
    var w = new World(size, size), F = frame(w, turn), G = readGround(d.ground), ex = s[0] / 2 + 15, ey = s[1] / 2 + 15;
    var hAt = fillGround(w, G, F.model, G.h(0, 0), { forms: d.forms, keepOut: function (x, z) { var m = F.model(x, z); return abs(m[0]) <= ex && abs(m[1]) <= ey; } });
    var M = placeModel(w, spec, F, hAt);
    var plan = it ? carveInterior(w, it, M, F) : null;
    var near = plan && plan.door ? { x: plan.door.x, z: plan.door.z } : { x: M.mid[0], z: M.mid[1] };
    var spot = findCrash(w, M, near);
    if (!plan || !plan.rooms.length) { plan = hollowBuilding(w, M, spot); }
    var trees = plantTrees(w, function (c) { return !M.plot[c]; });
    var ax = spot.x - M.mid[0], az = spot.z - M.mid[1], L = hypot(ax, az) || 1;
    var site = crashSite(w, spot.x, spot.z, { clear: 14, lawn: 11, keep: M, away: [ax / L, az / L] });
    trees = trees.filter(function (tr) { return abs(tr.x - spot.x) > 15 || abs(tr.z - spot.z) > 15; });
    var roomById = {};
    plan.rooms.forEach(function (rm) { rm.runs = runsOf(w, plan.floors[rm.floor], rm); roomById[rm.id] = rm; });
    // A building's rooms are called after the sections they are in, a new form's after the sections it is made of.
    var part = d.kind === "form" ? formPart(w, M, d.form) : !it && d.sections ? sectionPart(w, F, M, d.sections, d.name) : null;
    if (part && !it) { nameRooms(w, plan.rooms, part); }
    return { kind: d.kind, w: w, F: F, M: M, hAt: hAt, trees: trees, crash: site.crash, wreck: site.wreck, tree: site.tree,
             centre: { x: M.mid[0], z: M.mid[1] }, rooms: plan.rooms, floors: plan.floors, roomById: roomById, door: plan.door, stairs: plan.stairs,
             where: plan.where, part: part, form: d.form || null, lots: w.lots || [] };
  }

  /* Which section a block of a new form came from: the placement it was drawn by. */
  function formPart(w, M, R) {
    var plane = R.nx * R.ny;
    return function (x, y, z) {
      if (x < 0 || z < 0 || x >= w.SX || z >= w.SZ) { return null; }
      var q = M.colOf[z * w.SX + x], k = y - M.base;
      if (q < 0 || k < 0 || k >= R.nz) { return null; }
      var P = R.placed[R.from[k * plane + q] - 1];
      return P && P.sec ? { name: P.sec.name + " of " + P.of, part: P.sec.name, from: P.from, role: P.role } : null;
    };
  }
  /* Which of a modelled building's volumes a block is in, by the sections' boxes (the smallest that holds it). */
  function sectionPart(w, F, M, secs, name) {
    var vols = secs.filter(function (q) { return q.kind === "volume"; });
    return function (x, y, z) {
      if (x < 0 || z < 0 || x >= w.SX || z >= w.SZ || !M.foot[z * w.SX + x]) { return null; }
      var m = F.model(x, z), h = y - M.base + 0.5, best = null;
      vols.forEach(function (q) {
        if (m[0] < q.at[0] - 0.5 || m[0] > q.at[0] + q.size[0] + 0.5 || m[1] < q.at[1] - 0.5 || m[1] > q.at[1] + q.size[1] + 0.5 || h < q.z - 0.6 || h > q.z + q.size[2] + 0.6) { return; }
        if (!best || q.size[0] * q.size[1] * q.size[2] < best.size[0] * best.size[1] * best.size[2]) { best = q; }
      });
      return best ? { name: best.name, part: best.name, from: name } : null;
    };
  }
  // Each room called after the section most of its floor is in; two rooms in one section, by which end of it.
  var NTH = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
  function nameRooms(w, rooms, part) {
    var SX = w.SX, by = {};
    rooms.forEach(function (rm) {
      var votes = {}, best = null;
      rm.blocks.forEach(function (c, n) {
        var x = c % SX, z = (c - x) / SX, p = null, y;
        // The volume it is in; or, in the open under an upper box or a pergola, the space under that.
        for (y = rm.fzs[n] + 1; y <= rm.tops[n] + 1 && !p; y += 1) {
          var q = part(x, y, z);
          if (!q || !q.name || GROUNDED[q.role]) { continue; }
          p = !q.role || q.role === "base" || q.role === "wing" || (VOLUME[q.role] && y <= rm.tops[n]) ? q :
              { name: (q.role === "screen" ? "the space behind " : "the space under ") + q.name, from: q.from };
        }
        if (!p) { return; }
        var key = p.name + "|" + p.from;
        votes[key] = (votes[key] || 0) + 1;
        if (!best || votes[key] > votes[best.key]) { best = { key: key, p: p }; }
      });
      if (!best) { return; }
      rm.name = rm.blocks.length < 12 && !/^the space /.test(best.p.name) ? best.p.name.replace(/^the /, "a nook of the ") : best.p.name;
      rm.from = best.p.from;
      if (rm.blocks.length >= 12) { (by[best.key] = by[best.key] || []).push(rm); }
    });
    // Two rooms of a like size in one: its two ends. Else the biggest is it, and the rest the rooms to its north, south, east or west.
    Object.keys(by).forEach(function (key) {
      var list = by[key].sort(function (a, b) { return b.blocks.length - a.blocks.length; });
      if (list.length < 2) { return; }
      var name = list[0].name, mids = list.map(function (rm) { return centreOf(rm, SX); }), seen = {};
      if (list.length === 2 && list[1].blocks.length >= list[0].blocks.length * 0.4) {
        var dx = mids[1].x - mids[0].x, dz = mids[1].z - mids[0].z, ax = abs(dx) >= abs(dz);
        list[0].name = "the " + (ax ? (dx > 0 ? "west" : "east") : (dz > 0 ? "north" : "south")) + " end of " + name;
        list[1].name = "the " + (ax ? (dx > 0 ? "east" : "west") : (dz > 0 ? "south" : "north")) + " end of " + name;
        return;
      }
      list.forEach(function (rm, n) {
        if (!n) { return; }
        var dx2 = mids[n].x - mids[0].x, dz2 = mids[n].z - mids[0].z;
        var dir = abs(dx2) >= abs(dz2) ? (dx2 > 0 ? "east" : "west") : (dz2 > 0 ? "south" : "north");
        seen[dir] = (seen[dir] || 0) + 1;
        var nth = seen[dir] > 1 ? (NTH[seen[dir] - 1] || seen[dir]) + " " : "";
        rm.name = /^the space /.test(name) ? name + ", " + (nth ? "the " + nth + "one " : "") + "to the " + dir : "the " + nth + dir + " room of " + name;
      });
    });
  }

  /* ---- the works on the walls ------------------------------------------------------ */

  /* A room's walls a work can hang on: runs of wall three blocks high (or
     the room's height), no glass and no doorway, each the face toward the
     room — its axis (x: a plane of constant x), the plane, the way it faces,
     its run along the wall, its height — and the gaps still free on it. */
  function runsOf(w, FL, rm) {
    var SX = w.SX, spots = {};
    rm.blocks.forEach(function (c, n) {
      var x = c % SX, z = (c - x) / SX, y0 = rm.fzs[n] + 1, top = rm.tops[n], need = min(3, top - y0 + 1);
      DIRS.forEach(function (d) {
        var X = x + d[0], Z = z + d[1];
        if (FL.cols[Z * SX + X] === rm.idx) { return; }
        for (var y = y0; y < y0 + need; y += 1) {
          var b = w.get(X, y, Z);
          if (!w.SOLID[b] || b === B.GLASS || w.style[b] === 3) { return; }
        }
        var axis = d[0] ? "x" : "z", plane = d[0] > 0 ? x + 1 : d[0] < 0 ? x : d[1] > 0 ? z + 1 : z, dir = -(d[0] || d[1]);
        var key = axis + ":" + plane + ":" + dir + ":" + y0;
        (spots[key] = spots[key] || []).push([d[0] ? z : x, top]);
      });
    });
    var runs = [];
    Object.keys(spots).forEach(function (key) {
      var p = key.split(":"), list = spots[key].sort(function (a, b) { return a[0] - b[0]; }), start = 0;
      for (var i = 1; i <= list.length; i += 1) {
        if (i < list.length && list[i][0] === list[i - 1][0] + 1) { continue; }
        var a = list[start][0], b = list[i - 1][0] + 1, top = 1e9;
        for (var j = start; j < i; j += 1) { top = min(top, list[j][1]); }
        runs.push({ axis: p[0], plane: +p[1], dir: +p[2], a: a, b: b, y0: +p[3], y1: top + 1, gaps: b - a >= 1 ? [[a + 0.3, b - 0.3]] : [] });
        start = i;
      }
    });
    return runs;
  }
  function wallOf(rm) {
    var s = 0;
    (rm.runs || []).forEach(function (r) { r.gaps.forEach(function (g) { s += g[1] - g[0]; }); });
    return s;
  }

  // The widest gap left on a room's walls; the work in its middle, smaller if no gap takes it whole.
  function hangIn(rm, sz) {
    var best = null;
    rm.runs.forEach(function (run) {
      run.gaps.forEach(function (g, gi) { var L = g[1] - g[0]; if (!best || L > best.L) { best = { run: run, gi: gi, L: L }; } });
    });
    if (!best || best.L < 0.5) { return null; }
    var run = best.run, g = run.gaps[best.gi], H = run.y1 - run.y0;
    var k = min(1, best.L / sz[0], (H - 0.45) / sz[1]);
    if (k < 0.25) { return null; }
    var wd = sz[0] * k, ht = sz[1] * k, mid = (g[0] + g[1]) / 2, u0 = mid - wd / 2, u1 = mid + wd / 2, keep = [];
    if (u0 - 0.6 - g[0] >= 0.5) { keep.push([g[0], u0 - 0.6]); }
    if (g[1] - u1 - 0.6 >= 0.5) { keep.push([u1 + 0.6, g[1]]); }
    run.gaps.splice.apply(run.gaps, [best.gi, 1].concat(keep));
    var yc = min(run.y0 + 1.55, run.y1 - 0.2 - ht / 2), y0 = max(run.y0 + 0.2, yc - ht / 2);
    return { axis: run.axis, plane: run.plane, dir: run.dir, u0: u0, u1: u1, y0: y0, y1: y0 + ht, scale: k };
  }

  // How big a work hangs: its own size a third as big again (a block is a metre), at most 3.2 m.
  function sizeIn(f) {
    var wm = f.wcm ? f.wcm * 0.013 : 0, hm = f.hcm ? f.hcm * 0.013 : 0;
    if (!wm || !hm) { return [0.9, 0.7]; }
    var k = min(1, 3.2 / max(wm, hm));
    wm *= k; hm *= k;
    var k2 = max(1, 0.45 / min(wm, hm));
    return [min(3.6, wm * k2), min(3.6, hm * k2)];
  }

  /* Which of the works found can hang here: in a museum, those whose rooms
     were carved with wall to spare; in a building, all of them, dealt round
     its three biggest rooms. Each gets its floor and how big it hangs. */
  function hangable(place, works) {
    if (place.kind === "museum") {
      return works.filter(function (x) { return place.roomById[x.room] || place.where[x.room]; }).map(function (x) {
        x.sz = sizeIn(x.f);
        return x;
      });
    }
    // Rooms, not nooks, if there are rooms enough.
    var walled = place.rooms.filter(function (rm) { return wallOf(rm) >= 1.5; }), big = walled.filter(function (rm) { return rm.blocks.length >= 12; });
    var rooms = (big.length >= 2 ? big : walled).sort(function (a, b) { return wallOf(b) - wallOf(a); }).slice(0, 3);
    if (!rooms.length) { return []; }
    return works.map(function (x, i) {
      x.room = rooms[i % rooms.length].id;
      x.sz = sizeIn(x.f);
      return x;
    });
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---- the pieces and the notes ------------------------------------------------------ */

  var HOW = {
    roof: "fell onto a roof. Stack blocks to climb up to it.",
    park: "dug itself into a park. Look for loose earth, and dig.",
    garden: "dug itself into the garden. Look for loose earth, and dig.",
    water: "sank into the water. Swim down for it.",
    paving: "broke through the paving of a square. Look for loose earth, and dig.",
    pool: "sank in the pool. Swim down for it.",
    tree: "caught in the top of a tree. Climb for it."
  };

  function hideBlock(place, p, r, taken) {
    var w = place.w, SX = w.SX, SZ = w.SZ, top = w.top, M = place.M, x, z, c, t;
    var cx = floor(place.crash.x), cz = floor(place.crash.z);
    var free = function (x2, z2) { return !taken.some(function (q) { return abs(q.x - x2) < 5 && abs(q.z - z2) < 5; }); };
    var put = function (x2, y2, z2, how) { w.set(x2, y2, z2, PIECE_IDS[p.k]); p.how = how; return { k: p.k, x: x2, y: y2, z: z2 }; };
    var bury = function (x2, z2, how) {
      var t2 = top[z2 * SX + x2];
      w.set(x2, t2, z2, B.LOOSE); w.set(x2, t2 - 1, z2, B.DIRT); w.set(x2, t2 - 2, z2, B.DIRT);
      return put(x2, t2 - 3, z2, how);
    };
    var solidTop = function (x2, z2) { var y2 = min(SY - 2, top[z2 * SX + x2] + 2); while (y2 > 0 && !w.SOLID[w.get(x2, y2, z2)]) { y2 -= 1; } return y2; };
    var type = p.hide.type, best = null, tries;
    if (type === "roof" && !M) {
      // The roof of the tallest building within reach: no more than 24 blocks up.
      var bt = 0;
      for (z = 20; z < SZ - 20; z += 2) {
        for (x = 20; x < SX - 20; x += 2) {
          t = top[z * SX + x];
          var tb = w.get(x, t, z);
          var roofy = w.lot ? w.lot[z * SX + x] && w.SOLID[tb] && tb !== B.GLASS && w.style[tb] !== 3 && w.get(x, t + 1, z) === B.AIR : tb === B.SLATE || tb === B.CONC;
          if (t > bt && t - place.hAt(x, z) <= 24 && hypot(x - cx, z - cz) > 30 && roofy && free(x, z)) { bt = t; best = { x: x, z: z, t: t }; }
        }
      }
      if (!best) { best = { x: cx + 40, z: cz + 40, t: top[(cz + 40) * SX + cx + 40] }; }
      return put(best.x, best.t + 1, best.z, "roof");
    }
    if (type === "roof") {
      // The building's lowest roof at its edge (three blocks up or more), nearest where you came down.
      for (z = M.z0; z <= M.z1; z += 1) {
        for (x = M.x0; x <= M.x1; x += 1) {
          c = z * SX + x;
          if (!M.foot[c] || !free(x, z) || !DIRS.some(function (d) { return !M.foot[(z + d[1]) * SX + x + d[0]]; })) { continue; }
          t = solidTop(x, z);
          var h = t - (M.base - 1), tb2 = w.get(x, t, z);
          if (h < 3 || tb2 === B.GLASS || w.style[tb2] === 3 || w.get(x, t + 1, z) !== B.AIR) { continue; }
          var sc = hypot(x - cx, z - cz) + h * 3;
          if (!best || sc < best.s) { best = { s: sc, x: x, z: z, t: t }; }
        }
      }
      if (best) { return put(best.x, best.t + 1, best.z, "roof"); }
      type = "garden";
    }
    if (type === "pool") {
      M.pool.forEach(function (c2) {
        var x2 = c2 % SX, z2 = (c2 - x2) / SX, d = hypot(x2 - M.mid[0], z2 - M.mid[1]);
        if (free(x2, z2) && (!best || d < best.d)) { best = { d: d, x: x2, z: z2 }; }
      });
      if (best) {
        var yb = min(SY - 2, top[best.z * SX + best.x] + 2);
        while (yb > 0 && w.get(best.x, yb, best.z) !== B.WATER) { yb -= 1; }
        while (yb > 0 && w.get(best.x, yb - 1, best.z) === B.WATER) { yb -= 1; }
        if (yb > 0) { return put(best.x, yb, best.z, "pool"); }
      }
      type = "garden";
    }
    if (type === "garden" || type === "park") {
      // Loose earth in the grass: in a park out from the crash, or in the garden round the building.
      var cand = [];
      for (z = 6; z < SZ - 6; z += 1) {
        for (x = 6; x < SX - 6; x += 1) {
          c = z * SX + x;
          var dc = hypot(x - cx, z - cz);
          if (M ? (M.foot[c] || !M.plot[c] || dc < 8) : (dc < 35 || dc > 130 * SX / 384)) { continue; }
          t = top[c];
          if (w.get(x, t, z) === B.GRASS && w.get(x, t + 1, z) === B.AIR && free(x, z)) { cand.push(c); }
        }
      }
      if (cand.length) { c = cand[floor(r() * cand.length)]; x = c % SX; return bury(x, (c - x) / SX, M ? "garden" : "park"); }
      return bury(min(SX - 8, cx + 14), cz, M ? "garden" : "park");
    }
    if (type === "water") {
      // The bed of the nearest water, or under the paving of a square if the city has none.
      var wd = 1e9;
      for (z = 4; z < SZ - 4; z += 1) {
        for (x = 4; x < SX - 4; x += 1) {
          t = top[z * SX + x];
          if (w.get(x, t + 1, z) !== B.WATER && w.get(x, t, z) !== B.WATER) { continue; }
          var dd = hypot(x - cx, z - cz);
          if (dd > 20 && dd < wd && free(x, z)) { wd = dd; best = { x: x, z: z }; }
        }
      }
      if (best) {
        for (var y = SY - 1; y > 0; y -= 1) { if (w.get(best.x, y, best.z) === B.SAND) { return put(best.x, y + 1, best.z, "water"); } }
      }
      var sq = [];
      for (z = 8; z < SZ - 8; z += 2) {
        for (x = 8; x < SX - 8; x += 2) {
          t = top[z * SX + x];
          var dp = hypot(x - cx, z - cz);
          if (dp > 30 && dp < 120 * SX / 384 && w.get(x, t, z) === B.PAVE && t - place.hAt(x, z) <= 0 && w.get(x, t + 1, z) === B.AIR && free(x, z)) { sq.push(z * SX + x); }
        }
      }
      c = sq.length ? sq[floor(r() * sq.length)] : (cz - 50) * SX + cx - 60;
      var px = c % SX, pz = (c - px) / SX, pt = top[c];
      w.set(px, pt, pz, B.LOOSE); w.set(px, pt - 1, pz, B.DIRT);
      return put(px, pt - 2, pz, "paving");
    }
    // The top of a tree out from the crash.
    var trees = place.trees.filter(function (tr) { var d3 = hypot(tr.x - cx, tr.z - cz); return d3 > 40 && d3 < 140 * SX / 384 && free(tr.x, tr.z); });
    for (tries = 0; tries < 1 && !trees.length; tries += 1) { trees = place.trees.filter(function (tr) { return free(tr.x, tr.z); }); }
    var tr2 = trees[floor(r() * trees.length)] || place.tree;
    return put(tr2.x, tr2.top + 1, tr2.z, "tree");
  }

  // A clean board in the middle of a room, not by a wall or on a stair.
  function noteSpot(w, place, rm, r, used) {
    var FL = place.floors[rm.floor], SX = w.SX, inner = [], edge = [];
    rm.blocks.forEach(function (c, n) {
      var x = c % SX, z = (c - x) / SX, y = rm.fzs[n] + 1;
      if (used[c] || w.get(x, y - 1, z) !== B.FLOOR || w.get(x, y, z) !== B.AIR || w.get(x, y + 1, z) !== B.AIR) { return; }
      var mid = DIRS.every(function (d) { return FL.cols[(z + d[1]) * SX + x + d[0]] === rm.idx; });
      (mid ? inner : edge).push([x, y, z, c]);
    });
    if (!inner.length) { inner = edge; }
    if (!inner.length) { return null; }
    var s = inner[floor(r() * inner.length)];
    used[s[3]] = 1;
    return { x: s[0], y: s[1], z: s[2] };
  }

  /* A room with too little wall for its works has walls stood in it, as a
     gallery does: lines of plaster three blocks high down its length, seven
     blocks apart, broken every eight blocks to walk through. */
  function partition(place, rm, need) {
    var w = place.w, SX = w.SX, FL = place.floors[rm.floor], x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    rm.blocks.forEach(function (c) { var x = c % SX, z = (c - x) / SX; x0 = min(x0, x); x1 = max(x1, x); z0 = min(z0, z); z1 = max(z1, z); });
    var alongX = x1 - x0 >= z1 - z0, a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1, b0 = alongX ? z0 : x0, b1 = alongX ? z1 : x1;
    if (b1 - b0 < 6 || a1 - a0 < 7) { return false; }
    var lines = [], gone = {};
    if (b1 - b0 < 11) { lines.push(floor((b0 + b1) / 2)); } else { for (var f = b0 + 4; f <= b1 - 4; f += 7) { lines.push(f); } }
    var got = wallOf(rm);
    lines.forEach(function (f2) {
      if (got >= need) { return; }
      for (var t = a0 + 3; t <= a1 - 3; t += 1) {
        if ((t - a0 - 3) % 10 >= 8) { continue; }
        var x = alongX ? t : f2, z = alongX ? f2 : t, c = z * SX + x;
        var s1 = alongX ? c - SX : c - 1, s2 = alongX ? c + SX : c + 1;
        if (FL.cols[c] !== rm.idx || FL.cols[s1] !== rm.idx || FL.cols[s2] !== rm.idx) { continue; }
        gone[c] = 1;
        got += 2;
      }
    });
    if (!Object.keys(gone).length) { return false; }
    var keep = { blocks: [], fzs: [], tops: [] };
    rm.blocks.forEach(function (c, n) {
      if (!gone[c]) { keep.blocks.push(c); keep.fzs.push(rm.fzs[n]); keep.tops.push(rm.tops[n]); return; }
      var x = c % SX, z = (c - x) / SX;
      for (var y = rm.fzs[n] + 1; y <= min(rm.fzs[n] + 3, rm.tops[n]); y += 1) { w.set(x, y, z, B.PLASTER); }
      FL.cols[c] = 0;
    });
    rm.blocks = keep.blocks; rm.fzs = keep.fzs; rm.tops = keep.tops;
    rm.runs = runsOf(w, FL, rm);
    rm.stood = true;
    return true;
  }

  /* The works on the walls, room by room, the widest first. A room short of
     wall has walls stood in it; a work its room has no room for (or whose
     room could not be carved) hangs in the nearest room on its floor that
     has, and is from then on in that room: its label and its clues say so. */
  function hang(place, works) {
    var SX = place.w.SX, byRoom = {}, order = [], paintings = [], over = [];
    works.forEach(function (x) { if (!byRoom[x.room]) { byRoom[x.room] = []; order.push(x.room); } byRoom[x.room].push(x); });
    var put = function (x, rm) {
      var at = hangIn(rm, x.sz);
      if (!at) { return false; }
      var FL = place.floors[rm.floor];
      x.room = rm.id; x.roomName = rm.name; x.floor = rm.floor;
      x.floorName = place.kind === "museum" ? FL.label : ""; x.floorShown = place.kind === "museum" ? FL.name || cap(FL.label) + " floor" : "";
      at.work = x; at.f = x.f; at.room = rm; at.k = -1;
      paintings.push(at);
      return true;
    };
    order.forEach(function (id) {
      var rm = place.roomById[id], list = byRoom[id].sort(function (a, b) { return b.sz[0] - a.sz[0]; });
      if (!rm) { over = over.concat(list); return; }
      var need = list.reduce(function (s, x) { return s + x.sz[0] + 0.7; }, 0.6);
      if (wallOf(rm) < need) { partition(place, rm, need); }
      list.forEach(function (x) { if (!put(x, rm)) { over.push(x); } });
    });
    over.forEach(function (x) {
      var from = place.roomById[x.room], at = from ? centreOf(from, SX) : place.where[x.room] || { x: place.centre.x, z: place.centre.z, floor: 0 };
      var fl = from ? from.floor : at.floor;
      var near = place.rooms.filter(function (rm) { return rm.id !== x.room; }).map(function (rm) {
        var c = centreOf(rm, SX);
        return { rm: rm, d: hypot(c.x - at.x, c.z - at.z) + (rm.floor === fl ? 0 : 400) };
      }).sort(function (a, b) { return a.d - b.d; });
      for (var i = 0; i < near.length && i < 16; i += 1) {
        var rm = near[i].rm;
        if (put(x, rm)) { return; }
        if (!rm.stood && !paintings.some(function (p) { return p.room === rm; }) && partition(place, rm, x.sz[0] + 2) && put(x, rm)) { return; }
      }
    });
    return paintings;
  }
  function centreOf(rm, SX) {
    if (!rm.mid) {
      var sx = 0, sz = 0;
      rm.blocks.forEach(function (c) { var x = c % SX; sx += x; sz += (c - x) / SX; });
      rm.mid = { x: sx / max(1, rm.blocks.length), z: sz / max(1, rm.blocks.length) };
    }
    return rm.mid;
  }

  /* The pieces: those behind a work are behind it; the rest hidden where
     things fall (a roof, the garden, the pool; in a city a roof, a park, the
     water, a tree), each with the wreck's word for where. The clues after
     the first are left about the rooms as notes on the floor, most of them
     in rooms with works in them. */
  function hide(place, adv, paintings, seed) {
    var r = rng(seed * 31 + 7), w = place.w;
    adv.pieces.forEach(function (p) {
      if (p.hide.type !== "work") { return; }
      var at = paintings.filter(function (q) { return q.f.id === p.hide.id; })[0];
      if (at) { at.k = p.k; } else { p.hide = { type: "roof" }; }
    });
    var pieces = [];
    adv.pieces.forEach(function (p) {
      if (p.hide.type === "work") { return; }
      pieces.push(hideBlock(place, p, r, pieces));
      p.clues = ["The wreck's log says " + p.name.charAt(0).toLowerCase() + p.name.slice(1) + " " + HOW[p.how || p.hide.type]];
    });
    var notes = [], used = {}, rooms = place.rooms.filter(function (rm) { return rm.blocks.length >= 6; });
    var withWorks = {};
    paintings.forEach(function (p) { withWorks[p.room.id] = 1; });
    var hung = rooms.filter(function (rm) { return withWorks[rm.id]; });
    adv.pieces.forEach(function (p) {
      for (var i = 1; i < p.clues.length && rooms.length; i += 1) {
        var from = hung.length && r() < 0.7 ? hung : rooms, spot = null;
        for (var tries = 0; tries < 6 && !spot; tries += 1) {
          var rm = from[floor(r() * from.length)];
          spot = noteSpot(w, place, rm, r, used);
          if (spot) { spot.room = rm; }
        }
        if (!spot) { continue; }
        w.set(spot.x, spot.y, spot.z, B.NOTE);
        notes.push({ x: spot.x, y: spot.y, z: spot.z, k: p.k, i: i, text: p.clues[i], room: spot.room });
      }
    });
    return { pieces: pieces, notes: notes };
  }

  // Which room a point is in, on whichever floor it stands.
  function roomAt(place, x, y, z) {
    var w = place.w, SX = w.SX;
    if (x < 0 || z < 0 || x >= SX || z >= w.SZ) { return null; }
    for (var i = 0; i < place.floors.length; i += 1) {
      var FL = place.floors[i], n = FL.cols[floor(z) * SX + floor(x)];
      if (!n) { continue; }
      var rm = FL.rooms.filter(function (q) { return q.idx === n; })[0] || null;
      if (rm && y >= rm.fz + 0.5 && y <= rm.ceil + 1.5) { return rm; }
    }
    return null;
  }

  // Where one stands to read a work's label: a step and a half out from its wall at its middle, or a step if that is
  // not in its room; the columns [x, z], the nearer last.
  function readingSpots(place, p) {
    var SX = place.w.SX, SZ = place.w.SZ, u = floor((p.u0 + p.u1) / 2), FL = place.floors[p.room.floor], out = [];
    for (var k = 1; k >= 0; k -= 1) {
      var a = p.dir > 0 ? p.plane + k : p.plane - 1 - k, x = p.axis === "x" ? a : u, z = p.axis === "x" ? u : a;
      if (x >= 1 && z >= 1 && x < SX - 1 && z < SZ - 1 && FL.cols[z * SX + x] === p.room.idx) { out.push([x, z]); }
    }
    return out;
  }

  /* ---- the ten coins ----------------------------------------------------------------
     The artist, 21 Oct 2026: "I want you to point coins like sonic the video game all through the space, inside and
     outside the architecture". Ten, by rule, no draw: the same place and the same works hung give the same ten.
       inside, five: before the five largest works hung, where one stands to read a label (a step and a half out from
         the wall at the work's middle), no two nearer than his reach; short of five, on the floors of the largest
         rooms, as far as can be from the coins laid; no rooms, outside on the grass of the plot, as far again;
       outside, five: at a third and two thirds of the way from where you wake to the door (Sonic's line of rings
         leading in); on the highest roof of the building; over the middle of its pool, or with none on the grass of
         its plot as far as can be from the coins laid; on the crown of the tree you wake under.
     Each at the height of his head's centre over where he would stand (opt.headY), over water at the water's top
     and his head's radius (opt.headR). Each says where it is and why (text). opt: wake, headY, headR, reach, name. */
  function coins(place, paintings, opt) {
    var w = place.w, SX = w.SX, SZ = w.SZ, M = place.M, out = [], reach = opt.reach || 6, hy = opt.headY, hr = opt.headR;
    // (in three dimensions: a coin on the roof is not near one in the room under it)
    var free = function (x, y, z) { return out.every(function (q) { return hypot(q.x - x, q.y - y, q.z - z) >= reach; }); };
    var far = function (x, y, z) { return out.reduce(function (m, q) { return min(m, hypot(q.x - x, q.y - y, q.z - z)); }, 1e9); };
    // where he would stand in a column, from y up: the first open cell with something solid under it
    var stand = function (x, y, z) {
      y = max(1, floor(y));
      while (y > 1 && !w.SOLID[w.get(x, y - 1, z)]) { y -= 1; }
      while (y < w.SY - 2 && w.SOLID[w.get(x, y, z)]) { y += 1; }
      return y;
    };
    var inn = function () { return out.filter(function (q) { return q.kind === "work" || q.kind === "room" || q.kind === "grass"; }).length; };
    var add = function (kind, x, y, z, text) { out.push({ id: kind + "@" + x + "," + z, kind: kind, x: x + 0.5, y: y, z: z + 0.5, text: text }); };
    // the grass of the plot (or, in a city, round the crash), as far as can be from the coins laid
    var grass = function (kind, text) {
      var best = null, cx = place.crash.x, cz = place.crash.z;
      for (var z = 4; z < SZ - 4; z += 2) {
        for (var x = 4; x < SX - 4; x += 2) {
          var c = z * SX + x;
          if (M ? (M.foot[c] || !M.plot[c]) : hypot(x - cx, z - cz) > 40) { continue; }
          if (hypot(x - cx, z - cz) < 8) { continue; }
          var t = w.top[c];
          if (w.get(x, t, z) !== B.GRASS || w.get(x, t + 1, z) !== B.AIR) { continue; }
          var d = far(x + 0.5, t + 1 + hy, z + 0.5);
          if (!best || d > best.d) { best = { d: d, x: x, z: z, y: t + 1 }; }
        }
      }
      if (best) { add(kind, best.x, best.y + hy, best.z, text); }
    };
    // outside first, so the inside ones keep clear of them: the way in
    var wk = opt.wake, door = place.door || (M ? { x: M.mid[0], z: M.mid[1] } : place.crash);
    [1, 2].forEach(function (k) {
      var px = wk.x + (door.x - wk.x) * k / 3, pz = wk.z + (door.z - wk.z) * k / 3, x = floor(px), z = floor(pz);
      if (x < 1 || z < 1 || x >= SX - 1 || z >= SZ - 1) { return; }
      add("way", x, w.top[z * SX + x] + 1 + hy, z, (k === 1 ? "a third" : "two thirds") + " of the way in, from your tree to the door");
    });
    // the highest roof
    if (M) {
      var roof = null, cx = place.crash.x, cz = place.crash.z;
      for (var z = M.z0; z <= M.z1; z += 1) {
        for (var x = M.x0; x <= M.x1; x += 1) {
          var c = z * SX + x;
          if (!M.foot[c]) { continue; }
          var t = w.top[c], tb = w.get(x, t, z);
          if (!w.SOLID[tb] || tb === B.GLASS || w.style[tb] === 3 || w.get(x, t + 1, z) !== B.AIR) { continue; }
          var dd = hypot(x - cx, z - cz);
          if (!roof || t > roof.t || (t === roof.t && dd < roof.d)) { roof = { t: t, d: dd, x: x, z: z }; }
        }
      }
      if (roof) { add("roof", roof.x, roof.t + 1 + hy, roof.z, "on the highest roof of " + (opt.name || "the building") + ", " + (roof.t + 1 - M.base) + " m up"); }
    }
    // the pool's middle, or the grass
    if (M && M.pool && M.pool.length) {
      var mx = 0, mz = 0;
      M.pool.forEach(function (c) { var x = c % SX; mx += x; mz += (c - x) / SX; });
      mx /= M.pool.length; mz /= M.pool.length;
      var pc = M.pool.reduce(function (b, c) { var x = c % SX, z = (c - x) / SX, d = hypot(x - mx, z - mz); return !b || d < b.d ? { d: d, x: x, z: z } : b; }, null);
      var yw = min(SY - 2, w.top[pc.z * SX + pc.x] + 2);
      while (yw > 0 && w.get(pc.x, yw, pc.z) !== B.WATER) { yw -= 1; }
      add("pool", pc.x, yw + 1 + hr, pc.z, "over the middle of the pool");
    }
    // the crown of your tree
    var tr = place.tree;
    if (tr) { add("tree", tr.x, tr.top + 1 + hy, tr.z, "on the crown of the tree you woke under"); }
    // inside: before the largest works
    var hung = paintings.filter(function (p) { return p.room && p.f; }).slice().sort(function (a, b) { return (b.u1 - b.u0) * (b.y1 - b.y0) - (a.u1 - a.u0) * (a.y1 - a.y0); });
    hung.forEach(function (p, i) {
      if (inn() >= 5) { return; }
      var spots = readingSpots(place, p);
      for (var k = 0; k < spots.length; k += 1) {
        var x = spots[k][0], z = spots[k][1], y = stand(x, p.y0, z), f = p.f;
        if (!free(x + 0.5, y + hy, z + 0.5)) { continue; }
        var cm = f.wcm && f.hcm ? Math.round(f.hcm) + " × " + Math.round(f.wcm) + " cm" : "";
        add("work", x, y + hy, z, "before " + (f.title || "a work") + " (" + [f.artist, f.year].filter(Boolean).join(", ") + ")" +
            (i === 0 ? ", the largest work hung here" : ", the " + ["", "second", "third", "fourth", "fifth"][i] + " largest work hung here") + (cm ? ", " + cm : ""));
        return;
      }
    });
    var rooms = place.rooms.slice().sort(function (a, b) { return b.blocks.length - a.blocks.length; });
    for (var r = 0; inn() < 5 && rooms.length && r < 20; r += 1) {
      var rm = rooms[r % rooms.length], best = null;
      rm.blocks.forEach(function (c, n) {
        var x = c % SX, z = (c - x) / SX, d = far(x + 0.5, rm.fzs[n] + 1 + hy, z + 0.5);
        if (!best || d > best.d) { best = { d: d, x: x, z: z, y: rm.fzs[n] + 1 }; }
      });
      if (best && best.d >= reach) { add("room", best.x, best.y + hy, best.z, "on the floor of " + (rm.name || "a room") + ", as far as it goes from the coins before it"); }
      else if (r >= rooms.length) { break; }
    }
    while (inn() < 5) { var n0 = out.length; grass("grass", "on the grass round " + (opt.name || "the building") + ", as far as it goes from the coins before it"); if (out.length === n0) { break; } }
    if (!out.some(function (q) { return q.kind === "pool"; })) { grass("garden", "on the grass round " + (opt.name || "the building") + ", as far as it goes from the coins before it"); }
    var ORDER = ["work", "room", "grass", "way", "roof", "pool", "garden", "tree"];
    out.sort(function (p, q) { return ORDER.indexOf(p.kind) - ORDER.indexOf(q.kind); });
    // ids unique (two coins in one column take the second's height)
    var seen = {};
    out.forEach(function (q) { while (seen[q.id]) { q.id += "'"; } seen[q.id] = 1; });
    return out;
  }

  /* ---- the guards ---------------------------------------------------------------------
     The artist, 21 Oct 2026: "Think of Mr Pearl like the golden snitch from harry potter right now, there are people
     trying to grab me". The people are the guards the alarms already bring, now seen: one for each room on the ground
     floor that works hang in, three at most (the third alarm brings them all), each with its round, the reading spots
     of its room's works in the order they were hung. They walk the model's plot, on the ground floor and the ground
     round it, never in water, a block up or down a step: stands is where one stands in each column of the plot (-1
     where none can), field the steps from every column to one (-1 where it cannot be reached). */
  function standIn(place, x, z) {
    var w = place.w, M = place.M, c = z * w.SX + x;
    if (!M || x < 1 || z < 1 || x >= w.SX - 1 || z >= w.SZ - 1 || !M.plot[c]) { return -1; }
    for (var y = max(1, M.base - 4); y < M.base + 4; y += 1) {
      var b = w.get(x, y, z);
      if (w.SOLID[w.get(x, y - 1, z)] && !w.SOLID[b] && !w.SOLID[w.get(x, y + 1, z)]) { return b === B.WATER || w.get(x, y - 1, z) === B.WATER ? -1 : y; }
    }
    return -1;
  }
  function stands(place) {
    var w = place.w, S = new Int16Array(w.SX * w.SZ).fill(-1);
    if (!place.M) { return S; }
    for (var z = place.M.z0 - 16; z <= place.M.z1 + 16; z += 1) {
      for (var x = place.M.x0 - 16; x <= place.M.x1 + 16; x += 1) { if (x >= 0 && z >= 0 && x < w.SX && z < w.SZ) { S[z * w.SX + x] = standIn(place, x, z); } }
    }
    return S;
  }
  var STEP8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function field(place, S, tx, tz) {
    var SX = place.w.SX, n = S.length, F = new Int16Array(n).fill(-1), q = new Int32Array(n), h = 0, t = 0, c0 = tz * SX + tx;
    if (tx < 0 || tz < 0 || tx >= SX || tz >= place.w.SZ || S[c0] < 0) { return F; }
    F[c0] = 0; q[t++] = c0;
    while (h < t) {
      var c = q[h++], x = c % SX, z = (c - x) / SX;
      for (var i = 0; i < 8; i += 1) {
        var d = STEP8[i], X = x + d[0], Z = z + d[1], C = Z * SX + X;
        if (X < 0 || Z < 0 || X >= SX || Z >= place.w.SZ || F[C] >= 0 || S[C] < 0 || abs(S[C] - S[c]) > 1) { continue; }
        // a corner only when both sides are open
        if (d[0] && d[1] && (S[z * SX + X] < 0 || S[Z * SX + x] < 0)) { continue; }
        F[C] = F[c] + 1; q[t++] = C;
      }
    }
    return F;
  }
  // (a spot its way does not reach from the round's first, a raised floor or a sunken one, is left out of the round)
  function guards(place, paintings, S) {
    var rooms = [], SX = place.w.SX;
    S = S || stands(place);
    paintings.forEach(function (p) { if (p.room && p.room.floor === 0 && rooms.indexOf(p.room) < 0) { rooms.push(p.room); } });
    return rooms.slice(0, 3).map(function (rm) {
      var round = [];
      paintings.forEach(function (p) { if (p.room === rm) { var s = readingSpots(place, p)[0]; if (s && S[s[1] * SX + s[0]] >= 0) { round.push({ x: s[0], z: s[1], work: p }); } } });
      if (round.length) { var F = field(place, S, round[0].x, round[0].z); round = round.filter(function (r) { return F[r.z * SX + r.x] >= 0; }); }
      return { room: rm, round: round };
    }).filter(function (g) { return g.round.length; });
  }

  var api = { B: B, PIECE_IDS: PIECE_IDS, SY: SY, World: World, city: makeCity, place: makePlace, hangable: hangable,
              hang: hang, hide: hide, roomAt: roomAt, partAt: partAt, rng: rng, hash: hash, sizeIn: sizeIn, coins: coins, guards: guards, stands: stands, standIn: standIn, field: field, readingSpots: readingSpots };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.RocketPlace = api; }
})(typeof window !== "undefined" ? window : this);

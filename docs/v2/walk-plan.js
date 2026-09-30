/* The inside of a museum, as far as it is known — its plan, compiled for
   walking.

   A museum's interior file (docs/v2/interiors/<slug>.json; INTERIORS.md
   beside it says how one is written) tells which of its rooms are known
   and how: their outlines in metres, in the frame of the building's own
   model, what connects them, how high they are and what they are made of,
   and where the saved works hang — each with its source. Here that is
   turned into what the walk needs: for each floor a grid of cells (half a
   metre, a quarter for a small building, a metre past 300 m), each a wall,
   a floor, a place that is not walked, or glass, with its room, the height
   of its floor and of its ceiling, and the inks of its surfaces — every
   one a material worn over the place's own DIRT, and where nothing is
   known, the DIRT itself. What is not known is never a room: inside the
   model's walls it is earth, and a museum nobody has researched yet is its
   model's outer walls round bare earth.

   The same code runs in the page (walk.js) and in the checker
   (scripts/check_interior.js), so what is checked is what is walked. No
   DOM: window.WalkPlan in the page, module.exports in Node. It needs
   models.js (window.Models) for the materials and the model's voxels.

   Every position here is in the grid's frame: metres, turned by the file's
   grid.turn from the model's frame (x east, y south) so a building's main
   walls lie along the grid. With a turn of 0 the two are the same. A
   heading is radians in that frame, 0 along +x, π/2 along +y. */

(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module && module.exports) { module.exports = api; }
  else { root.WalkPlan = api; }
}(typeof window !== "undefined" ? window : this, function (root) {
  "use strict";

  // Kept close: in the checker this runs in a vm, where every global is looked up the long way.
  var floor = Math.floor, round = Math.round, min = Math.min, max = Math.max, abs = Math.abs;
  var sqrt = Math.sqrt, hypot = Math.hypot, atan2 = Math.atan2, ceil = Math.ceil;
  var cos = Math.cos, sin = Math.sin, PI = Math.PI, SQRT2 = Math.SQRT2, SQRT1_2 = Math.SQRT1_2;

  function Models() {
    var m = root && root.Models;
    if (!m && typeof globalThis !== "undefined") {
      m = globalThis.Models || (globalThis.window && globalThis.window.Models);
    }
    if (!m) { throw new Error("walk-plan.js needs models.js"); }
    return m;
  }

  /* ---------------------------------------------------------------- the rules */

  // What a cell is: a wall, a floor that is walked, a place that is drawn
  // but never walked (a void, a closed room, the ground outside, a thing on
  // the floor), or glass.
  var WALL = 0, FLOOR = 1, CLOSED = 2, GLASS = 3;
  // What is over it. A dome and a vault are flat ceilings at heights that
  // change cell by cell; dark is a ceiling nobody knows, drawn as the dark.
  var FLAT = 0, SKYLIGHT = 1, SKY = 2, DOME = 3, VAULT = 4, DARK = 5;
  var CEIL = { flat: FLAT, skylight: SKYLIGHT, sky: SKY, dome: DOME, vault: VAULT, dark: DARK };
  var OPEN = 32767;              // cm: open to the sky, or to a ceiling nobody knows
  var EYE = 1.6;                 // m over a floor: where its footprint is read off the model
  var CLEAR = 0.25;              // m: half a walker's width
  var STEP = 0.35;               // m: the most a foot goes up or down at once
  var HEAD = 2.0;                // m: the least headroom walked under
  var RISER = 0.2;               // m: the tallest riser a stair is given
  var THICK = 2.5;               // m: the thickest wall an opening is carved through
  var NEAR = 1.5;                // m: how far an opening's wall may be from its `at`
  var HANG = 1.45;               // m over the floor: where a work's centre hangs (57 in)
  var TALL = 2.3;                // m: a work taller than this stands 0.3 m off the floor
  var LIFTED = 0.3;
  var APART = 0.6;               // m: the least between two works on a wall
  var OFF_OPEN = 0.3;            // m: kept clear of an opening
  var OFF_CORNER = 0.4;          // m: and of a corner
  var INTO = 0.02;               // m: a work's face stands this far into the room
  var FREE_OUT = 1.0;            // m: a work that stands free stands this far out from its wall
  var VIEW = 1.2, VIEW_K = 1.5;  // the viewing spot: max(1.2 m, 1.5 x the larger side) out
  var UNSIZED = 0.6;             // m: how tall a work of no known size is drawn
  var SIDES = 24;                // a round room's sides
  var UNSURE = 0.25;             // how much more soil shows through a reconstructed surface
  var DOOR_W = 2.4, DOOR_H = 3.0;// the stated rule for an opening's size, where none is given
  var OUT_W = 6, OUT_D = 4;      // a shell's ground outside its door
  var PLAN_DOTS = 40000;         // the plan level's dots, with its building's, at most
  var SOIL = [138, 118, 96, 2];  // DIRT, where none is given
  var DARK_INK = [15, 12, 10];   // the dark of the frame, where none is given
  var LIGHT = [94, 82, 199];     // the pixel light's lavender (land.js's LIGHT)
  var SKY_DAY = [206, 220, 232], SKY_DUSK = [226, 170, 112], SKY_NIGHT = [30, 38, 78];
  var DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  // What grows or lies on the ground makes no wall of a building.
  var GROWN = { plant: 1, grass: 1, drygrass: 1, lavender: 1, sage: 1, water: 1, sand: 1,
                gravel: 1, soil: 1, paving: 1 };
  // Floors that are laid in flags a metre square, and in boards.
  var FLAGS = { marble: 1, stone: 1, paving: 1, limestone: 1 };
  var BOARDS = { wood: 1, timber: 1 };
  var WALKED = { gallery: 1, hall: 1, court: 1, rotunda: 1, lobby: 1, stair: 1, shop: 1, cafe: 1 };
  var KINDS = { gallery: 1, hall: 1, court: 1, rotunda: 1, lobby: 1, stair: 1, shop: 1, cafe: 1,
                void: 1, closed: 1 };

  /* ---------------------------------------------------------------- frames */

  function frameOf(t) {
    if (t && typeof t === "object") {
      if (typeof t.cos === "number") { return t; }
      t = t.turn || 0;
    }
    var a = (t || 0) * PI / 180;
    return { turn: t || 0, cos: cos(a), sin: sin(a) };
  }
  // The model's frame to the grid's, and back. t: a world, a grid {turn}, or degrees.
  function toGrid(t, x, y) { var f = frameOf(t); return [x * f.cos + y * f.sin, -x * f.sin + y * f.cos]; }
  function toWorld(t, x, y) { var f = frameOf(t); return [x * f.cos - y * f.sin, x * f.sin + y * f.cos]; }
  // A file's degrees clockwise from north to a heading in the grid, and back.
  function headingOf(t, deg) {
    var r = deg * PI / 180, g = toGrid(t, sin(r), -cos(r));
    return atan2(g[1], g[0]);
  }
  function compassOf(t, a) {
    var m = toWorld(t, cos(a), sin(a));
    return (atan2(m[0], -m[1]) * 180 / PI + 360) % 360;
  }
  // A file's rect — its first corner in the model's frame, its sides along
  // the grid — as [x0, y0, x1, y1] in the grid.
  function rectOf(f, a) {
    var g = toGrid(f, a[0], a[1]);
    return [um(min(g[0], g[0] + a[2])), um(min(g[1], g[1] + a[3])),
            um(max(g[0], g[0] + a[2])), um(max(g[1], g[1] + a[3]))];
  }
  // To the micrometre: -73.24 + 11.99 is -61.25, as the room beside it says.
  function um(v) { return round(v * 1e6) / 1e6; }

  /* ---------------------------------------------------------------- shapes */

  function area2(p) {
    var s = 0;
    for (var i = 0, n = p.length; i < n; i += 1) {
      var a = p[i], b = p[(i + 1) % n];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s;
  }

  // A room's clear floor as a polygon in the grid, counter-clockwise by its
  // signed area in the grid's own axes (clockwise on a map with north up); a
  // round room is a 24-gon.
  function shape(room, t) {
    var f = frameOf(t), p = null;
    if (room.rect) {
      var r = rectOf(f, room.rect);
      p = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
    } else if (room.circle) {
      var c = toGrid(f, room.circle[0], room.circle[1]), rr = room.circle[2];
      p = [];
      for (var k = 0; k < SIDES; k += 1) {
        var a = 2 * PI * k / SIDES;
        p.push([c[0] + rr * cos(a), c[1] + rr * sin(a)]);
      }
    } else if (room.poly && room.poly.length >= 3) {
      p = room.poly.map(function (q) { return toGrid(f, q[0], q[1]); });
    }
    if (p && area2(p) < 0) { p.reverse(); }
    return p;
  }

  function inPoly(p, x, y) {
    var ins = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
      var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) { ins = !ins; }
    }
    return ins;
  }
  function inRoom(r, x, y) {
    if (r.box) { return x >= r.box[0] && x < r.box[2] && y >= r.box[1] && y < r.box[3]; }
    if (r.circle) {
      var dx = x - r.circle[0], dy = y - r.circle[1];
      return dx * dx + dy * dy < r.circle[2] * r.circle[2];
    }
    return inPoly(r.poly, x, y);
  }
  function bboxOf(p) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    p.forEach(function (q) {
      b[0] = min(b[0], q[0]); b[1] = min(b[1], q[1]);
      b[2] = max(b[2], q[0]); b[3] = max(b[3], q[1]);
    });
    return b;
  }
  function centroidOf(p) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, n = p.length; i < n; i += 1) {
      var q = p[i], r = p[(i + 1) % n], k = q[0] * r[1] - r[0] * q[1];
      a += k; cx += (q[0] + r[0]) * k; cy += (q[1] + r[1]) * k;
    }
    return a ? [cx / (3 * a), cy / (3 * a)] : p[0].slice();
  }
  // Whether two segments cross (touching at an end is not crossing).
  function crosses(a, b, c, d) {
    function side(p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); }
    var d1 = side(c, d, a), d2 = side(c, d, b), d3 = side(a, b, c), d4 = side(a, b, d);
    return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) &&
           ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
  }
  function selfCrossing(p) {
    for (var i = 0; i < p.length; i += 1) {
      for (var j = i + 2; j < p.length; j += 1) {
        if (i === 0 && j === p.length - 1) { continue; }
        if (crosses(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) { return true; }
      }
    }
    return false;
  }

  /* ---------------------------------------------------------------- inks */

  function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : round(v); }
  // Packed for a Uint32 view of ImageData: r | g << 8 | b << 16 | a << 24.
  function pack(c) { return ((255 << 24) | (clamp8(c[2]) << 16) | (clamp8(c[1]) << 8) | clamp8(c[0])) >>> 0; }
  function unpack(u) { return [u & 255, (u >>> 8) & 255, (u >>> 16) & 255]; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function css(c, k) {
    k = k === undefined ? 1 : k;
    return "rgb(" + clamp8(c[0] * k) + "," + clamp8(c[1] * k) + "," + clamp8(c[2] * k) + ")";
  }
  function hexRgb(h) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || "");
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }

  // The soil itself: its gaps are the dark, its speckle a darker dot.
  function soilInk(s, dark) {
    if (s[3] === 0) { return dark; }
    return s[3] === 1 ? [s[0] * 0.72, s[1] * 0.72, s[2] * 0.72] : [s[0], s[1], s[2]];
  }
  // A surface: its material worn over the soil — a little more of the soil
  // where the material is reconstructed — or, not known, the soil.
  var MATS = null;               // Models.MATERIALS, kept while compiling
  function surface(name, sure, s, dark) {
    var m = name && (MATS || Models().MATERIALS)[name];
    if (!m || !m.c) { return soilInk(s, dark); }
    if (m.glass) { return [150, 172, 190]; }
    return mix(m.c, s, min(1, m.soil + (sure === "documented" ? 0 : UNSURE)));
  }

  // The sky over the museum now: pale by day, amber within 6° of the
  // horizon, deep blue at night. sky: {alt (radians), dark (0-1)} or a
  // function giving it.
  function skyOf(sky) {
    var s = typeof sky === "function" ? sky() : sky;
    var deg = s && typeof s.alt === "number" ? s.alt * 180 / PI :
              s && typeof s.dark === "number" ? (s.dark >= 1 ? -20 : s.dark > 0 ? 0 : 45) : 45;
    var state = deg > 6 ? "day" : deg >= -6 ? "dusk" : "night";
    var tone = state === "day" ? SKY_DAY : state === "dusk" ? SKY_DUSK : SKY_NIGHT;
    return { alt: deg * PI / 180, state: state, night: state === "night", tone: tone,
             pane: mix(tone, [255, 255, 255], state === "night" ? 0.06 : 0.3) };
  }

  /* ---------------------------------------------------------------- the model */

  // The model's voxels, with each column's highest built voxel and whether
  // that one is glass.
  function modelOf(spec) {
    if (!spec || !spec.parts) { return null; }
    var M = Models(), vx = M.voxelize(spec);
    var n = vx.nx * vx.ny, top = new Int16Array(n).fill(-1), glassTop = new Uint8Array(n);
    var built = vx.names.map(function (name) { return !GROWN[name]; });
    var glass = vx.names.map(function (name) { return !!(M.MATERIALS[name] && M.MATERIALS[name].glass); });
    for (var k = 0; k < vx.nz; k += 1) {
      for (var q = 0; q < n; q += 1) {
        var m = vx.grid[k * n + q];
        if (m && built[m - 1]) { top[q] = k; glassTop[q] = glass[m - 1] ? 1 : 0; }
      }
    }
    vx.top = top;
    vx.glassTop = glassTop;
    vx.built = built;
    return vx;
  }
  // The voxel column under a point of the model's frame, or -1.
  function columnAt(vx, x, y) {
    var i = floor((x + vx.site[0] / 2) / vx.v), j = floor((y + vx.site[1] / 2) / vx.v);
    return i < 0 || j < 0 || i >= vx.nx || j >= vx.ny ? -1 : j * vx.nx + i;
  }
  // The built material at a point (index + 1), or 0.
  function builtAt(vx, col, z) {
    if (col < 0) { return 0; }
    var k = floor(z / vx.v);
    if (k < 0 || k >= vx.nz) { return 0; }
    var m = vx.grid[k * vx.nx * vx.ny + col];
    return m && vx.built[m - 1] ? m : 0;
  }
  // Whether the voxel at a column is built on all four sides at that
  // height: inside the footprint, not on its edge.
  function deepAt(vx, col, z) {
    var i = col % vx.nx, j = floor(col / vx.nx), k = floor(z / vx.v);
    function b(ii, jj) {
      if (ii < 0 || jj < 0 || ii >= vx.nx || jj >= vx.ny) { return false; }
      var m = vx.grid[k * vx.nx * vx.ny + jj * vx.nx + ii];
      return !!(m && vx.built[m - 1]);
    }
    return b(i - 1, j) && b(i + 1, j) && b(i, j - 1) && b(i, j + 1);
  }

  /* ---------------------------------------------------------------- grids */

  function newFloor(index, spec, x0, y0, gw, gh, cell) {
    var n = gw * gh;
    return {
      index: index, id: spec.id, name: spec.name == null ? null : spec.name, z: spec.z || 0,
      sure: spec.sure || null, src: spec.src || [], x0: x0, y0: y0, gw: gw, gh: gh, cell: cell, n: n,
      i0: round(x0 / cell), j0: round(y0 / cell),
      kind: new Uint8Array(n).fill(CLOSED), room: new Int16Array(n).fill(-1),
      fh: new Int16Array(n), ch: new Int16Array(n).fill(OPEN), ck: new Uint8Array(n).fill(SKY),
      inkF: new Uint32Array(n), inkW: new Uint32Array(n), inkT: new Uint32Array(n),
      door: new Int16Array(n).fill(-1), stair: new Int16Array(n).fill(-1), lift: new Int16Array(n).fill(-1),
      foot: new Uint8Array(n), footM: new Uint8Array(n),
      rooms: [], doors: [], things: [], clear: null
    };
  }
  function cellAt(fl, x, y) {
    var i = floor((x - fl.x0) / fl.cell), j = floor((y - fl.y0) / fl.cell);
    return i < 0 || j < 0 || i >= fl.gw || j >= fl.gh ? -1 : j * fl.gw + i;
  }
  function centreOf(fl, q) {
    return [fl.x0 + (q % fl.gw + 0.5) * fl.cell, fl.y0 + (floor(q / fl.gw) + 0.5) * fl.cell];
  }
  function cm(z) { return max(-32767, min(OPEN - 1, round(z * 100))); }
  function walkable(fl, q) { return q >= 0 && fl.kind[q] === FLOOR && fl.ch[q] - fl.fh[q] >= HEAD * 100; }
  function floorOf(world, id) {
    if (typeof id === "number") { return world.floors[id] || null; }
    for (var i = 0; i < world.floors.length; i += 1) { if (world.floors[i].id === id) { return world.floors[i]; } }
    return null;
  }

  /* ---------------------------------------------------------------- rooms */

  function roomOf(spec, index, fl, f) {
    var poly = shape(spec, f);
    var r = {
      index: index, floor: fl.index, id: spec.id, name: spec.name == null ? null : spec.name,
      said: spec.said || null, kind: spec.kind || "gallery", sure: spec.sure || null, src: spec.src || [],
      ref: spec.ref || [], tol: spec.tol, fz: spec.fz || 0, h: typeof spec.h === "number" ? spec.h : null,
      hsure: spec.hsure || null, ceil: spec.ceil || "auto", oculus: spec.oculus || 0,
      mats: { floor: spec.floor || null, walls: spec.walls || null, top: spec.top || null,
              sure: spec.msure || "reconstructed" },
      poly: poly, circle: null, walls: [], reach: false, cells: 0, pseudo: spec.pseudo || null,
      spec: spec
    };
    if (spec.circle) {
      var c = toGrid(f, spec.circle[0], spec.circle[1]);
      r.circle = [c[0], c[1], spec.circle[2]];
    }
    // A rect holds the cells whose centres are on its first sides, not on its
    // last, so two rooms that share a side never both hold a cell on it.
    if (spec.rect) { r.box = rectOf(f, spec.rect); }
    if (!poly) {
      // A stair, a lift or the ground outside: its outline comes after.
      r.bbox = [0, 0, 0, 0]; r.area = 0; r.cx = 0; r.cy = 0; r.pattern = "grain";
      return r;
    }
    r.bbox = bboxOf(poly);
    r.area = r.circle ? PI * r.circle[2] * r.circle[2] : abs(area2(poly)) / 2;
    var c2 = r.circle ? [r.circle[0], r.circle[1]] : centroidOf(poly);
    r.cx = c2[0]; r.cy = c2[1];
    var fm = r.mats.floor;
    r.pattern = FLAGS[fm] ? "flags" : BOARDS[fm] ?
      ((r.bbox[2] - r.bbox[0]) >= (r.bbox[3] - r.bbox[1]) ? "boards-x" : "boards-y") : "grain";
    return r;
  }

  // Cells whose centres are inside a room's shape belong to it; where two
  // rooms overlap, the first keeps the cell and the overlap is counted.
  function raster(fl, rooms) {
    var over = {};
    rooms.forEach(function (r) {
      if (r.pseudo || !r.poly) { return; }
      var b = r.bbox, cell = fl.cell;
      var i0 = max(0, floor((b[0] - fl.x0) / cell)), i1 = min(fl.gw - 1, floor((b[2] - fl.x0) / cell));
      var j0 = max(0, floor((b[1] - fl.y0) / cell)), j1 = min(fl.gh - 1, floor((b[3] - fl.y0) / cell));
      var z = cm(fl.z + r.fz), open = WALKED[r.kind] ? FLOOR : CLOSED;
      for (var j = j0; j <= j1; j += 1) {
        for (var i = i0; i <= i1; i += 1) {
          var x = fl.x0 + (i + 0.5) * cell, y = fl.y0 + (j + 0.5) * cell;
          if (!inRoom(r, x, y)) { continue; }
          var q = j * fl.gw + i;
          if (fl.room[q] >= 0) {
            var key = fl.room[q] + "," + r.index;
            over[key] = (over[key] || 0) + 1;
            continue;
          }
          fl.room[q] = r.index;
          fl.kind[q] = open;
          fl.fh[q] = z;
        }
      }
    });
    return over;
  }

  // Where two rooms touch with no cell between them, one wall cell is put
  // in; and a room is always closed off from what is outside it by a wall.
  function seal(fl) {
    var gw = fl.gw, n = fl.n, q, walls = [];
    for (q = 0; q < n; q += 1) {
      var r = fl.room[q];
      if (r < 0 || fl.rooms[r].pseudo) { continue; }
      var i = q % gw;
      var left = i > 0 ? fl.room[q - 1] : -1, up = q >= gw ? fl.room[q - gw] : -1;
      if ((left >= 0 && left !== r && !fl.rooms[left].pseudo) || (up >= 0 && up !== r && !fl.rooms[up].pseudo)) {
        walls.push(q);
      }
    }
    walls.forEach(function (w) { fl.room[w] = -1; fl.kind[w] = WALL; });
    // What is outside the model and in no room, beside a room, is a wall.
    var enclose = [];
    for (q = 0; q < n; q += 1) {
      if (fl.room[q] >= 0 || fl.kind[q] !== CLOSED) { continue; }
      var ii = q % gw, jj = floor(q / gw);
      for (var dj = -1; dj <= 1; dj += 1) {
        for (var di = -1; di <= 1; di += 1) {
          var a = ii + di, b = jj + dj;
          if (a < 0 || b < 0 || a >= gw || b >= fl.gh) { continue; }
          var p = b * gw + a;
          if (fl.room[p] >= 0 && !fl.rooms[fl.room[p]].pseudo) { enclose.push(q); di = 2; dj = 2; }
        }
      }
    }
    enclose.forEach(function (w) { fl.kind[w] = WALL; });
  }

  /* ---------------------------------------------------------------- openings */

  // Carve an opening through the wall between its two rooms, at most 2.5 m
  // of it, nearest its `at`; or, for a passage through a thick gap, the
  // rect it gives. The two halves of the doorway belong to the rooms on
  // their sides. Returns {ok, why, thick, cells}.
  function carve(fl, d, limit) {
    var cell = fl.cell, carved = [];
    function side(q) {
      if (q < 0) { return "x"; }
      var r = fl.room[q];
      if (r === d.a) { return "a"; }
      if (d.b >= 0 ? r === d.b : (r === fl.outside || (r < 0 && fl.kind[q] === CLOSED && !fl.foot[q]))) { return "b"; }
      if (fl.kind[q] === WALL || fl.kind[q] === GLASS) { return "w"; }
      return "x";
    }
    if (d.cut) {
      var c = d.cut, near = { a: 0, b: 0 };
      for (var j = 0; j < fl.gh; j += 1) {
        var y = fl.y0 + (j + 0.5) * cell;
        if (y < c[1] || y >= c[3]) { continue; }
        for (var i = 0; i < fl.gw; i += 1) {
          var x = fl.x0 + (i + 0.5) * cell;
          if (x < c[0] || x >= c[2]) { continue; }
          var q = j * fl.gw + i;
          if (fl.kind[q] === WALL || fl.kind[q] === GLASS) { carved.push(q); }
        }
      }
      // It must reach both rooms.
      carved.forEach(function (q) {
        [1, -1, fl.gw, -fl.gw].forEach(function (o) {
          var s = side(q + o);
          if (s === "a") { near.a += 1; }
          if (s === "b") { near.b += 1; }
        });
      });
      if (!carved.length || !near.a || !near.b) { return { ok: false, why: "its cut does not reach both rooms" }; }
      var ra = fl.rooms[d.a], ax = ra.cx, ay = ra.cy;
      var bx = d.b >= 0 ? fl.rooms[d.b].cx : (c[0] + c[2]) / 2, by = d.b >= 0 ? fl.rooms[d.b].cy : (c[1] + c[3]) / 2;
      carved.forEach(function (q) {
        var p = centreOf(fl, q);
        var toA = (p[0] - ax) * (p[0] - ax) + (p[1] - ay) * (p[1] - ay);
        var toB = (p[0] - bx) * (p[0] - bx) + (p[1] - by) * (p[1] - by);
        open(q, toA <= toB ? d.a : d.b);
      });
      d.x = (c[0] + c[2]) / 2; d.y = (c[1] + c[3]) / 2;
      d.w = min(c[2] - c[0], c[3] - c[1]);
      var len = hypot(bx - ax, by - ay) || 1;
      d.ax = (bx - ax) / len; d.ay = (by - ay) / len;
      return { ok: true, thick: max(c[2] - c[0], c[3] - c[1]), cells: carved.length };
    }

    // Look along the grid's axes and its diagonals through `at` for a run
    // of wall with room a on one side and room b on the other.
    var best = null, lim = NEAR + (limit || THICK) + cell, h = cell / 2;
    [[1, 0], [0, 1], [SQRT1_2, SQRT1_2], [SQRT1_2, -SQRT1_2]].forEach(function (u) {
      var marks = [];
      for (var s = -lim; s <= lim + 1e-9; s += h) {
        marks.push({ s: s, k: side(cellAt(fl, d.x + u[0] * s, d.y + u[1] * s)) });
      }
      for (var m = 0; m < marks.length; m += 1) {
        var k0 = marks[m].k;
        if (k0 !== "a" && k0 !== "b") { continue; }
        var want = k0 === "a" ? "b" : "a", e = m + 1;
        while (e < marks.length && marks[e].k === "w") { e += 1; }
        if (e >= marks.length || marks[e].k !== want || e === m + 1) { continue; }
        var s0 = marks[m].s, s1 = marks[e].s;
        var dist = s0 > 0 ? s0 : s1 < 0 ? -s1 : 0;
        var thick = s1 - s0 - cell;
        if (dist > NEAR) { continue; }
        var dir = k0 === "a" ? 1 : -1;
        if (!best || dist < best.dist - 1e-9 || (abs(dist - best.dist) < 1e-9 && thick < best.thick)) {
          best = { u: [u[0] * dir, u[1] * dir], s0: dir > 0 ? s0 : -s1, s1: dir > 0 ? s1 : -s0, dist: dist, thick: thick };
        }
      }
    });
    if (!best) { return { ok: false, why: "no wall between its rooms within 1.5 m of its at" }; }
    if (best.thick > (limit || THICK) + 1e-9) {
      return { ok: false, why: "the wall between its rooms is " + best.thick.toFixed(1) + " m thick" };
    }
    // The cells within half its width of the line through `at`, between the rooms.
    var ux = best.u[0], uy = best.u[1], half = (d.w || DOOR_W) / 2, mid = (best.s0 + best.s1) / 2;
    var span = max(half, best.s1 - best.s0) + cell;
    var gi0 = floor((d.x - span - fl.x0) / cell), gi1 = ceil((d.x + span - fl.x0) / cell);
    var gj0 = floor((d.y - span - fl.y0) / cell), gj1 = ceil((d.y + span - fl.y0) / cell);
    for (var gj = max(0, gj0); gj <= min(fl.gh - 1, gj1); gj += 1) {
      for (var gi = max(0, gi0); gi <= min(fl.gw - 1, gi1); gi += 1) {
        var qq = gj * fl.gw + gi;
        if (fl.kind[qq] !== WALL && fl.kind[qq] !== GLASS) { continue; }
        var px = fl.x0 + (gi + 0.5) * cell - d.x, py = fl.y0 + (gj + 0.5) * cell - d.y;
        var along = px * ux + py * uy, across = -px * uy + py * ux;
        if (along <= best.s0 || along >= best.s1 || abs(across) > half + 1e-9) { continue; }
        carved.push(qq);
        open(qq, along < mid ? d.a : d.b);
      }
    }
    if (!carved.length) { return { ok: false, why: "nothing to carve" }; }
    d.ax = ux; d.ay = uy;
    d.x += ux * mid; d.y += uy * mid;
    return { ok: true, thick: best.thick, cells: carved.length };

    function open(q, r) {
      fl.kind[q] = FLOOR;
      fl.room[q] = r >= 0 ? r : fl.outside;
      fl.door[q] = d.index;
      var host = r >= 0 ? fl.rooms[r] : null;
      fl.fh[q] = cm(fl.z + (host ? host.fz : 0));
    }
  }

  /* ---------------------------------------------------------------- stairs and lifts */

  // A stair, in both its floors' grids: treads of equal risers up to 0.2 m,
  // rising the way it says, its top flush with the upper floor. Returns
  // {ok, why}.
  function ramp(world, st) {
    var fa = world.floors[st.from], fb = world.floors[st.to];
    if (!fa || !fb) { return { ok: false, why: "it joins a floor that is not in the file" }; }
    var lo = min(fa.z, fb.z), hi = max(fa.z, fb.z), dz = hi - lo;
    var n = max(1, ceil(dz / RISER - 1e-9));
    var r = st.rect, axis = st.rise.charAt(1), up = st.rise.charAt(0) === "-" ? -1 : 1;
    var run = axis === "x" ? r[2] - r[0] : r[3] - r[1];
    st.risers = n; st.riser = dz / n; st.tread = run / n; st.low = lo; st.high = hi;
    var why = null;
    if (run / n < world.cell - 1e-9) {
      why = "its " + n + " risers need " + (n * world.cell).toFixed(1) + " m of run at this grid; it has " + run.toFixed(1);
    }
    [fa, fb].forEach(function (fl) {
      var ri = fl.rooms.length;
      fl.rooms.push(roomOf({ id: st.id, name: st.name, kind: "stair", sure: st.sure, src: st.src,
                             rect: null, pseudo: "stair" }, ri, fl, world));
      var room = fl.rooms[ri];
      room.poly = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
      room.bbox = r.slice(); room.cx = (r[0] + r[2]) / 2; room.cy = (r[1] + r[3]) / 2;
      room.area = (r[2] - r[0]) * (r[3] - r[1]);
      room.stair = st.index;
      st.rooms = st.rooms || {};
      st.rooms[fl.index] = ri;
      for (var q = 0; q < fl.n; q += 1) {
        var c = centreOf(fl, q);
        if (c[0] < r[0] || c[0] >= r[2] || c[1] < r[1] || c[1] >= r[3]) { continue; }
        var t = (axis === "x" ? c[0] - r[0] : c[1] - r[1]) / run;
        if (up < 0) { t = 1 - t; }
        var k = min(n - 1, max(0, floor(t * n)));
        fl.kind[q] = FLOOR;
        fl.room[q] = ri;
        fl.fh[q] = cm(lo + (k + 1) * dz / n);
        fl.stair[q] = st.index;
      }
    });
    return why ? { ok: false, why: why } : { ok: true };
  }

  function lift(world, lf) {
    lf.floors.forEach(function (fi) {
      var fl = world.floors[fi], r = lf.rect, ri = fl.rooms.length;
      fl.rooms.push(roomOf({ id: lf.id, name: lf.name, kind: "lobby", sure: lf.sure, src: lf.src, pseudo: "lift" },
                           ri, fl, world));
      var room = fl.rooms[ri];
      room.poly = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
      room.bbox = r.slice(); room.cx = (r[0] + r[2]) / 2; room.cy = (r[1] + r[3]) / 2;
      room.area = (r[2] - r[0]) * (r[3] - r[1]);
      room.lift = lf.index;
      for (var q = 0; q < fl.n; q += 1) {
        var c = centreOf(fl, q);
        if (c[0] < r[0] || c[0] >= r[2] || c[1] < r[1] || c[1] >= r[3]) { continue; }
        fl.kind[q] = FLOOR; fl.room[q] = ri; fl.fh[q] = cm(fl.z); fl.lift[q] = lf.index;
      }
    });
  }

  /* ---------------------------------------------------------------- ceilings */

  // The model's roof over a point, less one voxel, never above the floor
  // over this one: {z, glass} in metres, or null where the model has no roof.
  function autoAt(world, fl, gx, gy, zFloor, capZ) {
    var vx = world.vox;
    if (!vx) { return null; }
    var m = toWorld(world, gx, gy), col = columnAt(vx, m[0], m[1]);
    if (col < 0 || vx.top[col] < 0) { return null; }
    var z = vx.top[col] * vx.v;
    if (z <= zFloor + HEAD) { return null; }
    if (z > capZ) { return { z: capZ, glass: false, capped: true }; }
    return { z: z, glass: !!vx.glassTop[col], capped: false };
  }

  function median(a) {
    if (!a.length) { return null; }
    a.sort(function (p, q) { return p - q; });
    return a[floor(a.length / 2)];
  }

  function ceilings(world, fl) {
    var above = null;
    world.floors.forEach(function (o) { if (o.z > fl.z + 0.5 && (!above || o.z < above.z)) { above = o; } });
    var capZ = above ? above.z : Infinity, q, r;
    // Each room's height where it gives one, else the model's (the middle
    // of its cells' heights), for the ceilings that are one height.
    fl.rooms.forEach(function (room) {
      var zs = [];
      for (var i = 0; i < fl.n; i += 7) {
        if (fl.room[i] !== room.index) { continue; }
        var c = centreOf(fl, i), a = autoAt(world, fl, c[0], c[1], fl.z + room.fz, capZ);
        if (a) { zs.push(a.z - (fl.z + room.fz)); }
      }
      room.autoH = median(zs);
      room.clearH = room.h !== null ? room.h : room.autoH;
    });
    for (q = 0; q < fl.n; q += 1) {
      var kind = fl.kind[q];
      if (kind === WALL || kind === GLASS) { fl.ch[q] = OPEN; fl.ck[q] = DARK; continue; }
      if (fl.door[q] >= 0) { continue; }
      r = fl.room[q] >= 0 ? fl.rooms[fl.room[q]] : null;
      var c = centreOf(fl, q);
      if (!r || r.pseudo === "outside") { outside(q, c); continue; }
      var base = fl.z + r.fz, H = r.clearH;
      switch (r.pseudo ? "auto" : r.ceil) {
        case "flat": case "skylight":
          if (H === null) { fl.ch[q] = OPEN; fl.ck[q] = DARK; }
          else { fl.ch[q] = cm(base + H); fl.ck[q] = r.ceil === "flat" ? FLAT : SKYLIGHT; }
          break;
        case "sky":
          fl.ch[q] = OPEN; fl.ck[q] = SKY;
          break;
        case "dark":
          fl.ch[q] = OPEN; fl.ck[q] = DARK;
          break;
        case "dome": {
          // Rising toward its middle in rings a cell wide, from its spring.
          var R = r.circle ? r.circle[2] : min(r.bbox[2] - r.bbox[0], r.bbox[3] - r.bbox[1]) / 2;
          var d = round(hypot(c[0] - r.cx, c[1] - r.cy) / fl.cell) * fl.cell;
          if (r.oculus && d < r.oculus) { fl.ch[q] = OPEN; fl.ck[q] = SKY; break; }
          var spring = H === null ? 0 : H;
          fl.ch[q] = cm(base + spring + sqrt(max(0, R * R - d * d)));
          fl.ck[q] = DOME;
          break;
        }
        case "vault": {
          // Round over its long axis, from the height of its walls.
          var wide = r.bbox[2] - r.bbox[0], deep = r.bbox[3] - r.bbox[1], half = min(wide, deep) / 2;
          var off = wide >= deep ? abs(c[1] - r.cy) : abs(c[0] - r.cx);
          off = round(off / fl.cell) * fl.cell;
          fl.ch[q] = cm(base + (H === null ? 0 : H) + sqrt(max(0, half * half - off * off)));
          fl.ck[q] = VAULT;
          break;
        }
        default: {
          // auto: the model's roof over the cell, less a voxel; a skylight
          // where the model has glass on top, else a ceiling nobody knows.
          var a = autoAt(world, fl, c[0], c[1], base, capZ);
          if (!a) { fl.ch[q] = OPEN; fl.ck[q] = DARK; }
          else { fl.ch[q] = cm(a.z); fl.ck[q] = a.glass ? SKYLIGHT : DARK; }
        }
      }
    }
    // A doorway's head: as it says, else the lower of its two rooms' ceilings.
    fl.doors.forEach(function (d) {
      if (!d.cells) { return; }
      var head = null;
      if (typeof d.h === "number") { head = cm(fl.z + (d.a >= 0 ? fl.rooms[d.a].fz : 0) + d.h); }
      else {
        var heads = [d.a, d.b].map(function (ri) {
          if (ri < 0) { return OPEN; }
          var zs = [];
          for (var i = 0; i < fl.n; i += 3) { if (fl.room[i] === ri && fl.door[i] < 0) { zs.push(fl.ch[i]); } }
          return median(zs) || OPEN;
        });
        head = min(heads[0], heads[1]);
      }
      for (var i = 0; i < fl.n; i += 1) {
        if (fl.door[i] !== d.index) { continue; }
        fl.ch[i] = head;
        fl.ck[i] = head >= OPEN ? SKY : FLAT;
      }
    });

    function outside(qq, cc) {
      // Under whatever the model has overhead — a porch roof — else the sky.
      var vx = world.vox;
      if (vx) {
        var m = toWorld(world, cc[0], cc[1]), col = columnAt(vx, m[0], m[1]);
        if (col >= 0) {
          for (var k = floor((fl.z + EYE) / vx.v) + 1; k < vx.nz; k += 1) {
            var mm = vx.grid[k * vx.nx * vx.ny + col];
            // Never lower than a walker needs: a model's voxels are too coarse to say
            // a porch is lower than that.
            if (mm && vx.built[mm - 1]) { fl.ch[qq] = cm(max(k * vx.v, fl.fh[qq] / 100 + HEAD + 0.1)); fl.ck[qq] = FLAT; return; }
          }
        }
      }
      fl.ch[qq] = OPEN; fl.ck[qq] = SKY;
    }
  }

  /* ---------------------------------------------------------------- inks */

  function inks(world, fl, soil) {
    var M = Models(), names = world.vox ? world.vox.names : Object.keys(M.MATERIALS);
    var dark = world.dark, sky = world.sky;
    var ground = world.groundMaterial;
    for (var q = 0; q < fl.n; q += 1) {
      var i = q % fl.gw, j = floor(q / fl.gw);
      var s = (soil && soil(fl.i0 + i, fl.j0 + j)) || SOIL;
      var r = fl.room[q] >= 0 ? fl.rooms[fl.room[q]] : null, k = fl.kind[q];
      var F, Wl, T;
      if (k === WALL || k === GLASS) {
        // Earth where nothing is known; the model's own wall on its edge.
        var mat = fl.footM[q] ? names[fl.footM[q] - 1] : null;
        F = Wl = T = fl.foot[q] === 2 && mat ? surface(mat, "reconstructed", s, dark) : soilInk(s, dark);
        if (k === GLASS) { Wl = [150, 172, 190]; }
      } else if (r && !r.pseudo) {
        F = r.kind === "void" ? dark : surface(r.mats.floor, r.mats.sure, s, dark);
        Wl = surface(r.mats.walls, r.mats.sure, s, dark);
        T = surface(r.mats.top, r.mats.sure, s, dark);
      } else if (r && r.pseudo === "shell") {
        F = Wl = T = soilInk(s, dark);
      } else if (r && (r.pseudo === "stair" || r.pseudo === "lift")) {
        // A stair of the rooms it joins, as far as they are known: the soil.
        F = Wl = T = soilInk(s, dark);
      } else {
        // Outside: the ground under it in the model, else the soil.
        var gm = fl.footM[q] ? names[fl.footM[q] - 1] : ground;
        F = surface(gm, "reconstructed", s, dark);
        Wl = T = F;
      }
      if (fl.ck[q] === SKYLIGHT) { T = sky.pane; }
      else if (fl.ck[q] === SKY) { T = sky.tone; }
      fl.inkF[q] = pack(F); fl.inkW[q] = pack(Wl); fl.inkT[q] = pack(T);
    }
    fl.rooms.forEach(function (room) {
      var q0 = cellAt(fl, room.cx, room.cy);
      room.tone = q0 >= 0 ? unpack(fl.inkW[q0]) : SOIL.slice(0, 3);
    });
  }

  /* ---------------------------------------------------------------- walls and runs */

  // Where a room's own floor begins, walking in from outside its outline at
  // a point of an edge: the distance in from the outline to that face.
  function faceAt(fl, ri, px, py, nx, ny) {
    var h = fl.cell / 4;
    for (var s = -0.75; s <= 1.5; s += h) {
      var x = px - nx * s, y = py - ny * s, q = cellAt(fl, x, y);
      if (q < 0 || fl.room[q] !== ri || fl.door[q] >= 0 || fl.kind[q] === WALL || fl.kind[q] === GLASS) { continue; }
      if (abs(nx) > 0.999) {
        var fx = fl.x0 + (q % fl.gw + (nx > 0 ? 1 : 0)) * fl.cell;
        return (px - fx) * nx;
      }
      if (abs(ny) > 0.999) {
        var fy = fl.y0 + (floor(q / fl.gw) + (ny > 0 ? 1 : 0)) * fl.cell;
        return (py - fy) * ny;
      }
      return s - h / 2;
    }
    return null;
  }

  function cutRuns(pieces, a, b) {
    var out = [];
    pieces.forEach(function (p) {
      if (b <= p[0] || a >= p[1]) { out.push(p); return; }
      if (a > p[0]) { out.push([p[0], a]); }
      if (b < p[1]) { out.push([b, p[1]]); }
    });
    return out;
  }

  // A room's walls: each edge of its outline where the room meets a wall,
  // moved in to the face the grid gives it, with its openings and the runs
  // of wall between them — kept 0.3 m clear of an opening, 0.4 m of a corner.
  function wallsOf(fl, r) {
    var p = r.poly, out = [];
    if (!p) { return out; }
    for (var e = 0; e < p.length; e += 1) {
      var a = p[e], b = p[(e + 1) % p.length];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = sqrt(dx * dx + dy * dy);
      if (len < fl.cell) { continue; }
      var ux = dx / len, uy = dy / len, nx = uy, ny = -ux, offs = [], samples = 0;
      for (var t = min(0.2, len / 2); t <= len - min(0.2, len / 2) + 1e-9; t += 0.25) {
        samples += 1;
        var o = faceAt(fl, r.index, a[0] + ux * t, a[1] + uy * t, nx, ny);
        if (o !== null) { offs.push(o); }
      }
      if (!offs.length || offs.length < samples * 0.3) { continue; }
      var off = median(offs);
      var x0 = a[0] - nx * off, y0 = a[1] - ny * off;
      // Its openings: where what is just beyond the face is open.
      var gaps = [], was = null;
      for (var s = 0; s <= len + 1e-9; s += 0.1) {
        var q = cellAt(fl, x0 + ux * s + nx * 0.26, y0 + uy * s + ny * 0.26);
        var gap = q >= 0 && (fl.door[q] >= 0 ||
                  (fl.kind[q] !== WALL && fl.kind[q] !== GLASS && fl.room[q] !== r.index));
        var into = cellAt(fl, x0 + ux * s - nx * 0.1, y0 + uy * s - ny * 0.1);
        if (into >= 0 && fl.door[into] >= 0) { gap = true; }
        if (gap && was === null) { was = s; }
        if (!gap && was !== null) { gaps.push([max(0, was - 0.05), s]); was = null; }
      }
      if (was !== null) { gaps.push([max(0, was - 0.05), len]); }
      var runs = [[OFF_CORNER, len - OFF_CORNER]];
      gaps.forEach(function (g) { runs = cutRuns(runs, g[0] - OFF_OPEN, g[1] + OFF_OPEN); });
      runs = runs.filter(function (u) { return u[1] - u[0] >= 0.3; });
      out.push({ edge: e, x0: x0, y0: y0, x1: x0 + ux * len, y1: y0 + uy * len, ux: ux, uy: uy,
                 nx: nx, ny: ny, len: len, off: off, gaps: gaps, runs: runs });
    }
    return out;
  }

  // The straight runs of wall a room has to hang on, longest first.
  function runs(room) {
    var out = [];
    (room.walls || []).forEach(function (w) {
      w.runs.forEach(function (u) {
        out.push({ wall: w, t0: u[0], t1: u[1], len: u[1] - u[0],
                   x0: w.x0 + w.ux * u[0], y0: w.y0 + w.uy * u[0],
                   x1: w.x0 + w.ux * u[1], y1: w.y0 + w.uy * u[1], nx: w.nx, ny: w.ny });
      });
    });
    return out.sort(function (p, q) { return q.len - p.len; });
  }

  // The wall a record names: the edge whose outward normal is nearest that
  // way (the longest, where two are as near); for a round room, its arc
  // within 45° of it.
  function compass(room, dir, t) {
    var v = DIRS[dir];
    if (!v || !room.walls || !room.walls.length) { return []; }
    var g = toGrid(t || 0, v[0], v[1]);
    if (room.circle) {
      return room.walls.filter(function (w) { return w.nx * g[0] + w.ny * g[1] >= SQRT1_2 - 1e-9; });
    }
    var best = null, bd = -2;
    room.walls.forEach(function (w) {
      var d = w.nx * g[0] + w.ny * g[1];
      if (d > bd + 1e-6 || (abs(d - bd) <= 1e-6 && w.len > best.len)) { best = w; bd = d; }
    });
    return best && bd > 0 ? [best] : [];
  }

  /* ---------------------------------------------------------------- sizes */

  var NUM = "(\\d+(?:[.,]\\d+)?(?:[\\s-]+\\d+\\/\\d+)?|\\d+\\/\\d+)";
  var UNIT = "(cm|mm|m|in|inches|\")?\\.?";
  var BY = "\\s*(?:x|×|by)\\s*";
  var MEASURE = new RegExp(NUM + "\\s*" + UNIT + BY + NUM + "\\s*" + UNIT + "(?:" + BY + NUM + "\\s*" + UNIT + ")?", "i");
  var LONE_UNIT = /(?:^|[\s\d.])(cm|mm|in|inches)\b/i;
  function number(s) {
    s = s.replace(",", ".").trim();
    var m = /^(\d+(?:\.\d+)?)?[\s-]*(?:(\d+)\/(\d+))?$/.exec(s);
    if (!m) { return NaN; }
    return (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? parseInt(m[2], 10) / parseInt(m[3], 10) : 0);
  }
  // A work's size in cm, from a statement of it: the first not labelled as
  // framed or its mount; inches with their fractions, or cm; height first.
  // '23 5/8 × 31 3/8 in' → {w: 79.7, h: 60, d: null}.
  function dims(text) {
    if (!text) { return null; }
    var parts = String(text).split(/[;\n\r|]+/);
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];
      var m = MEASURE.exec(part);
      if (!m) { continue; }
      if (/\b(framed|frame|mount|mounted|mat)\b/i.test(part.slice(0, m.index))) { continue; }
      var unit = (m[6] || m[4] || m[2] || "").toLowerCase();
      if (!unit) { var lone = LONE_UNIT.exec(part.slice(m.index)); unit = lone ? lone[1].toLowerCase() : ""; }
      if (!unit) { continue; }
      var k = unit === "cm" ? 1 : unit === "mm" ? 0.1 : unit === "m" ? 100 : 2.54;
      var h = number(m[1]) * k, w = number(m[3]) * k, d = m[5] ? number(m[5]) * k : null;
      if (!(h > 0) || !(w > 0)) { continue; }
      function r1(v) { return round(v * 10) / 10; }
      return { w: r1(w), h: r1(h), d: d > 0 ? r1(d) : null };
    }
    return null;
  }

  /* ---------------------------------------------------------------- the works */

  var FREE_MEDIUM = /\b(bronze|marble|stone|wood|clay|plaster|ceramic|terracotta|terra cotta|porcelain|granite|alabaster)\b/i;
  var PRINTISH = /\b(woodcut|wood engraving|engraving|etching|lithograph|print|photograph|panel|veneer)\b/i;
  function standsFree(w, sz) {
    if (w.free === true) { return true; }
    if (w.free === false) { return false; }
    if (sz && sz.d && sz.w && sz.d >= sz.w / 5) { return true; }
    // What it is made of, not what it is on: oil on wood hangs.
    var made = String(w.m || "").split(/\bon\b/i)[0];
    return FREE_MEDIUM.test(made) && !PRINTISH.test(made);
  }
  function sizeOf(w) {
    var c = w.cm;
    if (c && c[0] > 0 && c[1] > 0) { return { w: c[0] / 100, h: c[1] / 100, d: c[2] ? c[2] / 100 : null, known: true }; }
    var ar = w.ar > 0 ? w.ar : 1;
    return { w: UNSIZED * ar, h: UNSIZED, d: null, known: false };
  }

  function roomById(world, id) {
    for (var f = 0; f < world.floors.length; f += 1) {
      var rooms = world.floors[f].rooms;
      for (var r = 0; r < rooms.length; r += 1) {
        if (rooms[r].id === id && !rooms[r].pseudo) { return rooms[r]; }
      }
    }
    return null;
  }

  // Hang the works the museum's own records place in drawn rooms, each on
  // the wall the record gives, in the museum's order, spaced evenly along
  // the wall's longest run between openings; what does not fit goes to the
  // next run, then to a second tier above. The place along the wall and
  // the height are ours unless a pin fixes them. Returns {hung, spill}.
  function hang(world, works, pins) {
    pins = pins || {};
    var groups = {}, order = [], hung = [], spill = [];
    (works || []).forEach(function (w, n) {
      // A work that is another saved work's very object hangs once, as that one.
      if (w.how !== "museum" || !w.room || w.same) { return; }
      var room = roomById(world, w.room);
      if (!room) { spill.push(w.id); return; }
      var pin = pins[w.id] || null;
      var dir = (pin && pin.wall) || w.wall || null;
      var key = room.floor + ":" + room.index + ":" + (dir || "-");
      if (!groups[key]) { groups[key] = { room: room, dir: dir, list: [] }; order.push(key); }
      groups[key].list.push({ w: w, n: n, pin: pin, size: sizeOf(w) });
    });
    order.forEach(function (key) {
      var g = groups[key], room = g.room, fl = world.floors[room.floor], base = fl.z + room.fz;
      // The museum's order, then by date.
      g.list.sort(function (a, b) {
        return a.n - b.n || String(a.w.y || "").localeCompare(String(b.w.y || ""));
      });
      if (g.dir === "centre") { centre(g.list, room, fl, base); return; }
      var walls = g.dir ? compass(room, g.dir, world) : room.walls.slice();
      var avail = [];
      walls.forEach(function (wl) {
        wl.runs.forEach(function (u) { avail.push({ wall: wl, t0: u[0], t1: u[1] }); });
      });
      // Pinned works first, where their record puts them.
      var rest = [];
      g.list.forEach(function (it) {
        if (it.pin && typeof it.pin.at === "number" && walls.length) {
          var wl = walls[0], t = it.pin.at * wl.len;
          put(it, wl, t, base + (typeof it.pin.z === "number" ? it.pin.z : HANG), 1, false, true);
          avail = cutAvail(avail, wl, t - it.size.w / 2 - APART, t + it.size.w / 2 + APART);
        } else { rest.push(it); }
      });
      avail.sort(function (a, b) { return (b.t1 - b.t0) - (a.t1 - a.t0); });
      var queue = rest, firstTier = [];
      avail.forEach(function (run) {
        if (!queue.length) { return; }
        var take = [];
        for (var k = 0; k < queue.length; k += 1) {
          if (fits(take.concat([queue[k]]), run.t1 - run.t0)) { take.push(queue[k]); } else { break; }
        }
        queue = queue.slice(take.length);
        lay(take, run, 1, null);
        firstTier.push({ run: run, list: take });
      });
      // A second tier over the longest run, for what is left.
      if (queue.length && avail.length) {
        var run0 = avail[0], top = base + HANG;
        hung.forEach(function (h) { if (h.room === room.index && h.floor === fl.index) { top = max(top, h.z1); } });
        var take2 = [];
        for (var k2 = 0; k2 < queue.length; k2 += 1) {
          if (fits(take2.concat([queue[k2]]), run0.t1 - run0.t0)) { take2.push(queue[k2]); } else { break; }
        }
        queue = queue.slice(take2.length);
        lay(take2, run0, 2, top + LIFTED);
      }
      queue.forEach(function (it) { spill.push(it.w.id); });

      function lay(list, run, tier, floorOfTier) {
        if (!list.length) { return; }
        var L = run.t1 - run.t0, sum = 0;
        list.forEach(function (it) { sum += it.size.w; });
        var gap = (L - sum) / (list.length + 1), t = run.t0 + gap, inner = gap;
        if (list.length > 1 && gap < APART) { inner = (L - sum) / (list.length - 1); t = run.t0; }
        if (list.length === 1) { t = run.t0 + (L - sum) / 2; }
        list.forEach(function (it) {
          var mid = t + it.size.w / 2;
          var zc = floorOfTier === null ? base + HANG : floorOfTier + it.size.h / 2;
          put(it, run.wall, mid, zc, tier, !g.dir, false);
          t += it.size.w + inner;
        });
      }
    });
    return { hung: hung, spill: spill };

    function fits(list, L) {
      var sum = 0;
      list.forEach(function (it) { sum += it.size.w; });
      if (sum > L + 1e-9) { return false; }
      return list.length < 2 || (L - sum) / (list.length - 1) >= APART - 1e-9;
    }
    function cutAvail(avail, wl, a, b) {
      var out = [];
      avail.forEach(function (u) {
        if (u.wall !== wl) { out.push(u); return; }
        cutRuns([[u.t0, u.t1]], a, b).forEach(function (p) { out.push({ wall: wl, t0: p[0], t1: p[1] }); });
      });
      return out.filter(function (u) { return u.t1 - u.t0 >= 0.3; });
    }
    function put(it, wl, t, zc, tier, wallOurs, pinned) {
      var w = it.w, sz = it.size, free = standsFree(w, sz);
      var room = roomById(world, w.room), fl = world.floors[room.floor];
      var base = fl.z + room.fz;
      // Into the room: works face the way the wall's normal does not.
      var nx = -wl.nx, ny = -wl.ny, out = INTO + (free ? FREE_OUT : 0);
      var cx = wl.x0 + wl.ux * t + nx * out, cy = wl.y0 + wl.uy * t + ny * out;
      var z0, z1;
      if (free) { z0 = base; z1 = base + sz.h; }
      else if (sz.h > TALL && tier === 1) { z0 = base + LIFTED; z1 = z0 + sz.h; }
      else { z0 = zc - sz.h / 2; z1 = zc + sz.h / 2; }
      // Left to right as you face the wall.
      var hx = wl.ux * sz.w / 2, hy = wl.uy * sz.w / 2;
      var h = {
        id: w.id, work: w, floor: fl.index, room: room.index, wall: it.pin && it.pin.wall || w.wall || null,
        x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy, z0: z0, z1: z1, nx: nx, ny: ny,
        w: sz.w, h: sz.h, d: sz.d, sized: sz.known, free: free, standing: free || (sz.h > TALL && tier === 1),
        tier: tier, ours: !pinned, wallOurs: !!wallOurs, t: t / wl.len, cx: cx, cy: cy
      };
      h.spot = stand(h, world);
      hung.push(h);
    }
    function centre(list, room, fl, base) {
      // At the room's middle, facing its nearest opening (ours), in a row
      // along its long side where there are several.
      var fx = 0, fy = 1, best = Infinity;
      fl.doors.forEach(function (d) {
        if (d.a !== room.index && d.b !== room.index) { return; }
        var dd = hypot(d.x - room.cx, d.y - room.cy);
        if (dd < best && dd > 0.01) { best = dd; fx = (d.x - room.cx) / dd; fy = (d.y - room.cy) / dd; }
      });
      var wide = room.bbox[2] - room.bbox[0] >= room.bbox[3] - room.bbox[1];
      var step = 0;
      list.forEach(function (it) { step = max(step, it.size.w + VIEW); });
      list.forEach(function (it, k) {
        var sz = it.size, off = (k - (list.length - 1) / 2) * step;
        var cx = room.cx + (wide ? off : 0), cy = room.cy + (wide ? 0 : off);
        var hx = -fy * sz.w / 2, hy = fx * sz.w / 2;
        var h = {
          id: it.w.id, work: it.w, floor: fl.index, room: room.index, wall: "centre",
          x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy, z0: base, z1: base + sz.h, nx: fx, ny: fy,
          w: sz.w, h: sz.h, d: sz.d, sized: sz.known, free: true, standing: true, tier: 1, ours: true,
          wallOurs: false, t: 0.5, cx: cx, cy: cy
        };
        if (!standsFree(it.w, sz) && sz.h <= TALL) { h.z0 = base + HANG - sz.h / 2; h.z1 = base + HANG + sz.h / 2; h.standing = false; }
        h.spot = stand(h, world);
        hung.push(h);
      });
    }
  }

  // Where to stand before a hung work: on its centre line, max(1.2 m, 1.5 x
  // its larger side) out, facing it — brought in where the room is shorter.
  function stand(h, world) {
    var dist = max(VIEW, VIEW_K * max(h.w, h.h)), x = h.cx, y = h.cy, got = null;
    var fl = world && world.floors[h.floor];
    if (fl) {
      var clear = clearance(fl);
      for (var s = 0.3; s <= dist + 1e-9; s += 0.1) {
        var q = cellAt(fl, h.cx + h.nx * s, h.cy + h.ny * s);
        if (!walkable(fl, q)) { break; }
        if (clear[q] >= CLEAR) { got = s; }
      }
    }
    var d = got === null ? dist : got;
    return { x: x + h.nx * d, y: y + h.ny * d, face: atan2(-h.ny, -h.nx), floor: h.floor, d: d };
  }

  /* ---------------------------------------------------------------- moving */

  // How far each cell is from the nearest place that cannot be walked, in
  // metres (an exact distance transform, Felzenszwalb and Huttenlocher's).
  function clearance(fl) {
    if (fl.clear) { return fl.clear; }
    var gw = fl.gw, gh = fl.gh, INF = 1e20, d2 = new Float64Array(fl.n);
    for (var q = 0; q < fl.n; q += 1) { d2[q] = walkable(fl, q) ? INF : 0; }
    var len = max(gw, gh), f = new Float64Array(len), d = new Float64Array(len);
    var v = new Int32Array(len), z = new Float64Array(len + 1);
    function pass(n) {
      var k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (var i = 1; i < n; i += 1) {
        var s = ((f[i] + i * i) - (f[v[k]] + v[k] * v[k])) / (2 * i - 2 * v[k]);
        while (s <= z[k]) { k -= 1; s = ((f[i] + i * i) - (f[v[k]] + v[k] * v[k])) / (2 * i - 2 * v[k]); }
        k += 1; v[k] = i; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (var j = 0; j < n; j += 1) {
        while (z[k + 1] < j) { k += 1; }
        d[j] = (j - v[k]) * (j - v[k]) + f[v[k]];
      }
    }
    var i, j;
    for (i = 0; i < gw; i += 1) {
      for (j = 0; j < gh; j += 1) { f[j] = d2[j * gw + i]; }
      pass(gh);
      for (j = 0; j < gh; j += 1) { d2[j * gw + i] = d[j]; }
    }
    for (j = 0; j < gh; j += 1) {
      for (i = 0; i < gw; i += 1) { f[i] = d2[j * gw + i]; }
      pass(gw);
      for (i = 0; i < gw; i += 1) { d2[j * gw + i] = d[i]; }
    }
    var out = new Float32Array(fl.n);
    for (q = 0; q < fl.n; q += 1) { out[q] = max(0, sqrt(d2[q]) * fl.cell - fl.cell / 2); }
    fl.clear = out;
    return out;
  }

  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    var k = this.k, v = this.v, i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (k[p] <= key) { break; }
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    var k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      var i = 0;
      for (;;) {
        var a = 2 * i + 1, b = a + 1, m = i, mk = lk;
        if (a < n && k[a] < mk) { m = a; mk = k[a]; }
        if (b < n && k[b] < mk) { m = b; }
        if (m === i) { break; }
        k[i] = k[m]; v[i] = v[m]; i = m;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  };
  Heap.prototype.size = function () { return this.k.length; };

  function passable(fl, q, clear) { return walkable(fl, q) && clear[q] >= CLEAR - 1e-6; }
  function stepOK(fl, a, b) { return abs(fl.fh[a] - fl.fh[b]) <= STEP * 100 && fl.ch[b] - fl.fh[a] >= HEAD * 100; }

  // Whether a straight line on one floor can be walked.
  function sightline(fl, clear, x0, y0, x1, y1) {
    var len = hypot(x1 - x0, y1 - y0), n = max(1, ceil(len / (fl.cell / 2)));
    var prev = cellAt(fl, x0, y0);
    for (var s = 1; s <= n; s += 1) {
      var q = cellAt(fl, x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n);
      if (q !== prev) {
        if (!passable(fl, q, clear) || (prev >= 0 && !stepOK(fl, prev, q))) { return false; }
        prev = q;
      }
    }
    return true;
  }

  // The way from one place to another, over the floors' grids at their own
  // cells: A*, eight neighbours without cutting corners, 0.25 m clear of
  // walls, steps of at most 0.35 m, 2 m of headroom, up and down the stairs
  // and by the lifts; then straightened wherever a line can be walked.
  // from, to: {x, y, floor} (floor an index or id) or [x, y, floor].
  // Returns [[x, y, floorIndex], …] or null.
  function path(world, from, to) {
    function pt(p) {
      var o = Array.isArray(p) ? { x: p[0], y: p[1], floor: p[2] } : p;
      var fl = floorOf(world, o.floor === undefined ? 0 : o.floor);
      return fl ? { x: o.x, y: o.y, fl: fl } : null;
    }
    var A = pt(from), B = pt(to);
    if (!A || !B) { return null; }
    var offs = [], total = 0;
    world.floors.forEach(function (fl) { offs.push(total); total += fl.n; clearance(fl); });
    function nearest(p) {
      // The walkable cell nearest a point, within a few metres.
      var q = cellAt(p.fl, p.x, p.y), cl = p.fl.clear;
      if (passable(p.fl, q, cl)) { return q; }
      var best = -1, bd = Infinity, R = ceil(3 / p.fl.cell);
      var i0 = floor((p.x - p.fl.x0) / p.fl.cell), j0 = floor((p.y - p.fl.y0) / p.fl.cell);
      for (var dj = -R; dj <= R; dj += 1) {
        for (var di = -R; di <= R; di += 1) {
          var i = i0 + di, j = j0 + dj;
          if (i < 0 || j < 0 || i >= p.fl.gw || j >= p.fl.gh) { continue; }
          var qq = j * p.fl.gw + i;
          if (!passable(p.fl, qq, cl)) { continue; }
          var d = di * di + dj * dj;
          if (d < bd) { bd = d; best = qq; }
        }
      }
      return best;
    }
    var qa = nearest(A), qb = nearest(B);
    if (qa < 0 || qb < 0) { return null; }
    var start = offs[A.fl.index] + qa, goal = offs[B.fl.index] + qb;
    var gB = centreOf(B.fl, qb);
    var g = new Float32Array(total).fill(Infinity), came = new Int32Array(total).fill(-1);
    var shut = new Uint8Array(total), heap = new Heap();
    function fOf(node) {
      var fi = floorAt(node), fl = world.floors[fi], c = centreOf(fl, node - offs[fi]);
      return hypot(c[0] - gB[0], c[1] - gB[1]);
    }
    function floorAt(node) {
      var fi = 0;
      while (fi + 1 < offs.length && node >= offs[fi + 1]) { fi += 1; }
      return fi;
    }
    g[start] = 0;
    heap.push(fOf(start), start);
    var N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (heap.size()) {
      var node = heap.pop();
      if (shut[node]) { continue; }
      shut[node] = 1;
      if (node === goal) { break; }
      var fi = floorAt(node), fl = world.floors[fi], q = node - offs[fi], cl = fl.clear;
      var i = q % fl.gw, j = floor(q / fl.gw);
      for (var k = 0; k < 8; k += 1) {
        var di = N8[k][0], dj = N8[k][1], a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= fl.gw || b >= fl.gh) { continue; }
        var p = b * fl.gw + a;
        if (!passable(fl, p, cl) || !stepOK(fl, q, p)) { continue; }
        if (di && dj) {
          var s1 = j * fl.gw + a, s2 = b * fl.gw + i;
          if (!passable(fl, s1, cl) || !passable(fl, s2, cl)) { continue; }
        }
        relax(node, offs[fi] + p, (di && dj ? SQRT2 : 1) * fl.cell);
      }
      // Up or down a stair: the same place on the floor it joins.
      if (fl.stair[q] >= 0) {
        var st = world.stairs[fl.stair[q]], other = st.from === fi ? st.to : st.from;
        var c = centreOf(fl, q), of = world.floors[other], oq = cellAt(of, c[0], c[1]);
        if (oq >= 0 && of.stair[oq] === st.index && passable(of, oq, of.clear)) { relax(node, offs[other] + oq, 0); }
      }
      // By a lift: its middle on each of its floors.
      if (fl.lift[q] >= 0) {
        var lf = world.lifts[fl.lift[q]];
        lf.floors.forEach(function (fo) {
          if (fo === fi) { return; }
          var ol = world.floors[fo], mq = cellAt(ol, (lf.rect[0] + lf.rect[2]) / 2, (lf.rect[1] + lf.rect[3]) / 2);
          if (mq >= 0 && passable(ol, mq, ol.clear)) { relax(node, offs[fo] + mq, 4); }
        });
      }
    }
    if (came[goal] < 0 && goal !== start) { return null; }
    function relax(from_, to_, cost) {
      var ng = g[from_] + cost;
      if (ng < g[to_]) { g[to_] = ng; came[to_] = from_; heap.push(ng + fOf(to_), to_); }
    }
    var cells = [];
    for (var n = goal; n >= 0; n = came[n]) {
      var fj = floorAt(n), cc = centreOf(world.floors[fj], n - offs[fj]);
      cells.push([cc[0], cc[1], fj]);
      if (n === start) { break; }
    }
    cells.reverse();
    cells[0] = [A.x, A.y, A.fl.index];
    if (cells.length > 1) { cells[cells.length - 1] = [B.x, B.y, B.fl.index]; } else { cells.push([B.x, B.y, B.fl.index]); }
    // Straightened: skip ahead to the farthest point in plain sight on the same floor.
    var out = [cells[0]], at = 0;
    while (at < cells.length - 1) {
      var next = at + 1;
      for (var m = cells.length - 1; m > at + 1; m -= 1) {
        if (cells[m][2] !== cells[at][2]) { continue; }
        var same = true;
        for (var t = at; t <= m; t += 1) { if (cells[t][2] !== cells[at][2]) { same = false; break; } }
        if (!same) { continue; }
        var fl2 = world.floors[cells[at][2]];
        if (sightline(fl2, fl2.clear, cells[at][0], cells[at][1], cells[m][0], cells[m][1])) { next = m; break; }
      }
      out.push(cells[next]);
      at = next;
    }
    return out;
  }

  /* ---------------------------------------------------------------- the entrance */

  // A shell's door: the middle of the longest run of the model's outer wall
  // facing south with the inside behind it — east, west or north where no
  // wall facing south has — at the floor's height. Returns {x, y, dx, dy}:
  // the middle of the wall's outer face, and the way out.
  function shellDoor(world, fl) {
    var cell = fl.cell, deep = ceil(world.vox.v * 2 / cell) + 1;
    var ways = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    for (var w = 0; w < ways.length; w += 1) {
      var di = ways[w][0], dj = ways[w][1], best = null;
      var face = function (i, j) {
        if (i < 0 || j < 0 || i >= fl.gw || j >= fl.gh) { return false; }
        var q = j * fl.gw + i, oi = i + di, oj = j + dj;
        if (fl.foot[q] !== 2 || fl.kind[q] === FLOOR) { return false; }
        if (oi < 0 || oj < 0 || oi >= fl.gw || oj >= fl.gh) { return false; }
        var o = oj * fl.gw + oi;
        if (fl.foot[o] !== 0 || fl.kind[o] !== CLOSED) { return false; }
        for (var s = 1; s <= deep; s += 1) {
          var ii = i - di * s, jj = j - dj * s;
          if (ii < 0 || jj < 0 || ii >= fl.gw || jj >= fl.gh) { return false; }
          if (fl.foot[jj * fl.gw + ii] === 1) { return true; }
        }
        return false;
      };
      // Runs along the wall: along x for a wall facing south or north, along y else.
      var lines = dj ? fl.gh : fl.gw, len = dj ? fl.gw : fl.gh;
      for (var a = 0; a < lines; a += 1) {
        var run = null;
        for (var b = 0; b <= len; b += 1) {
          var ok = b < len && (dj ? face(b, a) : face(a, b));
          if (ok && !run) { run = { a: a, b0: b }; }
          if (!ok && run) {
            run.b1 = b - 1;
            if (!best || run.b1 - run.b0 > best.b1 - best.b0) { best = run; }
            run = null;
          }
        }
      }
      if (!best) { continue; }
      var mid = floor((best.b0 + best.b1) / 2);
      var i0 = dj ? mid : best.a, j0 = dj ? best.a : mid;
      var c = centreOf(fl, j0 * fl.gw + i0);
      return { x: c[0] + di * cell / 2, y: c[1] + dj * cell / 2, dx: di, dy: dj, run: (best.b1 - best.b0 + 1) * cell };
    }
    return null;
  }

  /* ---------------------------------------------------------------- building a floor */

  function footprint(world, fl) {
    var vx = world.vox;
    if (!vx) { return; }
    var zc = fl.z + EYE;
    for (var q = 0; q < fl.n; q += 1) {
      var c = centreOf(fl, q), m = toWorld(world, c[0], c[1]), col = columnAt(vx, m[0], m[1]);
      var b = builtAt(vx, col, zc);
      if (!b) {
        // What the ground outside is, underfoot: the model's top below the floor.
        if (col >= 0) {
          for (var k = min(vx.nz - 1, floor((fl.z + STEP) / vx.v)); k >= 0; k -= 1) {
            var mm = vx.grid[k * vx.nx * vx.ny + col];
            if (mm) { fl.footM[q] = mm; break; }
          }
        }
        continue;
      }
      fl.foot[q] = deepAt(vx, col, zc) ? 1 : 2;
      fl.footM[q] = b;
    }
  }

  function extentOf(world, fs, rooms, extra) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    function add(x, y) {
      b[0] = min(b[0], x); b[1] = min(b[1], y); b[2] = max(b[2], x); b[3] = max(b[3], y);
    }
    rooms.forEach(function (r) { if (r.poly) { add(r.bbox[0], r.bbox[1]); add(r.bbox[2], r.bbox[3]); } });
    extra.forEach(function (p) { add(p[0], p[1]); });
    var vx = world.vox;
    if (vx) {
      // The model's footprint at this floor, where it has one.
      var zc = fs.z + EYE, k = floor(zc / vx.v);
      if (k >= 0 && k < vx.nz) {
        for (var j = 0; j < vx.ny; j += 1) {
          for (var i = 0; i < vx.nx; i += 1) {
            var m = vx.grid[k * vx.nx * vx.ny + j * vx.nx + i];
            if (!m || !vx.built[m - 1]) { continue; }
            var x0 = i * vx.v - vx.site[0] / 2, y0 = j * vx.v - vx.site[1] / 2;
            [[x0, y0], [x0 + vx.v, y0], [x0, y0 + vx.v], [x0 + vx.v, y0 + vx.v]].forEach(function (p) {
              var g = toGrid(world, p[0], p[1]);
              add(g[0], g[1]);
            });
          }
        }
      }
    }
    return b;
  }

  function buildFloor(world, fs, index, interior, sources) {
    var f = world, cell = world.cell;
    var probe = { index: index, id: fs.id, z: fs.z || 0 };
    var rooms = (fs.rooms || []).map(function (spec, n) { return roomOf(spec, n, probe, f); });
    // Everything this floor holds or is joined by, for its extent.
    var extra = [];
    function rectPts(r) { extra.push([r[0], r[1]], [r[2], r[3]]); }
    (fs.open || []).forEach(function (o) {
      if (o.cut) { rectPts(rectOf(f, o.cut)); }
      if (o.at) { var g = toGrid(f, o.at[0], o.at[1]); extra.push([g[0] - 3, g[1] - 3], [g[0] + 3, g[1] + 3]); }
    });
    (fs.things || []).forEach(function (t) { if (t.box) { rectPts(rectOf(f, t.box)); } });
    world.stairSpecs.forEach(function (st) { if (st.from === fs.id || st.to === fs.id) { rectPts(rectOf(f, st.rect)); } });
    world.liftSpecs.forEach(function (lf) { if ((lf.floors || []).indexOf(fs.id) >= 0) { rectPts(rectOf(f, lf.rect)); } });
    var e = interior.enter;
    if (e && e.floor === fs.id) {
      [e.at, e.door].forEach(function (p) { if (p) { var g = toGrid(f, p[0], p[1]); extra.push(g); } });
      (e.out || []).forEach(function (r) { rectPts(rectOf(f, r)); });
    }
    var b = extentOf(world, fs, rooms, extra);
    if (!isFinite(b[0])) { b = [-10, -10, 10, 10]; }
    var margin = 3 * cell + 1;
    var i0 = floor((b[0] - margin) / cell), j0 = floor((b[1] - margin) / cell);
    var i1 = ceil((b[2] + margin) / cell), j1 = ceil((b[3] + margin) / cell);
    var fl = newFloor(index, fs, i0 * cell, j0 * cell, i1 - i0, j1 - j0, cell);
    fl.rooms = rooms;
    rooms.forEach(function (r) { r.floor = index; });
    if (fl.n > 400000) { world.problems.push({ rule: "size", text: "floor " + fs.id + " has " + fl.n + " cells" }); }
    // The model's footprint, then the rooms, then what is left: earth inside
    // the footprint, its outer wall on its edge, and outside, the ground.
    footprint(world, fl);
    var over = raster(fl, rooms);
    Object.keys(over).forEach(function (k) {
      var ab = k.split(",").map(Number);
      world.overlaps.push({ floor: index, a: ab[0], b: ab[1], cells: over[k] });
    });
    for (var q = 0; q < fl.n; q += 1) {
      if (fl.room[q] >= 0) { continue; }
      if (fl.foot[q]) {
        var mat = world.vox.names[fl.footM[q] - 1];
        fl.kind[q] = fl.foot[q] === 2 && MATS[mat] && MATS[mat].glass ? GLASS : WALL;
      } else {
        fl.kind[q] = CLOSED;
        fl.fh[q] = cm(groundUnder(world, fl, q));
      }
    }
    seal(fl);
    // The ground outside the door that can be walked.
    fl.outside = fl.rooms.length;
    fl.rooms.push(roomOf({ id: "outside", name: null, kind: "lobby", sure: e && e.sure, src: e && e.src,
                           pseudo: "outside" }, fl.outside, fl, f));
    var outRoom = fl.rooms[fl.outside];
    outRoom.poly = null; outRoom.bbox = [0, 0, 0, 0];
    if (e && e.floor === fs.id) {
      (e.out || []).forEach(function (r) {
        var g = rectOf(f, r);
        for (var qq = 0; qq < fl.n; qq += 1) {
          var c = centreOf(fl, qq);
          if (c[0] < g[0] || c[0] >= g[2] || c[1] < g[1] || c[1] >= g[3]) { continue; }
          if (fl.room[qq] >= 0 || fl.kind[qq] !== CLOSED) { continue; }
          fl.kind[qq] = FLOOR; fl.room[qq] = fl.outside; fl.fh[qq] = cm(fl.z);
        }
      });
    }
    // The openings.
    (fs.open || []).forEach(function (o, n) {
      var a = indexOfRoom(rooms, o.a), bi = o.b === "outside" ? -1 : indexOfRoom(rooms, o.b);
      var d = { index: n, a: a, b: bi, aId: o.a, bId: o.b, w: typeof o.w === "number" ? o.w : DOOR_W,
                h: typeof o.h === "number" ? o.h : null, kind: o.kind || "door", sure: o.sure || null,
                src: o.src || [], note: o.note || null, x: 0, y: 0, ax: 0, ay: 0, cells: 0, spec: o };
      fl.doors.push(d);
      if (a < 0 || (bi < 0 && o.b !== "outside")) {
        world.problems.push({ rule: "open", text: "opening " + (o.a || "?") + " — " + (o.b || "?") + " on " + fs.id +
                              ": a room it joins is not on this floor" });
        return;
      }
      if (o.cut) { d.cut = rectOf(f, o.cut); } else if (o.at) { var g = toGrid(f, o.at[0], o.at[1]); d.x = g[0]; d.y = g[1]; }
      else {
        world.problems.push({ rule: "open", text: "opening " + o.a + " — " + o.b + " has neither at nor cut" });
        return;
      }
      var res = carve(fl, d);
      d.cells = res.ok ? res.cells : 0;
      d.thick = res.thick;
      if (!res.ok) { world.problems.push({ rule: "open", text: "opening " + o.a + " — " + o.b + " on " + fs.id + ": " + res.why }); }
    });
    // Things a source names: a fountain stands up out of the floor, and
    // what is solid is walked round.
    (fs.things || []).forEach(function (t, n) {
      if (!t.box) { return; }
      var g = rectOf(f, t.box), hgt = t.box[4] || 0;
      var thing = { index: n, rect: g, h: hgt, m: t.m || null, solid: t.solid !== false, sure: t.sure || null,
                    src: t.src || [], note: t.note || null };
      fl.things.push(thing);
      for (var qq = 0; qq < fl.n; qq += 1) {
        var c = centreOf(fl, qq);
        if (c[0] < g[0] || c[0] >= g[2] || c[1] < g[1] || c[1] >= g[3]) { continue; }
        if (fl.kind[qq] === WALL || fl.kind[qq] === GLASS) { continue; }
        var host = fl.room[qq] >= 0 ? fl.rooms[fl.room[qq]] : null;
        fl.fh[qq] = cm(fl.z + (host ? host.fz : 0) + hgt);
        if (thing.solid) { fl.kind[qq] = CLOSED; }
        fl.thing = fl.thing || new Int16Array(fl.n).fill(-1);
        fl.thing[qq] = n;
      }
    });
    return fl;
  }

  function indexOfRoom(rooms, id) {
    for (var i = 0; i < rooms.length; i += 1) { if (rooms[i].id === id && !rooms[i].pseudo) { return i; } }
    return -1;
  }

  // The ground under a cell outside: the model's top, below the floor.
  function groundUnder(world, fl, q) {
    var vx = world.vox;
    if (!vx) { return fl.z; }
    var c = centreOf(fl, q), m = toWorld(world, c[0], c[1]), col = columnAt(vx, m[0], m[1]);
    if (col < 0) { return 0; }
    for (var k = min(vx.nz - 1, floor((fl.z + STEP) / vx.v)); k >= 0; k -= 1) {
      var mm = vx.grid[k * vx.nx * vx.ny + col];
      if (mm) { return (k + 1) * vx.v; }
    }
    return 0;
  }

  // A museum nobody has researched yet: its model's footprint at the floor,
  // eroded a voxel — the ring is the model's outer wall, what is inside it
  // is bare earth to walk on — entered by its real door where that is
  // known, else at the middle of its longest wall facing south.
  function shellFloor(world, interior) {
    var e = interior.enter || null, z0 = e && typeof e.z === "number" ? e.z : 0;
    var fs = { id: "shell", name: null, z: z0, sure: "reconstructed", src: ["model"] };
    var extra = [];
    if (e) {
      [e.at, e.door].forEach(function (p) { if (p) { extra.push(toGrid(world, p[0], p[1])); } });
      (e.out || []).forEach(function (r) { var g = rectOf(world, r); extra.push([g[0], g[1]], [g[2], g[3]]); });
    }
    var b = extentOf(world, fs, [], extra), cell = world.cell;
    if (!isFinite(b[0])) { b = [-10, -10, 10, 10]; }
    var margin = OUT_D + 3 * cell + 2;
    var i0 = floor((b[0] - margin) / cell), j0 = floor((b[1] - margin) / cell);
    var i1 = ceil((b[2] + margin) / cell), j1 = ceil((b[3] + margin) / cell);
    var fl = newFloor(0, fs, i0 * cell, j0 * cell, i1 - i0, j1 - j0, cell);
    footprint(world, fl);
    fl.rooms.push(roomOf({ id: "shell", name: null, kind: "hall", sure: "reconstructed", src: ["model"],
                          pseudo: "shell" }, 0, fl, world));
    var shellRoom = fl.rooms[0];
    shellRoom.poly = null;
    fl.outside = 1;
    fl.rooms.push(roomOf({ id: "outside", name: null, kind: "lobby", sure: "reconstructed", src: ["model"],
                          pseudo: "outside" }, 1, fl, world));
    fl.rooms[1].poly = null;
    var inside = 0;
    for (var q = 0; q < fl.n; q += 1) {
      if (fl.foot[q] === 1) {
        fl.kind[q] = FLOOR; fl.room[q] = 0; fl.fh[q] = cm(z0); inside += 1;
      } else if (fl.foot[q] === 2) {
        var mat = world.vox.names[fl.footM[q] - 1];
        fl.kind[q] = MATS[mat] && MATS[mat].glass ? GLASS : WALL;
      } else {
        fl.kind[q] = CLOSED; fl.fh[q] = cm(groundUnder(world, fl, q));
      }
    }
    if (!inside) { world.problems.push({ rule: "shell", text: "the model has no inside at " + (z0 + EYE) + " m" }); }
    var bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (q = 0; q < fl.n; q += 1) {
      if (fl.room[q] !== 0) { continue; }
      var c = centreOf(fl, q);
      bb[0] = min(bb[0], c[0]); bb[1] = min(bb[1], c[1]); bb[2] = max(bb[2], c[0]); bb[3] = max(bb[3], c[1]);
    }
    shellRoom.bbox = isFinite(bb[0]) ? bb : [0, 0, 0, 0];
    shellRoom.cx = (shellRoom.bbox[0] + shellRoom.bbox[2]) / 2; shellRoom.cy = (shellRoom.bbox[1] + shellRoom.bbox[3]) / 2;
    shellRoom.area = inside * cell * cell;
    // The door and the ground before it.
    var door, at, face, out;
    if (e && e.door) {
      door = toGrid(world, e.door[0], e.door[1]);
      at = e.at ? toGrid(world, e.at[0], e.at[1]) : [door[0], door[1] + 2];
      face = typeof e.face === "number" ? headingOf(world, e.face) : -PI / 2;
      out = (e.out || []).map(function (r) { return rectOf(world, r); });
    } else {
      var sd = shellDoor(world, fl);
      if (!sd) {
        world.problems.push({ rule: "shell", text: "the model has no outer wall with an inside behind it to enter by" });
        door = [shellRoom.cx, shellRoom.cy]; at = door.slice(); face = -PI / 2; out = [];
      } else {
        // In the middle of the wall, standing 2 m out, facing in.
        door = [sd.x - sd.dx * fl.cell, sd.y - sd.dy * fl.cell];
        at = [sd.x + sd.dx * 2, sd.y + sd.dy * 2];
        face = atan2(-sd.dy, -sd.dx);
        var ox = sd.dx ? [sd.x, sd.x + sd.dx * OUT_D] : [sd.x - OUT_W / 2, sd.x + OUT_W / 2];
        var oy = sd.dy ? [sd.y, sd.y + sd.dy * OUT_D] : [sd.y - OUT_W / 2, sd.y + OUT_W / 2];
        out = [[min(ox[0], ox[1]), min(oy[0], oy[1]), max(ox[0], ox[1]), max(oy[0], oy[1])]];
      }
    }
    out.forEach(function (g) {
      for (var qq = 0; qq < fl.n; qq += 1) {
        var c2 = centreOf(fl, qq);
        if (c2[0] < g[0] || c2[0] >= g[2] || c2[1] < g[1] || c2[1] >= g[3]) { continue; }
        if (fl.kind[qq] !== CLOSED) { continue; }
        fl.kind[qq] = FLOOR; fl.room[qq] = 1; fl.fh[qq] = cm(z0);
      }
    });
    var d = { index: 0, a: 0, b: -1, aId: "shell", bId: "outside", x: door[0], y: door[1], w: DOOR_W, h: null,
              kind: "door", sure: "reconstructed", src: ["model"], note: "the model's longest south wall, by the rule",
              ax: 0, ay: 0, cells: 0 };
    fl.doors.push(d);
    var res = carve(fl, d, max(THICK, (world.vox ? world.vox.v : 0) * 2 + cell));
    d.cells = res.ok ? res.cells : 0;
    if (!res.ok) { world.problems.push({ rule: "shell", text: "its door could not be carved: " + res.why }); }
    world.enter = { floor: 0, x: at[0], y: at[1], a: face, door: door, out: out,
                    sure: e ? e.sure || "reconstructed" : "reconstructed", src: e ? e.src || [] : ["model"],
                    note: e ? e.note || null : "the middle of the model's longest south-facing wall", shell: true };
    return fl;
  }

  /* ---------------------------------------------------------------- reach */

  function reachAll(world) {
    var e = world.enter;
    if (!e || !world.floors[e.floor]) { return 0; }
    var start = world.floors[e.floor], q = cellAt(start, e.x, e.y);
    if (!walkable(start, q)) { q = cellAt(start, e.door[0], e.door[1]); }
    if (!walkable(start, q)) { return 0; }
    var seen = world.floors.map(function (fl) { return new Uint8Array(fl.n); });
    var stack = [[e.floor, q]], count = 0;
    seen[e.floor][q] = 1;
    while (stack.length) {
      var it = stack.pop(), fi = it[0], c = it[1], fl = world.floors[fi];
      count += 1;
      if (fl.room[c] >= 0) { fl.rooms[fl.room[c]].reach = true; }
      var i = c % fl.gw;
      [c - 1, c + 1, c - fl.gw, c + fl.gw].forEach(function (p, n) {
        if (p < 0 || p >= fl.n || (n === 0 && i === 0) || (n === 1 && i === fl.gw - 1)) { return; }
        if (seen[fi][p] || !walkable(fl, p) || !stepOK(fl, c, p)) { return; }
        seen[fi][p] = 1; stack.push([fi, p]);
      });
      if (fl.stair[c] >= 0) {
        var st = world.stairs[fl.stair[c]], other = st.from === fi ? st.to : st.from;
        var pc = centreOf(fl, c), of = world.floors[other], oq = cellAt(of, pc[0], pc[1]);
        if (oq >= 0 && !seen[other][oq] && of.stair[oq] === st.index && walkable(of, oq)) { seen[other][oq] = 1; stack.push([other, oq]); }
      }
      if (fl.lift[c] >= 0) {
        var lf = world.lifts[fl.lift[c]];
        lf.floors.forEach(function (fo) {
          var ol = world.floors[fo];
          for (var k = 0; k < ol.n; k += 1) {
            if (ol.lift[k] === lf.index && !seen[fo][k] && walkable(ol, k)) { seen[fo][k] = 1; stack.push([fo, k]); }
          }
        });
      }
    }
    return count;
  }

  /* ---------------------------------------------------------------- compiling */

  // Compile an interior file against its building's model. opts: {soil(i,
  // j) → [r, g, b, size] | null, the DIRT at the cell i east and j south of
  // the grid's origin; sky: {alt, dark} or a function giving it; dark:
  // [r, g, b], the frame's own dark}. Returns the world (see the notes in
  // INTERIORS.md and the head of this file).
  function compile(interior, modelSpec, opts) {
    opts = opts || {};
    interior = interior || {};
    MATS = Models().MATERIALS;
    var grid = interior.grid || {}, f = frameOf(grid.turn || 0);
    var world = {
      slug: interior.slug || (modelSpec && modelSpec.slug) || null, building: interior.building || null,
      cell: grid.cell || 0.5, turn: f.turn, cos: f.cos, sin: f.sin,
      floors: [], stairs: [], lifts: [], enter: null, tier: "shell", shell: false,
      vox: modelOf(modelSpec), sky: skyOf(opts.sky), dark: opts.dark || DARK_INK,
      groundMaterial: modelSpec && modelSpec.ground || null,
      sources: {}, works: interior.works || [], pins: interior.pins || {},
      problems: [], overlaps: [], stairSpecs: [], liftSpecs: []
    };
    (interior.sources || []).forEach(function (s) { if (s && s.id) { world.sources[s.id] = s; } });
    var vx = world.vox;
    world.model = vx ? { v: vx.v, site: vx.site.slice(), nx: vx.nx, ny: vx.ny, nz: vx.nz } : null;
    var specs = interior.floors && interior.floors.length ? interior.floors : null;
    if (!specs) {
      if (!vx) { world.problems.push({ rule: "shell", text: "no model to make its shell from" }); return world; }
      world.shell = true;
      world.floors.push(shellFloor(world, interior));
    } else {
      var seenStair = {}, seenLift = {};
      specs.forEach(function (fs) {
        (fs.stairs || []).forEach(function (st) { if (st && st.id && !seenStair[st.id]) { seenStair[st.id] = 1; world.stairSpecs.push(st); } });
        (fs.lifts || []).forEach(function (lf) { if (lf && lf.id && !seenLift[lf.id]) { seenLift[lf.id] = 1; world.liftSpecs.push(lf); } });
      });
      specs.forEach(function (fs, n) { world.floors.push(buildFloor(world, fs, n, interior)); });
      var idx = {};
      world.floors.forEach(function (fl) { idx[fl.id] = fl.index; });
      // The entrance.
      var e = interior.enter;
      if (e && idx[e.floor] !== undefined && e.door) {
        var door = toGrid(f, e.door[0], e.door[1]);
        var at = e.at ? toGrid(f, e.at[0], e.at[1]) : door.slice();
        world.enter = { floor: idx[e.floor], x: at[0], y: at[1], a: headingOf(f, e.face || 0), door: door,
                        out: (e.out || []).map(function (r) { return rectOf(f, r); }), sure: e.sure || null,
                        src: e.src || [], note: e.note || null, shell: false };
      } else {
        world.problems.push({ rule: "enter", text: e ? "the entrance is not on a floor of the file" : "no entrance" });
      }
      // Ceilings first, so a stair can take the higher of the two over it.
      world.floors.forEach(function (fl) { ceilings(world, fl); });
      world.stairSpecs.forEach(function (st, n) {
        var c = { index: n, id: st.id, name: st.name == null ? null : st.name, rect: rectOf(f, st.rect || [0, 0, 0, 0]),
                  rise: /^[+-][xy]$/.test(st.rise || "") ? st.rise : "+x", from: idx[st.from], to: idx[st.to],
                  sure: st.sure || null, src: st.src || [] };
        world.stairs.push(c);
        if (c.from === undefined || c.to === undefined) {
          world.problems.push({ rule: "stair", text: "stair " + st.id + " joins a floor that is not in the file" });
          return;
        }
        var fa = world.floors[c.from], fb = world.floors[c.to], before = {};
        [fa, fb].forEach(function (fl) {
          before[fl.index] = { ch: fl.ch.slice(), ck: fl.ck.slice() };
        });
        var res = ramp(world, c);
        if (!res.ok) { world.problems.push({ rule: "stair", text: "stair " + st.id + ": " + res.why }); }
        // Over a stair, the higher of what was over it on either floor: the stairwell.
        [fa, fb].forEach(function (fl) {
          var other = fl === fa ? fb : fa;
          for (var q = 0; q < fl.n; q += 1) {
            if (fl.stair[q] !== c.index) { continue; }
            var p = centreOf(fl, q), oq = cellAt(other, p[0], p[1]);
            var mine = before[fl.index].ch[q], theirs = oq >= 0 ? before[other.index].ch[oq] : OPEN;
            var hi = max(mine, theirs);
            fl.ch[q] = max(hi, fl.fh[q] + HEAD * 100 + 20);
            fl.ck[q] = hi === mine ? before[fl.index].ck[q] : before[other.index].ck[oq];
          }
        });
      });
      world.liftSpecs.forEach(function (lf, n) {
        var c = { index: n, id: lf.id, name: lf.name == null ? null : lf.name, rect: rectOf(f, lf.rect || [0, 0, 0, 0]),
                  floors: (lf.floors || []).map(function (id) { return idx[id]; }).filter(function (i) { return i !== undefined; }),
                  sure: lf.sure || null, src: lf.src || [] };
        world.lifts.push(c);
        lift(world, c);
        c.floors.forEach(function (fi) {
          var fl = world.floors[fi];
          for (var q = 0; q < fl.n; q += 1) {
            if (fl.lift[q] === c.index) { fl.ch[q] = cm(fl.z + 2.4); fl.ck[q] = DARK; }
          }
        });
      });
    }
    world.floors.forEach(function (fl) {
      if (world.shell) { ceilings(world, fl); }
      inks(world, fl, opts.soil);
    });
    reachAll(world);
    world.floors.forEach(function (fl) {
      fl.rooms.forEach(function (r) { r.walls = r.pseudo === "outside" ? [] : wallsOf(fl, r); });
    });
    world.tier = tierOf(world);
    delete world.stairSpecs;
    delete world.liftSpecs;
    return world;
  }

  function tierOf(world) {
    if (world.shell) { return "shell"; }
    var doc = 0, all = 0;
    world.floors.forEach(function (fl) {
      for (var q = 0; q < fl.n; q += 1) {
        if (fl.kind[q] !== FLOOR || fl.room[q] < 0) { continue; }
        var r = fl.rooms[fl.room[q]];
        if (r.pseudo) { continue; }
        all += 1;
        if (r.sure === "documented") { doc += 1; }
      }
    });
    return !all ? "shell" : doc / all >= 0.8 ? "documented" : "reconstructed";
  }

  // A museum's shell alone, from its model: what an interior file with no
  // floors compiles to.
  function shell(modelSpec, z0, opts) {
    var site = modelSpec && modelSpec.site ? max(modelSpec.site[0], modelSpec.site[1]) : 60;
    return compile({ slug: modelSpec && modelSpec.slug, v: 1,
                     grid: { cell: site > 300 ? 1 : site <= 40 ? 0.25 : 0.5, turn: 0 },
                     enter: z0 ? { z: z0 } : null, floors: null }, modelSpec, opts);
  }

  /* ---------------------------------------------------------------- the plan level */

  // The plan of a floor as dots in the model's own units, joined with the
  // model's dots so the two register: its floors, its walls up to the cut
  // with a paler cap, bare earth where inside the footprint nothing is
  // known, each hung work a few dots of its first colour, and you in the
  // pixel light. The model's dots are all kept — the roof comes off by
  // drawing it with `shown` easing from 1 down to dots.cut. pitch (metres)
  // is chosen to keep the whole under 40,000 dots where it is not given.
  // you: {x, y, a} in the grid, or null.
  function planDots(world, floorId, extDots, voxel, cutZ, pitch, you, hung) {
    var M = Models(), fl = floorOf(world, floorId);
    if (!fl) { return extDots; }
    var mv = voxel && typeof voxel === "object" ? voxel : world.model;
    var v = mv ? mv.v : (typeof voxel === "number" ? voxel : 1);
    var nx = mv ? mv.nx : 0, ny = mv ? mv.ny : 0, sx = mv ? mv.site[0] : 0, sy = mv ? mv.site[1] : 0;
    var cut = typeof cutZ === "number" ? cutZ : fl.z + 3;
    var ext = extDots || { x: [], y: [], z: [], size: [], ink: [], reveal: [], count: 0,
                           span: max(fl.gw, fl.gh) * fl.cell / v, lift: 1 };
    function X(gx, gy) { var m = toWorld(world, gx, gy); return [(m[0] + sx / 2) / v - nx / 2 - 0.5, (m[1] + sy / 2) / v - ny / 2 - 0.5]; }
    var budget = PLAN_DOTS - (ext.count || 0);
    var pitches = typeof pitch === "number" ? [pitch] : [0.5, 1, 2, 4];
    var dots = null;
    for (var pi = 0; pi < pitches.length; pi += 1) {
      dots = build(pitches[pi]);
      if (dots.count <= budget || pi === pitches.length - 1) { break; }
    }
    var joined = M.join(ext, dots);
    joined.cut = (cut / v) / (ext.lift || 1);
    joined.plan = { start: ext.count || 0, count: dots.count, pitch: dots.pitch, you: dots.you };
    return joined;

    function build(p) {
      var k = max(1, round(p / fl.cell)), size = 2 * (k * fl.cell) / v;
      var d = { x: [], y: [], z: [], size: [], ink: [], reveal: [], count: 0, pitch: k * fl.cell, you: null };
      var inkCache = {};
      function put(gx, gy, z, s, ink) {
        var u = X(gx, gy);
        d.x.push(u[0]); d.y.push(u[1]); d.z.push(z / v); d.size.push(s); d.ink.push(ink); d.reveal.push(0);
      }
      function ink(u, light) {
        var key = u + ":" + light;
        return inkCache[key] || (inkCache[key] = css(unpack(u), light));
      }
      for (var bj = 0; bj < fl.gh; bj += k) {
        for (var bi = 0; bi < fl.gw; bi += k) {
          // The block's cells: a floor, a wall beside a room, or earth.
          var floorQ = -1, wallQ = -1, earthQ = -1, ringQ = -1;
          for (var j = bj; j < min(fl.gh, bj + k); j += 1) {
            for (var i = bi; i < min(fl.gw, bi + k); i += 1) {
              var q = j * fl.gw + i, kd = fl.kind[q];
              if (kd === FLOOR || (kd === CLOSED && fl.room[q] >= 0)) { if (floorQ < 0) { floorQ = q; } }
              else if (kd === WALL || kd === GLASS) {
                if (besideRoom(fl, q)) { if (wallQ < 0) { wallQ = q; } }
                else if (fl.foot[q] === 1 || fl.foot[q] === 0) { if (earthQ < 0) { earthQ = q; } }
                else if (ringQ < 0) { ringQ = q; }
              }
            }
          }
          var cq = floorQ >= 0 ? floorQ : wallQ >= 0 ? wallQ : earthQ;
          if (cq < 0) { continue; }
          var c = centreOf(fl, cq);
          var gx = fl.x0 + (bi + k / 2) * fl.cell, gy = fl.y0 + (bj + k / 2) * fl.cell;
          if (floorQ >= 0 && fl.room[floorQ] >= 0 && fl.rooms[fl.room[floorQ]].pseudo !== "outside") {
            put(gx, gy, fl.fh[floorQ] / 100, size, ink(fl.inkF[floorQ], 0.9));
          }
          if (wallQ >= 0) {
            var z0 = fl.z;
            for (var z = z0 + p; z < cut - 1e-6; z += p) { put(c[0], c[1], z, size, ink(fl.inkW[wallQ], 0.84)); }
            put(c[0], c[1], cut, size, ink(fl.inkW[wallQ], 1.12));
          } else if (earthQ >= 0 && floorQ < 0) {
            put(gx, gy, cut, size, ink(fl.inkF[earthQ], 0.7));
          }
        }
      }
      // The hung works, a few dots each of their first colour.
      (hung || []).forEach(function (h) {
        if (h.floor !== fl.index) { return; }
        var c0 = hexRgb(h.work && h.work.c && h.work.c[0]) || [200, 200, 200];
        var n = max(1, round(h.w / (p / 2)));
        for (var t = 0; t <= n; t += 1) {
          var px = h.x0 + (h.x1 - h.x0) * t / n, py = h.y0 + (h.y1 - h.y0) * t / n;
          put(px, py, min(cut, (h.z0 + h.z1) / 2), size, css(c0, 1));
        }
      });
      if (you) {
        var start = d.x.length;
        put(you.x, you.y, fl.z + 0.2, size * 1.6, css(LIGHT, 1.1));
        put(you.x + cos(you.a || 0) * p, you.y + sin(you.a || 0) * p, fl.z + 0.2, size, css(LIGHT, 1.3));
        d.you = [start, 2];
      }
      d.count = d.x.length;
      return d;
    }
  }

  function besideRoom(fl, q) {
    var i = q % fl.gw;
    var ns = [q - fl.gw, q + fl.gw];
    if (i > 0) { ns.push(q - 1); }
    if (i < fl.gw - 1) { ns.push(q + 1); }
    for (var k = 0; k < ns.length; k += 1) {
      var p = ns[k];
      if (p >= 0 && p < fl.n && fl.room[p] >= 0 && fl.rooms[fl.room[p]].pseudo !== "outside" &&
          fl.kind[p] !== WALL) { return true; }
    }
    return false;
  }

  /* ---------------------------------------------------------------- the check */

  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var SURE = { documented: 1, reconstructed: 1 };

  function days(a, b) { return round((Date.parse(b) - Date.parse(a)) / 86400000); }

  // Everything the authoring rules ask of an interior file, against its
  // model, its museum (museums.json's entry) and its ground. opts: {bytes,
  // today: 'YYYY-MM-DD'}. Returns {errors, warnings, stats, tier, findings,
  // world, hung}: errors refuse the file; findings are for the model's log.
  function check(interior, modelSpec, museum, ground, opts) {
    opts = opts || {};
    var E = [], Wn = [], findings = [];
    var today = opts.today || new Date().toISOString().slice(0, 10);
    var I = interior || {};
    function err(t) { E.push(t); }
    function warn(t) { Wn.push(t); }
    var M;
    try { M = Models(); } catch (e) { return { errors: [String(e.message)], warnings: [], stats: {}, tier: "shell", findings: [] }; }

    // The file's own shape.
    if (typeof opts.bytes === "number" && opts.bytes > 96 * 1024) { err("the file is " + round(opts.bytes / 1024) + " KB (at most 96)"); }
    if (I.v !== 1) { err("v must be 1"); }
    if (typeof I.slug !== "string") { err("slug is missing"); }
    if (museum && museum.slug && I.slug !== museum.slug) { err("slug " + I.slug + " is not its museum's (" + museum.slug + ")"); }
    if (!museum) { warn("no museum in museums.json has this slug: the walk is only for the Museums layer's museums"); }
    var grid = I.grid || {};
    if ([0.25, 0.5, 1].indexOf(grid.cell) < 0) { err("grid.cell must be 0.25, 0.5 or 1"); }
    if (typeof grid.turn !== "number" || abs(grid.turn) > 90) { err("grid.turn must be a number of degrees, -90 to 90"); }
    var src = {};
    if (!Array.isArray(I.sources)) { err("sources must be a list"); }
    (I.sources || []).forEach(function (s, n) {
      if (!s || typeof s.id !== "string") { err("source " + n + " has no id"); return; }
      if (src[s.id]) { err("source " + s.id + " is listed twice"); }
      src[s.id] = s;
      if (typeof s.t !== "string" || !s.t) { err("source " + s.id + " has no t"); }
      if (s.read !== null && !(typeof s.read === "string" && DATE.test(s.read))) { err("source " + s.id + ": read must be a date or null"); }
      if (s.read && days(s.read, today) > 180) { warn("source " + s.id + " was read " + days(s.read, today) + " days ago"); }
    });
    function cites(list, what, required) {
      if (list === undefined || list === null) {
        if (required) { err(what + " has no src"); }
        return;
      }
      if (!Array.isArray(list)) { err(what + ": src must be a list of source ids"); return; }
      if (required && !list.length) { err(what + " has no src"); }
      list.forEach(function (id) {
        if (!src[id]) { err(what + " cites " + id + ", which is not in sources"); }
        else if (!src[id].read) { err(what + " cites " + id + ", which has not been read yet"); }
      });
    }
    function sure(v, what) { if (!SURE[v]) { err(what + ": sure must be documented or reconstructed, not " + v); } }
    function pair(p) { return Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number"; }
    function rect(a, what, n) {
      n = n || 4;
      if (!Array.isArray(a) || a.length !== n || a.some(function (x) { return typeof x !== "number"; })) { err(what + " must be " + n + " numbers"); return false; }
      if (!(a[2] > 0) || !(a[3] > 0)) { err(what + ": its w and d must be more than 0"); return false; }
      return true;
    }
    var ids = {};
    function uniq(id, what) {
      if (typeof id !== "string" || !id) { err(what + " has no id"); return; }
      if (ids[id]) { err(what + ": id " + id + " is used twice"); }
      ids[id] = 1;
    }
    function material(m, what) { if (m !== null && m !== undefined && !M.MATERIALS[m]) { err(what + ": " + m + " is not a material"); } }

    if (I.from && typeof I.from === "object") {
      Object.keys(I.from).forEach(function (k) {
        var t = I.from[k];
        if (!src[k]) { err("from." + k + " is not a source"); }
        if (!t || !pair(t.px) || !(t.m > 0)) { err("from." + k + " needs px [x, y] and m > 0"); }
      });
    }
    var floorIds = {};
    var floors = I.floors;
    if (floors !== null && floors !== undefined && !Array.isArray(floors)) { err("floors must be a list or null"); floors = null; }
    (floors || []).forEach(function (fs, fn) {
      var fw = "floor " + (fs && fs.id || fn);
      if (!fs || typeof fs.id !== "string") { err("floor " + fn + " has no id"); return; }
      if (floorIds[fs.id]) { err(fw + " is listed twice"); }
      floorIds[fs.id] = fs;
      if (typeof fs.z !== "number") { err(fw + ": z must be a number"); }
      sure(fs.sure, fw);
      cites(fs.src, fw, true);
      var rc = 0;
      (fs.rooms || []).forEach(function (r, rn) {
        var rw = "room " + (r && r.id || rn) + " (" + fs.id + ")";
        if (!r) { err(rw + " is empty"); return; }
        uniq(r.id, rw);
        rc += 1;
        if (!KINDS[r.kind]) { err(rw + ": kind " + r.kind + " is not one of gallery, hall, court, rotunda, lobby, stair, shop, cafe, void, closed"); }
        var shapes = ["rect", "poly", "circle"].filter(function (k) { return r[k] !== undefined && r[k] !== null; });
        if (shapes.length !== 1) { err(rw + " must have exactly one of rect, poly, circle"); }
        if (r.rect) { rect(r.rect, rw + " rect"); }
        if (r.circle && (!Array.isArray(r.circle) || r.circle.length !== 3 || !(r.circle[2] > 0))) { err(rw + ": circle must be [cx, cy, r] with r > 0"); }
        if (r.poly) {
          if (!Array.isArray(r.poly) || r.poly.length < 3 || !r.poly.every(pair)) { err(rw + ": poly needs at least three [x, y] points"); }
          else if (selfCrossing(r.poly)) { err(rw + ": its poly crosses itself"); }
        }
        if (r.ref !== undefined && !Array.isArray(r.ref)) { err(rw + ": ref must be a list"); }
        sure(r.sure, rw);
        cites(r.src, rw, true);
        if (r.name !== null && r.name !== undefined && typeof r.name !== "string") { err(rw + ": name must be words or null"); }
        if (r.ceil !== undefined && r.ceil !== "auto" && CEIL[r.ceil] === undefined) { err(rw + ": ceil " + r.ceil + " is not one of flat, skylight, sky, dome, vault, dark, auto"); }
        if (r.h !== null && r.h !== undefined) {
          if (!(r.h > 0)) { err(rw + ": h must be metres or null"); }
          sure(r.hsure, rw + " h");
          cites(r.hsrc, rw + " h", true);
        }
        var mats = ["floor", "walls", "top"].filter(function (k) { return r[k] !== null && r[k] !== undefined; });
        mats.forEach(function (k) { material(r[k], rw + " " + k); });
        if (mats.length) { sure(r.msure, rw + " materials"); cites(r.msrc, rw + " materials", true); }
        if (r.oculus !== undefined && r.oculus !== null && !(r.oculus >= 0)) { err(rw + ": oculus must be metres"); }
      });
      if (rc > 400) { err(fw + " has " + rc + " rooms (at most 400)"); }
      (fs.open || []).forEach(function (o, on) {
        var ow = "opening " + (o && o.a) + " — " + (o && o.b) + " (" + fs.id + ")";
        if (!o || !o.a || !o.b) { err("opening " + on + " on " + fs.id + " is missing a or b"); return; }
        if (!o.at && !o.cut) { err(ow + " needs at or cut"); }
        if (o.at && !pair(o.at)) { err(ow + ": at must be [x, y]"); }
        if (o.cut) { rect(o.cut, ow + " cut"); }
        if (o.w !== undefined && o.w !== null && !(o.w > 0)) { err(ow + ": w must be metres"); }
        if (o.kind && o.kind !== "door" && o.kind !== "arch") { err(ow + ": kind must be door or arch"); }
        sure(o.sure, ow);
        cites(o.src, ow, true);
      });
      (fs.things || []).forEach(function (t, tn) {
        var tw = "thing " + tn + " (" + fs.id + ")";
        if (!t || !Array.isArray(t.box) || t.box.length !== 5) { err(tw + ": box must be [x, y, w, d, h]"); return; }
        rect(t.box, tw + " box", 5);
        material(t.m, tw);
        sure(t.sure, tw);
        cites(t.src, tw, true);
      });
      (fs.stairs || []).forEach(function (st) {
        var sw = "stair " + (st && st.id);
        if (!st) { return; }
        if (!ids[st.id]) { uniq(st.id, sw); }
        rect(st.rect, sw + " rect");
        if (!/^[+-][xy]$/.test(st.rise || "")) { err(sw + ": rise must be +x, -x, +y or -y"); }
        sure(st.sure, sw);
        cites(st.src, sw, true);
      });
      (fs.lifts || []).forEach(function (lf) {
        var lw = "lift " + (lf && lf.id);
        if (!lf) { return; }
        if (!ids[lf.id]) { uniq(lf.id, lw); }
        rect(lf.rect, lw + " rect");
        if (!Array.isArray(lf.floors) || lf.floors.length < 2) { err(lw + " must name at least two floors"); }
        sure(lf.sure, lw);
        cites(lf.src, lw, true);
      });
    });
    (floors || []).forEach(function (fs) {
      (fs.stairs || []).forEach(function (st) {
        if (st && (!floorIds[st.from] || !floorIds[st.to])) { err("stair " + st.id + " joins a floor that is not in the file"); }
      });
      (fs.lifts || []).forEach(function (lf) {
        (lf && lf.floors || []).forEach(function (id) { if (!floorIds[id]) { err("lift " + lf.id + " names floor " + id + ", which is not in the file"); } });
      });
    });
    var e = I.enter;
    if (e !== null && e !== undefined) {
      if (floors && floors.length && !floorIds[e.floor]) { err("the entrance is not on a floor of the file"); }
      if (!pair(e.door)) { err("enter.door must be [x, y]"); }
      if (e.at && !pair(e.at)) { err("enter.at must be [x, y]"); }
      (e.out || []).forEach(function (r, n) { rect(r, "enter.out " + n); });
      sure(e.sure, "the entrance");
      cites(e.src, "the entrance", true);
    } else if (floors && floors.length) {
      err("a file with floors needs its entrance (enter)");
    }
    var pins = I.pins || {};
    Object.keys(pins).forEach(function (id) {
      var p = pins[id], pw = "pin " + id;
      if (!p) { return; }
      if (p.wall && !DIRS[p.wall] && p.wall !== "centre") { err(pw + ": wall must be n, e, s, w or centre"); }
      if (p.at !== undefined && !(p.at >= 0 && p.at <= 1)) { err(pw + ": at must be 0 to 1"); }
      sure(p.sure, pw);
      cites(p.src, pw, true);
    });
    var HOW = { museum: 1, elsewhere: 1, off: 1, none: 1 };
    var counts = { museum: 0, elsewhere: 0, off: 0, none: 0 }, oldWorks = 0, workIds = {};
    if (!Array.isArray(I.works)) { err("works must be a list"); }
    (I.works || []).forEach(function (w, n) {
      var ww = "work " + (w && w.id || n);
      if (!w || typeof w.id !== "string") { err("work " + n + " has no id"); return; }
      if (workIds[w.id]) { err(ww + " is listed twice"); }
      workIds[w.id] = 1;
      if (!HOW[w.how]) { err(ww + ": how must be museum, elsewhere, off or none"); return; }
      counts[w.how] += 1;
      if (typeof w.said !== "string") { err(ww + ": said must be the source's own words"); }
      if (w.src !== null && w.src !== undefined) {
        if (!src[w.src]) { err(ww + " cites " + w.src + ", which is not in sources"); }
        else if (!src[w.src].read && w.how !== "none") { err(ww + " cites " + w.src + ", which has not been read yet"); }
      } else if (w.how === "museum" || w.how === "elsewhere" || w.how === "off") { err(ww + ": a placement needs its src"); }
      if (w.wall !== undefined && w.wall !== null && !DIRS[w.wall] && w.wall !== "centre") { err(ww + ": wall must be n, e, s, w, centre or null"); }
      if (w.asof && days(w.asof, today) > 30) { oldWorks += 1; }
    });
    if (oldWorks) { warn(oldWorks + " works were placed more than 30 days ago: run build_interiors.py"); }
    if (museum && museum.works) {
      var missing = museum.works.filter(function (w) { return !workIds[w.id]; }).length;
      if (missing) { warn(missing + " of its saved works in museums.json are not in the file: run build_interiors.py"); }
    }
    if (I.tier !== undefined && ["documented", "reconstructed", "shell"].indexOf(I.tier) < 0) { err("tier must be documented, reconstructed or shell"); }

    // Compiled, as the walk will have it.
    var world = null, hung = { hung: [], spill: [] };
    try {
      world = compile(I, modelSpec, { soil: null });
    } catch (x) {
      err("it does not compile: " + (x && x.message || x));
    }
    var stats = { tier: "shell", floors: [], works: counts, hung: 0, spill: 0, reached: 0 };
    if (!world) { return { errors: E, warnings: Wn, stats: stats, tier: "shell", findings: findings, world: null, hung: hung }; }
    if (!world.vox) { err("its model has no parts"); }
    world.problems.forEach(function (p) { err(p.text); });
    world.floors.forEach(function (fl) {
      if (fl.n > 400000) { err("floor " + fl.id + " is " + fl.n + " cells (at most 400,000): use a coarser grid"); }
    });
    // Overlaps, by the cells both would claim.
    world.overlaps.forEach(function (o) {
      var fl = world.floors[o.floor], a = fl.rooms[o.a], b = fl.rooms[o.b];
      var small = min(a.area, b.area) / (fl.cell * fl.cell);
      if (o.cells > 0.05 * small) {
        err("rooms " + a.id + " and " + b.id + " overlap by " + round(100 * o.cells / small) + "% of the smaller");
      }
    });
    // Each room against the model's footprint at its floor, a voxel's slack.
    var vx = world.vox;
    world.floors.forEach(function (fl) {
      if (!vx || world.shell) { return; }
      var reach = ceil(vx.v / fl.cell), near = dilate(fl, reach);
      fl.rooms.forEach(function (r) {
        if (r.pseudo) { return; }
        var n = 0, out = 0, bb = [Infinity, Infinity, -Infinity, -Infinity];
        for (var q = 0; q < fl.n; q += 1) {
          if (fl.room[q] !== r.index) { continue; }
          n += 1;
          if (!near[q]) {
            out += 1;
            var c = centreOf(fl, q), m = toWorld(world, c[0], c[1]);
            bb[0] = min(bb[0], m[0]); bb[1] = min(bb[1], m[1]); bb[2] = max(bb[2], m[0]); bb[3] = max(bb[3], m[1]);
          }
        }
        r.cells = n;
        if (!n) { err("room " + r.id + " has no cells: it is smaller than the grid's cell"); return; }
        if (out / n <= 0.1) { return; }
        var ext = "x " + bb[0].toFixed(1) + " to " + bb[2].toFixed(1) + ", y " + bb[1].toFixed(1) + " to " + bb[3].toFixed(1);
        if (r.sure === "reconstructed") {
          err("reconstructed room " + r.id + " is " + round(100 * out / n) + "% outside the model at " + (fl.z + EYE).toFixed(1) + " m (" + ext + ")");
        } else {
          warn("documented room " + r.id + " is " + round(100 * out / n) + "% outside the model (" + ext + ")");
          findings.push({ room: r.id, floor: fl.id, out: out / n, x0: bb[0], y0: bb[1], x1: bb[2], y1: bb[3] });
        }
      });
      // A ceiling above the model's roof.
      fl.rooms.forEach(function (r) {
        if (r.pseudo || r.h === null) { return; }
        var top = -Infinity;
        for (var q = 0; q < fl.n; q += 7) {
          if (fl.room[q] !== r.index) { continue; }
          var c = centreOf(fl, q), m = toWorld(world, c[0], c[1]), col = columnAt(vx, m[0], m[1]);
          if (col >= 0 && vx.top[col] >= 0) { top = max(top, (vx.top[col] + 1) * vx.v); }
        }
        if (isFinite(top) && fl.z + r.fz + r.h > top + vx.v) {
          warn("room " + r.id + "'s ceiling (" + (fl.z + r.fz + r.h).toFixed(1) + " m) is above the model's roof (" + top.toFixed(1) + " m)");
        }
      });
    });
    // Stairs: their ends at their floors.
    world.stairs.forEach(function (st) {
      if (st.from === undefined || st.to === undefined) { return; }
      var lowFl = world.floors[world.floors[st.from].z <= world.floors[st.to].z ? st.from : st.to];
      var highFl = lowFl === world.floors[st.from] ? world.floors[st.to] : world.floors[st.from];
      if (!endMeets(highFl, st, true)) { err("stair " + st.id + ": its top does not meet the " + (highFl.name || highFl.id) + " at " + highFl.z + " m"); }
      if (!endMeets(lowFl, st, false)) { err("stair " + st.id + ": its foot does not meet the " + (lowFl.name || lowFl.id) + " at " + lowFl.z + " m"); }
    });
    // The entrance, and what can be reached from it.
    if (world.enter) {
      var start = world.floors[world.enter.floor];
      var q0 = cellAt(start, world.enter.x, world.enter.y), qd = cellAt(start, world.enter.door[0], world.enter.door[1]);
      if (!walkable(start, q0) && !walkable(start, qd)) { err("the entrance's at and door are not on ground that can be walked"); }
      var reached = [], unreached = [];
      world.floors.forEach(function (fl) {
        fl.rooms.forEach(function (r) {
          if (r.pseudo) { return; }
          (r.reach ? reached : unreached).push(r.id);
        });
      });
      stats.reached = reached.length;
      if (!reached.length && !world.shell) { err("no room can be reached from the entrance"); }
      if (world.shell) {
        var sh = world.floors[0].rooms[0];
        if (!sh.reach) { err("the shell cannot be entered from its door"); }
      }
      if (unreached.length) { warn(unreached.length + " rooms have no way in known yet: " + unreached.join(", ")); }
    }
    // The works.
    try {
      hung = hang(world, I.works, pins);
    } catch (x) {
      err("its works could not be hung: " + (x && x.message || x));
    }
    (I.works || []).forEach(function (w) {
      if (!w || w.how !== "museum") { return; }
      var r = w.room ? roomById(world, w.room) : null;
      if (!r) { err("work " + w.id + ": its room " + w.room + " is not drawn"); return; }
      var dir = (pins[w.id] && pins[w.id].wall) || w.wall;
      if (dir && dir !== "centre" && !compass(r, dir, world).length) { err("work " + w.id + ": room " + r.id + " has no " + dir + " wall"); }
      if (!dir && !r.walls.length) { err("work " + w.id + ": room " + r.id + " has no wall to hang on"); }
    });
    var tiers = {};
    hung.hung.forEach(function (h) {
      if (h.tier > 1) { var r = world.floors[h.floor].rooms[h.room]; tiers[r.id + " " + (h.wall || "")] = 1; }
    });
    Object.keys(tiers).forEach(function (k) { warn("works on " + k + " overflow into a second tier"); });
    if (hung.spill.length) { warn(hung.spill.length + " placed works found no wall to hang on: " + hung.spill.join(", ")); }
    var elsewhere = {};
    (I.works || []).forEach(function (w) { if (w && w.how === "elsewhere") { elsewhere[w.said] = (elsewhere[w.said] || 0) + 1; } });
    var ek = Object.keys(elsewhere);
    if (ek.length) { warn("placed in rooms not drawn here: " + ek.map(function (k) { return k + " (" + elsewhere[k] + ")"; }).join("; ")); }
    // The model's footprint against the ground's buildings.
    if (vx && ground && ground.n && ground.kind) {
      var half = ground.side / 2, gc = ground.side / ground.n, z = (world.floors[world.enter ? world.enter.floor : 0] || { z: 0 }).z + EYE;
      var k = floor(z / vx.v), tot = 0, onB = 0;
      if (k >= 0 && k < vx.nz) {
        for (var j = 0; j < vx.ny; j += 1) {
          for (var i = 0; i < vx.nx; i += 1) {
            var mm = vx.grid[k * vx.nx * vx.ny + j * vx.nx + i];
            if (!mm || !vx.built[mm - 1]) { continue; }
            var x = (i + 0.5) * vx.v - vx.site[0] / 2, y = (j + 0.5) * vx.v - vx.site[1] / 2;
            var gi = floor((y + half) / gc), gj = floor((x + half) / gc);
            tot += 1;
            if (gi >= 0 && gj >= 0 && gi < ground.n && gj < ground.n && ground.kind.charAt(gi * ground.n + gj) === "b") { onB += 1; }
          }
        }
      }
      stats.ground = tot ? onB / tot : null;
      if (tot && onB / tot < 0.8) {
        warn("only " + round(100 * onB / tot) + "% of the model's footprint stands on the ground's buildings");
        findings.push({ ground: onB / tot });
      }
    }
    // What was drawn, floor by floor.
    world.floors.forEach(function (fl) {
      var doc = 0, rec = 0, rooms = 0, reach = 0;
      fl.rooms.forEach(function (r) { if (!r.pseudo) { rooms += 1; if (r.reach) { reach += 1; } } });
      for (var q = 0; q < fl.n; q += 1) {
        if (fl.kind[q] !== FLOOR || fl.room[q] < 0) { continue; }
        var r = fl.rooms[fl.room[q]];
        if (r.pseudo) { continue; }
        if (r.sure === "documented") { doc += 1; } else { rec += 1; }
      }
      var a = fl.cell * fl.cell;
      stats.floors.push({ id: fl.id, name: fl.name, z: fl.z, cells: fl.n, rooms: rooms, reached: reach,
                          documented: round(doc * a), reconstructed: round(rec * a) });
    });
    stats.hung = hung.hung.length;
    stats.spill = hung.spill.length;
    stats.tier = world.tier;
    return { errors: E, warnings: Wn, stats: stats, tier: world.tier, findings: findings, world: world, hung: hung };
  }

  // Whether a stair's end meets its floor: the cells just past its top (or
  // foot) are walked at that floor's height, within a riser.
  function endMeets(fl, st, top) {
    var r = st.rect, axis = st.rise.charAt(1), up = st.rise.charAt(0) === "-" ? -1 : 1;
    var toHigh = top ? up : -up, cell = fl.cell, hits = 0, good = 0;
    for (var s = cell / 2; s < (axis === "x" ? r[3] - r[1] : r[2] - r[0]); s += cell) {
      var x, y;
      if (axis === "x") { x = toHigh > 0 ? r[2] + cell / 2 : r[0] - cell / 2; y = r[1] + s; }
      else { y = toHigh > 0 ? r[3] + cell / 2 : r[1] - cell / 2; x = r[0] + s; }
      var q = cellAt(fl, x, y);
      if (q < 0) { continue; }
      hits += 1;
      if (walkable(fl, q) && fl.stair[q] < 0 && abs(fl.fh[q] / 100 - fl.z) <= RISER + 0.01) { good += 1; }
    }
    return hits > 0 && good > 0;
  }

  // The cells within a few of the model's footprint.
  function dilate(fl, r) {
    var gw = fl.gw, gh = fl.gh, a = new Uint8Array(fl.n), b = new Uint8Array(fl.n), q, i, j;
    for (q = 0; q < fl.n; q += 1) { a[q] = fl.foot[q] ? 1 : 0; }
    for (j = 0; j < gh; j += 1) {
      var run = -1e9;
      for (i = 0; i < gw; i += 1) { if (a[j * gw + i]) { run = i; } if (i - run <= r) { b[j * gw + i] = 1; } }
      run = 1e9;
      for (i = gw - 1; i >= 0; i -= 1) { if (a[j * gw + i]) { run = i; } if (run - i <= r) { b[j * gw + i] = 1; } }
    }
    var c = new Uint8Array(fl.n);
    for (i = 0; i < gw; i += 1) {
      var run2 = -1e9;
      for (j = 0; j < gh; j += 1) { if (b[j * gw + i]) { run2 = j; } if (j - run2 <= r) { c[j * gw + i] = 1; } }
      run2 = 1e9;
      for (j = gh - 1; j >= 0; j -= 1) { if (b[j * gw + i]) { run2 = j; } if (run2 - j <= r) { c[j * gw + i] = 1; } }
    }
    return c;
  }

  return {
    // what a cell is, and what is over it
    WALL: WALL, FLOOR: FLOOR, CLOSED: CLOSED, GLASS: GLASS,
    FLAT: FLAT, SKYLIGHT: SKYLIGHT, SKY: SKY, DOME: DOME, VAULT: VAULT, DARK: DARK, OPEN: OPEN,
    // the rules the walk shares
    RULES: { EYE: EYE, CLEAR: CLEAR, STEP: STEP, HEAD: HEAD, RISER: RISER, THICK: THICK, HANG: HANG,
             TALL: TALL, APART: APART, INTO: INTO, FREE_OUT: FREE_OUT, VIEW: VIEW, VIEW_K: VIEW_K,
             DOOR_W: DOOR_W, DOOR_H: DOOR_H, PLAN_DOTS: PLAN_DOTS },
    compile: compile, toGrid: toGrid, toWorld: toWorld, headingOf: headingOf, compassOf: compassOf,
    shape: shape, raster: raster, seal: seal, carve: carve, ramp: ramp, ceilings: ceilings, shell: shell,
    runs: runs, compass: compass, dims: dims, hang: hang, clearance: clearance, path: path, stand: stand,
    planDots: planDots, check: check,
    // helpers the walk and the checker use
    cellAt: cellAt, centreOf: centreOf, walkable: walkable, floorOf: floorOf, roomById: roomById,
    inRoom: inRoom, skyOf: skyOf, standsFree: standsFree, unpack: unpack, pack: pack
  };
}));

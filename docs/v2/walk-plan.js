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
  // An arranged room (INTERIORS.md, "Arranged"): the site's, not the museum's.
  // Its works hang one to every 2.5 m of a run of wall, never closer.
  var ARR_SPACE = 2.5;
  // A work the site hangs beside the museum's own (INTERIORS.md, "Beside the known"): one to every
  // 2.5 m of what wall the museum's leave, or every 1.5 m where that would not take them all.
  var ARR_TIGHT = 1.5;
  // The rules a work hung beside the museum's own says it was hung by.
  var BESIDE_BY = { artist: 1, "period-kind": 1, near: 1, period: 1, kind: 1, order: 1 };
  // An arranged room's name is a number or what it is, never a museum's own gallery name.
  var ARR_NAME = /^(Room \d+|Hall|Entrance)$/;
  var SIDES = 24;                // a round room's sides
  var UNSURE = 0.25;             // how much more soil shows through a reconstructed surface
  var DOOR_W = 2.4, DOOR_H = 3.0;// the stated rule for an opening's size, where none is given
  var OUT_W = 6, OUT_D = 4;      // a shell's ground outside its door
  var PLAN_DOTS = 40000;         // the plan level's dots, with its building's, at most
  var SOIL = [138, 118, 96, 2];  // DIRT, where none is given
  var DARK_INK = [15, 12, 10];   // the dark of the frame, where none is given
  var LIGHT = [94, 82, 199];     // the pixel light's lavender (land.js's LIGHT)
  var PALE = [239, 233, 226];    // the soil gone to stone (land.js's PALE)
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

  /* ---------------------------------------------------------------- colours */

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

  var MATS = null;               // Models.MATERIALS, kept while compiling

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
  function modelOf(spec, mats) {
    if (!spec || !spec.parts) { return null; }
    var M = Models(), vx = M.voxelize(spec);
    mats = mats || M.MATERIALS;
    var n = vx.nx * vx.ny, top = new Int16Array(n).fill(-1), glassTop = new Uint8Array(n);
    var built = vx.names.map(function (name) { return !GROWN[name]; });
    var glass = vx.names.map(function (name) { return !!(mats[name] && mats[name].glass); });
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
    var i = col % vx.nx, j = (col - i) / vx.nx, base = floor(z / vx.v) * vx.nx * vx.ny, g = vx.grid, m;
    if (i < 1 || j < 1 || i >= vx.nx - 1 || j >= vx.ny - 1) { return false; }
    return !!((m = g[base + col - 1]) && vx.built[m - 1]) && !!((m = g[base + col + 1]) && vx.built[m - 1]) &&
           !!((m = g[base + col - vx.nx]) && vx.built[m - 1]) && !!((m = g[base + col + vx.nx]) && vx.built[m - 1]);
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
  // The cells whose centres are in a rect of the grid ([x0, y0, x1, y1],
  // first sides in, last sides out), each given to fn(q, x, y).
  function forRect(fl, r, fn) {
    var i0 = max(0, floor((r[0] - fl.x0) / fl.cell) - 1), i1 = min(fl.gw - 1, ceil((r[2] - fl.x0) / fl.cell));
    var j0 = max(0, floor((r[1] - fl.y0) / fl.cell) - 1), j1 = min(fl.gh - 1, ceil((r[3] - fl.y0) / fl.cell));
    for (var j = j0; j <= j1; j += 1) {
      var y = fl.y0 + (j + 0.5) * fl.cell;
      if (y < r[1] || y >= r[3]) { continue; }
      for (var i = i0; i <= i1; i += 1) {
        var x = fl.x0 + (i + 0.5) * fl.cell;
        if (x < r[0] || x >= r[2]) { continue; }
        fn(j * fl.gw + i, x, y);
      }
    }
  }
  // The model's voxel column under each cell, worked out once a floor.
  function columnsOf(world, fl) {
    if (fl.col) { return fl.col; }
    var vx = world.vox, col = new Int32Array(fl.n).fill(-1);
    if (vx) {
      var c = world.cos, s = world.sin, hx = vx.site[0] / 2, hy = vx.site[1] / 2, v = vx.v;
      for (var j = 0; j < fl.gh; j += 1) {
        var gy = fl.y0 + (j + 0.5) * fl.cell;
        for (var i = 0; i < fl.gw; i += 1) {
          var gx = fl.x0 + (i + 0.5) * fl.cell;
          var vi = floor((gx * c - gy * s + hx) / v), vj = floor((gx * s + gy * c + hy) / v);
          col[j * fl.gw + i] = vi < 0 || vj < 0 || vi >= vx.nx || vj >= vx.ny ? -1 : vj * vx.nx + vi;
        }
      }
    }
    fl.col = col;
    return col;
  }
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
    // Two parts of one space the source names as one (its North Lobby, by
    // the stairs and by the door): no wall between them at all.
    if (d.kind === "part") {
      var gw = fl.gw, px = 0, py = 0;
      for (var qp = 0; qp < fl.n; qp += 1) {
        if (fl.kind[qp] !== WALL || fl.room[qp] >= 0) { continue; }
        var ip = qp % gw, pair = null;
        if (ip > 0 && ip < gw - 1) { pair = [fl.room[qp - 1], fl.room[qp + 1]]; }
        var vert = qp >= gw && qp < fl.n - gw ? [fl.room[qp - gw], fl.room[qp + gw]] : null;
        [pair, vert].forEach(function (pr) {
          if (!pr || fl.kind[qp] !== WALL) { return; }
          if ((pr[0] === d.a && pr[1] === d.b) || (pr[0] === d.b && pr[1] === d.a)) {
            carved.push(qp);
            var c0 = centreOf(fl, qp);
            px += c0[0]; py += c0[1];
            open(qp, pr[0]);
          }
        });
      }
      if (!carved.length) { return { ok: false, why: "no wall between its rooms" }; }
      d.x = px / carved.length; d.y = py / carved.length;
      var pa = fl.rooms[d.a], pb = fl.rooms[d.b], pl = hypot(pb.cx - pa.cx, pb.cy - pa.cy) || 1;
      d.ax = (pb.cx - pa.cx) / pl; d.ay = (pb.cy - pa.cy) / pl;
      return { ok: true, thick: cell, cells: carved.length };
    }
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
      forRect(fl, c, function (q) {
        if (fl.kind[q] === WALL || fl.kind[q] === GLASS) { carved.push(q); }
      });
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
    var span = max(half, best.s1 - best.s0) + cell * 1.5;
    var gi0 = floor((d.x - span - fl.x0) / cell), gi1 = ceil((d.x + span - fl.x0) / cell);
    var gj0 = floor((d.y - span - fl.y0) / cell), gj1 = ceil((d.y + span - fl.y0) / cell);
    var cand = [];
    for (var gj = max(0, gj0); gj <= min(fl.gh - 1, gj1); gj += 1) {
      for (var gi = max(0, gi0); gi <= min(fl.gw - 1, gi1); gi += 1) {
        var qq = gj * fl.gw + gi;
        if (fl.kind[qq] !== WALL && fl.kind[qq] !== GLASS) { continue; }
        var px = fl.x0 + (gi + 0.5) * cell - d.x, py = fl.y0 + (gj + 0.5) * cell - d.y;
        var along = px * ux + py * uy, across = -px * uy + py * ux;
        if (along <= best.s0 || along >= best.s1) { continue; }
        cand.push([qq, along, across]);
      }
    }
    // A doorway a walker can pass: at least as many cells across as a
    // walker's width needs (a 0.9 m door whose middle falls on a cell's
    // centre would be one cell of 0.5 m); where it would be fewer, the
    // cells are taken half a cell to one side, never more of them.
    var need = floor(2 * CLEAR / cell + 1e-9) + 1, shift = 0;
    function across_(sh) {
      var seen = {};
      cand.forEach(function (c) { if (abs(c[2] - sh) <= half + 1e-9) { seen[round(c[2] / cell * 2)] = 1; } });
      return Object.keys(seen).length;
    }
    if (across_(0) < need && across_(cell / 2) > across_(0)) { shift = cell / 2; }
    cand.forEach(function (c) {
      if (abs(c[2] - shift) > half + 1e-9) { return; }
      carved.push(c[0]);
      open(c[0], c[1] < mid ? d.a : d.b);
    });
    if (!carved.length) { return { ok: false, why: "nothing to carve" }; }
    d.ax = ux; d.ay = uy;
    d.x += ux * mid - uy * shift; d.y += uy * mid + ux * shift;
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
  // rising the way it says, its top flush with the upper floor. Takes
  // (world, stair) or (stair, world or its floors); the stair's rect is in
  // the grid and from and to are floor indices. Returns {ok, why}.
  function ramp(world, st) {
    if (world && world.rect && st) { var sw = world; world = st; st = sw; }
    if (Array.isArray(world)) { world = { floors: world, cell: world[0] ? world[0].cell : 0.5 }; }
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
      forRect(fl, r, function (q, x, y) {
        over(st, fl, q);
        var t = (axis === "x" ? x - r[0] : y - r[1]) / run;
        if (up < 0) { t = 1 - t; }
        var k = min(n - 1, max(0, floor(t * n)));
        fl.kind[q] = FLOOR;
        fl.room[q] = ri;
        fl.fh[q] = cm(lo + (k + 1) * dz / n);
        fl.stair[q] = st.index;
      });
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
      forRect(fl, r, function (q) {
        over(lf, fl, q);
        fl.kind[q] = FLOOR; fl.room[q] = ri; fl.fh[q] = cm(fl.z); fl.lift[q] = lf.index;
      });
    });
  }

  // What a stair or a lift is laid over, before it is: a stair across a
  // wall, or reaching into two rooms, would join rooms no source connects.
  function over(t, fl, q) {
    var o = t.over = t.over || { wall: 0, rooms: {} };
    var k = fl.kind[q], r = fl.room[q];
    if (k === WALL || k === GLASS || (k === CLOSED && (r < 0 || !fl.rooms[r].pseudo))) { o.wall += 1; }
    if (r >= 0 && !fl.rooms[r].pseudo) { (o.rooms[fl.index] = o.rooms[fl.index] || {})[fl.rooms[r].id] = 1; }
  }
  function overProblems(world, t, what) {
    var o = t.over;
    if (!o) { return; }
    if (o.wall) {
      world.problems.push({ rule: what, text: what + " " + t.id + " is laid over " + o.wall + " cells of wall, earth or a closed room" });
    }
    Object.keys(o.rooms).forEach(function (fi) {
      var ids = Object.keys(o.rooms[fi]);
      if (ids.length > 1) {
        world.problems.push({ rule: what, text: what + " " + t.id + " reaches into " + ids.join(" and ") + " on " +
                              world.floors[fi].id + ": it would join rooms no source connects" });
      }
    });
  }

  /* ---------------------------------------------------------------- ceilings */

  function median(a) {
    if (!a.length) { return null; }
    a.sort(function (p, q) { return p - q; });
    return a[floor(a.length / 2)];
  }

  function ceilings(world, fl) {
    var above = null;
    world.floors.forEach(function (o) { if (o.z > fl.z + 0.5 && (!above || o.z < above.z)) { above = o; } });
    var capZ = above ? above.z : Infinity, n = fl.n, q, r, vx = world.vox, col = columnsOf(world, fl);
    // The model's roof over each cell, less a voxel, never above the floor
    // over this one; and whether it is glass on top.
    var roof = new Float32Array(n).fill(-1), glassy = new Uint8Array(n);
    if (vx) {
      for (q = 0; q < n; q += 1) {
        var c0 = col[q];
        if (c0 < 0 || vx.top[c0] < 0) { continue; }
        var z0 = vx.top[c0] * vx.v;
        if (z0 > capZ) { roof[q] = capZ; } else { roof[q] = z0; glassy[q] = vx.glassTop[c0]; }
      }
    }
    // Each room's height where it gives one, else the middle of the model's
    // over it, for the ceilings that are one height.
    var samples = fl.rooms.map(function () { return []; });
    for (q = 0; q < n; q += 3) {
      var ri = fl.room[q];
      if (ri < 0 || fl.door[q] >= 0) { continue; }
      var zb = fl.z + fl.rooms[ri].fz;
      if (roof[q] > zb + HEAD) { samples[ri].push(roof[q] - zb); }
    }
    fl.rooms.forEach(function (room, k) {
      room.autoH = median(samples[k]);
      room.clearH = room.h !== null ? room.h : room.autoH;
    });
    for (q = 0; q < n; q += 1) {
      var kind = fl.kind[q];
      if (kind === WALL || kind === GLASS) { fl.ch[q] = OPEN; fl.ck[q] = DARK; continue; }
      if (fl.door[q] >= 0) { continue; }
      r = fl.room[q] >= 0 ? fl.rooms[fl.room[q]] : null;
      if (!r || r.pseudo === "outside") { outside(q); continue; }
      var base = fl.z + r.fz, H = r.clearH, a = roof[q] > base + HEAD ? roof[q] : -1;
      var cx = fl.x0 + (q % fl.gw + 0.5) * fl.cell, cy = fl.y0 + (floor(q / fl.gw) + 0.5) * fl.cell;
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
          var R = r.circle ? r.circle[2] : min(r.bbox[2] - r.bbox[0], r.bbox[3] - r.bbox[1]) / 2;
          var d = round(hypot(cx - r.cx, cy - r.cy) / fl.cell) * fl.cell;
          if (r.oculus && d < r.oculus) { fl.ch[q] = OPEN; fl.ck[q] = SKY; break; }
          if (r.h === null) {
            // Its height not published: the model's own dome over it, less a
            // voxel, and where the model has glass on top, its oculus.
            if (a < 0) { fl.ch[q] = OPEN; fl.ck[q] = DARK; }
            else { fl.ch[q] = cm(a); fl.ck[q] = glassy[q] ? SKYLIGHT : DOME; }
            break;
          }
          // Rising toward its middle in rings a cell wide, from its spring.
          fl.ch[q] = cm(base + r.h + sqrt(max(0, R * R - d * d)));
          fl.ck[q] = DOME;
          break;
        }
        case "vault": {
          // Round over its long axis, from the height of its walls.
          var wide = r.bbox[2] - r.bbox[0], deep = r.bbox[3] - r.bbox[1], half = min(wide, deep) / 2;
          var off = wide >= deep ? abs(cy - r.cy) : abs(cx - r.cx);
          off = round(off / fl.cell) * fl.cell;
          fl.ch[q] = cm(base + (H === null ? 0 : H) + sqrt(max(0, half * half - off * off)));
          fl.ck[q] = VAULT;
          break;
        }
        default:
          // auto: the model's roof over the cell, less a voxel; a skylight
          // where the model has glass on top, else a ceiling nobody knows.
          if (a < 0) { fl.ch[q] = OPEN; fl.ck[q] = DARK; }
          else { fl.ch[q] = cm(a); fl.ck[q] = glassy[q] ? SKYLIGHT : DARK; }
      }
    }
    // A doorway's head: as it says, else the lower of its two rooms' ceilings.
    var tops = fl.rooms.map(function () { return []; });
    for (q = 0; q < n; q += 3) {
      if (fl.room[q] >= 0 && fl.door[q] < 0 && fl.kind[q] !== WALL) { tops[fl.room[q]].push(fl.ch[q]); }
    }
    var heads = fl.doors.map(function (d) {
      if (!d.cells) { return null; }
      if (typeof d.h === "number") { return cm(fl.z + (d.a >= 0 ? fl.rooms[d.a].fz : 0) + d.h); }
      var ha = d.a >= 0 ? median(tops[d.a]) || OPEN : OPEN, hb = d.b >= 0 ? median(tops[d.b]) || OPEN : OPEN;
      return min(ha, hb);
    });
    for (q = 0; q < n; q += 1) {
      var di = fl.door[q];
      if (di < 0 || heads[di] === null) { continue; }
      fl.ch[q] = heads[di];
      fl.ck[q] = heads[di] >= OPEN ? SKY : FLAT;
    }

    function outside(qq) {
      // Under whatever the model has overhead — a porch roof — else the sky;
      // never lower than a walker needs, a model's voxels being too coarse
      // to say a porch is lower than that.
      var c1 = col[qq];
      if (vx && c1 >= 0) {
        for (var k = floor((fl.z + EYE) / vx.v) + 1; k < vx.nz; k += 1) {
          var mm = vx.grid[k * vx.nx * vx.ny + c1];
          if (mm && vx.built[mm - 1]) { fl.ch[qq] = cm(max(k * vx.v, fl.fh[qq] / 100 + HEAD + 0.1)); fl.ck[qq] = FLAT; return; }
        }
      }
      fl.ch[qq] = OPEN; fl.ck[qq] = SKY;
    }
  }

  /* ---------------------------------------------------------------- inks */

  // A surface's ink, packed, straight from its material and the soil:
  // the material worn over the soil (a little more soil where it is
  // reconstructed), or where nothing is known the soil itself. DIRT's gaps
  // and speckle are not the ink: a soil pixel is half a metre here, and a
  // gap as big as that reads as a doorway or a pit; they are marked in
  // fl.grit and the walk darkens dots within the cell for them, at the
  // scale the model's own dots have them. m: a Models.MATERIALS entry or null.
  function inkOf(m, lift, s, dark) {
    var r, g, b;
    void dark;
    if (!m || !m.c) { r = s[0]; g = s[1]; b = s[2]; }
    else if (m.glass) { r = 150; g = 172; b = 190; }
    else {
      var t = min(1, m.soil + lift);
      r = m.c[0] + (s[0] - m.c[0]) * t; g = m.c[1] + (s[1] - m.c[1]) * t; b = m.c[2] + (s[2] - m.c[2]) * t;
    }
    return ((255 << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r)) >>> 0;
  }

  function inks(world, fl, soil) {
    var mats = MATS || Models().MATERIALS, names = world.vox ? world.vox.names : Object.keys(mats);
    var dark = world.dark, sky = world.sky, ground = mats[world.groundMaterial] || null;
    var pane = pack(sky.pane), tone = pack(sky.tone), glass = pack([150, 172, 190]), void_ = pack(dark);
    var byName = names.map(function (n) { return mats[n] || null; });
    // Each room's materials, looked up once.
    var rm = fl.rooms.map(function (r) {
      var lift = r.mats.sure === "documented" ? 0 : UNSURE;
      return { floor: mats[r.mats.floor] || null, walls: mats[r.mats.walls] || null, top: mats[r.mats.top] || null,
               lift: lift, pseudo: r.pseudo, void: r.kind === "void" };
    });
    var grit = fl.grit = new Uint8Array(fl.n);
    // The soil under the grid and three cells round it, read once.
    var M3 = 3, sw = fl.gw + 2 * M3, sh = fl.gh + 2 * M3, sc = soil ? new Uint8Array(sw * sh * 4) : null;
    if (sc) {
      for (var sj = 0; sj < sh; sj += 1) {
        for (var si = 0; si < sw; si += 1) {
          var got = soil(fl.i0 + si - M3, fl.j0 + sj - M3) || SOIL, so = (sj * sw + si) * 4;
          sc[so] = got[0]; sc[so + 1] = got[1]; sc[so + 2] = got[2]; sc[so + 3] = got[3];
        }
      }
    }
    function soilAt(o) { return [sc[o], sc[o + 1], sc[o + 2], sc[o + 3]]; }
    function solid(i, j, s) {
      // A gap's own colour is none: the soil's nearest grain round it.
      for (var r = 1; r <= M3; r += 1) {
        for (var dj = -r; dj <= r; dj += 1) {
          for (var di = -r; di <= r; di += 1) {
            if (max(abs(di), abs(dj)) !== r) { continue; }
            var o = ((j + dj + M3) * sw + i + di + M3) * 4;
            if (sc[o + 3] > 0) { return soilAt(o); }
          }
        }
      }
      return [SOIL[0], SOIL[1], SOIL[2], s[3]];
    }
    for (var q = 0; q < fl.n; q += 1) {
      var i = q % fl.gw, j = (q - i) / fl.gw;
      var s = sc ? soilAt(((j + M3) * sw + i + M3) * 4) : SOIL;
      // 1: a gap, 2: speckle, on the floor (bits 0-1), the walls (2-3), the top (4-5), where the soil shows.
      var g0 = s[3] === 0 ? 1 : s[3] === 1 ? 2 : 0;
      if (s[3] === 0) { s = solid(i, j, s); }
      var ri = fl.room[q], k = fl.kind[q], F, Wl, T, gr = 0;
      if (k === WALL || k === GLASS) {
        // Earth where nothing is known; the model's own wall on its edge.
        var mm = fl.foot[q] === 2 && fl.footM[q] ? byName[fl.footM[q] - 1] : null;
        F = Wl = T = inkOf(mm, UNSURE, s, dark);
        if (k === GLASS) { Wl = glass; } else if (!mm) { gr = g0 * 21; }
      } else if (ri >= 0 && !rm[ri].pseudo) {
        var m = rm[ri];
        F = m.void ? void_ : inkOf(m.floor, m.lift, s, dark);
        Wl = inkOf(m.walls, m.lift, s, dark);
        T = inkOf(m.top, m.lift, s, dark);
        gr = (m.floor || m.void ? 0 : g0) | (m.walls ? 0 : g0 << 2) | (m.top ? 0 : g0 << 4);
      } else if (ri >= 0 && rm[ri].pseudo !== "outside") {
        // The shell, a stair, a lift: as far as they are known, the soil.
        F = Wl = T = inkOf(null, 0, s, dark);
        gr = g0 * 21;
      } else {
        // Outside: the ground under it in the model, else the soil.
        var om = fl.footM[q] ? byName[fl.footM[q] - 1] : ground;
        F = Wl = T = inkOf(om, UNSURE, s, dark);
        if (!om) { gr = g0 * 21; }
      }
      grit[q] = gr;
      if (fl.ck[q] === SKYLIGHT) { T = pane; } else if (fl.ck[q] === SKY) { T = tone; }
      fl.inkF[q] = F; fl.inkW[q] = Wl; fl.inkT[q] = T;
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
  // One measure alone: a tondo's diameter, a small bronze's greatest extension, a height.
  var SINGLE = new RegExp("\\b(diameter|diam\\.|greatest extension|height)\\)?\\s*:?\\s*" + NUM + "\\s*(cm|mm|in|inches)\\b", "i");
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
      if (!m) {
        // 'overall (diameter): 94.5 cm' is as wide as it is high; a greatest
        // extension or a height alone is its height, its width the picture's.
        var one = SINGLE.exec(part);
        if (!one || /\b(framed|frame|mount|mounted|mat)\b/i.test(part.slice(0, one.index))) { continue; }
        var v = number(one[2]) * (one[3].toLowerCase() === "cm" ? 1 : one[3].toLowerCase() === "mm" ? 0.1 : 2.54);
        if (!(v > 0)) { continue; }
        v = round(v * 10) / 10;
        return /^diam/i.test(one[1]) ? { w: v, h: v, d: null } : { w: null, h: v, d: null };
      }
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
    // Its height alone known: as wide as its picture makes it.
    if (c && !(c[0] > 0) && c[1] > 0) { return { w: c[1] / 100 * ar, h: c[1] / 100, d: null, known: true }; }
    return { w: UNSIZED * ar, h: UNSIZED, d: null, known: false };
  }

  // Two works by the museum's own record numbers (an NGA object id, a Met
  // object, an accession number), numbers as numbers; 0 where either has none.
  function byRecord(a, b) {
    var ra = a.ref && a.ref.object != null ? String(a.ref.object) : null;
    var rb = b.ref && b.ref.object != null ? String(b.ref.object) : null;
    if (ra === null || rb === null || ra === rb) { return 0; }
    var pa = ra.split(/(\d+)/), pb = rb.split(/(\d+)/);
    for (var i = 0; i < min(pa.length, pb.length); i += 1) {
      if (pa[i] === pb[i]) { continue; }
      var na = i % 2 ? parseInt(pa[i], 10) : NaN, nb = i % 2 ? parseInt(pb[i], 10) : NaN;
      if (!isNaN(na) && !isNaN(nb) && na !== nb) { return na - nb; }
      return pa[i] < pb[i] ? -1 : 1;
    }
    return pa.length - pb.length;
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

  // A straight wall to hang along: t metres from its left end as you face it.
  function straightOf(wl) {
    return { walls: [wl], len: wl.len, runs: wl.runs,
             at: function (t) { return [wl.x0 + wl.ux * t, wl.y0 + wl.uy * t]; } };
  }
  // Whether works side by side fit a run of L metres, never closer than APART.
  function fitsRun(list, L) {
    var sum = 0;
    list.forEach(function (it) { sum += it.size.w; });
    if (sum > L + 1e-9) { return false; }
    return list.length < 2 || (L - sum) / (list.length - 1) >= APART - 1e-9;
  }
  // The runs left once a stretch [a, b] of a carrier's wall is taken.
  function cutAvail(avail, cr, a, b) {
    var out = [];
    avail.forEach(function (u) {
      if (u.wall !== cr) { out.push(u); return; }
      cutRuns([[u.t0, u.t1]], a, b).forEach(function (p) { out.push({ wall: cr, t0: p[0], t1: p[1] }); });
    });
    return out.filter(function (u) { return u.t1 - u.t0 >= 0.3; });
  }
  // What a room's runs leave once the works hung in it are hung (INTERIORS.md, "Beside the known"):
  // each straight run less the span of every work that faces out from its wall — hung on it, or
  // standing free a metre out from it — APART either side. A work in the middle of the room takes
  // no wall.
  function leftBy(avail, hung, room, fl) {
    var out = avail;
    hung.forEach(function (h) {
      if (h.room !== room.index || h.floor !== fl.index || h.wall === "centre") { return; }
      var seen = [];
      out.forEach(function (u) {
        var cr = u.wall, wl = cr.walls && cr.walls.length === 1 ? cr.walls[0] : null;
        if (!wl || seen.indexOf(cr) >= 0) { return; }
        seen.push(cr);
        if (h.nx * wl.nx + h.ny * wl.ny > -0.9) { return; }
        var d = (h.cx - wl.x0) * wl.nx + (h.cy - wl.y0) * wl.ny;
        if (d > 0.05 || d < -(FREE_OUT + INTO + 0.1)) { return; }
        var a0 = (h.x0 - wl.x0) * wl.ux + (h.y0 - wl.y0) * wl.uy, a1 = (h.x1 - wl.x0) * wl.ux + (h.y1 - wl.y0) * wl.uy;
        out = cutAvail(out, cr, min(a0, a1) - APART, max(a0, a1) + APART);
      });
    });
    return out;
  }
  // The site's rule along the runs a room offers (INTERIORS.md, "Arranged"; "Beside the known"), the
  // runs longest first: a work wider than every run is drawn at the size of a run of its own, the
  // longest left, and no taller than the room lets it stand (`fit`, said so in the look), so that it
  // never holds the rest back; the rest from the front, as many to a run as fit at one to every
  // `space` metres of it, never closer than APART. `tall(run)`: the most a work may stand there.
  // Returns {lays: [{run, list}], left: [the works not taken]}.
  function siteLay(list, avail, space, tall) {
    var runs = avail.slice(), lays = [], queue = list.slice();
    var longest = runs.length ? runs[0].t1 - runs[0].t0 : 0;
    var big = queue.filter(function (it) { return it.size.w > longest + 1e-9; });
    if (big.length) {
      queue = queue.filter(function (it) { return big.indexOf(it) < 0; });
      big.forEach(function (it) {
        var run = runs.shift();
        if (!run) { queue.push(it); return; }
        var L = run.t1 - run.t0, H = tall ? tall(run) : Infinity, sz = it.size;
        var k = min(1, (L - 1e-6) / sz.w, H / sz.h);
        var one = { w: it.w, n: it.n, pin: it.pin,
                    size: { w: sz.w * k, h: sz.h * k, d: sz.d ? sz.d * k : null, known: sz.known, fit: k } };
        lays.push({ run: run, list: [one] });
      });
    }
    runs.forEach(function (run) {
      if (!queue.length) { return; }
      var take = [], most = max(1, floor((run.t1 - run.t0) / space));
      for (var k = 0; k < queue.length && take.length < most; k += 1) {
        if (fitsRun(take.concat([queue[k]]), run.t1 - run.t0)) { take.push(queue[k]); } else { break; }
      }
      queue = queue.slice(take.length);
      if (take.length) { lays.push({ run: run, list: take }); }
    });
    return { lays: lays, left: queue };
  }
  // The most a work may stand along a run: the headroom a step out from its middle, less the 0.3 m
  // a tall work stands off the floor and as much again under the ceiling.
  function tallAlong(fl) {
    return function (run) {
      var cr = run.wall, wl = cr.walls && cr.walls[0], p = cr.at((run.t0 + run.t1) / 2);
      if (!wl || !p) { return Infinity; }
      var q = cellAt(fl, p[0] - wl.nx * 0.4, p[1] - wl.ny * 0.4);
      if (q < 0 || fl.ch[q] >= OPEN) { return Infinity; }
      return max(0.5, (fl.ch[q] - fl.fh[q]) / 100 - 2 * LIFTED);
    };
  }
  // The runs of a room's walls, straight, as the site's works hang on them, less what the works hung
  // there already take; longest first.
  function siteRuns(room, fl, hung) {
    var avail = [];
    (room.walls || []).forEach(function (wl) {
      var cr = straightOf(wl);
      cr.runs.forEach(function (u) { avail.push({ wall: cr, t0: u[0], t1: u[1] }); });
    });
    var mine = (hung || []).some(function (h) { return h.room === room.index && h.floor === fl.index; });
    if (mine) { avail = leftBy(avail, hung, room, fl); }
    return avail.sort(function (a, b) { return (b.t1 - b.t0) - (a.t1 - a.t0); });
  }
  // Whether works the site hangs beside the museum's own all fit in a room, beside what hangs there
  // already (INTERIORS.md, "Beside the known"): the spacing they would hang at — 2.5 m, else 1.5 —
  // or 0 where some would be left. opts.scale: a work wider than every run counts as fitting, drawn
  // smaller (else it does not fit: the site tries a room it fits whole first). A work of no known
  // size is taken as wide as opts.ar times its 0.6 m height, for its picture may come wider.
  function siteFits(world, roomId, hung, works, opts) {
    opts = opts || {};
    var room = roomById(world, roomId);
    if (!room || !room.walls || !room.walls.length) { return 0; }
    var fl = world.floors[room.floor];
    var list = (works || []).map(function (w, n) {
      var ww = w;
      if (opts.ar && !(w.cm && w.cm[0] > 0 && w.cm[1] > 0)) {
        ww = {};
        Object.keys(w).forEach(function (k) { ww[k] = w[k]; });
        ww.ar = opts.ar;
      }
      return { w: ww, n: n, pin: null, size: sizeOf(ww) };
    });
    var avail = siteRuns(room, fl, hung), tall = tallAlong(fl);
    var longest = avail.length ? avail[0].t1 - avail[0].t0 : 0;
    if (!opts.scale && list.some(function (it) { return it.size.w > longest + 1e-9; })) { return 0; }
    if (!siteLay(list, avail, ARR_SPACE, tall).left.length) { return ARR_SPACE; }
    if (!siteLay(list, avail, ARR_TIGHT, tall).left.length) { return ARR_TIGHT; }
    return 0;
  }

  // Hang the works the museum's own records place in drawn rooms, each on
  // the wall the record gives, in the museum's order, spaced evenly along
  // the wall's longest run between openings; what does not fit goes to the
  // next run, then to a second tier above. The place along the wall and
  // the height are ours unless a pin fixes them. Then the works the site
  // hung (how arranged), by its rule (siteLay), in a room where the
  // record's hang only on what wall they leave. Returns {hung, spill}.
  function hang(world, works, pins) {
    pins = pins || {};
    var groups = {}, order = [], hung = [], spill = [], record = {};
    (works || []).forEach(function (w, n) {
      // A work that is another saved work's very object hangs once, as that one.
      // An arranged work (INTERIORS.md, "Arranged") hangs in the room the site's rule gave it.
      if ((w.how !== "museum" && w.how !== "arranged") || !w.room || w.same) { return; }
      var room = roomById(world, w.room);
      if (!room) { spill.push(w.id); return; }
      var pin = pins[w.id] || null;
      var dir = (pin && pin.wall) || w.wall || null;
      // The site's works are a group of their own, never mixed with the record's.
      var site = w.how === "arranged", rk = room.floor + ":" + room.index;
      var key = rk + ":" + (dir || "-") + (site ? ":site" : "");
      if (!site) { record[rk] = true; }
      if (!groups[key]) { groups[key] = { room: room, dir: dir, list: [], rk: rk, site: site }; order.push(key); }
      groups[key].list.push({ w: w, n: n, pin: pin, size: sizeOf(w) });
    });
    // In a room where the record's works hang, the site's are hung after them all, on what wall they
    // leave (INTERIORS.md, "Beside the known"): a record's work is never moved for one of the site's.
    var after = order.filter(function (k) { return groups[k].site && record[groups[k].rk]; });
    order = order.filter(function (k) { return after.indexOf(k) < 0; }).concat(after);
    order.forEach(function (key) {
      var g = groups[key], room = g.room, fl = world.floors[room.floor], base = fl.z + room.fz;
      // The museum's order — its own record numbers — then by date; the
      // order the file lists them in last, so it is always the same. Arranged
      // works keep the file's order, which is the rule's: period, artist, date.
      var arranged = g.site;
      g.list.sort(function (a, b) {
        if (arranged) { return a.n - b.n; }
        return byRecord(a.w, b.w) || String(a.w.y || "").localeCompare(String(b.w.y || "")) || a.n - b.n;
      });
      if (g.dir === "centre") { centre(g.list, room, fl, base); return; }
      var walls = g.dir ? compass(room, g.dir, world) : room.walls.slice();
      // What they hang along: each straight wall, or a round room's arc as one.
      var carriers = room.circle && g.dir ? arcs(room, walls) : walls.map(straight);
      var avail = [];
      carriers.forEach(function (cr) {
        cr.runs.forEach(function (u) { avail.push({ wall: cr, t0: u[0], t1: u[1] }); });
      });
      // Beside the record's works: only what wall they leave (INTERIORS.md, "Beside the known").
      if (g.site && record[g.rk]) { avail = leftBy(avail, hung, room, fl); }
      // Pinned works first, where their record puts them.
      var rest = [];
      g.list.forEach(function (it) {
        if (it.pin && typeof it.pin.at === "number" && carriers.length) {
          var cr = carriers[0], t = it.pin.at * cr.len;
          put(it, cr, t, base + (typeof it.pin.z === "number" ? it.pin.z : HANG), 1, false, true);
          avail = cutAvail(avail, cr, t - it.size.w / 2 - APART, t + it.size.w / 2 + APART);
        } else { rest.push(it); }
      });
      avail.sort(function (a, b) { return (b.t1 - b.t0) - (a.t1 - a.t0); });
      var queue = rest;
      if (arranged) {
        // The arranged rule: one work to every 2.5 m of the run, never crowded; a work the site hangs
        // beside the museum's own, every 1.5 m where 2.5 m would not take them all.
        var tall = tallAlong(fl), space = ARR_SPACE;
        if (g.list.some(function (it) { return !!it.w.beside; }) && siteLay(queue, avail, ARR_SPACE, tall).left.length) {
          space = ARR_TIGHT;
        }
        var got = siteLay(queue, avail, space, tall);
        got.lays.forEach(function (l) { lay(l.list, l.run, 1, null); });
        queue = got.left;
      } else {
        avail.forEach(function (run) {
          if (!queue.length) { return; }
          var take = [];
          for (var k = 0; k < queue.length; k += 1) {
            if (fits(take.concat([queue[k]]), run.t1 - run.t0)) { take.push(queue[k]); } else { break; }
          }
          queue = queue.slice(take.length);
          lay(take, run, 1, null);
        });
      }
      // A second tier over the longest run, for what is left (never for the
      // arranged: the rule gives a room no more than its walls hold).
      if (queue.length && avail.length && !arranged) {
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

    // A straight wall to hang along: t metres from its left end as you face it.
    function straight(wl) {
      return { walls: [wl], len: wl.len, runs: wl.runs,
               at: function (t) { return [wl.x0 + wl.ux * t, wl.y0 + wl.uy * t]; } };
    }
    // A round room's arc facing the way the record says: its facets in turn,
    // one run from end to end, kept clear of its openings and of its two ends
    // (a facet's own corners are not corners). Where an opening takes a whole
    // facet out, the arc is two.
    function arcs(rm, ws) {
      var n = rm.poly.length, byEdge = {};
      ws.forEach(function (w) { byEdge[w.edge] = w; });
      var idx = ws.map(function (w) { return w.edge; }).sort(function (a, b) { return a - b; });
      if (!idx.length) { return []; }
      // Start after the widest step round the ring, so an arc over edge 0 stays whole.
      var start = 0, widest = -1;
      idx.forEach(function (e, k) {
        var step = (idx[(k + 1) % idx.length] - e + n) % n || n;
        if (step > widest) { widest = step; start = (k + 1) % idx.length; }
      });
      var ordered = idx.slice(start).concat(idx.slice(0, start)), pieces = [[]];
      ordered.forEach(function (e, k) {
        if (k && (e - ordered[k - 1] + n) % n !== 1) { pieces.push([]); }
        pieces[pieces.length - 1].push(byEdge[e]);
      });
      return pieces.map(function (list) {
        var cum = [0];
        list.forEach(function (w) { cum.push(cum[cum.length - 1] + w.len); });
        var L = cum[cum.length - 1], rs = [[OFF_CORNER, L - OFF_CORNER]];
        list.forEach(function (w, k) {
          w.gaps.forEach(function (gp) { rs = cutRuns(rs, cum[k] + gp[0] - OFF_OPEN, cum[k] + gp[1] + OFF_OPEN); });
        });
        return {
          walls: list, len: L, runs: rs.filter(function (u) { return u[1] - u[0] >= 0.3; }),
          at: function (t) {
            t = max(0, min(L, t));
            for (var k = 0; k < list.length; k += 1) {
              if (t <= cum[k + 1] + 1e-9 || k === list.length - 1) {
                var w = list[k], tl = t - cum[k];
                return [w.x0 + w.ux * tl, w.y0 + w.uy * tl];
              }
            }
            return null;
          }
        };
      });
    }
    function fits(list, L) {
      var sum = 0;
      list.forEach(function (it) { sum += it.size.w; });
      if (sum > L + 1e-9) { return false; }
      return list.length < 2 || (L - sum) / (list.length - 1) >= APART - 1e-9;
    }
    function cutAvail(avail, cr, a, b) {
      var out = [];
      avail.forEach(function (u) {
        if (u.wall !== cr) { out.push(u); return; }
        cutRuns([[u.t0, u.t1]], a, b).forEach(function (p) { out.push({ wall: cr, t0: p[0], t1: p[1] }); });
      });
      return out.filter(function (u) { return u.t1 - u.t0 >= 0.3; });
    }
    // A work at t along what it hangs on: flat, at its real size — on an arc,
    // the chord between its two edges — 2 cm into the room, or 1 m out if it
    // stands free.
    function put(it, cr, t, zc, tier, wallOurs, pinned) {
      var w = it.w, sz = it.size, free = standsFree(w, sz);
      var room = roomById(world, w.room), fl = world.floors[room.floor];
      var base = fl.z + room.fz;
      var p0 = cr.at(t - sz.w / 2), p1 = cr.at(t + sz.w / 2);
      var ux = p1[0] - p0[0], uy = p1[1] - p0[1], ul = hypot(ux, uy) || 1;
      ux /= ul; uy /= ul;
      // Into the room: the other way from the wall's outward normal.
      var nx = -uy, ny = ux, out = INTO + (free ? FREE_OUT : 0);
      var cx = (p0[0] + p1[0]) / 2 + nx * out, cy = (p0[1] + p1[1]) / 2 + ny * out;
      var z0, z1;
      if (free) { z0 = base; z1 = base + sz.h; }
      else if (sz.h > TALL && tier === 1) { z0 = base + LIFTED; z1 = z0 + sz.h; }
      else { z0 = zc - sz.h / 2; z1 = zc + sz.h / 2; }
      // Left to right as you face the wall.
      var hx = ux * sz.w / 2, hy = uy * sz.w / 2;
      var h = {
        id: w.id, work: w, floor: fl.index, room: room.index, wall: it.pin && it.pin.wall || w.wall || null,
        x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy, z0: z0, z1: z1, nx: nx, ny: ny,
        w: sz.w, h: sz.h, d: sz.d, sized: sz.known, free: free, standing: free || (sz.h > TALL && tier === 1),
        tier: tier, ours: !pinned, wallOurs: !!wallOurs, t: t / cr.len, cx: cx, cy: cy
      };
      // Drawn smaller than its size: no wall here takes it whole (the site's rule, said in the look).
      if (sz.fit && sz.fit < 1) { h.fit = sz.fit; }
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

  // Whether a straight line on one floor can be walked: every point of it
  // a walker's half-width clear of every cell that cannot be walked (a
  // cell's centre being clear is not enough: a line can clip a jamb's
  // corner between two centres).
  function sightline(fl, clear, x0, y0, x1, y1) {
    var len = hypot(x1 - x0, y1 - y0), n = max(1, ceil(len / (fl.cell / 4)));
    var prev = cellAt(fl, x0, y0);
    for (var s = 1; s <= n; s += 1) {
      var x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n, q = cellAt(fl, x, y);
      if (q !== prev) {
        if (!passable(fl, q, clear) || (prev >= 0 && !stepOK(fl, prev, q))) { return false; }
        prev = q;
      }
      if (!roomFor(fl, x, y, CLEAR)) { return false; }
    }
    return true;
  }

  // Whether a disc of radius r at a point touches no cell that cannot be walked.
  function roomFor(fl, x, y, r) {
    var c = fl.cell;
    var i0 = floor((x - r - fl.x0) / c), i1 = floor((x + r - fl.x0) / c);
    var j0 = floor((y - r - fl.y0) / c), j1 = floor((y + r - fl.y0) / c);
    for (var j = j0; j <= j1; j += 1) {
      for (var i = i0; i <= i1; i += 1) {
        var q = i < 0 || j < 0 || i >= fl.gw || j >= fl.gh ? -1 : j * fl.gw + i;
        if (q >= 0 && walkable(fl, q)) { continue; }
        var cx = fl.x0 + i * c, cy = fl.y0 + j * c;
        var dx = x < cx ? cx - x : x > cx + c ? x - cx - c : 0, dy = y < cy ? cy - y : y > cy + c ? y - cy - c : 0;
        if (dx * dx + dy * dy < (r - 1e-6) * (r - 1e-6)) { return false; }
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
    var goalAt = cells[cells.length - 1];
    cells[0] = [A.x, A.y, A.fl.index];
    // It ends on the very point asked for where a walker stands clear there;
    // else on the middle of its cell, clear of the wall it is against.
    var endB = roomFor(B.fl, B.x, B.y, CLEAR) ? [B.x, B.y, B.fl.index] : goalAt;
    if (cells.length > 1) { cells[cells.length - 1] = endB; } else { cells.push(endB); }
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

  // A shell's door, from the model alone: on the outer wall of the museum
  // itself — of the parts of the footprint that hold together, the one
  // nearest the model's middle, which is the museum's own point, so a
  // neighbour or a kiosk the model also holds is never taken for it — the
  // middle of the longest straight stretch of wall facing south (within 60°
  // of it, at whatever angle the building stands), with open ground before
  // it for the few metres a visitor stands in; east, west or north where
  // no wall facing south has that. Returns {x, y, dx, dy, run}: the middle
  // of the wall's outer face, the way out as a unit vector, and the length
  // of the stretch; or null.
  function shellDoor(world, fl) {
    var gw = fl.gw, gh = fl.gh, n = fl.n, cell = fl.cell, q, k;
    var N4 = [-1, 1, -gw, gw];
    function inGrid(p, o, i) { return p >= 0 && p < n && !(o === -1 && i === 0) && !(o === 1 && i === gw - 1); }
    // The inside's parts, four-connected.
    var part = new Int32Array(n).fill(-1), sizes = [], stack = [];
    for (q = 0; q < n; q += 1) {
      if (fl.foot[q] !== 1 || part[q] >= 0) { continue; }
      var id = sizes.length, count = 0;
      part[q] = id; stack.push(q);
      while (stack.length) {
        var c = stack.pop(), ci = c % gw;
        count += 1;
        for (k = 0; k < 4; k += 1) {
          var p = c + N4[k];
          if (inGrid(p, N4[k], ci) && fl.foot[p] === 1 && part[p] < 0) { part[p] = id; stack.push(p); }
        }
      }
      sizes.push(count);
    }
    if (!sizes.length) { return null; }
    // The museum: of the parts of any size (a tenth of the largest, and
    // 100 m²), the one nearest the model's middle, which is the museum's
    // own point — a model often holds its neighbours too.
    var largest = max.apply(null, sizes), near0 = sizes.map(function () { return Infinity; });
    var o = toGrid(world, 0, 0);
    for (q = 0; q < n; q += 1) {
      if (part[q] < 0) { continue; }
      var oc = centreOf(fl, q), od = (oc[0] - o[0]) * (oc[0] - o[0]) + (oc[1] - o[1]) * (oc[1] - o[1]);
      if (od < near0[part[q]]) { near0[part[q]] = od; }
    }
    var main = -1;
    sizes.forEach(function (s, m) {
      if (s < 0.1 * largest || s * cell * cell < 100) { return; }
      if (main < 0 || near0[m] < near0[main]) { main = m; }
    });
    if (main < 0) { main = sizes.indexOf(largest); }
    // Its wall: the ring within two voxels of it.
    var deep = ceil(world.vox.v * 2 / cell) + 1, dist = new Int16Array(n).fill(-1), queue = [];
    for (q = 0; q < n; q += 1) { if (part[q] === main) { dist[q] = 0; queue.push(q); } }
    for (var h = 0; h < queue.length; h += 1) {
      var c2 = queue[h], i2 = c2 % gw;
      if (dist[c2] >= deep) { continue; }
      for (k = 0; k < 4; k += 1) {
        var p2 = c2 + N4[k];
        if (inGrid(p2, N4[k], i2) && fl.foot[p2] === 2 && dist[p2] < 0) { dist[p2] = dist[c2] + 1; queue.push(p2); }
      }
    }
    function ground(p) { return p >= 0 && fl.foot[p] === 0 && fl.kind[p] === CLOSED; }
    // The outer face: the wall's cells with open ground beside them, each
    // with its way out — toward the ground round it, away from the inside,
    // over a metre and a half, so a stepped slanting wall reads as straight.
    var R = max(2, round(1.5 / cell)), edge = [], at = new Int32Array(n).fill(-1);
    for (q = 0; q < n; q += 1) {
      if (dist[q] <= 0 || fl.foot[q] !== 2) { continue; }
      var i = q % gw, j = (q - i) / gw, open = false;
      for (k = 0; k < 4; k += 1) { if (inGrid(q + N4[k], N4[k], i) && ground(q + N4[k])) { open = true; } }
      if (!open) { continue; }
      var sx = 0, sy = 0;
      for (var dj = -R; dj <= R; dj += 1) {
        for (var di = -R; di <= R; di += 1) {
          var a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= gw || b >= gh || di * di + dj * dj > R * R) { continue; }
          var f = fl.foot[b * gw + a], wgt = f === 0 ? 1 : part[b * gw + a] === main ? -1 : 0;
          sx += wgt * di; sy += wgt * dj;
        }
      }
      var L = hypot(sx, sy);
      if (L < 1e-9) { continue; }
      at[q] = edge.length;
      edge.push({ q: q, i: i, j: j, nx: sx / L, ny: sy / L });
    }
    // Stretches: cells of the face that touch and agree in their way out
    // within 20°.
    var group = new Int32Array(edge.length).fill(-1), stretches = [], COS = cos(20 * PI / 180);
    for (k = 0; k < edge.length; k += 1) {
      if (group[k] >= 0) { continue; }
      var g = stretches.length, list = [k], mx = edge[k].nx, my = edge[k].ny;
      group[k] = g;
      for (var t = 0; t < list.length; t += 1) {
        var e0 = edge[list[t]];
        for (var dj2 = -1; dj2 <= 1; dj2 += 1) {
          for (var di2 = -1; di2 <= 1; di2 += 1) {
            var a2 = e0.i + di2, b2 = e0.j + dj2;
            if (a2 < 0 || b2 < 0 || a2 >= gw || b2 >= gh) { continue; }
            var k2 = at[b2 * gw + a2];
            if (k2 < 0 || group[k2] >= 0) { continue; }
            if ((edge[k2].nx * mx + edge[k2].ny * my) / hypot(mx, my) < COS) { continue; }
            group[k2] = g; list.push(k2); mx += edge[k2].nx; my += edge[k2].ny;
          }
        }
      }
      var ml = hypot(mx, my);
      mx /= ml; my /= ml;
      var lo = Infinity, hi = -Infinity;
      list.forEach(function (kk) { var s = -edge[kk].i * my + edge[kk].j * mx; lo = min(lo, s); hi = max(hi, s); });
      stretches.push({ list: list, nx: mx, ny: my, len: (hi - lo + 1) * cell, mid: (lo + hi) / 2 });
    }
    // Open ground before a cell of the face, out along the way out for the
    // depth a visitor stands in, across a doorway's width.
    function clear(e, nx, ny) {
      var c = centreOf(fl, e.q);
      for (var s = cell; s <= 2.5 + 1e-9; s += cell / 2) {
        var half = s < 1 ? 0 : DOOR_W / 2;
        for (var w = -half; w <= half + 1e-9; w += cell / 2) {
          if (!ground(cellAt(fl, c[0] + nx * s - ny * w, c[1] + ny * s + nx * w))) { return false; }
        }
      }
      return true;
    }
    var ways = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    for (var wv = 0; wv < ways.length; wv += 1) {
      var best = null;
      stretches.forEach(function (st) {
        if (st.nx * ways[wv][0] + st.ny * ways[wv][1] < 0.5 || (best && st.len <= best.st.len)) { return; }
        // The cell of it nearest its middle with open ground before it.
        var pick = null, pd = Infinity;
        st.list.forEach(function (kk) {
          var e = edge[kk], d = abs(-e.i * st.ny + e.j * st.nx - st.mid);
          if (d < pd && clear(e, st.nx, st.ny)) { pick = e; pd = d; }
        });
        if (pick) { best = { st: st, e: pick }; }
      });
      if (!best) { continue; }
      var cc = centreOf(fl, best.e.q), nx0 = best.st.nx, ny0 = best.st.ny;
      return { x: cc[0] + nx0 * cell / 2, y: cc[1] + ny0 * cell / 2, dx: nx0, dy: ny0, run: best.st.len };
    }
    return null;
  }

  /* ---------------------------------------------------------------- building a floor */

  function footprint(world, fl) {
    var vx = world.vox;
    if (!vx) { return; }
    var zc = fl.z + EYE, col = columnsOf(world, fl), top = min(vx.nz - 1, floor((fl.z + STEP) / vx.v));
    for (var q = 0; q < fl.n; q += 1) {
      var c = col[q], b = builtAt(vx, c, zc);
      if (!b) {
        // What the ground outside is, underfoot: the model's top below the floor.
        if (c >= 0) {
          for (var k = top; k >= 0; k -= 1) {
            var mm = vx.grid[k * vx.nx * vx.ny + c];
            if (mm) { fl.footM[q] = mm; break; }
          }
        }
        continue;
      }
      fl.foot[q] = deepAt(vx, c, zc) ? 1 : 2;
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
        forRect(fl, rectOf(f, r), function (qq) {
          if (fl.room[qq] >= 0 || fl.kind[qq] !== CLOSED) { return; }
          fl.kind[qq] = FLOOR; fl.room[qq] = fl.outside; fl.fh[qq] = cm(fl.z);
        });
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
      // A passage cut through more than a wall's thickness goes through what
      // no source shows: its note must say why, and its length is reported.
      if (res.ok && d.cut && res.thick > THICK + 1e-9) {
        var ow = "opening " + o.a + " — " + o.b + " on " + fs.id + ": a passage cut " + res.thick.toFixed(1) + " m long";
        if (!o.note) { world.problems.push({ rule: "open", text: ow + ", with no note saying why" }); }
        else { world.notices.push(ow); }
      }
      if (res.ok && d.kind !== "part" && typeof o.w === "number" && o.w < 2 * CLEAR) {
        world.notices.push("opening " + o.a + " — " + o.b + " on " + fs.id + " is " + o.w + " m wide, narrower than a walker (" + 2 * CLEAR + " m)");
      }
    });
    // Things a source names: a fountain stands up out of the floor, and
    // what is solid is walked round.
    (fs.things || []).forEach(function (t, n) {
      if (!t.box) { return; }
      var g = rectOf(f, t.box), hgt = t.box[4] || 0;
      var thing = { index: n, rect: g, h: hgt, m: t.m || null, solid: t.solid !== false, sure: t.sure || null,
                    src: t.src || [], note: t.note || null };
      fl.things.push(thing);
      fl.thing = fl.thing || new Int16Array(fl.n).fill(-1);
      forRect(fl, g, function (qq) {
        if (fl.kind[qq] === WALL || fl.kind[qq] === GLASS) { return; }
        var host = fl.room[qq] >= 0 ? fl.rooms[fl.room[qq]] : null;
        fl.fh[qq] = cm(fl.z + (host ? host.fz : 0) + hgt);
        if (thing.solid) { fl.kind[qq] = CLOSED; }
        fl.thing[qq] = n;
      });
    });
    return fl;
  }

  function indexOfRoom(rooms, id) {
    for (var i = 0; i < rooms.length; i += 1) { if (rooms[i].id === id && !rooms[i].pseudo) { return i; } }
    return -1;
  }

  // The ground under a cell outside: the top of what the model has built
  // there, below the floor — a lawn or a pavement is the ground itself, and
  // a voxel that spans the floor's own level is taken to meet it.
  function groundUnder(world, fl, q) {
    var vx = world.vox;
    if (!vx) { return fl.z; }
    var col = columnsOf(world, fl)[q];
    if (col < 0) { return 0; }
    for (var k = min(vx.nz - 1, floor((fl.z + STEP) / vx.v)); k >= 0; k -= 1) {
      var mm = vx.grid[k * vx.nx * vx.ny + col];
      if (mm && vx.built[mm - 1]) { return max(k * vx.v, min((k + 1) * vx.v, fl.z)); }
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
        // The ground before it, 6 m across and 4 m out, as the box round it
        // in the grid; only open ground in it is walked.
        var ends = [[-OUT_W / 2, 0], [OUT_W / 2, 0], [-OUT_W / 2, OUT_D], [OUT_W / 2, OUT_D]].map(function (u) {
          return [sd.x - sd.dy * u[0] + sd.dx * u[1], sd.y + sd.dx * u[0] + sd.dy * u[1]];
        });
        out = [bboxOf(ends)];
      }
    }
    out.forEach(function (g) {
      forRect(fl, g, function (qq) {
        if (fl.kind[qq] !== CLOSED) { return; }
        fl.kind[qq] = FLOOR; fl.room[qq] = 1; fl.fh[qq] = cm(z0);
      });
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
  // the grid's origin, one cell to a pixel of the soil — the way round
  // Models.build asks for it, so land.js passes (i, j) => soilCell(dirt.land,
  // b, j, i) to both; materials: Models.MATERIALS unless given; sky: {alt,
  // dark} or a function giving it; dark: [r, g, b], the frame's own dark}.
  // Returns the world: {cell, turn, floors, stairs, lifts, enter, tier,
  // shell, ...}; each floor its typed arrays in the grid ({kind, room, fh,
  // ch, ck, inkF, inkW, inkT}, gw by gh cells from x0, y0), its rooms, the
  // stairs and lifts that reach it, and its things; enter {floor, x, y,
  // face, door, out} in the grid, face in radians (INTERIORS.md says more).
  function compile(interior, modelSpec, opts) {
    opts = opts || {};
    interior = interior || {};
    MATS = opts.materials || Models().MATERIALS;
    var grid = interior.grid || {}, f = frameOf(grid.turn || 0);
    var world = {
      slug: interior.slug || (modelSpec && modelSpec.slug) || null, building: interior.building || null,
      cell: grid.cell || 0.5, turn: f.turn, cos: f.cos, sin: f.sin,
      floors: [], stairs: [], lifts: [], enter: null, tier: "shell", shell: false,
      vox: modelOf(modelSpec, MATS), sky: skyOf(opts.sky), dark: opts.dark || DARK_INK,
      groundMaterial: modelSpec && modelSpec.ground || null,
      sources: {}, works: interior.works || [], pins: interior.pins || {},
      problems: [], notices: [], overlaps: [], stairSpecs: [], liftSpecs: []
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
      var before = {};
      world.stairSpecs.forEach(function (st, n) {
        var c = { index: n, id: st.id, name: st.name == null ? null : st.name, rect: rectOf(f, st.rect || [0, 0, 0, 0]),
                  rise: /^[+-][xy]$/.test(st.rise || "") ? st.rise : "+x", from: idx[st.from], to: idx[st.to],
                  sure: st.sure || null, src: st.src || [] };
        world.stairs.push(c);
        if (c.from === undefined || c.to === undefined) {
          world.problems.push({ rule: "stair", text: "stair " + st.id + " joins a floor that is not in the file" });
          return;
        }
        var fa = world.floors[c.from], fb = world.floors[c.to];
        [fa, fb].forEach(function (fl) {
          if (!before[fl.index]) { before[fl.index] = { ch: fl.ch.slice(), ck: fl.ck.slice() }; }
        });
        var res = ramp(world, c);
        if (!res.ok) { world.problems.push({ rule: "stair", text: "stair " + st.id + ": " + res.why }); }
        overProblems(world, c, "stair");
        // Over a stair, the higher of what was over it on either floor: the stairwell.
        [fa, fb].forEach(function (fl) {
          var other = fl === fa ? fb : fa;
          forRect(fl, c.rect, function (q, x, y) {
            if (fl.stair[q] !== c.index) { return; }
            var oq = cellAt(other, x, y);
            var mine = before[fl.index].ch[q], theirs = oq >= 0 ? before[other.index].ch[oq] : OPEN;
            var hi = max(mine, theirs);
            fl.ch[q] = max(hi, fl.fh[q] + HEAD * 100 + 20);
            fl.ck[q] = hi === mine ? before[fl.index].ck[q] : before[other.index].ck[oq];
          });
        });
      });
      world.liftSpecs.forEach(function (lf, n) {
        var c = { index: n, id: lf.id, name: lf.name == null ? null : lf.name, rect: rectOf(f, lf.rect || [0, 0, 0, 0]),
                  floors: (lf.floors || []).map(function (id) { return idx[id]; }).filter(function (i) { return i !== undefined; }),
                  sure: lf.sure || null, src: lf.src || [] };
        world.lifts.push(c);
        lift(world, c);
        overProblems(world, c, "lift");
        c.floors.forEach(function (fi) {
          var fl = world.floors[fi];
          forRect(fl, c.rect, function (q) {
            if (fl.lift[q] === c.index) { fl.ch[q] = cm(fl.z + 2.4); fl.ck[q] = DARK; }
          });
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
      // The stairs and lifts that reach this floor.
      fl.stairs = world.stairs.filter(function (st) { return st.from === fl.index || st.to === fl.index; });
      fl.lifts = world.lifts.filter(function (lf) { return lf.floors.indexOf(fl.index) >= 0; });
      // Only compiling needs each cell's voxel column: a phone keeps the rest.
      delete fl.col;
    });
    if (world.enter) { world.enter.face = world.enter.a; }
    world.tier = tierOf(world);
    delete world.stairSpecs;
    delete world.liftSpecs;
    return world;
  }

  // documented: at least 80% of the walkable floor in documented rooms;
  // arranged: more than half of it in rooms the site arranged (INTERIORS.md,
  // "Arranged"); reconstructed: any other rooms drawn; else the shell.
  function tierOf(world) {
    if (world.shell) { return "shell"; }
    var doc = 0, arr = 0, all = 0;
    world.floors.forEach(function (fl) {
      for (var q = 0; q < fl.n; q += 1) {
        if (fl.kind[q] !== FLOOR || fl.room[q] < 0) { continue; }
        var r = fl.rooms[fl.room[q]];
        if (r.pseudo) { continue; }
        all += 1;
        if (r.sure === "documented") { doc += 1; } else if (r.sure === "arranged") { arr += 1; }
      }
    });
    return !all ? "shell" : doc / all >= 0.8 ? "documented" : arr / all > 0.5 ? "arranged" : "reconstructed";
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
  // is chosen, where it is not given, to keep what is drawn once the roof
  // is off — the model below the cut and the plan — under 40,000 dots: the
  // plan holds still to be read and turned, and the lift itself lasts a
  // moment. you: {x, y, a} in the grid, or null.
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
    var cutR = (cut / v) / (ext.lift || 1), under = 0;
    for (var e = 0; e < (ext.count || 0); e += 1) { if (ext.reveal[e] <= cutR) { under += 1; } }
    var budget = PLAN_DOTS - under;
    var pitches = typeof pitch === "number" ? [pitch] : [0.5, 1, 2, 4];
    // The pitch from a count of what each would make, then one build: a
    // build at half a metre first, to be thrown away, took four times as long.
    var pick = pitches[pitches.length - 1];
    for (var pi = 0; pi < pitches.length; pi += 1) {
      if (pitches.length === 1 || count(pitches[pi]) <= budget) { pick = pitches[pi]; break; }
    }
    var dots = build(pick);
    var joined = M.join(ext, dots);
    joined.cut = cutR;
    joined.plan = { start: ext.count || 0, count: dots.count, pitch: dots.pitch, you: dots.you, shown: under + dots.count };
    return joined;

    // As build() below, only counting.
    function count(p) {
      var k = max(1, round(p / fl.cell)), n = 0, layers = 1;
      for (var z0 = fl.z + p; z0 < cut - 1e-6; z0 += p) { layers += 1; }
      for (var bj = 0; bj < fl.gh; bj += k) {
        for (var bi = 0; bi < fl.gw; bi += k) {
          var fq = -1, wq = -1, eq = -1, rq = -1;
          for (var j = bj; j < min(fl.gh, bj + k); j += 1) {
            for (var i = bi; i < min(fl.gw, bi + k); i += 1) {
              var q = j * fl.gw + i, kd = fl.kind[q];
              if (kd === FLOOR || (kd === CLOSED && fl.room[q] >= 0)) { if (fq < 0) { fq = q; } }
              else if (kd === WALL || kd === GLASS) {
                if (besideRoom(fl, q)) { if (wq < 0) { wq = q; } }
                else if (fl.foot[q] === 1 || fl.foot[q] === 0) { if (eq < 0) { eq = q; } }
                else if (rq < 0) { rq = q; }
              }
            }
          }
          var w = wq >= 0 ? wq : fq < 0 && rq >= 0 ? rq : -1;
          if (fq >= 0 && fl.room[fq] >= 0 && fl.rooms[fl.room[fq]].pseudo !== "outside") { n += 1; }
          if (w >= 0) { n += layers; } else if (eq >= 0 && fq < 0) { n += 1; }
        }
      }
      (hung || []).forEach(function (h) { if (h.floor === fl.index) { n += max(1, round(h.w / (p / 2))) + 1; } });
      return n + (you ? 2 : 0);
    }

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
      // A wall's cap: its own ink gone toward pale stone, the way the
      // town's buildings are drawn, so the rooms read from above.
      function cap(u) {
        var key = u + ":cap";
        return inkCache[key] || (inkCache[key] = css(mix(unpack(u), PALE, 0.45), 1.04));
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
          // Walls: those beside a room, and the model's own outer wall.
          var wq = wallQ >= 0 ? wallQ : floorQ < 0 && ringQ >= 0 ? ringQ : -1;
          var cq = floorQ >= 0 ? floorQ : wq >= 0 ? wq : earthQ;
          if (cq < 0) { continue; }
          var c = centreOf(fl, cq);
          var gx = fl.x0 + (bi + k / 2) * fl.cell, gy = fl.y0 + (bj + k / 2) * fl.cell;
          if (floorQ >= 0 && fl.room[floorQ] >= 0 && fl.rooms[fl.room[floorQ]].pseudo !== "outside") {
            put(gx, gy, fl.fh[floorQ] / 100, size, ink(fl.inkF[floorQ], 1));
          }
          if (wq >= 0) {
            for (var z = fl.z + p; z < cut - 1e-6; z += p) { put(c[0], c[1], z, size, ink(fl.inkW[wq], 0.84)); }
            put(c[0], c[1], cut, size, cap(fl.inkW[wq]));
          } else if (earthQ >= 0 && floorQ < 0) {
            // What is inside and not known: earth, up to the cut.
            put(gx, gy, cut, size, ink(fl.inkF[earthQ], 0.55));
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
    // 640 KB: a museum read from its own open data carries a few hundred of its collection's works, each
    // with the museum's own label (INTERIORS.md, "The collection on the walls").
    if (typeof opts.bytes === "number" && opts.bytes > 640 * 1024) { err("the file is " + round(opts.bytes / 1024) + " KB (at most 640)"); }
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
    // arrangedOK: a floor, room, opening, stair, lift or entrance the site arranged (INTERIORS.md,
    // "Arranged") — never a height, a material, a thing or a pin, which only a source gives.
    function sure(v, what, arrangedOK) {
      if (SURE[v] || (arrangedOK && v === "arranged")) { return; }
      err(what + ": sure must be documented or reconstructed" + (arrangedOK ? " (or arranged)" : "") + ", not " + v);
    }
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
      sure(fs.sure, fw, true);
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
        sure(r.sure, rw, true);
        cites(r.src, rw, true);
        // anchor: the source whose own coordinates fix where the room is (a museum's map of its galleries).
        if (r.anchor !== undefined) {
          if (typeof r.anchor !== "string") { err(rw + ": anchor must be a source id"); }
          else { cites([r.anchor], rw + " anchor", true); }
        }
        if (r.name !== null && r.name !== undefined && typeof r.name !== "string") { err(rw + ": name must be words or null"); }
        if (r.sure === "arranged") {
          // The site's room, never the museum's: called by a number or by what it is, and it says so.
          if (r.name !== null && r.name !== undefined && !ARR_NAME.test(r.name)) {
            err(rw + ": an arranged room is called Room <n>, Hall or Entrance, never a museum's own gallery name (" + r.name + ")");
          }
          if (typeof r.said !== "string" || !/arranged by the site/.test(r.said)) {
            err(rw + ": an arranged room's said must say it is arranged by the site");
          }
          if (r.ref && r.ref.length) { err(rw + ": an arranged room answers to no key of the museum's (ref)"); }
        }
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
        if (o.kind && o.kind !== "door" && o.kind !== "arch" && o.kind !== "part") { err(ow + ": kind must be door, arch or part"); }
        sure(o.sure, ow, true);
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
        sure(st.sure, sw, true);
        cites(st.src, sw, true);
      });
      (fs.lifts || []).forEach(function (lf) {
        var lw = "lift " + (lf && lf.id);
        if (!lf) { return; }
        if (!ids[lf.id]) { uniq(lf.id, lw); }
        rect(lf.rect, lw + " rect");
        if (!Array.isArray(lf.floors) || lf.floors.length < 2) { err(lw + " must name at least two floors"); }
        sure(lf.sure, lw, true);
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
      sure(e.sure, "the entrance", true);
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
    var HOW = { museum: 1, elsewhere: 1, off: 1, none: 1, arranged: 1 };
    var counts = { museum: 0, elsewhere: 0, off: 0, none: 0, arranged: 0 }, oldWorks = 0, workIds = {};
    if (!Array.isArray(I.works)) { err("works must be a list"); }
    (I.works || []).forEach(function (w, n) {
      var ww = "work " + (w && w.id || n);
      if (!w || typeof w.id !== "string") { err("work " + n + " has no id"); return; }
      if (workIds[w.id]) { err(ww + " is listed twice"); }
      workIds[w.id] = 1;
      if (!HOW[w.how]) { err(ww + ": how must be museum, elsewhere, off, none or arranged"); return; }
      counts[w.how] += 1;
      if (typeof w.said !== "string") { err(ww + ": said must be the source's own words"); }
      if (w.src !== null && w.src !== undefined) {
        if (!src[w.src]) { err(ww + " cites " + w.src + ", which is not in sources"); }
        else if (!src[w.src].read && w.how !== "none") { err(ww + " cites " + w.src + ", which has not been read yet"); }
      } else if (w.how === "museum" || w.how === "elsewhere" || w.how === "off" || w.how === "arranged") { err(ww + ": a placement needs its src"); }
      if (w.how === "arranged") {
        // Hung by the site's rule (INTERIORS.md, "Arranged"): in a room the site arranged, saying so;
        // what the museum's own record says of it, if anything, kept in rec with its source.
        if (!w.room) { err(ww + ": an arranged work needs its room"); }
        if (!/the site/.test(w.said || "")) { err(ww + ": an arranged work's said must say the site hung it"); }
        if (w.rec && w.rec.src && !src[w.rec.src]) { err(ww + ": its record cites " + w.rec.src + ", which is not in sources"); }
        // Hung beside the museum's own works, in a room a source draws (INTERIORS.md, "Beside the
        // known"): it says by which rule, says so in its said, and keeps what its record says.
        if (w.beside !== undefined) {
          if (!w.beside || !BESIDE_BY[w.beside.by]) { err(ww + ": beside must say its rule (by: artist, period-kind, near, period, kind or order)"); }
          if (!/hung here by the site/.test(w.said || "") || !/beside|nearest|from the door/.test(w.said || "")) {
            err(ww + ": a work the site hangs beside the museum's own says so: 'hung here by the site, beside …'");
          }
          if (!w.rec || typeof w.rec.said !== "string" || !HOW[w.rec.how] || w.rec.how === "arranged" || w.rec.how === "museum") {
            err(ww + ": a work the site hangs beside the museum's own keeps what its record says (rec: how none, elsewhere or off, said, src)");
          }
          if (w.beside && w.beside.of && typeof w.beside.of !== "string") { err(ww + ": beside.of is the id of the room it is near"); }
        }
      } else if (w.beside !== undefined) { err(ww + ": only a work the site hangs (how arranged) says what it hangs beside"); }
      if (w.wall !== undefined && w.wall !== null && !DIRS[w.wall] && w.wall !== "centre") { err(ww + ": wall must be n, e, s, w, centre or null"); }
      // The museum's own collection on its walls (INTERIORS.md, "The collection on the walls").
      if (w.kind !== undefined && w.kind !== "collection") { err(ww + ": kind must be collection or absent"); }
      if (w.kind === "collection") {
        if (w.how !== "museum") { err(ww + ": a collection work hangs (how museum) or is not listed"); }
        if (!w.ref || typeof w.ref.museum !== "string" || w.ref.object === undefined || typeof w.ref.url !== "string") {
          err(ww + ": a collection work needs ref {museum, object, url}");
        }
        if (w.img !== null && w.img !== undefined && !/^https:\/\//.test(String(w.img))) { err(ww + ": img must be an https address or null"); }
        if (w.c !== null && w.c !== undefined && !(Array.isArray(w.c) && w.c.every(function (h) { return /^#[0-9a-f]{6}$/i.test(h); }))) {
          err(ww + ": c must be a list of hex colours or null");
        }
        if ((w.desc && !w.descsrc) || (!w.desc && w.descsrc)) { err(ww + ": desc and descsrc go together"); }
        if (w.desc !== null && w.desc !== undefined && typeof w.desc !== "string") { err(ww + ": desc must be the museum's words or null"); }
      }
      if (w.asof && days(w.asof, today) > 30) { oldWorks += 1; }
    });
    if (oldWorks) { warn(oldWorks + " works were placed more than 30 days ago: run build_interiors.py"); }
    if (museum && museum.works) {
      var missing = museum.works.filter(function (w) { return !workIds[w.id]; }).length;
      if (missing) { warn(missing + " of its saved works in museums.json are not in the file: run build_interiors.py"); }
    }
    if (I.tier !== undefined && ["documented", "reconstructed", "arranged", "shell"].indexOf(I.tier) < 0) { err("tier must be documented, reconstructed, arranged or shell"); }

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
    (world.notices || []).forEach(function (t) { warn(t); });
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
        // A reconstructed or arranged room is held to the model, unless the museum's own coordinates (its
        // anchor) say where it is: then, like a documented room, the model is what is wrong.
        if ((r.sure === "reconstructed" || r.sure === "arranged") && !(r.spec && r.spec.anchor)) {
          err(r.sure + " room " + r.id + " is " + round(100 * out / n) + "% outside the model at " + (fl.z + EYE).toFixed(1) + " m (" + ext + ")");
        } else {
          warn((r.sure === "documented" ? "documented" : "anchored") + " room " + r.id + " is " + round(100 * out / n) + "% outside the model (" + ext + ")");
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
      if (unreached.length) {
        warn(unreached.length + " rooms have no way in known yet: " + unreached.slice(0, 24).join(", ") +
             (unreached.length > 24 ? " and " + (unreached.length - 24) + " more" : ""));
      }
    }
    // The works.
    try {
      hung = hang(world, I.works, pins);
    } catch (x) {
      err("its works could not be hung: " + (x && x.message || x));
    }
    (I.works || []).forEach(function (w) {
      if (!w || (w.how !== "museum" && w.how !== "arranged")) { return; }
      var r = w.room ? roomById(world, w.room) : null;
      if (!r) { err("work " + w.id + ": its room " + w.room + " is not drawn"); return; }
      // The rule hangs only in rooms the site arranged; a record's work never in one.
      // (or a room OpenStreetMap's indoor mapping draws, where the museum's own plan is not known:
      // the site hangs there what no record places, and says so).
      // A work the site hangs beside the museum's own (beside) may hang in any room a source draws.
      if (w.how === "arranged" && r.sure !== "arranged" && !(r.spec && r.spec.anchor === "osm-indoor") && !w.beside) {
        err("work " + w.id + ": arranged, but room " + r.id + " is not an arranged room (nor one OpenStreetMap draws), and it does not say what it hangs beside");
      }
      if (w.beside && (r.kind === "closed" || r.kind === "void" || r.kind === "stair")) { err("work " + w.id + ": hung beside the museum's own in room " + r.id + ", which is not walked"); }
      if (w.how === "museum" && r.sure === "arranged") { err("work " + w.id + ": a record's placement in room " + r.id + ", which the site arranged"); }
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
    // Every saved work it lists hangs (INTERIORS.md, "Beside the known"): but one its record says is
    // off view, one another museum's record places and the site has not hung here, and a work that is
    // another's very object, which hangs as that one.
    var onWall = {}, listedN = 0, listedOn = 0, notOn = [];
    hung.hung.forEach(function (h) { onWall[h.id] = 1; });
    (I.works || []).forEach(function (w) {
      if (!w || w.kind === "collection" || w.how === "off" || (w.at && w.how !== "arranged")) { return; }
      listedN += 1;
      if (onWall[w.id] || (w.same && onWall[w.same])) { listedOn += 1; } else { notOn.push(w.id); }
    });
    stats.saved = listedN;
    stats.savedHung = listedOn;
    if (notOn.length) {
      warn(notOn.length + " of its " + listedN + " saved works do not hang" + (world.shell ? " (a shell: no rooms to hang in)" : "") + ": " +
           notOn.slice(0, 12).join(", ") + (notOn.length > 12 ? " and " + (notOn.length - 12) + " more" : ""));
    }
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
            // A voxel standing alone is a trunk or a post, not the building.
            if (!builtAt(vx, j * vx.nx + i - 1, z) && !builtAt(vx, j * vx.nx + i + 1, z) &&
                !builtAt(vx, (j - 1) * vx.nx + i, z) && !builtAt(vx, (j + 1) * vx.nx + i, z)) { continue; }
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
      var doc = 0, rec = 0, arr = 0, rooms = 0, reach = 0;
      fl.rooms.forEach(function (r) { if (!r.pseudo) { rooms += 1; if (r.reach) { reach += 1; } } });
      for (var q = 0; q < fl.n; q += 1) {
        if (fl.kind[q] !== FLOOR || fl.room[q] < 0) { continue; }
        var r = fl.rooms[fl.room[q]];
        if (r.pseudo) { continue; }
        if (r.sure === "documented") { doc += 1; } else if (r.sure === "arranged") { arr += 1; } else { rec += 1; }
      }
      var a = fl.cell * fl.cell;
      stats.floors.push({ id: fl.id, name: fl.name, z: fl.z, cells: fl.n, rooms: rooms, reached: reach,
                          documented: round(doc * a), reconstructed: round(rec * a), arranged: round(arr * a) });
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
             DOOR_W: DOOR_W, DOOR_H: DOOR_H, PLAN_DOTS: PLAN_DOTS, ARR_SPACE: ARR_SPACE, ARR_TIGHT: ARR_TIGHT,
             OFF_OPEN: OFF_OPEN, OFF_CORNER: OFF_CORNER, ARR_NAME: ARR_NAME, BESIDE_BY: BESIDE_BY },
    compile: compile, toGrid: toGrid, toWorld: toWorld, headingOf: headingOf, compassOf: compassOf,
    shape: shape, raster: raster, seal: seal, carve: carve, ramp: ramp, ceilings: ceilings, shell: shell,
    runs: runs, compass: compass, dims: dims, hang: hang, clearance: clearance, path: path, stand: stand,
    siteFits: siteFits, siteRuns: siteRuns, sizeOf: sizeOf,
    planDots: planDots, check: check,
    // helpers the walk and the checker use
    cellAt: cellAt, centreOf: centreOf, walkable: walkable, floorOf: floorOf, roomById: roomById,
    inRoom: inRoom, skyOf: skyOf, standsFree: standsFree, unpack: unpack, pack: pack
  };
}));

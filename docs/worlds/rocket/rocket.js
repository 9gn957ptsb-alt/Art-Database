/* Rocket — a city of the Artist Website, in blocks, and the four pieces of
   your rocket somewhere in it.

   A simpler game in the way of Minecraft's phone app: you come to under a
   tree beside your wrecked capsule, in one of the site's 28 cities rebuilt
   in one-metre blocks from its ground (docs/v2/grounds/city-*.json: every
   20 m cell a street, a pavement, a park, water or a building of so many
   storeys). Break blocks and place them; climb, dig and swim to find the
   engine, the fuel tank, the guidance computer and the heat shield, then
   build the rocket at the wreck and launch.

   The view is drawn in the site's pixel (two of the screen's to one), its
   light dithered; its labels in the site's small capitals. */

(function () {
  "use strict";

  var BASE = "../../v2/";
  var SX = 384, SZ = 384, SY = 128, CH = 16;             // the world, in blocks; chunks of 16 by 16 columns
  var GROUND = 34;                                       // where the crash site's ground stands
  var REACH = 6, EYE = 1.62, PIX = 2;
  var SAVE = "rocket-save-v1";

  /* ---- the blocks ------------------------------------------------------- */

  var B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, ROAD: 4, PAVE: 5, WATER: 6, LOG: 7, LEAVES: 8, BRICK: 9, LIME: 10, CONC: 11,
            GLASS: 12, SLATE: 13, SAND: 14, METAL: 15, SCORCH: 16, RENDER: 17, LOOSE: 18, WHITE: 19, RED: 20, BEDROCK: 21,
            ENGINE: 22, TANK: 23, GUIDE: 24, SHIELD: 25 };
  // Colours, and how each is textured in the shader (0 plain, 1 grass, 2 log, 3 leaves, 4 glass, 5 brick, 6 water, 7 piece, 8 road).
  var PAL = [];
  var STYLE = [];
  function def(id, rgb, style) { PAL[id] = rgb; STYLE[id] = style || 0; }
  def(B.AIR, [0, 0, 0]); def(B.GRASS, [96, 138, 64], 1); def(B.DIRT, [124, 88, 60]); def(B.STONE, [122, 122, 120]);
  def(B.ROAD, [64, 63, 62], 8); def(B.PAVE, [168, 160, 146]); def(B.WATER, [52, 92, 140], 6); def(B.LOG, [104, 80, 52], 2);
  def(B.LEAVES, [62, 104, 48], 3); def(B.BRICK, [150, 78, 56], 5); def(B.LIME, [216, 204, 176]); def(B.CONC, [170, 168, 162]);
  def(B.GLASS, [150, 186, 204], 4); def(B.SLATE, [84, 92, 104]); def(B.SAND, [210, 190, 140]); def(B.METAL, [150, 152, 156]);
  def(B.SCORCH, [52, 44, 38]); def(B.RENDER, [232, 226, 214]); def(B.LOOSE, [96, 66, 44]); def(B.WHITE, [240, 238, 232]);
  def(B.RED, [188, 58, 46]); def(B.BEDROCK, [40, 40, 42]);
  def(B.ENGINE, [255, 168, 64], 7); def(B.TANK, [120, 220, 255], 7); def(B.GUIDE, [150, 255, 140], 7); def(B.SHIELD, [255, 120, 200], 7);
  var PIECES = [
    { id: B.ENGINE, name: "The engine", where: "fell onto a roof near the wreck. Stack blocks to climb up to it." },
    { id: B.TANK, name: "The fuel tank", where: "dug itself into a park. Look for loose earth, and dig." },
    { id: B.GUIDE, name: "The guidance computer", where: "sank into the water. Swim down for it." },
    { id: B.SHIELD, name: "The heat shield", where: "caught in the top of a tree. Climb for it." }
  ];
  var HOTBAR = [B.BRICK, B.LOG, B.GLASS, B.DIRT, B.STONE];
  var NAMES = {}; NAMES[B.BRICK] = "Brick"; NAMES[B.LOG] = "Wood"; NAMES[B.GLASS] = "Glass"; NAMES[B.DIRT] = "Earth"; NAMES[B.STONE] = "Stone";
  function solid(b) { return b !== B.AIR && b !== B.WATER; }

  var world = new Uint8Array(SX * SY * SZ);
  function idx(x, y, z) { return (y * SZ + z) * SX + x; }
  function get(x, y, z) {
    if (x < 0 || z < 0 || x >= SX || z >= SZ || y >= SY) { return B.AIR; }
    if (y < 0) { return B.BEDROCK; }
    return world[idx(x, y, z)];
  }
  function set(x, y, z, b) { if (x >= 0 && z >= 0 && y >= 0 && x < SX && z < SZ && y < SY) { world[idx(x, y, z)] = b; } }
  function hash(a, b, c) { var h = Math.sin(a * 127.1 + b * 311.7 + (c || 0) * 74.7) * 43758.5453; return h - Math.floor(h); }

  /* ---- the city, in blocks ----------------------------------------------- */

  var city = null, crash = null, wreck = null, pieces = [];

  function build(g, where) {
    var n = g.n, c = g.side / n, half = g.side / 2;
    var kind = g.kind, tall = g.tall, gr = g.ground, built = g.built || [];
    var year = new Int16Array(n * n), bi = 0;
    for (var q = 0; q < n * n; q += 1) { if (kind[q] === "b") { year[q] = built[bi] || 0; bi += 1; } }
    var raw = function (i, j) { i = Math.max(0, Math.min(n - 1, i)); j = Math.max(0, Math.min(n - 1, j)); return (gr[j * n + i] || 0) / 2; };
    var soft = new Float32Array(n * n);
    for (var j = 0; j < n; j += 1) { for (var i = 0; i < n; i += 1) { var s = 0; for (var dj = -2; dj <= 2; dj += 1) { for (var di = -2; di <= 2; di += 1) { s += raw(i + di, j + dj); } } soft[j * n + i] = s / 25; } }
    var K = function (i, j) { return i < 0 || j < 0 || i >= n || j >= n ? "." : kind[j * n + i]; };

    // The crash: a park near the middle with water and a tall building within reach, if the city has them.
    var best = -1, bestS = -1e9, R = SX / 2 / c;
    for (j = 4; j < n - 4; j += 2) {
      for (i = 4; i < n - 4; i += 2) {
        if (K(i, j) !== "g") { continue; }
        // A park in the city, not a forest beside it: buildings all round, water if there is any,
        // and a building of a few storeys near enough to climb.
        var greens = 0, water = 0, blds = 0, mid = 0;
        for (dj = -1; dj <= 1; dj += 1) { for (di = -1; di <= 1; di += 1) { if (K(i + di, j + dj) === "g") { greens += 1; } } }
        for (dj = -R + 2; dj <= R - 2; dj += 1) { for (di = -R + 2; di <= R - 2; di += 1) {
          var k2 = K(i + di, j + dj); if (k2 === "~") { water += 1; }
          if (k2 === "b") { blds += 1; var st2 = tall.charCodeAt((j + dj) * n + i + di) - 48; if (st2 >= 4 && st2 <= 7 && Math.abs(di) + Math.abs(dj) < R) { mid += 1; } } } }
        var sc = Math.min(140, blds) + Math.min(10, water) * 5 + Math.min(6, mid) * 4 + greens - Math.hypot(i - n / 2, j - n / 2) * 0.1;
        if (greens >= 5 && blds >= 40 && sc > bestS) { bestS = sc; best = j * n + i; }
      }
    }
    if (best < 0) { best = Math.floor(n / 2) * n + Math.floor(n / 2); }
    var ci = best % n, cj = Math.floor(best / n);
    var ox = (ci + 0.5) * c - half - SX / 2, oz = (cj + 0.5) * c - half - SZ / 2;   // block (0,0) in the city's metres
    var base = soft[best];
    var cellOf = function (x, z) { return { i: Math.floor((x + ox + half) / c), j: Math.floor((z + oz + half) / c) }; };
    // The ground's height at a block, smoothly between the cells' heights.
    var hAt = function (x, z) {
      var fx = (x + ox + half) / c - 0.5, fz = (z + oz + half) / c - 0.5, i0 = Math.floor(fx), j0 = Math.floor(fz), u = fx - i0, v = fz - j0;
      var a = soft[Math.max(0, Math.min(n - 1, j0)) * n + Math.max(0, Math.min(n - 1, i0))], b2 = soft[Math.max(0, Math.min(n - 1, j0)) * n + Math.max(0, Math.min(n - 1, i0 + 1))];
      var c2 = soft[Math.max(0, Math.min(n - 1, j0 + 1)) * n + Math.max(0, Math.min(n - 1, i0))], d2 = soft[Math.max(0, Math.min(n - 1, j0 + 1)) * n + Math.max(0, Math.min(n - 1, i0 + 1))];
      var h = (a * (1 - u) + b2 * u) * (1 - v) + (c2 * (1 - u) + d2 * u) * v;
      return Math.max(6, Math.min(SY - 40, Math.round(GROUND + (h - base))));
    };

    world.fill(0);
    var top = new Int16Array(SX * SZ);
    for (var z = 0; z < SZ; z += 1) {
      for (var x = 0; x < SX; x += 1) {
        var cl = cellOf(x, z), k = K(cl.i, cl.j), y0 = hAt(x, z);
        if (k === "b") { y0 = hAt(Math.floor(x / 4) * 4, Math.floor(z / 4) * 4); }
        for (var y = 0; y < y0 - 3; y += 1) { set(x, y, z, y === 0 ? B.BEDROCK : B.STONE); }
        for (y = Math.max(0, y0 - 3); y < y0; y += 1) { set(x, y, z, B.DIRT); }
        var surf = B.PAVE;
        if (k === "g") { surf = B.GRASS; }
        else if (k === "=") {
          // A street: asphalt, with a pavement where it meets a building.
          var lx = (x + ox + half) - cl.i * c, lz = (z + oz + half) - cl.j * c;
          var nearB = (lx < 2.5 && K(cl.i - 1, cl.j) === "b") || (lx > c - 2.5 && K(cl.i + 1, cl.j) === "b") ||
                      (lz < 2.5 && K(cl.i, cl.j - 1) === "b") || (lz > c - 2.5 && K(cl.i, cl.j + 1) === "b");
          surf = nearB ? B.PAVE : B.ROAD;
        } else if (k === "~") {
          for (y = y0 - 4; y < y0 - 1; y += 1) { set(x, y, z, y === y0 - 4 ? B.SAND : B.WATER); }
          set(x, y0 - 5, z, B.SAND);
          top[z * SX + x] = y0 - 2;
          continue;
        }
        set(x, y0 - 1, z, surf);
        top[z * SX + x] = y0 - 1;
        if (k === "b") {
          var storeys = Math.max(1, tall.charCodeAt(cl.j * n + cl.i) - 48), hb = Math.min(SY - y0 - 2, Math.round(storeys * 3.2));
          var yr = year[cl.j * n + cl.i], hv = hash(cl.i, cl.j);
          var wall = storeys >= 20 ? (hv < 0.5 ? B.GLASS : B.CONC) : yr && yr < 1900 ? (hv < 0.55 ? B.LIME : hv < 0.8 ? B.BRICK : B.RENDER) :
                     yr && yr < 1960 ? (hv < 0.5 ? B.BRICK : B.LIME) : yr ? (hv < 0.5 ? B.CONC : B.RENDER) : (hv < 0.5 ? B.RENDER : B.BRICK);
          var roof = yr && yr < 1920 && storeys < 12 ? B.SLATE : B.CONC;
          for (y = y0; y < y0 + hb; y += 1) { set(x, y, z, wall); }
          set(x, y0 + hb, z, roof);
          top[z * SX + x] = y0 + hb;
        }
      }
    }
    // The windows: a grid of glass in every outside wall, a storey (three blocks) apart.
    for (z = 1; z < SZ - 1; z += 1) {
      for (x = 1; x < SX - 1; x += 1) {
        var t = top[z * SX + x], g0 = hAt(x, z);
        for (y = g0 + 1; y < t - 1; y += 1) {
          var b = get(x, y, z);
          if (b !== B.LIME && b !== B.BRICK && b !== B.RENDER && b !== B.CONC) { continue; }
          var ex = !solid(get(x + 1, y, z)) || !solid(get(x - 1, y, z)), ez = !solid(get(x, y, z + 1)) || !solid(get(x, y, z - 1));
          if (!ex && !ez) { continue; }
          var along = ex ? z : x;
          if ((y - g0) % 3 !== 0 && along % 3 !== 0) { set(x, y, z, B.GLASS); }
        }
      }
    }
    // Trees in the parks: oaks, as the blocky world grows them.
    var trees = [];
    for (z = 4; z < SZ - 4; z += 1) {
      for (x = 4; x < SX - 4; x += 1) {
        if (get(x, top[z * SX + x], z) !== B.GRASS || hash(x, z) > 0.012) { continue; }
        if (trees.some(function (tr) { return Math.abs(tr.x - x) < 5 && Math.abs(tr.z - z) < 5; })) { continue; }
        trees.push(oak(x, top[z * SX + x] + 1, z, 4 + Math.floor(hash(z, x) * 3)));
      }
    }

    // The crash: a scorched crater, the capsule broken open, your tree.
    var cx = SX / 2, cz = SZ / 2, cy = top[cz * SX + cx] + 1;
    // The ground round your tree cleared to the sky, and grassed: where you came down is a lawn.
    for (z = cz - 20; z <= cz + 20; z += 1) {
      for (x = cx - 20; x <= cx + 20; x += 1) {
        for (y = cy; y < SY; y += 1) { if (get(x, y, z) !== B.AIR && get(x, y, z) !== B.WATER) { set(x, y, z, B.AIR); } }
        var ty0 = cy - 1;
        while (ty0 > 0 && get(x, ty0, z) === B.AIR) { ty0 -= 1; }
        if (get(x, ty0, z) === B.PAVE || get(x, ty0, z) === B.ROAD) { set(x, ty0, z, Math.hypot(x - cx, z - cz) < 17 ? B.GRASS : get(x, ty0, z)); }
        top[z * SX + x] = ty0;
      }
    }
    trees = trees.filter(function (tr) { return Math.abs(tr.x - cx) > 22 || Math.abs(tr.z - cz) > 22; });
    var you = oak(cx, cy, cz, 6);
    var wx = cx + 9, wz = cz - 4, wy = top[wz * SX + wx] + 1;
    for (z = wz - 4; z <= wz + 4; z += 1) { for (x = wx - 4; x <= wx + 4; x += 1) { if (Math.hypot(x - wx, z - wz) < 4.5) { var ty = top[z * SX + x]; set(x, ty, z, B.SCORCH); if (Math.hypot(x - wx, z - wz) < 2.5) { set(x, ty, z, B.AIR); set(x, ty - 1, z, B.SCORCH); top[z * SX + x] = ty - 1; } } } }
    wy = top[wz * SX + wx] + 1;
    [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 1], [0, 1, 1], [2, 0, 0], [-1, 0, 1], [0, 2, 0]].forEach(function (d) { set(wx + d[0], wy + d[1], wz + d[2], B.METAL); });
    set(wx + 1, wy + 1, wz, B.SCORCH); set(wx - 3, top[(wz + 3) * SX + wx - 3] + 1, wz + 3, B.METAL); set(wx + 4, top[(wz - 2) * SX + wx + 4] + 1, wz - 2, B.METAL);
    crash = { x: cx + 1.5, y: cy, z: cz + 1.5 };
    wreck = { x: wx, y: wy, z: wz };

    // The pieces, where things fall.
    pieces = [];
    // The engine: on the roof of the tallest building within reach.
    var bx = -1, bz = -1, bt = 0;
    for (z = 20; z < SZ - 20; z += 2) { for (x = 20; x < SX - 20; x += 2) { var tt = top[z * SX + x]; if (tt > bt && tt - hAt(x, z) <= 24 && Math.hypot(x - cx, z - cz) > 30 && (get(x, tt, z) === B.SLATE || get(x, tt, z) === B.CONC)) { bt = tt; bx = x; bz = z; } } }
    if (bx < 0) { bx = cx + 40; bz = cz + 40; bt = top[bz * SX + bx]; }
    place(0, bx, bt + 1, bz);
    // The fuel tank: under loose earth in the grass, out from the crash.
    var gx = -1, gz = -1;
    for (var tries = 0; tries < 4000 && gx < 0; tries += 1) {
      var rx = Math.floor(cx + (hash(tries, 1) - 0.5) * 180), rz = Math.floor(cz + (hash(tries, 2) - 0.5) * 180);
      if (rx < 4 || rz < 4 || rx >= SX - 4 || rz >= SZ - 4) { continue; }
      if (get(rx, top[rz * SX + rx], rz) === B.GRASS && Math.hypot(rx - cx, rz - cz) > 35 && get(rx, top[rz * SX + rx] + 1, rz) === B.AIR) { gx = rx; gz = rz; }
    }
    if (gx < 0) { gx = cx - 30; gz = cz + 25; }
    var gt = top[gz * SX + gx];
    set(gx, gt, gz, B.LOOSE); set(gx, gt - 1, gz, B.DIRT); set(gx, gt - 2, gz, B.DIRT);
    place(1, gx, gt - 3, gz);
    // The guidance computer: on the bed of the nearest water (or under the paving of the farthest square).
    var wxx = -1, wzz = -1, wd = 1e9;
    for (z = 4; z < SZ - 4; z += 1) { for (x = 4; x < SX - 4; x += 1) { if (get(x, top[z * SX + x] + 1, z) === B.WATER || get(x, top[z * SX + x], z) === B.WATER) { var dd = Math.hypot(x - cx, z - cz); if (dd > 20 && dd < wd) { wd = dd; wxx = x; wzz = z; } } } }
    if (wxx >= 0) {
      var by = 0;
      for (y = SY - 1; y > 0; y -= 1) { if (get(wxx, y, wzz) === B.SAND) { by = y; break; } }
      place(2, wxx, by + 1, wzz);
      PIECES[2].where = "sank into the water. Swim down for it.";
    } else {
      var px2 = cx - 60, pz2 = cz - 50, pt = top[pz2 * SX + px2];
      set(px2, pt, pz2, B.LOOSE); place(2, px2, pt - 2, pz2);
      PIECES[2].where = "broke through the paving of a square. Look for loose earth, and dig.";
    }
    // The heat shield: in the top of the tallest tree out from the crash.
    var near2 = trees.filter(function (tr) { var d3 = Math.hypot(tr.x - cx, tr.z - cz); return d3 > 40 && d3 < 140; });
    var tr2 = near2[Math.floor(hash(cx, cz, near2.length) * near2.length)] || trees[0] || you;
    place(3, tr2.x, tr2.top + 1, tr2.z);

    city = { where: where, top: top, hAt: hAt, crashTree: you };
  }

  function oak(x, y, z, h) {
    for (var t = 0; t < h; t += 1) { set(x, y + t, z, B.LOG); }
    for (var dy = h - 2; dy <= h + 1; dy += 1) {
      var r = dy >= h ? 1 : 2;
      for (var dz = -r; dz <= r; dz += 1) { for (var dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy > h - 1 || hash(x + dx, y + dy, z + dz) < 0.5)) { continue; }
        if (get(x + dx, y + dy, z + dz) === B.AIR) { set(x + dx, y + dy, z + dz, B.LEAVES); }
      } }
    }
    return { x: x, z: z, top: y + h + 1 };
  }
  function place(k, x, y, z) {
    set(x, y, z, PIECES[k].id);
    pieces.push({ k: k, x: x, y: y, z: z });
  }

  /* ---- the mesh ----------------------------------------------------------- */

  var gl, prog, skyProg, U = {}, SU = {}, chunks = {}, canvas, hud;
  var FACES = [
    { d: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { d: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] }, { d: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];

  function meshChunk(cx, cz) {
    var pos = [], inf = [], ind = [], v = 0;
    var x0 = cx * CH, z0 = cz * CH;
    for (var y = 0; y < SY; y += 1) {
      for (var z = z0; z < z0 + CH; z += 1) {
        for (var x = x0; x < x0 + CH; x += 1) {
          var b = world[idx(x, y, z)];
          if (!b) { continue; }
          for (var f = 0; f < 6; f += 1) {
            var F = FACES[f], nb = get(x + F.d[0], y + F.d[1], z + F.d[2]);
            if (b === B.WATER) { if (nb !== B.AIR) { continue; } }
            else if (solid(nb) && !(nb === B.GLASS && b !== B.GLASS) && !(nb === B.LEAVES && b !== B.LEAVES)) { continue; }
            for (var k = 0; k < 4; k += 1) {
              var cc = F.c[k];
              pos.push(x + cc[0], y + cc[1] - (b === B.WATER && F.d[1] === 1 ? 0.12 : 0), z + cc[2]);
              // The corner's shade: how many blocks crowd it (ambient occlusion).
              var ao = 0;
              if (b !== B.WATER) {
                var ax = cc[0] ? 1 : -1, ay = cc[1] ? 1 : -1, az = cc[2] ? 1 : -1;
                var px = x + (F.d[0] ? F.d[0] : 0), py = y + (F.d[1] ? F.d[1] : 0), pz = z + (F.d[2] ? F.d[2] : 0);
                var s1, s2, s3;
                if (F.d[0]) { s1 = solid(get(px, py + ay, pz)); s2 = solid(get(px, py, pz + az)); s3 = solid(get(px, py + ay, pz + az)); }
                else if (F.d[1]) { s1 = solid(get(px + ax, py, pz)); s2 = solid(get(px, py, pz + az)); s3 = solid(get(px + ax, py, pz + az)); }
                else { s1 = solid(get(px + ax, py, pz)); s2 = solid(get(px, py + ay, pz)); s3 = solid(get(px + ax, py + ay, pz)); }
                ao = s1 && s2 ? 3 : (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
              }
              inf.push(f, b, ao, 0);
            }
            ind.push(v, v + 1, v + 2, v, v + 2, v + 3);
            v += 4;
          }
        }
      }
    }
    var key = cx + "," + cz, ch = chunks[key];
    if (!ch) { ch = chunks[key] = { vao: gl.createVertexArray(), pb: gl.createBuffer(), ib: gl.createBuffer(), eb: gl.createBuffer(), cx: cx, cz: cz }; }
    gl.bindVertexArray(ch.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.pb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.ib);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(inf), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.eb);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ind), gl.STATIC_DRAW);
    ch.count = ind.length;
    gl.bindVertexArray(null);
  }

  var VS = [
    "#version 300 es",
    "layout(location=0) in vec3 aP; layout(location=1) in vec4 aI;",
    "uniform mat4 uVP; uniform vec3 uOff;",
    "out vec3 vP; flat out int vF; flat out int vB; out float vAO;",
    "void main() { vP = aP + uOff; vF = int(aI.x); vB = int(aI.y); vAO = aI.z; gl_Position = uVP * vec4(vP, 1.0); }"
  ].join("\n");
  var FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec3 vP; flat in int vF; flat in int vB; in float vAO; out vec4 o;",
    "uniform vec3 uPal[32]; uniform int uStyle[32]; uniform vec3 uEye; uniform vec3 uSun; uniform float uT; uniform vec3 uSky; uniform vec3 uHaze;",
    "float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }",
    "float bayer(vec2 p) { ivec2 q = ivec2(mod(p, 4.0)); int i = q.x + q.y * 4;",
    "  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + 0.5) / 16.0; }",
    "const vec3 N[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));",
    "void main() {",
    "  vec3 n = N[vF];",
    "  vec3 cell = floor(vP - n * 0.5);",
    "  vec2 uv = vF < 2 ? vec2(vP.z, vP.y) : vF < 4 ? vec2(vP.x, vP.z) : vec2(vP.x, vP.y);",
    "  vec2 f = fract(uv); vec2 tx = floor(f * 8.0);",
    "  float r = h(cell * 1.7 + vec3(tx, float(vF)));",
    "  vec3 c = uPal[vB]; int st = uStyle[vB];",
    "  float k = 0.9 + 0.18 * r;",
    "  if (st == 1) { if (vF != 2) { if (f.y < 0.78 - 0.1 * h(cell + vec3(tx.x))) { c = uPal[2]; } } }",
    "  if (st == 2) { if (vF == 2 || vF == 3) { float d = length(f - 0.5); c *= 0.85 + 0.25 * step(0.5, fract(d * 4.0)); } else { k = 0.8 + 0.3 * step(0.4, h(cell + vec3(tx.x, 0.0, 0.0))); } }",
    "  if (st == 3) { if (r < 0.22) { c *= 0.55; } }",
    "  if (st == 4) { bool edge = f.x < 0.12 || f.x > 0.88 || f.y < 0.12 || f.y > 0.88; c = edge ? vec3(0.32, 0.3, 0.3) * 255.0 : mix(uSky * 255.0, c, 0.55); k = 1.0; }",
    "  if (st == 5) { float row = floor(f.y * 4.0); float mx = fract(f.x * 2.0 + row * 0.5); if (fract(f.y * 4.0) < 0.18 || mx < 0.09) { c = vec3(196.0, 188.0, 176.0); } }",
    "  if (st == 6) { k = 0.85 + 0.3 * (0.5 + 0.5 * sin(vP.x * 1.3 + vP.z * 0.9 + uT * 1.6)); }",
    "  if (st == 8) { k = 0.88 + 0.2 * r; }",
    "  c = c / 255.0 * k;",
    "  float sun = max(dot(n, uSun), 0.0);",
    "  float amb = 0.55 + 0.15 * n.y;",
    "  vec3 col = c * (amb + 0.6 * sun) * (1.0 - vAO * 0.16);",
    // The pieces glow and breathe, to be seen from far off.
    "  if (st == 7) { float pulse = 0.65 + 0.35 * sin(uT * 3.0); bool rim = f.x < 0.14 || f.x > 0.86 || f.y < 0.14 || f.y > 0.86; col = rim ? c * 0.35 : c * (0.8 + 0.6 * pulse); }",
    "  float dist = length(uEye - vP);",
    "  col = mix(col, uHaze, clamp(1.0 - exp(-dist * 0.006), 0.0, 1.0));",
    "  float t = bayer(gl_FragCoord.xy) - 0.5;",
    "  col = floor(col * 36.0 + t + 0.5) / 36.0;",
    "  o = vec4(col, 1.0);",
    "}"
  ].join("\n");
  var SKY_VS = "#version 300 es\nlayout(location=0) in vec2 a; out vec2 vA; void main(){ vA = a; gl_Position = vec4(a, 0.9999, 1.0); }";
  var SKY_FS = [
    "#version 300 es", "precision highp float;", "in vec2 vA; out vec4 o;",
    "uniform mat4 uInv; uniform vec3 uEye; uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uHaze;",
    "void main() { vec4 p = uInv * vec4(vA, 1.0, 1.0); vec3 r = normalize(p.xyz / p.w - uEye);",
    "  vec3 c = mix(uHaze, uSky, pow(clamp(r.y, 0.0, 1.0), 0.5));",
    "  float s = dot(r, uSun); c += vec3(1.0, 0.95, 0.85) * (step(0.9985, s) * 0.9 + pow(max(s, 0.0), 30.0) * 0.12);",
    "  o = vec4(c, 1.0); }"
  ].join("\n");

  function compile(vs, fs) {
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
      var sh = gl.createShader(s[0]); gl.shaderSource(sh, s[1]); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(sh)); }
      gl.attachShader(p, sh);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
    return p;
  }

  /* ---- the camera --------------------------------------------------------- */

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) { for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) { s += a[k * 4 + j] * b[i * 4 + k]; } o[i * 4 + j] = s; } }
    return o;
  }
  function lookDir(yaw, pitch) { return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]; }
  function view(eye, yaw, pitch) {
    var f = lookDir(yaw, pitch), r = [Math.cos(yaw), 0, Math.sin(yaw)];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0,
            -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
  }
  function invert(m) {
    var inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    var det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = det ? 1 / det : 0;
    return inv.map(function (x) { return x * det; });
  }

  /* ---- you ---------------------------------------------------------------- */

  var P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, ground: false, wet: false };
  var input = { fwd: 0, side: 0, jump: false, keys: {} };
  var mode = "break", slot = 0, found = [], built = false, launched = null, intro = null, vp = null, eye = null;

  function boxHits(x, y, z) {
    var r = 0.3;
    for (var by = Math.floor(y); by <= Math.floor(y + 1.79); by += 1) {
      for (var bz = Math.floor(z - r); bz <= Math.floor(z + r); bz += 1) {
        for (var bx = Math.floor(x - r); bx <= Math.floor(x + r); bx += 1) { if (solid(get(bx, by, bz))) { return true; } }
      }
    }
    return false;
  }

  function physics(dt) {
    var k = input.keys;
    var fwd = input.fwd + ((k.w || k.ArrowUp) ? 1 : 0) - ((k.s || k.ArrowDown) ? 1 : 0);
    var side = input.side + (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (k.ArrowLeft) { P.yaw -= dt * 2; }
    if (k.ArrowRight) { P.yaw += dt * 2; }
    var len = Math.hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    P.wet = get(Math.floor(P.x), Math.floor(P.y + 0.6), Math.floor(P.z)) === B.WATER;
    var speed = P.wet ? 2.2 : 4.3;
    var wx = (Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * side) * speed, wz = (-Math.cos(P.yaw) * fwd + Math.sin(P.yaw) * side) * speed;
    P.vx = wx; P.vz = wz;
    var jump = input.jump || k[" "];
    if (P.wet) {
      P.vy += (jump ? 9 : -6) * dt; P.vy = Math.max(-2.5, Math.min(3, P.vy));
    } else {
      P.vy -= 25 * dt;
      if (jump && P.ground) { P.vy = 8.2; P.ground = false; }
    }
    // Across, then along, then up and down, each stopped by the blocks; a single step is climbed by itself.
    var nx = P.x + P.vx * dt;
    if (boxHits(nx, P.y, P.z)) {
      if (P.ground && !boxHits(nx, P.y + 1.05, P.z) && !boxHits(P.x, P.y + 1.05, P.z) && (fwd || side)) { P.vy = 8.2; P.ground = false; }
      nx = P.x;
    }
    P.x = nx;
    var nz = P.z + P.vz * dt;
    if (boxHits(P.x, P.y, nz)) {
      if (P.ground && !boxHits(P.x, P.y + 1.05, nz) && !boxHits(P.x, P.y + 1.05, P.z) && (fwd || side)) { P.vy = 8.2; P.ground = false; }
      nz = P.z;
    }
    P.z = nz;
    var ny = P.y + P.vy * dt;
    if (boxHits(P.x, ny, P.z)) {
      // Landing: the feet set down on the top of the block below; a ceiling stops the rise.
      if (P.vy < 0) { var fy = Math.floor(ny) + 1; ny = fy <= P.y + 0.001 && !boxHits(P.x, fy, P.z) ? fy : P.y; P.ground = true; }
      else { ny = P.y; }
      P.vy = 0;
    } else { P.ground = false; }
    P.y = Math.max(1, ny);
    P.x = Math.max(0.5, Math.min(SX - 0.5, P.x)); P.z = Math.max(0.5, Math.min(SZ - 0.5, P.z));
  }

  /* What a ray from the eye meets first: the block, and the face it came in by. */
  function cast(dir) {
    var x = Math.floor(eye[0]), y = Math.floor(eye[1]), z = Math.floor(eye[2]);
    var sx = dir[0] > 0 ? 1 : -1, sy = dir[1] > 0 ? 1 : -1, sz = dir[2] > 0 ? 1 : -1;
    var tdx = Math.abs(1 / dir[0]), tdy = Math.abs(1 / dir[1]), tdz = Math.abs(1 / dir[2]);
    var tx = (sx > 0 ? x + 1 - eye[0] : eye[0] - x) * tdx, ty = (sy > 0 ? y + 1 - eye[1] : eye[1] - y) * tdy, tz = (sz > 0 ? z + 1 - eye[2] : eye[2] - z) * tdz;
    var last = null, t = 0;
    while (t < REACH) {
      var b = get(x, y, z);
      if (b !== B.AIR && b !== B.WATER) { return { x: x, y: y, z: z, b: b, prev: last }; }
      last = [x, y, z];
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; } else if (ty < tz) { y += sy; t = ty; ty += tdy; } else { z += sz; t = tz; tz += tdz; }
    }
    return null;
  }
  function dirAt(px, py) {
    var r = canvas.getBoundingClientRect(), nx = (px - r.left) / r.width * 2 - 1, ny = 1 - (py - r.top) / r.height * 2;
    var inv = invert(vp), w = [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) { w[i] = inv[i] * nx + inv[4 + i] * ny + inv[8 + i] + inv[12 + i]; }
    var d = [w[0] / w[3] - eye[0], w[1] / w[3] - eye[1], w[2] / w[3] - eye[2]], L = Math.hypot(d[0], d[1], d[2]);
    return [d[0] / L, d[1] / L, d[2] / L];
  }
  function act(px, py, forcePlace) {
    if (intro || launched) { return; }
    var hit = cast(dirAt(px, py));
    if (!hit) { return; }
    var placing = forcePlace || mode === "place";
    if (!placing) {
      if (hit.b === B.BEDROCK) { return; }
      var piece = PIECES.filter(function (p) { return p.id === hit.b; })[0];
      set(hit.x, hit.y, hit.z, B.AIR);
      if (piece) { collect(piece); }
      remeshAt(hit.x, hit.z);
    } else if (hit.prev) {
      var p = hit.prev;
      set(p[0], p[1], p[2], HOTBAR[slot]);
      if (boxHits(P.x, P.y, P.z)) { set(p[0], p[1], p[2], B.AIR); return; }
      remeshAt(p[0], p[2]);
    }
  }
  function remeshAt(x, z) {
    var cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    meshChunk(cx, cz);
    if (x % CH === 0 && cx > 0) { meshChunk(cx - 1, cz); }
    if (x % CH === CH - 1 && cx < SX / CH - 1) { meshChunk(cx + 1, cz); }
    if (z % CH === 0 && cz > 0) { meshChunk(cx, cz - 1); }
    if (z % CH === CH - 1 && cz < SZ / CH - 1) { meshChunk(cx, cz + 1); }
  }

  function collect(piece) {
    if (found.indexOf(piece.id) < 0) { found.push(piece.id); }
    store();
    say("Found " + piece.name.toLowerCase() + ".", true);
    drawPieces();
    if (found.length === PIECES.length) { setTimeout(function () { say("Every piece. Back to the wreck to build the rocket.", true); }, 1600); }
  }

  /* ---- the frame ---------------------------------------------------------- */

  var last = 0, sunDir = norm([-0.45, 0.78, -0.35]), SKY = [0.48, 0.66, 0.86], HAZE = [0.84, 0.86, 0.86];
  function norm(v) { var n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; }

  function frame(now) {
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    var eyeH = EYE, open = 1;
    if (intro) {
      var u = (now - intro.t0) / 1000, sm = function (a, b) { var t = Math.max(0, Math.min(1, (u - a) / (b - a))); return t * t * (3 - 2 * t); };
      open = lids(u);
      var pix = Math.round(8 - 6 * sm(1, 5.5));
      if (pix !== curPix) { curPix = pix; resize(); }
      eyeH = 0.35 + (EYE - 0.35) * sm(4.5, 7.2);
      P.pitch = 1.2 + (0 - 1.2) * sm(3.8, 7.2);
      P.yaw = intro.yaw0 + intro.turn * sm(5.5, 8.6);
      if (u > 9.6) { intro = null; curPix = PIX; resize(); document.body.dataset.film = ""; delete document.body.dataset.film; say(PIECES.length + " pieces of your rocket are somewhere in " + cityName + ". The notes show where they fell."); }
    } else if (!launched) {
      physics(dt);
    }
    eye = [P.x, P.y + eyeH, P.z];
    var w = canvas.width, h = canvas.height;
    var proj = perspective(70 * Math.PI / 180, w / h, 0.08, 420);
    vp = mul(proj, view(eye, P.yaw, P.pitch));
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(skyProg);
    gl.bindVertexArray(skyVao);
    gl.uniformMatrix4fv(SU.uInv, false, invert(vp));
    gl.uniform3fv(SU.uEye, eye); gl.uniform3fv(SU.uSun, sunDir); gl.uniform3fv(SU.uSky, SKY); gl.uniform3fv(SU.uHaze, HAZE);
    gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uVP, false, vp);
    gl.uniform3fv(U.uEye, eye); gl.uniform3fv(U.uSun, sunDir); gl.uniform1f(U.uT, now / 1000);
    gl.uniform3fv(U.uSky, SKY); gl.uniform3fv(U.uHaze, HAZE);
    gl.uniform3f(U.uOff, 0, 0, 0);
    var pcx = Math.floor(P.x / CH), pcz = Math.floor(P.z / CH);
    Object.keys(chunks).forEach(function (k) {
      var ch = chunks[k];
      if (Math.abs(ch.cx - pcx) > 14 || Math.abs(ch.cz - pcz) > 14 || !ch.count) { return; }
      gl.bindVertexArray(ch.vao);
      gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0);
    });
    if (rocketCh) {
      var lift = launched ? Math.pow(Math.max(0, (now - launched) / 1000 - 1), 2) * 2.4 : 0;
      gl.uniform3f(U.uOff, 0, lift, 0);
      gl.bindVertexArray(rocketCh.vao);
      gl.drawElements(gl.TRIANGLES, rocketCh.count, gl.UNSIGNED_INT, 0);
      if (launched && lift > 300 && !ended) { ended = true; finish(); }
      rocketLift = lift;
    }
    gl.bindVertexArray(null);
    overlay(now, open);
    requestAnimationFrame(frame);
  }
  var skyVao = null, curPix = PIX, rocketCh = null, rocketLift = 0, ended = false, cityName = "";

  function lids(u) {
    var keys = [[0, 0], [1.2, 0], [1.9, 0.3], [2.4, 0.04], [3.2, 0.6], [3.6, 0.15], [5, 1], [99, 1]];
    for (var i = 1; i < keys.length; i += 1) {
      if (u <= keys[i][0]) { var a = keys[i - 1], b = keys[i], t = (u - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t); }
    }
    return 1;
  }

  /* Over the view: the crosshair, the eyelids and the opening's lines, the smoke. */
  function overlay(now, open) {
    var c = hud.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1), W = hud.width / dpr, H = hud.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // Smoke from the wreck, and from the rocket going up.
    var src = launched ? [wreck.x + 0.5, wreck.y + rocketLift, wreck.z + 0.5] : [wreck.x + 0.5, wreck.y + 2, wreck.z + 0.5];
    for (var k = 0; k < (launched ? 60 : 22); k += 1) {
      var life = ((now / 1000 * (launched ? 2.5 : 1) + k * 0.41) % 8) / 8;
      var p = [src[0] + Math.sin(k * 2.3) * (0.3 + life * (launched ? 9 : 3)), src[1] - (launched ? life * 30 : -life * 18), src[2] + Math.cos(k * 1.9) * (0.3 + life * 3)];
      var q = [0, 0, 0, 0];
      for (var i = 0; i < 4; i++) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; }
      if (q[3] <= 0.3) { continue; }
      var x = (q[0] / q[3] * 0.5 + 0.5) * W, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * H, s = Math.max(2, Math.min(launched ? 30 : 14, (0.4 + life * 2) * H / q[3] * 0.4));
      s = Math.round(s / 2) * 2;
      c.fillStyle = launched && life < 0.15 ? "rgba(255,190,110," + (0.8 * (1 - life / 0.15)) + ")" : "rgba(70,66,64," + (0.45 * (1 - life)).toFixed(3) + ")";
      c.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    }
    if (!intro && !launched && !touchy) {
      c.fillStyle = "rgba(255,255,255,0.8)";
      c.fillRect(W / 2 - 7, H / 2 - 1, 14, 2); c.fillRect(W / 2 - 1, H / 2 - 7, 2, 14);
    }
    if (intro) {
      var shut = (1 - open) * H / 2;
      c.fillStyle = "#050302"; c.fillRect(0, 0, W, shut); c.fillRect(0, H - shut, W, shut);
      var u = (now - intro.t0) / 1000;
      [[0.8, 3.9, intro.lines[0]], [4.3, 7.3, intro.lines[1]], [7.6, 9.6, intro.lines[2]]].forEach(function (sl, i) {
        if (u < sl[0] || u > sl[1]) { return; }
        c.globalAlpha = Math.min(1, (u - sl[0]) / 0.5, (sl[1] - u) / 0.5);
        c.font = i === 2 ? "500 13px ui-monospace, SFMono-Regular, Menlo, monospace" : "italic 400 20px Newsreader, Georgia, serif";
        if ("letterSpacing" in c) { c.letterSpacing = i === 2 ? "0.24em" : "0px"; }
        c.textAlign = "center"; c.textBaseline = "middle"; c.shadowColor = "rgba(0,0,0,0.9)"; c.shadowBlur = 6;
        c.fillStyle = "#f3e9d8";
        c.fillText(i === 2 ? sl[2].toUpperCase() : sl[2], W / 2, H * (i === 2 ? 0.5 : 0.72));
        c.shadowBlur = 0; c.globalAlpha = 1;
      });
    }
    // Where the nearest piece still missing lies: how far, and which way.
    var miss = pieces.filter(function (p) { return found.indexOf(PIECES[p.k].id) < 0; });
    var el = document.getElementById("near");
    if (miss.length && !intro) {
      miss.sort(function (a, b) { return Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z); });
      var m = miss[0], d = Math.hypot(m.x + 0.5 - P.x, m.z + 0.5 - P.z), bear = Math.atan2(m.x + 0.5 - P.x, -(m.z + 0.5 - P.z)) - P.yaw;
      bear = Math.atan2(Math.sin(bear), Math.cos(bear));
      var arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"], ai = Math.round(bear / (Math.PI / 4));
      el.textContent = arrows[(ai + 8) % 8] + " " + PIECES[m.k].name.replace(/^The /, "") + " · " + Math.round(d) + " m" + (m.y > P.y + 4 ? " up" : m.y < P.y - 3 ? " down" : "");
      el.hidden = false;
    } else if (!intro && found.length === PIECES.length && !built) {
      var dw = Math.hypot(wreck.x - P.x, wreck.z - P.z), bw = Math.atan2(wreck.x - P.x, -(wreck.z - P.z)) - P.yaw;
      bw = Math.atan2(Math.sin(bw), Math.cos(bw));
      el.textContent = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][(Math.round(bw / (Math.PI / 4)) + 8) % 8] + " The wreck · " + Math.round(dw) + " m";
      el.hidden = false;
    } else { el.hidden = true; }
    var bb = document.getElementById("build");
    bb.hidden = !(found.length === PIECES.length && !built && Math.hypot(wreck.x - P.x, wreck.z - P.z) < 9);
    document.getElementById("launch").hidden = !(built && !launched);
  }

  /* ---- the rocket ------------------------------------------------------- */

  function buildRocket() {
    if (built || found.length < PIECES.length) { return; }
    built = true;
    store();
    // Its own mesh, so it can rise: a white body, red nose and fins, on the wreck's ground.
    var keep = new Uint8Array(world);
    var rx = wreck.x, rz = wreck.z, ry = wreck.y;
    for (var y = ry; y < ry + 14; y += 1) { for (var z = rz - 2; z <= rz + 2; z += 1) { for (var x = rx - 2; x <= rx + 2; x += 1) { set(x, y, z, B.AIR); } } }
    remeshAt(rx, rz); remeshAt(rx - 2, rz - 2); remeshAt(rx + 2, rz + 2);
    world.fill(0);
    for (y = ry; y < ry + 12; y += 1) {
      var r = y > ry + 9 ? 0 : 1;
      for (z = rz - r; z <= rz + r; z += 1) { for (x = rx - r; x <= rx + r; x += 1) { set(x, y, z, y > ry + 9 ? B.RED : (y - ry) % 4 === 2 && x === rx && z === rz - 1 ? B.GLASS : B.WHITE); } }
    }
    set(rx, ry + 12, rz, B.RED);
    [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(function (d) { set(rx + d[0], ry, rz + d[1], B.RED); set(rx + d[0], ry + 1, rz + d[1], B.RED); });
    meshChunk(Math.floor(rx / CH), Math.floor(rz / CH));
    rocketCh = chunks[Math.floor(rx / CH) + "," + Math.floor(rz / CH)];
    delete chunks[Math.floor(rx / CH) + "," + Math.floor(rz / CH)];
    world.set(keep);
    for (y = ry; y < ry + 14; y += 1) { for (z = rz - 2; z <= rz + 2; z += 1) { for (x = rx - 2; x <= rx + 2; x += 1) { set(x, y, z, B.AIR); } } }
    meshChunk(Math.floor(rx / CH), Math.floor(rz / CH));
    say("The rocket stands on the wreck's ground. Launch when you are clear.", true);
  }
  function launch() {
    if (!built || launched) { return; }
    launched = performance.now();
    // Stand back and watch it go.
    var away = Math.atan2(P.x - wreck.x, -(P.z - wreck.z));
    P.x = wreck.x + Math.sin(away) * 22; P.z = wreck.z - Math.cos(away) * 22;
    for (var y = SY - 2; y > 0; y -= 1) { if (solid(get(Math.floor(P.x), y, Math.floor(P.z)))) { P.y = y + 1; break; } }
    P.yaw = Math.atan2(wreck.x - P.x, -(wreck.z - P.z));
    P.pitch = 0.35;
    var t0 = performance.now();
    (function tilt() { if (!launched) { return; } var u = (performance.now() - t0) / 1000; P.pitch = Math.min(1.1, 0.35 + u * 0.09); if (u < 9) { requestAnimationFrame(tilt); } })();
    say("Lift-off.", true);
  }
  function finish() {
    var end = document.getElementById("end");
    end.hidden = false;
    end.querySelector("h2").textContent = "You found the way off the Earth.";
    end.querySelector("p").textContent = "The rocket built from the pieces you found in " + cityName + " is climbing out of the air. Mars is next.";
  }

  /* ---- what is said ------------------------------------------------------- */

  var sayTimer = 0;
  function say(text, good) {
    var t = document.getElementById("toast");
    t.textContent = text; t.dataset.tone = good ? "good" : "";
    t.classList.add("show");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }
  function drawPieces() {
    document.getElementById("pieces").innerHTML = PIECES.map(function (p) {
      var got = found.indexOf(p.id) >= 0, c = PAL[p.id];
      return '<li data-got="' + got + '"><i style="background:rgb(' + c.join(",") + ')"></i><span>' + p.name.replace(/^The /, "") + '</span></li>';
    }).join("");
    document.getElementById("notes-list").innerHTML = PIECES.map(function (p) {
      return '<li data-got="' + (found.indexOf(p.id) >= 0) + '"><b>' + p.name + '</b> ' + p.where + '</li>';
    }).join("");
  }
  function drawHotbar() {
    document.getElementById("hotbar").innerHTML = HOTBAR.map(function (b, i) {
      return '<button class="slot" data-slot="' + i + '" aria-pressed="' + (mode === "place" && slot === i) + '" aria-label="' + NAMES[b] + '"><i style="background:rgb(' + PAL[b].join(",") + ')"></i></button>';
    }).join("");
    document.querySelectorAll("[data-slot]").forEach(function (el) {
      el.onclick = function (e) { e.stopPropagation(); slot = +el.dataset.slot; setMode("place"); };
    });
  }
  function setMode(m) {
    mode = m;
    document.getElementById("mode").textContent = m === "break" ? "Break" : "Place";
    document.getElementById("mode").setAttribute("aria-pressed", String(m === "place"));
    drawHotbar();
  }

  function store() {
    try { localStorage.setItem(SAVE, JSON.stringify({ city: cityKey, found: found, built: built })); } catch (e) { /* kept only while the page is open */ }
  }

  /* ---- the hand ------------------------------------------------------------ */

  var touchy = false, cityKey = "";
  function wire() {
    var stick = null, look = {};
    var joy = document.getElementById("joy"), knob = joy.querySelector("i");
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("pointerdown", function (e) {
      if (intro) { if (performance.now() - intro.t0 > 600) { intro.t0 -= 9600; } return; }
      if (e.pointerType === "touch") { touchy = true; document.body.dataset.touch = "true"; }
      canvas.setPointerCapture(e.pointerId);
      // The left of a phone's screen is the stick; anywhere else turns the view, and a tap acts.
      if (touchy && e.clientX < window.innerWidth * 0.4 && e.clientY > window.innerHeight * 0.45 && !stick) {
        stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
        joy.style.left = (e.clientX - 50) + "px"; joy.style.top = (e.clientY - 50) + "px"; joy.hidden = false;
        return;
      }
      look[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, button: e.button };
    });
    canvas.addEventListener("pointermove", function (e) {
      if (stick && e.pointerId === stick.id) {
        var dx = e.clientX - stick.x, dy = e.clientY - stick.y, L = Math.min(40, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
        knob.style.transform = "translate(" + Math.cos(a) * L + "px," + Math.sin(a) * L + "px)";
        input.side = Math.cos(a) * L / 40; input.fwd = -Math.sin(a) * L / 40;
        return;
      }
      var l = look[e.pointerId];
      if (!l) { return; }
      var mx = e.clientX - l.x, my = e.clientY - l.y;
      if (Math.abs(e.clientX - l.sx) + Math.abs(e.clientY - l.sy) > 8) { l.moved = true; }
      var k = 0.0055;
      P.yaw += mx * k; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - my * k));
      l.x = e.clientX; l.y = e.clientY;
    });
    var up = function (e) {
      if (stick && e.pointerId === stick.id) { stick = null; input.fwd = input.side = 0; joy.hidden = true; knob.style.transform = ""; return; }
      var l = look[e.pointerId];
      delete look[e.pointerId];
      if (l && !l.moved && performance.now() - l.t < 450) {
        if (touchy) { act(e.clientX, e.clientY, false); }
        else { var r = canvas.getBoundingClientRect(); act(r.left + r.width / 2, r.top + r.height / 2, l.button === 2); }
      }
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    var jb = document.getElementById("jump");
    jb.addEventListener("pointerdown", function (e) { e.preventDefault(); input.jump = true; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { jb.addEventListener(ev, function () { input.jump = false; }); });
    document.getElementById("mode").onclick = function () { setMode(mode === "break" ? "place" : "break"); };
    document.getElementById("build").onclick = buildRocket;
    document.getElementById("launch").onclick = launch;
    document.getElementById("notes-btn").onclick = function () { var n = document.getElementById("notes"); n.hidden = !n.hidden; };
    document.getElementById("again").onclick = function () { try { localStorage.removeItem(SAVE); } catch (e) { /* nothing kept */ } location.reload(); };
    var keyOf = function (e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; };
    document.addEventListener("keydown", function (e) {
      if (intro && performance.now() - intro.t0 > 600) { intro.t0 -= 9600; return; }
      var k = keyOf(e);
      if (["w", "a", "s", "d", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(k) >= 0) { input.keys[k] = true; e.preventDefault(); }
      if (k >= "1" && k <= "5") { slot = +k - 1; setMode("place"); }
      if (k === "e" || k === "q") { setMode(mode === "break" ? "place" : "break"); }
      if (k === "b") { buildRocket(); }
    });
    document.addEventListener("keyup", function (e) { input.keys[keyOf(e)] = false; });
    window.addEventListener("resize", resize);
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(w / curPix)); canvas.height = Math.max(1, Math.round(h / curPix));
    hud.width = Math.round(w * dpr); hud.height = Math.round(h * dpr);
  }

  /* ---- begin ---------------------------------------------------------------- */

  function start(place, saved) {
    cityKey = place.key; cityName = place.name;
    var status = document.getElementById("status");
    status.textContent = "Building " + place.name + " in blocks";
    return fetch(BASE + "grounds/" + place.slug + ".json").then(function (r) {
      if (!r.ok) { throw new Error("no ground for " + place.name); }
      return r.json();
    }).then(function (g) {
      // Let the message show before the work.
      return new Promise(function (done) { setTimeout(function () { done(g); }, 30); });
    }).then(function (g) {
      build(g, place);
      for (var cz = 0; cz < SZ / CH; cz += 1) { for (var cx = 0; cx < SX / CH; cx += 1) { meshChunk(cx, cz); } }
      found = saved && saved.city === place.key ? saved.found || [] : [];
      // What was found before is gone from where it lay.
      pieces.forEach(function (p) { if (found.indexOf(PIECES[p.k].id) >= 0) { set(p.x, p.y, p.z, B.AIR); remeshAt(p.x, p.z); } });
      store();
      document.getElementById("start").hidden = true;
      document.getElementById("where").textContent = place.name;
      drawPieces(); drawHotbar(); setMode("break");
      // You, lying beside the trunk of your tree, the wreck to one side.
      P.x = crash.x + 1.2; P.z = crash.z + 0.6; P.y = crash.y;
      var toWreck = Math.atan2(wreck.x - P.x, -(wreck.z - P.z));
      intro = { t0: performance.now(), yaw0: toWreck - 1.5, turn: 1.5,
                lines: ["Somewhere over " + place.name + ", the descent went wrong.", "You come to under a tree. Your capsule is in pieces.", place.name] };
      document.body.dataset.film = "true";
      requestAnimationFrame(frame);
    });
  }

  function init() {
    canvas = document.getElementById("view");
    hud = document.getElementById("hud");
    gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) { document.getElementById("status").textContent = "This game needs WebGL 2, which this browser does not offer."; return; }
    prog = compile(VS, FS); skyProg = compile(SKY_VS, SKY_FS);
    ["uVP", "uOff", "uPal", "uStyle", "uEye", "uSun", "uT", "uSky", "uHaze"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    ["uInv", "uEye", "uSun", "uSky", "uHaze"].forEach(function (n) { SU[n] = gl.getUniformLocation(skyProg, n); });
    gl.useProgram(prog);
    var pal = new Float32Array(32 * 3), sty = new Int32Array(32);
    for (var i = 0; i < 32; i += 1) { var c = PAL[i] || [255, 0, 255]; pal[i * 3] = c[0]; pal[i * 3 + 1] = c[1]; pal[i * 3 + 2] = c[2]; sty[i] = STYLE[i] || 0; }
    gl.uniform3fv(U.uPal, pal); gl.uniform1iv(U.uStyle, sty);
    gl.enable(gl.DEPTH_TEST);
    skyVao = gl.createVertexArray(); gl.bindVertexArray(skyVao);
    var sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    resize(); wire();
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (e) { saved = null; }
    fetch(BASE + "cityplaces.json").then(function (r) { return r.json(); }).then(function (d) {
      var places = d.places.filter(function (p) { return p.slug && p.n; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      var sel = document.getElementById("city");
      var want = decodeURIComponent((location.hash || "").slice(1)) || (saved && saved.city) || "paris-fr";
      sel.innerHTML = places.map(function (p) { return '<option value="' + p.key + '"' + (p.key === want ? " selected" : "") + '>' + p.name + '</option>'; }).join("");
      document.getElementById("status").textContent = "";
      document.getElementById("begin").disabled = false;
      document.getElementById("begin").onclick = function () {
        var p = places.filter(function (q) { return q.key === sel.value; })[0];
        document.getElementById("begin").disabled = true;
        start(p, saved).catch(function (err) { document.getElementById("status").textContent = "The city could not be built: " + err.message; document.getElementById("begin").disabled = false; });
      };
    }).catch(function () { document.getElementById("status").textContent = "The cities could not be loaded."; });
  }

  // debug() hands the game's state to a test (it changes nothing by itself).
  window.Rocket = { debug: function () { return { P: P, pieces: pieces, found: found, wreck: wreck, act: act, get: get, set: set, remeshAt: remeshAt, buildRocket: buildRocket, launch: launch }; } };
  init();
})();

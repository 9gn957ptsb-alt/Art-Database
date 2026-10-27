/* The homage: the three figures of the impossible triangle, side by side where you come to in the first
   world of a visit (artist, 15 Oct 2026: "Presents 3 structures at the beginning of the first world that
   presents the three figurations of the impossible triangle They should be lined up next to each other and
   be very simple objects, almost like an homage site").

   The figures are homage.json's (scripts/figure_three.py): the first, six bars whose ends meet only down
   the diagonal, the block every place is built of, which closes from above; the second, the third study of
   the figure (the figure and Bent: every point moved along the line of sight by a bow), which closes level; the third, the same six bars made one
   closed thing by a curve, which closes from below. Each is its drawing from one point only, and each
   structure is little more than that point made a place to stand, white, before a limestone support:

     the first   on a pin over a square of limestone, looked down on from a white step;
     the second  on a pin over a limestone plinth, a white stone before it (empty while homage.json has none);
     the third   hung on a thread under the lintel of a limestone gate, looked up at from a white stone.

   From its stone each figure is its drawing exactly. It is drawn in towards that eye as the figure in the
   sky is drawn in towards the eye under your tree (rocket.js, drawnIn): every point moved along its line of
   sight, so that the stone's eye sees the drawing in perspective, near the figure's middle at its own size;
   the map is projective, so its faces stay flat. Off the stone its cuts come apart: near, it opens; back on
   the stone it closes. Looked down on and up at along the slope of the diagonal (35.26°), as the site draws
   its buildings from above and as a person looks up at one from the street.

   The row stands across the turn you make on waking, so the first shot passes the three in order, first,
   second, third, before it comes to the wreck: on level, open ground about ten metres off, set square to the
   blocks, the stones on your side. Nothing in it is arbitrary but where the place has room for it.

   No DOM: Homage.plan sets the blocks into the place's world and gives back the figures as triangles in the
   world, with their tones, for rocket.js to draw, and the stones, for it to say what each is; Node can plan
   it (scripts/check_homage.js). */

(function (root) {
  "use strict";

  var floor = Math.floor, round = Math.round, abs = Math.abs, min = Math.min, max = Math.max, hypot = Math.hypot;
  var SCALE = 0.55;                          // metres to a cell of the figures' lattice: the first is 1.2 m across
  var PIN = 0.3, GAP = 0.3, ROD = 0.016;     // the first's pin over its slab, the third's thread under its lintel
  var SLOPE = Math.atan(Math.SQRT1_2);       // 35.26°, the diagonal's own slope
  var SPACING = 6, LINTEL = 5, CLEAR = 8;    // between the three; the gate's height; the air each needs above
  var SINK = 1;                              // how far the first's square is sunk
  var NAMES = ["The first figure", "The second figure", "The third figure"];
  var EMPTY = "Still being made: its plinth waits for it.";

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var n = hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }

  /* A figure's surface in its own axes (cells of its lattice, z up): positions, each vertex's tone as weights
     of the drawing's grey, black and white, and triangles. Boxes, each face's tone by its axis (x grey,
     y black, z white), or a mesh with its own weights (homage.json's v x1000, w x255, t). */
  function shapeOf(fig) {
    var P = [], W = [], T = [];
    if (fig.boxes) {
      fig.boxes.forEach(function (b) {
        for (var k = 0; k < 3; k += 1) {
          for (var side = 0; side < 2; side += 1) {
            var u = (k + 1) % 3, v = (k + 2) % 3, n = P.length / 3;
            [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(function (q) {
              var p = [0, 0, 0];
              p[k] = b[k + 3 * side]; p[u] = b[u + 3 * q[0]]; p[v] = b[v + 3 * q[1]];
              P.push(p[0], p[1], p[2]);
              W.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
            });
            T.push(n, n + 1, n + 2, n, n + 2, n + 3);
          }
        }
      });
    } else {
      for (var i = 0; i < fig.v.length; i += 1) { P.push(fig.v[i] / 1000); W.push(fig.w[i] / 255); }
      T = fig.t.slice();
    }
    return { P: P, W: W, T: T, scale: fig.scale };
  }

  /* Its drawing: e towards the eye it closes for, u the drawing's up, r its right (in its own axes). */
  function frameOf(fig) {
    var e = unit(fig.eye), u = fig.up ? unit(fig.up) : unit(sub([0, 0, 1], [e[0] * e[2], e[1] * e[2], e[2] * e[2]]));
    return { e: e, u: u, r: cross([-e[0], -e[1], -e[2]], u) };
  }

  /* The figure drawn in towards eye E, its middle at C: a point at (a, b) across its drawing and w towards
     its eye goes to E + (a R + b U + D F) D / (D + w), so from E it is the drawing exactly. */
  function drawIn(shape, fr, E, C) {
    var P = shape.P, n = P.length / 3, abw = new Float64Array(P.length), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], i, k, SC = shape.scale || SCALE;
    for (i = 0; i < n; i += 1) {
      var p = [P[3 * i], P[3 * i + 1], P[3 * i + 2]], q = [dot(p, fr.r) * SC, dot(p, fr.u) * SC, dot(p, fr.e) * SC];
      for (k = 0; k < 3; k += 1) { abw[3 * i + k] = q[k]; lo[k] = min(lo[k], q[k]); hi[k] = max(hi[k], q[k]); }
    }
    var mid = [0, 1, 2].map(function (j) { return (lo[j] + hi[j]) / 2; });
    var F = sub(C, E), D = hypot(F[0], F[1], F[2]);
    F = [F[0] / D, F[1] / D, F[2] / D];
    var U = unit([-F[0] * F[1], 1 - F[1] * F[1], -F[2] * F[1]]), R = cross(F, U), out = new Float32Array(P.length);
    for (i = 0; i < n; i += 1) {
      var a = abw[3 * i] - mid[0], b = abw[3 * i + 1] - mid[1], l = D / (D + abw[3 * i + 2] - mid[2]);
      for (k = 0; k < 3; k += 1) { out[3 * i + k] = E[k] + (a * R[k] + b * U[k] + D * F[k]) * l; }
    }
    return out;
  }
  // Its lowest and highest points.
  function ends(pos) {
    var low = 0, high = 0;
    for (var i = 1; i < pos.length / 3; i += 1) {
      if (pos[3 * i + 1] < pos[3 * low + 1]) { low = i; }
      if (pos[3 * i + 1] > pos[3 * high + 1]) { high = i; }
    }
    return { low: [pos[3 * low], pos[3 * low + 1], pos[3 * low + 2]], high: [pos[3 * high], pos[3 * high + 1], pos[3 * high + 2]] };
  }

  /* Where a figure looked at along slope s (up positive: looked down on) from an eye h above the ground it
     stands on comes to rest: its middle d out along the row's line and y above that ground, so that its
     lowest point is PIN over the ground (rest) or its highest GAP under the lintel (hang), and how far its
     support point lies along the line from its middle. */
  function settle(shape, fr, h, s, hang, top) {
    var t = Math.tan(abs(s)), d = 3, y = 0, along = 0, E = [0, h, 0];
    for (var it = 0; it < 8; it += 1) {
      var C = [0, h + (hang ? 1 : -1) * d * t, -d], pos = drawIn(shape, fr, E, C), q = ends(pos);
      if (hang) { y = top - GAP - (q.high[1] - C[1]); d = (y - h) / t; along = -(q.high[2] - C[2]); }
      else { y = PIN + (C[1] - q.low[1]); d = (h - y) / t; along = -(q.low[2] - C[2]); }
    }
    return { d: d, y: y, along: along };
  }

  // A thin vertical rod from y0 to y1 at (x, z), black.
  function rod(x, z, y0, y1) {
    var P = [], W = [], T = [], r = ROD / 2;
    [[-r, -r], [r, -r], [r, r], [-r, r]].forEach(function (c) { P.push(x + c[0], y0, z + c[1], x + c[0], y1, z + c[1]); W.push(0, 1, 0, 0, 1, 0); });
    for (var k = 0; k < 4; k += 1) { var a = 2 * k, b = 2 * ((k + 1) % 4); T.push(a, b, b + 1, a, b + 1, a + 1); }
    return { P: P, W: W, T: T };
  }
  function join(parts) {
    var P = [], W = [], T = [];
    parts.forEach(function (m) { var n = P.length / 3; P.push.apply(P, Array.prototype.slice.call(m.P)); W.push.apply(W, m.W); m.T.forEach(function (i) { T.push(i + n); }); });
    return { pos: new Float32Array(P), wts: new Float32Array(W), idx: new Uint32Array(T) };
  }

  /* The three, laid out from the middle of the row (cell O) along Fw (away from where you woke, a step of
     the grid) with Rt to its right; null if the place has no room for them there. A row of other figures (the
     unit's studies) passes its own names and the strip's words (row); a figure of blocks (the sphere) is set into
     the place's own grid, its stone before it. */
  function layout(place, B, figs, O, Fw, eyeH, row) {
    row = row || { names: NAMES, strip: "The homage · the three figures of the impossible triangle, each closing from its white stone" };
    var names = row.names, half = (figs.length - 1) / 2;
    var w = place.w, SX = w.SX, SZ = w.SZ, Rt = [-Fw[1], Fw[0]], c0 = O.z * SX + O.x;
    if (O.x < 0 || O.z < 0 || O.x >= SX || O.z >= SZ) { return { why: "off the place" }; }
    var top = w.top[c0], gs = top + 1, sets = [], level = [], seen = {}, cols = [], ok = true, why = "";
    var OKG = {}, foot = place.M && place.M.foot;
    [B.GRASS, B.DIRT, B.PAVE, B.ROAD, B.SAND, B.CONC, B.STONE, B.LIME, B.WHITE, B.RENDER].forEach(function (b) { OKG[b] = 1; });
    // A model's own ground laid round it (gravel, dry grass), not under it.
    ["gravel", "drygrass", "soil", "sand", "paving", "grass"].forEach(function (m) { if (w.mats && w.mats[m]) { OKG[w.mats[m]] = 1; } });
    // (the studies stand by the tree, on the scorched ground round the crash the tree stands in)
    (row.ground || []).forEach(function (b) { OKG[b] = 1; });
    var cell = function (u, v) { return [O.x + u * Fw[0] + v * Rt[0], O.z + u * Fw[1] + v * Rt[1]]; };
    var point = function (u, v, y) { return [O.x + 0.5 + u * Fw[0] + v * Rt[0], y, O.z + 0.5 + u * Fw[1] + v * Rt[1]]; };
    // A column of the row: level with the rest, the ground plain, open to the sky as high as it needs.
    var use = function (u, v, high) {
      var c = cell(u, v), x = c[0], z = c[1], key = x + "," + z;
      if (x < 2 || z < 2 || x >= SX - 2 || z >= SZ - 2) { ok = false; why = why || "edge"; return c; }
      var cc = z * SX + x, t = w.top[cc], g = w.get(x, t, z);
      // A step of a block either way is levelled: the ground raised, or cut down, its own surface on top (for the
      // studies' row by the tree, as much as three: a terrace cut into the ground round the crash).
      if (abs(t - top) > (row.step || 1)) { ok = false; why = why || "level"; return c; }
      if (!OKG[g] || (w.lot && w.lot[cc]) || (foot && foot[cc])) { ok = false; why = why || "ground " + g; return c; }
      for (var y = max(t, top) + 1; y <= top + high; y += 1) { if (w.get(x, y, z) !== B.AIR) { ok = false; why = why || "air " + w.get(x, y, z); return c; } }
      if (!seen[key]) {
        seen[key] = 1; cols.push(c);
        for (var yf = t + 1; yf <= top; yf += 1) { level.push([x, yf, z, g]); }
        for (var yc = top + 1; yc <= t; yc += 1) { level.push([x, yc, z, B.AIR]); }
        if (t > top) { level.push([x, top, z, g]); }
      }
      return c;
    };
    var claimed = {}, set = function (u, v, y, b) { var c = cell(u, v); sets.push([c[0], y, c[1], b]); if (y <= top) { claimed[c[0] + "," + c[1]] = 1; } };
    var out = [], stands = [], labels = [];
    figs.forEach(function (f, i) {
      if (!ok) { return; }   // (no room already: the rest is not worked out)
      var v = (i - half) * SPACING, s = f ? f.look : 0, hang = s < -0.17, rest = s > 0.17;
      if (f && f.blocks) {
        // Its blocks on the row's line, in the ground's own white, each column clear above it; a white stone before it.
        var n = 0;
        f.blocks.forEach(function (c) { n = max(n, c[0] + 1, c[1] + 1, c[2] + 1); });
        var h0 = floor(n / 2);
        f.blocks.forEach(function (c) { use(c[0] - h0, v + c[2] - h0, n + 2); set(c[0] - h0, v + c[2] - h0, gs + c[1], B.WHITE); labels.push([cell(c[0] - h0, v + c[2] - h0), names[i]]); });
        // (its stone as far off as it is across, so from the eye on it the whole of it is in the view, 70 degrees high)
        for (var k0 = -h0 - n + 1; k0 < -h0; k0 += 1) { use(k0, v, 3); }
        set(-h0 - n + 1, v, top, B.WHITE);
        stands.push({ i: i, at: point(-h0 - n + 1, v, gs), eye: point(-h0 - n + 1, v, gs + eyeH), said: f.said, name: names[i] });
        labels.push([cell(-h0 - n + 1, v), "Stand here · " + names[i].toLowerCase()]);
        return;
      }
      if (!f) {
        // The plinth, empty: a block of limestone on a square of it, a white stone three in front.
        for (var a = -1; a <= 1; a += 1) { for (var b = -1; b <= 1; b += 1) { use(a, v + b, 3); set(a, v + b, top, B.LIME); } }
        set(0, v, top + 1, B.LIME);
        use(-3, v, 3); use(-2, v, 3); set(-3, v, top, B.WHITE);
        stands.push({ i: i, at: point(-3, v, gs), eye: point(-3, v, gs + eyeH), said: EMPTY, name: names[i] });
        labels.push([cell(0, v), names[i] + "'s plinth · empty while it is made"], [cell(-3, v), "Stand here · " + names[i].toLowerCase()]);
        return;
      }
      // Looked down on from a step a block high, into a square sunk a block; up at from the ground.
      var lift = rest ? 1 : 0, base = rest ? gs - SINK : gs, h = gs + lift + eyeH - base;
      // (where it settles is the same wherever the row goes, and its drawing-in only moves with the eye: both kept,
      // for the rows a place is searched for)
      var st = f.settled || (f.settled = settle(f.shape, f.frame, h, s || -0.0001, hang, hang ? LINTEL : 0));
      // Level (the second): on a pin over its plinth, its lowest point PIN over the plinth's block, a block over the
      // ground; looked at from its stone a little up, as near level as that leaves it.
      if (!rest && !hang) {
        st = f.level || (f.level = (function () {
          var y = eyeH;
          for (var it = 0; it < 6; it += 1) { y += 1 + PIN - ends(drawIn(f.shape, f.frame, [0, h, 0], [0, y, -3])).low[1]; }
          return { d: 3, y: y, along: 0 };
        })());
      }
      if (!(st.d > 0)) { ok = false; why = why || "mount"; return; }   // (too large to be looked down on from its step)
      var us = -round(st.d + st.along), E = point(us, v, base + h), C = point(us + st.d, v, base + st.y);
      if (us > (rest ? -3 : -2)) { ok = false; why = why || "close"; return; }
      var key = Fw.join(","), rel = (f.drawn = f.drawn || {})[key], pos = new Float32Array(f.shape.P.length);
      if (!rel) {
        var p0 = drawIn(f.shape, f.frame, E, C);
        rel = f.drawn[key] = new Float32Array(p0.length);
        for (var j0 = 0; j0 < p0.length; j0 += 1) { rel[j0] = p0[j0] - E[j0 % 3]; }
      }
      for (var j1 = 0; j1 < pos.length; j1 += 1) { pos[j1] = rel[j1] + E[j1 % 3]; }
      var q = ends(pos);
      // The figure's own columns, open; then its support.
      var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (var j = 0; j < pos.length / 3; j += 1) { x0 = min(x0, pos[3 * j]); x1 = max(x1, pos[3 * j]); z0 = min(z0, pos[3 * j + 2]); z1 = max(z1, pos[3 * j + 2]); }
      for (var X = floor(x0); X <= floor(x1); X += 1) {
        for (var Z = floor(z0); Z <= floor(z1); Z += 1) {
          var uu = (X - O.x) * Fw[0] + (Z - O.z) * Fw[1], vv = (X - O.x) * Rt[0] + (Z - O.z) * Rt[1];
          use(uu, vv, CLEAR);
        }
      }
      var parts = [{ P: pos, W: f.shape.W, T: f.shape.T }];
      if (hang) {
        for (var g = -2; g <= 2; g += 1) { use(0, v + g, LINTEL + 2); set(0, v + g, top + LINTEL + 1, B.LIME); }
        for (var y = top + 1; y <= top + LINTEL; y += 1) { set(0, v - 2, y, B.LIME); set(0, v + 2, y, B.LIME); }
        parts.push(rod(q.high[0], q.high[2], q.high[1], gs + LINTEL));
        labels.push([cell(0, v - 2), names[i] + "'s gate · looked up at from the white stone"], [cell(0, v + 2), names[i] + "'s gate · looked up at from the white stone"]);
      } else if (rest) {
        for (var a2 = -2; a2 <= 2; a2 += 1) {
          for (var b2 = -2; b2 <= 2; b2 += 1) {
            var inner = abs(a2) < 2 && abs(b2) < 2, cc = use(a2, v + b2, CLEAR);
            if (inner) { set(a2, v + b2, top, B.AIR); set(a2, v + b2, top - 1, B.LIME); } else { set(a2, v + b2, top, B.LIME); }
            labels.push([cc, names[i] + "'s square · looked down on from the white step"]);
          }
        }
        parts.push(rod(q.low[0], q.low[2], base, q.low[1]));
      } else {
        for (var a3 = -1; a3 <= 1; a3 += 1) { for (var b3 = -1; b3 <= 1; b3 += 1) { use(a3, v + b3, CLEAR); set(a3, v + b3, top, B.LIME); } }
        set(0, v, top + 1, B.LIME);
        parts.push(rod(q.low[0], q.low[2], gs + 1, q.low[1]));
        labels.push([cell(0, v), names[i] + "'s plinth · looked at from the white stone"]);
      }
      // The way from the stone to it, open, and the stone: a white step, or white in the ground.
      for (var k = us; k <= -2; k += 1) { use(k, v, rest ? 4 : CLEAR); }
      set(us, v, rest ? top + 1 : top, B.WHITE);
      labels.push([cell(us, v), "Stand here · " + names[i].toLowerCase() + " closes from this stone"]);
      // Nothing between the eye and the figure.
      var n = 24;
      for (var m = 1; m < n; m += 1) {
        var t = m / n, p = [E[0] + (C[0] - E[0]) * t, E[1] + (C[1] - E[1]) * t, E[2] + (C[2] - E[2]) * t];
        if (w.SOLID[w.get(floor(p[0]), floor(p[1]), floor(p[2]))] && !(floor(p[1]) <= top)) { ok = false; why = why || "sight"; }
      }
      out.push({ i: i, name: names[i], parts: parts, eye: E, centre: C, look: s });
      stands.push({ i: i, at: point(us, v, gs + lift), eye: E, said: f.said, name: names[i] });
    });
    // The line they stand on, one site: a strip of limestone in the ground from the first to the last.
    for (var sv = -half * SPACING - 2; sv <= half * SPACING + 2; sv += 1) {
      for (var su = -1; su <= 1; su += 1) {
        var sc = cell(su, sv);
        if (claimed[sc[0] + "," + sc[1]]) { continue; }
        use(su, sv, 3); set(su, sv, top, B.LIME);
        labels.unshift([sc, row.strip]);   // (first, so a figure's own words win where they share a column)
      }
    }
    if (!ok) { return { why: why }; }
    out.forEach(function (f) { f.mesh = join(f.parts); delete f.parts; });
    return { sets: level.concat(sets), levelled: level.length, cols: cols, figures: out, stands: stands, labels: labels, top: top };
  }

  /* Plan the homage in the place: from where you wake (wake, feet) and the way you first face (yaw), the row
     across the turn to the wreck; its blocks set into the world. data is homage.json; opt.eye the eye's
     height. Null where there is no room. */
  function plan(place, data, opt) {
    var w = place.w, B = opt.B || root.RocketPlace.B, eyeH = opt.eye || 1.62, wake = opt.wake, wr = place.wreck, tr = place.tree || place.crash;
    var figs = [data.one, data.two, data.three].map(function (f, i) {
      if (!f) { return null; }
      return { shape: shapeOf(f), frame: frameOf(f), look: f.look !== undefined ? f.look * Math.PI / 180 : (i === 2 ? -SLOPE : i === 0 ? SLOPE : 0), said: f.said || "" };
    });
    var target = opt.yaw + 0.55, best = null, turns = [];
    for (var k = 0; k <= 22; k += 1) { turns.push(k * 0.12); if (k) { turns.push(-k * 0.12); } }
    turns.forEach(function (dt) {
      // Not toward the wreck, nor back across it.
      var off = Math.atan2(Math.sin(target + dt - opt.yaw - 1.5), Math.cos(target + dt - opt.yaw - 1.5));
      if (abs(off) < 0.45) { return; }
      [9, 10, 8, 11, 7, 12, 13, 6, 14, 15].forEach(function (rho) {
        if (best && abs(dt) + 0.08 * abs(rho - 9) >= best.score) { return; }
        var th = target + dt, sx = Math.sin(th), sz = -Math.cos(th);
        var Fw = abs(sx) > abs(sz) ? [sx > 0 ? 1 : -1, 0] : [0, sz > 0 ? 1 : -1];
        var O = { x: floor(wake.x + rho * sx), z: floor(wake.z + rho * sz) };
        var L = layout(place, B, figs, O, Fw, eyeH);
        if (L.why !== undefined) { if (opt.why) { opt.why[L.why] = (opt.why[L.why] || 0) + 1; } return; }
        // Clear of the wreck and the tree, and seen from where you wake.
        var near = L.cols.some(function (c) { return hypot(c[0] + 0.5 - wr.x, c[1] + 0.5 - wr.z) < 6.5 || hypot(c[0] + 0.5 - tr.x, c[1] + 0.5 - tr.z) < 3; });
        if (near) { if (opt.why) { opt.why.near = (opt.why.near || 0) + 1; } return; }
        var hid = 0, W0 = [wake.x, wake.y + eyeH, wake.z];
        L.figures.concat(L.stands).forEach(function (f) {
          var C = f.centre || f.at;
          for (var m = 2; m < 30; m += 1) {
            var t = m / 30, p = [W0[0] + (C[0] - W0[0]) * t, W0[1] + (C[1] + 0.3 - W0[1]) * t, W0[2] + (C[2] - W0[2]) * t];
            if (w.SOLID[w.get(floor(p[0]), floor(p[1]), floor(p[2]))] && floor(p[1]) > L.top) { hid += 1; break; }
          }
        });
        var score = abs(dt) + 0.08 * abs(rho - 9) + 0.3 * hid + 0.02 * L.levelled;
        if (!best || score < best.score) { best = { score: score, L: L, O: O, Fw: Fw, theta: th, rho: rho, hid: hid }; }
      });
    });
    if (!best) { return null; }
    var L = best.L;
    L.sets.forEach(function (s) { w.set(s[0], s[1], s[2], s[3]); });
    // Each column's highest block to stand on, as the place keeps it.
    L.cols.concat(L.sets.map(function (s) { return [s[0], s[2]]; })).forEach(function (c) {
      var x = c[0], z = c[1], y = w.SY - 1;
      while (y > 0 && !w.SOLID[w.get(x, y, z)]) { y -= 1; }
      w.top[z * w.SX + x] = y;
    });
    var at = {};
    L.labels.forEach(function (l) { at[l[0][0] + "," + l[0][1]] = l[1]; });
    var xs = L.sets.map(function (s) { return s[0]; }), zs = L.sets.map(function (s) { return s[2]; });
    return { figures: L.figures, stands: L.stands, at: at, top: L.top, row: { x: best.O.x, z: best.O.z, along: best.Fw, theta: best.theta, rho: best.rho, hidden: best.hid },
             box: [min.apply(null, xs), min.apply(null, zs), max.apply(null, xs), max.apply(null, zs)] };
  }

  /* The unit's studies in a row beside the tree you wake under (artist, 21 Oct 2026: "I want those units [studies] to
     be placed in holographic Mr. [Pearl] right next to the tree lined up next to each other"): data is studies.json
     (scripts/unit_studies.py). The row runs square to the blocks, as near the trunk as the place leaves room, its
     stones toward the tree, clear of the wreck, of the homage (opt.avoid, its box) and of the tree's own ground;
     its blocks set into the world as the homage's are. Null where there is no room. */
  function row(place, data, opt) {
    // near the tree first (within twelve metres), and there without the sphere (six blocks across) if it leaves no
    // room; only then further out
    var all = data.studies, some = all.filter(function (f) { return !f.blocks; }), tries = [[all, 4, 12, 1], [some, 4, 12, 1], [all, 14, 30, 2], [some, 14, 30, 2]];
    for (var k = 0; k < tries.length; k += 1) {
      if (k % 2 && some.length === all.length) { continue; }
      var r = rowOf(place, tries[k][0], opt, tries[k][1], tries[k][2], tries[k][3]);
      if (r) { return r; }
    }
    return null;
  }
  function rowOf(place, studies, opt, near, far, step) {
    var w = place.w, B = opt.B || root.RocketPlace.B, eyeH = opt.eye || 1.62, wr = place.wreck, tr = place.tree || place.crash, av = opt.avoid;
    var figs = studies.map(function (f) {
      if (f.blocks) { return { blocks: f.blocks, said: f.said || "" }; }
      return { shape: shapeOf(f), frame: frameOf(f), look: (f.look || 0) * Math.PI / 180, said: f.said || "" };
    });
    var names = studies.map(function (f) { return f.name; }), best = null;
    var info = { names: names, strip: "The unit's studies · each the result of one, set by its relations", ground: [B.SCORCH], step: 3 };
    [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(function (Fw) {
      for (var rho = near; rho <= far; rho += step) {
        for (var side = -14; side <= 14; side += 2) {
          if (best && rho + 0.25 * abs(side) >= best.score) { continue; }
          var Rt = [-Fw[1], Fw[0]], O = { x: floor(tr.x + Fw[0] * rho + Rt[0] * side), z: floor(tr.z + Fw[1] * rho + Rt[1] * side) };
          var L = layout(place, B, figs, O, Fw, eyeH, info);
          if (L.why !== undefined) { if (opt.why) { opt.why[L.why] = (opt.why[L.why] || 0) + 1; } continue; }
          var crowd = L.cols.some(function (c) {
            return hypot(c[0] + 0.5 - wr.x, c[1] + 0.5 - wr.z) < 6.5 || hypot(c[0] + 0.5 - tr.x, c[1] + 0.5 - tr.z) < 3 ||
              (av && c[0] >= av[0] - 3 && c[0] <= av[2] + 3 && c[1] >= av[1] - 3 && c[1] <= av[3] + 3);
          });
          if (crowd) { if (opt.why) { opt.why.near = (opt.why.near || 0) + 1; } continue; }
          var score = rho + 0.25 * abs(side) + 0.02 * L.levelled;
          if (!best || score < best.score) { best = { score: score, L: L, O: O, Fw: Fw, rho: rho }; }
        }
      }
    });
    if (!best) { return null; }
    var L = best.L;
    L.sets.forEach(function (st) { w.set(st[0], st[1], st[2], st[3]); });
    L.cols.concat(L.sets.map(function (st) { return [st[0], st[2]]; })).forEach(function (c) {
      var x = c[0], z = c[1], y = w.SY - 1;
      while (y > 0 && !w.SOLID[w.get(x, y, z)]) { y -= 1; }
      w.top[z * w.SX + x] = y;
    });
    var at = {};
    L.labels.forEach(function (l) { at[l[0][0] + "," + l[0][1]] = l[1]; });
    var xs = L.sets.map(function (st) { return st[0]; }), zs = L.sets.map(function (st) { return st[2]; });
    return { figures: L.figures, stands: L.stands, at: at, top: L.top, row: { x: best.O.x, z: best.O.z, along: best.Fw, rho: best.rho },
             box: [min.apply(null, xs), min.apply(null, zs), max.apply(null, xs), max.apply(null, zs)], studies: studies };
  }

  // What a block of the homage is, for the crosshair; "" for any other.
  function label(h, x, y, z) {
    return h && y >= h.top ? h.at[x + "," + z] || "" : "";
  }
  // The stone you stand on, if any: within a step of its middle, at its height.
  function standing(h, x, y, z) {
    if (!h) { return null; }
    for (var i = 0; i < h.stands.length; i += 1) {
      var s = h.stands[i];
      if (hypot(x - s.at[0], z - s.at[2]) < 0.4 && abs(y - s.at[1]) < 0.3) { return s; }
    }
    return null;
  }

  var api = { plan: plan, row: row, label: label, standing: standing, shapeOf: shapeOf, frameOf: frameOf, drawIn: drawIn, SCALE: SCALE };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.Homage = api; }
})(typeof window !== "undefined" ? window : this);

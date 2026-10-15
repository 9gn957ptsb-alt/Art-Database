/* New forms, from the Architectural Authority's projects taken apart.

   scripts/build_sections.js breaks every building the site has modelled into
   the sections it is made of (sections.json): its volumes, each named by the
   space it is (the ground floor, a wing, the long wing, the glass pavilion,
   the hall, the tower, the block, the upper box, the cantilevered box, the
   lookout, the room of an interior drawn as a cutaway), its roofs, its
   features (a screen, slats, fins, a colonnade, a pergola, a canopy, a wall),
   its pools, its terraces and its garden. Here they are put together in ways
   their architects never did:

   - form(S, seed): a house or a pavilion of new parts. One project's volume
     on the ground; another's wings against it, flush with its end, centred
     on it or running on past it; a third's upper box on top, run out past
     its edge as far as it ran out in its own building; a fourth's roof over
     the highest, or a lookout; a fifth's screen across a face, or its
     pergola off one; a pool slid under the overhang, a terrace, and the
     trees of a garden round it all.
   - tower(S, seed, w, d, h): a building for one of a city's lots: a ground
     floor from one project, storeys from another (its bays and its storeys
     repeated to the lot's size and height), a crown from a third, a screen
     or fins up its face from a fourth.

   A section is stretched as a nine-slice is: its ends kept and its middle
   repeated, so a wing grows by its own bays and a block by its own storeys;
   it turns by quarter turns. A roof is drawn again at its new size from its
   own shape, at its own pitch, and a tree from its own (models.js).

   What comes back is in blocks, a metre each: the grid (x fastest, then y,
   then z, as models.js has it), its materials, which placement each block
   came from, and the recipe, what came from which project.

   No DOM: window.Forms in the page, module.exports in Node. It needs
   models.js (Models) for the roofs and the trees. */

(function (root) {
  "use strict";

  var floor = Math.floor, round = Math.round, min = Math.min, max = Math.max, ceil = Math.ceil;

  function rng(seed) {
    var s = (floor(seed) >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function clamp(v, a, b) { return max(a, min(b, v)); }
  function pick(r, list) { return list && list.length ? list[floor(r() * list.length)] : null; }
  function shuffle(list, r) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i -= 1) { var j = floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---- the sections ---------------------------------------------------------- */

  var NOT_BODY = /berm|plinth|room|lobby|sails|lookout/;
  var STAND = { screen: 1, slats: 1, fins: 1, colonnade: 1, "corten panel": 1, "glass wall": 1, "curtain wall": 1, wall: 1, walls: 1 };
  var COVER = { pergola: 1, canopy: 1, frame: 1, "floor slabs": 1 };

  // The sections sorted by what each can be in a new form.
  function load(json) {
    var all = json.sections, S = { projects: json.projects, sections: all, cache: {} };
    var of = function (f) { return all.filter(f); };
    var area = function (s) { return s.n[0] * s.n[1]; }, long = function (s) { return max(s.n[0], s.n[1]); }, short = function (s) { return min(s.n[0], s.n[1]); };
    S.base = of(function (s) { return s.kind === "volume" && s.role === "ground" && !NOT_BODY.test(s.noun) && short(s) >= 4 && s.n[2] >= 3 && long(s) <= 64 && area(s) >= 30; });
    S.upper = of(function (s) { return s.kind === "volume" && s.role === "upper" && !NOT_BODY.test(s.noun) && s.n[2] >= 2 && area(s) >= 30 && long(s) <= 48; });
    S.lookout = of(function (s) { return s.kind === "volume" && s.role === "lookout" && area(s) >= 9 && s.n[2] >= 2 && long(s) <= 12; });
    S.roofs = of(function (s) { return s.kind === "roof" && s.shape; });
    S.stand = of(function (s) { return s.kind === "feature" && STAND[s.noun] && s.n[2] >= 2 && long(s) >= 4; });
    S.cover = of(function (s) { return s.kind === "feature" && COVER[s.noun] && long(s) >= 4 && short(s) >= 2; });
    S.pools = of(function (s) { return s.kind === "pool" && s.noun !== "lake" && s.n[2] <= 2 && short(s) >= 2; });
    S.terraces = of(function (s) { return s.kind === "terrace" && s.n[2] <= 2 && area(s) >= 16 && short(s) >= 2; });
    S.storeys = of(function (s) { return s.kind === "volume" && !NOT_BODY.test(s.noun) && s.n[2] >= 3 && short(s) >= 4 && long(s) <= 64; });
    S.gardens = [];
    json.projects.forEach(function (p, i) { if (p.garden && p.garden.trees && p.garden.trees.length >= 2) { S.gardens.push(i); } });
    return S;
  }

  // A section's blocks: 0 nothing, else its material's place in mats, plus one.
  function stampOf(S, s) {
    if (S.cache[s.id]) { return S.cache[s.id]; }
    var nx = s.n[0], ny = s.n[1], nz = s.n[2], v = new Uint8Array(nx * ny * nz), d = s.d, i = 0, p = 0;
    while (i < d.length) {
      var c = d.charCodeAt(i) - 65, run = 0;
      i += 1;
      while (i < d.length && d.charCodeAt(i) < 65) { run = run * 10 + d.charCodeAt(i) - 48; i += 1; }
      run = run || 1;
      if (c) { v.fill(c, p, p + run); }
      p += run;
    }
    S.cache[s.id] = { nx: nx, ny: ny, nz: nz, v: v, mats: s.mats, glass: s.mats.indexOf("glass") >= 0 };
    return S.cache[s.id];
  }

  // Parts drawn in blocks by models.js, cropped to what they fill; their size is their own, not stretched.
  function drawn(parts, site) {
    var vx = root.Models.voxelize({ voxel: 1, site: site, parts: parts }), plane = vx.nx * vx.ny, top = 0;
    for (var q = vx.grid.length - 1; q >= 0; q -= 1) { if (vx.grid[q]) { top = floor(q / plane) + 1; break; } }
    return { nx: vx.nx, ny: vx.ny, nz: max(1, top), v: vx.grid, mats: vx.names, fixed: true };
  }

  // A roof drawn again over w × d at its own pitch, its ridge along the longer side.
  function roofOver(s, w, d, r) {
    var sh = s.shape, part, x = -w / 2, y = -d / 2;
    if (sh.t === "dome") {
      part = { dome: [0, 0, 0, max(1.5, min(w, d) / 2 - 0.5)], m: sh.m };
    } else {
      var along = w >= d ? "x" : "y", span0, span;
      if (sh.t === "gable") { span0 = sh.axis === "y" ? sh.w : sh.d; span = along === "x" ? d : w; }
      else { span0 = min(sh.w, sh.d); span = min(w, d); }
      var pitch = sh.h / max(1, span0);
      var h = sh.thick ? clamp(pitch * span, 0.6, 5) : clamp(pitch * span, 1, max(2, min(9, sh.h * 1.8)));
      if (sh.t === "gable") { part = { gable: [x, y, 0, w, d, h], axis: along, m: sh.m }; }
      else if (sh.t === "hip") { part = { hip: [x, y, 0, w, d, h], m: sh.m }; }
      else {
        // A slab a block thick at least, or it would fall through the blocks in holes.
        part = { shed: [x, y, 0, w, d, h], rise: (r() < 0.5 ? "+" : "-") + (w >= d ? "y" : "x"), m: sh.m };
        if (sh.thick) { part.thick = max(1, sh.thick); }
      }
    }
    return drawn([part], [w, d]);
  }

  // A tree of a project's garden, as models.js grows it; an odd site keeps its trunk one block wide.
  function treeOf(t) {
    var R = clamp(t.r, 1, 6), s = 2 * ceil(R) + 3;
    return drawn([{ tree: [0, 0, clamp(t.h, 3, 16), R], shape: t.shape, trunk: t.trunk, m: t.m }], [s, s]);
  }

  /* ---- putting them together --------------------------------------------------- */

  // How n blocks are made t long: their ends kept (lo at the start, hi at the end), the middle
  // repeated, or cut short, as a nine-slice is.
  function slice(n, t, lo, hi) {
    var m = new Int32Array(max(0, t)), mid = n - lo - hi;
    for (var i = 0; i < t; i += 1) {
      if (t === n) { m[i] = i; }
      else if (mid <= 0 || t <= lo + hi) { m[i] = min(n - 1, floor((i + 0.5) * n / t)); }
      else { m[i] = i < lo ? i : i >= t - hi ? n - (t - i) : lo + (i - lo) % mid; }
    }
    return m;
  }
  function ends(n) { return n >= 12 ? 3 : n >= 6 ? 2 : n >= 3 ? 1 : 0; }

  function Form(S) { this.S = S; this.placed = []; }
  Form.prototype.add = function (P) { P.i = this.placed.length; this.placed.push(P); return P; };
  // A section, its own x made sx long and its own y sy, turned t quarter turns: w × d in the form.
  Form.prototype.put = function (s, t, sx, sy, h, o) {
    var st = stampOf(this.S, s), P = { st: st, sec: s, from: this.S.projects[s.p].name, of: the(this.S.projects[s.p].name), r: t & 3, w: t & 1 ? sy : sx, d: t & 1 ? sx : sy, h: h || st.nz, x: 0, y: 0, z: 0 };
    for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { P[k] = o[k]; } }
    return this.add(P);
  };
  Form.prototype.shape = function (st, s, o) {
    var P = { st: st, sec: s, from: s ? this.S.projects[s.p].name : "", r: 0, w: st.nx, d: st.ny, h: st.nz, x: 0, y: 0, z: 0 };
    for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { P[k] = o[k]; } }
    if (P.garden !== undefined) { P.from = this.S.projects[P.garden].name; }
    P.of = the(P.from);
    return this.add(P);
  };

  // The quarter turns that lay a stamp's long side along an axis of the form ("x" or "y"), either way round.
  function turnTo(st, axis, r) { return ((st.nx >= st.ny ? "x" : "y") === axis ? 0 : 1) + (r() < 0.5 ? 2 : 0); }
  // A stamp's own size for w × d in the form, turned t.
  function own(t, w, d) { return t & 1 ? [d, w] : [w, d]; }
  // Its own height, or a storey more now and then: one more of what repeats.
  function heightOf(st, r, p) { return st.nz >= 3 && r() < p ? 2 * st.nz - 1 : st.nz; }

  // Against side s of P (0 east, 1 south, 2 west, 3 north), a along it, ov blocks into it.
  function against(P, Q, s, a, ov) {
    if (s === 0) { Q.x = P.x + P.w - ov; Q.y = P.y + a; }
    else if (s === 2) { Q.x = P.x - Q.w + ov; Q.y = P.y + a; }
    else if (s === 1) { Q.y = P.y + P.d - ov; Q.x = P.x + a; }
    else { Q.y = P.y - Q.d + ov; Q.x = P.x + a; }
  }
  function faceLength(P, s) { return s % 2 === 0 ? P.d : P.w; }
  function faceAxis(s) { return s % 2 === 0 ? "y" : "x"; }

  // A section from a project not drawn on yet if there is one: a project first, then one of its sections.
  function chooser(r, used) {
    return function (list, ok) {
      var by = {}, keys = [];
      list.forEach(function (s) {
        if (ok && !ok(s)) { return; }
        if (!by[s.p]) { by[s.p] = []; keys.push(s.p); }
        by[s.p].push(s);
      });
      if (!keys.length) { return null; }
      var fresh = keys.filter(function (p) { return !used[p]; }), p = pick(r, fresh.length ? fresh : keys);
      used[p] = (used[p] || 0) + 1;
      return pick(r, by[p]);
    };
  }

  // The blocks every placement fills, in the order put: what comes later stands in what came before.
  function render(F, margin) {
    var m = margin || 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = 1;
    F.placed.forEach(function (P) { x0 = min(x0, P.x); y0 = min(y0, P.y); x1 = max(x1, P.x + P.w); y1 = max(y1, P.y + P.d); z1 = max(z1, P.z + P.h); });
    F.placed.forEach(function (P) { P.x += m - x0; P.y += m - y0; });
    var nx = x1 - x0 + 2 * m, ny = y1 - y0 + 2 * m, nz = z1 + 1, plane = nx * ny;
    var grid = new Uint8Array(plane * nz), from = new Uint8Array(plane * nz), names = [], ids = {};
    var idOf = function (name) { if (!ids[name]) { names.push(name); ids[name] = names.length; } return ids[name]; };
    var glassId = 0;
    F.placed.forEach(function (P) {
      var st = P.st, odd = P.r & 1, tx = odd ? P.d : P.w, ty = odd ? P.w : P.d, fix = !!st.fixed;
      var mx = fix ? null : slice(st.nx, tx, ends(st.nx), ends(st.nx)), my = fix ? null : slice(st.ny, ty, ends(st.ny), ends(st.ny));
      var mz = fix ? null : slice(st.nz, P.h, 0, st.nz >= 3 ? 1 : 0), mat = [];
      for (var k = 0; k < P.h; k += 1) {
        var Z = P.z + k, sk = fix ? k : mz[k];
        if (Z < 0 || Z >= nz || sk >= st.nz) { continue; }
        for (var j = 0; j < P.d; j += 1) {
          for (var i = 0; i < P.w; i += 1) {
            var u, v;
            if (P.r === 0) { u = i; v = j; } else if (P.r === 1) { u = j; v = ty - 1 - i; } else if (P.r === 2) { u = tx - 1 - i; v = ty - 1 - j; } else { u = tx - 1 - j; v = i; }
            var su = fix ? u : mx[u], sv = fix ? v : my[v];
            if (su >= st.nx || sv >= st.ny) { continue; }
            var val = st.v[(sk * st.ny + sv) * st.nx + su];
            if (!val) { continue; }
            var q = (Z * ny + P.y + j) * nx + P.x + i;
            grid[q] = mat[val] || (mat[val] = idOf(st.mats[val - 1]));
            from[q] = P.i + 1;
          }
        }
      }
    });
    // A wall with no glass of its own is given windows, as the city's buildings have: two blocks
    // square, a pier and a band of wall between, a storey (three blocks) apart.
    F.placed.forEach(function (P) {
      if (!P.glaze) { return; }
      for (var k = P.z + 1; k < P.z + P.h - 1; k += 1) {
        if ((k - P.z) % 3 === 0) { continue; }
        for (var j = P.y; j < P.y + P.d; j += 1) {
          for (var i = P.x; i < P.x + P.w; i += 1) {
            var q = (k * ny + j) * nx + i;
            if (from[q] !== P.i + 1) { continue; }
            var ex = i === 0 || i === nx - 1 || !grid[q - 1] || !grid[q + 1], ey = j === 0 || j === ny - 1 || !grid[q - nx] || !grid[q + nx];
            if (!ex && !ey) { continue; }
            if ((ex ? j - P.y : i - P.x) % 3 === 0) { continue; }
            grid[q] = glassId || (glassId = idOf("glass"));
          }
        }
      }
    });
    return { nx: nx, ny: ny, nz: nz, grid: grid, from: from, names: names, placed: F.placed, ox: m - x0, oy: m - y0 };
  }

  // What is built (not the trees, the pools, the terraces): a door can be cut in it, it is hollowed.
  function built(R) {
    var b = new Uint8Array(R.grid.length);
    for (var q = 0; q < b.length; q += 1) {
      if (R.grid[q] && R.from[q] && R.placed[R.from[q] - 1].built !== false) { b[q] = 1; }
    }
    return b;
  }

  /* ---- what it is made of, in words ----------------------------------------------- */

  var THE = /^(University|Walt|Hotel|Centro|Cl[ií]nica|Pabell|Escala|Justiniano|Minnesota|Allison|Miami|Depart|Suspended)/;
  function the(name) { return THE.test(name) ? "the " + name : name; }
  function short(name) {
    return name.replace(/ (Main Building|Building|Lobby|Space|Wines Winery|Concert Hall|Residence|\(music room\))$/, "").replace(/^Clinica Dental /, "")
               .replace(/^Pabellón Polideportivo /, "").replace(/^Centro Cultural /, "").replace(/^University of /, "");
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // "the long dark wing of Casa Galera"
  function partOf(S, P) { return P.sec.name + " of " + the(S.projects[P.sec.p].name); }
  function listOf(a) { return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  function words(S, R) {
    var by = {};
    R.placed.forEach(function (P) { if (P.role) { (by[P.role] = by[P.role] || []).push(P); } });
    var one = function (role) { return by[role] ? partOf(S, by[role][0]) : ""; };
    var all = function (role) { return (by[role] || []).map(function (P) { return partOf(S, P); }); };
    var out = [];
    if (by.base) {
      out.push(by.upper ? one("upper") + " on " + one("base") : one("base"));
      if (by.wing) { out.push("with " + listOf(all("wing")) + " against it"); }
      if (by.roof) { out.push("under " + listOf(all("roof"))); }
      if (by.lookout) { out.push(one("lookout") + " on top"); }
      if (by.screen) { out.push("behind " + one("screen")); }
      if (by.cover) { out.push(one("cover") + " off its side"); }
      var ground = all("pool").concat(all("terrace"));
      if (ground.length) { out.push(listOf(ground) + " before it"); }
      if (by.tree) { out.push("among trees from the garden of " + the(S.projects[by.tree[0].garden].name)); }
    } else {
      out.push(by.storeys ? one("storeys") + " over " + one("ground") : one("ground"));
      if (by.screen) { out.push("behind " + one("screen")); }
      if (by.roof) { out.push("under " + one("roof")); }
      if (by.lookout) { out.push(one("lookout") + " on top"); }
    }
    // Who gave what: the projects in the order they first come.
    var seen = {}, from = [];
    R.placed.forEach(function (P) {
      var p = P.sec ? P.sec.p : P.garden;
      if (p === undefined || seen[p]) { return; }
      seen[p] = 1;
      from.push(p);
    });
    R.recipe = cap(out.join(", ")) + ".";
    R.sources = from;
    var a = by.upper || by.storeys || by.wing || by.roof || by.screen, b = by.base || by.ground;
    var A = a ? S.projects[a[0].sec.p].name : "", B = b ? S.projects[b[0].sec.p].name : "";
    // Its name: the two it is most made of; one alone, after it.
    R.name = A && A !== B ? short(A) + " × " + short(B) : "After " + short(B);
    return R;
  }

  /* ---- a house or a pavilion ---------------------------------------------------- */

  function form(S, seed, opts) {
    opts = opts || {};
    var r = rng((seed >>> 0) * 2654435761 + 12345), F = new Form(S), used = {}, take = chooser(r, used);
    var cap2 = opts.max || 40, open = shuffle([0, 1, 2, 3], r), shut = {};
    var claim = function (s) { shut[s] = 1; };
    var freeSides = function () { return open.filter(function (s) { return !shut[s]; }); };

    // The volume on the ground, a little bigger or smaller than it was.
    var bs = take(S.base, function (s) { return max(s.n[0], s.n[1]) <= cap2 * 1.4; });
    if (!bs) { return null; }
    var bst = stampOf(S, bs), k = 0.85 + r() * 0.45;
    var B0 = F.put(bs, floor(r() * 4), clamp(round(bst.nx * k), 6, cap2), clamp(round(bst.ny * k), 6, cap2), heightOf(bst, r, 0.25), { role: "base" });

    // Wings against it: along a side or running out from it, flush with an end, centred, or past it.
    var nw = r() < 0.3 ? 0 : r() < 0.65 ? 1 : 2;
    for (var n = 0; n < nw; n += 1) {
      var side = freeSides()[0];
      var ws = take(S.base, function (s) { return max(s.n[0], s.n[1]) <= cap2 * 1.3; });
      if (!ws || side === undefined) { break; }
      var wst = stampOf(S, ws), kw = 0.8 + r() * 0.4, along = r() < 0.6;
      var axis = along ? faceAxis(side) : faceAxis(side) === "x" ? "y" : "x";
      var t = turnTo(wst, axis, r);
      var size = [clamp(round(wst.nx * kw), 4, cap2), clamp(round(wst.ny * kw), 4, cap2)];
      var Q = F.put(ws, t, size[0], size[1], heightOf(wst, r, 0.2), { role: "wing", side: side });
      var L = faceLength(B0, side), l = faceLength(Q, side);
      against(B0, Q, side, pick(r, [0, round((L - l) / 2), L - l, -round(l / 3), L - round(l * 2 / 3)]), floor(r() * 3));
      claim(side);
    }

    // An upper box on top, along the base or across it, run out past one end as far as it ran out
    // in its own building, over open ground if it can.
    var top = B0, U = null;
    if (S.upper.length && r() < 0.72) {
      var us = take(S.upper), ust = stampOf(S, us), baseLong = B0.w >= B0.d ? "x" : "y";
      var ax = r() < 0.35 ? (baseLong === "x" ? "y" : "x") : baseLong;
      var reach = clamp(round(us.reach > 1 ? us.reach : 2 + r() * 5), 2, 9);
      var Lb = ax === "x" ? B0.w : B0.d, Wb = ax === "x" ? B0.d : B0.w;
      var len = clamp(round(Lb * (0.55 + r() * 0.45)) + reach, 6, cap2 + 10);
      var wid = clamp(round(min(ust.nx, ust.ny) * (0.85 + r() * 0.3)), 4, Wb + 4);
      var tu = turnTo(ust, ax, r), su = own(tu, ax === "x" ? len : wid, ax === "x" ? wid : len);
      U = F.put(us, tu, su[0], su[1], heightOf(ust, r, 0.15), { role: "upper", z: B0.z + B0.h, reach: reach });
      var dir = r() < 0.5 ? 1 : -1, end = ax === "x" ? (dir > 0 ? 0 : 2) : (dir > 0 ? 1 : 3);
      if (shut[end] && !shut[(end + 2) % 4]) { dir = -dir; end = (end + 2) % 4; }
      if (ax === "x") { U.x = dir > 0 ? B0.x + B0.w + reach - U.w : B0.x - reach; U.y = B0.y + round((B0.d - U.d) * r()); }
      else { U.y = dir > 0 ? B0.y + B0.d + reach - U.d : B0.y - reach; U.x = B0.x + round((B0.w - U.w) * r()); }
      U.out = end;
      top = U;
    }

    // Over the highest, a lookout, or another project's roof drawn again to its size; a wing a roof of its own now and then.
    var look = null;
    if (S.lookout.length && r() < (U ? 0.18 : 0.3)) {
      var ls = take(S.lookout), lst = stampOf(S, ls);
      look = F.put(ls, floor(r() * 4), lst.nx, lst.ny, lst.nz, { role: "lookout", z: top.z + top.h });
      look.x = top.x + floor(r() * max(1, top.w - look.w + 1));
      look.y = top.y + floor(r() * max(1, top.d - look.d + 1));
    } else if (S.roofs.length && r() < 0.62) {
      var rs = take(S.roofs);
      F.shape(roofOver(rs, top.w, top.d, r), rs, { role: "roof", x: top.x, y: top.y, z: top.z + top.h });
    }
    F.placed.filter(function (P) { return P.role === "wing"; }).forEach(function (Q2) {
      if (!S.roofs.length || r() >= 0.3) { return; }
      var rs2 = take(S.roofs);
      F.shape(roofOver(rs2, Q2.w, Q2.d, r), rs2, { role: "roof", x: Q2.x, y: Q2.y, z: Q2.z + Q2.h });
    });

    // A screen, slats, fins or a colonnade across one face, a block or none out from it.
    if (S.stand.length && r() < 0.65) {
      var on = U && r() < 0.5 ? U : B0;
      var sides = on === B0 ? freeSides() : [0, 1, 2, 3].filter(function (s) { return s !== U.out; });
      var sd = pick(r, sides.length ? sides : [0, 1, 2, 3]), fl = faceLength(on, sd) - 2;
      var fs = fl >= 4 ? take(S.stand) : null;
      if (fs) {
        var fst = stampOf(S, fs), thick = clamp(min(fst.nx, fst.ny), 1, 2), tf = turnTo(fst, faceAxis(sd), r);
        var sf = own(tf, faceAxis(sd) === "x" ? fl : thick, faceAxis(sd) === "x" ? thick : fl);
        var Sc = F.put(fs, tf, sf[0], sf[1], on.h, { role: "screen", z: on.z, side: sd });
        against(on, Sc, sd, 1, r() < 0.5 ? -1 : 0);
        if (on === B0) { claim(sd); }
      }
    }
    // A pergola, a canopy or a frame off a side of the base, its top at the base's top.
    if (S.cover.length && r() < 0.4 && freeSides().length) {
      var sc = freeSides()[0], cs = take(S.cover), cst = stampOf(S, cs);
      var cl = faceLength(B0, sc), dep = clamp(min(cst.nx, cst.ny), 3, 8), tc = turnTo(cst, faceAxis(sc), r);
      var scv = own(tc, faceAxis(sc) === "x" ? cl : dep, faceAxis(sc) === "x" ? dep : cl);
      var Cv = F.put(cs, tc, scv[0], scv[1], min(cst.nz, B0.h), { role: "cover", side: sc });
      Cv.z = max(0, B0.h - Cv.h);
      against(B0, Cv, sc, 0, 0);
      claim(sc);
    }

    // The ground: a pool slid under the overhang, or before an open side; a terrace before another.
    var bounds = function () {
      var b = [1e9, 1e9, -1e9, -1e9];
      F.placed.forEach(function (P) { if (P.built === false) { return; } b[0] = min(b[0], P.x); b[1] = min(b[1], P.y); b[2] = max(b[2], P.x + P.w); b[3] = max(b[3], P.y + P.d); });
      return b;
    };
    var lay = function (P, s, gap, a) {
      var b = bounds();
      if (s === 0) { P.x = b[2] + gap; P.y = B0.y + a; } else if (s === 2) { P.x = b[0] - P.w - gap; P.y = B0.y + a; }
      else if (s === 1) { P.y = b[3] + gap; P.x = B0.x + a; } else { P.y = b[1] - P.d - gap; P.x = B0.x + a; }
    };
    var groundOf = function (list, s, gap, role) {
      var gs = take(list), gst = stampOf(S, gs), face = faceLength(B0, s);
      var gl = clamp(max(gst.nx, gst.ny), 4, face + 6), gd = clamp(min(gst.nx, gst.ny), 3, role === "pool" ? 12 : 9), tg = turnTo(gst, faceAxis(s), r);
      var sg = own(tg, faceAxis(s) === "x" ? gl : gd, faceAxis(s) === "x" ? gd : gl);
      var G = F.put(gs, tg, sg[0], sg[1], gst.nz, { role: role, built: false });
      lay(G, s, gap, round((face - faceLength(G, s)) * r()));
      return G;
    };
    var poolSide = -1;
    if (S.pools.length && r() < 0.6) {
      poolSide = U && r() < 0.7 ? U.out : (freeSides()[0] !== undefined ? freeSides()[0] : floor(r() * 4));
      var under = U && poolSide === U.out;
      if (under) {
        // In under the box as far as it runs out.
        var ps = take(S.pools), pst = stampOf(S, ps), tp = turnTo(pst, faceAxis(poolSide), r), face2 = faceLength(B0, poolSide);
        var pl = clamp(max(pst.nx, pst.ny), 4, face2 + 6), pd = clamp(min(pst.nx, pst.ny), 3, 12);
        var sp = own(tp, faceAxis(poolSide) === "x" ? pl : pd, faceAxis(poolSide) === "x" ? pd : pl);
        var Pl = F.put(ps, tp, sp[0], sp[1], pst.nz, { role: "pool", built: false });
        against(B0, Pl, poolSide, round((face2 - faceLength(Pl, poolSide)) * r()), 0);
      } else { groundOf(S.pools, poolSide, 2, "pool"); }
      claim(poolSide);
    }
    if (S.terraces.length && r() < 0.5) {
      var ts = freeSides()[0] !== undefined ? freeSides()[0] : poolSide >= 0 ? poolSide : floor(r() * 4);
      groundOf(S.terraces, ts, ts === poolSide ? 1 : 0, "terrace");
    }

    // The trees of one garden, round it all, clear of everything else.
    var gp = pick(r, S.gardens);
    if (gp !== null && gp !== undefined) {
      var trees = S.projects[gp].garden.trees, nt = 3 + floor(r() * 6), b = bounds(), rects = F.placed.map(function (P) { return [P.x, P.y, P.x + P.w, P.y + P.d]; });
      for (var tt = 0, tries = 0; tt < nt && tries < 80; tries += 1) {
        var tr = trees[floor(r() * trees.length)], st = treeOf(tr), ang = r() * Math.PI * 2, gap = 2 + r() * 7;
        var cx = (b[0] + b[2]) / 2 + Math.cos(ang) * ((b[2] - b[0]) / 2 + gap), cy = (b[1] + b[3]) / 2 + Math.sin(ang) * ((b[3] - b[1]) / 2 + gap);
        var tx0 = round(cx - st.nx / 2), ty0 = round(cy - st.ny / 2), hit = false;
        for (var q = 0; q < rects.length && !hit; q += 1) {
          var R0 = rects[q];
          // The crown may hang over a neighbour's; the trunk must stand clear.
          var mid = [tx0 + floor(st.nx / 2), ty0 + floor(st.ny / 2)];
          if (mid[0] >= R0[0] - 1 && mid[0] < R0[2] + 1 && mid[1] >= R0[1] - 1 && mid[1] < R0[3] + 1) { hit = true; }
        }
        if (hit) { continue; }
        F.shape(st, null, { role: "tree", garden: gp, built: false, x: tx0, y: ty0 });
        rects.push([tx0 + floor(st.nx / 2), ty0 + floor(st.ny / 2), tx0 + floor(st.nx / 2) + 1, ty0 + floor(st.ny / 2) + 1]);
        tt += 1;
      }
    }

    var R = render(F, opts.margin === undefined ? 2 : opts.margin);
    R.ground = S.projects[bs.p].ground || "grass";
    R.seed = seed;
    return words(S, R);
  }

  /* ---- a building for a lot --------------------------------------------------------- */

  function tower(S, seed, W, D, H, opts) {
    opts = opts || {};
    var r = rng((seed >>> 0) * 2246822519 + 3266489917), F = new Form(S), used = {}, take = chooser(r, used);
    W = max(4, round(W)); D = max(4, round(D)); H = max(3, round(H));
    var lotLong = W >= D ? "x" : "y", low = H <= 7;
    // The ground floor, the whole lot.
    var gs = take(S.base, function (s) { return !opts.only || opts.only(s); });
    if (!gs) { return null; }
    var gst = stampOf(S, gs), tg = turnTo(gst, lotLong, r), sg = own(tg, W, D);
    var gh = low ? H : clamp(gst.nz, 4, 7);
    var G0 = F.put(gs, tg, sg[0], sg[1], gh, { role: "ground", glaze: !gst.glass && gh >= 4 });
    var top = G0;
    if (!low) {
      // Its storeys, set back a little from the street when it is tall.
      var sb = H >= 24 ? floor(r() * 3) : floor(r() * 2), bw = max(4, W - 2 * sb), bd = max(4, D - 2 * sb);
      var bs = take(S.storeys), bst = stampOf(S, bs), tb = turnTo(bst, lotLong, r), s2 = own(tb, bw, bd);
      top = F.put(bs, tb, s2[0], s2[1], H - gh, { role: "storeys", x: sb, y: sb, z: gh, glaze: !bst.glass });
      // A screen, slats or fins up a face.
      if (S.stand.length && r() < 0.3) {
        var sd = floor(r() * 4), fl = faceLength(top, sd) - 2, fs = fl >= 4 ? take(S.stand) : null;
        if (fs) {
          var fst = stampOf(S, fs), tf = turnTo(fst, faceAxis(sd), r);
          var sf = own(tf, faceAxis(sd) === "x" ? fl : 1, faceAxis(sd) === "x" ? 1 : fl);
          against(top, F.put(fs, tf, sf[0], sf[1], top.h, { role: "screen", z: top.z }), sd, 1, sb ? 0 : 1);
        }
      }
    }
    // Its crown: a roof drawn over it, a lookout, or the flat roof its storeys end in.
    var c = r();
    if (S.roofs.length && c < (low ? 0.65 : 0.3) && top.w * top.d <= 1600) {
      var rs = take(S.roofs);
      F.shape(roofOver(rs, top.w, top.d, r), rs, { role: "roof", x: top.x, y: top.y, z: top.z + top.h });
    } else if (S.lookout.length && c < (low ? 0.75 : 0.5)) {
      var ls = take(S.lookout), lst = stampOf(S, ls), L0 = F.put(ls, floor(r() * 4), lst.nx, lst.ny, lst.nz, { role: "lookout", z: top.z + top.h });
      L0.x = top.x + floor(r() * max(1, top.w - L0.w + 1)); L0.y = top.y + floor(r() * max(1, top.d - L0.d + 1));
    }
    var R = render(F, 0);
    // The lot's corner is where it was put; the screen may stand a block proud of it.
    R.seed = seed;
    return words(S, R);
  }

  var api = { load: load, stampOf: stampOf, form: form, tower: tower, built: built, roofOver: roofOver, treeOf: treeOf, slice: slice, rng: rng, the: the };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.Forms = api; }
})(typeof window !== "undefined" ? window : this);

/* The city as its skyline.

   The artist, 7 Oct 2026, with a phone screenshot of Houston on the Museums
   layer (a blur of the globe's big pixel squares): "when I click on a city I
   want to see the city skyline like it shows in the timelapse of the urban
   development in the architecture section. Distinguish the art buildings
   from the rest and label them so i can click on them". And the same day,
   of New York pressed on the Artists layer: "I want the isometric of the
   urban skyline to come up and for me to be able to select artists from
   that area walking around or art buildings housing art".

   Where a city's ground has been read (grounds/city-<key>.json, cut by
   scripts/build_city_places.py and build_grounds.py, dated by
   build_built_years.py), its view is that ground in DIRT dots, in true
   isometric, as a museum's area view is: resting on the diagonals, a drag
   turns it, its buildings rising storey by storey with their years on the
   city's own dial (its first play is the city growing). Its museums stand in
   their own models and materials with a ring of pixel light round them; its
   galleries' buildings are lit a quieter lilac; every other building is let
   down a step. Each is named by the calm rules (beside it, never over
   another, a budget by the window's size; the rest named on hover or focus)
   and pressed: a museum goes in, a gallery opens its row. The artists of the
   place — born there, or placed there by their record — walk its streets a
   few at a time, only in the years the record has them there
   (cityartists.json); pressed, their life opens at that year.

   Two fingers, a wheel or a trackpad's pinch bring it nearer, up to φ²;
   pinched on out past the widest it goes on out to the world (land.js's
   rise), spread on in past the nearest it goes on nearer the museum nearest
   the fingers and into it, its building on the skyline's heading (in, below)
   — never into DIRT Earth's flat ground. Held still and let go, the wave
   (and whoever comes out of it). The keys: ← → a quarter turn, + − nearer
   and farther.

   A city whose ground has not been read is the map it was, and its column
   says so. Land.js's part is small: Land.city (state, museum, venue, light,
   up, deeper, squash, soil), and its map, gallery tiles and marks stand down
   while the skyline is on (Skyline.on). */
(function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2, TAU = Math.PI * 2;
  var TILT = Math.atan(1 / Math.SQRT2);
  var NOW = new Date().getFullYear();
  var LIGHT = "#5e52c7", LILAC = "#9d95e6";
  var LEVELS = [0, 0.16, 0.3, 0.46, 0.64];
  var T = 13;                         // the pixel light's tile, on the screen's own grid
  var EX = 2.5;                       // heights raised: a city's cells are ~40 m, a storey 3.2
  var PALE = [239, 233, 226], DUST = [232, 220, 203], COOL = [148, 156, 170], LIL = [157, 149, 230];
  var ZOOM_MAX = PHI * PHI;
  var REST_MS = Math.pow(PHI, 7) * 1000;     // ≈ 29 s at rest on a diagonal
  var SWING_MS = PHI * PHI * 1000;

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  function read(path) {
    return fetch(path).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  var cache = {};
  function once(path) { if (!cache[path]) { cache[path] = read(path); } return cache[path]; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function mixTo(c, to, k) { return [c[0] + (to[0] - c[0]) * k, c[1] + (to[1] - c[1]) * k, c[2] + (to[2] - c[2]) * k]; }
  function inkOf(c, light) {
    return "rgb(" + Math.round(Math.min(255, c[0] * light)) + "," + Math.round(Math.min(255, c[1] * light)) + "," +
      Math.round(Math.min(255, c[2] * light)) + ")";
  }
  function hex(c) {
    var m = /^#?([0-9a-f]{6})$/i.exec(c || "");
    if (!m) { return null; }
    var v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }
  function hash(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* A museum's name in its city, short, by the city view's own rule
     (land.js shortName): its acronym, else the name without its town. */
  function shortName(m) {
    var name = String(m.name || "");
    var acronym = /\(([^()]+)\)\s*$/.exec(name) || /^([A-Z][A-Z0-9 .&]*[A-Z0-9])\s+[–—-]\s+\S/.exec(name);
    if (acronym) { return acronym[1]; }
    var where = String(m.where || "");
    var town = where.lastIndexOf(",") > 0 ? where.slice(0, where.lastIndexOf(",")).trim() : where.trim();
    if (town) {
      var at = name.toLowerCase().indexOf(", " + town.toLowerCase());
      if (at > 0) { return name.slice(0, at); }
    }
    return name;
  }

  /* ---- the elements ------------------------------------------------------ */

  var root = null, canvas = null, light = null, veil = null, names = null, note = null;
  var under = null, over = null, says = null;     // the ground dial (below): behind the city, before it; the animal's line
  function make() {
    if (root) { return; }
    var stage = document.getElementById("stage"), tiles = document.getElementById("tiles");
    if (!stage) { return; }
    root = el("div", "skyline");
    root.hidden = true;
    canvas = el("canvas", "skyline-clod");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    light = el("canvas", "skyline-light");
    light.setAttribute("aria-hidden", "true");
    under = el("canvas", "skyline-ground skyline-under");
    under.setAttribute("aria-hidden", "true");
    over = el("canvas", "skyline-ground skyline-over");
    over.setAttribute("aria-hidden", "true");
    says = el("p", "skyline-hand-says");
    says.setAttribute("aria-live", "polite");
    says.hidden = true;
    // Going in to a museum, the city round it let go of (in, below).
    veil = el("div", "skyline-veil");
    veil.setAttribute("aria-hidden", "true");
    veil.hidden = true;
    names = el("div", "skyline-names");
    // The year and who is here, quietly (not live: it changes with every year the dial passes).
    note = el("p", "skyline-note");
    root.appendChild(under);
    root.appendChild(canvas);
    root.appendChild(light);
    root.appendChild(over);
    root.appendChild(veil);
    root.appendChild(names);
    root.appendChild(note);
    root.appendChild(says);
    // Under the pixel light and whoever comes out of the wave, over the globe.
    stage.insertBefore(root, tiles || null);
    gl = gpuStart();
    wire();
  }

  /* ---- the ground, its buildings, its art -------------------------------- */

  var places = null, artistsAll = null, museumsAll = null, buildingsAll = [];
  function lists() {
    return Promise.all([once("cityplaces.json"), once("cityartists.json"), once("museums.json"), once("architecture.json")]).then(function (r) {
      places = {};
      ((r[0] && r[0].places) || []).forEach(function (p) { places[p.key] = p; });
      artistsAll = (r[1] && r[1].towns) || {};
      museumsAll = {};
      ((r[2] && r[2].museums) || []).forEach(function (m) { museumsAll[m.slug] = m; });
      // The Architecture layer's buildings with their own spot (a home is only ever at its town).
      buildingsAll = ((r[3] && r[3].buildings) || []).filter(function (b) { return b.precision === "exact" && typeof b.lat === "number"; });
    });
  }
  // A city's Architecture buildings: those standing in its square, set in as its museums are (the artist,
  // 22 Oct 2026, of the Shanghai Grand Opera House in Shanghai's: "Yes to the Shanghai skyline").
  function buildingsIn(P) {
    var h = (P.side || 0) / 2, kx = 111320 * Math.cos(P.lat * Math.PI / 180);
    return buildingsAll.filter(function (b) {
      return Math.abs((b.lon - P.lon) * kx) < h && Math.abs((b.lat - P.lat) * 111320) < h;
    });
  }
  // What stands in the city in its own model, to be gone into: a museum, or an Architecture building.
  function stands(a) { return a.kind === "museum" || a.kind === "building"; }

  var city = null;                    // what is drawn, for one visit
  var building = null;                // a visit being made ready

  function build(st, P, g, models) {
    var n = g.n, side = g.side, cell = side / n, half = side / 2, N = n * n;
    var lat0 = P.lat, lon0 = P.lon, kx = 111320 * Math.cos(lat0 * Math.PI / 180);
    function toCell(lat, lon) { return { x: (lon - lon0) * kx / cell, y: -(lat - lat0) * 111320 / cell }; }
    function soil(i, j, sea) {
      return (Land.city.soil(lat0, lon0, i, j, sea)) || (sea ? [96, 118, 150, 2] : [138, 118, 96, 2]);
    }
    var hi = 0, q, i, j;
    for (q = 0; q < N; q += 1) { if (g.kind[q] !== "~") { hi = Math.max(hi, g.ground[q]); } }
    var lift = Math.min(4, (n / 6) * cell / Math.max(hi / 2, 1)) / cell;
    function zAt(qq) { return g.kind[qq] === "~" ? 0 : g.ground[qq] / 2 * lift; }

    // Each building cell's year (0 not known), and its first and last.
    var built = new Int16Array(N), bi = 0, y0 = Infinity;
    for (q = 0; q < N; q += 1) {
      if (g.kind[q] !== "b") { continue; }
      var yr = g.built ? g.built[bi] || 0 : 0;
      bi += 1;
      built[q] = yr;
      if (yr > 0 && yr < y0) { y0 = yr; }
    }
    // Where only the satellites date the city, their first year (1975) means "there by 1975", not
    // "built in 1975": all that stood then stands from the start, and the column says so.
    var floor1975 = y0 >= 1975 && y0 < NOW;
    if (floor1975) {
      y0 = Infinity;
      for (q = 0; q < N; q += 1) {
        if (built[q] && built[q] <= 1975) { built[q] = 0; }
        if (built[q] > 0 && built[q] < y0) { y0 = built[q]; }
      }
    }
    var years = y0 < NOW ? { y0: y0 - 1, y1: NOW } : null;
    function rev(yr, f) { return years && yr > 0 ? (yr - 1 - years.y0) / (years.y1 - years.y0) + f * 0.97 / (years.y1 - years.y0) : 0; }
    var rise = years ? 0.97 / (years.y1 - years.y0) : 1;     // a building's storeys rise over a year of the dial

    // Whose each cell is: 0 none, k+1 the k-th art building.
    var owner = new Int16Array(N), room = new Uint8Array(N);
    var arts = [];

    // The museums, and the Architecture buildings in the square: their models set in at their points (as a
    // museum's area view sets its own). A building's slug is its place's on the globe ("building-…"), its file
    // its model's; its year the one its entry gives (it rises then, whatever its plot's cells say).
    var standing = st.museums.map(function (slug) {
      var m = museumsAll[slug];
      return m && { kind: "museum", slug: slug, file: slug, m: m, name: shortName(m), full: m.name };
    }).concat(buildingsIn(P).map(function (b) {
      return { kind: "building", slug: "building-" + b.slug, file: b.slug, m: b, name: b.name || b.title, full: b.name || b.title,
               year: parseInt(b.year, 10) || 0 };
    }));
    standing.forEach(function (a) {
      var m = a && a.m;
      if (!m || typeof m.lat !== "number") { return; }
      var at = toCell(m.lat, m.lon);
      if (Math.abs(at.x) > n / 2 - 0.5 || Math.abs(at.y) > n / 2 - 0.5) { return; }
      a.at = at; a.cells = []; a.dots = null; a.top = 0; a.k = arts.length;
      arts.push(a);
      var model = models[a.file], ins = null;
      if (model && model.parts && window.Models && Models.inset) {
        try { ins = Models.inset(model, function (vi, vj) { return soil(vj, vi, false); }); } catch (e) { ins = null; }
      }
      a.ins = ins;
      if (ins) {
        var cover = {}, cols = {};
        for (var vj = 0; vj < ins.ny; vj += 1) {
          for (var vi = 0; vi < ins.nx; vi += 1) {
            var gx = Math.floor(((vi + 0.5) * ins.v - ins.site[0] / 2) / cell + at.x + n / 2);
            var gy = Math.floor(((vj + 0.5) * ins.v - ins.site[1] / 2) / cell + at.y + n / 2);
            if (gx < 0 || gy < 0 || gx >= n || gy >= n) { continue; }
            var c = gy * n + gx;
            cols[c] = (cols[c] || 0) + 1;
            if (ins.foot[vj * ins.nx + vi]) { cover[c] = (cover[c] || 0) + 1; }
          }
        }
        var best = -1, bestF = 0;
        Object.keys(cover).forEach(function (c) {
          var f = cover[c] / cols[c];
          c = +c;
          if (f >= 0.25) { room[c] = 1; }
          if (f >= 0.4 && !owner[c]) { owner[c] = a.k + 1; a.cells.push(c); }
          if (f > bestF) { bestF = f; best = c; }
        });
        if (!a.cells.length && best >= 0) { owner[best] = a.k + 1; room[best] = 1; a.cells.push(best); }
      } else {
        // No model: the building cells at its point and joined to them, within 63 m.
        var reach = Math.max(1.5, 63 / cell), ci = Math.floor(at.y + n / 2), cj = Math.floor(at.x + n / 2);
        var seeds = [];
        for (var di = -1; di <= 1; di += 1) {
          for (var dj = -1; dj <= 1; dj += 1) {
            var ii = ci + di, jj = cj + dj;
            if (ii >= 0 && jj >= 0 && ii < n && jj < n && g.kind[ii * n + jj] === "b") { seeds.push(ii * n + jj); }
          }
        }
        while (seeds.length) {
          q = seeds.pop();
          if (owner[q]) { continue; }
          owner[q] = a.k + 1; a.cells.push(q);
          [q - n, q + n, q % n ? q - 1 : -1, q % n < n - 1 ? q + 1 : -1].forEach(function (p) {
            if (p >= 0 && p < N && !owner[p] && g.kind[p] === "b" &&
                Math.hypot(Math.floor(p / n) - ci, p % n - cj) <= reach) { seeds.push(p); }
          });
        }
      }
    });
    // The galleries with a point: the building their door is in (or the nearest within a cell).
    var works = st.venueWorks || [];
    st.galleries.forEach(function (gp) {
      var v = st.pf && st.pf.venues[gp.vi];
      if (!v) { return; }
      var at = toCell(gp.lat, gp.lon);
      if (Math.abs(at.x) > n / 2 - 0.5 || Math.abs(at.y) > n / 2 - 0.5) { return; }
      // The building its door is in, or the nearest within ~45 m (a cell, at the first grain).
      var ci = Math.floor(at.y + n / 2), cj = Math.floor(at.x + n / 2), hit = -1, reachG = Math.max(1, Math.round(45 / cell));
      for (var r = 0; r <= reachG && hit < 0; r += 1) {
        for (var di = -r; di <= r && hit < 0; di += 1) {
          for (var dj = -r; dj <= r && hit < 0; dj += 1) {
            var ii = ci + di, jj = cj + dj, c = ii * n + jj;
            if (ii >= 0 && jj >= 0 && ii < n && jj < n && g.kind[c] === "b") { hit = c; }
          }
        }
      }
      // Within a museum: the museum's (a gallery listed at a museum's door is the museum's).
      if (hit >= 0 && owner[hit] && stands(arts[owner[hit] - 1])) { return; }
      var a = { kind: "gallery", vi: gp.vi, name: v[0], full: v[0], at: at, cells: [], n: works[gp.vi] || 1, y0: v[2] || 0, k: arts.length };
      arts.push(a);
      if (hit >= 0) {
        if (!owner[hit]) { owner[hit] = a.k + 1; }
        a.cells.push(hit);
        // Where the grid is finer than the building, the rest of it: the cells joined to it of the same
        // height, within 30 m of its door's cell (at the first grain that is the one cell).
        var hi_ = Math.floor(hit / n), hj = hit % n, tallH = g.tall.charCodeAt(hit), span = 30 / cell, todo = [hit], seenG = {};
        seenG[hit] = 1;
        while (todo.length && span >= 1) {
          var c0 = todo.pop();
          [c0 - n, c0 + n, c0 % n ? c0 - 1 : -1, c0 % n < n - 1 ? c0 + 1 : -1].forEach(function (p) {
            if (p < 0 || p >= N || seenG[p] || g.kind[p] !== "b" || owner[p] || g.tall.charCodeAt(p) !== tallH) { return; }
            if (Math.hypot(Math.floor(p / n) - hi_, p % n - hj) > span) { return; }
            seenG[p] = 1; owner[p] = a.k + 1; a.cells.push(p); todo.push(p);
          });
        }
      }
    });

    // The dots: on the 2D canvas a dot a storey, on the GPU a strip a building cell (dotsFor).
    var E = dotsFor(gpu());
    // Its soil's grain stays near the ~40 m it was drawn at (a finer grid shows the city's shapes finer,
    // not its soil noisier): a building takes its tint from the soil's cell at that grain.
    var grain = Math.max(1, Math.round(40 / cell));
    var artTop = arts.map(function () { return 0; }), artZ0 = arts.map(function () { return 0; }), artN = arts.map(function () { return 0; });
    for (i = 0; i < n; i += 1) {
      for (j = 0; j < n; j += 1) {
        q = i * n + j;
        var what = g.kind[q], x = j - n / 2 + 0.5, y = i - n / 2 + 0.5, z = zAt(q);
        var s = soil(i, j, what === "~");
        var up = i && j ? zAt(q - n - 1) : z;
        var lt = 0.82 + 0.12 * Math.max(-1, Math.min(2, Math.round((z - up) * 3)));
        if (what === "=") {
          E.dot(x, y, z, 1, mixTo(s, DUST, 0.6), 1, 0);
        } else if (what === "b") {
          E.dot(x, y, z, Math.max(1, s[3]), s, lt * 0.8, 0);
          var o = owner[q] ? arts[owner[q] - 1] : null;
          if (o) { artZ0[o.k] += z; artN[o.k] += 1; }
          // Under a museum's own model the plot keeps only its ground.
          var storeys = g.tall.charCodeAt(q) - 48;
          var h = Math.min(n / 4, Math.max(0.5, storeys * 3.2 / cell * EX));
          var layers = room[q] ? 0 : Math.max(1, Math.round(h * 2)), yr = built[q];
          if (layers) {
            var tint = grain > 1 ? soil(i - i % grain, j - j % grain, false) : s;
            var r0 = years && yr > 0 ? rev(yr, 0) : null;
            if (o && stands(o)) { E.column(x, y, z, layers, mixTo(s, PALE, 0.86), RAMPS.museum, r0, rise); }
            else if (o) { E.column(x, y, z, layers, mixTo(mixTo(s, PALE, 0.62), LIL, 0.42), RAMPS.gallery, r0, rise); }
            else { E.column(x, y, z, layers, mixTo(mixTo(tint, PALE, 0.3), COOL, 0.26), RAMPS.plain, r0, rise); }
            if (o && z + layers * 0.5 > artTop[o.k]) { artTop[o.k] = z + layers * 0.5; }
          }
        } else if (what === "g") {
          // The city's green (its parks, gardens, lawns, cemeteries and woods): the soil, grown over.
          E.dot(x, y, z, Math.max(1, s[3]), mixTo(s, GREEN, 0.55), lt, 0);
        } else if (s[3]) {
          E.dot(x, y, z, s[3], s, what === "~" ? 1 : lt, 0);
        } else if (gridFine) {
          // A finer grid leaves no holes: where the soil has no dot, a small dark one. On water it is the sea's
          // deep tone at the width of the sea's commonest dot, not the soil's black: a third of the sea's
          // swatch is hole, and a lagoon (Venice's) read as black voids between patches of blue, not as water.
          E.dot(x, y, z, what === "~" ? 2 : 1, what === "~" ? SEA_DEEP : s, what === "~" ? 0.6 : lt * 0.62, 0);
        }
        if (i === 0 || j === 0 || i === n - 1 || j === n - 1) {
          // The edge goes down into the soil from the ground the clod holds there, not from the plain: a
          // hill (Los Angeles, Rome, Madrid, Seoul stand 20 cells over the base) is not left over a gap.
          // Where the soil has a hole, a tall wall wears the soil's mean, not a black bar.
          var under = soil(i + n, j, false);
          if (z > 1 && !under[3]) { under = [114, 82, 55, 1]; }
          E.side(x, y, z, Math.max(1, under[3]), under);
        } else if (what !== "~") {
          // A step in the ground (a bluff over the water, a steep hill) is not left over a gap either: the
          // cell's earth runs down to its lowest neighbour's ground, the sea's level at the shore.
          var zl = Math.min(z, zAt(q - n), zAt(q + n), zAt(q - 1), zAt(q + 1));
          if (z - zl > 1) { E.skirt(x, y, z, zl, Math.max(1, s[3]), s[3] ? s : [114, 82, 55, 1]); }
        }
      }
    }
    // The museums' models, in their materials, at their real size, raised as the plot is.
    arts.forEach(function (a) {
      // Its ground: its plot's buildings', else (a building newer than the city's ground, set in a clearing)
      // the ground at its point.
      var ci = Math.max(0, Math.min(n - 1, Math.floor(a.at.y + n / 2))), cj = Math.max(0, Math.min(n - 1, Math.floor(a.at.x + n / 2)));
      a.z0 = artN[a.k] ? artZ0[a.k] / artN[a.k] : stands(a) ? zAt(ci * n + cj) : 0;
      a.top = Math.max(artTop[a.k], a.z0);
      if (!a.ins) { return; }
      // Its year: its entry's (a building's), else the earliest a fifth of its dated cells agree on, if most are dated.
      var dated = [], tally = {}, all = 0, year = a.year || 0;
      a.cells.forEach(function (c) { if (g.kind[c] === "b") { all += 1; if (built[c]) { dated.push(built[c]); tally[built[c]] = (tally[built[c]] || 0) + 1; } } });
      if (!year && all && dated.length * 2 >= all) {
        dated.sort(function (p, r) { return p - r; });
        for (var u = 0; u < dated.length && !year; u += 1) { if (tally[dated[u]] * 5 >= dated.length) { year = dated[u]; } }
      }
      var ins = a.ins, dd = ins.dots, v = ins.v, k = 3 / cell * v, seen = {}, mg = Math.min(3, cell / 5);
      for (var t = 0; t < dd.count; t += 1) {
        var mx = ((dd.x[t] + ins.nx / 2 + 0.5) * v - ins.site[0] / 2) / cell + a.at.x;
        var my = ((dd.y[t] + ins.ny / 2 + 0.5) * v - ins.site[1] / 2) / cell + a.at.y;
        var mz = a.z0 + dd.z[t] * v / cell * EX;
        // A third of a cell a dot: the model's grain where the plot's is a cell (and never finer than
        // ~5 m, however fine the plot: the model's own voxels are 1-3 m).
        var key = Math.round(mx * mg) + "," + Math.round(my * mg) + "," + Math.round(mz * mg);
        if (seen[key]) { continue; }
        seen[key] = 1;
        E.ink(mx, my, mz, Math.max(0.7, dd.size[t] * k / 3), dd.ink[t], rev(year, dd.z[t] / ins.nz));
        if (mz > a.top) { a.top = mz; }
      }
    });

    // The streets the artists walk: road cells, else open land.
    var walk = [], isWalk = new Uint8Array(N);
    for (q = 0; q < N; q += 1) { if (g.kind[q] === "=") { isWalk[q] = 1; walk.push(q); } }
    if (walk.length < 40) { for (q = 0; q < N; q += 1) { if (g.kind[q] === "." || g.kind[q] === "g") { isWalk[q] = 1; walk.push(q); } } }

    var D = E.done();
    D.span = n;
    D.lift = Math.min(D.high, n / 4);
    return { key: st.key, P: P, g: g, n: n, cell: cell, dots: D, years: years, rise: rise, floor1975: floor1975,
             from: g.builtFrom || [], old: g.builtOld || 0,
             arts: arts, owner: owner,
             zAt: zAt, toCell: toCell, walk: walk, isWalk: isWalk };
  }

  /* ---- the dots, for the 2D canvas or the GPU -------------------------------
     A city's ground was made of dots a storey apart, sorted and drawn one by one on a canvas a CSS
     pixel to its pixel: ~45,000 for New York at ~55 m a cell. The cities' pass (grounds/REFINE.md)
     cuts them finer, a grain at a time, which that cannot draw at 24 frames a second, so where WebGL 2
     is there they are drawn by it (gpuDraw): every dot a square of the device's own pixels, depth-
     tested instead of sorted, and a building cell's storeys one strip from its first storey to its
     roof, risen as far as the dial has come, lit as the dots were. Where it is not, the city is drawn
     as before, from its ground made no finer than COARSE cells a side (coarser). */
  var RAMPS = {                       // a column's light: code, its first storey, its rise to the top, its roof
    plain: [1, 0.62, 0.08, 0.8], gallery: [2, 0.86, 0.1, 1.08], museum: [3, 0.92, 0.12, 1.12]
  };
  var GREEN = [92, 122, 70];          // the models' grass and planting, as the plot's green
  var SEA_DEEP = [62, 89, 113];       // the sea swatch's mean dot (dirt-sea.png): the water where the soil has a hole
  var COARSE = 160;                   // the most cells a side the 2D canvas is given
  var gridFine = false;               // the ground being made is finer than the first grain (~40 m)
  function lit(c, k) { return [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))]; }
  var rgbSeen = {};
  function rgbOf(ink) {
    var c = rgbSeen[ink];
    if (!c) {
      var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(ink || "") || [0, 128, 128, 128];
      c = rgbSeen[ink] = [+m[1], +m[2], +m[3]];
    }
    return c;
  }
  function dotsFor(onGpu) {
    if (!onGpu) {
      var D = { x: [], y: [], z: [], size: [], ink: [], reveal: [], high: 0 };
      var put = function (x, y, z, size, ink, reveal) {
        D.x.push(x); D.y.push(y); D.z.push(z); D.size.push(size); D.ink.push(ink); D.reveal.push(reveal);
        if (z > D.high) { D.high = z; }
      };
      return {
        dot: function (x, y, z, size, c, k, reveal) { put(x, y, z, size, inkOf(c, k), reveal); },
        ink: function (x, y, z, size, ink, reveal) { put(x, y, z, size, ink, reveal); },
        // A storey a dot, half a cell apart, each risen in its turn as the dial passes its year.
        column: function (x, y, z, layers, c, ramp, r0, rise) {
          for (var l = 1; l <= layers; l += 1) {
            var f = l / layers;
            put(x, y, z + l * 0.5, 2, inkOf(c, l === layers ? ramp[3] : ramp[1] + ramp[2] * f), r0 === null ? 0 : r0 + f * rise);
          }
        },
        // The clod's edge, down into the soil from the ground it holds: six dots under flat land, and
        // as many more as a hill stands above the base, so no hill floats over a gap.
        side: function (x, y, z, size, c) {
          var m = 6 + Math.round(Math.max(0, z) * 2);
          for (var d = 1; d <= m; d += 1) { put(x, y, z - d * 0.5, size, inkOf(c, 0.745 - 0.175 * (d - 1) / Math.max(1, m - 1)), 0); }
        },
        // A step in the ground: a cell's earth from its top down to its lowest neighbour's.
        skirt: function (x, y, z, zl, size, c) {
          var m = Math.round((z - zl) * 2);
          for (var d = 1; d <= m; d += 1) { put(x, y, z - d * 0.5, size, inkOf(c, 0.745 - 0.175 * (d - 1) / Math.max(1, m - 1)), 0); }
        },
        done: function () { D.count = D.x.length; D.gpu = false; return D; }
      };
    }
    // x, y, z0, z1, r0 (the year it rises, as the dial's share; -1e6 always), size; and r, g, b, ramp.
    var F = [], C = [], high = 0, count = 0;
    function push(x, y, z0, z1, r0, size, c, ramp) {
      F.push(x, y, z0, z1, r0, size);
      C.push(c[0], c[1], c[2], ramp);
      if (z1 > high) { high = z1; }
      count += 1;
    }
    return {
      dot: function (x, y, z, size, c, k, reveal) { push(x, y, z, z, reveal, size, lit(c, k), 0); },
      ink: function (x, y, z, size, ink, reveal) { push(x, y, z, z, reveal, size, rgbOf(ink), 0); },
      column: function (x, y, z, layers, c, ramp, r0) {
        push(x, y, z, z + layers * 0.5, r0 === null ? -1e6 : r0, 2, [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])], ramp[0]);
      },
      // The clod's edge: a strip from the soil's base (3.5 below the plain) up to just under the ground it holds.
      side: function (x, y, z, size, c) { push(x, y, -3.5, z - 0.5, -1e6, size, [c[0], c[1], c[2]], 4); },
      skirt: function (x, y, z, zl, size, c) { push(x, y, zl, z - 0.5, -1e6, size, [c[0], c[1], c[2]], 4); },
      done: function () {
        return { F: new Float32Array(F), C: new Uint8Array(C), count: count, high: high, gpu: true };
      }
    };
  }

  /* A ground cut finer than the 2D canvas can draw, made coarser for it: each block of k × k cells one
     cell — a building where two in five of it are (its tallest, its earliest year), else water where
     half is, a street where three in ten are, green where half is, else land; its height the mean. */
  function coarser(g) {
    var k = Math.ceil(g.n / COARSE), n = Math.floor(g.n / k), kind = [], tall = [], ground = [], built = [];
    var o = Math.floor((g.n - n * k) / 2), by = null, bi = 0, q, i, j;     // the blocks kept about the middle
    if (g.built) {
      by = new Int32Array(g.n * g.n);
      for (q = 0; q < g.n * g.n; q += 1) { if (g.kind[q] === "b") { by[q] = g.built[bi] || 0; bi += 1; } }
    }
    for (i = 0; i < n; i += 1) {
      for (j = 0; j < n; j += 1) {
        var cnt = { b: 0, "~": 0, "=": 0, g: 0, ".": 0 }, hi = 48, sum = 0, yr = 0;
        for (var di = 0; di < k; di += 1) {
          for (var dj = 0; dj < k; dj += 1) {
            q = (o + i * k + di) * g.n + o + j * k + dj;
            var w = g.kind[q];
            cnt[w] = (cnt[w] || 0) + 1;
            sum += g.ground[q];
            if (w === "b") {
              hi = Math.max(hi, g.tall.charCodeAt(q));
              var y = by ? by[q] : 0;
              if (y && (!yr || (y < 0 ? -1e9 : y) < (yr < 0 ? -1e9 : yr))) { yr = y; }
            }
          }
        }
        var kk = k * k, w2 = cnt.b * 5 >= kk * 2 ? "b" : cnt["~"] * 2 >= kk ? "~" : cnt["="] * 10 >= kk * 3 ? "=" : cnt.g * 2 >= kk ? "g" : ".";
        kind.push(w2);
        tall.push(w2 === "b" ? String.fromCharCode(hi) : "0");
        ground.push(Math.round(sum / kk));
        if (w2 === "b") { built.push(yr); }
      }
    }
    var out = {};
    Object.keys(g).forEach(function (key) { out[key] = g[key]; });
    out.n = n; out.side = g.side * n * k / g.n; out.kind = kind.join(""); out.tall = tall.join(""); out.ground = ground;
    if (g.built) { out.built = built; } else { delete out.built; }
    return out;
  }

  /* ---- drawing ----------------------------------------------------------- */

  var dialTop = Infinity;             // the top of the dial where it stands under the band's middle
  var view = { heading: TAU / 8, zoom: 1, px: 0, py: 0, from: 0, to: 0, swingAt: 0, nextTurn: 0, held: false };
  var sorted = { heading: null, order: null, key: null, count: 0 };
  var frameNow = null, drawnKey = "", band = null, shownNow = 1;

  function frameFor(w, h) {
    var D = city.dots, cos = Math.cos(view.heading), sin = Math.sin(view.heading), st = Math.sin(TILT), ct = Math.cos(TILT);
    var tall = (D.lift || 0) * ct;
    if (ground.on) {
      // The ring round the block (the ground dial, below), and room for its animal: beside it at the ring's
      // sides, over it at the far side, under the near side for the first year. In cells: the block's far
      // corner and its tallest over the middle, or the ring's far side; the ring's near side under it.
      var Rr = RING * D.span, room = handRoom();
      var up = Math.max(0.71 * D.span * st + tall, Rr * st), down = Rr * st;
      var s0 = Math.max(0.01, Math.min((w - 2 * room.side) / (2 * Rr), (h - room.foot) / (up + down),
                                       (h - room.up - room.foot) / (2 * Rr * st)));
      var topPx = Math.max((0.71 * D.span * st + tall) * s0, Rr * st * s0 + room.up), botPx = Rr * st * s0 + room.foot;
      return { scale: s0 * view.zoom, cx0: w / 2 + view.px, cy0: (h - topPx - botPx) / 2 + topPx + view.py,
               cos: cos, sin: sin, st: st, ct: ct, ring: Rr };
    }
    var scale = Math.min(w * 0.94 / (D.span * 1.42), h * 0.9 / (D.span * 1.42 * st + tall));
    return { scale: scale * view.zoom, cx0: w / 2 + view.px, cy0: h * 0.5 + tall * scale * 0.382 + view.py,
             cos: cos, sin: sin, st: st, ct: ct, ring: 0 };
  }
  function project(f, x, y, z) {
    return { x: f.cx0 + (x * f.cos - y * f.sin) * f.scale, y: f.cy0 + ((x * f.sin + y * f.cos) * f.st - z * f.ct) * f.scale };
  }
  // A point of the canvas back onto the ground plane at height z.
  function unproject(f, sx, sy, z) {
    var u = (sx - f.cx0) / f.scale, w = ((sy - f.cy0) / f.scale + z * f.ct) / f.st;
    return { x: u * f.cos + w * f.sin, y: w * f.cos - u * f.sin };
  }

  // The dial standing under the middle of the band (a desktop's): the clod keeps above it.
  function frameH() {
    var h = band.h;
    // Laid on the ground, the dial takes no room of its own.
    return ground.on ? h : Math.max(h * 0.62, Math.min(h, dialTop - band.y - 6));
  }
  function draw() {
    var D = city.dots, w = band.w, h = band.h;
    var f = frameFor(w, frameH());
    frameNow = f;
    if (D.gpu) { gpuDraw(D, f); return; }
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (sorted.heading !== view.heading || sorted.count !== D.count) {
      // Back to front, by a counting sort on depth in quarter cells: the order a heading needs,
      // in one pass, however many dots (a comparator sort of 45,000 took most of a frame).
      var cnt = D.count;
      if (!sorted.order || sorted.order.length < cnt) { sorted.order = new Uint32Array(cnt); sorted.key = new Int32Array(cnt); }
      var key = sorted.key, lo = Infinity, hi = -Infinity, k;
      for (k = 0; k < cnt; k += 1) {
        var v = Math.floor(((D.x[k] * f.sin + D.y[k] * f.cos) * f.ct + D.z[k] * f.st) * 4);
        key[k] = v;
        if (v < lo) { lo = v; }
        if (v > hi) { hi = v; }
      }
      var buckets = new Uint32Array(hi - lo + 2);
      for (k = 0; k < cnt; k += 1) { buckets[key[k] - lo + 1] += 1; }
      for (k = 1; k < buckets.length; k += 1) { buckets[k] += buckets[k - 1]; }
      for (k = 0; k < cnt; k += 1) { sorted.order[buckets[key[k] - lo]++] = k; }
      sorted.heading = view.heading; sorted.count = cnt;
    }
    var cover = Math.max(0.5, f.scale * 0.56), was = null, shown = shownNow, order = sorted.order;
    for (var t = 0; t < D.count; t += 1) {
      var q = order[t];
      if (D.reveal[q] > shown) { continue; }
      var x = D.x[q], y = D.y[q];
      var sx = f.cx0 + (x * f.cos - y * f.sin) * f.scale;
      var sy = f.cy0 + ((x * f.sin + y * f.cos) * f.st - D.z[q] * f.ct) * f.scale;
      if (sx < -8 || sy < -8 || sx > w + 8 || sy > h + 8) { continue; }
      var r = Math.max(1, Math.ceil(D.size[q] * cover));
      if (D.ink[q] !== was) { ctx.fillStyle = was = D.ink[q]; }
      ctx.fillRect(Math.round(sx - r / 2), Math.round(sy - r / 2), r, r);
    }
  }

  /* ---- the GPU ------------------------------------------------------------- */

  var gl = null, glLost = false, prog = null, vao = null, bufF = null, bufC = null, glFor = null, uni = {};
  var density = 1;                    // the canvas's pixels a CSS pixel (the device's, on the GPU; 1 on the 2D canvas)
  var VS = [
    "#version 300 es",
    "precision highp float;",
    "layout(location = 0) in vec3 aA;   // x, y, z0 (cells)",
    "layout(location = 1) in vec3 aB;   // z1, the share of the dial it rises at, size",
    "layout(location = 2) in vec4 aC;   // r, g, b, ramp",
    "uniform vec2 uView;                // the canvas, in its pixels",
    "uniform vec3 uFrame;               // scale, cx0, cy0, in the canvas's pixels",
    "uniform vec4 uRot;                 // cos, sin of the heading; sin, cos of the tilt",
    "uniform vec3 uTime;                // shown, a building's rise, cover",
    "uniform vec2 uDepth;               // nearest-to-farthest: its low, and 1 / its span",
    "out vec3 vInk;",
    "flat out vec4 vRamp;               // light at the first storey, its rise to the top, the roof's, the roof's pixels",
    "out float vF;",
    "out float vTop;",
    "void main() {",
    "  int ramp = int(aC.w * 255.0 + 0.5);",
    "  float r = max(1.0, ceil(aB.z * uTime.z));",
    "  float zt = aA.z, zb = aA.z, f0 = 1.0, f1 = 1.0;",
    "  vRamp = vec4(1.0, 0.0, 1.0, 0.0);",
    "  bool hide;",
    "  if (ramp == 0) {",
    "    hide = aB.y > uTime.x;",
    "  } else {",
    "    float L = floor((aB.x - aA.z) * 2.0 + 0.5);",
    "    float k = aB.y < -1e5 ? L : floor(L * clamp((uTime.x - aB.y) / uTime.y, 0.0, 1.0) + 1e-4);",
    "    hide = k < 1.0;",
    "    zb = aA.z + 0.5; zt = aA.z + k * 0.5; f0 = 1.0 / L; f1 = k / L;",
    "    float roof = k >= L ? r : 0.0;",
    "    if (ramp == 1) vRamp = vec4(0.62, 0.08, 0.8, roof);",
    "    else if (ramp == 2) vRamp = vec4(0.86, 0.1, 1.08, roof);",
    "    else if (ramp == 3) vRamp = vec4(0.92, 0.12, 1.12, roof);",
    "    else vRamp = vec4(0.535, 0.21, 1.0, 0.0);",
    "  }",
    "  if (hide) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vInk = vec3(0.0); vF = 0.0; vTop = 0.0; return; }",
    "  float u = aA.x * uRot.x - aA.y * uRot.y, w = aA.x * uRot.y + aA.y * uRot.x;",
    "  float sx = uFrame.y + u * uFrame.x;",
    "  float yT = floor(uFrame.z + (w * uRot.z - zt * uRot.w) * uFrame.x - r * 0.5 + 0.5);",
    "  float yB = floor(uFrame.z + (w * uRot.z - zb * uRot.w) * uFrame.x - r * 0.5 + 0.5) + r;",
    "  float x0 = floor(sx - r * 0.5 + 0.5);",
    "  float cx = float(gl_VertexID & 1), cy = float(gl_VertexID >> 1);",
    "  float px = x0 + cx * r, py = mix(yT, yB, cy), zz = mix(zt, zb, cy);",
    "  float depth = (w * uRot.w + zz * uRot.z - uDepth.x) * uDepth.y;",
    "  gl_Position = vec4(px / uView.x * 2.0 - 1.0, 1.0 - py / uView.y * 2.0, 1.0 - 2.0 * clamp(depth, 0.0, 1.0), 1.0);",
    "  vInk = aC.rgb; vF = mix(f1, f0, cy); vTop = cy * (yB - yT);",
    "}"
  ].join("\n");
  var FS = [
    "#version 300 es",
    "precision mediump float;",
    "in vec3 vInk;",
    "flat in vec4 vRamp;",
    "in float vF;",
    "in float vTop;",
    "out vec4 o;",
    "void main() {",
    "  float b = vRamp.w > 0.0 && vTop < vRamp.w ? vRamp.z : vRamp.x + vRamp.y * vF;",
    "  o = vec4(min(vec3(1.0), floor(vInk * 255.0 * b + 0.5) / 255.0), 1.0);",
    "}"
  ].join("\n");

  // WebGL 2 on the skyline's canvas, once; null where it is not to be had (the 2D canvas then).
  function gpu() {
    make();
    return !!gl && !glLost;
  }
  function gpuProgram(c) {
    function shader(type, src) {
      var sh = c.createShader(type);
      c.shaderSource(sh, src);
      c.compileShader(sh);
      if (!c.getShaderParameter(sh, c.COMPILE_STATUS)) { throw new Error(c.getShaderInfoLog(sh)); }
      return sh;
    }
    var p = c.createProgram();
    c.attachShader(p, shader(c.VERTEX_SHADER, VS));
    c.attachShader(p, shader(c.FRAGMENT_SHADER, FS));
    c.linkProgram(p);
    if (!c.getProgramParameter(p, c.LINK_STATUS)) { throw new Error(c.getProgramInfoLog(p)); }
    prog = p;
    ["uView", "uFrame", "uRot", "uTime", "uDepth"].forEach(function (u) { uni[u] = c.getUniformLocation(prog, u); });
  }
  function gpuStart() {
    if (window.SKYLINE_2D) { return null; }
    var c = null;
    try { c = canvas.getContext("webgl2", { antialias: false, depth: true, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" }); } catch (e) { c = null; }
    if (!c) { return null; }
    try { gpuProgram(c); } catch (e) {
      if (window.console) { console.warn("skyline: the GPU's dots could not be made", e); }
      // The canvas has a WebGL context now and can never give a 2D one: the 2D canvas is a new one.
      var fresh = el("canvas", "skyline-clod");
      fresh.tabIndex = 0;
      fresh.setAttribute("role", "img");
      if (canvas.parentNode) { canvas.parentNode.replaceChild(fresh, canvas); }
      canvas = fresh;
      return null;
    }
    // A lost context keeps its object; restored, it is given its program again, and the city its buffers.
    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault(); glLost = true; glFor = null; vao = bufF = bufC = null;
    });
    canvas.addEventListener("webglcontextrestored", function () {
      try { gpuProgram(gl); glLost = false; dirty = true; } catch (e) { glLost = true; }
    });
    return c;
  }
  // The city's dots into the GPU's buffers, once a visit's city.
  function gpuLoad(D) {
    if (glFor === D) { return; }
    if (vao) { gl.deleteVertexArray(vao); gl.deleteBuffer(bufF); gl.deleteBuffer(bufC); }
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    bufF = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufF);
    gl.bufferData(gl.ARRAY_BUFFER, D.F, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.vertexAttribDivisor(1, 1);
    bufC = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufC);
    gl.bufferData(gl.ARRAY_BUFFER, D.C, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 4, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    glFor = D;
  }
  function gpuDraw(D, f) {
    if (!gl || glLost) { return; }
    gpuLoad(D);
    var k = density, W = canvas.width, H = canvas.height, n = D.span;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform2f(uni.uView, W, H);
    gl.uniform3f(uni.uFrame, f.scale * k, f.cx0 * k, f.cy0 * k);
    gl.uniform4f(uni.uRot, f.cos, f.sin, f.st, f.ct);
    gl.uniform3f(uni.uTime, shownNow, city.rise || 1, Math.max(0.5, f.scale * k * 0.56));
    // Nearer is larger: its ground's diagonal and its height, the farthest corner to the nearest roof.
    var lo = -n * f.ct - 8 * f.st, hi = n * f.ct + (D.high + 2) * f.st;
    gl.uniform2f(uni.uDepth, lo, 1 / (hi - lo));
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, D.count);
    gl.bindVertexArray(null);
  }

  // The canvas's pixels to the screen's.
  function toScreen(p) { return { x: band.x + p.x, y: band.y + p.y }; }

  /* ---- the names --------------------------------------------------------- */

  var marks = [];                     // {a, btn, named, x, y, box}
  var litArt = -1, namedTap = null;
  function makeNames() {
    names.textContent = "";
    marks = city.arts.map(function (a) {
      var b = el("button", "skyline-name skyline-" + a.kind);
      b.type = "button";
      b.appendChild(el("span", "skyline-name-text", a.name));
      b.setAttribute("aria-label", stands(a) ? "Into " + a.full : a.full + " — its works, in the column");
      b.dataset.k = a.k;
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        var mk = marks[a.k];
        // On a touch screen an unnamed one is named by the first tap, entered by the second.
        if (coarse && !mk.named && namedTap !== a) { namedTap = a; lightArt(a.k, true); return; }
        pressArt(a, mk.x, mk.y);
      });
      b.addEventListener("pointerenter", function () { lightArt(a.k, true); });
      b.addEventListener("pointerleave", function () { lightArt(a.k, false); });
      b.addEventListener("focus", function () { lightArt(a.k, true); });
      b.addEventListener("blur", function () { lightArt(a.k, false); });
      names.appendChild(b);
      return { a: a, btn: b, named: false, x: 0, y: 0, w: 0, h: 0 };
    });
  }
  // The view a museum was gone into from, for the way back up: the exact skyline you went down from.
  var wentFrom = {};
  function rememberView(slug, base) {
    if (!city) { return; }
    wentFrom[city.key] = { slug: slug, heading: view.swingAt ? view.to : view.heading,
                           zoom: base ? base.zoom : view.zoom, px: base ? base.px : view.px, py: base ? base.py : view.py,
                           w: band ? band.w : 0, h: band ? band.h : 0, at: performance.now() };
  }
  // Into a museum, or a building's own view (land.js: its city its way back up, as a museum's is).
  function goInto(a, via) {
    if (a.kind === "building") { Land.city.building(a.file, via); } else { Land.city.museum(a.slug, via); }
  }
  function pressArt(a, x, y) {
    if (stands(a)) { rememberView(a.slug); goInto(a); }
    else { Land.city.venue(a.vi, x, y); if (Land.city.pulse) { Land.city.pulse(x, y, 55); } }
  }
  function lightArt(k, on) {
    var was = litArt;
    litArt = on ? k : (litArt === k ? -1 : litArt);
    if (was === litArt) { return; }
    var a = k >= 0 ? city.arts[k] : null;
    if (a && a.kind === "museum") { Land.city.light(a.slug, on); }
    if (a && a.kind === "gallery") {
      (Land.city.state() || { venueBoxes: [] }).venueBoxes.forEach(function (box) {
        if (box.vis && box.vis.indexOf(a.vi) >= 0) { if (on) { box.dataset.lit = "true"; } else { delete box.dataset.lit; } }
      });
    }
    if (on && !still && a) { pulseAt = performance.now(); pulseArt = k; }
    placed = "";
  }

  function avoidRects() {
    // The city's ring on the categories (land.js): its names are the instrument, kept clear.
    var out = Land.dialGround && Land.dialGround.catRects ? Land.dialGround.catRects().slice() : [];
    ["#art-time", "#art-col", ".banner", "#filter", ".guide-pill", ".kinds"].forEach(function (s) {
      document.querySelectorAll(s).forEach(function (e) {
        if (e.hidden || e.closest(".skyline")) { return; }
        var r = e.getBoundingClientRect();
        if (r.width && r.height && getComputedStyle(e).visibility !== "hidden") { out.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }); }
      });
    });
    return out;
  }
  function meets(a, b, pad) { return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad; }

  var placed = "", nameRects = [];
  function placeNames(now) {
    var cr = Land.dialGround && Land.dialGround.catRects ? Land.dialGround.catRects() : [];
    var f = frameNow, key = [view.heading.toFixed(3), view.zoom.toFixed(3), view.px | 0, view.py | 0, band.x, band.y, band.w, band.h,
                              litArt, shownNow.toFixed(3), city.yearNow, namedTap ? namedTap.k : -1, cat,
                              cr.map(function (b) { return Math.round(b.x0) + ":" + Math.round(b.y0); }).join(";")].join(",");
    if (key === placed) { return; }
    placed = key;
    var W = window.innerWidth, H = window.innerHeight;
    var budget = Math.max(5, Math.min(21, Math.round(W * H / 46000)));
    var avoid = avoidRects(), boxes = [], count = 0;
    // Most first: the museums (most saved first), the buildings, then the galleries (busiest first).
    var RANK = { museum: 0, building: 1, gallery: 2 };
    var order = marks.slice().sort(function (p, q) {
      var a = p.a, b = q.a;
      if (a.kind !== b.kind) { return RANK[a.kind] - RANK[b.kind]; }
      return a.kind === "museum" ? (b.m.held || 0) - (a.m.held || 0) : a.kind === "gallery" ? b.n - a.n : 0;
    });
    // On Architecture the museums give way only where a building of the layer stands in the square.
    var builds = city.arts.some(function (x) { return x.kind === "building"; });
    // No name over a museum's diamond or a building's square (the way in), its own aside.
    var diamonds = marks.filter(function (mk) { return stands(mk.a); }).map(function (mk) {
      var q = toScreen(project(f, mk.a.at.x, mk.a.at.y, mk.a.top));
      return { k: mk.a.k, x0: q.x - 5, y0: q.y - 5, x1: q.x + 5, y1: q.y + 5 };
    });
    order.forEach(function (mk) {
      var a = mk.a, p = toScreen(project(f, a.at.x, a.at.y, a.top));
      mk.x = p.x; mk.y = p.y;
      var inside = p.x > band.x + 2 && p.x < band.x + band.w - 2 && p.y > band.y + 2 && p.y < band.y + band.h - 2;
      var later = a.kind === "gallery" && a.y0 && city.yearNow && a.y0 > city.yearNow;
      mk.btn.hidden = !inside;
      if (!inside) { mk.named = false; return; }
      if (!mk.w) { mk.btn.dataset.named = "true"; mk.w = mk.btn.offsetWidth; mk.h = mk.btn.offsetHeight; }
      // Another category chosen (the philosophers, the artists, the animal, the buildings): the museums and
      // galleries give way, named only when pointed at or tapped; their rings and diamonds stay. On
      // Architecture the buildings are what is named.
      var quiet = (cat === "philosophers" || cat === "studios" || cat === "characters" || cat === "architecture" && builds) &&
        !(cat === "architecture" && a.kind === "building");
      var want = !quiet && (stands(a) || count < budget) && !later || litArt === a.k || namedTap === a;
      var spot = null;
      if (want && (count < budget || litArt === a.k || namedTap === a)) {
        // Right of it, else left; a museum or a building may be lifted or dropped a line.
        var tries = [[p.x + 7, p.y - mk.h / 2], [p.x - 7 - mk.w, p.y - mk.h / 2]];
        if (stands(a)) { tries.push([p.x - 6, p.y - mk.h - 8], [p.x - mk.w + 6, p.y - mk.h - 8], [p.x - 6, p.y + 8], [p.x - mk.w + 6, p.y + 8]); }
        tries.some(function (xy) {
          var b = { x0: xy[0], y0: xy[1], x1: xy[0] + mk.w, y1: xy[1] + mk.h };
          if (b.x0 < band.x + 4 || b.x1 > band.x + band.w - 4 || b.y0 < band.y + 2 || b.y1 > band.y + band.h - 2) { return false; }
          if (avoid.some(function (r) { return meets(b, r, 4); })) { return false; }
          if (boxes.some(function (r) { return meets(b, r, 3); })) { return false; }
          if (diamonds.some(function (r) { return r.k !== a.k && meets(b, r, 1); })) { return false; }
          spot = b;
          return true;
        });
      }
      mk.named = !!spot;
      if (spot) {
        boxes.push(spot);
        count += 1;
        mk.btn.dataset.named = "true";
        mk.btn.style.transform = "translate(" + Math.round(spot.x0) + "px," + Math.round(spot.y0) + "px)";
      } else {
        // Unnamed: a 24 px target on its building, its name shown on hover or focus.
        delete mk.btn.dataset.named;
        mk.btn.style.transform = "translate(" + Math.round(p.x - 12) + "px," + Math.round(p.y - 12) + "px)";
      }
      if (litArt === a.k) { mk.btn.dataset.lit = "true"; } else { delete mk.btn.dataset.lit; }
      if (later) { mk.btn.dataset.later = "true"; } else { delete mk.btn.dataset.later; }
    });
    nameRects = boxes.concat(avoid);
  }

  /* ---- pixel light: rings round the museums, and their marks -------------- */

  var pulseAt = 0, pulseArt = -1;
  function paintLight(now) {
    var k = Math.min(window.devicePixelRatio || 1, 3), W = window.innerWidth, H = window.innerHeight;
    var pw = Math.round(W * k), ph = Math.round(H * k);
    if (light.width !== pw || light.height !== ph) { light.width = pw; light.height = ph; }
    var g = light.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, pw, ph);
    g.setTransform(k, 0, 0, k, 0, 0);
    var f = frameNow, n = city.n, half = n / 2, age = now - pulseAt;
    if (into && f.scale * 1.42 > T * 0.9) { return; }
    city.arts.forEach(function (a) {
      if (!a.cells.length) { return; }
      var risen = !city.years || !stands(a) || shownNow >= 0;
      var on = {}, ring = {};
      a.cells.forEach(function (c) {
        var p = toScreen(project(f, c % n - half + 0.5, Math.floor(c / n) - half + 0.5, a.z0));
        on[Math.floor(p.x / T) + "," + Math.floor(p.y / T)] = 1;
      });
      if (!stands(a) && litArt !== a.k) { return; }
      Object.keys(on).forEach(function (kk) {
        var ij = kk.split(",").map(Number);
        for (var di = -1; di <= 1; di += 1) {
          for (var dj = -1; dj <= 1; dj += 1) {
            var o = (ij[0] + di) + "," + (ij[1] + dj);
            if (!on[o]) { ring[o] = 1; }
          }
        }
      });
      var lv = litArt === a.k ? 3 : stands(a) ? 2 : 1;
      if ((pulseArt === a.k || (pulseArt === -2 && stands(a))) && age >= 0 && age < 1100 && !still) {
        [0, 330, 640].forEach(function (at, e) {
          var t = age - at;
          if (t >= 0 && t < 360) { lv = Math.max(lv, Math.ceil((1 - t / 360) * 4 * Math.pow(1 / PHI, e))); }
        });
      }
      g.fillStyle = LIGHT;
      Object.keys(ring).forEach(function (kk) {
        var ij = kk.split(",").map(Number);
        var x = ij[0] * T, y = ij[1] * T;
        if (x < band.x || y < band.y || x + T > band.x + band.w || y + T > band.y + band.h) { return; }
        var l = lv - (hash(ij[0], ij[1]) < 0.22 && lv > 1 ? 1 : 0);
        g.globalAlpha = LEVELS[Math.min(4, l)] * (risen ? 1 : 0.6);
        g.fillRect(x + 1, y + 1, T - 2, T - 2);
      });
    });
    // A museum's mark is the city's diamond, at the top of its building; a building's a square in
    // Architecture's tone, as it is on the globe (KINDS.md); a gallery's a lilac point.
    g.globalAlpha = 1;
    marks.forEach(function (mk) {
      if (mk.btn.hidden) { return; }
      var a = mk.a;
      if (a.kind === "building") {
        var sq = litArt === a.k ? 4.5 : 3.5;
        g.fillStyle = "#b8a48a";
        g.fillRect(Math.round(mk.x - sq), Math.round(mk.y - sq), sq * 2, sq * 2);
      } else if (a.kind === "museum") {
        var s = litArt === a.k ? 5 : 4;
        g.fillStyle = "#eadfcd";
        g.beginPath();
        g.moveTo(mk.x, mk.y - s); g.lineTo(mk.x + s, mk.y); g.lineTo(mk.x, mk.y + s); g.lineTo(mk.x - s, mk.y);
        g.closePath(); g.fill();
      } else {
        g.fillStyle = LILAC;
        g.globalAlpha = mk.btn.dataset.later ? 0.35 : 0.9;
        g.fillRect(Math.round(mk.x) - 1.5, Math.round(mk.y) - 1.5, 3, 3);
        g.globalAlpha = 1;
      }
    });
    paintWalkers(g, now);
    paintBits(g, now);
  }

  /* ---- the artists, walking ---------------------------------------------- */

  var walkers = [], nextCome = 0, crowd = 2, roster = [];
  function eligible(y) {
    // The philosophers born here: all of them while the dial rests at now; turned to a year, those alive then.
    if (cat === "philosophers" && !city.yearNow) { return roster.slice(); }
    return roster.filter(function (r) {
      return r[5].some(function (s) { return s[0] <= y && y <= s[1]; });
    });
  }

  /* ---- the category the city shows ----------------------------------------
     The artist, 15 Oct 2026: "The dial around the globe or the cities is the answer to being able to shift
     through categories seamlessly while the dial being able to be other tools as well", and "Introduce
     notable philosophers as character relative to their native country or city". The world's category —
     chosen on the globe's dial, or on the city's own turned to the categories by its crown (land.js,
     "the city's dial on the categories") — is what the city shows. Philosophers: the philosophers born
     here walk its streets in the dress of their time and place (philosophers.js), all of them while the
     dial rests at now and, turned to a year, those alive then, each named, a press their card. Artists:
     its artists walk, named. Characters: no one walks; its own animal, the dial's hand, says what it is.
     The rest: as it was, the museums named and its artists walking, named when pointed at. */
  var cat = "", philRows = null, philAsked = null;
  function philosophersHere(key) {
    if (!philRows) {
      if (!philAsked && window.Philosophers && Philosophers.load) {
        philAsked = Philosophers.load().then(function (d) { philRows = (d && d.people) || []; cat = ""; }).catch(function () { philAsked = null; });
      }
      return [];
    }
    // Most read first (the rows' own order is by how many Wikipedias have them), as a walker is chosen.
    return philRows.filter(function (r) { return r[10] === key; }).sort(function (a, b) { return b[9] - a[9]; }).map(function (r) {
      return [r[0], r[2], null, null, null, [[r[3], r[4] === null || r[4] === undefined ? NOW : r[4], "born"]], [], null, { phil: r }];
    });
  }
  function castFor(now) {
    var was = cat;
    cat = Land.layer ? Land.layer() : "museums";
    var phone = window.innerWidth <= 720;
    if (cat === "philosophers") { roster = philosophersHere(city.key); crowd = phone ? 3 : 5; }
    else if (cat === "characters") { roster = []; crowd = 0; }
    else { roster = (artistsAll[city.key] || []).slice(); crowd = phone ? 6 : 10; }
    // Who walks for another category goes; the new come soon after.
    walkers.forEach(function (w) { if (!w.leaving && roster.indexOf(w.r) < 0 && !roster.some(function (r) { return r[0] === w.r[0]; })) { w.leaving = now; } });
    nextCome = Math.min(nextCome, now + (still ? 0 : 500));
    if (was && was !== cat) {
      if (cat === "characters" && ground.hand && ground.box) { handTapped(); }
      if (window.A11y && A11y.say) { var said = noteFor(); if (said) { A11y.say(said); } }
    }
  }
  // The quiet line at the foot: what the category holds here, in the dial's year.
  function noteFor() {
    if (!city) { return ""; }
    var y = city.yearNow;
    if (cat === "philosophers") {
      var n = roster.length;
      if (!n) { return philRows ? "No philosopher on the site was born here" : ""; }
      return y ? y + " · " + plural(eligible(y).length, "philosopher", "philosophers") + " alive of " + n + " born here"
        : plural(n, "philosopher", "philosophers") + " born here";
    }
    if (cat === "characters") {
      var own = ground.hand && ground.hand.line ? ground.hand.line.split(" · ")[0] + " · its own animal, the dial's hand" : "";
      var here = bitsHere().map(function (b) { return b.title + " at " + b.place.split(",")[0]; });
      return [own].concat(here).filter(Boolean).join(" · ");
    }
    var builds = city.arts.filter(function (a) { return a.kind === "building"; });
    if (cat === "architecture" && builds.length) {
      return builds.map(function (a) { return a.full + (a.year ? " · " + a.year : ""); }).join(" · ");
    }
    return y ? y + " · " + plural(eligible(y).length, "artist here", "artists here") : "";
  }
  function yearOf() { return city.yearNow || NOW; }
  function startCell(r) {
    var door = r[7];
    if (door) {
      var at = city.toCell(door[0], door[1]), n = city.n;
      var ci = Math.round(at.y + n / 2 - 0.5), cj = Math.round(at.x + n / 2 - 0.5), best = -1, bd = Infinity;
      for (var di = -4; di <= 4; di += 1) {
        for (var dj = -4; dj <= 4; dj += 1) {
          var ii = ci + di, jj = cj + dj;
          if (ii < 0 || jj < 0 || ii >= n || jj >= n || !city.isWalk[ii * n + jj]) { continue; }
          var d = di * di + dj * dj;
          if (d < bd) { bd = d; best = ii * n + jj; }
        }
      }
      if (best >= 0) { return best; }
    }
    // Else a street toward the middle, where the museums are.
    for (var t = 0; t < 30; t += 1) {
      var q = city.walk[Math.floor(Math.random() * city.walk.length)];
      var n2 = city.n, dx = q % n2 - n2 / 2, dy = Math.floor(q / n2) - n2 / 2;
      if (Math.abs(dx) < n2 * 0.33 && Math.abs(dy) < n2 * 0.33) { return q; }
    }
    return city.walk[Math.floor(Math.random() * city.walk.length)];
  }
  function come(r, now) {
    var q = startCell(r);
    // Cells a second, as fast across the screen however fine the grid (its pace was set at ~40 m a cell).
    var pace = Math.max(1, 40 / city.cell);
    var w = { r: r, q: q, to: q, t: 1, dir: -1, speed: (0.55 + Math.random() * 0.3) * pace, at: still ? now - 600 : now, until: still ? Infinity : now + 21000 + Math.random() * 13000,
              leaving: 0, step: Math.random(), named: false, x: 0, y: 0 };
    w.ink = (r[6] || []).map(hex).filter(Boolean);
    w.phil = r[8] && r[8].phil ? r[8].phil : null;
    w.btn = el("button", "skyline-who" + (w.phil ? " skyline-phil" : ""));
    w.btn.type = "button";
    var span = r[5].filter(function (s) { return s[0] <= yearOf() && yearOf() <= s[1]; })[0] || r[5][0];
    if (w.phil) {
      w.btn.setAttribute("aria-label", w.phil[1] + " — born here, " + (window.Philosophers ? Philosophers.lifeSaid(w.phil) : w.phil[3]) +
        "; a philosopher: their card");
    } else {
      w.btn.setAttribute("aria-label", r[1] + " — " + (span[2] === "born" ? "born here" : "here") + ", " + span[0] +
        (span[1] > span[0] ? "–" + span[1] : "") + "; their life");
    }
    w.btn.appendChild(el("span", "skyline-who-name", r[1]));
    w.btn.addEventListener("pointerdown", function () { w.shownAtDown = !!w.btn.dataset.named; });
    w.btn.addEventListener("click", function (event) {
      event.stopPropagation();
      if (coarse && event.detail && !w.named && !w.shownAtDown) { w.named = true; w.btn.dataset.named = "true"; return; }
      if (w.phil) { if (window.Philosophers) { Philosophers.open(w.phil[0]); } return; }
      openLife(w.r);
    });
    w.btn.addEventListener("pointerenter", function () { w.hover = true; });
    w.btn.addEventListener("pointerleave", function () { w.hover = false; });
    w.btn.addEventListener("focus", function () { w.hover = true; });
    w.btn.addEventListener("blur", function () { w.hover = false; });
    names.appendChild(w.btn);
    walkers.push(w);
    return w;
  }
  function openLife(r) {
    if (!window.Lives || !Lives.open) { return; }
    var y = yearOf(), here = r[5].some(function (s) { return s[0] <= y && y <= s[1]; });
    Lives.open(r[0], here && city.yearNow ? { year: y } : {});
  }
  function stepWalkers(now, dt) {
    var y = yearOf(), ok = eligible(y);
    var okIds = {};
    ok.forEach(function (r) { okIds[r[0]] = true; });
    walkers.forEach(function (w) {
      if (!w.leaving && (now > w.until || !okIds[w.r[0]]) && !w.hover && !w.lit) { w.leaving = now; }
    });
    walkers = walkers.filter(function (w) {
      if (w.leaving && now - w.leaving > 600) { w.btn.remove(); return false; }
      return true;
    });
    var out = walkers.map(function (w) { return w.r[0]; });
    if (walkers.length < crowd && now >= nextCome) {
      var free = ok.filter(function (r) { return out.indexOf(r[0]) < 0; });
      if (free.length) {
        // The most saved more often, never always.
        var pick = free[Math.floor(Math.pow(Math.random(), 1.6) * free.length)];
        come(pick, now);
        nextCome = now + (still ? 0 : 1600 + Math.random() * 2400);
      }
    }
    if (still) { return; }
    var n = city.n;
    walkers.forEach(function (w) {
      w.t += dt / 1000 * w.speed;
      w.step += dt / 1000 * 3;
      while (w.t >= 1) {
        w.t -= 1;
        w.q = w.to;
        var opts = [], q = w.q, i = Math.floor(q / n), j = q % n;
        [[-1, 0, 0], [1, 0, 1], [0, -1, 2], [0, 1, 3]].forEach(function (d) {
          var ii = i + d[0], jj = j + d[1];
          if (ii >= 0 && jj >= 0 && ii < n && jj < n && city.isWalk[ii * n + jj]) { opts.push([ii * n + jj, d[2]]); }
        });
        var back = w.dir >= 0 ? w.dir ^ 1 : -1;
        var on = opts.filter(function (o) { return o[1] === w.dir; });
        var turn = opts.filter(function (o) { return o[1] !== back; });
        var pick = on.length && Math.random() < 0.72 ? on[0] : turn.length ? turn[Math.floor(Math.random() * turn.length)] : opts[0];
        if (!pick) { w.to = w.q; w.dir = -1; break; }
        w.to = pick[0]; w.dir = pick[1];
      }
    });
  }
  function walkerAt(w) {
    var n = city.n;
    var x0 = w.q % n - n / 2 + 0.5, y0 = Math.floor(w.q / n) - n / 2 + 0.5;
    var x1 = w.to % n - n / 2 + 0.5, y1 = Math.floor(w.to / n) - n / 2 + 0.5;
    var x = x0 + (x1 - x0) * w.t, y = y0 + (y1 - y0) * w.t;
    var z = city.zAt(w.t < 0.5 ? w.q : w.to);
    return toScreen(project(frameNow, x, y, z));
  }
  var CREAM = [234, 223, 205], LILA = [157, 149, 230], INK_DARK = [15, 10, 7];
  /* A figure, four pixels wide and eight tall: a head (the artist's lightest ink, or the
     site's lilac), a coat (their middle ink, cream where none), legs mid-stride (their
     darkest) — outlined in the night's dark so it reads over any roof or street, and on a
     faint tile of pixel light, so a walker is found at a glance. */
  var FIGURE = {
    head: [[1, 0], [2, 0], [1, 1], [2, 1]],
    coat: [[0, 2], [1, 2], [2, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3], [1, 4], [2, 4], [0, 4], [3, 4], [1, 5], [2, 5]],
    legs: [[[1, 6], [2, 6], [0, 7], [3, 7]], [[1, 6], [2, 6], [1, 7], [2, 7]]]
  };
  function paintWalkers(g, now) {
    var phone = window.innerWidth <= 720;
    var u = Math.min(3, (phone ? 1.75 : 2) * Math.sqrt(view.zoom));
    // A philosopher's figure (40 cells tall) at whole device pixels a cell: about 30 px on a phone, 36 on a desktop.
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var pu = Math.max(1, Math.round((phone ? 30 : 36) * Math.min(PHI, Math.sqrt(view.zoom)) * dpr / 40)) / dpr;
    var told = (nameRects || []).slice();
    walkers.forEach(function (w) {
      var p = walkerAt(w);
      if (w.phil) {
        if (Math.abs(p.x - w.x) > 0.05) { w.face = p.x > w.x ? 1 : -1; }
        w.x = p.x; w.y = p.y;
        paintPhil(g, w, p, now, pu, told);
        return;
      }
      w.x = p.x; w.y = p.y;
      var inside = p.x > band.x + 4 && p.x < band.x + band.w - 4 && p.y > band.y + 18 && p.y < band.y + band.h - 2;
      w.btn.hidden = !inside;
      if (!inside) { return; }
      var fade = Math.min(1, (now - w.at) / 600);
      if (w.leaving) { fade = Math.max(0, 1 - (now - w.leaving) / 600); }
      fade = Math.round(fade * 4) / 4;          // in steps, as the pixel light comes and goes
      var lit = w.hover || w.lit;
      // Its tile of light, on the screen's grid.
      g.globalAlpha = fade * LEVELS[lit ? 3 : 1];
      g.fillStyle = LIGHT;
      g.fillRect(Math.floor(p.x / T) * T + 1, Math.floor((p.y - 4 * u) / T) * T + 1, T - 2, T - 2);
      var ink = w.ink, head = ink.length ? ink[ink.length - 1] : LILA, body = ink.length > 1 ? ink[Math.floor(ink.length / 2)] : CREAM,
          legs = ink.length ? ink[0] : [120, 104, 90];
      var x0 = Math.round(p.x - 2 * u), y0 = Math.round(p.y - 8 * u);
      var frame = still ? 0 : Math.floor(w.step) % 2;
      var cells = FIGURE.head.map(function (c) { return [c[0], c[1], head]; })
        .concat(FIGURE.coat.map(function (c) { return [c[0], c[1], c[1] === 2 && c[0] === 0 ? mixTo(body, [0, 0, 0], 0.22) : body]; }))
        .concat(FIGURE.legs[frame].map(function (c) { return [c[0], c[1], legs]; }));
      // The outline first, a pixel round every cell.
      g.globalAlpha = fade * 0.9;
      g.fillStyle = "rgb(" + INK_DARK.join(",") + ")";
      cells.forEach(function (c) { g.fillRect(x0 + c[0] * u - 1, y0 + c[1] * u - 1, u + 2, u + 2); });
      g.globalAlpha = fade * 0.45;
      g.fillRect(x0 - u * 0.5, y0 + 8 * u, 5 * u, u);                // its shadow
      g.globalAlpha = fade;
      cells.forEach(function (c) {
        g.fillStyle = "rgb(" + (c[2][0] | 0) + "," + (c[2][1] | 0) + "," + (c[2][2] | 0) + ")";
        g.fillRect(x0 + c[0] * u, y0 + c[1] * u, u, u);
      });
      if (!ink.length) { g.fillStyle = LILAC; g.fillRect(x0 + u, y0, 2 * u, u); }
      g.globalAlpha = 1;
      if (lit) {
        g.strokeStyle = LILAC; g.lineWidth = 1;
        g.strokeRect(x0 - 3.5, y0 - 3.5, 4 * u + 7, 9 * u + 7);
      }
      // Named when pointed at; on the Artists, always where the name has room.
      var named = lit || w.named || (cat === "studios" && fitsName(w, p.x + 10, p.y - 4 * u - 12, told));
      if (named) { w.btn.dataset.named = "true"; } else { delete w.btn.dataset.named; }
      w.btn.style.transform = "translate(" + Math.round(p.x - 12) + "px," + Math.round(p.y - 4 * u - 12) + "px)";
    });
    g.globalAlpha = 1;
  }
  // A walker's name beside it, if it meets no museum's name nor another walker's (told: the names given).
  function fitsName(w, x0, y0, told) {
    if (!w.nw) {
      var was = w.btn.dataset.named;
      w.btn.dataset.named = "true";
      var nm = w.btn.lastChild;
      w.nw = nm ? nm.offsetWidth : 60;
      if (!was) { delete w.btn.dataset.named; }
    }
    var b = { x0: x0, y0: y0, x1: x0 + w.nw, y1: y0 + 24 };
    if (b.x1 > band.x + band.w - 2 || b.x0 < band.x + 2 || b.y0 < band.y || b.y1 > band.y + band.h) { return false; }
    if (told.some(function (r) { return meets(b, r, 2); })) { return false; }
    told.push(b);
    return true;
  }
  // A philosopher walking: their figure in the dress of their time and place, its feet on the street, a
  // tile of the pixel light under them; named beside them where there is room.
  function paintPhil(g, w, p, now, pu, told) {
    var fh = 40 * pu;
    var inside = p.x > band.x + 4 && p.x < band.x + band.w - 4 && p.y > band.y + fh * 0.6 && p.y < band.y + band.h - 2;
    w.btn.hidden = !inside;
    if (!inside || !window.Philosophers) { return; }
    var fade = Math.min(1, (now - w.at) / 600);
    if (w.leaving) { fade = Math.max(0, 1 - (now - w.leaving) / 600); }
    fade = Math.round(fade * 4) / 4;
    var lit = w.hover || w.lit;
    g.globalAlpha = fade * LEVELS[lit ? 3 : 1];
    g.fillStyle = LIGHT;
    g.fillRect(Math.floor(p.x / T) * T + 1, Math.floor((p.y - 3) / T) * T + 1, T - 2, T - 2);
    g.globalAlpha = fade * 0.45;
    g.fillStyle = "rgb(" + INK_DARK.join(",") + ")";
    g.fillRect(Math.round(p.x - 5 * pu), Math.round(p.y), Math.round(10 * pu), Math.max(1, Math.round(pu)));     // its shadow
    g.globalAlpha = fade;
    var frame = still ? 0 : Math.floor(w.step * 2) % 4;
    var at = Philosophers.draw(g, w.phil[0], p.x, p.y, still ? "stand" : "walk", frame, w.face || 1, pu);
    g.globalAlpha = 1;
    if (lit && at) {
      g.strokeStyle = LILAC; g.lineWidth = 1;
      g.strokeRect(Math.round(p.x - 8 * pu) - 2.5, at.y + 2.5, Math.round(16 * pu) + 5, at.h - 2);
    }
    var top = Math.round(p.y - fh * 0.62);
    var named = lit || w.named || fitsName(w, p.x + 10, top, told);
    if (named) { w.btn.dataset.named = "true"; } else { delete w.btn.dataset.named; }
    w.btn.style.height = Math.round(fh * 0.9) + "px";
    w.btn.style.transform = "translate(" + Math.round(p.x - 12) + "px," + Math.round(p.y - fh * 0.9) + "px)";
  }

  /* ---- a filmed bit, where it was filmed -----------------------------------
     The artist, 14 Oct 2026: "Recreate a gif like animation of this YouTube short. Create Ed Bassmaster's
     character and have it link to his YouTube". While the city shows its Characters, a bit filmed here
     (characters/bits.json, bits.js: Royal Nothin at Horse Guards, London) stands at its own point — the
     trooper on his horse and the figure beside him, in step with its loop, the figure walking off toward
     you and back — on a tile of the pixel light, named where there is room; a press is its card (on a touch
     screen a first tap names it). Under reduced motion it stands still. */
  var bits = [], bitsAsked = false;
  function bitsHere() {
    if (cat !== "characters" || !window.Bits || !city) { return []; }
    var all = Bits.list();
    if (!all.length) {
      // Asked once; when the bits come the light is painted again (in Characters no walker would), and a
      // failed read is asked again half a minute on.
      if (!bitsAsked) {
        bitsAsked = true;
        Bits.load().then(function (d) {
          if (d && d.bits && d.bits.length) { bitsAsked = false; lightKey = ""; dirty = true; }
          else { window.setTimeout(function () { bitsAsked = false; }, 30000); }
        });
      }
      return [];
    }
    return all.filter(function (b) { return b.town === city.key; });
  }
  function paintBits(g, now) {
    var list = bitsHere();
    bits = bits.filter(function (o) { if (list.indexOf(o.b) < 0) { o.btn.remove(); return false; } return true; });
    list.forEach(function (b) {
      if (bits.some(function (o) { return o.b === b; })) { return; }
      var o = { b: b, hover: false, named: false };
      o.btn = el("button", "skyline-who skyline-bit");
      o.btn.type = "button";
      o.btn.hidden = true;                          // until the pair is drawn and the button laid over it
      o.btn.setAttribute("aria-label", b.title + " — after " + b.who + "'s short, filmed at " + b.place + "; its card");
      o.btn.appendChild(el("span", "skyline-who-name", b.title));
      o.btn.addEventListener("pointerdown", function () { o.shownAtDown = !!o.btn.dataset.named; });
      o.btn.addEventListener("click", function (event) {
        event.stopPropagation();
        // On a touch screen a first tap names it (the finger's own light named it already; what counts is
        // whether it was named before the finger came down); the keys open it at once.
        if (coarse && event.detail && !o.named && !o.shownAtDown) { o.named = true; o.btn.dataset.named = "true"; return; }
        Bits.open(b.key);
      });
      o.btn.addEventListener("pointerenter", function () { o.hover = true; });
      o.btn.addEventListener("pointerleave", function () { o.hover = false; });
      o.btn.addEventListener("focus", function () { o.hover = true; });
      o.btn.addEventListener("blur", function () { o.hover = false; });
      names.appendChild(o.btn);
      bits.push(o);
    });
    if (!bits.length) { return; }
    var phone = window.innerWidth <= 720, dpr = Math.min(3, window.devicePixelRatio || 1);
    var pu = Math.max(1, Math.round((phone ? 30 : 36) * Math.min(PHI, Math.sqrt(view.zoom)) * dpr / 40)) / dpr;
    var told = (nameRects || []).slice();
    bits.forEach(function (o) {
      var at = city.toCell(o.b.point[0], o.b.point[1]), n = city.n;
      var ci = Math.max(0, Math.min(n - 1, Math.round(at.y + n / 2 - 0.5))), cj = Math.max(0, Math.min(n - 1, Math.round(at.x + n / 2 - 0.5)));
      var p = toScreen(project(frameNow, at.x, at.y, city.zAt(ci * n + cj)));
      var inside = p.x > band.x + 24 && p.x < band.x + band.w - 24 && p.y > band.y + 60 * pu && p.y < band.y + band.h - 2;
      o.btn.hidden = !inside;
      if (!inside) { return; }
      var lit = o.hover;
      g.globalAlpha = LEVELS[lit ? 3 : 1];
      g.fillStyle = LIGHT;
      g.fillRect(Math.floor(p.x / T) * T + 1, Math.floor((p.y - 3) / T) * T + 1, T - 2, T - 2);
      g.globalAlpha = 0.45;
      g.fillStyle = "rgb(" + INK_DARK.join(",") + ")";
      g.fillRect(Math.round(p.x - 24 * pu), Math.round(p.y), Math.round(44 * pu), Math.max(1, Math.round(pu)));   // their shadow
      g.globalAlpha = 1;
      var box = Bits.drawPair(g, o.b.key, p.x, p.y, now, pu, { still: still });
      if (!box) { o.btn.hidden = true; return; }
      if (lit) {
        g.strokeStyle = LILAC; g.lineWidth = 1;
        g.strokeRect(box.x0 - 2.5, box.y0 - 2.5, box.x1 - box.x0 + 5, box.y1 - box.y0 + 5);
      }
      var bw = Math.max(24, box.x1 - box.x0), bh = Math.max(24, box.y1 - box.y0);
      o.btn.style.width = bw + "px";
      o.btn.style.height = bh + "px";
      o.btn.style.setProperty("--bit-w", bw + "px");
      o.btn.style.transform = "translate(" + Math.round(box.x0) + "px," + Math.round(box.y0) + "px)";
      var named = lit || o.named || fitsName(o, box.x1 + 2, box.y0, told);
      if (named) { o.btn.dataset.named = "true"; } else { delete o.btn.dataset.named; }
    });
  }

  /* ---- the ground dial ------------------------------------------------------

     The artist, 14 Oct 2026, with four frames of the red fox at the edge of a city's skyline beside the
     dial's rim: "What if the time dial laid on the same plane the fox walked on and the fox (characters
     in the website) became the time dial?" So, on a city's skyline, the city's dial lies on its ground: a
     ring round the city's block in the same true isometric (a circle on the ground, an ellipse on the
     screen), where now meets the beginning at its front, nearest you; its marks — the years works came
     here, lit as they are passed, the hub's arcs, a path's stops — outside it, away from the city. Its
     drawing is the dial's own (land.js, paintDial through groundCtx); the half behind the city is painted
     under the skyline, so its towers stand in front of it, the half before it over them. The ring is
     fixed to the screen, not to the ground: the city turns inside it.

     The place's own animal (characters.js, Characters.hand: the native a wave here would bring, after its
     native artist) is its hand. It walks to the dial's year — round the whole ring the first time, the
     city rising inside it — trots when time goes fast, walks when it is led slowly, and at now sits at
     the gap where the ring begins and ends, facing the beginning. Leading it is turning time: drag the
     animal, or anywhere on the ring (a press there turns the year to it, as on the round dial). A tap on
     the animal says what it is, or plays and pauses a path; a wheel over it turns time, a crown. The year
     rides upright beside it (land.js, groundLabel), with the hub's word and readout, and the range under
     them keeps the keyboard. Under reduced motion it is placed, never trotting. Where the place has no
     animal drawn, the dial's diamond is the hand. GROUND = false brings the round dial back here. */
  var GROUND = true;
  var RING = 0.76;                    // the ring's radius, of the block's side (its corners are at 0.707)
  var DIAL_GAP = 18 * Math.PI / 180, DIAL_START = -Math.PI / 2 + DIAL_GAP / 2, DIAL_SWEEP = TAU - DIAL_GAP;
  var SAY_MS = Math.pow(PHI, 5) * 1000;
  var TROT = 58;                      // characters.js's trot, CSS px a second: a gait's frames at that pace
  var ground = { on: false, ring: null, hand: null, key: null, box: null, painted: "", scale: 1,
                 hs: { t: 1, v: 0, dir: -1, phase: 0, last: -1e9, alt: 0, pose: "sit", n: 0, half: "front", x: 0, y: 0, said: 0 } };

  // Room for the animal round the ring (CSS px): beside it at the ring's sides, over the ring's far side,
  // under the near side (the first year at the gap).
  function handRoom() {
    var phone = window.innerWidth <= 720;
    var b = ground.hand ? ground.hand.box(ground.scale) : null;
    // Before it has come, the room of a place's own (40 × 26 cells), so the city does not jump when it does.
    return { side: b ? Math.max(18, b.w / 2 + 6) : (phone ? 40 : 56), up: b ? b.h + 6 : (phone ? 49 : 71), foot: 18 };
  }
  // The animal at a size of its own pixels (whole device pixels a cell, so its dots stay crisp): about 44 px
  // tall on a phone, 60 on a desktop, a little more as the city is brought nearer.
  function handScale() {
    var h = ground.hand;
    if (!h) { return 1; }
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var want = (window.innerWidth <= 720 ? 44 : 60) * Math.min(PHI, Math.sqrt(view.zoom));
    var k = Math.max(1, Math.round(want * dpr / h.cells.h));
    if (k * h.cells.h / dpr < want * 0.8) { k += 1; }
    return k / (h.cells.cell * dpr);
  }
  // Where the ring lies on the screen, from the frame as drawn.
  function ringNow() {
    var f = frameNow;
    return f && f.ring ? { cx: band.x + f.cx0, cy: band.y + f.cy0, R: f.ring * f.scale, st: f.st } : null;
  }
  function ringAt(r, t) {
    var a = DIAL_START + t * DIAL_SWEEP + Math.PI;
    return { x: r.cx + Math.cos(a) * r.R, y: r.cy + Math.sin(a) * r.R * r.st };
  }
  // The animal, each frame: to the dial's year on the ring, its gait by how fast it went there.
  function stepHand(now, dt) {
    var r = ground.ring, hs = ground.hs, h = ground.hand;
    var dv = Land.dial ? Land.dial() : null;
    var t = dv && typeof dv.t === "number" ? dv.t : 1;
    var p = ringAt(r, t), p0 = ringAt(r, hs.t);       // on the ring as it lies now: a zoom is not a walk
    var went = Math.hypot(p.x - p0.x, p.y - p0.y);
    hs.t = t;
    var v = dt > 0 ? went / dt * 1000 : 0;
    hs.v += (v - hs.v) * Math.min(1, dt / 160);
    if (went > 0.04) {
      hs.last = now;
      if (Math.abs(p.x - p0.x) > 0.04) { hs.dir = p.x > p0.x ? 1 : -1; }
    }
    var moving = now - hs.last < 160;
    var mv = h ? h.mv : { fps: 6, speed: 1, lift: 0 };
    if (moving && !still) {
      hs.pose = "trot";
      hs.phase += dt / 1000 * mv.fps * Math.max(0.5, Math.min(2.2, hs.v / (TROT * (mv.speed || 1))));
      hs.n = Math.floor(hs.phase) % 4;
    } else if (now < hs.said) {
      hs.pose = "look"; hs.n = 0;
    } else {
      var waited = now - hs.last;
      hs.pose = still ? (moving || waited < 1600 ? "stand" : "sit") : waited > 4200 ? "sit" : waited > 1600 ? "look" : "stand";
      hs.n = 0;
    }
    // A bird or a butterfly flies its years and comes down to stand.
    var lift = (mv.lift || 0) * Math.min(PHI, Math.sqrt(view.zoom));
    hs.alt += ((moving && !still ? lift : 0) - hs.alt) * Math.min(1, dt / 220);
    if (hs.alt < 0.2) { hs.alt = 0; }
    hs.x = p.x; hs.y = p.y;
    hs.half = p.y < r.cy ? "back" : "front";
    if (h) {
      var b = h.box(ground.scale);
      ground.box = { x: p.x, y: p.y, top: p.y - hs.alt - b.foot, w: b.w, h: b.h };
    } else { ground.box = null; }
  }
  // The ring, its marks and its animal on the two canvases: what is behind the middle of the ring under
  // the city, what is before it over the city. Only when something on them has changed.
  function paintGround(now) {
    var r = ground.ring, hs = ground.hs;
    var k = Math.min(window.devicePixelRatio || 1, 3), W = window.innerWidth, H = window.innerHeight;
    var key = [Math.round(r.cx * 2), Math.round(r.cy * 2), Math.round(r.R * 2), Land.dialGround.ver(), hs.pose, hs.n, hs.dir,
               Math.round(hs.x * 2), Math.round(hs.y * 2), Math.round(hs.alt), !!ground.hand, ground.scale,
               band.x, band.y, band.w, band.h, W, H, k].join("|");
    // Thirty times a second at most (the skyline itself is drawn at twenty-four): what changed in between
    // is painted at the next.
    if (key === ground.painted || now - (ground.paintedAt || 0) < 33) { return; }
    ground.painted = key;
    ground.paintedAt = now;
    var pw = Math.round(W * k), ph = Math.round(H * k);
    var ring = { cx: r.cx, cy: r.cy, R: r.R, st: r.st, hand: ground.hand ? ground.box : null };
    // Only the band is drawn in, so only the band is cleared — but all of it when the band has moved.
    var bk = [band.x, band.y, band.w, band.h, pw, ph].join(","), whole = bk !== ground.bandKey;
    ground.bandKey = bk;
    [[under, "back"], [over, "front"]].forEach(function (pair) {
      var cv = pair[0], half = pair[1];
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      var g = cv.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (whole) { g.clearRect(0, 0, pw, ph); }
      else { g.clearRect(Math.floor(band.x * k) - 1, Math.floor(band.y * k) - 1, Math.ceil(band.w * k) + 2, Math.ceil(band.h * k) + 2); }
      g.setTransform(k, 0, 0, k, 0, 0);
      var y0 = half === "back" ? band.y : Math.max(band.y, r.cy), y1 = half === "back" ? Math.min(band.y + band.h, r.cy) : band.y + band.h;
      g.save();
      g.beginPath();
      g.rect(band.x, band.y, band.w, band.h);
      g.clip();
      if (y1 > y0) {
        g.save();
        g.beginPath();
        g.rect(band.x, y0, band.w, y1 - y0);
        g.clip();
        Land.dialGround.paint(g, ring);
        g.restore();
      }
      if (ground.hand && hs.half === half) {
        ground.hand.draw(g, hs.x, hs.y - hs.alt, hs.pose, hs.n, hs.dir, ground.scale);
      }
      // On the categories, their names over the city, whichever half they are on (none lost behind a tower).
      if (half === "front" && Land.dialGround.paintTop) {
        ring.band = band;
        Land.dialGround.paintTop(g, ring);
      }
      g.restore();
    });
  }
  function groundClear() {
    ground.painted = "";
    ground.bandKey = "";
    [under, over].forEach(function (cv) {
      if (cv && cv.width) { var g = cv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }
    });
  }
  function groundOff() {
    if (!ground.on) { return; }
    ground.on = false;
    ground.ring = null;
    ground.box = null;
    if (Land.dialGround) { Land.dialGround.set(null); }
    groundClear();
    if (says) { says.hidden = true; }
    dirty = true;
    placed = "";
  }
  // The place's own animal, read once a city (the same native a wave there would bring).
  function handFor(key) {
    if (ground.key === key) { return; }
    ground.key = key;
    ground.hand = null;
    ground.hs.t = 1; ground.hs.last = -1e9; ground.hs.said = 0;
    if (!window.Characters || !Characters.hand) { return; }
    Characters.hand(key).then(function (h) {
      if (ground.key !== key) { return; }
      ground.hand = h;
      ground.painted = "";
      dirty = true;
    });
  }
  // A press on the ground dial: the animal ("hand"), the ring and its marks ("ring"), or neither.
  function groundHit(x, y, touch) {
    if (!ground.on || !ground.ring) { return null; }
    // The ring on the categories (land.js): its names, wherever they were kept in the band.
    if (Land.dialGround.catHit && Land.dialGround.catHit(x, y)) { return "ring"; }
    var b = ground.box;
    if (b && ground.hand) {
      var px = Math.max(touch ? 4 : 0, ((touch ? 44 : 24) - b.w) / 2), py = Math.max(touch ? 4 : 0, ((touch ? 44 : 24) - b.h) / 2);
      if (x >= b.x - b.w / 2 - px && x <= b.x + b.w / 2 + px && y >= b.top - py && y <= b.top + b.h + py) { return "hand"; }
    }
    var r = ground.ring, du = x - r.cx, dw = (y - r.cy) / r.st;
    var a = Math.atan2(dw, du), ex = r.cx + Math.cos(a) * r.R, ey = r.cy + Math.sin(a) * r.R * r.st;
    var d = Math.hypot(x - ex, y - ey) * (Math.hypot(du, dw) < r.R ? -1 : 1);
    if (y < band.y || y > band.y + band.h || x < band.x || x > band.x + band.w) { return null; }
    return d >= -(touch ? 16 : 10) && d <= (touch ? 40 : 34) ? "ring" : null;
  }
  // A tap on the animal: a path played or paused, else what it is, said beside it a while.
  function handTapped() {
    if (window.Dial && Dial.live && Dial.live() && Dial.toggle) { Dial.toggle(); return; }
    var h = ground.hand, b = ground.box;
    if (!h || !b) { return; }
    var now = performance.now();
    ground.hs.said = now + SAY_MS;
    ground.painted = "";
    says.textContent = h.line;
    says.hidden = false;
    var sw = says.offsetWidth, sh = says.offsetHeight;
    var x = b.x - sw / 2, y = b.top - sh - 8;
    if (y < band.y + 4) { y = b.top + b.h + 8; }
    x = Math.max(band.x + 8, Math.min(band.x + band.w - sw - 8, x));
    // By left and top: the rise (land.js) scales the skyline's children by their transforms.
    says.style.left = Math.round(x) + "px";
    says.style.top = Math.round(y) + "px";
    window.clearTimeout(handTapped.t);
    handTapped.t = window.setTimeout(function () { says.hidden = true; }, SAY_MS);
  }

  /* ---- the column: who walks here, and who was born here ------------------ */

  function columnFor(st) {
    var col = st.col;
    if (!col) { return; }
    var old = col.querySelector(".skyline-col");
    if (old) { old.remove(); }
    var box = el("section", "skyline-col");
    var people = roster;
    var born = st.via && st.via.born;
    if (born) {
      var ids = bornIds(born);
      if (ids.length) {
        box.appendChild(el("p", "town-section skyline-kicker", "Born here · " + ids.length));
        box.appendChild(el("p", "skyline-said", plural(ids.length, "saved artist was", "saved artists were") + " born in or near " +
          (born[7] || st.name) + ", as Wikidata has it · most saved first"));
        box.appendChild(rows(ids.map(function (r) { return r; }), true));
      }
    }
    // The city's story (chronicle.js) tells who lived here and when; the list is for a city without it.
    if (people.length && !window.Chronicle) {
      box.appendChild(el("p", "town-section skyline-kicker", "Walking here · " + people.length));
      box.appendChild(el("p", "skyline-said", "Born here, or placed here by their record, each in their years: turn the dial to see who was here"));
      box.appendChild(rows(people, false));
    }
    if (city && city.floor1975) {
      box.appendChild(el("p", "skyline-said", "Buildings before 1975 are not dated here: all that stood by 1975 is shown."));
    } else if (city && city.years && city.old) {
      // A source's open first class ("before 1919"): those buildings stand from the dial's first year.
      box.appendChild(el("p", "skyline-said", "Buildings from before " + city.old + " are not dated more closely: they stand from the first year."));
    } else if (city && !city.years) {
      box.appendChild(el("p", "skyline-said", "Its buildings' years have not been read yet: the city stands as it is now."));
    }
    // A census counts a block's buildings by period, not each one's year (Italy's, build_built_years.py).
    if (city && city.years && city.from.some(function (f) { return /census/i.test(f); })) {
      box.appendChild(el("p", "skyline-said", "Where a building's own year is not known, its block's census shares stand in: which building is which is not known."));
    }
    if (!box.children.length) { return; }
    // Born here heads the column (come from the Artists layer); who walks here follows the museums.
    var head = col.querySelector(".kinds-head");
    var mus = col.querySelectorAll(":scope > .town-museum-row");
    var at = born ? (head && head.parentNode === col ? head.nextSibling : col.firstChild)
                  : mus.length ? mus[mus.length - 1].nextSibling : (st.foot && st.foot.parentNode === col ? st.foot : null);
    col.insertBefore(box, at);
  }
  var livesRows = null;
  function bornIds(m) {
    if (!livesRows) { return []; }
    return (m[4] || []).map(function (i) {
      var r = livesRows[i];
      return r ? [r[0], r[1], r[2], r[3], r[5], [[r[2], r[3] || NOW, "born"]], [], null] : null;
    }).filter(Boolean);
  }
  function rows(list, born) {
    var ol = el("ol", "skyline-rows");
    var pager = { shown: 0 };
    function more() {
      var stop = Math.min(list.length, pager.shown + 12);
      for (var k = pager.shown; k < stop; k += 1) { ol.appendChild(row(list[k], born)); }
      pager.shown = stop;
      if (moreB) { moreB.remove(); moreB = null; }
      if (stop < list.length) {
        moreB = el("button", "skyline-more", "All " + list.length);
        moreB.type = "button";
        moreB.addEventListener("click", function () { pager.shown = stop; stopAll(); });
        ol.appendChild(moreB);
      }
    }
    function stopAll() {
      var b = moreB; moreB = null; if (b) { b.remove(); }
      for (var k = pager.shown; k < list.length; k += 1) { ol.appendChild(row(list[k], born)); }
      pager.shown = list.length;
    }
    var moreB = null;
    more();
    return ol;
  }
  function row(r, born) {
    var li = el("li");
    var b = el("button", "skyline-row");
    b.type = "button";
    b.appendChild(el("span", "skyline-row-name", r[1]));
    var yrs = born ? [r[2] ? r[2] + "–" + (r[3] || "") : "", plural(r[4] || 0, "saved work", "saved works")]
                   : [r[5].map(function (s) { return s[0] === s[1] ? s[0] : s[0] + "–" + s[1]; }).slice(0, 3).join(", "),
                      r[5][0][2] === "born" ? "born here" : ""];
    b.appendChild(el("span", "skyline-row-meta", yrs.filter(Boolean).join(" · ")));
    b.dataset.life = r[0];
    b.addEventListener("click", function () { if (window.Lives && Lives.open) { Lives.open(r[0], {}); } });
    function lit(on) {
      if (!city) { return; }
      var w = walkers.filter(function (x) { return x.r[0] === r[0]; })[0];
      if (!w && on) {
        var full = roster.filter(function (x) { return x[0] === r[0]; })[0];
        var y = yearOf();
        if (full && full[5].some(function (s) { return s[0] <= y && y <= s[1]; })) { w = come(full, performance.now()); }
      }
      if (w) { w.lit = on; }
      if (on) { b.dataset.lit = "true"; } else { delete b.dataset.lit; }
    }
    b.addEventListener("pointerenter", function () { lit(true); });
    b.addEventListener("pointerleave", function () { lit(false); });
    b.addEventListener("focus", function () { lit(true); });
    b.addEventListener("blur", function () { lit(false); });
    li.appendChild(b);
    return li;
  }

  /* ---- gestures ---------------------------------------------------------- */

  var pointers = {}, gesture = null, wheelPush = 0, wheelAt = 0;
  function wire() {
    function stop(event) { event.stopPropagation(); }
    root.addEventListener("pointerdown", function (event) {
      if (!city || !on_) { return; }
      event.stopPropagation();
      // A press on a name is the name's (its click); it still turns the skyline if it moves, and
      // is one of two fingers. (Captured, the click would land on the skyline, not the name.)
      var onName = !!event.target.closest(".skyline-name, .skyline-who");
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      if (!onName) { try { root.setPointerCapture(event.pointerId); } catch (e) {} }
      var ids = Object.keys(pointers);
      // On the ground dial — its animal, its ring or its marks — a press is the dial's: it turns time.
      var gh = ids.length === 1 && !onName ? groundHit(event.clientX, event.clientY, event.pointerType !== "mouse") : null;
      if (gh) {
        gesture = { kind: "dial", hand: gh === "hand", x: event.clientX, y: event.clientY, at: performance.now() };
        Land.dialGround.press("down", event, gh === "hand");
        return;
      }
      if (ids.length === 1) {
        gesture = { kind: "one", x: event.clientX, y: event.clientY, lx: event.clientX, at: performance.now(), moved: 0,
                    touch: event.pointerType !== "mouse", onName: onName,
                    h0: nearestDiagonal(view.swingAt ? view.to : view.heading) };
      } else if (ids.length === 2) {
        // A second finger while the dial was being led: the dial let go of, and the two fingers the skyline's.
        if (gesture && gesture.kind === "dial") { Land.dialGround.press("cancel", event); }
        var a = pointers[ids[0]], b = pointers[ids[1]];
        gesture = { kind: "two", d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, over: 1 };
        settleTo(null);
      }
    });
    root.addEventListener("pointermove", function (event) {
      if (!city || !on_) { return; }
      // Rising out of the city (land.js): the fingers are the rise's, the skyline only fades.
      if (Land.city && Land.city.rising && Land.city.rising()) { gesture = null; pointers = {}; return; }
      // The globe's own hover (a work named under the pointer) is not the skyline's.
      event.stopPropagation();
      if (event.pointerType === "mouse" && !pointers[event.pointerId] && !event.target.closest(".skyline-name, .skyline-who")) {
        // Over the ground dial: its marks named in the readout (the hub's hover), the animal to be led.
        var gh = groundHit(event.clientX, event.clientY, false);
        if (gh) {
          if (hoverK >= 0) { hover(-1e4, -1e4); }
          Land.dialGround.press("hover", event);
          ground.hovering = true;
          root.style.cursor = gh === "hand" ? "grab" : "pointer";
        } else {
          // Off the ring, nothing of it is pointed at any more.
          if (ground.hovering) { ground.hovering = false; Land.dialGround.press("hover", { clientX: -1e4, clientY: -1e4 }); }
          hover(event.clientX, event.clientY);
        }
      }
      if (!pointers[event.pointerId]) { return; }
      event.stopPropagation();
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var g = gesture;
      if (!g) { return; }
      if (g.kind === "dial") { Land.dialGround.press("move", event); return; }
      if (g.kind === "one") {
        g.moved = Math.max(g.moved, Math.abs(event.clientX - g.x), Math.abs(event.clientY - g.y));
        if (g.moved > 6) {
          view.held = true;
          view.swingAt = 0;
          view.heading -= (event.clientX - g.lx) * 0.009;
          g.lx = event.clientX;
          dirty = true;
        }
      } else if (g.kind === "two") {
        var ids = Object.keys(pointers);
        if (ids.length < 2) { return; }
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinchStep(g, Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    });
    function end(event) {
      if (!pointers[event.pointerId]) { return; }
      event.stopPropagation();
      delete pointers[event.pointerId];
      var g = gesture;
      if (g && g.kind === "dial") {
        gesture = null;
        var said = Land.dialGround.press(event.type === "pointerup" ? "up" : "cancel", event);
        if (said === "hand") { handTapped(); }
        swallowClick();
        return;
      }
      if (g && g.kind === "one") {
        var held = performance.now() - g.at;
        if (g.moved > 6) {
          // Let go, it settles on a diagonal: the one it came from after a nudge, else the next the
          // way it was turned (or as many quarters on as it was turned).
          var dh = view.heading - g.h0;
          settleTo(Math.abs(dh) < 0.25 ? g.h0 : g.h0 + (dh > 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(dh) / (TAU / 4))) * TAU / 4);
          swallowClick();
        }
        else if (g.onName) { /* the name's own click */ }
        else if (held < 380) { tap(g.x, g.y, g.touch); }
        else if (Land.city.squash) { Land.city.squash(g.x, g.y, Math.min(233, 55 + (held - 260) * 0.42)); }
        gesture = null;
      } else if (g && g.kind === "two" && Object.keys(pointers).length < 2) {
        gesture = null;
        pointers = {};
        // Let go on the way in: into the museum past IN_ON, else back to the nearest.
        if (into && into.fingers) { intoLetGo(); }
      }
    }
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    root.addEventListener("pointerleave", function (event) {
      if (event.pointerType !== "mouse") { return; }
      hover(-1e4, -1e4);
      if (ground.hovering) { ground.hovering = false; Land.dialGround.press("hover", { clientX: -1e4, clientY: -1e4 }); }
    });
    root.addEventListener("click", stop);
    root.addEventListener("wheel", function (event) {
      if (!city || !on_) { return; }
      event.preventDefault();
      event.stopPropagation();
      // The wheel's run that brought the city down from the world goes no further (land.js, entryHold).
      if (Land.city.held && Land.city.held(event.timeStamp)) { return; }
      // Over the ground dial's animal a wheel turns time, a crown (a trackpad's pinch still brings the city nearer).
      var gw = !event.ctrlKey && !into && !leaving ? groundHit(event.clientX, event.clientY, false) : null;
      if (gw === "hand" || (gw === "ring" && Land.dialGround.fn && Land.dialGround.fn() === "categories")) {
        Land.dialGround.press("wheel", event);
        return;
      }
      var wd = event.deltaY * (event.deltaMode === 1 ? 16 : 1), step = event.ctrlKey ? 0.012 : 0.0016;
      var now = performance.now();
      if (now - wheelAt > 600) { wheelPush = 0; }
      wheelAt = now;
      var g = { over: 1 };
      if (leaving) { return; }
      if (into) {
        // Going in by the wheel: each step on the way (or back out of it, the skyline again).
        if (into.done || into.tween) { return; }
        window.clearTimeout(into.wheelT);
        var k2 = into.k * Math.exp(-wd * step);
        if (k2 <= 1) { intoEnd(false); return; }
        intoTo(k2, event.clientX, event.clientY, false);
        if (into && !into.done && !into.tween) { into.wheelT = window.setTimeout(intoLetGo, IN_WAIT); }
        return;
      }
      zoomAbout(Math.exp(-wd * step), event.clientX, event.clientY, g);
      dirty = true;
      if (g.over !== 1) {
        if (wd > 0 && Land.city.rise && Land.city.rise(Math.exp(-wd * step))) { wheelPush = 0; return; }
        if (wd < 0) {
          // In past the nearest: on toward the museum nearest the pointer, and into it.
          wheelPush = 0;
          intoTo(g.over, event.clientX, event.clientY, false);
          if (into && !into.done && !into.tween) { into.wheelT = window.setTimeout(intoLetGo, IN_WAIT); }
          return;
        }
        wheelPush += Math.abs(wd) * (event.ctrlKey ? 8 : 1);
        if (wheelPush > 377) { wheelPush = 0; Land.city.up(); }
      } else { wheelPush = 0; }
    }, { passive: false });
    canvas.addEventListener("keydown", function (event) {
      if (keyed(event.key)) { event.preventDefault(); event.stopPropagation(); }
    });
  }
  // A drag begun on a name is not also a press on it.
  function swallowClick() {
    var eat = function (e) { if (e.target.closest && e.target.closest(".skyline")) { e.stopPropagation(); e.preventDefault(); } };
    document.addEventListener("click", eat, true);
    window.setTimeout(function () { document.removeEventListener("click", eat, true); }, 400);
  }
  // The keys (on the skyline, or on the globe's own tab stop while the skyline stands):
  // ← → a quarter turn; + − nearer and farther, and past the ends the next level.
  function keyed(k) {
    if (!city || !on_ || !band) { return false; }
    if (k === "ArrowLeft" || k === "ArrowRight") {
      settleTo(nearestDiagonal(view.swingAt ? view.to : view.heading) + (k === "ArrowLeft" ? 1 : -1) * TAU / 4);
      return true;
    }
    if (k === "+" || k === "=" || k === "-" || k === "_") {
      var nearer = k === "+" || k === "=", g = { over: 1 };
      if (into || leaving) { return true; }
      zoomAbout(nearer ? 1.25 : 1 / 1.25, band.x + band.w / 2, band.y + band.h / 2, g);
      dirty = true;
      if (g.over !== 1) {
        if (nearer) { keyIn(); }
        else if (!(Land.city.riseAll && Land.city.riseAll())) { Land.city.up(); }
      }
      return true;
    }
    return false;
  }
  function zoomAbout(r, sx, sy, g) {
    // Pushed past an end: the push grows until it is let go of or comes back.
    if (g.over !== 1) {
      var o = g.over * r;
      if ((g.over > 1 && o > 1) || (g.over < 1 && o < 1)) { g.over = o; return; }
      r = o;
      g.over = 1;
    }
    var z0 = view.zoom, want = z0 * r, z1 = Math.max(1, Math.min(ZOOM_MAX, want));
    if (z1 !== z0) {
      // The ground under (sx, sy) stays under it.
      var cx = band.x + band.w / 2 + view.px, cy = frameNow ? band.y + frameNow.cy0 : band.y + band.h / 2;
      view.px += (sx - cx) * (1 - z1 / z0);
      view.py += (sy - cy) * (1 - z1 / z0);
      view.zoom = z1;
      if (z1 <= 1.0001) { view.px = view.py = 0; }
    }
    g.over = want / z1;
  }
  function nearestDiagonal(h) { return Math.round((h - TAU / 8) / (TAU / 4)) * (TAU / 4) + TAU / 8; }
  function settleTo(h) {
    if (h === null) { view.swingAt = 0; return; }
    view.from = view.heading; view.to = h; view.swingAt = performance.now();
    view.held = false;
    view.nextTurn = performance.now() + REST_MS;
  }
  /* ---- in: from the skyline into a museum ----------------------------------

     The artist, 8 Oct 2026, with a recording of Seattle's skyline spread on
     past its nearest into DIRT Earth's flat ground: "when I zoom in on a
     specific art museum or gallery from a city view … it doesn't take me
     where it is currently to that two dimensional texture that is not in the
     isometric perspective … when I zoom in on a specific museum from the city
     skyline, I want it to take me to the isometric perspective of the
     building I get when clicking on the museum." Past the nearest the same
     fingers (a wheel, "+") go on bringing the skyline nearer, about the
     museum nearest them (a hand's reach: its top or its foot within 0.3 of
     the band), drawing it toward the middle as the city round it is let go
     of (the veil) and its column, dial and banner fade; let go past IN_ON, or
     spread to IN_ALL, and the museum's own view comes — its building on the
     skyline's heading, faded in over the skyline still coming nearer (no
     sweep). Let go short of IN_ON and it springs back to the nearest. A
     gallery spread on is pressed (its row opens, its building lit) and the
     skyline springs back; open ground only gives a little and springs back.
     Nothing on a skyline goes down into DIRT Earth's ground. */
  var IN_ON = 1.25, IN_ALL = PHI, IN_WHEEL_ON = 1.15, IN_WAIT = 650, IN_BACK = 420, LEAVE_MS = 900;
  var into = null, leaving = null;
  function backOut(t) { var c1 = 1.1, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; }
  // The museum (or building) nearest a point of the screen (its top or its foot) within a hand's reach, else a
  // gallery under the finger; a gallery right under it, much nearer than any museum, is the gallery.
  function nearestArt(x, y) {
    var f = frameNow;
    if (!f || !city || !band) { return null; }
    var reach = Math.max(72, 0.3 * Math.min(band.w, band.h));
    var mus = null, dm = Infinity, gal = null, dg = Infinity;
    city.arts.forEach(function (a) {
      var top = toScreen(project(f, a.at.x, a.at.y, a.top)), foot = toScreen(project(f, a.at.x, a.at.y, a.z0 || 0));
      var d = Math.min(Math.hypot(top.x - x, top.y - y), Math.hypot(foot.x - x, foot.y - y));
      if (stands(a)) { if (d < dm) { dm = d; mus = a; } }
      else if (d < dg) { dg = d; gal = a; }
    });
    if (gal && dg < 36 && dg * 2.5 < dm) { return gal; }
    if (mus && dm <= reach) { return mus; }
    if (gal && dg <= 48) { return gal; }
    return null;
  }
  function intoPoint(a) { return { x: a.at.x, y: a.at.y, z: ((a.z0 || 0) + a.top) / 2 }; }
  // The view put so a point of the ground stands at (tx, ty) of the canvas, at the view's zoom.
  function aimAt(p, tx, ty) {
    view.px = 0; view.py = 0;
    var q = project(frameFor(band.w, frameH()), p.x, p.y, p.z);
    view.px = tx - q.x; view.py = ty - q.y;
  }
  function intoBegin(x, y, fingers, g) {
    if (!city || !on_ || !frameNow || leaving) { return false; }
    var a = nearestArt(x, y), from;
    if (a) { var q = project(frameNow, intoPoint(a).x, intoPoint(a).y, intoPoint(a).z); from = { x: q.x, y: q.y }; }
    else { from = { x: x - band.x, y: y - band.y }; }
    // The heading eases onto its diagonal as it is gone into, so the building comes on the very one.
    var h0 = view.heading, h1 = nearestDiagonal(view.swingAt ? view.to : view.heading);
    into = { a: a, k: 1, fingers: !!fingers, base: { zoom: view.zoom, px: view.px, py: view.py }, from: from,
             h0: h0, h1: a && stands(a) ? h1 : h0, tween: null, done: false, wheelT: 0, g: g || null };
    view.held = true;                  // the heading holds while it is gone into
    view.swingAt = 0;
    root.dataset.into = a ? a.kind : "ground";
    if (a && marks[a.k]) { marks[a.k].btn.dataset.target = "true"; lightArt(a.k, true); }
    return true;
  }
  // How far in, 0 at the nearest to 1 at IN_ALL; the view, the veil and the city's chrome follow it.
  function intoView() {
    var w = into;
    if (!w || !frameNow || !band) { return; }
    var a = w.a, s = a ? Math.max(0, Math.min(1, Math.log(w.k) / Math.log(IN_ALL))) : 0;
    // Open ground only gives a little.
    var kv = a ? w.k : 1 + Math.min(0.2, (w.k - 1) * 0.3);
    view.zoom = w.base.zoom * kv;
    var hh = w.h0 + (w.h1 - w.h0) * Math.min(1, s * 1.4);
    if (hh !== view.heading) { view.heading = hh; }
    if (a) {
      // The museum drawn toward the middle as it comes nearer, where its own view will stand it.
      var tx = w.from.x + (band.w / 2 - w.from.x) * s, ty = w.from.y + (frameH() * 0.5 - w.from.y) * s;
      aimAt(intoPoint(a), tx, ty);
    } else {
      // About the fingers (frameFor's cy0 less the view's own offset does not change with the zoom).
      var C = frameFor(band.w, frameH()).cy0 - view.py;
      view.px = w.from.x - band.w / 2 - (w.from.x - band.w / 2 - w.base.px) * kv;
      view.py = w.from.y - C - (w.from.y - C - w.base.py) * kv;
    }
    dirty = true;
    placed = "";
    // The city round it let go of.
    if (a && s > 0) {
      var f = frameFor(band.w, frameH()), p = intoPoint(a);
      var c = toScreen(project(f, p.x, p.y, p.z));
      var rc = Math.sqrt(Math.max(1, a.cells.length) / Math.PI) * 1.42 * f.scale;
      var r1 = Math.max(26, rc * 1.15, (a.top - (a.z0 || 0)) * f.ct * f.scale * 0.62), r2 = r1 * 1.8 + 40;
      var alpha = (stands(a) ? 0.92 : 0.6) * s;
      veil.hidden = false;
      veil.style.background = "radial-gradient(circle at " + Math.round(c.x) + "px " + Math.round(c.y) + "px, rgba(15,10,7,0) " +
        Math.round(r1) + "px, rgba(15,10,7," + alpha.toFixed(3) + ") " + Math.round(r2) + "px)";
    } else { veil.hidden = true; }
    root.style.setProperty("--in-other", (1 - s).toFixed(3));
    // (Once gone, the museum's own banner is up: the city's are put away already.)
    if (Land.city.entering && !(leaving && leaving.went)) { Land.city.entering(a && stands(a) ? s : 0); }
  }
  function intoTo(k, x, y, fingers, g) {
    if (!into) {
      if (!(k > 1) || !intoBegin(x, y, fingers, g)) { return; }
    }
    var w = into;
    if (w.done || w.tween) { return; }
    w.k = Math.max(1, k);
    if (w.a && stands(w.a) && w.k >= IN_ALL) { intoIn(); return; }
    if (w.a && w.a.kind === "gallery" && w.k >= IN_ALL) { intoLetGo(); return; }
    intoView();
  }
  // Let go: into the museum past IN_ON, else back to the nearest (a gallery pressed on the way).
  function intoLetGo() {
    var w = into;
    if (!w || w.tween || w.done) { return; }
    window.clearTimeout(w.wheelT);
    var on = w.fingers ? IN_ON : IN_WHEEL_ON;
    if (w.a && stands(w.a) && w.k >= on) { intoIn(); return; }
    if (w.a && w.a.kind === "gallery" && w.k >= on && !w.pressed) {
      var mk = marks[w.a.k];
      w.pressed = true;
      if (w.g) { w.g.spent = true; }          // the gesture that pressed it goes no further in
      pressArt(w.a, mk ? mk.x : band.x + w.from.x, mk ? mk.y : band.y + w.from.y);
    }
    w.tween = { from: w.k, to: 1, at: performance.now(), dur: still ? 1 : IN_BACK, back: true };
  }
  // In: the museum's own view, its building on this heading, faded in over the skyline still coming nearer.
  function intoIn() {
    var w = into;
    if (!w || w.done || !w.a || !stands(w.a)) { return; }
    w.done = true;
    w.tween = null;
    window.clearTimeout(w.wheelT);
    gesture = null;
    pointers = {};
    leaving = { at: performance.now(), k0: w.k, k1: Math.max(w.k, IN_ALL) * 1.12, went: false, upAt: 0 };
    root.dataset.leaving = "true";
    rememberView(w.a.slug, w.base);
    view.heading = w.h1;
    goInto(w.a, { zoom: true, heading: w.h1 });
  }
  function intoEnd(gone) {
    var w = into;
    into = null;
    if (!w) { return; }
    window.clearTimeout(w.wheelT);
    if (!gone) { view.zoom = w.base.zoom; view.px = w.base.px; view.py = w.base.py; view.heading = w.h0; }
    view.held = false;
    view.nextTurn = performance.now() + REST_MS;
    if (root) {
      delete root.dataset.into;
      delete root.dataset.leaving;
      root.style.removeProperty("--in-other");
    }
    if (veil) { veil.hidden = true; veil.style.background = ""; }
    if (w.a && marks[w.a.k]) { delete marks[w.a.k].btn.dataset.target; lightArt(w.a.k, false); }
    if (Land.city.entering) { Land.city.entering(0); }
    dirty = true;
    placed = "";
  }
  // One step of a pinch (two fingers on the skyline, or land.js's with one off it): nearer and farther about
  // the fingers, out past the widest to the world, in past the nearest toward the museum nearest them.
  function pinchStep(g, d, mx, my) {
    if (leaving) { return; }
    var r = d / g.d;
    g.d = d;
    if (into) {
      if (into.done) { return; }
      // Springing back, caught by the next stroke: it goes on from where it has got to (a gallery
      // pressed by this gesture is done with).
      if (into.tween) { if (into.tween.back && !into.pressed) { into.tween = null; } else { return; } }
      // On the way in the spread is the way; spread back under the nearest, the skyline again.
      var k = into.k * r;
      g.mx = mx; g.my = my;
      if (k <= 1) { intoEnd(false); g.over = 1; zoomAbout(k, mx, my, g); dirty = true; return; }
      intoTo(k, mx, my, true);
      return;
    }
    view.px += mx - g.mx; view.py += my - g.my;
    g.mx = mx; g.my = my;
    zoomAbout(r, mx, my, g);
    dirty = true;
    // Pinched on out past the widest: the world, as far as the fingers go (land.js's rise), else up.
    if (g.over < 1 && Land.city.rise && Land.city.rise()) { gesture = null; pointers = {}; return; }
    if (g.over < 1 / 1.45) { gesture = null; pointers = {}; Land.city.up(); return; }
    // Spread on in past the nearest: on toward the museum nearest the fingers, and into it.
    if (g.over > 1) { var o = g.over; g.over = 1; if (!g.spent) { intoTo(o, mx, my, true, g); } }
  }
  // "+" at the nearest: into the museum nearest the middle (a gallery there pressed; else nothing).
  function keyIn() {
    if (!band || !intoBegin(band.x + band.w / 2, band.y + frameH() / 2, false)) { return; }
    var w = into;
    if (!w.a || !stands(w.a)) {
      if (w.a && marks[w.a.k]) { pressArt(w.a, marks[w.a.k].x, marks[w.a.k].y); }
      w.k = 1.08;
      w.tween = { from: 1.08, to: 1, at: performance.now(), dur: still ? 1 : IN_BACK, back: true };
      intoView();
      return;
    }
    w.tween = { from: 1, to: IN_ALL, at: performance.now(), dur: still ? 1 : 560, back: false, then: intoIn };
  }
  function stepInto(now) {
    var w = into, tw = w && w.tween;
    if (!tw) { return; }
    var q = Math.max(0, Math.min(1, (now - tw.at) / tw.dur));
    var e = tw.back ? backOut(q) : 1 - Math.pow(1 - q, 3);
    w.k = Math.max(0.9, tw.from + (tw.to - tw.from) * e);
    intoView();
    if (q >= 1) {
      w.tween = null;
      if (tw.back) { intoEnd(false); } else if (tw.then) { tw.then(); }
    }
  }
  // Gone in: the skyline holds over the hop, still coming nearer, until the museum's view is up over it.
  function stepLeaving(now) {
    var L = leaving, w = into;
    var q = Math.min(1, (now - L.at) / LEAVE_MS), e = 1 - Math.pow(1 - q, 3);
    // (Under reduced motion it holds where the hand left it.)
    if (w && !still) { w.k = L.k0 + (L.k1 - L.k0) * e; intoView(); }
    if (now - drawnAt >= 1000 / 24) { drawnAt = now; dirty = false; draw(); }
    var st = Land.city.state();
    if (!st) {
      // Gone: the city's column and dial are put away now, and the museum's banner is its own.
      if (!L.went && Land.city.entering) { Land.city.entering(0); }
      L.went = true;
    }
    else if (!L.went && now - L.at > 600) {
      // It never went (the way in was refused): back to the nearest.
      leaving = null;
      if (root) { delete root.dataset.leaving; }
      if (w) { w.done = false; w.tween = { from: w.k, to: 1, at: now, dur: IN_BACK, back: true }; }
      return;
    }
    var b = document.getElementById("building");
    var up = b && !b.hidden && (b.dataset.air === "up" || b.dataset.air === "none") && b.dataset.came !== "wait";
    if (up && !L.upAt) { L.upAt = now; }
    if ((L.upAt && now - L.upAt > 640) || now - L.at > 4200) {
      leaving = null;
      intoEnd(true);
      off();
      visit = null;
    }
  }
  function artUnder(x, y, reach) {
    var best = null, bd = reach;
    marks.forEach(function (mk) {
      if (mk.btn.hidden) { return; }
      var d = Math.hypot(mk.x - x, mk.y - y);
      if (d < bd) { bd = d; best = mk.a; }
    });
    // Or its footprint, where the press is on the building itself (within ~40 m: a cell at the first grain).
    if (!best && frameNow) {
      var p = unproject(frameNow, x - band.x, y - band.y, 0), n = city.n;
      var i = Math.floor(p.y + n / 2), j = Math.floor(p.x + n / 2), R = Math.max(1, Math.round(40 / city.cell)), bc = Infinity;
      for (var di = -R; di <= R; di += 1) {
        for (var dj = -R; dj <= R; dj += 1) {
          var ii = i + di, jj = j + dj, dc = di * di + dj * dj;
          if (dc < bc && ii >= 0 && jj >= 0 && ii < n && jj < n && city.owner[ii * n + jj]) { bc = dc; best = city.arts[city.owner[ii * n + jj] - 1]; }
        }
      }
    }
    return best;
  }
  function tap(x, y, touch) {
    var reach = touch ? 24 : 12;
    var w = null, wd = reach;
    walkers.forEach(function (o) { var d = Math.hypot(o.x - x, o.y - 8 - y); if (d < wd) { wd = d; w = o; } });
    if (w) {
      if (touch && !w.named) { w.named = true; return; }
      openLife(w.r);
      return;
    }
    var a = artUnder(x, y, reach);
    if (!a) { namedTap = null; placed = ""; return; }
    var mk = marks[a.k];
    if (touch && !mk.named && namedTap !== a) { namedTap = a; lightArt(a.k, true); return; }
    pressArt(a, mk.x, mk.y);
  }
  var hoverK = -1;
  function hover(x, y) {
    var a = x > -1e3 ? artUnder(x, y, 10) : null, k = a ? a.k : -1;
    if (k === hoverK) { return; }
    if (hoverK >= 0) { lightArt(hoverK, false); }
    hoverK = k;
    if (k >= 0) { lightArt(k, true); }
    root.style.cursor = k >= 0 ? "pointer" : "";
  }

  /* ---- the loop ---------------------------------------------------------- */

  var on_ = false, dirty = true, last = 0, visit = null, drawnAt = 0, lightKey = "";
  var extPinch = null;                // land.js's two fingers, one of them off the skyline (on the dial)
  var built = {}, builtOrder = [];    // a city's ground made into dots, kept for the visit after
  var waiting = null;                 // the visit whose ground is in and is being made (or could not be read)
  function off() {
    if (into) { intoEnd(true); }
    leaving = null;
    extPinch = null;
    groundOff();
    if (!on_ && (!root || root.hidden)) { return; }
    on_ = false;
    if (root) { root.hidden = true; }
    delete document.documentElement.dataset.skyline;
    walkers.forEach(function (w) { w.btn.remove(); });
    walkers = [];
    bits.forEach(function (o) { o.btn.remove(); });
    bits = [];
    if (litArt >= 0 && city) { lightArt(litArt, false); }
  }
  function sayNoSkyline(st) {
    if (!st.col || st.col.querySelector(".skyline-none")) { return; }
    var p = el("p", "skyline-none", "No skyline has been read for " + st.name + " yet: its map, as it was.");
    var head = st.col.querySelector(".kinds-head");
    st.col.insertBefore(p, head && head.parentNode === st.col ? head.nextSibling : st.col.firstChild);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!window.Land || !Land.city) { return; }
    // Gone into a museum: the skyline holds, coming nearer, until the museum's view is up over it (its
    // ground dial let go of: the ring would stand still while the city came nearer).
    if (leaving && city && on_ && band) { if (ground.painted) { groundClear(); } stepLeaving(now); return; }
    var st = Land.city.state();
    var ok = st && !st.reading && !(st.via && (st.via.at || st.via.studio));
    if (!ok) { off(); visit = null; return; }
    if (!places) { if (!building) { building = lists().then(function () { building = null; }); } return; }
    var P = places[st.key];
    if (!P) {
      off();
      if (visit !== st.visit) { visit = st.visit; window.setTimeout(function () { var s2 = Land.city.state(); if (s2 && s2.key === st.key) { sayNoSkyline(s2); } }, 400); }
      return;
    }
    if (visit !== st.visit || !city || city.key !== st.key) {
      if (visit === st.visit && (building || waiting === visit)) { return; }
      visit = st.visit;
      city = null;
      off();
      // Its animal read while its ground is (the ground dial's hand), so the city is laid out for it at once.
      if (GROUND) { handFor(st.key); }
      var myVisit = visit;
      var slugs = (P.museums || []).concat(buildingsIn(P).map(function (b) { return b.slug; }));
      building = Promise.all([once("grounds/city-" + st.key + ".json")].concat(slugs.map(function (s) { return once("models/" + s + ".json"); }))
                            .concat([livesRows ? null : once("lives.json")]))
        .then(function (r) {
          building = null;
          if (visit !== myVisit) { return; }
          var g = r[0];
          if (r[r.length - 1] && r[r.length - 1].lives) { livesRows = r[r.length - 1].lives; }
          if (!g || !g.n) { waiting = myVisit; sayNoSkyline(st); return; }
          var models = {};
          slugs.forEach(function (s, k) { models[s] = r[k + 1]; });
          waiting = myVisit;
          waitFor(myVisit, P, g, models, 0);
        });
      return;
    }
    if (!city) { return; }
    // Come down into from the world (land.js, descent): made ready while it is still far off, not yet shown.
    if (st.prep) { if (on_) { off(); } return; }
    // On.
    if (!on_) {
      make();
      on_ = true;
      root.hidden = false;
      document.documentElement.dataset.skyline = "on";
      canvas.setAttribute("aria-label", st.name + "'s skyline in dots of its ground, seen from above: " +
        plural(city.arts.filter(function (a) { return a.kind === "museum"; }).length, "museum", "museums") +
        (city.arts.some(function (a) { return a.kind === "building"; }) ?
          ", " + plural(city.arts.filter(function (a) { return a.kind === "building"; }).length, "building", "buildings") : "") + " and " +
        plural(city.arts.filter(function (a) { return a.kind === "gallery"; }).length, "gallery", "galleries") +
        " named; ← → turn it, + − nearer and farther");
      view.heading = nearestDiagonal(TAU / 8 + Math.floor(Math.random() * 4) * TAU / 4);
      // A phone a little nearer: its window is narrow, and the museums are in the middle (not where the
      // ring of its dial lies round the city: then all of it, ring and all).
      view.zoom = window.innerWidth <= 720 && !(GROUND && st.dial) ? 1.15 : 1;
      view.px = view.py = 0; view.swingAt = 0; view.nextTurn = now + REST_MS;
      // Up from the museum gone into from here (within the half hour, the window as it was): that view again.
      var wf = wentFrom[st.key], bnow = st.band;
      if (wf && st.via && st.via.museum === wf.slug && now - wf.at < 1800000 &&
          (!wf.w || (bnow && Math.abs(bnow.w - wf.w) < 2))) {
        view.heading = nearestDiagonal(wf.heading);
        view.zoom = Math.max(1, Math.min(ZOOM_MAX, wf.zoom));
        view.px = wf.px; view.py = wf.py;
      }
      walkers = [];
      bits.forEach(function (o) { o.btn.remove(); });
      bits = [];
      cat = "";
      castFor(now);
      nextCome = now + (still ? 0 : 900);
      makeNames();
      columnFor(st);
      pulseAt = now + 1600; pulseArt = -2;          // every museum's ring, once, as the city settles
      dirty = true;
      // Its first play, if one is under way, from its first year now that it can be seen.
      if (Land.city.shown) { Land.city.shown(); }
    }
    if (st.still !== still) { still = st.still; }
    // Still on its way down from the world (land.js, rise.down): its museums' rings wait for it to arrive.
    if (st.coming && pulseArt === -2) { pulseAt = now + 1600; }
    var dt = Math.min(80, now - (last || now));
    last = now;
    // The band it is drawn in, and the canvas there.
    var b = st.band, bh = b.h;
    // On a phone the skyline has the band and the room under it down to the column's top.
    if (window.innerWidth <= 720 && st.col && st.col.firstChild) {
      var ct = st.col.getBoundingClientRect().top;
      if (ct > b.y + b.h) { bh = ct - b.y - 6; }
    }
    var nb = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(bh) };
    // On the GPU the canvas has the device's pixels (up to three a CSS pixel); the 2D canvas, a CSS pixel's.
    var dens = city.dots.gpu ? Math.min(3, window.devicePixelRatio || 1) : 1;
    if (!band || band.x !== nb.x || band.y !== nb.y || band.w !== nb.w || band.h !== nb.h || dens !== density) {
      band = nb;
      density = dens;
      canvas.style.left = band.x + "px"; canvas.style.top = band.y + "px";
      canvas.style.width = band.w + "px"; canvas.style.height = band.h + "px";
      canvas.width = Math.max(1, Math.round(band.w * density)); canvas.height = Math.max(1, Math.round(band.h * density));
      dirty = true;
    }
    // The dial laid on the ground (the ground dial) while the city has its years; its animal read once a city.
    var wantGround = GROUND && !!st.dial && !!Land.dialGround;
    if (wantGround && !ground.on) { ground.on = true; dirty = true; placed = ""; dialTop = Infinity; }
    else if (!wantGround && ground.on) { groundOff(); }
    if (ground.on) {
      handFor(st.key);
      var sc = handScale();
      if (sc !== ground.scale) { ground.scale = sc; dirty = true; }
    }
    // Where the dial stands, now and then (it can be carried anywhere; laid on the ground, it takes no room).
    if (!ground.on && (!tick.dialAt || now - tick.dialAt > 500)) {
      tick.dialAt = now;
      var de = document.getElementById("art-time"), dt0 = Infinity;
      if (de && !de.hidden) {
        var dr = de.getBoundingClientRect(), mid = (dr.left + dr.right) / 2;
        if (dr.width && mid > band.x + band.w / 3 && mid < band.x + band.w * 2 / 3 && dr.top < band.y + band.h) { dt0 = Math.round(dr.top); }
      }
      if (dt0 !== dialTop) { dialTop = dt0; dirty = true; placed = ""; }
    }
    // The year: the city's dial (at rest, now; under reduced motion the dial does not play).
    var d = st.dial, yearF = !d || d.rest ? NOW + 1 : d.at - 0.5;
    var dy = d && !d.rest && Land.dial ? Land.dial() : null;
    city.yearNow = !d || d.rest ? 0 : dy && dy.year ? dy.year : Math.floor(d.at);
    // Never less than the ground (8 Oct 2026: before its first dated building a city's whole clod had
    // gone, ground and all — Milan and Berlin stood empty until 1975 while their dials began in 1482 and
    // 1904): the land, the water, the streets and every building whose year is not known stand from the
    // dial's first year; a dated building rises in its year.
    var shown = city.years ? Math.max(0, (yearF - city.years.y0) / (city.years.y1 - city.years.y0)) : 1;
    if (Math.abs(shown - shownNow) > 1e-4) { shownNow = shown; dirty = true; }
    if (into && into.tween) { stepInto(now); }
    // Resting on the diagonals, a quarter turn every so often; a drag turns it, let go it settles.
    if (!view.held && !gesture) {
      if (!still && !view.swingAt && now >= view.nextTurn && !document.hidden) { settleTo(nearestDiagonal(view.heading) + TAU / 4); }
      if (view.swingAt) {
        var q = Math.min(1, (now - view.swingAt) / (still ? 1 : SWING_MS * (Math.abs(view.to - view.from) > 1 ? 1 : 0.4)));
        var e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
        view.heading = view.from + (view.to - view.from) * e;
        dirty = true;
        if (q >= 1) { view.heading = view.to; view.swingAt = 0; view.nextTurn = now + REST_MS; }
      }
    }
    if (dirty && now - drawnAt >= 1000 / 24) {
      drawnAt = now;
      dirty = false;
      draw();
    }
    if (!frameNow) { return; }
    // The ground dial: where its ring lies, its animal to the year, both painted, and land.js told.
    if (ground.on) {
      ground.ring = ringNow();
      if (ground.ring) {
        stepHand(now, dt);
        var gr = ground.ring;
        Land.dialGround.set({ cx: gr.cx, cy: gr.cy, R: gr.R, st: gr.st, hand: ground.hand ? ground.box : null,
                              hx: ground.hs.x, hy: ground.hs.y, left: band.x, right: band.x + band.w });
        paintGround(now);
      }
    }
    if (cat !== (Land.layer ? Land.layer() : "museums")) { castFor(now); }
    stepWalkers(now, dt);
    placeNames(now);
    var lk = placed + "|" + walkers.length + "|" + litArt;
    if (walkers.length || bits.length || lk !== lightKey || (pulseAt && now - pulseAt < 1200 && now >= pulseAt)) {
      lightKey = lk;
      paintLight(now);
    }
    // The museum rows lit from the column light their buildings.
    var lit = -1;
    Object.keys(st.rows || {}).forEach(function (slug) {
      var r = st.rows[slug];
      if (r && r.row && r.row.dataset.lit === "true") {
        city.arts.forEach(function (a) { if (a.slug === slug) { lit = a.k; } });
      }
    });
    (st.venueBoxes || []).forEach(function (box) {
      if (box.matches && box.matches(":hover, :focus-within")) {
        city.arts.forEach(function (a) { if (a.kind === "gallery" && box.vis.indexOf(a.vi) >= 0) { lit = a.k; } });
      }
    });
    if (lit >= 0 && litArt !== lit && hoverK < 0) { litArt = lit; placed = ""; }
    else if (lit < 0 && litArt >= 0 && hoverK < 0 && !marks.some(function (mk) { return mk.btn.matches(":hover, :focus"); })) { litArt = -1; placed = ""; }
    var nt = noteFor();
    if (note.textContent !== nt) { note.textContent = nt; }
  }
  // The dirt tiles may still be on their way: the ground is made once they have come (or after 3 s).
  function waitFor(myVisit, P, g, models, tries) {
    if (visit !== myVisit) { return; }
    var st = Land.city.state();
    if (!st) { return; }
    var soilIn = !!Land.city.soil(P.lat, P.lon, 0, 0, false);
    if (!soilIn && tries < 30) { window.setTimeout(function () { waitFor(myVisit, P, g, models, tries + 1); }, 100); return; }
    // The galleries' points are exact once the city's file is in.
    if (!st.pf && tries < 40) { window.setTimeout(function () { waitFor(myVisit, P, g, models, tries + 1); }, 100); return; }
    try {
      if (!built[st.key]) {
        // The last three cities made are kept for the visit after (a fine city is ~7 MB of strips).
        builtOrder = builtOrder.filter(function (k) { return k !== st.key; });
        while (builtOrder.length >= 3) { delete built[builtOrder.shift()]; }
        builtOrder.push(st.key);
        // The 2D canvas is given its ground no finer than it can draw; the GPU, all of it.
        var t0 = performance.now(), g2 = gpu() || g.n <= COARSE ? g : coarser(g);
        gridFine = g2.side / g2.n < 30;
        built[st.key] = build(st, P, g2, models);
        built[st.key].ms = Math.round(performance.now() - t0);
      }
      city = built[st.key];
    } catch (e) { city = null; if (window.console) { console.warn("skyline", e); } }
    waiting = city ? null : myVisit;
    lightKey = "";
    sorted.heading = null;
  }

  window.Skyline = {
    on: function () { return on_; },
    key: function (k) { return keyed(k); },
    // The ground dial: whether a city's dial is laid on its ground (characters.js: its animal is out
    // already, as the hand); where its ring lies; where its animal is and what it is doing.
    holds: function (key) {
      if (!GROUND || !key) { return false; }
      if (!places) { lists(); return false; }
      return !!places[key];
    },
    ring: function () {
      var r = ground.on && ground.ring;
      return r ? { cx: r.cx, cy: r.cy, R: r.R, st: r.st, rx: r.R, ry: r.R * r.st } : null;
    },
    hand: function () {
      if (!ground.on || !ground.ring) { return null; }
      var hs = ground.hs, h = ground.hand;
      return { id: h ? h.id : null, name: h ? h.name : null, line: h ? h.line : null, t: hs.t, x: hs.x, y: hs.y,
               pose: hs.pose, n: hs.n, dir: hs.dir, alt: hs.alt, half: hs.half, box: ground.box, scale: ground.scale };
    },
    // A city being come down into from the world (land.js, descent): its ground and its museums read now,
    // so its skyline is made by the time it is near.
    prefetch: function (key) {
      return lists().then(function () {
        var P = places && places[key];
        if (!P) { return; }
        once("grounds/city-" + key + ".json");
        (P.museums || []).concat(buildingsIn(P).map(function (b) { return b.slug; })).forEach(function (s) { once("models/" + s + ".json"); });
        if (!livesRows) { once("lives.json"); }
      });
    },
    // land.js's two fingers when one is off the skyline (on the dial): the skyline's own pinch, by spread.
    pinch: function (d, mx, my) {
      if (!city || !on_ || leaving) { return false; }
      if (!extPinch) {
        extPinch = { kind: "two", d: Math.max(1, d), mx: mx, my: my, over: 1 };
        gesture = null;
        pointers = {};
        settleTo(null);
        return true;
      }
      pinchStep(extPinch, Math.max(1, d), mx, my);
      return true;
    },
    pinchEnd: function () {
      if (!extPinch) { return; }
      extPinch = null;
      if (into && into.fingers) { intoLetGo(); }
    },
    // Going into a museum: where its building stands on the screen now (foot and top), for its own
    // view to grow from (land.js startBuilding); null otherwise.
    target: function () {
      if (!leaving || !into || !into.a || !frameNow || !band || !city) { return null; }
      var a = into.a, foot = toScreen(project(frameNow, a.at.x, a.at.y, a.z0 || 0));
      // Its ground's middle on the screen, and the skyline's pixels a metre there.
      return { fx: foot.x, fy: foot.y, ppm: frameNow.scale / city.cell };
    },
    // For the tests: the way in, as it stands.
    into: function () {
      return into ? { kind: into.a ? into.a.kind : "ground", name: into.a ? into.a.name : null, slug: into.a ? into.a.slug || null : null,
                      k: into.k, done: into.done, tween: !!into.tween, leaving: !!leaving } : (leaving ? { leaving: true } : null);
    },
    // The city's story (chronicle.js): a moment's museum ({museum: slug}) or gallery ({venue: vi}) lit.
    light: function (l, on) {
      if (!city || !on_ || !l) { return; }
      var a = city.arts.filter(function (x) { return l.museum ? x.slug === l.museum : x.kind === "gallery" && x.vi === l.venue; })[0];
      if (a) { lightArt(a.k, !!on); }
    },
    // The Artists layer: a town where several saved artists were born (lives.js) — its city key,
    // where the town has a skyline, else null (the town's Born here reading stays).
    bornTown: function (m) {
      return Promise.all([lists(), once("cities.json")]).then(function (r) {
        var d = r[1];
        if (!d || !places) { return null; }
        var best = null, bd = 0.02;
        d.towns.forEach(function (t) {
          var dd = Math.abs(t[3] - m[0]) + Math.abs(t[4] - m[1]);
          if (dd < bd && places[t[0]]) { bd = dd; best = t[0]; }
        });
        return best;
      });
    },
    // What a city holds of the categories the skyline shows (land.js counts them on the city's ring): its
    // artists who walk it (-1 before the lists are read).
    cast: function (key) { return { artists: artistsAll ? (artistsAll[key] || []).length : -1, category: cat }; },
    // For the tests: one draw (its time is the caller's to measure), and how many dots.
    _draw: function () { if (city && on_) { sorted.heading = null; draw(); } },
    _pointers: function () { return { pointers: Object.keys(pointers), gesture: gesture && gesture.kind }; },
    _count: function () { return city ? city.dots.count : 0; },
    // A place on the skyline, on the screen: {x, y, z} with z 1 inside its square, -1 outside; null when off.
    at: function (lat, lon) {
      if (!on_ || !city || !frameNow || !band) { return null; }
      var c = city.toCell(lat, lon), n = city.n;
      if (Math.abs(c.x) >= n / 2 || Math.abs(c.y) >= n / 2) { return { x: -1e4, y: -1e4, z: -1 }; }
      var i = Math.max(0, Math.min(n - 1, Math.floor(c.y + n / 2))), j = Math.max(0, Math.min(n - 1, Math.floor(c.x + n / 2)));
      var p = toScreen(project(frameNow, c.x, c.y, city.zAt(i * n + j)));
      return { x: p.x, y: p.y, z: 1 };
    },
    state: function () {
      return { on: on_, key: city && city.key, arts: city ? city.arts.map(function (a) { return { kind: a.kind, name: a.name, cells: a.cells.length }; }) : [],
               marks: marks.map(function (mk) { return { name: mk.a.name, kind: mk.a.kind, x: mk.x, y: mk.y, named: mk.named, hidden: mk.btn.hidden }; }),
               bits: bits.map(function (o) { var r = o.btn.getBoundingClientRect(); return { key: o.b.key, hidden: !!o.btn.hidden, named: !!o.btn.dataset.named, x: r.x, y: r.y, w: r.width, h: r.height }; }),
               walkers: walkers.map(function (w) { return { id: w.r[0], name: w.r[1], x: w.x, y: w.y, phil: !!w.phil, named: !!w.btn.dataset.named, hidden: !!w.btn.hidden, leaving: !!w.leaving }; }),
               category: cat, note: note ? note.textContent : "",
               heading: view.heading, zoom: view.zoom, shown: shownNow, year: city && city.yearNow, band: band,
               // How it is drawn: on the GPU or the 2D canvas, its grid, its dots (or strips), the ms it took to make.
               gpu: !!(city && city.dots.gpu), n: city && city.n, cell: city && city.cell, count: city ? city.dots.count : 0,
               ms: city && city.ms, density: density, years: !!(city && city.years) };
    }
  };
  requestAnimationFrame(tick);
})();

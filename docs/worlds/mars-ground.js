/* Mars at eye height: the ground of the region you came down in.

   The site has no street-level Mars, so it is made here from what Mars is
   like at that kind of place, in the same form as the site's city grounds
   (a square of 20 m cells: kind, height, rocks), for street.js to stand up:
   the rolling dust, craters with their bowls and raised rims, boulders
   strewn thickest at the rims, a dune field, a dry riverbed wandering
   across, and the features a way off is made from: an ice cliff where
   buried ice shows in a crater's shaded wall (most at the poles and the
   northern plains), a lava tube's collapsed skylight (most on the
   volcanoes), and a lander that came before you. Dust devils cross it.

   Worlds.marsGround(region, seed) → a ground for Street.open({ ground }). */

(function () {
  "use strict";

  var N = 180, SIDE = 3600, C = SIDE / N;

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function noise(r) {
    // A value noise of a few octaves, on the grid.
    var octs = [[8, 9], [20, 4], [45, 1.6]], fields = octs.map(function (o) {
      var m = Math.ceil(N / o[0]) + 2, a = new Float32Array(m * m);
      for (var i = 0; i < a.length; i += 1) { a[i] = r() * 2 - 1; }
      return { m: m, a: a, step: o[0], amp: o[1] };
    });
    return function (i, j) {
      var v = 0;
      fields.forEach(function (f) {
        var x = i / f.step, y = j / f.step, x0 = Math.floor(x), y0 = Math.floor(y), u = x - x0, w = y - y0;
        u = u * u * (3 - 2 * u); w = w * w * (3 - 2 * w);
        var A = f.a[y0 * f.m + x0], B = f.a[y0 * f.m + x0 + 1], Cc = f.a[(y0 + 1) * f.m + x0], D = f.a[(y0 + 1) * f.m + x0 + 1];
        v += ((A * (1 - u) + B * u) * (1 - w) + (Cc * (1 - u) + D * u) * w) * f.amp;
      });
      return v;
    };
  }

  function marsGround(region, seed) {
    var r = rng(seed * 7919 + 13), nz = noise(r), name = region.name || "";
    var polar = Math.abs(region.lat) > 60 || /Boreum|Australe|Vastitas/.test(name);
    var volcanic = /Mons|Montes|Tharsis|Elysium|Alba/.test(name);
    var icy = polar || /Utopia|Arcadia|Acidalia/.test(name);
    var h = new Float32Array(N * N), kind = new Array(N * N), tall = new Uint8Array(N * N);
    var i, j, q;
    for (j = 0; j < N; j += 1) { for (i = 0; i < N; i += 1) { q = j * N + i; h[q] = nz(i, j) * (volcanic ? 1.6 : 1); kind[q] = "."; } }

    // Craters: a bowl, a raised rim, rocks thrown out round it.
    var craters = [];
    for (var k = 0; k < 8; k += 1) {
      var R = (k === 0 ? 320 : 60 + r() * 200) / C, cx = 20 + r() * (N - 40), cy = 20 + r() * (N - 40);
      if (Math.hypot(cx - N / 2, cy - N / 2) < R + 12) { cx = (cx + N / 3) % (N - 30) + 15; }
      craters.push({ x: cx, y: cy, R: R });
    }
    craters.forEach(function (cr) {
      var x0 = Math.max(0, Math.floor(cr.x - cr.R * 1.6)), x1 = Math.min(N - 1, Math.ceil(cr.x + cr.R * 1.6));
      var y0 = Math.max(0, Math.floor(cr.y - cr.R * 1.6)), y1 = Math.min(N - 1, Math.ceil(cr.y + cr.R * 1.6));
      for (var jj = y0; jj <= y1; jj += 1) {
        for (var ii = x0; ii <= x1; ii += 1) {
          var d = Math.hypot(ii - cr.x, jj - cr.y) / cr.R, qq = jj * N + ii;
          if (d < 1) { h[qq] -= cr.R * C * 0.18 * (1 - d * d); }
          h[qq] += cr.R * C * 0.05 * Math.exp(-Math.pow((d - 1) / 0.16, 2));
          if (d > 0.85 && d < 1.5 && r() < 0.06 * (1.5 - d)) { kind[qq] = "b"; tall[qq] = 1; }
        }
      }
    });

    // A dry riverbed wandering across, its floor a little lighter.
    var ry = N * (0.25 + r() * 0.5), dir = r() < 0.5 ? 1 : -1;
    for (i = 0; i < N; i += 1) {
      ry += Math.sin(i / 11 + seed) * 0.7 * dir;
      for (j = Math.floor(ry) - 3; j <= Math.floor(ry) + 3; j += 1) {
        if (j < 0 || j >= N) { continue; }
        q = j * N + i;
        h[q] -= 3.2 * (1 - Math.abs(j - ry) / 3.5);
        if (Math.abs(j - ry) < 1.6) { kind[q] = "d"; tall[q] = 0; }
      }
    }
    var riverAt = { x: N * 0.7, y: ry };

    // Boulders across the plain; a dune field of ripples.
    var duneX = 20 + r() * (N - 60), duneY = 20 + r() * (N - 60);
    for (j = 0; j < N; j += 1) {
      for (i = 0; i < N; i += 1) {
        q = j * N + i;
        if (kind[q] === "." && r() < (volcanic ? 0.022 : 0.012)) { kind[q] = "b"; tall[q] = r() < 0.2 ? 2 : 1; }
        var dd = Math.hypot(i - duneX - 15, j - duneY - 15);
        if (dd < 18) {
          h[q] += 2.4 * Math.sin((i * 0.7 + j * 0.35)) * (1 - dd / 18);
          kind[q] = "d"; tall[q] = 0;
        }
      }
    }

    // The ice cliff: the shaded north wall of the largest crater (most of it at the poles).
    var big = craters[0], sites = [];
    var iceN = icy ? 1 : 0.45;
    for (j = 0; j < N; j += 1) {
      for (i = 0; i < N; i += 1) {
        var d2 = Math.hypot(i - big.x, j - big.y) / big.R;
        if (d2 > 0.55 && d2 < 1.0 && j < big.y && Math.abs(i - big.x) < big.R * 0.7 * iceN + 4) { q = j * N + i; kind[q] = "i"; tall[q] = 0; }
        if (polar && nz(i * 2, j * 2) > 3.5) { q = j * N + i; kind[q] = "i"; tall[q] = 0; }
      }
    }
    // The lava tube's skylight: a dark pit in the basalt.
    var lx = 20 + r() * (N - 40), ly = 20 + r() * (N - 40), lr = volcanic ? 9 : 6;
    for (j = Math.floor(ly - lr * 2); j <= ly + lr * 2; j += 1) {
      for (i = Math.floor(lx - lr * 2); i <= lx + lr * 2; i += 1) {
        if (i < 0 || j < 0 || i >= N || j >= N) { continue; }
        var dl = Math.hypot(i - lx, j - ly) / lr;
        q = j * N + i;
        if (dl < 2) { kind[q] = "p"; tall[q] = 0; }
        if (dl < 0.6) { h[q] -= 9 * (1 - dl / 0.6); }
      }
    }
    // The lander that came before you, half buried.
    var ox = 20 + r() * (N - 40), oy = 20 + r() * (N - 40);
    for (j = Math.floor(oy) - 1; j <= Math.floor(oy) + 1; j += 1) { for (i = Math.floor(ox) - 1; i <= Math.floor(ox) + 1; i += 1) { q = j * N + i; kind[q] = "."; tall[q] = 0; } }
    q = Math.floor(oy) * N + Math.floor(ox); kind[q] = "b"; tall[q] = 1;

    var toM = function (ci) { return (ci + 0.5) * C - SIDE / 2; };
    sites.push({ key: "ice", name: "The ice cliff", x: toM(big.x), z: toM(big.y - big.R * 0.8), r: 60, kind: "place" });
    sites.push({ key: "rim", name: "The crater rim", x: toM(big.x + big.R), z: toM(big.y), r: 50, kind: "place" });
    sites.push({ key: "tube", name: "The lava tube", x: toM(lx), z: toM(ly), r: 45, kind: "place" });
    sites.push({ key: "lander", name: "The old lander", x: toM(ox), z: toM(oy), r: 34, kind: "place" });
    sites.push({ key: "dunes", name: "The dune field", x: toM(duneX + 15), z: toM(duneY + 15), r: 70, kind: "place" });
    sites.push({ key: "riverbed", name: "The dry riverbed", x: toM(riverAt.x), z: toM(riverAt.y), r: 50, kind: "place" });

    // Where you came down: open, level ground near the middle, clear of rocks.
    var crash = { x: 0, z: 0 };
    for (var rr = 0; rr < 30; rr += 1) {
      var ci = Math.floor(N / 2 + (r() - 0.5) * rr * 2), cj = Math.floor(N / 2 + (r() - 0.5) * rr * 2), ok = true;
      for (j = cj - 2; j <= cj + 2; j += 1) { for (i = ci - 2; i <= ci + 2; i += 1) { if (kind[j * N + i] === "b") { ok = false; } } }
      if (ok) { crash = { x: toM(ci), z: toM(cj) }; break; }
    }
    for (j = -3; j <= 3; j += 1) { for (i = -3; i <= 3; i += 1) { q = (Math.floor(N / 2) + j) * N + Math.floor(N / 2) + i; if (kind[q] === "b") { kind[q] = "."; tall[q] = 0; } } }

    // The dust devils' paths: long straight runs across the plain.
    var lanes = [];
    for (k = 0; k < 14; k += 1) {
      lanes.push({ axis: k % 2, fixed: 8 + Math.floor(r() * (N - 16)), a: 4, b: N - 4 });
    }

    var ground = new Array(N * N), tallS = "";
    for (q = 0; q < N * N; q += 1) { ground[q] = Math.max(0, Math.round((h[q] + 120) * 2)); tallS += String.fromCharCode(48 + tall[q]); }
    return { n: N, side: SIDE, kind: kind.join(""), tall: tallS, ground: ground, sites: sites, crash: crash, lanes: lanes };
  }

  window.Worlds = window.Worlds || {};
  window.Worlds.marsGround = marsGround;
})();

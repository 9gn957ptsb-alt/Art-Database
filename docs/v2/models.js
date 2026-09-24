/* The buildings, built — models of the Architectural Authority's buildings,
   drawn in DIRT.

   A model is a small description of a building, written by hand from the
   photographs of it (docs/v2/models/<slug>.json, see MODELS.md beside it):
   boxes, gables, slopes, cylinders, domes and blobs, each of a material,
   and cuts that take volume away again — a courtyard, a window band, the
   void under an overhang. Here it is filled in as voxels, and every voxel
   on the outside becomes one dot: the material's colour worn over the soil
   of the place, lit from the upper left of the world, glass left open so it
   reads as glass. It stands on a clod of its own ground and rises out of it
   a storey at a time.

   Shared by land.js (the building view) and the preview used to check a
   model against its photographs. */

(function () {
  "use strict";

  // Each material: a colour, how much of the place's soil shows through it,
  // how open it is (0 solid, 0.5 every other dot — glass), and its dot size.
  var MATERIALS = {
    concrete: { c: [168, 166, 160], soil: 0.14 },
    render:   { c: [236, 231, 222], soil: 0.10 },
    white:    { c: [246, 243, 236], soil: 0.06 },
    stone:    { c: [178, 164, 142], soil: 0.22 },
    rubble:   { c: [132, 120, 104], soil: 0.30 },     // grey-brown field stone, dry-stone walls
    marble:   { c: [232, 228, 220], soil: 0.06 },
    brick:    { c: [158, 84, 58], soil: 0.14 },
    tile:     { c: [170, 88, 56], soil: 0.10 },
    earth:    { c: [178, 126, 82], soil: 0.35 },      // rammed earth, adobe
    ochre:    { c: [208, 172, 130], soil: 0.24 },     // concrete or plaster tinted to the ground
    wood:     { c: [178, 128, 82], soil: 0.10 },
    timber:   { c: [104, 72, 46], soil: 0.10 },
    thatch:   { c: [170, 142, 88], soil: 0.20 },
    glass:    { c: [88, 110, 128], soil: 0.04, open: 0.5 },
    metal:    { c: [150, 154, 160], soil: 0.04 },
    steel:    { c: [150, 154, 160], soil: 0.04 },
    dark:     { c: [52, 50, 50], soil: 0.06 },
    corten:   { c: [150, 76, 40], soil: 0.10 },
    water:    { c: [70, 132, 168], soil: 0.08 },
    plant:    { c: [84, 112, 64], soil: 0.18, size: 2 },
    grass:    { c: [118, 140, 82], soil: 0.30 },
    sand:     { c: [222, 204, 170], soil: 0.25 },
    gravel:   { c: [186, 180, 168], soil: 0.30 },
    paving:   { c: [206, 198, 186], soil: 0.20 },
    soil:     { c: null, soil: 1 }                     // the DIRT itself
  };

  var DEEP = 6;          // layers of soil under the plate's edge

  function grainAt(i, j, k) {
    var h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function mix(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  function ink(c, light) {
    return "rgb(" + Math.round(Math.min(255, c[0] * light)) + "," +
           Math.round(Math.min(255, c[1] * light)) + "," +
           Math.round(Math.min(255, c[2] * light)) + ")";
  }

  /* Fill the model in. x runs east, y south, z up, in metres, with the
     middle of the site at 0,0; a part's x,y,z is its corner nearest the
     north-west and the ground. */
  function voxelize(spec) {
    var v = spec.voxel || 0.5;
    var site = spec.site || [30, 30];
    var nx = Math.ceil(site[0] / v), ny = Math.ceil(site[1] / v);
    var top = 0;
    (spec.parts || []).forEach(function (p) {
      if (p.mesh) {
        for (var q = 2; q < p.mesh.v.length; q += 3) { top = Math.max(top, p.mesh.v[q]); }
        return;
      }
      var a = p.box || p.gable || p.shed || p.cut || p.blob || p.cyl || p.dome || p.tree;
      if (!a) { return; }
      if (p.box || p.gable || p.shed) { top = Math.max(top, a[2] + a[5]); }
      if (p.cyl) { top = Math.max(top, a[2] + a[4]); }
      if (p.dome) { top = Math.max(top, a[2] + a[3]); }
      if (p.blob) { top = Math.max(top, a[2] + a[5]); }
      if (p.tree) { top = Math.max(top, a[2]); }
    });
    var nz = Math.min(400, Math.ceil(top / v) + 2);
    var grid = new Uint8Array(nx * ny * nz);          // 0 empty, else material index + 1
    var names = Object.keys(MATERIALS);
    function mi(name) { var i = names.indexOf(name || "concrete"); return (i < 0 ? 0 : i) + 1; }
    function I(x) { return Math.floor((x + site[0] / 2) / v); }
    function J(y) { return Math.floor((y + site[1] / 2) / v); }
    function K(z) { return Math.floor(z / v); }
    function each(x0, y0, z0, x1, y1, z1, fn) {
      var i0 = Math.max(0, I(x0)), i1 = Math.min(nx - 1, I(x1 - 1e-6));
      var j0 = Math.max(0, J(y0)), j1 = Math.min(ny - 1, J(y1 - 1e-6));
      var k0 = Math.max(0, K(z0)), k1 = Math.min(nz - 1, K(z1 - 1e-6));
      for (var k = k0; k <= k1; k += 1) {
        for (var j = j0; j <= j1; j += 1) {
          for (var i = i0; i <= i1; i += 1) {
            // The voxel's centre, in metres.
            var cx = (i + 0.5) * v - site[0] / 2, cy = (j + 0.5) * v - site[1] / 2, cz = (k + 0.5) * v;
            var r = fn(cx, cy, cz);
            if (r === undefined) { continue; }
            grid[(k * ny + j) * nx + i] = r;
          }
        }
      }
    }

    /* A closed mesh — modelled in SketchUp and read back as triangles, for
       what the other parts can't shape (a curving sail, a carved cave). Each
       column of voxels is filled wherever a vertical line through its centre
       is inside the surface: between the first crossing and the second, the
       third and the fourth, and so on. */
    function fillMesh(mesh, m) {
      var V = mesh.v, F = mesh.f;
      var cols = {};
      for (var t = 0; t < F.length; t += 3) {
        var a0 = F[t] * 3, b0 = F[t + 1] * 3, c0 = F[t + 2] * 3;
        var ax = V[a0], ay = V[a0 + 1], az = V[a0 + 2];
        var bx = V[b0], by = V[b0 + 1], bz = V[b0 + 2];
        var cx = V[c0], cy = V[c0 + 1], cz = V[c0 + 2];
        var den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(den) < 1e-12) { continue; }          // edge-on from above
        var i0 = Math.max(0, I(Math.min(ax, bx, cx))), i1 = Math.min(nx - 1, I(Math.max(ax, bx, cx)));
        var j0 = Math.max(0, J(Math.min(ay, by, cy))), j1 = Math.min(ny - 1, J(Math.max(ay, by, cy)));
        for (var j = j0; j <= j1; j += 1) {
          for (var i = i0; i <= i1; i += 1) {
            var px = (i + 0.5) * v - site[0] / 2, py = (j + 0.5) * v - site[1] / 2;
            var l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
            var l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
            var l3 = 1 - l1 - l2;
            if (l1 < 0 || l2 < 0 || l3 < 0) { continue; }
            var key = j * nx + i;
            (cols[key] || (cols[key] = [])).push(l1 * az + l2 * bz + l3 * cz);
          }
        }
      }
      Object.keys(cols).forEach(function (key) {
        // A line through a shared edge crosses both its triangles at once:
        // that is one crossing, not two.
        var zs = [];
        cols[key].sort(function (p1, p2) { return p1 - p2; }).forEach(function (z) {
          if (!zs.length || z - zs[zs.length - 1] > 1e-6) { zs.push(z); }
        });
        var i = key % nx, j = Math.floor(key / nx);
        for (var n = 0; n + 1 < zs.length; n += 2) {
          for (var k = Math.max(0, K(zs[n])); k <= Math.min(nz - 1, K(zs[n + 1])); k += 1) {
            grid[(k * ny + j) * nx + i] = m;
          }
        }
      });
    }

    (spec.parts || []).forEach(function (p) {
      var m = mi(p.m), a;
      if ((a = p.box)) {
        each(a[0], a[1], a[2], a[0] + a[3], a[1] + a[4], a[2] + a[5], function () { return m; });
      } else if ((a = p.cut)) {
        each(a[0], a[1], a[2], a[0] + a[3], a[1] + a[4], a[2] + a[5], function () { return 0; });
      } else if ((a = p.gable)) {
        // A pitched roof, its ridge along the given axis, eaves at z.
        var alongX = (p.axis || "x") === "x";
        each(a[0], a[1], a[2], a[0] + a[3], a[1] + a[4], a[2] + a[5], function (x, y, z) {
          var half = alongX ? a[4] / 2 : a[3] / 2;
          var off = alongX ? Math.abs(y - (a[1] + a[4] / 2)) : Math.abs(x - (a[0] + a[3] / 2));
          return z - a[2] <= a[5] * (1 - off / half) ? m : undefined;
        });
      } else if ((a = p.shed)) {
        // A mono-pitch: full height on the side it rises to, nothing on the other.
        // With "thick", only a slab of that thickness under the slope: a
        // tilted roof plate rather than a wedge.
        var rise = p.rise || "+x", thick = p.thick || 0;
        each(a[0], a[1], a[2], a[0] + a[3], a[1] + a[4], a[2] + a[5] + thick, function (x, y, z) {
          var t = rise[1] === "x" ? (x - a[0]) / a[3] : (y - a[1]) / a[4];
          if (rise[0] === "-") { t = 1 - t; }
          var under = a[2] + a[5] * t;
          if (thick) { return z <= under + thick && z >= under ? m : undefined; }
          return z - a[2] <= a[5] * t ? m : undefined;
        });
      } else if ((a = p.cyl)) {
        each(a[0] - a[3], a[1] - a[3], a[2], a[0] + a[3], a[1] + a[3], a[2] + a[4], function (x, y) {
          var dx = x - a[0], dy = y - a[1];
          return dx * dx + dy * dy <= a[3] * a[3] ? m : undefined;
        });
      } else if ((a = p.dome)) {
        each(a[0] - a[3], a[1] - a[3], a[2], a[0] + a[3], a[1] + a[3], a[2] + a[3], function (x, y, z) {
          var dx = x - a[0], dy = y - a[1], dz = z - a[2];
          return dx * dx + dy * dy + dz * dz <= a[3] * a[3] ? m : undefined;
        });
      } else if ((a = p.blob)) {
        // An ellipsoid: cx, cy, cz, rx, ry, rz — for anything that curves.
        each(a[0] - a[3], a[1] - a[4], a[2] - a[5], a[0] + a[3], a[1] + a[4], a[2] + a[5], function (x, y, z) {
          var dx = (x - a[0]) / a[3], dy = (y - a[1]) / a[4], dz = (z - a[2]) / a[5];
          return dx * dx + dy * dy + dz * dz <= 1 ? m : undefined;
        });
      } else if ((a = p.tree)) {
        // cx, cy, height, crown radius: a trunk and a round crown.
        var trunk = mi("timber"), crown = mi(p.m || "plant");
        each(a[0] - v, a[1] - v, 0, a[0] + v, a[1] + v, a[2] - a[3], function () { return trunk; });
        each(a[0] - a[3], a[1] - a[3], a[2] - 2 * a[3], a[0] + a[3], a[1] + a[3], a[2], function (x, y, z) {
          var dx = x - a[0], dy = y - a[1], dz = (z - (a[2] - a[3])) * 1.15;
          return dx * dx + dy * dy + dz * dz <= a[3] * a[3] ? crown : undefined;
        });
      } else if (p.mesh) {
        fillMesh(p.mesh, m);
      } else if ((a = p.pool)) {
        // x, y, w, d: water let into the ground, its surface at ground level.
        each(a[0], a[1], 0, a[0] + a[2], a[1] + a[3], v, function () { return mi("water"); });
      }
    });
    return { grid: grid, nx: nx, ny: ny, nz: nz, v: v, names: names, site: site };
  }

  /* The dots: every voxel with open air beside it, and the plate of ground
     it stands on. soil(i, j) gives the DIRT at a cell of the plate as
     [r, g, b, size] (size 0 is a gap in the soil), or null. */
  function build(spec, soil) {
    var vx = voxelize(spec);
    var g = vx.grid, nx = vx.nx, ny = vx.ny, nz = vx.nz, v = vx.v;
    var dots = { x: [], y: [], z: [], size: [], ink: [], reveal: [] };
    var ground = MATERIALS[spec.ground || "soil"] || MATERIALS.soil;
    function soilAt(i, j) { return soil(i, j) || [138, 118, 96, 2]; }
    function put(x, y, z, size, c, reveal) {
      dots.x.push(x); dots.y.push(y); dots.z.push(z);
      dots.size.push(size); dots.ink.push(c); dots.reveal.push(reveal);
    }
    function at(i, j, k) {
      if (i < 0 || j < 0 || i >= nx || j >= ny || k >= nz) { return 0; }
      if (k < 0) { return 1; }                       // the ground is solid
      return g[(k * ny + j) * nx + i];
    }
    var ox = nx / 2, oy = ny / 2;

    /* Shade: the sun is up and to the north-west, as the light on the globe
       is. A dot with anything between it and the sun — under an overhang, in
       a courtyard, on the ground east of a wall — is in shadow. */
    function shaded(i, j, k) {
      for (var s = 1; s < nz * 1.2; s += 1) {
        var a = i - s, b = j - s, c = k + Math.round(s * 1.1);
        if (c >= nz || a < 0 || b < 0) { return false; }
        if (g[(c * ny + b) * nx + a]) { return true; }
      }
      return false;
    }

    // The plate: the ground of the site, the place's DIRT, a layer thick,
    // with its edges going down into the earth.
    for (var j = 0; j < ny; j += 1) {
      for (var i = 0; i < nx; i += 1) {
        var s = soilAt(i, j);
        var c = ground.c ? mix(ground.c, s, ground.soil) : s;
        if (!at(i, j, 0)) {
          var size = ground.c ? 2 : s[3];
          var sun = shaded(i, j, 0) ? 0.62 : 1;
          if (size) { put(i - ox, j - oy, 0, size, ink(c, sun * (0.92 + ((i + j) % 3) * 0.04)), 0); }
        }
        if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) {
          var under = soilAt(i + nx, j);
          for (var d = 1; d <= DEEP; d += 1) {
            put(i - ox, j - oy, -d, Math.max(1, under[3]), ink(under, 0.78 - d * 0.035), 0);
          }
        }
      }
    }

    // The building: each outside voxel, lit by which of its faces is open.
    for (var k = 0; k < nz; k += 1) {
      for (j = 0; j < ny; j += 1) {
        for (i = 0; i < nx; i += 1) {
          var m = g[(k * ny + j) * nx + i];
          if (!m) { continue; }
          var up = !at(i, j, k + 1), west = !at(i - 1, j, k), north = !at(i, j - 1, k);
          var east = !at(i + 1, j, k), south = !at(i, j + 1, k);
          if (!(up || west || north || east || south)) { continue; }
          var mat = MATERIALS[vx.names[m - 1]];
          // Glass is left open: every other dot, so what is behind shows.
          if (mat.open && ((i + j + k) % 2)) { continue; }
          var base = mat.c ? mix(mat.c, soilAt(i, j), mat.soil) : soilAt(i, j);
          var light = up ? 1.08 : (west || north) ? 0.94 : 0.74;
          // And the grain of it: no two dots of a wall quite the same, the
          // way no two clods of the soil are.
          light *= 0.93 + 0.14 * grainAt(i, j, k);
          if (shaded(i, j, k + 1)) { light *= 0.66; }
          put(i - ox, j - oy, k + 1, mat.size || 2, ink(base, light), (k + 1) / nz);
        }
      }
    }
    dots.count = dots.x.length;
    dots.span = Math.max(nx, ny);
    dots.lift = nz;
    return dots;
  }

  /* Draw the dots, turned to a heading, seen from a little above, on a
     canvas one pixel of which is a few of the screen's. shown (0–1) is how
     far it has risen. */
  var TILT = 0.62;
  var sorter = { order: null, key: null };

  function draw(canvas, dots, heading, shown, fit) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var cos = Math.cos(heading), sin = Math.sin(heading);
    var st = Math.sin(TILT), ct = Math.cos(TILT);
    // Fit the plate turned any way, with room above for what stands on it.
    var tall = (dots.lift || 0) * ct;
    var scale = Math.min(w * (fit || 0.9) / (dots.span * 1.42),
                         h * 0.86 / (dots.span * 1.42 * st + tall));
    var cx0 = w / 2, cy0 = h * 0.5 + tall * scale * 0.42;
    var grain = Math.max(0.5, scale * 0.42);
    if (!sorter.order || sorter.order.length < dots.count) {
      sorter.order = new Uint32Array(dots.count);
      sorter.key = new Float32Array(dots.count);
    }
    var order = sorter.order, key = sorter.key, m = 0, k;
    for (k = 0; k < dots.count; k += 1) {
      if (dots.reveal[k] > shown) { continue; }
      var yr = dots.x[k] * sin + dots.y[k] * cos;
      key[k] = yr * ct + dots.z[k] * st;
      order[m] = k; m += 1;
    }
    var live = order.subarray(0, m);
    live.sort(function (a, b) { return key[a] - key[b]; });
    var was = null;
    for (var t = 0; t < m; t += 1) {
      k = live[t];
      var xr = dots.x[k] * cos - dots.y[k] * sin;
      var yr2 = dots.x[k] * sin + dots.y[k] * cos;
      var sx = cx0 + xr * scale;
      var sy = cy0 + (yr2 * st - dots.z[k] * ct) * scale;
      var r = Math.max(1, Math.round(dots.size[k] * grain));
      if (dots.ink[k] !== was) { ctx.fillStyle = was = dots.ink[k]; }
      ctx.fillRect(Math.round(sx - r / 2), Math.round(sy - r / 2), r, r);
    }
  }

  window.Models = { MATERIALS: MATERIALS, voxelize: voxelize, build: build, draw: draw };
})();

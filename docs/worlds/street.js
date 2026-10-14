/* The street: a city of the Artist Website walked at eye height.

   Each of the site's 28 cities has a ground (docs/v2/grounds/city-*.json,
   written by scripts/build_grounds.py): a square of cells about 20 m
   across, each one land, street, green, water or building, with its
   building's storeys (3.2 m a storey), its year, and the height of the
   ground. Here every building cell is stood up at its true height, the
   greens carry trees, the water takes the sky, and the city's museums are
   set in at their points as the site models them (docs/v2/models/,
   models.js), so their outsides can be walked round as the site's walks
   go round their insides.

   It is drawn in the site's pixel: every pixel two of the screen's, the
   light dithered, lit by the real sun for the city's place and hour, with
   the windows lit when it is dark.

   Every world begins the same way: you come to under a tree after the
   crash, as a film opens (o.intro): dark, then the eyes opening and closing,
   the branches out of focus overhead, sitting up, and turning to the wreck.

   The streets carry traffic, as Frogger's road does: struck, you come to
   again under your tree, with what you found still found. On Mars the
   traffic is the dust devils.

   Street.open(o) — o: host, base ("../v2/"), place (a cityplaces.json
   entry, or a world's own place with o.ground), at {lat, lon} to begin
   nearest, sun ([x, y, z] on the Earth) or fixedSun ([east, up, south]),
   look (the world's ground, sky and movers), intro (the opening's lines),
   onOut(), onNear(site or null), onSite(site), onHit(), onWhere({lat, lon}),
   siteTag(site). It resolves with { sites, crash }. Street.close(). */

(function () {
  "use strict";

  var EYE = 1.6, PACE = 1.4, BRISK = 4.2, STOREY = 3.2, PIX = 2, FOV = 66 * Math.PI / 180;
  var RAD = Math.PI / 180;

  var VS = [
    "#version 300 es",
    "in vec3 aP; in vec3 aN; in vec4 aC;",
    "uniform mat4 uVP; uniform vec3 uOff; uniform float uSwap; uniform vec4 uCol;",
    "out vec3 vP; out vec3 vN; out vec3 vC; flat out int vK; out float vS;",
    "void main() { vec3 p = mix(aP, aP.zyx, uSwap) + uOff; vP = p; vN = mix(aN, aN.zyx, uSwap); vC = uCol.a > 0.5 ? uCol.rgb : aC.rgb;",
    "  vK = int(aC.a * 255.0 + 0.5) & 15; vS = floor(aC.a * 255.0 / 16.0 + 0.01); gl_Position = uVP * vec4(p, 1.0); }"
  ].join("\n");

  var FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec3 vP; in vec3 vN; in vec3 vC; flat in int vK; in float vS;",
    "out vec4 o;",
    "uniform vec3 uEye; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSkyTop; uniform vec3 uSkyLow; uniform float uNight; uniform float uFog;",
    "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float bayer(vec2 p) { ivec2 q = ivec2(mod(p, 4.0)); int i = q.x + q.y * 4;",
    "  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + 0.5) / 16.0; }",
    "void main() {",
    "  vec3 n = normalize(vN), v = normalize(uEye - vP);",
    "  float diff = max(dot(n, uSun), 0.0);",
    "  vec3 amb = mix(uSkyLow * 0.55, uSkyTop, 0.5 + 0.5 * n.y) * (0.55 + 0.25 * (1.0 - uNight)) + uNight * vec3(0.07, 0.065, 0.08);",
    "  vec3 base = vC;",
    "  vec3 glow = vec3(0.0);",
    // The facades: storeys and windows on every wall of the city's own buildings.
    "  if (vK == 1) {",
    "    float along = abs(n.x) > 0.5 ? vP.z : vP.x;",
    "    float wx = fract(along / 3.1), wy = fract(vP.y / 3.2);",
    "    float win = step(0.2, wx) * step(wx, 0.72) * step(0.3, wy) * step(wy, 0.82);",
    "    vec3 sky = mix(uSkyLow, uSkyTop, 0.4);",
    // Seen straight on a window is glass; along the wall it closes into the wall.
    "    float face = abs(dot(n, v));",
    "    vec3 glass = mix(base * 0.42, sky * 0.55, 0.25 + 0.3 * (1.0 - face));",
    "    base = mix(base, glass, win * 0.8 * smoothstep(0.08, 0.45, face));",
    "    float lit = step(0.62, hash(floor(vec2(along / 3.1, vP.y / 3.2)) + floor(vP.xz / 23.0)));",
    "    glow = win * lit * uNight * vec3(1.0, 0.78, 0.48) * 0.95;",
    "  }",
    "  vec3 col = base * (amb + diff * uSunCol);",
    // Water takes the sky, and the sun's glint.
    "  if (vK == 3) {",
    "    float fr = pow(1.0 - max(dot(v, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);",
    "    col = mix(base * (amb + 0.3), mix(uSkyLow, uSkyTop, 0.3), 0.25 + 0.6 * fr);",
    "    vec3 h = normalize(uSun + v); col += uSunCol * pow(max(dot(h, vec3(0.0, 1.0, 0.0)), 0.0), 240.0) * 1.4;",
    "  }",
    // The streets at night: the lamps' warm pools.
    "  if (vK == 0 && vS > 0.5) { float d = length(fract(vP.xz / 28.0) - 0.5); glow += uNight * vec3(1.0, 0.72, 0.4) * smoothstep(0.32, 0.0, d) * 0.22; }",
    // The museums' own surfaces; at night, floodlit from below, warm, as Paris lights its monuments.
    "  if (vK == 6) { col = base * (amb * 0.9 + diff * uSunCol * 1.05); glow += uNight * base * vec3(0.55, 0.42, 0.26) * (0.35 + 0.65 * clamp(1.0 - (vP.y - uEye.y) / 40.0, 0.0, 1.0)) * step(0.2, abs(n.x) + abs(n.z)); }",
    // What moves: the cars, their lamps lit at night; the dust devils, half seen.
    "  if (vK == 7) { glow += uNight * base * 0.3 + uNight * vec3(1.0, 0.9, 0.7) * step(0.9, abs(n.x)) * 0.6; }",
    "  col += glow;",
    "  float dist = length(uEye - vP);",
    "  float f = 1.0 - exp(-dist * uFog);",
    "  col = mix(col, uSkyLow, clamp(f, 0.0, 1.0));",
    // The site's pixel: the light in steps, dithered.
    "  float t = bayer(gl_FragCoord.xy) - 0.5;",
    "  col = floor(col * 40.0 + t + 0.5) / 40.0;",
    "  o = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var SKY_VS = "#version 300 es\nin vec2 a; out vec2 vA; void main(){ vA = a; gl_Position = vec4(a, 0.9999, 1.0); }";
  var SKY_FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vA; out vec4 o;",
    "uniform mat4 uInv; uniform vec3 uEye; uniform vec3 uSun; uniform vec3 uSkyTop; uniform vec3 uSkyLow; uniform vec3 uSunCol; uniform float uNight;",
    "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "void main() {",
    "  vec4 p = uInv * vec4(vA, 1.0, 1.0); vec3 r = normalize(p.xyz / p.w - uEye);",
    "  float h = clamp(r.y, -0.1, 1.0);",
    "  vec3 c = mix(uSkyLow, uSkyTop, pow(max(h, 0.0), 0.55));",
    "  float s = dot(r, uSun);",
    "  c += uSunCol * (smoothstep(0.9993, 0.9997, s) * 2.0 + pow(max(s, 0.0), 24.0) * 0.18);",
    "  vec2 g = floor(vec2(atan(r.z, r.x), asin(r.y)) * 260.0);",
    "  c += uNight * step(0.9975, hash(g)) * step(0.05, r.y) * 0.8;",
    "  o = vec4(c, 1.0);",
    "}"
  ].join("\n");

  function compile(gl, vs, fs) {
    var prog = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
      var sh = gl.createShader(s[0]);
      gl.shaderSource(sh, s[1]);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(sh)); }
      gl.attachShader(prog, sh);
    });
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(prog)); }
    return prog;
  }

  /* ---- what the city is made of ------------------------------------------ */

  // The site's materials (models.js), worn by the city's buildings by their age and height.
  function facadeFor(year, storeys, h) {
    var M = (window.Models && window.Models.MATERIALS) || {};
    function c(name, fb) { return (M[name] && M[name].c) || fb; }
    var pick;
    if (storeys >= 22) { pick = h < 0.5 ? c("glass", [120, 140, 150]) : c("concrete", [168, 166, 160]); }
    else if (year && year < 1900) { pick = [c("limestone", [214, 202, 176]), c("stone", [178, 164, 142]), c("brick", [158, 84, 58]), c("render", [236, 231, 222])][Math.floor(h * 4)]; }
    else if (year && year < 1960) { pick = [c("brick", [158, 84, 58]), c("palebrick", [196, 180, 156]), c("stone", [178, 164, 142]), c("render", [236, 231, 222])][Math.floor(h * 4)]; }
    else if (year) { pick = [c("concrete", [168, 166, 160]), c("render", [236, 231, 222]), c("white", [246, 243, 236]), [128, 142, 150]][Math.floor(h * 4)]; }
    else { pick = [c("render", [236, 231, 222]), c("stone", [178, 164, 142]), c("palebrick", [196, 180, 156]), c("concrete", [168, 166, 160])][Math.floor(h * 4)]; }
    var k = 0.86 + 0.14 * h;
    return [pick[0] * k, pick[1] * k, pick[2] * k];
  }
  var GROUND = { "=": [70, 66, 63], ".": [146, 137, 123], "g": [86, 104, 66], "~": [44, 64, 80], "b": [120, 112, 100] };
  // Mars: its dust, its dark basalt, its ice, and the rocks strewn on it.
  var MARS_GROUND = { ".": [178, 104, 66], "d": [196, 128, 84], "p": [72, 52, 44], "i": [226, 230, 232], "b": [118, 70, 50], "=": [160, 94, 60] };

  /* The mesh grows in typed arrays (New York is a third of a million cells). */
  function Mesh() { this.cap = 0; this.v = 0; this.ni = 0; this.grow(65536); }
  Mesh.prototype.grow = function (cap) {
    var p = new Float32Array(cap * 3), n = new Int8Array(cap * 3), c = new Uint8Array(cap * 4), i = new Uint32Array(cap * 1.5);
    if (this.p) { p.set(this.p); n.set(this.n); c.set(this.c); i.set(this.i); }
    this.p = p; this.n = n; this.c = c; this.i = i; this.cap = cap;
  };
  Mesh.prototype.quad = function (a, b, c, d, nrm, col, kind, extra) {
    if (this.v + 4 > this.cap) { this.grow(this.cap * 2); }
    var v = this.v, k = (kind & 15) | ((extra || 0) << 4), q = [a, b, c, d];
    var nx = Math.round(nrm[0] * 127), ny = Math.round(nrm[1] * 127), nz = Math.round(nrm[2] * 127);
    var r = Math.max(0, Math.min(255, Math.round(col[0]))), g = Math.max(0, Math.min(255, Math.round(col[1]))), bl = Math.max(0, Math.min(255, Math.round(col[2])));
    for (var t = 0; t < 4; t += 1) {
      var o3 = (v + t) * 3, o4 = (v + t) * 4;
      this.p[o3] = q[t][0]; this.p[o3 + 1] = q[t][1]; this.p[o3 + 2] = q[t][2];
      this.n[o3] = nx; this.n[o3 + 1] = ny; this.n[o3 + 2] = nz;
      this.c[o4] = r; this.c[o4 + 1] = g; this.c[o4 + 2] = bl; this.c[o4 + 3] = k;
    }
    var ii = this.ni;
    this.i[ii] = v; this.i[ii + 1] = v + 1; this.i[ii + 2] = v + 2; this.i[ii + 3] = v; this.i[ii + 4] = v + 2; this.i[ii + 5] = v + 3;
    this.ni += 6;
    this.v += 4;
  };

  function hash2(i, j) { var x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); }

  /* The city's mesh, in metres: x east, y up, z south, the square's middle at 0. */
  function buildCity(g, models, museums, place, look) {
    look = look || {};
    var GR = look.ground || GROUND;
    var n = g.n, side = g.side, c = side / n, half = side / 2;
    var kind = g.kind.split(""), tall = new Uint16Array(n * n), ground = g.ground;
    for (var q = 0; q < n * n; q += 1) { tall[q] = Math.max(0, g.tall.charCodeAt(q) - 48); }
    var year = new Int16Array(n * n), b = 0;
    for (q = 0; q < n * n; q += 1) { if (kind[q] === "b") { year[q] = g.built ? g.built[b] || 0 : 0; b += 1; } }
    // The ground's heights jump from cell to cell (it is read cell by cell):
    // smoothed once over its neighbours, so the land rolls and the eye, the
    // buildings' feet and the drawn ground all stand on the same surface.
    var raw = function (i, j) {
      i = Math.max(0, Math.min(n - 1, i)); j = Math.max(0, Math.min(n - 1, j));
      return (ground[j * n + i] || 0) / 2;
    };
    var soft = new Float32Array(n * n);
    for (var sj = 0; sj < n; sj += 1) {
      for (var si = 0; si < n; si += 1) {
        var sum = 0;
        for (var dj = -2; dj <= 2; dj += 1) { for (var di = -2; di <= 2; di += 1) { sum += raw(si + di, sj + dj); } }
        soft[sj * n + si] = sum / 25;
      }
    }
    var gh = function (i, j) {
      i = Math.max(0, Math.min(n - 1, i)); j = Math.max(0, Math.min(n - 1, j));
      return soft[j * n + i];
    };
    // The surface at a corner of cells, and at any point: what is drawn.
    var corner = function (i, j) { return (gh(i - 1, j - 1) + gh(i, j - 1) + gh(i - 1, j) + gh(i, j)) / 4; };
    var surface = function (x, z) {
      var fx = (x + half) / c, fz = (z + half) / c, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      return (corner(i, j) * (1 - u) + corner(i + 1, j) * u) * (1 - v) + (corner(i, j + 1) * (1 - u) + corner(i + 1, j + 1) * u) * v;
    };
    var X = function (i) { return i * c - half; }, Z = function (j) { return j * c - half; };
    var cosLat = Math.cos(place.lat * RAD);
    function toLocal(lat, lon) { return { x: (lon - place.lon) * 111320 * cosLat, z: -(lat - place.lat) * 111320 }; }

    // The museums, set in at their points; the cells under them given over to their ground.
    var solid = new Uint8Array(n * n), marks = [], mesh = new Mesh();
    museums.forEach(function (m) {
      var spec = models[m.slug];
      var at = toLocal(+m.lat, +m.lon);
      var ci = Math.floor((at.x + half) / c), cj = Math.floor((at.z + half) / c);
      if (ci < 0 || cj < 0 || ci >= n || cj >= n) { return; }
      var base = surface(at.x, at.z), top = base + 18;
      // A model stands on the lowest ground under it (the land rolls across a palace), never above the street.
      if (spec && spec.site) {
        var hw = spec.site[0] / 2, hd = spec.site[1] / 2;
        for (var sx = -1; sx <= 1; sx += 0.25) { for (var sz = -1; sz <= 1; sz += 0.25) { base = Math.min(base, surface(at.x + sx * hw, at.z + sz * hd)); } }
        base -= 0.2;
      }
      if (spec && spec.parts && window.Models) {
        var vx = null;
        try { vx = window.Models.voxelize(spec); } catch (e) { vx = null; }
        if (vx && vx.nx * vx.ny * vx.nz < 9e6) {
          top = base + meshModel(mesh, vx, at.x, at.z, base);
          // Its footprint: no city building stands in it, and no one walks through it.
          var foot = new Uint8Array(vx.nx * vx.ny), plane = vx.nx * vx.ny, mats = vx.names;
          for (var k = 0; k < vx.grid.length; k += 1) {
            var mm = vx.grid[k];
            if (mm && Math.floor(k / plane) > 1 && !/paving|soil|grass|water|gravel|sand/.test(mats[mm - 1] || "")) { foot[k % plane] = 1; }
          }
          for (var j = 0; j < vx.ny; j += 1) {
            for (var i = 0; i < vx.nx; i += 1) {
              var x = at.x + (i + 0.5) * vx.v - vx.site[0] / 2, z = at.z + (j + 0.5) * vx.v - vx.site[1] / 2;
              var ii = Math.floor((x + half) / c), jj = Math.floor((z + half) / c);
              if (ii < 0 || jj < 0 || ii >= n || jj >= n) { continue; }
              var cell = jj * n + ii;
              if (kind[cell] === "b") { kind[cell] = "."; tall[cell] = 0; }
              if (foot[j * vx.nx + i]) { solid[cell] = Math.max(solid[cell], 1); }
            }
          }
          marks.push({ slug: m.slug, name: m.name, x: at.x, z: at.z, y: top + 6, site: vx.site, foot: foot, vx: vx });
          return;
        }
      }
      marks.push({ slug: m.slug, name: m.name, x: at.x, z: at.z, y: top + 6 });
    });

    // The ground: one quad a cell, its corners shared, so the land rolls.
    for (var j = 0; j < n; j += 1) {
      for (var i = 0; i < n; i += 1) {
        var cell = j * n + i, k = kind[cell];
        var h00 = corner(i, j), h10 = corner(i + 1, j), h01 = corner(i, j + 1), h11 = corner(i + 1, j + 1);
        var col = GR[k] || GR["."], sh = 0.94 + 0.06 * hash2(i, j);
        col = [col[0] * sh, col[1] * sh, col[2] * sh];
        var w = k === "~" ? Math.min(h00, h10, h01, h11) - 0.4 : 0;
        if (k === "~") { h00 = h10 = h01 = h11 = w; }
        mesh.quad([X(i), h00, Z(j)], [X(i), h01, Z(j + 1)], [X(i + 1), h11, Z(j + 1)], [X(i + 1), h10, Z(j)], [0, 1, 0], col,
                  k === "~" ? 3 : 0, k === "=" ? 1 : 0);
        if (k === "g" && look.trees !== false) { trees(mesh, i, j, X(i), Z(j), c, surface); }
      }
    }

    // The buildings: a block a cell, its walls only where its neighbour is lower.
    // A building stands on the highest corner of its cell and is sunk below the lowest.
    var footOf = function (i, j) {
      var a = corner(i, j), b2 = corner(i + 1, j), c2 = corner(i, j + 1), d2 = corner(i + 1, j + 1);
      return { top: Math.max(a, b2, c2, d2), low: Math.min(a, b2, c2, d2) };
    };
    var topOf = function (i, j) {
      if (i < 0 || j < 0 || i >= n || j >= n) { return -1e9; }
      var q2 = j * n + i;
      return kind[q2] === "b" && tall[q2] ? footOf(i, j).top + tall[q2] * STOREY : -1e9;
    };
    for (j = 0; j < n; j += 1) {
      for (i = 0; i < n; i += 1) {
        cell = j * n + i;
        if (kind[cell] !== "b" || !tall[cell]) { continue; }
        if (look.rock) {
          // Mars's boulders: a few rocks of a few metres in the cell, to walk among.
          var nr = 1 + Math.floor(hash2(i, j) * 3);
          for (var rk = 0; rk < nr; rk += 1) {
            var rs = (1.0 + 2.6 * hash2(i + rk * 7, j * 3)) * tall[cell], rx = X(i) + c * (0.15 + 0.7 * hash2(i * 5 + rk, j)), rz = Z(j) + c * (0.15 + 0.7 * hash2(i, j * 7 + rk));
            var ry = surface(rx, rz), sh2 = 0.75 + 0.35 * hash2(i * 3 + rk, j + 1);
            box(mesh, [rx - rs, ry - 0.4, rz - rs * 0.8], [rx + rs, ry + rs * 0.9, rz + rs * 0.8], [look.rock[0] * sh2, look.rock[1] * sh2, look.rock[2] * sh2], 6);
          }
          continue;
        }
        var ft = footOf(i, j), floor = ft.low - 1.5, top = ft.top + tall[cell] * STOREY;
        var hv = hash2(i * 7 + 3, j * 13 + 1);
        var fc = look.rock ? [look.rock[0] * (0.8 + 0.3 * hv), look.rock[1] * (0.8 + 0.3 * hv), look.rock[2] * (0.8 + 0.3 * hv)] : facadeFor(year[cell], tall[cell], hv);
        var rc = [fc[0] * 0.62 + 30, fc[1] * 0.6 + 28, fc[2] * 0.6 + 28];
        var x0 = X(i), x1 = X(i + 1), z0 = Z(j), z1 = Z(j + 1);
        mesh.quad([x0, top, z0], [x0, top, z1], [x1, top, z1], [x1, top, z0], [0, 1, 0], rc, 2);
        [[i, j - 1, [x1, z0], [x0, z0], [0, 0, -1]], [i, j + 1, [x0, z1], [x1, z1], [0, 0, 1]],
         [i - 1, j, [x0, z0], [x0, z1], [-1, 0, 0]], [i + 1, j, [x1, z1], [x1, z0], [1, 0, 0]]].forEach(function (s) {
          var other = Math.max(topOf(s[0], s[1]), floor);
          if (other >= top - 0.01) { return; }
          mesh.quad([s[2][0], other, s[2][1]], [s[3][0], other, s[3][1]], [s[3][0], top, s[3][1]], [s[2][0], top, s[2][1]], s[4], fc, look.rock ? 6 : 1);
        });
        solid[cell] = 1;
      }
    }
    for (q = 0; q < n * n; q += 1) { if (kind[q] === "~") { solid[q] = 2; } }

    var cx = function (i) { return X(i) + c / 2; }, cz = function (j) { return Z(j) + c / 2; };
    // The places worth searching: the museums, and what the city itself makes plain
    // (its tallest building, its largest park, its riverbank), or the world's own.
    var sites = marks.map(function (m) {
      return { key: m.slug, name: m.name, x: m.x, z: m.z, y: m.y, r: m.site ? Math.max(m.site[0], m.site[1]) / 2 + 14 : 36, kind: "museum" };
    });
    if (g.sites) {
      g.sites.forEach(function (st) { sites.push({ key: st.key, name: st.name, x: st.x, z: st.z, y: surface(st.x, st.z) + 10, r: st.r || 30, kind: st.kind || "place" }); });
    } else {
      var tallest = -1, tq = 0, park = -1, pq = 0, bank = -1, bd = 1e9;
      for (j = 2; j < n - 2; j += 2) {
        for (i = 2; i < n - 2; i += 2) {
          q = j * n + i;
          var dmid = Math.hypot(i - n / 2, j - n / 2);
          if (kind[q] === "b" && tall[q] > tq && dmid < n * 0.4) { tq = tall[q]; tallest = q; }
          if (kind[q] === "g") {
            var greens = 0;
            for (var dj2 = -2; dj2 <= 2; dj2 += 1) { for (var di2 = -2; di2 <= 2; di2 += 1) { if (kind[(j + dj2) * n + i + di2] === "g") { greens += 1; } } }
            if (greens - dmid * 0.05 > pq) { pq = greens - dmid * 0.05; park = q; }
          }
          if (kind[q] === "=" && (kind[q + 1] === "~" || kind[q - 1] === "~" || kind[q + n] === "~" || kind[q - n] === "~") && dmid < bd) { bd = dmid; bank = q; }
        }
      }
      var add = function (q2, key, name, r) {
        if (q2 < 0) { return; }
        var x = cx(q2 % n), z = cz(Math.floor(q2 / n));
        sites.push({ key: key, name: name, x: x, z: z, y: surface(x, z) + (key === "tallest" ? tall[q2] * STOREY + 8 : 10), r: r, kind: "place" });
      };
      add(tallest, "tallest", "The tallest building", 34);
      add(park, "park", "The largest park", 40);
      add(bank, "bank", "The riverbank", 30);
      // And more of what the city is, each well apart from the rest: its oldest
      // building, a crossing of four streets, an open square, a bridge.
      var far = function (q3) {
        var x = cx(q3 % n), z = cz(Math.floor(q3 / n));
        return sites.every(function (st) { return Math.hypot(st.x - x, st.z - z) > 320; }) && Math.hypot(x, z) < half * 0.75;
      };
      var oldest = -1, oy = 1e9, cross = -1, square = -1, sqn = 0, bridge = -1;
      for (j = 3; j < n - 3; j += 1) {
        for (i = 3; i < n - 3; i += 1) {
          q = j * n + i;
          if (kind[q] === "b" && year[q] > 1000 && year[q] < oy && far(q)) { oy = year[q]; oldest = q; }
          if (kind[q] === "=" && cross < 0 && kind[q + 1] === "=" && kind[q - 1] === "=" && kind[q + n] === "=" && kind[q - n] === "=" &&
              kind[q + 2] === "=" && kind[q - 2] === "=" && kind[q + 2 * n] === "=" && kind[q - 2 * n] === "=" && hash2(i, j) < 0.02 && far(q)) { cross = q; }
          if (kind[q] === ".") {
            var opn = 0;
            for (var dj3 = -2; dj3 <= 2; dj3 += 1) { for (var di3 = -2; di3 <= 2; di3 += 1) { if (kind[(j + dj3) * n + i + di3] === ".") { opn += 1; } } }
            if (opn > sqn && opn >= 16 && far(q)) { sqn = opn; square = q; }
          }
          if (kind[q] === "=" && bridge < 0 && ((kind[q - n] === "~" && kind[q + n] === "~") || (kind[q - 1] === "~" && kind[q + 1] === "~")) && far(q)) { bridge = q; }
        }
      }
      add(oldest, "oldest", "The oldest building", 30);
      if (cross >= 0 && far(cross)) { add(cross, "crossing", "The great crossing", 28); }
      if (square >= 0 && far(square)) { add(square, "square", "The open square", 36); }
      if (bridge >= 0 && far(bridge)) { add(bridge, "bridge", "The bridge", 26); }
    }

    // Where you came down: under a tree, in a park near the middle (or where the world says).
    var crash = g.crash ? { x: g.crash.x, z: g.crash.z } : null;
    if (!crash) {
      var bestC = -1, bestS = -1e9;
      for (j = 2; j < n - 2; j += 1) {
        for (i = 2; i < n - 2; i += 1) {
          q = j * n + i;
          if (kind[q] !== "g") { continue; }
          var gn = 0;
          for (var a2 = -1; a2 <= 1; a2 += 1) { for (var b3 = -1; b3 <= 1; b3 += 1) { if (kind[(j + a2) * n + i + b3] === "g") { gn += 1; } } }
          var sc = gn * 3 - Math.hypot(i - n / 2, j - n / 2);
          if (gn >= 7 && sc > bestS) { bestS = sc; bestC = q; }
        }
      }
      crash = bestC >= 0 ? { x: cx(bestC % n), z: cz(Math.floor(bestC / n)) } : { x: 0, z: 0 };
    }
    crash.y = surface(crash.x, crash.z);
    // The tree you wake under, and what is left of the craft beside it.
    var tc = look.tree || [70, 96, 56];
    var trunkH = crash.y + 3.4, crownR = 4.6;
    box(mesh, [crash.x - 0.35, crash.y - 0.2, crash.z - 0.35], [crash.x + 0.35, trunkH, crash.z + 0.35], [88, 70, 54], 6);
    box(mesh, [crash.x - crownR, trunkH, crash.z - crownR], [crash.x + crownR, trunkH + 3.2, crash.z + crownR], tc, 6);
    box(mesh, [crash.x - crownR * 0.7, trunkH + 3.2, crash.z - crownR * 0.7], [crash.x + crownR * 0.7, trunkH + 5.2, crash.z + crownR * 0.7], [tc[0] * 1.08, tc[1] * 1.08, tc[2] * 1.08], 6);
    var wx = crash.x + 11, wz = crash.z - 6, wy = surface(wx, wz);
    box(mesh, [wx - 1.6, wy - 0.4, wz - 2.4], [wx + 1.6, wy + 2.2, wz + 2.4], [64, 60, 58], 6);
    box(mesh, [wx - 1.2, wy + 2.2, wz - 1.8], [wx + 1.0, wy + 3.1, wz + 1.2], [52, 49, 47], 6);
    box(mesh, [wx + 1.6, wy - 0.4, wz - 1.6], [wx + 2.1, wy + 2.4, wz + 1.6], [128, 78, 52], 6);
    [[-4, 3, 1.2], [3.5, 4, 0.8], [-2, -5, 1.0], [5, -3, 0.6], [-6, -1, 0.7]].forEach(function (d) {
      var px = wx + d[0], pz = wz + d[1], py = surface(px, pz);
      box(mesh, [px - d[2], py - 0.2, pz - d[2] * 0.6], [px + d[2], py + d[2] * 0.5, pz + d[2] * 0.6], [78, 74, 70], 6);
    });
    crash.wreck = { x: wx, y: wy + 3.2, z: wz };

    // The lanes things move along: the streets that run straight for a while (or the world's own).
    var lanes = g.lanes ? g.lanes.slice() : [];
    if (!g.lanes) {
      for (j = 1; j < n - 1; j += 1) {
        var run = -1;
        for (i = 0; i <= n; i += 1) {
          var on = i < n && kind[j * n + i] === "=";
          if (on && run < 0) { run = i; }
          if (!on && run >= 0) { if (i - run >= 5) { lanes.push({ axis: 0, fixed: j, a: run, b: i }); } run = -1; }
        }
      }
      for (i = 1; i < n - 1; i += 1) {
        run = -1;
        for (j = 0; j <= n; j += 1) {
          on = j < n && kind[j * n + i] === "=";
          if (on && run < 0) { run = j; }
          if (!on && run >= 0) { if (j - run >= 5) { lanes.push({ axis: 1, fixed: i, a: run, b: j }); } run = -1; }
        }
      }
    }
    lanes.forEach(function (L) {
      L.len = (L.b - L.a) * c;
      L.mx = L.axis === 0 ? X(L.a) + L.len / 2 : cx(L.fixed);
      L.mz = L.axis === 0 ? cz(L.fixed) : Z(L.a) + L.len / 2;
    });

    return { mesh: mesh, n: n, c: c, half: half, solid: solid, kind: kind, gh: gh, surface: surface, marks: marks, toLocal: toLocal, place: place,
             sites: sites, crash: crash, lanes: lanes, X: X, Z: Z, cx: cx, cz: cz };
  }

  function trees(mesh, i, j, x, z, c, surface) {
    var count = 1 + Math.floor(hash2(i, j) * 3);
    for (var t = 0; t < count; t += 1) {
      var px = x + c * (0.2 + 0.6 * hash2(i * 3 + t, j)), pz = z + c * (0.2 + 0.6 * hash2(i, j * 5 + t)), h = surface(px, pz) - 0.3;
      var r = 2.6 + 2 * hash2(i + t, j + t), y0 = h + 2.2, y1 = y0 + r * 1.9;
      var g = 0.8 + 0.3 * hash2(i * 9 + t, j * 2), col = [62 * g, 86 * g, 52 * g];
      var trunk = [92, 74, 58];
      mesh.quad([px - 0.25, h, pz], [px + 0.25, h, pz], [px + 0.25, y0, pz], [px - 0.25, y0, pz], [0, 0, 1], trunk, 6);
      mesh.quad([px, h, pz - 0.25], [px, h, pz + 0.25], [px, y0, pz + 0.25], [px, y0, pz - 0.25], [1, 0, 0], trunk, 6);
      // The crown: a block of leaves, as the site draws its trees, in pixels.
      var a = [px - r, y0, pz - r], b2 = [px + r, y1, pz + r];
      box(mesh, a, b2, col, 6);
    }
  }
  function box(mesh, a, b, col, kind) {
    var x0 = a[0], y0 = a[1], z0 = a[2], x1 = b[0], y1 = b[1], z1 = b[2];
    mesh.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], col, kind);
    mesh.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, kind);
    mesh.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, kind);
    mesh.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col, kind);
    mesh.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col, kind);
  }

  /* A museum's model, its outside faces only, in its materials. Returns its height. */
  function meshModel(mesh, vx, ox, oz, base) {
    var M = window.Models.MATERIALS, names = vx.names, g = vx.grid, nx = vx.nx, ny = vx.ny, nz = vx.nz, v = vx.v;
    var cols = names.map(function (nm) { var m = M[nm]; return m ? m.c : [180, 170, 160]; });
    function at(i, j, k) { if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) { return 0; } return g[(k * ny + j) * nx + i]; }
    var top = 0, x0 = ox - vx.site[0] / 2, z0 = oz - vx.site[1] / 2;
    var D = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
    for (var k = 0; k < nz; k += 1) {
      for (var j = 0; j < ny; j += 1) {
        for (var i = 0; i < nx; i += 1) {
          var m = g[(k * ny + j) * nx + i];
          if (!m) { continue; }
          top = Math.max(top, (k + 1) * v);
          var col = cols[m - 1], X0 = x0 + i * v, X1 = X0 + v, Y0 = base + k * v, Y1 = Y0 + v, Z0 = z0 + j * v, Z1 = Z0 + v;
          var sh = 0.95 + 0.05 * hash2(i + k, j - k);
          var cc = [col[0] * sh, col[1] * sh, col[2] * sh];
          // x east, j south, k up in the model; y up here.
          if (!at(i + 1, j, k)) { mesh.quad([X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1], D[0], cc, 6); }
          if (!at(i - 1, j, k)) { mesh.quad([X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], D[1], cc, 6); }
          if (!at(i, j + 1, k)) { mesh.quad([X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], D[2], cc, 6); }
          if (!at(i, j - 1, k)) { mesh.quad([X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0], D[3], cc, 6); }
          if (!at(i, j, k + 1)) { mesh.quad([X0, Y1, Z0], [X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], D[4], cc, 6); }
        }
      }
    }
    return top;
  }

  /* ---- the camera and the walk ------------------------------------------- */

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) { for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) { s += a[k * 4 + j] * b[i * 4 + k]; } o[i * 4 + j] = s; } }
    return o;
  }
  function view(eye, yaw, pitch) {
    // yaw 0 faces north (−z); pitch up positive.
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var f = [sy * cp, sp, -cy * cp];
    var r = [cy, 0, sy];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0,
            -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
  }
  function invert(m) {
    var inv = new Array(16), det;
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
    det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = det ? 1 / det : 0;
    return inv.map(function (x) { return x * det; });
  }

  /* The sun over a place: [east, up, south] for the city's frame, from the
     sun's direction on the Earth (as the site's globe has it). */
  function localSun(sun, lat, lon) {
    var la = lat * RAD, lo = lon * RAD;
    var up = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
    var east = [Math.cos(lo), 0, -Math.sin(lo)];
    var north = [-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)];
    var d = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    return [d(sun, east), d(sun, up), -d(sun, north)];
  }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function smooth(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
  /* The sky for the sun's height: day, the golden hour, dusk, night. */
  function skyFor(elev) {
    var day = smooth(-0.02, 0.35, elev), dusk = smooth(-0.2, 0.0, elev) * (1 - smooth(0.05, 0.3, elev));
    var night = 1 - smooth(-0.22, -0.02, elev);
    var top = mixc(mixc([0.05, 0.05, 0.1], [0.40, 0.55, 0.74], day), [0.32, 0.28, 0.42], dusk * 0.6);
    var low = mixc(mixc([0.09, 0.08, 0.11], [0.86, 0.84, 0.80], day), [0.93, 0.6, 0.38], dusk * 0.8);
    var sun = mixc(mixc([0.05, 0.05, 0.08], [1.0, 0.95, 0.86], day), [1.0, 0.62, 0.36], dusk * 0.7);
    return { top: top, low: low, sun: sun, night: night };
  }

  // The sky of Mars by day: butterscotch overhead, paler at the horizon, the sun small and white.
  function marsSky() { return { top: [0.56, 0.44, 0.34], low: [0.84, 0.68, 0.52], sun: [0.92, 0.86, 0.78], night: 0 }; }

  /* ---- the street, opened -------------------------------------------------- */

  var S = null;

  function open(o) {
    if (S) { close(); }
    var base = o.base || "../v2/", place = o.place;
    var host = o.host;
    var canvas = document.createElement("canvas");
    canvas.className = "street-view";
    canvas.setAttribute("aria-label", place.name + ", at street level. Arrow keys or W A S D walk, drag looks, Shift strides, press a place to walk there, Escape goes back up.");
    canvas.tabIndex = 0;
    var labels = document.createElement("canvas");
    labels.className = "street-names";
    labels.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    host.appendChild(labels);
    var gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) { canvas.remove(); labels.remove(); return Promise.reject(new Error("WebGL 2 is not available")); }
    S = { o: o, canvas: canvas, labels: labels, gl: gl, keys: {}, yaw: o.heading || 0, pitch: 0.02, alive: true };
    var museumsP = window.Worlds.museums || fetch(base + "museums.json").then(function (r) { return r.json(); }).then(function (d) {
      return (window.Worlds.museums = Promise.resolve(d)), d;
    });
    return Promise.all([o.ground ? Promise.resolve(o.ground) : fetch(base + "grounds/" + place.slug + ".json").then(function (r) {
      if (!r.ok) { throw new Error("no ground for " + place.name); }
      return r.json();
    }), o.ground ? Promise.resolve({ museums: [] }) : Promise.resolve(museumsP)]).then(function (got) {
      var g = got[0], all = got[1].museums || [];
      var here = all.filter(function (m) { return (place.museums || []).indexOf(m.slug) >= 0; });
      return Promise.all(here.map(function (m) {
        return fetch(base + "models/" + m.slug + ".json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      })).then(function (specs) {
        var models = {};
        here.forEach(function (m, i) { models[m.slug] = specs[i]; });
        return { g: g, here: here, models: models };
      });
    }).then(function (d) {
      if (!S || !S.alive) { return; }
      var city = S.city = buildCity(d.g, d.models, d.here, place, o.look);
      upload(city.mesh);
      city.mesh = null;
      uploadMover(o.look && o.look.movers === "dust" ? "dust" : "car");
      S.cars = [];
      var cr = city.crash;
      if (o.intro) {
        // Lying beside the trunk, looking up into the branches; the wreck to one side.
        S.x = cr.x + 2.6; S.z = cr.z + 1.4;
        S.wreckYaw = Math.atan2(cr.wreck.x - S.x, -(cr.wreck.z - S.z));
        S.yaw = S.wreckYaw + 1.4;
        S.intro = { t0: performance.now(), lines: o.intro, dur: 11500 };
      } else if (o.atCrash) {
        S.x = cr.x + 1.3; S.z = cr.z + 0.9;
        S.yaw = Math.atan2(cr.wreck.x - S.x, -(cr.wreck.z - S.z)) + 0.6;
      } else {
        // Begin on the street nearest where you came down.
        var at = city.toLocal(o.at ? o.at.lat : place.lat, o.at ? o.at.lon : place.lon);
        var start = nearestStreet(city, at.x, at.z);
        S.x = start.x; S.z = start.z;
        var near = nearestMark(city, S.x, S.z);
        if (near && near.d < 1500) { S.yaw = Math.atan2(near.m.x - S.x, -(near.m.z - S.z)); }
      }
      wire();
      resize();
      S.t = performance.now();
      requestAnimationFrame(frame);
      return { sites: city.sites, crash: { x: cr.x, z: cr.z } };
    });
  }

  function upload(mesh) {
    var gl = S.gl;
    S.prog = compile(gl, VS, FS);
    S.skyProg = compile(gl, SKY_VS, SKY_FS);
    S.vao = gl.createVertexArray();
    gl.bindVertexArray(S.vao);
    function attr(name, data, size, type, normalized) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var l = gl.getAttribLocation(S.prog, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, type, normalized, 0, 0);
    }
    attr("aP", mesh.p.subarray(0, mesh.v * 3), 3, gl.FLOAT, false);
    attr("aN", mesh.n.subarray(0, mesh.v * 3), 3, gl.BYTE, true);
    attr("aC", mesh.c.subarray(0, mesh.v * 4), 4, gl.UNSIGNED_BYTE, true);
    var ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.i.subarray(0, mesh.ni), gl.STATIC_DRAW);
    S.count = mesh.ni;
    S.skyVao = gl.createVertexArray();
    gl.bindVertexArray(S.skyVao);
    var sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var la = gl.getAttribLocation(S.skyProg, "a");
    gl.enableVertexAttribArray(la);
    gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    var u = function (p, names) { var o = {}; names.forEach(function (nm) { o[nm] = gl.getUniformLocation(p, nm); }); return o; };
    S.u = u(S.prog, ["uVP", "uEye", "uSun", "uSunCol", "uSkyTop", "uSkyLow", "uNight", "uFog", "uOff", "uSwap", "uCol"]);
    S.su = u(S.skyProg, ["uInv", "uEye", "uSun", "uSkyTop", "uSkyLow", "uSunCol", "uNight"]);
  }

  /* What moves along the lanes, one mesh drawn again for each: a car, or a dust devil. */
  function uploadMover(what) {
    var gl = S.gl, m = new Mesh();
    if (what === "dust") {
      box(m, [-1.4, 0, -1.4], [1.4, 4, 1.4], [196, 150, 112], 7);
      box(m, [-2.0, 4, -2.0], [2.0, 9, 2.0], [204, 162, 124], 7);
      box(m, [-2.8, 9, -2.8], [2.8, 15, 2.8], [210, 172, 136], 7);
      S.moverSize = [2.8, 2.8];
    } else {
      box(m, [-2.2, 0.25, -0.9], [2.2, 1.0, 0.9], [200, 200, 200], 7);
      box(m, [-1.2, 1.0, -0.8], [1.0, 1.55, 0.8], [200, 200, 200], 7);
      S.moverSize = [2.4, 1.1];
    }
    S.moverVao = gl.createVertexArray();
    gl.bindVertexArray(S.moverVao);
    [["aP", m.p.subarray(0, m.v * 3), 3, gl.FLOAT, false], ["aN", m.n.subarray(0, m.v * 3), 3, gl.BYTE, true], ["aC", m.c.subarray(0, m.v * 4), 4, gl.UNSIGNED_BYTE, true]].forEach(function (a) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, a[1], gl.STATIC_DRAW);
      var l = gl.getAttribLocation(S.prog, a[0]);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, a[2], a[3], a[4], 0, 0);
    });
    var ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.i.subarray(0, m.ni), gl.STATIC_DRAW);
    S.moverCount = m.ni;
    S.moverKind = what;
    gl.bindVertexArray(null);
  }

  var CAR_COLOURS = [[214, 208, 196], [60, 62, 66], [150, 46, 40], [70, 92, 120], [196, 168, 92], [120, 124, 120]];
  /* The traffic near you: the lanes within reach carry it; those far behind drop it. */
  function traffic(dt) {
    var city = S.city, near = [];
    if (!S.lanesAt || performance.now() - S.lanesAt > 900) {
      S.lanesAt = performance.now();
      city.lanes.forEach(function (L, k) {
        var d = L.axis === 0 ? Math.hypot(Math.max(0, Math.abs(S.x - L.mx) - L.len / 2), S.z - L.mz) : Math.hypot(S.x - L.mx, Math.max(0, Math.abs(S.z - L.mz) - L.len / 2));
        if (d < 450) { near.push(k); }
      });
      var keep = {};
      near.slice(0, 90).forEach(function (k) { keep[k] = true; });
      S.cars = S.cars.filter(function (car) { return keep[car.lane]; });
      Object.keys(keep).forEach(function (k) {
        k = +k;
        if (S.cars.some(function (car) { return car.lane === k; })) { return; }
        var L = city.lanes[k], count = Math.min(5, Math.max(1, Math.round(L.len / 90)));
        for (var q = 0; q < count; q += 1) {
          var dust = S.moverKind === "dust";
          S.cars.push({ lane: k, s: Math.random() * L.len, dir: Math.random() < 0.5 ? -1 : 1, v: dust ? 4 + Math.random() * 4 : 8 + Math.random() * 6,
                        col: CAR_COLOURS[Math.floor(Math.random() * CAR_COLOURS.length)] });
        }
      });
    }
    var hit = false, sz = S.moverSize;
    S.cars.forEach(function (car) {
      var L = city.lanes[car.lane];
      car.s += car.dir * car.v * dt;
      if (car.s > L.len) { car.s -= L.len; } else if (car.s < 0) { car.s += L.len; }
      var side = S.moverKind === "dust" ? 0 : car.dir * 2.6;
      if (L.axis === 0) { car.x = city.X(L.a) + car.s; car.z = city.cz(L.fixed) + side; }
      else { car.x = city.cx(L.fixed) - side; car.z = city.Z(L.a) + car.s; }
      car.y = city.surface(car.x, car.z);
      var ax = L.axis === 0 ? sz[0] : sz[1], az = L.axis === 0 ? sz[1] : sz[0];
      if (Math.abs(S.x - car.x) < ax + 0.3 && Math.abs(S.z - car.z) < az + 0.3) { hit = true; }
    });
    return hit;
  }

  function cellOf(city, x, z) {
    var i = Math.floor((x + city.half) / city.c), j = Math.floor((z + city.half) / city.c);
    return { i: i, j: j, in: i >= 0 && j >= 0 && i < city.n && j < city.n };
  }
  function blocked(city, x, z) {
    var r = 0.35;
    return [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]].some(function (p) {
      var c = cellOf(city, p[0], p[1]);
      if (!c.in) { return true; }
      if (city.solid[c.j * city.n + c.i] === 2) { return true; }
      if (city.solid[c.j * city.n + c.i] !== 1) { return false; }
      // A museum's footprint is finer than a cell: ask the model itself.
      for (var k = 0; k < city.marks.length; k += 1) {
        var m = city.marks[k];
        if (!m.foot) { continue; }
        var mi = Math.floor((p[0] - m.x + m.site[0] / 2) / m.vx.v), mj = Math.floor((p[1] - m.z + m.site[1] / 2) / m.vx.v);
        if (mi >= 0 && mj >= 0 && mi < m.vx.nx && mj < m.vx.ny) { return !!m.foot[mj * m.vx.nx + mi]; }
      }
      return city.kind[c.j * city.n + c.i] === "b";
    });
  }
  function nearestStreet(city, x, z) {
    var c = cellOf(city, x, z), n = city.n;
    var ci = Math.max(0, Math.min(n - 1, c.i)), cj = Math.max(0, Math.min(n - 1, c.j));
    for (var r = 0; r < n; r += 1) {
      for (var dj = -r; dj <= r; dj += 1) {
        for (var di = -r; di <= r; di += 1) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) { continue; }
          var i = ci + di, j = cj + dj;
          if (i < 1 || j < 1 || i >= n - 1 || j >= n - 1) { continue; }
          if (city.kind[j * n + i] === "=") {
            var px = (i + 0.5) * city.c - city.half, pz = (j + 0.5) * city.c - city.half;
            if (!blocked(city, px, pz)) { return { x: px, z: pz }; }
          }
        }
      }
    }
    return { x: 0, z: 0 };
  }
  function nearestMark(city, x, z) {
    var best = null;
    city.marks.forEach(function (m) {
      var d = Math.hypot(m.x - x, m.z - z);
      if (!best || d < best.d) { best = { m: m, d: d }; }
    });
    return best;
  }
  function groundAt(city, x, z) { return city.surface(x, z); }

  /* ---- the hand ---------------------------------------------------------- */

  function wire() {
    var cv = S.canvas, drag = null;
    S.onKey = function (e) {
      if (!S) { return; }
      var down = e.type === "keydown";
      if (down && S.intro && performance.now() - S.intro.t0 > 600) { S.intro.t0 -= S.intro.dur; e.preventDefault(); return; }
      if (down && e.key === "Escape") { e.preventDefault(); var out = S.o.onOut; close(); if (out) { out(); } return; }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", "q", "e", "Q", "E", "Shift"].indexOf(e.key) < 0) { return; }
      if (e.target && e.target.tagName === "INPUT") { return; }
      S.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = down;
      if (down) { S.goal = null; e.preventDefault(); }
    };
    document.addEventListener("keydown", S.onKey);
    document.addEventListener("keyup", S.onKey);
    S.onDown = function (e) {
      if (S.intro && performance.now() - S.intro.t0 > 600) { S.intro.t0 -= S.intro.dur; }
      cv.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    };
    S.onMove = function (e) {
      if (!drag) { return; }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) { drag.moved = true; }
      if (drag.moved) {
        var k = FOV / cv.clientHeight;
        S.yaw -= dx * k;
        S.pitch = Math.max(-0.9, Math.min(1.1, S.pitch + dy * k));
      }
      drag.x = e.clientX; drag.y = e.clientY;
    };
    S.onUp = function (e) {
      if (drag && !drag.moved) { walkTo(e.clientX, e.clientY); }
      drag = null;
    };
    cv.addEventListener("pointerdown", S.onDown);
    cv.addEventListener("pointermove", S.onMove);
    cv.addEventListener("pointerup", S.onUp);
    cv.addEventListener("pointercancel", S.onUp);
    S.onResize = resize;
    window.addEventListener("resize", S.onResize);
    cv.focus({ preventScroll: true });
  }

  /* A press: walk to the ground under it (stopping short of a wall). */
  function walkTo(cx, cy) {
    var r = S.canvas.getBoundingClientRect(), city = S.city;
    var nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2;
    var inv = invert(S.vp), p = [nx, ny, 1, 1], w = [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) { w[i] = inv[i] * p[0] + inv[4 + i] * p[1] + inv[8 + i] * p[2] + inv[12 + i] * p[3]; }
    var far = [w[0] / w[3], w[1] / w[3], w[2] / w[3]], eye = S.eye;
    var d = [far[0] - eye[0], far[1] - eye[1], far[2] - eye[2]], L = Math.hypot(d[0], d[1], d[2]);
    d = [d[0] / L, d[1] / L, d[2] / L];
    var last = null;
    for (var t = 1; t < 600; t += 1.5) {
      var x = eye[0] + d[0] * t, y = eye[1] + d[1] * t, z = eye[2] + d[2] * t;
      if (blocked(city, x, z) && y < eye[1] + 80) { break; }
      if (y <= groundAt(city, x, z)) { last = { x: x, z: z }; break; }
      last = { x: x, z: z };
    }
    if (last) { S.goal = last; }
  }

  function step(dt) {
    if (S.intro) { return; }
    var city = S.city, k = S.keys;
    var turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0);
    S.yaw += turn * dt * 1.6;
    var fwd = (k.ArrowUp || k.w ? 1 : 0) - (k.ArrowDown || k.s ? 1 : 0);
    var side = (k.d || k.e ? 1 : 0) - (k.a || k.q ? 1 : 0);
    var pace = k.Shift ? BRISK : PACE;
    var mx = 0, mz = 0;
    if (fwd || side) {
      mx = (Math.sin(S.yaw) * fwd + Math.cos(S.yaw) * side) * pace * dt;
      mz = (-Math.cos(S.yaw) * fwd + Math.sin(S.yaw) * side) * pace * dt;
    } else if (S.goal) {
      var dx = S.goal.x - S.x, dz = S.goal.z - S.z, dist = Math.hypot(dx, dz);
      if (dist < 0.4) { S.goal = null; }
      else {
        var sp = Math.min(dist, (dist > 30 ? BRISK : PACE) * dt);
        mx = dx / dist * sp; mz = dz / dist * sp;
        var want = Math.atan2(dx, -dz), dy = Math.atan2(Math.sin(want - S.yaw), Math.cos(want - S.yaw));
        S.yaw += dy * Math.min(1, dt * 3);
      }
    }
    // Slide along a wall rather than stopping dead at it.
    if (mx && !blocked(city, S.x + mx, S.z)) { S.x += mx; } else if (mx && S.goal) { S.goal = null; }
    if (mz && !blocked(city, S.x, S.z + mz)) { S.z += mz; } else if (mz && S.goal) { S.goal = null; }
  }

  function resize() {
    if (!S) { return; }
    var cv = S.canvas, w = S.o.host.clientWidth, h = S.o.host.clientHeight;
    var pix = S.pix || PIX;
    cv.width = Math.max(1, Math.round(w / pix)); cv.height = Math.max(1, Math.round(h / pix));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    S.labels.width = Math.round(w * dpr); S.labels.height = Math.round(h * dpr);
    S.dpr = dpr;
  }

  var MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
  function frame(now) {
    if (!S || !S.alive) { return; }
    var dt = Math.min(0.05, (now - S.t) / 1000);
    S.t = now;
    var city = S.city, gl = S.gl, cv = S.canvas;
    step(dt);
    var gy = groundAt(city, S.x, S.z), eyeH = EYE, open = 1;
    if (S.intro) {
      var u = (now - S.intro.t0) / 1000, I = S.intro, sm = function (a, b) { var t = Math.max(0, Math.min(1, (u - a) / (b - a))); return t * t * (3 - 2 * t); };
      var short = !!I.short;
      // Coming to: the eyes, the focus, sitting up, turning to the wreck.
      open = short ? sm(0.5, 2.2) : lids(u);
      var pix = Math.round(9 - 7 * (short ? sm(0.5, 2.6) : sm(1.2, 6.5)));
      if (pix !== S.pix) { S.pix = pix; resize(); }
      eyeH = 0.32 + (EYE - 0.32) * (short ? sm(1.6, 3.6) : sm(5.6, 8.6));
      S.pitch = 1.25 + (0.04 - 1.25) * (short ? sm(1.2, 3.6) : sm(4.6, 8.6));
      S.yaw = S.wreckYaw + 1.4 * (1 - (short ? sm(2, 4.4) : sm(6.6, 10.2)));
      document.body.dataset.film = "true";
      if (u * 1000 >= I.dur) { S.intro = null; S.pix = PIX; resize(); S.eyeY = gy + EYE; delete document.body.dataset.film; }
    }
    S.eyeY = S.intro ? gy + eyeH : S.eyeY === undefined ? gy + EYE : S.eyeY + (gy + EYE - S.eyeY) * Math.min(1, dt * 8);
    var eye = S.eye = [S.x, S.eyeY, S.z];
    var proj = perspective(FOV, cv.width / cv.height, 0.3, 4000);
    var vp = S.vp = mul(proj, view(eye, S.yaw, S.pitch));
    var place = city.place, ll = { lat: place.lat - S.z / 111320, lon: place.lon + S.x / (111320 * Math.cos(place.lat * RAD)) };
    var sun;
    if (S.o.fixedSun) { sun = S.o.fixedSun; }
    else { var sl = localSun(S.o.sun ? S.o.sun() : [0, 1, 0], ll.lat, ll.lon); sun = [sl[0], sl[1], sl[2]]; }
    var sky = S.o.look && S.o.look.sky === "mars" ? marsSky() : skyFor(sun[1]);
    var lightDir = sun[1] > 0 ? sun : [sun[0] * 0.3, 0.25, sun[2] * 0.3];
    var ln = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
    lightDir = [lightDir[0] / ln, lightDir[1] / ln, lightDir[2] / ln];
    gl.viewport(0, 0, cv.width, cv.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // The sky first, behind everything.
    gl.useProgram(S.skyProg);
    gl.bindVertexArray(S.skyVao);
    gl.uniformMatrix4fv(S.su.uInv, false, invert(vp));
    gl.uniform3fv(S.su.uSun, sun);
    gl.uniform3fv(S.su.uEye, eye);
    gl.uniform3fv(S.su.uSkyTop, sky.top); gl.uniform3fv(S.su.uSkyLow, sky.low); gl.uniform3fv(S.su.uSunCol, sky.sun);
    gl.uniform1f(S.su.uNight, sky.night);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.useProgram(S.prog);
    gl.bindVertexArray(S.vao);
    gl.uniformMatrix4fv(S.u.uVP, false, vp);
    gl.uniform3fv(S.u.uEye, eye);
    gl.uniform3fv(S.u.uSun, lightDir);
    gl.uniform3fv(S.u.uSunCol, sky.sun.map(function (v) { return v * (sun[1] > 0 ? 1 : 0.18); }));
    gl.uniform3fv(S.u.uSkyTop, sky.top); gl.uniform3fv(S.u.uSkyLow, sky.low);
    gl.uniform1f(S.u.uNight, sky.night);
    gl.uniform1f(S.u.uFog, S.o.look && S.o.look.sky === "mars" ? 0.0011 : 0.00055);
    gl.uniform3f(S.u.uOff, 0, 0, 0); gl.uniform1f(S.u.uSwap, 0); gl.uniform4f(S.u.uCol, 0, 0, 0, 0);
    gl.drawElements(gl.TRIANGLES, S.count, gl.UNSIGNED_INT, 0);
    // The traffic, and being struck by it.
    var struck = traffic(dt) && !S.intro;
    gl.bindVertexArray(S.moverVao);
    S.cars.forEach(function (car) {
      if (Math.hypot(car.x - S.x, car.z - S.z) > 900) { return; }
      gl.uniform3f(S.u.uOff, car.x, car.y, car.z);
      gl.uniform1f(S.u.uSwap, city.lanes[car.lane].axis === 1 ? 1 : 0);
      if (S.moverKind === "dust") { gl.uniform4f(S.u.uCol, 0, 0, 0, 0); } else { gl.uniform4f(S.u.uCol, car.col[0] / 255, car.col[1] / 255, car.col[2] / 255, 1); }
      gl.drawElements(gl.TRIANGLES, S.moverCount, gl.UNSIGNED_INT, 0);
    });
    gl.bindVertexArray(null);
    if (struck) {
      // As Frogger's frog: back to where you began, with what you found still found.
      S.x = city.crash.x + 1.3; S.z = city.crash.z + 0.9; S.goal = null; S.keys = {};
      S.intro = { t0: now, dur: 4800, short: true };
      if (S.o.onHit) { S.o.onHit(); }
    }
    names(vp);
    drawSmoke(vp, now);
    if (S.intro) { drawOpening(now, open); }
    // The sites: arriving at one is searching it.
    if (!S.intro && S.o.onSite) {
      var at2 = null;
      city.sites.forEach(function (st) { if (Math.hypot(st.x - S.x, st.z - S.z) < st.r) { at2 = st; } });
      if (!at2 && Math.hypot(city.crash.x - S.x, city.crash.z - S.z) < 18) { at2 = { key: "crash", name: "Your tree", x: city.crash.x, z: city.crash.z, kind: "crash" }; }
      var k2 = at2 ? at2.key : null;
      if (k2 !== S.atSite) { S.atSite = k2; if (at2) { S.o.onSite(at2); } }
    }
    if (S.o.onWhere && (!S.whereAt || now - S.whereAt > 500)) { S.whereAt = now; S.o.onWhere(ll); }
    var near = nearestMark(city, S.x, S.z);
    var m = near && near.d < 140 ? near.m : null;
    if (S.o.onNear && m !== S.nearShown) { S.nearShown = m; S.o.onNear(m); }
    requestAnimationFrame(frame);
  }

  // How open the eyes are, the first time: shut, a crack, shut, half, shut, open.
  function lids(u) {
    var keys = [[0, 0], [1.4, 0], [2.2, 0.32], [2.7, 0.04], [3.6, 0.58], [4.0, 0.14], [5.6, 1], [99, 1]];
    for (var i = 1; i < keys.length; i += 1) {
      if (u <= keys[i][0]) { var a = keys[i - 1], b = keys[i], t = (u - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t); }
    }
    return 1;
  }

  /* The opening drawn over the view: the eyelids, and its lines, as a film's. */
  function drawOpening(now, open) {
    var c = S.labels.getContext("2d"), dpr = S.dpr, w = S.labels.width / dpr, h = S.labels.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var shut = (1 - open) * h / 2;
    c.fillStyle = "#050302";
    c.fillRect(0, 0, w, shut); c.fillRect(0, h - shut, w, shut);
    var g1 = c.createLinearGradient(0, shut, 0, shut + 60);
    g1.addColorStop(0, "rgba(5,3,2,0.9)"); g1.addColorStop(1, "rgba(5,3,2,0)");
    c.fillStyle = g1; c.fillRect(0, shut, w, 60);
    var g2 = c.createLinearGradient(0, h - shut, 0, h - shut - 60);
    g2.addColorStop(0, "rgba(5,3,2,0.9)"); g2.addColorStop(1, "rgba(5,3,2,0)");
    c.fillStyle = g2; c.fillRect(0, h - shut - 60, w, 60);
    var I = S.intro, u = (now - I.t0) / 1000, lines = I.lines || [];
    if (I.short) { lines = ["You come to again, under your tree."]; }
    var slots = I.short ? [[0.6, 4.2]] : [[0.9, 4.6], [5.0, 8.4], [8.8, 11.4]];
    slots.forEach(function (sl, i) {
      if (!lines[i] || u < sl[0] || u > sl[1]) { return; }
      var a = Math.min(1, (u - sl[0]) / 0.6, (sl[1] - u) / 0.6);
      c.globalAlpha = a;
      c.font = (i === 2 ? "500 13px " + MONO : "italic 400 20px Newsreader, Georgia, serif");
      if ("letterSpacing" in c) { c.letterSpacing = i === 2 ? "0.24em" : "0px"; }
      c.textAlign = "center"; c.textBaseline = "middle";
      c.shadowColor = "rgba(0,0,0,0.9)"; c.shadowBlur = 6;
      c.fillStyle = i === 2 ? "#eadfcd" : "#f3e9d8";
      c.fillText(i === 2 ? lines[i].toUpperCase() : lines[i], w / 2, h * (i === 2 ? 0.5 : 0.74));
      c.shadowColor = "transparent"; c.shadowBlur = 0;
    });
    c.globalAlpha = 1;
  }

  /* The wreck still smoking: puffs rising and spreading, drawn in pixels. */
  function drawSmoke(vp, now) {
    var c = S.labels.getContext("2d"), dpr = S.dpr, w = S.labels.width / dpr, h = S.labels.height / dpr, wr = S.city.crash.wreck;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var k = 0; k < 26; k += 1) {
      var life = ((now / 1000 + k * 0.37) % 9.6) / 9.6;
      var px = wr.x + Math.sin(k * 2.1 + now / 3000) * (0.5 + life * 5), pz = wr.z + Math.cos(k * 1.7) * (0.5 + life * 4), py = wr.y + life * 26;
      var q = [0, 0, 0, 0];
      for (var i = 0; i < 4; i++) { q[i] = vp[i] * px + vp[4 + i] * py + vp[8 + i] * pz + vp[12 + i]; }
      if (q[3] <= 0.5) { continue; }
      var x = (q[0] / q[3] * 0.5 + 0.5) * w, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * h;
      var size = Math.max(2, Math.min(28, (0.8 + life * 4) * h / q[3] * 0.5));
      size = Math.round(size / 2) * 2;
      c.fillStyle = "rgba(70,66,64," + (0.3 * (1 - life)).toFixed(3) + ")";
      c.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }
  }

  /* The museums named over their roofs, in the site's small capitals. */
  function names(vp) {
    var c = S.labels.getContext("2d"), dpr = S.dpr, w = S.labels.width / dpr, h = S.labels.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.font = "500 10.2px " + MONO;
    if ("letterSpacing" in c) { c.letterSpacing = "0.08em"; }
    c.textBaseline = "middle";
    var list = S.city.sites.concat(S.o.onSite ? [{ key: "crash", name: "Your tree", x: S.city.crash.x, y: S.city.crash.y + 11, z: S.city.crash.z }] : []);
    // Nearest first; a farther name that would fall on a nearer one keeps quiet.
    list = list.slice().sort(function (a, b) { return Math.hypot(a.x - S.x, a.z - S.z) - Math.hypot(b.x - S.x, b.z - S.z); });
    var taken = [];
    list.forEach(function (m) {
      var p = [m.x, m.y, m.z, 1], q = [0, 0, 0, 0];
      for (var i = 0; i < 4; i++) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i] * p[3]; }
      if (q[3] <= 0.1) { return; }
      var x = (q[0] / q[3] * 0.5 + 0.5) * w, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * h;
      if (x < -50 || x > w + 50 || y < -20 || y > h + 20) { return; }
      var d = Math.hypot(m.x - S.x, m.z - S.z);
      var box2 = [x - 6, y - 8, x + 12 + m.name.length * 7.4, y + 18];
      if (taken.some(function (t) { return box2[0] < t[2] && box2[2] > t[0] && box2[1] < t[3] && box2[3] > t[1]; })) { return; }
      taken.push(box2);
      c.globalAlpha = Math.max(0.35, Math.min(1, 1 - (d - 400) / 1600));
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fillStyle = "rgba(15,10,7,0.6)"; c.fill();
      c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fillStyle = "#eadfcd"; c.fill();
      c.shadowColor = "rgba(0,0,0,0.85)"; c.shadowBlur = 2; c.shadowOffsetY = 1;
      c.fillStyle = "#eadfcd";
      c.textAlign = "left";
      c.fillText(m.name.toUpperCase(), x + 9, y);
      c.fillStyle = "#a8927a";
      c.font = "500 8.5px " + MONO;
      var tag = S.o.siteTag ? S.o.siteTag(m) : "";
      c.fillText((d < 1000 ? Math.round(d) + " M" : (d / 1000).toFixed(1) + " KM") + (tag ? " · " + tag.toUpperCase() : ""), x + 9, y + 12);
      c.font = "500 10.2px " + MONO;
      c.shadowColor = "transparent";
    });
    c.globalAlpha = 1;
  }

  function close() {
    if (!S) { return; }
    delete document.body.dataset.film;
    S.alive = false;
    document.removeEventListener("keydown", S.onKey);
    document.removeEventListener("keyup", S.onKey);
    window.removeEventListener("resize", S.onResize);
    var lose = S.gl.getExtension("WEBGL_lose_context");
    if (lose) { lose.loseContext(); }
    S.canvas.remove();
    S.labels.remove();
    S = null;
  }

  window.Worlds = window.Worlds || {};
  // debug() hands the walker to a test (it moves nothing by itself).
  window.Worlds.Street = { open: open, close: close, active: function () { return !!S; }, MARS_GROUND: MARS_GROUND, debug: function () { return S; } };
})();

/* pearl.js - Holographic Mr Pearl, the figure you play, built of the unit (no DOM, no GL: rocket.js draws it).

   PearlBody.build(spec, opts) -> { cell, parts, palette, head, joints, walk, ... }
     spec = pearl-body.json, his form as data: the primitives of the form study (metres, z up, facing -y) and every
     relation the build follows. A better form is dropped in by replacing that file; nothing here changes.
     opts.skip = palette ids the game's block shader reads as no block (water, a note), which his cells never take.
   PearlBody.pose(body, phase, amount, act) -> { part: mat4 }: each part's cells -> his own frame (metres, y up, he
     faces -z, the origin the ground under his head), the walk at that phase; column-major as rocket.js's. act
     (optional) is what his arms and upper body do over the walk: { arms, twist, right, fling, spin, lift }, arms and
     twist in radians (the smash); right, 0 to 1, the right arm raised to throw (the sight); fling, in radians, that
     arm turned about the shoulder line after a throw; spin, in radians, and lift, in metres, the whole of him (the
     smash's styles).
   PearlBody.place(m, x, y, z, yaw) -> mat4: his frame -> the world, stood at (x, y, z), facing the yaw.
   PearlBody.phaseStep(body, phase, metres): the walk's phase after walking that far (a stride is two legs).
   PearlBody.HEAD_VS, HEAD_FS: his head's own program, the true sphere solved per pixel.

   The rules (the artist's): his head is "the only perfect Sphere in the game" - it is NOT built here, only
   described, and drawn by HEAD_FS as an exact sphere at any distance; "everything else will receive the
   consequential texture of the base unit" - every other part is cut into cells of the unit at one golden level
   (phi^-7 m, the level of his narrowest part, the glove's finger), each cell one of the game's figures, six bars
   a tenth of a cell thick, in a colour of his palette. */
(function (root) {
  "use strict";
  var PHI = (1 + Math.sqrt(5)) / 2;
  var sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max, floor = Math.floor;

  /* ---- vectors ---------------------------------------------------------------------------------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function len(a) { return sqrt(dot(a, a)); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  // a primitive's local frame: R's columns are the local axes (world = c + R local), so local = R^T (p - c)
  function local(p, c, R) {
    var d = sub(p, c);
    return [R[0][0] * d[0] + R[1][0] * d[1] + R[2][0] * d[2], R[0][1] * d[0] + R[1][1] * d[1] + R[2][1] * d[2],
            R[0][2] * d[0] + R[1][2] * d[1] + R[2][2] * d[2]];
  }

  /* ---- the form's primitive kinds: the SDFs of wf6/pearl gen_glsl.py, line for line ------------------- */
  function sdEllipsoid(q, r) {
    var k0 = len([q[0] / r[0], q[1] / r[1], q[2] / r[2]]), k1 = len([q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2])]);
    return k0 * (k0 - 1) / max(k1, 1e-9);
  }
  function sdCapsule(p, a, b, r) {
    var pa = sub(p, a), ba = sub(b, a), h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1);
    return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - r;
  }
  function sdRoundCone(p, a, b, r1, r2) {
    var ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
    var pa = sub(p, a), y = dot(pa, ba), z = y - l2;
    var xv = [pa[0] * l2 - ba[0] * y, pa[1] * l2 - ba[1] * y, pa[2] * l2 - ba[2] * y];
    var x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) { return sqrt(x2 + z2) * il2 - r2; }
    if (Math.sign(y) * a2 * y2 < k) { return sqrt(x2 + y2) * il2 - r1; }
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  }
  function sdCappedCone(p, a, b, ra, rb) {
    var rba = rb - ra, bav = sub(b, a), pav = sub(p, a), baba = dot(bav, bav), papa = dot(pav, pav), paba = dot(pav, bav) / baba;
    var x = sqrt(max(papa - paba * paba * baba, 0));
    var cax = max(0, x - (paba < 0.5 ? ra : rb)), cay = abs(paba - 0.5) - 0.5;
    var k = rba * rba + baba, f = clamp((rba * (x - ra) + paba * baba) / k, 0, 1);
    var cbx = x - ra - f * rba, cby = paba - f, s = (cbx < 0 && cay < 0) ? -1 : 1;
    return s * sqrt(min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
  }
  function sdRoundBox(q, h, r) {
    var d = [abs(q[0]) - (h[0] - r), abs(q[1]) - (h[1] - r), abs(q[2]) - (h[2] - r)];
    return len([max(d[0], 0), max(d[1], 0), max(d[2], 0)]) + min(max(d[0], max(d[1], d[2])), 0) - r;
  }
  function sdTorusZ(q, R, r) { var a = sqrt(q[0] * q[0] + q[1] * q[1]) - R; return sqrt(a * a + q[2] * q[2]) - r; }
  function sdDome(q, r) { return max(sdEllipsoid(q, r), -q[2]); }
  function sdDish(q, Rs, t, rin, rout) {
    var rad = sqrt(q[0] * q[0] + q[1] * q[1]), ds = abs(len([q[0], q[1], q[2] + Rs]) - Rs) - 0.5 * t;
    return max(max(ds, rad - rout), rin - rad);
  }
  function sdf(pr, p) {
    switch (pr.kind) {
      case "sphere": return len(sub(p, pr.c)) - pr.r;
      case "ellipsoid": return sdEllipsoid(local(p, pr.c, pr.R), pr.radii);
      case "capsule": return sdCapsule(p, pr.a, pr.b, pr.r);
      case "roundcone": return sdRoundCone(p, pr.a, pr.b, pr.ra, pr.rb);
      case "cappedcone": return sdCappedCone(p, pr.a, pr.b, pr.ra, pr.rb);
      case "roundbox": return sdRoundBox(local(p, pr.c, pr.R), pr.half, pr.round);
      case "torus": return sdTorusZ(local(p, pr.c, pr.R), pr.major, pr.minor);
      case "dome": return sdDome(local(p, pr.c, pr.R), pr.radii);
      case "dish": return sdDish(local(p, pr.c, pr.R), pr.Rs, pr.t, pr.r_in, pr.r_out);
    }
    throw new Error("unknown kind " + pr.kind);
  }
  // a part's least thickness (what is thickened to one unit if thinner) and a bounding sphere
  function least(pr) {
    switch (pr.kind) {
      case "sphere": case "capsule": return 2 * pr.r;
      case "roundcone": case "cappedcone": return 2 * min(pr.ra, pr.rb);
      case "ellipsoid": case "dome": return 2 * min.apply(null, pr.radii);
      case "roundbox": return 2 * min.apply(null, pr.half);
      case "torus": return 2 * pr.minor;
      case "dish": return pr.t;
    }
    return 1;
  }
  function bound(pr) {
    var m = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
    switch (pr.kind) {
      case "sphere": return [pr.c, pr.r];
      case "capsule": return [m(pr.a, pr.b), len(sub(pr.a, pr.b)) / 2 + pr.r];
      case "roundcone": case "cappedcone": return [m(pr.a, pr.b), len(sub(pr.a, pr.b)) / 2 + max(pr.ra, pr.rb)];
      case "ellipsoid": case "dome": return [pr.c, max.apply(null, pr.radii)];
      case "roundbox": return [pr.c, len(pr.half)];
      case "torus": return [pr.c, pr.major + pr.minor];
      case "dish": return [pr.c, pr.r_out + pr.t];
    }
  }

  /* ---- the film: pearl.glsl's noise and thin film, for the cloth's tints ------------------------------ */
  function fract(x) { return x - floor(x); }
  function hash(p) {
    var x = fract(p[0] * 0.1031), y = fract(p[1] * 0.1031), z = fract(p[2] * 0.1031);
    var dd = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);   // dot(p3, p3.zyx + 31.32)
    x += dd; y += dd; z += dd;
    return fract((x + y) * z);
  }
  function vnoise(p) {
    var i = [floor(p[0]), floor(p[1]), floor(p[2])], f = [p[0] - i[0], p[1] - i[1], p[2] - i[2]];
    var u = f.map(function (t) { return t * t * t * (t * (t * 6 - 15) + 10); });
    var H = function (a, b, c) { return hash([i[0] + a, i[1] + b, i[2] + c]); };
    var x1 = H(0, 0, 0) + (H(1, 0, 0) - H(0, 0, 0)) * u[0], x2 = H(0, 1, 0) + (H(1, 1, 0) - H(0, 1, 0)) * u[0];
    var x3 = H(0, 0, 1) + (H(1, 0, 1) - H(0, 0, 1)) * u[0], x4 = H(0, 1, 1) + (H(1, 1, 1) - H(0, 1, 1)) * u[0];
    var y1 = x1 + (x2 - x1) * u[1], y2 = x3 + (x4 - x3) * u[1];
    return y1 + (y2 - y1) * u[2];
  }
  function fbm(p) {
    var s = 0, w = 1, tw = 0, x = p.slice();
    for (var o = 0; o < 3; o += 1) {
      s += w * (vnoise(x) - 0.5); tw += w * w;
      x = [x[0] * 2.03 + 17.17, x[1] * 2.03 + 17.17, x[2] * 2.03 + 17.17]; w *= 0.5;
    }
    return s / sqrt(tw) / 0.2;
  }
  function fresnel(ci, n1, n2) {
    var st2 = (n1 / n2) * (n1 / n2) * max(1 - ci * ci, 0);
    if (st2 >= 1) { return 1; }
    var ct = sqrt(1 - st2), rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
    return 0.5 * (rs * rs + rp * rp);
  }
  function sensitivity(opd, shift) {
    var ph = 2 * Math.PI * opd * 1e-9, val = [5.4856e-13, 4.4201e-13, 5.2481e-13], pos = [1.6810e+06, 1.7953e+06, 2.2084e+06];
    var vr = [4.3278e+09, 9.3046e+09, 6.6121e+09], xyz = [0, 1, 2].map(function (k) {
      return val[k] * sqrt(2 * Math.PI * vr[k]) * Math.cos(pos[k] * ph + shift) * Math.exp(-ph * ph * vr[k]);
    });
    xyz[0] += 9.7470e-14 * sqrt(2 * Math.PI * 4.5282e+09) * Math.cos(2.2399e+06 * ph + shift) * Math.exp(-4.5282e+09 * ph * ph);
    xyz = xyz.map(function (v) { return v / 1.0685e-7; });
    var r = 3.2404542 * xyz[0] - 1.5371385 * xyz[1] - 0.4985314 * xyz[2];
    var g = -0.9692660 * xyz[0] + 1.8760108 * xyz[1] + 0.0415560 * xyz[2];
    var b = 0.0556434 * xyz[0] - 0.2040259 * xyz[1] + 1.0572252 * xyz[2];
    return [r / 1.2049, g / 0.9483, b / 0.9088];
  }
  function film(F, cos1, d) {
    var n2 = F.nf, n3 = F.n3, cos2 = sqrt(max(1 - (1 - cos1 * cos1) / (n2 * n2), 0));
    var R12 = fresnel(cos1, 1, n2), R23 = fresnel(cos2, n2, n3), T121 = 1 - R12;
    var phi = Math.PI + (n3 < n2 ? Math.PI : 0), opd = 2 * n2 * d * cos2;
    var R123 = clamp(R12 * R23, 1e-5, 0.9999), r123 = sqrt(R123), Rs = T121 * T121 * R23 / (1 - R123);
    var I = [R12 + Rs, R12 + Rs, R12 + Rs], Cm = Rs - T121;
    Cm *= r123; var s1 = sensitivity(opd, phi);
    I = I.map(function (v, k) { return v + Cm * 2 * s1[k]; });
    Cm *= r123; var s2 = sensitivity(2 * opd, 2 * phi);
    I = I.map(function (v, k) { return max(v + Cm * 2 * s2[k], 0); });
    return I;
  }
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toSrgb(v) { v = clamp(v, 0, 1); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  // the inverse of the normal distribution's cumulative at the K bin middles: z_k = Phi^-1((k + 1/2) / K)
  function erf(x) { var t = 1 / (1 + 0.3275911 * abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
  function cdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function invcdf(p) { var lo = -8, hi = 8; for (var i = 0; i < 60; i += 1) { var m = (lo + hi) / 2; if (cdf(m) < p) { lo = m; } else { hi = m; } } return (lo + hi) / 2; }

  function oklab(c) {
    var l = 0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2], m = 0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2];
    var s = 0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2];
    l = Math.cbrt(l); m = Math.cbrt(m); s = Math.cbrt(s);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function fromOklab(q) {
    var l = q[0] + 0.3963377774 * q[1] + 0.2158037573 * q[2], m = q[0] - 0.1055613458 * q[1] - 0.0638541728 * q[2], s = q[0] - 0.0894841775 * q[1] - 1.2914855480 * q[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }

  /* ---- the palette: one id per plain colour, K ids for each pearl cloth ------------------------------- */
  function palette(spec, opts) {
    var P = spec.palette, F = P.film, K = P.K, pal = [[0, 0, 0, 0]], ids = {}, tints = {}, lean = {}, skip = (opts && opts.skip) || [];
    // ids the game's block shader reads as no block (6 water: open; 26 a note: paper) are left as holes in his palette
    var free = function () { while (skip.indexOf(pal.length) >= 0) { pal.push([0, 0, 0, 0]); } return pal.length; };
    // the film's colour at normal incidence for the K thickness bins, as the head's ambient term has it:
    // the body (base) through the film both ways, plus the world seen in the film
    var base = spec.head.material.base_linear, cols = [];
    for (var k = 0; k < K; k += 1) {
      var z = invcdf((k + 0.5) / K), d = F.d0_nm * (1 + F.sig * z), Rv = film(F, 1, d);
      cols.push([0, 1, 2].map(function (c) { return base[c] * (1 - Rv[c]) * (1 - Rv[c]) * F.ka + Rv[c] * F.env[c]; }));
    }
    var mean = [0, 1, 2].map(function (c) { return cols.reduce(function (s, v) { return s + v[c]; }, 0) / K; });
    // the colour a block of his must have so that, toned as every block is (up 0.75 c + 0.25, east-west c, north-south
    // 0.42 c, the dark between 0.16 c) and closed into its mean as the facades are (FAR_SLANT, FAR_ON averaged over the
    // faces), it shows on screen as the covers show that part (its median); where that asks for more than white, the
    // median's own hue at the game's white
    var W = P.tones, lift = function (m) {
      var c = m.map(function (v) { return (v / 255 - 0.25 * W.wL) / (0.75 * W.wL + W.wM + 0.42 * W.wD + 0.16 * W.wd); });
      var top = Math.max(c[0], c[1], c[2]);
      return (top > 1 ? c.map(function (v) { return v / top; }) : c).map(function (v) { return clamp(v, 0, 1); });
    };
    Object.keys(P.groups).forEach(function (g) {
      var G = P.groups[g], m = lift(hex(G.srgb));
      if (!G.film) { var t0 = m.map(function (v) { return Math.round(v * 255); }); ids[g] = [free()]; pal.push([t0[0], t0[1], t0[2], 0]); return; }
      ids[g] = []; tints[g] = [];
      // the cloth leans as the film leans at each thickness (colour x film colour / its mean), in OKLab ab only (its
      // lightness stays the colour's: the shading is the bars' tones), scaled so the tints' rms ab-distance from the
      // colour is the covers' ab spread over the pearl (P.spread)
      var lin = m.map(function (v) { return toLin(v * 255); }), m0 = oklab(lin);
      var raw = cols.map(function (cc) { return oklab([0, 1, 2].map(function (c) { return lin[c] * cc[c] / mean[c]; })); });
      var rms = Math.sqrt(raw.reduce(function (a, r) { return a + (r[1] - m0[1]) * (r[1] - m0[1]) + (r[2] - m0[2]) * (r[2] - m0[2]); }, 0) / K);
      var sc = P.spread / rms;
      raw.forEach(function (r) {
        var t = fromOklab([m0[0], m0[1] + sc * (r[1] - m0[1]), m0[2] + sc * (r[2] - m0[2])]).map(toSrgb);
        ids[g].push(free()); tints[g].push(t); pal.push([t[0], t[1], t[2], 0]);
      });
      lean[g] = sc;
    });
    if (pal.length > 64) { throw new Error("palette over 64 ids"); }
    return { pal: pal, ids: ids, tints: tints, K: K, lean: lean };
  }

  /* ---- the frames ------------------------------------------------------------------------------------ */
  // form (z up, faces -y, +x his left) -> game (y up, faces -z): (x, y, z) -> (-x, z, y); its own inverse
  function toGame(p) { return [-p[0], p[2], p[1]]; }
  function toForm(g) { return [-g[0], g[2], g[1]]; }

  /* ---- build ----------------------------------------------------------------------------------------- */
  function build(spec, opts) {
    if (!opts) { opts = { skip: [6, 26] }; }   // rocket.js: B.WATER = 6, B.NOTE = 26
    var h = spec.unit.cell_m, prims = spec.form.primitives, PAL = palette(spec, opts);
    var headR = spec.head.radius_m, F = spec.palette.film;
    // which part each primitive belongs to (a name or a prefix ending in _), and which only paint
    var partOf = [], paint = [], paintGroup = [];
    prims.forEach(function (pr, i) {
      spec.parts.forEach(function (pt, j) {
        var hit = function (n) { return n === pr.part || (n.charAt(n.length - 1) === "_" && pr.part.indexOf(n) === 0); };
        if ((pt.paint || []).some(hit)) { paint[i] = j; paintGroup[i] = (pt.paint_group || {})[pr.part] || pr.group; }
        else if (pt.prims.some(hit) && partOf[i] === undefined) { partOf[i] = j; }
      });
    });
    var thick = spec.unit.thicken_m || h, inflate = prims.map(function (pr) { return max(0, (thick - least(pr)) / 2); });
    // the lattice's extent in game cells, from the primitives' bounds
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    prims.forEach(function (pr, i) {
      var b = bound(pr), c = toGame(b[0]), r = b[1] + inflate[i];
      for (var a = 0; a < 3; a += 1) { lo[a] = min(lo[a], c[a] - r); hi[a] = max(hi[a], c[a] + r); }
    });
    var i0 = lo.map(function (v) { return floor(v / h); }), i1 = hi.map(function (v) { return floor(v / h); });
    i0[1] = max(i0[1], 0);   // nothing of him below the ground he stands on
    var cells = [], owner = [];          // [ix, iy, iz, part, group, form point]; owner: [primitive, painted]
    var bs = prims.map(function (pr, i) { var b = bound(pr); return [b[0], b[1] + inflate[i] + h]; });
    for (var iy = i0[1]; iy <= i1[1]; iy += 1) {
      for (var iz = i0[2]; iz <= i1[2]; iz += 1) {
        for (var ix = i0[0]; ix <= i1[0]; ix += 1) {
          var p = toForm([(ix + 0.5) * h, (iy + 0.5) * h, (iz + 0.5) * h]), best = 1e9, own = -1;
          for (var i = 0; i < prims.length; i += 1) {
            if (partOf[i] === undefined || len(sub(p, bs[i][0])) > bs[i][1]) { continue; }
            var d = sdf(prims[i], p) - inflate[i];
            if (d < best) { best = d; own = i; }
          }
          if (best > 0) { continue; }
          var grp = prims[own].group, painted = false;
          for (var q = 0; q < prims.length; q += 1) {
            if (paint[q] === partOf[own] && sdf(prims[q], p) - inflate[q] <= 0) { grp = paintGroup[q]; painted = true; }
          }
          cells.push([ix, iy, iz, partOf[own], grp, p]); owner.push([own, painted]);
        }
      }
    }
    // the rims (the guitar's ribs): a cell of the rim's primitives with the open beside it, across a face whose
    // normal is near square to the body's top (|n . axis| < cos_max), takes the rim's group
    var occ = {}, key = function (x, y, z) { return x + "," + y + "," + z; }, rimCount = 0;
    cells.forEach(function (c) { occ[key(c[0], c[1], c[2])] = 1; });
    spec.parts.forEach(function (pt, j) {
      if (!pt.rim) { return; }
      var ax = prims.filter(function (pr) { return pr.part === pt.rim.axis_of; })[0];
      var n = toGame(sub(ax.b, ax.a)), nl = len(n); n = [n[0] / nl, n[1] / nl, n[2] / nl];
      var dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter(function (d) { return abs(dot(d, n)) < pt.rim.cos_max; });
      cells.forEach(function (c, i) {
        if (c[3] !== j || owner[i][1] || pt.rim.prims.indexOf(prims[owner[i][0]].part) < 0) { return; }
        if (dirs.some(function (d) { return !occ[key(c[0] + d[0], c[1] + d[1], c[2] + d[2])]; })) { c[4] = pt.rim.group; rimCount += 1; }
      });
    });
    // a colour for each cell: plain, or the cloth's tint where the film's thickness noise puts it
    var K = PAL.K, counts = {};
    cells.forEach(function (c) {
      var g = c[4], list = PAL.ids[g] || PAL.ids.jacket;
      if (list.length === 1) { c.push(list[0]); return; }
      var pp = c[5], z = fbm([pp[0] / headR * F.freq + 3.1, pp[1] / headR * F.freq + 7.7, pp[2] / headR * F.freq + 1.3]);
      var k = clamp(floor(cdf(z) * K), 0, K - 1);
      c.push(list[k]);
      counts[g] = counts[g] || []; counts[g][k] = (counts[g][k] || 0) + 1;
    });
    // split into the parts' grids
    var parts = spec.parts.map(function (pt, j) {
      var mine = cells.filter(function (c) { return c[3] === j; });
      if (!mine.length) { return { name: pt.name, empty: true }; }
      var a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9];
      mine.forEach(function (c) { for (var k = 0; k < 3; k += 1) { a[k] = min(a[k], c[k]); b[k] = max(b[k], c[k]); } });
      var dim = [b[0] - a[0] + 1, b[1] - a[1] + 1, b[2] - a[2] + 1], ids = new Uint8Array(dim[0] * dim[1] * dim[2]);
      var blocks = mine.map(function (c) {
        var x = c[0] - a[0], y = c[1] - a[1], z = c[2] - a[2];
        ids[(y * dim[2] + z) * dim[0] + x] = c[6];
        return [x, y, z, c[6]];
      });
      var joint = spec.joints[pt.joint];
      return { name: pt.name, joint: pt.joint, pivot: toGame(joint.at_form), cell0: a, dim: dim,
               org: [a[0] * h, a[1] * h, a[2] * h], ids: ids, blocks: blocks, count: mine.length, note: pt.note };
    });
    var joints = {};
    Object.keys(spec.joints).forEach(function (k) { joints[k] = { at: toGame(spec.joints[k].at_form), parent: spec.joints[k].parent }; });
    var H = spec.head, hc = toGame(H.centre_form), E = H.eyes, off = E.each_off_face_deg * Math.PI / 180;
    var head = { centre: hc, radius: H.radius_m, faceRest: [0, 0, -1],
                 eyes: [[-Math.sin(off), 0, -Math.cos(off)], [Math.sin(off), 0, -Math.cos(off)]],
                 eyeHalf: [E.half_width_R, E.half_height_R], eyeSrgb: E.paint_srgb, base: H.material.base_linear };
    // the hat's farthest point from the head's centre (a camera nearer than this to the head is inside the hat),
    // and how far the hat falls when the head leaves (form study's option B: until the hollow crown meets the neck)
    var hat = parts.filter(function (p) { return p.name === "hat" && !p.empty; })[0], reach = 0;
    if (hat) { hat.blocks.forEach(function (b) { var q = [hat.org[0] + (b[0] + 0.5) * h - hc[0], hat.org[1] + (b[1] + 0.5) * h - hc[1], hat.org[2] + (b[2] + 0.5) * h - hc[2]]; reach = max(reach, len(q) + h * sqrt(3) / 2); }); }
    var HM = spec.holographic_mode || {}, drop = HM.option_B && HM.option_B.hat_drop ? HM.option_B.hat_drop.drop_m : 0;
    // The right arm raised to throw (the sight; the artist, 20 Oct 2026: "And when I click with the reflex sight up, I
    // am able to throw something"): turned about the right shoulder, first about his forward line until the upper arm
    // is level, out to his right (a1), then about the upper arm's own line until the forearm stands as upright as its
    // bend lets it (a2: the elbow is bent 81 deg, so it leans 9 deg out). The palm's centre and the forearm's way are
    // kept for the pearl the glove holds. From the form: the upper arm's ends and the forearm's.
    var Pm = {}, throwArm = null;
    prims.forEach(function (pr) { Pm[pr.part] = pr; });
    if (Pm.upper_arm_right && Pm.forearm_right && Pm.glove_right_palm && joints.shoulder_right) {
      var sh = joints.shoulder_right.at, el = toGame(Pm.upper_arm_right.b), wr = toGame(Pm.forearm_right.b), turn = function (v, ax, a) {
        var m = RA(ax, a); return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]; };
      var u0 = sub(el, sh), a1 = -Math.atan2(u0[1], u0[0]), u1 = turn(u0, [0, 0, 1], a1), f1 = turn(sub(wr, el), [0, 0, 1], a1), ul = len(u1), fo = sub(wr, el), fl = len(fo);
      u1 = [u1[0] / ul, u1[1] / ul, u1[2] / ul];
      // a2 in closed form: the forearm's height after the turn about u1 is A cos a + B sin a + C, with A = f1.y - u1.y (u1 . f1)
      // and B = (u1 x f1).y; highest at atan2(B, A)
      var a2 = Math.atan2(u1[2] * f1[0] - u1[0] * f1[2], f1[1] - u1[1] * dot(u1, f1));
      throwArm = { a1: a1, a2: a2, u0: u0, palm: toGame(Pm.glove_right_palm.c), fore: [fo[0] / fl, fo[1] / fl, fo[2] / fl] };
    }
    return { throwArm: throwArm, hatReach: reach, hatDrop: drop, top: spec.scale.height_to_hat_top_m, cell: h, level: spec.unit.level, parts: parts, palette: PAL.pal, paletteIds: PAL.ids, tints: PAL.tints, lean: PAL.lean,
             head: head, joints: joints, walk: spec.walk, camera: spec.camera, cells: cells.length, rimCells: rimCount, tintCounts: counts };
  }

  /* ---- matrices (column-major, as rocket.js) --------------------------------------------------------- */
  function mmul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) { for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) { s += a[k * 4 + j] * b[i * 4 + k]; } o[i * 4 + j] = s; } }
    return o;
  }
  function T(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function S(s) { return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]; }
  function RX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function RY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  // a turn by a about the axis v (any length), right-handed: RA([1, 0, 0], a) is RX(a)
  function RA(v, a) {
    var l = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]), x = v[0] / l, y = v[1] / l, z = v[2] / l, c = Math.cos(a), s = Math.sin(a), k = 1 - c;
    return [c + x * x * k, y * x * k + z * s, z * x * k - y * s, 0, x * y * k - z * s, c + y * y * k, z * y * k + x * s, 0,
            x * z * k + y * s, y * z * k - x * s, c + z * z * k, 0, 0, 0, 0, 1];
  }
  function about(R, p) { return mmul(T(p[0], p[1], p[2]), mmul(R, T(-p[0], -p[1], -p[2]))); }
  // the inverse of a rigid motion times a uniform scale (what the FS needs as uInvM)
  function inverse(m) {
    var s2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2], R = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
    var o = [R[0] / s2, R[1] / s2, R[2] / s2, 0, R[3] / s2, R[4] / s2, R[5] / s2, 0, R[6] / s2, R[7] / s2, R[8] / s2, 0, 0, 0, 0, 1];
    var t = [m[12], m[13], m[14]];
    o[12] = -(o[0] * t[0] + o[4] * t[1] + o[8] * t[2]); o[13] = -(o[1] * t[0] + o[5] * t[1] + o[9] * t[2]); o[14] = -(o[2] * t[0] + o[6] * t[1] + o[10] * t[2]);
    return o;
  }

  /* ---- the walk -------------------------------------------------------------------------------------- */
  // phase advances by the ground covered: a stride (two steps) is 2 L
  function phaseStep(body, phase, metres) { return phase + 2 * Math.PI * metres / (2 * body.walk.L_m); }
  // amount: 0 standing .. 1 walking (ease it in the game as he starts and stops)
  // act (optional), what his arms and upper body do over the walk, in radians (the artist, 21 Oct 2026: "He should be
  // using his guitar to smash things when using the break function"): act.arms, both arms and the guitar as one about
  // the line through his shoulder centres (his hands hold it; + lifts the front, as RX swings a leg forward);
  // act.twist, the upper body about the spine, the walk's own turn made large (+ to his right): the torso, the arms,
  // the guitar, the hat and the head's centre turn with it, as with the walk's (the head's eyes are drawn on his
  // facing, so they stay on what he faces). act.right, 0 to 1, his right arm raised to throw (the artist, 20 Oct 2026:
  // "And when I click with the reflex sight up, I am able to throw something"; build's throwArm): it lets go of the
  // guitar, which stays with his left glove and his torso; act.fling, that raised arm about the shoulder line after a
  // throw (- brings the forearm down to the fore). With act.arms (a swing let go, coming back) it turns with both arms.
  // act.spin, his whole body about the upright through his head's centre (+ to his right, as twist), and act.lift,
  // his whole body up, in metres: the smash's spin and its slam's leap (the artist, 21 Oct 2026: "Give the animations
  // more style, look at different hand combat styles of fighting").
  function pose(body, phase, amount, act) {
    var W = body.walk, th = W.thigh_swing_deg * Math.PI / 180 * (amount == null ? 1 : amount), J = body.joints;
    var kn = W.knee_bend_deg / W.thigh_swing_deg, tw = W.shoulder_twist_deg / W.thigh_swing_deg;
    var aR = th * Math.sin(phase), aL = th * Math.sin(phase + Math.PI);
    var drop = W.L_m * (1 - Math.cos(aR));                       // the pelvis on a straight swinging leg
    var kR = kn * th * max(0, Math.cos(phase)), kL = kn * th * max(0, Math.cos(phase + Math.PI));
    var bob = T(0, -drop, 0), twist = about(RY(-tw * aR - (act && act.twist || 0)), J.spine.at), arms = null;
    if (act && act.arms) {
      var sR = J.shoulder_right.at, sL = J.shoulder_left.at;
      arms = about(RA([sR[0] - sL[0], sR[1] - sL[1], sR[2] - sL[2]], act.arms), sR);
    }
    // act.right, 0 to 1: the right arm raised to throw (body.throwArm), both its turns taken that far; act.fling, the
    // raised arm about the shoulder line after it (+ lifts the front, as act.arms; the follow-through is -).
    var right = null, TA = body.throwArm;
    if (act && TA && (act.right || act.fling)) {
      var sR2 = J.shoulder_right.at, sL2 = J.shoulder_left.at, k = act.right || 0, R1 = RA([0, 0, 1], TA.a1 * k);
      var u1 = [R1[0] * TA.u0[0] + R1[4] * TA.u0[1] + R1[8] * TA.u0[2], R1[1] * TA.u0[0] + R1[5] * TA.u0[1] + R1[9] * TA.u0[2], R1[2] * TA.u0[0] + R1[6] * TA.u0[1] + R1[10] * TA.u0[2]];
      right = about(mmul(RA(u1, TA.a2 * k), R1), sR2);
      if (act.fling) { right = mmul(about(RA([sR2[0] - sL2[0], sR2[1] - sL2[1], sR2[2] - sL2[2]], act.fling), sR2), right); }
    }
    if (act && (act.spin || act.lift)) { bob = mmul(mmul(T(0, act.lift || 0, 0), RY(-(act.spin || 0))), bob); }
    var M = {};
    var rest = function (p) { return mmul(T(p.org[0], p.org[1], p.org[2]), S(body.cell)); };   // cells -> his frame at rest
    body.parts.forEach(function (p) {
      if (p.empty) { return; }
      var m = rest(p);
      if (p.name === "thigh_right") { m = mmul(about(RX(aR), J.hip_right.at), m); }
      else if (p.name === "shin_right") { m = mmul(about(RX(aR), J.hip_right.at), mmul(about(RX(-kR), J.knee_right.at), m)); }
      else if (p.name === "thigh_left") { m = mmul(about(RX(aL), J.hip_left.at), m); }
      else if (p.name === "shin_left") { m = mmul(about(RX(aL), J.hip_left.at), mmul(about(RX(-kL), J.knee_left.at), m)); }
      else if (right && p.name === "arm_right") { m = mmul(twist, arms ? mmul(arms, mmul(right, m)) : mmul(right, m)); }
      else if (arms && (p.name === "arm_right" || p.name === "arm_left" || p.name === "guitar")) { m = mmul(twist, mmul(arms, m)); }
      else if (p.name !== "pelvis") { m = mmul(twist, m); }
      M[p.name] = mmul(bob, m);
    });
    M.head = mmul(bob, twist);   // the head's frame (apply to body.head.centre); the hat rides it in body mode
    return M;
  }
  // his frame -> the world: stood at (x, y, z), turned to face the yaw (yaw 0 faces -z, as the camera's)
  function place(m, x, y, z, yaw) { return mmul(mmul(T(x, y, z), RY(-yaw)), m); }

  // His head, the one perfect sphere: the box's vertices (gl_VertexID, no buffers), and the pearl solved per pixel.
  var HEAD_VS = "#version 300 es\nuniform mat4 uVP; uniform vec3 uC; uniform float uR;\nout vec3 vW;\nconst int IDX[36] = int[36](0,2,1, 1,2,3, 4,5,6, 5,7,6, 0,1,4, 1,5,4, 2,6,3, 3,6,7, 0,4,2, 2,4,6, 1,3,5, 3,7,5);\nvoid main() { int k = IDX[gl_VertexID]; vec3 c = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1)) * 2.0 - 1.0;\n  vW = uC + c * uR * 1.001; gl_Position = uVP * vec4(vW, 1.0); }";
  var HEAD_FS = [
    "#version 300 es",
    "// =====================================================================================================",
    "//  Holographic Mr Pearl - HIS HEAD, the only perfect sphere in the game (WebGL2 fragment shader)",
    "//  wf10/body, 16 Oct 2026. The material is pearl() of wf6/pearl/pearl.glsl, inlined below unchanged.",
    "//",
    "//  The artist: \"Holographic mode disengages the head of Mr Pearl. His head/Holographic mode will be the only",
    "//  perfect Sphere in the game, everything else will receive the consequential texture of the base unit\".",
    "//  So the head is never built of the unit and never tessellated: a box round it starts a ray per pixel, and the",
    "//  ray is solved against the sphere exactly, so it is round at any distance and any size on the screen, its",
    "//  silhouette and depth exact (gl_FragDepth from the hit). The two eyes are painted on it (vertical black",
    "//  ovals in the plane tangent to the sphere at each eye: half-width 0.080 R, half-height 0.220 R, 29.3 deg",
    "//  apart on the equator, as both covers have them), so the sphere stays whole.",
    "//",
    "//  The vertex shader that goes with it (a box of side 2R round the centre, drawn by gl_VertexID with no buffers,",
    "//  drawn with culling off as the game draws (the back faces then still start rays when the eye is inside the box); the eye inside",
    "//  the SPHERE itself, as in first person, draws nothing: you are the head):",
    "//",
    "//    #version 300 es",
    "//    uniform mat4 uVP; uniform vec3 uC; uniform float uR;",
    "//    out vec3 vW;",
    "//    const int IDX[36] = int[36](0,2,1, 1,2,3, 4,5,6, 5,7,6, 0,1,4, 1,5,4, 2,6,3, 3,6,7, 0,4,2, 2,4,6, 1,3,5, 3,7,5);",
    "//    void main() {",
    "//      int k = IDX[gl_VertexID];",
    "//      vec3 c = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1)) * 2.0 - 1.0;",
    "//      vW = uC + c * uR * 1.001;",
    "//      gl_Position = uVP * vec4(vW, 1.0);",
    "//    }",
    "//",
    "//  drawn with gl.drawArrays(gl.TRIANGLES, 0, 36) after the world (it writes depth, so order does not matter).",
    "//",
    "//  Uniforms",
    "//    uVP    the camera's view-projection (the game's vp)       uEye   the eye (the game's eye)",
    "//    uC     the sphere's centre in the world                   uR     its radius (0.2457 m)",
    "//    uHead  the head's turn: columns = its right, up and back axes in the world (the face looks along -column 2);",
    "//           in body mode the body's yaw, as the hologram the camera's yaw (and pitch, if it is to nod)",
    "//    uSun   the game's sun direction (sunDir)                  uHaze  the game's haze colour",
    "//    uV     the camera's turn: world -> view (the upper 3x3 of the game's view matrix)",
    "//    uRig   1: the covers' rig held to the view (as fitted, the default); 0: the game's sun as the key",
    "//    uExpo  exposure: set so the head's median luminance on screen is the covers' (#b9aca9); see NOTES",
    "//    uHolo  0 on the body, 1 as the hologram (a hook: a rim of the film's own colour brightens with it)",
    "// =====================================================================================================",
    "precision highp float;",
    "in vec3 vW;",
    "out vec4 o;",
    "uniform mat4 uVP;",
    "uniform vec3 uEye, uC, uSun, uHaze;",
    "uniform float uR, uExpo, uHolo, uRig;",
    "uniform mat3 uHead, uV;",
    "",
    "const float PEARL_PI = 3.14159265359;",
    "const float PEARL_D0    = 342.14;",
    "const float PEARL_SIG   = 0.2092;",
    "const float PEARL_NF    = 1.1638;",
    "const float PEARL_N3    = 1.3539;",
    "const float PEARL_TAU   = 1.0;",
    "const float PEARL_KA    = 0.2302;",
    "const float PEARL_KD    = 0.6031;",
    "const float PEARL_WRAP  = 0.0;",
    "const vec3  PEARL_ENV   = vec3(8.1950, 3.0518, 0.3089);",
    "const float PEARL_FACET = 0.5445;",
    "const float PEARL_KS    = 17.243;",
    "const float PEARL_ALPHA = 0.2450;",
    "const float PEARL_FREQ  = 3.0;",
    "const vec3  PEARL_BASE  = vec3(0.3426, 0.4473, 0.5900);",
    "const vec3  PEARL_EYE   = vec3(0.0212, 0.0118, 0.0080);",
    "const vec3  PEARL_SUN   = vec3(1.9409, 1.5527, 1.1646);   // the covers' warm sun: 1.94 x (1, 0.8, 0.6)",
    "const vec3  PEARL_COVER_KEY = vec3(-0.91561, -0.34202, 0.21138);   // view space: from the viewer's left, a little below",
    "const vec3  PEARL_COVER_SUN = vec3( 0.95616,  0.01745, 0.29233);   // view space: from the right, the setting sun",
    "// the eyes (pearl-body.json head.eyes): 14.65 deg either side of the face line, on the equator",
    "const float EYE_OFF = 0.25569;          // 14.65 deg in radians",
    "const float EYE_HW = 0.080, EYE_HH = 0.220;",
    "",
    "float pearlHash(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }",
    "float pearlVNoise(vec3 x) {",
    "    vec3 i = floor(x); vec3 f = x - i;",
    "    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);",
    "    float a = pearlHash(i);                    float b = pearlHash(i + vec3(1, 0, 0));",
    "    float c = pearlHash(i + vec3(0, 1, 0));    float d = pearlHash(i + vec3(1, 1, 0));",
    "    float e = pearlHash(i + vec3(0, 0, 1));    float g = pearlHash(i + vec3(1, 0, 1));",
    "    float k = pearlHash(i + vec3(0, 1, 1));    float m = pearlHash(i + vec3(1, 1, 1));",
    "    float x1 = a + (b - a) * u.x, x2 = c + (d - c) * u.x, x3 = e + (g - e) * u.x, x4 = k + (m - k) * u.x;",
    "    float y1 = x1 + (x2 - x1) * u.y, y2 = x3 + (x4 - x3) * u.y;",
    "    return y1 + (y2 - y1) * u.z;",
    "}",
    "float pearlFbm(vec3 x) {",
    "    float s = 0.0, w = 1.0, tw = 0.0;",
    "    for (int o = 0; o < 3; ++o) { s += w * (pearlVNoise(x) - 0.5); tw += w * w; x = x * 2.03 + 17.17; w *= 0.5; }",
    "    return s / sqrt(tw) / 0.2;",
    "}",
    "vec2 pearlNoise(vec3 p) {",
    "    return vec2(pearlFbm(p * PEARL_FREQ + vec3(3.1, 7.7, 1.3)), pearlFbm(p * PEARL_FREQ + vec3(11.3, 2.9, 5.7)));",
    "}",
    "float pearlFresnel(float ci, float n1, float n2) {",
    "    float st2 = (n1 / n2) * (n1 / n2) * max(1.0 - ci * ci, 0.0);",
    "    if (st2 >= 1.0) return 1.0;",
    "    float ct = sqrt(1.0 - st2);",
    "    float rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);",
    "    float rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);",
    "    return 0.5 * (rs * rs + rp * rp);",
    "}",
    "vec3 pearlSensitivity(float opd, vec3 shift) {",
    "    float phase = 2.0 * PEARL_PI * opd * 1.0e-9;",
    "    vec3 val = vec3(5.4856e-13, 4.4201e-13, 5.2481e-13);",
    "    vec3 pos = vec3(1.6810e+06, 1.7953e+06, 2.2084e+06);",
    "    vec3 var = vec3(4.3278e+09, 9.3046e+09, 6.6121e+09);",
    "    vec3 xyz = val * sqrt(2.0 * PEARL_PI * var) * cos(pos * phase + shift) * exp(-phase * phase * var);",
    "    xyz.x += 9.7470e-14 * sqrt(2.0 * PEARL_PI * 4.5282e+09) * cos(2.2399e+06 * phase + shift.x) * exp(-4.5282e+09 * phase * phase);",
    "    xyz /= 1.0685e-7;",
    "    vec3 rgb = mat3(3.2404542, -0.9692660, 0.0556434, -1.5371385, 1.8760108, -0.2040259, -0.4985314, 0.0415560, 1.0572252) * xyz;",
    "    return rgb / vec3(1.2049, 0.9483, 0.9088);",
    "}",
    "vec3 pearlFilm(float cos1, float d) {",
    "    float n2 = PEARL_NF, n3 = PEARL_N3;",
    "    float cos2 = sqrt(max(1.0 - (1.0 - cos1 * cos1) / (n2 * n2), 0.0));",
    "    float R12 = pearlFresnel(cos1, 1.0, n2);",
    "    float R23 = pearlFresnel(cos2, n2, n3);",
    "    float T121 = 1.0 - R12;",
    "    float phi = PEARL_PI + (n3 < n2 ? PEARL_PI : 0.0);",
    "    float opd = 2.0 * n2 * d * cos2;",
    "    float R123 = clamp(R12 * R23, 1e-5, 0.9999);",
    "    float r123 = sqrt(R123);",
    "    float Rs = T121 * T121 * R23 / (1.0 - R123);",
    "    vec3 I = vec3(R12 + Rs);",
    "    float Cm = Rs - T121;",
    "    Cm *= r123; I += Cm * 2.0 * pearlSensitivity(opd, vec3(phi));",
    "    Cm *= r123; I += Cm * 2.0 * pearlSensitivity(2.0 * opd, vec3(2.0 * phi));",
    "    return max(I, vec3(0.0));",
    "}",
    "float pearlGGX(float NoH, float a) { float a2 = a * a, t = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (PEARL_PI * t * t); }",
    "vec3 pearlDirect(vec3 n, vec3 v, vec3 l, vec3 base, vec3 radiance, vec2 z) {",
    "    float NoV = clamp(dot(n, v), 1e-4, 1.0);",
    "    float NoL = dot(n, l);",
    "    float d = PEARL_D0 * (1.0 + PEARL_SIG * z.x);",
    "    float g = max(1.0 + PEARL_FACET * z.y, 0.0);",
    "    vec3 Rv = pearlFilm(NoV, d);",
    "    vec3 Rl = pearlFilm(clamp(NoL, 0.0, 1.0), d);",
    "    vec3 filt = mix(vec3(1.0), (1.0 - Rv) * (1.0 - Rl), PEARL_TAU);",
    "    float wrap = max((NoL + PEARL_WRAP) / (1.0 + PEARL_WRAP), 0.0);",
    "    vec3 h = normalize(l + v);",
    "    float spec = PEARL_KS * pearlGGX(clamp(dot(n, h), 0.0, 1.0), PEARL_ALPHA) * max(NoL, 0.0) * g;",
    "    return (base * filt * PEARL_KD * wrap + Rv * spec) * radiance;",
    "}",
    "vec3 pearlAmbient(vec3 n, vec3 v, vec3 base, vec2 z) {",
    "    float NoV = clamp(dot(n, v), 1e-4, 1.0);",
    "    float d = PEARL_D0 * (1.0 + PEARL_SIG * z.x);",
    "    float g = max(1.0 + PEARL_FACET * z.y, 0.0);",
    "    vec3 Rv = pearlFilm(NoV, d);",
    "    vec3 amb = base * mix(vec3(1.0), (1.0 - Rv) * (1.0 - Rv), PEARL_TAU) * PEARL_KA;",
    "    return amb + Rv * PEARL_ENV * g;",
    "}",
    "vec3 pearlAt(vec3 n, vec3 v, vec3 l, vec3 base, vec3 p) {",
    "    vec2 z = pearlNoise(p);",
    "    return pearlAmbient(n, v, base, z) + pearlDirect(n, v, l, base, vec3(1.0), z);",
    "}",
    "vec3 pearlEye(vec3 n, vec3 v, vec3 l) {",
    "    float NoV = clamp(dot(n, v), 1e-4, 1.0);",
    "    float F = pearlFresnel(NoV, 1.0, 1.5);",
    "    vec3 h = normalize(l + v);",
    "    float spec = 0.6 * pearlGGX(clamp(dot(n, h), 0.0, 1.0), 0.08) * max(dot(n, l), 0.0);",
    "    return PEARL_EYE + F * (PEARL_ENV * 0.08 + vec3(spec));",
    "}",
    "// an eye painted at e (unit, head frame): the ellipse in the plane tangent at e, x along the horizontal tangent,",
    "// y along the meridian; coverage antialiased over one pixel (fwidth)",
    "float eyeCover(vec3 q, vec3 e) {",
    "    vec3 u = normalize(vec3(0.0, 1.0, 0.0) - e * e.y);",
    "    vec3 s = cross(u, e);",
    "    float x = dot(q, s) / EYE_HW, y = dot(q, u) / EYE_HH;",
    "    float k = sqrt(x * x + y * y), aa = max(fwidth(k), 1e-4);",
    "    return dot(q, e) > 0.0 ? 1.0 - smoothstep(1.0 - aa, 1.0 + aa, k) : 0.0;",
    "}",
    "vec3 srgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }",
    "",
    "void main() {",
    "    vec3 rd = normalize(vW - uEye), oc = uEye - uC;",
    "    float b = dot(oc, rd), c = dot(oc, oc) - uR * uR, h = b * b - c;",
    "    if (h < 0.0) { discard; }                       // the ray misses the sphere: the exact silhouette",
    "    float t = -b - sqrt(h);",
    "    if (t < 0.0) { discard; }                       // the eye is inside the head (first person): nothing to draw",
    "    vec3 p = uEye + t * rd, n = (p - uC) / uR, v = -rd;",
    "    vec3 q = transpose(uHead) * n;                  // the normal in the head's own frame: the pattern rides with it",
    "    // the light: uRig 1 = the covers' rig, which the material was fitted under (a key from the viewer's left and the",
    "    // warm sun from the right, held to the view, so he is lit as on the covers from wherever he is seen); uRig 0 = the",
    "    // game's sun alone as the key (radiance 1)",
    "    vec3 nv = uV * n, vv = uV * v, kv = uV * uSun;",
    "    vec2 z = pearlNoise(q);",
    "    vec3 col = pearlAmbient(n, v, PEARL_BASE, z);",
    "    if (uRig > 0.5) { col += pearlDirect(nv, vv, PEARL_COVER_KEY, PEARL_BASE, vec3(1.0), z) + pearlDirect(nv, vv, PEARL_COVER_SUN, PEARL_BASE, PEARL_SUN, z); }",
    "    else { col += pearlDirect(n, v, uSun, PEARL_BASE, vec3(1.0), z); }",
    "    vec3 lk = uRig > 0.5 ? transpose(uV) * PEARL_COVER_KEY : uSun;",
    "    // the eyes, either side of the face line (the head frame looks along -z)",
    "    vec3 eL = vec3(-sin(EYE_OFF), 0.0, -cos(EYE_OFF)), eR = vec3(sin(EYE_OFF), 0.0, -cos(EYE_OFF));",
    "    float m = max(eyeCover(q, eL), eyeCover(q, eR));",
    "    col = mix(col, pearlEye(n, v, lk), m);",
    "    // the hologram: the film's own colour at the rim, brightening (a hook for the mode's look)",
    "    col += uHolo * pearlFilm(clamp(dot(n, v), 0.0, 1.0), PEARL_D0) * PEARL_ENV * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);",
    "    col *= uExpo;",
    "    vec3 outc = srgb(col / (1.0 + 0.12 * max(max(col.r, col.g), col.b)));   // wf6's soft shoulder for the highlights",
    "    float dist = t;",
    "    outc = mix(outc, uHaze, clamp(1.0 - exp(-dist * 0.006), 0.0, 1.0));   // the world's haze",
    "    vec4 clip = uVP * vec4(p, 1.0);",
    "    gl_FragDepth = clamp(0.5 * clip.z / clip.w + 0.5, 0.0, 1.0);",
    "    o = vec4(outc, 1.0);",
    "}"
  ].join("\n");

  var api = { HEAD_VS: HEAD_VS, HEAD_FS: HEAD_FS, build: build, pose: pose, place: place, phaseStep: phaseStep, inverse: inverse, mul: mmul,
              T: T, S: S, RX: RX, RY: RY, RA: RA, toGame: toGame, toForm: toForm, sdf: sdf, PHI: PHI };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.PearlBody = api; }
})(this);

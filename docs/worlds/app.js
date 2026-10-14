/* Worlds on the page.

   It opens far out, on the solar system as it stands today: the sun, the
   planets where they are on their orbits now, the Earth and Mars drawn as
   themselves. Press the Earth or Mars and you go down to it; the pills at
   the foot, or pulling back far enough, bring you up again.

   The Earth is the Artist Website's own (docs/v2/earth-body.js, lit by the
   real sun); Mars and the other planets are drawn by body.js in the same
   hand; the territories, the wagers and the houses are game.js. */

(function () {
  "use strict";

  var Wd = window.Worlds, Game = Wd.Game, pct = Wd.pct, cap = Wd.cap;
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var SAVE = "worlds-save-v1";
  var MONTH = new Date().getMonth() + 1;
  var CALM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var sky = $("sky"), sctx = sky.getContext("2d");
  var marks = $("marks"), mctx = marks.getContext("2d");
  var bodies = new Wd.Bodies($("bodies"));
  var earthOk = false;

  var worlds = {}, boards = {}, game = null;
  var mode = "system";            // system, world, or fly (on the way between them)
  var here = "earth";
  var sel = null, hover = -1, hoverPlanet = null, stake = 0;
  var W = 0, H = 0, dpr = 1;

  /* ---- the solar system, today ------------------------------------------

     Mean orbits: J2000 longitudes and daily motions (JPL's approximate
     elements). The distances are the planets' own on a root scale, so that
     Neptune and Mercury both fit; the sizes are for the eye, not to scale. */
  var PLANETS = [
    { key: "mercury", name: "Mercury", a: 0.387, L0: 252.25, n: 4.09233445, size: 3.4, look: ["#8d8780", "#6f6a65", "#a59f97"] },
    { key: "venus", name: "Venus", a: 0.723, L0: 181.98, n: 1.60213034, size: 6, look: ["#d8c39b", "#c9ad7f", "#e6d6b6"], bands: 0.3 },
    { key: "earth", name: "Earth", a: 1.0, L0: 100.46, n: 0.98560910, size: 9.5, world: true },
    { key: "mars", name: "Mars", a: 1.524, L0: 355.43, n: 0.52403840, size: 7, world: true },
    { key: "jupiter", name: "Jupiter", a: 5.203, L0: 34.40, n: 0.08308676, size: 15, look: ["#c9a47a", "#e5d2b3", "#9b6d4b", "#d8bc95"], bands: 1 },
    { key: "saturn", name: "Saturn", a: 9.537, L0: 49.94, n: 0.03346063, size: 12.5, look: ["#d9c191", "#c7aa75", "#e8d7b2"], bands: 0.8, ring: true },
    { key: "uranus", name: "Uranus", a: 19.19, L0: 313.23, n: 0.01173129, size: 8.5, look: ["#a8cdd0", "#9cc1c6", "#b8d8da"], bands: 0.2 },
    { key: "neptune", name: "Neptune", a: 30.07, L0: 304.88, n: 0.00598106, size: 8.2, look: ["#5e7fbe", "#4f6ea8", "#7391cb"], bands: 0.35 }
  ];
  var sys = { az: -0.35, elev: 0.5, scale: 1 };
  var AIR = { mars: [0.80, 0.62, 0.46, 0.035], venus: [0.95, 0.88, 0.72, 0.06] };

  function days() { return Date.now() / 86400000 - 10957.5; }
  function narrow() { return W <= 720; }
  function sunAt() { return { x: W / 2, y: H * (narrow() ? 0.4 : 0.5) }; }

  /* A planet as it stands now: where on the screen, how big, which way lit. */
  function planetNow(p) {
    var c = sunAt();
    var outer = Math.min(W * 0.46, H * 0.4 / Math.sin(sys.elev));
    var r = outer * Math.pow(p.a / 30.07, 0.36);
    var L = (p.L0 + p.n * days()) * RAD + sys.az;
    var X = r * Math.cos(L), Y = r * Math.sin(L);
    var se = Math.sin(sys.elev), ce = Math.cos(sys.elev);
    var cam = [X, Y * se, -Y * ce], len = Math.hypot(cam[0], cam[1], cam[2]) || 1;
    var o = { cx: c.x + X, cy: c.y - Y * se, R: p.size * sys.scale, spin: p.spin || 0, tilt: sys.elev, orbit: r };
    o.sun = Wd.toBody(o, [-cam[0] / len, -cam[1] / len, -cam[2] / len]);
    return o;
  }

  /* The look of a planet no one has reached: its own colours, in bands or mottled. */
  function paintPlanet(p) {
    var w = 256, h = 128, c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data;
    var cols = p.look.map(function (hx) { var v = parseInt(hx.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; });
    var seed = p.key.length * 93.01;
    function rnd(i) { var x = Math.sin(i * 12.9898 + seed) * 43758.5453; return x - Math.floor(x); }
    var band = [];
    for (var y = 0; y < h; y++) { band.push(Math.floor(rnd(Math.floor(y / (3 + rnd(y >> 3) * 6))) * cols.length)); }
    for (y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var k = (y * w + x) * 4;
        var i = p.bands ? (rnd(Math.floor(x / 9) + y * 7) < p.bands ? band[y] : band[Math.max(0, y - 1)])
                        : Math.floor(rnd(Math.floor(x / 4) * 131 + Math.floor(y / 4)) * cols.length);
        d[k] = cols[i][0]; d[k + 1] = cols[i][1]; d[k + 2] = cols[i][2]; d[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* ---- the worlds, close to ------------------------------------------------ */

  var views = { earth: { spin: 10 * RAD, tilt: 25 * RAD, zoom: 1 }, mars: { spin: -60 * RAD, tilt: 20 * RAD, zoom: 1 } };
  function worldNow(w) {
    var v = views[w];
    var R = (narrow() ? Math.min(W * 0.44, H * 0.3) : Math.min(W, H) * 0.39) * v.zoom;
    return { cx: W / 2, cy: H * (narrow() ? 0.36 : 0.5), R: R, spin: v.spin, tilt: v.tilt };
  }

  // The real sun over the Earth, as the Artist Website lights it.
  function sunNow(ms) {
    var d = ms / 86400000 - 10957.5;
    var g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    var e = (23.439 - 0.00000036 * d) * RAD;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var gmst = (280.46061837 + 360.98564736629 * d) * RAD;
    var lat = Math.asin(Math.sin(e) * Math.sin(L)), lon = ra - gmst, cl = Math.cos(lat);
    return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)];
  }
  // Mars, close to, is lit from over your left shoulder, as a painting is hung.
  var MARS_LIGHT = norm([-0.5, 0.42, 0.76]);
  function worldSun(w, o) { return w === "earth" ? sunNow(Date.now()) : Wd.toBody(o, MARS_LIGHT); }

  /* ---- the way down and up --------------------------------------------- */

  var fly = null;
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function planet(key) { return PLANETS.filter(function (q) { return q.key === key; })[0]; }

  function descend(w, then) {
    if (mode === "fly") { return; }
    if (mode === "street") { leaveStreet(function () { descend(w, then); }); return; }
    if (mode === "world" && here === w) { if (then) { then(); } return; }
    if (mode === "world") { ascend(function () { descend(w, then); }); return; }
    here = w;
    views[w].zoom = 1;
    var start = planetNow(planet(w));
    views[w].spin = start.spin;          // arrive facing the ground that faced you from far off
    fly = { w: w, up: false, t0: performance.now(), dur: CALM ? 1 : 1500, from: start, then: then };
    mode = "fly";
    sel = null; hover = -1;
    pills(); panel();
  }
  function ascend(then) {
    if (mode !== "world") { if (then && mode === "system") { then(); } return; }
    planet(here).spin = views[here].spin;
    fly = { w: here, up: true, t0: performance.now(), dur: CALM ? 1 : 1200, from: planetNow(planet(here)), then: then };
    mode = "fly";
    sel = null; hover = -1;
    pills(); panel();
  }
  function flyStep(now) {
    var u = Math.min(1, (now - fly.t0) / fly.dur), k = ease(fly.up ? 1 - u : u);
    var a = planetNow(planet(fly.w)), b = worldNow(fly.w);
    if (!fly.up) { a.spin = fly.from.spin; }
    var o = {
      cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k,
      R: Math.exp(Math.log(a.R) + (Math.log(b.R) - Math.log(a.R)) * k),
      spin: a.spin + Math.atan2(Math.sin(b.spin - a.spin), Math.cos(b.spin - a.spin)) * k,
      tilt: a.tilt + (b.tilt - a.tilt) * k
    };
    var sb = worldSun(fly.w, b);
    o.sun = norm([a.sun[0] + (sb[0] - a.sun[0]) * k, a.sun[1] + (sb[1] - a.sun[1]) * k, a.sun[2] + (sb[2] - a.sun[2]) * k]);
    var out = { o: o, k: k };
    if (u >= 1) {
      var f = fly; fly = null;
      mode = f.up ? "system" : "world";
      pills(); panel();
      if (f.then) { f.then(); }
    }
    return out;
  }
  function norm(v) { var n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; }

  /* ---- drawing ------------------------------------------------------------ */

  var stars = [];
  function makeStars() {
    stars = [];
    var n = Math.round(W * H / 5200);
    for (var i = 0; i < n; i++) {
      var r = Math.sin(i * 91.7) * 43758.5; r -= Math.floor(r);
      var s = Math.sin(i * 17.3 + 4) * 23421.6; s -= Math.floor(s);
      var t = Math.sin(i * 3.1 + 9) * 9182.3; t -= Math.floor(t);
      stars.push([r, s, 0.1 + 0.42 * t * t, t > 0.94 ? 1.5 : 1]);
    }
  }

  // k: how far out you are, 1 at the solar system and 0 down at a world.
  function drawSky(k) {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.fillStyle = "#0f0a07";
    sctx.fillRect(0, 0, W, H);
    if (k <= 0.001) { return; }
    sctx.globalAlpha = k;
    stars.forEach(function (s) {
      sctx.fillStyle = "rgba(234,223,205," + s[2] + ")";
      sctx.fillRect(Math.round(s[0] * W), Math.round(s[1] * H), s[3], s[3]);
    });
    var c = sunAt(), se = Math.sin(sys.elev);
    // The orbits, hairlines; the two worlds you can go down to a little brighter.
    PLANETS.forEach(function (p) {
      var o = planetNow(p);
      sctx.beginPath();
      sctx.ellipse(c.x, c.y, o.orbit, o.orbit * se, 0, 0, Math.PI * 2);
      sctx.lineWidth = 1 / dpr;
      sctx.strokeStyle = p.world ? (hoverPlanet === p.key ? "rgba(243,201,139,0.55)" : "rgba(234,223,205,0.26)") : "rgba(234,223,205,0.085)";
      sctx.stroke();
    });
    // The sun: a small hot disc and its light, nothing more.
    var R = 90 * sys.scale, g = sctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
    g.addColorStop(0, "rgba(255,236,200,0.55)");
    g.addColorStop(0.08, "rgba(243,201,139,0.3)");
    g.addColorStop(0.35, "rgba(243,201,139,0.06)");
    g.addColorStop(1, "rgba(243,201,139,0)");
    sctx.fillStyle = g;
    sctx.beginPath(); sctx.arc(c.x, c.y, R, 0, Math.PI * 2); sctx.fill();
    sctx.fillStyle = "#fff4df";
    sctx.beginPath(); sctx.arc(c.x, c.y, 5.5 * sys.scale, 0, Math.PI * 2); sctx.fill();
    sctx.globalAlpha = 1;
  }

  // Saturn's rings in the lean of the orbits: the far half behind the planet, the near half before it.
  function drawRing(ctx, o, k, front) {
    ctx.save();
    ctx.globalAlpha = k * 0.75;
    ctx.translate(o.cx, o.cy);
    var se = Math.sin(sys.elev);
    [[2.25, 0.45], [1.95, 0.7], [1.6, 0.5]].forEach(function (r) {
      ctx.beginPath();
      ctx.ellipse(0, 0, o.R * r[0], o.R * r[0] * se, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.lineWidth = o.R * 0.22;
      ctx.strokeStyle = "rgba(217,193,145," + r[1] + ")";
      ctx.stroke();
    });
    ctx.restore();
  }

  var earthCanvas = null;
  function drawEarth(o) {
    if (!earthOk) { return; }
    var show = !!o;
    o = o || { cx: -100, cy: -100, R: 1, spin: 0, tilt: 0, sun: [0, 0, 1] };
    var c = window.EarthBody.draw({
      W: W, H: H, dpr: dpr, cx: o.cx, cy: o.cy, R: o.R, spin: o.spin, sinT: Math.sin(o.tilt), cosT: Math.cos(o.tilt),
      sun: o.sun, near: 0, high: 0, journey: 0, time: 0, focus: null, cloud: 0, shell: 1, stars: 0, starX: 0, starY: 0,
      light: 1, feel: [0, 0, 0, 0], crisp: 0
    });
    if (c && !earthCanvas) {
      earthCanvas = c;
      c.className = "layer";
      c.setAttribute("aria-hidden", "true");
      stage.insertBefore(c, $("bodies"));
    }
    if (earthCanvas) { earthCanvas.style.visibility = show ? "visible" : "hidden"; }
  }

  var lastPlanets = {};
  function frame(now) {
    if (mode === "street") { requestAnimationFrame(frame); return; }
    var list = [], fronts = [], k = 1, worldO = null;
    if (mode === "fly") {
      var f = flyStep(now);
      worldO = f.o; k = 1 - f.k;
    }
    if (mode === "world") {
      worldO = worldNow(here); worldO.sun = worldSun(here, worldO); k = 0;
    } else if (mode === "system" && !dragging && !CALM) {
      sys.az += 0.00006;
    }
    drawSky(k);

    var earthO = null;
    if (k > 0.001) {
      PLANETS.forEach(function (p) {
        if (!dragging && !CALM) { p.spin = (p.spin || 0) + (p.world ? 0.0016 : 0.003); }
        var o = planetNow(p);
        lastPlanets[p.key] = o;
        if (worldO && p.key === here) { return; }      // the one you are going to is drawn as it travels
        if (p.ring) { drawRing(sctx, o, k, false); fronts.push(o); }
        if (p.key === "earth") { earthO = o; }
        else { list.push({ cx: o.cx, cy: o.cy, R: o.R, spin: o.spin, tilt: o.tilt, sun: o.sun, tex: p.key, air: AIR[p.key], fade: k }); }
        if (p.world) {
          list.push({ cx: o.cx, cy: o.cy, R: o.R, spin: o.spin, tilt: o.tilt, sun: o.sun, land: p.key + "-land", tint: "tint-" + p.key, fade: k, lines: 0 });
        }
      });
    }
    if (worldO) {
      if (here === "earth") { earthO = worldO; }
      else { list.push({ cx: worldO.cx, cy: worldO.cy, R: worldO.R, spin: worldO.spin, tilt: worldO.tilt, sun: worldO.sun, tex: "mars", air: AIR.mars, fade: 1 }); }
      list.push({ cx: worldO.cx, cy: worldO.cy, R: worldO.R, spin: worldO.spin, tilt: worldO.tilt, sun: worldO.sun,
                  land: here + "-land", tint: "tint-" + here,
                  hover: mode === "world" ? hover : -1, sel: mode === "world" && sel && sel.w === here ? sel.id : -1,
                  fade: mode === "world" ? 1 : Math.max(0, 1 - k * 1.6), lines: worldO.R > 150 ? 0.16 : 0.08 });
    }
    drawEarth(earthO);
    bodies.draw(list);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, W, H);
    fronts.forEach(function (o) { drawRing(mctx, o, k, true); });
    drawMarks(k, worldO);
    requestAnimationFrame(frame);
  }

  /* The names: the planets far out; close to, the territories held always,
     the rest when there is room. The site's hand: small capitals, tracked. */
  var MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
  function label(text, x, y, opts) {
    var ctx = mctx, up = text.toUpperCase();
    ctx.font = "500 " + (opts.size || 10.2) + "px " + MONO;
    if ("letterSpacing" in ctx) { ctx.letterSpacing = "0.08em"; }
    ctx.textAlign = opts.align || "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.fillStyle = opts.color || "#eadfcd";
    ctx.fillText(up, x, y);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    return ctx.measureText(up).width;
  }
  function dot(x, y, fill) {
    mctx.beginPath(); mctx.arc(x, y, 4, 0, Math.PI * 2);
    mctx.fillStyle = "rgba(15,10,7,0.6)"; mctx.fill();
    mctx.beginPath(); mctx.arc(x, y, 2.6, 0, Math.PI * 2);
    mctx.fillStyle = fill; mctx.fill();
  }

  function drawMarks(k, worldO) {
    if (!game) { return; }
    if (k > 0.05) {
      mctx.globalAlpha = k;
      // The two worlds named first; a planet whose name would touch theirs keeps quiet until pointed at.
      var boxes = [];
      PLANETS.slice().sort(function (a, b) { return (b.world ? 1 : 0) - (a.world ? 1 : 0); }).forEach(function (p) {
        var o = lastPlanets[p.key];
        if (!o || (worldO && p.key === here)) { return; }
        var hot = hoverPlanet === p.key, gap = o.R * (p.ring ? 2.4 : 1) + 9, y = o.cy;
        mctx.font = "500 10.2px " + MONO;
        var line = p.world && !narrow();   // on a phone the planets' names alone
        var w = Math.max(mctx.measureText(p.name.toUpperCase()).width, line ? mctx.measureText(worldLine(p.key).toUpperCase()).width * 0.85 : 0) * 1.08;
        // A name with no room on the right sits on the left, as on the site.
        var left = o.cx + gap + w > W - 12, x = left ? o.cx - gap : o.cx + gap;
        var box = left ? [x - w, y - (line ? 13 : 7), o.cx + o.R + 4, y + (line ? 13 : 7)]
                       : [o.cx - o.R - 4, y - (line ? 13 : 7), x + w, y + (line ? 13 : 7)];
        var clash = boxes.some(function (q) { return box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]; });
        if (clash && !hot && !p.world) { return; }
        if (clash && p.world) { y += 16; box[1] += 16; box[3] += 16; }
        boxes.push(box);
        var align = left ? "right" : "left";
        label(p.name, x, y - (line ? 6 : 0), { align: align, color: p.world ? (hot ? "#ffffff" : "#eadfcd") : (hot ? "#eadfcd" : "#a8927a") });
        if (line) { label(worldLine(p.key), x, y + 7, { align: align, size: 8.5, color: hot ? "#f3c98b" : "#a8927a" }); }
      });
      mctx.globalAlpha = 1;
    }
    if (!worldO || mode !== "world") { return; }
    var T = boards[here], taken = [], o = worldO, z = views[here].zoom;
    // The cities whose streets can be walked: a small square each, named when near enough.
    if (here === "earth" && z >= CITY_ZOOM) {
      cities.forEach(function (c) {
        var p = Wd.project(o, c.lat * RAD, c.lon * RAD);
        if (p.z < 0.2) { return; }
        c.sx = p.x; c.sy = p.y;
        mctx.globalAlpha = Math.min(1, (p.z - 0.2) / 0.2) * Math.min(1, (z - CITY_ZOOM) / 0.8 + 0.4);
        mctx.fillStyle = "rgba(15,10,7,0.7)"; mctx.fillRect(Math.round(p.x) - 5, Math.round(p.y) - 5, 10, 10);
        mctx.strokeStyle = "#eadfcd"; mctx.lineWidth = 1.5; mctx.strokeRect(Math.round(p.x) - 3.5, Math.round(p.y) - 3.5, 7, 7);
        if (z >= CITY_ZOOM + 1.5 || hoverCity === c) {
          label(c.name, p.x, p.y - 13, { align: "center", size: 9.5, color: hoverCity === c ? "#ffffff" : "#eadfcd" });
          taken.push([p.x - 40, p.y - 20, p.x + 40, p.y + 6]);
        }
        mctx.globalAlpha = 1;
      });
    } else {
      cities.forEach(function (c) { c.sx = c.sy = null; });
    }
    function rank(t) {
      return (sel && sel.w === here && sel.id === t.id ? 4 : 0) + (t.id === hover ? 3 : 0) + (game.owner(here, t.id) >= 0 ? 2 : 0);
    }
    T.slice().sort(function (a, b) { return rank(b) - rank(a) || b.cells - a.cells; }).forEach(function (t) {
      var held = game.owner(here, t.id), hot = t.id === hover || (sel && sel.w === here && sel.id === t.id);
      var room = t.cells * z * z > (here === "mars" ? 1400 : 1800) * (narrow() ? 1.6 : 1);
      if (held < 0 && !hot && !room) { return; }
      var p = Wd.project(o, t.lat * RAD, t.lon * RAD);
      if (p.z < (held >= 0 || hot ? 0.12 : 0.3)) { return; }
      mctx.font = "500 10.2px " + MONO;
      var w = mctx.measureText(t.name.toUpperCase()).width * 1.08 + 14;
      var box = held >= 0 ? [p.x - 6, p.y - 8, p.x + w, p.y + 8] : [p.x - w / 2, p.y - 8, p.x + w / 2, p.y + 8];
      for (var i = 0; i < taken.length && !hot; i++) {
        var q = taken[i];
        if (box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]) { return; }
      }
      taken.push(box);
      mctx.globalAlpha = Math.min(1, (p.z - 0.12) / 0.2);
      if (held >= 0) { dot(p.x, p.y, game.house(held).color); }
      label(t.name, p.x + (held >= 0 ? 9 : 0), p.y, {
        align: held >= 0 ? "left" : "center",
        color: hot ? "#ffffff" : held >= 0 ? "#eadfcd" : "rgba(234,223,205,0.6)"
      });
      mctx.globalAlpha = 1;
    });
  }

  function worldLine(w) {
    var held = game.s.hold[w].filter(function (o) { return o >= 0; }).length, n = boards[w].length;
    if (!held) { return n + (w === "mars" ? " regions" : " countries") + " · unclaimed"; }
    var mine = game.s.hold[w].filter(function (o) { return o === 0; }).length;
    return held + " of " + n + " held" + (mine ? " · " + mine + " yours" : "");
  }

  /* ---- the territories' colours -------------------------------------- */

  function paint() {
    if (!game) { return; }
    ["earth", "mars"].forEach(function (w) {
      var data = new Uint8Array(256 * 4);
      boards[w].forEach(function (t, i) {
        var o = game.owner(w, i);
        if (o < 0) { return; }
        var v = parseInt(game.house(o).color.slice(1), 16);
        data[i * 4] = (v >> 16) & 255; data[i * 4 + 1] = (v >> 8) & 255; data[i * 4 + 2] = v & 255; data[i * 4 + 3] = 255;
      });
      bodies.add("tint-" + w, { w: 256, h: 1, data: data }, true);
    });
  }

  /* ---- the card ----------------------------------------------------------- */

  function select(w, id) {
    sel = id >= 0 ? { w: w, id: id } : null;
    var tr = game.human().treasury;
    if (sel && game.reachFrom(0, w, id)) {
      stake = Math.min(tr, Math.max(1, Math.round(game.s.garrison[w][id])));
    } else if (sel && game.owner(w, id) === 0) {
      stake = Math.max(1, Math.round(tr / 4));
    }
    panel();
  }

  function fact(name, value) { return '<div class="fact"><dt>' + name + '</dt><dd>' + value + '</dd></div>'; }
  function who(h) { return h ? (h.human ? "You" : h.name.replace("House ", "")) : "No one"; }

  function panel() {
    var p = $("card"), s = game.s;
    if (mode === "fly") { p.hidden = true; return; }
    if (s.phase === "choose") {
      p.hidden = false;
      if (mode === "system") {
        p.innerHTML = '<p class="eyebrow">Worlds</p><h2>Every world is taken by a wager.</h2>' +
          '<p class="lede">Choose a country on Earth to begin. Three houses will rise elsewhere. Mars lies under the Earth, unclaimed, and the crossing between them is free.</p>' +
          '<button class="act" id="down">Go down to Earth</button>';
        $("down").onclick = function () { descend("earth"); };
      } else if (here !== "earth") {
        p.innerHTML = '<p class="eyebrow">Begin</p><h2>Begin on Earth.</h2><p class="lede">Your first ground is a country on Earth. Mars is reached from it.</p>' +
          '<button class="act" id="down">Go to Earth</button>';
        $("down").onclick = function () { descend("earth"); };
      } else if (!sel) {
        p.innerHTML = '<p class="eyebrow">Begin</p><h2>Choose your ground.</h2><p class="lede">Press any country to look at it, then raise your banner there.</p>';
      } else {
        var t = game.territory("earth", sel.id);
        p.innerHTML = '<p class="eyebrow">Earth' + (t.region ? ' · ' + esc(t.region) : '') + '</p><h2>' + esc(t.name) + '</h2>' +
          '<dl class="facts">' + fact("Yield", t.yield + " a turn") + fact("Borders", t.near.length) + fact("Beneath", (t.mars || []).length + " on Mars") + '</dl>' +
          '<button class="act" id="begin">Begin in ' + esc(t.name) + '</button>';
        $("begin").onclick = function () { game.begin(sel.w, sel.id); save(); paint(); select(sel.w, sel.id); status(); };
      }
      return;
    }
    if (!sel) {
      var mine = game.holdings(0);
      if (!mine.length) { p.hidden = true; return; }
      p.hidden = false;
      p.innerHTML = '<p class="eyebrow">Your holdings</p><h2>' + mine.length + ' territor' + (mine.length === 1 ? 'y' : 'ies') + '</h2>' +
        '<ul class="list">' + mine.map(function (x) {
          return '<li><button data-go="' + x.w + ':' + x.id + '"><span>' + esc(x.t.name) + '</span><em>' + cap(x.w) + ' · ' + game.s.garrison[x.w][x.id] + '</em></button></li>';
        }).join("") + '</ul><p class="hint">Press a territory that borders yours to wager on it.</p>';
      wireGo(p);
      return;
    }
    var w = sel.w, id = sel.id, t2 = game.territory(w, id), o = game.owner(w, id), house = game.house(o);
    var g = s.garrison[w][id], me = game.human(), from = game.reachFrom(0, w, id);
    var other = w === "earth" ? "mars" : "earth", under = t2[other] || [];
    var html = '<p class="eyebrow">' + cap(w) + (t2.region ? ' · ' + esc(t2.region) : '') + '</p><h2>' + esc(t2.name) + '</h2>' +
      '<dl class="facts">' +
      fact("Held by", (house ? '<i class="sw" style="background:' + house.color + '"></i>' : '') + esc(who(house))) +
      fact("Garrison", g) + fact("Yield", t2.yield + " a turn") + '</dl>';
    var none = me.treasury < 1 ? ' disabled' : '';
    if (o === 0) {
      html += '<label class="stake" for="sr"><span>Fortify</span><output id="sv"></output></label>' +
        '<input id="sr" type="range" min="1" max="' + Math.max(1, me.treasury) + '" value="' + Math.min(stake || 1, Math.max(1, me.treasury)) + '"' + none + '>' +
        '<button class="act" id="act"' + none + '>Fortify</button>';
    } else if (from && s.winner === -1) {
      var ft = game.territory(from.w, from.id);
      html += '<p class="from">From ' + esc(ft.name) + (from.w !== w ? ', <b>crossing from ' + cap(from.w) + '</b>' : '') + '</p>' +
        '<label class="stake" for="sr"><span>Stake</span><output id="sv"></output></label>' +
        '<input id="sr" type="range" min="1" max="' + Math.max(1, me.treasury) + '" value="' + stake + '"' + none + '>' +
        '<div class="odds"><div class="track"><i id="ob"></i></div><span id="ot"></span></div>' +
        '<button class="act" id="act"' + none + '>Wager</button>';
    } else if (s.winner === -1) {
      html += '<p class="hint">None of your ground borders it yet, on this world or the other.</p>';
    }
    if (under.length) {
      var rk = function (j) { return game.owner(other, j) === 0 ? 0 : game.reachFrom(0, other, j) ? 1 : 2; };
      var shown = under.slice().sort(function (a, b) { return rk(a) - rk(b); }).slice(0, 6);
      html += '<p class="eyebrow under">Beneath it, on ' + cap(other) + (under.length > 6 ? ' · 6 of ' + under.length : '') + '</p><ul class="list">' + shown.map(function (j) {
        var u = game.territory(other, j);
        return '<li><button data-go="' + other + ':' + j + '"><span>' + esc(u.name) + '</span><em>' + esc(who(game.house(game.owner(other, j)))) + '</em></button></li>';
      }).join("") + '</ul>';
    }
    html += '<button class="quiet" id="close">Close</button>';
    p.hidden = false;
    p.innerHTML = html;
    var sr = $("sr");
    if (sr) {
      var upd = function () {
        stake = Number(sr.value);
        $("sv").textContent = stake + " marks";
        if ($("ob")) {
          var c = game.odds(stake, w, id);
          $("ob").style.width = (c * 100) + "%";
          $("ot").textContent = pct(c);
        }
      };
      sr.oninput = upd;
      upd();
    }
    var act = $("act");
    if (act) {
      act.onclick = function () {
        if (o === 0) {
          game.fortify(0, w, id, stake);
          toast("Fortified · " + t2.name);
        } else {
          var r = game.wager(0, w, id, stake);
          if (r) { toast((r.won ? "Taken · " : "Lost · ") + t2.name + " at " + pct(r.chance), r.won); }
        }
        stake = Math.min(stake, game.human().treasury);
        save(); paint(); select(w, id); status();
      };
    }
    $("close").onclick = function () { select(here, -1); };
    wireGo(p);
  }

  function wireGo(root) {
    root.querySelectorAll("[data-go]").forEach(function (b) {
      b.onclick = function () {
        var parts = b.dataset.go.split(":"), w = parts[0], id = Number(parts[1]), t = game.territory(w, id);
        var go = function () { face(w, t.lat * RAD, t.lon * RAD); select(w, id); };
        if (mode === "world" && here === w) { go(); } else { descend(w, go); }
      };
    });
  }

  var aim = null;
  function face(w, lat, lon) { aim = { w: w, tilt: Math.max(-1, Math.min(1, lat)), spin: lon }; }

  function status() {
    var s = game.s, me = game.human();
    $("turn").textContent = "Turn " + s.turn;
    $("purse").textContent = me.treasury + " marks";
    $("income").textContent = "+" + game.income(0) + " a turn";
    $("end").hidden = s.phase !== "play" || s.winner !== -1;
    $("houses").innerHTML = s.houses.map(function (h) {
      return '<li class="' + (h.alive ? '' : 'out') + '"><i class="sw" style="background:' + h.color + '"></i><span>' + esc(h.human ? "You" : h.name) +
        '</span><em>' + (h.alive ? game.holdings(h.id).length : 'out') + '</em></li>';
    }).join("");
    $("log").innerHTML = s.log.slice(0, 24).map(function (e) {
      var h = game.house(e.who);
      return '<li><b>' + e.turn + '</b><i class="sw" style="background:' + (h ? h.color : 'transparent') + '"></i><span>' + esc(e.text) + '</span></li>';
    }).join("");
    var banner = $("banner");
    if (s.winner >= 0 || s.winner === -2) {
      banner.hidden = false;
      banner.textContent = s.winner === 0 ? "You hold two fifths of the worlds. They are yours." :
        s.winner === -2 ? "You hold nothing now. The worlds go on without you." : game.house(s.winner).name + " has won the worlds.";
    } else {
      banner.hidden = true;
    }
  }

  function pills() {
    var on = mode === "street" ? "city" : mode === "fly" ? (fly.up ? "system" : fly.w) : mode === "system" ? "system" : here;
    document.querySelectorAll("[data-world]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.world === on));
    });
    var cp = $("pill-city");
    cp.hidden = mode !== "street";
    if (street) { cp.textContent = street.place.name; }
    document.body.dataset.at = mode === "street" ? "street" : mode === "world" ? "world" : "system";
  }

  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify(game.s)); } catch (e) { /* the game lasts as long as the page */ }
  }

  var toastTimer = 0;
  function toast(text, good) {
    var t = $("toast");
    t.textContent = text;
    t.dataset.tone = good === true ? "good" : good === false ? "bad" : "";
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---- the hand ---------------------------------------------------------- */

  var dragging = false, drag = null, pointers = {}, pinch = null, vel = 0, sysTouched = false;

  function cellAt(w, lat, lon) {
    var r = Math.min(359, Math.max(0, Math.floor((90 - lat * DEG) * 2)));
    var c = ((Math.floor((lon * DEG + 180) * 2) % 720) + 720) % 720;
    return worlds[w].ids[r * 720 + c];
  }
  function territoryAt(x, y) {
    if (mode !== "world") { return -1; }
    var ll = Wd.unproject(worldNow(here), x, y);
    return ll ? cellAt(here, ll[0], ll[1]) : -1;
  }
  function planetAt(x, y) {
    var best = null, bd = 1e9;
    PLANETS.forEach(function (p) {
      var o = lastPlanets[p.key];
      if (!o) { return; }
      var d = Math.hypot(x - o.cx, y - o.cy);
      if (d < o.R + 16 && d < bd) { best = p; bd = d; }
    });
    return best;
  }
  function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  stage.addEventListener("pointerdown", function (e) {
    if (e.target !== stage && !e.target.classList.contains("layer")) { return; }
    stage.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2 && mode === "world") {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: views[here].zoom };
      drag = null;
    } else {
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    }
    aim = null; vel = 0;
  });
  stage.addEventListener("pointermove", function (e) {
    if (pointers[e.pointerId]) { pointers[e.pointerId] = { x: e.clientX, y: e.clientY }; }
    if (pinch) {
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        zoomTo(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
      }
      return;
    }
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5) { drag.moved = true; dragging = true; }
      if (dragging && mode === "world") {
        var v = views[here], R = worldNow(here).R;
        v.spin -= dx / R; v.tilt = Math.max(-1.35, Math.min(1.35, v.tilt + dy / R));
        vel = -dx / R;
      } else if (dragging && mode === "system") {
        sysTouched = true;
        sys.az += dx * 0.004;
        sys.elev = Math.max(0.2, Math.min(1.2, sys.elev + dy * 0.003));
      }
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
    var l = local(e);
    hoverAt(l.x, l.y, e.clientX, e.clientY);
  });
  function hoverAt(x, y, cx, cy) {
    if (!game) { return; }
    if (mode === "system") {
      var p = planetAt(x, y);
      hoverPlanet = p ? p.key : null;
      stage.style.cursor = p && p.world ? "pointer" : "grab";
      tip(p ? (p.world ? "Go down to " + p.name : p.name + " · not yet reached") : null, cx, cy);
      return;
    }
    if (mode !== "world") { return; }
    hoverCity = here === "earth" && views.earth.zoom >= CITY_ZOOM ? cityAt(x, y) : null;
    if (hoverCity) { hover = -1; tip("Walk the streets of " + hoverCity.name, cx, cy); stage.style.cursor = "pointer"; return; }
    hover = territoryAt(x, y);
    var t = hover >= 0 ? boards[here][hover] : null, h = t ? game.house(game.owner(here, hover)) : null;
    tip(t ? t.name + (h ? " · " + who(h) : "") : null, cx, cy);
    stage.style.cursor = hover >= 0 ? "pointer" : "grab";
  }
  function tip(text, x, y) {
    var el = $("tip");
    if (!text) { el.hidden = true; return; }
    el.textContent = text;
    el.hidden = false;
    el.style.transform = "translate(" + Math.round(x + 14) + "px," + Math.round(y + 12) + "px)";
  }
  function up(e) {
    delete pointers[e.pointerId];
    if (pinch) { if (Object.keys(pointers).length < 2) { pinch = null; dragging = false; drag = null; } return; }
    if (drag && !drag.moved && game) {
      var l = local(e);
      if (mode === "system") {
        var p = planetAt(l.x, l.y);
        if (p && p.world) { hoverPlanet = null; tip(null); descend(p.key); }
      } else if (mode === "world") {
        var hit = cityAt(l.x, l.y);
        if (hit && views.earth.zoom >= CITY_ZOOM) { enterStreet(hit, null); drag = null; dragging = false; return; }
        var id = territoryAt(l.x, l.y);
        if (game.s.phase === "choose" && here !== "earth") { id = -1; }
        select(here, id);
      }
    }
    drag = null; dragging = false;
  }
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("pointerleave", function () { hover = -1; hoverPlanet = null; tip(null); });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (mode === "street") {
      // Pulling back far enough in the street rises out of it.
      rise = e.deltaY > 0 ? rise + e.deltaY : 0;
      if (rise > 600) { rise = 0; leaveStreet(); }
      return;
    }
    if (mode === "world") { zoomTo(views[here].zoom * Math.exp(-e.deltaY * 0.0015)); }
    else if (mode === "system" && e.deltaY < 0 && hoverPlanet && planet(hoverPlanet).world) { descend(hoverPlanet); }
  }, { passive: false });

  // Pulled back far enough, a world gives way to the solar system.
  var outAt = 0, rise = 0;
  function zoomTo(z) {
    var v = views[here];
    if (z < 0.62) {
      v.zoom = 0.62;
      if (!outAt) { outAt = performance.now(); }
      else if (performance.now() - outAt > 180) { outAt = 0; ascend(); }
      return;
    }
    outAt = 0;
    if (z > 16 && here === "earth" && mode === "world") {
      var c = cityInView();
      if (c) { enterStreet(c.place, c.at); return; }
      if (!deepSaid) { deepSaid = true; toast("Streets are built for " + cities.length + " cities · find their marks"); }
    }
    v.zoom = Math.min(16, z);
  }
  var deepSaid = false;

  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || mode !== "world") { return; }
    var v = views[here], step = 0.14 / v.zoom;
    if (e.key === "ArrowLeft") { v.spin -= step; } else if (e.key === "ArrowRight") { v.spin += step; }
    else if (e.key === "ArrowUp") { v.tilt = Math.min(1.35, v.tilt + step); } else if (e.key === "ArrowDown") { v.tilt = Math.max(-1.35, v.tilt - step); }
    else if (e.key === "+" || e.key === "=") { zoomTo(v.zoom * 1.25); }
    else if (e.key === "-") { if (v.zoom <= 0.66) { ascend(); } else { zoomTo(v.zoom / 1.25); } }
    else if (e.key === "Escape") { if (sel) { select(here, -1); } else { ascend(); } }
    else { return; }
    aim = null;
    e.preventDefault();
  });
  $("zin").onclick = function () { if (mode === "world") { zoomTo(views[here].zoom * 1.4); } };
  $("zout").onclick = function () { if (mode === "world") { if (views[here].zoom <= 0.66) { ascend(); } else { zoomTo(views[here].zoom / 1.4); } } };

  document.querySelectorAll("[data-world]").forEach(function (b) {
    b.onclick = function () {
      var w = b.dataset.world;
      if (w === "city") { return; }
      if (mode === "street") { leaveStreet(function () { if (w === "system") { ascend(); } else if (w !== "earth") { descend(w); } }); return; }
      if (w === "system") { ascend(); } else { descend(w); }
    };
  });
  $("end").onclick = function () {
    game.endTurn();
    save(); paint();
    if (sel) { select(sel.w, sel.id); } else { panel(); }
    status();
    toast("Turn " + game.s.turn + " · paid " + game.income(0));
  };
  // Asked twice, on the button itself: a new game loses this one.
  var armed = 0;
  $("new").onclick = function () {
    var b = $("new");
    if (!armed) {
      b.textContent = "Again, to lose this game";
      b.dataset.armed = "true";
      armed = setTimeout(function () { armed = 0; b.textContent = "New game"; delete b.dataset.armed; }, 4000);
      return;
    }
    clearTimeout(armed); armed = 0;
    b.textContent = "New game"; delete b.dataset.armed;
    try { localStorage.removeItem(SAVE); } catch (e) { /* nothing was kept */ }
    game = new Game(boards, null);
    sel = null;
    paint(); status();
    if (mode === "world") { ascend(); } else { panel(); }
  };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = stage.clientWidth; H = stage.clientHeight;
    [sky, marks].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    bodies.resize();
    sys.scale = Math.max(0.75, Math.min(1.35, Math.min(W, H) / 760));
    // A tall screen looks down on the system from higher, so its width is used.
    if (!sysTouched) { sys.elev = H > W * 1.3 ? 0.95 : 0.5; }
    makeStars();
  }
  window.addEventListener("resize", resize);

  // A world turning toward a place, and the drift after a drag.
  setInterval(function () {
    if (mode !== "world") { return; }
    var v = views[here];
    if (aim && aim.w === here) {
      var ds = Math.atan2(Math.sin(aim.spin - v.spin), Math.cos(aim.spin - v.spin)), dt = aim.tilt - v.tilt;
      v.spin += ds * 0.14; v.tilt += dt * 0.14;
      if (Math.abs(ds) < 0.001 && Math.abs(dt) < 0.001) { aim = null; }
    } else if (!dragging && Math.abs(vel) > 0.0004) {
      v.spin += vel; vel *= 0.92;
    }
  }, 16);

  /* ---- the streets ------------------------------------------------------

     Close enough to the Earth, its cities can be walked: the Artist
     Website's 28 cities, every building at its height and every museum as
     the site models it (street.js). Zooming in past the globe's nearest
     over one of them, or pressing its mark, goes down into its streets;
     Escape, or the Earth's pill, comes up again where you went down. */
  var cities = [], hoverCity = null, street = null, CITY_ZOOM = 3;

  function cityAt(x, y) {
    var best = null, bd = 12;
    cities.forEach(function (c) {
      if (c.sx === null || c.sx === undefined) { return; }
      var d = Math.hypot(x - c.sx, y - c.sy);
      if (d < bd) { best = c; bd = d; }
    });
    return best;
  }
  // The city nearest the middle of the view, if the view is over it.
  function cityInView() {
    var o = worldNow("earth"), mid = Wd.unproject(o, o.cx, o.cy);
    if (!mid) { return null; }
    var best = null;
    cities.forEach(function (c) {
      var p = Wd.project(o, c.lat * RAD, c.lon * RAD);
      if (p.z < 0.2) { return; }
      var d = Math.hypot(p.x - o.cx, p.y - o.cy);
      if (d < Math.min(W, H) * 0.22 && (!best || d < best.d)) { best = { place: c, d: d }; }
    });
    if (!best) { return null; }
    var c = best.place, half = c.side / 2 / 111320;
    var lat = mid[0] * DEG, lon = mid[1] * DEG;
    // Where you looked, if it is inside the city's square; else its middle.
    var inside = Math.abs(lat - c.lat) < half && Math.abs(lon - c.lon) < half / Math.cos(c.lat * RAD);
    return { place: c, at: inside ? { lat: lat, lon: lon } : null };
  }

  function enterStreet(place, at) {
    if (mode !== "world" || street) { return; }
    mode = "street";
    street = { place: place };
    hover = -1; hoverCity = null; tip(null);
    pills();
    $("where-name").textContent = place.name;
    // The ground the city stands on: its country, to wager on from the street.
    var id = cellAt("earth", place.lat * RAD, place.lon * RAD);
    if (id >= 0 && game.s.phase === "play") { select("earth", id); } else { panel(); }
    $("street-help").hidden = false;
    $("going").hidden = false;
    $("going").textContent = "Going down into " + place.name;
    Wd.Street.open({
      host: stage, base: "../v2/", place: place, at: at,
      sun: function () { return sunNow(Date.now()); },
      onOut: function () { leaveStreet(); },
      onNear: function (m) {
        var el = $("near");
        if (!m) { el.hidden = true; return; }
        el.hidden = false;
        el.innerHTML = '<span>' + esc(m.name) + '</span><a href="../v2/" target="_blank" rel="noopener">Its inside, on the Artist Website</a>';
      },
      onWhere: function (ll) {
        $("where-at").textContent = Math.abs(ll.lat).toFixed(4) + "° " + (ll.lat >= 0 ? "N" : "S") + "  " + Math.abs(ll.lon).toFixed(4) + "° " + (ll.lon >= 0 ? "E" : "W");
        street.ll = ll;
      }
    }).then(function () {
      $("going").hidden = true;
    }).catch(function (err) {
      $("going").hidden = true;
      street = null; mode = "world"; pills();
      $("street-help").hidden = true;
      toast("The streets of " + place.name + " could not be opened · " + err.message, false);
    });
  }

  function leaveStreet(then) {
    if (mode !== "street") { if (then) { then(); } return; }
    var ll = street && street.ll ? street.ll : { lat: street.place.lat, lon: street.place.lon };
    Wd.Street.close();
    street = null;
    mode = "world"; here = "earth";
    views.earth.zoom = 9;
    views.earth.spin = ll.lon * RAD; views.earth.tilt = Math.max(-1, Math.min(1, ll.lat * RAD));
    $("where-name").textContent = "Worlds";
    $("where-at").textContent = "";
    $("near").hidden = true;
    $("street-help").hidden = true;
    pills(); panel();
    if (then) { then(); }
  }

  /* ---- begin ------------------------------------------------------------ */

  function image(url) {
    return new Promise(function (done, fail) {
      var img = new Image();
      img.onload = function () { done(img); };
      img.onerror = function () { fail(new Error("could not load " + url)); };
      img.src = url;
    });
  }
  function idsOf(img) {
    var c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    var g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    var px = g.getImageData(0, 0, c.width, c.height).data, ids = new Int32Array(c.width * c.height);
    for (var i = 0; i < ids.length; i++) { ids[i] = px[i * 4] + 256 * px[i * 4 + 1] - 1; }
    return ids;
  }

  resize();
  if (bodies.failed) {
    $("loading").textContent = "Worlds needs WebGL 2, which this browser does not offer.";
    return;
  }
  if (window.EarthBody) { window.EarthBody.base = "../v2/"; }
  Promise.all([
    image("earth/land.png"), image("mars/land.png"), image("mars/body.png"),
    fetch("earth/territories.json").then(function (r) { return r.json(); }),
    fetch("mars/territories.json").then(function (r) { return r.json(); }),
    window.EarthBody ? window.EarthBody.start(MONTH) : Promise.resolve(false),
    fetch("../v2/cityplaces.json").then(function (r) { return r.json(); }).catch(function () { return { places: [] }; })
  ]).then(function (all) {
    cities = (all[6].places || []).filter(function (c) { return c.slug && c.n; });
    worlds.earth = { ids: idsOf(all[0]) }; worlds.mars = { ids: idsOf(all[1]) };
    boards.earth = all[3].territories; boards.mars = all[4].territories;
    earthOk = !!all[5];
    bodies.add("earth-land", all[0], true);
    bodies.add("mars-land", all[1], true);
    bodies.add("mars", all[2]);
    PLANETS.forEach(function (p) { if (p.look) { bodies.add(p.key, paintPlanet(p)); } });
    var saved = null;
    try { var v = localStorage.getItem(SAVE); saved = v ? JSON.parse(v) : null; } catch (e) { saved = null; }
    game = new Game(boards, saved && saved.hold && saved.hold.earth.length === boards.earth.length ? saved : null);
    $("loading").remove();
    paint(); status(); pills(); panel();
    requestAnimationFrame(frame);
    // A link to a city (worlds/#paris-fr) goes straight down into its streets.
    var key = decodeURIComponent((location.hash || "").slice(1));
    var c = cities.filter(function (q) { return q.key === key; })[0];
    if (c) { descend("earth", function () { enterStreet(c, null); }); }
  }).catch(function (err) {
    $("loading").textContent = "The worlds could not be loaded: " + err.message;
  });
})();

/* The characters — who comes out of the wave in a city.

   The artist, 1 Oct 2026: "When I click on the screen when viewing a city
   there's a cool wave of purple or blue pixels that echo from the places I
   touched. It's moments like that which we can tie character generation
   into the website through DIRT along with corresponding plants and
   artists … Nothing too much, start with one character."

   So: now and then, out of that wave, one character steps from the middle
   of the ring and trots off along the ground and out of view, and round the
   ring the plants of that city's own biome and realm rise in DIRT dots,
   crowns seen from above in their stratum's shape, and after a while sink
   back. The first is a red fox, drawn after Cy Twombly (characters/
   characters.json says why): its dots are the soil where it stands worked
   into his inks, and behind it it leaves a line of his writing — a looping
   pen leaning right, two lines in two inks, lifting between phrases — that
   fades. Pressed, it stops and looks at you, is boxed in red as he boxed
   his plates, and a quiet line says what it is: "Red fox · after Cy
   Twombly · among hazel, European beech and ancient oaks · Temperate
   Broadleaf & Mixed Forests". Nothing links anywhere.

   Sparingly (the artist, 23 Sep 2026: "go a little bit easier … it still
   gimmicky"): one at a time, never two; at most once a visit to a city, the
   first wave there; and after one has gone, none for φ⁸–φ⁹ s anywhere.
   land.js says when a wave is fired in a city and nothing is being read
   (`Characters.wave`); everything else is here. Under reduced motion no
   one comes.

   Data: characters/characters.json (the cast), characters/<id>.json (its
   poses, a letter a cell), characters/plants.json (each city's biome,
   realm, soil and plants), all written by scripts/build_characters.py. */

(function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var BASE = "characters/";
  var FPS = 8;                         // the trot's held frames, steps() timing
  var SPEED = 58;                      // CSS px a second at the trot: a journey, not a race
  var RISE = 1100;                     // plants rising or sinking, ms
  var STAND = Math.pow(PHI, 4) * 1000; // plants stand at least this long
  var SAY = Math.pow(PHI, 5) * 1000;   // the line stays this long when pressed
  var REST = [Math.pow(PHI, 8) * 1000, Math.pow(PHI, 9) * 1000];
  var LIGHT = [-0.62, -0.78];          // toward the light: up and to the left
  var CELL = 2;                        // CSS px a dot of the plants

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cast = null, plants = null, sprites = {};
  var loading = null;
  var one = null;                      // the character out now, if any
  var restUntil = 0;
  var visit = { key: null, done: false };
  var canvas = null, g = null, dpr = 1, W = 0, H = 0;
  var hit = null, says = null;
  var raf = 0, lastDrawn = -1;
  var spriteCache = {};

  /* ---- reading the files ----------------------------------------------- */

  function load() {
    if (loading) { return loading; }
    function get(name) {
      return fetch(BASE + name).then(function (r) {
        if (!r.ok) { throw new Error(name + " " + r.status); }
        return r.json();
      });
    }
    loading = Promise.all([get("characters.json"), get("plants.json")]).then(function (got) {
      cast = got[0];
      plants = got[1];
      return Promise.all(cast.cast.map(function (c) {
        return get(c.id + ".json").then(function (s) { sprites[c.id] = s; });
      }));
    }).catch(function () { cast = null; });
    return loading;
  }

  /* ---- colour ------------------------------------------------------------ */

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function css(c, jitter) {
    var j = jitter || 0;
    return "rgb(" + Math.max(0, Math.min(255, Math.round(c[0] + j))) + "," +
      Math.max(0, Math.min(255, Math.round(c[1] + j))) + "," +
      Math.max(0, Math.min(255, Math.round(c[2] + j))) + ")";
  }

  function hash(i, j, s) {
    var n = (i * 73856093) ^ (j * 19349663) ^ ((s || 0) * 83492791);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) % 1024 / 1024;
  }

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(i, j) { return (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16; }

  /* ---- where we are ------------------------------------------------------ */

  // The plants file's nearest place to a point, within a degree and a half.
  function placeAt(lat, lon) {
    if (!plants) { return null; }
    var best = null, bd = 2.25;
    plants.places.forEach(function (p) {
      var dl = p[0] - lat, dn = ((p[1] - lon + 540) % 360) - 180;
      dn *= Math.cos(lat * Math.PI / 180);
      var d = dl * dl + dn * dn;
      if (d < bd) { bd = d; best = p; }
    });
    if (!best) { return null; }
    var set = plants.sets[best[2]];
    var soil = plants.soils[best[4]];
    return { set: set, eco: plants.ecoregions[best[3]], soil: soil[0], soilRgb: rgb(soil[1]) };
  }

  /* ---- the canvas -------------------------------------------------------- */

  function setUp() {
    if (canvas) { return true; }
    var tiles = document.getElementById("tiles");
    var stage = document.getElementById("stage");
    if (!tiles || !stage) { return false; }
    canvas = document.createElement("canvas");
    canvas.className = "world world-tiles characters";
    canvas.id = "characters";
    canvas.setAttribute("aria-hidden", "true");
    tiles.parentNode.insertBefore(canvas, tiles.nextSibling);
    g = canvas.getContext("2d");

    hit = document.createElement("button");
    hit.type = "button";
    hit.className = "character";
    hit.hidden = true;
    stage.appendChild(hit);
    // Its own press: the stage must not take it for a turn or a squash.
    hit.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    hit.addEventListener("click", function (event) {
      event.stopPropagation();
      press();
    });

    says = document.createElement("p");
    says.className = "character-says";
    says.setAttribute("aria-live", "polite");
    says.hidden = true;
    stage.appendChild(says);

    // Leaving the city ends the visit and takes everyone with it.
    var land = document.getElementById("land");
    if (land && window.MutationObserver) {
      new MutationObserver(function () {
        if (land.dataset.at !== "city") { endVisit(); }
      }).observe(land, { attributes: true, attributeFilter: ["data-at"] });
    }
    return true;
  }

  function size() {
    var d = Math.min(3, window.devicePixelRatio || 1);
    var w = window.innerWidth, h = window.innerHeight;
    if (w !== W || h !== H || d !== dpr) {
      W = w; H = h; dpr = d;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      spriteCache = {};
    }
  }

  /* ---- the sprite, in DIRT ------------------------------------------------

     Each cell of a pose is one dot: the artist's ink for what it is (the
     coat, the white, the black, the eye, the pen), the soil of the place
     worked a fifth of the way into it, a little grain per dot, and every
     fourth dot or so a size smaller, so it reads as DIRT's weave and not as
     paint. Drawn once per pose, way and place, at the screen's own pixels. */

  function inkFor(c) {
    var k = c.after.inks;
    return {
      d: rgb(k.coat[0]), R: rgb(k.coat[1]), r: rgb(k.coat[2]), g: rgb(k.coat[3]),
      W: rgb(k.white[0]), w: rgb(k.white[1]),
      k: rgb(k.black[0]), K: rgb(k.black[1]),
      y: rgb(k.eye), o: rgb(k.pen[0]), p: rgb(k.pen[1])
    };
  }

  function sprite(c, pose, n, dir, here) {
    n = n % sprites[c.id].poses[pose].length;
    var key = c.id + "|" + pose + "|" + n + "|" + dir + "|" + (here ? here.soil : "");
    if (spriteCache[key]) { return spriteCache[key]; }
    var s = sprites[c.id];
    var rows = s.poses[pose][n];
    var px = Math.max(1, Math.round(s.cell * dpr));
    var cv = document.createElement("canvas");
    cv.width = s.w * px;
    cv.height = s.h * px;
    var x = cv.getContext("2d");
    var ink = c._ink || (c._ink = inkFor(c));
    var soil = here ? here.soilRgb : [120, 100, 80];
    for (var j = 0; j < rows.length; j += 1) {
      for (var i = 0; i < rows[j].length; i += 1) {
        var ch = rows[j].charAt(i);
        if (ch === "." || !ink[ch]) { continue; }
        var line = ch === "o" || ch === "p";
        var col = mix(ink[ch], soil, line ? 0.08 : 0.2);
        var h = hash(i, j, 7);
        x.fillStyle = css(col, line ? 0 : (h - 0.5) * 10);
        var ii = dir > 0 ? i : s.w - 1 - i;
        var d = px;
        // A dot now and then a little smaller, as DIRT's are, never leaving a gap
        // wide enough to read as a mark of its own.
        if (!line && px > 3 && hash(i, j, 3) < 0.1) { d = px - 1; }
        x.fillRect(ii * px, j * px, d, d);
      }
    }
    spriteCache[key] = { cv: cv, px: px, w: s.w, h: s.h, foot: s.foot };
    return spriteCache[key];
  }

  /* ---- the plants ---------------------------------------------------------

     Round the ring, the place's own plants rise, a crown at a time, each in
     the shape DIRT's grammar gives its stratum (a lobed broadleaf, a
     conifer's star, an umbrella, a palm, a column, tussocks, a cushion, a
     rosette, reeds, a mangrove), coloured from the biome's own look and lit
     from the upper left, its shadow down and to the right, in dots on a
     grid of their own. They come up a row at a time out of the soil and go
     back down it. */

  function crownAt(shape, dx, dy, R, seed) {
    var rho = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx);
    var a0 = seed * 6.283;
    switch (shape) {
      case "cone":
        return rho < R * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(4 * th + a0)), 4));
      case "umbrella":
        return rho < R * (0.96 + 0.04 * Math.cos(7 * th + a0)) && Math.abs(dy) < R * 0.8;
      case "palm": {
        var k = (th + a0) / (Math.PI / 4);
        var off = Math.abs(k - Math.round(k)) * (Math.PI / 4) * rho;
        return rho < R && off < R * 0.16 * (1.15 - rho / R) + 0.6;
      }
      case "column":
        return rho < R * 0.45;
      case "tussock": {
        for (var t = 0; t < 4; t += 1) {
          var ta = a0 + t * 2.4, tr = R * 0.45;
          var ex = dx - Math.cos(ta) * tr, ey = dy - Math.sin(ta) * tr;
          if (ex * ex + ey * ey < R * R * 0.12) { return true; }
        }
        return false;
      }
      case "cushion":
        return (dx * dx) / (R * R) + (dy * dy) / (R * R * 0.55) < 1;
      case "rosette":
        return rho < R * (0.35 + 0.65 * Math.pow(Math.abs(Math.cos(6.5 * th + a0)), 2));
      case "reed":
        return rho < R && hash(Math.round(dx), Math.round(dy), 11) < 0.42;
      case "mangrove":
        return rho < R * (0.86 + 0.08 * Math.cos(9 * th + a0) + 0.06 * Math.cos(4 * th));
      default:     // lobed
        return rho < R * (0.82 + 0.12 * Math.cos(5 * th + a0) + 0.06 * Math.cos(13 * th + a0 * 2));
    }
  }

  function makeCrown(shape, R, look, soil, seed) {
    // In plant cells (CELL px), relative to the crown's middle.
    var n = Math.ceil(R / CELL) + 1;
    var dots = [], shade = [];
    var lo = look.map(rgb);
    var drop = Math.max(1, Math.round((shape === "umbrella" ? 0.6 : shape === "column" ? 0.7 : 0.3) * R / CELL));
    for (var j = -n; j <= n; j += 1) {
      for (var i = -n; i <= n; i += 1) {
        var dx = i * CELL, dy = j * CELL;
        if (!crownAt(shape, dx, dy, R, seed)) { continue; }
        var l = 0.5 + 0.5 * (dx * LIGHT[0] + dy * LIGHT[1]) / R;
        if (shape === "column") { l *= 0.55; }
        var v = l * 3 - 0.5, k = Math.floor(v);
        if (v - k > bayer(i, j)) { k += 1; }
        k = Math.max(0, Math.min(2, k));
        dots.push({ i: i, j: j, c: css(mix(lo[k], soil, 0.15), (hash(i, j, seed * 97 | 0) - 0.5) * 16),
                    small: hash(i, j, 5) < 0.3 });
        shade.push({ i: i + drop, j: j + drop });
      }
    }
    var lowest = -n, highest = n;
    return { dots: dots, shade: shade, shadeC: css(mix(lo[0], [0, 0, 0], 0.45)), top: lowest, bottom: highest };
  }

  function growPlants(x, y, r, here, seed) {
    var out = [];
    if (!here || !here.set.strata.length) { return out; }
    var strata = here.set.strata;
    var total = strata.reduce(function (a, s) { return a + s[3]; }, 0);
    var n = Math.min(13, 7 + Math.round(total * 3));
    var ring = Math.max(56, r);
    var a = seed * 6.283;
    for (var k = 0; k < n; k += 1) {
      a += 2.39996;                                  // the golden angle
      var pick = hash(k, 1, seed * 1000 | 0) * total, s = strata[0];
      for (var q = 0; q < strata.length; q += 1) { pick -= strata[q][3]; if (pick <= 0) { s = strata[q]; break; } }
      var R = Math.max(5, Math.min(18, 4 + s[2] * 0.3));
      var d = ring * (0.92 + 0.42 * hash(k, 2, seed * 1000 | 0)) + R * 0.5;
      var cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.82;
      if (cx < -R || cx > W + R || cy < -R || cy > H + R) { continue; }
      var crown = makeCrown(s[1], R, here.set.look, here.soilRgb, hash(k, 3, seed * 1000 | 0));
      crown.x = Math.round(cx / CELL) * CELL;
      crown.y = Math.round(cy / CELL) * CELL;
      crown.delay = k * 90;
      crown.stratum = s;
      out.push(crown);
    }
    return out;
  }

  // How much of a crown is up: 0 to 1 coming up, and back down again.
  function upness(p, now) {
    var t = now - p.born - p.crownDelay;
    if (t < 0) { return 0; }
    var up = Math.min(1, t / RISE);
    if (p.sinkAt && now > p.sinkAt + p.crownDelay) { up = Math.max(0, 1 - (now - p.sinkAt - p.crownDelay) / RISE); }
    return Math.floor(up * 8) / 8;                  // in held steps
  }

  function drawPlants(now) {
    var px = Math.max(1, Math.round(CELL * dpr));
    var anyUp = false;
    one.plants.forEach(function (c) {
      var up = upness({ born: one.born, crownDelay: c.delay, sinkAt: one.sinkAt }, now);
      if (up <= 0) { return; }
      anyUp = true;
      var rows = c.bottom - c.top + 1;
      var cut = c.bottom - Math.ceil(rows * up);    // rows above this are not up yet
      var ox = Math.round(c.x * dpr), oy = Math.round(c.y * dpr);
      g.globalAlpha = 0.42;
      g.fillStyle = c.shadeC;
      c.shade.forEach(function (s) {
        if (s.j - 1 <= cut) { return; }
        g.fillRect(ox + s.i * px, oy + s.j * px, px, px);
      });
      g.globalAlpha = 1;
      c.dots.forEach(function (d) {
        if (d.j <= cut) { return; }
        g.fillStyle = d.c;
        var sz = d.small && px > 1 ? px - Math.max(1, Math.round(px / 3)) : px;
        g.fillRect(ox + d.i * px, oy + d.j * px, sz, sz);
      });
    });
    return anyUp;
  }

  /* ---- his writing, behind it ----------------------------------------------

     Twombly's line: a pen that loops as it goes, leaning right, pointed at
     the turns, two lines to a row in two inks, lifting between phrases.
     Here it is the way the fox came, written along the ground behind it in
     single pixels, and it fades in steps. */

  function drawWriting(now) {
    var w = one.writing;
    if (!w.length) { return false; }
    var inks = one.c.after.inks.writing;
    var px = Math.max(1, Math.round(dpr));
    var live = false;
    for (var line = 0; line < 2; line += 1) {
      g.fillStyle = inks[line % inks.length];
      for (var k = 1; k < w.length; k += 1) {
        var age = now - w[k].at, life = 4200;
        if (age > life) { continue; }
        live = true;
        g.globalAlpha = [0.9, 0.66, 0.42, 0.2][Math.min(3, Math.floor(age / life * 4))];
        // Between two samples the pen goes on in fine steps, so it is a line.
        for (var q = 0; q < 1; q += 0.125) {
          var s = w[k - 1].s + (w[k].s - w[k - 1].s) * q;
          var u = s / 5.2 + line * 2.1;
          // Lifting between phrases: every fifth loop or so the pen is up.
          if (Math.floor(u / (Math.PI * 2)) % 5 === 4) { continue; }
          var lx = s - one.dir * 8 * Math.sin(u);
          var ly = -4.2 * (1 - Math.cos(u)) + line * 4;
          lx += one.dir * 0.32 * -ly;               // leaning right as it writes
          var x = Math.round((one.x0 + one.dir * lx) * dpr), y = Math.round((w[k].y + 6 + ly) * dpr);
          g.fillRect(x, y, px, px);
        }
      }
    }
    g.globalAlpha = 1;
    // Forget what has faded.
    while (w.length && now - w[0].at > 4400) { w.shift(); }
    return live;
  }

  /* ---- the character ------------------------------------------------------ */

  function wave(x, y, city) {
    if (still || one || !city || !isFinite(x) || !isFinite(y)) { return; }
    var key = city.key || "";
    if (visit.key !== key) { visit = { key: key, done: false }; }
    if (visit.done) { return; }
    var now = performance.now();
    if (now < restUntil) { return; }
    if (!setUp()) { return; }
    visit.done = true;
    load().then(function () {
      if (!cast || !cast.cast.length || one) { return; }
      var land = document.getElementById("land");
      if (land && land.dataset.at !== "city") { return; }
      // One of the cast; while there is one, it is always that one.
      var c = cast.cast[Math.floor(Math.random() * cast.cast.length)];
      if (!sprites[c.id]) { return; }
      come(c, x, y, city.r || 60, placeAt(city.lat, city.lon));
    });
  }

  function come(c, x, y, r, here) {
    size();
    var now = performance.now();
    // Off by the nearer side, unless that is too close to be seen going; on
    // a phone, always to the left, away from the dial of years at the right.
    var dir = x > W / 2 ? 1 : -1;
    if (Math.abs((dir > 0 ? W : 0) - x) < 140) { dir = -dir; }
    if (W < 600) { dir = -1; }
    var seed = Math.random();
    one = {
      c: c, here: here, born: now, x0: x, x: x, y: y, dir: dir,
      pose: "stand", n: 0, state: "out", since: now, s: 0, looked: false,
      plants: growPlants(x, y, r, here, seed), writing: [], sinkAt: 0, stopped: false
    };
    hit.setAttribute("aria-label", c.name + " — press to see what it is");
    loop();
  }

  function press() {
    if (!one || one.state === "gone") { return; }
    var now = performance.now();
    if (one.stopped) { goOn(now); return; }
    one.stopped = true;
    one.stopAt = now;
    one.pose = "look";
    one.n = 0;
    says.textContent = line(one);
    says.hidden = false;
    placeSays();
    one.sayUntil = now + SAY;
  }

  function goOn(now) {
    one.stopped = false;
    one.lastMove = now;
    one.state = "trot";
    one.since = now;
    says.hidden = true;
  }

  function line(o) {
    var bits = [o.c.name, "after " + o.c.artist];
    var names = [];
    o.plants.forEach(function (p) {
      var nm = p.stratum[4][0];
      if (nm && names.indexOf(nm) < 0) { names.push(nm); }
    });
    if (names.length) {
      names = names.slice(0, 3);
      bits.push("among " + (names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0]));
    }
    if (o.here) { bits.push(o.here.set.biome); }
    return bits.join(" · ");
  }

  function bounds() {
    var s = sprites[one.c.id];
    var w = s.w * s.cell, h = s.h * s.cell;
    return { x: one.x - w / 2, y: one.y - s.foot[1] * s.cell, w: w, h: h };
  }

  function placeSays() {
    var b = bounds();
    var sw = says.offsetWidth || 220, sh = says.offsetHeight || 30;
    var left = one.dir > 0 ? b.x - sw - 10 : b.x + b.w + 10;
    if (left < 16) { left = b.x + b.w + 10; }
    if (left + sw > W - 16) { left = Math.max(16, b.x - sw - 10); }
    var top = Math.max(16, Math.min(H - sh - 16, b.y + b.h / 2 - sh / 2));
    says.style.transform = "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
  }

  function step(now) {
    var o = one, t = now - o.since;
    if (o.stopped) {
      // Looking at you; then it sits; then it goes on.
      if (now - o.stopAt > 2600) { o.pose = "sit"; }
      if (now > o.sayUntil) { goOn(now); }
      return;
    }
    if (o.state === "out") {
      o.pose = "stand";
      if (t > 700) { o.state = "trot"; o.since = now; }
      return;
    }
    if (o.state === "back") {
      o.pose = "back";
      o.lastMove = now;
      if (t > 1500) { o.state = "trot"; o.since = now; }
      return;
    }
    if (o.state === "trot") {
      var dt = Math.min(80, now - (o.lastMove || now));
      o.lastMove = now;
      o.s += SPEED * Math.max(1 / PHI, Math.min(1, W / 1000)) * dt / 1000;   // slower across a phone
      o.x = o.x0 + o.dir * o.s;
      o.pose = "trot";
      o.n = Math.floor(now / (1000 / FPS)) % 4;
      if (!o.writing.length || o.s - 18 - o.writing[o.writing.length - 1].s >= 3) { o.writing.push({ s: o.s - 18, y: o.y, at: now }); }
      // Once, a little way off, it stops and looks back.
      if (!o.looked && o.s > 110) { o.looked = true; o.state = "back"; o.since = now; }
      var half = sprites[o.c.id].w * sprites[o.c.id].cell / 2;
      if (o.x < -half - 10 || o.x > W + half + 10) {
        o.state = "gone";
        if (!o.sinkAt) { o.sinkAt = Math.max(now, o.born + STAND); }
      }
    }
  }

  function draw(now) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    var busy = drawPlants(now);
    busy = drawWriting(now) || busy;
    var o = one;
    if (o.state !== "gone") {
      busy = true;
      var sp = sprite(o.c, o.pose, o.n, o.dir, o.here);
      var b = bounds();
      var x = Math.round(b.x * dpr), y = Math.round(b.y * dpr);
      // Coming out: it rises out of the soil a row at a time.
      if (o.state === "out" && !o.stopped) {
        var up = Math.min(1, Math.floor((now - o.born) / 600 * 8) / 8);
        var hh = Math.round(sp.cv.height * up);
        if (hh > 0) { g.drawImage(sp.cv, 0, sp.cv.height - hh, sp.cv.width, hh, x, y + sp.cv.height - hh, sp.cv.width, hh); }
      } else {
        g.drawImage(sp.cv, x, y);
      }
      if (o.stopped) { box(b); }
      hit.hidden = false;
      hit.style.transform = "translate(" + Math.round(b.x + b.w * 0.15) + "px," + Math.round(b.y + b.h * 0.2) + "px)";
      hit.style.width = Math.round(b.w * 0.7) + "px";
      hit.style.height = Math.round(b.h * 0.8) + "px";
    } else {
      hit.hidden = true;
    }
    return busy;
  }

  // Twombly's red box round a plate: drawn by hand, a little over at the corners.
  function box(b) {
    var px = Math.max(1, Math.round(dpr));
    g.fillStyle = one.c.after.inks.box;
    var x0 = Math.round((b.x + 2) * dpr), y0 = Math.round((b.y + 4) * dpr);
    var x1 = Math.round((b.x + b.w - 2) * dpr), y1 = Math.round((b.y + b.h + 2) * dpr);
    var over = Math.round(3 * dpr);
    g.fillRect(x0 - over, y0, x1 - x0 + over * 2, px);
    g.fillRect(x0, y1, x1 - x0 + over, px);
    g.fillRect(x0, y0 - over, px, y1 - y0 + over);
    g.fillRect(x1, y0, px, y1 - y0 + over * 2);
  }

  function loop() {
    if (raf) { return; }
    var tick = function (now) {
      raf = 0;
      if (!one) { return; }
      size();
      step(now);
      if (now - (one.lastStep || 0) >= 1000 / 24 || one.stopped) {
        var busy = draw(now);
        one.lastStep = now;
        if (!busy && one.state === "gone" && one.sinkAt && now > one.sinkAt + RISE + 1400) { end(); return; }
      }
      if (one.stopped) { placeSays(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function end() {
    one = null;
    restUntil = performance.now() + REST[0] + Math.random() * (REST[1] - REST[0]);
    if (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); }
    if (hit) { hit.hidden = true; }
    if (says) { says.hidden = true; }
  }

  function endVisit() {
    visit = { key: null, done: false };
    if (one) { end(); }
  }

  window.Characters = {
    wave: wave,
    // For the preview (scripts/preview_character.js): the files, read,
    // and one pose drawn as the page draws it, on a place's soil and plants.
    load: load,
    preview: function (ctx, o) {
      var c = cast.cast.filter(function (k) { return k.id === o.id; })[0];
      var here = placeAt(o.lat, o.lon);
      var keep = dpr;
      dpr = o.scale;
      spriteCache = {};
      if (o.plants && here) {
        here.set.strata.forEach(function (st, k) {
          var cr = makeCrown(st[1], Math.max(5, Math.min(18, 4 + st[2] * 0.3)), here.set.look, here.soilRgb, 0.3 + k * 0.2);
          var px = Math.max(1, Math.round(CELL * dpr));
          var ox = o.x + k * 44 * dpr, oy = o.y;
          ctx.globalAlpha = 0.42; ctx.fillStyle = cr.shadeC;
          cr.shade.forEach(function (d) { ctx.fillRect(ox + d.i * px, oy + d.j * px, px, px); });
          ctx.globalAlpha = 1;
          cr.dots.forEach(function (d) { ctx.fillStyle = d.c; ctx.fillRect(ox + d.i * px, oy + d.j * px, px, px); });
        });
      } else {
        var sp = sprite(c, o.pose, o.n || 0, o.dir || 1, here);
        ctx.drawImage(sp.cv, o.x, o.y);
      }
      dpr = keep;
      spriteCache = {};
      return here && { soil: here.soil, soilRgb: here.soilRgb, biome: here.set.biome, realm: here.set.realm,
                       eco: here.eco, strata: here.set.strata.map(function (st) { return st[0] + " (" + st[1] + "): " + st[4].join(", "); }) };
    },
    _state: function () { return one && { id: one.c.id, pose: one.pose, state: one.state, x: one.x, y: one.y, line: line(one), plants: one.plants.length }; }
  };

  // Read the small files once the page has settled, so the first wave
  // does not wait on them.
  if (!still) {
    window.addEventListener("load", function () { window.setTimeout(load, 4000); });
  }
})();

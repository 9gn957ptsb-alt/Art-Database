/* The globe's dial (globedial.js).

   The artist, 15 Oct 2026, with a recording of the Artists layer zoomed into
   the east coast: "The dial around the globe or the cities is the answer to
   being able to shift through categories seamlessly while the dial being
   able to be other tools as well. In the globe view rotating the dial should
   rotate you through the different categories and in the city views the
   rotation of the dial should change the time. What we need to figure out is
   how to be able to shift the function of the dial in views to enable the
   right function to be at the fingertips of the user. For instance,
   switching between the categories function and the time function."

   So the world has a dial of its own: a ring round it, the same instrument as
   a city's ring on its ground (DIAL.md, "The dial on the ground"), its front —
   the place nearest you — at its foot. It has two functions, and its crown
   (a small button under the front) switches between them; a city's dial has
   the same crown beside its animal (land.js, "the dial's functions"). Each
   view opens on its own function: the world on its categories, a city on its
   time.

     categories  the globe's layers written round the ring, each its glyph and
                 its name along the arc; the one at the front is the layer on
                 the world. Turning the ring turns the world through them, a
                 layer as each comes to the front; let go, it settles on the
                 nearest; a tap on a name turns it to the front.
     time        the ring is years, as a city's: the beginning just left of the
                 front, now just right of it, the years before now spread by
                 their logarithm (so the last century has as much room as the
                 ones before it, as on the categories' spectrum); its handle
                 the year. The world shows the layer's marks of that year — an
                 artist living then (a town of several births says how many),
                 a collage once made, a city once a saved work had come there;
                 a layer with no years says so. At now nothing is held back.

   Where the world is small the ring stands round it; where it is larger than
   the window the ring is the largest the window has room for, over the world,
   and takes a press only on its names, its handle and its crown, so the world
   under it still turns. It is not there while the world is brought nearer
   (only the cities then: land.js, zoomCities), nor anywhere but the front
   globe. The pills at the foot give way to it on the front globe; on a
   reading's grown globe they stay. The keys: the crown, then the ring itself
   (a range, unseen): arrows turn it, Home and End go to its ends.

   Hooks in land.js: Land.globeRing, Land.layers, Land.layer,
   Land.chooseLayer, Land.globeYear, Land.layerYears, Land.safe. */
(function () {
  "use strict";
  var stage = document.getElementById("stage");
  var landEl = document.getElementById("land");
  if (!stage || !landEl || !window.Land) { return; }
  var TAU = Math.PI * 2;
  var FRONT = Math.PI / 2;                 // the front of the ring: its foot, nearest you
  var GAP = 18 * Math.PI / 180;            // where now meets the beginning, at the front
  var RING_GAP = 22;                       // from the world's rim to the ring
  var RMIN = 112;                          // never smaller than this
  var SIDE = 16, TOP = 16;                 // the window's margins
  var LABEL = 16;                          // the names' room outside the ring
  var FOOT = 48;                           // the front's name and the crown under it
  var CREAM = "#eadfcd", QUIET = "#a8927a", LILAC = "#9d95e6", LIGHT = "#b9b2ff";
  var NOW = new Date().getFullYear();
  var SCALE = 25;                          // the years' logarithm: room for the last decades

  var de = document.documentElement;
  var canvas = document.createElement("canvas");
  canvas.className = "globe-dial";
  canvas.setAttribute("aria-hidden", "true");
  var tiles = document.getElementById("tiles");
  stage.insertBefore(canvas, tiles ? tiles.nextSibling : landEl);
  var g = canvas.getContext("2d");

  // The crown, and the ring's own keys (a range, unseen: its focus draws a ring round the dial).
  var ui = document.createElement("div");
  ui.className = "globe-dial-ui";
  var crown = document.createElement("button");
  crown.type = "button";
  crown.className = "globe-dial-crown";
  var range = document.createElement("input");
  range.type = "range";
  range.className = "globe-dial-range";
  range.step = "1";
  ui.appendChild(crown);
  ui.appendChild(range);
  stage.appendChild(ui);

  var mono = "ui-monospace, Menlo, monospace";
  try {
    var probe = document.querySelector(".filter-layer") || document.body;
    var ff = getComputedStyle(probe).fontFamily;
    if (ff) { mono = ff; }
  } catch (e) {}

  var st = {
    fn: "categories",        // the ring's function on the world
    turn: 0,                 // the layers' turn: the front is round(turn)
    tween: null,             // { from, to, at, dur }
    drag: null,              // a hand on the ring
    t: 1,                    // the year on the ring, 0 (the first) to 1 (now)
    span: null,              // the layer's years [y0, now]
    alpha: 0,                // shown, 0 to 1
    key: "",                 // what was last drawn
    labels: [],              // where each name is, for presses
    G: null                  // the ring: { cx, cy, r, over }
  };

  function layers() { return Land.layers ? Land.layers() : []; }
  function idx(key) {
    var L = layers();
    for (var k = 0; k < L.length; k += 1) { if (L[k].key === key) { return k; } }
    return 0;
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function front() { var n = layers().length || 1; return mod(Math.round(st.turn), n); }

  /* ---- where the ring is -------------------------------------------------- */
  function geom(w) {
    var H = w.H, W = w.W, foot = H - Math.max(16, w.foot || 16);
    var maxR = Math.min((W - 2 * SIDE) / 2 - LABEL, (foot - TOP - LABEL - FOOT) / 2);
    var want = Math.max(RMIN, w.R + RING_GAP), r = Math.max(60, Math.min(want, maxR));
    var cx = Math.max(SIDE + LABEL + r, Math.min(W - SIDE - LABEL - r, w.cx));
    var cy = Math.max(TOP + LABEL + r, Math.min(foot - FOOT - r, w.cy));
    // A world larger than the window: the ring goes over to the window's middle as it grows, a bezel
    // the world turns under rather than a circle left wherever the world's middle was.
    var b = Math.max(0, Math.min(1, (want - maxR) / (0.6 * maxR)));
    if (b > 0) {
      var mx = W / 2, my = (TOP + LABEL + foot - FOOT) / 2;
      cx += (mx - cx) * b;
      cy += (my - cy) * b;
    }
    // Over the world (larger than the ring): it takes a press only on its names, handle and crown.
    var dx = cx - w.cx, dy = cy - w.cy, over = w.R + 6 > r - Math.sqrt(dx * dx + dy * dy);
    return { cx: cx, cy: cy, r: r, over: over };
  }

  /* ---- the years ---------------------------------------------------------- */
  function uOf(y) {
    var s = st.span;
    if (!s) { return 1; }
    var L = Math.log(1 + (s[1] - s[0]) / SCALE);
    return Math.max(0, Math.min(1, 1 - Math.log(1 + Math.max(0, s[1] - y) / SCALE) / L));
  }
  function yOf(u) {
    var s = st.span;
    if (!s) { return NOW; }
    var L = Math.log(1 + (s[1] - s[0]) / SCALE);
    return s[1] - SCALE * (Math.exp((1 - u) * L) - 1);
  }
  function angOf(u) { return FRONT + GAP / 2 + u * (TAU - GAP); }
  function uAt(th) {
    var a = mod(th - FRONT - GAP / 2, TAU);
    if (a > TAU - GAP) { return a > TAU - GAP / 2 ? 0 : 1; }      // in the gap: its nearer end
    return a / (TAU - GAP);
  }
  function yearSaid(y) {
    y = Math.round(y);
    return y < 0 ? (-y) + " BCE" : String(y);
  }

  /* ---- drawing ------------------------------------------------------------ */
  function size() {
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      st.key = "";
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Text along the ring, upright: over the middle it reads round the outside, under it round the inside.
  function arcText(str, cx, cy, rad, th, font, color, track) {
    g.font = font;
    g.fillStyle = color;
    // A dark edge, so a name reads over land and cloud as over the sea.
    g.strokeStyle = "rgba(15, 10, 7, 0.72)";
    g.lineWidth = 3;
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    var chars = Array.from(str), widths = chars.map(function (c) { return g.measureText(c).width + track; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) - track;
    var under = Math.sin(th) > 0, dir = under ? -1 : 1, a = th - dir * total / 2 / rad;
    chars.forEach(function (ch, i) {
      var w = widths[i], mid = a + dir * (w - track) / 2 / rad;
      g.save();
      g.translate(cx + Math.cos(mid) * rad, cy + Math.sin(mid) * rad);
      g.rotate(under ? mid - Math.PI / 2 : mid + Math.PI / 2);
      g.strokeText(ch, 0, 0);
      g.fillText(ch, 0, 0);
      g.restore();
      a += dir * w / rad;
    });
    return total / rad;                   // the angle it spans
  }

  function diamond(x, y, s, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(15, 10, 7, 0.85)";
    g.lineWidth = 1.5;
    g.stroke();
  }

  function draw(G) {
    var W = window.innerWidth, H = window.innerHeight;
    g.clearRect(0, 0, W, H);
    st.labels = [];
    if (st.alpha <= 0.01) { return; }
    g.globalAlpha = st.alpha;
    var cx = G.cx, cy = G.cy, r = G.r;
    // The ring.
    g.strokeStyle = "rgba(234, 223, 205, " + (G.over ? 0.42 : 0.3) + ")";
    g.lineWidth = 1;
    g.beginPath();
    if (st.fn === "time") { g.arc(cx, cy, r, FRONT + GAP / 2, FRONT - GAP / 2 + TAU); }
    else { g.arc(cx, cy, r, 0, TAU); }
    g.stroke();
    if (st.fn === "time") { drawYears(G); } else { drawCategories(G); }
    g.globalAlpha = 1;
  }

  function drawCategories(G) {
    var L = layers(), n = L.length || 1, cx = G.cx, cy = G.cy, r = G.r, f = front();
    var step = TAU / n;
    // Between each two, a short tick across the ring.
    g.strokeStyle = "rgba(234, 223, 205, 0.4)";
    g.lineWidth = 1;
    for (var k = 0; k < n; k += 1) {
      var tb = FRONT + (k - st.turn + 0.5) * step;
      g.beginPath();
      g.moveTo(cx + Math.cos(tb) * (r - 4), cy + Math.sin(tb) * (r - 4));
      g.lineTo(cx + Math.cos(tb) * (r + 4), cy + Math.sin(tb) * (r + 4));
      g.stroke();
    }
    // The front: a stretch of the ring lit, and the handle.
    g.strokeStyle = LILAC;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, FRONT - step * 0.32, FRONT + step * 0.32);
    g.stroke();
    // The names, each where it is turned to; the front's the brightest, the farther the quieter.
    L.forEach(function (l, k) {
      var th = FRONT + (k - st.turn) * step;
      var near = Math.abs(Math.atan2(Math.sin(th - FRONT), Math.cos(th - FRONT))) / Math.PI;   // 0 at the front, 1 behind
      var isFront = k === f;
      var font = (isFront ? "600 11px " : "10px ") + mono;
      var color = isFront ? CREAM : near < 0.4 ? "#c9b8a2" : QUIET;
      var words = (l.glyph ? l.glyph + " " : "") + l.label.toUpperCase();
      g.globalAlpha = st.alpha * (isFront ? 1 : Math.max(0.55, 1 - near * 0.5));
      var rad = r + (Math.sin(th) > 0 ? 13 : 11);
      var span = arcText(words, cx, cy, rad, th, font, color, 1.1);
      st.labels.push({ k: k, th: th, span: span + 0.08, r0: r - 6, r1: r + 26 });
    });
    g.globalAlpha = st.alpha;
    diamond(cx, cy + r, 5.5, CREAM);
  }

  function drawYears(G) {
    var cx = G.cx, cy = G.cy, r = G.r, s = st.span;
    if (!s) {
      g.font = "10px " + mono;
      g.fillStyle = QUIET;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("NO YEARS ON THIS LAYER", cx, cy + r + 14);
      return;
    }
    // The decades and the centuries, as their room allows; the named years round the outside.
    var steps = [1, 5, 10, 25, 50, 100, 250, 500, 1000], minTick = 4, minName = 46;
    var lastTickAng = -1, y;
    g.strokeStyle = "rgba(234, 223, 205, 0.32)";
    g.lineWidth = 1;
    var tickStep = 10;
    for (var a = 0; a < steps.length; a += 1) {
      var st0 = steps[a], u1 = uOf(s[1] - st0);
      if ((1 - u1) * (TAU - GAP) * r >= minTick) { tickStep = st0; break; }
    }
    // A tick every tickStep where there is room, more sparse into the past.
    for (y = Math.floor(s[1] / tickStep) * tickStep; y >= s[0]; y -= tickStep) {
      var ang = angOf(uOf(y));
      if (lastTickAng >= 0 && Math.abs(ang - lastTickAng) * r < minTick) { continue; }
      lastTickAng = ang;
      var long = y % 100 === 0;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * (r + 2), cy + Math.sin(ang) * (r + 2));
      g.lineTo(cx + Math.cos(ang) * (r + (long ? 7 : 4)), cy + Math.sin(ang) * (r + (long ? 7 : 4)));
      g.stroke();
    }
    // Named years: now's decades first, then back through the centuries, as far apart as a name needs.
    var names = [], lastAng = null;
    var cand = [];
    for (y = Math.floor(s[1] / 25) * 25; y >= Math.max(1900, s[0]); y -= 25) { cand.push(y); }
    for (y = 1800; y >= s[0]; y -= 100) { cand.push(y); }
    for (y = Math.floor(Math.min(1700, s[1]) / 500) * 500; y >= s[0]; y -= 500) { if (cand.indexOf(y) < 0) { cand.push(y); } }
    cand.forEach(function (yy) {
      var ang = angOf(uOf(yy));
      if (names.some(function (o) { return Math.abs(o.ang - ang) * (r + 16) < minName; })) { return; }
      if (Math.abs(ang - angOf(0)) * r < 22 || Math.abs(ang - angOf(1)) * r < 22) { return; }
      names.push({ y: yy, ang: ang });
    });
    names.forEach(function (o) {
      g.globalAlpha = st.alpha * 0.8;
      arcText(yearSaid(o.y), cx, cy, r + 15, o.ang, "9px " + mono, QUIET, 0.6);
    });
    g.globalAlpha = st.alpha;
    // The first year and now, each at its side of the gap.
    var ua = angOf(0) + 0.06, ub = angOf(1) - 0.06;
    g.font = "9px " + mono;
    g.fillStyle = CREAM;
    g.textBaseline = "middle";
    g.textAlign = "right";
    g.fillText(yearSaid(s[0]), cx + Math.cos(ua) * (r + 4) - 4, cy + Math.sin(ua) * (r + 4) + 12);
    g.textAlign = "left";
    g.fillText("NOW", cx + Math.cos(ub) * (r + 4) + 4, cy + Math.sin(ub) * (r + 4) + 12);
    // The way come: lilac from the first year round to the handle.
    var at = angOf(st.t);
    g.strokeStyle = LILAC;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, angOf(0), at);
    g.stroke();
    g.strokeStyle = LIGHT;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r, Math.max(angOf(0), at - 0.18), at);
    g.stroke();
    diamond(cx + Math.cos(at) * r, cy + Math.sin(at) * r, 5.5, CREAM);
    // The year, at the front.
    g.font = "600 13px " + mono;
    g.fillStyle = CREAM;
    g.textAlign = "center";
    g.fillText(st.t >= 0.999 ? "NOW" : yearSaid(yOf(st.t)), cx, cy + r + 15);
  }

  /* ---- the crown and the keys ---------------------------------------------- */
  function crownWords() {
    var L = layers(), here = L[front()];
    if (st.fn === "time") {
      crown.textContent = "⇄ Categories";
      crown.setAttribute("aria-label", "The dial is on time: switch it to the categories");
    } else {
      crown.textContent = "⇄ Time";
      crown.setAttribute("aria-label", "The dial is on the categories" + (here ? ", at " + here.label : "") + ": switch it to time");
    }
  }
  function rangeFor() {
    var L = layers();
    if (st.fn === "time") {
      range.min = "0"; range.max = "1000"; range.step = "1";
      range.value = String(Math.round(st.t * 1000));
      var y = st.t >= 0.999 ? "now" : yearSaid(yOf(st.t));
      range.setAttribute("aria-label", "The globe's dial: the year");
      range.setAttribute("aria-valuetext", y);
    } else {
      range.min = "0"; range.max = String(Math.max(0, L.length - 1)); range.step = "1";
      range.value = String(front());
      range.setAttribute("aria-label", "The globe's dial: the category on the world");
      range.setAttribute("aria-valuetext", L[front()] ? L[front()].label : "");
    }
  }
  function placeUI(G, on) {
    ui.hidden = !on;
    if (!on) { return; }
    var cw = crown.offsetWidth || 90, ch = crown.offsetHeight || 24;
    var x = G.cx - cw / 2, y = G.cy + G.r + 25;
    crown.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    range.style.transform = "translate(" + Math.round(G.cx - G.r) + "px," + Math.round(G.cy - G.r) + "px)";
    range.style.width = Math.round(2 * G.r) + "px";
    range.style.height = Math.round(2 * G.r) + "px";
    void ch;
  }

  function setFn(fn) {
    if (fn === st.fn) { return; }
    st.fn = fn;
    if (fn === "time") {
      st.span = Land.layerYears ? Land.layerYears() : null;
      st.spanFor = Land.layer();
      st.t = 1;
      Land.globeYear(null);
    } else {
      Land.globeYear(null);
    }
    crownWords();
    rangeFor();
    st.key = "";
  }
  crown.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
  crown.addEventListener("click", function () { setFn(st.fn === "time" ? "categories" : "time"); });

  function toLayer(k, at) {
    var L = layers(), n = L.length;
    if (!n) { return; }
    k = mod(k, n);
    if (L[k] && Land.layer() !== L[k].key) { Land.chooseLayer(L[k].key, at || null); }
    crownWords();
    rangeFor();
  }
  // Turned to the k-th the shorter way round, and its layer put on the world.
  function turnTo(k, at) {
    var n = layers().length || 1, base = Math.round(st.turn), diff = mod(k - mod(base, n), n);
    if (diff > n / 2) { diff -= n; }
    st.tween = { from: st.turn, to: base + diff, at: performance.now(), dur: Land.globeRing().still ? 1 : 360 };
    toLayer(k, at);
  }
  function setT(t) {
    st.t = Math.max(0, Math.min(1, t));
    Land.globeYear(st.t >= 0.999 ? null : yOf(st.t));
    rangeFor();
    st.key = "";
  }

  range.addEventListener("input", function () {
    if (st.fn === "time") { setT(Number(range.value) / 1000); return; }
    var k = Number(range.value);
    turnTo(k);
  });
  range.addEventListener("keydown", function (event) {
    if (event.key === "t" || event.key === "T") { setFn(st.fn === "time" ? "categories" : "time"); event.preventDefault(); }
  });

  /* ---- the hand on the ring ------------------------------------------------ */
  function hit(x, y) {
    var G = st.G;
    if (!G || st.alpha < 0.5) { return null; }
    var dx = x - G.cx, dy = y - G.cy, d = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx);
    // A name pressed.
    for (var k = 0; k < st.labels.length; k += 1) {
      var o = st.labels[k], dd = Math.atan2(Math.sin(th - o.th), Math.cos(th - o.th));
      if (d >= o.r0 && d <= o.r1 && Math.abs(dd) <= o.span / 2) { return { kind: "name", k: o.k, th: th, d: d }; }
    }
    // The handle, and the front's words.
    var hx = G.cx + Math.cos(st.fn === "time" ? angOf(st.t) : FRONT) * G.r, hy = G.cy + Math.sin(st.fn === "time" ? angOf(st.t) : FRONT) * G.r;
    if (Math.abs(x - hx) < 22 && Math.abs(y - hy) < 22) { return { kind: "handle", th: th, d: d }; }
    // The ring itself, unless it lies over the world (then the world under it keeps its presses).
    var band = st.touch ? 20 : 12;
    if (!G.over && Math.abs(d - G.r) <= band) { return { kind: "ring", th: th, d: d }; }
    return null;
  }

  stage.addEventListener("pointerdown", function (event) {
    st.touch = event.pointerType === "touch";
    if (st.drag || !st.G || ui.hidden) { return; }
    var t = event.target;
    if (t && t.closest && t.closest(".city, button, a, input, .globe-dial-ui")) { return; }
    var h = hit(event.clientX, event.clientY);
    if (!h) { return; }
    event.stopPropagation();
    event.stopImmediatePropagation();
    st.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, th: h.th, th0: h.th, turn0: st.turn, t0: st.t,
                at: performance.now(), moved: 0, h: h };
    st.tween = null;
  }, true);
  stage.addEventListener("pointermove", function (event) {
    var D = st.drag;
    if (!D) {
      // Over the ring with nothing pressed: a hand for it, and the world's doors and trail kept for the world.
      var over = !ui.hidden && event.pointerType === "mouse" && !event.buttons && hit(event.clientX, event.clientY);
      stage.classList.toggle("over-globe-dial", !!over);
      if (over) { event.stopPropagation(); event.stopImmediatePropagation(); }
      return;
    }
    if (event.pointerId !== D.id) { return; }
    event.stopPropagation();
    event.stopImmediatePropagation();
    var G = st.G, th = Math.atan2(event.clientY - G.cy, event.clientX - G.cx);
    D.moved = Math.max(D.moved, Math.abs(event.clientX - D.x), Math.abs(event.clientY - D.y));
    if (D.moved < 5) { return; }
    var dth = Math.atan2(Math.sin(th - D.th), Math.cos(th - D.th));
    D.th = th;
    if (st.fn === "time") {
      // Never across the gap in one move.
      var nt = uAt(th);
      if (Math.abs(nt - st.t) > 0.5) { return; }
      setT(nt);
      return;
    }
    var n = layers().length || 1;
    st.turn -= dth / (TAU / n);
    var f = front();
    if (Land.layers()[f] && Land.layer() !== Land.layers()[f].key) { toLayer(f, null); }
    st.key = "";
  }, true);
  function release(event) {
    var D = st.drag;
    if (!D || event.pointerId !== D.id) { return; }
    event.stopPropagation();
    event.stopImmediatePropagation();
    st.drag = null;
    var tap = D.moved < 6 && performance.now() - D.at < 500;
    if (st.fn === "time") {
      if (tap && D.h.kind !== "handle") { setT(uAt(D.h.th)); }
      return;
    }
    if (tap && D.h.kind === "name") {
      turnTo(D.h.k, { x: event.clientX, y: event.clientY });
      return;
    }
    if (tap && D.h.kind === "ring") {
      var n = layers().length || 1, k = Math.round(st.turn + Math.atan2(Math.sin(D.h.th - FRONT), Math.cos(D.h.th - FRONT)) / (TAU / n));
      turnTo(mod(k, n), { x: event.clientX, y: event.clientY });
      return;
    }
    // Let go: it settles on the nearest.
    turnTo(front(), null);
  }
  stage.addEventListener("pointerup", release, true);
  stage.addEventListener("pointercancel", release, true);
  stage.addEventListener("wheel", function (event) {
    if (!st.G || ui.hidden) { return; }
    var h = hit(event.clientX, event.clientY);
    if (!h) { return; }
    event.preventDefault();
    event.stopPropagation();
    if (st.fn === "time") { setT(st.t - event.deltaY * 0.0008); return; }
    st.wheel = (st.wheel || 0) + event.deltaY;
    if (Math.abs(st.wheel) >= 60) {
      var k = front() + (st.wheel > 0 ? 1 : -1);
      st.wheel = 0;
      turnTo(mod(k, layers().length || 1), null);
    }
  }, { capture: true, passive: false });

  /* ---- each frame ------------------------------------------------------------ */
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var w = Land.globeRing ? Land.globeRing() : null;
    if (!w) { return; }
    var on = w.on && !w.cities && layers().length > 1;
    // Fade in and out in held steps.
    var want = on ? 1 : 0, dt = Math.min(100, now - (last || now));
    last = now;
    if (st.alpha !== want) {
      st.alpha = w.still ? want : Math.max(0, Math.min(1, st.alpha + (want ? 1 : -1) * dt / 260));
      st.key = "";
    }
    if (on && !de.dataset.globeDial) { de.dataset.globeDial = "true"; if (Land.safe) { Land.safe(); } }
    else if (!on && de.dataset.globeDial && st.alpha <= 0) { delete de.dataset.globeDial; if (Land.safe) { Land.safe(); } }
    // The layer chosen elsewhere (a reading's pills, the keys): the ring turns to it.
    var n = layers().length || 1, k = idx(Land.layer());
    if (!st.drag && !st.tween && front() !== k) { turnTo(k, null); }
    if (st.tween) {
      var q = Math.min(1, (now - st.tween.at) / st.tween.dur), e = 1 - Math.pow(1 - q, 3);
      st.turn = st.tween.from + (st.tween.to - st.tween.from) * e;
      if (q >= 1) { st.turn = mod(st.tween.to, n); st.tween = null; }
      st.key = "";
    }
    // The layer's years, when the dial is on time and the layer changes.
    if (st.fn === "time" && st.spanFor !== Land.layer()) {
      st.spanFor = Land.layer();
      st.span = Land.layerYears ? Land.layerYears() : null;
      setT(1);
    }
    size();
    var G = geom(w);
    st.G = G;
    var key = [G.cx.toFixed(1), G.cy.toFixed(1), G.r.toFixed(1), G.over, st.alpha.toFixed(2), st.turn.toFixed(3), st.fn, st.t.toFixed(4),
               Land.layer(), window.innerWidth, window.innerHeight].join("|");
    if (key !== st.key) { st.key = key; draw(G); }
    placeUI(G, st.alpha > 0.5);
  }
  st.turn = idx(Land.layer ? Land.layer() : "");
  crownWords();
  rangeFor();
  requestAnimationFrame(frame);

  window.GlobeDial = {
    state: function () {
      var L = layers();
      return { fn: st.fn, front: L[front()] ? L[front()].key : null, turn: st.turn, t: st.t, year: Land.globeYear(), span: st.span,
               ring: st.G, alpha: st.alpha, labels: st.labels.map(function (o) { return { k: o.k, th: o.th }; }) };
    },
    fn: function (f) { if (f) { setFn(f); } return st.fn; },
    turnTo: function (key) { turnTo(idx(key), null); },
    year: function (y) { if (st.fn !== "time") { setFn("time"); } setT(uOf(y)); return Land.globeYear(); }
  };
})();

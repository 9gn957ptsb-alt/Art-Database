/* The transport — the dial plays every path.

   The artist, 3 Oct 2026, of the box a played life left over its picture
   ("1 of 2 · Dakar · 1965 / Saint-Louis — / … / End"): "There's a small box
   that shows up sometimes like this, I don't quite find it useful at all and
   it's just annoying and hard to get rid of. Incorporate the resume and pause
   function into the dial. The dial isn't quite as functional as I want it to
   be. It should be the instrument of the website and used to navigate paths
   of explorations by effectively putting time at the viewers fingertips."
   The design: docs/v2/DIAL.md, "The transport".

   Every way of playing a path — a walk (walks.js), an exploration of any kind
   (explorations.js: hunts, a viewer's own, relays, sites, studios, a life
   played, a movement walked, a voice's route), a voice's words in a city
   (voices.js), the corpse's unfolding (corpse.js) — registers itself here
   (Dial.path) and is driven from the dial:

   - its stops are marks outside the ring, where the chronograph's scale was:
     at their years where they have them (on the view's own years when they
     fall within them), else in order, evenly; passed ones lit, the one being
     read a tile of pixel light;
   - the face (the year) carries the glyph of what a tap does — pause, play,
     or under reduced motion the next stop — and says "paused" when it is; a
     tap on it pauses or resumes at once, waiting out the double tap's window
     only while the dial stands away from home (where two taps send it home);
     dragging the face still carries it; holding it still ends the path;
   - turning the ring scrubs the path: a box glides from stop to stop under
     the hand and the readout names it; letting go goes there, playing on if
     it was playing, held there if it was paused; a tap on a stop's mark is a
     turn to it; a wheel over it steps stop to stop; holding a finger still
     on the ring still lifts the dial to be carried;
   - on the dial's range, Space plays or pauses and the arrows step stop to
     stop (they turn the years when nothing plays);
   - a small × at its rim ends the path; going up to the world still does;
   - playing, the comet's tail behind the handle runs with light; paused it
     stills, and the way come dims a step.

   What the strips said is the readout's, beside the dial where the hub's
   readout lives (never over the picture, the lens or the picture's sentence;
   hidden while the picture fills the screen): the count and the place, the
   line being said, the newest line of the sentence (a press on the count
   opens the whole), and at the end the doors (the relay's hand-offs, Keep,
   Share). The modules build those lines as before and hand the element here
   (Dial.read); this module places it. The hand-offs are also marks on the
   band: in the view's dial its Explore mode (dialhub.js), on the path's own
   dial at the end of its ring.

   Where no view's dial shows (a journey, a museum without years, the world),
   the path has a dial of its own where the view's last stood. */
(function () {
  "use strict";

  var TAU = Math.PI * 2, RAD = Math.PI / 180;
  var GAP = 18 * RAD, START = -Math.PI / 2 + GAP / 2, SWEEP = TAU - GAP;
  var LILAC = "#9d95e6", LIGHT = "#5e52c7", CREAM = "#eadfcd", SAND = "#a8927a";
  var AMBER = "#d9a55b", SEA = "#8fc7bd", ROSE = "#c98fb5";
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAP_MS = 330;                     // the double tap's window, waited out only while the dial is away from home
  var OWN_AFTER = 900;                  // no view's dial this long: the path's own dial stands in
  var HOLD_SHOW = 260, HOLD_END = 1100; // holding the face still: the ring of light from here, the path ends here
  var FLOW_FPS = 12;                    // the comet's tail runs with light in held frames, the pixel light's way
  var PLACE_MS = 140;                   // the readout is placed at most this often (and at once on a change)

  var stack = [];                       // the paths playing, the last on top (a walk inside an exploration)
  var last = null;                      // the path just ended, kept while its readout is up
  var reads = [];                       // the readout elements handed here: { el, join }, the newest last
  var offerList = null, offerVer = 0;   // the relay's hand-offs where a path ended
  var host = null, noViewSince = 0, seat = null;
  var box = null, legend = null, endBtn = null;
  var own = null, ownBox = null, ownRange = null, ownYear = null, ownSpan = null;
  var drag = null, preview = -1, pv = -1, wheelAcc = 0, tapT = 0, raf = 0, posCache = { key: "", P: null };
  var hold = null, holdEnded = false, placedAt = 0, placedKey = "", lastPlace = null, keysOn = false, keysHost = null, placedOnce = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function top() { return stack.length ? stack[stack.length - 1] : null; }
  function shown(e) { return !!e && !e.hidden && e.childNodes.length > 0; }
  function dialsAll() { return window.Land && Land.dials ? Land.dials() : []; }
  function fullNow() { var a = document.querySelector(".art[data-full]"); return !!a; }
  // The picture standing alone — a work's first look, or filling the screen: nothing of the path floats
  // over it; the dial and its readout come back with the view's own.
  function aloneNow() { return fullNow() || !!document.querySelector(".art[data-on=\"true\"][data-look=\"plate\"]"); }
  function picRect() {
    // The reading layout's picture, else the place, then's (placethen.js); with its wall label, which touches it.
    var pic = document.getElementById("art-plate");
    if (!pic || !visibleBox(pic)) { pic = document.querySelector(".pt-picbox"); }
    if (!pic || !visibleBox(pic)) { return null; }
    var r = pic.getBoundingClientRect();
    var lab = document.querySelector(".art > .wall-label.wl-plate[data-on]:not([hidden])");
    if (lab && pic.id === "art-plate" && visibleBox(lab)) {
      var l = lab.getBoundingClientRect();
      r = { left: Math.min(r.left, l.left), top: Math.min(r.top, l.top), right: Math.max(r.right, l.right), bottom: Math.max(r.bottom, l.bottom) };
      r.width = r.right - r.left; r.height = r.bottom - r.top;
    }
    return r.width && r.height ? r : null;
  }
  function hits(a, b) { return !!(a && b && a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom); }
  // Where the path's own dial stands: where the view's last stood, else its corner; never on the picture
  // (nowhere clear, it waits unseen and the path plays on). A dial the viewer has put somewhere is theirs.
  function ownSpot() {
    if (ownBox.dataset.moved) { return "moved"; }
    var W = window.innerWidth, H = window.innerHeight, S = W <= 720 ? 136 : 168, pr = picRect();
    var corner = W <= 720 ? { left: W - 12 - S, top: H - 96 - S } : { left: W - 24 - S, top: H - 24 - S };
    corner.right = corner.left + S; corner.bottom = corner.top + S;
    var at = seat ? { left: seat.x, top: seat.y, right: seat.x + S, bottom: seat.y + S } : null;
    if (at && !hits(at, pr)) { return "seat"; }
    return hits(corner, pr) ? null : "corner";
  }

  /* ---- what is registered ------------------------------------------------------ */

  function path(spec) {
    spec = spec || {};
    var p = {
      kind: spec.kind || "", title: spec.title || "", stops: norm(spec.stops),
      at: spec.at || 0, paused: !!spec.paused, read: spec.read || null, alive: true, ver: 0,
      onSeek: spec.onSeek || null, onToggle: spec.onToggle || null, onEnd: spec.onEnd || null, onNext: spec.onNext || null
    };
    stack.push(p);
    last = null;
    setOffers(null);
    if (p.read) { read(p.read); }
    kick(true);
    return {
      set: function (o) {
        if (!o || !p.alive) { return; }
        if (o.stops) { p.stops = norm(o.stops); }
        if (o.at !== undefined && o.at !== p.at) {
          p.at = o.at;
          // A played step brings its work into the picture's place, never left full screen.
          letDown();
        }
        if (o.paused !== undefined) { p.paused = !!o.paused; }
        if (o.title !== undefined) { p.title = o.title; }
        p.ver += 1;
        kick(true);
      },
      close: function () { close(p); },
      alive: function () { return p.alive; }
    };
  }
  function norm(stops) {
    return (stops || []).map(function (s) {
      var y = s && isFinite(s.y) && s.y > 0 ? Math.round(s.y) : null;
      return { y: y, label: s && s.label || "" };
    });
  }
  function close(p) {
    if (!p.alive) { return; }
    p.alive = false;
    var k = stack.indexOf(p);
    if (k >= 0) { stack.splice(k, 1); }
    if (!stack.length) { last = p; }
    preview = -1;
    pv = -1;
    drag = null;
    cancelHold();
    kick(true);
  }
  function letDown() { if (window.Land && Land.full && fullNow()) { Land.full(false); } }

  // A module's readout (its lines, its doors): placed beside the dial. `join`: said under the playing
  // path's own lines (a voice's words while a route is played), not in place of them.
  function read(e, opts) {
    if (!e) { return; }
    setUp();
    var join = !!(opts && opts.join);
    reads = reads.filter(function (r) { return r.el !== e; });
    reads.push({ el: e, join: join });
    if (e.parentNode !== box) { box.insertBefore(e, legend); }
    kick(true);
  }

  // The hand-offs where a path ended (explorations.js): doors in the readout (the module's own
  // element) and marks on the band — the view's dial in its Explore mode, the path's own dial at the
  // end of its ring. Each: { kind, y, label, open }.
  function setOffers(list) {
    var had = !!(offerList && offerList.length);
    offerList = list && list.length ? list.slice(0, 3) : null;
    offerVer += 1;
    if (window.DialHub && DialHub.refresh) { DialHub.refresh(); }
    // Gone with their readout: the band goes back to what it was about, unless the viewer turned it.
    if (had && !offerList && modeWas && window.DialHub && DialHub.view && DialHub.view() === modeWas.view &&
        DialHub.mode() === "explore") { DialHub.setMode(modeWas.mode); }
    if (!offerList) { modeWas = null; }
    if (had || offerList) { kick(true); }
  }
  // The hand-offs on a view's dial: its band turned to Explore, once for each view they are shown in
  // (a mode the viewer turns to after is theirs).
  var offerShownIn = "", modeWas = null;
  function offersOnBand() {
    if (!offerList || !host || host === own || !window.DialHub || !DialHub.setMode || !DialHub.view) { return; }
    var v = DialHub.view(), k = offerVer + "|" + v;
    if (v && offerShownIn !== k) {
      offerShownIn = k;
      if (DialHub.mode() !== "explore") { modeWas = { view: v, mode: DialHub.mode() }; }
      DialHub.setMode("explore");
    }
  }

  /* ---- the readout's box and the path's own dial ----------------------------------- */

  function setUp() {
    if (box) { return; }
    box = el("section", "path-read");
    box.setAttribute("aria-label", "The path");
    box.hidden = true;
    legend = el("p", "path-legend");
    box.appendChild(legend);
    // A press on the readout's lines (the count, the line said, the sentence) opens the whole sentence,
    // and closes it; its doors are their own.
    box.addEventListener("click", function (event) {
      var t = event.target;
      if (t && t.closest && !t.closest("button, input, a") && t.closest(".walk-progress, .walk-said, .walk-lines, .voice-strip-head")) {
        if (box.dataset.open) { delete box.dataset.open; } else { box.dataset.open = "true"; }
        kick(true);
      }
    });
    ["pointerdown", "wheel", "touchstart"].forEach(function (t) {
      box.addEventListener(t, function (event) { event.stopPropagation(); }, { passive: true });
    });
    document.body.appendChild(box);
    endBtn = el("button", "dial-end", "×");
    endBtn.type = "button";
    endBtn.setAttribute("aria-label", "End the path");
    endBtn.title = "End the path";
    endBtn.hidden = true;
    endBtn.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    endBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      event.preventDefault();
      endTop();
    });
  }

  function endTop() {
    var p = top();
    if (p && p.onEnd) { p.onEnd(); }
    if (p && p.alive) { close(p); }
    kick(true);
  }

  function ownDial() {
    if (own || !window.Land || !Land.makeDial) { return own; }
    ownBox = el("div", "building-time path-time");
    ownBox.hidden = true;
    ownYear = el("span", "building-time-year");
    ownYear.setAttribute("aria-hidden", "true");
    ownRange = el("input", "building-time-range");
    ownRange.type = "range";
    ownRange.min = "0";
    ownRange.max = "1000";
    ownRange.step = "1";
    ownRange.value = "0";
    ownRange.setAttribute("aria-label", "The path: Space to play or pause, the arrows from stop to stop");
    ownBox.appendChild(ownYear);
    ownBox.appendChild(ownRange);
    document.body.appendChild(ownBox);
    own = Land.makeDial(ownBox, ownRange, function () { return ownSpan; }, null) || null;
    return own;
  }

  function visibleBox(b) {
    if (!b || b.hidden || !b.offsetWidth) { return false; }
    var cs = window.getComputedStyle(b);
    if (cs.visibility === "hidden" || cs.display === "none") { return false; }
    for (var e = b.parentElement; e && e !== document.body; e = e.parentElement) {
      if (e.hidden || window.getComputedStyle(e).visibility === "hidden") { return false; }
    }
    return true;
  }

  // The dial the path plays on: the view's own where one shows (the art view's first), else its own.
  function viewDial() {
    var best = null;
    dialsAll().forEach(function (d) {
      if (d === own || !visibleBox(d.box)) { return; }
      if (!best || d.box.id === "art-time") { best = d; }
    });
    return best;
  }

  /* ---- where each stop is on the ring ---------------------------------------------- */

  // At their years where every stop has one and no two fall together (on the view's years when they
  // fall within them), else in order, evenly.
  function positions(p, d) {
    var span = d && d !== own && d.span ? d.span() : null;
    var key = p.ver + "|" + p.stops.length + "|" + (span ? span[0] + "," + span[1] : "") + "|" + (d === own);
    if (posCache.p === p && posCache.key === key) { return posCache.P; }
    var ys = p.stops.map(function (s) { return s.y; });
    var dated = ys.length > 1 && ys.every(function (y) { return y !== null; });
    var P = null, n = p.stops.length;
    function apart(pos) {
      var s = pos.slice().sort(function (a, b) { return a - b; });
      for (var i = 1; i < s.length; i += 1) { if (s[i] - s[i - 1] < 0.006) { return false; } }
      return true;
    }
    if (dated && span && span[1] > span[0] && ys.every(function (y) { return y >= span[0] - 0.5 && y <= span[1] + 0.5; })) {
      var pv0 = ys.map(function (y) { return Math.max(0, Math.min(1, (y + 0.5 - span[0]) / (span[1] - span[0]))); });
      if (apart(pv0)) { P = { by: "view", pos: pv0 }; }
    }
    if (!P && dated) {
      var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
      var py = hi > lo ? ys.map(function (y) { return (y - lo) / (hi - lo); }) : null;
      if (py && apart(py)) { P = { by: "years", pos: py, lo: lo, hi: hi }; }
    }
    if (!P) { P = { by: "order", pos: p.stops.map(function (s, i) { return n < 2 ? 0.5 : i / (n - 1); }) }; }
    posCache = { p: p, key: key, P: P };
    return P;
  }

  function nearest(P, t) {
    var best = -1, bd = Infinity;
    P.pos.forEach(function (q, i) { var dd = Math.abs(q - t); if (dd < bd - 1e-9) { bd = dd; best = i; } });
    return best;
  }

  function tOf(d, event) {
    var r = d.face.getBoundingClientRect();
    var a = Math.atan2(event.clientY - r.top - r.height / 2, event.clientX - r.left - r.width / 2);
    var rel = ((a - START) % TAU + TAU) % TAU;
    return rel <= SWEEP ? rel / SWEEP : (rel - SWEEP < GAP / 2 ? 1 : 0);
  }

  /* ---- what land.js asks (the dial's drawing and its presses) ----------------------- */

  function current() {
    var p = top();
    if (p) { return p; }
    if (last && last.read && shown(last.read)) { return last; }
    if (last) { last = null; setOffers(null); }
    return null;
  }

  // The hand-offs as glyphs, each kind its own (DIAL.md, "the marks by kind").
  var GLYPH = { h: [AMBER, "square"], w: [LILAC, "dot"], v: [ROSE, "tick"], s: [SEA, "hollow"], o: [CREAM, "atelier"],
                m: [LILAC, "diamond"], l: [CREAM, "round"], k: [CREAM, "dot"], x: [CREAM, "dot"] };
  function glyph(g, kind, x, y, a, s) {
    var k = GLYPH[kind] || GLYPH.x, h = 2.5 * s;
    g.fillStyle = k[0];
    g.strokeStyle = k[0];
    g.lineWidth = 1.25;
    switch (k[1]) {
      case "dot": g.beginPath(); g.arc(x, y, h, 0, TAU); g.fill(); break;
      case "tick":
        g.beginPath();
        g.moveTo(x - Math.cos(a) * 3.5 * s, y - Math.sin(a) * 3.5 * s);
        g.lineTo(x + Math.cos(a) * 3.5 * s, y + Math.sin(a) * 3.5 * s);
        g.stroke();
        break;
      case "hollow": g.strokeRect(x - h, y - h, 2 * h, 2 * h); break;
      case "atelier": g.strokeRect(x - h - 0.5, y - h - 0.5, 2 * h + 1, 2 * h + 1); g.fillRect(x - 1, y - 1, 2, 2); break;
      case "diamond": g.beginPath(); g.moveTo(x, y - h - 1); g.lineTo(x + h + 1, y); g.lineTo(x, y + h + 1); g.lineTo(x - h - 1, y); g.closePath(); g.fill(); break;
      case "round": g.beginPath(); g.arc(x, y, h, 0, TAU); g.stroke(); break;
      default: g.fillRect(x - h, y - h, 2 * h, 2 * h);
    }
  }
  // On the path's own dial the hand-offs stand at the end of its ring, one under another toward the face.
  function offerSpots(p, d) {
    if (d !== own || !offerList || p.alive) { return []; }
    var P = positions(p, d), at = P.pos.length ? P.pos[P.pos.length - 1] : 1;
    var a = START + at * SWEEP, S = d.box.offsetWidth || 136, c = S / 2, R1 = S / 2 - 13;
    return offerList.map(function (o, i) {
      var r = R1 - 18 - i * 9;
      return { o: o, a: a, x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
    });
  }

  function holdK() {
    if (!hold) { return 0; }
    var k = (performance.now() - hold.t0 - HOLD_SHOW) / (HOLD_END - HOLD_SHOW);
    return Math.max(0, Math.min(1, k));
  }

  function layer(d) {
    var p = current();
    if (!p || d !== host) { return null; }
    var P = positions(p, d), ended = !p.alive;
    var flowing = !ended && !p.paused && !still && !drag;
    var flow = flowing ? Math.floor(performance.now() / (1000 / FLOW_FPS)) % 24 / 24 : -1;
    var hk = hold && hold.d === d ? Math.round(holdK() * 40) / 40 : 0;
    var spots = offerSpots(p, d);
    return {
      key: ["tp", p.ver, p.at, p.paused, ended, preview, pv >= 0 ? pv.toFixed(3) : "", P.by, P.pos.length, still, flow, hk,
            spots.length, offerVer].join(","),
      dim: p.paused && !ended,
      flow: flow,
      outer: function (g, c, R1) {
        var R = R1 + 8;
        g.save();
        g.strokeStyle = "rgba(168, 146, 122, " + (p.paused && !ended ? 0.14 : 0.22) + ")";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(c, c, R, START, START + SWEEP);
        g.stroke();
        P.pos.forEach(function (q, i) {
          var a = START + q * SWEEP, x = c + Math.cos(a) * R, y = c + Math.sin(a) * R;
          var cur = i === p.at && !ended, done = ended || i < p.at;
          var s = cur ? 6 : 3.5;
          if (cur) {
            g.shadowColor = LIGHT;
            g.shadowBlur = p.paused ? 0 : 9;
            g.fillStyle = p.paused ? LILAC : "#ffffff";
          } else {
            g.shadowBlur = 0;
            g.fillStyle = done ? "rgba(234, 223, 205, 0.88)" : "rgba(168, 146, 122, 0.5)";
          }
          g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
          if (cur) {
            g.shadowBlur = 0;
            g.fillStyle = p.paused ? "rgba(157, 149, 230, 0.55)" : LIGHT;
            [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (o) { g.fillRect(Math.round(x + o[0] * 6 - 1), Math.round(y + o[1] * 6 - 1), 2, 2); });
          }
        });
        // The scrub: a box gliding from stop to stop under the hand.
        if (pv >= 0 && preview >= 0) {
          var ap = START + pv * SWEEP, bx = c + Math.cos(ap) * R, by = c + Math.sin(ap) * R;
          g.shadowBlur = 0;
          g.strokeStyle = LILAC;
          g.lineWidth = 1.25;
          g.strokeRect(Math.round(bx - 5.5) + 0.5, Math.round(by - 5.5) + 0.5, 10, 10);
        }
        g.restore();
      },
      // Where the span was: the glyph of what a tap on the face does, and "paused" when it is.
      face: function (g, c, S) {
        var R1 = S / 2 - 13;
        // Held still: a ring of light closes round the face; full, the path ends.
        if (hk > 0) {
          g.save();
          g.strokeStyle = LILAC;
          g.lineWidth = 2;
          g.shadowColor = LIGHT;
          g.shadowBlur = still ? 0 : 6;
          g.beginPath();
          g.arc(c, c, S * 0.3, -Math.PI / 2, -Math.PI / 2 + hk * TAU);
          g.stroke();
          g.restore();
        }
        spots.forEach(function (sp, i) { g.save(); g.globalAlpha = 0.95; glyph(g, sp.o.kind, sp.x, sp.y, sp.a, i ? 1 : 1.2); g.restore(); });
        var can = !ended && (p.onToggle || (still && (p.onNext || p.onSeek)));
        if (!can) { return; }
        var u = Math.max(2, Math.round(S * 0.019)), y = c + S * 0.15;
        var word = still ? (p.at + 1 < p.stops.length ? "next" : "end") : p.paused ? "paused" : "";
        var fs = Math.max(8, Math.round(S * 0.058));
        g.save();
        g.font = fs + "px " + (getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace").trim();
        var gw = still ? 3 * u : p.paused ? 4 * u : 5 * u, tw = word ? g.measureText(word).width : 0, gap = word ? 4 : 0;
        var x0 = c - (gw + gap + tw) / 2;
        g.fillStyle = p.paused || still ? LILAC : CREAM;
        if (still) {
          // The next stop's: a chevron of tiles.
          [[0, -3], [1, -2], [2, -1], [3, 0], [2, 1], [1, 2], [0, 3]].forEach(function (o) {
            g.fillRect(Math.round(x0 + o[0] * u * 0.75), Math.round(y + o[1] * u - u / 2), u, u);
          });
        } else if (p.paused) {
          // Play: a triangle built of tiles.
          for (var r = -3; r <= 3; r += 1) {
            var w = 4 - Math.abs(r);
            g.fillRect(Math.round(x0), Math.round(y + r * u - u / 2), w * u, u);
          }
        } else {
          // Pause: two bars.
          g.fillRect(Math.round(x0), Math.round(y - 3.5 * u), 2 * u, 7 * u);
          g.fillRect(Math.round(x0 + 3 * u), Math.round(y - 3.5 * u), 2 * u, 7 * u);
        }
        if (word) {
          g.textAlign = "left";
          g.textBaseline = "middle";
          g.fillText(word, x0 + gw + gap, y + 0.5);
        }
        g.restore();
        void R1;
      }
    };
  }

  // Turned to stop i: there, playing on (play) or held there (paused).
  function seek(i, play) {
    var p = top();
    if (!p || !p.stops.length) { return; }
    i = Math.max(0, Math.min(p.stops.length - 1, i));
    if (play === undefined) { play = !p.paused; }
    if (i === p.at && (play ? !p.paused : p.paused)) { return; }
    letDown();
    if (p.onSeek) { p.onSeek(i, !!play); }
    kick(true);
  }

  function toggle() {
    var p = top();
    if (!p) { return; }
    if (still) {
      if (p.onNext) { p.onNext(); }
      else if (p.at + 1 < p.stops.length) { seek(p.at + 1, true); }
      else { endTop(); }
      kick(true);
      return;
    }
    if (p.onToggle) { p.onToggle(); }
    kick(true);
  }

  // A press on the ring while a path plays: claimed (the scrub) unless it is inside the band (the hub's,
  // or on the path's own dial the hand-offs at the end of its ring).
  function ring(d, phase, event) {
    var p = top();
    if (phase === "down") {
      var cur = current();
      var r = d.face.getBoundingClientRect();
      var dx = event.clientX - r.left, dy = event.clientY - r.top;
      var dist = Math.hypot(dx - r.width / 2, dy - r.height / 2);
      if (cur && d === host && d === own && offerList && !cur.alive) {
        var hitO = null;
        offerSpots(cur, d).forEach(function (sp) { if (Math.hypot(sp.x - dx, sp.y - dy) < 12 && !hitO) { hitO = sp.o; } });
        if (hitO) { drag = { d: d, offer: hitO }; return true; }
      }
      if (!p || d !== host || !p.onSeek) { return false; }
      // The band inside the ring is the hub's on a view's dial; the path's own dial is all the path's.
      if (d !== own && dist < r.width / 2 - 13 - 9) { return false; }
      try { d.face.setPointerCapture(event.pointerId); } catch (e) { /* fine */ }
      drag = { d: d, was: !p.paused, x: event.clientX, y: event.clientY };
      d.box.dataset.turning = "true";
      var P = positions(p, d);
      preview = nearest(P, tOf(d, event));
      pv = P.pos[p.at] !== undefined ? P.pos[p.at] : P.pos[preview];
      kick(true);
      return true;
    }
    if (phase === "wheel") {
      if (!p || d !== host || !p.onSeek) { return false; }
      wheelAcc += event.deltaY + event.deltaX;
      if (Math.abs(wheelAcc) >= 60) {
        var dir = wheelAcc > 0 ? 1 : -1;
        wheelAcc = 0;
        seek(p.at + dir);
      }
      return true;
    }
    if (!drag) { return true; }
    if (drag.offer) {
      if (phase === "move") { return true; }
      var o = drag.offer;
      drag = null;
      if (phase === "up" && o.open) { o.open(); }
      return true;
    }
    if (phase === "move") {
      if (p) { preview = nearest(positions(p, drag.d), tOf(drag.d, event)); }
      kick(true);
      return true;
    }
    delete drag.d.box.dataset.turning;
    var was = drag.was;
    drag = null;
    var to = preview;
    preview = -1;
    pv = -1;
    if (phase === "up" && p && to >= 0) { seek(to, was); }
    kick(true);
    return true;
  }

  // One tap on the face: play or pause — at once while the dial is home, after the double tap's window
  // while it stands away (two taps there send it home). Two taps at home are two taps.
  function faceTap(d, single) {
    window.clearTimeout(tapT);
    if (holdEnded) { holdEnded = false; return; }
    if (d !== host || !top()) { return; }
    var away = !!d.box.dataset.moved;
    if (!away) { toggle(); return; }
    if (single) { tapT = window.setTimeout(toggle, TAP_MS); }
  }

  // Holding the face still ends the path (the × at the rim does the same).
  function hook(d) {
    if (d.tpHooked || !d.face) { return; }
    d.tpHooked = true;
    d.face.addEventListener("pointerdown", function (event) {
      holdEnded = false;
      cancelHold();
      var p = top();
      if (!p || !p.alive || d !== host || !d.down || !d.down.inner) { return; }
      hold = { d: d, x: event.clientX, y: event.clientY, t0: performance.now() };
      hold.timer = window.setTimeout(function () {
        if (!hold || hold.d !== d) { return; }
        hold = null;
        holdEnded = true;
        window.clearTimeout(tapT);
        endTop();
      }, HOLD_END);
      kick(true);
    });
    d.face.addEventListener("pointermove", function (event) {
      if (hold && hold.d === d && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 6) { cancelHold(); }
    });
    ["pointerup", "pointercancel"].forEach(function (t) {
      d.face.addEventListener(t, function () { if (hold && hold.d === d) { cancelHold(); } });
    });
  }
  function cancelHold() {
    if (!hold) { return; }
    window.clearTimeout(hold.timer);
    var d = hold.d;
    hold = null;
    if (d) { d.drawn = ""; }
    kick(true);
  }

  // Inside the dial or its readout: not a press that takes over the path.
  function owns(t) {
    if (!t || !t.closest) { return false; }
    if (box && box.contains(t)) { return true; }
    return !!t.closest(".building-time.dial");
  }

  document.addEventListener("keydown", function (event) {
    var p = top();
    if (!p || !host || event.target !== host.range || event.metaKey || event.ctrlKey || event.altKey) { return; }
    var k = event.key;
    if (k === " " || k === "Spacebar") {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggle();
      return;
    }
    if (event.shiftKey || !p.onSeek) { return; }
    var dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[k];
    if (!dir) { return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    seek(p.at + dir);
  }, true);

  /* ---- while something is up: the host, the own dial, the readout ------------------- */

  function kick(now) {
    if (now) { placedAt = 0; }
    if (!raf) { raf = window.requestAnimationFrame(frame); }
  }

  function frame() {
    raf = 0;
    setUp();
    var p = current();
    var full = aloneNow();
    dialsAll().forEach(hook);
    // The readout: the playing path's own lines, and under them any joined to it; the rest wait.
    var primary = p && p.read && shown(p.read) ? p.read : null;
    if (!primary) {
      for (var i = reads.length - 1; i >= 0 && !primary; i -= 1) { if (!reads[i].join && shown(reads[i].el)) { primary = reads[i].el; } }
    }
    var showing = [];
    if (primary) { showing.push(primary); }
    reads.forEach(function (r) { if (r.join && shown(r.el) && showing.indexOf(r.el) < 0) { showing.push(r.el); } });
    reads.forEach(function (r) { if (showing.indexOf(r.el) >= 0) { delete r.el.dataset.behind; } else { r.el.dataset.behind = "true"; } });
    if (showing.length > 1) { box.dataset.joined = "true"; } else { delete box.dataset.joined; }
    // The host: the view's dial, else (after a moment with none) the path's own.
    var vd = viewDial(), now = performance.now();
    if (host && ((drag && drag.d === host) || (hold && hold.d === host)) && (host === own || visibleBox(host.box))) {
      // Never taken from under the hand: the dial being turned or held stays the instrument.
    } else if (vd) {
      noViewSince = 0;
      host = vd;
      // Where the view's dial stood: the path's own stands there, so the instrument does not jump.
      var vr = vd.box.getBoundingClientRect();
      if (vr.width) { seat = { x: vr.left, y: vr.top }; }
    }
    else if (!p) { host = null; }
    else {
      if (!noViewSince) { noViewSince = now; }
      // A moment between two views (a dial hidden while it flies) is waited out before its own stands in.
      host = host === own || now - noViewSince > OWN_AFTER ? ownDial() : null;
    }
    if (own) {
      // The picture standing alone hides it, as it hides the view's.
      var spot = host === own && !!p && !full ? ownSpot() : null;
      var useOwn = !!spot;
      if (ownBox.hidden === useOwn) { ownBox.hidden = !useOwn; own.drawn = ""; }
      if (useOwn && spot !== "moved") {
        if (spot === "seat" && seat) {
          ownBox.style.setProperty("--x", Math.round(seat.x) + "px");
          ownBox.style.setProperty("--y", Math.round(seat.y) + "px");
          if (ownBox.dataset.seat !== "view") { ownBox.dataset.seat = "view"; }
        } else if (ownBox.dataset.seat) { delete ownBox.dataset.seat; }
      }
      if (useOwn) {
        var P = positions(p, own);
        ownSpan = P.by === "years" ? [P.lo, P.hi] : null;
        var st = p.stops[p.at] || {};
        var yr = st.y ? String(st.y) : p.stops.length ? (Math.min(p.at, p.stops.length - 1) + 1) + "/" + p.stops.length : "";
        if (ownYear.textContent !== yr) { ownYear.textContent = yr; }
        var v = String(Math.round((P.pos[p.at] !== undefined ? P.pos[p.at] : 0) * 1000));
        if (ownRange.value !== v && own.grab === null) { ownRange.value = v; }
      }
    }
    // Marks on every dial: which one plays the path.
    dialsAll().forEach(function (d) {
      var on = !!p && d === host, rd = on && showing.length > 0;
      var state = on ? (!p.alive ? "ended" : p.paused ? "paused" : "playing") : "";
      if (state) { if (d.box.dataset.path !== state) { d.box.dataset.path = state; } } else if (d.box.dataset.path) { delete d.box.dataset.path; }
      if (rd) { d.box.dataset.pathRead = "true"; } else if (d.box.dataset.pathRead) { delete d.box.dataset.pathRead; }
    });
    offersOnBand();
    // The keys go with the instrument: played from the keyboard, the dial taking over keeps them.
    var live = top();
    var idle = !document.activeElement || document.activeElement === document.body;
    if (live && host && keysOn && host !== keysHost && idle) {
      try { host.range.focus({ preventScroll: true }); } catch (e) { /* fine */ }
    }
    if (live && host) {
      if (document.activeElement === host.range) { keysOn = true; keysHost = host; }
      else if (host === keysHost) { keysOn = false; }
    } else if (!live) { keysOn = false; keysHost = null; }
    // The × at the rim, while a path plays.
    if (live && host) {
      if (endBtn.parentNode !== host.box) { host.box.appendChild(endBtn); }
      endBtn.hidden = false;
      endBtn.setAttribute("aria-label", "End " + (live.title || "the path"));
      // Wholly on the screen: a dial at the edge brings it in.
      var er = endBtn.getBoundingClientRect(), shift = endBtn._shift || 0;
      var over = Math.max(0, er.right + shift - (window.innerWidth - 4)) - Math.max(0, 4 - (er.left + shift));
      if (er.width && over !== shift) { endBtn._shift = over; endBtn.style.transform = over ? "translateX(" + (-over) + "px)" : ""; }
    } else { endBtn.hidden = true; }
    if (host && live) {
      var R = host.range;
      if (R && R.dataset.tpLabel === undefined) { R.dataset.tpLabel = R.getAttribute("aria-label") || ""; }
      var lab = (live.title || "The path") + ", stop " + (live.at + 1) + " of " + live.stops.length + (live.paused ? ", paused" : "") +
        ". Space: " + (still ? "the next stop" : "play or pause") + "; arrows: stop to stop.";
      if (R && R.getAttribute("aria-label") !== lab) { R.setAttribute("aria-label", lab); }
    }
    dialsAll().forEach(function (d) {
      if ((!live || d !== host) && d.range && d.range.dataset.tpLabel !== undefined) {
        d.range.setAttribute("aria-label", d.range.dataset.tpLabel);
        delete d.range.dataset.tpLabel;
      }
    });
    // The scrub's box glides to the stop under the hand.
    var gliding = false;
    if (preview >= 0 && p && host) {
      var Pp = positions(p, host), target = Pp.pos[preview];
      if (target !== undefined) {
        if (pv < 0 || still) { pv = target; }
        else { pv += (target - pv) * 0.38; if (Math.abs(target - pv) < 0.0015) { pv = target; } else { gliding = true; } }
      }
    }
    // The readout: hidden while the picture stands alone (nothing floats over the picture), and while the
    // path's own dial waits unseen (the readout lives beside the dial).
    var noDial = !!p && host === own && (!own || ownBox.hidden);
    box.hidden = !showing.length || full || noDial;
    if (!box.hidden) {
      var focused = host && document.activeElement === host.range && p;
      var P2 = p && host ? positions(p, host) : null;
      var leg = focused && P2 && p.alive ? (still ? "The face: the next stop" : "The face: play or pause, held: end") + " · the ring: its stops " +
        (P2.by === "order" ? "in order — no years to place them" : "by their years") + " · ←/→ stop to stop · Space" : "";
      if (legend.textContent !== leg) { legend.textContent = leg; }
      legend.hidden = !leg;
      var pre = "";
      if (hold && holdK() > 0 && live) { pre = "Hold to end · " + (live.title || "the path"); }
      else if (preview >= 0 && p && p.stops[preview]) {
        pre = "→ " + (preview + 1) + " of " + p.stops.length + (p.stops[preview].label ? " · " + p.stops[preview].label : "") +
          (p.stops[preview].y ? " · " + p.stops[preview].y : "");
      }
      if (pre) { if (box.dataset.preview !== pre) { box.dataset.preview = pre; } } else if (box.dataset.preview) { delete box.dataset.preview; }
      var lifted = host && (host.box.dataset.lifted || host.box.dataset.settling);
      var pk = [window.innerWidth, window.innerHeight, showing.length, box.dataset.open || "", pre ? 1 : 0, legend.hidden,
                host ? host.box.getBoundingClientRect().left + "," + host.box.getBoundingClientRect().top : ""].join("|");
      // Between two views of a path (no dial yet) it keeps where it was, once placed.
      if ((host || !placedOnce || !p) && (lifted || pk !== placedKey || now - placedAt > PLACE_MS)) {
        placedAt = now;
        placedKey = pk;
        placedOnce = true;
        placeRead(host);
      }
    }
    var busy = !!drag || gliding || !!hold || !!(host && (host.box.dataset.lifted || host.box.dataset.settling));
    if (busy) { raf = window.requestAnimationFrame(frame); }
  }

  /* Beside the dial where the hub's readout lives: on a phone at its side, else under it (above it near
     the foot); never over the picture, the lens, the picture's sentence or the banner, nor off the
     screen. Each side is tried at the width it allows; the one that covers least of what is read wins. */
  function placeRead(d) {
    var W = window.innerWidth, H = window.innerHeight, phone = W <= 720;
    var a;
    if (d && visibleBox(d.box)) { a = d.box.getBoundingClientRect(); }
    else {
      var S = phone ? 136 : 168;
      a = phone ? { left: W - 12 - S, top: H - 96 - S, width: S, height: S } : { left: W - 24 - S, top: H - 24 - S, width: S, height: S };
      a.right = a.left + S; a.bottom = a.top + S;
    }
    // What it must not cover, and how much each matters (the picture never).
    var avoid = [];
    function keep(r, w, round, isPic) {
      if (!r || !(r.width > 0) || !(r.height > 0)) { return; }
      // A round window's rim reaches past its square.
      if (round) { r = { left: r.left - 14, top: r.top - 14, right: r.right + 14, bottom: r.bottom + 14, width: r.width + 28, height: r.height + 28 }; }
      avoid.push({ r: r, w: w, round: round, pic: !!isPic });
    }
    var picR = picRect(), colR = null;
    if (picR) { keep(picR, 1000, false, true); }
    var rd = window.Land && Land.reading ? Land.reading() : null;
    // The lens matters less once a path has ended and its doors are what is read.
    var cur = current(), ended = !!(cur && !cur.alive);
    if (rd && rd.lens && rd.hole && !rd.out) {
      var h = rd.hole;
      keep({ left: h.x, top: h.y, right: h.x + h.w, bottom: h.y + h.h, width: h.w, height: h.h }, rd.swapped ? 40 : ended ? 2 : 8, h.round < 0);
    }
    // The reading's globe grown out of its window (land.js, "the grown globe"): its pills are pressed
    // there, and its own marks (the place being told) are looked at, kept clear as the lens is.
    var pills = document.querySelector(".filter[data-grown]");
    if (pills && visibleBox(pills)) { keep(pills.getBoundingClientRect(), 40); }
    if (rd && rd.own && rd.own.length) {
      rd.own.forEach(function (o) {
        keep({ left: o.x0, top: o.y0, right: o.x1, bottom: o.y1, width: o.x1 - o.x0, height: o.y1 - o.y0 }, ended ? 2 : 8);
      });
    }
    var cap = document.querySelector(".voice-cap:not([hidden])");
    if (cap && visibleBox(cap)) { keep(cap.getBoundingClientRect(), 30); }
    var chip = document.querySelector(".voice-chip[data-on=\"true\"]:not([hidden])");
    if (chip) { keep(chip.getBoundingClientRect(), 20); }
    if (!phone) {
      var col = document.querySelector(".art[data-on=\"true\"] .art-col");
      if (col && visibleBox(col)) { var cr = col.getBoundingClientRect(); if (cr.left > W / 2) { colR = cr; keep(cr, 6); } }
    }
    keep(a, 1000);
    // At the dial's side, only as wide as the room between it and the picture or the column.
    var leftLimit = 8, rightLimit = W - 8;
    if (picR && picR.right <= a.left + 1) { leftLimit = Math.max(leftLimit, picR.right + 8); }
    if (picR && picR.left >= a.right - 1) { rightLimit = Math.min(rightLimit, picR.left - 8); }
    if (colR && colR.left >= a.right - 1) { rightLimit = Math.min(rightLimit, colR.left - 8); }
    var ban = document.querySelector(".banner");
    var topMin = 8;
    if (ban && !ban.hidden) { var br = ban.getBoundingClientRect(); if (br.height && br.bottom < H / 2) { topMin = br.bottom + 6; } }
    function alignX(w) {
      var cx = a.left + a.width / 2;
      var x = cx > W * 0.6 ? a.right - w : cx < W * 0.4 ? a.left : cx - w / 2;
      return Math.max(12, Math.min(W - 12 - w, x));
    }
    var cands = [];
    function cand(name, maxW, at) { if (maxW >= 140) { cands.push({ name: name, maxW: Math.floor(maxW), at: at }); } }
    var leftOf = function (w, hh) { return { x: a.left - 8 - w, y: Math.min(a.bottom - hh, H - 8 - hh) }; };
    var rightOf = function (w, hh) { return { x: a.right + 8, y: Math.min(a.bottom - hh, H - 8 - hh) }; };
    var above = function (w, hh) { return { x: alignX(w), y: a.top - 8 - hh }; };
    var below = function (w, hh) { return { x: alignX(w), y: a.bottom + 8 }; };
    if (phone) {
      cand("left", Math.min(220, a.left - 8 - leftLimit), leftOf);
      cand("below", Math.min(W - 24, 320), below);
      cand("above", Math.min(W - 24, 320), above);
      cand("right", Math.min(260, rightLimit - a.right - 8), rightOf);
    } else {
      cand("below", 340, below);
      cand("left", Math.min(340, a.left - 8 - leftLimit), leftOf);
      cand("right", Math.min(340, rightLimit - a.right - 8), rightOf);
      cand("above", 340, above);
    }
    var picHit = 0;
    function cover(r) {
      var sum = 0;
      picHit = 0;
      avoid.forEach(function (q) {
        var x0 = Math.max(r.left, q.r.left), x1 = Math.min(r.right, q.r.right);
        var y0 = Math.max(r.top, q.r.top), y1 = Math.min(r.bottom, q.r.bottom);
        if (x1 <= x0 || y1 <= y0) { return; }
        var area = (x1 - x0) * (y1 - y0);
        if (q.round) {
          // A round window: only what falls inside the circle counts (its rim's engraved name with it).
          var cx = (q.r.left + q.r.right) / 2, cy = (q.r.top + q.r.bottom) / 2, R = q.r.width / 2;
          var nx = Math.max(r.left, Math.min(cx, r.right)), ny = Math.max(r.top, Math.min(cy, r.bottom));
          if (Math.hypot(nx - cx, ny - cy) >= R) { return; }
          area *= 0.6;
        }
        if (q.pic) { picHit += area; }
        sum += area * q.w;
      });
      return sum;
    }
    var best = null;
    lastPlace = [];
    // Its own width, where nothing narrows it: a side that crams it into a strip under 200 px costs too.
    box.style.maxWidth = (phone ? Math.min(W - 24, 320) : 340) + "px";
    var natW = box.offsetWidth, natH = box.offsetHeight;
    cands.forEach(function (c, k) {
      box.style.maxWidth = c.maxW + "px";
      var w = box.offsetWidth, hh = box.offsetHeight;
      var at = c.at(w, hh);
      var x = Math.max(8, Math.min(W - 8 - w, at.x)), y = Math.max(topMin, Math.min(H - 6 - hh, at.y));
      var r = { left: x, top: y, right: x + w, bottom: y + hh };
      // Pushed back onto the screen is a cost too: it has left the dial's side.
      var moved = Math.abs(x - at.x) + Math.abs(y - at.y);
      var cramp = w < 200 && w < natW - 2 ? (natW - w) * natH * 3 : 0;
      var score = cover(r) + moved * 40 + cramp + k * 30;
      lastPlace.push([c.name, Math.round(score), Math.round(x), Math.round(y), w, hh]);
      if (!best || score < best.score) { best = { c: c, x: x, y: y, score: score, pic: picHit }; }
    });
    if (!best) { return; }
    // Nowhere clear of the picture: unseen until there is (never over it).
    box.style.visibility = best.pic > 0 ? "hidden" : "";
    box.style.maxWidth = best.c.maxW + "px";
    box.dataset.side = best.c.name;
    box.style.left = Math.round(best.x) + "px";
    box.style.top = Math.round(best.y) + "px";
  }

  window.setInterval(function () {
    if (stack.length || last || reads.some(function (r) { return shown(r.el); })) { kick(); }
  }, 160);

  window.Dial = {
    // A path being played: { kind, title, stops: [{ y, label }], at, paused, read: element,
    // onSeek(i, play), onToggle(), onEnd(), onNext() } → { set({ at, paused, stops, title }), close(), alive() }.
    path: path,
    read: read,
    owns: owns,
    // The relay's hand-offs where a path ended: [{ kind, y, label, open }].
    offers: function (list) { setOffers(list); },
    // For the hub (dialhub.js): the hand-offs, while the ended path's readout is up.
    handoffs: function () { return current() && offerList ? offerList.slice() : []; },
    live: function () { var p = top(); return !!(p && p.alive); },
    // A path just ended, its readout (its doors) still up.
    ending: function () { var p = current(); return !!(p && !p.alive); },
    paused: function () { var p = top(); return !!(p && p.paused); },
    // For land.js's dial: the layer drawn on it, a press on its ring, a tap on its face.
    layer: layer,
    ring: ring,
    faceTap: faceTap,
    // Played from outside (checks, keys elsewhere).
    toggle: toggle,
    seek: seek,
    end: endTop,
    _state: function () {
      var p = current();
      var P = p && host ? positions(p, host) : null;
      return {
        path: p && { kind: p.kind, title: p.title, at: p.at, n: p.stops.length, paused: p.paused, alive: p.alive,
                     stops: p.stops.map(function (s) { return [s.y, s.label]; }), by: P ? P.by : null, pos: P ? P.pos : null },
        host: host ? (host === own ? "own" : host.box.id || host.box.className) : null,
        read: box && !box.hidden ? box.innerText : "",
        side: box && box.dataset.side || null,
        rect: box && !box.hidden ? box.getBoundingClientRect().toJSON() : null,
        offers: offerList ? offerList.map(function (o) { return [o.kind, o.y, o.label]; }) : [],
        holding: !!hold,
        placed: lastPlace,
        depth: stack.length
      };
    }
  };
})();

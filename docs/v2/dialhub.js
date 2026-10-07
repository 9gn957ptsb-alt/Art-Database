/* The dial as the hub — every way of exploring has years, so every way of
   exploring has a place on the dial.

   The artist, 2 Oct 2026: "Maximizing the utility of the dial is pertinent
   to enabling the inherent complexity of modalities of connecting
   information to be accessible and easily utilized by viewers. So when we
   find new ways of defining explorations I want you to really develop an
   efficient and dynamic way it can be incorporated into the functionality
   of the dial." The design: docs/v2/DIAL.md.

   land.js ("the dial") draws the ring and asks this module for its layer
   (DialHub.layer: a key, and a draw into the band inside the event ticks),
   and hands it a press on the band that was not a turn (DialHub.tap) and the
   resting mouse (DialHub.hover). This module owns:

   - the face's word: what the dial is about — the view's own (Place, Work,
     Life, Movement, Thread), then Movements, Artists (Artist in a work),
     Explore — only those with something in them; pressed, or Enter on it, or
     M on the dial's range, the next;
   - the band: arcs for what lasts (a movement's years, an artist's years
     here), glyphs for what begins (a hand-off), each kind one glyph and one
     tone; the arcs under the year glow;
   - the readout beside the dial: what the year holds in this mode, two doors
     at most, and on focus the legend;
   - in a city, the artists there in the dial's year lit on the globe at
     their studios and schools.

   Indexes are built once per view and mode; the layer's key changes only
   when the mode, the year, the data or the hovered mark does, so the dial
   still draws only when something on it changed. */
(function () {
  "use strict";

  var TAU = Math.PI * 2, RAD = Math.PI / 180;
  var GAP = 18 * RAD, START = -Math.PI / 2 + GAP / 2, SWEEP = TAU - GAP;
  var LILAC = "#9d95e6", CREAM = "#eadfcd", AMBER = "#d9a55b", SEA = "#8fc7bd", ROSE = "#c98fb5", C = 13;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var MODES = {
    town: ["place", "made", "movements", "artists", "explore"],
    work: ["work", "artist", "movements", "explore"],
    life: ["life", "movements", "explore"],
    movement: ["movement", "artists", "explore"],
    thread: ["thread", "explore"]
  };
  var WORD = { place: "Place", work: "Work", life: "Life", movement: "Movement", thread: "Thread",
               movements: "Movements", artists: "Artists", artist: "Artist", explore: "Explore", made: "Made here" };
  // Each kind of mark: its glyph and tone (DIAL.md, "the marks by kind").
  var KINDS = {
    movement: { tone: LILAC, glyph: "arc", word: "movement" },
    presence: { tone: CREAM, glyph: "arc", word: "an artist’s years" },
    h: { tone: AMBER, glyph: "square", word: "hunt" },
    w: { tone: LILAC, glyph: "dot", word: "walk" },
    v: { tone: ROSE, glyph: "tick", word: "voice’s route" },
    s: { tone: SEA, glyph: "hollow", word: "painted here" },
    o: { tone: CREAM, glyph: "atelier", word: "studios" },
    m: { tone: LILAC, glyph: "diamond", word: "movement walk" },
    l: { tone: CREAM, glyph: "round", word: "life" },
    k: { tone: CREAM, glyph: "dot", word: "kept" },
    x: { tone: CREAM, glyph: "dot", word: "sent" },
    made: { tone: CREAM, glyph: "square", word: "made here" }
  };
  var SIGN = { arc: "◜", square: "■", dot: "●", tick: "╵", hollow: "□", atelier: "▣", diamond: "◆", round: "○" };

  var hub = { view: "", v: null, modes: ["place"], mode: 0, items: null, itemsFor: "", ver: 0, hover: -1,
              said: "", box: null, word: null, say: null, focus: false };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function surname(a) {
    var w = String(a || "").split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function yrs(a, b) { return a === b ? String(a) : a + "–" + b; }

  /* ---- the files, read once ------------------------------------------------------ */

  var X = null, xLoading = null;
  function loadAll() {
    if (X) { return Promise.resolve(X); }
    if (xLoading) { return xLoading; }
    var j = function (u) { return fetch(u).then(function (r) { if (!r.ok) { throw new Error(u); } return r.json(); }).catch(function () { return null; }); };
    xLoading = Promise.all([window.Movements ? Movements.load() : null, j("explorations.json"), j("finding.json")])
      .then(function (g) {
        var x = { ex: g[1] || { relay: [] }, works: g[2] ? g[2].w : [] };
        x.workIx = {};
        x.works.forEach(function (w, i) { x.workIx[w[0]] = i; });
        x.byStart = {};
        x.relay = (x.ex.relay || []).filter(function (r) { return /^[hwvso]$/.test(r[0]); });
        x.relay.forEach(function (r) {
          var s = r[7] && r[7][0];
          if (s && s[0]) { (x.byStart[s[0]] = x.byStart[s[0]] || []).push(r); }
        });
        // The lives passing through each city, by evidence (movements.json's lifeAt, from the lives).
        var M = window.Movements && Movements.data();
        x.lifeAt = M && M.lifeAt || {};
        X = x;
        hub.ver += 1;
        hub.itemsFor = "";
        return x;
      });
    return xLoading;
  }

  /* ---- what each mode holds, for the view open ------------------------------------- */

  function artistsOf(v) {
    if (v.kind === "work") { return v.artists || []; }
    if (v.kind === "life") {
      var M = window.Movements && Movements.data();
      var lives = M && M.lifeAt, name = null;
      (M ? M.artists : []).some(function (a) { if (a[0] === v.id) { name = a[1]; return true; } return false; });
      if (name) { return [name]; }
      if (lives) { Object.keys(lives).some(function (k) { return lives[k].some(function (r) { if (r[0] === v.id) { name = r[1]; return true; } return false; }); }); }
      return name ? [name] : [];
    }
    return [];
  }

  function rowTitle(r) { return r[0] === "v" ? r[2] + "’s route" : r[2]; }
  function startRow(r) {
    if (!window.Explorations || !Explorations.play) { return; }
    var kind = { h: "hunt", s: "sites", o: "studios", w: "ref", v: "ref" }[r[0]] || "ref";
    Explorations.play({ id: r[1], kind: kind, title: rowTitle(r), by: "", stops: [{ k: "r", id: r[0] + ":" + r[1], from: 0 }] });
  }
  function relayItem(r, y) {
    return { kind: r[0], y: y || 0, label: rowTitle(r), open: function () { startRow(r); } };
  }
  function mvArc(m) {
    return { kind: "movement", y0: m.y0, y1: m.y1, id: m.id,
             label: (m.label ? m.label.name + " · " : "") + m.title, who: m.who,
             open: function () { if (window.Movements) { Movements.open(m.id); } } };
  }
  function presenceArc(name, life, p, key) {
    // p: [ai, y0, y1, how, lat, lon, place, what, studio] (a city's) or [key, y0, ...] (an artist's)
    return { kind: "presence", y0: p[1], y1: p[2], ll: [p[4], p[5]], name: name,
             label: name + " · " + yrs(p[1], p[2]) + (p[6] ? " · " + p[6] : "") + (p[7] ? " · " + p[7] : ""),
             open: function () {
               if (life && window.Lives && Lives.open) { Lives.open(life, { year: p[1] }); }
               else if (p[8] >= 0 && window.Studios && Studios.open) { Studios.open(p[8]); }
               else if (key && window.Land && Land.go) { Land.go(key); }
             } };
  }

  function compute(v, mode) {
    var M = window.Movements && Movements.data();
    var out = [];
    // A place in a life, as it stood (placethen.js): the works made there, each at its year;
    // a press brings it up. Its paintings at documented sites are painted here's hollow squares.
    if (mode === "made") {
      if (v.kind === "town" && window.PlaceThen && PlaceThen.marks) {
        PlaceThen.marks().forEach(function (m) {
          out.push({ kind: m.site ? "s" : "made", y: m.y, label: m.label, open: function () { PlaceThen.show(m.i); } });
        });
      }
      return out;
    }
    if (!M) { return out; }
    var names = artistsOf(v);
    if (mode === "movements" || mode === v.kind || (mode === "place" && v.kind === "town")) {
      var ms = [];
      if (v.kind === "town") { ms = Movements.forCity(v.key); }
      else if (v.kind === "movement") {
        var me = M.movements[M.byId[v.id]];
        ms = me ? Movements.forCity(me.key) : [];
      } else {
        var seen = {};
        names.forEach(function (n) { Movements.ofArtistName(n).forEach(function (m) { if (!seen[m.id]) { seen[m.id] = true; ms.push(m); } }); });
      }
      if (mode === "movements" || (mode === "place" && v.kind === "town")) { ms.forEach(function (m) { out.push(mvArc(m)); }); }
    }
    if (mode === "artists" && (v.kind === "town" || v.kind === "movement")) {
      var key = v.key;
      var only = null;
      if (v.kind === "movement") {
        var mm = M.movements[M.byId[v.id]];
        key = mm && mm.key;
        only = {};
        if (mm) { mm.members.forEach(function (r) { only[r[0]] = true; }); }
      }
      Movements.here(key).forEach(function (p) {
        if (only && !only[p[0]]) { return; }
        var a = M.artists[p[0]];
        out.push(presenceArc(a[1], a[6] ? a[0] : null, p, null));
      });
    }
    if (mode === "artist") {
      names.forEach(function (n) {
        var ai = Movements.artistIndex(n);
        var a = ai === undefined ? null : M.artists[ai];
        Movements.presencesOf(n).forEach(function (p) {
          var it = presenceArc(n, a && a[6] ? a[0] : null, [ai].concat(p.slice(1)), p[0]);
          it.label = (M.town[p[0]] ? M.town[p[0]].name : p[0]) + " · " + yrs(p[1], p[2]) + (p[6] && M.town[p[0]] && p[6] !== M.town[p[0]].name ? " · " + p[6] : "");
          out.push(it);
        });
      });
    }
    if (mode === "explore" && X) {
      var add = function (it) { out.push(it); };
      // Where a played path has just ended (transport.js): the relay's hand-offs, first.
      if (window.Dial && Dial.handoffs) {
        Dial.handoffs().forEach(function (o) {
          add({ kind: KINDS[o.kind] ? o.kind : "x", y: o.y || 0, label: o.label, open: o.open, handoff: true });
        });
      }
      if (v.kind === "town") {
        (X.byStart[v.key] || []).forEach(function (r) { add(relayItem(r, r[7][0][1])); });
        Movements.forCity(v.key).forEach(function (m) {
          add({ kind: "m", y: m.y0, label: "Walk the movement · " + m.title, open: function () { Movements.play(m.id); } });
        });
        (X.lifeAt[v.key] || []).forEach(function (l) {
          add({ kind: "l", y: l[2], label: l[1] + "’s life · here " + l[2], open: function () { if (window.Lives) { Lives.open(l[0], { year: l[2] }); } } });
        });
      } else if (v.kind === "work") {
        var wi = X.workIx[v.id];
        X.relay.forEach(function (r) {
          (r[7] || []).forEach(function (s) { if (wi !== undefined && s[2] === wi) { add(relayItem(r, s[1] || v.year)); } });
        });
      } else if (v.kind === "life" || v.kind === "movement") {
        var who = names.slice();
        var mv = v.kind === "movement" ? M.movements[M.byId[v.id]] : null;
        if (mv) { mv.members.forEach(function (r) { who.push(M.artists[r[0]][1]); }); }
        X.relay.forEach(function (r) {
          if (r[3] && who.indexOf(r[3]) >= 0) { add(relayItem(r, (r[7][0] || [])[1])); }
        });
        if (mv) {
          (X.byStart[mv.key] || []).forEach(function (r) { add(relayItem(r, r[7][0][1])); });
          mv.members.forEach(function (r) {
            var a = M.artists[r[0]];
            if (a[6]) { add({ kind: "l", y: r[1], label: a[1] + "’s life · " + r[1], open: function () { Lives.open(a[0], { year: r[1] }); } }); }
          });
        } else {
          names.forEach(function (n) { Movements.ofArtistName(n).forEach(function (m) {
            add({ kind: "m", y: m.y0, label: "Walk the movement · " + m.title, open: function () { Movements.play(m.id); } });
          }); });
        }
      }
      // One mark a thing: the same exploration is not offered twice.
      var once = {};
      out = out.filter(function (it) { var k = it.kind + it.label; if (once[k]) { return false; } once[k] = true; return true; });
    }
    return out;
  }

  /* The modes with something in them (the view's own always). */
  function modesFor(v) {
    var list = MODES[v.kind] || [v.kind];
    return list.filter(function (m, k) { return k === 0 || compute(v, m).length; });
  }

  /* ---- the layout of the band: arcs in lanes, glyphs on one ring ------------------- */

  function lay(items, span) {
    var lanes = [-1e9, -1e9], over = 0;
    items.sort(function (a, b) { return (a.y0 !== undefined ? a.y0 : a.y) - (b.y0 !== undefined ? b.y0 : b.y); });
    items.forEach(function (it) {
      it.shown = true;
      if (it.y0 === undefined) {
        it.dated = !!it.y;
        it.shown = it.dated && it.y >= span[0] && it.y <= span[1];
        return;
      }
      it.shown = it.y1 >= span[0] && it.y0 <= span[1];
      if (!it.shown) { return; }
      it.lane = -1;
      for (var k = 0; k < lanes.length; k += 1) {
        if (lanes[k] < it.y0 - 0.5) { it.lane = k; lanes[k] = it.y1 + 1; break; }
      }
      if (it.lane < 0) { it.shown = false; over += 1; }
    });
    return over;
  }

  function pos(y, span) { return Math.max(0, Math.min(1, (y - span[0]) / Math.max(1e-6, span[1] - span[0]))); }
  function angle(p) { return START + p * SWEEP; }
  // Two lanes, clear of the face's carrying circle (22 % of the dial while the band is in use).
  function laneR(R1, lane) { return R1 - 16 - lane * 4.5; }

  /* ---- the layer land.js asks for ------------------------------------------------- */

  function layer(d, t, span) {
    var v = window.Land && Land.dial ? Land.dial() : null;
    if (!v || !span || !(span[1] > span[0])) { hide(); return null; }
    ui(v.box);
    var vk = v.kind + "|" + (v.id || "") + "|" + (v.key || "") + (window.PlaceThen && PlaceThen.key ? "|" + PlaceThen.key() : "");
    if (vk !== hub.view) {
      hub.view = vk;
      hub.mode = 0;
      hub.hover = -1;
      hub.itemsFor = "";
      hub.modesAt = -1;
    }
    hub.v = v;
    if (!X) { loadAll(); }
    if (hub.modesAt !== hub.ver) {
      hub.modesAt = hub.ver;
      var was = hub.want || hub.modes[hub.mode];
      hub.want = null;
      hub.modes = modesFor(v);
      hub.mode = Math.max(0, hub.modes.indexOf(was));
    }
    var mode = hub.modes[hub.mode] || v.kind;
    var sk = vk + "|" + mode + "|" + hub.ver + "|" + Math.floor(span[0]) + "-" + Math.floor(span[1]);
    if (hub.itemsFor !== sk) {
      hub.itemsFor = sk;
      hub.items = compute(v, mode);
      // Many artists' years are a density, not arcs: how many lives overlap in each year — the
      // thickening is where a movement is.
      hub.hist = null;
      if ((mode === "artists" || mode === "artist") && hub.items.length > 8) {
        hub.hist = {};
        hub.items.forEach(function (it) { for (var y = it.y0; y <= it.y1; y += 1) { hub.hist[y] = (hub.hist[y] || 0) + 1; } });
        hub.items.forEach(function (it) { it.shown = it.y1 >= span[0] && it.y0 <= span[1]; it.lane = 0; });
        hub.over = 0;
      } else { hub.over = lay(hub.items, span); }
      hub.hover = -1;
    }
    var year = v.year;
    var act = [];
    hub.items.forEach(function (it, i) { if (isAt(it, year)) { act.push(i); } });
    hub.act = act;
    words(v, mode, year);
    var own = hub.mode === 0;
    var key = [sk, year, hub.hover, act.join(","), hub.focus].join("|");
    return {
      key: key,
      quiet: !own && hub.items.length > 0,
      draw: function (g, c, R1) { drawBand(g, c, R1, span, year, own, mode); }
    };
  }

  function isAt(it, y) {
    if (it.y0 !== undefined) { return it.y0 <= y && y <= it.y1; }
    return it.dated && Math.abs(it.y - y) <= 2;
  }

  function drawBand(g, c, R1, span, year, own, mode) {
    var items = hub.items || [];
    if (!items.length) { return; }
    g.save();
    g.lineCap = "butt";
    if (hub.hist) {
      var most = 1;
      Object.keys(hub.hist).forEach(function (y) { most = Math.max(most, hub.hist[y]); });
      g.lineWidth = Math.max(1, (R1 * SWEEP) / Math.max(1, span[1] - span[0]) * 0.8);
      Object.keys(hub.hist).forEach(function (y) {
        y = +y;
        if (y < span[0] || y > span[1]) { return; }
        var a = angle(pos(y + 0.5, span)), len = 2 + 6 * hub.hist[y] / most, r0 = R1 - 14;
        var lit = Math.abs(y - year) < 0.5;
        g.strokeStyle = lit ? "#ffffff" : CREAM;
        g.globalAlpha = lit ? 1 : 0.22 + 0.5 * hub.hist[y] / most;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        g.lineTo(c + Math.cos(a) * (r0 - len), c + Math.sin(a) * (r0 - len));
        g.stroke();
      });
      g.restore();
      return;
    }
    var named = null;
    items.forEach(function (it, i) {
      if (!it.shown) { return; }
      var k = KINDS[it.kind] || KINDS.movement;
      var on = hub.act.indexOf(i) >= 0, hov = hub.hover === i;
      if (it.y0 !== undefined) {
        // An arc over its years; in the view's own mode only the city's movements, faintly.
        var a0 = angle(pos(it.y0, span)), a1 = angle(pos(it.y1 + 1, span));
        if (a1 - a0 < 0.03) { a1 = a0 + 0.03; }
        var r = laneR(R1, it.lane);
        g.strokeStyle = k.tone;
        g.globalAlpha = own ? (on ? 0.7 : 0.26) : on || hov ? 1 : 0.42;
        g.lineWidth = own ? 1.5 : on || hov ? 3 : 2;
        if ((on || hov) && !own && !still) { g.shadowColor = k.tone; g.shadowBlur = 6; } else { g.shadowBlur = 0; }
        g.beginPath();
        g.arc(c, c, r, a0, a1);
        g.stroke();
        // Its start: a small tile, the mark the readout names.
        if (!own) {
          g.shadowBlur = 0;
          g.fillStyle = k.tone;
          g.fillRect(c + Math.cos(a0) * r - 1.5, c + Math.sin(a0) * r - 1.5, 3, 3);
          // Unrolled into a band (land.js, "the dial unrolled"), a span is named under its start where there is room.
          if (g.unrolled && it.label) {
            var p0 = g.map(c + Math.cos(a0) * r, c + Math.sin(a0) * r), p1 = g.map(c + Math.cos(a1) * r, c + Math.sin(a1) * r);
            var name = String(it.label).split(" · ")[0];
            g.font = "9px " + (getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace").trim();
            var tw = g.measureText(name).width;
            named = named || [];
            var box = { x0: p0.x, x1: p0.x + tw, y: p0.y };
            if (!named.some(function (b) { return Math.abs(b.y - box.y) < 10 && box.x0 < b.x1 + 6 && b.x0 < box.x1 + 6; }) && tw < Math.max(60, p1.x - p0.x + 80)) {
              named.push(box);
              g.globalAlpha = on || hov ? 1 : 0.75;
              g.textAlign = "left";
              g.textBaseline = "top";
              g.fillText(name, c + Math.cos(a0) * (r - 1.5), c + Math.sin(a0) * (r - 1.5));
            }
          }
        }
        return;
      }
      var a = angle(pos(it.y, span)), rr = R1 - 18;
      var x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr;
      g.globalAlpha = on || hov ? 1 : 0.5;
      g.shadowBlur = 0;
      glyph(g, k, x, y, a, on || hov ? 1.25 : 1);
    });
    g.restore();
  }

  function glyph(g, k, x, y, a, s) {
    g.fillStyle = k.tone;
    g.strokeStyle = k.tone;
    g.lineWidth = 1.25;
    var h = 2.5 * s;
    switch (k.glyph) {
      case "square": g.fillRect(x - h, y - h, 2 * h, 2 * h); break;
      case "dot": g.beginPath(); g.arc(x, y, h, 0, TAU); g.fill(); break;
      case "tick":
        g.beginPath();
        g.moveTo(x - Math.cos(a) * 3.5 * s, y - Math.sin(a) * 3.5 * s);
        g.lineTo(x + Math.cos(a) * 3.5 * s, y + Math.sin(a) * 3.5 * s);
        g.stroke();
        break;
      case "hollow": g.strokeRect(x - h, y - h, 2 * h, 2 * h); break;
      case "atelier": g.strokeRect(x - h - 0.5, y - h - 0.5, 2 * h + 1, 2 * h + 1); g.fillRect(x - 1, y - 1, 2, 2); break;
      case "diamond":
        g.beginPath(); g.moveTo(x, y - h - 1); g.lineTo(x + h + 1, y); g.lineTo(x, y + h + 1); g.lineTo(x - h - 1, y); g.closePath(); g.fill();
        break;
      case "round": g.beginPath(); g.arc(x, y, h, 0, TAU); g.stroke(); break;
      default: g.fillRect(x - h, y - h, 2 * h, 2 * h);
    }
  }

  /* ---- pressing and pointing at the band ------------------------------------------ */

  function hit(x, y, w, touch) {
    var items = hub.items || [];
    if (!items.length || !hub.v) { return -1; }
    var c = w / 2, R1 = w / 2 - 13;
    var r = Math.hypot(x - c, y - c);
    var a = Math.atan2(y - c, x - c);
    var rel = ((a - START) % TAU + TAU) % TAU;
    if (rel > SWEEP) { return -1; }
    var span = [hub.v.y0, hub.v.y1], p = rel / SWEEP, yr = span[0] + p * (span[1] - span[0]);
    var tol = touch ? 7 : 4, best = -1, bd = Infinity;
    items.forEach(function (it, i) {
      if (!it.shown) { return; }
      if (it.y0 !== undefined) {
        if (hub.mode === 0 || hub.hist) { return; }
        var dr = Math.abs(r - laneR(R1, it.lane));
        if (dr > tol) { return; }
        var slack = (span[1] - span[0]) * (touch ? 0.02 : 0.01);
        if (yr < it.y0 - slack || yr > it.y1 + 1 + slack) { return; }
        if (dr < bd) { bd = dr; best = i; }
        return;
      }
      var ga = angle(pos(it.y, span)), rr = R1 - 18;
      var dx = c + Math.cos(ga) * rr - x, dy = c + Math.sin(ga) * rr - y, dd = Math.hypot(dx, dy);
      if (dd <= tol + 3 && dd < bd) { bd = dd; best = i; }
    });
    return best;
  }

  function tap(d, x, y, w) {
    var i = hit(x, y, w, true);
    if (i < 0) { return false; }
    var it = hub.items[i];
    if (it && it.open) { it.open(); }
    return true;
  }
  function hover(d, x, y, w) {
    var i = hit(x, y, w, false);
    if (i !== hub.hover) { hub.hover = i; }
  }

  /* ---- the face's word, and the readout ------------------------------------------- */

  function ui(box) {
    if (hub.box === box && hub.word) { return; }
    hub.box = box;
    hub.word = el("button", "dial-mode");
    hub.word.type = "button";
    hub.word.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    hub.word.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); cycle(1); });
    hub.word.addEventListener("focus", function () { hub.focus = true; hub.said = ""; });
    hub.word.addEventListener("blur", function () { hub.focus = false; hub.said = ""; });
    box.appendChild(hub.word);
    hub.say = el("div", "dial-say");
    hub.say.setAttribute("role", "status");
    hub.say.setAttribute("aria-live", "polite");
    box.appendChild(hub.say);
    var range = box.querySelector("input[type=range]");
    if (range) {
      range.addEventListener("keydown", function (event) {
        if ((event.key === "m" || event.key === "M") && !event.metaKey && !event.ctrlKey) { event.preventDefault(); cycle(event.shiftKey ? -1 : 1); }
      });
      range.addEventListener("focus", function () { hub.focus = true; hub.said = ""; });
      range.addEventListener("blur", function () { hub.focus = false; hub.said = ""; });
    }
    var face = box.querySelector(".dial-face");
    if (face) { face.addEventListener("pointerleave", function () { hub.hover = -1; }); }
  }
  function hide() {
    if (hub.say) { hub.say.hidden = true; }
    hub.view = "";
  }
  function cycle(dir) {
    if (hub.modes.length < 2) { return; }
    hub.mode = (hub.mode + dir + hub.modes.length) % hub.modes.length;
    hub.itemsFor = "";
    hub.said = "";
    hub.hover = -1;
    kick();
  }

  function door(text, fn, cls) {
    var b = el("button", "dial-door" + (cls ? " " + cls : ""), text);
    b.type = "button";
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); fn(); });
    return b;
  }

  function words(v, mode, year) {
    var w = hub.word;
    if (!w) { return; }
    var word = WORD[mode] || mode;
    if (w.textContent !== word) { w.textContent = word; }
    w.hidden = hub.modes.length < 2;
    w.setAttribute("aria-label", "The dial is about: " + word + (hub.modes.length > 1 ? ". Press for " + (WORD[hub.modes[(hub.mode + 1) % hub.modes.length]] || "") : ""));
    var key = [hub.itemsFor, year, hub.hover, hub.focus].join("|");
    if (key === hub.said) { return; }
    hub.said = key;
    var s = hub.say;
    s.textContent = "";
    var items = hub.items || [];
    var own = hub.mode === 0;
    var lines = [];
    if (hub.hover >= 0 && items[hub.hover]) {
      lines.push({ text: items[hub.hover].label, open: items[hub.hover].open });
    } else if (own) {
      // The view's own: only a movement under the year is said.
      hub.act.forEach(function (i) {
        var it = items[i];
        if (it.kind === "movement") { lines.push({ text: "Movement here · " + it.label + " ›", open: it.open }); }
      });
    } else if (mode === "movements") {
      hub.act.forEach(function (i) { var it = items[i]; lines.push({ text: it.label + (it.who ? " · " + it.who : "") + " ›", open: it.open }); });
      if (!lines.length) { nextOne(lines, items, year, "No movement in " + year); }
    } else if (mode === "artists" || mode === "artist") {
      var here = hub.act.map(function (i) { return items[i]; });
      if (here.length) {
        var who = [];
        here.forEach(function (it) { var n = mode === "artist" ? it.label.split(" · ")[0] : surname(it.name); if (who.indexOf(n) < 0) { who.push(n); } });
        lines.push({ text: year + " · " + (mode === "artist" ? "in " : plural(who.length, "artist", "artists") + " here: ") + who.slice(0, 5).join(", ") + (who.length > 5 ? " …" : "") });
        here.slice(0, 2).forEach(function (it) { lines.push({ text: (mode === "artist" ? it.label : it.name) + " ›", open: it.open }); });
      } else { nextOne(lines, items, year, year + " · no one recorded"); }
    } else if (mode === "explore") {
      hub.act.forEach(function (i) {
        var it = items[i];
        lines.push({ text: (it.kind === "l" || it.handoff ? "" : "Begins here · ") + it.label + " ›", open: it.open, kind: it.kind });
      });
      if (!lines.length) { nextOne(lines, items, year, "Nothing begins in " + year); }
      var undated = items.filter(function (it) { return it.y0 === undefined && !it.dated; });
      if (undated.length && lines.length < 2) {
        lines.push({ text: undated[0].label + (undated.length > 1 ? " · +" + (undated.length - 1) + " undated" : " · undated") + " ›", open: undated[0].open, kind: undated[0].kind });
      }
    }
    lines.slice(0, hub.hover >= 0 ? 1 : 3).forEach(function (l) {
      if (l.open) {
        var b = door(l.text, l.open);
        if (l.kind && KINDS[l.kind]) { b.style.setProperty("--tone", KINDS[l.kind].tone); b.dataset.glyph = SIGN[KINDS[l.kind].glyph] || ""; }
        s.appendChild(b);
      } else { s.appendChild(el("p", "dial-said", l.text)); }
    });
    if (hub.over && !own) { s.appendChild(el("p", "dial-said dial-more", "+" + hub.over + " not drawn: two lanes at most")); }
    if (hub.focus && hub.modes.length > 1) {
      var kinds = {};
      items.forEach(function (it) { kinds[it.kind] = true; });
      var leg = Object.keys(kinds).map(function (k) { return (SIGN[KINDS[k].glyph] || "") + " " + KINDS[k].word; });
      s.appendChild(el("p", "dial-said dial-legend", (leg.length ? leg.join(" · ") + " · " : "") + "M: what the dial is about"));
    }
    s.hidden = !s.children.length;
    // Above the dial, or below it where it stands near the top.
    var r = hub.box.getBoundingClientRect();
    if (r.top < 150) { s.dataset.below = "true"; } else { delete s.dataset.below; }
    if (r.left + r.width / 2 > window.innerWidth * 0.6) { s.dataset.side = "right"; }
    else if (r.left + r.width / 2 < window.innerWidth * 0.4) { s.dataset.side = "left"; }
    else { delete s.dataset.side; }
  }

  function nextOne(lines, items, year, none) {
    var best = null;
    items.forEach(function (it) {
      var y = it.y0 !== undefined ? it.y0 : it.dated ? it.y : null;
      if (y === null || y <= year || !it.shown) { return; }
      if (!best || y < (best.y0 !== undefined ? best.y0 : best.y)) { best = it; }
    });
    if (best) {
      var by = best.y0 !== undefined ? best.y0 : best.y;
      lines.push({ text: none + " · next " + by + " ›", open: function () { if (window.Land && Land.dialYear) { Land.dialYear(by); } }, kind: best.kind });
    } else { lines.push({ text: none }); }
  }

  /* ---- in a city: the artists there that year, on the globe ---------------------- */

  /* A city at rest draws only its own marks (artist, 2 Oct 2026: "way too many dots"); the
     artists' marks come with a mode the viewer turned to. Artists: everyone there in the
     dial's year; Movements: the members of a movement under the year, there then; Explore:
     only those who came in the year, faint. lit() says which (sites.js draws their sites
     painted that year; in Explore every site painted in it, faint). */
  function lit() {
    var v = hub.v && window.Land && Land.dial ? Land.dial() : null;
    var mode = v && hub.modes[hub.mode];
    if (!v || v.kind !== "town" || v.flying || !hub.mode || !hub.view) { return null; }
    var y = v.year, M = window.Movements && Movements.data(), names = [];
    var add = function (n) { if (n && names.indexOf(n) < 0) { names.push(n); } };
    if (mode === "artists") {
      (hub.items || []).forEach(function (it) { if (isAt(it, y)) { add(it.name); } });
    } else if (mode === "movements" && M) {
      (hub.items || []).forEach(function (it) {
        var m = isAt(it, y) && M.movements[M.byId[it.id]];
        if (m) { m.members.forEach(function (r) { if (r[1] <= y && y <= r[2]) { add(M.artists[r[0]][1]); } }); }
      });
    }
    return { mode: mode, key: v.key, year: y, names: names };
  }

  var cv = null, ctx = null, raf = 0;
  function kick() { if (!raf) { raf = window.requestAnimationFrame(drawGlobe); } }
  function drawGlobe() {
    raf = 0;
    var v = hub.v && window.Land && Land.dial ? Land.dial() : null;
    var mode = v && hub.modes[hub.mode];
    var on = v && v.kind === "town" && !v.flying && (mode === "artists" || mode === "movements" || mode === "explore");
    if (!cv && !on) { return; }
    if (!cv) {
      var tiles = document.getElementById("tiles");
      cv = el("canvas", "world world-tiles dial-lit");
      cv.setAttribute("aria-hidden", "true");
      if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(cv, tiles.nextSibling); } else { document.body.appendChild(cv); }
      ctx = cv.getContext("2d");
    }
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!on) { return; }
    var y = v.year, M = Movements.data();
    var lit = [], faint = mode === "explore";
    if (mode === "artists") {
      (hub.items || []).forEach(function (it) { if (isAt(it, y) && it.ll) { lit.push(it.ll); } });
    } else if (faint) {
      // Explore: the hand-offs are on the band; on the globe only the artists who came in the year.
      Movements.here(v.key).forEach(function (p) { if (p[1] === y) { lit.push([p[4], p[5]]); } });
    } else {
      // A movement under the year: its artists where they were then.
      (hub.items || []).forEach(function (it) {
        if (!isAt(it, y) || !M) { return; }
        var m = M.movements[M.byId[it.id]];
        Movements.here(m.key).forEach(function (p) {
          if (p[1] <= y && y <= p[2] && m.members.some(function (r) { return r[0] === p[0]; })) { lit.push([p[4], p[5]]); }
        });
      });
    }
    var done = {};
    lit.forEach(function (ll) {
      var q = Land.at(ll[0], ll[1]);
      if (!q || q.z < 0.05) { return; }
      var gx = Math.floor(q.x / C) * C, gy = Math.floor(q.y / C) * C;
      if (done[gx + "," + gy]) { return; }
      done[gx + "," + gy] = true;
      ctx.globalAlpha = faint ? 0.4 : 0.95;
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx + 1.5, gy + 1.5, C - 3, C - 3);
      ctx.fillStyle = LILAC;
      ctx.fillRect(gx + 4, gy + 4, C - 8, C - 8);
    });
    ctx.globalAlpha = 1;
    kick();
  }
  window.setInterval(function () { if (hub.v && !raf) { kick(); } }, 500);

  window.DialHub = {
    layer: layer,
    tap: tap,
    // The band in use (a mode other than the view's own, with marks): the face's carrying circle is smaller.
    busy: function () { return hub.mode > 0 && !!(hub.items && hub.items.length) && !!hub.view; },
    hover: hover,
    lit: lit,
    cycle: cycle,
    mode: function () { return hub.modes[hub.mode] || null; },
    // The view the band was last worked out for (transport.js turns it to Explore once a view).
    view: function () { return hub.view; },
    modes: function () { return hub.modes.slice(); },
    // A mode by name; one not offered yet (its marks are coming: transport.js's hand-offs) is taken
    // when the modes are next worked out.
    setMode: function (name) {
      var k = hub.modes.indexOf(name);
      if (k >= 0) { hub.mode = k; hub.itemsFor = ""; hub.said = ""; } else { hub.want = name; hub.ver += 1; }
      kick();
      return k >= 0;
    },
    // What the band holds has changed (transport.js: hand-offs came or went): worked out again.
    refresh: function () { hub.ver += 1; hub.itemsFor = ""; hub.said = ""; },
    // For checking: the marks drawn, the ones under the year, the readout.
    _state: function () {
      return { view: hub.view, modes: hub.modes.slice(), mode: hub.modes[hub.mode] || null,
               items: (hub.items || []).map(function (it) { return { kind: it.kind, y: it.y0 !== undefined ? [it.y0, it.y1] : it.y, shown: !!it.shown, lane: it.lane, label: it.label }; }),
               active: (hub.act || []).slice(), say: hub.say && !hub.say.hidden ? hub.say.innerText : "", loaded: !!X };
    }
  };
})();

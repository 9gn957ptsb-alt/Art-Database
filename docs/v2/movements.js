/* The movements — where lives overlapped, as a place and a time.

   The artist, 2 Oct 2026, on "lives that cross are the start of a social
   graph of art history. The cities where many lives overlap (Paris in 1906,
   New York in 1950) are the movements themselves, so a movement becomes a
   place and a time on the dial": "Yes great idea about using overlaps of
   artist residencies during a time period to define art and social
   movements. That is certainly another way to develop connections and move
   the viewer through the globe. I like the idea I've incorporating it on the
   dial given it's specification of time."

   movements.json (scripts/build_movements.py): three saved artists or more
   in one city in the same years, each placed there by evidence (a dated
   studio, a life's evidenced year, a dated school or employer on Wikidata);
   named by the city, the years and the artists, and by a movement's name
   only where most of them share it on Wikidata in those years. With each:
   the shows, sales, owners and writings their saved works shared then and
   after, the voices who wrote on several of them, the works dated there
   then. And every presence, city by city ("here"), for the dial.

   Opened (Land.movement): the world framed on the city and its artists'
   birthplaces and places, their ways to the city drawn faintly in pixel
   light, the city ringed; the dial is the movement's years (with ten either
   side); the column is the movement: who was there and when, by what
   evidence, each a door to their life at that year; what they shared; the
   works dated there then. Played (an exploration of kind "m"), its walk:
   where its artists came from, the city at its first year, where else they
   were during it, the city at its last.

   The dial's hub (dialhub.js) reads this module's indexes: a city's
   movements and presences, an artist's movements. */
(function () {
  "use strict";

  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var LILAC = "#9d95e6", CREAM = "#eadfcd", C = 13;
  var NOW = 2026;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var D = null, loading = null, pending = null;
  var view = null;                       // the movement open: { m, api, y, rows }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function button(text, cls, fn) {
    var b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); fn(event); });
    return b;
  }
  function fold(t) { return " " + String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " "; }
  function surname(a) {
    var w = String(a || "").split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function yrs(a, b) { return a === b ? String(a) : a + "–" + b; }

  function load() {
    if (D) { return Promise.resolve(D); }
    if (loading) { return loading; }
    loading = Promise.all([
      fetch("movements.json").then(function (r) { if (!r.ok) { throw new Error("movements"); } return r.json(); }),
      fetch("cities.json").then(function (r) { return r.json(); }).catch(function () { return { towns: [] }; })
    ]).then(function (g) {
      var d = g[0];
      d.byId = {};
      d.movements.forEach(function (m, i) { d.byId[m.id] = i; });
      d.byName = {};
      d.artists.forEach(function (a, i) { d.byName[a[1]] = i; });
      // Each artist's movements, and every presence by artist.
      d.ofArtist = d.artists.map(function () { return []; });
      d.movements.forEach(function (m, i) { m.members.forEach(function (r) { d.ofArtist[r[0]].push(i); }); });
      d.presOf = d.artists.map(function () { return []; });
      Object.keys(d.here).forEach(function (key) {
        d.here[key].forEach(function (r) { d.presOf[r[0]].push([key].concat(r.slice(1))); });
      });
      d.presOf.forEach(function (l) { l.sort(function (a, b) { return a[1] - b[1]; }); });
      d.town = {};
      g[1].towns.forEach(function (t) { d.town[t[0]] = { key: t[0], name: String(t[1]).split(",")[0], ll: [t[3], t[4]] }; });
      D = d;
      return d;
    }).catch(function () { loading = null; return null; });
    return loading;
  }
  function mv(id) { return D && D.byId[id] !== undefined ? D.movements[D.byId[id]] : null; }
  function artist(i) { return D.artists[i]; }
  function townName(key) { return D.town[key] ? D.town[key].name : key; }
  function townLL(key) { return D.town[key] ? D.town[key].ll : null; }
  function lifeOf(i) { var a = artist(i); return a && a[6] ? a[0] : null; }

  /* What the movement is called: its city (or the school the evidence names)
     and years; a movement's name only with its support. */
  function labelLine(m) {
    if (!m.label) { return ""; }
    return m.label.name + ", by Wikidata’s movement of " + m.label.n + " of " + m.label.of + " artists";
  }
  function heading(m) { return (m.label ? m.label.name + " · " : "") + m.title; }

  /* ---- opening a movement ------------------------------------------------------ */

  function open(id, opts) {
    opts = opts || {};
    return load().then(function () {
      var m = mv(id);
      if (!m || !window.Land || !Land.movement) { return; }
      if (view && view.m.id === id && view.api.live()) {
        if (opts.year) { view.api.setYear(opts.year); }
        return;
      }
      var pts = [];
      var c = townLL(m.key);
      if (c) { pts.push(c); }
      m.members.forEach(function (r) {
        var a = artist(r[0]);
        if (a[7] && a[7].length) { pts.push([a[7][1], a[7][2]]); }
      });
      m.walk.forEach(function (s) { var ll = townLL(s[0]); if (ll) { pts.push(ll); } });
      pending = { id: id, year: opts.year || null };
      Land.movement({ id: id, title: heading(m), where: "A movement · " + plural(m.members.length, "artist", "artists") +
                      (m.at ? " · " + townName(m.key) : ""), pts: pts });
    });
  }

  // land.js: down at the movement's view.
  function start(api) {
    var id = api.data.id;
    load().then(function () {
      var m = mv(id);
      if (!m || !api.live()) { return; }
      var at = pending && pending.id === id ? pending.year : null;
      pending = null;
      view = { m: m, api: api, y: null, rows: [] };
      column(view);
      var ticks = [];
      m.members.forEach(function (r) { ticks.push({ y: r[1] }); });
      m.then.forEach(function (t) { ticks.push({ y: t[4], kind: "written" }); });
      var y0 = Math.min(m.y0 - 10, Math.min.apply(null, m.members.map(function (r) { return r[1]; })));
      var y1 = Math.min(NOW, m.y1 + 10);
      api.years(y0, y1, ticks, at || m.y0, false);
      kick();
    });
  }
  function stop() { view = null; kick(); }

  /* The dial's year: who was there, said, and the rows of those who were lit. */
  function follow() {
    if (!view || !view.api.live()) { return; }
    var y = view.api.year();
    if (y === null || y === view.y) { return; }
    view.y = y;
    var m = view.m, n = 0;
    view.rows.forEach(function (row, k) {
      var r = m.members[k];
      var here = r[1] <= y && y <= r[2];
      if (here) { n += 1; row.dataset.here = "true"; } else { delete row.dataset.here; }
    });
    if (view.yearEl) {
      view.yearEl.textContent = y + " · " + (n ? plural(n, "of them", "of them") + " here" +
        (y < m.y0 ? " · before" : y > m.y1 ? " · after" : "") : y < m.y0 ? "before they met here" : y > m.y1 ? "after" : "none of them recorded here");
    }
  }

  /* ---- the column -------------------------------------------------------------- */

  function column(v) {
    var m = v.m, col = v.api.col;
    col.textContent = "";
    var box = el("section", "life-box movement-box");
    box.appendChild(el("p", "town-section life-kicker", "A movement" + (m.at ? " · " + townName(m.key) : "")));
    box.appendChild(el("p", "studio-title", m.title));
    if (m.label) { box.appendChild(el("p", "studio-by movement-label", labelLine(m))); }
    if (m.among && m.among.length) {
      box.appendChild(el("p", "studio-by movement-among", "Among them, by Wikidata’s movements: " +
        m.among.map(function (x) { return x[1] + " " + x[2]; }).join(" · ")));
    }
    box.appendChild(el("p", "studio-exact", [plural(m.members.length, "artist", "artists") + " here in the same years",
      m.then.length ? plural(m.then.length, "show or sale they shared then", "shows or sales they shared then") : "",
      m.nmade ? plural(m.nmade, "saved work", "saved works") + " dated here then" : ""].filter(Boolean).join(" · ")));
    v.yearEl = el("p", "life-year");
    v.yearEl.setAttribute("aria-live", "polite");
    box.appendChild(v.yearEl);
    if (window.Explorations && Explorations.play) {
      box.appendChild(button("Walk the movement · " + plural(m.walk.length, "stop", "stops") + " ›", "read-quiet life-play", function () { play(m); }));
    }
    col.appendChild(box);

    // Who was here, most the movement first (years there × saved works and catalogue entries,
    // build_movements.py): each a head that turns the dial to them.
    col.appendChild(el("p", "art-section-head", "Who was here · " + m.members.length));
    var ol = el("ol", "life-periods movement-members");
    v.rows = m.members.map(function (r) {
      var a = artist(r[0]);
      var li = el("li", "life-period movement-member");
      var hd = button("", "life-period-head", function () {
        v.api.setYear(r[1]);
        var ev = r[5][0];
        var p = presence(r[0], m.key, r[1]);
        if (p) { v.api.glide(p[4], p[5]); }
        body.hidden = !body.hidden;
      });
      hd.appendChild(el("span", "studio-stop-name", a[1]));
      var meta = [yrs(r[1], r[2]) + " here", r[5][0] ? howWord(r[5][0]) : ""];
      if (a[7] && a[7][0]) { meta.push("born in " + a[7][0]); }
      hd.appendChild(el("span", "studio-stop-meta", meta.filter(Boolean).join(" · ")));
      li.appendChild(hd);
      var body = el("div", "life-period-body");
      body.hidden = true;
      r[5].forEach(function (e) {
        body.appendChild(el("p", "town-museum-meta life-at", [yrs(e[1], e[2]), e[3], e[4]].filter(Boolean).join(" · ") + " — " + e[5]));
      });
      var doors = el("div", "life-doors");
      var lid = lifeOf(r[0]);
      if (lid && window.Lives && Lives.open) {
        doors.appendChild(button("Their life in " + r[1] + " ›", "read-quiet life-door", function () { Lives.open(lid, { year: r[1] }); }));
      }
      var st = r[5].filter(function (e) { return e[7] !== undefined && e[7] >= 0; })[0];
      if (st && window.Studios && Studios.open) {
        doors.appendChild(button("The studio ›", "read-quiet life-door", function () { Studios.open(st[7]); }));
      }
      var others = D.ofArtist[r[0]].filter(function (i) { return D.movements[i].id !== m.id; });
      others.slice(0, 2).forEach(function (i) {
        var o = D.movements[i];
        doors.appendChild(button(o.title + " ›", "read-quiet life-door", function () { open(o.id); }));
      });
      if (doors.children.length) { body.appendChild(doors); }
      li.appendChild(body);
      ol.appendChild(li);
      return li;
    });
    col.appendChild(ol);

    // What they shared: the shows and sales then; the shows that put them together after; the voices.
    if (m.then.length) {
      col.appendChild(el("p", "art-section-head", "Together then"));
      col.appendChild(threadRows(m.then));
    }
    if (m.later.length) {
      col.appendChild(el("p", "art-section-head", "Put together after"));
      col.appendChild(threadRows(m.later));
    }
    if (m.voices.length) {
      col.appendChild(el("p", "art-section-head", "Who wrote on several of them"));
      var vl = el("div", "town-near-row life-voices");
      m.voices.forEach(function (r) {
        vl.appendChild(button(r[1] + " · " + r[2].map(function (i) { return surname(artist(i)[1]); }).join(", "), "town-near", function () {
          if (window.Voices && Voices.follow) { Voices.follow(r[0]); }
        }));
      });
      col.appendChild(vl);
    }
    if (m.made.length) {
      col.appendChild(el("p", "art-section-head", "Dated here then · " + m.nmade));
      col.appendChild(el("p", "town-museum-meta studio-how", "Saved works dated within their artist’s years here — dated, not placed by their records"));
      var th = el("div", "town-thumbs studio-works life-works");
      m.made.forEach(function (w) { th.appendChild(square(w, m.key)); });
      col.appendChild(th);
    }
    if (!m.then.length && !m.later.length && !m.voices.length) {
      col.appendChild(el("p", "town-museum-meta", "No show, sale, owner or writing in the saved works’ records joins them: what joins them here is the place and the years."));
    }
    col.appendChild(el("p", "art-sources life-src", "Found, not declared: three saved artists or more placed in one city in the same years by a dated studio (Wikidata, the studios’ sources), a life’s evidenced year, or a dated school or employer on Wikidata; a work location spanning a career counts only beside another dated source. Most the movement first: years here × saved works and catalogue entries. A movement’s name only where most of them share it on Wikidata in those years."));
    v.api.foot();
  }

  function howWord(e) {
    return { studio: e[3] || "a dated place", life: "the life", school: e[3] + " " + e[4] }[e[0]] || e[0];
  }
  function presence(ai, key, y) {
    var best = null;
    (D.presOf[ai] || []).forEach(function (p) { if (p[0] === key && (!best || Math.abs(p[1] - y) < Math.abs(best[1] - y))) { best = p; } });
    return best;
  }

  var KIND = { show: "Shown", sale: "Offered", owner: "Owned", writing: "Written" };
  function threadRows(rows) {
    var box = el("div", "life-crosses movement-threads");
    rows.forEach(function (t) {
      var who = t[5].map(function (i) { return surname(artist(i)[1]); }).join(", ");
      var b = button("", "read-quiet life-cross movement-thread", function () { if (window.Land && Land.thread) { Land.thread(t[0]); } });
      b.appendChild(el("span", "", (KIND[t[1]] || "") + " · " + t[2] + (t[3] ? ", " + t[3] : "") + ", " + t[4]));
      b.appendChild(el("span", "movement-who", who + " ›"));
      box.appendChild(b);
    });
    return box;
  }

  function square(w, key) {
    var b = el("button", "town-thumb");
    b.type = "button";
    var line = w[3] + (w[2] ? ", " + w[2] : "") + " · " + artist(w[1])[1];
    b.title = line;
    b.setAttribute("aria-label", line + " — where it has been");
    if (w[4]) {
      var im = el("img");
      im.alt = "";
      im.loading = "lazy";
      im.decoding = "async";
      im.referrerPolicy = "no-referrer";
      im.src = CDN + w[4] + "/square.jpg";
      im.addEventListener("error", function () { b.classList.add("town-thumb-none"); });
      b.appendChild(im);
    } else { b.classList.add("town-thumb-none"); }
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); if (window.Land) { Land.work(w[0], key); } });
    return b;
  }

  /* ---- the globe: the city ringed, the birthplaces, the ways in ---------------- */

  var cv = null, ctx = null, raf = 0;
  function kick() { if (!raf) { raf = window.requestAnimationFrame(draw); } }
  function slerp(a, b, t) {
    var R = Math.PI / 180;
    var la1 = a[0] * R, lo1 = a[1] * R, la2 = b[0] * R, lo2 = b[1] * R;
    var A = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
    var B = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
    var d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
    if (d < 1e-6) { return [a[0], a[1], 0]; }
    var s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    var v = [A[0] * s1 + B[0] * s2, A[1] * s1 + B[1] * s2, A[2] * s1 + B[2] * s2];
    return [Math.atan2(v[2], Math.hypot(v[0], v[1])) / R, Math.atan2(v[1], v[0]) / R, d];
  }
  function tile(x, y, a, inset) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    ctx.globalAlpha = a;
    ctx.fillRect(gx + inset, gy + inset, C - 2 * inset, C - 2 * inset);
  }
  // What the movement drew on the globe last frame that matters (the birthplaces, the ateliers, the
  // city's ring), as boxes: the reading's grown globe keeps the layer's marks and names off them (land.js).
  var drawn = [];
  function keep(x0, y0, x1, y1) { drawn.push({ x0: x0, y0: y0, x1: x1, y1: y1 }); }
  function canvas() {
    if (cv) { return; }
    var tiles = document.getElementById("tiles");
    cv = el("canvas", "world world-tiles life-route movement-route");
    cv.setAttribute("aria-hidden", "true");
    if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(cv, tiles.nextSibling); } else { document.body.appendChild(cv); }
    ctx = cv.getContext("2d");
  }
  function draw(now) {
    raf = 0;
    canvas();
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawn = [];
    var w = window.Land && Land.where ? Land.where() : {};
    if (view && view.api.live() && w.at === "movement") {
      follow();
      drawMovement(view, still ? 0 : Math.floor((now || 0) / (1000 / 24)));
      kick();
    }
  }
  function drawMovement(v, t) {
    var m = v.m, api = v.api, y = v.y || m.y0;
    var city = townLL(m.key);
    if (!city) { return; }
    var seen = {};
    // Each artist's way to the city: from where they were born, every other tile; lit once they have come.
    m.members.forEach(function (r) {
      var a = artist(r[0]);
      if (!a[7] || !a[7].length) { return; }
      var from = [a[7][1], a[7][2]];
      var come = r[1] <= y;
      var d = slerp(from, city, 0.5)[2] || 0;
      var steps = Math.max(4, Math.ceil(d * 220));
      ctx.fillStyle = come ? CREAM : LILAC;
      for (var s = 0; s <= steps; s += 1) {
        var ll = slerp(from, city, s / steps);
        var q = api.at(ll[0], ll[1]);
        if (q.z < 0.08) { continue; }
        var gx = Math.floor(q.x / C), gy = Math.floor(q.y / C), id = gx + "," + gy;
        if (seen[id] || (gx + gy) % 2) { continue; }
        seen[id] = true;
        tile(q.x, q.y, (come ? 0.42 : 0.14) * Math.min(1, (q.z - 0.08) * 6), 4);
      }
      // The birthplace: a small cream square.
      var b = api.at(from[0], from[1]);
      if (b.z > 0.05) {
        ctx.fillStyle = CREAM;
        var bx = Math.floor(b.x / C) * C, by = Math.floor(b.y / C) * C;
        keep(bx, by, bx + C, by + C);
        ctx.globalAlpha = come ? 0.85 : 0.35;
        ctx.fillRect(bx + 4, by + 4, C - 8, C - 8);
      }
    });
    // Where they were in the city that year: an atelier each.
    m.members.forEach(function (r) {
      if (!(r[1] <= y && y <= r[2])) { return; }
      var p = presence(r[0], m.key, y);
      if (!p) { return; }
      var q = api.at(p[4], p[5]);
      if (q.z > 0.05) { atelier(q.x, q.y, 0.95); }
    });
    // The city, ringed while the movement's years are on the dial.
    var c = api.at(city[0], city[1]);
    if (c.z > 0.05) { ring(c.x, c.y, y >= m.y0 && y <= m.y1 ? 2 : 1, t, y >= m.y0 && y <= m.y1 ? 0.8 : 0.4); }
    ctx.globalAlpha = 1;
  }
  function atelier(x, y, a) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    keep(gx, gy, gx + C, gy + C);
    ctx.globalAlpha = a;
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx + 1.5, gy + 1.5, C - 3, C - 3);
    ctx.fillStyle = LILAC;
    ctx.fillRect(gx + 4, gy + 4, C - 8, C - 8);
    ctx.globalAlpha = 1;
  }
  function ring(x, y, rr, t, a) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    keep(gx - (rr + 1) * C, gy - (rr + 1) * C, gx + (rr + 2) * C, gy + (rr + 2) * C);
    ctx.fillStyle = LILAC;
    for (var e = 0; e < 2; e += 1) {
      var R = rr + e;
      ctx.globalAlpha = a * [1, 0.42][e];
      for (var dx = -R; dx <= R; dx += 1) {
        for (var dy = -R; dy <= R; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) { continue; }
          if ((dx + dy + (t >> 2)) & 1) { continue; }
          ctx.fillRect(gx + dx * C + 3, gy + dy * C + 3, C - 6, C - 6);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- played: the movement as a walk (explorations.js, relay kind "m") -------- */

  function play(m) {
    if (!window.Explorations || !Explorations.play) { return; }
    Explorations.play({ id: m.id, kind: "movement", title: heading(m), by: "", stops: [{ k: "r", id: "m:" + m.id, from: 0 }] });
  }
  // Each stop of the walk: the movement's view at that year, the world eased to the place.
  function steps(id, from) {
    return load().then(function () {
      var m = mv(id);
      if (!m) { return []; }
      return m.walk.slice(from || 0).map(function (s, i) {
        return { k: "movement", mv: id, key: s[0], y: s[1], who: s[2], n: (from || 0) + i, of: m.walk.length };
      });
    });
  }
  function visit(step) {
    return load().then(function () {
      var m = mv(step.mv);
      if (!m) { return null; }
      var lines = [], ll = townLL(step.key);
      var a = step.who >= 0 ? artist(step.who) : null;
      if (step.key === m.key) {
        var n = m.members.filter(function (r) { return r[1] <= step.y && step.y <= r[2]; }).length;
        lines.push(townName(step.key) + ", " + step.y);
        lines.push(n ? plural(n, "of its artists", "of its artists") + " here that year" : "Its artists are on their way");
        lines.push(step.n === 0 ? "The movement begins here" : "Where it ends, " + m.y1);
      } else {
        lines.push((a ? a[1] + " · " : "") + townName(step.key) + ", " + step.y);
        lines.push(step.y < m.y0 ? "Before " + townName(m.key) : "While the others were in " + townName(m.key));
        if (a && a[7] && a[7][0]) { lines.push("Born in " + a[7][0]); }
      }
      var go = function () {
        if (view && view.m.id === m.id && view.api.live()) {
          view.api.setYear(step.y);
          if (ll) { view.api.glide(ll[0], ll[1]); }
          return Promise.resolve(true);
        }
        return open(m.id, { year: step.y }).then(function () { return true; });
      };
      return go().then(function () { return { lines: lines }; });
    });
  }

  /* ---- Find: "movements", a city, a decade, a movement's name, an artist ------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");
  function matches(t) {
    var all = /^ (movements?|overlaps?|lives that cross) $/.test(t);
    var dec = /^ (\d{3})0 ?s $/.exec(t) || /^ (\d{4}) $/.exec(t);
    var q = t.replace(/ movements? $/, " ");
    return D.movements.filter(function (m) {
      if (all) { return true; }
      if (dec) {
        var a = dec[1].length === 3 ? +dec[1] * 10 : +dec[1], b = dec[1].length === 3 ? a + 9 : a;
        return m.y0 <= b && m.y1 >= a;
      }
      if (q.trim().length < 3) { return false; }
      var hay = fold([m.title, m.city, m.at, m.label ? m.label.name : "", townName(m.key)].concat((m.among || []).map(function (x) { return x[1]; })).join(" "));
      if (hay.indexOf(q) >= 0) { return true; }
      return /movements? $/.test(t) && m.members.some(function (r) { return fold(artist(r[0])[1]).indexOf(q) >= 0; });
    });
  }
  function offer() {
    if (!field || !found) { return; }
    var text = field.value, t = fold(text);
    if (t.trim().length < 3) { return; }
    load().then(function () {
      if (!D || field.value !== text) { return; }
      var old = found.querySelector(".movement-found");
      if (old) { old.remove(); }
      var rows = matches(t);
      if (!rows.length) { return; }
      var all = /^ (movements?|overlaps?|lives that cross) $/.test(t);
      var box = el("div", "explore-found movement-found");
      box.appendChild(el("p", "finder-group", all ? "Movements · " + rows.length + " · where three saved artists or more overlapped" : "Movements"));
      rows.slice(0, all ? 40 : 6).forEach(function (m, k) {
        var b = el("button", "finder-row finder-line studio-cat movement-cat");
        b.type = "button";
        b.appendChild(el("span", "studio-cat-name", heading(m)));
        b.appendChild(el("span", "studio-cat-meta", m.who + " · " + plural(m.members.length, "artist", "artists") +
          (!m.label && m.among && m.among.length ? " · among them " + m.among[0][1] + " " + m.among[0][2] : "")));
        b.style.animationDelay = (still ? 0 : Math.min(k, 13) * 60) + "ms";
        b.addEventListener("click", function (event) { event.stopPropagation(); open(m.id); });
        box.appendChild(b);
      });
      found.insertBefore(box, found.firstChild);
    });
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offer, 380); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && field.value && !found.querySelector(".movement-found")) { offer(); } })
      .observe(found, { childList: true });
  }

  window.setInterval(function () { if (view && !raf) { kick(); } }, 700);

  window.Movements = {
    load: load,
    open: open,
    start: start,
    stop: stop,
    steps: steps,
    visit: visit,
    play: function (id) { return load().then(function () { var m = mv(id); if (m) { play(m); } }); },
    heading: function (id) { var m = mv(id); return m ? heading(m) : ""; },
    // What the movement drew on the globe last frame, as boxes (the grown globe keeps its marks off them).
    marks: function () { return drawn; },
    // For the dial's hub and the relay.
    data: function () { return D; },
    forCity: function (key) { return D && D.cities[key] ? D.cities[key].map(function (i) { return D.movements[i]; }) : []; },
    here: function (key) { return D && D.here[key] || []; },
    ofArtistName: function (name) {
      if (!D) { return []; }
      var i = D.byName[name];
      return i === undefined ? [] : D.ofArtist[i].map(function (j) { return D.movements[j]; });
    },
    presencesOf: function (name) { var i = D ? D.byName[name] : undefined; return i === undefined ? [] : D.presOf[i]; },
    artistIndex: function (name) { return D ? D.byName[name] : undefined; },
    relayRows: function () { return D ? D.relay : []; },
    relayRow: function (id) { var m = mv(id); return m ? D.relay[D.byId[id]] : null; },
    _state: function () {
      var col = document.getElementById("art-col");
      return { loaded: !!D, movements: D ? D.movements.length : 0, open: view ? view.m.id : null, year: view ? view.y : null,
               column: col && view ? col.innerText.slice(0, 600) : "" };
    }
  };
})();

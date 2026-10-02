/* Painted here — where a work was painted, as the record documents it.

   The artist, 1 Oct 2026, sending van Gogh's Tree Roots, a postcard of the
   rue Daubigny with the painting laid into it, and the street today:
   "Evidence of where exactly plein air paintings were made … is a really
   great way to extend a line of inquiry into a specific artwork or artist.
   Find all other instances of documented sites that correspond to a
   specific artwork and use them as new explorations available for the
   viewer. Photographs of specific sites preferred in addition to any
   articles or commentary on the photograph of the site or painting."

   sites.json (scripts/build_sites.py, from Wikidata, by hand with sources):
   one row a work — the point, how exact it is (where the painter stood;
   the place painted; the street; only the town), the site's photographs
   (Commons files, shown live from Commons, never copied), the sentences
   that document it, the sources.

   In a work's view: "Painted here" heads "Where it has been" (land.js asks
   Sites.stop(h)); its head rings the point on the globe, "Enter ›" flies
   down to it, the pair opens the plate. The plate: the painting and the
   site side by side (never laid into each other: no alignment is
   documented), credits under each, the commentary quoted, the sources. In
   a city at rest no site is drawn (artist, 2 Oct 2026: "way too many
   dots"); the sites that belong to what is selected — a life entered, a
   studio, an animal followed, an exploration played, the artists the dial
   lights in its year, or in Explore the sites painted in its year, faint —
   are quiet hollow tiles; pressing one opens its plate. Site explorations
   (explorations.json "sites", played by explorations.js) visit each site
   low, the plate open, on the reading's clock. Find offers them ("painted
   here", "sites", an artist, a place). */
(function () {
  "use strict";

  var COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";
  var C = 13;                                   // the pixel light's tile
  var LAV = "#9d95e6", CREAM = "#eadfcd";
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var D = null, loading = null, CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var current = null;                           // the site ringed: a row
  var visited = null;                           // the city it was gone to (visit): { key, at, reached }
  var ringOn = false;                           // the ring drawn last frame (for checking)
  var plate = null, cv = null, ctx = null, raf = 0, marks = [];
  var waiting = [];                             // column stops made before sites.json came

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
  function fold(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  function load() {
    if (D) { return Promise.resolve(D); }
    if (loading) { return loading; }
    loading = fetch("sites.json").then(function (r) { if (!r.ok) { throw new Error("sites"); } return r.json(); })
      .then(function (d) {
        d.byW = {};
        d.byId = {};
        d.sites.forEach(function (s, i) { if (s.w) { d.byW[s.w] = i; } d.byId[s.id] = i; });
        D = d;
        waiting.forEach(function (f) { f(); });
        waiting = [];
        return D;
      }).catch(function () { loading = null; return null; });
    return loading;
  }

  function commons(f, w) { return COMMONS + encodeURIComponent(f) + (w ? "?width=" + w : ""); }
  function surname(a) {
    var w = String(a || "").split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function kmFor(s) { return { view: 0.9, site: 1.2, street: 1.4 }[s.pr] || 4; }

  /* How exact, in words. */
  function exactly(s) {
    var what = s.what || "";
    switch (s.pr) {
      case "view": return "Where the painter stood · Wikidata’s point of view";
      case "site": return (s.how === "made" ? "Made at " : "It shows ") + (what || "the place") + " · the ring is on the place painted, not the easel";
      case "street": return "On " + (what || "the street") + " · the street is documented, not the spot";
      default: return "Painted in " + (what || "the town") + " · only the town is documented";
    }
  }

  function placeName(s) { return s.place || s.what || ""; }

  function paintingSrc(s) {
    if (s.w) {
      var r = window.__findingRow && window.__findingRow(s.w);
      if (r && r[4]) { return CDN + r[4] + "/medium.jpg"; }
      return null;
    }
    return s.img ? commons(s.img, 640) : null;
  }

  /* The saved work's picture comes from its history (fetched once). */
  var pics = {};
  function savedPicture(s) {
    if (!s.w) { return Promise.resolve(paintingSrc(s)); }
    if (pics[s.w] !== undefined) { return Promise.resolve(pics[s.w]); }
    return fetch("histories/" + s.w + ".json").then(function (r) { return r.json(); }).then(function (h) {
      pics[s.w] = h.image ? CDN + h.image + "/medium.jpg" : null;
      return pics[s.w];
    }, function () { pics[s.w] = null; return null; });
  }

  function credit(ph) {
    var bits = [];
    if (ph.of) { bits.push(ph.of); }
    if (ph.d) { bits.push(ph.d + " m from the point"); }
    if (ph.when === "then") { bits.push("then"); }
    bits.push((ph.when === "then" ? "picture " : "photo ") + (ph.by || "Wikimedia Commons") + (ph.lic ? ", " + ph.lic : ""));
    return bits.join(" · ");
  }

  function figure(src, alt, cap, cls) {
    var fig = el("figure", "site-fig" + (cls ? " " + cls : ""));
    var img = el("img");
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    if (src) { img.src = src; }
    img.addEventListener("error", function () { fig.dataset.missing = "true"; });
    img.addEventListener("load", function () { fig.dataset.on = "true"; });
    fig.appendChild(img);
    if (cap) { fig.appendChild(el("figcaption", "", cap)); }
    return fig;
  }

  function pair(s, big) {
    var box = el("div", "site-pair" + (big ? " site-pair-big" : ""));
    var paint = figure(null, (s.t || "The painting") + ", " + (s.a || ""), big ? "The painting" + (s.m ? " · " + s.m : "") : null, "site-paint");
    savedPicture(s).then(function (src) { if (src) { paint.querySelector("img").src = src; } else { paint.dataset.missing = "true"; } });
    box.appendChild(paint);
    var ph = (s.photos || [])[0];
    if (ph) {
      var fig = figure(commons(ph.f, big ? 960 : 480), "The site: " + (ph.of || placeName(s)), big ? "The site · " + credit(ph) : null, "site-photo");
      box.appendChild(fig);
      if (big && s.photos.length > 1) {
        var k = 0, tabs = el("div", "site-tabs");
        s.photos.forEach(function (p, i) {
          var b = button(p.when === "then" ? "then" : i ? String(i + 1) : "now", "site-tab", function () {
            k = i;
            fig.querySelector("img").src = commons(p.f, 960);
            fig.querySelector("figcaption").textContent = "The site · " + credit(p);
            tabs.querySelectorAll(".site-tab").forEach(function (t, j) { t.dataset.on = j === k ? "true" : "false"; });
          });
          b.dataset.on = i === 0 ? "true" : "false";
          tabs.appendChild(b);
        });
        fig.appendChild(tabs);
      }
    } else {
      var none = el("figure", "site-fig site-none");
      none.appendChild(el("p", "", "No photograph of the site is on Commons yet"));
      box.appendChild(none);
    }
    return box;
  }

  function saidEl(e) {
    var one = el("div", "art-said-one site-said");
    one.dataset.k = "wiki";
    one.appendChild(el("p", "art-said-q", "“" + e.q + "”"));
    var by = el("p", "art-said-by");
    by.appendChild(el("span", "art-said-who", e.by));
    if (e.in) { by.appendChild(el("span", "art-said-in", e.in)); }
    if (e.url && /^https?:\/\//.test(e.url)) {
      var host = e.url;
      try { host = new URL(e.url).hostname.replace(/^www\./, ""); } catch (x) {}
      var go = el("a", "art-go", "Read it at " + host + " ↗");
      go.href = e.url;
      go.target = "_blank";
      go.rel = "noopener";
      by.appendChild(document.createTextNode(" "));
      by.appendChild(go);
    }
    one.appendChild(by);
    return one;
  }

  function sourcesEl(s) {
    var p = el("p", "art-sources site-src");
    p.appendChild(document.createTextNode("From "));
    (s.src || []).forEach(function (x, i) {
      if (i) { p.appendChild(document.createTextNode("; ")); }
      if (x.url && /^https?:\/\//.test(x.url)) {
        var a = el("a", "site-src-a", x.name);
        a.href = x.url;
        a.target = "_blank";
        a.rel = "noopener";
        p.appendChild(a);
      } else { p.appendChild(document.createTextNode(x.name)); }
    });
    var lic = (s.photos || []).length ? " Photographs from Wikimedia Commons, under their own licences." : "";
    p.appendChild(document.createTextNode("." + lic));
    return p;
  }

  /* ---- in a work's view: the first stop of "Where it has been" ------------- */

  function fillStop(li, s) {
    li.textContent = "";
    li.hidden = false;
    li.dataset.site = s.id;
    var row = el("div", "art-stop-row");
    var hd = el("button", "art-stop-head site-head", "Painted here" + (placeName(s) ? " · " + placeName(s) : ""));
    hd.type = "button";
    hd.setAttribute("aria-label", "Painted here" + (placeName(s) ? ", " + placeName(s) : "") + ": show it on the globe");
    hd.addEventListener("click", function (event) { event.stopPropagation(); ring(s); if (window.Land && Land.look) { Land.look(s.ll[0], s.ll[1]); } });
    row.appendChild(hd);
    if (s.key && s.pr !== "town") {
      var into = el("button", "art-stop-in", "Enter ›");
      into.type = "button";
      into.setAttribute("aria-label", "Go down to where it was painted");
      into.addEventListener("click", function (event) { event.stopPropagation(); visit(s); });
      row.appendChild(into);
    }
    li.appendChild(row);
    li.appendChild(el("p", "site-exact", exactly(s)));
    if (s.pr !== "town") {
      var p = pair(s, false);
      p.setAttribute("role", "button");
      p.tabIndex = 0;
      p.setAttribute("aria-label", "The painting beside the site: open");
      p.addEventListener("click", function (event) { event.stopPropagation(); openPlate(s); });
      p.addEventListener("keydown", function (event) { if (event.key === "Enter") { openPlate(s); } });
      li.appendChild(p);
      var ph = (s.photos || [])[0];
      if (ph) { li.appendChild(el("p", "site-credit", credit(ph))); }
    }
    (s.said || []).slice(0, 1).forEach(function (e) { li.appendChild(saidEl(e)); });
    ring(s);
  }

  function stop(h) {
    if (!h || !h.id) { return null; }
    var li = el("li", "art-stop site-stop");
    li.hidden = true;
    function fill() {
      var i = D && D.byW[h.id];
      if (i === undefined || i === null) { li.remove(); return; }
      fillStop(li, D.sites[i]);
    }
    if (D) { fill(); } else { waiting.push(fill); load(); }
    return D && D.byW[h.id] === undefined ? null : li;
  }

  /* ---- the plate: the painting beside the site ----------------------------- */

  function closePlate() {
    if (!plate) { return; }
    plate.hidden = true;
    plate.textContent = "";
    plate.dataset.site = "";
  }

  function openPlate(s, opts) {
    opts = opts || {};
    if (!plate) {
      plate = el("section", "site-plate");
      plate.setAttribute("aria-label", "Painted here");
      ["pointerdown", "wheel", "touchstart", "keydown"].forEach(function (t) {
        plate.addEventListener(t, function (event) { event.stopPropagation(); if (t === "keydown" && event.key === "Escape") { closePlate(); } }, { passive: t !== "pointerdown" && t !== "keydown" });
      });
      document.body.appendChild(plate);
    }
    plate.textContent = "";
    plate.hidden = false;
    plate.dataset.site = s.id;
    var head = el("header", "site-plate-head");
    head.appendChild(el("p", "site-kicker", "Painted here" + (placeName(s) ? " · " + placeName(s) : "")));
    var t = el("p", "site-title");
    t.appendChild(el("i", "", s.t || "Untitled"));
    head.appendChild(t);
    head.appendChild(el("p", "site-by", [s.a, s.d].filter(Boolean).join(" · ") + (s.m ? " · " + s.m : "")));
    head.appendChild(button("×", "site-x", closePlate));
    plate.appendChild(head);
    plate.appendChild(pair(s, true));
    plate.appendChild(el("p", "site-exact", exactly(s)));
    var body = el("div", "site-plate-body");
    (s.said || []).forEach(function (e) { body.appendChild(saidEl(e)); });
    body.appendChild(sourcesEl(s));
    var acts = el("div", "site-acts");
    if (s.w && !opts.inWork) {
      acts.appendChild(button("Where it has been ›", "read-quiet", function () { closePlate(); if (window.Land) { Land.work(s.w, s.key); } }));
    }
    if (s.key && s.pr !== "town" && !opts.here) {
      acts.appendChild(button("Go there ›", "read-quiet", function () { visit(s); }));
    }
    acts.appendChild(button("Put it away", "read-quiet", closePlate));
    body.appendChild(acts);
    plate.appendChild(body);
    ring(s);
    var x = plate.querySelector(".site-x");
    if (x && !opts.quiet) { try { x.focus({ preventScroll: true }); } catch (e) {} }
  }

  /* ---- going there: the site's city, held low on the point ------------------ */

  function where() { return window.Land && Land.where ? Land.where() : { at: "world" }; }

  function visit(s) {
    return load().then(function () {
      if (!window.Land || !Land.site || !s.key) { return false; }
      ring(s);
      visited = { key: s.key, at: performance.now(), reached: false };   // ringed in that city until it is left
      Land.site(s.key, s.ll[0], s.ll[1], kmFor(s), s.km > 15 && s.place ? s.place : "");
      return new Promise(function (done) {
        var t0 = performance.now();
        (function tick() {
          var w = where();
          if (!w.flying && w.at === "town" && w.key === s.key) { openPlate(s, { here: true, quiet: true }); done(true); return; }
          if (performance.now() - t0 > 16000) { done(false); return; }
          window.setTimeout(tick, 250);
        })();
      });
    });
  }

  /* ---- on the globe: the ring, and the quiet marks in a city ---------------- */

  function setUpCanvas() {
    if (cv) { return; }
    var tiles = document.getElementById("tiles");
    cv = el("canvas", "world world-tiles site-marks");
    cv.setAttribute("aria-hidden", "true");
    if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(cv, tiles.nextSibling); } else { document.body.appendChild(cv); }
    ctx = cv.getContext("2d");
  }

  function ring(s) { current = s; kick(); }

  function kick() { if (!raf) { raf = window.requestAnimationFrame(draw); } }

  /* What is selected, and so which documented sites a city draws (artist, 2 Oct 2026:
     "there's way too many dots right now … Perhaps when an artist is selected then all the
     places relevant to them … show up and all the other places for other artists do not show
     up"). At rest a city draws none: its museums' diamonds and its galleries' tiles are its
     own marks. Each rule names the sites it takes (by id, or by artist), the year they must
     be painted in, if any, and how bright: a life entered here (lives.js) its sites; a
     studio's column open, or an animal followed, its artist's; a site exploration played its
     own sites, a hunt its artist's; the dial, in its year, the artists it lights (Artists; a
     movement's members, Movements) — and in Explore every site painted in its year, faint. */
  function names(list) {
    var o = {};
    list.forEach(function (n) { keysOf(n).forEach(function (k) { o[k] = true; }); });
    return o;
  }
  // An artist's name as two keys: whole, and first and last word (Wikidata's "Anders Zorn" is
  // the lives' "Anders Leonard Zorn").
  function keysOf(n) {
    var t = fold(n).replace(/[-‐–.,]/g, " ").trim().split(/\s+/).filter(Boolean);
    return t.length ? [t.join(" "), t[0] + " " + t[t.length - 1]] : [];
  }
  function chosen(w) {
    var rules = [];
    var life = window.Lives && Lives.visiting ? Lives.visiting() : null;
    if (life && life.sites) { var lids = {}; life.sites.forEach(function (id) { lids[id] = true; }); rules.push({ sid: lids, a: 0.62 }); }
    var st = window.Studios && Studios.showing ? Studios.showing() : null;
    if (st && st.artist) { rules.push({ who: names([st.artist]), a: 0.62 }); }
    var f = window.Land && Land.following ? Land.following() : null;
    if (f && f.artist && !f.voice) { rules.push({ who: names([f.artist]), a: 0.62 }); }
    var p = window.Explorations && Explorations.playing ? Explorations.playing() : null;
    if (p && p.sites) { var ix = {}; p.sites.forEach(function (i) { ix[i] = true; }); rules.push({ ix: ix, a: 0.62 }); }
    if (p && p.artist) { rules.push({ who: names([p.artist]), a: 0.62 }); }
    var d = window.DialHub && DialHub.lit ? DialHub.lit() : null;
    if (d && d.key === w.key && d.year) {
      if (d.mode === "explore") { rules.push({ year: d.year, a: 0.3 }); }
      else if (d.names.length) { rules.push({ who: names(d.names), year: d.year, a: 0.62 }); }
    }
    return rules;
  }
  function takes(rules, s, i) {
    var a = 0;
    rules.forEach(function (r) {
      if (r.sid && !r.sid[s.id]) { return; }
      if (r.ix && !r.ix[i]) { return; }
      if (r.year && s.d !== r.year) { return; }
      if (r.who && !(s.keys || (s.keys = keysOf(s.a))).some(function (k) { return r.who[k]; })) { return; }
      a = Math.max(a, r.a);
    });
    return a;
  }

  function draw(now) {
    raf = 0;
    setUpCanvas();
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    marks = [];
    var w = where();
    if (!window.Land || !Land.at || !D) { return; }
    // The ring is the site selected: in a work's view its own; in a city the one gone to, or
    // whose plate is open; elsewhere only while its plate is open.
    var plateOn = !!(current && plate && !plate.hidden && plate.dataset.site === current.id);
    var showRing = !!current && (plateOn || (w.at === "work" && current.w === w.work) ||
                                 (w.at === "town" && !!visited && visited.key === current.key && w.key === visited.key));
    ringOn = showRing;
    var any = false;
    // The quiet marks: in a city, only the documented sites that belong to what is selected.
    var rules = w.at === "town" && !w.flying ? chosen(w) : [];
    if (rules.length) {
      var seen = {};
      D.sites.forEach(function (s, i) {
        if (s.pr === "town") { return; }
        var a = takes(rules, s, i);
        if (!a) { return; }
        var p = Land.at(s.ll[0], s.ll[1]);
        if (!p || p.z < 0.05 || p.x < 0 || p.y < 0 || p.x > W || p.y > H) { return; }
        var gx = Math.floor(p.x / C), gy = Math.floor(p.y / C), id = gx + "," + gy;
        if (seen[id]) { seen[id].ids.push(i); seen[id].a = Math.max(seen[id].a, a); return; }
        seen[id] = { x: gx * C + C / 2, y: gy * C + C / 2, ids: [i], a: a, gx: gx, gy: gy };
        marks.push(seen[id]);
      });
      marks.forEach(function (m) {
        ctx.globalAlpha = m.a;
        ctx.strokeStyle = CREAM;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(m.gx * C + 3.5, m.gy * C + 3.5, C - 7, C - 7);
        // the easel's foot: one step of light under the tile
        ctx.fillStyle = CREAM;
        ctx.fillRect(m.gx * C + 6, m.gy * C + C - 2, 1, 3);
      });
      any = marks.length > 0;
    }
    if (showRing && current) {
      var q = Land.at(current.ll[0], current.ll[1]);
      if (q && q.z > 0.02) {
        var gx2 = Math.floor(q.x / C) * C, gy2 = Math.floor(q.y / C) * C;
        // a ring of tiles round the point, stepped at 24 fps, three echoes
        var t = still ? 0 : Math.floor((now || 0) / (1000 / 24));
        ctx.fillStyle = LAV;
        for (var e = 0; e < 3; e += 1) {
          var r = 1 + e + ((t >> 3) % 2 && e === 2 ? 1 : 0);
          ctx.globalAlpha = [0.95, 0.55, 0.28][e];
          for (var dx = -r; dx <= r; dx += 1) {
            for (var dy = -r; dy <= r; dy += 1) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) { continue; }
              if (e && ((dx + dy + t) & 1)) { continue; }      // ragged edges
              ctx.fillRect(gx2 + dx * C + 2, gy2 + dy * C + 2, C - 4, C - 4);
            }
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillRect(gx2 + 3, gy2 + 3, C - 6, C - 6);
        any = true;
      }
    }
    ctx.globalAlpha = 1;
    if (any || showRing) { raf = window.requestAnimationFrame(draw); }
  }

  // A press on a mark, in a city: its plate (several on one tile: the first; the plate lists the rest? no — one at a time).
  window.addEventListener("pointerdown", function (event) {
    if (!marks.length || event.button > 0) { return; }
    if (event.target.closest && event.target.closest(".art-col, .site-plate, button, a, input, .walk-strip, .explore-tray, .explore-dock")) { return; }
    var reach = event.pointerType === "touch" ? 16 : 10, best = null, bd = 1e9;
    marks.forEach(function (m) {
      var d = Math.max(Math.abs(m.x - event.clientX), Math.abs(m.y - event.clientY));
      if (d < reach && d < bd) { bd = d; best = m; }
    });
    if (!best) { return; }
    event.stopPropagation();
    event.preventDefault();
    var k = best.k = ((best.k || 0) + 1) % best.ids.length;
    var s = D.sites[best.ids[k]];
    openPlate(s, { here: true });
  }, true);

  /* ---- the work being read: its site ringed in the band --------------------- */

  var lastWork = null;
  function poll() {
    var w = where();
    if (w.at === "work" && w.work !== lastWork) {
      lastWork = w.work;
      load().then(function () { var i = D && D.byW[w.work]; if (i !== undefined && i !== null) { ring(D.sites[i]); } });
    } else if (w.at !== "work") {
      lastWork = null;
    }
    if (w.at === "world" && !w.flying && plate && !plate.hidden && !(window.Explorations && Explorations._state && (Explorations._state().playing || {}).title)) { closePlate(); }
    // The city gone to is left (for the world, another city or any other view): its site is no longer ringed there.
    if (visited && !w.flying) {
      var there = w.at === "town" && w.key === visited.key;
      if (there) { visited.reached = true; }
      else if (visited.reached || performance.now() - visited.at > 20000) { visited = null; }
    }
    if (w.at === "town" || w.at === "work" || (plate && !plate.hidden)) { kick(); }
  }
  window.setInterval(poll, 400);

  /* ---- Find: the site explorations, and a work by its title ----------------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");

  function playExp(e) {
    if (!window.Explorations || !Explorations.play) { return; }
    Explorations.play({ id: e.id, kind: "sites", title: e.title, by: "", stops: [{ k: "r", id: "s:" + e.id, from: 0 }] });
  }

  function offer() {
    if (!field || !found || found.querySelector(".site-found")) { return; }
    var text = field.value, t = fold(text).trim();
    if (t.length < 4) { return; }
    load().then(function () {
      if (!D || field.value !== text || found.querySelector(".site-found")) { return; }
      var all = /^(painted here|paint(ed|ing)? sites?|sites?|plein air|en plein air|where (it was )?painted)$/.test(t);
      var exps = all ? D.explorations : D.explorations.filter(function (e) {
        return (" " + fold(e.artist + " " + e.place + " " + e.title)).indexOf(" " + t) >= 0;
      });
      var works = all ? [] : D.sites.filter(function (s) {
        return s.pr !== "town" && (fold(s.t).indexOf(t) === 0 || (t.length >= 6 && fold(s.t).indexOf(t) >= 0));
      }).slice(0, 6);
      if (!exps.length && !works.length) { return; }
      var box = el("div", "explore-found site-found");
      box.appendChild(el("p", "finder-group", "Painted here"));
      exps.slice(0, all ? 60 : 8).forEach(function (e) {
        var b = el("button", "finder-row finder-line", "Sites: " + e.title);
        b.type = "button";
        b.addEventListener("click", function (event) { event.stopPropagation(); playExp(e); });
        box.appendChild(b);
      });
      works.forEach(function (s) {
        var b = el("button", "finder-row finder-line", "Painted here: " + s.t + " · " + surname(s.a) + (placeName(s) ? " · " + placeName(s) : ""));
        b.type = "button";
        b.addEventListener("click", function (event) { event.stopPropagation(); if (s.key) { visit(s); } else { openPlate(s); } });
        box.appendChild(b);
      });
      found.insertBefore(box, found.firstChild);
    });
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offer, 340); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && fold(field.value).trim().length >= 4) { offer(); } }).observe(found, { childList: true });
  }

  window.addEventListener("keydown", function (event) { if (event.key === "Escape" && plate && !plate.hidden) { closePlate(); } });

  if (window.requestIdleCallback) { window.requestIdleCallback(function () { load(); }, { timeout: 4000 }); }
  else { window.setTimeout(load, 1500); }

  window.Sites = {
    load: load,
    stop: stop,
    open: function (id) { return load().then(function () { var i = D && D.byId[id]; if (i !== undefined) { openPlate(D.sites[i]); } }); },
    // explorations.js: a site exploration's stop, by sites.json rows; resolves with the lines to say.
    visit: function (ids) {
      return load().then(function () {
        var s = D && D.sites[ids[0]];
        if (!s) { return null; }
        return visit(s).then(function () {
          var titles = ids.map(function (i) { var x = D.sites[i]; return x.t + (x.d ? ", " + x.d : ""); });
          var lines = [titles[0], exactly(s)];
          if (s.said && s.said[0]) { lines.push("“" + s.said[0].q.split(/(?<=\.)\s/)[0] + "”"); }
          return { lines: lines, titles: titles, sites: ids.map(function (i) { return D.sites[i]; }) };
        });
      });
    },
    show: function (i) { return load().then(function () { var s = D && D.sites[i]; if (s) { openPlate(s, { here: true, quiet: true }); } }); },
    close: closePlate,
    _state: function () {
      var w = where();
      return { loaded: !!D, n: D ? D.sites.length : 0, current: current && current.id, plate: plate && !plate.hidden ? plate.innerText.slice(0, 400) : "", marks: marks.length,
               ringed: ringOn, rules: w.at === "town" ? chosen(w).map(function (r) { return Object.keys(r).filter(function (k) { return k !== "a"; }).join("+") + " " + r.a; }) : [] };
    }
  };
})();

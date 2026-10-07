/* The city guide (guide.js).

   The artist, 7 Oct 2026, with a screenshot of the Artsy app's home (a
   "London City Guide" pill beside "Discover Daily" and "Auctions"): "Artsy
   is starting to do this thing where at the top it shows a suggested guide
   for a city. Explore that function on artsy and implement a version of
   that. It's more like what I had in mind with the explore function".

   What is on now, and soon, in a city: the shows Artsy lists there, read by
   scripts/fetch_city_guides.py into guides/<city key>.json (the index is
   guides.json). The design: docs/v2/GUIDE.md.

   The way in is a quiet pill, as Artsy's: at the head of a city's column
   ("London Guide", under the categories' header), and on the world at the
   foot beside Search, naming the guided city nearest the middle of the
   globe ("Guide · London"), which flies there and opens it. The guide
   replaces the city's directory while it is open ("‹ London" back): when it
   was read, then Your artists (shows with the artist's saved artists — what
   Artsy cannot know), Closing soon, Opening soon, Museums, Galleries, Fairs.
   A show opens in place (its cover large, its dates, today's hours, its
   address, its artists — a saved artist's life a door — and the saved works
   in it); its venue is ringed on the city in pixel light and the city eased
   to it. While the guide is open its shows are faint tiles at their points,
   and only then. Walk the guide: the shows on now, ordered as a walk from
   the one open (else the city's middle), played through the dial
   (transport.js) and said on the reading's slow clock.

   No hooks in land.js: Land.where (polled), Land.town, Land.look, Land.at,
   Land.museum, Land.work; Dial.path and Dial.read; Lives.open. One address:
   nothing here touches the URL. */
(function () {
  "use strict";

  var C = 13;
  var LILAC = "#9d95e6", LIGHT = "#5e52c7", CREAM = "#eadfcd", SEA = "#8fc7bd";
  var PHI = 1.618;
  var SAY = [4000, 11000, 20000];            // the reading's slow clock: title, partner and dates, its artists
  var STOP_MS = 17000 * PHI;                 // a stop looked at: Smith & Smith's median look × φ (as the walks)
  var STILL_MS = 1500;                       // the clock moves only while the pointer is still
  var STALE_DAYS = 21;
  var FIRST = 6;                             // rows a section shows before "All N"
  var WALK_MAX = 12;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var artCol = document.getElementById("art-col");
  var index = null, indexP = null, files = {}, finding = null;
  var st = { key: null, g: null, open: false, show: null, pending: null };
  var pill = null, box = null, worldPill = null;
  var walk = null, tp = null, readEl = null;
  var movedAt = 0;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function button(cls, text, fn) {
    var b = el("button", cls, text);
    b.type = "button";
    if (fn) { b.addEventListener("click", function (event) { event.stopPropagation(); fn(event); }); }
    return b;
  }
  function json(url) {
    return fetch(url).then(function (r) { if (!r.ok) { throw new Error(url); } return r.json(); }).catch(function () { return null; });
  }
  function plural(n, one, many) { return n.toLocaleString("en") + " " + (n === 1 ? one : many); }
  function fold(s) { return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  /* ---- dates -------------------------------------------------------------- */

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dayMs(iso) { var p = iso.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function daysBetween(a, b) { return Math.round((dayMs(b) - dayMs(a)) / 86400000); }
  function dm(iso) { if (!iso) { return ""; } var p = iso.split("-"); return (+p[2]) + " " + MONTHS[+p[1] - 1]; }
  function range(s, e) {
    if (!s) { return e ? "until " + dm(e) : ""; }
    if (!e || e === s) { return dm(s); }
    var ps = s.split("-"), pe = e.split("-");
    if (ps[0] === pe[0] && ps[1] === pe[1]) { return (+ps[2]) + "–" + dm(e); }
    return dm(s) + " – " + dm(e) + (ps[0] !== pe[0] ? " " + pe[0] : "");
  }
  function readSaid(iso) {
    var n = daysBetween(iso, today());
    if (n <= 0) { return "read today"; }
    if (n === 1) { return "read yesterday"; }
    if (n < 14) { return "read " + dm(iso); }
    return "read " + Math.round(n / 7) + " weeks ago";
  }
  function stale(iso) { return daysBetween(iso, today()) > STALE_DAYS; }
  function clock(sec) { var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return pad(h) + ":" + pad(m); }
  // An event's time (UTC in the file), said in the show's own time zone.
  function when(isoUtc, tz) {
    try {
      var d = new Date(isoUtc + ":00Z");
      var f = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz || undefined, hour12: false });
      return f.format(d).replace(",", "");
    } catch (e) { return ""; }
  }
  // Today's hours, in the show's own time zone: Monday is 0 in the file.
  function hoursToday(s) {
    if (s.h) {
      var name = "";
      try { name = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: s.tz || undefined }).format(new Date()); } catch (e) { name = ""; }
      var k = DAYS.indexOf(name);
      if (k < 0) { k = (new Date().getDay() + 6) % 7; }
      var h = s.h.filter(function (r) { return r[0] === k; })[0];
      return h ? "Open today " + clock(h[1]) + "–" + clock(h[2]) : "Closed today";
    }
    return s.ht || "";
  }

  /* ---- the data ------------------------------------------------------------ */

  function readIndex() { if (!indexP) { indexP = json("guides.json"); } return indexP; }
  function readCity(key) { if (!files[key]) { files[key] = json("guides/" + key + ".json"); } return files[key]; }
  function readFinding() { if (!finding) { finding = json("finding.json"); } return finding; }

  // Shows already closed by the visitor's date are let go here.
  function live(g) {
    var t = today();
    return g.shows.filter(function (s) { return !s.e || s.e >= t; });
  }
  function mine(s) { return (s.ar || []).filter(function (a) { return a[2]; }); }
  function onNow(s, t) { return !s.s || s.s <= t; }

  function sections(g) {
    var t = today(), shows = live(g), out = [];
    var booths = shows.filter(function (s) { return s.k === "f"; });
    var rest = shows.filter(function (s) { return s.k !== "f"; });
    out.push({ id: "mine", head: "Your artists", rows: shows.filter(function (s) { return mine(s).length; }) });
    out.push({ id: "closing", head: "Closing soon", rows: rest.filter(function (s) { return onNow(s, t) && s.e && daysBetween(t, s.e) <= 7; }) });
    out.push({ id: "opening", head: "Opening soon", rows: rest.filter(function (s) { return !onNow(s, t); })
      .sort(function (a, b) { return a.s < b.s ? -1 : a.s > b.s ? 1 : 0; }) });
    out.push({ id: "museums", head: "Museums", rows: rest.filter(function (s) { return onNow(s, t) && s.k === "m"; }) });
    out.push({ id: "galleries", head: "Galleries", rows: rest.filter(function (s) { return onNow(s, t) && s.k === "g"; }) });
    var fairs = (g.fairs || []).filter(function (f) { return !f.e || f.e >= t; });
    var fairIds = {};
    fairs.forEach(function (f) { fairIds[f.id] = true; });
    booths.forEach(function (b) {
      if (b.f && !fairIds[b.f]) { fairIds[b.f] = true; fairs.push({ id: b.f, t: b.fn || b.p, s: b.s, e: b.e, ll: b.ll }); }
    });
    out.push({ id: "fairs", head: "Fairs", fairs: fairs, booths: booths, rows: [] });
    return out.filter(function (s) { return s.rows.length || (s.fairs && s.fairs.length); });
  }

  /* ---- the pill in the city's column ---------------------------------------- */

  function cityName(key) { var c = index && index.cities && index.cities[key]; return c ? c[0] : ""; }

  function makePill(key, row) {
    var p = button("guide-pill", "", function () { openGuide(); });
    p.appendChild(el("span", "guide-pill-glyph", "▢"));
    p.firstChild.setAttribute("aria-hidden", "true");
    p.appendChild(el("span", "guide-pill-name", row[0] + " Guide"));
    var n = row[2] + row[3];
    var said = n ? plural(row[2], "show", "shows") + " on" + (row[3] ? " · " + row[3] + " soon" : "") : "";
    if (index.read && stale(index.read)) { said = readSaid(index.read); p.dataset.stale = "true"; }
    if (said) { p.appendChild(el("span", "guide-pill-meta", said)); }
    p.setAttribute("aria-label", row[0] + " Guide — what's on" + (said ? ", " + said : ""));
    p.dataset.key = key;
    return p;
  }

  // At the head of the column, under the categories' header (kinds.js) when it is there.
  function seat(e) {
    if (!artCol || !e) { return; }
    var head = artCol.firstElementChild;
    var after = head && head.classList.contains("kinds-head") ? head : null;
    var want = after ? after.nextSibling : artCol.firstChild;
    if (e.parentNode === artCol && (e === want || (after ? e.previousSibling === after : artCol.firstChild === e))) { return; }
    artCol.insertBefore(e, want);
  }
  function placeAll() {
    if (!st.key) { return; }
    if (st.open) { if (pill && pill.parentNode) { pill.parentNode.removeChild(pill); } seat(box); }
    else { seat(pill); }
  }
  if (artCol && window.MutationObserver) {
    new MutationObserver(function () { placeAll(); }).observe(artCol, { childList: true });
  }

  /* ---- the guide, open --------------------------------------------------------- */

  function openGuide(showId) {
    var key = st.key;
    if (!key) { return; }
    readCity(key).then(function (g) {
      if (st.key !== key || !g) { return; }
      st.g = g;
      st.open = true;
      artCol.dataset.guide = "true";
      renderList();
      if (showId) {
        var s = live(g).filter(function (x) { return x.id === showId; })[0];
        if (s) { openShow(s); }
      }
      kick();
    });
  }

  function closeGuide() {
    st.open = false;
    st.show = null;
    ring = null;
    if (box && box.parentNode) { box.parentNode.removeChild(box); }
    box = null;
    if (artCol) { delete artCol.dataset.guide; }
    placeAll();
  }

  function newBox(label) {
    var b = el("section", "guide-box");
    b.setAttribute("aria-label", label);
    if (box && box.parentNode) { box.parentNode.replaceChild(b, box); }
    box = b;
    seat(box);
    return b;
  }

  function renderList(keepScroll) {
    var g = st.g, name = g.name;
    st.show = null;
    ring = null;
    var b = newBox(name + " Guide");
    b.appendChild(button("guide-back", "‹ " + name, function () { closeGuide(); focusPill(); }));
    var head = el("h2", "guide-title", name + " Guide");
    b.appendChild(head);
    var read = el("p", "guide-read", "What’s on · " + readSaid(g.read));
    if (stale(g.read)) { read.dataset.stale = "true"; }
    b.appendChild(read);
    var secs = sections(g);
    var walkable = walkPool(null);
    if (walkable.length >= 2) {
      var wb = button("read-quiet guide-walk", walk ? "Walking the guide" : "Walk the guide · " + plural(walkable.length, "show", "shows"), function () {
        if (!walk) { startWalk(null); }
      });
      if (walk) { wb.disabled = true; }
      b.appendChild(wb);
    }
    if (!secs.length) { b.appendChild(el("p", "guide-none", "Nothing is listed here just now.")); }
    secs.forEach(function (sec) {
      var count = sec.fairs ? sec.fairs.length : sec.rows.length;
      var h = el("p", "town-section guide-section", sec.head + " · " + count);
      if (sec.id === "mine") { h.dataset.mine = "true"; }
      b.appendChild(h);
      if (sec.fairs) {
        sec.fairs.forEach(function (f) { b.appendChild(fairRow(f, sec.booths.filter(function (x) { return x.f === f.id; }))); });
        return;
      }
      var list = el("div", "guide-rows");
      sec.rows.forEach(function (s, i) {
        var r = row(s, sec.id);
        if (i >= FIRST) { r.hidden = true; }
        list.appendChild(r);
      });
      b.appendChild(list);
      if (sec.rows.length > FIRST) {
        var more = button("art-more-all guide-more", "All " + sec.rows.length, function () {
          list.querySelectorAll(".guide-row[hidden]").forEach(function (n) { n.hidden = false; });
          more.remove();
        });
        b.appendChild(more);
      }
    });
    b.appendChild(el("p", "guide-source", "From Artsy’s listings, " + dm(g.read) + ". The covers are Artsy’s."));
    if (!keepScroll) { artCol.scrollTop = 0; }
    kick();
  }

  function cover(key, size) {
    var img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    var cdn = (st.g && st.g.cdn) || "https://d32dm0rphc51dk.cloudfront.net/";
    var tries = size === "large" ? ["larger", "medium", "square"] : ["medium", "large"];
    img.addEventListener("error", function () {
      if (tries.length) { img.src = cdn + key + "/" + tries.shift() + ".jpg"; return; }
      img.dataset.none = "true";
      img.removeAttribute("src");
    });
    img.src = cdn + key + "/" + (size || "square") + ".jpg";
    return img;
  }

  function metaLine(s, sec) {
    var t = today(), bits = [s.p];
    if (sec === "opening" || !onNow(s, t)) {
      bits.push("opens " + dm(s.s));
      var rec = (s.ev || []).filter(function (e) { return e[0] === "Opening Reception"; })[0];
      if (rec) { bits.push("reception " + when(rec[1], s.tz)); }
    } else if (s.e && daysBetween(t, s.e) <= 7) {
      var d = daysBetween(t, s.e);
      bits.push(d <= 0 ? "closes today" : d === 1 ? "closes tomorrow" : "closes " + dm(s.e));
    } else {
      bits.push(range(s.s, s.e));
    }
    return bits.filter(Boolean).join(" · ");
  }

  function row(s, sec) {
    var r = button("guide-row", "", function () { pauseWalk(); openShow(s); });
    var pic = el("span", "guide-cover");
    if (s.i) { pic.appendChild(cover(s.i, "square")); }
    pic.setAttribute("aria-hidden", "true");
    r.appendChild(pic);
    var txt = el("span", "guide-row-text");
    txt.appendChild(el("span", "guide-row-title", s.t));
    txt.appendChild(el("span", "guide-row-meta", metaLine(s, sec)));
    var my = mine(s);
    if (my.length) { txt.appendChild(el("span", "guide-row-mine", my.map(function (a) { return a[0]; }).join(", "))); }
    r.appendChild(txt);
    r.setAttribute("aria-label", s.t + " — " + metaLine(s, sec) + (my.length ? " — your artists: " + my.map(function (a) { return a[0]; }).join(", ") : ""));
    r.addEventListener("pointerenter", function () { hover = s; kick(); });
    r.addEventListener("pointerleave", function () { if (hover === s) { hover = null; } });
    r.addEventListener("focus", function () { hover = s; kick(); });
    r.addEventListener("blur", function () { if (hover === s) { hover = null; } });
    return r;
  }

  function fairRow(f, booths) {
    var wrap = el("div", "guide-fair");
    var head = el("p", "guide-fair-head");
    head.appendChild(el("span", "guide-row-title", f.t));
    head.appendChild(el("span", "guide-row-meta", [range(f.s, f.e), f.a, f.n ? plural(f.n, "gallery", "galleries") + " on Artsy" : ""].filter(Boolean).join(" · ")));
    wrap.appendChild(head);
    if (booths.length) {
      var list = el("div", "guide-rows");
      booths.forEach(function (s, i) {
        var r = row(s, "fairs");
        if (i >= 3) { r.hidden = true; }
        list.appendChild(r);
      });
      wrap.appendChild(list);
      if (booths.length > 3) {
        var more = button("art-more-all guide-more", "All " + booths.length + " stands", function () {
          list.querySelectorAll(".guide-row[hidden]").forEach(function (n) { n.hidden = false; });
          more.remove();
        });
        wrap.appendChild(more);
      }
    }
    return wrap;
  }

  /* ---- a show, open in place -------------------------------------------------- */

  function openShow(s) {
    var g = st.g;
    if (!g) { return; }
    st.show = s;
    var b = newBox(s.t);
    b.appendChild(button("guide-back", "‹ " + g.name + " Guide", function () { renderList(); }));
    if (s.i) {
      var big = el("figure", "guide-plate");
      big.appendChild(cover(s.i, "large"));
      b.appendChild(big);
    }
    var t = el("h2", "guide-show-title", s.t);
    t.tabIndex = -1;
    b.appendChild(t);
    var kind = s.k === "m" ? "Museum" : s.k === "f" ? "Fair stand" : "Gallery";
    b.appendChild(el("p", "guide-show-partner", "▢ " + kind + " · " + s.p + (s.fn ? " · at " + s.fn : "")));
    b.appendChild(el("p", "guide-show-line", range(s.s, s.e)));
    var h = hoursToday(s);
    if (h && onNow(s, today())) { b.appendChild(el("p", "guide-show-line", h)); }
    if (s.a) { b.appendChild(el("p", "guide-show-line guide-show-addr", s.a)); }
    (s.ev || []).forEach(function (e) {
      var w = when(e[1], s.tz);
      if (w) { b.appendChild(el("p", "guide-show-line guide-show-event", e[0] + " · " + w + (e[2] ? "–" + when(e[2], s.tz).split(" ").pop() : ""))); }
    });
    if (s.rec) { b.appendChild(el("p", "guide-show-line guide-show-event", s.rec)); }
    if (s.m && window.Land && Land.museum) {
      b.appendChild(button("read-quiet guide-into", "Into " + s.p + " ›", function () { endWalk(); Land.museum(s.m, {}); }));
    }
    var ar = s.ar || [];
    if (ar.length) {
      b.appendChild(el("p", "town-section", "Artists · " + ar.length));
      var list = el("p", "guide-artists");
      ar.forEach(function (a, i) {
        if (i) { list.appendChild(document.createTextNode(", ")); }
        var id = a[1] || (window.Lives && Lives.has && Lives.has(a[0]) ? Lives.idOf(a[0]) : null);
        if (id && window.Lives && Lives.open) {
          var d = button("guide-artist guide-artist-life", a[0], function () { endWalk(); Lives.open(id); });
          d.setAttribute("aria-label", a[0] + " — their life");
          if (a[2]) { d.dataset.mine = "true"; }
          list.appendChild(d);
        } else {
          var sp = el("span", "guide-artist", a[0]);
          if (a[2]) { sp.dataset.mine = "true"; }
          list.appendChild(sp);
        }
      });
      b.appendChild(list);
      if (mine(s).length) { b.appendChild(el("p", "guide-show-note", "In lilac: artists of your saved works.")); }
    }
    if (s.w && s.w.length) { savedHere(b, s); }
    b.appendChild(el("p", "guide-source", "Artsy’s listing, read " + dm(g.read) + "."));
    artCol.scrollTop = 0;
    // The venue: the city eased to it, ringed in pixel light.
    if (s.ll) {
      ring = { ll: s.ll, t0: performance.now() };
      if (window.Land && Land.look) { Land.look(s.ll[0], s.ll[1]); }
    }
    kick();
    if (!walk) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  }

  function savedHere(b, s) {
    b.appendChild(el("p", "town-section", "Saved works here · " + s.w.length));
    var row_ = el("div", "town-thumbs guide-saved");
    b.appendChild(row_);
    readFinding().then(function (f) {
      if (!f) { return; }
      var by = {};
      f.w.forEach(function (w) { by[w[0]] = w; });
      s.w.forEach(function (id) {
        var w = by[id];
        if (!w) { return; }
        var d = button("town-thumb", "", function () { endWalk(); Land.work(id, st.key || undefined); });
        d.setAttribute("aria-label", (w[1] || "Untitled") + (w[2] ? ", " + w[2] : "") + " — its history");
        var img = el("img");
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        img.src = (f.cdn || "https://d32dm0rphc51dk.cloudfront.net/") + w[4] + "/square.jpg";
        d.appendChild(img);
        row_.appendChild(d);
      });
    });
  }

  function focusPill() { if (pill) { try { pill.focus({ preventScroll: true }); } catch (e) {} } }

  /* ---- on the city: the shows' tiles, the venue's ring --------------------------- */

  var cv = null, ctx = null, raf = 0, ring = null, hover = null;
  function kick() { if (!raf) { raf = window.requestAnimationFrame(draw); } }
  function tile(x, y, a, inset) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    ctx.globalAlpha = a;
    ctx.fillRect(gx + inset, gy + inset, C - 2 * inset, C - 2 * inset);
  }
  function draw(now) {
    raf = 0;
    if (!cv) {
      var tiles = document.getElementById("tiles");
      cv = el("canvas", "world world-tiles guide-tiles");
      cv.setAttribute("aria-hidden", "true");
      if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(cv, tiles.nextSibling); } else { document.body.appendChild(cv); }
      ctx = cv.getContext("2d");
    }
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var w = window.Land && Land.where ? Land.where() : { at: "world" };
    if (!st.open || !st.g || w.at !== "town" || !window.Land || !Land.at) { return; }
    var t = live(st.g), sel = st.show;
    // At rest only a layer's own marks: these are drawn only while the guide is open.
    t.forEach(function (s) {
      if (!s.ll || s === sel) { return; }
      var q = Land.at(s.ll[0], s.ll[1]);
      if (!q || q.z < 0.05) { return; }
      var m = mine(s).length;
      ctx.fillStyle = m ? LILAC : SEA;
      tile(q.x, q.y, (s === hover ? 0.85 : m ? 0.5 : 0.24) * Math.min(1, q.z * 4), m ? 3 : 4);
    });
    if (ring) {
      var q = Land.at(ring.ll[0], ring.ll[1]);
      if (q && q.z > 0.02) {
        var age = now - ring.t0, f = still ? 0 : Math.floor(age / (1000 / 24));
        ctx.fillStyle = LIGHT;
        tile(q.x, q.y, 1, 1);
        ctx.fillStyle = CREAM;
        tile(q.x, q.y, 0.9, 4);
        // A ring of tiles round it: three echoes at φ, held frames, then quiet.
        var gx = Math.floor(q.x / C), gy = Math.floor(q.y / C);
        for (var e = 0; e < 3; e += 1) {
          var r = 1 + e;
          var ph = still ? 1 : Math.max(0, Math.min(1, (f - e * 6) / 10));
          var a = still ? 0.5 : (ph > 0 ? Math.max(0.18, 1 - ph * 0.7) * Math.pow(1 / PHI, e) : 0);
          if (a <= 0) { continue; }
          ctx.fillStyle = e ? LILAC : LIGHT;
          for (var i = -r; i <= r; i += 1) {
            for (var j = -r; j <= r; j += 1) {
              if (Math.max(Math.abs(i), Math.abs(j)) !== r) { continue; }
              if (r > 1 && ((i + j + e) & 1)) { continue; }
              ctx.globalAlpha = a;
              ctx.fillRect((gx + i) * C + 2, (gy + j) * C + 2, C - 4, C - 4);
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    kick();
  }

  /* ---- walk the guide: the dial is the transport -------------------------------- */

  function walkPool(first) {
    var g = st.g;
    if (!g) { return []; }
    var t = today();
    var on = live(g).filter(function (s) { return onNow(s, t) && s.ll && s.k !== "f"; });
    // Most worth the walk first: your artists, the museums, what closes soon; then the rest by its end.
    function rank(s) { return (mine(s).length ? 0 : s.m || s.k === "m" ? 1 : (s.e && daysBetween(t, s.e) <= 7) ? 2 : 3); }
    var pool = on.slice().sort(function (a, b) { return rank(a) - rank(b) || (a.e < b.e ? -1 : a.e > b.e ? 1 : 0); }).slice(0, WALK_MAX);
    if (first && first.ll && pool.indexOf(first) < 0) { pool.pop(); pool.unshift(first); }
    // Ordered as a walk: the nearest next, from the first chosen, else the city's middle.
    var at = first && first.ll ? first.ll : g.ll, out = [];
    if (first && pool.indexOf(first) >= 0) { out.push(first); pool.splice(pool.indexOf(first), 1); }
    while (pool.length) {
      var bi = 0, bd = Infinity;
      for (var i = 0; i < pool.length; i += 1) {
        var d = dist(at, pool[i].ll);
        if (d < bd || (d === bd && pool[i].id < pool[bi].id)) { bd = d; bi = i; }
      }
      at = pool[bi].ll;
      out.push(pool.splice(bi, 1)[0]);
    }
    return out;
  }
  function dist(a, b) {
    var R = Math.PI / 180, x = (b[1] - a[1]) * Math.cos((a[0] + b[0]) / 2 * R), y = b[0] - a[0];
    return Math.sqrt(x * x + y * y) * 111.2;
  }

  function startWalk(first) {
    if (!st.g || !window.Dial || !Dial.path) { return; }
    endWalk();
    var stops = walkPool(first || st.show);
    if (stops.length < 2) { return; }
    walk = { stops: stops, i: 0, clock: 0, last: performance.now(), paused: false, said: 0, key: st.key };
    readEl = readEl || makeRead();
    tp = Dial.path({
      kind: "guide", title: st.g.name + " Guide", at: 0, read: readEl, paused: false,
      stops: stops.map(function (s) { return { label: s.t }; }),
      onToggle: function () { if (!walk) { return; } if (walk.done) { walk.done = false; walk.paused = false; goStop(0); return; } walk.paused = !walk.paused; walk.last = performance.now(); tp.set({ paused: walk.paused }); say(); },
      onSeek: function (i, play) { if (!walk) { return; } walk.paused = !play; goStop(i); },
      onNext: function () { if (!walk) { return; } if (walk.i + 1 < walk.stops.length) { goStop(walk.i + 1); } else { finish(); } },
      onEnd: function () { endWalk(true); }
    });
    goStop(0);
  }

  function makeRead() {
    var r = el("aside", "guide-out");
    r.hidden = true;
    r.setAttribute("aria-live", "polite");
    r.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    return r;
  }

  function goStop(i) {
    if (!walk) { return; }
    walk.i = Math.max(0, Math.min(walk.stops.length - 1, i));
    walk.clock = 0;
    walk.last = performance.now();
    walk.said = still ? 3 : 0;
    openShow(walk.stops[walk.i]);
    if (tp) { tp.set({ at: walk.i, paused: walk.paused }); }
    say();
  }

  function say() {
    if (!walk || !readEl) { return; }
    var s = walk.stops[walk.i];
    readEl.textContent = "";
    var count = el("p", "guide-out-count", (walk.i + 1) + " of " + walk.stops.length + " · " + st.g.name + " Guide" + (walk.paused ? " · paused" : ""));
    readEl.appendChild(count);
    if (walk.said >= 1) { readEl.appendChild(el("p", "guide-out-said", s.t)); }
    if (walk.said >= 2) { readEl.appendChild(el("p", "guide-out-line", s.p + " · " + range(s.s, s.e))); }
    if (walk.said >= 3) {
      var ar = (s.ar || []).map(function (a) { return a[0]; });
      var my = mine(s).map(function (a) { return a[0]; });
      if (ar.length) {
        var p = el("p", "guide-out-line");
        if (my.length) { p.appendChild(el("span", "guide-out-mine", my.join(", "))); }
        var others = ar.filter(function (n) { return my.indexOf(n) < 0; });
        if (others.length) {
          p.appendChild(document.createTextNode((my.length ? " · " : "") + others.slice(0, 4).join(", ") + (others.length > 4 ? " and " + (others.length - 4) + " more" : "")));
        }
        readEl.appendChild(p);
      } else if (s.a) { readEl.appendChild(el("p", "guide-out-line", s.a)); }
    }
    readEl.hidden = false;
    if (window.Dial && Dial.read) { Dial.read(readEl); }
  }

  function finish() {
    if (!walk || !readEl) { return; }
    var n = walk.stops.length;
    readEl.textContent = "";
    readEl.appendChild(el("p", "guide-out-count", st.g.name + " Guide · walked, " + plural(n, "show", "shows")));
    var again = button("read-quiet guide-again", "Again", function () { var w = walk; endWalk(true); if (w && st.key === w.key) { startWalk(w.stops[0]); } });
    readEl.appendChild(again);
    walk.paused = true;
    walk.done = true;
    if (tp) { tp.set({ paused: true }); }
  }

  function pauseWalk() {
    if (!walk || walk.paused) { return; }
    walk.paused = true;
    if (tp) { tp.set({ paused: true }); }
    say();
  }

  function endWalk(fromDial) {
    var had = !!walk;
    walk = null;
    if (tp) { var t = tp; tp = null; if (!fromDial) { t.close(); } }
    if (readEl) { readEl.hidden = true; readEl.textContent = ""; }
    if (had && st.open && box && !st.show) { renderList(true); }
  }

  function stepWalk(now) {
    if (!walk || walk.done) { return; }
    var dt = now - walk.last;
    walk.last = now;
    if (walk.paused || still) { return; }
    if (now - movedAt < STILL_MS) { return; }
    walk.clock += dt;
    var said = SAY.filter(function (ms) { return walk.clock >= ms; }).length;
    if (said !== walk.said) { walk.said = said; say(); }
    if (walk.clock >= STOP_MS) {
      if (walk.i + 1 < walk.stops.length) { goStop(walk.i + 1); } else { finish(); }
    }
  }

  ["pointermove", "pointerdown", "wheel", "keydown", "touchmove"].forEach(function (t) {
    window.addEventListener(t, function () { movedAt = performance.now(); }, { passive: true, capture: true });
  });

  /* ---- on the world: the pill beside Search ----------------------------------------- */

  // The guided city nearest the middle of what is seen (the window's middle, a little above it,
  // where the pills are not), among those on the side of the globe facing you.
  function nearestGuide() {
    if (!index || !index.cities || !window.Land || !Land.at) { return null; }
    var mx = window.innerWidth / 2, my = window.innerHeight * 0.45, best = null, bd = Infinity;
    Object.keys(index.cities).forEach(function (k) {
      var c = index.cities[k];
      if (!(c[2] + c[3])) { return; }
      var q = Land.at(c[6], c[7]);
      if (!q || q.z < 0.15) { return; }
      // A city with more on is suggested from a little farther off (New York over Water Mill).
      var d = Math.hypot(q.x - mx, q.y - my) / (1 + 0.5 * Math.log10(1 + c[1]));
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  }

  function makeWorldPill() {
    worldPill = button("guide-world", "", function () {
      var k = worldPill.dataset.key;
      if (!k || !window.Land || !Land.town) { return; }
      st.pending = k;
      Land.town(k);
    });
    worldPill.hidden = true;
    document.body.appendChild(worldPill);
  }

  function placeWorldPill(w) {
    if (!worldPill) { makeWorldPill(); }
    var find = document.getElementById("art-find");
    var finder = document.getElementById("finder");
    var key = w.at === "world" && !w.flying ? nearestGuide() : null;
    var r = find && !find.hidden && find.offsetWidth ? find.getBoundingClientRect() : null;
    if (!key || !r || (finder && !finder.hidden)) { worldPill.hidden = true; return; }
    var c = index.cities[key];
    var words = "Guide · " + c[0] + (index.read && stale(index.read) ? " · " + readSaid(index.read) : "");
    if (worldPill.dataset.key !== key || worldPill.textContent !== words) {
      worldPill.dataset.key = key;
      worldPill.textContent = words;
      worldPill.setAttribute("aria-label", c[0] + " Guide — " + plural(c[2], "show", "shows") + " on now; fly there and open it");
    }
    worldPill.hidden = false;
    var W = window.innerWidth, pw = worldPill.offsetWidth, ph = worldPill.offsetHeight;
    var x = r.right + 6, y = r.top + (r.height - ph) / 2;
    if (x + pw > W - 16) {
      x = r.left - 6 - pw;
      if (x < 16) { x = (W - pw) / 2; y = r.top - ph - 8; }
    }
    worldPill.style.left = Math.round(x) + "px";
    worldPill.style.top = Math.round(y) + "px";
  }

  /* ---- following the page ----------------------------------------------------------- */

  function tick() {
    if (!window.Land || !Land.where) { return; }
    var now = performance.now();
    stepWalk(now);
    readIndex().then(function (ix) {
      if (!ix) { return; }
      index = ix;
      var w = Land.where();
      placeWorldPill(w);
      if (w.flying) { return; }
      var key = w.at === "town" && w.key && ix.cities[w.key] && ix.cities[w.key][1] ? w.key : null;
      if (key !== st.key) {
        if (walk && walk.key !== key) { endWalk(); }
        if (st.open) { closeGuide(); }
        if (pill && pill.parentNode) { pill.parentNode.removeChild(pill); }
        pill = null;
        st.key = key;
        st.g = null;
        if (key) {
          pill = makePill(key, ix.cities[key]);
          placeAll();
        }
      }
      if (key) {
        placeAll();
        if (st.pending === key) { st.pending = null; if (!st.open) { openGuide(); } }
      } else if (w.at === "world") { st.pending = null; }
    });
  }
  window.setInterval(tick, 300);

  // Escape: out one level — the show to its guide, the guide to its city — before the page's own.
  window.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !st.open) { return; }
    var t = event.target;
    if (t && t.closest && t.closest(".finder")) { return; }
    event.stopImmediatePropagation();
    event.preventDefault();
    if (st.show && !walk) { renderList(); } else if (!walk) { closeGuide(); focusPill(); } else { endWalk(); renderList(); }
  }, true);

  window.Guide = {
    open: function (key, showId) {
      if (key && key !== st.key) { st.pending = key; if (window.Land && Land.town) { Land.town(key); } return; }
      openGuide(showId);
    },
    close: closeGuide,
    walk: function () { if (st.open) { startWalk(null); } },
    state: function () { return { key: st.key, open: st.open, show: st.show && st.show.id, walking: !!walk, stop: walk ? walk.i : -1, paused: walk ? walk.paused : null }; }
  };
})();

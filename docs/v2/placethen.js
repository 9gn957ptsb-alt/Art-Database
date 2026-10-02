/* The place, then — a life's place as it stood in its years, and the works made there.

   The artist, 2 Oct 2026, of Picasso's life entered at Fontainebleau, 1921
   (a muddy field of pixel ground with a ring on it): "I want there to be a
   stronger visual for a city when I click on it when reading about an
   artist. Maybe show his studio or neighborhood when cycling through the
   artworks he painted there at that time. Something that enables new paths
   of exploration by way of new associations of objects relative to a
   specific context".

   When a period of a life is entered (Lives' "Enter ›", or a studio's
   column from the Artists layer), the view becomes that neighbourhood in
   that year:

   · the clod — the place's ground (grounds/<slug>.json, scripts/
     build_grounds.py from lifeplaces.json) drawn in true isometric by the
     museums' own code (Land.ground → shapeClod, Models.draw), centred on
     the studio where the studios place it exactly, else on the town's
     point, and said so. Its buildings stand by their years (`built`,
     scripts/build_built_years.py): what had not gone up by the year is not
     drawn; where the years do not reach back (the satellites' first year is
     1975) it says so, and what stood by then is shown. The place itself is a
     lit tile of pixel light; what the record calls it (the villa, the
     garage used as a studio) is its caption, quoted.
   · the works made there — "Made then", "Printed then" and Painted here's
     outings of the period, one at a time on the reading's slow clock (17 s,
     Smith & Smith's median look, counted only while the pointer is still),
     each with how it is known; the dial turns to its year and the clod
     stands as it stood then. A painting at a documented site draws a line
     of sea-green tiles from the place to its site (or to the clod's edge,
     with how far and which way). Paintings not saved are marked so.
   · new associations for the work in view, from the data only, rarest
     first, three or four: who else was here then (lives that cross, the
     movements' presences), a movement here, other works made in this town,
     where this work is now, the show that first put works from here
     together, who wrote on them, the artist's animal. Each door is marked
     with its category's glyph (KINDS.md) and opens a view with the
     categories' three tabs.

   Hooks: lives.js calls PlaceThen.open({ L, k, box }) from the period's
   column and PlaceThen.studio(i, box) from a studio's; land.js gives
   Land.ground, Land.periodYears, Land.dial(Year) and Land.where (its
   `life`). It closes itself when its box leaves the page. */
(function () {
  "use strict";

  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";
  var LIGHT = "#9d95e6", SEA = "#8fc7bd";
  var HOLD = 17000, STILL_MS = 1500;
  var PIX = 2;                                   // screen pixels to one of the clod's
  var TAU = Math.PI * 2, PHI = (1 + Math.sqrt(5)) / 2;
  var SWING = PHI * PHI * 1000;
  var SIDE = { exact: 560, street: 700, district: 3600, town: 2400, region: 9000 };
  var SATELLITE = /World Settlement|GHSL|Global Human Settlement/;
  var CAST = { "Cy Twombly": "fox", "Elaine de Kooning": "bison", "Henri Matisse": "squirrel",
               "Andy Warhol": "eagle", "Anish Kapoor": "slug", "David Hockney": "deer" };
  var ANIMAL = { fox: "red fox", bison: "bison", squirrel: "red squirrel", eagle: "bald eagle", slug: "banana slug", deer: "red deer" };
  var GLYPH = { museum: ["◆", "#d6b05c"], movement: ["◇", "#d9a55b"], work: ["■", "#eadfcd"], artist: ["○", "#c98fb5"],
                writing: ["¶", "#9d95e6"], place: ["◎", "#8fa7c7"], gallery: ["▢", "#8fc7bd"], animal: ["∴", "#a3b87a"] };
  var HOW = { record: "by its own record", site: "painted at a documented site", dated: "dated within these years" };
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cache = {};
  function json(url) {
    if (!cache[url]) {
      cache[url] = fetch(url).then(function (r) { if (!r.ok) { throw new Error(url); } return r.json(); })
        .catch(function () { delete cache[url]; return null; });
    }
    return cache[url];
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function button(cls, fn) {
    var b = el("button", cls);
    b.type = "button";
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); fn(event); });
    return b;
  }
  function surname(a) {
    var w = String(a || "").split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function untitled(t) { return !t || /^(untitled|sans titre|ohne titel|senza titolo|sin título)\b/i.test(String(t).trim()); }
  function km(a, b) {
    var R = Math.PI / 180, la1 = a[0] * R, la2 = b[0] * R, dl = (b[1] - a[1]) * R;
    var h = Math.sin((la2 - la1) / 2) * Math.sin((la2 - la1) / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function compass(dx, dy) {           // metres east, north
    var a = Math.atan2(dx, dy) * 180 / Math.PI;
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((a + 360) % 360) / 45) % 8];
  }
  function kmText(d) { return d < 1 ? Math.round(d * 1000) + " m" : d < 10 ? d.toFixed(1) + " km" : Math.round(d) + " km"; }
  function yspan(a, b) {
    if (!b || a === b) { return String(a); }
    return Math.min(a, b) + "–" + Math.max(a, b);
  }
  function glyph(kind) {
    var k = window.Kinds && Kinds.kind ? Kinds.kind(kind) : null;
    return k ? [k.glyph, k.tone] : GLYPH[kind] || ["·", "#a8927a"];
  }
  function lifeFile(id) { return json("lives/" + id + ".json"); }

  /* ---- the period's things ------------------------------------------------ */

  // The works of the period, in the order they are shown: by year, the first a titled one.
  function itemsOf(L, p, siteRows) {
    var out = [];
    p.works.forEach(function (i) {
      var w = L.works[i];
      if (!w || w.length > 8) { return; }
      var h = String(w[4] || "dated"), base = h.split(":")[0];
      out.push({ kind: "made", id: w[0], t: w[1], y: w[2] || null, img: w[3] ? CDN + w[3] + "/medium.jpg" : "",
                 how: base === "record" && h.indexOf(":") > 0 ? "made in " + h.slice(h.indexOf(":") + 1) + ", its record says" : HOW[base] || h,
                 cat: w[7] || [], saved: true });
    });
    p.prints.forEach(function (i) {
      var w = L.works[i];
      if (!w) { return; }
      out.push({ kind: "print", id: w[0], t: w[1], y: w[2] || null, img: w[3] ? CDN + w[3] + "/medium.jpg" : "",
                 how: "pulled at " + w[8][0] + (w[8][1] ? ", " + w[8][1] : ""), cat: w[7] || [], saved: true });
    });
    p.sites.forEach(function (si) {
      var s = L.sites[si], row = siteRows && siteRows[s[0]];
      if (!s || !s[4]) { return; }
      var saved = !!(row && row.w);
      if (saved && out.some(function (o) { return o.id === row.w; })) { return; }
      out.push({ kind: "site", id: saved ? row.w : null, sid: s[0], t: s[1], y: s[2] || null,
                 img: row && row.img ? COMMONS + encodeURIComponent(row.img) + "?width=800" : "",
                 how: "painted at a documented site · " + (s[3] || "the place painted"), ll: s[4], key: s[7],
                 where: row && row.m || "", saved: saved });
    });
    out.sort(function (a, b) { return (a.y || 9999) - (b.y || 9999); });
    return out;
  }
  function firstTitled(items) {
    for (var i = 0; i < items.length; i += 1) { if (!untitled(items[i].t)) { return i; } }
    return 0;
  }

  // A phrase of the record that says what the place was: "using the garage as a studio".
  function placePhrase(p) {
    var q = null;
    (Array.isArray(p.src) ? p.src : []).forEach(function (s) { if (!q && s.q) { q = s; } });
    if (!q) { return null; }
    var parts = String(q.q).split(/[;,:()]|\. /);
    var word = /\b(studio|atelier|villa|garage|house|home|apartment|flat|château|chateau|farm|loft|room|rooms|studios|pottery|workshop|foundry|press)\b/i;
    for (var i = 0; i < parts.length; i += 1) {
      var t = parts[i].trim();
      if (t.length > 6 && t.length < 90 && word.test(t)) { return { q: t.replace(/^(and|while|where|during their time there)\s+/i, ""), name: q.name, url: q.url }; }
    }
    return null;
  }

  /* ---- the state ---------------------------------------------------------- */

  var S = null;               // { L, k, p, box, items, i, ... }
  var root = null, refs = {};
  var lastMove = 0, watch = 0;

  function noteMove() { lastMove = performance.now(); }
  // The dial's range is written and its events fired when it is turned by hand.
  document.addEventListener("input", function (event) {
    if (S && event.target && event.target.id === "art-time-range") { S.turned = performance.now(); }
  }, true);
  ["pointermove", "pointerdown", "wheel", "keydown", "touchstart"].forEach(function (t) {
    window.addEventListener(t, noteMove, { capture: true, passive: true });
  });

  function open(spec) {
    if (!spec || !spec.L || !spec.L.periods[spec.k]) { return; }
    close();
    var L = spec.L, k = spec.k, p = L.periods[k];
    S = { L: L, k: k, p: p, box: spec.box, items: [], i: 0, held: 0, last: performance.now(), year: p.y0,
          shownYear: null, ground: null, slug: null, place: null, dial: 0, pinned: false, gone: false, assoc: {} };
    var mine = S;
    build();
    document.body.dataset.placethen = "true";
    Promise.all([json("lifeplaces.json"), p.sites.length ? json("sites.json") : null]).then(function (r) {
      if (S !== mine) { return; }
      var lp = r[0], sites = r[1];
      var rows = {};
      ((sites && sites.sites) || []).forEach(function (s) { rows[s.id] = s; });
      S.siteRows = rows;
      S.allSites = (sites && sites.sites) || null;
      S.items = itemsOf(L, p, rows);
      S.i = firstTitled(S.items);
      // The square: the studio's where the studios place it exactly, else the town's.
      var pair = lp && lp.periods[L.id + ":" + k];
      var bySlug = {};
      ((lp && lp.places) || []).forEach(function (pl) { bySlug[pl.slug] = pl; });
      var pick = pair ? bySlug[pair[1]] || bySlug[pair[0]] : null;
      var also = pair && pair[1] ? bySlug[pair[0]] : null;
      S.place = pick;
      S.town = also;
      say();
      setDial();
      showItem(true);
      if (!pick) { refs.note.textContent = "No ground has been read for " + p.place + "."; return; }
      loadGround(pick, mine).then(function (ok) {
        if (!ok && also && S === mine) { S.studioWanted = pick; S.place = also; say(); loadGround(also, mine); }
      });
    });
    if (!watch) { watch = window.setInterval(guard, 400); }
    loop();
  }

  function loadGround(pl, mine) {
    if (!window.Land || !Land.ground) { return Promise.resolve(false); }
    return Land.ground(pl.slug, pl.lat, pl.lon).then(function (got) {
      if (S !== mine) { return false; }
      if (!got) { refs.note.textContent = "No ground has been read for " + pl.name + " yet."; return false; }
      S.ground = got.g;
      S.dots = got.dots;
      S.slug = pl.slug;
      S.at = performance.now();
      S.heading = TAU / 8 + (Math.abs(hash(pl.slug)) % 4) * TAU / 4;
      S.when = S.whenTo = whenOf(S.year);
      S.floor = floorOf(got.g);
      S.centre = centreZ(got.dots);
      say();
      S.dirty = true;
      return true;
    });
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i += 1) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

  // What the years of the ground can say: the first dated, and whether only satellites dated it.
  function floorOf(g) {
    var lo = Infinity, known = 0, all = 0;
    (g.built || []).forEach(function (y) { all += 1; if (y > 0) { known += 1; if (y < lo) { lo = y; } } else if (y < 0) { known += 1; } });
    var from = g.builtFrom || [];
    var satOnly = from.length > 0 && from.every(function (f) { return SATELLITE.test(f); });
    return { lo: lo === Infinity ? null : lo, sat: satOnly, from: from, known: known, all: all, none: !g.built };
  }
  function whenOf(y) {
    var yrs = S && S.dots && S.dots.years;
    if (!yrs) { return 1; }
    var f = S.floor;
    if (f && f.sat && f.lo && y < f.lo) { y = f.lo; }      // what stood by the first year the satellites know
    return Math.max(0, Math.min(1, (y + 0.999 - yrs.y0) / (yrs.y1 - yrs.y0)));
  }
  // The height of the ground at the clod's middle, for the place's tile.
  function centreZ(d) {
    var z = 0, best = 9;
    for (var k = 0; k < d.count; k += 1) {
      var r = Math.abs(d.x[k]) + Math.abs(d.y[k]);
      if (r < best - 0.01 || (r <= best && d.z[k] < z && d.reveal[k] === 0)) { if (d.reveal[k] === 0) { best = r; z = d.z[k]; } }
    }
    return Math.max(0, z);
  }

  function close() {
    if (!S) { return; }
    S.gone = true;
    S = null;
    if (root && root.parentNode) { root.parentNode.removeChild(root); }
    root = null;
    refs = {};
    delete document.body.dataset.placethen;
    if (watch) { window.clearInterval(watch); watch = 0; }
  }

  // Gone when its column is, or the view is no longer this place.
  function guard() {
    if (!S) { return; }
    var w = window.Land && Land.where ? Land.where() : null;
    if (!S.box || !S.box.isConnected || !w || (w.at !== "town" && !w.flying)) { close(); return; }
    if (w.life && (w.life.id !== S.L.id || w.life.k !== S.k)) { close(); return; }
    // The city's own years may come back after it was opened (its places file read late): the period again.
    var d = Land.dial ? Land.dial() : null;
    if (S.setYears && S.dial < 6 && (!d || Math.floor(d.y0) !== S.setYears[0])) { S.dial += 1; setDial(); }
    place();
  }

  /* ---- the page ----------------------------------------------------------- */

  function build() {
    var art = document.getElementById("art");
    root = el("section", "pt");
    root.setAttribute("aria-label", "The place, then");
    var stage = el("div", "pt-stage");
    var canvas = el("canvas", "pt-clod");
    canvas.setAttribute("role", "img");
    canvas.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    canvas.addEventListener("click", function (event) {
      event.stopPropagation();
      if (!S || !S.dots) { return; }
      // A press swings it a quarter turn, to the next diagonal.
      S.from = S.heading;
      S.to = Math.round((S.heading - TAU / 8) / (TAU / 4)) * (TAU / 4) + TAU / 8 + TAU / 4;
      S.swingAt = performance.now();
    });
    stage.appendChild(canvas);
    var tile = el("span", "pt-here");
    tile.setAttribute("aria-hidden", "true");
    stage.appendChild(tile);
    var label = el("span", "pt-here-label");
    stage.appendChild(label);
    var head = el("div", "pt-head");
    var title = el("p", "pt-title");
    var where = el("p", "pt-where");
    var note = el("p", "pt-note");
    head.appendChild(title);
    stage.appendChild(head);
    // How exactly the square is placed, and what its years can say: under the title on a
    // desktop, in the clod's empty lower corner on a phone.
    var foot = el("div", "pt-foot");
    foot.appendChild(where);
    foot.appendChild(note);
    stage.appendChild(foot);
    root.appendChild(stage);

    var work = el("div", "pt-work");
    var picBtn = button("pt-pic", function () { var it = S && S.items[S.i]; if (it) { openItem(it); } });
    var img = el("img");
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", function () { picBtn.dataset.none = "true"; });
    img.addEventListener("load", function () { delete picBtn.dataset.none; });
    picBtn.appendChild(img);
    work.appendChild(picBtn);
    var text = el("div", "pt-text");
    var wt = el("p", "pt-wt");
    var how = el("p", "pt-how");
    var nav = el("div", "pt-nav");
    var prev = button("pt-step", function () { step(-1, true); });
    prev.textContent = "‹";
    prev.setAttribute("aria-label", "The work before");
    var count = el("span", "pt-count");
    var next = button("pt-step", function () { step(1, true); });
    next.textContent = "›";
    next.setAttribute("aria-label", "The next work");
    nav.appendChild(prev);
    nav.appendChild(count);
    nav.appendChild(next);
    text.appendChild(wt);
    text.appendChild(how);
    text.appendChild(nav);
    work.appendChild(text);
    var doors = el("div", "pt-doors");
    doors.setAttribute("aria-label", "New ways on from this work, here");
    work.appendChild(doors);
    work.setAttribute("aria-live", "polite");
    root.appendChild(work);
    if (art) { art.insertBefore(root, art.firstChild); } else { document.body.appendChild(root); }
    refs = { head: head, foot: foot, stage: stage, canvas: canvas, tile: tile, label: label, title: title, where: where, note: note,
             work: work, pic: picBtn, img: img, wt: wt, how: how, count: count, doors: doors, prev: prev, next: next };
    place();
  }

  // Where it goes: on a phone the band above the column (the clod, the work under it);
  // on a desktop the work on the left, the clod between it and the column.
  function place() {
    if (!root) { return; }
    var W = window.innerWidth, H = window.innerHeight, phone = W <= 720;
    var col = document.getElementById("art-col");
    var cr = col && col.getClientRects().length ? col.getBoundingClientRect() : null;
    var top = 64;
    var dialEl = document.getElementById("art-time");
    var dr = dialEl && !dialEl.hidden && dialEl.getClientRects().length ? dialEl.getBoundingClientRect() : null;
    var key;
    if (phone) {
      var bottom = cr ? Math.max(top + 240, cr.top - 6) : H * 0.5;
      var band = bottom - top;
      var workH = Math.min(150, Math.max(118, band * 0.42));
      var stageH = band - workH;
      var right = W;
      if (dr && dr.bottom > bottom - workH && dr.top < bottom) { right = Math.max(W * 0.6, dr.left - 6); }
      key = [phone, top, stageH, workH, right].join(",");
      if (key === root._k) { return; }
      root._k = key;
      root.dataset.phone = "true";
      setBox(refs.stage, 0, top, W, stageH);
      setBox(refs.work, 0, top + stageH, right, workH);
      refs.work.style.maxHeight = "";
    } else {
      var colLeft = cr ? cr.left : W - 420;
      var panelW = Math.max(260, Math.min(360, W * 0.24));
      var sx = 24 + panelW + 12, sw = Math.max(200, colLeft - 12 - sx);
      var sh = H - top - 24;
      if (dr && dr.left < sx + sw && dr.right > sx) { sh = Math.max(240, dr.top - 8 - top); }
      key = [phone, top, panelW, sx, sw, sh].join(",");
      if (key === root._k) { return; }
      root._k = key;
      delete root.dataset.phone;
      setBox(refs.stage, sx, top, sw, sh);
      setBox(refs.work, 24, top + 12, panelW, 0);
      refs.work.style.height = "";
      refs.work.style.maxHeight = Math.round(H - top - 36) + "px";
    }
    if (S) { S.dirty = true; }
  }
  function setBox(e, x, y, w, h) {
    e.style.left = Math.round(x) + "px";
    e.style.top = Math.round(y) + "px";
    e.style.width = Math.round(w) + "px";
    e.style.height = Math.round(h) + "px";
  }
  window.addEventListener("resize", function () { if (root) { root._k = ""; place(); } });

  // The place's words: who, where, when; how exactly the square is placed; what the years can say.
  function say() {
    if (!S || !refs.title) { return; }
    var L = S.L, p = S.p, y = S.year;
    var age = y && L.born ? y - L.born : null;
    refs.title.textContent = surname(L.name) + " in " + p.place + ", " + y + (age !== null && age >= 0 ? " · aged " + age : "");
    var pl = S.place, lines = [];
    if (pl && pl.studio) {
      lines.push(pl.name + " · placed exactly · the square " + kmText((SIDE[pl.precision] || 560) / 1000) + " across");
    } else if (pl && S.studioWanted) {
      lines.push(S.studioWanted.name + " is placed exactly, but its own ground is not read yet: the square is " +
                 p.place + "’s middle, " + kmText(SIDE.town / 1000) + " across");
    } else if (pl) {
      var at = (p.at || [])[0];
      lines.push((at ? at.name + " is placed at its town" : "Where in " + p.place + " " + surname(L.name) + " stayed is not placed") +
                 ": the square is " + p.place + "’s middle, " + kmText((SIDE.town) / 1000) + " across");
    }
    refs.where.textContent = lines.join(" · ");
    var phrase = placePhrase(p);
    refs.label.textContent = phrase ? "“" + phrase.q + "”" : (p.at && p.at[0] ? p.at[0].name : "");
    refs.label.title = phrase ? phrase.name || "" : "";
    refs.label.hidden = !refs.label.textContent;
    yearNote();
  }
  function yearNote() {
    if (!S || !refs.note) { return; }
    var f = S.floor, y = S.year, t = "";
    if (!S.dots) { return; }
    if (f.none || !f.known) { t = "No building here is dated: all of today’s stand."; }
    else if (f.sat && f.lo && y < f.lo) { t = "Buildings before " + f.lo + " are not dated here: all that stood by " + f.lo + " is shown."; }
    else if (f.all && f.known / f.all < 0.8) { t = Math.round(100 * (1 - f.known / f.all)) + "% of the buildings have no year and stand throughout."; }
    var src = f.from.length ? "Years: " + f.from.join(", ") + "." : "";
    refs.note.textContent = t;
    refs.note.title = src;
  }

  function setDial() {
    if (!S || !window.Land || !Land.periodYears) { return; }
    var p = S.p, ys = S.items.map(function (it) { return it.y; }).filter(Boolean);
    var lo = p.y0 - 1, hi = Math.min(new Date().getFullYear(), p.y1 + 1);
    ys.forEach(function (y) { lo = Math.min(lo, y); hi = Math.max(hi, y); });
    if (Land.periodYears(lo, hi, ys.concat([p.y0]), S.year)) { S.setYears = [lo, hi]; }
  }

  /* ---- the works, one at a time ------------------------------------------- */

  function step(d, byHand) {
    if (!S || !S.items.length) { return; }
    S.i = (S.i + d + S.items.length) % S.items.length;
    S.held = 0;
    if (byHand) { S.pinned = true; }
    showItem(false);
  }

  function showItem(first) {
    if (!S || !refs.work) { return; }
    var it = S.items[S.i];
    refs.count.textContent = S.items.length ? (S.i + 1) + " of " + S.items.length : "";
    refs.prev.hidden = refs.next.hidden = S.items.length < 2;
    refs.doors.textContent = "";
    if (!it) {
      refs.wt.textContent = "No saved work is placed here in these years.";
      refs.how.textContent = "";
      refs.pic.hidden = true;
      return;
    }
    refs.pic.hidden = false;
    refs.work.dataset.kind = it.kind;
    if (it.img) { refs.img.src = it.img; delete refs.pic.dataset.none; } else { refs.img.removeAttribute("src"); refs.pic.dataset.none = "true"; }
    refs.pic.setAttribute("aria-label", (it.t || "Untitled") + (it.saved ? " — where it has been" : ""));
    refs.wt.textContent = "";
    refs.wt.appendChild(el("i", "", it.t || "Untitled"));
    refs.wt.appendChild(document.createTextNode(it.y ? ", " + it.y : ""));
    refs.how.textContent = [it.how, (it.cat || []).join(" · "), it.saved ? "" : "not saved" + (it.where ? " · " + it.where : "")].filter(Boolean).join(" · ");
    if (it.y) { setYear(it.y); }
    if (!still && !first) { refs.work.dataset.fresh = String(Date.now()); }
    associations(it);
    S.dirty = true;
  }

  function setYear(y) {
    S.year = y;
    S.whenTo = whenOf(y);
    if (window.Land && Land.dialYear) { Land.dialYear(y); }
    S.dialSet = y;
    say();
  }

  function openItem(it) {
    if (!window.Land) { return; }
    if (it.saved && it.id) { Land.work(it.id, S && S.p.key); return; }
    if (it.kind === "site" && it.ll && Land.site && it.key) { Land.site(it.key, it.ll[0], it.ll[1], 1.2, it.t); }
  }

  /* ---- associations: new paths from this work, here ------------------------ */

  function associations(it) {
    var mine = S, p = S.p, L = S.L;
    Promise.all([json("movements.json"), json("lives.json"), json("museums.json"), json("finding.json"),
                 it.saved && it.id ? json("histories/" + it.id + ".json") : null, historiesOf(S)])
      .then(function (r) {
        if (S !== mine || S.items[S.i] !== it) { return; }
        var M = r[0], LV = r[1], MU = r[2], F = r[3], h = r[4], hs = r[5];
        var cands = [];
        var y = it.y || p.y0;
        // Who else was here then: the lives that cross this one, the movements' presences.
        var here = {};
        (p.cross || []).forEach(function (ci) {
          var c = L.cross[ci];
          if (c && c[0] !== L.id) { here[c[0]] = { id: c[0], name: c[1], y0: c[4], y1: c[5], how: "both lives place them here" }; }
        });
        if (M && M.here && p.key) {
          (M.here[p.key] || []).forEach(function (row) {
            var a = M.artists[row[0]];
            if (!a || a[0] === L.id || here[a[0]]) { return; }
            if (row[2] < p.y0 - 1 || row[1] > p.y1 + 1) { return; }
            if (p.ll && isFinite(row[4]) && km(p.ll, [row[4], row[5]]) > 30) { return; }
            var y0 = Math.max(row[1], p.y0 - 1), y1 = Math.min(row[2], p.y1 + 1);
            here[a[0]] = { id: a[0], name: a[1], y0: Math.min(y0, y1), y1: Math.max(y0, y1), how: row[7] || row[3] };
          });
        }
        var hereList = Object.keys(here).map(function (id) { return here[id]; })
          .sort(function (a, b) { return Math.abs(a.y0 - y) - Math.abs(b.y0 - y) || (a.name < b.name ? -1 : 1); });
        if (hereList.length) {
          var o = hereList[0];
          cands.push({ kind: "artist", n: hereList.length, order: 0,
                       text: surname(o.name) + " here, " + yspan(o.y0, o.y1) + (hereList.length > 1 ? " · +" + (hereList.length - 1) : ""),
                       title: o.name + " was in " + p.place + " in " + yspan(o.y0, o.y1) + " (" + o.how + ")",
                       go: function () { if (window.Lives && Lives.open) { Lives.open(o.id, { year: o.y0 }); } } });
        }
        // A movement here, in the work's year.
        if (window.Movements && Movements.ofArtistName) {
          var mv = Movements.ofArtistName(L.name).filter(function (m) { return m.key === p.key && m.y0 <= y + 1 && y - 1 <= m.y1; })[0];
          if (mv) {
            cands.push({ kind: "movement", n: 1, order: 1, text: mv.title, title: "A movement found here: " + mv.title,
                         go: function () { Movements.open(mv.id); } });
          }
        }
        // Other works made in this town then, by anyone the saved list has.
        var others = [];
        if (LV && LV.made) {
          Object.keys(LV.made).forEach(function (wid) {
            var m = LV.made[wid];
            if (m[0] === L.id || m[4] !== p.place || !m[3] || Math.abs(m[3] - y) > 6) { return; }
            others.push({ id: wid, life: m[0], y: m[3] });
          });
        }
        var fw = {};
        if (F && F.w) { F.w.forEach(function (w) { fw[w[0]] = w; }); }
        // And Painted here's paintings by others within the square.
        var sitesNear = [];
        if (S.allSites && S.place) {
          var half = (SIDE[S.place.precision] || 2400) / 2000 * 1.4;
          S.allSites.forEach(function (s) {
            if (!s.ll || surname(s.a) === surname(L.name) || s.pr === "town") { return; }
            if (km([S.place.lat, S.place.lon], s.ll) > half) { return; }
            sitesNear.push(s);
          });
        }
        others.sort(function (a, b) { return Math.abs(a.y - y) - Math.abs(b.y - y); });
        if (others.length && fw[others[0].id]) {
          var ow = fw[others[0].id];
          cands.push({ kind: "work", n: others.length + sitesNear.length, order: 2,
                       text: surname(String(ow[2] || "").split(",")[0]) + " · " + (ow[1] || "Untitled") + (others[0].y ? ", " + others[0].y : ""),
                       title: "Also made in " + p.place + ": " + (ow[1] || "Untitled") + ", " + ow[2],
                       go: function () { Land.work(others[0].id); } });
        } else if (sitesNear.length) {
          var sn = sitesNear[0];
          cands.push({ kind: "work", n: sitesNear.length, order: 2,
                       text: surname(sn.a) + " painted " + (sn.what || sn.t) + (sn.d ? ", " + sn.d : ""),
                       title: sn.t + " by " + sn.a + " — painted here (Painted here; not saved)",
                       go: function () { if (Land.site && sn.key) { Land.site(sn.key, sn.ll[0], sn.ll[1], 1.2, sn.what || sn.t); } } });
        }
        // Where this work is now.
        if (it.saved && it.id) {
          var held = ((MU && MU.museums) || []).filter(function (m) { return (m.works || []).some(function (w) { return w.id === it.id; }); })[0];
          if (held) {
            cands.push({ kind: "museum", n: 1, order: 3, text: "Now · " + held.name, title: "Held now by " + held.name,
                         go: function () { Land.museum(held.slug); } });
          } else if (h && h.events) {
            var last = null;
            h.events.forEach(function (ev) { if (ev.p && ev.ll && ev.k !== "written") { last = ev; } });
            if (last && last.p !== p.key) {
              cands.push({ kind: "place", n: 1, order: 3, text: "Last · " + String(last.w || last.p).split(",")[0] + (last.y ? ", " + String(last.y).slice(0, 4) : ""),
                           title: "The last place its record names", go: function () { Land.town(last.p); } });
            }
          }
        }
        // The show that first put works from here together.
        var together = firstTogether(hs, it);
        if (together) {
          cands.push({ kind: "gallery", n: together.n, order: 4, text: "Shown together · " + together.y, title: "The first show of two or more works from here",
                       tid: together.tid, go: function () { Land.thread(together.tid); } });
        }
        // Who wrote on works from here.
        var vs = (p.voices || []).map(function (i) { return L.voices[i]; }).filter(Boolean);
        var v = vs.filter(function (r2) { return r2[4] === it.id; })[0] || vs[0];
        if (v) {
          cands.push({ kind: "writing", n: vs.length, order: 5, text: v[1] + " " + (v[3] || "wrote") + ", " + v[2], title: v[1] + " on works from here",
                       go: function () {
                         if (window.Kinds && Kinds.go) { Kinds.go("writer", v[0]).then(function (ok) { if (!ok && v[5] && window.Voices) { Voices.follow(v[0]); } }); }
                         else if (v[5] && window.Voices && Voices.follow) { Voices.follow(v[0]); }
                       } });
        }
        // The artist's animal, where one is drawn after them.
        var cast = CAST[L.name];
        if (cast && window.Characters && Characters.lead && Land.follow) {
          cands.push({ kind: "animal", n: 1, order: 6, text: "Follow the " + ANIMAL[cast], title: "The " + ANIMAL[cast] + " after " + L.name,
                       go: function () {
                         Characters.lead(cast).then(function (got) {
                           if (!got) { return; }
                           got.studio = { lat: S && S.place ? S.place.lat : p.ll[0], lon: S && S.place ? S.place.lon : p.ll[1] };
                           Land.follow(got);
                         });
                       } });
        }
        // Rarest first, three or four.
        cands.sort(function (a, b) { return a.n - b.n || a.order - b.order; });
        S.assoc = { list: cands.map(function (c) { return { kind: c.kind, text: c.text, n: c.n }; }), here: hereList, others: others, sitesNear: sitesNear };
        drawDoors(cands.slice(0, window.innerWidth <= 720 ? 3 : 4), it);
        if (together && together.tid) { nameThread(together, it); }
      });
  }

  // The histories of the period's saved works (the first 13), for the shows they share.
  function historiesOf(s) {
    if (s.hs) { return s.hs; }
    var ids = s.items.filter(function (it) { return it.saved && it.id; }).slice(0, 13).map(function (it) { return it.id; });
    s.hs = Promise.all(ids.map(function (id) { return json("histories/" + id + ".json").then(function (h) { return [id, h]; }); }));
    return s.hs;
  }
  function firstTogether(hs, it) {
    if (!hs) { return null; }
    var seen = {};              // thread -> { works: {}, y }
    hs.forEach(function (pair) {
      var h = pair[1];
      ((h && h.events) || []).forEach(function (ev) {
        if (ev.k !== "exhibited" || !ev.x) { return; }
        var y = parseInt(String(ev.y || ""), 10) || 9999;
        [].concat(ev.x).forEach(function (t) {
          var o = seen[t] || (seen[t] = { works: {}, y: y });
          o.works[pair[0]] = true;
          o.y = Math.min(o.y, y);
        });
      });
    });
    var best = null;
    Object.keys(seen).forEach(function (t) {
      var o = seen[t], n = Object.keys(o.works).length;
      if (n < 2) { return; }
      var mineToo = it.id && o.works[it.id] ? 0 : 1;
      if (!best || mineToo < best.m || (mineToo === best.m && o.y < best.y)) { best = { tid: t, y: o.y, n: n, m: mineToo }; }
    });
    return best && best.y < 9999 ? best : null;
  }
  function nameThread(together, it) {
    var mine = S;
    json("threads/" + together.tid + ".json").then(function (t) {
      if (S !== mine || S.items[S.i] !== it || !t || !t.name) { return; }
      var b = refs.doors.querySelector('[data-tid="' + together.tid + '"] .pt-door-t');
      if (b) { b.textContent = t.name + (together.y ? ", " + together.y : ""); }
    });
  }

  function drawDoors(list, it) {
    refs.doors.textContent = "";
    list.forEach(function (c) {
      var g = glyph(c.kind);
      var b = button("pt-door", function () { c.go(); });
      b.dataset.kind = c.kind;
      if (c.tid) { b.dataset.tid = c.tid; }
      b.style.setProperty("--kt", g[1]);
      b.title = c.title || c.text;
      var gl = el("span", "pt-door-g", g[0]);
      gl.setAttribute("aria-hidden", "true");
      b.appendChild(gl);
      b.appendChild(el("span", "pt-door-t", c.text));
      refs.doors.appendChild(b);
    });
  }

  /* ---- the clod, drawn ---------------------------------------------------- */

  var raf = 0;
  function loop() {
    if (raf) { return; }
    var tick = function (now) {
      raf = 0;
      if (!S) { return; }
      frame(now);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
  }

  function frame(now) {
    var dt = Math.min(250, now - S.last);
    S.last = now;
    // The slow clock: a work is held 17 s of stillness; nothing moves under reduced motion.
    if (!still && S.items.length > 1 && !document.hidden && now - lastMove > STILL_MS) {
      S.held += dt;
      if (S.held >= HOLD) { step(1, false); }
    }
    // The dial turned by hand: the clod stands at its year (and the clock waits).
    if (S.turned && now - S.turned > 120) {
      S.turned = 0;
      var d = window.Land && Land.dial ? Land.dial() : null;
      if (d && isFinite(d.year) && d.year !== S.year) {
        S.year = d.year;
        S.whenTo = whenOf(d.year);
        S.held = 0;
        say();
      }
    }
    if (!S.dots) { return; }
    if (S.swingAt) {
      var q = Math.min(1, (now - S.swingAt) / (still ? 1 : SWING));
      var e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
      S.heading = S.from + (S.to - S.from) * e;
      S.dirty = true;
      if (q >= 1) { S.swingAt = 0; }
    }
    if (S.when !== S.whenTo) {
      S.when += (S.whenTo - S.when) * Math.min(1, still ? 1 : dt / 520);
      if (Math.abs(S.whenTo - S.when) < 0.0004) { S.when = S.whenTo; }
      S.dirty = true;
    }
    var rising = !still && now - S.at < 1700;
    if (!(S.dirty || rising) || now - (S.drawn || 0) < 1000 / 12) { return; }
    S.drawn = now;
    S.dirty = false;
    drawClod(now, rising);
  }

  function drawClod(now, rising) {
    var c = refs.canvas, st = refs.stage;
    // The clod lies under the place's words, never behind them.
    var phone = root && root.dataset.phone === "true";
    var top = refs.head.offsetHeight + (phone ? 4 : refs.foot.offsetHeight + 18);
    if (c._top !== top) { c._top = top; c.style.top = top + "px"; c.style.height = "calc(100% - " + top + "px)"; }
    var w = Math.max(1, Math.ceil(c.clientWidth / PIX)), h = Math.max(1, Math.ceil(c.clientHeight / PIX));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    // It rises out of the ground the first time, a row at a time; after, it stands at its year.
    var shown = S.when;
    var f = window.Models.draw(c, S.dots, S.heading, rising ? Math.min(shown, (now - S.at) / 1600) : shown, 0.9);
    var g = c.getContext("2d");
    var n = S.dots.span;
    // The sites of the period's outings: a line of sea-green tiles from the place to each.
    if (S.place && S.items) {
      var cell = (SIDE[S.place.precision] || 2400) / n;
      var o = Models.project(f, 0, 0, S.centre);
      var it = S.items[S.i];
      S.items.forEach(function (x) {
        if (x.kind !== "site" || !x.ll) { return; }
        var dx = (x.ll[1] - S.place.lon) * 111320 * Math.cos(S.place.lat * Math.PI / 180);
        var dy = (x.ll[0] - S.place.lat) * 111320;
        var gx = dx / cell, gy = -dy / cell, lim = n / 2 - 0.5, off = Math.max(Math.abs(gx), Math.abs(gy)) > lim;
        if (off) { var k = lim / Math.max(Math.abs(gx), Math.abs(gy)); gx *= k; gy *= k; }
        var t = Models.project(f, gx, gy, 0);
        var lit = x === it;
        g.fillStyle = SEA;
        var steps = Math.max(1, Math.ceil(Math.hypot(t.x - o.x, t.y - o.y) / 3));
        for (var s = 0; s <= steps; s += 1) {
          if (!lit && s % 2) { continue; }
          g.globalAlpha = lit ? 0.95 : 0.4;
          g.fillRect(Math.round(o.x + (t.x - o.x) * s / steps) - 1, Math.round(o.y + (t.y - o.y) * s / steps) - 1, 2, 2);
        }
        g.globalAlpha = lit ? 1 : 0.55;
        g.fillRect(Math.round(t.x) - 3, Math.round(t.y) - 3, 6, 6);
        g.globalAlpha = 1;
        x.mark = { x: t.x * PIX, y: t.y * PIX + top, off: off, dist: Math.hypot(dx, dy) / 1000, dir: compass(dx, dy) };
      });
    }
    // The place itself: a lit 13 px tile at its point, its caption beside it.
    var at = Models.project(f, 0, 0, S.centre);
    var x = at.x * PIX, y = at.y * PIX + top;
    refs.tile.style.transform = "translate(" + Math.round(x - 6.5) + "px," + Math.round(y - 6.5) + "px)";
    refs.tile.dataset.on = "true";
    var lw = refs.label.offsetWidth, sw = refs.stage.clientWidth;
    var lx = x + 14 + lw > sw - 8 ? Math.max(8, x - 14 - lw) : x + 14;
    var ly = Math.max(top, Math.min(st.clientHeight - refs.label.offsetHeight - 4, y - 8));
    refs.label.style.transform = "translate(" + Math.round(lx) + "px," + Math.round(ly) + "px)";
    // The work's site off the clod: how far, which way.
    var cur = S.items[S.i];
    var off = refs.stage.querySelector(".pt-off");
    if (cur && cur.mark && cur.mark.off) {
      if (!off) { off = el("span", "pt-off"); refs.stage.appendChild(off); }
      off.textContent = kmText(cur.mark.dist) + " " + cur.mark.dir + " · " + (cur.how.split(" · ")[1] || "the site");
      off.style.transform = "translate(" + Math.round(Math.min(sw - 140, Math.max(8, cur.mark.x - 40))) + "px," + Math.round(cur.mark.y + 8) + "px)";
      off.hidden = false;
    } else if (off) { off.hidden = true; }
    yearNote();
  }

  /* ---- from a studio's column (the Artists layer) --------------------------- */

  function fromStudio(i, box) {
    var St = window.Studios && Studios.data && Studios.data();
    var r = St && St.studios[i];
    var A = r && St.artists[+r.a];
    if (!A || !window.Lives || !Lives.idOf) { return; }
    Lives.load().then(function () {
      var id = Lives.idOf(A[1]);
      if (!id) { return; }
      lifeFile(id).then(function (L) {
        if (!L || !box.isConnected) { return; }
        var k = -1;
        L.periods.forEach(function (p, j) {
          if (k >= 0) { return; }
          if ((p.at || []).some(function (a) { return a.studio === i; })) { k = j; }
        });
        if (k < 0) {
          L.periods.forEach(function (p, j) {
            if (k >= 0 || !p.ll || !r.ll) { return; }
            if (km(p.ll, r.ll) < 3 && (!r.y0 || (p.y0 <= +r.y1 + 1 && +r.y0 - 1 <= p.y1))) { k = j; }
          });
        }
        if (k >= 0) { open({ L: L, k: k, box: box }); }
      });
    });
  }

  /* ---- the categories' lists of this place (kinds.js) ----------------------- */

  function facts(id, k) {
    if (!S || S.L.id !== id || S.k !== k) { return null; }
    return {
      place: S.p.place, key: S.p.key, y0: S.p.y0, y1: S.p.y1, artist: S.L.name,
      works: S.items.filter(function (it) { return it.saved && it.id; }).map(function (it) { return { id: it.id, how: it.how, y: it.y }; }),
      here: (S.assoc.here || []).map(function (o) { return { name: o.name, sub: "here " + yspan(o.y0, o.y1) + " · " + o.how }; })
    };
  }

  window.PlaceThen = {
    open: open,
    // The dial as the hub (dialhub.js): which place is up, its works as marks, one brought up.
    key: function () { return S ? S.L.id + ":" + S.k + ":" + S.items.length : ""; },
    marks: function () {
      return S ? S.items.map(function (it, i) {
        return { i: i, y: it.y, site: it.kind === "site", label: (it.t || "Untitled") + (it.y ? ", " + it.y : "") + " · " + it.how };
      }).filter(function (m) { return m.y; }) : [];
    },
    show: function (i) { if (S && S.items[i]) { S.i = i; S.held = 0; S.pinned = true; showItem(false); } },
    close: close,
    studio: fromStudio,
    facts: facts,
    _state: function () {
      if (!S) { return null; }
      var it = S.items[S.i];
      return { life: S.L.id, k: S.k, place: S.p.place, ground: S.slug, year: S.year, when: S.when,
               floor: S.floor ? { lo: S.floor.lo, sat: S.floor.sat, from: S.floor.from, known: S.floor.known, all: S.floor.all } : null,
               items: S.items.length, i: S.i, work: it ? it.t + (it.y ? ", " + it.y : "") : null, how: it ? it.how : null,
               doors: refs.doors ? [].map.call(refs.doors.querySelectorAll(".pt-door"), function (b) { return b.textContent; }) : [],
               title: refs.title ? refs.title.textContent : "", where: refs.where ? refs.where.textContent : "",
               note: refs.note ? refs.note.textContent : "", label: refs.label ? refs.label.textContent : "",
               dial: window.Land && Land.dial ? (Land.dial() || {}).year : null };
    }
  };
})();

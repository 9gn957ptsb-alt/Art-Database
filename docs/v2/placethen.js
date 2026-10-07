/* The place, then — a life's place as it stood in its years, and the works made there.

   The artist, 2 Oct 2026, of Picasso's life entered at Fontainebleau, 1921
   (a muddy field of pixel ground with a ring on it): "I want there to be a
   stronger visual for a city when I click on it when reading about an
   artist. Maybe show his studio or neighborhood when cycling through the
   artworks he painted there at that time. Something that enables new paths
   of exploration by way of new associations of objects relative to a
   specific context". And, 7 Oct 2026, of Twombly's life entered at Rome,
   1961: "If I am looking at a specific artist in a specific city at a
   specific time, the most important thumbnail is one that I am able to
   swipe through all relevant artworks for that time and place."

   When a period of a life is entered (Lives' "Enter ›", or a studio's
   column from the Artists layer), the view becomes that place in those
   years, laid out as the reading layout is:

   · the works, first and large, in the picture's slot (across the top on a
     phone, the left third on a desktop), swiped through (Voice.swipeable:
     a finger's sideways drag, a trackpad's sideways scroll, ←/→, the quiet
     ‹ › on a desktop) and on the reading's slow clock (17 s, Smith &
     Smith's median look, counted only while the pointer is still). First
     the artist's own of the period — Made then, Printed then, Painted
     here's outings: the reading layout's own list (Voice.periodPics), saved
     first, then paintings not saved, from Commons, each in date order —
     then works by others made in the same town in those years (a life's
     record of making, a history's "made" here, a painting at a documented
     site here), each tagged with its artist ("Braque · Paris, 1908") so it
     is never taken for the artist's own. Under it, its title (a door to its
     history), how it is known, and where it stands ("2 of 7 · Rome ·
     1961–1963"). The dial turns to its year, the column's square of it is
     lit; a press fills the screen with it.
   · new associations for the work in view, under it, from the data only,
     rarest first, three or four: who else was here then (lives that cross,
     the movements' presences), a movement here, other works made in this
     town, where this work is now, the show that first put works from here
     together, who wrote on them, the artist's animal. Each door is marked
     with its category's glyph (KINDS.md).
   · the clod, in second place — beside the dial on a phone, between the
     picture and the column on a desktop: the place's ground (grounds/
     <slug>.json, scripts/build_grounds.py from lifeplaces.json) drawn in
     true isometric by the museums' own code (Land.ground → shapeClod,
     Models.draw), centred on the studio where the studios place it
     exactly, else on the town's point, and said so in one quiet line under
     the place's sentence, what its years can say a tap away. Its buildings
     stand by their years (`built`, scripts/build_built_years.py): what had
     not gone up by the year is not drawn; where the years do not reach back
     (the satellites' first year is 1975) it says so. The place itself is a
     lit tile of pixel light; what the record calls it (the villa, the
     garage used as a studio) is its caption, quoted. A painting at a
     documented site draws a line of sea-green tiles from the place to its
     site (or to the clod's edge, with how far and which way). A press
     swings it a quarter turn.

   Hooks: lives.js calls PlaceThen.open({ L, k, box }) from the period's
   column and PlaceThen.studio(i, box) from a studio's; land.js gives
   Land.ground, Land.periodYears, Land.dial(Year) and Land.where (its
   `life`); voice.js gives Voice.periodPics and Voice.swipeable. It closes
   itself when its box leaves the page. */
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
  var OTHERS = 34;                               // works by others, at most, after the artist's own
  var NEAR_KM = 6;                               // a documented site this near the place is in its town
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
    var w = String(a || "").replace(/\s*\([^)]*\)\s*$/, "").trim().split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function firstArtist(a) { return String(a || "").split(", ")[0].replace(/\s*\([^)]*\)\s*$/, "").trim(); }
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

  /* ---- the period's works ------------------------------------------------- */

  // The artist's own, as the reading layout's picture swipes through them (Voice.periodPics):
  // Made then and Printed then, saved, in date order; then Painted here's outings not saved.
  function ownItems(L, k) {
    var V = window.Voice;
    if (!V || !V.periodPics) { return []; }
    var works = {}, sites = {};
    L.works.forEach(function (w) { works[w[0]] = w; });
    (L.sites || []).forEach(function (s) { sites[s[0]] = s; });
    return V.periodPics(L, k).map(function (q) {
      var s = q.site ? sites[q.site] : null;
      if (s) {
        return { kind: "site", id: q.id || null, sid: q.site, t: q.title, y: q.year || null, img: q.src, big: q.big || q.src,
                 how: "painted at a documented site · " + (s[3] || "the place painted"), ll: s[4], key: s[7],
                 where: q.where || "", saved: !q.notSaved };
      }
      var w = works[q.id];
      if (!w || !w[3]) { return null; }
      var h = String(w[4] || "dated"), base = h.split(":")[0], print = w.length > 8 && w[8];
      return { kind: print ? "print" : "made", id: w[0], t: q.title, circa: q.circa, y: w[2] || null,
               img: CDN + w[3] + "/large.jpg", alt: CDN + w[3] + "/medium.jpg", big: CDN + w[3] + "/larger.jpg",
               how: print ? "pulled at " + w[8][0] + (w[8][1] ? ", " + w[8][1] : "")
                 : base === "record" && h.indexOf(":") > 0 ? "made in " + h.slice(h.indexOf(":") + 1) + ", its record says" : HOW[base] || h,
               cat: w[7] || [], saved: true };
    }).filter(Boolean);
  }
  function firstTitled(items) {
    for (var i = 0; i < items.length; i += 1) { if (!untitled(items[i].t)) { return i; } }
    return 0;
  }

  /* Works by other artists made in the same town in those years, after the
     artist's own: a life's record of making (lives.json `made`), a work's
     history saying it was made here (places/<key>.json), a painting at a
     documented site here (sites.json). Saved first, then not saved, each in
     date order; each carries its artist. */
  function othersOf(L, p, own) {
    return Promise.all([json("lives.json"), json("finding.json"), p.key ? json("places/" + p.key + ".json") : null, json("sites.json")])
      .then(function (r) {
        var LV = r[0], F = r[1], PF = r[2], SD = r[3];
        var seen = {}, out = [], fw = {}, cdn = (F && F.cdn) || CDN, mine = surname(L.name);
        own.forEach(function (it) { if (it.id) { seen[it.id] = true; } if (it.sid) { seen["s:" + it.sid] = true; } });
        ((F && F.w) || []).forEach(function (w) { fw[w[0]] = w; });
        function inYears(y) { return y && y >= p.y0 && y <= p.y1; }
        function saved(id, y, how, by) {
          var w = fw[id], a = by || (w && firstArtist(w[2]));
          if (!w || !w[4] || seen[id] || !a || surname(a) === mine) { return; }
          seen[id] = true;
          out.push({ kind: "made", id: id, t: w[1], y: y, img: cdn + w[4] + "/large.jpg", alt: cdn + w[4] + "/medium.jpg",
                     big: cdn + w[4] + "/larger.jpg", how: how, cat: [], saved: true, other: true, by: a });
        }
        if (LV && LV.made) {
          Object.keys(LV.made).forEach(function (id) {
            var m = LV.made[id];
            if (m[0] === L.id || m[4] !== p.place || !inYears(m[3])) { return; }
            saved(id, m[3], m[1] ? "pulled at " + m[1] + (m[2] ? ", " + m[2] : "") : HOW[m[5]] || HOW.dated);
          });
        }
        // A history's "made" here: only where the town of its file is this place.
        if (PF && PF.works && !(p.ll && PF.ll && km(p.ll, PF.ll) > 15)) {
          PF.works.forEach(function (row) {
            if ((row[8] || []).indexOf("made") < 0 || !inYears(row[6])) { return; }
            saved(row[0], row[6], HOW.record, firstArtist(row[2]));
          });
        }
        ((SD && SD.sites) || []).forEach(function (s) {
          if (!s.img || !s.ll || s.pr === "town" || !inYears(s.d) || !s.a || surname(s.a) === mine) { return; }
          if (s.place !== p.place && !(p.ll && km(p.ll, s.ll) <= NEAR_KM)) { return; }
          var key = s.w || "s:" + s.id;
          if (seen[key]) { return; }
          seen[key] = true;
          out.push({ kind: "site", id: s.w || null, sid: s.id, t: s.t, y: s.d,
                     img: COMMONS + encodeURIComponent(s.img) + "?width=960", big: COMMONS + encodeURIComponent(s.img) + "?width=2000",
                     how: "painted at a documented site · " + (s.what || s.place || "the place painted"), ll: s.ll, key: s.key,
                     where: s.m || "", saved: !!s.w, other: true, by: s.a });
        });
        out.sort(function (a, b) { return (b.saved ? 1 : 0) - (a.saved ? 1 : 0) || (a.y || 9999) - (b.y || 9999); });
        return out.slice(0, OTHERS);
      });
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

  var S = null;               // { L, k, p, box, items, own, i, ... }
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
    S = { L: L, k: k, p: p, box: spec.box, items: [], own: 0, i: 0, held: 0, last: performance.now(), year: p.y0,
          shownYear: null, ground: null, slug: null, place: null, dial: 0, pinned: false, gone: false, assoc: {}, ready: false };
    var mine = S;
    build();
    document.body.dataset.placethen = "true";
    var V = window.Voice;
    Promise.all([json("lifeplaces.json"), V && V.sitesReady ? V.sitesReady() : null, json("sites.json")]).then(function (r) {
      if (S !== mine) { return; }
      var lp = r[0], sites = r[2];
      S.allSites = (sites && sites.sites) || null;
      S.items = ownItems(L, k);
      S.own = S.items.length;
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
      if (S.items.length) { S.ready = true; showItem(true); }
      // Then the works by others made here then, after the artist's own.
      othersOf(L, p, S.items).then(function (more) {
        if (S !== mine) { return; }
        S.items = S.items.concat(more);
        S.ready = true;
        if (S.items.length === more.length) { S.i = 0; showItem(true); } else { showCount(); }
        if (root) { root._k = ""; place(); }
      });
      if (!pick) { S.noGround = "No ground has been read for " + p.place + "."; say(); return; }
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
      if (!got) { S.noGround = "No ground has been read for " + pl.name + " yet."; say(); return false; }
      S.noGround = "";
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
    setFull(false);
    if (root && root.parentNode) { root.parentNode.removeChild(root); }
    root = null;
    refs = {};
    markSquare(null);
    delete document.body.dataset.placethen;
    ["--pt-dial-left", "--pt-dial-top", "--pt-col-top"].forEach(function (v) { document.body.style.removeProperty(v); });
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

    // The works: the picture, its words, its doors.
    var work = el("div", "pt-work");
    var picbox = el("div", "pt-picbox");
    var picBtn = button("pt-pic", function () { pressPic(); });
    var img = el("img");
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", function () {
      var it = S && S.items[S.i];
      if (it && it.alt && img.dataset.tried !== it.alt) { img.dataset.tried = it.alt; img.src = it.alt; return; }
      picBtn.dataset.none = "true";
    });
    img.addEventListener("load", function () { delete picBtn.dataset.none; });
    picBtn.appendChild(img);
    picbox.appendChild(picBtn);
    var tag = el("span", "pt-tag");
    tag.hidden = true;
    picbox.appendChild(tag);
    var none = el("p", "pt-none");
    none.hidden = true;
    picbox.appendChild(none);
    // On a desktop, quiet ‹ › at its edges (the reading layout's).
    var prev = button("voice-swipe pt-swipe pt-swipe-prev", function () { step(-1, true); });
    prev.textContent = "‹";
    prev.setAttribute("aria-label", "The work before, of these years");
    var next = button("voice-swipe pt-swipe pt-swipe-next", function () { step(1, true); });
    next.textContent = "›";
    next.setAttribute("aria-label", "The next work of these years");
    picbox.appendChild(prev);
    picbox.appendChild(next);
    work.appendChild(picbox);
    var cap = el("div", "pt-cap");
    // Only the work's line is said when it changes, not its whole wall label (WCAG 4.1.3; a11y.js).
    var line = el("div", "pt-line");
    if (window.A11y) { A11y.settled(line); } else { line.setAttribute("aria-live", "polite"); }
    var wt = button("pt-wt", function () { var it = S && S.items[S.i]; if (it) { openItem(it); } });
    var count = el("span", "pt-count");
    line.appendChild(wt);
    line.appendChild(count);
    // Its wall label (label.js): artist · date, medium · size, how it is known, where it is now.
    // Always under the picture (artist, 7 Oct 2026: "always be below the thumbnail of the artwork"; placeLabel).
    var how = el("div", "wall-label pt-label");
    cap.appendChild(line);
    cap.appendChild(how);
    img.addEventListener("load", function () { placeLabel(); var zb = window.Zoom && Zoom.big(); if (zb && zb.node === picBtn) { zb.relayout(); } });
    work.appendChild(cap);
    var doors = el("div", "pt-doors");
    doors.setAttribute("aria-label", "New ways on from this work, here");
    work.appendChild(doors);
    root.appendChild(work);
    // A finger's sideways drag, a trackpad's sideways scroll, ←/→ (voice.js, the reading layout's own).
    if (window.Voice && Voice.swipeable) { Voice.swipeable(picBtn, function (d) { return step(d, true); }, root); }

    // The place: its sentence, one quiet line of how exactly it is placed (the rest a tap away), the clod.
    var stage = el("div", "pt-stage");
    var head = el("div", "pt-head");
    var title = el("p", "pt-say");
    var quiet = button("pt-quiet", function () { more(quiet.getAttribute("aria-expanded") !== "true"); });
    quiet.setAttribute("aria-expanded", "false");
    var where = el("span", "pt-where");
    var info = el("span", "pt-info", "ⓘ");
    info.setAttribute("aria-hidden", "true");
    quiet.appendChild(where);
    quiet.appendChild(info);
    head.appendChild(title);
    head.appendChild(quiet);
    stage.appendChild(head);
    var moreBox = el("div", "pt-more");
    moreBox.hidden = true;
    var moreWhere = el("p", "pt-more-where");
    var note = el("p", "pt-note");
    var src = el("p", "pt-src");
    moreBox.appendChild(moreWhere);
    moreBox.appendChild(note);
    moreBox.appendChild(src);
    moreBox.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    moreBox.addEventListener("click", function (event) { event.stopPropagation(); more(false); });
    var canvas = el("canvas", "pt-clod");
    canvas.setAttribute("role", "img");
    // Named as the place it is, from its sentence (WCAG 1.1.1); kept up as the place changes.
    canvas.setAttribute("aria-label", "The place, its ground in dots seen from above");
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
    stage.appendChild(moreBox);
    root.appendChild(stage);

    if (art) { art.insertBefore(root, art.firstChild); } else { document.body.appendChild(root); }
    refs = { head: head, stage: stage, canvas: canvas, tile: tile, label: label, title: title, quiet: quiet, where: where, info: info,
             more: moreBox, moreWhere: moreWhere, note: note, src: src, work: work, picbox: picbox, pic: picBtn, img: img, tag: tag,
             none: none, wt: wt, how: how, cap: cap, count: count, doors: doors, prev: prev, next: next };
    place();
  }

  /* Where it goes, as the reading layout lays a path out (land.js workBands):
     on a phone the picture across the top under the banner, its words and
     doors under it, then the place — its sentence over the clod, the clod
     left of the dial — and the column below; on a desktop the picture the
     left third, the place between it and the column, the dial under the
     clod. With no work to show, the clod takes the picture's room. */
  function place() {
    if (!root) { return; }
    var W = window.innerWidth, H = window.innerHeight, phone = W <= 720;
    var bn = document.getElementById("banner"), under = document.getElementById("banner-under");
    var ub = bn && !bn.hidden && under && under.getClientRects().length ? under.getBoundingClientRect().bottom : 0;
    var top = Math.max(phone ? 74 : 76, Math.round(ub + 10));
    var empty = !!(S && S.ready && !S.items.length);
    var bs = document.body.style, key;
    if (phone) {
      var DIAL = 136, HEAD = 40, CLOD = 140, WORDS = 128;   // the title and count, the wall label, the doors
      var pic = Math.round(Math.max(120, Math.min(0.31 * H, H - top - WORDS - HEAD - CLOD - 8 - 0.25 * H)));
      var workH = empty ? 68 : pic + WORDS, bandTop = top + workH + 2;
      var bandH = empty ? pic + WORDS + HEAD + CLOD - 70 : HEAD + CLOD;
      key = ["p", W, H, top, empty].join(",");
      if (key === root._k) { return; }
      root._k = key;
      root.dataset.phone = "true";
      setBox(refs.work, 0, top, W, workH);
      setBox(refs.stage, 0, bandTop, W, bandH);
      bs.setProperty("--pt-dial-left", (W - DIAL - 12) + "px");
      bs.setProperty("--pt-dial-top", (bandTop + bandH - CLOD + Math.round((CLOD - DIAL) / 2)) + "px");
      bs.setProperty("--pt-col-top", (bandTop + bandH + 4) + "px");
    } else {
      var col = document.getElementById("art-col");
      var cr = col && col.getClientRects().length ? col.getBoundingClientRect() : null;
      var colLeft = cr ? cr.left : W - Math.min(0.4 * W, 440);
      var D = 168, dialTop = H - D - 28;
      var pw = Math.round(Math.min(0.34 * W, 560));
      var sx = empty ? 24 : 24 + pw + 16, sw = Math.max(200, colLeft - 12 - sx);
      key = ["d", W, H, top, Math.round(colLeft), empty].join(",");
      if (key === root._k) { return; }
      root._k = key;
      delete root.dataset.phone;
      if (empty) { setBox(refs.work, sx, dialTop - 4, Math.max(200, sw / 2 - D / 2 - 16), D + 4); }
      else { setBox(refs.work, 24, top, pw, H - top - 24); }
      setBox(refs.stage, sx, top, sw, dialTop - 12 - top);
      bs.setProperty("--pt-dial-left", Math.round(sx + sw / 2 - D / 2) + "px");
      bs.setProperty("--pt-dial-top", dialTop + "px");
      bs.removeProperty("--pt-col-top");
    }
    if (empty) { root.dataset.empty = "true"; } else { delete root.dataset.empty; }
    if (S) { S.dirty = true; placeArrows(); }
  }
  function setBox(e, x, y, w, h) {
    e.style.left = Math.round(x) + "px";
    e.style.top = Math.round(y) + "px";
    e.style.width = Math.round(w) + "px";
    e.style.height = Math.round(h) + "px";
  }
  window.addEventListener("resize", function () { if (root) { root._k = ""; place(); } });

  // The place's words: who, where, when; how exactly the square is placed (one quiet line);
  // what the years can say, and their sources, a tap away.
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
    if (S.noGround) { lines.push(S.noGround); }
    var text = lines.join(" · ");
    if (refs.where.textContent !== text) { refs.where.textContent = text; refs.moreWhere.textContent = text; }
    refs.quiet.title = text;
    var phrase = placePhrase(p);
    refs.label.textContent = phrase ? "“" + phrase.q + "”" : (p.at && p.at[0] ? p.at[0].name : "");
    refs.label.title = phrase ? (phrase.q + (phrase.name ? " — " + phrase.name : "")) : refs.label.textContent;
    refs.label.hidden = !refs.label.textContent;
    yearNote();
  }
  function yearNote() {
    if (!S || !refs.note) { return; }
    var f = S.floor, y = S.year, t = "";
    if (!S.dots) { refs.quiet.hidden = !refs.where.textContent; return; }
    if (f.none || !f.known) { t = "No building here is dated: all of today’s stand."; }
    else if (f.sat && f.lo && y < f.lo) { t = "Buildings before " + f.lo + " are not dated here: all that stood by " + f.lo + " is shown."; }
    else if (f.all && f.known / f.all < 0.8) { t = Math.round(100 * (1 - f.known / f.all)) + "% of the buildings have no year and stand throughout."; }
    var src = f.from.length ? "Years: " + f.from.join(", ") + "." : "";
    if (refs.note.textContent !== t) { refs.note.textContent = t; }
    if (refs.src.textContent !== src) { refs.src.textContent = src; }
    refs.quiet.hidden = !refs.where.textContent && !t;
    if (!refs.where.textContent && t && refs.where.textContent !== t) { refs.where.textContent = t; }
  }
  // The rest of what the place can say, under its quiet line; a press there, or on it, puts it away.
  function more(on) {
    if (!refs.more) { return; }
    refs.more.hidden = !on;
    refs.quiet.setAttribute("aria-expanded", on ? "true" : "false");
  }

  function setDial() {
    if (!S || !window.Land || !Land.periodYears) { return; }
    var p = S.p, ys = S.items.slice(0, S.own).map(function (it) { return it.y; }).filter(Boolean);
    var lo = p.y0 - 1, hi = Math.min(new Date().getFullYear(), p.y1 + 1);
    ys.forEach(function (y) { lo = Math.min(lo, y); hi = Math.max(hi, y); });
    if (Land.periodYears(lo, hi, ys.concat([p.y0]), S.year)) { S.setYears = [lo, hi]; }
  }

  /* ---- the works, one at a time ------------------------------------------- */

  function step(d, byHand) {
    if (!S || S.items.length < 2) { return false; }
    S.i = (S.i + d + S.items.length) % S.items.length;
    S.held = 0;
    if (byHand) { S.pinned = true; }
    if (!still && refs.picbox) {
      refs.picbox.dataset.swipe = d > 0 ? "next" : "prev";
      window.clearTimeout(refs.picbox._sw);
      var box = refs.picbox;
      box._sw = window.setTimeout(function () { delete box.dataset.swipe; }, 700);
    }
    showItem(false);
    return true;
  }

  // Where the work stands among the period's: "2 of 7 · Rome · 1961–1963".
  function showCount() {
    if (!S || !refs.count) { return; }
    var n = S.items.length, p = S.p;
    var text = n > 1 ? (S.i + 1) + " of " + n + " · " + p.place + " · " + (p.y0 === p.y1 ? p.y0 : p.y0 + "–" + p.y1) : "";
    if (refs.count.textContent !== text) { refs.count.textContent = text; }
    refs.count.hidden = !text;
    refs.prev.hidden = refs.next.hidden = n < 2;
  }

  function showItem(first) {
    if (!S || !refs.work) { return; }
    var it = S.items[S.i];
    refs.doors.textContent = "";
    showCount();
    if (!it) {
      refs.pic.hidden = true;
      refs.tag.hidden = true;
      refs.wt.textContent = "";
      refs.wt.disabled = true;
      refs.how.textContent = "";
      refs.none.hidden = false;
      refs.none.textContent = "No work is placed here in these years.";
      markSquare(null);
      return;
    }
    refs.none.hidden = true;
    refs.pic.hidden = false;
    refs.work.dataset.kind = it.kind;
    if (it.other) { refs.work.dataset.other = "true"; } else { delete refs.work.dataset.other; }
    delete refs.img.dataset.tried;
    if (it.img) { refs.img.src = it.img; delete refs.pic.dataset.none; } else { refs.img.removeAttribute("src"); refs.pic.dataset.none = "true"; }
    var title = (it.t || "Untitled") + (it.y ? ", " + (it.circa ? "c. " : "") + it.y : "");
    refs.img.alt = title + (it.other ? ", by " + it.by : "");
    refs.pic.setAttribute("aria-label", "Look at " + (it.t || "Untitled") + (it.other ? " by " + it.by : "") + " on the whole screen" +
                          (S.items.length > 1 ? "; ← and → for the other works of these years" : ""));
    // A work by another artist is never taken for the artist's own: its artist on it, and in its line.
    refs.tag.hidden = !it.other;
    refs.tag.textContent = it.other ? "○ " + surname(it.by) + " · " + S.p.place + (it.y ? ", " + it.y : "") : "";
    refs.wt.textContent = "";
    if (it.other) { refs.wt.appendChild(el("span", "pt-by", surname(it.by) + " · ")); }
    refs.wt.appendChild(el("i", "", it.t || "Untitled"));
    refs.wt.appendChild(document.createTextNode((it.y ? ", " + (it.circa ? "c. " : "") + it.y : "") + (it.saved && it.id || it.ll ? " ›" : "")));
    refs.wt.disabled = !(it.saved && it.id) && !(it.kind === "site" && it.ll);
    // Its visible words first (WCAG 2.5.3), then what a press does.
    refs.wt.setAttribute("aria-label", refs.wt.textContent.replace(/ ›$/, "") + (it.saved && it.id ? " — where it has been" : " — go to where it was painted"));
    labelItem(it);
    if (it.y) { setYear(it.y); }
    if (!still && !first) { refs.work.dataset.fresh = String(Date.now()); }
    markSquare(it);
    associations(it);
    S.dirty = true;
  }

  /* The work's wall label (label.js), which changes with the swipe: how it is known kept in it
     ("dated within these years", "pulled at Lacourière, Paris", a catalogue number); a saved work's
     facts are Artsy's and where it is now its history's; a painting not saved says so, by Wikidata. */
  function howOf(it) {
    return [it.how, (it.cat || []).join(" · "), it.saved ? "" : "not saved"].filter(Boolean).join(" · ");
  }
  function labelItem(it) {
    var mine = S, how = howOf(it), W = window.WallLabel;
    if (!W) { refs.how.textContent = how; return; }
    var by = it.other ? it.by : S.L.name;
    var quick = W.fromItem({ title: it.t, by: by, year: it.y, where: it.saved ? "" : it.where, src: it.saved ? "Artsy" : "Wikidata" });
    W.fill(refs.how, quick, { title: false, how: how });
    if (it.saved && it.id) {
      W.facts(it.id).then(function (f) {
        if (S !== mine || S.items[S.i] !== it || !f) { return; }
        W.fill(refs.how, f, { title: false, how: how });
            placeLabel();
      });
    }
    placeLabel();
  }
  /* The label always under the picture, before its doors (artist, 7 Oct 2026: "the info for the
     artwork should always be below the thumbnail of the artwork"); the ‹ › just outside the picture
     as it is drawn (artist, same day: "The arrows on either side of the artwork should be outside the
     boundary of the thumbnail"): the picture's box is narrowed by an arrow's width each side where it
     swipes, and each arrow stands against the picture's drawn edge, never over it. */
  var PT_ARROW = 28, PT_GAP = 6;
  function placeLabel() {
    if (!S || !refs.pic) { return; }
    if (refs.how.parentNode !== refs.cap) { refs.cap.appendChild(refs.how); }
    delete refs.work.dataset.side;
    refs.work.style.removeProperty("--pt-pic-w");
    placeArrows();
  }
  function placeArrows() {
    if (!S || !refs.pic) { return; }
    var swipes = S.items && S.items.length > 1 && !refs.pic.hidden;
    var room = swipes ? PT_ARROW + PT_GAP : 0;
    refs.pic.style.left = room + "px";
    refs.pic.style.right = room + "px";
    refs.pic.style.width = "auto";
    if (!swipes) { return; }
    var im = refs.img, bw = refs.picbox.clientWidth - 2 * room, bh = refs.picbox.clientHeight;
    var aspect = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0;
    var dw = aspect ? Math.min(bw, bh * aspect) : bw;
    var x0 = room + (bw - dw) / 2;
    refs.prev.style.left = Math.round(x0 - PT_GAP - PT_ARROW) + "px";
    refs.prev.style.right = "auto";
    refs.next.style.left = Math.round(x0 + dw + PT_GAP) + "px";
    refs.next.style.right = "auto";
  }

  // The column's square of the work in the picture, lit (as the reading layout's swipe lights it).
  function markSquare(it) {
    var col = document.getElementById("art-col");
    if (!col) { return; }
    Array.prototype.forEach.call(col.querySelectorAll("[data-work]"), function (b) {
      if (it && it.id && !it.other && b.dataset.work === it.id) { b.dataset.now = "true"; } else { delete b.dataset.now; }
    });
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

  /* ---- a press: twice as big; again: the whole screen, as near as one likes ----
     (zoom.js; artist, 7 Oct 2026). Escape, the close mark or a press on the
     dark steps back. A swipe still changes the work at its size and at twice
     it; on the whole screen one finger moves it. */

  function labelNode() {
    var it = S && S.items[S.i];
    if (!it) { return null; }
    var n = el("div", "wall-label"), tl = el("p", "wl-title");
    tl.appendChild(el("i", "", it.t || "Untitled"));
    n.appendChild(tl);
    Array.prototype.forEach.call(refs.how.childNodes, function (c) { n.appendChild(c.cloneNode(true)); });
    if (refs.count && refs.count.textContent) { n.appendChild(el("p", "wl-src", refs.count.textContent)); }
    return n;
  }
  function pressPic() {
    var it = S && S.items[S.i], Z = window.Zoom;
    if (!it || !it.img || !Z) { return; }
    var z = Z.big();
    if (z && z.node === refs.pic) { fullOpen(); return; }
    var box = refs.picbox;
    Z.twice({ node: refs.pic, img: refs.img, lift: root, label: labelNode,
              base: function () { return box.isConnected ? box.getBoundingClientRect() : null; } });
  }
  function fullOpen() {
    var it = S && S.items[S.i];
    if (!it || !window.Zoom) { return; }
    Zoom.open({ src: refs.img.currentSrc || it.img, alt: refs.img.alt,
                big: [it.big && it.big.replace(/\/larger\.jpg$/, "/normalized.jpg"), it.big].filter(Boolean),
                label: labelNode });
  }
  // Out of the way: the place closed, or a path moving on.
  function setFull(on) {
    if (on || !window.Zoom) { return; }
    var z = Zoom.big();
    if (z && refs.pic && z.node === refs.pic) { z.undo(true); }
    if (Zoom.on() && root) { Zoom.close(true); }
  }
  function zoomed() { var Z = window.Zoom; return !!(Z && (Z.on() || (Z.big() && refs.pic && Z.big().node === refs.pic))); }

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
    var ids = s.items.slice(0, s.own).filter(function (it) { return it.saved && it.id; }).slice(0, 13).map(function (it) { return it.id; });
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
    // The slow clock: a work is held 17 s of stillness; nothing moves under reduced motion, nor while it fills the screen.
    if (!still && S.items.length > 1 && !document.hidden && !zoomed() && now - lastMove > STILL_MS) {
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
    var top = refs.head.offsetTop + refs.head.offsetHeight + (phone ? 2 : 10);
    if (c._top !== top) { c._top = top; c.style.top = top + "px"; c.style.height = "calc(100% - " + top + "px)"; }
    var w = Math.max(1, Math.ceil(c.clientWidth / PIX)), h = Math.max(1, Math.ceil(c.clientHeight / PIX));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    // It rises out of the ground the first time, a row at a time; after, it stands at its year.
    var shown = S.when;
    var f = window.Models.draw(c, S.dots, S.heading, rising ? Math.min(shown, (now - S.at) / 1600) : shown, 0.9);
    var g = c.getContext("2d");
    var n = S.dots.span;
    // The sites of the period's outings: a line of sea-green tiles from the place to each
    // (another artist's only while it is the work in view).
    var it = S.items[S.i];
    if (S.place && S.items) {
      var cell = (SIDE[S.place.precision] || 2400) / n;
      var o = Models.project(f, 0, 0, S.centre);
      S.items.forEach(function (x) {
        if (x.kind !== "site" || !x.ll || (x.other && x !== it)) { return; }
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
    // The place itself: a lit 13 px tile at its point, its caption beside it (on a phone, at the clod's foot).
    var at = Models.project(f, 0, 0, S.centre);
    var x = at.x * PIX, y = at.y * PIX + top;
    refs.tile.style.transform = "translate(" + Math.round(x - 6.5) + "px," + Math.round(y - 6.5) + "px)";
    refs.tile.dataset.on = "true";
    var lw = refs.label.offsetWidth, sw = phone ? c.clientWidth : refs.stage.clientWidth;
    var lx, ly;
    if (phone) {
      lx = 8;
      ly = st.clientHeight - refs.label.offsetHeight - 4;
    } else {
      lx = x + 14 + lw > sw - 8 ? Math.max(8, x - 14 - lw) : x + 14;
      ly = Math.max(top, Math.min(st.clientHeight - refs.label.offsetHeight - 4, y - 8));
    }
    refs.label.style.transform = "translate(" + Math.round(lx) + "px," + Math.round(ly) + "px)";
    // The work's site off the clod: how far, which way.
    var off = refs.stage.querySelector(".pt-off");
    if (it && it.mark && it.mark.off && it.kind === "site") {
      if (!off) { off = el("span", "pt-off"); refs.stage.appendChild(off); }
      off.textContent = kmText(it.mark.dist) + " " + it.mark.dir + " · " + (it.how.split(" · ")[1] || "the site");
      off.style.transform = "translate(" + Math.round(Math.min(sw - 140, Math.max(8, it.mark.x - 40))) + "px," + Math.round(Math.min(st.clientHeight - 18, it.mark.y + 8)) + "px)";
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
      works: S.items.slice(0, S.own).filter(function (it) { return it.saved && it.id; }).map(function (it) { return { id: it.id, how: it.how, y: it.y }; }),
      here: (S.assoc.here || []).map(function (o) { return { name: o.name, sub: "here " + yspan(o.y0, o.y1) + " · " + o.how }; })
    };
  }

  window.PlaceThen = {
    open: open,
    // The dial as the hub (dialhub.js): which place is up, its works as marks, one brought up.
    key: function () { return S ? S.L.id + ":" + S.k + ":" + S.items.length : ""; },
    marks: function () {
      return S ? S.items.map(function (it, i) {
        return { i: i, y: it.y, site: it.kind === "site",
                 label: (it.other ? surname(it.by) + " · " : "") + (it.t || "Untitled") + (it.y ? ", " + it.y : "") + " · " + it.how };
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
               items: S.items.length, own: S.own, i: S.i, work: it ? it.t + (it.y ? ", " + it.y : "") : null, how: it ? it.how : null,
               other: it && it.other ? it.by : null, count: refs.count ? refs.count.textContent : "", tag: refs.tag && !refs.tag.hidden ? refs.tag.textContent : "",
               list: S.items.map(function (x) { return (x.other ? surname(x.by) + ": " : "") + (x.t || "Untitled") + (x.y ? ", " + x.y : "") + (x.saved ? "" : " (not saved)"); }),
               full: window.Zoom ? Zoom._state() : null, doors: refs.doors ? [].map.call(refs.doors.querySelectorAll(".pt-door"), function (b) { return b.textContent; }) : [],
               title: refs.title ? refs.title.textContent : "", where: refs.where ? refs.where.textContent : "",
               note: refs.note ? refs.note.textContent : "", label: refs.label ? refs.label.textContent : "",
               dial: window.Land && Land.dial ? (Land.dial() || {}).year : null };
    }
  };
})();

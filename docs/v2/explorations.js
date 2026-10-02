/* The explorations — the hunts, a viewer's own, and the relay.

   The artist, 1 Oct 2026, on the idea "the catalogue writers are their own
   kind of explorer. Wildenstein spent decades finding every Monet.
   Following him is following the hunt itself, a map of where Monets were
   found": "Implement your idea, that is a great example of a
   pre-established exploration adventure for viewers to take. Branching off
   of that idea, there should be a way for a viewer to create their own
   explorations and save them and share them with others." And on the
   relay, the same day: "that's great to connect one exploration with
   another, building a relay system as one ends and another begins
   relative to a time, place, artwork, character, etc…"

   The hunts (explorations.json, scripts/build_explorations.py): a
   cataloguer's works of one artist, in catalogue order, each stop the city
   the work was in when the catalogue was made (where the record says;
   else where it is now, and it says so). Played: the journey to that city,
   the catalogue's number said; the work large; then who it was found with,
   and where it is now, on the reading's clock.

   A viewer's own. Anywhere there is something to keep — a work, a city, a
   museum, a thread, a voice or an animal being followed — one quiet "+" at
   the top right adds it to the exploration being made. A small tray holds
   it: its stops as squares and words, reordered by dragging, removed with
   ×, its title editable in place, its sentence written as a walk's is.
   Kept in this browser (localStorage); played with the walks' grammar (the
   journey between stops, the work large, its history's lines on the
   reading's clock that moves only while the pointer is still; any press
   pauses, "Resume" goes on; up to the world ends it).

   Shared without a link. "Share" gives a code (ex·…, Crockford base 32 in
   fours): version, a check, the title if one was written, and each stop as
   a kind and an index into the public lists (finding.json's works and
   threads, cities.json's towns, museums.json, voices.json, the cast, the
   relay's published explorations). Typed or pasted into Find on any
   device, it plays, titled. A code a visitor sends the artist becomes a
   published exploration through a session (EXPLORATIONS.md).

   The relay. When any exploration ends — a hunt, a walk, a voice's route,
   a viewer's own — the explorations that begin where it ended are offered,
   two or three, strongest first, each with its reason: the same work, the
   same city (then museum), the same time (within five years), the same
   artist or animal, the same voice. One that passes through there is
   offered to be joined mid-way ("joins Wildenstein's hunt at stop 12 of
   45"). Never chained silently: the viewer chooses. Taken, the chain is
   recorded — an exploration of its own, its sentence carried across the
   joins, kept and shared as one code, and drawn on the globe, each leg in
   its own tone. One link: nothing here changes the address. */
(function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var STILL_MS = 1500;
  var LOOK = 17000 * PHI;              // a work's calm default look (the walks')
  var SAY_AT = [4000, 11000, 20000];   // a work's title, then its lines
  var ARRIVE_MS = 7000;                // a hunt: in the city where it was found, before the work
  var TOWN_MS = 13000;                 // a city stop
  var HOLD_MS = 21000;                 // a museum, a thread, a voice, an animal
  var WAIT_MS = 30000;
  var B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var TITLE_ABC = " abcdefghijklmnopqrstuvwxyz'-.&·";
  var KINDS = ["w", "t", "m", "v", "h", "a", "r", "|"];
  var STORE = "explorations.kept", DRAFT = "explorations.draft";
  var TONES = ["#9d95e6", "#eadfcd", "#8fc7bd", "#d9a55b", "#c98fb5"];
  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PACE = 1;

  var D = null, reading = null, walksData = null;
  var movedAt = 0;

  /* ---- small things ------------------------------------------------------ */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function button(text, cls, fn) {
    var b = el("button", "walk-act " + (cls || ""), text);
    b.type = "button";
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); fn(event); });
    return b;
  }

  function get(path) {
    return fetch(path).then(function (r) { if (!r.ok) { throw new Error(path); } return r.json(); });
  }

  function fold(t) {
    return String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function surname(name) {
    var w = String(name || "").split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function yearOf(v) { var m = /(\d{4})/.exec(String(v || "")); return m ? +m[1] : 0; }

  function store(key, v) {
    try { if (v === null) { localStorage.removeItem(key); } else { localStorage.setItem(key, JSON.stringify(v)); } } catch (e) { /* this visit only */ }
  }
  function stored(key, dflt) {
    try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : dflt; } catch (e) { return dflt; }
  }

  /* ---- reading the files --------------------------------------------------- */

  function load() {
    if (reading) { return reading; }
    var cast = window.Characters && Characters.cast ? Characters.cast().catch(function () { return null; }) : Promise.resolve(null);
    reading = Promise.all([get("explorations.json"), get("finding.json"), get("cities.json"),
                           get("museums.json"), get("voices.json"), cast,
                           get("characters/walks.json").catch(function () { return { walks: [] }; })])
      .then(function (g) {
        var d = { ex: g[0], works: g[1].w, threads: g[1].t, towns: g[2].towns, museums: g[3].museums,
                  voices: g[4].voices, cast: g[5] || [], walks: g[6].walks || [] };
        function ix(list, f) { var o = {}; list.forEach(function (x, i) { o[f(x)] = i; }); return o; }
        d.workIx = ix(d.works, function (w) { return w[0]; });
        d.threadIx = ix(d.threads, function (t) { return t[0]; });
        d.townIx = ix(d.towns, function (t) { return t[0]; });
        d.museumIx = ix(d.museums, function (m) { return m.slug; });
        d.voiceIx = ix(d.voices, function (v) { return v[0]; });
        d.castIx = ix(d.cast, function (c) { return c.id; });
        d.relay = d.ex.relay || [];
        d.relayIx = ix(d.relay, function (r) { return r[0] + ":" + r[1]; });
        d.huntBy = ix(d.ex.hunts, function (h) { return h.id; });
        d.walkBy = ix(d.walks, function (w) { return w.id; });
        d.siteBy = ix(d.ex.sites || [], function (x) { return x.id; });
        d.museumTown = {};
        d.towns.forEach(function (t) { (t[6] || []).forEach(function (slug) { d.museumTown[slug] = t[0]; }); });
        D = d;
        return d;
      }).catch(function () { reading = null; return null; });
    return reading;
  }

  function hunt(id) { var i = D.huntBy[id]; return i === undefined ? null : D.ex.hunts[i]; }
  function siteX(id) { var i = D.siteBy[id]; return i === undefined ? null : D.ex.sites[i]; }
  function town(key) { var i = D.townIx[key]; return i === undefined ? null : D.towns[i]; }
  function townName(key) { var t = town(key); return t ? String(t[1]).split(",")[0] : key; }
  function workRow(id) { var i = D.workIx[id]; return i === undefined ? null : D.works[i]; }
  function museum(slug) { var i = D.museumIx[slug]; return i === undefined ? null : D.museums[i]; }
  function voiceRow(id) { var i = D.voiceIx[id]; return i === undefined ? null : D.voices[i]; }
  function threadRow(id) { var i = D.threadIx[id]; return i === undefined ? null : D.threads[i]; }
  function castRow(id) { var i = D.castIx[id]; return i === undefined ? null : D.cast[i]; }
  function relayRow(key) {
    var i = D.relayIx[key];
    if (i !== undefined) { return D.relay[i]; }
    // The studios (studios.js): an artist's studios not in the relay (a code's 9 bits name 511 rows)
    // are still played, from studios.json.
    // The movements (movements.js): kind "m", matched beside the index, never in it.
    if (/^m:/.test(key)) { return window.Movements && Movements.relayRow ? Movements.relayRow(key.slice(2)) : null; }
    var ox = /^o:/.test(key) && studioX(key.slice(2));
    return ox ? ["o", ox.id, ox.title, ox.artist, "", "", ox.n, ox.stops.map(function (st) { return [st.key, st.y || 0, -1]; })] : null;
  }
  function studioX(id) { return window.Studios && Studios.exploration ? Studios.exploration(id) : null; }

  function rowTitle(r) {
    if (!r) { return "an exploration"; }
    return r[0] === "v" ? r[2] + "’s route" : r[2];
  }

  /* ---- a stop's name, picture and word -------------------------------------- */

  function shortTitle(t) {
    var s = String(t || "Untitled").split(/[,:(]/)[0].trim();
    var w = s.split(" ");
    return w.length > 4 ? w.slice(0, 4).join(" ") + "…" : s;
  }

  function label(s) {
    var r;
    switch (s.k) {
      case "w": r = workRow(s.id); return r ? r[1] + " — " + r[2] : "A work";
      case "t": return town(s.id) ? town(s.id)[1] : s.id;
      case "m": r = museum(s.id); return r ? r.name : s.id;
      case "v": r = voiceRow(s.id); return r ? r[1] : s.id;
      case "h": r = threadRow(s.id); return r ? r[2] : "A thread";
      case "a": r = castRow(s.id); return r ? r.name + " · after " + r.artist : s.id;
      case "r": return rowTitle(relayRow(s.id)) + (s.from ? " · from stop " + (s.from + 1) : "");
      default: return "";
    }
  }

  function kindWord(s) {
    return { w: "work", t: "city", m: "museum", v: "voice", h: "thread", a: "animal", r: "exploration" }[s.k] || "";
  }

  function picture(s) {
    if (s.k !== "w") { return null; }
    var r = workRow(s.id);
    return r && r[4] ? CDN + r[4] + "/square.jpg" : null;
  }

  // Each stop a word: its city where there is one, else its own short name.
  function words(s) {
    var r;
    switch (s.k) {
      case "w": return [{ w: s.key ? townName(s.key) : shortTitle((workRow(s.id) || [])[1]), p: "," }];
      case "t": return [{ w: townName(s.id), p: " —" }];
      case "m": r = museum(s.id); return [{ w: r ? r.name : s.id, p: "." }];
      case "v": r = voiceRow(s.id); return [{ w: r ? surname(r[1]) : s.id, p: "." }];
      case "h": r = threadRow(s.id); return [{ w: shortTitle(r ? r[2] : "a thread"), p: "." }];
      case "a": r = castRow(s.id); return [{ w: r ? r.name.split(" ").pop().toLowerCase() : s.id, p: "." }];
      case "r": return rowWords(relayRow(s.id), s.from || 0);
      default: return [];
    }
  }

  function rowWords(r, from) {
    if (!r) { return []; }
    if (r[0] === "w") {
      var w = D.walks[D.walkBy[r[1]]];
      if (w) {
        return w.stops.slice(from).map(function (st) { return { w: townName(st.key), p: st.works.length > 1 ? "." : st.works.length ? "," : " —" }; });
      }
    }
    if (r[0] === "h") {
      return r[7].slice(from).map(function (st) { return { w: townName(st[0]), p: "," }; });
    }
    if (r[0] === "v") {
      return [{ w: townName(r[7][0][0]), p: " …" }, { w: townName(r[7][r[7].length - 1][0]), p: "." }];
    }
    if (r[0] === "s") {
      var sx = siteX(r[1]);
      if (sx) { return sx.stops.slice(from).map(function (st) { return { w: shortTitle(st.w), p: st.s.length > 1 ? "." : "," }; }); }
    }
    if (r[0] === "o") {
      var ox = studioX(r[1]);
      if (ox) { return ox.stops.slice(from).map(function (st) { return { w: st.w, p: "," }; }); }
    }
    return r[7].slice(from).map(function (st) { return { w: st[0] ? townName(st[0]) : shortTitle((D.works[st[2]] || [])[1]), p: "," }; });
  }

  /* The sentence, as a walk's: each stop a word, a dash for a city passed
     through, a comma for a work, a full stop for a museum, a voice, a
     thread or an animal; the last word a full stop; a line ends at a full
     stop and holds five words; three stops are a tercet; a word said again
     is a refrain (italic). A relay's legs are its stanzas: each handoff
     begins a new one. Returns [stanza [line [word]]]. */
  function sentence(stops) {
    var legs = [[]];
    stops.forEach(function (s) { if (s.k === "|") { legs.push([]); } else { legs[legs.length - 1] = legs[legs.length - 1].concat(words(s)); } });
    var seen = {};
    return legs.filter(function (l) { return l.length; }).map(function (ws) {
      var n = ws.length, lines = [], cur = [];
      ws.forEach(function (x, i) {
        var p = i === n - 1 ? (x.p === " —" ? " —" : ".") : x.p;
        var word = { w: x.w, p: p, refrain: !!seen[x.w] };
        seen[x.w] = true;
        cur.push(word);
        if (n === 3 || p === "." || (cur.length >= 5 && p)) { lines.push(cur); cur = []; }
      });
      if (cur.length) { lines.push(cur); }
      return lines;
    });
  }

  function sentenceText(stanzas) {
    return stanzas.map(function (lines) {
      return lines.map(function (l) { return l.map(function (x) { return x.w + x.p; }).join(" "); }).join(" / ");
    }).join("\n");
  }

  function sentenceEl(stanzas, max) {
    var box = el("div", "walk-sentence explore-sentence");
    var shown = 0;
    stanzas.forEach(function (lines, si) {
      lines.forEach(function (l, li) {
        if (max && shown >= max) { return; }
        shown += 1;
        var line = el("p", "walk-line");
        if (si && !li) { line.dataset.handoff = "true"; line.style.setProperty("--tone", TONES[si % TONES.length]); }
        l.forEach(function (x, k) {
          line.appendChild(el(x.refrain ? "em" : "span", "walk-word", x.w));
          if (x.p) { line.appendChild(document.createTextNode(x.p)); }
          if (k < l.length - 1) { line.appendChild(document.createTextNode(" ")); }
        });
        box.appendChild(line);
      });
    });
    if (max && stanzas.reduce(function (a, l) { return a + l.length; }, 0) > max) {
      box.lastChild.appendChild(document.createTextNode(" …"));
    }
    return box;
  }

  function autoTitle(x) {
    var real = x.stops.filter(function (s) { return s.k !== "|"; });
    var legs = x.stops.filter(function (s) { return s.k === "|"; }).length;
    if (legs) {
      var heads = [real[0]];
      x.stops.forEach(function (s, i) { if (s.k === "|" && x.stops[i + 1]) { heads.push(x.stops[i + 1]); } });
      return heads.map(function (s) { return s.k === "r" ? rowTitle(relayRow(s.id)).split(" · ")[0] : (words(s)[0] || {}).w; }).join(" → ");
    }
    if (!real.length) { return "An exploration"; }
    var a = (words(real[0])[0] || {}).w, b = (words(real[real.length - 1])[0] || {}).w;
    return (real.length === 1 || a === b ? a : a + " to " + b) + " · " + plural(real.length, "stop", "stops");
  }

  /* ---- the code ------------------------------------------------------------ */

  function bitsFor(n) { return Math.max(1, Math.ceil(Math.log(Math.max(2, n)) / Math.LN2)); }

  function listFor(k) {
    return { w: D.works.length, t: D.towns.length, m: D.museums.length, v: D.voices.length, h: D.threads.length,
             a: Math.max(1, D.cast.length), r: D.relay.length, "|": 1 }[k];
  }

  function indexOf(s) {
    switch (s.k) {
      case "w": return D.workIx[s.id];
      case "t": return D.townIx[s.id];
      case "m": return D.museumIx[s.id];
      case "v": return D.voiceIx[s.id];
      case "h": return D.threadIx[s.id];
      case "a": return D.castIx[s.id];
      case "r": return D.relayIx[s.id];
      default: return 0;
    }
  }

  function idAt(k, i) {
    switch (k) {
      case "w": return (D.works[i] || [])[0];
      case "t": return (D.towns[i] || [])[0];
      case "m": return (D.museums[i] || {}).slug;
      case "v": return (D.voices[i] || [])[0];
      case "h": return (D.threads[i] || [])[0];
      case "a": return (D.cast[i] || {}).id;
      case "r": return D.relay[i] ? D.relay[i][0] + ":" + D.relay[i][1] : undefined;
      default: return "";
    }
  }

  function check(stops) {
    var s = stops.map(function (x) { return x.k + ":" + (x.id || "") + (x.k === "r" ? ":" + (x.from || 0) : ""); }).join("|");
    var h = 2166136261;
    for (var i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h & 31;
  }

  function titleChars(t) {
    return fold(String(t).replace(/[’‘]/g, "'")).split("").map(function (c) { return TITLE_ABC.indexOf(c); })
      .filter(function (i) { return i >= 0; }).slice(0, 31);
  }

  function encode(x) {
    var stops = x.stops.filter(function (s) { return s.k === "|" || indexOf(s) !== undefined; }).slice(0, 63);
    if (!stops.length) { return null; }
    var bits = [];
    function put(v, n) { for (var k = n - 1; k >= 0; k -= 1) { bits.push((v >> k) & 1); } }
    put(1, 2);
    put(check(stops), 5);
    var tc = x.titled ? titleChars(x.title) : [];
    put(tc.length ? 1 : 0, 1);
    if (tc.length) { put(tc.length, 5); tc.forEach(function (c) { put(c, 5); }); }
    put(stops.length, 6);
    stops.forEach(function (s) {
      put(KINDS.indexOf(s.k), 3);
      if (s.k === "|") { return; }
      put(indexOf(s), bitsFor(listFor(s.k)));
      if (s.k === "r") { put(Math.min(63, s.from || 0), 6); }
    });
    while (bits.length % 5) { bits.push(0); }
    var out = "";
    for (var b = 0; b < bits.length; b += 5) {
      out += B32.charAt(bits[b] * 16 + bits[b + 1] * 8 + bits[b + 2] * 4 + bits[b + 3] * 2 + bits[b + 4]);
    }
    return "ex·" + out.match(/.{1,4}/g).join("-");
  }

  function parse(text) {
    var m = /^\s*ex\s*[·.\-:\s/]+\s*([0-9a-z][0-9a-z\-\s]{2,})\s*$/i.exec(String(text || ""));
    return m && m[1].toUpperCase().replace(/[\s\-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  }

  function decode(text) {
    var body = parse(text);
    if (!body || !D) { return null; }
    var bits = [];
    for (var i = 0; i < body.length; i += 1) {
      var v = B32.indexOf(body.charAt(i));
      if (v < 0) { return null; }
      for (var k = 4; k >= 0; k -= 1) { bits.push((v >> k) & 1); }
    }
    var at = 0, bad = false;
    function take(n) {
      if (at + n > bits.length) { bad = true; return 0; }
      var v = 0;
      for (var k = 0; k < n; k += 1) { v = v * 2 + bits[at + k]; }
      at += n;
      return v;
    }
    if (take(2) !== 1) { return null; }
    var sum = take(5), title = "";
    if (take(1)) {
      var nc = take(5);
      for (var c = 0; c < nc; c += 1) { title += TITLE_ABC.charAt(take(5)); }
      // Letters travel in one case: each word but the small ones is given its capital back.
      title = title.split(" ").map(function (w, i) {
        return i && /^(of|the|and|by|in|to|a|at|on|for|from|with|de|la|le|van|von)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
      }).join(" ");
    }
    var n = take(6), stops = [];
    for (var s = 0; s < n && !bad; s += 1) {
      var kind = KINDS[take(3)];
      if (kind === "|") { stops.push({ k: "|" }); continue; }
      var id = idAt(kind, take(bitsFor(listFor(kind))));
      var st = { k: kind, id: id };
      if (kind === "r") { st.from = take(6); }
      if (id === undefined) { bad = true; }
      stops.push(st);
    }
    if (bad || !stops.length || bits.length - at >= 5) { return null; }
    var x = { id: "code-" + body, kind: stops.some(function (q) { return q.k === "|"; }) ? "relay" : "made",
              title: title, titled: !!title, by: "a visitor", stops: stops };
    if (!x.title) { x.title = autoTitle(x); }
    x.code = "ex·" + body.match(/.{1,4}/g).join("-");
    x.stale = check(stops) !== sum;
    return x;
  }

  /* ---- the draft: the exploration being made -------------------------------- */

  var draft = stored(DRAFT, null) || { id: null, title: "", titled: false, stops: [] };

  function saveDraft() { store(DRAFT, draft.stops.length || draft.title ? draft : null); }

  function kept() { var k = stored(STORE, []); return Array.isArray(k) ? k : []; }
  function keepIt(x) {
    var list = kept().filter(function (k) { return k.id !== x.id; });
    list.push(x);
    store(STORE, list.slice(-34));
  }

  function same(a, b) { return a && b && a.k === b.k && a.id === b.id && (a.from || 0) === (b.from || 0); }

  function add(s) {
    if (!s) { return; }
    if (same(draft.stops[draft.stops.length - 1], s)) { return; }
    draft.stops.push(s);
    if (!draft.id) { draft.id = "x" + Date.now().toString(36); }
    saveDraft();
    renderDock(true);
    if (tray && !tray.hidden) { renderTray(); }
  }

  /* What is here to add: the view first, then what is being followed. */
  function here() {
    if (!window.Land || !Land.where) { return []; }
    var w = Land.where(), f = Land.following(), out = [];
    if (w.flying || w.at === "world" || w.at === "flying") { return out; }
    if (w.at === "work" && w.work) { out.push({ k: "w", id: w.work, key: w.key || undefined }); }
    else if (w.at === "thread" && w.id) { out.push({ k: "h", id: w.id }); }
    else if (w.at === "museum" && w.museum) { out.push({ k: "m", id: w.museum }); }
    else if (w.at === "town" && w.key) { out.push({ k: "t", id: w.key }); }
    if (f && f.voice) { out.push({ k: "v", id: f.voice }); }
    else if (f && f.cast) { out.push({ k: "a", id: f.cast }); }
    return out;
  }

  /* ---- the dock: "+" and the tray's chip ------------------------------------ */

  var dock = null, plus = null, chip = null, menu = null, tray = null;

  function shield(node) {
    ["pointerdown", "wheel", "keydown", "touchstart"].forEach(function (t) {
      node.addEventListener(t, function (event) { event.stopPropagation(); }, { passive: t === "wheel" || t === "touchstart" });
    });
  }

  function setUpDock() {
    if (dock) { return; }
    dock = el("div", "explore-dock");
    plus = el("button", "explore-add", "+");
    plus.type = "button";
    plus.hidden = true;
    plus.addEventListener("click", function (event) {
      event.stopPropagation();
      if (!D) { return; }
      var can = here();
      if (can.length === 1) { add(can[0]); flash(can[0]); return; }
      if (can.length > 1) { openMenu(can); }
    });
    chip = el("button", "explore-chip");
    chip.type = "button";
    chip.hidden = true;
    chip.addEventListener("click", function (event) {
      event.stopPropagation();
      if (tray && !tray.hidden) { tray.hidden = true; chip.setAttribute("aria-expanded", "false"); return; }
      openTray();
    });
    menu = el("div", "explore-menu");
    menu.hidden = true;
    dock.appendChild(plus);
    dock.appendChild(chip);
    dock.appendChild(menu);
    shield(dock);
    document.body.appendChild(dock);
  }

  function flash(s) {
    plus.dataset.added = "true";
    plus.textContent = "✓";
    plus.setAttribute("aria-label", "Added " + label(s));
    window.setTimeout(function () { delete plus.dataset.added; plus.textContent = "+"; renderDock(); }, 1400);
  }

  function openMenu(can) {
    menu.textContent = "";
    menu.appendChild(el("p", "explore-menu-head", "Add to the exploration"));
    can.forEach(function (s) {
      menu.appendChild(button(label(s) + " · " + kindWord(s), "explore-menu-row", function () {
        menu.hidden = true;
        add(s);
        flash(s);
      }));
    });
    menu.hidden = false;
  }

  function renderDock(pulse) {
    setUpDock();
    var can = D ? here() : [];
    var playing = !!run;
    plus.hidden = !can.length || playing;
    if (!plus.dataset.added) {
      plus.setAttribute("aria-label", can.length ? "Add " + (can.length > 1 ? "this" : label(can[0])) + " to an exploration" : "Add to an exploration");
      plus.title = plus.getAttribute("aria-label");
    }
    if (!can.length) { menu.hidden = true; }
    var n = draft.stops.filter(function (s) { return s.k !== "|"; }).length;
    // On a phone the strip of a playing exploration has the top: the chip waits.
    chip.hidden = !n || (playing && window.innerWidth <= 720);
    chip.textContent = "Exploration · " + n;
    chip.setAttribute("aria-label", "Your exploration, " + plural(n, "stop", "stops") + " — open");
    if (pulse) { chip.dataset.pulse = ""; window.requestAnimationFrame(function () { chip.dataset.pulse = "true"; }); }
  }

  /* ---- the tray ------------------------------------------------------------- */

  function openTray() {
    if (!tray) {
      tray = el("section", "explore-tray");
      tray.setAttribute("aria-label", "Your exploration");
      shield(tray);
      document.body.appendChild(tray);
    }
    renderTray();
    tray.hidden = false;
    chip.setAttribute("aria-expanded", "true");
  }

  function renderTray() {
    if (!tray || !D) { return; }
    tray.textContent = "";
    var title = el("input", "walk-title explore-title");
    title.type = "text";
    title.spellcheck = false;
    title.value = draft.titled ? draft.title : autoTitle(draft);
    title.setAttribute("aria-label", "The exploration's title");
    title.addEventListener("input", function () {
      draft.title = title.value.trim();
      draft.titled = !!draft.title;
      saveDraft();
      code.textContent = "";
    });
    tray.appendChild(title);
    var list = el("ol", "explore-stops");
    draft.stops.forEach(function (s, i) {
      var li = el("li", "explore-stop" + (s.k === "|" ? " explore-join" : ""));
      li.dataset.i = i;
      var grip = el("span", "explore-grip");
      grip.setAttribute("aria-hidden", "true");
      var src = picture(s);
      if (src) {
        var img = el("img", "explore-sq");
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        img.src = src;
        grip.appendChild(img);
      } else {
        grip.appendChild(el("span", "explore-sq explore-sq-word", s.k === "|" ? "→" : kindWord(s).charAt(0)));
      }
      li.appendChild(grip);
      var t = el("span", "explore-stop-name", s.k === "|" ? "handoff" : label(s));
      li.appendChild(t);
      if (s.k !== "|") { li.appendChild(el("span", "explore-stop-kind", kindWord(s))); }
      var x = button("×", "walk-x explore-x", function () {
        draft.stops.splice(i, 1);
        saveDraft();
        renderTray();
        renderDock();
      });
      x.setAttribute("aria-label", "Remove " + (s.k === "|" ? "the handoff" : label(s)));
      li.appendChild(x);
      // Up and down by keyboard, as dragging does by hand.
      li.tabIndex = 0;
      li.addEventListener("keydown", function (event) {
        var d = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        if (!d || i + d < 0 || i + d >= draft.stops.length) { return; }
        event.preventDefault();
        move(i, i + d);
        var again = tray.querySelector('.explore-stop[data-i="' + (i + d) + '"]');
        if (again) { again.focus(); }
      });
      drag(li, grip, i, list);
      list.appendChild(li);
    });
    tray.appendChild(list);
    if (draft.stops.length) { tray.appendChild(sentenceEl(sentence(draft.stops))); }
    var acts = el("div", "walk-acts explore-acts");
    var code = el("span", "walk-code explore-code");
    if (draft.stops.length) {
      acts.appendChild(button("Play", "explore-play", function () { tray.hidden = true; play(asExploration(draft)); }));
      acts.appendChild(button("Keep", "", function (event) {
        var x = asExploration(draft);
        x.code = encode(x);
        keepIt(x);
        event.target.textContent = "Kept";
      }));
      acts.appendChild(button("Share", "", function () {
        var c = encode(asExploration(draft));
        code.textContent = c || "";
        copy(c, code);
      }));
      acts.appendChild(button("New", "", function () {
        draft = { id: null, title: "", titled: false, stops: [] };
        saveDraft();
        renderTray();
        renderDock();
      }));
    }
    acts.appendChild(button("×", "walk-x", function () { tray.hidden = true; chip.setAttribute("aria-expanded", "false"); }));
    tray.appendChild(acts);
    tray.appendChild(code);
    if (!draft.stops.length) {
      tray.appendChild(el("p", "walk-said explore-hint", "Press + on a work, a city, a museum, a thread, or while following a voice or an animal."));
    }
    var mine = kept().slice().reverse();
    if (mine.length) {
      tray.appendChild(el("p", "walk-progress explore-kept-head", "Kept · " + mine.length));
      mine.slice(0, 8).forEach(function (x) {
        var row = el("div", "explore-kept-row");
        row.appendChild(button(x.title, "explore-kept-play", function () { tray.hidden = true; play(x); }));
        row.appendChild(button("Edit", "", function () {
          draft = { id: x.id, title: x.titled ? x.title : "", titled: !!x.titled, stops: x.stops.slice() };
          saveDraft();
          renderTray();
          renderDock();
        }));
        tray.appendChild(row);
      });
    }
  }

  function asExploration(dr) {
    var x = { id: dr.id || "x" + Date.now().toString(36), kind: dr.stops.some(function (s) { return s.k === "|"; }) ? "relay" : "made",
              title: dr.titled && dr.title ? dr.title : autoTitle(dr), titled: !!(dr.titled && dr.title), by: "you",
              stops: dr.stops.slice() };
    return x;
  }

  function move(from, to) {
    var s = draft.stops.splice(from, 1)[0];
    draft.stops.splice(to, 0, s);
    saveDraft();
    renderTray();
  }

  /* Dragging a stop by its square: it follows the finger, the others make
     room, and it is set down where it is let go. */
  function drag(li, grip, i, list) {
    grip.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var rows = Array.prototype.slice.call(list.children);
      var tops = rows.map(function (r) { var b = r.getBoundingClientRect(); return b.top + b.height / 2; });
      var y0 = event.clientY, to = i;
      li.dataset.dragging = "true";
      try { grip.setPointerCapture(event.pointerId); } catch (e) { /* fine */ }
      function onMove(ev) {
        var dy = ev.clientY - y0;
        li.style.transform = "translateY(" + dy + "px)";
        var y = tops[i] + dy;
        to = 0;
        tops.forEach(function (t, k) { if (k !== i && y > t) { to += 1; } });
        rows.forEach(function (r, k) {
          if (k === i) { return; }
          var shift = (k > i && k <= to) ? -1 : (k < i && k >= to) ? 1 : 0;
          r.style.transform = shift ? "translateY(" + (shift * li.offsetHeight) + "px)" : "";
        });
      }
      function onUp() {
        grip.removeEventListener("pointermove", onMove);
        grip.removeEventListener("pointerup", onUp);
        grip.removeEventListener("pointercancel", onUp);
        delete li.dataset.dragging;
        rows.forEach(function (r) { r.style.transform = ""; });
        if (to !== i) { move(i, to); }
      }
      grip.addEventListener("pointermove", onMove);
      grip.addEventListener("pointerup", onUp);
      grip.addEventListener("pointercancel", onUp);
    });
  }

  function copy(text, node) {
    if (!text) { return; }
    try {
      navigator.clipboard.writeText(text).then(function () { node.dataset.copied = "true"; }, function () {});
    } catch (e) { /* the code can be selected by hand */ }
    try {
      var r = document.createRange();
      r.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (e) { /* fine */ }
  }

  /* ---- playing ---------------------------------------------------------------

     An exploration is played as steps: a published one referred to by a
     relay stop is opened into its own (a hunt's works, a voice's places, a
     walk handed to walks.js, which plays it with its animal). */

  var run = null;
  var strip = null, sP = null, sSaid = null, sActs = null, sLines = null, hideTimer = 0;

  function setUpStrip() {
    if (strip) { return; }
    strip = el("section", "walk-strip explore-strip");
    strip.hidden = true;
    strip.setAttribute("aria-label", "The exploration");
    sP = el("p", "walk-progress");
    sLines = el("div", "walk-lines");
    sSaid = el("p", "walk-said");
    sSaid.setAttribute("aria-live", "polite");
    sActs = el("div", "walk-acts");
    strip.appendChild(sP);
    strip.appendChild(sLines);
    strip.appendChild(sSaid);
    strip.appendChild(sActs);
    shield(strip);
    document.body.appendChild(strip);
  }

  function show(progress, said, acts, forMs) {
    setUpStrip();
    window.clearTimeout(hideTimer);
    sP.textContent = progress || "";
    if (said !== undefined) { setSaid(said); }
    sActs.textContent = "";
    (acts || []).forEach(function (a) { if (a) { sActs.appendChild(a); } });
    strip.hidden = false;
    if (forMs) { hideTimer = window.setTimeout(function () { strip.hidden = true; }, forMs); }
  }

  function setSaid(text) {
    sSaid.dataset.on = "";
    sSaid.textContent = text || "";
    if (text) { window.requestAnimationFrame(function () { sSaid.dataset.on = "true"; }); }
  }

  function setLines(stops, max, whole) {
    setUpStrip();
    sLines.textContent = "";
    if (!stops || !stops.length) { return; }
    var e = sentenceEl(sentence(stops), max);
    if (whole) { e.classList.add("walk-sentence-whole"); }
    sLines.appendChild(e);
  }

  function expand(stops) {
    var out = [];
    var chain = Promise.resolve();
    var leg = 0;
    stops.forEach(function (s) {
      chain = chain.then(function () {
        if (s.k === "|") { leg += 1; out.push({ k: "|", leg: leg }); return; }
        if (s.k !== "r") { out.push({ k: s.k, id: s.id, key: s.key, leg: leg }); return; }
        // A movement (movements.js): its walk, each stop the movement's view at that year.
        if (/^m:/.test(s.id)) {
          var lm = leg;
          return (window.Movements ? Movements.steps(s.id.slice(2), s.from || 0) : Promise.resolve([])).then(function (got) {
            got.forEach(function (g) { g.leg = lm; out.push(g); });
          });
        }
        // A life (lives.js): each of its places a stop.
        if (/^l:/.test(s.id)) {
          var ll_ = leg;
          return (window.Lives ? Lives.steps(s.id.slice(2)) : Promise.resolve([])).then(function (got) {
            got.slice(s.from || 0).forEach(function (g) { g.leg = ll_; out.push(g); });
          });
        }
        var r = relayRow(s.id), from = s.from || 0;
        if (!r) { return; }
        if (r[0] === "h") {
          var h = hunt(r[1]);
          h.stops.slice(from).forEach(function (st, i) {
            out.push({ k: "w", id: st.w, key: st.key, lines: st.lines, y: st.y, hunt: h, n: from + i, of: h.stops.length, leg: leg });
          });
          return;
        }
        if (r[0] === "s") {
          var sx = siteX(r[1]);
          if (sx) {
            sx.stops.slice(from).forEach(function (st, i) {
              out.push({ k: "site", key: st.key, ll: st.ll, y: st.y, ids: st.s, word: st.w, sx: sx, n: from + i, of: sx.stops.length, leg: leg });
            });
          }
          return;
        }
        // The studios (studios.js): each of the artist's places, its studio column open.
        if (r[0] === "o") {
          var lg = leg;
          return (window.Studios ? Studios.load() : Promise.resolve()).then(function () {
            var ox = studioX(r[1]);
            if (!ox) { return; }
            ox.stops.slice(from).forEach(function (st, i) {
              out.push({ k: "studio", key: st.key, ll: st.ll, y: st.y, ids: st.o, word: st.w, ox: ox, n: from + i, of: ox.stops.length, leg: lg });
            });
          });
        }
        if (r[0] === "w") {
          var w = D.walks[D.walkBy[r[1]]];
          if (w) { out.push({ k: "walk", walk: w, from: from, leg: leg }); }
          return;
        }
        if (r[0] === "x") {
          var x = D.ex.made.filter(function (m) { return m.id === r[1]; })[0];
          var sub = (x ? x.stops : []).slice(from).map(function (st) { return { k: st[0], id: st[1], from: st[2] || 0 }; });
          return expand(sub).then(function (got) {
            got.forEach(function (g) { if (g.k !== "|") { g.leg = leg; out.push(g); } });
          });
        }
        if (r[0] === "v") {
          return get("voices/" + r[1] + ".json").then(function (v) {
            out.push({ k: "v", id: r[1], leg: leg });
            v.places.slice(from).forEach(function (p, i) {
              out.push({ k: "t", id: p[0], y: p[8], voice: r[1], n: from + i, of: v.places.length, leg: leg });
            });
          }, function () {});
        }
      });
    });
    return chain.then(function () { return out; });
  }

  function play(x, opts) {
    if (!x || !x.stops || !x.stops.length) { return; }
    opts = opts || {};
    load().then(function () {
      if (!D || !window.Land || !Land.where) { return; }
      return expand(x.stops).then(function (steps) {
        if (!steps.length) { return; }
        if (run) { stopRun(); }
        if (window.Walks && Walks.walking && Walks.walking()) { /* a walk under way is left to end itself */ }
        run = { x: x, steps: steps, i: -1, timers: [], paused: false, down: false, rep: opts.rep || repOf(x) };
        legsFor(run.rep);
        setLines([], 0);
        show(x.title + (x.by ? " · by " + x.by : ""), "", acts());
        renderDock();
        next();
      });
    });
  }

  function stopRun() {
    if (!run) { return; }
    legsAt = performance.now();         // the chain's legs fade from when it stopped being played
    run.timers.forEach(function (t) { window.clearTimeout(t); });
    run = null;
  }

  function afterStill(fn, ms) {
    var token = run;
    if (!token) { return; }
    function tick() {
      if (run !== token || token.paused) { return; }
      var moved = performance.now() - movedAt;
      if (moved < STILL_MS) { token.timers.push(window.setTimeout(tick, STILL_MS - moved + 80)); return; }
      fn();
    }
    token.timers.push(window.setTimeout(tick, ms * PACE));
  }

  function waitFor(test, fn, ms) {
    var token = run, until = performance.now() + (ms || WAIT_MS);
    function tick() {
      if (run !== token || token.paused) { return; }
      var w = Land.where();
      if (!w.flying && test(w)) { fn(true); return; }
      if (performance.now() > until) { fn(false); return; }
      token.timers.push(window.setTimeout(tick, 250));
    }
    tick();
  }

  function step() { return run.steps[run.i]; }

  function progress() {
    var s = step(), n = run.steps.filter(function (q) { return q.k !== "|"; }).length;
    var k = run.steps.slice(0, run.i + 1).filter(function (q) { return q.k !== "|"; }).length;
    var where = s.k === "|" ? "handed on" : s.k === "walk" ? s.walk.title : s.k === "site" || s.k === "studio" ? s.word : s.k === "life" ? s.word + " · " + s.y : s.key ? townName(s.key) : s.k === "t" ? townName(s.id) : label(s).split(" — ")[0];
    var inHunt = s.hunt ? " · No. " + (s.hunt.stops[s.n].no || s.n + 1) : "";
    return (run.paused ? "Paused · " : "") + k + " of " + n + " · " + where + inHunt;
  }

  function acts() {
    if (!run) { return []; }
    var list = [];
    if (still) {
      if (run.i + 1 < run.steps.length) { list.push(button("Next stop →", "", function () { next(); })); }
      list.push(button("End", "walk-end", function () { end("ended"); }));
      return list;
    }
    if (run.paused) { list.push(button("Resume", "walk-resume", resume)); }
    list.push(button("End", "walk-end", function () { end("ended"); }));
    return list;
  }

  function told(said) { show(progress(), said, acts()); }

  function next() {
    if (!run) { return; }
    var prev = run.steps[run.i];
    if (prev && (prev.k === "v" || prev.k === "a") && window.Land && Land.following()) {
      var nx = run.steps[run.i + 1];
      // A voice is let go when the exploration moves on, unless its own places follow.
      if (!(nx && nx.voice === prev.id)) { Land.unfollow(); }
    }
    run.i += 1;
    if (run.i >= run.steps.length) { done(); return; }
    var s = step();
    setLines(run.steps.slice(0, run.i + 1).map(asStop), 6);
    if (s.k !== "|") { told(""); }
    if (s.k === "|") {
      var nx2 = run.steps[run.i + 1];
      told("Handed on → " + (nx2 && nx2.hunt ? nx2.hunt.title : nx2 && nx2.walk ? nx2.walk.title : nx2 ? label(asStop(nx2)) : ""));
      afterStill(next, 3000);
      return;
    }
    if (still) { stillStep(s); return; }
    ({ w: workStep, t: townStep, m: museumStep, v: voiceStep, h: threadStep, a: animalStep, walk: walkStep, site: siteStep, studio: studioStep, life: lifeStep, movement: movementStep }[s.k] || next)(s);
  }

  function asStop(s) {
    if (s.k === "walk") { return { k: "r", id: "w:" + s.walk.id, from: s.from }; }
    if (s.k === "site" || s.k === "studio" || s.k === "life") { return { k: "t", id: s.key }; }
    return { k: s.k, id: s.id, key: s.key };
  }

  // Under reduced motion: no clock, each stop opened by hand ("Next stop →").
  function stillStep(s) {
    if (s.k === "w") { Land.work(s.id, s.key); told((s.lines || [label(s)]).join(" · ")); return; }
    if (s.k === "t") { Land.go(s.id); told(townName(s.id)); return; }
    if (s.k === "m") { Land.museum(s.id); told(label(s)); return; }
    if (s.k === "h") { Land.thread(s.id); told(label(s)); return; }
    if (s.k === "v" && window.Voices) { Voices.follow(s.id); told(label(s)); return; }
    if (s.k === "life" && window.Lives) {
      Lives.visit(s.life, s.p).then(function (got) {
        if (!run) { return; }
        run.arrived = run.i;
        // In the life's view: the place's first beat (its year, its voice), and what the beats say, at once.
        if (got && got.beats && Lives.beat) {
          Lives.beat(got.beats[0]);
          told(got.beats.map(function (b) { return b.say; }).filter(Boolean).slice(0, 4).join(" · "));
          return;
        }
        told(got ? got.lines.join(" · ") : s.word);
      });
      return;
    }
    if (s.k === "studio" && window.Studios) {
      Studios.visit(s.ids).then(function (got) { if (run) { run.arrived = run.i; told(got ? got.lines.join(" · ") : s.word); } });
      return;
    }
    if (s.k === "site" && window.Sites) {
      Sites.visit(s.ids).then(function (got) { if (run) { run.arrived = run.i; told(got ? got.lines.join(" · ") : s.word); } });
      return;
    }
    told(label(asStop(s)));
  }

  function arrive(test, go, fn) {
    var token = run;
    function got(ok) { if (ok && run === token) { run.arrived = run.i; } fn(ok); }
    var w = Land.where();
    if (!w.flying && test(w)) { got(true); return; }
    waitFor(function (x) { return !x.flying; }, function () {
      if (!test(Land.where())) { go(); }
      waitFor(test, got);
    }, 15000);
  }

  // In the city itself; a city that is only its museum opens as the museum.
  function inTown(key) {
    var t = town(key), pass = t && t[8];
    return function (w) { return w.key === key && (w.at === "town" || (pass && w.at === "museum")); };
  }

  function workStep(s) {
    run.down = true;
    var then = function () { openWork(s); };
    // A hunt's stop: first the city it was found in, its number said there.
    if (s.hunt && s.key) {
      var hst = s.hunt.stops[s.n] || {}, hprev = s.n > 0 ? s.hunt.stops[s.n - 1] : null;
      voiceSay({ path: "hunt", step: "arrive", key: s.key, fromKey: hprev && hprev.key, place: townName(s.key),
                 f: { cataloguer: surname(s.hunt.by || ""), no: hst.no || null } });
      arrive(inTown(s.key), function () { Land.go(s.key); }, function (ok) {
        var mk = window.Lives && Lives.made ? Lives.made(s.id) : "";
        told(s.lines[0] + (mk ? " · " + mk : ""));
        if (!ok) { then(); return; }
        afterStill(then, ARRIVE_MS);
      });
      return;
    }
    then();
  }

  function openWork(s) {
    var w = Land.where();
    if (!(w.at === "work" && w.work === s.id)) { Land.work(s.id, s.key); }
    waitFor(function (x) { return x.at === "work" && x.work === s.id; }, function (ok) {
      if (!ok) { afterStill(next, 1000); return; }
      run.arrived = run.i;
      var r = workRow(s.id);
      var lines = [(r ? r[1] + (r[3] ? ", " + r[3] : "") : "Untitled")];
      told("");
      if (s.lines) {
        lines = lines.concat(s.lines.slice(1));
        // Where it was made beside where it was found (lives.js: the workshop, the studio of its years).
        var mk2 = s.hunt && window.Lives && Lives.made ? Lives.made(s.id) : "";
        if (mk2) { lines.splice(2, 0, mk2); }
      }
      else {
        get("histories/" + s.id + ".json").then(function (h) { lines = lines.concat(firstLines(h)); }, function () {});
      }
      SAY_AT.forEach(function (at, k) { afterStill(function () { if (lines[k]) { setSaid(lines[k]); } voiceLine(s, k, lines); }, at); });
      afterStill(next, LOOK);
    });
  }

  /* The voice each line is told in (voice.js reads VOICE.md): a hunt's stop
     goes on to the city from afar, then finds the work there close by (or
     says it is not recorded where), then, where it was painted is
     documented, stands there; a viewer's own exploration is told to "you",
     the lens as near as what each stop is. */
  function ownRun() {
    var k = run && run.x && run.x.kind;
    return k === "made" || k === "relay" || k === "corpse";
  }
  function voiceSay(v) { if (v && window.Voice && Voice.said) { Voice.said(v); } }
  function voiceLine(s, k, lines) {
    if (!run) { return; }
    if (s.k === "w" && s.hunt) {
      var st = s.hunt.stops[s.n] || {}, prev = s.n > 0 ? s.hunt.stops[s.n - 1] : null;
      var cat = surname(s.hunt.by || "");
      if (k === 1) {
        var line = st.lines && st.lines[1] || "";
        var m = /found it with (.+?)(?: · |$)/.exec(line), y = /^In (\d{4})/.exec(line);
        var now = st.now || s.key;
        voiceSay(m ? { path: "hunt", step: "finding", key: s.key, f: { cataloguer: cat, holder: m[1], year: y ? +y[1] : st.y } }
                   : { path: "hunt", step: "unfound", key: now, fromKey: prev && prev.key, place: townName(now), f: { cataloguer: cat } });
      } else if (k === 2) {
        voiceSay({ path: "hunt", step: "site", key: s.key });
      }
      return;
    }
    if (ownRun() && s.k === "w") {
      if (k === 0) { voiceSay({ path: "own", step: "work", key: s.key, place: s.key ? townName(s.key) : null }); }
      else if (k === 2) { voiceSay({ path: "own", step: "site", key: s.key }); }
    }
  }

  var KIND = { made: "Made", owned: "Owned", held: "Held", listed: "Listed", exhibited: "Shown", sold: "Sold", written: "Written" };
  function firstLines(h) {
    var ev = (h.events || []).filter(function (e) { return (e.t || e.v || e.who) && e.k !== "listed" && e.k !== "offered"; });
    var out = [];
    ev.forEach(function (e) {
      if (out.length >= 2) { return; }
      var line = [[KIND[e.k] || "", String(e.y || "").slice(0, 4)].filter(Boolean).join(" "),
                  [e.t || e.v || e.who].filter(Boolean).join(", "), String(e.w || "").split(",")[0]].filter(Boolean).join(" · ");
      if (line.length > 140) { line = line.slice(0, 137).replace(/\s+\S*$/, "") + " …"; }
      if (out.indexOf(line) < 0) { out.push(line); }
    });
    return out;
  }

  function townStep(s) {
    run.down = true;
    if (s.voice) {
      var vr = voiceRow(s.voice);
      voiceSay({ path: "voice", step: "place", key: s.id, place: townName(s.id), f: { voice: vr ? vr[1] : "", year: s.y || null } });
    } else if (ownRun()) {
      voiceSay({ path: "own", step: "city", key: s.id, place: townName(s.id) });
    }
    arrive(inTown(s.id), function () { Land.go(s.id); }, function (ok) {
      var t = town(s.id);
      told(s.voice ? townName(s.id) + (s.y ? " · " + s.y : "") : t ? t[1] + " · " + plural(t[5], "work has", "works have") + " been here" : "");
      afterStill(next, ok ? (s.voice ? HOLD_MS : TOWN_MS) : 1000);
    });
  }

  /* Painted here (sites.js): flown to low, the plate open — the painting
     beside the site — and said on the reading's clock: the work, how exact
     the point is, the sentence that documents it. Several works painted at
     one point are shown in turn. */
  function siteStep(s) {
    run.down = true;
    if (!window.Sites || !Sites.visit) { next(); return; }
    var token = run;
    // The reading layout (voice.js): a site whose painting is saved is read in its work's view, one by
    // an artist with a life in the life's view at its year — the lens on the ground where the painter
    // stood, the painting above it. Any other, as before: its city, low on the point, the plate open.
    if (window.Voice && Voice.sitesReady) {
      Promise.all([Voice.sitesReady(), window.Lives && Lives.load ? Lives.load() : null]).then(function () {
        if (run !== token) { return; }
        var row = Voice.siteRow(s.ids[0]);
        var lifeId = row && !row.w && window.Lives && Lives.idOf ? Lives.idOf(row.a) : null;
        if (row && row.ll && (row.w || lifeId)) { siteRead(s, row, lifeId, token); } else { siteCity(s, token); }
      });
      return;
    }
    siteCity(s, token);
  }
  function siteLines(row) {
    var what = row.what || "";
    var how = row.pr === "view" ? "Where the painter stood · Wikidata’s point of view"
      : row.pr === "street" ? "On " + (what || "the street") + " · the street is documented, not the spot"
      : row.pr === "site" ? (row.how === "made" ? "Made at " : "It shows ") + (what || "the place") + " · the ring is on the place painted, not the easel"
      : "Painted in " + (what || "the town") + " · only the town is documented";
    var lines = [row.t + (row.d ? ", " + row.d : ""), how];
    if (row.said && row.said[0]) { lines.push("“" + row.said[0].q.split(/(?<=\.)\s/)[0] + "”"); }
    return lines;
  }
  function siteRead(s, row, lifeId, token) {
    var w0 = Land.where();
    if (row.w) { if (!(w0.at === "work" && w0.work === row.w)) { Land.work(row.w, row.key); } }
    else { Lives.open(lifeId, { year: row.d || undefined }); }
    waitFor(function (x) { return row.w ? x.at === "work" && x.work === row.w : x.at === "life" && x.id === lifeId; }, function (ok) {
      if (run !== token) { return; }
      if (!ok) { siteCity(s, token); return; }
      run.arrived = run.i;
      told("");
      voiceSay({ path: "sites", step: "site", site: row.id });
      var lines = siteLines(row), per = Math.max(1, Math.min(3, s.ids.length));
      SAY_AT.forEach(function (at, k) { afterStill(function () { if (lines[k]) { setSaid(lines[k]); } }, at); });
      s.ids.slice(1, per).forEach(function (id, k) {
        afterStill(function () {
          var r2 = Voice.siteRow(id);
          if (!r2) { return; }
          voiceSay({ path: "sites", step: "site", site: r2.id });
          setSaid(r2.t + (r2.d ? ", " + r2.d : ""));
        }, LOOK * (k + 1));
      });
      afterStill(next, LOOK * per);
    }, 20000);
  }
  function siteCity(s, token) {
    var row0 = window.Voice && Voice.siteRow ? Voice.siteRow(s.ids[0]) : null;
    if (row0) { voiceSay({ path: "sites", step: "site", site: row0.id, key: row0.key, f: { title: row0.t, year: row0.d || null, who: surname(row0.a), what: row0.what || null } }); }
    Sites.visit(s.ids).then(function (got) {
      if (run !== token) { return; }
      if (!got) { afterStill(next, 1000); return; }
      run.arrived = run.i;
      told("");
      var lines = got.lines, per = Math.max(1, Math.min(3, s.ids.length));   // three works a point at most
      SAY_AT.forEach(function (at, k) { afterStill(function () { if (lines[k]) { setSaid(lines[k]); } }, at); });
      s.ids.slice(1, per).forEach(function (id, k) {
        afterStill(function () { Sites.show(id); setSaid(got.titles[k + 1]); }, LOOK * (k + 1));
      });
      afterStill(next, LOOK * per);
    });
  }

  /* The studios (studios.js): flown to the artist's place, its column open,
     and said on the reading's clock: the artist, the place and its years;
     how exactly it is placed and why; a sentence said of it. */
  function studioStep(s) {
    run.down = true;
    if (!window.Studios || !Studios.visit) { next(); return; }
    var token = run;
    voiceSay({ path: "studios", step: "studio", key: s.key, place: s.word || townName(s.key),
               f: { who: surname(s.ox && s.ox.artist || ""), years: s.y ? String(s.y) : null } });
    Studios.visit(s.ids).then(function (got) {
      if (run !== token) { return; }
      if (!got) { afterStill(next, 1000); return; }
      run.arrived = run.i;
      told("");
      SAY_AT.forEach(function (at, k) { afterStill(function () { if (got.lines[k]) { setSaid(got.lines[k]); } }, at); });
      afterStill(next, LOOK);
    });
  }

  /* A life (lives.js): the place entered, its period's column alone; said on
     the reading's clock — the place, its years and the artist's age; the
     sentence that puts the artist there; a life it crosses — then the works
     of the period in turn, one line each, their squares lit as they are said. */
  function lifeStep(s) {
    run.down = true;
    if (!window.Lives || !Lives.visit) { next(); return; }
    var token = run;
    Lives.visit(s.life, s.p).then(function (got) {
      if (run !== token) { return; }
      if (!got) { afterStill(next, 1000); return; }
      run.arrived = run.i;
      told("");
      // Told in beats in the life's own view (lives.js): each with its year on the dial and its voice in the lens.
      if (got.beats) {
        got.beats.forEach(function (b, n) {
          if (!n && Lives.beat) { Lives.beat(b); }
          afterStill(function () { if (n && Lives.beat) { Lives.beat(b); } if (b.say) { setSaid(b.say); } }, b.at);
        });
        afterStill(next, Math.max(LOOK, got.end));
        return;
      }
      SAY_AT.forEach(function (at, k) { afterStill(function () { if (got.lines[k]) { setSaid(got.lines[k]); } }, at); });
      var t0 = SAY_AT[SAY_AT.length - 1] + 6000;
      got.works.forEach(function (w, k) {
        afterStill(function () { Lives.showWork(w.id); setSaid(w.line); }, t0 + k * 9000);
      });
      afterStill(next, Math.max(LOOK, t0 + got.works.length * 9000 + 4000));
    });
  }

  /* A movement (movements.js): its view at the stop's year, the world eased
     to the place; said on the reading's clock. */
  function movementStep(s) {
    run.down = true;
    if (!window.Movements || !Movements.visit) { next(); return; }
    var token = run;
    // Where one of them was, away from the movement's city: from afar, both in view (voice.js).
    voiceSay({ path: "movement", step: "away", mv: s.mv, key: s.key, who: s.who, y: s.y });
    Movements.visit(s).then(function (got) {
      if (run !== token) { return; }
      if (!got) { afterStill(next, 1000); return; }
      run.arrived = run.i;
      told("");
      SAY_AT.forEach(function (at, k) { afterStill(function () { if (got.lines[k]) { setSaid(got.lines[k]); } }, at); });
      afterStill(next, LOOK);
    });
  }

  function museumStep(s) {
    run.down = true;
    if (ownRun()) { var mm = museum(s.id); voiceSay({ path: "own", step: "museum", f: { museum: mm ? mm.name : "" } }); }
    arrive(function (w) { return w.at === "museum" && w.museum === s.id; }, function () { Land.museum(s.id); }, function (ok) {
      var m = museum(s.id);
      told(m ? m.name + " · " + m.where : "");
      afterStill(next, ok ? HOLD_MS : 1000);
    });
  }

  function threadStep(s) {
    run.down = true;
    if (ownRun()) { var tt = threadRow(s.id); voiceSay({ path: "own", step: "thread", f: { name: tt ? tt[2] : "" } }); }
    arrive(function (w) { return w.at === "thread" && w.id === s.id; }, function () { Land.thread(s.id); }, function (ok) {
      var t = threadRow(s.id);
      told(t ? t[2] + (t[3] ? " · " + t[3] : "") + (t[4] ? ", " + t[4] : "") + " · " + plural(t[5], "work", "works") : "");
      afterStill(next, ok ? HOLD_MS : 1000);
    });
  }

  function voiceStep(s) {
    if (!window.Voices || !Voices.follow) { next(); return; }
    if (ownRun()) { var vv = voiceRow(s.id); voiceSay({ path: "own", step: "voice", f: { voice: vv ? vv[1] : "" } }); }
    Voices.follow(s.id).then(function () {
      if (run) { run.arrived = run.i; }
      var v = voiceRow(s.id);
      told(v ? "Following " + v[1] + " · " + v[5] : "");
      waitFor(function () { return true; }, function () { afterStill(next, HOLD_MS); }, 20000);
    });
  }

  function animalStep(s) {
    if (!window.Characters || !Characters.lead) { next(); return; }
    if (ownRun()) { var cc = castRow(s.id); voiceSay({ path: "own", step: "animal", f: { animal: cc ? "the " + cc.name.toLowerCase() : "" } }); }
    Characters.lead(s.id).then(function (f) {
      if (!run) { return; }
      if (f && !Land.following()) { Land.follow(f); }
      run.arrived = run.i;
      var c = castRow(s.id);
      told(c ? "Following the " + c.name.toLowerCase() + " · after " + c.artist : "");
      waitFor(function () { return true; }, function () { afterStill(next, HOLD_MS); }, 20000);
    });
  }

  // A walk is walks.js's: its animal leads; here we wait for it to end.
  function walkStep(s) {
    if (!window.Walks || !Walks.play) { next(); return; }
    var token = run;
    strip.hidden = true;
    token.inWalk = true;
    Walks.play(s.walk, { from: s.from, onEnd: function (why) {
      if (run !== token) { return false; }
      token.inWalk = false;
      if (why === "done") { next(); return true; }
      end(why);
      return true;
    } });
  }

  function pause() {
    if (!run || run.paused || still || run.inWalk) { return; }
    run.paused = true;
    run.timers.forEach(function (t) { window.clearTimeout(t); });
    run.timers = [];
    told(undefined);
  }

  function resume() {
    if (!run || !run.paused) { return; }
    run.paused = false;
    run.i -= 1;
    next();
  }

  function end(why) {
    if (!run) { return; }
    var k = run.i, n = run.steps.length;
    // Where it was ended: the last stop reached, not one still being flown to.
    var rep = run.rep, x = run.x, ctxStep = run.steps[Math.max(0, Math.min(run.arrived === undefined ? 0 : run.arrived, n - 1))];
    stopRun();
    renderDock();
    show("Ended · " + x.title + (n > 1 ? " · " + (k + 1) + " of " + n : ""),
         why === "up" ? "Up to the world." : "", relayActs(rep).concat([handoffs({ step: ctxStep, rep: rep, x: x }),
         button("×", "walk-x", function () { strip.hidden = true; })]), chainOf(rep) ? 60000 : 20000);
    if (chainOf(rep)) { setLines(rep, 0, true); }
  }

  function done() {
    var x = run.x, rep = run.rep, last = null;
    for (var i = run.steps.length - 1; i >= 0 && !last; i -= 1) { if (run.steps[i].k !== "|") { last = run.steps[i]; } }
    stopRun();
    renderDock();
    var list = [button("Again", "", function () { play(x, { rep: rep }); })].concat(relayActs(rep));
    list.push(handoffs({ step: last, rep: rep, x: x }));
    list.push(button("×", "walk-x", function () { strip.hidden = true; }));
    show("Explored · " + x.title, chainOf(rep) ? "A relay of " + plural(legCount(rep), "leg", "legs") : "", list, Math.pow(PHI, 7) * 1000);
    setLines(rep, 0, true);
  }

  // A chain of two legs or more: kept, and shared as one code.
  function relayActs(rep) {
    if (!chainOf(rep)) { return []; }
    var relayX = { id: "r" + Date.now().toString(36), kind: "relay", title: autoTitle({ stops: rep }), titled: false, by: "you", stops: rep };
    var code = el("span", "walk-code");
    return [button("Keep this relay", "walk-keep", function (event) {
      relayX.code = encode(relayX);
      keepIt(relayX);
      event.target.textContent = "Kept";
      code.textContent = relayX.code;
    }), button("Share", "explore-share", function () { relayX.code = encode(relayX); code.textContent = relayX.code; copy(relayX.code, code); }), code];
  }

  function chainOf(rep) { return rep && rep.some(function (s) { return s.k === "|"; }); }
  function legCount(rep) { return rep.filter(function (s) { return s.k === "|"; }).length + 1; }

  // How an exploration stands in a chain: a published one by its reference; anything else, its stops.
  function repOf(x) {
    if (x.kind === "hunt") { return [{ k: "r", id: "h:" + x.id, from: x.from || 0 }]; }
    // A life is kept and shared as its places (a code knows towns, not lives).
    if (x.kind === "life" && x.towns) { return x.towns.map(function (k) { return { k: "t", id: k }; }); }
    return x.stops.slice();
  }

  /* ---- the relay: what begins where this ended ------------------------------ */

  function contextOf(o) {
    return load().then(function () {
      var c = { key: null, museum: null, work: -1, year: 0, artist: null, animal: null, voice: null, skip: {} };
      if (o.walk) {
        var w = o.walk, st = w.stops[w.stops.length - 1];
        c.key = st.key;
        c.work = st.works.length ? (D.workIx[st.works[0]] === undefined ? -1 : D.workIx[st.works[0]]) : -1;
        c.artist = w.artist;
        c.animal = w.animal;
        c.skip["w:" + w.id] = true;
        c.rep = D.walkBy[w.id] !== undefined ? [{ k: "r", id: "w:" + w.id, from: 0 }]
          : [].concat.apply([], w.stops.map(function (s) {
            return [{ k: "t", id: s.key }].concat(s.works.map(function (id) { return { k: "w", id: id, key: s.key }; }));
          }));
        return c;
      }
      var s = o.step || {};
      c.rep = o.rep;
      if (o.x) { c.skip[(o.x.kind === "hunt" ? "h:" : "x:") + o.x.id] = true; }
      (o.rep || []).forEach(function (q) { if (q.k === "r") { c.skip[q.id] = true; } });
      if (s.hunt) {
        c.skip["h:" + s.hunt.id] = true;
        c.voice = s.hunt.voice;
        // Not the cataloguer's own route: a hunt is already theirs.
        s.hunt.voices.forEach(function (v) { c.skip["v:" + v] = true; });
      }
      if (s.k === "walk") { return contextOf({ walk: s.walk }).then(function (wc) { wc.rep = o.rep; return wc; }); }
      if (s.k === "studio") {
        if (s.ox) { c.skip["o:" + s.ox.id] = true; c.artist = s.ox.artist; }
        c.key = s.key || null;
        c.year = s.y || 0;
        return Promise.resolve(c);
      }
      if (s.k === "movement") {
        c.key = s.key || null;
        c.year = s.y || 0;
        c.skip["m:" + s.mv] = true;
        return Promise.resolve(c);
      }
      if (s.k === "life") {
        c.key = s.key || null;
        c.year = s.y || 0;
        c.skip["l:" + s.life] = true;
        return Promise.resolve(c);
      }
      if (s.k === "site") {
        if (s.sx) { c.skip["s:" + s.sx.id] = true; c.artist = s.sx.artist; }
        c.key = s.key || null;
        c.year = s.y || 0;
        return Promise.resolve(c);
      }
      if (s.k === "w") {
        var r = workRow(s.id);
        c.work = D.workIx[s.id] === undefined ? -1 : D.workIx[s.id];
        c.artist = r && r[2];
        c.year = s.y || (r ? yearOf(r[3]) : 0);
        c.key = s.key || null;
        if (!c.key) {
          return get("histories/" + s.id + ".json").then(function (h) {
            var last = null;
            (h.events || []).forEach(function (e) { if (e.p && (e.k === "held" || e.k === "owned" || e.k === "listed")) { last = e; } });
            c.key = last ? last.p : null;
            return c;
          }, function () { return c; });
        }
      } else if (s.k === "t") { c.key = s.id; c.year = s.y || 0; c.voice = s.voice || c.voice; }
      else if (s.k === "m") { c.museum = s.id; c.key = D.museumTown[s.id] || null; }
      else if (s.k === "v") { c.voice = s.id; }
      else if (s.k === "a") { var cr = castRow(s.id); c.animal = s.id; c.artist = cr && cr.artist; }
      else if (s.k === "h") { var t = threadRow(s.id); c.year = t ? t[4] : 0; }
      return c;
    });
  }

  // The rows to match: the published, and the viewer's own kept explorations.
  function candidates() {
    var rows = D.relay.slice();
    // The movements (movements.js), beside the index: a code's 9 bits are spent.
    if (window.Movements && Movements.relayRows) { rows = rows.concat(Movements.relayRows()); }
    kept().forEach(function (x) {
      var st = x.stops.filter(function (s) { return s.k === "w" || s.k === "t" || s.k === "m"; }).map(function (s) {
        return [s.k === "t" ? s.id : s.k === "m" ? D.museumTown[s.id] || "" : s.key || "", 0,
                s.k === "w" && D.workIx[s.id] !== undefined ? D.workIx[s.id] : -1];
      });
      if (st.length) { rows.push(["k", x.id, x.title, "", "", "", st.length, st, x]); }
    });
    return rows;
  }

  function match(c) {
    var out = [];
    candidates().forEach(function (r) {
      var key = r[0] + ":" + r[1];
      if (c.skip[key] || (r[0] === "k" && c.rep && sameStops(r[8].stops, c.rep))) { return; }
      var best = null;
      r[7].forEach(function (s, i) {
        var start = i === 0;
        if (!start && (r[0] === "v" || i >= r[6] - 1)) { return; }
        var sc = 0, why = null;
        if (c.work >= 0 && s[2] === c.work) { sc = 100; why = "work"; }
        else if (c.key && s[0] === c.key) { sc = 60 + (c.year && s[1] && Math.abs(s[1] - c.year) <= 5 ? 10 : 0); why = "city"; }
        else if (start && c.year && s[1] && Math.abs(s[1] - c.year) <= 5) { sc = 30; why = "time"; }
        if (!start) { sc *= 0.6; }
        if (sc && (!best || sc > best.sc)) { best = { sc: sc, why: why, i: i, s: s }; }
      });
      if (!best || best.sc < 30) {
        if (c.animal && r[4] === c.animal) { best = { sc: 28, why: "animal", i: 0 }; }
        else if (c.artist && r[3] === c.artist) { best = { sc: 25, why: "artist", i: 0 }; }
        else if (c.voice && r[5] === c.voice) { best = { sc: 22, why: "voice", i: 0 }; }
      }
      if (best && best.sc >= 20) { out.push({ row: r, key: key, b: best }); }
    });
    // A hunt, a walk, a kept or sent one before a voice's route; then the shorter.
    var PREF = { h: 5, w: 4, s: 4, o: 4, k: 3, x: 3, v: 0 };
    out.sort(function (a, b) {
      return (b.b.sc + PREF[b.row[0]]) - (a.b.sc + PREF[a.row[0]]) || a.row[6] - b.row[6] || (a.key < b.key ? -1 : 1);
    });
    // Two or three, and not all of one kind: a voice's route once at most.
    var picked = [], kinds = {};
    out.forEach(function (o) {
      var cap = o.row[0] === "v" ? 1 : 2;
      if (picked.length < 3 && (kinds[o.row[0]] || 0) < cap) { picked.push(o); kinds[o.row[0]] = (kinds[o.row[0]] || 0) + 1; }
    });
    return picked;
  }

  function sameStops(a, b) { return a.length === b.length && a.every(function (s, i) { return same(s, b[i]); }); }

  function reason(c, o) {
    var t = rowTitle(o.row), b = o.b, at = b.i ? " at stop " + (b.i + 1) + " of " + o.row[6] : "";
    var wr = c.work >= 0 ? D.works[c.work] : null;
    var place = c.key ? townName(c.key) : "";
    switch (b.why) {
      case "work":
        return { lead: (wr ? wr[1] : "This work"), it: true, door: b.i ? "joins " + t + at : "also the first stop of " + t };
      case "city":
        return { lead: place + (c.year ? ", " + c.year : ""), door: b.i ? "joins " + t + at : t + " begins here" };
      case "time":
        return { lead: String(c.year), door: t + " begins then, in " + townName(b.s[0]) + (b.s[1] ? ", " + b.s[1] : "") };
      case "animal":
        var cr = castRow(c.animal);
        return { lead: "The " + (cr ? cr.name.split(" ").pop().toLowerCase() : "animal") + "’s artist", door: t };
      case "artist":
        return { lead: surname(c.artist), door: t };
      default:
        var v = voiceRow(c.voice);
        return { lead: v ? v[1] : "The voice", door: t };
    }
  }

  /* The offers, in an element filled when they are known (walks.js puts it
     in its strip at a walk's end). Each: its reason, then its door. */
  function handoffs(o) {
    var box = el("div", "explore-handoffs");
    load().then(function () {
      if (!D) { return; }
      return contextOf(o).then(function (c) {
        var found = match(c);
        if (!found.length) { return; }
        box.appendChild(el("p", "walk-progress", "Where this ends, others begin"));
        found.forEach(function (f) {
          var r = reason(c, f);
          var b = el("button", "explore-handoff");
          b.type = "button";
          var lead = el(r.it ? "i" : "span", "explore-handoff-why", r.lead);
          b.appendChild(lead);
          b.appendChild(document.createTextNode(" → " + r.door));
          b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
          b.addEventListener("click", function (event) {
            event.stopPropagation();
            take(c.rep || [], f);
          });
          box.appendChild(b);
        });
      });
    });
    return box;
  }

  // Taken: the chain grows by a leg, and the new leg is played.
  function take(rep, f) {
    var leg, x;
    if (f.row[0] === "k") {
      x = f.row[8];
      leg = x.stops.slice(f.b.i ? indexAtStop(x, f.b.i) : 0);
    } else {
      leg = [{ k: "r", id: f.key, from: f.b.i || 0 }];
      x = { id: f.row[1], kind: f.row[0] === "h" ? "hunt" : f.row[0] === "s" ? "sites" : f.row[0] === "o" ? "studios" : "ref", title: rowTitle(f.row), by: f.row[0] === "h" ? (hunt(f.row[1]) || {}).by : "",
            stops: leg };
    }
    var chain = rep.concat([{ k: "|" }]).concat(leg);
    if (strip) { strip.hidden = true; }
    var legX = { id: x.id, kind: x.kind, title: x.title + (f.b.i ? " · joined at stop " + (f.b.i + 1) : ""), by: x.by, stops: leg };
    play(legX, { rep: chain });
  }

  function indexAtStop(x, i) {
    var n = -1;
    for (var k = 0; k < x.stops.length; k += 1) {
      var s = x.stops[k];
      if (s.k === "w" || s.k === "t" || s.k === "m") { n += 1; }
      if (n === i) { return k; }
    }
    return 0;
  }

  /* ---- the legs on the globe ------------------------------------------------ */

  var legsCv = null, legsCtx = null, legs = null, legsAt = 0, legsRaf = 0;

  function setUpLegs() {
    if (legsCv) { return; }
    var tiles = document.getElementById("tiles");
    legsCv = el("canvas", "world world-tiles explore-legs");
    legsCv.setAttribute("aria-hidden", "true");
    if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(legsCv, tiles.nextSibling); }
    else { document.body.appendChild(legsCv); }
    legsCtx = legsCv.getContext("2d");
  }

  // Points of each leg: [[lat, lon]], resolved from cities, museums and works.
  function legsFor(rep) {
    if (!rep || !chainOf(rep)) { return; }
    var parts = [[]], waits = [];
    rep.forEach(function (s) {
      if (s.k === "|") { parts.push([]); return; }
      var leg = parts[parts.length - 1];
      function at(key) { var t = town(key); if (t) { leg.push([t[3], t[4]]); } }
      if (s.k === "t") { at(s.id); }
      else if (s.k === "m") { var m = museum(s.id); if (m) { leg.push([m.lat, m.lon]); } }
      else if (s.k === "w" && s.key) { at(s.key); }
      else if (s.k === "w") {
        var slot = leg.length;
        leg.push(null);
        waits.push(get("histories/" + s.id + ".json").then(function (h) {
          var last = null;
          (h.events || []).forEach(function (e) { if (e.ll && (e.k === "held" || e.k === "owned" || e.k === "listed")) { last = e; } });
          if (last) { leg[slot] = last.ll; }
        }, function () {}));
      } else if (s.k === "r") {
        var r = relayRow(s.id);
        var sx2 = r && r[0] === "s" ? siteX(r[1]) : r && r[0] === "o" ? studioX(r[1]) : null;
        if (sx2) { sx2.stops.slice(s.from || 0).forEach(function (st) { leg.push(st.ll); }); }
        else if (r) { r[7].slice(r[0] === "v" ? 0 : s.from || 0).forEach(function (q) { if (q[0]) { at(q[0]); } }); }
      }
    });
    Promise.all(waits).then(function () {
      legs = parts.map(function (p) { return p.filter(Boolean); });
      legsAt = performance.now();
      setUpLegs();
      if (!legsRaf) { legsRaf = window.requestAnimationFrame(drawLegs); }
    });
  }

  function slerp(a, b, t) {
    var r = Math.PI / 180;
    var la1 = a[0] * r, lo1 = a[1] * r, la2 = b[0] * r, lo2 = b[1] * r;
    var v1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
    var v2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
    var d = Math.acos(Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2])));
    if (d < 1e-6) { return a; }
    var s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    var x = s1 * v1[0] + s2 * v2[0], y = s1 * v1[1] + s2 * v2[1], z = s1 * v1[2] + s2 * v2[2];
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) / r, Math.atan2(y, x) / r, d];
  }

  /* Every other tile of the pixel light along each leg, faint, each leg its
     tone; a handoff drawn in the tone of the leg it hands to. Shown while
     the world is seen whole; the chain fades after a while unwatched. */
  function drawLegs() {
    legsRaf = 0;
    if (!legsCv || !legs) { return; }
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (legsCv.width !== Math.round(W * dpr)) { legsCv.width = Math.round(W * dpr); legsCv.height = Math.round(H * dpr); }
    legsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    legsCtx.clearRect(0, 0, W, H);
    var w = window.Land && Land.where ? Land.where() : { at: "world" };
    var age = (performance.now() - legsAt) / 1000;
    var fade = run ? 1 : Math.max(0, 1 - Math.max(0, age - 120) / 30);
    if ((w.at === "world" || w.at === "flying") && fade > 0) {
      var seen = {}, C = 13;
      legs.forEach(function (leg, li) {
        var pts = leg.slice();
        if (li && legs[li - 1].length) { pts.unshift(legs[li - 1][legs[li - 1].length - 1]); }
        legsCtx.fillStyle = TONES[li % TONES.length];
        for (var k = 1; k < pts.length; k += 1) {
          var d = slerp(pts[k - 1], pts[k], 1)[2] || 0;
          var n = Math.max(6, Math.ceil(d * 240));
          for (var q = 0; q <= n; q += 1) {
            var g = slerp(pts[k - 1], pts[k], q / n);
            var p = Land.at(g[0], g[1]);
            if (!p || p.z < 0.08 || p.x < 0 || p.y < 0 || p.x > W || p.y > H) { continue; }
            var i = Math.floor(p.x / C), j = Math.floor(p.y / C), id = i + "," + j;
            if (seen[id] || (i + j) % 2) { continue; }
            seen[id] = true;
            legsCtx.globalAlpha = 0.42 * fade * Math.min(1, (p.z - 0.08) * 6);
            legsCtx.fillRect(i * C + 4, j * C + 4, C - 8, C - 8);
          }
        }
      });
      legsCtx.globalAlpha = 1;
    }
    if (fade > 0) { legsRaf = window.requestAnimationFrame(drawLegs); } else { legs = null; }
  }

  /* ---- Find ----------------------------------------------------------------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");
  var said = document.getElementById("finder-said");

  function asked(text) {
    var t = fold(text).trim();
    if (parse(t)) { return "code"; }
    if (/^(hunts?|explorations?|walks?|relays?)$/.test(t)) { return "all"; }
    return t.length >= 4 ? "name" : null;
  }

  function huntsFor(t) {
    return D.ex.hunts.filter(function (h) {
      var hay = " " + fold(h.by + " " + h.artist + " " + h.title);
      return hay.indexOf(" " + t) >= 0;
    });
  }

  function foundRow(text, fn) {
    var b = el("button", "finder-row finder-line", text);
    b.type = "button";
    b.addEventListener("click", function (event) { event.stopPropagation(); fn(); });
    return b;
  }

  function huntX(h, from) {
    return { id: h.id, kind: "hunt", title: h.title, by: h.by, from: from || 0, stops: [{ k: "r", id: "h:" + h.id, from: from || 0 }] };
  }

  function offerInFind() {
    if (!field || !found || found.querySelector(".explore-found")) { return; }
    var text = field.value, kind = asked(text);
    if (!kind) { return; }
    load().then(function () {
      if (!D || field.value !== text || found.querySelector(".explore-found")) { return; }
      var box = el("div", "explore-found");
      var head = el("p", "finder-group");
      box.appendChild(head);
      if (kind === "code") {
        var x = decode(text);
        if (!x) { return; }
        head.textContent = x.kind === "relay" ? "A relay" : "An exploration";
        if (x.stale) {
          box.appendChild(el("p", "finder-group finder-foot", "An exploration code, but not one this map knows: made against an earlier map, or a letter out"));
        } else {
          var n = x.stops.filter(function (s) { return s.k !== "|"; }).length;
          box.appendChild(foundRow((x.kind === "relay" ? "Relay: " : "Exploration: ") + x.title + " · " + plural(n, x.kind === "relay" ? "leg" : "stop", x.kind === "relay" ? "legs" : "stops").replace(/^\d+ legs?/, legCount(x.stops) + (legCount(x.stops) === 1 ? " leg" : " legs")), function () { play(x); }));
          if (said) { said.textContent = "Found · " + (x.kind === "relay" ? "a relay" : "an exploration"); }
        }
        found.insertBefore(box, found.firstChild);
        return;
      }
      var t = fold(text).trim();
      var hs = kind === "all" ? D.ex.hunts : huntsFor(t);
      var mine = kind === "all" ? kept().slice().reverse() : kept().filter(function (x) { return fold(x.title).indexOf(t) >= 0; });
      var sent = (D.ex.made || []).filter(function (x) { return kind === "all" || fold(x.title).indexOf(t) >= 0; });
      if (!hs.length && !mine.length && !sent.length) { return; }
      head.textContent = kind === "all" ? "Explorations" : "Hunts and explorations";
      hs.slice(0, kind === "all" ? 40 : 6).forEach(function (h) {
        box.appendChild(foundRow("Hunt: " + h.title + " · by " + h.by, function () { play(huntX(h)); }));
      });
      sent.forEach(function (x) {
        box.appendChild(foundRow("Exploration: " + x.title + " · by " + x.by, function () {
          play({ id: x.id, kind: "sent", title: x.title, by: x.by, stops: [{ k: "r", id: "x:" + x.id, from: 0 }] });
        }));
      });
      mine.slice(0, 8).forEach(function (x) { box.appendChild(foundRow("Yours: " + x.title, function () { play(x); })); });
      found.insertBefore(box, found.firstChild);
    });
  }

  /* ---- in the columns: the voice's hunt, the animal's artist's hunts -------- */

  function boxes() {
    var col = document.getElementById("art-col");
    var box = col && col.querySelector(".follow-box");
    if (!box || box.querySelector(".explore-hunts")) { return; }
    var f = window.Land && Land.following();
    if (!f) { return; }
    load().then(function () {
      if (!D || box.querySelector(".explore-hunts")) { return; }
      var list = D.ex.hunts.filter(function (h) {
        return f.voice ? h.voices.indexOf(f.voice) >= 0 : h.artist === f.artist;
      });
      if (!list.length) { return; }
      var sec = el("div", "explore-hunts");
      if (!f.voice) { sec.appendChild(el("p", "town-section", "Hunts for " + f.artist)); }
      list.forEach(function (h) {
        var b = el("button", f.voice ? "read-quiet explore-take" : "walk-row", "");
        b.type = "button";
        if (f.voice) { b.textContent = "Take " + surname(h.by.split(" with ")[0]) + "’s hunt · " + h.title.split(" · ")[1]; }
        else {
          b.appendChild(el("span", "walk-row-title", h.title));
          b.appendChild(el("span", "walk-row-by", "by " + h.by));
          b.appendChild(sentenceEl(sentence([{ k: "r", id: "h:" + h.id, from: 0 }]), 2));
        }
        b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
        b.addEventListener("click", function (event) { event.stopPropagation(); play(huntX(h)); });
        sec.appendChild(b);
      });
      var away = box.querySelector(".follow-away");
      box.insertBefore(sec, away || null);
    });
  }

  /* ---- wiring ------------------------------------------------------------------ */

  function poll() {
    if (!window.Land || !Land.where) { return; }
    if (!D) { if (here().length || draft.stops.length) { load().then(function () { renderDock(); }); } return; }
    renderDock();
    if (run && !run.inWalk) {
      var w = Land.where();
      if (w.at !== "world" && w.at !== "flying") { run.down = true; }
      if (w.at === "world" && run.down && !w.flying) { end("up"); }
    }
  }

  window.addEventListener("pointermove", function () { movedAt = performance.now(); }, { capture: true, passive: true });
  function outside(t) { return !(strip && strip.contains(t)) && !(dock && dock.contains(t)) && !(tray && tray.contains(t)); }
  window.addEventListener("pointerdown", function (event) {
    movedAt = performance.now();
    if (run && outside(event.target)) { pause(); }
    if (menu && !menu.hidden && outside(event.target)) { menu.hidden = true; }
  }, true);
  window.addEventListener("wheel", function (event) { if (run && outside(event.target)) { pause(); } }, { capture: true, passive: true });
  window.addEventListener("keydown", function (event) {
    if (!run || !outside(event.target) || /^(Shift|Control|Alt|Meta|Tab)$/.test(event.key)) { return; }
    pause();
  }, true);

  window.setInterval(poll, 400);
  var col = document.getElementById("art-col");
  if (col && window.MutationObserver) { new MutationObserver(boxes).observe(col, { childList: true }); }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offerInFind, 320); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && asked(field.value)) { offerInFind(); } }).observe(found, { childList: true });
  }
  if (draft.stops.length) { load().then(function () { renderDock(); }); }

  window.Explorations = {
    play: play,
    handoffs: handoffs,
    hunt: function (id) { return load().then(function () { var h = hunt(id); return h && play(huntX(h)); }); },
    add: function (s) { return load().then(function () { add(s); }); },
    draft: function () { return draft; },
    kept: kept,
    encode: function (x) { return load().then(function () { return encode(x); }); },
    decode: function (code) { return load().then(function () { return decode(code); }); },
    sentence: function (stops) { return load().then(function () { return sentenceText(sentence(stops)); }); },
    end: function () { end("ended"); },
    // What is being played, for the marks that belong to it (sites.js): a site exploration's own
    // sites (sites.json rows), a hunt's artist.
    playing: function () {
      var s = run && run.steps[run.i];
      if (!s) { return null; }
      var sites = null;
      if (s.sx) { sites = []; s.sx.stops.forEach(function (st) { sites = sites.concat(st.s || []); }); }
      return { k: s.k, artist: s.hunt ? s.hunt.artist : null, sites: sites };
    },
    _pace: function (k) { PACE = k; },
    _state: function () {
      return { playing: run && { title: run.x.title, i: run.i, n: run.steps.length, paused: run.paused, inWalk: !!run.inWalk, arrived: run.arrived,
                                 step: run.steps[run.i] && { k: run.steps[run.i].k, id: run.steps[run.i].id || (run.steps[run.i].walk || {}).id } },
               draft: draft.stops.length, legs: legs && legs.map(function (l) { return l.length; }),
               strip: strip && !strip.hidden ? strip.innerText : "" };
    }
  };
})();

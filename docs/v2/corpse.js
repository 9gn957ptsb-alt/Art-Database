/* The exquisite corpse — a relay folded like the Surrealists' paper.

   The artist, 1 Oct 2026, approved "the exquisite corpse" relay and its
   refinement: "Go ahead and build it", and "Yeah build it that way, I like
   the idea of ritual and using the animals to generate games".

   The fold. Each player sees only the edge of what came before: handed a
   corpse, you see its last stop — one work, one city, one year — and walk
   your leg on from that edge. Three legs, as head, torso and legs; then it
   is complete.

   A leg is a short exploration (works at their cities, in the years the
   record has them there) carried by an animal: the one followed, or the
   animal of an artist the leg passes through (chosen at the fold if more
   than one was met). Each animal's documented instinct changes how its leg
   is made — one rule each, said in one line at the fold:
     fox       mousing pounces face north-east (Červený et al. 2011):
               the next stops are offered toward the north-east
     squirrel  scatter-hoarding: the leg buries one of its works, hidden
               from this corpse; it surfaces in someone else's game
               ("a squirrel buried this here in October")
     slug      trail-following: its leg follows trails and leaves one,
               faint on the globe, and unfolds at the slug's tempo
     eagle     mantling: it does the folding — the next player sees only
               the year; its stops are few and far apart
     bison     faces into the blizzard: it walks against time (later to
               earlier), and each stop leaves a wallow in the ground
     deer      the antler cycle, by the real month: its part changes with
               the month; it freezes when the pointer comes near

   The sentence. Leg one gives the subject (its first city), leg two the
   verb (from a work's own record at its stop: shown, sold, held, kept,
   listed, offered, made), leg three the object (its last work's title):
   "Paris sold the Water Lilies." Grammatical, true in parts, never true
   whole.

   The unfolding. The third leg's fold opens it: the whole route drawn on
   the globe at once, each leg its tone; the chimera (Characters.chimera,
   the three animals as head, body and hindquarters, in leg order) performs
   its metamorphosis, each parent's instinct in turn, and walks the route;
   the sentence is said on the slow clock. Then kept, shared as a code, and
   joined to the viewer's explorations.

   Rituals. Two completed chimeras whose routes share a city (one of them
   the viewer's) meet there: Characters.meet, and a line naming what their
   works share, a door.

   One link: a corpse travels as a code (corpse·…), pasted into Find. A code
   a visitor sends the artist becomes a published corpse through a session
   (CORPSE.md). Nothing here changes the address. */
(function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var TONES = ["#9d95e6", "#eadfcd", "#8fc7bd"];
  var STORE = "corpse.kept", DRAFT = "corpse.draft", CACHES = "corpse.caches", TRAILS = "corpse.trails";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var VERB_ORDER = ["sold", "offered", "made", "held", "owned", "exhibited", "listed", "other"];
  var VERB = { sold: "sold", offered: "offered", made: "made", held: "held", owned: "kept", exhibited: "showed", listed: "listed", other: "saw" };
  var SAY_AT = [4000, 9000, 16000];
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var D = null, reading = null, places = {}, hist = {};
  var pointer = { x: -1e4, y: -1e4, at: 0 };

  /* ---- small things ---------------------------------------------------------- */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function button(text, cls, fn) {
    var b = el("button", cls || "read-quiet", text);
    b.type = "button";
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); fn(event); });
    return b;
  }
  function get(path) {
    return fetch(path).then(function (r) { if (!r.ok) { throw new Error(path); } return r.json(); });
  }
  function store(key, v) {
    try { if (v === null) { localStorage.removeItem(key); } else { localStorage.setItem(key, JSON.stringify(v)); } } catch (e) { /* this visit only */ }
  }
  function stored(key, dflt) {
    try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : dflt; } catch (e) { return dflt; }
  }
  function fold(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function hashStr(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function rand(seed) {
    var s = hashStr(seed) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
  }
  function shortTitle(t) {
    t = String(t || "").replace(/\s*[\[(].*?[\])]\s*/g, " ").replace(/\s+/g, " ").trim();
    var w = t.split(" ");
    return w.length > 7 ? w.slice(0, 6).join(" ") + "…" : t;
  }
  function surname(name) { var w = String(name || "").split(" "); return w[w.length - 1]; }

  var RAD = Math.PI / 180;
  function km(a, b) {
    var la1 = a[0] * RAD, la2 = b[0] * RAD, dl = (b[1] - a[1]) * RAD, dp = la2 - la1;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function bearing(a, b) {
    var la1 = a[0] * RAD, la2 = b[0] * RAD, dl = (b[1] - a[1]) * RAD;
    var y = Math.sin(dl) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }
  function compass(b) { return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(b / 45) % 8]; }
  function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

  /* ---- reading the files ------------------------------------------------------ */

  function load() {
    if (reading) { return reading; }
    reading = Promise.all([get("finding.json"), get("cities.json"), get("characters/characters.json"),
                           get("characters/artists.json"), get("explorations.json").catch(function () { return { relay: [] }; }),
                           get("corpses.json").catch(function () { return { made: [], caches: [], trails: [], wallows: [] }; })])
      .then(function (g) {
        var d = { works: g[0].w, threads: g[0].t, towns: g[1].towns, cast: g[2].cast, artists: g[3].artists || {},
                  relay: g[4].relay || [], pub: g[5] };
        function ix(list, f) { var o = {}; list.forEach(function (x, i) { o[f(x)] = i; }); return o; }
        d.workIx = ix(d.works, function (w) { return w[0]; });
        d.townIx = ix(d.towns, function (t) { return t[0]; });
        d.castIx = ix(d.cast, function (c) { return c.id; });
        d.threadIx = ix(d.threads, function (t) { return t[0]; });
        d.byArtist = {};
        d.cast.forEach(function (c) { d.byArtist[c.artist] = c.id; });
        // Which animals' artists have been in each city.
        d.metAt = {};
        Object.keys(d.artists).forEach(function (name) {
          var id = d.byArtist[name];
          if (!id) { return; }
          (d.artists[name].places || []).forEach(function (p) { (d.metAt[p[0]] = d.metAt[p[0]] || []).push(id); });
        });
        D = d;
        return d;
      }).catch(function () { reading = null; return null; });
    return reading;
  }

  function town(key) { var i = D.townIx[key]; return i === undefined ? null : D.towns[i]; }
  function townName(key) { var t = town(key); return t ? String(t[1]).split(",")[0] : key; }
  function ll(key) { var t = town(key); return t ? [t[3], t[4]] : null; }
  function workRow(id) { var i = D.workIx[id]; return i === undefined ? null : D.works[i]; }
  function castRow(id) { var i = D.castIx[id]; return i === undefined ? null : D.cast[i]; }
  function animalWord(id) { var c = castRow(id); return c ? (id === "slug" ? "slug" : c.name.split(" ").pop().toLowerCase()) : id; }
  function picture(id) { var r = workRow(id); return r && r[4] ? CDN + r[4] + "/square.jpg" : null; }

  function place(key) {
    if (!places[key]) { places[key] = get("places/" + key + ".json").catch(function () { return { works: [] }; }); }
    return places[key];
  }
  function history(id) {
    if (!hist[id]) { hist[id] = get("histories/" + id + ".json").catch(function () { return null; }); }
    return hist[id];
  }

  /* ---- the instincts ------------------------------------------------------------ */

  function month() { return new Date().getMonth(); }
  // The red deer's antler cycle in the northern year: cast in early spring,
  // growing in velvet through summer, clean and hard by the autumn's rut.
  function antlers(m) {
    if (m >= 8 && m <= 10) { return "rut"; }
    if (m === 3) { return "cast"; }
    if (m >= 4 && m <= 7) { return "velvet"; }
    return "hard";
  }
  function rule(a) {
    switch (a) {
      case "fox": return "the fox leans north-east";
      case "squirrel": return "the squirrel buries one work on the way";
      case "slug": return "the slug follows trails, and leaves one";
      case "eagle": return "the eagle mantles: it hides what came before, and flies far";
      case "bison": return "the bison faces into the storm: back in time";
      case "deer":
        return { rut: "the stag is in rut: it goes where the crowds are",
                 cast: "the stag has cast its antlers: a short leg",
                 velvet: "the stag is in velvet: each stop a little further",
                 hard: "the stag's antlers are hard: it keeps to near ground" }[antlers(month())];
      default: return "";
    }
  }
  function legMax(a) { return a === "eagle" || (a === "deer" && antlers(month()) === "cast") ? 2 : 3; }

  /* ---- a corpse ------------------------------------------------------------------- */
  /* { id, legs: [{ a, by, stops: [{ w, k, y }], buried: [{ w, k, y }] }], start: { k, y } } */

  function visible(c) {
    var out = [];
    c.legs.forEach(function (l) { l.stops.forEach(function (s) { out.push(s); }); });
    return out;
  }
  function edgeOf(c) {
    for (var i = c.legs.length - 1; i >= 0; i -= 1) {
      var st = c.legs[i].stops;
      if (st.length) { return st[st.length - 1]; }
    }
    return c.start ? { w: null, k: c.start.k, y: c.start.y } : null;
  }
  function used(c) {
    var o = {};
    c.legs.forEach(function (l) { l.stops.concat(l.buried || []).forEach(function (s) { o[s.w] = true; }); });
    return o;
  }
  function animalsOf(c) { return c.legs.map(function (l) { return l.a; }); }

  /* ---- the code ---------------------------------------------------------------------
     corpse· + Crockford base 32 in fours: version 3, check 5, legs 2; each
     leg: animal 4, the site's 1, stops 3, buried 1 (+ a stop); each stop
     its work (13 bits, finding.json), its city (10, cities.json) and its
     year (11, from 1000). One leg of three stops: 25 characters; two: 47;
     three: 70, with a squirrel's buried work 77. */

  var WB = 13, TB = 10, YB = 11;

  function checkOf(c) {
    return hashStr(c.legs.map(function (l) {
      return l.a + ":" + l.stops.concat(l.buried || []).map(function (s) { return s.w + "@" + s.k + "@" + (s.y || 0); }).join(",");
    }).join("|")) & 31;
  }

  function encode(c) {
    var bits = [];
    function put(v, n) { for (var k = n - 1; k >= 0; k -= 1) { bits.push((v >> k) & 1); } }
    function stop(s) {
      put(D.workIx[s.w] || 0, WB);
      put(D.townIx[s.k] || 0, TB);
      put(s.y ? Math.max(0, Math.min(2047, s.y - 1000)) : 0, YB);
    }
    put(1, 3);
    put(checkOf(c), 5);
    put(c.legs.length, 2);
    c.legs.forEach(function (l) {
      put(Math.max(0, D.castIx[l.a] || 0), 4);
      put(/^site/.test(l.by || "") ? 1 : 0, 1);
      put(l.stops.length, 3);
      put(l.buried && l.buried.length ? 1 : 0, 1);
      if (l.buried && l.buried.length) { stop(l.buried[0]); }
      l.stops.forEach(stop);
    });
    while (bits.length % 5) { bits.push(0); }
    var out = "";
    for (var b = 0; b < bits.length; b += 5) {
      out += B32.charAt(bits[b] * 16 + bits[b + 1] * 8 + bits[b + 2] * 4 + bits[b + 3] * 2 + bits[b + 4]);
    }
    return "corpse·" + out.match(/.{1,4}/g).join("-");
  }

  function parse(text) {
    var m = /^\s*corpse\s*[·.\-:\s/]+\s*([0-9a-z][0-9a-z\-\s]{2,})\s*$/i.exec(String(text || ""));
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
      var x = 0;
      for (var q = 0; q < n; q += 1) { x = x * 2 + bits[at + q]; }
      at += n;
      return x;
    }
    function stop() {
      var w = D.works[take(WB)], t = D.towns[take(TB)], y = take(YB);
      if (!w || !t) { bad = true; return null; }
      return { w: w[0], k: t[0], y: y ? y + 1000 : 0 };
    }
    if (take(3) !== 1) { return null; }
    var sum = take(5), n = take(2), legs = [];
    for (var l = 0; l < n && !bad; l += 1) {
      var a = D.cast[take(4)], site = take(1), ns = take(3), hasB = take(1);
      var leg = { a: a ? a.id : "fox", by: site ? "site" : "a player", stops: [], buried: [] };
      if (hasB) { leg.buried.push(stop()); }
      for (var s = 0; s < ns && !bad; s += 1) { leg.stops.push(stop()); }
      legs.push(leg);
    }
    if (bad || !legs.length || bits.length - at >= 5) { return null; }
    var c = { id: "c" + (hashStr(body) % 1e9).toString(36), legs: legs, code: "corpse·" + body.match(/.{1,4}/g).join("-") };
    c.stale = checkOf(c) !== sum;
    return c;
  }

  /* ---- the caches, the trails and the wallows: kept here, carried in codes,
          and published (corpses.json) ------------------------------------------ */

  function caches() {
    var mine = stored(CACHES, []);
    var pub = (D.pub.caches || []).map(function (r) { return { w: r[0], k: r[1], y: r[2], m: r[3], corpse: r[4] }; });
    return (Array.isArray(mine) ? mine : []).concat(pub);
  }
  function trails() {
    var mine = stored(TRAILS, []);
    var pub = (D.pub.trails || []).map(function (r) { return { corpse: r[0], keys: r[1] }; });
    return (Array.isArray(mine) ? mine : []).concat(pub);
  }
  function keptCorpses() { var k = stored(STORE, []); return Array.isArray(k) ? k : []; }
  function allComplete() {
    var pub = (D.pub.made || []).map(function (m) { return { id: m.id, legs: m.legs.map(function (l) {
      return { a: l.a, by: l.by || "a player", stops: l.stops.map(function (s) { return { w: s[0], k: s[1], y: s[2] }; }),
               buried: (l.buried || []).map(function (s) { return { w: s[0], k: s[1], y: s[2] }; }) };
    }), title: m.title, by: m.by, published: true }; });
    return keptCorpses().concat(pub).filter(function (c) { return c.legs && c.legs.length === 3; });
  }
  function wallowsAt(key) {
    var n = 0;
    function count(c) {
      (c.legs || []).forEach(function (l) { if (l.a === "bison") { l.stops.forEach(function (s) { if (s.k === key) { n += 1; } }); } });
    }
    keptCorpses().forEach(count);
    if (corpse) { count(corpse); }
    (D.pub.wallows || []).forEach(function (r) { if (r[0] === key) { n += 1; } });
    return n;
  }

  /* ---- the offers: where the leg can go next ----------------------------------- */

  function offers(c, leg) {
    var e = leg.stops.length ? leg.stops[leg.stops.length - 1] : edgeOf(c);
    var a = leg.a, here = ll(e.k), u = used({ legs: c.legs.concat([leg]) }), R = rand(c.id + ":" + c.legs.length + ":" + leg.stops.length);
    var seen = {};
    return place(e.k).then(function (P) {
      var cand = [];
      if (!e.w) {
        (P.works || []).forEach(function (r) { if (!u[r[0]] && D.workIx[r[0]] !== undefined) { cand.push({ w: r[0], to: e.k, how: "here" }); } });
      } else {
        (P.works || []).forEach(function (r) {
          if (u[r[0]] || D.workIx[r[0]] === undefined) { return; }
          if (r[10] && r[10] !== e.k && town(r[10])) { cand.push({ w: r[0], to: r[10], how: "went" }); }
          if (r[9] && r[9] !== e.k && town(r[9])) { cand.push({ w: r[0], to: r[9], how: "came" }); }
        });
        var t = town(e.k);
        (t && t[10] || []).forEach(function (n) { var o = D.towns[n[0]]; if (o) { cand.push({ to: o[0], how: "near" }); } });
        caches().forEach(function (x) {
          if (x.corpse === c.id || u[x.w] || !ll(x.k) || !here) { return; }
          if (km(here, ll(x.k)) < 900) { cand.push({ w: x.w, to: x.k, y: x.y, m: x.m, how: "cache" }); }
        });
        if (a === "eagle") {
          D.towns.forEach(function (o) { if ((o[6] || []).length >= 2 && R() < 0.35) { cand.push({ to: o[0], how: "far" }); } });
        }
        if (a === "slug") {
          trails().forEach(function (tr) {
            if (tr.corpse === c.id) { return; }
            tr.keys.forEach(function (k) { if (k !== e.k && ll(k)) { cand.push({ to: k, how: "trail" }); } });
          });
        }
      }
      cand = cand.filter(function (x) { return ll(x.to); });
      cand.forEach(function (x) {
        var p = ll(x.to);
        x.km = here ? km(here, p) : 0;
        x.brg = here ? bearing(here, p) : 0;
        x.score = { here: 0, went: 0, came: 0.4, cache: 0.5, near: 1.2, far: 2, trail: 1.8 }[x.how] + R() * 0.9;
      });
      var deer = antlers(month());
      function keep(f, min) { var k = cand.filter(f); if (k.length >= (min || 3)) { cand = k; } }
      if (a === "fox" && e.w) {
        keep(function (x) { return x.how !== "here" && angDiff(x.brg, 45) <= 67.5; }, 1);
        cand.forEach(function (x) { x.score = angDiff(x.brg, 45) / 45 + x.score * 0.25; });
      } else if (a === "eagle" && e.w) {
        keep(function (x) { return x.km >= 1500; });
        cand.forEach(function (x) { x.score = -x.km / 4000 + x.score * 0.5; });
      } else if (a === "bison") {
        keep(function (x) { return x.how !== "went"; }, 1);
      } else if (a === "slug") {
        keep(function (x) { return x.km < 1500; });
        cand.forEach(function (x) { if (x.how === "trail") { x.score -= 2; } x.score += x.km / 1500; });
      } else if (a === "squirrel") {
        cand.forEach(function (x) { if (x.how === "cache") { x.score -= 2; } });
      } else if (a === "deer" && e.w) {
        cand.forEach(function (x) {
          var t = town(x.to);
          if (deer === "rut") { x.score = -Math.log(1 + (t ? t[5] : 0)) / 2 + x.score * 0.3; }
          else if (deer === "velvet") { x.score = Math.abs(x.km - 300 * (leg.stops.length + 1)) / 300 + x.score * 0.3; }
          else { x.score = x.km / 400 + x.score * 0.3; }
        });
      }
      cand.sort(function (p, q) { return p.score - q.score; });
      // Resolve, a city at a time, until three are found (two of one city at most when beginning here).
      var out = [], i = 0;
      function next() {
        if (out.length >= 3 || i >= cand.length || i > 40) { return Promise.resolve(out); }
        var x = cand[i];
        i += 1;
        if (x.how !== "here" && seen[x.to]) { return next(); }
        return place(x.to).then(function (Q) {
          var row = null;
          (Q.works || []).forEach(function (r) {
            if (x.w) { if (r[0] === x.w && !row) { row = r; } return; }
            if (u[r[0]] || D.workIx[r[0]] === undefined) { return; }
            if (out.some(function (o) { return o.w === r[0]; })) { return; }
            if (a === "bison" && e.y && r[6] > e.y) { return; }
            var dy = Math.abs((r[6] || 0) - (e.y || r[6] || 0));
            if (!row || dy + R() * 4 < Math.abs((row[6] || 0) - (e.y || 0))) { row = r; }
          });
          if (!row && x.w && x.how === "cache") { row = [x.w, "", "", "", "", 0, x.y, x.y, []]; }
          if (!row) { return next(); }
          var y = x.how === "cache" ? x.y : row[6] || 0;
          if (a === "bison" && e.y && y && y > e.y) { return next(); }
          if (out.some(function (o) { return o.w === row[0]; })) { return next(); }
          seen[x.to] = true;
          out.push({ w: row[0], k: x.to, y: y, how: x.how, km: x.km, brg: x.brg, m: x.m });
          return next();
        });
      }
      return next().then(function (list) {
        if (a === "bison") { list.sort(function (p, q) { return (q.y || 0) - (p.y || 0); }); }
        return list;
      });
    });
  }

  function reason(o) {
    var where = o.km ? Math.round(o.km).toLocaleString("en") + " km " + compass(o.brg) : "";
    switch (o.how) {
      case "here": return "here";
      case "went": return "it went on there" + (where ? " · " + where : "");
      case "came": return "it came from there" + (where ? " · " + where : "");
      case "cache": return "a squirrel buried this here in " + MONTHS[o.m || 0];
      case "trail": return "on a slug’s trail · " + where;
      case "far": return "far · " + where;
      default: return where;
    }
  }

  /* ---- the sentence --------------------------------------------------------------- */

  function verbOf(leg) {
    var best = null;
    return Promise.all(leg.stops.map(function (s) {
      return place(s.k).then(function (P) {
        (P.works || []).forEach(function (r) {
          if (r[0] !== s.w) { return; }
          (r[8] || []).forEach(function (v) {
            if (VERB[v] && (best === null || VERB_ORDER.indexOf(v) < VERB_ORDER.indexOf(best))) { best = v; }
          });
        });
      });
    })).then(function () { return VERB[best || "other"]; });
  }
  function objectOf(title) {
    var t = shortTitle(title) || "Untitled";
    if (/^untitled/i.test(t)) { return { art: "an", t: t }; }
    if (/^(the|a|an)\s/i.test(t)) { return { art: "", t: t }; }
    return { art: "the", t: t };
  }
  function sentenceOf(c) {
    if (c.legs.length < 3) { return Promise.resolve(null); }
    var first = c.legs[0].stops[0], last = c.legs[2].stops[c.legs[2].stops.length - 1];
    return verbOf(c.legs[1]).then(function (v) {
      var o = objectOf((workRow(last.w) || [])[1]);
      return { s: townName(first.k), v: v, o: o, text: townName(first.k) + " " + v + " " + (o.art ? o.art + " " : "") + o.t + "." };
    });
  }

  /* ---- the panel: the fold, the leg being walked -------------------------------- */

  var corpse = null, leg = null, panel = null, lastOffers = [], busy = false, collapsed = false;

  function setUpPanel() {
    if (panel) { return; }
    panel = el("section", "corpse-panel");
    panel.setAttribute("aria-label", "The exquisite corpse");
    panel.hidden = true;
    ["pointerdown", "wheel", "touchstart"].forEach(function (t) {
      panel.addEventListener(t, function (event) { event.stopPropagation(); }, { passive: true });
    });
    document.body.appendChild(panel);
  }

  function square(id, cls) {
    var s = el("span", "corpse-square" + (cls ? " " + cls : ""));
    var src = id && picture(id);
    if (src) { var img = el("img"); img.alt = ""; img.loading = "lazy"; img.src = src; s.appendChild(img); }
    return s;
  }

  function begin(c) {
    corpse = c;
    corpse.id = corpse.id || "c" + Date.now().toString(36);
    collapsed = false;
    if (corpse.legs.length >= 3) { unfold(corpse); return; }
    newLeg();
  }

  function metHere(key) { return (D.metAt[key] || []).slice(); }

  function newLeg() {
    var e = edgeOf(corpse), f = window.Land && Land.following && Land.following();
    var have = animalsOf(corpse);
    var met = [];
    if (f && f.cast) { met.push(f.cast); }
    metHere(e.k).forEach(function (a) { if (met.indexOf(a) < 0) { met.push(a); } });
    var free = met.filter(function (a) { return have.indexOf(a) < 0; });
    leg = { a: free[0] || D.cast.map(function (x) { return x.id; }).filter(function (a) { return have.indexOf(a) < 0; })[0] || "fox",
            by: "you", stops: [], buried: [], met: met };
    store(DRAFT, { corpse: corpse, leg: leg });
    render();
    refresh();
  }

  function refresh() {
    lastOffers = [];
    busy = true;
    render();
    var want = leg;
    offers(corpse, leg).then(function (list) {
      if (want !== leg) { return; }
      busy = false;
      lastOffers = list;
      render();
    });
  }

  function take(o) {
    leg.stops.push({ w: o.w, k: o.k, y: o.y });
    metHere(o.k).forEach(function (a) { if (leg.met.indexOf(a) < 0) { leg.met.push(a); } });
    store(DRAFT, { corpse: corpse, leg: leg });
    var w = window.Land && Land.where ? Land.where() : {};
    if (window.Land && Land.go && o.k !== w.key && !w.flying) { Land.go(o.k); }
    if (leg.stops.length >= legMax(leg.a)) { lastOffers = []; render(); return; }
    refresh();
  }

  function render() {
    setUpPanel();
    if (!corpse || !leg) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.textContent = "";
    panel.dataset.collapsed = collapsed ? "true" : "";
    var n = corpse.legs.length + 1;
    var head = button("Exquisite corpse · leg " + n + " of 3", "corpse-head", function () { collapsed = !collapsed; render(); });
    head.setAttribute("aria-expanded", collapsed ? "false" : "true");
    panel.appendChild(head);
    if (collapsed) { return; }

    // The fold: only the edge of what came before.
    var e = edgeOf(corpse);
    var prev = corpse.legs[corpse.legs.length - 1];
    if (corpse.legs.length) {
      var foldBox = el("div", "corpse-fold");
      foldBox.appendChild(el("p", "corpse-crease", corpse.legs.length === 1 ? "one leg folded under" : "two legs folded under"));
      var veiled = prev && prev.a === "eagle";
      var edge = el("div", "corpse-edge");
      edge.appendChild(square(veiled ? null : e.w, veiled ? "corpse-veiled" : ""));
      var t = el("div", "corpse-edge-text");
      if (veiled) {
        t.appendChild(el("p", "corpse-edge-title", String(e.y || "a year not recorded")));
        t.appendChild(el("p", "corpse-said", "the eagle mantled over the rest"));
      } else {
        t.appendChild(el("p", "corpse-edge-title", shortTitle((workRow(e.w) || [])[1])));
        t.appendChild(el("p", "corpse-said", townName(e.k) + (e.y ? " · " + e.y : "")));
      }
      edge.appendChild(t);
      foldBox.appendChild(edge);
      panel.appendChild(foldBox);
    } else {
      panel.appendChild(el("p", "corpse-said", "From " + townName(e.k) + (e.y ? ", " + e.y : "") + ": the head."));
    }

    // The animal carrying this leg, and its instinct.
    var have = animalsOf(corpse);
    var chips = el("div", "corpse-animals");
    var pool = D.cast.map(function (x) { return x.id; }).filter(function (a) { return have.indexOf(a) < 0; });
    if (leg.stops.length && leg.met.length) {
      pool = pool.filter(function (a) { return a === leg.a || leg.met.indexOf(a) >= 0; });
    }
    pool.forEach(function (a) {
      var b = button(animalWord(a), "corpse-animal", function () {
        if (leg.a === a) { return; }
        leg.a = a;
        store(DRAFT, { corpse: corpse, leg: leg });
        if (leg.stops.length >= legMax(a)) { leg.stops = leg.stops.slice(0, legMax(a)); lastOffers = []; render(); return; }
        refresh();
      });
      b.setAttribute("aria-pressed", leg.a === a ? "true" : "false");
      if (leg.met.indexOf(a) >= 0) { b.dataset.met = "true"; b.title = "its artist's works have been here"; }
      chips.appendChild(b);
    });
    panel.appendChild(chips);
    var r = el("p", "corpse-rule", rule(leg.a));
    panel.appendChild(r);
    if (leg.a === "deer") { panel.appendChild(deerSprite()); }

    // The leg so far.
    if (leg.stops.length) {
      var so = el("ol", "corpse-stops");
      leg.stops.forEach(function (s) {
        var li = el("li", "corpse-stop");
        li.appendChild(square(s.w));
        li.appendChild(el("span", "corpse-stop-text", townName(s.k) + (s.y ? " · " + s.y : "")));
        so.appendChild(li);
      });
      panel.appendChild(so);
    }

    // Where it can go.
    if (leg.stops.length < legMax(leg.a)) {
      var list = el("div", "corpse-offers");
      if (busy) { list.appendChild(el("p", "corpse-said", "…")); }
      lastOffers.forEach(function (o) {
        var b = button("", "corpse-offer", function () { take(o); });
        b.appendChild(square(o.w));
        var tx = el("span", "corpse-offer-text");
        tx.appendChild(el("span", "corpse-offer-title", shortTitle((workRow(o.w) || [])[1])));
        tx.appendChild(el("span", "corpse-offer-where", townName(o.k) + (o.y ? " · " + o.y : "")));
        tx.appendChild(el("span", "corpse-offer-why", reason(o)));
        b.appendChild(tx);
        b.dataset.how = o.how;
        list.appendChild(b);
      });
      if (!busy && !lastOffers.length) { list.appendChild(el("p", "corpse-said", "Nowhere further from here for the " + animalWord(leg.a) + ".")); }
      panel.appendChild(list);
    }

    // The fold.
    var acts = el("div", "corpse-acts");
    if (leg.stops.length >= Math.min(2, legMax(leg.a)) || (leg.stops.length && !busy && !lastOffers.length)) {
      acts.appendChild(button(corpse.legs.length === 2 ? "Fold, and unfold it" : "Fold it", "read-quiet corpse-fold-it", foldLeg));
    }
    acts.appendChild(button("Put it away", "read-quiet", putAway));
    panel.appendChild(acts);
  }

  // At the fold: who carried it, if more than one was met; the squirrel's burial.
  function foldLeg() {
    var choices = leg.met.filter(function (a) { return animalsOf(corpse).indexOf(a) < 0; });
    if (choices.indexOf(leg.a) < 0) { choices.unshift(leg.a); }
    if (choices.length > 1 && !leg.chosen) {
      ask("Who carried this leg?", choices.map(function (a) {
        return { text: animalWord(a) + " — " + rule(a), fn: function () { leg.a = a; leg.chosen = true; if (leg.stops.length > legMax(a)) { leg.stops = leg.stops.slice(0, legMax(a)); } foldLeg(); } };
      }));
      return;
    }
    if (leg.a === "squirrel" && !leg.buried.length && leg.stops.length > 1) {
      ask("The squirrel buries one", leg.stops.map(function (s, i) {
        return { text: shortTitle((workRow(s.w) || [])[1]) + " · " + townName(s.k), fn: function () { bury(i); foldLeg(); } };
      }));
      return;
    }
    folded();
  }

  function bury(i) {
    var s = leg.stops.splice(i, 1)[0];
    leg.buried = [s];
    var list = stored(CACHES, []);
    if (!Array.isArray(list)) { list = []; }
    list.push({ w: s.w, k: s.k, y: s.y, m: month(), corpse: corpse.id });
    store(CACHES, list.slice(-89));
  }

  function ask(q, rows) {
    panel.textContent = "";
    panel.appendChild(el("p", "corpse-head corpse-head-static", "Exquisite corpse · the fold"));
    panel.appendChild(el("p", "corpse-rule", q));
    var box = el("div", "corpse-offers");
    rows.forEach(function (r) { box.appendChild(button(r.text, "corpse-choice", r.fn)); });
    panel.appendChild(box);
  }

  function folded() {
    delete leg.met;
    delete leg.chosen;
    corpse.legs.push(leg);
    if (leg.a === "slug") {
      var list = stored(TRAILS, []);
      if (!Array.isArray(list)) { list = []; }
      list.push({ corpse: corpse.id, keys: [edgeOf({ legs: corpse.legs.slice(0, -1), start: corpse.start }) || {}].map(function (s) { return s.k; })
        .concat(leg.stops.map(function (s) { return s.k; })).filter(Boolean) });
      store(TRAILS, list.slice(-34));
    }
    leg = null;
    store(DRAFT, corpse.legs.length < 3 ? { corpse: corpse } : null);
    if (corpse.legs.length >= 3) { panel.hidden = true; unfold(corpse); return; }
    handOn();
  }

  // Between legs: pass it on (the code), or let the site walk the next one.
  function handOn() {
    var code = encode(corpse);
    panel.hidden = false;
    panel.textContent = "";
    panel.appendChild(el("p", "corpse-head corpse-head-static", "Exquisite corpse · " + corpse.legs.length + " of 3 folded"));
    var last = corpse.legs[corpse.legs.length - 1];
    panel.appendChild(el("p", "corpse-rule", rule(last.a)));
    panel.appendChild(el("p", "corpse-said", last.a === "eagle" ? "The next player will see only the year." :
      "The next player will see only " + townName(edgeOf(corpse).k) + ", " + (edgeOf(corpse).y || "a year not recorded") + "."));
    var c = el("p", "corpse-code", code);
    panel.appendChild(c);
    var acts = el("div", "corpse-acts");
    acts.appendChild(button("Copy the code", "read-quiet", function (event) {
      var b = event.currentTarget;
      try { navigator.clipboard.writeText(code).then(function () { b.textContent = "Copied"; }, function () {}); } catch (e) { /* the code is there to read */ }
    }));
    acts.appendChild(button("Walk the next leg", "read-quiet", function () { newLeg(); }));
    acts.appendChild(button("Let the site walk it", "read-quiet", function () { siteLeg(); }));
    acts.appendChild(button("Put it away", "read-quiet", putAway));
    panel.appendChild(acts);
  }

  function putAway() {
    if (corpse && corpse.legs.length < 3) { store(DRAFT, { corpse: corpse, leg: leg }); }
    corpse = null;
    leg = null;
    if (panel) { panel.hidden = true; }
  }

  /* ---- the anonymous players: the published hunts, walks and voices -------------- */

  function relayLabel(r) { return { h: "hunt", w: "walk", v: "route", x: "exploration" }[r[0]] || "exploration"; }

  // A published exploration's stops, as a leg: works at their cities.
  function rowLeg(r, from, n, a) {
    var stops = r[7].slice(from, from + n);
    return Promise.all(stops.map(function (q) {
      if (!q[0] || !town(q[0])) { return null; }
      if (q[2] >= 0 && D.works[q[2]]) { return { w: D.works[q[2]][0], k: q[0], y: q[1] || 0 }; }
      return place(q[0]).then(function (P) {
        var row = (P.works || []).filter(function (x) { return D.workIx[x[0]] !== undefined; })[0];
        return row ? { w: row[0], k: q[0], y: q[1] || row[6] || 0 } : null;
      });
    })).then(function (list) {
      var seen = {};
      list = list.filter(function (s) { if (!s || seen[s.w]) { return false; } seen[s.w] = true; return true; });
      return { a: a, by: "site:" + r[0] + ":" + r[1], stops: list, buried: [] };
    });
  }

  function animalFor(r, key, have, R) {
    var a = r && r[4];
    if (a && have.indexOf(a) < 0 && castRow(a)) { return a; }
    var byArt = r && D.byArtist[r[3]];
    if (byArt && have.indexOf(byArt) < 0) { return byArt; }
    var met = metHere(key).filter(function (x) { return have.indexOf(x) < 0; });
    if (met.length) { return met[Math.floor(R() * met.length)]; }
    var free = D.cast.map(function (x) { return x.id; }).filter(function (x) { return have.indexOf(x) < 0; });
    return free[Math.floor(R() * free.length)] || "fox";
  }

  // "Start a corpse": the edge of a published exploration, matched to where you are.
  function startPublished(opts) {
    opts = opts || {};
    var w = window.Land && Land.where ? Land.where() : {};
    var R = rand("start:" + Date.now());
    var rows = D.relay.filter(function (r) { return (opts.kind ? r[0] === opts.kind : r[0] === "h" || r[0] === "w") && r[7].length >= 3; });
    var near = w.key ? rows.filter(function (r) { return r[7].some(function (q) { return q[0] === w.key; }); }) : [];
    var pool = near.length ? near : rows;
    var r = pool[Math.floor(R() * pool.length)];
    var j = Math.min(r[7].length - 1, 2 + Math.floor(R() * (r[7].length - 2)));
    if (near.length) {
      var k = -1;
      r[7].forEach(function (q, i) { if (q[0] === w.key && i >= 2 && k < 0) { k = i; } });
      if (k >= 0) { j = k; }
    }
    var from = Math.max(0, j - 2);
    var a = animalFor(r, r[7][j][0], opts.avoid || [], R);
    return rowLeg(r, from, j - from + 1, a).then(function (l) {
      if (l.a === "squirrel" && l.stops.length > 2) { l.buried = l.stops.splice(1, 1); }
      var c = { id: "c" + Date.now().toString(36), legs: [l], from: r[2] };
      begin(c);
      say("The first player: " + r[2] + " · " + rule(l.a), 6000);
    });
  }

  function beginHere() {
    var w = window.Land && Land.where ? Land.where() : {};
    if (!w.key || !town(w.key)) { return false; }
    begin({ id: "c" + Date.now().toString(36), legs: [], start: { k: w.key, y: 0 } });
    return true;
  }

  // The site walks a leg: a published exploration through the edge if one
  // passes there (and the animal's instinct allows), else the animal's own walk.
  function siteLeg() {
    var e = edgeOf(corpse), have = animalsOf(corpse), R = rand(corpse.id + ":site:" + corpse.legs.length);
    var rows = D.relay.filter(function (r) {
      for (var i = 0; i < r[7].length - 1; i += 1) { if (r[7][i][0] === e.k) { return true; } }
      return false;
    });
    var r = rows[Math.floor(R() * rows.length)];
    var a = animalFor(r, e.k, have, R);
    panel.hidden = false;
    panel.textContent = "";
    panel.appendChild(el("p", "corpse-head corpse-head-static", "The site walks leg " + (corpse.legs.length + 1)));
    panel.appendChild(el("p", "corpse-rule", rule(a)));
    var u = used(corpse);
    var done;
    if (r && a !== "fox" && a !== "eagle" && a !== "bison") {
      var i0 = 0;
      r[7].forEach(function (q, i) { if (q[0] === e.k && !i0) { i0 = i + 1; } });
      done = rowLeg(r, i0, legMax(a), a).then(function (l) {
        l.stops = l.stops.filter(function (s) { return !u[s.w]; });
        return l.stops.length ? l : walkFor(a);
      });
    } else {
      done = walkFor(a);
    }
    done.then(function (l) {
      if (l.a === "squirrel" && l.stops.length > 1) {
        leg = l;
        bury(Math.floor(l.stops.length / 2));
        l = leg;
      }
      leg = l;
      leg.met = [];
      leg.chosen = true;
      folded();
    });
  }

  function walkFor(a) {
    var l = { a: a, by: "site", stops: [], buried: [] };
    function step() {
      if (l.stops.length >= legMax(a)) { return Promise.resolve(l); }
      return offers(corpse, l).then(function (list) {
        if (!list.length) { return l; }
        l.stops.push({ w: list[0].w, k: list[0].k, y: list[0].y });
        return step();
      });
    }
    return step();
  }

  /* ---- the ground canvas: legs, trails and wallows ----------------------------------- */

  var cv = null, ctx = null, raf = 0, route = null, routeAt = 0;

  function setUpCanvas() {
    if (cv) { return; }
    var tiles = document.getElementById("tiles");
    cv = el("canvas", "world world-tiles corpse-ground");
    cv.setAttribute("aria-hidden", "true");
    if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(cv, tiles.nextSibling); }
    else { document.body.appendChild(cv); }
    ctx = cv.getContext("2d");
  }

  function slerp(a, b, t) {
    var la1 = a[0] * RAD, lo1 = a[1] * RAD, la2 = b[0] * RAD, lo2 = b[1] * RAD;
    var v1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
    var v2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
    var d = Math.acos(Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2])));
    if (d < 1e-6) { return [a[0], a[1], 0]; }
    var s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    var x = s1 * v1[0] + s2 * v2[0], y = s1 * v1[1] + s2 * v2[1], z = s1 * v1[2] + s2 * v2[2];
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD, Math.atan2(y, x) / RAD, d];
  }

  // Each leg's points on the screen, every other tile of the pixel light.
  function pathTiles(pts, W, H) {
    var out = [], C = 13, seen = {};
    for (var k = 1; k < pts.length; k += 1) {
      var d = slerp(pts[k - 1], pts[k], 1)[2] || 0;
      var n = Math.max(4, Math.ceil(d * 240));
      for (var q = 0; q <= n; q += 1) {
        var g = slerp(pts[k - 1], pts[k], q / n);
        var p = window.Land.at(g[0], g[1]);
        if (!p || p.z < 0.08 || p.x < 0 || p.y < 0 || p.x > W || p.y > H) { continue; }
        var i = Math.floor(p.x / C), j = Math.floor(p.y / C), id = i + "," + j;
        if (seen[id]) { continue; }
        seen[id] = true;
        out.push({ i: i, j: j, x: p.x, y: p.y, z: p.z, k: k, u: q / n });
      }
    }
    return out;
  }

  function legPoints(c) {
    var parts = [];
    var prev = c.start ? ll(c.start.k) : null;
    c.legs.forEach(function (l) {
      var pts = prev ? [prev] : [];
      l.stops.forEach(function (s) { var p = ll(s.k); if (p) { pts.push(p); } });
      parts.push(pts);
      if (pts.length) { prev = pts[pts.length - 1]; }
    });
    return parts;
  }

  function wanted() { return !!(corpse || route || ritual || walker); }
  function kick() { if (!raf && cv) { raf = window.requestAnimationFrame(draw); } }

  function draw() {
    raf = 0;
    if (!cv || !window.Land || !Land.at) { return; }
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var w = Land.where(), now = performance.now(), C = 13;
    var world = w.at === "world" || w.at === "flying" || w.flying;
    if (world && corpse && leg) {
      // While a leg is walked: the slugs' trails, faint, and this leg only (the rest is folded).
      ctx.fillStyle = "#e4c45a";
      trails().forEach(function (tr) {
        var pts = tr.keys.map(ll).filter(Boolean);
        pathTiles(pts, W, H).forEach(function (t) {
          if ((t.i + t.j) % 3) { return; }
          ctx.globalAlpha = 0.22 * Math.min(1, (t.z - 0.08) * 6);
          ctx.fillRect(t.i * C + 5, t.j * C + 5, C - 10, C - 10);
        });
      });
      var e = edgeOf({ legs: corpse.legs, start: corpse.start });
      var mine = [e && ll(e.k)].concat(leg.stops.map(function (s) { return ll(s.k); })).filter(Boolean);
      ctx.fillStyle = TONES[corpse.legs.length % 3];
      pathTiles(mine, W, H).forEach(function (t) {
        if ((t.i + t.j) % 2) { return; }
        ctx.globalAlpha = 0.5 * Math.min(1, (t.z - 0.08) * 6);
        ctx.fillRect(t.i * C + 4, t.j * C + 4, C - 8, C - 8);
      });
    }
    if (route && world) {
      // The unfolding: the whole route at once, each leg its tone, lit in steps.
      var age = (now - routeAt) / 1000;
      route.forEach(function (pts, li) {
        ctx.fillStyle = TONES[li % 3];
        var tl = pathTiles(pts, W, H);
        tl.forEach(function (t, n) {
          var on = Math.floor(age * 24) - Math.floor(n / 3);
          if (on < 0 || (t.i + t.j) % 2) { return; }
          ctx.globalAlpha = (on < 3 ? 0.95 : 0.72) * Math.min(1, (t.z - 0.08) * 6);
          ctx.fillRect(t.i * C + 2, t.j * C + 2, C - 4, C - 4);
        });
        // Each stop: five tiles in a diamond.
        pts.forEach(function (p, k) {
          if (!k && li) { return; }
          var q = Land.at(p[0], p[1]);
          if (!q || q.z < 0.1) { return; }
          var i = Math.floor(q.x / C), j = Math.floor(q.y / C);
          ctx.globalAlpha = 0.85;
          [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { ctx.fillRect((i + d[0]) * C + 2, (j + d[1]) * C + 2, C - 4, C - 4); });
        });
      });
    }
    if (!world && w.key) {
      // The bison's wallows: a small depression worked into the ground at the place.
      var n = wallowsAt(w.key);
      var p = n && Land.at(ll(w.key)[0], ll(w.key)[1]);
      if (p && p.z > 0) { drawWallows(p.x, p.y + 30, n, w.key); }
    }
    ctx.globalAlpha = 1;
    if (wanted() || (w.key && wallowsAt(w.key))) { raf = window.requestAnimationFrame(draw); }
  }

  function drawWallows(x, y, n, key) {
    var R = rand("wallow:" + key), px = 3;
    for (var k = 0; k < Math.min(3, n); k += 1) {
      var cx = x + (k - (Math.min(3, n) - 1) / 2) * 46, cy = y + (R() - 0.5) * 16;
      for (var j = -5; j <= 5; j += 1) {
        for (var i = -11; i <= 11; i += 1) {
          var r = (i * i) / 121 + (j * j) / 25;
          if (r > 1) { continue; }
          var rim = r > 0.62, shade = j < 0 && rim ? 0.62 : rim ? 0.3 : 0.22 + r * 0.25;
          var v = Math.round(40 + 60 * shade + R() * 14);
          ctx.globalAlpha = rim ? 0.55 : 0.7;
          ctx.fillStyle = "rgb(" + (v + 18) + "," + (v + 6) + "," + v + ")";
          ctx.fillRect(Math.round(cx + i * px), Math.round(cy + j * px), px - (R() < 0.1 ? 1 : 0), px);
        }
      }
    }
  }

  /* ---- the chimera ------------------------------------------------------------------
     Characters.chimera([head, body, tail], { seed, month }) when the cast
     has it (the characters' module draws it, in DIRT, with its folds and
     its metamorphosis); until then, and wherever it is not, the three
     animals are cut from their own standing pictures at two creases and
     laid edge to edge here. */

  var sprites = {};
  function spriteData(id) {
    if (!sprites[id]) { sprites[id] = get("characters/" + id + ".json").catch(function () { return null; }); }
    return sprites[id];
  }
  function hexRgb(h) { var n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function inkFor(c) {
    var k = c.after.inks;
    return { d: k.coat[0], R: k.coat[1], r: k.coat[2], g: k.coat[3], W: k.white[0], w: k.white[1],
             k: k.black[0], K: k.black[1], y: k.eye, o: k.pen[0], p: k.pen[1] };
  }

  var partFiles = {};
  function partData(id) {
    if (!partFiles[id]) { partFiles[id] = get("characters/parts/" + id + ".json").catch(function () { return null; }); }
    return partFiles[id];
  }

  function makeChimera(ids, seed, c) {
    if (window.Characters && typeof Characters.chimera === "function") {
      try {
        var legs = c ? c.legs.map(function (l) { return l.stops[0] ? { name: townName(l.stops[0].k) } : null; }) : null;
        var real = Characters.chimera(ids, { seed: seed, month: month() + 1, legs: legs, hidden: true });
        if (real) { return Promise.resolve({ real: real, ids: ids }); }
      } catch (e) { /* drawn here instead */ }
    }
    // The parts the characters' module cut at the folds (characters/parts/),
    // when they are there: each slot's own picture, by pose, its x from the crease.
    return Promise.all(ids.map(partData)).then(function (pd) {
      if (pd.every(Boolean)) {
        var deer = antlers(month());
        return { ids: ids, cut: true, bodyLen: pd[1].len, res: pd[0].res || 1.5, ground: pd[0].ground,
                 slots: ["hind", "body", "head"].map(function (slot) {
                   var i = { head: 0, body: 1, hind: 2 }[slot], d = pd[i];
                   var poses = d[slot];
                   if (slot === "head" && ids[i] === "deer" && (deer === "cast" || deer === "velvet") && d["head@" + deer]) { poses = d["head@" + deer]; }
                   return { id: ids[i], slot: slot, poses: poses, ink: inkFor(castRow(ids[i])) };
                 }) };
      }
      return Promise.all(ids.map(spriteData)).then(function (sp) {
        var parts = [];
        // hind (left) | body | head (right): each animal faces right in its picture.
        [[2, 0, 0.34], [1, 0.34, 0.66], [0, 0.66, 1]].forEach(function (sl) {
          var s = sp[sl[0]], c = castRow(ids[sl[0]]);
          if (!s || !c) { return; }
          var rows = s.poses.stand;
          rows = Array.isArray(rows[0]) ? rows[0] : rows;
          var x0 = 99, x1 = 0, y1 = 0;
          rows.forEach(function (row, j) {
            for (var i = 0; i < row.length; i += 1) { if (row.charAt(i) !== ".") { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y1 = Math.max(y1, j); } }
          });
          var a = Math.round(x0 + (x1 - x0 + 1) * sl[1]), b = Math.round(x0 + (x1 - x0 + 1) * sl[2]);
          parts.push({ id: ids[sl[0]], slot: ["head", "body", "hind"][sl[0]], rows: rows, a: a, b: b, foot: y1, ink: inkFor(c) });
        });
        return { parts: parts, ids: ids };
      });
    });
  }

  // The pose each slot takes: walking, standing, presented, or acting out its instinct.
  function slotRows(sl, o, n) {
    var P = sl.poses, t = o.t || 0;
    var name;
    if (o.ritual) { name = "ritual" + (Math.floor(t * 2) % 2); }
    else if (o.lit === sl.slot) { name = "act" + (Math.floor(t * 6) % 4); }
    else if (o.walk && !(o.near && sl.id === "deer")) { name = "walk" + (Math.floor(t * 8 + n) % 6); }
    else if (o.near && sl.id === "deer") { name = "look"; }
    else if (o.present) { name = "present"; }
    else { name = "stand" + (Math.floor(t / 2.4) % 3); }
    return P[name] || P.stand0 || P[Object.keys(P)[0]];
  }

  // Draw the chimera standing on (x, y), `px` a cell; o.dir < 0 faces left.
  function drawChimera(g, ch, x, y, px, o) {
    o = o || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha, dir = o.dir < 0 ? -1 : 1;
    if (ch.cut) {
      var c0 = (ch.bodyLen - 14) / 2, base = Math.round(ch.ground || 43);
      function sx(u) { return Math.round(x + dir * (u - c0) * px - (dir < 0 ? px : 0)); }
      ch.slots.forEach(function (sl, n) {
        var pr = slotRows(sl, o, n);
        if (!pr) { return; }
        var off = pr[0] + (sl.slot === "head" ? ch.bodyLen : 0), rows = pr[1];
        var lift = o.lit === sl.slot ? -1 : 0;
        g.globalAlpha = alpha;
        for (var j = 0; j < rows.length; j += 1) {
          var row = rows[j];
          for (var i = 0; i < row.length; i += 1) {
            var k = row.charAt(i);
            if (k === "." || !sl.ink[k]) { continue; }
            g.fillStyle = sl.ink[k];
            g.fillRect(sx(off + i), Math.round(y - (base - j) * px + lift * px), px, px);
          }
        }
        if (n && o.creases !== false) {
          g.globalAlpha = 0.3 * alpha;
          g.fillStyle = "#eadfcd";
          var cxx = sx(sl.slot === "head" ? ch.bodyLen : 0);
          for (var q = 4; q < 30; q += 2) { g.fillRect(cxx, Math.round(y - q * px), 1, px); }
        }
      });
      g.globalAlpha = 1;
      return;
    }
    var width = 0;
    ch.parts.forEach(function (p) { width += p.b - p.a; });
    var lft = x - (width * px) / 2, at = 0, t = o.t || 0;
    ch.parts.forEach(function (p, n) {
      var frozen = p.id === "deer" && o.near;
      var lift2 = o.lit === p.slot ? -2 : 0;
      var bob = o.walk && !frozen ? Math.round(Math.sin(t * 8 + n * 2.1) * 1.2) : 0;
      for (var j = 0; j < p.rows.length; j += 1) {
        var row = p.rows[j];
        for (var i = p.a; i < p.b; i += 1) {
          var ch2 = row.charAt(i);
          if (ch2 === "." || !p.ink[ch2]) { continue; }
          g.fillStyle = p.ink[ch2];
          g.globalAlpha = alpha;
          var dx = dir < 0 ? (width - 1 - (at + i - p.a)) : at + i - p.a;
          g.fillRect(Math.round(lft + dx * px), Math.round(y - (p.foot - j + 1) * px + (lift2 + bob) * px * 0.5), px, px);
        }
      }
      at += p.b - p.a;
    });
    g.globalAlpha = 1;
  }

  /* ---- the unfolding ------------------------------------------------------------------ */

  var stage = null, stageCv = null, stageCtx = null, walker = null, saidTimers = [];

  function say(text, ms) {
    var s = document.querySelector(".corpse-toast") || el("p", "corpse-toast");
    s.textContent = text;
    s.hidden = false;
    if (!s.parentNode) { document.body.appendChild(s); }
    window.clearTimeout(s._t);
    s._t = window.setTimeout(function () { s.hidden = true; }, ms || 5000);
  }

  function setUpStage() {
    if (stage) { return; }
    stage = el("section", "corpse-stage");
    stage.setAttribute("aria-label", "The corpse unfolded");
    stage.hidden = true;
    stageCv = el("canvas", "corpse-chimera");
    stageCv.setAttribute("aria-hidden", "true");
    stageCv.hidden = true;
    document.body.appendChild(stageCv);
    stage.appendChild(el("p", "corpse-part"));
    stage.appendChild(el("p", "corpse-sentence"));
    stage.appendChild(el("div", "corpse-acts"));
    ["pointerdown", "wheel", "touchstart"].forEach(function (t) {
      stage.addEventListener(t, function (event) { event.stopPropagation(); }, { passive: true });
    });
    document.body.appendChild(stage);
    stageCtx = stageCv.getContext("2d");
  }

  function toWorld(then) {
    var tries = 0;
    (function up() {
      var w = window.Land && Land.where ? Land.where() : { at: "world" };
      if (w.at === "world" && !w.flying) { then(); return; }
      if (!w.flying && tries < 4) { tries += 1; Land.up(); }
      window.setTimeout(up, 700);
    })();
  }

  function unfold(c) {
    corpse = null;
    leg = null;
    if (panel) { panel.hidden = true; }
    store(DRAFT, null);
    setUpCanvas();
    setUpStage();
    saidTimers.forEach(window.clearTimeout);
    saidTimers = [];
    var slow = c.legs.some(function (l) { return l.a === "slug"; }) ? PHI * PHI : 1;
    toWorld(function () {
      route = legPoints(c);
      routeAt = performance.now();
      kick();
      var ids = animalsOf(c);
      Promise.all([makeChimera(ids, c.id, c), sentenceOf(c)]).then(function (g) {
        var ch = g[0], sn = g[1];
        c.title = sn ? sn.text : c.title;
        stage.hidden = false;
        stageCv.hidden = false;
        stage.dataset.on = "true";
        var part = stage.querySelector(".corpse-part"), sent = stage.querySelector(".corpse-sentence"), acts = stage.querySelector(".corpse-acts");
        part.textContent = "";
        sent.textContent = "";
        acts.textContent = "";
        var slots = ["head", "body", "hindquarters"];
        walker = { ch: ch, c: c, t0: performance.now(), slow: slow, lit: null, phase: "present" };
        var stepMs = 2600 * slow, after = false;
        function lightPart(i, said) {
          walker.lit = ["head", "body", "hind"][i];
          part.textContent = slots[i] + " · " + animalWord(ids[i]) + " · " + (said || rule(ids[i]));
        }
        // Unfolded: it walks the route, and the sentence is said on the slow clock.
        function afterUnfold() {
          if (after || walker === null || walker.c !== c) { return; }
          after = true;
          walker.phase = "walk";
          walker.lit = null;
          walker.w0 = performance.now();
          part.textContent = "";
          if (ch.real) { try { ch.real.walk(route, 13000 * slow); } catch (e) { /* it stays where it settled */ } }
          if (sn) {
            var bits = [sn.s, " " + sn.v, " " + (sn.o.art ? sn.o.art + " " : "")];
            SAY_AT.forEach(function (ms, i) {
              saidTimers.push(window.setTimeout(function () {
                if (i < 2) { sent.appendChild(el("span", "corpse-word", bits[i])); }
                else {
                  sent.appendChild(el("span", "corpse-word", bits[2]));
                  sent.appendChild(el("em", "corpse-word", sn.o.t));
                  sent.appendChild(el("span", "corpse-word", "."));
                }
              }, ms * slow));
            });
          }
          saidTimers.push(window.setTimeout(function () { endActs(c, acts); }, (SAY_AT[2] + 1500) * slow));
        }
        function byHand() {
          [0, 1, 2].forEach(function (i) { saidTimers.push(window.setTimeout(function () { lightPart(i); }, 600 * slow + i * stepMs)); });
          saidTimers.push(window.setTimeout(afterUnfold, 600 * slow + 3 * stepMs));
        }
        if (ch.real) {
          // The characters' module performs the metamorphosis; each step is said here.
          var p0 = null;
          try {
            p0 = ch.real.unfold(function (i, info) { if (i < 3) { lightPart(i, info && info.said); } else { afterUnfold(); } });
          } catch (e) { p0 = null; }
          if (p0 && p0.then) { p0.then(function (ok) { if (ok === false) { byHand(); } else { afterUnfold(); } }, byHand); } else { byHand(); }
        } else {
          byHand();
        }
        animate();
      });
    });
  }

  function endActs(c, acts) {
    acts.textContent = "";
    var code = encode(c);
    acts.appendChild(button("Keep", "read-quiet", function (event) {
      keep(c);
      event.currentTarget.textContent = "Kept";
      ritualAfter(c, acts);
    }));
    acts.appendChild(button("Share", "read-quiet", function (event) {
      var b = event.currentTarget;
      var p = stage.querySelector(".corpse-code") || el("p", "corpse-code");
      p.textContent = code;
      stage.insertBefore(p, acts);
      try { navigator.clipboard.writeText(code).then(function () { b.textContent = "Copied"; }, function () {}); } catch (e) { /* it is there to read */ }
    }));
    acts.appendChild(button("Put it away", "read-quiet", closeStage));
  }

  function closeStage() {
    saidTimers.forEach(window.clearTimeout);
    saidTimers = [];
    if (stageCv) { stageCv.hidden = true; }
    if (stage) { stage.hidden = true; stage.dataset.on = ""; var p = stage.querySelector(".corpse-code"); if (p) { p.remove(); } }
    if (walker && walker.ch && walker.ch.real) { try { walker.ch.real.close(); } catch (e) { /* gone */ } }
    walker = null;
    var mine = route;
    window.setTimeout(function () { if (route === mine) { route = null; } }, 20000);
  }

  // Kept here, and joined to the viewer's explorations (each leg a stanza).
  function keep(c) {
    var list = keptCorpses().filter(function (k) { return k.id !== c.id; });
    var copy = { id: c.id, title: c.title, legs: c.legs, code: encode(c), at: Date.now() };
    list.push(copy);
    store(STORE, list.slice(-21));
    var ex = stored("explorations.kept", []);
    if (!Array.isArray(ex)) { ex = []; }
    var stops = [];
    c.legs.forEach(function (l, i) {
      if (i) { stops.push({ k: "|" }); }
      l.stops.forEach(function (s) { stops.push({ k: "w", id: s.w, key: s.k }); });
    });
    ex = ex.filter(function (x) { return x.id !== "corpse-" + c.id; });
    ex.push({ id: "corpse-" + c.id, kind: "relay", title: c.title || "A corpse", titled: true, by: "you", stops: stops });
    store("explorations.kept", ex.slice(-34));
  }

  function animate() {
    var loop = function () {
      if (!walker || !stage || stage.hidden) { stageLoop = 0; return; }
      var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (stageCv.width !== Math.round(W * dpr)) { stageCv.width = Math.round(W * dpr); stageCv.height = Math.round(H * dpr); }
      stageCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stageCtx.clearRect(0, 0, W, H);
      var now = performance.now(), t = (now - walker.t0) / 1000;
      if (walker.ch.parts && walker.ch.parts.length) {
        var phone = W <= 720;
        var near = Math.hypot(pointer.x - W / 2, pointer.y - (phone ? H * 0.42 : H * 0.62)) < 140;
        if (walker.phase === "present") {
          var px = walker.ch.cut ? (phone ? 3 : 4) : (phone ? 4 : 6);
          stageCtx.globalAlpha = 1;
          drawChimera(stageCtx, walker.ch, W / 2, phone ? H * 0.42 : H * 0.62, px,
                      { t: t, lit: walker.lit, near: near, present: !walker.lit, alpha: Math.min(1, t * 1.5) });
          if (walker.lit) { ring(W / 2, (phone ? H * 0.42 : H * 0.62) - 40, t); }
        } else if (route) {
          // It walks the route, small, along the globe.
          var all = [];
          route.forEach(function (pts) { pts.forEach(function (p) { if (!all.length || all[all.length - 1] !== p) { all.push(p); } }); });
          var dur = 13 * walker.slow, u = Math.min(1, ((now - walker.w0) / 1000) / dur);
          var seg = Math.min(all.length - 2, Math.floor(u * (all.length - 1)));
          if (seg >= 0 && all.length > 1) {
            var g = slerp(all[seg], all[seg + 1], u * (all.length - 1) - seg);
            var p = Land.at(g[0], g[1]);
            var q = Land.at(all[seg + 1][0], all[seg + 1][1]);
            if (p && p.z > 0) {
              drawChimera(stageCtx, walker.ch, p.x, p.y - 6, walker.ch.cut ? 1 : 2, { t: t, walk: u < 1, near: Math.hypot(pointer.x - p.x, pointer.y - p.y) < 90, dir: q && q.x < p.x ? -1 : 1, creases: false });
            }
          }
        }
      }
      stageLoop = window.requestAnimationFrame(loop);
    };
    if (!stageLoop) { stageLoop = window.requestAnimationFrame(loop); }
  }
  var stageLoop = 0;

  function ring(x, y, t) {
    var C = 13, r = (t * 60) % 90;
    stageCtx.fillStyle = "#9d95e6";
    for (var a = 0; a < 6.283; a += 0.2) {
      var i = Math.floor((x + Math.cos(a) * r) / C), j = Math.floor((y + Math.sin(a) * r * 0.5) / C);
      stageCtx.globalAlpha = 0.5 * (1 - r / 90);
      stageCtx.fillRect(i * C + 3, j * C + 3, C - 6, C - 6);
    }
    stageCtx.globalAlpha = 1;
  }

  /* ---- the deer that freezes when you come near ----------------------------------- */

  function deerSprite() {
    var box = el("canvas", "corpse-deer");
    box.width = 80;
    box.height = 52;
    box.setAttribute("aria-hidden", "true");
    spriteData("deer").then(function (s) {
      if (!s || !box.isConnected) { return; }
      var c = castRow("deer"), ink = inkFor(c), g = box.getContext("2d"), n = 0, last = 0;
      (function tick(now) {
        if (!box.isConnected) { return; }
        var r = box.getBoundingClientRect();
        var near = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2)) < 110;
        box.dataset.frozen = near ? "true" : "";
        if (!near && now - last > 125) { n = (n + 1) % 4; last = now; }
        var frames = s.poses.trot || s.poses.stand;
        var rows = near ? (Array.isArray(s.poses.look[0]) ? s.poses.look[0] : s.poses.look) : (Array.isArray(frames[0]) ? frames[n % frames.length] : frames);
        g.clearRect(0, 0, 80, 52);
        rows.forEach(function (row, j) {
          for (var i = 0; i < row.length; i += 1) {
            var k = row.charAt(i);
            if (k === "." || !ink[k]) { continue; }
            g.fillStyle = ink[k];
            g.fillRect(i * 2, j * 2, 2, 2);
          }
        });
        window.requestAnimationFrame(tick);
      })(0);
    });
    return box;
  }

  /* ---- rituals: two chimeras that meet ------------------------------------------------- */

  var ritual = null, met = {};

  function cities(c) {
    var o = {};
    c.legs.forEach(function (l) { l.stops.forEach(function (s) { o[s.k] = true; }); });
    return o;
  }

  function sharedLine(a, b) {
    var wa = visible(a).map(function (s) { return s.w; }), wb = visible(b).map(function (s) { return s.w; });
    var same = wa.filter(function (w) { return wb.indexOf(w) >= 0; })[0];
    if (same) {
      var r = workRow(same);
      return Promise.resolve({ text: "both carry " + shortTitle(r && r[1]), door: function () { Land.work(same); } });
    }
    return Promise.all(wa.concat(wb).map(history)).then(function (hs) {
      var ta = {}, best = null;
      hs.slice(0, wa.length).forEach(function (h) { (h && h.threads || []).forEach(function (t) { ta[t.id] = t; }); });
      hs.slice(wa.length).forEach(function (h) {
        (h && h.threads || []).forEach(function (t) {
          if (!ta[t.id] || D.threadIx[t.id] === undefined) { return; }
          var n = D.threads[D.threadIx[t.id]][5] || 99;
          if (!best || n < best.n) { best = { t: t, n: n }; }
        });
      });
      if (best) {
        var t = best.t;
        var verb = { show: "both shown in", sale: "both offered in", owner: "both owned by", writing: "both written of in", museum: "both held by", artist: "both by" }[t.k] || "both in";
        return { text: verb + " " + shortTitle(t.name) + (t.y ? " (" + t.y + ")" : ""), door: function () { Land.thread(t.id); } };
      }
      var ca = cities(a), k = Object.keys(cities(b)).filter(function (x) { return ca[x]; })[0];
      return k ? { text: "both walked through " + townName(k), door: function () { Land.go(k); } } : null;
    });
  }

  function ritualAfter(c, acts) {
    var others = allComplete().filter(function (o) { return o.id !== c.id; });
    var mine = cities(c);
    var hit = null;
    others.forEach(function (o) {
      if (hit) { return; }
      var k = Object.keys(cities(o)).filter(function (x) { return mine[x]; })[0];
      if (k) { hit = { o: o, k: k }; }
    });
    if (!hit) { return; }
    acts.appendChild(button("Its chimera meets another in " + townName(hit.k), "read-quiet corpse-meet-door", function () {
      closeStage();
      met[hit.k] = false;
      Land.go(hit.k);
    }));
  }

  // In a city where two chimeras' routes cross (one the viewer's), they meet.
  function pollRitual() {
    if (!D || corpse || walker || ritual || !window.Land || !Land.where) { return; }
    var w = Land.where();
    if (w.at !== "town" || w.flying || !w.key || met[w.key]) { return; }
    var all = allComplete().filter(function (c) { return cities(c)[w.key]; });
    var mine = all.filter(function (c) { return !c.published; });
    if (!mine.length || all.length < 2) { return; }
    met[w.key] = true;
    var a = mine[mine.length - 1], b = all.filter(function (c) { return c.id !== a.id; }).pop();
    meet(a, b, w.key);
  }

  function meet(a, b, key) {
    setUpStage();
    setUpCanvas();
    Promise.all([makeChimera(animalsOf(a), a.id, a), makeChimera(animalsOf(b), b.id, b), sharedLine(a, b),
                 a.title ? null : sentenceOf(a), b.title ? null : sentenceOf(b)]).then(function (g) {
      var A = g[0], B = g[1], line = g[2];
      a.title = a.title || (g[3] && g[3].text);
      b.title = b.title || (g[4] && g[4].text);
      ritual = { A: A, B: B, t0: performance.now(), key: key };
      var box = document.querySelector(".corpse-ritual") || el("section", "corpse-ritual");
      box.textContent = "";
      var cvs = el("canvas", "corpse-ritual-cv");
      cvs.width = 360;
      cvs.height = 120;
      cvs.setAttribute("aria-hidden", "true");
      box.appendChild(cvs);
      var words = el("div", "corpse-ritual-text");
      words.appendChild(el("p", "corpse-said", "Two chimeras meet in " + townName(key)));
      words.appendChild(el("p", "corpse-ritual-pair", "“" + (a.title || "") + "” · “" + (b.title || "") + "”"));
      var rite = el("p", "corpse-said corpse-rite");
      words.appendChild(rite);
      if (line) { words.appendChild(button(line.text, "corpse-door", function () { endRitual(); line.door(); })); }
      words.appendChild(button("Let them go", "read-quiet", endRitual));
      box.appendChild(words);
      ["pointerdown", "wheel", "touchstart"].forEach(function (t) { box.addEventListener(t, function (event) { event.stopPropagation(); }, { passive: true }); });
      box.hidden = false;
      if (!box.parentNode) { document.body.appendChild(box); }
      // The ritual of their heads' animals, as the characters' module performs it.
      if (A.real && B.real && window.Characters && typeof Characters.meet === "function") {
        try {
          Characters.meet(A.real, B.real).then(function (r) { if (r && r.said && ritual && ritual.A === A) { rite.textContent = r.said; } });
        } catch (e) { /* they stand facing */ }
      }
      var g2 = cvs.getContext("2d");
      (function tick(now) {
        if (!ritual || !box.isConnected || box.hidden) { return; }
        var t = (now - ritual.t0) / 1000;
        g2.clearRect(0, 0, 360, 120);
        // They come together, bow (the head part dips), and stand facing.
        var gap = Math.max(96, 170 - t * 40);
        var dip = t > 2 && t < 4.5 ? Math.sin((t - 2) * 2.5) : 0;
        var rit = t >= 2 && t < 6;
        if (A.parts || A.cut) { drawChimera(g2, A, 180 - gap / 2 - 30, 112 + Math.max(0, dip) * 3, A.cut ? 1.5 : 2, { t: t, walk: t < 2, ritual: rit }); }
        if (B.parts || B.cut) { drawChimera(g2, B, 180 + gap / 2 + 30, 112 + Math.max(0, -dip) * 3, B.cut ? 1.5 : 2, { t: t, walk: t < 2, ritual: rit, dir: -1 }); }
        if (t > 2) {
          g2.fillStyle = "#9d95e6";
          var r = ((t - 2) * 40) % 60;
          for (var q = 0; q < 6.283; q += 0.5) {
            g2.globalAlpha = 0.6 * (1 - r / 60);
            g2.fillRect(Math.round(180 + Math.cos(q) * r) - 2, Math.round(84 + Math.sin(q) * r * 0.4) - 2, 4, 4);
          }
          g2.globalAlpha = 1;
        }
        window.requestAnimationFrame(tick);
      })(performance.now());
    });
  }

  function endRitual() {
    if (ritual) {
      [ritual.A, ritual.B].forEach(function (x) { if (x && x.real) { try { x.real.close(); } catch (e) { /* gone */ } } });
    }
    ritual = null;
    var box = document.querySelector(".corpse-ritual");
    if (box) { box.hidden = true; }
  }

  /* ---- Find ----------------------------------------------------------------------------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");

  function asked(text) {
    var t = fold(text).trim();
    if (parse(t)) { return "code"; }
    if (/^(corpses?|exquisite( corpse)?|cadavre( exquis)?|chimeras?)$/.test(t)) { return "all"; }
    return null;
  }

  function row(text, fn) {
    var b = el("button", "finder-row finder-line", text);
    b.type = "button";
    b.addEventListener("click", function (event) { event.stopPropagation(); fn(); });
    return b;
  }

  function closeFinder() {
    var f = document.getElementById("finder"), b = document.getElementById("art-find");
    if (f && !f.hidden && b) { b.click(); }
  }

  function offerInFind() {
    if (!field || !found || found.querySelector(".corpse-found")) { return; }
    var text = field.value, kind = asked(text);
    if (!kind) { return; }
    load().then(function () {
      if (!D || field.value !== text || found.querySelector(".corpse-found")) { return; }
      var box = el("div", "corpse-found");
      box.appendChild(el("p", "finder-group", "The exquisite corpse"));
      if (kind === "code") {
        var c = decode(text);
        if (!c) { return; }
        if (c.stale) {
          box.appendChild(el("p", "finder-group finder-foot", "A corpse, but not one this map knows: made against an earlier map, or a letter out"));
        } else if (c.legs.length >= 3) {
          box.appendChild(row("Corpse · 3 legs · unfold it", function () { closeFinder(); begin(c); }));
        } else {
          var e = edgeOf(c), last = c.legs[c.legs.length - 1];
          var edge = last.a === "eagle" ? (e.y || "a year") + ", the rest mantled" : townName(e.k) + (e.y ? ", " + e.y : "");
          box.appendChild(row("Corpse · " + c.legs.length + " of 3 · its edge: " + edge + " · walk the next leg", function () { closeFinder(); begin(c); }));
        }
        found.insertBefore(box, found.firstChild);
        return;
      }
      box.appendChild(row("Start a corpse · from a published edge", function () { closeFinder(); startPublished(); }));
      var w = window.Land && Land.where ? Land.where() : {};
      if (w.key && town(w.key)) { box.appendChild(row("Begin one here · " + townName(w.key), function () { closeFinder(); beginHere(); })); }
      var dr = stored(DRAFT, null);
      if (dr && dr.corpse && dr.corpse.legs) {
        box.appendChild(row("Go on with yours · " + dr.corpse.legs.length + " of 3", function () {
          closeFinder();
          corpse = dr.corpse;
          if (dr.leg) { leg = dr.leg; leg.met = leg.met || []; render(); refresh(); } else { newLeg(); }
        }));
      }
      keptCorpses().slice().reverse().slice(0, 6).forEach(function (k) {
        box.appendChild(row("Yours: " + (k.title || "a corpse"), function () { closeFinder(); unfold(k); }));
      });
      (D.pub.made || []).forEach(function (m) {
        box.appendChild(row("Corpse: " + m.title + " · by " + m.by, function () {
          closeFinder();
          var c = allComplete().filter(function (x) { return x.id === m.id; })[0];
          if (c) { unfold(c); }
        }));
      });
      found.insertBefore(box, found.firstChild);
    });
  }

  /* ---- wiring ----------------------------------------------------------------------------- */

  window.addEventListener("pointermove", function (event) { pointer.x = event.clientX; pointer.y = event.clientY; pointer.at = performance.now(); }, { capture: true, passive: true });
  window.addEventListener("pointerdown", function (event) { pointer.x = event.clientX; pointer.y = event.clientY; }, { capture: true, passive: true });
  if (field) { field.addEventListener("input", function () { window.setTimeout(offerInFind, 340); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && asked(field.value)) { offerInFind(); } }).observe(found, { childList: true });
  }
  window.setInterval(function () {
    if (!D) { if (keptCorpses().length) { load(); } return; }
    pollRitual();
    var w = window.Land && Land.where ? Land.where() : {};
    if (wanted() || (w.key && wallowsAt(w.key))) { setUpCanvas(); kick(); }
    if (ritual && w.key !== ritual.key) { endRitual(); }
  }, 600);

  window.Corpse = {
    start: function (opts) { return load().then(function () { return startPublished(opts); }); },
    here: function () { return load().then(beginHere); },
    begin: function (c) { return load().then(function () { begin(c); }); },
    encode: function (c) { return load().then(function () { return encode(c); }); },
    decode: function (code) { return load().then(function () { return decode(code); }); },
    sentence: function (c) { return load().then(function () { return sentenceOf(c); }); },
    site: function () { return load().then(siteLeg); },
    _state: function () {
      return { corpse: corpse && { id: corpse.id, legs: corpse.legs.map(function (l) { return { a: l.a, by: l.by, stops: l.stops.length, buried: (l.buried || []).length }; }) },
               leg: leg && { a: leg.a, stops: leg.stops.slice(), met: leg.met },
               offers: lastOffers.map(function (o) { return { k: o.k, y: o.y, how: o.how, brg: Math.round(o.brg), km: Math.round(o.km) }; }),
               panel: panel && !panel.hidden ? panel.innerText : "",
               stage: stage && !stage.hidden ? stage.innerText : "",
               ritual: !!ritual, route: route && route.map(function (p) { return p.length; }),
               kept: keptCorpses().length, caches: stored(CACHES, []).length, trails: stored(TRAILS, []).length };
    }
  };
})();

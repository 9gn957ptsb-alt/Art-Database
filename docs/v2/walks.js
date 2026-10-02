/* The walks — following as a form of reading.

   The artist, 1 Oct 2026, on the idea "a trail you follow is an essay
   without words. Save a following as a route someone else can walk:
   'Twombly by fox, 32 cities'": "fantastic, really great stuff, implement
   that".

   A walk is a reading in sequence: whose animal, and its stops — a city,
   the works opened there in order, how long each was looked at. Three
   kinds, all listed in the animal's column while following (the follow
   box, land.js): the artist's own route, published for everyone
   (characters/walks.json, written by scripts/build_walks.py from the
   artist's map); the viewer's kept walks (localStorage, this browser only);
   and any walk typed into Find as a code.

   Recording. While someone follows an animal, the page quietly notes each
   city arrived in and each of the artist's works opened, and how long its
   history stayed open. When the following ends with two cities or more, a
   quiet line offers "Keep this walk", its title editable in place, and a
   short code.

   Walking one. The animal leads; the journey flies stop to stop; at each,
   it trots to the museum or gallery that holds the work, the stop's works
   come up one at a time with the first lines of their histories said like
   the reading's words, each looked at as long as it was looked at when the
   walk was kept (else a calm default: the median look at the Met, 17 s,
   Smith & Smith 2001, and a golden part again for its history), then on.
   The clock only moves while the pointer is still, as the reading's does.
   Pressing anything takes over (the walk waits: "Resume the walk"); going
   up to the world, or letting the animal go, ends it. Under reduced motion
   there is no clock: the stops are stepped through by hand.

   One link. The Artist Website's address never changes and nothing hands
   out a deep link, so a walk is passed on as a code, never a URL: the
   animal, then base 32 (Crockford's: no I, L, O or U) in fours —
   "fox·1A2B-…". It carries each stop as an index into the artist's cities
   (or, for a city off the artist's map, into cities.json's towns), each
   work as an index into the artist's works, each look in eight steps, and
   a check that says when the map has changed under it. Four cities with a
   work each is 18 characters. Pasted into Find, it is offered first:
   "Walk: Twombly by fox · 4 cities". Find also offers the published walks
   to "walks" or a cast artist's name ("Twombly") — the way in under
   reduced motion, where no animal comes out of the wave.

   A walk as a sentence (the artist, 1 Oct 2026, on "a walk as a sentence:
   each stop is a word and how long you linger is the punctuation": "A walk
   as a sentence is a great idea. Seeking the poetic aspect from the very
   forms defining a path of travel is directly applicable to continuing to
   find new ways to make interesting connections"). Each stop is a word,
   its city's name: the city is what the walk itself is made of, where a
   work's title is as often as not "Untitled" (61 of Twombly's 94). How
   long one lingers is the punctuation: where nothing was opened, a dash (a
   city passed through); less than two median looks (34 s, Smith & Smith's
   17 s twice), a comma; two or more, a full stop. The last word ends the
   sentence with a full stop, or with its dash. A line ends at a full stop
   and holds five words at most; a walk of three stops is a tercet, a line
   a stop, the haiku of cities (syllables are not counted: city names would
   strain any count). A city said again is a refrain, set in italics. As a
   walk is walked its sentence writes itself in the strip, a word on
   arriving and its stop when it is left; a finished walk, a following
   kept, and every walk in the animal's column are given as their
   sentences: "Rome, New York — London. / Munich, Munich." Two walks that
   end on the same city rhyme, and are offered as each other's rhyme; else
   two that share a word. */
(function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var STILL_MS = 1500;                 // as the reading: still, the pointer unmoved this long
  var LOOK = 17000 * PHI;              // a work's calm default, ms (17 s, the Met's median look, and φ)
  var LOOK_MIN = 9000;                 // never shorter than the work's own first look
  var SAY_AT = [4000, 11000, 20000];   // its title, then its history's first lines
  var TOWN_MS = 8000;                  // arrived, before the first work
  var EMPTY_MS = 13000;                // a stop with no work
  var BETWEEN_MS = 3000;               // back in the city, before going on
  var WAIT_MS = 30000;                 // a move that has not landed by now is passed over
  var KEEP_FOR = Math.pow(PHI, 6) * 1000;
  var LOOKS = [0, 9, 13, 17, 24, 34, 48, 68];   // seconds, the code's eight steps (0: the default)
  var B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var FULL_S = 34;                     // seconds: lingering this long is a full stop (two median looks)
  var LINE_WORDS = 5;                  // a line holds this many words at most
  var STORE = "walks.kept";

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var data = null;                     // { cast, artists, towns, townIx, published }
  var reading = null;
  var movedAt = 0;
  var rec = null;                      // the walk being recorded
  var fromWalk = false;                // following that a walk began is not recorded
  var walk = null;                     // the walk being walked
  var strip = null, stripP = null, stripSaid = null, stripActs = null, stripLines = null;
  var hideTimer = 0;
  var PACE = 1;                        // the checks walk faster (Walks._pace)

  /* ---- reading the files ------------------------------------------------- */

  function get(path) {
    return fetch(path).then(function (r) { if (!r.ok) { throw new Error(path); } return r.json(); });
  }

  function load() {
    if (reading) { return reading; }
    if (!window.Characters || !Characters.cast) { return Promise.resolve(null); }
    reading = Promise.all([Characters.cast(), Characters.artists(), get("cities.json"),
                           get("characters/walks.json").catch(function () { return { walks: [] }; }),
                           get("museums.json").catch(function () { return { museums: [] }; })])
      .then(function (got) {
        if (!got[0] || !got[1]) { reading = null; return null; }
        var townIx = {};
        got[2].towns.forEach(function (t, i) { townIx[t[0]] = i; });
        var mus = {};
        got[4].museums.forEach(function (m) { mus[m.slug] = m.name; });
        data = { cast: got[0], artists: got[1].artists, towns: got[2].towns, townIx: townIx,
                 published: got[3].walks || [], museums: mus };
        return data;
      }).catch(function () { reading = null; return null; });
    return reading;
  }

  function castBy(id) { return data && data.cast.filter(function (c) { return c.id === id; })[0]; }
  function castOf(artist) { return data && data.cast.filter(function (c) { return c.artist === artist; })[0]; }
  function mapOf(c) { return c && data.artists[c.artist]; }

  function surname(name) {
    var words = name.split(" "), k = words.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(words[k - 1])) { k -= 1; }
    return words.slice(k).join(" ");
  }

  function baseTitle(c) { return surname(c.artist) + " by " + c.name.split(" ").pop().toLowerCase(); }
  function cities(n) { return n + (n === 1 ? " city" : " cities"); }
  function autoTitle(w) { return baseTitle(castBy(w.animal)) + " · " + cities(w.stops.length); }

  function townName(key) {
    var i = data && data.townIx[key];
    return i === undefined ? key : data.towns[i][1];
  }

  function workOf(m, id) {
    var hit = null;
    m.works.forEach(function (w) { if (!hit && w[0] === id) { hit = w; } });
    return hit;
  }

  /* ---- the sentence --------------------------------------------------------- */

  function shortName(key) { return String(townName(key)).split(",")[0]; }

  // Seconds lingered at a stop: each work's look as kept, else the calm default; -1 if nothing was opened.
  function linger(st) {
    if (!st.works || !st.works.length) { return -1; }
    return st.works.reduce(function (a, id, k) { return a + (((st.s || [])[k]) || LOOK / 1000); }, 0);
  }

  /* The walk's words, each with its stop: [{w, p, refrain}], and its lines.
     `said` stops are given (all, by default); `closed` of them have their
     stop (all, by default) — while walking, the stop one is at is still open. */
  function sentence(w, said, closed) {
    var n = w.stops.length;
    said = said === undefined ? n : said;
    closed = closed === undefined ? said : closed;
    var seen = {}, words = [];
    for (var i = 0; i < said; i += 1) {
      var st = w.stops[i], L = linger(st);
      var p = L < 0 ? " —" : i === n - 1 || L >= FULL_S ? "." : ",";
      words.push({ w: shortName(st.key), p: i < closed ? p : "", refrain: !!seen[st.key] });
      seen[st.key] = true;
    }
    var lines = [], cur = [];
    words.forEach(function (x) {
      cur.push(x);
      if (n === 3 || x.p === "." || (cur.length >= LINE_WORDS && x.p)) { lines.push(cur); cur = []; }
    });
    if (cur.length) { lines.push(cur); }
    return lines;
  }

  function sentenceText(lines) {
    return lines.map(function (l) { return l.map(function (x) { return x.w + x.p; }).join(" "); }).join(" / ");
  }

  // The sentence as lines of the serif; a refrain in italics; the newest word arriving.
  function sentenceEl(lines, cls, fresh) {
    var box = document.createElement("div");
    box.className = "walk-sentence" + (cls ? " " + cls : "");
    lines.forEach(function (l, li) {
      var line = document.createElement("p");
      line.className = "walk-line";
      l.forEach(function (x, k) {
        var word = document.createElement(x.refrain ? "em" : "span");
        word.className = "walk-word";
        word.textContent = x.w;
        if (fresh && li === lines.length - 1 && k === l.length - 1) { word.dataset.fresh = "true"; }
        line.appendChild(word);
        if (x.p) { line.appendChild(document.createTextNode(x.p)); }
        if (k < l.length - 1) { line.appendChild(document.createTextNode(" ")); }
      });
      box.appendChild(line);
    });
    return box;
  }

  function lastKey(w) { return w.stops.length ? w.stops[w.stops.length - 1].key : null; }

  /* Its rhyme: another walk (another animal's first) that ends on the same
     city; else one that shares a word, the rarest shared word first. */
  function rhymeFor(w) {
    if (!data) { return null; }
    var pool = data.published.concat(kept()).filter(function (x) {
      return x.id !== w.id && x.title !== w.title && x.stops && x.stops.length;
    });
    pool.sort(function (a, b) { return (a.animal === w.animal) - (b.animal === w.animal); });
    var end = lastKey(w);
    var hit = pool.filter(function (x) { return lastKey(x) === end; })[0];
    if (hit) { return { walk: hit, how: "rhymes on " + shortName(end) }; }
    var mine = {};
    w.stops.forEach(function (st) { mine[st.key] = true; });
    var best = null;
    pool.forEach(function (x) {
      x.stops.forEach(function (st) {
        if (!mine[st.key]) { return; }
        var used = pool.filter(function (y) { return y.stops.some(function (z) { return z.key === st.key; }); }).length;
        if (!best || used < best.used) { best = { walk: x, key: st.key, used: used }; }
      });
    });
    return best && { walk: best.walk, how: "shares " + shortName(best.key) };
  }

  function rhymeButton(w) {
    var r = rhymeFor(w);
    if (!r) { return null; }
    var t = r.walk.title;
    return button("Its rhyme: " + t + " · " + r.how, "walk-rhyme", function () { play(r.walk); });
  }

  /* ---- kept walks (this browser only) -------------------------------------- */

  function kept() {
    try { var s = window.localStorage.getItem(STORE); return s ? JSON.parse(s) : []; } catch (e) { return []; }
  }
  function keepAll(list) {
    try { window.localStorage.setItem(STORE, JSON.stringify(list.slice(-34))); } catch (e) { /* kept for this visit only */ }
  }

  /* ---- the code ------------------------------------------------------------

     Bits, most significant first: version (2), check (5), stops (6); each
     stop a flag (1: 0 the artist's cities, 1 cities.json's towns) and its
     index, its works (3), each work's index into the artist's works and its
     look (3). Widths are what the lists need now; the check (a hash of the
     cities' keys and the works' ids) says when they have moved. */

  function bitsFor(n) { return Math.max(1, Math.ceil(Math.log(Math.max(2, n)) / Math.LN2)); }

  function check(w) {
    var s = w.animal + "|" + w.stops.map(function (st) { return st.key + ":" + st.works.join(","); }).join("|");
    var h = 2166136261;
    for (var i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h & 31;
  }

  function lookStep(s) {
    if (!s) { return 0; }
    var best = 1;
    for (var k = 1; k < LOOKS.length; k += 1) { if (Math.abs(LOOKS[k] - s) < Math.abs(LOOKS[best] - s)) { best = k; } }
    return best;
  }

  function encode(w) {
    var c = castBy(w.animal), m = mapOf(c);
    if (!m) { return null; }
    var mapIx = {};
    m.places.forEach(function (r, i) { mapIx[r[0]] = i; });
    var workIx = {};
    m.works.forEach(function (x, i) { workIx[x[0]] = i; });
    var mb = bitsFor(m.places.length), tb = bitsFor(data.towns.length), wb = bitsFor(m.works.length);
    var bits = [];
    function put(v, n) { for (var k = n - 1; k >= 0; k -= 1) { bits.push((v >> k) & 1); } }
    var stops = w.stops.slice(0, 63);
    put(1, 2);
    put(check({ animal: w.animal, stops: stops }), 5);
    put(stops.length, 6);
    for (var i = 0; i < stops.length; i += 1) {
      var st = stops[i];
      if (mapIx[st.key] !== undefined) { put(0, 1); put(mapIx[st.key], mb); }
      else if (data.townIx[st.key] !== undefined) { put(1, 1); put(data.townIx[st.key], tb); }
      else { return null; }
      var ws = st.works.filter(function (id) { return workIx[id] !== undefined; }).slice(0, 7);
      put(ws.length, 3);
      ws.forEach(function (id) { put(workIx[id], wb); put(lookStep((st.s || [])[st.works.indexOf(id)]), 3); });
    }
    while (bits.length % 5) { bits.push(0); }
    var out = "";
    for (var b = 0; b < bits.length; b += 5) {
      out += B32.charAt(bits[b] * 16 + bits[b + 1] * 8 + bits[b + 2] * 4 + bits[b + 3] * 2 + bits[b + 4]);
    }
    return w.animal + "·" + out.match(/.{1,4}/g).join("-");
  }

  // A code as typed or pasted: any case, any separator, Crockford's look-alikes.
  function parse(text) {
    var m = /^\s*([a-z]+)\s*[·.\-:\s/]+\s*([0-9a-z][0-9a-z\-\s]{6,})\s*$/i.exec(String(text || ""));
    return m && { animal: m[1].toLowerCase(), body: m[2].toUpperCase().replace(/[\s\-]/g, "")
      .replace(/O/g, "0").replace(/[IL]/g, "1") };
  }

  function decode(text) {
    var p = parse(text);
    if (!p || !data) { return null; }
    var c = castBy(p.animal), m = mapOf(c);
    if (!m) { return null; }
    var bits = [];
    for (var i = 0; i < p.body.length; i += 1) {
      var v = B32.indexOf(p.body.charAt(i));
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
    var sum = take(5), n = take(6);
    var mb = bitsFor(m.places.length), tb = bitsFor(data.towns.length), wb = bitsFor(m.works.length);
    var stops = [];
    for (var s = 0; s < n && !bad; s += 1) {
      var key = take(1) ? (data.towns[take(tb)] || [])[0] : (m.places[take(mb)] || [])[0];
      var nw = take(3), ids = [], looks = [];
      for (var j = 0; j < nw; j += 1) {
        var w = m.works[take(wb)];
        var look = LOOKS[take(3)];
        if (w) { ids.push(w[0]); looks.push(look); }
      }
      if (!key) { bad = true; }
      stops.push({ key: key, works: ids, s: looks });
    }
    // A code is exactly as long as its walk: anything longer is not one.
    if (bad || !stops.length || bits.length - at >= 5) { return null; }
    var walked = { id: "code-" + p.body, animal: c.id, artist: c.artist, by: "a visitor", stops: stops };
    walked.title = autoTitle(walked);
    walked.code = c.id + "·" + p.body.match(/.{1,4}/g).join("-");
    walked.stale = check(walked) !== sum;
    return walked;
  }

  /* ---- the strip: the walk's progress, what is said, and the offer ------- */

  function setUp() {
    if (strip) { return; }
    strip = document.createElement("section");
    strip.className = "walk-strip";
    strip.hidden = true;
    strip.setAttribute("aria-label", "The walk");
    stripP = document.createElement("p");
    stripP.className = "walk-progress";
    stripSaid = document.createElement("p");
    stripSaid.className = "walk-said";
    stripSaid.setAttribute("aria-live", "polite");
    stripActs = document.createElement("div");
    stripActs.className = "walk-acts";
    stripLines = document.createElement("div");
    stripLines.className = "walk-lines";
    strip.appendChild(stripP);
    strip.appendChild(stripLines);
    strip.appendChild(stripSaid);
    strip.appendChild(stripActs);
    // Its own presses: neither the stage's, nor a press that takes over the walk.
    ["pointerdown", "wheel", "keydown"].forEach(function (t) {
      strip.addEventListener(t, function (event) { event.stopPropagation(); }, { passive: t === "wheel" });
    });
    document.body.appendChild(strip);
  }

  function button(text, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "walk-act " + (cls || "");
    b.textContent = text;
    b.addEventListener("click", function (event) { event.stopPropagation(); fn(); });
    return b;
  }

  function show(progress, said, acts, forMs) {
    setUp();
    window.clearTimeout(hideTimer);
    stripP.textContent = progress || "";
    if (said !== undefined) { setSaid(said); }
    stripActs.textContent = "";
    (acts || []).forEach(function (a) { stripActs.appendChild(a); });
    strip.hidden = false;
    if (forMs) { hideTimer = window.setTimeout(hide, forMs); }
  }

  // The sentence in the strip: while walking, its last three lines, writing themselves.
  function setLines(lines, fresh, all) {
    setUp();
    stripLines.textContent = "";
    if (!lines || !lines.length) { return; }
    stripLines.appendChild(sentenceEl(all ? lines : lines.slice(-3), all ? "walk-sentence-whole" : "", fresh));
  }

  function setSaid(text) {
    if (!stripSaid) { return; }
    stripSaid.dataset.on = "";
    stripSaid.textContent = text || "";
    if (text) { window.requestAnimationFrame(function () { stripSaid.dataset.on = "true"; }); }
  }

  function hide() { if (strip) { strip.hidden = true; } }

  /* ---- recording ---------------------------------------------------------- */

  function poll() {
    if (!window.Land || !Land.where) { return; }
    var f = Land.following();
    if (walk) { watchWalk(f); return; }
    if (!f) {
      if (rec) { finish(rec); rec = null; }
      fromWalk = false;
      return;
    }
    if (fromWalk) { return; }
    if (!rec) {
      if (!data) { load(); return; }
      var c = castOf(f.artist);
      if (!c) { return; }
      var ids = {};
      mapOf(c).works.forEach(function (w) { ids[w[0]] = true; });
      rec = { animal: c.id, artist: c.artist, stops: [], ids: ids, open: null };
    }
    var w = Land.where(), now = performance.now();
    if (w.flying) { return; }
    if (rec.open && !(w.at === "work" && w.work === rec.open.id)) {
      var o = rec.open, st = rec.stops[o.stop];
      if (st) { st.s[o.k] = Math.round(((st.s[o.k] || 0) * 1000 + now - o.since) / 1000); }
      rec.open = null;
    }
    var last = rec.stops[rec.stops.length - 1];
    if ((w.at === "town" || w.at === "museum") && w.key && (!last || last.key !== w.key)) {
      rec.stops.push({ key: w.key, works: [], s: [] });
    } else if (w.at === "work" && rec.ids[w.work] && !rec.open) {
      var si = rec.stops.length - 1;
      for (var i = rec.stops.length - 1; i >= 0; i -= 1) { if (rec.stops[i].key === w.key) { si = i; break; } }
      if (si < 0) { return; }
      var stp = rec.stops[si], k = stp.works.indexOf(w.work);
      if (k < 0) { stp.works.push(w.work); stp.s.push(0); k = stp.works.length - 1; }
      rec.open = { id: w.work, stop: si, k: k, since: now };
    }
  }

  // Following over: with two cities or more, the walk is offered.
  function finish(r) {
    if (r.open) {
      var st = r.stops[r.open.stop];
      if (st) { st.s[r.open.k] = Math.round(((st.s[r.open.k] || 0) * 1000 + performance.now() - r.open.since) / 1000); }
    }
    if (r.stops.length < 2) { return; }
    var w = { id: "k" + Date.now().toString(36), animal: r.animal, artist: r.artist, by: "a visitor",
              stops: r.stops.map(function (s) { return { key: s.key, works: s.works, s: s.s }; }) };
    w.title = autoTitle(w);
    offer(w);
  }

  function offer(w) {
    var field = document.createElement("input");
    field.type = "text";
    field.className = "walk-title";
    field.value = w.title;
    field.setAttribute("aria-label", "The walk's title");
    field.spellcheck = false;
    var keep = button("Keep this walk", "walk-keep", function () {
      w.title = field.value.trim() || autoTitle(w);
      w.code = encode(w);
      var list = kept();
      list.push(w);
      keepAll(list);
      keptShown(w, field);
    });
    // Editing holds it; left alone, it goes quietly.
    field.addEventListener("focus", function () { window.clearTimeout(hideTimer); });
    show("", "", [field, keep, button("×", "walk-x", hide)], KEEP_FOR);
    stripP.textContent = "The way you followed · " + cities(w.stops.length);
    setLines(sentence(w), false, true);
  }

  function keptShown(w, field) {
    var code = document.createElement("span");
    code.className = "walk-code";
    code.textContent = w.code || "";
    code.title = "Pass it on: typed into Find, it is this walk";
    var copy = button("Copy", "walk-copy", function () {
      try {
        navigator.clipboard.writeText(w.code).then(function () { copy.textContent = "Copied"; }, function () {});
      } catch (e) { /* the code can be selected by hand */ }
    });
    field.addEventListener("input", function () {
      var list = kept();
      list.forEach(function (k) { if (k.id === w.id) { k.title = field.value.trim() || autoTitle(w); } });
      keepAll(list);
    });
    var rh = rhymeButton(w);
    show("Kept · " + cities(w.stops.length), "Typed into Find, the code is the walk, for anyone.",
         [field, code, copy].concat(rh ? [rh] : []).concat([button("×", "walk-x", hide)]), KEEP_FOR * PHI);
    setLines(sentence(w), false, true);
  }

  /* ---- walking ------------------------------------------------------------ */

  // As the reading's afterStill: the clock waits while the pointer moves.
  function afterStill(fn, ms) {
    var token = walk;
    if (!token) { return; }
    function tick() {
      if (walk !== token || token.paused) { return; }
      var moved = performance.now() - movedAt;
      if (moved < STILL_MS) { token.timers.push(window.setTimeout(tick, STILL_MS - moved + 80)); return; }
      fn();
    }
    token.timers.push(window.setTimeout(tick, ms * PACE));
  }

  function waitFor(test, fn, ms) {
    var token = walk, until = performance.now() + (ms || WAIT_MS);
    function tick() {
      if (walk !== token || token.paused) { return; }
      var w = Land.where();
      if (!w.flying && test(w)) { fn(true); return; }
      if (performance.now() > until) { fn(false); return; }
      token.timers.push(window.setTimeout(tick, 250));
    }
    tick();
  }

  function clearTimers() {
    if (!walk) { return; }
    walk.timers.forEach(function (t) { window.clearTimeout(t); });
    walk.timers = [];
  }

  function stopOf() { return walk.w.stops[walk.i]; }
  function atStop(w) { return (w.at === "town" || w.at === "museum") && w.key === stopOf().key; }

  function progress() {
    var n = walk.w.stops.length;
    return (walk.paused ? "Paused · " : "") + (walk.i + 1) + " of " + n + " · " + townName(stopOf().key);
  }

  function acts() {
    if (still) {
      var list = [];
      if (walk.i > 0) { list.push(button("← Before", "", function () { stepTo(walk.i - 1); })); }
      if (walk.i + 1 < walk.w.stops.length) { list.push(button("Next stop →", "", function () { stepTo(walk.i + 1); })); }
      var m = walk.map;
      stopOf().works.forEach(function (id) {
        var x = workOf(m, id);
        list.push(button((x ? x[1] : "A work") + (x && x[3] ? ", " + x[3] : ""), "walk-work",
                         function () { Land.work(id, stopOf().key); }));
      });
      list.push(button("End the walk", "walk-end", function () { end("ended"); }));
      return list;
    }
    if (walk.paused) {
      return [button("Resume the walk", "walk-resume", resume), button("End", "walk-end", function () { end("ended"); })];
    }
    return [button("End", "walk-end", function () { end("ended"); })];
  }

  function told(said) { show(progress(), said, acts()); }

  /* opts (explorations.js, the relay): from, the stop to join it at; onEnd,
     told when it ends ("done", "up", "away", "ended") with the walk. */
  function play(w, opts) {
    if (!w || !w.stops || !w.stops.length) { return; }
    opts = opts || {};
    load().then(function () {
      var c = castBy(w.animal);
      if (!c || !window.Land || !Land.where) { return; }
      var f0 = Land.following();
      if (f0 && f0.artist !== c.artist) { Land.unfollow(); }
      if (walk) { clearTimers(); walk = null; }
      if (rec && rec.stops.length >= 2) { finish(rec); }
      rec = null;
      return Characters.lead(c.id).then(function (f) {
        if (!f) { return; }
        fromWalk = true;
        var from = Math.max(0, Math.min(w.stops.length - 1, opts.from || 0));
        walk = { w: w, i: from, j: -1, map: f.map, timers: [], paused: false, down: false, said: [], upto: from, closed: from,
                 onEnd: opts.onEnd || null };
        setLines([]);
        told(w.title + (w.by ? " · by " + w.by : "") + (from ? " · joined at stop " + (from + 1) + " of " + w.stops.length : ""));
        var first = w.stops[from].key;
        if (Land.following()) { goStop(from, -1); }
        else { f.to = first; Land.follow(f); waitArrive(-1); }
      });
    });
  }

  function goStop(i, j) {
    walk.i = i;
    walk.j = -1;
    told("");
    var w = Land.where();
    if (!w.flying && atStop(w)) { arrived(j); return; }
    // The way on, told from afar while it is travelled (voice.js says it beside the journey).
    voiceSay({ path: "walk", step: "journey", key: stopOf().key, place: shortName(stopOf().key), f: { animal: animalWord() } });
    waitFor(function (x) { return !x.flying; }, function () {
      if (!atStop(Land.where())) { Land.go(stopOf().key); }
      waitArrive(j);
    }, 15000);
  }

  function waitArrive(j) {
    waitFor(atStop, function (ok) {
      if (!ok) { next(); return; }
      arrived(j);
    });
  }

  // Arrived: the animal trots to where the work is held; then the works.
  function arrived(j) {
    walk.down = true;
    voiceSay({ path: "follow", step: "city", key: stopOf().key, place: shortName(stopOf().key), f: { animal: animalWord() } });
    // A word on arriving.
    if (walk.upto < walk.i + 1) {
      walk.upto = walk.i + 1;
      walk.closed = Math.min(walk.closed, walk.i);
      setLines(sentence(walk.w, walk.upto, walk.closed), true);
    }
    if (still) { told(waitsBy()); return; }
    told(waitsBy());
    var st = stopOf();
    if (j >= 0 && j < st.works.length) { openWork(j); return; }
    if (!st.works.length) { afterStill(next, EMPTY_MS); return; }
    afterStill(function () { openWork(0); }, TOWN_MS);
  }

  function waitsBy() {
    var st = stopOf(), row = null;
    walk.map.places.forEach(function (r) { if (!row && r[0] === st.key) { row = r; } });
    var wait = row && row[7];
    var name = wait && (wait[0] === "m" ? data.museums[wait[1]] : wait[1]);
    var animal = castBy(walk.w.animal).name.split(" ").pop().toLowerCase();
    var n = st.works.length;
    // Under reduced motion no animal is drawn: the place is only named.
    return (name ? (still ? "At " : "The " + animal + " waits by ") + name + " · " : "") +
      (n ? n + (n === 1 ? " work" : " works") + " here" : "nothing opened here: a city passed through");
  }

  function openWork(j) {
    var st = stopOf(), id = st.works[j];
    walk.j = j;
    var w = Land.where();
    if (!(w.at === "work" && w.work === id)) { Land.work(id, st.key); }
    waitFor(function (x) { return x.at === "work" && x.work === id; }, function (ok) {
      if (!ok) { afterWork(); return; }
      shown(j);
    });
  }

  // A work: its title, then its history's first lines, on the reading's clock.
  function shown(j) {
    var st = stopOf(), id = st.works[j], x = workOf(walk.map, id);
    var look = (st.s || [])[j] ? Math.max(LOOK_MIN, st.s[j] * 1000) : LOOK;
    told("");
    var lines = [(x ? x[1] : "Untitled") + (x && x[3] ? ", " + x[3] : "")];
    get("histories/" + id + ".json").then(function (h) { lines = lines.concat(firstLines(h)); }, function () {});
    // The voice it is told in (voice.js, VOICE.md): close by, with the animal; where it was painted, there.
    voiceSay({ path: "walk", step: "work", key: st.key, place: shortName(st.key),
               f: { animal: animalWord(), title: x ? x[1] : "Untitled" } });
    SAY_AT.forEach(function (at, k) {
      if (at > look - 3000 && k) { return; }
      afterStill(function () {
        if (lines[k]) { setSaid(lines[k]); }
        if (k === 2) { voiceSay({ path: "walk", step: "site", key: st.key }); }
      }, at);
    });
    afterStill(afterWork, look);
  }
  function voiceSay(v) { if (window.Voice && Voice.said) { Voice.said(v); } }
  function animalWord() {
    var c = walk && castBy(walk.w.animal);
    return c ? "The " + c.name.toLowerCase() : "";
  }

  var KIND = { made: "Made", owned: "Owned", held: "Held", listed: "Listed", exhibited: "Shown",
               offered: "Offered", sold: "Sold", written: "Written" };

  /* The first two of its history that say something, in its own order:
     "Shown 1993 · Cy Twombly Photographs, another example exhibited · New
     York". A listing or a sale offered only when nothing else is said. */
  function firstLines(h) {
    var all = (h.events || []).filter(function (e) { return e.t || e.v || e.who; });
    var ev = all.filter(function (e) { return e.k !== "listed" && e.k !== "offered"; });
    if (ev.length < 2) { ev = ev.concat(all.filter(function (e) { return e.k === "listed" || e.k === "offered"; })); }
    var out = [], seen = {};
    ev.forEach(function (e) {
      if (out.length >= 2) { return; }
      var head = [KIND[e.k] || "", String(e.y || "").slice(0, 4)].filter(Boolean).join(" ");
      var what = [e.t || e.v || e.who, e.n].filter(Boolean).join(", ");
      var where = String(e.w || "").split(",")[0];
      var line = [head, what, where].filter(Boolean).join(" · ");
      if (line.length > 140) { line = line.slice(0, 137).replace(/\s+\S*$/, "") + " …"; }
      if (!seen[line]) { seen[line] = true; out.push(line); }
    });
    return out;
  }

  function afterWork() {
    var st = stopOf();
    if (walk.j + 1 < st.works.length) { openWork(walk.j + 1); return; }
    // Back in the city, the animal sits by the door a while; then on.
    if (Land.where().at === "work") { Land.up(); }
    waitFor(atStop, function () { told(""); afterStill(next, BETWEEN_MS); }, 12000);
  }

  function next() {
    // Its stop on leaving: a comma, a full stop, a dash.
    walk.closed = Math.max(walk.closed, walk.i + 1);
    walk.upto = Math.max(walk.upto, walk.i + 1);
    setLines(sentence(walk.w, walk.upto, walk.closed), false);
    if (walk.i + 1 >= walk.w.stops.length) { done(); return; }
    goStop(walk.i + 1, -1);
  }

  function done() {
    var w = walk.w, onEnd = walk.onEnd;
    clearTimers();
    walk = null;
    // In a relay (explorations.js) the next leg goes on from here.
    if (onEnd && onEnd("done", w)) { hide(); return; }
    var rh = rhymeButton(w);
    // The relay: the explorations that begin (or pass) where this one ended.
    var on = window.Explorations && Explorations.handoffs ? Explorations.handoffs({ walk: w }) : null;
    show("Walked · " + w.title, "The animal is still yours to follow.",
         [button("Walk it again", "", function () { play(w); })].concat(rh ? [rh] : []).concat(on ? [on] : [])
           .concat([button("×", "walk-x", hide)]), KEEP_FOR);
    setLines(sentence(w), false, true);
  }

  function stepTo(i) {
    walk.closed = Math.max(walk.closed, Math.min(i, walk.i + 1));
    walk.i = i;
    walk.j = -1;
    told("");
    Land.go(stopOf().key);
  }

  function pause() {
    if (!walk || walk.paused || still) { return; }
    walk.paused = true;
    clearTimers();
    told(undefined);
  }

  function resume() {
    if (!walk || !walk.paused) { return; }
    walk.paused = false;
    var st = stopOf(), w = Land.where(), j = walk.j;
    if (w.at === "work" && j >= 0 && w.work === st.works[j]) { told(""); shown(j); return; }
    if (!w.flying && atStop(w)) { arrived(j); return; }
    goStop(walk.i, j);
  }

  function end(why) {
    if (!walk) { return; }
    var w = walk.w, i = walk.i, onEnd = walk.onEnd;
    clearTimers();
    walk = null;
    // In a relay (explorations.js) the exploration says how it ended.
    if (onEnd) { onEnd(why, w); hide(); return; }
    show("The walk ends · " + (i + 1) + " of " + w.stops.length,
         why === "up" ? "Up to the world." : why === "away" ? "The animal was let go." : "", [], 6000);
  }

  // Each poll while walking: ended by going up, or by letting the animal go.
  function watchWalk(f) {
    var w = Land.where();
    // Going up ends the following first; letting go does not fly.
    if (!f) { end(w.flying || w.at === "world" ? "up" : "away"); return; }
    if (w.at !== "world" && w.at !== "flying") { walk.down = true; }
    if (w.at === "world" && walk.down) { end("up"); }
  }

  /* ---- in the animal's column: the walks ---------------------------------- */

  function walksFor(c) {
    var list = data.published.filter(function (w) { return w.animal === c.id; });
    if (!list.length) {
      // walks.json unread: the route straight from the artist's map.
      var m = mapOf(c);
      list = [{ id: c.id + "-route", title: baseTitle(c), artist: c.artist, animal: c.id, by: "the route",
                stops: m.places.map(function (r) { var ids = r[5].slice(0, 3).map(function (i) { return m.works[i][0]; });
                  return { key: r[0], works: ids, s: ids.map(function () { return 0; }) }; }) }];
    }
    return list.concat(kept().filter(function (w) { return w.animal === c.id; }).reverse());
  }

  function walksBox(box) {
    if (box.querySelector(".walks")) { return; }
    var f = window.Land && Land.following();
    if (!f) { return; }
    load().then(function () {
      var c = data && castOf(f.artist);
      if (!c || box.querySelector(".walks")) { return; }
      var sec = document.createElement("div");
      sec.className = "walks";
      var head = document.createElement("p");
      head.className = "town-section";
      head.textContent = "Walks";
      sec.appendChild(head);
      walksFor(c).forEach(function (w) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "walk-row";
        var t = document.createElement("span");
        t.className = "walk-row-title";
        t.textContent = /\bcit(y|ies)\b/.test(w.title) ? w.title : w.title + " · " + cities(w.stops.length);
        b.appendChild(t);
        var meta = document.createElement("span");
        meta.className = "walk-row-by";
        meta.textContent = w.by === "the route" ? "by the route" : w.code ? "kept · " + w.code : "kept";
        b.appendChild(meta);
        // Its sentence, the first two lines of it.
        var lines = sentence(w);
        var sent = sentenceEl(lines.slice(0, 2), "walk-row-sentence");
        if (lines.length > 2) { sent.lastChild.appendChild(document.createTextNode(" …")); }
        b.appendChild(sent);
        b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
        b.addEventListener("click", function (event) { event.stopPropagation(); play(w); });
        sec.appendChild(b);
      });
      var away = box.querySelector(".follow-away");
      box.insertBefore(sec, away || null);
    });
  }

  /* ---- Find: a code typed or pasted is offered first ---------------------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");
  var said = document.getElementById("finder-said");

  /* What Find is asked that a walk answers: a code (that walk, first); or
     "walk", "walks", or the start of a cast artist's name (the published
     walks, which is also how a walk is reached under reduced motion, where
     no animal comes out of the wave to be followed). */
  function asked(text) {
    var t = String(text || "").toLowerCase().trim();
    if (parse(t)) { return "code"; }
    if (/^walks?$/.test(t)) { return "walks"; }
    if (t.length >= 4 && data && data.cast.some(function (c) { return surname(c.artist).toLowerCase().indexOf(t) === 0; })) { return "walks"; }
    return null;
  }

  function foundRow(w) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "finder-row finder-line";
    b.textContent = "Walk: " + (/\bcit(y|ies)\b/.test(w.title) ? w.title : w.title + " · " + cities(w.stops.length));
    b.addEventListener("click", function () { play(w); });
    return b;
  }

  function offerInFind() {
    if (!field || !found || found.querySelector(".walk-found")) { return; }
    var text = field.value;
    if (!parse(text) && !data) { load().then(function () { if (data && asked(text)) { offerInFind(); } }); return; }
    var kind = asked(text);
    if (!kind) { return; }
    load().then(function () {
      if (field.value !== text || found.querySelector(".walk-found")) { return; }
      var box = document.createElement("div");
      box.className = "walk-found";
      var head = document.createElement("p");
      head.className = "finder-group";
      box.appendChild(head);
      if (kind === "walks") {
        var t = text.toLowerCase().trim();
        var list = data.published.filter(function (w) {
          return /^walks?$/.test(t) || surname(w.artist).toLowerCase().indexOf(t) === 0;
        });
        if (!list.length) { return; }
        head.textContent = "Walks";
        list.forEach(function (w) { box.appendChild(foundRow(w)); });
        found.insertBefore(box, found.firstChild);
        return;
      }
      var w = decode(text);
      if (!w) { return; }
      head.textContent = "A walk";
      // A code whose check fails was kept against an earlier map (or mistyped): said, not walked.
      if (w.stale) {
        var p = document.createElement("p");
        p.className = "finder-group finder-foot";
        p.textContent = "A walk code, but not one this map knows: kept against an earlier map, or a letter out";
        box.appendChild(p);
      } else {
        box.appendChild(foundRow(w));
      }
      found.insertBefore(box, found.firstChild);
      if (said && !w.stale) { said.textContent = "Found · a walk of " + cities(w.stops.length); }
    });
  }

  /* ---- wiring ------------------------------------------------------------- */

  window.addEventListener("pointermove", function () { movedAt = performance.now(); }, { capture: true, passive: true });
  // Pressing anything takes over: the walk waits.
  window.addEventListener("pointerdown", function (event) {
    movedAt = performance.now();
    if (walk && !(strip && strip.contains(event.target))) { pause(); }
  }, true);
  window.addEventListener("wheel", function (event) {
    if (walk && !(strip && strip.contains(event.target))) { pause(); }
  }, { capture: true, passive: true });
  window.addEventListener("keydown", function (event) {
    if (!walk || (strip && strip.contains(event.target)) || /^(Shift|Control|Alt|Meta|Tab)$/.test(event.key)) { return; }
    pause();
  }, true);

  window.setInterval(poll, 400);

  var col = document.getElementById("art-col");
  if (col && window.MutationObserver) {
    new MutationObserver(function () {
      var box = col.querySelector(".follow-box");
      if (box) { walksBox(box); }
    }).observe(col, { childList: true });
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offerInFind, 300); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && asked(field.value)) { offerInFind(); } })
      .observe(found, { childList: true });
  }

  /* The strips (a walk's, an exploration's and its relay's offers) stand
     clear of the work's picture in the art view, and of the column beside
     it: where they are if nothing is in the way; else narrowed to the room
     left of the picture, else beside it on the right (short of the column),
     else under it, else at the foot of the window. At least 180 px wide.
     Checked twice a second while one shows. */
  function clearOfPicture() {
    var strips = document.querySelectorAll(".walk-strip");
    var pic = document.getElementById("art-plate");
    var r = pic && !pic.hidden ? pic.getBoundingClientRect() : null;
    if (r && (!r.width || !r.height)) { r = null; }
    var colEl = document.querySelector(".art[data-on=\"true\"] .art-body");
    var col = colEl && window.getComputedStyle(colEl).visibility !== "hidden" ? colEl.getBoundingClientRect() : null;
    var colLeft = col && col.width && col.left > (r ? r.right : 0) ? col.left : window.innerWidth - 16;
    // The reading layout (land.js, voice.js): the picture, its sentence, the lens and the dial are
    // the view; the strip keeps to the foot — under the dial on a desktop, over the text on a phone.
    var rd = window.Land && Land.reading ? Land.reading() : null;
    var dialEl = document.getElementById("art-time");
    var dial = dialEl && !dialEl.hidden ? dialEl.getBoundingClientRect() : null;
    Array.prototype.forEach.call(strips, function (st) {
      if (st.hidden) { return; }
      st.style.maxWidth = ""; st.style.top = ""; st.style.bottom = ""; st.style.left = "";
      if (rd && rd.lens && !rd.full) {
        st.style.top = "auto";
        st.style.bottom = "12px";
        if (rd.phone) { st.style.left = "12px"; st.style.maxWidth = (window.innerWidth - 24) + "px"; return; }
        var colBox = document.getElementById("art-col"), cb = colBox ? colBox.getBoundingClientRect() : null;
        var left = rd.cap.x + rd.cap.w + 16, right = (cb && cb.width ? cb.left : colLeft) - 12;
        var sh = st.getBoundingClientRect().height || 96;
        if (dial && dial.width && dial.bottom + 8 > window.innerHeight - 12 - sh) { left = Math.max(left, dial.right + 12); }
        st.style.left = Math.round(left) + "px";
        st.style.maxWidth = Math.max(220, Math.floor(right - left)) + "px";
        return;
      }
      if (!r) { return; }
      var hit = function () {
        var b = st.getBoundingClientRect();
        return b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom;
      };
      if (!hit()) { return; }
      var b0 = st.getBoundingClientRect();
      if (r.left - b0.left - 12 >= 180) { st.style.maxWidth = Math.floor(r.left - b0.left - 12) + "px"; if (!hit()) { return; } }
      st.style.maxWidth = "";
      if (colLeft - r.right - 24 >= 180) {
        st.style.left = Math.round(r.right + 12) + "px";
        st.style.maxWidth = Math.floor(Math.min(380, colLeft - r.right - 24)) + "px";
        if (!hit()) { return; }
      }
      st.style.left = ""; st.style.maxWidth = "";
      if (r.bottom + 8 + b0.height <= window.innerHeight - 16) { st.style.top = Math.round(r.bottom + 8) + "px"; return; }
      st.style.top = "auto";
      st.style.bottom = "16px";
    });
  }
  window.setInterval(function () { if (document.querySelector(".walk-strip:not([hidden])")) { clearOfPicture(); } }, 500);

  window.Walks = {
    play: play,
    kept: kept,
    walking: function () { return !!walk; },
    encode: function (w) { return load().then(function () { return encode(w); }); },
    decode: function (code) { return load().then(function () { return decode(code); }); },
    // A walk's sentence, as text ("Rome, New York — London. / Munich, Munich."), and its rhyme.
    sentence: function (w) { return load().then(function () { return sentenceText(sentence(w)); }); },
    rhyme: function (w) { return load().then(function () { var r = rhymeFor(w); return r && { title: r.walk.title, how: r.how }; }); },
    _pace: function (k) { PACE = k; },
    _state: function () {
      return { walking: walk && { title: walk.w.title, i: walk.i, j: walk.j, n: walk.w.stops.length, paused: walk.paused,
                                  sentence: data ? sentenceText(sentence(walk.w, walk.upto, walk.closed)) : "" },
               recording: rec && { stops: rec.stops.map(function (s) { return [s.key, s.works.length, s.s]; }) } };
    }
  };
})();

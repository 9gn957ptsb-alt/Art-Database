/* The voices — who tells a path, from how far, in what tense.

   The artist, 2 Oct 2026, with a recording of a work's view on his phone:
   "I really liked the layout in this perspective with the globe that small
   next to the dial and a big image above it with scrollable text below.
   Find a way to incorporate [this]. Think about the different ways we are
   defining these paths and how that relates to the viewers distance from
   the globe. Example, movements are a big idea and as they get more modern
   they are relevant to more areas of the globe, so the perspective should
   be farther out. Whereas if we are focusing on a specific artist, our
   perspective can be much closer and even potential third person of the
   artists head, or first person. Think about different tenses and
   perspectives novels are written in and how that pertains to the way we
   are defining these paths of exploration." And, of a path changing voice
   as a novel does mid-chapter: "Great idea, implement that changes in
   perspective as paths of exploration evolve".

   Every path is read in one layout (land.js, "the reading layout, and the
   lens"): the picture, the lens beside the dial, the text. This module is
   the narrator. It reads VOICE.md — the one table of who tells each step of
   each path, from how far, in what tense, in what words — and, as a path is
   read, knows the step it is at (from the view and its dial, or from what a
   player — explorations.js, lives.js, walks.js — says it is saying), and
   tells it: the lens flown to the voice's distance (Land.lens), the voice's
   name engraved on the lens's rim, the sentence under the picture, the
   tense under the dial's years (Land.tense), and, in a view that is not one
   work's, the picture of the moment (Land.picture). Two fingers on the lens
   (land.js) move between the voices and hold one (nudge); a press on the
   held name lets it go. Where a path goes through a view with no lens (a
   city, a museum), its voice is said beside the dial (the chip).

   Never invented: every sentence is a frame of tense and person round facts
   the data holds; a fact that is not there leaves its clause out. */
(function () {
  "use strict";

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var RANKS = ["omniscient", "panoramic", "close", "first"];
  var FRAME_DIST = { stop: "close", shoulder: "close", two: "close", arrival: "close", leg: "panoramic",
                     after: "panoramic", route: "omniscient", movement: "omniscient", standing: "first" };
  var STEADY = 900;            // a step found from the view is told once it has held this long
  var SITE_REST = 2400;        // the dial resting on a painted site's year this long, before the first person
  var LEAN_MS = 7000;          // a movement leans in to an arrival this long, then out again
  var BEAT_KEEP = 90000;       // a step a player told stands at most this long without another

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  /* The name a sentence calls them by: the surname, bare of a trailing
     "(b. 1981)" or "(1757-1827)"; for a name written in its own script as
     well ("Li Qing 李青") the whole Latin name, since the family name may
     come first. */
  var CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
  function surname(a) {
    var s = String(a || "").replace(/\s*\([^)]*\)\s*$/, "").trim(), east = CJK.test(s);
    var w = s.split(/\s+/).filter(function (x) { return x && !CJK.test(x); }), k = w.length - 1;
    if (east || k < 0) { return w.join(" ") || s; }
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la|du|ter|ten)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function possessive(a) { var s = surname(a); return s ? s + (/s$/.test(s) ? "’" : "’s") : ""; }
  function and(names) {
    var n = names.filter(Boolean);
    if (n.length > 5) { return n.slice(0, 4).join(", ") + " and " + (n.length - 4) + " more"; }
    if (n.length < 2) { return n[0] || ""; }
    return n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
  }
  function has(v) { return v !== undefined && v !== null && v !== "" && !(typeof v === "number" && !isFinite(v)); }
  function span(a, b) { return !has(b) || a === b ? String(a) : a + "–" + b; }
  function short(name) { return String(name || "").split(",")[0].trim(); }
  function where() { return window.Land && Land.where ? Land.where() : { at: "world" }; }
  function get(path) { return fetch(path).then(function (r) { if (!r.ok) { throw new Error(path); } return r.json(); }); }

  /* ---- the rules: VOICE.md, read ---------------------------------------------- */

  var T = null, asking = null;
  function load() {
    if (T) { return Promise.resolve(T); }
    if (asking) { return asking; }
    asking = fetch("VOICE.md").then(function (r) { if (!r.ok) { throw new Error("VOICE.md"); } return r.text(); })
      .then(function (md) { T = parse(md); return T; })
      .catch(function () { asking = null; return null; });
    return asking;
  }
  // Every table in it, by its head: the rules (path | step …), the voices (voice | label …), the tenses.
  function parse(md) {
    var tables = [], cur = null;
    md.split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!/^\|.*\|$/.test(t)) { cur = null; return; }
      var cells = t.slice(1, -1).split("|").map(function (c) { return c.trim(); });
      if (cells.every(function (c) { return /^:?-{2,}:?$/.test(c); })) { return; }
      if (!cur) { cur = { head: cells.map(function (h) { return h.toLowerCase(); }), rows: [] }; tables.push(cur); return; }
      var o = {};
      cur.head.forEach(function (h, i) { o[h] = (cells[i] || "").replace(/^`([^`]*)`$/, "$1"); });
      cur.rows.push(o);
    });
    var out = { rules: {}, voices: {}, tenses: {}, n: 0 };
    tables.forEach(function (tb) {
      if (tb.head[0] === "path" && tb.head[1] === "step") {
        tb.rows.forEach(function (r) { (out.rules[r.path] = out.rules[r.path] || {})[r.step] = r; out.n += 1; });
      } else if (tb.head[0] === "voice" && tb.head.indexOf("label") >= 0) {
        tb.rows.forEach(function (r) { out.voices[r.voice] = r; });
      } else if (tb.head[0] === "tense" && tb.head.indexOf("word") >= 0) {
        tb.rows.forEach(function (r) { out.tenses[r.tense] = r.word; });
      }
    });
    return out;
  }
  function ruleOf(path, step) { return T && T.rules[path] ? T.rules[path][step] || null : null; }

  /* The sentence: a caption's frame round the facts. "[…]" only when every
     fact in it is known; a fact the frame needs and the data lacks: no
     sentence at all. */
  function fill(tpl, f) {
    var s = String(tpl || "").replace(/\[([^\]]*)\]/g, function (m, inner) {
      var ok = true;
      inner.replace(/\{(\w+)\}/g, function (m2, k) { if (!has(f[k])) { ok = false; } return m2; });
      return ok ? inner : "";
    });
    var missing = false;
    s = s.replace(/\{(\w+)\}/g, function (m, k) { if (!has(f[k])) { missing = true; return ""; } return String(f[k]); });
    if (missing) { return null; }
    // A fact that ends a sentence itself ("Washington, D.C.") is not stopped twice.
    return s.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").replace(/\.\.(?!\.)/g, ".").trim();
  }
  // "*a title*" in italics; text only, never markup from the data.
  function italics(text, into) {
    String(text || "").split(/\*([^*]+)\*/).forEach(function (part, i) {
      if (!part) { return; }
      if (i % 2) { into.appendChild(el("i", "", part)); } else { into.appendChild(document.createTextNode(part)); }
    });
  }
  function plainText(text) { return String(text || "").replace(/\*([^*]+)\*/g, "$1"); }

  /* ---- what is open, read once ------------------------------------------------- */

  var lives = {}, threads = {}, sitesD = null, sitesAsk = null, towns = null, townsAsk = null;
  function lifeOf(id) {
    if (!id) { return null; }
    if (lives[id] === undefined) {
      lives[id] = null;
      get("lives/" + id + ".json").then(function (L) { lives[id] = L; kick(); }, function () { delete lives[id]; });
    }
    return lives[id];
  }
  function threadOf(id) {
    if (!id) { return null; }
    if (threads[id] === undefined) {
      threads[id] = null;
      get("threads/" + id + ".json").then(function (t) { threads[id] = t; kick(); }, function () { delete threads[id]; });
    }
    return threads[id];
  }
  function sites() {
    if (sitesD) { return sitesD; }
    if (!sitesAsk) {
      sitesAsk = get("sites.json").then(function (d) {
        d.byW = {};
        d.byId = {};
        d.sites.forEach(function (s, i) { if (s.w) { d.byW[s.w] = i; } d.byId[s.id] = i; });
        sitesD = d;
        kick();
      }, function () { sitesAsk = null; });
    }
    return null;
  }
  function town(key) {
    if (towns) { return towns[key] || null; }
    if (!townsAsk) {
      townsAsk = get("cities.json").then(function (c) {
        towns = {};
        c.towns.forEach(function (t) { towns[t[0]] = { key: t[0], name: short(t[1]), ll: [t[3], t[4]] }; });
        kick();
      }, function () { townsAsk = null; });
    }
    return null;
  }

  /* ---- the lens's rim, the sentence, the chip ------------------------------------ */

  var NS = "http://www.w3.org/2000/svg";
  var rim = null, rimText = null, rimWord = null, rimHeld = null, release = null;
  var cap = null, capSay = null, capPic = null, capCount = null, chip = null, chipWord = null, chipSay = null, stand = null;
  var artEl = document.getElementById("art");
  function setUp() {
    if (rim || !artEl) { return; }
    rim = document.createElementNS(NS, "svg");
    rim.setAttribute("class", "voice-rim");
    rim.setAttribute("aria-hidden", "true");
    var defs = document.createElementNS(NS, "defs");
    var path = document.createElementNS(NS, "path");
    path.setAttribute("id", "voice-rim-arc");
    defs.appendChild(path);
    rim.appendChild(defs);
    rimText = document.createElementNS(NS, "text");
    var tp = document.createElementNS(NS, "textPath");
    tp.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#voice-rim-arc");
    tp.setAttribute("href", "#voice-rim-arc");
    tp.setAttribute("startOffset", "50%");
    tp.setAttribute("text-anchor", "middle");
    rimWord = document.createElementNS(NS, "tspan");
    rimWord.setAttribute("class", "voice-rim-word");
    rimHeld = document.createElementNS(NS, "tspan");
    rimHeld.setAttribute("class", "voice-rim-held");
    tp.appendChild(rimWord);
    tp.appendChild(rimHeld);
    rimText.appendChild(tp);
    rimText.addEventListener("click", function (event) { event.stopPropagation(); letGo(); });
    rimText.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    rim.appendChild(rimText);
    artEl.appendChild(rim);
    // For the keyboard and for anyone the rim is too small for: the held voice as a button.
    release = el("button", "voice-release");
    release.type = "button";
    release.hidden = true;
    release.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    release.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); letGo(); });
    artEl.appendChild(release);
    cap = el("div", "voice-cap");
    cap.setAttribute("aria-live", "polite");
    capSay = el("p", "voice-say");
    capPic = el("button", "voice-pic");
    capPic.type = "button";
    capPic.hidden = true;
    capPic.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    capPic.addEventListener("click", function (event) {
      event.stopPropagation();
      event.preventDefault();
      var id = capPic.dataset.id;
      if (id && window.Land && Land.work) { Land.work(id, capPic.dataset.key || undefined); }
    });
    cap.appendChild(capSay);
    // The picture's line, and where it stands among its period's works ("2 of 7 · 1938–1941").
    var row = el("div", "voice-pic-row");
    row.appendChild(capPic);
    capCount = el("span", "voice-count");
    capCount.hidden = true;
    row.appendChild(capCount);
    cap.appendChild(row);
    artEl.appendChild(cap);
    swipeSetUp();
    // The first person's standing point: where they stood, in the middle of the lens.
    stand = el("div", "voice-stand");
    stand.setAttribute("aria-hidden", "true");
    stand.hidden = true;
    artEl.appendChild(stand);
    chip = el("p", "voice-chip");
    chip.hidden = true;
    chip.setAttribute("aria-live", "polite");
    chipWord = el("span", "voice-chip-word");
    chipSay = el("span", "voice-chip-say");
    chip.appendChild(chipWord);
    chip.appendChild(chipSay);
    document.body.appendChild(chip);
  }

  // The rim's arc over the top of the lens, just outside it; the cap under the picture.
  var placedKey = "";
  function place(r) {
    setUp();
    cap.hidden = false;
    var h = r.hole, round = h.round < 0;
    var key = [h.x, h.y, h.w, h.h, round, r.cap.x, r.cap.y, r.cap.w, r.cap.h].map(function (v) { return Math.round(v); }).join(",");
    if (key === placedKey) { return; }
    placedKey = key;
    var pad = 16, w = h.w + 2 * pad, hh = h.h + 2 * pad;
    rim.style.left = (h.x - pad) + "px";
    rim.style.top = (h.y - pad) + "px";
    rim.setAttribute("width", String(Math.round(w)));
    rim.setAttribute("height", String(Math.round(hh)));
    rim.setAttribute("viewBox", "0 0 " + Math.round(w) + " " + Math.round(hh));
    var d;
    if (round) {
      var c = w / 2, rr = h.w / 2 + 7;
      // From the left of the top to the right of it, clockwise: read left to right.
      var a0 = Math.PI * 1.08, a1 = Math.PI * 1.92;
      d = "M " + (c + rr * Math.cos(a0)).toFixed(1) + " " + (c + rr * Math.sin(a0)).toFixed(1) +
          " A " + rr.toFixed(1) + " " + rr.toFixed(1) + " 0 0 1 " + (c + rr * Math.cos(a1)).toFixed(1) + " " + (c + rr * Math.sin(a1)).toFixed(1);
    } else {
      d = "M " + pad + " " + (pad - 5) + " L " + (w - pad) + " " + (pad - 5);
    }
    rim.querySelector("#voice-rim-arc").setAttribute("d", d);
    release.style.left = Math.round(Math.max(8, h.x - 12)) + "px";
    release.style.top = Math.round(h.y + h.h - 24) + "px";
    stand.style.left = Math.round(h.x + h.w / 2 - 6.5) + "px";
    stand.style.top = Math.round(h.y + h.h / 2 - 6.5) + "px";
    cap.style.left = r.cap.x + "px";
    cap.style.top = r.cap.y + "px";
    cap.style.width = r.cap.w + "px";
    cap.style.height = Math.max(0, r.cap.h) + "px";
  }

  // The banner's way of saying a new thing: the letters settle in steps.
  var GLYPHS = "▖▗▘▙▚▛▜▝▞▟░▒";
  function scrambleTo(node, text) {
    if (node._to === text) { return; }
    node._to = text;
    window.clearInterval(node._t);
    if (still || !text) { node.textContent = text; return; }
    var n = 0, steps = 9;
    node._t = window.setInterval(function () {
      n += 1;
      var k = Math.floor(text.length * n / steps);
      var tail = "";
      for (var i = k; i < text.length; i += 1) { tail += text[i] === " " ? " " : GLYPHS[(i * 7 + n * 3) % GLYPHS.length]; }
      node.textContent = text.slice(0, k) + tail;
      if (n >= steps) { window.clearInterval(node._t); node.textContent = text; }
    }, 1000 / 24);
  }

  function setLabel(word, isHeld) {
    setUp();
    scrambleTo(rimWord, word);
    rimHeld.textContent = isHeld ? "  · held ×" : "";
    rim.dataset.held = isHeld ? "true" : "false";
    rim.dataset.on = word ? "true" : "false";
    release.hidden = !isHeld;
    release.textContent = isHeld ? "× held" : "";
    release.setAttribute("aria-label", isHeld ? "The lens is held: " + word + ". Let it go back to the path’s own voice" : "");
  }
  var lastCap = null;
  function setCaption(text, pic, isWork) {
    setUp();
    lastCap = [text, pic, isWork];
    var plain = plainText(text);
    if (capSay._was !== plain) {
      capSay._was = plain;
      capSay.dataset.on = "";
      capSay.textContent = "";
      if (text) { italics(text, capSay); }
      if (text) { window.requestAnimationFrame(function () { capSay.dataset.on = "true"; }); }
    }
    // The picture's own line: a saved work's is a door to its history; a
    // painting that is not saved (Painted here's) says only where it is.
    var t = pic ? String(pic.title || "Untitled") : "", circa = pic && (pic.circa || CIRCA.test(t));
    if (circa) { t = t.replace(CIRCA, ""); }
    // Where the wall label stands under the picture it says the title, artist and date, and its title is the
    // door to the work's history (label.js): the line keeps only what the label does not say (8 Oct 2026:
    // the title was said three times round a picture 88 px tall).
    var labelled = !!(artEl && !artEl.dataset.swapped && artEl.querySelector(".wl-plate:not([hidden])"));
    var line = !isWork && pic ? (labelled
      ? [pic.near ? "the nearest dated" : "", pic.notSaved ? "not saved" : ""].filter(Boolean).join(" · ")
      : [t + (pic.year ? ", " + (circa ? "c. " : "") + pic.year : ""), pic.by ? surname(pic.by) : "",
         pic.id ? "" : pic.where || "", pic.near ? "the nearest dated" : "",
         pic.notSaved ? "not saved" : ""].filter(Boolean).join(" · ") + (pic.id ? " ›" : "")) : "";
    capPic.hidden = !line;
    if (line && capPic.textContent !== line) { capPic.textContent = line; }
    capPic.dataset.id = pic && pic.id || "";
    capPic.disabled = labelled || !(pic && pic.id);
    capPic.setAttribute("aria-label", line && pic.id ? line + " — where it has been" : line);
  }

  /* ---- swiping through the period's works ---------------------------------------

     A horizontal swipe on the picture (a drag of 40 px or more, a trackpad's
     sideways scroll, ←/→ while it has focus, or the faint ‹ › at its edges on
     a desktop) steps through the works of the period the dial is in
     (periodPics), from the one shown; the caption, the sentence and the
     column's square follow; the dial moves only when the work's year is not
     the year shown, and then only within the period. A press still fills the
     screen with it; a vertical scroll is not a swipe. */
  var swipe = null;            // { view, life, k, key }: the work swiped to, told until the period is left
  var swipeArrows = null, swipeList = null;
  function picKey(pic) { return !pic ? "" : pic.site && !pic.id ? "s:" + pic.site : pic.id || (pic.site ? "s:" + pic.site : ""); }
  function swipeNow(r) {
    r = r || (window.Land && Land.reading ? Land.reading() : null);
    if (r && r.kind === "life" && /^born:/.test(r.id || "")) {
      var P = bornPics();
      if (!P || !P.list.length) { return null; }
      var bc = picKey(S.pic), bi = -1;
      P.list.forEach(function (q, n) { if (bi < 0 && picKey(q) === bc) { bi = n; } });
      return { r: r, born: P.town, list: P.list, i: bi };
    }
    if (!r || r.kind !== "life" || !r.id || !has(r.year)) { return null; }
    var L = lifeOf(r.id);
    if (!L) { return null; }
    var k = periodAt(L, r.year);
    // Every work of the artist's, in date order (artist, 8 Oct 2026, of Pollock's life at Cody, 1912, where
    // no work of the period could be swiped: "When I have clicked on an artist I want to be able to swipe
    // through all of their works through that top thumbnail of artworks").
    var list = lifePics(L);
    var cur = picKey(S.pic), i = -1;
    list.forEach(function (q, n) { if (i < 0 && (picKey(q) === cur || (S.pic && q.id && q.id === S.pic.id))) { i = n; } });
    return { r: r, L: L, k: k, p: k >= 0 ? L.periods[k] : null, list: list, i: i };
  }
  // All of a life's works for the picture: the saved works with a picture, and the Painted here outings not
  // saved, together by date (undated last).
  var lifePicsOf = {};
  function lifePics(L) {
    if (lifePicsOf[L.id]) { return lifePicsOf[L.id]; }
    var seen = {}, out = [];
    (L.works || []).forEach(function (w) { if (w && w[3] && !seen[w[0]]) { seen[w[0]] = 1; out.push(savedPic(L, w)); } });
    var SD = sites();
    (L.sites || []).forEach(function (x) {
      var full = x && SD && SD.byId[x[0]] !== undefined ? SD.sites[SD.byId[x[0]]] : null;
      if (!full || !full.img || (full.w && seen[full.w])) { return; }
      out.push({ id: full.w || null, site: x[0], src: COMMONS + encodeURIComponent(full.img) + "?width=960",
                 big: COMMONS + encodeURIComponent(full.img) + "?width=2000", title: x[1], year: x[2] || null, by: L.name,
                 where: full.m || "", notSaved: !full.w });
    });
    out.sort(function (a, b) { return (a.year || 9999) - (b.year || 9999); });
    if (SD) { lifePicsOf[L.id] = out; }
    return out;
  }
  function swipeBy(d) {
    var w = swipeNow();
    if (!w || w.list.length < 2 || w.r.flying || w.r.full) { return false; }
    var i = w.i < 0 ? (d > 0 ? 0 : w.list.length - 1) : (w.i + d + w.list.length) % w.list.length;
    var q = w.list[i];
    if (w.born) {
      // (It had set an undeclared `swipedAt` here, which in strict mode threw: Born here never swiped.)
      bornGo(w.r, i);
      var bp = artEl && artEl.querySelector(".art-plate");
      if (bp && !still) {
        bp.dataset.swipe = d > 0 ? "next" : "prev";
        window.clearTimeout(bp._sw);
        bp._sw = window.setTimeout(function () { delete bp.dataset.swipe; }, 900);
      }
      handled();
      kick();
      return true;
    }
    swipe = { view: w.r.view, life: w.L.id, y: q.year || w.r.year, key: picKey(q), at: performance.now() };
    var plate = artEl && artEl.querySelector(".art-plate");
    if (plate && !still) {
      plate.dataset.swipe = d > 0 ? "next" : "prev";
      window.clearTimeout(plate._sw);
      plate._sw = window.setTimeout(function () { delete plate.dataset.swipe; }, 900);
    }
    // The dial goes to the work's own year: the life follows the works.
    if (q.year && q.year !== w.r.year && Land.dialYear) { Land.dialYear(q.year); }
    S.key = "";
    cand = { key: "", at: 0 };
    handled();
    kick();
    return true;
  }
  // The count under the sentence, the column's square, the arrows.
  function swipeSay(r) {
    var w = r && r.kind === "life" ? swipeNow(r) : null;
    var n = w ? w.list.length : 0;
    swipeList = w;
    if (capCount) {
      var qn = w && w.i >= 0 ? w.list[w.i] : null;
      var line = n > 1 && w.i >= 0 ? (w.i + 1) + " of " + n + (w.born ? " · born in " + w.born :
                 qn && qn.year ? " · " + qn.year : "") : "";
      capCount.hidden = !line;
      if (capCount.textContent !== line) { capCount.textContent = line; }
    }
    var id = S.pic && S.pic.id || "";
    var col = document.getElementById("art-col");
    if (col) {
      Array.prototype.forEach.call(col.querySelectorAll("[data-work]"), function (b) {
        if (b.dataset.work === id && r && r.kind === "life") { b.dataset.now = "true"; } else { delete b.dataset.now; }
      });
    }
    swipeArrowsPlace();
  }
  function swipeArrowsPlace() {
    if (!swipeArrows) { return; }
    var w = swipeList, plate = artEl.querySelector(".art-plate");
    var on = !!(w && w.list.length > 1 && w.i >= 0 && plate && !plate.hidden &&
                !artEl.dataset.full && !artEl.dataset.swapped && !artEl.dataset.out && artEl.dataset.look !== "plate");
    // Room is made for them beside the picture (land.js layoutPlate), and they stand in it, just
    // outside its box (artist, 7 Oct 2026: "The arrows on either side of the artwork should be
    // outside the boundary of the thumbnail"); where there is no room (twice as big), that one hides.
    var want = !!(w && w.list.length > 1 && w.i >= 0);
    if (window.Land && Land.swipes) { Land.swipes(want); }
    var rc = on ? plate.getBoundingClientRect() : null;
    if (rc && (!rc.width || !rc.height)) { on = false; }
    var AW = 28, AH = 40, GAP = 6, VW = window.innerWidth;
    swipeArrows.forEach(function (b, n) {
      var x = on ? (n ? rc.right + GAP : rc.left - GAP - AW) : 0;
      var fits = on && x >= 0 && x + AW <= VW;
      b.hidden = !fits;
      if (!fits) { return; }
      b.style.left = Math.round(x) + "px";
      b.style.top = Math.round(rc.top + rc.height / 2 - AH / 2) + "px";
    });
  }
  /* A picture swiped sideways — the reading layout's (swipeSetUp) and the
     place, then's (placethen.js, Voice.swipeable): a drag of 40 px or more,
     more across than down, with a finger or a pen (a vertical scroll is not
     one); a trackpad's sideways scroll; ←/→ while it has focus. `step(d)`
     (1 the next, −1 the one before) says whether it moved. The press that
     ended a swipe is not a press on the picture: it is caught at `guard`,
     an element that holds the picture, before the picture's own. */
  function swipeable(node, step, guard) {
    var sw = null, at = 0, acc = 0, accAt = 0;
    function go(d) { if (step(d)) { at = performance.now(); return true; } return false; }
    node.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse") { return; }
      sw = { id: event.pointerId, x: event.clientX, y: event.clientY, done: false };
    });
    node.addEventListener("pointermove", function (event) {
      if (!sw || sw.id !== event.pointerId || sw.done) { return; }
      var dx = event.clientX - sw.x, dy = event.clientY - sw.y;
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }    // a scroll, not a swipe
      if (Math.abs(dx) >= 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        sw.done = true;
        go(dx < 0 ? 1 : -1);
      }
    });
    ["pointerup", "pointercancel"].forEach(function (t) {
      node.addEventListener(t, function (event) { if (sw && sw.id === event.pointerId) { if (sw.done) { at = performance.now(); } sw = null; } });
    });
    (guard || node).addEventListener("click", function (event) {
      if (node.contains(event.target) && performance.now() - at < 600) {
        event.stopPropagation();
        event.preventDefault();
      }
    }, true);
    node.addEventListener("wheel", function (event) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) { return; }
      event.preventDefault();
      var now = performance.now();
      if (now - accAt > 300) { acc = 0; }
      accAt = now;
      acc += event.deltaX;
      if (Math.abs(acc) >= 40 && now - at > 450) {
        var d = acc > 0 ? 1 : -1;
        acc = 0;
        go(d);
      }
    }, { passive: false });
    node.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
      if (go(event.key === "ArrowRight" ? 1 : -1)) { event.preventDefault(); event.stopPropagation(); }
    });
  }
  function swipeSetUp() {
    var plate = artEl && artEl.querySelector(".art-plate");
    if (!plate) { return; }
    swipeable(plate, swipeBy, artEl);
    // Faint ‹ › at its edges, on every device (WCAG 2.5.1: a swipe has a one-tap way).
    swipeArrows = ["‹", "›"].map(function (g, n) {
      var b = el("button", "voice-swipe", g);
      b.type = "button";
      b.hidden = true;
      b.setAttribute("aria-label", n ? "The next work" : "The work before");
      b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      b.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); swipeBy(n ? 1 : -1); });
      artEl.appendChild(b);
      return b;
    });
  }

  /* ---- the narrator ------------------------------------------------------------- */

  var S = { view: -1, key: "", fk: "", said: "", rule: null, voice: "", dist: "", spec: null, f: null };
  var held = null;            // { view, rank }: the voice the viewer has held
  var beat = null;            // { view, path, step, f, pic, at }: what a player says it is saying
  var cand = { key: "", at: 0 };
  var yearSince = { y: null, at: 0, view: -1 };
  var movingSince = 0;        // since when the dial has been still (or, while it moves, since it began)
  var siteTap = null;         // a work's Painted here pressed: { view, s, at }

  function distOf(voice, frame) {
    if (RANKS.indexOf(voice) >= 0) { return voice; }
    return FRAME_DIST[frame] || "panoramic";
  }
  function labelOf(rule, dist, f, isHeld) {
    var v = T.voices[isHeld ? dist : rule.voice] || T.voices[dist] || {};
    // Held at a distance that is not the step's own: the voices' "held" names (where they were, not stood).
    var word = !isHeld && rule.label ? rule.label : isHeld && dist !== distOf(rule.voice, rule.frame) && v.held ? v.held : v.label || dist;
    return fill(word, f) || word.replace(/\{who\}/, "the painter");
  }
  // What the lens frames, for a voice's distance.
  function frameSpec(frame, f, dist) {
    var one = f.ll || (f.pts && f.pts[0]) || null;
    var spec = { voice: dist };
    if (dist === "first") {
      spec.at = one; spec.pts = one ? [one] : [];
    } else if (frame === "route" || frame === "movement" || frame === "after") {
      spec.pts = f.pts || (one ? [one] : []);
      if (frame === "movement" && f.ll) { spec.at = f.ll; }
      if (dist === "close" || dist === "panoramic") { spec.at = f.ll || null; }
    } else if (frame === "leg") {
      spec.pts = [f.fromLL, f.toLL].filter(Boolean);
      if (dist === "close") { spec.at = f.toLL || f.fromLL; }
    } else if (frame === "two") {
      spec.at = one; spec.pts = [one, f.otherLL].filter(Boolean);
    } else {
      spec.at = one; spec.pts = one ? [one] : [];
      if ((frame === "shoulder" || frame === "arrival") && f.fromLL) { spec.from = f.fromLL; }
    }
    if (!spec.pts.length && !spec.at) { return null; }
    return spec;
  }

  function tell(r, s, key, fk) {
    var rule = ruleOf(s.path, s.step);
    if (!rule) { return; }
    var isHeld = !!(held && held.view === r.view);
    var dist = isHeld ? RANKS[held.rank] : distOf(rule.voice, rule.frame);
    var flyIt = fk !== S.fk || dist !== S.dist || !S.spec;
    S.key = key;
    S.rule = rule;
    S.f = s.f;
    S.voice = rule.voice;
    S.path = s.path;
    S.step = s.step;
    // A work's step told at a year of its own (where it was painted, the year a cataloguer found it):
    // the dial goes there, so the tense under it is the tense of that year.
    if (flyIt && r.kind === "work" && (/^site/.test(s.step) || s.step === "finding") && has(s.f.year) && Land.dialYear &&
        s.f.year >= r.y0 && s.f.year <= r.y1) { Land.dialYear(s.f.year); }
    if (flyIt) {
      var spec = frameSpec(rule.frame, s.f, dist);
      if (spec) {
        S.fk = fk;
        S.dist = dist;
        S.spec = spec;
        Land.lens(spec);
      }
    }
    setLabel(labelOf(rule, dist, s.f, isHeld), isHeld);
    stand.hidden = dist !== "first";
    var text = fill(rule.caption, s.f);
    S.said = text || "";
    setCaption(text, s.pic || null, r.kind === "work");
    if (r.kind !== "work" && s.pic !== undefined && Land.picture) { Land.picture(s.pic); }
    if (s.pic !== undefined) { S.pic = s.pic || null; }
    swipeSay(r);
    var word = T.tenses[rule.tense] || "";
    Land.tense(word);
  }

  // A player's step is good while it plays (not paused, not ended), in its view.
  function playing() {
    try {
      var x = window.Explorations && Explorations._state && Explorations._state();
      if (x && x.playing && !x.playing.paused) { return "explore"; }
      if (window.Walks && Walks.walking && Walks.walking()) { return "walk"; }
    } catch (e) {}
    return "";
  }

  var raf = 0, timer = 0;
  function kick() { if (!raf) { raf = window.requestAnimationFrame(function () { raf = 0; tick(); }); } }

  function tick() {
    var r = window.Land && Land.reading ? Land.reading() : null;
    // For the strips (walks.js, explorations.js): a view is being read, its sentence under the picture.
    var on = !!(r && r.lens);
    if (on !== (document.body.dataset.reading === "true")) {
      if (on) { document.body.dataset.reading = "true"; } else { delete document.body.dataset.reading; }
    }
    if (!r || !r.lens) {
      hideLens(); chipTick(r);
      // The reading left (a place, then, a city): its ‹ › go with it, or they stand doubled over the
      // place, then's own (8 Oct 2026).
      if (swipeArrows) { swipeArrows.forEach(function (b) { b.hidden = true; }); }
      return;
    }
    if (!T) { load().then(kick); return; }
    hideChip();
    place(r);
    swipeArrowsPlace();
    var now = performance.now();
    if (r.view !== S.view) {
      S = { view: r.view, key: "", fk: "", said: "", rule: null, voice: "", dist: "", spec: null, f: null };
      swipeList = null;
      cand = { key: "", at: now };
      if (held && held.view !== r.view && !(held.keep && playing())) { held = null; }
      if (held) { held.view = r.view; }
      if (beat && beat.view !== r.view) { beat.view = beat.view === -2 ? r.view : beat.view; }
      setLabel("", false);
      setCaption("", null, true);
    }
    if (r.year !== yearSince.y || r.view !== yearSince.view) { yearSince = { y: r.year, at: now, view: r.view }; }
    if (!r.moving) { movingSince = now; }
    if (r.flying || r.look === "plate") { return; }
    var s = null, told = false;
    if (beat && (beat.view === r.view || beat.view === -2) && playing() && now - beat.at < BEAT_KEEP) {
      beat.view = r.view;
      s = resolveBeat(r, beat);
      told = true;
    }
    if (!s) { s = derive(r, now); told = false; }
    if (!s) { return; }
    var key = s.path + "|" + s.step + "|" + (s.key || "");
    var fk = s.path + "|" + s.step + "|" + (s.fk || s.key || "");
    if (!told && S.key) {
      if (key !== cand.key) { cand = { key: key, at: now }; }
      if (now - cand.at < (s.wait !== undefined ? s.wait : STEADY) && key !== S.key) { return; }
    }
    if (key === S.key && fk === S.fk && fill(S.rule && S.rule.caption, s.f) === S.said) { return; }
    tell(r, s, key, fk);
  }

  /* ---- each kind of view, its step ---------------------------------------------- */

  function derive(r, now) {
    // A work opened while following a writer: in their words.
    var fol = r.kind === "work" && window.Land && Land.following ? Land.following() : null;
    if (fol && fol.voice && r.work && r.work.flipped) {
      var st = r.work.stops[r.work.stops.length - 1];
      return { path: "voice", step: "work", key: "v" + fol.voice,
               f: { voice: fol.artist, title: r.work.title, ll: st ? [st.lat, st.lon] : null, place: st ? short(st.name) : null } };
    }
    if (r.kind === "work") { return deriveWork(r, now); }
    if (r.kind === "life") { return deriveLife(r, now, null); }
    if (r.kind === "movement") { return deriveMovement(r, now); }
    if (r.kind === "thread") { return deriveThread(r); }
    return null;
  }

  var VERB = { made: "made", owned: "owned", held: "held", listed: "listed", exhibited: "shown", offered: "offered",
               sold: "sold", other: "recorded" };
  function verbOf(kinds) {
    var order = ["exhibited", "sold", "held", "owned", "offered", "made", "listed", "other"];
    for (var i = 0; i < order.length; i += 1) { if (kinds.indexOf(order[i]) >= 0) { return VERB[order[i]]; } }
    return "recorded";
  }
  function yr(v) { return has(v) ? Math.floor(v) : null; }

  /* A work's Painted here, as a step: how exact the point is says which —
     where the painter stood (Wikidata's point of view), the building it was
     made in, the street, or only the place painted. North is up in the
     lens; no source gives the way a painter faced, and that is said. */
  var COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";
  function siteStep(path, s, who, extra) {
    var step = s.pr === "view" ? "site" : s.pr === "street" ? "site-street" : s.how === "made" ? "site-made" : "site-place";
    if (!ruleOf(path, step)) { step = "site"; }
    var f = { who: who || surname(s.a), title: s.t, year: s.d || null, what: s.what || s.place || null, ll: s.ll,
              facing: "Facing north: the way " + (who || surname(s.a) || "the painter") + " faced is not recorded." };
    Object.keys(extra || {}).forEach(function (k) { f[k] = extra[k]; });
    var pic = s.img ? { id: s.w || null, site: s.id || null, src: COMMONS + encodeURIComponent(s.img) + "?width=960",
                        big: COMMONS + encodeURIComponent(s.img) + "?width=2000", title: s.t, year: s.d || null, by: s.a,
                        where: s.m || "", notSaved: !s.w } : undefined;
    return { path: path, step: step, f: f, key: "site:" + s.id, pic: pic, stand: true };
  }

  function deriveWork(r, now) {
    var w = r.work;
    if (!w || !w.flipped) { return null; }
    var who = surname(w.artists[0] || "");
    var stops = w.stops;
    // Its Painted here pressed: where it was painted, until another place is read.
    if (siteTap && siteTap.view === r.view && siteTap.pin === w.pin) {
      // Until another place is read, or the dial is turned away from the year it was painted.
      if (!(r.byHand && !r.moving && has(siteTap.s.d) && has(r.year) && Math.abs(r.year - siteTap.s.d) > 1 &&
            performance.now() - siteTap.at > 4000)) {
        return siteStep("work", siteTap.s, who);
      }
      siteTap = null;
    }
    var pts = stops.map(function (s) { return [s.lat, s.lon]; });
    var seen = {}, n = 0, y0 = null, y1 = null;
    stops.forEach(function (s) {
      if (!seen[s.p]) { seen[s.p] = true; n += 1; }
      if (has(s.y)) { y0 = y0 === null ? yr(s.y) : Math.min(y0, yr(s.y)); y1 = y1 === null ? yr(s.y1 || s.y) : Math.max(y1, yr(s.y1 || s.y)); }
    });
    function city(k) {
      var s = stops[k];
      return { path: "work", step: "city", key: "c" + k,
               f: { year: yr(s.y), verb: verbOf(s.k), place: short(s.name), ll: [s.lat, s.lon] } };
    }
    // A place read (pressed, scrolled to): told at once.
    if (w.pin >= 0 && stops[w.pin]) { var cp = city(w.pin); cp.wait = 0; return cp; }
    // Turned by hand: the voice it had holds until the dial rests.
    if (r.byHand && r.moving && S.key) { return null; }
    if (r.byHand && !r.moving && stops.length) {
      var k = -1, next = -1;
      stops.forEach(function (s, i) { if (s.pos <= w.when + 1e-6) { k = i; } else if (next < 0) { next = i; } });
      if (k >= 0 && next >= 0 && w.when > stops[k].end + 0.002) {
        var a = stops[k], b = stops[next];
        return { path: "work", step: "journey", key: "j" + k,
                 f: { years: span(yr(a.y1 || a.y), yr(b.y)), from: short(a.name), to: short(b.name),
                      fromLL: [a.lat, a.lon], toLL: [b.lat, b.lon] } };
      }
      if (k >= 0 && w.when < 0.999) { return city(k); }
    }
    return { path: "work", step: "rest", key: "rest",
             f: { n: n, years: y0 !== null ? span(y0, y1) : null, pts: pts, ll: pts[pts.length - 1] || null } };
  }

  /* A life, at the dial's year: past the death, the works' afterlife; a
     painted site's year (once rested); a movement of the artist's in that
     city; a life that crosses it; born, died; else the place, arriving or
     staying. `force` is a player's beat: the step it is saying. */
  function deriveLife(r, now, force) {
    if (/^born:/.test(r.id || "")) { bornTell(r); return null; }
    var L = lifeOf(r.id);
    if (!L) { return null; }
    var y = force && has(force.y) ? force.y : r.year;
    if (!has(y)) { return null; }
    var who = surname(L.name);
    var route = [];
    if (L.b && L.b[1]) { route.push(L.b[1]); }
    L.periods.forEach(function (p) { route.push(p.ll); });
    var k = periodAt(L, y), p = k >= 0 ? L.periods[k] : null;
    // Swiped to: that work is the one told, until the dial is turned from its year.
    if (!force && swipe && swipe.view === r.view && swipe.life === L.id) {
      // (the dial glides to the work's year: kept while it is on its way)
      if (swipe.y !== y && !r.moving && performance.now() - swipe.at > 2600) { swipe = null; }
      else { force = swipe.key.indexOf("s:") === 0 ? { step: "site", site: swipe.key.slice(2) } : { step: "work", work: swipe.key }; }
    }
    var prev = k > 0 ? L.periods[k - 1].ll : L.b ? L.b[1] : null;
    var pic = lifePic(L, y, k, force && force.work);
    function out(step, f, key, extra) {
      var o = { path: "life", step: step, f: f, key: key, pic: pic };
      Object.keys(extra || {}).forEach(function (x) { o[x] = extra[x]; });
      return o;
    }
    var want = force && force.step;
    // While the dial plays the life by itself, or is turned on and on: the life seen whole;
    // a glide to a year holds the voice it had until it rests.
    if (!force && r.moving) {
      if (!r.playing && now - movingSince < 3200) { return null; }
      return out("route", { who: who, years: span(L.born, L.died || ""), pts: route }, "route");
    }
    if (L.died && y > L.died && (!want || want === "after")) {
      var rows = (L.after || []).filter(function (a) { return a[0] <= y && a[0] >= y - 4; });
      var names = [], pts = [];
      rows.forEach(function (a) {
        var t = town(a[1]);
        var pl = (L.places || []).filter(function (q) { return q[0] === a[1]; })[0];
        var nm = t ? t.name : pl ? pl[1] : null;
        if (nm && names.indexOf(nm) < 0) { names.push(nm); pts.push(t ? t.ll : [pl[2], pl[3]]); }
      });
      if (!names.length) {
        var wh = (L.places || []).slice(0, 8).map(function (q) { return [q[2], q[3]]; });
        return out("after-quiet", { year: y, whose: possessive(L.name), pts: wh.length ? wh : route }, "aq");
      }
      return out("after", { year: y, whose: possessive(L.name), cities: and(names.slice(0, 4)), pts: pts }, "a" + names.join(","));
    }
    // A painted site in this year: the first person, once the dial has rested on it.
    var site = sitesOfYear(L, y)[0];
    if (force && force.site) { site = (L.sites || []).filter(function (x) { return x[0] === force.site; })[0] || site; }
    if (site && (want === "site" || (!want && now - yearSince.at > SITE_REST - STEADY))) {
      var SD = sites(), full = SD && SD.byId[site[0]] !== undefined ? SD.sites[SD.byId[site[0]]] : null;
      var row = full || { id: site[0], t: site[1], d: site[2], what: site[3], ll: site[4], pr: site[5], a: L.name };
      var st = siteStep("life", row, who);
      // Its picture: the saved work's own, else the painting from Commons.
      var saved = row.w && (L.works || []).filter(function (w) { return w[0] === row.w && w[3]; })[0];
      if (saved) { st.pic = savedPic(L, saved); }
      else if (!st.pic) { st.pic = pic; }
      st.wait = 0;
      return st;
    }
    if (!p) {
      if (y === L.born && L.b) { return out("born", { who: who, place: short(L.b[0]), year: y, ll: L.b[1] }, "born"); }
      // A living artist past the last place the record names: said once, plainly, not "where … is".
      var lastP = L.periods.length ? L.periods[L.periods.length - 1] : null;
      if (!L.died && lastP && y > lastP.y1) {
        return out("since", { who: who, place: short(lastP.place), last: lastP.y1, pts: route }, "since");
      }
      return out("gap", { year: y, who: who, pts: route }, "gap");
    }
    if (y === L.died && L.d && (!want || want === "died")) {
      return out("died", { who: who, place: short(L.d[0]), year: y, ll: L.d[1] || p.ll, fromLL: prev }, "died");
    }
    if (y === L.born && L.b && (!want || want === "born")) {
      return out("born", { who: who, place: short(L.b[0]), year: y, ll: L.b[1] || p.ll }, "born");
    }
    var goes = y === p.y0 ? "arrives in" : "is in";
    // A movement of the artist's in this city, this year: the whole of it, from above.
    var mv = movementOf(L.name, p.key, y);
    if (mv && (!want || want === "movement")) {
      return out("movement", { place: mv.place, year: y, others: and(mv.here), are: mv.here.length === 1 ? "is" : "are",
                               pts: mv.pts, ll: mv.ll },
                 "m" + mv.id, { fk: "m" + mv.id });
    }
    var c = crossingOf(L, p, y);
    if (c && (!want || want === "crossing")) {
      return out("crossing", { who: who, goes: goes, place: p.place, year: y, other: surname(c[1]), ll: p.ll,
                               otherLL: otherLL(c, y) || p.ll }, "x" + c[0] + k, { fk: "x" + c[0] + k });
    }
    if (want === "work" && force.work) {
      var wk = (L.works || []).filter(function (w) { return w[0] === force.work; })[0];
      if (wk) {
        return out("work", { who: who, goes: "is in", place: p.place, year: wk[2] || y, title: String(wk[1] || "Untitled").replace(CIRCA, ""),
                             ll: p.ll, fromLL: prev },
                   "w" + wk[0], { fk: "p" + k });
      }
    }
    return out("place", { who: who, goes: goes, place: p.place, year: y, age: L.born ? y - L.born : null, ll: p.ll, fromLL: prev },
               "p" + k + (goes === "arrives in" ? "a" : "s"), { fk: "p" + k });
  }
  function periodAt(L, y) {
    for (var k = 0; k < L.periods.length; k += 1) {
      var p = L.periods[k];
      if (p.y0 <= y && y <= p.y1) { return k; }
    }
    return -1;
  }
  // The works of the moment: the latest made by then in this place, else by then anywhere, else the first;
  // a titled one before an "Untitled" where the place has one (2 Oct 2026: "UNTITLED, 1921" stood for Fontainebleau).
  function untitled(t) { return !t || /^(untitled|sans titre|ohne titel|senza titolo|sin título)\b/i.test(String(t).trim()); }
  // A saved work as the picture: a title that ends in the date's "circa" (the record's split) reads "c. 1945".
  var CIRCA = /,?\s*\b(circa|ca\.|c\.)\s*$/i;
  /* A town's "Born here" (artist, 7 Oct 2026, of "Born in Memphis" with an
     empty band above it): its picture is the work of the artists born there,
     the most saved first, each artist's in date order, swiped through as a
     life's period is; a town none of whose works has a picture closes the
     band (Land.noPicture). */
  var bornPick = null;            // { view, i }: the picture swiped to
  function bornPics() {
    var B = window.Lives && Lives.born ? Lives.born() : null;
    if (!B) { return null; }
    var out = [], waiting = false;
    B.ids.slice(0, 13).forEach(function (id) {
      var L = lifeOf(id);
      if (!L) { waiting = true; return; }
      (L.works || []).filter(function (w) { return w[3]; })
        .sort(function (a, b) { return (a[2] || 9999) - (b[2] || 9999); })
        .forEach(function (w) { out.push(savedPic(L, w)); });
    });
    return { town: B.town, list: out, waiting: waiting };
  }
  /* Its dial (artist, 7 Oct 2026, of "Born in New York": "The dial has completely disappeared, bring
     it back"): the born artists' years (lives.js, bornYears), and the transport of the swipe — a path
     on the dial (transport.js) whose stops are the works: the face plays or pauses them (a work every
     φ⁵ s), the ring scrubs them. A swipe or a stop turns the dial to
     the work's year (else its artist's birth); the dial turned by hand brings the picture to the work
     of that year (the latest made by then, else the earliest); the artist of the picture is lit on
     the globe (Lives.bornLight). */
  var BORN_STEP = 11090;          // φ⁵ s a work, played
  var bornSt = null;              // { view, lastY, setY, setAt, path, n, playing, next }
  function bornYearOf(q) {
    if (q && q.year) { return q.year; }
    var L = q && q.lid ? lifeOf(q.lid) : null;
    return L && L.born || null;
  }
  function bornAtYear(list, y) {
    var best = -1, by = -Infinity, lo = -1, ly = Infinity;
    list.forEach(function (q, n) {
      var qy = q.year;
      if (!qy) { return; }
      if (qy <= y && qy > by) { by = qy; best = n; }
      if (qy < ly) { ly = qy; lo = n; }
    });
    return best >= 0 ? best : lo;
  }
  function bornSetYear(y) {
    var B = window.Lives && Lives.born ? Lives.born() : null;
    if (!B || !y || !bornSt) { return; }
    bornSt.setY = y;
    bornSt.setAt = performance.now();
    B.setYear(y);
  }
  // To the i-th work: the picture, the dial's year, the path's stop.
  function bornGo(r, i) {
    var P = bornPics();
    if (!P || !P.list[i]) { return; }
    bornPick = { view: r.view, i: i };
    if (bornSt && bornSt.view === r.view) {
      bornSetYear(bornYearOf(P.list[i]));
      if (bornSt.path) { bornSt.path.set({ at: i }); }
      bornSt.next = performance.now() + BORN_STEP;
    }
    kick();
  }
  function bornEnd() {
    if (!bornSt) { return; }
    if (bornSt.path) { var pa = bornSt.path; bornSt.path = null; pa.close(); }
    if (window.Lives && Lives.bornLight) { Lives.bornLight(null); }
    bornSt = null;
  }
  function bornPath(r, P) {
    if (!window.Dial || !Dial.path) { return null; }
    var stops = function () { return P.list.map(function (q) { return { y: q.year, label: surname(q.by) + " · " + (q.title || "Untitled") }; }); };
    var st = bornSt;
    var h = Dial.path({
      kind: "born", title: "Born in " + P.town, stops: stops(), at: Math.max(0, bornPick && bornPick.view === r.view ? bornPick.i : 0),
      paused: true,
      onSeek: function (i, play) {
        if (bornSt !== st) { return; }
        st.playing = !!play && !still;
        h.set({ paused: !st.playing });
        bornGo(r, i);
      },
      onToggle: function () {
        if (bornSt !== st) { return; }
        st.playing = !st.playing && !still;
        st.next = performance.now() + BORN_STEP;
        h.set({ paused: !st.playing });
      },
      onNext: function () {
        if (bornSt !== st) { return; }
        var Q = bornPics();
        if (Q && Q.list.length) { bornGo(r, ((bornPick ? bornPick.i : 0) + 1) % Q.list.length); }
      },
      onEnd: function () { if (bornSt === st) { st.path = null; st.playing = false; } }
    });
    st.n = P.list.length;
    st.restops = function (Q) { if (st.path && Q.list.length !== st.n) { st.n = Q.list.length; P = Q; st.path.set({ stops: stops() }); } };
    return h;
  }
  function bornTell(r) {
    var P = bornPics();
    if (!P || !Land.picture) { return; }
    if (!P.list.length) {
      if (!P.waiting && Land.noPicture) {
        Land.noPicture(true);
        if (S.said !== "none") { S.said = "none"; setCaption("Born in " + P.town + ". None of their saved works has a picture.", null, false); }
      }
      return;
    }
    if (Land.noPicture) { Land.noPicture(false); }
    var now = performance.now();
    if (!bornSt || bornSt.view !== r.view) {
      bornEnd();
      bornSt = { view: r.view, lastY: r.year, setY: null, setAt: 0, path: null, n: 0, playing: false, next: now + BORN_STEP };
      bornSt.path = bornPath(r, P);
      var i0 = bornPick && bornPick.view === r.view ? Math.min(bornPick.i, P.list.length - 1) : 0;
      bornSetYear(bornYearOf(P.list[i0]));
    } else if (bornSt.restops) { bornSt.restops(P); }
    // The dial turned by hand (not easing to a year set here): the work of that year.
    if (has(r.year) && r.year !== bornSt.lastY) {
      bornSt.lastY = r.year;
      var easing = bornSt.setY !== null && now - bornSt.setAt < 2600;
      if (r.year === bornSt.setY) { bornSt.setY = null; }
      else if (!easing) {
        var k = bornAtYear(P.list, r.year);
        if (k >= 0 && !(bornPick && bornPick.view === r.view && bornPick.i === k)) {
          bornPick = { view: r.view, i: k };
          if (bornSt.path) { bornSt.path.set({ at: k }); }
        }
      }
    }
    // Played: the next work, while the pointer is still.
    if (bornSt.playing && bornSt.path && now >= bornSt.next) {
      bornGo(r, ((bornPick ? bornPick.i : 0) + 1) % P.list.length);
    }
    var i = bornPick && bornPick.view === r.view ? Math.min(bornPick.i, P.list.length - 1) : 0;
    var pic = P.list[i];
    if (window.Lives && Lives.bornLight) { Lives.bornLight(pic.lid, has(r.year) ? r.year : null); }
    if (S.pic && picKey(pic) === picKey(S.pic)) { return; }
    S.pic = pic;
    S.said = "born";
    Land.picture(pic);
    setCaption("Born in " + P.town + ": " + pic.by + ".", pic, false);
    swipeSay(r);
  }
  function savedPic(L, w, near) {
    var c = CIRCA.test(w[1] || "");
    return { id: w[0], image: w[3], title: c ? String(w[1]).replace(CIRCA, "") : w[1], circa: c, year: w[2] || null,
             by: L.name, lid: L.id, near: !!near };
  }
  /* The works of a period, for the picture to be swiped through (artist, 3 Oct
     2026: "I want to be able to swipe through artworks by the artist with that
     top image. The artworks in rotation should be relevant to what time period
     of the artist you are looking in"): Made then and Printed then, saved, in
     date order; then Painted here's outings of the period that are not saved,
     from Commons, marked so. The next period's do not mix in. */
  function periodPics(L, k) {
    var p = k >= 0 ? L.periods[k] : null;
    if (!p) { return []; }
    var seen = {}, saved = [];
    p.works.concat(p.prints || []).forEach(function (i) {
      var w = L.works[i];
      if (w && w[3] && !seen[w[0]]) { seen[w[0]] = 1; saved.push(w); }
    });
    saved.sort(function (a, b) { return (a[2] || 9999) - (b[2] || 9999); });
    var out = saved.map(function (w) { return savedPic(L, w); });
    var SD = sites(), more = [];
    (p.sites || []).forEach(function (i) {
      var x = (L.sites || [])[i];
      var full = x && SD && SD.byId[x[0]] !== undefined ? SD.sites[SD.byId[x[0]]] : null;
      if (!full || !full.img || (full.w && seen[full.w])) { return; }
      more.push({ id: full.w || null, site: x[0], src: COMMONS + encodeURIComponent(full.img) + "?width=960",
                  big: COMMONS + encodeURIComponent(full.img) + "?width=2000", title: x[1], year: x[2] || null, by: L.name,
                  where: full.m || "", notSaved: !full.w });
    });
    more.sort(function (a, b) { return (a.year || 9999) - (b.year || 9999); });
    return out.concat(more);
  }
  function lifePic(L, y, k, wantId) {
    var all = (L.works || []).filter(function (w) { return w[3]; });
    var hit = null;
    if (wantId) { hit = all.filter(function (w) { return w[0] === wantId; })[0] || null; }
    if (hit) { return savedPic(L, hit); }
    // In a period: a work of the period (3 Oct 2026: a 1945 work had stood for Greenwich, 1940) — the
    // latest made by the year, a titled one first, else the period's first; a period of outings only, its
    // first outing; a period with none, the dated work nearest its years, said so.
    if (k >= 0) {
      var p = L.periods[k], inP = [];
      p.works.concat(p.prints || []).forEach(function (i) { var w = L.works[i]; if (w && w[3]) { inP.push(w); } });
      if (inP.length) {
        var by = inP.filter(function (w) { return w[2] && w[2] <= y; });
        var nm = by.filter(function (w) { return !untitled(w[1]); });
        var late = function (ws) { return ws.reduce(function (h, w) { return !h || w[2] > h[2] ? w : h; }, null); };
        var first = inP.slice().sort(function (a, b) { return (a[2] || 9999) - (b[2] || 9999); })[0];
        return savedPic(L, late(nm) || late(by) || first);
      }
      var outs = periodPics(L, k);
      if (outs.length) { return outs[0]; }
      var near = null, nd = Infinity;
      all.forEach(function (w) {
        if (!w[2]) { return; }
        var d = w[2] < p.y0 ? p.y0 - w[2] : w[2] > p.y1 ? w[2] - p.y1 : 0;
        if (d < nd || (d === nd && near && untitled(near[1]) && !untitled(w[1]))) { near = w; nd = d; }
      });
      if (near) { return savedPic(L, near, true); }
    }
    function pick(ws) {
      var h = null;
      ws.forEach(function (w) {
        if (!w[2] || w[2] > y) { return; }
        var better = !h || w[2] > h[2] || (w[2] === h[2] && w[5] === k && h[5] !== k);
        if (better && (w[5] === k || !h || h[5] !== k)) { h = w; }
      });
      return h;
    }
    if (!hit) {
      var named = pick(all.filter(function (w) { return !untitled(w[1]); })), any = pick(all);
      hit = named && (named[5] === k || !any || any[5] !== k) ? named : any;
    }
    if (!hit) { all.forEach(function (w) { if (!hit || (w[2] || 9999) < (hit[2] || 9999)) { hit = w; } }); }
    return hit ? savedPic(L, hit) : null;
  }
  // Painted here's points of the year, the most exact first (where the painter stood, the street, the place painted).
  function sitesOfYear(L, y) {
    var rank = { view: 0, street: 1, site: 2 };
    return (L.sites || []).filter(function (s) { return s[2] === y && s[4] && rank[s[5]] !== undefined; })
      .sort(function (a, b) { return rank[a[5]] - rank[b[5]]; });
  }
  function crossingOf(L, p, y) {
    return (L.cross || []).filter(function (c) { return c[2] === p.key && c[4] <= y && y <= c[5]; })[0] || null;
  }
  // The other life's own place in that city that year, when its file is read.
  function otherLL(c, y) {
    var O = lifeOf(c[0]);
    if (!O) { return null; }
    var hit = null;
    O.periods.forEach(function (q) { if (q.key === c[2] && q.y0 <= y + 1 && y - 1 <= q.y1) { hit = q.ll; } });
    return hit;
  }
  // A movement this artist is a member of, in that city, that year: who is there, and where they came from.
  function movementOf(name, key, y) {
    var D = window.Movements && Movements.data ? Movements.data() : null;
    if (!D) { if (window.Movements && Movements.load) { Movements.load().then(kick); } return null; }
    var ms = Movements.ofArtistName ? Movements.ofArtistName(name) : [];
    var m = ms.filter(function (x) { return x.key === key && x.y0 <= y && y <= x.y1; })[0];
    if (!m) { return null; }
    return movementFacts(D, m, y);
  }
  function movementFacts(D, m, y) {
    var t = D.town && D.town[m.key];
    var here = [], pts = [];
    if (t) { pts.push(t.ll); }
    m.members.forEach(function (r) {
      var a = D.artists[r[0]];
      if (!a) { return; }
      if (r[1] <= y && y <= r[2]) { here.push(surname(a[1])); }
      if (a[7] && a[7].length > 2) { pts.push([a[7][1], a[7][2]]); }
    });
    return { id: m.id, place: t ? t.name : m.city || "", ll: t ? t.ll : null, here: here, pts: pts, m: m };
  }

  /* A movement, at the dial's year: from above, the whole of it — the
     farther its artists came from, the farther out; on a member's first
     year there, leaning in to them a while, then out again. */
  function deriveMovement(r, now) {
    var D = window.Movements && Movements.data ? Movements.data() : null;
    if (!D) { if (window.Movements && Movements.load) { Movements.load().then(kick); } return null; }
    var m = D.byId && D.byId[r.id] !== undefined ? D.movements[D.byId[r.id]] : null;
    var y = r.year;
    if (!m || !has(y)) { return null; }
    var mf = movementFacts(D, m, y);
    var pic = movementPic(m, D, y);
    var f = { place: mf.place, year: y, others: and(mf.here), were: mf.here.length === 1 ? "was" : "were", pts: mf.pts, ll: mf.ll };
    if (!mf.here.length) {
      var step = y < m.y0 ? "before" : y > m.y1 ? "after" : "quiet";
      return { path: "movement", step: step, f: f, key: step + y, fk: "m", pic: pic };
    }
    var arr = m.members.filter(function (row) { return row[1] === y; })[0];
    // Leaning in to a member's arrival only when the dial was turned there (by hand, or by a walk):
    // a movement opens from above.
    if (arr && r.byHand && !r.moving && now - yearSince.at < LEAN_MS) {
      var a = D.artists[arr[0]];
      var pres = Movements.presencesOf ? (Movements.presencesOf(a[1]) || []).filter(function (q) { return q[0] === m.key; }) : [];
      var best = null;
      pres.forEach(function (q) { if (!best || Math.abs(q[1] - y) < Math.abs(best[1] - y)) { best = q; } });
      var ll = best ? [best[4], best[5]] : mf.ll;
      return { path: "movement", step: "arrival", key: "a" + arr[0] + y, fk: "a" + arr[0],
               f: { who: surname(a[1]), place: mf.place, year: y, ll: ll, fromLL: a[7] && a[7].length > 2 ? [a[7][1], a[7][2]] : null },
               pic: pic, wait: 0 };
    }
    return { path: "movement", step: "overview", f: f, key: "o" + y, fk: "m", pic: pic };
  }
  function movementPic(m, D, y) {
    var hit = null;
    (m.made || []).forEach(function (w) {
      if (!w[4]) { return; }
      if (!hit || Math.abs((w[2] || y) - y) < Math.abs((hit[2] || y) - y)) { hit = w; }
    });
    if (!hit) { return null; }
    var a = D.artists[hit[1]];
    return { id: hit[0], image: hit[4], title: hit[3], year: hit[2] || null, by: a ? a[1] : "" };
  }

  // A thread: its works gathered, from above; the work that had come by the dial's year.
  function deriveThread(r) {
    var t = threadOf(r.id);
    if (!t) { return null; }
    var y = has(r.year) ? r.year : 9999;
    var pts = [], seen = {};
    (t.works || []).forEach(function (w) {
      [w[5], w[6]].forEach(function (k) { var tw = k && town(k); if (tw && !seen[k]) { seen[k] = true; pts.push(tw.ll); } });
    });
    if (!pts.length && t.ll) { pts.push(t.ll); }
    var ys = (t.works || []).map(function (w) { return w[4]; }).filter(has);
    var hit = null;
    (t.works || []).forEach(function (w) { if (w[3] && (w[4] || 0) <= y && (!hit || (w[4] || 0) >= (hit[4] || 0))) { hit = w; } });
    if (!hit) { hit = (t.works || []).filter(function (w) { return w[3]; })[0] || null; }
    return { path: "thread", step: "rest", key: "rest",
             f: { n: (t.works || []).length, years: ys.length ? span(Math.min.apply(null, ys), Math.max.apply(null, ys)) : null,
                  name: t.name, pts: pts, ll: t.ll || null },
             pic: hit ? { id: hit[0], image: hit[3], title: hit[1], year: hit[4] || null, by: hit[2] } : null };
  }

  /* ---- what the players say ------------------------------------------------------ */

  /* A player says what it is saying (explorations.js, lives.js, walks.js):
     { path, step, … } — resolved here against what is open. A hunt's stop
     says its lines in turn: the way on, the finding, the site. */
  function said(o) {
    if (!o) { return; }
    var r = window.Land && Land.reading ? Land.reading() : null;
    // A site said of a work with no documented site is no step at all: the last one stands.
    if (o.step === "site" && o.path !== "life" && o.path !== "sites" && r && r.kind === "work") {
      var SD = sites();
      if (!SD || SD.byW[r.id] === undefined) { return; }
    }
    beat = { view: r ? r.view : -2, o: o, at: performance.now() };
    // A beat said where there is no lens (a city, a museum): said beside the dial.
    kick();
  }
  function resolveBeat(r, b) {
    var o = b.o;
    var now = performance.now();
    // A site exploration's stop, wherever it is read (the work's view, or the life's): where they stood.
    if (o.path === "sites" && o.site) {
      var SR = sites(), row = SR && SR.byId[o.site] !== undefined ? SR.sites[SR.byId[o.site]] : null;
      return row ? siteStep("sites", row, surname(row.a)) : null;
    }
    if (o.path === "life" && r.kind === "life") { return deriveLife(r, now, o); }
    // A movement's walk: at its own city, the movement as the dial has it; away, the one who was there.
    if (o.path === "movement" && r.kind === "movement") {
      var MD = window.Movements && Movements.data ? Movements.data() : null;
      var mm = MD && MD.byId && MD.byId[o.mv] !== undefined ? MD.movements[MD.byId[o.mv]] : null;
      if (!mm || o.key === mm.key) { return deriveMovement(r, now); }
      var city = MD.town && MD.town[mm.key], there = town(o.key), art_ = o.who >= 0 ? MD.artists[o.who] : null;
      var stepA = has(o.y) && o.y < mm.y0 ? "away" : "elsewhere";
      return { path: "movement", step: stepA, key: o.key + o.y, fk: "away" + o.key,
               f: { who: art_ ? surname(art_[1]) : null, place: there ? there.name : null, year: o.y, city: city ? city.name : null,
                    fromLL: there ? there.ll : null, toLL: city ? city.ll : null },
               pic: movementPic(mm, MD, o.y) };
    }
    if (r.kind === "work" && r.work) {
      var w = r.work, who = surname(w.artists[0] || "");
      var last = w.stops[w.stops.length - 1];
      var at = null;
      w.stops.forEach(function (s) { if (o.key && townKeyOf(s) === o.key) { at = s; } });
      var stop = at || last;
      var ll = stop ? [stop.lat, stop.lon] : null;
      var pt = o.key && town(o.key) ? town(o.key).ll : ll;
      if (o.step === "site") {
        var S_ = sites(), i = S_ && S_.byW[r.id];
        if (i === undefined || i === null) { return null; }
        var st = siteStep(o.path === "own" ? "own" : o.path, S_.sites[i], who);
        if (o.path === "own") { st.step = "site"; }
        return st;
      }
      var f = { title: w.title, who: who, place: o.place || (stop ? short(stop.name) : null), ll: pt || ll, year: o.year || null };
      Object.keys(o.f || {}).forEach(function (k) { f[k] = o.f[k]; });
      if (o.step === "arrive" || o.step === "unfound" || o.step === "journey") {
        f.fromLL = o.fromKey && town(o.fromKey) ? town(o.fromKey).ll : null;
        f.toLL = pt || ll;
        if (!f.fromLL) { f.fromLL = f.toLL; }
      }
      return { path: o.path, step: o.step, f: f, key: o.step + ":" + (o.key || "") + ":" + r.id };
    }
    return null;
  }
  function townKeyOf(s) { return s.p || null; }

  /* ---- a view with no lens: the chip, beside the dial ------------------------------ */

  var chipFor = "";
  function chipTick(r) {
    var w = where();
    var b = beat && playing() && performance.now() - beat.at < BEAT_KEEP ? beat.o : null;
    // An exquisite corpse being walked (corpse.js): you, at its edge, then on.
    if (!b && (w.at === "town" || w.at === "museum") && !w.flying && window.Corpse && Corpse._state) {
      var cs = null;
      try { cs = Corpse._state(); } catch (e) { cs = null; }
      if (cs && cs.leg) {
        var lst = cs.leg.stops[cs.leg.stops.length - 1];
        b = lst ? { path: "corpse", step: "stop", key: lst.k, f: { year: lst.y || null } }
          : { path: "corpse", step: "edge", place: w.name || "", f: {} };
      }
    }
    // Following (an animal, or a writer) in a city: close by, with the animal; in their words.
    if (!b && (w.at === "town" || w.at === "museum") && !w.flying) {
      var fol = window.Land && Land.following ? Land.following() : null;
      if (fol) {
        b = fol.voice ? { path: "voice", step: "place", place: w.name || "", f: { voice: fol.artist } }
          : { path: "follow", step: "city", place: w.name || "", f: { animal: fol.animal ? "The " + String(fol.animal).toLowerCase() : "" } };
      }
    }
    // A way on (a walk's journey, a hunt's) is told while it is travelled; anything else once arrived.
    var onTheWay = b && (b.step === "journey" || b.step === "arrive");
    if (!T || !b || (w.at === "world" && !w.flying) || (w.flying && !onTheWay) || (r && r.lens)) { hideChip(); return; }
    var path = b.path, step = b.step, f = {};
    Object.keys(b.f || {}).forEach(function (k) { f[k] = b.f[k]; });
    if (b.place && !f.place) { f.place = b.place; }
    if (!f.place && b.key && town(b.key)) { f.place = town(b.key).name; }
    // A site exploration's stop in its city (no lens there): told as where it is documented.
    if (b.site) {
      var SR = sites(), row = SR && SR.byId[b.site] !== undefined ? SR.sites[SR.byId[b.site]] : null;
      if (row) { var st = siteStep(path, row, surname(row.a)); step = st.step; f = st.f; }
    }
    var rule = ruleOf(path, step);
    if (!rule) { hideChip(); return; }
    var text = fill(rule.caption, f);
    var word = labelOf(rule, distOf(rule.voice, rule.frame), f, false);
    var k = word + "|" + (text || "");
    setUp();
    chip.hidden = false;
    if (k !== chipFor) {
      chipFor = k;
      chipWord.textContent = word;
      chipSay.textContent = "";
      if (text) { italics(text, chipSay); }
      chip.dataset.on = "";
      window.requestAnimationFrame(function () { chip.dataset.on = "true"; });
    }
    // Beside the dial, above it; else at the foot.
    var dial = document.querySelector(".building-time.dial:not([hidden])");
    var rr = dial ? dial.getBoundingClientRect() : null;
    var cw = chip.offsetWidth || 220, ch = chip.offsetHeight || 40;
    var x = rr && rr.width ? Math.max(16, Math.min(window.innerWidth - 16 - cw, rr.left + rr.width / 2 - cw / 2)) : 16;
    var y = rr && rr.width ? rr.top - ch - 10 : window.innerHeight - ch - 76;
    if (y < 80) { y = rr ? rr.bottom + 10 : 80; }
    chip.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    var tw = T.tenses[rule.tense] || "";
    if (window.Land && Land.tense) { Land.tense(tw); }
  }
  function hideChip() { if (chip && !chip.hidden) { chip.hidden = true; delete chip.dataset.on; chipFor = ""; } }
  function hideLens() {
    if (!rim) { return; }
    rim.dataset.on = "false";
    // The caption under the picture goes with the lens: left up, a life's
    // sentence stood over the city entered from it (2 Oct 2026).
    if (cap && !cap.hidden) { cap.hidden = true; capSay._was = null; capSay.textContent = ""; capPic.hidden = true; }
    if (release) { release.hidden = true; }
    S.view = -1;
    swipeList = null;
  }

  /* ---- the viewer in charge ------------------------------------------------------- */

  // Two fingers on the lens (land.js): one voice nearer (+1) or further off (-1), held.
  function nudge(dir) {
    var r = window.Land && Land.reading ? Land.reading() : null;
    if (!r || !T) { return false; }
    var from = held && held.view === r.view ? held.rank : Math.max(0, RANKS.indexOf(S.dist || "panoramic"));
    var to = Math.max(0, Math.min(RANKS.length - 1, from + dir));
    if (to === from) { return false; }
    held = { view: r.view, rank: to, keep: true };
    var f = S.f || {};
    var spec = frameSpec(S.rule ? S.rule.frame : "stop", f, RANKS[to]);
    if (!spec && S.spec) { spec = { voice: RANKS[to], at: S.spec.at, pts: S.spec.pts }; }
    if (spec) { S.spec = spec; S.dist = RANKS[to]; Land.lens(spec); }
    if (S.rule) { setLabel(labelOf(S.rule, RANKS[to], f, true), true); }
    if (stand) { stand.hidden = RANKS[to] !== "first"; }
    return true;
  }
  // A press on the held name: the path's own voice again.
  function letGo() {
    if (!held) { return; }
    held = null;
    S.fk = "";
    S.key = "";
    kick();
  }
  // The world turned by hand in the lens: it stays where it was put until the next step.
  function handled() { cand.at = performance.now(); }

  // A work's Painted here pressed (sites.js's head in the column): where it was painted, in the first person.
  document.addEventListener("click", function (event) {
    var h = event.target && event.target.closest ? event.target.closest(".site-head") : null;
    if (!h) { return; }
    var r = window.Land && Land.reading ? Land.reading() : null;
    var D = sites();
    if (!r || r.kind !== "work" || !D) { return; }
    var i = D.byW[r.id];
    if (i === undefined || i === null) { return; }
    siteTap = { view: r.view, s: D.sites[i], at: performance.now(), pin: r.work ? r.work.pin : -1 };
    S.key = "";
    kick();
  }, true);

  // Read a few times a second; drawn steps on the next frame.
  window.setInterval(tick, 260);
  if (window.requestIdleCallback) { window.requestIdleCallback(function () { load(); sites(); town(""); }, { timeout: 3000 }); }
  else { window.setTimeout(function () { load(); sites(); town(""); }, 1500); }

  window.Voice = {
    load: load,
    said: said,
    nudge: nudge,
    release: letGo,
    handled: handled,
    swapped: function () { placedKey = ""; kick(); },
    // land.js, once the wall label under the picture is filled or put away: the picture's line says
    // only what the label does not.
    relabel: function () { if (lastCap) { setCaption(lastCap[0], lastCap[1], lastCap[2]); } },
    rules: function () { return T; },
    // explorations.js: a sites.json row by its index (a site exploration's stop), once read.
    siteRow: function (i) { var D = sites(); return D ? D.sites[i] || null : null; },
    sitesReady: function () { sites(); return sitesAsk || Promise.resolve(); },
    // placethen.js: a period's works, as the picture swipes through them (once sitesReady), and the swipe itself.
    periodPics: periodPics,
    swipeable: swipeable,
    _state: function () {
      var r = window.Land && Land.reading ? Land.reading() : null;
      var live = S.view !== -1 && !!(r && r.lens);
      return { loaded: !!T, rules: T ? T.n : 0, view: S.view, path: live && S.path || "", step: live && S.step || "", voice: live && S.voice || "",
               distance: live && S.dist || "", held: held ? RANKS[held.rank] : null, label: live && rimWord ? rimWord._to || "" : "",
               caption: live && S.said || "", tense: r && r.on ? null : null,
               chip: chip && !chip.hidden ? chip.textContent : "", lens: r ? { at: r.at, swapped: r.swapped, ground: r.ground } : null };
    }
  };
})();

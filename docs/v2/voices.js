/* The voices — following a writer, a critic or a curator.

   The artist, 1 Oct 2026, on the idea "the quotes are a network of their
   own. Szeemann wrote about Twombly; Szeemann curated shows your saved
   works were in. Writers could become a fourth layer you follow, like the
   animals: follow Roberta Smith through every work she wrote about":
   "Implement your idea about using writers and curators as other ways of
   navigating the globe".

   Who they are (voices.json, voices/<id>.json; scripts/build_voices.py):
   the people the saved works' public record names as having written on a
   work, been quoted on it, or curated a show it was in — never its artist,
   an owner, a dealer, a sale room or a museum. One with two connections or
   more can be followed; one with a single connection is found by Find and
   leads to its one work.

   A voice is followed in the grammar of an animal (land.js, "following a
   voice"), but it is not drawn: it is heard.

   Doors. In a work's view every followable voice's name — a quotation's
   speaker, a writing's author, a show's curator — is a quiet door. Pressed,
   the column opens a lilac-ruled box: "Following Roberta Smith", who they
   are (only what the data says: "writer · Zurich, New York"), their words,
   each with the work it is about; their places in the order of their
   years, each a door (a journey there); and the works they touched. The
   globe lights their cities and draws their path in time order, a faint
   dotted line of pixel light — a career is a route.

   Arriving. In one of their cities, what they said or did about the works
   there is said in the site's serif, one at a time, on the reading's slow
   clock: the first after 4 s of stillness, then 13, 21, 34 s apart (the
   clock moves only while the pointer is still, as the reading's does), each
   with the work, whose picture opens large on a press.

   Up to the world ends it ("Stop following" too); everything else stays
   free: the globe turns, cities open, works open, and the box comes back
   in the next city.

   Where voices meet animals: following an animal, its box lists the voices
   on that artist ("Voices on Cy Twombly"), each a door to following that
   voice instead. Find finds voices ("Szeemann" → "Harald Szeemann · wrote
   on 1 work"). One link: nothing here changes the address. */
(function () {
  "use strict";

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var STILL_MS = 1500;                  // as the reading: still, the pointer unmoved this long
  var FIRST_AT = 4000;                  // arrived, the first of their words
  var GAPS = [13000, 21000, 34000];     // then these apart (the last repeated)
  var LAST_HOLD = 34000;                // the last held this long, then the strip goes

  var index = null, indexing = null;    // voices.json
  var cache = {};                       // voices/<id>.json
  var cur = null;                       // the voice followed: its data
  var movedAt = 0;

  function fold(t) {
    return String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }

  function button(cls, text, go) {
    var b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); go(event); });
    return b;
  }

  function load() {
    if (index) { return Promise.resolve(index); }
    if (!indexing) {
      indexing = fetch("voices.json").then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d) {
            index = d;
            index.byId = {};
            d.voices.forEach(function (v, i) { index.byId[v[0]] = i; v.hay = " " + fold(v[1]); });
          }
          return index;
        }).catch(function () { indexing = null; return null; });
    }
    return indexing;
  }

  function detail(id) {
    if (cache[id]) { return Promise.resolve(cache[id]); }
    return fetch("voices/" + id + ".json").then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { cache[id] = d; } return d; }).catch(function () { return null; });
  }

  function surname(name) {
    var w = String(name).split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* ---- following ---------------------------------------------------------- */

  function follow(id) {
    return detail(id).then(function (d) {
      if (!d || !window.Land || !Land.follow) { return; }
      cur = d;
      said.key = null;
      var ids = {};
      d.works.forEach(function (w) { ids[w[0]] = true; });
      Land.follow({
        voice: d.id, artist: d.name, animal: null, cast: null, home: "", ids: ids,
        map: { places: d.places, works: d.works.map(function (w) { return [w[0], w[1], w[3], w[4]]; }) },
        path: d.path
      });
    });
  }

  function following() {
    var f = window.Land && Land.following && Land.following();
    return f && f.voice && cur && cur.id === f.voice ? cur : null;
  }

  // What they did, in a line: "wrote “Caillebotte’s Space”, 1976" / "curated Van Gogh and the Seasons, 2017".
  function actLine(a) {
    var what = a.r === "c" ? "curated " : "wrote ";
    var t = a.t || a.pub || "";
    var s = what + (t ? (a.r === "c" ? t : "“" + t + "”") : a.r === "c" ? "a show" : "on it");
    if (a.r === "w" && a.pub && a.pub !== t) { s += ", " + a.pub; }
    if (a.at && a.r === "c") { s += ", " + a.at; }
    if (a.y) { s += ", " + a.y; }
    return s;
  }

  function placeName(key) {
    var hit = null;
    (cur && cur.places || []).forEach(function (p) { if (p[0] === key) { hit = p[1]; } });
    return hit;
  }

  // A work, small: its square and its title, a door to its history.
  function workDoor(w, key, line) {
    var b = button("voice-work", "", function () { if (window.Land) { Land.work(w[0], key || undefined); } });
    var img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    if (w[3]) { img.src = CDN + w[3] + "/square.jpg"; }
    b.appendChild(img);
    var txt = el("span", "voice-work-text");
    txt.appendChild(el("i", "", w[1] || "Untitled"));
    txt.appendChild(document.createTextNode(" — " + (w[2] || "") + (w[4] ? ", " + w[4] : "")));
    if (line) { txt.appendChild(el("span", "voice-work-what", line)); }
    b.appendChild(txt);
    return b;
  }

  function quoteFig(s, key) {
    var w = cur.works[s.w];
    var f = el("figure", "voice-q");
    var bq = el("blockquote", "", "“" + s.q + "”");
    if (s.q.length > 260) {
      bq.dataset.long = "true";
      bq.addEventListener("click", function (event) {
        event.stopPropagation();
        if (bq.dataset.open) { delete bq.dataset.open; } else { bq.dataset.open = "true"; }
      });
    }
    f.appendChild(bq);
    var cap = el("figcaption", "voice-q-on");
    cap.appendChild(document.createTextNode("on "));
    cap.appendChild(button("voice-inline", w ? w[1] : "the work", function () {
      if (w && window.Land) { Land.work(w[0], key || undefined); }
    }));
    if (w && w[2]) { cap.appendChild(document.createTextNode(", " + w[2])); }
    if (s.in) { cap.appendChild(el("span", "voice-q-in", s.in.replace(/^in /, ""))); }
    f.appendChild(cap);
    return f;
  }

  /* The box at the head of the column (land.js puts it there). */
  function box(key) {
    var d = following();
    if (!d) { return null; }
    var sec = el("section", "follow-box voice-box");
    sec.appendChild(el("p", "town-section follow-head", "Following " + d.name));
    sec.appendChild(el("p", "town-museum-meta follow-said", d.who));
    var here = key ? itemsAt(key) : [];
    if (here.length) {
      sec.appendChild(el("p", "town-section", "Here · " + here.length));
      here.forEach(function (it) {
        if (it.q) { sec.appendChild(quoteFig(it.q, key)); }
        else { sec.appendChild(workDoor(d.works[it.a.w], key, actLine(it.a) + (it.more ? " · " + plural(it.more + 1, "work", "works") + " here" : ""))); }
      });
    } else if (key) {
      sec.appendChild(el("p", "town-museum-meta", "Nothing of " + surname(d.name) + "’s is recorded here"));
    }
    var words = d.said.filter(function (s) { return !key || s.p !== key; });
    if (words.length) {
      sec.appendChild(el("p", "town-section", (here.length ? "Elsewhere, their words · " : "Their words · ") + words.length));
      words.forEach(function (s, i) {
        var f = quoteFig(s, null);
        if (i >= 2) { f.hidden = true; }
        sec.appendChild(f);
      });
      if (words.length > 2) { sec.appendChild(more(sec, ".voice-q", (words.length - 2) + " more")); }
    }
    sec.appendChild(el("p", "town-section", "Their places, in time · " + d.places.length));
    var go = el("div", "town-near-row follow-route");
    d.places.forEach(function (p) {
      var b = button("town-near", p[1] + (p[8] ? " · " + p[8] : ""), function () {
        if (p[0] !== key && window.Land) { Land.go(p[0]); }
      });
      b.setAttribute("aria-label", p[1] + ", " + p[2] + (p[8] ? ", " + p[8] : "") + " — " + plural(p[5].length, "work", "works"));
      if (p[0] === key) { b.setAttribute("aria-current", "true"); b.dataset.here = "true"; }
      go.appendChild(b);
    });
    sec.appendChild(go);
    sec.appendChild(el("p", "town-section", "The works · " + d.works.length));
    var list = el("div", "voice-works");
    d.works.forEach(function (w, i) {
      var acts = d.acts.filter(function (a) { return a.w === i; });
      var qs = d.said.filter(function (s) { return s.w === i; });
      var line = acts.length ? actLine(acts[0]) + (acts.length > 1 ? " · " + plural(acts.length - 1, "more", "more") : "")
        : qs.length ? "quoted" + (qs[0].y ? ", " + qs[0].y : "") : "";
      var b = workDoor(w, null, line);
      if (i >= 6) { b.hidden = true; }
      list.appendChild(b);
    });
    sec.appendChild(list);
    if (d.works.length > 6) { sec.appendChild(more(list, ".voice-work", "All " + d.works.length + " works")); }
    sec.appendChild(button("read-quiet follow-away", "Stop following " + surname(d.name), function () {
      if (window.Land) { Land.unfollow(); }
    }));
    return sec;
  }

  function more(host, sel, words) {
    var b = button("art-more-all", words, function () {
      host.querySelectorAll(sel).forEach(function (n) { n.hidden = false; });
      b.remove();
    });
    return b;
  }

  /* What they said or did about the works in a city: quotations first, then
     their writings and shows, a show once with its count of works here. */
  function itemsAt(key) {
    if (!cur) { return []; }
    var out = [];
    cur.said.forEach(function (s) { if (s.p === key) { out.push({ q: s }); } });
    var shows = {};
    cur.acts.forEach(function (a) {
      if (a.p !== key) { return; }
      if (a.r === "c") {
        var k = fold(a.t);
        if (shows[k]) { shows[k].more += 1; return; }
        shows[k] = { a: a, more: 0 };
        out.push(shows[k]);
        return;
      }
      out.push({ a: a, more: 0 });
    });
    return out;
  }

  /* ---- arriving: their words, on the slow clock ---------------------------- */

  var strip = null, said = { key: null, items: [], i: -1, clock: 0, next: FIRST_AT, last: 0 };

  function makeStrip() {
    if (strip) { return strip; }
    strip = el("aside", "voice-strip");
    strip.hidden = true;
    strip.setAttribute("aria-live", "polite");
    strip.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    strip.addEventListener("wheel", function (event) { event.stopPropagation(); }, { passive: true });
    place();
    return strip;
  }
  // The strip is the dial's readout now (transport.js): beside the dial, never over the picture.
  function place() {
    if (window.Dial && Dial.read) { Dial.read(strip, { join: !!said.joined }); } else if (!strip.parentNode) { document.body.appendChild(strip); }
  }

  /* Their words in a city are a path on the dial: each a stop (in order: words have no year of their
     own here), the face pausing the slow clock, the ring going from one to another, × letting them go.
     While another path plays (a voice's route, a walk), they are said under its lines instead, and its
     pause holds their clock too. */
  var dial = null;
  function onDial() {
    if (dial) { dial.close(); dial = null; }
    if (!window.Dial || !Dial.path || !said.items.length) { return; }
    // Under a path playing, or one just ended whose doors are up: said under it, not a path of their own.
    if ((Dial.live && Dial.live()) || (Dial.ending && Dial.ending())) { said.joined = true; Dial.read(makeStrip(), { join: true }); return; }
    said.joined = false;
    var key = said.key;
    function live() { return said.key === key && dial; }
    dial = Dial.path({
      kind: "voice", title: (cur ? surname(cur.name) : "Their words") + " in " + (placeName(key) || "this city"),
      at: Math.max(0, said.i), read: makeStrip(), paused: !!said.paused,
      stops: said.items.map(function (it) {
        var w = cur && cur.works[it.q ? it.q.w : it.a.w];
        return { label: w ? w[1] || "Untitled" : "" };
      }),
      onToggle: function () { if (!live()) { return; } said.paused = !said.paused; said.last = performance.now(); dial.set({ paused: said.paused }); },
      onSeek: function (i, play) { if (!live()) { return; } said.paused = !play && !!said.paused; said.i = i - 1; step(true); },
      onNext: function () { if (live()) { step(true); } },
      onEnd: function () { if (live()) { said.items = []; hideStrip(); } }
    });
  }
  // Held by the dial: their own pause, or the pause of the path they are said under.
  function heldByDial() { return !!said.paused || !!(said.joined && window.Dial && Dial.paused && Dial.paused()); }

  function sayItem(it, n, of) {
    var s = makeStrip();
    s.textContent = "";
    var head = el("p", "voice-strip-head", surname(cur.name) + " in " + (placeName(said.key) || "this city") +
                  (of > 1 ? " · " + n + " of " + of : ""));
    s.appendChild(head);
    var row = el("div", "voice-strip-row");
    var w = cur.works[it.q ? it.q.w : it.a.w];
    if (w) {
      var pic = button("voice-strip-pic", "", function () { if (window.Land) { Land.work(w[0], said.key); } });
      pic.setAttribute("aria-label", "Open " + (w[1] || "the work"));
      var img = el("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      if (w[3]) { img.src = CDN + w[3] + "/square.jpg"; }
      pic.appendChild(img);
      row.appendChild(pic);
    }
    var txt = el("div", "voice-strip-text");
    if (it.q) {
      var q = el("p", "voice-strip-said", "“" + it.q.q + "”");
      if (it.q.q.length > 240) {
        q.dataset.long = "true";
        q.addEventListener("click", function () { if (q.dataset.open) { delete q.dataset.open; } else { q.dataset.open = "true"; } });
      }
      txt.appendChild(q);
    } else {
      txt.appendChild(el("p", "voice-strip-said", actLine(it.a) + (it.more ? " — " + plural(it.more + 1, "work", "works") + " here" : "")));
    }
    var on = el("p", "voice-strip-on");
    on.appendChild(document.createTextNode("on "));
    if (w) { on.appendChild(el("i", "", w[1] || "Untitled")); on.appendChild(document.createTextNode(w[2] ? ", " + w[2] : "")); }
    var src = it.q ? (it.q.in || "").replace(/^in /, "") : "";
    // Where the record does not say where it was written, it is placed with the work: said so.
    var pr = it.q ? it.q.pr : it.a.pr;
    var how = pr === "held" ? "placed where the work is held" : pr === "work" ? "placed where the work was then" : "";
    [src, how].filter(Boolean).forEach(function (x) { on.appendChild(el("span", "voice-strip-in", x)); });
    txt.appendChild(on);
    row.appendChild(txt);
    s.appendChild(row);
    // Under reduced motion, said under a played path's count (whose dial steps the path, not them):
    // the next of their words is a door here.
    if (still && said.joined && said.i < said.items.length - 1) {
      s.appendChild(button("read-quiet voice-next", "Next ›", function () { step(true); }));
    }
    s.hidden = false;
    place();
    if (dial) { dial.set({ at: n - 1, paused: !!said.paused }); }
    s.dataset.on = "";
    window.requestAnimationFrame(function () { s.dataset.on = "true"; });
  }

  function hideStrip() {
    if (strip) { strip.hidden = true; strip.textContent = ""; }
    if (dial) { dial.close(); dial = null; }
  }

  function arrive(key) {
    said.key = key;
    said.items = itemsAt(key);
    said.i = -1;
    said.clock = 0;
    said.next = FIRST_AT;
    said.last = performance.now();
    said.paused = false;
    hideStrip();
    onDial();
    if (still && said.items.length) { step(true); }
  }

  function step(force) {
    said.i += 1;
    if (said.i >= said.items.length) { hideStrip(); return; }
    sayItem(said.items[said.i], said.i + 1, said.items.length);
    said.next = said.clock + (said.i + 1 < said.items.length ? GAPS[Math.min(said.i, GAPS.length - 1)] : LAST_HOLD);
  }

  function poll() {
    var d = following();
    var now = performance.now();
    if (!d) {
      if (said.key) { said.key = null; hideStrip(); }
      return;
    }
    var w = Land.where();
    if (w.flying) { said.last = now; return; }
    if (w.at === "town" && w.key) {
      if (w.key !== said.key) { arrive(w.key); }
    } else if (w.at === "world") {
      said.key = null;
      hideStrip();
      return;
    }
    if (still || !said.items.length) { said.last = now; return; }
    // The clock moves only while the pointer is still, and not while the dial holds it. (Said under a
    // path that has ended, they stay under its readout and its doors for the rest of this city.)
    if (now - movedAt >= STILL_MS && !heldByDial()) { said.clock += now - said.last; }
    said.last = now;
    if (said.clock >= said.next) { step(false); }
  }

  /* ---- doors: the names in a work's view ---------------------------------- */

  function wrapText(host, spelling, make) {
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentNode && node.parentNode.closest && node.parentNode.closest(".voice-door")) { continue; }
      var i = node.nodeValue.indexOf(spelling);
      if (i < 0) { continue; }
      var after = node.splitText(i);
      after.nodeValue = after.nodeValue.slice(spelling.length);
      node.parentNode.insertBefore(make(spelling), after);
      return true;
    }
    return false;
  }

  function door(row) {
    return function (text) {
      var b = button("voice-door", text, function () { follow(row[0]); });
      b.title = "Follow " + row[1] + " · " + row[5];
      b.setAttribute("aria-label", "Follow " + row[1] + " — " + row[5]);
      return b;
    };
  }

  var col = document.getElementById("art-col");
  var dooring = 0;

  function doors() {
    dooring = 0;
    if (!col || !window.Land || !Land.where) { return; }
    var w = Land.where();
    if (w.at !== "work" || !w.work) { return; }
    load().then(function (ix) {
      if (!ix) { return; }
      var list = ix.w[w.work];
      if (!list) { return; }
      list.forEach(function (pair) {
        var row = ix.voices[pair[0]];
        if (!row || row[6] !== 1) { return; }
        var spellings = pair[1].slice().sort(function (a, b) { return b.length - a.length; });
        // A quotation's speaker: the whole name, its own line.
        col.querySelectorAll(".art-said-who").forEach(function (who) {
          if (who.querySelector(".voice-door")) { return; }
          if (spellings.some(function (s) { return fold(s) === fold(who.textContent); })) {
            var text = who.textContent;
            who.textContent = "";
            who.appendChild(door(row)(text));
          }
        });
        // A writing's author, a show's curator: where the line spells the name.
        col.querySelectorAll(".art-cite, .art-line .art-what, .art-more").forEach(function (host) {
          if (host.dataset["voice" + pair[0]]) { return; }
          for (var k = 0; k < spellings.length; k += 1) {
            if (wrapText(host, spellings[k], door(row))) { host.dataset["voice" + pair[0]] = "1"; return; }
          }
        });
      });
      // A voice the column does not spell (a curator named only in the show's
      // press release): a quiet line of its own, above the places.
      var missing = list.filter(function (pair) {
        var row = ix.voices[pair[0]];
        return row && row[6] === 1 && !col.querySelector('.voice-door[aria-label^="Follow ' + row[1].replace(/"/g, "") + ' "]');
      });
      var also = col.querySelector(".voice-also");
      if (!missing.length || (also && also.dataset.work === w.work)) { return; }
      if (also) { also.remove(); }
      var heads = [].slice.call(col.querySelectorAll(".art-section-head")).filter(function (h) { return /^(Where it has been|Its history)/.test(h.textContent); });
      if (!heads.length) { return; }
      var sec = el("section", "voice-also");
      sec.dataset.work = w.work;
      sec.appendChild(el("p", "art-section-head", "Voices"));
      missing.forEach(function (pair) {
        var row = ix.voices[pair[0]];
        var p = el("p", "voice-also-one");
        p.appendChild(door(row)(row[1]));
        p.appendChild(document.createTextNode(" · " + row[5]));
        sec.appendChild(p);
      });
      var at = heads[0].parentNode === col ? heads[0] : heads[0].parentNode;
      at.parentNode.insertBefore(sec, at);
    });
  }

  /* ---- where voices meet animals ------------------------------------------ */

  function animalBox() {
    var f = window.Land && Land.following && Land.following();
    if (!f || f.voice || !col) { return; }
    var fb = col.querySelector(".follow-box");
    if (!fb || fb.querySelector(".voices-on")) { return; }
    load().then(function (ix) {
      var list = ix && ix.a[f.artist];
      if (!list || !list.length || fb.querySelector(".voices-on")) { return; }
      var sec = el("div", "voices-on");
      sec.appendChild(el("p", "town-section", "Voices on " + f.artist + " · " + list.length));
      var row = el("div", "town-near-row");
      list.forEach(function (i) {
        var v = ix.voices[i];
        var b = button("town-near", v[1], function () { follow(v[0]); });
        b.setAttribute("aria-label", "Follow " + v[1] + " — " + v[5]);
        row.appendChild(b);
      });
      sec.appendChild(row);
      var away = fb.querySelector(".follow-away");
      fb.insertBefore(sec, away || null);
    });
  }

  /* ---- Find ---------------------------------------------------------------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");

  function findVoices(text) {
    var toks = fold(text).split(" ").filter(Boolean);
    if (!toks.length || fold(text).length < 3) { return []; }
    return index.voices.filter(function (v) {
      return toks.every(function (t) { return v.hay.indexOf(" " + t) >= 0; });
    }).sort(function (a, b) { return (b[6] === 1) - (a[6] === 1) || b[3] - a[3]; }).slice(0, 4);
  }

  function offerInFind() {
    if (!field || !found || found.querySelector(".voice-found")) { return; }
    var text = field.value;
    load().then(function (ix) {
      if (!ix || field.value !== text || found.querySelector(".voice-found")) { return; }
      var hits = findVoices(text);
      if (!hits.length) { return; }
      var host = el("div", "voice-found");
      host.appendChild(el("p", "finder-group", "Voices"));
      hits.forEach(function (v) {
        var b = el("button", "finder-row finder-line");
        b.type = "button";
        b.textContent = v[1] + " · " + v[5] + (v[6] === 1 && v[4] ? " · " + plural(v[4], "city", "cities") : "");
        b.addEventListener("click", function () {
          if (v[6] === 1) { follow(v[0]); } else if (window.Land) { Land.work(v[6]); }
        });
        host.appendChild(b);
      });
      var walk = found.querySelector(".walk-found");
      found.insertBefore(host, walk ? walk.nextSibling : found.firstChild);
      var saidEl = document.getElementById("finder-said");
      if (saidEl && /^Nothing/.test(saidEl.textContent)) { saidEl.textContent = "Found · " + plural(hits.length, "voice", "voices"); }
    });
  }

  /* ---- wiring --------------------------------------------------------------- */

  window.addEventListener("pointermove", function () { movedAt = performance.now(); }, { capture: true, passive: true });
  window.addEventListener("pointerdown", function () { movedAt = performance.now(); }, { capture: true, passive: true });
  window.addEventListener("wheel", function () { movedAt = performance.now(); }, { capture: true, passive: true });
  window.setInterval(poll, 400);

  if (col && window.MutationObserver) {
    new MutationObserver(function () {
      if (!dooring) { dooring = window.requestAnimationFrame(doors); }
      animalBox();
    }).observe(col, { childList: true, subtree: true });
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offerInFind, 300); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && fold(field.value).length >= 3) { offerInFind(); } })
      .observe(found, { childList: true });
  }

  window.Voices = {
    box: box,
    follow: follow,
    unfollowed: function () { cur = null; said.key = null; hideStrip(); },
    _state: function () {
      return { following: cur && cur.id, key: said.key, i: said.i, n: said.items.length,
               strip: strip && !strip.hidden ? strip.textContent : "" };
    },
    _pace: function (k) { FIRST_AT *= k; GAPS = GAPS.map(function (g) { return g * k; }); }
  };
})();

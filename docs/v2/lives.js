/* The lives — an artist's life drawn on the map.

   The artist, 2 Oct 2026, on "Picasso's 1895–1973 route through his
   studios is a life drawn on a map. Played beside the hunts, Bloch's
   catalogue of his prints and the studios where each print was pulled
   would meet, the catalogue and the workshop on the same map": "Implement
   your idea for Picasso. Find other similar instances for notable artists
   alike so that viewers can focus on lives of artists".

   lives.json and lives/<id>.json (scripts/build_lives.py): each life as
   periods — a town and its years, with the evidence that puts the artist
   there (a dated place of the studios, a sentence of Wikipedia, a work's
   own record, born, died; a year with none carried from the last named,
   and said so) — the saved works placed in the period of their year, with
   their workshops and catalogue numbers, Painted here's outings, the
   voices writing then, the shows, the works' afterlife, and the other
   lives it crosses.

   Opened (Land.life): the world framed on the whole route, the route
   drawn faintly in pixel light (born → the places → died), each place an
   atelier lit as the dial passes it, the place of the year ringed; the
   dial is the life's years, born to now — after the death the works'
   afterlife, quieter. The column is the places in order, the one of the
   dial's year open: its evidence, its studios, the works made then (later
   ones let down), the prints with their numbers and the workshop that
   pulled them, the outings, who was writing, the lives it crosses. "Enter"
   goes down into the place, its period's column alone. Played (an
   exploration of kind "life"), each period is a stop, flown to along the
   great circle; its works said in turn. */
(function () {
  "use strict";

  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var LILAC = "#9d95e6", CREAM = "#eadfcd", C = 13;
  var NOW = 2026;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var D = null, loading = null, files = {};
  var view = null;                       // the life open: { L, api, k (period), rows }
  var visit_ = null;                     // a period entered: { L, k, box }

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
  /* A name bare of a trailing parenthesis ("(b. 1981)", "(1757-1827)"). */
  function bareName(a) { return String(a || "").replace(/\s*\([^)]*\)\s*$/, "").trim(); }
  var CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
  /* The name a sentence calls them by: the surname, or for a name written in
     its own script as well ("Li Qing 李青") the whole Latin name, since the
     family name may come first. */
  function surname(a) {
    var s = bareName(a), east = CJK.test(s);
    var w = s.split(/\s+/).filter(function (x) { return x && !CJK.test(x); }), k = w.length - 1;
    if (east || k < 0) { return w.join(" ") || s; }
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function possessive(a) { var s = surname(a); return s + (/s$/.test(s) ? "’" : "’s"); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function span(p) { return p.y0 === p.y1 ? String(p.y0) : p.y0 + "–" + p.y1; }
  function where() { return window.Land && Land.where ? Land.where() : { at: "world" }; }

  function load() {
    if (D) { return Promise.resolve(D); }
    if (loading) { return loading; }
    loading = fetch("lives.json").then(function (r) { if (!r.ok) { throw new Error("lives"); } return r.json(); })
      .then(function (d) {
        d.byName = {};
        d.byId = {};
        d.lives.forEach(function (r, i) { d.byName[r[1]] = i; d.byId[r[0]] = i; });
        // Also by the name bare of its trailing years ("Li Qing 李青 (b. 1981)" is kinds.json's "Li Qing 李青").
        d.lives.forEach(function (r, i) { var b = bareName(r[1]); if (d.byName[b] === undefined) { d.byName[b] = i; } });
        D = d;
        return D;
      }).catch(function () { loading = null; return null; });
    return loading;
  }
  var lifeNow = {};               // the lives read, for a caller that cannot wait (land.js's map)
  function life(id) {
    if (files[id]) { return files[id]; }
    files[id] = fetch("lives/" + id + ".json").then(function (r) { if (!r.ok) { throw new Error(id); } return r.json(); })
      .then(function (L) { lifeNow[id] = L; return L; })
      .catch(function () { delete files[id]; return null; });
    return files[id];
  }
  function rowOf(name) { return D && D.byName[name] !== undefined ? D.lives[D.byName[name]] : null; }

  /* What puts the artist there, in a few words. */
  var HOW = { range: "a dated place", said: "Wikipedia", record: "a work’s record", born: "born", died: "died" };
  function howLine(p) {
    var h = p.how.filter(function (x) { return x !== "born" && x !== "died"; }).map(function (x) { return HOW[x]; });
    var yrs = p.y1 - p.y0 + 1;
    var line = h.length ? "By " + h.join(", ") : p.how.indexOf("born") >= 0 ? "Born here" : "Died here";
    if (p.carried && p.carried >= yrs - 0) { line += " · carried: the last place the record names"; }
    else if (p.carried) { line += " · " + plural(p.carried, "year", "years") + " carried from the last place named"; }
    return line;
  }
  function firstQuote(p) {
    var s = (p.src || []).filter(function (x) { return x.q && (x.how === "said" || x.how === "range"); })[0] ||
            (p.src || []).filter(function (x) { return x.q; })[0];
    return s || null;
  }

  /* ---- opening a life -------------------------------------------------------- */

  function open(id, opts) {
    opts = opts || {};
    return load().then(function () { return life(id); }).then(function (L) {
      if (!L || !window.Land || !Land.life) { return; }
      // Already open: only the year.
      if (view && view.L.id === id && view.api.live()) { if (opts.year) { view.api.setYear(opts.year); } return; }
      var pts = [];
      if (L.b) { pts.push(L.b[1]); }
      L.periods.forEach(function (p) { pts.push(p.ll); });
      if (L.d) { pts.push(L.d[1]); }
      pending = { id: id, year: opts.year || null };
      Land.life({ id: id, title: L.name, where: "A life · " + L.born + "–" + (L.died || ""), pts: pts });
    });
  }
  var pending = null;

  // The Artists layer: a mark is one artist's birthplace (their life), or a town where several were born (the list).
  function openMark(m) {
    return load().then(function () {
      if (!D || !window.Land) { return; }
      if (m[4].length === 1) { open(D.lives[m[4][0]][0]); return; }
      Land.life({ id: "born:" + m[7], title: "Born in " + m[7], where: plural(m[4].length, "saved artist", "saved artists"),
                  pts: [[m[0], m[1]]], born: m });
    });
  }

  function bornColumn(api) {
    var m = api.data.born, col = api.col;
    col.textContent = "";
    var box = el("section", "life-box");
    box.appendChild(el("p", "town-section life-kicker", "Born here"));
    box.appendChild(el("p", "studio-title", m[7]));
    box.appendChild(el("p", "studio-exact", plural(m[4].length, "saved artist was", "saved artists were") +
      " born in or near " + m[7] + ", as Wikidata has it · most saved first"));
    col.appendChild(box);
    var list = el("ol", "studio-route life-born");
    m[4].forEach(function (i) {
      var r = D.lives[i];
      var li = el("li");
      var b = button("", "studio-stop", function () { open(r[0]); });
      b.appendChild(el("span", "studio-stop-name", r[1]));
      b.appendChild(el("span", "studio-stop-meta", [r[10], r[2] + "–" + (r[3] || ""), plural(r[5], "saved work", "saved works"),
        r[9] ? plural(r[4], "place", "places") : ""].filter(Boolean).join(" · ")));
      li.appendChild(b);
      list.appendChild(li);
    });
    col.appendChild(list);
    api.foot();
  }

  // land.js: down at the life's view.
  function start(api) {
    if (api.data.born) {
      view = null;
      bornAt = api;
      load().then(function () { if (api.live()) { bornColumn(api); kick(); } });
      return;
    }
    bornAt = null;
    var id = api.data.id;
    life(id).then(function (L) {
      if (!L || !api.live()) { return; }
      var at = pending && pending.id === id ? pending.year : null;
      pending = null;
      view = { L: L, api: api, k: -2, rows: [], y: null };
      column(view);
      var ticks = [];
      L.periods.forEach(function (p) { ticks.push({ y: p.y0 }); });
      if (L.died) { ticks.push({ y: L.died, kind: "written" }); }
      var seen = {};
      (L.after || []).forEach(function (a) {
        var dec = Math.floor(a[0] / 5) * 5;
        if (!seen[dec]) { seen[dec] = true; ticks.push({ y: a[0], kind: "after" }); }
      });
      api.years(L.born, NOW, ticks, at || L.died || NOW, !at);
      kick();
    });
  }
  var bornAt = null;
  function stop() {
    view = null;
    bornAt = null;
    kick();
  }

  /* The year: the dial's, read each frame; the column and the globe follow. */
  function periodAt(L, y) {
    for (var k = 0; k < L.periods.length; k += 1) {
      var p = L.periods[k];
      if (p.y0 <= y && y <= p.y1) { return k; }
    }
    return y > (L.died || NOW) ? -1 : -2;
  }

  function follow() {
    if (!view || !view.api.live()) { return; }
    var y = view.api.year();
    if (y === null || y === view.y) { return; }
    view.y = y;
    var k = periodAt(view.L, y);
    if (k !== view.k) {
      view.k = k;
      markPeriod(view, true);
    }
    laterWorks(view);
    if (view.yearEl) { view.yearEl.textContent = yearWords(view, y); }
  }

  function yearWords(v, y) {
    var L = v.L, k = periodAt(L, y);
    if (y < L.born) { return ""; }
    if (L.died && y > L.died) { return y + " · " + (y - L.died) + " years after · the works’ journeys"; }
    if (k < 0) { return String(y); }
    var p = L.periods[k];
    return y + " · " + p.place + (L.born ? " · age " + (y - L.born) : "");
  }

  /* ---- the column ------------------------------------------------------------ */

  function column(v) {
    var L = v.L, col = v.api.col;
    col.textContent = "";
    var box = el("section", "life-box");
    box.appendChild(el("p", "town-section life-kicker", "A life"));
    box.appendChild(el("p", "studio-title", L.name));
    var ends = [L.born + (L.b ? " " + L.b[0] : ""), L.died ? L.died + (L.d ? " " + L.d[0] : "") : "living"].join(" — ");
    box.appendChild(el("p", "studio-by", ends));
    var nPrinted = L.works.filter(function (w) { return w.length > 8; }).length;
    var counts = [plural(L.periods.length, "place", "places"), plural(L.works.length, "saved work", "saved works")];
    if (nPrinted) { counts.push(nPrinted + " printed at " + plural(L.workshops.length, "workshop", "workshops")); }
    if (L.cross.length) {
      var who = {};
      L.cross.forEach(function (c) { who[c[0]] = true; });
      counts.push("crosses " + plural(Object.keys(who).length, "life", "lives"));
    }
    box.appendChild(el("p", "studio-exact", counts.join(" · ")));
    v.yearEl = el("p", "life-year");
    v.yearEl.setAttribute("aria-live", "polite");
    box.appendChild(v.yearEl);
    if (window.Explorations && Explorations.play) {
      box.appendChild(button("Play the life · " + plural(L.periods.length, "stop", "stops") + " ›", "read-quiet life-play", function () { play(L); }));
    }
    col.appendChild(box);

    // The places, in order: each a head that turns the dial to it.
    col.appendChild(el("p", "art-section-head", "Where the life was · " + plural(L.periods.length, "place", "places")));
    var ol = el("ol", "life-periods");
    v.rows = L.periods.map(function (p, k) {
      var li = el("li", "life-period");
      li.dataset.k = String(k);
      var hd = button("", "life-period-head", function () {
        v.api.setYear(p.y0);
        v.api.glide(p.ll[0], p.ll[1]);
        open1(v, k);
      });
      hd.appendChild(el("span", "studio-stop-name", p.place));
      hd.appendChild(el("span", "studio-stop-meta", span(p) + " · " + howLine(p)));
      li.appendChild(hd);
      var go = button("Enter ›", "art-go life-enter", function () { enter(L.id, k); });
      go.setAttribute("aria-label", "Go down into " + p.place + ", " + span(p));
      li.appendChild(go);
      var body = el("div", "life-period-body");
      body.hidden = true;
      li.appendChild(body);
      ol.appendChild(li);
      return { li: li, body: body, filled: false };
    });
    col.appendChild(ol);

    if (L.undated.length) {
      col.appendChild(el("p", "town-museum-meta life-undated", "Also named, with no years: " +
        L.undated.map(function (u) { return u[0]; }).join(", ")));
    }

    // The workshops: where the prints were pulled.
    if (L.workshops.length) {
      col.appendChild(el("p", "art-section-head", "The workshops · " + L.workshops.length));
      var wl = el("ol", "studio-route life-shops");
      L.workshops.slice().sort(function (a, b) { return b[4] - a[4]; }).forEach(function (s) {
        var li = el("li");
        var b = button("", "studio-stop", function () {
          var y = s[5] || L.born;
          v.api.setYear(y);
          if (s[3]) { v.api.glide(s[3][0], s[3][1]); }
        });
        b.appendChild(el("span", "studio-stop-name", s[0] + (s[1] ? ", " + s[1] : "")));
        b.appendChild(el("span", "studio-stop-meta", [plural(s[4], "print", "prints"), s[5] ? (s[5] === s[6] ? s[5] : s[5] + "–" + s[6]) : ""].filter(Boolean).join(" · ")));
        li.appendChild(b);
        wl.appendChild(li);
      });
      col.appendChild(wl);
    }

    // After: the works' journeys; the hunts and the walks that carry them on.
    if (L.died) {
      var nAfter = (L.after || []).reduce(function (s, a) { return s + a[2]; }, 0);
      var cities = {};
      (L.after || []).forEach(function (a) { cities[a[1]] = true; });
      col.appendChild(el("p", "art-section-head", "After · " + L.died + "–" + NOW));
      col.appendChild(el("p", "town-museum-meta life-after",
        nAfter ? "The works went on: " + plural(nAfter, "event", "events") + " in " + plural(Object.keys(cities).length, "city", "cities") + " after " + L.died + " — turn the dial past the death"
               : "No journey of the works after " + L.died + " is recorded"));
      afterDoors(col, L);
    }
    var src = el("p", "art-sources life-src", "From Wikidata (born, died); the studios; the English Wikipedia article, quoted; the saved works’ own records; Painted here. A year with no evidence is carried from the last place named.");
    col.appendChild(src);
    v.api.foot();
    v.k = -2;
  }

  function afterDoors(col, L) {
    var row = el("div", "life-doors");
    (L.hunts || []).forEach(function (h) {
      row.appendChild(button(h[1].replace(/ · /, " · ") + " ›", "read-quiet life-door", function () {
        if (window.Explorations && Explorations.hunt) { Explorations.hunt(h[0]); }
      }));
    });
    (L.walks || []).forEach(function (w) {
      row.appendChild(button(w[1] + " ›", "read-quiet life-door", function () {
        if (!window.Walks || !Walks.play) { return; }
        fetch("characters/walks.json").then(function (r) { return r.json(); }).then(function (d) {
          var x = (d.walks || []).filter(function (o) { return o.id === w[0]; })[0];
          if (x) { Walks.play(x); }
        }).catch(function () {});
      }));
    });
    if (row.children.length) { col.appendChild(row); }
  }

  function open1(v, k) {
    v.rows.forEach(function (r, j) {
      if (j === k) { fillPeriod(v.L, k, r.body, v); r.body.hidden = false; r.li.dataset.open = "true"; }
    });
  }

  function markPeriod(v, scroll) {
    v.rows.forEach(function (r, j) {
      if (j === v.k) {
        r.li.dataset.current = "true";
        if (!r.filled) { fillPeriod(v.L, j, r.body, v); r.filled = true; }
        r.body.hidden = false;
        if (scroll && performance.now() - handAt > 1500) {
          var col = v.api.col;
          var top = r.li.offsetTop - 8;
          programmatic = performance.now();
          try { col.scrollTo({ top: top, behavior: still ? "auto" : "smooth" }); } catch (e) { col.scrollTop = top; }
        }
      } else {
        delete r.li.dataset.current;
        if (!r.li.dataset.open) { r.body.hidden = true; }
      }
    });
    var p = v.L.periods[v.k];
    if (p && scroll) { v.api.glide(p.ll[0], p.ll[1]); }
  }

  function laterWorks(v) {
    var y = v.y;
    (v.api.col.querySelectorAll("[data-y]") || []).forEach(function (e) {
      if (Number(e.dataset.y) > y) { e.dataset.later = "true"; } else { delete e.dataset.later; }
    });
  }

  // A period's own matter: its evidence, its studios, the works made then,
  // the prints and their workshops, the outings, who wrote, the crossings.
  function fillPeriod(L, k, body, v) {
    body.textContent = "";
    var p = L.periods[k];
    var q = firstQuote(p);
    if (q) {
      var one = el("div", "art-said-one life-q");
      one.dataset.k = "wiki";
      one.appendChild(el("p", "art-said-q", "“" + q.q + "”"));
      var by = el("p", "art-said-by");
      by.appendChild(el("span", "art-said-who", q.name || ""));
      if (q.url && /^https?:\/\//.test(q.url)) {
        var a = el("a", "art-go", "Read it ↗");
        a.href = q.url;
        a.target = "_blank";
        a.rel = "noopener";
        by.appendChild(document.createTextNode(" "));
        by.appendChild(a);
      }
      one.appendChild(by);
      body.appendChild(one);
    }
    (p.at || []).forEach(function (s) {
      var line = s.name + " · " + (s.y[0] === s.y[1] ? s.y[0] : s.y[0] + "–" + s.y[1]) + (s.kind ? " · " + s.kind : "");
      if (s.studio !== null && s.studio !== undefined && window.Studios && Studios.open) {
        body.appendChild(button(line + " ›", "read-quiet life-studio", function () { Studios.open(s.studio); }));
      } else {
        body.appendChild(el("p", "town-museum-meta life-at", line));
      }
    });
    var made = p.works.filter(function (i) { return L.works[i].length <= 8; });
    var printed = p.prints;
    if (made.length) {
      var hows = {};
      made.forEach(function (i) { var h = (L.works[i][4] || "dated").split(":")[0]; hows[h] = (hows[h] || 0) + 1; });
      body.appendChild(el("p", "town-section", "Made then · " + made.length));
      body.appendChild(el("p", "town-museum-meta studio-how", Object.keys(hows).sort().map(function (h) {
        return hows[h] + " " + ({ record: "by its own record", site: "painted at a documented site", dated: "dated within these years" }[h] || h);
      }).join(" · ")));
      var th = el("div", "town-thumbs studio-works life-works");
      made.slice(0, 55).forEach(function (i) { th.appendChild(square(L, i, p)); });
      body.appendChild(th);
    }
    if (printed.length) {
      body.appendChild(el("p", "town-section", "Printed then · " + printed.length));
      var list = el("div", "life-prints");
      printed.slice(0, 34).forEach(function (i) {
        var w = L.works[i];
        var r = button("", "life-print", function () { if (window.Land) { Land.work(w[0], p.key); } });
        r.dataset.y = String(w[2] || 0);
        r.dataset.work = w[0];
        var sq = el("span", "life-print-sq");
        if (w[3]) {
          var im = el("img");
          im.alt = "";
          im.loading = "lazy";
          im.referrerPolicy = "no-referrer";
          im.src = CDN + w[3] + "/square.jpg";
          im.addEventListener("error", function () { sq.dataset.none = "true"; });
          sq.appendChild(im);
        }
        r.appendChild(sq);
        var t = el("span", "life-print-t");
        t.appendChild(el("i", "", w[1]));
        t.appendChild(document.createTextNode(w[2] ? ", " + w[2] : ""));
        r.appendChild(t);
        r.appendChild(el("span", "life-print-m", [(w[7] || []).join(" · "), "pulled at " + w[8][0] + (w[8][1] ? ", " + w[8][1] : "")].filter(Boolean).join(" · ")));
        list.appendChild(r);
      });
      body.appendChild(list);
    }
    if (p.sites.length) {
      body.appendChild(el("p", "town-section", "Outings · painted here · " + p.sites.length));
      var sl = el("div", "town-near-row life-sites");
      p.sites.slice(0, 13).forEach(function (si) {
        var s = L.sites[si];
        sl.appendChild(button((s[3] || s[1]) + (s[2] ? " · " + s[2] : ""), "town-near", function () {
          if (window.Land && Land.site && s[7]) { Land.site(s[7], s[4][0], s[4][1], 1.2, s[3] || s[1]); }
        }));
      });
      body.appendChild(sl);
    }
    if (p.voices.length) {
      var vs = p.voices.map(function (i) { return L.voices[i]; });
      body.appendChild(el("p", "town-section", "Writing on " + surname(L.name) + " then · " + vs.length));
      var vl = el("div", "town-near-row life-voices");
      vs.slice(0, 8).forEach(function (r) {
        var b = button(r[1] + " · " + r[2], "town-near", function () {
          if (r[5] && window.Voices && Voices.follow) { Voices.follow(r[0]); }
          else if (window.Land) { Land.work(r[4]); }
        });
        b.dataset.y = String(r[2]);
        vl.appendChild(b);
      });
      body.appendChild(vl);
    }
    if (p.shows.length) {
      var sh = p.shows.map(function (i) { return L.shows[i]; });
      body.appendChild(el("p", "town-museum-meta life-shows", "Shown then · " + sh.slice(0, 3).map(function (s) {
        return s[1] + (s[3] ? ", " + s[3] : "") + ", " + s[0];
      }).join(" · ") + (sh.length > 3 ? " · " + (sh.length - 3) + " more" : "")));
    }
    if (p.cross.length) {
      body.appendChild(el("p", "town-section life-cross-head", "Lives that cross here"));
      var cl = el("div", "life-crosses");
      p.cross.forEach(function (ci) {
        var c = L.cross[ci];
        var yrs = c[4] === c[5] ? c[4] : c[4] + "–" + c[5];
        cl.appendChild(button(surname(L.name) + " and " + c[1] + " in " + c[3] + ", " + yrs + " ›", "read-quiet life-cross", function () {
          open(c[0], { year: c[4] });
        }));
      });
      body.appendChild(cl);
    }
  }

  function square(L, i, p) {
    var w = L.works[i];
    var b = el("button", "town-thumb");
    b.type = "button";
    b.dataset.y = String(w[2] || 0);
    b.dataset.work = w[0];
    var line = w[1] + (w[2] ? ", " + w[2] : "") + ((w[7] || []).length ? " · " + w[7].join(" · ") : "") +
      (/^record:/.test(w[4] || "") ? " · made in " + w[4].slice(7) + ", its record says" : "");
    b.title = line;
    b.setAttribute("aria-label", line + " — where it has been");
    if (w[3]) {
      var im = el("img");
      im.alt = "";
      im.loading = "lazy";
      im.decoding = "async";
      im.referrerPolicy = "no-referrer";
      im.src = CDN + w[3] + "/square.jpg";
      im.addEventListener("error", function () { b.classList.add("town-thumb-none"); });
      b.appendChild(im);
    } else { b.classList.add("town-thumb-none"); }
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); if (window.Land) { Land.work(w[0], p.key); } });
    return b;
  }

  /* Scrolling the column moves the year: the place nearest the column's top. */
  var handAt = 0, programmatic = 0;
  ["wheel", "touchmove", "pointerdown"].forEach(function (t) {
    document.addEventListener(t, function (event) {
      var col = document.getElementById("art-col");
      if (col && col.contains(event.target)) { handAt = performance.now(); }
    }, { capture: true, passive: true });
  });
  document.addEventListener("scroll", function (event) {
    var col = event.target;
    if (!view || !col || col.id !== "art-col" || performance.now() - handAt > 1200 || performance.now() - programmatic < 900) { return; }
    var top = col.getBoundingClientRect().top + 40, best = -1;
    view.rows.forEach(function (r, j) { if (r.li.getBoundingClientRect().top <= top) { best = j; } });
    if (best >= 0 && best !== view.k) {
      var p = view.L.periods[best];
      view.api.setYear(p.y0);
    }
  }, true);

  /* ---- entering a period: the place, its column alone ------------------------ */

  function enter(id, k) {
    return life(id).then(function (L) {
      var p = L && L.periods[k];
      if (!p || !window.Land || !Land.studio || !p.key) { return; }
      Land.studio(p.key, p.ll[0], p.ll[1], 6, p.place, { life: id, p: k, alone: true, name: L.name });
    });
  }

  // studios.js's column hook carries a life's period (land.js asks Studios.column).
  function wrapStudios() {
    if (!window.Studios || Studios._lives) { return; }
    var orig = Studios.column;
    Studios._lives = true;
    Studios.column = function (pay) {
      if (pay && pay.life) { return periodColumn(pay); }
      var box = orig(pay);
      if (box) { studioDoor(box, pay); }
      // The place, then (placethen.js): the studio's place in the artist's life, as it stood.
      if (box && pay && pay.i !== undefined && window.PlaceThen) { PlaceThen.studio(pay.i, box); }
      return box;
    };
  }

  function periodColumn(pay) {
    var L = null;
    var box = el("section", "studio-box life-box life-visit");
    box.setAttribute("aria-label", "A life");
    life(pay.life).then(function (got) {
      L = got;
      if (!L) { return; }
      var p = L.periods[pay.p];
      visit_ = { L: L, k: pay.p, box: box };
      box.appendChild(el("p", "town-section life-kicker", "A life · " + L.name));
      box.appendChild(el("p", "studio-title", p.place));
      box.appendChild(el("p", "studio-by", span(p) + " · " + (p.y0 === L.born ? "born" : "age " + (p.y0 - L.born) + (p.y1 > p.y0 ? "–" + (p.y1 - L.born) : ""))));
      box.appendChild(el("p", "studio-exact", howLine(p)));
      var body = el("div", "life-period-body");
      box.appendChild(body);
      fillPeriod(L, pay.p, body, null);
      var nav = el("div", "life-doors");
      if (pay.p > 0) {
        var a = L.periods[pay.p - 1];
        nav.appendChild(button("‹ " + a.place + " · " + span(a), "read-quiet life-door", function () { enter(L.id, pay.p - 1); }));
      }
      if (pay.p + 1 < L.periods.length) {
        var b = L.periods[pay.p + 1];
        nav.appendChild(button(b.place + " · " + span(b) + " ›", "read-quiet life-door", function () { enter(L.id, pay.p + 1); }));
      }
      nav.appendChild(button("The whole life ›", "read-quiet life-door", function () { open(L.id, { year: p.y0 }); }));
      box.appendChild(nav);
      // The place, then (placethen.js): the neighbourhood in those years, and the works made there.
      if (window.PlaceThen) { PlaceThen.open({ L: L, k: pay.p, box: box }); }
      kick();
    });
    return box;
  }

  /* ---- doors into a life, wherever an artist is named -------------------------- */

  function door(name, cls) {
    var r = rowOf(name);
    if (!r) { return null; }
    var b = button(possessive(name) + " life · " + r[2] + "–" + (r[3] || "") + " ›", "read-quiet life-open " + (cls || ""), function () { open(r[0]); });
    b.dataset.life = r[0];
    return b;
  }

  function studioDoor(box, pay) {
    load().then(function () {
      var S = window.Studios && Studios.data && Studios.data();
      var r = S && S.studios[pay.i];
      var A = r && S.artists[r.a];
      if (!A || box.querySelector(".life-open")) { return; }
      var b = door(A[1]);
      if (!b) { return; }
      var before = box.querySelector(".studio-src");
      if (before) { box.insertBefore(b, before); } else { box.appendChild(b); }
    });
  }

  // The work's column, the animal's box, the voice's box: a door where a life exists.
  function decorate() {
    var col = document.getElementById("art-col");
    if (!col || !D) { return; }
    var head = col.querySelector(".art-head-text");
    if (head && !head.querySelector(".life-open")) {
      var by = head.querySelector(".art-by");
      var name = by ? by.textContent.split(" · ")[0].split(", ")[0] : "";
      var d = name && door(name, "life-in-work");
      if (d) { head.appendChild(d); }
    }
    var fb = col.querySelector(".follow-box");
    var f = window.Land && Land.following && Land.following();
    if (fb && f && !fb.querySelector(".life-open")) {
      if (!f.voice && f.artist) {
        var d2 = door(f.artist);
        if (d2) { var away = fb.querySelector(".follow-away, .read-quiet:last-child"); fb.insertBefore(d2, away || null); }
      } else if (f.voice && f.map && f.map.id) {
        voiceDoors(fb, f.map.id);
      }
    }
  }
  var voiceAsk = {};
  function voiceDoors(fb, vid) {
    if (fb.dataset.lives) { return; }
    fb.dataset.lives = "asked";
    (voiceAsk[vid] = voiceAsk[vid] || fetch("voices/" + vid + ".json").then(function (r) { return r.json(); }).catch(function () { return null; }))
      .then(function (v) {
        if (!v || !fb.isConnected || fb.querySelector(".life-open")) { return; }
        var names = {};
        (v.works || []).forEach(function (w) { if (w[2] && rowOf(w[2])) { names[w[2]] = (names[w[2]] || 0) + 1; } });
        var list = Object.keys(names).sort(function (a, b) { return names[b] - names[a] || (a < b ? -1 : 1); }).slice(0, 3);
        if (!list.length) { return; }
        fb.appendChild(el("p", "town-section", "Lives they wrote on"));
        list.forEach(function (n) { var d = door(n); if (d) { fb.appendChild(d); } });
      });
  }

  /* ---- Find: a life by its artist; "lives" for all --------------------------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");
  function offer() {
    if (!field || !found) { return; }
    var text = field.value, t = fold(text);
    var landEl = document.getElementById("land");
    var onLayer = landEl && landEl.dataset.layerOn === "studios";
    if (t.trim().length < 3 && !(onLayer && !t.trim())) { return; }
    load().then(function () {
      if (!D || field.value !== text) { return; }
      var old = found.querySelector(".life-found");
      if (old) { old.remove(); }
      var all = /^ (lives?|a life|artists'? lives) $/.test(t);
      var every = onLayer && !t.trim();
      var q = t.replace(/ (lives?|a life|s life) $/, " ");
      var rows = D.lives.filter(function (r) {
        if (every) { return true; }
        if (all) { return r[9]; }
        var hay = fold(r[1]);
        return hay.indexOf(q) >= 0 || fold(surname(r[1])) === q;
      });
      if (!rows.length) { return; }
      var box = el("div", "explore-found life-found");
      box.appendChild(el("p", "finder-group", every ? "Artists · " + D.lives.length + " · each a life, most saved first" :
        all ? "Lives · " + rows.length + " drawn fullest" : "A life"));
      rows.slice(0, every ? 400 : all ? 99 : 4).forEach(function (r, k) {
        var b = el("button", "finder-row finder-line studio-cat life-cat");
        b.type = "button";
        b.appendChild(el("span", "studio-cat-name", r[1]));
        b.appendChild(el("span", "studio-cat-meta", [r[2] + "–" + (r[3] || ""), plural(r[4], "place", "places"),
          plural(r[5], "work", "works"), r[6] ? r[6] + " printed" : ""].filter(Boolean).join(" · ")));
        b.style.animationDelay = (still ? 0 : Math.min(k, 13) * 60) + "ms";
        b.addEventListener("click", function (event) { event.stopPropagation(); open(r[0]); });
        box.appendChild(b);
      });
      found.insertBefore(box, found.firstChild);
    });
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offer, 360); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && !found.querySelector(".life-found")) { offer(); } })
      .observe(found, { childList: true });
  }

  /* ---- played: a life as an exploration --------------------------------------- */

  function play(L) {
    if (!window.Explorations || !Explorations.play) { return; }
    Explorations.play({ id: "life-" + L.id, kind: "life", title: possessive(L.name) + " life", by: "",
                        towns: L.periods.filter(function (p) { return p.key; }).map(function (p) { return { key: p.key, word: p.place }; }),
                        stops: [{ k: "r", id: "l:" + L.id, from: 0 }] });
  }

  // explorations.js: the steps of a life — each place, and, after the death, the works going on.
  function steps(id) {
    return life(id).then(function (L) {
      if (!L) { return []; }
      var out = L.periods.map(function (p, k) {
        return { k: "life", life: id, p: k, key: p.key, ll: p.ll, y: p.y0, word: p.place, n: k, of: L.periods.length };
      });
      var af = READ ? afterOf(L) : null;
      if (af) { out.push({ k: "life", life: id, p: -1, after: true, key: af.key, ll: null, y: af.y, word: "After", n: L.periods.length, of: L.periods.length }); }
      return out;
    });
  }

  /* The reading layout (land.js, voice.js): a life played stays in its own
     view — the dial turned place to place, the picture the work being said,
     the lens moving between voices as each place is told in beats: arriving
     (over the shoulder), a life that crosses it (two figures), a movement it
     was part of (from above), a painted site (where the artist stood), the
     works in turn; after the death, the works' journeys (will be). With READ
     false, each place is entered, as before. */
  var READ = true;
  function afterOf(L) {
    if (!L.died) { return null; }
    var rows = (L.after || []).filter(function (a) { return a[0] > L.died; }).sort(function (a, b) { return a[0] - b[0] || b[2] - a[2]; });
    return rows.length ? { y: rows[0][0], key: rows[0][1], rows: rows } : null;
  }
  function visit(id, k) {
    if (!READ || !window.Land || !Land.reading) { return visitCity(id, k); }
    var mvReady = window.Movements && Movements.load ? Movements.load() : Promise.resolve(null);
    return Promise.all([life(id), mvReady]).then(function (got) {
      var L = got[0];
      if (!L) { return null; }
      var p = k >= 0 ? L.periods[k] : null, af = k < 0 ? afterOf(L) : null;
      if (!p && !af) { return null; }
      var y = p ? p.y0 : af.y;
      if (!(view && view.L.id === id && view.api.live())) { open(id, { year: y }); }
      return new Promise(function (done) {
        var t0 = performance.now();
        (function tick() {
          var w = where();
          if (view && view.L.id === id && view.api.live() && !w.flying && w.at === "life") { done(true); return; }
          if (performance.now() - t0 > 16000) { done(false); return; }
          window.setTimeout(tick, 250);
        })();
      }).then(function (ok) {
        if (!ok) { return null; }
        view.api.setYear(y);
        return p ? beatsOf(L, k) : afterBeats(L, af);
      });
    });
  }
  // A place told in beats, each with the voice it is told in (voice.js reads VOICE.md).
  function beatsOf(L, k) {
    var p = L.periods[k], who = surname(L.name), b = [], t = 2500;
    function add(ms, say, voice, work) { b.push({ at: t, say: say, voice: voice, work: work || null }); t += ms; }
    var first = p.place + " · " + span(p) + " · " + who + (p.y0 === L.born ? " born" : ", " + (p.y0 - L.born));
    add(6500, first, { path: "life", step: p.y0 === L.born ? "born" : "place", y: p.y0 });
    var q = firstQuote(p);
    add(7000, q ? "“" + q.q.split(/(?<=\.)\s/)[0] + "”" : howLine(p), null);
    var c = p.cross[0] !== undefined ? L.cross[p.cross[0]] : null;
    if (c) { add(7500, who + " and " + c[1] + " in " + c[3] + ", " + (c[4] === c[5] ? c[4] : c[4] + "–" + c[5]), { path: "life", step: "crossing", y: c[4] }); }
    var mv = movementIn(L, p);
    if (mv) { add(8000, mv.line, { path: "life", step: "movement", y: mv.y }); }
    var rank = { view: 0, street: 1, site: 2 };
    var si = (p.sites || []).map(function (i) { return L.sites[i]; })
      .filter(function (s) { return s && s[4] && s[2] && rank[s[5]] !== undefined; })
      .sort(function (a, z) { return rank[a[5]] - rank[z[5]]; })[0];
    if (si) { add(9500, si[1] + ", " + si[2] + " · painted here", { path: "life", step: "site", y: si[2] }); }
    var deathHere = L.died && p.y0 <= L.died && L.died <= p.y1 && k === L.periods.length - 1;
    p.works.slice(0, deathHere ? 2 : 3).forEach(function (i) {
      var w = L.works[i];
      var line = w[1] + (w[2] ? ", " + w[2] : "") + ((w[7] || []).length ? " · " + w[7][0] : "") +
        (w.length > 8 ? " · pulled at " + w[8][0] + (w[8][1] ? ", " + w[8][1] : "") : "");
      add(9000, line, { path: "life", step: "work", y: w[2] && w[2] >= p.y0 && w[2] <= p.y1 ? w[2] : p.y0, work: w[0] }, w[0]);
    });
    // The last place a life is told in ends with the death (the dial's long white mark).
    if (deathHere) { add(7000, who + " dies" + (L.d ? " · " + L.d[0] : "") + ", " + L.died, { path: "life", step: "died", y: L.died }); }
    return { lines: [first], works: [], key: p.key, beats: b, end: t + 2000 };
  }
  // After the death: where the works went, a few years of it (will be).
  function afterBeats(L, af) {
    var b = [], t = 2500, years = [];
    af.rows.forEach(function (r) { if (years.indexOf(r[0]) < 0 && years.length < 3) { years.push(r[0]); } });
    b.push({ at: t, say: "After " + L.died + " · the works go on", voice: { path: "life", step: "after", y: years[0] } });
    t += 7000;
    years.forEach(function (y, n) {
      var here = af.rows.filter(function (r) { return r[0] === y; });
      var line = y + " · " + here.map(function (r) { return townWord(r[1]) + (r[2] > 1 ? " (" + r[2] + ")" : ""); }).join(" · ");
      if (n) { b.push({ at: t, say: line, voice: { path: "life", step: "after", y: y } }); }
      else { b[0].say = b[0].say + " · " + line; }
      t += n ? 8000 : 0;
    });
    return { lines: [b[0].say], works: [], key: af.key, beats: b, end: t + 2000 };
  }
  function townWord(key) {
    var pl = null;
    (view && view.L.places || []).forEach(function (q) { if (q[0] === key) { pl = q[1]; } });
    return pl || String(key || "").replace(/-[a-z]{2}$/, "").replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  // A movement of the artist's in this place, during this stay (movements.js): its line, its first year here.
  function movementIn(L, p) {
    if (!window.Movements || !Movements.ofArtistName) { return null; }
    var ms = Movements.ofArtistName(L.name).filter(function (m) { return m.key === p.key && m.y0 <= p.y1 && p.y0 <= m.y1; });
    var m = ms[0];
    if (!m) { return null; }
    var y = Math.max(m.y0, p.y0);
    var D = Movements.data();
    var who = m.members.filter(function (r) { return r[1] <= y && y <= r[2]; }).map(function (r) { return surname(D.artists[r[0]][1]); });
    return { y: y, line: (m.label ? m.label.name + " · " : "") + m.title + " · " + who.slice(0, 5).join(", ") + (who.length > 5 ? " …" : "") };
  }
  // A beat said (explorations.js): the dial to its year, the work said lit, the voice told.
  function beat(bt) {
    if (!bt) { return; }
    var v = bt.voice;
    if (v && v.y && view && view.api.live() && view.api.year() !== v.y) { view.api.setYear(v.y); }
    // A played beat shows its work in the picture's place, never left full screen over the layout.
    if (bt.work) { showWork(bt.work); if (window.Land && Land.full) { Land.full(false); } }
    if (v && window.Voice && Voice.said) { Voice.said(v); }
  }

  // explorations.js (READ false): a stop — the place entered; the lines to say, then the works in turn.
  function visitCity(id, k) {
    return enter(id, k).then(function () {
      return life(id);
    }).then(function (L) {
      var p = L && L.periods[k];
      if (!p) { return null; }
      return new Promise(function (done) {
        var t0 = performance.now();
        (function tick() {
          var w = where();
          if (!w.flying && w.at === "town" && w.key === p.key && performance.now() - t0 > 600) { done(true); return; }
          if (performance.now() - t0 > 16000) { done(false); return; }
          window.setTimeout(tick, 250);
        })();
      }).then(function () {
        var lines = [p.place + " · " + span(p) + " · " + surname(L.name) + (p.y0 === L.born ? " born" : ", " + (p.y0 - L.born))];
        var q = firstQuote(p);
        lines.push(q ? "“" + q.q.split(/(?<=\.)\s/)[0] + "”" : howLine(p));
        var c = p.cross[0] !== undefined ? L.cross[p.cross[0]] : null;
        if (c) { lines.push(surname(L.name) + " and " + c[1] + " in " + c[3] + ", " + (c[4] === c[5] ? c[4] : c[4] + "–" + c[5])); }
        var works = p.works.slice(0, 3).map(function (i) {
          var w = L.works[i];
          return { id: w[0], line: w[1] + (w[2] ? ", " + w[2] : "") + ((w[7] || []).length ? " · " + w[7][0] : "") +
                   (w.length > 8 ? " · pulled at " + w[8][0] + (w[8][1] ? ", " + w[8][1] : "") : "") };
        });
        return { lines: lines, works: works, key: p.key };
      });
    });
  }

  // The square of a work in the entered period (or, in the life's own view, its place's row), lit while it is said.
  function showWork(id) {
    var inView = !(visit_ && visit_.box.isConnected) && view && view.api.live();
    if (!inView && (!visit_ || !visit_.box.isConnected)) { return; }
    var host = inView ? view.api.col : visit_.box;
    host.querySelectorAll("[data-said]").forEach(function (e) { delete e.dataset.said; });
    var L = inView ? view.L : visit_.L, i = -1;
    L.works.forEach(function (w, j) { if (w[0] === id) { i = j; } });
    if (i < 0) { return; }
    var y = String(L.works[i][2] || 0);
    var all = host.querySelectorAll(".town-thumb, .life-print");
    for (var n = 0; n < all.length; n += 1) {
      var t = all[n].getAttribute("title") || all[n].textContent || "";
      if (all[n].dataset.y === y && t.indexOf(L.works[i][1]) >= 0) {
        all[n].dataset.said = "true";
        try { all[n].scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" }); } catch (e) {}
        break;
      }
    }
  }

  /* ---- the globe: the route, the ateliers, the ring --------------------------- */

  var cv = null, ctx = null, raf = 0;
  function kick() { if (!raf) { raf = window.requestAnimationFrame(draw); } }
  // What the life drew on the globe last frame that matters (its places, rings, name, birth and death),
  // as boxes: the reading's grown globe keeps the layer's marks and names off them (land.js, Lives.marks).
  var drawn = [];
  function keep(x0, y0, x1, y1) { drawn.push({ x0: x0, y0: y0, x1: x1, y1: y1 }); }
  function slerp(a, b, t) {
    var R = Math.PI / 180;
    var la1 = a[0] * R, lo1 = a[1] * R, la2 = b[0] * R, lo2 = b[1] * R;
    var A = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
    var B = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
    var d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
    if (d < 1e-6) { return a; }
    var s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    var v = [A[0] * s1 + B[0] * s2, A[1] * s1 + B[1] * s2, A[2] * s1 + B[2] * s2];
    return [Math.atan2(v[2], Math.hypot(v[0], v[1])) / R, Math.atan2(v[1], v[0]) / R, d];
  }
  function tile(x, y, a, inset) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    ctx.globalAlpha = a;
    ctx.fillRect(gx + inset, gy + inset, C - 2 * inset, C - 2 * inset);
    return gx + "," + gy;
  }
  function draw(now) {
    raf = 0;
    if (!cv) {
      var tiles = document.getElementById("tiles");
      cv = el("canvas", "world world-tiles life-route");
      cv.setAttribute("aria-hidden", "true");
      if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(cv, tiles.nextSibling); } else { document.body.appendChild(cv); }
      ctx = cv.getContext("2d");
    }
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawn = [];
    var w = where();
    var t = still ? 0 : Math.floor((now || 0) / (1000 / 24));
    if (view && view.api.live() && w.at === "life") {
      follow();
      drawLife(view, t);
      kick();
      return;
    }
    if (bornAt && bornAt.live() && w.at === "life") {
      var bm = bornAt.data.born, bq = bornAt.at(bm[0], bm[1]);
      if (bq.z > 0.02) { ring(bq.x, bq.y, 2, t); atelier(bq.x, bq.y, 1); }
      kick();
      return;
    }
    if (visit_ && visit_.box.isConnected && w.at === "town" && !w.flying) {
      var p = visit_.L.periods[visit_.k];
      if (p && Land.at) {
        var q = Land.at(p.ll[0], p.ll[1]);
        if (q && q.z > 0.02) { ring(q.x, q.y, 3, t); atelier(q.x, q.y, 1); }
      }
      kick();
    }
  }

  function project(api, ll) { return api ? api.at(ll[0], ll[1]) : Land.at(ll[0], ll[1]); }

  function drawLife(v, t) {
    var L = v.L, api = v.api, y = v.y || NOW;
    var pts = [];
    if (L.b) { pts.push({ ll: L.b[1], y: L.born, k: -1 }); }
    L.periods.forEach(function (p, k) { pts.push({ ll: p.ll, y: p.y0, k: k }); });
    if (L.d) { pts.push({ ll: L.d[1], y: L.died, k: -1 }); }
    var after = L.died && y > L.died;
    var seen = {};
    // The route, every other tile: lit where the life has already gone, faint ahead.
    for (var n = 1; n < pts.length; n += 1) {
      var a = pts[n - 1], b = pts[n];
      var d = slerp(a.ll, b.ll, 0.5)[2] || 0;
      var steps = Math.max(6, Math.ceil(d * 260));
      var come = b.y <= y;
      for (var s = 0; s <= steps; s += 1) {
        var ll = slerp(a.ll, b.ll, s / steps);
        var q = project(api, ll);
        if (q.z < 0.08) { continue; }
        var gx = Math.floor(q.x / C), gy = Math.floor(q.y / C), id = gx + "," + gy;
        if (seen[id] || (gx + gy) % 2) { continue; }
        seen[id] = true;
        ctx.fillStyle = come ? (after ? LILAC : CREAM) : LILAC;
        tile(q.x, q.y, (come ? (after ? 0.28 : 0.5) : 0.16) * Math.min(1, (q.z - 0.08) * 6), 4);
      }
    }
    // Where the works are and have been: quiet cream tiles, brighter where more have been.
    ctx.fillStyle = CREAM;
    (L.places || []).forEach(function (r) {
      var q = project(api, [r[2], r[3]]);
      if (q.z < 0.05) { return; }
      tile(q.x, q.y, (after ? 0.34 : 0.16) + Math.min(0.3, Math.log(1 + r[4]) * 0.08), 5);
    });
    // Painted here: the outings, small lilac points, lit once their year is passed.
    ctx.fillStyle = LILAC;
    (L.sites || []).forEach(function (s) {
      var q = project(api, s[4]);
      if (q.z < 0.05) { return; }
      var gx = Math.floor(q.x / C) * C, gy = Math.floor(q.y / C) * C;
      ctx.globalAlpha = s[2] && s[2] <= y ? 0.85 : 0.3;
      ctx.fillRect(gx + 5, gy + 5, 3, 3);
    });
    // The studios the record gives no years: hollow ateliers, quiet.
    (L.undated || []).forEach(function (u) {
      if (!u[2]) { return; }
      var q = project(api, u[2]);
      if (q.z < 0.05) { return; }
      var gx = Math.floor(q.x / C) * C, gy = Math.floor(q.y / C) * C;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 1;
      ctx.strokeRect(gx + 2.5, gy + 2.5, C - 5, C - 5);
    });
    // The workshops: a hollow lilac tile, lit in their years.
    (L.workshops || []).forEach(function (s) {
      if (!s[3]) { return; }
      var q = project(api, s[3]);
      if (q.z < 0.05) { return; }
      var lit = s[5] && s[5] <= y && (!s[6] || y <= s[6] + 2);
      ctx.strokeStyle = LILAC;
      ctx.globalAlpha = lit ? 0.9 : 0.3;
      ctx.lineWidth = 1.5;
      var gx = Math.floor(q.x / C) * C, gy = Math.floor(q.y / C) * C;
      ctx.strokeRect(gx + 2.5, gy + 2.5, C - 5, C - 5);
    });
    // The afterlife: the works' cities of that year, quiet.
    if (after) {
      ctx.fillStyle = LILAC;
      (L.after || []).forEach(function (r) {
        if (r[0] > y || r[0] < y - 4) { return; }
        var pl = townLL(r[1]);
        if (!pl) { return; }
        var q = project(api, pl);
        if (q.z > 0.05) { tile(q.x, q.y, 0.45 * (1 - (y - r[0]) / 5), 3); }
      });
    }
    // The places: ateliers, lit once the dial has passed them; the year's ringed.
    L.periods.forEach(function (p, k) {
      var q = project(api, p.ll);
      if (q.z < 0.05) { return; }
      atelier(q.x, q.y, p.y0 <= y ? 1 : 0.35);
      if (k === v.k && !after) {
        ring(q.x, q.y, 1, t);
        // A life that crosses here this year: a second ring, cream.
        var c = p.cross.map(function (ci) { return L.cross[ci]; }).filter(function (c) { return c[4] <= y && y <= c[5]; })[0];
        if (c) { ctx.fillStyle = CREAM; ring2(q.x, q.y, 3, t); }
        name(q.x, q.y, p.place + (c ? " · " + surname(c[1]) + " here" : ""), c ? 3 : 2);
      }
    });
    ["b", "d"].forEach(function (e) {
      var r = L[e];
      if (!r) { return; }
      var q = project(api, r[1]);
      if (q.z < 0.05) { return; }
      ctx.fillStyle = e === "b" ? CREAM : (y >= L.died ? "#ffffff" : CREAM);
      var gx = Math.floor(q.x / C) * C, gy = Math.floor(q.y / C) * C;
      keep(gx, gy, gx + C, gy + C);
      ctx.globalAlpha = (e === "b" || y >= L.died) ? 0.9 : 0.3;
      ctx.fillRect(gx + C / 2 - 1.5, gy + C / 2 - 1.5, 3, 3);
    });
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
  // A place's name beside its ring (rr: the ring's reach in tiles, 2, or 3 with a crossing's).
  function name(x, y, text, rr) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    rr = rr || 2;
    ctx.globalAlpha = 1;
    ctx.font = "11px " + (getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace");
    ctx.textBaseline = "middle";
    var w = ctx.measureText(text).width, tx = gx + (rr + 1) * C + 4, ty = gy;
    // In the small globe at rest (the reading layout's lens): the name fits
    // inside its round window — right of the place, else left, else under
    // the ring (or over it), centred on the place (3 Oct 2026: "Greenw…" was
    // cut by the rim, and a name moved in sat over its own place).
    var rd = window.Land && Land.reading ? Land.reading() : null, L = rd && !rd.out && !rd.swapped && rd.at;
    if (L && L.r) {
      var span = function (row) {
        var dy = Math.max(Math.abs(row - 2 - L.y), Math.abs(row + C + 2 - L.y));
        var half = Math.sqrt(Math.max(0, L.r * L.r - dy * dy)) - 4;
        return [L.x - half + 4, L.x + half - 4];
      };
      var s0 = span(gy), left = gx - rr * C - 4 - w;
      if (tx + w > s0[1]) {
        if (left >= s0[0]) { tx = left; }
        else {
          var put = null;
          [gy + (rr + 1) * C + 4, gy - (rr + 1) * C - 4].forEach(function (row) {
            var sp = span(row);
            if (!put && sp[1] - sp[0] >= w) { put = { row: row, sp: sp }; }
          });
          if (put) { ty = put.row; tx = Math.max(put.sp[0], Math.min(put.sp[1] - w, gx + C / 2 - w / 2)); }
          else { tx = Math.max(s0[0], Math.min(s0[1] - w, tx)); }
        }
      }
    } else {
      // Out of its window, or on the front: right of the place, else left, never under the dial or the column.
      var under = [document.getElementById("art-time"), document.getElementById("art-col")].map(function (e) {
        var r = e && e.offsetParent ? e.getBoundingClientRect() : null;
        return r && r.width ? r : null;
      }).filter(Boolean);
      var blocked = function (x0, y0) {
        return x0 < 8 || x0 + w > window.innerWidth - 8 || y0 < 8 || y0 + C > window.innerHeight - 8 || under.some(function (r) {
          return x0 - 4 < r.right && r.left < x0 + w + 4 && y0 - 2 < r.bottom && r.top < y0 + C + 2;
        });
      };
      // Right, left, then under the ring and over it, centred on the place.
      var mid = gx + C / 2 - w / 2;
      var tries = [[tx, gy], [gx - rr * C - 4 - w, gy], [mid, gy + (rr + 1) * C + 4], [mid, gy - (rr + 1) * C - 4]];
      var put = tries.filter(function (q) { return !blocked(q[0], q[1]); })[0];
      if (put) { tx = put[0]; ty = put[1]; }
      tx = Math.max(8, Math.min(window.innerWidth - 8 - w, tx));
    }
    ctx.fillStyle = "rgba(15, 10, 7, 0.72)";
    ctx.fillRect(tx - 4, ty - 2, w + 8, C + 4);
    keep(tx - 4, ty - 2, tx + w + 4, ty + C + 2);
    ctx.fillStyle = CREAM;
    ctx.fillText(text, tx, ty + C / 2 + 0.5);
  }
  function ring2(x, y, R, t) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    keep(gx - R * C, gy - R * C, gx + (R + 1) * C, gy + (R + 1) * C);
    ctx.globalAlpha = 0.5;
    for (var dx = -R; dx <= R; dx += 1) {
      for (var dy = -R; dy <= R; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== R || ((dx + dy + (t >> 3)) & 1)) { continue; }
        ctx.fillRect(gx + dx * C + 5, gy + dy * C + 5, C - 10, C - 10);
      }
    }
    ctx.globalAlpha = 1;
  }
  function ring(x, y, rr, t) {
    var gx = Math.floor(x / C) * C, gy = Math.floor(y / C) * C;
    keep(gx - (rr + 1) * C, gy - (rr + 1) * C, gx + (rr + 2) * C, gy + (rr + 2) * C);
    ctx.fillStyle = LILAC;
    for (var e = 0; e < 2; e += 1) {
      var R = rr + e;
      ctx.globalAlpha = [0.75, 0.32][e];
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

  // The cities' points, for the afterlife (cities.json, read once).
  var townPts = null, townAsk = null;
  function townLL(key) {
    if (townPts) { return townPts[key] || null; }
    if (!townAsk) {
      townAsk = fetch("cities.json").then(function (r) { return r.json(); }).then(function (c) {
        townPts = {};
        c.towns.forEach(function (t) { townPts[t[0]] = [t[3], t[4]]; });
      }).catch(function () { townAsk = null; });
    }
    return null;
  }

  /* ---- the catalogue and the workshop: a hunt's stop says where it was made --- */

  function made(id) {
    var m = D && D.made && D.made[id];
    if (!m) { return ""; }
    var y = m[3] ? ", " + m[3] : "";
    if (m[1]) { return "Pulled at " + m[1] + (m[2] ? ", " + m[2] : "") + y + (m[4] && m[4] !== m[2] ? " · " + surname(rowName(m[0])) + " in " + m[4] : ""); }
    if (m[4]) { return "Made in " + m[4] + y + " · " + ({ record: "its record says", site: "a documented site", dated: "dated within these years" }[m[5]] || ""); }
    return "";
  }
  function rowName(id) { return D && D.byId[id] !== undefined ? D.lives[D.byId[id]][1] : ""; }

  window.setInterval(function () { decorate(); if ((view || visit_) && !raf) { kick(); } }, 700);
  if (window.requestIdleCallback) { window.requestIdleCallback(function () { load(); wrapStudios(); }, { timeout: 3000 }); }
  else { window.setTimeout(function () { load(); wrapStudios(); }, 1500); }
  wrapStudios();

  window.Lives = {
    load: load,
    open: open,
    openMark: openMark,
    start: start,
    stop: stop,
    enter: enter,
    steps: steps,
    visit: visit,
    beat: beat,
    idOf: function (name) { var r = rowOf(name); return r ? r[0] : null; },
    // A life already read, at once (land.js's map draws its places); asked for if not.
    _life: function (id) { if (!lifeNow[id]) { life(id); } return lifeNow[id] || null; },
    // A town's "Born here" (voice.js, its picture): the lives born there, most saved first.
    born: function () {
      var m = bornAt && bornAt.data && bornAt.data.born;
      if (!m || !D || !bornAt.live()) { return null; }
      return { town: m[7], ids: m[4].map(function (i) { return D.lives[i][0]; }) };
    },
    showWork: showWork,
    made: made,
    // What the life (or a town's "Born here") drew on the globe last frame, as boxes.
    marks: function () { return drawn; },
    has: function (name) { return !!rowOf(name); },
    // A period entered here: the life's artist and its Painted here sites (sites.js draws them in the city).
    visiting: function () {
      if (!visit_ || !visit_.box.isConnected) { return null; }
      return { id: visit_.L.id, name: visit_.L.name, k: visit_.k, sites: (visit_.L.sites || []).map(function (s) { return s[0]; }) };
    },
    _state: function () {
      var col = document.getElementById("art-col");
      return { loaded: !!D, lives: D ? D.lives.length : 0, open: view ? view.L.id : null, year: view ? view.y : null,
               period: view && view.k >= 0 ? view.L.periods[view.k].place : null,
               visit: visit_ && visit_.box.isConnected ? visit_.L.periods[visit_.k].place : null,
               column: col ? col.innerText.slice(0, 500) : "" };
    }
  };
})();

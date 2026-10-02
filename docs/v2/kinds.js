/* The categories (kinds.js).

   The artist, 2 Oct 2026: "so I really want you to categorize each type of
   path of exploration. We are creating and create categorical names for
   them … and for each category made the spectrum that connects all of them
   has to be navigable at all times … So use three sub categories for now
   that are available when you are in any category."

   Every view's column is headed by what it is: the way you came (a
   breadcrumb, each step a way back), the category's glyph and name and the
   thing's, its place on the spectrum from history (the museums) to now (the
   galleries), and three tabs — three other categories, chosen from here.
   A tab opens a searchable list in place; each row is a door into that
   thing, which has its own header and its own three. A thing with no view
   of its own (a gallery, a show, a writer, an animal) is opened in place:
   the header alone, its first tab open, the column under it set aside
   until you go back.

   KINDS.md is the one table this reads: the categories, their glyphs and
   tones, the three from each, the tabs and Find's groups. kinds.json
   (scripts/build_kinds.py) is the shows, venues and artists' movements.
   The hooks in land.js are in window.Land only: where (a building's slug),
   town, open; the rest is the views' own openers (Land.work, Land.museum,
   Land.thread, Lives.open, Movements.open, Voices.follow, Walks.play). */
(function () {
  "use strict";

  var NOW = 2026, FIRST = 1400, PAGE = 34;
  var T = null, D = null, asking = null, loading = null;
  var cur = null;            // { item, solo, tab }
  var trail = [];            // [{ item, tab }]
  var pending = null;        // an item a door is flying to
  var viewKey = "";
  var head = null, hostEl = null;
  var artCol = document.getElementById("art-col");
  var works = document.getElementById("building-works");
  var buildingEl = document.getElementById("building");
  var artEl = document.getElementById("art");
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function fold(s) {
    return " " + String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
  }
  function yearOf(s) { var m = /(\d{4})/.exec(String(s || "")); return m ? +m[1] : 0; }
  function plural(n, one, many) { return n.toLocaleString("en") + " " + (n === 1 ? one : many); }
  function years(a, b) { return a && b && b !== a ? a + "–" + b : a ? String(a) : b ? String(b) : ""; }
  function json(url) {
    return fetch(url).then(function (r) { if (!r.ok) { throw new Error(url); } return r.json(); }).catch(function () { return null; });
  }

  /* ---- KINDS.md, read --------------------------------------------------- */

  function readTable() {
    if (asking) { return asking; }
    asking = fetch("KINDS.md").then(function (r) { if (!r.ok) { throw new Error("KINDS.md"); } return r.text(); })
      .then(function (md) { T = parse(md); return T; })
      .catch(function () { asking = null; return null; });
    return asking;
  }
  function parse(md) {
    var tables = [], tb = null;
    md.split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!/^\|.*\|$/.test(t)) { tb = null; return; }
      var cells = t.slice(1, -1).split("|").map(function (c) { return c.trim(); });
      if (cells.every(function (c) { return /^:?-{2,}:?$/.test(c); })) { return; }
      if (!tb) { tb = { head: cells.map(function (h) { return h.toLowerCase(); }), rows: [] }; tables.push(tb); return; }
      var o = {};
      tb.head.forEach(function (h, i) { o[h] = (cells[i] || "").replace(/^`([^`]*)`$/, "$1"); });
      tb.rows.push(o);
    });
    var out = { kinds: {}, order: [], from: {}, tabs: {}, find: [] };
    tables.forEach(function (t) {
      var h = t.head.join(" ");
      if (h.indexOf("kind name glyph tone") === 0) {
        t.rows.forEach(function (r) { r.spectrum = +r.spectrum; out.kinds[r.kind] = r; out.order.push(r.kind); });
      } else if (h.indexOf("from kind first second third") === 0) {
        t.rows.forEach(function (r) { out.from[r.from] = r; });
      } else if (h.indexOf("tab label kind") === 0) {
        t.rows.forEach(function (r) { out.tabs[r.tab] = r; });
      } else if (h.indexOf("head kind") === 0) {
        t.rows.forEach(function (r) { out.find.push(r); });
      }
    });
    out.find.sort(function (a, b) { return b.head.length - a.head.length; });
    return out;
  }
  function kindOf(k) { return (T && T.kinds[k]) || { kind: k, name: k, glyph: "·", tone: "#a8927a", spectrum: 0.5 }; }
  function fromOf(item) { return T && T.from[item.k]; }

  /* ---- the data, read once and folded -------------------------------------- */

  function load() {
    if (D) { return Promise.resolve(D); }
    if (loading) { return loading; }
    loading = Promise.all([readTable(), json("kinds.json"), json("finding.json"), json("museums.json"),
                           json("cities.json"), json("voices.json"), json("architecture.json")])
      .then(function (r) {
        var k = r[1], f = r[2];
        if (!r[0] || !k || !f) { loading = null; return null; }
        var d = { k: k, f: f, cdn: f.cdn, mus: (r[3] && r[3].museums) || [], cities: r[4], voices: r[5],
                  arch: (r[6] && r[6].buildings) || [] };
        d.asof = k.asof || "";
        NOW = yearOf(d.asof) || NOW;
        // Works: finding.json's, each with its artists as kinds.json names them.
        var known = {};
        Object.keys(k.artists).forEach(function (n) { known[n] = true; });
        d.byArtist = {};
        d.works = f.w.map(function (w, i) {
          var names = String(w[2] || "").split(", ").map(function (p) { return p.replace(/\s*\([^)]*\)\s*$/, "").trim(); })
            .filter(function (p, j) { return p && (j === 0 || known[p]); });
          names.forEach(function (n) { (d.byArtist[n] = d.byArtist[n] || []).push(i); });
          return { i: i, id: w[0], t: w[1] || "Untitled", a: w[2] || "", y: w[3] || "", img: w[4], names: names,
                   yr: yearOf(w[3]) };
        });
        d.workIdx = {};
        d.works.forEach(function (w) { d.workIdx[w.id] = w.i; });
        d.workShows = {};
        d.venueShows = {};
        k.shows.forEach(function (s, si) {
          s[6].forEach(function (wi) { (d.workShows[wi] = d.workShows[wi] || []).push(si); });
          (d.venueShows[s[1]] = d.venueShows[s[1]] || []).push(si);
        });
        d.townVenues = {};
        d.slugVenues = {};
        k.venues.forEach(function (v, vi) {
          if (v[1]) { (d.townVenues[v[1]] = d.townVenues[v[1]] || []).push(vi); }
          if (v[3]) { (d.slugVenues[v[3]] = d.slugVenues[v[3]] || []).push(vi); }
        });
        d.museum = {};
        d.heldBy = {};
        d.mus.forEach(function (m) {
          d.museum[m.slug] = m;
          (m.works || []).forEach(function (w) { if (w.id) { (d.heldBy[w.id] = d.heldBy[w.id] || []).push(m.slug); } });
        });
        d.towns = {};
        d.townOf = {};
        ((d.cities && d.cities.towns) || []).forEach(function (t) {
          d.towns[t[0]] = { key: t[0], name: t[1], cc: t[2], lat: t[3], lon: t[4], n: t[5], museums: t[6] || [] };
          (t[6] || []).forEach(function (slug) { d.townOf[slug] = t[0]; });
        });
        d.voice = {};
        d.voiceByName = {};
        ((d.voices && d.voices.voices) || []).forEach(function (v, vi) {
          d.voice[v[0]] = { id: v[0], name: v[1], roles: v[2], n: v[3], line: v[5], f: v[6], row: vi };
          d.voiceByName[fold(v[1])] = v[0];
        });
        d.musByName = {};
        d.mus.forEach(function (m) { d.musByName[fold(m.name)] = m.slug; });
        D = d;
        return D;
      });
    return loading;
  }

  function townName(key) { var t = D && D.towns[key]; return t ? t.name : ""; }
  function venueOf(vi) { return D.k.venues[vi]; }
  function showOf(si) { return D.k.shows[si]; }
  var VTYPE = { m: "museum", g: "gallery", f: "fair", s: "sale room" };

  /* ---- items: what each thing is ------------------------------------------- */

  // An item is { k, id, name } — k is a row of "The three from each".
  function itemKey(it) { return it ? it.k + ":" + it.id : ""; }
  function same(a, b) { return !!a && !!b && itemKey(a) === itemKey(b); }

  function artistItem(name) { return { k: "artist", id: name, name: name }; }
  function workItem(i) { var w = D.works[i]; return { k: "work", id: w.id, name: w.t }; }
  function museumItem(slug) { var m = D.museum[slug]; return m ? { k: "museum", id: slug, name: m.name } : null; }
  function placeItem(key) { var t = D.towns[key]; return t ? { k: "place", id: key, name: t.name } : null; }
  function venueItem(vi) {
    var v = venueOf(vi);
    if (v[3] && D.museum[v[3]]) { return museumItem(v[3]); }
    return { k: v[2] === "m" ? "institution" : "gallery", id: vi, name: v[0] || "A venue not named" };
  }
  function showItem(si) {
    var s = showOf(si);
    if (s[4] === "l") { return venueItem(s[1]); }
    return { k: s[4] === "o" ? "sale" : "show", id: si, name: s[0] || ("A show at " + (venueOf(s[1])[0] || "a venue not named")) };
  }
  function writerItem(id) { var v = D.voice[id]; return v ? { k: "writer", id: id, name: v.name } : null; }
  function movementItem(m) { return { k: "movement", id: m.id, name: m.title }; }
  function buildingItem(b) { return { k: "building", id: b.slug, name: b.name || b.title }; }
  function lifePlaceItem(id, k, name, artist) { return { k: "lifeplace", id: id + ":" + k, life: id, p: k, name: name || "A place", artist: artist || "" }; }

  // An item by its kind and id, as Kinds.go is given them.
  function itemOf(k, id) {
    if (k === "artist") { return artistItem(id); }
    if (k === "work") { return D.workIdx[id] === undefined ? null : workItem(D.workIdx[id]); }
    if (k === "museum") { return museumItem(id); }
    if (k === "place") { return placeItem(id); }
    if (k === "writer") { return writerItem(id); }
    if (k === "show" || k === "sale") { return showOf(id) ? showItem(id) : null; }
    if (k === "gallery") { return venueOf(id) ? venueItem(id) : null; }
    if (k === "movement") { var m = movement(id); return m ? movementItem(m) : null; }
    if (k === "building") { var b = D.arch.filter(function (x) { return x.slug === id; })[0]; return b ? buildingItem(b) : null; }
    if (k === "animal") { return { k: "animal", id: id, name: id }; }
    if (k === "lifeplace") { var lp = String(id).split(":"); return lifePlaceItem(lp[0], +lp[1], ""); }
    return null;
  }

  // The item of the view the page has open, from Land.where().
  function viewItem(w) {
    if (!w || !D) { return Promise.resolve(null); }
    if (w.at === "work" && w.work && D.workIdx[w.work] !== undefined) { return Promise.resolve(workItem(D.workIdx[w.work])); }
    // A place in a life (Lives' "Enter ›"), or a studio's: that place, named for itself
    // (Fontainebleau, not Yerres, the city of the record nearest it), with its own three.
    if (w.at === "town" && w.life) {
      var lpi = lifePlaceItem(w.life.id, w.life.k, w.name, w.life.name);
      return lifePeriod(lpi).then(function () { return lpi; });
    }
    if (w.at === "town" && w.key && w.name && w.studio !== undefined) {
      var pi = placeItem(w.key);
      return Promise.resolve(pi ? { k: "place", id: w.key, name: w.name, town: pi.name } : null);
    }
    if (w.at === "town" && w.key) { return Promise.resolve(placeItem(w.key)); }
    if (w.at === "museum" && w.museum) {
      return Promise.resolve(museumItem(w.museum) || { k: "museum", id: w.museum, name: w.museum === "folger" ? "Folger Shakespeare Library" : w.museum });
    }
    if (w.at === "building" && w.building) {
      var b = D.arch.filter(function (x) { return x.slug === w.building; })[0];
      return Promise.resolve(b ? buildingItem(b) : null);
    }
    if (w.at === "life" && w.id && window.Lives) {
      return Lives.load().then(function (L) {
        var i = L && L.byId[w.id];
        return i === undefined ? null : artistItem(L.lives[i][1]);
      });
    }
    if (w.at === "movement" && w.id && window.Movements) {
      return Movements.load().then(function () {
        var M = Movements.data();
        var m = M && M.movements.filter(function (x) { return x.id === w.id; })[0];
        return m ? movementItem(m) : null;
      });
    }
    if (w.at === "thread" && w.id) {
      return json("threads/" + w.id + ".json").then(function (t) {
        if (!t) { return null; }
        if (t.k === "artist") { return artistItem(t.name); }
        if (t.k === "museum") {
          var slug = D.musByName[fold(t.name)];
          if (slug) { return museumItem(slug); }
          return { k: "collection", id: w.id, name: t.name, thread: t };
        }
        if (t.k === "owner") { return { k: "collection", id: w.id, name: t.name, thread: t }; }
        if (t.k === "writing") { return { k: "publication", id: w.id, name: t.name, thread: t }; }
        var si = -1;
        D.k.shows.forEach(function (s, i) { if (si < 0 && s[5] === w.id) { si = i; } });
        if (si >= 0) { return showItem(si); }
        return { k: t.k === "sale" ? "sale" : "show", id: "t:" + w.id, name: t.name, thread: t };
      });
    }
    return Promise.resolve(null);
  }

  // Does an item have a view of its own (flown to), and how is it opened.
  function opener(it) {
    var L = window.Land;
    if (!L) { return null; }
    if (it.k === "work") { return function () { L.work(it.id); }; }
    if (it.k === "museum" && D.museum[it.id]) { return function () { L.museum(it.id); }; }
    if (it.k === "place") { return function () { L.town(it.id); }; }
    if (it.k === "lifeplace" && window.Lives && Lives.enter) { return function () { Lives.enter(it.life, it.p); }; }
    if (it.k === "movement" && window.Movements) { return function () { Movements.open(it.id); }; }
    if (it.k === "building") { return function () { L.open("building-" + it.id); }; }
    if (it.k === "artist" && window.Lives && Lives.has(it.id)) { return function () { Lives.open(Lives.idOf(it.id)); }; }
    if ((it.k === "show" || it.k === "sale") && typeof it.id === "number" && showOf(it.id)[5]) {
      var tid = showOf(it.id)[5];
      return function () { L.thread(tid); };
    }
    if ((it.k === "collection" || it.k === "publication") && it.thread) { return function () { L.thread(it.id); }; }
    return null;
  }

  /* ---- the spectrum ------------------------------------------------------- */

  function pos(y) {
    var back = Math.max(0, NOW - y);
    return Math.max(0, Math.min(1, 1 - Math.log(1 + back) / Math.log(1 + NOW - FIRST)));
  }
  // An item's years on the spectrum: [y0, y1], or null (its category's own place, hollow).
  function spanOf(it) {
    var ys = [];
    function add(y) { y = +y || 0; if (y > 1000 && y <= NOW + 1) { ys.push(y); } }
    if (it.k === "work") { add(D.works[D.workIdx[it.id]].yr); }
    else if (it.k === "artist") {
      var a = D.k.artists[it.id];
      if (a && a[1]) { add(a[1] + 18); add(a[2] || NOW); }
      else { (D.byArtist[it.id] || []).forEach(function (i) { add(D.works[i].yr); }); }
    } else if (it.k === "movement") { var mv = movement(it.id); if (mv) { add(mv.y0); add(mv.y1); } }
    else if (it.k === "show" || it.k === "sale") {
      if (typeof it.id === "number") { var s = showOf(it.id); add(yearOf(s[2])); add(yearOf(s[3]) || yearOf(s[2])); }
      else if (it.thread) { add(it.thread.y); }
    } else if (it.k === "gallery" || it.k === "institution") { var v = venueOf(it.id); add(v[4]); add(v[5]); }
    else if (it.k === "museum") {
      (D.slugVenues[it.id] || []).forEach(function (vi) { add(venueOf(vi)[4]); add(venueOf(vi)[5]); });
      if (!ys.length && D.museum[it.id]) { (D.museum[it.id].works || []).forEach(function (w) { add(yearOf(w.y)); }); }
    } else if (it.k === "place") {
      (D.townVenues[it.id] || []).forEach(function (vi) { add(venueOf(vi)[4]); add(venueOf(vi)[5]); });
    } else if (it.k === "writer" && it.detail) { (it.detail.path || []).forEach(function (p) { add(p[3]); }); }
    else if (it.thread) { add(it.thread.y); }
    else if (it.k === "lifeplace" && it.y0) { add(it.y0); add(it.y1); }
    if (!ys.length) { return null; }
    ys.sort(function (a, b) { return a - b; });
    // The middle of what the record has, not its strays: the 5th to the 95th percentile.
    var lo = ys[Math.floor(ys.length * 0.05)], hi = ys[Math.min(ys.length - 1, Math.ceil(ys.length * 0.95) - 1)];
    return [lo, Math.max(lo, hi)];
  }

  function spectrum(it, kd) {
    var box = el("div", "kinds-spectrum");
    var span = spanOf(it);
    box.appendChild(el("span", "kinds-end", "history"));
    var line = el("span", "kinds-line");
    line.appendChild(el("i", "kinds-mid"));
    var mark = el("i", "kinds-mark");
    if (span) {
      var a = pos(span[0]), b = pos(span[1]);
      mark.style.left = (a * 100).toFixed(1) + "%";
      mark.style.width = Math.max(0, (b - a) * 100).toFixed(1) + "%";
      if (b - a < 0.012) { mark.dataset.dot = "true"; }
      box.setAttribute("aria-label", "On the spectrum from art history to now: " + years(span[0], span[1]));
      box.title = years(span[0], span[1]);
    } else {
      mark.style.left = (kd.spectrum * 100).toFixed(1) + "%";
      mark.dataset.dot = "true";
      mark.dataset.hollow = "true";
      box.setAttribute("aria-label", "On the spectrum from art history to now: no dates; " + kd.name.toLowerCase() + " stand here");
    }
    line.appendChild(mark);
    box.appendChild(line);
    box.appendChild(el("span", "kinds-end", "now"));
    var said = el("span", "kinds-years", span ? years(span[0], span[1] === NOW && span[0] !== NOW ? "now" : span[1]) : "");
    box.appendChild(said);
    return box;
  }

  /* ---- rows ---------------------------------------------------------------

     A row: { kind, title, sub, img, item | go, hay, year, now }. Pressed,
     the item is gone into (its own header and three); go is for a thing
     that is not an item (a walk played, a Wikidata movement said). */

  function rowEl(r) {
    var kd = kindOf(r.kind);
    var b = el("div", "kinds-row");
    b.style.setProperty("--kt", kd.tone);
    var main = el("button", "kinds-row-main");
    main.type = "button";
    if (r.img) {
      var img = el("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = r.img;
      img.addEventListener("error", function () { img.remove(); });
      main.appendChild(img);
    } else {
      var g = el("span", "kinds-row-glyph", kd.glyph);
      g.setAttribute("aria-hidden", "true");
      main.appendChild(g);
    }
    var txt = el("span", "kinds-row-text");
    var t = el("span", "kinds-row-title", r.title);
    if (r.now) { t.appendChild(el("span", "kinds-now", r.now)); }
    txt.appendChild(t);
    if (r.sub) { txt.appendChild(el("span", "kinds-row-sub", r.sub)); }
    main.appendChild(txt);
    if (!r.item && !r.go) { main.disabled = true; main.dataset.plain = "true"; }
    main.addEventListener("click", function (event) {
      event.stopPropagation();
      if (r.item) { go(r.item); } else if (r.go) { r.go(); }
    });
    b.appendChild(main);
    if (r.also) {
      var a = el("button", "kinds-row-also", r.also.label + " ›");
      a.type = "button";
      a.style.setProperty("--kt", kindOf(r.also.kind).tone);
      a.dataset.kind = r.also.kind;
      a.title = r.also.item.name;
      a.addEventListener("click", function (event) { event.stopPropagation(); go(r.also.item); });
      b.appendChild(a);
    }
    return b;
  }

  function img(i) { var w = D.works[i]; return w && w.img ? D.cdn + w.img + "/square.jpg" : ""; }
  function workRow(i, sub) {
    var w = D.works[i];
    return { kind: "work", title: w.t, sub: sub !== undefined ? sub : [w.a, w.y].filter(Boolean).join(" · "), img: img(i),
             item: workItem(i), hay: fold([w.t, w.a, w.y].join(" ")), year: w.yr };
  }
  function artistRow(name, sub) {
    return { kind: "artist", title: name, sub: sub, item: artistItem(name), hay: fold(name + " " + (sub || "")) };
  }
  function showWhen(s) {
    var a = s[2], b = s[3];
    if (/^\d{4}-\d\d-\d\d$/.test(a) && /^\d{4}-\d\d-\d\d$/.test(b)) {
      return fmtDate(a) + " – " + fmtDate(b);
    }
    return years(yearOf(a), yearOf(b));
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(s) { var p = s.split("-"); return +p[2] + " " + MON[+p[1] - 1] + " " + p[0]; }
  function nowWord(s) {
    if (!D.asof) { return ""; }
    if (s[2] && s[2] > D.asof) { return "coming"; }
    if (s[3] && s[3] >= D.asof) { return "now"; }
    return "";
  }
  var TYPEWORD = { x: "exhibition", f: "at a fair", l: "listed", o: "sale" };
  function showRow(si) {
    var s = showOf(si), v = venueOf(s[1]);
    var vname = v[0], town = townName(v[1]);
    var title = s[4] === "l" ? "Listed by " + (vname || "a gallery") : s[0] || ("A show at " + (vname || "a venue not named"));
    var sub = [s[4] === "l" || vname ? "" : vname, town, showWhen(s), TYPEWORD[s[4]], plural(s[6].length, "work", "works")]
      .filter(Boolean).join(" · ");
    var r = { kind: s[4] === "l" ? "gallery" : "gallery", title: title, sub: sub, item: showItem(si),
              hay: fold([title, vname, town, s[2], TYPEWORD[s[4]], v[2] === "m" ? "museum" : VTYPE[v[2]]].join(" ")),
              year: yearOf(s[2]), now: nowWord(s) };
    if (v[2] === "m") { r.kind = "museum"; }
    if (s[4] !== "l" && vname) {
      var vi = venueItem(s[1]);
      r.also = { label: shortVenue(vname), kind: vi.k === "museum" || vi.k === "institution" ? "museum" : "gallery", item: vi };
    }
    return r;
  }
  function shortVenue(n) { return n.length > 28 ? n.slice(0, 26).replace(/\s+\S*$/, "") + "…" : n; }
  function venueRowOf(vi, extra) {
    var v = venueOf(vi), it = venueItem(vi), n = (D.venueShows[vi] || []).length;
    var kind = it.k === "museum" || it.k === "institution" ? "museum" : "gallery";
    return { kind: kind, title: v[0] || "A venue not named",
             sub: [VTYPE[v[2]], townName(v[1]), years(v[4], v[5]), extra || plural(n, "show", "shows")].filter(Boolean).join(" · "),
             item: it, hay: fold([v[0], townName(v[1]), VTYPE[v[2]]].join(" ")), year: v[5] };
  }
  function placeRow(key, sub) {
    var t = D.towns[key];
    if (!t) { return null; }
    return { kind: "place", title: t.name + ", " + t.cc, sub: sub || plural(t.n, "work", "works"), item: placeItem(key),
             hay: fold(t.name + " " + t.cc + " " + (sub || "")) };
  }
  function museumRow(slug, sub) {
    var m = D.museum[slug];
    if (!m) { return null; }
    return { kind: "museum", title: m.name, sub: sub || [townName(D.townOf[slug]), m.held + " saved"].filter(Boolean).join(" · "),
             item: museumItem(slug), hay: fold(m.name + " " + (m.where || "")) };
  }
  // The site's city a point stands in (within km), nearest.
  function nearestTown(lat, lon, km, withMuseums) {
    var best = null, bd = Infinity;
    Object.keys(D.towns).forEach(function (k) {
      var t = D.towns[k];
      if (withMuseums && !t.museums.length) { return; }
      var d = dist(lat, lon, t.lat, t.lon);
      if (d < bd) { bd = d; best = t; }
    });
    return best && bd <= km ? { t: best, km: bd } : null;
  }
  function dist(a, b, c, d) {
    var R = Math.PI / 180, x = Math.sin((c - a) * R / 2), y = Math.sin((d - b) * R / 2);
    return 2 * 6371 * Math.asin(Math.sqrt(x * x + Math.cos(a * R) * Math.cos(c * R) * y * y));
  }

  /* ---- the lists ------------------------------------------------------------

     Each tab of KINDS.md's "The subcategories" is a function here: given
     the item, a promise of { rows, note } — note a quiet line above them. */

  function worksOf(idx, sub) {
    return idx.slice().sort(function (a, b) { return (D.works[b].yr || 0) - (D.works[a].yr || 0); })
      .map(function (i) { return workRow(i, sub ? sub(i) : undefined); });
  }
  function artistsOf(idx, minus) {
    var count = {};
    idx.forEach(function (i) { D.works[i].names.forEach(function (n) { if (n !== minus) { count[n] = (count[n] || 0) + 1; } }); });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b); })
      .map(function (n) { return artistRow(n, plural(count[n], "work", "works") + lifeSpan(n)); });
  }
  function lifeSpan(n) {
    var a = D.k.artists[n];
    return a && a[1] ? " · " + a[1] + "–" + (a[2] || "") : "";
  }
  function showsOfWorks(idx) {
    var seen = {}, out = [];
    idx.forEach(function (i) { (D.workShows[i] || []).forEach(function (si) { if (!seen[si]) { seen[si] = true; out.push(si); } }); });
    return out.sort(function (a, b) { return a - b; });
  }
  function detailOf(it) {
    if (it.detail) { return Promise.resolve(it.detail); }
    if (it.k === "writer") {
      var v = D.voice[it.id];
      if (v && v.f === 1) { return json("voices/" + it.id + ".json").then(function (d) { it.detail = d; return d; }); }
      it.detail = { works: v && typeof v.f === "string" ? [[v.f]] : [], acts: [], path: [] };
      return Promise.resolve(it.detail);
    }
    if (it.thread) { return Promise.resolve(it.thread); }
    if (typeof it.id === "string" && (it.k === "collection" || it.k === "publication")) {
      return json("threads/" + it.id + ".json").then(function (t) { it.thread = t; return t; });
    }
    return Promise.resolve(null);
  }
  function idxOfIds(list) {
    var out = [];
    (list || []).forEach(function (w) { var i = D.workIdx[typeof w === "string" ? w : w[0]]; if (i !== undefined && out.indexOf(i) < 0) { out.push(i); } });
    return out;
  }
  // The works an item is about, as finding.json indexes.
  function worksIn(it) {
    if (it.k === "artist") { return Promise.resolve(D.byArtist[it.id] || []); }
    if (it.k === "museum") {
      return Promise.resolve(idxOfIds(((D.museum[it.id] || {}).works || []).map(function (w) { return w.id; })));
    }
    if (it.k === "show" || it.k === "sale") {
      if (typeof it.id === "number") { return Promise.resolve(showOf(it.id)[6].slice()); }
      return Promise.resolve(idxOfIds((it.thread && it.thread.works) || []));
    }
    if (it.k === "gallery" || it.k === "institution") {
      var idx = [];
      (D.venueShows[it.id] || []).forEach(function (si) { showOf(si)[6].forEach(function (i) { if (idx.indexOf(i) < 0) { idx.push(i); } }); });
      return Promise.resolve(idx);
    }
    if (it.k === "movement") {
      var m = movement(it.id), out = [];
      if (!m) { return Promise.resolve([]); }
      memberNames(m).forEach(function (n) {
        (D.byArtist[n] || []).forEach(function (i) {
          var y = D.works[i].yr;
          if (y && y >= m.y0 - 2 && y <= m.y1 + 2) { out.push(i); }
        });
      });
      return Promise.resolve(out);
    }
    return detailOf(it).then(function (d) { return idxOfIds(d && d.works); });
  }
  function movement(id) {
    var M = window.Movements && Movements.data();
    return M ? M.movements.filter(function (x) { return x.id === id; })[0] : null;
  }
  function memberNames(m) {
    var M = Movements.data();
    return m.members.map(function (r) { return M.artists[r[0]] ? M.artists[r[0]][1] : ""; }).filter(Boolean);
  }

  /* A place in a life: its period, from the life's own file (lives/<id>.json). */
  function lifePeriod(it) {
    return json("lives/" + it.life + ".json").then(function (L) {
      var p = L && L.periods[it.p];
      if (p) { it.y0 = p.y0; it.y1 = p.y1; if (!it.artist) { it.artist = L.name; } }
      return p ? { L: L, p: p } : null;
    });
  }
  function surnameOf(a) { var w = String(a || "").split(" "); return w[w.length - 1]; }

  var LISTS = {
    // The three of a place in a life (KINDS.md, "lifeplace"): the works made there then,
    // who else was there then, and where those works are now.
    made: function (it) {
      return lifePeriod(it).then(function (r) {
        if (!r) { return { rows: [] }; }
        var L = r.L, p = r.p, rows = [];
        p.works.concat(p.prints).forEach(function (i) {
          var w = L.works[i], wi = w ? D.workIdx[w[0]] : undefined;
          if (wi === undefined) { return; }
          var how = w.length > 8 ? "pulled at " + w[8][0] : ({ record: "by its own record", site: "painted at a documented site", dated: "dated within these years" }[String(w[4] || "dated").split(":")[0]] || "");
          rows.push(workRow(wi, [w[2], how].filter(Boolean).join(" · ")));
        });
        return { rows: rows, note: rows.length ? "" : "No saved work is placed in " + p.place + " in these years." };
      });
    },
    herethen: function (it) {
      return Promise.all([lifePeriod(it), json("movements.json")]).then(function (r) {
        if (!r[0]) { return { rows: [] }; }
        var L = r[0].L, p = r[0].p, M = r[1], seen = {}, rows = [];
        (p.cross || []).forEach(function (ci) {
          var c = L.cross[ci];
          if (!c || seen[c[1]]) { return; }
          seen[c[1]] = true;
          rows.push(artistRow(c[1], "here " + years(c[4], c[5]) + " · both lives place them here"));
        });
        ((M && M.here && M.here[p.key]) || []).forEach(function (row) {
          var a = M.artists[row[0]];
          if (!a || a[1] === L.name || seen[a[1]] || row[2] < p.y0 - 1 || row[1] > p.y1 + 1) { return; }
          if (p.ll && isFinite(row[4]) && dist(p.ll[0], p.ll[1], row[4], row[5]) > 30) { return; }
          seen[a[1]] = true;
          var ya = Math.max(row[1], p.y0 - 1), yb = Math.min(row[2], p.y1 + 1);
          rows.push(artistRow(a[1], "here " + years(Math.min(ya, yb), Math.max(ya, yb)) + " · " + (row[7] || row[3])));
        });
        return { rows: rows, note: rows.length ? "" : "No other saved artist is placed in " + p.place + " in " + years(p.y0, p.y1) + " by the record." };
      });
    },
    nowat: function (it) {
      return lifePeriod(it).then(function (r) {
        if (!r) { return { rows: [] }; }
        var L = r.L, p = r.p, count = {}, loose = 0;
        p.works.concat(p.prints).forEach(function (i) {
          var w = L.works[i];
          if (!w) { return; }
          var held = D.heldBy[w[0]] || [];
          if (!held.length) { loose += 1; }
          held.forEach(function (slug) { count[slug] = (count[slug] || 0) + 1; });
        });
        var rows = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).map(function (slug) {
          return museumRow(slug, "holds " + plural(count[slug], "of them", "of them") + " · " + townName(D.townOf[slug]));
        }).filter(Boolean);
        return { rows: rows, note: loose ? plural(loose, "work", "works") + " from here " + (loose === 1 ? "is" : "are") +
          " held by no museum the site knows; each one’s history says where it went." : "" };
      });
    },
    works: function (it) {
      return worksIn(it).then(function (idx) {
        return { rows: worksOf(idx, it.k === "artist" ? function (i) { return D.works[i].y; } : null) };
      });
    },
    held: function (it) {
      return worksIn(it).then(function (idx) { return { rows: worksOf(idx) }; });
    },
    showing: function (it) {
      var a = D.k.artists[it.id];
      var list = a ? a[4] : [];
      var rows = list.map(showRow);
      var now = rows.filter(function (r) { return r.now; }).length;
      var recent = list.filter(function (si) { return yearOf(showOf(si)[2]) >= NOW - 2; }).length;
      var towns = {};
      list.forEach(function (si) { var k = venueOf(showOf(si)[1])[1]; if (k) { towns[k] = true; } });
      var note = rows.length ? [now ? now + " open now" : "none known open now",
        recent ? recent + " since " + (NOW - 2) : "", plural(Object.keys(towns).length, "city", "cities"),
        "as the records stood on " + fmtDate(D.asof)].filter(Boolean).join(" · ") :
        "No show, listing or sale of the saved works is recorded.";
      // Open now first, then newest.
      rows.sort(function (x, y) { return (y.now ? 1 : 0) - (x.now ? 1 : 0); });
      return Promise.resolve({ rows: rows, note: note, find: "Search by city, venue or title" });
    },
    movements: function (it) {
      var rows = [];
      var found = window.Movements ? Movements.ofArtistName(it.id) : [];
      found.forEach(function (m) {
        var named = m.label && m.label.name ? m.label.name + ", by Wikidata's movement of " + m.label.n + " of " + m.label.of : "";
        rows.push({ kind: "movement", title: m.title, sub: [m.who, named].filter(Boolean).join(" · "),
                    item: movementItem(m), hay: fold(m.title + " " + (m.who || "")), year: m.y0 });
      });
      var a = D.k.artists[it.id];
      (a ? a[3] : []).forEach(function (r) {
        var name = r[0].charAt(0).toUpperCase() + r[0].slice(1);
        var when = r[1] && r[2] ? years(r[1], r[2]) : r[1] ? "from " + r[1] : r[2] ? "to " + r[2] : "years not given";
        rows.push({ kind: "movement", title: name, sub: [when, "Wikidata (P135)"].join(" · "),
                    hay: fold(name), year: r[1] });
      });
      if (rows.length) { return Promise.resolve({ rows: rows, label: "Movements" }); }
      // Living, or no movement known: the circle — who was shown beside them since 2016.
      var count = {};
      (a ? a[4] : []).forEach(function (si) {
        var s = showOf(si);
        if (yearOf(s[2]) < NOW - 10 || s[4] === "o") { return; }
        s[6].forEach(function (i) { D.works[i].names.forEach(function (n) { if (n !== it.id) { count[n] = (count[n] || 0) + 1; } }); });
      });
      rows = Object.keys(count).sort(function (x, y) { return count[y] - count[x] || x.localeCompare(y); })
        .map(function (n) { return artistRow(n, "shown beside them " + plural(count[n], "time", "times")); });
      return Promise.resolve({ rows: rows, label: "Circle",
        note: rows.length ? "No movement is recorded; these were shown beside them since " + (NOW - 10) + "." :
          "No movement is recorded, and no one shown beside them." });
    },
    artist: function (it) {
      var w = it.k === "work" ? D.works[D.workIdx[it.id]] : { i: -1, names: it.artist ? [it.artist] : [] }, rows = [];
      w.names.forEach(function (n) {
        var mine = D.byArtist[n] || [];
        rows.push(artistRow(n, plural(mine.length, "saved work", "saved works") + lifeSpan(n)));
        worksOf(mine.filter(function (i) { return i !== w.i; })).slice(0, 89).forEach(function (r) { rows.push(r); });
      });
      return Promise.resolve({ rows: rows, count: w.names.length });
    },
    where: function (it) {
      var i = D.workIdx[it.id], rows = [];
      (D.heldBy[it.id] || []).forEach(function (slug) { var r = museumRow(slug, "holds it · " + townName(D.townOf[slug])); if (r) { rows.push(r); } });
      (D.workShows[i] || []).forEach(function (si) { rows.push(showRow(si)); });
      return Promise.resolve({ rows: rows, note: rows.length ? "" : "Its record names no museum, show, listing or sale." });
    },
    writings: function (it) {
      if (it.k === "show") { return showWritings(it); }
      var rows = [];
      ((D.voices && D.voices.w[it.id]) || []).slice().sort(function (x, y) {
        return (D.voices.voices[y[0]] || [])[3] - (D.voices.voices[x[0]] || [])[3];
      }).forEach(function (r) {
        var v = D.voices.voices[r[0]];
        if (v) { rows.push({ kind: "writing", title: v[1], sub: v[5], item: writerItem(v[0]), hay: fold(v[1] + " " + v[5]) }); }
      });
      return json("histories/" + it.id + ".json").then(function (h) {
        var seen = {};
        ((h && h.events) || []).forEach(function (e) {
          if (e.k !== "written") { return; }
          var t = e.t || e.n || e.q || "A writing";
          if (seen[t]) { return; }
          seen[t] = true;
          rows.push({ kind: "writing", title: t.length > 120 ? t.slice(0, 118) + "…" : t,
                      sub: [e.who, e.y].filter(Boolean).join(" · "), hay: fold([t, e.who, e.y].join(" ")), year: yearOf(e.y) });
        });
        return { rows: rows, note: rows.length ? "" : "Nothing written on it is recorded." };
      });
    },
    shows: function (it) {
      var list = [];
      if (it.k === "museum") { (D.slugVenues[it.id] || []).forEach(function (vi) { list = list.concat(D.venueShows[vi] || []); }); }
      else { list = (D.venueShows[it.id] || []).slice(); }
      list.sort(function (a, b) { return a - b; });
      var rows = list.map(showRow);
      rows.forEach(function (r) { delete r.also; });
      rows.sort(function (x, y) { return (y.now ? 1 : 0) - (x.now ? 1 : 0); });
      return Promise.resolve({ rows: rows, note: rows.length ? "" : "No show there is recorded among the saved works' histories." });
    },
    artists: function (it) {
      if (it.k === "place") { return placeArtists(it); }
      if (it.k === "movement") {
        var m = movement(it.id);
        var M = Movements.data();
        return Promise.resolve({ rows: m ? m.members.map(function (r) {
          var a = M.artists[r[0]];
          return artistRow(a[1], "here " + years(r[1], r[2]) + lifeSpan(a[1]));
        }) : [] });
      }
      return worksIn(it).then(function (idx) {
        var extra = [];
        if (it.k === "museum") { (D.slugVenues[it.id] || []).forEach(function (vi) { extra = extra.concat(showsOfVenue(vi)); }); }
        return { rows: artistsOf(idx.concat(extra)) };
      });
    },
    curated: function (it) {
      return detailOf(it).then(function (d) {
        var rows = [], seen = {};
        D.k.shows.forEach(function (s, si) { if (s[7].indexOf(it.id) >= 0) { seen[si] = true; rows.push(showRow(si)); } });
        ((d && d.acts) || []).forEach(function (a) {
          if (a.r !== "c") { return; }
          var key = fold(a.t) + a.y;
          if (seen[key] || rows.some(function (r) { return fold(r.title) === fold(a.t); })) { return; }
          seen[key] = true;
          rows.push({ kind: "gallery", title: a.t || "A show", sub: [a.at, townName(a.p), a.y].filter(Boolean).join(" · "), hay: fold([a.t, a.at].join(" ")) });
        });
        return { rows: rows, note: rows.length ? "" : "No show curated by them is recorded." };
      });
    },
    places: function (it) {
      if (it.k === "movement") { return movementPlaces(it); }
      if (it.k === "animal") { return animalPlaces(it); }
      if (it.k === "building") {
        var b = D.arch.filter(function (x) { return x.slug === it.id; })[0];
        var near = Object.keys(D.towns).map(function (k) { var t = D.towns[k]; return { t: t, km: dist(b.lat, b.lon, t.lat, t.lon) }; })
          .filter(function (o) { return o.km <= 150; }).sort(function (x, y) { return x.km - y.km; }).slice(0, 13);
        return Promise.resolve({ rows: near.map(function (o) { return placeRow(o.t.key, Math.round(o.km) + " km · " + plural(o.t.n, "work", "works")); }),
          note: (b.where ? b.where + (b.precision === "town" ? " · placed at its town" : "") : "") +
            (near.length ? "" : " · no city of the site's within 150 km") });
      }
      return worksIn(it).then(function (idx) {
        var count = {};
        idx.forEach(function (i) {
          (D.f.w[i][5] || []).forEach(function (pi) { count[pi] = (count[pi] || 0) + 1; });
        });
        return json("places.json").then(function (P) {
          var list = (P && (P.places || P)) || [];
          var rows = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).map(function (pi) {
            var p = list[pi];
            var key = p && (p.p || p[0]);
            return key ? placeRow(key, plural(count[pi], "of these works", "of these works")) : null;
          }).filter(Boolean);
          return { rows: rows };
        });
      });
    },
    museums: function (it) {
      if (it.k === "building") {
        var b = D.arch.filter(function (x) { return x.slug === it.id; })[0];
        var rows = D.mus.filter(function (m) { return typeof m.lat === "number"; }).map(function (m) {
          return { m: m, km: dist(b.lat, b.lon, m.lat, m.lon) };
        }).filter(function (o) { return o.km < 400; }).sort(function (x, y) { return x.km - y.km; }).slice(0, 21)
          .map(function (o) { return museumRow(o.m.slug, Math.round(o.km) + " km · " + o.m.held + " saved"); });
        return Promise.resolve({ rows: rows, note: rows.length ? "" : "No museum of the site's within 400 km." });
      }
      var t = D.towns[it.id];
      return Promise.resolve({ rows: (t ? t.museums : []).map(function (s) { return museumRow(s); }).filter(Boolean),
                               note: t && t.museums.length ? "" : "No museum here holds a saved work." });
    },
    galleries: function (it) {
      var vs = (D.townVenues[it.id] || []).filter(function (vi) { var v = venueOf(vi); return !(v[2] === "m" && v[3]); });
      vs.sort(function (a, b) { return (venueOf(b)[5] || 0) - (venueOf(a)[5] || 0) || (D.venueShows[b] || []).length - (D.venueShows[a] || []).length; });
      var rows = vs.map(function (vi) { return venueRowOf(vi); });
      var now = 0;
      vs.forEach(function (vi) { (D.venueShows[vi] || []).forEach(function (si) { if (nowWord(showOf(si))) { now += 1; } }); });
      return Promise.resolve({ rows: rows, note: rows.length ? [plural(rows.length, "venue", "venues"), now ? now + " open now" : "none known open now",
        "newest first"].join(" · ") : "No gallery, fair or sale room here is recorded." });
    },
    buildings: function (it) {
      var b = D.arch.filter(function (x) { return x.slug === it.id; })[0];
      var rows = D.arch.filter(function (x) { return x !== b && typeof x.lat === "number"; })
        .map(function (x) { return { x: x, km: dist(b.lat, b.lon, x.lat, x.lon) }; })
        .sort(function (p, q) { return p.km - q.km; })
        .map(function (o) { return { kind: "building", title: o.x.name || o.x.title, sub: [o.x.where, Math.round(o.km) + " km"].join(" · "),
                                     item: buildingItem(o.x), hay: fold([o.x.name, o.x.title, o.x.where].join(" ")) }; });
      return Promise.resolve({ rows: rows });
    },
    walks: function (it) {
      return json("characters/walks.json").then(function (W) {
        var rows = ((W && W.walks) || []).filter(function (w) { return w.animal === it.id; }).map(function (w) {
          return { kind: "path", title: w.title, sub: plural(w.stops.length, "stop", "stops") + (w.sentence ? " · " + w.sentence : ""),
                   hay: fold(w.title), go: function () { if (window.Walks) { Walks.play(w); } } };
        });
        return { rows: rows };
      });
    }
  };
  // A list, whatever goes wrong in it said rather than thrown.
  function list(tab, it) {
    return Promise.resolve().then(function () { return LISTS[tab](it); })
      .catch(function () { return { rows: [], note: "This list could not be read just now." }; })
      .then(function (r) { return r || { rows: [] }; });
  }
  // The shows' writers: its curators, then the voices on its works.
  function showWritings(it) {
    var rows = [], seen = {};
    if (typeof it.id === "number") {
      showOf(it.id)[7].forEach(function (id) {
        var v = D.voice[id];
        if (v) { seen[id] = true; rows.push({ kind: "writing", title: v.name, sub: "curated it · " + v.line, item: writerItem(id), hay: fold(v.name) }); }
      });
    }
    return worksIn(it).then(function (idx) {
      idx.forEach(function (i) {
        ((D.voices && D.voices.w[D.works[i].id]) || []).forEach(function (r) {
          var v = D.voices.voices[r[0]];
          if (v && !seen[v[0]]) { seen[v[0]] = true; rows.push({ kind: "writing", title: v[1], sub: "wrote on " + D.works[i].t + " · " + v[5], item: writerItem(v[0]), hay: fold(v[1]) }); }
        });
      });
      return { rows: rows, note: rows.length ? "" : "No curator or writer on it is recorded." };
    });
  }
  function showsOfVenue(vi) {
    var idx = [];
    (D.venueShows[vi] || []).forEach(function (si) { showOf(si)[6].forEach(function (i) { idx.push(i); }); });
    return idx;
  }
  function placeArtists(it) {
    var why = {};
    function add(n, w) { if (!n) { return; } (why[n] = why[n] || []); if (why[n].indexOf(w) < 0) { why[n].push(w); } }
    var t = D.towns[it.id];
    return (window.Lives ? Lives.load() : Promise.resolve(null)).then(function (L) {
      if (L && t) {
        L.lives.forEach(function (r) { if (r[10] && fold(r[10]) === fold(t.name)) { add(r[1], "born here"); } });
      }
      if (window.Movements) {
        return Movements.load().then(function () {
          (Movements.here(it.id) || []).forEach(function (p) {
            var M = Movements.data(), a = M && M.artists[p[0]];
            if (a) { add(a[1], "worked here " + years(p[1], p[2])); }
          });
        });
      }
    }).then(function () {
      (D.townVenues[it.id] || []).forEach(function (vi) {
        (D.venueShows[vi] || []).forEach(function (si) {
          var s = showOf(si);
          s[6].forEach(function (i) { D.works[i].names.forEach(function (n) { add(n, "shown here"); }); });
        });
      });
      var rank = function (n) { return why[n].length * 1000 + (D.byArtist[n] || []).length; };
      var rows = Object.keys(why).sort(function (a, b) { return rank(b) - rank(a) || a.localeCompare(b); })
        .map(function (n) { return artistRow(n, why[n].join(" · ") + lifeSpan(n)); });
      return { rows: rows };
    });
  }
  function movementPlaces(it) {
    var m = movement(it.id), M = Movements.data(), rows = [], seen = {};
    if (!m) { return Promise.resolve({ rows: [] }); }
    var c = placeRow(m.key, "the movement's city");
    if (c) { rows.push(c); seen[m.key] = true; }
    m.members.forEach(function (r) {
      var a = M.artists[r[0]], b = a && a[7];
      if (!b) { return; }
      var near = nearestTown(b[1], b[2], 40);
      if (near && !seen[near.t.key]) {
        seen[near.t.key] = true;
        rows.push(placeRow(near.t.key, "birthplace of " + a[1]));
      } else if (!near) {
        rows.push({ kind: "place", title: b[0], sub: "birthplace of " + a[1] + " · no saved work has been there", hay: fold(b[0] + " " + a[1]) });
      }
    });
    return Promise.resolve({ rows: rows.filter(Boolean) });
  }
  function animalPlaces(it) {
    return json("characters/artists.json").then(function (A) {
      var a = A && A.artists[it.artist];
      var rows = ((a && (a.places || a.route)) || []).map(function (p) {
        var key = p[0] || p.key;
        return placeRow(key, (p[5] && p[5].length ? plural(p[5].length, "of the artist's works", "of the artist's works") : ""));
      }).filter(Boolean);
      return { rows: rows };
    });
  }

  /* ---- the header ------------------------------------------------------- */

  function hostFor(w) {
    if (!w) { return null; }
    if (w.at === "museum" || w.at === "building") { return works; }
    if (w.at === "work" || w.at === "town" || w.at === "life" || w.at === "movement" || w.at === "thread") { return artCol; }
    return null;
  }

  function render() {
    var h = head;
    if (!h) { head = h = el("section", "kinds-head"); h.setAttribute("aria-label", "What this is, and three ways on"); }
    h.textContent = "";
    if (!cur || !D) { return; }
    var it = cur.item, row = fromOf(it);
    var kd = kindOf(row ? row.kind : it.k);
    h.dataset.kind = kd.kind;
    h.style.setProperty("--kt", kd.tone);
    // The way you came.
    if (trail.length > 1) {
      var nav = el("nav", "kinds-crumbs");
      nav.setAttribute("aria-label", "The way you came");
      var most = window.innerWidth <= 720 ? 3 : 5;
      var show = trail.slice(-most);
      if (trail.length > most) { nav.appendChild(el("span", "kinds-crumb-more", "… ")); }
      show.forEach(function (t, i) {
        if (i) { nav.appendChild(el("span", "kinds-sep", " › ")); }
        var last = i === show.length - 1;
        var tk = kindOf((fromOf(t.item) || {}).kind || t.item.k);
        if (last) {
          nav.appendChild(el("span", "kinds-crumb kinds-crumb-here", shortName(t.item.name)));
        } else {
          var b = el("button", "kinds-crumb", shortName(t.item.name));
          b.type = "button";
          b.style.setProperty("--kt", tk.tone);
          b.title = tk.name + " · " + t.item.name;
          b.addEventListener("click", function (event) { event.stopPropagation(); back(t); });
          nav.appendChild(b);
        }
      });
      if (cur.tab) {
        nav.appendChild(el("span", "kinds-sep", " › "));
        nav.appendChild(el("span", "kinds-crumb kinds-crumb-tab", T.tabs[cur.tab] ? (cur.label || T.tabs[cur.tab].label) : cur.tab));
      }
      h.appendChild(nav);
    }
    // What this is.
    var what = el("p", "kinds-what");
    var g = el("span", "kinds-glyph", kd.glyph);
    g.setAttribute("aria-hidden", "true");
    what.appendChild(g);
    what.appendChild(el("span", "kinds-name", kd.name));
    var sub = SUBNAME[it.k];
    if (sub) { what.appendChild(el("span", "kinds-sub", sub(it))); }
    what.appendChild(el("span", "kinds-title", it.name));
    // Following an animal or a voice: the one followed, a door.
    var f = window.Land && Land.following && Land.following();
    if (f && !cur.solo) {
      var fit = f.voice ? writerItem(f.voice) : f.cast ? { k: "animal", id: f.cast, name: f.animal, artist: f.artist } : null;
      if (fit && !same(fit, it)) {
        var fb = el("button", "kinds-follow", (f.voice ? "¶ following " : "∴ following the " + String(f.animal || "").toLowerCase() + " · ") + (f.voice ? f.artist : f.artist));
        fb.type = "button";
        fb.addEventListener("click", function (event) { event.stopPropagation(); go(fit); });
        what.appendChild(fb);
      }
    }
    h.appendChild(what);
    h.appendChild(spectrum(it, kd));
    // The three.
    var tabs = el("div", "kinds-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Three ways on from here");
    var panel = el("div", "kinds-panel");
    panel.hidden = true;
    var three = row ? [row.first, row.second, row.third] : [];
    three.forEach(function (tab) {
      var tb = T.tabs[tab];
      if (!tb) { return; }
      var tk = kindOf(tb.kind);
      var b = el("button", "kinds-tab");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.tab = tab;
      b.style.setProperty("--kt", tk.tone);
      var tg = el("span", "kinds-tab-glyph", tk.glyph);
      tg.setAttribute("aria-hidden", "true");
      b.appendChild(tg);
      var lab = el("span", "kinds-tab-label", tb.label);
      b.appendChild(lab);
      var n = el("span", "kinds-tab-n", "");
      b.appendChild(n);
      b.setAttribute("aria-selected", cur.tab === tab ? "true" : "false");
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        if (cur.tab === tab) { cur.tab = null; panel.hidden = true; panel.textContent = ""; mark(); syncTrail(); render(); return; }
        cur.tab = tab;
        syncTrail();
        render();
      });
      tabs.appendChild(b);
      // Counts, and a label the list may change (Movements → Circle).
      LISTS[tab] && list(tab, it).then(function (res) {
        if (!res) { return; }
        var c = res.count !== undefined ? res.count : res.rows.length;
        n.textContent = " " + c.toLocaleString("en");
        if (res.label) { lab.textContent = res.label; if (cur.tab === tab) { cur.label = res.label; } }
        if (!res.rows.length) { b.dataset.empty = "true"; }
      });
    });
    function mark() {
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-selected", b.dataset.tab === cur.tab ? "true" : "false"); });
    }
    h.appendChild(tabs);
    h.appendChild(panel);
    if (cur.tab && LISTS[cur.tab]) { fill(panel, it, cur.tab); }
    // An artist's life, folded under its three.
    if (it.k === "artist" && !cur.solo && hostEl === artCol) {
      var fold_ = el("button", "kinds-fold");
      fold_.type = "button";
      var open = hostEl.dataset.kindsFold !== "true";
      fold_.textContent = open ? "Fold the life ‹" : "Read the life ›";
      fold_.setAttribute("aria-expanded", open ? "true" : "false");
      fold_.addEventListener("click", function (event) {
        event.stopPropagation();
        if (hostEl.dataset.kindsFold === "true") { delete hostEl.dataset.kindsFold; } else { hostEl.dataset.kindsFold = "true"; }
        render();
      });
      h.appendChild(fold_);
    }
    if (cur.solo) {
      var w = viewNow, back_ = el("button", "kinds-back");
      back_.type = "button";
      var vt = trail.filter(function (t) { return t.view; }).slice(-1)[0];
      back_.textContent = "‹ " + (vt ? vt.item.name : "Back");
      back_.addEventListener("click", function (event) { event.stopPropagation(); if (vt) { back(vt); } else { unsolo(); } });
      if (w) { h.appendChild(back_); }
    }
  }
  var viewNow = null;
  var SUBNAME = {
    institution: function () { return "a museum"; },
    collection: function () { return "a collection"; },
    gallery: function (it) { return VTYPE[venueOf(it.id)[2]] || "a gallery"; },
    show: function (it) { return typeof it.id === "number" && showOf(it.id)[4] === "f" ? "at a fair" : "a show"; },
    sale: function () { return "a sale"; },
    writer: function (it) { var v = D.voice[it.id]; return v ? ({ c: "curator", w: "writer", s: "writer" }[v.roles.charAt(0)] || "writer") : "writer"; },
    publication: function () { return "a writing"; },
    building: function () { return "a building"; },
    animal: function () { return "an animal"; },
    lifeplace: function (it) { return it.artist ? "in " + possessive(it.artist) + " life" : "a place in a life"; }
  };
  function possessive(a) {
    var w = String(a || "").split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    var sn = w.slice(k).join(" ");
    return sn + (/s$/.test(sn) ? "’" : "’s");
  }
  function shortName(n) { n = String(n || ""); return n.length > 26 ? n.slice(0, 24).replace(/\s+\S*$/, "") + "…" : n; }

  // A tab's list: the note, the search field, the rows 34 at a time.
  function fill(panel, it, tab) {
    panel.hidden = false;
    panel.textContent = "";
    var tb = T.tabs[tab];
    var said = el("p", "kinds-note", "Reading…");
    panel.appendChild(said);
    list(tab, it).then(function (res) {
      if (!cur || !same(cur.item, it) || cur.tab !== tab) { return; }
      said.textContent = res.note || "";
      if (!res.note) { said.hidden = true; }
      var field = el("input", "kinds-find");
      field.type = "search";
      field.placeholder = res.find || ("Search " + (res.label || tb.label).toLowerCase());
      field.setAttribute("aria-label", field.placeholder);
      field.autocomplete = "off";
      field.spellcheck = false;
      var list = el("div", "kinds-rows");
      list.setAttribute("role", "list");
      var more = el("button", "kinds-more");
      more.type = "button";
      var rows = res.rows, shown = 0, hits = rows;
      function draw(reset) {
        if (reset) { list.textContent = ""; shown = 0; }
        hits.slice(shown, shown + PAGE).forEach(function (r) { list.appendChild(rowEl(r)); });
        shown = Math.min(hits.length, shown + PAGE);
        more.hidden = shown >= hits.length;
        more.textContent = "More · " + (hits.length - shown).toLocaleString("en");
        if (!hits.length && field.value) { list.appendChild(el("p", "kinds-note", "Nothing here by that name.")); }
      }
      field.addEventListener("input", function () {
        var toks = fold(field.value).split(" ").filter(Boolean);
        hits = !toks.length ? rows : rows.filter(function (r) {
          var hay = r.hay || fold(r.title + " " + (r.sub || ""));
          for (var k = 0; k < toks.length; k += 1) { if (hay.indexOf(" " + toks[k]) < 0) { return false; } }
          return true;
        });
        draw(true);
      });
      ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
        field.addEventListener(ev, function (event) { event.stopPropagation(); }, { passive: ev !== "keydown" });
      });
      more.addEventListener("click", function (event) { event.stopPropagation(); draw(false); });
      if (rows.length > 8) { panel.appendChild(field); }
      panel.appendChild(list);
      panel.appendChild(more);
      draw(true);
    });
  }

  /* ---- going: into a thing, back along the way ---------------------------- */

  function syncTrail() {
    if (!trail.length || !cur) { return; }
    var last = trail[trail.length - 1];
    if (same(last.item, cur.item)) { last.tab = cur.tab; }
  }
  function enter(item, solo, view) {
    var at = -1;
    trail.forEach(function (t, i) { if (same(t.item, item)) { at = i; } });
    var tab = null;
    if (at >= 0) { tab = trail[at].tab; trail = trail.slice(0, at + 1); trail[at].item = item; }
    else { trail.push({ item: item, tab: null, view: !!view }); }
    if (trail.length > 21) { trail = trail.slice(-21); }
    var row = fromOf(item);
    cur = { item: item, solo: !!solo, tab: tab || (solo && row ? row.first : null) };
    syncTrail();
    place();
  }
  // Into a thing: its view if it has one, else in place.
  function go(item) {
    if (!item || !D) { return; }
    if (cur && same(cur.item, item)) { if (cur.solo) { return; } }
    var open = opener(item);
    if (open) {
      if (viewNow && same(viewNow, item)) { unsolo(); enter(item, false, true); return; }
      pending = item;
      open();
      return;
    }
    if (item.k === "writer" || item.k === "publication" || item.k === "collection") {
      detailOf(item).then(function () { enter(item, true); });
      return;
    }
    if (item.k === "animal") {
      json("characters/characters.json").then(function (C) {
        var c = C && C.cast.filter(function (x) { return x.id === item.id; })[0];
        if (c) { item.artist = c.artist; item.name = c.name; }
        enter(item, true);
      });
      return;
    }
    enter(item, true);
  }
  function back(t) {
    if (t.view || opener(t.item)) {
      if (viewNow && same(viewNow, t.item)) { unsolo(); enter(t.item, false, true); return; }
      go(t.item);
      return;
    }
    enter(t.item, true);
  }
  function unsolo() { if (hostEl) { delete hostEl.dataset.kindsSolo; } }

  // The header into its column, at the head; the column set aside while a thing is opened in place.
  function place() {
    if (!head) { render(); }
    var host = hostEl;
    if (!host || !cur) { if (head && head.parentNode) { head.parentNode.removeChild(head); } return; }
    render();
    if (head.parentNode !== host || host.firstChild !== head) { host.insertBefore(head, host.firstChild); }
    if (cur.solo) { host.dataset.kindsSolo = "true"; host.scrollTop = 0; } else { delete host.dataset.kindsSolo; }
    if (buildingEl) {
      if (host === works && cur.item.k === "building") { buildingEl.dataset.kindsOn = "true"; } else { delete buildingEl.dataset.kindsOn; }
    }
  }

  /* ---- following the page ---------------------------------------------------

     The view is read from Land.where() (polled, as walks.js and
     characters.js do); a new view is a step on the way. The column is
     rebuilt by land.js as views change: the header is put back at its head
     whenever it is taken out. */

  function tick() {
    if (!window.Land || !Land.where) { return; }
    var w = Land.where();
    var key = w.flying ? viewKey : [w.at, w.key, w.work, w.museum, w.id, w.building, w.name, w.life ? w.life.id + ":" + w.life.k : ""].join("|");
    if (w.flying) { return; }
    if (key === viewKey) { keep(); return; }
    viewKey = key;
    var host = hostFor(w);
    if (!host) {
      viewNow = null;
      if (w.at === "world") { trail = []; }
      cur = null;
      [artCol, works].forEach(function (h) { if (h) { delete h.dataset.kindsSolo; delete h.dataset.kindsFold; } });
      if (buildingEl) { delete buildingEl.dataset.kindsOn; }
      if (head && head.parentNode) { head.parentNode.removeChild(head); }
      hostEl = null;
      return;
    }
    load().then(function () { return viewItem(w); }).then(function (it) {
      if (viewKey !== key) { return; }
      [artCol, works].forEach(function (h) { if (h && h !== host) { delete h.dataset.kindsSolo; delete h.dataset.kindsFold; } });
      hostEl = host;
      delete host.dataset.kindsSolo;
      if (!it) { viewNow = null; cur = null; if (head && head.parentNode) { head.parentNode.removeChild(head); } return; }
      if (pending && pending.k === it.k && pending.id === it.id) { it = pending; }
      pending = null;
      viewNow = it;
      // An artist's life opens folded under its three.
      if (it.k === "artist" && host === artCol) { host.dataset.kindsFold = "true"; } else { delete host.dataset.kindsFold; }
      enter(it, false, true);
    });
  }
  function keep() {
    if (!cur || !hostEl || !head) { return; }
    if (head.parentNode !== hostEl || hostEl.firstChild !== head) { hostEl.insertBefore(head, hostEl.firstChild); }
  }
  [artCol, works].forEach(function (h) {
    if (!h || !window.MutationObserver) { return; }
    new MutationObserver(function () { if (hostEl === h) { keep(); } }).observe(h, { childList: true });
  });
  window.setInterval(tick, 400);

  /* ---- Find, grouped by category ----------------------------------------- */

  var found = document.getElementById("finder-found");
  var grouping = false;
  function catOf(text) {
    if (!T) { return null; }
    for (var i = 0; i < T.find.length; i += 1) {
      if (text.indexOf(T.find[i].head) === 0) { return T.find[i].kind; }
    }
    return null;
  }
  function group() {
    if (!found || !T || grouping) { return; }
    grouping = true;
    // Segments: a heading and what follows it, or a box of a module's with its heading in it.
    var segs = [], seg = null;
    Array.prototype.slice.call(found.children).forEach(function (c) {
      var h = c.classList.contains("finder-group") ? c : c.querySelector && c.querySelector(".finder-group");
      if (h && !c.classList.contains("finder-foot") && !h.classList.contains("finder-foot")) {
        seg = { head: h, els: [c], kind: h.dataset.kinds || catOf(h.textContent.replace(/^\S\s/, "")) };
        segs.push(seg);
      } else if (seg) { seg.els.push(c); }
      else { segs.push({ head: null, els: [c], kind: null }); }
    });
    segs.forEach(function (s) {
      if (!s.head || !s.kind || s.head.dataset.kinds) { return; }
      var kd = kindOf(s.kind);
      s.head.dataset.kinds = s.kind;
      s.head.style.setProperty("--kt", kd.tone);
      var tag = el("span", "kinds-find-tag", kd.glyph + " " + kd.name + " ·");
      tag.setAttribute("aria-hidden", "true");
      if (s.head.textContent.indexOf(kd.name) !== 0) { s.head.insertBefore(tag, s.head.firstChild); }
      else { var gl = el("span", "kinds-find-tag kinds-find-glyph", kd.glyph); gl.setAttribute("aria-hidden", "true"); s.head.insertBefore(gl, s.head.firstChild); }
    });
    // In the spectrum's order (KINDS.md's), what has no category last as it was.
    var rank = function (s) { var i = s.kind ? T.order.indexOf(s.kind) : -1; return i < 0 ? 99 : i; };
    var sorted = segs.map(function (s, i) { return { s: s, i: i }; })
      .sort(function (a, b) { return rank(a.s) - rank(b.s) || a.i - b.i; });
    var moved = sorted.some(function (o, i) { return o.i !== i; });
    if (moved) {
      var foot = Array.prototype.slice.call(found.querySelectorAll(":scope > .finder-foot"));
      sorted.forEach(function (o) { o.s.els.forEach(function (e) { if (foot.indexOf(e) < 0) { found.appendChild(e); } }); });
      foot.forEach(function (e) { found.appendChild(e); });
    }
    grouping = false;
  }
  if (found && window.MutationObserver) {
    var wait = 0;
    new MutationObserver(function () {
      if (grouping) { return; }
      window.clearTimeout(wait);
      wait = window.setTimeout(function () { readTable().then(group); }, 60);
    }).observe(found, { childList: true });
  }

  window.Kinds = {
    load: load,
    kind: function (k) { var x = T && T.kinds[k]; return x ? { glyph: x.glyph, tone: x.tone, name: x.name } : null; },
    go: function (k, id) { return load().then(function () { var it = itemOf(k, id); if (it) { go(it); } return !!it; }); },
    current: function () { return cur && { k: cur.item.k, id: cur.item.id, name: cur.item.name, tab: cur.tab, solo: cur.solo }; },
    trail: function () { return trail.map(function (t) { return t.item.name; }); },
    tab: function (name) { if (cur) { cur.tab = name; syncTrail(); place(); } },
    _state: function () {
      return { cur: window.Kinds.current(), trail: window.Kinds.trail(), view: viewNow && viewNow.name,
               head: head && head.isConnected ? head.innerText.slice(0, 400) : "" };
    }
  };
})();

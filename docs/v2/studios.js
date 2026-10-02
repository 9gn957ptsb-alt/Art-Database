/* The studios — where each saved artist worked, as the record has it.

   The artist, 1 Oct 2026: "Give a site to artist studios to catalogue
   individual artists with specific locations".

   studios.json (scripts/build_studios.py, from Wikidata, Wikipedia and a
   hand table with its sources): the catalogue of artists, one row a place
   each worked or lived (a studio, a house, a town the record names), how
   exactly it is placed and why, its photographs (Commons files, shown live
   from Commons, never copied), what has been said of it, the saved works
   made there and how that is known; the globe's marks; one exploration an
   artist.

   On the globe (land.js, the Studios layer): an exact studio is a small
   square in a square, named by its artist; a town where the record has
   artists working is a quieter one, named by the most saved of them.
   Pressed, the world goes down to the point (Land.studio) and the column
   opens on this (Studios.column): the artist, the years, the photographs,
   the words, the works made there, the artist's other places in time order
   (each a journey), the route walked whole, and the artist's animal where
   one is cast. Find: "studios" is the catalogue; "<artist> studios" plays
   that artist's route. */
(function () {
  "use strict";

  var COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";
  var CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var D = null, loading = null;
  var CAST = { "Cy Twombly": "fox", "Elaine de Kooning": "bison", "Henri Matisse": "squirrel",
               "Andy Warhol": "eagle", "Anish Kapoor": "slug", "David Hockney": "deer" };
  var ANIMAL = { fox: "red fox", bison: "bison", squirrel: "red squirrel", eagle: "bald eagle", slug: "banana slug", deer: "red deer" };
  var KIND = { studio: "Studio", house: "House", worked: "Worked here", lived: "Lived here", "lived and worked": "Lived and worked here" };
  var HOW = {
    record: "its own record says it was made in this town",
    site: "Painted here puts the place it shows within 25 km",
    dated: "dated within these years, and in no other dated place of the artist’s"
  };
  var current = null;                   // { rows: [...], i: the row shown }

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
  function fold(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function surname(a) {
    var w = String(a || "").split(" "), k = w.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function commons(f, w) { return COMMONS + encodeURIComponent(f) + (w ? "?width=" + w : ""); }

  function load() {
    if (D) { return Promise.resolve(D); }
    if (loading) { return loading; }
    loading = fetch("studios.json").then(function (r) { if (!r.ok) { throw new Error("studios"); } return r.json(); })
      .then(function (d) {
        d.byArtist = {};
        d.artists.forEach(function (a, i) { d.byArtist[a[1]] = i; });
        d.byEx = {};
        d.explorations.forEach(function (x, i) { d.byEx[x.id] = i; });
        D = d;
        return D;
      }).catch(function () { loading = null; return null; });
    return loading;
  }

  // The saved works, for their squares and titles (finding.json, read once).
  var finding = null, findingAsk = null;
  function readFinding() {
    if (finding) { return Promise.resolve(finding); }
    if (findingAsk) { return findingAsk; }
    findingAsk = fetch("finding.json").then(function (r) { return r.json(); }).then(function (f) {
      finding = { cdn: f.cdn || CDN, by: {} };
      f.w.forEach(function (w) { finding.by[w[0]] = w; });
      return finding;
    }).catch(function () { findingAsk = null; return null; });
    return findingAsk;
  }

  function where() { return window.Land && Land.where ? Land.where() : { at: "world" }; }
  function artistOf(r) { return D.artists[r.a]; }
  function kindWord(r) { return KIND[r.kind] || "Studio"; }

  /* How exactly, in words: the point and why it is no closer. */
  function exactly(r) {
    var p = r.place || r.name || "";
    switch (r.pr) {
      case "exact": return "Placed exactly · " + r.why;
      case "street": return "On the street · " + r.why;
      case "district": return p + " · " + r.why;
      default: return (p ? p + " — " : "") + r.why;
    }
  }

  function years(r) { return r.yt || ""; }

  /* ---- going there ---------------------------------------------------------- */

  function kmFor(r) { return { exact: 0.9, street: 1.4, district: 3 }[r.pr] || 6; }

  // A mark of the globe: one row, or a town's rows (several artists).
  function openMark(m) {
    return load().then(function () {
      if (!D) { return; }
      var rows = m[4];
      go(rows, rows[0], m[5] === "town" && rows.length > 1);
    });
  }

  function go(rows, i, many) {
    var r = D.studios[i];
    if (!r || !window.Land) { return; }
    var pay = { rows: rows, i: i, many: !!many, alone: r.km > 30 };
    var w = where();
    // Already in that city: the column changes, the world eases round to it.
    if (w.at === "town" && w.key === r.key && !w.flying && current && current.box && current.box.isConnected) {
      current.pay = pay;
      fill(current.box, pay);
      if (Land.look) { Land.look(r.ll[0], r.ll[1]); }
      return;
    }
    var name = many ? (r.place || r.name) : (r.pr === "town" ? (r.place || r.name) : r.name);
    if (Land.studio) { Land.studio(r.key, r.ll[0], r.ll[1], kmFor(r), name, pay); }
    else if (Land.site) { Land.site(r.key, r.ll[0], r.ll[1], kmFor(r), name); }
  }

  function open(i) { return load().then(function () { if (D && D.studios[i]) { go([i], i, false); } }); }

  /* ---- the column ------------------------------------------------------------ */

  function column(pay) {
    if (!D || !pay) { return null; }
    var box = el("section", "studio-box");
    box.setAttribute("aria-label", "Studios");
    current = { box: box, pay: pay };
    fill(box, pay);
    return box;
  }

  function fill(box, pay) {
    box.textContent = "";
    if (pay.many && pay.rows.length > 1 && pay.list !== false) { fillPlace(box, pay); return; }
    var r = D.studios[pay.i];
    var A = artistOf(r);
    box.dataset.kind = r.kind;
    if (pay.many) {
      box.appendChild(button("‹ All here · " + pay.rows.length, "studio-back", function () { pay.list = true; delete pay.one; fill(box, pay); }));
    }
    box.appendChild(el("p", "town-section studio-kicker", kindWord(r) + (r.place && r.pr !== "town" ? " · " + r.place : "")));
    var t = el("p", "studio-title");
    t.appendChild(document.createTextNode(r.pr === "town" ? (r.place || r.name) : r.name));
    box.appendChild(t);
    box.appendChild(el("p", "studio-by", [A[1], years(r)].filter(Boolean).join(" · ") +
      (r.built && r.pr !== "town" ? " · built " + r.built : "")));
    box.appendChild(el("p", "studio-exact", exactly(r)));

    // The photographs: now, and then where Commons has one; the interior.
    if ((r.photos || []).length) {
      var fig = el("figure", "studio-fig");
      var img = el("img");
      img.alt = r.name + " — photograph";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      var cap = el("figcaption", "studio-credit");
      function show(p) {
        delete fig.dataset.missing;
        img.src = commons(p.f, 720);
        cap.textContent = (p.of === "then" ? "Then · " : p.of === "inside" ? "Inside · " : "Now · ") +
          "photo " + (p.by || "Wikimedia Commons") + (p.lic ? ", " + p.lic : "");
      }
      img.addEventListener("error", function () { fig.dataset.missing = "true"; });
      img.addEventListener("load", function () { fig.dataset.on = "true"; });
      fig.appendChild(img);
      fig.appendChild(cap);
      if (r.photos.length > 1) {
        var tabs = el("div", "studio-tabs");
        r.photos.forEach(function (p, k) {
          var b = button(p.of === "then" ? "then" : p.of === "inside" ? "inside" : "now", "studio-tab", function () {
            show(p);
            Array.prototype.forEach.call(tabs.children, function (c, j) { c.dataset.on = j === k ? "true" : "false"; });
          });
          b.dataset.on = k ? "false" : "true";
          tabs.appendChild(b);
        });
        fig.appendChild(tabs);
      }
      show(r.photos[0]);
      box.appendChild(fig);
    }

    // What has been said of it.
    (r.said || []).slice(0, 2).forEach(function (s) {
      var one = el("div", "art-said-one");
      one.dataset.k = "wiki";
      one.appendChild(el("p", "art-said-q", "“" + s.q + "”"));
      var by = el("p", "art-said-by");
      by.appendChild(el("span", "art-said-who", s.by));
      if (s["in"]) { by.appendChild(el("span", "art-said-in", s["in"])); }
      if (s.url && /^https?:\/\//.test(s.url)) {
        var host = s.url;
        try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch (x) {}
        var a = el("a", "art-go", "Read it at " + host + " ↗");
        a.href = s.url;
        a.target = "_blank";
        a.rel = "noopener";
        by.appendChild(document.createTextNode(" "));
        by.appendChild(a);
      }
      one.appendChild(by);
      box.appendChild(one);
    });

    // The animal, where the artist has one.
    var cast = CAST[A[1]];
    if (cast && window.Characters && Characters.lead && Land.follow) {
      var f = Land.following && Land.following();
      if (f && f.artist === A[1]) {
        box.appendChild(el("p", "town-museum-meta studio-animal", "The " + ANIMAL[cast] + " waits here"));
      } else {
        box.appendChild(button("Follow the " + ANIMAL[cast] + " · " + surname(A[1]) + " ›", "read-quiet studio-follow", function () {
          Characters.lead(cast).then(function (got) {
            if (!got) { return; }
            var rr = D.studios[pay.i];
            got.studio = { lat: rr.ll[0], lon: rr.ll[1] };
            Land.follow(got);
          });
        }));
      }
    }

    // The works made there.
    var works = r.works || [];
    if (works.length) {
      box.appendChild(el("p", "town-section", "Made here · " + works.length));
      var hows = {};
      works.forEach(function (w) { hows[w[1]] = (hows[w[1]] || 0) + 1; });
      box.appendChild(el("p", "town-museum-meta studio-how", Object.keys(hows).sort().map(function (h) {
        return hows[h] + " " + HOW[h];
      }).join(" · ")));
      var thumbs = el("div", "town-thumbs studio-works");
      box.appendChild(thumbs);
      readFinding().then(function (fd) {
        works.slice(0, 34).forEach(function (w) {
          var row = fd && fd.by[w[0]];
          var b = el("button", "town-thumb");
          b.type = "button";
          b.setAttribute("aria-label", (row ? (row[1] || "Untitled") + ", " + (row[3] || "") : "A saved work") + " — where it has been");
          b.title = row ? (row[1] || "Untitled") + (row[3] ? ", " + row[3] : "") : "";
          if (row && row[4]) {
            var im = el("img");
            im.alt = "";
            im.loading = "lazy";
            im.decoding = "async";
            im.referrerPolicy = "no-referrer";
            im.src = (fd.cdn || CDN) + row[4] + "/square.jpg";
            im.addEventListener("error", function () { b.classList.add("town-thumb-none"); });
            b.appendChild(im);
          } else { b.classList.add("town-thumb-none"); }
          b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
          b.addEventListener("click", function (event) { event.stopPropagation(); Land.work(w[0], r.key); });
          thumbs.appendChild(b);
        });
      });
    }

    // The artist's other places, in time order: each a journey.
    var mine = A[6];
    if (mine.length > 1) {
      box.appendChild(el("p", "town-section", "Other studios of " + A[1] + " · " + (mine.length - 1)));
      var list = el("ol", "studio-route");
      mine.forEach(function (j) {
        var s = D.studios[j];
        var li = el("li");
        var b = button("", "studio-stop", function () { go([j], j, false); });
        b.appendChild(el("span", "studio-stop-name", s.pr === "town" ? (s.place || s.name) : s.name));
        b.appendChild(el("span", "studio-stop-meta", [kindWord(s), years(s)].filter(Boolean).join(" · ")));
        if (j === pay.i) { b.dataset.here = "true"; b.setAttribute("aria-current", "true"); }
        li.appendChild(b);
        list.appendChild(li);
      });
      box.appendChild(list);
      var x = D.explorations[D.byEx["studios-" + A[0]]];
      if (x) { box.appendChild(button("Walk " + surname(A[1]) + "’s studios · " + x.n + " ›", "read-quiet studio-walk", function () { play(x); })); }
    }

    // Sources.
    var src = el("p", "art-sources studio-src");
    src.appendChild(document.createTextNode("From "));
    (r.src || []).forEach(function (s, k) {
      if (k) { src.appendChild(document.createTextNode("; ")); }
      if (s.url && /^https?:\/\//.test(s.url)) {
        var a = el("a", "studio-src-a", s.name);
        a.href = s.url;
        a.target = "_blank";
        a.rel = "noopener";
        src.appendChild(a);
      } else { src.appendChild(document.createTextNode(s.name)); }
    });
    src.appendChild(document.createTextNode("." + ((r.photos || []).length ? " Photographs from Wikimedia Commons, under their own licences." : "")));
    box.appendChild(src);
  }

  // A town where many worked: every artist the record has here, most saved first.
  function fillPlace(box, pay) {
    var r0 = D.studios[pay.rows[0]];
    box.appendChild(el("p", "town-section studio-kicker", "Studios · " + (r0.place || r0.name)));
    var by = {};
    pay.rows.forEach(function (i) { var a = D.studios[i].a; (by[a] = by[a] || []).push(i); });
    var as = Object.keys(by).map(Number);
    box.appendChild(el("p", "studio-by", as.length + (as.length === 1 ? " artist" : " artists") + " worked or lived here, as the record has it"));
    box.appendChild(el("p", "studio-exact", "Only the town is given for each: " + (r0.why || "")));
    var list = el("ol", "studio-route studio-artists");
    as.forEach(function (a) {
      var A = D.artists[a];
      var rs = by[a].map(function (i) { return D.studios[i]; });
      var li = el("li");
      var b = button("", "studio-stop", function () { pay.list = false; pay.i = by[a][0]; fill(box, pay); });
      b.appendChild(el("span", "studio-stop-name", A[1]));
      b.appendChild(el("span", "studio-stop-meta", [kindWord(rs[0]), years(rs[0]), A[6].length > 1 ? A[6].length + " places" : ""].filter(Boolean).join(" · ")));
      li.appendChild(b);
      list.appendChild(li);
    });
    box.appendChild(list);
  }

  /* ---- an artist's route ------------------------------------------------------ */

  // Played by the explorations (kind "studios"); where they are not here,
  // stop to stop by hand.
  function play(x) {
    if (window.Explorations && Explorations.play) {
      Explorations.play({ id: x.id, kind: "studios", title: x.title, by: "", stops: [{ k: "r", id: "o:" + x.id, from: 0 }] });
      return;
    }
    go(x.stops[0].o, x.stops[0].o[0], false);
  }

  // explorations.js: a stop, by its rows; resolves with the lines to say.
  function visit(ids) {
    return load().then(function () {
      var r = D && D.studios[ids[0]];
      if (!r) { return null; }
      go([ids[0]], ids[0], false);
      return new Promise(function (done) {
        var t0 = performance.now();
        (function tick() {
          var w = where();
          if (!w.flying && w.at === "town" && w.key === r.key && performance.now() - t0 > 600) { done(true); return; }
          if (performance.now() - t0 > 16000) { done(false); return; }
          window.setTimeout(tick, 250);
        })();
      }).then(function () {
        var A = artistOf(r);
        var lines = [A[1] + " · " + (r.pr === "town" ? (r.place || r.name) : r.name) + (years(r) ? " · " + years(r) : ""), exactly(r)];
        if (r.said && r.said[0]) { lines.push("“" + r.said[0].q.split(/(?<=\.)\s/)[0] + "”"); }
        return { lines: lines, titles: [r.name], rows: ids.map(function (i) { return D.studios[i]; }) };
      });
    });
  }

  /* ---- the studio's point, in its city: an atelier of pixel light ------------ */

  var cv = null, ctx = null, raf = 0, C = 13;
  function kick() { if (!raf) { raf = window.requestAnimationFrame(draw); } }
  function draw(now) {
    raf = 0;
    if (!cv) {
      var tiles = document.getElementById("tiles");
      cv = el("canvas", "world world-tiles studio-ring");
      cv.setAttribute("aria-hidden", "true");
      if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(cv, tiles.nextSibling); } else { document.body.appendChild(cv); }
      ctx = cv.getContext("2d");
    }
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var w = where();
    var r = current && current.box && current.box.isConnected && D ? D.studios[current.pay.i] : null;
    if (!r || w.at !== "town" || w.flying || !Land.at) { return; }
    var p = Land.at(r.ll[0], r.ll[1]);
    if (!p || p.z < 0.02) { kick(); return; }
    var gx = Math.floor(p.x / C) * C, gy = Math.floor(p.y / C) * C;
    var t = still ? 0 : Math.floor((now || 0) / (1000 / 24));
    // A square in a square, the layer's glyph, with a ragged ring of light round it
    // (only the town: a ring the size of the town for a place the record gives no closer).
    var rr = r.pr === "town" ? 3 : 1;
    ctx.fillStyle = "#9d95e6";
    for (var e = 0; e < 2; e += 1) {
      var R = rr + e;
      ctx.globalAlpha = [0.7, 0.32][e];
      for (var dx = -R; dx <= R; dx += 1) {
        for (var dy = -R; dy <= R; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) { continue; }
          if ((dx + dy + (t >> 2)) & 1) { continue; }
          ctx.fillRect(gx + dx * C + 3, gy + dy * C + 3, C - 6, C - 6);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#eadfcd";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx + 1.5, gy + 1.5, C - 3, C - 3);
    ctx.fillRect(gx + 4, gy + 4, C - 8, C - 8);
    if (!still) { kick(); }
  }
  window.setInterval(function () { if (current && current.box && current.box.isConnected) { kick(); } }, 500);

  /* ---- Find: the catalogue, and an artist's studios --------------------------- */

  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");
  var landEl = document.getElementById("land");

  function catalogueRow(A, k) {
    var b = el("button", "finder-row finder-line studio-cat");
    b.type = "button";
    b.appendChild(el("span", "studio-cat-name", A[1]));
    b.appendChild(el("span", "studio-cat-meta", [A[6].length + (A[6].length === 1 ? " place" : " places"), A[7]].filter(Boolean).join(" · ")));
    b.style.animationDelay = (still ? 0 : Math.min(k, 13) * 60) + "ms";
    b.addEventListener("click", function (event) {
      event.stopPropagation();
      var x = D.explorations[D.byEx["studios-" + A[0]]];
      if (x) { play(x); } else { go([A[6][0]], A[6][0], false); }
    });
    return b;
  }

  function offer() {
    if (!field || !found) { return; }
    var text = field.value, t = fold(text).trim();
    var onLayer = landEl && landEl.dataset.layerOn === "studios";
    // The Artists layer opens Find on the artists (lives.js); "studios" is still the catalogue.
    var all = /^(studios?|ateliers?|catalogue|the studios|artists'? studios?)$/.test(t);
    var m = t.match(/^(.+?)\s+(studios?|ateliers?)$/);
    if (!all && !m) { return; }
    load().then(function () {
      if (!D || field.value !== text) { return; }
      var old = found.querySelector(".studio-found");
      if (old) { old.remove(); }
      var who = m ? m[1] : "";
      var as = D.artists.filter(function (A) { return !who || (" " + fold(A[1])).indexOf(" " + who) >= 0; });
      if (!as.length) { return; }
      var box = el("div", "explore-found studio-found");
      var n = D.studios.length, exact = D.studios.filter(function (r) { return r.pr !== "town"; }).length;
      box.appendChild(el("p", "finder-group", who ? "Studios" : "Studios · " + D.artists.length + " artists · " + n + " places · " + exact + " placed exactly"));
      as.slice(0, who ? 8 : 400).forEach(function (A, k) { box.appendChild(catalogueRow(A, k)); });
      found.insertBefore(box, found.firstChild);
    });
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offer, 340); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (!found.querySelector(".studio-found")) { offer(); } }).observe(found, { childList: true });
  }

  if (window.requestIdleCallback) { window.requestIdleCallback(function () { if (landEl && landEl.dataset.layerOn === "studios") { load(); } }, { timeout: 4000 }); }

  window.Studios = {
    load: load,
    data: function () { return D; },
    open: open,
    openMark: openMark,
    column: column,
    visit: visit,
    play: function (id) { return load().then(function () { var x = D && D.explorations[D.byEx[id]]; if (x) { play(x); } }); },
    exploration: function (id) { return D ? D.explorations[D.byEx[id]] || null : null; },
    // A studio's column open: its artist (sites.js draws that artist's Painted here sites in the city).
    showing: function () {
      var r = current && current.box && current.box.isConnected && D ? D.studios[current.pay.i] : null;
      return r ? { i: current.pay.i, artist: artistOf(r)[1] } : null;
    },
    _state: function () {
      var b = current && current.box && current.box.isConnected ? current.box.innerText.slice(0, 600) : "";
      return { loaded: !!D, artists: D ? D.artists.length : 0, studios: D ? D.studios.length : 0, column: b };
    }
  };
})();

/* Filmed bits, drawn again as characters of the site (characters/bits.json; the drawing,
   scripts/characters/royal_nothin.py).

   The artist, 14 Oct 2026, sending Ed Bassmaster's short "Royal Nothin" (youtube.com/shorts/nDsF0a6rVmo):
   "Recreate a gif like animation of this YouTube short. Create Ed Bassmaster's character and have it link
   to his YouTube". In it a man in a loud knitted jumper and white shades stands stiff beside a trooper of
   the King's Life Guard at Horse Guards, Whitehall — doing, as the trooper does, nothing — while the horse
   turns its head about; then he walks off. The site draws it again as a ten-second pixel loop (its own
   drawing: the bit's costume on a face of a few cells, no likeness; the straw is London's DIRT).

   It stands where it was filmed. On the globe's Characters layer, the figure at Horse Guards (land.js,
   found(); figureDot → Bits.mark). In London's skyline, while the city shows its Characters, the trooper on
   his horse and the figure beside him, in step with the loop (skyline.js → Bits.drawPair). Find finds it by
   the bit's title, its maker or "YouTube". Pressed: its card — the loop large (a press on it, or its button,
   pauses it: WCAG 2.2.2; under reduced motion it starts paused), what it is, the short and the channel on
   YouTube (the site's ways off it, each said so, in a new tab: WCAG 2.4.4, 3.2.5), and its three ways on
   (KINDS.md, "bit"): ◎ where it was filmed, ■ the works painted near it, ◆ the museums near it.

   window.Bits: load, list, byKey, open, close, showing, mark, drawPair. */
(function () {
  "use strict";

  var data = null, ask = null, failedAt = 0, byKey = {}, loops = {};
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function load() {
    if (data) { return Promise.resolve(data); }
    // After a failed read, none again for half a minute (bitsHere asks every frame).
    if (!ask && failedAt && Date.now() - failedAt < 30000) { return Promise.resolve({ bits: [] }); }
    if (!ask) {
      ask = fetch("characters/bits.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        data = d && d.bits ? d : { bits: [] };
        data.bits.forEach(function (b) { byKey[b.key] = b; });
        return data;
      }).catch(function () { ask = null; failedAt = Date.now(); return { bits: [] }; });
    }
    return ask;
  }
  function image(src) {
    return new Promise(function (ok, no) {
      var i = new Image();
      i.decoding = "async";
      i.onload = function () { ok(i); };
      i.onerror = function () { no(new Error(src)); };
      i.src = src;
    });
  }
  // The loop's meta (characters/bits/<key>.json), its frames (the PNG beside it) and its small sprites.
  function loopOf(b) {
    if (!loops[b.key]) {
      var json = "characters/" + b.loop, dir = json.replace(/[^/]+$/, "");
      loops[b.key] = fetch(json).then(function (r) { if (!r.ok) { throw new Error(json); } return r.json(); }).then(function (m) {
        return { meta: m, json: json, dir: dir, sheet: null, small: null };
      });
      loops[b.key].catch(function () { delete loops[b.key]; });
    }
    return loops[b.key];
  }
  function sheetOf(b) {
    return loopOf(b).then(function (L) {
      if (!L.sheetAsk) {
        L.sheetAsk = image(L.json.replace(/\.json$/, ".png")).then(function (i) { L.sheet = i; return L; }, function (e) { L.sheetAsk = null; throw e; });
      }
      return L.sheetAsk;
    });
  }
  function smallOf(b) {
    return loopOf(b).then(function (L) {
      if (!L.smallAsk) {
        L.smallAsk = image(L.dir + L.meta.small.file).then(function (i) { L.small = i; return L; }, function (e) { L.smallAsk = null; throw e; });
      }
      return L.smallAsk;
    });
  }

  /* ---- small: the globe's mark, and the pair on London's skyline ------------------------------------ */
  // The figure standing, one CSS pixel a cell, trimmed to what it draws: the Characters layer's dot.
  function mark(key) {
    return load().then(function () {
      var b = byKey[key];
      if (!b) { return null; }
      return smallOf(b).then(function (L) {
        var r = L.meta.small.sprites["figure-stand"];
        var src = document.createElement("canvas");
        src.width = r[2]; src.height = r[3];
        var sg = src.getContext("2d");
        sg.drawImage(L.small, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
        var px = sg.getImageData(0, 0, r[2], r[3]).data, x0 = r[2], x1 = -1, y0 = r[3], y1 = -1;
        for (var y = 0; y < r[3]; y += 1) {
          for (var x = 0; x < r[2]; x += 1) {
            if (px[(y * r[2] + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
          }
        }
        if (x1 < x0) { return null; }
        var cv = document.createElement("canvas");
        cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
        cv.getContext("2d").drawImage(src, x0, y0, cv.width, cv.height, 0, 0, cv.width, cv.height);
        return cv;
      });
    }).catch(function () { return null; });
  }
  // Where the loop stands at a time, for the pair in the city: the horse's head, what the figure does.
  function beatAt(sec) {
    var t = ((sec % 10) + 10) % 10;
    var head = t < 2.4 ? "low" : t < 4.8 ? "up" : t < 7.4 ? "toward" : "low";
    if (t < 7.4) { return { head: head, fig: t >= 2.2 && t < 3.9 ? "look" : "stand", walk: 0, fade: 1 }; }
    var u = (t - 7.4) / 2.6;
    return { head: head, fig: "walk" + (Math.floor((t - 7.4) / 0.75 * 4) % 4), walk: u, fade: u > 0.8 ? Math.max(0, Math.round((1 - (u - 0.8) / 0.2) * 4) / 4) : 1 };
  }
  /* The trooper on his horse at (x, y) — the point, his horse's hooves on it — and the figure beside him on
     the left, nearer; pu is the CSS pixels a cell (whole device pixels, as the philosophers are drawn). The
     figure walks off toward you in the loop's last seconds and is back at its start. Returns what it covers. */
  var pending = {};
  function drawPair(g, key, x, y, now, pu, opts) {
    var b = byKey[key];
    if (!b) {
      if (!pending[key]) { pending[key] = load().then(function () { if (!byKey[key]) { window.setTimeout(function () { delete pending[key]; }, 30000); } }); }
      return null;
    }
    var L = loops[b.key] && loops[b.key].done;
    if (!L) {
      // Asked once at a time; a failed read is asked again half a minute on.
      if (!pending["s" + key]) {
        pending["s" + key] = smallOf(b).then(function (l) { loops[b.key].done = l; }).catch(function () {
          window.setTimeout(function () { delete pending["s" + key]; }, 30000);
        });
      }
      return null;
    }
    var held = still || (opts && opts.still) || !!(window.Land && Land.still && Land.still());
    var S = L.meta.small, sp = S.sprites, beat = held ? { head: "low", fig: "stand", walk: 0, fade: 1 } : beatAt(now / 1000);
    var gr = sp["guard-" + beat.head], fr = sp["figure-" + beat.fig];
    var gx = Math.round(x - S.foot.guard[0] * pu), gy = Math.round(y - S.foot.guard[1] * pu);
    var was = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(L.small, gr[0], gr[1], gr[2], gr[3], gx, gy, Math.round(gr[2] * pu), Math.round(gr[3] * pu));
    var fx = x - 15 * pu + beat.walk * 8 * pu, fy = y + 5 * pu + beat.walk * 14 * pu;
    var fxx = Math.round(fx - S.foot.figure[0] * pu), fyy = Math.round(fy - S.foot.figure[1] * pu);
    var a = g.globalAlpha;
    g.globalAlpha = a * beat.fade;
    if (beat.fade > 0) { g.drawImage(L.small, fr[0], fr[1], fr[2], fr[3], fxx, fyy, Math.round(fr[2] * pu), Math.round(fr[3] * pu)); }
    g.globalAlpha = a;
    g.imageSmoothingEnabled = was;
    var x0 = Math.min(gx, Math.round(x - S.foot.figure[0] * pu - 15 * pu)), x1 = gx + Math.round(gr[2] * pu);
    return { x0: x0, y0: gy, x1: x1, y1: Math.round(y + 6 * pu) };
  }

  /* ---- the card ---------------------------------------------------------------------------------- */
  var card = null, cardKey = null, opener = null;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text) { e.textContent = text; } return e; }
  function close(keepFocus) {
    if (!card) { return; }
    window.cancelAnimationFrame(card.raf || 0);
    card.remove();
    card = null;
    cardKey = null;
    if (keepFocus !== true && opener && opener.isConnected && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (e) {} }
    if (keepFocus !== true) { opener = null; }
  }
  function dateSaid(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) { return iso || ""; }
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return +m[3] + " " + months[+m[2] - 1] + " " + m[1];
  }
  function far(mt) { return mt >= 1000 ? (mt / 1000).toFixed(1) + " km" : Math.round(mt / 10) * 10 + " m"; }
  function townName(key, fallback) {
    var t = window.Land && Land.townName ? Land.townName(key) : null;
    return t || fallback;
  }
  function open(key) {
    return load().then(function () {
      var b = byKey[key];
      if (!b) { return; }
      // A card opened over its own keeps the first one's way back.
      var was = document.activeElement, again = card && card.contains(was);
      close(again);
      if (!again) { opener = was; }
      cardKey = key;
      card = el("section", "bit-card");
      var mine = card;
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", b.title + ", after " + b.who + "'s short");
      ["pointerdown", "wheel", "touchstart"].forEach(function (t) {
        card.addEventListener(t, function (event) { event.stopPropagation(); }, { passive: true });
      });
      var x = el("button", "bit-close", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Close");
      x.addEventListener("click", function () { close(); });
      card.appendChild(x);

      // The loop, large, at whole device pixels a cell.
      var stage = el("div", "bit-stage");
      var cv = document.createElement("canvas");
      cv.className = "bit-loop";
      cv.setAttribute("role", "img");
      cv.setAttribute("aria-label", "A ten-second pixel loop after " + b.who + "'s short: " + b.said);
      stage.appendChild(cv);
      var play = el("button", "bit-play");
      play.type = "button";
      stage.appendChild(play);
      card.appendChild(stage);

      var words = el("div", "bit-words");
      words.appendChild(el("h2", "bit-title", b.title));
      words.appendChild(el("p", "bit-by", b.who + " · " + dateSaid(b.date)));
      words.appendChild(el("p", "bit-place", "Filmed at " + b.place));
      words.appendChild(el("p", "bit-said", b.said));
      var out = el("div", "bit-out");
      [[b.video, "▶ " + b.title + " on YouTube", b.title + " on YouTube: " + b.who + "'s short, opens in a new tab"],
       [b.channel, b.who + "'s channel", b.who + "'s channel: opens YouTube in a new tab"]].forEach(function (l) {
        var a = el("a", "bit-link");
        a.href = l[0];
        a.target = "_blank";
        a.rel = "noopener";
        a.setAttribute("aria-label", l[2]);
        a.appendChild(el("span", "", l[1]));
        a.appendChild(el("span", "bit-arrow", " ↗"));
        out.appendChild(a);
      });
      words.appendChild(out);

      // The three ways on (KINDS.md, "bit"): where it was filmed, the works painted near it, the museums near it.
      var three = el("div", "bit-three");
      three.setAttribute("role", "group");
      three.setAttribute("aria-label", "From " + b.title);
      var panel = el("div", "bit-list");
      panel.hidden = true;
      var here = window.Land && Land.where ? Land.where() : {};
      var onIt = here && here.at === "town" && here.key === b.town && Land.layer && Land.layer() === "characters";
      if (b.town && window.Land && Land.town && !onIt) {
        var go = el("button", "bit-go", "◎ " + townName(b.town, "London") + " ›");
        go.type = "button";
        go.setAttribute("aria-label", "Into " + townName(b.town, "London") + ", where it was filmed: it stands at Horse Guards while the city shows its Characters");
        go.addEventListener("click", function () {
          close();
          if (Land.chooseLayer) { Land.chooseLayer("characters"); }
          Land.town(b.town);
        });
        three.appendChild(go);
      }
      if ((b.painted || []).length) {
        three.appendChild(tab("■ Painted near it · " + b.painted.length, function () {
          return b.painted.map(function (r) {
            return row(r[2], [r[3], r[4] || ""].filter(Boolean).join(", ") + " · " + far(r[0]), function () {
              close();
              if (window.Sites && Sites.open) { Sites.open(r[1]); }
            });
          });
        }));
      }
      if ((b.museums || []).length) {
        three.appendChild(tab("◆ Museums near it · " + b.museums.length, function () {
          return b.museums.map(function (r) {
            return row(r[2], far(r[0]), function () { close(); if (window.Land && Land.museum) { Land.museum(r[1]); } });
          });
        }));
      }
      function tab(label, rows) {
        var t = el("button", "bit-tab", label);
        t.type = "button";
        t.setAttribute("aria-expanded", "false");
        t.addEventListener("click", function () {
          var was = t.getAttribute("aria-expanded") === "true";
          Array.prototype.forEach.call(three.querySelectorAll(".bit-tab"), function (o) { o.setAttribute("aria-expanded", "false"); });
          panel.textContent = "";
          panel.hidden = was;
          if (was) { return; }
          t.setAttribute("aria-expanded", "true");
          rows().forEach(function (e) { panel.appendChild(e); });
        });
        return t;
      }
      function row(name, sub, go) {
        var r = el("button", "bit-row");
        r.type = "button";
        r.appendChild(el("span", "bit-row-name", name));
        r.appendChild(el("span", "bit-row-sub", sub));
        r.addEventListener("click", go);
        return r;
      }
      words.appendChild(three);
      words.appendChild(panel);
      words.appendChild(el("p", "bit-source", "Drawn again by the site in its pixel art from the short's own stills (no frame of it is used, and no likeness is drawn); the straw is London's DIRT. The short and the channel are YouTube's."));
      card.appendChild(words);
      document.body.appendChild(card);
      try { x.focus({ preventScroll: true }); } catch (e) {}

      // Play it: twelve frames a second, from the PNG of its frames; a press on it or its button pauses.
      var held = still || !!(window.Land && Land.still && Land.still());
      var playing = !held, frame = 0, last = 0;
      function sayPlay() {
        play.textContent = playing ? "❚❚" : "▶";
        play.setAttribute("aria-label", playing ? "Pause the loop" : "Play the loop");
        stage.dataset.playing = playing ? "true" : "false";
      }
      function toggle() { playing = !playing; sayPlay(); }
      sayPlay();
      play.addEventListener("click", function (event) { event.stopPropagation(); toggle(); });
      cv.addEventListener("click", toggle);
      sheetOf(b).then(function (L) {
        if (card !== mine) { return; }
        var m = L.meta, dpr = Math.min(3, window.devicePixelRatio || 1);
        var phone = window.innerWidth <= 720;
        var want = phone ? Math.min(320, window.innerHeight * 0.4) : Math.min(420, window.innerHeight * 0.6);
        var s = Math.max(1, Math.round(want * dpr / m.h));
        cv.width = m.w * s; cv.height = m.h * s;
        cv.style.width = (m.w * s / dpr) + "px";
        cv.style.height = (m.h * s / dpr) + "px";
        var g = cv.getContext("2d");
        g.imageSmoothingEnabled = false;
        function paint() {
          var c = frame % m.cols, r = Math.floor(frame / m.cols);
          g.drawImage(L.sheet, c * m.w, r * m.h, m.w, m.h, 0, 0, cv.width, cv.height);
        }
        paint();
        function tick(ts) {
          if (card !== mine) { return; }
          mine.raf = window.requestAnimationFrame(tick);
          if (!playing) { return; }
          if (ts - last < 1000 / m.fps - 4) { return; }
          last = ts;
          frame = (frame + 1) % m.frames;
          paint();
        }
        mine.raf = window.requestAnimationFrame(tick);
        mine.dataset.loaded = "true";
      }).catch(function () { stage.dataset.failed = "true"; });
    });
  }

  /* ---- Find: by the bit's title, its maker, "YouTube" ---------------------------------------------- */
  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");
  function fold(t) { return " " + String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " "; }
  function offer() {
    if (!field || !found) { return; }
    var text = field.value, t = fold(text);
    if (t.trim().length < 3) { return; }
    load().then(function () {
      if (field.value !== text) { return; }
      var old = found.querySelector(".bit-found");
      if (old) { old.remove(); }
      var toks = t.split(" ").filter(Boolean);
      var rows = data.bits.filter(function (b) {
        var hay = fold([b.title, b.who, b.handle, b.place, "youtube short shorts bit"].join(" "));
        return toks.every(function (k) { return hay.indexOf(" " + k) >= 0; });
      });
      if (!rows.length) { return; }
      var box = el("div", "explore-found bit-found");
      box.appendChild(el("p", "finder-group", "Characters"));
      rows.forEach(function (b) {
        var r = el("button", "finder-row finder-line studio-cat");
        r.type = "button";
        r.appendChild(el("span", "studio-cat-name", b.title));
        r.appendChild(el("span", "studio-cat-meta", b.who + "'s short · " + b.place.split(",")[0] + ", " + townName(b.town, "London")));
        r.addEventListener("click", function (event) {
          event.stopPropagation();
          // On the world: its Characters, turned to where it was filmed; then its card.
          if (window.Land && Land.where && Land.where().at === "world") {
            if (Land.chooseLayer) { Land.chooseLayer("characters"); }
            if (Land.globeAt) { Land.globeAt(b.point[0], b.point[1]); }
          }
          open(b.key);
        });
        box.appendChild(r);
      });
      found.appendChild(box);
    }).catch(function () {});
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offer, 380); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && field.value && !found.querySelector(".bit-found")) { offer(); } })
      .observe(found, { childList: true });
  }
  // On the window and in the capture phase, registered before land.js and guide.js: the card is on top, so
  // Escape closes it before the guide, the lens or the parts behind it.
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && card) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }, true);

  window.Bits = {
    load: load,
    list: function () { return data ? data.bits : []; },
    byKey: function (k) { return byKey[k] || null; },
    open: open,
    close: close,
    showing: function () { return cardKey; },
    mark: mark,
    drawPair: drawPair,
    beatAt: beatAt
  };
})();

/* The city in time — the column under a city's globe and dial, read along the dial.

   The artist, 8 Oct 2026, of a city's column on his phone (the categories' "◎ PLACES" over
   "Houston", then museums, galleries, fairs, sale rooms, near here, walking here): "I still feel
   like the bottom half of this layout below the globe and the dial needs a lot of work. There's too
   much information and it is not clear as something that I want to follow along to."

   So a city's column is no longer its directory but its story, in the order it happened: when
   works came here (the city's places file: who showed, held, sold or made them, in which year),
   who was born here and who lived or worked here (lives.json's birthplaces, cityartists.json's
   periods), which movements gathered here (movements.json), and now (the city guide). One moment a
   line, each with its works as small squares; the moment of the dial's year is lit, the later ones
   wait a step quieter. The dial plays the city the first time (land.js autoTown) and the column
   follows it; scrolling the column turns the dial; pressing a moment turns the dial to it and lights
   its place. Nothing is said that the data does not hold: every sentence is a frame round a record.
   The directory (museums, galleries, fairs and sale rooms) is a press away, under the story, and in
   the three tabs over it.

   land.js calls Chronicle.build(spec) once the city's file is read, Chronicle.year(y, follow) when the
   dial's year changes, and Chronicle.clear() when the city is left. */
(function () {
  "use strict";

  var cache = {};
  function get(path) {
    if (!cache[path]) {
      cache[path] = fetch(path).then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { delete cache[path]; return null; });
    }
    return cache[path];
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // "Willem de Kooning" → "de Kooning"; a name in its own script as well keeps the whole of its Latin part.
  var PARTICLE = /^(de|van|von|da|di|del|della|der|den|le|la|du|des|ter|ten)$/i;
  function surname(name) {
    var latin = String(name || "").replace(/\s*\(.*?\)\s*/g, " ").replace(/[^\u0000-ɏ\s'’.-]+/g, "").trim();
    var epithet = latin.match(/^(.*\S)\s+(the (?:Younger|Elder))$/i);       // Holbein the Younger
    if (epithet) { return surname(epithet[1]) + " " + epithet[2]; }
    var w = latin.split(/\s+/).filter(Boolean);
    if (!w.length) { return String(name || "").trim(); }
    if (w.length <= 2 && /[^\u0000-ɏ]/.test(name)) { return latin; }
    var k = w.length - 1;
    while (k > 0 && PARTICLE.test(w[k - 1])) { k -= 1; }
    return w.slice(k).join(" ");
  }
  function possessive(name) { return surname(name) + "’s"; }
  // A name as the page says it: without the dates some records carry in it ("Ed Clark (1926-2019)").
  function plain(name) { return String(name || "").replace(/\s*\((?:b\.\s*)?\d{4}[^)]*\)\s*/g, " ").trim(); }
  // A title as the record gives it, cut at a word near 64 characters where a listing ran it on.
  function titled(t) {
    t = String(t || "Untitled").trim();
    if (t.length <= 72) { return t; }
    var cut = t.slice(0, 64).replace(/\s+\S*$/, "");
    return cut.replace(/[\s,;:(–-]+$/, "") + "…";
  }
  // "1898–1900", "1963–65": the end year short only within its century.
  function span(a, b) {
    if (!(b > a)) { return String(a); }
    return a + "–" + (Math.floor(a / 100) === Math.floor(b / 100) ? String(b).slice(-2) : String(b));
  }
  function names(list) {
    if (list.length <= 1) { return list.join(""); }
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }
  function count(n, one, many) { return (n === 1 ? "one " + one : n.toLocaleString("en") + " " + many); }

  // What happened, in the place's own words: the most telling of a work's events here.
  var VERB = [["made", null], ["sold", "sells"], ["exhibited", "shows"], ["held", "holds"], ["owned", "owns"],
              ["offered", "offers"], ["listed", "lists"], ["written", "writes on"], ["other", "has"]];
  function verbOf(kinds) {
    for (var k = 0; k < VERB.length; k += 1) { if ((kinds || []).indexOf(VERB[k][0]) >= 0) { return VERB[k]; } }
    return ["other", "has"];
  }

  var S = null;   // { key, root, list, moments: [{y, y1, node, light}], lit, scrolledAt, touched }

  /* ---- the moments -------------------------------------------------------- */

  function workMoments(spec, towns) {
    var pf = spec.pf, out = [];
    var groups = {};
    pf.works.forEach(function (r) {
      var y = r[6];
      if (!y) { return; }
      (groups[y] = groups[y] || []).push(r);
    });
    var years = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    // A city of many years is told by its decades, so the story stays a page or two long.
    var byDecade = years.length > 12;
    var parts = {};
    years.forEach(function (y) {
      var k = byDecade ? Math.floor(y / 10) * 10 : y;
      parts[k] = (parts[k] || []).concat(groups[y]);
    });
    Object.keys(parts).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var rows = [], seen = {};
      parts[k].forEach(function (r) { if (!seen[r[0]]) { seen[r[0]] = true; rows.push(r); } });
      var y0 = Infinity, y1 = -Infinity;
      parts[k].forEach(function (r) { y0 = Math.min(y0, r[6]); y1 = Math.max(y1, r[6]); });
      // The venue most of them came to, and what it did.
      var at = {};
      rows.forEach(function (r) { at[r[5]] = (at[r[5]] || 0) + 1; });
      // A named venue before the works whose venue is not recorded.
      var top = Object.keys(at).map(Number).sort(function (a, b) {
        return (pf.venues[b] && pf.venues[b][0] ? 1 : 0) - (pf.venues[a] && pf.venues[a][0] ? 1 : 0) || at[b] - at[a] || a - b;
      })[0];
      var v = pf.venues[top] || ["", "", 0, 0];
      var mine = rows.filter(function (r) { return r[5] === top; });
      var verb = verbOf(mine[0] && mine[0][8]);
      var lead = mine.filter(function (r) { return r[3]; })[0] || mine[0];
      var title = { i: titled(lead && lead[1]) };
      var say;
      if (rows.length === 1) {
        if (verb[0] === "made") { say = [surname(lead[2]) + " makes ", title, " here."]; }
        else if (!v[0]) { say = [possessive(lead[2]) + " ", title, verb[0] === "owned" ? " comes here, to a collection." : " comes here."]; }
        else { say = [v[0] + " " + verb[1] + " " + possessive(lead[2]) + " ", title, "."]; }
      } else if (mine.length === rows.length && v[0]) {
        say = [v[0] + " " + verb[1] + " " + count(rows.length, "work", "works") + ", " + possessive(lead[2]) + " ", title, " among them."];
      } else if (v[0]) {
        say = mine.length === 1
          ? [count(rows.length, "work comes", "works come") + " here; " + v[0] + " " + verb[1] + " " + possessive(lead[2]) + " ", title, "."]
          : [count(rows.length, "work comes", "works come") + " here; " + v[0] + " " + verb[1] + " " + mine.length + "."];
      } else {
        say = [count(rows.length, "work comes", "works come") + " here."];
      }
      // A decade stands at its first year, so it reads (and the dial lights it) before what happened in it.
      var m = { y: byDecade ? k : y0, y1: byDecade ? k + 9 : y1, label: byDecade ? k + "s" : String(y0), kind: "work", say: say,
                works: rows.slice(0, 4), n: rows.length, weight: 1 + Math.log(1 + rows.length),
                light: v[1] ? { museum: v[1] } : { venue: top } };
      // One work: where it came from and where it went on to, each a city to follow it to.
      if (rows.length === 1) {
        var from = towns[rows[0][9]], next = towns[rows[0][10]];
        if (from || next) { m.way = { from: from ? [rows[0][9], from] : null, next: next ? [rows[0][10], next] : null }; }
      }
      out.push(m);
    });
    // Too many still: the busiest, with the first and the last.
    if (out.length > 14) {
      var keep = out.slice(1, -1).sort(function (a, b) { return b.n - a.n || a.y - b.y; }).slice(0, 12);
      out = [out[0]].concat(keep, [out[out.length - 1]]).sort(function (a, b) { return a.y - b.y; });
    }
    return out;
  }

  function bornMoments(spec, lives) {
    if (!lives || !lives.marks) { return []; }
    var ids = [];
    lives.marks.forEach(function (mk) {
      var near = Math.abs(mk[0] - spec.lat) < 0.12 && Math.abs(mk[1] - spec.lon) < 0.18;
      if (near && (mk[7] === spec.name || Math.abs(mk[0] - spec.lat) + Math.abs(mk[1] - spec.lon) < 0.06)) {
        ids = ids.concat(mk[4] || []);
      }
    });
    var rows = ids.map(function (i) { return lives.lives[i]; }).filter(function (r) { return r && r[2]; });
    rows.sort(function (a, b) { return (b[5] || 0) - (a[5] || 0) || a[2] - b[2]; });
    return rows.slice(0, 3).map(function (r) {
      // A birthplace in or near the city is said by its own name (Brooklyn, Argenteuil: the Artists layer
  // gathers them under the city).
      var where = String(r[10] || "").replace(/\.$/, "");
      var at = where && where !== spec.name ? " is born in " + where + "." : " is born here.";
      return { y: r[2], label: String(r[2]), kind: "born", say: [{ who: plain(r[1]), life: r[0], year: r[2] }, at],
               weight: 4, life: r[0] };
    });
  }

  var HOW = { life: "lives here", lived: "lives here", studio: "works here", school: "studies here", work: "works here" };
  function periodMoments(spec, walkers, born) {
    var rows = (walkers && walkers.towns && walkers.towns[spec.key]) || [];
    var have = {};
    born.forEach(function (m) { have[m.life] = true; });
    var out = [];
    rows.slice().sort(function (a, b) { return (b[4] || 0) - (a[4] || 0); }).forEach(function (r) {
      if (out.length >= 3) { return; }
      var p = (r[5] || []).filter(function (s) { return s[2] !== "born"; })[0];
      if (!p || have[r[0]]) { return; }
      have[r[0]] = true;
      out.push({ y: p[0], y1: p[1], label: span(p[0], p[1]), kind: "came",
                 say: [{ who: plain(r[1]), life: r[0], year: p[0] }, " " + (HOW[p[2]] || "is here") + "."], weight: 3, life: r[0] });
    });
    return out;
  }

  function movementMoments(spec, mv) {
    if (!mv || !mv.cities || !mv.movements) { return []; }
    return (mv.cities[spec.key] || []).map(function (i) { return mv.movements[i]; }).filter(Boolean).slice(0, 4).map(function (m) {
      var who = String(m.who || "").replace(/\s*…$/, "");
      return { y: m.y0, y1: m.y1, label: span(m.y0, m.y1), kind: "movement",
               say: [who ? who + (/…/.test(m.who) ? " and others" : "") + " are here together: " : "A movement: ",
                     { mv: m.id, title: m.title }, "."], weight: 5 };
    });
  }

  /* ---- the column -------------------------------------------------------- */

  function sayInto(p, parts, spec) {
    parts.forEach(function (x) {
      if (!x) { return; }
      if (typeof x === "string") { p.appendChild(document.createTextNode(x)); return; }
      if (x.i) { p.appendChild(el("i", "", x.i)); return; }
      if (x.who) {
        var b = el("button", "chron-door", x.who);
        b.type = "button";
        b.setAttribute("aria-label", x.who + " — their life" + (x.year ? ", at " + x.year : ""));
        b.addEventListener("click", function (event) {
          event.stopPropagation();
          if (window.Lives && Lives.open) { Lives.open(x.life, { year: x.year }); }
        });
        p.appendChild(b);
        return;
      }
      if (x.mv) {
        var mb = el("button", "chron-door", x.title);
        mb.type = "button";
        mb.setAttribute("aria-label", x.title + " — the movement");
        mb.addEventListener("click", function (event) {
          event.stopPropagation();
          if (window.Movements && Movements.open) { Movements.open(x.mv); }
        });
        p.appendChild(mb);
      }
    });
  }

  function thumbs(m, spec) {
    var box = el("div", "chron-works");
    m.works.forEach(function (r) {
      var b = el("button", "chron-work");
      b.type = "button";
      b.dataset.work = r[0];
      b.style.background = r[4] || "#3a302a";
      b.setAttribute("aria-label", (r[1] || "Untitled") + ", " + r[2] + " — where it has been");
      if (r[3]) {
        var img = el("img");
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = spec.cdn + r[3] + "/square.jpg";
        img.addEventListener("error", function () { img.remove(); });
        b.appendChild(img);
      }
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        if (window.Land && Land.work) { Land.work(r[0], spec.key); }
      });
      box.appendChild(b);
    });
    if (m.n > m.works.length) { box.appendChild(el("span", "chron-more", "+" + (m.n - m.works.length))); }
    return box;
  }

  function wayLine(m) {
    var p = el("p", "chron-way");
    [["from", m.way.from], ["on to", m.way.next]].forEach(function (w, i) {
      if (!w[1]) { return; }
      if (p.childNodes.length) { p.appendChild(document.createTextNode(" · ")); }
      p.appendChild(document.createTextNode(w[0] + " "));
      var b = el("button", "chron-door chron-town", w[1][1]);
      b.type = "button";
      b.setAttribute("aria-label", w[1][1] + " — follow it there");
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        if (window.Land && Land.town) { Land.town(w[1][0]); }
      });
      p.appendChild(b);
    });
    return p;
  }

  function build(spec) {
    clear();
    var root = el("section", "chron");
    root.setAttribute("aria-label", spec.name + " in time");
    var list = el("ol", "chron-list");
    root.appendChild(list);
    S = { key: spec.key, root: root, list: list, moments: [], lit: -1, scrolledAt: 0, touched: 0, spec: spec };
    var mine = S;
    Promise.all([get("cities.json"), get("lives.json"), get("cityartists.json"), get("movements.json"), get("guides.json")])
      .then(function (d) {
        if (S !== mine) { return; }
        var towns = {};
        ((d[0] && d[0].towns) || []).forEach(function (t) { towns[t[0]] = t[1]; });
        var born = bornMoments(spec, d[1]);
        var all = workMoments(spec, towns).concat(born, periodMoments(spec, d[2], born), movementMoments(spec, d[3]));
        all.sort(function (a, b) { return a.y - b.y || b.weight - a.weight; });
        var g = d[4] && d[4].cities && d[4].cities[spec.key];
        if (g && g[2]) {
          root.dataset.now = "true";
          all.push({ y: new Date().getFullYear(), label: "Now", kind: "now", weight: 2, guide: true,
                     say: [count(g[2], "show is", "shows are") + " on" + (g[3] ? ", " + g[3] + " soon" : "") + "."] });
        }
        all.forEach(function (m, i) { list.appendChild(moment(m, i)); });
        S.moments = all;
        // The story can begin before the city's venues do (a life, a birth): the dial reaches back to it.
        var first = all.reduce(function (lo, m) { return m.kind === "now" ? lo : Math.min(lo, m.y); }, Infinity);
        if (first < Infinity && spec.span) { spec.span(first); }
        watch();
        if (S.wantYear) { year(S.wantYear, false); }
      });
    return root;
  }

  function moment(m, i) {
    var li = el("li", "chron-m");
    li.dataset.kind = m.kind;
    li.dataset.i = i;
    var when = el("button", "chron-when", m.label);
    when.type = "button";
    when.setAttribute("aria-label", m.kind === "now" ? "Now — turn the dial to the present" : "Turn the dial to " + m.label);
    li.appendChild(when);
    var body = el("div", "chron-body");
    var p = el("p", "chron-say");
    sayInto(p, m.say, S.spec);
    body.appendChild(p);
    if (m.works && m.works.length) { body.appendChild(thumbs(m, S.spec)); }
    if (m.way) { body.appendChild(wayLine(m)); }
    if (m.guide) {
      var gb = el("button", "chron-door chron-guide", "The guide ›");
      gb.type = "button";
      gb.addEventListener("click", function (event) {
        event.stopPropagation();
        if (window.Guide && Guide.open) { Guide.open(S && S.key); }
      });
      body.appendChild(gb);
    }
    li.appendChild(body);
    m.node = li;
    // A press on the moment (not on one of its doors) turns the dial to it and lights its place.
    function go() {
      if (S && S.spec.dial) { S.spec.dial(m.kind === "now" ? new Date().getFullYear() : m.y); }
      if (m.light && S && S.spec.light) {
        var l = m.light;
        S.spec.light(l, true);
        window.setTimeout(function () { if (S && S.spec.light) { S.spec.light(l, false); } }, 2400);
      }
    }
    when.addEventListener("click", function (event) { event.stopPropagation(); go(); });
    li.addEventListener("click", go);
    li.addEventListener("pointerenter", function () { if (m.light && S && S.spec.light) { S.spec.light(m.light, true); } });
    li.addEventListener("pointerleave", function () { if (m.light && S && S.spec.light) { S.spec.light(m.light, false); } });
    return li;
  }

  /* ---- reading along the dial -------------------------------------------- */

  // The column scrolled by a hand: the moment that comes to the top turns the dial.
  function watch() {
    var col = S.root.closest(".art-col") || S.root.parentNode;
    if (!col || col._chronWatch) { return; }
    col._chronWatch = true;
    ["touchstart", "wheel", "pointerdown"].forEach(function (t) {
      col.addEventListener(t, function () { if (S) { S.touched = performance.now(); } }, { passive: true });
    });
    col.addEventListener("scroll", function () {
      if (!S || !S.root.isConnected || !S.moments.length || performance.now() - S.touched > 1500) { return; }
      S.scrolledAt = performance.now();
      var top = col.getBoundingClientRect().top + Math.min(160, col.clientHeight * 0.3);
      var best = -1;
      S.moments.forEach(function (m, i) {
        if (m.node && m.node.getBoundingClientRect().top <= top) { best = i; }
      });
      if (best >= 0 && best !== S.lit && S.spec.dial) {
        var m = S.moments[best];
        S.spec.dial(m.kind === "now" ? new Date().getFullYear() : m.y);
      }
    }, { passive: true });
  }

  // The dial's year: its moment lit, the later ones a step quieter; following the dial, kept in view.
  function year(y, follow) {
    if (!S || !S.root.isConnected && S.moments.length) { return; }
    if (!S.moments.length) { S.wantYear = y; return; }
    var k = -1;
    S.moments.forEach(function (m, i) { if (m.y <= y) { k = i; } });
    S.moments.forEach(function (m, i) {
      if (!m.node) { return; }
      if (i === k) { m.node.dataset.now = "true"; } else { delete m.node.dataset.now; }
      if (m.y > y) { m.node.dataset.later = "true"; } else { delete m.node.dataset.later; }
    });
    var was = S.lit;
    S.lit = k;
    if (!follow || k < 0 || k === was || performance.now() - S.scrolledAt < 1500 || performance.now() - S.touched < 1500) { return; }
    var node = S.moments[k].node, col = S.root.closest(".art-col");
    if (!node || !col) { return; }
    var cr = col.getBoundingClientRect(), nr = node.getBoundingClientRect();
    if (nr.top < cr.top + 8 || nr.bottom > cr.bottom - 8) {
      col.scrollTo({ top: col.scrollTop + nr.top - cr.top - Math.min(48, col.clientHeight * 0.12), behavior: still ? "auto" : "smooth" });
    }
  }

  function clear() {
    if (S && S.root && S.root.parentNode) { S.root.parentNode.removeChild(S.root); }
    S = null;
  }

  window.Chronicle = {
    build: build,
    year: year,
    clear: clear,
    state: function () {
      return S && S.root.isConnected ? { key: S.key, moments: S.moments.map(function (m) { return { y: m.y, label: m.label, kind: m.kind, text: m.node ? m.node.querySelector(".chron-say").textContent : "" }; }), lit: S.lit } : null;
    }
  };
})();

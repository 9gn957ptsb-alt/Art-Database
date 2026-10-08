/* The wall label — what a museum hangs beside a work, beside every
   picture of one on the page.

   The artist, 7 Oct 2026, with a phone screenshot of Cézanne's *The Bend in
   the Road* (its title, artist, date, medium and size only far below, in the
   column): "Where the artwork is located along with its basic information
   provided by artsy should always be adjacent to the thumbnail of the
   artwork"; and the same day: "Also the info for the artwork should always
   be below the thumbnail of the artwork" — so it stands under every picture.

   Under a picture a label is two short lines (artist, 8 Oct 2026, of Dalí's
   life on his phone, its label five lines under a picture 197 px wide: "The
   information for each artwork underneath the thumbnail is still messed up
   and takes up too much space for that information. All I want is its
   current location, the medium, and the year it was made"): where it is now
   — the museum holding it and its city (the history's last holding, else
   museums.json), else the gallery or partner listing it on Artsy and its
   city ("Listed by …, New York"), else the last place its record names
   ("Last recorded: Paris, 1933") — then the year it was made · its medium,
   as Artsy gives them. Never a private owner's name: where the record ends
   with one, the label says the place. The title, the artist, the size, how
   the work is known and where the facts are from (Artsy, or Wikidata for a
   painting not saved) are said to a screen reader, not shown.

   Used by land.js (the reading layout's picture, twice as big, the whole
   screen, a museum's work brought up), placethen.js (the place, then) and,
   whole — title, artist · date, medium · size, where · source — for the
   small squares of a list (anything with `data-work`), which say nothing
   themselves, on hover, focus or a held finger: dismissible with Escape,
   itself pointable, staying until then (WCAG 1.4.13; DISPLAY.md). */
(function () {
  "use strict";

  var cache = {};
  function json(url) {
    if (!cache[url]) {
      cache[url] = fetch(url).then(function (r) { if (!r.ok) { throw new Error(url); } return r.json(); })
        .catch(function () { delete cache[url]; return null; });
    }
    return cache[url];
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function town(w) { return String(w || "").split(",")[0].trim(); }
  function year4(y) { var m = /(\d{4})/.exec(String(y || "")); return m ? m[1] : ""; }
  function withCity(name, city) {
    name = String(name || "").trim();
    if (!city || name.toLowerCase().indexOf(city.toLowerCase()) >= 0) { return name; }
    return name + ", " + city;
  }

  // Where it is now, from its history (and the museums that hold the saved works).
  function nowOf(h, MU) {
    var held = null, listed = null, last = null;
    ((h && h.events) || []).forEach(function (e) {
      if (e.k === "held" && (e.v || e.who)) { held = e; }
      else if ((e.k === "owned" || e.k === "sold") && held) { held = null; }      // left the collection after
      if (e.k === "listed" && e.who) { listed = e; }
      if (e.k !== "written" && (e.w || e.p)) { last = e; }
    });
    var mus = null;
    ((MU && MU.museums) || []).forEach(function (m) {
      if (!mus && (m.works || []).some(function (w) { return w.id === h.id; })) { mus = m; }
    });
    if (held) {
      var city = town(held.w) || (mus && held.m === mus.slug ? town(mus.where) : "");
      return { kind: "held", text: withCity(held.v || held.who, city), slug: held.m || (mus && held.m === mus.slug ? mus.slug : ""),
               key: held.p || "" };
    }
    if (mus) { return { kind: "held", text: withCity(mus.name.replace(/,\s*D\.C\.$/, ""), town(mus.where)), slug: mus.slug, key: "" }; }
    if (listed) { return { kind: "listed", text: "Listed by " + withCity(listed.who, town(listed.w)), key: listed.p || "" }; }
    if (last) { return { kind: "last", text: "Last recorded: " + [town(last.w) || last.p, year4(last.y)].filter(Boolean).join(", "), key: last.p || "" }; }
    return null;
  }

  // A saved work's label, from its history file: { t, a, d, m, s, now, src, id }.
  function facts(id) {
    if (!id) { return Promise.resolve(null); }
    return Promise.all([json("histories/" + id + ".json"), json("museums.json")]).then(function (r) {
      var h = r[0];
      if (!h) { return null; }
      var n = nowOf(h, r[1]);
      return { id: id, t: h.title || "Untitled", a: (h.artists || []).join(", "), as: h.artists || [], d: h.date || "", m: h.medium || "",
               s: h.dimensions || "", now: n ? n.text : "", nowKind: n ? n.kind : "", slug: n ? n.slug || "" : "",
               key: n ? n.key || "" : "", src: "Artsy" };
    });
  }
  // A painting not saved (Painted here's, from Commons): what Wikidata gives.
  function fromItem(o) {
    return { id: o.id || null, t: o.title || o.t || "Untitled", a: o.by || o.a || "", d: o.year ? String(o.year) : o.d || "",
             m: o.medium || "", s: o.size || "", now: o.where || "", nowKind: o.where ? "held" : "", src: o.src || "Wikidata" };
  }

  // The year it was made, as Artsy gives it where that is short ("1945", "c. 1880–1885"), else its first
  // year ("1960; printed 1980" is 1960); a date with no year at all ("20th Century") as it is.
  function madeYear(d) {
    d = String(d || "").trim().replace(/^(circa|ca\.?|c\.)\s*/i, "c. ");
    if (!d) { return ""; }
    if (/\d{4}/.test(d)) { return d.length <= 12 ? d : year4(d); }
    return d.length <= 16 ? d : "";
  }
  function medium(m) { return String(m || "").trim().replace(/\s*\.\s*$/, ""); }
  function yearDoor(f, shown) {
    var names = f.as && f.as.length ? f.as : f.a ? [f.a] : [];
    var y4 = year4(shown);
    return y4 && names.length ? door(el("span", "", shown), { go: "year", id: names[0], year: y4, work: f.id || "" }, names[0] + " in " + y4)
                              : el("span", "", shown);
  }
  function nowLine(f) {
    var now = el("p", "wl-now");
    var w = el("span", "wl-where", f.now);
    w.dataset.kind = f.nowKind || "";
    now.appendChild(f.slug ? door(w, { go: "museum", id: f.slug }, f.now + ": go in")
                   : f.key ? door(w, { go: "town", id: f.key }, f.now + ": go there") : w);
    return now;
  }

  /* The label's lines into `node`: where it is now, then the year it was made · its medium (the year and
     the place doors). What is not shown is said to a screen reader in its place: the work and its artist
     before the lines, its size, how it is known (`how`) and where the facts are from after them.
     opts.full: the whole label — title, artist · date, medium · size, how, where · source. */
  function fill(node, f, opts) {
    opts = opts || {};
    node.textContent = "";
    if (!f) { node.hidden = true; return node; }
    node.hidden = false;
    var by = [f.a, f.d].filter(Boolean).join(" · ");
    var made = [f.m, f.s].filter(Boolean).join(" · ");
    if (!opts.full) {
      node.dataset.brief = "true";
      node.removeAttribute("aria-label");
      node.appendChild(el("span", "a11y-only", [f.t || "Untitled", f.a ? "by " + f.a : ""].filter(Boolean).join(", ") + ". "));
      if (f.now) { node.appendChild(nowLine(f)); }
      var yr = madeYear(f.d), med = medium(f.m);
      if (yr || med) {
        var mp = el("p", "wl-made");
        if (yr) { mp.appendChild(yearDoor(f, yr)); }
        if (yr && med) { mp.appendChild(document.createTextNode(" · ")); }
        if (med) { mp.appendChild(el("span", "wl-medium", med)); }
        node.appendChild(mp);
      }
      node.appendChild(el("span", "a11y-only", " " + [f.s, opts.how, "facts from " + f.src].filter(Boolean).join(". ") + "."));
      return node;
    }
    delete node.dataset.brief;
    node.setAttribute("aria-label", [f.t, by, made, opts.how, f.now, "facts from " + f.src].filter(Boolean).join(". "));
    if (opts.title !== false) {
      var t = el("p", "wl-title");
      var ti = el("i", "", f.t || "Untitled");
      t.appendChild(f.id ? door(ti, { go: "work", id: f.id }, (f.t || "Untitled") + ": where it has been") : ti);
      node.appendChild(t);
    }
    if (by) {
      var bp = el("p", "wl-by");
      var names = f.as && f.as.length ? f.as : f.a ? [f.a] : [];
      names.forEach(function (n, i) {
        if (i) { bp.appendChild(document.createTextNode(", ")); }
        bp.appendChild(door(el("span", "", n), { go: "artist", id: n }, n + ": the artist"));
      });
      if (f.d) {
        if (names.length) { bp.appendChild(document.createTextNode(" · ")); }
        bp.appendChild(yearDoor(f, f.d));
      }
      node.appendChild(bp);
    }
    if (made) { node.appendChild(el("p", "wl-made", made)); }
    if (opts.how) { node.appendChild(el("p", "wl-how", opts.how)); }
    var now = f.now ? nowLine(f) : el("p", "wl-now");
    now.appendChild(el("span", "wl-src", (f.now ? " · " : "") + f.src));
    node.appendChild(now);
    return node;
  }

  /* ---- every fact a door (artist, 8 Oct 2026, of a work's label on the whole screen: "I want to be able to
     click on any of the information in instances like this and it take me there"): the title to the work's
     history, the artist to their life (or their works), the date to the life at that year, where it is to
     the museum (or the city). The label is cloned into the zoom views, so the doors are marked with data
     and answered once, here, for the whole page. Medium and size are measurements, not places: plain. */
  function door(inner, d, label) {
    var b = el("button", "wl-door");
    b.type = "button";
    Object.keys(d).forEach(function (k) { if (d[k] !== undefined && d[k] !== "") { b.dataset[k] = d[k]; } });
    b.setAttribute("aria-label", label);
    b.appendChild(inner);
    return b;
  }
  function putAway() {
    hideTip();
    if (window.Land && Land.full) { Land.full(false); }
    if (window.Zoom) {
      if (Zoom.on()) { Zoom.close(true); }
      var zb = Zoom.big();
      if (zb && zb.undo) { zb.undo(true); }
    }
  }
  function goTo(d) {
    var L = window.Land, LV = window.Lives;
    if (!L) { return; }
    var here = L.where ? L.where() || {} : {};
    if (d.go === "work") {
      if (here.at === "work" && here.id === d.id) { return; }
      L.work(d.id);
    } else if (d.go === "artist") {
      if (window.Kinds && Kinds.go) { Kinds.go("artist", d.id); }
      else if (LV && LV.has(d.id)) { LV.open(LV.idOf(d.id)); }
    } else if (d.go === "year") {
      var lv = LV && LV.load ? LV.load() : Promise.resolve();
      Promise.resolve(lv).then(function () {
        if (LV && LV.has(d.id)) { LV.open(LV.idOf(d.id), { year: +d.year }); }
        else if (d.work && !(here.at === "work" && here.id === d.work)) { L.work(d.work); }
      });
    } else if (d.go === "museum") {
      if (L.museum) { L.museum(d.id); }
    } else if (d.go === "town") {
      if (L.town) { L.town(d.id); }
    }
  }
  document.addEventListener("click", function (event) {
    var b = event.target && event.target.closest && event.target.closest(".wl-door");
    if (!b) { return; }
    event.preventDefault();
    event.stopPropagation();
    var d = { go: b.dataset.go, id: b.dataset.id, year: b.dataset.year, work: b.dataset.work };
    putAway();
    goTo(d);
  }, true);
  // A press on a door is the door's, not the picture's or the stage's under it.
  ["pointerdown", "touchstart"].forEach(function (t) {
    document.addEventListener(t, function (event) {
      if (event.target && event.target.closest && event.target.closest(".wl-door")) { event.stopPropagation(); }
    }, { capture: true, passive: true });
  });

  /* ---- the small squares of a list: the label on hover, focus or a held finger ---- */

  var tip = null, tipFor = null, holdT = 0, shownAt = 0;
  function tipEl() {
    if (tip) { return tip; }
    tip = el("div", "wall-label wl-tip");
    tip.setAttribute("role", "tooltip");
    tip.id = "wl-tip";
    tip.hidden = true;
    tip.addEventListener("pointerleave", function (event) { if (event.relatedTarget !== tipFor) { hideTip(); } });
    document.body.appendChild(tip);
    return tip;
  }
  function squareOf(t) {
    var s = t && t.closest ? t.closest("[data-work]") : null;
    if (!s || !s.dataset.work || s.closest(".wall-label")) { return null; }
    // Only a square — a thumbnail in a list — not a row that already says what it is in words.
    var r = s.getBoundingClientRect();
    return r.width && r.width <= 96 && r.height <= 96 ? s : null;
  }
  function showTip(sq) {
    var id = sq.dataset.work;
    tipFor = sq;
    shownAt = performance.now();
    sq.setAttribute("aria-describedby", "wl-tip");
    facts(id).then(function (f) {
      if (tipFor !== sq || !f) { return; }
      var tp = tipEl();
      fill(tp, f, { full: true });
      tp.hidden = false;
      var r = sq.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
      var w = Math.min(280, W - 24);
      tp.style.width = w + "px";
      var x = Math.max(12, Math.min(W - 12 - w, r.left + r.width / 2 - w / 2));
      var h = tp.offsetHeight;
      var y = r.top - h - 8 >= 8 ? r.top - h - 8 : Math.min(H - h - 8, r.bottom + 8);
      tp.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    });
  }
  function hideTip() {
    if (tipFor) { tipFor.removeAttribute("aria-describedby"); }
    tipFor = null;
    if (tip) { tip.hidden = true; }
  }
  document.addEventListener("pointerover", function (event) {
    if (event.pointerType !== "mouse") { return; }
    var sq = squareOf(event.target);
    if (sq && sq !== tipFor) { showTip(sq); }
  }, true);
  document.addEventListener("pointerout", function (event) {
    if (event.pointerType !== "mouse" || !tipFor) { return; }
    var to = event.relatedTarget;
    if (to && (tipFor.contains(to) || (tip && tip.contains(to)))) { return; }
    if (tipFor.contains(event.target)) { hideTip(); }
  }, true);
  document.addEventListener("focusin", function (event) {
    var sq = squareOf(event.target);
    if (sq) { showTip(sq); } else if (tipFor && !(tip && tip.contains(event.target))) { hideTip(); }
  }, true);
  // A finger held on a square (350 ms) shows its label; it stays until the next touch elsewhere.
  document.addEventListener("pointerdown", function (event) {
    window.clearTimeout(holdT);
    if (event.pointerType === "mouse") { return; }
    var sq = squareOf(event.target);
    if (!sq) { if (tipFor && !(tip && tip.contains(event.target))) { hideTip(); } return; }
    holdT = window.setTimeout(function () { showTip(sq); }, 350);
  }, true);
  ["pointerup", "pointercancel"].forEach(function (t) { document.addEventListener(t, function () { window.clearTimeout(holdT); }, true); });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && tipFor) { event.preventDefault(); event.stopImmediatePropagation(); hideTip(); }
  }, true);
  // A scroll moves the square from under its label (but not the scroll that focusing it brought).
  window.addEventListener("scroll", function () { if (tipFor && performance.now() - shownAt > 400) { hideTip(); } }, true);

  window.WallLabel = { facts: facts, fromItem: fromItem, fill: fill, nowOf: nowOf, hide: hideTip };
})();

/* The wall label — what a museum hangs beside a work, beside every
   picture of one on the page.

   The artist, 7 Oct 2026, with a phone screenshot of Cézanne's *The Bend in
   the Road* (its title, artist, date, medium and size only far below, in the
   column): "Where the artwork is located along with its basic information
   provided by artsy should always be adjacent to the thumbnail of the
   artwork".

   A label is: the title (serif italic); artist · date; medium · size, as
   Artsy gives them; and where it is now — the museum holding it and its
   city (the history's last holding, else museums.json), else the gallery or
   partner listing it on Artsy and its city ("Listed by …, New York"), else
   the last place its record names ("Last recorded: Paris, 1933") — with a
   quiet note of where the facts are from ("Artsy", or "Wikidata" for a
   painting not saved). Never a private owner's name: where the record ends
   with one, the label says the place.

   Used by land.js (the reading layout's picture, a work's whole-screen look),
   placethen.js (the place, then, with how the work is known) and, for the
   small squares of a list (anything with `data-work`), on hover, focus or a
   held finger: dismissible with Escape, itself pointable, staying until
   then (WCAG 1.4.13; DISPLAY.md). */
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
      return { kind: "held", text: withCity(held.v || held.who, city) };
    }
    if (mus) { return { kind: "held", text: withCity(mus.name.replace(/,\s*D\.C\.$/, ""), town(mus.where)) }; }
    if (listed) { return { kind: "listed", text: "Listed by " + withCity(listed.who, town(listed.w)) }; }
    if (last) { return { kind: "last", text: "Last recorded: " + [town(last.w) || last.p, year4(last.y)].filter(Boolean).join(", ") }; }
    return null;
  }

  // A saved work's label, from its history file: { t, a, d, m, s, now, src, id }.
  function facts(id) {
    if (!id) { return Promise.resolve(null); }
    return Promise.all([json("histories/" + id + ".json"), json("museums.json")]).then(function (r) {
      var h = r[0];
      if (!h) { return null; }
      var n = nowOf(h, r[1]);
      return { id: id, t: h.title || "Untitled", a: (h.artists || []).join(", "), d: h.date || "", m: h.medium || "",
               s: h.dimensions || "", now: n ? n.text : "", nowKind: n ? n.kind : "", src: "Artsy" };
    });
  }
  // A painting not saved (Painted here's, from Commons): what Wikidata gives.
  function fromItem(o) {
    return { id: o.id || null, t: o.title || o.t || "Untitled", a: o.by || o.a || "", d: o.year ? String(o.year) : o.d || "",
             m: o.medium || "", s: o.size || "", now: o.where || "", nowKind: o.where ? "held" : "", src: o.src || "Wikidata" };
  }

  /* The label's lines into `node`. opts: { title: false } leaves the title out (the caller writes it
     as a door), `how` adds how the work is known, `small` a compact label. */
  function fill(node, f, opts) {
    opts = opts || {};
    node.textContent = "";
    if (!f) { node.hidden = true; return node; }
    node.hidden = false;
    if (opts.title !== false) {
      var t = el("p", "wl-title");
      t.appendChild(el("i", "", f.t || "Untitled"));
      node.appendChild(t);
    }
    var by = [f.a, f.d].filter(Boolean).join(" · ");
    if (by) { node.appendChild(el("p", "wl-by", by)); }
    var made = [f.m, f.s].filter(Boolean).join(" · ");
    if (made) { node.appendChild(el("p", "wl-made", made)); }
    if (opts.how) { node.appendChild(el("p", "wl-how", opts.how)); }
    var now = el("p", "wl-now");
    if (f.now) {
      var w = el("span", "wl-where", f.now);
      w.dataset.kind = f.nowKind || "";
      now.appendChild(w);
    }
    now.appendChild(el("span", "wl-src", (f.now ? " · " : "") + f.src));
    node.appendChild(now);
    node.setAttribute("aria-label", [f.t, by, made, f.now, "facts from " + f.src].filter(Boolean).join(". "));
    return node;
  }

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
      fill(tp, f);
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

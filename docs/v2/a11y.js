/* WCAG 2.2 across the page (a11y.js).

   The artist, 7 Oct 2026, sending the WCAG 2.2 Quick Reference: "use it as a
   reference on how to best categorize and display information". DISPLAY.md
   is that reference; this module is the part of it that is the same in every
   view, so no module has to know it:

     - one heading a view (h1: the thing the view is about, the categories'
       title where there is one), its sections h2, lists marked as lists, and
       one main region at a time (1.3.1, 2.4.6, 2.4.10);
     - the focus put on that heading when a view is arrived at and nothing
       visible holds it, and given back to what was pressed when you come back
       up (2.4.3);
     - the document's title says the view; the address never changes (2.4.2);
     - a polite line says where you have arrived, when the focus did not move
       (4.1.3), and a year line is said once the dial rests, not on every year
       it passes (A11y.settled);
     - the globe a place in the tab order: arrows turn it, + and − bring it
       nearer and farther, Enter opens the shown place nearest the middle
       (2.1.1; land.js globeKey);
     - Hold still (2.2.2): the first stop in the tab order, and "still" in
       Search; on by default under reduced motion; kept per viewer;
     - a name in its own script says its language (3.1.2).

   No hooks in land.js beyond Land.where (polled), Land.inside, Land.still
   and Land.keys. One address: nothing here touches the URL. */
(function () {
  "use strict";

  var SITE = "Matthew Livingston";
  var land = document.getElementById("land");
  var stage = document.getElementById("stage");
  var artEl = document.getElementById("art");
  var buildingEl = document.getElementById("building");
  var hereEl = document.getElementById("here");
  var finderEl = document.getElementById("finder");
  var finderField = document.getElementById("finder-field");
  var finderFound = document.getElementById("finder-found");
  var banner = document.getElementById("banner");
  var stillBtn = document.getElementById("still-switch");
  if (!land || !window.Land) { return; }

  /* ---- a line said politely ------------------------------------------------ */
  var said = document.createElement("p");
  said.className = "a11y-only";
  said.id = "a11y-said";
  said.setAttribute("role", "status");
  said.setAttribute("aria-live", "polite");
  document.body.appendChild(said);
  var sayTimer = 0;
  function say(text) {
    window.clearTimeout(sayTimer);
    said.textContent = "";
    // Emptied first, then written: the same words twice are still said.
    sayTimer = window.setTimeout(function () { said.textContent = text; }, 60);
  }

  function visible(e) {
    if (!e || !e.isConnected) { return false; }
    for (var n = e; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.getAttribute("aria-hidden") === "true") { return false; }
    }
    var cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") { return false; }
    var r = e.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }
  function text(e) { return e ? String(e.textContent || "").replace(/\s+/g, " ").trim() : ""; }

  /* ---- Hold still ------------------------------------------------------------ */
  function setStill(on, tell) {
    on = !!Land.still(on);
    if (stillBtn) { stillBtn.setAttribute("aria-pressed", String(on)); }
    if (on) { document.documentElement.dataset.still = "true"; } else { delete document.documentElement.dataset.still; }
    try { localStorage.setItem("site.still", on ? "1" : "0"); } catch (e) {}
    if (tell) { say(on ? "Held still: nothing moves by itself." : "Moving again."); }
    return on;
  }
  if (stillBtn) {
    stillBtn.addEventListener("click", function (event) { event.stopPropagation(); setStill(!Land.still(), true); });
    stillBtn.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
  }
  setStill(Land.still(), false);

  // In Search: the word "still" (or "pause", "motion") offers it, on every layer and device.
  var STILL_WORDS = /^(hold )?still|^pause|^motion|^stop( moving)?$|^animation/;
  function stillRow() {
    if (!finderFound || !finderField) { return; }
    var q = String(finderField.value || "").toLowerCase().trim();
    var row = finderFound.querySelector(".a11y-still-row");
    if (!q || !STILL_WORDS.test(q)) { if (row) { row.remove(); } return; }
    if (row) { return; }
    row = document.createElement("button");
    row.type = "button";
    row.className = "finder-row finder-line a11y-still-row";
    function words() {
      row.textContent = Land.still() ? "Let it move again · the globe, the company, the weather, the first plays"
                                     : "Hold still · stop everything that moves by itself";
      row.setAttribute("aria-pressed", String(!!Land.still()));
    }
    words();
    row.addEventListener("click", function (event) { event.stopPropagation(); setStill(!Land.still(), true); words(); });
    finderFound.insertBefore(row, finderFound.firstChild);
  }
  if (finderFound) {
    new MutationObserver(function () { if (!finderFound.querySelector(".a11y-still-row")) { stillRow(); } })
      .observe(finderFound, { childList: true });
  }
  if (finderField) { finderField.addEventListener("input", function () { window.setTimeout(stillRow, 260); }); }

  /* ---- the globe in the tab order ------------------------------------------- */
  // The telescope comes and goes in front of the world: after it in the tab order, so the
  // globe is always the stop after Hold still (its z-index sets where it is drawn, not its order).
  var hubble = document.getElementById("hubble");
  if (hubble && hubble.parentNode === land.parentNode) { land.parentNode.insertBefore(hubble, land.nextSibling); }
  land.setAttribute("role", "group");
  land.setAttribute("aria-roledescription", "globe");
  land.addEventListener("keydown", function (event) {
    if (event.target !== land || event.ctrlKey || event.metaKey || event.altKey) { return; }
    if (Land.keys(event.key)) { event.preventDefault(); }
  });

  /* ---- what is pressed, so the focus can come back to it --------------------- */
  var pressed = null, pressedAt = 0;
  function notePress(event) {
    var t = event.target && event.target.closest && event.target.closest("button, a[href], [role=button], [tabindex], input");
    if (t && t !== document.body) { pressed = t; pressedAt = performance.now(); }
  }
  document.addEventListener("click", notePress, true);
  document.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { notePress(event); } }, true);

  /* ---- the view ------------------------------------------------------------- */
  var KIND = { work: "Work", life: "Life", town: "City", museum: "Museum", movement: "Movement", thread: "Thread",
               building: "Architecture", place: "Collage", world: "The globe" };
  var H1 = [".kinds-head .kinds-title", ".pt-say", ".studio-title", ".read-title", ".wl-title"];
  var H2 = [".art-section-head", ".town-section:not(.life-kicker)", ".held-count", ".finder-group", ".kinds-panel-head"];
  var LISTS = [[".town-venue-list", ".town-venue-box"], [".town-museums", ".town-museum-row"]];

  function viewRoot() {
    if (artEl && !artEl.hidden && visible(artEl)) { return artEl; }
    if (hereEl && !hereEl.hidden && visible(hereEl)) { return hereEl; }
    if (buildingEl && !buildingEl.hidden && visible(buildingEl)) { return buildingEl; }
    return null;
  }

  var h1 = null;                 // the element that is the view's heading now
  var spare = null;              // a heading of our own, where the view has none to give
  function headings(root) {
    // The view's heading: the first of H1 that is seen.
    var found = null;
    if (root) {
      for (var k = 0; k < H1.length && !found; k += 1) {
        var list = root.querySelectorAll(H1[k]);
        for (var n = 0; n < list.length; n += 1) { if (visible(list[n]) && text(list[n])) { found = list[n]; break; } }
      }
    }
    // The heading had the focus and another takes its place (the column written after the
    // picture's look): the focus goes with it.
    var hadFocus = !!h1 && document.activeElement === h1 && h1 !== found;
    if (h1 && h1 !== found && h1 !== spare) {
      h1.removeAttribute("role"); h1.removeAttribute("aria-level"); h1.removeAttribute("data-a11y-h1");
      if (h1.getAttribute("tabindex") === "-1") { h1.removeAttribute("tabindex"); }
    }
    if (found) {
      if (spare && spare.parentNode) { spare.parentNode.removeChild(spare); }
      if (!/^H[1-6]$/.test(found.tagName) || found.tagName !== "H1") {
        found.setAttribute("role", "heading");
        found.setAttribute("aria-level", "1");
      }
      found.setAttribute("data-a11y-h1", "true");
      if (!found.hasAttribute("tabindex")) { found.setAttribute("tabindex", "-1"); }
      h1 = found;
    } else if (root) {
      // No title to give: a heading of our own, for a screen reader, at the head of the view.
      if (!spare) { spare = document.createElement("h1"); spare.className = "a11y-only a11y-h1"; spare.tabIndex = -1; }
      var host = root.querySelector(".art-col, .building-works, .read-col") || root;
      if (spare.parentNode !== host || host.firstChild !== spare) { host.insertBefore(spare, host.firstChild); }
      spare.textContent = fallbackName();
      h1 = spare;
    } else {
      if (spare && spare.parentNode) { spare.parentNode.removeChild(spare); }
      h1 = null;
    }
    if (hadFocus && h1 && h1 !== document.activeElement) {
      try { h1.focus({ preventScroll: true }); } catch (e) {}
    }
    // Its sections, and Find's groups.
    [root, finderEl].forEach(function (r) {
      if (!r) { return; }
      H2.forEach(function (sel) {
        Array.prototype.forEach.call(r.querySelectorAll(sel), function (e) {
          if (/^H[1-6]$/.test(e.tagName) || e.getAttribute("role") === "heading") { return; }
          e.setAttribute("role", "heading");
          e.setAttribute("aria-level", "2");
        });
      });
    });
    // Lists that are lists.
    if (root) {
      LISTS.forEach(function (pair) {
        Array.prototype.forEach.call(root.querySelectorAll(pair[0]), function (ul) {
          if (/^(UL|OL)$/.test(ul.tagName)) { return; }
          ul.setAttribute("role", "list");
          Array.prototype.forEach.call(ul.children, function (li) {
            if (li.matches(pair[1]) && !li.getAttribute("role")) { li.setAttribute("role", "listitem"); }
          });
        });
      });
    }
  }

  // One main region: the view's, else the globe's stage.
  // The stage (the globe, a city's map, a museum's ground) is always a landmark: the main one
  // when it is the view, else a region beside the view's own main (a work's, a life's column).
  var mainEl = null;
  function landmarks(root) {
    var want = root && !stage.contains(root) ? root : stage;
    if (mainEl === want) { return; }
    if (mainEl && mainEl !== stage) { mainEl.removeAttribute("role"); }
    mainEl = want;
    mainEl.setAttribute("role", "main");
    if (mainEl !== stage) {
      stage.setAttribute("role", "region");
      stage.setAttribute("aria-label", "The globe and the ground");
    } else {
      stage.setAttribute("aria-label", "The view");
    }
  }
  if (banner) { banner.setAttribute("role", "navigation"); banner.setAttribute("aria-label", "Where you are"); }

  function where() { try { return Land.where() || {}; } catch (e) { return {}; } }
  function inside() { try { return Land.inside && Land.inside(); } catch (e) { return null; } }
  function guide() { try { return window.Guide && Guide.state ? Guide.state() : null; } catch (e) { return null; } }

  function keyOf(w) {
    if (!w || w.flying || w.at === "flying") { return null; }
    var g = guide(), i = inside();
    return [w.at, w.key || "", w.id || "", w.work || "", w.museum || "", w.building || "",
            w.life ? w.life.id + ":" + w.life.k : "", w.studio === undefined ? "" : w.studio,
            g && g.open ? "guide:" + (g.show || "") : "", i ? "in:" + i.level : ""].join("|");
  }
  function kindWord(w) {
    var g = guide(), i = inside();
    if (i) { return i.level === "plan" ? "Plan of the building" : "Walking the building"; }
    if (g && g.open) { return g.show ? "Show · City guide" : "City guide"; }
    var kn = viewRoot() && viewRoot().querySelector(".kinds-head .kinds-name");
    if (w.life && w.at === "town") { return "A place in a life"; }
    if (kn && visible(kn)) { return text(kn); }
    return KIND[w.at] || "";
  }
  function fallbackName() {
    var w = where(), bc = document.getElementById("banner-city");
    return text(bc) || w.name || KIND[w.at] || SITE;
  }
  function layerName() {
    var on = document.querySelector('#filter .filter-layer[aria-pressed="true"]');
    return on ? text(on).replace(/\s+/g, " ") : "";
  }
  function titleOf(w) {
    if (!w.at || w.at === "world") {
      var ln = layerName();
      return "The globe" + (ln ? " · " + ln.charAt(0) + ln.slice(1).toLowerCase() : "") + " — " + SITE;
    }
    var name = h1 ? text(h1) : fallbackName();
    var g = guide();
    if (g && g.open && !g.show) { name = (w.name || name) + " Guide"; }
    var kind = kindWord(w);
    return (name || SITE) + (kind && kind !== name ? " · " + kind : "") + " — " + SITE;
  }

  /* ---- arriving, and coming back ------------------------------------------- */
  var shownKey = "", trail = [];     // the views come through, each with what was pressed to leave it
  var placed = null;                 // where the focus was put on arrival, and when
  function arrive(w, key) {
    var root = viewRoot();
    landmarks(w.at === "world" ? null : root);
    headings(root);
    // The globe, or a city's map, is a stop of its own; anywhere else the view's own controls are.
    var map = null;
    try { map = Land.map && Land.map(); } catch (e) {}
    land.tabIndex = w.at === "world" || map ? 0 : -1;
    land.setAttribute("aria-label", w.at === "world" ? "The globe" : map ? "The map of " + (w.name || "the city") : "The globe");
    land.setAttribute("aria-roledescription", map ? "map" : "globe");
    document.title = titleOf(w);
    var prev = shownKey;
    shownKey = key;
    if (!prev) { return; }                       // the page's first view: nothing is moved
    // Back to a view already come through (up a level): the focus goes back to what was pressed there.
    var back = null;
    for (var k = trail.length - 1; k >= 0; k -= 1) { if (trail[k].key === key) { back = trail[k]; trail = trail.slice(0, k); break; } }
    if (!back) {
      trail.push({ key: prev, from: pressed && performance.now() - pressedAt < 20000 ? pressed : null });
      if (trail.length > 24) { trail.shift(); }
    }
    var a = document.activeElement;
    var stays = a && a !== document.body && a !== document.documentElement && visible(a) &&
                a !== pressed && !(a === land && w.at !== "world");
    // A played path moves the view by itself: the dial, its readout and Search keep the focus.
    if (stays) { say("Now: " + titleOf(w).replace(" — " + SITE, "")); return; }
    var target = back && back.from && visible(back.from) ? back.from : null;
    if (!target) { target = w.at === "world" ? land : h1; }
    if (target) {
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      placed = { el: target, at: performance.now() };
    }
    if (document.activeElement !== target) { say("Now: " + titleOf(w).replace(" — " + SITE, "")); }
  }

  // Polled, as the other modules do: the view settles after its flight.
  var pending = null, pendingAt = 0;
  function poll() {
    var w = where(), key = keyOf(w);
    if (key === null) { pending = null; return; }
    if (key !== shownKey) {
      // Give the view a moment to write its column before it is read.
      if (pending !== key) { pending = key; pendingAt = performance.now(); return; }
      var root = viewRoot();
      var ready = w.at === "world" || !root ? true :
        Array.prototype.some.call(root.querySelectorAll(H1.join(",")), visible) || performance.now() - pendingAt > 2500;
      if (!ready && performance.now() - pendingAt < 2500) { return; }
      pending = null;
      arrive(w, key);
      return;
    }
    // The same view: its heading and title kept up as its column is written again.
    // What the focus was given on arrival made again (the globe's marks are, as the window
    // settles; a column redrawn): the focus is not left on nothing.
    if (placed && performance.now() - placed.at < 5000 && document.activeElement === document.body &&
        (!placed.el.isConnected || !visible(placed.el))) {
      var again = w.at === "world" ? land : h1;
      if (again && again.isConnected) { try { again.focus({ preventScroll: true }); } catch (e) {} }
      placed = null;
    }
    var t = titleOf(w);
    if (h1 && !h1.isConnected) { headings(viewRoot()); t = titleOf(w); }
    if (document.title !== t) { document.title = t; }
  }
  window.setInterval(poll, 400);

  // The column is written again on many presses (a tab of the three, a year): headings kept.
  var reHead = 0;
  function soon() {
    window.clearTimeout(reHead);
    reHead = window.setTimeout(function () {
      headings(viewRoot());
      langs(viewRoot());
      langs(finderEl);
    }, 140);
  }
  [artEl, buildingEl, hereEl, finderEl].forEach(function (e) {
    if (e) { new MutationObserver(soon).observe(e, { childList: true, subtree: true }); }
  });

  /* ---- a name in its own script says its language (3.1.2) ------------------- */
  var CJK = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]+(?:[\s·・]*[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]+)*/;
  function langOf(s) {
    if (/[぀-ヿ]/.test(s)) { return "ja"; }
    if (/[가-힯]/.test(s)) { return "ko"; }
    return "zh";
  }
  function langs(root) {
    if (!root) { return; }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!CJK.test(n.nodeValue)) { return NodeFilter.FILTER_REJECT; }
        var p = n.parentElement;
        if (!p || p.closest("[lang], script, style, canvas, svg, textarea, input")) { return NodeFilter.FILTER_REJECT; }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var todo = [];
    for (var n = walker.nextNode(); n; n = walker.nextNode()) { todo.push(n); }
    todo.forEach(function (node) {
      var m = CJK.exec(node.nodeValue);
      if (!m) { return; }
      var p = node.parentElement;
      // The whole of an element in the script: its own lang; else the run is wrapped.
      if (node.nodeValue.trim() === m[0] && p.childNodes.length === 1) { p.setAttribute("lang", langOf(m[0])); return; }
      var after = node.splitText(m.index);
      after.splitText(m[0].length);
      var span = document.createElement("span");
      span.setAttribute("lang", langOf(m[0]));
      after.parentNode.insertBefore(span, after);
      span.appendChild(after);
    });
  }

  /* ---- a line said once the dial rests (lives.js, movements.js) ------------- */
  var SETTLE_MS = 1200;
  window.A11y = {
    say: say,
    // `el`'s words are said politely once they have stopped changing for a moment,
    // and only when they are new: a year line passing through every year is not read out.
    settled: function (el) {
      if (!el || el.dataset.a11ySettled) { return; }
      el.dataset.a11ySettled = "true";
      var t = 0, last = "";
      new MutationObserver(function () {
        window.clearTimeout(t);
        t = window.setTimeout(function () {
          var s = text(el);
          if (s && s !== last && visible(el)) { last = s; say(s); }
        }, SETTLE_MS);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    },
    still: function (on) { return on === undefined ? Land.still() : setStill(on, true); }
  };

  poll();
})();

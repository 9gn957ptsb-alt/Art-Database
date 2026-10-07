/* Twice as big, then the whole screen, then as near as one likes.

   The artist, 7 Oct 2026: "When I click on an artwork once to make it
   bigger, make it twice as big, don't make it take up the entire screen like
   it does now. If I click on the artwork again after clicking on it once,
   then make it full screen. When it full screen mode I should be able to zoom
   in to any artwork as much as I please".

   Zoom.twice({ node, img, base, label, lift, onBack }) — the picture at twice
   its size, centred on where it stands and kept wholly on the screen, its
   wall label against it (under it, else over it), a close mark at its corner;
   what is round it stays, covered only where it reaches. `base()` gives its
   box at rest (relayout() after it changes); `lift` an element raised while
   it is big. Returns { relayout, undo, node }.

   Zoom.open({ src, big: [urls, largest first], label, onClose }) — the whole
   screen: the picture fitted above its label; pinch or spread two fingers, a
   wheel or a trackpad's pinch, a double tap (on a point: nearer there; when
   near: back to whole), + and − to zoom; one finger or the mouse drags it
   while near; Escape, the close mark or a press on the dark round it steps
   back (to twice as big). The largest picture Artsy gives is loaded; a CSS
   transform on it keeps it as sharp as that picture is. No zoom is animated
   under reduced motion (nothing here is). */
(function () {
  "use strict";

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MAX = 12;
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function btn(cls, text, label, fn) {
    var b = el("button", cls, text);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); event.preventDefault(); fn(); });
    return b;
  }
  function natural(img) {
    return img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0;
  }

  /* ---- twice as big ---------------------------------------------------------- */

  var big = null;              // the one picture twice as big
  function twice(o) {
    if (big) { big.undo(); }
    var saved = o.node.getAttribute("style") || "";
    var lab = null, close = null;
    var t = { node: o.node };
    function apply() {
      var b = o.base(), W = window.innerWidth, H = window.innerHeight, m = 8;
      if (!b || !b.width) { return; }
      // Under the banner, which stays (the way back is in it).
      var ban = document.getElementById("banner"), top = m;
      if (ban && !ban.hidden) { var br = ban.getBoundingClientRect(); if (br.height && br.bottom < H / 3) { top = Math.min(b.top, br.bottom + 6); } }
      // The picture itself (not its letterbox): its aspect fitted in its box.
      var a = natural(o.img) || b.width / b.height;
      var w = Math.min(b.width, b.height * a), h = w / a;
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      var w2 = 2 * w, h2 = 2 * h;
      // Once big, it stays that big (artist, 7 Oct 2026: "When I click on a painting to make it bigger and
      // then swipe that bigger image, I want the artwork to remain at that size when it switches to the next
      // artwork"): the next picture keeps the height it was given and the place it stood, not twice its own
      // box at rest, which a wider label or another shape had made smaller. Only the screen limits it.
      if (t.keep) { h2 = t.keep.h; w2 = h2 * a; cx = t.keep.cx; cy = t.keep.cy; }
      var labH = lab ? lab.offsetHeight + 6 : 0;
      var k = Math.min(1, (W - 2 * m) / w2, (H - m - top - labH) / h2);
      w2 *= k; h2 *= k;
      var x = Math.max(m, Math.min(W - m - w2, cx - w2 / 2));
      var y = Math.max(top, Math.min(H - m - h2 - labH, cy - h2 / 2));
      if (!t.keep) { t.keep = { h: h2, cx: x + w2 / 2, cy: y + h2 / 2 }; }
      var s = o.node.style;
      s.setProperty("position", "fixed", "important");
      s.setProperty("left", x.toFixed(1) + "px", "important");
      s.setProperty("top", y.toFixed(1) + "px", "important");
      s.setProperty("width", w2.toFixed(1) + "px", "important");
      s.setProperty("height", h2.toFixed(1) + "px", "important");
      s.setProperty("right", "auto", "important");
      s.setProperty("bottom", "auto", "important");
      s.setProperty("transform", "none", "important");
      s.setProperty("z-index", "25", "important");
      s.setProperty("box-shadow", "0 18px 60px rgba(0, 0, 0, 0.7)");
      o.node.dataset.twice = "true";
      if (lab) {
        lab.style.width = Math.max(200, w2) + "px";
        lab.style.left = Math.max(m, Math.min(W - m - Math.max(200, w2), x)) + "px";
        lab.style.top = (y + h2 + 6) + "px";
      }
      close.style.left = (x + w2 - 34) + "px";
      close.style.top = (y + 6) + "px";
    }
    function makeLabel() {
      if (lab) { lab.remove(); lab = null; }
      var n = o.label ? o.label() : null;
      if (n) {
        lab = n;
        lab.classList.add("zoom-label");
        document.body.appendChild(lab);
      }
    }
    close = btn("zoom-x zoom-twice-x", "×", "Back to its size", function () { t.undo(); });
    document.body.appendChild(close);
    if (o.lift) { o.lift.dataset.zoomLift = "true"; }
    makeLabel();
    apply();
    // Its box at rest or its picture changed (a swipe, a resize): twice as big again, its label anew.
    t.relayout = function () { makeLabel(); apply(); };
    // A new screen (turned, resized): twice its box again, measured afresh.
    t.resize = function () { t.keep = null; makeLabel(); apply(); };
    t.undo = function (quiet) {
      if (big !== t) { return; }
      big = null;
      o.node.setAttribute("style", saved);
      delete o.node.dataset.twice;
      if (lab) { lab.remove(); }
      close.remove();
      if (o.lift) { delete o.lift.dataset.zoomLift; }
      if (o.restore) { o.restore(); }
      if (!quiet && o.onBack) { o.onBack(); }
    };
    big = t;
    return t;
  }

  /* ---- the whole screen, and as near as one likes ------------------------------ */

  var V = null;                // { box, img, s, x, y, ... }
  function open(o) {
    // What had the focus gets it back when the whole screen is put away (WCAG 2.4.3).
    var back = V ? V.back : document.activeElement;
    shut(true);
    var box = el("div", "zoom");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "The work on the whole screen: pinch, a wheel, + and − to come nearer; Escape to go back");
    box.tabIndex = -1;
    var stage = el("div", "zoom-stage");
    var img = el("img", "zoom-img");
    img.alt = o.alt || "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.draggable = false;
    stage.appendChild(img);
    box.appendChild(stage);
    var foot = el("div", "zoom-foot");
    if (o.label) { var l = o.label(); if (l) { l.classList.add("zoom-foot-label"); foot.appendChild(l); } }
    var tools = el("div", "zoom-tools");
    tools.appendChild(btn("zoom-b", "−", "Farther", function () { zoomBy(1 / 1.6); }));
    tools.appendChild(btn("zoom-b", "+", "Nearer", function () { zoomBy(1.6); }));
    tools.appendChild(btn("zoom-b zoom-x", "×", "Back", function () { shut(); }));
    foot.appendChild(tools);
    box.appendChild(foot);
    document.body.appendChild(box);
    V = { box: box, stage: stage, img: img, s: 1, x: 0, y: 0, fit: null, o: o, ptrs: {}, tapAt: 0, tapX: 0, tapY: 0, back: back };
    // The whole screen holds the focus while it is up: Tab goes round its own buttons.
    box.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") { return; }
      var bs = Array.prototype.slice.call(box.querySelectorAll("button, a[href], [tabindex='0']"));
      if (!bs.length) { return; }
      var i = bs.indexOf(document.activeElement);
      event.preventDefault();
      bs[(i + (event.shiftKey ? -1 : 1) + bs.length + (i < 0 && event.shiftKey ? 1 : 0)) % bs.length].focus();
    });
    img.addEventListener("load", function () { fit(); });
    img.src = o.src;
    // The largest picture there is, in turn; the first that comes takes over.
    (o.big || []).slice().reverse().reduce(function (next, url) {
      return function () {
        var b = new Image();
        b.referrerPolicy = "no-referrer";
        b.onload = function () { if (V && V.img === img && b.naturalWidth >= (img.naturalWidth || 0)) { img.src = url; } };
        b.onerror = next;
        b.src = url;
      };
    }, function () {})();
    wire(V);
    try { box.focus({ preventScroll: true }); } catch (e) {}
    return V;
  }
  function fit() {
    if (!V) { return; }
    var r = V.stage.getBoundingClientRect(), a = natural(V.img) || 1;
    var w = Math.min(r.width, r.height * a), h = w / a;
    V.fit = { w: w, h: h, x0: r.left + (r.width - w) / 2, y0: r.top + (r.height - h) / 2, W: r.width, H: r.height, L: r.left, T: r.top };
    V.img.style.width = w + "px";
    V.img.style.height = h + "px";
    V.img.style.left = (V.fit.x0 - r.left) + "px";
    V.img.style.top = (V.fit.y0 - r.top) + "px";
    put();
  }
  // Kept so the picture never leaves the screen: centred while smaller than it, its edges at the edges when larger.
  function clamp() {
    var f = V.fit, s = V.s;
    var w = f.w * s, h = f.h * s;
    var px = f.x0 - f.L, py = f.y0 - f.T;
    function lim(v, size, room, p) {
      var lo = room - size - p, hi = -p;
      if (size <= room) { return (room - size) / 2 - p; }
      return Math.max(lo, Math.min(hi, v));
    }
    V.x = lim(V.x + px, w, f.W, 0) - px + 0;
    V.y = lim(V.y + py, h, f.H, 0) - py + 0;
  }
  function put() {
    if (!V || !V.fit) { return; }
    clamp();
    V.img.style.transform = "translate(" + V.x.toFixed(1) + "px," + V.y.toFixed(1) + "px) scale(" + V.s.toFixed(4) + ")";
    V.box.dataset.near = V.s > 1.01 ? "true" : "false";
  }
  // Nearer (k > 1) about a point of the screen (the middle, else).
  function zoomBy(k, cx, cy) {
    if (!V || !V.fit) { return; }
    var f = V.fit;
    if (cx === undefined) { cx = f.L + f.W / 2; cy = f.T + f.H / 2; }
    var s1 = Math.max(1, Math.min(MAX, V.s * k));
    // The point under (cx, cy) stays there: image coords p = (c - origin - t) / s.
    var ox = f.x0, oy = f.y0;
    var px = (cx - ox - V.x) / V.s, py = (cy - oy - V.y) / V.s;
    V.s = s1;
    V.x = cx - ox - px * s1;
    V.y = cy - oy - py * s1;
    put();
  }
  function wire(v) {
    var box = v.box, img = v.img;
    box.addEventListener("wheel", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var k = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0022));
      zoomBy(k, event.clientX, event.clientY);
    }, { passive: false });
    var moved = false, down = null, pinch = null;
    box.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
      if (event.target.closest && event.target.closest(".zoom-foot")) { return; }
      v.ptrs[event.pointerId] = { x: event.clientX, y: event.clientY };
      try { box.setPointerCapture(event.pointerId); } catch (e) {}
      var ids = Object.keys(v.ptrs);
      if (ids.length === 1) { down = { x: event.clientX, y: event.clientY, tx: v.x, ty: v.y, at: performance.now() }; moved = false; }
      if (ids.length === 2) {
        var a = v.ptrs[ids[0]], b = v.ptrs[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: v.s };
        moved = true;
      }
    });
    box.addEventListener("pointermove", function (event) {
      if (!v.ptrs[event.pointerId]) { return; }
      v.ptrs[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(v.ptrs);
      if (ids.length >= 2 && pinch) {
        var a = v.ptrs[ids[0]], b = v.ptrs[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomBy(pinch.s * d / pinch.d / v.s, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (down) {
        var dx = event.clientX - down.x, dy = event.clientY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; }
        // One finger (or the mouse) drags it while it is near; at its whole size there is nothing to drag.
        if (moved && v.s > 1.01) { v.x = down.tx + dx; v.y = down.ty + dy; put(); }
      }
    });
    function up(event) {
      if (!v.ptrs[event.pointerId]) { return; }
      delete v.ptrs[event.pointerId];
      var ids = Object.keys(v.ptrs);
      if (ids.length < 2) { pinch = null; }
      if (ids.length === 1) { var p = v.ptrs[ids[0]]; down = { x: p.x, y: p.y, tx: v.x, ty: v.y, at: performance.now() }; return; }
      if (ids.length) { return; }
      var was = down;
      down = null;
      if (moved || !was || event.type === "pointercancel") { return; }
      // A tap: twice on the picture zooms there (or back to whole); once on the dark round it steps back.
      var now = performance.now(), onPic = event.target === img;
      if (now - v.tapAt < 330 && Math.hypot(event.clientX - v.tapX, event.clientY - v.tapY) < 30) {
        v.tapAt = 0;
        window.clearTimeout(v.tapT);
        if (v.s > 1.01) { v.s = 1; v.x = 0; v.y = 0; put(); } else { zoomBy(2.5, event.clientX, event.clientY); }
        return;
      }
      v.tapAt = now; v.tapX = event.clientX; v.tapY = event.clientY;
      if (!onPic) { v.tapT = window.setTimeout(function () { if (V === v && v.tapAt === now) { shut(); } }, 340); }
    }
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    box.addEventListener("click", function (event) { event.stopPropagation(); });
    box.addEventListener("keydown", function (event) {
      if (event.key === "+" || event.key === "=") { zoomBy(1.6); event.preventDefault(); }
      else if (event.key === "-" || event.key === "_") { zoomBy(1 / 1.6); event.preventDefault(); }
      else if (event.key === "0") { v.s = 1; v.x = 0; v.y = 0; put(); }
      else if (/^Arrow/.test(event.key) && v.s > 1.01) {
        v.x += event.key === "ArrowLeft" ? 60 : event.key === "ArrowRight" ? -60 : 0;
        v.y += event.key === "ArrowUp" ? 60 : event.key === "ArrowDown" ? -60 : 0;
        put();
        event.preventDefault();
      }
      event.stopPropagation();
    });
  }
  function shut(quiet) {
    if (!V) { return; }
    var v = V;
    V = null;
    v.box.remove();
    if (!quiet && v.o.onClose) { v.o.onClose(); }
    if (!quiet && v.back && v.back.isConnected && v.back.focus) { try { v.back.focus({ preventScroll: true }); } catch (e) {} }
  }

  // Escape steps back: the whole screen to twice as big, twice as big to as it was. First, before the page's own.
  window.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") { return; }
    if (V) { shut(); }
    else if (big) { big.undo(); }
    else { return; }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener("resize", function () { if (V) { fit(); } if (big) { big.resize(); } });
  // A press anywhere but on it puts a picture twice as big back to its size (the press goes on as it was).
  document.addEventListener("pointerdown", function (event) {
    if (!big || V) { return; }
    var t = event.target;
    if (big.node.contains(t) || (t.closest && t.closest(".zoom-twice-x, .zoom-label"))) { return; }
    big.undo();
  }, true);

  window.Zoom = {
    twice: twice,
    open: open,
    close: function (quiet) { shut(quiet); },
    big: function () { return big; },
    on: function () { return !!V; },
    _state: function () { return { full: !!V, s: V ? V.s : null, x: V ? V.x : null, y: V ? V.y : null, src: V ? V.img.currentSrc || V.img.src : null,
                                   nat: V ? [V.img.naturalWidth, V.img.naturalHeight] : null, twice: !!big }; }
  };
})();

/* DRIFT Poetry: Picture Poetry taken into DRIFT.

   This runs inside DRIFT's own page (build_poetry.py appends it), after DRIFT's engine has begun. Aries, 15 Oct 2026:
   "You can break up the poems by line, keeping them all together squares the aesthetic too much. I want a more
   synthesized integration between DRIFT and Picture Poetry, just as you are distorting artist works to form drift you
   are now taking Picture Poetry and implementing them into those distortions." So no page lies on the plane any more:
   Picture Poetry goes into DRIFT as the saved paintings do, in pieces, each piece into the process that suits it.

   - The poems, a line at a time, into DRIFT's moving parts (WORDS in ground-gl.js, which this hands the glyphs and the
     lines): each swimmer under the surface writes the lines of one poem in its wake, one after another; each line the
     calm country draws opens into a line of the poems and swells back into a line, on a breath of its own; the gesture
     carries lines along it as a river carries what is put in it. A verse line stays whole; a prose poem is broken at
     its sentences and clauses.
   - The photographs into DRIFT's collage, as a photo the viewer puts in goes (GLG.putIn): the first arrives torn out
     where the visit begins, and the collage melts it and carries it off in pieces; every 144 seconds the next goes in
     quietly, so the collage's torn pieces are of it; never over a photo the viewer has just put in.
   - The buildings onto the ground, alone: a building to each square of a lattice of their own, 1597 CSS pixels wide,
     dealt so that no two neighbours are alike, each drawn live by Picture Poetry's own model code on its place's DIRT
     soil and turned by a swipe as in the book, with the creatures that stood by it on its page.
   - A label names the poem a swimmer begins near the middle of the view, and a building when it is tapped.

   #nowords leaves DRIFT's lines and swimmers as they are; #nopoetry is DRIFT alone. */
(function () {
  "use strict";
  const SPEC = __POETRY__;
  if (typeof GLG === "undefined" || !GLG || /(?:^|&)nopoetry(?:&|$)/.test(location.hash.slice(1))) return;
  const stage = document.getElementById("stage"), field = document.getElementById("field");
  const imul = Math.imul, P1 = 0.618033988749895;
  function mixh(h) { h ^= h >>> 16; h = imul(h, 0x7feb352d); h ^= h >>> 15; h = imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0; }
  function h3(x, y, s) { return mixh((imul(x | 0, 0x27d4eb2d) ^ mixh((imul(y | 0, 0x165667b1) + (s >>> 0)) >>> 0)) >>> 0); }
  const unit = (h) => (h >>> 8) / 16777216;
  function loadImage(src) { return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error(src)); im.src = src; }); }
  /** DRIFT's view: its top left on the plane in CSS pixels, its size in device pixels, and device pixels a CSS one
   *  (DRIFT's vx, vy are in cells, R canvas pixels a cell). */
  function view() {
    const dpr = field.width / Math.max(1, field.clientWidth);
    return { W: field.width, H: field.height, dpr, x: Math.round(vx * R) / dpr, y: Math.round(vy * R) / dpr };
  }
  const onPlane = () => typeof MODE === "undefined" || MODE === "plane";

  // ---- the buildings, on the ground and turned by a swipe as in Picture Poetry -----------------------------------
  // Aries, 14 Oct 2026: "Make sure I can still rotate architecture buildings in DRIFT Poetry like I can in Picture
  // Poetry." Dragged sideways, a building turns as in the book (0.022 radians a pixel) and the plane holds still under
  // it; let go, it settles on the nearest of its four diagonals over 700 ms, with the book's easing; a tap names it.
  // Each copy on the plane keeps its own turn. They are drawn on a canvas over DRIFT's ground, as large as the book has
  // them (a page pixel to phi^-1 of a plane pixel).
  const fig = document.createElement("canvas");
  fig.setAttribute("aria-hidden", "true");
  fig.style.pointerEvents = "none";
  stage.insertBefore(fig, field.nextSibling);
  new MutationObserver(() => { fig.style.visibility = field.style.visibility; }).observe(field, { attributes: true, attributeFilter: ["style"] });
  const fx = fig.getContext("2d");
  const B = 1597, TAU = 2 * Math.PI, REST = TAU / 8, BLD = SPEC.buildings || [], NB = BLD.length;
  const isoNearest = (h) => Math.round((h - TAU / 8) / (TAU / 4)) * (TAU / 4) + TAU / 8;
  const ease = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dotsOf = {}, turns = new Map();
  let soilPx = null, soilN = 0, figDirty = true, turning = null, lastV = null, anchor = [0, 0], first = 0, shift = [0, 0], anchored = false;
  /** A square's middle, where its building stands: moved within phi^-1 of the square by its own hash. */
  function seedOf(cx, cy) {
    const h = h3(cx, cy, 59);
    return { x: (cx + 0.5 + P1 * (unit(mixh((h + 1) >>> 0)) - 0.5)) * B + shift[0], y: (cy + 0.5 + P1 * (unit(mixh((h + 2) >>> 0)) - 0.5)) * B + shift[1] };
  }
  /** Which building a square holds: dealt along the rows two apart, so that no two neighbours hold the same one. */
  const bldOf = (cx, cy) => { const v = cx - anchor[0] + 2 * (cy - anchor[1]) + first; return v - NB * Math.floor(v / NB); };
  /** The square the visit begins in holds a building (the one from page N, with #pageN), standing right of the middle of
   *  the view and a little below it (in the middle, on a narrow screen), clear of the caption. */
  function anchorAt(v) {
    const want = location.hash.match(/(?:^|[#&])page(\d+)(?:&|$)/);
    const byPage = want ? BLD.findIndex((b) => SPEC.pages[b.page].n === +want[1]) : -1;
    first = byPage >= 0 ? byPage : Math.floor(Math.random() * Math.max(1, NB));
    anchor = [Math.floor((Math.random() - 0.5) * 120), Math.floor((Math.random() - 0.5) * 120)];
    shift = [0, 0];
    const s = seedOf(anchor[0], anchor[1]), cw = v.W / v.dpr, ch = v.H / v.dpr;
    shift = [v.x + cw * (cw < 700 ? 0.5 : 0.62) - s.x, v.y + ch * 0.6 - s.y];
    anchored = true;
  }
  /** The soil of a place (latitude, longitude) as the book takes it: the DIRT soil tile, wrapped. */
  function soilFor(lat, lon) {
    const n = soilN, cell = (a) => ((Math.floor(a) % n) + n) % n;
    const u0 = Math.floor((lon / 360 + 0.5) * 2 * n), v0 = Math.floor((0.5 - lat / 180) * n);
    return (i, j) => { const o = (cell(v0 + j) * n + cell(u0 + i)) * 4; return [soilPx[o], soilPx[o + 1], soilPx[o + 2], Math.round(soilPx[o + 3] / 85)]; };
  }
  /** One building's dots, built once (a few at a time while the page is idle, so a swipe never waits on one). */
  function dots(slug) {
    if (!dotsOf[slug] && soilPx && window.Models) { const m = SPEC.models[slug]; dotsOf[slug] = Models.build(m.spec, soilFor(m.lat, m.lon)); }
    return dotsOf[slug];
  }
  /** A building's copy on the plane, in its square, and its turn: kept once it has been turned, at rest till then. */
  function copyOf(b, cx, cy) {
    const key = cx + "," + cy;
    return turns.get(key) || { b, cx, cy, key, heading: REST, held: false, settle: null };
  }
  /** A building drawn at a heading, w by h device pixels: one drawing for every copy resting on the same diagonal;
   *  a copy being turned has its own. */
  const drawings = new Map();
  function drawingOf(t, d, w, h) {
    const rest = !t.held && !t.settle, key = rest ? t.b.slug + "|" + w + "|" + h + "|" + t.heading.toFixed(5) : t;
    let cv = drawings.get(key);
    if (!cv || cv.width !== w || cv.height !== h || (!rest && cv.drawn !== t.heading)) {
      if (!cv) { cv = document.createElement("canvas"); drawings.set(key, cv); }
      cv.width = w; cv.height = h;
      Models.draw(cv, d, t.heading, 1, 0.9);
      cv.drawn = t.heading;
    }
    if (rest && drawings.has(t)) drawings.delete(t);                  // (a turn finished: its own drawing goes)
    return cv;
  }
  /** Where a building's drawing lies about its middle, in plane pixels: its outline at rest fitted to its box, as the
   *  book fits it (x, y its top left; w, h its size). */
  function placeOf(b) {
    const r = SPEC.models[b.slug].rest, s = (b.box[2] - b.box[0]) / (r[2] - r[0]);
    const cx = (b.box[0] + b.box[2]) / 2, cy = (b.box[1] + b.box[3]) / 2;
    return { x: (b.box[0] - r[0] * s - cx) * P1, y: (b.box[1] - r[1] * s - cy) * P1, w: 900 * s * P1, h: 675 * s * P1 };
  }
  // the creatures that stood by each building on its page, each where it stood about the building's middle (page pixels)
  const sheet = { im: null }, flock = BLD.map(() => []);
  for (const c of SPEC.chars || []) {
    let best = -1, bd = Infinity;
    BLD.forEach((b, i) => {
      if (b.page !== c.page) return;
      const d = Math.hypot((b.box[0] + b.box[2] - c.box[0] - c.box[2]) / 2, (b.box[1] + b.box[3] - c.box[1] - c.box[3]) / 2);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { const b = BLD[best]; flock[best].push({ dx: c.box[0] - (b.box[0] + b.box[2]) / 2, dy: c.box[1] - (b.box[1] + b.box[3]) / 2, r: c.sheet }); }
  }
  if (SPEC.charSheet) loadImage(SPEC.charSheet).then((im) => { sheet.im = im; figDirty = true; }).catch(() => {});
  /** The buildings' copies within reach of the view. */
  function copiesNear(v) {
    const out = [], x1 = v.x + v.W / v.dpr, y1 = v.y + v.H / v.dpr, reach = 377;
    if (!NB) return out;
    for (let gy = Math.floor((v.y - shift[1] - reach) / B); gy <= Math.floor((y1 - shift[1] + reach) / B); gy++)
      for (let gx = Math.floor((v.x - shift[0] - reach) / B); gx <= Math.floor((x1 - shift[0] + reach) / B); gx++) out.push(copyOf(BLD[bldOf(gx, gy)], gx, gy));
    return out;
  }
  function drawBuildings(v) {
    if (fig.width !== v.W || fig.height !== v.H) { fig.width = v.W; fig.height = v.H; }
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.clearRect(0, 0, fig.width, fig.height);
    if (!anchored || !onPlane()) return;
    for (const t of copiesNear(v)) {
      const s = seedOf(t.cx, t.cy), X = (s.x - v.x) * v.dpr, Y = (s.y - v.y) * v.dpr, k = P1 * v.dpr;
      const d = dots(t.b.slug);
      if (d) {
        const pl = placeOf(t.b), w = Math.max(1, Math.round(pl.w * v.dpr)), h = Math.max(1, Math.round(pl.h * v.dpr));
        fx.drawImage(drawingOf(t, d, w, h), Math.round(X + pl.x * v.dpr), Math.round(Y + pl.y * v.dpr));
      }
      if (sheet.im) {                                                 // its creatures, as pixel art is drawn: square
        fx.imageSmoothingEnabled = false;
        for (const c of flock[BLD.indexOf(t.b)]) fx.drawImage(sheet.im, c.r[0], c.r[1], c.r[2], c.r[3], Math.round(X + c.dx * k), Math.round(Y + c.dy * k), Math.round(c.r[2] * k), Math.round(c.r[3] * k));
        fx.imageSmoothingEnabled = true;
      }
    }
  }
  /** The building copy under a point on the screen (client pixels), if any: its box, at least 36 CSS pixels across. */
  function buildingAt(clientX, clientY) {
    if (!anchored || !lastV || !NB) return null;
    const r = field.getBoundingClientRect(), v = lastV;
    const px = v.x + (clientX - r.left), py = v.y + (clientY - r.top);     // the plane, in its pixels (CSS)
    for (const t of copiesNear(v)) {
      if (!dots(t.b.slug)) continue;
      const s = seedOf(t.cx, t.cy), bx = t.b.hit, b = t.b.box;
      const hx = ((bx[0] + bx[2]) - (b[0] + b[2])) / 2 * P1, hy = ((bx[1] + bx[3]) - (b[1] + b[3])) / 2 * P1;
      const hw = Math.max((bx[2] - bx[0]) / 2 * P1, 18), hh = Math.max((bx[3] - bx[1]) / 2 * P1, 18);
      if (Math.abs(px - s.x - hx) <= hw && Math.abs(py - s.y - hy) <= hh) return t;
    }
    return null;
  }
  // (for looking, as UPDATE.md does: each building copy on the screen, its middle in client pixels, and its turn)
  window.DRIFT_POETRY = {
    buildings() {
      if (!lastV) return [];
      const r = field.getBoundingClientRect(), v = lastV;
      return copiesNear(v).filter((t) => dotsOf[t.b.slug]).map((t) => {
        const s = seedOf(t.cx, t.cy), bx = t.b.hit, b = t.b.box;
        return { name: t.b.name, heading: t.heading, x: r.left + s.x - v.x + ((bx[0] + bx[2]) - (b[0] + b[2])) / 2 * P1,
                 y: r.top + s.y - v.y + ((bx[1] + bx[3]) - (b[1] + b[3])) / 2 * P1 };
      }).filter((b) => b.x > r.left && b.x < r.right && b.y > r.top && b.y < r.bottom);
    },
  };
  function settle(t) {
    const from = t.heading, to = isoNearest(from);
    if (reduce) { t.heading = to; figDirty = true; return; }
    t.settle = { from, to, t0: performance.now() };
  }
  stage.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || turning) return;
    const t = buildingAt(e.clientX, e.clientY);
    if (!t) return;
    e.stopPropagation();                                              // the plane stays where it is: the building turns
    e.preventDefault();
    turning = { t, x: e.clientX, y: e.clientY, h0: t.heading, id: e.pointerId, moved: 0 };
    t.held = true; t.settle = null;
    turns.set(t.key, t);
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* (a finished pointer) */ }
  }, true);
  stage.addEventListener("pointermove", (e) => {
    if (turning && e.pointerId === turning.id) {
      e.stopPropagation();
      const dx = e.clientX - turning.x;
      turning.moved = Math.max(turning.moved, Math.abs(dx) + Math.abs(e.clientY - turning.y));
      turning.t.heading = turning.h0 + dx * 0.022;
      figDirty = true;
    } else if (e.pointerType === "mouse") stage.classList.toggle("poetry-turn", !!buildingAt(e.clientX, e.clientY));
  }, true);
  const letGo = (e) => {
    if (!turning || e.pointerId !== turning.id) return;
    e.stopPropagation();
    const { t, moved } = turning;
    turning = null; t.held = false;
    settle(t);
    if (moved < 8) nameBuilding(t.b);                                 // a tap names it
  };
  stage.addEventListener("pointerup", letGo, true);
  stage.addEventListener("pointercancel", letGo, true);
  /** Turning and settling, on DRIFT's frames. */
  function turnStep(now) {
    for (const t of turns.values()) {
      if (!t.settle || t.held) continue;
      const q = Math.min(1, Math.max(0, (now - t.settle.t0) / 700));   // (a frame's time can be just before the letting go)
      t.heading = t.settle.from + (t.settle.to - t.settle.from) * ease(q);
      if (q >= 1) t.settle = null;
      figDirty = true;
    }
  }
  // the soil the buildings are made of, and then each building, one at a time while the page is idle
  if (NB && SPEC.dirt) {
    loadImage(SPEC.dirt).then((im) => {
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const x = c.getContext("2d"); x.drawImage(im, 0, 0);
      soilPx = x.getImageData(0, 0, c.width, c.height).data; soilN = c.width;
      const slugs = [...new Set(BLD.map((b) => b.slug))], idle = window.requestIdleCallback || ((f) => setTimeout(f, 34));
      const next = () => { const s = slugs.shift(); if (!s) return; try { dots(s); } catch (err) { console.warn("DRIFT Poetry: a building could not be built:", err.message); } figDirty = true; idle(next); };
      idle(next);
    }).catch((err) => console.warn("DRIFT Poetry: the buildings' soil did not arrive:", err.message));
  }

  // ---- the photographs, into DRIFT's collage ----------------------------------------------------------------------
  // As a photo the viewer puts in goes (drift.js): it arrives torn out where it is put in, and the collage melts it
  // (the datamosh) and carries it off in torn pieces across the plane. The first arrives where the visit begins; every
  // 144 seconds the next goes in quietly (no arrival: only the collage's pieces turn to it, phi^-1 of the usual
  // share); and for 377 seconds after the viewer puts in a photo or a name of their own, theirs is left to drift.
  const photoImgs = [];
  let photoNext = Math.floor(Math.random() * 8), photoAt = -1, viewerAt = -1e9;
  if (typeof GLG.putIn === "function") {
    const putIn = GLG.putIn;
    GLG.putIn = function (src, x, y, o) {
      if (!(src && src.poetry) && !(o && o.quiet)) viewerAt = performance.now();
      return putIn.apply(this, arguments);
    };
    Promise.all((SPEC.pages || []).map((p) => loadImage(p.photo).catch(() => null)))
      .then((ims) => ims.forEach((im) => { if (im) { im.poetry = true; photoImgs.push(im); } }));
  }
  let groundAt = -1;
  function photos(now) {
    // (once DRIFT's ground is being painted: it has read back a frame of its own)
    if (groundAt < 0) { if (GLG.reflection && GLG.reflection()) groundAt = now; return; }
    if (!photoImgs.length || now - groundAt < 1618 || now - viewerAt < 377000) return;
    const firstOne = photoAt < 0;
    if (!firstOne && now - photoAt < 144000) return;
    photoAt = now;
    const im = photoImgs[photoNext++ % photoImgs.length];
    GLG.putIn(im, vx + VW * 0.38, vy + VH * 0.42, firstOne ? {} : { quiet: true, share: P1 });
  }

  // ---- the label: the poem a swimmer begins near the middle of the view, a building when it is tapped ---------------
  const label = document.createElement("div");
  label.className = "poetry-label";
  label.setAttribute("aria-live", "polite");
  label.innerHTML = '<span class="t"></span><span class="s"></span>';
  const style = document.createElement("style");
  style.textContent = ".poetry-label{position:absolute;left:13px;bottom:13px;max-width:calc(100% - 26px);padding:5px 13px 7px;" +
    "background:rgba(20,14,10,.56);color:var(--ink);pointer-events:none;opacity:0;transition:opacity .9s ease;display:flex;" +
    "gap:13px;align-items:baseline;white-space:nowrap;overflow:hidden}.poetry-label.on{opacity:1}" +
    ".poetry-label .t{font:italic 400 17px/1.25 var(--serif);flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis}" +
    ".poetry-label .s{color:var(--muted);font-size:11px;letter-spacing:.06em;text-transform:uppercase;min-width:0;overflow:hidden;text-overflow:ellipsis}" +
    "@media (prefers-reduced-motion:reduce){.poetry-label{transition:none}}.poetry-turn #field{cursor:ew-resize}";
  document.head.appendChild(style);
  stage.appendChild(label);
  let namedB = null, namedTimer = 0, poemTimer = 0, verseSeen = -1;
  const linePoem = [];                                                // which poem each of the lines handed over is from
  function show(t, s) {
    label.querySelector(".t").textContent = t;
    label.querySelector(".s").textContent = s;
    label.classList.add("on");
  }
  function nameBuilding(b) {
    namedB = b;
    show(b.name, b.sub || "");
    clearTimeout(namedTimer); clearTimeout(poemTimer);
    namedTimer = setTimeout(() => { namedB = null; label.classList.remove("on"); }, 4181);
  }
  function verseLabel() {
    if (typeof GLG.verse !== "function" || !linePoem.length) return;
    for (const b of GLG.verse().begun) {
      if (b.at <= verseSeen) continue;
      verseSeen = b.at;
      if (namedB || Math.abs(b.x - (vx + VW / 2)) > VW * 0.3 || Math.abs(b.y - (vy + VH / 2)) > VH * 0.3) continue;
      const P = SPEC.poems[linePoem[b.line]];
      if (!P) continue;
      show(P.name, "Picture Poetry, page " + P.n);
      clearTimeout(poemTimer);
      poemTimer = setTimeout(() => { if (!namedB) label.classList.remove("on"); }, 6854);
    }
  }

  // ---- on DRIFT's frames ------------------------------------------------------------------------------------------
  const groundDraw = GLG.draw;
  GLG.draw = function (now) {
    groundDraw(now);
    try { step(now); } catch (err) { console.warn("DRIFT Poetry:", err.message); }
  };
  function step(now) {
    if (typeof placed === "undefined" || !placed) return;
    if (!onPlane()) {
      if (lastV) { lastV = null; fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fig.width, fig.height); label.classList.remove("on"); }
      return;
    }
    const v = view();
    if (!anchored) anchorAt(v);
    if (!lastV || v.x !== lastV.x || v.y !== lastV.y || v.W !== lastV.W || v.H !== lastV.H || v.dpr !== lastV.dpr) { lastV = v; figDirty = true; }
    turnStep(now);
    if (figDirty) { figDirty = false; drawBuildings(v); }
    photos(now);
    verseLabel();
  }
  if (typeof composite === "function") {                              // DRIFT's stills and recordings show the buildings too
    const groundStill = composite;
    window.composite = function () {
      groundStill();
      const c = SNAP.cv;
      if (fig.width) c.getContext("2d").drawImage(fig, 0, 0, c.width, c.height);
    };
  }

  // ---- the poems' letters (WORDS in ground-gl.js) --------------------------------------------------------------------
  // build_poetry.py asks DRIFT's engine for its letters before the engine begins (window.DRIFT_WORDS); here the poems'
  // glyphs are drawn once their fonts are in, in DRIFT's own italic (Newsreader) and Picture Poetry's capitals
  // (Poppins), made distance fields (so the engine can let them wear away out of a line and swell back into it), and
  // handed over with the poems broken into their lines.
  /** A poem's lines as they go into DRIFT: a verse line whole; a prose poem broken at its sentences and clauses, none
   *  longer than 55 characters (at the comma, or else the space, nearest the middle of one that is). */
  function linesOf(P) {
    const ls = P.lines.map((l) => l.trim()).filter(Boolean);
    if (!P.prose) return ls;
    const out = [];
    for (const sentence of ls.join(" ").split(/(?<=[.!?;:])\s+/)) {
      let rest = sentence.trim();
      while (rest.length > 55) {
        const mid = rest.length / 2, near = (ch) => {
          let at = -1;
          for (let i = 8; i < rest.length - 8; i++) if (rest[i] === ch && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
          return at;
        };
        let at = near(",");
        if (at < 0 || Math.abs(at - mid) > rest.length * 0.3) at = near(" ");
        if (at < 0) break;
        out.push(rest.slice(0, rest[at] === "," ? at + 1 : at).trim());
        rest = rest.slice(at + 1).trim();
      }
      if (rest) out.push(rest);
    }
    return out;
  }
  /** The atlas's glyphs, white on black, made distance fields in place, a slot at a time: each pixel how far it lies
   *  from the glyph's edge, 0.5 on it, rising inside and falling to 0 a spread of pixels outside (the exact distance
   *  transform of Felzenszwalb and Huttenlocher, "Distance Transforms of Sampled Functions", 2012, run inside and out). */
  function fields(x, W, H, SW, SH, spread) {
    const img = x.getImageData(0, 0, W, H), d = img.data, INF = 1e20, n = Math.max(SW, SH);
    const outer = new Float64Array(SW * SH), inner = new Float64Array(SW * SH), f = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    function pass(g, off, stride, len) {                               // the lower envelope of the parabolas, one row
      for (let i = 0; i < len; i++) f[i] = g[off + i * stride];
      let k = 0;
      v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * (q - v[k]));
        while (k > 0 && s <= z[k]) { k--; s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * (q - v[k])); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      for (let q = 0, j = 0; q < len; q++) { while (z[j + 1] < q) j++; const r = v[j]; g[off + q * stride] = f[r] + (q - r) * (q - r); }
    }
    const edt = (g) => { for (let c = 0; c < SW; c++) pass(g, c, SW, SH); for (let r = 0; r < SH; r++) pass(g, r * SW, 1, SW); };
    for (let sy = 0; sy < H; sy += SH) for (let sx = 0; sx < W; sx += SW) {
      for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
        const a = d[((sy + j) * W + sx + i) * 4] / 255, k = j * SW + i;
        outer[k] = a >= 1 ? 0 : a <= 0 ? INF : Math.max(0, 0.5 - a) ** 2;
        inner[k] = a >= 1 ? INF : a <= 0 ? 0 : Math.max(0, a - 0.5) ** 2;
      }
      edt(outer); edt(inner);
      for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
        const k = j * SW + i, o = ((sy + j) * W + sx + i) * 4;
        const val = Math.round(255 * (0.5 - (Math.sqrt(outer[k]) - Math.sqrt(inner[k])) / (2 * spread)));
        d[o] = d[o + 1] = d[o + 2] = Math.max(0, Math.min(255, val)); d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
  }
  function letters() {
    if (typeof GLG.words !== "function" || !SPEC.poems || /(?:^|&)nowords(?:&|$)/.test(location.hash.slice(1))) return;
    const EM = 48, SW = 96, SH = 80, OX = 24, OY = 56, COLS = 16, SPREAD = 10;   // an em, a glyph's slot, its origin in it (px)
    const faces = ['italic 400 ' + EM + 'px "Newsreader", Georgia, "Times New Roman", serif',
                   '500 ' + EM + 'px "Poppins", "Avenir Next", "Helvetica Neue", Arial, sans-serif'];
    // the poems' lines, one after another, a space between (no line runs on into the next: each is written alone)
    let text = "";
    const lines = [];
    SPEC.poems.forEach((P, pi) => {
      for (const l of linesOf(P)) { const a = text.length; text += l; lines.push([a, text.length]); linePoem.push(pi); text += " "; }
    });
    const chars = [...new Set(text)], gi = new Map(chars.map((c, i) => [c, i]));
    const draw = () => {
      const cv = document.createElement("canvas");
      cv.width = COLS * SW; cv.height = Math.ceil((2 * chars.length) / COLS) * SH;
      const x = cv.getContext("2d", { willReadFrequently: true });
      x.fillStyle = "#000"; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = "#fff"; x.textBaseline = "alphabetic";
      const adv = chars.map(() => [0, 0]);
      faces.forEach((font, f) => {
        x.font = font;
        chars.forEach((c, g) => {
          const ch = f === 1 ? c.toUpperCase() : c, s = g + f * chars.length;
          adv[g][f] = x.measureText(ch).width / EM;
          x.fillText(ch, (s % COLS) * SW + OX, Math.floor(s / COLS) * SH + OY);
        });
      });
      fields(x, cv.width, cv.height, SW, SH, SPREAD);
      const ends = [], at = [0, 0];
      for (const c of text) { const a = adv[gi.get(c)]; at[0] += a[0]; at[1] += a[1]; ends.push([at[0], at[1]]); }
      GLG.words({ atlas: cv, slot: [SW, SH], cols: COLS, em: EM, origin: [OX, OY], glyphs: chars.length, adv, spread: SPREAD,
                  text: [...text].map((c) => gi.get(c)), ends, lines, poem: linePoem, space: gi.has(" ") ? gi.get(" ") : -1 });
    };
    const sample = chars.join("");
    const fonts = document.fonts && document.fonts.load ? Promise.all(faces.map((f) => document.fonts.load(f, sample))) : Promise.resolve();
    Promise.race([fonts, new Promise((ok) => setTimeout(ok, 4181))]).then(draw, draw);   // (in their own type if it comes)
  }
  try { letters(); } catch (err) { console.warn("DRIFT Poetry: the letters could not be drawn:", err.message); }
})();

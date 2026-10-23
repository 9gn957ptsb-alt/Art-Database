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
   - A plot opens like a book when it is tapped (Aries, 21 Oct 2026: "Plots should be able to open like a book when
     clicked on"): it lifts off the ground and becomes the drawing on a cover in its page's colours, the cover swings
     open on its spine, and the leaves are its page of Picture Poetry: the building, large and turned by a swipe, with
     the book's note on it; the poem, set as the page sets it; the photograph and the creatures, with their notes.
   - A label names the poem a swimmer begins near the middle of the view.

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
  // it; let go, it settles on the nearest of its four diagonals over 700 ms, with the book's easing; a tap opens it.
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
  let bk = null;                                                      // the book open, if one is (below)
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
      if (bk && bk.t.key === t.key) continue;                         // (lifted off the ground: it is the book)
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
    if (e.button > 0 || turning || bk) return;
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
    } else if (e.pointerType === "mouse") stage.classList.toggle("poetry-turn", !bk && !!buildingAt(e.clientX, e.clientY));
  }, true);
  const letGo = (e) => {
    if (!turning || e.pointerId !== turning.id) return;
    e.stopPropagation();
    const { t, moved } = turning;
    turning = null; t.held = false;
    settle(t);
    if (moved < 8) openBook(t);                                       // a tap opens it, like a book
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

  // ---- the label: the poem a swimmer begins near the middle of the view --------------------------------------------
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
    "@media (prefers-reduced-motion:reduce){.poetry-label{transition:none}}.poetry-turn #field{cursor:pointer}";
  document.head.appendChild(style);
  stage.appendChild(label);
  let poemTimer = 0, verseSeen = -1;
  const linePoem = [];                                                // which poem each of the lines handed over is from
  function show(t, s) {
    label.querySelector(".t").textContent = t;
    label.querySelector(".s").textContent = s;
    label.classList.add("on");
  }
  function verseLabel() {
    if (typeof GLG.verse !== "function" || !linePoem.length) return;
    for (const b of GLG.verse().begun) {
      if (b.at <= verseSeen) continue;
      verseSeen = b.at;
      if (bk || Math.abs(b.x - (vx + VW / 2)) > VW * 0.3 || Math.abs(b.y - (vy + VH / 2)) > VH * 0.3) continue;
      const P = SPEC.poems[linePoem[b.line]];
      if (!P) continue;
      show(P.name, "Picture Poetry, page " + P.n);
      clearTimeout(poemTimer);
      poemTimer = setTimeout(() => label.classList.remove("on"), 6854);
    }
  }

  // ---- a plot opens like a book -----------------------------------------------------------------------------------
  // Aries, 21 Oct 2026: "Plots should be able to open like a book when clicked on." A building's plot lies on DRIFT's
  // ground like a closed book, its soil the edge of its pages. Tapped, it lifts off the ground (610 ms) and becomes the
  // drawing on a cover in its page's colours, under the poem's title; the cover swings open on its spine (987 ms); and
  // the leaves are its page of Picture Poetry, a thing to a page as the book's viewer steps through them: the building,
  // drawn large and turned by a swipe (0.009 radians a pixel, settling on a diagonal, as in the book), with the book's
  // note on it; the poem, as its page sets it, on its paper, in its ink and its type, each line where the page has it
  // (build_poetry.py reads the indents from the page image); the photograph and its note; the creatures that stood by
  // it, and theirs; any other building on the page. A swipe, the arrows or the names under the book turn a leaf
  // (610 ms); a tap beside the book, Close or Escape, and it closes and lies down again where it was, turned as it was
  // left. On a wide screen it lies open on a spread; on a narrow one it is a page wide, and a turned leaf goes over out
  // of sight.
  const PHI = 1.618033988749895, LIFT = 610, COVER = 987, LEAF = 610;
  const EASE = "cubic-bezier(0.645, 0.045, 0.355, 1)";                  // (the book's own easing: a cubic, in and out)
  const POPPINS = '"Poppins", "Avenir Next", "Helvetica Neue", Arial, sans-serif';
  const NOTES = SPEC.notes || {};
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixc = (a, b, t) => { const p = rgb(a), q = rgb(b); return "rgb(" + p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(",") + ")"; };
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function place(e, x, y, w, h) { Object.assign(e.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" }); }
  /** An animation run to its end and left there (at once, where motion is reduced). */
  function play(e, frames, ms, easing) {
    const end = Object.assign({}, frames[frames.length - 1]);
    delete end.offset; delete end.easing;
    if (reduce || !ms || !e.animate) { Object.assign(e.style, end); return Promise.resolve(); }
    const a = e.animate(frames, { duration: ms, easing: easing || EASE, fill: "forwards" });
    return a.finished.then(() => { Object.assign(e.style, end); a.cancel(); }, () => {});
  }
  let grainURL = "";
  /** The paper's tooth: a tile of specks, light and dark, laid over each page's colour. */
  function grain() {
    if (grainURL) return grainURL;
    const c = document.createElement("canvas");
    c.width = c.height = 89;
    const x = c.getContext("2d"), im = x.createImageData(89, 89), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = Math.random() < 0.5 ? 0 : 255;
      d[i + 3] = Math.random() < 0.38 ? Math.round(Math.random() * 18) : 0;
    }
    x.putImageData(im, 0, 0);
    return (grainURL = c.toDataURL());
  }
  style.textContent +=
    ".pb{position:absolute;inset:0;z-index:8;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}" +
    ".pb-scrim{position:absolute;inset:0;background:rgba(15,10,7,.62)}" +
    ".pb-book{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0;perspective:1597px}" +
    ".pb-case{position:absolute;background:var(--grain) repeat,var(--cover);border-radius:3px;box-shadow:0 21px 34px -13px rgba(0,0,0,.62);opacity:0}" +
    ".pb-slot,.pb-leaf{position:absolute}.pb-leaf{transform-style:preserve-3d;transform-origin:0 50%}" +
    ".pb-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}.pb-face.back{transform:rotateY(180deg)}" +
    ".pb-shade,.pb-cast{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:2}.pb-shade{background:rgba(0,0,0,.3)}" +
    ".pb-cast{background:linear-gradient(to right,rgba(0,0,0,.34),rgba(0,0,0,.08) 34%,transparent 62%)}" +
    ".pb-page{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;color:var(--ink);background:var(--grain) repeat,var(--paper);border-radius:1px}" +
    ".pb-page.recto{box-shadow:1px 0 0 var(--edge),2px 1px 0 var(--paper),3px 1px 0 var(--edge),4px 2px 0 var(--paper),5px 2px 0 var(--edge)}" +
    ".pb-page.verso{box-shadow:-1px 0 0 var(--edge),-2px 1px 0 var(--paper),-3px 1px 0 var(--edge),-4px 2px 0 var(--paper),-5px 2px 0 var(--edge)}" +
    ".pb-page.recto::after,.pb-page.verso::after{content:'';position:absolute;top:0;bottom:0;width:13%;pointer-events:none}" +
    ".pb-page.recto::after{left:0;background:linear-gradient(to right,rgba(0,0,0,.17),rgba(0,0,0,.05) 34%,transparent)}" +
    ".pb-page.verso::after{right:0;background:linear-gradient(to left,rgba(0,0,0,.17),rgba(0,0,0,.05) 34%,transparent)}" +
    ".pb-pic{position:relative;flex:1 1 auto;min-height:38.2%}" +
    ".pb-pic canvas,.pb-pic img{position:absolute;left:0;top:0;width:100%;height:100%;display:block}" +
    ".pb-pic img{object-fit:contain;box-sizing:border-box;padding:var(--pad) var(--pad) 0}.pb-pic.turn canvas{cursor:ew-resize}" +
    ".pb-text{flex:0 1 auto;max-height:61.8%;overflow:hidden;padding:13px var(--pad) calc(var(--pad) + 8px)}" +
    ".pb-text.all{max-height:none;flex:1 1 auto;padding-top:calc(var(--pad) * 1.618)}.pb-text.scroll{overflow-y:auto;touch-action:pan-y}" +
    ".pb-name{font:italic 400 calc(var(--fs) * 1.55)/1.15 var(--serif);margin:0 0 .3em}" +
    ".pb-sub{font:10px/1.5 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--soft);margin:0 0 1em}" +
    ".pb-body{font:400 var(--fs)/1.5 var(--serif);margin:0 0 .62em;hyphens:auto;-webkit-hyphens:auto}.pb-why{font-style:italic}" +
    ".pb-folio{position:absolute;bottom:9px;font:9.5px/1 var(--mono);letter-spacing:.06em;color:var(--soft)}" +
    ".recto .pb-folio{right:var(--pad)}.verso .pb-folio{left:var(--pad)}" +
    ".pb-pt{display:inline-block;font:500 calc(var(--fp, 13px) * 1.2)/1.3 " + POPPINS + ";letter-spacing:.16em;text-transform:uppercase;padding-bottom:.6em;border-bottom:1px solid var(--rule);margin:0 0 1.9em}" +
    ".pb-poem{font:italic 300 var(--fp)/1.75 " + POPPINS + "}" +
    ".pb-ln{display:block;padding-left:calc(var(--i, 0px) + 1.2em);text-indent:-1.2em}.pb-gap{display:block;height:1.1em}" +
    ".pb-prose{text-align:justify;hyphens:auto;-webkit-hyphens:auto;margin:0}.pb-sig{display:block;margin-top:1.75em}" +
    ".pb-cover{background:none;box-shadow:none!important}.pb-cover::after{display:none}" +
    ".pb-board{position:absolute;inset:0;border-radius:2px 3px 3px 2px;background:linear-gradient(to right,rgba(0,0,0,.22),rgba(0,0,0,.06) 3.5%,rgba(255,255,255,.05) 5%,transparent 9%),var(--grain) repeat,var(--cover);" +
    "box-shadow:1px 1px 0 var(--edge),2px 2px 0 var(--paper),3px 3px 0 var(--edge),4px 4px 0 var(--paper),5px 5px 0 var(--edge),0 21px 34px -13px rgba(0,0,0,.62)}" +
    ".pb-ctitle{position:absolute;left:var(--pad);right:var(--pad);top:calc(var(--pad) * 1.618);text-align:center}.pb-ctitle .pb-pt{margin:0}" +
    ".pb-art{position:absolute;left:7%;width:86%}" +
    ".pb-cfoot{position:absolute;left:var(--pad);right:var(--pad);bottom:calc(var(--pad) * 1.618);text-align:center}.pb-cfoot .pb-sub{margin:0}" +
    ".pb-cname{font:italic 400 calc(var(--fs) * 1.2)/1.3 var(--serif);margin:0 0 .5em}" +
    ".pb-titlepage{justify-content:center;align-items:center;text-align:center;padding:var(--pad)}" +
    ".pb-toc{font:400 var(--fs)/1.75 var(--serif);margin-top:1.618em;color:var(--soft)}" +
    ".pb-nav{position:absolute;display:flex;justify-content:space-between;align-items:center;gap:8px;opacity:0;transition:opacity .38s ease}" +
    ".pb-nav.on{opacity:1}.pb-nav button{background:rgba(15,10,7,.56);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0}" +
    ".pb-nav button:first-child,.pb-nav button:last-child{flex:0 1 auto;max-width:calc(50% - 44px)}.pb-nav button:nth-child(2){flex:none}" +
    ".pb-nav .off{visibility:hidden}@media (prefers-reduced-motion:reduce){.pb-nav{transition:none}}";

  /** The book's measures in DRIFT's stage (CSS pixels): a page about 1 by phi, as the book's portrait pages nearly
   *  are; two to a spread where they fit side by side, else one, as wide as the stage lets it be. */
  function geom() {
    const W = stage.clientWidth, H = stage.clientHeight, M = 13, NAV = 34, avail = Math.max(144, H - 2 * M - NAV);
    let ph = Math.min(avail, 754), pw = ph / PHI;
    const wide = W >= 610 && 2 * pw + 2 * M <= W;
    if (!wide) { pw = Math.min(W - 2 * M, 466); ph = Math.min(avail, pw * PHI); }
    pw = Math.round(pw); ph = Math.round(ph);
    return { W, H, wide, pw, ph, top: Math.round(M + (avail - ph) / 2), spine: wide ? Math.round(W / 2) : Math.round((W - pw) / 2),
             fs: Math.max(11.5, Math.min(15, pw / 25)), pad: Math.round(Math.max(13, pw * 0.0618)) };
  }
  /** What a plot's book holds, a thing to a page, as the book's viewer steps through a page's things: the building
   *  tapped (its turn the plot's own), the poem, the photograph, the creatures, any other building on the page. */
  function contents(t) {
    const pi = t.b.page, P = SPEC.pages[pi], out = [{ kind: "model", b: t.b, note: t.b.note, turn: { heading: t.heading } }];
    out.push({ kind: "poem" }, { kind: "photo", note: P.photoNote });
    for (const c of SPEC.chars || []) if (c.page === pi) out.push({ kind: "char", note: c.note, r: c.sheet });
    for (const o of BLD) if (o.page === pi && o !== t.b) out.push({ kind: "model", b: o, note: o.note, turn: { heading: REST } });
    return out;
  }
  function nameOf(pg) {
    if (!pg) return "";
    if (pg.kind === "poem" || pg.kind === "title") return bk.P.name;
    const n = NOTES[pg.note];
    return n ? n.name : pg.kind === "photo" ? "The photograph" : pg.b ? pg.b.name : "";
  }
  /** Where each of a poem's lines begins, in CSS pixels at this size of its type: the page image's places, scaled by
   *  how much wider the lines are set here than there, and drawn in (all alike, so the shape holds) until no indent is
   *  more than phi^-2 of the page's measure and no indented line runs past it, or to phi^-1 of that, whichever comes
   *  first. */
  const meter = document.createElement("canvas").getContext("2d");
  function indents(P, fp, measure) {
    if (!P.x) return null;
    meter.font = "italic 300 " + fp + "px " + POPPINS;
    const ls = P.lines.filter((l) => l.trim());
    let here = 0, there = 0;
    ls.forEach((l, j) => { here += meter.measureText(l).width; there += P.x[j][1] - P.x[j][0]; });
    // (a line within 4 page pixels of the left is flush: the slant of an italic capital, not an indent)
    const k = there ? here / there : 0, ind = P.x.map((e) => (e[0] < 4 ? 0 : e[0]) * k), most = Math.max(0, ...ind);
    const top = most > 0 ? Math.min(1, (measure * 0.382) / most) : 1;
    let f = top;
    ls.forEach((l, j) => { const w = meter.measureText(l).width; if (ind[j] > 0 && w < measure) f = Math.min(f, (measure - w - 2) / ind[j]); });
    return ind.map((v) => v * Math.max(f, top * 0.618));             // (but the shape kept: past that, a line wraps)
  }
  /** A text that will not fit its part of the page is set smaller, to 11 pixels; and then, if it must be, scrolls. */
  function fitText(pe) {
    const t = pe.querySelector(".pb-text:not(.pb-poem)");
    if (!t) return;
    let fs = bk.g.fs;
    while (t.scrollHeight > t.clientHeight + 1 && fs > 11) { fs -= 0.5; t.style.setProperty("--fs", fs + "px"); }
    if (t.scrollHeight > t.clientHeight + 1) t.classList.add("scroll");
  }
  function settlePage(pe) { fitText(pe); if (pe.paint) pe.paint(); }
  function drawModel(cv, pg) {
    const d = dots(pg.b.slug);
    if (d) Models.draw(cv, d, pg.turn.heading, 1, 0.9); else cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }
  /** A building on its page, turned by a swipe as in the book's viewer, and let go, settling on a diagonal. */
  function turnable(cv, pg) {
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
      if (!bk || bk.busy || e.button > 0) return;
      e.stopPropagation();
      drag = { x: e.clientX, h: pg.turn.heading, id: e.pointerId };
      pg.turn.settle = null;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* (a finished pointer) */ }
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation();
      pg.turn.heading = drag.h + (e.clientX - drag.x) * 0.009;
      drawModel(cv, pg);
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation();
      drag = null;
      const from = pg.turn.heading, to = isoNearest(from), t0 = performance.now(), mine = {};
      pg.turn.settle = mine;
      const go = (now) => {
        if (pg.turn.settle !== mine) return;
        const q = reduce ? 1 : Math.min(1, Math.max(0, (now - t0) / 700));
        pg.turn.heading = from + (to - from) * ease(q);
        if (cv.isConnected) drawModel(cv, pg);
        if (q < 1) requestAnimationFrame(go); else pg.turn.settle = null;
      };
      requestAnimationFrame(go);
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
  }
  function sized(cv, box) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.max(1, Math.round(box.clientWidth * dpr)); cv.height = Math.max(1, Math.round(box.clientHeight * dpr));
  }
  /** The book's note on a thing: its name, the line under it, what it is and why it is there. */
  function noteText(box, pg) {
    const n = NOTES[pg.note] || { name: nameOf(pg), sub: "Picture Poetry, page " + bk.P.n };
    box.append(el("h3", "pb-name", n.name), el("p", "pb-sub", n.sub));
    if (n.body) box.append(el("p", "pb-body", n.body));
    if (n.why) box.append(el("p", "pb-body pb-why", n.why));
  }
  /** A page of the book, a recto (right of the spine) or a verso (left of it). */
  function makePage(pg, side) {
    const P = bk.P, page = el("div", "pb-page " + side);
    pg = pg || { kind: "blank" };
    if (pg.kind === "title") {
      page.classList.add("pb-titlepage");
      page.style.setProperty("--fp", Math.max(11.5, Math.min(14, bk.g.pw / 27)) + "px");
      page.append(el("div", "pb-pt", P.title || P.name), el("p", "pb-cname", "Picture Poetry, page " + P.n));
      const toc = el("div", "pb-toc");
      for (const c of bk.items) toc.append(el("div", "", nameOf(c)));
      page.append(toc);
    } else if (pg.kind === "poem") {
      const box = el("div", "pb-text all pb-poem");
      box.style.setProperty("--fp", pg.fp + "px");
      if (pg.first && P.title) box.append(el("div", "pb-pt", P.title));
      if (P.prose) box.append(el("p", "pb-prose", P.lines.filter((l) => l.trim()).join(" ")));
      else {
        let j = P.lines.slice(0, pg.from).filter((l) => l.trim()).length;
        for (let i = pg.from; i < pg.to; i++) {
          const l = P.lines[i];
          if (!l.trim()) { box.append(el("span", "pb-gap")); continue; }
          const s = el("span", "pb-ln", l);
          if (pg.ind) s.style.setProperty("--i", pg.ind[j].toFixed(1) + "px");
          box.append(s); j++;
        }
      }
      if (pg.last && P.signature) box.append(el("span", "pb-sig", P.signature));
      if (pg.scroll) box.classList.add("scroll");
      page.append(box);
    } else if (pg.kind !== "blank") {
      const pic = el("div", "pb-pic"), text = el("div", "pb-text");
      page.append(pic, text);
      noteText(text, pg);
      if (pg.kind === "photo") {
        const im = el("img");
        im.src = P.photo; im.alt = "The photograph on page " + P.n + " of Picture Poetry"; im.draggable = false;
        pic.append(im);
      } else if (pg.kind === "model") {
        const cv = el("canvas");
        cv.setAttribute("role", "img"); cv.setAttribute("aria-label", nameOf(pg) + ", drawn: swipe it to turn it");
        pic.classList.add("turn"); pic.append(cv); turnable(cv, pg);
        page.paint = () => { sized(cv, pic); drawModel(cv, pg); };
      } else if (pg.kind === "char") {
        const cv = el("canvas");
        cv.setAttribute("role", "img"); cv.setAttribute("aria-label", nameOf(pg));
        pic.append(cv);
        page.paint = () => {                                          // as pixel art is drawn: square, on its shadow
          sized(cv, pic);
          const x = cv.getContext("2d"), r = pg.r;
          x.clearRect(0, 0, cv.width, cv.height);
          if (!sheet.im) return;
          const s = Math.max(1, Math.floor(Math.min((cv.width * 0.5) / r[2], (cv.height * 0.56) / r[3]))), w = r[2] * s, h = r[3] * s;
          const foot = Math.round(cv.height * 0.86);
          x.fillStyle = "rgba(0,0,0,.16)";
          x.beginPath(); x.ellipse(cv.width / 2, foot - 2 * s, w * 0.42, Math.max(2, 1.6 * s), 0, 0, TAU); x.fill();
          x.imageSmoothingEnabled = false;
          x.drawImage(sheet.im, r[0], r[1], r[2], r[3], Math.round((cv.width - w) / 2), foot - h, w, h);
        };
      }
    }
    if (pg.folio) page.append(el("span", "pb-folio", String(pg.folio)));
    page.pg = pg;
    return page;
  }
  /** The cover: the plot itself, as it lay on the ground, on a board in its page's colours, under the poem's title. */
  function makeCover() {
    const P = bk.P, g = bk.g, page = el("div", "pb-page recto pb-cover"), board = el("div", "pb-board");
    const ct = el("div", "pb-ctitle"), foot = el("div", "pb-cfoot");
    ct.style.setProperty("--fp", Math.max(11.5, Math.min(14, g.pw / 27)) + "px");
    ct.append(el("div", "pb-pt", P.title || P.name));
    foot.append(el("p", "pb-cname", nameOf(bk.items[0])), el("p", "pb-sub", "Picture Poetry · page " + P.n));
    board.append(ct, foot);
    const art = el("canvas", "pb-art"), aw = Math.round(g.pw * 0.86), ah = Math.round(aw * 0.75);   // (the plane's 900 by 675)
    Object.assign(art.style, { top: Math.round((g.ph - ah) / 2) + "px", height: ah + "px" });
    page.append(board, art);
    page.paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5), d = dots(bk.t.b.slug);
      art.width = Math.round(aw * dpr); art.height = Math.round(ah * dpr);
      if (d) Models.draw(art, d, bk.t.heading, 1, 0.9);
    };
    return page;
  }
  /** A poem's pages: the whole poem on one if it fits at its size or a little under; else as many as it takes, each
   *  broken at a stanza's end where one falls in its lower half. */
  function poemPages(g) {
    const P = bk.P, n = P.lines.length, measure = g.pw - 2 * g.pad, fp0 = Math.max(11.5, Math.min(14, g.pw / 27));
    const probe = el("div", "pb-slot");
    place(probe, 0, 0, g.pw, g.ph);
    probe.style.visibility = "hidden";
    bk.book.append(probe);
    const fits = (pg) => {
      probe.textContent = "";
      const pe = makePage(Object.assign({ kind: "poem", ind: indents(P, pg.fp, measure) }, pg), "recto"), b = pe.querySelector(".pb-text");
      probe.append(pe);
      return b.scrollHeight <= b.clientHeight + 1;
    };
    let out = null;
    for (const fp of [fp0, fp0 * 0.92, fp0 * 0.85]) if (fits({ from: 0, to: n, first: true, last: true, fp })) { out = [{ from: 0, to: n, first: true, last: true, fp }]; break; }
    if (!out && P.prose) out = [{ from: 0, to: n, first: true, last: true, fp: fp0 * 0.85, scroll: true }];
    if (!out) {
      const fp = fp0 * 0.92;
      out = [];
      for (let from = 0, first = true; from < n; first = false) {
        let to = from + 1;
        while (to < n && fits({ from, to: to + 1, first, last: to + 1 >= n, fp })) to++;
        if (to < n) for (let i = to - 1; i > from + (to - from) / 2; i--) if (!P.lines[i].trim()) { to = i; break; }
        out.push({ from, to, first, last: to >= n, fp });
        from = to;
        while (from < n && !P.lines[from].trim()) from++;
      }
    }
    probe.remove();
    return out.map((o) => Object.assign(o, { kind: "poem", ind: indents(P, o.fp, measure) }));
  }
  /** The book laid out for the stage as it is: its pages, and where it lies open (keeping the page shown, if any). */
  function layout(keep) {
    const b = bk, g = (b.g = geom()), s = b.root.style, P = b.P;
    s.setProperty("--grain", "url(" + grain() + ")");
    for (const [k, v] of [["--paper", P.paper], ["--ink", P.ink], ["--rule", P.rule], ["--soft", mixc(P.ink, P.paper, 0.38)],
                          ["--edge", mixc(P.paper, P.ink, 0.22)], ["--cover", mixc(P.paper, P.ink, 0.12)], ["--fs", g.fs + "px"], ["--pad", g.pad + "px"]]) s.setProperty(k, v);
    b.book.style.perspectiveOrigin = g.spine + "px " + (g.top + g.ph / 2) + "px";
    b.pages = [];
    if (g.wide) b.pages.push({ kind: "title" });
    for (const c of b.items) { if (c.kind === "poem") b.pages.push(...poemPages(g)); else b.pages.push(c); }
    let f = 0;
    for (const pg of b.pages) if (pg.kind !== "title") pg.folio = ++f;
    let i = keep ? b.pages.findIndex((p) => p === keep || (keep.kind === "poem" && p.kind === "poem" && p.from <= keep.from && keep.from < p.to)) : -1;
    if (i < 0) i = g.wide ? 1 : 0;
    if (g.wide && i % 2 === 0) i = Math.max(1, i + 1);
    b.pos = Math.min(i, Math.max(0, b.pages.length - 1));
    place(b.slots.recto, g.spine, g.top, g.pw, g.ph);
    place(b.slots.verso, g.spine - g.pw, g.top, g.pw, g.ph);
    if (g.wide) place(b.cs, g.spine - g.pw - 6, g.top - 6, 2 * g.pw + 12, g.ph + 12);
    else place(b.cs, g.spine - 1, g.top - 6, g.pw + 7, g.ph + 12);
    place(b.nav, g.wide ? g.spine - g.pw : g.spine, g.top + g.ph + 8, g.wide ? 2 * g.pw : g.pw, 26);
    fill(b.slots.recto, b.pages[b.pos], "recto");
    if (g.wide) fill(b.slots.verso, b.pages[b.pos - 1], "verso"); else b.slots.verso.textContent = "";
    navUpdate();
  }
  function fill(slot, pg, side) {
    slot.textContent = "";
    const pe = makePage(pg, side);
    slot.append(pe);
    settlePage(pe);
    return pe;
  }
  /** A leaf over the recto, its front one page and its back another, turning on the spine. */
  function leaf(front, back) {
    const g = bk.g, lf = el("div", "pb-leaf"), f = el("div", "pb-face front"), b = el("div", "pb-face back");
    place(lf, g.spine, g.top, g.pw, g.ph);
    f.append(front, el("div", "pb-shade"));
    b.append(back, el("div", "pb-shade"));
    lf.append(f, b);
    bk.book.append(lf);
    return lf;
  }
  /** A leaf's turn, forward (0 to 180 degrees over the spine) or back: the leaf darkening as it turns from the light,
   *  its shadow passing over the page under it, and on a narrow screen fading as it goes out of sight. */
  function turnLeaf(lf, dir, ms) {
    const sh = lf.querySelectorAll(".pb-shade"), cast = el("div", "pb-cast"), a = dir > 0 ? 0 : -180, z = dir > 0 ? -180 : 0;
    bk.slots.recto.append(cast);
    const runs = [play(lf, [{ transform: "rotateY(" + a + "deg)" }, { transform: "rotateY(" + z + "deg)" }], ms),
                  play(sh[0], dir > 0 ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], ms),
                  play(sh[1], dir > 0 ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], ms),
                  play(cast, [{ opacity: 0 }, { opacity: 0.9, offset: 0.5 }, { opacity: 0 }], ms)];
    if (!bk.g.wide) runs.push(play(lf, dir > 0 ? [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 1 }], ms, "linear"));
    return Promise.all(runs).then(() => cast.remove());
  }
  const canNext = () => bk && bk.pos + 1 < bk.pages.length;
  const canPrev = () => bk && (bk.g.wide ? bk.pos - 2 >= 1 : bk.pos >= 1);
  async function turn(dir) {
    if (!bk || bk.busy || !(dir > 0 ? canNext() : canPrev())) return;
    const b = bk, g = b.g, step = g.wide ? 2 : 1;
    b.busy = true;
    if (dir > 0) {
      const back = g.wide ? makePage(b.pages[b.pos + 1], "verso") : makePage(null, "verso");
      const lf = leaf(b.slots.recto.firstChild, back);
      settlePage(back);
      fill(b.slots.recto, b.pages[b.pos + step], "recto");
      await turnLeaf(lf, 1, LEAF);
      if (g.wide) { b.slots.verso.textContent = ""; b.slots.verso.append(back); }
      lf.remove();
    } else {
      const front = makePage(b.pages[b.pos - step], "recto");
      const lf = leaf(front, g.wide ? b.slots.verso.firstChild : makePage(null, "verso"));
      lf.style.transform = "rotateY(-180deg)";
      settlePage(front);
      if (g.wide) fill(b.slots.verso, b.pages[b.pos - 3], "verso");
      await turnLeaf(lf, -1, LEAF);
      b.slots.recto.textContent = ""; b.slots.recto.append(front);
      lf.remove();
    }
    b.pos += dir * step;
    b.busy = false;
    navUpdate();
  }
  function navUpdate() {
    if (!bk) return;
    const [prev, , next] = bk.navBtns, pn = canPrev() ? nameOf(bk.pages[bk.pos - (bk.g.wide ? 2 : 1)]) : "", nn = canNext() ? nameOf(bk.pages[bk.pos + 1]) : "";
    prev.textContent = "‹ " + pn; prev.classList.toggle("off", !pn); prev.setAttribute("aria-label", "Back a leaf, to " + pn);
    next.textContent = nn + " ›"; next.classList.toggle("off", !nn); next.setAttribute("aria-label", "On a leaf, to " + nn);
  }
  /** Where the plot's drawing lies on the stage now (CSS pixels), as drawBuildings draws it. */
  function groundRect(t) {
    const v = lastV || view(), s = seedOf(t.cx, t.cy), pl = placeOf(t.b);
    return { x: s.x - v.x + pl.x, y: s.y - v.y + pl.y, w: pl.w, h: pl.h };
  }
  function within(e) {
    const a = e.getBoundingClientRect(), r = bk.root.getBoundingClientRect();
    return { x: a.left - r.left, y: a.top - r.top, w: a.width, h: a.height };
  }
  /** The transform that takes the cover's drawing, where it lies in the open book, to the plot on the ground. */
  function toGround(art, t) {
    const gr = groundRect(t), ar = within(art), s = gr.w / ar.w;
    return { gr, transform: "translate(" + (gr.x - s * ar.x).toFixed(2) + "px," + (gr.y - s * ar.y).toFixed(2) + "px) scale(" + s.toFixed(5) + ")" };
  }
  async function openBook(t) {
    if (bk || !anchored || !lastV || !window.Models || !dots(t.b.slug) || !SPEC.pages[t.b.page].paper) return;
    const P = SPEC.pages[t.b.page], root = el("div", "pb"), scrim = el("div", "pb-scrim"), book = el("div", "pb-book");
    const cs = el("div", "pb-case"), verso = el("div", "pb-slot"), recto = el("div", "pb-slot"), nav = el("nav", "pb-nav");
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", P.name + ", Picture Poetry, page " + P.n);
    nav.setAttribute("aria-label", "The book's leaves");
    const navBtns = [el("button", "", "‹"), el("button", "", "Close"), el("button", "", "›")];
    navBtns.forEach((x) => { x.type = "button"; nav.append(x); });
    navBtns[0].onclick = () => turn(-1); navBtns[1].onclick = () => closeBook(); navBtns[2].onclick = () => turn(1);
    book.append(cs, verso, recto);
    root.append(scrim, book, nav);
    stage.append(root);
    bk = { t, P, items: contents(t), root, scrim, book, cs, slots: { verso, recto }, nav, navBtns, busy: true, pos: 0 };
    bk.own = bk.items[0].turn;
    stage.classList.remove("poetry-turn");
    label.classList.remove("on");
    drawBuildings(lastV);                                             // the plot leaves the ground as the book appears
    figDirty = false;
    try {
      layout(null);
      // closed: the cover over the first page, its inside the title page (on a spread) or an endpaper
      const g = bk.g, cover = makeCover(), inside = g.wide ? makePage(bk.pages[0], "verso") : makePage(null, "verso");
      const lf = leaf(cover, inside);
      settlePage(cover); settlePage(inside);
      recto.style.visibility = verso.style.visibility = "hidden";
      // lifted off the ground: the plot grows into the cover's drawing, and the board comes round it
      const board = cover.querySelector(".pb-board"), { transform } = toGround(cover.querySelector(".pb-art"), t);
      await Promise.all([play(book, [{ transform }, { transform: "none" }], LIFT),
                         play(board, [{ opacity: 0 }, { opacity: 1 }], LIFT, "ease-out"),
                         play(scrim, [{ opacity: 0 }, { opacity: 1 }], LIFT, "ease-out")]);
      recto.style.visibility = "";
      // and opened
      await Promise.all([turnLeaf(lf, 1, COVER), play(cs, [{ opacity: 0 }, { opacity: 0, offset: 0.38 }, { opacity: 1 }], COVER, "linear")]);
      if (g.wide) { verso.textContent = ""; verso.append(inside); verso.style.visibility = ""; }
      lf.remove();
      bk.busy = false; bk.rest = true;
      navUpdate();
      nav.classList.add("on");
      navBtns[1].focus({ preventScroll: true });
    } catch (err) {
      console.warn("DRIFT Poetry: the book did not open:", err.message);
      root.remove(); bk = null; figDirty = true;
    }
  }
  async function closeBook(now) {
    if (!bk || (bk.busy && !now) || bk.closing) return;
    const b = bk, t = b.t;
    b.busy = b.closing = true; b.rest = false;
    b.nav.classList.remove("on");
    t.heading = isoNearest(b.own.heading); t.settle = null; t.held = false;
    turns.set(t.key, t);
    const finish = () => { if (bk === b) bk = null; if (lastV) { drawBuildings(lastV); figDirty = false; } else figDirty = true; b.root.remove(); };
    if (now || reduce) { finish(); return; }
    try {
      const g = b.g, cover = makeCover(), inside = g.wide && b.slots.verso.firstChild ? b.slots.verso.firstChild : makePage(null, "verso");
      const lf = leaf(cover, inside);
      lf.style.transform = "rotateY(-180deg)";
      settlePage(cover);
      b.slots.verso.style.visibility = "hidden";
      await Promise.all([turnLeaf(lf, -1, COVER), play(b.cs, [{ opacity: 1 }, { opacity: 0, offset: 0.62 }, { opacity: 0 }], COVER, "linear")]);
      b.slots.recto.style.visibility = "hidden";
      const { gr, transform } = toGround(cover.querySelector(".pb-art"), t);
      if (gr.x + gr.w > 0 && gr.y + gr.h > 0 && gr.x < b.g.W && gr.y < b.g.H) {
        await Promise.all([play(b.book, [{ transform: "none" }, { transform }], LIFT),
                           play(cover.querySelector(".pb-board"), [{ opacity: 1 }, { opacity: 0 }], LIFT, "ease-in"),
                           play(b.scrim, [{ opacity: 1 }, { opacity: 0 }], LIFT, "ease-in")]);
      } else await play(b.root, [{ opacity: 1 }, { opacity: 0 }], LIFT);   // (its place has gone from the view: it fades)
    } catch (err) { console.warn("DRIFT Poetry: the book did not close smoothly:", err.message); }
    finish();
  }
  const swipe = { at: null };
  window.addEventListener("pointerdown", (e) => {
    swipe.at = bk && bk.root.contains(e.target) && e.button <= 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId, on: e.target } : null;
  }, true);
  window.addEventListener("pointerup", (e) => {
    const s = swipe.at;
    swipe.at = null;
    if (!bk || !s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.on.closest(".pb-pic.turn canvas, button")) return;           // (a building turned, a name pressed)
    if (Math.abs(dx) > 34 && Math.abs(dx) > 1.2 * Math.abs(dy)) turn(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) + Math.abs(dy) < 8 && s.on === bk.scrim) closeBook();
  }, true);
  window.addEventListener("keydown", (e) => {
    if (!bk || e.key === "Tab" || (e.target && e.target.tagName === "BUTTON" && (e.key === " " || e.key === "Enter"))) return;
    e.stopPropagation();                                              // (DRIFT's own keys wait while the book is open)
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); closeBook(); }
    else if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " ") { e.preventDefault(); turn(1); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") { e.preventDefault(); turn(-1); }
  }, true);
  let relayT = 0;
  window.addEventListener("resize", () => {
    if (bk && bk.rest) { bk.rest = false; requestAnimationFrame(() => requestAnimationFrame(() => { if (bk && !bk.busy) bk.rest = true; })); }  // (a resized ground is drawn again once)
    clearTimeout(relayT);
    const again = () => { if (!bk) return; if (bk.busy) { relayT = setTimeout(again, 144); return; } layout(bk.pages[bk.pos]); };
    relayT = setTimeout(again, 144);
  });
  // the book's type, fetched while the page is idle so that the first book opens in it
  if (document.fonts && document.fonts.load) (window.requestIdleCallback || setTimeout)(() => {
    for (const f of ['italic 300 14px "Poppins"', '500 14px "Poppins"', '400 14px "Newsreader"', 'italic 400 14px "Newsreader"']) document.fonts.load(f).catch(() => {});
  });
  Object.assign(window.DRIFT_POETRY, {
    book: () => (bk ? { open: true, busy: bk.busy, wide: bk.g.wide, pos: bk.pos, pages: bk.pages.map((p) => p.kind + ":" + nameOf(p)) } : { open: false }),
    turn: (d) => turn(d), close: () => closeBook(),
  });

  // ---- on DRIFT's frames ------------------------------------------------------------------------------------------
  const groundDraw = GLG.draw;
  GLG.draw = function (now) {
    // (while a book lies open, the ground under it rests: its canvas keeps its last frame, dimmed under the book, and
    // the leaves turn with the whole of the screen's drawing to themselves)
    if (!(bk && bk.rest)) groundDraw(now);
    try { step(now); } catch (err) { console.warn("DRIFT Poetry:", err.message); }
  };
  function step(now) {
    if (typeof placed === "undefined" || !placed) return;
    if (!onPlane()) {
      if (bk) closeBook(true);
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
    // The spirit (Morphology; build_poetry.py cuts the words): what each letter sheds as its line swells back, a step at a
    // time (s + 16 n: its word sheds n affixes, this letter at step s), and the lines whose words share a root, which
    // breathe together (WORDS in ground-gl.js). A line holding a not, a number or an "only" stands as said and sheds
    // nothing: what it holds has no place in a word cut down to its root (HELD, as Morphology Web has it).
    const HELD = /\b(?:not|no|non|never|without|cannot|only|except|sole|unique|both|one|two|three|four|five|first|second|secondary|third|fourth|fifth|highest|squared|exponent\w*|un(?!i|til|der)\w+|inseparable|independen\w*|infinit\w*)\b|n't\b|\d+(?:st|nd|rd|th)?/i;
    const shed = new Array(text.length).fill(0), byRoot = new Map();
    lines.forEach(([a, b], li) => {
      const l = text.slice(a, b), said = HELD.test(l);
      for (const m of l.matchAll(/[A-Za-z]+/g)) {
        const w = m[0].toLowerCase(), c = SPEC.shed && SPEC.shed[w];
        if (c && !said) c.forEach((v, j) => (shed[a + m.index + j] = v));
        for (const r of (SPEC.roots && SPEC.roots[w]) || []) (byRoot.get(r) || byRoot.set(r, new Set()).get(r)).add(li);
      }
    });
    const groups = [...new Set([...byRoot.values()].filter((g) => g.size > 1).map((g) => [...g].sort((p, q) => p - q).join(",")))]
      .map((g) => g.split(",").map(Number));
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
                  text: [...text].map((c) => gi.get(c)), ends, lines, poem: linePoem, space: gi.has(" ") ? gi.get(" ") : -1,
                  shed, groups });
    };
    const sample = chars.join("");
    const fonts = document.fonts && document.fonts.load ? Promise.all(faces.map((f) => document.fonts.load(f, sample))) : Promise.resolve();
    Promise.race([fonts, new Promise((ok) => setTimeout(ok, 4181))]).then(draw, draw);   // (in their own type if it comes)
  }
  try { letters(); } catch (err) { console.warn("DRIFT Poetry: the letters could not be drawn:", err.message); }
})();

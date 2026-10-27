/* Glyph Light on the Artist Website.
 *
 * Artist, 27 Oct 2026, sending the Glyph Light artifact: "Implement this as the aesthetic for the artist website, DRIFT,
 * DRIFT Poetry, Holographic Mr Pearl and morphology. The content should remain the same for each, what changes is how
 * the aesthetic texture of what is being displayed is achieved."
 *
 * glyphlight.js draws; this says what it covers. The texture is the world's: the globe and the black round it with all
 * that is drawn on it (the pixel light, the routes, the remains of the telescope's photographs), a city's skyline, a
 * building and its ground, the walk through a museum, a life's place. Each is drawn as it always was and read, a cell at
 * a time, as glowing glyphs laid over it; every press still reaches what is under them. What stands on the world keeps
 * its own drawing: every word, the names and the dial, the animals and figures, the works' photographs (the walk's
 * pictures too), the flat map, the theatre.
 *
 * The glyphs are the site's own categories' marks (KINDS.md), sorted by the ink they leave as Glyph Light sorts any
 * set: so the faintest light of the world is written ∴ and ∵ and the brightest ▢ and ◆, the world drawn in what it is
 * sorted into. GLYPHS = false brings the world back as it was.
 */
(function () {
  "use strict";
  const GLYPHS = true;
  if (!GLYPHS || !window.GlyphLight) return;
  const SET = " ∴∵→○◇△◎¶▢◆";                         // ■ fills its whole cell: a bright city became solid bars
  const BG = [15 / 255, 10 / 255, 7 / 255];          // the stage's own dark (land.css, .dirt-look .stage)
  const html = document.documentElement;
  const cell = () => (innerWidth < 700 ? 5 : 6);
  // Toned for a world that is often pale (stone cities, cloud): no added contrast, the middles let down a step, and only
  // the real highlights glow (Glyph Light's own 1.2, 1 and 70 % had blown Paris's stone into solid white).
  const base = { set: SET, bg: BG, contrast: 1, gamma: 0.8, thresh: 0.82, glow: 0.5 };
  const made = new Map();                            // host -> overlay
  const live = (el) => el && el.isConnected;

  // The world: one overlay in the stage, just under the telescope's photographs (#trail) and every mark and word of
  // .land, reading the stage's canvases under it in their order. The animals and a life's route (which writes the year's
  // place by name) are lifted over it and keep their drawing. In the reading layout's lens the overlay is clipped with
  // the world (it is a .world canvas: voice.css), and its cells are smaller, as the lens's globe is.
  const stage = document.getElementById("stage"), trail = document.getElementById("trail");
  const RAISE = ".characters, .life-route:not(.movement-route)";
  if (stage && trail) {
    let world = null;
    const sources = () => {
      const out = [];
      for (const c of stage.children) {
        if (world && c === world.canvas) break;
        if (c.tagName !== "CANVAS" || c.__glyphs) continue;
        if (c.matches(RAISE)) { if (c.style.zIndex !== "1") c.style.zIndex = "1"; continue; }
        out.push(c);
      }
      return out;
    };
    world = GlyphLight.create(Object.assign({}, base, {
      host: stage, before: trail, className: "world", sources,
      cell: () => (stage.dataset.lens ? 4 : cell()),
      active: () => !html.hasAttribute("data-skyline"),
    }));
    made.set(stage, world);
  }

  // The rest come and go with their views: watched for, and made once each appears.
  const VIEWS = [
    // a city's skyline: its ground and its clod, under its light (the rings and the walkers) and its dial's front half;
    // read as laid out, since the rise scales every child of .skyline at once, the overlay with them
    { find: () => document.querySelector(".skyline"),
      make: (sky) => ({ host: sky, boxes: "layout", after: () => sky.querySelector(".skyline-clod"),
        sources: () => [...sky.querySelectorAll(".skyline-under, .skyline-clod")], cell,
        active: () => html.hasAttribute("data-skyline") && !sky.hidden }) },
    // a building or a museum, or its plot: the clod, under its ring of light
    { find: () => document.getElementById("building-map"),
      make: (map) => ({ host: map, after: () => map.querySelector(".building-clod"),
        sources: () => [...map.querySelectorAll(".building-clod")], cell,
        active: () => !!map.querySelector(".building-clod") && map.getClientRects().length > 0 }) },
    // the walk: the room's dots and its two finer rings, under the works drawn sharp (walk-art), which stay pictures
    { find: () => document.querySelector(".walk-box"),
      make: (box) => ({ host: box, fit: () => box.querySelector(".walk-view"),
        after: () => { const f = box.querySelectorAll(".walk-fine"); return f.length ? f[f.length - 1] : box.querySelector(".walk-view"); },
        sources: () => [...box.querySelectorAll(".walk-view, .walk-fine")], cell: () => 4,
        active: () => !box.hidden && box.getClientRects().length > 0 }) },
    // a life's place: its clod, beside the works of the period
    { find: () => document.querySelector(".pt-stage"),
      make: (st) => ({ host: st, fit: () => st.querySelector(".pt-clod"), after: () => st.querySelector(".pt-clod"),
        sources: () => [...st.querySelectorAll(".pt-clod")], cell: () => 4,
        active: () => !!st.querySelector(".pt-clod") && st.getClientRects().length > 0 }) },
  ];
  function watch() {
    for (const v of VIEWS) {
      const host = v.find();
      if (!live(host) || made.has(host)) continue;
      const g = GlyphLight.create(Object.assign({}, base, v.make(host)));
      if (g) made.set(host, g);
    }
    for (const [host, g] of made) if (host !== stage && !live(host)) { g.destroy(); made.delete(host); }
  }
  watch();
  setInterval(watch, 700);
  window.Glyphs = { overlays: () => [...made.values()] };
})();

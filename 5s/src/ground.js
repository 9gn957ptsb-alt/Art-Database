/* 5s ground: the canvas renderer for Seed's "Your ground" (SPEC.md, Seed).
 *
 * Plain script, no modules, no network beyond loading the images it is given. Exposes one frozen
 * global, `FiveSGround`:
 *
 * FiveSGround.render(canvas, spec) -> Promise<{land, water, house, description}>
 *   canvas   an HTMLCanvasElement with a CSS box: give it a width and a height (or an aspect-ratio).
 *            Its bitmap is set to that box x devicePixelRatio, cleared to transparent, and the ground
 *            drawn inside a margin, so nothing reaches the canvas's edges. A canvas with no layout box
 *            (not in the document, display: none) keeps its bitmap size.
 *   spec = {
 *     rand      () => number in [0, 1): a seeded PRNG (e.g. FiveS.prng(code)). Every random choice is
 *               drawn from it, synchronously, before any image loads, so the same spec (a fresh PRNG
 *               with the same seed, the same canvas size) gives the same pixels. Math.random is never
 *               used. Without rand, a fixed seed is used.
 *     surfaces  [{src, crop}]: kept Surface cards (src = the crop image, crop null) and brought things
 *               (src = their image, crop = [x, y, w, h] fractions of it). src is a relative URL or a
 *               data URL. A null crop takes the centred square; a crop is squared about its centre.
 *     kept      ["#rrggbb"]: kept colours. They tint the land's surfaces, or are the land's plain
 *               colours when there are no surfaces.
 *     passed    ["#rrggbb"]: passed colours. They are the sea, in bands by distance from the coast,
 *               lightest in the shallows (at most 7, spread from light to dark). None: a default deep
 *               water from the theme.
 *     house     {wall, trim, accent} | null: a house on the highest land tile: walls in wall, roof in
 *               trim, the window frame (and door) in accent.
 *     size      tiles per side of the board (default 9; whole numbers 1..32).
 *     grow      true: animate once (land rises from the sea, the house last). Ignored under
 *               prefers-reduced-motion. The last frame is pixel-identical to a render without grow.
 *     theme     "light" | "dark": the plinth, its shadow, the foam and the default water.
 *   }
 *   Resolves once the ground is fully drawn (after the grow, if any) with
 *     land         the number of land tiles,
 *     water        the number of water tiles (land + water = size x size),
 *     house        true when the ground has a house (spec.house given, with a valid wall colour),
 *     description  plain words naming everything drawn, e.g. "An island on a plinth. Land: 31 tiles
 *                  from 9 surfaces you kept, tinted with 5 colours you kept. Water: 50 tiles in 7
 *                  colours you passed. A house in deep teal with a brick red roof, on the highest ground."
 *   Images that fail to load (or take over 10 s) fall back to colours and are not counted as surfaces.
 *   A later render() on the same canvas supersedes an earlier one: the earlier one resolves without
 *   drawing (or, mid-grow, stops where it is). Rejects only when `canvas` is not a canvas.
 *
 * FiveSGround.stop()
 *   Cancels any running grow animation: each jumps to its final frame (so no island is left half
 *   grown) and its render() promise resolves.
 *
 * The drawing, in the art database's own rules for isometric work: true isometry, not the 2:1 games
 * convention. All three axes foreshorten equally and edges run at exactly 30 degrees: a tile's top is
 * a rhombus sqrt(3):1, and one unit of height measures the same on screen as one tile edge. The island
 * stands on a ground plane: an n x n board on a plinth, like a site model. Heights come from smoothed
 * value noise shaped into an island (falling off to the edges; the outer ring is always sea from
 * size 5 up) and stepped into terraces. Land tops carry the surfaces (each mapped onto its rhombus by an
 * affine transform), in regions, tinted toward the kept colours; side faces are the same material,
 * shaded, with light from the upper left (tops brightest, left faces lighter than right ones; columns
 * cast short shadows to the lower right). Water tiles are flat, in the passed colours, with calm
 * ripple strokes; a foam line marks the coast. No text is drawn on the canvas.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- constants

  const C30 = Math.sqrt(3) / 2;                 // cos 30: half a tile's width per unit of i or j
  const GROW_MS = 1700;
  const LOAD_TIMEOUT_MS = 10000;
  const MIN_PX = 8;                             // a bitmap smaller than this is cleared, not drawn on
  // Proportions, in tile edges (one tile edge = one unit of height: true isometry).
  const PLINTH = 0.62;                          // plinth depth below the board
  const MAT = 0.45;                             // the plinth's margin around the sea
  const SEA = 0.13;                             // water depth: the sea's surface above the plinth top
  const STEP = 0.23;                            // one terrace
  const SHADOW_LEN = 0.7;                       // cast shadow length per unit of height
  const TINT = 0.34;                            // how far a surface leans toward its kept colour
  const SHADE = { left: 0.17, right: 0.38 };    // side faces: light from the upper left
  const SHADOW_INK = [28, 22, 50];              // shading leans violet, like the app's neutrals
  // The plinth's soft shadow on the table: offset and blur, in tile edges (screen space).
  const DROP = { dx: 0.14, dy: 0.3, sigma: 0.22 };

  const THEMES = {
    light: {
      matTop: [239, 236, 243], matLeft: [222, 217, 230], matRight: [196, 189, 210],
      rim: [255, 255, 255], rimA: 0.85, drop: [40, 30, 76], dropA: 0.28,
      ink: [30, 24, 48], line: 0.16,
      foam: [255, 255, 255], foamA: 0.9,
      sea: ['#7895cf', '#4a68aa', '#2b4683', '#1d3163'],
      land: ['#a8b78e', '#cdbb8f', '#93a684', '#c4a47c'],
    },
    dark: {
      matTop: [42, 38, 54], matLeft: [32, 29, 42], matRight: [23, 21, 31],
      rim: [255, 255, 255], rimA: 0.16, drop: [0, 0, 0], dropA: 0.62,
      ink: [8, 6, 14], line: 0.22,
      foam: [236, 240, 255], foamA: 0.78,
      sea: ['#5d7bbd', '#3a5797', '#253d74', '#182a55'],
      land: ['#97a67f', '#b8a77f', '#859777', '#b0916c'],
    },
  };

  // ---------------------------------------------------------------- small helpers

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A caller's PRNG, guarded: anything that is not a number in [0, 1) becomes 0.5.
  function guard(rand) {
    return function () {
      const x = Number(rand());
      return x >= 0 && x < 1 ? x : 0.5;
    };
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const k = Math.floor(rand() * (i + 1));
      const t = a[i]; a[i] = a[k]; a[k] = t;
    }
    return a;
  }

  // ---------------------------------------------------------------- colour

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, (c) => c + c);
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    const v = parseInt(h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  const hexOf = (c) => '#' + c.map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
  const css = (c, a) => (a == null || a >= 1
    ? 'rgb(' + c.map((x) => Math.round(clamp(x, 0, 255))).join(',') + ')'
    : 'rgba(' + c.map((x) => Math.round(clamp(x, 0, 255))).join(',') + ',' + Math.max(0, +a.toFixed(4)) + ')');
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const shade = (c, k) => mix(c, SHADOW_INK, k);

  function lightness(c) {
    const lin = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  }

  function uniqueHexes(list) {
    const out = [];
    const seen = new Set();
    for (const x of Array.isArray(list) ? list : []) {
      const c = hexToRgb(x);
      if (!c) continue;
      const k = hexOf(c);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }

  // Plain colour words. The engine's namer when it is loaded (the app's words), else a small one.
  function colourName(hex) {
    const F = root.FiveS;
    if (F && typeof F.colourName === 'function') {
      try { const n = F.colourName(hex); if (n) return String(n); } catch (e) { /* fall through */ }
    }
    const c = hexToRgb(hex) || [128, 128, 128];
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (l < 0.1) return 'black';
    if (l > 0.95 && s < 0.3) return 'white';
    if (s < 0.14) return l > 0.7 ? 'pale grey' : l < 0.32 ? 'dark grey' : 'grey';
    let h = 0;
    if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    const bands = [[14, 'red'], [42, 'orange'], [66, 'yellow'], [150, 'green'], [195, 'teal'], [250, 'blue'],
      [290, 'violet'], [335, 'pink'], [361, 'red']];
    const base = bands.find((x) => h < x[0])[1];
    return (l < 0.34 ? 'deep ' : l > 0.74 ? 'pale ' : '') + base;
  }

  // ---------------------------------------------------------------- the plan (every random choice)

  function lattice(rand, g) {
    const a = new Float64Array((g + 1) * (g + 1));
    for (let k = 0; k < a.length; k++) a[k] = rand();
    return { g, a };
  }

  function sample(L, x, y) {
    const g = L.g;
    const gx = clamp(x, 0, 1) * g, gy = clamp(y, 0, 1) * g;
    const x0 = Math.min(g - 1, Math.floor(gx)), y0 = Math.min(g - 1, Math.floor(gy));
    const fx = smooth(gx - x0), fy = smooth(gy - y0);
    const w = g + 1, a = L.a;
    const top = lerp(a[y0 * w + x0], a[y0 * w + x0 + 1], fx);
    const bot = lerp(a[(y0 + 1) * w + x0], a[(y0 + 1) * w + x0 + 1], fx);
    return lerp(top, bot, fy);
  }

  function cleanSurfaces(list) {
    const out = [];
    for (const s of Array.isArray(list) ? list : []) {
      const src = typeof s === 'string' ? s : s && typeof s.src === 'string' ? s.src : '';
      if (!src) continue;
      let crop = null;
      const c = s && Array.isArray(s.crop) ? s.crop.map(Number) : null;
      if (c && c.length === 4 && c.every((x) => isFinite(x))) {
        const x = clamp(c[0], 0, 1), y = clamp(c[1], 0, 1);
        const w = clamp(c[2], 0, 1 - x), h = clamp(c[3], 0, 1 - y);
        if (w > 0 && h > 0) crop = [x, y, w, h];
      }
      out.push({ src, crop });
    }
    return out;
  }

  function cleanHouse(h) {
    if (!h || typeof h !== 'object') return null;
    const wall = hexToRgb(h.wall);
    if (!wall) return null;
    const trim = hexToRgb(h.trim) || shade(wall, 0.45);
    const accent = hexToRgb(h.accent) || mix(wall, [255, 255, 255], 0.7);
    return { wall, trim, accent, wallHex: hexOf(wall), trimHex: hexOf(trim) };
  }

  function makePlan(spec, rand) {
    const n = clamp(Math.round(Number(spec.size) || 9), 1, 32);
    const theme = THEMES[spec.theme === 'dark' ? 'dark' : 'light'];
    const kept = uniqueHexes(spec.kept);
    const passed = uniqueHexes(spec.passed);
    const surfaces = cleanSurfaces(spec.surfaces);
    const house = cleanHouse(spec.house);
    const N = n * n;
    const id = (i, j) => j * n + i;

    // Heights: two octaves of value noise, shaped into an island.
    const big = lattice(rand, 3), fine = lattice(rand, 6);
    const cx = (rand() - 0.5) * 0.22, cy = (rand() - 0.5) * 0.22;
    const ax = 0.82 + rand() * 0.3, ay = 0.82 + rand() * 0.3;
    const landFrac = 0.38 + rand() * 0.12;
    const field = new Float64Array(N);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n, y = (j + 0.5) / n;
        const noise = 0.64 * sample(big, x, y) + 0.36 * sample(fine, x, y);
        const dx = ((x * 2 - 1) - cx) / ax, dy = ((y * 2 - 1) - cy) / ay;
        const r = Math.sqrt(dx * dx + dy * dy);
        const mask = 1 - smoothstep(0.05, 1.02, r);
        field[id(i, j)] = mask * (0.3 + 0.7 * noise);
      }
    }

    // Land: the highest share of the tiles; the outer ring stays sea from size 5 up.
    const border = n >= 5;
    const cands = [];
    for (let k = 0; k < N; k++) {
      const i = k % n, j = (k - i) / n;
      if (border && (i === 0 || j === 0 || i === n - 1 || j === n - 1)) continue;
      cands.push(k);
    }
    cands.sort((a, b) => field[b] - field[a] || a - b);
    const landCount = clamp(Math.round(N * landFrac), 1, cands.length);
    const isLand = new Uint8Array(N);
    for (let k = 0; k < landCount; k++) isLand[cands[k]] = 1;
    const landIds = [];
    for (let k = 0; k < N; k++) if (isLand[k]) landIds.push(k);

    // Terraces: levels 1..L above the sea.
    const L = clamp(Math.round(n * 0.5), 2, 6);
    const hTop = field[cands[0]], hSea = field[cands[landCount - 1]];
    const level = new Uint8Array(N);
    for (const k of landIds) {
      const t = hTop > hSea ? (field[k] - hSea) / (hTop - hSea) : 1;
      level[k] = 1 + Math.min(L - 1, Math.floor(Math.pow(t, 0.92) * L));
    }

    // The house tile: the highest; ties go to the one nearest the island's middle.
    let mx = 0, my = 0;
    for (const k of landIds) { mx += k % n; my += Math.floor(k / n); }
    mx /= landIds.length; my /= landIds.length;
    let houseAt = -1;
    for (const k of landIds) {
      if (houseAt < 0) { houseAt = k; continue; }
      const d = (q) => (q % n - mx) ** 2 + (Math.floor(q / n) - my) ** 2;
      if (level[k] > level[houseAt] || (level[k] === level[houseAt] && d(k) < d(houseAt) - 1e-9)) houseAt = k;
    }

    // Water: distance to the nearest land, softened, ranked into bands of colour.
    const waterIds = [];
    for (let k = 0; k < N; k++) if (!isLand[k]) waterIds.push(k);
    const dist = new Float64Array(N);
    for (const k of waterIds) {
      const i = k % n, j = (k - i) / n;
      let best = Infinity;
      for (const q of landIds) {
        const di = q % n - i, dj = Math.floor(q / n) - j;
        const d = di * di + dj * dj;
        if (d < best) best = d;
      }
      dist[k] = Math.sqrt(best) + rand() * 0.3;
    }
    let seaColours;
    let seaDefault = false;
    if (passed.length) {
      const byLight = passed.map(hexToRgb).sort((a, b) => lightness(b) - lightness(a) || hexOf(a).localeCompare(hexOf(b)));
      const m = Math.min(7, byLight.length);
      seaColours = [];
      for (let q = 0; q < m; q++) seaColours.push(byLight[m === 1 ? 0 : Math.round(q * (byLight.length - 1) / (m - 1))]);
    } else {
      seaColours = theme.sea.map(hexToRgb);
      seaDefault = true;
    }
    const band = new Int16Array(N).fill(-1);
    const ranked = waterIds.slice().sort((a, b) => dist[a] - dist[b] || a - b);
    ranked.forEach((k, r) => { band[k] = Math.min(seaColours.length - 1, Math.floor(r * seaColours.length / ranked.length)); });

    // Land regions: each a surface (or a plain colour), grown from seeds spread over the land.
    const pool = surfaces.length ? shuffle(surfaces.map((x, q) => q), rand) : [];
    const keptOrder = shuffle(kept, rand);
    let K;
    if (pool.length) K = Math.min(pool.length, landIds.length);
    else if (kept.length) K = Math.min(kept.length, Math.max(1, Math.round(landIds.length / 3)));
    else K = Math.min(theme.land.length, Math.max(1, Math.round(landIds.length / 4)));
    const seeds = [landIds[Math.floor(rand() * landIds.length)]];
    while (seeds.length < K) {
      let best = -1, bestD = -1;
      for (const k of landIds) {
        let d = Infinity;
        for (const s of seeds) d = Math.min(d, (k % n - s % n) ** 2 + (Math.floor(k / n) - Math.floor(s / n)) ** 2);
        d += rand() * 0.9;
        if (d > bestD) { bestD = d; best = k; }
      }
      seeds.push(best);
    }
    const region = new Int16Array(N).fill(-1);
    for (const k of landIds) {
      let best = 0, bestD = Infinity;
      seeds.forEach((s, r) => {
        const d = Math.sqrt((k % n - s % n) ** 2 + (Math.floor(k / n) - Math.floor(s / n)) ** 2) + (k === s ? -1 : rand() * 0.8);
        if (d < bestD) { bestD = d; best = r; }
      });
      region[k] = best;
    }
    const regions = seeds.map((s, r) => ({
      surface: pool.length ? pool[r] : -1,
      tint: keptOrder.length ? hexToRgb(keptOrder[r % keptOrder.length]) : null,
      plain: keptOrder.length ? hexToRgb(keptOrder[r % keptOrder.length]) : hexToRgb(theme.land[r % theme.land.length]),
    }));
    const jitter = new Float64Array(N);
    for (const k of landIds) jitter[k] = rand() * 2 - 1;

    // The grow: land rises from the house tile outward.
    const delay = new Float64Array(N);
    const hi = houseAt % n, hj = Math.floor(houseAt / n);
    let far = 1;
    for (const k of landIds) far = Math.max(far, Math.hypot(k % n - hi, Math.floor(k / n) - hj));
    for (const k of landIds) delay[k] = 0.45 * Math.hypot(k % n - hi, Math.floor(k / n) - hj) / far;

    return {
      n, N, theme, kept, passed, surfaces, house, isLand, landIds, waterIds, level, L, houseAt,
      seaColours, seaDefault, band, regions, region, jitter, delay,
    };
  }

  // ---------------------------------------------------------------- images and materials

  const imageCache = new Map();   // src -> Promise<HTMLImageElement | null>

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const p = new Promise((resolve) => {
      if (typeof root.Image !== 'function') { resolve(null); return; }
      const img = new root.Image();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(ok && img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
      };
      const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.decoding = 'async';
      img.src = src;
    });
    imageCache.set(src, p);
    p.then((img) => { if (!img) imageCache.delete(src); });   // a failure may succeed next time
    if (imageCache.size > 64) imageCache.delete(imageCache.keys().next().value);
    return p;
  }

  function newCanvas(w, h) {
    const c = root.document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // One texture per region: the surface's square, scaled to about the tile's size, leaning toward the
  // region's kept colour. Regions whose image did not load are plain colours.
  function makeMaterials(plan, images, geo) {
    const s = geo.s;
    const size = clamp(Math.pow(2, Math.ceil(Math.log2(Math.max(8, s * 1.3)))), 8, 512);
    const used = new Set();
    const mats = plan.regions.map((r) => {
      const img = r.surface >= 0 ? images[r.surface] : null;
      if (!img) return { tex: null, colour: r.plain, size };
      const src = plan.surfaces[r.surface];
      const nw = img.naturalWidth, nh = img.naturalHeight;
      let x = 0, y = 0, w = nw, h = nh;
      if (src.crop) { x = src.crop[0] * nw; y = src.crop[1] * nh; w = src.crop[2] * nw; h = src.crop[3] * nh; }
      const side = Math.max(1, Math.min(w, h));
      x += (w - side) / 2;
      y += (h - side) / 2;
      try {
        const tex = newCanvas(size, size);
        const t = tex.getContext('2d');
        t.imageSmoothingEnabled = true;
        t.imageSmoothingQuality = 'high';
        t.drawImage(img, x, y, side, side, 0, 0, size, size);
        if (r.tint) {
          t.globalAlpha = TINT;
          t.fillStyle = css(r.tint);
          t.fillRect(0, 0, size, size);
          t.globalAlpha = 1;
        }
        used.add(r.surface);
        return { tex, colour: r.tint || r.plain, size };
      } catch (e) {
        return { tex: null, colour: r.plain, size };
      }
    });
    return { list: mats, surfacesDrawn: used.size, sea: seaField(plan), drop: dropShadow(plan, geo) };
  }

  // The sea's colours as a smooth field: each tile's colour (land takes the shallows' colour)
  // spread by a Gaussian (sigma half a tile, separable), U pixels per tile, so the bands of passed
  // colours flow into each other while each tile's centre keeps mostly its own colour.
  function seaField(plan) {
    const n = plan.n, U = 12, F = n * U, SIG = 0.5;
    const col = (k) => plan.seaColours[plan.isLand[k] ? 0 : Math.max(0, plan.band[k])];
    // Weights of each tile centre for each pixel centre along one axis.
    const wt = new Float64Array(F * n);
    for (let x = 0; x < F; x++) {
      const p = (x + 0.5) / U;
      let sum = 0;
      for (let i = 0; i < n; i++) { const d = p - (i + 0.5); const w = Math.exp(-d * d / (2 * SIG * SIG)); wt[x * n + i] = w; sum += w; }
      for (let i = 0; i < n; i++) wt[x * n + i] /= sum;
    }
    const rows = new Float64Array(n * F * 3);   // per tile row j, per pixel x
    for (let j = 0; j < n; j++) {
      for (let x = 0; x < F; x++) {
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < n; i++) { const w = wt[x * n + i]; if (w < 1e-4) continue; const c = col(j * n + i); r += w * c[0]; g += w * c[1]; b += w * c[2]; }
        const o = (j * F + x) * 3;
        rows[o] = r; rows[o + 1] = g; rows[o + 2] = b;
      }
    }
    const field = newCanvas(F, F);
    const fc = field.getContext('2d');
    const img = fc.createImageData(F, F);
    for (let y = 0; y < F; y++) {
      for (let x = 0; x < F; x++) {
        let r = 0, g = 0, b = 0;
        for (let j = 0; j < n; j++) { const w = wt[y * n + j]; if (w < 1e-4) continue; const o = (j * F + x) * 3; r += w * rows[o]; g += w * rows[o + 1]; b += w * rows[o + 2]; }
        const q = (y * F + x) * 4;
        img.data[q] = Math.round(r); img.data[q + 1] = Math.round(g); img.data[q + 2] = Math.round(b); img.data[q + 3] = 255;
      }
    }
    fc.putImageData(img, 0, 0);
    return field;
  }

  // The plinth's soft shadow, blurred here rather than with the canvas's shadowBlur (which Chrome
  // rasterises differently on a canvas's first draw than on later ones: same spec, other pixels).
  // The silhouette is filled into a mask at a reduced scale, blurred with three box passes each way
  // (close to a Gaussian), and drawn back enlarged.
  function dropShadow(plan, geo) {
    const s = geo.s, n = plan.n, lo = -MAT, hi = n + MAT;
    const P = (i, j, z) => [geo.ox + (i - j) * C30 * s + DROP.dx * s, geo.oy + (i + j) * 0.5 * s - z * s + DROP.dy * s];
    const pts = [P(lo, lo, 0), P(hi, lo, 0), P(hi, lo, -PLINTH), P(hi, hi, -PLINTH), P(lo, hi, -PLINTH), P(lo, hi, 0)];
    const sigma = Math.max(0.5, DROP.sigma * s);
    const q = Math.max(1, Math.floor(sigma / 3));                 // mask pixels per canvas pixel: 1/q
    const reach = Math.ceil(3 * sigma);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs) - reach), y0 = Math.floor(Math.min(...ys) - reach);
    const w = Math.ceil((Math.max(...xs) + reach - x0) / q), h = Math.ceil((Math.max(...ys) + reach - y0) / q);
    const c = newCanvas(w, h);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(1 / q, 0, 0, 1 / q, -x0 / q, -y0 / q);
    g.beginPath();
    pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fillStyle = '#000';
    g.fill();
    const img = g.getImageData(0, 0, w, h);
    let a = new Float32Array(w * h), b = new Float32Array(w * h);
    for (let k = 0; k < w * h; k++) a[k] = img.data[k * 4 + 3] / 255;
    const sq = sigma / q;
    const r = Math.max(1, Math.round((Math.sqrt(4 * sq * sq + 1) - 1) / 2));
    for (let pass = 0; pass < 6; pass++) {
      const along = pass % 2 === 0;                 // rows, then columns, three times
      const len = along ? w : h, lines = along ? h : w;
      const at = (line, x) => (along ? line * w + x : x * w + line);
      for (let line = 0; line < lines; line++) {
        let sum = 0;
        for (let x = 0; x <= r && x < len; x++) sum += a[at(line, x)];
        for (let x = 0; x < len; x++) {
          b[at(line, x)] = sum / (2 * r + 1);
          if (x + r + 1 < len) sum += a[at(line, x + r + 1)];
          if (x - r >= 0) sum -= a[at(line, x - r)];
        }
      }
      const t = a; a = b; b = t;
    }
    const col = plan.theme.drop, alpha = plan.theme.dropA;
    for (let k = 0; k < w * h; k++) {
      img.data[k * 4] = col[0]; img.data[k * 4 + 1] = col[1]; img.data[k * 4 + 2] = col[2];
      img.data[k * 4 + 3] = Math.round(clamp(a[k], 0, 1) * alpha * 255);
    }
    g.putImageData(img, 0, 0);
    return { canvas: c, x: x0, y: y0, w: w * q, h: h * q };
  }

  // ---------------------------------------------------------------- canvas size and fit

  function fit(canvas, plan) {
    const dpr = root.devicePixelRatio > 0 ? root.devicePixelRatio : 1;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw > 0 && ch > 0) {
      const W = Math.max(1, Math.round(cw * dpr)), H = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
    }
    const W = canvas.width, H = canvas.height;
    const n = plan.n;
    // The scene's box at a tile edge of 1: the plinth, the land's tops, the house's ridge.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const add = (i, j, z) => {
      const x = (i - j) * C30, y = (i + j) / 2 - z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };
    for (const z of [-PLINTH, 0]) for (const i of [-MAT, n + MAT]) for (const j of [-MAT, n + MAT]) add(i, j, z);
    for (const k of plan.landIds) {
      const i = k % n, j = Math.floor(k / n), z = SEA + plan.level[k] * STEP;
      add(i, j, z); add(i + 1, j, z); add(i, j + 1, z);
    }
    if (plan.house && plan.houseAt >= 0) {
      const k = plan.houseAt, z = SEA + plan.level[k] * STEP + HOUSE.wall + HOUSE.roof;
      add(k % n + HOUSE.u0, Math.floor(k / n) + 0.5, z);
    }
    // Room for the plinth's soft shadow (it fades out by three sigmas).
    const reach = 3 * DROP.sigma;
    minX -= Math.max(0.1, reach - DROP.dx); maxX += reach + DROP.dx;
    minY -= Math.max(0.1, reach - DROP.dy); maxY += reach + DROP.dy;
    const bw = maxX - minX, bh = maxY - minY;
    const pad = Math.max(4, Math.min(W, H) * 0.035);   // hairlines and the blur never reach the edge
    const s = Math.max(0.01, Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh));
    const ox = (W - bw * s) / 2 - minX * s;
    const oy = (H - bh * s) / 2 - minY * s;
    return { W, H, s, ox, oy, dpr, px: Math.max(0.75, s / 40) };
  }

  // ---------------------------------------------------------------- wave rings

  // The coast's offset curves: a distance field to the land (sampled RES times per tile edge),
  // traced at each distance with marching squares. Returns, per distance, a flat list of segments
  // [x0, y0, x1, y1, ...] in tile units on the sea's surface.
  const RES = 6;
  // Only tiles within REACH of a grid point are searched. The rings sit at distances <= 1, and a
  // neighbouring grid point is at most 1/RES further, so every distance that shapes a ring (< 2)
  // is exact; farther points read as "far" (Infinity), which no ring crosses.
  const REACH = 3;
  function waveRings(plan, up, levels) {
    const n = plan.n, G = n * RES, W = G + 1;
    const f = new Float64Array(W * W);
    for (let gy = 0; gy <= G; gy++) {
      const y = gy / RES, j0 = Math.max(0, Math.floor(y) - REACH), j1 = Math.min(n - 1, Math.floor(y) + REACH);
      for (let gx = 0; gx <= G; gx++) {
        const x = gx / RES, i0 = Math.max(0, Math.floor(x) - REACH), i1 = Math.min(n - 1, Math.floor(x) + REACH);
        let best = Infinity;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            if (!up[j * n + i]) continue;
            const dx = Math.max(i - x, 0, x - i - 1), dy = Math.max(j - y, 0, y - j - 1);
            const d = dx * dx + dy * dy;
            if (d < best) best = d;
          }
        }
        f[gy * W + gx] = Math.sqrt(best);
      }
    }
    return levels.map((lv) => {
      const segs = [];
      const cross = (x0, y0, a, x1, y1, b) => {
        const t = (lv - a) / (b - a);
        return [(x0 + (x1 - x0) * t) / RES, (y0 + (y1 - y0) * t) / RES];
      };
      for (let gy = 0; gy < G; gy++) {
        for (let gx = 0; gx < G; gx++) {
          const a = f[gy * W + gx], b = f[gy * W + gx + 1], c = f[(gy + 1) * W + gx + 1], d = f[(gy + 1) * W + gx];
          const pts = [];
          if ((a < lv) !== (b < lv)) pts.push(cross(gx, gy, a, gx + 1, gy, b));
          if ((b < lv) !== (c < lv)) pts.push(cross(gx + 1, gy, b, gx + 1, gy + 1, c));
          if ((c < lv) !== (d < lv)) pts.push(cross(gx + 1, gy + 1, c, gx, gy + 1, d));
          if ((d < lv) !== (a < lv)) pts.push(cross(gx, gy + 1, d, gx, gy, a));
          for (let q = 0; q + 1 < pts.length; q += 2) segs.push(pts[q][0], pts[q][1], pts[q + 1][0], pts[q + 1][1]);
        }
      }
      return segs;
    });
  }

  // ---------------------------------------------------------------- drawing

  const HOUSE = { u0: 0.14, u1: 0.86, v0: 0.22, v1: 0.78, wall: 0.4, roof: 0.36, eave: 0.06 };

  function scene(ctx, geo, plan, mats, t) {
    const { n, theme } = plan;
    const s = geo.s;
    const P = (i, j, z) => ({ x: geo.ox + (i - j) * C30 * s, y: geo.oy + (i + j) * 0.5 * s - z * s });
    const poly = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let q = 1; q < pts.length; q++) ctx.lineTo(pts[q].x, pts[q].y);
      ctx.closePath();
    };
    const fillPoly = (pts, style) => { poly(pts); ctx.fillStyle = style; ctx.fill(); };
    const rect = (i0, j0, i1, j1, z) => [P(i0, j0, z), P(i1, j0, z), P(i1, j1, z), P(i0, j1, z)];

    // Heights now: land rises from the house tile outward; the house comes last.
    const top = new Float64Array(plan.N).fill(SEA);
    const up = new Uint8Array(plan.N);
    for (const k of plan.landIds) {
      const g = t >= 1 ? 1 : easeOut((t - plan.delay[k]) / 0.5);
      top[k] = SEA + plan.level[k] * STEP * g;
      up[k] = g > 0.02 ? 1 : 0;
    }
    const houseG = t >= 1 ? 1 : easeOut((t - 0.8) / 0.2);
    const landAt = (i, j) => i >= 0 && j >= 0 && i < n && j < n && up[j * n + i] === 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, geo.W, geo.H);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // --- the plinth, and its soft shadow on the table
    const lo = -MAT, hiE = n + MAT;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(mats.drop.canvas, mats.drop.x, mats.drop.y, mats.drop.w, mats.drop.h);
    ctx.restore();
    fillPoly([P(lo, lo, 0), P(hiE, lo, 0), P(hiE, lo, -PLINTH), P(hiE, hiE, -PLINTH), P(lo, hiE, -PLINTH), P(lo, hiE, 0)], css(theme.matRight));
    fillPoly(rect(lo, lo, hiE, hiE, 0), css(theme.matTop));
    sideFill([P(lo, hiE, 0), P(hiE, hiE, 0), P(hiE, hiE, -PLINTH), P(lo, hiE, -PLINTH)], theme.matLeft, 0.1);
    sideFill([P(hiE, lo, 0), P(hiE, hiE, 0), P(hiE, hiE, -PLINTH), P(hiE, lo, -PLINTH)], theme.matRight, 0.12);
    // A crisp rim where the plinth's top meets its sides.
    ctx.beginPath();
    const r0 = P(lo, hiE, 0), r1 = P(hiE, hiE, 0), r2 = P(hiE, lo, 0);
    ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y);
    ctx.strokeStyle = css(theme.rim, theme.rimA);
    ctx.lineWidth = Math.max(geo.px, s * 0.03);
    ctx.stroke();

    function sideFill(pts, colour, ao) {
      fillPoly(pts, css(colour));
      if (ao > 0) {
        const g = ctx.createLinearGradient(0, pts[0].y, 0, pts[3].y);
        g.addColorStop(0, css(SHADOW_INK, 0));
        g.addColorStop(1, css(SHADOW_INK, ao));
        fillPoly(pts, g);
      }
    }

    // --- the sea: one continuous sheet through the passed colours (land is blocks, water is not).
    // Its cut faces at the board's front edges first, then its surface.
    const F = mats.sea.width, U = F / n;
    const o0 = P(0, 0, SEA), oI = P(n, 0, SEA), oJ = P(0, n, SEA);
    ctx.save();
    ctx.setTransform(0, SEA * s, -C30 * s / U, 0.5 * s / U, oI.x, oI.y);
    ctx.drawImage(mats.sea, F - 1, 0, 1, F, 0, 0, 1, F);
    ctx.setTransform(C30 * s / U, 0.5 * s / U, 0, SEA * s, oJ.x, oJ.y);
    ctx.drawImage(mats.sea, 0, F - 1, F, 1, 0, 0, F, 1);
    ctx.restore();
    fillPoly([P(n, 0, SEA), P(n, n, SEA), P(n, n, 0), P(n, 0, 0)], css(SHADOW_INK, SHADE.right + 0.08));
    fillPoly([P(0, n, SEA), P(n, n, SEA), P(n, n, 0), P(0, n, 0)], css(SHADOW_INK, SHADE.left + 0.08));
    ctx.save();
    ctx.setTransform(C30 * s / U, 0.5 * s / U, -C30 * s / U, 0.5 * s / U, o0.x, o0.y);
    ctx.drawImage(mats.sea, 0, 0);
    ctx.restore();
    const e = 0.6 / s;   // half a pixel of overlap: no seams between tiles
    ctx.save();
    poly(rect(0, 0, n, n, SEA));
    ctx.clip();
    // A soft sheen, brightest toward the light.
    const a0 = P(0, 0, SEA), a1 = P(n, n, SEA);
    const sheen = ctx.createLinearGradient(a0.x - n * C30 * s * 0.5, a0.y, a1.x + n * C30 * s * 0.5, a1.y);
    sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
    sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, css(SHADOW_INK, 0.12));
    fillPoly(rect(0, 0, n, n, SEA), sheen);
    // The board's tiles, faintly, under the water.
    ctx.beginPath();
    for (let q = 1; q < n; q++) {
      let a = P(q, 0, SEA), b = P(q, n, SEA);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      a = P(0, q, SEA); b = P(n, q, SEA);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = Math.max(geo.px * 0.75, s * 0.014);
    ctx.stroke();
    // The coast: a wide soft band of foam, then a bright line hugging the land.
    for (const [d, a] of [[0.3, 0.2], [0.13, 0.55]]) {
      ctx.beginPath();
      for (const k of plan.landIds) {
        if (!up[k]) continue;
        const i = k % n, j = (k - i) / n;
        const q = rect(i - (landAt(i - 1, j) ? 0 : d), j - (landAt(i, j - 1) ? 0 : d),
          i + 1 + (landAt(i + 1, j) ? 0 : d), j + 1 + (landAt(i, j + 1) ? 0 : d), SEA);
        ctx.moveTo(q[0].x, q[0].y);
        for (let m = 1; m < 4; m++) ctx.lineTo(q[m].x, q[m].y);
        ctx.closePath();
      }
      ctx.fillStyle = css(theme.foam, a * theme.foamA);
      ctx.fill('nonzero');
    }
    // Cast shadows of the land on the water, toward the lower right.
    ctx.beginPath();
    for (const k of plan.landIds) {
      if (!up[k]) continue;
      const i = k % n, j = (k - i) / n;
      const len = (top[k] - SEA) * SHADOW_LEN;
      const q = rect(i, j, i + 1 + len, j + 1, SEA);
      ctx.moveTo(q[0].x, q[0].y);
      for (let m = 1; m < 4; m++) ctx.lineTo(q[m].x, q[m].y);
      ctx.closePath();
    }
    ctx.fillStyle = css(SHADOW_INK, 0.12);
    ctx.fill('nonzero');
    // Calm ripples: wave lines around the coast, at two distances from the land.
    if (s >= 5) {
      // The rings change only while land is still rising: kept between frames of a grow.
      const key = up.join('');
      if (mats.ringKey !== key) { mats.ringKey = key; mats.rings = waveRings(plan, up, [0.5, 1.0]); }
      const rings = mats.rings;
      rings.forEach((segs, r) => {
        ctx.beginPath();
        for (let q = 0; q < segs.length; q += 4) {
          const a = P(segs[q], segs[q + 1], SEA), b = P(segs[q + 2], segs[q + 3], SEA);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.strokeStyle = css(theme.foam, (r ? 0.3 : 0.55) * theme.foamA);
        ctx.lineWidth = Math.max(geo.px, s * (r ? 0.022 : 0.03));
        ctx.stroke();
      });
    }
    ctx.restore();
    // The sea's front edge catches the light.
    ctx.beginPath();
    const w0 = P(0, n, SEA), w1 = P(n, n, SEA), w2 = P(n, 0, SEA);
    ctx.moveTo(w0.x, w0.y); ctx.lineTo(w1.x, w1.y); ctx.lineTo(w2.x, w2.y);
    ctx.strokeStyle = css([255, 255, 255], 0.38);
    ctx.lineWidth = Math.max(geo.px, s * 0.022);
    ctx.stroke();

    // --- the land, back to front
    const order = plan.landIds.slice().sort((a, b) => (a % n + Math.floor(a / n)) - (b % n + Math.floor(b / n)) || a - b);
    for (const k of order) {
      if (!up[k]) continue;
      const i = k % n, j = (k - i) / n;
      const zt = top[k];
      const mat = mats.list[plan.region[k]];
      // Plain colours vary a little tile to tile, and higher ground is a touch lighter.
      const base = mat.tex ? mat.colour : mix(mat.colour, plan.jitter[k] > 0 ? [255, 255, 255] : SHADOW_INK, Math.abs(plan.jitter[k]) * 0.06);
      const lift = (plan.level[k] - 1) * 0.035;

      // Side faces, down to whatever stands in front of them (the plinth at the board's edge).
      const below = (bi, bj) => (bi >= n || bj >= n ? 0 : landAt(bi, bj) ? Math.min(zt, top[bj * n + bi]) : SEA);
      const zr = below(i + 1, j), zl = below(i, j + 1);
      if (zl < zt) face('left', i, j, zt, zl, mat, base, landAt(i, j + 1) || j + 1 >= n);
      if (zr < zt) face('right', i, j, zt, zr, mat, base, landAt(i + 1, j) || i + 1 >= n);

      // The top.
      const A = P(i, j, zt), B = P(i + 1, j, zt), D = P(i, j + 1, zt);
      if (mat.tex) {
        ctx.save();
        const S = mat.size, o = (0.6 / s) * S;
        ctx.setTransform((B.x - A.x) / S, (B.y - A.y) / S, (D.x - A.x) / S, (D.y - A.y) / S, A.x, A.y);
        ctx.drawImage(mat.tex, -o, -o, S + 2 * o, S + 2 * o);
        ctx.restore();
        if (lift > 0) fillPoly(rect(i, j, i + 1, j + 1, zt), css([255, 255, 255], lift));
      } else {
        fillPoly(rect(i - e, j - e, i + 1 + e, j + 1 + e, zt), css(mix(base, [255, 255, 255], lift)));
      }
      // Shadow from a taller tile behind, toward the light.
      if (i > 0 && landAt(i - 1, j) && top[k - 1] > zt) {
        const len = Math.min(1, (top[k - 1] - zt) * SHADOW_LEN);
        fillPoly(rect(i, j, i + len, j + 1, zt), css(SHADOW_INK, 0.22));
      }
      // Tile seams, faint; the exposed front edges catch the light.
      poly(rect(i, j, i + 1, j + 1, zt));
      ctx.strokeStyle = css(theme.ink, theme.line);
      ctx.lineWidth = Math.max(geo.px * 0.75, s * 0.016);
      ctx.stroke();
      const C = P(i + 1, j + 1, zt);
      ctx.lineWidth = Math.max(geo.px, s * 0.026);
      if (zl < zt) { ctx.beginPath(); ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke(); }
      if (zr < zt) { ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke(); }

      if (k === plan.houseAt && plan.house && houseG > 0) house(i, j, zt, houseG);
    }

    // A side face of a column: the same material, shaded, darker toward its foot.
    function face(side, i, j, zt, zb, mat, base, onLand) {
      const A = side === 'left' ? P(i, j + 1, zt) : P(i + 1, j, zt);
      const B = P(i + 1, j + 1, zt);
      const hgt = (zt - zb) * s;
      const pts = [A, B, { x: B.x, y: B.y + hgt }, { x: A.x, y: A.y + hgt }];
      const k = SHADE[side];
      if (mat.tex) {
        ctx.save();
        poly(pts);
        ctx.clip();
        const S = mat.size;
        ctx.setTransform((B.x - A.x) / S, (B.y - A.y) / S, 0, s / S, A.x, A.y);
        const rows = Math.ceil(zt - zb + 1e-9);
        for (let r = 0; r < rows; r++) ctx.drawImage(mat.tex, 0, r * S, S, S + 1);
        ctx.restore();
        fillPoly(pts, css(SHADOW_INK, k));
      } else {
        fillPoly(pts, css(shade(base, k)));
      }
      // Ambient occlusion at the foot.
      const g = ctx.createLinearGradient(0, Math.min(A.y, B.y), 0, Math.max(A.y, B.y) + hgt);
      g.addColorStop(0, css(SHADOW_INK, 0));
      g.addColorStop(1, css(SHADOW_INK, onLand ? 0.22 : 0.14));
      fillPoly(pts, g);
      // The waterline: a bright line where the column meets the sea.
      if (!onLand && zb <= SEA + 1e-6) {
        ctx.beginPath();
        ctx.moveTo(pts[3].x, pts[3].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.strokeStyle = css(theme.foam, 0.85 * theme.foamA);
        ctx.lineWidth = Math.max(geo.px, s * 0.035);
        ctx.stroke();
      }
    }

    // A small house in the same isometry: walls, a window, a door, a gabled roof.
    function house(i, j, z0, g) {
      const h = plan.house;
      const { u0, u1, v0, v1, eave } = HOUSE;
      const hw = HOUSE.wall * g, hr = HOUSE.roof * g;
      const vm = (v0 + v1) / 2, zw = z0 + hw, zr = zw + hr;
      const Q = (u, v, z) => P(i + u, j + v, z);
      // Its shadow on the tile, toward the lower right, kept on the tile.
      const len = (hw + hr * 0.5) * SHADOW_LEN;
      fillPoly([Q(u0, v0, z0), Q(Math.min(1, u1 + len), v0, z0), Q(Math.min(1, u1 + len), v1, z0), Q(u0, v1, z0)], css(SHADOW_INK, 0.26));
      // The long wall (lit) with its window, the gable end (in shade) with its door.
      fillPoly([Q(u0, v1, z0), Q(u1, v1, z0), Q(u1, v1, zw), Q(u0, v1, zw)], css(shade(h.wall, SHADE.left * 0.8)));
      fillPoly([Q(u1, v0, z0), Q(u1, v1, z0), Q(u1, v1, zw), Q(u1, vm, zr), Q(u1, v0, zw)], css(shade(h.wall, SHADE.right)));
      if (g > 0.6 && s >= 6) {
        const wz0 = z0 + hw * 0.3, wz1 = z0 + hw * 0.74, wa = 0.36, wb = 0.64, f = 0.035;
        fillPoly([Q(wa, v1, wz0), Q(wb, v1, wz0), Q(wb, v1, wz1), Q(wa, v1, wz1)], css(shade(h.accent, 0.06)));
        const glass = mix(mix(h.wall, SHADOW_INK, 0.55), [170, 190, 230], 0.25);
        fillPoly([Q(wa + f, v1, wz0 + f), Q(wb - f, v1, wz0 + f), Q(wb - f, v1, wz1 - f), Q(wa + f, v1, wz1 - f)], css(glass));
        // A pane of sky in the glass, and the mullion.
        fillPoly([Q(wa + f, v1, wz1 - f), Q(wa + f + (wb - wa) * 0.35, v1, wz1 - f), Q(wa + f, v1, wz1 - f - (wz1 - wz0) * 0.45)], css([255, 255, 255], 0.22));
        const m0 = Q((wa + wb) / 2, v1, wz0 + f), m1 = Q((wa + wb) / 2, v1, wz1 - f);
        ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y);
        ctx.strokeStyle = css(shade(h.accent, 0.06));
        ctx.lineWidth = Math.max(geo.px * 0.75, s * 0.022);
        ctx.stroke();
        const da = vm - 0.1, db = vm + 0.1;
        fillPoly([Q(u1, da, z0), Q(u1, db, z0), Q(u1, db, z0 + hw * 0.62), Q(u1, da, z0 + hw * 0.62)], css(shade(h.accent, SHADE.right)));
      }
      // The roof: the front plane (the back one faces away), its eave reaching past the wall.
      const ze = zw - eave * (hr / (vm - v0));
      fillPoly([Q(u0, vm, zr), Q(u1, vm, zr), Q(u1, v1 + eave, ze), Q(u0, v1 + eave, ze)], css(shade(h.trim, 0.07)));
      // A line of shadow under the eave.
      fillPoly([Q(u0, v1, zw), Q(u1, v1, zw), Q(u1, v1, zw - 0.045 * g), Q(u0, v1, zw - 0.045 * g)], css(SHADOW_INK, 0.28));
      // The verge along the gable, the ridge catching the light.
      ctx.beginPath();
      const p0 = Q(u1, v0 - eave, ze), p1 = Q(u1, vm, zr), p2 = Q(u1, v1 + eave, ze);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = css(shade(h.trim, 0.3));
      ctx.lineWidth = Math.max(geo.px, s * 0.045);
      ctx.stroke();
      ctx.beginPath();
      const q0 = Q(u0, vm, zr), q1 = Q(u1, vm, zr);
      ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
      ctx.strokeStyle = css(mix(h.trim, [255, 255, 255], 0.35));
      ctx.lineWidth = Math.max(geo.px * 0.75, s * 0.024);
      ctx.stroke();
      ctx.beginPath();
      const e0 = Q(u0, v1 + eave, ze), e1 = Q(u1, v1 + eave, ze);
      ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y);
      ctx.strokeStyle = css(shade(h.trim, 0.25));
      ctx.lineWidth = Math.max(geo.px * 0.75, s * 0.02);
      ctx.stroke();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------------------------------------------------------------- words

  const plural = (k, one, many) => k + ' ' + (k === 1 ? one : many);

  function describe(plan, surfacesDrawn, house) {
    const land = plan.landIds.length, water = plan.waterIds.length;
    const keptUsed = new Set(plan.regions.filter((r, q) => plan.landIds.some((k) => plan.region[k] === q))
      .map((r) => (r.tint ? hexOf(r.tint) : null)).filter(Boolean)).size;
    const out = ['An island on a plinth.'];
    let l = 'Land: ' + plural(land, 'tile', 'tiles');
    if (surfacesDrawn) {
      l += ' from ' + (surfacesDrawn < plan.surfaces.length ? surfacesDrawn + ' of the ' + plan.surfaces.length : surfacesDrawn) +
        ' ' + (surfacesDrawn === 1 && plan.surfaces.length === 1 ? 'surface' : 'surfaces') + ' you kept';
      if (keptUsed) l += ', tinted with ' + plural(keptUsed, 'colour', 'colours') + ' you kept';
    } else if (keptUsed) {
      l += ' in ' + plural(keptUsed, 'colour', 'colours') + ' you kept';
    } else {
      l += ' of plain ground';
    }
    out.push(l + '.');
    if (water) {
      if (plan.seaDefault) out.push('Water: ' + plural(water, 'tile', 'tiles') + ' of plain deep water.');
      else {
        const used = new Set(plan.waterIds.map((k) => plan.band[k])).size;
        out.push('Water: ' + plural(water, 'tile', 'tiles') + ' in ' + plural(used, 'colour', 'colours') + ' you passed.');
      }
    }
    if (house) {
      out.push('A house in ' + colourName(plan.house.wallHex) + ' with ' + article(colourName(plan.house.trimHex)) +
        ' roof, on the highest ground.');
    }
    return out.join(' ');
  }

  const article = (w) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;

  // ---------------------------------------------------------------- the grow, and stopping it

  const live = new Set();          // running grows: {canvas, finish, cancel}
  const tokens = new WeakMap();    // canvas -> the latest render's number

  function reducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  const clock = () => (root.performance && typeof root.performance.now === 'function' ? root.performance.now() : Date.now());

  function grow(canvas, draw) {
    return new Promise((resolve) => {
      const raf = typeof root.requestAnimationFrame === 'function' ? root.requestAnimationFrame.bind(root) : (f) => setTimeout(() => f(clock()), 16);
      const caf = typeof root.cancelAnimationFrame === 'function' ? root.cancelAnimationFrame.bind(root) : clearTimeout;
      const t0 = clock();
      let handle = 0, ended = false;
      const end = (last) => {
        if (ended) return;
        ended = true;
        caf(handle);
        clearTimeout(safety);
        live.delete(anim);
        if (last) draw(1);
        resolve();
      };
      const anim = { canvas, finish: () => end(true), cancel: () => end(false) };
      // Frames do not run in a hidden tab: finish anyway.
      const safety = setTimeout(() => end(true), GROW_MS + 2500);
      const frame = () => {
        if (ended) return;
        const t = (clock() - t0) / GROW_MS;
        if (t >= 1) { end(true); return; }
        draw(t);
        handle = raf(frame);
      };
      live.add(anim);
      draw(0);
      handle = raf(frame);
    });
  }

  // ---------------------------------------------------------------- the API

  async function render(canvas, spec) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('FiveSGround.render needs a canvas');
    spec = spec && typeof spec === 'object' ? spec : {};
    const rand = guard(typeof spec.rand === 'function' ? spec.rand : mulberry32(0x5e5d));
    const plan = makePlan(spec, rand);
    const token = (tokens.get(canvas) || 0) + 1;
    tokens.set(canvas, token);
    for (const a of Array.from(live)) if (a.canvas === canvas) a.cancel();

    const images = await Promise.all(plan.surfaces.map((x) => loadImage(x.src)));
    // The counts and the words describe the ground as planned (so they hold even for a canvas too
    // small to draw on); "surfaces you kept" counts only surfaces whose image is drawn.
    const hasHouse = !!(plan.house && plan.houseAt >= 0);
    const result = (surfacesDrawn) => ({
      land: plan.landIds.length,
      water: plan.waterIds.length,
      house: hasHouse,
      description: describe(plan, surfacesDrawn, hasHouse),
    });
    const loaded = new Set(plan.regions.filter((r) => r.surface >= 0 && images[r.surface]).map((r) => r.surface)).size;
    if (tokens.get(canvas) !== token) return result(loaded);   // superseded by a later render
    const geo = fit(canvas, plan);
    const ctx = canvas.getContext('2d');
    if (!ctx || geo.W < MIN_PX || geo.H < MIN_PX) {
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return result(loaded);
    }
    const mats = makeMaterials(plan, images, geo);
    const draw = (t) => scene(ctx, geo, plan, mats, t);
    if (spec.grow === true && !reducedMotion()) await grow(canvas, draw);
    else draw(1);
    return result(mats.surfacesDrawn);
  }

  function stop() {
    for (const a of Array.from(live)) a.finish();
  }

  root.FiveSGround = Object.freeze({ render, stop });
})(typeof window !== 'undefined' ? window : globalThis);

// ---- DIRT Earth, closer: the streets -----------------------------------------------------------------------
// Below the ground of DIRT Earth (a cell is a quarter degree over 233, about 120 metres), the Earth goes on down
// to the streets: every building standing at its own height, every road, park, river and monument, drawn from
// OpenStreetMap in DIRT's own language rather than as a map. The ground is the place's own palette (the paintings
// nearest its colours this month), laid as dots; each building takes one artist's shade, from dark to light, as the
// plane's areas do, and is raised by its height, lit from the light that turns once in 377 seconds, and casts its
// shadow; and no edge is a line: every edge is a grey gradient, the whole scale from dark to light across it.
//
// The streets come as vector tiles from OpenFreeMap (OpenStreetMap, in the OpenMapTiles schema), fetched by the
// page as they are needed. On a page that may not fetch from elsewhere (as a claude.ai artifact may not), the
// streets say so and the ground stays as it is. window.DIRT_CITY_TILES, if set, is a template
// ("…/{z}/{x}/{y}.pbf") to take them from instead.

const CITY_SRC = "https://tiles.openfreemap.org/planet";
const CITY_CREDIT = "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors";
const MERC = 20037508.342789244;                                     // half the world, in Web Mercator metres
const CITY = { on: false, lat: 0, lon: 0, mx: 0, my: 0, mpp: 60, tmpl: null, tmplP: null, tiles: new Map(), dirty: true, drawnAt: -1e9,
               err: "", pal: null, water: null, fromMpp: 60 };
const mercX = (lon) => (lon * MERC) / 180;
const mercY = (lat) => { const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180); return (Math.log((1 + s) / (1 - s)) / 2) * (MERC / Math.PI); };
const latOfMerc = (y) => ((2 * Math.atan(Math.exp((y * Math.PI) / MERC)) - Math.PI / 2) * 180) / Math.PI;
const lonOfMerc = (x) => (x * 180) / MERC;

/** A Mapbox vector tile (protocol buffers), decoded: its layers by name, each with its features' properties and rings. */
function mvtDecode(buf) {
  const b = new Uint8Array(buf), dv = new DataView(buf), td = new TextDecoder();
  let p = 0;
  const vint = () => { let r = 0, m = 1, c; do { c = b[p++]; r += (c & 127) * m; m *= 128; } while (c & 128); return r; };
  const zz = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);
  const str = (e) => { const s = td.decode(b.subarray(p, e)); p = e; return s; };
  const skip = (w) => { if (w === 0) vint(); else if (w === 1) p += 8; else if (w === 2) { const n = vint(); p += n; } else if (w === 5) p += 4; };
  function value(end) {
    let v = null;
    while (p < end) {
      const t = vint(), f = t >> 3;
      if (f === 1) { const n = vint(); v = str(p + n); }
      else if (f === 2) { v = dv.getFloat32(p, true); p += 4; }
      else if (f === 3) { v = dv.getFloat64(p, true); p += 8; }
      else if (f === 4 || f === 5) v = vint();
      else if (f === 6) v = zz(vint());
      else if (f === 7) v = !!vint();
      else skip(t & 7);
    }
    return v;
  }
  function feature(end, L) {
    const F = { type: 0, props: {}, rings: [] };
    while (p < end) {
      const t = vint(), f = t >> 3;
      if (f === 2) { const e = vint() + p; while (p < e) { const k = vint(), v = vint(); F.props[L.keys[k]] = L.vals[v]; } }
      else if (f === 3) F.type = vint();
      else if (f === 4) {
        const e = vint() + p;
        let x = 0, y = 0, ring = null;
        while (p < e) {
          const c = vint(), id = c & 7, n = c >> 3;
          if (id === 7) continue;                                    // close path: the ring closes itself when drawn
          for (let i = 0; i < n; i++) {
            x += zz(vint()); y += zz(vint());
            if (id === 1) { ring = []; F.rings.push(ring); }
            ring.push(x, y);
          }
        }
      } else skip(t & 7);
    }
    return F;
  }
  function layer(end) {
    const L = { name: "", extent: 4096, keys: [], vals: [], features: [] }, spans = [];
    while (p < end) {
      const t = vint(), f = t >> 3;
      if (f === 1) { const n = vint(); L.name = str(p + n); }
      else if (f === 2) { const n = vint(); spans.push([p, p + n]); p += n; }
      else if (f === 3) { const n = vint(); L.keys.push(str(p + n)); }
      else if (f === 4) { const n = vint(); L.vals.push(value(p + n)); }
      else if (f === 5) L.extent = vint();
      else skip(t & 7);
    }
    const q = p;
    for (const [s, e] of spans) { p = s; L.features.push(feature(e, L)); }
    p = q;
    return L;
  }
  const layers = {};
  while (p < b.length) {
    const t = vint();
    if (t >> 3 === 3 && (t & 7) === 2) { const n = vint(), L = layer(p + n); layers[L.name] = L; }
    else skip(t & 7);
  }
  return layers;
}

// ---- the tiles -------------------------------------------------------------------------------------------------
function cityTemplate() {
  if (typeof window !== "undefined" && window.DIRT_CITY_TILES) return Promise.resolve(window.DIRT_CITY_TILES);
  return (CITY.tmplP ||= fetch(CITY_SRC).then((r) => { if (!r.ok) throw new Error("the streets' index: " + r.status); return r.json(); })
    .then((j) => j.tiles[0]));
}
const TILE_CAP = 144;
/** The tile z/x/y: decoded, or loading (null), or failed (false). */
function cityTile(z, x, y) {
  const k = z + "/" + x + "/" + y;
  let t = CITY.tiles.get(k);
  if (t) { CITY.tiles.delete(k); CITY.tiles.set(k, t); return t.layers; }
  t = { layers: null };
  CITY.tiles.set(k, t);
  if (CITY.tiles.size > TILE_CAP) CITY.tiles.delete(CITY.tiles.keys().next().value);
  cityTemplate()
    .then((tmpl) => fetch(tmpl.replace("{z}", z).replace("{x}", x).replace("{y}", y)))
    .then((r) => { if (r.status === 204 || r.status === 404) return null; if (!r.ok) throw new Error("a street tile: " + r.status); return r.arrayBuffer(); })
    .then((buf) => { t.layers = buf && buf.byteLength ? mvtDecode(buf) : {}; CITY.dirty = true; CITY.err = ""; })
    .catch((e) => { t.layers = false; CITY.err = e.message || String(e); CITY.dirty = true; });
  return null;
}

// ---- where, and how near -----------------------------------------------------------------------------------
/** Go down to the streets at (lat, lon), at mpp metres a device pixel. */
function cityGo(lat, lon, mpp) {
  CITY.lat = lat; CITY.lon = lon; CITY.mx = mercX(lon); CITY.my = mercY(lat); CITY.mpp = mpp;
  CITY.pal = cityPalette(lat, lon); CITY.dirty = true;
}
/** Device pixels a Mercator metre, here. */
const cityK = () => Math.cos((CITY.lat * Math.PI) / 180) / CITY.mpp;
const CITY_NEAREST = 0.12, CITY_FAR_Z = 11;
/** Nearer or further by f about the device pixel (px, py). */
function cityZoom(f, px, py, W, H) {
  const k0 = cityK(), ax = CITY.mx + (px - W / 2) / k0, ay = CITY.my - (py - H / 2) / k0;
  CITY.mpp = Math.max(CITY_NEAREST, CITY.mpp / f);
  const k1 = cityK();
  CITY.mx = ax - (px - W / 2) / k1; CITY.my = ay + (py - H / 2) / k1;
  CITY.lat = latOfMerc(CITY.my); CITY.lon = lonOfMerc(CITY.mx);
  CITY.dirty = true;
}
function cityPan(dx, dy) {
  const k = cityK();
  CITY.mx -= dx / k; CITY.my += dy / k;
  CITY.lat = latOfMerc(CITY.my); CITY.lon = lonOfMerc(CITY.mx);
  CITY.dirty = true;
}

// ---- the colours: the place's own ----------------------------------------------------------------------------
/** The five stops of the palette a place wears this month (DIRT Earth's), and the water's, dark to light. */
function cityPalette(lat, lon) {
  const grey = [[40, 38, 36], [80, 76, 70], [140, 134, 124], [200, 194, 182], [236, 232, 222]];
  if (typeof EARTH === "undefined" || !EARTH || typeof eSite !== "function") return { land: grey, water: grey.map((c) => [c[0] * 0.8, c[1] * 0.9, c[2]]) };
  const x = xOfLon(lon), y = yOfLat(lat), pr = eSite(x, y, {}, true), E = EARTH;
  let key;
  if (pr.surf === SEA || pr.surf === LAKE) key = lookKey(E.lookIdx.lake, -1, 0);
  else if (pr.snow > 0.5 || pr.surf === 15) key = lookKey(E.lookIdx.snow, -1, 0);
  else { const B = E.biome[pr.surf]; key = lookKey(B.look[pr.phase], pr.soil, pr.bare); }
  const land = eLookPalettes(key)[0].stops, water = eLookPalettes(lookKey(E.lookIdx.lake, -1, 0))[0].stops;
  return { land, water };
}
const rgb = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
/** The colour at t (0 dark to 1 light) along five stops. */
function stopAt(st, t) {
  const f = Math.max(0, Math.min(3.999, t * 4)), n = Math.floor(f), u = f - n, a = st[n], b = st[n + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}
const grey = (v, a) => rgba3(10 + 235 * v, a);
const rgba3 = (g, a) => `rgba(${g | 0},${(g * 0.994) | 0},${(g * 0.985) | 0},${a})`;

// The ground's dots: a tile of them in the place's palette, laid under everything, a dot to 2 device pixels.
let cityDots = null, cityDotsKey = "";
function dotPattern(g, st) {
  const key = st.map((c) => c.join()).join("|");
  if (cityDots && cityDotsKey === key) return g.createPattern(cityDots, "repeat");
  const n = 144, c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d"), img = x.createImageData(n, n);
  for (let j = 0; j < n; j += 2) for (let i = 0; i < n; i += 2) {
    const h = h3(i, j, 3571), t = 0.22 + 0.5 * ((h >>> 8) / 16777216) + 0.18 * (vnoise(i, j, 13, 3573) - 0.5) * 2;
    const col = stopAt(st, t), on = (h & 7) !== 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const o = ((j + dy) * n + i + dx) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = on ? 255 : 0;
    }
  }
  x.putImageData(img, 0, 0);
  cityDots = c; cityDotsKey = key;
  return g.createPattern(c, "repeat");
}

// ---- drawing -----------------------------------------------------------------------------------------------
const ROAD_M = { motorway: 22, trunk: 18, primary: 15, secondary: 12, tertiary: 10, minor: 7, service: 4, track: 3, path: 2, rail: 3, transit: 3 };
const GREEN = new Set(["grass", "wood", "park", "wetland", "farmland", "garden", "cemetery", "pitch", "golf_course", "recreation_ground", "nature_reserve", "national_park"]);
const MARKED = new Set(["attraction", "monument", "memorial", "museum", "castle", "place_of_worship", "town_hall", "theatre", "stadium", "art_gallery", "viewpoint", "zoo"]);

/** Every edge a grey gradient: the path stroked three times, dark and wide to light and fine, so the whole scale lies across it. */
function gradientEdge(g, w) {
  g.lineJoin = "round";
  g.strokeStyle = grey(0.08, 0.34); g.lineWidth = w * 3; g.stroke();
  g.strokeStyle = grey(0.45, 0.4); g.lineWidth = w * 1.8; g.stroke();
  g.strokeStyle = grey(0.92, 0.55); g.lineWidth = w * 0.7; g.stroke();
}

/** The streets at this moment, onto g (W by H device pixels). */
function drawStreets(g, W, H, now) {
  if (!CITY.dirty && now - CITY.drawnAt < 250) return;
  CITY.dirty = false; CITY.drawnAt = now;
  const pal = CITY.pal || (CITY.pal = cityPalette(CITY.lat, CITY.lon)), st = pal.land;
  const k = cityK(), cx = W / 2, cy = H / 2;
  const SX = (mx) => cx + (mx - CITY.mx) * k, SY = (my) => cy - (my - CITY.my) * k;
  // the ground: the place's palette, dotted
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  // Near the ground's own scale the ground of DIRT Earth shows through (drawn under this, magnified), and the
  // streets' own ground comes up over it as they come nearer.
  const s0 = CITY.fromMpp / CITY.mpp, veil = Math.min(1, Math.max(0, (s0 - PHI) / (PHI ** 4 - PHI)));
  CITY.veil = veil;
  g.globalAlpha = veil; g.fillStyle = rgb(stopAt(st, 0.42)); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  if (CITY.mpp < 8) {
    const pat = dotPattern(g, st);
    pat.setTransform(new DOMMatrix().translate(SX(0) % 144, SY(0) % 144));
    g.globalAlpha = 0.55 * veil; g.fillStyle = pat; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  }
  // which tiles: as fine as a tile of 512 device pixels, never finer than z14 (the finest there is)
  const zf = Math.log2((2 * MERC * k) / 512), z = Math.max(0, Math.min(14, Math.round(zf))), n = 2 ** z, T = (2 * MERC) / n;
  const x0 = Math.floor((CITY.mx - cx / k + MERC) / T), x1 = Math.floor((CITY.mx + cx / k + MERC) / T);
  const y0 = Math.floor((MERC - (CITY.my + cy / k)) / T), y1 = Math.floor((MERC - (CITY.my - cy / k)) / T);
  const got = [];
  let missing = 0;
  for (let ty = Math.max(0, y0 - 1); ty <= Math.min(n - 1, y1 + 1); ty++) for (let tx = x0 - 1; tx <= x1 + 1; tx++) {
    const L = cityTile(z, ((tx % n) + n) % n, ty);
    if (L) got.push({ L, ox: tx * T - MERC, oy: MERC - ty * T, T });
    else if (L === null) missing++;
  }
  // a tile's point (tx, ty in its extent) on the screen
  const place = (t, e) => { const s = (t.T / e) * k; return [cx + (t.ox - CITY.mx) * k, cy - (t.oy - CITY.my) * k, s]; };
  const path = (t, L, F, closeRings) => {
    const [ox, oy, s] = place(t, L.extent);
    g.beginPath();
    for (const r of F.rings) {
      g.moveTo(ox + r[0] * s, oy + r[1] * s);
      for (let i = 2; i < r.length; i += 2) g.lineTo(ox + r[i] * s, oy + r[i + 1] * s);
      if (closeRings) g.closePath();
    }
  };
  const each = (name, fn) => { for (const t of got) { const L = t.L[name]; if (L) for (const F of L.features) fn(t, L, F); } };
  const px1 = Math.max(0.7, 1 / CITY.mpp);                          // a metre, in device pixels (at least a hair)
  // land cover and use: green things in the palette's dark body, the rest in its light
  for (const name of ["landcover", "landuse", "park"]) each(name, (t, L, F) => {
    if (F.type !== 3) return;
    const cl = F.props.class || F.props.subclass || "";
    path(t, L, F, true);
    g.fillStyle = rgb(stopAt(st, GREEN.has(cl) ? 0.5 : cl === "sand" || cl === "ice" ? 0.86 : 0.62), 0.45 * (0.3 + 0.7 * veil));
    g.fill("evenodd");
  });
  // water, with its edge a gradient
  each("water", (t, L, F) => {
    if (F.type !== 3) return;
    path(t, L, F, true);
    g.fillStyle = rgb(stopAt(pal.water, 0.3)); g.fill("evenodd");
    if (CITY.mpp < 20) gradientEdge(g, Math.max(0.6, 1.5 * px1));
  });
  each("waterway", (t, L, F) => {
    if (F.type !== 2) return;
    path(t, L, F, false);
    g.strokeStyle = rgb(stopAt(pal.water, 0.3)); g.lineWidth = Math.max(0.8, (F.props.class === "river" ? 21 : 5) * px1); g.stroke();
  });
  // roads: the paper's light, each edged in the gradient, widest first
  const roads = [];
  each("transportation", (t, L, F) => { if (F.type === 2) roads.push([ROAD_M[F.props.class] || 5, t, L, F]); });
  roads.sort((a, b) => a[0] - b[0]);
  for (const [m, t, L, F] of roads) {
    path(t, L, F, false);
    const w = Math.max(0.6, m * px1);
    if (w > 2.5) { g.strokeStyle = grey(0.1, 0.35); g.lineWidth = w + 3; g.lineCap = "round"; g.stroke(); g.strokeStyle = grey(0.5, 0.45); g.lineWidth = w + 1.5; g.stroke(); }
    g.strokeStyle = rgb(F.props.class === "rail" || F.props.class === "transit" ? stopAt(st, 0.12) : stopAt(st, 0.97)); g.lineWidth = w; g.lineCap = "round";
    if (F.props.class === "path" || F.props.class === "track") g.setLineDash([w * 2, w * 2]);
    g.stroke(); g.setLineDash([]);
  }
  // buildings: raised by their height, lit by the turning light, casting shadows; each in one artist's shade
  const la = ((now / 1000) * 2 * Math.PI) / 377 + 2.2, lx = Math.cos(la), ly = Math.sin(la);
  const up = 0.5 * k;                                               // how far up a metre of height stands on the screen
  const blds = [];
  each("building", (t, L, F) => {
    if (F.type !== 3 || F.props.hide_3d) return;
    const [ox, oy, s] = place(t, L.extent), r = F.rings[0];
    if (!r || r.length < 6) return;
    let sx = 0, sy = 0;
    for (let i = 0; i < r.length; i += 2) { sx += r[i]; sy += r[i + 1]; }
    const h = Math.max(3, +F.props.render_height || 8), h0 = +F.props.render_min_height || 0, n2 = r.length / 2;
    blds.push({ ox, oy, s, rings: F.rings, h, h0, base: oy + (sy / n2) * s, id: h3(Math.round(ox + (sx / n2) * s), Math.round(oy + (sy / n2) * s), 4789) });
  });
  if (blds.length) {
    // shadows first, all at once
    g.fillStyle = grey(0.02, 0.34);
    g.beginPath();
    for (const B of blds) {
      const dx = -lx * B.h * up * 0.9, dy = -ly * B.h * up * 0.9, r = B.rings[0];
      for (let i = 0; i < r.length; i += 2) { const X = B.ox + r[i] * B.s, Y = B.oy + r[i + 1] * B.s; if (i) g.lineTo(X + dx, Y + dy); else g.moveTo(X + dx, Y + dy); }
      g.closePath();
    }
    g.fill();
    blds.sort((a, b) => a.base - b.base);                            // the far ones first
    for (const B of blds) {
      const u = (B.id >>> 8) / 16777216, shade = u < 0.5 ? 0.04 + 0.3 * u : 0.66 + 0.34 * u, roof = stopAt(st, shade), lift = B.h * up, lift0 = B.h0 * up, r = B.rings[0];
      // walls: each face lit by how it faces the light
      if (lift > 1.2) for (let i = 0; i < r.length; i += 2) {
        const j = (i + 2) % r.length, X0 = B.ox + r[i] * B.s, Y0 = B.oy + r[i + 1] * B.s, X1 = B.ox + r[j] * B.s, Y1 = B.oy + r[j + 1] * B.s;
        const ex = X1 - X0, ey = Y1 - Y0, el = Math.hypot(ex, ey) || 1, nx = ey / el, ny = -ex / el;
        if (ny <= 0) continue;                                         // a face turned away from us
        const lit = 0.35 + 0.65 * Math.max(0, nx * lx + ny * ly);     // (lx, ly): toward the light
        g.beginPath(); g.moveTo(X0, Y0 - lift0); g.lineTo(X1, Y1 - lift0); g.lineTo(X1, Y1 - lift); g.lineTo(X0, Y0 - lift); g.closePath();
        g.fillStyle = rgb(roof.map((v) => v * lit)); g.fill();
      }
      g.beginPath();
      for (const rr of B.rings) {
        for (let i = 0; i < rr.length; i += 2) { const X = B.ox + rr[i] * B.s, Y = B.oy + rr[i + 1] * B.s - lift; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }
        g.closePath();
      }
      g.fillStyle = rgb(roof); g.fill("evenodd");
      if (CITY.mpp < 3) gradientEdge(g, Math.max(0.5, Math.min(2.5, 0.8 / CITY.mpp)));
    }
  }
  // the names of the places people go to see, and of the town
  g.textAlign = "center"; g.textBaseline = "middle";
  const fs = Math.round(13 * (window.devicePixelRatio || 1));
  if (CITY.mpp < 6) each("poi", (t, L, F) => {
    const nm = F.props["name:en"] || F.props.name, cl = F.props.class, sub = F.props.subclass;
    if (!nm || !(MARKED.has(cl) || MARKED.has(sub)) || (F.props.rank > 20 && CITY.mpp > 1.5)) return;
    const [ox, oy, s] = place(t, L.extent), X = ox + F.rings[0][0] * s, Y = oy + F.rings[0][1] * s;
    if (X < 0 || Y < 0 || X > W || Y > H) return;
    g.font = `italic ${fs}px Newsreader, Georgia, serif`;
    g.lineWidth = 4; g.strokeStyle = grey(0.1, 0.6); g.strokeText(nm, X, Y - 10);
    g.fillStyle = grey(0.96, 1); g.fillText(nm, X, Y - 10);
  });
  if (CITY.mpp >= 6) each("place", (t, L, F) => {
    const nm = F.props["name:en"] || F.props.name;
    if (!nm) return;
    const [ox, oy, s] = place(t, L.extent), X = ox + F.rings[0][0] * s, Y = oy + F.rings[0][1] * s;
    g.font = `italic ${Math.round(fs * 1.3)}px Newsreader, Georgia, serif`;
    g.lineWidth = 4; g.strokeStyle = grey(0.1, 0.6); g.strokeText(nm, X, Y);
    g.fillStyle = grey(0.96, 1); g.fillText(nm, X, Y);
  });
  // the credit, and what is still on its way
  g.font = `${Math.round(fs * 0.8)}px ui-monospace, Menlo, monospace`; g.textAlign = "right"; g.textBaseline = "bottom";
  g.fillStyle = grey(0.1, 0.55); g.fillRect(W - g.measureText(CITY_CREDIT).width - 16, H - fs - 8, g.measureText(CITY_CREDIT).width + 16, fs + 8);
  g.fillStyle = grey(0.95, 0.9); g.fillText(CITY_CREDIT, W - 8, H - 4);
  if (missing) CITY.dirty = true;                                   // draw again when they come
  CITY.missing = missing;
}

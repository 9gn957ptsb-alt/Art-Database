// ---- DIRT Earth on the page ------------------------------------------------------------------------------
// The plane can become the Earth. "Earth" opens a globe woven of dots, each place's dots in the paintings
// nearest its look for the month; pointing names the place, and clicking goes down into it. There the
// plane is the Earth: swiping crosses it, every place grows its own plants and ground and life from the
// atlas and the grammar, the month's weather passes over, and pointing tells everything the atlas knows
// about the place and names what lives there. The months turn by hand or by themselves.

const E_URL = "earth/";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let MODE = "plane", EM = new Date().getMonth(), EDATA = null, ELOAD = null, SPECIES = [];
const earthOn = () => MODE === "earth";

// ---- the atlas, from the files beside the page ----------------------------------------------------------
function earthImage(n) {
  return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("missing " + n)); i.src = E_URL + n; });
}
function rgbaOf(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height).data;
}
async function earthLoad() {
  const meta = await (await fetch(E_URL + "meta.json")).json();
  const stat = ["place", "class", "ground", "water", "sky", "names", "view", "relief", "wind"];
  const monthly = ["temp", "rain", "cloud", "cloudtype", "snow"];
  const imgs = await Promise.all([...stat.map((n) => earthImage(n + ".png")), ...monthly.flatMap((n) => [0, 1, 2, 3].map((q) => earthImage(`${n}-${q}.png`)))]);
  const px = imgs.map(rgbaOf), [place, cls, ground, water, sky, names, view, relief, wind] = px, n = AW * AH, n2 = MW * MH;
  const U8 = () => new Uint8Array(n);
  const D = { meta, eco: new Uint16Array(n), surf: U8(), koppen: U8(), hold: U8(), realm: U8(), soil: U8(), canopy: U8(), arid: U8(), wbits: U8(), marine: U8(),
              aod: U8(), clear: U8(), region: new Uint16Array(n), seaName: U8(), view: U8(), bigsky: U8(), elev: new Int16Array(n), reliefC: U8(),
              U: new Float32Array(n2), V: new Float32Array(n2) };
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    D.eco[i] = place[j] + 256 * place[j + 1]; D.surf[i] = place[j + 2];
    D.koppen[i] = cls[j]; D.hold[i] = cls[j + 1]; D.realm[i] = cls[j + 2];
    D.soil[i] = ground[j]; D.canopy[i] = ground[j + 1]; D.arid[i] = ground[j + 2];
    D.wbits[i] = water[j]; D.marine[i] = (water[j + 1] === 255 ? 15 : water[j + 1] & 15) | ((water[j + 2] & 15) << 4);
    D.aod[i] = sky[j]; D.clear[i] = sky[j + 1];
    D.region[i] = names[j] + 256 * names[j + 2]; D.seaName[i] = names[j + 1];
    D.view[i] = view[j]; D.bigsky[i] = view[j + 2];
    D.elev[i] = relief[j] + 256 * relief[j + 1] - 11000; D.reliefC[i] = relief[j + 2];
  }
  for (let i = 0; i < n2; i++) { D.U[i] = (wind[i * 4] / 255) * 30 - 15; D.V[i] = (wind[i * 4 + 1] / 255) * 30 - 15; }
  const q = (v, m) => { const im = px[9 + v * 4 + Math.floor(m / 3)], a = new Uint8Array(n2); for (let i = 0; i < n2; i++) a[i] = im[i * 4 + (m % 3)]; return a; };
  D.mT = MONTHS.map((_, m) => q(0, m)); D.mP = MONTHS.map((_, m) => q(1, m)); D.mC = MONTHS.map((_, m) => q(2, m));
  D.mK = MONTHS.map((_, m) => q(3, m)); D.mS = MONTHS.map((_, m) => q(4, m));
  D.Pm = new Float32Array(n2);
  for (let i = 0; i < n2; i++) { let s = 0; for (let m = 0; m < 12; m++) s += rainOf(D.mP[m][i]); D.Pm[i] = s / 12; }
  SPECIES = meta.grammar.species;
  return D;
}
/** The month's conditions, decoded, for the page and the workers. */
function monthData(m) {
  const D = EDATA, n2 = MW * MH, mp = (m + 11) % 12, mn = (m + 1) % 12;
  const T = new Float32Array(n2), Tp = new Float32Array(n2), P = new Float32Array(n2), Pn = new Float32Array(n2), SN = new Float32Array(n2);
  for (let i = 0; i < n2; i++) {
    T[i] = tempOf(D.mT[m][i]); Tp[i] = tempOf(D.mT[mp][i]); P[i] = rainOf(D.mP[m][i]); Pn[i] = rainOf(D.mP[mn][i]); SN[i] = D.mS[m][i] / 255;
  }
  return { m, T, Tp, P, Pn, Pm: D.Pm, SN };
}
/** What the workers need of the atlas. */
function earthPayload() {
  const D = EDATA;
  return { grammar: D.meta.grammar, realms: D.meta.realms, soils: D.meta.soils, marineList: D.meta.marine,
           surf: D.surf, soil: D.soil, realm: D.realm, canopy: D.canopy, arid: D.arid, wbits: D.wbits, marine: D.marine,
           elev: D.elev, reliefC: D.reliefC, U: D.U, V: D.V };
}
const allReady = () => new Promise((ok) => { const f = () => (workers.every((w) => w.ready) ? ok() : setTimeout(f, 55)); f(); });

// ---- going to the Earth, the globe, and back to the plane ----------------------------------------------
function clearGround() {
  for (const c of chunks.values()) if (c.spawned) { despawn(c); despawnLife(c); }
  chunks.clear(); asked.clear();
  nb = 0;
  for (const k of LIFE_ORDER) LIFE[k].list = [];
  if (trailPx) trailPx.fill(0);
  selWork = null; showAll.hidden = true;
  for (const e of Object.values(WEATHER)) if (e.reset) e.reset();
}
async function earthReady() {
  if (EDATA) return;
  placeText("<span class=pl-name>The Earth is coming</span><div class=pl-line>the atlas and its months, from the files beside this page</div>");
  EDATA = await (ELOAD ||= earthLoad());
  earthSetup(earthPayload());
  earthMonth(monthData(EM));
  await allReady();
  const payload = earthPayload(), month = monthData(EM);
  for (const wk of workers) wk.w.postMessage({ type: "earth", earth: payload, month });
}
async function toEarth(lat, lon, month) {
  try { await earthReady(); } catch (err) { placeText(`<span class=pl-name>The Earth could not be found</span><div class=pl-line>${err.message}</div>`); return; }
  if (month !== undefined) EM = mod(month, 12);
  const d = monthData(EM);
  earthMonth(d);
  for (const wk of workers) wk.w.postMessage({ type: "earth", earth: null, month: d });
  VIEWCACHE.clear();
  MODE = "earth";
  clearGround();
  vx = xOfLon(lon) - VW / 2; vy = yOfLat(lat) - VH / 2; velX = velY = 0;
  showMode();
}
function toPlane() {
  for (const wk of workers) wk.w.postMessage({ type: "plane" });
  MODE = "plane";
  clearGround();
  const c = isle(0, 0);
  vx = c.x - VW / 2; vy = c.y - VH / 2; velX = velY = 0;
  showMode();
}
async function toGlobe() {
  try { await earthReady(); } catch (err) { placeText(`<span class=pl-name>The Earth could not be found</span><div class=pl-line>${err.message}</div>`); return; }
  if (MODE === "earth") { GLOBE.lat0 = Math.max(-1.3, Math.min(1.3, (latOfY(vy + VH / 2) * Math.PI) / 180)); GLOBE.lon0 = (lonOfX(vx + VW / 2) * Math.PI) / 180; }
  MODE = "globe";
  globeColours();
  showMode();
}
/** Turn the month: the page's own conditions at once, the workers' too, and every chunk grows again in turn. */
function setMonth(m, quiet) {
  EM = mod(m, 12);
  if (!EDATA) { showMode(); return; }
  const d = monthData(EM);
  earthMonth(d);
  for (const wk of workers) wk.w.postMessage({ type: "month", data: d });
  if (MODE === "globe") globeColours();
  VIEWCACHE.clear();
  if (!quiet) showMode();
}

// A chunk is kept only if it was grown for what is on now: the plane, or the Earth in this month.
chunkWanted = (m) => (MODE === "earth" ? m.month === EM : MODE === "plane" ? m.month === undefined : false);
chunkStale = (c) => MODE === "earth" && c.month !== EM;

// ---- the Earth's crowns, for creatures that live in them -------------------------------------------------
// The workers send each chunk's taller crowns (the canopy and above), so the page never works out a crown.
function tallCrowns(c) {
  if (!c.tallList) {
    const t = c.tall, out = [];
    for (let o = 0; t && o < t.length; o += 11)
      out.push({ x: t[o], y: t[o + 1], r: t[o + 2], top: t[o + 3], L: t[o + 4], shape: t[o + 5], c5: t[o + 6], s5: t[o + 7], c8: t[o + 8], s8: t[o + 9], plant: t[o + 10] });
    c.tallList = out;
  }
  return c.tallList;
}
function crownsNearEarth(minBand, x, y, rad) {
  const out = [];
  for (let j = Math.floor((y - rad) / N); j <= Math.floor((y + rad) / N); j++)
    for (let i = Math.floor((x - rad) / N); i <= Math.floor((x + rad) / N); i++) {
      const c = chunks.get(ck(i, j));
      if (!c) continue;
      for (const cr of tallCrowns(c)) if (cr.L >= minBand && Math.hypot(cr.x - x, cr.y - y) <= rad) out.push(cr);
    }
  return out;
}
{
  const plainCanopyAt = canopyAt, plainCrownsNear = crownsNear, plainCrownHeight = crownHeight, plainCrownUnder = crownUnder;
  canopyAt = (x, y) => (earthOn() ? heightAt(x, y) : plainCanopyAt(x, y));
  crownsNear = (L, x, y, rad) => {
    if (!earthOn()) return plainCrownsNear(L, x, y, rad);
    let out = crownsNearEarth(L + 1, x, y, rad);
    if (!out.length && L === 2) out = crownsNearEarth(2, x, y, rad);
    return out;
  };
  crownHeight = (c, x, y) => (c.shape !== undefined ? crownHeightE(c, x, y) : plainCrownHeight(c, x, y));
  crownUnder = (x, y) => {
    if (!earthOn()) return plainCrownUnder(x, y);
    let best = null, bh = 0;
    for (const c of crownsNearEarth(2, x, y, 89)) { const h = crownHeightE(c, x, y); if (h > bh) { bh = h; best = c; } }
    return best;
  };
}
/** What a chunk says about the water at (x, y): 0 land, 1 fresh water, 2 sea, 3 ice; -1 where nothing is grown. */
function wetAt(x, y) {
  const c = chunks.get(ck(Math.floor(x / N), Math.floor(y / N)));
  return c && c.wet ? c.wet[mod(Math.floor(y), N) * N + mod(Math.floor(x), N)] : -1;
}
const isWater = (x, y) => { const w = wetAt(x, y); return w === 1 || w === 2; };
const onLand = (x, y) => wetAt(x, y) === 0;

// ---- species: every creature on the Earth is one, and pointing names it ------------------------------
{
  const plainSpawnLife = spawnLife;
  spawnLife = (c) => {
    if (!earthOn()) return plainSpawnLife(c);
    for (const s of c.sites) {
      const g = LIFE[s.kind];
      if (!g || !g.spawn || (REDUCED && !STILL.has(s.kind))) continue;
      const o = g.spawn(s);
      if (o) { o.home = c.id; o.sp = s.sp; g.list.push(o); }
    }
  };
  for (const k of ["ants", "mould", "frogs", "ferns", "snakes", "fireflies", "morphos", "blooms", "hummers", "troops", "macaws", "eagles"]) {
    const g = LIFE[k], plain = g.draw;
    g.draw = function (t) {
      if (!earthOn()) return plain.call(this, t);
      const all = this.list;
      try { for (const o of all) { this.list = [o]; CUR_SP = o.sp === undefined ? -1 : o.sp; plain.call(this, t); } }
      finally { this.list = all; CUR_SP = -1; }
    };
  }
}
/** The species of a kind living at the middle of the view, if any lives there this month (looked up now and then). */
const VIEWCACHE = new Map();
function viewSpecies(kind) {
  const mx = vx + VW / 2, my = vy + VH / 2, key = kind + ":" + Math.floor(mx / 233) + ":" + Math.floor(my / 233);
  if (VIEWCACHE.has(key)) return VIEWCACHE.get(key);
  const pr = eSite(mx, my, {}, true), sp = eSpecies(kind, pr, pr.lat), ok = sp && eWhen(kind, pr, EM) ? sp : null;
  if (VIEWCACHE.size > 233) VIEWCACHE.clear();
  VIEWCACHE.set(key, ok);
  return ok;
}
const pickSp = (sp) => sp.list[Math.floor(rnd() * sp.list.length)];
for (const k of ["macaws", "eagles"]) {
  const g = LIFE[k], plain = g.step;
  g.step = function (t) {
    if (!earthOn()) return plain.call(this, t);
    const sp = viewSpecies(k);
    if (!sp) { this.list = []; return; }
    plain.call(this, t);
    for (const o of this.list) if (o.sp === undefined) o.sp = pickSp(sp);
  };
}

// ---- the Earth's own life ------------------------------------------------------------------------------
const spName = (id) => SPECIES[id] || "";
const BIG = /elephant|bison|buffalo|yak|muskox|hippo|moose|elk|rhino|camel|dromedar|giraffe|gaur|walrus/i;
const SMALL = /gazelle|impala|springbok|saiga|pronghorn|deer|vicu|guanaco|antelope|kangaroo|wallab|goral|chital|blackbuck|chinkara|ibex|goat|sheep|mouflon|pudu|lechwe|sitatunga|capybara|peccar|boar|pig|tahr|kiang|ass|gemsbok|addax|bontebok|rhea|emu|gelada|alpaca|dorcas/i;
const MIGRANTS = /wildebeest|caribou|reindeer|saiga|bison|zebra|gazelle|springbok/i;
const shade = (x, y, a) => shadowAt(x, y, a);
// A creature stands out from its ground as the rainforest's do, but by its ground: light on dark ground, dark on
// light ground (sand, snow, ice), in its painting's own colours.
function clear(c, gl) {
  // However the painting's colours fall, a body keeps 89 levels of lightness from its ground.
  const l = lum(c);
  if (gl < 118 && l < gl + 89) return lift(c, Math.min(1, (gl + 89 - l) / Math.max(1, 255 - l)));
  if (gl >= 118 && l > gl - 89) return dim(c, Math.max(0, gl - 89) / Math.max(1, l));
  return c;
}
const standOut = (P, gl) => clear(gl < 118 ? pop(P.light) : dim(P.dark, PHI ** -1), gl);
const standOut2 = (P, gl) => clear(gl < 118 ? pop(P.vivid) : dim(P.mid, PHI ** -1), gl);
/** The lightness of the ground a place wears (its look's middle colour), for creatures spawned by the view. */
function groundLum(x, y) {
  const pr = eSite(x, y, {}, true), E = EARTH;
  let key;
  if (pr.surf === SEA) key = lookKey(seaLook(pr.zone, pr.warmth), -1, 0);
  else if (pr.surf === LAKE) key = lookKey(E.lookIdx.lake, -1, 0);
  else if (pr.snow > 0.5 || pr.surf === 15) key = lookKey(E.lookIdx.snow, -1, 0);
  else { const B = E.biome[pr.surf]; key = lookKey(B.look[pr.phase], pr.soil, pr.bare); }
  return lumE(eLookPalettes(key)[0].pal[1]);
}

// Herds graze over open ground, then move on together, in files when they travel; they keep out of the
// trees and the water, and scatter when a hunter runs at them.
LIFE.herds = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), name = spName(s.sp), big = BIG.test(name), small = SMALL.test(name);
    const migrating = MIGRANTS.test(name) && [2, 3, 4, 8, 9, 10].includes(EM);
    const n = migrating ? [34, 55, 89][s.seed % 3] : big ? [5, 8, 13][s.seed % 3] : small ? [13, 21, 34][s.seed % 3] : [8, 13, 21][s.seed % 3];
    const an = [];
    for (let k = 0; k < n; k++) {
      const a = k * GOLDEN_ANGLE, r = (big ? 5 : 3) * Math.sqrt(k + 1);
      an.push({ ox: Math.cos(a) * r, oy: Math.sin(a) * r, x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, th: rnd() * TAU, head: rnd() < 0.5 });
    }
    const zebra = /zebra/i.test(name), giraffe = /giraffe/i.test(name);
    return { x: s.x, y: s.y, hx: s.x, hy: s.y, th: rnd() * TAU, state: "graze", timer: Math.floor(rnd() * 610), an, big, small, zebra, giraffe, panic: 0, fx: 0, fy: 0,
             body: standOut(P, s.gl), back: standOut2(P, s.gl), spot: P.vivid, w: s.w, migrating };
  },
  step() {
    for (const h of this.list) {
      if (--h.timer <= 0) {
        h.state = h.state === "graze" ? "move" : "graze";
        h.timer = h.state === "move" ? 233 + rnd() * (h.migrating ? 1597 : 610) : 377 + rnd() * 987;
        if (h.state === "move") h.th += (rnd() - 0.5) * PHI;
      }
      const v = h.panic > 0 ? PHI ** -1 : h.state === "move" ? (h.migrating ? PHI ** -2 : PHI ** -3) : PHI ** -6;
      // Look ahead: trees, water or the edge of what is grown turn the herd; far from home, home pulls.
      const ax = h.x + Math.cos(h.th) * 21, ay = h.y + Math.sin(h.th) * 21;
      if (heightAt(ax, ay) > LOW || !onLand(ax, ay)) h.th += PHI ** -2;
      const dh = Math.hypot(h.hx - h.x, h.hy - h.y);
      if (dh > (h.migrating ? 987 : 377)) h.th += turnTo(h.th, Math.atan2(h.hy - h.y, h.hx - h.x)) * PHI ** -4;
      if (h.panic > 0) { h.panic--; h.th += turnTo(h.th, Math.atan2(h.y - h.fy, h.x - h.fx)) * PHI ** -2; }
      h.x += Math.cos(h.th) * v; h.y += Math.sin(h.th) * v;
      const ca = Math.cos(h.th), sa = Math.sin(h.th), file = h.state === "move" ? PHI : 1;
      for (const a of h.an) {
        // Its place in the herd, stretched into files along the way when travelling.
        const along = (a.ox * ca + a.oy * sa) * file * file, across = (-a.ox * sa + a.oy * ca) / file;
        const tx = h.x + along * ca - across * sa, ty = h.y + along * sa + across * ca;
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
        const step = Math.min(d, v * PHI + (h.state === "graze" ? PHI ** -6 : 0));
        if (d > 0.3) { a.x += (dx / d) * step; a.y += (dy / d) * step; a.th += turnTo(a.th, Math.atan2(dy, dx)) * PHI ** -3; }
        else if (rnd() < PHI ** -8) a.th += (rnd() - 0.5) * PHI;                   // grazing, turning a little
        if (rnd() < PHI ** -7) a.head = !a.head;
      }
    }
  },
  draw() {
    for (const h of this.list) {
      if (!inView(h.x, h.y, 144)) continue;
      CUR_SP = h.sp;
      for (const a of h.an) {
        if (!seen(a.x, a.y, LOW)) continue;
        const c = Math.cos(a.th), s = Math.sin(a.th), len = h.big ? 5 : h.small ? 3 : 4, wide = h.big ? 1 : h.small ? 0 : 0.5;
        const sh = h.giraffe ? 8 : h.big ? 3 : 2;                                  // the taller, the longer its shadow
        for (let q = 1; q <= sh; q++) { shade(a.x + q * 0.7 + 0.5, a.y + q * 0.7 + 0.5, PHI ** -2); if (wide) shade(a.x + q * 0.7 + 0.5 - s, a.y + q * 0.7 + 0.5 + c, PHI ** -2); }
        for (let q = 0; q < len; q++) {
          const x = a.x - c * q, y = a.y - s * q, col = h.zebra && (q & 1) ? h.back : h.giraffe && (q === 1 || q === 3) ? h.spot : h.body;
          put(x, y, col, 1, h.w);
          if (wide) { put(x - s, y + c, col, 1, h.w); if (wide === 1) put(x + s, y - c, col, 1, h.w); }
        }
        put(a.x + c, a.y + s, a.head ? h.body : h.back, 1, h.w); put(a.x + 2 * c, a.y + 2 * s, h.back, a.head ? PHI ** -1 : 1, h.w);   // the head, down to graze or up
      }
    }
    CUR_SP = -1;
  },
};

// Hunters shadow the nearest herd, and now and then run at it.
LIFE.hunters = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), name = spName(s.sp), pack = /pride|clan|pack|dogs|wolves|dingoes|jackals|hyena|dholes|foxes|coyotes/i.test(name);
    const n = pack ? 3 + (s.seed % 3) : 1, m = [];
    for (let k = 0; k < n; k++) m.push({ x: s.x + (rnd() - 0.5) * 8, y: s.y + (rnd() - 0.5) * 8 });
    return { x: s.x, y: s.y, hx: s.x, hy: s.y, th: rnd() * TAU, m, state: "stalk", timer: 377 + rnd() * 987, body: standOut2(P, s.gl), dark: standOut(P, s.gl), w: s.w, prey: null };
  },
  step() {
    for (const h of this.list) {
      let herd = null, bd = 987;
      for (const g of LIFE.herds.list) { const d = Math.hypot(g.x - h.x, g.y - h.y); if (d < bd) { bd = d; herd = g; } }
      let v = PHI ** -4;
      if (h.state === "rest") { v = 0; if (--h.timer <= 0) { h.state = "stalk"; h.timer = 610 + rnd() * 987; } }
      else if (h.state === "charge" && herd) {
        const a = herd.an[Math.floor(rnd() * herd.an.length)];
        if (!h.prey) h.prey = a;
        h.th += turnTo(h.th, Math.atan2(h.prey.y - h.y, h.prey.x - h.x)) * PHI ** -2; v = PHI;
        herd.panic = 89; herd.fx = h.x; herd.fy = h.y;
        if (--h.timer <= 0) { h.state = "rest"; h.timer = 610 + rnd() * 610; h.prey = null; }
      } else if (herd) {
        const d = Math.hypot(herd.x - h.x, herd.y - h.y);
        h.th += turnTo(h.th, Math.atan2(herd.y - h.y, herd.x - h.x)) * PHI ** -4;
        v = d > 55 ? PHI ** -3 : 0;
        if (--h.timer <= 0) { h.state = "charge"; h.timer = 55 + rnd() * 34; }
      } else {
        h.th += (rnd() - 0.5) * PHI ** -3;
        if (Math.hypot(h.hx - h.x, h.hy - h.y) > 233) h.th += turnTo(h.th, Math.atan2(h.hy - h.y, h.hx - h.x)) * PHI ** -3;
      }
      h.x += Math.cos(h.th) * v; h.y += Math.sin(h.th) * v;
      h.m.forEach((m, k) => {
        const tx = h.x - Math.cos(h.th) * k * 3 + Math.sin(h.th) * ((k & 1) * 2 - 1) * k, ty = h.y - Math.sin(h.th) * k * 3 - Math.cos(h.th) * ((k & 1) * 2 - 1) * k;
        m.x += (tx - m.x) * PHI ** -3; m.y += (ty - m.y) * PHI ** -3;
      });
    }
  },
  draw() {
    for (const h of this.list) {
      if (!inView(h.x, h.y, 55)) continue;
      CUR_SP = h.sp;
      const c = Math.cos(h.th), s = Math.sin(h.th);
      for (const m of h.m) {
        if (!seen(m.x, m.y, LOW)) continue;
        shade(m.x + 1.2, m.y + 1.2, PHI ** -2);
        put(m.x, m.y, h.body, 1, h.w); put(m.x - c, m.y - s, h.body, 1, h.w); put(m.x + c, m.y + s, h.dark, 1, h.w);
      }
    }
    CUR_SP = -1;
  },
};

// Colonies stay put and seethe: termite mounds standing with their shadows; burrowers popping up at their
// holes; and crowds of penguins, seals or seabirds packed close, shuffling.
LIFE.colonies = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), name = spName(s.sp);
    const kind = /termite/i.test(name) ? "mounds" : /penguin|seal|walrus|sea lion|gannet|owl/i.test(name) ? "crowd" : "burrows";
    const n = kind === "mounds" ? 5 + (s.seed % 9) : kind === "crowd" ? [89, 144, 233][s.seed % 3] : [13, 21, 34][s.seed % 3];
    const R0 = kind === "crowd" ? 8 + Math.sqrt(n) : kind === "mounds" ? 34 : 21, mem = [];
    for (let k = 0; k < n; k++) {
      const r = R0 * Math.sqrt((k + 0.5) / n), a = k * GOLDEN_ANGLE;
      mem.push({ x: s.x + Math.cos(a) * r * (kind === "crowd" ? PHI : 1), y: s.y + Math.sin(a) * r, up: rnd(), t: rnd() * TAU, big: rnd() < PHI ** -2 });
    }
    return { x: s.x, y: s.y, kind, mem, light: pop(P.light), dark: P.dark, mid: kind === "burrows" ? standOut(P, s.gl) : P.mid, w: s.w, seal: /seal|walrus|sea lion/i.test(name) };
  },
  step(t) {
    for (const c of this.list) {
      if (c.kind === "mounds") continue;
      for (const m of c.mem) {
        if (c.kind === "burrows") { m.up += PHI ** -6 * (0.5 + rnd()); if (m.up > 1) m.up -= 1; }
        else if (rnd() < PHI ** -6) { m.x += (rnd() - 0.5) * PHI ** -1; m.y += (rnd() - 0.5) * PHI ** -1; }
      }
    }
  },
  draw(t) {
    for (const c of this.list) {
      if (!inView(c.x, c.y, 55)) continue;
      CUR_SP = c.sp;
      for (const m of c.mem) {
        if (c.kind === "mounds") {
          if (!seen(m.x, m.y, LOW)) continue;
          const sz = m.big ? 3 : 2;
          for (let q = 1; q <= sz * 2; q++) shade(m.x + q * 0.8 + 1, m.y + q * 0.8 + 1, PHI ** -2);
          for (let yy = 0; yy < sz; yy++) for (let xx = 0; xx < sz; xx++) put(m.x + xx, m.y + yy, xx + yy === 0 ? c.light : c.mid, 1, c.w);
        } else if (c.kind === "burrows") {
          put(m.x, m.y, dim(c.dark, PHI ** -1), 1, c.w);                          // the hole
          if (m.up < PHI ** -1 && seen(m.x, m.y - 1, LOW)) { put(m.x, m.y - 1, c.mid, 1, c.w); put(m.x, m.y - 2, c.light, PHI ** -1, c.w); shade(m.x + 1, m.y, PHI ** -2); }
        } else {
          const wob = Math.sin(t / 21 + m.t) * PHI ** -2;
          put(m.x + wob, m.y, c.dark, 1, c.w);
          put(m.x + wob, m.y + 1, c.seal ? c.dark : c.light, c.seal ? 1 : PHI ** -1, c.w);   // a penguin's pale front, a seal's length
        }
      }
    }
    CUR_SP = -1;
  },
};

// Swarms: small clouds of insects dancing over one spot, or a great swarm of locusts or quelea sweeping across.
LIFE.swarms = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), name = spName(s.sp), great = /locust|quelea|budgerigar/i.test(name);
    const n = great ? 610 : [34, 55, 89][s.seed % 3], R0 = great ? 55 : 5 + (s.seed % 4), m = [];
    for (let k = 0; k < n; k++) m.push({ ox: (rnd() - 0.5) * 2 * R0, oy: (rnd() - 0.5) * 2 * R0, vx: 0, vy: 0 });
    return { x: s.x, y: s.y, hx: s.x, hy: s.y, th: rnd() * TAU, great, R0, m, col: great ? standOut2(P, s.gl) : standOut(P, s.gl), w: s.w };
  },
  step() {
    for (const w of this.list) {
      if (w.great) {
        w.th += (rnd() - 0.5) * PHI ** -4;
        if (Math.hypot(w.hx - w.x, w.hy - w.y) > 610) w.th += turnTo(w.th, Math.atan2(w.hy - w.y, w.hx - w.x)) * PHI ** -4;
        w.x += Math.cos(w.th) * PHI ** -2; w.y += Math.sin(w.th) * PHI ** -2;
      }
      const R0 = w.R0;
      for (const m of w.m) {
        m.vx = m.vx * (1 - PHI ** -3) + (rnd() - 0.5) * PHI ** -1 - (m.ox / R0) * PHI ** -5;
        m.vy = m.vy * (1 - PHI ** -3) + (rnd() - 0.5) * PHI ** -1 - (m.oy / R0) * PHI ** -5;
        m.ox += m.vx; m.oy += m.vy;
      }
    }
  },
  draw() {
    for (const w of this.list) {
      if (!inView(w.x, w.y, w.R0 + 21)) continue;
      CUR_SP = w.sp;
      for (const m of w.m) {
        const x = w.x + m.ox, y = w.y + m.oy;
        put(x, y, w.col, w.great ? 1 : PHI ** -1, w.w);
        if (w.great) shade(x + 13, y + 13, PHI ** -4);
      }
    }
    CUR_SP = -1;
  },
};

// Waders stand in the shallows on their long legs, step, and stab, and the water rings.
LIFE.waders = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), n = 3 + (s.seed % 11), b = [];
    for (let k = 0; k < n * 3 && b.length < n; k++) {
      const x = s.x + (rnd() - 0.5) * 34, y = s.y + (rnd() - 0.5) * 34;
      if (isWater(x, y)) b.push({ x, y, th: rnd() * TAU, wait: rnd() * 377, ring: 0 });
    }
    return b.length ? { x: s.x, y: s.y, b, body: pop(P.vivid), neck: pop(P.light), w: s.w } : null;
  },
  step() {
    for (const g of this.list) for (const b of g.b) {
      if (b.ring > 0) b.ring--;
      if (--b.wait > 0) continue;
      b.wait = 144 + rnd() * 377;
      if (rnd() < 0.5) { b.ring = 21; continue; }                                 // a stab
      const a = b.th + (rnd() - 0.5) * PHI, x = b.x + Math.cos(a) * 2, y = b.y + Math.sin(a) * 2;
      if (isWater(x, y)) { b.x = x; b.y = y; b.th = a; }
    }
  },
  draw() {
    for (const g of this.list) {
      if (!inView(g.x, g.y, 34)) continue;
      CUR_SP = g.sp;
      for (const b of g.b) {
        const c = Math.cos(b.th), s = Math.sin(b.th);
        for (let q = 1; q <= 4; q++) shade(b.x + q * 0.8, b.y + q * 0.8, PHI ** -2);   // tall: a long shadow
        put(b.x, b.y, g.body, 1, g.w); put(b.x - c, b.y - s, g.body, 1, g.w);
        const down = b.ring > 13;
        put(b.x + c * (down ? 1 : 2), b.y + s * (down ? 1 : 2), g.neck, 1, g.w);
        if (b.ring > 0) { const r = (21 - b.ring) * PHI ** -1; for (let k = 0; k < 13; k++) put(b.x + c * 2 + Math.cos(k * TAU / 13) * r, b.y + s * 2 + Math.sin(k * TAU / 13) * r, g.neck, (b.ring / 21) * PHI ** -2, g.w); }
      }
    }
    CUR_SP = -1;
  },
};

// Schools of fish under the surface, turning together, and flashing as they turn.
LIFE.schools = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), n = [55, 89, 144][s.seed % 3], f = [];
    for (let k = 0; k < n; k++) { const a = k * GOLDEN_ANGLE, r = Math.sqrt(k) * PHI ** -0.5 * 1.3; f.push({ ox: Math.cos(a) * r, oy: Math.sin(a) * r, x: s.x, y: s.y, flash: 0 }); }
    return { x: s.x, y: s.y, hx: s.x, hy: s.y, th: rnd() * TAU, om: 0, f, col: lift(pop(P.light), PHI ** -2), glint: lift(pop(P.light), PHI ** -1), w: s.w, turnAt: 89 };
  },
  step() {
    for (const sc of this.list) {
      const ahead = [sc.x + Math.cos(sc.th) * 13, sc.y + Math.sin(sc.th) * 13];
      if (!isWater(ahead[0], ahead[1]) || Math.hypot(sc.hx - sc.x, sc.hy - sc.y) > 233) sc.om = PHI ** -2 * (sc.om >= 0 ? 1 : -1);
      else sc.om *= 1 - PHI ** -4;
      if (--sc.turnAt <= 0) { sc.turnAt = 89 + rnd() * 233; sc.om = (rnd() < 0.5 ? -1 : 1) * PHI ** -2; for (const f of sc.f) f.flash = 1; }
      sc.th += sc.om;
      sc.x += Math.cos(sc.th) * PHI ** -2; sc.y += Math.sin(sc.th) * PHI ** -2;
      const c = Math.cos(sc.th), s = Math.sin(sc.th);
      for (const f of sc.f) {
        const tx = sc.x + f.ox * c * PHI - f.oy * s, ty = sc.y + f.ox * s * PHI + f.oy * c;
        f.x += (tx - f.x) * PHI ** -3; f.y += (ty - f.y) * PHI ** -3; f.flash *= 1 - PHI ** -3;
      }
    }
  },
  draw() {
    for (const sc of this.list) {
      if (!inView(sc.x, sc.y, 34)) continue;
      CUR_SP = sc.sp;
      for (const f of sc.f) if (isWater(f.x, f.y)) put(f.x, f.y, f.flash > PHI ** -2 ? sc.glint : sc.col, 1 - PHI ** -3 + PHI ** -3 * f.flash, sc.w);
    }
    CUR_SP = -1;
  },
};

// Whales (and rays, turtles and sharks) come up, blow, lie a while, and go down, leaving a smooth slick.
LIFE.whales = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), name = spName(s.sp);
    const form = /ray|manta/i.test(name) ? "ray" : /turtle/i.test(name) ? "turtle" : /shark/i.test(name) ? "shark" : /beluga|narwhal/i.test(name) ? "pale" : "whale";
    const L = form === "turtle" ? 3 : form === "ray" ? 5 : form === "shark" ? 7 : form === "pale" ? 8 : 13;
    return { x: s.x, y: s.y, hx: s.x, hy: s.y, th: rnd() * TAU, form, L, state: "under", timer: rnd() * 987, u: 0, body: form === "pale" ? pop(P.light) : dim(P.dark, PHI ** -1),
             pale: lift(P.light, PHI ** -1), w: s.w, slick: [], blow: 0 };
  },
  step() {
    for (const h of this.list) {
      if (!isWater(h.x + Math.cos(h.th) * 21, h.y + Math.sin(h.th) * 21) || Math.hypot(h.hx - h.x, h.hy - h.y) > 377) h.th += PHI ** -3;
      h.x += Math.cos(h.th) * PHI ** -3; h.y += Math.sin(h.th) * PHI ** -3;
      h.timer--;
      if (h.state === "under" && h.timer <= 0) { h.state = "up"; h.timer = 377 + rnd() * 610; h.blow = h.form === "whale" || h.form === "pale" ? 55 : 0; }
      else if (h.state === "up" && h.timer <= 0) { h.state = "down"; h.timer = 55; h.slick.push({ x: h.x, y: h.y, age: 0 }); }
      else if (h.state === "down" && h.timer <= 0) { h.state = "under"; h.timer = 987 + rnd() * 1597; }
      h.u += ((h.state === "up" ? 1 : 0) - h.u) * PHI ** -4;
      if (h.blow > 0) h.blow--;
      for (const s of h.slick) s.age++;
      h.slick = h.slick.filter((s) => s.age < 377);
    }
  },
  draw() {
    for (const h of this.list) {
      if (!inView(h.x, h.y, 89)) continue;
      CUR_SP = h.sp;
      for (const s of h.slick) {                                                  // the footprint: a smooth, pale oval
        const a = (1 - s.age / 377) * PHI ** -3, r = h.L * (1 + s.age / 144);
        for (let k = 0; k < 34; k++) put(s.x + Math.cos(k * TAU / 34) * r, s.y + Math.sin(k * TAU / 34) * r * PHI ** -1, h.pale, a, h.w);
      }
      if (h.u < PHI ** -4) continue;
      const c = Math.cos(h.th), s = Math.sin(h.th), W = h.form === "ray" ? h.L : Math.max(1, h.L * PHI ** -2);
      for (let u = -h.L; u <= h.L; u++) for (let v = -W; v <= W; v++) {
        const inside = h.form === "ray" ? Math.abs(u) + Math.abs(v) <= h.L : (u / h.L) ** 2 + (v / W) ** 2 <= 1;
        if (inside) put(h.x + u * c - v * s, h.y + u * s + v * c, h.body, h.u, h.w);
      }
      if (h.state === "down" && h.form !== "ray" && h.form !== "turtle") {       // the flukes, going down
        for (let q = 1; q <= 3; q++) { put(h.x - c * (h.L + q) - s * q, h.y - s * (h.L + q) + c * q, h.body, 1, h.w); put(h.x - c * (h.L + q) + s * q, h.y - s * (h.L + q) - c * q, h.body, 1, h.w); }
      }
      if (h.blow > 0) {                                                            // the blow: spray rising and spreading
        const k2 = 1 - h.blow / 55;
        for (let q = 0; q < 21; q++) { const a = q * GOLDEN_ANGLE, r = k2 * 5 * Math.sqrt(q / 21); put(h.x + c * h.L * PHI ** -1 + Math.cos(a) * r, h.y + s * h.L * PHI ** -1 + Math.sin(a) * r, h.pale, (1 - k2) * PHI ** -1, h.w); }
      }
    }
    CUR_SP = -1;
  },
};

// Floes drift with the wind at the edge of the ice; in the Sargasso, golden rafts of weed.
LIFE.floes = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), name = spName(s.sp), weed = /sargassum/i.test(name), n = weed ? 5 + (s.seed % 8) : 3 + (s.seed % 5), f = [];
    for (let k = 0; k < n; k++) {
      const x = s.x + (rnd() - 0.5) * 89, y = s.y + (rnd() - 0.5) * 89;
      if (isWater(x, y)) f.push({ x, y, r: weed ? 1 : 3 + rnd() * 5, len: weed ? 8 + rnd() * 13 : 0, a: rnd() * TAU, spin: (rnd() - 0.5) * PHI ** -7, seed: Math.floor(rnd() * 1e6) });
    }
    const w = windAt(s.x, s.y);
    return f.length ? { x: s.x, y: s.y, f, weed, dx: w.c * PHI ** -5, dy: w.s * PHI ** -5, col: weed ? pop(P.vivid) : lift(P.light, PHI ** -1), rim: dim(P.dark, PHI ** -1), w: s.w } : null;
  },
  step() { for (const g of this.list) for (const f of g.f) { f.x += g.dx; f.y += g.dy; f.a += f.spin; } },
  draw() {
    for (const g of this.list) {
      if (!inView(g.x, g.y, 144)) continue;
      CUR_SP = g.sp;
      for (const f of g.f) {
        if (g.weed) {
          const c = Math.cos(f.a), s = Math.sin(f.a);
          for (let q = 0; q < f.len; q++) put(f.x + c * q + Math.sin(q / 3 + f.seed) , f.y + s * q, g.col, PHI ** -1, g.w);
          continue;
        }
        const R2 = Math.ceil(f.r + 1);
        for (let v = -R2; v <= R2; v++) for (let u = -R2; u <= R2; u++) {
          const a = Math.atan2(v, u) - f.a, rr = f.r * (1 + PHI ** -3 * Math.sin(5 * a + f.seed)), d = Math.hypot(u, v);
          if (d < rr) put(f.x + u, f.y + v, g.col, 1, g.w);
          else if (d < rr + 1 && u + v > 0) put(f.x + u, f.y + v, g.rim, PHI ** -1, g.w);
        }
      }
    }
    CUR_SP = -1;
  },
};

// Dust devils wander over hot, dry ground: a spinning spiral of dust, and its shadow.
LIFE.dust = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0);
    return { x: s.x, y: s.y, hx: s.x, hy: s.y, th: rnd() * TAU, life: rnd() * 987, col: lift(P.light, PHI ** -2), w: s.w };
  },
  step() {
    for (const d of this.list) {
      d.th += (rnd() - 0.5) * PHI ** -2;
      if (Math.hypot(d.hx - d.x, d.hy - d.y) > 233) d.th += turnTo(d.th, Math.atan2(d.hy - d.y, d.hx - d.x)) * PHI ** -3;
      d.x += Math.cos(d.th) * PHI ** -2; d.y += Math.sin(d.th) * PHI ** -2;
      if (--d.life <= -610) d.life = 987 + rnd() * 987;
    }
  },
  draw(t) {
    for (const d of this.list) {
      if (d.life <= 0 || !inView(d.x, d.y, 21)) continue;
      CUR_SP = d.sp;
      const grow = Math.max(0, Math.min(1, d.life / 144, (987 - d.life) / 144 + PHI ** -1));
      for (let k = 0; k < 55; k++) {
        const r = Math.sqrt(k) * PHI ** -0.5 * grow, a = k * GOLDEN_ANGLE + t * PHI ** -2;
        put(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r - k * PHI ** -4, d.col, (1 - k / 55) * PHI ** -1 * grow, d.w);
      }
      for (let q = 1; q <= 8; q++) shade(d.x + q * 0.8, d.y + q * 0.8, PHI ** -3 * grow);
    }
    CUR_SP = -1;
  },
};

// Fire in the dry season: a line of flame creeping out through the grass, faster downwind, leaving a black
// scar, and trailing smoke.
LIFE.fire = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), w = windAt(s.x, s.y), byC = [...P.cols].sort((a, b) => chroma(b) - chroma(a));
    return { x: s.x, y: s.y, r: 0, wa: w.a, age: Math.floor(rnd() * 1597), flame: pop(byC[0]), flame2: lift(pop(byC[1] || byC[0]), PHI ** -2), smoke: mixRGB(P.mid, [200, 200, 200], PHI ** -1), scar: dim(P.dark, PHI ** -2), w: s.w };
  },
  step() { for (const f of this.list) { f.age++; if (f.age > 4181) { f.age = 0; f.cells = null; } f.r = Math.min(89, f.age * PHI ** -4); } },
  /** The burnt ground within the front, an egg pushed downwind: worked out again only as the front grows. */
  scar(f) {
    const R0 = Math.floor(f.r);
    if (f.cells && f.cellsR === R0) return f.cells;
    const ca = Math.cos(f.wa), sa = Math.sin(f.wa), out = [];
    for (let v = -R0 * 2; v <= R0 * 2; v++) for (let u = -R0; u <= R0 * 2; u++) {
      const a = Math.atan2(v, u), rr = R0 * (1 + PHI ** -1 * Math.cos(a)) * (1 + PHI ** -3 * Math.sin(3 * a + f.x));
      if (Math.hypot(u, v) >= rr) continue;
      const x = f.x + u * ca - v * sa, y = f.y + u * sa + v * ca;
      if (onLand(x, y)) out.push(x, y);
    }
    f.cells = Float32Array.from(out); f.cellsR = R0;
    return f.cells;
  },
  draw(t) {
    for (const f of this.list) {
      if (!inView(f.x, f.y, 144) || f.age < 55) continue;
      CUR_SP = f.sp;
      const ca = Math.cos(f.wa), sa = Math.sin(f.wa), R0 = f.r, fading = f.age > 2584 ? 1 - (f.age - 2584) / 1597 : 1, cells = this.scar(f);
      for (let o = 0; o < cells.length; o += 2) if (seen(cells[o], cells[o + 1], LOW)) put(cells[o], cells[o + 1], f.scar, PHI ** -1 * fading, f.w);
      if (f.age > 2584) continue;
      for (let k = 0; k < 144; k++) {                                              // the front, flickering
        const a = (k / 144) * TAU, rr = R0 * (1 + PHI ** -1 * Math.cos(a)) * (1 + PHI ** -3 * Math.sin(3 * a + f.x));
        const u = Math.cos(a) * rr, v = Math.sin(a) * rr, x = f.x + u * ca - v * sa, y = f.y + u * sa + v * ca;
        if (!onLand(x, y) || !seen(x, y, LOW) || u3(k, t >> 2, 1401) < PHI ** -2) continue;
        put(x, y, u3(k, t >> 3, 1403) < 0.5 ? f.flame : f.flame2, 1, f.w);
        if (u3(k, t >> 4, 1405) < PHI ** -3) for (let q = 1; q < 13; q++) put(x + ca * q * PHI + Math.sin(q + t / 13) , y + sa * q * PHI, f.smoke, (1 - q / 13) * PHI ** -2, f.w);
      }
    }
    CUR_SP = -1;
  },
};

// The sea lit from within where plankton gather: faint by day, bright in the polar night.
LIFE.bioluminescence = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, 0), blue = [...P.cols].sort((a, b) => (b[2] + b[1] - 2 * b[0]) - (a[2] + a[1] - 2 * a[0]))[0], pts = [];
    for (let k = 0; k < 89; k++) { const a = k * GOLDEN_ANGLE, r = 34 * Math.sqrt(k / 89); pts.push(s.x + Math.cos(a) * r + (rnd() - 0.5) * 5, s.y + Math.sin(a) * r + (rnd() - 0.5) * 5, rnd() * TAU); }
    return { x: s.x, y: s.y, pts, col: lift(pop(blue), PHI ** -2), w: s.w };
  },
  draw(t) {
    const dark = EDATA ? dayHours(latOfY(vy + VH / 2), EM) < 3 : false;
    for (const b of this.list) {
      if (!inView(b.x, b.y, 55)) continue;
      CUR_SP = b.sp;
      for (let o = 0; o < b.pts.length; o += 3) {
        const f = Math.max(0, Math.sin(t / 34 + b.pts[o + 2])) ** 5;
        if (f > PHI ** -3 && isWater(b.pts[o], b.pts[o + 1])) put(b.pts[o], b.pts[o + 1], b.col, f * (dark ? 1 : PHI ** -2), b.w);
      }
    }
    CUR_SP = -1;
  },
};

// Geese and cranes in V formation cross high overhead in spring and autumn: north in the northern spring
// (March to May), south in the autumn (September to November), wherever the view is.
LIFE.vees = {
  list: [],
  wait: 233,
  step() {
    const sp = viewSpecies("vees");
    if (sp && --this.wait <= 0 && this.list.length < 2) {
      this.wait = 610 + rnd() * 1597;
      const north = [2, 3, 4].includes(EM), th = (north ? -Math.PI / 2 : Math.PI / 2) + (rnd() - 0.5) * PHI ** -1, n = [13, 21, 34][Math.floor(rnd() * 3)];
      const P = paletteOf(Math.floor(rnd() * TOKENS.length), 0), start = { x: vx + VW / 2 - Math.cos(th) * (VW + VH) * 0.6 + (rnd() - 0.5) * VW * 0.5, y: vy + VH / 2 - Math.sin(th) * (VW + VH) * 0.6 };
      this.list.push({ x: start.x, y: start.y, th, n, t: 0, flap: rnd() * TAU, col: standOut(P, groundLum(vx + VW / 2, vy + VH / 2)), w: P.w, sp: pickSp(sp) });
    }
    for (const v of this.list) { v.x += Math.cos(v.th) * PHI; v.y += Math.sin(v.th) * PHI; v.t++; v.flap += TAU / 13; }
    this.list = this.list.filter((v) => v.t < 2 * (VW + VH));
  },
  draw() {
    for (const v of this.list) {
      CUR_SP = v.sp;
      const c = Math.cos(v.th), s = Math.sin(v.th), arm = PHI ** -1;
      for (let k = 0; k < v.n; k++) {
        const side = k & 1 ? 1 : -1, rank = (k + 1) >> 1, bx = v.x - c * rank * 4 + side * (-s) * rank * 4 * arm, by = v.y - s * rank * 4 + side * c * rank * 4 * arm;
        shade(bx + 34, by + 34, PHI ** -3);                                         // far below: faint shadows
        put(bx, by, v.col, 1, v.w); put(bx - c, by - s, v.col, 1, v.w);
        if (Math.sin(v.flap + k) > 0) { put(bx - s, by + c, v.col, PHI ** -1, v.w); put(bx + s, by - c, v.col, PHI ** -1, v.w); }
      }
    }
    CUR_SP = -1;
  },
};

// Vultures and condors circle on thermals over open ground, their shadows wheeling below them.
LIFE.soarers = {
  list: [],
  wait: 89,
  step() {
    const sp = viewSpecies("soarers");
    if (!sp) { this.list = []; return; }
    const mx = vx + VW / 2, my = vy + VH / 2;
    this.list = this.list.filter((th) => Math.hypot(th.x - mx, th.y - my) < Math.max(VW, VH));
    if (this.list.length < 2 && --this.wait <= 0) {
      this.wait = 377 + rnd() * 610;
      const P = paletteOf(Math.floor(rnd() * TOKENS.length), 0), n = 3 + Math.floor(rnd() * 6), birds = [];
      for (let k = 0; k < n; k++) birds.push({ a: rnd() * TAU, r: 21 + rnd() * 34, v: (PHI ** -1 + rnd() * PHI ** -2) / 34 });
      const x = mx + (rnd() - 0.5) * VW * 0.8, y = my + (rnd() - 0.5) * VH * 0.8;
      this.list.push({ x, y, birds, col: standOut(P, groundLum(x, y)), w: P.w, sp: pickSp(sp) });
    }
    for (const th of this.list) { th.x += PHI ** -5; for (const b of th.birds) b.a += b.v; }
  },
  draw() {
    for (const th of this.list) {
      CUR_SP = th.sp;
      for (const b of th.birds) {
        const x = th.x + Math.cos(b.a) * b.r, y = th.y + Math.sin(b.a) * b.r, c = -Math.sin(b.a), s = Math.cos(b.a);
        for (let q = -6; q <= 6; q++) {                                             // wings spread, 13 cells, fingered at the tips
          const tip = Math.abs(q) > 4 ? (q & 1 ? 0 : 1) : 1;
          if (!tip) continue;
          shade(x + 34 - s * q, y + 34 + c * q, PHI ** -2); shade(x + 34 - s * q + c, y + 34 + c * q + s, PHI ** -2);
          put(x - s * q, y + c * q, th.col, 1, th.w); if (Math.abs(q) < 4) put(x - s * q - c, y + c * q - s, th.col, 1, th.w);
        }
        put(x + c, y + s, th.col, 1, th.w); put(x + 2 * c, y + 2 * s, th.col, PHI ** -1, th.w); put(x - 2 * c, y - 2 * s, th.col, 1, th.w);
      }
    }
    CUR_SP = -1;
  },
};

// Environments, not creatures, but alive: wind waves through grass; sand streaming off the dune crests;
// autumn leaves falling; the sea's glitter; and surf breaking on the shore.
function eachPoint(field, stride, fn) {
  for (const c of chunks.values()) {
    const g = c[field];
    if (!g || !g.length || (c.i + 1) * N < vx || c.i * N > vx + VW || (c.j + 1) * N < vy || c.j * N > vy + VH) continue;
    fn(g, c);
  }
}
const col3 = [0, 0, 0];
LIFE.grasswaves = {
  list: [],
  draw(t) {
    eachPoint("sway", 6, (g, c) => {
      if (!c.windA) { const w = windAt((c.i + 0.5) * N, (c.j + 0.5) * N); c.windA = [w.c, w.s]; }
      const [ca, sa] = c.windA, lam = 144, v = PHI ** -1;
      for (let o = 0; o < g.length; o += 6) {
        const along = (g[o] * ca + g[o + 1] * sa - t * v) / lam, ph = along - Math.floor(along);
        if (ph > PHI ** -2) continue;
        const f = Math.sin((Math.PI * ph) / PHI ** -2) * PHI ** -1;
        col3[0] = g[o + 2] + (255 - g[o + 2]) * PHI ** -2; col3[1] = g[o + 3] + (255 - g[o + 3]) * PHI ** -2; col3[2] = g[o + 4] + (255 - g[o + 4]) * PHI ** -2;
        put(g[o], g[o + 1], col3, f, g[o + 5]);
      }
    });
  },
};
LIFE.dunes = {
  list: [],
  draw(t) {
    eachPoint("crests", 5, (g, c) => {
      if (!c.windA) { const w = windAt((c.i + 0.5) * N, (c.j + 0.5) * N); c.windA = [w.c, w.s]; }
      const [ca, sa] = c.windA;
      for (let o = 0; o < g.length; o += 5) {
        const p = (t + unitOf(o * 7919 + c.id) * 55) % 34;
        if (p > 13) continue;
        col3[0] = g[o + 2]; col3[1] = g[o + 3]; col3[2] = g[o + 4];
        put(g[o] + ca * p * PHI ** -1, g[o + 1] + sa * p * PHI ** -1, col3, (1 - p / 13) * PHI ** -1, -1);
      }
    });
  },
};
LIFE.leaffall = {
  list: [],
  draw(t) {
    eachPoint("leaves", 6, (g, c) => {
      for (let o = 0; o < g.length; o += 6) {
        const p = (t + unitOf(o * 7919 + c.id) * 610) % 610;
        if (p > 233) continue;
        const fall = Math.min(p, 55), x = g[o] + fall * PHI ** -2 + Math.sin(fall / 5) * 2, y = g[o + 1] + fall * PHI ** -1;
        col3[0] = g[o + 2]; col3[1] = g[o + 3]; col3[2] = g[o + 4];
        put(x, y, col3, p < 55 ? 1 : PHI ** -1 * (1 - (p - 55) / 178), g[o + 5]);
      }
    });
  },
};
LIFE.glitter = {
  list: [],
  draw(t) {
    eachPoint("sea", 6, (g, c) => {
      for (let o = 0; o < g.length; o += 6) {
        const f = Math.max(0, Math.sin(t / 21 + unitOf(o * 7919 + c.id) * TAU)) ** 8;
        if (f < PHI ** -3) continue;
        col3[0] = g[o + 2]; col3[1] = g[o + 3]; col3[2] = g[o + 4];
        put(g[o], g[o + 1], col3, f, g[o + 5]);
      }
    });
  },
};
LIFE.surf = {
  list: [],
  draw(t) {
    eachPoint("coast", 6, (g, c) => {
      for (let o = 0; o < g.length; o += 6) {
        const p = (t * PHI ** -1 + unitOf(o * 7919 + c.id) * 21) % 55;
        if (p > 21) continue;
        col3[0] = g[o + 2] + (255 - g[o + 2]) * PHI ** -1; col3[1] = g[o + 3] + (255 - g[o + 3]) * PHI ** -1; col3[2] = g[o + 4] + (255 - g[o + 4]) * PHI ** -1;
        put(g[o], g[o + 1], col3, (1 - p / 21) * PHI ** -1, g[o + 5]);
      }
    });
  },
};
// Their places in the order of drawing: water and ground first, then what walks, then what flies.
{
  const at = (k) => LIFE_ORDER.indexOf(k);
  LIFE_ORDER.splice(at("mould"), 0, "glitter", "surf", "floes", "bioluminescence", "schools", "whales", "fire", "dunes", "grasswaves");
  LIFE_ORDER.splice(at("snakes"), 0, "colonies", "herds", "hunters", "waders", "dust");
  LIFE_ORDER.splice(at("macaws"), 0, "leaffall", "swarms", "soarers", "vees");
}
// Only the Earth's own life runs on the Earth; none of it on the plane.
for (const k of ["herds", "hunters", "colonies", "swarms", "waders", "schools", "whales", "floes", "dust", "fire", "bioluminescence", "vees", "soarers", "grasswaves", "dunes", "leaffall", "glitter", "surf"]) {
  const g = LIFE[k], step = g.step, draw = g.draw;
  if (step) g.step = function (t) { if (earthOn()) step.call(this, t); };
  g.draw = function (t) { if (earthOn()) draw.call(this, t); };
}

// ---- weather and light over the Earth ---------------------------------------------------------------------
// Drawn over the ground and its life, a cell a pixel like the life layer: the shadows of clouds, the haze a
// short view leaves, rain or snow, the clouds themselves in the month's regime, polar night and aurora.
const wxCv = document.createElement("canvas"), wxCtx = wxCv.getContext("2d");
const shCv = document.createElement("canvas"), shCtx = shCv.getContext("2d");
const auCv = document.createElement("canvas"), auCtx = auCv.getContext("2d");
const WEATHER = {};
function sizeWeather() {
  for (const c of [wxCv, shCv, auCv]) if (c.width !== TW || c.height !== TH) { c.width = TW; c.height = TH; }
}
/** The month's cloud regime, amount (0-1) and optical depth at plane cell (x, y). */
function cloudAt(x, y) {
  const E = EDATA, lat = latOfY(y), i = Math.floor(mod(x, E_W) / M_CELL), j = Math.max(0, Math.min(MH - 1, Math.floor(y / M_CELL))), k = j * MW + i;
  return { type: E.mK[EM][k], amount: E.mC[EM][k] / 255, lat };
}
// A puff: a cluster of domed bubbles seen from above, lit from the upper left, in DIRT's dots: solid where it is
// thick, speckled where it thins at the edge, as sprayed paint. Fog and stratus are one broad, flat, thin
// bubble; wave clouds a smooth lens; cirrus a thin streak.
const puffCache = new Map();
function puff(kind, r, seed, light, shadeC, tone) {
  const key = kind + ":" + r + ":" + seed + ":" + tone;
  let p = puffCache.get(key);
  if (p) return p;
  const long = kind === "streak" ? PHI * PHI : 1, Wd = Math.ceil(2 * r * long) + 3, Hd = 2 * r + 3;
  const hmap = new Float32Array(Wd * Hd), bub = [];
  const nB = kind === "puff" ? 5 + (seed % 5) : kind === "veil" ? 3 : 1;
  for (let b = 0; b < nB; b++) {
    const a = b * GOLDEN_ANGLE + seed, d = b ? r * (0.25 + 0.3 * u3(seed, b, 1541)) : 0, rb = r * (b ? 0.38 + 0.25 * u3(seed, b, 1543) : kind === "puff" ? 0.62 : 1);
    bub.push(Wd / 2 + Math.cos(a) * d * long, Hd / 2 + Math.sin(a) * d, rb);
  }
  const flat = kind === "veil" ? PHI ** -2 : kind === "streak" ? PHI ** -3 : kind === "lens" ? PHI ** -1 : 1;
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    let h = 0;
    for (let b = 0; b < bub.length; b += 3) {
      const dx = (x - bub[b]) / long, dy = (y - bub[b + 1]) * (kind === "lens" ? PHI : 1), rb = bub[b + 2], q = 1 - (dx * dx + dy * dy) / (rb * rb);
      if (q > 0) h = Math.max(h, Math.sqrt(q) * rb * flat);
    }
    hmap[y * Wd + x] = h;
  }
  if (kind === "streak") {
    // Cirrus: thin strands along the wind, hair-fine, each a little curved, thicker in its middle.
    hmap.fill(0);
    const strands = 5 + (seed % 8);
    for (let k = 0; k < strands; k++) {
      const y0 = Hd / 2 + (u3(seed, k, 1545) - 0.5) * r * PHI, bend = (u3(seed, k, 1547) - 0.5) * r * PHI ** -1, len = Wd * (0.5 + 0.5 * u3(seed, k, 1549)), x0 = (Wd - len) * u3(seed, k, 1551);
      for (let x = Math.floor(x0); x < x0 + len && x < Wd; x++) {
        const u = (x - x0) / len, y = Math.round(y0 + bend * Math.sin(Math.PI * u) + Math.sin(x / 5 + k) * 0.6);
        if (y >= 1 && y < Hd - 1) hmap[y * Wd + x] = Math.max(hmap[y * Wd + x], Math.sin(Math.PI * u) * r * PHI ** -2 + 0.6);
      }
    }
  }
  const c = document.createElement("canvas"), s2 = document.createElement("canvas");
  c.width = s2.width = Wd; c.height = s2.height = Hd;
  const g = c.getContext("2d"), gs = s2.getContext("2d"), im = g.createImageData(Wd, Hd), ims = gs.createImageData(Wd, Hd);
  const opacity = kind === "puff" ? 1 - PHI ** -3 : kind === "lens" ? PHI ** -1 : PHI ** -2, shadowA = kind === "puff" ? PHI ** -2 : kind === "lens" ? PHI ** -3 : PHI ** -5;
  for (let y = 1; y < Hd - 1; y++) for (let x = 1; x < Wd - 1; x++) {
    const h = hmap[y * Wd + x];
    if (h <= 0) continue;
    const dens = kind === "streak" ? Math.min(1, h / (r * PHI ** -3 + 0.5)) : Math.min(1, h / (r * PHI ** -2 * flat + 0.5));   // thin at the edge
    if (u3(x + seed * 31, y, 1503) > dens * PHI) continue;                        // speckled there: sprayed
    const lean = Math.max(-1, Math.min(1, ((hmap[y * Wd + x + 1] - hmap[y * Wd + x - 1]) + (hmap[(y + 1) * Wd + x] - hmap[(y - 1) * Wd + x])) * PHI));
    const q = 0.5 + 0.5 * lean, j = (y * Wd + x) * 4;
    im.data[j] = shadeC[0] + (light[0] - shadeC[0]) * q; im.data[j + 1] = shadeC[1] + (light[1] - shadeC[1]) * q; im.data[j + 2] = shadeC[2] + (light[2] - shadeC[2]) * q;
    im.data[j + 3] = 255 * opacity * Math.min(1, dens * PHI);
    ims.data[j + 3] = 255 * shadowA * Math.min(1, dens * PHI);
  }
  g.putImageData(im, 0, 0); gs.putImageData(ims, 0, 0);
  p = { c, s: s2, W: Wd, H: Hd };
  if (puffCache.size > 610) puffCache.clear();
  puffCache.set(key, p);
  return p;
}
// Each regime's puffs: lattice, radius, form, height (shadow offset) and how much of the sky they take.
// Sheets (decks, fog, stratus, frontal bands) are fields rather than puffs: see WEATHER.sheets.
const REGIME = {
  "deep convection": { g: 233, r: [34, 55], form: "puff", h: 233, cover: PHI ** -1 },
  "trade cumulus": { g: 34, r: [5, 13], form: "puff", h: 55, cover: PHI ** -2 },
  "stratocumulus deck": { sheet: "cells", h: 34, cover: 1 - PHI ** -3, alpha: 1 - PHI ** -3 },
  "coastal fog": { sheet: "fog", h: 0, cover: PHI ** -1, alpha: PHI ** -1 },
  "storm track": { sheet: "bands", h: 89, cover: 1 - PHI ** -3, alpha: 1 - PHI ** -3 },
  "polar stratus": { sheet: "stratus", h: 34, cover: 1 - PHI ** -3, alpha: PHI ** -1 },
  orographic: { g: 89, r: [13, 34], form: "lens", h: 89, cover: PHI ** -2 },
  cirrus: { g: 89, r: [34, 55], form: "streak", h: 233, cover: PHI ** -2 },
  "fair cumulus": { g: 55, r: [8, 21], form: "puff", h: 55, cover: PHI ** -2 },
  broken: { g: 55, r: [13, 34], form: "puff", h: 55, cover: PHI ** -1 },
};
const LATTICES = [34, 55, 89, 233];
let skyCols = null, skyKey = "";
function skyColours() {
  const mx = vx + VW / 2, my = vy + VH / 2, key = EM + ":" + Math.floor(mx / 2330) + ":" + Math.floor(my / 2330);
  if (key !== skyKey) {
    const pal = eLookPalettes(lookKey(EARTH.lookIdx.snow, -1, 0))[h3(Math.floor(mx / 2330), Math.floor(my / 2330), 1511) % 5].pal;
    skyCols = { light: lift(pal[2], PHI ** -1), shade: lift(mixRGB(pal[1], pal[2], PHI ** -1), PHI ** -2), rain: lift(pal[1], PHI ** -1) };
    skyKey = key;
  }
  return skyCols;
}
WEATHER.clouds = {
  draw(t) {
    const E = EDATA, cols = skyColours(), mx = vx + VW / 2, my = vy + VH / 2, sun = noonSun(latOfY(my), EM);
    const sunK = 1 / Math.max(PHI ** -1, Math.min(PHI ** 2, Math.tan((sun * Math.PI) / 180)));
    const wind = windAt(mx, my), dx = wind.c * PHI ** -3 * (0.5 + wind.sp / 8), dy = wind.s * PHI ** -3 * (0.5 + wind.sp / 8);
    const ox = t * dx, oy = t * dy;
    shCtx.clearRect(0, 0, TW, TH); wxCtx.clearRect(0, 0, TW, TH);
    const names = E.meta.cloud_types.map((c) => c.name);
    for (const g of LATTICES) {
      if (!Object.values(REGIME).some((r) => r.g === g)) continue;
      const reach = g * 1.5 + 89;
      for (let j = Math.floor((vy - reach - oy) / g); j <= Math.floor((vy + VH + reach - oy) / g); j++)
        for (let i = Math.floor((vx - reach - ox) / g); i <= Math.floor((vx + VW + reach - ox) / g); i++) {
          const px = (i + u3(i, j, 1521 + g)) * g + ox, py = (j + u3(i, j, 1523 + g)) * g + oy;
          const cl = cloudAt(px, py), reg = REGIME[names[cl.type]];
          // Clouds gather in fields, with clear sky between, as they do: the odds rise and fall over 610 cells.
          const field = 2 * smooth(0.25, 0.75, vnoise(px - ox, py - oy, 610, 1561));
          if (!reg || reg.g !== g || u3(i, j, 1525 + g) >= cl.amount * reg.cover * field * PHI ** -1) continue;
          const big = u3(i, j, 1531 + g) < PHI ** -3 ? PHI : 1;
          const r = Math.round((reg.r[0] + (reg.r[1] - reg.r[0]) * u3(i, j, 1527 + g) ** PHI) * big), p = puff(reg.form, r, h3(i, j, 1529) % 13, cols.light, cols.shade, skyKey);
          const sx = px - tox - p.W / 2, sy = py - toy - p.H / 2, off = reg.h * sunK * PHI ** -1;
          if (reg.form === "streak") {
            for (const [ctx, img, o] of [[shCtx, p.s, off], [wxCtx, p.c, 0]]) {
              ctx.save(); ctx.translate(Math.round(px - tox + o), Math.round(py - toy + o)); ctx.rotate(wind.a); ctx.drawImage(img, -p.W / 2, -p.H / 2); ctx.restore();
            }
            continue;
          }
          if (reg.h) shCtx.drawImage(p.s, Math.round(sx + off), Math.round(sy + off));
          wxCtx.drawImage(p.c, Math.round(sx), Math.round(sy));
        }
    }
  },
};
// Sheets: stratocumulus decks in closed cells, fog lying smooth, polar stratus a grey sheet, and the frontal
// bands of the storm tracks, worked out every 3 cells and eased, drifting with the wind, a little lit from the
// upper left where they thicken.
WEATHER.sheets = {
  img: null, shimg: null, cv: document.createElement("canvas"), sh: document.createElement("canvas"),
  draw(t) {
    const E = EDATA, names = E.meta.cloud_types.map((c) => c.name), K = 3, SW = Math.ceil(TW / K) + 2, SH = Math.ceil(TH / K) + 2;
    if (this.cv.width !== SW || this.cv.height !== SH) { this.cv.width = this.sh.width = SW; this.cv.height = this.sh.height = SH; this.img = null; }
    const g = this.cv.getContext("2d"), gs = this.sh.getContext("2d");
    if (!this.img) { this.img = g.createImageData(SW, SH); this.shimg = gs.createImageData(SW, SH); }
    const d = this.img.data, ds = this.shimg.data, cols = skyColours(), mx = vx + VW / 2, my = vy + VH / 2, wind = windAt(mx, my);
    const ox = t * wind.c * PHI ** -3, oy = t * wind.s * PHI ** -3, v = new Float32Array(SW * SH);
    let any = false;
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
      const x = tox + (i - 1) * K, y = toy + (j - 1) * K, cl = cloudAt(x, y), reg = REGIME[names[cl.type]];
      if (!reg || !reg.sheet) continue;
      const X = x - ox, Y = y - oy, want = cl.amount * reg.cover * PHI ** -1;         // eased, so the ground shows through
      let f;
      if (reg.sheet === "cells") {
        const gC = 21, i0 = Math.floor(X / gC), j0 = Math.floor(Y / gC);
        let d1 = Infinity, d2 = Infinity;
        for (let b = j0 - 1; b <= j0 + 1; b++) for (let a = i0 - 1; a <= i0 + 1; a++) {
          const dd = (X - (a + u3(a, b, 1571)) * gC) ** 2 + (Y - (b + u3(a, b, 1573)) * gC) ** 2;
          if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
        }
        f = smooth(0, 5, (Math.sqrt(d2) - Math.sqrt(d1)) / 2) * smooth(1 - want - 0.1, 1 - want + 0.1, 1 - vnoise(X, Y, 233, 1575) * PHI ** -1);
      } else if (reg.sheet === "bands") {
        const along = X * wind.c + Y * wind.s, across = -X * wind.s + Y * wind.c;
        f = smooth(1 - want - 0.12, 1 - want + 0.12, 0.6 * vnoise(along * PHI ** -2, across, 144, 1577) + 0.4 * vnoise(X, Y, 55, 1579));
      } else {
        const n = reg.sheet === "fog" ? vnoise(X, Y, 233, 1581) : 0.6 * vnoise(X, Y, 144, 1583) + 0.3 * vnoise(X, Y, 34, 1585) + 0.1 * vnoise(X, Y, 13, 1587);
        f = smooth(1 - want - 0.15, 1 - want + 0.15, n);
      }
      v[j * SW + i] = f * reg.alpha; any = any || f > 0;
      ds[(j * SW + i) * 4 + 3] = reg.h ? 255 * f * PHI ** -3 : 0;
    }
    if (!any) return false;
    // The sheet itself in DIRT's dots: every cell a dot or not, as likely as the field there is thick, the dots
    // riding with the cloud; lit from the upper left where the sheet thickens.
    if (!this.full || this.full.width !== TW || this.full.height !== TH) { this.full = wxCtx.createImageData(TW, TH); this.fcv = document.createElement("canvas"); this.fcv.width = TW; this.fcv.height = TH; }
    const F = this.full.data, fox = Math.floor(ox), foy = Math.floor(oy);
    F.fill(0);
    for (let y = 0; y < TH; y++) {
      const fy = y / K + 1, j0 = Math.floor(fy), ty = fy - j0;
      if (j0 + 1 >= SH) break;
      for (let x = 0; x < TW; x++) {
        const fx = x / K + 1, i0 = Math.floor(fx), tx = fx - i0;
        if (i0 + 1 >= SW) break;
        const k = j0 * SW + i0, a = bil(v[k], v[k + 1], v[k + SW], v[k + SW + 1], tx, ty);
        if (a <= 0.02 || u3(x + tox - fox, y + toy - foy, 1591) >= a * PHI) continue;
        const lean = Math.max(-1, Math.min(1, (v[k] - v[k + SW + 1]) * PHI * 2)), q = 0.5 + 0.5 * lean, o = (y * TW + x) * 4;
        F[o] = cols.shade[0] + (cols.light[0] - cols.shade[0]) * q; F[o + 1] = cols.shade[1] + (cols.light[1] - cols.shade[1]) * q; F[o + 2] = cols.shade[2] + (cols.light[2] - cols.shade[2]) * q;
        F[o + 3] = 255 * Math.min(1, a * PHI);
      }
    }
    this.fcv.getContext("2d").putImageData(this.full, 0, 0);
    gs.putImageData(this.shimg, 0, 0);
    const sun = noonSun(latOfY(my), EM), off = Math.round(55 / Math.max(PHI ** -1, Math.min(PHI ** 2, Math.tan((sun * Math.PI) / 180))) * PHI ** -1);
    shCtx.imageSmoothingEnabled = false;
    shCtx.drawImage(this.sh, -K + off, -K + off, SW * K, SH * K);
    wxCtx.drawImage(this.fcv, 0, 0);
    return true;
  },
};
WEATHER.rain = {
  drops: null, n: 0,
  reset() { this.drops = null; },
  draw(t) {
    const mx = vx + VW / 2, my = vy + VH / 2, pr = eSite(mx, my, {}, true), rate = pr.P, snow = pr.T < 0;
    const want = Math.min(1597, Math.round(rate * (snow ? 55 : 89) * PHI ** -1));
    if (!this.drops || this.drops.length < 3 * want) this.drops = new Float32Array(3 * Math.max(want, 89));
    const d = this.drops, cols = skyColours(), col = snow ? cols.light : cols.rain;
    if (this.n !== want) { for (let k = 0; k < want; k++) { d[k * 3] = vx + rnd() * VW; d[k * 3 + 1] = vy + rnd() * VH; d[k * 3 + 2] = rnd() * TAU; } this.n = want; }
    const w = windAt(mx, my), fx = w.c * PHI ** -1 + (snow ? 0 : PHI), fy = w.s * PHI ** -1 + (snow ? PHI ** -2 : PHI * PHI);
    wxCtx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${snow ? 0.85 : PHI ** -1})`;
    for (let k = 0; k < want; k++) {
      let x = d[k * 3] + fx + (snow ? Math.sin(t / 21 + d[k * 3 + 2]) * PHI ** -1 : 0), y = d[k * 3 + 1] + fy;
      if (x > vx + VW) x -= VW; if (x < vx) x += VW; if (y > vy + VH) y -= VH;
      d[k * 3] = x; d[k * 3 + 1] = y;
      const sx = Math.floor(x - tox), sy = Math.floor(y - toy);
      if (snow) wxCtx.fillRect(sx, sy, 1, 1);
      else for (let q = 0; q < 3; q++) wxCtx.fillRect(sx - Math.round((q * fx) / PHI), sy - Math.round((q * fy) / PHI), 1, 1);
    }
  },
};
// The aurora in the long polar night, seen from above as it is from orbit: sinuous bands of light, green at
// their core and rose at their poleward edge, finely rayed along their length, in the greenest and the rosiest
// of the paintings nearest the looks of cold sea and of autumn.
WEATHER.aurora = {
  img: null,
  draw(t) {
    const my = vy + VH / 2, lat = latOfY(my), day = dayHours(lat, EM);
    if (Math.abs(lat) < 58 || day > 8) return false;
    if (!this.img || this.img.width !== TW || this.img.height !== TH) this.img = auCtx.createImageData(TW, TH);
    const d = this.img.data;
    d.fill(0);
    const green = pop(eLookPalettes(lookKey(EARTH.lookIdx["sea, upwelling"], -1, 0))[0].pal[2]), rose = pop(eLookPalettes(lookKey(EARTH.lookIdx["temperate forest, turning"], -1, 0))[0].pal[1]);
    const pole = lat >= 0 ? -1 : 1;                                               // the poleward side: up in the north
    for (let band = 0; band < 2; band++) {
      const base = TH * (0.3 + 0.4 * band) + Math.sin(t / 377 + band * 3) * 34;
      for (let x = 0; x < TW; x++) {
        const X = x + tox, yc = base + 55 * Math.sin(X / 377 + t / 233 + band * 2) + 21 * Math.sin(X / 89 - t / 144 + band);
        const ray = 0.55 + 0.45 * Math.sin(X * 0.9 + t / 8 + band) * vnoise(X, t * 0.3, 8, 1533 + band);
        const f = smooth(0.2, 0.7, vnoise(X + t * 0.5, band * 999, 144, 1531 + band)) * ray;
        if (f < PHI ** -4) continue;
        const Wd = 5 + 13 * f;
        for (let q = -Wd; q <= Wd * PHI; q++) {
          const y = Math.round(yc + q * pole);
          if (y < 0 || y >= TH) continue;
          const u = q / Wd, a = 255 * f * (q < 0 ? 1 + u : Math.max(0, 1 - u / PHI)) * PHI ** -1, c = q > Wd * PHI ** -1 ? rose : green, j = (y * TW + x) * 4;
          if (a > d[j + 3]) { d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = a; }
        }
      }
    }
    auCtx.putImageData(this.img, 0, 0);
    return true;
  },
};
/** The haze a short view leaves over the ground: the shorter the view, the thicker; dust-coloured where the air is dusty. */
function veil() {
  const E = EDATA, mx = vx + VW / 2, my = vy + VH / 2;
  const km = viewOf(eBilin(E.view, AW, AH, E_CELL, mx, my)), aod = (eBilin(E.aod, AW, AH, E_CELL, mx, my) / 255) * 1.5;
  const a = PHI ** -2 * Math.max(0, 1 - Math.log(Math.max(3, km) / 3) / Math.log(100)) ** PHI;
  if (a < 0.01) return;
  const cols = skyColours(), dusty = eSite(mx, my, {}, false).arid < 0.2 && aod > 0.3;
  const c = dusty ? eLookPalettes(lookKey(EARTH.lookIdx.desert, -1, 0))[0].pal[2] : cols.light;
  cx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  cx.fillRect(0, 0, cv.width, cv.height);
}
const NO_WEATHER = /nowx/.test(location.hash);                  // for looking at the ground alone
function earthOverlay(now) {
  if (!EDATA || !placed || NO_WEATHER) return;
  sizeWeather();
  const ox = Math.round((tox - vx) * R), oy = Math.round((toy - vy) * R), w = TW * R, h = TH * R;
  WEATHER.clouds.draw(tick);
  WEATHER.sheets.draw(tick);
  cx.imageSmoothingEnabled = false;
  cx.drawImage(shCv, ox, oy, w, h);
  veil();
  WEATHER.rain.draw(tick);
  cx.drawImage(wxCv, ox, oy, w, h);
  const mx = vx + VW / 2, my = vy + VH / 2, day = dayHours(latOfY(my), EM);
  if (day < 3) { cx.fillStyle = `rgba(4,6,18,${day < 1 ? PHI ** -2 : PHI ** -3})`; cx.fillRect(0, 0, cv.width, cv.height); }
  if (WEATHER.aurora.draw(tick)) { cx.globalCompositeOperation = "lighter"; cx.drawImage(auCv, ox, oy, w, h); cx.globalCompositeOperation = "source-over"; }
}

// ---- the readout: everything the atlas knows about a place -------------------------------------------------
const placeEl = document.createElement("div");
placeEl.className = "place"; placeEl.hidden = true;
stage.appendChild(placeEl);
function placeText(html) { placeEl.innerHTML = html; placeEl.hidden = false; }
const GROUND_NAMES = ["leaf litter", "grass", "sand dunes", "desert pavement", "a salt flat", "ice-wedge polygons", "moss and lichen", "rock and scree", "ice",
                      "open water among the reeds", "tidal mud", "open sea", "a lake", "sea ice", "a river", "snow", "a coral reef"];
const fmt = (v, d = 0) => v.toLocaleString("en", { maximumFractionDigits: d });
function describe(x, y, here) {
  const E = EDATA, M = E.meta, pr = eSite(x, y, {}, true), k = pr.k, lat = latOfY(y), lon = lonOfX(x);
  const where = `${fmt(Math.abs(lat), 1)}°${lat >= 0 ? "N" : "S"} ${fmt(Math.abs(lon), 1)}°${lon >= 0 ? "E" : "W"}`;
  const i2 = Math.floor(mod(x + EWX, E_W) / M_CELL), j2 = Math.max(0, Math.min(MH - 1, Math.floor((y + EWY) / M_CELL))), k2 = j2 * MW + i2;
  const temps = E.mT.map((a) => tempOf(a[k2])), lo = Math.min(...temps), hi = Math.max(...temps);
  const rainMm = rainOf(E.mP[EM][k2]) * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][EM], year = E.mP.reduce((s, a, m) => s + rainOf(a[k2]) * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m], 0);
  const cl = E.mC[EM][k2] / 255, ct = M.cloud_types[E.mK[EM][k2]].name, view = viewOf(E.view[k]), big = E.bigsky[k] / 255, clear = E.clear[k] / 255;
  const month = `${MONTHS[EM]}: ${fmt(tempOf(E.mT[EM][k2]))} °C, the year from ${fmt(lo)} to ${fmt(hi)} °C · ${fmt(rainMm)} mm of rain (${fmt(year)} in the year)`;
  // "A big sky" where the big-sky index passes 0.4, as over the open, flat, clear-aired upper two fifths of the land.
  const sky = `cloud ${fmt(cl * 100)}%, ${ct} · clear days ${fmt(clear * 100)}% · you see ${fmt(view, view < 10 ? 1 : 0)} km${big > 0.4 ? " under a big sky" : ""}`;
  let name, lines;
  if (pr.surf === SEA) {
    const sea = E.seaName[k] ? M.seas[E.seaName[k] - 1] : null, zone = M.marine[pr.zone];
    name = sea ? sea.name : "The open ocean";
    lines = [`${zone ? zone.name + " · " + zone.what : "the sea"} · ${M.warmth[pr.warmth]} water`, month, sky, pr.snow > 0.05 ? `sea ice over ${fmt(pr.snow * 100)}%` : ""];
  } else {
    const eco = M.ecoregions[E.eco[k]], B = M.biomes[pr.surf], kp = M.koppen[E.koppen[k]], region = E.region[k] ? M.regions[E.region[k] - 1] : null;
    name = pr.surf === LAKE ? "A lake" + (eco ? " in the " + eco.name : "") : eco ? eco.name : B || "Land";
    lines = [`${REALM_OF(EARTH, pr.realm) || ""}${B && pr.surf !== LAKE ? " › " + B : ""}${region && region.kind !== "continent" ? " › " + region.name : ""}`,
             `${kp ? kp.code + " " + kp.name : ""} · ${M.holdridge[E.hold[k]] || ""} · ${M.soils[pr.soil].name}: ${M.soils[pr.soil].what}`,
             `canopy ${fmt(pr.canopy)} m · ${iceSheet(pr, lat, lon) ? `the rock under the ice lies at ${fmt(E.elev[k])} m` : `${fmt(E.elev[k])} m up`} · ${seasonWords(pr)}${pr.snow > 0.05 ? ` · snow over ${fmt(pr.snow * 100)}%` : ""}`,
             month, sky];
  }
  return `<span class=pl-name>${name}</span><div class=pl-line>${where}</div>` + lines.filter(Boolean).map((l) => `<div class=pl-line>${l}</div>`).join("") +
         (here ? `<div class=pl-here>${here}</div>` : "");
}
// The atlas's elevation is the rock's: under the Greenland and Antarctic ice sheets it is the bed, not the ice.
const iceSheet = (pr, lat, lon) => pr.surf === 15 && pr.soil === 0 && (lat < -60 || (lat > 59 && lon > -75 && lon < -10));
// How a place stands in its year, in words fit for its kind of year.
const SEASON_WORDS = [
  { 0: "evergreen" },
  { 0: "in leaf", 1: "coming into leaf", 2: "turning colour", 3: "leafless in the cold" },
  { 0: "green in the wet season", 4: "gold in the dry season" },
  { 0: "green in the wet winter", 4: "gold in the summer drought" },
  { 0: "in its short summer", 3: "dormant under the cold" },
  { 3: "bare, waiting for rain", 5: "in flower after rain" },
  { 3: "ice" },
  { 0: "green", 1: "greening", 3: "dormant in the cold", 4: "gold and dry" },
];
function seasonWords(pr) {
  const B = pr.surf <= 15 ? EARTH.biome[pr.surf] : null;
  return B ? SEASON_WORDS[B.ph][pr.phase] || PHASE_NAMES[pr.phase] : "";
}
/** What is under the pointer: a creature, a plant, or the ground. */
function hereAt(x, y) {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const lx = Math.floor(x) + dx - tox, ly = Math.floor(y) + dy - toy;
    if (lifeS && lx >= 0 && ly >= 0 && lx < TW && ly < TH && lifeS[ly * TW + lx] >= 0) return spName(lifeS[ly * TW + lx]);
  }
  const b = birdAt(x, y);
  if (b >= 0) { const sp = eSpecies("flocks", eSite(BHX[b], BHY[b], {}, true), latOfY(y)); if (sp) return spName(sp.list[BKIN[b] % sp.list.length]); }
  const c = chunks.get(ck(Math.floor(x / N), Math.floor(y / N)));
  if (!c || !c.plant) return "";
  const i = mod(Math.floor(y), N) * N + mod(Math.floor(x), N);
  return c.plant[i] !== 65535 ? spName(c.plant[i]) : GROUND_NAMES[c.ground[i]] || "";
}
let readPending = null, lastPointer = null;
cv.addEventListener("pointermove", (ev) => {
  if (!earthOn() || down) return;
  lastPointer = [ev.clientX, ev.clientY];
  if (readPending !== null) return;
  readPending = requestAnimationFrame(() => {
    readPending = null;
    const [x, y] = worldAt(lastPointer[0], lastPointer[1]);
    placeText(describe(x, y, hereAt(x, y)));
  });
});
let readTick = 0;
function readCentre() {
  // Without a pointer, the readout follows the middle of the view.
  if (!earthOn() || (lastPointer && !down) || ++readTick % 21) return;
  placeText(describe(vx + VW / 2, vy + VH / 2, ""));
}

// ---- the bar: Earth, the months, the globe, and back to the plane ------------------------------------------
const style = document.createElement("style");
style.textContent = `
  .earth-ui { display: flex; gap: 8px; align-items: center; flex: none; }
  .earth-ui .month { min-width: 9ch; text-align: center; font-variant-numeric: tabular-nums; }
  .earth-ui button.on { border-color: var(--ink); }
  .place { position: absolute; left: 13px; bottom: 13px; max-width: min(64ch, calc(100% - 26px)); background: rgba(15, 10, 7, 0.78);
           padding: 8px 13px; font: 11px/1.5 var(--mono); color: var(--ink); pointer-events: none; z-index: 2; }
  .place .pl-name { font: italic 400 17px/1.25 var(--serif); display: block; margin-bottom: 3px; }
  .place .pl-line { color: var(--muted); }
  .place .pl-here { color: var(--ink); margin-top: 3px; }
  canvas.globe { cursor: grab; z-index: 1; }
  .stage { overflow: hidden; }                                       /* the ground, magnified under the streets, stays in its frame */
  @media (max-width: 640px) { .place { font-size: 10px; } .place .pl-name { font-size: 15px; } .bar { flex-wrap: wrap; row-gap: 8px; } }
`;
document.head.appendChild(style);
const ui = document.createElement("div");
ui.className = "earth-ui";
ui.innerHTML = `<button id="e-earth" title="The Earth, woven: every place in the paintings nearest its colours">Earth</button>
  <span id="e-months" hidden><button id="e-prev" aria-label="The month before">‹</button><span class="month" id="e-month"></span><button id="e-next" aria-label="The month after">›</button>
  <button id="e-year" title="Let the months turn by themselves">Year</button></span>
  <button id="e-globe" hidden>Globe</button><button id="e-closer" hidden title="Down to the streets: every building at its height (or pinch, or ctrl and scroll)">Closer</button>
  <button id="e-up" hidden title="Back up to the ground">Up</button><button id="e-plane" hidden>Plane</button>`;
document.querySelector(".bar").appendChild(ui);
const $ = (id) => document.getElementById(id);
let yearTimer = null;
function showMode() {
  if (SITE) { $("e-earth").hidden = $("e-plane").hidden = true; $("e-globe").hidden = MODE === "globe"; }
  else $("e-globe").hidden = MODE !== "earth";
  $("e-earth").hidden = SITE || MODE !== "plane";
  $("e-months").hidden = MODE === "plane";
  $("e-plane").hidden = SITE || MODE === "plane";
  $("e-month").textContent = MONTHS[EM];
  $("e-year").classList.toggle("on", !!yearTimer);
  $("e-closer").hidden = MODE !== "earth";
  $("e-up").hidden = MODE !== "city";
  globeCv.style.display = MODE === "globe" ? "block" : "none";
  cityCv.style.display = MODE === "city" ? "block" : "none";
  if (MODE !== "city") cv.style.visibility = MODE === "globe" ? "hidden" : "visible";
  if (MODE === "plane") placeEl.hidden = true;
  else if (MODE === "globe") placeText(`<span class=pl-name>The Earth in ${MONTHS[EM]}</span><div class=pl-line>every place in the paintings nearest its own colours · point to name a place, and click to go down into it</div>`);
}
$("e-earth").addEventListener("click", () => toGlobe());
// On the website the globe is the site's own: Globe goes back up to it.
const upToSite = () => window.parent.postMessage({ dirt: "up", lat: MODE === "city" ? CITY.lat : latOfY(vy + VH / 2), lon: MODE === "city" ? CITY.lon : lonOfX(vx + VW / 2) }, "*");
$("e-globe").addEventListener("click", () => (SITE && window.parent !== window ? upToSite() : toGlobe()));
$("e-plane").addEventListener("click", () => { if (yearTimer) { clearInterval(yearTimer); yearTimer = null; } toPlane(); });
$("e-prev").addEventListener("click", () => setMonth(EM - 1));
$("e-next").addEventListener("click", () => setMonth(EM + 1));
$("e-year").addEventListener("click", () => {
  if (yearTimer) { clearInterval(yearTimer); yearTimer = null; }
  else yearTimer = setInterval(() => setMonth(EM + 1), 8000);
  showMode();
});

// ---- the globe --------------------------------------------------------------------------------------------
// Woven as the Artist Website's globe is, after Dorothy Napangardi's salt paintings: two families of strands,
// one down the world and one round it, gathering and parting, runs of dots dropped to leave dark blocks. Each
// dot wears its place's paintings for the month, the land heavier than the sea, and cloud over it where the
// month is cloudy.
const globeCv = document.createElement("canvas");
globeCv.className = "globe";
globeCv.setAttribute("aria-label", "The Earth, woven of dots in the paintings nearest each place's colours: drag to turn it, point to name a place, click to go down into it");
globeCv.style.display = "none";
stage.appendChild(globeCv);
// The streets' own canvas (see the end of this file, and earth-city.js).
const cityCv = document.createElement("canvas");
cityCv.className = "globe";
cityCv.setAttribute("aria-label", "The streets, every building at its height, in the place's own colours: drag to move, scroll or pinch to go nearer or further");
cityCv.style.display = "none";
stage.appendChild(cityCv);
const GLOBE = { lat0: 0.3, lon0: -1.2, dots: null, cols: null, n: 0, drag: null, spin: 1 };
function globeDots() {
  const lat = [], lon = [], fam = [];
  let s = 20260923;
  const rnd2 = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const strands = 377, down = 233;
  for (let i = 0; i < strands; i++) {
    const base = (i / strands) * TAU, wob = 0.03 + rnd2() * 0.06, turns = 2 + Math.floor(rnd2() * 4), gap = 19 + Math.floor(rnd2() * 15), ph = Math.floor(rnd2() * gap);
    for (let k = 0; k <= down; k++) {
      if ((k + ph) % gap < 4) continue;
      const la = -1.55 + (k / down) * 3.1;
      lat.push(la); lon.push(base + wob * Math.sin(turns * la)); fam.push(0);
    }
  }
  const rings = 233, round = 466;
  for (let j = 0; j < rings; j++) {
    const la0 = -1.55 + ((j + 0.5) / rings) * 3.1, sway = 0.015 + rnd2() * 0.035, beats = 3 + Math.floor(rnd2() * 5), hole = 17 + Math.floor(rnd2() * 17), off = Math.floor(rnd2() * hole);
    const n = Math.max(34, Math.round(round * Math.cos(la0)));
    for (let t = 0; t < n; t++) {
      if ((t + off) % hole < 5) continue;
      const lo = (t / n) * TAU;
      lat.push(Math.max(-1.56, Math.min(1.56, la0 + sway * Math.sin(beats * lo)))); lon.push(lo); fam.push(1);
    }
  }
  const n = lat.length, D = { n, sLat: new Float32Array(n), cLat: new Float32Array(n), sLon: new Float32Array(n), cLon: new Float32Array(n), fam: Uint8Array.from(fam), lat: Float32Array.from(lat), lon: Float32Array.from(lon) };
  for (let i = 0; i < n; i++) { D.sLat[i] = Math.sin(lat[i]); D.cLat[i] = Math.cos(lat[i]); D.sLon[i] = Math.sin(lon[i]); D.cLon[i] = Math.cos(lon[i]); }
  return D;
}
/** Each dot's colour for the month: its place's look, in one of the five nearest paintings; and how heavy it sits. */
function globeColours() {
  if (!GLOBE.dots) GLOBE.dots = globeDots();
  const D = GLOBE.dots, E = EDATA, n = D.n, cols = new Uint8Array(n * 4);
  const snowKey = lookKey(EARTH.lookIdx.snow, -1, 0), iceKey = lookKey(EARTH.lookIdx.ice, -1, 0), lakeKey = lookKey(EARTH.lookIdx.lake, -1, 0), saltKey = lookKey(EARTH.lookIdx.salt, -1, 0);
  const cloud = skyColoursAt();
  for (let i = 0; i < n; i++) {
    const la = (D.lat[i] * 180) / Math.PI, lo = ((((D.lon[i] * 180) / Math.PI + 180) % 360) + 360) % 360;
    const ci = Math.min(AW - 1, Math.floor(lo * 4)), cj = Math.min(AH - 1, Math.max(0, Math.floor((90 - la) * 4))), k = cj * AW + ci;
    const k2 = Math.floor(cj / 2) * MW + Math.floor(ci / 2), surf = E.surf[k], snow = EARTH.SN[k2], T = EARTH.T[k2];
    let key, weight = 1;
    if (surf === SEA) { key = snow > 0.5 ? iceKey : lookKey(seaLook(E.marine[k] & 15, E.marine[k] >> 4), -1, 0); weight = 0; }
    else if (surf === LAKE) key = T < -3 ? iceKey : lakeKey;
    else if (E.wbits[k] & (W_GLACIER | W_SHELF_ICE) || surf === 15) key = iceKey;
    else if (E.wbits[k] & W_SALT) key = saltKey;
    else if (snow > 0.5) key = snowKey;
    else {
      const B = EARTH.biome[surf], ph = ePhase(B.ph, T, EARTH.Tp[k2], EARTH.P[k2], EARTH.Pn[k2], EARTH.Pm[k2]);
      key = lookKey(B.look[ph], E.soil[k], eBare(B, (E.canopy[k] * 45) / 255, aridOf(E.arid[k])));
    }
    const pals = eLookPalettes(key), pal = pals[h3(ci >> 3, cj >> 3, key) % pals.length].pal;
    let c = pal[D.fam[i] ? (i % 3 === 0 ? 2 : 1) : i % 5 === 0 ? 2 : 1];
    if ((E.mC[EM][k2] / 255) * PHI ** -2 > unitOf(i * 7919)) { c = cloud; weight = 2; }       // cloud over it this month
    cols[i * 4] = c[0]; cols[i * 4 + 1] = c[1]; cols[i * 4 + 2] = c[2]; cols[i * 4 + 3] = weight;
  }
  GLOBE.cols = cols;
}
function skyColoursAt() { const pal = eLookPalettes(lookKey(EARTH.lookIdx.snow, -1, 0))[0].pal; return lift(pal[2], PHI ** -2); }
let globeImg = null;
function drawGlobe(now) {
  const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
  if (globeCv.width !== W || globeCv.height !== H) { globeCv.width = W; globeCv.height = H; globeImg = null; }
  if (!GLOBE.cols) return;
  const g = globeCv.getContext("2d");
  if (!globeImg) globeImg = g.createImageData(W, H);
  const d = globeImg.data;
  new Uint32Array(d.buffer).fill((255 << 24) | (GROUND[2] << 16) | (GROUND[1] << 8) | GROUND[0]);
  if (!GLOBE.drag && !GLOBE.hover && !REDUCED) GLOBE.lon0 += PHI ** -15 * GLOBE.spin;          // a turn in about two and a half minutes
  const R0 = Math.min(W, H) * 0.44, cxg = W / 2, cyg = H / 2, s0 = Math.sin(GLOBE.lat0), c0 = Math.cos(GLOBE.lat0), sL = Math.sin(GLOBE.lon0), cL = Math.cos(GLOBE.lon0);
  const D = GLOBE.dots, C = GLOBE.cols, dotL = Math.max(2, Math.round(R0 / 233)), dotS = Math.max(1, dotL - 1);
  for (let i = 0; i < D.n; i++) {
    const w = C[i * 4 + 3];
    if (!w && (i & 1)) continue;                                                   // open water: every other dot
    const sinA = D.sLon[i] * cL - D.cLon[i] * sL, cosA = D.cLon[i] * cL + D.sLon[i] * sL;
    const z = s0 * D.sLat[i] + c0 * D.cLat[i] * cosA;
    if (z <= 0.02) continue;
    const X = D.cLat[i] * sinA, Y = c0 * D.sLat[i] - s0 * D.cLat[i] * cosA;
    const px = Math.round(cxg + X * R0), py = Math.round(cyg - Y * R0);
    const lit = (0.5 + 0.6 * Math.max(0, (-X * 0.5 + Y * 0.55 + z * 0.67))) * (w === 1 ? 1 : w === 2 ? PHI ** -0.5 : PHI ** -1) * Math.min(1, z * PHI * 2);
    const dot = w === 1 ? dotL : dotS;                                              // the land sits heavier than the sea
    for (let yy = 0; yy < dot; yy++) for (let xx = 0; xx < dot; xx++) {
      const x2 = px + xx, y2 = py + yy;
      if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue;
      const j = (y2 * W + x2) * 4;
      d[j] = Math.min(255, C[i * 4] * lit); d[j + 1] = Math.min(255, C[i * 4 + 1] * lit); d[j + 2] = Math.min(255, C[i * 4 + 2] * lit);
    }
  }
  g.putImageData(globeImg, 0, 0);
  GLOBE.R0 = R0; GLOBE.cx = cxg; GLOBE.cy = cyg; GLOBE.dpr = dpr;
}
/** Where on the Earth a point of the globe's canvas is, or null off it. */
function globeAt(clientX, clientY) {
  const r = globeCv.getBoundingClientRect(), dpr = GLOBE.dpr || 1, x = ((clientX - r.left) * dpr - GLOBE.cx) / GLOBE.R0, y = -((clientY - r.top) * dpr - GLOBE.cy) / GLOBE.R0;
  const rho = Math.hypot(x, y);
  if (rho >= 1) return null;
  const c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c), s0 = Math.sin(GLOBE.lat0), c0 = Math.cos(GLOBE.lat0);
  const lat = rho ? Math.asin(cc * s0 + (y * sc * c0) / rho) : GLOBE.lat0;
  const lon = GLOBE.lon0 + Math.atan2(x * sc, rho * cc * c0 - y * sc * s0);
  return { lat: (lat * 180) / Math.PI, lon: ((((lon * 180) / Math.PI + 180) % 360) + 360) % 360 - 180 };
}
globeCv.addEventListener("pointerdown", (ev) => { globeCv.setPointerCapture(ev.pointerId); GLOBE.drag = { x: ev.clientX, y: ev.clientY, moved: false }; });
globeCv.addEventListener("pointermove", (ev) => {
  if (GLOBE.drag) {
    const dx = ev.clientX - GLOBE.drag.x, dy = ev.clientY - GLOBE.drag.y, k = (GLOBE.dpr || 1) / (GLOBE.R0 || 300);
    if (Math.hypot(dx, dy) > 3) GLOBE.drag.moved = true;
    GLOBE.lon0 -= dx * k; GLOBE.lat0 = Math.max(-1.3, Math.min(1.3, GLOBE.lat0 + dy * k));
    GLOBE.drag.x = ev.clientX; GLOBE.drag.y = ev.clientY;
    if (dx) GLOBE.spin = dx > 0 ? -1 : 1;
    return;
  }
  const at = globeAt(ev.clientX, ev.clientY);
  GLOBE.hover = !!at;
  if (!at) return;
  const x = xOfLon(at.lon), y = yOfLat(at.lat);
  placeText(describe(x, y, "") + `<div class=pl-here>click to go down into it</div>`);
});
globeCv.addEventListener("pointerleave", () => { GLOBE.hover = false; });
globeCv.addEventListener("pointerup", (ev) => {
  const d = GLOBE.drag;
  GLOBE.drag = null;
  if (d && !d.moved) { const at = globeAt(ev.clientX, ev.clientY); if (at) toEarth(at.lat, at.lon); }
});

// ---- each frame -------------------------------------------------------------------------------------------
{
  const plainFrame = frame;
  frame = function (now) {
    if (MODE === "globe") { requestAnimationFrame(frame); drawGlobe(now); return; }
    if (MODE === "city") { requestAnimationFrame(frame); cityFrame(now); return; }
    plainFrame(now);
    if (earthOn()) { earthOverlay(now); readCentre(); }
  };
}
// A link can open the Earth: #earth=lat,lon[,month] goes down into a place, #globe opens the globe.
function followHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = h.match(/(?:^|&)earth=(-?[\d.]+),(-?[\d.]+)(?:,(\d+))?/);
  if (m) {
    const go = () => (placed ? toEarth(+m[1], +m[2], m[3] !== undefined ? (+m[3] - 1 + 12) % 12 : undefined) : setTimeout(go, 55));
    go();
  } else if (/(?:^|&)globe(?:&|$)/.test(h)) toGlobe();
  else if (SITE) { const go = () => (placed ? toEarth(38.8895, -77.0353) : setTimeout(go, 55)); go(); }
}
// The website drives its DIRT from outside: {dirt: "goto", lat, lon, month (0-11), streets (go straight down to them)}.
window.addEventListener("message", (ev) => {
  const m = ev.data;
  if (!m || m.dirt !== "goto" || ev.source !== window.parent) return;
  const go = () => {
    if (!placed) return setTimeout(go, 55);
    if (MODE === "city") upFromCity();
    toEarth(+m.lat, +m.lon, m.month).then(() => { if (m.streets) toCity(+m.lat, +m.lon); });
  };
  go();
});
followHash();
window.addEventListener("hashchange", followHash);
showMode();

// ---- closer: the streets (earth-city.js) --------------------------------------------------------------------
// From the ground of DIRT Earth, nearer: pinch, ctrl and scroll, "+" or Closer goes down to the streets of the
// place in the middle of the view, at the ground's own scale, and on in; going further out than the ground's own
// scale comes back up to it, at wherever the streets were left.
const cityG = cityCv.getContext("2d");
const planeMpp = () => 111320 / E_DEG / R;                             // metres a device pixel on the ground (north to south)
let cityShown = "";
function toCity(lat, lon) {
  if (MODE !== "earth") return;
  MODE = "city";
  CITY.fromMpp = planeMpp();
  cityGo(lat, lon, CITY.fromMpp / PHI);
  showMode();
  cityShown = "";
}
/** The ground's canvases (the GPU's and the page's), magnified under the streets, or as they were. */
function groundTransform(t, hide) {
  for (const c of stage.querySelectorAll("canvas")) {
    if (c === cityCv || c === globeCv) continue;
    c.style.transformOrigin = "50% 50%";
    c.style.transform = t;
    c.style.visibility = hide ? "hidden" : "visible";
  }
}
function upFromCity() {
  groundTransform("", false);
  MODE = "earth";
  const x = xOfLon(CITY.lon), y = yOfLat(CITY.lat);
  if (Math.abs(x - (vx + VW / 2)) > 3 || Math.abs(y - (vy + VH / 2)) > 3) { vx = x - VW / 2; vy = y - VH / 2; }
  velX = velY = 0;
  showMode();
  if (window.parent !== window) window.parent.postMessage({ dirt: "ground", lat: CITY.lat, lon: CITY.lon }, "*");
}
const centreLat = () => latOfY(vy + VH / 2), centreLon = () => lonOfX(vx + VW / 2);
function cityFrame(now) {
  const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (cityCv.width !== w || cityCv.height !== h) { cityCv.width = w; cityCv.height = h; CITY.dirty = true; }
  drawStreets(cityG, w, h, now);
  // The ground of DIRT Earth under the streets, magnified to their scale and to true proportions (the ground is
  // drawn a degree of longitude as wide as a degree of latitude), centred where the streets are.
  const s0 = CITY.fromMpp / CITY.mpp, cl = Math.cos((CITY.lat * Math.PI) / 180);
  const dx = ((xOfLon(CITY.lon) - (vx + VW / 2)) * R) / dpr, dy = ((yOfLat(CITY.lat) - (vy + VH / 2)) * R) / dpr;
  groundTransform(CITY.veil >= 1 ? "" : `scale(${s0 * cl}, ${s0}) translate(${-dx}px, ${-dy}px)`, CITY.veil >= 1);
  const said = CITY.err ? "err" : CITY.missing ? "coming" : "here";
  if (said !== cityShown) {
    cityShown = said;
    placeText(CITY.err
      ? `<span class=pl-name>The streets could not be reached</span><div class=pl-line>${CITY.err} · they come from OpenFreeMap, which this page may not be allowed to fetch; Up goes back to the ground</div>`
      : `<span class=pl-name>The streets, ${Math.abs(CITY.lat).toFixed(3)}° ${CITY.lat >= 0 ? "N" : "S"}, ${Math.abs(CITY.lon).toFixed(3)}° ${CITY.lon >= 0 ? "E" : "W"}</span><div class=pl-line>every building at its height, in the place's own colours this month · drag to move, scroll or pinch to go nearer; further out goes back up to the ground${CITY.missing ? " · the streets are coming" : ""}</div>`);
  }
}
function cityWheel(ev, dpr) {
  const f = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.012 : 0.0016) * (ev.deltaMode === 1 ? 16 : 1)), r = cityCv.getBoundingClientRect();
  cityZoom(f, (ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr, cityCv.width, cityCv.height);
  if (CITY.mpp > CITY.fromMpp * PHI) upFromCity();
}
$("e-closer").addEventListener("click", () => toCity(centreLat(), centreLon()));
$("e-up").addEventListener("click", upFromCity);
let groundPinch = 0;
stage.addEventListener("wheel", (ev) => {
  if (MODE === "earth" && ev.ctrlKey) {
    ev.preventDefault(); ev.stopPropagation();
    groundPinch -= ev.deltaY;
    if (groundPinch > 55) { groundPinch = 0; toCity(centreLat(), centreLon()); }
    else if (groundPinch < -89) { groundPinch = 0; if (SITE && window.parent !== window) upToSite(); }
  } else if (MODE === "city") { ev.preventDefault(); ev.stopPropagation(); cityWheel(ev, window.devicePixelRatio || 1); }
}, { capture: true, passive: false });
// by hand: one finger drags the streets, two pinch them; two fingers spreading on the ground go down to them
const fingers = new Map();
let pinchFrom = 0;
const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
stage.addEventListener("pointerdown", (ev) => {
  if (MODE !== "earth" && MODE !== "city") return;
  fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (fingers.size === 2) pinchFrom = spread();
  if (MODE === "city") cityCv.setPointerCapture(ev.pointerId);
}, true);
stage.addEventListener("pointermove", (ev) => {
  const f = fingers.get(ev.pointerId);
  if (!f) return;
  const dpr = window.devicePixelRatio || 1, dx = ev.clientX - f.x, dy = ev.clientY - f.y;
  if (fingers.size === 2 && pinchFrom > 0) {
    f.x = ev.clientX; f.y = ev.clientY;
    const d = spread(), [a, b] = [...fingers.values()], r = stage.getBoundingClientRect();
    if (MODE === "earth" && d / pinchFrom > 1.3) { pinchFrom = 0; ev.stopPropagation(); toCity(centreLat(), centreLon()); return; }
    if (MODE === "earth" && d / pinchFrom < 0.62 && SITE && window.parent !== window) { pinchFrom = 0; ev.stopPropagation(); upToSite(); return; }
    if (MODE === "city") {
      cityZoom(d / pinchFrom, ((a.x + b.x) / 2 - r.left) * dpr, ((a.y + b.y) / 2 - r.top) * dpr, cityCv.width, cityCv.height);
      pinchFrom = d;
      if (CITY.mpp > CITY.fromMpp * PHI) upFromCity();
    }
    ev.stopPropagation();
    return;
  }
  f.x = ev.clientX; f.y = ev.clientY;
  if (MODE === "city" && fingers.size === 1) { cityPan(dx * dpr, dy * dpr); ev.stopPropagation(); }
}, true);
const letFinger = (ev) => { fingers.delete(ev.pointerId); if (fingers.size < 2) pinchFrom = 0; };
stage.addEventListener("pointerup", letFinger, true);
stage.addEventListener("pointercancel", letFinger, true);
document.addEventListener("keydown", (ev) => {
  if (MODE === "earth" && (ev.key === "+" || ev.key === "=")) { toCity(centreLat(), centreLon()); return; }
  if (MODE === "earth" && (ev.key === "-" || ev.key === "_") && SITE && window.parent !== window) { upToSite(); return; }
  if (MODE !== "city") return;
  const dpr = window.devicePixelRatio || 1, W = cityCv.width, H = cityCv.height;
  if (ev.key === "+" || ev.key === "=") cityZoom(PHI, W / 2, H / 2, W, H);
  else if (ev.key === "-" || ev.key === "_") { cityZoom(1 / PHI, W / 2, H / 2, W, H); if (CITY.mpp > CITY.fromMpp * PHI) upFromCity(); }
  else if (ev.key === "Escape") upFromCity();
  else {
    const step = { ArrowLeft: [89, 0], ArrowRight: [-89, 0], ArrowUp: [0, 89], ArrowDown: [0, -89] }[ev.key];
    if (!step) return;
    cityPan(step[0] * dpr, step[1] * dpr);
  }
  ev.preventDefault(); ev.stopImmediatePropagation();
}, true);

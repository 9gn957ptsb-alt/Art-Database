// Tests for DRIFT's ultracode (see dirt/README.md, "Ultracode"), run on the real code: the block between
// "const UC = {" and "requestAnimationFrame(propel);" is lifted out of drift.js and run against made-up readings of the
// last frame whose right answers are known. No browser and nothing to install:
//     node dirt/engine/ultracode.test.mjs
import fs from 'fs';
const src = fs.readFileSync(new URL('./drift.js', import.meta.url), 'utf8');
const a = src.indexOf('  const UC = {'), b = src.indexOf('  requestAnimationFrame(propel);\n  UC.places');
const block = src.slice(a, b);
function harness(opts = {}) {
  const store = new Map(), env = {
    vx: 0, vy: 0, VW: 400, VH: 300, PHI: (1 + Math.sqrt(5)) / 2, REDUCED: false, flight: null, down: null,
    at: { hidden: true }, ANOM: { at: 0 }, MODE: opts.MODE, GLG: { reflection: () => env.reading, setThrust: (x, y) => { env.thrust = [x, y]; }, putIn: () => { env.sheets++; } },
    sheets: 0, thrust: [0, 0], reading: null, now: 100000,
  };
  const localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const fn = new Function('env', 'localStorage', 'addEventListener', 'getComputedStyle', 'document', 'performance', 'requestAnimationFrame', `
    with (env) { const plane = () => true; ${block}; env.UC = UC; env.reflectOn = reflectOn; env.remember = remember; env.propel = propel; env.memory = memory; env.MEM_G = MEM_G; }`);
  fn(env, localStorage, () => {}, () => ({ getPropertyValue: () => '' }), { hidden: false, createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) }, { now: () => env.now }, () => {});
  return env;
}
// a world image: colour at world texel (X, Y), seeded
const world = (X, Y, seed = 1) => { const h = (n) => { n = Math.imul(n ^ (n >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const k = (X * 73856093) ^ (Y * 19349663) ^ (seed * 83492791); return [255 * h(k), 255 * h(k + 1), 255 * h(k + 2)]; };
// a reading of the view whose top-left cell is (x0, y0), uw by uh texels of `cells` cells each (w = uw here)
function reading(x0, y0, uw, uh, cells, colourAt, at = 0) {
  const data = new Uint8Array(uw * uh * 4);
  for (let y = 0; y < uh; y++) for (let x = 0; x < uw; x++) {
    const X = Math.floor(x0 / cells) + x, Y = Math.floor(y0 / cells) + y, c = colourAt(X, Y, x, y), i = (y * uw + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return { w: uw, h: uh, uw, uh, cells, x0, y0, data, at };
}
let fails = 0; const check = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) fails++; };
const fmt = (v) => v.map((x) => x.toFixed(3)).join(', ');

// 1. motion compensation: the same world, seen from a moved view, is not new
{ const e = harness(); const C = 8;
  e.reflectOn(reading(8000, 4000, 34, 21, C, (X, Y) => world(X, Y)));
  e.reflectOn(reading(8000 + 3 * C, 4000 - 2 * C, 34, 21, C, (X, Y) => world(X, Y)));
  check('moved view, same world: novelty ~0', e.UC.novelty < 1e-9, 'novelty ' + e.UC.novelty.toFixed(4));
  // control: had the compensation the wrong sign, it would read as change
  const f = harness(); f.reflectOn(reading(8000, 4000, 34, 21, C, (X, Y) => world(X, Y)));
  f.UC.hist[0].px = 8000 + 6 * C; f.UC.hist[0].py = 4000 - 4 * C;   // pretend the last look was elsewhere (a wrong shift)
  f.reflectOn(reading(8000 + 3 * C, 4000 - 2 * C, 34, 21, C, (X, Y) => world(X, Y)));
  check('control: a wrong shift reads as change', f.UC.novelty > 0.2, 'novelty ' + f.UC.novelty.toFixed(3)); }
// 2. direction: a change on the right steers right; at the bottom, down
{ const e = harness(); const C = 8, img = (X, Y) => world(X, Y);
  e.reflectOn(reading(0, 0, 34, 21, C, img));
  e.reflectOn(reading(0, 0, 34, 21, C, (X, Y, x) => x >= 26 ? world(X, Y, 2) : img(X, Y)));
  check('change on the right steers right', e.UC.dir[0] > 0.12 && Math.abs(e.UC.dir[1]) < 0.05, 'dir ' + fmt(e.UC.dir)); }
{ const e = harness(); const C = 8, img = (X, Y) => world(X, Y);
  e.reflectOn(reading(0, 0, 34, 21, C, img));
  e.reflectOn(reading(0, 0, 34, 21, C, (X, Y, x, y) => y >= 15 ? world(X, Y, 2) : img(X, Y)));
  check('change at the bottom steers down', e.UC.dir[1] > 0.08 && Math.abs(e.UC.dir[0]) < 0.05, 'dir ' + fmt(e.UC.dir)); }
// 2b. everything changing everywhere (a view melting all over) gives no strong direction
{ const e = harness(); const C = 8;
  e.reflectOn(reading(0, 0, 34, 21, C, (X, Y) => world(X, Y, 1)));
  e.reflectOn(reading(0, 0, 34, 21, C, (X, Y) => world(X, Y, 2)));
  const m = Math.hypot(...e.UC.dir);
  check('change everywhere: no strong direction', m < 0.08, 'dir ' + fmt(e.UC.dir) + ' (|dir| ' + m.toFixed(3) + ', a real feature gives ~0.3)'); }
// 2c. it looks a third of a second back, not a moment back: a change 380 ms ago is still new at 455 ms (a moment-back
// look would call it old, and a thirteen-a-second reading would see almost nothing new); and it keeps only what it needs
{ const e = harness(); const C = 8, img = (X, Y) => world(X, Y), changed = (X, Y, x) => x >= 26 ? world(X, Y, 2) : img(X, Y);
  e.reflectOn(reading(0, 0, 34, 21, C, img, 0));
  e.reflectOn(reading(0, 0, 34, 21, C, changed, 380));
  e.reflectOn(reading(0, 0, 34, 21, C, changed, 455));
  check('looks a third of a second back: still new at 455 ms, steering right', e.UC.novelty > 0.05 && e.UC.dir[0] > 0.12, 'novelty ' + e.UC.novelty.toFixed(3) + ', dir ' + fmt(e.UC.dir));
  for (let t = 530; t < 30000; t += 75) e.reflectOn(reading(0, 0, 34, 21, C, changed, t));
  check('after 400 looks: novelty gone, history short', e.UC.novelty < 1e-9 && e.UC.hist.length <= 7, 'novelty ' + e.UC.novelty.toFixed(4) + ', history ' + e.UC.hist.length + ' looks'); }
// 3. a tall (phone) view: a change at the side still steers mostly sideways
{ const e = harness(); const C = 8, img = (X, Y) => world(X, Y);
  e.reflectOn(reading(0, 0, 20, 40, C, img));
  e.reflectOn(reading(0, 0, 20, 40, C, (X, Y, x, y) => x >= 15 && y >= 15 && y < 25 ? world(X, Y, 2) : img(X, Y)));
  check('tall view, change at the side: steers sideways', e.UC.dir[0] > 0.08 && Math.abs(e.UC.dir[0]) > 3 * Math.abs(e.UC.dir[1]), 'dir ' + fmt(e.UC.dir)); }
// 4. colour: a change of hue at the same light is new
{ const e = harness(); const C = 8, A = [200, 40, 120], lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const B = [40, 40 + (lum(A) - 0.3 * 40 - 0.59 * 40 - 0.11 * 120) / 0.59, 120];     // another colour of the same light
  e.reflectOn(reading(0, 0, 34, 21, C, () => A));
  e.reflectOn(reading(0, 0, 34, 21, C, () => B));
  check('same light, other colour: novelty seen', e.UC.novelty > 0.2, `lum ${lum(A).toFixed(1)} vs ${lum(B).toFixed(1)}, novelty ${e.UC.novelty.toFixed(3)}`); }
// 5. memory: squares to the west push it east; old visits push less
{ const e = harness(); const G = e.MEM_G; e.vx = 10 * G; e.vy = 10 * G; const cx = e.vx + e.VW / 2, cy = e.vy + e.VH / 2;
  const i0 = Math.floor(cx / G), j0 = Math.floor(cy / G), realNow = Date.now;
  e.memory.set((i0 - 1) + ',' + j0, Date.now()); e.memory.set((i0 - 1) + ',' + (j0 + 1), Date.now()); e.memory.set((i0 - 1) + ',' + (j0 - 1), Date.now());
  e.remember();
  check('visited to the west: pushed east', e.UC.mem[0] > 0.3 && Math.abs(e.UC.mem[1]) < 0.15, 'mem ' + fmt(e.UC.mem));
  const f = harness(); f.vx = e.vx; f.vy = e.vy;
  for (const k of [(i0 - 1) + ',' + j0, (i0 - 1) + ',' + (j0 + 1), (i0 - 1) + ',' + (j0 - 1)]) f.memory.set(k, Date.now() - 20 * 60000);   // twenty minutes ago
  f.remember();
  check('visited twenty minutes ago: pushed much less', f.UC.mem[0] > 0 && f.UC.mem[0] < 0.2 * e.UC.mem[0], 'mem ' + fmt(f.UC.mem)); }
// 6. gating: on the Earth it does not move; on the plane, left alone, it does, toward the change
for (const MODE of ['earth', undefined]) {
  const e = harness({ MODE }); const C = 8, img = (X, Y) => world(X, Y);
  e.reading = reading(0, 0, 34, 21, C, img); e.now = 100000; e.UC.idleAt = 0; e.propel(e.now);
  e.reading = reading(0, 0, 34, 21, C, (X, Y, x) => x >= 26 ? world(X, Y, 3) : img(X, Y));
  const x0 = e.vx; for (let i = 0; i < 600; i++) { e.now += 16.7; e.propel(e.now); }
  const moved = e.vx - x0;
  if (MODE === 'earth') check('on the Earth: does not move', moved === 0, 'moved ' + moved.toFixed(2));
  else check('on the plane, alone: moves toward the change, with a wake', moved > 100 && e.thrust[0] > 5 && e.sheets >= 1, `moved ${moved.toFixed(1)} cells in 10 s, thrust ${fmt(e.thrust)}, sheets ${e.sheets}`);
}
// 6b. the engine: never past top speed; the throttle has most of its speed within a second; the rudder sweeps
{ const e = harness(); const C = 8, img = (X, Y) => world(X, Y);
  e.reading = reading(0, 0, 34, 21, C, img); e.UC.idleAt = 0; e.propel(e.now);
  e.reading = reading(0, 0, 34, 21, C, (X, Y, x) => x >= 26 ? world(X, Y, 3) : img(X, Y));
  let top = 0, at1 = 0;
  for (let i = 1; i <= 300; i++) { e.now += 16.7; e.propel(e.now); top = Math.max(top, Math.hypot(e.UC.vx, e.UC.vy)); if (i === 60) at1 = e.UC.speed; }
  const full = e.UC.speed;
  check('never past top speed (105 cells a second)', top <= 105 + 1e-9, 'fastest ' + top.toFixed(1));
  check('the throttle: over 90% of its speed within a second', at1 >= 0.9 * full && full > 20, `${at1.toFixed(1)} of ${full.toFixed(1)} cells a second`);
  // turn the change to the bottom: the heading sweeps round over ~phi^-1 s, it does not snap
  e.reading = reading(0, 0, 34, 21, C, (X, Y, x, y) => y >= 15 ? world(X, Y, 4) : img(X, Y));
  const h0 = Math.atan2(e.UC.hy, e.UC.hx); e.now += 16.7; e.propel(e.now);
  const h1 = Math.atan2(e.UC.hy, e.UC.hx); for (let i = 0; i < 180; i++) { e.now += 16.7; e.propel(e.now); }
  const h3 = Math.atan2(e.UC.hy, e.UC.hx), deg = (a) => (a * 180 / Math.PI).toFixed(0) + '°';
  check('the rudder: turns a little in a frame, most of the way in 3 s', Math.abs(h1 - h0) < 0.15 && h3 > 0.8, `heading ${deg(h0)} → ${deg(h1)} after a frame → ${deg(h3)} after 3 s`); }
// 7. touched: stops at once and stays still while touched; a second after the last touch it takes over again
{ const e = harness(); const C = 8, img = (X, Y) => world(X, Y);
  e.reading = reading(0, 0, 34, 21, C, img); e.UC.idleAt = 0; e.propel(e.now);
  e.reading = reading(0, 0, 34, 21, C, (X, Y, x) => x >= 26 ? world(X, Y, 3) : img(X, Y));
  for (let i = 0; i < 300; i++) { e.now += 16.7; e.propel(e.now); }
  const w0 = Math.hypot(...e.thrust);
  e.UC.idleAt = e.now; const x0 = e.vx; for (let i = 0; i < 54; i++) { e.now += 16.7; e.propel(e.now); }
  const w1 = Math.hypot(...e.thrust);
  check('touched: the view stops at once; the wake fades to under 2% in 0.9 s', e.vx === x0 && w1 < 0.02 * w0, `wake ${w0.toFixed(1)} → ${w1.toFixed(2)} (${(w1 / w0 * 100).toFixed(2)}%)`);
  for (let i = 0; i < 66; i++) { e.now += 16.7; e.propel(e.now); }
  check('left alone a second: it takes over again', e.vx - x0 > 1, `moved ${(e.vx - x0).toFixed(1)} cells in the next 1.1 s`); }
// 8. taste: drawn to the part of the view as alive as the kept stills, and slower once the whole view is near them
{ const C = 8, calm = (X, Y) => world(X, Y).map((v) => 110 + v * 0.03), busy = (X, Y) => world(X, Y);   // calm: a faint grain
  // left half busy (grain), right half calm and flat: a taste for busy pulls left, a taste for calm pulls right
  const img = (X, Y, x) => x < 17 ? busy(X, Y) : calm(X, Y);
  const e = harness(); e.TASTE = { stills: [{ life: 0.6 }] };
  e.reflectOn(reading(0, 0, 34, 21, C, img)); e.reflectOn(reading(0, 0, 34, 21, C, img));
  const f = harness(); f.TASTE = { stills: [{ life: 0.01 }] };
  f.reflectOn(reading(0, 0, 34, 21, C, img)); f.reflectOn(reading(0, 0, 34, 21, C, img));
  check('taste for the busy pulls to the busy side, for the calm to the calm side', e.UC.dir[0] < -0.05 && f.UC.dir[0] > 0.05, 'dir ' + fmt(e.UC.dir) + ' / ' + fmt(f.UC.dir)); }
{ const C = 8, img = (X, Y) => world(X, Y), changed = (X, Y, x) => x >= 26 ? world(X, Y, 3) : img(X, Y);
  const run = (taste) => { const e = harness(); if (taste) e.TASTE = taste;
    e.reading = reading(0, 0, 34, 21, C, img); e.UC.idleAt = 0; e.propel(e.now);
    e.reading = reading(0, 0, 34, 21, C, changed);
    for (let i = 0; i < 300; i++) { e.now += 16.7; e.propel(e.now); }
    return [e.UC.speed, e.UC.life]; };
  const [free, life] = run(null), [held] = run({ stills: [{ life }] });
  check('a view as alive as the kept stills: it lingers (phi^-2 of its speed)', Math.abs(held / free - 0.382) < 0.05, `${held.toFixed(1)} against ${free.toFixed(1)} cells a second`); }
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);

// game.js - open the build's game (or the game as it is) in Chromium, past the start card and the wake-up when asked.
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs");
// A copy of the browser under its own name and its own profile folder: other workflows on this machine stop their
// browsers by name (that stopped every run here at once, 20 Oct), and a pattern on the name never meets this one.
const EXE = "/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf10/build/brw/w10/w10brw";
const PROFILES = "/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf10/build/brw/profiles";
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#8a6"/></svg>';
const VIEWS = { phone: { width: 390, height: 844, dsf: 2, mobile: true }, desk: { width: 1280, height: 720, dsf: 1, mobile: false } };
const HASH = "building/golden-continuity-allison-island-residence-by-riva-spain/1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Count the game's own frames, to wait for n of them.
// With a virtual clock (opts.virtual, ms a frame), the game runs as on a device drawing at that rate, however slowly
// the software renderer draws: each frame's time steps by that much, and performance.now() reads the same clock.
const HOOK = (vms) => `(() => { const raf = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance); window.__frames = 0; window.__ft = [];
  const VMS = ${vms || 0}; let V = realNow(), R = realNow();
  if (VMS) { performance.now = () => V + Math.min(realNow() - R, VMS * 0.8); }
  window.requestAnimationFrame = function (cb) { if (cb && cb.name === "frame") { return raf(function (t) { if (VMS) { V += VMS; R = realNow(); t = V; } const a = realNow(); cb(t); window.__ft.push(realNow() - a); window.__frames += 1; }); } return raf(cb); }; })();`;

async function open(opts) {
  const V = VIEWS[opts.view], port = opts.port || 8803;
  const dir = PROFILES + "/p" + process.pid + "_" + Date.now(); fs.mkdirSync(dir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(dir, { executablePath: EXE, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
    viewport: { width: V.width, height: V.height }, deviceScaleFactor: V.dsf, isMobile: V.mobile, hasTouch: V.mobile });
  const browser = { close: async () => { await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
  await ctx.addInitScript(HOOK(opts.virtual));
  // Every toast as it is said (its fade runs on the wall clock, which the software renderer outruns, so a shot
  // often misses it): window.__toasts, and state() gives the last since the previous state().
  await ctx.addInitScript(() => { window.__toasts = []; document.addEventListener("DOMContentLoaded", () => { const t = document.getElementById("toast"); if (!t) { return; }
    new MutationObserver(() => { if (t.classList.contains("show") && window.__toasts[window.__toasts.length - 1] !== t.textContent) { window.__toasts.push(t.textContent); } }).observe(t, { childList: true, attributes: true, characterData: true, subtree: true }); }); });
  if (opts.init) { await ctx.addInitScript(opts.init); }
  const P = ctx.pages()[0] || await ctx.newPage();
  P.setDefaultTimeout(900000);
  const errors = [];
  P.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  P.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text())) { errors.push("console: " + m.text()); } if (m.type() === "warning" && /WebGL|GL_/.test(m.text())) { errors.push("gl warning: " + m.text()); } });
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await P.goto(opts.url || `http://127.0.0.1:${port}/worlds/rocket/index.html#${opts.hash || HASH}`, { waitUntil: "load" });
  if (!opts.play) {
    await P.waitForFunction(() => { const b = document.getElementById("begin"); return b && !b.disabled; }, null, { timeout: 180000 }).catch((e) => { console.log("errors", errors); throw e; });
    await P.click("#begin");
  }
  await P.waitForFunction(() => window.Rocket && window.Rocket.debug().place && window.Rocket.debug().intro(), null, { timeout: 600000 });
  await P.evaluate((q) => { const d = window.Rocket.debug(); d.hold(q); d.flush(); }, opts.quality || (opts.view === "phone" ? 0.5 : 1));
  if (opts.view === "phone") { await P.evaluate(() => { document.body.dataset.touch = "true"; }); }
  return { browser, ctx, P, errors };
}
function frames(P, n) {
  return P.evaluate((n) => new Promise((done) => { const f0 = window.__frames; const f = () => { if (window.__frames - f0 >= n) { done(); } else { setTimeout(f, 15); } }; f(); }), n || 2);
}
function state(P) {
  return P.evaluate(() => {
    const d = window.Rocket.debug(), c = d.cam ? d.cam() : {}, h = d.head ? d.head() : null, r = (v) => +(+v).toFixed(3);
    return { pov: d.pov ? d.pov() : "-", P: { x: r(d.P.x), y: r(d.P.y), z: r(d.P.z), yaw: r(d.P.yaw), pitch: r(d.P.pitch), face: r(d.P.face || 0), ground: d.P.ground, walked: r(d.P.walked || 0), amount: r(d.P.amount || 0) },
             eye: c.eye ? c.eye.map(r) : null, camD: c.camD != null ? r(c.camD) : null, blend: !!c.blend, drawMe: c.drawMe,
             head: h ? { x: r(h.x), y: r(h.y), z: r(h.z), phase: h.phase } : null, left: d.holoLeft ? r(d.holoLeft()) : null,
             toast: document.getElementById("toast").classList.contains("show") ? document.getElementById("toast").textContent : "",
             said: (window.__toasts || []).splice(0).join(" | "), aim: d.aim() };
  });
}
module.exports = { open, frames, state, sleep, VIEWS };

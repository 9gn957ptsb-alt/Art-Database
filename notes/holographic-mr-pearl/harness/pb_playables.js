// pb_playables.js - the pickleball game as a YouTube Playable (28 Oct 2026). With a mock of the SDK (ytgame, as if in
// YouTube's frame): first frame then ready, each once; the language asked of the SDK; a pause halts the loop and the
// game's clock and saves, a resume goes on; the save comes back on the next load; the score an integer; nothing in
// localStorage. Then the built bundle (scripts/build_pickleball.js --playable) top-level with the real SDK: the SDK
// the first script, no errors, no request to any host but this one and www.youtube.com; and a frame with no size.
// node pb_playables.js [port]
const { chromium } = require("playwright");
const { execFileSync, spawn } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");
const port = +(process.argv[2] || 8817), bad = [];
const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } };
const MOCK = (saved) => `window.ytgame = (function () {
  var calls = [], pause = [], resume = [], store = ${JSON.stringify(saved || "")};
  window.__yt = { calls: calls, pause: function () { pause.forEach(function (f) { f(); }); }, resume: function () { resume.forEach(function (f) { f(); }); }, store: function () { return store; } };
  var rec = function (n, v) { calls.push(n); return v; };
  return { IN_PLAYABLES_ENV: true, SDK_VERSION: "mock",
    game: { firstFrameReady: function () { rec("firstFrameReady"); }, gameReady: function () { rec("gameReady"); },
            saveData: function (s) { rec("saveData"); store = s; return Promise.resolve(); }, loadData: function () { rec("loadData"); return Promise.resolve(store); } },
    system: { onPause: function (f) { rec("onPause"); pause.push(f); return function () {}; }, onResume: function (f) { rec("onResume"); resume.push(f); return function () {}; },
              isAudioEnabled: function () { return rec("isAudioEnabled", true); }, onAudioEnabledChange: function () { return function () {}; }, getLanguage: function () { rec("getLanguage"); return Promise.resolve("en"); } },
    engagement: { sendScore: function (o) { rec("sendScore:" + JSON.stringify(o.value) + ":" + Number.isInteger(o.value)); return Promise.resolve(); } },
    health: { logError: function () { rec("logError"); }, logWarning: function () { rec("logWarning"); } } };
})();`;
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), errors = [];
  let p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(String(e)));
  await p.addInitScript(MOCK(""));
  await p.goto(`http://127.0.0.1:${port}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.__yt.calls.indexOf("gameReady") >= 0, null, { timeout: 120000 });
  let calls = await p.evaluate(() => window.__yt.calls.slice());
  const fi = calls.indexOf("firstFrameReady"), gi = calls.indexOf("gameReady");
  check(fi >= 0 && gi > fi && calls.filter((c) => c === "firstFrameReady").length === 1 && calls.filter((c) => c === "gameReady").length === 1, "firstFrameReady, then gameReady, each once: " + calls.join(" "));
  check(calls.indexOf("getLanguage") >= 0 && calls.indexOf("loadData") >= 0, "the language and the save asked of the SDK");
  // a level won, then the pause: the loop stops, the clock stands, the save goes to the SDK
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.courts[0].won = true; d.courts[0].up = true; d.courts.best = 9; });
  const t0 = await p.evaluate(() => { window.__yt.pause(); return window.Pickleball.debug().gt(); });
  await p.waitForTimeout(1500);
  const held = await p.evaluate(() => ({ gt: window.Pickleball.debug().gt(), running: window.Pickleball.debug().running(), store: window.__yt.store() }));
  check(!held.running && held.gt === t0, "the pause halts the loop and the game's clock (" + t0.toFixed(3) + " → " + held.gt.toFixed(3) + ")");
  check(/"won":true/.test(held.store) && /"best":9/.test(held.store), "the pause saves through the SDK: " + held.store.slice(0, 90));
  await p.evaluate(() => window.__yt.resume()); await p.waitForTimeout(800);
  const went = await p.evaluate(() => ({ gt: window.Pickleball.debug().gt(), running: window.Pickleball.debug().running() }));
  check(went.running && went.gt > t0 && went.gt - t0 < 1.0, "the resume goes on, without catching up (" + (went.gt - t0).toFixed(3) + " s on)");
  await p.evaluate(() => window.Pickleball.debug().YT.score(12.7));
  calls = await p.evaluate(() => window.__yt.calls.slice());
  check(calls.indexOf("sendScore:12:true") >= 0, "the score sent as an integer: " + calls.filter((c) => /sendScore/.test(c)).join(" "));
  check(await p.evaluate(() => localStorage.length === 0), "nothing in localStorage inside YouTube");
  // the next load gets the save back
  const store = held.store;
  await p.close(); p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(String(e)));
  await p.addInitScript(MOCK(store));
  await p.goto(`http://127.0.0.1:${port}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.__yt && window.__yt.calls.indexOf("gameReady") >= 0, null, { timeout: 120000 });
  const back = await p.evaluate(() => { const d = window.Pickleball.debug(); return { won: d.courts[0].won, up: d.courts[0].up, best: d.courts.best }; });
  check(back.won && back.up && back.best === 9, "the save comes back: " + JSON.stringify(back));
  // a frame with no size (the Android app's hidden first view), then its size again
  await p.evaluate(() => { document.getElementById("view").style.width = "0px"; document.getElementById("view").style.height = "0px"; });
  await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById("view").style.width = ""; document.getElementById("view").style.height = ""; });
  await p.waitForTimeout(600);
  check(errors.length === 0, "no errors with the mock, nor at no size: " + errors.slice(0, 2).join(" | "));
  await p.close();
  // the built bundle, top-level, with the real SDK
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbplay-")), outd = path.join(dir, "bundle");
  execFileSync("node", [path.join(__dirname, "../../../scripts/build_pickleball.js"), "--playable", outd], { stdio: "pipe" });
  const html = fs.readFileSync(path.join(outd, "index.html"), "utf8"), first = html.match(/<script[^>]*>/i)[0];
  check(first === '<script src="https://www.youtube.com/game_api/v1">', "the SDK is the bundle's first script, plain: " + first);
  check(fs.statSync(outd + ".zip").size < 5 * 1024 * 1024, "the zip is under 5 MiB: " + fs.statSync(outd + ".zip").size + " bytes");
  const sport = 8890 + Math.floor(Math.random() * 50), srv = spawn("python3", ["-m", "http.server", String(sport), "--bind", "127.0.0.1"], { cwd: outd, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  try {
    p = await ctx.newPage(); const errs = [], hosts = new Set();
    p.on("pageerror", (e) => errs.push(String(e))); p.on("request", (r) => hosts.add(new URL(r.url()).host));
    await p.goto(`http://127.0.0.1:${sport}/index.html`);
    await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => ({ sdk: !!window.ytgame, inYT: window.ytgame && window.ytgame.IN_PLAYABLES_ENV, ver: window.ytgame && window.ytgame.SDK_VERSION, ascii: window.Pickleball.debug().ascOk(), running: window.Pickleball.debug().running() }));
    check(st.sdk && st.inYT === false && st.ascii && st.running, "the bundle runs with the real SDK outside YouTube: " + JSON.stringify(st));
    check(errs.length === 0, "no errors in the bundle: " + errs.slice(0, 2).join(" | "));
    check([...hosts].every((h) => h === "127.0.0.1:" + sport || h === "www.youtube.com"), "requests only here and to www.youtube.com: " + [...hosts].join(" "));
  } finally { srv.kill(); }
  await b.close();
  console.log(bad.length ? bad.length + " FAILED" : "all ok");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

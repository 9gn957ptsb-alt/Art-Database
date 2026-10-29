// pb_playables.js - the pickleball game as a YouTube Playable (28 Oct 2026). With a mock of the SDK (ytgame, as if in
// YouTube's frame): first frame then ready, each once; the language asked of the SDK; a pause halts the loop and the
// game's clock and saves, a resume goes on; the save comes back on the next load; the score an integer; nothing in
// localStorage; the loading words up at the first frame and gone at ready; no input while paused; old or broken saves
// read without error (the first version's ten courts as the run won); a court won opens the next, without end; a 3x screen drawn at 3x; the mouse moves him. Then the built bundle (scripts/build_pickleball.js --playable) top-level with the real SDK: the SDK
// the first script, no errors, no request to any host but this one and www.youtube.com, nothing against YouTube's
// Content Security Policy (served with the header the Test Suite guide gives); and a frame with no size.
// node pb_playables.js [port]
const { chromium } = require("playwright");
const { execFileSync, spawn } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");
const port = +(process.argv[2] || 8817), bad = [];
// YouTube's Content Security Policy, as the SDK Test Suite guide gives it (developers.google.com, read 28 Oct 2026)
const CSP = "default-src 'none'; script-src 'report-sample' 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.youtube.com/game_api/v0 https://www.youtube.com/game_api/v0/ https://www.youtube.com/game_api/v1 https://www.youtube.com/game_api/v1/; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' blob: data:; sandbox allow-pointer-lock allow-same-origin allow-scripts; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:";
const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } };
const MOCK = (saved, o) => `window.ytgame = (function () {
  var calls = [], pause = [], resume = [], seen = {}, store = ${JSON.stringify(saved || "")}, fails = ${(o && o.loadFail) || 0}, delay = ${(o && o.loadDelay) || 0};
  var loading = function () { var e = document.getElementById("loading"); return !!e && !e.hidden && getComputedStyle(e).display !== "none" && /loading/i.test(e.textContent); };
  window.__yt = { calls: calls, seen: seen, pause: function () { pause.forEach(function (f) { f(); }); }, resume: function () { resume.forEach(function (f) { f(); }); }, store: function () { return store; } };
  var rec = function (n, v) { calls.push(n); return v; };
  return { IN_PLAYABLES_ENV: true, SDK_VERSION: "mock",
    game: { firstFrameReady: function () { seen.first = loading(); rec("firstFrameReady"); }, gameReady: function () { seen.ready = loading(); seen.readyAt = performance.now(); rec("gameReady"); },
            saveData: function (s) { rec("saveData"); store = s; return Promise.resolve(); },
            loadData: function () { rec("loadData"); if (fails > 0) { fails -= 1; return Promise.reject(new Error("API_UNAVAILABLE")); } return new Promise(function (r) { setTimeout(function () { r(store); }, delay); }); } },
    system: { onPause: function (f) { rec("onPause"); pause.push(f); return function () {}; }, onResume: function (f) { rec("onResume"); resume.push(f); return function () {}; },
              isAudioEnabled: function () { return rec("isAudioEnabled", true); }, onAudioEnabledChange: function () { rec("onAudioEnabledChange"); return function () {}; }, getLanguage: function () { rec("getLanguage"); return Promise.resolve("en"); } },
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
  const seen = await p.evaluate(() => window.__yt.seen);
  check(seen.first === true && seen.ready === false, "the loading words show at firstFrameReady and are gone by gameReady: " + JSON.stringify({ first: seen.first, ready: seen.ready }));
  check(seen.readyAt < 5000, "playable in under 5 s (the rule's SHOULD; software GL here, slower than a phone's): " + Math.round(seen.readyAt) + " ms");
  check(calls.indexOf("isAudioEnabled") >= 0 && calls.indexOf("onAudioEnabledChange") >= 0, "YouTube's mute read and listened to (isAudioEnabled, onAudioEnabledChange)");
  // a court won (the next appears, the score is the courts won), then the pause: the loop stops, the clock stands, the
  // save goes to the SDK
  const won1 = await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(0.5); d.winCourt(); d.courts.best = 9; return { courts: d.courts.length, won: d.won() }; });
  check(won1.courts === 2 && won1.won === 1, "a court won opens the next beside it: " + JSON.stringify(won1));
  const t0 = await p.evaluate(() => { window.__yt.pause(); return window.Pickleball.debug().gt(); });
  await p.waitForTimeout(1500);
  // paused, the game takes no input: a key, a tap on the view
  await p.keyboard.press(" "); await p.mouse.click(300, 400);
  check(await p.evaluate(() => window.Pickleball.debug().input.fire === false), "no input while paused");
  const held = await p.evaluate(() => ({ gt: window.Pickleball.debug().gt(), running: window.Pickleball.debug().running(), store: window.__yt.store() }));
  check(!held.running && held.gt === t0, "the pause halts the loop and the game's clock (" + t0.toFixed(3) + " → " + held.gt.toFixed(3) + ")");
  check(/"won":1\b/.test(held.store) && /"rally":9\b/.test(held.store), "the pause saves through the SDK: " + held.store.slice(0, 90));
  await p.evaluate(() => window.__yt.resume()); await p.waitForTimeout(800);
  const went = await p.evaluate(() => ({ gt: window.Pickleball.debug().gt(), running: window.Pickleball.debug().running() }));
  check(went.running && went.gt > t0 && went.gt - t0 < 1.0, "the resume goes on, without catching up (" + (went.gt - t0).toFixed(3) + " s on)");
  calls = await p.evaluate(() => window.__yt.calls.slice());
  check(calls.indexOf("sendScore:1:true") >= 0, "the score sent is the courts won, an integer: " + calls.filter((c) => /sendScore/.test(c)).join(" "));
  await p.evaluate(() => window.Pickleball.debug().YT.score(12.7));
  calls = await p.evaluate(() => window.__yt.calls.slice());
  check(calls.indexOf("sendScore:12:true") >= 0, "a score sent as an integer: " + calls.filter((c) => /sendScore/.test(c)).join(" "));
  check(await p.evaluate(() => localStorage.length === 0), "nothing in localStorage inside YouTube");
  // the next load gets the save back
  const store = held.store;
  await p.close(); p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(String(e)));
  await p.addInitScript(MOCK(store));
  await p.goto(`http://127.0.0.1:${port}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.__yt && window.__yt.calls.indexOf("gameReady") >= 0, null, { timeout: 120000 });
  const back = await p.evaluate(() => { const d = window.Pickleball.debug(); return { courts: d.courts.length, won: d.courts[0].won, up: d.courts[0].up, best: d.courts.best, rec: !!d.courts[0].rec }; });
  check(back.courts === 2 && back.won && back.up && back.best === 9, "the save comes back: " + JSON.stringify(back));
  check(back.rec && /"recs":\{"0":/.test(store) && store.length < 3e6, "the match won kept through the SDK's save, and played again (" + store.length + " characters)");
  // a frame with no size (the Android app's hidden first view), then its size again
  await p.evaluate(() => { document.getElementById("view").style.width = "0px"; document.getElementById("view").style.height = "0px"; });
  await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById("view").style.width = ""; document.getElementById("view").style.height = ""; });
  await p.waitForTimeout(600);
  // no end: ten courts won, the eleventh is open, and no word says it is over
  const far = await p.evaluate(() => { const d = window.Pickleball.debug(); for (let k = 0; k < 9; k++) { d.enter(d.courts.length - 1); d.run(0.5); d.winCourt(); } d.run(1.2); return { courts: d.courts.length, won: d.won(), level: d.courts[d.courts.length - 1].level, where: document.getElementById("where").textContent }; });
  check(far.courts === 11 && far.won === 10 && far.level === 11 && /10 courts won/.test(far.where) && !/complete/i.test(far.where), "endless: ten courts won, the eleventh open: " + far.where);
  check(errors.length === 0, "no errors with the mock, nor at no size: " + errors.slice(0, 2).join(" | "));
  await p.close();
  // paused and resumed while it is still loading: it waits for the courts, then plays, with no error
  p = await ctx.newPage(); { const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
    await p.addInitScript(MOCK("", { loadDelay: 1500 }));
    await p.goto(`http://127.0.0.1:${port}/worlds/pickleball/index.html`);
    await p.waitForFunction(() => window.__yt && window.__yt.calls.indexOf("loadData") >= 0, null, { timeout: 120000 });
    await p.evaluate(() => { window.__yt.pause(); window.__yt.resume(); });
    await p.waitForFunction(() => window.__yt.calls.indexOf("gameReady") >= 0, null, { timeout: 120000 }); await p.waitForTimeout(500);
    const st = await p.evaluate(() => ({ running: window.Pickleball.debug().running(), err: window.__yt.calls.filter((c) => /logError/.test(c)).length }));
    check(errs.length === 0 && st.err === 0 && st.running, "paused and resumed while loading: no error, and it plays once loaded " + JSON.stringify(st) + errs.slice(0, 1).join(""));
    await p.close(); }
  // the cloud load fails once (asked again, loaded), or for good (never saved over)
  for (const fails of [1, 2]) {
    p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
    await p.addInitScript(MOCK('{"v":2,"won":1,"rally":7}', { loadFail: fails }));
    await p.goto(`http://127.0.0.1:${port}/worlds/pickleball/index.html`);
    await p.waitForFunction(() => window.__yt && window.__yt.calls.indexOf("gameReady") >= 0, null, { timeout: 120000 });
    const st = await p.evaluate(() => { window.__yt.pause(); window.__yt.resume(); const d = window.Pickleball.debug(); return { best: d.courts.best, loads: window.__yt.calls.filter((c) => c === "loadData").length, saves: window.__yt.calls.filter((c) => c === "saveData").length }; });
    if (fails === 1) { check(errs.length === 0 && st.loads === 2 && st.best === 7 && st.saves >= 1, "a failed cloud load is asked again, and then loads: " + JSON.stringify(st)); }
    else { check(errs.length === 0 && st.loads === 2 && st.saves === 0, "a cloud load that fails twice: the game plays, and never saves over the player's save: " + JSON.stringify(st)); }
    await p.close();
  }
  // saves from another version, or broken: read without error
  for (const [old, want] of [['{"v":0,"courts":[null,{"level":"3","won":1,"matches":"x"}],"best":"x","horse":-5}', [1, 0]], ["not json", [1, 0]], ["[1,2]", [1, 0]],
                             ['{"v":1,"best":7,"horse":900,"courts":[{"won":true,"up":true},{"won":true},{"won":true,"up":true},{"won":false},{"won":true}]}', [4, 7]], ['{"v":2,"won":"1e12","rally":-3}', [1000, 0]]]) {
    p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
    await p.addInitScript(MOCK(old));
    await p.goto(`http://127.0.0.1:${port}/worlds/pickleball/index.html`);
    await p.waitForFunction(() => window.__yt && window.__yt.calls.indexOf("gameReady") >= 0, null, { timeout: 120000 });
    const got = await p.evaluate(() => { const d = window.Pickleball.debug(); return { courts: d.courts.length, best: d.courts.best }; });
    check(errs.length === 0 && got.courts === want[0] && got.best === want[1], "an old or broken save is read without error (" + old.slice(0, 24) + "): " + JSON.stringify(got));
    await p.close();
  }
  // a 3x screen drawn at 3x (not upscaled, so not soft), and a mouse's drag on the left half moves him
  const ctx3 = await b.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 3 });
  p = await ctx3.newPage(); p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`http://127.0.0.1:${port}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me && window.Pickleball.debug().running(), null, { timeout: 120000 });
  await p.waitForTimeout(500);
  check(await p.evaluate(() => document.getElementById("view").width === 2700), "a 3x screen is drawn at 3x: " + await p.evaluate(() => document.getElementById("view").width));
  const z0 = await p.evaluate(() => window.Pickleball.debug().me.z);
  await p.mouse.move(200, 400); await p.mouse.down(); await p.mouse.move(200, 330, { steps: 5 }); await p.waitForTimeout(900);
  const mv = await p.evaluate(() => ({ stick: !!window.Pickleball.debug().input.stick, z: window.Pickleball.debug().me.z }));
  await p.mouse.up();
  check(mv.stick && z0 - mv.z > 0.3, "the mouse's drag on the left half moves him: " + (z0 - mv.z).toFixed(2) + " m forward");
  check(errors.length === 0, "no errors at 3x nor with the mouse: " + errors.slice(0, 2).join(" | "));
  await p.close(); await ctx3.close();
  // the built bundle, top-level, with the real SDK
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbplay-")), outd = path.join(dir, "bundle");
  execFileSync("node", [path.join(__dirname, "../../../scripts/build_pickleball.js"), "--playable", outd], { stdio: "pipe" });
  const html = fs.readFileSync(path.join(outd, "index.html"), "utf8"), first = html.match(/<script[^>]*>/i)[0];
  check(first === '<script src="https://www.youtube.com/game_api/v1">', "the SDK is the bundle's first script, plain: " + first);
  check(fs.statSync(outd + ".zip").size < 5 * 1024 * 1024, "the zip is under 5 MiB: " + fs.statSync(outd + ".zip").size + " bytes");
  const sport = 8890 + Math.floor(Math.random() * 50), srv = spawn("python3", ["-m", "http.server", String(sport), "--bind", "127.0.0.1"], { cwd: outd, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  try {
    p = await ctx.newPage(); const errs = [], hosts = new Set(), csp = [];
    p.on("pageerror", (e) => errs.push(String(e))); p.on("request", (r) => hosts.add(new URL(r.url()).host));
    p.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) { csp.push(m.text()); } });
    await p.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI)));
    await p.route("**/index.html", async (route) => { const r = await route.fetch(); route.fulfill({ response: r, headers: Object.assign({}, r.headers(), { "content-security-policy": CSP }) }); });
    await p.goto(`http://127.0.0.1:${sport}/index.html`);
    await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => ({ sdk: !!window.ytgame, inYT: window.ytgame && window.ytgame.IN_PLAYABLES_ENV, ver: window.ytgame && window.ytgame.SDK_VERSION, ascii: window.Pickleball.debug().ascOk(), running: window.Pickleball.debug().running() }));
    check(st.sdk && st.inYT === false && st.ascii && st.running, "the bundle runs with the real SDK outside YouTube: " + JSON.stringify(st));
    check(errs.length === 0, "no errors in the bundle: " + errs.slice(0, 2).join(" | "));
    const v = (await p.evaluate(() => window.__csp || [])).concat(csp);
    check(v.length === 0, "nothing against YouTube's Content Security Policy: " + v.slice(0, 2).join(" | "));
    check([...hosts].every((h) => h === "127.0.0.1:" + sport || h === "www.youtube.com"), "requests only here and to www.youtube.com: " + [...hosts].join(" "));
    await p.evaluate(() => { new Image().src = "https://example.com/x.png"; }); await p.waitForTimeout(300);   // (and the header is on: an image from elsewhere is refused)
    check((await p.evaluate(() => window.__csp || [])).some((x) => /img-src/.test(x)), "the policy is really on (a test image from elsewhere was refused)");
  } finally { srv.kill(); }
  await b.close();
  console.log(bad.length ? bad.length + " FAILED" : "all ok");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

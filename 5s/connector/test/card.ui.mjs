// The round card (web/round.html) in a stand-in host that speaks MCP Apps (protocol 2026-01-26): Playwright,
// not in `npm test`.
//
//   node --test test/card.ui.mjs
//
// The stand-in is not Claude. It does what Claude's docs say a host does: the card in a sandboxed frame on
// another origin, under the CSP built from the resource's _meta.ui; size-changed sets the frame's height,
// capped; full screen fills the screen with the composer over it; tools/call goes to the connector. Here the
// connector is the real one in this process (src/tools.js over an in-memory MCP session, a memory store), the
// Worker's addresses are answered from the built public/ (the /pp/ ones through card.js's own servePage), and
// every other https address is answered locally, so nothing leaves the machine.
//
// At 390 by touch (light, clipboard allowed) and at 1280 by mouse (dark, clipboard refused): the five things
// together; copy; turning the space with a sideways drag and going in; the page full screen, turned on an
// upright screen, read with two fingers or the wheel; Keep and Pass in any order, each recorded at once;
// the round's end as one context update and one message; round 2 greys out round 1; an old page link renewed;
// targets of 44 px; no undeclared request; no page error. Also the viewer page for a space and for a page's building.
//
// Needs the built catalogue (npm run things, then npm run deck): the real deck with deck.things, and public/.
//   SHOTS      folder for screenshots (default <tmp>/fives-card-shots): flag before showing anyone (the artist's pages)
//   THREE_DIR  the three@0.147.0 package folder (default <tmp>/fives-three/package, fetched once with npm pack)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ctxFor, CONNECTOR, FIVES } from './helpers.mjs';
import { registerTools, SERVER_INSTRUCTIONS } from '../src/tools.js';
import { cardMeta, cardUrls, servePage } from '../src/card.js';
import { MADE } from '../src/lines.js';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const ORIGIN = 'https://fives-connector.example.workers.dev';
const SECRET = 'a stand-in secret, longer than thirty-two characters';
const PUBLIC = join(CONNECTOR, 'public');
const DECK_FILE = join(CONNECTOR, 'src', 'deck.generated.json');
const SHOTS = process.env.SHOTS || join(tmpdir(), 'fives-card-shots');
const DAY = 86400e3;
const deck = existsSync(DECK_FILE) ? JSON.parse(readFileSync(DECK_FILE, 'utf8')) : null;
const PAGE_DIR = deck && deck.things && deck.things.pageDir;
const missing = !PAGE_DIR ? 'no deck.things: run npm run things, then npm run deck' : !existsSync(join(PUBLIC, 's', 'space.js')) ? 'no public/: run npm run things' : '';

// three.js r147 as jsdelivr serves it (the card checks its integrity hashes, so these must be the same bytes).
function threeDir() {
  if (process.env.THREE_DIR) return process.env.THREE_DIR;
  const dir = join(tmpdir(), 'fives-three');
  if (!existsSync(join(dir, 'package', 'build', 'three.min.js'))) {
    mkdirSync(dir, { recursive: true });
    execFileSync('npm', ['pack', 'three@0.147.0', '--pack-destination', dir], { stdio: 'ignore' });
    execFileSync('tar', ['xzf', join(dir, 'three-0.147.0.tgz'), '-C', dir]);
  }
  return join(dir, 'package');
}

// The CSP a host builds from the resource's _meta.ui (the MCP Apps mapping).
const META = cardMeta(ORIGIN).ui;
const R = META.csp.resourceDomains.join(' '), C = META.csp.connectDomains.join(' ');
const CSP = ["default-src 'none'", `script-src 'self' 'unsafe-inline' ${R}`, `style-src 'self' 'unsafe-inline' ${R}`, `img-src 'self' data: blob: ${R}`,
  `font-src 'self' ${R}`, `media-src 'self' data: ${R}`, `connect-src 'self' ${C}`, "frame-src 'none'", "object-src 'none'", "base-uri 'self'"].join('; ');
const DECLARED = new Set(META.csp.resourceDomains.concat(META.csp.connectDomains));

const HOST = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stand-in chat</title><style>
:root { --bg: #faf9f5; --fg: #141413; --muted: #73726c; --bubble: #f0eee6; }
:root[data-theme="dark"] { --bg: #262624; --fg: #faf9f5; --muted: #9c9a92; --bubble: #3a3a37; }
html, body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.45 -apple-system, "Segoe UI", sans-serif; }
main { max-width: 768px; margin: 0 auto; padding: 12px 16px 120px; }
.note { font-size: 11px; color: var(--muted); text-align: center; margin: 0 0 10px; }
.user { margin: 0 0 12px auto; max-width: 75%; background: var(--bubble); padding: 8px 12px; border-radius: 16px; width: fit-content; }
.card { margin: 6px 0 10px; border: 1px solid rgba(127,127,127,.3); border-radius: 12px; overflow: hidden; }
.card iframe { display: block; width: 100%; border: 0; height: 160px; }
.card.full { position: fixed; inset: 0; z-index: 5; margin: 0; border: 0; border-radius: 0; }
.card.full iframe { height: 100% !important; }
.composer { position: fixed; left: 10px; right: 10px; bottom: 10px; z-index: 6; max-width: 748px; margin: 0 auto; height: 48px; border-radius: 24px;
  background: var(--bubble); color: var(--muted); display: flex; align-items: center; padding: 0 16px; font-size: 14px; }
</style></head><body>
<main id="chat"><p class="note">A stand-in for the chat, for testing. Not Claude.</p><p class="user">let's play fives</p></main>
<div class="composer">Reply to Claude…</div>
<script>
"use strict";
const Q = new URLSearchParams(location.search), THEME = Q.get("theme") || "light", TOUCH = Q.get("touch") === "1", CAP = +Q.get("cap") || 640;
document.documentElement.dataset.theme = THEME;
window.log = [];
const VARS = THEME === "dark"
  ? { "--color-background-primary": "#30302E", "--color-background-secondary": "#262624", "--color-text-primary": "#FAF9F5", "--color-text-tertiary": "#9C9A92", "--color-background-inverse": "#FAF9F5", "--color-text-inverse": "#141413", "--color-border-tertiary": "rgba(222,220,209,.15)" }
  : { "--color-background-primary": "#FFFFFF", "--color-background-secondary": "#F5F4ED", "--color-text-primary": "#141413", "--color-text-tertiary": "#73726C", "--color-background-inverse": "#141413", "--color-text-inverse": "#FFFFFF", "--color-border-tertiary": "rgba(31,30,29,.15)" };
window.mount = function (result, said) {
  if (said) { const p = document.createElement("p"); p.textContent = said; document.getElementById("chat").appendChild(p); }
  const card = document.createElement("div"); card.className = "card";
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "allow-scripts allow-same-origin");
  f.setAttribute("allow", "clipboard-write");
  f.src = Q.get("app");
  card.appendChild(f);
  document.getElementById("chat").appendChild(card);
  const n = document.querySelectorAll(".card").length;
  const post = (m) => f.contentWindow.postMessage(m, "*");
  let mode = "inline";
  const ctx = () => ({ theme: THEME, styles: { variables: VARS }, displayMode: mode, availableDisplayModes: ["inline", "fullscreen"],
    platform: TOUCH ? "mobile" : "desktop", deviceCapabilities: { touch: TOUCH, hover: !TOUCH },
    safeAreaInsets: mode === "fullscreen" && TOUCH ? { top: 0, right: 0, bottom: 68, left: 0 } : { top: 0, right: 0, bottom: 0, left: 0 },
    containerDimensions: { maxHeight: CAP } });
  addEventListener("message", async (e) => {
    if (e.source !== f.contentWindow) return;
    const m = e.data; if (!m || m.jsonrpc !== "2.0") return;
    window.log.push({ frame: n, method: m.method, params: m.params });
    const reply = (res) => post({ jsonrpc: "2.0", id: m.id, result: res });
    switch (m.method) {
      case "ui/initialize":
        return reply({ protocolVersion: "2026-01-26", hostInfo: { name: "stand-in", version: "0" },
          hostCapabilities: { serverTools: {}, openLinks: {}, message: { text: {} }, updateModelContext: { text: {} } }, hostContext: ctx() });
      case "ui/notifications/initialized":
        return post({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result });
      case "ui/notifications/size-changed":
        if (mode === "inline" && m.params && m.params.height) f.style.height = Math.min(CAP, m.params.height) + "px";
        return;
      case "ui/request-display-mode":
        mode = m.params.mode === "fullscreen" ? "fullscreen" : "inline";
        card.classList.toggle("full", mode === "fullscreen");
        reply({ mode });
        return post({ jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: ctx() });
      case "tools/call":
        window.busy = (window.busy || 0) + 1; window.most = Math.max(window.most || 0, window.busy);
        try { return reply(await window.callTool(m.params.name, m.params.arguments || {})); }
        catch (err) { return post({ jsonrpc: "2.0", id: m.id, error: { code: -32603, message: String(err) } }); }
        finally { window.busy--; }
      case "ui/message": {
        const p = document.createElement("p"); p.className = "user"; p.textContent = m.params.content.map((c) => c.text).join(" ");
        document.getElementById("chat").appendChild(p);
        return reply({});
      }
      case "ui/update-model-context":
        return reply({});
      default:
        if (m.id != null) post({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "not in the stand-in" } });
    }
  });
  return n;
};
</script></body></html>`;

const TYPE = { '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.html': 'text/html; charset=utf-8', '.png': 'image/png' };
const inside = (root, p) => { const f = normalize(join(root, p)); return f.startsWith(root + '/') && existsSync(f) ? f : null; };
// env.ASSETS for servePage: the built static files.
const ASSETS = {
  async fetch(req) {
    const f = inside(PUBLIC, decodeURIComponent(new URL(req.url).pathname));
    return f ? new Response(readFileSync(f), { status: 200, headers: { 'Content-Type': TYPE[extname(f)] || 'application/octet-stream' } }) : new Response('not found', { status: 404 });
  },
};

let server, port, browser, THREE;
before(async () => {
  if (missing) return;
  THREE = threeDir();
  mkdirSync(SHOTS, { recursive: true });
  server = http.createServer((req, res) => {
    const host = (req.headers.host || '').split(':')[0];
    if (req.url.startsWith('/host.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(HOST); }
    // The card on its own origin (localhost, unlike the host's 127.0.0.1), under the resource's CSP.
    if (req.url.startsWith('/app') && host === 'localhost') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP });
      return res.end(readFileSync(join(CONNECTOR, 'web', 'round.html')));
    }
    res.writeHead(404); res.end();
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  port = server.address().port;
  browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
});
after(async () => { if (browser) await browser.close(); if (server) server.close(); });

/** A person with the connector in this process, and a browser at one size, with the Worker's addresses answered locally. */
async function setUp({ width, height, touch, theme, clipboard }) {
  const { ctx, clock } = ctxFor({ deck, start: Date.now(), step: 3000 });
  ctx.urls = cardUrls(ORIGIN, SECRET);
  const mcp = new McpServer({ name: 'fives', version: 'test' }, { instructions: SERVER_INSTRUCTIONS });
  registerTools(mcp, async () => ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'stand-in', version: '1' });
  await Promise.all([mcp.connect(a), client.connect(b)]);
  const callTool = async (name, args) => JSON.parse(JSON.stringify(await client.callTool({ name, arguments: args || {} })));

  const bctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch, colorScheme: theme });
  if (clipboard) for (const o of ['http://localhost:' + port, 'http://127.0.0.1:' + port]) await bctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: o });
  const hits = [], pictures = new Map(), errors = [];
  await bctx.route(/^https:\/\//, async (route) => {
    const req = route.request(), u = new URL(req.url());
    hits.push(u.origin + u.pathname);
    if (u.origin === ORIGIN && u.pathname.startsWith('/pp/')) {
      const res = await servePage(new Request(u.href, { method: req.method() }), { ASSETS }, PAGE_DIR, SECRET, clock.t);
      return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    }
    if (u.origin === ORIGIN && u.pathname.startsWith('/s/')) {
      // public/_headers gives /s/* CORS; /s/space is space.html (html_handling).
      const f = inside(PUBLIC, u.pathname === '/s/space' ? '/s/space.html' : u.pathname);
      return f ? route.fulfill({ contentType: TYPE[extname(f)], body: readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } }) : route.fulfill({ status: 404, body: '' });
    }
    if (u.origin === 'https://cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.147.0/')) {
      const f = inside(THREE, u.pathname.slice('/npm/three@0.147.0'.length));
      return f ? route.fulfill({ contentType: 'text/javascript', body: readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } }) : route.fulfill({ status: 404, body: '' });
    }
    const id = pictures.get(u.href), img = id && join(FIVES, 'dist', 'img', id + '.webp');
    if (img && existsSync(img)) return route.fulfill({ contentType: 'image/webp', body: readFileSync(img) });
    return route.fulfill({ status: 404, body: '' });
  });
  const page = await bctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // The CSP refusals of blocked.example are the negative check, expected; any other error is not.
  page.on('console', (m) => { if (m.type() === 'error' && !/blocked\.example|status of 403/.test(m.text())) errors.push(m.text()); });
  await page.exposeFunction('callTool', callTool);
  await page.goto(`http://127.0.0.1:${port}/host.html?theme=${theme}&touch=${touch ? 1 : 0}&app=${encodeURIComponent(`http://localhost:${port}/app`)}`);
  const cdp = await bctx.newCDPSession(page);

  const out = {
    ctx, clock, client, callTool, bctx, page, cdp, hits, errors,
    /** play_fives, as Claude would call it, and the card it mounts under the call. */
    async play(said, patch) {
      const r = await callTool('play_fives');
      assert.equal(r.isError, undefined, r.content && r.content[0].text);
      if (patch) await patch(r);
      return out.mount(r, said);
    },
    /** A card for a result Claude was given before (a chat opened again later): mounted, nothing called. */
    async mount(r, said) {
      for (const t of r.structuredContent.things) if (t.kind === 'picture' && t.image) pictures.set(t.image, t.thing);
      const n = await page.evaluate(([res, s]) => window.mount(res, s), [r, said]);
      const handle = await page.waitForSelector(`.card:nth-of-type(${n}) iframe`);
      // The chat brings the new card into view (a frame out of view gets no animation frames).
      await handle.scrollIntoViewIfNeeded();
      const frame = await handle.contentFrame();
      await frame.waitForFunction(() => document.querySelectorAll(".tile").length === 5);
      return { r, frame, n };
    },
    tile: (frame, kind) => frame.locator('.k-' + kind),
    shot: (name, el) => (el || page).screenshot({ path: join(SHOTS, name + '.png') }),
    log: (method, frame) => page.evaluate(([m, f]) => window.log.filter((l) => l.method === m && (!f || l.frame === f)), [method, frame]),
    full: () => page.evaluate(() => !!document.querySelector('.card.full')),
    async touchDrag(from, to, steps = 10) {
      const pts = (k) => from.map((p, i) => ({ x: p.x + (to[i].x - p.x) * k / steps, y: p.y + (to[i].y - p.y) * k / steps, id: i }));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
      for (let k = 1; k <= steps; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(k) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
  return out;
}

/** The five drawn: the picture (or its colours), the line, the building, the page, the word. */
async function waitDrawn(frame) {
  await frame.waitForFunction(() => {
    const pic = document.querySelector('.k-picture .media'), page = document.querySelector('.k-page img');
    return (!pic.querySelector('img') || pic.querySelector('img').complete) && document.querySelector('.k-space canvas') && page && page.complete && page.naturalWidth > 0;
  }, null, { timeout: 60000, polling: 200 });
}
const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
const smallTargets = (frame) => frame.evaluate(() => Array.from(document.querySelectorAll('button, [role=button]'))
  .filter((e) => e.offsetParent && getComputedStyle(e).visibility !== 'hidden').map((e) => [e.textContent.trim().slice(0, 20) || e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().height)])
  .filter(([, h]) => h < 44));
const noSideScroll = (frame) => frame.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const imgScale = (frame) => frame.evaluate(() => { const m = /scale\(([\d.]+)\)/.exec(document.querySelector('.paper img').style.transform); return m ? +m[1] : 0; });

test('at 390 by touch, light: a round of five together, answered in any order, then round 2', { skip: missing || false, timeout: 300000 }, async () => {
  const s = await setUp({ width: 390, height: 844, touch: true, theme: 'light', clipboard: true });
  const { r, frame, n } = await s.play();
  const things = r.structuredContent.things;
  assert.deepEqual(things.map((t) => t.kind), ['picture', 'line', 'space', 'page', 'word']);
  await waitDrawn(frame);
  await s.page.waitForTimeout(500);
  await s.shot('390-1-round');
  for (const k of ['picture', 'line', 'space', 'page', 'word']) await s.shot('390-part-' + k, s.tile(frame, k));
  assert.deepEqual(await frame.$$eval('.tile', (ts) => ts.map((t) => t.className.split(' ')[1])), ['k-picture', 'k-line', 'k-space', 'k-page', 'k-word'], 'in the artist\'s order');
  assert.equal(await frame.locator('.k-word .word').textContent(), things[4].word, 'the word alone');
  assert.equal(await frame.locator('#count').textContent(), '0 of 5');
  assert.deepEqual(await smallTargets(frame), [], 'every target at least 44 px');
  assert.ok(await noSideScroll(frame), 'nothing wider than the card');
  // The only buttons inline are Pass and Keep under each thing: the things themselves are the other controls.
  const buttons = await frame.$$eval('button', (bs) => bs.filter((b) => b.offsetParent && !b.closest('.full') && !b.classList.contains('media')).map((b) => b.textContent.trim()));
  assert.equal(buttons.length, 10);
  assert.ok(buttons.every((x) => /^(Pass|Keep|Let go)$/.test(x)), buttons.join(', '));

  // The line: a tap copies it.
  await s.tile(frame, 'line').locator('.media').tap();
  await frame.waitForFunction(() => window.copied);
  assert.equal(await frame.evaluate(() => window.copied), 'clipboard');
  // Read back from the host page (the card's frame may write the clipboard, not read it).
  assert.equal(await s.page.evaluate(() => navigator.clipboard.readText()), things[1].code);
  // A line too long for its tile fades out there, and the same tap shows it whole.
  if (await frame.locator('.k-line .clipped').count()) {
    await s.page.waitForFunction(() => !!document.querySelector('.card.full'));
    assert.equal(await frame.locator('#stage .whole').textContent(), things[1].code);
    assert.match(await frame.locator('#cap').textContent(), /^For \S/, 'where it goes, under the line whole');
    await s.shot('390-2-line-whole');
    await frame.locator('#back').tap();
    await s.page.waitForFunction(() => !document.querySelector('.card.full'));
  } else assert.equal(await s.full(), false, 'a line that fits is only copied');
  await s.shot('390-2-line-copied', s.tile(frame, 'line'));

  // The space: still, until a sideways drag turns it; a tap goes in, full screen.
  const sp = await centre(s.tile(frame, 'space').locator('canvas'));
  const still = await s.tile(frame, 'space').locator('canvas').screenshot();
  await s.page.waitForTimeout(600);
  assert.ok(still.equals(await s.tile(frame, 'space').locator('canvas').screenshot()), 'it does not turn by itself inline');
  await s.touchDrag([{ x: sp.x + 50, y: sp.y }], [{ x: sp.x - 60, y: sp.y }]);
  await s.page.waitForTimeout(700);
  assert.ok(!still.equals(await s.tile(frame, 'space').locator('canvas').screenshot()), 'a sideways drag turns it');
  await s.shot('390-3-space-turned', s.tile(frame, 'space'));
  await s.page.touchscreen.tap(sp.x, sp.y);
  await s.page.waitForFunction(() => !!document.querySelector('.card.full'));
  await s.page.waitForTimeout(900);
  const cap = await frame.locator('#cap').textContent();
  assert.match(cap, things[2].room ? /Inside, where the model is cut away/ : /under cover beside it/, 'Go in says plainly where it stands you');
  await s.shot('390-3-space-in');
  const st = await centre(frame.locator('#stage canvas'));
  await s.page.touchscreen.tap(st.x, st.b.y + st.b.height * 0.8);
  await s.page.waitForTimeout(800);
  await s.shot('390-3-space-in-step');
  await frame.locator('#back').tap();
  await s.page.waitForFunction(() => !document.querySelector('.card.full'));
  assert.ok(await frame.locator('.k-space canvas').isVisible(), 'back inline, the building in its tile');

  // The page: a tap opens it whole, turned to fill an upright screen when it is wide; two fingers read it.
  await s.tile(frame, 'page').locator('.media').tap();
  await s.page.waitForFunction(() => !!document.querySelector('.card.full'));
  await frame.waitForFunction(() => { const i = document.querySelector('.paper img'); return i && i.complete && i.naturalWidth > 0 && i.style.transform; });
  const turned = await frame.evaluate(() => /rotate\(90deg\)/.test(document.querySelector('.paper').style.transform));
  assert.equal(turned, !!things[3].wide, 'a wide page is turned on an upright screen, a tall one is not');
  await s.shot('390-4-page-full');
  const pg = await centre(frame.locator('#stage'));
  await s.touchDrag([{ x: pg.x - 30, y: pg.y - 30 }, { x: pg.x + 30, y: pg.y + 30 }], [{ x: pg.x - 110, y: pg.y - 110 }, { x: pg.x + 110, y: pg.y + 110 }], 12);
  await s.page.waitForTimeout(300);
  const pinched = await imgScale(frame);
  assert.ok(pinched > 2, 'pinch to read: scale ' + pinched);
  await s.touchDrag([{ x: pg.x, y: pg.y }], [{ x: pg.x + 80, y: pg.y + 40 }]);
  await s.shot('390-4-page-pinched');
  await frame.locator('#back').tap();
  await s.page.waitForFunction(() => !document.querySelector('.card.full'));

  // Keep and Pass, in any order: each one is a judge call the moment it is tapped.
  const plan = [['word', true], ['picture', true], ['space', false], ['line', true], ['page', true]];
  for (const [i, [kind, keep]] of plan.entries()) {
    await s.tile(frame, kind).locator(keep ? '.keep' : '.pass').tap();
    await frame.waitForFunction((k) => document.querySelector('.k-' + k + ' .said'), kind);
    const calls = (await s.log('tools/call', n)).filter((l) => l.params.name === 'judge');
    assert.equal(calls.length, i + 1);
    assert.deepEqual(calls[i].params.arguments, { card: things.find((t) => t.kind === kind).thing, keep });
    if (i < 4) assert.equal(await frame.locator('#count').textContent(), (i + 1) + ' of 5');
    if (i === 0) await s.shot('390-5-word-kept', s.tile(frame, 'word'));
  }
  const saved = (await s.callTool('get_state')).structuredContent.state;
  assert.equal(saved.game.k.slice(0, 5), '11011', 'recorded in the person\'s state, in the artist\'s order');
  assert.match(await frame.locator('.k-picture .said').textContent(), /^Kept\. \S/, 'the reveal after the answer');
  assert.match(await frame.locator('.k-space .said').textContent(), /^Passed\. \S/);

  // The round's end: one line into Claude's context, then one message on the person's tap.
  await frame.waitForSelector('#next:not([hidden])');
  assert.equal(await frame.locator('#next').textContent(), 'Next round');
  assert.match(await frame.locator('#round').textContent(), /^Round 1 done · kept 4 of 5$/);
  const ctxs = await s.log('ui/update-model-context', n);
  assert.equal(ctxs.length, 1);
  assert.match(ctxs[0].params.content[0].text, /^Round 1 of 5 done\. Kept: the picture, the line of code, the page, the word\. Passed: the space\.\n/);
  assert.ok(ctxs[0].params.content[0].text.includes(things[1].code), 'the kept line, for Claude to give again');
  await s.shot('390-6-round-end');
  await frame.locator('#next').tap();
  await frame.waitForFunction(() => document.getElementById('next').textContent === 'Sent');
  const msgs = await s.log('ui/message', n);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].params.content[0].text, /^Round 1 of 5 done\..* Next round\.$/);
  await s.shot('390-6-round-end-sent');

  // Round 2: the new card mounts, and round 1's stops taking answers and lets its building go.
  const two = await s.play('Round 2 of 5.');
  assert.equal(two.r.structuredContent.game.round, 2);
  assert.ok(two.r.structuredContent.game.seq > r.structuredContent.game.seq);
  await frame.waitForFunction(() => document.body.classList.contains('old'));
  assert.equal(await frame.locator('.k-space canvas').count(), 0, 'the old card\'s WebGL is let go');
  const line2 = two.r.structuredContent.things[1];
  assert.match(line2.thing, MADE, 'round 2\'s line is made from what round 1 kept');
  await waitDrawn(two.frame);
  await s.page.waitForTimeout(400);
  await s.shot('390-7-round-2');

  // A page link from a day ago (a card opened again later): the card asks play_fives for its round and takes the new link.
  const before = (await s.log('tools/call')).length;
  const stale = await s.play('', async (res) => {
    const pg2 = res.structuredContent.things[3];
    pg2.image = pg2.open = await cardUrls(ORIGIN, SECRET).page(pg2.thing, s.clock.t - 2 * DAY);
  });
  await stale.frame.waitForFunction(() => { const i = document.querySelector('.k-page img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 });
  const asked = (await s.log('tools/call')).slice(before).map((l) => l.params.name);
  assert.deepEqual(asked, ['get_state', 'play_fives'], 'its round still on show (read only), then one play_fives, nothing judged');
  assert.equal((await s.callTool('get_state')).structuredContent.state.game.ids.length, 10, 'and nothing new dealt');

  // The twin cards of round 2 share their answers.
  await two.frame.locator('.k-word .keep').tap();
  await stale.frame.waitForFunction(() => document.querySelector('.k-word .said'));
  assert.equal(await two.frame.locator('#count').textContent(), '1 of 5');

  // Where it came from (the inside out): under the tile's reveal, and to Claude at the round's end.
  for (const k of ['line', 'picture', 'space', 'page']) await two.frame.locator('.k-' + k + ' .keep').tap();
  await two.frame.waitForSelector('#next:not([hidden])');
  assert.match(await two.frame.locator('.k-line .from').textContent(), /^Made from .+ you kept in round 1/);
  await s.shot('390-8-round-2-from', s.tile(two.frame, 'line'));
  const ctx2 = (await s.log('ui/update-model-context', two.n)).map((l) => l.params.content[0].text);
  assert.equal(ctx2.length, 1);
  assert.ok(ctx2[0].includes('\nWhere they came from:\n'), ctx2[0]);
  assert.match(ctx2[0], /^A line of code: Made from /m);

  // Rounds 3 and 4 answered in words, as Claude records them; round 5 on the card ends the game, and Claude gets its summary.
  for (let round = 3; round <= 4; round++) {
    const p = await s.callTool('play_fives');
    for (const t of p.structuredContent.things) await s.callTool('judge', { card: t.thing, keep: true });
  }
  const five = await s.play('Round 5 of 5.');
  assert.equal(five.r.structuredContent.game.round, 5);
  await five.frame.evaluate(() => document.querySelectorAll('.acts .keep').forEach((b) => b.click()));
  await five.frame.waitForSelector('#next:not([hidden])');
  assert.match(await five.frame.locator('#round').textContent(), /^Game done · kept 24 of 25$/);
  const end = (await s.log('ui/update-model-context', five.n)).map((l) => l.params.content[0].text);
  assert.equal(end.length, 1);
  assert.match(end[0], /\nThe game: kept 24 of 25: 5 pictures, 5 lines of code, 4 spaces, 5 pages, 5 words\./);
  assert.match(end[0], /\nWhat moved from round to round:\nRound 2, a line of code: Made from /);
  assert.match(end[0], /\nEvery kept line, to give again, each in its own code block:\n/);
  await five.frame.locator('#next').tap();
  await five.frame.waitForFunction(() => document.getElementById('next').textContent === 'Sent');
  const last = (await s.log('ui/message', five.n)).map((l) => l.params.content[0].text);
  assert.match(last[0], /That was the last round\.\nThe game: kept 24 of 25/);
  assert.match(last[0], /What moved from round to round:/);

  const bad = s.hits.filter((h) => !DECLARED.has(new URL(h).origin));
  assert.deepEqual(bad, [], 'only declared origins were asked');
  assert.deepEqual(s.errors, []);
  await s.bctx.close();
});

test('at 1280 by mouse, dark: the same card, by click, wheel and keyboard; copy without the clipboard; nothing undeclared', { skip: missing || false, timeout: 300000 }, async () => {
  const s = await setUp({ width: 1280, height: 800, touch: false, theme: 'dark', clipboard: false });
  const { r, frame, n } = await s.play();
  const things = r.structuredContent.things;
  await waitDrawn(frame);
  await s.page.waitForTimeout(500);
  await s.shot('1280-1-round');
  for (const k of ['picture', 'line', 'space', 'page', 'word']) await s.shot('1280-part-' + k, s.tile(frame, k));
  assert.equal(await frame.evaluate(() => getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length), 3, 'three across on a wide screen');
  assert.ok(await noSideScroll(frame));
  assert.match(await frame.locator('.k-space .hint').textContent(), /click to go in/);

  // Copy, where the host doesn't grant the clipboard: the line is copied the old way, or selected to copy.
  await s.tile(frame, 'line').locator('.media').click();
  await frame.waitForFunction(() => window.copied);
  assert.ok(['clipboard', 'execCommand', 'selected'].includes(await frame.evaluate(() => window.copied)));
  assert.match(await frame.locator('.k-line .where').textContent(), /^(Copied|Selected: copy it)$/);
  await s.shot('1280-2-line-copied', s.tile(frame, 'line'));

  // The space: a mouse drag turns it; Enter goes in; Escape comes back.
  const canvas = s.tile(frame, 'space').locator('canvas');
  const sp = await centre(canvas), still = await canvas.screenshot();
  await s.page.mouse.move(sp.x + 60, sp.y); await s.page.mouse.down();
  await s.page.mouse.move(sp.x - 60, sp.y, { steps: 10 }); await s.page.mouse.up();
  await s.page.waitForTimeout(700);
  assert.ok(!still.equals(await canvas.screenshot()), 'a drag turns it');
  await s.tile(frame, 'space').locator('.media').focus();
  await s.page.keyboard.press('Enter');
  await s.page.waitForFunction(() => !!document.querySelector('.card.full'));
  await s.page.waitForTimeout(900);
  await s.shot('1280-3-space-in');
  await s.page.keyboard.press('Escape');
  await s.page.waitForFunction(() => !document.querySelector('.card.full'));

  // The page: whole, not turned on a wide screen; the wheel brings it closer.
  await s.tile(frame, 'page').locator('.media').click();
  await frame.waitForFunction(() => { const i = document.querySelector('.paper img'); return i && i.complete && i.naturalWidth > 0 && i.style.transform; });
  assert.equal(await frame.evaluate(() => /rotate/.test(document.querySelector('.paper').style.transform)), false);
  await s.shot('1280-4-page-full');
  const pg = await centre(frame.locator('#stage'));
  await s.page.mouse.move(pg.x, pg.y);
  for (let i = 0; i < 6; i++) await s.page.mouse.wheel(0, -120);
  await s.page.waitForTimeout(200);
  assert.ok(await imgScale(frame) > 1.5, 'the wheel zooms');
  await s.shot('1280-4-page-zoomed');
  await frame.locator('#back').click();
  await s.page.waitForFunction(() => !document.querySelector('.card.full'));

  // Keep and Pass, in another order, all five in the same moment: the judge calls go one at a time, in order.
  await frame.evaluate(() => { for (const [k, keep] of [['page', 1], ['line', 0], ['picture', 0], ['word', 1], ['space', 1]]) document.querySelector('.k-' + k + (keep ? ' .keep' : ' .pass')).click(); });
  await frame.waitForFunction(() => document.querySelectorAll('.said').length === 5);
  assert.equal(await s.page.evaluate(() => window.most), 1, 'never two judge calls at once');
  assert.equal((await s.callTool('get_state')).structuredContent.state.game.k, '00111', 'every answer saved');
  const judged = (await s.log('tools/call', n)).map((l) => [l.params.name, l.params.arguments.card]);
  assert.deepEqual(judged, [['judge', things[3].thing], ['judge', things[1].thing], ['judge', things[0].thing], ['judge', things[4].thing], ['judge', things[2].thing]]);
  assert.equal((await s.log('ui/update-model-context', n)).length, 1);
  await frame.waitForSelector('#next:not([hidden])');
  await s.page.waitForTimeout(300);
  await s.shot('1280-5-round-end');

  // The page's reveal full screen, and its building (a space inside a page), after the answer.
  await s.tile(frame, 'page').locator('.media').click();
  await frame.waitForSelector('#alt:not([hidden])');
  await s.shot('1280-6-page-reveal');
  await frame.locator('#alt').click();
  await frame.waitForSelector('#stage canvas', { timeout: 60000 });
  await s.page.waitForTimeout(900);
  await s.shot('1280-6-page-building');
  await frame.locator('#back').click();

  // The same round's card opened again later (its result from before, its page link run out), the round sorted since:
  // the card reads the state, and neither deals a round nor starts a game.
  const before = (await s.log('tools/call')).length, old = JSON.parse(JSON.stringify(r)), oldPage = old.structuredContent.things[3];
  oldPage.image = oldPage.open = await cardUrls(ORIGIN, SECRET).page(oldPage.thing, s.clock.t - 2 * DAY);
  const again = await s.mount(old);
  await again.frame.waitForFunction(() => /run out/.test(document.querySelector('.k-page .hint').textContent), null, { timeout: 20000 });
  assert.deepEqual((await s.log('tools/call')).slice(before).map((l) => l.params.name), ['get_state'], 'only a read');
  assert.equal((await s.callTool('get_state')).structuredContent.state.game.ids.length, 5, 'nothing dealt');

  // Nothing undeclared: an image and a fetch to another origin are refused by the CSP.
  const neg = await frame.evaluate(async () => ({
    img: await new Promise((ok) => { const i = new Image(); i.onload = () => ok('loaded'); i.onerror = () => ok('blocked'); i.src = 'https://blocked.example/x.png'; }),
    fetch: await fetch('https://blocked.example/y.json').then(() => 'fetched', () => 'blocked'),
  }));
  assert.deepEqual(neg, { img: 'blocked', fetch: 'blocked' });
  assert.ok(!s.hits.some((h) => h.startsWith('https://blocked.example')));
  assert.deepEqual(s.hits.filter((h) => !DECLARED.has(new URL(h).origin)), []);
  assert.deepEqual(s.errors, []);
  await s.bctx.close();
});

test('the viewer page: a space by its deck id, and a page\'s building by its signed link', { skip: missing || false, timeout: 180000 }, async () => {
  const s = await setUp({ width: 390, height: 844, touch: true, theme: 'light', clipboard: false });
  const space = deck.things.spaces[0], page = deck.things.pages.find((p) => p.buildings.length).buildings[0].model;
  for (const [name, link] of [['space', cardUrls(ORIGIN, SECRET).space(space)], ['page-building', await cardUrls(ORIGIN, SECRET).pageSpace(page, s.clock.t)]]) {
    const p = await s.bctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(link);
    await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: join(SHOTS, '390-viewer-' + name + '.png') });
    assert.equal(await p.locator('#walk').isVisible(), true);
    await p.locator('#walk').tap();
    await p.waitForTimeout(800);
    assert.match(await p.locator('#hint').textContent(), /under cover beside them, or inside where one is cut away/);
    await p.screenshot({ path: join(SHOTS, '390-viewer-' + name + '-in.png') });
    assert.deepEqual(errs, []);
    await p.close();
  }
  // An old link to a page's building says so plainly.
  const p = await s.bctx.newPage();
  await p.goto(await cardUrls(ORIGIN, SECRET).pageSpace(page, s.clock.t - 2 * DAY));
  await p.waitForFunction(() => /run out/.test(document.getElementById('say').textContent));
  await s.bctx.close();
});

if (missing) console.log('card.ui: skipped, ' + missing);
else after(() => writeFileSync(join(SHOTS, 'README.txt'), 'Screenshots of the round card in a stand-in host (test/card.ui.mjs). They show the artist\'s pages and deck pictures: flag before showing anyone.\n'));

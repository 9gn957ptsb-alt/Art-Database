/* 5s UI smoke test (Playwright + node:test).
 *
 *   node --test 5s/test/ui.smoke.cjs
 *
 * Runs against a built page (python3 5s/build_page.py --deck DIR --out SITE):
 *   BASE_URL   the dev.html to test (e.g. http://127.0.0.1:8731/dev.html). Without it the test serves
 *              SITE_DIR (default 5s/dist) itself on UI_PORT (default 8731) with python3 -m http.server.
 *   SHOTS      folder for screenshots (default <tmp>/5s-ui-shots).
 *   UI_SIZES   optional filter, e.g. "390" or "1280" or "390-light".
 *
 * At 390x844 and 1280x800, in light and dark: the page loads with no console errors; the intro shows,
 * then Start; every tab renders its empty state, then Example mode with its banner (See shows turns and
 * notes; the Set chooser offers three and a pick changes the room); a full five by buttons (with Undo),
 * the Five sorted summary with its one word, a five by keys, a five by pointer drags; Bring in two
 * generated images (kinds, from, names), seen in Split (Brought in, Sources); one returns as
 * "Still yours?" and is let go (Let go in Split); Pin a set with a name; Write a note; the Path sheet
 * (eight milestones, exactly one Next); About and the ring switch; Seed draws the ground and shows the
 * code; no horizontal scroll; reload keeps judgments, notes and brought things (device storage).
 * A seeded scenario (an example-sized history saved as the person's own) finds a turn and uses Note why.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');

let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.UI_PORT || 8731);
const SITE = path.resolve(process.env.SITE_DIR || path.join(ROOT, 'dist'));
const SHOTS = path.resolve(process.env.SHOTS || path.join(os.tmpdir(), '5s-ui-shots'));
let BASE = process.env.BASE_URL || '';
const FILTER = process.env.UI_SIZES || '';
const CONFIGS = [
  { w: 390, h: 844, scheme: 'light' },
  { w: 390, h: 844, scheme: 'dark' },
  { w: 1280, h: 800, scheme: 'light' },
  { w: 1280, h: 800, scheme: 'dark' },
].filter((c) => !FILTER || FILTER.split(',').some((f) => (c.w + '-' + c.scheme).indexOf(f) === 0));

let server = null;
let browser = null;
let hasLogo = true;
const FiveS = require(path.join(ROOT, 'src', 'engine.js'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHttp(url, ms) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* not yet */ }
    if (Date.now() - t0 > ms) throw new Error('server did not start: ' + url);
    await sleep(150);
  }
}

before(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (!BASE) {
    if (!fs.existsSync(path.join(SITE, 'dev.html'))) throw new Error('No build at ' + SITE + ': run python3 5s/build_page.py --out ' + SITE);
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', SITE], { stdio: 'ignore' });
    BASE = 'http://127.0.0.1:' + PORT + '/dev.html';
    await waitHttp(BASE, 8000);
  }
  try { const r = await fetch(new URL('logo.webp', BASE)); hasLogo = r.ok; } catch (e) { hasLogo = false; }
  browser = await chromium.launch();
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

// ---------------------------------------------------------------- helpers

async function newPage(cfg) {
  const ctx = await browser.newContext({
    viewport: { width: cfg.w, height: cfg.h }, colorScheme: cfg.scheme,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  // No network in tests: the Google Fonts stylesheet answers empty, so the fallback stacks are used.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const errors = [];
  const missing = [];
  page.on('response', (r) => { if (r.status() >= 400) missing.push(r.url()); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.errors = () => {
    // A fixture build has no logo.webp: the page falls back to its drawn mark. Nothing else may fail.
    const bad = missing.filter((u) => !(!hasLogo && /\/logo\.webp$/.test(u)));
    const errs = errors.filter((t) => !(/Failed to load resource/.test(t) && !bad.length));
    return errs.concat(bad.map((u) => 'missing: ' + u));
  };
  return { ctx, page };
}

function shooter(page, cfg) {
  const tag = cfg.w + '-' + cfg.scheme;
  return async (name) => {
    await sleep(120);
    await page.screenshot({ path: path.join(SHOTS, tag + '-' + name + '.png') });
  };
}

async function noHScroll(page, where) {
  const r = await page.evaluate(() => {
    const m = document.getElementById('main');
    return { doc: document.documentElement.scrollWidth, vw: innerWidth, main: m.scrollWidth, mainW: m.clientWidth };
  });
  assert.ok(r.doc <= r.vw, where + ': page scrolls sideways (' + r.doc + ' > ' + r.vw + ')');
  assert.ok(r.main <= r.mainW + 1, where + ': main scrolls sideways (' + r.main + ' > ' + r.mainW + ')');
}

async function visibleH1s(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('h1')).filter((h) => h.offsetParent !== null).map((h) => h.textContent));
}

async function tab(page, v) {
  await page.click('#tab-' + v);
  await page.waitForFunction((x) => !document.getElementById('view-' + x).hidden && document.title.indexOf(x.charAt(0).toUpperCase() + x.slice(1)) === 0, v);
  const h1 = await visibleH1s(page);
  assert.equal(h1.length, 1, 'one h1 on ' + v + ': ' + JSON.stringify(h1));
}

async function topId(page) { return page.$eval('#stack .card.is-top', (n) => n.getAttribute('data-id')).catch(() => null); }
async function counter(page) { return page.$eval('#counter b', (n) => Number(n.textContent)); }

async function waitTopChange(page, prev) {
  await page.waitForFunction((p) => {
    const t = document.querySelector('#stack .card.is-top');
    const s = document.getElementById('summary');
    return (t && t.getAttribute('data-id') !== p) || (s && !s.hidden);
  }, prev);
}

async function summaryShown(page) { return page.$eval('#summary', (n) => !n.hidden); }

async function dragTop(page, frac) {
  const box = await page.$eval('#stack .card.is-top', (n) => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.w * frac, cy + 6, { steps: 10 });
  await page.mouse.up();
}

async function makeImages(page) {
  const urls = await page.evaluate(() => {
    function img(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c.toDataURL('image/png'); }
    const a = img(900, 640, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c4622d'); gr.addColorStop(1, '#f2d0a4');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = i % 2 ? '#5a2e1a' : '#e8b07a'; g.fillRect((i * 97) % w, (i * 53) % h, 6, 6); }
    });
    const b = img(640, 900, (g, w, h) => {
      g.fillStyle = '#2f5d8a'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 24) { g.fillStyle = (x / 24) % 2 ? '#9cc3e4' : '#132a40'; g.fillRect(x, 0, 12, h); }
    });
    return [a, b];
  });
  return urls.map((u, i) => ({ name: (i ? 'kitchen-window.png' : 'IMG_2041.png'), mimeType: 'image/png', buffer: Buffer.from(u.split(',')[1], 'base64') }));
}

// ---------------------------------------------------------------- the page contract

test('the built page keeps the Artifact page contract', async () => {
  const html = await (await fetch(new URL('index.html', BASE))).text();
  assert.match(html, /^<title>5s<\/title>\s*<meta name="claude:viewport-fit-sides" content="cover">\s*<style>/, 'title, meta, then the style');
  assert.ok(!/<(!doctype|html|head|body)[\s>]/i.test(html), 'no document skeleton of its own');
  assert.ok(!/<link[^>]+href="app\.css"/.test(html), 'app.css is inlined');
  const links = html.match(/<link[^>]+rel="stylesheet"[^>]*>/g) || [];
  assert.ok(links.every((l) => /https:\/\/fonts\.googleapis\.com\//.test(l)), 'stylesheets only from Google Fonts');
  const scripts = (html.match(/<script[^>]*src="([^"]+)"/g) || []).map((x) => x.match(/src="([^"]+)"/)[1]);
  assert.deepEqual(scripts, ['engine.js', 'bring.js', 'ground.js', 'app.js']);
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /:root\[data-theme="dark"\] \{/);
  assert.match(css, /padding-left: max\(16px, env\(safe-area-inset-left, 0px\)\)/);
  const app = await (await fetch(new URL('app.js', BASE))).text();
  assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(app.replace(/data-act="confirm[^"]*"|'confirm[^']*'/g, '')), 'no alert/confirm/prompt');
  assert.ok(!/window\.print|\bdownload=|<a [^>]*download/.test(app), 'no print, no <a download>');
  assert.ok(!/localStorage\.(get|set)Item/.test(app.replace(/try \{[^}]*localStorage\.(get|set)Item[^}]*\}/g, '')), 'every localStorage access is wrapped');
});

// ---------------------------------------------------------------- the full run, per size and theme

for (const cfg of CONFIGS) {
  test('5s at ' + cfg.w + 'x' + cfg.h + ' ' + cfg.scheme, { timeout: 240000 }, async (t) => {
    const { ctx, page } = await newPage(cfg);
    const shot = shooter(page, cfg);
    try {
      await t.test('loads with the intro, no console errors', async () => {
        await page.goto(BASE + '#sort');
        await page.waitForSelector('#intro:not([hidden]) #btn-start');
        assert.equal(await page.title(), 'Sort · 5s');
        assert.deepEqual(await visibleH1s(page), ['Today’s five']);
        await noHScroll(page, 'intro');
        await shot('01-intro');
        assert.deepEqual(page.errors(), []);
      });

      await t.test('every tab renders its empty state, then Example mode', async () => {
        for (const v of ['split', 'set', 'see', 'seed']) {
          await tab(page, v);
          await page.waitForSelector('#view-' + v + ' [data-act="example-on"]');
          await noHScroll(page, v + ' empty');
          await shot('02-' + v + '-empty');
        }
        await tab(page, 'split');
        await page.click('#view-split [data-act="example-on"]');
        await page.waitForSelector('#exbanner:not([hidden])');
        assert.match(await page.textContent('#exbanner'), /Example taste\. Not yours\./);
        await shot('03-split-example');
        await tab(page, 'see');
        assert.ok(await page.locator('#view-see .turns li').count() >= 1, 'example has turns');
        assert.ok(await page.locator('#view-see .notes .note').count() >= 1, 'example has notes');
        await shot('03-see-example');
        await page.evaluate(() => document.getElementById('main').scrollTo(0, 99999));
        await shot('03-see-example-end');
        await tab(page, 'seed');
        await page.waitForFunction(() => { const w = document.getElementById('ground-words'); return w && /An island/.test(w.textContent); }, null, { timeout: 15000 });
        await shot('03-seed-example');
        await tab(page, 'set');
        await page.waitForSelector('#exbanner:not([hidden])');
        await shot('03-set-example');
        // the chooser: three, and a pick changes the room
        const before = await page.$eval('.slot-picture img', (i) => i.getAttribute('src'));
        await page.click('.slot-picture');
        await page.waitForSelector('#sheet[open] .choice');
        assert.equal(await page.locator('#sheet .choice').count(), 3, 'three candidates');
        await shot('04-sheet-chooser');
        const other = page.locator('#sheet .choice[aria-pressed="false"]').first();
        await other.click();
        await page.waitForFunction(() => !document.getElementById('sheet').open);
        const afterSrc = await page.$eval('.slot-picture img', (i) => i.getAttribute('src'));
        assert.notEqual(afterSrc, before, 'the picture changed');
        // Sort never shows the example; Back to mine leaves it
        await tab(page, 'sort');
        assert.ok(await page.$eval('#exbanner', (n) => n.hidden));
        await tab(page, 'split');
        await page.click('#exbanner [data-act="example-off"]');
        await page.waitForSelector('#view-split [data-act="example-on"]');
        assert.deepEqual(page.errors(), []);
      });

      await t.test('tabs are a tablist with arrow keys', async () => {
        await page.focus('#tab-split');
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'tab-set');
        assert.equal(await page.getAttribute('#tab-set', 'aria-selected'), 'true');
        assert.equal(await page.title(), 'Set · 5s');
        await page.keyboard.press('Home');
        await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'tab-sort');
        assert.equal(await page.title(), 'Sort · 5s');
      });

      await t.test('Start, then a five by buttons with Undo', async () => {
        await page.click('#btn-start');
        await page.waitForSelector('#stack .card.is-top');
        assert.ok(await page.$eval('#intro', (n) => n.hidden));
        await noHScroll(page, 'sort');
        await shot('05-sort-card');
        // the card says kind, colours and materials before the judgment, never the title
        const deck = await page.evaluate(() => fetch('deck.json').then((r) => r.json()));
        const id1 = await topId(page);
        const label = await page.getAttribute('#stack .card.is-top', 'aria-label');
        const c1 = deck.cards.find((c) => c.id === id1);
        assert.ok(c1, 'top card is a deck card');
        assert.ok(label.indexOf(c1.title) < 0 && label.indexOf(c1.artist) < 0, 'no names before the judgment');
        assert.match(label, /Colours:/);
        assert.equal(await counter(page), 1);
        await page.click('#btn-keep');
        await waitTopChange(page, id1);
        await page.waitForSelector('#strip .strip-in');
        assert.match(await page.textContent('#strip'), new RegExp('Kept: ' + c1.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.equal(await counter(page), 2);
        await shot('06-sort-strip');
        await page.click('#controls [data-act="undo"]');
        await page.waitForFunction((x) => { const t = document.querySelector('#stack .card.is-top'); return t && t.getAttribute('data-id') === x; }, id1);
        assert.equal(await counter(page), 1, 'Undo brings the card back');
        const live = await page.textContent('#live');
        void live;
        for (const keep of [true, false, true, true, false]) {
          const prev = await topId(page);
          await page.click(keep ? '#btn-keep' : '#btn-pass');
          await waitTopChange(page, prev);
        }
        await page.waitForSelector('#summary:not([hidden]) h2');
        assert.equal(await page.textContent('#summary h2'), 'Five sorted');
        assert.equal(await page.locator('#summary .tile5').count(), 5);
        assert.equal(await page.locator('#summary .tile5.kept').count(), 3);
        await page.waitForTimeout(400);
        await shot('07-five-sorted');
        // the one word
        await page.fill('#oneword-in', 'Earthy');
        await page.click('#summary form button[type="submit"]');
        await page.waitForSelector('#summary .said');
        assert.equal(await page.textContent('#summary .said'), 'Earthy');
        await noHScroll(page, 'summary');
      });

      await t.test('Another five by keys (with U to undo, Enter to look closer)', async () => {
        await page.click('#summary [data-act="another"]');
        await page.waitForSelector('#stack .card.is-top');
        assert.equal(await page.textContent('#sort-h1'), 'Another five');
        await page.focus('#sort-h1');
        await page.keyboard.press('Enter');
        await page.waitForSelector('#sheet[open]');
        assert.equal(await page.textContent('#sheet-title'), 'Look closer');
        await shot('08-sheet-closer');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('sheet').open);
        await page.focus('#sort-h1');
        let prev = await topId(page);
        await page.keyboard.press('ArrowRight');
        await waitTopChange(page, prev);
        await page.keyboard.press('u');
        await page.waitForFunction((x) => { const t = document.querySelector('#stack .card.is-top'); return t && t.getAttribute('data-id') === x; }, prev);
        for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) {
          prev = await topId(page);
          await page.keyboard.press(k);
          await waitTopChange(page, prev);
        }
        await page.waitForSelector('#summary:not([hidden])');
        assert.equal(await page.locator('#summary .tile5.kept').count(), 3);
      });

      await t.test('a five by pointer drags (and a short drag springs back)', async () => {
        await page.click('#summary [data-act="another"]');
        await page.waitForSelector('#stack .card.is-top');
        const first = await topId(page);
        await dragTop(page, 0.12);
        await sleep(300);
        assert.equal(await topId(page), first, 'a short drag springs back');
        for (const frac of [0.55, -0.55, 0.55, 0.55, -0.5]) {
          const prev = await topId(page);
          await dragTop(page, frac);
          await waitTopChange(page, prev);
        }
        await page.waitForSelector('#summary:not([hidden])');
        assert.equal(await page.locator('#summary .tile5.kept').count(), 3);
        assert.deepEqual(page.errors(), []);
      });

      let names = [];
      await t.test('Bring in your own: two images, kinds and sources', async () => {
        await page.click('#summary [data-act="bring"]');
        await page.waitForSelector('#sheet[open] #bring-file');
        await shot('09-sheet-bring-empty');
        await page.setInputFiles('#bring-file', await makeImages(page));
        await page.waitForFunction(() => document.querySelectorAll('#bring-items select').length === 2, null, { timeout: 20000 });
        const keys = await page.$$eval('#bring-items li.item', (ls) => ls.map((l) => l.id.slice(5)));
        names = ['Grandmother’s bowl', 'Kitchen window'];
        await page.check('input[name="kind-' + keys[0] + '"][value="object"]', { force: true });
        await page.selectOption('#from-' + keys[0], 'Pinterest');
        await page.fill('#name-' + keys[0], names[0]);
        await page.fill('#why-' + keys[0], 'It was on my grandmother’s table.');
        await page.check('input[name="kind-' + keys[1] + '"][value="space"]', { force: true });
        await page.fill('#name-' + keys[1], names[1]);
        await shot('10-sheet-bring-ready');
        await page.click('#bring-add');
        await page.waitForFunction(() => !document.getElementById('sheet').open, null, { timeout: 15000 });
        await page.waitForFunction(() => !document.getElementById('view-split').hidden);
        const brought = await page.textContent('#view-split');
        assert.ok(brought.indexOf(names[0]) >= 0 && brought.indexOf(names[1]) >= 0, 'Brought in lists both');
        const sources = await page.$$eval('#view-split .sources li', (ls) => ls.map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
        assert.ok(sources.some((s) => /^The artist’s database \(Artsy\)/.test(s) || /artist's database/.test(s)), 'deck source: ' + sources);
        assert.ok(sources.some((s) => /^Pinterest ?1$/.test(s)), 'Pinterest 1: ' + sources);
        assert.ok(sources.some((s) => /^Your photos ?1$/.test(s)), 'Your photos 1: ' + sources);
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#view-split .rows img')).some((i) => /^data:image\//.test(i.getAttribute('src') || '')));
        await noHScroll(page, 'split');
        await shot('11-split-mine');
        await page.evaluate(() => document.getElementById('main').scrollTo(0, 99999));
        await shot('11-split-mine-end');
      });

      await t.test('one comes back as Still yours?, and Let go works', async () => {
        await sleep(1100); // brought before the next five starts (whole seconds)
        await tab(page, 'sort');
        await page.click('#summary [data-act="another"]');
        await page.waitForSelector('#stack .card.is-top');
        let seen = null;
        for (let i = 0; i < 5; i++) {
          if (await summaryShown(page)) break;
          const id = await topId(page);
          if (id && id.charAt(0) === 'y') {
            seen = id;
            assert.ok(await page.$eval('#revisit', (n) => !n.hidden && /Still yours\?/.test(n.textContent)));
            assert.equal((await page.textContent('#btn-pass')).trim(), 'Let go');
            await page.waitForFunction(() => { const i = document.querySelector('#stack .card.is-top img.art'); return i && /^data:image\//.test(i.getAttribute('src') || ''); });
            await shot('12-still-yours');
            await page.click('#btn-pass');
            await page.waitForSelector('#strip .strip-in');
            assert.match(await page.textContent('#strip'), /Let go:/);
          } else {
            await page.click('#btn-keep');
          }
          await waitTopChange(page, id);
        }
        assert.ok(seen, 'a brought thing came back in the five');
        await page.waitForSelector('#summary:not([hidden])');
        await tab(page, 'split');
        const sec = await page.$eval('#view-split', (v) => { const h = v.querySelector('#sec-let-go'); return h ? h.closest('section').textContent : ''; });
        assert.ok(names.some((n) => sec.indexOf(n) >= 0), 'Let go lists the thing: ' + sec);
      });

      await t.test('Set: pin a set with a name', async () => {
        await tab(page, 'set');
        await page.waitForSelector('#view-set .room');
        await noHScroll(page, 'set');
        await shot('13-set-mine');
        await page.click('#view-set [data-act="pin"]');
        await page.waitForSelector('#sheet[open] #pin-name');
        await page.fill('#pin-name', 'A room for slow mornings');
        await shot('14-sheet-pin');
        await page.click('#sheet button[type="submit"]');
        await page.waitForFunction(() => !document.getElementById('sheet').open);
        assert.match(await page.textContent('#view-set .pinned'), /A room for slow mornings/);
        await page.evaluate(() => document.getElementById('main').scrollTo(0, 99999));
        await shot('15-set-pinned');
      });

      await t.test('See: write a note', async () => {
        await tab(page, 'see');
        await page.click('#view-see [data-act="note-free"]');
        await page.waitForSelector('#sheet[open] #note-text');
        assert.match(await page.textContent('#sheet'), /What are you looking for\?/);
        await page.fill('#note-text', 'Rooms that feel slow.');
        await shot('16-sheet-note');
        await page.click('#sheet button[type="submit"]');
        await page.waitForFunction(() => !document.getElementById('sheet').open);
        assert.match(await page.textContent('#view-see .notes'), /Rooms that feel slow\./);
        assert.match(await page.textContent('#view-see .notes'), /Earthy/);
        await noHScroll(page, 'see');
        await shot('17-see-mine');
      });

      await t.test('the Path sheet: eight milestones, exactly one Next; About and the ring switch', async () => {
        await page.click('#pathchip');
        await page.waitForSelector('#sheet[open] .path li');
        assert.equal(await page.locator('#sheet .path li').count(), 8);
        assert.equal(await page.locator('#sheet .path li.next').count(), 1);
        const words = await page.$$eval('#sheet .path .state', (s) => s.map((x) => x.textContent));
        assert.equal(words.filter((w) => w === 'Next').length, 1);
        assert.ok(words.filter((w) => w === 'Done').length >= 4, 'sort, bring, set, note done: ' + words);
        await shot('18-sheet-path');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('sheet').open && document.activeElement && document.activeElement.id === 'pathchip');
        await tab(page, 'sort');
        await page.click('[data-act="about"]');
        await page.waitForSelector('#sheet[open] #ring-switch');
        assert.equal(await page.getAttribute('#ring-switch', 'aria-checked'), 'true');
        await page.click('#ring-switch');
        assert.equal(await page.getAttribute('#ring-switch', 'aria-checked'), 'false');
        await shot('19-sheet-about');
        await page.click('#ring-switch');
        await page.keyboard.press('Escape');
      });

      await t.test('Seed draws the ground and shows the code; Copy seed takes it', async () => {
        await tab(page, 'seed');
        await page.waitForFunction(() => { const w = document.getElementById('ground-words'); return w && /An island/.test(w.textContent); }, null, { timeout: 15000 });
        const code = await page.textContent('#seed-code');
        assert.match(code, /^5S-[0-9A-F]{4}-[0-9A-F]{4}$/);
        const painted = await page.$eval('#ground', (c) => {
          const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
          for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
          return n / (d.length / 16);
        });
        assert.ok(painted > 0.2, 'the ground is drawn (' + painted + ')');
        assert.match(await page.getAttribute('#ground', 'aria-label'), /An island/);
        assert.match(await page.textContent('#ground-words'), /house/i);
        await noHScroll(page, 'seed');
        await shot('20-seed-mine');
        await page.click('[data-act="copy-seed"]');
        await page.waitForFunction(() => /Seed copied|Copy it/.test(document.getElementById('seed-status').textContent));
        assert.deepEqual(page.errors(), []);
      });

      await t.test('reload keeps judgments, notes and brought things', async () => {
        const st0 = await page.evaluate(() => JSON.parse(localStorage.getItem('5s.state.v1')));
        await page.reload();
        await page.waitForFunction(() => !!document.querySelector('#view-seed .code'));
        const st1 = await page.evaluate(() => JSON.parse(localStorage.getItem('5s.state.v1')));
        assert.equal(st1.j.length, st0.j.length);
        assert.equal(st1.notes.length, st0.notes.length);
        assert.equal(st1.own.length, 2);
        await tab(page, 'see');
        const judged = st0.j.filter((e) => String(e[0]).charAt(0) !== 'y').length + st0.own.length;
        assert.match(await page.textContent('#view-see .summaryline'), new RegExp('You kept \\d+ of ' + judged + '\\.'));
        assert.match(await page.textContent('#view-see .notes'), /Rooms that feel slow\./);
        await tab(page, 'split');
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#view-split .rows img')).some((i) => /^data:image\//.test(i.getAttribute('src') || '')));
        // a detail sheet: a brought thing, with Remove behind an in-page confirm
        await page.click('#view-split .rows .rowbtn');
        await page.waitForSelector('#sheet[open] #remove-ask');
        await shot('21-sheet-detail-own');
        await page.click('#remove-ask');
        await page.waitForSelector('#remove-yes');
        await page.click('[data-act="remove-no"]');
        await page.keyboard.press('Escape');
        await page.click('#view-split .tilegrid .tilebtn');
        await page.waitForSelector('#sheet[open] a[target="_blank"][rel="noopener"]');
        await shot('22-sheet-detail-work');
        await page.keyboard.press('Escape');
        assert.deepEqual(page.errors(), []);
      });
    } finally {
      await ctx.close();
    }
  });
}

// ---------------------------------------------------------------- a turn, and Note why

test('a turn shows in violet and offers Note why', { timeout: 120000 }, async (t) => {
  const cfg = CONFIGS[0] || { w: 390, h: 844, scheme: 'light' };
  const { ctx, page } = await newPage(cfg);
  const shot = shooter(page, cfg);
  try {
    const deck = await (await fetch(new URL('deck.json', BASE))).json();
    // A history the size of the example, saved as the person's own.
    let st = FiveS.exampleState(deck, Date.now());
    st = Object.assign({}, st, { seen: Object.assign({}, st.seen, { intro: 1 }) });
    await page.addInitScript((json) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('5s.state.v1', json); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(st));
    await page.goto(BASE + '#sort');
    await page.waitForSelector('#stack .card.is-top');
    let found = false;
    for (let round = 0; round < 6 && !found; round++) {
      if (round > 0) { await page.click('#summary [data-act="another"]'); await page.waitForSelector('#stack .card.is-top'); }
      // Ask the engine which way to judge each card of this five so that one of them is a turn.
      for (let i = 0; i < 5; i++) {
        const state = await page.evaluate(() => JSON.parse(localStorage.getItem('5s.state.v1')));
        const id = FiveS.currentCard(state);
        if (!id) break;
        let keep = true;
        if (!found) {
          if (FiveS.judge(state, deck, id, true, 1000, Date.now()).turn) { keep = true; found = true; }
          else if (FiveS.judge(state, deck, id, false, 1000, Date.now()).turn) { keep = false; found = true; }
        }
        const prev = await topId(page);
        await page.click(keep ? '#btn-keep' : '#btn-pass');
        await waitTopChange(page, prev);
        if (found && i < 5) {
          await page.waitForSelector('#strip.is-turn [data-act="note-turn"]');
          assert.match(await page.textContent('#strip'), /A turn\./);
          await shot('30-turn-strip');
          await page.click('#strip [data-act="note-turn"]');
          await page.waitForSelector('#sheet[open] #note-text');
          assert.match(await page.textContent('#sheet'), /You went against your own pattern\. What changed\?/);
          await page.fill('#note-text', 'I kept looking at it.');
          await shot('31-sheet-note-why');
          await page.click('#sheet button[type="submit"]');
          await page.waitForFunction(() => !document.getElementById('sheet').open);
          break;
        }
      }
      if (!found && !(await summaryShown(page))) {
        while (!(await summaryShown(page))) { const p = await topId(page); await page.click('#btn-keep'); await waitTopChange(page, p); }
      }
    }
    assert.ok(found, 'a turn was found within six fives');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('5s.state.v1')));
    assert.ok(s.notes.some((n) => n.q === 'turn' && n.text === 'I kept looking at it.'), 'the turn note is saved');
    await tab(page, 'see');
    await page.waitForSelector('#view-see .turns li');
    await shot('32-see-turns');
    assert.deepEqual(page.errors(), []);
    void t;
  } finally {
    await ctx.close();
  }
});

// ---------------------------------------------------------------- layout found with the real deck

// Each of these broke with real data (long titles, overflowing sheets, wide screens) and was fixed in
// integration; they are checked by geometry, since every other assertion here passed while they were broken.
test('layout holds with real-sized content (sheets, Path, Bring, Split columns)', { timeout: 90000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 560 } });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(BASE + '#sort');
    await page.waitForSelector('#btn-start');
    // wide: a short section beside a tall one keeps its content at the top (Example mode fills Split)
    await page.setViewportSize({ width: 1280, height: 800 });
    await tab(page, 'split');
    await page.click('#view-split [data-act="example-on"]');
    await page.waitForSelector('#exbanner:not([hidden])');
    const gap = await page.$eval('#sec-surfaces', (h) => {
      const sec = h.closest('section'), body = h.getBoundingClientRect().bottom;
      const next = sec.children[1] ? sec.children[1].getBoundingClientRect().top : body;
      return next - body;
    });
    assert.ok(gap <= 24, 'Surfaces: ' + gap + 'px between the heading and its tiles');
    await page.click('#exbanner [data-act="example-off"]');
    await page.setViewportSize({ width: 390, height: 560 });
    await tab(page, 'sort');
    // the Path sheet's "Go to" button sits in the text column, not squeezed under the number
    await page.click('#pathchip');
    await page.waitForSelector('#sheet[open] .path .go');
    const go = await page.$eval('#sheet .path li.next', (li) => {
      const b = li.querySelector('.go').getBoundingClientRect(), l = li.querySelector('.lbl').getBoundingClientRect();
      return { bw: b.width, bh: b.height, bl: b.left, ll: l.left };
    });
    assert.ok(go.bw >= 80 && go.bh <= 48 && go.bl >= go.ll - 1, 'Go to button: ' + JSON.stringify(go));
    // a sheet opened straight after another closes keeps its own content (the close event comes later)
    await page.evaluate(() => { document.getElementById('sheet').close(); document.getElementById('pathchip').click(); });
    await sleep(150);
    assert.equal(await page.locator('#sheet[open] .path li').count(), 8, 'the reopened sheet kept its body');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('sheet').open);
    // Bring: the "Choose images" button's words are visible on it
    await page.click('#intro [data-act="bring"]');
    await page.waitForSelector('#sheet[open] #bring-pick');
    const pick = await page.$eval('#bring-pick', (n) => { const cs = getComputedStyle(n); return { c: cs.color, bg: cs.backgroundColor, t: n.textContent.trim() }; });
    assert.equal(pick.t, 'Choose images');
    assert.notEqual(pick.c, pick.bg, 'Choose images: text and background differ');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('sheet').open);
    // a detail sheet taller than the screen scrolls; its rows never overlap
    await page.click('#btn-start');
    await page.waitForSelector('#stack .card.is-top');
    const first = await topId(page);
    await page.click('#btn-keep');
    await waitTopChange(page, first);
    await page.click('#strip [data-act="detail"]');
    await page.waitForSelector('#sheet[open] .facts');
    const geo = await page.evaluate(() => {
      const kids = Array.from(document.getElementById('sheet-body').children).map((n) => n.getBoundingClientRect());
      let overlap = 0;
      for (let i = 1; i < kids.length; i++) overlap = Math.max(overlap, kids[i - 1].bottom - kids[i].top);
      const b = document.getElementById('sheet-body');
      return { overlap, scrolls: b.scrollHeight > b.clientHeight };
    });
    assert.ok(geo.overlap <= 1, 'sheet rows overlap by ' + geo.overlap + 'px');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- reduced motion, no storage

test('reduced motion: no ring, parts appear in the strip', { timeout: 60000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  try {
    await page.goto(BASE + '#sort');
    await page.click('#btn-start');
    await page.waitForSelector('#stack .card.is-top');
    assert.equal(await page.locator('#counter svg.ring').count(), 0, 'no moving ring');
    assert.match(await page.textContent('#counter'), /5 s/);
    let kept = false;
    for (let i = 0; i < 5 && !kept; i++) {
      const id = await topId(page);
      await page.click('#btn-keep');
      await waitTopChange(page, id);
      kept = (await page.locator('#strip .parts').count()) > 0;
    }
    assert.ok(kept, 'parts listed in the strip');
    assert.equal(await page.locator('#fly-layer > *').count(), 0, 'nothing flies');
    await page.screenshot({ path: path.join(SHOTS, '390-reduced-strip.png') });
  } finally { await ctx.close(); }
});

test('works when storage throws', { timeout: 60000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    Object.defineProperty(window, 'indexedDB', { get() { throw new Error('blocked'); } });
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(BASE + '#sort');
    await page.click('#btn-start');
    for (let i = 0; i < 5; i++) { const id = await topId(page); await page.click('#btn-keep'); await waitTopChange(page, id); }
    await page.waitForSelector('#summary:not([hidden])');
    await page.click('#summary [data-act="bring"]');
    await page.waitForSelector('#sheet[open] .where');
    assert.match(await page.textContent('#sheet .where'), /this visit only/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// ---------------------------------------------------------------- the capabilities, faked

function fakeClaude(opts) {
  return `(() => {
    const opts = ${JSON.stringify(opts || {})};
    const docs = new Map(); window.__docs = docs; window.__writes = 0;
    const subs = new Map();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const snap = (p) => ({ id: p.split('/').pop(), exists: docs.has(p), data: () => (docs.has(p) ? JSON.parse(docs.get(p)) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
    const check = (p) => { const s = p.split('/'); if (s.length % 2 || s.some((x) => !/^[A-Za-z0-9_\\-.~:@+]{1,200}$/.test(x))) throw new TypeError('bad path ' + p); };
    const db = Object.freeze({
      doc(p) {
        check(p);
        return {
          id: p.split('/').pop(), path: p,
          async get() { await wait(20); return snap(p); },
          async set(d) {
            await wait(30);
            if (opts.rejectWrites) { const e = { code: 'invalid_argument', message: 'no' }; throw e; }
            window.__writes++; docs.set(p, JSON.stringify(d));
            (subs.get(p) || []).forEach((f) => setTimeout(() => f(snap(p)), 5));
          },
          async delete() { await wait(20); docs.delete(p); },
          onSnapshot(next) { const l = subs.get(p) || []; l.push(next); subs.set(p, l); setTimeout(() => next(snap(p)), 10); return () => {}; },
        };
      },
      collection() { throw new TypeError('not in this fake'); },
    });
    const user = Object.freeze({ id: async () => 'u_test1', isOwner: async () => true, canEdit: async () => true, can: async () => null });
    const sample = async (input, o) => {
      window.__prompt = input;
      await wait(150);
      o && o.onText && o.onText({ text: 'You keep', delta: 'You keep' });
      await wait(150);
      const text = 'You keep warm, handmade things and pass the glossy ones.';
      o && o.onText && o.onText({ text, delta: '' });
      return { text, truncated: false };
    };
    const downloads = Object.freeze({ save: async (r) => { window.__saved = r; return { status: 'saved' }; } });
    window.claude = { use: async (name) => {
      await wait(250);
      if (opts.none) return null;
      return { db, user, sample, downloads }[name] || null;
    } };
  })();`;
}

test('with db, user, sample and downloads (faked): state, images, Claude, seed', { timeout: 120000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.addInitScript(fakeClaude({}));
  try {
    await page.goto(BASE + '#sort');
    await page.click('#btn-start');
    for (let i = 0; i < 5; i++) { const id = await topId(page); await page.click(i % 2 ? '#btn-pass' : '#btn-keep'); await waitTopChange(page, id); }
    await page.waitForFunction(() => { const d = window.__docs.get('data/users/u_test1/state'); return d && JSON.parse(d).j.length === 5; }, null, { timeout: 5000 });
    // one write per pause, not one per judgment
    assert.ok(await page.evaluate(() => window.__writes) <= 3, 'writes are debounced');
    await page.click('#summary [data-act="bring"]');
    await page.waitForSelector('#sheet[open] .where');
    assert.match(await page.textContent('#sheet .where'), /privately/);
    await page.setInputFiles('#bring-file', (await makeImages(page)).slice(0, 1));
    await page.waitForFunction(() => document.querySelectorAll('#bring-items select').length === 1, null, { timeout: 20000 });
    await page.click('#bring-add');
    await page.waitForFunction(() => Array.from(window.__docs.keys()).some((k) => /^data\/users\/u_test1\/own-y[0-9a-z]{5}$/.test(k)), null, { timeout: 8000 });
    const own = await page.evaluate(() => { const k = Array.from(window.__docs.keys()).find((x) => /own-/.test(x)); return Object.keys(JSON.parse(window.__docs.get(k))).sort(); });
    assert.deepEqual(own, ['at', 'img', 'thumb']);
    // Ask Claude: needs ten judgments of the deck (a "Still yours?" card may take a place in a five)
    await tab(page, 'sort');
    for (let round = 0; round < 3; round++) {
      const n = await page.evaluate(() => JSON.parse(localStorage.getItem('5s.state.v1')).j.filter((e) => e[0].charAt(0) !== 'y').length);
      if (n >= 10) break;
      await page.click('#summary [data-act="another"]');
      for (let i = 0; i < 5; i++) { if (await summaryShown(page)) break; const id = await topId(page); await page.click('#btn-keep'); await waitTopChange(page, id); }
    }
    await tab(page, 'see');
    await page.waitForSelector('[data-act="claude"]');
    await page.click('[data-act="claude"]');
    await page.waitForSelector('.claude-out .by');
    await page.waitForFunction(() => /handmade/.test((document.getElementById('claude-text') || {}).textContent || ''));
    assert.match(await page.textContent('.claude-out .by'), /Written by Claude from your judgments and notes/);
    assert.match(await page.evaluate(() => window.__prompt), /map of how they decide, not a horoscope/);
    await page.screenshot({ path: path.join(SHOTS, '390-claude.png') });
    // Save your seed
    await tab(page, 'seed');
    await page.waitForSelector('[data-act="save-seed"]');
    await page.click('[data-act="save-seed"]');
    await page.waitForFunction(() => !!window.__saved);
    const saved = await page.evaluate(() => window.__saved);
    assert.match(saved.filename, /^5s-seed-5S-[0-9A-F]{4}-[0-9A-F]{4}\.json$/);
    const seed = JSON.parse(saved.data);
    assert.equal(seed.format, '5s-seed');
    assert.ok(!/u_test1/.test(saved.data), 'no account id in the seed');
    await page.waitForFunction(() => { const d = JSON.parse(window.__docs.get('data/users/u_test1/state')); return d.seen && d.seen.seed === 1; }, null, { timeout: 5000 });
  } finally { await ctx.close(); }
});

test('a rejected write says "Saved in this browser only." once; no capabilities hides Claude and Save', { timeout: 60000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.addInitScript(fakeClaude({ rejectWrites: true }));
  try {
    await page.goto(BASE + '#sort');
    await page.click('#btn-start');
    for (let i = 0; i < 3; i++) { const id = await topId(page); await page.click('#btn-keep'); await waitTopChange(page, id); }
    await page.waitForSelector('#savenote:not([hidden])', { timeout: 6000 });
    assert.equal((await page.textContent('#savenote')).trim(), 'Saved in this browser only.');
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('5s.state.v1')));
    assert.equal(st.j.length, 3, 'the browser copy is kept');
  } finally { await ctx.close(); }
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p2.addInitScript(fakeClaude({ none: true }));
  try {
    await p2.goto(BASE + '#see');
    await p2.click('#view-see [data-act="example-on"]');
    await sleep(600);
    assert.equal(await p2.locator('[data-act="claude"]').count(), 0);
    await p2.click('#exbanner [data-act="example-off"]');
    await p2.click('#tab-sort');
    await p2.click('#btn-start');
    for (let i = 0; i < 5; i++) { const id = await topId(p2); await p2.click('#btn-keep'); await waitTopChange(p2, id); }
    await p2.click('#tab-seed');
    await p2.waitForSelector('[data-act="copy-seed"]');
    assert.equal(await p2.locator('[data-act="save-seed"]').count(), 0);
  } finally { await ctx2.close(); }
});

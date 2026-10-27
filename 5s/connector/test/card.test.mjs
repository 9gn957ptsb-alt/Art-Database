// The round card's side of the connector (src/card.js, web/): signed page links, the Worker's /pp/ answer,
// the links a tool hands out, the resource's meta, and two static checks on the card and the viewer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageKey, signPage, checkPage, servePage, cardUrls, cardMeta, TOOL_META, ROUND_URI } from '../src/card.js';

const SECRET = 'a-test-secret-a-test-secret-a-test-secret';
const DIR = '0123456789abcdef0123456789abcdef';
const NOW = Date.UTC(2026, 9, 24, 9, 30);
const HOUR = 3600e3, DAY = 24 * HOUR;
const ORIGIN = 'https://fives-connector.example.workers.dev';

/** A stand-in for env.ASSETS: answers the files it holds, and remembers what it was asked for. */
function assets(files = { ['/pp/' + DIR + '/p3.jpg']: 'JPEG', ['/pp/' + DIR + '/m/p3a.json']: '{"voxel":0.5}' }) {
  const asked = [];
  return {
    asked,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      asked.push(path);
      return path in files ? new Response(files[path], { status: 200, headers: { 'Content-Type': 'image/jpeg', ETag: '"x"' } }) : new Response('not found', { status: 404 });
    },
  };
}
const get = (path, init) => new Request(ORIGIN + path, init);

test('a signed page link works for a day, and only as signed', async () => {
  const key = await pageKey(SECRET);
  const signed = await signPage(key, '/pp/p3.jpg', NOW);
  assert.match(signed, /^\/pp\/p3\.jpg\?e=\d{10}&s=[A-Za-z0-9_-]{22}$/);
  const u = (s) => new URL(ORIGIN + s);
  assert.equal(await checkPage(key, u(signed), NOW), 'p3.jpg');
  assert.equal(await checkPage(key, u(signed), NOW + DAY - 1000), 'p3.jpg', 'still good just under a day on');
  assert.equal(await checkPage(key, u(signed), NOW + DAY + 2 * HOUR), null, 'run out after the day (and its hour)');
  assert.equal(await checkPage(key, u(signed.replace('p3.jpg', 'p4.jpg')), NOW), null, 'another page');
  const e = +new URL(ORIGIN + signed).searchParams.get('e');
  assert.equal(await checkPage(key, u(signed.replace('e=' + e, 'e=' + (e + 3600))), NOW), null, 'a longer expiry');
  assert.equal(await checkPage(key, u('/pp/p3.jpg?e=' + e), NOW), null, 'no signature');
  assert.equal(await checkPage(await pageKey(SECRET + 'x'), u(signed), NOW), null, 'another key');
  const s = new URL(ORIGIN + signed).searchParams.get('s');
  assert.equal(await checkPage(key, u(signed.replace('s=' + s, 's=' + (s[0] === 'A' ? 'B' : 'A') + s.slice(1))), NOW), null, 'a changed signature');
  // The same link for an hour, so the card's image stays cached.
  assert.equal(await signPage(key, '/pp/p3.jpg', NOW + 60e3), signed);
  await assert.rejects(() => signPage(key, '/pp/' + DIR + '/p3.jpg', NOW), /Not a page path/);
  assert.equal(await pageKey('short'), null, 'no key from a short secret');
});

test('/pp/ answers a signed link from the hidden folder, with CORS, and refuses everything else', async () => {
  const urls = cardUrls(ORIGIN, SECRET);
  const env = { ASSETS: assets() };
  const page = new URL(await urls.page('p3', NOW)), model = new URL(await urls.pageModel('p3a', NOW));

  const res = await servePage(get(page.pathname + page.search), env, DIR, SECRET, NOW);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'JPEG');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('cache-control'), 'private, max-age=3600');
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(env.ASSETS.asked, ['/pp/' + DIR + '/p3.jpg']);

  const m = await servePage(get(model.pathname + model.search), env, DIR, SECRET, NOW);
  assert.equal(m.status, 200);
  assert.equal(m.headers.get('access-control-allow-origin'), '*', 'a page\'s building loads in the card (another origin)');

  const sig = page.search;
  for (const odd of ['/pp/p3.jpg', '/pp/' + DIR + '/p3.jpg', '/pp/' + DIR + '/p3.jpg' + sig, '/pp//p3.jpg' + sig, '/pp/P3.jpg' + sig,
    '/pp/p3.jpg/' + sig, '/pp/./p3.jpg?e=1', '/pp/m/../' + DIR + '/p3.jpg', '/pp/%70%33.jpg' + sig, '/pp/p3.jpeg' + sig, '/pp/p7.jpg' + sig,
    '/pp/m/p3a.json' + sig, '/pp', '/pp/']) {
    const r = await servePage(get(odd), env, DIR, SECRET, NOW);
    assert.equal(r.status, 403, odd + ' is refused');
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  }
  assert.equal(env.ASSETS.asked.length, 2, 'the static files were asked only for the two signed links');
  assert.equal((await servePage(get(page.pathname + sig), env, DIR, SECRET, NOW + 2 * DAY)).status, 403, 'an old link');

  const pre = await servePage(get('/pp/p3.jpg', { method: 'OPTIONS' }), env, DIR, SECRET, NOW);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  assert.equal((await servePage(get(page.pathname + sig, { method: 'POST' }), env, DIR, SECRET, NOW)).status, 405);
  assert.equal((await servePage(get(page.pathname + sig), env, '', SECRET, NOW)).status, 404, 'no folder: no pages');
  assert.equal((await servePage(get(page.pathname + sig), {}, DIR, SECRET, NOW)).status, 404, 'no static files: no pages');
  const gone = new URL(await urls.page('p5', NOW));
  assert.equal((await servePage(get(gone.pathname + gone.search), env, DIR, SECRET, NOW)).status, 404, 'a signed link to a file not built');
});

test('the links a tool hands out never hold the folder, and refuse odd ids', async () => {
  const urls = cardUrls(ORIGIN, SECRET);
  assert.equal(urls.assets, ORIGIN + '/s/');
  assert.equal(urls.model('b001'), ORIGIN + '/s/m/b001.json');
  assert.equal(urls.space('b001'), ORIGIN + '/s/space?m=b001');
  const page = await urls.page('p6', NOW), space = await urls.pageSpace('p3a', NOW);
  assert.match(page, /^https:\/\/fives-connector\.example\.workers\.dev\/pp\/p6\.jpg\?e=\d{10}&s=[\w-]{22}$/);
  assert.match(space, /\/s\/space\?pp=p3a&e=\d{10}&s=[\w-]{22}$/);
  // The viewer turns ?pp=&e=&s= into /pp/m/<id>.json?e=&s=, and that is a good link.
  const q = new URL(space).searchParams, key = await pageKey(SECRET);
  assert.equal(await checkPage(key, new URL(ORIGIN + '/pp/m/' + q.get('pp') + '.json?e=' + q.get('e') + '&s=' + q.get('s')), NOW), 'm/p3a.json');
  for (const s of [page, space, urls.model('b001'), urls.space('b001')]) assert.ok(!s.includes(DIR));
  assert.throws(() => urls.model('../x'), /Not a space/);
  assert.throws(() => urls.space('p3'), /Not a space/);
  await assert.rejects(() => urls.page('p7', NOW), /Not a page/);
  await assert.rejects(() => urls.pageModel('p3', NOW), /Not a page's building/);
  assert.equal(cardUrls(undefined, SECRET), undefined);
  assert.equal(cardUrls('javascript:alert(1)', SECRET), undefined);
  await assert.rejects(() => cardUrls(ORIGIN, 'short').page('p1', NOW), /No key/);
  assert.equal(cardUrls('http://localhost:8800', SECRET).model('b002'), 'http://localhost:8800/s/m/b002.json');
});

test('the card resource declares what it loads, and play_fives points at it', () => {
  const m = cardMeta(ORIGIN).ui;
  assert.deepEqual(m.csp.connectDomains, [ORIGIN]);
  assert.deepEqual(m.csp.resourceDomains, [ORIGIN, 'https://cdn.jsdelivr.net', 'https://d32dm0rphc51dk.cloudfront.net', 'https://s3.amazonaws.com']);
  assert.deepEqual(m.permissions, { clipboardWrite: {} });
  assert.equal(ROUND_URI, 'ui://fives/round.html');
  assert.deepEqual(TOOL_META, { ui: { resourceUri: ROUND_URI }, 'ui/resourceUri': ROUND_URI });
});

test('the card and the viewer: text only, the same pinned three.js, nothing written as the app\'s name', () => {
  const card = readFileSync(new URL('../web/round.html', import.meta.url), 'utf8');
  const viewer = readFileSync(new URL('../web/space.html', import.meta.url), 'utf8');
  const drawing = readFileSync(new URL('../web/space.js', import.meta.url), 'utf8');
  for (const [name, s] of [['round.html', card], ['space.html', viewer], ['space.js', drawing]]) {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/.test(s), name + ' sets text, never HTML');
    assert.ok(!/\b5s\b/i.test(s), name + ' never writes the app\'s name');
  }
  const pins = (s) => (s.match(/three@0\.147\.0\/[\w/.]+\.js["\s,]*(?:integrity=)?"sha384-[\w+/=]{64}"/g) || []).map((x) => x.replace(/integrity=|["\s,]/g, ''));
  assert.equal(pins(card).length, 2);
  assert.deepEqual(pins(card), pins(viewer), 'the card and the viewer load the same files with the same hashes');
  // A top-level const, let, class or function of these names would hide the scripts' own globals from space.js.
  assert.doesNotMatch(card, /^(const|let|class|function)\s+(THREE|Models|FivesSpace)\b/m, 'the card leaves THREE, Models and FivesSpace to their scripts');
  // The only buttons on the inline card: Pass (or Let go) and Keep under each thing, and the way to the next round.
  const buttons = card.match(/el\("button", "[^"]*", [^)]*\)/g) || [];
  assert.deepEqual(buttons.map((b) => b.split('"')[3]), ['pass', 'keep']);
});

// The Worker's own files (src/files.js): what static assets answered, now from inside the Worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundledFiles } from '../src/files.js';
import { cardUrls, servePage } from '../src/card.js';

const SECRET = 'a-test-secret-a-test-secret-a-test-secret';
const DIR = '0123456789abcdef0123456789abcdef';
const NOW = Date.UTC(2026, 9, 28, 9, 30);
const ORIGIN = 'https://fives-connector.example.workers.dev';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]);
const FILES = bundledFiles({
  '/s/space.html': { type: 'text/html; charset=utf-8', text: '<title>A space</title>' },
  '/s/m/b001.json': { type: 'application/json', text: '{"voxel":0.5}' },
  ['/pp/' + DIR + '/p3.jpg']: { type: 'image/jpeg', base64: JPEG.toString('base64') },
});
const get = (path, init) => new Request(ORIGIN + path, init);

test('/s/ files answer by their path, with the CORS and caching _headers gave them', async () => {
  const m = await FILES.fetch(get('/s/m/b001.json'));
  assert.equal(m.status, 200);
  assert.deepEqual(await m.json(), { voxel: 0.5 });
  assert.equal(m.headers.get('content-type'), 'application/json');
  assert.equal(m.headers.get('access-control-allow-origin'), '*');
  assert.equal(m.headers.get('cache-control'), 'public, max-age=300');
  assert.equal(m.headers.get('x-content-type-options'), 'nosniff');

  const viewer = await FILES.fetch(get('/s/space?m=b001'));
  assert.equal(viewer.status, 200, '/s/space is space.html, with no redirect');
  assert.match(await viewer.text(), /<title>A space<\/title>/);

  const head = await FILES.fetch(get('/s/m/b001.json', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');

  for (const odd of ['/s/m/b002.json', '/s/', '/s/m', '/s/__proto__', '/s/constructor', '/s/space.htm']) {
    assert.equal((await FILES.fetch(get(odd))).status, 404, odd);
  }
});

test('a page comes back as its bytes, only through servePage\'s signed link', async () => {
  const page = new URL(await cardUrls(ORIGIN, SECRET).page('p3', NOW));
  const res = await servePage(get(page.pathname + page.search), { ASSETS: FILES }, DIR, SECRET, NOW);
  assert.equal(res.status, 200);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), JPEG);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('cache-control'), 'private, max-age=3600');
  assert.equal((await servePage(get('/pp/p3.jpg'), { ASSETS: FILES }, DIR, SECRET, NOW)).status, 403, 'unsigned');

  const raw = await FILES.fetch(get('/pp/' + DIR + '/p3.jpg'));
  assert.equal(raw.headers.get('access-control-allow-origin'), null, '/pp/ files carry none of /s/\'s open headers');
});

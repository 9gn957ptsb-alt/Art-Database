// The hub's pieces the connector uses from the app (FiveSHub, FiveSHubPage) and its own checks:
// names, addresses, the fake GitHub as the driver sees it, the page's privacy and escaping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import FiveSHub from '../src/hub.js';
import FiveSHubPage, { isFivesPage, isFivesSeed } from '../src/hubpage.js';
import { checkName, fixName, hubAddress, isPagesName, pagesName, pagesSettingsUrl } from '../src/names.js';
import { createFakeGitHub } from '../src/fake-github.js';
import FiveS from '../src/engine.js';
import { require, FIVES, fixtureDeck, at } from './helpers.mjs';

test('the connector uses the app\'s own hub driver and hub page, not copies', () => {
  assert.equal(FiveSHub, require(join(FIVES, 'src', 'hub.js')));
  assert.equal(FiveSHubPage, require(join(FIVES, 'src', 'hubpage.js')));
});

test('names: GitHub\'s rules, the two extra guards, and a fix for each', () => {
  for (const ok of ['ada.github.io', '5s-hub', 'my_hub.v2', 'a'.repeat(100)]) assert.deepEqual(checkName(ok), { ok: true, name: ok }, ok);
  assert.equal(checkName('  my-hub ').name, 'my-hub', 'trimmed');
  for (const [bad, fix] of [['my hub', 'my-hub'], ['.github', 'github'], ['site.git', 'site'], ['', '5s-hub'], ['..', '5s-hub'], ['naïve hub!', 'naive-hub']]) {
    const r = checkName(bad);
    assert.equal(r.ok, false, bad);
    assert.ok(r.why, bad + ' says why');
    assert.equal(r.fix, fix, bad);
    assert.equal(checkName(r.fix).ok, true, 'the fix for ' + JSON.stringify(bad) + ' is itself a good name');
  }
  assert.equal(fixName('###'), '5s-hub');
});

test('addresses: the site repository is a website by itself; other hubs live under it', () => {
  assert.equal(pagesName('Ada-L'), 'ada-l.github.io');
  assert.ok(isPagesName('ADA-L.github.io', 'ada-l'));
  assert.ok(!isPagesName('5s-hub', 'ada-l'));
  assert.equal(hubAddress('Ada-L', 'Ada-L.github.io'), 'https://ada-l.github.io/');
  assert.equal(hubAddress('Ada-L', '5s-hub'), 'https://ada-l.github.io/5s-hub/');
  assert.equal(pagesSettingsUrl('Ada-L', '5s-hub'), 'https://github.com/Ada-L/5s-hub/settings/pages');
});

test('the fake GitHub answers the driver the way GitHub does, and records every request', async () => {
  const gh = createFakeGitHub({ users: [{ token: 't', id: 7, login: 'ada' }], repos: [{ owner: 'grace', name: 'secret', private: true }] });
  const api = FiveSHub.api('t', gh.fetch, { base: gh.base });
  assert.equal((await api.me()).login, 'ada');
  assert.equal(await api.getHub({ owner: 'ada', repo: 'nope' }), null);
  assert.equal(await api.getHub({ owner: 'grace', repo: 'secret' }), null, 'someone else\'s private repository is invisible');
  const hub = await api.createHub({ name: 'hub', private: false });
  assert.deepEqual([hub.owner, hub.name, hub.branch, hub.private], ['ada', 'hub', 'main', false]);
  const text = 'Ünïcödé ✓ ' + 'x'.repeat(200);
  const put = await api.putFile({ owner: 'ada', repo: 'hub', path: 'index.html', text, message: 'Save' });
  assert.equal(put.created, true);
  assert.equal((await api.getFile({ owner: 'ada', repo: 'hub', path: 'index.html' })).text, text, 'UTF-8 survives base64 both ways');
  const again = await api.putFile({ owner: 'ada', repo: 'hub', path: 'index.html', text, message: 'Save' });
  assert.equal(again.unchanged, true, 'the same text is not saved twice');
  await assert.rejects(api.createHub({ name: 'hub' }), (e) => e.code === 'exists');
  await assert.rejects(FiveSHub.api('wrong', gh.fetch, { base: gh.base }).me(), (e) => e.code === 'signed-out' && e.status === 401);
  const auth = gh.calls.map((c) => c.method + ' ' + c.path);
  assert.ok(auth.includes('POST /user/repos'));
  assert.equal(gh.calls.find((c) => c.method === 'PUT').body.text, text, 'requests are recorded with their decoded text');
});

test('the hub page: notes only when asked, other people\'s text escaped, the seed safe inside its script', () => {
  const deck = JSON.parse(JSON.stringify(fixtureDeck()));
  deck.cards[0].title = '</script><script>alert(1)</script>';
  let st = FiveS.newState();
  st = FiveS.judge(st, deck, deck.cards[0].id, true, 1200, at(2026, 10, 22, 9)).state;
  st = FiveS.addNote(st, { q: 'free', text: 'A private </script> note', ref: null }, at(2026, 10, 22, 9, 5));
  const seed = FiveS.exportSeed(st, deck, at(2026, 10, 22, 10));
  const files = (o) => Object.fromEntries(FiveSHubPage.files(Object.assign({ seed, deck }, o)).map((f) => [f.path, f.text]));
  const plain = files({});
  assert.ok(isFivesPage(plain['index.html']));
  assert.ok(isFivesSeed(plain['seed.json']));
  assert.ok(!plain['index.html'].includes('private'), 'no notes by default');
  assert.equal(JSON.parse(plain['seed.json']).notes.length, 0);
  assert.ok(!plain['index.html'].includes('<script>alert(1)'), 'titles are escaped');
  assert.equal(plain['index.html'].split('</script>').length - 1, 1, 'only the seed script closes');
  const withNotes = files({ includeNotes: true });
  assert.ok(withNotes['index.html'].includes('A private &lt;/script&gt; note'));
  assert.ok(!isFivesPage('<h1>My own site</h1>'));
  assert.ok(!isFivesSeed('{"name": "something else"}'));
});

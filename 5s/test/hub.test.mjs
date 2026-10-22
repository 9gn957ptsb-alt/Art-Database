// Tests for src/hub.js (FiveSHub: rules, links, the api driver, the device flow) and src/hubpage.js
// (FiveSHubPage: the hub page), with node --test. GitHub is faked: a small in-memory GitHub that
// records every request (method, path, headers, body), so nothing here touches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const SRC = join(here, '..', 'src');
const H = require(join(SRC, 'hub.js'));
const Page = require(join(SRC, 'hubpage.js'));
const F = require(join(SRC, 'engine.js'));
const loadDeck = () => JSON.parse(readFileSync(join(here, 'fixture', 'deck.json'), 'utf8'));
const deck = loadDeck();
const NOW = new Date(2026, 9, 22, 12).getTime();

// GitHub's words 5s never shows (SPEC.md "Your hub", Words). "GitHub" itself is a name, not a word,
// and "pages" alone is plain English ("Images and pages on Artsy"); "GitHub Pages" is the product.
const GITHUB_WORDS = /\b(repositor(y|ies)|repo|commits?|branch(es)?|pull requests?|GitHub Pages|settings)\b/i;

// ------------------------------------------------------------------ loading

test('both drivers are frozen globals in a browser and module.exports in Node; no DOM', () => {
  assert.ok(Object.isFrozen(H) && Object.isFrozen(H.rules) && Object.isFrozen(H.links));
  assert.ok(Object.isFrozen(Page));
  for (const f of ['suggest', 'isSiteRepo', 'api', 'deviceFlow']) assert.equal(typeof H[f], 'function', f);
  for (const f of ['user', 'repo']) assert.equal(typeof H.rules[f], 'function', f);
  for (const f of ['signup', 'login', 'newRepo', 'upload', 'site', 'pagesSettings']) assert.equal(typeof H.links[f], 'function', f);
  assert.equal(typeof Page.build, 'function');
  for (const [file, name] of [['hub.js', 'FiveSHub'], ['hubpage.js', 'FiveSHubPage']]) {
    const src = readFileSync(join(SRC, file), 'utf8');
    const ctx = { self: {} };
    vm.runInNewContext(src, ctx);
    assert.ok(ctx.self[name] && Object.isFrozen(ctx.self[name]), name + ' as a plain script');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const bad of [/\bdocument\./, /\bwindow\./, /localStorage/, /Math\.random\s*\(/, /Date\.now\s*\(/]) assert.ok(!bad.test(code), file + ': ' + bad);
  }
});

// ------------------------------------------------------------------ rules

test('rules.user: GitHub usernames (letters, digits, single hyphens, 1–39), with a fix-up', () => {
  const good = ['a', '0', 'ada', 'Ada-Lovelace', 'a1-b2-c3', 'octocat', 'x'.repeat(39), 'A-1'];
  for (const n of good) assert.deepEqual(H.rules.user(n), { ok: true, fixed: n, reason: '' }, n);
  assert.deepEqual(H.rules.user('  ada  '), { ok: true, fixed: 'ada', reason: '' }, 'judged once trimmed');
  const bad = {
    '': '', '   ': '', '-ada': 'ada', 'ada-': 'ada', 'a--b': 'a-b', '--': '',
    ['x'.repeat(40)]: 'x'.repeat(39), 'ada lovelace': 'ada-lovelace', 'ada_lovelace': 'ada-lovelace', 'ada.l': 'ada-l',
    '@ada': 'ada', '@@ada': 'ada', 'https://github.com/ada': 'ada', 'github.com/ada/': 'ada', 'www.github.com/Ada?tab=repositories': 'Ada',
    'José Luis': 'Jose-Luis', 'a!b': 'ab', '日本': '', 'ada-': 'ada', [('ab-').repeat(14)]: ('ab-').repeat(13).slice(0, 39).replace(/-+$/, ''),
  };
  for (const [n, fixed] of Object.entries(bad)) {
    const r = H.rules.user(n);
    assert.equal(r.ok, false, JSON.stringify(n));
    assert.equal(r.fixed, fixed, JSON.stringify(n));
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 8 && r.reason.length < 90, r.reason);
    assert.ok(!GITHUB_WORDS.test(r.reason), r.reason);
    if (r.fixed) assert.equal(H.rules.user(r.fixed).ok, true, 'the fix is valid: ' + r.fixed);
  }
  assert.match(H.rules.user('@ada').reason, /@/);
  assert.match(H.rules.user('-ada').reason, /hyphen/);
  assert.match(H.rules.user('a--b').reason, /single hyphens|two in a row/);
  assert.match(H.rules.user('x'.repeat(40)).reason, /39/);
  assert.match(H.rules.user('').reason, /username/);
  for (const odd of [null, undefined, 42, {}]) assert.equal(typeof H.rules.user(odd).ok, 'boolean');
});

test('rules.repo: a hub\'s name (letters, digits, - _ ., 1–100, not . or ..), spaces become hyphens', () => {
  const good = ['a', 'ada.github.io', '5s-hub', 'my_hub', 'A.B-C_d', '.hidden', '..x', 'x'.repeat(100), 'v1.0'];
  for (const n of good) assert.deepEqual(H.rules.repo(n), { ok: true, fixed: n, reason: '' }, n);
  const bad = {
    '': '', '.': '', '..': '', 'My hub': 'My-hub', 'my  hub': 'my-hub', ' my hub ': null, 'hub!': 'hub', 'héllo': 'hello',
    'a/b': 'a-b', ['x'.repeat(101)]: 'x'.repeat(100), '日本': '', 'my – hub': 'my-hub', 'Café hub': 'Cafe-hub',
  };
  for (const [n, fixed] of Object.entries(bad)) {
    const r = H.rules.repo(n);
    if (fixed === null) { assert.deepEqual(r, { ok: false, fixed: 'my-hub', reason: r.reason }); continue; }
    assert.equal(r.ok, false, JSON.stringify(n));
    assert.equal(r.fixed, fixed, JSON.stringify(n));
    assert.ok(r.reason.length > 8 && !GITHUB_WORDS.test(r.reason), r.reason);
    if (r.fixed) assert.equal(H.rules.repo(r.fixed).ok, true, 'the fix is valid: ' + r.fixed);
  }
  assert.match(H.rules.repo('My hub').reason, /spaces/i);
  assert.match(H.rules.repo('x'.repeat(101)).reason, /100/);
  assert.match(H.rules.repo('').reason, /name/);
});

test('suggest and isSiteRepo', () => {
  assert.deepEqual(H.suggest('ada'), { site: 'ada.github.io', plain: '5s-hub' });
  assert.deepEqual(H.suggest('Ada'), { site: 'Ada.github.io', plain: '5s-hub' });
  assert.deepEqual(H.suggest('@ada '), { site: 'ada.github.io', plain: '5s-hub' });
  assert.deepEqual(H.suggest(''), { site: '', plain: '5s-hub' });
  assert.equal(H.rules.repo(H.suggest('ada-lovelace').site).ok, true);
  assert.equal(H.isSiteRepo('ada', 'ada.github.io'), true);
  assert.equal(H.isSiteRepo('Ada', 'ada.GITHUB.io'), true);
  assert.equal(H.isSiteRepo('ada', 'ADA.github.io'), true);
  assert.equal(H.isSiteRepo('ada', '5s-hub'), false);
  assert.equal(H.isSiteRepo('ada', 'bob.github.io'), false);
  assert.equal(H.isSiteRepo('ada', 'ada.github.io.old'), false);
  assert.equal(H.isSiteRepo('', '.github.io'), false);
});

// ------------------------------------------------------------------ links

test('links: exact addresses, URL-encoded', () => {
  const L = H.links;
  assert.equal(L.signup(), 'https://github.com/signup');
  assert.equal(L.login(), 'https://github.com/login');
  assert.equal(L.device(), 'https://github.com/login/device');
  assert.equal(L.newRepo({ name: 'ada.github.io', description: 'My 5s hub', private: false }),
    'https://github.com/new?name=ada.github.io&description=My%205s%20hub&visibility=public');
  assert.equal(L.newRepo({ name: '5s-hub', private: true }), 'https://github.com/new?name=5s-hub&visibility=private');
  assert.equal(L.newRepo({ name: 'x', description: 'Taste & seed: "5s" / ü?#' }),
    'https://github.com/new?name=x&description=Taste%20%26%20seed%3A%20%225s%22%20%2F%20%C3%BC%3F%23&visibility=public');
  assert.equal(L.newRepo({}), 'https://github.com/new?visibility=public');
  assert.equal(L.upload('ada', 'ada.github.io'), 'https://github.com/ada/ada.github.io/upload/main');
  assert.equal(L.upload('ada', '5s-hub', 'gh-pages'), 'https://github.com/ada/5s-hub/upload/gh-pages');
  assert.equal(L.repo('ada', '5s-hub'), 'https://github.com/ada/5s-hub');
  assert.equal(L.pagesSettings('ada', '5s-hub'), 'https://github.com/ada/5s-hub/settings/pages');
  // the hub's address, for both shapes of hub
  assert.equal(L.site('ada', 'ada.github.io'), 'https://ada.github.io/');
  assert.equal(L.site('Ada', 'ADA.GitHub.io'), 'https://ada.github.io/');
  assert.equal(L.site('ada', '5s-hub'), 'https://ada.github.io/5s-hub/');
  assert.equal(L.site('Ada', 'My.Hub'), 'https://ada.github.io/My.Hub/');
  assert.equal(L.site('ada', ''), 'https://ada.github.io/');
  assert.equal(L.site('', 'x'), '', 'no address before a username');
  // nothing in a name can step out of its place in the address
  assert.equal(L.upload('a/b', 'c?d'), 'https://github.com/a%2Fb/c%3Fd/upload/main');
});

// ------------------------------------------------------------------ a fake GitHub

const TOKEN = 'gho_test_token';

function fakeGitHub(opts = {}) {
  const requests = [];
  const repos = new Map();   // "owner/name" -> repo
  const files = new Map();   // "owner/name/path" -> {sha, content}
  const pages = new Set();
  let n = 0;
  const sha = () => 'sha' + String(++n).padStart(4, '0');
  const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');
  // GitHub wraps base64 in lines of 60 characters
  const wrap = (s) => s.replace(/(.{60})/g, '$1\n');
  const reply = (status, data, headers) => ({
    ok: status >= 200 && status < 300, status, headers: new Headers(headers || {}),
    text: async () => (data === undefined ? '' : JSON.stringify(data)),
  });
  async function fetchImpl(url, init = {}) {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    const rq = { method: init.method || 'GET', url, path: decodeURIComponent(u.pathname) + u.search, headers: { ...(init.headers || {}) }, body };
    requests.push(rq);
    if (opts.offline) throw new TypeError('fetch failed');
    if (opts.override) { const r = opts.override(rq, reply); if (r) return r; }
    if (rq.headers.Authorization !== 'Bearer ' + TOKEN) return reply(401, { message: 'Bad credentials' });
    const p = u.pathname.split('/').map(decodeURIComponent);
    if (rq.method === 'GET' && u.pathname === '/user') return reply(200, { login: 'ada', name: 'Ada', avatar_url: 'https://avatars.example/ada', html_url: 'https://github.com/ada' });
    if (rq.method === 'POST' && u.pathname === '/user/repos') {
      const key = 'ada/' + body.name;
      if ([...repos.keys()].some((k) => k.toLowerCase() === key.toLowerCase())) {
        return reply(422, { message: 'Repository creation failed.', errors: [{ resource: 'Repository', code: 'custom', field: 'name', message: 'name already exists on this account' }] });
      }
      const repo = { name: body.name, owner: { login: 'ada' }, private: !!body.private, html_url: 'https://github.com/' + key, default_branch: 'main', description: body.description || null };
      repos.set(key, repo);
      if (body.auto_init) files.set(key + '/README.md', { sha: sha(), content: b64('# ' + body.name + '\n') });
      return reply(201, repo);
    }
    if (p[1] === 'repos') {
      const key = p[2] + '/' + p[3];
      const repo = repos.get(key);
      if (!repo) return reply(404, { message: 'Not Found' });
      if (p.length === 4 && rq.method === 'GET') return reply(200, repo);
      if (p[4] === 'contents') {
        const fp = p.slice(5).join('/');
        const f = files.get(key + '/' + fp);
        if (rq.method === 'GET') {
          if (!f) return reply(404, { message: 'Not Found' });
          return reply(200, { type: 'file', path: fp, sha: f.sha, size: Buffer.from(f.content, 'base64').length, encoding: 'base64', content: wrap(f.content), html_url: repo.html_url + '/blob/main/' + fp });
        }
        if (rq.method === 'PUT') {
          if (f && !body.sha) return reply(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
          if (f && body.sha !== f.sha) return reply(409, { message: 'index.html does not match ' + body.sha });
          const s = sha();
          files.set(key + '/' + fp, { sha: s, content: body.content });
          return reply(f ? 200 : 201, { content: { path: fp, sha: s, html_url: repo.html_url + '/blob/main/' + fp }, commit: { sha: 'c' + s, message: body.message } });
        }
      }
      if (p[4] === 'pages') {
        if (rq.method === 'GET') return pages.has(key) ? reply(200, { html_url: H.links.site(p[2], p[3]), status: 'built' }) : reply(404, { message: 'Not Found' });
        if (rq.method === 'POST') {
          if (pages.has(key)) return reply(409, { message: 'GitHub Pages is already enabled.' });
          pages.add(key);
          return reply(201, { html_url: H.links.site(p[2], p[3]), status: null, source: body.source });
        }
      }
    }
    return reply(404, { message: 'Not Found' });
  }
  const text = (key) => { const f = files.get(key); return f ? Buffer.from(f.content, 'base64').toString('utf8') : null; };
  return { fetchImpl, requests, repos, files, pages, text };
}

const HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + TOKEN };
const UNICODE = 'Café — 5s ✓ 日本語 🌱\n<p>"quotes" & \'apostrophes\'</p>\n';

// ------------------------------------------------------------------ api

test('api.me and createHub: the right requests, headers and bodies', async () => {
  const gh = fakeGitHub();
  const api = H.api(TOKEN, gh.fetchImpl);
  assert.ok(Object.isFrozen(api));
  assert.deepEqual(await api.me(), { login: 'ada', name: 'Ada', avatar: 'https://avatars.example/ada', url: 'https://github.com/ada' });
  assert.equal(gh.requests[0].url, 'https://api.github.com/user');
  assert.equal(gh.requests[0].method, 'GET');
  assert.deepEqual(gh.requests[0].headers, HEADERS);
  assert.equal(gh.requests[0].body, undefined);
  const hub = await api.createHub({ name: 'ada.github.io', description: 'My 5s hub', private: false });
  assert.deepEqual(hub, { owner: 'ada', name: 'ada.github.io', private: false, url: 'https://github.com/ada/ada.github.io', branch: 'main', site: 'https://ada.github.io/' });
  const rq = gh.requests[1];
  assert.equal(rq.method, 'POST');
  assert.equal(rq.url, 'https://api.github.com/user/repos');
  assert.deepEqual(rq.headers, { ...HEADERS, 'Content-Type': 'application/json' });
  assert.deepEqual(rq.body, { name: 'ada.github.io', private: false, auto_init: true, description: 'My 5s hub' });
  // a second hub, private, with another name: its address has the name in the path
  const two = await api.createHub({ name: '5s-hub', private: true });
  assert.equal(two.site, 'https://ada.github.io/5s-hub/');
  assert.deepEqual(gh.requests[2].body, { name: '5s-hub', private: true, auto_init: true });
  // a name GitHub would refuse never leaves 5s: the error carries the fix
  const before = gh.requests.length;
  await assert.rejects(api.createHub({ name: 'my hub' }), (e) => e.code === 'invalid' && e.status === 0 && e.fixed === 'my-hub' && /spaces/i.test(e.message));
  assert.equal(gh.requests.length, before);
  // the same name again: GitHub's 422 "already exists" becomes plain words
  await assert.rejects(api.createHub({ name: 'ada.github.io' }), (e) => {
    assert.ok(e instanceof Error);
    assert.equal(e.name, 'HubError');
    assert.equal(e.code, 'exists');
    assert.equal(e.status, 422);
    assert.ok(/already have a hub/.test(e.message) && !GITHUB_WORDS.test(e.message), e.message);
    assert.deepEqual({ ...e }, { code: 'exists', status: 422, message: e.message, detail: e.detail });
    return true;
  });
  // getHub reads it back; a missing one is null
  assert.deepEqual(await api.getHub({ owner: 'ada', repo: 'ada.github.io' }), { owner: 'ada', name: 'ada.github.io', private: false, url: 'https://github.com/ada/ada.github.io', branch: 'main' });
  assert.equal(await api.getHub({ owner: 'ada', repo: 'nope' }), null);
});

test('api.putFile and getFile: sha looked up first, passed on update, base64 of UTF-8 round-trips', async () => {
  const gh = fakeGitHub();
  const api = H.api(TOKEN, gh.fetchImpl);
  await api.createHub({ name: 'ada.github.io' });
  gh.requests.length = 0;
  // a new file: GET (404), then PUT with no sha
  const r1 = await api.putFile({ owner: 'ada', repo: 'ada.github.io', path: 'index.html', text: UNICODE, message: 'Save my hub' });
  assert.deepEqual(gh.requests.map((x) => x.method + ' ' + x.path), ['GET /repos/ada/ada.github.io/contents/index.html', 'PUT /repos/ada/ada.github.io/contents/index.html']);
  for (const x of gh.requests) assert.equal(x.headers.Authorization, 'Bearer ' + TOKEN);
  const put1 = gh.requests[1].body;
  assert.deepEqual(Object.keys(put1).sort(), ['content', 'message']);
  assert.equal(put1.message, 'Save my hub');
  assert.equal(Buffer.from(put1.content, 'base64').toString('utf8'), UNICODE, 'base64 of the UTF-8 bytes');
  assert.equal(put1.content, Buffer.from(UNICODE, 'utf8').toString('base64'));
  assert.equal(r1.created, true);
  assert.equal(r1.unchanged, false);
  assert.match(r1.sha, /^sha\d+$/);
  assert.match(r1.commit, /^csha\d+$/);
  assert.equal(gh.text('ada/ada.github.io/index.html'), UNICODE);
  // getFile decodes GitHub's line-wrapped base64 back to the same text
  const got = await api.getFile({ owner: 'ada', repo: 'ada.github.io', path: 'index.html' });
  assert.deepEqual(got, { path: 'index.html', sha: r1.sha, text: UNICODE, size: Buffer.byteLength(UNICODE) });
  assert.equal(await api.getFile({ owner: 'ada', repo: 'ada.github.io', path: 'missing.html' }), null);
  // an update: the sha from the GET goes in the PUT
  gh.requests.length = 0;
  const r2 = await api.putFile({ owner: 'ada', repo: 'ada.github.io', path: 'index.html', text: UNICODE + 'again\n' });
  assert.equal(gh.requests[1].body.sha, r1.sha);
  assert.equal(gh.requests[1].body.message, 'Save from 5s');
  assert.equal(r2.created, false);
  assert.notEqual(r2.sha, r1.sha);
  // the same text again: nothing to save, no PUT
  gh.requests.length = 0;
  const r3 = await api.putFile({ owner: 'ada', repo: 'ada.github.io', path: 'index.html', text: UNICODE + 'again\n' });
  assert.equal(r3.unchanged, true);
  assert.deepEqual(gh.requests.map((x) => x.method), ['GET']);
  // a path in a folder keeps its slashes; odd paths are refused before any request
  await api.putFile({ owner: 'ada', repo: 'ada.github.io', path: 'seeds/5S-0000-0001.json', text: '{}' });
  assert.equal(gh.requests.at(-1).path, '/repos/ada/ada.github.io/contents/seeds/5S-0000-0001.json');
  for (const bad of ['', '../x', 'a//b', '/']) await assert.rejects(api.putFile({ owner: 'ada', repo: 'ada.github.io', path: bad, text: 'x' }), (e) => e.code === 'invalid');
  // an empty file is fine (.nojekyll)
  await api.putFile({ owner: 'ada', repo: 'ada.github.io', path: '.nojekyll', text: '' });
  assert.equal(gh.text('ada/ada.github.io/.nojekyll'), '');
});

test('api.putFile: a save that crossed another (409) fetches the new sha and tries once more', async () => {
  let clashes = 1;
  const gh = fakeGitHub({ override: (rq, reply) => (rq.method === 'PUT' && clashes-- > 0 ? reply(409, { message: 'is at abc but expected def' }) : null) });
  const api = H.api(TOKEN, gh.fetchImpl);
  await api.createHub({ name: 'hub' });
  gh.requests.length = 0;
  const r = await api.putFile({ owner: 'ada', repo: 'hub', path: 'README.md', text: 'new' });
  assert.deepEqual(gh.requests.map((x) => x.method), ['GET', 'PUT', 'GET', 'PUT']);
  assert.equal(r.created, false);
  // a second clash is reported, in plain words
  clashes = 2;
  await assert.rejects(api.putFile({ owner: 'ada', repo: 'hub', path: 'README.md', text: 'newer' }), (e) => e.code === 'conflict' && e.status === 409 && !GITHUB_WORDS.test(e.message));
});

test('api.enableSite: POST pages from main, /; "already on" (409) is success; getSite reads it', async () => {
  const gh = fakeGitHub();
  const api = H.api(TOKEN, gh.fetchImpl);
  await api.createHub({ name: '5s-hub' });
  assert.equal(await api.getSite({ owner: 'ada', repo: '5s-hub' }), null);
  gh.requests.length = 0;
  const on = await api.enableSite({ owner: 'ada', repo: '5s-hub' });
  assert.deepEqual(on, { enabled: true, already: false, url: 'https://ada.github.io/5s-hub/', status: null });
  assert.equal(gh.requests[0].method, 'POST');
  assert.equal(gh.requests[0].path, '/repos/ada/5s-hub/pages');
  assert.deepEqual(gh.requests[0].body, { source: { branch: 'main', path: '/' } });
  assert.deepEqual(gh.requests[0].headers, { ...HEADERS, 'Content-Type': 'application/json' });
  const again = await api.enableSite({ owner: 'ada', repo: '5s-hub' });
  assert.deepEqual(again, { enabled: true, already: true, url: 'https://ada.github.io/5s-hub/', status: null });
  assert.deepEqual(await api.getSite({ owner: 'ada', repo: '5s-hub' }), { url: 'https://ada.github.io/5s-hub/', status: 'built', building: false });
  // a private hub on a free plan: GitHub's 422 becomes the one plain resolution
  const gh2 = fakeGitHub({ override: (rq, reply) => (rq.path.endsWith('/pages') ? reply(422, { message: 'Your current plan does not support GitHub Pages for this repository.' }) : null) });
  await assert.rejects(H.api(TOKEN, gh2.fetchImpl).enableSite({ owner: 'ada', repo: 'x' }),
    (e) => e.code === 'plan' && e.status === 422 && /Make your hub public/.test(e.message) && !GITHUB_WORDS.test(e.message));
});

test('api.saveHub: one save per changed file, in order, one message', async () => {
  const gh = fakeGitHub();
  const api = H.api(TOKEN, gh.fetchImpl);
  await api.createHub({ name: 'ada.github.io' });
  gh.requests.length = 0;
  const files = [{ path: 'index.html', text: '<!doctype html><title>A 5s hub</title>' }, { path: 'seed.json', text: '{"format":"5s-seed"}\n' }];
  const r = await api.saveHub({ owner: 'ada', repo: 'ada.github.io', files, message: 'Save my seed' });
  assert.deepEqual(gh.requests.map((x) => x.method + ' ' + x.path.split('/').pop()), ['GET index.html', 'PUT index.html', 'GET seed.json', 'PUT seed.json']);
  assert.ok(gh.requests.filter((x) => x.method === 'PUT').every((x) => x.body.message === 'Save my seed'));
  assert.equal(r.changed, 2);
  assert.equal(r.url, 'https://ada.github.io/');
  assert.deepEqual(r.saved.map((s) => [s.path, s.created]), [['index.html', true], ['seed.json', true]]);
  // again with one file changed
  const r2 = await api.saveHub({ owner: 'ada', repo: 'ada.github.io', files: [files[0], { path: 'seed.json', text: '{"format":"5s-seed","v":2}\n' }] });
  assert.equal(r2.changed, 1);
  assert.deepEqual(r2.saved.map((s) => s.unchanged), [true, false]);
  await assert.rejects(api.saveHub({ owner: 'ada', repo: 'ada.github.io', files: [] }), (e) => e.code === 'invalid');
});

test('api errors: 401, 403, 404, 409, 422, 429, 5xx and no network, each in plain words', async () => {
  const cases = [
    [401, {}, 'signed-out', /Sign in again/],
    [403, { 'x-ratelimit-remaining': '0' }, 'busy', /slow down/],
    [403, {}, 'not-allowed', /allow 5s/],
    [404, {}, 'not-found', /couldn't find your hub/],
    [409, {}, 'conflict', /changed while/],
    [422, {}, 'invalid', /letters, numbers/],
    [429, {}, 'busy', /slow down/],
    [500, {}, 'github-down', /trouble/],
    [503, {}, 'github-down', /trouble/],
    [418, {}, 'failed', /went wrong/],
  ];
  for (const [status, headers, code, words] of cases) {
    const gh = fakeGitHub({ override: (rq, reply) => reply(status, { message: 'GitHub says ' + status }, headers) });
    await assert.rejects(H.api(TOKEN, gh.fetchImpl).putFile({ owner: 'ada', repo: 'x', path: 'index.html', text: 'x' }), (e) => {
      assert.equal(e.code, code, String(status));
      assert.equal(e.status, status);
      assert.match(e.message, words);
      assert.ok(!GITHUB_WORDS.test(e.message), e.message);
      assert.match(e.detail, /GitHub says/);
      return true;
    });
  }
  // a wrong token against the real routes
  const gh = fakeGitHub();
  await assert.rejects(H.api('wrong', gh.fetchImpl).me(), (e) => e.code === 'signed-out' && e.status === 401);
  // a hub that isn't there, on save
  await assert.rejects(H.api(TOKEN, gh.fetchImpl).putFile({ owner: 'ada', repo: 'none', path: 'a.txt', text: 'x' }), (e) => e.code === 'not-found' && e.status === 404);
  // no network at all
  const off = fakeGitHub({ offline: true });
  await assert.rejects(H.api(TOKEN, off.fetchImpl).me(), (e) => e.code === 'offline' && e.status === 0 && /connection/.test(e.message));
  // every message 5s can show uses its own words
  for (const [k, m] of Object.entries(H.MESSAGES)) assert.ok(!GITHUB_WORDS.test(m) && !/\b(he|she|his|her|him|hers)\b/i.test(m), k + ': ' + m);
});

test('api.publish: the one button (sign in, make, save, address), and again when the hub is there', async () => {
  const gh = fakeGitHub();
  const sleeps = [];
  const api = H.api(TOKEN, gh.fetchImpl, { sleep: async (ms) => { sleeps.push(ms); } });
  const steps = [];
  const files = Page.files({ seed: F.exportSeed(F.exampleState(deck, NOW), deck, NOW), deck, generatedAt: NOW, site: 'https://ada.github.io/' });
  const r = await api.publish({ name: 'ada.github.io', description: 'My 5s hub', files, message: 'Save my seed', onStep: (s) => steps.push(s) });
  assert.deepEqual(steps, ['signin', 'make', 'save', 'address']);
  assert.deepEqual({ ...r, saved: r.saved.length }, { owner: 'ada', name: 'ada.github.io', private: false, url: 'https://github.com/ada/ada.github.io', site: 'https://ada.github.io/', saved: 4, made: true });
  for (const f of files) assert.equal(gh.text('ada/ada.github.io/' + f.path), f.text, f.path);
  assert.ok(gh.pages.has('ada/ada.github.io'));
  assert.deepEqual(sleeps, []);
  // pressing it again: the hub is there (made false), nothing changed, the address already on
  const r2 = await api.publish({ name: 'ada.github.io', files });
  assert.equal(r2.made, false);
  assert.ok(r2.saved.every((s) => s.unchanged));
  // a private hub: no address step
  const steps2 = [];
  const r3 = await api.publish({ name: 'private-hub', private: true, files, onStep: (s) => steps2.push(s) });
  assert.deepEqual(steps2, ['signin', 'make', 'save']);
  assert.equal(r3.site, null);
  // a hub that is not ready for files straight away: wait and try again
  let empty = 2;
  const gh2 = fakeGitHub({ override: (rq, reply) => (rq.method === 'GET' && rq.path.includes('/contents/') && empty-- > 0 ? reply(409, { message: 'Git Repository is empty.' }) : null) });
  const waits = [];
  const r4 = await H.api(TOKEN, gh2.fetchImpl, { sleep: async (ms) => { waits.push(ms); } }).publish({ name: 'fresh', files: files.slice(0, 1) });
  assert.deepEqual(waits, [1000, 2000]);
  assert.equal(r4.saved[0].created, true);
});

// ------------------------------------------------------------------ device flow

function fakeDevice(tokenReplies, codeReply) {
  const requests = [];
  async function fetchImpl(url, init) {
    const u = new URL(url);
    requests.push({ url, path: u.pathname, method: init.method, headers: { ...init.headers }, body: Object.fromEntries(new URLSearchParams(init.body)) });
    const json = (status, data) => ({ ok: status < 300, status, headers: new Headers(), text: async () => JSON.stringify(data) });
    if (u.pathname.endsWith('/login/device/code')) return json(200, codeReply || { device_code: 'dc-123', user_code: 'WDJB-MJHT', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 });
    if (u.pathname.endsWith('/login/oauth/access_token')) return json(200, tokenReplies.length ? tokenReplies.shift() : { error: 'authorization_pending' });
    return json(404, { error: 'not_found' });
  }
  return { fetchImpl, requests };
}
const PENDING = { error: 'authorization_pending', error_description: 'The authorization request is still pending.' };

test('deviceFlow: code, then polling with the interval; slow_down slows it; a token at the end', async () => {
  const dv = fakeDevice([PENDING, { error: 'slow_down', interval: 10 }, PENDING, { access_token: 'gho_new', token_type: 'bearer', scope: 'public_repo' }]);
  const slept = [];
  const codes = [];
  const r = await H.deviceFlow({
    clientId: 'Iv1.abc', endpoint: 'https://proxy.example/gh/', fetchImpl: dv.fetchImpl,
    onCode: (c) => codes.push(c), sleep: async (ms) => { slept.push(ms); },
  });
  assert.deepEqual(r, { token: 'gho_new', tokenType: 'bearer', scope: 'public_repo' });
  assert.deepEqual(codes, [{ userCode: 'WDJB-MJHT', verificationUri: 'https://github.com/login/device', expiresIn: 900, interval: 5 }]);
  assert.deepEqual(slept, [5000, 5000, 10000, 10000]);
  assert.deepEqual(dv.requests.map((x) => x.url), ['https://proxy.example/gh/login/device/code'].concat(Array(4).fill('https://proxy.example/gh/login/oauth/access_token')));
  for (const x of dv.requests) {
    assert.equal(x.method, 'POST');
    assert.deepEqual(x.headers, { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' });
  }
  assert.deepEqual(dv.requests[0].body, { client_id: 'Iv1.abc', scope: 'public_repo' });
  assert.deepEqual(dv.requests[1].body, { client_id: 'Iv1.abc', device_code: 'dc-123', grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
  // slow_down with no interval adds five seconds; the default endpoint is github.com; a scope can be asked for
  const dv2 = fakeDevice([{ error: 'slow_down' }, { access_token: 't' }]);
  const s2 = [];
  const r2 = await H.deviceFlow({ clientId: 'c', fetchImpl: dv2.fetchImpl, scope: 'repo', sleep: async (ms) => { s2.push(ms); } });
  assert.deepEqual(s2, [5000, 10000]);
  assert.equal(r2.token, 't');
  assert.equal(dv2.requests[0].url, 'https://github.com/login/device/code');
  assert.equal(dv2.requests[0].body.scope, 'repo');
});

test('deviceFlow: expired, turned down, stopped, not set up, no network', async () => {
  const quick = { sleep: async () => {} };
  await assert.rejects(H.deviceFlow({ clientId: 'c', fetchImpl: fakeDevice([PENDING, { error: 'expired_token' }]).fetchImpl, ...quick }),
    (e) => e.code === 'expired' && /ran out of time/.test(e.message));
  // the code's own time runs out while still pending
  const dv = fakeDevice([], { device_code: 'd', user_code: 'U', verification_uri: 'https://github.com/login/device', expires_in: 12, interval: 5 });
  const s = [];
  await assert.rejects(H.deviceFlow({ clientId: 'c', fetchImpl: dv.fetchImpl, sleep: async (ms) => { s.push(ms); } }), (e) => e.code === 'expired');
  assert.deepEqual(s, [5000, 5000, 5000]);
  await assert.rejects(H.deviceFlow({ clientId: 'c', fetchImpl: fakeDevice([{ error: 'access_denied' }]).fetchImpl, ...quick }),
    (e) => e.code === 'denied' && /turned down/.test(e.message));
  // stopped from 5s (an AbortSignal) between polls
  const ctrl = new AbortController();
  let polls = 0;
  await assert.rejects(H.deviceFlow({
    clientId: 'c', fetchImpl: fakeDevice([PENDING, PENDING, PENDING]).fetchImpl, signal: ctrl.signal,
    sleep: async () => { if (++polls === 2) ctrl.abort(); },
  }), (e) => e.code === 'cancelled' && e.message === 'Sign-in stopped.');
  // stopped during the real wait (the built-in sleep honours the signal)
  const ctrl2 = new AbortController();
  const p = H.deviceFlow({ clientId: 'c', fetchImpl: fakeDevice([]).fetchImpl, signal: ctrl2.signal, onCode: () => setTimeout(() => ctrl2.abort(), 10) });
  await assert.rejects(p, (e) => e.code === 'cancelled');
  // already stopped before it starts waiting
  const ctrl3 = new AbortController();
  ctrl3.abort();
  await assert.rejects(H.deviceFlow({ clientId: 'c', fetchImpl: fakeDevice([]).fetchImpl, signal: ctrl3.signal }), (e) => e.code === 'cancelled');
  // not set up: no client id, or GitHub says the flow is off
  await assert.rejects(H.deviceFlow({ fetchImpl: fakeDevice([]).fetchImpl }), (e) => e.code === 'setup');
  await assert.rejects(H.deviceFlow({ clientId: 'c', fetchImpl: fakeDevice([], { error: 'device_flow_disabled' }).fetchImpl, ...quick }), (e) => e.code === 'setup');
  await assert.rejects(H.deviceFlow({ clientId: 'c', fetchImpl: fakeDevice([{ error: 'incorrect_client_credentials' }]).fetchImpl, ...quick }), (e) => e.code === 'setup');
  // no network
  await assert.rejects(H.deviceFlow({ clientId: 'c', fetchImpl: async () => { throw new TypeError('fetch failed'); }, ...quick }), (e) => e.code === 'offline' && e.status === 0);
});

// ------------------------------------------------------------------ the hub page

const seedJsonOf = (html) => {
  const open = '<script type="application/json" id="seed">';
  const a = html.indexOf(open);
  assert.ok(a > 0, 'the seed script is there');
  const b = html.indexOf('</script>', a);
  return JSON.parse(html.slice(a + open.length, b));
};
const count = (s, sub) => { let n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; };
// The page without its seed: the seed is inert JSON data and may hold any string as data.
const withoutSeed = (html) => {
  const a = html.indexOf('<script type="application/json" id="seed">');
  return html.slice(0, a) + html.slice(html.indexOf('</script>', a) + '</script>'.length);
};
const seedText = (html) => {
  const open = '<script type="application/json" id="seed">';
  const a = html.indexOf(open);
  return html.slice(a + open.length, html.indexOf('</script>', a));
};

function example() {
  const ex = F.exampleState(deck, NOW);
  const seed = F.exportSeed(ex, deck, NOW);
  const profile = F.profile(ex, deck, NOW);
  return { ex, seed, profile, philosophy: F.philosophy(profile, deck) };
}

test('hubpage.build: a complete standalone document with the seed riding along', () => {
  const { seed, profile, philosophy } = example();
  const html = Page.build({ seed, profile, philosophy, deck, generatedAt: NOW, colourName: F.colourName });
  assert.ok(html.startsWith('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">'));
  assert.ok(html.endsWith('</body>\n</html>\n'));
  assert.equal(count(html, '<title>'), 1);
  assert.equal(count(html, '</title>'), 1);
  assert.ok(html.includes('<title>A 5s hub</title>'), 'the default title');
  assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'));
  // the connector recognises a 5s page by this marker and the seed tag before saving over it
  assert.equal(count(html, '<meta name="generator" content="5s">'), 1);
  assert.equal(count(html, '<script type="application/json" id="seed">'), 1);
  for (const tag of ['<head>', '</head>', '<body>', '</body>', '<main', '</main>', '<style>', '</style>']) assert.equal(count(html, tag), 1, tag);
  // the 5s look: tokens for light and dark, the three faces with fallbacks, no external script
  assert.ok(html.includes('@media (prefers-color-scheme: dark)') && html.includes(':root[data-theme="dark"]'));
  for (const face of ['family=Unbounded', 'family=Figtree', 'family=Martian+Mono', '"Unbounded", "Arial Black"', '"Figtree", ui-sans-serif', '"Martian Mono", ui-monospace']) assert.ok(html.includes(face), face);
  assert.equal(count(html, '<script'), 1, 'only the seed');
  assert.ok(!html.includes(' src="http') || !html.slice(html.indexOf('<script')).startsWith('<script src'));
  assert.ok(!/javascript:/i.test(html));
  // the seed: the same object back (notes left out unless asked)
  assert.deepEqual(seedJsonOf(html), { ...seed, notes: [] });
  const withNotes = Page.build({ seed, deck, includeNotes: true });
  assert.deepEqual(seedJsonOf(withNotes), seed);
  // what it shows
  assert.ok(html.includes('<b>' + seed.code + '</b>'));
  for (const l of philosophy) assert.ok(html.includes(Page.escape(l)), l);
  for (const e of profile.positive) assert.ok(html.includes(Page.escape(e.label) + ' <span class="n">kept ' + e.kept + ' of ' + e.n + '</span>'), e.label);
  assert.ok(html.includes('class="chip neg"'));
  assert.ok(html.includes('Images and pages on Artsy'));
  const byWork = new Map(deck.cards.map((c) => [c.work, c]));
  for (const k of seed.kept) {
    const c = byWork.get(k.work);
    assert.ok(html.includes('href="' + k.url + '"'), k.work + ' links to its Artsy page');
    if (c.kind !== 'colour') assert.ok(html.includes('src="' + k.image + '"'), k.work + ' shows its Artsy image');
    assert.ok(html.includes(Page.escape(c.title)), c.title);
  }
  for (const h of seed.palette.kept.slice(0, 20)) assert.ok(html.includes('background:' + h), h);
  for (const s of seed.sets) assert.ok(html.includes('<p class="name">' + Page.escape(s.name) + '</p>'), s.name);
  assert.ok(html.includes('class="room'));
  // nothing that should not be there
  assert.ok(!html.includes('id="notes"'));
  assert.ok(!html.includes('id="own"'));
  assert.ok(!html.includes('id="ground"'));
  assert.ok(!GITHUB_WORDS.test(html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/, '').replace(/https?:\/\/[^"\s<]+/g, '')), 'no GitHub words on the page');
  assert.ok(!/\b(he|she|his|her|him|hers)\b/i.test(html.replace(/<script[\s\S]*?<\/script>/, '').replace(/<style>[\s\S]*?<\/style>/, '')));
  // deterministic
  assert.equal(Page.build({ seed, profile, philosophy, deck, generatedAt: NOW, colourName: F.colourName }), html);
  assert.ok(html.includes('Made in 5s on 22 October 2026.'));
});

test('hubpage.build: other people\'s text is escaped everywhere; addresses and colours are checked', () => {
  const { seed } = example();
  const evil = '<img src=x onerror=alert(1)>"\'&';
  const closer = '</script><script>alert("x")</script><!--';
  const d = loadDeck();
  const target = d.cards.find((c) => c.work === seed.kept[0].work);
  target.title = '"><svg onload=alert(2)>';
  target.artist = '<b>Artist</b>';
  const s = structuredClone(seed);
  s.notes.push({ q: 'free', text: closer, about: evil, at: '2026-10-22' });
  s.sets[0].name = evil;
  s.kept[1].image = 'javascript:alert(3)';
  s.kept[2].url = 'https://evil.example/" onmouseover="alert(4)';
  s.palette.kept = ['#abc', 'red;background:url(https://evil.example/x)', '#123456'];
  const html = Page.build({ seed: s, deck: d, title: evil, includeNotes: true, groundPng: 'javascript:alert(5)', groundAlt: evil });
  const escaped = '&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;';
  assert.ok(html.includes('<title>' + escaped + '</title>'));
  assert.ok(html.includes('<h1>' + escaped + '</h1>'));
  assert.ok(html.includes('<p class="name">' + escaped + '</p>'));
  assert.ok(html.includes('&quot;&gt;&lt;svg onload=alert(2)&gt;'));
  assert.ok(html.includes('&lt;b&gt;Artist&lt;/b&gt;'));
  assert.ok(html.includes(Page.escape(closer)), 'the note, as text');
  const shown = withoutSeed(html);
  for (const raw of ['<img src=x', '<svg', '<b>Artist', 'alert(3)', 'onmouseover', 'evil.example', 'alert(5)', '<!--']) assert.ok(!shown.includes(raw), raw);
  // inside the seed nothing can close the script or open a comment: no < or > at all
  assert.ok(!/[<>]/.test(seedText(html)));
  assert.equal(count(html, '<script'), 1);
  assert.equal(count(html, '</script>'), 1);
  assert.ok(html.includes('background:#aabbcc') && html.includes('background:#123456'));
  // the seed still parses back exactly, hostile text and all
  assert.deepEqual(seedJsonOf(html), s);
});

test('hubpage.build: notes only when included; brought-in images only when included; the ground when given', () => {
  const { ex, seed } = example();
  const note = seed.notes.find((n) => n.q === 'bring');
  const thumb = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const ownThumbs = ex.own.map((o) => ({ name: o.name, src: thumb }));
  const base = { seed, deck, generatedAt: NOW, ownThumbs };
  const plain = Page.build(base);
  assert.ok(!plain.includes(Page.escape(note.text)), 'no notes by default');
  assert.deepEqual(seedJsonOf(plain).notes, []);
  assert.ok(!plain.includes('data:image/png'), 'no own images by default');
  assert.ok(plain.includes('brought in from elsewhere, kept private.'));
  const withNotes = Page.build({ ...base, includeNotes: true });
  assert.ok(withNotes.includes('id="notes"') && withNotes.includes(Page.escape(note.text)));
  assert.ok(withNotes.includes('about Grandmother&#39;s bowl'));
  const withOwn = Page.build({ ...base, includeOwnImages: true });
  assert.ok(withOwn.includes('id="own"'));
  const kept = ex.own.filter((o) => o.let == null);
  assert.equal(count(withOwn, 'src="' + thumb + '"') >= kept.length, true);
  for (const o of kept) assert.ok(withOwn.includes('alt="' + Page.escape(o.name) + '"'), o.name);
  assert.ok(!withOwn.includes('id="notes"'));
  // a let-go thing's image stays out even with own images on
  const gone = ex.own.find((o) => o.let != null);
  const goneOnly = Page.build({ ...base, includeOwnImages: true, ownThumbs: [{ name: gone.name, src: thumb }] });
  assert.ok(!goneOnly.includes('id="own"'));
  // thumbnails must be images: anything else is dropped
  assert.ok(!Page.build({ ...base, includeOwnImages: true, ownThumbs: ex.own.map((o) => ({ name: o.name, src: 'data:text/html;base64,PHNjcmlwdD4=' })) }).includes('data:text'));
  // the ground as a PNG
  const g = Page.build({ ...base, groundPng: thumb, groundAlt: 'An island on a plinth.' });
  assert.ok(g.includes('id="ground"') && g.includes('<img src="' + thumb + '" alt="An island on a plinth.">'));
  // nothing personal beyond the seed: a hub set on the state changes nothing
  const withHub = F.setHub(ex, { user: 'secret-handle', name: 'secret-handle.github.io', madeAt: true }, NOW);
  assert.equal(Page.build({ ...base, seed: F.exportSeed(withHub, deck, NOW) }), plain);
});

test('hubpage.build: small (well under 1 MB without the ground), even with every card kept', () => {
  const { seed, profile, philosophy } = example();
  const html = Page.build({ seed, profile, philosophy, deck, includeNotes: true, generatedAt: NOW });
  assert.ok(html.length < 120000, 'example: ' + html.length);
  // 400 kept works (a real deck's worth), with long titles
  const big = { ...seed, kept: Array.from({ length: 400 }, (_, i) => ({ work: 'w' + i, kind: F.KINDS[i % 5], ms: 1500, image: 'https://images.example.org/fixture/w' + i + '/large.jpg', url: 'https://www.artsy.net/artwork/w' + i })) };
  const bigDeck = { ...deck, cards: big.kept.map((k, i) => ({ id: 'z' + i, kind: k.kind, work: k.work, title: 'A rather long title for a work, number ' + i, artist: 'Someone Withalongname', date: '1970', colours: ['#aa5533', '#ddccbb', '#332211'], crop: k.kind === 'surface' ? [0.3, 0.3, 0.25, 0.25] : undefined, cdn: k.image, url: k.url })) };
  const html2 = Page.build({ seed: big, profile, philosophy, deck: bigDeck, includeNotes: true });
  assert.ok(Buffer.byteLength(html2) < 1024 * 1024, 'big: ' + Buffer.byteLength(html2));
  assert.equal(count(html2, '<li class="work'), 400);
  // with no deck at all it still names and links every kept work
  const bare = Page.build({ seed });
  assert.equal(count(bare, '<li class="work'), seed.kept.length);
  assert.equal(count(bare, 'href="https://www.artsy.net/artwork/'), seed.kept.length);
});

test('hubpage.files and readme: the hub\'s files, with the seed as published', () => {
  const { seed } = example();
  const files = Page.files({ seed, deck, generatedAt: NOW, site: 'https://ada.github.io/' });
  assert.deepEqual(files.map((f) => f.path), ['index.html', 'seed.json', 'README.md', '.nojekyll']);
  assert.equal(files[0].text, Page.build({ seed, deck, generatedAt: NOW, site: 'https://ada.github.io/' }));
  assert.deepEqual(JSON.parse(files[1].text), { ...seed, notes: [] });
  assert.deepEqual(JSON.parse(Page.files({ seed, includeNotes: true })[1].text), seed);
  assert.ok(files[2].text.startsWith('# A 5s hub\n') && files[2].text.includes('https://ada.github.io/'));
  assert.ok(!GITHUB_WORDS.test(files[2].text.replace(/https?:\/\/\S+/g, '')));
  assert.equal(files[3].text, '');
  assert.equal(Page.readme({ site: 'javascript:alert(1)' }).includes('javascript'), false);
});

// The artist's Architectural Authority bookmarks (synthetic here, as the fixture is): a building's
// Space and Surface share their work, and their pages are on The Architectural Authority.
test('hubpage: a kept building\'s Surface keeps its crop, and the credits name both sites', () => {
  const page = 'https://www.thearchitecturalauthority.com/article/fixture-building';
  const bld = (cid, from, extra) => ({ ...deck.cards.find((c) => c.id === from), id: cid, work: 'fixture-building', title: 'Fixture Building',
    artist: 'Fixture Studio', source: 'Architectural Authority', url: page, cdn: 'https://images.example.org/fixture/building/photo.jpg', ...extra });
  const d = { ...deck, cards: deck.cards.concat([bld('b001', 's001', { crop: undefined }), bld('m001', 'u001', { crop: [0.5, 0.1, 0.2, 0.25] })]) };
  const keep = (ids) => ids.reduce((st, cid, i) => F.judge(st, d, cid, true, 1500, NOW - 60000 + i * 4000).state, F.newState());
  const seed = F.exportSeed(keep(['i001', 'b001', 'm001']), d, NOW);
  const html = Page.build({ seed, deck: d, generatedAt: NOW });
  const surface = html.slice(html.indexOf('<li class="work k-surface">'));
  assert.ok(surface.startsWith('<li class="work k-surface"><a href="' + page + '"><span class="pic crop"'), 'the Surface is its crop, linked to its page');
  assert.ok(surface.includes('style="width:500%;height:400%;left:-250%;top:-40%"'), 'at its own scale');
  assert.equal(count(html, 'href="' + page + '"'), 2);
  assert.ok(html.includes('<p class="credit">Images and pages on Artsy and The Architectural Authority</p>'));
  assert.ok(html.includes('Images and pages on Artsy and The Architectural Authority.</p>'), 'the footer too');
  assert.ok(Page.files({ seed, deck: d })[2].text.includes('Images and pages of the works are on Artsy and The Architectural Authority.'));
  // only bookmarks kept: that site alone; nothing kept, or no seed: Artsy, as before
  const only = Page.build({ seed: F.exportSeed(keep(['b001']), d, NOW), deck: d });
  assert.ok(only.includes('<p class="credit">Images and pages on The Architectural Authority</p>') && !only.includes('on Artsy'));
  assert.ok(Page.build({ seed: F.exportSeed(F.newState(), d, NOW), deck: d }).includes('Images and pages on Artsy.</p>'));
  assert.ok(Page.readme({}).includes('Images and pages of the works are on Artsy.'));
});

test('hubpage: a room from the seed\'s own sets (as the connector draws it) puts a building\'s crop on the floor, not its Space', () => {
  const bld = (cid, from, extra) => ({ ...deck.cards.find((c) => c.id === from), id: cid, work: 'fixture-building', source: 'Architectural Authority',
    url: 'https://www.thearchitecturalauthority.com/article/fixture-building', ...extra });
  const d = { ...deck, cards: deck.cards.concat([bld('b001', 's001', { cdn: 'https://images.example.org/fixture/building/space.jpg' }),
    bld('m001', 'u001', { cdn: 'https://images.example.org/fixture/building/detail.jpg', crop: [0.5, 0.1, 0.2, 0.25] })]) };
  let st = ['c001', 'b001', 'i001', 'm001', 'o001'].reduce((s, cid, i) => F.judge(s, d, cid, true, 1500, NOW - 60000 + i * 4000).state, F.newState());
  st = F.pinSet(st, { wall: 'c001', window: 'b001', picture: 'i001', floor: 'm001', object: 'o001', name: 'Bookmarks' }, NOW - 1000);
  const seed = F.exportSeed(st, d, NOW);
  assert.equal(seed.sets[0].window, seed.sets[0].floor, 'the seed names both by their one work');
  const html = Page.build({ seed, deck: d, generatedAt: NOW });
  const floor = html.slice(html.indexOf('<div class="floor">'), html.indexOf('<div class="floorshade">'));
  assert.ok(floor.includes('detail.jpg" alt="" loading="lazy" decoding="async" style="width:500%;height:400%;left:-250%;top:-40%"'), floor);
  assert.ok(html.includes('<span class="win"><img src="https://images.example.org/fixture/building/space.jpg"'), 'the window is its Space');
});

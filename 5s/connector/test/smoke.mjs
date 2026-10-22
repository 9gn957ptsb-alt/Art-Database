#!/usr/bin/env node
// Live smoke (npm run smoke): the Worker itself under `wrangler dev`, twice.
//
//  1. Dev bypass (DEV_FAKE_USER, port 8800 or SMOKE_PORT): an MCP client (@modelcontextprotocol/sdk, streamable
//     HTTP) lists the tools and plays a five (next_five, judge ×5, get_taste), makes a hub against the
//     fake GitHub, and the bypass is refused for any host but localhost. A second dev person can't
//     use, strip or end the first one's session id, and the local storage never holds the token.
//     Connect your apps: read_link reads a Pinterest board and a web page from the fake web
//     (src/fake-web.js, which the dev bypass reads instead of the internet, behind the real guard of
//     src/web.js), bring_in adds two of its pictures with their colours read inside workerd,
//     item_image hands one back as an image, a link that redirects into a private network is
//     refused, and the local storage keeps the pictures' addresses, never the pictures.
//  2. Real sign-in (no DEV_FAKE_USER, port 8802 or SMOKE_PORT + 2): /mcp without a token is 401 with the OAuth
//     discovery Claude follows, dynamic client registration works, /authorize shows "Connect 5s",
//     and approving it sends the browser to GitHub's own sign-in page with the right scopes and PKCE.
//     Approving from another site, or to an unregistered redirect address, is refused; a burst of
//     registrations gets 429; and the local storage never holds the client secret or cookie key.
//
// Env: SMOKE_DIR (scratch for env files, local KV and logs; default a temp dir); SMOKE_PORT (the first
// of the four ports it uses, default 8800: the Workers on SMOKE_PORT and SMOKE_PORT + 2, each with its
// inspector on the next port).
// Needs src/deck.generated.json (npm run deck, or npm run deck -- --fixture).
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const CONNECTOR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT) || 8800;
const DIR = process.env.SMOKE_DIR || mkdtempSync(join(tmpdir(), '5s-connector-smoke-'));
mkdirSync(DIR, { recursive: true });
if (!existsSync(join(CONNECTOR, 'src', 'deck.generated.json'))) {
  console.error('No src/deck.generated.json: run `npm run deck` (or `npm run deck -- --fixture`) first.');
  process.exit(1);
}

const results = [];
const check = (name, fn) => { fn(); results.push(name); console.log('  ok  ' + name); };

function startWorker(name, port, vars) {
  const envFile = join(DIR, name + '.env');
  writeFileSync(envFile, Object.entries(vars).map(([k, v]) => k + '=' + v).join('\n') + '\n');
  const log = join(DIR, name + '.log');
  rmSync(join(DIR, name + '-state'), { recursive: true, force: true }); // every run starts with empty KV and sessions
  // Its own process group, so stopping it stops wrangler's children (node, workerd) too.
  const child = spawn(join(CONNECTOR, 'node_modules', '.bin', 'wrangler'), ['dev', '--port', String(port), '--inspector-port', String(port + 1), '--ip', '127.0.0.1',
    '--env-file', envFile, '--persist-to', join(DIR, name + '-state'), '--show-interactive-dev-session=false'], {
    cwd: CONNECTOR, env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false' }), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const kill = (sig) => { try { process.kill(-child.pid, sig); } catch { /* already gone */ } };
  const stop = () => new Promise((res) => {
    if (child.exitCode !== null) { kill('SIGTERM'); return res(); }
    child.once('exit', () => { kill('SIGTERM'); res(); });
    kill('SIGTERM');
    setTimeout(() => kill('SIGKILL'), 5000).unref();
  }).then(() => writeFileSync(log, out));
  process.once('exit', () => kill('SIGKILL'));
  const ready = (async () => {
    try { await fetch('http://localhost:' + port + '/'); throw new Error('port ' + port + ' is already in use: stop what is running there first'); } catch (e) { if (/already in use/.test(e.message)) { await stop(); throw e; } }
    for (let i = 0; i < 120; i++) {
      if (child.exitCode !== null) throw new Error('wrangler dev exited:\n' + out.slice(-2000));
      try { const r = await fetch('http://localhost:' + port + '/'); if (r.ok) return; } catch { /* not yet */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('wrangler dev did not start on ' + port + ':\n' + out.slice(-2000));
  })();
  return { ready, stop, base: 'http://localhost:' + port };
}

const parse = (r) => JSON.parse(r.content[1].text);

/** Every file under dir (wrangler's local KV, Durable Object SQLite and caches) that holds `needle`. */
function filesHolding(dir, needle) {
  const hits = [], want = Buffer.from(needle);
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (readFileSync(p).includes(want)) hits.push(p.slice(dir.length + 1));
    }
  };
  if (existsSync(dir)) walk(dir);
  return hits;
}

const MCP_HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' };
const toolsList = JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} });

async function devBypass() {
  console.log('1. dev bypass (DEV_FAKE_USER) on :' + PORT);
  const w = startWorker('bypass', PORT, {
    GITHUB_CLIENT_ID: 'dev-placeholder', GITHUB_CLIENT_SECRET: 'dev-placeholder',
    COOKIE_ENCRYPTION_KEY: 'dev-placeholder-dev-placeholder-dev-placeholder', DEV_FAKE_USER: '1001:artist-dev,1002:other-dev',
    // wrangler.jsonc sets 0 for Workers Free; here the pictures are measured inside workerd, as on Paid.
    COLOUR_BUDGET_PX: '4000000',
  });
  try {
    await w.ready;
    const client = new Client({ name: '5s-smoke', version: '1' });
    const transport = new StreamableHTTPClientTransport(new URL(w.base + '/mcp'));
    await client.connect(transport);
    const { tools } = await client.listTools();
    check('tools/list gives the ten tools, and Connect your apps\' three', () => assert.deepEqual(tools.map((t) => t.name),
      ['get_taste', 'aesthetic_brief', 'next_five', 'judge', 'get_seed', 'hub_status', 'make_hub', 'save_hub', 'get_state', 'put_state',
        'read_link', 'bring_in', 'item_image']));

    const five = await client.callTool({ name: 'next_five', arguments: {} });
    const cards = five.structuredContent.cards;
    check('next_five: five cards, one per kind, image addresses, no names', () => {
      assert.equal(cards.length, 5);
      assert.deepEqual(cards.map((c) => c.kind).sort(), ['colour', 'image', 'object', 'space', 'surface']);
      for (const c of cards) {
        assert.equal(c.title, undefined);
        if (c.kind !== 'colour') assert.match(c.image, /^https:\/\//);
      }
    });
    console.log('      ' + five.content[0].text);
    let last;
    for (const [i, c] of cards.entries()) {
      last = await client.callTool({ name: 'judge', arguments: { card: c.card, keep: i % 2 === 0 } });
      const d = last.structuredContent;
      console.log('      judge ' + c.card + ' (' + c.kind + ') -> ' + (d.kept ? 'kept' : 'passed') + ': "' + d.reveal.title + '", ' + d.reveal.artist);
    }
    check('judge ×5: reveals after each, and the five is sorted', () => {
      assert.equal(last.structuredContent.five.done, true);
      assert.equal(last.structuredContent.five_sorted.kept, 3);
    });
    const taste = await client.callTool({ name: 'get_taste', arguments: {} });
    check('get_taste: five judged, three kept', () => {
      assert.equal(taste.structuredContent.judged, 5);
      assert.equal(taste.structuredContent.kept, 3);
    });
    console.log('      ' + taste.content[0].text.split('\n')[0]);

    const hub = await client.callTool({ name: 'make_hub', arguments: {} });
    check('make_hub against the fake GitHub: artist-dev.github.io', () => {
      assert.equal(hub.isError, undefined, hub.content[0].text);
      assert.equal(hub.structuredContent.address, 'https://artist-dev.github.io/');
    });
    const fake = await (await fetch(w.base + '/dev/fake-github')).json();
    check('the fake GitHub holds the hub page, seed, README and .nojekyll', () => {
      const repo = fake.repos['artist-dev/artist-dev.github.io'];
      assert.deepEqual(Object.keys(repo.files).sort(), ['.nojekyll', 'README.md', 'index.html', 'seed.json']);
      assert.match(repo.files['index.html'].text, /<meta name="generator" content="5s">/);
    });
    const status = await client.callTool({ name: 'hub_status', arguments: {} });
    check('hub_status after: has a hub, nothing to save', () => {
      assert.equal(status.structuredContent.has_hub, true);
      assert.equal(status.structuredContent.needs_save, false);
    });

    // A session belongs to the person who opened it (src/session.ts).
    const sid = transport.sessionId;
    check('the session id handed out is tagged for its person', () => assert.match(sid || '', /^[A-Za-z0-9_-]{8,128}\.[A-Za-z0-9_-]{43}$/));
    const other = new Client({ name: '5s-smoke-other', version: '1' });
    await other.connect(new StreamableHTTPClientTransport(new URL(w.base + '/mcp'), { requestInit: { headers: { 'x-5s-dev-user': 'other-dev' } } }));
    const otherState = await other.callTool({ name: 'get_state', arguments: {} });
    check('a second person has their own 5s', () => assert.equal(otherState.structuredContent.state.j.length, 0));
    const hijack = await fetch(w.base + '/mcp', { method: 'POST', headers: Object.assign({ 'mcp-session-id': sid, 'x-5s-dev-user': 'other-dev' }, MCP_HEADERS), body: toolsList });
    const untagged = await fetch(w.base + '/mcp', { method: 'POST', headers: Object.assign({ 'mcp-session-id': sid.split('.')[0] }, MCP_HEADERS), body: toolsList });
    const endIt = await fetch(w.base + '/mcp', { method: 'DELETE', headers: Object.assign({ 'mcp-session-id': sid, 'x-5s-dev-user': 'other-dev' }, MCP_HEADERS) });
    check('someone else\'s session id is "Session not found" (to use, to strip or to end)', () => {
      assert.equal(hijack.status, 404);
      assert.equal(untagged.status, 404);
      assert.equal(endIt.status, 404);
    });
    const still = await client.callTool({ name: 'get_taste', arguments: {} });
    check('and the session still works for its own person', () => assert.equal(still.structuredContent.judged, 5));
    const stranger = await fetch(w.base + '/mcp', { method: 'POST', headers: Object.assign({ 'x-5s-dev-user': 'not-listed' }, MCP_HEADERS), body: toolsList });
    check('the dev bypass only plays people listed in DEV_FAKE_USER', () => assert.equal(stranger.status, 403));

    // Connect your apps (SPEC): the fake web stands in for the internet under the dev bypass. (After the
    // checks above that count judgments: a thing brought in is a kept judgment.)
    const board = await client.callTool({ name: 'read_link', arguments: { url: 'https://www.pinterest.com/ada/slow-mornings/' } });
    console.log('      ' + board.content[0].text);
    check('read_link: a public Pinterest board, read through the guard: its pictures, nothing added yet', () => {
      assert.equal(board.isError, undefined, board.content[0].text);
      assert.equal(board.structuredContent.source, 'Pinterest');
      assert.ok(board.structuredContent.items.length >= 2);
      for (const it of board.structuredContent.items) assert.match(it.image, /^https:\/\/i\.pinimg\.com\//);
    });
    const page = await client.callTool({ name: 'read_link', arguments: { url: 'studio.example.com/work/bowl' } });
    check('read_link: a web page gives its preview picture (an address without https:// is read as https)', () => {
      assert.equal(page.isError, undefined, page.content[0].text);
      assert.equal(page.structuredContent.source, 'The web');
      assert.equal(page.structuredContent.items[0].image, 'https://img.example.com/bowl.jpg');
    });
    const brought = await client.callTool({ name: 'bring_in', arguments: { items: board.structuredContent.items.slice(0, 2) } });
    console.log('      ' + brought.content[0].text);
    const added = (brought.structuredContent && brought.structuredContent.added) || [];
    check('bring_in: two of them added, from Pinterest, with colours, surface and texture read inside workerd', () => {
      assert.equal(brought.isError, undefined, brought.content[0].text);
      assert.equal(added.length, 2);
      for (const a of added) {
        assert.match(a.id, /^y[a-z0-9]{5}$/);
        assert.equal(a.source, 'Pinterest');
        assert.equal(a.colours_pending, false);
        assert.equal(a.colours.length, 3);
        assert.equal(a.crop.length, 4);
        assert.equal(typeof a.texture, 'number');
      }
    });
    const after = (await client.callTool({ name: 'get_state', arguments: {} })).structuredContent.state;
    check('the state keeps them as their own saves, by address: no picture in it', () => {
      const own = after.own.filter((o) => added.some((a) => a.id === o.id));
      assert.equal(own.length, 2);
      for (const o of own) assert.match(o.image, /^https:\/\/i\.pinimg\.com\/736x\//);
      assert.ok(!JSON.stringify(after).includes('base64'));
    });
    const pic = await client.callTool({ name: 'item_image', arguments: { id: added[0].id } });
    check('item_image: the picture as an image block, and as a data: URL only in structuredContent', () => {
      assert.equal(pic.isError, undefined, pic.content[0].text);
      const img = pic.content.find((c) => c.type === 'image');
      assert.equal(img.mimeType, 'image/jpeg');
      assert.equal(pic.structuredContent.image, 'data:image/jpeg;base64,' + img.data);
      assert.ok(!pic.content.filter((c) => c.type === 'text').some((c) => c.text.includes('base64,')));
    });
    const inside = await client.callTool({ name: 'read_link', arguments: { url: 'https://short.example.com/to-metadata' } });
    check('read_link: a link that redirects to a private address (cloud metadata) is refused, with what to do instead', () => {
      assert.equal(inside.isError, true);
      assert.equal(inside.structuredContent.code, 'private');
      assert.ok(inside.structuredContent.resolution);
    });
    pictureSample = Buffer.from(pic.structuredContent.image.split(',')[1], 'base64').subarray(600, 680).toString('base64');
    await other.close();
    await client.close();

    // fetch() drops a Host header, so this goes through node:http, which sends it as given.
    const foreign = await new Promise((res, rej) => {
      const r = request({ host: '127.0.0.1', port: PORT, path: '/mcp', method: 'POST',
        headers: { Host: 'fives-connector.example.workers.dev', 'content-type': 'application/json', accept: 'application/json, text/event-stream' } }, (x) => {
        let body = ''; x.on('data', (d) => { body += d; }); x.on('end', () => res({ status: x.statusCode, body }));
      });
      r.on('error', rej);
      r.end('{}');
    });
    check('the bypass is refused for a host other than localhost (403)', () => {
      assert.equal(foreign.status, 403);
      assert.match(foreign.body, /refuses the dev bypass/);
    });
  } finally {
    await w.stop();
  }
  const state = join(DIR, 'bypass-state');
  check('local storage (KV, the session\'s Durable Object) never holds the GitHub token', () => {
    assert.ok(filesHolding(state, 'artist-dev').length > 0, 'the scan reads the stored data');
    assert.deepEqual(filesHolding(state, 'dev-fake-token'), []);
  });
  check('local storage keeps the brought pictures\' addresses, never the pictures', () => {
    assert.ok(filesHolding(state, 'https://i.pinimg.com/736x/ab/cd/ef/bowl.jpg').length > 0, 'the scan reads the stored state');
    assert.ok(pictureSample && pictureSample.length > 80);
    assert.deepEqual(filesHolding(state, pictureSample), [], 'no picture, as base64');
    assert.deepEqual(filesHolding(state, Buffer.from(pictureSample, 'base64')), [], 'no picture, as bytes');
  });
}

let pictureSample = null;

const COOKIE_KEY = randomBytes(32).toString('hex');

async function realSignIn() {
  console.log('2. real sign-in (no DEV_FAKE_USER) on :' + (PORT + 2));
  const w = startWorker('oauth', PORT + 2, {
    GITHUB_CLIENT_ID: 'Iv1.smoke-client-id', GITHUB_CLIENT_SECRET: 'not-a-real-secret',
    COOKIE_ENCRYPTION_KEY: COOKIE_KEY,
  });
  const B = w.base;
  try {
    await w.ready;
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } } };
    const noToken = await fetch(B + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(init) });
    const challenge = noToken.headers.get('www-authenticate') || '';
    console.log('      401 WWW-Authenticate: ' + challenge);
    check('/mcp without a token: 401 with a Bearer challenge naming the resource metadata', () => {
      assert.equal(noToken.status, 401);
      assert.match(challenge, /^Bearer /);
      assert.match(challenge, new RegExp('resource_metadata="' + B + '/\\.well-known/oauth-protected-resource/mcp"'));
    });
    const prm = await (await fetch(B + '/.well-known/oauth-protected-resource/mcp')).json();
    check('protected resource metadata names /mcp and this server as its authorization server', () => {
      assert.equal(prm.resource, B + '/mcp');
      assert.deepEqual(prm.authorization_servers, [B]);
    });
    const asm = await (await fetch(B + '/.well-known/oauth-authorization-server')).json();
    check('authorization server metadata: authorize, token, register, S256', () => {
      assert.equal(asm.issuer, B);
      assert.equal(asm.authorization_endpoint, B + '/authorize');
      assert.equal(asm.token_endpoint, B + '/token');
      assert.equal(asm.registration_endpoint, B + '/register');
      assert.ok(asm.code_challenge_methods_supported.includes('S256'));
    });

    const redirect = 'http://localhost:9876/callback';
    const reg = await fetch(B + '/register', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude (smoke)', redirect_uris: [redirect], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) });
    const client = await reg.json();
    check('dynamic client registration gives a client id', () => { assert.equal(reg.status, 201); assert.ok(client.client_id); });

    const verifier = randomBytes(32).toString('base64url');
    const challengeS256 = createHash('sha256').update(verifier).digest('base64url');
    const q = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: redirect, state: 'claude-state',
      code_challenge: challengeS256, code_challenge_method: 'S256', resource: B + '/mcp' });
    const page = await fetch(B + '/authorize?' + q, { redirect: 'manual' });
    const html = await page.text();
    const cookies = page.headers.getSetCookie().map((c) => c.split(';')[0]);
    const handle = (/name="handle" value="([^"]+)"/.exec(html) || [])[1];
    check('/authorize shows "Connect 5s": the client, where access goes, unframeable', () => {
      assert.equal(page.status, 200);
      assert.match(html, /<h1>Connect 5s<\/h1>/);
      assert.match(html, /Claude \(smoke\)/);
      assert.match(html, /This sends access to an app on this computer/);
      assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
      assert.ok(handle && cookies.length);
    });
    const approve = await fetch(B + '/authorize', { method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
      body: new URLSearchParams({ handle, decision: 'approve' }) });
    const to = new URL(approve.headers.get('location') || 'about:blank');
    console.log('      approve -> ' + to.origin + to.pathname + '?scope=' + to.searchParams.get('scope'));
    check('approving goes to GitHub\'s own sign-in page: read:user public_repo, PKCE, /callback', () => {
      assert.equal(approve.status, 302);
      assert.equal(to.origin + to.pathname, 'https://github.com/login/oauth/authorize');
      assert.equal(to.searchParams.get('client_id'), 'Iv1.smoke-client-id');
      assert.equal(to.searchParams.get('scope'), 'read:user public_repo');
      assert.equal(to.searchParams.get('redirect_uri'), B + '/callback');
      assert.equal(to.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(to.searchParams.get('state'));
      assert.ok(approve.headers.getSetCookie().some((c) => /^__Host-/.test(c)), 'the state is bound to this browser');
    });
    const second = await fetch(B + '/authorize?' + q, { redirect: 'manual' });
    const handle2 = (/name="handle" value="([^"]+)"/.exec(await second.text()) || [])[1];
    const crossSite = await fetch(B + '/authorize', { method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle: handle2, decision: 'approve' }) });
    check('approving from another site (the form without this browser\'s cookie) is refused', () => {
      assert.equal(crossSite.status, 400);
      assert.equal(crossSite.headers.get('location'), null);
    });
    const evil = new URLSearchParams(q);
    evil.set('redirect_uri', 'https://evil.example/callback');
    const badRedirect = await fetch(B + '/authorize?' + evil, { redirect: 'manual' });
    check('a redirect address the client did not register is refused, never followed', () => {
      assert.equal(badRedirect.status, 400);
      assert.equal(badRedirect.headers.get('location'), null);
    });
    const forged = await fetch(B + '/callback?code=x&state=' + encodeURIComponent(to.searchParams.get('state')), { redirect: 'manual' });
    check('a callback from another browser (no binding cookie) is refused, not redirected', () => {
      assert.equal(forged.status, 400);
      assert.equal(forged.headers.get('location'), null);
    });
    const home = await (await fetch(B + '/')).text();
    check('the home page says how to add the connector', () => assert.match(home, /Add custom connector/));
    const burst = [];
    for (let i = 0; i < 32; i++) {
      burst.push((await fetch(B + '/register', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_name: 'burst', redirect_uris: [redirect], token_endpoint_auth_method: 'none' }) })).status);
    }
    check('client registrations from one address are limited (429 within a minute)', () => assert.ok(burst.includes(429), burst.join(',')));
  } finally {
    await w.stop();
  }
  const state = join(DIR, 'oauth-state');
  check('local storage never holds the GitHub client secret or the cookie key', () => {
    assert.ok(filesHolding(state, 'Claude (smoke)').length > 0, 'the scan reads the stored data');
    assert.deepEqual(filesHolding(state, 'not-a-real-secret'), []);
    assert.deepEqual(filesHolding(state, COOKIE_KEY), []);
  });
}

try {
  await devBypass();
  await realSignIn();
  console.log('\nsmoke: ' + results.length + ' checks passed (logs in ' + DIR + ')');
} catch (e) {
  console.error('\nsmoke FAILED after ' + results.length + ' checks: ' + (e && e.stack ? e.stack : e));
  console.error('logs in ' + DIR);
  process.exit(1);
}

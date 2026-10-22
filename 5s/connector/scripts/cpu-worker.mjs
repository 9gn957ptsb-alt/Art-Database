#!/usr/bin/env node
// CPU of what runs in the Worker itself (README "What it costs: nothing"), where Workers Free allows
// 10 ms a request: everything else (every tool) runs in Durable Objects. Measured under Node with
// process.cpuUsage() (user + system, all threads), the median of 30 runs after 5 to warm up:
//
//   /mcp, a signed-in request    the OAuth provider checks the bearer token (a KV read, SHA-256,
//                                unwrapping the key, decrypting the props), then src/session.ts
//                                checks the session id's tag and tags the answer (two HMACs)
//   relaying an answer           the agents package's Worker side turns each message from the
//                                session's Durable Object into the event stream: JSON.parse and
//                                encode, here for item_image's answer (the biggest: ~370 KB)
//   /register, /authorize,       the sign-in steps the provider itself answers (a client's
//   /token, a refresh            registration, the grant, the code exchange, a refresh)
//
// The OAuth provider imports "cloudflare:workers"; under Node that name is given a stand-in here.
import { register } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'cloudflare:workers') return { url: 'data:text/javascript,' + encodeURIComponent('export class WorkerEntrypoint {} export class DurableObject {}'), shortCircuit: true };
  return next(spec, ctx);
}`));

const { OAuthProvider } = await import('@cloudflare/workers-oauth-provider');
const { serveBound } = await import('../src/session.ts');
const { TOKEN_LIFETIMES } = await import('../src/costs.js');

function memoryKv() {
  const m = new Map();
  return {
    m,
    async get(k, o) { const v = m.has(k) ? m.get(k) : null; if (v == null) return null; const t = typeof o === 'string' ? o : o && o.type; return t === 'json' ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list(o) { const p = (o && o.prefix) || ''; return { keys: [...m.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
  };
}

const ORIGIN = 'https://fives-connector.example.workers.dev';
const env = { OAUTH_KV: memoryKv(), COOKIE_ENCRYPTION_KEY: randomBytes(32).toString('hex') };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const SID = 'a'.repeat(64);
const inner = { async fetch() { return new Response('event: message\ndata: {}\n\n', { headers: { 'content-type': 'text/event-stream', 'mcp-session-id': SID } }); } };
const apiHandler = { async fetch(req, e, c) { return serveBound(inner, req, e, c, c.props.id); } };
const defaultHandler = {
  async fetch(req, e) {
    const u = new URL(req.url);
    if (u.pathname === '/authorize') {
      const ar = await e.OAUTH_PROVIDER.parseAuthRequest(req);
      const { redirectTo } = await e.OAUTH_PROVIDER.completeAuthorization({ request: ar, userId: '4242', metadata: {}, scope: ar.scope, props: { id: '4242', login: 'ada', accessToken: 'gho_' + 'x'.repeat(36), scopes: ['read:user', 'public_repo'] } });
      return Response.redirect(redirectTo, 302);
    }
    return new Response('not here', { status: 404 });
  },
};
const provider = new OAuthProvider({
  apiRoute: '/mcp', apiHandler, defaultHandler, authorizeEndpoint: '/authorize', tokenEndpoint: '/token', clientRegistrationEndpoint: '/register',
  resourceMetadata: { resource: ORIGIN + '/mcp', authorization_servers: [ORIGIN], bearer_methods_supported: ['header'], resource_name: '5s' },
  ...TOKEN_LIFETIMES,
});
const go = (path, init) => provider.fetch(new Request(ORIGIN + path, init), env, ctx);

const redirect = 'https://claude.ai/api/mcp/auth_callback';
async function register5s() {
  const r = await go('/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: [redirect], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) });
  return (await r.json()).client_id;
}
async function signIn(clientId) {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const q = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirect, state: 's', code_challenge: challenge, code_challenge_method: 'S256', resource: ORIGIN + '/mcp' });
  const a = await go('/authorize?' + q, { redirect: 'manual' });
  const code = new URL(a.headers.get('location')).searchParams.get('code');
  return { code, verifier };
}
async function exchange(clientId, s) {
  const t = await go('/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: s.code, redirect_uri: redirect, client_id: clientId, code_verifier: s.verifier, resource: ORIGIN + '/mcp' }) });
  return t.json();
}

async function cpu(fn) {
  const t0 = process.cpuUsage();
  await fn();
  const d = process.cpuUsage(t0);
  return (d.user + d.system) / 1000;
}
async function median(name, fn, setup) {
  const xs = [];
  for (let i = 0; i < 35; i++) {
    const arg = setup ? await setup() : undefined;
    const ms = await cpu(() => fn(arg));
    if (i >= 5) xs.push(ms);
  }
  xs.sort((a, b) => a - b);
  return { path: name, median_ms: +xs[15].toFixed(2), max_ms: +xs[xs.length - 1].toFixed(2) };
}

export async function measureWorker() {
  const clientId = await register5s();
  const tok = await exchange(clientId, await signIn(clientId));
  if (!tok.access_token) throw new Error('no token: ' + JSON.stringify(tok));
  const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_taste', arguments: {} } });
  const mcpHeaders = { authorization: 'Bearer ' + tok.access_token, 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  const first = await go('/mcp', { method: 'POST', headers: mcpHeaders, body: init });
  const sid = first.headers.get('mcp-session-id');
  if (first.status !== 200 || !sid) throw new Error('/mcp did not answer: ' + first.status + ' ' + (await first.text()));
  // item_image's answer as the session's object sends it over its WebSocket: ~180 KB of picture twice
  // (structuredContent and the image block), wrapped in the agents package's event frame.
  const b64 = randomBytes(135000).toString('base64');
  const result = { jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: 'The picture of yk2q7a…' }, { type: 'text', text: '{"image":"(a data: URL)"}' }, { type: 'image', data: b64, mimeType: 'image/jpeg' }], structuredContent: { ok: true, image: 'data:image/jpeg;base64,' + b64 } } };
  const frame = JSON.stringify({ type: 'cf_mcp_agent_event', event: 'event: message\ndata: ' + JSON.stringify(result) + '\n\n', close: true });
  const enc = new TextEncoder();
  let refresh = tok.refresh_token;
  const rows = [];
  rows.push(await median('/mcp: token check + session tag (a tool call)', async () => {
    const r = await go('/mcp', { method: 'POST', headers: Object.assign({ 'mcp-session-id': sid }, mcpHeaders), body: init });
    await r.text();
  }));
  rows.push(await median('relay item_image\'s answer (~370 KB)', async () => {
    const m = JSON.parse(frame);
    enc.encode(m.event);
  }));
  rows.push(await median('/token (refresh)', async () => {
    const r = await go('/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId }) });
    const j = await r.json();
    if (!j.refresh_token) throw new Error('refresh failed ' + JSON.stringify(j));
    refresh = j.refresh_token;
  }));
  rows.push(await median('/register (a new client)', async () => { await register5s(); }));
  rows.push(await median('/authorize (the grant)', async () => { await signIn(clientId); }));
  rows.push(await median('/token (code exchange)', (s) => exchange(clientId, s), () => signIn(clientId)));
  rows.push(await median('/mcp: no token (401 with the discovery)', async () => {
    const r = await go('/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: init });
    await r.text();
  }));
  return { rows, tokens: { expires_in: tok.expires_in }, kvKeys: [...env.OAUTH_KV.m.keys()].length };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const r = await measureWorker();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log('Worker-side CPU (Node ' + process.version + '), median of 30 after 5 to warm up; access token lasts ' + r.tokens.expires_in + ' s');
    for (const x of r.rows) console.log(x.path.padEnd(48) + String(x.median_ms).padStart(8) + ' ms   (max ' + x.max_ms + ')');
  }
}

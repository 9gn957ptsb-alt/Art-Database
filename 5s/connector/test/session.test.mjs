// Session binding (src/session.ts, loaded by Node's own TypeScript type stripping): an MCP session id
// works only for the person who opened it, and clients can't send the agents package's internal headers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionKey, bindSession, unbindSession, isInternalHeader, serveBound } from '../src/session.ts';

const SECRET = 'a'.repeat(64);
const RAW = 'f'.repeat(64); // a Durable Object id, as McpAgent makes them

test('a session id is tagged for the person who opened it, and only works for them', async () => {
  const key = await sessionKey(SECRET);
  const sid = await bindSession(key, '4242', RAW);
  assert.match(sid, /^f{64}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(await unbindSession(key, '4242', sid), RAW);
  assert.equal(await unbindSession(key, '7777', sid), null, 'another person cannot use it');
  // The tag can't be moved to another session, cut off, or forged without the secret.
  assert.equal(await unbindSession(key, '4242', 'e'.repeat(64) + sid.slice(64)), null);
  assert.equal(await unbindSession(key, '4242', RAW), null);
  assert.equal(await unbindSession(key, '4242', RAW + '.'), null);
  assert.equal(await unbindSession(key, '4242', sid.slice(0, -1) + (sid.endsWith('A') ? 'B' : 'A')), null, 'only the canonical spelling');
  const mid = 64 + 20;
  assert.equal(await unbindSession(key, '4242', sid.slice(0, mid) + (sid[mid] === 'x' ? 'y' : 'x') + sid.slice(mid + 1)), null);
  const other = await sessionKey('b'.repeat(64));
  assert.equal(await unbindSession(other, '4242', sid), null, 'a tag from another deployment does not work');
  assert.equal(await unbindSession(key, '4242', null), null);
});

test('no key without a COOKIE_ENCRYPTION_KEY of at least 32 characters', async () => {
  assert.equal(await sessionKey(undefined), null);
  assert.equal(await sessionKey('short'), null);
  assert.ok(await sessionKey('x'.repeat(32)));
});

test('the agents package\'s internal headers are recognised', () => {
  for (const h of ['x-agents-lifecycle-props', 'X-Agents-Lifecycle-Props', 'cf-mcp-message', 'cf-mcp-method', 'x-cf-agents-subagent-url', 'x-partykit-props']) assert.ok(isInternalHeader(h), h);
  for (const h of ['mcp-session-id', 'authorization', 'accept', 'content-type', 'mcp-protocol-version']) assert.ok(!isInternalHeader(h), h);
});

function fakeInner() {
  const seen = [];
  return {
    seen,
    async fetch(req) {
      seen.push({ sid: req.headers.get('mcp-session-id'), headers: [...req.headers.keys()], body: await req.text() });
      return new Response('event: message\n\n', { status: 200, headers: { 'content-type': 'text/event-stream', 'mcp-session-id': RAW } });
    },
  };
}
const env = { COOKIE_ENCRYPTION_KEY: SECRET };
const post = (headers) => new Request('https://fives.example.workers.dev/mcp', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' });

test('serveBound: the reply carries a tagged id; the next request reaches the session with the agent\'s own id', async () => {
  const inner = fakeInner();
  const first = await serveBound(inner, post({}), env, {}, '4242');
  const sid = first.headers.get('mcp-session-id');
  assert.notEqual(sid, RAW);
  assert.equal(await unbindSession(await sessionKey(SECRET), '4242', sid), RAW);
  assert.equal(await first.text(), 'event: message\n\n', 'the body streams through unchanged');
  await serveBound(inner, post({ 'mcp-session-id': sid }), env, {}, '4242');
  assert.equal(inner.seen[1].sid, RAW);
  assert.match(inner.seen[1].body, /tools\/list/);
});

test('serveBound: someone else\'s session id gets "Session not found" and never reaches the session', async () => {
  const inner = fakeInner();
  const sid = (await serveBound(inner, post({}), env, {}, '4242')).headers.get('mcp-session-id');
  for (const [who, id] of [['7777', sid], ['7777', RAW], ['4242', RAW], ['4242', 'garbage']]) {
    const r = await serveBound(inner, post({ 'mcp-session-id': id }), env, {}, who);
    assert.equal(r.status, 404, who + ' ' + id);
    assert.equal((await r.json()).error.message, 'Session not found');
  }
  const del = await serveBound(inner, new Request('https://fives.example.workers.dev/mcp', { method: 'DELETE', headers: { 'mcp-session-id': sid } }), env, {}, '7777');
  assert.equal(del.status, 404, 'nor can they end it');
  assert.equal(inner.seen.length, 1);
});

test('serveBound: internal headers a client sends are dropped', async () => {
  const inner = fakeInner();
  await serveBound(inner, post({ 'x-agents-lifecycle-props': btoa('{"id":"1","login":"evil","accessToken":"t"}'), 'cf-mcp-message': 'e30=', 'x-partykit-room': 'r' }), env, {}, '4242');
  assert.deepEqual(inner.seen[0].headers.filter((h) => /^(x-agents|cf-mcp|x-partykit)/.test(h)), []);
});

test('serveBound: without a usable secret, 503 and nothing reaches a session', async () => {
  const inner = fakeInner();
  const r = await serveBound(inner, post({}), { COOKIE_ENCRYPTION_KEY: 'short' }, {}, '4242');
  assert.equal(r.status, 503);
  assert.equal(inner.seen.length, 0);
});

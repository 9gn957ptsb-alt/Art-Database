// The sign-in helpers (src/utils.ts, loaded by Node's own TypeScript type stripping): the address
// of GitHub's sign-in page, the code exchange and "who signed in", against fakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GITHUB_SCOPES, getUpstreamAuthorizeUrl, fetchUpstreamAuthToken, githubUser, githubFetch, s256 } from '../src/utils.ts';

test('the scopes are read:user and public_repo, nothing more', () => {
  assert.deepEqual(GITHUB_SCOPES, ['read:user', 'public_repo']);
});

test('GitHub\'s sign-in page address: scopes, state, PKCE and sign-up allowed', async () => {
  const u = new URL(getUpstreamAuthorizeUrl({
    upstream_url: 'https://github.com/login/oauth/authorize', client_id: 'Iv1.abc', scope: GITHUB_SCOPES.join(' '),
    redirect_uri: 'https://fives-connector.example.workers.dev/callback', state: 'st8', code_challenge: await s256('verifier'),
  }));
  assert.equal(u.origin + u.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(u.searchParams.get('scope'), 'read:user public_repo');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://fives-connector.example.workers.dev/callback');
  assert.equal(u.searchParams.get('state'), 'st8');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('allow_signup'), 'true');
  // RFC 7636 appendix B's example verifier and challenge.
  assert.equal(await s256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('the code exchange sends the verifier and reads the token and granted scopes', async (t) => {
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    seen.push({ url: String(url), body: new URLSearchParams(init.body), headers: init.headers });
    return Response.json({ access_token: 'gho_new', scope: 'public_repo,read:user', token_type: 'bearer' });
  });
  const [token, scopes, err] = await fetchUpstreamAuthToken({
    upstream_url: 'https://github.com/login/oauth/access_token', client_id: 'id', client_secret: 'secret',
    code: 'c0de', redirect_uri: 'https://x.example/callback', code_verifier: 'v',
  });
  assert.equal(err, null);
  assert.equal(token, 'gho_new');
  assert.deepEqual(scopes.sort(), ['public_repo', 'read:user']);
  assert.equal(seen[0].body.get('code'), 'c0de');
  assert.equal(seen[0].body.get('code_verifier'), 'v');
  assert.equal(seen[0].headers.Accept, 'application/json');
});

test('the code exchange fails plainly: no code, GitHub refusing, no token', async (t) => {
  const none = await fetchUpstreamAuthToken({ upstream_url: 'https://github.com/x', client_id: 'a', client_secret: 'b', code: null, redirect_uri: 'https://x' });
  assert.equal(none[2].status, 400);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'bad_verification_code' }));
  const bad = await fetchUpstreamAuthToken({ upstream_url: 'https://github.com/x', client_id: 'a', client_secret: 'b', code: 'c', redirect_uri: 'https://x' });
  assert.equal(bad[0], null);
  assert.equal(bad[2].status, 400);
  assert.ok(!(await bad[2].text()).includes('bad_verification_code'), 'GitHub\'s words stay in the log');
});

test('who signed in: the numeric id and the login, with a User-Agent GitHub requires', async () => {
  let sent;
  const u = await githubUser('gho_x', async (url, init) => { sent = { url, headers: new Headers(init.headers) }; return Response.json({ id: 4242, login: 'ada', email: 'never@stored' }); });
  assert.deepEqual(u, { id: 4242, login: 'ada' }, 'nothing else is kept');
  assert.equal(sent.url, 'https://api.github.com/user');
  assert.equal(sent.headers.get('authorization'), 'Bearer gho_x');
  await assert.rejects(githubUser('bad', async () => new Response('{}', { status: 401 })));
});

test('every GitHub call from the Worker carries a User-Agent', async (t) => {
  let headers;
  t.mock.method(globalThis, 'fetch', async (url, init) => { headers = new Headers(init.headers); return new Response('{}'); });
  await githubFetch('https://api.github.com/user', { headers: { Authorization: 'Bearer x' } });
  assert.equal(headers.get('user-agent'), '5s-connector');
  assert.equal(headers.get('authorization'), 'Bearer x');
});

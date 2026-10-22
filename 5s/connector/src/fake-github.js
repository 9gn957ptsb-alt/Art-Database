/* A fake api.github.com, for tests and for `wrangler dev` with DEV_FAKE_USER. It answers the calls
 * the hub driver (5s/src/hub.js, FiveSHub.api) and the sign-in make, the way GitHub does (status codes, 404 for what you can't see, sha checks on
 * save), and records every request in `calls` so tests can assert exactly what would have been sent.
 *
 *   const gh = createFakeGitHub({ users: [{ token: 't', id: 7, login: 'ada' }] });
 *   const client = FiveSHub.api('t', gh.fetch, { base: gh.base });
 */
import FiveSHub from './hub.js';

const toBase64 = FiveSHub.utf8ToBase64;
const fromBase64 = FiveSHub.base64ToUtf8;

const BASE = 'https://api.github.test';

function hashHex(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const json = (status, body, headers) => new Response(body == null ? null : JSON.stringify(body), {
  status, headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
});
const notFound = () => json(404, { message: 'Not Found' });

/**
 * createFakeGitHub({users, repos?, pagesNeedRepoScope?, emptyReads?}) ->
 *   {fetch, base, calls, repos, snapshot(), restore(obj)}
 * users: [{token, id, login, name?, scopes?}] (scopes default ["read:user", "public_repo"]).
 * pagesNeedRepoScope: refuse POST …/pages unless the token has "repo" (GitHub's documented rule
 *   for classic tokens), to exercise the "one tap in Settings → Pages" path.
 * emptyReads: how many contents calls right after a repository is made answer 409 "Git Repository
 *   is empty." (GitHub's first commit can take a moment), to exercise the retry.
 */
export function createFakeGitHub(opts) {
  const o = opts || {};
  const users = (o.users || []).map((u) => Object.assign({}, u, { scopes: u.scopes || ['read:user', 'public_repo'], name: u.name || null }));
  let repos = {}; // "owner/name" (lower case) -> {id, owner, name, private, branch, files: {path: {text, sha}}, pages, description}
  let nextId = 1000;
  let commits = 0;
  let emptyLeft = 0;
  const calls = [];

  const key = (owner, name) => (owner + '/' + name).toLowerCase();
  const userOf = (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
    return m ? users.find((u) => u.token === m[1]) || null : null;
  };
  const visible = (repo, u) => repo && (!repo.private || (u && u.login.toLowerCase() === repo.owner.toLowerCase()));
  const repoJson = (r) => ({
    id: r.id, name: r.name, full_name: r.owner + '/' + r.name, owner: { login: r.owner }, private: r.private, fork: false,
    default_branch: r.branch, html_url: 'https://github.com/' + r.owner + '/' + r.name, description: r.description || null,
  });

  for (const r of o.repos || []) {
    repos[key(r.owner, r.name)] = Object.assign({ id: nextId++, private: false, branch: 'main', files: {}, pages: null }, r, {
      files: Object.fromEntries(Object.entries(r.files || {}).map(([p, text]) => [p, { text, sha: hashHex(p + '|' + text + '|seed') }])),
    });
  }

  async function handle(req) {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const path = decodeURIComponent(url.pathname);
    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      const t = await req.text();
      try { body = t ? JSON.parse(t) : null; } catch { body = t; }
    }
    const record = { method, path, body: body && typeof body === 'object' && body.content ? Object.assign({}, body, { text: fromBase64(body.content) }) : body };
    calls.push(record);

    const u = userOf(req);
    if (!u) return json(401, { message: 'Bad credentials' });

    if (method === 'GET' && path === '/user') {
      return json(200, { id: u.id, login: u.login, name: u.name }, { 'x-oauth-scopes': u.scopes.join(', ') });
    }

    if (method === 'POST' && path === '/user/repos') {
      const name = body && body.name;
      if (typeof name !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(name) || name === '.' || name === '..') {
        return json(422, { message: 'Repository creation failed.', errors: [{ resource: 'Repository', code: 'custom', field: 'name', message: 'name is invalid' }] });
      }
      if (body.private && u.scopes.indexOf('repo') < 0) return json(403, { message: 'Resource not accessible by integration' });
      if (repos[key(u.login, name)]) {
        return json(422, { message: 'Repository creation failed.', errors: [{ resource: 'Repository', code: 'custom', field: 'name', message: 'name already exists on this account' }] });
      }
      const r = { id: nextId++, owner: u.login, name, private: !!body.private, branch: 'main', files: {}, pages: null, description: body.description || null };
      if (body.auto_init) { commits++; r.files['README.md'] = { text: '# ' + name + '\n', sha: hashHex('README.md|' + name + '|' + commits) }; }
      repos[key(u.login, name)] = r;
      emptyLeft = o.emptyReads || 0;
      return json(201, repoJson(r));
    }

    let m = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(path);
    if (!m) return notFound();
    const repo = repos[key(m[1], m[2])];
    const rest = m[3] || '';
    if (!visible(repo, u)) return notFound();
    const isOwner = u.login.toLowerCase() === repo.owner.toLowerCase();

    if (method === 'GET' && rest === '') return json(200, repoJson(repo));

    if ((m = /^\/contents\/(.+)$/.exec(rest))) {
      const p = m[1];
      if (emptyLeft > 0) { emptyLeft--; return json(409, { message: 'Git Repository is empty.' }); }
      if (method === 'GET') {
        const f = repo.files[p];
        if (!f) return notFound();
        return json(200, { type: 'file', path: p, sha: f.sha, size: f.text.length, encoding: 'base64', content: toBase64(f.text).replace(/.{60}/g, '$&\n') });
      }
      if (method === 'PUT') {
        if (!isOwner) return notFound();
        if (repo.private && u.scopes.indexOf('repo') < 0) return notFound();
        if (!body || typeof body.content !== 'string' || typeof body.message !== 'string') return json(422, { message: 'Invalid request.' });
        const f = repo.files[p];
        if (f && !body.sha) return json(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
        if (f && body.sha !== f.sha) return json(409, { message: p + ' does not match ' + body.sha });
        commits++;
        const text = fromBase64(body.content);
        const sha = hashHex(p + '|' + text + '|' + commits);
        repo.files[p] = { text, sha };
        return json(f ? 200 : 201, { content: { path: p, sha }, commit: { sha: hashHex('commit|' + commits) } });
      }
      return json(405, { message: 'Method not allowed' });
    }

    if (rest === '/pages') {
      const site = repo.name.toLowerCase() === repo.owner.toLowerCase() + '.github.io';
      const address = 'https://' + repo.owner.toLowerCase() + '.github.io/' + (site ? '' : repo.name + '/');
      if (method === 'GET') return repo.pages ? json(200, { html_url: address, status: 'built', source: repo.pages }) : notFound();
      if (method === 'POST') {
        if (!isOwner) return notFound();
        if (repo.pages) return json(409, { message: 'GitHub Pages is already enabled.' });
        if (o.pagesNeedRepoScope && u.scopes.indexOf('repo') < 0) return json(403, { message: 'Resource not accessible by integration' });
        repo.pages = (body && body.source) || { branch: repo.branch, path: '/' };
        return json(201, { html_url: address, status: null, source: repo.pages });
      }
    }
    return notFound();
  }

  return {
    base: BASE,
    calls,
    get repos() { return repos; },
    fetch: (input, init) => handle(input instanceof Request ? input : new Request(input, init)),
    /** What the fake knows, as plain JSON (dev mode keeps it in KV between requests). */
    snapshot: () => JSON.parse(JSON.stringify({ repos, nextId, commits })),
    restore(s) {
      if (!s || typeof s !== 'object') return;
      repos = s.repos || {};
      nextId = s.nextId || nextId;
      commits = s.commits || 0;
    },
    /** Paths written (PUT) so far, as "owner/name:path". */
    writes: () => calls.filter((c) => c.method === 'PUT').map((c) => c.path.replace(/^\/repos\//, '').replace('/contents/', ':')),
  };
}

/* 5s hub drivers: the person's own GitHub repository ("your hub") and its website, made from inside
 * 5s (SPEC.md "Your hub"). Plain browser JS, no dependencies: window.FiveSHub in the browser,
 * module.exports in Node (the tests drive it against a fake GitHub).
 *
 * Words. 5s calls a repository "your hub", a commit "save" and GitHub Pages "your hub's address".
 * Every message in here may be shown to the person, so the messages use those words and never
 * GitHub's (no repository, commit, branch, pull request or settings).
 *
 * Three parts:
 *   rules, suggest, links, isSiteRepo   pure. The links bridge works everywhere, including the
 *                                       claude.ai artifact, whose frame cannot call GitHub: 5s opens
 *                                       GitHub's own pages already filled in.
 *   api(token, fetchImpl, opts)         the one-button driver for the standalone 5s app, through
 *                                       api.github.com (which sends CORS headers, so a page can call
 *                                       it directly with a token). Unused in the artifact.
 *   deviceFlow({...})                   sign-in with no secret in the app: 5s shows a short code, the
 *                                       person approves it at github.com/login/device, 5s gets a token.
 *
 * CORS and the device flow (read before wiring sign-in into a web build):
 *   github.com/login/device/code and github.com/login/oauth/access_token send no CORS headers, so a
 *   web page cannot call them itself. deviceFlow takes `endpoint`, a base URL standing in for
 *   https://github.com: point it at a small pass-through proxy that forwards exactly those two POST
 *   paths to github.com and adds Access-Control-Allow-Origin. The proxy holds no secret (the device
 *   flow needs only the public client id) and stores nothing. A native or desktop build, or Node,
 *   uses the default endpoint directly. The requests are "simple" (a form-encoded body and
 *   Accept: application/json), so browsers send no preflight. A whole proxy, as a Cloudflare Worker:
 *
 *     const ORIGIN = 'https://your-5s-app.example';            // the 5s app's own origin
 *     const PATHS = ['/login/device/code', '/login/oauth/access_token'];
 *     export default {
 *       async fetch(req) {
 *         const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
 *                        'Access-Control-Allow-Headers': 'Accept, Content-Type' };
 *         if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
 *         const path = new URL(req.url).pathname;
 *         if (req.method !== 'POST' || !PATHS.includes(path)) return new Response('Not found', { status: 404, headers: cors });
 *         const r = await fetch('https://github.com' + path, { method: 'POST', body: await req.text(),
 *           headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' } });
 *         return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
 *       },
 *     };
 *
 *   The client id is a GitHub App's (device flow turned on; repository permissions Administration,
 *   Contents and Pages: read and write) or an OAuth App's (scope "public_repo", or "repo" for a
 *   private hub). Neither needs a client secret for the device flow.
 */
(function (root) {
  'use strict';

  const API = 'https://api.github.com';
  const WEB = 'https://github.com';
  const API_VERSION = '2022-11-28';
  const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

  // ---------------------------------------------------------------- errors

  // Every failure is an Error carrying {code, status, message} (enumerable, so it can be spread or
  // stored), plus GitHub's own words in `detail` for logs. `message` is plain and safe to show.
  function hubError(code, status, message, detail) {
    const e = new Error(message);
    Object.defineProperties(e, {
      name: { value: 'HubError', enumerable: false, writable: true, configurable: true },
      code: { value: code, enumerable: true, writable: true, configurable: true },
      status: { value: status, enumerable: true, writable: true, configurable: true },
      message: { value: message, enumerable: true, writable: true, configurable: true },
    });
    if (detail) e.detail = String(detail).slice(0, 500);
    return e;
  }

  const MSG = Object.freeze({
    offline: "5s couldn't reach GitHub. Check your connection and try again.",
    'signed-out': "GitHub didn't accept your sign-in. Sign in again.",
    'not-allowed': "GitHub didn't let 5s do that. Sign in again and allow 5s to make and save your hub.",
    busy: 'GitHub asked 5s to slow down. Try again in a few minutes.',
    'not-found': "GitHub couldn't find your hub. Check your username and your hub's name.",
    conflict: 'Your hub changed while 5s was saving. Try again.',
    exists: 'You already have a hub with that name. Pick another name, or use that one.',
    plan: "A private hub can't have an address on a free GitHub account. Make your hub public to give it an address.",
    invalid: "GitHub didn't accept that. A hub's name has only letters, numbers, hyphens, underscores and full stops.",
    'github-down': 'GitHub is having trouble right now. Try again in a minute.',
    failed: 'Something went wrong talking to GitHub. Try again.',
    setup: "Sign-in with GitHub isn't set up in this 5s yet.",
    expired: 'The code ran out of time. Start again for a new code.',
    denied: 'Sign-in was turned down on GitHub. Start again if that was a mistake.',
    cancelled: 'Sign-in stopped.',
  });

  function header(headers, name) {
    if (!headers) return null;
    if (typeof headers.get === 'function') return headers.get(name);
    const k = Object.keys(headers).find((x) => x.toLowerCase() === name.toLowerCase());
    return k ? headers[k] : null;
  }

  // An HTTP failure from api.github.com, in plain words.
  function statusError(status, data, headers) {
    const gh = data && typeof data === 'object' ? String(data.message || '') : String(data || '');
    const errs = data && typeof data === 'object' && Array.isArray(data.errors)
      ? data.errors.map((x) => (x && typeof x === 'object' ? x.message || x.code || '' : String(x))).join('; ') : '';
    const detail = (gh + (errs ? ' (' + errs + ')' : '')).trim();
    const words = detail.toLowerCase();
    let code;
    if (status === 401) code = 'signed-out';
    else if (status === 403) code = header(headers, 'x-ratelimit-remaining') === '0' || /rate limit/.test(words) ? 'busy' : 'not-allowed';
    else if (status === 404) code = 'not-found';
    else if (status === 409) code = 'conflict';
    else if (status === 422) code = /already exists/.test(words) ? 'exists' : /plan|not support|upgrade/.test(words) ? 'plan' : 'invalid';
    else if (status === 429) code = 'busy';
    else if (status >= 500) code = 'github-down';
    else code = 'failed';
    return hubError(code, status, MSG[code], detail || null);
  }

  // ---------------------------------------------------------------- rules (GitHub's naming rules)

  const USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
  const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
  const USER_MAX = 39;
  const REPO_MAX = 100;
  const toText = (x) => (typeof x === 'string' ? x : x == null ? '' : String(x));
  const unaccent = (s) => (typeof s.normalize === 'function' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s);
  const PROFILE_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/+([^/?#\s]*)/i;

  function fixUser(raw) {
    let t = toText(raw).trim();
    const m = t.match(PROFILE_URL);
    if (m) t = m[1];
    t = unaccent(t).replace(/^@+/, '').replace(/[\s_.]+/g, '-').replace(/[^A-Za-z0-9-]+/g, '')
      .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    return t.slice(0, USER_MAX).replace(/-+$/, '');
  }

  /** rules.user(name) -> {ok, fixed, reason}. GitHub usernames: letters, digits and single hyphens,
   *  not starting or ending with a hyphen, 1–39 characters. `ok` judges the name once trimmed;
   *  `fixed` is what to use (trimmed, and repaired when it can be: "@ada" -> "ada", "José Luis" ->
   *  "Jose-Luis", a pasted github.com/ada -> "ada"); `reason` is '' when ok, else one plain line. */
  function checkUser(name) {
    const t = toText(name).trim();
    const fixed = fixUser(t);
    if (!t) return { ok: false, fixed: '', reason: 'Type your GitHub username.' };
    if (USER_RE.test(t)) return { ok: true, fixed: t, reason: '' };
    let reason;
    if (PROFILE_URL.test(t)) reason = 'Just the username, without the address.';
    else if (t.charAt(0) === '@') reason = 'Leave out the @.';
    else if (/[^A-Za-z0-9-]/.test(t)) reason = 'A GitHub username has only letters, numbers and single hyphens.';
    else if (t.length > USER_MAX) reason = 'A GitHub username is at most 39 characters.';
    else if (/^-|-$/.test(t)) reason = "A GitHub username can't start or end with a hyphen.";
    else reason = 'Only single hyphens: no two in a row.';
    return { ok: false, fixed, reason };
  }

  function fixRepo(raw) {
    const t = unaccent(toText(raw).trim());
    if (REPO_RE.test(t)) return t === '.' || t === '..' ? '' : t;
    let f = t.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, REPO_MAX);
    if (f === '.' || f === '..') f = '';
    return f;
  }

  /** rules.repo(name) -> {ok, fixed, reason}. A hub's name (GitHub's repository rules): letters,
   *  digits, '-', '_' and '.', 1–100 characters, not '.' or '..'. Spaces become '-' in `fixed`
   *  ("My hub" -> "My-hub"), as do other characters GitHub refuses. */
  function checkRepo(name) {
    const t = toText(name).trim();
    const fixed = fixRepo(t);
    if (!t) return { ok: false, fixed: '', reason: 'Give your hub a name.' };
    if (t === '.' || t === '..') return { ok: false, fixed: '', reason: "A hub can't be called just dots." };
    if (REPO_RE.test(t)) return { ok: true, fixed: t, reason: '' };
    let reason;
    if (/[^A-Za-z0-9._-]/.test(t)) reason = /\s/.test(t) && !/[^A-Za-z0-9._\s-]/.test(t)
      ? 'No spaces in a hub’s name: they become hyphens.'
      : 'A hub’s name has only letters, numbers, hyphens, underscores and full stops.';
    else reason = 'A hub’s name is at most 100 characters.';
    return { ok: false, fixed, reason };
  }

  const rules = Object.freeze({ user: checkUser, repo: checkRepo });

  /** suggest(user) -> {site: user + '.github.io', plain: '5s-hub'}: the two names step 2 offers.
   *  `site` is '' when there is no usable username yet. */
  function suggest(user) {
    const u = checkUser(user).fixed;
    return { site: u ? u + '.github.io' : '', plain: '5s-hub' };
  }

  /** isSiteRepo(user, repo) -> true when the hub is named <user>.github.io (any case): GitHub then
   *  publishes it at https://<user>.github.io/ by itself. */
  function isSiteRepo(user, repo) {
    const u = toText(user).trim(), r = toText(repo).trim();
    return !!u && r.toLowerCase() === u.toLowerCase() + '.github.io';
  }

  // ---------------------------------------------------------------- links (the bridge)

  const seg = (s) => encodeURIComponent(toText(s).trim());

  const links = Object.freeze({
    /** The sign-up page. */
    signup: () => WEB + '/signup',
    /** The sign-in page. */
    login: () => WEB + '/login',
    /** Where the person approves a device-flow code. */
    device: () => WEB + '/login/device',
    /** GitHub's "new repository" page, filled in: name, description (when given), visibility. */
    newRepo(o) {
      const x = o || {};
      const q = [];
      if (toText(x.name).trim()) q.push('name=' + seg(x.name));
      if (toText(x.description).trim()) q.push('description=' + seg(x.description));
      q.push('visibility=' + (x.private ? 'private' : 'public'));
      return WEB + '/new?' + q.join('&');
    },
    /** The hub itself on GitHub. */
    repo: (user, repo) => WEB + '/' + seg(user) + '/' + seg(repo),
    /** The "drag files here" page of the hub (branch main unless given). */
    upload: (user, repo, branch) => WEB + '/' + seg(user) + '/' + seg(repo) + '/upload/' + seg(branch || 'main'),
    /** The hub's address: https://<user>.github.io/ for a <user>.github.io hub, else .../<repo>/
     *  ('' while there is no username). */
    site(user, repo) {
      if (!toText(user).trim()) return '';
      const host = 'https://' + toText(user).trim().toLowerCase() + '.github.io/';
      return !toText(repo).trim() || isSiteRepo(user, repo) ? host : host + seg(repo) + '/';
    },
    /** The page where the hub's address is turned on (only needed for a hub not named <user>.github.io). */
    pagesSettings: (user, repo) => WEB + '/' + seg(user) + '/' + seg(repo) + '/settings/pages',
  });

  // ---------------------------------------------------------------- base64 of UTF-8 text

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(toText(text));
    if (typeof btoa !== 'function') return Buffer.from(bytes).toString('base64');
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const clean = toText(b64).replace(/\s+/g, '');
    if (typeof atob !== 'function') return Buffer.from(clean, 'base64').toString('utf8');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---------------------------------------------------------------- api (the one-button driver)

  const defaultFetch = () => (typeof fetch === 'function' ? fetch.bind(root) : null);
  const defaultSleep = (ms) => new Promise((res) => setTimeout(res, ms));

  function filePath(path) {
    const p = toText(path).replace(/^\/+/, '');
    const parts = p.split('/');
    if (!p || parts.some((x) => !x || x === '.' || x === '..')) throw hubError('invalid', 0, 'That file name won’t work in a hub.');
    return parts.map(encodeURIComponent).join('/');
  }

  /** api(token, fetchImpl, opts) -> the driver. opts: {base: 'https://api.github.com', sleep(ms)}.
   *  Every call sends Accept: application/vnd.github+json, X-GitHub-Api-Version: 2022-11-28 and
   *  Authorization: Bearer <token>, and rejects with a HubError {code, status, message}. */
  function api(token, fetchImpl, opts) {
    const o = opts || {};
    const doFetch = fetchImpl || defaultFetch();
    const base = toText(o.base || API).replace(/\/+$/, '');
    const sleep = typeof o.sleep === 'function' ? o.sleep : defaultSleep;

    async function call(method, path, body) {
      if (!doFetch) throw hubError('offline', 0, MSG.offline);
      const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION };
      if (token) headers.Authorization = 'Bearer ' + token;
      const init = { method, headers };
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
      let res;
      try { res = await doFetch(base + path, init); } catch (e) { throw hubError('offline', 0, MSG.offline, e && e.message); }
      let text = '';
      try { text = await res.text(); } catch (e) { text = ''; }
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      if (res.ok) return { status: res.status, data };
      throw statusError(res.status, data, res.headers);
    }

    const repoPath = (owner, repo) => '/repos/' + seg(owner) + '/' + seg(repo);
    const hubOf = (d) => ({
      owner: d && d.owner ? d.owner.login : null, name: d ? d.name : null, private: !!(d && d.private),
      url: d ? d.html_url || null : null, branch: (d && d.default_branch) || 'main',
    });

    /** me() -> {login, name, avatar, url}: who the token belongs to. */
    async function me() {
      const u = (await call('GET', '/user')).data || {};
      return { login: u.login || null, name: u.name || null, avatar: u.avatar_url || null, url: u.html_url || null };
    }

    /** createHub({name, description, private}) -> {owner, name, private, url, branch, site}.
     *  POST /user/repos with auto_init, so the hub starts with a first save and a main branch. */
    async function createHub(x) {
      const p = x || {};
      const chk = checkRepo(p.name);
      if (!chk.ok) { const e = hubError('invalid', 0, chk.reason); e.fixed = chk.fixed; throw e; }
      const body = { name: chk.fixed, private: !!p.private, auto_init: true };
      if (toText(p.description).trim()) body.description = toText(p.description).trim().slice(0, 350);
      const hub = hubOf((await call('POST', '/user/repos', body)).data);
      return Object.assign(hub, { site: hub.owner ? links.site(hub.owner, hub.name) : null });
    }

    /** getHub({owner, repo}) -> {owner, name, private, url, branch} or null when there is none. */
    async function getHub(x) {
      try { return hubOf((await call('GET', repoPath(x.owner, x.repo))).data); } catch (e) { if (e.status === 404) return null; throw e; }
    }

    async function getRaw(owner, repo, path, ref) {
      try {
        const r = await call('GET', repoPath(owner, repo) + '/contents/' + filePath(path) + (ref ? '?ref=' + seg(ref) : ''));
        return r.data && !Array.isArray(r.data) && typeof r.data === 'object' ? r.data : null;
      } catch (e) { if (e.status === 404) return null; throw e; }
    }

    /** getFile({owner, repo, path, ref}) -> {path, sha, text, size} or null when there is no such file.
     *  text is null for a file too big for GitHub to send inline (over 1 MB). */
    async function getFile(x) {
      const d = await getRaw(x.owner, x.repo, x.path, x.ref);
      if (!d) return null;
      const text = typeof d.content === 'string' && d.content && d.encoding === 'base64' ? base64ToUtf8(d.content) : null;
      return { path: d.path || toText(x.path), sha: d.sha || null, text, size: d.size == null ? null : d.size };
    }

    /** putFile({owner, repo, path, text, message, branch}) -> {path, sha, commit, url, created, unchanged}.
     *  GETs the file first for its sha (an update must name it), skips the save when the text is the
     *  same, then PUTs base64 of the UTF-8 text. A clash with another save is retried once. */
    async function putFile(x) {
      const p = x || {};
      const target = repoPath(p.owner, p.repo) + '/contents/' + filePath(p.path);
      const content = utf8ToBase64(p.text);
      for (let attempt = 0; ; attempt++) {
        const old = await getRaw(p.owner, p.repo, p.path, p.branch);
        if (old && typeof old.content === 'string' && old.encoding === 'base64' && old.content.replace(/\s+/g, '') === content) {
          return { path: toText(p.path), sha: old.sha || null, commit: null, url: old.html_url || null, created: false, unchanged: true };
        }
        const body = { message: toText(p.message).trim() || 'Save from 5s', content };
        if (old && old.sha) body.sha = old.sha;
        if (p.branch) body.branch = toText(p.branch);
        try {
          const d = (await call('PUT', target, body)).data || {};
          return {
            path: toText(p.path), sha: d.content ? d.content.sha : null, commit: d.commit ? d.commit.sha : null,
            url: d.content ? d.content.html_url || null : null, created: !old, unchanged: false,
          };
        } catch (e) {
          if (attempt === 0 && e.status === 409) continue; // saved elsewhere in between: fetch the new sha once
          throw e;
        }
      }
    }

    /** saveHub({owner, repo, files: [{path, text}], message, branch}) -> {saved: [putFile results],
     *  changed, url}. One save per changed file, in order (GitHub refuses saves that cross). */
    async function saveHub(x) {
      const p = x || {};
      const files = Array.isArray(p.files) ? p.files.filter((f) => f && toText(f.path)) : [];
      if (!files.length) throw hubError('invalid', 0, 'There is nothing to save yet.');
      const saved = [];
      for (const f of files) saved.push(await putFile({ owner: p.owner, repo: p.repo, path: f.path, text: f.text, message: p.message, branch: p.branch }));
      return { saved, changed: saved.filter((s) => !s.unchanged).length, url: links.site(p.owner, p.repo) };
    }

    /** enableSite({owner, repo, branch = 'main', path = '/'}) -> {enabled: true, already, url, status}.
     *  POST /repos/{owner}/{repo}/pages from main, /. "Already on" (409) is success. */
    async function enableSite(x) {
      const p = x || {};
      const url = links.site(p.owner, p.repo);
      try {
        const d = (await call('POST', repoPath(p.owner, p.repo) + '/pages', { source: { branch: toText(p.branch) || 'main', path: toText(p.path) || '/' } })).data || {};
        return { enabled: true, already: false, url: d.html_url || url, status: d.status || null };
      } catch (e) {
        if (e.status === 409 || (e.status === 422 && /already/i.test(e.detail || ''))) return { enabled: true, already: true, url, status: null };
        throw e;
      }
    }

    /** getSite({owner, repo}) -> {url, status, building} or null when the address is not on. */
    async function getSite(x) {
      try {
        const d = (await call('GET', repoPath(x.owner, x.repo) + '/pages')).data || {};
        return { url: d.html_url || links.site(x.owner, x.repo), status: d.status || null, building: d.status === 'building' };
      } catch (e) { if (e.status === 404) return null; throw e; }
    }

    /** publish({name, description, private, files, message, onStep}) -> {owner, name, private, url, site, saved, made}.
     *  The one button: who am I, make the hub (or use the one already there with that name), save the
     *  files, turn on the address (public hubs). onStep('signin' | 'make' | 'save' | 'address'). */
    async function publish(x) {
      const p = x || {};
      const step = typeof p.onStep === 'function' ? p.onStep : () => {};
      step('signin');
      const who = await me();
      step('make');
      let hub, made = true;
      try { hub = await createHub({ name: p.name, description: p.description, private: p.private }); } catch (e) {
        if (e.code !== 'exists') throw e;
        hub = await getHub({ owner: who.login, repo: checkRepo(p.name).fixed });
        if (!hub) throw e;
        made = false;
      }
      const owner = hub.owner || who.login;
      step('save');
      let saved;
      for (let attempt = 0; ; attempt++) {
        // A just-made hub can take a moment before it accepts files: wait and try again, twice.
        try { saved = await saveHub({ owner, repo: hub.name, files: p.files, message: p.message, branch: hub.branch }); break; } catch (e) {
          if (!made || attempt >= 2 || !(e.status === 404 || e.status === 409)) throw e;
          await sleep(1000 * (attempt + 1));
        }
      }
      let site = null;
      if (!hub.private) { step('address'); site = (await enableSite({ owner, repo: hub.name, branch: hub.branch })).url; }
      return { owner, name: hub.name, private: hub.private, url: hub.url, site, saved: saved.saved, made };
    }

    return Object.freeze({ me, createHub, getHub, getFile, putFile, saveHub, enableSite, getSite, publish });
  }

  // ---------------------------------------------------------------- device flow (sign-in)

  const FLOW_ERRORS = {
    expired_token: 'expired', token_expired: 'expired', incorrect_device_code: 'expired',
    access_denied: 'denied',
    incorrect_client_credentials: 'setup', device_flow_disabled: 'setup', unsupported_grant_type: 'setup',
    invalid_client: 'setup', unauthorized_client: 'setup',
  };
  const flowError = (err, status) => {
    const code = FLOW_ERRORS[err] || 'failed';
    return hubError(code, status || 0, MSG[code], err);
  };

  /** deviceFlow({clientId, endpoint, fetchImpl, onCode, signal, scope, sleep}) -> {token, tokenType, scope}.
   *  POST {endpoint}/login/device/code, hand {userCode, verificationUri, expiresIn, interval} to
   *  onCode, then poll {endpoint}/login/oauth/access_token every `interval` seconds (slow_down adds
   *  5 s, or takes GitHub's new interval) until a token, a refusal or the code's expiry. endpoint
   *  defaults to https://github.com (see the CORS note at the top). signal: an AbortSignal that stops
   *  it ({code: 'cancelled'}). sleep(ms, signal) is injectable for tests. */
  async function deviceFlow(opts) {
    const o = opts || {};
    if (!o.clientId) throw hubError('setup', 0, MSG.setup);
    const doFetch = o.fetchImpl || defaultFetch();
    const base = toText(o.endpoint || WEB).replace(/\/+$/, '');
    const signal = o.signal || null;
    const aborted = () => !!(signal && signal.aborted);
    const cancelled = () => hubError('cancelled', 0, MSG.cancelled);
    const sleep = typeof o.sleep === 'function' ? o.sleep : (ms, sig) => new Promise((res, rej) => {
      if (sig && sig.aborted) { rej(cancelled()); return; }
      const t = setTimeout(res, ms);
      if (sig) sig.addEventListener('abort', () => { clearTimeout(t); rej(cancelled()); }, { once: true });
    });

    async function post(path, params) {
      if (aborted()) throw cancelled();
      if (!doFetch) throw hubError('offline', 0, MSG.offline);
      let res;
      try {
        res = await doFetch(base + path, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(params).toString(),
          signal: signal || undefined,
        });
      } catch (e) {
        if (aborted()) throw cancelled();
        throw hubError('offline', 0, MSG.offline, e && e.message);
      }
      let data = null;
      try { data = JSON.parse(await res.text()); } catch (e) { data = null; }
      if (data && typeof data === 'object' && (data.error || res.ok)) return data;
      if (res.status === 404 || res.status === 401) throw hubError('setup', res.status, MSG.setup);
      throw statusError(res.status, data, res.headers);
    }

    const scope = o.scope == null ? 'public_repo' : toText(o.scope);
    const code = await post('/login/device/code', scope ? { client_id: o.clientId, scope } : { client_id: o.clientId });
    if (code.error) throw flowError(code.error);
    if (!code.device_code || !code.user_code) throw hubError('failed', 0, MSG.failed);
    let interval = Math.max(1, Number(code.interval) || 5);
    const expiresIn = Math.max(1, Number(code.expires_in) || 900);
    if (typeof o.onCode === 'function') {
      o.onCode({ userCode: code.user_code, verificationUri: code.verification_uri || links.device(), expiresIn, interval });
    }
    let waited = 0;
    for (;;) {
      if (waited >= expiresIn) throw hubError('expired', 0, MSG.expired);
      await sleep(interval * 1000, signal);
      waited += interval;
      if (aborted()) throw cancelled();
      const r = await post('/login/oauth/access_token', { client_id: o.clientId, device_code: code.device_code, grant_type: DEVICE_GRANT });
      if (r.access_token) return { token: r.access_token, tokenType: r.token_type || 'bearer', scope: r.scope || '' };
      if (r.error === 'authorization_pending') continue;
      if (r.error === 'slow_down') { interval = Number(r.interval) > interval ? Number(r.interval) : interval + 5; continue; }
      throw flowError(r.error);
    }
  }

  // ---------------------------------------------------------------- export

  const FiveSHub = Object.freeze({
    version: 1,
    API, WEB, API_VERSION, MESSAGES: MSG,
    rules, suggest, links, isSiteRepo,
    api, deviceFlow,
    utf8ToBase64, base64ToUtf8,
  });

  if (typeof module === 'object' && module.exports) module.exports = FiveSHub;
  else root.FiveSHub = FiveSHub;
})(typeof self !== 'undefined' ? self : globalThis);

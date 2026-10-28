/* The round card's side of the connector (play fives): the ui:// resource's meta, the links a tool hands
 * out, and the Worker's signed /pp/ answer for the Picture Poetry pages and their buildings.
 *
 * The pages sit in public/pp/<pageDir>/, a folder name only the Worker knows (deck.things.pageDir, made by
 * npm run things). index.ts sends every /pp/ request here. A person only ever sees
 * /pp/p3.jpg?e=<expiry>&s=<signature>; the Worker checks it and answers from the folder with
 * env.ASSETS.fetch (the Worker's own files, src/files.js), adding CORS itself. Anything else under
 * /pp/, the folder's own path included, is refused.
 *
 * Plain JS with WebCrypto, so `node --test` runs it as the Worker does.
 */

export const ROUND_URI = 'ui://fives/round.html';
export const ROUND_MIME = 'text/html;profile=mcp-app';
/** play_fives's _meta. The second key is the older form some hosts still read. */
export const TOOL_META = { ui: { resourceUri: ROUND_URI }, 'ui/resourceUri': ROUND_URI };

const THREE = 'https://cdn.jsdelivr.net';                 // three.js r147, with integrity hashes (web/space.js)
const PICTURES = ['https://d32dm0rphc51dk.cloudfront.net', 'https://s3.amazonaws.com'];   // the deck's images, as next_five gives them

/** The resource's _meta.ui: everything the card loads, by origin. Without it the frame loads nothing. */
export function cardMeta(origin) {
  return {
    ui: {
      csp: { resourceDomains: [origin, THREE, ...PICTURES].filter(Boolean), connectDomains: origin ? [origin] : [] },
      permissions: { clipboardWrite: {} },
      prefersBorder: true,
    },
  };
}

const DAY = 86400;
const LABEL = 'fives pages v1|';
const enc = new TextEncoder();
const SPACE = /^[bcimosu]\d{1,6}$/, PAGE = /^p[1-6]$/, PAGE_MODEL = /^p[1-6][a-z]$/;
// The only paths a signed link may name.
const SIGNED = /^\/pp\/(p[1-6]\.jpg|m\/p[1-6][a-z]\.json)$/;

/** The HMAC key for page links, from COOKIE_ENCRYPTION_KEY (no new secret); null without a long enough one. */
export async function pageKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) return null;
  return crypto.subtle.importKey('raw', enc.encode(LABEL + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function mac(key, path, e) {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(path + '\n' + e))).slice(0, 16);
}

/** path?e=&s= for one of the SIGNED paths, good for a day (rounded up to the hour, so a link holds for an hour). */
export async function signPage(key, path, now = Date.now()) {
  if (!SIGNED.test(path)) throw new Error('Not a page path: ' + path);
  const e = Math.ceil((Math.floor(now / 1000) + DAY) / 3600) * 3600;
  return path + '?e=' + e + '&s=' + b64url(await mac(key, path, e));
}

/** The file a signed URL names ("p3.jpg", "m/p3a.json"), or null: wrong path, bad or old expiry, wrong signature. */
export async function checkPage(key, url, now = Date.now()) {
  const m = SIGNED.exec(url.pathname);
  const e = url.searchParams.get('e'), s = url.searchParams.get('s');
  if (!m || !key || !/^\d{10}$/.test(e || '') || !/^[A-Za-z0-9_-]{22}$/.test(s || '')) return null;
  const sec = Math.floor(now / 1000);
  if (+e < sec || +e > sec + 2 * DAY) return null;
  const want = b64url(await mac(key, url.pathname, e));
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ s.charCodeAt(i);
  return diff === 0 ? m[1] : null;
}

/**
 * The links a tool hands out (ctx.urls), or undefined without an origin. Each throws on an id outside its
 * pattern. None holds pageDir.
 */
export function cardUrls(origin, secret) {
  if (typeof origin !== 'string' || !/^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(origin)) return undefined;
  let key = null;
  const keyOnce = () => key || (key = pageKey(secret).then((k) => { if (!k) throw new Error('No key for page links (COOKIE_ENCRYPTION_KEY).'); return k; }));
  const need = (re, id, what) => { if (typeof id !== 'string' || !re.test(id)) throw new Error('Not ' + what + ': ' + id); return id; };
  const signed = async (path, now) => origin + await signPage(await keyOnce(), path, now);
  const urls = {
    origin,
    assets: origin + '/s/',
    model: (id) => origin + '/s/m/' + need(SPACE, id, 'a space') + '.json',
    space: (id) => origin + '/s/space?m=' + need(SPACE, id, 'a space'),
    page: async (id, now) => signed('/pp/' + need(PAGE, id, 'a page') + '.jpg', now),
    pageModel: async (m, now) => signed('/pp/m/' + need(PAGE_MODEL, m, "a page's building") + '.json', now),
    async pageSpace(m, now) {
      const u = new URL(await urls.pageModel(m, now));
      return origin + '/s/space?pp=' + m + '&e=' + u.searchParams.get('e') + '&s=' + u.searchParams.get('s');
    },
  };
  return urls;
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' };
const say = (status, text) => new Response(text, { status, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, CORS) });

/** The Worker's answer to anything under /pp/. env.ASSETS is the Worker's own files (files.js); pageDir is deck.things.pageDir. */
export async function servePage(request, env, pageDir, secret, now = Date.now()) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: Object.assign({ 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Max-Age': '86400' }, CORS) });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return say(405, 'Only GET here.');
  const key = await pageKey(secret);
  if (!key || !env.ASSETS || !/^[0-9a-f]{32}$/.test(pageDir || '')) return say(404, 'No pages here.');
  const url = new URL(request.url);
  const file = await checkPage(key, url, now);
  if (!file) return say(403, 'This page link is not right, or it has run out. Ask for the round again.');
  const res = await env.ASSETS.fetch(new Request(new URL('/pp/' + pageDir + '/' + file, url.origin), { method: request.method }));
  if (res.status !== 200) return say(404, 'No such page.');
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  // The artist's own photographs: kept by the person's browser for the link's hour, never by a shared cache.
  out.headers.set('Cache-Control', 'private, max-age=3600');
  return out;
}

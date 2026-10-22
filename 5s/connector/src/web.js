/* Reading the public web, for "Connect your apps" (SPEC: the Paste a link and Ask Claude doors).
 *
 * The 5s app runs inside an artifact, which cannot fetch other sites; the connector can. That makes
 * it a fetcher on the internet acting for whoever asks, so every address it reads is checked first,
 * and every redirect again, hop by hop:
 *
 *   - https only (an http:// link a person pastes is upgraded by read_link before it gets here);
 *   - no sign-in inside the address (user:password@), and the default port only;
 *   - a public name: never an IP literal, never a single-label name (`metadata`, `intranet`), never a
 *     private or reserved suffix (.localhost, .local, .internal, .home.arpa, .test, .onion …);
 *   - what the name resolves to, asked of Cloudflare's DNS over HTTPS: every answer must be a
 *     public address (not loopback, private, carrier-grade NAT, link-local, metadata, multicast,
 *     documentation or reserved ranges, IPv4 or IPv6, including IPv4 hidden inside IPv6);
 *   - at most 3 redirects; each Location is a new address and goes through all of the above;
 *   - a byte cap on every response (a body over it is cut off, never buffered), a timeout on every
 *     request, and a budget of requests for the whole tool call.
 *
 * Nothing is sent but GET, an Accept header and a User-Agent that says what 5s is: no cookies, no
 * sign-in, nothing of the person's.
 *
 * On Cloudflare the Worker's fetch also cannot reach a private network (the platform refuses it and
 * the compatibility flag global_fetch_strictly_public keeps fetch on the public internet). Under
 * `wrangler dev` nothing like that holds (workerd will fetch 127.0.0.1), so these checks are the
 * whole protection there, and they are the same code in both places.
 */

export const WEB_LIMITS = Object.freeze({
  timeoutMs: 8000,          // one request, headers and body
  maxRedirects: 3,
  maxUrl: 2048,             // characters in an address
  pageBytes: 1536 * 1024,   // a page, a feed or an API answer
  imageBytes: 3 * 1024 * 1024, // a picture read whole
  headBytes: 64 * 1024,     // a picture's first bytes: enough to tell what it is and its size
});

export const USER_AGENT = '5s (a Claude connector; reads a public page or picture a person asked it to; +https://github.com/9gn957ptsb-alt/Art-Database/tree/main/5s/connector)';

/** A refusal in plain words: `code` for the tools, `why` and `resolution` for the person. */
export class WebError extends Error {
  constructor(code, why, resolution, status) {
    super(why);
    this.name = 'WebError';
    this.code = code;
    this.why = why;
    this.resolution = resolution;
    this.status = status == null ? null : status;
  }
}

const PUBLIC_ADDRESS = 'Use the public address of the board, channel or page: the one you would send a friend.';

const REFUSALS = {
  'not https': ['5s only reads secure (https://) addresses.', 'Use the https:// address of the page; nearly every site has one.'],
  credentials: ['That address has a sign-in written into it, and 5s never signs in to other sites.', 'Share the public address, without a name or password in it.'],
  port: ['That address names a special port, which 5s does not read.', PUBLIC_ADDRESS],
  ip: ['That address is a bare number (an IP address), and 5s reads sites only by their name.', PUBLIC_ADDRESS],
  private: ['That address points inside a private network or at this computer, which 5s never reads.', PUBLIC_ADDRESS],
  host: ['That is not the name of a public website.', PUBLIC_ADDRESS],
  'too long': ['That address is longer than 5s reads.', 'Use the short address of the page (the one in the browser bar, without tracking codes).'],
  bad: ['That is not a web address 5s can read.', 'Copy the address from the browser bar: it starts with https://.'],
};

function refusal(code) {
  const r = REFUSALS[code];
  return new WebError(code, r[0], r[1]);
}

// ------------------------------------------------------------------ addresses

/** [a, b, c, d] for a dotted-quad IPv4 address, else null. (The URL parser has already turned
 *  every other way of writing one, 2130706433, 0x7f.1, 127.1, into dotted decimal.) */
export function v4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((x) => x <= 255) ? p : null;
}

/** Whether an IPv4 address (as [a, b, c, d]) is anything but an ordinary public one. */
export function privateV4(p) {
  const [a, b, c] = p;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||          // carrier-grade NAT (and Alibaba's metadata, 100.100.100.200)
    (a === 169 && b === 254) ||                    // link-local, and every cloud's metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;                                      // multicast, reserved, broadcast
}

/** Eight 16-bit groups for an IPv6 address (with or without brackets), else null. */
export function v6(host) {
  let s = String(host).replace(/^\[|\]$/g, '').toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (!/^[0-9a-f:.]+$/.test(s) || s.indexOf(':') < 0) return null;
  let tail = [];
  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);   // ::ffff:127.0.0.1, ::1.2.3.4
  if (dotted) {
    const q = v4(dotted[2]);
    if (!q) return null;
    tail = [(q[0] << 8) | q[1], (q[2] << 8) | q[3]];
    s = dotted[1].endsWith('::') ? dotted[1] : dotted[1].slice(0, -1);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const parse = (x) => (x === '' ? [] : x.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const groups = head.length + rest.length + tail.length;
  if (head.concat(rest).some(Number.isNaN)) return null;
  if (halves.length === 1 && groups !== 8) return null;
  if (halves.length === 2 && groups > 7) return null;
  const fill = new Array(8 - groups).fill(0);
  const out = halves.length === 2 ? head.concat(fill, rest, tail) : head.concat(tail);
  return out.length === 8 ? out : null;
}

/** Whether an IPv6 address (eight groups) is anything but an ordinary public one. */
export function privateV6(h) {
  if (h.slice(0, 6).every((x) => x === 0)) return true;                       // ::, ::1, ::a.b.c.d
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return true;    // ::ffff:a.b.c.d: an IPv4 address in disguise
  if (h[0] === 0x64 && h[1] === 0xff9b) return true;                          // NAT64 (64:ff9b::/96 and /48)
  if (h[0] === 0x2002) return true;                                           // 6to4: an IPv4 address in disguise
  if (h[0] === 0x2001 && h[1] === 0) return true;                             // Teredo
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true;                        // documentation
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true; // discard
  if ((h[0] & 0xfe00) === 0xfc00) return true;                                // unique local (fd00:ec2::254, AWS metadata)
  if ((h[0] & 0xffc0) === 0xfe80 || (h[0] & 0xffc0) === 0xfec0) return true;  // link-local, site-local
  if ((h[0] & 0xff00) === 0xff00) return true;                                // multicast
  return false;
}

/** Whether an address an answer gave (IPv4 or IPv6, as text) is private, reserved or unreadable. */
export function privateIp(ip) {
  const a = v4(String(ip));
  if (a) return privateV4(a);
  const b = v6(String(ip));
  return b ? privateV6(b) : true;
}

// Names that never belong to a public website: reserved and private-use suffixes, and the names
// clouds give their metadata services.
const PRIVATE_SUFFIXES = ['localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home', 'home.arpa',
  'corp', 'private', 'test', 'invalid', 'example', 'arpa', 'onion', 'svc', 'cluster.local', 'kubernetes'];
const PRIVATE_HOSTS = new Set(['metadata.google.internal', 'metadata.goog', 'instance-data.ec2.internal']);

function privateName(host) {
  if (PRIVATE_HOSTS.has(host)) return true;
  return PRIVATE_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
}

/**
 * checkAddress(text) -> URL, or throws a WebError saying why not. The URL parser canonicalises the
 * host first (lower case, punycode, every numeric spelling of an IPv4 address as dotted decimal,
 * IPv6 compressed), so the checks see what fetch would connect to.
 */
export function checkAddress(text) {
  const s = String(text == null ? '' : text).trim();
  if (s.length > WEB_LIMITS.maxUrl) throw refusal('too long');
  let u;
  try { u = new URL(s); } catch { throw refusal('bad'); }
  if (u.protocol !== 'https:') throw refusal('not https');
  if (u.username || u.password) throw refusal('credentials');
  const host = u.hostname.replace(/\.$/, '');
  if (!host) throw refusal('bad');
  if (host.startsWith('[') || v6(host)) throw refusal(privateIp(host) ? 'private' : 'ip');
  if (/^[0-9.]+$/.test(host)) throw refusal(v4(host) && !privateV4(v4(host)) ? 'ip' : 'private');
  if (privateName(host)) throw refusal('private');
  const labels = host.split('.');
  if (labels.length < 2) throw refusal('host');
  if (!labels.every((l) => /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/.test(l))) throw refusal('host');
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels[labels.length - 1])) throw refusal('host');
  if (u.port !== '') throw refusal('port');
  u.hash = '';
  return u;
}

/** True when text is an address 5s would read (checkAddress without the reason). */
export function readableAddress(text) {
  try { checkAddress(text); return true; } catch { return false; }
}

// ------------------------------------------------------------------ DNS

export const DOH = 'https://cloudflare-dns.com/dns-query';

/**
 * dohResolver(fetch) -> async (host) => [address]: the A and AAAA answers for a name, asked of
 * Cloudflare's DNS over HTTPS (JSON). [] for a name that does not exist. Throws when DNS can't be
 * asked: the caller refuses then (it never reads a site it could not check).
 */
export function dohResolver(doFetch, timeoutMs) {
  const ask = (host, type) => withTimeout(timeoutMs || 5000, async (signal) => {
    const r = await doFetch(DOH + '?name=' + encodeURIComponent(host) + '&type=' + type, {
      method: 'GET', headers: { accept: 'application/dns-json' }, redirect: 'manual', signal,
    });
    if (!r.ok) throw new Error('DNS answered ' + r.status);
    const j = JSON.parse(await r.text());
    if (j.Status === 3) return [];
    if (j.Status !== 0) throw new Error('DNS status ' + j.Status);
    const want = type === 'A' ? 1 : 28;
    return (Array.isArray(j.Answer) ? j.Answer : []).filter((a) => a && a.type === want).map((a) => String(a.data));
  });
  return async (host) => {
    const [a, aaaa] = await Promise.all([ask(host, 'A'), ask(host, 'AAAA')]);
    return a.concat(aaaa);
  };
}

// ------------------------------------------------------------------ fetching

/**
 * Run fn(signal) with a deadline: the signal aborts after ms, and the timer is cleared when fn ends.
 * (Not AbortSignal.timeout: under Node its timer does not keep the process alive, so a request that
 * never answers could end a test run instead of timing out.)
 */
export async function withTimeout(ms, fn) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new DOMException('The request timed out', 'TimeoutError')), ms);
  try { return await fn(ac.signal); } finally { clearTimeout(timer); }
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

async function cancel(res) {
  try { if (res && res.body) await res.body.cancel(); } catch { /* already closed */ }
}

function statusError(status) {
  if (status === 401 || status === 403) return new WebError('forbidden', 'That page is private or needs a sign-in, so 5s can\'t read it.', 'Make the board, channel or page public (or share its public link), then try again. Or save the pictures and bring them in from your photos in the 5s app.', status);
  if (status === 404 || status === 410) return new WebError('not found', 'Nothing is at that address (the site says it was not found).', 'Check the address: open it in a browser, copy it from the address bar and try again.', status);
  if (status === 429 || status >= 500) return new WebError('busy', 'That site is busy or not answering properly right now.', 'Try again in a few minutes.', status);
  return new WebError('unreachable', 'That site did not give 5s the page (it answered ' + status + ').', 'Check the address in a browser, or try again later.', status);
}

/**
 * createWeb({fetch, resolve?, timeoutMs?, maxRedirects?, budget?}) -> a reader for one tool call:
 *   get(address, {accept, maxBytes, partial}) -> {url, status, type, bytes, truncated, redirects}
 * `fetch` is the platform's (or a fake); `resolve` checks what names resolve to (dohResolver);
 * `budget` is how many requests (DNS lookups included) this call may make in all.
 * partial: a body over maxBytes is cut there and returned with truncated: true, not refused.
 */
export function createWeb(opts) {
  const o = opts || {};
  const doFetch = o.fetch;
  if (typeof doFetch !== 'function') throw new Error('createWeb needs a fetch');
  const timeoutMs = o.timeoutMs || WEB_LIMITS.timeoutMs;
  const maxRedirects = o.maxRedirects == null ? WEB_LIMITS.maxRedirects : o.maxRedirects;
  const resolve = o.resolve === undefined ? dohResolver(doFetch, timeoutMs) : o.resolve;
  const looked = new Map();
  const web = { budget: o.budget == null ? Infinity : o.budget, requests: 0, log: [] };

  const spend = (n) => {
    if (web.requests + n > web.budget) {
      throw new WebError('budget', '5s has read as much as it reads in one go.', 'Ask again with fewer things at a time.');
    }
    web.requests += n;
  };

  async function checkName(host) {
    if (!resolve) return;
    let p = looked.get(host);
    if (!p) {
      spend(2);
      p = resolve(host).then((ips) => ({ ips }), (e) => ({ error: e }));
      looked.set(host, p);
    }
    const r = await p;
    if (r.error) throw new WebError('dns', 'Couldn\'t look up that site\'s address just now.', 'Try again in a moment.');
    if (!r.ips.length) throw new WebError('no site', 'There is no website at that name.', 'Check the spelling of the address.');
    if (r.ips.some(privateIp)) throw refusal('private');
  }

  async function readBody(res, maxBytes, partial) {
    const declared = Number(res.headers.get('content-length'));
    if (!partial && Number.isFinite(declared) && declared > maxBytes) {
      await cancel(res);
      throw tooLarge(maxBytes);
    }
    if (!res.body) return { bytes: new Uint8Array(0), truncated: false };
    const reader = res.body.getReader();
    const chunks = [];
    let n = 0, truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      if (n + chunk.length > maxBytes) {
        try { await reader.cancel(); } catch { /* closed */ }
        if (!partial) throw tooLarge(maxBytes);
        chunks.push(chunk.subarray(0, maxBytes - n));
        n = maxBytes;
        truncated = true;
        break;
      }
      chunks.push(chunk);
      n += chunk.length;
    }
    const bytes = new Uint8Array(n);
    let at = 0;
    for (const c of chunks) { bytes.set(c, at); at += c.length; }
    return { bytes, truncated };
  }

  web.get = async function get(address, g) {
    const opt = g || {};
    const maxBytes = opt.maxBytes || WEB_LIMITS.pageBytes;
    let url = checkAddress(address).href;
    for (let hop = 0; ; hop++) {
      const u = checkAddress(url);
      await checkName(u.hostname.replace(/\.$/, ''));
      spend(1);
      web.log.push(u.href);
      const got = await withTimeout(timeoutMs, async (signal) => {
        let res;
        try {
          res = await doFetch(u.href, { method: 'GET', redirect: 'manual', signal,
            headers: { accept: opt.accept || '*/*', 'user-agent': USER_AGENT } });
        } catch (e) {
          if (signal.aborted) throw timedOut();
          throw new WebError('unreachable', 'Couldn\'t reach that site.', 'Check the address in a browser, or try again later.');
        }
        if (REDIRECTS.has(res.status)) {
          await cancel(res);
          return { redirect: res.headers.get('location') };
        }
        if (!res.ok) { await cancel(res); throw statusError(res.status); }
        try {
          const body = await readBody(res, maxBytes, !!opt.partial);
          return { res, body };
        } catch (e) {
          if (e instanceof WebError) throw e;
          if (signal.aborted) throw timedOut();
          throw new WebError('unreachable', 'That site stopped answering part way.', 'Try again in a moment.');
        }
      });
      if (got.redirect !== undefined) {
        const loc = got.redirect;
        if (!loc) throw new WebError('unreachable', 'That site sent 5s somewhere without saying where.', 'Open the page in a browser and use the address it ends up at.');
        if (hop >= maxRedirects) throw new WebError('redirects', 'That address sends 5s on through more than ' + maxRedirects + ' other addresses.', 'Open it in a browser and use the address it ends up at.');
        let next;
        try { next = new URL(loc, u.href).href; } catch { throw refusal('bad'); }
        url = next;
        continue;
      }
      const type = String(got.res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      return { url: u.href, status: got.res.status, type, bytes: got.body.bytes, truncated: got.body.truncated, redirects: hop };
    }
  };

  return web;
}

function tooLarge(max) {
  return new WebError('too large', 'That is bigger than 5s reads (over ' + Math.round(max / 1024) + ' KB).', 'Use the address of the board, channel or page itself, or of a smaller picture.');
}

function timedOut() {
  return new WebError('timeout', 'That site took too long to answer.', 'Try again in a moment; if it keeps happening, the site may be down.');
}

/** Text of a body, as UTF-8 (a BOM dropped; anything undecodable replaced). */
export function textOf(bytes) {
  return new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
}

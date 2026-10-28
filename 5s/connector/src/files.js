/* The Worker's own files: the space viewer, the spaces' models and the Picture Poetry pages, packed into the
 * Worker by npm run deck (src/files.generated.json, from public/) and answered here in place of Workers static
 * assets. Static assets upload with a one-time pass that this environment's proxy swaps for the account's
 * token, so Cloudflare refuses them (401); a Worker's own code uploads with the token itself.
 */

// Buffer (nodejs_compat) decodes a page in well under a millisecond; atob and a per-byte callback took ~40 ms,
// four times Workers Free's 10 ms of CPU a request.
import { Buffer } from 'node:buffer';

// What public/_headers gave /s/*: the card fetches the models from Claude's own origin.
const PUBLIC = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' };

/**
 * files: { '/s/m/b001.json': { type, text } | { type, base64 } }. Returns { fetch(request) }, a stand-in for
 * env.ASSETS: a file by its exact path (/s/space answers /s/space.html), or 404. /pp/ files get no headers
 * of their own: only card.js's servePage asks for them, and it sets its own.
 */
export function bundledFiles(files) {
  const decoded = new Map();
  const body = (f) => {
    if (f.text != null) return f.text;
    if (!decoded.has(f)) decoded.set(f, Buffer.from(f.base64, 'base64'));
    return decoded.get(f);
  };
  return {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const key = Object.hasOwn(files, path) ? path : Object.hasOwn(files, path + '.html') ? path + '.html' : null;
      if (!key) return new Response('Not found.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      const f = files[key];
      const headers = Object.assign({ 'Content-Type': f.type }, key.startsWith('/s/') ? PUBLIC : {});
      return new Response(request.method === 'HEAD' ? null : body(f), { headers });
    },
  };
}

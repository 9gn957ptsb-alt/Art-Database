/* Each person's 5s in their own SQLite-backed Durable Object (README "What it costs: nothing").
 *
 * Why here and not in Workers KV: on Cloudflare's free plan KV takes 1,000 writes a day for the whole
 * connector, and every judgment saves the state once, so a few dozen people playing a five would use
 * it up. A SQLite-backed Durable Object is on the free plan too and takes 100,000 rows written a day;
 * one save of a person's state is one row. One object per person (named "person:<GitHub id>"), not
 * the McpAgent's object, because that one belongs to a single MCP session: a person has a new one
 * each time Claude or the app opens a session, so nothing kept there would be found again.
 *
 * The logic is here, in plain JS over the two things it needs (a SQL `exec` like the Durable Object's
 * `ctx.storage.sql.exec`, and the old KV namespace), so `node --test` runs it on node:sqlite. The
 * Durable Object itself (index.ts FiveSPerson) only passes calls in.
 *
 *   kv(k, v)      k is "state:<id>" or "repos:<id>" for this person only; v the same JSON text that
 *                 KV held (store.js readState/writeState and readRepos/addRepo read and write it)
 *   moved(k)      keys already brought over from KV (or found missing there), so KV is read once
 *
 * Moving from KV: the first time a key is asked for (or written) and it is not here yet, it is read
 * from KV once. Found: kept here, then deleted from KV (best effort: if KV's free deletes for the day
 * are used up the old copy stays, never read again). Not found: noted as moved, so KV is not asked
 * again. A write that arrives while that read is under way is never overwritten by it (INSERT OR
 * IGNORE), so nothing newer is lost.
 */

export const PERSON_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS moved (k TEXT PRIMARY KEY NOT NULL) WITHOUT ROWID',
];

const UID = /^[A-Za-z0-9_-]{1,64}$/;

/** The Durable Object name for a person: one object per GitHub user id. */
export function personName(uid) {
  const s = String(uid == null ? '' : uid);
  if (!UID.test(s)) throw new Error('bad user id');
  return 'person:' + s;
}

/** The keys a person's object keeps: only their own. */
export function personKeys(uid) {
  const s = String(uid);
  return new Set(['state:' + s, 'repos:' + s]);
}

const rows = (cursor) => (cursor && typeof cursor.toArray === 'function' ? cursor.toArray() : Array.from(cursor || []));

/**
 * personStore(sql, {uid, kv, waitUntil}) -> {get(k), put(k, v), counts}
 * sql: {exec(query, ...params) -> iterable of row objects}, as ctx.storage.sql is.
 * kv: the old KV namespace (get/delete), or null when there is nothing to move.
 * counts: rows read and written by this store (what the free plan counts), for tests and the README.
 */
export function personStore(sql, opts) {
  const o = opts || {};
  const uid = String(o.uid);
  if (!UID.test(uid)) throw new Error('bad user id');
  const allowed = personKeys(uid);
  const kv = o.kv || null;
  const counts = { read: 0, written: 0, kvReads: 0, kvDeletes: 0 };
  for (const q of PERSON_SCHEMA) sql.exec(q);
  const one = (q, ...p) => { const r = rows(sql.exec(q, ...p)); counts.read += r.length; return r[0] || null; };
  const write = (q, ...p) => { sql.exec(q, ...p); counts.written += 1; };
  const check = (k) => { if (!allowed.has(k)) throw new Error('not this person\'s key'); };

  async function bringOver(k) {
    if (one('SELECT k FROM moved WHERE k = ?', k)) return;
    let old = null;
    if (kv) {
      counts.kvReads++;
      old = await kv.get(k);
    }
    if (one('SELECT k FROM moved WHERE k = ?', k)) return; // another call moved it while KV answered
    if (typeof old === 'string' && old) write('INSERT OR IGNORE INTO kv (k, v) VALUES (?, ?)', k, old);
    write('INSERT OR IGNORE INTO moved (k) VALUES (?)', k);
    if (typeof old === 'string' && old && kv) {
      counts.kvDeletes++;
      const gone = Promise.resolve().then(() => kv.delete(k)).catch(() => {});
      if (typeof o.waitUntil === 'function') o.waitUntil(gone); else await gone;
    }
  }

  return {
    counts,
    async get(k) {
      check(k);
      const r = one('SELECT v FROM kv WHERE k = ?', k);
      if (r) return r.v;
      await bringOver(k);
      const again = one('SELECT v FROM kv WHERE k = ?', k);
      return again ? again.v : null;
    },
    async put(k, v) {
      check(k);
      if (typeof v !== 'string') throw new Error('a stored value is text');
      await bringOver(k);
      write('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
    },
  };
}

/**
 * personRpcStore(namespace, uid) -> {get, put}: the store the tools use (store.js shape), each call
 * one request to the person's Durable Object (index.ts FiveSPerson). namespace: env.PERSON.
 */
export function personRpcStore(namespace, uid) {
  const name = personName(uid);
  const stub = namespace.get(namespace.idFromName(name));
  return {
    get: (k) => stub.get(String(uid), k),
    put: (k, v) => stub.put(String(uid), k, v),
  };
}

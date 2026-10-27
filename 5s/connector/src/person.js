/* Each person's 5s in their own SQLite-backed Durable Object (README "What it costs: nothing").
 *
 * Why here and not in Workers KV: on Cloudflare's free plan KV takes 1,000 writes a day for the whole
 * connector, and every judgment saves the state once, so a few dozen people playing a five would use
 * it up. A SQLite-backed Durable Object is on the free plan too and takes 100,000 rows written a day;
 * one save of a person's state is one row. One object per person (named "person:<GitHub id>"), not
 * the McpAgent's object, because that one belongs to a single MCP session: a person has a new one
 * each time Claude or the app opens a session, so nothing kept there would be found again.
 *
 * The logic is here, in plain JS over the one thing it needs (a SQL `exec` like the Durable Object's
 * `ctx.storage.sql.exec`), so `node --test` runs it on node:sqlite. The Durable Object itself
 * (index.ts FiveSPerson) only passes calls in.
 *
 *   kv(k, v)      k is "state:<id>" or "repos:<id>" for this person only; v the JSON text store.js
 *                 readState/writeState and readRepos/addRepo read and write
 *
 * No move from Workers KV: the connector was never deployed with each 5s in KV, so there is nothing
 * to move, and reading KV for it would cost a second namespace and a read for every new person.
 */

import { revOf } from './store.js';

export const PERSON_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL) WITHOUT ROWID',
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
 * personStore(sql, {uid}) -> {get(k), put(k, v), counts}
 * sql: {exec(query, ...params) -> iterable of row objects}, as ctx.storage.sql is.
 * counts: rows read and written by this store (what the free plan counts), for tests and the README.
 */
export function personStore(sql, opts) {
  const uid = String((opts || {}).uid);
  if (!UID.test(uid)) throw new Error('bad user id');
  const allowed = personKeys(uid);
  const counts = { read: 0, written: 0 };
  for (const q of PERSON_SCHEMA) sql.exec(q);
  const check = (k) => { if (!allowed.has(k)) throw new Error('not this person\'s key'); };

  return {
    counts,
    async get(k) {
      check(k);
      const r = rows(sql.exec('SELECT v FROM kv WHERE k = ?', k));
      counts.read += r.length;
      return r[0] ? r[0].v : null;
    },
    // base (optional): write only while the stored rev is still base, else false. No await between the read and the
    // write, so no other call to this object comes in between.
    async put(k, v, base) {
      check(k);
      if (typeof v !== 'string') throw new Error('a stored value is text');
      if (base != null) {
        const r = rows(sql.exec('SELECT v FROM kv WHERE k = ?', k));
        counts.read += r.length;
        if (revOf(r[0] ? r[0].v : null) !== base) return false;
      }
      sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
      counts.written += 1;
      return true;
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
    put: (k, v, base) => stub.put(String(uid), k, v, base),
  };
}

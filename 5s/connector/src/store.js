/* Each person's 5s, privately, in the connector's own store (in production their own SQLite-backed
 * Durable Object, person.js and index.ts FiveSPerson, never Workers KV, for the free plan's sake; a
 * Map in tests), keyed by their GitHub user id (a number that never changes, unlike a login).
 *
 *   state:<id>  {rev, at, state, use}    the 5s state, shared with the app through get_state/put_state;
 *                                        use = today's counts {day, writes, saves} for the daily caps
 *   repos:<id>  {made: [{name, at}]}     the repositories this connector made (never written by the app)
 *
 * No GitHub token is ever stored here: it lives only in the OAuth provider's encrypted props.
 *
 * Daily caps, per person (UTC days): DAILY_WRITES saves of their state, DAILY_HUB_SAVES saves to
 * GitHub (make_hub and save_hub), DAILY_NEW_HUBS new repositories and DAILY_BRING pictures read and
 * brought in from other sites (bring_in; counted as `brought`, whether or not each one was added). They keep one person (or a
 * chat gone round in circles) from filling the store's daily writes or their GitHub account. The
 * counts ride in the same record as the state, so counting costs no extra write. They are best
 * effort: two tool calls at the same moment (two chats at once) can both pass.
 */
import FiveS from './engine.js';

export const MAX_STATE_BYTES = 1024 * 1024; // a year of daily fives is well under 200 KB
export const DAILY_WRITES = 500;            // 5s app saves plus chat judgments: about 80 fives a day
export const DAILY_HUB_SAVES = 30;
export const DAILY_NEW_HUBS = 3;
export const DAILY_BRING = 300;             // pictures bring_in reads from other sites: a few boards a day

const stateKey = (uid) => 'state:' + uid;
const reposKey = (uid) => 'repos:' + uid;

/** Size in bytes as stored (UTF-8), not in characters. */
export const byteLength = (text) => new TextEncoder().encode(String(text)).length;
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** A refusal in plain words for a cap or a size limit: the tools turn it into an answer, not a failure. */
export class LimitError extends Error {
  constructor(limit, why, resolution) {
    super(why);
    this.name = 'LimitError';
    this.limit = limit;
    this.why = why;
    this.resolution = resolution;
  }
}

function checkUid(uid) {
  const s = String(uid == null ? '' : uid);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(s)) throw new Error('bad user id');
  return s;
}

/** A failure of the store itself (not a cap 5s sets): the tools answer it in plain words, never "something went wrong". */
export class StoreError extends Error {
  constructor(when, cause) {
    const why = when === 'put' ? 'Your database couldn\'t be saved just now.' : 'Your saved database couldn\'t be opened just now.';
    super(why);
    this.name = 'StoreError';
    this.why = why;
    // On the free plan the likeliest cause is the day's allowance, which comes back at midnight UTC.
    this.resolution = 'Try again in a minute. If it keeps happening, today\'s free allowance is used up: it comes back at midnight UTC, and nothing you saved before is lost (the app keeps working on its own meanwhile).';
    this.cause = cause;
  }
}

/** store with every failure of get or put turned into a StoreError. */
export function guardedStore(store) {
  return {
    get: async (k) => { try { return await store.get(k); } catch (e) { throw new StoreError('get', e); } },
    put: async (k, v, base) => { try { return await store.put(k, v, base); } catch (e) { throw new StoreError('put', e); } },
  };
}

/** The rev of a stored record's text (0 when nothing is stored). */
export const revOf = (text) => (text ? Number(JSON.parse(text).rev) || 0 : 0);

/** A store in memory, for tests. `map` is exposed so tests can look inside. put(k, v, base): see writeState. */
export function memoryStore() {
  const map = new Map();
  return {
    map, get: async (k) => (map.has(k) ? map.get(k) : null),
    put: async (k, v, base) => { if (base != null && revOf(map.get(k)) !== base) return false; map.set(k, String(v)); return true; },
  };
}

/** Today's counts from a record's `use` (zero on a new day). */
export function usage(use, now) {
  const day = utcDay(now);
  return use && use.day === day ? { day, writes: use.writes | 0, saves: use.saves | 0, brought: use.brought | 0 } : { day, writes: 0, saves: 0, brought: 0 };
}

/** readState(store, uid) -> {rev, at, state, stored, use}; rev 0 and a fresh state when nothing is stored. */
export async function readState(store, uid) {
  const raw = await store.get(stateKey(checkUid(uid)));
  if (!raw) return { rev: 0, at: null, state: FiveS.newState(), stored: false, use: null };
  const rec = JSON.parse(raw);
  return { rev: Number(rec.rev) || 0, at: rec.at || null, state: FiveS.migrate(rec.state), stored: true, use: rec.use || null };
}

/**
 * writeState(store, uid, state, rev, now, {use, hubSave, brought, base}) -> the record written. The caller
 * decides rev and passes the `use` it read; hubSave counts a save to GitHub, brought how many pictures
 * bring_in read. base, the rev the caller read: when the stored rev is no longer that (another call saved
 * meanwhile), nothing is written and it returns null. Throws LimitError past a cap.
 */
export async function writeState(store, uid, state, rev, now, opts) {
  const o = opts || {};
  const use = usage(o.use, now);
  if (use.writes >= DAILY_WRITES) {
    throw new LimitError('daily writes', 'Your state has been saved ' + use.writes + ' times today, the most allowed in one day.', 'Carry on tomorrow (the count starts again at midnight UTC). Nothing you did today is lost.');
  }
  const rec = { rev, at: new Date(now).toISOString(), state, use: { day: use.day, writes: use.writes + 1, saves: use.saves + (o.hubSave ? 1 : 0), brought: use.brought + (Math.max(0, o.brought | 0)) } };
  const text = JSON.stringify(rec);
  if (byteLength(text) > MAX_STATE_BYTES + 4096) {
    throw new LimitError('size', 'Your database is full: its state would be over 1 MB, more than can be kept.', 'Remove some notes or brought-in things in the app; brought-in images belong there, not in the state.');
  }
  return (await store.put(stateKey(checkUid(uid)), text, o.base)) === false ? null : rec;
}

export async function readRepos(store, uid) {
  const raw = await store.get(reposKey(checkUid(uid)));
  const rec = raw ? JSON.parse(raw) : null;
  return { made: rec && Array.isArray(rec.made) ? rec.made : [] };
}

/** How many repositories the connector made for this person on the UTC day of `now`. */
export function madeOn(repos, now) {
  const day = utcDay(now);
  return repos.made.filter((r) => typeof r.at === 'string' && r.at.slice(0, 10) === day).length;
}

export async function addRepo(store, uid, name, now) {
  const rec = await readRepos(store, uid);
  if (!rec.made.some((r) => r.name.toLowerCase() === String(name).toLowerCase())) {
    rec.made.push({ name: String(name), at: new Date(now).toISOString() });
  }
  await store.put(reposKey(checkUid(uid)), JSON.stringify(rec));
  return rec;
}

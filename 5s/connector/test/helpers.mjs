// Shared set-up for the connector tests: the synthetic fixture deck (trimmed the way `npm run deck`
// trims the real one), an in-memory store, a fake GitHub that records every request, and a clock.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trimDeck } from '../src/deck.js';
import { memoryStore } from '../src/store.js';
import { createFakeGitHub } from '../src/fake-github.js';
import { api } from '../src/hub.js';
import { runTool } from '../src/tools.js';
import { createWeb } from '../src/web.js';
import { createFakeWeb } from '../src/fake-web.js';

export const here = dirname(fileURLToPath(import.meta.url));
export const CONNECTOR = join(here, '..');
export const FIVES = join(CONNECTOR, '..');
export const require = createRequire(import.meta.url);

/** The app's engine, loaded the way the app's own tests load it. */
export const AppEngine = require(join(FIVES, 'src', 'engine.js'));

export const fullFixture = () => JSON.parse(readFileSync(join(FIVES, 'test', 'fixture', 'deck.json'), 'utf8'));

/** The fixture deck as the connector bundles it (the fixture carries made-up "cdn" addresses). */
export function fixtureDeck() {
  return trimDeck(fullFixture(), {});
}

// Local-time noon, so dayOf() is the same date in every time zone.
export const at = (y, m, d, hh = 12, mm = 0) => new Date(y, m - 1, d, hh, mm, 0).getTime();
export const DAY = 86400000;

export const LOGIN = 'ada-lovelace';
export const UID = '4242';
export const TOKEN = 'gho_test_token';

/**
 * ctxFor({...}) -> {ctx, gh, store, clock}: a tool context for one person, with a fake GitHub.
 * clock.t is the current time in ms; every ctx.now() call moves it on 3 s (a judgment's pace).
 */
export function ctxFor(opts = {}) {
  const deck = opts.deck || fixtureDeck();
  const store = opts.store || memoryStore();
  const gh = opts.gh || createFakeGitHub({
    users: [{ token: TOKEN, id: Number(UID), login: LOGIN, scopes: opts.scopes }].concat(opts.users || []),
    repos: opts.repos, pagesNeedRepoScope: opts.pagesNeedRepoScope, emptyReads: opts.emptyReads,
  });
  const clock = { t: opts.start || at(2026, 10, 22, 9), step: opts.step == null ? 3000 : opts.step, sleeps: [] };
  // The public web, for read_link, bring_in and item_image: a fake (src/fake-web.js) behind the real
  // guard (src/web.js), with a short timeout so a site that never answers ends a test quickly.
  const web = opts.web || createFakeWeb();
  const ctx = {
    store, deck,
    github: opts.noGithub ? null : api(opts.token || TOKEN, gh.fetch, { base: gh.base }),
    user: { id: opts.uid || UID, login: opts.login || LOGIN },
    now: () => (clock.t += clock.step),
    sleep: async (ms) => { clock.sleeps.push(ms); },
    web: opts.noWeb ? undefined : (o) => createWeb(Object.assign({ fetch: web.fetch, timeoutMs: opts.timeoutMs || 400 }, o)),
  };
  return { ctx, gh, store, clock, deck, web };
}

export const call = (ctx, name, args) => runTool(ctx, name, args || {});

/** Play n fives through the tools, keeping warm cards (odd numbers in the fixture) and passing cool ones. */
export async function playFives(ctx, n, keepRule) {
  const rule = keepRule || ((id) => Number(id.slice(1)) % 2 === 1);
  const results = [];
  for (let k = 0; k < n; k++) {
    const f = await call(ctx, 'next_five');
    for (const c of f.data.cards) results.push(await call(ctx, 'judge', { card: c.card, keep: rule(c.card) }));
  }
  return results;
}

/** Store a state directly (as the app would have, through put_state). */
export async function putState(ctx, state) {
  const g = await call(ctx, 'get_state');
  return call(ctx, 'put_state', { state, base: g.data.rev });
}

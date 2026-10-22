// The engine gives the same answers in the connector as in the app: it is the app's own file, and the
// connector's trimmed deck carries every field the engine reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import FiveS from '../src/engine.js';
import { trimDeck, CARD_FIELDS } from '../src/deck.js';
import { AppEngine, fullFixture, fixtureDeck, ctxFor, call, at, DAY, CONNECTOR, FIVES } from './helpers.mjs';

const NOW = at(2026, 10, 22, 12);

test('the connector imports the app\'s engine itself, not a copy', () => {
  assert.equal(FiveS, AppEngine, 'same module object as 5s/src/engine.js loaded the app tests\' way');
  assert.equal(typeof FiveS.judge, 'function');
});

/** Everything the app derives from a state, computed on one deck. */
function answers(F, st, deck, now) {
  const P = F.profile(st, deck, now);
  const m = F.model(st, deck);
  return {
    profile: P,
    philosophy: F.philosophy(P, deck),
    nextFive: F.nextFive(st, deck, now),
    nextFiveTomorrow: F.nextFive(st, deck, now + DAY),
    seedCode: F.seedCode(st),
    seed: F.exportSeed(st, deck, now),
    path: F.path(st, deck, now),
    predictions: deck.cards.map((c) => F.predict(m, F.card(st, deck, c.id))),
    sets: ['wall', 'window', 'picture', 'floor', 'object'].map((s) => F.setCandidates(st, deck, s, 0)),
  };
}

function compareDecks(full, trimmed) {
  // A believable taste built on the app's deck, then every answer computed on both decks.
  const st = AppEngine.exampleState(full, NOW);
  assert.ok(st.j.length >= 40, 'the example taste has judgments');
  assert.deepEqual(answers(FiveS, st, trimmed, NOW), answers(AppEngine, st, full, NOW));
  // Judging card by card gives the same turns on both decks.
  let a = AppEngine.newState(), b = FiveS.newState();
  let t = NOW;
  for (let k = 0; k < 6; k++) {
    a = AppEngine.startFive(a, full, t); b = FiveS.startFive(b, trimmed, t);
    assert.deepEqual(b.five, a.five);
    let id;
    while ((id = AppEngine.currentCard(a)) !== null) {
      const keep = (id.charCodeAt(id.length - 1) + k) % 3 !== 0;
      t += 2100;
      const ra = AppEngine.judge(a, full, id, keep, 1500 + k * 100, t);
      const rb = FiveS.judge(b, trimmed, id, keep, 1500 + k * 100, t);
      assert.deepEqual(rb.turn, ra.turn);
      a = ra.state; b = rb.state;
    }
  }
  assert.deepEqual(b, a);
}

test('the trimmed fixture deck gives the same profile, philosophy, fives, turns, sets and seed as the full one', () => {
  const full = fullFixture();
  compareDecks(full, trimDeck(full, {}));
});

test('the trimmed deck keeps only the fields the tools need, plus the CDN image address', () => {
  const full = fullFixture();
  const d = fixtureDeck();
  assert.equal(d.cards.length, full.cards.length);
  for (const c of d.cards) {
    for (const k of Object.keys(c)) assert.ok(CARD_FIELDS.includes(k), 'unexpected field ' + k);
    assert.equal(c.img, undefined);
    assert.equal(c.thumb, undefined);
    assert.match(c.cdn, /^https:\/\//);
  }
  assert.equal(d.atlas, undefined);
  assert.deepEqual(Object.keys(d.genes).sort(), Object.keys(full.genes).filter((g) => full.cards.some((c) => (c.genes || []).includes(g))).sort());
});

const realDeck = join(FIVES, 'dist', 'deck.json');
const generated = join(CONNECTOR, 'src', 'deck.generated.json');
test('the real deck (when built here) gives the same answers trimmed as in the app', { skip: !existsSync(realDeck) || !existsSync(generated) ? 'no 5s/dist/deck.json or src/deck.generated.json on this machine' : false }, () => {
  const full = JSON.parse(readFileSync(realDeck, 'utf8'));
  const trimmed = JSON.parse(readFileSync(generated, 'utf8'));
  assert.equal(trimmed.cards.length, full.cards.length);
  assert.deepEqual(trimmed.cards.map((c) => c.id), full.cards.map((c) => c.id));
  compareDecks(full, trimmed);
  const withImage = trimmed.cards.filter((c) => c.cdn).length;
  assert.ok(withImage >= trimmed.cards.length * 0.95, 'nearly every card has an image address (' + withImage + ')');
  for (const c of trimmed.cards) if (c.cdn) assert.match(c.cdn, /^https:\/\/[a-z0-9.-]+\.cloudfront\.net\/[^/]+\/[a-z_]+\.jpg$/);
});

test('judgments made through the tools are the judgments the app would have stored', async () => {
  const { ctx, deck, clock } = ctxFor({ step: 0 }); // the clock moves only when this test moves it
  let app = FiveS.newState();
  for (let k = 0; k < 3; k++) {
    clock.t += 60000;
    const f = await call(ctx, 'next_five');
    app = FiveS.startFive(app, deck, clock.t);
    assert.deepEqual(f.data.cards.map((c) => c.card), app.five.ids, 'same five');
    for (const c of f.data.cards) {
      clock.t += 2400;
      const keep = c.card.endsWith('1') || c.card.endsWith('3') || c.card.endsWith('6');
      const j = await call(ctx, 'judge', { card: c.card, keep, ms: 1200 });
      const r = FiveS.judge(app, deck, c.card, keep, 1200, clock.t);
      app = r.state;
      assert.equal(!!j.data.turn, !!r.turn);
    }
  }
  const stored = (await call(ctx, 'get_state')).data.state;
  assert.deepEqual(stored.j, app.j);
  assert.deepEqual(stored.days, app.days);
  assert.equal(FiveS.seedCode(stored), FiveS.seedCode(app));
});

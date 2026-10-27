// "Let's play fives" through the tools: play_fives deals a round of five things together, judge records each,
// the reveals come after, and the same game plays in words where the round card can't show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ctxFor, gameCtx, call, playFives, ORIGIN, PAGE_DIR, PAGE_SECRET, DAY } from './helpers.mjs';
import { TOOLS, SERVER_INSTRUCTIONS, registerTools } from '../src/tools.js';
import { TOOL_META, pageKey, checkPage } from '../src/card.js';

const descOf = (name) => TOOLS.find((t) => t.name === name).description;
const stateOf = async (ctx) => (await call(ctx, 'get_state')).data.state;

/** Answer the round on show: rule(thing) -> keep; order(things) -> the order they are answered in. */
async function playRound(ctx, rule = () => true, order = (xs) => xs) {
  const p = await call(ctx, 'play_fives');
  const out = [];
  for (const t of order(p.data.things.slice())) out.push(await call(ctx, 'judge', { card: t.thing, keep: rule(t) }));
  return { p, out };
}

test('only play_fives answers to "let\'s play fives"; next_five sorts five pictures', () => {
  for (const t of TOOLS) assert.equal(/let'?s play fives/i.test(t.description), t.name === 'play_fives', t.name);
  assert.match(descOf('next_five'), /sort five pictures/);
  assert.doesNotMatch(descOf('next_five'), /play 5s/);
  assert.match(SERVER_INSTRUCTIONS, /To sort five pictures, call next_five/);
  assert.match(SERVER_INSTRUCTIONS, /When the person says let's play fives, call play_fives/);
  assert.match(descOf('play_fives'), /six Picture Poetry pages, so from the second game they repeat/);
  assert.match(descOf('play_fives'), /Go in stands you under cover beside them; four are rooms/);
  const added = SERVER_INSTRUCTIONS.split(/(?<=\.) /).filter((x) => /play_fives|sort five pictures|round card/.test(x));
  assert.equal(added.length, 4);
  for (const text of [descOf('play_fives'), ...added]) assert.doesNotMatch(text, /5s/, 'no new text writes the app\'s name');
});

test('play_fives without the catalogue or the Worker\'s links: plain words, and next_five still plays', async () => {
  const { ctx } = ctxFor();
  const r = await call(ctx, 'play_fives');
  assert.equal(r.isError, true);
  assert.equal(r.data.error, 'not set up');
  assert.match(r.summary, /isn't set up on this connector yet/);
  assert.equal((await call(ctx, 'next_five')).data.cards.length, 5);
  const noLinks = gameCtx();
  delete noLinks.ctx.urls;
  assert.equal((await call(noLinks.ctx, 'play_fives')).data.error, 'not set up');
});

test('play_fives: a round of five together, in the artist\'s order, no names; asked again it is the same round, nothing written', async () => {
  const { ctx, store, clock } = gameCtx();
  const p = await call(ctx, 'play_fives');
  assert.equal(p.isError, undefined, p.summary);
  assert.deepEqual(p.data.things.map((t) => t.kind), ['picture', 'line', 'space', 'page', 'word']);
  assert.deepEqual(p.data.things.map((t) => t.position), [1, 2, 3, 4, 5]);
  assert.deepEqual([p.data.game.round, p.data.game.of, p.data.game.judged, p.data.game.of_all, p.data.game.started_now], [1, 5, 0, 25, true]);
  assert.ok(Number.isInteger(p.data.game.seq) && p.data.game.seq > 0);
  assert.equal(p.data.assets, ORIGIN + '/s/');
  const [pic, line, space, page, word] = p.data.things;
  assert.match(pic.image, /^https:\/\//);
  assert.equal(pic.card_kind, 'image');
  assert.match(line.code, /^body \{/);
  assert.deepEqual([line.lang, line.where], ['css', 'a stylesheet']);
  assert.deepEqual([space.model, space.open], [ORIGIN + '/s/m/' + space.thing + '.json', ORIGIN + '/s/space?m=' + space.thing]);
  assert.equal(typeof space.room, 'boolean');
  assert.match(space.go_in, space.room ? /inside/ : /under cover/);
  assert.match(page.image, new RegExp('^' + ORIGIN + '/pp/' + page.thing + '\\.jpg\\?e=\\d+&s='));
  assert.equal(await checkPage(await pageKey(PAGE_SECRET), new URL(page.image), clock.t), page.thing + '.jpg', 'a link the Worker takes, for a day');
  assert.deepEqual([typeof page.wide, page.ground], ['boolean', '#eeeeee']);
  assert.match(word.word, /^[A-Z][a-z]+$/);
  assert.ok(p.data.things.every((t) => t.kept === null && t.reveal === undefined));
  // the words fallback: each thing as Claude can pass it on
  assert.ok(p.summary.includes(pic.image) && p.summary.includes(line.code) && p.summary.includes(space.open) && p.summary.includes(page.open) && p.summary.includes(word.word));
  assert.match(p.data.how_to, /own code block/);
  const rev = (await call(ctx, 'get_state')).data.rev, writes = [...store.map.values()].join('');
  const again = await call(ctx, 'play_fives');
  assert.deepEqual(again.data.things, p.data.things);
  assert.deepEqual([again.data.game.seq, again.data.game.started_now, again.data.game.dealt_now], [p.data.game.seq, false, false]);
  assert.equal((await call(ctx, 'get_state')).data.rev, rev, 'nothing written');
  assert.equal([...store.map.values()].join(''), writes);
});

test('no name before the answer in any kind, and the names after', async () => {
  const { ctx, deck } = gameCtx();
  const p = await call(ctx, 'play_fives');
  const before = JSON.stringify(p);
  const names = [];
  for (const t of p.data.things) {
    if (t.kind === 'picture' || t.kind === 'space') { const c = deck.cards.find((x) => x.id === t.thing); names.push(c.title, c.artist); }
    if (t.kind === 'page') { const pg = deck.things.pages.find((x) => x.id === t.thing); names.push(pg.title || 'Untitled', pg.place, pg.buildings[0].name, pg.relations[0]); }
    if (t.kind === 'line') names.push(deck.things.lines.find((x) => x.id === t.thing).does);
    if (t.kind === 'word') names.push(deck.things.words.find((x) => x.id === t.thing).parts);
  }
  for (const n of names.filter(Boolean)) assert.ok(!before.includes(n), 'before the answer: ' + n);
  const after = [];
  for (const t of p.data.things) after.push(await call(ctx, 'judge', { card: t.thing, keep: true }));
  for (const n of names.filter(Boolean)) assert.ok(JSON.stringify(after).includes(n), 'after: ' + n);
  const [pic, line, space, page, word] = after.map((r) => r.data.reveal);
  assert.ok(pic.title && pic.artist);
  assert.deepEqual([line.made, line.source], [false, 'A made-up project']);
  assert.match(line.does, /colour/);
  assert.ok(space.title && space.model && space.open && typeof space.room === 'boolean');
  assert.match(page.buildings[0].model, new RegExp('^' + ORIGIN + '/pp/m/p\\da\\.json\\?e='));
  assert.match(page.buildings[0].open, new RegExp('^' + ORIGIN + '/s/space\\?pp=p\\da&e='));
  assert.ok(page.relations.length && page.words.length);
  assert.ok(word.parts && word.text && word.language);
  // asked again: the answered things carry their answers and reveals
  const again = await call(ctx, 'play_fives');
  assert.equal(again.data.game.round, 2, 'the round was sorted: the next is dealt');
});

test('judge on a game thing: a second answer records nothing; a thing not on show is refused', async () => {
  const { ctx } = gameCtx();
  const p = await call(ctx, 'play_fives');
  const word = p.data.things[4];
  const first = await call(ctx, 'judge', { card: word.thing, keep: true });
  assert.deepEqual([first.data.kept, first.data.repeat, first.data.round.answered], [true, false, 1]);
  const rev = (await call(ctx, 'get_state')).data.rev;
  const typed = await call(ctx, 'judge', { card: word.thing, keep: false });   // "pass" typed in the chat after the card's Keep
  assert.deepEqual([typed.data.kept, typed.data.repeat], [true, true]);
  assert.match(typed.summary, /^Already answered: Kept/);
  assert.equal((await call(ctx, 'get_state')).data.rev, rev, 'nothing written');
  assert.equal(typed.data.reveal.word, word.word);
  const notOnShow = ['wchaos', 'wtime', 'wobject'].find((w) => !p.data.things.some((t) => t.thing === w));
  for (const id of [notOnShow, 'l004x', 'p6'].filter((x) => !p.data.things.some((t) => t.thing === x))) {
    const r = await call(ctx, 'judge', { card: id, keep: true });
    assert.equal(r.data.error, 'not on show', id);
    assert.match(r.summary, /isn't the thing on show\. Call play_fives/);
  }
  assert.equal((await call(ctx, 'get_state')).data.rev, rev);
});

test('a whole game over the tools: rounds sorted with the kept lines, the game sorted, then a new game', async () => {
  const { ctx } = gameCtx();
  const rounds = [];
  for (let r = 0; r < 5; r++) rounds.push(await playRound(ctx, (t) => t.kind !== 'space', (xs) => (r % 2 ? xs.reverse() : xs)));
  for (const [r, { p, out }] of rounds.entries()) {
    assert.equal(p.data.game.round, r + 1);
    const last = out[4].data, others = out.slice(0, 4);
    assert.ok(others.every((o) => o.data.round_sorted === null), 'sorted only with the fifth answer');
    assert.deepEqual([last.round_sorted.round, last.round_sorted.kept.length, last.round_sorted.passed.map((x) => x.kind)], [r + 1, 4, ['space']]);
    assert.equal(last.round_sorted.lines.length, 1, 'the kept line');
    assert.equal(last.round_sorted.lines[0].code, p.data.things[1].code);
    assert.equal(last.round_sorted.next, r < 4 ? 'play_fives' : null);
    if (r < 4) assert.match(out[4].summary, new RegExp('Round ' + (r + 1) + ' of 5 sorted: kept 4 of 5.*own code block.*call play_fives for round ' + (r + 2)));
  }
  assert.ok(rounds.slice(1).some(({ p }) => p.data.things.some((t) => t.kind === 'line' && /^l[a-z]{2}/.test(t.thing))), 'later rounds make lines from what was kept');
  const end = rounds[4].out[4];
  assert.deepEqual([end.data.game_sorted.kept, end.data.game_sorted.of], [20, 25]);
  assert.deepEqual(end.data.game_sorted.by_kind, { picture: 5, line: 5, space: 0, page: 5, word: 5 });
  assert.equal(end.data.game_sorted.lines.length, 5);
  assert.ok(end.data.game_sorted.from.length >= 4, 'what moved from round to round');
  assert.match(end.summary, /Game sorted: kept 20 of 25\. .*own code block.*The next play_fives starts a new game/);
  assert.equal(end.data.game_sorted.streak_days, 1);
  const st = await stateOf(ctx);
  assert.equal(st.j.length, 10, 'pictures and spaces in j, as Sort writes them');
  assert.deepEqual(st.days.length, 1, 'the day counted once');
  const next = await call(ctx, 'play_fives');
  assert.deepEqual([next.data.game.started_now, next.data.game.round, next.data.game.judged], [true, 1, 0]);
});

test('the reveal says where a thing came from, after the answer only', async () => {
  const { ctx } = gameCtx();
  await playRound(ctx, () => true);
  const p = await call(ctx, 'play_fives');
  assert.ok(p.data.things.every((t) => t.reveal === undefined), 'nothing of it before');
  const line = p.data.things[1];
  assert.match(line.thing, /^l[a-z]{2}/, 'round 2\'s line is made from round 1');
  const r = await call(ctx, 'judge', { card: line.thing, keep: true });
  assert.equal(r.data.reveal.made, true);
  assert.deepEqual([r.data.reveal.from.round, r.data.reveal.from.label], [1, 'From round 1']);
  assert.match(r.data.reveal.from.line, /^Made from a (picture|space|word) you kept in round 1: /);
  assert.doesNotMatch(r.summary, /Fixture/, 'names stay in data, never in the summary');
});

test('a game waits: another day the same round, "your game from" its day', async () => {
  const { ctx, clock } = gameCtx();
  const p = await call(ctx, 'play_fives');
  await call(ctx, 'judge', { card: p.data.things[0].thing, keep: true });
  clock.t += 3 * DAY;
  const later = await call(ctx, 'play_fives');
  assert.deepEqual(later.data.things.map((t) => t.thing), p.data.things.map((t) => t.thing));
  assert.equal(later.data.things[0].kept, true);
  assert.ok(later.data.things[0].reveal.title, 'an answered thing shows its reveal again');
  assert.match(later.data.game.from_day, /^\d{1,2} [A-Z][a-z]{2}$/);
  assert.match(later.summary, /^Your game of fives from \d{1,2} [A-Z][a-z]{2}: round 1 of 5, 1 of 5 answered\./);
});

test('judge on a deck card outside the game is unchanged; next_five plays beside a game', async () => {
  const { ctx } = gameCtx();
  const p = await call(ctx, 'play_fives');
  const f = await call(ctx, 'next_five');
  const loose = f.data.cards.find((c) => !p.data.things.some((t) => t.thing === c.card));
  const j = await call(ctx, 'judge', { card: loose.card, keep: true });
  assert.deepEqual([j.data.card, j.data.in_five, j.data.five.judged], [loose.card, true, 1]);
  assert.equal(j.data.repeat, undefined);
  assert.equal((await stateOf(ctx)).game.k, '-----', 'the game is left alone');
});

test('pageDir never leaves the Worker: no result carries it', async () => {
  const { ctx, store } = gameCtx();
  const outs = [];
  for (let r = 0; r < 5; r++) {
    const { p, out } = await playRound(ctx, (t) => t.position % 2 === 1);
    outs.push(p, ...out);
  }
  for (const name of ['get_state', 'get_taste', 'get_seed']) outs.push(await call(ctx, name));
  assert.ok(!JSON.stringify(outs).includes(PAGE_DIR));
  assert.ok(![...store.map.values()].join('').includes(PAGE_DIR));
});

test('a second game: pages seen before say so, and the words fallback says it too', async () => {
  const { ctx } = gameCtx();
  for (let r = 0; r < 5; r++) await playRound(ctx, () => true);
  const p = await call(ctx, 'play_fives');
  const page = p.data.things[3];
  assert.equal(page.seen_before, true, 'six pages, five a game: the second game repeats');
  assert.match(p.summary, /seen in an earlier game/);
  assert.match(p.data.how_to, /from the second game they repeat/);
});

test('over MCP: play_fives carries the round card\'s resource, and its result is the same in text and structuredContent', async () => {
  const { ctx } = gameCtx();
  const server = new McpServer({ name: 'test', version: 'test' }, { instructions: SERVER_INSTRUCTIONS });
  registerTools(server, async () => ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const { tools } = await client.listTools();
  const play = tools.find((t) => t.name === 'play_fives');
  assert.deepEqual(play._meta, TOOL_META);
  assert.equal(play._meta.ui.resourceUri, 'ui://fives/round.html');
  assert.ok(tools.filter((t) => t.name !== 'play_fives').every((t) => t._meta === undefined), 'no other tool carries it');
  const r = await client.callTool({ name: 'play_fives', arguments: {} });
  assert.equal(r.structuredContent.things.length, 5);
  assert.deepEqual(JSON.parse(r.content[1].text), r.structuredContent);
  const j = await client.callTool({ name: 'judge', arguments: { card: r.structuredContent.things[2].thing, keep: false } });
  assert.deepEqual([j.structuredContent.kind, j.structuredContent.kept], ['space', false]);
});

test('typed play still works beside the card: next_five\'s fives and a game share the store', async () => {
  const { ctx } = gameCtx();
  await playFives(ctx, 1);
  const p = await call(ctx, 'play_fives');
  assert.equal(p.data.things.length, 5);
  const st = await stateOf(ctx);
  assert.equal(st.five.i, 5, 'the five is as it was');
});

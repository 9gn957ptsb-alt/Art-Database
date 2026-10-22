// Bots that play Set's game, so the playtest can tune LEVELS (SPEC.md "Levels 1–30").
//   node 5s/test/sim.mjs [seeds=200] [levels=1-30] [bots=hint,smart]
// For each level and bot: win rate, mean moves left on a win, the stars (0/1/2/3) and the bar's verdict
// (wins >= 60 % for levels 1–10, >= 45 % for 11–20, >= 35 % for 21–30; 3 stars on 10–25 %).
// Pieces: the example taste on the built deck (5s/dist/deck.json), else the test fixture.
// No boosters are used. Boards are seeded as the app seeds them: '5s:' + n + ':' + plays. Levels run in
// parallel, one worker a core (200 boards, 30 levels and both bots: about 3 minutes on 4 cores).
//   hint:  plays FiveSMatch.hint(game): the swap whose first wave clears most (the playtest's bar).
//   smart: tries every counted swap and takes the best first wave by what a person can see: goal
//          progress, specials made, then cells cleared (never the cascades, which hang on the refill).
import { createRequire } from 'node:module';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const F = require(join(here, '..', 'src', 'engine.js'));
const M = require(join(here, '..', 'src', 'match.js'));
const built = join(here, '..', 'dist', 'deck.json');
const deck = JSON.parse(readFileSync(existsSync(built) ? built : join(here, 'fixture', 'deck.json'), 'utf8'));

const [seedsArg, levelsArg, botsArg] = process.argv.slice(2);
const SEEDS = Number(seedsArg) || 200;
const [from, to] = (levelsArg || '1-30').split('-').map(Number);
const BOTS = (botsArg || 'hint,smart').split(',');
const state = F.exampleState(deck, new Date(2026, 9, 22, 12).getTime());

function firstWave(steps) {
  const i = steps.findIndex((s) => s.e === 'wave' && s.n === 1);
  const j = steps.findIndex((s, k) => k > i && s.e === 'wave');
  return steps.slice(i + 1, j < 0 ? steps.length : j);
}

// The value of a swap's first wave: goal progress (each goal's share of what it still needs), then
// specials, then cells cleared; a combo or the mark counts as a special made.
function value(g, a, b) {
  const { game, steps } = M.swap(g, a, b), w = firstWave(steps);
  let v = 0;
  for (const s of w) {
    if (s.e === 'goal') { const x = g.goals[s.i]; if (x.type !== 'score') v += (100 * (s.have - x.have)) / Math.max(1, x.n - x.have); }
    if (s.e === 'make' || (s.e === 'fire' && s.sp.indexOf('+') > 0)) v += 8;
    if (s.e === 'clear') v += 1;
  }
  if (g.goals.some((x) => x.type === 'score')) v += (game.score - g.score) / 100;
  return v;
}
const BOT = {
  hint: (g) => M.hint(g),
  smart: (g) => {
    let best = null, bv = -Infinity;
    for (const [a, b] of M.moves(g)) for (const [x, y] of [[a, b], [b, a]]) { const v = value(g, x, y); if (v > bv) { bv = v; best = [x, y]; } }
    return best;
  },
};

const PIECES = {};
function play(n, bot, seed) {
  const lv = M.level(n);
  let g = M.newGame(lv, PIECES[lv.suits] || (PIECES[lv.suits] = M.pieces(state, deck, lv.suits)), '5s:' + n + ':' + seed);
  while (g.state === 'play') { const [a, b] = BOT[bot](g); g = M.swap(g, a, b).game; }
  const left = g.moves;
  if (g.state === 'won') g = M.finale(g).game;
  const r = M.result(g);
  return { won: r.won, stars: r.stars, left, score: r.score };
}

const pct = (x) => String(Math.round(100 * x)).padStart(3) + '%';
const bar = (n) => (n <= 10 ? 0.6 : n <= 20 ? 0.45 : 0.35);
function runLevel(n) {
  const lv = M.level(n), lines = [];
  const goals = lv.goals.map((x) => (x.type === 'collect' ? 'collect ' + x.n + ' ' + (x.kind || 'suit ' + x.suit) : x.type + (x.n ? ' ' + x.n : ''))).join(' + ');
  BOTS.forEach((bot, bi) => {
    const runs = [];
    for (let s = 0; s < SEEDS; s++) runs.push(play(n, bot, s));
    const won = runs.filter((r) => r.won), share = (k) => runs.filter((r) => r.stars === k).length / runs.length;
    const wins = won.length / runs.length, three = share(3);
    const verdict = (wins >= bar(n) ? 'ok' : 'hard') + ', 3*' + (three < 0.1 ? ' rare' : three > 0.25 ? ' common' : ' ok');
    const head = bi ? ''.padEnd(41) : (String(n).padStart(5) + '  ' + goals.slice(0, 27).padEnd(27) + String(lv.moves).padStart(6));
    const left = won.length ? (won.reduce((s, r) => s + r.left, 0) / won.length).toFixed(1) : '-';
    const score = Math.round(runs.reduce((s, r) => s + r.score, 0) / runs.length);
    lines.push(`${head} | ${bot.padEnd(5)} ${pct(wins)} ${left.padStart(5)} ${[0, 1, 2, 3].map((k) => pct(share(k))).join(' ')} ${String(score).padStart(6)}   ${verdict}`);
  });
  return lines;
}

if (isMainThread) {
  console.log(`${SEEDS} boards a level; pieces: the example taste (${M.pieces(state, deck, 5).suits.map((s) => s.label).join(', ')})`);
  console.log('level  goals                       moves | bot    wins  left   0*   1*   2*   3*  score   verdict');
  const t0 = Date.now(), levels = [], done = {};
  for (let n = from; n <= to; n++) levels.push(n);
  const workers = Math.min(availableParallelism(), levels.length);
  let next = from;
  for (let w = 0; w < workers; w++) {
    new Worker(new URL(import.meta.url), { argv: process.argv.slice(2), workerData: levels.filter((_, i) => i % workers === w) })
      .on('message', ({ n, lines }) => {
        done[n] = lines;
        while (done[next]) console.log(done[next++].join('\n'));
        if (next > to) console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      });
  }
} else for (const n of workerData) parentPort.postMessage({ n, lines: runLevel(n) });

// The Game Plan reflection (5s/gameplan/reflect.mjs): reading transcripts, the shared law and its power.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { session, stageOf, skill, power, words, facts, broken, reflect, report, selfCheck, moment } from '../gameplan/reflect.mjs';

const T = '2026-10-22T20:00:00Z'; // after ponytail and caveman joined
const local = [
  { type: 'user', timestamp: T, message: { role: 'user', content: 'Add api.artsy.net to the allowed domains' } },
  { type: 'assistant', timestamp: T, message: { content: [
    { type: 'text', text: 'Sure! Let me just check the network settings.' },
    { type: 'tool_use', id: 'a', name: 'Bash', input: { command: 'curl https://api.artsy.net' } },
  ] } },
  { type: 'user', timestamp: T, message: { content: [{ type: 'tool_result', tool_use_id: 'a', is_error: true, content: 'HTTP 403 Forbidden' }] } },
  { type: 'assistant', timestamp: T, message: { content: [
    { type: 'tool_use', id: 'b', name: 'Edit', input: { file_path: 'a.js', old_string: 'x', new_string: 'x\ny\nz' } },
    { type: 'tool_use', id: 'c', name: 'Bash', input: { command: 'node --test' } },
    { type: 'text', text: 'Domain not allowed yet: add it in the environment settings. Not checked: the import itself.' },
  ] } },
];
// The same first exchange as a remote session's events.
const remote = [
  { created_at: T, user: { internal_anthropic_catchall: { message: { content: [{ type: 'text', text: 'Add api.artsy.net to the allowed domains' }] } } } },
  { created_at: T, assistant: { internal_anthropic_catchall: { message: { content: [{ type: 'text', text: 'Done.' }] } } } },
  { created_at: T, result: { internal_anthropic_catchall: { total_cost_usd: 0.5, duration_ms: 1000, is_error: false } } },
];
const turn = (ask, reply, tools = [], at = T) => [
  { type: 'user', timestamp: at, message: { content: ask } },
  { type: 'assistant', timestamp: at, message: { content: [...tools.map((t, i) => ({ type: 'tool_use', id: ask + i, ...t })), { type: 'text', text: reply }] } },
];

test('local and remote transcripts read into the same turns', () => {
  const a = session(local, 'a'), b = session(remote, 'b');
  assert.equal(a.turns.length, 1);
  assert.equal(b.turns.length, 1);
  assert.equal(a.turns[0].ask, b.turns[0].ask);
  assert.equal(a.turns[0].tools[0].error, 'HTTP 403 Forbidden');
  assert.equal(b.turns[0].cost, 0.5);
});

test('a notification starts a turn but is not the person asking', () => {
  const s = session([{ type: 'user', timestamp: T, message: { content: '<task-notification>normal mode</task-notification>' } }]);
  assert.equal(s.turns[0].ask, '');
  assert.equal(s.turns[0].on.ponytail, true, 'a notification cannot switch a skill off');
});

test('each skill stays on until told otherwise; caveman waits to be asked', () => {
  const s = session([
    ...turn('go', 'ok', [], '2026-10-01T00:00:00Z'),
    ...turn('go', 'ok'),
    ...turn('<command-name>/caveman</command-name>', 'ok'),
    ...turn('stop ponytail', 'ok'),
    ...turn('normal mode', 'ok'),
  ].map((l, i) => ({ ...l, timestamp: l.timestamp.replace(/00Z$/, String(i).padStart(2, '0') + 'Z') })));
  assert.deepEqual(s.turns.map(t => `${t.on.ponytail ? 'P' : '-'}${t.on.caveman ? 'C' : '-'}`), ['--', 'P-', 'PC', '-C', '--']);
});

test('the road: an ask is placed on its stage', () => {
  assert.equal(stageOf('Add api.artsy.net to the allowed domains and the network').stage, 3);
  assert.equal(stageOf('Schedule a routine every other day').stage, 7);
  assert.equal(stageOf('hello'), null);
});

test('a skill refuses a cut that loses a kept thing', () => {
  const dropNot = skill(s => s.replace('not ', ''), s => s.match(/\bnot\b/g) || []);
  assert.equal(dropNot('it does not work'), 'it does not work');
});

test('a skill refuses a cut that does not shrink, so its power always stops', () => {
  const swap = skill(s => s.replace('a', 'b'), () => []);
  assert.equal(swap('a'), 'a');
  assert.equal(power(swap, 'aaa').n, 0);
  const twice = skill(s => s.replace(/ not/, ''), s => s.match(/\bnot\b/g) || []);
  assert.equal(twice('not not'), 'not not', 'two kept things are two, not one');
});

test('to the power: the cut runs until the reply stands still, and every fact survives', () => {
  const s = 'Sure! Let me just check it. Port 8080 is not open in `server.js` at /srv/app/server.js. Hope this helps!';
  const { x, n } = power(words, s);
  assert.equal(n, 4);
  for (const k of ['not', '8080', '`server.js`', '/srv/app/server.js']) assert.ok(x.includes(k), k);
  assert.equal(power(words, x).n, 0, 'a second pass removes nothing');
  assert.equal(power(words, 'That is not really it.').n, 0, 'a negated word is meaning, not filler');
});

test('a turn\'s facts: lines, checks, dependencies, shortcuts, the last line', () => {
  const f = facts(session(local).turns[0]);
  assert.equal(f.added, 3);
  assert.equal(f.removed, 1);
  assert.equal(f.tested, true);
  assert.equal(f.said, true);
  const t = { replies: ['You saved 40 lines.'], tools: [
    { name: 'Bash', input: { command: 'npm install left-pad' } },
    { name: 'Bash', input: { command: 'npm install' } },
    { name: 'Edit', input: { file_path: 'a.js', old_string: '', new_string: '// shortcut: linear scan, upgrade past 10k rows\n// shortcut: no cache' } },
  ] };
  const g = facts(t);
  assert.equal(g.installs, 1, 'restoring the lockfile is not a new dependency');
  assert.equal(g.untriggered, 1, 'only the shortcut that names no upgrade');
  assert.equal(g.claimsSaving, true);
});

test('laws are judged only while their skill is on', () => {
  const t = { replies: ['Sure! Done.'], tools: [{ name: 'Edit', input: { file_path: 'a.md', old_string: 'a', new_string: 'b' } }] };
  assert.deepEqual(broken({ ...t, on: { ponytail: false, caveman: false } }), []);
  assert.deepEqual(broken({ ...t, on: { ponytail: true, caveman: false } }), ['a change with no last line on what was skipped']);
  assert.deepEqual(broken({ ...t, on: { ponytail: false, caveman: true } }), ['ceremony a cut still removes']);
});

test('the reflection keeps the laws it measures, to the second power', () => {
  const rows = [reflect(session(local, 'a'), { title: 'Network access', created_at: T }), reflect(session(remote, 'b'))];
  assert.equal(rows[0].stage, 3);
  assert.deepEqual(rows[0].traps, [3]);
  assert.deepEqual(rows[0].laws, {}, 'ceremony is judged only once caveman is asked for');
  const md = report(rows);
  assert.equal(power(words, md).n, 0, 'the report is its own fixed point');
  assert.deepEqual(selfCheck(md), [], 'and breaks none of the laws it counts');
  assert.match(md.trim().split('\n').at(-1), /^Not checked:/, 'it ends with what it did not check');
  assert.doesNotMatch(md, /\bsaved\b/i, 'it counts; it never claims a saving it cannot measure');
});

test('the hook speaks only when there is something to say', () => {
  assert.equal(moment(session(local)), "Reflect: stage 3, Open the door; A proxy 403 is fixed in the environment's settings (allowed domains, a credential), not in the chat.");
  assert.equal(moment(session(remote)), 'Reflect: stage 3, Open the door.');
  assert.equal(moment(session([...turn('/caveman', 'Sure! Done.')])), 'Reflect: ceremony a cut still removes.');
  assert.equal(moment(session(turn('thanks', 'Done.'))), '');
  assert.equal(moment({ turns: [] }), '');
});

test('the script takes nothing it does not need: Node\'s own modules only', () => {
  const src = readFileSync(new URL('../gameplan/reflect.mjs', import.meta.url), 'utf8');
  for (const [, from] of src.matchAll(/^import .* from '([^']+)'/gm)) assert.match(from, /^node:/);
});

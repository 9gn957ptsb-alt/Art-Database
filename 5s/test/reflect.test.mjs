// The Game Plan reflection (5s/gameplan/reflect.mjs): reading transcripts, the shared law and its power.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { session, stageOf, skill, power, words, facts, broken, reflect, report, selfCheck, moment, load } from '../gameplan/reflect.mjs';

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
  assert.equal(b.cost, 0.5);
  const running = [...remote, { created_at: T, result: { total_cost_usd: 0.7 } }];
  assert.equal(session(running).cost, 0.7, 'a running total: the largest, not the sum');
  assert.equal(session(local).cost, null, 'no result events: unknown, not $0');
});

test('a subagent\'s work is its own, not the session\'s', () => {
  const sub = { created_at: T, assistant: { internal_anthropic_catchall: { parent_tool_use_id: 'x', message: { content: [{ type: 'tool_use', id: 's', name: 'Write', input: { file_path: 'b.js', content: 'a\nb' } }] } } } };
  assert.equal(session([...remote, sub]).turns[0].tools.length, 0);
});

test('a switch counts only when it opens what the person sent', () => {
  const s = session([...turn('npx skills add someone/caveman -g', 'ok'), ...turn('read .claude/skills/ponytail/SKILL.md', 'ok', [], '2026-10-01T00:00:00Z')]);
  assert.deepEqual(s.turns.map(t => t.on.caveman), [false, false]);
  assert.equal(s.turns.find(t => t.at.startsWith('2026-10-01')).on.ponytail, false);
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
  const more = session([...turn('/caveman', 'ok'), ...turn('stop caveman-review', 'ok'), ...turn('/ponytail lite', 'ok'), ...turn('/ponytail full', 'ok')]
    .map((l, i) => ({ ...l, timestamp: `2026-10-22T20:00:${String(i).padStart(2, '0')}Z` })));
  assert.deepEqual(more.turns.map(t => `${t.on.ponytail ? 'P' : '-'}${t.on.caveman ? 'C' : '-'}`), ['PC', 'PC', '-C', 'PC'], 'lite judges none of full\'s laws; a sibling\'s stop is not caveman\'s');
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
  assert.equal(power(words, "It doesn't really work.").n, 0, 'a contraction negates too');
  assert.equal(power(words, 'This is really slow. Let me know if it does not help.').n, 1, 'a refused cut does not hide the next');
  assert.equal(power(words, 'You cannot just copy the file.').n, 0);
  assert.equal(power(words, 'Two exports work. Let me know if you want the CSV or the JSON.').n, 0, 'a question offering a choice stays');
});

test('a turn\'s facts: lines, checks, dependencies, shortcuts, the last line', () => {
  const f = facts(session(local).turns[0]);
  assert.equal(f.added, 2, 'the unchanged line of an edit is not a change');
  assert.equal(f.removed, 0);
  assert.equal(f.tested, true);
  assert.equal(f.said, true);
  const t = { replies: ['You saved 40 lines.'], tools: [
    { name: 'Bash', input: { command: 'npm install left-pad' } },
    { name: 'Bash', input: { command: 'npm install' } },
    { name: 'Edit', input: { file_path: 'a.js', old_string: '', new_string: '// shortcut: linear scan, upgrade past 10k rows\n// shortcut: no cache' } },
  ] };
  const g = facts(t);
  assert.equal(g.unasked, 1, 'restoring the lockfile is not a new dependency');
  const asked = facts({ ask: 'Install sharp so the thumbnails resize', replies: [], tools: [{ name: 'Bash', input: { command: 'npm install sharp@0.33' } }] });
  assert.equal(asked.unasked, 0, 'a dependency the person asked for is never cut');
  const quoted = facts({ replies: [], tools: [{ name: 'Bash', input: { command: "cat > t.mjs <<'EOF'\nrun('npm install left-pad')\nEOF\ncd x && npm install sharp" } }] });
  assert.equal(quoted.unasked, 1, 'an install inside a heredoc is text, not an install');
  assert.equal(facts({ replies: ['Re-measured after the edit: saves 412 tokens per turn.'], tools: [] }).claimsSaving, false, 'a measured saving');
  const told = facts({ replies: ["I can't push: the remote denied access."], tools: [{ name: 'Bash', input: { command: 'git push' }, error: 'Permission denied' }] });
  assert.equal(told.failedUnsaid, false, 'a failure named in other words is said');
  assert.equal(g.untriggered, 1, 'only the shortcut that names no upgrade');
  assert.equal(g.claimsSaving, true);
  assert.equal(facts({ replies: ['All 15 favorites were saved.'], tools: [] }).claimsSaving, false, 'saved, as in stored');
  const ctx = Array.from({ length: 11 }, (_, i) => `line ${i}`).join('\n');
  const one = facts({ replies: [], tools: [{ name: 'Edit', input: { file_path: 'a.js', old_string: ctx + '\nx', new_string: ctx + '\ny' } }] });
  assert.deepEqual([one.added, one.removed, one.logic], [1, 1, 1]);
  const multi = facts({ replies: [], tools: [{ name: 'MultiEdit', input: { file_path: 'a.js', edits: [{ old_string: '', new_string: 'a\n// shortcut: no cache' }] } }] });
  assert.deepEqual([multi.added, multi.untriggered], [2, 1]);
  const read = facts({ replies: [], tools: [{ name: 'Bash', input: { command: 'cat test/a.test.mjs' } }, { name: 'Read', input: { file_path: 'test/a.test.mjs' } }] });
  assert.equal(read.tested, false, 'reading a test is not running one');
});

test('folders hold other folders, and saved pages join into one transcript', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reflect-'));
  mkdirSync(join(dir, 'a-session-folder'));
  const page = e => `Saved output:\n${JSON.stringify({ ccr: { data: e, has_more: false } })}\nend`;
  writeFileSync(join(dir, 'session_x.txt'), page(remote.slice(0, 2)) + page(remote.slice(2)));
  writeFileSync(join(dir, 'list.txt'), page([{ id: 'session_x', title: 'Network access', created_at: T }]));
  const { transcripts, meta } = load([dir]);
  assert.equal(transcripts.session_x.length, 3);
  assert.equal(meta.session_x.title, 'Network access');
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
  assert.equal(moment(session(local)), "Reflect: A proxy 403 is fixed in the environment's settings (allowed domains, a credential), not in the chat.");
  assert.equal(moment(session(remote)), '', 'placing a session on the road is the report\'s, not one ask\'s');
  assert.equal(moment(session([...turn('/caveman', 'Sure! Done.')])), 'Reflect: ceremony a cut still removes.');
  assert.equal(moment(session(turn('thanks', 'Done.'))), '');
  assert.equal(moment({ turns: [] }), '');
});

test('a usage limit cuts a turn off: a trap on the road, not a reply that skipped its last line', () => {
  const cut = { type: 'text', text: "You've hit your session limit · resets 2:10am (UTC)" };
  const edit = { type: 'tool_use', id: 'e', name: 'Edit', input: { file_path: 'a.js', old_string: 'x', new_string: 'y' } };
  const localCut = [
    { type: 'user', timestamp: T, message: { content: 'Fix the loop' } },
    { type: 'assistant', timestamp: T, message: { content: [{ type: 'text', text: 'Fixing it.' }, edit] } },
    { type: 'assistant', timestamp: T, isApiErrorMessage: true, apiError: 'usage_limit_reached', message: { model: '<synthetic>', content: [cut] } },
  ];
  const remoteCut = [
    { created_at: T, user: { internal_anthropic_catchall: { message: { content: [{ type: 'text', text: 'Fix the loop' }] } } } },
    { created_at: T, assistant: { internal_anthropic_catchall: { message: { content: [edit] } } } },
    { created_at: T, assistant: { internal_anthropic_catchall: { is_api_error_message: true, api_error: 'usage_limit_reached', message: { content: [cut] } } } },
    { created_at: T, result: { internal_anthropic_catchall: { is_error: true, result: cut.text } } },
  ];
  for (const lines of [localCut, remoteCut]) {
    const s = session(lines);
    assert.ok(!s.turns[0].replies.includes(cut.text), "the CLI's notice is not Claude's reply");
    assert.match(s.turns[0].failed, /session limit/, 'the result event keeps the notice, not a bare "error"');
    assert.deepEqual(broken(s.turns[0]), [], 'a turn cut off never got to write its last line');
    assert.deepEqual(reflect(s).traps, [7]);
    assert.match(moment(s), /every other day/);
  }
});

test('a change handed to background work owes its last line when the work comes back', () => {
  const at = i => `2026-10-22T20:00:0${i}Z`;
  const handOff = [
    { type: 'user', timestamp: at(0), message: { content: 'Review the loop' } },
    { type: 'assistant', timestamp: at(1), message: { content: [
      { type: 'tool_use', id: 'e', name: 'Edit', input: { file_path: 'a.js', old_string: 'x', new_string: 'y' } },
      { type: 'tool_use', id: 'w', name: 'Workflow', input: {} },
    ] } },
    { type: 'user', timestamp: at(2), message: { content: [{ type: 'tool_result', tool_use_id: 'w', content: 'Workflow launched in background. Task ID: w1' }] } },
    { type: 'assistant', timestamp: at(3), message: { content: [{ type: 'text', text: 'The reviewers are running.' }] } },
  ];
  const back = reply => [
    { type: 'user', timestamp: at(4), message: { content: '<task-notification><task-id>w1</task-id><status>completed</status></task-notification>' } },
    { type: 'assistant', timestamp: at(5), message: { content: [{ type: 'text', text: reply }] } },
  ];
  assert.equal(moment(session(handOff)), '', 'a progress note while the work runs is not judged');
  assert.deepEqual(broken(session([...handOff, ...back('Both reviews pass. Not checked: the phone layout.')]).turns.at(-1)), []);
  assert.deepEqual(broken(session([...handOff, ...back('Both reviews pass.')]).turns.at(-1)), ['a change with no last line on what was skipped'],
    'the turn the work came back to owes the line for the change made before it');
  const asked = session([...handOff, { type: 'user', timestamp: at(4), message: { content: 'thanks' } }, { type: 'assistant', timestamp: at(5), message: { content: [{ type: 'text', text: 'Ok.' }] } }]);
  assert.equal(asked.turns.at(-1).after, undefined, "the person's next ask is not the work coming back");
  assert.deepEqual(broken(asked.turns.at(-1)), [], 'and while that work is still out, no turn is judged on its last line');
});

test('the script takes nothing it does not need: Node\'s own modules only', () => {
  const src = readFileSync(new URL('../gameplan/reflect.mjs', import.meta.url), 'utf8');
  for (const [, from] of src.matchAll(/^import .* from '([^']+)'/gm)) assert.match(from, /^node:/);
});

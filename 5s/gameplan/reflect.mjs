#!/usr/bin/env node
// The 5s Game Plan, as code. It reads Claude Code session transcripts and bends them back on
// themselves: where each session stood on the Game Plan's road, which traps it met, and how its
// turns kept the laws of the two skills the artist added, ponytail (for code) and caveman (for words).
//
// What makes those two skills, and not style guides: each is a cut with a floor. Each stays on for the
// whole session, cuts what costs, keeps a floor no cut may touch (ponytail's never-cut list, caveman's
// verbatim payload), takes a cut only when it is smaller and loses nothing, names what it left out,
// and never claims a saving it did not measure.
//
//   node 5s/gameplan/reflect.mjs <transcript.jsonl | folder | list_sessions output> ...   Markdown
//   node 5s/gameplan/reflect.mjs --json ...                                              the same, as data
//   node 5s/gameplan/reflect.mjs --hook   (a Stop hook: the hook's JSON on stdin, one line out when there is news)
//
// It reads files and prints; nothing leaves the machine. The report holds counts, session titles and
// stage names, never what was said.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

// ---------------------------------------------------------------- the road (the Game Plan's seven stages)

// Each stage, the Game Plan's advice for it, the words that show a person walking it, and the error that
// shows they met its trap (the one that cost the artist hours there).
export const ROAD = [
  { stage: 1, name: 'Set up the workshop',
    advice: 'Make the repository with a README, so a main branch exists, and give it its final name now.',
    signs: /\b(github|repositor(y|ies)|branch(es)?|environment|clone|setup script)\b/gi,
    trap: /not found in the repository|no such branch|branch .* (not found|does not exist)|default branch/i },
  { stage: 2, name: 'Pick your first source',
    advice: 'Start from what you already chose, not the camera roll; never send a password.',
    signs: /\b(artsy|pinterest|are\.na|instagram|favou?rites?|saves|bookmarks?|sources?|photos?|export)\b/gi,
    trap: /camera roll|password/i },
  { stage: 3, name: 'Open the door',
    advice: "A proxy 403 is fixed in the environment's settings (allowed domains, a credential), not in the chat.",
    signs: /\b(allow(ed|list)?|domains?|network|proxy|credentials?|tokens?|api keys?|access)\b/gi,
    trap: /\b403\b|forbidden|not allowed|blocked by|proxy refused|ERR_PROXY/i },
  { stage: 4, name: 'Make it a database',
    advice: 'Put large files in Git LFS before the first big commit, and keep raw data out of a public repository.',
    signs: /\b(databases?|sqlite|normali[sz]e|schema|import|catalog(ue)?|split|genes?)\b/gi,
    trap: /\blfs\b|too large|exceeds? .*\bMB\b|file size/i },
  { stage: 5, name: 'Make your first thing',
    advice: 'Artifacts load no outside images and stop at 16 MB, so small images are carried inside.',
    signs: /\b(artifacts?|publish|page|website|html|canvas|game|world|model|sketchup|deck|app|animation|motion)\b/gi,
    trap: /\b16 ?MB\b|content security policy|\bCSP\b|external images?/i },
  { stage: 6, name: 'Name what it is',
    advice: "Keep a standing memory file: each piece's job in one line, and the rules you set.",
    signs: /\b(claude\.md|notes?|journal|morpholog\w*|names?|rename|spec|concept|glossary|readme)\b/gi,
    trap: /\brenamed?\b.*\b(broke|404)\b/i },
  { stage: 7, name: 'Keep it growing',
    advice: 'Daily passes spend the usage window by noon: pace them every other day.',
    signs: /\b(routines?|schedul\w*|cron|triggers?|actions?|sync|daily|hourly|every other day|loop)\b/gi,
    trap: /usage limit|rate limit|limit reached|resets at/i },
];

// Where an ask stood: the stage whose words fill it most (ties go to the later stage).
export function stageOf(text) {
  const counts = ROAD.map(r => (text.match(r.signs) || []).length);
  const best = Math.max(...counts);
  return best ? ROAD[counts.lastIndexOf(best)] : null;
}

// ---------------------------------------------------------------- reading transcripts

// Ponytail and caveman joined these sessions on 22 Oct 2026 (commits 4131fe8 and 5d05871).
export const SKILLS_ON = '2026-10-22T18:49:57Z';

// Each skill stays on until told otherwise (both SKILL.md files, line 17). Ponytail is on from this
// repository's CLAUDE.md; caveman's voice only once the person asks for it.
const ON = { ponytail: /\/ponytail(?![-\w])(?! off)/i, caveman: /\/(caveman|ultracave|megacave)(?![-\w])(?! status)|caveman mode|talk like (a )?caveman/i };
const OFF = { ponytail: /stop ponytail|\/ponytail off|normal mode/i, caveman: /stop caveman|normal mode/i };

// One line of a local transcript ({type, message}) or of a remote one ({created_at, <kind>: {...}}).
function event(o) {
  if (o.type) return o;
  const kind = Object.keys(o).find(k => k !== 'created_at');
  const v = o[kind] || {};
  return { type: kind, timestamp: o.created_at, ...(v.internal_anthropic_catchall || v) };
}

const blocks = m => (typeof m?.content === 'string' ? [{ type: 'text', text: m.content }] : m?.content || []);
const textOf = c => (typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join(' ') : '');

// A session as turns: each ask, the replies Claude wrote to it, the tools it ran, what failed, and which
// skills were on.
export function session(lines, id = '') {
  const turns = [];
  const byTool = new Map();
  const on = { ponytail: null, caveman: false };
  let turn = null;
  const open = (ask, at) => turns.push(turn = {
    ask, replies: [], tools: [], at, on: { ponytail: on.ponytail ?? at >= SKILLS_ON, caveman: on.caveman },
  });
  for (const e of lines.map(event).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))) {
    if (e.isSidechain || e.isMeta) continue;
    if (e.type === 'user') {
      const bs = blocks(e.message);
      const results = bs.filter(b => b.type === 'tool_result');
      for (const r of results) {
        const t = byTool.get(r.tool_use_id);
        if (t && r.is_error) t.error = textOf(r.content).slice(0, 400) || 'error';
      }
      const text = bs.filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (results.length || !text) continue;
      if (!/^\s*<(task-notification|system-reminder)/.test(text)) {
        for (const k in on) on[k] = OFF[k].test(text) ? false : ON[k].test(text) ? true : on[k];
      }
      // A notification, command or reminder starts a turn too, but it is not the person asking.
      open(/^\s*</.test(text) ? '' : text, e.timestamp);
    } else if (e.type === 'assistant') {
      if (!turn) open('', e.timestamp); // a transcript read from its middle
      for (const b of blocks(e.message)) {
        if (b.type === 'text' && b.text.trim()) turn.replies.push(b.text);
        if (b.type === 'tool_use') {
          const t = { name: b.name, input: b.input || {}, error: null };
          byTool.set(b.id, t);
          turn.tools.push(t);
        }
      }
    } else if (e.type === 'result' && turn) {
      turn.cost = (turn.cost || 0) + (e.total_cost_usd || 0);
      if (e.is_error) turn.failed = (e.errors || []).join(' ').slice(0, 400) || 'error';
    }
  }
  return { id: id || lines.map(event).find(e => e.sessionId)?.sessionId || '', turns };
}

// Files and folders → {transcripts: {id: lines}, meta: {id: session record}}.
export function load(paths) {
  const transcripts = {};
  const meta = {};
  const files = paths.flatMap(p => (statSync(p).isDirectory() ? readdirSync(p).map(f => join(p, f)) : [p]));
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    if (f.endsWith('.jsonl')) {
      transcripts[basename(f, '.jsonl')] = raw.split('\n').filter(Boolean).flatMap(l => {
        try { return [JSON.parse(l)]; } catch { return []; } // shortcut: a torn last line is skipped, not repaired
      });
    } else if (raw.includes('{"ccr"')) {
      const listing = jsonAt(raw, raw.indexOf('{"ccr"'));
      for (const s of listing?.ccr?.data || []) if (String(s.id).startsWith('session_')) meta[s.id] = s;
    }
  }
  return { transcripts, meta };
}

// The JSON value that starts at i, ignoring the text around it (a saved tool result wraps its JSON in prose).
function jsonAt(raw, i) {
  let depth = 0, inStr = false;
  for (let j = i; j < raw.length; j++) {
    const c = raw[j];
    if (inStr) { if (c === '\\') j++; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if ((c === '}' || c === ']') && --depth === 0) return JSON.parse(raw.slice(i, j + 1));
  }
  return null;
}

// ---------------------------------------------------------------- the law

// A skill (Old Norse skil, "distinction"; skilja, "to separate") tells apart what stays from what goes.
// It takes a cut only when the cut keeps every kept thing, counted, and makes the whole smaller:
// caveman-compress aborts on output that is not smaller, and caveman-learn reverts an edit that does not shrink.
export const skill = (cut, keep) => x => {
  const y = cut(x);
  const left = keep(y);
  const kept = keep(x).every(k => left.includes(k) && left.splice(left.indexOf(k), 1));
  return kept && y.length < x.length ? y : x;
};

// To the power: apply a skill to its own output until it stands still. It always stops, because every
// cut it takes is shorter than the last. The exponent n is how far the first draft stood from done.
export function power(f, x) {
  for (let n = 0; ; n++) {
    const y = f(x);
    if (y === x) return { x, n };
    x = y;
  }
}

// Words: caveman cuts ceremony one piece at a time ("Kill ceremony", its pre-send check). Kept: every
// negation, number, code span and path, the payload no cut may touch.
const CEREMONY = [
  /^\s*(sure|great question|absolutely|certainly|of course|happy to help|i'?d be happy to help)[!,.]*\s*/i,
  /^\s*(let me|i'?ll now|i will now|now i'?ll)\s+/i,
  /\s*(hope this helps|let me know if [^.!?]*|feel free to [^.!?]*)[.!]*\s*$/i,
  /(?<!\b(?:not|no|never|n't)\s)\b(just|really|basically|actually|simply)\s+/i,
];
const KEPT = /\b(?:not|never|no|only|except|without|cannot|can't|don't|doesn't|isn't|won't)\b|\d[\d.,:%]*|`[^`]+`|(?:\/[\w.-]+){2,}/gi;
export const words = skill(
  s => { for (const c of CEREMONY) if (c.test(s)) return s.replace(c, ''); return s; },
  s => (s.match(KEPT) || []).map(k => k.toLowerCase()),
);

// What a turn did, read off its tools and its last reply.
const count = s => (s ? String(s).split('\n').length : 0);
const prose = s => s.replace(/```[\s\S]*?```|`[^`\n]*`/g, ''); // code is payload, not prose
const CODE = /\.(m?js|cjs|ts|tsx|py|sh|rb|go|rs|java|swift|css|html)$/;
const INSTALL = /\b(?:npm (?:i|install|add)|pnpm add|yarn add|pip3? install|uv add|poetry add|cargo add|go get|gem install|bundle add)\s+(?!-)[@\w]/;
const TESTS = /\b(?:node --test|npm (?:run )?test|pytest|vitest|jest|unittest|go test|cargo test|assert)\b|\.test\.|_test\.|\btests?\//;
const SAID = /\b(?:skipp?ed|did ?n[o']t (?:check|test|run|verify)|not (?:checked|tested|verified|run)|untested|unchecked|left out|risk)/i;
const MARKER = /(?:#|\/\/|\/\*|--|<!--) ?(?:shortcut|ponytail):([^\n]*)/g;
const TRIGGER = /,.*\b(?:when|once|if|after|upgrade|beyond|past|over)\b|>/i;
// A saving is a claim with a unit: "saved" alone mostly means stored, in a database of saved artworks.
const UNIT = String.raw`(?:\d[\d,.]*\s*(?:%|percent|tokens?|lines?|dollars?|USD)\b|\$\s?\d)`;
const SAVING = new RegExp(String.raw`\bsav(?:e|ed|es|ings?)\b[^.\n]{0,40}${UNIT}|${UNIT}[^.\n]{0,25}\bsav(?:ed|es|ings?)\b`, 'i');
export function facts(turn) {
  const f = { added: 0, removed: 0, logic: 0, installs: 0, untriggered: 0, tested: false };
  for (const { name, input: i } of turn.tools) {
    const added = name === 'Edit' ? count(i.new_string) : name === 'Write' ? count(i.content) : 0;
    f.added += added;
    f.removed += name === 'Edit' ? count(i.old_string) : 0;
    if (CODE.test(i.file_path || '')) f.logic += added;
    for (const [m, rest] of String(i.new_string || i.content || '').matchAll(MARKER)) {
      if (!String(i.old_string || '').includes(m) && !TRIGGER.test(rest)) f.untriggered++;
    }
    if (name === 'Bash' && INSTALL.test(i.command || '')) f.installs++;
    if (TESTS.test(name === 'Bash' ? i.command || '' : i.file_path || '')) f.tested = true;
  }
  const last = turn.replies.at(-1) || '';
  f.edited = f.added + f.removed > 0;
  f.said = SAID.test(last.trim().split('\n').filter(Boolean).slice(-2).join(' '));
  f.failedUnsaid = Boolean(turn.tools.at(-1)?.error) && !/fail|error|could ?n[o']t|did ?n[o']t work|not work/i.test(last);
  f.claimsSaving = turn.replies.some(r => SAVING.test(prose(r)));
  return f;
}

// The laws, each from the family that states it, as a test a turn can fail. A law is judged only while
// its skill is on; the last two belong to both.
export const LAWS = {
  'ceremony a cut still removes': ['caveman', (t, f) => t.replies.some(r => power(words, r).n > 0)],
  'a change with no last line on what was skipped': ['ponytail', (t, f) => f.edited && !f.said],
  'new logic with no check run': ['ponytail', (t, f) => f.logic >= 10 && !f.tested],
  'a dependency added': ['ponytail', (t, f) => f.installs > 0],
  'a shortcut with no upgrade trigger': ['ponytail', (t, f) => f.untriggered > 0],
  'a failure left unsaid': ['ponytail caveman', (t, f) => f.failedUnsaid],
  'a saving nobody measured': ['ponytail caveman', (t, f) => f.claimsSaving],
};

// Which laws a turn broke, among those whose skill was on.
export function broken(turn) {
  const f = facts(turn);
  return Object.entries(LAWS)
    .filter(([, [family, test]]) => family.split(' ').some(k => turn.on?.[k]) && test(turn, f))
    .map(([law]) => law);
}

// ---------------------------------------------------------------- the reflection

// One session bent back on itself: where it stood on the road, which traps it met, how far its replies
// stood from their fixed point, and which laws its turns broke.
export function reflect(s, meta = {}) {
  const stage = stageOf(meta.title || '') || stageOf(s.turns.map(t => t.ask).join('\n')); // the person's own name first
  const errors = s.turns.flatMap(t => [...t.tools.map(x => x.error), t.failed]).filter(Boolean);
  const laws = {}, judged = {};
  for (const t of s.turns) {
    for (const [law, [family]] of Object.entries(LAWS)) if (family.split(' ').some(k => t.on[k])) judged[law] = (judged[law] || 0) + 1;
    for (const law of broken(t)) laws[law] = (laws[law] || 0) + 1;
  }
  return {
    id: s.id,
    title: meta.title || s.id,
    start: meta.created_at || s.turns[0]?.at || '',
    stage: stage?.stage || null,
    // read from its middle: the first event read came well after the session began
    partial: Boolean(meta.created_at && s.turns[0] && new Date(s.turns[0].at) - new Date(meta.created_at) > 15 * 60e3),
    errors: errors.length,
    traps: ROAD.filter(r => errors.some(e => r.trap.test(e))).map(r => r.stage),
    ...measure(s.turns),
    // a session can outlive the day the skills joined, so each turn is counted by its own time
    before: measure(s.turns.filter(t => t.at < SKILLS_ON)),
    after: measure(s.turns.filter(t => t.at >= SKILLS_ON)),
    laws,
    judged,
    cost: meta.external_metadata?.usage?.cost_usd ?? s.turns.reduce((n, t) => n + (t.cost || 0), 0),
  };
}

// Counts that add up across sessions: turns; replies and how many were already still; lines; code turns
// and how many ran a check.
function measure(turns) {
  const replies = turns.flatMap(t => t.replies);
  const all = turns.map(facts);
  const coding = all.filter(f => f.edited);
  return {
    turns: turns.length,
    replies: replies.length,
    still: replies.filter(r => power(words, r).n === 0).length,
    added: all.reduce((n, f) => n + f.added, 0),
    removed: all.reduce((n, f) => n + f.removed, 0),
    coding: coding.length,
    tested: coding.filter(f => f.tested).length,
  };
}

// ---------------------------------------------------------------- the report

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const day = iso => (iso ? new Date(iso).toISOString().slice(0, 10) : '—');
const add = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
const total = (rows, k, law) => rows.reduce((n, r) => n + (r[k][law] || 0), 0);

// The report ends the way ponytail asks every change to end: with what it did not check.
export const NOT_CHECKED = 'Not checked: whether each cut was the right one; the never-cut list (security, '
  + 'accessibility, validation); work done inside subagents; turns before a transcript was read from its middle. '
  + 'Nothing here measures what the skills spared: no session ran without them.';

export function report(rows) {
  rows = [...rows].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const read = rows.filter(r => r.turns);
  const out = [`# The road, reflected: ${rows.length} sessions, ${day(rows[0]?.start)} to ${day(rows.at(-1)?.start)}`, ''];
  out.push('| Stage | Sessions | Traps met |', '| --- | --- | --- |');
  for (const r of ROAD) out.push(`| ${r.stage}. ${r.name} | ${rows.filter(x => x.stage === r.stage).length} | ${rows.filter(x => x.traps.includes(r.stage)).length} |`);
  const met = ROAD.map(r => [r, read.filter(x => x.traps.includes(r.stage)).length]).sort((a, b) => b[1] - a[1])[0];
  if (met[1]) out.push('', `Most met trap: stage ${met[0].stage}, in ${met[1]} sessions. ${met[0].advice}`);
  out.push('', 'The laws, judged only on turns where their skill was on:', '', '| Law | From | Turns with its skill on | Broken |', '| --- | --- | --- | --- |');
  for (const [law, [family]] of Object.entries(LAWS)) out.push(`| ${law} | ${family.replace(' ', ' and ')} | ${total(read, 'judged', law)} | ${total(read, 'laws', law)} |`);
  out.push('', `Before and after ponytail and caveman joined (${SKILLS_ON.slice(0, 10)}), turn by turn: an observed time series, not a comparison with and without them.`, '');
  out.push('| | Turns | Replies already still | Lines added / removed | Code turns that ran a check |', '| --- | --- | --- | --- | --- |');
  for (const name of ['before', 'after']) {
    const p = read.map(r => r[name]);
    out.push(`| ${name[0].toUpperCase() + name.slice(1)} | ${read.reduce((n, r) => n + r[name].turns, 0)} | ${pct(add(p, 'still'), add(p, 'replies'))} | ${add(p, 'added')} / ${add(p, 'removed')} | ${pct(add(p, 'tested'), add(p, 'coding'))} |`);
  }
  out.push('', '| Date | Session | Stage | Turns | Errors | Replies still | Lines + / − | Laws broken | Cost (list price) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    const n = Object.values(r.laws).reduce((a, b) => a + b, 0);
    out.push(`| ${day(r.start)} | ${r.title} | ${r.stage || '—'} | ${r.turns ? r.turns + (r.partial ? '+' : '') : '—'} | ${r.turns ? r.errors : '—'} | ${pct(r.still, r.replies)} | ${r.turns ? `${r.added} / ${r.removed}` : '—'} | ${r.turns ? n : '—'} | $${(r.cost || 0).toFixed(2)} |`);
  }
  if (rows.some(r => r.partial)) out.push('', 'A + after the turns: the transcript was read from its middle, so only its later turns are counted.');
  out.push('', NOT_CHECKED);
  return out.join('\n');
}

// To the second power: the report, as one turn with both skills on, held to every law it measures. It
// breaks none and stands still under the cut, so reflecting it again changes nothing.
export const selfCheck = md => broken({ replies: [md], tools: [{ name: 'Write', input: { content: md } }], on: { ponytail: true, caveman: true } });

// ---------------------------------------------------------------- the hook: one line after each turn

// Reflection in the moment: speaks only when the last turn moved on the road, met a trap, or broke a law
// of a skill that is on ("Harness decides when you speak, caveman decides how").
export function moment(s) {
  const t = s.turns.at(-1);
  if (!t) return '';
  const asked = s.turns.filter(x => x.ask);
  const st = t.ask && stageOf(t.ask);
  const notes = [];
  if (st && st !== (asked.length > 1 && stageOf(asked.at(-2).ask))) notes.push(`stage ${st.stage}, ${st.name}`);
  notes.push(...broken(t));
  for (const r of ROAD) if (t.tools.some(x => x.error && r.trap.test(x.error))) notes.push(r.advice);
  return notes.length ? `Reflect: ${notes.join('; ')}`.replace(/[^.]$/, '$&.') : '';
}

if (process.argv[1]?.endsWith('reflect.mjs')) {
  const args = process.argv.slice(2);
  if (args[0] === '--hook') {
    try {
      const { transcript_path: path } = JSON.parse(readFileSync(0, 'utf8'));
      const line = moment(session(load([path]).transcripts[basename(path, '.jsonl')] || []));
      if (line) console.log(JSON.stringify({ systemMessage: line }));
    } catch {} // a reflection never stops a session
  } else {
    const { transcripts, meta } = load(args.filter(a => a !== '--json'));
    const ids = new Set([...Object.keys(transcripts), ...Object.keys(meta)]);
    const rows = [...ids].map(id => reflect(session(transcripts[id] || [], id), meta[id]));
    console.log(args.includes('--json') ? JSON.stringify(rows, null, 1) : report(rows));
  }
}

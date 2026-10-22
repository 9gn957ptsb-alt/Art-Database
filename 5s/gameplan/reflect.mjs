#!/usr/bin/env node
// The 5s Game Plan, as code. It reads Claude Code session transcripts and bends them back on
// themselves: where each session stands on the Game Plan's road, and how close its replies and
// changes come to the one law ponytail and caveman share.
//
//   node 5s/gameplan/reflect.mjs <transcript.jsonl | folder | list_sessions output> ...   Markdown
//   node 5s/gameplan/reflect.mjs --json ...                                              the same, as data
//   node 5s/gameplan/reflect.mjs --hook       (a Stop hook: reads the hook's JSON on stdin, prints one line)
//
// It reads files and prints; nothing leaves the machine. The report quotes no one: it holds counts,
// session titles and stage names, never what was said.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

// ---------------------------------------------------------------- the road (the Game Plan's seven stages)

// Each stage, the Game Plan's advice for it, the words that show a person was walking it, and the error
// that shows they met its trap (the one that cost the artist hours there).
export const ROAD = [
  { stage: 1, name: 'Set up the workshop', advice: 'Make the repository with a README, so a main branch exists, and give it its final name now.', signs: /\b(github|repositor(y|ies)|branch(es)?|environment|clone|setup script)\b/gi,
    trap: /not found in the repository|no such branch|branch .* (not found|does not exist)|default branch/i },
  { stage: 2, name: 'Pick your first source', advice: 'Start from what you already chose, not the camera roll; never send a password.', signs: /\b(artsy|pinterest|are\.na|instagram|favou?rites?|saves|bookmarks?|sources?|photos?|export)\b/gi,
    trap: /camera roll|password/i },
  { stage: 3, name: 'Open the door', advice: "A proxy 403 is fixed in the environment's settings (allowed domains, a credential), not in the chat.", signs: /\b(allow(ed|list)?|domains?|network|proxy|credentials?|tokens?|api keys?|access)\b/gi,
    trap: /\b403\b|forbidden|not allowed|blocked by|proxy refused|ERR_PROXY/i },
  { stage: 4, name: 'Make it a database', advice: 'Put large files in Git LFS before the first big commit, and keep raw data out of a public repository.', signs: /\b(databases?|sqlite|normali[sz]e|schema|import|catalog(ue)?|split|genes?)\b/gi,
    trap: /\blfs\b|too large|exceeds? .*\bMB\b|file size/i },
  { stage: 5, name: 'Make your first thing', advice: 'Artifacts load no outside images and stop at 16 MB, so small images are carried inside.', signs: /\b(artifacts?|publish|page|html|canvas|game|world|model|sketchup|deck|app|animation|motion)\b/gi,
    trap: /\b16 ?MB\b|content security policy|\bCSP\b|external images?/i },
  { stage: 6, name: 'Name what it is', advice: "Keep a standing memory file: each piece's job in one line, and the rules you set.", signs: /\b(claude\.md|notes?|journal|morpholog\w*|names?|rename|spec|concept|glossary|readme)\b/gi,
    trap: /\brenamed?\b.*\b(broke|404)\b/i },
  { stage: 7, name: 'Keep it growing', advice: 'Daily passes spend the usage window by noon: pace them every other day.', signs: /\b(routines?|schedul\w*|cron|triggers?|actions?|sync|daily|hourly|every other day|loop)\b/gi,
    trap: /usage limit|rate limit|limit reached|resets at/i },
];

// Where a session stood: the stage whose words fill its asks most (ties go to the later stage).
export function stageOf(text) {
  const counts = ROAD.map(r => (text.match(r.signs) || []).length);
  const best = Math.max(...counts);
  return best ? ROAD[counts.lastIndexOf(best)] : null;
}

// ---------------------------------------------------------------- reading transcripts

// One line of a local transcript ({type, message}) or of a remote one ({created_at, <kind>: {...}}).
function event(o) {
  if (o.type) return o;
  const kind = Object.keys(o).find(k => k !== 'created_at');
  const v = o[kind] || {};
  return { type: kind, timestamp: o.created_at, ...(v.internal_anthropic_catchall || v) };
}

const blocks = m => (typeof m?.content === 'string' ? [{ type: 'text', text: m.content }] : m?.content || []);
const textOf = c => (typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text || '').join(' ') : '');

// A session as turns: each human ask, the replies Claude wrote to it, the tools it ran, and what failed.
export function session(lines, id = '') {
  const turns = [];
  const byTool = new Map();
  let turn = null;
  for (const e of lines.map(event).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))) {
    if (e.isSidechain || e.isMeta) continue;
    if (e.type === 'user') {
      const bs = blocks(e.message);
      const results = bs.filter(b => b.type === 'tool_result');
      for (const r of results) {
        const t = byTool.get(r.tool_use_id);
        if (t && r.is_error) t.error = textOf(r.content).slice(0, 400) || 'error';
      }
      const ask = bs.filter(b => b.type === 'text').map(b => b.text).join('\n');
      // A notification, command or reminder starts a turn too, but it is not the person asking.
      if (!results.length && ask) turns.push(turn = { ask: /^\s*</.test(ask) ? '' : ask, replies: [], tools: [], at: e.timestamp });
    } else if (e.type === 'assistant') {
      if (!turn) turns.push(turn = { ask: '', replies: [], tools: [], at: e.timestamp }); // a transcript read from its middle
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
      turn.ms = (turn.ms || 0) + (e.duration_ms || 0);
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
      const [listing] = jsonAt(raw, raw.indexOf('{"ccr"'));
      for (const s of listing?.ccr?.data || []) if (String(s.id).startsWith('session_')) meta[s.id] = s;
    }
  }
  return { transcripts, meta };
}

// The JSON value that starts at i, ignoring whatever text follows it.
function jsonAt(raw, i) {
  let depth = 0, inStr = false;
  for (let j = i; j < raw.length; j++) {
    const c = raw[j];
    if (inStr) { if (c === '\\') j++; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if ((c === '}' || c === ']') && --depth === 0) return [JSON.parse(raw.slice(i, j + 1)), j + 1];
  }
  return [null, raw.length];
}

// ---------------------------------------------------------------- the law (what ponytail and caveman share)

// A skill (Old Norse skil, "distinction") tells apart what stays from what goes. Ponytail does it to
// code and caveman to words: each cuts what costs and refuses any cut that loses what counts.
export const skill = (cut, keep) => x => {
  const y = cut(x);
  return keep(x).every(k => keep(y).includes(k)) ? y : x; // a cut that drops a kept thing is not taken
};

// To the power: apply a skill to its own output until it stands still. The exponent it took is how
// far the first draft stood from done; a second pass that still cuts means the first was not done.
export function power(f, x, limit = 64) {
  for (let n = 0; n < limit; n++) {
    const y = f(x);
    if (y === x) return { x, n };
    x = y;
  }
  return { x, n: limit };
}

// Words: one piece of ceremony at a time (caveman's "Kill ceremony", ponytail's "a reply a busy human
// understands in one read"). Kept: every negation, number, code span and path.
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

// Code: what a turn changed, ran and said (ponytail's smallest complete change, its check, its last line).
const lines = s => (s ? String(s).split('\n').length : 0);
const INSTALL = /\b(?:npm (?:i|install|add)|pnpm add|yarn add|pip3? install|uv add|cargo add|gem install)\s+(?!-)[@\w]/;
const TESTS = /\b(?:node --test|npm (?:run )?test|pytest|vitest|jest|unittest|assert)\b|\.test\.|_test\.|\btests?\//;
const LAST_LINE = /\b(?:skipped|did ?n[o']t (?:check|test|verify)|not (?:checked|tested|verified)|untested|unchecked|left out|risk)/i;
export function change(turn) {
  let added = 0, removed = 0, shortcuts = 0, tested = false, installs = 0;
  for (const t of turn.tools) {
    const i = t.input;
    if (t.name === 'Edit') { added += lines(i.new_string); removed += lines(i.old_string); }
    if (t.name === 'Write') added += lines(i.content);
    shortcuts += (String(i.new_string || i.content || '').match(/shortcut: /g) || []).length;
    if (t.name === 'Bash' && INSTALL.test(i.command || '')) installs++;
    if (TESTS.test(t.name === 'Bash' ? i.command || '' : i.file_path || '')) tested = true;
  }
  const last = turn.replies.at(-1) || '';
  return { added, removed, shortcuts, installs, tested, said: LAST_LINE.test(last.slice(-400)) };
}

// ---------------------------------------------------------------- the reflection

// Ponytail and caveman joined these sessions on 22 Oct 2026 (commits 4131fe8 and 5d05871).
export const SKILLS_ON = '2026-10-22T18:49:57Z';

const median = xs => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : null);

// One session bent back on itself: where it stood on the road, which traps it met, how far its
// replies stood from their fixed point, and what its changes did.
export function reflect(s, meta = {}) {
  const asks = s.turns.map(t => t.ask).join('\n');
  const stage = stageOf(`${meta.title || ''}\n${asks}`);
  const errors = s.turns.flatMap(t => [...t.tools.map(x => x.error), t.failed]).filter(Boolean);
  const traps = ROAD.filter(r => errors.some(e => r.trap.test(e))).map(r => r.stage);
  const replies = s.turns.flatMap(t => t.replies);
  const cuts = replies.map(r => power(words, r).n);
  const changes = s.turns.map(change);
  const coding = changes.filter(c => c.added + c.removed > 0);
  const sum = k => changes.reduce((n, c) => n + c[k], 0);
  return {
    id: s.id,
    title: meta.title || s.id,
    start: meta.created_at || s.turns[0]?.at || '',
    stage: stage?.stage || null,
    turns: s.turns.length,
    // read from its middle: the first event read came well after the session began
    partial: Boolean(meta.created_at && s.turns[0] && new Date(s.turns[0].at) - new Date(meta.created_at) > 15 * 60e3),
    tools: s.turns.reduce((n, t) => n + t.tools.length, 0),
    errors: errors.length,
    traps,
    replies: replies.length,
    still: replies.length ? cuts.filter(n => n === 0).length / replies.length : null,
    exponent: median(cuts),
    added: sum('added'),
    removed: sum('removed'),
    installs: sum('installs'),
    shortcuts: sum('shortcuts'),
    tested: coding.length ? coding.filter(c => c.tested).length / coding.length : null,
    said: coding.length ? coding.filter(c => c.said).length / coding.length : null,
    cost: meta.external_metadata?.usage?.cost_usd ?? s.turns.reduce((n, t) => n + (t.cost || 0), 0),
  };
}

// ---------------------------------------------------------------- the report

const pct = x => (x == null ? '—' : `${Math.round(x * 100)}%`);
const day = iso => (iso ? new Date(iso).toISOString().slice(0, 10) : '—');
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function report(rows) {
  rows = [...rows].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const read = rows.filter(r => r.turns);
  const out = [`# The road, reflected: ${rows.length} sessions, ${day(rows[0]?.start)} to ${day(rows.at(-1)?.start)}`, ''];
  out.push('| Stage | Sessions | Traps met |', '| --- | --- | --- |');
  for (const r of ROAD) out.push(`| ${r.stage}. ${r.name} | ${rows.filter(x => x.stage === r.stage).length} | ${rows.filter(x => x.traps.includes(r.stage)).length} |`);
  const met = ROAD.map(r => [r, read.filter(x => x.traps.includes(r.stage)).length]).sort((a, b) => b[1] - a[1])[0];
  if (met && met[1]) out.push('', `Most met trap: stage ${met[0].stage}, ${met[1]} sessions. ${met[0].advice}`);
  out.push('', `Before and after ponytail and caveman (${SKILLS_ON.slice(0, 10)}), over the sessions whose transcripts were read:`, '');
  out.push('| | Sessions | Replies already still | Lines added / removed | Code turns tested | Code turns that say what was skipped |', '| --- | --- | --- | --- | --- | --- |');
  for (const [name, part] of [['Before', read.filter(r => r.start < SKILLS_ON)], ['After', read.filter(r => r.start >= SKILLS_ON)]]) {
    const sum = k => part.reduce((n, r) => n + r[k], 0);
    const w = k => mean(part.filter(r => r[k] != null).map(r => r[k]));
    out.push(`| ${name} | ${part.length} | ${pct(w('still'))} | ${sum('added')} / ${sum('removed')} | ${pct(w('tested'))} | ${pct(w('said'))} |`);
  }
  out.push('', '| Date | Session | Stage | Turns | Errors | Replies still | Lines + / − | Tested | Cost |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    out.push(`| ${day(r.start)} | ${r.title} | ${r.stage || '—'} | ${r.turns ? r.turns + (r.partial ? '+' : '') : '—'} | ${r.turns ? r.errors : '—'} | ${pct(r.still)} | ${r.turns ? `${r.added} / ${r.removed}` : '—'} | ${pct(r.tested)} | $${(r.cost || 0).toFixed(2)} |`);
  }
  if (rows.some(r => r.partial)) out.push('', 'A + after the turns: the transcript was read from its middle, so only its later turns are counted.');
  return out.join('\n');
}

// ---------------------------------------------------------------- the hook: one line after each turn

// Reflection in the moment: speaks only when the last turn moved on the road or broke the law.
export function moment(s) {
  const [prev, t] = s.turns.slice(-2).length === 2 ? s.turns.slice(-2) : [null, s.turns.at(-1)];
  if (!t) return '';
  const notes = [];
  const st = stageOf(t.ask);
  if (st && st !== (prev && stageOf(prev.ask))) notes.push(`stage ${st.stage}, ${st.name}`);
  const n = Math.max(0, ...t.replies.map(r => power(words, r).n));
  if (n) notes.push(`the reply stood still after ${n} cut${n > 1 ? 's' : ''}`);
  const c = change(t);
  if (c.installs) notes.push(`${c.installs} new dependenc${c.installs > 1 ? 'ies' : 'y'}`);
  if (c.added > 20 && !c.tested) notes.push(`${c.added} lines changed, no test run`);
  if (c.added + c.removed > 0 && !c.said) notes.push('no last line on what was skipped');
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

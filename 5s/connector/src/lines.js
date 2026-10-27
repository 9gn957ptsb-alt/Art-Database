/* Lines of code for fives: the made lines, and the check every line passes (curated ones too).
 * Pure: no DOM, no clock, no network. The curated lines are data (deck.things.lines, git-ignored).
 *
 * A made line turns a kept thing into a line: a picture's colours, its composition (card.comp) or its
 * feel (card.feel), or a word's root acted out. Its id says how to make it again, so only the id is saved:
 *   'l' + template + the deck card whose colours it uses + the word it acts out
 *   lgri002 (a gradient in i002's colours), lwvb001wlinearity (linearity's root in b001's colour), lwvwlinearity.
 * Only six-digit hex colours, numbers and words from the tables here reach a line: nothing anyone typed.
 * Every line has a file for its home: a stylesheet or a shader. None is pasted into a console.
 */

// A picture's composition, drawn on the page (or on every picture). A, B, C: its colours, light to dark.
const COMP = {
  'frame within frame': ['ff', (A, B, C) => `img { box-shadow: 0 0 0 .4em ${B}, 0 0 0 .8em ${A}, 0 0 0 1.2em ${C}; }`, 'every picture framed three times, frame within frame'],
  'stripes and bands': ['sb', (A, B, C) => `body { background: repeating-linear-gradient(${A} 0 1.5em, ${B} 0 2.5em, ${C} 0 3em); }`, 'the page in stripes and bands'],
  'rings and whorls': ['rw', (A, B, C) => `body { background: repeating-radial-gradient(circle at 50% 60%, ${A} 0 .8em, ${B} 0 1.6em, ${C} 0 2em); }`, 'the page in rings'],
  'radiating': ['rd', (A, B) => `body { background: repeating-conic-gradient(from 10deg at 50% 100%, ${A} 0 6deg, ${B} 0 12deg); }`, 'the page in rays rising from its foot'],
  'a grid': ['gd', (A, B, C) => `body { background: linear-gradient(90deg, ${C} 2px, #0000 0) 0 0 / 3em 3em, linear-gradient(${C} 2px, #0000 0) 0 0 / 3em 3em, ${B}; }`, 'the page ruled in a grid'],
  'a low horizon, big sky': ['hz', (A, B, C) => `body { background: linear-gradient(to top, ${C} 0 16%, ${B} 0 17%, ${A} 0); }`, 'the page as a low horizon under a big sky'],
  'an arch overhead': ['ah', (A, B) => `img { border-radius: 50% 50% 0 0 / 38% 38% 0 0; border: .6em solid ${B}; border-bottom: 0; background: ${A}; }`, 'every picture under an arch'],
  'a strong centre': ['sc', (A, B, C) => `body { background: radial-gradient(circle, ${C} 0 14%, #0000 14.5%), ${A}; }`, 'one strong dot in the middle of the page'],
  'tall uprights': ['tu', (A, B) => `body { background: repeating-linear-gradient(90deg, ${A} 0 .4em, ${B} 0 2.6em); }`, 'the page in tall uprights'],
  'a diagonal pull': ['dp', (A, B, C) => `body { background: linear-gradient(118deg, ${A} 0 46%, ${B} 0 54%, ${C} 0); }`, 'the page cut on a diagonal'],
  'allover': ['al', (A, B, C) => `body { background: radial-gradient(${A} 18%, #0000 19%) 0 0 / 1.1em 1.1em, radial-gradient(${B} 18%, #0000 19%) .55em .55em / 1.1em 1.1em, ${C}; }`, 'the page dotted all over'],
};

// A picture's feel, as a filter on every picture.
const FEEL = {
  'muted': 'saturate(.55) contrast(.92)', 'loud colour': 'saturate(1.8) contrast(1.1)', 'dreamlike': 'blur(1px) saturate(1.3) hue-rotate(-12deg)',
  'after dark': 'brightness(.6) contrast(1.15)', 'airy': 'brightness(1.12) contrast(.86)', 'bright noon': 'brightness(1.1) contrast(1.15)',
  'warm earth': 'sepia(.35) saturate(1.1)', 'cool hush': 'hue-rotate(-20deg) saturate(.7)', 'lonely': 'grayscale(.6) contrast(1.05)',
};

// A word's root (its base family in Morphology Web) acted out. C: the most vivid kept colour, or the text's own.
const VERB = {
  tendere: [(C) => `h1 { color: ${C}; transition: letter-spacing 1.2s; } h1:hover { letter-spacing: .5em; }`, 'headings stretch apart when pointed at (tendere, to stretch)'],
  frangere: [() => 'img { clip-path: polygon(0 0, 62% 0, 48% 38%, 100% 22%, 100% 100%, 0 100%); }', 'every picture broken along a jagged edge (frangere, to break)'],
  pendere: [() => '@keyframes hang { from { rotate: -3deg } to { rotate: 3deg } } img { transform-origin: 50% 0; animation: hang 2.4s ease-in-out infinite alternate; }', 'every picture hangs and sways from its top edge (pendere, to hang)'],
  temnein: [(C) => `p { columns: 2; column-rule: 1px solid ${C}; }`, 'text cut in two columns, with a rule between (temnein, to cut)'],
  vertere: [() => 'img { transition: rotate 1s; } img:hover { rotate: 1turn; }', 'pictures turn right round when pointed at (vertere, to turn)'],
  linea: [(C) => `p { text-decoration: underline wavy ${C} 1px; text-underline-offset: .3em; }`, 'a wavy line under the text (linea, a thread)'],
  capere: [() => 'img { cursor: grab; transition: scale .3s; } img:active { cursor: grabbing; scale: 1.05; }', 'pictures can be taken hold of: they grow a little when pressed (capere, to take)'],
  simul: [() => 'body { display: grid; } body > * { grid-area: 1 / 1; }', 'everything on the page in one place at once (simul, at the same time)'],
  spatium: [() => 'body { letter-spacing: .2em; word-spacing: 1em; line-height: 2.2; }', 'room between the letters, the words and the lines (spatium, room)'],
  iris: [() => 'img { animation: iris 6s linear infinite; } @keyframes iris { to { filter: hue-rotate(1turn); } }', 'pictures run through the rainbow (iris, the rainbow)'],
  khaos: [() => 'img { transition: scale 2s; } img:hover { scale: 0; }', 'pictures fall into nothing when pointed at (khaos, the gaping void)'],
  kolla: [() => 'img { rotate: -2deg; box-shadow: .2em .3em 0 #0003; margin: -1em; }', 'pictures glued on askew, with a shadow (kolla, glue)'],
};

export const WHERE = Object.freeze({ css: 'a stylesheet', glsl: 'a shader (Shadertoy: a new shader, replace mainImage)' });
export const TEMPLATES = Object.freeze(['gr', 'gl', 'fl', 'wv', ...Object.values(COMP).map(([t]) => t)]);
export const MADE = /^l([a-z]{2})([bcimosu]\d{1,6})?(w[a-z]{1,20})?$/;   // a made line's id

const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = rgb(h); return 0.3 * r + 0.59 * g + 0.11 * b; };
const chroma = (h) => Math.max(...rgb(h)) - Math.min(...rgb(h));
const unit = (h) => 'vec3(' + rgb(h).map((v) => +(v / 255).toFixed(3)).join(', ') + ')';

/** The line a template makes from a kept card and/or word, before the check: {line, lang, does} | null. */
export function draft(t, card, word) {
  const cs = (card && Array.isArray(card.colours) ? card.colours : []).filter((c) => typeof c === 'string' && HEX.test(c))
    .map((c) => c.toLowerCase()).sort((a, b) => lum(b) - lum(a)).slice(0, 3);
  while (cs.length && cs.length < 3) cs.push(cs[cs.length - 1]);
  const [A, B, C] = cs;
  const has = (k, x) => !!card && Array.isArray(card[k]) && card[k].includes(x);
  if (t === 'wv') {
    const fam = word && (word.families || []).find((f) => VERB[f]);
    if (!fam) return null;
    const ink = A ? cs.slice().sort((a, b) => chroma(b) - chroma(a))[0] : 'currentColor';
    return { line: VERB[fam][0](ink), lang: 'css', does: VERB[fam][1] };
  }
  if (word || !A) return null;   // the other templates are made from a card's colours alone
  if (t === 'gr') return { line: `body { background: linear-gradient(135deg, ${A}, ${B}, ${C}); }`, lang: 'css', does: 'the page in one gradient of those colours' };
  if (t === 'gl') {
    return { line: `void mainImage(out vec4 o, in vec2 p) { float y = p.y / iResolution.y; o = vec4(mix(mix(${unit(C)}, ${unit(B)}, smoothstep(0.0, 0.5, y)), ${unit(A)}, smoothstep(0.5, 1.0, y)), 1.0); }`,
      lang: 'glsl', does: 'those colours as light rising through a shader, dark at the foot' };
  }
  if (t === 'fl') {
    const f = Object.keys(FEEL).find((x) => has('feel', x));
    return f ? { line: `img { filter: ${FEEL[f]}; }`, lang: 'css', does: `every picture made to feel ${f}` } : null;
  }
  const hit = Object.entries(COMP).find(([, [c]]) => c === t);
  return hit && has('comp', hit[0]) ? { line: hit[1][1](A, B, C), lang: 'css', does: `${hit[1][2]}, in those colours` } : null;
}

/** lineFor(t, card, word) -> {id, line, lang, where, does, card, word} | null. card: a deck card; word: deck.things.words[n]. */
export function lineFor(t, card, word) {
  const d = TEMPLATES.includes(t) ? draft(t, card, word) : null;
  if (!d || safe(d.line)) return null;
  const id = 'l' + t + (card ? card.id : '') + (word ? word.id : '');
  if (!MADE.test(id) || id.length > 25) return null;
  return { id, line: d.line, lang: d.lang, where: WHERE[d.lang], does: d.does, card: card ? card.id : null, word: word ? word.id : null };
}

/** madeLine(id, get) -> the made line again from its id, or null. get(id): the deck card or word with that id, or null. */
export function madeLine(id, get) {
  const m = MADE.exec(id || '');
  if (!m || (!m[2] && !m[3])) return null;
  const card = m[2] ? get(m[2]) : null, word = m[3] ? get(m[3]) : null;
  if ((m[2] && !card) || (m[3] && !word)) return null;
  const l = lineFor(m[1], card, word);
  return l && l.id === id ? l : null;
}

// One line; nothing that reaches the network, storage, cookies, other windows, or runs text as code.
const DENY = [
  [/[\r\n\u2028\u2029]/, 'more than one line'],
  [/`/, 'a backtick'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|navigator|cookie|localStorage|sessionStorage|indexedDB|postMessage|eval|innerHTML|outerHTML|insertAdjacentHTML|srcdoc)\b|\b(import|require|open|Function|write|setTimeout|setInterval)\s*\(|(window|document|self|top|parent)\s*\.\s*location|location\s*\.\s*(href|assign|replace)/, 'reaches outside the page or runs text as code'],
  [/@import|url\s*\(|image-set\s*\(|\bsrc\s*=|\bhref\s*=|javascript:|<script|<style|<iframe|<object|<embed|<foreignObject|\bon[a-z]+\s*=/i, 'loads something or runs a handler'],
  [/[a-z][a-z0-9+.-]*:\/\/|\/\/[a-z0-9-]+\.[a-z]/i, 'names an address'],
  [/\b(os|sys|subprocess|socket|urllib|requests|shutil|system|exec|spawn|popen)\b|\b(File|IO|Dir|Net|Kernel|UI\.openURL)\b/, 'reaches the machine'],
];
/** safe(line) -> null when the line may be shown and copied, else the reason it is refused. */
export function safe(line) {
  if (typeof line !== 'string' || !line.trim()) return 'empty';
  if (line.length > 400) return 'too long for one line';
  const bare = line.split('xmlns="http://www.w3.org/2000/svg"').join('');   // SVG's namespace is a name, not a request
  for (const [re, why] of DENY) if (re.test(bare)) return why;
  return null;
}

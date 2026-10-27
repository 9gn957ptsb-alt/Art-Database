#!/usr/bin/env node
/* npm run things: the fives catalogue (lines, words, pages, spaces, the picture-to-word matches) from the
 * artist's material in data/5s/fives/, into data/5s/things.json (read by npm run deck) and public/ (the
 * Worker's static files: the models by deck id, the pages under a folder name only the Worker knows).
 * Everything it reads and writes is git-ignored: data/ by the repo, public/ by the connector.
 *
 *   node scripts/build-things.mjs [--in DIR] [--deck PATH] [--out PATH] [--public DIR]
 *
 * --in      the inputs (default data/5s/fives/):
 *             morphology.html        the saved Morphology Web page (only parts, roots and public links are read)
 *             lines.json             the curated lines, reviewed by hand: id, lang, where, line, does, source
 *             pics.json              a picture's composition or feel -> the word it leads to
 *             spaces.json            deck id -> grade (A, A room, B, C) for the bookmark buildings with a model
 *             models/<slug>.json     their models (docs/v2/models/ on the artist website branch); models.js beside them
 *             models/pp-<key>.json   the pages' buildings; pages/pages.json and pages/page-N.jpg, the six pages
 *             pages/dir              the pages' folder name (made once, 32 hex; keep it)
 * --deck    the app's built deck (default 5s/dist/deck.json): ids, kinds, colours, comp and feel
 * --out     default data/5s/things.json
 * --public  default 5s/connector/public/ (this writes s/models.js, s/space.html, s/space.js, s/m/, pp/ and _headers; nothing else there)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { safe, lineFor, madeLine, TEMPLATES } from '../src/lines.js';

const here = dirname(fileURLToPath(import.meta.url));
const CONNECTOR = resolve(here, '..');
const REPO = resolve(CONNECTOR, '..', '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : fallback; };
const IN = arg('--in', join(REPO, 'data', '5s', 'fives'));
const DECK = arg('--deck', join(REPO, '5s', 'dist', 'deck.json'));
const OUT = arg('--out', join(REPO, 'data', '5s', 'things.json'));
const PUB = arg('--public', join(CONNECTOR, 'public'));

const refuse = (why) => { console.error('npm run things refused: ' + why); process.exit(1); };
const json = (p) => JSON.parse(readFileSync(join(IN, p), 'utf8'));
for (const p of [DECK, join(IN, 'morphology.html'), join(IN, 'lines.json'), join(IN, 'pics.json'), join(IN, 'spaces.json'), join(IN, 'pages', 'pages.json')]) {
  if (!existsSync(p)) refuse(`no ${p}. The inputs are gathered once into data/5s/fives/ (see the connector README); the deck is python3 5s/build_deck.py.`);
}
const deck = JSON.parse(readFileSync(DECK, 'utf8'));
const card = new Map(deck.cards.map((c) => [c.id, c]));
const bad = deck.cards.find((c) => /^[lpw]/.test(c.id));
if (bad) refuse(`deck id ${bad.id} starts with l, p or w, which the fives' lines, pages and words use.`);

// ---------------------------------------------------------------- words: Morphology Web, its public parts only

const html = readFileSync(join(IN, 'morphology.html'), 'utf8');
const a = html.indexOf('const LANGS'), b = html.indexOf('const byId');
if (a < 0 || b < a) refuse('morphology.html has no LANGS ... byId block.');
const M = vm.runInNewContext(html.slice(a, b) + '\n;({LANGS, TERMS, LINKS, M})', {}, { timeout: 2000 });
// Never kept: DIM (the artist's own definitions), ROOTS prose (it quotes the dialogue), 'note' links (drawn from the artist's writing).
const author = (/\/\/\s*([A-Z][a-z]+)'s own definitions/.exec(html) || [])[1] || null;   // checked against every output, never written
if (!author) console.warn('things: no author line found in morphology.html; the name check is off.');
const PUBLIC = ['root', 'prefix', 'image'], SAY = { root: 'Same root as', prefix: 'Same prefix as', image: 'The same picture as' };
const plain = (f) => f.replace(/-/g, '');
const keepOf = (ms) => ms.filter((m) => m[1] === 'b' || m[2] === 'neg').map((m) => m[2]);
function shed(x) {   // the page's own law: drop the outermost suffix, else the first prefix, while every base stays
  const s = x.findLastIndex((m) => m[1] === 's'), p = x.findIndex((m) => m[1] === 'p'), k = s >= 0 ? s : p;
  const y = k < 0 ? x : x.filter((_, n) => n !== k), left = keepOf(y);
  const kept = keepOf(x).every((q) => left.includes(q) && left.splice(left.indexOf(q), 1));
  return kept && y.length < x.length ? y : x;
}
const spiritOf = (ms) => { let x = ms; for (let y; (y = shed(x)) !== x;) x = y; return x; };
const terms = M.TERMS.map(([id, label, lang]) => {
  const ms = M.M[id] || [];
  return { id, label, lang: M.LANGS[lang]?.name || lang, parts: ms.map((m) => plain(m[0])).join('·'),
    spirit: spiritOf(ms).map((m) => plain(m[0]) + ' ‘' + m[3].replace(/\bmold/g, 'mould') + '’').join(' + '),   // British spelling
    families: [...new Set(ms.filter((m) => m[1] === 'b').map((m) => m[2]))],
    links: M.LINKS.filter((l) => (l[0] === id || l[1] === id) && PUBLIC.includes(l[2]) && l[0] !== 'morphology' && l[1] !== 'morphology')
      .map(([s, t, type, why]) => ({ to: s === id ? t : s, type, why: String(why || '').split(':')[0] })) };
});
const term = new Map(terms.map((t) => [t.id, t]));
const words = terms.filter((t) => t.id !== 'morphology').map((t) => {   // "morphology" is the web's own name: kept back
  const link = PUBLIC.map((k) => t.links.find((l) => l.type === k)).find(Boolean);
  const fam = terms.filter((x) => x.id !== t.id && x.id !== 'morphology' && x.families.some((f) => t.families.includes(f))).map((x) => x.id);
  return { id: 'w' + t.id, face: t.label, lang: t.lang, parts: t.parts, families: t.families,
    reveal: `${t.parts.includes('·') ? t.parts + ': ' : ''}${t.lang}, ${t.spirit}.` + (link ? ` ${SAY[link.type]} ${term.get(link.to).label.toLowerCase()} (${link.why}).` : ''),
    leads: [...new Set(t.links.map((l) => l.to).concat(fam))].map((x) => 'w' + x) };
});
const word = new Map(words.map((w) => [w.id, w]));
assert.equal(words.length, 80, 'Morphology Web has 80 words besides its name');
for (const w of words) {
  if (!/^w[a-z]{1,20}$/.test(w.id)) refuse(`word id ${w.id}`);
  if (/[“”"]/.test(w.reveal)) refuse(`${w.id}'s reveal quotes a sentence`);
}
assert.equal(word.get('wattention').reveal, 'at·tent·ion: Latin, tent ‘stretch’. Same root as intend (tendere, to stretch toward).');

// ---------------------------------------------------------------- lines: curated (by hand) and made (lines.js)

const lines = json('lines.json').map((l) => ({ id: l.id, lang: l.lang, where: l.where, line: l.line, does: l.does, source: l.source }));
const seenLine = new Set();
for (const l of lines) {
  if (!/^l\d{3}$/.test(l.id) || seenLine.has(l.id)) refuse(`curated line id ${l.id}: l and three digits, once each`);
  seenLine.add(l.id);
  if (!['css', 'html', 'glsl'].includes(l.lang)) refuse(`${l.id}: lang must be css, html or glsl (a line's home is a file, never a console)`);
  for (const k of ['where', 'does', 'source']) if (typeof l[k] !== 'string' || !l[k].trim()) refuse(`${l.id} has no ${k}`);
  const why = safe(l.line);
  if (why) refuse(`${l.id} is not safe to paste: ${why}`);
}
if (!lines.length) refuse('no curated lines');
// Every line a template can make from the deck and the words passes the check, and its id makes it again.
const get = (id) => card.get(id) || word.get(id) || null;
let made = 0;
const tried = (t, c, w) => { const l = lineFor(t, c, w); if (!l) return; made++; if (madeLine(l.id, get)?.line !== l.line) refuse(`made line ${l.id} does not make itself again`); };
for (const c of deck.cards) for (const t of TEMPLATES) if (t !== 'wv') tried(t, c, null);
const verbs = words.filter((w) => lineFor('wv', null, w));
for (const w of verbs) { tried('wv', null, w); for (const c of deck.cards) tried('wv', c, w); }

// ---------------------------------------------------------------- the picture-to-word matches

const used = new Set(deck.cards.flatMap((c) => (c.comp || []).concat(c.feel || [])));
const pics = Object.fromEntries(Object.entries(json('pics.json')).filter(([k]) => k !== '_').map(([k, v]) => {
  if (!used.has(k)) refuse(`pics.json: "${k}" is no composition or feel in the deck`);
  if (!word.has('w' + v)) refuse(`pics.json: "${v}" is not a word`);
  return [k, 'w' + v];
}));

// ---------------------------------------------------------------- served models: only what models.js reads

const TOKEN = /^[a-z0-9+-]{1,24}$/;   // material names, part shapes, axes: anything longer could be a name
function strip(spec, what) {
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.parts)) refuse(`${what} is not a model`);
  const out = { voxel: spec.voxel, site: spec.site, ground: spec.ground, parts: spec.parts };
  (function walk(v, path) {
    if (typeof v === 'string' && !TOKEN.test(v)) refuse(`${what}: the text at ${path} could name something; a served model holds only material and shape words`);
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (/^(slug|name|notes?|lat|lon|lng|title|label|place|where|url)$/i.test(k)) refuse(`${what}: ${path}.${k} may not be served`);
      walk(x, path + '.' + k);
    }
  })(out, what);
  return JSON.stringify(out);
}

// ---------------------------------------------------------------- spaces: the bookmark buildings graded A or B

const grades = Object.entries(json('spaces.json')).filter(([k]) => k !== '_');
const spaces = [], rooms = [], served = {};
for (const [id, grade] of grades) {
  if (!/^(A|A room|B|C)$/.test(grade)) refuse(`spaces.json: ${id} has grade "${grade}"`);
  if (grade === 'C') continue;
  const c = card.get(id);
  if (!c || !/^b\d+$/.test(id) || c.source !== 'Architectural Authority') refuse(`spaces.json: ${id} is not a bookmark building in the deck`);
  const p = join(IN, 'models', c.work + '.json');
  if (!existsSync(p)) refuse(`no model for ${id} at ${p}`);
  served[`s/m/${id}.json`] = strip(JSON.parse(readFileSync(p, 'utf8')), id);
  spaces.push(id);
  if (grade === 'A room') rooms.push(id);
}
if (!spaces.length) refuse('no spaces');

// ---------------------------------------------------------------- pages: the six Picture Poetry pages

const dirFile = join(IN, 'pages', 'dir');
if (!existsSync(dirFile)) writeFileSync(dirFile, randomBytes(16).toString('hex') + '\n');
const pageDir = readFileSync(dirFile, 'utf8').trim();
if (!/^[0-9a-f]{32}$/.test(pageDir)) refuse(`${dirFile} must hold 32 hex characters`);

/** A JPEG with every metadata segment dropped (EXIF, XMP, IPTC, comments), losslessly; its size from the frame header. */
function cleanJpeg(buf, what) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) refuse(`${what} is not a JPEG`);
  const keep = [buf.subarray(0, 2)];
  let i = 2, w = 0, h = 0;
  for (;;) {
    if (i + 4 > buf.length || buf[i] !== 0xff) refuse(`${what}: a broken JPEG segment at ${i}`);
    const m = buf[i + 1];
    if (m === 0xda) { keep.push(buf.subarray(i)); break; }   // the image data runs to the end
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); }
    if (!((m >= 0xe1 && m <= 0xed) || m === 0xef || m === 0xfe)) keep.push(buf.subarray(i, i + 2 + len));   // APP0 (JFIF) and APP14 (colour) stay
    i += 2 + len;
  }
  if (!w || !h) refuse(`${what} has no frame size`);
  return { bytes: Buffer.concat(keep), w, h };
}

const PLACE = /^[A-Z][A-Za-z.' -]{1,30}, [A-Z][A-Za-z.' -]{1,30}$/;   // "Town, Region": nothing finer
const pageImages = {};
const pages = json('pages/pages.json').map((p, n) => {
  if (p.id !== 'p' + (n + 1)) refuse(`pages.json: page ${n + 1} must have id p${n + 1}`);
  if (!(p.title === null || (typeof p.title === 'string' && p.title.length <= 60))) refuse(`${p.id}: title`);
  if (!(p.place === null || PLACE.test(p.place))) refuse(`${p.id}: place "${p.place}" must be a town and its region, or null`);
  if (!/^#[0-9a-f]{6}$/i.test(p.ground || '')) refuse(`${p.id}: ground must be a hex colour`);
  if (!Array.isArray(p.relations) || !p.relations.length || p.relations.some((r) => typeof r !== 'string' || r.length > 140 || /\d+\.\d{3}/.test(r))) refuse(`${p.id}: relations are short lines, no coordinates`);
  if (!Array.isArray(p.words) || !p.words.length || p.words.some((x) => !word.has('w' + x))) refuse(`${p.id}: every page word must be one of the 80`);
  const img = cleanJpeg(readFileSync(join(IN, 'pages', p.image)), p.image);
  pageImages[`pp/${pageDir}/${p.id}.jpg`] = img.bytes;
  const buildings = (p.buildings || []).map((bd, k) => {
    const file = p.id + 'abcdefgh'[k];
    const src = join(IN, 'models', bd.model + '.json');
    if (!existsSync(src) || typeof bd.name !== 'string') refuse(`${p.id}: building ${bd.model}`);
    served[`pp/${pageDir}/m/${file}.json`] = strip(JSON.parse(readFileSync(src, 'utf8')), file);
    return { model: file, name: bd.name };
  });
  return { id: p.id, title: p.title, wide: img.w > img.h, w: img.w, h: img.h, ground: p.ground.toLowerCase(), place: p.place,
    buildings, relations: p.relations, words: p.words.map((x) => 'w' + x) };
});
if (pages.length !== 6) refuse('six pages');

// ---------------------------------------------------------------- the checks every output passes, then write

const things = { version: 1, pageDir, lines, words, pics, spaces, rooms, pages };
const text = JSON.stringify(things);
const readable = JSON.stringify([lines, words, pages]);
if (author && new RegExp('\\b' + author + '\\b', 'i').test(text + Object.values(served).join(''))) refuse('an output names the artist');
if (/\b5s\b/i.test(readable)) refuse('a line, word or page writes the app\'s name');
if (/"(lat|lon|lng)"/.test(text)) refuse('a coordinate in the catalogue');
if (existsSync(join(PUB, 'index.html'))) refuse('public/index.html would shadow the Worker\'s home page');
const modelsJs = readFileSync(join(IN, 'models', 'models.js'), 'utf8');
if (author && new RegExp('\\b' + author + '\\b', 'i').test(modelsJs)) refuse('models.js names the artist');

rmSync(join(PUB, 's', 'm'), { recursive: true, force: true });
rmSync(join(PUB, 'pp'), { recursive: true, force: true });
const put = (rel, data) => { const p = join(PUB, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); };
for (const [rel, data] of Object.entries(served)) put(rel, data);
for (const [rel, data] of Object.entries(pageImages)) put(rel, data);
put('s/models.js', modelsJs);
// The space viewer page and the drawing the round card shares with it (committed in web/).
for (const f of ['space.html', 'space.js']) put('s/' + f, readFileSync(join(CONNECTOR, 'web', f)));
// The card fetches the models from Claude's own origin, so they need CORS. /pp/ runs the Worker first and
// sets its own headers there (_headers is not applied to a Worker's answers). Short caching: a redeploy shows.
put('_headers', '/s/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=300\n  X-Content-Type-Options: nosniff\n');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(things, null, 1));

for (const f of readdirSync(join(PUB, 'pp', pageDir)).filter((x) => x.endsWith('.jpg'))) {   // self-check: no metadata left
  const bytes = readFileSync(join(PUB, 'pp', pageDir, f));
  assert.equal(cleanJpeg(bytes, f).bytes.length, bytes.length, f + ' still holds metadata');
}
console.log(`things: ${lines.length} curated lines, ${made} made lines checked (${TEMPLATES.length} templates, ${verbs.length} words act out a root), ` +
  `${words.length} words, ${Object.keys(pics).length} picture-to-word matches, ${spaces.length} spaces (${rooms.length} rooms), ${pages.length} pages`);
console.log(`wrote ${OUT} (${Math.round(text.length / 1024)} KB) and ${Object.keys(served).length + pages.length + 4} files in ${PUB}`);

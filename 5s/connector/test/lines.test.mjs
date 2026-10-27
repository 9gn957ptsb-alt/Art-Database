// The fives' lines of code (src/lines.js): made lines come only from fixed templates and checked values,
// remake themselves from their id, and every line passes safe() before anyone can copy it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draft, lineFor, madeLine, safe, TEMPLATES, MADE } from '../src/lines.js';

// Made-up things, no artist material: a card with every composition and a feel, and two words.
const rug = { id: 'o001', colours: ['#623322', '#fdfcfc', '#c32f28'], feel: ['muted'],
  comp: ['frame within frame', 'stripes and bands', 'rings and whorls', 'radiating', 'a grid', 'a low horizon, big sky',
    'an arch overhead', 'a strong centre', 'tall uprights', 'a diagonal pull', 'allover'] };
const stretch = { id: 'wstretchy', families: ['tendere'] }, inert = { id: 'wplain', families: ['nothing'] };
const things = new Map([[rug.id, rug], [stretch.id, stretch], [inert.id, inert]]);
const get = (id) => things.get(id) || null;

test('every template makes a safe line from a kept card, and its id makes it again', () => {
  for (const t of TEMPLATES) {
    const l = t === 'wv' ? lineFor(t, rug, stretch) : lineFor(t, rug, null);
    assert.ok(l, t + ' makes a line');
    assert.equal(safe(l.line), null, l.id);
    assert.ok(MADE.test(l.id) && l.id.length <= 25, l.id);
    assert.ok(['css', 'glsl'].includes(l.lang) && l.where && l.does, l.id);
    assert.deepEqual(madeLine(l.id, get), l);
    if (l.lang === 'css') assert.match(l.line, /^(@keyframes |[a-z0-9:>* ]+ \{ ).*\}$/, l.id + ' is a whole rule, ready for a stylesheet');
  }
});

test('the id carries the card whose colour a word is acted out in', () => {
  assert.equal(lineFor('wv', rug, stretch).id, 'lwvo001wstretchy');
  assert.match(lineFor('wv', rug, stretch).line, /#c32f28/, 'the most vivid kept colour');
  assert.equal(lineFor('wv', null, stretch).id, 'lwvwstretchy');
  assert.match(lineFor('wv', null, stretch).line, /currentColor/);
  assert.equal(lineFor('ff', rug, null).id, 'lffo001');
});

test('nothing but checked values reaches a line', () => {
  assert.equal(lineFor('gr', { id: 'c001', colours: ['#B5AB97"); fetch("//x'] }, null), null, 'a hostile colour makes no line');
  assert.equal(lineFor('gr', { id: 'c001', colours: ['red', '#fff', '#12345'] }, null), null, 'only six-digit hex colours');
  assert.equal(lineFor('fl', { id: 'c001', colours: ['#123456'], feel: ['<script>'] }, null), null, 'only feels from the table');
  assert.equal(lineFor('sb', { id: 'c001', colours: ['#123456'], comp: ['a grid'] }, null), null, 'a composition the card lacks');
  assert.equal(lineFor('wv', rug, inert), null, 'a word whose root has no template');
  assert.equal(lineFor('gr', rug, stretch), null, 'only wv takes a word');
  assert.equal(lineFor('zz', rug, null), null, 'no such template');
  assert.equal(lineFor('gr', { id: 'x<1', colours: ['#123456'] }, null), null, 'a card id that is not an id');
});

test('madeLine refuses ids it did not make', () => {
  for (const id of ['l001', 'lgr', 'lgro999', 'lwvwmissing', 'lwvo001', 'lgro001wstretchy', 'lzzo001', 'LGRO001', 'lgro001 ', '']) {
    assert.equal(madeLine(id, get), null, JSON.stringify(id));
  }
  assert.equal(draft('gr', rug, null).line, 'body { background: linear-gradient(135deg, #fdfcfc, #c32f28, #623322); }');
});

test('safe() refuses what reaches outside the page, and lets plain lines through', () => {
  for (const bad of ['fetch("https://x")', 'a\nb', 'a b', '@import "x.css";', 'document.cookie', '<img src=x onerror=alert(1)>',
    'body { background: url(//x.example/a.png); }', 'body { background: image-set("a.png" 1x); }', '<svg><script>alert(1)</script></svg>',
    'location.href = "x"', 'eval("1")', 'new Function("x")', 'x = `y`', 'import os; os.system("ls")', 'x'.repeat(401), ' ', null]) {
    assert.ok(safe(bad), JSON.stringify(bad));
  }
  assert.equal(safe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M 1 1 L 9 9"/></svg>'), null);
  assert.equal(safe('img { filter: hue-rotate(137.5deg); }'), null);
  assert.equal(safe('void mainImage(out vec4 o, in vec2 p) { o = vec4(1.0); }'), null);
});

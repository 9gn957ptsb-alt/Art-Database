#!/usr/bin/env node
/* npm run deck: the artist's deck, trimmed for the connector, into src/deck.generated.json
 * (gitignored: it holds data derived from Artsy and The Architectural Authority, like 5s/dist/).
 *
 *   node scripts/build-deck.mjs [--deck PATH] [--db PATH] [--things PATH] [--out PATH] [--fixture]
 *
 * --deck     the app's built deck (default 5s/dist/deck.json, written by build_deck.py)
 * --db       the art database, for each Artsy work's image address on Artsy's CDN
 *            (default data/5s/artworks.db; without it the cards carry no image address)
 * --things   the game's catalogue, built by npm run things (default data/5s/things.json; without it
 *            play_fives says the game isn't set up, and next_five plays as before)
 * --out      default src/deck.generated.json
 * --fixture  use 5s/test/fixture/deck.json (synthetic; for local runs without the real deck)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { trimDeck } from '../src/deck.js';

const here = dirname(fileURLToPath(import.meta.url));
const CONNECTOR = resolve(here, '..');
const FIVES = resolve(CONNECTOR, '..');
const REPO = resolve(FIVES, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : fallback;
}
const fixture = process.argv.includes('--fixture');
const deckPath = arg('--deck', fixture ? join(FIVES, 'test', 'fixture', 'deck.json') : join(FIVES, 'dist', 'deck.json'));
const dbPath = arg('--db', join(REPO, 'data', '5s', 'artworks.db'));
const thingsPath = arg('--things', fixture ? null : join(REPO, 'data', '5s', 'things.json'));
const outPath = arg('--out', join(CONNECTOR, 'src', 'deck.generated.json'));

if (!existsSync(deckPath)) {
  console.error(`No deck at ${deckPath}.\nBuild it first: python3 5s/build_deck.py (or pass --fixture for the synthetic test deck).`);
  process.exit(1);
}
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));
const works = [...new Set(deck.cards.map((c) => c.work).filter(Boolean))];

// Image addresses: artworks.image_url, keyed by the Artsy slug the deck calls `work`.
function readImages() {
  if (!existsSync(dbPath)) return { images: {}, from: null };
  const sql = 'SELECT id, image_url FROM artworks WHERE image_url IS NOT NULL';
  try {
    // node:sqlite is built into Node 22.5+ (it prints an ExperimentalWarning on 22; harmless).
    process.removeAllListeners('warning');
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare(sql).all();
    db.close();
    return { images: Object.fromEntries(rows.map((r) => [r.id, r.image_url])), from: 'artworks.db' };
  } catch (e) {
    // Older Node without node:sqlite: ask python3, which has sqlite3 built in.
    try {
      const py = 'import json,sqlite3,sys\nc=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True)\n' +
        'print(json.dumps(dict(c.execute(sys.argv[2]).fetchall())))';
      const out = execFileSync('python3', ['-I', '-c', py, dbPath, sql], { encoding: 'utf8', maxBuffer: 64 << 20 });
      return { images: JSON.parse(out), from: 'artworks.db' };
    } catch (e2) {
      console.warn(`Could not read ${dbPath} (${e.message}; ${e2.message}). Cards will have no image address.`);
      return { images: {}, from: null };
    }
  }
}

// A deck from build_deck.py carries each card's "cdn" itself; an older one is filled in from the database.
const needDb = deck.cards.some((c) => !/^https:\/\//.test(c.cdn || ''));
const { images } = needDb ? readImages() : { images: {} };
const wanted = Object.fromEntries(works.filter((w) => images[w]).map((w) => [w, images[w]]));
const things = thingsPath && existsSync(thingsPath) ? JSON.parse(readFileSync(thingsPath, 'utf8')) : null;
if (things) {
  // The game's things take the ids l, p and w; every kind must have something to deal (src/game.js).
  const bad = deck.cards.find((c) => /^[lpw]/.test(c.id));
  if (bad) throw new Error('deck id ' + bad.id + ' starts with l, p or w: those are the game\'s lines, pages and words');
  for (const k of ['lines', 'words', 'pages', 'spaces']) if (!Array.isArray(things[k]) || !things[k].length) throw new Error(thingsPath + ' has no ' + k);
  const ids = new Set(deck.cards.map((c) => c.id));
  const gone = things.spaces.concat(things.rooms || []).find((id) => !ids.has(id));
  if (gone) throw new Error('space ' + gone + ' is not in the deck: run npm run things again');
}
const out = trimDeck(deck, wanted, null, things);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));
const im = out.images;
console.log(`deck: ${out.cards.length} cards from ${deckPath}`);
console.log(`image addresses (Artsy's CDN, the buildings' photos): ${im.from_deck} from the deck, ${im.from_db} from ${dbPath}, ${im.none} without`);
console.log(things ? `the game's things: ${things.lines.length} lines, ${things.words.length} words, ${things.pages.length} pages, ${things.spaces.length} spaces` : `no game things (${thingsPath || 'none with --fixture'}): play_fives will say the game isn't set up`);
console.log(`wrote ${outPath} (${Math.round(JSON.stringify(out).length / 1024)} KB)`);

// The Worker's own files, from public/s and public/pp (npm run things), packed into it (src/files.js says why).
// Gitignored like the deck; only the count is printed, never a path (the pages' folder is in them).
const PUB = join(CONNECTOR, 'public');
const TYPES = { '.json': 'application/json', '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg' };
const files = {};
for (const top of ['s', 'pp']) {
  if (!existsSync(join(PUB, top))) continue;
  for (const rel of readdirSync(join(PUB, top), { recursive: true })) {
    const p = join(PUB, top, rel);
    if (!statSync(p).isFile()) continue;
    const type = TYPES[extname(p)];
    if (!type) throw new Error('public/' + top + ' holds a kind of file the Worker has no type for: ' + extname(p));
    files['/' + top + '/' + rel.split(sep).join('/')] = type === 'image/jpeg' ? { type, base64: readFileSync(p).toString('base64') } : { type, text: readFileSync(p, 'utf8') };
  }
}
const filesPath = join(dirname(outPath), 'files.generated.json');
writeFileSync(filesPath, JSON.stringify(files));
console.log(`wrote ${filesPath}: ${Object.keys(files).length} of the Worker's own files (${Math.round(JSON.stringify(files).length / 1024)} KB)`);

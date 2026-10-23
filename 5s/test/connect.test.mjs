// Connect your apps, the pure part (src/connect.js): reading "download your data" files on the device
// (JSON, X's script-wrapped JSON, HTML, CSV, plain text, and .zip files holding them, zip64 too),
// finding picture addresses and post/pin links, de-duplicating them, naming the source, and the one
// client of the 5s connector through the artifact's mcp capability (against a fake mcp namespace).
//
//   node --test 5s/test/connect.test.mjs        (also run by node --test 5s/test/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const C = require('../src/connect.js');

// ---------------------------------------------------------------- a .zip writer for the tests

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** files: [{name, text, store?}] -> Buffer. zip64: write the zip64 end records and extra fields. */
function makeZip(files, { zip64 = false } = {}) {
  const locals = [], centrals = [];
  let off = 0;
  for (const f of files) {
    const data = Buffer.from(f.text, 'utf8');
    const comp = f.store ? data : zlib.deflateRawSync(data);
    const name = Buffer.from(f.name, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(f.store ? 0 : 8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    let extra = Buffer.alloc(0);
    if (zip64) {
      extra = Buffer.alloc(4 + 24);
      extra.writeUInt16LE(1, 0); extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(BigInt(data.length), 4); extra.writeBigUInt64LE(BigInt(comp.length), 12); extra.writeBigUInt64LE(BigInt(off), 20);
    }
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(45, 4); ch.writeUInt16LE(45, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(f.store ? 0 : 8, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(zip64 ? 0xffffffff : comp.length, 20); ch.writeUInt32LE(zip64 ? 0xffffffff : data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(extra.length, 30);
    ch.writeUInt32LE(zip64 ? 0xffffffff : off, 42);
    centrals.push(ch, name, extra);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const tail = [];
  if (zip64) {
    const rec = Buffer.alloc(56);
    rec.writeUInt32LE(0x06064b50, 0); rec.writeBigUInt64LE(44n, 4); rec.writeUInt16LE(45, 12); rec.writeUInt16LE(45, 14);
    rec.writeBigUInt64LE(BigInt(files.length), 24); rec.writeBigUInt64LE(BigInt(files.length), 32);
    rec.writeBigUInt64LE(BigInt(cd.length), 40); rec.writeBigUInt64LE(BigInt(off), 48);
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(off + cd.length), 8); loc.writeUInt32LE(1, 16);
    tail.push(rec, loc);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(zip64 ? 0xffff : files.length, 8); end.writeUInt16LE(zip64 ? 0xffff : files.length, 10);
  end.writeUInt32LE(zip64 ? 0xffffffff : cd.length, 12); end.writeUInt32LE(zip64 ? 0xffffffff : off, 16);
  return Buffer.concat(locals.concat([cd], tail, [end]));
}

const file = (name, body) => new File([body], name);

// ---------------------------------------------------------------- sample exports

// Instagram's saved posts (its real shape), with its way of writing "é" and "’" byte by byte.
const INSTAGRAM_SAVED = JSON.stringify({
  saved_saved_media: [
    { title: 'atelier_cafÃ©', string_map_data: { 'Saved on': { href: 'https://www.instagram.com/p/C1aBcDeFgH/', timestamp: 1729000000 } } },
    { title: 'studio_north', string_map_data: { 'Saved on': { href: 'https://www.instagram.com/p/C2xYz123/', timestamp: 1729000100 } } },
    { title: 'studio_north', string_map_data: { 'Saved on': { href: 'https://instagram.com/p/C2xYz123', timestamp: 1729000200 } } },
  ],
});
// Liked posts keep the name one level above the link.
const INSTAGRAM_LIKED = JSON.stringify({
  likes_media_likes: [{ title: 'clay_and_kiln', string_list_data: [{ href: 'https://www.instagram.com/p/LIKED1/', value: 'ð\u009f\u0091\u008d', timestamp: 1 }] }],
});
// Something generic and nested: boards of pins with their pictures, and a profile link that is not a save.
const NESTED = JSON.stringify({
  profile: { name: 'Me', url: 'https://example.org/me' },
  boards: [
    { name: 'Rooms', pins: [
      { title: 'Ochre kitchen', link: 'https://www.pinterest.com/pin/1111/', media: { images: { orig: { url: 'https://i.pinimg.com/originals/aa/bb/cc/ochre.jpg' } } } },
      { title: 'Slate stair', link: 'https://www.pinterest.com/pin/2222/', media: { images: { orig: { url: 'http://i.pinimg.com/originals/dd/ee/ff/slate.png' } } } },
    ] },
    { name: 'Objects', pins: [{ description: 'A bowl', link: 'https://www.pinterest.com/pin/3333/' }] },
  ],
});
const X_LIKES = 'window.YTD.like.part0 = ' + JSON.stringify([
  { like: { tweetId: '1', fullText: 'A chair I love https://t.co/abc', expandedUrl: 'https://twitter.com/i/web/status/1700000000000000001' } },
  { like: { tweetId: '2', fullText: 'Wool rug', expandedUrl: 'https://twitter.com/i/web/status/1700000000000000002' } },
]);
const HTML = `<!doctype html><html><head><title>Saved</title><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=X">
<script>var u = "https://evil.example/a.jpg";</script><style>.a{background:url(https://example.com/bg.png)}</style></head><body>
<!-- <a href="https://example.com/hidden/1">hidden</a> -->
<a href="https://www.are.na/block/12345"><img src="https://d2w9rnfcy7mm78.cloudfront.net/1/original_linen.jpg" alt="Linen weave"></a>
<a href="https://www.flickr.com/photos/someone/5555555555/" title="Concrete stair">photo</a>
<img src="https://live.staticflickr.com/65535/1_b.jpg" alt="Brass lamp">
<a href="https://help.instagram.com/123">Help</a><a href="https://www.instagram.com/">Instagram</a><a href="/local/page.html">here</a>
<a href="https://example.com/a?x=1&amp;utm_source=mail#top">Tom &amp; Jerry’s table</a>
</body></html>`;
const CSV = 'Title,URL,Image,Note\n"Walnut desk, oiled",https://www.example-shop.com/p/walnut-desk,https://cdn.example-shop.com/walnut.jpg,"said ""yes"""\nPlain link,https://blog.example.net/2024/10/a-post/,,\n';

// ---------------------------------------------------------------- harvesting

test('JSON: Instagram saved posts, names fixed, duplicates merged, source by name', () => {
  const f = C.harvestText('saved_posts.json', INSTAGRAM_SAVED);
  assert.equal(f.links, 2, 'the same post twice (www., a trailing slash) is one');
  assert.equal(f.pictures, 0);
  assert.deepEqual(f.items.map((i) => i.link), ['https://www.instagram.com/p/C1aBcDeFgH/', 'https://www.instagram.com/p/C2xYz123/']);
  assert.equal(f.items[0].title, 'atelier_café', 'Instagram\'s byte-by-byte characters are put back');
  assert.equal(f.source, 'Instagram', 'by where the links point');
});

test('JSON: a link nested below its name takes the name above it', () => {
  const f = C.harvestText('liked_posts.json', INSTAGRAM_LIKED);
  assert.equal(f.links, 1);
  assert.equal(f.items[0].title, 'clay_and_kiln');
});

test('JSON: nested pictures go with their links; saves (boards, pins) are read first', () => {
  const f = C.harvestText('export.json', NESTED);
  assert.equal(f.links, 3);
  assert.equal(f.pictures, 2);
  const ochre = f.items.find((i) => i.title === 'Ochre kitchen');
  assert.deepEqual(ochre, { key: ochre.key, image: 'https://i.pinimg.com/originals/aa/bb/cc/ochre.jpg', link: 'https://www.pinterest.com/pin/1111/', title: 'Ochre kitchen' });
  assert.equal(f.items.find((i) => i.title === 'Slate stair').image, 'https://i.pinimg.com/originals/dd/ee/ff/slate.png', 'http is upgraded');
  assert.ok(!f.items.some((i) => /example\.org\/me/.test(i.link || '')), 'the profile is not under a save, so it is left out');
  assert.equal(f.source, 'Pinterest');
});

test('JSON: X\'s archive (script-wrapped) is read, named X, titled from the text', () => {
  const f = C.harvestText('like.js', X_LIKES);
  assert.equal(f.source, 'X');
  assert.equal(f.links, 2);
  assert.equal(f.items[0].title, 'A chair I love', 'the t.co address is taken out of the name');
});

test('HTML: links, pictures inside links, lone pictures; scripts, comments, help pages and front pages are not saves', () => {
  const f = C.harvestText('saved.html', HTML);
  const got = f.items.map((i) => [i.image, i.link, i.title]);
  assert.deepEqual(got, [
    ['https://d2w9rnfcy7mm78.cloudfront.net/1/original_linen.jpg', 'https://www.are.na/block/12345', 'Linen weave'],
    [null, 'https://www.flickr.com/photos/someone/5555555555/', 'Concrete stair'],
    [null, 'https://example.com/a?x=1', 'Tom & Jerry’s table'],
    ['https://live.staticflickr.com/65535/1_b.jpg', null, 'Brass lamp'],
  ]);
  assert.equal(f.source, 'Your file', 'no one app has most of them');
});

test('CSV: a header names the columns; quotes as spreadsheets write them', () => {
  const f = C.harvestText('Saved places.csv', CSV);
  assert.equal(f.links, 2);
  assert.deepEqual(f.items[0], { key: f.items[0].key, image: 'https://cdn.example-shop.com/walnut.jpg', link: 'https://www.example-shop.com/p/walnut-desk', title: 'Walnut desk, oiled' });
  assert.equal(f.items[1].image, null);
  assert.equal(f.items[1].title, 'Plain link');
});

test('plain text: one thing per line', () => {
  const f = C.harvestText('links.txt', 'my lamp https://example.com/lamp.webp\n\nhttps://www.tumblr.com/someone/7777777/a-post\nnot a link\n');
  assert.equal(f.links, 2);
  assert.equal(f.pictures, 1);
  assert.equal(f.items[0].title, 'my lamp');
});

test('addresses: https only, public names, no ports, no tracking, no front pages, no overlong ones', () => {
  assert.equal(C.cleanUrl('http://example.com/x'), 'https://example.com/x');
  assert.equal(C.cleanUrl('https://example.com:8443/x'), null);
  assert.equal(C.cleanUrl('https://192.168.1.4/x.jpg'), null);
  assert.equal(C.cleanUrl('https://fileserver/x.jpg'), null);
  assert.equal(C.cleanUrl('https://user:pw@example.com/x'), null);
  assert.equal(C.cleanUrl('ftp://example.com/x'), null);
  assert.equal(C.cleanUrl('https://www.instagram.com/'), null);
  assert.equal(C.cleanUrl('https://example.com/p?utm_source=x&id=4&fbclid=1#frag'), 'https://example.com/p?id=4');
  assert.equal(C.cleanUrl('https://example.com/' + 'a'.repeat(2100)), null);
  assert.equal(C.cleanUrl('https://example.com/about-our-chairs'), 'https://example.com/about-our-chairs', 'only /about itself is a policy page');
  assert.equal(C.cleanUrl('https://example.com/about/team'), null);
  assert.ok(C.isPicture('https://pbs.twimg.com/media/Abc?format=jpg&name=large'), 'a picture host without an extension');
  assert.ok(!C.isPicture('https://www.pinterest.com/pin/1/'));
  assert.equal(C.keyOf('https://WWW.Example.com/a/'), C.keyOf('https://example.com/a'));
});

// ---------------------------------------------------------------- files and .zip files

test('readFile: a .zip holding JSON, read here; only the files that hold saves', async () => {
  const zip = makeZip([
    { name: 'your_instagram_activity/saved/saved_posts.json', text: INSTAGRAM_SAVED },
    { name: 'your_instagram_activity/likes/liked_posts.json', text: INSTAGRAM_LIKED, store: true },
    { name: 'your_instagram_activity/messages/inbox/friend/message_1.json', text: JSON.stringify({ messages: [{ share: { link: 'https://example.com/private-chat-link' } }] }) },
    { name: 'media/posts/2024/photo.jpg', text: '\u0000\u0001binary' },
  ]);
  const f = await C.readFile(file('instagram-me-2024-10-22.zip', zip));
  assert.equal(f.source, 'Instagram');
  assert.equal(f.files, 2, 'saved and liked only; not messages, not pictures');
  assert.equal(f.links, 3);
  assert.ok(!f.items.some((i) => /private-chat-link/.test(i.link || '')));
});

test('readFile: zip64 records are understood; a .zip with no saves reads every text file', async () => {
  const zip = makeZip([{ name: 'export/data.json', text: NESTED }, { name: 'export/notes.txt', text: 'https://example.com/wool.jpg' }], { zip64: true });
  const f = await C.readFile(file('archive.zip', zip));
  assert.equal(f.files, 2);
  assert.equal(f.links, 4);
  const entries = await C.unzip(new Blob([zip]));
  assert.deepEqual(entries.map((e) => [e.name, e.method]), [['export/data.json', 8], ['export/notes.txt', 8]]);
});

test('readFile: a single file; a damaged .zip and a picture say what is wrong, plainly', async () => {
  const f = await C.readFile(file('like.js', X_LIKES));
  assert.equal(f.links, 2);
  const zip = makeZip([{ name: 'a.json', text: NESTED }]);
  await assert.rejects(C.readFile(file('cut.zip', zip.subarray(0, zip.length - 30))), (e) => e.code === 'not a zip' && !/zip|json|csv|html/i.test(e.message));
  await assert.rejects(C.readFile(file('photo.txt', Buffer.from([0xff, 0xd8, 0, 0, 0, 1]))), (e) => e.code === 'unreadable');
});

// ---------------------------------------------------------------- the connector client

function fakeMcp(answers, listed) {
  const calls = [];
  return {
    calls,
    async listTools(server) {
      if (listed === 'throw') { const e = { code: 'capability_disabled', message: 'no' }; throw e; }
      return { servers: listed ? [listed].filter((s) => s.server === server) : [] };
    },
    async callTool(server, tool, input) {
      calls.push([server, tool, input]);
      const a = answers[tool];
      if (!a) { const e = { code: 'server_not_connected', message: 'no 5s', server }; throw e; }
      if (a.reject) throw a.reject;
      return { content: [{ type: 'text', text: 'ok' }], structuredContent: a.data, payload: a.data };
    },
  };
}

test('connector: one server name, status from listTools, payloads, refusals with why and resolution', async () => {
  assert.equal(C.SERVER, '5s');
  assert.equal(await C.connector(null).status(), 'none');
  await assert.rejects(C.connector(null).readLink('x'), (e) => e.kind === 'closed' && e.connect === true && e.why === C.CONNECT_LINE);
  assert.equal(await C.connector(fakeMcp({}, null)).status(), 'none', 'mcp without a 5s connector (an artifact server only)');
  assert.equal(await C.connector(fakeMcp({}, 'throw')).status(), 'none');
  assert.equal(await C.connector(fakeMcp({}, { server: '5s', authStatus: 'needs_reauth', tools: [{ name: 'read_link' }] })).status(), 'reauth');
  assert.equal(await C.connector(fakeMcp({}, { server: '5s', authStatus: 'unknown', tools: [] })).status(), 'none', 'a duplicate not yet chosen lists no tools');
  assert.equal(await C.connector(fakeMcp({}, { server: '5s', authStatus: 'unknown', tools: [{ name: 'read_link' }] })).status(), 'connected');

  const refusal = { ok: false, error: 'web', code: 'forbidden', status: 403, why: 'That board is private.', resolution: 'Make it public, or save the pictures.' };
  const m = fakeMcp({
    read_link: { data: { ok: true, source: 'Are.na', count: 1, items: [{ image: 'https://images.are.na/a.jpg', thumb: null, title: null, link: null, source: 'Are.na' }] } },
    bring_in: { reject: { code: 'tool_error', message: '{"ok":false}', result: { isError: true, content: [{ type: 'text', text: 'no' }], structuredContent: refusal } } },
  }, { server: '5s', authStatus: 'connected', tools: [{ name: 'read_link' }] });
  const c = C.connector(m);
  const r = await c.readLink('  are.na/someone/channel ');
  assert.equal(r.source, 'Are.na');
  assert.deepEqual(m.calls[0], ['5s', 'read_link', { url: 'are.na/someone/channel' }]);
  await assert.rejects(c.bringIn(r.items, 'object'), (e) => e.kind === 'refused' && e.code === 'forbidden' && e.why === refusal.why && e.resolution === refusal.resolution);
  assert.deepEqual(m.calls[1][2], { items: [{ image: 'https://images.are.na/a.jpg', source: 'Are.na' }], kind: 'object' }, 'nulls are left out: bring_in refuses a null title or link');
  await assert.rejects(c.itemImage('yabc12'), (e) => e.kind === 'closed' && e.connect === true, 'server_not_connected');
  const busy = C._internals.toConnectError({ code: 'server_unavailable', retryable: true });
  assert.equal(busy.kind, 'busy');
  assert.equal(C._internals.toConnectError({ code: 'needs_reauth' }).kind, 'closed');
  assert.equal(C._internals.toConnectError({ code: 'tool_error', result: { content: [{ type: 'text', text: 'Unknown tool' }] } }).kind, 'failed');
});

test('bringItem, dataUrlBlob, words', async () => {
  assert.deepEqual(C.bringItem({ image: ' https://x.example/a.jpg ', title: '  A  ', link: 'javascript:alert(1)', thumb: null, source: 'Your file', extra: 1 }),
    { image: 'https://x.example/a.jpg', source: 'Your file', title: 'A' });
  const b = C.dataUrlBlob('data:image/png;base64,' + Buffer.from('hello').toString('base64'));
  assert.equal(b.type, 'image/png');
  assert.equal(Buffer.from(await b.arrayBuffer()).toString(), 'hello');
  assert.equal(C.sourceInitial('Instagram'), 'I');
  assert.equal(C.sourceInitial('The web'), 'W');
  assert.equal(C.sourceInitial('Your file'), 'F');
  assert.equal(C.sourceInitial('Are.na'), 'A');
  assert.match(C.askSentence(''), /my aesthetic database: \[paste your link\]$/);
  assert.match(C.askSentence('https://are.na/me/rooms'), /my aesthetic database: https:\/\/are\.na\/me\/rooms$/);
});

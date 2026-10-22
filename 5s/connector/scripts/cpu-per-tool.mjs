#!/usr/bin/env node
// CPU per tool (README "What it costs: nothing"): each tool run the way the McpAgent Durable Object
// runs it (the MCP SDK's McpServer, the tool's handler, its JSON), on a realistic person: 600
// judgments over four months, 120 brought-in things, notes, sets and a hub. Measured with
// process.cpuUsage() around one call (user + system), cold (the first call in a fresh process,
// before V8 has optimised anything) and warm (the median of 15 later calls).
//
//   node scripts/cpu-per-tool.mjs            # the deck in src/deck.generated.json (npm run deck)
//   node scripts/cpu-per-tool.mjs --json     # the table as JSON
//
// The web is the fake web (src/fake-web.js) and the store is in memory, so only CPU is measured:
// time spent waiting on a site, on GitHub or on storage is not CPU, on Cloudflare or here.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import FiveS from '../src/engine.js';
import { registerTools, SERVER_INSTRUCTIONS } from '../src/tools.js';
import { memoryStore, writeState } from '../src/store.js';
import { createFakeGitHub } from '../src/fake-github.js';
import { api } from '../src/hub.js';
import { createWeb } from '../src/web.js';
import { createFakeWeb } from '../src/fake-web.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const deck = JSON.parse(readFileSync(join(HERE, '..', 'src', 'deck.generated.json'), 'utf8'));
const UID = '4242', LOGIN = 'ada-lovelace', TOKEN = 'gho_bench';
const DAY = 86400000;

/** A person after four months: 600 judgments (120 fives), 120 brought-in things, notes, sets, a hub. */
export function realisticState(d, now) {
  let st = FiveS.newState();
  let t = now - 120 * DAY;
  const rnd = FiveS.prng ? FiveS.prng(7) : Math.random;
  for (let k = 0; k < 120; k++) {
    st = FiveS.startFive(st, d, t);
    for (const id of st.five.ids.slice()) {
      const keep = rnd() < 0.55;
      st = FiveS.judge(st, d, id, keep, 1200 + Math.floor(rnd() * 4000), t).state;
      t += 4000;
    }
    t += DAY - 20000;
  }
  for (let i = 0; i < 120; i++) {
    const id = 'y' + (100000 + i).toString(36);
    st = FiveS.bring(st, { id, kind: ['image', 'object', 'space'][i % 3], name: 'Saved thing ' + i, source: i % 2 ? 'Pinterest' : 'Are.na',
      colours: ['#b5532d', '#efe6d2', '#39424e'], crop: [0.4, 0.3, 0.25, 0.25], texture: 0.4, w: 720, h: 540 }, t - i * 1000);
    st.own[st.own.length - 1] = Object.assign({}, st.own[st.own.length - 1], {
      image: 'https://img.example.com/bowl-' + i + '.jpg', link: 'https://www.pinterest.com/pin/' + (1000 + i) + '/',
      maker: 'A maker', medium: 'stoneware', category: 'Design/Decorative Art', era: '2010s–now', genes: [], materials: ['ceramic'],
      about: 'A bowl', definedBy: 'page',
    });
  }
  const notes = [];
  for (let i = 0; i < 80; i++) notes.push({ at: Math.floor((t - i * DAY) / 1000), q: 'turn', ref: st.j[i * 7][0], text: 'Why I kept this one, in a sentence or two of my own words.' });
  const sets = [];
  for (let i = 0; i < 20; i++) sets.push({ at: Math.floor((t - i * DAY) / 1000), wall: 'c' + String(1 + i).padStart(3, '0'), name: 'A room ' + i });
  st = Object.assign({}, st, { notes, sets, hub: { user: LOGIN, name: LOGIN + '.github.io', private: false, mode: 'api', madeAt: Math.floor(t / 1000) - 86400, savedAt: Math.floor(t / 1000) - 3600, savedCode: 'x' } });
  return st;
}

async function main() {
  const asJson = process.argv.includes('--json');
  const now = Date.UTC(2026, 9, 22, 12);
  const store = memoryStore();
  const state = realisticState(deck, now);
  await writeState(store, UID, state, 1, now, {});
  const stateBytes = Buffer.byteLength(store.map.get('state:' + UID));
  const gh = createFakeGitHub({ users: [{ token: TOKEN, id: Number(UID), login: LOGIN }] });
  const fakeWeb = createFakeWeb();
  // The hub exists on the fake GitHub (made by 5s), so save_hub and hub_status do their real work.
  const made = memoryStore();
  let clock = now;
  const ctx = () => ({
    store, deck, github: api(TOKEN, gh.fetch, { base: gh.base }), user: { id: UID, login: LOGIN },
    now: () => (clock += 1000), sleep: async () => {},
    web: (o) => createWeb(Object.assign({ fetch: fakeWeb.fetch, timeoutMs: 2000 }, o)),
    colourBudgetPx: 0,
  });
  const server = new McpServer({ name: '5s', version: 'bench' }, { instructions: SERVER_INSTRUCTIONS });
  registerTools(server, async () => ctx());
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'bench', version: '1' });
  await client.connect(b);
  // make_hub first (so the hub is on the fake GitHub), outside the measurements.
  await client.callTool({ name: 'make_hub', arguments: {} });
  void made;

  const own = (await client.callTool({ name: 'get_state', arguments: {} })).structuredContent.state.own;
  const ownId = own.find((o) => o.image).id;
  const five = (await client.callTool({ name: 'next_five', arguments: {} })).structuredContent.cards;
  const bigState = (await client.callTool({ name: 'get_state', arguments: {} })).structuredContent;
  const cases = [
    ['get_taste', () => ({})],
    ['aesthetic_brief', () => ({ for: 'a living room' })],
    ['next_five', () => ({})],
    ['judge', (i) => ({ card: five[i % five.length].card, keep: i % 2 === 0 })],
    ['get_seed', () => ({})],
    ['hub_status', () => ({})],
    ['save_hub', () => ({})],
    ['make_hub', () => ({})],
    ['get_state', () => ({})],
    ['put_state', () => ({ state: bigState.state, base: null })],
    ['read_link', (i) => ({ url: i % 2 ? 'https://www.pinterest.com/ada/slow-mornings/' : 'https://studio.example.com/work/bowl' })],
    ['bring_in', (i) => ({ items: [{ image: 'https://img.example.com/meadow-' + i + '.jpg', source: 'The web', title: 'A meadow', maker: 'Someone', category: 'Photography' }] })],
    ['item_image', () => ({ id: ownId })],
  ];
  const freshDay = () => {
    // Each call as if it were the first of its kind today: the daily caps are not what is measured.
    const k = 'state:' + UID, rec = JSON.parse(store.map.get(k));
    rec.use = null;
    store.map.set(k, JSON.stringify(rec));
  };
  const cpu = async (name, args) => {
    freshDay();
    // put_state needs the current rev as its base.
    if (name === 'put_state') args = Object.assign({}, args, { base: (await client.callTool({ name: 'get_state', arguments: {} })).structuredContent.rev });
    const t0 = process.cpuUsage();
    const r = await client.callTool({ name, arguments: args });
    const d = process.cpuUsage(t0);
    if (r.isError && !(name === 'bring_in' && r.structuredContent && r.structuredContent.error === 'limit')) throw new Error(name + ' failed: ' + r.content[0].text);
    return (d.user + d.system) / 1000;
  };
  const rows = [];
  for (const [name, argsOf] of cases) {
    const cold = await cpu(name, argsOf(0));
    const warm = [];
    for (let i = 1; i <= 15; i++) warm.push(await cpu(name, argsOf(i)));
    warm.sort((x, y) => x - y);
    rows.push({ tool: name, cold_ms: +cold.toFixed(2), warm_ms: +warm[7].toFixed(2), max_warm_ms: +warm[14].toFixed(2) });
  }
  const meta = { judgments: state.j.length, brought: state.own.length, notes: state.notes.length, sets: state.sets.length, state_bytes: stateBytes, deck_cards: deck.cards.length, node: process.version };
  if (asJson) { console.log(JSON.stringify({ meta, rows }, null, 2)); return; }
  console.log('A person with ' + meta.judgments + ' judgments, ' + meta.brought + ' brought-in things, ' + meta.notes + ' notes, ' + meta.sets + ' sets and a hub (state ' + Math.round(stateBytes / 1024) + ' KB); deck of ' + meta.deck_cards + ' cards; Node ' + meta.node);
  console.log('tool               cold ms   warm ms (median)   warm max');
  for (const r of rows) console.log(r.tool.padEnd(18) + String(r.cold_ms).padStart(8) + String(r.warm_ms).padStart(12) + String(r.max_warm_ms).padStart(16));
}

if (import.meta.url === 'file://' + process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });

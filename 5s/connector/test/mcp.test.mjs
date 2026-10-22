// The tools as Claude sees them: the MCP SDK's McpServer with registerTools(), driven by the SDK's
// Client over an in-memory transport (the Worker serves the same server through McpAgent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools, SERVER_INSTRUCTIONS, TOOL_NAMES } from '../src/tools.js';
import { ctxFor, LOGIN } from './helpers.mjs';

async function connect(ctx) {
  const server = new McpServer({ name: '5s', version: 'test' }, { instructions: SERVER_INSTRUCTIONS });
  registerTools(server, async () => ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const dataOf = (r) => JSON.parse(r.content[1].text);

test('tools/list: the ten tools, with input schemas and annotations', async () => {
  const client = await connect(ctxFor().ctx);
  assert.match(client.getInstructions(), /quoted data/);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name), TOOL_NAMES);
  const by = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.deepEqual(Object.keys(by.judge.inputSchema.properties).sort(), ['card', 'keep', 'ms']);
  assert.deepEqual(by.judge.inputSchema.required.sort(), ['card', 'keep']);
  assert.deepEqual(by.aesthetic_brief.inputSchema.required, ['for']);
  assert.deepEqual(Object.keys(by.make_hub.inputSchema.properties).sort(), ['include_notes', 'name', 'private']);
  assert.deepEqual(Object.keys(by.save_hub.inputSchema.properties).sort(), ['include_notes', 'include_own_images']);
  assert.deepEqual(by.put_state.inputSchema.required, ['state']);
  assert.equal(by.get_taste.annotations.readOnlyHint, true);
  assert.equal(by.make_hub.annotations.openWorldHint, true);
  assert.equal(by.put_state.annotations.destructiveHint, true);
});

test('tools/call: a summary, the same data as JSON, and structuredContent', async () => {
  const client = await connect(ctxFor().ctx);
  const f = await client.callTool({ name: 'next_five', arguments: {} });
  assert.equal(f.isError, undefined);
  assert.equal(f.content.length, 2);
  assert.match(f.content[0].text, /Today's five/);
  assert.deepEqual(dataOf(f), f.structuredContent);
  const card = f.structuredContent.cards[0].card;
  const j = await client.callTool({ name: 'judge', arguments: { card, keep: true } });
  assert.equal(j.structuredContent.ok, true);
  assert.ok(j.structuredContent.reveal.title);
  const t = await client.callTool({ name: 'get_taste', arguments: {} });
  assert.equal(t.structuredContent.judged, 1);
});

test('tools/call: bad input and refusals come back as errors Claude can read', async () => {
  const { ctx, gh } = ctxFor();
  const client = await connect(ctx);
  const bad = await client.callTool({ name: 'judge', arguments: { card: 'i001' } });
  assert.equal(bad.isError, true);
  const priv = await client.callTool({ name: 'make_hub', arguments: { private: true } });
  assert.equal(priv.isError, true);
  assert.equal(priv.structuredContent.refused, 'private');
  assert.equal(gh.calls.length, 0);
  const hub = await client.callTool({ name: 'hub_status', arguments: {} });
  assert.equal(hub.structuredContent.suggested_name, LOGIN + '.github.io');
});

test('a tool that throws does not take the server down', async () => {
  const { ctx } = ctxFor();
  const broken = Object.assign({}, ctx, { store: { get: async () => { throw new Error('KV is down'); }, put: async () => {} } });
  const client = await connect(broken);
  const r = await client.callTool({ name: 'get_taste', arguments: {} });
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.error, 'internal');
  assert.ok(!JSON.stringify(r).includes('KV is down'), 'internals stay in the log');
  const again = await client.listTools();
  assert.equal(again.tools.length, TOOL_NAMES.length);
});

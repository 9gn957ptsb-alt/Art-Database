// The Session Galaxy as a graph (5s/gameplan/galaxy.mjs): facets, provenance, communities.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facets, graph, louvain, galaxy } from '../gameplan/galaxy.mjs';

const rows = {
  works: { kiln: 'Kiln', loom: 'Loom' },
  sessions: [
    { k: 'k1', t: 'Kiln glazes', callno: "kiln;code:make.pages'261001", d: '2026-10-01', now: 'done' },
    { k: 'k2', t: 'Kiln firing log', callno: "kiln,log;data:move.drive'261002", d: '2026-10-02', now: 'archived', p: 'k1' },
    { k: 'k3', t: 'Kiln', callno: "kiln;code:make'261003", d: '2026-10-03', now: 'working', core: true },
    { k: 'l1', t: 'Loom drafts', callno: "loom;words:research'261004", d: '2026-10-04', now: 'done' },
    { k: 'l2', t: 'Loom', callno: "loom'261005", d: '2026-10-05', now: 'failed' },
  ],
};

test('a call number gives its facets, and leaves out the ones not known', () => {
  assert.deepEqual(facets("5s,connector;code:move.cloudflare'261023"), { work: '5s', matter: 'code', energy: 'move', space: 'cloudflare' });
  assert.deepEqual(facets("soa:steer'260923"), { work: 'soa', matter: undefined, energy: 'steer', space: undefined });
  assert.deepEqual(facets("individual'260922"), { work: 'individual', matter: undefined, energy: undefined, space: undefined });
});

test('what the session list states is EXTRACTED, what Claude read is INFERRED', () => {
  const g = graph(rows);
  const conf = rel => [...new Set(g.edges.filter(e => e.relation === rel).map(e => e.confidence))];
  assert.deepEqual(conf('serves'), ['EXTRACTED']);
  assert.deepEqual(conf('started'), ['EXTRACTED']);
  assert.deepEqual(conf('did'), ['INFERRED']);
  assert.equal(g.edges.filter(e => e.target === 'session:l2').length, 0);
  assert.equal(g.edges.filter(e => e.source === 'session:l2').length, 1); // only its work: no facet known
  assert.equal(g.nodes.find(n => n.id === 'energy:make').source_file, ''); // a concept, never a hub
});

test('Louvain splits two cliques joined by one edge, the same way every time', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const links = [['a', 'b'], ['a', 'c'], ['b', 'c'], ['d', 'e'], ['d', 'f'], ['e', 'f'], ['c', 'd']];
  assert.deepEqual(louvain(ids, links), [['a', 'b', 'c'], ['d', 'e', 'f']]);
  assert.deepEqual(louvain([...ids].reverse(), [...links].reverse()), louvain(ids, links));
});

test('every session gets a community and a degree; communities are named by their hub', () => {
  const out = galaxy(rows);
  assert.deepEqual(galaxy(rows), out);
  assert.ok(out.sessions.every(s => Number.isInteger(s.c) && s.deg >= 1));
  assert.equal(out.sessions.find(s => s.k === 'k3').core, true);
  assert.equal(out.sessions.find(s => s.k === 'k2').p, 'k1');
  const kiln = out.sessions.find(s => s.k === 'k1').c;
  assert.equal(out.communities.find(c => c.c === kiln).label, 'Kiln glazes'); // its best-connected node, degree 5
  assert.deepEqual(out.works, [{ w: 'kiln', label: 'Kiln' }, { w: 'loom', label: 'Loom' }]);
  assert.deepEqual(out.gods.slice(0, 3), [
    { label: 'Kiln firing log', degree: 5, kind: 'session' }, { label: 'Kiln glazes', degree: 5, kind: 'session' },
    { label: 'Kiln', degree: 3, kind: 'session' }]); // a tie in degree and name goes to the id
  assert.equal(out.sessions.reduce((n, s) => n + 1, 0), out.communities.reduce((n, c) => n + c.n, 0));
});

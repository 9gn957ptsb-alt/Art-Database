// The Session Galaxy as a knowledge graph, after Graphify (github.com/Graphify-Labs/graphify, Apache-2.0):
// every session, work and facet is a node, and every edge says how it is known, EXTRACTED (read from the
// session list: a title, a parent) or INFERRED (a facet Claude read from a title and a status line). Communities
// come from Louvain, Graphify's own fallback when Leiden is not installed; hubs and bridges follow its rules.
// In: the galaxy's rows (callno: a call number; `call` would read as a method in the doc's widgets). Out: the same rows with their community and degree, and the graph in Graphify's
// extraction schema. Titles are the artist's: they pass through, never into the repository.
import { readFileSync } from 'node:fs';

// A call number carries its facets in Ranganathan's signs: work ,part ;matter :energy .space 'time.
export function facets(call) {
  const [, work, matter, energy, space] = call.match(/^([^,;:.']+)(?:,[^;:.']*)?(?:;([^:.']+))?(?::([^.']+))?(?:\.([^']+))?/) || [];
  return { work, matter, energy, space };
}

const FACETS = [['matter', 'handles'], ['energy', 'did'], ['space', 'lands_in']];

export function graph({ works = {}, sessions }) {
  const nodes = new Map(), edges = [];
  const node = (id, label, source_file = '') => nodes.has(id) || nodes.set(id, { id, label, source_file });
  const keys = new Set(sessions.map(s => s.k));
  for (const s of sessions) {
    const f = facets(s.callno), id = `session:${s.k}`;
    node(id, s.t, 'list_sessions');
    node(`work:${f.work}`, works[f.work] || f.work, 'list_sessions');
    edges.push({ source: id, target: `work:${f.work}`, relation: 'serves', confidence: 'EXTRACTED' });
    if (keys.has(s.p)) edges.push({ source: `session:${s.p}`, target: id, relation: 'started', confidence: 'EXTRACTED' });
    for (const [kind, relation] of FACETS) {
      if (!f[kind]) continue; // a facet not known yet is left out, as in the catalog
      node(`${kind}:${f[kind]}`, f[kind]); // a concept: no source file, so never a hub (Graphify's rule)
      edges.push({ source: id, target: `${kind}:${f[kind]}`, relation, confidence: 'INFERRED' });
    }
  }
  return { nodes: [...nodes.values()], edges };
}

// Louvain (Blondel et al., 2008): move each node to the neighbouring community that raises modularity most,
// until none moves; fold each community into one node; repeat while a fold merges anything. Nodes are visited
// in sorted order and ties keep the node where it is, so the same graph always splits the same way.
export function louvain(ids, links) {
  let adj = new Map(ids.map(i => [i, new Map()]));
  const link = (g, a, b, w) => {
    g.get(a).set(b, (g.get(a).get(b) || 0) + w);
    if (a !== b) g.get(b).set(a, (g.get(b).get(a) || 0) + w);
  };
  for (const [a, b] of links) link(adj, a, b, 1);
  const member = new Map(ids.map(i => [i, i]));
  for (;;) {
    const k = new Map([...adj].map(([i, nb]) => [i, [...nb].reduce((s, [j, w]) => s + (j === i ? 2 * w : w), 0)]));
    const m2 = [...k.values()].reduce((a, b) => a + b, 0);
    const comm = new Map([...adj.keys()].map(i => [i, i])), tot = new Map(k);
    let moved = false;
    for (let again = m2 > 0; again;) {
      again = false;
      for (const i of [...adj.keys()].sort()) {
        const ci = comm.get(i), ki = k.get(i), w = new Map();
        for (const [j, x] of adj.get(i)) if (j !== i) w.set(comm.get(j), (w.get(comm.get(j)) || 0) + x);
        tot.set(ci, tot.get(ci) - ki);
        let best = ci, gain = (w.get(ci) || 0) - tot.get(ci) * ki / m2;
        for (const c of [...w.keys()].sort()) {
          const g = w.get(c) - tot.get(c) * ki / m2;
          if (g > gain + 1e-12) [best, gain] = [c, g];
        }
        tot.set(best, tot.get(best) + ki);
        if (best !== ci) { comm.set(i, best); moved = again = true; }
      }
    }
    if (!moved) break;
    const next = new Map([...new Set(comm.values())].map(c => [c, new Map()]));
    for (const [i, nb] of adj) for (const [j, x] of nb) if (i <= j) link(next, comm.get(i), comm.get(j), x);
    adj = next;
    for (const [i, c] of member) member.set(i, comm.get(c));
  }
  const groups = new Map();
  for (const i of [...ids].sort()) groups.set(member.get(i), [...(groups.get(member.get(i)) || []), i]);
  return [...groups.values()].sort((a, b) => b.length - a.length || (a.at(0) < b.at(0) ? -1 : 1));
}

export function galaxy(rows) {
  const g = graph(rows);
  const degree = new Map(g.nodes.map(n => [n.id, 0]));
  for (const e of g.edges) for (const end of [e.source, e.target]) degree.set(end, degree.get(end) + 1);
  const label = new Map(g.nodes.map(n => [n.id, n.label]));
  const real = id => g.nodes.find(n => n.id === id).source_file !== '';
  const groups = louvain(g.nodes.map(n => n.id), g.edges.map(e => [e.source, e.target]));
  const of = new Map(groups.flatMap((ids, c) => ids.map(id => [id, c])));
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const byDegree = (a, b) => degree.get(b) - degree.get(a) || cmp(label.get(a), label.get(b)) || cmp(a, b);
  // Each community takes the name of its best-connected real node, as Graphify labels by hub.
  const communities = groups.map((ids, c) => ({
    c, label: label.get([...ids].filter(real).sort(byDegree).at(0) ?? ids.at(0)), n: ids.filter(id => id.startsWith('session:')).length,
  }));
  const gods = g.nodes.map(n => n.id).filter(real).sort(byDegree).slice(0, 5)
    .map(id => ({ label: label.get(id), degree: degree.get(id), kind: id.split(':').at(0) }));
  const RANK = { AMBIGUOUS: 0, INFERRED: 1, EXTRACTED: 2 };
  const bridges = g.edges.filter(e => real(e.source) && real(e.target) && of.get(e.source) !== of.get(e.target))
    .sort((a, b) => RANK[a.confidence] - RANK[b.confidence] || degree.get(b.source) + degree.get(b.target) - degree.get(a.source) - degree.get(a.target))
    .slice(0, 3).map(e => ({ from: label.get(e.source), relation: e.relation, to: label.get(e.target), confidence: e.confidence }));
  const sessions = rows.sessions.map(s => ({
    k: s.k, t: s.t, w: facets(s.callno).work, callno: s.callno, d: s.d, now: s.now,
    ...(s.p && { p: s.p }), ...(s.core && { core: true }),
    c: of.get(`session:${s.k}`), deg: degree.get(`session:${s.k}`),
  }));
  const works = [...new Set(sessions.map(s => s.w))].map(w => ({ w, label: rows.works?.[w] || w }));
  return { sessions, works, communities: communities.filter(c => c.n), gods, bridges, graph: g };
}

if (process.argv[1]?.endsWith('galaxy.mjs')) {
  console.log(JSON.stringify(galaxy(JSON.parse(readFileSync(process.argv[2] || 0, 'utf8'))), null, 1));
}

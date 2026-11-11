"""The galaxy's graph through Graphify itself (github.com/Graphify-Labs/graphify, Apache-2.0).

galaxy.mjs writes the session graph in Graphify's extraction schema with its own communities. This script hands
that graph to Graphify's library and puts Graphify's communities, cohesion, hubs and surprising links in their
place, so the GamePlan page shows what Graphify found. Without Graphify installed it changes nothing and says so.

Run: uv run --no-project --with graphifyy==0.9.106 python 5s/gameplan/galaxy_graphify.py galaxy.json [graph.json]
The second path, if given, gets Graphify's own graph.json, for `graphify explain|path|query --graph`.
"""
import json
import sys
from importlib.metadata import version


def enrich(data):
    from graphify.analyze import god_nodes, surprising_connections
    from graphify.build import build_from_json
    from graphify.cluster import cluster, label_communities_by_hub, score_all

    # dedup=False: two sessions may share a title, and they are still two sessions.
    G = build_from_json(data["graph"], dedup=False)
    groups = cluster(G)
    labels, cohesion = label_communities_by_hub(G, groups), score_all(G, groups)
    of = {node: c for c, nodes in groups.items() for node in nodes}
    for s in data["sessions"]:
        s["c"], s["deg"] = of[f"session:{s['k']}"], G.degree(f"session:{s['k']}")
    for n in data["graph"]["nodes"]:
        n["community"] = of[n["id"]]
    data["communities"] = [
        {"c": c, "label": labels[c], "n": sum(1 for i in nodes if i.startswith("session:")),
         "size": len(nodes), "cohesion": round(cohesion[c], 2)}
        for c, nodes in sorted(groups.items())
    ]
    data["gods"] = [{"label": g["label"], "degree": g["degree"], "kind": g["id"].split(":")[0]} for g in god_nodes(G, top_n=5)]
    data["bridges"] = [
        {"from": b["source"], "relation": b["relation"], "to": b["target"], "confidence": b["confidence"], "note": b.get("note", "")}
        for b in surprising_connections(G, groups, top_n=5)
    ]
    try:
        import graspologic_native  # noqa: F401  Graphify uses Leiden when this is installed
        method = "Leiden"
    except ImportError:
        method = "Louvain"
    data["engine"] = f"Graphify {version('graphifyy')} · {method}"
    return G, groups


if __name__ == "__main__":
    path = sys.argv[1]
    data = json.load(open(path, encoding="utf-8"))
    try:
        G, groups = enrich(data)
    except ImportError:
        print("Graphify is not installed: galaxy.mjs's own communities are kept.")
        sys.exit(0)
    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if len(sys.argv) > 2:
        from graphify.export import to_json
        to_json(G, groups, sys.argv[2], force=True)
    print(data["engine"], "·", len(data["communities"]), "communities")

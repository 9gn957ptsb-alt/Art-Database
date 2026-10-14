#!/usr/bin/env python3
"""Building heights from EUBUCCO's registers, for build_grounds.py: Spain's Catastro and France's BD TOPO.

Overture's buildings have a height for few of them (Madrid's 64% stood at two storeys; Paris's 34%), so a
block of five or seven storeys was drawn as a row of two. EUBUCCO (Milojevic-Dupont et al., Scientific Data
2023; v0.1, ODbL 1.0) carries each building's height from its country's register — in Spain the Catastro's
floors (the heights come in steps of 2.5 m), in France the BD TOPO's — on the Source Cooperative's mirror that
build_built_years.py already reads the buildings' years from (data/eubucco/<H3 cell>.parquet, one file an H3
cell; downloaded once). Where a building's height is Overture's it stays; the cells that stand at the
default two storeys for want of one take EUBUCCO's, where it is a storey higher or more.

Only where its source is a register: Spain, and France without Belgium, Switzerland or Italy (the same
boxes the years are read in: EUBUCCO_AT). For Brussels its heights are not a register's (their median is
6 m; they follow Overture's where both exist at r = 0.35), so it is not used there. Madrid's, where both
exist, follow Overture's at r = 0.67 with the same median (5 storeys); Paris's at r = 0.49 (6).
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


def covers(lat, lon):
    """A place in Spain or France, where EUBUCCO's heights are a register's."""
    import build_built_years as BBY
    return any(a <= lat <= c and b <= lon <= d for a, b, c, d in BBY.EUBUCCO_AT)


def polygons(box):
    """[(metres, polygon)] for the buildings with a height in the box (south, west, north, east)."""
    import pyarrow.parquet as pq
    import shapely
    import build_built_years as BBY
    s, w, n, e = box
    out = []
    for _, path in BBY.eubucco_paths(box):
        pf = pq.ParquetFile(path)
        for g in range(pf.num_row_groups):
            t = pf.read_row_group(g, columns=["height", "bbox"]).to_pydict()
            keep = [k for k, (h, b) in enumerate(zip(t["height"], t["bbox"]))
                    if h and b and b["xmax"] >= w and b["xmin"] <= e and b["ymax"] >= s and b["ymin"] <= n]
            if not keep:
                continue
            geom = pf.read_row_group(g, columns=["geometry"]).column(0).to_pylist()
            for k in keep:
                out.append((float(t["height"][k]), shapely.from_wkb(geom[k])))
    return out

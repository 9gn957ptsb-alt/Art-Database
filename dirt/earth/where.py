#!/usr/bin/env python3
"""Ask the DIRT Earth atlas about a place: everything it knows there, from realm to rain.

    python3 dirt/earth/where.py 47.0 -108.0 [--out dirt/earth/out]
"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent


class Atlas:
    def __init__(self, out):
        self.out = Path(out)
        self.meta = json.loads((self.out / "atlas.json").read_text())
        self._img = {}

    def px(self, name, lat, lon):
        if name not in self._img:
            self._img[name] = np.asarray(Image.open(self.out / name).convert("RGB")).astype(int)
        j = min(719, max(0, int((90 - lat) / 0.25)))
        i = int(((lon + 180) % 360) / 0.25) % 1440
        return self._img[name][j, i]

    def month(self, prefix, m, lat, lon):
        return self.px(f"{prefix}-{m // 3}.png", lat, lon)[m % 3]

    def at(self, lat, lon):
        M = self.meta
        pl, cl, te, gr, vw, wa, sk, rg = (self.px(n, lat, lon) for n in
                                           ("place.png", "class.png", "terrain.png", "ground.png", "view.png", "water.png", "sky.png", "range.png"))
        land = pl[2] < 254
        eco = M["ecoregions"][pl[0] + 256 * pl[1]] if land and (pl[0] or pl[1]) else None
        T = [self.month("temp", m, lat, lon) / 255 * 127.5 - 60 for m in range(12)]
        P = [math.expm1(self.month("rain", m, lat, lon) / 255 * math.log1p(60)) for m in range(12)]
        C = [self.month("cloud", m, lat, lon) / 255 * 100 for m in range(12)]
        CT = [M["cloud_types"][self.month("cloudtype", m, lat, lon)]["name"] for m in range(12)]
        S = [self.month("snow", m, lat, lon) / 255 for m in range(12)]
        out = {
            "where": f"{lat:.2f}, {lon:.2f}",
            "surface": "land" if land else ("lake" if pl[2] == 254 else "sea"),
            "elevation m": int(te[0] + 256 * te[1] - 11000),
            "relief m": round(math.expm1(te[2] / 255 * math.log1p(8000))),
        }
        if land:
            out.update({
                "realm": M["realms"][eco["realm"]] if eco else None,
                "biome": M["biomes"][pl[2]] if pl[2] < len(M["biomes"]) else None,
                "ecoregion": eco["name"] if eco else None,
                "koppen": f'{M["koppen"][cl[0]]["code"]} {M["koppen"][cl[0]]["name"]}' if cl[0] < 255 else None,
                "holdridge": M["holdridge"][cl[1]],
                "soil": M["soils"][gr[0]]["name"],
                "canopy m": round(gr[1] / 255 * 45, 1),
                "aridity P/PET": round(math.exp(gr[2] / 255 * (math.log(30) - math.log(1e-3)) + math.log(1e-3)), 3),
            })
        else:
            out.update({"sea zone": M["marine"][wa[1]]["name"] if wa[1] < 255 else None, "water": M["warmth"][wa[2]]})
        out.update({
            "temperature C by month": [round(t) for t in T],
            "annual range C": round(rg[0] / 255 * 70, 1),
            "daily range C": round(rg[1] / 255 * 30, 1),
            "rain mm/month": [round(p * d) for p, d in zip(P, [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])],
            "cloud % by month": [round(c) for c in C],
            "cloud types": sorted(set(CT), key=CT.index),
            "snow or ice by month": [round(s, 1) for s in S],
            "haze AOD": round(sk[0] / 255 * 1.5, 2),
            "clear days": f"{round(sk[1] / 255 * 100)}%",
            "view km": round(math.exp(vw[0] / 255 * (math.log(300) - math.log(0.05)) + math.log(0.05)), 1),
            "openness": round(vw[1] / 255, 2),
            "big sky": round(vw[2] / 255, 2),
        })
        return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lat", type=float)
    ap.add_argument("lon", type=float)
    ap.add_argument("--out", default=str(HERE / "out"))
    args = ap.parse_args()
    print(json.dumps(Atlas(args.out).at(args.lat, args.lon), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()

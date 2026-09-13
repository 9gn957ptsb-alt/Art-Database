#!/usr/bin/env python3
"""Export the objects as voxel models for the browser to render.

Until now the views were rasterised here and shipped as pictures: four fixed
corners per object. That cannot give a camera you can move. It also could not
show these objects turning at all — the amphora, column, waterfall and ball are
solids of revolution, so a quarter turn produces very nearly the same image, and
four corners of a rotationally symmetric thing is four of the same picture.

So the geometry ships instead and the page projects it. That is smaller, not
larger: 62,000 surface voxels against 5.4 MB of pre-rendered grids.

Two things make it work.

ONLY SURFACE VOXELS ARE SENT, each carrying a six-bit mask of which of its faces
are exposed. A voxel walled in on all six sides can never be seen from any angle,
and a face with a neighbour against it can never be seen either. Sending the mask
rather than the neighbours means the renderer never has to look a neighbour up:
it draws the exposed faces that happen to point at the camera, and nothing else.

REGIONS ARE COMPUTED IN THREE DIMENSIONS, not on the screen. A region used to be
a connected patch of the rendered image, which was fine while the view was fixed
and useless once it moves — the patches would be redrawn every frame and the
artwork behind a shape would change as you turned it. A region is now a connected
run of voxels at the same lit step, which is a property of the object rather than
of the camera. Turn it however you like: the same shape keeps the same work.

Lighting is baked here for the same reason it can be: the light is fixed in the
world, so how lit a face is does not depend on where the camera stands.

Writes data/voxels.json.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import iso                                              # noqa: E402
import build_iso as B                                   # noqa: E402
from motion import open_colors, slot_cycle              # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
OUT_PATH = ROOT / "data" / "voxels.json"

# The six face directions, in the order the mask bits are packed. The renderer
# relies on this order, so it is written down once and shared.
DIRS = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


def lit_slots(vox, known=None):
    """The ramp step each voxel actually shows, lighting included."""
    norm = iso.normals(vox, known)
    return {k: v[0] + iso.shade(norm[k]) for k, v in vox.items()}


def surface(vox):
    """Voxels with an exposed face, and the mask of which faces those are."""
    out = {}
    for k in vox:
        mask = 0
        for i, (dx, dy, dz) in enumerate(DIRS):
            if (k[0] + dx, k[1] + dy, k[2] + dz) not in vox:
                mask |= 1 << i
        if mask:
            out[k] = mask
    return out


def regions_3d(lit, keys):
    """Connected runs of equal lit step, six-connected, over the surface only.

    Six-connected rather than the eighteen or twenty-six that also join across
    edges and corners: two faces meeting at an edge are two planes to the eye,
    and joining them would run one artwork around a corner that reads as a
    boundary.
    """
    label, order = {}, []
    for start in keys:
        if start in label:
            continue
        step, idx = lit[start], len(order)
        stack, size = [start], 0
        label[start] = idx
        while stack:
            k = stack.pop()
            size += 1
            for dx, dy, dz in DIRS:
                n = (k[0] + dx, k[1] + dy, k[2] + dz)
                if n in keys and n not in label and lit.get(n) == step:
                    label[n] = idx
                    stack.append(n)
        order.append((step, size))
    return label, order


def main():
    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found.")
    colors = open_colors(DB_PATH)

    objects, artworks, art_index, palette, pal_index = [], [], {}, [], {}
    built = []
    for key, name, make in B.STILL:
        vox, norm, r = make()
        built.append((key, name, [B.with_ground(vox, norm, B.plan_half(vox))], r, 900))
    for key, name, make, ms in B.MOVING:
        frames, r = make()
        built.append((key, name, frames, r, ms))

    for key, name, frames, ramp, frame_ms in built:
        pools = [slot_cycle(colors, t, B.SLOT_MIN, 160, tol_start=12, tol_stop=96)[0]
                 for t in ramp]
        taken = [0] * len(ramp)
        region_colour, packed_frames = [], []
        lo = [1e9] * 3
        hi = [-1e9] * 3

        for model, known in frames:
            lit = lit_slots(model, known)
            skin = surface(model)
            label, found = regions_3d(lit, skin)
            base = len(region_colour)
            for step, _size in found:
                step = max(0, min(len(ramp) - 1, step))
                pool = pools[step]
                c = pool[taken[step] % len(pool)]
                taken[step] += 1
                if c["id"] not in art_index:
                    art_index[c["id"]] = len(artworks)
                    artworks.append([c["id"], c["title"], c["artist"]])
                k2 = (c["hex"], c["id"])
                if k2 not in pal_index:
                    pal_index[k2] = len(palette)
                    palette.append([c["hex"], art_index[c["id"]]])
                region_colour.append(pal_index[k2])

            flat = []
            for k, mask in skin.items():
                flat += [k[0], k[1], k[2], mask, base + label[k]]
                for a in range(3):
                    lo[a] = min(lo[a], k[a])
                    hi[a] = max(hi[a], k[a] + 1)
            packed_frames.append(flat)

        objects.append({
            "key": key, "name": name,
            "frames": len(frames), "frameMs": frame_ms,
            "lo": lo, "hi": hi,
            "vox": packed_frames, "regions": region_colour,
        })
        print(f"  {name:16s} {sum(len(f)//5 for f in packed_frames):6d} surface voxels, "
              f"{len(frames):2d} frames, {len(region_colour):5d} regions")

    OUT_PATH.write_text(json.dumps(
        {"artworks": artworks, "palette": palette, "objects": objects,
         "dirs": DIRS, "shadeRange": iso.SHADE_RANGE},
        separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1_000_000:.2f} MB, "
          f"{len(palette)} colours across {len(artworks)} works)")


if __name__ == "__main__":
    main()

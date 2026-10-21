# Residential model database

SketchUp models of the residential projects the artist bookmarked on Architectural Authority
(AA's own "Residential" category), each built as accurately as its published drawings allow,
with every room its own group so a room can be pulled out without the rest of the house.

## Why it is data first

The SketchUp connector can build and save models but cannot open an existing `.skp`. So the
database is the data and the code that builds from it; the `.skp` files are its output:

| Path | What |
| --- | --- |
| `projects/<slug>.json` | One project: levels, rooms traced from its plans, walls, openings, heights, sources. Format: [SCHEMA.md](SCHEMA.md). |
| `skp/<slug>.skp` | The SketchUp model built from it. |
| `index.json` | Every room of every project: type, level, area, ceiling height, doors and windows, confidence, and where it sits in its `.skp`. |
| `tools/` | The compiler and the SketchUp engine. |

## Inside each `.skp`

```
<Project>                      group
  L0 Ground floor              group, tag "Level · L0 Ground floor"
    Living room                group, tag "Room · Living", attribute dictionary "residential_db"
      Floor                    solid
      Wall 1 (ext)             solid, openings cut through
      Window glass (wall 1)    solid
      Roof                     solid, tag "Roofs"
    Kitchen ...
  L1 First floor ...
```

Each room holds its own floor, its share of the walls (a wall between two rooms is split down
its centreline; a wall between a room and a terrace belongs to the room) and its roof, so the
pieces of a house fit back together without overlapping. Every piece is a closed SketchUp
solid. The room group's `residential_db` dictionary carries its id, type, level, area, ceiling
height, confidence and sources. Scenes: "All levels", and one per level with the other levels
and the roofs hidden.

## Building

```bash
python3 residential/tools/rdb.py residential/projects/<slug>.json --out residential/build
python3 residential/tools/check.py residential/build/<slug>.plan.json       # closed, no overlaps
python3 residential/tools/preview.py plan residential/build/<slug>.plan.json residential/build/prev
python3 residential/tools/preview.py overlay residential/build/<slug>.plan.json S1 plan.png out.png
python3 residential/tools/engine.py residential/build/<slug>.plan.json residential/build/calls/<slug>
```

Then run `calls/<slug>/*.py` in order as `build_model` code (the first with `clean: true`) and
`save_model` with filename `<slug>.skp`; fetch the download link with `curl -sSL` into `skp/`.
The setup call carries `tools/primitives.py`, so SketchUp builds each solid with the same code
the compiler checked, and each rooms call reports any solid whose SketchUp volume differs from
the compiler's.

To reuse rooms in a new model, take their entries from the project files (or pick them from
`index.json`), place them in a new project file, and build it the same way.

`build/` is generated and not committed.

# Geometry engine

## The model format

A project model is one JSON file (schema `mh-web/1`): metres, z up, 1 mm precision.
- `materials`: name, colour, texture average.
- `groups`: id, parent, name, label, kind (group | component), zone, hidden, bbox, xform (3x3 + translation), faces
  (`[matIndex, [outer x,y,z,...], [hole]...]`, counter-clockwise seen from the front), faces_back, edges (visible segments).
- `zones`, `camera`, `conventions` (the format's own rules), `seats` (walk mode), optional `page` settings.
The format came from a SketchUp export and is what the 3D viewer and walk mode read. It is geometry with names: building elements
are not stored as such. A second model can be BUILT from an element spec (the deck: a spec of elements in feet with written
dimensions, built deterministically with shapely into the same format and measured back against every written dimension).

## Edits

Every change is a tool that reads a model and writes a new one; tools run in a canonical order on a base model, so the whole
history can be replayed, a tool removed (undo) or reordered. Companion steps run after every composition: a sync that keeps derived
twins of rooms in step (and refuses when a twin looks edited on its own), and a solid-validation step. The composer prints the
changed, added and removed group ids and the new model hash.

## The element index (Phase 1)

`elements.json` is derived from the model at every landing by the same recognisers the drawing engine uses, so the index and the
drawings cannot disagree:
- levels: floor heights and plan regions per storey;
- rooms: a room table measured against floor regions (number, name, level, floor and ceiling heights, area);
- walls: centrelines and measured thicknesses matched to the wall types;
- doors and windows: from door data groups and glass faces (width, height, sill, head, host wall, marks);
- stairs: flights with every riser height and going, the walking path;
- columns, fixtures, guards, roofs, glass classes, pipes (when a plumbing design has landed).
Ids are marks where the engine gives one, else type + level + a stable sequence by position. `changed_in` links each element to
the change records that touched its groups.

## The drawing engine

- A base engine draws plans (a cut a set height above each floor, stepped where floors step), sections along a plane, elevations,
  and schedules from the model, and writes each sheet three ways: DXF (layers by a CAD naming standard, one block per view in model
  metres), SVG and PDF (vector), plus a PNG for checks. Every sheet carries DRAFT and NOT FOR CONSTRUCTION, the model hash, sheet
  i of N and its date.
- Modules add sheet families: annotated plans (dimensions with a node table, tags, grid, section and elevation marks, stair arrows,
  alarms, level tags), elevations and sections, developed elevations of curved walls, reflected ceiling plans, roof plans, schedules,
  enlarged plans and interior elevations, wall sections, wall types and assemblies.
- A run list names the command for each sheet; a redraw command re-runs it on a new model, copies the results to the page and
  rebuilds the sheet index in the set's order. A sheet whose check has a FAIL line stops the landing.

## Read-back checks

After drawing, each module reads its own DXF back and measures it against the model: every dimension text equals its line's
length (1/16 in.), every end lies on a wall centreline, tags equal the element lists, section marks' ends equal the planes printed
on the section sheets (1 mm), call-outs name sheets of the set, extents equal the model's (1 mm), schedule rows equal the elements,
the sheet carries its stamps and no word that claims code compliance, and no address or personal name.

## Revisions (Phase 1)

A sheet's revision advances only when its drawing changes: the new PNG is compared with the archived one (title block masked;
changed pixels grouped into boxes), the boxes become revision clouds in sheet units, the title block prints the new revision and
date, and the previous drawing is archived for the compare view.

## Libraries

shapely (2D geometry), numpy, ezdxf (DXF, vendored), reportlab (PDF), Pillow (raster diff), pydantic and jsonschema (file
schemas); three.js in the page. IfcOpenShell for IFC export is planned (BIM_INTEROPERABILITY.md). OpenCascade is not needed for
the current work (no B-rep booleans beyond what the tools do in 2D and on faces).

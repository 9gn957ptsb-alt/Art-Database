# BIM interoperability

What each format does today, what is planned, and how it is tested. Nothing is claimed as supported until an independent reader
has opened it.

| Format | Today | Planned | Test |
|---|---|---|---|
| PDF | one vector PDF per sheet, correct paper size, text as text; a weekly red-line PDF built in the page | a set PDF in sheet order with bookmarks (Phase 1, needs PyMuPDF in a project venv) | page count, sizes, bookmarks equal the index; text extracted with pdfplumber equals the sheet's text |
| SVG | one per sheet, served with the page, used by the drawer viewer | unchanged | the drawer's own read of the title block (revision, date, model hash) |
| PNG | one per sheet for checks; red-line pictures | previews in the drawer (optional) | width as specified |
| DXF | written for every sheet (R12, layers, a block per view in model metres, text, dimensions as line + witness lines + text) and read back by each module's check | served with the page as R2010 (UTF-8) if the page accepts the type, else offered through the page's downloads capability | ezdxf audit with no errors; the read-back check on the converted file; scale and units by a measured dimension; opened in an independent CAD application by a person before "supported" is claimed |
| CSV | none | door, window, room-finish and fixture schedules (Phase 1) | every row equals the drawn schedule's row read back from the DXF |
| JSON | the model file itself | the element index and the CD data files (Phase 1) | schema validation; determinism (same inputs, same bytes) |
| IFC | none | IFC4 export with IfcOpenShell from the element index: site, building, storeys, spaces, walls, doors and windows with openings, stairs, columns, slabs, roofs, materials and property sets (Phase 6) | ifcopenshell validation; a re-import that counts elements by type against the index; an independent viewer opened by a person |
| DWG, RVT | none | not planned: no licensed converter here; DXF is the exchange format | not claimed |
| OBJ, STL, GLB | none | GLB from the viewer's scene if asked | an independent viewer |

## Rules

- Do not claim native DWG or Revit support.
- Units and scale are part of every export: metres in the model, inches on paper, the scale written on the sheet and in the DXF
  view block.
- Layers follow a CAD layer-naming standard (discipline - major - minor), the same on every sheet.
- An export is regenerated from the model; never edited by hand.
- Uploaded files (DXF, IFC, PDF plans) are inputs to an intake step (Phase 3) that records type, pages, units, scale (set by a
  known dimension, never assumed), coordinate system and confidence before anything is drawn from them.

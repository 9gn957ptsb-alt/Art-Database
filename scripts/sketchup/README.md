# Buildings modelled in SketchUp

For forms the part types in `docs/v2/models/MODELS.md` can't shape (curving
sails, shells, carved volumes), a building is modelled in the artist's
SketchUp through the Trimble SketchUp connector, then read back as triangle
meshes into its `docs/v2/models/<slug>.json`, where `docs/v2/models.js` fills
them in as DIRT voxels like any other part.

1. **Build.** Run the building's `<name>.py` as the `code` of the connector's
   `build_model` tool (with `clean: true` the first time). It is plain
   connector Python: no imports, inches, SketchUp axes (X east, Y north, Z up).
   Before a first build in a session, the connector asks for its baseline
   skills to be read (`list_skills`, then `read_skill` for each baseline one).
2. **Look.** `save_model` returns a thumbnail (base64 in the result) and a
   temporary download link for the `.skp`, which goes to the artist. The
   camera is true isometric: parallel projection down the (1, −1, −1)
   diagonal, the same view the site rests on.
3. **Read back.** Run `read_back.py` as `build_model` code. Its result (large;
   the tool saves it to a file) is `{material: {"v": [...], "f": [...]}}` in
   metres, y flipped to the site's south-positive axis.
4. **Convert.** `python3 scripts/sketchup/to_model.py <saved result> <model.json>`
   replaces the model's parts with the meshes (keeping its trees), mapping
   SketchUp material names to the site's (`MATERIALS` in the script).
5. **Check.** `node scripts/preview_model.js <model.json> out.png`.

The `.skp` files are kept in `sketchup/` at the top of the repository (outside
`docs/`, so they are not published with the site). `save_model`'s link
redirects to Trimble's S3 bucket; fetch it with redirects followed:

    curl -sSL -o sketchup/<name>.skp '<download_url>'

(`api.sketchup.com` is allowed under the environment's Network access.)

Built so far: Walt Disney Concert Hall (the whole building) and Guggenheim
Bilbao (the titanium only — `to_model.py … --keep-except blob` keeps the
model's straight parts and replaces its blobs with the meshes).

Not a building: the artist's impossible triangle (three tribars round a gap),
Rocket's block (`impossible_triangle.py`, `sketchup/impossible-triangle.skp`).
Six square bars on the edges of a lattice of 18 in cells, 4 in square, fitted
to the drawing; they close into it only seen down the (1, 1, 1) diagonal in
parallel projection, which is its first scene ("The drawing", the camera rolled
so the triangle stands on its base; "Turned" shows the bars not meeting). Its
faces are flat tones by the axis they face (X grey, Y black, Z white; no sun on
them). It is not read back: `docs/worlds/rocket/rocket.js` keeps its six bars as
`FIGURE`, in the block's unit, and draws every block as it.

And its studies in 3D (`impossible_triangle_studies.py`,
`sketchup/impossible-triangle-studies.skp`): the ten objects that all draw the
figure, in a row, each a group of its parts (tribars, copies, storeys) and each
beam a solid, made by the same rules as `scripts/figure_studies.py` (which
writes them for the site and the game). Boxes are quads; a beam drawn in
towards an eye (one point) is its eight corners, its faces still planes; a bent
beam is triangles softened where it bends. The scenes are all of them, then
each where it closes: down the diagonal in parallel projection, the tower from
each of its four corners, one point from its eye in perspective. Run it with
`clean: true`; it reports any beam that is not a closed solid (none).

**Storage.** Git keeps every version of a binary for good, so a `.skp` is
re-committed only when a building's form really changes — not on every small
refinement. The build script is the source of truth and regenerates the
file exactly. (The artist decided, 24 Sep 2026, not to copy `.skp` files into
his Obsidian vault: uploading through the Drive connector costs too much
usage per file.)


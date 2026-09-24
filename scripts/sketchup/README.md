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

# Colour Middling

A searchable database of ~4,969 Artsy-saved artworks, and pixel objects generated from
their dominant colours. See `README.md` for how the pipeline works, what each script
does, and the rules the objects are built under.

Two things are standing decisions rather than preferences:

- **One artifact.** Everything generated from the collection's colours lives in a single
  published artifact and is republished to the same URL. Never publish a new artifact
  per object.
- **No text on the object page.** Category names, object names and the aesthetic feedback
  only. Notes, build records and provenance live in `README.md` and `scripts/motion.py`.

## "Add this to my notes"

When Matt says **"Add this to my notes…"** — or anything of that shape — he means one
specific document: **`Notes.md` in the `Obsidian Vault` folder of his Google Drive.**
It is a single running journal with one entry per question. Never create a second file.

Find it **by name, never by a stored ID.** Google Drive's tools can update a file's
metadata but not its content, so every append rewrites the file and issues a new file
ID; any ID written down here would be stale by the next append.

```
search_files → title = 'Notes.md' and parentId = '1QT55xwLhUdz5zlA1uSJb2IYW7uLJ_gnF'
```

That parent is `Obsidian Vault` at Drive root. If the folder ID has moved, search
`title contains 'Obsidian Vault' and mimeType = 'application/vnd.google-apps.folder'`.

To append:

1. `download_file_content` on the current `Notes.md`.
2. Add the new entry at the end of the entry stream, before the final `Log` block, and
   add its line to the **Entries** index at the top.
3. Append a dated line to the **Log**.
4. `create_file` — title `Notes.md`, same parent, `contentMimeType: text/markdown`,
   `disableConversionToGoogleType: true`.
5. `trash_file` the old one, last, and only once step 4 has returned a new file ID.

The document carries its own copy of this protocol and the entry format in a collapsed
block at the top. Read that block before writing, so the format stays consistent.

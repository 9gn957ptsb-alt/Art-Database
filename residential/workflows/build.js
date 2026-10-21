export const meta = {
  name: 'residential-build',
  description: 'Build verified residential projects in SketchUp one at a time, save, and download the .skp into residential/skp/',
  phases: [{ title: 'Build', detail: 'one project at a time through the SketchUp connector' }],
}

// args: {repo: absolute path of the checkout, work: a scratch directory, slugs: [project slugs]}
// Builds run one after another: the SketchUp connector keeps one model per session.
const REPO = args.repo
const SP = args.work
const SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    status: { type: 'string', enum: ['built', 'failed'] },
    skp_path: { type: 'string' },
    skp_bytes: { type: 'number' },
    solids_ok: { type: 'number' },
    solids_bad: { type: 'array', items: { type: 'string' } },
    attributes_written: { type: 'boolean' },
    thumbnail: { type: 'string', description: 'absolute path of the saved thumbnail png' },
    notes: { type: 'string' },
  },
  required: ['slug', 'status', 'solids_ok', 'solids_bad', 'notes'],
}
const out = []
for (const slug of args.slugs) {
  const r = await agent(`Build one residential project in SketchUp from its compiled plan and download the result. Repo: ${REPO}. Project: ${REPO}/residential/projects/${slug}.json.

1. From ${REPO}, run:
   python3 residential/tools/rdb.py residential/projects/${slug}.json --out ${SP}/rdb-build
   python3 residential/tools/check.py ${SP}/rdb-build/${slug}.plan.json 200      (must report 0 overlaps; if not, stop and report failed)
   python3 residential/tools/engine.py ${SP}/rdb-build/${slug}.plan.json ${SP}/rdb-build/calls/${slug}
   This writes 00-setup.py, 01-rooms.py ... 99-finish.py.
2. Load the SketchUp tools with ToolSearch query "select:mcp__Trimble_SketchUp__list_skills,mcp__Trimble_SketchUp__read_skill,mcp__Trimble_SketchUp__build_model,mcp__Trimble_SketchUp__save_model". As the build_model tool requires, call list_skills and read_skill for each baseline skill before the first build_model call.
3. Run each call file IN ORDER as the build_model 'code', passing the file's contents EXACTLY (read it with cat; do not edit or abbreviate it). The first (00-setup.py) with clean: true, the rest with clean false. Each rooms call returns {"ok": n, "bad": [...]}; record every bad entry. If a call errors, report it with the error text; do not improvise geometry.
4. Call save_model with filename "${slug}.skp" (keep_session default). Its result is large and is saved to a file: parse that JSON with python3 (it may be wrapped as [{"type":"text","text": "<json>"}]), take download_url, and decode thumbnail_base64 to ${SP}/rdb-build/${slug}-thumb.png.
5. mkdir -p ${REPO}/residential/skp and download: curl -sSL -o ${REPO}/residential/skp/${slug}.skp "<download_url>". Check with 'file' that it is a SketchUp Model and note its size. LOOK at the thumbnail with the Read tool and say in notes whether the model looks complete (walls, roofs, glazing) and anything odd.
Do not commit or push. Return the structured summary.`, { label: `build:${slug.slice(0, 40)}`, phase: 'Build', schema: SCHEMA })
  out.push(r || { slug, status: 'failed', solids_ok: 0, solids_bad: [], notes: 'agent returned nothing' })
}
return out

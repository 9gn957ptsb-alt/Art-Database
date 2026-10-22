# Handoff (22 Oct 2026)

The four workflow scripts the previous session ran (Claude Code Workflow tool), saved so a new
session can resume them: run one with `Workflow({scriptPath: "5s/handoff/<name>.workflow.js"})`
after replacing the `SCRATCH` constant at its top with the new session's scratchpad path.
Their agents write only where their prompts say; the lead commits.

| Script | State when paused |
| --- | --- |
| `links-and-free-plan.workflow.js` | Phase Build was running (connector free plan + links module); partial work committed. Then App, Verify. |
| `buildings-in-the-deck.workflow.js` | Gather finished (66 buildings, 924 photos in data/aa, not committed). Next: Define, Deck, Verify. |
| `set-match-saga.workflow.js` | Not started (its brief agent hit the usage limit). |
| `motion-favorites.workflow.js` | Brief, three refinement groups and families stamp, dive, neon, tiles done. Left: swarm, cast, the lab's For you view and mount into 5s, verify. |

`motion-brief.json` is that workflow's brief: the trends read from the artist's favorites, the
descriptor axes and tags for every family, and the six new families' specs.

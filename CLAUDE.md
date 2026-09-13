# Matthew Livingston — artist website

## Standing instruction

**Surface the later tasks when they become relevant.** `WIX.md` ends with a
numbered "Still to do" list. Whenever something in a conversation touches one of
those items — the topic comes up, the blocker clears, the artist supplies the
missing piece, or work is being done that would naturally carry it — say so and
offer to do it. Once, briefly, as an offer rather than a prompt to act.

Examples of the trigger: real photography arrives (items 2 and 6 become
possible); dimensions arrive (item 3); the artist mentions the Wix editor or
being at a computer (item 1); paintings are mentioned (item 5); the artist
describes what the token object is (item 7).

Don't recite the list unprompted, and don't re-raise an item the artist has
already declined or deferred in the same conversation.

## Where things are

| | |
| --- | --- |
| `docs/` | The reference page — plain HTML/CSS, no build step. Not the live site. |
| `docs/works.json` | The works, as data. Edit this, not `index.html`. |
| `scripts/build_page.py` | Renders `docs/index.html` from `works.json`. |
| `scripts/build_artifact.py` | Flattens the page for publishing as an Artifact. |
| `WIX.md` | The live Wix site: CMS schema, current rows, and the to-do list. |
| `scripts/fetch_artsy_saves.py` | Unrelated — a private reference database, never shown on the site. |

`docs/` and the Wix site are separate. Changes to one do not reach the other.

## Working preferences

- Don't paste the artifact or site link on every update — say it's done. Keep
  publishing the updated artifact each time, just without the link.
- The work photographs are placeholders until shot properly. Don't crop, retouch,
  or upload them to Wix Media.
- Don't invent artwork metadata. Titles and years come from the artist;
  dimensions are blank until given.

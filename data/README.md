# Game data (rulebook)

Authoritative Clash of Clans reference data: every entity's per-level upgrade
time, cost, and the Town Hall required for each level. This is the "rulebook"
(Layer A) — not player-specific. Player state (Layer B) comes from the official
API and the in-game village-data export.

## Source

`coc-static-data.json` is vendored from the
[`coc.py`](https://github.com/mathsman5133/coc.py) library
(`coc/static/static_data.json`), which is itself derived from Clash of Clans'
own game files. We verified its accuracy against clash.ninja and
ClashGuidesWithDusk (e.g. TH14 hero caps: BK/AQ 85, Grand Warden 60, Minion
Prince 60, Royal Champion 30 — all correct, unlike the outdated `coc-info`
package).

Entity `_id` values match the numeric IDs used by the in-game village-data
export, so this file also provides the ID -> name map needed to decode exports.

## Updating (after a game patch)

1. Download the latest file:
   `curl -sL -o data/coc-static-data.json https://raw.githubusercontent.com/mathsman5133/coc.py/master/coc/static/static_data.json`
2. Regenerate the slim app dataset: `npm run build:data`
3. Commit both files.

## Attribution

Game data and assets are property of Supercell. This is an unofficial fan
project; see Supercell's Fan Content Policy.

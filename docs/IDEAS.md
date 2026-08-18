# Clash of Clans Planner — Ideas Backlog

A living list of features and ideas. Edit freely. Each item has a status:
`done` · `in progress` · `next` · `later` · `idea`.

## Test player profile

- Tag `#Q8JJJ2UP`, TH13, Laboratory is the known bottleneck.
- **6 builders**: 5 gem-bought Builder's Huts + B.O.B (the 6th builder,
  unlocked via Builder Base / O.T.T.O). The two are independent unlocks, so a
  player can have fewer than 5 huts and still have B.O.B. For core time-to-max
  math B.O.B counts as a normal builder; a separate "includes B.O.B" flag is
  reserved for later event features (Goblin Builder temporary extra builder).
  (B.O.B is assigned manually like any builder.)

---

The core mental model is **tracks** that run in parallel. Time-to-max = the
slowest track.

- **Builder track** — N builders working through defenses, traps, resource/army
  buildings, **Heroes** (heroes require builders), and the Town Hall. Walls are
  effectively instant (no build time), ignored for now.
- **Laboratory track** — one serial track: troops, spells, and **Siege
  Machines**.
- **Pets track** — one serial track: the Pet House (TH14+).

Gold Pass maps onto tracks: **Builder Boost** discounts the Builder + Pets
tracks (buildings, heroes, pets, gear); **Research Boost** discounts the
Laboratory track. Both cut time and cost, up to 20% (10% ~Day 1, 15% ~Day 4,
20% ~Day 8, then steady for the season).

---

## Phase 1 — View village stats (foundations)

- [done] Scaffold Next.js + Convex + Tailwind, connect remote.
- [done] Convex action `fetchPlayer` via RoyaleAPI proxy; store snapshots.
- [done] `coc-info` TH-cap lookups (`getMaxLevel`).
- [done] Village stats view: heroes/pets/spells/troops/siege, current vs TH cap.
- [done] Progress bar with ticks for previous / current / next TH max levels
  (all from coc-info at th-1 / th / th+1).

## Phase 2 — Track time-to-max (core engine)

- [next] Add upgrade-time data per item/level.
- [next] Builder-count input (how many builders you have).
- [next] Sum remaining time per track (Builder / Lab / Pets); Builder track =
  total builder-time / builder count (rough), refined later with real packing.
- [next] Show the bottleneck track and estimated finish date per track.

## Phase 3 — Gold Pass math

- [later] Simple toggle: 20% off time + cost on both tracks.
- [later] Season-aware: pick 10/15/20% based on days into the current season
  (official API `/goldpass/seasons/current` gives season start/end).

## Phase 4 — Customization

- [later] Check/uncheck any individual upgrade to include/exclude it.
- [later] Presets: skip all collectors, skip gold/elixir collectors, etc.

## Phase 5 — Recommendation engine

- [idea] "What can I exclude?" — suggest upgrades to skip to bring tracks into
  equilibrium.
- [idea] When to rush vs. when to fully max.
- [idea] Magic item suggestions: if Lab is 16 days and Builder is 14 days,
  suggest 2 research potions to line up. Builder potions depend on builder count.
- [idea] Magic items to make all tracks finish sooner / balanced.

## Phase 6 — TH upgrade timing

- [idea] Recommend when to start the Town Hall upgrade (e.g. TH13→14 is 6 days)
  so nothing sits idle and everything maxes right as the TH finishes.
- [idea] Advanced: use actual upgrade lists (not just averages) to find a moment
  when a builder frees up exactly when the TH should start.
- [idea] Even more advanced: recommend a full build schedule (what to upgrade in
  what order).

## Phase 7 — Events

- [idea] Goblin builder events: add a temporary extra builder to the math (only
  if the player has 5 builders selected); toggle to include/exclude.
- [idea] Upgrade-time reduction events; research-time events.

## Phase 8 — Builder Base (separate village)

- [idea] Builder Base tracker, parallel to the main village.
- [idea] Rush-to-BH9 helper to unlock the 6th builder (O.T.T.O).

## Buildings / defenses / traps data

The official player API omits individual building/defense/trap levels. BUT the
in-game **Settings -> Download village data (JSON)** export DOES include them.
Sample saved at `docs/village-data.JSON`. It contains, keyed by numeric data
IDs:

- `buildings` / `buildings2` (home / builder base): id, `lvl`, `cnt` (count of
  that type at that level), plus `weapon`, `gear_up`, and `timer` (seconds
  remaining) for in-progress upgrades.
- `traps`/`traps2`, `units`/`units2` (troops), `siege_machines`, `heroes`/
  `heroes2`, `spells`, `pets` (empty pre-TH14), `equipment`, `decos`,
  `obstacles`, `boosts` (e.g. clock tower cooldown).
- In-progress upgrades carry a live `timer` -> we can read exactly what's cooking
  and how long is left, right now.

Implications:

- This **removes the need for manual entry** of buildings. Preferred base-state
  source = the JSON export (import/paste), optionally supplemented by the live
  API for fast-changing army levels.
- Downside: keyed by Supercell numeric IDs (need an ID -> name map) and it's a
  point-in-time snapshot (re-export to refresh). Buildings change slowly so a
  periodic re-export is fine; we can diff snapshots over time.

- [done] ID -> name map (`idToName`) to decode the export.
- [next] Import flow: paste/upload the export JSON.
- [later] Diff consecutive snapshots to show real progress/velocity.
- [idea] Nice quick-entry UI as a fallback for people who won't export.

### Freshness / gentle re-export prompts

The export has a `timestamp` and each in-progress upgrade has a `timer` (seconds
remaining at snapshot), so finish time = `timestamp + timer`. We can compute
when each in-progress upgrade completes and nudge the user to re-export.

- [idea] Non-intrusive nudge: when some threshold (e.g. all, or N) of the
  snapshot's in-progress upgrades should be finished, show a gentle "your data
  may be stale - re-export when you can" prompt. No hard obstacle up front.
- [idea] Optional notification/ping when an upgrade should have finished (opt-in,
  likely needs login + push; more intrusive, lower priority).
- [idea] Show a "data as of <time> (X of Y upgrades likely done since)" banner.

## Data / accuracy backlog

- [KNOWN ISSUE] `coc-info` (v1.1.0, only version) is a STATIC community snapshot,
  not Supercell data, and is already outdated: e.g. TH14 caps return BK/AQ 80 and
  GW 55, but current values are BK/AQ 85 and GW 60 (confirmed via clash.ninja and
  ClashGuidesWithDusk). It also has NO Supercell numeric IDs, so it can't decode
  the village-data export. Good for a quick MVP, not for accurate planning.
- [done] Adopted a published game-derived dataset (coc.py static data) as the
  authoritative rulebook: accurate caps + upgrade times + costs + numeric
  ID -> name map. Vendored to `data/`, slimmed to `src/data/gameData.generated.json`
  via `npm run build:data`. Replaced coc-info (removed). Verified TH14 caps
  (BK/AQ 85, GW 60) now correct.
- [idea] Icons/assets: usable under Supercell's Fan Content Policy with the
  required disclaimer. Sources: extracted game sprites, community icon packs,
  coc.guide/fandom. Add small troop/hero/spell icons per row.
- [idea] Track hero equipment / gear (Blacksmith, ore-based) as its own concern.
- [idea] Persist snapshots over time to show real progress and velocity.

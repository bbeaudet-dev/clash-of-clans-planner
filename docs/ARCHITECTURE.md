# Architecture

## Stack

- **Next.js (App Router) + React + TypeScript** — web app.
- **Convex** — backend. An `action` calls the CoC API server-side; a
  `mutation` stores snapshots; a `query` reads them.
- **Tailwind CSS** — styling.
- **coc-info** — curated game data (TH max levels; later: times/costs).
- **Vercel** — hosting (later).

## Data flow (Phase 1)

```mermaid
flowchart LR
  tag["Player tag input (client)"] --> action["Convex action: fetchPlayer"]
  action -->|"Bearer token"| proxy["cocproxy.royaleapi.dev /v1/players/{tag}"]
  proxy --> action
  action --> mut["storeSnapshot (mutation)"]
  mut --> db[("baseSnapshots")]
  action --> client["Client: buildVillageStats"]
  cocinfo["coc-info: getMaxLevel / getType"] --> client
  client --> view["VillageStatsView: current vs TH cap"]
```

## Why the proxy

The official CoC API (`api.clashofclans.com`) requires the request to come from
an **IP whitelisted on the token**. Serverless hosts don't have a stable IP, so
we route through the **RoyaleAPI proxy** (`cocproxy.royaleapi.dev`) and whitelist
its fixed IP (`45.79.218.79`) on the token instead. The token is stored as a
Convex environment variable (`COC_API_TOKEN`) and never reaches the client.

## Key files

- `convex/schema.ts` — `baseSnapshots` table.
- `convex/players.ts` — `fetchPlayer` (action), `storeSnapshot` (internal
  mutation), `latestSnapshot` (query), `normalizeTag`.
- `src/lib/gameData.ts` — joins CoC API items with `coc-info` TH caps and groups
  them into categories (`hero`, `pet`, `spell`, `troop`, `siege`).
- `src/components/VillageStats.tsx` — presentational stats view.
- `src/app/page.tsx` — tag input + orchestration.
- `src/app/ConvexClientProvider.tsx` — Convex React client provider.

## The "tracks" model (used from Phase 2 on)

Upgrades run in independent parallel tracks; time-to-max is the slowest track.

- **Builder track**: defenses, traps, resource/army buildings, heroes, Town Hall
  (N builders in parallel; walls are instant and ignored).
- **Laboratory track**: troops, spells, siege machines (one at a time).
- **Pets track**: Pet House (one at a time, TH14+).

The CoC player API exposes levels for troops/spells/heroes/pets/siege/equipment
but **not** individual buildings/defenses/traps — those will need manual entry or
an "assume maxed-for-TH except X" approach in a later phase.

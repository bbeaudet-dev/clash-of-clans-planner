# Clash of Clans Planner

A web app to see your Clash of Clans village upgrade status and (soon) figure
out how much upgrade time you have left before you can progress to the next Town
Hall.

**Phase 1 (current):** enter a player tag and see every hero, pet, spell, troop,
and siege machine with its current level vs. the max for your Town Hall.

See [`docs/IDEAS.md`](docs/IDEAS.md) for the full roadmap and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it works.

## Stack

- Next.js (App Router) + React + TypeScript
- Convex (backend: CoC API proxying + snapshot storage)
- Tailwind CSS
- [`coc-info`](https://github.com/rapha1232/coc-info) for Town Hall max levels

## Setup

You'll need Node.js and a free [Convex](https://convex.dev) account, plus a
[Clash of Clans API token](https://developer.clashofclans.com).

```bash
# 1. Install dependencies
npm install

# 2. Link your Convex project (creates .env.local with NEXT_PUBLIC_CONVEX_URL)
npx convex dev

# 3. Give Convex your CoC API token (whitelist proxy IP 45.79.218.79 on it first)
npx convex env set COC_API_TOKEN <your-token>

# 4. Run the web app (in a second terminal)
npm run dev
```

Then open http://localhost:3000.

### About the CoC API token

The official API requires requests to originate from an IP whitelisted on the
token. Since serverless hosts don't have a static IP, we route through the
[RoyaleAPI proxy](https://docs.royaleapi.com/proxy.html)
(`cocproxy.royaleapi.dev`) and whitelist its fixed IP `45.79.218.79` on the
token. The token lives only in Convex env vars, never in the client.

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
- Game "rulebook" data (max levels, upgrade times/costs, entity IDs) vendored
  from [`coc.py`](https://github.com/mathsman5133/coc.py)'s game-derived static
  data and slimmed via `npm run build:data`. See [`data/README.md`](data/README.md).

## Setup

You'll need Node.js and a free [Convex](https://convex.dev) account, plus a
[Clash of Clans API token](https://developer.clashofclans.com). Login uses
Better Auth with Google, Apple, and email/password.

```bash
# 1. Install dependencies
npm install

# 2. Link your Convex project (creates .env.local with NEXT_PUBLIC_CONVEX_URL)
npx convex dev

# 3. Give Convex your CoC API token (whitelist proxy IP 45.79.218.79 on it first)
npx convex env set COC_API_TOKEN <your-token>

# 4. Add Better Auth env vars to Convex
npx convex env set SITE_URL http://localhost:3000
npx convex env set BETTER_AUTH_SECRET <random-base64-secret>
npx convex env set GOOGLE_CLIENT_ID <google-client-id>
npx convex env set GOOGLE_CLIENT_SECRET <google-client-secret>
npx convex env set APPLE_CLIENT_ID <apple-services-id>
npx convex env set APPLE_CLIENT_SECRET <apple-client-secret-jwt>

# 5. Run the web app (in a second terminal)
npm run dev
```

Then open http://localhost:3000.

### About the CoC API token

The official API requires requests to originate from an IP whitelisted on the
token. Since serverless hosts don't have a static IP, we route through the
[RoyaleAPI proxy](https://docs.royaleapi.com/proxy.html)
(`cocproxy.royaleapi.dev`) and whitelist its fixed IP `45.79.218.79` on the
token. The token lives only in Convex env vars, never in the client.

## Deploying to Vercel

`vercel.json` uses `npx convex deploy --cmd 'npm run build'`, so Vercel needs a
`CONVEX_DEPLOY_KEY` plus the public Convex URLs:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `NEXT_PUBLIC_SITE_URL`

Set the backend secrets in the Convex production deployment: `SITE_URL`,
`BETTER_AUTH_SECRET`, `COC_API_TOKEN`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, and `APPLE_CLIENT_SECRET`.

OAuth redirects should point to your Vercel auth route:
`https://your-domain.com/api/auth/callback/google` and
`https://your-domain.com/api/auth/callback/apple`.

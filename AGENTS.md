<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SimRoutes

Finds real-world airline schedules to fly in a flight sim, filtered by aircraft type, block time, airports and airline. Adds a personal logbook, logbook-driven suggestions and a flight planner that dispatches to SimBrief.

## This repo is public and open source (MIT)

Every commit is world-readable at github.com/neelsatyavolu/simroutes and cannot be taken back once pushed, while the production app at simroutes.vercel.app stays live. Be more careful than in a private repo:

- Never commit secrets, tokens, `.env*` files (except the empty `.env.example`), `data/flights.json`, `.agmux/`, logs, screenshots or personal details. Run `gitleaks git .` before pushing.
- Treat every change as attacker-visible: keep auth and `user_id` scoping intact, validate input at the boundary, and never return internal error text to clients.
- Every server `fetch` must target a fixed host; never build URLs from user input without validating them.
- Keep `.github/workflows` least-privilege: no `pull_request_target`, explicit `permissions`, and inputs passed through `env:`.
- `POST /api/logbook/volanta` is rate-limited by a Vercel WAF rule ("Rate limit Volanta sign-in"). Don't rename or move that route without updating the rule.

## Stack

Next.js 16 App Router · React 19 · TypeScript (strict) · plain CSS Modules (no Tailwind or UI kit) · Clerk auth · Neon Postgres · Vercel Blob · zod · Vitest.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | All Vitest tests |
| `npx vitest run src/lib/search.test.ts` | One test file (`-t "name"` for one case) |
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npm run data:airports` | Rebuild `data/airports.json` from OurAirports (free, no key) |
| `npm run data:flights` | Pull AeroDataBox schedules — **costs API units**, see README |
| `npm run db:migrate` | Apply `scripts/migrate.ts` (idempotent) |

## Layout

| Path | Contents |
| --- | --- |
| `src/app/api/**/route.ts` | Route handlers — thin: auth, parse, delegate, respond |
| `src/lib/*.ts` | Search, filters, normalisation, dataset loading — pure and unit-tested |
| `src/lib/logbook`, `src/lib/planner`, `src/lib/suggestions` | Feature domains; `repo.ts` holds all SQL |
| `src/components` | Client components, one `*.module.css` each |
| `src/proxy.ts` | Clerk middleware — Next 16 renamed `middleware.ts` to `proxy.ts` |
| `scripts` | `ingest.ts` (AeroDataBox), `build-airports.ts`, `migrate.ts` |
| `data/airports.json` | Committed; `data/flights.json` is the gitignored local fallback |

## Conventions

- Import with the `@/*` alias, never deep relative paths.
- Route handlers use the helpers in `src/lib/api.ts`: `requireUser()` (returns `{ userId }` or a ready 401 `{ response }`), `jsonError(message, status)`, and `serverError(context, error)` which logs the detail server-side and returns a generic 500. Never leak internal error text to the client.
- Validate request input in the `validation.ts`-style parsers that return `{ ok: true, ... } | { ok: false, error }`; keep zod schemas out of route files.
- Success responses are bare `Response.json(payload)`, typed with `satisfies` against an interface in `src/lib/types.ts` — there is no `{ data, error }` envelope.
- Client-side fetching goes through `getJson` / `sendJson` in `src/lib/http.ts`.
- SQL lives only in `repo.ts` files as `@neondatabase/serverless` tagged templates (parameterised); every query is scoped by `user_id`.
- Put logic in `src/lib` with a colocated `*.test.ts`; components stay presentational. Match the existing style: immutable data, short functions, comments only for non-obvious constraints.

## Domain terms

| Term | Meaning |
| --- | --- |
| Block time | Gate-to-gate minutes (`durationMin` / `block_minutes`) |
| FlightRecord | One scheduled flight, carrying every aircraft type seen operating it that week |
| OFP | SimBrief operational flight plan generated from a planned flight |
| Volanta | Third-party logbook whose export can be imported |
| dedupe_key | Per-user uniqueness key that makes logbook imports re-runnable |

## Environment

`.env.local` (see `.env.example`): `AERODATABOX_RAPIDAPI_KEY`, `DATABASE_URL` (plus `DATABASE_URL_UNPOOLED` for migrations), `BLOB_READ_WRITE_TOKEN`, Clerk keys, and optional `NAVIGRAPH_CLIENT_ID` / `NAVIGRAPH_CLIENT_SECRET` / `NAVIGRAPH_REDIRECT_URI`. Pull with `vercel env pull .env.local`. Without a blob token, flights read and write `data/flights.json` locally.

## Hard stops — ask first

- Running `npm run data:flights` or the `Refresh schedules` workflow: it spends the limited AeroDataBox quota.
- Raising `MAX_RETENTION_MS` in `src/lib/flight-store.ts` above 7 days — AeroDataBox terms 5.5 cap cached content at 7 days.
- Destructive SQL in `scripts/migrate.ts`; it must stay safe to re-run against production.
- Changing auth or `user_id` scoping in any `repo.ts`.

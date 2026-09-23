# SimRoutes

Find real-world airline routes to fly in your flight sim, filtered by aircraft type, block time, departure/arrival airport, airport size and airline. SimRoutes also keeps a personal logbook, suggests routes you haven't flown, and plans flights that dispatch to SimBrief.

**Live:** https://simroutes.vercel.app

## Features

- **Search:** real scheduled flights from a rolling week of airline schedules, filtered by aircraft, block time, airports, airport size, region, airline and flight number
- **For you:** suggestions matched to the aircraft and block times you fly, including routes onward from your last arrival
- **Logbook:** import from Volanta or CSV, or log planned flights as flown
- **Planner:** save flights and generate a SimBrief OFP, with optional Navigraph sign-in
- **Airports:** MSFS 2024 scenery add-ons for any airport, from the SceneryAddons compatibility index

## Stack

Next.js 16 App Router · React 19 · TypeScript · CSS Modules · Clerk · Neon Postgres · Vercel Blob · zod · Vitest

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the variables below
npm run db:migrate           # create the Postgres schema (safe to re-run)
npm run data:flights         # pull schedules, see "Schedule data" below
npm run dev
```

`data/airports.json` and `data/scenery.json` are committed, so search works as soon as schedules exist.

### Environment variables

| Variable | Needed for |
| --- | --- |
| `AERODATABOX_RAPIDAPI_KEY` | `npm run data:flights` only |
| `BLOB_READ_WRITE_TOKEN` | Storing schedules in Vercel Blob. Without it, flights read and write `data/flights.json` locally |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Logbook, suggestions and planner (Neon Postgres). Migrations prefer the unpooled URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Accounts ([Clerk](https://dashboard.clerk.com)) |
| `VOLANTA_SESSION_SECRET` | Optional. Dedicated key for Volanta session cookies; defaults to one derived from `CLERK_SECRET_KEY` |
| `NAVIGRAPH_CLIENT_ID`, `NAVIGRAPH_CLIENT_SECRET`, `NAVIGRAPH_REDIRECT_URI` | Optional Navigraph sign-in. Credentials are issued by Navigraph on request |

On Vercel, `vercel env pull .env.local` fills these from the linked project.

## Schedule data (AeroDataBox)

Schedule data is **not** included in this repository: [AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox) terms cap cached content at 7 days, so `data/flights.json` is gitignored and stored records expire after a week.

1. Subscribe to AeroDataBox on RapidAPI (the free Basic plan has 600 units/month).
2. Put the key in `.env.local` as `AERODATABOX_RAPIDAPI_KEY`.
3. Run an ingest:

| Command | API units |
| --- | --- |
| `npm run data:flights -- LOWI LPMA EGJJ --days 1` | 12 |
| `npm run data:flights -- KSFO --days 7` | 28 |
| `npm run data:flights` (32 default hubs, 7 days) | 896 |

Each airport-day is two 12-hour calls at 2 units each. Flights come from the airports you ingest, so add the regional airports you care about to grow coverage. `.github/workflows/refresh-schedules.yml` runs the default ingest weekly when the `AERODATABOX_RAPIDAPI_KEY` and `BLOB_READ_WRITE_TOKEN` repository secrets are set.

## API

- `GET /api/options`: aircraft types, airlines and airports present in the data
- `GET /api/airports?q=...`: up to 30 airports matched by ICAO, IATA, name or city, independent of schedule coverage
- `GET /api/airports/:icao/scenery`: matching MSFS 2024 scenery from the SceneryAddons compatibility index
- `GET /api/search`: `aircraft` (repeatable), `airline`, `dep`, `arr` (ICAO or IATA), `minDuration`/`maxDuration` (minutes), `depSize`/`arrSize` (`super-large|large|medium|small|mini`), `sort` (`recommended|duration|departure|airline`), `limit`

Filtered searches default to Recommended: fewer previously visited airports first, then fewer total airport visits in the signed-in user's logbook, with block time breaking ties. All filters apply before ranking, and the result limit applies afterward. Signed-out users and empty logbooks fall back to block time.

## Volanta import

Connect Volanta in the logbook to import completed flight history with username/password and an authenticator code when enabled. This uses Volanta's **unofficial** app API, which may change without notice. A user-bound encrypted HttpOnly cookie keeps the connection on that browser for up to one hour; passwords and codes are never stored. Sync imports one page per request, skips duplicates and retains progress on failure. Disconnect removes the local session, not imported flights. The public username importer remains available for five recent flights.

Session encryption uses a purpose-specific HKDF key derived from `VOLANTA_SESSION_SECRET`, or from `CLERK_SECRET_KEY` when that isn't set. Rotating the key disconnects existing Volanta sessions.

## Airport scenery

The **Airports** tab searches the full airport directory and matches exact airport codes against the [SceneryAddons MSFS 2024 compatibility list](https://sceneryaddons.org/works-with-msfs-2024/), cached for one hour. Native 2024 releases rank first, followed by compatible and tested releases. Within each tier, listings without an Important notice come first. A best compatibility match is highlighted only when its rank is unique; this is not a visual-quality or performance rating. Known-incompatible and unknown entries are excluded. Source notices and listing links remain visible.

The integration reads the public HTML index because the site's JSON API is unavailable. If the site rejects a server request, times out or changes its markup, the API falls back to the committed `data/scenery.json` catalog and the tab displays its capture date. Run `npm run data:scenery` from an environment that can reach the source to refresh the snapshot. Failed refreshes leave the saved catalog intact. Coverage depends on airport codes appearing in listing titles; a missing match does not mean no scenery exists.

## Airport sizes

Five SimRoutes tiers combine airport role and scheduled airline service with runway infrastructure from [OurAirports](https://ourairports.com/help/data-dictionary.html). These are estimates, not passenger-volume rankings or aircraft suitability ratings. Weekly schedule coverage never changes an airport's size.

- **Super Large:** OurAirports large airport with scheduled service and at least two open paved runways of 9,000 ft or longer.
- **Large:** Other OurAirports large airports.
- **Medium:** Regional airports, or smaller airports with scheduled service and a runway of at least 5,000 ft.
- **Small:** Other local airports; non-large airports whose longest known open runway is 3,000–4,999 ft.
- **Mini:** Non-large airports whose longest known open runway is under 3,000 ft.

Short-runway rules take precedence over regional status. Closed runways, helipads and water surfaces are excluded. Missing runway lengths fall back to the source category rather than implying Mini. `npm run data:airports` rebuilds all classifications from both airport and runway CSVs, preserving historical ICAO aliases. No paid schedule requests are involved.

Departure and arrival tiers can each be multi-selected; **Any size** clears that end's restriction and includes airports with unknown details. Available routes still depend on schedule coverage.

## Development

```bash
npm test        # Vitest
npm run lint    # ESLint
npm run build   # production build
```

Coding conventions and project layout are in [AGENTS.md](AGENTS.md).

## Data sources

- Airports and runways: [OurAirports](https://ourairports.com/data/) (public domain)
- Schedules: [AeroDataBox](https://aerodatabox.com) via RapidAPI (bring your own key; not redistributed)
- Scenery listings: [SceneryAddons.org](https://sceneryaddons.org)

SimRoutes is for flight simulation only. It is not affiliated with Volanta, SimBrief, Navigraph, AeroDataBox, SceneryAddons, Microsoft or any airline, and must not be used for real-world navigation.

## License

[MIT](LICENSE)

# SimRoutes

Find real-world routes for your flight sim by aircraft type, block time, departure/arrival airport, airport size and airline.

## Setup

```bash
npm install
npm run data:airports   # OurAirports → data/airports.json (free, no key)
cp .env.example .env.local   # add your AeroDataBox RapidAPI key
npm run data:flights    # real scheduled departures → data/flights.json
npm run dev
```

## Schedule data (AeroDataBox)

1. Sign up at https://rapidapi.com/aedbx-aedbx/api/aerodatabox and subscribe to the **Basic (free)** plan.
2. Put the key in `.env.local` as `AERODATABOX_RAPIDAPI_KEY`.

`npm run data:flights` pulls the next 12h of departures from 25 major hubs and merges them into `data/flights.json` (re-runs update existing flights and add new ones).

| Command | Calls | API units |
| --- | --- | --- |
| `npm run data:flights` | 25 | 50 |
| `npm run data:flights -- --windows 2` (24h) | 50 | 100 |
| `npm run data:flights -- LOWI LPMA EGJJ` | 3 | 6 |

The free plan has 600 units/month; Pro ($5.35/mo) has 6,000. Flights come from the airports you ingest, so add the regional airports you care about to grow coverage.

## API

- `GET /api/options`: aircraft types, airlines and airports present in the data
- `GET /api/airports?q=...`: up to 30 airports matched by ICAO, IATA, name or city, independent of schedule coverage
- `GET /api/airports/:icao/scenery`: matching MSFS 2024 scenery from the SceneryAddons compatibility index
- `GET /api/search`: `aircraft` (repeatable), `airline`, `dep`, `arr` (ICAO or IATA), `minDuration`/`maxDuration` (minutes), `depSize`/`arrSize` (`super-large|large|medium|small|mini`), `sort` (`duration|departure|airline`), `limit`

## Airport scenery

The **Airports** tab searches the full airport directory and matches exact airport codes against the [SceneryAddons MSFS 2024 compatibility list](https://sceneryaddons.org/works-with-msfs-2024/), cached for one hour. Native 2024 releases rank first, followed by compatible and tested releases. Within each tier, listings without an Important notice come first. A best compatibility match is highlighted only when its rank is unique; this is not a visual-quality or performance rating. Known-incompatible and unknown entries are excluded. Source notices and listing links remain visible.

The integration reads the public HTML index because the site's JSON API is unavailable. If the site is unavailable or its markup changes, the tab offers a retry and a direct source link. Coverage depends on airport codes appearing in listing titles; a missing match does not mean no scenery exists.

## Airport sizes

Five SimRoutes tiers combine airport role and scheduled airline service with runway infrastructure from [OurAirports](https://ourairports.com/help/data-dictionary.html). These are estimates, not passenger-volume rankings or aircraft suitability ratings. Weekly schedule coverage never changes an airport's size.

- **Super Large:** OurAirports large airport with scheduled service and at least two open paved runways of 9,000 ft or longer.
- **Large:** Other OurAirports large airports.
- **Medium:** Regional airports, or smaller airports with scheduled service and a runway of at least 5,000 ft.
- **Small:** Other local airports; non-large airports whose longest known open runway is 3,000–4,999 ft.
- **Mini:** Non-large airports whose longest known open runway is under 3,000 ft.

Short-runway rules take precedence over regional status. Closed runways, helipads and water surfaces are excluded. Missing runway lengths fall back to the source category rather than implying Mini. `npm run data:airports` rebuilds all classifications from both airport and runway CSVs, preserving historical ICAO aliases. No paid schedule requests are involved.

Departure and arrival tiers can each be multi-selected; **Any size** clears that end's restriction and includes airports with unknown details. Available routes still depend on schedule coverage.

## Tests

```bash
npm test
```

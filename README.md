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
- `GET /api/search`: `aircraft` (repeatable), `airline`, `dep`, `arr` (ICAO or IATA), `minDuration`/`maxDuration` (minutes), `depSize`/`arrSize` (`large|medium|small`), `sort` (`duration|departure|airline`), `limit`

## Tests

```bash
npm test
```

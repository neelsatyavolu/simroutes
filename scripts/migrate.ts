/**
 * Creates or updates the Postgres schema. Safe to run repeatedly.
 * Usage: npm run db:migrate
 */
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (run `vercel env pull .env.local`)");
  const sql = neon(url);

  await sql`
    CREATE TABLE IF NOT EXISTS logbook_flights (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      dep_icao text NOT NULL CHECK (dep_icao ~ '^[A-Z0-9]{4}$'),
      arr_icao text NOT NULL CHECK (arr_icao ~ '^[A-Z0-9]{4}$'),
      aircraft text,
      block_minutes integer CHECK (block_minutes > 0),
      flown_at timestamptz,
      source text NOT NULL CHECK (source IN ('csv', 'volanta')),
      dedupe_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, dedupe_key)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS logbook_flights_user_idx ON logbook_flights (user_id, flown_at DESC NULLS LAST)`;
  // Flights marked as flown from the planner are added to the logbook too.
  await sql`ALTER TABLE logbook_flights DROP CONSTRAINT IF EXISTS logbook_flights_source_check`;
  await sql`ALTER TABLE logbook_flights ADD CONSTRAINT logbook_flights_source_check CHECK (source IN ('csv', 'volanta', 'plan'))`;

  await sql`
    CREATE TABLE IF NOT EXISTS planned_flights (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      planned_date date NOT NULL,
      flight_number text NOT NULL,
      airline_name text NOT NULL DEFAULT '',
      airline_icao text NOT NULL DEFAULT '',
      airline_iata text NOT NULL DEFAULT '',
      dep_icao text NOT NULL CHECK (dep_icao ~ '^[A-Z0-9]{4}$'),
      arr_icao text NOT NULL CHECK (arr_icao ~ '^[A-Z0-9]{4}$'),
      aircraft text NOT NULL,
      dep_local text NOT NULL CHECK (dep_local ~ '^[0-2][0-9]:[0-5][0-9]$'),
      block_minutes integer NOT NULL CHECK (block_minutes > 0),
      status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'flown')),
      ofp jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS planned_flights_user_idx ON planned_flights (user_id, status, planned_date)`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id text PRIMARY KEY,
      navigraph_subject text,
      navigraph_alias text,
      navigraph_connected_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  process.stdout.write("Migration complete\n");
}

main().catch((error) => {
  process.stderr.write(`migrate: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

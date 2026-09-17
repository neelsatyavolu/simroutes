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
  process.stdout.write("Migration complete\n");
}

main().catch((error) => {
  process.stderr.write(`migrate: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

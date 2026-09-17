import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

/** Lazily created so builds don't need DATABASE_URL. */
export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    client = neon(url);
  }
  return client;
}

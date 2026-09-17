import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { FlightRecord } from "./types";

export interface FlightsFile {
  updatedAt: string | null;
  flights: FlightRecord[];
}

/** AeroDataBox terms (5.5): cached Contents may be kept for at most 7 days. */
export const MAX_RETENTION_MS = 7 * 24 * 3600_000;

const BLOB_PATHNAME = "flights.json";
const LOCAL_PATH = process.env.FLIGHTS_FILE ?? path.join(process.cwd(), "data", "flights.json");
const EMPTY: FlightsFile = { updatedAt: null, flights: [] };

/** Uses the private Blob store when a token is configured, otherwise a local (gitignored) file. */
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function readFlightsFile(): Promise<FlightsFile> {
  if (blobEnabled()) {
    const result = await get(BLOB_PATHNAME, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return EMPTY;
    return JSON.parse(await new Response(result.stream).text()) as FlightsFile;
  }
  try {
    return JSON.parse(await readFile(LOCAL_PATH, "utf8")) as FlightsFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY;
    throw new Error(`Failed to read ${LOCAL_PATH}: ${(error as Error).message}`);
  }
}

export async function writeFlightsFile(file: FlightsFile): Promise<string> {
  const body = JSON.stringify(file);
  if (blobEnabled()) {
    await put(BLOB_PATHNAME, body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return `blob:${BLOB_PATHNAME}`;
  }
  await writeFile(LOCAL_PATH, body);
  return LOCAL_PATH;
}

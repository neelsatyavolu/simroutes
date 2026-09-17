import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseSceneryCatalog, SCENERY_SOURCE } from "@/lib/scenery";
import type { SceneryMatch } from "@/lib/types";

export const SCENERY_PATH = path.join(process.cwd(), "data", "scenery.json");

export interface ScenerySnapshot {
  updatedAt: string;
  sourceUrl: string;
  entries: SceneryMatch[];
}

export async function loadSceneryCatalog(): Promise<{ entries: SceneryMatch[]; fallbackUpdatedAt: string | null }> {
  try {
    const response = await fetch(SCENERY_SOURCE, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`Scenery source returned HTTP ${response.status}`);
    return { entries: parseSceneryCatalog(await response.text()), fallbackUpdatedAt: null };
  } catch (error) {
    console.warn("Live scenery catalog unavailable; using bundled snapshot", error);
    const snapshot = JSON.parse(await readFile(SCENERY_PATH, "utf8")) as ScenerySnapshot;
    return { entries: snapshot.entries, fallbackUpdatedAt: snapshot.updatedAt };
  }
}

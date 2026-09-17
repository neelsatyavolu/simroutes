import { writeFile, rename } from "node:fs/promises";
import { parseSceneryCatalog, SCENERY_SOURCE } from "@/lib/scenery";
import { SCENERY_PATH, type ScenerySnapshot } from "@/lib/scenery-store";

async function main() {
  const response = await fetch(SCENERY_SOURCE, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Scenery source returned HTTP ${response.status}`);
  const entries = parseSceneryCatalog(await response.text());
  if (!entries.length) throw new Error("Refusing to replace the saved catalog with an empty index");
  const snapshot: ScenerySnapshot = { updatedAt: new Date().toISOString(), sourceUrl: SCENERY_SOURCE, entries };
  await writeFile(`${SCENERY_PATH}.tmp`, JSON.stringify(snapshot, null, 2) + "\n");
  await rename(`${SCENERY_PATH}.tmp`, SCENERY_PATH);
  console.log(`Saved ${entries.length} scenery listings to ${SCENERY_PATH}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

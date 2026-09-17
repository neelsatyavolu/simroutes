import type { SceneryMatch, SceneryResponse } from "@/lib/types";

export const SCENERY_SOURCE = "https://sceneryaddons.org/works-with-msfs-2024/";

function plainText(html: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return html.replace(/<[^>]*>/g, "").replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) return named[code] ?? entity;
    const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
  }).replace(/\s+/g, " ").trim();
}

/** Parse only the compatibility index's listing rows; never render source HTML. */
export function parseSceneryCatalog(html: string): SceneryMatch[] {
  const rows = html.matchAll(/<div class="scad-comp24-[a-z]+">([^<]*)<\/div>\s*<a class="scad-ml-post" href="([^"]+)">([\s\S]*?)<\/a>([\s\S]*?)(?=<br\s*\/?\s*>)/g);
  const results: SceneryMatch[] = [];
  let recognized = 0;
  for (const [, rawStatus, rawUrl, rawTitle, notes] of rows) {
    const url = plainText(rawUrl);
    if (!/^https:\/\/sceneryaddons\.org\/[a-z0-9-]+\/$/.test(url)) continue;
    recognized++;
    const status = plainText(rawStatus);
    const compatibility = status === "Yes – Native" ? "native"
      : status === "Yes – Compatible" ? "compatible"
      : status === "Yes – Tested" ? "tested" : null;
    if (!compatibility) continue;
    const title = plainText(rawTitle);
    const developer = title.split(" – ")[0];
    if (developer === "Asobo Studio" || developer === "Microsoft") continue;
    results.push({ title, url, developer, compatibility, important: notes.includes('class="scad-ml-important"') });
  }
  if (!recognized) throw new Error("Scenery compatibility index could not be parsed");
  return results;
}

const priority = (match: SceneryMatch) =>
  ({ native: 0, compatible: 2, tested: 4 }[match.compatibility]) + Number(match.important);

export function matchScenery(catalog: readonly SceneryMatch[], icao: string): Pick<SceneryResponse, "results" | "recommendedUrl"> {
  const results = catalog.filter((entry) => entry.title.toUpperCase().split(/[^A-Z0-9]+/).includes(icao.toUpperCase()))
    .sort((a, b) => priority(a) - priority(b) || a.title.localeCompare(b.title));
  const best = results[0];
  return {
    results,
    recommendedUrl: best && (!results[1] || priority(best) < priority(results[1])) ? best.url : null,
  };
}

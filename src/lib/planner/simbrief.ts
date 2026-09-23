import { z } from "zod";
import { resolveType } from "../aircraft-types";

export interface DispatchInput {
  plannedDate: string; // YYYY-MM-DD
  flightNumber: string; // "MS 986"
  airlineIcao: string;
  depIcao: string;
  arrIcao: string;
  aircraft: string;
  depLocal: string; // HH:MM
  blockMinutes: number;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Link to SimBrief's dispatch page with the flight pre-filled (Navigraph "Dispatch Redirect Guide").
 * The pilot generates the OFP in their own SimBrief account; no API key is needed.
 */
export function simbriefDispatchUrl(p: DispatchInput): string {
  const [year, month, day] = p.plannedDate.split("-");
  const [hh, mm] = p.depLocal.split(":");
  const number = p.flightNumber.match(/\d+[A-Z]?$/i)?.[0];
  const type = resolveType(p.aircraft)?.code;
  const params = new URLSearchParams();
  if (p.airlineIcao) params.set("airline", p.airlineIcao);
  if (number) params.set("fltnum", number);
  if (type) params.set("type", type);
  params.set("orig", p.depIcao);
  params.set("dest", p.arrIcao);
  params.set("date", `${day}${MONTHS[Number(month) - 1]}${year.slice(2)}`);
  params.set("deph", String(Number(hh)));
  params.set("depm", mm);
  params.set("steh", String(Math.floor(p.blockMinutes / 60)));
  params.set("stem", String(p.blockMinutes % 60).padStart(2, "0"));
  return `https://dispatch.simbrief.com/options/custom?${params}`;
}

export interface OfpSummary {
  requestId: string;
  generatedAt: string | null;
  depIcao: string;
  arrIcao: string;
  alternateIcao: string | null;
  depRunway: string | null;
  arrRunway: string | null;
  aircraftType: string | null;
  route: string;
  initialAltitudeFt: number | null;
  distanceNm: number | null;
  blockMinutes: number | null;
  rampFuel: number | null;
  fuelUnits: string | null;
  pdfUrl: string | null;
}

// SimBrief returns most values as strings; empty objects appear where XML had empty elements.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);
const node = <T extends z.ZodRawShape>(shape: T) => z.object(shape).partial().optional().catch(undefined);

const ofpSchema = z.object({
  params: z.object({ request_id: z.union([z.string(), z.number()]).transform(String), time_generated: text, units: text }),
  general: node({ route: text, initial_altitude: text, air_distance: text }),
  origin: z.object({ icao_code: z.string().length(4), plan_rwy: text }),
  destination: z.object({ icao_code: z.string().length(4), plan_rwy: text }),
  alternate: node({ icao_code: text }),
  aircraft: node({ icaocode: text }),
  times: node({ est_block: text }),
  fuel: node({ plan_ramp: text }),
  files: node({ directory: text, pdf: node({ link: text }) }),
});

const num = (v: string | undefined) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};
const nonEmpty = (v: string | undefined) => (v ? v : null);

// The link is rendered as an href, so only allow https URLs on SimBrief's own host.
function simbriefPdfUrl(directory: string | undefined, file: string | undefined): string | null {
  if (!directory || !file) return null;
  const url = URL.parse(`${directory}${file}`);
  return url?.protocol === "https:" && url.hostname === "www.simbrief.com" ? url.href : null;
}

export function mapOfp(payload: unknown): OfpSummary | null {
  const parsed = ofpSchema.safeParse(payload);
  if (!parsed.success) return null;
  const o = parsed.data;
  const generated = num(o.params.time_generated);
  const block = num(o.times?.est_block);
  return {
    requestId: o.params.request_id,
    generatedAt: generated ? new Date(generated * 1000).toISOString() : null,
    depIcao: o.origin.icao_code,
    arrIcao: o.destination.icao_code,
    alternateIcao: nonEmpty(o.alternate?.icao_code),
    depRunway: nonEmpty(o.origin.plan_rwy),
    arrRunway: nonEmpty(o.destination.plan_rwy),
    aircraftType: nonEmpty(o.aircraft?.icaocode),
    route: o.general?.route ?? "",
    initialAltitudeFt: num(o.general?.initial_altitude),
    distanceNm: num(o.general?.air_distance),
    blockMinutes: block === null ? null : Math.round(block / 60),
    rampFuel: num(o.fuel?.plan_ramp),
    fuelUnits: nonEmpty(o.params.units),
    pdfUrl: simbriefPdfUrl(o.files?.directory, o.files?.pdf?.link),
  };
}

const USERNAME = /^[A-Za-z0-9_.-]{2,40}$/;
export const isValidSimbriefUsername = (name: string) => USERNAME.test(name);

export class SimbriefError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Latest OFP via SimBrief's documented public fetcher (by Navigraph alias). */
export async function fetchLatestOfp(username: string): Promise<OfpSummary> {
  if (!isValidSimbriefUsername(username)) throw new SimbriefError("Invalid SimBrief username", 400);
  let res: Response;
  try {
    res = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new SimbriefError("Couldn't reach SimBrief. Please try again.", 502);
  }
  if (res.status === 400) throw new SimbriefError("SimBrief has no flight plan for that account yet", 404);
  if (!res.ok) throw new SimbriefError(`SimBrief returned an error (${res.status})`, 502);
  const summary = mapOfp(await res.json());
  if (!summary) throw new SimbriefError("Couldn't read the SimBrief flight plan", 502);
  return summary;
}

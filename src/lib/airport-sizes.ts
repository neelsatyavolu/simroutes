import type { AirportSize } from "@/lib/types";

export const AIRPORT_SIZE_INFO: Record<AirportSize, { label: string; badge: string; hint: string }> = {
  "super-large": { label: "Super Large", badge: "XL", hint: "Major hubs" },
  large: { label: "Large", badge: "L", hint: "Major airports" },
  medium: { label: "Medium", badge: "M", hint: "Regional airports" },
  small: { label: "Small", badge: "S", hint: "Local airports" },
  mini: { label: "Mini", badge: "XS", hint: "Short airstrips" },
};

/** OurAirports has one row per physical runway, not one per runway end. */
export interface AirportRunway {
  length_ft: string;
  surface: string;
  closed: string;
  le_ident: string;
  he_ident: string;
}

/** SimRoutes estimates: airline role plus infrastructure, not measured passenger traffic. */
export function classifyAirportSize(type: string, scheduledService: boolean, runways: readonly AirportRunway[]): AirportSize {
  const usable = runways.filter((r) =>
    r.closed !== "1" && !/^H/i.test(r.le_ident) && !/^H/i.test(r.he_ident) &&
    !/water/i.test(r.surface) && Number.isFinite(Number(r.length_ft)) && Number(r.length_ft) > 0,
  );
  const longest = Math.max(0, ...usable.map((r) => Number(r.length_ft)));
  const longPavedRunways = usable.filter((r) => Number(r.length_ft) >= 9000 && /^(ASP|CON|PEM|BIT)/i.test(r.surface.trim())).length;

  if (type === "large_airport") {
    return scheduledService && longPavedRunways >= 2 ? "super-large" : "large";
  }
  // Known short runways take precedence over a broad regional-airport designation.
  if (longest > 0 && longest < 3000) return "mini";
  if (longest > 0 && longest < 5000) return "small";
  if (type === "medium_airport") return "medium";
  if (scheduledService && longest >= 5000) return "medium";
  // Missing runway data is not evidence of a short airstrip.
  return "small";
}

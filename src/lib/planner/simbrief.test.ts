import { describe, expect, it } from "vitest";
import { isValidSimbriefUsername, mapOfp, simbriefDispatchUrl } from "./simbrief";

const plan = {
  plannedDate: "2026-09-18",
  flightNumber: "MS 986",
  airlineIcao: "MSR",
  depIcao: "KJFK",
  arrIcao: "HECA",
  aircraft: "Airbus A350-900",
  depLocal: "12:55",
  blockMinutes: 630,
};

describe("simbriefDispatchUrl", () => {
  it("pre-fills SimBrief dispatch with the planned flight", () => {
    const url = new URL(simbriefDispatchUrl(plan));
    expect(url.origin + url.pathname).toBe("https://dispatch.simbrief.com/options/custom");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      airline: "MSR",
      fltnum: "986",
      type: "A359",
      orig: "KJFK",
      dest: "HECA",
      date: "18SEP26",
      deph: "12",
      depm: "55",
      steh: "10",
      stem: "30",
    });
  });

  it("omits fields it cannot map", () => {
    const url = new URL(simbriefDispatchUrl({ ...plan, airlineIcao: "", flightNumber: "HNW", aircraft: "Dassault Falcon" }));
    expect(url.searchParams.has("airline")).toBe(false);
    expect(url.searchParams.has("fltnum")).toBe(false);
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.get("orig")).toBe("KJFK");
  });
});

// Shape follows SimBrief's xml.fetcher JSON; values are strings there.
const ofp = {
  params: { request_id: "123456789", time_generated: "1758100000", units: "kgs" },
  general: { icao_airline: "MSR", flight_number: "986", route: "HAPIE DCT YAHOO NATW", initial_altitude: "35000", air_distance: "5100" },
  origin: { icao_code: "KJFK", plan_rwy: "22R" },
  destination: { icao_code: "HECA", plan_rwy: "05C" },
  alternate: { icao_code: "HEBA" },
  aircraft: { icaocode: "A359", name: "A350-900" },
  times: { est_block: "37800", est_time_enroute: "36000" },
  fuel: { plan_ramp: "72400" },
  files: { directory: "https://www.simbrief.com/ofp/flightplans/", pdf: { name: "MSR986_PDF_1758100000.pdf", link: "MSR986HECA_PDF_1758100000.pdf" } },
};

describe("mapOfp", () => {
  it("summarises the flight plan", () => {
    expect(mapOfp(ofp)).toEqual({
      requestId: "123456789",
      generatedAt: new Date(1758100000 * 1000).toISOString(),
      depIcao: "KJFK",
      arrIcao: "HECA",
      alternateIcao: "HEBA",
      depRunway: "22R",
      arrRunway: "05C",
      aircraftType: "A359",
      route: "HAPIE DCT YAHOO NATW",
      initialAltitudeFt: 35000,
      distanceNm: 5100,
      blockMinutes: 630,
      rampFuel: 72400,
      fuelUnits: "kgs",
      pdfUrl: "https://www.simbrief.com/ofp/flightplans/MSR986HECA_PDF_1758100000.pdf",
    });
  });

  it.each([
    ["javascript:", "alert(1)"],
    ["https://evil.example/", "x.pdf"],
    ["https://www.simbrief.com.evil.example/", "x.pdf"],
    ["http://www.simbrief.com/ofp/", "x.pdf"],
  ])("drops PDF links outside SimBrief (%s%s)", (directory, link) => {
    expect(mapOfp({ ...ofp, files: { directory, pdf: { link } } })?.pdfUrl).toBeNull();
  });

  it("returns null for errors or unexpected payloads", () => {
    expect(mapOfp({ fetch: { status: "Error: Unknown UserID" } })).toBeNull();
    expect(mapOfp(null)).toBeNull();
  });
});

describe("isValidSimbriefUsername", () => {
  it.each([["Pilot_123", true], ["a b", false], ["", false]])("%s → %s", (name, ok) => {
    expect(isValidSimbriefUsername(name)).toBe(ok);
  });
});

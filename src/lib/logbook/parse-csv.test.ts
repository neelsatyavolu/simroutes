import { describe, expect, it } from "vitest";
import { parseLogbookCsv } from "./parse-csv";

describe("parseLogbookCsv", () => {
  it("reads a simple origin,destination,aircraft CSV", () => {
    const { rows, errors } = parseLogbookCsv("origin,destination,aircraft\nEGLL,KJFK,B77W\nkjfk,egll,A359\n");
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { dep: "EGLL", arr: "KJFK", aircraft: "B77W", blockMinutes: null, flownAt: null, externalId: null },
      { dep: "KJFK", arr: "EGLL", aircraft: "A359", blockMinutes: null, flownAt: null, externalId: null },
    ]);
  });

  it("recognises Little Navmap-style headers and real times", () => {
    const csv = [
      '"Aircraft Name","Aircraft Type","Departure Ident","Destination Ident","Departure Time Real","Destination Time Real"',
      '"Asobo A320neo","A20N","LOWI","EGJJ","2026-09-01 10:00:00","2026-09-01 12:05:00"',
    ].join("\n");
    const { rows } = parseLogbookCsv(csv);
    expect(rows[0]).toMatchObject({ dep: "LOWI", arr: "EGJJ", aircraft: "A20N", blockMinutes: 125 });
    // Timestamps without a zone are treated as UTC (logbooks record zulu time), whatever the server's timezone.
    expect(rows[0].flownAt).toBe("2026-09-01T10:00:00.000Z");
  });

  it("parses block time as h:mm, hours or minutes", () => {
    const csv = "from,to,type,block time,flight_minutes,hours\nEGLL,EDDF,A320,1:35,,\nEGLL,EDDF,A320,,95,\nEGLL,EDDF,A320,,,1.5\n";
    expect(parseLogbookCsv(csv).rows.map((r) => r.blockMinutes)).toEqual([95, 95, 90]);
  });

  it("falls back to the aircraft name column when there is no type column", () => {
    const { rows } = parseLogbookCsv("departure,arrival,aircraft name\nEGLL,LFPG,PMDG 737-800\n");
    expect(rows[0].aircraft).toBe("PMDG 737-800");
  });

  it("keeps an id column for de-duplication and accepts IATA codes", () => {
    const { rows } = parseLogbookCsv("id,dep,arr,aircraft\nabc-1,LHR,JFK,B789\n");
    expect(rows[0]).toMatchObject({ externalId: "abc-1", dep: "LHR", arr: "JFK" });
  });

  it("reports rows it cannot use and missing required columns", () => {
    const bad = parseLogbookCsv("origin,destination\nEGLL,\n,KJFK\nEGLL,TOO-LONG\nEGLL,KJFK\n");
    expect(bad.rows).toHaveLength(1);
    expect(bad.errors).toEqual(["Row 2: missing destination", "Row 3: missing origin", "Row 4: invalid destination \"TOO-LONG\""]);
    expect(parseLogbookCsv("name,value\na,b\n").errors).toEqual([
      "Could not find origin and destination columns (e.g. \"origin\", \"departure\", \"from\")",
    ]);
  });
});

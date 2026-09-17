import { describe, expect, it } from "vitest";
import { isValidVolantaUsername, mapVolantaFlights } from "./volanta";

const item = {
  id: "01a09b4a-db2e-72c1-8066-e1f79da0092e",
  offBlocksTime: "2026-09-13T15:45:39.229",
  onBlocksTime: "2026-09-14T06:30:23.23",
  origin: { icaoCode: "OTHH", iataCode: "DOH" },
  destination: { icaoCode: "KJFK", iataCode: "JFK" },
  aircraft: { aircraftTypeIcao: "A359", registration: "A7-AMF" },
};

describe("mapVolantaFlights", () => {
  it("maps route, aircraft, UTC block times and id", () => {
    expect(mapVolantaFlights({ items: [item] })).toEqual([
      {
        dep: "OTHH",
        arr: "KJFK",
        aircraft: "A359",
        blockMinutes: 885,
        flownAt: "2026-09-13T15:45:39.229Z",
        externalId: "01a09b4a-db2e-72c1-8066-e1f79da0092e",
      },
    ]);
  });

  it("skips flights without both airports and tolerates missing times", () => {
    const flights = mapVolantaFlights({
      items: [
        { ...item, id: "no-dest", destination: null },
        { ...item, id: "no-times", offBlocksTime: null, onBlocksTime: null, aircraft: null },
      ],
    });
    expect(flights).toEqual([
      { dep: "OTHH", arr: "KJFK", aircraft: null, blockMinutes: null, flownAt: null, externalId: "no-times" },
    ]);
  });

  it("returns nothing for an unexpected payload", () => {
    expect(mapVolantaFlights({ nope: true })).toEqual([]);
    expect(mapVolantaFlights(null)).toEqual([]);
  });
});

describe("isValidVolantaUsername", () => {
  it.each([["lordfalcon7879", true], ["a.b_c-d", true], ["", false], ["bad name", false], ["../x", false]])("%s → %s", (name, ok) => {
    expect(isValidVolantaUsername(name)).toBe(ok);
  });
});

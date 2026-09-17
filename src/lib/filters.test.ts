import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, toSearchParams } from "./filters";
import { parseSearchParams } from "./search";

describe("toSearchParams", () => {
  it("serializes flight numbers and omits whitespace-only input", () => {
    const params = toSearchParams({ ...EMPTY_FILTERS, flightNumber: " ba 123 " });
    expect(params.get("flightNumber")).toBe("ba 123");
    expect(parseSearchParams(params)).toMatchObject({ ok: true, query: { flightNumber: "BA123" } });
    expect(toSearchParams({ ...EMPTY_FILTERS, flightNumber: "   " }).has("flightNumber")).toBe(false);
  });

  it("omits empty filters", () => {
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe("sort=duration");
  });

  it("converts hours to minutes and round-trips through the API parser", () => {
    const params = toSearchParams({
      ...EMPTY_FILTERS,
      aircraft: ["Airbus A320", "Boeing 737-800"],
      airlines: ["BA"],
      dep: " egll ",
      minHours: "1",
      maxHours: "2.5",
      depSizes: ["large"],
      arrSizes: ["medium", "small"],
      sort: "departure",
    });
    const parsed = parseSearchParams(params);
    expect(parsed).toMatchObject({
      ok: true,
      query: {
        aircraft: ["Airbus A320", "Boeing 737-800"],
        airlines: ["BA"],
        dep: "EGLL",
        minDuration: 60,
        maxDuration: 150,
        depSizes: ["large"],
        arrSizes: ["medium", "small"],
        sort: "departure",
      },
    });
  });

  it("ignores non-numeric hour input", () => {
    expect(toSearchParams({ ...EMPTY_FILTERS, minHours: "abc" }).has("minDuration")).toBe(false);
  });
});

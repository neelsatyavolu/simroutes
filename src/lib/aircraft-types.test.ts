import { describe, expect, it } from "vitest";
import { familyOf, resolveType } from "./aircraft-types";

describe("resolveType", () => {
  it.each([
    // Schedule model names
    ["Airbus A320 NEO", "A20N"],
    ["Airbus A321NEO", "A21N"],
    ["Airbus A320 (Sharklets)", "A320"],
    ["Airbus A320-200 (sharklets)", "A320"],
    ["Airbus A321-200 (Sharklets)", "A321"],
    ["Boeing 737-800 (winglets)", "B738"],
    ["Boeing 737 MAX 8", "B38M"],
    ["Boeing 777-300ER Passenger", "B77W"],
    ["Boeing 777-200 / 200ER Passenger", "B772"],
    ["Boeing 787-900", "B789"],
    ["Airbus A330-900 NEO", "A339"],
    ["Airbus A220-300", "BCS3"],
    ["Bombardier Dash 8 Q400 / DHC-8-400", "DH8D"],
    ["Canadair reg jet 700", "CRJ7"],
    ["Embraer 195-E2", "E295"],
    ["ATR 72-600", "AT76"],
    // ICAO designators and sim titles from logbooks
    ["A20N", "A20N"],
    ["A32N", "A20N"], // Volanta's code for the A320neo
    ["b738", "B738"],
    ["Asobo A320neo", "A20N"],
    ["PMDG 737-800", "B738"],
    ["iniBuilds A350-900", "A359"],
    ["Toliss A321neo LR", "A21N"],
    ["FlyByWire A32NX", "A20N"],
    ["Headwind A330-900neo", "A339"],
    ["PMDG 777-300ER", "B77W"],
  ])("%s → %s", (name, code) => {
    expect(resolveType(name)?.code).toBe(code);
  });

  it("returns null for unknown or too-generic names", () => {
    expect(resolveType("Airbus")).toBeNull();
    expect(resolveType("Cessna")).toBeNull();
    // Airline-internal equipment codes are ambiguous; don't guess.
    expect(resolveType("32E")).toBeNull();
    expect(resolveType("")).toBeNull();
  });

  it("resolves generic series names to a family-only match", () => {
    expect(resolveType("Boeing 737")).toMatchObject({ code: null, family: "B737" });
    expect(resolveType("Boeing 787")).toMatchObject({ code: null, family: "B787" });
  });
});

describe("familyOf", () => {
  it("groups related variants", () => {
    expect(familyOf("A20N")).toBe("A320");
    expect(familyOf("A321")).toBe("A320");
    expect(familyOf("B38M")).toBe("B737");
    expect(familyOf("B789")).toBe("B787");
  });
});

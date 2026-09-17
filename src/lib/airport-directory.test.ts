import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as search } from "@/app/api/airports/route";
import { GET as scenery } from "@/app/api/airports/[icao]/scenery/route";

afterEach(() => vi.unstubAllGlobals());

describe("airport directory endpoints", () => {
  it("searches the airport directory by IATA without flight data", async () => {
    const response = await search(new Request("http://localhost/api/airports?q=LHR"));
    expect(response.status).toBe(200);
    expect((await response.json()).airports[0]).toMatchObject({ icao: "EGLL", iata: "LHR" });
  });

  it("returns no results for an empty search", async () => {
    const response = await search(new Request("http://localhost/api/airports?q=%20"));
    expect(await response.json()).toEqual({ airports: [] });
  });

  it("rejects unknown airports before contacting the scenery source", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await scenery(new Request("http://localhost"), { params: Promise.resolve({ icao: "NOT-AN-AIRPORT" }) });
    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports source failure without pretending no scenery exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })));
    const response = await scenery(new Request("http://localhost"), { params: Promise.resolve({ icao: "KJFK" }) });
    expect(response.status).toBe(502);
    expect(await response.json()).toHaveProperty("error");
  });
});

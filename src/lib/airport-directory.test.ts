import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as search } from "@/app/api/airports/route";
import { GET as scenery } from "@/app/api/airports/[icao]/scenery/route";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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

  it.each(["blocked", "timeout", "invalid HTML"])("serves dated saved KORD listings when the source is %s", async (failure) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", failure === "timeout"
      ? vi.fn().mockRejectedValue(new Error("Timed out"))
      : vi.fn().mockResolvedValue(new Response("Unavailable", { status: failure === "blocked" ? 403 : 200 })));
    const response = await scenery(new Request("http://localhost"), { params: Promise.resolve({ icao: "KORD" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.every((entry: { title: string }) => entry.title.includes("KORD"))).toBe(true);
    expect(Number.isFinite(Date.parse(body.fallbackUpdatedAt))).toBe(true);
  });

  it("prefers the live index when available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('<div class="scad-comp24-yes">Yes &#8211; Native</div> <a class="scad-ml-post" href="https://sceneryaddons.org/test-kord/">Test &#8211; KORD Airport</a><br>')));
    const response = await scenery(new Request("http://localhost"), { params: Promise.resolve({ icao: "KORD" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].developer).toBe("Test");
    expect(body.fallbackUpdatedAt).toBeNull();
  });
});

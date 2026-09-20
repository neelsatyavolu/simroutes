import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/search/route";
import { auth } from "@clerk/nextjs/server";
import { loadDataset } from "@/lib/data";
import { listLogbook } from "@/lib/logbook/repo";
import type { FlightRecord } from "@/lib/types";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/data", () => ({ loadDataset: vi.fn() }));
vi.mock("@/lib/logbook/repo", () => ({ listLogbook: vi.fn() }));

const flight = (id: string, arrIcao: string, durationMin: number): FlightRecord => ({
  id, flightNumber: id, depIcao: "EGLL", arrIcao, durationMin,
  aircraft: ["Airbus A320"], airline: { name: "British Airways", iata: "BA", icao: "BAW" },
  depLocal: "10:00", arrLocal: "12:00", seenAt: "2026-09-20T00:00:00Z",
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadDataset).mockResolvedValue({ flights: [flight("familiar", "KJFK", 60), flight("new", "EGJJ", 90)], airports: new Map(), updatedAt: null });
});

describe("search recommendations", () => {
  it("uses only the signed-in user's history and prevents shared caching", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-1" } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(listLogbook).mockResolvedValue([{ id: "past", depIcao: "EGLL", arrIcao: "KJFK", aircraft: null, blockMinutes: null, flownAt: null, source: "volanta" }]);
    const response = await GET(new NextRequest("http://localhost/api/search?sort=recommended&limit=1"));
    expect(listLogbook).toHaveBeenCalledExactlyOnceWith("user-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ total: 2, results: [{ id: "new" }] });
  });

  it("keeps signed-out searches available without querying a logbook", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    const response = await GET(new NextRequest("http://localhost/api/search?sort=recommended"));
    expect(listLogbook).not.toHaveBeenCalled();
    expect((await response.json()).results.map((f: FlightRecord) => f.id)).toEqual(["familiar", "new"]);
  });

  it("does not load history for the existing sort modes", async () => {
    const response = await GET(new NextRequest("http://localhost/api/search?sort=duration"));
    expect(response.status).toBe(200);
    expect(auth).not.toHaveBeenCalled();
    expect(listLogbook).not.toHaveBeenCalled();
  });
});

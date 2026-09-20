import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadDataset } from "@/lib/data";
import { listLogbook } from "@/lib/logbook/repo";
import { parseSearchParams, searchFlights } from "@/lib/search";
import type { SearchResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    const history = async () => {
      if (parsed.query.sort !== "recommended") return [];
      const { userId } = await auth();
      return userId ? listLogbook(userId) : [];
    };
    const [{ flights, airports }, logbook] = await Promise.all([loadDataset(), history()]);
    return Response.json(searchFlights(flights, airports, parsed.query, logbook) satisfies SearchResponse, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("GET /api/search failed", error);
    return Response.json({ error: "Could not load flight data" }, { status: 500 });
  }
}

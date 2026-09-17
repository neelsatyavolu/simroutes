import type { NextRequest } from "next/server";
import { loadDataset } from "@/lib/data";
import { parseSearchParams, searchFlights } from "@/lib/search";

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    const { flights, airports } = await loadDataset();
    return Response.json(searchFlights(flights, airports, parsed.query));
  } catch (error) {
    console.error("GET /api/search failed", error);
    return Response.json({ error: "Could not load flight data" }, { status: 500 });
  }
}

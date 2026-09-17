import { requireUser, serverError } from "@/lib/api";
import { loadDataset } from "@/lib/data";
import { listLogbook } from "@/lib/logbook/repo";
import { buildProfile, suggestFlights } from "@/lib/suggestions/engine";
import type { SuggestionsResponse } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  try {
    const logbook = await listLogbook(user.userId);
    if (logbook.length === 0) {
      return Response.json({ profile: null, continueFrom: null, discover: null } satisfies SuggestionsResponse);
    }
    const now = new Date();
    const { flights, airports } = await loadDataset();
    const profile = buildProfile(logbook, now);
    // Seeded by user and day: suggestions rotate daily but don't reshuffle on every refresh.
    const { continueFrom, discover } = suggestFlights(profile, flights, airports, {
      seed: `${user.userId}|${now.toISOString().slice(0, 10)}`,
    });
    const last = profile.lastArrival;
    return Response.json({
      profile: {
        aircraft: profile.aircraft.map((a) => a.code),
        duration: profile.duration,
        lastArrival: last ? airports.get(last) ?? { icao: last } : null,
        flightCount: logbook.length,
        visitedCount: profile.visited.size,
      },
      continueFrom,
      discover,
    } satisfies SuggestionsResponse);
  } catch (error) {
    return serverError("GET /api/suggestions failed", error);
  }
}

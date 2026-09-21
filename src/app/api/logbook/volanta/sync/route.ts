import { cookies } from "next/headers";
import { jsonError, requireUser, serverError } from "@/lib/api";
import { fetchVolantaPage, parseVolantaPage } from "@/lib/logbook/volanta-account";
import { importRows } from "@/lib/logbook/import";
import { countLogbook, MAX_LOGBOOK_FLIGHTS } from "@/lib/logbook/repo";
import { VolantaError } from "@/lib/logbook/volanta";
import { openVolantaSession, volantaSessionSecret, VOLANTA_COOKIE, VOLANTA_COOKIE_OPTIONS } from "@/lib/logbook/volanta-session";
import type { VolantaSyncResponse } from "@/lib/types";

export async function POST(request: Request) {
  const user = await requireUser();
  if ("response" in user) return user.response;
  const page = parseVolantaPage(new URL(request.url).searchParams.get("page"));
  if (page === null) return jsonError("Invalid flight page", 400);
  const jar = await cookies();
  try {
    const token = await openVolantaSession(jar.get(VOLANTA_COOKIE)?.value, user.userId, volantaSessionSecret());
    if (!token) return jsonError("Connect Volanta again; your session has expired.", 401);
    const data = await fetchVolantaPage(token, page);
    const result = await importRows(user.userId, "volanta", data.rows);
    const full = await countLogbook(user.userId) >= MAX_LOGBOOK_FLIGHTS;
    const capped = data.nextPage !== null && (full || page >= 400);
    return Response.json({
      ...result, skipped: data.skipped, total: data.total, nextPage: capped ? null : data.nextPage,
      errors: [...result.errors, ...(capped ? [`Import stopped at the ${MAX_LOGBOOK_FLIGHTS.toLocaleString()}-flight limit.`] : [])],
    } satisfies VolantaSyncResponse, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof VolantaError) {
      if (error.status === 401) jar.set(VOLANTA_COOKIE, "", { ...VOLANTA_COOKIE_OPTIONS, maxAge: 0 });
      return jsonError(error.message, error.status);
    }
    return serverError("POST Volanta sync failed", error);
  }
}

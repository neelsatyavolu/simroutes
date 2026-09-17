import { z } from "zod";
import { jsonError, requireUser, serverError } from "@/lib/api";
import { importRows } from "@/lib/logbook/import";
import { fetchRecentVolantaFlights, VolantaError } from "@/lib/logbook/volanta";

const bodySchema = z.object({ username: z.string().trim().min(1).max(40) });

export async function POST(request: Request) {
  const user = await requireUser();
  if ("response" in user) return user.response;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter your Volanta username", 400);

  try {
    const rows = await fetchRecentVolantaFlights(body.data.username);
    if (rows.length === 0) return jsonError("No public flights found on that Volanta profile", 404);
    return Response.json(await importRows(user.userId, "volanta", rows));
  } catch (error) {
    if (error instanceof VolantaError) return jsonError(error.message, error.status);
    return serverError("POST /api/logbook/import/volanta failed", error);
  }
}

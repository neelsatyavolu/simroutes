import { requireUser, serverError } from "@/lib/api";
import { clearLogbook, listLogbook } from "@/lib/logbook/repo";
import type { LogbookResponse } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  try {
    return Response.json({ flights: await listLogbook(user.userId) } satisfies LogbookResponse);
  } catch (error) {
    return serverError("GET /api/logbook failed", error);
  }
}

export async function DELETE() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  try {
    return Response.json({ deleted: await clearLogbook(user.userId) });
  } catch (error) {
    return serverError("DELETE /api/logbook failed", error);
  }
}

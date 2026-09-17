import { jsonError, requireUser, serverError } from "@/lib/api";
import { deleteLogbookFlight } from "@/lib/logbook/repo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: RouteContext<"/api/logbook/[id]">) {
  const user = await requireUser();
  if ("response" in user) return user.response;
  const { id } = await params;
  if (!UUID.test(id)) return jsonError("Invalid flight id", 400);
  try {
    return (await deleteLogbookFlight(user.userId, id)) ? new Response(null, { status: 204 }) : jsonError("Flight not found", 404);
  } catch (error) {
    return serverError("DELETE /api/logbook/[id] failed", error);
  }
}

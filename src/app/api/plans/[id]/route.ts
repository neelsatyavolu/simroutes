import { jsonError, requireUser, serverError } from "@/lib/api";
import { addToLogbook } from "@/lib/logbook/repo";
import { deletePlan, getPlan, updatePlan } from "@/lib/planner/repo";
import { parsePlanUpdate } from "@/lib/planner/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: RouteContext<"/api/plans/[id]">) {
  const user = await requireUser();
  if ("response" in user) return user.response;
  const { id } = await params;
  if (!UUID.test(id)) return jsonError("Invalid plan id", 400);
  const parsed = parsePlanUpdate(await request.json().catch(() => null), new Date());
  if (!parsed.ok) return jsonError(parsed.error, 400);

  try {
    const existing = await getPlan(user.userId, id);
    if (!existing) return jsonError("Plan not found", 404);
    if ("status" in parsed.update && existing.status !== "flown") {
      // Logged with the plan id as external id, so marking twice can't duplicate it.
      await addToLogbook(user.userId, "plan", [{
        depIcao: existing.depIcao,
        arrIcao: existing.arrIcao,
        aircraft: existing.aircraft,
        blockMinutes: existing.ofp?.blockMinutes ?? existing.blockMinutes,
        flownAt: new Date(`${existing.plannedDate}T${existing.depLocal}:00Z`).toISOString(),
        externalId: existing.id,
      }]);
    }
    return Response.json({ plan: await updatePlan(user.userId, id, parsed.update) });
  } catch (error) {
    return serverError("PATCH /api/plans/[id] failed", error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/plans/[id]">) {
  const user = await requireUser();
  if ("response" in user) return user.response;
  const { id } = await params;
  if (!UUID.test(id)) return jsonError("Invalid plan id", 400);
  try {
    return (await deletePlan(user.userId, id)) ? new Response(null, { status: 204 }) : jsonError("Plan not found", 404);
  } catch (error) {
    return serverError("DELETE /api/plans/[id] failed", error);
  }
}

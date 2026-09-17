import { jsonError, requireUser, serverError } from "@/lib/api";
import { countPlans, createPlan, listPlans, MAX_PLANS } from "@/lib/planner/repo";
import { parseNewPlan } from "@/lib/planner/validation";

export async function GET() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  try {
    return Response.json({ plans: await listPlans(user.userId) });
  } catch (error) {
    return serverError("GET /api/plans failed", error);
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if ("response" in user) return user.response;
  const parsed = parseNewPlan(await request.json().catch(() => null), new Date());
  if (!parsed.ok) return jsonError(parsed.error, 400);
  try {
    if ((await countPlans(user.userId)) >= MAX_PLANS) return jsonError(`You can plan up to ${MAX_PLANS} flights`, 409);
    return Response.json({ plan: await createPlan(user.userId, parsed.plan) }, { status: 201 });
  } catch (error) {
    return serverError("POST /api/plans failed", error);
  }
}

import { jsonError, requireUser, serverError } from "@/lib/api";
import { getPlan, updatePlan } from "@/lib/planner/repo";
import { getNavigraphLink } from "@/lib/planner/settings-repo";
import { fetchLatestOfp, SimbriefError } from "@/lib/planner/simbrief";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Attaches the user's latest SimBrief OFP to the plan, if it's for the same route. */
export async function POST(_request: Request, { params }: RouteContext<"/api/plans/[id]/ofp">) {
  const user = await requireUser();
  if ("response" in user) return user.response;
  const { id } = await params;
  if (!UUID.test(id)) return jsonError("Invalid plan id", 400);

  try {
    const [plan, link] = await Promise.all([getPlan(user.userId, id), getNavigraphLink(user.userId)]);
    if (!plan) return jsonError("Plan not found", 404);
    if (!link) return jsonError("Connect your Navigraph account to load SimBrief flight plans", 409);

    const ofp = await fetchLatestOfp(link.alias);
    if (ofp.depIcao !== plan.depIcao || ofp.arrIcao !== plan.arrIcao) {
      return jsonError(
        `Your latest SimBrief plan is ${ofp.depIcao}→${ofp.arrIcao}. Generate one for ${plan.depIcao}→${plan.arrIcao} first, then try again.`,
        409,
      );
    }
    return Response.json({ plan: await updatePlan(user.userId, id, { ofp }) });
  } catch (error) {
    if (error instanceof SimbriefError) return jsonError(error.message, error.status);
    return serverError("POST /api/plans/[id]/ofp failed", error);
  }
}

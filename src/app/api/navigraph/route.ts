import { requireUser, serverError } from "@/lib/api";
import { navigraphConfig } from "@/lib/planner/navigraph";
import { getNavigraphLink, removeNavigraphLink } from "@/lib/planner/settings-repo";
import type { NavigraphStatus } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  try {
    const link = await getNavigraphLink(user.userId);
    return Response.json({ configured: navigraphConfig() !== null, alias: link?.alias ?? null } satisfies NavigraphStatus);
  } catch (error) {
    return serverError("GET /api/navigraph failed", error);
  }
}

export async function DELETE() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  try {
    await removeNavigraphLink(user.userId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return serverError("DELETE /api/navigraph failed", error);
  }
}

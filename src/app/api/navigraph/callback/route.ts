import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, navigraphConfig } from "@/lib/planner/navigraph";
import { backToPlanner, COOKIE_OPTIONS, redirectUri, STATE_COOKIE, VERIFIER_COOKIE } from "@/lib/planner/oauth-cookies";
import { saveNavigraphLink } from "@/lib/planner/settings-repo";

function finish(request: NextRequest, outcome: string) {
  const response = NextResponse.redirect(backToPlanner(request, outcome));
  response.cookies.set(STATE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(VERIFIER_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return finish(request, "signed-out");
  const config = navigraphConfig();
  if (!config) return finish(request, "not-configured");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return finish(request, "denied");
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;
  if (!code || !state || !expectedState || !verifier || state !== expectedState) return finish(request, "invalid-state");

  try {
    const identity = await exchangeCode(config, { code, verifier, redirectUri: redirectUri(request) });
    await saveNavigraphLink(userId, identity.subject, identity.alias);
    return finish(request, "connected");
  } catch (error) {
    console.error("Navigraph callback failed", error);
    return finish(request, "failed");
  }
}

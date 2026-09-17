import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, codeChallenge, navigraphConfig, randomToken } from "@/lib/planner/navigraph";
import { backToPlanner, COOKIE_OPTIONS, redirectUri, STATE_COOKIE, VERIFIER_COOKIE } from "@/lib/planner/oauth-cookies";

/** Starts Navigraph sign-in: stores state + PKCE verifier in short-lived cookies and redirects. */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(backToPlanner(request, "signed-out"));
  const config = navigraphConfig();
  if (!config) return NextResponse.redirect(backToPlanner(request, "not-configured"));

  const state = randomToken();
  const verifier = randomToken();
  const response = NextResponse.redirect(
    authorizeUrl({ clientId: config.clientId, redirectUri: redirectUri(request), state, challenge: await codeChallenge(verifier) }),
  );
  response.cookies.set(STATE_COOKIE, state, COOKIE_OPTIONS);
  response.cookies.set(VERIFIER_COOKIE, verifier, COOKIE_OPTIONS);
  return response;
}

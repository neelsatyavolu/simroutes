import type { NextRequest } from "next/server";

export const STATE_COOKIE = "ng_oauth_state";
export const VERIFIER_COOKIE = "ng_oauth_verifier";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/navigraph",
  maxAge: 600,
};

/** Must exactly match the redirect URI registered with Navigraph. */
export const redirectUri = (request: NextRequest) =>
  process.env.NAVIGRAPH_REDIRECT_URI ?? `${request.nextUrl.origin}/api/navigraph/callback`;

/** Back to the planner tab with an outcome flag the UI can show. */
export const backToPlanner = (request: NextRequest, outcome: string) =>
  new URL(`/?tab=planned&navigraph=${encodeURIComponent(outcome)}`, request.nextUrl.origin);

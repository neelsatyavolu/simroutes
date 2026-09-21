import { cookies } from "next/headers";
import { jsonError, requireUser, serverError } from "@/lib/api";
import { connectVolanta, parseVolantaLogin } from "@/lib/logbook/volanta-account";
import { VolantaError } from "@/lib/logbook/volanta";
import { openVolantaSession, sealVolantaSession, volantaSessionSecret, VOLANTA_COOKIE, VOLANTA_COOKIE_OPTIONS } from "@/lib/logbook/volanta-session";
import type { VolantaConnectionResponse } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  try {
    const token = await openVolantaSession((await cookies()).get(VOLANTA_COOKIE)?.value, user.userId, volantaSessionSecret());
    return Response.json({ connected: !!token } satisfies VolantaConnectionResponse, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return serverError("GET Volanta connection failed", error);
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if ("response" in user) return user.response;
  const parsed = parseVolantaLogin(await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error, 400);
  try {
    const secret = volantaSessionSecret();
    const result = await connectVolanta(parsed.credentials);
    if (result.kind === "two-factor") return Response.json({ connected: false, twoFactorRequired: true } satisfies VolantaConnectionResponse);
    const session = await sealVolantaSession(result.token, user.userId, secret);
    (await cookies()).set(VOLANTA_COOKIE, session, VOLANTA_COOKIE_OPTIONS);
    return Response.json({ connected: true } satisfies VolantaConnectionResponse, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof VolantaError) return jsonError(error.message, error.status);
    return serverError("POST Volanta connection failed", error);
  }
}

export async function DELETE() {
  const user = await requireUser();
  if ("response" in user) return user.response;
  (await cookies()).set(VOLANTA_COOKIE, "", { ...VOLANTA_COOKIE_OPTIONS, maxAge: 0 });
  return new Response(null, { status: 204 });
}

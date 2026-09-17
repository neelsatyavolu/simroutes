import { auth } from "@clerk/nextjs/server";

export const jsonError = (message: string, status: number) => Response.json({ error: message }, { status });

/** Returns the signed-in user's id, or a 401 response to return directly. */
export async function requireUser(): Promise<{ userId: string } | { response: Response }> {
  const { userId } = await auth();
  return userId ? { userId } : { response: jsonError("Sign in to use your logbook", 401) };
}

/** Logs the detail server-side and returns a generic 500. */
export function serverError(context: string, error: unknown): Response {
  console.error(context, error);
  return jsonError("Something went wrong. Please try again.", 500);
}

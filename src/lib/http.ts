// Vercel firewall rate limits return 429 without the API's JSON error body.
const fallbackMessage = (status: number) =>
  status === 429 ? "Too many attempts. Please wait a few minutes and try again." : `Request failed (${status})`;

/** Fetches JSON, turning non-2xx responses into Errors carrying the API's error message. */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return sendJson<T>(url, { signal });
}

async function readBody(res: Response, signal?: AbortSignal | null): Promise<unknown> {
  try {
    return await res.json();
  } catch (error) {
    // An aborted body read must not look like a successful empty payload.
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    if (res.ok) throw new Error("The server returned an unreadable response.");
    return {};
  }
}

export async function sendJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await readBody(res, init.signal);
  if (!res.ok) throw new Error((body as { error?: string }).error ?? fallbackMessage(res.status));
  return body as T;
}

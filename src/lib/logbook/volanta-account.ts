import { z } from "zod";
import { mapVolantaFlights, VolantaError, volantaResponseSchema } from "@/lib/logbook/volanta";

const API = "https://api.volanta.app/api/v1";
const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1024),
  twoFactorCode: z.string().trim().regex(/^\d{6}$/).optional(),
});
type Credentials = z.infer<typeof loginSchema>;

export function parseVolantaLogin(value: unknown) {
  const parsed = loginSchema.safeParse(value);
  return parsed.success
    ? { ok: true as const, credentials: parsed.data }
    : { ok: false as const, error: "Enter your Volanta username, password and a six-digit authentication code if enabled" };
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "error" });
  } catch {
    throw new VolantaError("Could not reach Volanta. Please try again.", 502);
  }
  if (response.status === 429) throw new VolantaError("Volanta is limiting requests. Please wait before trying again.", 429);
  if (response.status === 401) throw new VolantaError("Connect Volanta again; your session has expired.", 401);
  if (response.status === 400 || response.status === 422) throw new VolantaError("Check your Volanta username, password and authentication code", 400);
  if (!response.ok) throw new VolantaError("Volanta could not complete the request. Please try again later.", 502);
  try {
    return await response.json();
  } catch {
    throw new VolantaError("Volanta returned an unreadable response", 502);
  }
}

/** Uses the same sign-in endpoint as Volanta's app. Passwords are never persisted. */
export async function connectVolanta(credentials: Credentials) {
  const data = z.object({ token: z.string().nullable().optional(), twoFactorEnabled: z.boolean().optional() }).safeParse(
    await request("/Session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(credentials) }),
  );
  if (!data.success) throw new VolantaError("Volanta returned an unexpected sign-in response", 502);
  if (data.data.token) return { kind: "connected" as const, token: data.data.token };
  if (data.data.twoFactorEnabled) return { kind: "two-factor" as const };
  throw new VolantaError("Check your Volanta username, password and authentication code", 400);
}

const pageSchema = volantaResponseSchema.extend({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(0),
  totalEntries: z.number().int().min(0),
});

export async function fetchVolantaPage(token: string, page: number) {
  const params = new URLSearchParams({ Page: String(page), PageSize: "100", SortField: "OffBlocksTime", Ascending: "false", RemoveNulls: "false" });
  const parsed = pageSchema.safeParse(await request(`/Flights/Search?${params}`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }));
  if (!parsed.success || parsed.data.page !== page || (parsed.data.items.length === 0 && page < parsed.data.totalPages)) {
    throw new VolantaError("Volanta returned an unexpected flight page; import stopped", 502);
  }
  const data = parsed.data;
  // Only completed flights inform recommendations; live/incomplete flights stay out of the logbook.
  const items = data.items.filter((flight) => flight.offBlocksTime && flight.onBlocksTime);
  const rows = mapVolantaFlights({ items });
  return { rows, skipped: data.items.length - rows.length, total: data.totalEntries, nextPage: page < data.totalPages ? page + 1 : null };
}

export function parseVolantaPage(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 400 ? page : null;
}

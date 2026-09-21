import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, DELETE } from "@/app/api/logbook/volanta/route";
import { POST as sync } from "@/app/api/logbook/volanta/sync/route";
import { requireUser } from "@/lib/api";
import { connectVolanta, fetchVolantaPage } from "@/lib/logbook/volanta-account";
import { importRows } from "@/lib/logbook/import";
import { countLogbook } from "@/lib/logbook/repo";
import { openVolantaSession, sealVolantaSession } from "@/lib/logbook/volanta-session";
import { VolantaError } from "@/lib/logbook/volanta";

const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("@/lib/api", async (original) => ({ ...await original<typeof import("@/lib/api")>(), requireUser: vi.fn() }));
vi.mock("@/lib/logbook/volanta-account", async (original) => ({ ...await original<typeof import("@/lib/logbook/volanta-account")>(), connectVolanta: vi.fn(), fetchVolantaPage: vi.fn() }));
vi.mock("@/lib/logbook/import", () => ({ importRows: vi.fn() }));
vi.mock("@/lib/logbook/repo", () => ({ countLogbook: vi.fn(), MAX_LOGBOOK_FLIGHTS: 10000 }));
vi.mock("@/lib/logbook/volanta-session", async (original) => ({ ...await original<typeof import("@/lib/logbook/volanta-session")>(), volantaSessionSecret: () => "test-only-secret" }));
const login = () => new Request("http://localhost/api/logbook/volanta", { method: "POST", body: JSON.stringify({ username: "pilot", password: "secret" }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ userId: "user-a" });
  jar.get.mockReturnValue(undefined);
});

describe("Volanta connection routes", () => {
  it("requires SimRoutes sign-in before using credentials", async () => {
    vi.mocked(requireUser).mockResolvedValue({ response: Response.json({}, { status: 401 }) });
    expect((await POST(login())).status).toBe(401);
    expect(connectVolanta).not.toHaveBeenCalled();
  });
  it("returns a two-factor challenge without setting a session", async () => {
    vi.mocked(connectVolanta).mockResolvedValue({ kind: "two-factor" });
    expect(await (await POST(login())).json()).toEqual({ connected: false, twoFactorRequired: true });
    expect(jar.set).not.toHaveBeenCalled();
  });
  it("keeps tokens out of response JSON and scopes the cookie to the signed-in user", async () => {
    vi.mocked(connectVolanta).mockResolvedValue({ kind: "connected", token: "private-token" });
    expect(await (await POST(login())).json()).toEqual({ connected: true });
    const [, cookie, options] = jar.set.mock.calls[0];
    expect(options).toMatchObject({ httpOnly: true, sameSite: "strict", maxAge: 3600, path: "/api/logbook/volanta" });
    expect(await openVolantaSession(cookie, "user-a", "test-only-secret")).toBe("private-token");
    expect(await openVolantaSession(cookie, "user-b", "test-only-secret")).toBeNull();
    await DELETE();
    expect(jar.set.mock.lastCall?.[2].maxAge).toBe(0);
  });
  it("rejects another user's session before fetching or importing", async () => {
    jar.get.mockReturnValue({ value: await sealVolantaSession("token", "user-b", "test-only-secret") });
    expect(await (await GET()).json()).toEqual({ connected: false });
    expect((await sync(new Request("http://localhost/api/logbook/volanta/sync?page=1", { method: "POST" }))).status).toBe(401);
    expect(fetchVolantaPage).not.toHaveBeenCalled();
    expect(importRows).not.toHaveBeenCalled();
  });
  it("imports pages into the current user's logbook and preserves pagination", async () => {
    jar.get.mockReturnValue({ value: await sealVolantaSession("token", "user-a", "test-only-secret") });
    vi.mocked(fetchVolantaPage).mockResolvedValue({ rows: [], total: 105, skipped: 1, nextPage: 2 });
    vi.mocked(importRows).mockResolvedValue({ added: 0, duplicates: 0, errors: [] });
    vi.mocked(countLogbook).mockResolvedValue(0);
    const result = await sync(new Request("http://localhost/api/logbook/volanta/sync?page=1", { method: "POST" }));
    expect(importRows).toHaveBeenCalledWith("user-a", "volanta", []);
    expect(await result.json()).toMatchObject({ total: 105, nextPage: 2, skipped: 1 });
  });
  it("clears an expired upstream session", async () => {
    jar.get.mockReturnValue({ value: await sealVolantaSession("token", "user-a", "test-only-secret") });
    vi.mocked(fetchVolantaPage).mockRejectedValue(new VolantaError("Connect Volanta again", 401));
    expect((await sync(new Request("http://localhost/api/logbook/volanta/sync?page=1", { method: "POST" }))).status).toBe(401);
    expect(jar.set.mock.lastCall?.[2].maxAge).toBe(0);
  });
});

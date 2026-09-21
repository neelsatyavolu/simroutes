import { afterEach, describe, expect, it, vi } from "vitest";
import { connectVolanta, fetchVolantaPage, parseVolantaLogin } from "@/lib/logbook/volanta-account";
import { sealVolantaSession, openVolantaSession } from "@/lib/logbook/volanta-session";

afterEach(() => vi.unstubAllGlobals());
const mockResponse = (data: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data, { status })));

describe("Volanta account", () => {
  it("validates credentials without changing the password", () => {
    expect(parseVolantaLogin({ username: " pilot ", password: " password ", twoFactorCode: "123456" })).toMatchObject({ ok: true, credentials: { username: "pilot", password: " password ", twoFactorCode: "123456" } });
    expect(parseVolantaLogin({ username: "pilot", password: "" }).ok).toBe(false);
  });
  it("reports the two-factor challenge without returning a token", async () => {
    mockResponse({ twoFactorEnabled: true, token: null });
    expect(await connectVolanta({ username: "pilot", password: "secret" })).toEqual({ kind: "two-factor" });
  });
  it("accepts a token after two-factor authentication", async () => {
    mockResponse({ twoFactorEnabled: true, token: "test-token" });
    expect(await connectVolanta({ username: "pilot", password: "secret", twoFactorCode: "123456" })).toEqual({ kind: "connected", token: "test-token" });
  });
  it("does not expose upstream errors or credentials", async () => {
    mockResponse({ code: "InvalidUsernameOrPassword", error: "secret" }, 422);
    await expect(connectVolanta({ username: "pilot", password: "secret" })).rejects.toThrow("Check your Volanta username, password and authentication code");
  });
  it("follows server pagination even when the page is smaller than requested", async () => {
    mockResponse({ page: 1, pageSize: 25, totalPages: 3, totalEntries: 51, items: [{ id: "flight-1", origin: { icaoCode: "EGLL" }, destination: { icaoCode: "KJFK" }, onBlocksTime: "2026-09-01T12:00:00", offBlocksTime: "2026-09-01T10:00:00" }] });
    const result = await fetchVolantaPage("test-token", 1);
    expect(result.nextPage).toBe(2);
    expect(result.rows[0]).toMatchObject({ externalId: "flight-1", dep: "EGLL", arr: "KJFK" });
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer test-token" });
  });
  it("rejects malformed or repeated pages instead of claiming import success", async () => {
    mockResponse({ page: 1, pageSize: 25, totalPages: 3, totalEntries: 51, items: [] });
    await expect(fetchVolantaPage("token", 2)).rejects.toThrow();
    mockResponse({ nope: [] });
    await expect(fetchVolantaPage("token", 1)).rejects.toThrow();
  });
  it("stops on expired sessions and rate limits", async () => {
    mockResponse({}, 401);
    await expect(fetchVolantaPage("token", 1)).rejects.toThrow("Connect Volanta again");
    mockResponse({}, 429);
    await expect(fetchVolantaPage("token", 1)).rejects.toThrow("Volanta is limiting requests");
  });
});

describe("encrypted Volanta session", () => {
  const key = "test-secret-key-not-real";
  it("is private, user-bound, tamper resistant and expires", async () => {
    const cookie = await sealVolantaSession("private-token", "user-a", key);
    expect(cookie).not.toContain("private-token");
    expect(await openVolantaSession(cookie, "user-a", key)).toBe("private-token");
    expect(await openVolantaSession(cookie, "user-b", key)).toBeNull();
    expect(await openVolantaSession(cookie, "user-a", "wrong-key")).toBeNull();
    expect(await openVolantaSession(cookie + "x", "user-a", key)).toBeNull();
    expect(await openVolantaSession(cookie, "user-a", key, new Date(Date.now() + 3_700_000))).toBeNull();
  });
});

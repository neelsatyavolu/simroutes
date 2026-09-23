import { afterEach, describe, expect, it, vi } from "vitest";
import { sendJson } from "./http";

const respond = (body: string, status: number) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

afterEach(() => vi.unstubAllGlobals());

describe("sendJson", () => {
  it("uses the API's error message", async () => {
    respond(JSON.stringify({ error: "Nope" }), 400);
    await expect(sendJson("/x", {})).rejects.toThrow("Nope");
  });

  it("explains firewall rate limits, which have no JSON body", async () => {
    respond("Too Many Requests", 429);
    await expect(sendJson("/x", {})).rejects.toThrow("Too many attempts. Please wait a few minutes and try again.");
  });
});

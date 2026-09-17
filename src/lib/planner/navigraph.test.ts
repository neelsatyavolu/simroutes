import { describe, expect, it } from "vitest";
import { authorizeUrl, codeChallenge, navigraphConfig } from "./navigraph";

describe("codeChallenge", () => {
  it("matches the RFC 7636 S256 example", async () => {
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("authorizeUrl", () => {
  it("builds an authorization-code + PKCE request", () => {
    const url = new URL(authorizeUrl({ clientId: "simroutes", redirectUri: "https://x.test/cb", state: "st", challenge: "ch" }));
    expect(url.origin + url.pathname).toBe("https://identity.api.navigraph.com/connect/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "simroutes",
      response_type: "code",
      scope: "openid profile",
      redirect_uri: "https://x.test/cb",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });
});

describe("navigraphConfig", () => {
  it("is null until credentials are configured", () => {
    expect(navigraphConfig({})).toBeNull();
    expect(navigraphConfig({ NAVIGRAPH_CLIENT_ID: "id", NAVIGRAPH_CLIENT_SECRET: "secret" })).toEqual({ clientId: "id", clientSecret: "secret" });
  });
});

import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Navigraph sign-in (OpenID Connect, authorization code + PKCE).
 * Credentials are issued by Navigraph on request (dev@navigraph.com); the feature stays off until then.
 * Only the user's Navigraph alias is kept: it doubles as their SimBrief username for fetching OFPs.
 */
const ISSUER = "https://identity.api.navigraph.com";
const SCOPE = "openid profile";
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));

export interface NavigraphConfig {
  clientId: string;
  clientSecret: string;
}

export function navigraphConfig(env: Record<string, string | undefined> = process.env): NavigraphConfig | null {
  const clientId = env.NAVIGRAPH_CLIENT_ID;
  const clientSecret = env.NAVIGRAPH_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const base64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

export async function codeChallenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

export function authorizeUrl(p: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const params = new URLSearchParams({
    client_id: p.clientId,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: p.redirectUri,
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
  });
  return `${ISSUER}/connect/authorize?${params}`;
}

export interface NavigraphIdentity {
  subject: string;
  alias: string;
}

/** Exchanges the code for tokens and returns the verified identity from the ID token. */
export async function exchangeCode(
  config: NavigraphConfig,
  p: { code: string; verifier: string; redirectUri: string },
): Promise<NavigraphIdentity> {
  const res = await fetch(`${ISSUER}/connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: p.code,
      code_verifier: p.verifier,
      redirect_uri: p.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Navigraph token exchange failed (${res.status})`);
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new Error("Navigraph did not return an ID token");

  const { payload } = await jwtVerify(idToken, jwks, { issuer: ISSUER, audience: config.clientId });
  const alias = typeof payload.preferred_username === "string" ? payload.preferred_username : null;
  if (!payload.sub || !alias) throw new Error("Navigraph ID token is missing the user's alias");
  return { subject: payload.sub, alias };
}

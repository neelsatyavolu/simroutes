import { hkdfSync } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

export const VOLANTA_COOKIE = "simroutes_volanta";
export const VOLANTA_COOKIE_OPTIONS = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const,
  path: "/api/logbook/volanta", maxAge: 3600,
};

// Separate encryption key derived for this purpose; Clerk key rotation also disconnects Volanta.
const key = (secret: string) => new Uint8Array(hkdfSync("sha256", secret, "simroutes", "volanta-session-v1", 32));
export function volantaSessionSecret() {
  const secret = process.env.VOLANTA_SESSION_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Volanta session encryption is not configured");
  return secret;
}

export async function sealVolantaSession(token: string, userId: string, secret: string) {
  const cookie = await new EncryptJWT({ token }).setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setSubject(userId).setAudience("volanta-import").setIssuedAt().setExpirationTime("1h").encrypt(key(secret));
  if (cookie.length > 3800) throw new Error("Volanta session exceeds cookie size limit");
  return cookie;
}

export async function openVolantaSession(cookie: string | undefined, userId: string, secret: string, currentDate = new Date()) {
  if (!cookie) return null;
  try {
    const { payload } = await jwtDecrypt(cookie, key(secret), { audience: "volanta-import", subject: userId, currentDate });
    return typeof payload.token === "string" ? payload.token : null;
  } catch {
    return null;
  }
}

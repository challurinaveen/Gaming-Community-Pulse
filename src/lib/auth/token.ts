import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24;

/**
 * The cookie-signing key is derived one-way (HMAC-SHA256) from SUPABASE_SECRET_KEY, so the app needs
 * only the credentials listed in the report's Appendix A. Without that key no session can be issued
 * or accepted (fail closed). Rotating the Supabase secret key signs everyone out.
 */
function getSecret(): Uint8Array | null {
  const base = process.env.SUPABASE_SECRET_KEY;
  if (!base) return null;
  return new Uint8Array(createHmac("sha256", base).update("gaming-community-pulse/session/v1").digest());
}

export function isSessionConfigured(): boolean {
  return getSecret() !== null;
}

export async function createSessionToken(email: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set, so sessions cannot be signed");
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<{ email: string } | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return typeof payload.email === "string" ? { email: payload.email } : null;
  } catch {
    return null;
  }
}

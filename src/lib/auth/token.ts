import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24;

/** No fallback secret: without a strong SESSION_SECRET no session can be issued or accepted (fail closed). */
function getSecret(): Uint8Array | null {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) return null;
  return new TextEncoder().encode(raw);
}

export function isSessionConfigured(): boolean {
  return getSecret() !== null;
}

export async function createSessionToken(email: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
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

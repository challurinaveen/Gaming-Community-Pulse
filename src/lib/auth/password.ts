import { scrypt } from "scrypt-js";
import { Buffer } from "buffer";

const N = 16384;
const r = 8;
const p = 1;
const dkLen = 64;

/**
 * Hash a password with scrypt-js using a random 32-byte salt.
 * Returns the string in the format `hex(salt)$hex(hash)`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const passwordBytes = new TextEncoder().encode(password);

  const derived = await scrypt(passwordBytes, salt, N, r, p, dkLen);

  const saltHex = Buffer.from(salt).toString("hex");
  const hashHex = Buffer.from(derived).toString("hex");

  return `${saltHex}$${hashHex}`;
}

/**
 * Verify a password against a stored `salt$hash` string.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const dollarIndex = stored.indexOf("$");
  if (dollarIndex === -1) return false;

  const saltHex = stored.slice(0, dollarIndex);
  const storedHashHex = stored.slice(dollarIndex + 1);

  const salt = Buffer.from(saltHex, "hex");
  const passwordBytes = new TextEncoder().encode(password);

  const derived = await scrypt(passwordBytes, salt, N, r, p, dkLen);
  const derivedHex = Buffer.from(derived).toString("hex");

  // Timing-safe comparison using Node.js crypto
  const { timingSafeEqual } = await import("crypto");

  const a = Buffer.from(derivedHex, "utf-8");
  const b = Buffer.from(storedHashHex, "utf-8");

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * Pre-computed dummy hash for timing-safe rejection of unknown emails.
 * This ensures login attempts for non-existent users take roughly the same
 * time as attempts for real users, preventing user-enumeration attacks.
 */
export const DUMMY_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000$" +
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2" +
  "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

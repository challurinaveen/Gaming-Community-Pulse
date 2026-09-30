"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/db/supabase";
import { hashPassword, verifyPassword, DUMMY_HASH } from "./password";
import { createSessionToken, isSessionConfigured, COOKIE_NAME, SESSION_TTL_SECONDS } from "./token";
import { clearAttempts, isRateLimited, recordAttempt } from "./rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_PAIR = 5;
const LOGIN_MAX_PER_EMAIL = 20;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX = 5;

/** Comma-separated domains allowed to self-register (e.g. "rs-group.com"). Empty = anyone. */
function isAllowedEmailDomain(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(email.split("@")[1] ?? "");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthActionState {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function loginAction(
  _prev: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    return { fieldErrors: { email: !email ? "Email is required" : undefined, password: !password ? "Password is required" : undefined } };
  }

  // Failed attempts only: per IP+email, plus a looser per-email cap so rotating IPs can't brute-force one account.
  const ip = await getClientIp();
  const pairKey = `login:${ip}:${email}`;
  const emailKey = `login-email:${email}`;
  if ((await isRateLimited(pairKey, LOGIN_MAX_PER_PAIR, LOGIN_WINDOW_MS)) || (await isRateLimited(emailKey, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_MS))) {
    return { error: "Too many failed sign-in attempts. Please try again in 15 minutes." };
  }

  const supabase = getSupabase();
  if (!supabase || !isSessionConfigured()) {
    return { error: "Sign-in is not configured on this server (account storage or SESSION_SECRET missing)." };
  }

  // Look up the user
  const { data: user, error: dbError } = await supabase
    .from("app_users")
    .select("email, password_hash")
    .eq("email", email)
    .single();

  // Always verify against a hash (real or dummy) to prevent timing attacks
  const hashToCheck = user?.password_hash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, hashToCheck);

  if (dbError || !user || !valid) {
    await Promise.all([recordAttempt(pairKey, LOGIN_WINDOW_MS), recordAttempt(emailKey, LOGIN_WINDOW_MS)]);
    return { error: "Invalid email or password." };
  }
  await clearAttempts(pairKey, emailKey);

  // Create session and set cookie
  const token = await createSessionToken(email);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function registerAction(
  _prev: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

  // Validate inputs
  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!email) fieldErrors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "Please enter a valid email address";

  if (!password) fieldErrors.password = "Password is required";
  else if (password.length < 8)
    fieldErrors.password = "Password must be at least 8 characters";

  if (password !== confirmPassword)
    fieldErrors.confirmPassword = "Passwords do not match";

  if (!fieldErrors.email && !isAllowedEmailDomain(email)) {
    fieldErrors.email = "Registration is restricted to approved company email domains";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const registerKey = `register:${await getClientIp()}`;
  if (await isRateLimited(registerKey, REGISTER_MAX, REGISTER_WINDOW_MS)) {
    return { error: "Too many registration attempts. Please try again later." };
  }
  await recordAttempt(registerKey, REGISTER_WINDOW_MS);

  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Account storage is not configured." };
  }

  // Check for existing user
  const { data: existing } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return { error: "An account with this email already exists." };
  }

  // Hash and insert
  const passwordHash = await hashPassword(password);

  const { error: insertError } = await supabase.from("app_users").insert({
    email,
    password_hash: passwordHash,
  });

  if (insertError) {
    console.error("[register] insert failed:", insertError.code, insertError.message);
    return { error: "Failed to create account. Please try again." };
  }

  redirect("/login?registered=true");
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}

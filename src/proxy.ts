import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/token";

// Report §3.10: every route, including the API, sits behind sign-in. Only the sign-in pages are public.
// The cron route is not a user route: it authenticates itself with CRON_SECRET instead of a session.
const PUBLIC_PATHS = new Set(["/login", "/register", "/api/cron/refresh"]);
const STATIC_FILE = /^\/[\w-]+\.(ico|png|jpe?g|svg|webp|gif|txt|xml|webmanifest)$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || STATIC_FILE.test(pathname)) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

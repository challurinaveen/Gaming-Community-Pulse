import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/dashboard/build";
import { getSessionFromCookies } from "@/lib/auth/session";

export const maxDuration = 300;

async function respond(force: boolean) {
  // The proxy already gates this route; re-check here because the payload contains raw post text.
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const payload = await getDashboard({ force });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[api/analysis] pipeline failed", error);
    return NextResponse.json({ error: "Analysis pipeline failed" }, { status: 500 });
  }
}

/** Latest analysis (served from a short-lived cache). */
export async function GET() {
  return respond(false);
}

/** Forces a fresh end-to-end run. POST so a cross-site link can't trigger paid API usage. */
export async function POST() {
  return respond(true);
}

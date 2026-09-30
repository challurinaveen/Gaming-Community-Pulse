import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/dashboard/build";

export const maxDuration = 300;

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET environment variable is set. */
function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily scheduled run (vercel.json): collects, scores and stores the day's snapshot without anyone opening the dashboard. */
export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const payload = await getDashboard({ force: true });
  return NextResponse.json({
    ok: true,
    generatedAt: payload.generatedAt,
    records: payload.summary.overall.totalRecords,
    liveRecords: payload.summary.overall.liveRecords,
    stored: payload.storage.last_write.saved,
    aiIssue: payload.engines.aiIssue,
  });
}

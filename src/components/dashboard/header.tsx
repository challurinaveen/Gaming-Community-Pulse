"use client";

import clsx from "clsx";
import { Activity, CircleAlert, CircleCheck, Info, LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import type { DashboardPayload } from "@/lib/dashboard/build";
import { PLATFORM_LABEL, shortDate, timeAgo } from "@/lib/format";

export function DashboardHeader({
  data,
  refreshing,
  onRefresh,
}: {
  data: DashboardPayload | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 shadow-lg shadow-accent/20">
            <Activity className="h-5 w-5 text-white" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-ink">Gaming Community Pulse</h1>
            <p className="truncate text-xs text-ink-3">
              {data ? (
                <>
                  Daily read for {shortDate(data.date)} · updated {timeAgo(data.generatedAt)}
                </>
              ) : (
                "Social listening for gaming communities"
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-accent-2 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={clsx("h-4 w-4", refreshing && "animate-spin")} aria-hidden />
            <span className="hidden sm:inline">{refreshing ? "Collecting…" : "Refresh"}</span>
          </button>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-2 transition hover:border-line-strong hover:text-ink"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function ProvenanceBanner({ data }: { data: DashboardPayload }) {
  const { sampleShare } = data.summary.overall;
  const hasErrors = data.provenance.some((p) => p.error);
  const allLive = sampleShare === 0 && !hasErrors;

  return (
    <div
      className={clsx(
        "flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        allLive ? "border-line bg-surface" : "border-warning/30 bg-warning/[0.06]"
      )}
      role="status"
    >
      <p className="flex items-start gap-2 text-sm text-ink-2">
        {allLive ? (
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        )}
        <span>
          {allLive ? (
            <>All figures come from live collection.</>
          ) : (
            <>
              <strong className="font-semibold text-ink">{Math.round(sampleShare * 100)}% of today&apos;s records are illustrative sample data</strong>{" "}
              standing in for platforms that aren&apos;t connected yet. Sample rows are labelled, never sent to AI models, and never stored.
            </>
          )}
        </span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {data.provenance.map((p) => {
          const state = p.error ? "error" : p.liveRecords > 0 ? "live" : p.configured ? "empty" : "sample";
          return (
            <li
              key={p.platform}
              title={p.error ?? undefined}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-ink-2"
            >
              {state === "live" && <CircleCheck className="h-3.5 w-3.5 text-good" aria-hidden />}
              {state === "sample" && <Info className="h-3.5 w-3.5 text-warning" aria-hidden />}
              {state === "empty" && <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden />}
              {state === "error" && <CircleAlert className="h-3.5 w-3.5 text-critical" aria-hidden />}
              <span className="font-medium text-ink">{PLATFORM_LABEL[p.platform]}</span>
              <span>
                {state === "live" && "Live"}
                {state === "sample" && "Sample"}
                {state === "empty" && "No data"}
                {state === "error" && "Error"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

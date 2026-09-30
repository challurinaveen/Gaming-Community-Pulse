"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Database, RefreshCw } from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard/build";
import { timeAgo } from "@/lib/format";
import { DashboardHeader, ProvenanceBanner } from "./header";
import { AlertsCard, BriefingCard, HeroSentiment, StatTiles } from "./overview";
import { GameOverview } from "./games";
import { TrendChart } from "./trend-chart";
import { PlatformPanel, RegionPanel, ThemesPanel } from "./breakdowns";
import { ClustersPanel, QuestionsPanel, RisksPanel } from "./discussion";
import { RecordsExplorer } from "./records-explorer";

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <p className="flex items-center gap-2 text-sm text-ink-3">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        Collecting and analysing community data. The first run can take a minute.
      </p>
      <div className="skeleton h-14 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="skeleton h-64 rounded-2xl lg:col-span-4" />
        <div className="skeleton h-64 rounded-2xl lg:col-span-8" />
      </div>
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );
}

function Footer({ data }: { data: DashboardPayload }) {
  const { storage, engines } = data;
  return (
    <footer className="mt-2 flex flex-col gap-2 border-t border-line pt-4 text-xs text-ink-3 md:flex-row md:items-center md:justify-between">
      <p>
        Sentiment: {engines.sentiment} · Briefing: {engines.briefing} · Clustering: {engines.clustering}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <Database className="h-3.5 w-3.5" aria-hidden />
          {storage.durable
            ? storage.last_write.saved
              ? `Stored in Supabase ${storage.last_write.at ? timeAgo(storage.last_write.at) : ""} · ${storage.retention_days}-day snapshot retention`
              : `Supabase connected · not saved: ${storage.last_write.error ?? "pending"}`
            : "No database configured, so history and day-over-day comparison are off"}
        </span>
        <a href="/api/methodology" target="_blank" className="text-accent hover:underline">
          Methodology
        </a>
      </p>
    </footer>
  );
}

class SignedOutError extends Error {}

async function fetchDashboard(force: boolean): Promise<DashboardPayload> {
  const res = await fetch("/api/analysis", { method: force ? "POST" : "GET", cache: "no-store" });
  if (res.status === 401) throw new SignedOutError("Signed out");
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
  return (await res.json()) as DashboardPayload;
}

export function DashboardApp() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  const settle = useCallback(
    (p: Promise<DashboardPayload>) =>
      p
        .then((payload) => {
          setData(payload);
          setError(null);
        })
        .catch((e: unknown) => {
          if (e instanceof SignedOutError) router.replace("/login");
          else setError(e instanceof Error ? e.message : "Something went wrong");
        })
        .finally(() => setRefreshing(false)),
    [router]
  );

  const load = useCallback(
    (force: boolean) => {
      setRefreshing(true);
      setError(null);
      void settle(fetchDashboard(force));
    },
    [settle]
  );

  useEffect(() => {
    void settle(fetchDashboard(false));
  }, [settle]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardHeader data={data} refreshing={refreshing} onRefresh={() => void load(true)} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-4 px-4 py-5 sm:px-6">
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-ink">
            <span className="flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0 text-critical" aria-hidden />
              {data ? "Refresh failed; showing the previous results." : "The dashboard couldn't load."} {error}
            </span>
            <button type="button" onClick={() => void load(!data)} className="shrink-0 text-accent hover:underline">
              Try again
            </button>
          </div>
        )}

        {!data ? (
          !error && <Skeleton />
        ) : (
          <>
            <ProvenanceBanner data={data} />

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <HeroSentiment data={data} />
              </div>
              <div className="lg:col-span-8">
                <StatTiles data={data} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <BriefingCard data={data} />
              </div>
              <div className="lg:col-span-5">
                <AlertsCard data={data} />
              </div>
            </div>

            <GameOverview data={data} />

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <TrendChart timeline={data.summary.timeline} />
              </div>
              <div className="lg:col-span-4">
                <RegionPanel data={data} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PlatformPanel data={data} />
              <ThemesPanel data={data} />
            </div>

            <ClustersPanel data={data} />

            <div className="grid gap-4 lg:grid-cols-2">
              <QuestionsPanel data={data} />
              <RisksPanel data={data} />
            </div>

            <RecordsExplorer data={data} />

            <Footer data={data} />
          </>
        )}
      </main>
    </div>
  );
}

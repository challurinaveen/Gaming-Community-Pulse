"use client";

import { useState } from "react";
import clsx from "clsx";
import { Globe, Layers, Tags } from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard/build";
import { capitalize, int, PLATFORM_LABEL, sentimentWord, signed } from "@/lib/format";
import { Badge, Card, DivergingBar, EmptyState, HoverTip, Meter } from "@/components/ui/primitives";

export function PlatformPanel({ data }: { data: DashboardPayload }) {
  const provenance = new Map(data.provenance.map((p) => [p.platform, p]));
  return (
    <Card
      title="Platforms"
      icon={<Layers className="h-4 w-4" aria-hidden />}
      subtitle="Engagement is normalised per platform, so a busy Discord thread and a viral Reddit post are comparable."
      className="h-full"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1.3fr)_minmax(0,1.3fr)] gap-x-3 border-b border-line pb-2 text-xs text-ink-3">
        <span>Platform</span>
        <span className="text-right">Records</span>
        <span>Avg sentiment</span>
        <span>Engagement</span>
      </div>
      <ul className="divide-y divide-line">
        {data.summary.platforms.map((p) => {
          const prov = provenance.get(p.platform);
          const isSample = prov ? prov.liveRecords === 0 && prov.sampleRecords > 0 : false;
          return (
            <li key={p.platform} className="grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1.3fr)_minmax(0,1.3fr)] items-center gap-x-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{PLATFORM_LABEL[p.platform]}</p>
                {isSample && <Badge tone="sample">Sample</Badge>}
              </div>
              <p className="tabular text-right text-sm text-ink">{int(p.records)}</p>
              <HoverTip content={`${sentimentWord(p.avgSentiment)} (${signed(p.avgSentiment, 1)})`} className="block outline-none">
                <p className="tabular mb-1 text-xs text-ink-2">{signed(p.avgSentiment)}</p>
                <DivergingBar value={p.avgSentiment} />
              </HoverTip>
              <HoverTip content={`Average engagement index ${p.avgEngagement.toFixed(1)} of 100`} className="block outline-none">
                <p className="tabular mb-1 text-xs text-ink-2">{p.avgEngagement.toFixed(0)}</p>
                <Meter value={p.avgEngagement} />
              </HoverTip>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function RegionPanel({ data }: { data: DashboardPayload }) {
  const regions = data.summary.regions;
  const max = Math.max(1, ...regions.map((r) => r.records));
  return (
    <Card
      title="Regions"
      icon={<Globe className="h-4 w-4" aria-hidden />}
      subtitle="Inferred from publisher-side signals only (channel country, server locale, language)"
      className="h-full"
    >
      {regions.length === 0 ? (
        <EmptyState>No records to classify.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {regions.map((r) => {
            const undetermined = r.region === "Undetermined";
            return (
              <li key={r.region}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={clsx("truncate", undetermined ? "text-ink-3" : "text-ink")}>{r.region}</span>
                  <span className="tabular shrink-0 text-xs text-ink-2">
                    {int(r.records)}
                    {!undetermined && <span className="text-ink-3"> · {signed(r.avgSentiment)} · {Math.round(r.avgConfidence * 100)}% conf.</span>}
                  </span>
                </div>
                <HoverTip
                  className="block outline-none"
                  content={
                    undetermined
                      ? "No publisher-side region signal was available for these records."
                      : `${int(r.records)} records · avg sentiment ${signed(r.avgSentiment, 1)} · mean confidence ${Math.round(r.avgConfidence * 100)}%`
                  }
                >
                  <div className="h-2 w-full">
                    <div className={clsx("h-full rounded-r", undetermined ? "bg-mid" : "bg-mag")} style={{ width: `${(r.records / max) * 100}%` }} />
                  </div>
                </HoverTip>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const THEME_PREVIEW = 8;

export function ThemesPanel({ data }: { data: DashboardPayload }) {
  const [showAll, setShowAll] = useState(false);
  const themes = data.summary.themes;
  const shown = showAll ? themes : themes.slice(0, THEME_PREVIEW);
  const max = Math.max(1, ...themes.map((t) => t.count));
  return (
    <Card
      title="Discussion themes"
      icon={<Tags className="h-4 w-4" aria-hidden />}
      subtitle="Share of conversation and how players feel about each"
      className="h-full"
      action={
        themes.length > THEME_PREVIEW ? (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs text-accent hover:underline">
            {showAll ? "Show fewer" : `Show all ${themes.length}`}
          </button>
        ) : null
      }
    >
      {themes.length === 0 ? (
        <EmptyState>No themes yet.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] gap-x-4 border-b border-line pb-2 text-xs text-ink-3">
            <span>Theme</span>
            <span>Mentions</span>
            <span>Avg sentiment</span>
          </div>
          <ul className="divide-y divide-line">
            {shown.map((t) => (
              <li key={t.theme} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] items-center gap-x-4 py-2.5">
                <span className="truncate text-sm text-ink">{capitalize(t.theme)}</span>
                <HoverTip content={`${int(t.count)} mentions`} className="block outline-none">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1">
                      <div className="h-full rounded-r bg-mag" style={{ width: `${(t.count / max) * 100}%` }} />
                    </div>
                    <span className="tabular w-8 text-right text-xs text-ink-2">{int(t.count)}</span>
                  </div>
                </HoverTip>
                <HoverTip content={`${sentimentWord(t.avgSentiment)} (${signed(t.avgSentiment, 1)})`} className="block outline-none">
                  <div className="flex items-center gap-2">
                    <DivergingBar value={t.avgSentiment} className="flex-1" />
                    <span className="tabular w-8 text-right text-xs text-ink-2">{signed(t.avgSentiment)}</span>
                  </div>
                </HoverTip>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

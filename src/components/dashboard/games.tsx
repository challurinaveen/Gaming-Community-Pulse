"use client";

import { Gamepad2, Radio, ShieldAlert } from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard/build";
import { capitalize, compact, int, PLATFORM_LABEL, sentimentWord, signed } from "@/lib/format";
import { PLATFORMS } from "@/lib/platforms";
import { Badge, Card, Delta, LegendKey } from "@/components/ui/primitives";
import { SplitBar } from "./overview";

export function GameOverview({ data }: { data: DashboardPayload }) {
  const viewers = new Map(data.liveViewers.map((v) => [v.game, v]));
  const games = [...data.summary.games].sort((a, b) => b.records - a.records);

  return (
    <Card
      title="Games"
      icon={<Gamepad2 className="h-4 w-4" aria-hidden />}
      subtitle="Sentiment split, volume and live audience per tracked title"
      action={
        <LegendKey
          items={[
            { label: "Negative", className: "bg-neg" },
            { label: "Neutral", className: "bg-mid" },
            { label: "Positive", className: "bg-pos" },
          ]}
        />
      }
    >
      <div className="hidden grid-cols-[minmax(150px,1.3fr)_minmax(200px,2.2fr)_90px_110px_minmax(140px,1.2fr)_110px] gap-4 border-b border-line pb-2 text-xs text-ink-3 lg:grid">
        <span>Game</span>
        <span>Sentiment split</span>
        <span className="text-right">Avg score</span>
        <span className="text-right">Records</span>
        <span>Top themes</span>
        <span className="text-right">Live viewers</span>
      </div>
      <ul className="divide-y divide-line">
        {games.map((g) => {
          const delta = data.comparison?.games[g.game];
          const live = viewers.get(g.game);
          const platformMix = PLATFORMS.filter((p) => g.platforms[p] > 0)
            .map((p) => `${PLATFORM_LABEL[p]} ${g.platforms[p]}`)
            .join(" · ");
          return (
            <li
              key={g.game}
              className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 lg:grid-cols-[minmax(150px,1.3fr)_minmax(200px,2.2fr)_90px_110px_minmax(140px,1.2fr)_110px] lg:items-center"
            >
              <div className="col-span-2 min-w-0 lg:col-span-1">
                <p className="truncate font-medium text-ink">{g.name}</p>
                <p className="truncate text-xs text-ink-3">{platformMix || "No records"}</p>
              </div>

              <div className="col-span-2 lg:col-span-1">
                <SplitBar {...g.split} />
                <p className="mt-1.5 text-xs text-ink-3">{sentimentWord(g.avgSentiment)}</p>
              </div>

              <div className="lg:text-right">
                <p className="text-xs text-ink-3 lg:hidden">Avg score</p>
                <p className="tabular text-lg font-semibold text-ink">{signed(g.avgSentiment)}</p>
                {delta && <Delta value={delta.avgSentiment} digits={1} />}
              </div>

              <div className="lg:text-right">
                <p className="text-xs text-ink-3 lg:hidden">Records</p>
                <p className="tabular text-sm text-ink">{int(g.records)}</p>
                <p className="text-xs text-ink-3">
                  {int(g.volume24h)} in 24h {delta && <Delta value={delta.volume24h} />}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {g.topThemes.map((t) => (
                  <Badge key={t.theme}>{capitalize(t.theme)}</Badge>
                ))}
                {g.riskCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-critical" aria-hidden />
                    {g.riskCount} risk{g.riskCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="lg:text-right">
                <p className="text-xs text-ink-3 lg:hidden">Live viewers</p>
                {live && live.streams > 0 ? (
                  <>
                    <p className="inline-flex items-center gap-1.5 tabular text-sm text-ink">
                      <Radio className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                      {compact(live.viewers)}
                    </p>
                    <p className="text-xs text-ink-3">
                      top {live.streams} Twitch streams {live.isSample && "· sample"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-ink-3">—</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

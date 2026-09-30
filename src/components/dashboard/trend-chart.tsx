"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import type { TimelinePoint } from "@/lib/analysis/pipeline";
import { int, sentimentWord, shortDate, signed } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui/primitives";

const MIN_DAYS = 7;
const AXIS = { fill: "var(--ink-3)", fontSize: 11 };

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TimelinePoint }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-line-strong bg-[#0f0f15] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-ink">{shortDate(p.date)}</p>
      <p className="flex items-center gap-2 text-ink-2">
        <span className="h-2 w-2 rounded-sm bg-mag" aria-hidden />
        {int(p.count)} posts
      </p>
      <p className="flex items-center gap-2 text-ink-2">
        <span className="h-0.5 w-2.5 bg-ink-2" aria-hidden />
        {p.avgSentiment === null ? (p.count > 0 ? "Too few posts for an average" : "No posts") : `${signed(p.avgSentiment)} · ${sentimentWord(p.avgSentiment)}`}
      </p>
    </div>
  );
}

export function TrendChart({ timeline }: { timeline: TimelinePoint[] }) {
  const first = timeline.findIndex((d) => d.count > 0);
  if (first === -1) {
    return (
      <Card title="Activity & sentiment over time" icon={<TrendingUp className="h-4 w-4" aria-hidden />}>
        <EmptyState>No dated records yet.</EmptyState>
      </Card>
    );
  }
  const data = timeline.slice(Math.min(first, timeline.length - MIN_DAYS));
  const values = data.flatMap((d) => (d.avgSentiment === null ? [] : [d.avgSentiment]));
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const zeroAt = max - min === 0 ? 0.5 : max / (max - min);
  const ticks = { tick: AXIS, tickLine: false, axisLine: false } as const;

  return (
    <Card
      title="Activity & sentiment over time"
      icon={<TrendingUp className="h-4 w-4" aria-hidden />}
      subtitle="Grouped by publish date. Recent days are fuller because each refresh pulls the newest posts."
      className="h-full"
    >
      <p className="mb-1 text-xs font-medium text-ink-2">Posts per day</p>
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="trend" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="date" hide />
            <YAxis width={40} allowDecimals={false} {...ticks} tickFormatter={(v: number) => int(v)} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="count" fill="var(--mag)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mb-1 mt-4 text-xs font-medium text-ink-2">Average sentiment (−100 to +100, days with 3+ posts)</p>
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} syncId="trend" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sentiment-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroAt} stopColor="var(--pos)" stopOpacity={0.14} />
                <stop offset={zeroAt} stopColor="var(--neg)" stopOpacity={0.14} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="date" {...ticks} tickFormatter={shortDate} minTickGap={24} />
            <YAxis width={40} domain={[(d: number) => Math.min(-20, Math.floor(d / 10) * 10), (d: number) => Math.max(20, Math.ceil(d / 10) * 10)]} {...ticks} />
            <ReferenceLine y={0} stroke="var(--line-strong)" />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="avgSentiment"
              baseValue={0}
              stroke="var(--ink-2)"
              strokeWidth={2}
              fill="url(#sentiment-fill)"
              connectNulls={false}
              dot={{ r: 4, fill: "var(--ink-2)", stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

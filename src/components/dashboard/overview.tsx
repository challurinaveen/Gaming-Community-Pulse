"use client";

import clsx from "clsx";
import { CircleCheck, Flame, MessageCircleQuestionMark, ShieldAlert, Sparkles, TriangleAlert, Users, Zap } from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard/build";
import { capitalize, compact, int, sentimentWord, shortDate, signed } from "@/lib/format";
import { Badge, Card, Delta, HoverTip } from "@/components/ui/primitives";

export function SplitBar({ positive, neutral, negative, height = "h-2.5" }: { positive: number; neutral: number; negative: number; height?: string }) {
  const total = positive + neutral + negative;
  if (total === 0) return <div className={clsx(height, "w-full rounded bg-white/5")} />;
  const parts = [
    { key: "Negative", n: negative, cls: "bg-neg" },
    { key: "Neutral", n: neutral, cls: "bg-mid" },
    { key: "Positive", n: positive, cls: "bg-pos" },
  ].filter((p) => p.n > 0);
  return (
    <div className={clsx("flex w-full gap-[2px]", height)} role="img" aria-label={`${negative} negative, ${neutral} neutral, ${positive} positive`}>
      {parts.map((p, i) => (
        <HoverTip
          key={p.key}
          style={{ width: `${(p.n / total) * 100}%` }}
          className={clsx("block h-full min-w-[3px] outline-none", p.cls, i === 0 && "rounded-l", i === parts.length - 1 && "rounded-r")}
          content={
            <>
              <span className="font-semibold text-ink">{p.key}</span> · {int(p.n)} records ({Math.round((p.n / total) * 100)}%)
            </>
          }
        />
      ))}
    </div>
  );
}

export function HeroSentiment({ data }: { data: DashboardPayload }) {
  const { overall } = data.summary;
  const pct = (n: number) => (overall.totalRecords ? Math.round((n / overall.totalRecords) * 100) : 0);
  return (
    <Card className="relative overflow-hidden" bodyClassName="flex h-full flex-col">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-2/10 blur-3xl" aria-hidden />
      <p className="text-sm text-ink-2">Overall community sentiment</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-6xl font-semibold leading-none tracking-tight text-ink">{signed(overall.avgSentiment)}</span>
        <span className="pb-1 text-sm text-ink-3">/ 100</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-ink">{sentimentWord(overall.avgSentiment)}</span>
        {data.comparison ? (
          <Delta value={data.comparison.avgSentiment} digits={1} label={`vs ${shortDate(data.comparison.previousDate)}`} />
        ) : (
          <span className="text-xs text-ink-3">No earlier snapshot to compare yet</span>
        )}
      </div>
      <div className="mt-auto pt-6">
        <SplitBar {...overall.split} />
        <div className="mt-2.5 flex justify-between text-xs tabular text-ink-2">
          <span>{pct(overall.split.negative)}% negative</span>
          <span>{pct(overall.split.neutral)}% neutral</span>
          <span>{pct(overall.split.positive)}% positive</span>
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, icon, children }: { label: string; value: string; icon: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-xs text-ink-3">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <div className="mt-1 min-h-5 text-xs text-ink-3">{children}</div>
    </div>
  );
}

export function StatTiles({ data }: { data: DashboardPayload }) {
  const { overall } = data.summary;
  const c = data.comparison;
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatTile label="Records analysed" value={compact(overall.totalRecords)} icon={<Users className="h-3.5 w-3.5" aria-hidden />}>
        {int(overall.volume24h)} in the last 24h {c && <Delta value={c.volume24h} />}
      </StatTile>
      <StatTile label="Avg engagement index" value={overall.avgEngagement.toFixed(0)} icon={<Zap className="h-3.5 w-3.5" aria-hidden />}>
        0–100, normalised per platform
      </StatTile>
      <StatTile label="Potential risks" value={int(data.summary.risks.riskCount)} icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden />}>
        {c ? (
          <Delta value={c.riskCount} goodWhenUp={false} label="vs last snapshot" />
        ) : (
          `${data.summary.risks.riskyThemes.length} ${data.summary.risks.riskyThemes.length === 1 ? "theme" : "themes"} trending negative`
        )}
      </StatTile>
      <StatTile label="Player questions" value={int(overall.questionCount)} icon={<MessageCircleQuestionMark className="h-3.5 w-3.5" aria-hidden />}>
        {data.summary.questions.filter((q) => q.count > 1).length} recurring · {int(overall.sarcasmCount)} sarcastic posts
      </StatTile>
    </div>
  );
}

export function BriefingCard({ data }: { data: DashboardPayload }) {
  const { briefing } = data;
  return (
    <Card
      title="Daily briefing"
      icon={<Sparkles className="h-4 w-4" aria-hidden />}
      subtitle={briefing.engine === "ai" ? `Written by ${briefing.model} from today's figures` : "Automatic summary (AI briefing not configured)"}
      action={briefing.engine === "ai" ? <Badge tone="accent">AI</Badge> : <Badge>Template</Badge>}
      className="h-full"
    >
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">
        {briefing.text.split(/\n{2,}/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </Card>
  );
}

export function AlertsCard({ data }: { data: DashboardPayload }) {
  const todaySpikes = data.spikes.filter((s) => s.date === data.date);
  const risky = data.summary.risks.riskyThemes;
  const errors = data.provenance.filter((p) => p.error);
  const aiIssue = data.engines.aiIssue;
  const nothing = todaySpikes.length === 0 && risky.length === 0 && errors.length === 0 && !aiIssue;

  return (
    <Card title="Needs attention" icon={<Flame className="h-4 w-4" aria-hidden />} subtitle="Volume spikes, negative themes and collection problems" className="h-full">
      {nothing ? (
        <div className="text-sm">
          <p className="flex items-center gap-2 text-ink-2">
            <CircleCheck className="h-4 w-4 shrink-0 text-good" aria-hidden />
            Nothing unusual today.
          </p>
          {data.spikes.length === 0 && <p className="mt-1 pl-6 text-ink-3">Volume-spike detection starts once 3 days of history are stored.</p>}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {aiIssue && (
            <li className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-serious" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-ink">AI scoring paused</p>
                <p className="text-ink-3">{aiIssue} Posts are being scored by the backup word list meanwhile.</p>
              </div>
            </li>
          )}
          {todaySpikes.map((s) => (
            <li key={`spike-${s.game}`} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-ink">Volume spike · {s.name}</p>
                <p className="text-ink-3">
                  {int(s.count)} posts in 24h vs a baseline of {s.baseline.toFixed(0)} ({s.magnitude.toFixed(1)}σ)
                </p>
              </div>
            </li>
          ))}
          {risky.map((t) => (
            <li key={`theme-${t.theme}`} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-ink">Negative theme · {capitalize(t.theme)}</p>
                <p className="text-ink-3">
                  Average sentiment {signed(t.avgSentiment)} across {int(t.count)} posts
                </p>
              </div>
            </li>
          ))}
          {errors.map((p) => (
            <li key={`err-${p.platform}`} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-serious" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-ink">Collection error · {p.platform}</p>
                <p className="break-words text-ink-3">{p.error}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

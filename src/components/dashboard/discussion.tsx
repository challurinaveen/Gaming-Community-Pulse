"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ExternalLink, MessageCircleQuestionMark, MessagesSquare, Quote, ShieldAlert } from "lucide-react";
import type { DashboardPayload, DashboardRecord } from "@/lib/dashboard/build";
import { capitalize, int, PLATFORM_LABEL, safeUrl, timeAgo } from "@/lib/format";
import type { Platform } from "@/lib/platforms";
import { Badge, Card, EmptyState, SentimentChip } from "@/components/ui/primitives";

function SourceLink({ url, label = "Open source" }: { url: string | null | undefined; label?: string }) {
  const href = safeUrl(url);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

export function ClustersPanel({ data }: { data: DashboardPayload }) {
  const [active, setActive] = useState(0);
  const game = data.clusters[active];
  const liveForGame = data.records.filter((r) => !r.isSample && r.game === data.summary.games[active]?.game).length;
  const geminiReady = data.engines.clustering !== "Not configured";

  return (
    <Card
      title="What players are talking about"
      icon={<MessagesSquare className="h-4 w-4" aria-hidden />}
      subtitle="Sub-topics grouped by Gemini. Every quote is an original collected post, never AI-written."
    >
      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Game">
        {data.clusters.map((c, i) => (
          <button
            key={c.game}
            role="tab"
            aria-selected={i === active}
            type="button"
            onClick={() => setActive(i)}
            className={clsx(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm transition",
              i === active ? "bg-accent/15 font-medium text-ink ring-1 ring-accent/40" : "text-ink-3 hover:bg-white/5 hover:text-ink-2"
            )}
          >
            {c.game}
            {c.clusters.length > 0 && <span className="ml-1.5 text-xs text-ink-3">{c.clusters.length}</span>}
          </button>
        ))}
      </div>

      {!game || game.clusters.length === 0 ? (
        <EmptyState>
          {!geminiReady
            ? "Discussion clustering is off. Add GEMINI_API_KEY to group live discussion into sub-topics."
            : game?.failed
              ? "Topic grouping failed on the last refresh (Gemini returned an error; see the server log). Try Refresh again."
              : liveForGame < 3
              ? "Clustering runs on live data only. Connect a platform for this game to see sub-topics."
              : "No clear sub-topics were found in today's discussion."}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {game.clusters.map((c) => (
            <article key={c.label} className="flex flex-col rounded-xl border border-line bg-surface-2 p-4">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-ink">{c.label}</h3>
                  <p className="mt-0.5 text-sm text-ink-3">{c.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <SentimentChip score={c.avgSentiment} />
                  <p className="text-xs text-ink-3">{int(c.recordCount)} posts</p>
                </div>
              </header>
              <ul className="mt-3 space-y-2.5">
                {c.quotes.map((q) => (
                  <li key={q.id} className="border-l-2 border-line-strong pl-3">
                    <p className="line-clamp-3 text-sm text-ink-2">
                      <Quote className="mr-1 inline h-3 w-3 -translate-y-0.5 text-ink-3" aria-hidden />
                      {q.text}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                      <span>{PLATFORM_LABEL[q.platform as Platform] ?? q.platform}</span>
                      <span>· {q.author}</span>
                      <SourceLink url={q.url} />
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

export function QuestionsPanel({ data }: { data: DashboardPayload }) {
  const questions = data.summary.questions;
  return (
    <Card
      title="Player questions"
      icon={<MessageCircleQuestionMark className="h-4 w-4" aria-hidden />}
      subtitle="Similar questions grouped by shared vocabulary; ×N shows how often each was asked"
      className="h-full"
    >
      {questions.length === 0 ? (
        <EmptyState>No player questions detected.</EmptyState>
      ) : (
        <ol className="space-y-2">
          {questions.slice(0, 8).map((q) => (
            <li key={q.questionIds[0]} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <span className="tabular mt-0.5 shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-semibold text-ink-2" title={`Asked ${q.count} times`}>
                ×{q.count}
              </span>
              <p className="line-clamp-2 text-sm text-ink-2">{q.representative}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function RisksPanel({ data }: { data: DashboardPayload }) {
  const byId = useMemo(() => new Map<string, DashboardRecord>(data.records.map((r) => [r.id, r])), [data.records]);
  const nameOf = useMemo(() => new Map(data.summary.games.map((g) => [g.game, g.name])), [data.summary.games]);
  const risks = data.summary.risks.topRiskRecords.map((r) => byId.get(r.id)).filter((r): r is DashboardRecord => Boolean(r));

  return (
    <Card
      title="Potential community risks"
      icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
      subtitle="Posts signalling churn, boycotts, refunds, toxicity or legal threats"
      className="h-full"
    >
      {risks.length === 0 ? (
        <EmptyState>No risk signals flagged.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {risks.slice(0, 6).map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <p className="line-clamp-2 text-sm text-ink-2">{r.content}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                <SentimentChip score={r.sentiment.score} size="xs" />
                <span>{nameOf.get(r.game) ?? r.game}</span>
                <span>{PLATFORM_LABEL[r.platform]}</span>
                <span>{capitalize(r.sentiment.theme)}</span>
                <span>{timeAgo(r.publishedAt)}</span>
                {r.isSample && <Badge tone="sample">Sample</Badge>}
                <SourceLink url={r.url} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export { SourceLink };

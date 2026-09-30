"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Database, Search } from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard/build";
import { capitalize, int, PLATFORM_LABEL, polarity, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, SentimentChip } from "@/components/ui/primitives";
import { SourceLink } from "./discussion";

const PAGE_SIZE = 20;
type Sort = "newest" | "engagement" | "most-negative" | "most-positive";
type Flag = "risk" | "question" | "sarcasm";

const selectCls =
  "rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30";

export function RecordsExplorer({ data }: { data: DashboardPayload }) {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [tone, setTone] = useState("all");
  const [flags, setFlags] = useState<Set<Flag>>(new Set());
  const [includeSample, setIncludeSample] = useState(true);
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(0);

  const nameOf = useMemo(() => new Map(data.summary.games.map((g) => [g.game, g.name])), [data.summary.games]);
  const hasSample = data.summary.overall.sampleRecords > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.records.filter(
      (r) =>
        (includeSample || !r.isSample) &&
        (game === "all" || r.game === game) &&
        (platform === "all" || r.platform === platform) &&
        (tone === "all" || polarity(r.sentiment.score) === tone) &&
        (!flags.has("risk") || r.sentiment.isRisk) &&
        (!flags.has("question") || r.sentiment.isQuestion) &&
        (!flags.has("sarcasm") || r.sentiment.sarcasm) &&
        (!q || r.content.toLowerCase().includes(q) || r.author.toLowerCase().includes(q))
    );
    const cmp: Record<Sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
      engagement: (a, b) => b.engagement.index - a.engagement.index,
      "most-negative": (a, b) => a.sentiment.score - b.sentiment.score,
      "most-positive": (a, b) => b.sentiment.score - a.sentiment.score,
    };
    return rows.sort(cmp[sort]);
  }, [data.records, query, game, platform, tone, flags, includeSample, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const toggleFlag = (f: Flag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
    setPage(0);
  };

  return (
    <Card
      title="All records"
      icon={<Database className="h-4 w-4" aria-hidden />}
      subtitle={`${int(filtered.length)} of ${int(data.records.length)} records · the table view behind every chart`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search text or author</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search posts or authors"
            className={clsx(selectCls, "w-full pl-8 placeholder:text-ink-3")}
          />
        </label>
        <select aria-label="Game" value={game} onChange={(e) => resetPage(setGame)(e.target.value)} className={selectCls}>
          <option value="all">All games</option>
          {data.summary.games.map((g) => (
            <option key={g.game} value={g.game}>
              {g.name}
            </option>
          ))}
        </select>
        <select aria-label="Platform" value={platform} onChange={(e) => resetPage(setPlatform)(e.target.value)} className={selectCls}>
          <option value="all">All platforms</option>
          {data.platforms.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
        <select aria-label="Sentiment" value={tone} onChange={(e) => resetPage(setTone)(e.target.value)} className={selectCls}>
          <option value="all">Any sentiment</option>
          <option value="pos">Positive</option>
          <option value="mid">Neutral</option>
          <option value="neg">Negative</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => resetPage(setSort)(e.target.value as Sort)} className={selectCls}>
          <option value="newest">Newest first</option>
          <option value="engagement">Most engagement</option>
          <option value="most-negative">Most negative</option>
          <option value="most-positive">Most positive</option>
        </select>
        <div className="flex flex-wrap gap-1.5">
          {(["risk", "question", "sarcasm"] as Flag[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={flags.has(f)}
              onClick={() => toggleFlag(f)}
              className={clsx(
                "rounded-lg border px-2.5 py-1.5 text-sm transition",
                flags.has(f) ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-ink-3 hover:text-ink-2"
              )}
            >
              {f === "risk" ? "Risks" : f === "question" ? "Questions" : "Sarcasm"}
            </button>
          ))}
          {hasSample && (
            <button
              type="button"
              aria-pressed={!includeSample}
              onClick={() => resetPage(setIncludeSample)(!includeSample)}
              className={clsx(
                "rounded-lg border px-2.5 py-1.5 text-sm transition",
                !includeSample ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-ink-3 hover:text-ink-2"
              )}
            >
              Live only
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState>No records match these filters.</EmptyState>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-3">
              <tr>
                <th scope="col" className="py-2 pr-4 font-normal">Post</th>
                <th scope="col" className="py-2 pr-4 font-normal">Game</th>
                <th scope="col" className="py-2 pr-4 font-normal">Sentiment</th>
                <th scope="col" className="py-2 pr-4 font-normal">Theme</th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">Engagement</th>
                <th scope="col" className="py-2 pr-4 font-normal">Region</th>
                <th scope="col" className="py-2 font-normal">Engine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="max-w-[420px] py-3 pr-4">
                    <p className="line-clamp-2 text-ink-2">{r.content}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                      <span className="font-medium text-ink-2">{PLATFORM_LABEL[r.platform]}</span>
                      <span>{r.author}</span>
                      <span>{timeAgo(r.publishedAt)}</span>
                      {r.isSample && <Badge tone="sample">Sample</Badge>}
                      {r.sentiment.isRisk && <Badge>Risk</Badge>}
                      {r.sentiment.isQuestion && <Badge>Question</Badge>}
                      {r.sentiment.sarcasm && <Badge>Sarcasm</Badge>}
                      <SourceLink url={r.url} label="Source" />
                    </p>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-2">{nameOf.get(r.game) ?? r.game}</td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <SentimentChip score={r.sentiment.score} />
                    <p className="tabular text-xs text-ink-3">{Math.round(r.sentiment.confidence * 100)}% conf.</p>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-2">{capitalize(r.sentiment.theme)}</td>
                  <td className="tabular whitespace-nowrap py-3 pr-4 text-right text-ink-2">{r.engagement.index.toFixed(0)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-2">
                    {r.region.region}
                    {r.region.confidence > 0 && <p className="tabular text-xs text-ink-3">{Math.round(r.region.confidence * 100)}%</p>}
                  </td>
                  <td className="whitespace-nowrap py-3 text-xs text-ink-3">{r.sentiment.engine === "semantic" ? "AI model" : "Lexicon"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm text-ink-3" aria-label="Pagination">
          <span className="tabular">
            Page {current + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 hover:text-ink disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 hover:text-ink disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </nav>
      )}
    </Card>
  );
}

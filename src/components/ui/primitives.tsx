"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { polarity, sentimentWord, signed } from "@/lib/format";

export function Card({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("min-w-0 rounded-2xl border border-line bg-surface", className)}>
      {title && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              {icon && <span className="text-ink-3">{icon}</span>}
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={clsx("px-5 pb-5", title ? "pt-4" : "pt-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const POLARITY_BG = { pos: "bg-pos", neg: "bg-neg", mid: "bg-mid" } as const;

/** Score text in ink with a coloured dot carrying polarity (text never wears the data colour). */
export function SentimentChip({ score, size = "sm" }: { score: number; size?: "sm" | "xs" }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1.5 tabular text-ink", size === "sm" ? "text-sm" : "text-xs")}
      title={`${sentimentWord(score)} (${signed(score)})`}
    >
      <span className={clsx("h-2 w-2 shrink-0 rounded-full", POLARITY_BG[polarity(score)])} aria-hidden />
      {signed(score)}
    </span>
  );
}

/** -100..+100 on a centred track; the fill grows from the midpoint with a rounded data end. */
export function DivergingBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.abs(value)) / 2;
  return (
    <div className={clsx("relative h-1.5 w-full rounded-full bg-white/5", className)} aria-hidden>
      <div className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
      <div
        className={clsx("absolute inset-y-0", value >= 0 ? "left-1/2 rounded-r bg-pos" : "right-1/2 rounded-l bg-neg")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** 0..100 magnitude; the unfilled track is a lighter step of the same hue. */
export function Meter({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={clsx("h-1.5 w-full rounded-full bg-mag/15", className)} aria-hidden>
      <div className="h-full rounded-full bg-mag" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Signed change vs a named period; colour = direction × whether up is good. */
export function Delta({
  value,
  goodWhenUp = true,
  digits = 0,
  suffix = "",
  label,
}: {
  value: number;
  goodWhenUp?: boolean;
  digits?: number;
  suffix?: string;
  label?: string;
}) {
  const flat = Number(Math.abs(value).toFixed(digits)) === 0;
  const good = flat ? null : value > 0 === goodWhenUp;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular",
        good === null ? "text-ink-3" : good ? "text-good" : "text-neg"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {signed(value, digits)}
      {suffix}
      {label && <span className="ml-1 font-normal text-ink-3">{label}</span>}
    </span>
  );
}

/** Hover/focus tooltip for HTML marks. The trigger is the hit target. */
export function HoverTip({
  content,
  children,
  className,
  style,
}: {
  content: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      style={style}
      className={clsx("relative", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg border border-line-strong bg-[#0f0f15] px-3 py-2 text-xs text-ink-2 shadow-xl"
        >
          {content}
        </span>
      )}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "sample" | "accent" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "neutral" && "bg-white/5 text-ink-2",
        tone === "sample" && "border border-dashed border-warning/40 text-warning",
        tone === "accent" && "bg-accent/10 text-accent"
      )}
    >
      {children}
    </span>
  );
}

export function LegendKey({ items }: { items: { label: string; className: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={clsx("h-2.5 w-2.5 rounded-sm", i.className)} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}

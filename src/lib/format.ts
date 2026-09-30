import type { Platform } from "@/lib/platforms";

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  reddit: "Reddit",
  discord: "Discord",
  twitch: "Twitch",
};

const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("en");

export const compact = (n: number) => compactFmt.format(n);
export const int = (n: number) => intFmt.format(Math.round(n));

/** Signed number with a true minus sign; zero reads as ±0. */
export function signed(n: number, digits = 0): string {
  const abs = Math.abs(n).toFixed(digits);
  if (Number(abs) === 0) return `±${abs}`;
  return `${n > 0 ? "+" : "−"}${abs}`;
}

/** Bands use the whole-number score the UI displays, so "+20" and its label always agree. */
export function sentimentWord(raw: number): string {
  const score = Math.round(raw);
  if (score >= 40) return "Very positive";
  if (score > 20) return "Positive";
  if (score >= -20) return "Neutral";
  if (score > -40) return "Negative";
  return "Very negative";
}

export type Polarity = "pos" | "neg" | "mid";
export function polarity(raw: number): Polarity {
  const score = Math.round(raw);
  return score > 20 ? "pos" : score < -20 ? "neg" : "mid";
}

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Only render links we can trust to be plain web URLs. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export type Platform = "youtube" | "reddit" | "discord" | "twitch";

export const PLATFORMS: Platform[] = ["youtube", "reddit", "discord", "twitch"];

/**
 * Server-only: platforms not listed in DISABLED_PLATFORMS (comma-separated, e.g. "reddit").
 * A disabled platform is never collected, never sample-filled, and hidden from the dashboard.
 */
export function enabledPlatforms(): Platform[] {
  const disabled = new Set(
    (process.env.DISABLED_PLATFORMS ?? "")
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
  );
  return PLATFORMS.filter((p) => !disabled.has(p));
}

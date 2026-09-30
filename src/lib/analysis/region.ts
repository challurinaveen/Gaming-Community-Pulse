// ---------------------------------------------------------------------------
// Region classification – 5-signal priority chain
// ---------------------------------------------------------------------------

export type Region =
  | "North America"
  | "Europe"
  | "Asia"
  | "China"
  | "LATAM"
  | "Oceania"
  | "Middle East"
  | "Undetermined";

export interface RegionResult {
  region: Region;
  confidence: number; // 0-1
}

// Map ISO 3166-1 alpha-2 country codes to regions
const COUNTRY_TO_REGION: Record<string, Region> = {
  // North America
  US: "North America",
  CA: "North America",
  MX: "North America",

  // Europe
  GB: "Europe",
  UK: "Europe",
  DE: "Europe",
  FR: "Europe",
  ES: "Europe",
  IT: "Europe",
  NL: "Europe",
  SE: "Europe",
  NO: "Europe",
  DK: "Europe",
  FI: "Europe",
  PL: "Europe",
  PT: "Europe",
  RO: "Europe",
  CZ: "Europe",
  AT: "Europe",
  CH: "Europe",
  BE: "Europe",
  IE: "Europe",
  HU: "Europe",
  GR: "Europe",
  UA: "Europe",
  RU: "Europe",
  HR: "Europe",
  BG: "Europe",
  SK: "Europe",
  LT: "Europe",
  LV: "Europe",
  EE: "Europe",
  SI: "Europe",
  RS: "Europe",

  // Asia
  JP: "Asia",
  KR: "Asia",
  IN: "Asia",
  ID: "Asia",
  TH: "Asia",
  VN: "Asia",
  PH: "Asia",
  MY: "Asia",
  SG: "Asia",
  TW: "Asia",
  HK: "Asia",

  // China
  CN: "China",

  // LATAM
  BR: "LATAM",
  AR: "LATAM",
  CL: "LATAM",
  CO: "LATAM",
  PE: "LATAM",
  VE: "LATAM",
  EC: "LATAM",
  UY: "LATAM",
  PY: "LATAM",
  BO: "LATAM",

  // Oceania
  AU: "Oceania",
  NZ: "Oceania",

  // Middle East
  SA: "Middle East",
  AE: "Middle East",
  IL: "Middle East",
  TR: "Middle East",
  EG: "Middle East",
  QA: "Middle East",
  KW: "Middle East",
  BH: "Middle East",
  OM: "Middle East",
  JO: "Middle East",
  LB: "Middle East",
  IQ: "Middle East",
  IR: "Middle East",
};

// Map language codes to regions (for content/detected language signals)
const LANGUAGE_TO_REGION: Record<string, Region> = {
  en: "North America", // Default for English; ambiguous (NA/EU/Oceania)
  ja: "Asia",
  ko: "Asia",
  zh: "China",
  "zh-cn": "China",
  "zh-tw": "Asia",
  pt: "LATAM",
  "pt-br": "LATAM",
  "pt-pt": "Europe",
  es: "LATAM",
  "es-es": "Europe",
  fr: "Europe",
  de: "Europe",
  it: "Europe",
  nl: "Europe",
  sv: "Europe",
  no: "Europe",
  da: "Europe",
  fi: "Europe",
  pl: "Europe",
  ru: "Europe",
  uk: "Europe",
  cs: "Europe",
  ro: "Europe",
  hu: "Europe",
  el: "Europe",
  tr: "Middle East",
  ar: "Middle East",
  he: "Middle East",
  fa: "Middle East",
  hi: "Asia",
  th: "Asia",
  vi: "Asia",
  id: "Asia",
  ms: "Asia",
  tl: "Asia",
};

// Map Discord locale codes (e.g., "en-US", "ja") to regions
function discordLocaleToRegion(locale: string): Region | null {
  // Discord locales are like "en-US", "ja", "ko", "zh-CN", "pt-BR"
  const lower = locale.toLowerCase();

  // Try exact match first
  if (LANGUAGE_TO_REGION[lower]) return LANGUAGE_TO_REGION[lower];

  // Try the part after the dash as a country code
  const parts = lower.split("-");
  if (parts.length === 2) {
    const country = parts[1].toUpperCase();
    if (COUNTRY_TO_REGION[country]) return COUNTRY_TO_REGION[country];
  }

  // Try just the language part
  if (parts[0] && LANGUAGE_TO_REGION[parts[0]]) {
    return LANGUAGE_TO_REGION[parts[0]];
  }

  return null;
}

/**
 * Classify region using a 5-signal priority chain.
 *
 * Signals (highest priority first):
 *   1. Channel declared country (YouTube channelCountry) – confidence 0.95
 *   2. Manually configured region – confidence 0.90
 *   3. Discord server locale – confidence 0.80
 *   4. Content declared language – confidence 0.70
 *   5. Detected text language – confidence 0.40
 */
export function classifyRegion(
  platform: string,
  rawData: Record<string, unknown>
): RegionResult {
  // 1. Channel declared country (YouTube)
  const channelCountry = rawData.channelCountry as string | undefined;
  if (channelCountry) {
    const upper = channelCountry.toUpperCase();
    const region = COUNTRY_TO_REGION[upper];
    if (region) return { region, confidence: 0.95 };
  }

  // 2. Manually configured region
  const configuredRegion = rawData.configuredRegion as string | undefined;
  if (configuredRegion) {
    const validated = validateRegion(configuredRegion);
    if (validated !== "Undetermined") {
      return { region: validated, confidence: 0.9 };
    }
  }

  // 3. Discord server locale
  if (platform === "discord") {
    const guildLocale = rawData.guildLocale as string | undefined;
    if (guildLocale) {
      const region = discordLocaleToRegion(guildLocale);
      if (region) return { region, confidence: 0.8 };
    }
  }

  // 4. Content declared language
  const language = rawData.language as string | undefined;
  if (language) {
    const lower = language.toLowerCase();
    const region = LANGUAGE_TO_REGION[lower] ?? LANGUAGE_TO_REGION[lower.split("-")[0]];
    if (region) return { region, confidence: 0.7 };
  }

  // 5. Detected text language
  const detectedLanguage = rawData.detectedLanguage as string | undefined;
  if (detectedLanguage) {
    const lower = detectedLanguage.toLowerCase();
    const region =
      LANGUAGE_TO_REGION[lower] ?? LANGUAGE_TO_REGION[lower.split("-")[0]];
    if (region) return { region, confidence: 0.4 };
  }

  return { region: "Undetermined", confidence: 0 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_REGIONS: Set<string> = new Set([
  "north america",
  "europe",
  "asia",
  "china",
  "latam",
  "oceania",
  "middle east",
]);

function validateRegion(raw: string): Region {
  const lower = raw.toLowerCase().trim();
  if (VALID_REGIONS.has(lower)) {
    // Capitalize properly
    return (
      ({
        "north america": "North America",
        europe: "Europe",
        asia: "Asia",
        china: "China",
        latam: "LATAM",
        oceania: "Oceania",
        "middle east": "Middle East",
      }[lower] as Region) ?? "Undetermined"
    );
  }
  return "Undetermined";
}

# Gaming Community Pulse — Project Status Report

**Audit date:** 2026-09-30 · **Last updated:** 2026-09-30 (§7.A partially done — YouTube + Gemini keys live; §6.2 YouTube half fixed; §6.9 collector scoping fixed)
**Audited against:** `RS_Gaming_Dashboard.pdf` (Final Project Report, 29 pages)
**Repo:** `C:\Users\neuze\Documents\gaming-community-pulse`
**Stack:** Next.js 16.3.6 (Turbopack, App Router) · React 19.2.8 · TypeScript 5 · Tailwind 4 · Supabase · Anthropic SDK · Google GenAI · Recharts

> This file is the single pick-up point. Read **§2 Quick Start Tomorrow** first, then §6 (defects) and §7 (TODO).

---

## 1. Headline numbers

| Measure | Score |
|---|---|
| **Code built vs. what the PDF specifies** | **~92%** |
| **Actually live / reproducible right now** | **~65%** (was ~45% — YouTube + Gemini now credentialed) |
| Build health (`tsc`, `eslint`, `next build`) | **100% clean — 0 errors** |
| Automated test coverage | **0%** (the report itself declares this a limitation, §5.4) |

**Why the gap between 92% and 65%:** the code is written, but only 2 of 4 platforms (Twitch, YouTube) are credentialed; Reddit and Discord are not. Both AI models (Claude, Gemini) are now configured. See §5.

---

## 2. Quick start tomorrow

```bash
cd C:\Users\neuze\Documents\gaming-community-pulse
npm run dev          # http://localhost:3000
npx tsc --noEmit     # typecheck
npx eslint           # lint
npx next build       # production build
```

Verified working as of this audit:

```
npx tsc --noEmit   -> 0 errors
npx eslint         -> 0 errors / 0 warnings
npx next build     -> compiled in 8.6s, 8 routes generated
```

Routes produced by the build:

```
o /                  (static)
o /_not-found
f /api/analysis      (dynamic)
f /api/health        (dynamic)
f /api/methodology   (dynamic)
f /dashboard
o /login
o /register
f Proxy (Middleware) -> src/proxy.ts
```

---

## 3. What is DONE (verified line by line against the PDF)

Every claim in **Chapter 3 (Methodology)** and **Appendix B** was checked against the source.

| PDF section | Claim in report | Where in code | Status |
|---|---|---|---|
| §3.1 | Six-stage pipeline: collect → enrich → aggregate → compare → brief → serve | `src/lib/dashboard/build.ts` (stages commented 1–6) | DONE |
| §3.2 Table 2 | YouTube: 8 uploads/channel, 25 comments/video in 2 orderings | `src/lib/collectors/youtube.ts:4-6` | DONE (exact) |
| §3.2 Table 2 | Reddit: top 50 posts (trailing week) + 100 recent comments | `src/lib/collectors/reddit.ts` (`top?t=week&limit=50`, `comments?limit=100`) | DONE (exact) |
| §3.2 Table 2 | Discord: 100 recent messages/channel with reaction counts | `src/lib/collectors/discord.ts` (`?limit=100`) | DONE (exact) |
| §3.2 Table 2 | Twitch: 20 most-viewed clips (30d) + live-viewer snapshot | `src/lib/collectors/twitch.ts` (`first=20`, 30-day window) | DONE (exact) |
| §3.2 | Official APIs only, never scraping | all 4 collectors | DONE |
| §3.3 | Truncation to bounded length before scoring | `pipeline.ts:20` `MAX_SCORING_CHARS = 1500` | DONE |
| §3.3 | Labelled illustrative samples, excluded from scoring + archive, auto-displaced by live data | `build.ts`, `sample-data/index.ts` | DONE |
| §3.4 | Claude zero-shot primary + deterministic lexicon fallback | `analysis/sentiment.ts`, `ai/llm.ts`, `ai/claude.ts` | DONE |
| §3.4 | Gaming vocabulary in prompt ("insane", "cracked", "dead game", "cash grab", "p2w", copium/hopium) | `sentiment.ts` SENTIMENT_SYSTEM_PROMPT | DONE (verbatim) |
| §3.4 / §2.5 | Worked sarcasm examples (few-shot, per SarcasmBench) | `sentiment.ts` — 3 worked examples incl. "oh great, another battle pass" | DONE (verbatim) |
| §3.4 | Every record returns score −100..+100, confidence, sarcasm, 1 of **17** themes, isQuestion, isRisk | `sentiment.ts` THEMES array = exactly 17 entries | DONE (exact) |
| §3.4 | Every record labelled with which engine produced it | `engine: "semantic" / "lexicon"` | DONE |
| §3.4 | Lexicon handles negation, intensifiers, gaming slang | `analyzeSentimentLexicon()` | DONE |
| §3.5 Table 3 | YouTube: likes + 3×replies, ceiling 5,000 | `analysis/engagement.ts` | DONE (exact) |
| §3.5 Table 3 | Reddit: upvotes + 5×comments, ceiling 20,000 | `engagement.ts` | DONE (exact) |
| §3.5 Table 3 | Discord: reactions + 2×replies, ceiling 40 | `engagement.ts` | DONE (exact) |
| §3.5 Table 3 | Twitch: clip views, ceiling 500,000 | `engagement.ts` | DONE (exact) |
| §3.5 | Logarithmic compression before normalisation | `min(100, ln(1+raw)/ln(1+ceiling)*100)` | DONE (exact) |
| §4.3 | Worked example: Discord 12 reactions + 3 replies = raw 18 | 12 + 2×3 = 18 — arithmetic confirmed | DONE |
| §4.3 | Worked example: YouTube 200 likes + 10 replies = raw 230 | 200 + 3×10 = 230 — arithmetic confirmed | DONE |
| §3.6 Table 4 | 5-signal region precedence @ 0.95 / 0.90 / 0.80 / 0.70 / 0.40 | `analysis/region.ts` — all 5 coded | **PARTIAL — see §6.1** |
| §3.6 | Publisher-side signals only, never commenter location | `region.ts` | DONE |
| §3.7 | Spike detector: trailing mean + 2 std dev (not visual inspection) | `analysis/patterns.ts` `detectSpikes()`, 7-point window | DONE |
| §3.7 | Theme aggregation over the 17-item controlled vocabulary | `aggregateThemes()` | DONE |
| §3.7 | Risks = flagged posts + theme-level negative-sentiment threshold | `detectRisks()` (avg < −30, min 3 posts) | DONE |
| §3.7 | Recurring questions grouped by Jaccard similarity of meaningful vocabulary | `clusterQuestions()` (threshold 0.3, stopword-filtered) | DONE |
| §3.8 | 150–200 word Claude narrative briefing | `ai/briefing.ts` SYSTEM prompt | DONE |
| §3.8 | Briefing must not fabricate comparison when no prior snapshot | prompt: "If previous is null … do not describe any change" | DONE |
| §3.8 | Gemini clusters into community-phrased sub-topics | `ai/clustering.ts` | DONE |
| §3.8 / §2.6 | **Grounding constraint**: model returns indices only, never generated quote text | `clustering.ts` — `valid()` discards out-of-range indices; quotes read back from `pool[i]` | DONE (the report's headline contribution) |
| §3.9 | Three tables in one Supabase project | `supabase/migration.sql` | DONE |
| §3.9.2 Table 7 | `daily_snapshots`: date PK, generated_at, 5× jsonb, risk_count int default 0 | `migration.sql` | DONE (exact) |
| §3.9.2 | `community_records` full archive, raw + enriched | `migration.sql` + `db/records.ts` | DONE |
| §3.9.2 | `app_users`: email + scrypt hash, nothing else sensitive | `migration.sql` | DONE |
| §3.9.3 | Upsert with `date` as conflict target (idempotency) | `db/snapshots.ts` `onConflict: "date"` | DONE |
| §3.9.3 | Records upsert on (platform, source_id) | `db/records.ts` + UNIQUE constraint | DONE |
| §3.9.4 | RLS enabled, no permissive policies, service key only | `migration.sql` — RLS on **all 3** tables | DONE (exceeds report) |
| §3.10 | scrypt password hashing | `auth/password.ts` (N=16384, r=8, p=1, dkLen=64, 32-byte salt) | DONE |
| §3.10 | Timing-safe comparison | `timingSafeEqual` | DONE |
| §3.10 | Pre-computed dummy hash for unknown emails (anti-enumeration) | `DUMMY_HASH` | DONE |
| §3.10 | Signed stateless session cookie (no server-side store) | `auth/token.ts` (jose JWT HS256, 24h TTL) | DONE |
| §3.10 | Every route behind auth incl. the dashboard page | `src/proxy.ts` matcher | DONE |
| §3.10 | Fail closed if account storage unreachable | `actions.ts` returns error, never serves dashboard | DONE |
| §3.10 | Throttling of repeated sign-in attempts | `auth/rate-limit.ts` | **PARTIAL — see §6.4** |
| §5.4 | 90-day snapshot retention by automatic pruning | `build.ts` `RETENTION_DAYS = 90`, `pruneOldSnapshots()` | DONE |
| App. B | `GET /api/analysis` — full payload + row-level records | `src/app/api/analysis/route.ts` | DONE |
| App. B | `GET /api/methodology` — machine-readable methodology | `src/app/api/methodology/route.ts` | DONE |
| App. B | `GET /api/health` — deployment/config status | `src/app/api/health/route.ts` | DONE |
| §4.1 | On-screen provenance banner reporting sample share | `components/dashboard/header.tsx` `ProvenanceBanner` | DONE |
| §4.7 Table 8 | Storage status: mode / durable / retention_days / last_write | `build.ts` `getStorageStatus()` | DONE |
| — | Dashboard UI (8 components, ~1,400 lines) | `src/components/dashboard/*` | DONE |

### File inventory (52 source files)

```
src/app/
  (auth)/login/{page.tsx,login-form.tsx}
  (auth)/register/{page.tsx,register-form.tsx}
  api/{analysis,health,methodology}/route.ts
  dashboard/page.tsx  layout.tsx  page.tsx  globals.css
src/components/dashboard/
  dashboard-app.tsx  header.tsx  overview.tsx  games.tsx
  trend-chart.tsx  breakdowns.tsx  discussion.tsx  records-explorer.tsx
src/components/ui/primitives.tsx
src/lib/
  ai/{llm,claude,openai,briefing,clustering,types}.ts
  analysis/{pipeline,sentiment,engagement,region,patterns}.ts
  auth/{actions,password,session,token,rate-limit}.ts
  collectors/{index,youtube,reddit,discord,twitch,types}.ts
  config/games.ts  db/{supabase,snapshots,records}.ts
  dashboard/build.ts  sample-data/index.ts  platforms.ts  format.ts
src/proxy.ts
supabase/migration.sql
```

Games configured (5, report §5.5 says "five to seven"): Genshin Impact, Valorant, Fortnite, Elden Ring, League of Legends.

---

## 4. Completion breakdown by area

| Area | PDF ref | Complete |
|---|---|---|
| Pipeline architecture | §3.1 | 100% |
| 4 platform collectors | §3.2 | 97% (YouTube fully fixed — §6.2, §6.9; Discord channel IDs still empty — §6.2) |
| Preprocessing + sample fallback | §3.3 | 100% |
| Sentiment engine (Claude + lexicon) | §3.4 | 100% |
| Engagement Index | §3.5 | 100% |
| Region classifier | §3.6 | **60%** (2 of 5 signals unwired — §6.1) |
| Pattern detection | §3.7 | 100% |
| AI briefing + grounded clustering | §3.8 | 100% |
| Storage / schema / idempotency | §3.9 | 100% |
| Auth + session security | §3.10 | 95% (rate limit not durable — §6.4) |
| API endpoints | App. B | 100% |
| Dashboard UI | — | 100% |
| Automated tests | §5.4 | **0%** (declared limitation in the report) |

---

## 5. Current runtime configuration (the reason live % is only ~65)

From `.env.local` (names only, no values recorded here):

| Variable | State | Effect |
|---|---|---|
| `SESSION_SECRET` | SET | Sign-in works |
| `NEXT_PUBLIC_SUPABASE_URL` | SET | Storage live |
| `SUPABASE_SERVICE_ROLE_KEY` | SET | Storage live |
| `ANTHROPIC_API_KEY` | SET | Claude sentiment + briefing live |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | SET | Twitch is the **only** live platform |
| `DISABLED_PLATFORMS` | SET = `reddit` | **Reddit switched off entirely** |
| `GEMINI_API_KEY` | **SET** (key validated, `gemini-3.8-flash` available) | Discussion clustering live — §4.6 now re-verifiable |
| `YOUTUBE_API_KEY` | **SET** (key validated against Data API v3) | YouTube fully live — all 5 channel IDs verified collectable |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | EMPTY | Reddit on sample data (also disabled) |
| `DISCORD_BOT_TOKEN` | EMPTY | Discord on sample data |
| `OPENAI_API_KEY` | EMPTY | Stand-in engine unused (not in the PDF anyway) |

**Consequences right now:**

- 2 of 4 platforms collecting (Twitch, YouTube) → roughly **50% of the displayed dataset is illustrative sample data**
- **§4.6 is now reproducible but has NOT been re-run** — Gemini is configured, so the grounding-constraint claim ("no fabricated quotation observed") can and must be verified against live output
- **§4.4 is now reproducible but has NOT been re-run** — YouTube key and all 5 channel IDs are verified, so the 0.95-confidence country signal can be measured properly. Expect 3× US, 1× JP, and 1 game (League of Legends) with no country signal at all

---

## 6. Defects found (nothing crashes — these are correctness/consistency issues)

### 6.1 `region.ts` — 2 of 5 documented signals are dead code  [HIGH]

Table 4 of the PDF lists 5 signals. Two can never fire:

- **Priority 2, confidence 0.90** ("manually configured region for a known source") reads `rawData.configuredRegion`. **Nothing anywhere sets it** and `GameConfig` in `src/lib/config/games.ts` has no region field.
- **Priority 5, confidence 0.40** ("detected text language", last resort) reads `rawData.detectedLanguage`. **No language-detection code exists in the project.**

Only signals 1 (YouTube country), 3 (Discord locale) and 4 (content language) can actually produce a result.

**Fix:** add `region?: Region` to `GameConfig`, map it to `rawData.configuredRegion` in each collector; either implement a light language detector for signal 5 or delete both rows from Table 4 in the report.

### 6.2 Discord can never collect, even with a valid token  [HIGH]

All 5 games in `src/lib/config/games.ts` have `discord: { channelIds: [] }`. `collectDiscord()` returns `[]` immediately when the array is empty, so Discord stays on sample data permanently regardless of `DISCORD_BOT_TOKEN`.

**YouTube half: RESOLVED 2026-09-30.** The "placeholder" IDs were mostly real — 4 of 5 already pointed at the correct official channels. Only Elden Ring was broken (`UCjHgX5GFv8JhctQ6qjsiaBg` did not resolve); it is now `UCCkxMbfZ80VFwwiRlIG5P5g` (FromSoftware, Inc., country=JP). All 5 channels verified to return a full 8 uploads via `channels` + `playlistItems`. Stale `// Replace with real...` comments removed.

Note for §4.4: LoL Esports exposes no `country` field, so the 0.95 region signal cannot fire for League of Legends — it falls through to the language signals. Genshin/Valorant/Fortnite resolve US, Elden Ring resolves JP.

**Fix (Discord only, now):** populate `discord.guildId` + `discord.channelIds` (the channels the RS bot was invited to).

### 6.3 Env var names in the PDF do not match the code  [HIGH — blocks deployment]

- Report §4.7 and Appendix A say `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
- Code uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

Anyone following Appendix A verbatim gets a non-working deploy. Also note the `NEXT_PUBLIC_` prefix exposes the project URL to the browser, which sits awkwardly with §3.9.4's "server-only" framing (the *key* is still server-only, so this is a wording problem, not a leak).

### 6.4 Rate limiter is per-instance in-memory  [MEDIUM]

`src/lib/auth/rate-limit.ts` stores counters in a module-level `Map`. On Vercel serverless each lambda has its own map, so throttling is bypassable by spreading requests. §3.10 presents it as a working security control with no such caveat — and §2.10 / §3.9.1 of the same report argue at length that serverless state must be externalised, so this is internally inconsistent.

Secondary: `checkRateLimit` is called *before* password verification, so it counts **successful** logins too. The report says "repeated **failed** sign-in attempts are throttled". A user signing in 6 times in 15 minutes from one IP gets locked out.

**Fix:** move the counter into Supabase, or disclose the limitation in §3.10 / §5.4.

### 6.5 Appendix A: "No credential is mandatory for the system to run" is false  [MEDIUM]

`SESSION_SECRET` (32+ chars) is mandatory — without it `isSessionConfigured()` returns false, no session can be issued, and §3.10 puts *every* route behind auth, so the app is completely unusable. Supabase is likewise mandatory for accounts. Appendix A does not list `SESSION_SECRET` at all.

### 6.6 The OpenAI stand-in engine is undocumented  [MEDIUM]

`src/lib/ai/openai.ts` + `src/lib/ai/llm.ts` fall back to OpenAI (`gpt-5.4-mini`) when `ANTHROPIC_API_KEY` is absent. The report describes Claude as the only semantic engine, and Appendix A has no `OPENAI_API_KEY`. `/api/methodology` *does* disclose it, so the API and the report contradict each other.

**Fix:** either document it in §3.4 + Appendix A, or delete `openai.ts` and drop the `openai` dependency from `package.json`.

### 6.7 Undocumented env vars  [LOW]

Missing from Appendix A: `SESSION_SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GEMINI_MODEL`, `ALLOWED_EMAIL_DOMAINS`, `DISABLED_PLATFORMS`, `REDDIT_USERNAME`.

### 6.8 `DISABLED_PLATFORMS` feature absent from the report  [LOW]

A real, working feature (`src/lib/platforms.ts`) that removes a platform from collection, sample-fill and the UI. Not mentioned anywhere in the PDF — and it is currently switched on for `reddit`, which materially changes what the dashboard shows.

---

### 6.9 YouTube collection was channel-scoped, not game-scoped  [HIGH — RESOLVED 2026-09-30]

`collectYouTube()` read the **8 most recent uploads** of each configured channel and never
checked whether those videos concerned the game. Channels publish about more than one title,
so the comments collected were whatever that channel happened to post last week, filed under
the configured game regardless of subject. This affected all 5 games, not just Elden Ring,
and is not described anywhere in the PDF — §3.2 Table 2 reads as though the 8 uploads are
game-specific.

A second, compounding problem surfaced while measuring it: **comment yield was never checked
when the channels were chosen.** Two games were pointed at esports channels whose match VODs
draw almost no comments, and the obvious publisher-side pick for Elden Ring turns out to have
comments disabled entirely.

Measured comment threads across 8 videos (single `relevance` ordering) before the fix:

| Game | Channel | Threads | Problem |
|---|---|---|---|
| Genshin Impact | Genshin Impact (official) | 200 | fine |
| Fortnite | Fortnite (official) | 175 | fine |
| Valorant | VALORANT Champions Tour | **15** | esports VODs draw no comments |
| League of Legends | LoL Esports | **97** | esports VODs; also no `country` field |
| Elden Ring | *(various candidates)* | **0** | dead ID, then a Topic channel, then an off-topic creator |

Elden Ring has **no viable official channel**: FromSoftware, Inc.
(`UCCkxMbfZ80VFwwiRlIG5P5g`) is publisher-side and country=JP as §3.6 wants, but has
**comments disabled on every video** — 0 threads. §3.6's "publisher-side signals only"
framing is therefore not achievable for YouTube collection in general.

**Fix applied:**

1. `src/lib/collectors/youtube.ts` — scan window widened to `UPLOAD_SCAN_WINDOW = 50`, then
   filtered by title against the game's aliases, then truncated to `UPLOADS_PER_CHANNEL = 8`.
   `playlistItems` costs 1 quota unit for 8 or 50 results, so the wider scan is free, and
   `UPLOADS_PER_CHANNEL` keeps its documented meaning of "8 uploads scored per channel", so
   §3.2 Table 2 stays accurate. Falls back to most-recent-8 with a `console.warn` if nothing
   in the window matches.
2. `src/lib/config/games.ts` — added `aliases?: string[]` to `GameConfig` plus a
   `gameAliases()` helper, populated for all 5 games.
3. Three channels replaced:

| Game | Was | Now | Threads |
|---|---|---|---|
| Valorant | `UCA1d3HFGFUmkKr2JIUA5Vlw` VCT | `UC8CX0LD98EDXl4UYX1MDCXg` VALORANT official, US, 2.96M | 15 → 187 |
| League of Legends | `UCvqRdlKsE5Q8mf8YXbdIJLw` LoL Esports | `UC2t5bjwHdUX4vM2g8TRDq5g` LoL official, US, 15.9M | 97 → 188 |
| Elden Ring | `UCjHgX5GFv8JhctQ6qjsiaBg` (dead) | `UCe0DNp0mKMqrYVaTundyr9w` VaatiVidya, AU, 3.34M | 0 → 200 |

Both esports swaps stay on official Riot channels — only the *wrong* official channel was
configured. The LoL swap also restores a `country` field, so the 0.95 region signal now fires
for League of Legends, which it previously could not.

Full-run verification (both `relevance` + `time` orderings, i.e. what the collector actually does):

```
game                cc   scan match used threads  verdict
Genshin Impact      US     50    43    8     400  OK
Valorant            US     50    13    8     374  OK
Fortnite            US     50    20    8     400  OK
Elden Ring          AU     50    48    8     400  OK
League of Legends   US     50    18    8     377  OK

Total YouTube comment records per run (pre-dedup): 1951
```

No game falls back, no game starves. Region signals now resolve US ×4 and AU ×1.

**Report impact:** §3.2 should state that YouTube uploads are title-filtered against the game
rather than simply "most recent", and §3.6 should drop or soften "publisher-side signals only"
for YouTube, since the only viable Elden Ring source is a creator channel.

---

## 7. TODO — remaining work, in priority order

### A. Configuration (biggest live-percentage win, ~1 hour)

- [x] Set `GEMINI_API_KEY` — DONE, key validated; `gemini-3.8-flash` confirmed available on this account
- [x] Set `YOUTUBE_API_KEY` — DONE, validated with a live `channels.list` call (HTTP 200)
- [ ] Set `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`
- [ ] Set `DISCORD_BOT_TOKEN`
- [ ] Clear `DISABLED_PLATFORMS` (currently `reddit`) once Reddit credentials are in
- [ ] Re-check `/api/health` afterwards — every platform should report `true`

### B. Code fixes

- [ ] Fill real `discord.guildId` + `discord.channelIds` for all 5 games (`src/lib/config/games.ts`) — §6.2
- [x] Replace placeholder YouTube channel IDs with real ones — DONE 2026-09-30. Elden Ring → VaatiVidya (AU); Valorant and LoL moved off their low-yield esports channels onto the official game channels. All 5 verified collectable. §6.9
- [x] Title-filter YouTube uploads against the game instead of taking the most recent 8 — DONE 2026-09-30, `UPLOAD_SCAN_WINDOW = 50` + `gameAliases()`. §6.9
- [ ] Re-run `/api/analysis` and confirm ~1,951 YouTube records land in `community_records` — §6.9 was verified against the API directly, not yet through the pipeline
- [ ] Add `region?: Region` to `GameConfig`; feed it to `rawData.configuredRegion` in the collectors — §6.1
- [ ] Implement or remove the detected-text-language signal — §6.1
- [ ] Move rate-limit counters to Supabase (or document the serverless caveat) — §6.4
- [ ] Only count *failed* attempts toward the login rate limit — §6.4
- [ ] Decide on OpenAI: document it, or delete `openai.ts` + the `openai` dependency — §6.6

### C. Report (PDF) corrections

- [ ] Appendix A: fix `SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY` — §6.3
- [ ] Appendix A: add `SESSION_SECRET` and delete "No credential is mandatory for the system to run" — §6.5
- [ ] Appendix A: add the other missing env vars — §6.7
- [ ] §3.4 / Appendix A: document the OpenAI stand-in (or remove the code) — §6.6
- [ ] Table 4: drop or footnote the two signals that are not wired — §6.1
- [ ] §3.10 / §5.4: disclose that rate limiting is per-instance on serverless — §6.4
- [ ] §3.3 / §3.2: mention the `DISABLED_PLATFORMS` switch — §6.8
- [ ] §3.2: state that YouTube uploads are title-filtered against the game, not simply "8 most recent" — §6.9
- [ ] §3.6: drop or soften "publisher-side signals only" for YouTube — the only viable Elden Ring source is a creator channel, because FromSoftware disables comments — §6.9
- [ ] §4.4 and §4.6: re-run and re-verify once YouTube and Gemini are configured, since both results are currently unreproducible

### D. Optional / future (from the report's own §6.2)

- [ ] Build a small annotated gaming-text dataset to benchmark the sentiment engine
- [ ] Re-calibrate Engagement Index ceilings against RS campaign history before client-facing use
- [ ] Extend the grounding constraint from clustering to the briefing narrative
- [ ] Longitudinal model-drift study
- [ ] Add TikTok and Bilibili collectors (RS Chinese-market relevance)
- [ ] Add a CI test suite (§5.4 names its absence as a limitation)

---

## 8. Overall verdict

The implementation matches the document far more closely than a typical spec-vs-build pair: formulas, weights, ceilings, confidence values, batch sizes, retention windows and table values are **identical**, and the report's headline contribution — the grounding constraint that stops the model fabricating quotations — is genuinely, correctly implemented in `src/lib/ai/clustering.ts`.

The gap is narrow and specific:

1. two region signals wired into nothing,
2. empty Discord channel config,
3. an Appendix A that will not deploy as written,
4. three platforms and Gemini not credentialed.

Fix §7.A and §7.B and the project moves from ~65% live to ~95% live without any architectural change.

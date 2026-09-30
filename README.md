# Gaming Community Pulse

An internal dashboard that shows what players are saying about a handful of games across YouTube, Twitch, Reddit and Discord. It was built for Ruisheng Holdings (RS), a gaming marketing agency in London, so the team can see community sentiment, recurring complaints and player questions in one place instead of reading each platform by hand.

Every source is read through its official API. Nothing is scraped, and the app never posts, comments, votes or messages anywhere.

## What it does

Each time the dashboard is refreshed (the result is cached for 10 minutes, and in production it is meant to run once a day) it:

1. **Collects** recent public posts for each configured game.
2. **Scores** each post: sentiment from −100 to +100, a topic such as "bugs" or "monetisation", and whether it's a question or a sign of trouble (people quitting, asking for refunds and so on). An AI model does the scoring; if none is configured, a built-in word list is used instead.
3. **Summarises** the day: per-game sentiment, themes, repeated questions, volume spikes against previous days, and a short written briefing.
4. **Groups discussion** into sub-topics with Gemini. The model only picks post numbers from a list it is shown; every quote on screen is the original post text, never something the model wrote.

Platforms without credentials are filled with clearly labelled sample posts, so the dashboard still works during setup. Sample posts are never sent to an AI model and never stored.

## Data collected

| Platform | What is read | Per game, per refresh |
|---|---|---|
| YouTube | Top-level comments on a channel's latest uploads | 8 videos; up to 25 most relevant + 25 newest comments each |
| Twitch | Top clips of the last 30 days, plus live viewer counts | 20 clips, top 20 live streams |
| Reddit | Top posts of the week and the newest comments in a subreddit | 50 posts + 100 comments |
| Discord | Recent messages in channels the bot was invited to | 100 messages per channel |

For each post the app stores only the text, the public username, a link back to the original, and its own scores. It does not read private messages, user profiles or anything behind a login. Region is estimated from where the *channel or server* is registered, never from the commenter.

## How Reddit is used

- Read-only, using app-only OAuth (client credentials). No user logs in through the app.
- About 750 items per run in total across five subreddits: r/VALORANT, r/Genshin_Impact, r/FortNiteBR, r/Eldenring, r/leagueoflegends.
- Requests identify the app and its owner in the User-Agent (`REDDIT_USERNAME`), as Reddit asks.
- **Reddit content is deleted automatically 30 days after it was first collected.** The cleanup runs on every refresh: `deleteExpiredRecords` in [`src/lib/db/records.ts`](src/lib/db/records.ts).
- The collector is [`src/lib/collectors/reddit.ts`](src/lib/collectors/reddit.ts). It only makes `GET` requests.
- Until Reddit API access is approved, Reddit shows clearly-labelled sample data (as for any unconfigured source). It can instead be hidden entirely with `DISABLED_PLATFORMS=reddit`.

## Storage and access

Data lives in a private Supabase (PostgreSQL) database. Row Level Security is enabled on every table with no public policies, so only the server can read or write it. Daily summaries (numbers only, no post text) are kept for 90 days.

The dashboard and its API require an account. Passwords are hashed with scrypt, sessions are signed cookies, repeated failed sign-ins are throttled (counts are shared through the database, so it holds on serverless hosting), and registration can be restricted to company email domains.

## Tech

Next.js 16 (App Router), TypeScript, Tailwind, Recharts, Supabase. AI: Claude (Anthropic) for sentiment scoring and the daily briefing, and Gemini for topic grouping. Without a Claude key, scoring falls back to the built-in word list.

## Running it locally

1. Create a Supabase project and run [`supabase/migration.sql`](supabase/migration.sql), then [`supabase/002_auth_rate_limits.sql`](supabase/002_auth_rate_limits.sql), in its SQL editor.
2. Copy `.env.example` to `.env.local` and fill in what you have (never put real values in `.env.example`, which is published). Only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are required; every platform and AI key is optional.
3. Install and start:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000/register, create an account, and sign in.

Which games and channels are tracked is set in [`src/lib/config/games.ts`](src/lib/config/games.ts).

## API

Every route needs a signed-in session; only the sign-in and registration pages are public.

| Route | Returns |
|---|---|
| `GET /api/analysis` | The full daily analysis, including per-post rows (`POST` forces a fresh run) |
| `GET /api/methodology` | How every figure on the dashboard is calculated |
| `GET /api/health` | Which integrations are configured (true/false only, never values) |

## Project layout

```
src/lib/collectors/   one file per platform (official APIs only)
src/lib/analysis/     sentiment, engagement index, region, patterns
src/lib/ai/           Claude and Gemini calls, daily briefing
src/lib/db/           Supabase reads and writes, retention clean-up
src/lib/dashboard/    runs the whole pipeline and builds the page data
src/components/       dashboard UI
supabase/             database schema
```

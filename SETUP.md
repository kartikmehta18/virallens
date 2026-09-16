# ViralLens — Setup Guide

Everything needed to run ViralLens locally and in production, including where to get each API key.

**The app runs with zero keys.** Without a database it uses an in-memory store; without an Apify token it
generates realistic demo posts; without an AI key it falls back to a built-in analysis. Add keys to turn on
real data, persistence, AI breakdowns and email alerts.

---

## 1. Requirements

| Tool            | Version                    | Notes             |
| --------------- | -------------------------- | ----------------- |
| Node.js         | 20.9+ (22 LTS recommended) | `node -v`         |
| npm             | 10+                        | ships with Node   |
| MySQL / MariaDB | 5.7+ / 10.4+               | optional — see §4 |

---

## 2. Quick start

```bash
git clone <your-repo-url> virallens
cd virallens
npm install            # also runs `prisma generate`
cp .env.example .env   # then edit .env (see §3)
npm run dev            # http://localhost:3000
```

If you configured a database, create the tables once before starting (applies the migrations in `prisma/migrations`):

```bash
npm run db:deploy
```

Verify everything at <http://localhost:3000/api/health> — it reports the storage backend, cache, Apify mode
and test mode.

---

## 3. Environment variables

All variables live in `.env` (copy from `.env.example`). Everything except `TEST_MODE` is optional.

| Variable                                                           | Required             | Purpose                                                                                               |
| ------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------- |
| `TEST_MODE`                                                        | yes                  | `on` = passwordless-style local accounts stored in the browser; `off` = real accounts in the database |
| `AUTH_SECRET`                                                      | when `TEST_MODE=off` | Signs session cookies                                                                                 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`      | no                   | MySQL connection. Omit to run on the in-memory store                                                  |
| `DATABASE_URL`                                                     | no                   | Alternative to the `DB_*` pair: `mysql://user:pass@host:3306/db`                                      |
| `REDIS_URL`                                                        | no                   | Caching + rate limiting. Falls back to in-process memory                                              |
| `APIFY_API_TOKEN`                                                  | no                   | Enables real scraping. Without it, searches generate demo posts                                       |
| `APIFY_ACTOR_X` / `APIFY_ACTOR_LINKEDIN` / `APIFY_ACTOR_INSTAGRAM` | no                   | Override the default actors                                                                           |
| `APIFY_INPUT_X` / `APIFY_INPUT_LINKEDIN` / `APIFY_INPUT_INSTAGRAM` | no                   | Raw JSON actor input with `{{topic}}`, `{{hashtag}}`, `{{limit}}` placeholders                        |
| `APIFY_ACTOR_*_PROFILE` / `APIFY_INPUT_*_PROFILE`                  | no                   | Actors + input used to fetch a saved creator's posts (`{{handle}}`, `{{profileUrl}}`, `{{limit}}`)    |
| `APIFY_MAX_ITEMS`                                                  | no                   | Posts requested per platform per scrape (default `40`)                                                |
| `SCRAPE_CACHE_TTL`                                                 | no                   | Seconds a topic counts as fresh (default `21600` = 6h)                                                |
| `SCRAPE_RATE_LIMIT`                                                | no                   | Scrapes per user/IP per hour (default `20`)                                                           |
| `ANTHROPIC_API_KEY`                                                | no                   | AI "why it went viral" breakdowns via Claude (preferred)                                              |
| `OPENAI_API_KEY`                                                   | no                   | Same feature via OpenAI (tried after Claude)                                                          |
| `GEMINI_API_KEY`                                                   | no                   | Same feature via Google Gemini — free tier (tried after OpenAI)                                       |
| `OPENAI_MODEL`                                                     | no                   | Defaults to `gpt-4o-mini`                                                                             |
| `RESEND_API_KEY`                                                   | no                   | Sends alert emails. Without it alerts are logged to the server console                                |
| `ALERT_FROM_EMAIL`                                                 | no                   | From address for alerts, e.g. `ViralLens <alerts@yourdomain.com>`                                     |
| `APP_URL`                                                          | no                   | Public URL used in alert email links                                                                  |
| `CRON_SECRET`                                                      | in production        | Protects `/api/cron/*`. Required in production, sent as `Authorization: Bearer <secret>`              |
| `DB_CONNECTION_LIMIT`                                              | no                   | MySQL pool size (default `5`)                                                                         |
| `DB_IDLE_TIMEOUT`                                                  | no                   | Seconds before idle pool connections are recycled; keep below MySQL `wait_timeout` (default `10`)    |

### TEST_MODE explained

- **`TEST_MODE=on`** — Sign-up asks for a username, email and password, and the whole account (including a
  generated `local_…` ID and a hashed password) is stored in that browser's `localStorage`. The server trusts
  that ID and mirrors a user row so boards and alerts still persist server-side. Great for demos: anyone can
  create an account instantly, and different browsers are different users. Not secure for real users.
- **`TEST_MODE=off`** — Real accounts: username + email + password stored in the database (scrypt-hashed),
  with an HMAC-signed session cookie. Sign-in accepts username _or_ email. Set `AUTH_SECRET` to a long random
  string:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

> Values are read at runtime — `TEST_MODE=of` (a typo) counts as **off**. Only `on`, `true`, `1` and `yes` are truthy.

---

## 4. Database (optional but recommended)

Without `DB_*`/`DATABASE_URL`, everything runs in memory and resets when the server restarts.

### Option A — Hostinger (or any shared MySQL host)

1. hPanel → **Databases → Management**. Create a database and user; copy the name, user and password.
2. Note the host shown next to the database (e.g. `srv1826.hstgr.io`).
3. hPanel → **Remote MySQL** → add your IP (or `%` to allow any host) so you can connect from outside.
4. Fill in `.env`:

   ```env
   DB_HOST=srv1826.hstgr.io
   DB_PORT=3306
   DB_USER=u123456789_virallens
   DB_PASSWORD=your-password
   DB_NAME=u123456789_virallens
   ```

5. Create the tables:

   ```bash
   npm run db:deploy
   ```

### Option B — local MySQL / Docker

```bash
docker run --name virallens-mysql -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=virallens -p 3306:3306 -d mysql:8
```

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=secret
DB_NAME=virallens
```

### Schema commands

| Command                                 | What it does                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run db:deploy`                     | Applies every migration in `prisma/migrations` (creates all tables and columns) |
| `npm run db:status`                     | Shows which migrations are applied on the database                              |
| `npm run db:migrate -- --name <change>` | Creates a new migration after you edit `schema.prisma` (needs a shadow DB)      |
| `npm run db:push`                       | Syncs tables to the schema without writing a migration (prototyping only)       |
| `npm run db:studio`                     | Opens Prisma Studio to browse data                                              |

### Migrations

The initial migration `prisma/migrations/20260916000000_init/migration.sql` creates every table, index, unique
constraint and foreign key. Run `npm run db:deploy` on each new database (locally, in CI or before a deploy).

**Changing the schema later.** `prisma migrate dev` needs a temporary _shadow database_, and shared hosts such as
Hostinger do not let the DB user create one. Either:

- create a second empty database in hPanel, set `SHADOW_DATABASE_URL=mysql://user:pass@host:3306/that_db` in
  `.env`, then run `npm run db:migrate -- --name add_something`; or
- generate the SQL by diffing the live database (no shadow DB needed), then apply it:

  ```bash
  mkdir prisma/migrations/20260101000000_add_something
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
    -o prisma/migrations/20260101000000_add_something/migration.sql
  npm run db:deploy
  ```

**Database created earlier with `db:push`?** Mark the initial migration as already applied (a baseline) instead
of running it again: `npx prisma migrate resolve --applied 20260916000000_init`.

Tables: `Post`, `User`, `Board`, `SavedPost`, `ScrapeJob`, `WatchedTopic`, `WatchAlert`.

---

## 5. Getting each API key

### Apify — real posts from X, LinkedIn, Instagram

1. Sign up at <https://console.apify.com/sign-up> (free tier includes monthly credits).
2. Go to **Settings → API & Integrations → Personal API tokens** and copy the token
   (`apify_api_…`).
3. Put it in `.env`:

   ```env
   APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxx
   ```

4. Pick the actors you want from the [Apify Store](https://apify.com/store) and paste their IDs
   (`owner/actor-name`). Defaults:

   ```env
   APIFY_ACTOR_X=apidojo/tweet-scraper
   APIFY_ACTOR_LINKEDIN=harvestapi/linkedin-post-search
   APIFY_ACTOR_INSTAGRAM=apify/instagram-hashtag-scraper
   ```

   Actors are paid per run/result — check each actor's pricing page. Start any actor once from the Apify
   console to accept its terms before using it through the API.

5. If an actor expects different input fields, override the JSON without touching code:

   ```env
   APIFY_INPUT_X={"searchTerms":["{{topic}}"],"maxItems":"{{limit}}","sort":"Top"}
   ```

   Placeholders: `{{topic}}`, `{{hashtag}}` (topic without spaces/symbols), `{{limit}}`.

6. **Favorite creators** fetch a creator's own timeline with profile actors (separate from topic search):

   ```env
   APIFY_ACTOR_X_PROFILE=apidojo/tweet-scraper
   APIFY_ACTOR_LINKEDIN_PROFILE=harvestapi/linkedin-profile-posts
   APIFY_ACTOR_INSTAGRAM_PROFILE=apify/instagram-scraper
   ```

   Override their input with `APIFY_INPUT_X_PROFILE` etc., using `{{handle}}`, `{{profileUrl}}` and `{{limit}}`.

> **Without a token** the app still works: every search generates deterministic demo posts, and the header
> shows a "Demo data" badge.

### Anthropic (Claude) — AI breakdowns _(recommended)_

1. Create an account at <https://console.anthropic.com>.
2. **Settings → API keys → Create key**, copy it (`sk-ant-…`), add billing credit.
3. `ANTHROPIC_API_KEY=sk-ant-xxxx`

### OpenAI — AI breakdowns (alternative)

1. <https://platform.openai.com/api-keys> → **Create new secret key** (`sk-…`).
2. `OPENAI_API_KEY=sk-xxxx` (optionally `OPENAI_MODEL=gpt-4o-mini`).

### Google Gemini — AI breakdowns (free tier)

1. Open <https://aistudio.google.com/apikey> and sign in with a Google account.
2. **Create API key** (pick or create a Google Cloud project), copy it (`AIza…`). No billing is needed for the
   free tier.
3. `GEMINI_API_KEY=AIzaxxxx` (optionally `GEMINI_MODEL=gemini-flash-latest`).

**Any one key is enough.** Configured providers are tried in order Claude → OpenAI → Gemini; if one errors
(invalid key, quota exceeded) the next is used. With no working key, breakdowns come from a built-in
rule-based analysis, so the button always works.

### Redis — caching & rate limits (optional)

- **Upstash**: <https://console.upstash.com> → Create database → copy the **TLS/`rediss://`** connection
  string.
- **Local**: `docker run -p 6379:6379 -d redis` → `REDIS_URL=redis://localhost:6379`

```env
REDIS_URL=rediss://default:password@fly-xxx.upstash.io:6379
```

### Resend — alert emails (optional)

1. <https://resend.com> → **API Keys → Create API Key** (`re_…`).
2. Verify a sending domain (**Domains → Add domain**, then add the DNS records).
3. ```env
   RESEND_API_KEY=re_xxxx
   ALERT_FROM_EMAIL=ViralLens <alerts@yourdomain.com>
   APP_URL=https://your-deployment-url
   ```

Without it, alerts are printed to the server log instead of emailed. Alerts for `TEST_MODE` accounts are
always logged, never emailed.

### Cron secret

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

```env
CRON_SECRET=the-generated-value
```

---

## 6. Scripts

| Command             | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Development server (Turbopack) on port 3000     |
| `npm run build`     | Production build (runs `prisma generate` first) |
| `npm start`         | Serve the production build                      |
| `npm run lint`      | ESLint                                          |
| `npm run typecheck` | Route typegen + `tsc --noEmit`                  |
| `npm run format`    | Prettier write                                  |
| `npm run db:deploy` | Apply database migrations                       |
| `npm run db:studio` | Browse data in Prisma Studio                    |

---

## 7. Deploying

### Vercel

1. Push the repo to GitHub and import it at <https://vercel.com/new>.
2. Add every `.env` value under **Project → Settings → Environment Variables**.
3. Deploy. `vercel.json` already registers the alerts cron:

   ```json
   { "crons": [{ "path": "/api/cron/refresh-watches", "schedule": "0 */6 * * *" }] }
   ```

   Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET` is set.

4. Allow Vercel's outbound IPs in **Remote MySQL** if your host restricts by IP.

### Self-hosting / VPS

```bash
npm ci
npm run build
npm start                      # or: pm2 start npm --name virallens -- start
```

Trigger the cron yourself, e.g. every 6 hours:

```bash
0 */6 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/refresh-watches
```

---

## 8. How the pieces fit together

```
Search  →  POST /api/scrape  →  Apify actors (or demo generator)
                             →  normalize to one Post shape
                             →  score  (engagement + time-decayed trending)
                             →  upsert into MySQL (or memory), deduped by post URL
Explore →  GET /api/posts     →  bento grid  →  click  →  /post/[id] modal
Cron    →  /api/cron/refresh-watches → re-scrape watched topics → email alerts
```

Scoring (tweak in `lib/scoring.ts`):

```
engagement = likes×1 + comments×3 + shares×5 + views×0.05
trending   = engagement ÷ (hours_since_posted + 2)^1.5
```

### Main API routes

| Route                                                    | Purpose                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/posts`                                         | Search/filter/sort posts (`topic`, `platform`, `sort`, `dateRange`, `mediaType`, `page`) |
| `GET /api/posts/[id]` · `…/similar` · `POST …/breakdown` | Post detail, similar posts, AI breakdown                                                 |
| `GET /api/posts/timeline` · `/api/posts/export`          | Daily engagement series, CSV export                                                      |
| `POST /api/scrape` · `GET /api/scrape/status/[jobId]`    | Start a scrape, poll progress                                                            |
| `/api/boards…` · `/api/watches…`                         | Boards/saved posts, watched topics                                                       |
| `/api/auth/session` · `login` · `register` · `logout`    | Auth                                                                                     |
| `GET /api/health`                                        | Storage/cache/Apify/AI status                                                            |
| `GET /api/media?url=`                                    | Proxy for hotlink-protected social CDN images                                            |

---

## 9. Troubleshooting

| Symptom                                                    | Fix                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Illegal mix of collations` on search                      | Already handled — the MariaDB adapter runs in text-protocol mode (`lib/db/prisma.ts`)                         |
| `ER_ACCESS_DENIED` / connection timeout                    | Add your IP under **Remote MySQL** on the host; confirm host, user and password                               |
| Health check says `backend: memory` although `DB_*` is set | The connection failed and the app fell back — check the server log for the reason                             |
| Searches return demo posts                                 | No `APIFY_API_TOKEN`, or the actor run failed (the progress banner shows the per-platform error)              |
| Scrape banner shows a platform failure                     | Open the run in the Apify console — usually out of credits, actor terms not accepted, or changed input schema |
| Images don't load                                          | Social CDN links expire; re-run the scrape. Proxied hosts are allow-listed in `app/api/media/route.ts`        |
| `EPERM: operation not permitted … .next` on Windows dev    | Stop other `next dev` processes / antivirus lock, delete `.next`, restart                                     |
| Emails not arriving                                        | Verify the Resend domain, check `ALERT_FROM_EMAIL` uses it; test accounts always log instead of send          |

---

## 10. Project layout

```
app/                 routes: landing (/), /explore, /post/[id] (+ intercepted modal),
                     /boards, /watches, /settings, /login, /api/*
components/          landing/ · explore/ · grid/ · post/ · boards/ · ui/
lib/
  apify/             actor clients, normalizers, demo generator
  repo/              storage abstraction: prisma.ts (MySQL) · memory.ts
  auth/              scrypt hashing, signed cookies, session resolution
  ai/                Claude · OpenAI · Gemini · heuristic breakdowns
  scrape/pipeline.ts scrape jobs, caching, rate limiting
  client/            React Query hooks, preferences, filters
prisma/schema.prisma database schema
```

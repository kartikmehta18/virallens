# ViralLens

Viral content research for X, LinkedIn and Instagram. Search a topic, get the top-performing posts from all
three platforms ranked on one virality score, study why they worked, and save the winners into boards.

![Built with Next.js 16, TypeScript, Tailwind CSS v4, Prisma and Motion](https://img.shields.io/badge/Next.js-16-000)

## Features

- **One ranked feed** — X, LinkedIn and Instagram posts scraped through Apify and normalized into a single
  `Post` shape, scored with a weighted engagement + time-decay formula.
- **Bento explore grid** — masonry-style cards sized by engagement, with infinite scroll, platform/sort/date/
  format filters and a 30-day engagement chart.
- **Instagram-style detail modal** — the clicked thumbnail grows into the detail view via a Framer-Motion
  shared element; deep-linkable at `/post/[id]` (full page on refresh) thanks to intercepting routes.
- **Similar posts rail** — swaps the modal in place without closing it.
- **AI breakdown** — why a post went viral, via Claude, OpenAI or Gemini (free tier), with a built-in heuristic fallback.
- **Boards** — save posts into named collections.
- **Favorite creators** — save any author from a post (or paste a profile URL), open their profile with stats,
  fetch their latest posts, and filter Explore to just your creators from the search box.
- **Multi-sort** — pick several sorts at once (e.g. Most liked + Most commented) to blend their rankings.
- **Alerts** — watch a topic; a cron job re-scrapes it and emails you when a post crosses your threshold.
- **Runs with zero keys** — optional database (falls back to memory), optional Apify (falls back to demo
  data), optional AI and email.

## Quick start

```bash
npm install
cp .env.example .env     # configure what you need
npm run db:deploy        # only if you set DB_* / DATABASE_URL (runs prisma/migrations)
npm run dev              # http://localhost:3000
```

**→ Full instructions and how to obtain every API key: [SETUP.md](./SETUP.md)**

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 + MySQL/MariaDB · TanStack Query ·
Motion · Recharts · Apify · Claude/OpenAI · Resend

## Modes

| Setting               | Effect                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| `TEST_MODE=on`        | Accounts (id, username, email, password) are stored in the browser's localStorage |
| `TEST_MODE=off`       | Real accounts in the database with signed session cookies                         |
| `DB_*` set            | Data persists in MySQL via Prisma                                                 |
| `DB_*` empty          | In-memory store, resets on restart                                                |
| `APIFY_API_TOKEN` set | Live scraping from the three platforms                                            |
| no token              | Deterministic demo posts so the whole app still works                             |

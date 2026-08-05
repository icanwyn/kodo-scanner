# Kōdō Scanner (高動)

High-production stock scanner for discretionary traders: multi-factor confluence, market regime, market data, xAI deep analysis (Grok), trade journal, and post-mortems.

**Design doc:** [`docs/DESIGN.md`](./docs/DESIGN.md)

## Aesthetic

Apple liquid glass + Japanese minimalism (sumi / washi / ma) + future-funk accents (magenta / cyan / violet).

## Confluence score (quick)

**Confluence** = several independent signals agreeing on the same idea. The **score (0–100)** is a weighted blend of ~10 technical/regime factors. Higher = more agreement, **not** a guarantee of profit.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Prisma + **PostgreSQL** (local Docker or Neon / Vercel Postgres in production)
- xAI Grok for deep analysis
- Yahoo Finance (best-effort) for quotes/candles

## Local setup

### 1. Database

```bash
# Option A — Docker
docker compose up -d
# DATABASE_URL=postgresql://kodo:kodo@localhost:5432/kodo

# Option B — Neon free (https://neon.tech) — same URL in .env
```

### 2. App

```bash
cp .env.example .env
# edit .env: DATABASE_URL, XAI_API_KEY
npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Env vars

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `XAI_API_KEY` | For AI thesis | xAI API key from console.x.ai |
| `XAI_MODEL` | No | Default `grok-4.5` |
| `ENABLE_YAHOO` | No | Default true |
| `SCAN_MAX_SYMBOLS` | No | Default 50 |
| `ANALYSIS_DAILY_BUDGET` | No | Default 40 analyses / process day |

## Features

1. **Scanner** — transparent multi-factor confluence  
2. **Regime** — SPY / QQQ / VIX + sector RS  
3. **Market data** — quotes, candles, indices, movers, news  
4. **Deep analysis** — Grok thesis (cached per session to save tokens)  
5. **Journal** — log, close, cancel, R-multiple, post-mortems  
6. **Stats** — win rate, expectancy, profit factor, equity curve  
7. **APEX Compound** — options structure + sizing on every setup (Wheel CORE + defined-risk SAT); desk at `/apex`  

### APEX (options)

- Scan engine attaches `apex` to each `ScoredSetup` from regime, VIX→IVR proxy, confluence, and side bias.  
- Setup cards: **APEX chip** + **APEX size** ticket (1% risk, DD kill switch).  
- Analysis page: full APEX panel; Grok prompt includes primary structure.  
- Journal logs use `setupType: apex_*` and tags `apex`.  
- Account prefs: browser `localStorage` key `kodo_apex_account_v1`.  


## Deploy (Vercel)

1. Connect this GitHub repo to Vercel.  
2. Add env vars: `DATABASE_URL` (Neon/Vercel Postgres **pooled** URL), `XAI_API_KEY`, `XAI_MODEL=grok-4.5`.  
3. Build uses: `prisma generate && prisma migrate deploy && next build`.  
4. Journal/watchlist need Postgres — **file SQLite is not used on Vercel** (ephemeral FS).

```bash
npx vercel --prod
```

## Scripts

```bash
npm run dev
npm run build
npm start
npm test
npx prisma studio
```

## Disclaimer

Not financial advice. Educational and journal use only. Delayed/free-tier market data by default. Respect data vendor terms.

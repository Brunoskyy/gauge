<p align="center">
  <img src="docs/logo.svg" width="76" alt="">
</p>

<h1 align="center">Gauge</h1>

<p align="center">
  Product analytics for a small SaaS, with the math in the database.<br>
  <sub>Next.js 16 · React 19 · TypeScript · Postgres · Prisma 7 · d3-scale, no chart library</sub>
</p>

<br>

A gauge is the instrument you read to know where a number stands, which is
the whole job of a dashboard. Northwind Notes is a made-up note-taking product
with five thousand users and three hundred thousand events over ninety days;
Gauge is what its team would open on a Monday: who was active, what they did,
which cohorts came back, where the funnel leaks.

Every aggregate is one SQL query over an index, every filter is in the URL so
a view can be pasted into a chat, the charts are SVG I drew myself, and the
events table scrolls through a hundred thousand rows without loading them.

![The overview: KPI tiles, events over time, events by country](docs/screenshots/overview.jpg)

## Running it

You need Node 24 (`nvm use` reads the `.nvmrc`). Postgres comes from
`prisma dev`, a local server with no Docker, or any hosted Postgres.

1. Clone and install:

   ```bash
   git clone https://github.com/Brunoskyy/gauge.git && cd gauge
   nvm use
   npm install
   ```

2. Terminal 1, from the repo root, start Postgres and leave it running. It
   prints a few URLs; copy the one that starts with `postgres://`:

   ```bash
   npm run db:dev
   ```

3. Terminal 2, from the repo root:

   ```bash
   cp .env.example .env     # set DATABASE_URL to the URL from step 2
   npm run db:migrate
   npm run db:seed          # about twenty seconds for 300k rows
   npm run dev
   ```

4. Open http://localhost:3000.

Stop with Ctrl+C in both terminals. `npm run db:reset` drops, migrates and
reseeds. The data ends at the start of today (UTC), so two seeds on the same
day give the same numbers; set `SEED_NOW=2026-09-30` to pin it.

| Command (repo root) | |
| --- | --- |
| `npm test` | 41 tests, no database needed |
| `GAUGE_DB_TESTS=1 npm test` | adds 6 tests against the seeded database |
| `npm run typecheck` | `tsc --noEmit` |

## How the queries work

Everything lives in `src/lib/queries/` as tagged-template SQL through
`prisma.$queryRaw`, with values always bound as parameters.

- **Overview:** counts for the range and for the previous period cut to the
  same elapsed time, so a tile can say "+12% vs previous 30d". Buckets come
  from `generate_series` with a left join, so a quiet day shows as zero.
- **Explorer:** filters are `AND`ed fragments, including
  `props @> '{"channel":"link"}'::jsonb` for `key=value`. Pages are keyset
  paginated on `(ts, id)`, so page fifty costs what page one does, and the
  count stops at "100K+".
- **Retention:** cohorts by signup week, distinct `(user, week)` activity,
  group by cohort and weeks since. The triangle is shaped in TypeScript,
  where it is testable.
- **Funnels:** step _n_ joins step _n-1_ on `user_id` with
  `e.ts > previous.ts`, so a user counts only if the events happened in order.

What Postgres does with them on the seeded data (`EXPLAIN ANALYZE`, 30 days):

```
kpis         Index Scan using events_user_id_ts_idx, 204k rows, 138 ms
timeseries   Seq Scan + HashAggregate into 31 buckets, 62 ms
explorer     Index Scan Backward on events_ts_idx, stops after 101 rows, 0.9 ms
conversion   Seq Scan on users + Bitmap Index Scan on (user_id, ts) per user, 33 ms
```

The KPI query is the slow one. A real deployment would keep a daily rollup;
at this size 138 ms is fine for a dashboard.

## Things worth opening

- **`src/lib/params.ts`:** every URL parameter parsed with zod in one place. A
  bad value falls back instead of breaking the page.
- **`src/components/charts/line-chart.tsx`:** the tooltip follows the pointer
  and the arrow keys, with a hidden table of the same numbers for screen readers.
- **`src/components/charts/heatmap.tsx`:** the retention grid is a `<table>`
  with the percentage in every cell; color is a second reading, not the only one.
- **`src/components/explorer/events-table.tsx`:** TanStack Virtual plus a
  keyset cursor, with one request in flight tracked in a ref, because
  cancelling in an effect cleanup dropped pages already on their way.
- **`src/app/api/events/export/route.ts`:** the CSV is a `ReadableStream`
  that pulls a thousand rows at a time, so the download starts at once.
- **`src/lib/seed/generate.ts`:** a seeded PRNG and a small model of real use:
  daytime peaks, quiet weekends, a leaky funnel. It makes the charts look like data.

## Tests

The 41 tests without a database cover URL parsing and its fallbacks,
retention and funnel shaping, the CSV stream, the seed's invariants, the
charts as rendered components and the explorer table. The 6 database tests
check that buckets sum to the KPI count, keyset pages do not overlap, and the
funnel never grows from one step to the next.

## Layout

```
src/
  lib/          params.ts, queries/ (the SQL), retention, funnel, seed/
  components/   charts/ (d3-scale and d3-shape only), widgets/, explorer/
  app/          overview, events/, retention/, funnels/, api/events/
```

## What's missing

- No auth and no multi-tenancy: one product, anyone with the URL.
- Weeks and days are UTC; a team in São Paulo would want its own midnight.
- No rollup tables, which is right for this size and wrong past a few million rows.
- The prop filter is containment only: `channel=link`, not `words>500`.

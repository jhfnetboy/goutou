# Seeder — Architecture

A high-level map of how Seeder is built and how to run it. For the MCP server
specifically, see [MCP.md](MCP.md); for the phase-by-phase build journal, see
[PLAN.md](PLAN.md). The root [README](../README.md) is the short user-facing
version.

---

## 1. Approach

Seeder is a **single Next.js application** that ships as **one deployable unit** —
UI, API, auth, file storage, and the built-in MCP server are all the same app.
There is no separate backend service, no message queue, no microservices. A small
team should be able to read the whole thing in an afternoon and fork it without a
diagram on the wall.

Three ideas shape the code:

- **Server-first.** Data is read in React Server Components and mutated through
  Server Actions and a handful of route handlers. There is no client-side data
  store, no REST/GraphQL client, no `useEffect` fetching. The network boundary is
  the Server Component / Server Action boundary.
- **One mutation path, many callers.** Every write — whether it comes from the
  web UI or an AI assistant over MCP — flows through the same `lib/services/*`
  functions, so validation, authorization, and Activity logging are identical
  regardless of origin.
- **Cloudflare-native, SQLite-shaped.** The runtime target is Cloudflare Workers
  with D1 (SQLite) and R2. The data layer is plain SQLite via Drizzle, which keeps
  the door open to other SQLite hosts (see [Deployment](#7-deployment)).

> **Build note:** the project builds with **webpack** (`next build --webpack`),
> not Turbopack. Match this when adding build tooling.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16.2.4** (App Router, RSC) | Server Components + Server Actions remove the entire client data-fetching layer; one framework covers pages, API, and the MCP route. |
| UI runtime | **React 19.2.4** | Required by Next 16; Actions / `useActionState` pair with Server Actions. |
| Runtime target | **Cloudflare Workers** via **`@opennextjs/cloudflare`** | OpenNext compiles the Next build into a `worker.js` that runs on `workerd`. Serverless, global, scale-to-zero. |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM** (or local **SQLite via libSQL** in node mode) | D1 is managed SQLite — no DB server to run. Drizzle's SQLite dialect is portable, so node mode reuses the exact same schema + migrations against a local file. |
| Object storage | **Cloudflare R2** | S3-compatible blob store for uploaded images, served back through auth-gated routes (objects are never publicly listable). |
| Auth | **Better Auth** + Drizzle adapter | Cookie sessions, email/password, optional Google OAuth, invite-only onboarding. Schema lives in the same Drizzle file as the app tables. |
| Validation | **Zod 4** | One schema source of truth, shared by Server Actions and MCP tools. |
| Rich text | **TipTap 3** (ProseMirror) | Descriptions, notes, comments — with images and tables. |
| Drag & drop | **dnd-kit** | Kanban reordering and the daily planner queue. |
| Charts | **Recharts** + `react-activity-calendar` | Dashboard KPIs, throughput, and the activity heatmap. |
| Styling | **Tailwind CSS v4** (PostCSS) | Utility-first; white-label accent color is injected at runtime. |
| Icons | **Phosphor Icons** | Single icon set across the app. |
| MCP | **`@modelcontextprotocol/sdk`** | Built-in remote MCP server at `/api/mcp` — see [MCP.md](MCP.md). |
| Tests / CI | **Vitest** + GitHub Actions | CI runs lint → typecheck → test → build on every PR (Node 24). |
| Local emulation | **Miniflare** (via Wrangler) | Simulates D1 + R2 on disk under `.wrangler/state`; no Cloudflare account needed to develop. |

---

## 3. Request flow

```
                          ┌─────────────────────────────────────────────┐
   Browser  ── GET ─────▶ │  React Server Component (app/(app)/**/page)  │
                          │    reads via lib/data.ts  (react cache())    │
                          └───────────────┬─────────────────────────────┘
                                          │ getDb() → getCloudflareContext().env.PM_DB
                                          ▼
                                    ┌────────────┐
                                    │   D1 (SQLite) │
                                    └────────────┘

   Browser  ── form / action ─▶  Server Action  (lib/actions.ts, "use server")
                                      │  authz (lib/authz) + Zod validate
                                      ▼
                                 lib/services/{tasks,checklist,requests}.ts
                                      │  mutate + logProjectActivity()
                                      ▼  revalidatePath()

   AI client ── POST /api/mcp ─▶  app/api/mcp/route.ts  ──▶  same lib/services/*
                                  (PAT → Viewer, see MCP.md)

   Browser  ── POST /api/uploads ─▶ route handler ──▶ R2 (env.UPLOADS)
   Browser  ── GET  /api/uploads/* ◀── auth-gated read ◀── R2
```

Key points:

- **Reads** go through `lib/data.ts`, wrapped in React's `cache()` so a single
  render dedupes repeated queries. The DB handle itself (`lib/db/index.ts`) is
  also `cache()`d per request.
- **Writes** from the UI are **Server Actions** in `lib/actions.ts`; they
  authorize, validate with Zod, delegate the actual mutation to a service, then
  `revalidatePath()` the affected routes.
- **The services layer** (`lib/services/*`) is the shared core. The web action and
  the MCP tool handler both call it, so an edit made by Claude and an edit made in
  the browser are validated, authorized, and logged identically.
- **Route handlers** (`app/api/**`) cover everything that isn't a page or a form
  action: Better Auth (`/api/auth/[...all]`), uploads, the MCP endpoint, search
  index, and the drag-reorder endpoints.

---

## 4. Data & storage

**Database.** A single D1 binding named **`PM_DB`**, accessed through Drizzle:

```ts
// lib/db/index.ts
export const getDb = cache(() => {
  const { env } = getCloudflareContext();
  return drizzle(env.PM_DB, { schema });
});
```

The schema (`lib/db/schema.ts`) defines ~21 tables — users/sessions/accounts
(Better Auth), projects, tasks, categories, checklists, client requests, comments,
daily tasks, notifications, activity, invitations, personal access tokens, and
system settings. Migrations are checked-in SQL under `migrations/` (`0001` →
`0024`), applied with Wrangler:

```bash
npm run db:migrate:local     # against Miniflare's local D1
npm run db:migrate:remote    # against the deployed D1
```

**Storage.** Uploaded images live in the R2 bucket bound as **`UPLOADS`**. They
are written through `/api/uploads/image` and read back through auth-gated routes
(`/api/uploads/[...path]`, `/api/branding/[...path]`, and a token-scoped variant
for the public client board). Objects are never publicly listable — every read
passes an auth check first.

**Activity log.** Mutations call `logProjectActivity()`, which records a
before→after diff. Because all writes funnel through the services layer, the feed
is complete whether a change came from a human or an AI.

---

## 5. Auth & authorization

- **Better Auth** issues cookie sessions (`seeder` cookie prefix), backed by the
  same Drizzle/SQLite database.
- **Invite-only onboarding** with a single bootstrap exception: on a brand-new
  instance (zero users) the configured `OWNER_EMAIL` may create the first owner
  account; after that, public sign-up is closed server-side. Everyone else joins
  through an admin-issued invite. Optional Google OAuth signs into already-invited
  accounts only.
- **Authorization** is centralized in `lib/authz.ts` / `lib/auth-server.ts`. The
  web Server Actions use a stricter ownership model; the member-aware
  `canAccessProject` check backs reads and the MCP surface. A personal access
  token can never exceed the access of the user who created it.
- **Config validation** in `lib/env.ts` **fails closed**: if a real deployment is
  detected (`BETTER_AUTH_URL` set) but `BETTER_AUTH_SECRET` is still the example
  default, the app refuses to boot.

Defense-in-depth response headers (frame-busting, HSTS, nosniff, referrer,
permissions) are applied to every route in `next.config.ts`.

---

## 6. Project layout

```
app/
  (app)/        authenticated UI — dashboard, projects, daily, admin, settings
  (auth)/       sign-in / first-owner bootstrap
  client/       public, token-gated read-only client board
  api/          route handlers — auth, mcp, uploads, reorder, admin, …
components/     UI by domain — projects, daily, dashboard, admin, rich-text, ui
lib/
  db/           Drizzle schema + cached D1 handle
  services/     shared mutation cores (web + MCP)
  mcp/          MCP server definition
  actions.ts    Server Actions ("use server")
  data.ts       cached read queries
  auth*.ts      Better Auth setup, server-side session/role helpers
  env.ts        validated runtime config
migrations/     checked-in D1 SQL migrations
scripts/        seed / backfill (Bun)
tests/          Vitest
```

---

## 7. Deployment

An interactive wizard configures any of three modes end to end:

```bash
npm run setup
#  1) dev (local)            — Miniflare, `next dev`
#  2) production (node)      — standalone Node server + SQLite, no Cloudflare
#  3) production (cloudflare) — OpenNext → Workers (D1 + R2)
```

The runtime is selected by a single env var, **`RUNTIME`** (`cloudflare` by
default, or `node`), read at exactly two seams — `lib/db/index.ts` and
`lib/storage/index.ts` — each of which branches on it *before* ever calling
`getCloudflareContext()` (which throws off-Workers). So the same codebase runs on
Cloudflare **or** as a plain Node server, with the Cloudflare path unchanged.

| Seam | `cloudflare` (default) | `node` |
|---|---|---|
| Database (`lib/db`) | Cloudflare **D1** via `drizzle-orm/d1` | local **SQLite file** via `drizzle-orm/libsql` |
| Storage (`lib/storage`) | **R2** bucket | **local disk** (`UPLOADS_DIR`) |
| Build / run | `opennextjs-cloudflare build` → Workers | `next build` + `next start` |

(libsql is loaded through a runtime `require` with a computed specifier so its
native `@libsql/client` is never bundled into the Workers output — the Cloudflare
build stays byte-for-byte unaffected.)

### Option A — Cloudflare Workers (native target)

The app is compiled by OpenNext into a Worker and deployed with one command:

```bash
npm run deploy   # opennextjs-cloudflare build && deploy --keep-vars
```

Bindings (`PM_DB` → D1, `UPLOADS` → R2, `ASSETS` → static) are declared in
`wrangler.jsonc`; secrets (`BETTER_AUTH_SECRET`, etc.) are set with
`wrangler secret put`. See the README's [Deploy](../README.md#deploy) section for
the first-time D1/R2 setup steps.

**Good for:**

- **Zero servers / zero ops** — no OS to patch, no process to keep alive, no TLS
  to renew. Scales to zero when idle and out under load automatically.
- **Global by default** — runs at Cloudflare's edge POPs; TLS, CDN, and DDoS
  protection are included.
- **Batteries included** — D1 (managed SQLite, with backups) and R2 (S3-compatible,
  **zero egress fees**) are first-party, so the whole app — including the MCP
  server — ships as one unit, always version-matched to its own schema.
- **Cheap to start** — the free tier covers a small team; the paid Workers plan is
  ~$5/mo.

**Limits to know:**

- **Per-request CPU budget.** Workers cap CPU time per request (tens of ms on free,
  configurable up to ~5 min on paid). Fine for CRUD; not a host for long-running
  jobs, heavy batch processing, or websocket-heavy workloads.
- **No long-lived processes.** Each request runs in a short-lived isolate — no
  in-memory background workers or cron loops in-process (Cloudflare Cron Triggers
  exist but the app doesn't use them).
- **Worker bundle size.** OpenNext output must fit the Worker size limit
  (~3 MB compressed free / ~10 MB paid). Large dependencies can push against this.
- **D1 ceilings.** D1 is single-primary SQLite with per-database storage and
  daily read/write limits (free tier is generous for a small team; very large or
  write-heavy datasets will outgrow it). Reads can scale via read replicas.
- **Vendor coupling.** The app is written to Cloudflare bindings — moving off
  Cloudflare means doing the work in Option B.

### Option B — Self-host on a VM (`production (node)`)

This is now **first-class**, not adapter work: `npm run setup` → mode 2 writes a
`.env` (`RUNTIME=node`), creates the data/uploads directories, applies migrations
to the SQLite file (`npm run db:migrate:node`), builds (`npm run build:node`), and
generates a process-manager artifact + reverse-proxy snippet + runbook. Under the
hood:

1. **Database.** `drizzle-orm/libsql` against a local SQLite file
   (`SQLITE_DB_PATH`). The schema and all checked-in migrations are reused as-is
   (libsql matches D1's async + `.batch()` surface, so no app code changes). A
   dedicated `scripts/migrate-node.ts` applies the raw-SQL migrations and tracks
   them in a `d1_migrations` table.
2. **Storage.** Uploads become plain files under `UPLOADS_DIR` (content-type /
   cache-control / etag preserved in a sidecar), served through the same
   `/api/uploads/*` routes.
3. **Process manager.** The wizard generates your choice of **PM2** (fork mode,
   single instance — SQLite is single-writer), **systemd**, or **Docker**, plus a
   **Caddyfile** for TLS and a `DEPLOY-node.md` runbook.
4. **Operate it.** `next start` serves plain HTTP behind the reverse proxy; the
   secret lives only in the git-ignored `.env`.

**Good for:**

- **No platform limits** — no per-request CPU ceiling, no bundle-size cap; run
  long tasks, websockets, or heavy work freely.
- **Data ownership & residency** — keep the database and uploads on-prem or in a
  region/cloud of your choice; no third-party data processor.
- **No vendor lock-in** — runs on any VM, homelab, or cloud; predictable flat cost.
- **Co-location** — app and database on the same box means very low query latency.

**Limits to know:**

- **You own the ops.** OS patching, TLS renewal, backups (just copy the SQLite
  file + uploads dir, or use Litestream), monitoring, and scaling are yours.
- **Single instance only.** SQLite is a single writer, so the generated artifacts
  deliberately run one process (PM2 fork mode, one systemd unit, no `replicas`).
  Horizontal scaling would mean moving to networked libSQL/Turso or D1.
- **No scale-to-zero, no edge.** A single VM bills 24/7 whether or not anyone is
  using it, serves from one region, and is a single point of failure unless you
  build HA yourself.

### At a glance

| | **Cloudflare Workers** | **VM (`production (node)`)** |
|---|---|---|
| Setup effort | `npm run setup` → mode 3 | `npm run setup` → mode 2 |
| Ops burden | Near zero | OS, TLS, backups, monitoring, HA — all yours |
| Scaling | Automatic, to zero and out | Single instance (SQLite single-writer) |
| Latency | Global edge | Single region |
| Database | D1 (managed SQLite) | local SQLite file via libSQL |
| Storage | R2 (zero egress) | local disk (`UPLOADS_DIR`) |
| DB-client access | wrangler / dashboard only | open the `.sqlite` in any tool |
| Long-running work | Not supported | Supported |
| Data residency | Cloudflare regions | Anywhere you choose |
| Cost shape | Free tier → ~$5/mo, usage-based | Flat VM cost, 24/7 |
| Lock-in | Cloudflare bindings | None |

**Recommendation.** Use **Cloudflare Workers** for the fastest path, lowest
operational cost, and a global footprint — it is what the code targets. Choose
**`production (node)`** when data residency, direct DB/file access, the absence of
platform limits, or avoiding vendor lock-in matters more than ops simplicity — and
remember it's a single box you must keep alive and back up.

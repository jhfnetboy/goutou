# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local development (Cloudflare target, Miniflare simulates D1/R2)
npm run dev

# One-time setup wizard (generates .dev.vars, migration, and seed)
npm run setup

# Apply D1 migrations
npm run db:migrate:local        # local Miniflare
npm run db:migrate:remote       # production Cloudflare D1

# Seed initial admin user
npm run db:seed:local
npm run db:seed:demo:local      # includes sample data

# Pre-PR checks (run all before opening a PR)
npm run lint                    # ESLint
npx tsc --noEmit                # type-check
npm test                        # Vitest unit tests
npm run build                   # production build

# Run a single test file
npx vitest run tests/codes.test.ts

# Deploy to Cloudflare
npm run deploy

# Test against local Cloudflare Workers runtime (opennextjs-cloudflare build + wrangler preview)
npm run preview

# Regenerate Cloudflare env types after wrangler.jsonc changes
npm run cf-typegen

# Node VM target (self-hosted, RUNTIME=node)
npm run build:node
npm run start:node
npm run db:migrate:node
```

Copy `.dev.vars.example` → `.dev.vars` for local dev. Required vars: `OWNER_EMAIL`, `BETTER_AUTH_SECRET`. `BETTER_AUTH_URL` is required in production only.

## Architecture

### Dual runtimes

The app targets two deployment modes, selected by `RUNTIME`:
- **Cloudflare Workers** (default/unset): `getDb()` uses `drizzle-orm/d1` via `getCloudflareContext()`. File storage goes to R2 (`lib/storage/r2.ts`).
- **Node VM** (`RUNTIME=node`): `getDb()` uses `drizzle-orm/libsql` against a local SQLite file (`SQLITE_DB_PATH`, default `./data/seeder.db`). File storage uses the local filesystem (`lib/storage/local.ts`).

Both modes share the same Drizzle schema and all `lib/services/*` — only the driver changes. `lib/db/index.ts` handles the switch.

### App Router layout

```
app/
  (app)/          ← authenticated workspace (layout enforces session)
    admin/        ← owner/admin-only pages
    projects/[projectId]/   ← board, requests, history, notes, settings
    dashboard/, daily/, today/, settings/
  (auth)/sign-in/
  api/
    mcp/          ← MCP endpoint at /api/mcp (PAT bearer auth)
    workspace/    ← thin mutation dispatcher → delegates to lib/services/*
    auth/         ← Better Auth handler
    uploads/      ← R2/local file serving
    client/[token]/  ← public client board uploads (unauthenticated)
  client/[token]/ ← public read-only client board (token-gated)
```

### Data flow

Pages and layouts call functions in **`lib/data.ts`** (read) and **`lib/actions.ts`** (write, all Server Actions). Both call `lib/services/*` for shared business logic. The workspace API route (`app/api/workspace/route.ts`) is a thin dispatcher that also delegates to `lib/services/*`.

**`lib/services/`** is the canonical mutation layer, shared by the web app, workspace API, and MCP: `_shared.ts`, `branches.ts`, `categories.ts`, `checklist.ts`, `comments.ts`, `labels.ts`, `members.ts`, `notes.ts`, `projects.ts`, `reads.ts`, `requests.ts`, `spaces.ts`, `status-updates.ts`, `statuses.ts`, `tasks.ts`. Each exports typed input schemas (Zod) and `async fn(viewer, input)` signatures. Do not call `revalidatePath`/`redirect` inside services — those stay in the callers.

The **MCP server** (`lib/mcp/server.ts`, mounted at `app/api/mcp/route.ts`) calls the same `lib/services/*` functions — identical validation, authz, and activity logging. Write tools are only registered when the PAT scope is `readwrite`.

### MCP server

Endpoint: `POST /api/mcp` — stateless, one fresh `McpServer` + `WebStandardStreamableHTTPServerTransport` per request.

**Auth**: Bearer token `seed_pat_…` resolved by `getViewerFromToken()` in `lib/auth-token.ts`. The function derives a `Viewer` identical to `getViewer()` and performs the same `disabledAt` check — so all downstream authz helpers work unchanged.

**Scope gating**: `read` tokens see 7 read tools; `readwrite` tokens see all 18 tools (read + write). Admin-tier write tools (`create-project`, etc.) re-check `isAdminTier(viewer.role)` inside the handler as defense-in-depth.

**Origin guard**: `app/api/mcp/route.ts` validates the `Origin` header against `MCP_ALLOWED_ORIGINS` (env var, comma-separated). A missing `Origin` passes (non-browser clients). Configure in `.dev.vars` and `wrangler.jsonc`.

**Personal Access Tokens (PATs)**: minted at `/settings/tokens` (UI) or via `POST /api/account/tokens`. Schema is `personalAccessToken` in `lib/db/schema.ts`; only the SHA-256 hash is stored; raw value shown once at creation. Do **not** install `@better-auth/api-key` — Seeder deliberately hand-rolls PATs.

### Auth & authorization

- **Session auth**: `getViewer()` in `lib/auth-server.ts` returns a `Viewer` (id, email, name, role, image) or null for disabled users. Use `requireViewer()` / `requireSession()` to gate server code.
- **Token auth**: `lib/auth-token.ts` resolves PATs for `/api/mcp`. Derives the same `Viewer` shape so all authz code is reused unchanged.
- **Workspace roles** (`lib/db/schema.ts`): `owner` > `admin` > `member`. `isAdminTier(role)` is true for owner/admin.
- **Project roles** (`lib/authz.ts`): `owner` (project creator or workspace admin) > `leader` (project_members row) > `member`. Space membership does NOT grant project access — only explicit project membership does.
- **Per-project capability toggles** (`lib/project-capabilities.ts`): configure what the `member` project role may do; owners/leaders are never gated. Stored as a JSON map on `projects.memberPermissions`; `resolveMemberPermissions()` merges overrides onto code defaults.

### Database

Schema lives in **`lib/db/schema.ts`** (Drizzle). When you change the schema, add a hand-authored numbered SQL file to `migrations/` — never use `drizzle-kit push`. The `migrations/` directory is both the drizzle-kit output and wrangler's `migrations_dir`.

Key invariants baked into the schema:
- `taskStatuses` are per-project custom board columns (replaced fixed `todo/doing/done`). `isTerminal` replaces the old `status === "done"` check everywhere. `isInitial` is the default column for new tasks.
- `tasks.statusName`, `tasks.statusColor`, `tasks.isTerminal` are **denormalized** off the status row to avoid joins on every read surface. The status service resyncs them on every rename/recolor.
- `task_categories` → one category per task (nullable FK + denormalized name/color). `task_labels` → many-to-many via `task_task_labels`.
- `branches` — git-like workstreams per project. Every project has exactly one default ("Main") branch. Tasks and requests are scoped to a branch.
- `spaces` — organizational groupings. `personal` (one per user, auto-created) or `company` (admin-managed). Space membership does not widen project access.
- `personalAccessToken` — only a SHA-256 hash is stored; the raw token is returned once at creation.
- `systemSettings` — singleton row (id=1), used for white-labeling.

### Activity logging

Every mutation (from the UI or MCP) calls `logProjectActivity()` (`lib/activity.ts`). The `project_activity` table stores before→after field diffs as a JSON `ActivityChange[]` array, shown in the History tab.

### Storage

`lib/storage/index.ts` exports a unified `StorageDriver` interface. The active driver is resolved once at module load: R2 on Cloudflare Workers, local filesystem on Node. Upload routes serve files from whichever backend is configured.

## Security-sensitive areas

Per `CONTRIBUTING.md`, pay extra attention when modifying:
- **Authorization / multi-tenant scoping** — every data read/write must pass through `canAccessProject` / `getProjectRole` / `isAdminTier`
- **Invite flow** — only valid invite tokens may bootstrap new accounts
- **Uploads** — authenticated routes must not serve another project's files; the public client board route (`/api/client/[token]/uploads/`) is unauthenticated and must only serve assets for the matching share token
- **Public client board** — reached via a rotatable share token, not the project ID

## Testing

Tests live in `tests/` and are pure-unit: they must not import Next.js server-only modules, `getDb()`, or runtime-specific code. The `@/` alias maps to the project root.

```bash
npx vitest run tests/<file>.test.ts   # single file
npm run test:watch                     # watch mode
```

Significant test files: `auth-token.test.ts`, `codes.test.ts`, `member-permissions.test.ts`, `public-board.test.ts`, `services-helpers.test.ts`, `storage-local.test.ts`, `storage-r2.test.ts`, `task-statuses.test.ts`. MCP smoke tests live at `tests/bench-mcp.test.ts`.

## 狗头协同系统（Goutou Multi-Repo Coordination）

This repo is the **commander repo** for the Goutou coordination system. It hosts the Seeder instance whose MCP bus the other repos connect to.

### Installed skills

| Skill | Role | Trigger |
|---|---|---|
| `/goutou-commander` | Create a coordination task in Seeder (this repo only) | `/goutou-commander <requirement>` |
| `/goutou` | Soldier: poll Seeder for tasks assigned to this repo | `/goutou` or `/loop 5m /goutou` |
| `/goutou-converge` | Commander: synthesize when all soldiers have replied | `/goutou-converge` or `/loop 30m /goutou-converge` |
| `/goutou-status` | Read-only status matrix of all coord tasks | `/goutou-status` |

Install / update skills: `cp skills/<name>/SKILL.md ~/.claude/skills/<name>/SKILL.md`

Full guide: `docs/goutou/README.md`

### MCP config for sub-repos

Each sub-repo (contract, kms, dvt, sdk, app) needs Seeder added as an MCP server. Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "seeder": {
      "type": "http",
      "url": "https://your-seeder.example.com/api/mcp",
      "headers": { "Authorization": "Bearer seed_pat_…" }
    }
  }
}
```

Create a PAT at **Settings → API Tokens** (scope: `readwrite`).

### Label routing convention

`repo:<repoId>` labels route tasks to the right soldier. REPO_ID is auto-detected from `git remote get-url origin` (last path segment, no `.git`), or set explicitly in `.goutou.json → repoId`.

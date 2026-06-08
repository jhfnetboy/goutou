// Shared database execution for the seed scripts, so the same SQL runs against
// either target:
//   - default          → the local Miniflare D1 (via `wrangler d1 execute --local`)
//   - RUNTIME=node      → the node-mode SQLite file at SQLITE_DB_PATH (via libsql)
// This lets `db:seed:local` / `db:seed:demo:local` (Miniflare) and
// `db:seed:node` / `db:seed:demo:node` (self-hosted Node) share one code path.

import { execFileSync } from "node:child_process";
import path from "node:path";

const isNode = process.env.RUNTIME === "node";

type LibsqlClient = {
  executeMultiple(sql: string): Promise<unknown>;
  execute(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
  close(): void;
};

async function withLibsql<T>(fn: (client: LibsqlClient) => Promise<T>): Promise<T> {
  const { createClient } = await import("@libsql/client");
  const dbPath = path.resolve(process.env.SQLITE_DB_PATH ?? "./data/seeder.db");
  const client = createClient({ url: `file:${dbPath}` }) as unknown as LibsqlClient;
  try {
    return await fn(client);
  } finally {
    client.close();
  }
}

/** Run one or more `;`-separated statements (no result needed). */
export async function execSql(sql: string): Promise<void> {
  if (isNode) {
    await withLibsql((client) => client.executeMultiple(sql));
    return;
  }
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "PM_DB", "--local", `--command=${sql}`],
    { stdio: "inherit" },
  );
}

/** Run a SELECT and return its rows as plain objects. */
export async function queryRows(
  sql: string,
): Promise<Record<string, unknown>[]> {
  if (isNode) {
    return withLibsql(async (client) => (await client.execute(sql)).rows);
  }
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "PM_DB", "--local", "--json", "--command", sql],
    { encoding: "utf8" },
  );
  const json = JSON.parse(out.slice(out.indexOf("["))) as
    | { results?: Record<string, unknown>[] }[]
    | undefined;
  return json?.[0]?.results ?? [];
}

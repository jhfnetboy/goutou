// Applies the checked-in SQLite migrations (migrations/0001..NNNN.sql) to the
// local node-mode database. The Cloudflare path uses `wrangler d1 migrations
// apply`; node mode can't use wrangler, and there is no drizzle meta journal
// (the migrations are hand-authored raw SQL), so we apply them directly via
// libsql and track applied files in a `d1_migrations` table.
//
// Run with:  RUNTIME=node tsx scripts/migrate-node.ts
// (also wired as `npm run db:migrate:node`).

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@libsql/client";

async function main() {
  const dbPath = path.resolve(process.env.SQLITE_DB_PATH ?? "./data/seeder.db");
  const migrationsDir = path.resolve("./migrations");

  const client = createClient({ url: `file:${dbPath}` });

  await client.execute(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const appliedRows = await client.execute("SELECT name FROM d1_migrations");
  const applied = new Set(appliedRows.rows.map((row) => String(row.name)));

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(migrationsDir, file), "utf8");

    // Wrap each migration (and the bookkeeping insert) in a single transaction
    // so a failure rolls the whole file back, and so `PRAGMA defer_foreign_keys`
    // — used by 0001 — actually takes effect (it only applies inside a tx).
    // executeMultiple() can't parameterise, so the filename is SQLite-escaped
    // (single quotes doubled) before interpolation to keep the insert injection-safe.
    const safeName = file.replace(/'/g, "''");
    await client.executeMultiple(
      `BEGIN;\n${sql};\nINSERT INTO d1_migrations (name) VALUES ('${safeName}');\nCOMMIT;`,
    );

    console.log(`applied ${file}`);
    count += 1;
  }

  console.log(count ? `Applied ${count} migration(s).` : "Already up to date.");
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

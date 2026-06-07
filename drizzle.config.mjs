import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  // Migrations are hand-authored and sequentially numbered in ./migrations,
  // which is also wrangler's `migrations_dir`. Point drizzle-kit's output here
  // too so any generated migration lands where `db:migrate:*` actually applies
  // it, instead of an orphaned ./drizzle dir wrangler never reads.
  out: "./migrations",
});

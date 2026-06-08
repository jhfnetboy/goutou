import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import path from "node:path";
import { cache } from "react";

import * as schema from "@/lib/db/schema";

// In node mode (RUNTIME=node) we run against a local SQLite file via libsql
// instead of Cloudflare D1. drizzle-orm/libsql matches D1 on both axes the app
// relies on — async results and .batch() — so every getDb() consumer and the
// Better Auth adapter keep working unchanged.
//
// libsql is loaded through webpack's __non_webpack_require__ (the real runtime
// require, which webpack rewrites and never strips — unlike a `node:module`
// createRequire import, which the Next build tree-shakes away) with a COMPUTED
// specifier, so drizzle-orm/libsql and its native @libsql/client stay out of
// BOTH the node and the Workers bundles and resolve from node_modules only at
// `next start`. The handle is memoised so the long-lived process reuses one
// connection. This branch runs BEFORE getCloudflareContext(), which throws when
// called off-Workers.
declare const __non_webpack_require__: NodeRequire;

let nodeDb: ReturnType<typeof drizzle> | undefined;

export const getDb = cache(() => {
  if (process.env.RUNTIME === "node") {
    if (!nodeDb) {
      // Build the specifier at runtime with two distinct arms so neither
      // webpack nor OpenNext's esbuild can constant-fold it to a literal
      // `require("drizzle-orm/libsql")` and pull native @libsql/client into a
      // bundle. Only the node arm is ever reached (we're inside RUNTIME=node).
      const driverPkg =
        process.env.RUNTIME === "node" ? "drizzle-orm/libsql" : "drizzle-orm/d1";
      const { drizzle: drizzleLibsql } = __non_webpack_require__(driverPkg);
      const file = path.resolve(process.env.SQLITE_DB_PATH ?? "./data/seeder.db");
      nodeDb = drizzleLibsql({ connection: { url: `file:${file}` }, schema });
    }
    return nodeDb!;
  }

  const { env } = getCloudflareContext();

  return drizzle(env.PM_DB, { schema });
});

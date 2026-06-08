// Runtime selector for object storage. Mirrors lib/db/index.ts: branch on
// RUNTIME *before* touching getCloudflareContext(), which throws off-Workers.
// The backend modules are require()d lazily inside their branch so ./r2 is never
// loaded in node and ./local is never executed on Workers.
//
// Unlike lib/db (where @libsql/client's workerd export breaks the OpenNext
// bundle, forcing the __non_webpack_require__ trick), plain require() is safe
// here: ./local's only special dependency is node:fs, which bundles cleanly into
// the Workers output via nodejs_compat and is simply never executed in cloudflare
// mode. Validated by `opennextjs-cloudflare build` succeeding.

import { cache } from "react";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { Storage } from "./types";

export const getStorage = cache((): Storage | null => {
  if (process.env.RUNTIME === "node") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createLocalStorage } = require("./local");
    return createLocalStorage(process.env.UPLOADS_DIR ?? "./data/uploads");
  }

  const { env } = getCloudflareContext();
  if (!env.UPLOADS) return null; // preserves the existing 503 semantics

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createR2Storage } = require("./r2");
  return createR2Storage(env.UPLOADS);
});

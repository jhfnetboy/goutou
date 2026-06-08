// Local-disk implementation of the Storage interface, used in node mode
// (RUNTIME=node) in place of Cloudflare R2. Objects are plain files under a
// configurable root (UPLOADS_DIR); R2's httpMetadata (content-type,
// cache-control) and etag are preserved in a `<key>.meta.json` sidecar so
// reads behave identically to R2. This module imports node: builtins and must
// only ever be loaded in node mode — ./index require()s it lazily inside the
// RUNTIME=node branch so it is never reachable from the Workers bundle.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import type { PutOptions, Storage, StoredObject } from "./types";

// Only image types are ever written (both upload routes gate on an image
// allow-list), so this covers every key that can exist without a sidecar.
const EXT_CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

type Sidecar = { contentType?: string; cacheControl?: string; etag: string };

export function createLocalStorage(root: string): Storage {
  const rootAbs = path.resolve(root);
  const sidecarPath = (abs: string) => `${abs}.meta.json`;

  // Confine every key inside the root — defence-in-depth against path traversal
  // even though the routes already prefix-gate keys (images/, branding/).
  function resolveKey(key: string): string | null {
    const target = path.resolve(rootAbs, key);
    if (target !== rootAbs && !target.startsWith(rootAbs + path.sep)) {
      return null;
    }
    return target;
  }

  return {
    async get(key: string): Promise<StoredObject | null> {
      const abs = resolveKey(key);
      if (!abs) return null;

      let stats;
      try {
        stats = await stat(abs);
      } catch {
        return null; // ENOENT / not a readable file
      }
      if (!stats.isFile()) return null;

      let meta: Sidecar | null = null;
      try {
        meta = JSON.parse(await readFile(sidecarPath(abs), "utf8")) as Sidecar;
      } catch {
        meta = null;
      }

      const ext = path.extname(abs).toLowerCase();
      const body = Readable.toWeb(
        createReadStream(abs),
      ) as unknown as ReadableStream<Uint8Array>;

      return {
        body,
        contentType: meta?.contentType ?? EXT_CONTENT_TYPE[ext],
        cacheControl: meta?.cacheControl,
        // Fall back to a stat-derived etag when no sidecar exists.
        etag: meta?.etag ?? `"${stats.size}-${Math.trunc(stats.mtimeMs)}"`,
      };
    },

    async put(key: string, body: ArrayBuffer, options?: PutOptions): Promise<void> {
      const abs = resolveKey(key);
      if (!abs) throw new Error("Invalid storage key");

      await mkdir(path.dirname(abs), { recursive: true });
      const buffer = Buffer.from(body);
      const etag = `"${createHash("sha256").update(buffer).digest("hex")}"`;

      const meta: Sidecar = {
        contentType: options?.contentType,
        cacheControl: options?.cacheControl,
        etag,
      };
      // Write the sidecar BEFORE the body becomes visible. get() stats the main
      // file first, so publishing the body last (via the atomic rename) means a
      // concurrent reader never observes the object without its metadata — it
      // either sees nothing yet (→ null) or the body with its real sidecar etag.
      await writeFile(sidecarPath(abs), JSON.stringify(meta));
      const tmp = `${abs}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
      await writeFile(tmp, buffer);
      await rename(tmp, abs);
    },

    async delete(key: string): Promise<void> {
      const abs = resolveKey(key);
      if (!abs) return;
      await rm(abs, { force: true });
      await rm(sidecarPath(abs), { force: true });
    },
  };
}

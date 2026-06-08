// Cloudflare R2 implementation of the Storage interface. Behaviour is
// byte-identical to the inline env.UPLOADS calls this replaced — the single
// `as unknown as ReadableStream` cast (R2's body is typed as a Workers stream)
// now lives here instead of in every route.

import type { PutOptions, Storage, StoredObject } from "./types";

// Derive the R2 bucket type from the globally-declared CloudflareEnv (the same
// type the routes hold as env.UPLOADS), so we don't depend on the bare
// R2Bucket global being in ambient scope in this module.
type R2Bucket = CloudflareEnv["UPLOADS"];

export function createR2Storage(bucket: R2Bucket): Storage {
  return {
    async get(key: string): Promise<StoredObject | null> {
      const object = await bucket.get(key);
      if (!object) return null;

      return {
        body: object.body as unknown as ReadableStream<Uint8Array>,
        contentType: object.httpMetadata?.contentType,
        cacheControl: object.httpMetadata?.cacheControl,
        etag: object.httpEtag,
      };
    },

    async put(key: string, body: ArrayBuffer, options?: PutOptions): Promise<void> {
      await bucket.put(key, body, {
        httpMetadata: {
          contentType: options?.contentType,
          cacheControl: options?.cacheControl,
        },
      });
    },

    async delete(key: string): Promise<void> {
      await bucket.delete(key);
    },
  };
}

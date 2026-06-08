// Minimal object-storage surface shared by the Cloudflare (R2) and node (local
// disk) runtimes. Only get/put/delete are needed — there are no list() callers
// anywhere in the app. The two implementations live in ./r2 and ./local and are
// selected at runtime by ./index based on the RUNTIME env var.

export interface StoredObject {
  body: ReadableStream<Uint8Array>;
  contentType?: string;
  cacheControl?: string;
  /** Strong etag, quoted, mirroring R2's httpEtag. */
  etag: string;
}

export interface PutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface Storage {
  /** Returns null when the key does not exist (mirrors R2's get). */
  get(key: string): Promise<StoredObject | null>;
  /** Writes (overwrites) the object. Callers already buffer to ArrayBuffer. */
  put(key: string, body: ArrayBuffer, options?: PutOptions): Promise<void>;
  /** Best-effort delete; a missing key is not an error. */
  delete(key: string): Promise<void>;
}

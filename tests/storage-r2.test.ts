import { describe, expect, it, vi } from "vitest";

import { createR2Storage } from "@/lib/storage/r2";

// The R2 backend must stay byte-for-byte compatible with the inline env.UPLOADS
// calls it replaced: forward httpMetadata on put, flatten it on get, null-pass.
type FakeBucket = {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function fakeBucket(): FakeBucket {
  return { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
}

describe("createR2Storage", () => {
  it("forwards content-type and cache-control as httpMetadata on put", async () => {
    const bucket = fakeBucket();
    const storage = createR2Storage(bucket as never);
    const body = new ArrayBuffer(4);

    await storage.put("images/x.png", body, {
      contentType: "image/png",
      cacheControl: "public, max-age=10",
    });

    expect(bucket.put).toHaveBeenCalledWith("images/x.png", body, {
      httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=10" },
    });
  });

  it("flattens httpMetadata + httpEtag on get", async () => {
    const bucket = fakeBucket();
    const fakeBody = {} as ReadableStream<Uint8Array>;
    bucket.get.mockResolvedValue({
      body: fakeBody,
      httpEtag: '"abc"',
      httpMetadata: { contentType: "image/gif", cacheControl: "private" },
    });
    const storage = createR2Storage(bucket as never);

    const object = await storage.get("images/x.gif");
    expect(object).toEqual({
      body: fakeBody,
      contentType: "image/gif",
      cacheControl: "private",
      etag: '"abc"',
    });
  });

  it("returns null when the object is missing", async () => {
    const bucket = fakeBucket();
    bucket.get.mockResolvedValue(null);
    const storage = createR2Storage(bucket as never);
    expect(await storage.get("images/missing.png")).toBeNull();
  });

  it("delegates delete to the bucket", async () => {
    const bucket = fakeBucket();
    const storage = createR2Storage(bucket as never);
    await storage.delete("images/x.png");
    expect(bucket.delete).toHaveBeenCalledWith("images/x.png");
  });
});

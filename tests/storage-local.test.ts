import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLocalStorage } from "@/lib/storage/local";

function ab(text: string): ArrayBuffer {
  const u = new TextEncoder().encode(text);
  return u.buffer.slice(0, u.byteLength);
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "seeder-storage-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// The local-disk backend is the new node-mode replacement for R2; it must
// round-trip bytes + metadata identically and never escape its root.
describe("createLocalStorage", () => {
  it("round-trips body bytes and metadata via the sidecar", async () => {
    const storage = createLocalStorage(root);
    await storage.put("images/a.png", ab("hello-bytes"), {
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    });

    const object = await storage.get("images/a.png");
    expect(object).not.toBeNull();
    expect(await new Response(object!.body).text()).toBe("hello-bytes");
    expect(object!.contentType).toBe("image/png");
    expect(object!.cacheControl).toBe("public, max-age=31536000, immutable");
    expect(object!.etag).toMatch(/^"[0-9a-f]{64}"$/); // quoted sha256
  });

  it("returns null for a missing key", async () => {
    const storage = createLocalStorage(root);
    expect(await storage.get("images/nope.png")).toBeNull();
  });

  it("deletes objects (and is a no-op for missing keys)", async () => {
    const storage = createLocalStorage(root);
    await storage.put("images/b.png", ab("x"), { contentType: "image/png" });
    await storage.delete("images/b.png");
    expect(await storage.get("images/b.png")).toBeNull();
    await expect(storage.delete("images/b.png")).resolves.toBeUndefined();
  });

  it("falls back to extension-based content-type when no sidecar exists", async () => {
    const storage = createLocalStorage(root);
    // Write a raw file with no .meta.json sidecar.
    writeFileSync(path.join(root, "images-raw.webp"), "raw");
    const object = await storage.get("images-raw.webp");
    expect(object).not.toBeNull();
    expect(object!.contentType).toBe("image/webp");
    expect(object!.etag).toMatch(/^"\d+-\d+"$/); // stat-derived fallback etag
  });

  it("refuses path traversal outside the root", async () => {
    const storage = createLocalStorage(root);
    expect(await storage.get("../../etc/passwd")).toBeNull();
    await expect(
      storage.put("../escape.png", ab("x"), {}),
    ).rejects.toThrow();
  });
});

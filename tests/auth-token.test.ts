import { describe, expect, it } from "vitest";

import { TOKEN_PREFIX, generateToken, hashToken } from "@/lib/auth-token";

// The token format + hashing contract is the foundation of MCP auth: a leaked
// shape, low entropy, or non-deterministic hash would break verification or
// weaken the secret. These run without a DB (pure Web Crypto).
describe("generateToken", () => {
  it("returns a prefixed token and a matching short display prefix", () => {
    const { raw, prefix } = generateToken();
    expect(raw.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(prefix).toBe(raw.slice(0, TOKEN_PREFIX.length + 6));
    // 32 random bytes → base64url is ~43 chars on top of the prefix.
    expect(raw.length).toBeGreaterThan(TOKEN_PREFIX.length + 40);
  });

  it("is unique across calls (high entropy)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateToken().raw);
    expect(seen.size).toBe(100);
  });
});

describe("hashToken", () => {
  it("is a deterministic 64-char lowercase hex SHA-256", async () => {
    const a = await hashToken("seed_pat_example-value");
    const b = await hashToken("seed_pat_example-value");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different inputs", async () => {
    expect(await hashToken("seed_pat_a")).not.toBe(await hashToken("seed_pat_b"));
  });

  it("round-trips a freshly generated token to a stable hash", async () => {
    const { raw } = generateToken();
    expect(await hashToken(raw)).toBe(await hashToken(raw));
  });
});

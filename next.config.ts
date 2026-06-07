import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

// Defense-in-depth response headers applied to every route. The public client
// board (/client/[token]) is unauthenticated, so frame-ancestors + X-Frame-Options
// block clickjacking of it; the rest harden all responses. We intentionally do
// NOT set a script/style CSP here — that needs per-render nonces and would risk
// breaking the app/editor; framing, transport, sniffing, and referrer are the
// high-value, low-risk wins. (HSTS is ignored by browsers over plain http, so
// it's a no-op in local dev.)
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

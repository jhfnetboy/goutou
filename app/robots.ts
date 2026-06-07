import type { MetadataRoute } from "next";

// Seeder is a login-gated, owner-only app; the only "public" surface is the
// client board (capability URLs under /client/[token], already noindex via its
// own metadata). So keep crawlers out of everything.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

// PUBLIC, unauthenticated branding assets (sidebar logos + favicon). They must
// load on logged-out surfaces (the sign-in page and the public /client board),
// so unlike app/api/uploads/[...path] this route is NOT auth-gated. It is hard-
// constrained to the branding/ prefix — private user uploads live under images/
// and remain reachable only through the auth-gated uploads route, so the two
// keyspaces stay cleanly partitioned.
export async function GET(_request: Request, context: RouteContext) {
  const { env } = getCloudflareContext();
  if (!env.UPLOADS) {
    return NextResponse.json(
      { error: "Uploads are not configured on this environment." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const key = path.join("/");
  if (!key || !key.startsWith("branding/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const object = await env.UPLOADS.get(key);
  if (!object) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set("content-type", object.httpMetadata.contentType);
  }
  // Immutable bytes (keys are content-random UUIDs); cache-busting is handled by
  // the ?v=<updatedAt> query on every reference, so we can cache hard.
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-disposition", "inline");
  headers.set("etag", object.httpEtag);

  return new NextResponse(object.body as unknown as ReadableStream, {
    headers,
  });
}

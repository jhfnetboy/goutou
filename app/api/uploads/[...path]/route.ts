import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  // Gate on a valid session — keeps the bucket private. Within the
  // workspace anyone signed in can resolve any uploaded asset; finer-
  // grained per-project ACLs aren't tracked yet.
  await requireViewer();

  const { env } = getCloudflareContext();
  if (!env.UPLOADS) {
    return NextResponse.json(
      { error: "Uploads are not configured on this environment." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const key = path.join("/");
  // This app only ever writes image assets under the images/ prefix. Constrain
  // the servable keyspace so that if any future feature stores private objects
  // in the same bucket, they can never be read through this route.
  if (!key || !key.startsWith("images/")) {
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
  if (object.httpMetadata?.cacheControl) {
    headers.set("cache-control", object.httpMetadata.cacheControl);
  } else {
    headers.set("cache-control", "private, max-age=300");
  }
  // Don't let a browser content-sniff a mislabelled object into something
  // executable, and render inline rather than as an active document.
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-disposition", "inline");
  headers.set("etag", object.httpEtag);

  return new NextResponse(object.body as unknown as ReadableStream, {
    headers,
  });
}

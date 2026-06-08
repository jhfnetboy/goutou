import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth-server";
import { getStorage } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
// PNG/JPEG/WebP only. SVG is intentionally excluded — an inline-served SVG can
// carry script, and these assets are served publicly without an auth gate.
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};
const ALLOWED_KINDS = new Set([
  "logo-dark",
  "logo-light",
  "favicon",
  "sidebar-mark",
]);

// Admin-only upload for system branding. Mirrors app/api/uploads/image but gates
// on owner/admin and writes under the public branding/ prefix. Returns the key
// (persisted later by the System settings PATCH) and a URL for in-form preview.
export async function POST(request: Request) {
  await requireRole(["owner", "admin"]);

  const storage = getStorage();
  if (!storage) {
    return NextResponse.json(
      { error: "Uploads are not configured on this environment." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (typeof kind !== "string" || !ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid asset kind." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use PNG, JPEG, or WebP." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is larger than 5 MB." },
      { status: 413 },
    );
  }

  const ext = EXTENSION_BY_MIME[file.type] ?? "bin";
  const key = `branding/${kind}-${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  await storage.put(key, buffer, {
    contentType: file.type,
    cacheControl: "public, max-age=31536000, immutable",
  });

  return NextResponse.json({ key, url: `/api/branding/${key}` });
}

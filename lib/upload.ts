/**
 * POST a File to the workspace upload endpoint and return its served URL.
 * Mirrors the rich-text editor's uploader (field name "file", `{ url }` response).
 */
export async function uploadImage(
  file: File,
  endpoint = "/api/uploads/image",
): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch(endpoint, { method: "POST", body: formData });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Upload failed");
  }
  const json = (await response.json()) as { url: string };
  return json.url;
}

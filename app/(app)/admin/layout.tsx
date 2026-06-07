import { requireRole } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole(["owner", "admin"]);
  return children;
}

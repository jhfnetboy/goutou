import { TokenManager } from "@/components/settings/tokens/token-manager";
import { requireViewer } from "@/lib/auth-server";
import { getMyTokens } from "@/lib/data-tokens";

export const dynamic = "force-dynamic";

// Personal access tokens — every member manages their own (self-service). The
// header + list + create flow live in TokenManager.
export default async function SettingsTokensPage() {
  const viewer = await requireViewer();
  const tokens = await getMyTokens(viewer.id);

  return <TokenManager tokens={tokens} />;
}

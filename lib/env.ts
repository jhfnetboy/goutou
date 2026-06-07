import { z } from "zod";

const optionalString = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
};

const ownerEmailValue = optionalString(process.env.OWNER_EMAIL);
const parsedOwnerEmail = ownerEmailValue
  ? z.string().email().safeParse(ownerEmailValue.toLowerCase())
  : null;

const googleClientId = optionalString(process.env.GOOGLE_CLIENT_ID);
const googleClientSecret = optionalString(process.env.GOOGLE_CLIENT_SECRET);

const DEFAULT_BETTER_AUTH_SECRET = "change-me-in-production";

const betterAuthSecret =
  optionalString(process.env.BETTER_AUTH_SECRET) ?? DEFAULT_BETTER_AUTH_SECRET;
const betterAuthUrl = optionalString(process.env.BETTER_AUTH_URL);

// Comma-separated allowed Origin values for the MCP endpoint (DNS-rebinding
// protection). Empty = unconfigured → allowed (token auth still required);
// set this in production to your AI clients' origins.
const mcpAllowedOriginsValue = optionalString(process.env.MCP_ALLOWED_ORIGINS);

// Fail closed: the default secret is published in this repo, so signing Better
// Auth cookies with it in production would let anyone forge sessions.
// BETTER_AUTH_URL is required in production and is unset both locally and at
// build time, so its presence is our "this is a real deployment" signal.
if (betterAuthUrl && betterAuthSecret === DEFAULT_BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set to a strong, unique value in production " +
      "(it is unset or still the example default). Generate one with " +
      "`openssl rand -base64 32` and set it via `wrangler secret put BETTER_AUTH_SECRET`.",
  );
}

export const serverEnv = {
  betterAuthSecret,
  betterAuthUrl,
  ownerEmail: parsedOwnerEmail?.success
    ? parsedOwnerEmail.data
    : "admin@admin.com",
  googleClientId,
  googleClientSecret,
  hasGoogleAuth: Boolean(googleClientId && googleClientSecret),
  mcpAllowedOrigins: mcpAllowedOriginsValue
    ? mcpAllowedOriginsValue
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [],
};

export const authTrustedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(serverEnv.betterAuthUrl ? [serverEnv.betterAuthUrl] : []),
];

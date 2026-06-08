// Seed a single owner account into the database for development.
//
// Usage:  npm run db:seed:local   (local Miniflare D1)
//         npm run db:seed:node    (node-mode SQLite file at SQLITE_DB_PATH)
//
// Defaults to email "admin@admin.com" / password "admin". This bypasses
// Better Auth's signup route (which is disabled via emailAndPassword.disableSignUp)
// by writing directly to the user + account tables with a Better-Auth-compatible
// scrypt hash, so the resulting credential is identical to one produced by
// the normal sign-up flow.

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

import { execSql } from "./seed-db";

const EMAIL = (process.env.SEED_EMAIL ?? "admin@admin.com").toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD ?? "admin";
const NAME = process.env.SEED_NAME ?? "Admin";

const sqlEscape = (value: string) => value.replace(/'/g, "''");

async function main() {
  const userId = randomUUID();
  const accountId = randomUUID();
  const passwordHash = await hashPassword(PASSWORD);

  const sql = [
    `INSERT OR IGNORE INTO user (id, name, email, email_verified, role)`,
    `  VALUES ('${userId}', '${sqlEscape(NAME)}', '${sqlEscape(EMAIL)}', 1, 'owner');`,
    `UPDATE user SET role = 'owner' WHERE email = '${sqlEscape(EMAIL)}';`,
    `INSERT OR IGNORE INTO account (id, account_id, provider_id, user_id, password)`,
    `  SELECT '${accountId}', u.id, 'credential', u.id, '${sqlEscape(passwordHash)}'`,
    `  FROM user u WHERE u.email = '${sqlEscape(EMAIL)}'`,
    `    AND NOT EXISTS (`,
    `      SELECT 1 FROM account a WHERE a.user_id = u.id AND a.provider_id = 'credential'`,
    `    );`,
  ].join("\n");

  await execSql(sql);

  console.log(`\nSeeded login: ${EMAIL} / ${PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

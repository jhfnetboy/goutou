// Backfill slug for every project that doesn't have one yet.
//
// Usage:  bun run db:slugs:local
//
// Derives slug from the project name (initials for multi-word, first chars
// for single-word) and disambiguates collisions with a numeric suffix.
// Idempotent — projects with an existing slug are skipped.

import { execFileSync } from "node:child_process";

import { deriveSlug, SLUG_MAX_LENGTH } from "../lib/codes";

const sqlEscape = (value: string) => value.replace(/'/g, "''");

type Row = { id: string; name: string };

function runD1Query(query: string): unknown[] {
  const stdout = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "PM_DB",
      "--local",
      "--json",
      `--command=${query}`,
    ],
    { encoding: "utf8" },
  );

  const parsed = JSON.parse(stdout);
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return result?.results ?? [];
}

function disambiguate(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;

  let n = 2;
  while (true) {
    const suffix = String(n);
    const trimmed = base.slice(0, SLUG_MAX_LENGTH - suffix.length);
    const candidate = `${trimmed}${suffix}`;
    if (!taken.has(candidate)) return candidate;
    n += 1;
    if (n > 999) {
      throw new Error(`Could not find unique slug derived from "${base}"`);
    }
  }
}

async function main() {
  const projects = runD1Query(
    "SELECT id, name FROM projects WHERE slug IS NULL ORDER BY created_at;",
  ) as Row[];

  if (projects.length === 0) {
    console.log("No projects need a slug — already backfilled.");
    return;
  }

  const taken = new Set<string>(
    (runD1Query("SELECT slug FROM projects WHERE slug IS NOT NULL;") as {
      slug: string;
    }[]).map((row) => row.slug),
  );

  const updates: string[] = [];
  for (const project of projects) {
    const base = deriveSlug(project.name);
    if (!base) {
      console.warn(`Skipping ${project.id} — no derivable slug from "${project.name}"`);
      continue;
    }
    const slug = disambiguate(base, taken);
    taken.add(slug);
    updates.push(
      `UPDATE projects SET slug = '${sqlEscape(slug)}' WHERE id = '${project.id}';`,
    );
    console.log(`  ${project.name} → ${slug}`);
  }

  if (updates.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "PM_DB",
      "--local",
      `--command=${updates.join("\n")}`,
    ],
    { stdio: "inherit" },
  );

  console.log(`\nBackfilled ${updates.length} project slug(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

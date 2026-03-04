/**
 * apply-migrations-local.mjs
 * Applies all Supabase migrations to the local self-hosted instance
 * via the postgres-meta /pg/query API endpoint.
 *
 * Usage: node scripts/apply-migrations-local.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzIwODI2NDIsImV4cCI6MTkyOTc2MjY0Mn0.p2TH23_L0Y7G5qK4rQo2RiVxk5yvsBncfExPeXqtfo0";
const BASE_URL = "http://192.168.1.19:8000";
const MIGRATIONS_DIR = join(PROJECT_ROOT, "supabase", "migrations");

async function runSQL(sql, filename) {
  const res = await fetch(`${BASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await res.text();

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: true }; // empty / non-JSON success response
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.error) {
    return { ok: false, error: parsed.error };
  }

  return { ok: true };
}

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  const failed = [];
  let success = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
    process.stdout.write(`[${i + 1}/${files.length}] ${filename} ... `);

    const result = await runSQL(sql, filename);

    if (result.ok) {
      console.log("✓");
      success++;
    } else {
      console.log(`✗  ${result.error}`);
      failed.push({ filename, error: result.error });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Result: ${success}/${files.length} migrations applied successfully`);

  if (failed.length > 0) {
    console.log(`\nFailed migrations (${failed.length}):`);
    for (const { filename, error } of failed) {
      console.log(`  ✗ ${filename}`);
      console.log(`    → ${error}`);
    }
    process.exit(1);
  } else {
    console.log("\nAll migrations applied successfully! ✓");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
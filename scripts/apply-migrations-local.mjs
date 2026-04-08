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
const BASE_URL = "http://10.87.0.145:8000";
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

/** Ensure the migration tracking table exists (same schema Supabase CLI uses) */
async function ensureTrackingTable() {
  const sql = `
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      name text,
      applied_at timestamptz DEFAULT now()
    );
  `;
  const result = await runSQL(sql, "_tracking_table_setup");
  if (!result.ok) {
    console.error("Failed to create migration tracking table:", result.error);
    process.exit(1);
  }
}

/** Get set of already-applied migration versions */
async function getAppliedVersions() {
  const sql = `SELECT version FROM supabase_migrations.schema_migrations;`;
  const res = await fetch(`${BASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return new Set();

  try {
    const rows = await res.json();
    if (Array.isArray(rows)) {
      return new Set(rows.map((r) => r.version));
    }
  } catch {}
  return new Set();
}

/** Extract version timestamp from migration filename (e.g. "20260304000001" from "20260304000001_enforce_tenant_id_not_null.sql") */
function extractVersion(filename) {
  const match = filename.match(/^(\d+)/);
  return match ? match[1] : filename;
}

/** Record a successful migration in the tracking table */
async function recordMigration(filename) {
  const version = extractVersion(filename);
  const name = filename.replace(/\.sql$/, "");
  const sql = `
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('${version}', '${name}')
    ON CONFLICT (version) DO NOTHING;
  `;
  await runSQL(sql, "_record_" + filename);
}

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  // Set up tracking table and get already-applied migrations
  await ensureTrackingTable();
  const applied = await getAppliedVersions();
  if (applied.size > 0) {
    console.log(`${applied.size} migrations already tracked in dashboard\n`);
  }

  const failed = [];
  let success = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const version = extractVersion(filename);
    process.stdout.write(`[${i + 1}/${files.length}] ${filename} ... `);

    // Skip already-applied migrations
    if (applied.has(version)) {
      console.log("⊘ already applied");
      skipped++;
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
    const result = await runSQL(sql, filename);

    if (result.ok) {
      await recordMigration(filename);
      console.log("✓");
      success++;
    } else {
      console.log(`✗  ${result.error}`);
      failed.push({ filename, error: result.error });
      // Still record it if the error is "already exists" (migration was applied before tracking)
      if (/already exists/i.test(result.error)) {
        await recordMigration(filename);
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Result: ${success} applied, ${skipped} skipped, ${failed.length} failed (of ${files.length} total)`);

  if (failed.length > 0) {
    console.log(`\nFailed migrations (${failed.length}):`);
    for (const { filename, error } of failed) {
      console.log(`  ✗ ${filename}`);
      console.log(`    → ${error.slice(0, 200)}`);
    }
  }

  if (success > 0 || skipped > 0) {
    console.log("\nMigrations are now tracked in the Supabase dashboard ✓");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
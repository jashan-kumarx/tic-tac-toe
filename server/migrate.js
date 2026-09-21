/**
 * One-shot schema migration for the score API — run by Looper's publish
 * pipeline (runner → DB → "Migration command") before the new version starts,
 * with a pre-migration DB snapshot taken automatically.
 *
 * It uses the same DATABASE_URL wiring as index.js, so a broken binding fails
 * the publish here instead of after cutover. Exits non-zero on any error,
 * which is what aborts the publish.
 */
const { Client } = require("pg");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[ttt-migrate] DATABASE_URL is not set — the migration cannot run.");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    // The table the API reads; created here so a fresh DB is usable at boot.
    await client.query(`CREATE TABLE IF NOT EXISTS scores (
      id        SERIAL PRIMARY KEY,
      winner    TEXT NOT NULL,
      played_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    // Proof-of-run marker: one row per publish, so "did the migration step
    // actually execute?" is answerable with a single SELECT.
    await client.query(`CREATE TABLE IF NOT EXISTS migration_marker (
      id      SERIAL PRIMARY KEY,
      note    TEXT NOT NULL,
      ran_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query(
      "INSERT INTO migration_marker (note) VALUES ($1) RETURNING id, ran_at",
      [process.env.LOOPER_VERSION ? `publish v${process.env.LOOPER_VERSION}` : "publish"]
    );
    console.log(`[ttt-migrate] ok — marker #${rows[0].id} at ${rows[0].ran_at.toISOString()}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[ttt-migrate] failed:", err.message || err);
  process.exit(1);
});

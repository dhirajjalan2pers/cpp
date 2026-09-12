import { config } from "dotenv";
config({ path: ".env.local" });
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../src/lib/db";

async function main() {
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const directory = path.join(process.cwd(), "migrations");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const filename of files) {
    const exists = await pool.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
    if (exists.rowCount) continue;
    const sql = await readFile(path.join(directory, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

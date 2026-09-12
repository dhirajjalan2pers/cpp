import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("Postgres migration and state", () => {
  it("applies the initial migration and persists unified state", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    const schema = `ujb_test_${randomUUID().replaceAll("-", "")}`;
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await client.query(await readFile(path.resolve(process.cwd(), "migrations/001_initial.sql"), "utf8"));
      await client.query("INSERT INTO cpp_jobs(id,title,company_name) VALUES('synthetic','Example role','Example company')");
      await client.query("INSERT INTO job_state(job_source,job_id,starred) VALUES('cpp','synthetic',TRUE)");
      const state = await client.query("SELECT starred,archived,applied FROM job_state WHERE job_id='synthetic'");
      expect(state.rows[0]).toEqual({ starred: true, archived: false, applied: false });
    } finally {
      await client.query("RESET search_path");
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      client.release(); await pool.end();
    }
  });
});


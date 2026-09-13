import { config } from "dotenv";
config({ path: ".env.local" });
import { readFile, writeFile } from "node:fs/promises";
import { decrypt, sha256 } from "../src/lib/crypto";
import { closePool, query, transaction } from "../src/lib/db";
import { listJobs } from "../src/lib/jobs";
import { isReachable } from "../src/lib/eligibility";
import { scoreImportSchema } from "../src/lib/validation";

function usage(): never {
  console.error("Usage: npm run fit -- list-jobs --with-jd [--unscored|--stale] [--reachable]\n       npm run fit -- export-resume --out <path>\n       npm run fit -- import-scores <json-file>");
  process.exit(2);
}

async function list() {
  const args = new Set(process.argv.slice(3));
  if (!args.has("--with-jd")) usage();
  let jobs = await listJobs();
  if (args.has("--unscored")) jobs = jobs.filter((job) => job.fitScore === null);
  if (args.has("--stale")) jobs = jobs.filter((job) => job.fitStale);
  if (args.has("--reachable")) jobs = jobs.filter((job) => isReachable(job)); // skip internships + Europe/USA-only
  console.log(JSON.stringify({ jobs: jobs.filter((job) => !job.archived).map((job) => ({
    jobId: job.id, jobSource: job.source, jobTitle: job.title, companyName: job.companyName,
    description: job.description, currentScore: job.fitScore, stale: job.fitStale,
  })) }, null, 2));
}

async function exportResume() {
  const index = process.argv.indexOf("--out");
  if (index < 0 || !process.argv[index + 1]) usage();
  const rows = await query<{ filename: string; content_encrypted: Buffer; content_sha256: string }>(
    "SELECT filename,content_encrypted,content_sha256 FROM documents WHERE kind='resume' LIMIT 1"
  );
  if (!rows[0]) throw new Error("Upload a resume in the dashboard first");
  const bytes = decrypt(rows[0].content_encrypted);
  await writeFile(process.argv[index + 1], bytes, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ path: process.argv[index + 1], filename: rows[0].filename, sha256: rows[0].content_sha256 }));
}

async function importScores(filename: string | undefined) {
  if (!filename) usage();
  const parsed = scoreImportSchema.parse(JSON.parse(await readFile(filename, "utf8")));
  const resume = await query<{ content_sha256: string }>("SELECT content_sha256 FROM documents WHERE kind='resume' LIMIT 1");
  if (!resume[0]) throw new Error("No current resume");
  const jobs = new Map((await listJobs()).map((job) => [`${job.source}:${job.id}`, job]));
  await transaction(async (client) => {
    for (const incoming of parsed.scores) {
      const job = jobs.get(`${incoming.jobSource}:${incoming.jobId}`);
      if (!job) throw new Error(`Unknown job ${incoming.jobSource}:${incoming.jobId}`);
      if (incoming.fitAnalysis.overallScore !== incoming.score) throw new Error(`Score mismatch for ${incoming.jobId}`);
      await client.query(`INSERT INTO fit_scores(job_source,job_id,score,analysis,resume_hash,job_hash,created_at)
        VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(job_source,job_id) DO UPDATE SET
        score=EXCLUDED.score,analysis=EXCLUDED.analysis,resume_hash=EXCLUDED.resume_hash,
        job_hash=EXCLUDED.job_hash,created_at=now()`, [incoming.jobSource, incoming.jobId, incoming.score,
        incoming.fitAnalysis, resume[0].content_sha256, sha256(job.description)]);
    }
  });
  console.log(`Imported ${parsed.scores.length} fit score(s).`);
}

async function main() {
  const command = process.argv[2];
  if (command === "list-jobs") await list();
  else if (command === "export-resume") await exportResume();
  else if (command === "import-scores") await importScores(process.argv[3]);
  else usage();
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => closePool().catch(() => {}));

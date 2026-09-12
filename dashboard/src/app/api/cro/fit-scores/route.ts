import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ scores: jobs.filter((job) => job.fitScore !== null).map((job) => ({
    jobSource: job.source, jobId: job.id, score: job.fitScore, stale: job.fitStale, analysis: job.fitAnalysis,
  })) });
}


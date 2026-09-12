import { query } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import type { FitAnalysis, Job } from "@/lib/types";

interface JobRow {
  id: string;
  source: "cpp" | "manual";
  title: string;
  company_name: string;
  industry: string;
  location: string;
  contract_type: string;
  application_method: string;
  is_paid: boolean | null;
  url: string;
  description: string;
  deadline: Date | null;
  posted_at: Date | null;
  applicant_count: number;
  active: boolean;
  notes: string | null;
  starred: boolean | null;
  archived: boolean | null;
  applied: boolean | null;
  score: number | null;
  analysis: FitAnalysis | null;
  resume_hash: string | null;
  job_hash: string | null;
  current_resume_hash: string | null;
}

export async function listJobs(): Promise<Job[]> {
  const rows = await query<JobRow>(`
    WITH all_jobs AS (
      SELECT id, 'cpp'::text source, title, company_name, industry, location,
        contract_type, application_method, is_paid, url, description, deadline,
        posted_at, applicant_count, active, NULL::text notes
      FROM cpp_jobs
      UNION ALL
      SELECT id::text, 'manual'::text, title, company_name, industry, location,
        contract_type, application_method, is_paid, url, description, deadline,
        created_at, 0, TRUE, notes
      FROM manual_jobs
    ), resume AS (
      SELECT content_sha256 FROM documents WHERE kind = 'resume' LIMIT 1
    )
    SELECT j.*, s.starred, s.archived, s.applied, f.score, f.analysis,
      f.resume_hash, f.job_hash, (SELECT content_sha256 FROM resume) current_resume_hash
    FROM all_jobs j
    LEFT JOIN job_state s ON s.job_source = j.source AND s.job_id = j.id::text
    LEFT JOIN fit_scores f ON f.job_source = j.source AND f.job_id = j.id::text
    ORDER BY COALESCE(j.deadline, j.posted_at) DESC NULLS LAST, j.title
  `);
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    title: row.title,
    companyName: row.company_name,
    industry: row.industry,
    location: row.location,
    contractType: row.contract_type,
    applicationMethod: row.application_method,
    isPaid: row.is_paid,
    url: row.url,
    description: row.description,
    deadline: row.deadline?.toISOString() ?? null,
    postedAt: row.posted_at?.toISOString() ?? null,
    applicantCount: row.applicant_count,
    active: row.active,
    notes: row.notes ?? undefined,
    starred: row.starred ?? false,
    archived: row.archived ?? false,
    applied: row.applied ?? false,
    fitScore: row.score,
    fitStale: row.score !== null && (
      !row.current_resume_hash || row.resume_hash !== row.current_resume_hash || row.job_hash !== sha256(row.description)
    ),
    fitAnalysis: row.analysis,
  }));
}


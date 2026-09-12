import type { PoolClient } from "pg";
import { decrypt } from "@/lib/crypto";
import { query, transaction } from "@/lib/db";

const API_BASE = "https://lbs.12twenty.com/api/v2/job-postings";
const GPS_BASE = "https://lbs.12twenty.com/api/internal/core-job-postings";
const PAGE_SIZE = 50;

const CONTRACT_TYPES: Record<string, string> = {
  "1180051101468": "Permanent - Full Time",
  "1180051101469": "Permanent - Part Time",
  "1180051101470": "Contract/Consulting",
  "1180051101471": "Internship - Full Time",
  "1180051101472": "Internship - Part Time",
  "1180051101473": "Project",
  "1180051101474": "Volunteer",
};

const INDUSTRIES: Record<string, string> = {
  "11009101010001": "Consulting", "11009101010012": "Consumer Products - FMCG",
  "11009101010014": "Consumer Products - Luxury Goods", "100001010310364": "Education/Training",
  "11009101010019": "Energy - Oil & Gas and Utilities", "11009101010020": "Energy - Renewables",
  "100001010315386": "Executive Search", "11009101010025": "Finance - Commercial Banking/Project Finance",
  "11009101010028": "Finance - Hedge Funds/Alternative investments", "11009101010030": "Finance - Investment Banking/Brokerage",
  "11009101010031": "Finance - Investment Management", "11009101010032": "Finance - Private Equity",
  "11009101010033": "Finance - Private Wealth Management", "11009101010037": "Government / Public Admin",
  "11009101010040": "Healthcare - MedTech/Devices and products", "11009101010041": "Healthcare - Pharma/Biotech",
  "11009101010039": "Healthcare - Providers", "11009101010047": "Industrials - Automotive",
  "11009101010048": "Industrials - Aviation", "11009101010052": "Industrials - Logistics/Shipping/Supply Chain",
  "11009101010053": "Industrials - Manufacturing", "11009101010056": "Infrastructure",
  "11009101010058": "Law / Legal Services", "11009101010043": "Leisure/Travel/Tourism",
  "11009101010067": "Media - Marketing / PR / Advertising", "100001010315388": "Professional Services",
  "11009101010061": "Real Estate - Development", "11009101010060": "Real Estate - Investment",
  "11009101010063": "Retail", "11009101010064": "Social Impact: Development Finance / Impact Investing",
  "11009101010065": "Social Impact: Non-Profit / Social Enterprise / Sustainability", "11009101010066": "Sports",
  "11009101010018": "Tech - ClimateTech", "11009101010068": "Tech - EdTech",
  "11009101010070": "Tech - FinTech", "100001010315026": "Tech - HealthTech",
  "100001010314819": "Tech - Incubators/Accelerators", "11009101010072": "Tech - Information Technology",
  "11009101010073": "Tech - Internet/E-Commerce", "100001010310366": "Venture Capital",
};

export interface NormalizedCppJob {
  id: string;
  title: string;
  companyName: string;
  industry: string;
  location: string;
  contractType: string;
  applicationMethod: string;
  isPaid: boolean | null;
  url: string;
  description: string;
  deadline: string | null;
  postedAt: string | null;
  applicantCount: number;
  hasApplied: boolean;
  externalId: string | null;
  raw: Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function iso(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n").replace(/<li[^>]*>/gi, "- ").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function inferContract(value: string): string | null {
  const lower = value.toLowerCase();
  if (lower.includes("intern")) return lower.includes("part") ? "Internship - Part Time" : "Internship - Full Time";
  if (lower.includes("full time") || lower.includes("full-time")) return "Permanent - Full Time";
  if (lower.includes("part time") || lower.includes("part-time")) return "Permanent - Part Time";
  if (lower.includes("contract") || lower.includes("consult")) return "Contract/Consulting";
  if (lower.includes("project")) return "Project";
  if (lower.includes("volunteer")) return "Volunteer";
  return null;
}

function detailFields(detailValue: unknown) {
  const detail = object(detailValue);
  const attributes = object(detail.CustomAttributeValues);
  const contractCandidates = Object.values(attributes).filter((value): value is string => typeof value === "string");
  let contractType = "Unknown";
  for (const candidate of contractCandidates) {
    const decoded = candidate.split(",").map((id) => CONTRACT_TYPES[id.trim()]).filter(Boolean);
    if (decoded.length) { contractType = decoded.join(", "); break; }
    const inferred = candidate.length <= 100 ? inferContract(candidate) : null;
    if (inferred) { contractType = inferred; break; }
  }
  const ids = [detail.IndustryId, ...(Array.isArray(detail.IndustryIds) ? detail.IndustryIds : [])].filter((id) => id != null).map(String);
  const namedIndustries = Array.isArray(detail.Industries)
    ? detail.Industries.map((item) => text(object(item).Name)).filter(Boolean) : [];
  const industry = ids.map((id) => INDUSTRIES[id]).filter(Boolean).join(", ") || namedIndustries.join(", ")
    || text(detail.IndustryName) || text(detail.IndustryGroupName);
  const methods = [
    bool(detail.ShouldApplyViaSite) && "CPP", bool(detail.ShouldApplyViaEmail) && "Email",
    bool(detail.ShouldApplyExternally) && "External", bool(detail.ShouldApplyViaFax) && "Fax",
    bool(detail.ShouldApplyViaMail) && "Mail",
  ].filter((value): value is string => Boolean(value));
  const paidRaw = attributes.custom_attribute_10888805110582;
  return {
    contractType,
    industry,
    applicationMethod: methods.join(", "),
    isPaid: paidRaw === "True" ? true : paidRaw === "False" ? false : null,
    description: stripHtml(text(detail.Description)),
    hasApplied: bool(detail.IsApplied),
  };
}

export function normalizeListItem(value: unknown): NormalizedCppJob {
  const item = object(value);
  const id = text(item.Id);
  return {
    id,
    title: text(item.JobTitle) || text(item.TitleDisplay) || "Untitled",
    companyName: text(item.CompanyName, "Unknown"),
    industry: "", location: text(item.LocationDisplay, "Not specified"), contractType: "Unknown",
    applicationMethod: "", isPaid: null,
    url: `https://lbs.12twenty.com/jobPostings#/jobPostings/${id}`,
    description: "", deadline: iso(item.ApplicationDeadlineDate),
    postedAt: iso(item.PostedDate) ?? iso(item.CreateDate),
    applicantCount: Number(item.NumApplicants ?? 0), hasApplied: bool(item.IsApplied),
    externalId: item.ExternalJobPostingSourceId == null ? null : text(item.ExternalJobPostingSourceId), raw: item,
  };
}

export async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, { ...init, cache: "no-store" });
    if (response.ok) return response;
    if (response.status !== 429 && response.status < 500) throw new Error(`CPP returned HTTP ${response.status}`);
    if (attempt === attempts) throw new Error(`CPP returned HTTP ${response.status} after ${attempts} attempts`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
  }
  throw new Error("CPP retry loop exhausted");
}

async function mapLimit<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return result;
}

async function loadCookie(): Promise<string> {
  const rows = await query<{ cookie_encrypted: Buffer; expires_at: Date | null }>(
    "SELECT cookie_encrypted, expires_at FROM cpp_session WHERE singleton = TRUE"
  );
  const session = rows[0];
  if (!session) throw new Error("No CPP session. Sync the browser extension first.");
  if (session.expires_at && session.expires_at < new Date()) throw new Error("CPP session expired. Sign in and sync again.");
  return decrypt(session.cookie_encrypted).toString("utf8");
}

export async function fetchCppJobs(): Promise<NormalizedCppJob[]> {
  const cookie = await loadCookie();
  const headers = { Cookie: cookie, Accept: "application/json" };
  const jobs: NormalizedCppJob[] = [];
  let page = 1;
  let pages = 1;
  do {
    const response = await fetchWithRetry(`${API_BASE}?statusId=4&pageSize=${PAGE_SIZE}&pageNumber=${page}`, { headers });
    const payload = object(await response.json());
    pages = Math.max(1, Number(payload.NumberOfPages ?? 1));
    if (Array.isArray(payload.Items)) jobs.push(...payload.Items.map(normalizeListItem));
    page += 1;
  } while (page <= pages);

  const detailed = await mapLimit(jobs, 5, async (job) => {
    let fields = detailFields({});
    try {
      const response = await fetchWithRetry(`${API_BASE}/${encodeURIComponent(job.id)}`, { headers });
      fields = detailFields(await response.json());
    } catch { /* Preserve the list item if a detail endpoint is unavailable. */ }
    let contractType = fields.contractType;
    if (contractType === "Unknown" && job.externalId) {
      try {
        const response = await fetchWithRetry(`${GPS_BASE}/${encodeURIComponent(job.externalId)}`, { headers });
        const gps = object(await response.json());
        contractType = inferContract(text(gps.JobTypeName)) ?? text(gps.JobTypeName, "Unknown");
      } catch { /* GPS fallback is optional. */ }
    }
    return { ...job, ...fields, contractType, hasApplied: job.hasApplied || fields.hasApplied };
  });
  return detailed;
}

async function upsert(client: PoolClient, job: NormalizedCppJob) {
  await client.query(`INSERT INTO cpp_jobs (
    id, title, company_name, industry, location, contract_type, application_method, is_paid,
    url, description, deadline, posted_at, applicant_count, raw, active, last_seen_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE,now())
  ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, company_name=EXCLUDED.company_name,
    industry=EXCLUDED.industry, location=EXCLUDED.location, contract_type=EXCLUDED.contract_type,
    application_method=EXCLUDED.application_method, is_paid=EXCLUDED.is_paid, url=EXCLUDED.url,
    description=CASE WHEN EXCLUDED.description='' THEN cpp_jobs.description ELSE EXCLUDED.description END,
    deadline=EXCLUDED.deadline, posted_at=EXCLUDED.posted_at, applicant_count=EXCLUDED.applicant_count,
    raw=EXCLUDED.raw, active=TRUE, last_seen_at=now()`, [
    job.id, job.title, job.companyName, job.industry, job.location, job.contractType,
    job.applicationMethod, job.isPaid, job.url, job.description, job.deadline, job.postedAt,
    job.applicantCount, job.raw,
  ]);
  if (job.hasApplied) await client.query(`INSERT INTO job_state(job_source, job_id, applied)
    VALUES ('cpp',$1,TRUE) ON CONFLICT(job_source,job_id) DO UPDATE SET applied=TRUE, updated_at=now()`, [job.id]);
}

export async function refreshCppJobs(): Promise<number> {
  const jobs = await fetchCppJobs();
  await transaction(async (client) => {
    await client.query("UPDATE cpp_jobs SET active = FALSE");
    for (const job of jobs) await upsert(client, job);
  });
  return jobs.length;
}


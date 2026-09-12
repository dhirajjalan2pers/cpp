"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Job } from "@/lib/types";
import AppHeader from "./AppHeader";
import ManualJobForm from "./ManualJobForm";

interface Session { hasSession: boolean; expiresAt: string | null; updatedAt: string | null; expired: boolean }
type Sort = "deadline" | "newest" | "fit" | "company";

export default function JobsDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]); const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); const [message, setMessage] = useState(""); const [search, setSearch] = useState("");
  const [contract, setContract] = useState(""); const [industry, setIndustry] = useState(""); const [method, setMethod] = useState("");
  const [paid, setPaid] = useState(""); const [showPermanent, setShowPermanent] = useState(true); const [showArchived, setShowArchived] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false); const [appliedOnly, setAppliedOnly] = useState(false); const [sort, setSort] = useState<Sort>("deadline");
  const [editing, setEditing] = useState<Job | "new" | null>(null); const [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); const response = await fetch("/api/cpp/jobs", { cache: "no-store" }); const body = await response.json(); if (response.ok) { setJobs(body.jobs); setSession(body.session); } else setMessage(body.error); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  async function refresh() { setRefreshing(true); setMessage(""); const response = await fetch("/api/cpp/jobs/refresh", { method: "POST" }); const body = await response.json(); setMessage(response.ok ? `Refreshed ${body.refreshed} active CPP jobs.` : body.error); if (response.ok) await load(); setRefreshing(false); }
  async function state(job: Job, field: "starred" | "archived" | "applied") { await fetch("/api/jobs/state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobSource: job.source, jobId: job.id, [field]: !job[field] }) }); await load(); }
  async function remove(job: Job) { if (!confirm("Delete this manual job?")) return; await fetch(`/api/jobs/manual/${job.id}`, { method: "DELETE" }); await load(); }
  const values = (field: keyof Job) => [...new Set(jobs.map((job) => String(job[field] ?? "")).filter(Boolean))].sort();
  const filtered = useMemo(() => jobs.filter((job) => {
    const haystack = `${job.title} ${job.companyName} ${job.location} ${job.industry} ${job.description}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (!contract || job.contractType === contract) && (!industry || job.industry === industry)
      && (!method || job.applicationMethod.includes(method)) && (!paid || (paid === "paid" ? job.isPaid === true : paid === "unpaid" ? job.isPaid === false : job.isPaid === null))
      && (showPermanent || !job.contractType.toLowerCase().includes("permanent")) && (showArchived ? job.archived : !job.archived)
      && (!starredOnly || job.starred) && (!appliedOnly || job.applied);
  }).sort((a, b) => sort === "fit" ? (b.fitScore ?? -1) - (a.fitScore ?? -1) : sort === "company" ? a.companyName.localeCompare(b.companyName)
    : sort === "newest" ? Date.parse(b.postedAt ?? "0") - Date.parse(a.postedAt ?? "0") : Date.parse(a.deadline ?? "9999-12-31") - Date.parse(b.deadline ?? "9999-12-31")),
    [jobs, search, contract, industry, method, paid, showPermanent, showArchived, starredOnly, appliedOnly, sort]);
  return <><AppHeader/><main className="page"><div className="page-heading"><div><div className="eyebrow">LBS CAREER PORTAL PLUS</div><h1>Universal Jobs Board</h1><p>{jobs.length} saved jobs · {jobs.filter((job) => job.starred).length} starred · {jobs.filter((job) => job.applied).length} applied</p></div><div className="heading-actions"><button className="button" onClick={() => setEditing("new")}>+ Add job</button><button className="primary" disabled={refreshing || !session?.hasSession || session.expired} onClick={refresh}>{refreshing ? "Refreshing…" : "Refresh CPP"}</button></div></div>
    <div className={`session ${session?.hasSession && !session.expired ? "ok" : "warning"}`}>{!session?.hasSession ? "No CPP session. Configure and sync the extension." : session.expired ? "CPP session expired. Sign in to CPP and sync the extension again." : `CPP session synced${session.expiresAt ? ` · expires ${new Date(session.expiresAt).toLocaleString()}` : ""}`}</div>
    {message && <div className="alert">{message}</div>}
    <section className="filters panel"><input className="search" placeholder="Search roles, companies, industries…" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={contract} onChange={(e) => setContract(e.target.value)}><option value="">All contracts</option>{values("contractType").map((v) => <option key={v}>{v}</option>)}</select><select value={industry} onChange={(e) => setIndustry(e.target.value)}><option value="">All industries</option>{values("industry").map((v) => <option key={v}>{v}</option>)}</select><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All methods</option>{[...new Set(jobs.flatMap((j) => j.applicationMethod.split(", ")).filter(Boolean))].sort().map((v) => <option key={v}>{v}</option>)}</select><select value={paid} onChange={(e) => setPaid(e.target.value)}><option value="">Any pay</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="unknown">Not specified</option></select><select value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="deadline">Deadline</option><option value="newest">Newest</option><option value="fit">Fit score</option><option value="company">Company</option></select>
      <div className="filter-toggles"><label><input type="checkbox" checked={showPermanent} onChange={(e) => setShowPermanent(e.target.checked)} /> Permanent</label><label><input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} /> Starred</label><label><input type="checkbox" checked={appliedOnly} onChange={(e) => setAppliedOnly(e.target.checked)} /> Applied</label><label><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived only</label></div>
    </section>
    {loading ? <div className="empty">Loading jobs…</div> : <section className="jobs-grid">{filtered.map((job) => <article className={`job-card panel ${job.applied ? "applied" : ""}`} key={`${job.source}:${job.id}`}><div className="job-top"><div><div className="badges"><span>{job.source === "cpp" ? "CPP" : "MANUAL"}</span>{!job.active && <span className="muted-badge">INACTIVE</span>}{job.fitStale && <span className="stale-badge">SCORE STALE</span>}</div><h2>{job.url ? <a href={job.url} target="_blank" rel="noreferrer">{job.title}</a> : job.title}</h2><h3>{job.companyName}</h3></div><button className={`star ${job.starred ? "on" : ""}`} title="Star" onClick={() => state(job, "starred")}>★</button></div>
      <div className="job-meta"><span>{job.location || "Location not specified"}</span><span>{job.contractType || "Contract not specified"}</span>{job.industry && <span>{job.industry}</span>}</div>
      <div className="job-facts"><span><b>Deadline</b>{job.deadline ? new Date(job.deadline).toLocaleDateString("en-GB") : "—"}</span><span><b>Apply via</b>{job.applicationMethod || "—"}</span><span><b>Pay</b>{job.isPaid === true ? "Paid" : job.isPaid === false ? "Unpaid" : "—"}</span><span><b>Fit</b>{job.fitScore === null ? "Not scored" : `${job.fitScore}/100`}</span></div>
      {(job.description || job.fitAnalysis) && <button className="details-toggle" onClick={() => setExpanded(expanded === `${job.source}:${job.id}` ? null : `${job.source}:${job.id}`)}>{expanded === `${job.source}:${job.id}` ? "Hide details" : "View details"}</button>}
      {expanded === `${job.source}:${job.id}` && <div className="job-details">{job.description && <><h4>Job description</h4><p className="preline">{job.description}</p></>}{job.fitAnalysis && <><h4>Fit analysis</h4><p><b>Strengths:</b> {job.fitAnalysis.strengths.join(" · ") || "—"}</p><p><b>Gaps:</b> {job.fitAnalysis.gaps.join(" · ") || "—"}</p></>}</div>}
      <div className="job-actions"><button className={job.applied ? "success" : "button"} onClick={() => state(job, "applied")}>{job.applied ? "Applied ✓" : "Mark applied"}</button><button className="button" onClick={() => state(job, "archived")}>{job.archived ? "Restore" : "Archive"}</button>{job.source === "manual" && <><button className="button" onClick={() => setEditing(job)}>Edit</button><button className="danger" onClick={() => remove(job)}>Delete</button></>}</div>
    </article>)}</section>}
    {!loading && !filtered.length && <div className="empty">No jobs match these filters.</div>}
  </main>{editing && <ManualJobForm job={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onDone={async () => { setEditing(null); await load(); }} />}</>;
}


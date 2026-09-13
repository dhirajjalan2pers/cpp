"use client";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { Job } from "@/lib/types";
import { isReachable } from "@/lib/eligibility";
import AppHeader from "./AppHeader";
import ManualJobForm from "./ManualJobForm";

interface Session { hasSession: boolean; expiresAt: string | null; updatedAt: string | null; expired: boolean }
type SortKey = "fit" | "title" | "company" | "contract" | "method" | "location" | "deadline" | "posted" | "applied";

const IND_COLORS = ["ind-yellow", "ind-teal", "ind-coral", "ind-rose", "ind-blue", "ind-violet", "ind-orange", "ind-mint"];
function indColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return IND_COLORS[h % IND_COLORS.length];
}

function relPosted(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (Number.isNaN(days)) return "—";
  return days <= 0 ? "today" : `${days}d ago`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function deadlineCell(iso: string | null) {
  if (!iso) return <span className="muted">—</span>;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return <span className="muted">—</span>;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  const date = new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (days < 0) return <span className="muted" title={date}>Closed</span>;
  const label = days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} left`;
  return <span className={days <= 7 ? "dl-soon" : undefined} title={date}>{label}</span>;
}
function since(iso: string | null): string {
  if (!iso) return "";
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (Number.isNaN(m) || m < 0) return "";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
function until(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.parse(iso) - Date.now()) / 60000);
  if (Number.isNaN(mins) || mins <= 0) return "expired";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h >= 1 ? `${h}h ${m}m` : `${m}m`;
}

export default function JobsDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]); const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); const [message, setMessage] = useState("");
  const [search, setSearch] = useState(""); const [contract, setContract] = useState(""); const [method, setMethod] = useState(""); const [location, setLocation] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false); const [showApplied, setShowApplied] = useState(false);
  const [triage, setTriage] = useState(true); const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "fit", d: -1 });
  const [editing, setEditing] = useState<Job | "new" | null>(null); const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Job[]> => {
    setLoading(true);
    const r = await fetch("/api/cpp/jobs", { cache: "no-store" });
    const b = await r.json();
    if (r.ok) { setJobs(b.jobs); setSession(b.session); } else setMessage(b.error);
    setLoading(false);
    return r.ok ? (b.jobs as Job[]) : [];
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function refresh() {
    setRefreshing(true); setMessage("");
    const r = await fetch("/api/cpp/jobs/refresh", { method: "POST" });
    const b = await r.json();
    if (r.ok) {
      const list = await load();
      const n = list.filter((j) => j.isNew).length; // server-derived: arrived in this refresh
      setMessage(`Refreshed ${b.refreshed} active CPP jobs${n ? ` · ${n} new` : ""}.`);
    } else setMessage(b.error);
    setRefreshing(false);
  }
  async function setState(job: Job, field: "starred" | "archived" | "applied") { await fetch("/api/jobs/state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobSource: job.source, jobId: job.id, [field]: !job[field] }) }); await load(); }
  async function remove(job: Job) { if (!confirm("Delete this manual job?")) return; await fetch(`/api/jobs/manual/${job.id}`, { method: "DELETE" }); await load(); }

  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
  const eligible = useMemo(() => jobs.filter((j) => isReachable(j)), [jobs]);
  const contractOpts = useMemo(() => uniq(eligible.map((j) => j.contractType)), [eligible]);
  const methodOpts = useMemo(() => uniq(eligible.flatMap((j) => j.applicationMethod.split(", "))), [eligible]);
  const locationOpts = useMemo(() => uniq(eligible.map((j) => j.location)), [eligible]);
  const activeCount = useMemo(() => eligible.filter((j) => !j.archived).length, [eligible]);
  const scoredCount = useMemo(() => eligible.filter((j) => j.fitScore !== null).length, [eligible]);

  const filtered = useMemo(() => eligible.filter((job) => {
    const hay = `${job.title} ${job.companyName} ${job.location} ${job.industry} ${job.description}`.toLowerCase();
    return (!search || hay.includes(search.toLowerCase())) && (!contract || job.contractType === contract)
      && (!method || job.applicationMethod.includes(method)) && (!location || job.location === location)
      && (showArchived ? job.archived : !job.archived) && (!starredOnly || job.starred)
      && (!showApplied || job.applied);
  }).sort((a, b) => {
    const k = sort.k, d = sort.d;
    const cmp = k === "fit" ? (a.fitScore ?? -1) - (b.fitScore ?? -1)
      : k === "title" ? a.title.localeCompare(b.title) : k === "company" ? a.companyName.localeCompare(b.companyName)
      : k === "contract" ? a.contractType.localeCompare(b.contractType) : k === "method" ? a.applicationMethod.localeCompare(b.applicationMethod)
      : k === "location" ? a.location.localeCompare(b.location) : k === "applied" ? Number(a.applied) - Number(b.applied)
      : k === "posted" ? Date.parse(a.postedAt ?? "0") - Date.parse(b.postedAt ?? "0")
      : Date.parse(a.deadline ?? "9999-12-31") - Date.parse(b.deadline ?? "9999-12-31");
    return cmp * d;
  }), [eligible, search, contract, method, location, showArchived, starredOnly, showApplied, sort]);

  function sortBy(k: SortKey, defaultDir: 1 | -1 = 1) { setTriage(k === "fit"); setSort((s) => s.k === k ? { k, d: (s.d === 1 ? -1 : 1) } : { k, d: defaultDir }); }
  const arrow = (k: SortKey) => sort.k === k ? (sort.d === 1 ? " ↑" : " ↓") : "";
  const th = (k: SortKey, label: string, dir: 1 | -1 = 1) => <th className={sort.k === k ? "sorted" : ""} onClick={() => sortBy(k, dir)}>{label}<span className="ar">{arrow(k) || " ↕"}</span></th>;

  const sub = session
    ? `Active postings from LBS Career & Professional Development${session.updatedAt ? ` · Last updated ${since(session.updatedAt)}` : ""}${session.expiresAt && !session.expired ? ` · Session expires in ${until(session.expiresAt)}` : session.expired ? " · Session expired" : ""}`
    : "Active postings from LBS Career & Professional Development";

  return <><AppHeader />
    <main className="page"><div className="board">
      <div className="page-heading">
        <div><h1>Universal Jobs Board</h1><p className="sub">{sub}</p></div>
        <div className="heading-actions">
          <button className="button" onClick={() => setEditing("new")}>+ Add Job</button>
          <a className="button" href="https://lbs.12twenty.com" target="_blank" rel="noreferrer">12twenty Session</a>
          <button className="primary" disabled={refreshing || !session?.hasSession || session.expired} onClick={refresh}>{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      {(!session?.hasSession || session.expired) && <div className="session warning">{!session?.hasSession ? "No CPP session — configure and sync the extension." : "CPP session expired — sign in to CPP and sync the extension again."}</div>}
      {message && <div className="alert">{message}</div>}

      <div className="toolbar">
        <input className="search" placeholder="Search title, company, location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={contract} onChange={(e) => setContract(e.target.value)}><option value="">All Contract Types</option>{contractOpts.map((v) => <option key={v}>{v}</option>)}</select>
        <select value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All Methods</option>{methodOpts.map((v) => <option key={v}>{v}</option>)}</select>
        <select value={location} onChange={(e) => setLocation(e.target.value)}><option value="">All Locations</option>{locationOpts.map((v) => <option key={v}>{v}</option>)}</select>
        <button className={`seg ${triage ? "on" : ""}`} onClick={() => sortBy("fit", -1)}>Triage</button>
        <button className={`seg ${showApplied ? "on" : ""}`} onClick={() => setShowApplied((v) => !v)}>Show Applied</button>
        <button className={`seg ${starredOnly ? "on" : ""}`} onClick={() => setStarredOnly((v) => !v)}>★ Only</button>
        <button className={`seg ${showArchived ? "on" : ""}`} onClick={() => setShowArchived((v) => !v)}>Show Archived</button>
        <span className="count-note">Showing {filtered.length} of {activeCount} active jobs</span>
      </div>

      {loading ? <div className="empty">Loading jobs…</div> : <div className="tbl-wrap"><table className="tbl">
        <thead><tr>
          <th className="col-star" />
          <th className={sort.k === "fit" ? "sorted" : ""} onClick={() => sortBy("fit", -1)}>Fit{scoredCount ? <span className="src" style={{ marginLeft: 4 }}>{scoredCount}</span> : null}<span className="ar">{arrow("fit") || " ↕"}</span></th>
          {th("applied", "Applied", -1)}
          {th("title", "Title")}
          {th("company", "Company")}
          <th>Industry</th>
          {th("method", "Method")}
          {th("location", "Location")}
          {th("deadline", "Deadline")}
          {th("posted", "Posted", -1)}
        </tr></thead>
        <tbody>{filtered.map((job) => {
          const key = `${job.source}:${job.id}`; const open = expanded === key;
          const methods = job.applicationMethod.split(", ").filter(Boolean);
          const tier = job.fitScore == null ? "none" : job.fitScore >= 75 ? "hi" : job.fitScore >= 60 ? "mid" : "lo";
          const shade = job.fitScore != null && job.fitScore >= 70;
          return <Fragment key={key}>
            <tr className={shade ? "hi" : ""} onClick={() => setExpanded(open ? null : key)} style={{ cursor: "pointer" }}>
              <td className="col-star" onClick={(e) => { e.stopPropagation(); void setState(job, "starred"); }}><span className={`star ${job.starred ? "on" : ""}`}>{job.starred ? "★" : "☆"}</span></td>
              <td><span className={`fit ${tier}`}>{job.fitScore == null ? "—" : (job.fitScore / 10).toFixed(1)}{job.fitStale && <span className="stale" title="Score stale" />}</span></td>
              <td>{job.applied ? <span style={{ color: "var(--success)", fontWeight: 600 }}>Yes</span> : <span className="muted">No</span>}</td>
              <td className="t-title">{job.isNew && <span className="new-badge">NEW</span>}{job.url ? <a href={job.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{job.title}</a> : <span className="mock">{job.title}</span>}{job.source === "manual" && <span className="src">MANUAL</span>}{!job.active && <span className="src">INACTIVE</span>}</td>
              <td className="t-co">{job.companyName}</td>
              <td>{(() => { const parts = job.industry.split(",").map((s) => s.trim()).filter(Boolean); if (!parts.length) return <span className="muted">—</span>; return <><span className={`pill ${indColor(parts[0])}`}>{parts[0]}</span>{parts.length > 1 && <span className="pill more" title={parts.slice(1).join(", ")}>+{parts.length - 1}</span>}</>; })()}</td>
              <td>{methods.length ? methods.map((m) => m.toUpperCase() === "CPP" ? <span key={m} className="pill">CPP</span> : <span key={m} className="muted">{m}</span>) : <span className="muted">—</span>}</td>
              <td className="t-loc">{job.location || <span className="muted">Not specified</span>}</td>
              <td>{deadlineCell(job.deadline)}</td>
              <td className="muted">{relPosted(job.postedAt)}</td>
            </tr>
            {open && <tr className="expand-row"><td colSpan={10}><div className="expand">
              <div className="sticky st-blue details">
                <h4>Career Portal details</h4>
                <div className="kv">
                  <div><span>Contract</span><b>{job.contractType || "—"}</b></div>
                  <div><span>Apply via</span><b>{job.applicationMethod || "—"}</b></div>
                  <div><span>Paid</span><b>{job.isPaid === true ? "Yes" : job.isPaid === false ? "No" : "—"}</b></div>
                  <div><span>Applicants</span><b>{job.applicantCount}</b></div>
                  <div><span>Applied</span><b>{job.applied ? "Yes" : "No"}</b></div>
                  <div><span>Posted</span><b>{fmtDate(job.postedAt)}</b></div>
                  <div><span>Deadline</span><b>{fmtDate(job.deadline)}</b></div>
                  <div><span>Location</span><b>{job.location || "—"}</b></div>
                  <div><span>Industry</span><b>{job.industry || "—"}</b></div>
                  <div><span>Source</span><b>{job.source === "cpp" ? "CPP (12twenty)" : "Manual"}</b></div>
                  <div><span>Status</span><b>{job.active ? "Active" : "Inactive"}{job.isNew ? " · New" : ""}</b></div>
                  <div><span>Fit score</span><b>{job.fitScore == null ? "Not scored" : `${(job.fitScore / 10).toFixed(1)} / 10${job.fitStale ? " (stale)" : ""}`}</b></div>
                </div>
                {job.url && <a className="button" href={job.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open on 12twenty ↗</a>}
              </div>
              {job.description && <div className="sticky st-yellow"><h4>Job description</h4><div className="body">{job.description}</div></div>}
              {job.fitAnalysis && <div className="cols2">
                <div className="sticky st-teal"><h4>Strengths</h4><div className="body">{job.fitAnalysis.strengths.join(" · ") || "—"}</div></div>
                <div className="sticky st-coral"><h4>Gaps</h4><div className="body">{job.fitAnalysis.gaps.join(" · ") || "—"}</div></div>
              </div>}
              {job.fitAnalysis && job.fitAnalysis.resumeRecommendations.length > 0 && <div className="sticky st-rose"><h4>Résumé tweaks</h4><div className="body">{job.fitAnalysis.resumeRecommendations.map((r) => `${r.section}: ${r.after}`).join(" · ")}</div></div>}
              <div className="row-actions">
                <button className={job.applied ? "success" : "button"} onClick={(e) => { e.stopPropagation(); void setState(job, "applied"); }}>{job.applied ? "Applied ✓" : "Mark applied"}</button>
                <button className="button" onClick={(e) => { e.stopPropagation(); void setState(job, "archived"); }}>{job.archived ? "Restore" : "Archive"}</button>
                {job.source === "manual" && <><button className="button" onClick={(e) => { e.stopPropagation(); setEditing(job); }}>Edit</button><button className="danger" onClick={(e) => { e.stopPropagation(); void remove(job); }}>Delete</button></>}
              </div>
            </div></td></tr>}
          </Fragment>;
        })}</tbody>
      </table></div>}
      {!loading && !filtered.length && <div className="empty">No jobs match these filters.</div>}
    </div></main>
    {editing && <ManualJobForm job={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onDone={async () => { setEditing(null); await load(); }} />}
  </>;
}

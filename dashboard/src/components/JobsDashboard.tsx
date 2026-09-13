"use client";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { Job } from "@/lib/types";
import AppHeader from "./AppHeader";
import ManualJobForm from "./ManualJobForm";

interface Session { hasSession: boolean; expiresAt: string | null; updatedAt: string | null; expired: boolean }
type SortKey = "fit" | "title" | "company" | "contract" | "method" | "location" | "deadline" | "posted" | "applied";

const PILL = ["p-blue", "p-green", "p-purple", "p-amber", "p-slate"];
const pc = (s: string) => PILL[[...(s || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % PILL.length];

function relPosted(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (Number.isNaN(days)) return "—";
  return days <= 0 ? "today" : `${days}d ago`;
}
function deadlineCell(iso: string | null) {
  if (!iso) return <span className="muted">—</span>;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return <span className="muted">—</span>;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  if (days >= 0 && days <= 7) return <span className="dl-soon">{days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}</span>;
  return <span>{new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>;
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
  const [hidePermanent, setHidePermanent] = useState(false); const [showArchived, setShowArchived] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false); const [showApplied, setShowApplied] = useState(false); const [showUnpaid, setShowUnpaid] = useState(true);
  const [triage, setTriage] = useState(true); const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "fit", d: -1 });
  const [editing, setEditing] = useState<Job | "new" | null>(null); const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/cpp/jobs", { cache: "no-store" }); const b = await r.json(); if (r.ok) { setJobs(b.jobs); setSession(b.session); } else setMessage(b.error); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  async function refresh() { setRefreshing(true); setMessage(""); const r = await fetch("/api/cpp/jobs/refresh", { method: "POST" }); const b = await r.json(); setMessage(r.ok ? `Refreshed ${b.refreshed} active CPP jobs.` : b.error); if (r.ok) await load(); setRefreshing(false); }
  async function setState(job: Job, field: "starred" | "archived" | "applied") { await fetch("/api/jobs/state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobSource: job.source, jobId: job.id, [field]: !job[field] }) }); await load(); }
  async function remove(job: Job) { if (!confirm("Delete this manual job?")) return; await fetch(`/api/jobs/manual/${job.id}`, { method: "DELETE" }); await load(); }

  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
  const contractOpts = useMemo(() => uniq(jobs.map((j) => j.contractType)), [jobs]);
  const methodOpts = useMemo(() => uniq(jobs.flatMap((j) => j.applicationMethod.split(", "))), [jobs]);
  const locationOpts = useMemo(() => uniq(jobs.map((j) => j.location)), [jobs]);
  const activeCount = useMemo(() => jobs.filter((j) => !j.archived).length, [jobs]);
  const scoredCount = useMemo(() => jobs.filter((j) => j.fitScore !== null).length, [jobs]);

  const filtered = useMemo(() => jobs.filter((job) => {
    const hay = `${job.title} ${job.companyName} ${job.location} ${job.industry} ${job.description}`.toLowerCase();
    return (!search || hay.includes(search.toLowerCase())) && (!contract || job.contractType === contract)
      && (!method || job.applicationMethod.includes(method)) && (!location || job.location === location)
      && (!hidePermanent || !job.contractType.toLowerCase().includes("permanent"))
      && (showArchived ? job.archived : !job.archived) && (!starredOnly || job.starred)
      && (!showApplied || job.applied) && (showUnpaid || job.isPaid !== false);
  }).sort((a, b) => {
    const k = sort.k, d = sort.d;
    const cmp = k === "fit" ? (a.fitScore ?? -1) - (b.fitScore ?? -1)
      : k === "title" ? a.title.localeCompare(b.title) : k === "company" ? a.companyName.localeCompare(b.companyName)
      : k === "contract" ? a.contractType.localeCompare(b.contractType) : k === "method" ? a.applicationMethod.localeCompare(b.applicationMethod)
      : k === "location" ? a.location.localeCompare(b.location) : k === "applied" ? Number(a.applied) - Number(b.applied)
      : k === "posted" ? Date.parse(a.postedAt ?? "0") - Date.parse(b.postedAt ?? "0")
      : Date.parse(a.deadline ?? "9999-12-31") - Date.parse(b.deadline ?? "9999-12-31");
    return cmp * d;
  }), [jobs, search, contract, method, location, hidePermanent, showArchived, starredOnly, showApplied, showUnpaid, sort]);

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
        <button className={`seg ${showApplied ? "on plain" : ""}`} onClick={() => setShowApplied((v) => !v)}>Show Applied</button>
        <button className={`seg ${hidePermanent ? "on plain" : ""}`} onClick={() => setHidePermanent((v) => !v)}>Hide Permanent Roles</button>
        <button className={`seg ${!showUnpaid ? "on plain" : ""}`} onClick={() => setShowUnpaid((v) => !v)}>{showUnpaid ? "Hide Unpaid" : "Unpaid hidden"}</button>
        <button className={`seg ${starredOnly ? "on plain" : ""}`} onClick={() => setStarredOnly((v) => !v)}>★ Only</button>
        <button className={`seg ${showArchived ? "on plain" : ""}`} onClick={() => setShowArchived((v) => !v)}>Show Archived</button>
        <span className="count-note">Showing {filtered.length} of {activeCount} active jobs</span>
      </div>

      {loading ? <div className="empty">Loading jobs…</div> : <div className="tbl-wrap"><table className="tbl">
        <thead><tr>
          <th className="col-star" />
          <th className={sort.k === "fit" ? "sorted" : ""} onClick={() => sortBy("fit", -1)}>Fit{scoredCount ? <span className="src" style={{ marginLeft: 4 }}>{scoredCount}</span> : null}<span className="ar">{arrow("fit") || " ↕"}</span></th>
          <th>Eligibility</th>
          {th("applied", "Applied", -1)}
          {th("title", "Title")}
          {th("company", "Company")}
          <th>Industry</th>
          {th("contract", "Contract Type")}
          <th>Docs</th>
          {th("method", "Method")}
          {th("location", "Location")}
          {th("deadline", "Deadline")}
          {th("posted", "Posted", -1)}
        </tr></thead>
        <tbody>{filtered.map((job) => {
          const key = `${job.source}:${job.id}`; const open = expanded === key;
          const methods = job.applicationMethod.split(", ").filter(Boolean);
          return <Fragment key={key}>
            <tr className={job.applied ? "applied-row" : ""} onClick={() => setExpanded(open ? null : key)} style={{ cursor: "pointer" }}>
              <td className="col-star" onClick={(e) => { e.stopPropagation(); void setState(job, "starred"); }}><span className={`star ${job.starred ? "on" : ""}`}>{job.starred ? "★" : "☆"}</span></td>
              <td>{job.fitScore === null ? <span className="fit none">—</span> : <span className="fit">{(job.fitScore / 10).toFixed(1)}{job.fitStale && <span className="stale" title="Score stale" />}</span>}</td>
              <td><span className="elig verify">? Verify</span></td>
              <td className="muted">{job.applied ? "Yes" : "No"}</td>
              <td className="t-title">{job.url ? <a href={job.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{job.title}</a> : <span className="mock">{job.title}</span>}{job.source === "manual" && <span className="src">MANUAL</span>}{!job.active && <span className="src">INACTIVE</span>}</td>
              <td className="t-co">{job.companyName}</td>
              <td>{job.industry ? <span className={`pill ${pc(job.industry)}`}>{job.industry}</span> : <span className="muted">—</span>}</td>
              <td>{job.contractType ? <span className={`pill ${pc(job.contractType)}`}>{job.contractType}</span> : <span className="muted">—</span>}</td>
              <td><span className="pill p-green">CV</span></td>
              <td>{methods.length ? methods.map((m) => m.toUpperCase() === "CPP" ? <span key={m} className="pill p-purple">CPP</span> : <span key={m} className="muted">{m}</span>) : <span className="muted">—</span>}</td>
              <td className="t-loc">{job.location || <span className="muted">Not specified</span>}</td>
              <td>{deadlineCell(job.deadline)}</td>
              <td className="muted">{relPosted(job.postedAt)}</td>
            </tr>
            {open && <tr className="expand-row"><td colSpan={13}><div className="expand">
              {job.description && <div><h4>Job description</h4><div className="desc">{job.description}</div></div>}
              {job.fitAnalysis && <div className="cols2">
                <div><h4>Strengths</h4><div className="desc">{job.fitAnalysis.strengths.join(" · ") || "—"}</div></div>
                <div><h4>Gaps</h4><div className="desc">{job.fitAnalysis.gaps.join(" · ") || "—"}</div></div>
              </div>}
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

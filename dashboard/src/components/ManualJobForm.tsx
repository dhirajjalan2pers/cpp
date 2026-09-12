"use client";
import { FormEvent } from "react";
import type { Job } from "@/lib/types";

export default function ManualJobForm({ job, onDone, onCancel }: { job?: Job; onDone: () => void; onCancel: () => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const deadlineValue = String(form.get("deadline") ?? "");
    const payload = {
      title: form.get("title"), companyName: form.get("companyName"), industry: form.get("industry"), location: form.get("location"),
      contractType: form.get("contractType"), applicationMethod: form.get("applicationMethod"), url: form.get("url"),
      description: form.get("description"), notes: form.get("notes"), deadline: deadlineValue ? new Date(`${deadlineValue}T23:59:00Z`).toISOString() : null,
      isPaid: form.get("isPaid") === "true" ? true : form.get("isPaid") === "false" ? false : null,
    };
    const response = await fetch(job ? `/api/jobs/manual/${job.id}` : "/api/jobs/manual", { method: job ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { const body = await response.json(); alert(body.error ?? "Could not save job"); return; } onDone();
  }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-title"><h2>{job ? "Edit manual job" : "Add a job"}</h2><button type="button" className="icon-button" onClick={onCancel}>×</button></div><div className="form-grid">
    <label>Role<input name="title" defaultValue={job?.title} required /></label><label>Company<input name="companyName" defaultValue={job?.companyName} required /></label>
    <label>Industry<input name="industry" defaultValue={job?.industry} /></label><label>Location<input name="location" defaultValue={job?.location} /></label>
    <label>Contract type<input name="contractType" defaultValue={job?.contractType} /></label><label>Application method<input name="applicationMethod" defaultValue={job?.applicationMethod} /></label>
    <label>Paid<select name="isPaid" defaultValue={job?.isPaid === true ? "true" : job?.isPaid === false ? "false" : "unknown"}><option value="unknown">Not specified</option><option value="true">Paid</option><option value="false">Unpaid</option></select></label>
    <label>Deadline<input name="deadline" type="date" defaultValue={job?.deadline?.slice(0, 10)} /></label><label className="full">URL<input name="url" type="url" defaultValue={job?.url} /></label>
    <label className="full">Description<textarea name="description" rows={6} defaultValue={job?.description} /></label><label className="full">Notes<textarea name="notes" rows={3} defaultValue={job?.notes} /></label>
  </div><div className="modal-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button className="primary">Save job</button></div></form></div>;
}


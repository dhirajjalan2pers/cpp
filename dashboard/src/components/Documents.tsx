"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AppHeader from "./AppHeader";

interface DocumentItem { id: string; kind: "resume" | "cover_letter"; filename: string; size_bytes: number; updated_at: string }

export default function Documents() {
  const [items, setItems] = useState<DocumentItem[]>([]); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/cro/documents"); const body = await response.json(); if (response.ok) setItems(body.documents); }, []);
  useEffect(() => { void load(); }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget);
    const file = form.get("file") as File; if (file.size > 10 * 1024 * 1024) { setMessage("PDF must be 10 MB or smaller."); setBusy(false); return; }
    const response = await fetch("/api/cro/documents", { method: "POST", body: form }); const body = await response.json();
    setMessage(response.ok ? "Document stored securely." : body.error); if (response.ok) { event.currentTarget.reset(); await load(); } setBusy(false);
  }
  async function remove(id: string) { if (!confirm("Delete this document?")) return; await fetch(`/api/cro/documents/${id}`, { method: "DELETE" }); await load(); }
  return <><AppHeader/><main className="page"><div className="page-heading"><div><div className="eyebrow">APPLICATION MATERIALS</div><h1>Documents</h1><p>One current résumé and any number of reusable cover letters. PDF only, encrypted at rest.</p></div></div>
    <form className="panel upload-form" onSubmit={upload}><label>Document type<select name="kind"><option value="resume">Current résumé</option><option value="cover_letter">Cover letter</option></select></label><label>PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label><button className="primary" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button></form>
    {message && <div className="alert">{message}</div>}
    <section className="document-grid">{items.map((item) => <article className="panel document-card" key={item.id}><div className="doc-icon">PDF</div><div><strong>{item.filename}</strong><p>{item.kind === "resume" ? "Current résumé" : "Cover letter"} · {(item.size_bytes / 1024).toFixed(0)} KB</p></div><div className="doc-actions"><a className="button" href={`/api/cro/documents/${item.id}`}>Download</a><button className="danger" onClick={() => remove(item.id)}>Delete</button></div></article>)}</section>
    {!items.length && <div className="empty">No documents uploaded yet.</div>}
  </main></>;
}


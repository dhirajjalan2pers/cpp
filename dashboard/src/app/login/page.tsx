"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: form.get("password") }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Login failed"); setBusy(false); return; }
    router.replace("/"); router.refresh();
  }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <div className="eyebrow">PERSONAL WORKSPACE</div><h1>Universal Jobs Board</h1>
    <p>Sign in with the password configured for this installation.</p>
    <label>Password<input name="password" type="password" autoComplete="current-password" required autoFocus /></label>
    {error && <div className="alert error">{error}</div>}
    <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
  </form></main>;
}


"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname(); const router = useRouter();
  async function logout() { await fetch("/api/auth", { method: "DELETE" }); router.replace("/login"); router.refresh(); }
  return <header className="app-header"><Link className="brand" href="/">UJB <span>LBS</span></Link>
    <nav><Link className={pathname === "/" ? "active" : ""} href="/">Jobs</Link><Link className={pathname === "/documents" ? "active" : ""} href="/documents">Documents</Link><button className="link-button" onClick={logout}>Sign out</button></nav>
  </header>;
}


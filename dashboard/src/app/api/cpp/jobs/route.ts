import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await query<{ expires_at: Date | null; updated_at: Date }>(
    "SELECT expires_at, updated_at FROM cpp_session WHERE singleton=TRUE"
  );
  const session = sessions[0];
  const jobs = await listJobs();
  return NextResponse.json({
    jobs,
    session: session ? {
      hasSession: true,
      expiresAt: session.expires_at?.toISOString() ?? null,
      updatedAt: session.updated_at.toISOString(),
      expired: Boolean(session.expires_at && session.expires_at < new Date()),
    } : { hasSession: false, expiresAt: null, updatedAt: null, expired: true },
  });
}


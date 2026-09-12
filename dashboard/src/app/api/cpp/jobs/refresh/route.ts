import { NextResponse } from "next/server";
import { refreshCppJobs } from "@/lib/cpp";

export const maxDuration = 300;

export async function POST() {
  try {
    const refreshed = await refreshCppJobs();
    return NextResponse.json({ ok: true, refreshed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CPP refresh failed";
    const status = /session|expired/i.test(message) ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}


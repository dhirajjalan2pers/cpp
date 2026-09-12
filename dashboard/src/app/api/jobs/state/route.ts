import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";

const schema = z.object({
  jobSource: z.enum(["cpp", "manual"]),
  jobId: z.string().min(1),
  starred: z.boolean().optional(), archived: z.boolean().optional(), applied: z.boolean().optional(),
}).refine((value) => value.starred !== undefined || value.archived !== undefined || value.applied !== undefined);

export async function PATCH(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid job state" }, { status: 400 });
  const value = parsed.data;
  await query(`INSERT INTO job_state(job_source,job_id,starred,archived,applied)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(job_source,job_id) DO UPDATE SET
      starred=COALESCE($6,job_state.starred), archived=COALESCE($7,job_state.archived),
      applied=COALESCE($8,job_state.applied), updated_at=now()`, [
    value.jobSource, value.jobId, value.starred ?? false, value.archived ?? false, value.applied ?? false,
    value.starred ?? null, value.archived ?? null, value.applied ?? null,
  ]);
  return NextResponse.json({ ok: true });
}


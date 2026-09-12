import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { manualJobSchema } from "@/lib/validation";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = manualJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { id } = await context.params;
  const job = parsed.data;
  const rows = await query<{ id: string }>(`UPDATE manual_jobs SET title=$2,company_name=$3,industry=$4,
    location=$5,contract_type=$6,application_method=$7,is_paid=$8,url=$9,description=$10,
    deadline=$11,notes=$12,updated_at=now() WHERE id=$1 RETURNING id`, [id, job.title, job.companyName,
    job.industry, job.location, job.contractType, job.applicationMethod, job.isPaid, job.url,
    job.description, job.deadline, job.notes]);
  return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deleted = await transaction(async (client) => {
    await client.query("DELETE FROM job_state WHERE job_source='manual' AND job_id=$1", [id]);
    await client.query("DELETE FROM fit_scores WHERE job_source='manual' AND job_id=$1", [id]);
    return client.query<{ id: string }>("DELETE FROM manual_jobs WHERE id=$1 RETURNING id", [id]);
  });
  return deleted.rowCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

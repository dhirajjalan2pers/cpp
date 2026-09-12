import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { manualJobSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const parsed = manualJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const job = parsed.data;
  const id = randomUUID();
  await query(`INSERT INTO manual_jobs(id,title,company_name,industry,location,contract_type,
    application_method,is_paid,url,description,deadline,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
    id, job.title, job.companyName, job.industry, job.location, job.contractType,
    job.applicationMethod, job.isPaid, job.url, job.description, job.deadline, job.notes,
  ]);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}


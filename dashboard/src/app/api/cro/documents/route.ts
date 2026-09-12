import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { encrypt, sha256 } from "@/lib/crypto";
import { query, transaction } from "@/lib/db";

const MAX_SIZE = 10 * 1024 * 1024;

export async function GET() {
  const rows = await query<{ id: string; kind: string; filename: string; size_bytes: number; created_at: Date; updated_at: Date }>(
    "SELECT id,kind,filename,size_bytes,created_at,updated_at FROM documents ORDER BY kind DESC, created_at DESC"
  );
  return NextResponse.json({ documents: rows.map((row) => ({ ...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString() })) });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File) || (kind !== "resume" && kind !== "cover_letter")) {
    return NextResponse.json({ error: "A PDF file and valid kind are required" }, { status: 400 });
  }
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
  }
  if (file.size < 5 || file.size > MAX_SIZE) return NextResponse.json({ error: "PDF must be 10 MB or smaller" }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "File is not a valid PDF" }, { status: 415 });
  const id = randomUUID();
  await transaction(async (client) => {
    if (kind === "resume") await client.query("DELETE FROM documents WHERE kind='resume'");
    await client.query(`INSERT INTO documents(id,kind,filename,mime_type,size_bytes,content_encrypted,content_sha256)
      VALUES($1,$2,$3,'application/pdf',$4,$5,$6)`, [id, kind, file.name.slice(0, 250), file.size, encrypt(bytes), sha256(bytes)]);
  });
  return NextResponse.json({ ok: true, id }, { status: 201 });
}


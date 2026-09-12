import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { query } from "@/lib/db";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rows = await query<{ filename: string; content_encrypted: Buffer }>(
    "SELECT filename,content_encrypted FROM documents WHERE id=$1", [id]
  );
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const safeName = rows[0].filename.replace(/[^\x20-\x7E]|[\r\n"\\]/g, "_");
  const encodedName = encodeURIComponent(rows[0].filename).replace(/'/g, "%27");
  return new NextResponse(new Uint8Array(decrypt(rows[0].content_encrypted)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`, "Cache-Control": "private, no-store" },
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rows = await query<{ id: string }>("DELETE FROM documents WHERE id=$1 RETURNING id", [id]);
  return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

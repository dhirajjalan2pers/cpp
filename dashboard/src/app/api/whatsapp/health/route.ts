import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { whatsappAuthorized, whatsappEnabled } from "@/lib/whatsapp-auth";

export async function GET(request: NextRequest) {
  if (!whatsappEnabled()) return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  if (!whatsappAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await query<{ last_rowid: string; last_synced_at: Date | null; last_error: string | null }>(
    "SELECT last_rowid,last_synced_at,last_error FROM whatsapp_sync_state WHERE singleton=TRUE"
  );
  const counts = await query<{ messages: string; chats: string }>(
    "SELECT (SELECT count(*) FROM whatsapp_messages)::text messages,(SELECT count(*) FROM whatsapp_chats)::text chats"
  );
  return NextResponse.json({ enabled: true, sync: state[0] ? { ...state[0], last_synced_at: state[0].last_synced_at?.toISOString() ?? null } : null, counts: counts[0] });
}


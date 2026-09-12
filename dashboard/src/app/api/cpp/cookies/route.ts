import { NextRequest, NextResponse } from "next/server";
import { safeSecretEqual } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { query } from "@/lib/db";

function expiry(cookieString: string): string | null {
  const part = cookieString.split(";").map((value) => value.trim()).find((value) => value.startsWith("SessionExpirationTime="));
  if (!part) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(part.slice(part.indexOf("=") + 1))) as { ExpirationDate?: string };
    const date = parsed.ExpirationDate ? new Date(parsed.ExpirationDate) : null;
    return date && !Number.isNaN(date.valueOf()) ? date.toISOString() : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  if (!safeSecretEqual(request.headers.get("x-extension-key"), process.env.CPP_EXTENSION_API_KEY)) {
    return NextResponse.json({ error: "Invalid extension key" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({})) as { cookieString?: string };
  const cookieString = body.cookieString?.trim() ?? "";
  const cookieCount = cookieString.split(";").filter((value) => value.includes("=")).length;
  if (cookieCount < 3 || cookieString.length > 64_000) {
    return NextResponse.json({ error: "Expected a complete CPP cookie set" }, { status: 400 });
  }
  const sessionExpiry = expiry(cookieString);
  await query(`INSERT INTO cpp_session(singleton, cookie_encrypted, cookie_count, expires_at, updated_at)
    VALUES (TRUE,$1,$2,$3,now()) ON CONFLICT(singleton) DO UPDATE SET
    cookie_encrypted=EXCLUDED.cookie_encrypted, cookie_count=EXCLUDED.cookie_count,
    expires_at=EXCLUDED.expires_at, updated_at=now()`, [encrypt(cookieString), cookieCount, sessionExpiry]);
  return NextResponse.json({ ok: true, cookieCount, sessionExpiry });
}


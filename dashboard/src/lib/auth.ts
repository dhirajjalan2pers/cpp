import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "ujb_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return value;
}

function signature(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function createSession(): { value: string; maxAge: number } {
  const payload = `ujb:${Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS}`;
  return { value: `${payload}.${signature(payload)}`, maxAge: MAX_AGE_SECONDS };
}

export function validSession(value?: string): boolean {
  if (!value) return false;
  const split = value.lastIndexOf(".");
  if (split < 0) return false;
  const payload = value.slice(0, split);
  const provided = Buffer.from(value.slice(split + 1), "hex");
  const expected = Buffer.from(signature(payload), "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  const [prefix, expires] = payload.split(":");
  return prefix === "ujb" && Number(expires) > Date.now() / 1000;
}

export function requestIsAuthenticated(request: NextRequest): boolean {
  return validSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export function safeSecretEqual(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}


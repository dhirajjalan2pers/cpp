import type { NextRequest } from "next/server";
import { requestIsAuthenticated, safeSecretEqual } from "@/lib/auth";

export function whatsappEnabled(): boolean {
  return process.env.ENABLE_WHATSAPP_WEB_SYNC === "true";
}

export function whatsappAuthorized(request: NextRequest): boolean {
  return whatsappEnabled() && (
    requestIsAuthenticated(request) || safeSecretEqual(request.headers.get("x-agent-key"), process.env.WHATSAPP_AGENT_API_KEY)
  );
}


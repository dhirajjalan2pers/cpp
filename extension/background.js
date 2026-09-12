import { CPP_ORIGIN, DEBOUNCE_MS, dashboardPattern, isAuthenticatedCppUrl } from "./shared.js";

export async function syncCookies({ force = false } = {}) {
  const { dashboardUrl, extensionKey, lastSync } = await chrome.storage.local.get(["dashboardUrl", "extensionKey", "lastSync"]);
  if (!dashboardUrl || !extensionKey) throw new Error("Open Options and configure the dashboard first.");
  if (!force && lastSync && Date.now() - lastSync < DEBOUNCE_MS) return { skipped: true, reason: "Synced less than 30 minutes ago" };
  const pattern = dashboardPattern(dashboardUrl);
  if (!(await chrome.permissions.contains({ origins: [pattern] }))) throw new Error("Dashboard access is not granted. Re-save Options.");
  const cookies = await chrome.cookies.getAll({ url: `${CPP_ORIGIN}/` });
  if (cookies.length < 3) throw new Error("No complete CPP session found. Sign in to LBS Career Portal Plus first.");
  const cookieString = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
  const response = await fetch(`${new URL(dashboardUrl).origin}/api/cpp/cookies`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Extension-Key": extensionKey }, body: JSON.stringify({ cookieString }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Dashboard returned HTTP ${response.status}`);
  const now = Date.now();
  const result = { ok: true, cookieCount: body.cookieCount, sessionExpiry: body.sessionExpiry ?? null, timestamp: now };
  await chrome.storage.local.set({ lastSync: now, lastSyncResult: result, lastError: null });
  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "sync") return false;
  syncCookies({ force: true }).then(sendResponse).catch(async (error) => {
    const text = error instanceof Error ? error.message : String(error);
    await chrome.storage.local.set({ lastError: { message: text, timestamp: Date.now() } });
    sendResponse({ ok: false, error: text });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !isAuthenticatedCppUrl(tab.url)) return;
  syncCookies().catch(async (error) => {
    const text = error instanceof Error ? error.message : String(error);
    await chrome.storage.local.set({ lastError: { message: text, timestamp: Date.now() } });
  });
});

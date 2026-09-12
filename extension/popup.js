import { sessionIsExpired } from "./shared.js";
const state = document.querySelector("#state"); const detail = document.querySelector("#detail"); const sync = document.querySelector("#sync");
function render(data) {
  if (!data.dashboardUrl) { state.className = "state warning"; state.textContent = "Not configured"; detail.textContent = "Open Options first."; return; }
  if (data.lastError && (!data.lastSyncResult || data.lastError.timestamp > data.lastSyncResult.timestamp)) { state.className = "state warning"; state.textContent = "Last sync failed"; detail.textContent = data.lastError.message; return; }
  if (!data.lastSyncResult) { state.textContent = "Ready to sync"; detail.textContent = "Sign in to LBS Career Portal Plus, then sync."; return; }
  const expired = sessionIsExpired(data.lastSyncResult.sessionExpiry);
  state.className = `state ${expired ? "warning" : "ok"}`; state.textContent = expired ? "Session expired" : "Session synced";
  detail.textContent = `${data.lastSyncResult.cookieCount} cookies · ${new Date(data.lastSyncResult.timestamp).toLocaleString()}${data.lastSyncResult.sessionExpiry ? ` · expires ${new Date(data.lastSyncResult.sessionExpiry).toLocaleString()}` : ""}`;
}
render(await chrome.storage.local.get(["dashboardUrl", "lastSyncResult", "lastError"]));
sync.addEventListener("click", async () => { sync.disabled = true; sync.textContent = "Syncing…"; const result = await chrome.runtime.sendMessage({ type: "sync" }); if (result.ok) render(await chrome.storage.local.get(["dashboardUrl", "lastSyncResult", "lastError"])); else { state.className = "state warning"; state.textContent = "Sync failed"; detail.textContent = result.error; } sync.disabled = false; sync.textContent = "Sync now"; });
document.querySelector("#options").addEventListener("click", () => chrome.runtime.openOptionsPage());

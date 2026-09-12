import { dashboardPattern } from "./shared.js";

const form = document.querySelector("#form");
const status = document.querySelector("#status");
const dashboardInput = document.querySelector("#dashboardUrl");
const keyInput = document.querySelector("#extensionKey");

let saved = await chrome.storage.local.get(["dashboardUrl", "extensionKey"]);
dashboardInput.value = saved.dashboardUrl || "http://localhost:3000";
keyInput.value = saved.extensionKey || "";

form.addEventListener("submit", async (event) => {
  event.preventDefault(); status.textContent = "";
  try {
    const dashboardUrl = new URL(dashboardInput.value).origin;
    const pattern = dashboardPattern(dashboardUrl);
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) throw new Error("Dashboard origin access was not granted.");
    if (saved.dashboardUrl && new URL(saved.dashboardUrl).origin !== dashboardUrl) {
      await chrome.permissions.remove({ origins: [dashboardPattern(saved.dashboardUrl)] });
    }
    await chrome.storage.local.set({ dashboardUrl, extensionKey: keyInput.value.trim() });
    saved = { dashboardUrl, extensionKey: keyInput.value.trim() };
    status.textContent = "Saved. Open the extension popup to sync.";
  } catch (error) { status.textContent = error.message; }
});

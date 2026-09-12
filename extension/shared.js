export const CPP_ORIGIN = "https://lbs.12twenty.com";
export const DEBOUNCE_MS = 30 * 60 * 1000;

export function isAuthenticatedCppUrl(url) {
  if (typeof url !== "string" || !url.startsWith(`${CPP_ORIGIN}/`)) return false;
  const path = new URL(url).pathname.toLowerCase();
  return !["/login", "/oauth", "/sso", "/saml"].some((part) => path.includes(part));
}

export function dashboardPattern(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Dashboard URL must use HTTP or HTTPS");
  return `${url.origin}/*`;
}

export function sessionIsExpired(expiry, now = Date.now()) {
  return Boolean(expiry && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) <= now);
}


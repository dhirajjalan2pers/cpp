// Shared "reachable job" rules for the owner's constraints:
//  - no internship-only roles
//  - no Europe-only or USA-only locations (keep UK/London, Dubai/MENA, Africa,
//    Canada, Asia, remote/multiple/unspecified)
// Used by both the dashboard UI and the fit-scoring CLI so scoring scope and the
// visible board never drift.

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ")
);
const EU_COUNTRIES = new Set([
  "ireland", "france", "germany", "spain", "italy", "netherlands", "belgium", "denmark",
  "sweden", "norway", "finland", "portugal", "austria", "poland", "switzerland", "greece",
  "czech republic", "czechia", "hungary", "romania", "luxembourg", "iceland",
]);

export function isInternshipOnly(contractType: string): boolean {
  const types = (contractType || "").split(",").map((s) => s.trim()).filter(Boolean);
  return types.length > 0 && types.every((t) => /internship/i.test(t));
}

export function isEuropeOrUSOnly(location: string): boolean {
  if (!location) return false;
  const l = location.toLowerCase();
  if (/remote|multiple|flexible|negotiable|not specified/.test(l)) return false; // keep
  if (l.includes("united kingdom") || l.includes("london")) return false;        // keep UK
  const segs = location.split(/[-,]/).map((s) => s.trim()).filter(Boolean);
  const last = segs[segs.length - 1] || "";
  if (US_STATES.has(last.toUpperCase()) || l.includes("united states") || /\busa\b/.test(l)) return true;
  return EU_COUNTRIES.has(last.toLowerCase());
}

export function isReachable(job: { contractType: string; location: string }): boolean {
  return !isInternshipOnly(job.contractType) && !isEuropeOrUSOnly(job.location);
}

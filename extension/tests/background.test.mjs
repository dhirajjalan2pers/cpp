import assert from "node:assert/strict";
import test from "node:test";

const { dashboardPattern, isAuthenticatedCppUrl, sessionIsExpired } = await import("../shared.js");

test("accepts authenticated LBS pages only", () => {
  assert.equal(isAuthenticatedCppUrl("https://lbs.12twenty.com/jobPostings"), true);
  assert.equal(isAuthenticatedCppUrl("https://lbs.12twenty.com/login"), false);
  assert.equal(isAuthenticatedCppUrl("https://example.com/jobPostings"), false);
});

test("normalizes the exact dashboard origin", () => {
  assert.equal(dashboardPattern("https://jobs.example.com/path"), "https://jobs.example.com/*");
  assert.throws(() => dashboardPattern("file:///tmp/jobs"));
});

test("reports valid and expired sessions", () => {
  const now = Date.parse("2030-01-01T00:00:00Z");
  assert.equal(sessionIsExpired("2029-12-31T23:59:59Z", now), true);
  assert.equal(sessionIsExpired("2030-01-01T00:00:01Z", now), false);
  assert.equal(sessionIsExpired(null, now), false);
});

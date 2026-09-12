import { describe, expect, it } from "vitest";
import { normalizeListItem, stripHtml } from "./cpp";

describe("CPP normalization", () => {
  it("normalizes a synthetic list item without personal data", () => {
    const job = normalizeListItem({ Id: 42, JobTitle: "Strategy Intern", CompanyName: "Example Ltd", LocationDisplay: "London", NumApplicants: 8, IsApplied: true, ApplicationDeadlineDate: "2030-06-01T12:00:00Z" });
    expect(job).toMatchObject({ id: "42", title: "Strategy Intern", companyName: "Example Ltd", location: "London", applicantCount: 8, hasApplied: true });
    expect(job.url).toContain("lbs.12twenty.com");
  });
  it("converts common job-description HTML to plain text", () => {
    expect(stripHtml("<p>Lead &amp; learn</p><ul><li>One</li></ul>")).toContain("Lead & learn");
    expect(stripHtml("<p>Lead</p>")).not.toContain("<p>");
  });
});


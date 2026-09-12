import { describe, expect, it } from "vitest";
import { fitAnalysisSchema, manualJobSchema, scoreImportSchema } from "./validation";

const analysis = { overallScore: 75, requirements: [{ requirement: "Analysis", match: "strong", explanation: "Demonstrated" }], strengths: ["Analysis"], gaps: [], resumeRecommendations: [] };

describe("public data contracts", () => {
  it("accepts a complete fit analysis", () => expect(fitAnalysisSchema.parse(analysis).overallScore).toBe(75));
  it("rejects scores outside 0-100", () => expect(() => scoreImportSchema.parse({ scores: [{ jobId: "1", jobSource: "cpp", jobTitle: "Role", companyName: "Example", score: 101, fitAnalysis: analysis }] })).toThrow());
  it("rejects unsupported job sources", () => expect(() => scoreImportSchema.parse({ scores: [{ jobId: "1", jobSource: "other", jobTitle: "Role", companyName: "Example", score: 75, fitAnalysis: analysis }] })).toThrow());
  it("validates manual job URLs", () => expect(() => manualJobSchema.parse({ title: "Role", companyName: "Example", url: "not a url" })).toThrow());
});


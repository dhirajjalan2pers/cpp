import { z } from "zod";

export const fitAnalysisSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  requirements: z.array(z.object({
    requirement: z.string().min(1),
    match: z.enum(["strong", "moderate", "weak", "none"]),
    explanation: z.string().min(1),
  })),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  resumeRecommendations: z.array(z.object({
    section: z.string().min(1),
    before: z.string(),
    after: z.string(),
    reason: z.string().min(1),
  })),
});

export const scoreImportSchema = z.object({
  scores: z.array(z.object({
    jobId: z.string().min(1),
    jobSource: z.enum(["cpp", "manual"]),
    jobTitle: z.string().min(1),
    companyName: z.string().min(1),
    score: z.number().int().min(0).max(100),
    fitAnalysis: fitAnalysisSchema,
  })).min(1),
});

export const manualJobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  companyName: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).default(""),
  contractType: z.string().trim().max(100).default(""),
  applicationMethod: z.string().trim().max(100).default(""),
  isPaid: z.boolean().nullable().default(null),
  url: z.string().trim().url().or(z.literal("")).default(""),
  description: z.string().max(100_000).default(""),
  deadline: z.string().datetime().nullable().default(null),
  notes: z.string().max(10_000).default(""),
});


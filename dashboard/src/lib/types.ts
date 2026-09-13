export type JobSource = "cpp" | "manual";

export interface Job {
  id: string;
  source: JobSource;
  title: string;
  companyName: string;
  industry: string;
  location: string;
  contractType: string;
  applicationMethod: string;
  isPaid: boolean | null;
  url: string;
  description: string;
  deadline: string | null;
  postedAt: string | null;
  applicantCount: number;
  active: boolean;
  isNew: boolean;
  notes?: string;
  starred: boolean;
  archived: boolean;
  applied: boolean;
  fitScore: number | null;
  fitStale: boolean;
  fitAnalysis: FitAnalysis | null;
}

export interface FitAnalysis {
  overallScore: number;
  requirements: Array<{
    requirement: string;
    match: "strong" | "moderate" | "weak" | "none";
    explanation: string;
  }>;
  strengths: string[];
  gaps: string[];
  resumeRecommendations: Array<{
    section: string;
    before: string;
    after: string;
    reason: string;
  }>;
}


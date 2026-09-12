---
name: cro-fit-score
description: Score Universal Jobs Board roles against the current uploaded resume using the active Codex or Claude Code subscription, then import validated analyses. Use when the user asks to assess job fit, score unscored or stale UJB jobs, compare a resume with job descriptions, or refresh dashboard fit scores without an LLM API key.
---

# CRO Fit Score

Use the coding agent's own reasoning. Never add an LLM SDK, request an API key, or call an external model endpoint.

## Workflow

1. Work from `dashboard/` and confirm `.env.local` is configured.
2. Select a private temporary PDF path that does not already exist.
3. Run:
   ```bash
   npm run fit -- export-resume --out <temporary-pdf>
   npm run fit -- list-jobs --with-jd --unscored
   ```
   Use `--stale` instead of `--unscored` when refreshing stale scores.
4. Read the exported PDF with the agent's available PDF-reading capability. Do not upload it to an unrelated service.
5. Assess only the jobs returned by the CLI. Ground every conclusion in the actual resume and job description. Mark missing evidence as a gap; do not infer experience.
6. Write a temporary JSON file using the contract below, then run:
   ```bash
   npm run fit -- import-scores <temporary-json>
   ```
7. Delete the temporary PDF and JSON after a successful import unless the user explicitly asks to retain the score file. Never delete a user-supplied original.

For a large queue, score batches of at most 15 jobs and import each completed batch.

## Scoring

Use a 0–100 score reflecting evidence-backed readiness:

- 85–100: unusually strong match across essential and differentiating requirements.
- 70–84: credible match with limited, manageable gaps.
- 50–69: partial match; several important gaps or weak evidence.
- 0–49: major essential requirements are absent.

Prioritize explicit must-haves, relevant achievements, domain/function overlap, seniority, location/work authorization, and application constraints. Do not reward keyword overlap without evidence. Keep explanations concise and specific.

## Import contract

Produce exactly:

```json
{
  "scores": [
    {
      "jobId": "source identifier",
      "jobSource": "cpp",
      "jobTitle": "Role title",
      "companyName": "Company",
      "score": 78,
      "fitAnalysis": {
        "overallScore": 78,
        "requirements": [
          {
            "requirement": "Requirement from the job description",
            "match": "strong",
            "explanation": "Resume-grounded reason"
          }
        ],
        "strengths": ["Specific demonstrated strength"],
        "gaps": ["Specific missing or weak evidence"],
        "resumeRecommendations": [
          {
            "section": "Experience",
            "before": "Existing wording, if present",
            "after": "Truth-preserving suggested wording",
            "reason": "Why this improves relevance"
          }
        ]
      }
    }
  ]
}
```

`jobSource` must be `cpp` or `manual`. Requirement match must be `strong`, `moderate`, `weak`, or `none`. `score` and `fitAnalysis.overallScore` must match.

## Guardrails

- Never invent credentials, metrics, employers, titles, responsibilities, or dates.
- Suggestions may reframe existing facts but may not create new ones.
- Do not modify jobs, documents, application state, or dashboard code during scoring.
- If a job lacks a useful description, record the limitation and score conservatively.
- If export or import validation fails, fix the workflow artifact; do not bypass validation or write directly to Postgres.


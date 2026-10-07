import { z } from "zod";
import { APP_CONSTANTS } from "@/lib/constants";
// Deep-import (NOT the barrel) — utils.ts is pure; the barrel pulls scraper
// network code into the client bundle via this file's client consumers.
import { ATS_TOKEN_REGEX } from "@/lib/scraper/utils";
import { JOBSPY_SITES, sourceKind } from "@/models/automation.model";

export const JobBoardSchema = z.enum([
  "greenhouse",
  "lever",
  "ashby",
  "jobspy",
]);

export const AutomationStatusSchema = z.enum(["active", "paused"]);

export const AutomationRunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "completed_with_errors",
  "blocked",
  "rate_limited",
]);

export const DiscoveryStatusSchema = z.enum(["new", "accepted", "dismissed"]);

// Ranking and budget fields every source shares. Both kinds of source config
// extend this, so the funnel always has what it needs regardless of how the
// jobs were fetched.
export const TargetingConfigSchema = z.object({
  targetTitles: z.array(z.string().min(1).max(100)).optional(),
  keywords: z.array(z.string().min(1).max(100)).optional(),
  locations: z.array(z.string().min(1).max(100)).optional(),
  strictLocation: z.boolean().optional(),
  topK: z.number().int().min(1).max(APP_CONSTANTS.ATS_LISTING_CAP).optional(),
  saveUnanalyzed: z.boolean().optional(),
});

export const GreenhouseCompanySchema = z.object({
  name: z.string().min(1).max(200),
  token: z.string().min(1).max(80),
});

export const GreenhouseSourceConfigSchema = TargetingConfigSchema.extend({
  companies: z
    .array(GreenhouseCompanySchema)
    .max(APP_CONSTANTS.ATS_MAX_COMPANIES),
});

// Override `token` with the allowlist regex so a directly-POSTed Lever config
// can't smuggle a malformed token past the save boundary.
export const LeverCompanySchema = GreenhouseCompanySchema.extend({
  token: z.string().regex(ATS_TOKEN_REGEX),
  host: z.enum(["default", "eu"]).optional(),
});

// Same fields/MAX/cap as Greenhouse, `companies` swapped to LeverCompanySchema.
export const LeverSourceConfigSchema = GreenhouseSourceConfigSchema.extend({
  companies: z
    .array(LeverCompanySchema)
    .max(APP_CONSTANTS.ATS_MAX_COMPANIES),
});

// Same token allowlist as Lever (rejects path/query injection at the save
// boundary); no `host` — Ashby is single-host.
export const AshbyCompanySchema = GreenhouseCompanySchema.extend({
  token: z.string().regex(ATS_TOKEN_REGEX),
});

export const AshbySourceConfigSchema = GreenhouseSourceConfigSchema.extend({
  companies: z
    .array(AshbyCompanySchema)
    .max(APP_CONSTANTS.ATS_MAX_COMPANIES),
});

export const JobSpySiteSchema = z.enum(
  JOBSPY_SITES.map((s) => s.value) as [string, ...string[]],
);

// Keyword search rather than a company watchlist, so there is no `companies`
// field at all. Bounds mirror the sidecar's own (services/jobspy/app/schema.py)
// — it re-validates, and a mismatch would surface as an opaque 422.
export const JobSpySourceConfigSchema = TargetingConfigSchema.extend({
  sites: z.array(JobSpySiteSchema).max(APP_CONSTANTS.JOBSPY_MAX_SITES),
  searchTerm: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  countryIndeed: z.string().max(60).optional(),
  distance: z.number().int().min(0).max(200).optional(),
  isRemote: z.boolean().optional(),
  jobType: z.enum(["fulltime", "parttime", "internship", "contract"]).optional(),
  resultsWanted: z
    .number()
    .int()
    .min(1)
    .max(APP_CONSTANTS.JOBSPY_MAX_RESULTS_WANTED)
    .optional(),
  hoursOld: z.number().int().min(1).max(24 * 90).optional(),
  fetchDescription: z.boolean().optional(),
});

export const SourceConfigSchema = z.object({
  greenhouse: GreenhouseSourceConfigSchema.optional(),
  lever: LeverSourceConfigSchema.optional(),
  ashby: AshbySourceConfigSchema.optional(),
  jobspy: JobSpySourceConfigSchema.optional(),
});

// Shared by create and update: the required fields of a source config depend
// on its kind, so neither can be expressed as a plain required field.
// Watchlist sources need at least one company; search sources need at least
// one board and something to search for.
function validateSourceConfig(
  data: {
    jobBoard?: z.infer<typeof JobBoardSchema>;
    sourceConfig?: z.infer<typeof SourceConfigSchema>;
  },
  ctx: z.RefinementCtx,
): void {
  const board = data.jobBoard;
  if (!board) return;

  if (sourceKind(board) === "search") {
    const cfg = data.sourceConfig?.jobspy;
    if (!cfg?.sites?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceConfig", board, "sites"],
        message: "Select at least one job board",
      });
    }
    if (!cfg?.searchTerm?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceConfig", board, "searchTerm"],
        message: "Enter what to search for",
      });
    }
    return;
  }

  const companies =
    data.sourceConfig?.[board as "greenhouse" | "lever" | "ashby"]?.companies ??
    [];
  if (companies.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceConfig", board, "companies"],
      message: "Select at least one company",
    });
  }
}

export const CreateAutomationSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    jobBoard: JobBoardSchema,
    keywords: z.string().max(200).optional(),
    location: z.string().max(100).optional(),
    sourceConfig: SourceConfigSchema.optional(),
    resumeId: z.string().uuid("Invalid resume"),
    matchThreshold: z.number().min(0).max(100),
    scheduleHour: z.number().min(0).max(23),
  })
  .superRefine(validateSourceConfig);

export const UpdateAutomationSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    jobBoard: JobBoardSchema.optional(),
    keywords: z.string().max(200).optional(),
    location: z.string().max(100).optional(),
    sourceConfig: SourceConfigSchema.optional(),
    resumeId: z.string().uuid("Invalid resume").optional(),
    matchThreshold: z.number().min(0).max(100).optional(),
    scheduleHour: z.number().min(0).max(23).optional(),
  })
  .superRefine(validateSourceConfig);

export type CreateAutomationInput = z.infer<typeof CreateAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof UpdateAutomationSchema>;
export type SourceConfigInput = z.infer<typeof SourceConfigSchema>;
export type GreenhouseSourceConfigInput = z.infer<
  typeof GreenhouseSourceConfigSchema
>;
export type JobSpySourceConfigInput = z.infer<typeof JobSpySourceConfigSchema>;

import type { Automation } from "@/models/automation.model";
import type { AtsProvider } from "../ats/types";
import { automationLogger } from "@/lib/automation-logger";
import type { RunnerResult, ResumeWithSections } from "./types";
import { parseAtsConfig } from "./config";
import { finalizeRun } from "./finalize";
import { runDiscoveryRun } from "./discoveryRun";

// Watchlist sources (Greenhouse, Lever, Ashby). Owns only the company-list
// precondition and the fetch; everything downstream lives in runDiscoveryRun,
// shared with the keyword-search path.
export async function runAtsRun(
  automation: Automation,
  provider: AtsProvider,
  runId: string,
  resume: ResumeWithSections,
  signal?: AbortSignal,
): Promise<RunnerResult> {
  const label = `[${provider.label}]`;
  const config = parseAtsConfig(automation.sourceConfig, automation.jobBoard);

  if (!config || config.companies.length === 0) {
    automationLogger.log(
      automation.id,
      "error",
      `${label} No companies configured`,
    );
    automationLogger.endRun(automation.id);
    return await finalizeRun(runId, {
      status: "failed",
      errorMessage: "no_companies",
      jobsSearched: 0,
      jobsDeduplicated: 0,
      jobsProcessed: 0,
      jobsMatched: 0,
      jobsSaved: 0,
    });
  }

  return runDiscoveryRun({
    automation,
    runId,
    resume,
    label,
    config,
    fetchJobs: () => provider.search(config.companies),
    describeFetchStart: () => `Fetching ${config.companies.length} companies...`,
    describeFetchDone: (count) =>
      `Fetched ${count} jobs across ${config.companies.length} boards`,
    signal,
  });
}

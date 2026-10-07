import type { Automation } from "@/models/automation.model";
import { JOBSPY_SITES } from "@/models/automation.model";
import type { SearchProvider } from "../ats/types";
import { automationLogger } from "@/lib/automation-logger";
import type { RunnerResult, ResumeWithSections } from "./types";
import { parseJobSpyConfig } from "./config";
import { finalizeRun } from "./finalize";
import { runDiscoveryRun } from "./discoveryRun";

const SITE_LABELS = new Map(JOBSPY_SITES.map((s) => [s.value, s.label]));

// Keyword sources (JobSpy). Mirrors runAtsRun: owns only its preconditions and
// the fetch, then hands off to the shared pipeline.
export async function runSearchRun(
  automation: Automation,
  provider: SearchProvider,
  runId: string,
  resume: ResumeWithSections,
  signal?: AbortSignal,
): Promise<RunnerResult> {
  const label = `[${provider.label}]`;
  const config = parseJobSpyConfig(automation.sourceConfig);

  const fail = async (errorMessage: string, logMessage: string) => {
    automationLogger.log(automation.id, "error", `${label} ${logMessage}`);
    automationLogger.endRun(automation.id);
    return await finalizeRun(runId, {
      status: "failed",
      errorMessage,
      jobsSearched: 0,
      jobsDeduplicated: 0,
      jobsProcessed: 0,
      jobsMatched: 0,
      jobsSaved: 0,
    });
  };

  if (!config) {
    return fail("no_search_config", "No search configured");
  }
  if (config.sites.length === 0) {
    return fail("no_sites", "No job boards selected");
  }
  if (!config.searchTerm) {
    return fail("no_search_term", "No search term configured");
  }

  const siteNames = config.sites
    .map((s) => SITE_LABELS.get(s) ?? s)
    .join(", ");

  // Searching without descriptions is legal but usually a mistake: Indeed and
  // LinkedIn omit them from search results, and the AI match has nothing to
  // work with. Warn rather than refuse — the user may have turned it off on
  // purpose to dodge rate limits.
  if (!config.fetchDescription) {
    automationLogger.log(
      automation.id,
      "warning",
      `${label} Job descriptions are turned off — AI matching will have little to work with`,
    );
  }

  return runDiscoveryRun({
    automation,
    runId,
    resume,
    label,
    config,
    fetchJobs: () => provider.search(config, signal),
    describeFetchStart: () =>
      `Searching ${siteNames} for "${config.searchTerm}"${
        config.location ? ` in ${config.location}` : ""
      } (up to ${config.resultsWanted} per board)...`,
    describeFetchDone: (count) =>
      `Fetched ${count} jobs across ${config.sites.length} board(s)`,
    signal,
  });
}

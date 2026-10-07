import { APP_CONSTANTS } from "@/lib/constants";
import type { JobSpySourceConfig } from "@/models/automation.model";
import { log } from "@/lib/telemetry";
import type { JobDetails, ScraperResult } from "../types";
import type { ProviderFetch } from "../ats/types";
import { errorReason } from "../utils";
import { mapJobSpyJob } from "./mapper";
import type { JobSpyWireResponse } from "./types";

// Set in docker-compose; absent when a user runs JobSync without the sidecar.
function serviceUrl(): string | null {
  const raw = process.env.JOBSPY_SERVICE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function isJobSpyEnabled(): boolean {
  if (process.env.JOBSPY_ENABLED === "false") return false;
  return serviceUrl() !== null;
}

function buildPayload(config: JobSpySourceConfig) {
  return {
    sites: config.sites,
    search_term: config.searchTerm,
    location: config.location || null,
    distance: config.distance ?? 50,
    is_remote: config.isRemote ?? false,
    job_type: config.jobType ?? null,
    results_wanted: Math.min(
      config.resultsWanted ?? APP_CONSTANTS.JOBSPY_DEFAULT_RESULTS_WANTED,
      APP_CONSTANTS.JOBSPY_MAX_RESULTS_WANTED,
    ),
    hours_old: config.hoursOld ?? null,
    country_indeed: config.countryIndeed || APP_CONSTANTS.JOBSPY_DEFAULT_COUNTRY,
    fetch_description:
      config.fetchDescription ?? APP_CONSTANTS.JOBSPY_DEFAULT_FETCH_DESCRIPTION,
    description_format: "markdown",
  };
}

async function postScrape(
  config: JobSpySourceConfig,
  signal?: AbortSignal,
): Promise<ScraperResult<JobSpyWireResponse>> {
  const base = serviceUrl();
  if (!base) {
    return {
      success: false,
      error: {
        type: "network",
        message:
          "JOBSPY_SERVICE_URL is not set — the JobSpy service is not configured",
      },
    };
  }

  // Own timer, plus the caller's cancel signal. The run can be cancelled from
  // the UI mid-scrape, and a scrape outlives every other fetch in the app.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort);
  }
  const timer = setTimeout(
    () => controller.abort(),
    APP_CONSTANTS.JOBSPY_FETCH_TIMEOUT_MS,
  );

  try {
    const token = process.env.JOBSPY_TOKEN?.trim();
    const response = await fetch(`${base}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-JobSpy-Token": token } : {}),
      },
      body: JSON.stringify(buildPayload(config)),
      signal: controller.signal,
    });

    if (response.status === 401) {
      return {
        success: false,
        error: {
          type: "blocked",
          reason: "rejected the JOBSPY_TOKEN — check it matches the service",
        },
      };
    }
    if (response.status === 422) {
      // The sidecar validated the payload and refused it. Its body names the
      // offending field, which is far more useful than "returned 422".
      const detail = await response.text().catch(() => "");
      return {
        success: false,
        error: {
          type: "parse",
          message: `rejected the search parameters: ${detail.slice(0, 300)}`,
        },
      };
    }
    if (!response.ok) {
      return {
        success: false,
        error: {
          type: "network",
          message: `JobSpy service returned ${response.status}`,
        },
      };
    }

    const data = (await response.json()) as JobSpyWireResponse;
    if (!data || !Array.isArray(data.jobs)) {
      return {
        success: false,
        error: { type: "parse", message: "malformed response from JobSpy service" },
      };
    }
    return { success: true, data };
  } catch (error) {
    // A caller-driven cancel is not a scraper failure; let it propagate so the
    // runner finalizes the run as cancelled rather than failed.
    if (signal?.aborted) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      const minutes = Math.round(APP_CONSTANTS.JOBSPY_FETCH_TIMEOUT_MS / 60000);
      return {
        success: false,
        error: { type: "network", message: `timed out after ${minutes} min` },
      };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: { type: "network", message } };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

// SearchProvider.search. One request covers every selected site: the sidecar
// fans out internally and reports per-site outcomes, which map straight onto
// the per-unit `errors` list the runner already logs.
export async function searchJobSpyJobs(
  config: JobSpySourceConfig,
  signal?: AbortSignal,
): Promise<ProviderFetch> {
  const result = await postScrape(config, signal);

  if (!result.success) {
    // A whole-request failure is reported against the service rather than any
    // one site, since none of them were reached. errorReason is the same
    // formatter every ATS provider uses, so the run log stays consistent.
    return {
      jobs: [],
      errors: [{ token: "jobspy service", reason: errorReason(result.error) }],
    };
  }

  const jobs: JobDetails[] = result.data.jobs.map(mapJobSpyJob);
  log.info("[JobSpy] Scrape returned", {
    "jobspy.jobs": jobs.length,
    "jobspy.errors": result.data.errors.length,
    "jobspy.elapsed_ms": result.data.elapsed_ms,
  });

  return { jobs, errors: result.data.errors ?? [] };
}

export { mapJobSpyJob, siteLabel } from "./mapper";
export type { JobSpyWireJob, JobSpyWireResponse } from "./types";

import type { JobBoard, JobSpySourceConfig } from "@/models/automation.model";
import type { JobDetails } from "../types";

// `host` is optional and Lever-only (Greenhouse ignores it); it's persisted
// once a company is resolved so runtime fetches never re-probe regions.
export type AtsHost = "default" | "eu";

export interface AtsCompany {
  name: string;
  token: string;
  host?: AtsHost;
}

// What every provider hands back, whatever its kind. `errors` is per-unit: a
// board token for ATS sources, a site name for search sources.
export interface ProviderFetch {
  jobs: JobDetails[];
  errors: { token: string; reason: string }[];
}

interface ProviderBase {
  id: JobBoard;
  label: string; // display name shown in the wizard/detail UI
}

// Watchlist sources: the user picks companies, the run pulls everything those
// companies have published.
export interface AtsProvider extends ProviderBase {
  kind: "ats";
  // Fetch a watchlist with bounded concurrency + per-token isolation.
  search(companies: AtsCompany[]): Promise<ProviderFetch>;
}

// Keyword sources: the query is the selector, and one run can return jobs from
// several boards at once.
export interface SearchProvider extends ProviderBase {
  kind: "search";
  search(config: JobSpySourceConfig, signal?: AbortSignal): Promise<ProviderFetch>;
}

export type SourceProvider = AtsProvider | SearchProvider;

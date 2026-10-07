import { APP_CONSTANTS } from "@/lib/constants";
import type {
  JobBoard,
  JobSpyJobType,
  JobSpySite,
} from "@/models/automation.model";
import { JOBSPY_SITES } from "@/models/automation.model";
import type { AtsCompany } from "../ats/types";

// Ranking and budget settings every source shares. These are what the funnel
// in ats/pipeline.ts consumes, so the shared run path needs nothing more.
export interface TargetingRunConfig {
  targetTitles: string[];
  keywords: string[];
  locations: string[];
  strictLocation: boolean;
  topK: number;
  saveUnanalyzed: boolean;
}

export interface AtsRunConfig extends TargetingRunConfig {
  companies: AtsCompany[];
}

export interface JobSpyRunConfig extends TargetingRunConfig {
  sites: JobSpySite[];
  searchTerm: string;
  location?: string;
  countryIndeed?: string;
  distance?: number;
  isRemote?: boolean;
  jobType?: JobSpyJobType;
  resultsWanted: number;
  hoursOld?: number;
  fetchDescription: boolean;
}

const VALID_SITES = new Set<string>(JOBSPY_SITES.map((s) => s.value));

function parseTargeting(cfg: Record<string, unknown>): TargetingRunConfig {
  const array = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  return {
    targetTitles: array(cfg.targetTitles),
    keywords: array(cfg.keywords),
    locations: array(cfg.locations),
    strictLocation: !!cfg.strictLocation,
    topK:
      typeof cfg.topK === "number" && cfg.topK > 0
        ? cfg.topK
        : APP_CONSTANTS.MAX_JOBS_PER_RUN,
    saveUnanalyzed: cfg.saveUnanalyzed !== false,
  };
}

function sourceSection(
  sourceConfig: string | null | undefined,
  jobBoard: JobBoard,
): Record<string, unknown> | null {
  if (!sourceConfig) return null;
  try {
    const parsed = JSON.parse(sourceConfig);
    const cfg = parsed?.[jobBoard];
    return cfg && typeof cfg === "object" ? cfg : null;
  } catch {
    return null;
  }
}

export function parseAtsConfig(
  sourceConfig: string | null | undefined,
  jobBoard: JobBoard,
): AtsRunConfig | null {
  const cfg = sourceSection(sourceConfig, jobBoard);
  if (!cfg || !Array.isArray(cfg.companies)) return null;
  return { companies: cfg.companies as AtsCompany[], ...parseTargeting(cfg) };
}

export function parseJobSpyConfig(
  sourceConfig: string | null | undefined,
): JobSpyRunConfig | null {
  const cfg = sourceSection(sourceConfig, "jobspy");
  if (!cfg) return null;

  // Unknown sites are dropped rather than passed through: the sidecar would
  // reject the whole request with a 422, losing the sites that were valid.
  const sites = (Array.isArray(cfg.sites) ? cfg.sites : []).filter(
    (s): s is JobSpySite => typeof s === "string" && VALID_SITES.has(s),
  );
  const searchTerm =
    typeof cfg.searchTerm === "string" ? cfg.searchTerm.trim() : "";

  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  return {
    sites,
    searchTerm,
    location: str(cfg.location),
    countryIndeed: str(cfg.countryIndeed),
    distance: num(cfg.distance),
    isRemote: cfg.isRemote === true,
    jobType: str(cfg.jobType) as JobSpyJobType | undefined,
    resultsWanted: Math.min(
      num(cfg.resultsWanted) ?? APP_CONSTANTS.JOBSPY_DEFAULT_RESULTS_WANTED,
      APP_CONSTANTS.JOBSPY_MAX_RESULTS_WANTED,
    ),
    hoursOld: num(cfg.hoursOld),
    // Defaults on (see JOBSPY_DEFAULT_FETCH_DESCRIPTION) — only an explicit
    // false turns it off, so a config written before the field existed still
    // gets descriptions.
    fetchDescription: APP_CONSTANTS.JOBSPY_DEFAULT_FETCH_DESCRIPTION
      ? cfg.fetchDescription !== false
      : cfg.fetchDescription === true,
    ...parseTargeting(cfg),
  };
}

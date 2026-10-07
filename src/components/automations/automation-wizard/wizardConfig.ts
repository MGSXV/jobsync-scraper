import { APP_CONSTANTS } from "@/lib/constants";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type { JobSpySourceConfig } from "@/models/automation.model";
import { AUTOMATION_SOURCES } from "@/models/automation.model";
import type { AtsConfigValue } from "../AtsSearchStep";

// Every board the wizard can write a config for. Keyed by jobBoard, so the
// value is also the sourceConfig key.
export type SourceKey = CreateAutomationInput["jobBoard"];
// Retained for the ATS-only call sites that predate the search kind.
export type AtsKey = "greenhouse" | "lever" | "ashby";

export const EMPTY_ATS: AtsConfigValue = {
  companies: [],
  targetTitles: [],
  keywords: [],
  locations: [],
  strictLocation: false,
  topK: APP_CONSTANTS.MAX_JOBS_PER_RUN,
  saveUnanalyzed: true,
};

export const EMPTY_JOBSPY: JobSpySourceConfig = {
  // Indeed only by default: JobSpy's own notes call it the most reliable
  // scraper with no rate limiting, so a first run is likely to succeed.
  sites: ["indeed"],
  searchTerm: "",
  location: "",
  countryIndeed: APP_CONSTANTS.JOBSPY_DEFAULT_COUNTRY,
  resultsWanted: APP_CONSTANTS.JOBSPY_DEFAULT_RESULTS_WANTED,
  fetchDescription: APP_CONSTANTS.JOBSPY_DEFAULT_FETCH_DESCRIPTION,
  targetTitles: [],
  keywords: [],
  locations: [],
  strictLocation: false,
  topK: APP_CONSTANTS.MAX_JOBS_PER_RUN,
  saveUnanalyzed: true,
};

export const STEPS = [
  { id: "basics", title: "Basics", description: "Name your automation" },
  { id: "search", title: "Search", description: "Configure search criteria" },
  { id: "resume", title: "Resume", description: "Select resume for matching" },
  { id: "matching", title: "Matching", description: "Set match threshold" },
  { id: "schedule", title: "Schedule", description: "When to run" },
  { id: "review", title: "Review", description: "Confirm settings" },
];

export const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export function parseEditSourceConfig(
  sc?: string | null,
): CreateAutomationInput["sourceConfig"] | undefined {
  if (!sc) return undefined;
  try {
    const parsed = JSON.parse(sc);
    // Any known source section makes this a usable config; an unrecognized
    // shape (or a retired board's leftovers) is discarded.
    return AUTOMATION_SOURCES.some((board) => parsed?.[board])
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

export interface WizardResume {
  id: string;
  title: string;
}

import type { JobBoard } from "@/models/automation.model";
import { searchGreenhouseJobs } from "../greenhouse";
import { searchLeverJobs } from "../lever";
import { searchAshbyJobs } from "../ashby";
import { searchJobSpyJobs, isJobSpyEnabled } from "../jobspy";
import type { SourceProvider } from "./types";

// Server-only: imports the real network-calling search fns (fetch, p-limit).
// Never import this from client-bundled code — use AUTOMATION_SOURCES from
// automation.model.ts for the plain, dependency-free board list.
export const SOURCE_PROVIDERS: Partial<Record<JobBoard, SourceProvider>> = {
  greenhouse: {
    kind: "ats",
    id: "greenhouse",
    label: "Greenhouse",
    search: searchGreenhouseJobs,
  },
  lever: { kind: "ats", id: "lever", label: "Lever", search: searchLeverJobs },
  ashby: { kind: "ats", id: "ashby", label: "Ashby", search: searchAshbyJobs },
  jobspy: {
    kind: "search",
    id: "jobspy",
    label: "JobSpy",
    search: searchJobSpyJobs,
  },
};

// Kept as the old name so existing ATS-only callers keep reading naturally.
export const ATS_PROVIDERS = SOURCE_PROVIDERS;

// A source can be configured but unavailable at runtime — JobSpy needs its
// sidecar. Returning false here lets the runner fail the run with a clear
// reason instead of surfacing a connection error.
export function isProviderAvailable(board: JobBoard): boolean {
  if (board === "jobspy") return isJobSpyEnabled();
  return SOURCE_PROVIDERS[board] !== undefined;
}

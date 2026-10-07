// Automation types and interfaces

export type AutomationStatus = "active" | "paused";
export type AutomationRunStatus =
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "completed_with_errors"
  | "blocked"
  | "rate_limited"
  | "cancelled";
export type DiscoveryStatus = "new" | "accepted" | "dismissed";
export type JobBoard = "greenhouse" | "lever" | "ashby" | "jobspy";

// How a run is parameterized. "ats" sources fetch a watchlist of company
// boards and get everything those companies have published; "search" sources
// run a keyword query across job boards. Everything downstream of the fetch
// (dedupe, ranking, AI match, persistence) is shared between the two.
export type SourceKind = "ats" | "search";

// Ranking and budget fields every source shares. These parameterize the funnel
// in ats/pipeline.ts, which is source-agnostic, so both kinds carry them.
export interface TargetingConfig {
  targetTitles?: string[];
  keywords?: string[];
  locations?: string[];
  strictLocation?: boolean;
  topK?: number;
  saveUnanalyzed?: boolean;
}

export interface GreenhouseCompany {
  name: string;
  token: string;
}

export interface GreenhouseSourceConfig extends TargetingConfig {
  companies: GreenhouseCompany[];
}

export type LeverHost = "default" | "eu";

export interface LeverCompany {
  name: string;
  token: string;
  host?: LeverHost; // absent/"default" = the common case
}

// Field-identical to Greenhouse except `companies` carries the extra `host`.
export interface LeverSourceConfig extends TargetingConfig {
  companies: LeverCompany[];
}

// Ashby has a single global host, so its company entries are the plain
// {name, token} shape — no `host`, unlike Lever.
export interface AshbyCompany {
  name: string;
  token: string;
}

export interface AshbySourceConfig extends TargetingConfig {
  companies: AshbyCompany[];
}

// Sites JobSpy can scrape. Google is deliberately omitted: JobSpy's own README
// reports Google Jobs as currently unavailable, so offering it would only
// produce empty runs. The sidecar still accepts it — see services/jobspy.
export type JobSpySite =
  | "indeed"
  | "linkedin"
  | "zip_recruiter"
  | "glassdoor"
  | "bayt"
  | "naukri"
  | "bdjobs";

export type JobSpyJobType = "fulltime" | "parttime" | "internship" | "contract";

// Display metadata for the wizard's site picker. `caution` is surfaced as a
// warning when selected — these boards block aggressively enough that a user
// should know before scheduling a nightly run against them.
export const JOBSPY_SITES: {
  value: JobSpySite;
  label: string;
  caution?: string;
}[] = [
  { value: "indeed", label: "Indeed" },
  {
    value: "linkedin",
    label: "LinkedIn",
    caution: "Rate limits aggressively without proxies",
  },
  { value: "zip_recruiter", label: "ZipRecruiter" },
  {
    value: "glassdoor",
    label: "Glassdoor",
    caution: "Blocks after roughly 30 requests per IP",
  },
  { value: "bayt", label: "Bayt" },
  { value: "naukri", label: "Naukri (India)" },
  { value: "bdjobs", label: "BDJobs (Bangladesh)" },
];

// Countries Indeed supports, generated from JobSpy's Country enum (the
// `value` must be a string that enum accepts). `glassdoor` marks the subset
// Glassdoor also covers — JobSpy requires this parameter for both boards and
// ignores it for the others.
export const JOBSPY_COUNTRIES: {
  value: string;
  label: string;
  glassdoor: boolean;
}[] = [
  { value: "argentina", label: "Argentina", glassdoor: true },
  { value: "australia", label: "Australia", glassdoor: true },
  { value: "austria", label: "Austria", glassdoor: true },
  { value: "bahrain", label: "Bahrain", glassdoor: false },
  { value: "bangladesh", label: "Bangladesh", glassdoor: false },
  { value: "belgium", label: "Belgium", glassdoor: true },
  { value: "brazil", label: "Brazil", glassdoor: true },
  { value: "bulgaria", label: "Bulgaria", glassdoor: false },
  { value: "canada", label: "Canada", glassdoor: true },
  { value: "chile", label: "Chile", glassdoor: false },
  { value: "china", label: "China", glassdoor: false },
  { value: "colombia", label: "Colombia", glassdoor: false },
  { value: "costa rica", label: "Costa Rica", glassdoor: false },
  { value: "croatia", label: "Croatia", glassdoor: false },
  { value: "cyprus", label: "Cyprus", glassdoor: false },
  { value: "czech republic", label: "Czech Republic", glassdoor: false },
  { value: "denmark", label: "Denmark", glassdoor: false },
  { value: "ecuador", label: "Ecuador", glassdoor: false },
  { value: "egypt", label: "Egypt", glassdoor: false },
  { value: "estonia", label: "Estonia", glassdoor: false },
  { value: "finland", label: "Finland", glassdoor: false },
  { value: "france", label: "France", glassdoor: true },
  { value: "germany", label: "Germany", glassdoor: true },
  { value: "greece", label: "Greece", glassdoor: false },
  { value: "hong kong", label: "Hong Kong", glassdoor: true },
  { value: "hungary", label: "Hungary", glassdoor: false },
  { value: "india", label: "India", glassdoor: true },
  { value: "indonesia", label: "Indonesia", glassdoor: false },
  { value: "ireland", label: "Ireland", glassdoor: true },
  { value: "israel", label: "Israel", glassdoor: false },
  { value: "italy", label: "Italy", glassdoor: true },
  { value: "japan", label: "Japan", glassdoor: false },
  { value: "kuwait", label: "Kuwait", glassdoor: false },
  { value: "latvia", label: "Latvia", glassdoor: false },
  { value: "lithuania", label: "Lithuania", glassdoor: false },
  { value: "luxembourg", label: "Luxembourg", glassdoor: false },
  { value: "malaysia", label: "Malaysia", glassdoor: true },
  { value: "malta", label: "Malta", glassdoor: true },
  { value: "mexico", label: "Mexico", glassdoor: true },
  { value: "morocco", label: "Morocco", glassdoor: false },
  { value: "netherlands", label: "Netherlands", glassdoor: true },
  { value: "new zealand", label: "New Zealand", glassdoor: true },
  { value: "nigeria", label: "Nigeria", glassdoor: false },
  { value: "norway", label: "Norway", glassdoor: false },
  { value: "oman", label: "Oman", glassdoor: false },
  { value: "pakistan", label: "Pakistan", glassdoor: false },
  { value: "panama", label: "Panama", glassdoor: false },
  { value: "peru", label: "Peru", glassdoor: false },
  { value: "philippines", label: "Philippines", glassdoor: false },
  { value: "poland", label: "Poland", glassdoor: false },
  { value: "portugal", label: "Portugal", glassdoor: false },
  { value: "qatar", label: "Qatar", glassdoor: false },
  { value: "romania", label: "Romania", glassdoor: false },
  { value: "saudi arabia", label: "Saudi Arabia", glassdoor: false },
  { value: "singapore", label: "Singapore", glassdoor: true },
  { value: "slovakia", label: "Slovakia", glassdoor: false },
  { value: "slovenia", label: "Slovenia", glassdoor: false },
  { value: "south africa", label: "South Africa", glassdoor: false },
  { value: "south korea", label: "South Korea", glassdoor: false },
  { value: "spain", label: "Spain", glassdoor: true },
  { value: "sweden", label: "Sweden", glassdoor: false },
  { value: "switzerland", label: "Switzerland", glassdoor: true },
  { value: "taiwan", label: "Taiwan", glassdoor: false },
  { value: "thailand", label: "Thailand", glassdoor: false },
  { value: "türkiye", label: "Türkiye", glassdoor: false },
  { value: "uk", label: "UK", glassdoor: true },
  { value: "usa", label: "USA", glassdoor: true },
  { value: "ukraine", label: "Ukraine", glassdoor: false },
  { value: "united arab emirates", label: "United Arab Emirates", glassdoor: false },
  { value: "uruguay", label: "Uruguay", glassdoor: false },
  { value: "venezuela", label: "Venezuela", glassdoor: false },
  { value: "vietnam", label: "Vietnam", glassdoor: true },
];

// Mirrors services/jobspy's ScrapeRequest. Unlike the ATS configs there is no
// company watchlist — the query itself is the selector.
export interface JobSpySourceConfig extends TargetingConfig {
  sites: JobSpySite[];
  searchTerm: string;
  location?: string;
  // Required by Indeed and Glassdoor, ignored by the other boards.
  countryIndeed?: string;
  distance?: number;
  isRemote?: boolean;
  jobType?: JobSpyJobType;
  resultsWanted?: number;
  hoursOld?: number;
  fetchDescription?: boolean;
}

export interface SourceConfig {
  greenhouse?: GreenhouseSourceConfig;
  lever?: LeverSourceConfig;
  ashby?: AshbySourceConfig;
  jobspy?: JobSpySourceConfig;
}

// Plain, dependency-free board lists. Do NOT import these from ats/registry.ts
// (that pulls the network-calling search fns into client bundles). Both the
// client-imported schema and the scheduler import them here.
//
// ATS_BOARDS is the watchlist-kind sources only — it also drives the admin
// company-directory scope picker, which has no meaning for a search source.
export const ATS_BOARDS: JobBoard[] = ["greenhouse", "lever", "ashby"];
export const SEARCH_BOARDS: JobBoard[] = ["jobspy"];

// Every live source. The scheduler filters due automations against this, so a
// source missing here never fires and nothing logs an error — keep it in sync.
export const AUTOMATION_SOURCES: JobBoard[] = [...ATS_BOARDS, ...SEARCH_BOARDS];

export function sourceKind(board: string): SourceKind {
  return (SEARCH_BOARDS as string[]).includes(board) ? "search" : "ats";
}

// Display name for a source. The UI used to print the raw `jobBoard` column
// with a CSS capitalize, which reads correctly for the ATS boards but renders
// "jobspy" as "Jobspy".
const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  jobspy: "JobSpy",
};

export function sourceLabel(board: string): string {
  return SOURCE_LABELS[board] ?? board;
}

// Boards that used to exist and were removed. Their Automation rows stay in
// the database; the UI marks them retired and only offers pause/delete.
export const RETIRED_BOARDS = ["jsearch"];
export function isRetiredBoard(board: string): boolean {
  return RETIRED_BOARDS.includes(board);
}

export interface Automation {
  id: string;
  userId: string;
  name: string;
  jobBoard: JobBoard;
  keywords: string;
  location: string;
  sourceConfig?: string | null;
  resumeId: string;
  matchThreshold: number;
  scheduleHour: number;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  status: AutomationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationWithResume extends Automation {
  resume: {
    id: string;
    title: string;
  };
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  jobsSearched: number;
  jobsDeduplicated: number;
  jobsProcessed: number;
  jobsMatched: number;
  jobsSaved: number;
  status: AutomationRunStatus;
  errorMessage: string | null;
  blockedReason: string | null;
  funnelStats: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface DiscoveredJob {
  id: string;
  userId: string;
  automationId: string;
  automation?: {
    id: string;
    name: string;
  };
  jobUrl: string | null;
  description: string;
  jobType: string;
  workplaceType?: string | null;
  createdAt: Date;
  jobTitleId: string;
  companyId: string;
  locationId: string | null;
  matchScore: number;
  matchData: string | null;
  discoveryStatus: DiscoveryStatus;
  discoveredAt: Date;
  JobTitle: { label: string };
  Company: { label: string };
  Location?: { label: string } | null;
}

export interface ScrapedJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  // Not narrowed to JobBoard: a search-kind run returns jobs from several
  // boards at once, so this carries the originating site ("indeed",
  // "linkedin") rather than the automation's configured source.
  sourceBoard: string;
  employmentType?: string;
  isRemote?: boolean;
  workplaceType?: string;
  salaryRange?: string;
}

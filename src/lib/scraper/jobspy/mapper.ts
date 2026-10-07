import { WORKPLACE_TYPES, matchEnumEntry } from "@/models/job.model";
import type { JobDetails } from "../types";
import type { JobSpyWireJob } from "./types";

// JobSpy site value -> JobSource label. The labels deliberately match
// APP_CONSTANTS.JOB_SOURCES where they overlap, so a job discovered here
// resolves to the same JobSource row a manual add would: resolveJobSource
// canonicalizes case, making "LinkedIn" and the seeded "Linkedin" one record.
// Without this map, mapper.ts's capitalize() would render "zip_recruiter" as
// "Zip_recruiter".
const SITE_LABELS: Record<string, string> = {
  indeed: "Indeed",
  linkedin: "LinkedIn",
  zip_recruiter: "ZipRecruiter",
  glassdoor: "Glassdoor",
  google: "Google",
  bayt: "Bayt",
  naukri: "Naukri",
  bdjobs: "BDJobs",
};

export function siteLabel(site: string): string {
  return SITE_LABELS[site] ?? site;
}

// JobSpy joins multiple employment types into one comma-separated string
// ("fulltime, contract"). The downstream normalizeJobType folds the whole
// string to letters, so a multi-value field would match no alias and silently
// default to full-time — take the first, which is the board's primary.
function primaryJobType(jobType: string | null): string | undefined {
  if (!jobType) return undefined;
  const first = jobType.split(",")[0]?.trim();
  return first || undefined;
}

// Naukri reports "Hybrid"/"Remote" explicitly; every other board only says
// whether a job is remote. Returning undefined (rather than "ONSITE") when
// nothing is known keeps "not specified" distinct from "known to be on-site".
function workplaceType(job: JobSpyWireJob): string | undefined {
  if (job.work_from_home_type) {
    const matched = matchEnumEntry(WORKPLACE_TYPES, job.work_from_home_type);
    if (matched) return matched[0];
  }
  return job.is_remote ? "REMOTE" : undefined;
}

export function mapJobSpyJob(job: JobSpyWireJob): JobDetails {
  return {
    title: job.title.trim(),
    company: job.company?.trim() ?? "",
    location: job.location?.trim() ?? "",
    description: job.description ?? "",
    // The board's own posting page, not job_url_direct (the employer's ATS
    // link). It is the stable identity the dedupe key is built from, and it
    // matches what the ATS providers persist.
    url: job.job_url,
    postedDate: job.date_posted ?? undefined,
    salary: job.salary?.text ?? undefined,
    employmentType: primaryJobType(job.job_type),
    isRemote: job.is_remote ?? undefined,
    workplaceType: workplaceType(job),
    sourceSite: siteLabel(job.site),
  };
}

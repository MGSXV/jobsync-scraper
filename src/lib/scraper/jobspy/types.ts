// Wire shape of the services/jobspy sidecar. Mirrors app/schema.py — keep the
// two in step; a mismatch surfaces as a parse error at runtime, not a type
// error at build time.

export interface JobSpyWireSalary {
  min_amount: number | null;
  max_amount: number | null;
  interval: string | null;
  currency: string | null;
  source: string | null;
  text: string | null;
}

export interface JobSpyWireJob {
  site: string;
  title: string;
  company: string | null;
  company_url: string | null;
  job_url: string;
  job_url_direct: string | null;
  location: string | null;
  description: string | null;
  job_type: string | null;
  date_posted: string | null;
  is_remote: boolean | null;
  job_level: string | null;
  company_industry: string | null;
  company_logo: string | null;
  work_from_home_type: string | null;
  skills: string | null;
  salary: JobSpyWireSalary;
}

export interface JobSpyWireResponse {
  jobs: JobSpyWireJob[];
  errors: { token: string; reason: string }[];
  elapsed_ms: number;
}

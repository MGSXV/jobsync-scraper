import { mapJobSpyJob, siteLabel } from "@/lib/scraper/jobspy/mapper";
import type { JobSpyWireJob } from "@/lib/scraper/jobspy/types";

function wireJob(overrides: Partial<JobSpyWireJob> = {}): JobSpyWireJob {
  return {
    site: "indeed",
    title: "Backend Engineer",
    company: "Acme Corp",
    company_url: null,
    job_url: "https://ca.indeed.com/viewjob?jk=abc",
    job_url_direct: null,
    location: "Toronto, ON, CA",
    description: "Build things.",
    job_type: null,
    date_posted: null,
    is_remote: null,
    job_level: null,
    company_industry: null,
    company_logo: null,
    work_from_home_type: null,
    skills: null,
    salary: {
      min_amount: null,
      max_amount: null,
      interval: null,
      currency: null,
      source: null,
      text: null,
    },
    ...overrides,
  };
}

describe("siteLabel", () => {
  it("renders multi-word sites the way a JobSource row should read", () => {
    // capitalize() in the shared mapper would produce "Zip_recruiter".
    expect(siteLabel("zip_recruiter")).toBe("ZipRecruiter");
    expect(siteLabel("linkedin")).toBe("LinkedIn");
    expect(siteLabel("bdjobs")).toBe("BDJobs");
  });

  it("passes an unknown site through unchanged", () => {
    expect(siteLabel("someboard")).toBe("someboard");
  });
});

describe("mapJobSpyJob", () => {
  it("maps the core fields", () => {
    const job = mapJobSpyJob(wireJob());
    expect(job.title).toBe("Backend Engineer");
    expect(job.company).toBe("Acme Corp");
    expect(job.location).toBe("Toronto, ON, CA");
    expect(job.description).toBe("Build things.");
  });

  it("tags the job with its originating board, not the automation source", () => {
    expect(mapJobSpyJob(wireJob({ site: "linkedin" })).sourceSite).toBe(
      "LinkedIn",
    );
  });

  it("uses the board posting URL, not the employer's direct link", () => {
    // job_url is the stable dedupe identity; job_url_direct points at whatever
    // ATS the employer happens to use and is not what the ATS providers store.
    const job = mapJobSpyJob(
      wireJob({
        job_url: "https://ca.indeed.com/viewjob?jk=abc",
        job_url_direct: "https://acme.wd3.myworkdayjobs.com/job/123",
      }),
    );
    expect(job.url).toBe("https://ca.indeed.com/viewjob?jk=abc");
  });

  it("carries the preformatted salary string", () => {
    const job = mapJobSpyJob(
      wireJob({
        salary: {
          min_amount: 120000,
          max_amount: 150000,
          interval: "yearly",
          currency: "USD",
          source: "direct_data",
          text: "$120,000 - $150,000/yr",
        },
      }),
    );
    expect(job.salary).toBe("$120,000 - $150,000/yr");
  });

  it("leaves salary undefined when the board reported none", () => {
    expect(mapJobSpyJob(wireJob()).salary).toBeUndefined();
  });

  it("takes the first employment type when a board lists several", () => {
    // The downstream normalizeJobType folds the whole string to letters, so
    // "fulltime, contract" would match no alias and silently become FT.
    expect(mapJobSpyJob(wireJob({ job_type: "parttime, contract" }))
      .employmentType).toBe("parttime");
  });

  it("leaves employment type undefined when absent", () => {
    expect(mapJobSpyJob(wireJob()).employmentType).toBeUndefined();
  });

  describe("workplace type", () => {
    it("derives REMOTE from the is_remote flag", () => {
      expect(mapJobSpyJob(wireJob({ is_remote: true })).workplaceType).toBe(
        "REMOTE",
      );
    });

    it("prefers an explicit work_from_home_type", () => {
      const job = mapJobSpyJob(wireJob({ work_from_home_type: "Hybrid" }));
      expect(job.workplaceType).toBe("HYBRID");
    });

    it("stays undefined when nothing is known", () => {
      // Distinct from "known to be on-site" — most boards never say.
      expect(mapJobSpyJob(wireJob()).workplaceType).toBeUndefined();
      expect(
        mapJobSpyJob(wireJob({ is_remote: false })).workplaceType,
      ).toBeUndefined();
    });

    it("ignores an unrecognized work_from_home_type and falls back", () => {
      const job = mapJobSpyJob(
        wireJob({ work_from_home_type: "Somewhere", is_remote: true }),
      );
      expect(job.workplaceType).toBe("REMOTE");
    });
  });

  it("passes the posted date straight through", () => {
    expect(mapJobSpyJob(wireJob({ date_posted: "2026-03-04" })).postedDate).toBe(
      "2026-03-04",
    );
  });

  it("tolerates a null company and location", () => {
    const job = mapJobSpyJob(wireJob({ company: null, location: null }));
    expect(job.company).toBe("");
    expect(job.location).toBe("");
  });
});

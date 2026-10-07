import type { JobSpySourceConfig } from "@/models/automation.model";

vi.mock("@/lib/telemetry", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { searchJobSpyJobs, isJobSpyEnabled } from "@/lib/scraper/jobspy";

const ORIGINAL_ENV = { ...process.env };

function config(overrides: Partial<JobSpySourceConfig> = {}): JobSpySourceConfig {
  return {
    sites: ["indeed"],
    searchTerm: "backend engineer",
    ...overrides,
  };
}

function wireJob(overrides: Record<string, unknown> = {}) {
  return {
    site: "indeed",
    title: "Backend Engineer",
    company: "Acme",
    company_url: null,
    job_url: "https://indeed.com/viewjob?jk=1",
    job_url_direct: null,
    location: "Remote",
    description: "Work.",
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

function respondWith(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.JOBSPY_SERVICE_URL = "http://jobspy:8000";
  delete process.env.JOBSPY_TOKEN;
  delete process.env.JOBSPY_ENABLED;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("isJobSpyEnabled", () => {
  it("is on when a service URL is configured", () => {
    expect(isJobSpyEnabled()).toBe(true);
  });

  it("is off with no service URL", () => {
    delete process.env.JOBSPY_SERVICE_URL;
    expect(isJobSpyEnabled()).toBe(false);
  });

  it("is off when explicitly disabled despite a URL", () => {
    process.env.JOBSPY_ENABLED = "false";
    expect(isJobSpyEnabled()).toBe(false);
  });
});

describe("searchJobSpyJobs", () => {
  it("maps the returned jobs", async () => {
    vi.stubGlobal("fetch", respondWith({ jobs: [wireJob()], errors: [], elapsed_ms: 10 }));
    const { jobs, errors } = await searchJobSpyJobs(config());
    expect(errors).toEqual([]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Backend Engineer");
    expect(jobs[0].sourceSite).toBe("Indeed");
  });

  it("passes per-site errors through untouched for the run log", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith({
        jobs: [],
        errors: [{ token: "linkedin", reason: "returned no results" }],
        elapsed_ms: 5,
      }),
    );
    const { errors } = await searchJobSpyJobs(config({ sites: ["linkedin"] }));
    expect(errors).toEqual([{ token: "linkedin", reason: "returned no results" }]);
  });

  it("translates the config into the sidecar's snake_case payload", async () => {
    const fetchMock = respondWith({ jobs: [], errors: [], elapsed_ms: 1 });
    vi.stubGlobal("fetch", fetchMock);

    await searchJobSpyJobs(
      config({
        sites: ["indeed", "glassdoor"],
        searchTerm: "data engineer",
        location: "Calgary, AB",
        countryIndeed: "canada",
        hoursOld: 72,
        isRemote: true,
        jobType: "fulltime",
        resultsWanted: 30,
        fetchDescription: false,
      }),
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://jobspy:8000/scrape");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      sites: ["indeed", "glassdoor"],
      search_term: "data engineer",
      location: "Calgary, AB",
      country_indeed: "canada",
      hours_old: 72,
      is_remote: true,
      job_type: "fulltime",
      results_wanted: 30,
      fetch_description: false,
      description_format: "markdown",
    });
  });

  it("defaults descriptions on and applies the results cap", async () => {
    const fetchMock = respondWith({ jobs: [], errors: [], elapsed_ms: 1 });
    vi.stubGlobal("fetch", fetchMock);
    await searchJobSpyJobs(config({ resultsWanted: 99999 }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.fetch_description).toBe(true);
    expect(body.results_wanted).toBe(200);
  });

  it("sends the shared secret only when one is set", async () => {
    const withoutToken = respondWith({ jobs: [], errors: [], elapsed_ms: 1 });
    vi.stubGlobal("fetch", withoutToken);
    await searchJobSpyJobs(config());
    expect(withoutToken.mock.calls[0][1].headers).not.toHaveProperty(
      "X-JobSpy-Token",
    );

    process.env.JOBSPY_TOKEN = "s3cret";
    const withToken = respondWith({ jobs: [], errors: [], elapsed_ms: 1 });
    vi.stubGlobal("fetch", withToken);
    await searchJobSpyJobs(config());
    expect(withToken.mock.calls[0][1].headers["X-JobSpy-Token"]).toBe("s3cret");
  });

  describe("failure handling", () => {
    it("reports a missing service URL against the service", async () => {
      delete process.env.JOBSPY_SERVICE_URL;
      const { jobs, errors } = await searchJobSpyJobs(config());
      expect(jobs).toEqual([]);
      expect(errors[0].token).toBe("jobspy service");
      expect(errors[0].reason).toMatch(/JOBSPY_SERVICE_URL/);
    });

    it("explains a rejected token rather than surfacing a bare 401", async () => {
      vi.stubGlobal("fetch", respondWith("", { status: 401 }));
      const { errors } = await searchJobSpyJobs(config());
      expect(errors[0].reason).toMatch(/JOBSPY_TOKEN/);
    });

    it("surfaces the sidecar's validation detail on a 422", async () => {
      vi.stubGlobal(
        "fetch",
        respondWith("sites: too few items", { status: 422 }),
      );
      const { errors } = await searchJobSpyJobs(config());
      expect(errors[0].reason).toMatch(/too few items/);
    });

    it("reports a non-ok status", async () => {
      vi.stubGlobal("fetch", respondWith("", { status: 503 }));
      const { errors } = await searchJobSpyJobs(config());
      expect(errors[0].reason).toMatch(/503/);
    });

    it("rejects a malformed body instead of throwing", async () => {
      vi.stubGlobal("fetch", respondWith({ unexpected: true }));
      const { jobs, errors } = await searchJobSpyJobs(config());
      expect(jobs).toEqual([]);
      expect(errors[0].reason).toMatch(/malformed/);
    });

    it("reports a transport error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      );
      const { errors } = await searchJobSpyJobs(config());
      expect(errors[0].reason).toBe("ECONNREFUSED");
    });

    it("rethrows when the caller cancelled, so the run finalizes as cancelled", async () => {
      // A user cancel must not be recorded as a scraper failure.
      const controller = new AbortController();
      controller.abort();
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

      await expect(
        searchJobSpyJobs(config(), controller.signal),
      ).rejects.toThrow("aborted");
    });

    it("reports its own timeout as a timeout, not a cancel", async () => {
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
      const { errors } = await searchJobSpyJobs(config());
      expect(errors[0].reason).toMatch(/timed out after 10 min/);
    });
  });
});

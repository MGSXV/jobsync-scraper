import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const m = {
    automationRun: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    automation: { findUnique: vi.fn(), update: vi.fn() },
    resume: { findUnique: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    job: { findMany: vi.fn(), create: vi.fn() },
    jobTitle: { findUnique: vi.fn(), create: vi.fn() },
    location: { findUnique: vi.fn(), create: vi.fn() },
    company: { findUnique: vi.fn(), create: vi.fn() },
    jobSource: { findUnique: vi.fn(), create: vi.fn() },
    jobStatus: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    jobStage: { create: vi.fn() },
    jobStageType: {
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(function () {
      return m;
    }),
  };
});

vi.mock("@/lib/scraper/jobspy", () => ({
  searchJobSpyJobs: vi.fn(),
  isJobSpyEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/scraper/greenhouse", () => ({
  searchGreenhouseJobs: vi.fn(),
}));

vi.mock("@/lib/api-key-resolver", () => ({
  resolveApiKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/provider-registry.server", () => ({
  PROVIDER_VERIFIERS: { ollama: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock("ai", () => ({ generateText: vi.fn() }));

vi.mock("@/lib/ai", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, getModel: vi.fn().mockResolvedValue({}) };
});

import { runAutomation } from "@/lib/scraper/runner";
import { searchJobSpyJobs, isJobSpyEnabled } from "@/lib/scraper/jobspy";
import { searchGreenhouseJobs } from "@/lib/scraper/greenhouse";
import { generateText } from "ai";
import type { Automation } from "@/models/automation.model";

function makeJob(title: string, description = "", extra = {}) {
  return {
    title,
    company: "Acme",
    location: "Remote",
    description,
    url: `https://indeed.com/viewjob?jk=${Math.random()}`,
    postedDate: "2026-06-01",
    sourceSite: "Indeed",
    ...extra,
  };
}

function automation(cfg: Record<string, unknown> = {}): Automation {
  return {
    id: "auto-jobspy",
    userId: "user1",
    name: "JobSpy",
    jobBoard: "jobspy",
    keywords: "",
    location: "",
    sourceConfig: JSON.stringify({
      jobspy: {
        sites: ["indeed"],
        searchTerm: "frontend engineer",
        location: "Calgary, AB",
        targetTitles: ["Frontend Engineer"],
        keywords: [],
        locations: [],
        strictLocation: false,
        ...cfg,
      },
    }),
    resumeId: "resume1",
    matchThreshold: 80,
    scheduleHour: 8,
    nextRunAt: null,
    lastRunAt: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("runAutomation (jobspy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isJobSpyEnabled as any).mockReturnValue(true);

    (prisma.automationRun.create as any).mockResolvedValue({ id: "run1" });
    (prisma.automationRun.update as any).mockResolvedValue({
      id: "run1",
      automationId: "auto-jobspy",
    });
    (prisma.automationRun.findUnique as any).mockResolvedValue({
      status: "running",
    });
    (prisma.automation.findUnique as any).mockResolvedValue({ scheduleHour: 8 });
    (prisma.automation.update as any).mockResolvedValue({});
    (prisma.userSettings.findUnique as any).mockResolvedValue(null);
    (prisma.resume.findUnique as any).mockResolvedValue({
      id: "resume1",
      title: "My Resume",
      ContactInfo: null,
      ResumeSections: [],
    });
    (prisma.job.findMany as any).mockResolvedValue([]);
    (prisma.job.create as any).mockResolvedValue({});
    (prisma.jobTitle.findUnique as any).mockResolvedValue({ id: "jt" });
    (prisma.location.findUnique as any).mockResolvedValue({ id: "loc" });
    (prisma.company.findUnique as any).mockResolvedValue({ id: "co" });
    (prisma.jobSource.findUnique as any).mockResolvedValue({ id: "src" });
    (prisma.jobStatus.findFirst as any).mockResolvedValue({ id: "st" });
    (prisma.jobStatus.findUnique as any).mockResolvedValue({
      id: "st",
      label: "New",
    });
    (prisma.jobStageType.findUnique as any).mockResolvedValue({
      id: "stage-type-new",
      label: "New",
    });
    (prisma.jobStage.create as any).mockResolvedValue({ id: "stage-1" });

    (generateText as any).mockResolvedValue({
      text: "SCORES: match=90 recommendation=strong match\n\n## Summary\nGreat fit",
    });
  });

  it("dispatches to the search provider, not an ATS one", async () => {
    (searchJobSpyJobs as any).mockResolvedValue({
      jobs: [makeJob("Frontend Engineer", "React")],
      errors: [],
    });

    const result = await runAutomation(automation());

    expect(result.status).toBe("completed");
    expect((searchJobSpyJobs as any).mock.calls.length).toBe(1);
    expect((searchGreenhouseJobs as any).mock.calls.length).toBe(0);
    expect(result.jobsSaved).toBe(1);
  });

  it("hands the parsed search config to the provider, not a company list", async () => {
    (searchJobSpyJobs as any).mockResolvedValue({ jobs: [], errors: [] });

    await runAutomation(automation());

    const passed = (searchJobSpyJobs as any).mock.calls[0][0];
    expect(passed).toMatchObject({
      sites: ["indeed"],
      searchTerm: "frontend engineer",
      location: "Calgary, AB",
    });
    expect(passed).not.toHaveProperty("companies");
  });

  it("runs the shared relevance funnel: an unrelated job is never analyzed", async () => {
    (searchJobSpyJobs as any).mockResolvedValue({
      jobs: [makeJob("Veterinary Nurse", "animal care")],
      errors: [],
    });

    const result = await runAutomation(automation());

    expect(result.status).toBe("completed");
    expect(result.jobsProcessed).toBe(0);
    expect((generateText as any).mock.calls.length).toBe(0);
  });

  it("bounds LLM calls by topK even when the search returns more", async () => {
    (searchJobSpyJobs as any).mockResolvedValue({
      jobs: Array.from({ length: 8 }, () =>
        makeJob("Frontend Engineer", "React"),
      ),
      errors: [],
    });

    const result = await runAutomation(
      automation({ topK: 2, saveUnanalyzed: false }),
    );

    expect((generateText as any).mock.calls.length).toBe(2);
    expect(result.jobsProcessed).toBe(2);
  });

  it("files each job under its originating board, not under 'jobspy'", async () => {
    (searchJobSpyJobs as any).mockResolvedValue({
      jobs: [
        makeJob("Frontend Engineer", "React", { sourceSite: "LinkedIn" }),
      ],
      errors: [],
    });
    (prisma.jobSource.findUnique as any).mockResolvedValue(null);
    (prisma.jobSource.create as any).mockResolvedValue({ id: "src-linkedin" });

    await runAutomation(automation());

    const created = (prisma.jobSource.create as any).mock.calls[0][0];
    expect(created.data.label).toBe("LinkedIn");
  });

  it("persists the salary JobSpy reports", async () => {
    (searchJobSpyJobs as any).mockResolvedValue({
      jobs: [
        makeJob("Frontend Engineer", "React", {
          salary: "$120,000 - $150,000/yr",
        }),
      ],
      errors: [],
    });

    await runAutomation(automation());

    const createArg = (prisma.job.create as any).mock.calls[0][0];
    expect(createArg.data.salaryRange).toBe("$120,000 - $150,000/yr");
  });

  it("logs per-site errors without failing the run", async () => {
    (searchJobSpyJobs as any).mockResolvedValue({
      jobs: [makeJob("Frontend Engineer", "React")],
      errors: [{ token: "linkedin", reason: "returned no results" }],
    });

    const result = await runAutomation(automation());

    expect(result.status).toBe("completed");
    expect(result.jobsSaved).toBe(1);
  });

  describe("preconditions", () => {
    it("fails with no_sites when no board is selected", async () => {
      const result = await runAutomation(automation({ sites: [] }));
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBe("no_sites");
      expect((searchJobSpyJobs as any).mock.calls.length).toBe(0);
    });

    it("fails with no_search_term when the query is blank", async () => {
      const result = await runAutomation(automation({ searchTerm: "   " }));
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBe("no_search_term");
      expect((searchJobSpyJobs as any).mock.calls.length).toBe(0);
    });

    it("fails with no_search_config when the section is missing", async () => {
      const auto = { ...automation(), sourceConfig: JSON.stringify({}) };
      const result = await runAutomation(auto);
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBe("no_search_config");
    });

    it("blocks the run when the sidecar is not configured", async () => {
      // Better than letting the fetch fail with a connection error the user
      // cannot interpret.
      (isJobSpyEnabled as any).mockReturnValue(false);
      const result = await runAutomation(automation());
      expect(result.status).toBe("blocked");
      expect(result.blockedReason).toBe("source_unavailable");
      expect((searchJobSpyJobs as any).mock.calls.length).toBe(0);
    });
  });

  it("completes without analysis when everything is already saved", async () => {
    const job = makeJob("Frontend Engineer", "React");
    (searchJobSpyJobs as any).mockResolvedValue({ jobs: [job], errors: [] });
    (prisma.job.findMany as any).mockResolvedValue([
      { jobUrl: job.url, JobTitle: null, Company: null, Location: null },
    ]);

    const result = await runAutomation(automation());

    expect(result.status).toBe("completed");
    expect(result.jobsDeduplicated).toBe(0);
    expect(result.jobsSaved).toBe(0);
    expect((generateText as any).mock.calls.length).toBe(0);
  });
});

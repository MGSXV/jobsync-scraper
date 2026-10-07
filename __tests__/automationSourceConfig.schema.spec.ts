import { CreateAutomationSchema } from "@/models/automation.schema";

const base = {
  name: "Test",
  resumeId: "550e8400-e29b-41d4-a716-446655440000",
  matchThreshold: 80,
  scheduleHour: 8,
};

describe("CreateAutomationSchema conditional validation", () => {
  it("rejects a retired job board", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "jsearch",
      keywords: "frontend",
      location: "Canada",
    });
    expect(result.success).toBe(false);
  });

  it("greenhouse requires at least one company", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "greenhouse",
      sourceConfig: { greenhouse: { companies: [] } },
    });
    expect(result.success).toBe(false);
  });

  it("greenhouse passes with one company and no keywords/location", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "greenhouse",
      sourceConfig: {
        greenhouse: {
          companies: [{ name: "Anthropic", token: "anthropic" }],
          targetTitles: ["Frontend Engineer"],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("greenhouse accepts topK within 1-50 and a saveUnanalyzed boolean", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "greenhouse",
      sourceConfig: {
        greenhouse: {
          companies: [{ name: "Anthropic", token: "anthropic" }],
          topK: 25,
          saveUnanalyzed: false,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("greenhouse rejects topK of 0", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "greenhouse",
      sourceConfig: {
        greenhouse: {
          companies: [{ name: "Anthropic", token: "anthropic" }],
          topK: 0,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("greenhouse rejects topK of 51", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "greenhouse",
      sourceConfig: {
        greenhouse: {
          companies: [{ name: "Anthropic", token: "anthropic" }],
          topK: 51,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("ashby requires at least one company", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "ashby",
      sourceConfig: { ashby: { companies: [] } },
    });
    expect(result.success).toBe(false);
  });

  it("ashby passes with one company", () => {
    const result = CreateAutomationSchema.safeParse({
      ...base,
      jobBoard: "ashby",
      sourceConfig: {
        ashby: { companies: [{ name: "Ramp", token: "ramp" }] },
      },
    });
    expect(result.success).toBe(true);
  });

  describe("jobspy (search kind)", () => {
    const jobspy = (cfg: Record<string, unknown>) => ({
      ...base,
      jobBoard: "jobspy",
      sourceConfig: { jobspy: cfg },
    });

    it("passes with a board and a search term", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: ["indeed"], searchTerm: "backend engineer" }),
      );
      expect(result.success).toBe(true);
    });

    it("requires at least one board", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: [], searchTerm: "backend engineer" }),
      );
      expect(result.success).toBe(false);
    });

    it("requires a search term", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: ["indeed"] }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects a whitespace-only search term", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: ["indeed"], searchTerm: "   " }),
      );
      expect(result.success).toBe(false);
    });

    it("does NOT require companies — the watchlist rule must not leak across kinds", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: ["indeed"], searchTerm: "x" }),
      );
      expect(result.success).toBe(true);
    });

    it("rejects an unknown board", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: ["monster"], searchTerm: "x" }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects a results count above the sidecar's cap", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: ["indeed"], searchTerm: "x", resultsWanted: 10000 }),
      );
      expect(result.success).toBe(false);
    });

    it("accepts the shared targeting fields", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({
          sites: ["indeed"],
          searchTerm: "x",
          targetTitles: ["Backend Engineer"],
          keywords: ["python"],
          strictLocation: true,
          topK: 5,
          saveUnanalyzed: false,
        }),
      );
      expect(result.success).toBe(true);
    });

    it("still rejects a topK above the listing cap", () => {
      const result = CreateAutomationSchema.safeParse(
        jobspy({ sites: ["indeed"], searchTerm: "x", topK: 51 }),
      );
      expect(result.success).toBe(false);
    });
  });
});

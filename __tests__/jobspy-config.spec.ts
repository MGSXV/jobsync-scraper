import { parseJobSpyConfig } from "@/lib/scraper/automation-run/config";
import { APP_CONSTANTS } from "@/lib/constants";

function stored(cfg: Record<string, unknown>): string {
  return JSON.stringify({ jobspy: cfg });
}

describe("parseJobSpyConfig", () => {
  it("returns null for absent or unparseable config", () => {
    expect(parseJobSpyConfig(null)).toBeNull();
    expect(parseJobSpyConfig("")).toBeNull();
    expect(parseJobSpyConfig("{not json")).toBeNull();
  });

  it("returns null when the jobspy section is missing", () => {
    expect(parseJobSpyConfig(JSON.stringify({ greenhouse: {} }))).toBeNull();
  });

  it("reads the query fields", () => {
    const cfg = parseJobSpyConfig(
      stored({
        sites: ["indeed", "linkedin"],
        searchTerm: "  backend engineer  ",
        location: "Calgary, AB",
        countryIndeed: "canada",
        hoursOld: 72,
        isRemote: true,
        jobType: "fulltime",
      }),
    );
    expect(cfg).toMatchObject({
      sites: ["indeed", "linkedin"],
      searchTerm: "backend engineer",
      location: "Calgary, AB",
      countryIndeed: "canada",
      hoursOld: 72,
      isRemote: true,
      jobType: "fulltime",
    });
  });

  it("drops unknown sites rather than failing the whole run", () => {
    // Passing them through would make the sidecar 422 the entire request,
    // losing the sites that were valid.
    const cfg = parseJobSpyConfig(
      stored({ sites: ["indeed", "monster", "google"], searchTerm: "x" }),
    );
    expect(cfg?.sites).toEqual(["indeed"]);
  });

  it("caps resultsWanted at the sidecar's own ceiling", () => {
    const cfg = parseJobSpyConfig(
      stored({ sites: ["indeed"], searchTerm: "x", resultsWanted: 10_000 }),
    );
    expect(cfg?.resultsWanted).toBe(APP_CONSTANTS.JOBSPY_MAX_RESULTS_WANTED);
  });

  it("defaults resultsWanted when unset", () => {
    const cfg = parseJobSpyConfig(stored({ sites: ["indeed"], searchTerm: "x" }));
    expect(cfg?.resultsWanted).toBe(
      APP_CONSTANTS.JOBSPY_DEFAULT_RESULTS_WANTED,
    );
  });

  it("keeps descriptions on unless explicitly turned off", () => {
    const base = { sites: ["indeed"], searchTerm: "x" };
    expect(parseJobSpyConfig(stored(base))?.fetchDescription).toBe(true);
    expect(
      parseJobSpyConfig(stored({ ...base, fetchDescription: false }))
        ?.fetchDescription,
    ).toBe(false);
    expect(
      parseJobSpyConfig(stored({ ...base, fetchDescription: true }))
        ?.fetchDescription,
    ).toBe(true);
  });

  it("surfaces an empty search term as empty so the runner can refuse it", () => {
    const cfg = parseJobSpyConfig(
      stored({ sites: ["indeed"], searchTerm: "   " }),
    );
    expect(cfg?.searchTerm).toBe("");
  });

  it("carries the shared targeting fields", () => {
    const cfg = parseJobSpyConfig(
      stored({
        sites: ["indeed"],
        searchTerm: "x",
        targetTitles: ["Backend Engineer"],
        keywords: ["python"],
        locations: ["Calgary"],
        strictLocation: true,
        topK: 5,
        saveUnanalyzed: false,
      }),
    );
    expect(cfg).toMatchObject({
      targetTitles: ["Backend Engineer"],
      keywords: ["python"],
      locations: ["Calgary"],
      strictLocation: true,
      topK: 5,
      saveUnanalyzed: false,
    });
  });

  it("defaults the shared targeting fields", () => {
    const cfg = parseJobSpyConfig(stored({ sites: ["indeed"], searchTerm: "x" }));
    expect(cfg).toMatchObject({
      targetTitles: [],
      keywords: [],
      locations: [],
      strictLocation: false,
      topK: APP_CONSTANTS.MAX_JOBS_PER_RUN,
      saveUnanalyzed: true,
    });
  });

  it("ignores non-string entries in the string arrays", () => {
    const cfg = parseJobSpyConfig(
      stored({
        sites: ["indeed"],
        searchTerm: "x",
        keywords: ["python", 42, null],
      }),
    );
    expect(cfg?.keywords).toEqual(["python"]);
  });
});

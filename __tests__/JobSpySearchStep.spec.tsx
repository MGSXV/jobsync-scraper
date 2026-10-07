import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobSpySearchStep } from "@/components/automations/JobSpySearchStep";
import type { JobSpySourceConfig } from "@/models/automation.model";

// TargetingFields pulls four entity actions for its chip inputs; all four must
// be mocked or the module throws at import.
vi.mock("@/actions/jobtitle.actions", () => ({
  getAllJobTitles: vi.fn().mockResolvedValue([]),
  createJobTitle: vi.fn(),
}));

vi.mock("@/actions/tag.actions", () => ({
  getAllTags: vi.fn().mockResolvedValue([]),
  createTag: vi.fn(),
}));

vi.mock("@/actions/jobLocation.actions", () => ({
  getAllJobLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/actions/job.actions", () => ({
  createLocation: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

// Required by the Radix Select used for country/job type/posted-within.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

function config(
  overrides: Partial<JobSpySourceConfig> = {},
): JobSpySourceConfig {
  return { sites: ["indeed"], searchTerm: "", ...overrides };
}

function setup(overrides: Partial<JobSpySourceConfig> = {}) {
  const onChange = vi.fn();
  render(<JobSpySearchStep value={config(overrides)} onChange={onChange} />);
  return onChange;
}

describe("JobSpySearchStep", () => {
  const user = userEvent.setup();

  it("offers no company picker — the query is the selector", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: /search companies/i }),
    ).not.toBeInTheDocument();
  });

  describe("board picker", () => {
    it("reflects the selected boards as pressed toggles", () => {
      setup({ sites: ["indeed", "linkedin"] });
      expect(screen.getByRole("button", { name: "Indeed" })).toHaveAttribute(
        "data-state",
        "on",
      );
      expect(screen.getByRole("button", { name: "LinkedIn" })).toHaveAttribute(
        "data-state",
        "on",
      );
      expect(screen.getByRole("button", { name: "Glassdoor" })).toHaveAttribute(
        "data-state",
        "off",
      );
    });

    it("does not offer Google, which is unavailable upstream", () => {
      setup();
      expect(
        screen.queryByRole("button", { name: /google/i }),
      ).not.toBeInTheDocument();
    });

    it("adds a board on click", async () => {
      const onChange = setup({ sites: ["indeed"] });
      await user.click(screen.getByRole("button", { name: "LinkedIn" }));
      expect(onChange.mock.calls[0][0].sites).toEqual(["indeed", "linkedin"]);
    });

    it("removes an already-selected board on click", async () => {
      const onChange = setup({ sites: ["indeed", "linkedin"] });
      await user.click(screen.getByRole("button", { name: "Indeed" }));
      expect(onChange.mock.calls[0][0].sites).toEqual(["linkedin"]);
    });

    it("warns about boards that block aggressively", () => {
      setup({ sites: ["linkedin"] });
      expect(screen.getByText(/rate limits aggressively/i)).toBeInTheDocument();
    });

    it("stays quiet about boards that are not selected", () => {
      setup({ sites: ["indeed"] });
      expect(
        screen.queryByText(/rate limits aggressively/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/30 requests per ip/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("country field", () => {
    it("is shown for Indeed, which requires it", () => {
      setup({ sites: ["indeed"] });
      expect(screen.getByText(/required by indeed and glassdoor/i)).toBeInTheDocument();
    });

    it("is hidden for boards that ignore it", () => {
      setup({ sites: ["bayt"] });
      expect(
        screen.queryByText(/required by indeed and glassdoor/i),
      ).not.toBeInTheDocument();
    });

    it("warns when Glassdoor does not cover the chosen country", () => {
      // Glassdoor covers a strict subset of Indeed's countries; picking one it
      // lacks returns nothing rather than erroring, so say so up front.
      setup({ sites: ["glassdoor"], countryIndeed: "pakistan" });
      expect(
        screen.getByText(/glassdoor does not cover this country/i),
      ).toBeInTheDocument();
    });

    it("does not warn for a country Glassdoor covers", () => {
      setup({ sites: ["glassdoor"], countryIndeed: "canada" });
      expect(
        screen.queryByText(/glassdoor does not cover this country/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("description fetching", () => {
    it("defaults on, because Indeed and LinkedIn omit descriptions", () => {
      setup();
      expect(
        screen.getByRole("switch", { name: /fetch full descriptions/i }),
      ).toBeChecked();
    });

    it("reflects an explicit opt-out", () => {
      setup({ fetchDescription: false });
      expect(
        screen.getByRole("switch", { name: /fetch full descriptions/i }),
      ).not.toBeChecked();
    });
  });

  it("reuses the shared targeting and run-budget fields", () => {
    // These are the same components the ATS step renders; the funnel they
    // configure is source-agnostic.
    setup();
    expect(screen.getByText(/target job titles/i)).toBeInTheDocument();
    expect(screen.getByText(/jobs analyzed per run/i)).toBeInTheDocument();
    expect(
      screen.getByText(/save additional relevant listings/i),
    ).toBeInTheDocument();
  });

  it("writes the search term through", async () => {
    const onChange = setup();
    await user.type(
      screen.getByPlaceholderText(/backend engineer python/i),
      "x",
    );
    expect(onChange.mock.calls[0][0].searchTerm).toBe("x");
  });
});

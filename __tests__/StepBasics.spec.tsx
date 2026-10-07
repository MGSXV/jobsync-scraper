import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { StepBasics } from "@/components/automations/automation-wizard/StepBasics";
import type { CreateAutomationInput } from "@/models/automation.schema";

// Required by the Radix Select.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

function Harness({
  jobSpyEnabled,
  jobBoard = "greenhouse",
}: {
  jobSpyEnabled: boolean;
  jobBoard?: CreateAutomationInput["jobBoard"];
}) {
  const form = useForm<CreateAutomationInput>({
    defaultValues: { name: "", jobBoard },
  });
  return (
    <Form {...form}>
      <StepBasics form={form} jobSpyEnabled={jobSpyEnabled} />
    </Form>
  );
}

describe("StepBasics job board select", () => {
  const user = userEvent.setup();

  const openSelect = async () => {
    await user.click(screen.getByRole("combobox"));
  };

  it("always offers the company-watchlist sources", async () => {
    render(<Harness jobSpyEnabled={false} />);
    await openSelect();
    expect(screen.getByRole("option", { name: "Greenhouse" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lever" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ashby" })).toBeInTheDocument();
  });

  it("offers JobSpy when its service is configured", async () => {
    render(<Harness jobSpyEnabled />);
    await openSelect();
    expect(screen.getByRole("option", { name: /JobSpy/ })).toBeInTheDocument();
  });

  it("hides JobSpy when the service is not configured", async () => {
    // Otherwise a user could schedule a source that blocks on every run.
    render(<Harness jobSpyEnabled={false} />);
    await openSelect();
    expect(
      screen.queryByRole("option", { name: /JobSpy/ }),
    ).not.toBeInTheDocument();
  });

  it("still offers JobSpy while editing an existing JobSpy automation", async () => {
    // Reachable by editing an automation created while the sidecar was up —
    // hiding the option would render the select blank over its own value.
    render(<Harness jobSpyEnabled={false} jobBoard="jobspy" />);
    await openSelect();
    expect(screen.getByRole("option", { name: /JobSpy/ })).toBeInTheDocument();
  });

  it("warns that a JobSpy automation cannot run without the service", () => {
    render(<Harness jobSpyEnabled={false} jobBoard="jobspy" />);
    expect(
      screen.getByText(/JobSpy service is not configured/i),
    ).toBeInTheDocument();
  });

  it("does not warn when the service is configured", () => {
    render(<Harness jobSpyEnabled jobBoard="jobspy" />);
    expect(
      screen.queryByText(/JobSpy service is not configured/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/search job boards by keyword/i)).toBeInTheDocument();
  });

  it("describes a watchlist source differently", () => {
    render(<Harness jobSpyEnabled />);
    expect(
      screen.getByText(/track specific companies/i),
    ).toBeInTheDocument();
  });
});

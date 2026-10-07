"use client";

import { APP_CONSTANTS } from "@/lib/constants";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type { JobSpySourceConfig } from "@/models/automation.model";
import { JOBSPY_SITES } from "@/models/automation.model";
import type { AtsConfigValue } from "../AtsSearchStep";
import type { WizardResume } from "./wizardConfig";

const SITE_LABELS = new Map(JOBSPY_SITES.map((s) => [s.value, s.label]));

const POSTED_WITHIN: Record<number, string> = {
  24: "Last 24 hours",
  72: "Last 3 days",
  168: "Last week",
  336: "Last 2 weeks",
  720: "Last 30 days",
};

export function StepReview({
  formValues,
  atsConfig,
  jobSpyConfig,
  isSearchKind,
  selectedResume,
}: {
  formValues: CreateAutomationInput;
  atsConfig: AtsConfigValue;
  jobSpyConfig: JobSpySourceConfig;
  isSearchKind: boolean;
  selectedResume?: WizardResume;
}) {
  // Ranking and run-budget rows below are shared, so they read from whichever
  // config is active.
  const shared = isSearchKind ? jobSpyConfig : atsConfig;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Name</span>
        <span className="font-medium">{formValues.name || "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Job Board</span>
        <span className="font-medium capitalize">
          {formValues.jobBoard || "-"}
        </span>
      </div>
      {isSearchKind ? (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Boards</span>
            <span className="font-medium text-right">
              {jobSpyConfig.sites?.length
                ? jobSpyConfig.sites
                    .map((s) => SITE_LABELS.get(s) ?? s)
                    .join(", ")
                : "-"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Search</span>
            <span className="font-medium text-right">
              {jobSpyConfig.searchTerm?.trim() || "-"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Search location</span>
            <span className="font-medium text-right">
              {jobSpyConfig.location?.trim() || "Anywhere"}
              {jobSpyConfig.isRemote ? " (remote only)" : ""}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Posted within</span>
            <span className="font-medium text-right">
              {jobSpyConfig.hoursOld
                ? (POSTED_WITHIN[jobSpyConfig.hoursOld] ??
                  `Last ${jobSpyConfig.hoursOld}h`)
                : "Any time"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Results per board</span>
            <span className="font-medium text-right">
              {jobSpyConfig.resultsWanted ??
                APP_CONSTANTS.JOBSPY_DEFAULT_RESULTS_WANTED}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Full descriptions</span>
            <span className="font-medium text-right">
              {jobSpyConfig.fetchDescription !== false ? "Yes" : "No"}
            </span>
          </div>
        </>
      ) : (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Companies</span>
          <span className="font-medium text-right">
            {atsConfig.companies?.length
              ? atsConfig.companies.map((c) => c.name).join(", ")
              : "-"}
          </span>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Target titles</span>
        <span className="font-medium text-right">
          {shared.targetTitles?.length
            ? shared.targetTitles.join(", ")
            : "Any"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Locations</span>
        <span className="font-medium text-right">
          {shared.locations?.length
            ? `${shared.locations.join(", ")}${
                shared.strictLocation ? " (strict)" : ""
              }`
            : "Any location"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Jobs analyzed per run</span>
        <span className="font-medium text-right">
          {shared.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Save additional listings</span>
        <span className="font-medium text-right">
          {shared.saveUnanalyzed !== false ? "Yes" : "No"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Resume</span>
        <span className="font-medium">
          {selectedResume?.title || "Not selected"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Match Threshold</span>
        <span className="font-medium">{formValues.matchThreshold ?? 80}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Schedule</span>
        <span className="font-medium">
          Daily at{" "}
          {(formValues.scheduleHour ?? 8).toString().padStart(2, "0")}:00
        </span>
      </div>
    </div>
  );
}
